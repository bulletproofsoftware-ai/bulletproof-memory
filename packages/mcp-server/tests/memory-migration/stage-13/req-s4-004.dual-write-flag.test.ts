/**
 * REQ-S4-004 — STAGE_13_DUAL_WRITE flag gates mirrorEpisode + mirrorSessionTranscript.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import {
  __closePoolForTests,
  __resetStatsForTests,
  mirrorEpisode,
  mirrorSessionTranscript,
  mirrorStats,
  setPoolForTests,
} from '../../../src/postgres-mirror.js';
import { exportPgEnvToProcess, pgEnv, tcpProbe } from './_helpers.js';

let stackOnline = false;
const TEST_PROJECT = '__stage13_test__';

const ID_EPISODE_1 = '11111111-1111-1111-1111-000000000001';
const ID_EPISODE_2 = '11111111-1111-1111-1111-000000000002';
const ID_TRANS_1 = '11111111-1111-1111-1111-000000000101';

beforeAll(async () => {
  exportPgEnvToProcess();
  const c = pgEnv();
  stackOnline = await tcpProbe(c.host, c.port, 1500);
});

afterAll(async () => {
  if (stackOnline) {
    // clean up test rows
    const c = pgEnv();
    const p = new Pool({ user: c.user, database: c.database, password: c.password, host: c.host, port: c.port, max: 1 });
    try {
      await p.query(`DELETE FROM memory.episodes WHERE project = $1 OR qdrant_id IN ($2,$3)`, [TEST_PROJECT, ID_EPISODE_1, ID_EPISODE_2]);
      await p.query(`DELETE FROM memory.session_transcripts WHERE project = $1 OR qdrant_id = $2`, [TEST_PROJECT, ID_TRANS_1]);
    } finally {
      await p.end();
    }
    await __closePoolForTests();
  }
});

beforeEach(() => {
  __resetStatsForTests();
});

afterEach(() => {
  delete process.env.STAGE_13_DUAL_WRITE;
});

describe('Stage #13 — STAGE_13_DUAL_WRITE flag (REQ-S4-004)', () => {
  it('mirrorEpisode is no-op when STAGE_13_DUAL_WRITE unset', async () => {
    if (!stackOnline) return;
    delete process.env.STAGE_13_DUAL_WRITE;
    await mirrorEpisode(ID_EPISODE_1, { task: 't1', project: TEST_PROJECT });
    expect(mirrorStats.attempts).toBe(0);
    expect(mirrorStats.success).toBe(0);
  });

  it('mirrorEpisode is no-op when STAGE_13_DUAL_WRITE=false', async () => {
    if (!stackOnline) return;
    process.env.STAGE_13_DUAL_WRITE = 'false';
    await mirrorEpisode(ID_EPISODE_1, { task: 't1', project: TEST_PROJECT });
    expect(mirrorStats.attempts).toBe(0);
  });

  it('mirrorSessionTranscript is no-op when flag unset', async () => {
    if (!stackOnline) return;
    delete process.env.STAGE_13_DUAL_WRITE;
    await mirrorSessionTranscript(ID_TRANS_1, { session_id: 's', project: TEST_PROJECT, transcript: 'hello' });
    expect(mirrorStats.attempts).toBe(0);
  });

  it('mirrorEpisode inserts when STAGE_13_DUAL_WRITE=true', async () => {
    if (!stackOnline) return;
    process.env.STAGE_13_DUAL_WRITE = 'true';
    await mirrorEpisode(ID_EPISODE_1, {
      task: 'test episode',
      project: TEST_PROJECT,
      status: 'completed',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      sensitivity: 'internal',
      agents_invoked: ['a', 'b'],
      tools_used: ['Read'],
    });
    expect(mirrorStats.attempts).toBe(1);
    expect(mirrorStats.success).toBe(1);
    expect(mirrorStats.failures).toBe(0);

    const c = pgEnv();
    const p = new Pool({ user: c.user, database: c.database, password: c.password, host: c.host, port: c.port, max: 1 });
    try {
      const r = await p.query(
        `SELECT task, project, status, agents_invoked, tools_used
         FROM memory.episodes WHERE qdrant_id = $1`,
        [ID_EPISODE_1]
      );
      expect(r.rowCount).toBe(1);
      expect(r.rows[0].project).toBe(TEST_PROJECT);
      expect(r.rows[0].agents_invoked).toEqual(['a', 'b']);
    } finally {
      await p.end();
    }
  });

  it('second mirrorEpisode for same id is ON CONFLICT DO NOTHING', async () => {
    if (!stackOnline) return;
    process.env.STAGE_13_DUAL_WRITE = 'true';
    await mirrorEpisode(ID_EPISODE_2, { task: 'first write', project: TEST_PROJECT });
    await mirrorEpisode(ID_EPISODE_2, { task: 'second write (ignored)', project: TEST_PROJECT });

    const c = pgEnv();
    const p = new Pool({ user: c.user, database: c.database, password: c.password, host: c.host, port: c.port, max: 1 });
    try {
      const r = await p.query(
        `SELECT task FROM memory.episodes WHERE qdrant_id = $1`,
        [ID_EPISODE_2]
      );
      expect(r.rowCount).toBe(1);
      expect(r.rows[0].task).toBe('first write');
    } finally {
      await p.end();
    }
  });

  it('mirrorSessionTranscript inserts when STAGE_13_DUAL_WRITE=true', async () => {
    if (!stackOnline) return;
    process.env.STAGE_13_DUAL_WRITE = 'true';
    await mirrorSessionTranscript(ID_TRANS_1, {
      session_id: 's-test',
      project: TEST_PROJECT,
      transcript: 'a small transcript with searchable words like badger',
      message_count: 4,
      user_message_count: 2,
      has_corrections: false,
      has_decisions: true,
      extraction_tier: 'standard',
      created_at: new Date().toISOString(),
    });
    expect(mirrorStats.byCollection['session_transcripts']?.success).toBe(1);

    const c = pgEnv();
    const p = new Pool({ user: c.user, database: c.database, password: c.password, host: c.host, port: c.port, max: 1 });
    try {
      const r = await p.query(
        `SELECT content, has_decisions, content_tsv @@ to_tsquery('english','badger') AS found
         FROM memory.session_transcripts WHERE qdrant_id = $1`,
        [ID_TRANS_1]
      );
      expect(r.rowCount).toBe(1);
      expect(r.rows[0].has_decisions).toBe(true);
      expect(r.rows[0].found).toBe(true);
    } finally {
      await p.end();
    }
  });

  it('STAGE_8_DUAL_WRITE independent from STAGE_13_DUAL_WRITE', async () => {
    if (!stackOnline) return;
    // Stage 8 on, Stage 13 off → mirrorEpisode no-op.
    process.env.STAGE_8_DUAL_WRITE = 'true';
    delete process.env.STAGE_13_DUAL_WRITE;
    try {
      await mirrorEpisode('99999999-9999-9999-9999-000000000999', { task: 'should not write', project: TEST_PROJECT });
      expect(mirrorStats.attempts).toBe(0);
    } finally {
      delete process.env.STAGE_8_DUAL_WRITE;
    }
  });

  it('byCollection stats track episodes namespace', async () => {
    if (!stackOnline) return;
    process.env.STAGE_13_DUAL_WRITE = 'true';
    await mirrorEpisode('11111111-1111-1111-1111-000000000fff', { task: 'a', project: TEST_PROJECT });
    expect(mirrorStats.byCollection['episodes']).toBeDefined();
    expect(mirrorStats.byCollection['episodes']!.attempts).toBeGreaterThanOrEqual(1);

    // cleanup
    const c = pgEnv();
    const p = new Pool({ user: c.user, database: c.database, password: c.password, host: c.host, port: c.port, max: 1 });
    try {
      await p.query(`DELETE FROM memory.episodes WHERE qdrant_id = $1`, ['11111111-1111-1111-1111-000000000fff']);
    } finally {
      await p.end();
    }
    void setPoolForTests; // referenced so import is preserved
  });
});
