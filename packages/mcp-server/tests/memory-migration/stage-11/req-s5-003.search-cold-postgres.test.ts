import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { __closePoolForTests, searchColdPostgres, setPoolForTests } from '../../../src/postgres-cold.js';
import { exportPgEnvToProcess, pgEnv, tcpProbe } from './_helpers.js';

let stackOnline = false;
const PROJECT_A = '__s11_project_a__';
const PROJECT_B = '__s11_project_b__';
const ID_A = '00000000-0000-0000-0000-00000011aa01';
const ID_B = '00000000-0000-0000-0000-00000011bb01';
const ID_GLOBAL = '00000000-0000-0000-0000-00000011cc01';

beforeAll(async () => {
  exportPgEnvToProcess();
  const c = pgEnv();
  stackOnline = await tcpProbe(c.host, c.port, 1500);
  if (!stackOnline) return;
  // Seed test rows
  const p = new Pool({ user: c.user, database: c.database, password: c.password, host: c.host, port: c.port, max: 1 });
  try {
    for (const [id, project, content] of [
      [ID_A, PROJECT_A, 'Stage 11 search test project A about elephants'],
      [ID_B, PROJECT_B, 'Stage 11 search test project B about elephants'],
      [ID_GLOBAL, 'global', 'Stage 11 search test global about elephants'],
    ] as Array<[string, string, string]>) {
      await p.query(
        `INSERT INTO memory.memories_cold (id, qdrant_id, content, project, payload, last_accessed_at, access_count)
         VALUES ($1::uuid, $1::text, $2, $3, $4::jsonb, now(), 0)
         ON CONFLICT (qdrant_id) DO UPDATE SET content=EXCLUDED.content, project=EXCLUDED.project`,
        [id, content, project, JSON.stringify({ project, content, type: 'context' })]
      );
    }
  } finally {
    await p.end();
  }
});

afterAll(async () => {
  if (stackOnline) {
    const c = pgEnv();
    const p = new Pool({ user: c.user, database: c.database, password: c.password, host: c.host, port: c.port, max: 1 });
    try {
      await p.query(`DELETE FROM memory.memories_cold WHERE qdrant_id IN ($1, $2, $3)`, [ID_A, ID_B, ID_GLOBAL]);
    } finally {
      await p.end();
    }
    await __closePoolForTests();
  }
});

afterEach(() => {
  setPoolForTests(null);
});

describe('Stage #11 — searchColdPostgres (REQ-S5-003)', () => {
  it('returns matches for English query', async () => {
    if (!stackOnline) return;
    const r = await searchColdPostgres('elephants', { limit: 10, project: PROJECT_A });
    expect(r.length).toBeGreaterThan(0);
    // Project A row should be in results
    const found = r.find((x) => x.id === ID_A);
    expect(found).toBeDefined();
    expect(found!.score).toBeGreaterThan(0);
  });

  it('project filter excludes other projects (C-S11-G)', async () => {
    if (!stackOnline) return;
    const r = await searchColdPostgres('elephants', { limit: 50, project: PROJECT_A });
    const idsReturned = r.map((x) => x.id);
    expect(idsReturned).not.toContain(ID_B);
  });

  it('global project rows always included', async () => {
    if (!stackOnline) return;
    const r = await searchColdPostgres('elephants', { limit: 50, project: PROJECT_A });
    const idsReturned = r.map((x) => x.id);
    expect(idsReturned).toContain(ID_GLOBAL);
  });

  it('include_all_projects=true returns all', async () => {
    if (!stackOnline) return;
    const r = await searchColdPostgres('elephants', { limit: 50, includeAllProjects: true });
    const idsReturned = r.map((x) => x.id);
    expect(idsReturned).toContain(ID_A);
    expect(idsReturned).toContain(ID_B);
    expect(idsReturned).toContain(ID_GLOBAL);
  });

  it('empty query returns []', async () => {
    if (!stackOnline) return;
    const r = await searchColdPostgres('', { limit: 5 });
    expect(r).toEqual([]);
  });

  it('returns shape compatible with searchPoints (id, score, payload)', async () => {
    if (!stackOnline) return;
    const r = await searchColdPostgres('elephants', { limit: 1, project: PROJECT_A });
    expect(r.length).toBeGreaterThan(0);
    const x = r[0];
    expect(typeof x.id).toBe('string');
    expect(typeof x.score).toBe('number');
    expect(typeof x.payload).toBe('object');
  });

  it('returns [] when poisoned pool (C-S11-F)', async () => {
    if (!stackOnline) return;
    class Poisoned {
      async connect(): Promise<never> { throw new Error('poisoned'); }
      on(): this { return this; }
      end(): Promise<void> { return Promise.resolve(); }
    }
    setPoolForTests(new Poisoned() as unknown as Pool);
    const r = await searchColdPostgres('elephants', { limit: 5 });
    expect(r).toEqual([]);
  });

  it('respects limit', async () => {
    if (!stackOnline) return;
    const r = await searchColdPostgres('elephants', { limit: 1, includeAllProjects: true });
    expect(r.length).toBeLessThanOrEqual(1);
  });
});
