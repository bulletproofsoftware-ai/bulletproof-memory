// Stage #11 postgres-cold — search and mirror helpers for memory.memories_cold.
//
// Hard rules:
//   - C-S11-A: every value $N parameterized
//   - C-S11-B: no connection-string logs
//   - C-S11-C: single env source (process.env)
//   - C-S11-F: searchColdPostgres failures non-fatal — returns [], never throws
//   - C-S11-G: project scope MUST be applied when include_all_projects=false
//   - C-S11-H: promotion path fire-and-forget

import { Pool, type PoolConfig } from "pg";

function readEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`postgres-cold: required env var ${name} is not set`);
  }
  return v;
}

let pool: Pool | null = null;

function buildPoolConfig(): PoolConfig {
  const user = readEnv("CLAUDE_MEMORY_PG_USER");
  const database = readEnv("CLAUDE_MEMORY_PG_DB");
  const password = readEnv("CLAUDE_MEMORY_PG_PASSWORD");
  const host = process.env.CLAUDE_MEMORY_PG_HOST || "127.0.0.1";
  const portStr = process.env.CLAUDE_MEMORY_PG_PORT || "5432";
  const port = Number.parseInt(portStr, 10);
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    throw new Error(`postgres-cold: invalid CLAUDE_MEMORY_PG_PORT ${portStr}`);
  }
  return {
    user, database, password, host, port,
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 2_000,
    application_name: "claude-memory-mcp.stage11-cold",
  };
}

function getPool(): Pool {
  if (pool === null) {
    pool = new Pool(buildPoolConfig());
    pool.on("error", (err) => {
      process.stderr.write(`[postgres-cold][pool-error] ${err.message}\n`);
    });
  }
  return pool;
}

/** Test-only: swap in a poisoned pool for failure-mode testing. */
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

// ---------- searchColdPostgres ----------

export interface SearchColdResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

export interface SearchColdOptions {
  limit?: number;
  project?: string;
  includeAllProjects?: boolean;
  createdAfter?: string | null;       // ISO datetime
  lastAccessedAfter?: string | null;  // ISO datetime
}

/**
 * Stage #11: full-text + trigram search over memory.memories_cold.
 *
 * Returns shape compatible with searchPoints (id, score, payload).
 * Score is ts_rank normalized to [0, 1] via `LEAST(rank * 10, 1.0)`.
 * Falls back to trigram similarity when ts_rank is zero.
 *
 * C-S11-F: returns [] on any error — never throws.
 * C-S11-G: project scope applied when includeAllProjects=false.
 */
export async function searchColdPostgres(
  query: string,
  options: SearchColdOptions = {}
): Promise<SearchColdResult[]> {
  if (typeof query !== "string" || query.trim().length === 0) return [];

  const limit = Math.min(Math.max(options.limit ?? 5, 1), 100);
  const includeAllProjects = options.includeAllProjects === true;
  const project = options.project ?? null;

  // Build WHERE clauses with $N parameters.
  // $1 = query (used by both websearch_to_tsquery and similarity)
  // $2 = limit
  // Additional params appended below.
  const params: unknown[] = [query, limit];
  const where: string[] = [];

  // C-S11-G: project scope.
  if (!includeAllProjects && project !== null) {
    params.push(project);
    where.push(`(project = $${params.length} OR project = 'global' OR project IS NULL)`);
  }

  if (options.createdAfter) {
    params.push(options.createdAfter);
    where.push(`created_at >= $${params.length}`);
  }
  if (options.lastAccessedAfter) {
    params.push(options.lastAccessedAfter);
    where.push(`last_accessed_at >= $${params.length}`);
  }

  // Match clause: websearch_to_tsquery (forgiving) OR trigram similarity > 0.2.
  // The OR ensures fuzzy matches when the user query is loose.
  const matchClause =
    `(content_tsv @@ websearch_to_tsquery('english', $1) OR similarity(content, $1) > 0.2)`;
  where.push(matchClause);

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  // Score = max of normalized ts_rank and similarity, clamped to [0, 1].
  const sql = `
    SELECT
      qdrant_id AS id,
      LEAST(
        GREATEST(
          ts_rank(content_tsv, websearch_to_tsquery('english', $1)) * 10,
          similarity(content, $1)
        ),
        1.0
      ) AS score,
      payload
    FROM memory.memories_cold
    ${whereSql}
    ORDER BY score DESC, last_accessed_at DESC NULLS LAST
    LIMIT $2
  `;

  try {
    const p = getPool();
    const client = await p.connect();
    try {
      await client.query("SET LOCAL statement_timeout = '500ms'");
      const r = await client.query(sql, params);
      return (r.rows as Array<{ id: string; score: number; payload: Record<string, unknown> }>).map((row) => ({
        id: row.id,
        score: typeof row.score === "number" ? row.score : Number.parseFloat(String(row.score)) || 0,
        payload: row.payload || {},
      }));
    } finally {
      client.release();
    }
  } catch (err) {
    const e = err as Error;
    // C-S11-F: structured stderr only; never throw.
    process.stderr.write(`[postgres-cold][search] ${e.message}\n`);
    return [];
  }
}

