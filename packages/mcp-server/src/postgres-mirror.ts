// Stage #8 postgres-mirror — dual-write helper for operational data offload.
//
// Hard rules (per CISO C-S8-A..E and conductor-state.intent.hard_limits):
//   - Every exported mirror function early-returns when STAGE_8_DUAL_WRITE !== 'true'.
//   - Every SQL value goes through $N parameter — never string-interpolated.
//   - Every error is caught and written to stderr; never re-thrown (must not fail caller).
//   - Connection string is built once at first use and NEVER logged.
//   - 250ms statement_timeout per call protects request-path tail latency.
//
// Module exports one typed function per Stage-#8 collection. Each one is
// the only public entry-point for its table. Schema is fully qualified
// (operational.<table>) inside the SQL templates — table/schema names are
// the ONLY parts of the SQL string that are template-interpolated, and
// they come from module-local constants (never from user input).

import { Pool, type PoolConfig } from "pg";

// --- env loading (process.env only — runtime mirror does not parse files) ---

function readEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`postgres-mirror: required env var ${name} is not set`);
  }
  return v;
}

function dualWriteEnabled(): boolean {
  return process.env.STAGE_8_DUAL_WRITE === "true";
}

// Stage #13: independent flag. STAGE_8 and STAGE_13 dual-writes are
// independent — enabling one does not enable the other.
function dualWriteEnabledStage13(): boolean {
  return process.env.STAGE_13_DUAL_WRITE === "true";
}

// --- pool (lazy init; test helpers exported for vitest) ---

let pool: Pool | null = null;

function buildPoolConfig(): PoolConfig {
  const user = readEnv("CLAUDE_MEMORY_PG_USER");
  const database = readEnv("CLAUDE_MEMORY_PG_DB");
  const password = readEnv("CLAUDE_MEMORY_PG_PASSWORD");
  const host = process.env.CLAUDE_MEMORY_PG_HOST || "127.0.0.1";
  const portStr = process.env.CLAUDE_MEMORY_PG_PORT || "5432";
  const port = Number.parseInt(portStr, 10);
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    throw new Error(`postgres-mirror: invalid CLAUDE_MEMORY_PG_PORT ${portStr}`);
  }
  return {
    user,
    database,
    password,
    host,
    port,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 2_000,
    application_name: "claude-memory-mcp.stage8-mirror",
  };
}

