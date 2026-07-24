import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { __closePoolForTests, mirrorMemoryCold, setPoolForTests } from '../../../src/postgres-cold.js';
import { exportPgEnvToProcess, pgEnv, tcpProbe } from './_helpers.js';

let stackOnline = false;
const ID = '00000000-0000-0000-0000-00000011d001';
const TEST_PROJECT = '__s11_dw_test__';

beforeAll(async () => {
  exportPgEnvToProcess();
  const c = pgEnv();
  stackOnline = await tcpProbe(c.host, c.port, 1500);
});

afterAll(async () => {
  if (stackOnline) {
    const c = pgEnv();
    const p = new Pool({ user: c.user, database: c.database, password: c.password, host: c.host, port: c.port, max: 1 });
    try { await p.query(`DELETE FROM memory.memories_cold WHERE qdrant_id = $1`, [ID]); } finally { await p.end(); }
    await __closePoolForTests();
  }
});

afterEach(() => {
  delete process.env.STAGE_11_DUAL_WRITE;
  setPoolForTests(null);
});

describe('Stage #11 — STAGE_11_DUAL_WRITE flag (REQ-S5-004)', () => {
  it('mirrorMemoryCold is no-op when flag unset', async () => {
    if (!stackOnline) return;
    delete process.env.STAGE_11_DUAL_WRITE;
    const c = pgEnv();
    const p = new Pool({ user: c.user, database: c.database, password: c.password, host: c.host, port: c.port, max: 1 });
    try {
      await mirrorMemoryCold(ID, { content: 'no-op test', project: TEST_PROJECT });
      const r = await p.query(`SELECT 1 FROM memory.memories_cold WHERE qdrant_id = $1`, [ID]);
      expect(r.rowCount).toBe(0);
    } finally {
      await p.end();
    }
  });

  it('mirrorMemoryCold inserts when flag set', async () => {
    if (!stackOnline) return;
    process.env.STAGE_11_DUAL_WRITE = 'true';
    await mirrorMemoryCold(ID, {
      content: 'dual-write test content',
      type: 'context',
      tags: ['stage11', 'test'],
      project: TEST_PROJECT,
      sensitivity: 'internal',
      created_at: new Date().toISOString(),
    });
    const c = pgEnv();
    const p = new Pool({ user: c.user, database: c.database, password: c.password, host: c.host, port: c.port, max: 1 });
    try {
      const r = await p.query(`SELECT content, type, tags FROM memory.memories_cold WHERE qdrant_id = $1`, [ID]);
      expect(r.rowCount).toBe(1);
      expect(r.rows[0].content).toBe('dual-write test content');
      expect(r.rows[0].tags).toEqual(['stage11', 'test']);
    } finally {
      await p.end();
    }
  });

  it('does not throw when pool is poisoned (C-S11-E)', async () => {
    if (!stackOnline) return;
    process.env.STAGE_11_DUAL_WRITE = 'true';
    class Poisoned {
      async connect(): Promise<never> { throw new Error('poisoned'); }
      on(): this { return this; }
      end(): Promise<void> { return Promise.resolve(); }
    }
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      setPoolForTests(new Poisoned() as unknown as Pool);
      await expect(
        mirrorMemoryCold('22222222-2222-2222-2222-000000000111', { content: 'x' })
      ).resolves.toBeUndefined();
    } finally {
      stderr.mockRestore();
    }
  });
});
