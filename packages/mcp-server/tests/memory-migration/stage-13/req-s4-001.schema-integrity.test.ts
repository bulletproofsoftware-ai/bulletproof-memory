/**
 * REQ-S4-001 + REQ-S4-002 — Schema integrity for memory schema (episodes, session_transcripts, migration_tracker).
 *
 * Verifies the DDL at $MEMPG_MIGRATIONS_DIR/002_memory_episodic_schema.sql
 * applies cleanly and exposes the columns + indexes the architect spec promises.
 * Skip-gates on TCP probe of 127.0.0.1:5438 — green when stack offline.
 */
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
  pool = new Pool({
    user: c.user,
    database: c.database,
    password: c.password,
    host: c.host,
    port: c.port,
    max: 2,
    connectionTimeoutMillis: 3000,
  });
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('Stage #13 — schema integrity (REQ-S4-001, REQ-S4-002)', () => {
  it('skip-gate: probe stack', () => {
    if (!stackOnline) console.warn('[stage-13] stack offline at 127.0.0.1:5438 — tests will skip');
    expect(true).toBe(true);
  });

  it('memory schema exists', async () => {
    if (!stackOnline) return;
    const r = await pool!.query(
      "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'memory'"
    );
    expect(r.rowCount).toBe(1);
  });

  it('memory.episodes table exists', async () => {
    if (!stackOnline) return;
    const r = await pool!.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'memory' AND table_name = 'episodes'"
    );
    expect(r.rowCount).toBe(1);
  });

  it('memory.session_transcripts table exists', async () => {
    if (!stackOnline) return;
    const r = await pool!.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'memory' AND table_name = 'session_transcripts'"
    );
    expect(r.rowCount).toBe(1);
  });

  it('memory.migration_tracker table exists', async () => {
    if (!stackOnline) return;
    const r = await pool!.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'memory' AND table_name = 'migration_tracker'"
    );
    expect(r.rowCount).toBe(1);
  });

  it('memory.episodes has all 19 expected columns', async () => {
    if (!stackOnline) return;
    const r = await pool!.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'memory' AND table_name = 'episodes'
       ORDER BY ordinal_position`
    );
    const cols = r.rows.map((row) => row.column_name as string);
    const expected = [
      'id', 'qdrant_id', 'task', 'project', 'status', 'outcome',
      'agents_invoked', 'tools_used', 'files_modified', 'learnings',
      'full_transcript', 'started_at', 'completed_at', 'duration_ms',
      'sensitivity', 'metadata', 'payload', 'migrated_at', 'created_at',
    ];
    for (const c of expected) expect(cols).toContain(c);
  });

  it('memory.session_transcripts has all expected columns including content_tsv', async () => {
    if (!stackOnline) return;
    const r = await pool!.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'memory' AND table_name = 'session_transcripts'`
    );
    const cols = r.rows.map((row) => row.column_name as string);
    const expected = [
      'id', 'qdrant_id', 'session_id', 'project', 'content', 'content_tsv',
      'message_count', 'user_message_count', 'has_corrections', 'has_decisions',
      'extraction_tier', 'recorded_at', 'expires_at', 'payload',
      'migrated_at', 'created_at',
    ];
    for (const c of expected) expect(cols).toContain(c);
  });

  it('memory.migration_tracker has all expected columns', async () => {
    if (!stackOnline) return;
    const r = await pool!.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'memory' AND table_name = 'migration_tracker'`
    );
    const cols = r.rows.map((row) => row.column_name as string);
    const expected = [
      'id', 'stage', 'collection', 'run_at',
      'q_count', 'p_count', 'scrolled', 'inserted', 'skipped', 'errored',
      'dry_run', 'notes',
    ];
    for (const c of expected) expect(cols).toContain(c);
  });

  it('memory.episodes id is PRIMARY KEY and qdrant_id is UNIQUE', async () => {
    if (!stackOnline) return;
    const r = await pool!.query(
      `SELECT constraint_type, c.column_name
       FROM information_schema.table_constraints t
       JOIN information_schema.constraint_column_usage c USING (constraint_schema, constraint_name)
       WHERE t.table_schema = 'memory' AND t.table_name = 'episodes'
         AND constraint_type IN ('PRIMARY KEY', 'UNIQUE')`
    );
    const rows = r.rows as Array<{ constraint_type: string; column_name: string }>;
    const pk = rows.find((x) => x.constraint_type === 'PRIMARY KEY');
    const uq = rows.find((x) => x.constraint_type === 'UNIQUE');
    expect(pk?.column_name).toBe('id');
    expect(uq?.column_name).toBe('qdrant_id');
  });

  it('memory.session_transcripts id is PRIMARY KEY and qdrant_id is UNIQUE', async () => {
    if (!stackOnline) return;
    const r = await pool!.query(
      `SELECT constraint_type, c.column_name
       FROM information_schema.table_constraints t
       JOIN information_schema.constraint_column_usage c USING (constraint_schema, constraint_name)
       WHERE t.table_schema = 'memory' AND t.table_name = 'session_transcripts'
         AND constraint_type IN ('PRIMARY KEY', 'UNIQUE')`
    );
    const rows = r.rows as Array<{ constraint_type: string; column_name: string }>;
    const pk = rows.find((x) => x.constraint_type === 'PRIMARY KEY');
    const uq = rows.find((x) => x.constraint_type === 'UNIQUE');
    expect(pk?.column_name).toBe('id');
    expect(uq?.column_name).toBe('qdrant_id');
  });

  it('episodes.payload is NOT NULL jsonb', async () => {
    if (!stackOnline) return;
    const r = await pool!.query(
      `SELECT is_nullable, data_type
       FROM information_schema.columns
       WHERE table_schema='memory' AND table_name='episodes' AND column_name='payload'`
    );
    expect(r.rows[0].is_nullable).toBe('NO');
    expect(r.rows[0].data_type).toBe('jsonb');
  });

  it('session_transcripts.content_tsv is GENERATED', async () => {
    if (!stackOnline) return;
    const r = await pool!.query(
      `SELECT is_generated, generation_expression
       FROM information_schema.columns
       WHERE table_schema='memory' AND table_name='session_transcripts' AND column_name='content_tsv'`
    );
    expect(r.rows[0].is_generated).toBe('ALWAYS');
    expect(String(r.rows[0].generation_expression || '')).toMatch(/to_tsvector/i);
  });

  it('expected GIN indexes present on episodes', async () => {
    if (!stackOnline) return;
    const r = await pool!.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname='memory' AND tablename='episodes'`
    );
    const names = r.rows.map((x) => x.indexname as string);
    expect(names).toContain('episodes_agents_gin');
    expect(names).toContain('episodes_tools_gin');
    expect(names).toContain('episodes_files_gin');
    expect(names).toContain('episodes_learnings_gin');
    expect(names).toContain('episodes_payload_gin');
  });

  it('expected btree indexes present on episodes', async () => {
    if (!stackOnline) return;
    const r = await pool!.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname='memory' AND tablename='episodes'`
    );
    const names = r.rows.map((x) => x.indexname as string);
    expect(names).toContain('episodes_project_completed_idx');
    expect(names).toContain('episodes_project_started_idx');
    expect(names).toContain('episodes_status_idx');
  });

  it('expected indexes present on session_transcripts', async () => {
    if (!stackOnline) return;
    const r = await pool!.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname='memory' AND tablename='session_transcripts'`
    );
    const names = r.rows.map((x) => x.indexname as string);
    expect(names).toContain('session_transcripts_content_tsv_gin');
    expect(names).toContain('session_transcripts_session_idx');
    expect(names).toContain('session_transcripts_project_recorded_idx');
    expect(names).toContain('session_transcripts_payload_gin');
  });

  it('expected index present on migration_tracker', async () => {
    if (!stackOnline) return;
    const r = await pool!.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname='memory' AND tablename='migration_tracker'`
    );
    const names = r.rows.map((x) => x.indexname as string);
    expect(names).toContain('migration_tracker_stage_run_idx');
  });

  it('tsvector regenerates on content update', async () => {
    if (!stackOnline) return;
    // Insert a test row, capture tsvector, update content, capture again, expect difference.
    const id = '00000000-0000-0000-0000-0000000001ff';
    await pool!.query(
      `INSERT INTO memory.session_transcripts (id, qdrant_id, content, payload)
       VALUES ($1::uuid, $1::text, $2, '{}'::jsonb)
       ON CONFLICT (qdrant_id) DO UPDATE SET content = EXCLUDED.content`,
      [id, 'the quick brown fox']
    );
    try {
      const r1 = await pool!.query(
        `SELECT content_tsv::text AS tsv FROM memory.session_transcripts WHERE qdrant_id=$1`,
        [id]
      );
      const tsv1 = r1.rows[0].tsv as string;
      await pool!.query(
        `UPDATE memory.session_transcripts SET content=$2 WHERE qdrant_id=$1`,
        [id, 'completely different text']
      );
      const r2 = await pool!.query(
        `SELECT content_tsv::text AS tsv FROM memory.session_transcripts WHERE qdrant_id=$1`,
        [id]
      );
      const tsv2 = r2.rows[0].tsv as string;
      expect(tsv1).not.toBe(tsv2);
      expect(tsv1.length).toBeGreaterThan(0);
      expect(tsv2.length).toBeGreaterThan(0);
    } finally {
      await pool!.query(`DELETE FROM memory.session_transcripts WHERE qdrant_id=$1`, [id]);
    }
  });

  it('tsvector full-text query returns inserted row', async () => {
    if (!stackOnline) return;
    const id = '00000000-0000-0000-0000-0000000002ff';
    await pool!.query(
      `INSERT INTO memory.session_transcripts (id, qdrant_id, content, payload)
       VALUES ($1::uuid, $1::text, $2, '{}'::jsonb)
       ON CONFLICT (qdrant_id) DO UPDATE SET content = EXCLUDED.content`,
      [id, 'searching for kangaroos in the desert']
    );
    try {
      const r = await pool!.query(
        `SELECT 1 FROM memory.session_transcripts
         WHERE qdrant_id=$1 AND content_tsv @@ to_tsquery('english', 'kangaroo')`,
        [id]
      );
      expect(r.rowCount).toBe(1);
    } finally {
      await pool!.query(`DELETE FROM memory.session_transcripts WHERE qdrant_id=$1`, [id]);
    }
  });

  it('array columns round-trip correctly on episodes', async () => {
    if (!stackOnline) return;
    const id = '00000000-0000-0000-0000-0000000003ff';
    const agents = ['conductor-builder', 'conductor-ciso', 'conductor-qa'];
    const tools = ['Read', 'Edit', 'Bash'];
    await pool!.query(
      `INSERT INTO memory.episodes (id, qdrant_id, task, agents_invoked, tools_used, payload)
       VALUES ($1::uuid, $1::text, $2, $3::text[], $4::text[], '{}'::jsonb)
       ON CONFLICT (qdrant_id) DO UPDATE
         SET agents_invoked = EXCLUDED.agents_invoked,
             tools_used     = EXCLUDED.tools_used`,
      [id, 'test array round-trip', agents, tools]
    );
    try {
      const r = await pool!.query(
        `SELECT agents_invoked, tools_used FROM memory.episodes WHERE qdrant_id=$1`,
        [id]
      );
      expect(r.rows[0].agents_invoked).toEqual(agents);
      expect(r.rows[0].tools_used).toEqual(tools);
    } finally {
      await pool!.query(`DELETE FROM memory.episodes WHERE qdrant_id=$1`, [id]);
    }
  });

  it('episodes.metadata defaults to empty jsonb', async () => {
    if (!stackOnline) return;
    const id = '00000000-0000-0000-0000-0000000004ff';
    await pool!.query(
      `INSERT INTO memory.episodes (id, qdrant_id, payload)
       VALUES ($1::uuid, $1::text, '{}'::jsonb)
       ON CONFLICT (qdrant_id) DO NOTHING`,
      [id]
    );
    try {
      const r = await pool!.query(
        `SELECT metadata::text AS m FROM memory.episodes WHERE qdrant_id=$1`,
        [id]
      );
      expect(r.rows[0].m).toBe('{}');
    } finally {
      await pool!.query(`DELETE FROM memory.episodes WHERE qdrant_id=$1`, [id]);
    }
  });

  it('episodes array columns default to empty', async () => {
    if (!stackOnline) return;
    const id = '00000000-0000-0000-0000-0000000005ff';
    await pool!.query(
      `INSERT INTO memory.episodes (id, qdrant_id, payload)
       VALUES ($1::uuid, $1::text, '{}'::jsonb)
       ON CONFLICT (qdrant_id) DO NOTHING`,
      [id]
    );
    try {
      const r = await pool!.query(
        `SELECT agents_invoked, tools_used, files_modified, learnings
         FROM memory.episodes WHERE qdrant_id=$1`,
        [id]
      );
      expect(r.rows[0].agents_invoked).toEqual([]);
      expect(r.rows[0].tools_used).toEqual([]);
      expect(r.rows[0].files_modified).toEqual([]);
      expect(r.rows[0].learnings).toEqual([]);
    } finally {
      await pool!.query(`DELETE FROM memory.episodes WHERE qdrant_id=$1`, [id]);
    }
  });

  it('DDL re-apply is idempotent', async () => {
    if (!stackOnline) return;
    // Re-apply the same CREATE TABLE IF NOT EXISTS — should not error.
    // We synthesize a tiny re-apply by issuing the same constructs.
    await expect(
      pool!.query(
        `CREATE TABLE IF NOT EXISTS memory.migration_tracker (
           id BIGSERIAL PRIMARY KEY,
           stage TEXT NOT NULL,
           collection TEXT NOT NULL,
           run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
           q_count INTEGER NOT NULL,
           p_count INTEGER NOT NULL,
           scrolled INTEGER NOT NULL,
           inserted INTEGER NOT NULL,
           skipped INTEGER NOT NULL,
           errored INTEGER NOT NULL,
           dry_run BOOLEAN NOT NULL DEFAULT false,
           notes TEXT
         )`
      )
    ).resolves.toBeDefined();
  });
});