// ---------- access counter update + promotion ----------

/**
 * Increment access_count and update last_accessed_at for a cold memory.
 * Fire-and-forget; failures swallowed.
 */
export async function touchColdAccess(qdrantId: string): Promise<void> {
  try {
    const p = getPool();
    const client = await p.connect();
    try {
      await client.query("SET LOCAL statement_timeout = '250ms'");
      await client.query(
        `UPDATE memory.memories_cold
         SET access_count = access_count + 1, last_accessed_at = now()
         WHERE qdrant_id = $1`,
        [qdrantId]
      );
    } finally {
      client.release();
    }
  } catch (err) {
    const e = err as Error;
    process.stderr.write(`[postgres-cold][touch][${qdrantId}] ${e.message}\n`);
  }
}

/**
 * Delete a cold memory row by qdrant_id (used by recall's expiration sweep).
 * Fire-and-forget; failures swallowed.
 */
export async function deleteColdRow(qdrantId: string): Promise<void> {
  try {
    const p = getPool();
    const client = await p.connect();
    try {
      await client.query("SET LOCAL statement_timeout = '250ms'");
      await client.query(
        `DELETE FROM memory.memories_cold WHERE qdrant_id = $1`,
        [qdrantId]
      );
    } finally {
      client.release();
    }
  } catch (err) {
    const e = err as Error;
    process.stderr.write(`[postgres-cold][delete][${qdrantId}] ${e.message}\n`);
  }
}

/**
 * Read full row by qdrant_id (used by promotion path to grab the
 * authoritative content/payload before re-embedding).
 */
export async function getColdRow(qdrantId: string): Promise<{ id: string; content: string | null; payload: Record<string, unknown> } | null> {
  try {
    const p = getPool();
    const client = await p.connect();
    try {
      await client.query("SET LOCAL statement_timeout = '250ms'");
      const r = await client.query(
        `SELECT qdrant_id AS id, content, payload FROM memory.memories_cold WHERE qdrant_id = $1 LIMIT 1`,
        [qdrantId]
      );
      if (r.rowCount === 0) return null;
      const row = r.rows[0] as { id: string; content: string | null; payload: Record<string, unknown> };
      return { id: row.id, content: row.content, payload: row.payload ?? {} };
    } finally {
      client.release();
    }
  } catch (err) {
    const e = err as Error;
    process.stderr.write(`[postgres-cold][get][${qdrantId}] ${e.message}\n`);
    return null;
  }
}

// ---------- mirrorMemoryCold ----------

export interface MemoriesColdPayload {
  content?: unknown;
  type?: unknown;
  tags?: unknown;
  project?: unknown;
  sensitivity?: unknown;
  created_at?: unknown;
  last_accessed_at?: unknown;
  access_count?: unknown;
  expires_at?: unknown;
  source?: unknown;
  [k: string]: unknown;
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function asTimestamp(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? v : null;
}
function asInteger(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) ? v : null;
}
function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) if (typeof item === "string") out.push(item);
  return out;
}

function dualWriteEnabled(): boolean {
  return process.env.STAGE_11_DUAL_WRITE === "true";
}

/**
 * Mirror a memories_cold row write into memory.memories_cold.
 * Flag-gated by STAGE_11_DUAL_WRITE.
 * C-S11-E: failures non-fatal.
 */
export async function mirrorMemoryCold(id: string, payload: MemoriesColdPayload): Promise<void> {
  if (!dualWriteEnabled()) return;

  const cols = [
    "id", "qdrant_id",
    "content", "type", "tags", "project", "sensitivity",
    "created_at", "last_accessed_at", "access_count",
    "expires_at", "source",
    "payload", "migrated_at",
  ];
  // $N=positions: 1=id, 2=qdrant_id, 3..12 hot, 13=payload, 14=migrated_at
  const placeholders = cols.map((c, i) => {
    if (c === "payload") return `$${i + 1}::jsonb`;
    if (c === "tags") return `$${i + 1}::text[]`;
    return `$${i + 1}`;
  }).join(", ");
  const sql =
    `INSERT INTO memory.memories_cold (${cols.join(", ")}) VALUES (${placeholders}) ` +
    `ON CONFLICT (qdrant_id) DO NOTHING`;

  const params: unknown[] = [
    id, id,
    asString(payload.content),
    asString(payload.type),
    asStringArray(payload.tags),
    asString(payload.project),
    asString(payload.sensitivity),
    asTimestamp(payload.created_at),
    asTimestamp(payload.last_accessed_at),
    asInteger(payload.access_count) ?? 0,
    asTimestamp(payload.expires_at),
    asString(payload.source),
    JSON.stringify(payload),
    null,
  ];

  try {
    const p = getPool();
    const client = await p.connect();
    try {
      await client.query("SET LOCAL statement_timeout = '250ms'");
      await client.query(sql, params);
    } finally {
      client.release();
    }
  } catch (err) {
    const e = err as Error;
    process.stderr.write(`[postgres-cold][mirror][${id}] ${e.message}\n`);
    // C-S11-E: must not throw.
    return;
  }
}
