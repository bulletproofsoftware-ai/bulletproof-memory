import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { runCollection } from '../../../scripts/migrations/stage-11/lib/run-collection.js';
import { exportPgEnvToProcess, pgEnv, tcpProbe, qdrantCollectionExists } from './_helpers.js';

let stackOnline = false;
let qdrantSourcePresent = false;
let pool: Pool | null = null;

beforeAll(async () => {
  exportPgEnvToProcess();
  const c = pgEnv();
  stackOnline = await tcpProbe(c.host, c.port, 1500);
  if (!stackOnline) return;
  // Post-Sub-task-B skip-gate: memories_cold Qdrant collection may be dropped.
  qdrantSourcePresent = await qdrantCollectionExists('memories_cold');
  if (!qdrantSourcePresent) {
    console.warn('[stage-11] Qdrant memories_cold dropped (Sub-task B) — skipping migration tests');
    return;
  }
  pool = new Pool({ user: c.user, database: c.database, password: c.password, host: c.host, port: c.port, max: 2 });
});

afterAll(async () => { if (pool) await pool.end(); });

describe('Stage #11 — migration idempotency (REQ-S5-002)', () => {
  it('migration runs cleanly and is idempotent', async () => {
    if (!stackOnline || !qdrantSourcePresent) return;
    const r1 = await runCollection('memories_cold', { pool: pool!, writeTracker: false });
    expect(r1.errored).toBe(0);
    expect(r1.inserted + r1.skipped).toBe(r1.scrolled);
    const r2 = await runCollection('memories_cold', { pool: pool!, writeTracker: false });
    expect(r2.errored).toBe(0);
    expect(r2.inserted).toBe(0);
    expect(r2.skipped).toBe(r2.scrolled);
  }, 60_000);

  it('migration_tracker row written for non-dry run', async () => {
    if (!stackOnline || !qdrantSourcePresent) return;
    const before = await pool!.query("SELECT COUNT(*)::int AS c FROM memory.migration_tracker WHERE stage='#11' AND collection='memories_cold' AND dry_run=false");
    await runCollection('memories_cold', { pool: pool! });
    const after = await pool!.query("SELECT COUNT(*)::int AS c FROM memory.migration_tracker WHERE stage='#11' AND collection='memories_cold' AND dry_run=false");
    expect(after.rows[0].c).toBe((before.rows[0].c as number) + 1);
  }, 60_000);

  it('migrated cold rows have hot columns populated', async () => {
    if (!stackOnline || !qdrantSourcePresent) return;
    const r = await pool!.query(
      `SELECT content, type, tags, project, sensitivity, payload
       FROM memory.memories_cold
       WHERE migrated_at IS NOT NULL
       LIMIT 1`
    );
    if (r.rowCount === 0) return;
    const row = r.rows[0];
    const p = row.payload as Record<string, unknown>;
    if (typeof p.content === 'string') expect(row.content).toBe(p.content);
    if (typeof p.type === 'string') expect(row.type).toBe(p.type);
    if (typeof p.project === 'string') expect(row.project).toBe(p.project);
    if (Array.isArray(p.tags)) expect(row.tags).toEqual(p.tags);
  });
});
