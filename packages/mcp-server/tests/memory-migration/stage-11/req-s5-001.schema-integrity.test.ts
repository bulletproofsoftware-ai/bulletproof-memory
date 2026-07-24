import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { exportPgEnvToProcess, pgEnv, tcpProbe } from './_helpers.js';

let stackOnline = false;
let pool: Pool | null = null;

beforeAll(async () => {
  exportPgEnvToProcess();
  const c = pgEnv();
  stackOnline = await tcpProbe(c.host, c.port, 1500);
  if (!stackOnline) return;
  pool = new Pool({ user: c.user, database: c.database, password: c.password, host: c.host, port: c.port, max: 2 });
});

afterAll(async () => { if (pool) await pool.end(); });

describe('Stage #11 — schema integrity (REQ-S5-001)', () => {
  it('skip-gate', () => {
    if (!stackOnline) console.warn('[stage-11] stack offline');
    expect(true).toBe(true);
  });

  it('memory.memories_cold table exists', async () => {
    if (!stackOnline) return;
    const r = await pool!.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema='memory' AND table_name='memories_cold'"
    );
    expect(r.rowCount).toBe(1);
  });

  it('all expected columns present', async () => {
    if (!stackOnline) return;
    const r = await pool!.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='memory' AND table_name='memories_cold'"
    );
    const cols = r.rows.map((x) => x.column_name as string);
    for (const c of ['id', 'qdrant_id', 'content', 'content_tsv', 'type', 'tags', 'project', 'sensitivity', 'created_at', 'last_accessed_at', 'access_count', 'expires_at', 'source', 'payload', 'migrated_at', 'created_row_at']) {
      expect(cols).toContain(c);
    }
  });

  it('content_tsv is GENERATED', async () => {
    if (!stackOnline) return;
    const r = await pool!.query(
      `SELECT is_generated FROM information_schema.columns WHERE table_schema='memory' AND table_name='memories_cold' AND column_name='content_tsv'`
    );
    expect(r.rows[0].is_generated).toBe('ALWAYS');
  });

  it('pg_trgm extension functional', async () => {
    if (!stackOnline) return;
    const r = await pool!.query("SELECT similarity('cat', 'category') AS s");
    expect(typeof r.rows[0].s).toBe('number');
    expect(r.rows[0].s).toBeGreaterThan(0);
  });

  it('all required indexes exist', async () => {
    if (!stackOnline) return;
    const r = await pool!.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname='memory' AND tablename='memories_cold'`
    );
    const names = r.rows.map((x) => x.indexname as string);
    expect(names).toContain('memories_cold_content_tsv_gin');
    expect(names).toContain('memories_cold_content_trgm_gin');
    expect(names).toContain('memories_cold_tags_gin');
    expect(names).toContain('memories_cold_project_last_accessed_idx');
    expect(names).toContain('memories_cold_created_idx');
    expect(names).toContain('memories_cold_payload_gin');
  });

  it('tsvector regenerates on update', async () => {
    if (!stackOnline) return;
    const id = '00000000-0000-0000-0000-00000011ff01';
    try {
      await pool!.query(
        `INSERT INTO memory.memories_cold (id, qdrant_id, content, payload) VALUES ($1::uuid, $1::text, $2, '{}'::jsonb)
         ON CONFLICT (qdrant_id) DO UPDATE SET content = EXCLUDED.content`,
        [id, 'kangaroo trampoline']
      );
      const r1 = await pool!.query(`SELECT content_tsv::text AS tsv FROM memory.memories_cold WHERE qdrant_id=$1`, [id]);
      await pool!.query(`UPDATE memory.memories_cold SET content=$2 WHERE qdrant_id=$1`, [id, 'completely unrelated']);
      const r2 = await pool!.query(`SELECT content_tsv::text AS tsv FROM memory.memories_cold WHERE qdrant_id=$1`, [id]);
      expect(r1.rows[0].tsv).not.toBe(r2.rows[0].tsv);
    } finally {
      await pool!.query(`DELETE FROM memory.memories_cold WHERE qdrant_id=$1`, [id]);
    }
  });

  it('full-text query returns inserted row', async () => {
    if (!stackOnline) return;
    const id = '00000000-0000-0000-0000-00000011ff02';
    try {
      await pool!.query(
        `INSERT INTO memory.memories_cold (id, qdrant_id, content, payload) VALUES ($1::uuid, $1::text, $2, '{}'::jsonb)
         ON CONFLICT (qdrant_id) DO UPDATE SET content = EXCLUDED.content`,
        [id, 'searching for badgers in alpine meadows']
      );
      const r = await pool!.query(
        `SELECT 1 FROM memory.memories_cold WHERE qdrant_id=$1 AND content_tsv @@ websearch_to_tsquery('english', 'badger')`,
        [id]
      );
      expect(r.rowCount).toBe(1);
    } finally {
      await pool!.query(`DELETE FROM memory.memories_cold WHERE qdrant_id=$1`, [id]);
    }
  });

  it('tags array round-trip', async () => {
    if (!stackOnline) return;
    const id = '00000000-0000-0000-0000-00000011ff03';
    const tags = ['ui', 'design', 'frontend'];
    try {
      await pool!.query(
        `INSERT INTO memory.memories_cold (id, qdrant_id, tags, payload) VALUES ($1::uuid, $1::text, $2::text[], '{}'::jsonb)
         ON CONFLICT (qdrant_id) DO UPDATE SET tags = EXCLUDED.tags`,
        [id, tags]
      );
      const r = await pool!.query(`SELECT tags FROM memory.memories_cold WHERE qdrant_id=$1`, [id]);
      expect(r.rows[0].tags).toEqual(tags);
    } finally {
      await pool!.query(`DELETE FROM memory.memories_cold WHERE qdrant_id=$1`, [id]);
    }
  });

  it('production data: 1397 rows present', async () => {
    if (!stackOnline) return;
    const r = await pool!.query('SELECT COUNT(*)::int AS c FROM memory.memories_cold');
    expect(r.rows[0].c).toBeGreaterThanOrEqual(1397);
  });
});