function getPool(): Pool {
  if (pool === null) {
    pool = new Pool(buildPoolConfig());
    // pg emits 'error' on idle clients — must be handled or the process exits.
    pool.on("error", (err) => {
      process.stderr.write(
        `[postgres-mirror][pool-error] ${err.message}\n`
      );
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
    try {
      await pool.end();
    } catch {
      // ignore — tests may have poisoned the pool
    }
    pool = null;
  }
}

// --- observability counters (CISO advisory A-S8-F) ---

export interface MirrorStats {
  attempts: number;
  success: number;
  failures: number;
  lastErrorAt: string | null;
  lastError: string | null;
  byCollection: Record<string, { attempts: number; success: number; failures: number }>;
}

export const mirrorStats: MirrorStats = {
  attempts: 0,
  success: 0,
  failures: 0,
  lastErrorAt: null,
  lastError: null,
  byCollection: {},
};

function bumpAttempt(collection: string): void {
  mirrorStats.attempts++;
  const c = (mirrorStats.byCollection[collection] ??= { attempts: 0, success: 0, failures: 0 });
  c.attempts++;
}

function bumpSuccess(collection: string): void {
  mirrorStats.success++;
  const c = (mirrorStats.byCollection[collection] ??= { attempts: 0, success: 0, failures: 0 });
  c.success++;
}

function bumpFailure(collection: string, err: Error): void {
  mirrorStats.failures++;
  mirrorStats.lastErrorAt = new Date().toISOString();
  mirrorStats.lastError = err.message;
  const c = (mirrorStats.byCollection[collection] ??= { attempts: 0, success: 0, failures: 0 });
  c.failures++;
}

/** Reset counters (test-only). */
export function __resetStatsForTests(): void {
  mirrorStats.attempts = 0;
  mirrorStats.success = 0;
  mirrorStats.failures = 0;
  mirrorStats.lastErrorAt = null;
  mirrorStats.lastError = null;
  mirrorStats.byCollection = {};
}

// --- shared executor: parameterized INSERT + ON CONFLICT DO NOTHING ---

async function execInsert(
  collection: string,
  table: string,
  columns: readonly string[],
  values: readonly unknown[],
  payload: unknown,
  qdrantId: string,
  uuidId: string
): Promise<void> {
  if (!dualWriteEnabled()) return;
  bumpAttempt(collection);

  // Build the parameter placeholders. Table/schema constants only — never
  // user input — are interpolated. All values are $N parameters.
  const cols = ["id", "qdrant_id", ...columns, "payload", "migrated_at"];
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  // payload goes through $N as well, with a ::jsonb cast applied at the placeholder boundary.
  const payloadIdx = 2 + columns.length + 1; // 1-based: id=1, qdrant_id=2, then columns, then payload
  const fixedPlaceholders = cols
    .map((c, i) => (c === "payload" ? `$${i + 1}::jsonb` : `$${i + 1}`))
    .join(", ");

  const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${fixedPlaceholders}) ON CONFLICT (qdrant_id) DO NOTHING`;
  const params = [uuidId, qdrantId, ...values, JSON.stringify(payload), null];

  const p = getPool();
  let client;
  try {
    client = await p.connect();
    try {
      await client.query("SET LOCAL statement_timeout = '250ms'");
      await client.query(sql, params);
      bumpSuccess(collection);
    } finally {
      client.release();
    }
  } catch (err) {
    const e = err as Error;
    bumpFailure(collection, e);
    // CISO C-S8-B: log only structured fields, NEVER the connection string or pool config.
    process.stderr.write(
      `[postgres-mirror][${collection}][${qdrantId}] ${e.message}\n`
    );
    // CISO C-S8-E: must not throw.
    return;
  }
  // payloadIdx is unused; kept for clarity that payload position is tracked.
  void payloadIdx;
}

// --- helpers for safe payload extraction ---

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function asTimestamp(v: unknown): string | null {
  // Accept ISO-8601 strings; pg will parse to timestamptz. Anything else → null.
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? v : null;
}
function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function asInteger(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) ? v : null;
}

// --- typed payload interfaces (one per collection) ---

export interface AuditLogPayload {
  action?: unknown;
  timestamp?: unknown;
  session_id?: unknown;
  project?: unknown;
  sensitivity?: unknown;
  details?: unknown;
  [k: string]: unknown;
}
export interface ForensicEventsPayload {
  event_type?: unknown;
  severity?: unknown;
  timestamp?: unknown;
  project?: unknown;
  sensitivity?: unknown;
  [k: string]: unknown;
}
export interface GuardianAuditLogPayload {
  action?: unknown;
  decision?: unknown;
  timestamp?: unknown;
  project?: unknown;
  sensitivity?: unknown;
  [k: string]: unknown;
}
export interface BenchmarkRunsPayload {
  benchmark_name?: unknown;
  status?: unknown;
  started_at?: unknown;
  completed_at?: unknown;
  project?: unknown;
  [k: string]: unknown;
}
export interface BenchmarksPayload {
  name?: unknown;
  metric?: unknown;
  value?: unknown;
  timestamp?: unknown;
  project?: unknown;
  [k: string]: unknown;
}
export interface ConsolidationCyclesPayload {
  cycle_id?: unknown;
  cycle_type?: unknown;
  started_at?: unknown;
  completed_at?: unknown;
  memories_processed?: unknown;
  project?: unknown;
  [k: string]: unknown;
}
export interface AgentIdentitySessionsPayload {
  agent_id?: unknown;
  session_id?: unknown;
  started_at?: unknown;
  ended_at?: unknown;
  project?: unknown;
  [k: string]: unknown;
}
export interface DelegationTokensPayload {
  token_id?: unknown;
  agent_id?: unknown;
  issued_at?: unknown;
  expires_at?: unknown;
  status?: unknown;
  project?: unknown;
  [k: string]: unknown;
}
export interface NhiLifecyclePayload {
  nhi_id?: unknown;
  nhi_type?: unknown;
  status?: unknown;
  created_ts?: unknown;
  project?: unknown;
  [k: string]: unknown;
}
export interface NhiTransitionsPayload {
  nhi_id?: unknown;
  from_state?: unknown;
  to_state?: unknown;
  transitioned_at?: unknown;
  project?: unknown;
  [k: string]: unknown;
}
export interface ComplianceDashboardPayload {
  framework?: unknown;
  score?: unknown;
  captured_at?: unknown;
  project?: unknown;
  [k: string]: unknown;
}
export interface ComplianceTrendsPayload {
  framework?: unknown;
  trend_window?: unknown;
  value?: unknown;
  captured_at?: unknown;
  project?: unknown;
  [k: string]: unknown;
}

// --- exported mirror functions (one per collection) ---

export async function mirrorAuditLog(id: string, payload: AuditLogPayload): Promise<void> {
  await execInsert(
    "audit_log",
    "operational.audit_log",
    ["action", "timestamp", "session_id", "project", "sensitivity", "details"],
    [
      asString(payload.action),
      asTimestamp(payload.timestamp),
      asString(payload.session_id),
      asString(payload.project),
      asString(payload.sensitivity),
      payload.details !== undefined ? JSON.stringify(payload.details) : null,
    ],
    payload,
    id,
    id
  );
}

export async function mirrorForensicEvents(id: string, payload: ForensicEventsPayload): Promise<void> {
  await execInsert(
    "forensic_events",
    "operational.forensic_events",
    ["event_type", "severity", "timestamp", "project", "sensitivity"],
    [
      asString(payload.event_type),
      asString(payload.severity),
      asTimestamp(payload.timestamp),
      asString(payload.project),
      asString(payload.sensitivity),
    ],
    payload,
    id,
    id
  );
}

export async function mirrorGuardianAuditLog(id: string, payload: GuardianAuditLogPayload): Promise<void> {
  await execInsert(
    "guardian_audit_log",
    "operational.guardian_audit_log",
    ["action", "decision", "timestamp", "project", "sensitivity"],
    [
      asString(payload.action),
      asString(payload.decision),
      asTimestamp(payload.timestamp),
      asString(payload.project),
      asString(payload.sensitivity),
    ],
    payload,
    id,
    id
  );
}

export async function mirrorBenchmarkRuns(id: string, payload: BenchmarkRunsPayload): Promise<void> {
  await execInsert(
    "benchmark_runs",
    "operational.benchmark_runs",
    ["benchmark_name", "status", "started_at", "completed_at", "project"],
    [
      asString(payload.benchmark_name),
      asString(payload.status),
      asTimestamp(payload.started_at),
      asTimestamp(payload.completed_at),
      asString(payload.project),
    ],
    payload,
    id,
    id
  );
}

export async function mirrorBenchmarks(id: string, payload: BenchmarksPayload): Promise<void> {
  await execInsert(
    "benchmarks",
    "operational.benchmarks",
    ["name", "metric", "value", "timestamp", "project"],
    [
      asString(payload.name),
      asString(payload.metric),
      asNumber(payload.value),
      asTimestamp(payload.timestamp),
      asString(payload.project),
    ],
    payload,
    id,
    id
  );
}

export async function mirrorConsolidationCycles(id: string, payload: ConsolidationCyclesPayload): Promise<void> {
  await execInsert(
    "consolidation_cycles",
    "operational.consolidation_cycles",
    ["cycle_id", "cycle_type", "started_at", "completed_at", "memories_processed", "project"],
    [
      asString(payload.cycle_id),
      asString(payload.cycle_type),
      asTimestamp(payload.started_at),
      asTimestamp(payload.completed_at),
      asInteger(payload.memories_processed),
      asString(payload.project),
    ],
    payload,
    id,
    id
  );
}

export async function mirrorAgentIdentitySessions(id: string, payload: AgentIdentitySessionsPayload): Promise<void> {
  await execInsert(
    "agent_identity_sessions",
    "operational.agent_identity_sessions",
    ["agent_id", "session_id", "started_at", "ended_at", "project"],
    [
      asString(payload.agent_id),
      asString(payload.session_id),
      asTimestamp(payload.started_at),
      asTimestamp(payload.ended_at),
      asString(payload.project),
    ],
    payload,
    id,
    id
  );
}

export async function mirrorDelegationTokens(id: string, payload: DelegationTokensPayload): Promise<void> {
  await execInsert(
    "delegation_tokens",
    "operational.delegation_tokens",
    ["token_id", "agent_id", "issued_at", "expires_at", "status", "project"],
    [
      asString(payload.token_id),
      asString(payload.agent_id),
      asTimestamp(payload.issued_at),
      asTimestamp(payload.expires_at),
      asString(payload.status),
      asString(payload.project),
    ],
    payload,
    id,
    id
  );
}

export async function mirrorNhiLifecycle(id: string, payload: NhiLifecyclePayload): Promise<void> {
  await execInsert(
    "nhi_lifecycle",
    "operational.nhi_lifecycle",
    ["nhi_id", "nhi_type", "status", "created_ts", "project"],
    [
      asString(payload.nhi_id),
      asString(payload.nhi_type),
      asString(payload.status),
      asTimestamp(payload.created_ts),
      asString(payload.project),
    ],
    payload,
    id,
    id
  );
}

export async function mirrorNhiTransitions(id: string, payload: NhiTransitionsPayload): Promise<void> {
  await execInsert(
    "nhi_transitions",
    "operational.nhi_transitions",
    ["nhi_id", "from_state", "to_state", "transitioned_at", "project"],
    [
      asString(payload.nhi_id),
      asString(payload.from_state),
      asString(payload.to_state),
      asTimestamp(payload.transitioned_at),
      asString(payload.project),
    ],
    payload,
    id,
    id
  );
}

export async function mirrorComplianceDashboard(id: string, payload: ComplianceDashboardPayload): Promise<void> {
  await execInsert(
    "compliance_dashboard",
    "operational.compliance_dashboard",
    ["framework", "score", "captured_at", "project"],
    [
      asString(payload.framework),
      asNumber(payload.score),
      asTimestamp(payload.captured_at),
      asString(payload.project),
    ],
    payload,
    id,
    id
  );
}

export async function mirrorComplianceTrends(id: string, payload: ComplianceTrendsPayload): Promise<void> {
  await execInsert(
    "compliance_trends",
    "operational.compliance_trends",
    ["framework", "trend_window", "value", "captured_at", "project"],
    [
      asString(payload.framework),
      asString(payload.trend_window),
      asNumber(payload.value),
      asTimestamp(payload.captured_at),
      asString(payload.project),
    ],
    payload,
    id,
    id
  );
}

// --- aggregate map for tests / discovery ---

// ============================================================================
// Stage #13 — episodic & transcripts mirror (memory.* schema, independent flag)
// ============================================================================

export interface EpisodePayload {
  task?: unknown;
  project?: unknown;
  status?: unknown;
  agents_invoked?: unknown;
  tools_used?: unknown;
  files_modified?: unknown;
  learnings?: unknown;
  started_at?: unknown;
  completed_at?: unknown;
  duration_ms?: unknown;
  sensitivity?: unknown;
  [k: string]: unknown;
}

export interface SessionTranscriptPayload {
  session_id?: unknown;
  project?: unknown;
  transcript?: unknown;
  message_count?: unknown;
  user_message_count?: unknown;
  has_corrections?: unknown;
  has_decisions?: unknown;
  extraction_tier?: unknown;
  created_at?: unknown;
  expires_at?: unknown;
  [k: string]: unknown;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === "string") out.push(item);
  }
  return out;
}
function asBoolean(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

/**
 * Stage #13: dual-write executor for the memory.* schema.
 *
 * Identical contract to Stage #8's execInsert:
 *   - feature-flag gated
 *   - parameterized SQL only
 *   - ON CONFLICT (qdrant_id) DO NOTHING
 *   - statement_timeout 250ms
 *   - failures non-fatal (caught, stderr structured log, NEVER re-thrown)
 *
 * Differences from Stage #8 executor:
 *   - reads STAGE_13_DUAL_WRITE, not STAGE_8_DUAL_WRITE
 *   - separate counter namespace per Stage #13 collection
 *   - supports per-column type override (TEXT[], jsonb, etc.) via colTypes
 */
async function execInsertStage13(
  collection: string,
  table: string,
  columns: readonly string[],
  values: readonly unknown[],
  colTypes: readonly (string | null)[], // null = $N as-is; "jsonb" / "text[]" = $N::<type>
  payload: unknown,
  qdrantId: string,
  uuidId: string
): Promise<void> {
  if (!dualWriteEnabledStage13()) return;
  bumpAttempt(collection);

  const cols = ["id", "qdrant_id", ...columns, "payload", "migrated_at"];
  // Build per-column placeholder, applying type cast where needed.
  // Index 0=id, 1=qdrant_id, 2..2+len-1=hot cols, then payload, migrated_at.
  const placeholders = cols.map((c, i) => {
    if (c === "payload") return `$${i + 1}::jsonb`;
    if (c === "id" || c === "qdrant_id" || c === "migrated_at") return `$${i + 1}`;
    // hot column — look up its type override (offset by 2 for id+qdrant_id)
    const hotIdx = i - 2;
    const t = colTypes[hotIdx] ?? null;
    return t === null ? `$${i + 1}` : `$${i + 1}::${t}`;
  }).join(", ");

  const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders}) ON CONFLICT (qdrant_id) DO NOTHING`;
  const params = [uuidId, qdrantId, ...values, JSON.stringify(payload), null];

  const p = getPool();
  let client;
  try {
    client = await p.connect();
    try {
      await client.query("SET LOCAL statement_timeout = '250ms'");
      await client.query(sql, params);
      bumpSuccess(collection);
    } finally {
      client.release();
    }
  } catch (err) {
    const e = err as Error;
    bumpFailure(collection, e);
    // CISO C-S13-B: only structured fields, NEVER the connection string.
    process.stderr.write(
      `[postgres-mirror][${collection}][${qdrantId}] ${e.message}\n`
    );
    // CISO C-S13-E: must not throw.
    return;
  }
}

export async function mirrorEpisode(id: string, payload: EpisodePayload): Promise<void> {
  // C-S13-G: sensitivity preserved in hot column AND payload JSONB.
  // metadata is built as the legacy_created_at carrier (Risk #1).
  const metadata: Record<string, unknown> = {};
  if (typeof payload.created_at === "string") {
    metadata.legacy_created_at = payload.created_at;
  }
  await execInsertStage13(
    "episodes",
    "memory.episodes",
    [
      "task", "project", "status", "outcome",
      "agents_invoked", "tools_used", "files_modified", "learnings",
      "full_transcript",
      "started_at", "completed_at", "duration_ms",
      "sensitivity",
      "metadata",
    ],
    [
      asString(payload.task),
      asString(payload.project),
      asString(payload.status),
      null,
      asStringArray(payload.agents_invoked),
      asStringArray(payload.tools_used),
      asStringArray(payload.files_modified),
      asStringArray(payload.learnings),
      null,
      asTimestamp(payload.started_at),
      asTimestamp(payload.completed_at),
      typeof payload.duration_ms === "number" && Number.isInteger(payload.duration_ms)
        ? payload.duration_ms
        : null,
      asString(payload.sensitivity),
      JSON.stringify(metadata),
    ],
    // Type overrides matching the hot-column list above.
    // arrays cast as text[]; metadata cast as jsonb; rest as-is.
    [
      null, null, null, null,
      "text[]", "text[]", "text[]", "text[]",
      null,
      null, null, null,
      null,
      "jsonb",
    ],
    payload,
    id,
    id
  );
}

export async function mirrorSessionTranscript(id: string, payload: SessionTranscriptPayload): Promise<void> {
  await execInsertStage13(
    "session_transcripts",
    "memory.session_transcripts",
    [
      "session_id", "project", "content",
      "message_count", "user_message_count",
      "has_corrections", "has_decisions", "extraction_tier",
      "recorded_at", "expires_at",
    ],
    [
      asString(payload.session_id),
      asString(payload.project),
      asString(payload.transcript),
      asInteger(payload.message_count),
      asInteger(payload.user_message_count),
      asBoolean(payload.has_corrections),
      asBoolean(payload.has_decisions),
      asString(payload.extraction_tier),
      asTimestamp(payload.created_at),
      asTimestamp(payload.expires_at),
    ],
    [null, null, null, null, null, null, null, null, null, null],
    payload,
    id,
    id
  );
}

// --- aggregate map for Stage #13 tests / discovery ---

export const STAGE_13_COLLECTIONS = ["episodes", "session_transcripts"] as const;
export type Stage13Collection = (typeof STAGE_13_COLLECTIONS)[number];

export const STAGE_13_TABLE_NAMES: Readonly<Record<Stage13Collection, string>> = {
  episodes: "memory.episodes",
  session_transcripts: "memory.session_transcripts",
};

// --- aggregate map for Stage #8 tests / discovery ---

export const STAGE_8_COLLECTIONS = [
  "audit_log",
  "forensic_events",
  "guardian_audit_log",
  "benchmark_runs",
  "benchmarks",
  "consolidation_cycles",
  "agent_identity_sessions",
  "delegation_tokens",
  "nhi_lifecycle",
  "nhi_transitions",
  "compliance_dashboard",
  "compliance_trends",
] as const;

export type Stage8Collection = (typeof STAGE_8_COLLECTIONS)[number];

export const STAGE_8_TABLE_NAMES: Readonly<Record<Stage8Collection, string>> = {
  audit_log: "operational.audit_log",
  forensic_events: "operational.forensic_events",
  guardian_audit_log: "operational.guardian_audit_log",
  benchmark_runs: "operational.benchmark_runs",
  benchmarks: "operational.benchmarks",
  consolidation_cycles: "operational.consolidation_cycles",
  agent_identity_sessions: "operational.agent_identity_sessions",
  delegation_tokens: "operational.delegation_tokens",
  nhi_lifecycle: "operational.nhi_lifecycle",
  nhi_transitions: "operational.nhi_transitions",
  compliance_dashboard: "operational.compliance_dashboard",
  compliance_trends: "operational.compliance_trends",
};
