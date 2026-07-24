/**
 * REQ-S3-003 — dual-write flag semantics.
 *
 * - STAGE_8_DUAL_WRITE=true → mirror writes land in operational.<table> with migrated_at IS NULL
 * - STAGE_8_DUAL_WRITE unset → mirror is a no-op (zero rows)
 * - Second call with same qdrant_id → ON CONFLICT DO NOTHING preserves the first row
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client } from 'pg';
import { tcpProbe, pgEnv, exportPgEnvToProcess } from './_helpers.js';
import { randomUUID } from 'node:crypto';

describe('Stage #8 — REQ-S3-003 dual-write flag', () => {
  let client: Client | null = null;
  let reachable = false;

  beforeAll(async () => {
    reachable = await tcpProbe('127.0.0.1', 5438, 2000);
    if (!reachable) {
      console.warn('[stage-8] PG unreachable — skipping dual-write-flag suite');
      return;
    }
    exportPgEnvToProcess();
    const c = pgEnv();
    client = new Client(c);
    await client.connect();
  });

  beforeEach(async () => {
    if (!reachable || !client) return;
    // Test isolation: scrub any prior __stage8_test__ rows
    await client.query(`DELETE FROM operational.audit_log WHERE project = '__stage8_test__'`);
  });

  afterAll(async () => {
    if (client) await client.end();
    // Reset pool inside the mirror so a subsequent test file gets a fresh pool
    const mod = await import('../../../src/postgres-mirror.js');
    await mod.__closePoolForTests();
  });

  it('STAGE_8_DUAL_WRITE=true triggers mirror insert', async () => {
    if (!reachable) return;
    process.env.STAGE_8_DUAL_WRITE = 'true';
    const mod = await import('../../../src/postgres-mirror.js');
    mod.__resetStatsForTests();
    const id = randomUUID();
    await mod.mirrorAuditLog(id, {
      action: 'TEST_DUAL_WRITE',
      timestamp: new Date().toISOString(),
      session_id: 'sess_test',
      project: '__stage8_test__',
      sensitivity: 'internal',
      details: { note: 'hello' },
    });
    const r = await client!.query<{ qdrant_id: string; action: string; migrated_at: string | null }>(
      `SELECT qdrant_id, action, migrated_at FROM operational.audit_log WHERE qdrant_id = $1`,
      [id]
    );
    expect(r.rowCount).toBe(1);
    expect(r.rows[0].action).toBe('TEST_DUAL_WRITE');
    expect(r.rows[0].migrated_at).toBeNull();
    expect(mod.mirrorStats.success).toBeGreaterThan(0);
  });

  it('STAGE_8_DUAL_WRITE unset is a no-op', async () => {
    if (!reachable) return;
    delete process.env.STAGE_8_DUAL_WRITE;
    const mod = await import('../../../src/postgres-mirror.js');
    mod.__resetStatsForTests();
    const id = randomUUID();
    await mod.mirrorAuditLog(id, {
      action: 'TEST_NOOP',
      timestamp: new Date().toISOString(),
      project: '__stage8_test__',
    });
    const r = await client!.query(`SELECT 1 FROM operational.audit_log WHERE qdrant_id = $1`, [id]);
    expect(r.rowCount).toBe(0);
    expect(mod.mirrorStats.attempts).toBe(0);
  });

  it('ON CONFLICT (qdrant_id) DO NOTHING on second call', async () => {
    if (!reachable) return;
    process.env.STAGE_8_DUAL_WRITE = 'true';
    const mod = await import('../../../src/postgres-mirror.js');
    const id = randomUUID();
    await mod.mirrorAuditLog(id, {
      action: 'TEST_CONFLICT_FIRST',
      timestamp: new Date().toISOString(),
      project: '__stage8_test__',
    });
    await mod.mirrorAuditLog(id, {
      action: 'TEST_CONFLICT_SECOND',
      timestamp: new Date().toISOString(),
      project: '__stage8_test__',
    });
    const r = await client!.query<{ action: string }>(
      `SELECT action FROM operational.audit_log WHERE qdrant_id = $1`,
      [id]
    );
    expect(r.rowCount).toBe(1);
    expect(r.rows[0].action).toBe('TEST_CONFLICT_FIRST');
  });
});
