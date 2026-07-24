// src/recall-trace.ts — Feature 2. Fail-open recall-trace persistence in COLD Postgres.
//
// HARD RULE: no function here may throw or reject in a way that reaches the recall
// handler. This copies the exact resilience contract of src/postgres-cold.ts:
//   - single env source (process.env), same CLAUDE_MEMORY_PG_* keys
//   - SET LOCAL statement_timeout on every txn
//   - stderr-only logging, no connection-string logs
//   - writeRecallTrace NEVER throws (swallows all errors, returns void)
//
// Pool-sharing decision (spec §2.3): this module keeps its OWN Pool + its OWN
// setPoolForTests, rather than importing postgres-cold.ts's private pool. Reason:
// the CISO Condition C connect-fail test must poison THIS module's pool
// independently (point it at an unreachable host so pool.connect() itself rejects)
// without disturbing the cold-search pool. Duplication is intentional and small.

import { Pool, type PoolConfig } from "pg";

function readEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`recall-trace: required env var ${name} is not set`);
  }
  return v;
}

let pool: Pool | null = null;

function buildPoolConfig(): PoolConfig {
  const user = readEnv("CLAUDE_MEMORY_PG_USER");
  const database = readEnv("CLAUDE_MEMORY_PG_DB");
  const password = readEnv("CLAUDE_MEMORY_PG_PASSWORD");
  const host = process.env.CLAUDE_MEMORY_PG_HOST || "127.0.0.1";
  const portStr = process.env.CLAUDE_MEMORY_PG_PORT || "5438";
  const port = Number.parseInt(portStr, 10);
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    throw new Error(`recall-trace: invalid CLAUDE_MEMORY_PG_PORT ${portStr}`);
  }
  return {
    user, database, password, host, port,
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 2_000,
    application_name: "claude-memory-mcp.recall-trace",
  };
}

function getPool(): Pool {
  if (pool === null) {
    pool = new Pool(buildPoolConfig());
    pool.on("error", (err) => {
      process.stderr.write(`[recall-trace][pool-error] ${err.message}\n`);
    });
  }
  return pool;
}

/** Test-only: swap in a poisoned pool for failure-mode testing (CISO Condition C). */
export function setPoolForTests(p: Pool | null): void {
  pool = p;
}

/** Test-only: end the current pool and clear it. */
export async function __closePoolForTests(): Promise<void> {
  if (pool !== null) {
    try { await pool.end(); } catch { /* tests may have poisoned */ }
    pool = null;
  }
}

export interface TraceResultInput {
  memory_id: string;
  rank: number;              // 1-based
  score: number | null;
  tier: string | null;
}

export interface WriteTraceInput {
  trace_id: string;          // caller-generated uuid (response can include it BEFORE the write completes)
  query: string;
  project: string | null;
  strategy: string | null;
  session_id?: string | null;
  agent_id?: string | null;
  results: TraceResultInput[];
}

/**
 * Persist a recall trace + its result rows. Fire-and-forget from the caller's view.
 * Returns void. NEVER throws. On any failure, logs to stderr and returns.
 * Uses a single transaction; a failed BEGIN/INSERT is rolled back and swallowed.
 * Result rows are capped at 50 to bound the payload.
 */
export async function writeRecallTrace(input: WriteTraceInput): Promise<void> {
  try {
    const p = getPool();
    const client = await p.connect();
    try {
      await client.query("SET LOCAL statement_timeout = '400ms'");
      await client.query("BEGIN");
      try {
        await client.query(
          `INSERT INTO audit.recall_trace
             (trace_id, query, project, strategy, result_count, session_id, agent_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (trace_id) DO NOTHING`,
          [input.trace_id, input.query, input.project, input.strategy,
           input.results.length, input.session_id ?? null, input.agent_id ?? null]
        );
        for (const r of input.results.slice(0, 50)) {
          await client.query(
            `INSERT INTO audit.recall_trace_result
               (trace_id, memory_id, rank, score, tier)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (trace_id, memory_id) DO NOTHING`,
            [input.trace_id, r.memory_id, r.rank, r.score, r.tier]
          );
        }
        await client.query("COMMIT");
      } catch (e) {
        try { await client.query("ROLLBACK"); } catch { /* ignore */ }
        throw e; // caught by the outer catch -> swallowed
      }
    } finally {
      client.release();
    }
  } catch (err) {
    process.stderr.write(`[recall-trace][write][${input.trace_id}] ${(err as Error).message}\n`);
    // FAIL-OPEN: never rethrow.
  }
}

export interface FeedbackInput {
  trace_id: string;
  used_memory_ids: string[];                          // which returned memories were actually used
  ignored?: { memory_id: string; reason: string }[];  // why others were skipped
}

export interface FeedbackResult { updated: number; ok: boolean; error?: string; }

/**
 * Record which memories from a prior trace were used/ignored.
 * Returns a small status object (this one CAN report failure to the tool caller,
 * because it is an explicit user-invoked tool, not the hot recall path).
 * Still never throws — returns { ok:false, error } on failure.
 */
export async function recordTraceFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  try {
    const p = getPool();
    const client = await p.connect();
    try {
      await client.query("SET LOCAL statement_timeout = '500ms'");
      let updated = 0;
      const now = new Date().toISOString();
      for (const mid of input.used_memory_ids) {
        const r = await client.query(
          `UPDATE audit.recall_trace_result
             SET was_used = true, feedback_at = $3
           WHERE trace_id = $1 AND memory_id = $2`,
          [input.trace_id, mid, now]
        );
        updated += r.rowCount ?? 0;
      }
      for (const ig of input.ignored ?? []) {
        const r = await client.query(
          `UPDATE audit.recall_trace_result
             SET was_used = false, ignore_reason = $3, feedback_at = $4
           WHERE trace_id = $1 AND memory_id = $2`,
          [input.trace_id, ig.memory_id, ig.reason, now]
        );
        updated += r.rowCount ?? 0;
      }
      return { updated, ok: true };
    } finally {
      client.release();
    }
  } catch (err) {
    process.stderr.write(`[recall-trace][feedback][${input.trace_id}] ${(err as Error).message}\n`);
    return { updated: 0, ok: false, error: (err as Error).message };
  }
}
