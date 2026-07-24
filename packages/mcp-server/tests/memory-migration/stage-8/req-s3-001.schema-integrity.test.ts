/**
 * REQ-S3-001 — DDL correctness for the 12 operational tables.
 *
 * Skip-gates on 127.0.0.1:5438 unreachable. Re-applies migrations/001 (idempotent)
 * via the pg.Client multi-statement query path, then introspects pg_catalog +
 * information_schema to assert every expected table, column, constraint, and
 * index shape.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Client } from 'pg';
import { tcpProbe, pgEnv, STAGE_8_TABLES } from './_helpers.js';

const MIGRATIONS_SQL = (process.env.MEMPG_MIGRATIONS_DIR ? join(process.env.MEMPG_MIGRATIONS_DIR, '001_operational_schema.sql') : join(homedir(), '.bulletproof-memory/migrations/001_operational_schema.sql'));

const COMMON_COLUMNS = ['id', 'qdrant_id', 'payload', 'migrated_at', 'created_at'];

describe('Stage #8 — REQ-S3-001 schema integrity', () => {
  let client: Client | null = null;
  let reachable = false;

  beforeAll(async () => {
    reachable = await tcpProbe('127.0.0.1', 5438, 2000);
    if (!reachable) {
      console.warn('[stage-8] claude-memory-postgres unreachable — skipping schema-integrity suite');
      return;
    }
    const c = pgEnv();
    client = new Client(c);
    await client.connect();
    // Apply DDL idempotently
    const ddl = readFileSync(MIGRATIONS_SQL, 'utf8');
    await client.query(ddl);
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  for (const table of STAGE_8_TABLES) {
    it(`operational.${table} exists with expected base columns`, async () => {
      if (!reachable) return;
      const r = await client!.query<{ column_name: string; data_type: string; is_nullable: string }>(
        `SELECT column_name, data_type, is_nullable
           FROM information_schema.columns
          WHERE table_schema = 'operational' AND table_name = $1`,
        [table]
      );
      const present = new Set(r.rows.map((row) => row.column_name));
      for (const col of COMMON_COLUMNS) {
        expect(present.has(col), `column ${col} missing in operational.${table}`).toBe(true);
      }
      // qdrant_id must be NOT NULL
      const qid = r.rows.find((row) => row.column_name === 'qdrant_id');
      expect(qid?.is_nullable).toBe('NO');
      // payload must be jsonb
      const payload = r.rows.find((row) => row.column_name === 'payload');
      expect(payload?.data_type).toBe('jsonb');
    });

    it(`operational.${table} has UNIQUE constraint on qdrant_id`, async () => {
      if (!reachable) return;
      const r = await client!.query<{ con_def: string }>(
        `SELECT pg_get_constraintdef(c.oid) AS con_def
           FROM pg_constraint c
           JOIN pg_class t ON c.conrelid = t.oid
           JOIN pg_namespace n ON t.relnamespace = n.oid
          WHERE n.nspname = 'operational' AND t.relname = $1 AND c.contype = 'u'`,
        [table]
      );
      const hasQdrantUnique = r.rows.some((row) => row.con_def.includes('(qdrant_id)'));
      expect(hasQdrantUnique, `operational.${table} missing UNIQUE(qdrant_id)`).toBe(true);
    });

    it(`operational.${table} has at least one btree index and one GIN(payload) index`, async () => {
      if (!reachable) return;
      const r = await client!.query<{ indexdef: string }>(
        `SELECT indexdef FROM pg_indexes WHERE schemaname='operational' AND tablename = $1`,
        [table]
      );
      const defs = r.rows.map((row) => row.indexdef);
      const hasBtree = defs.some((d) => d.includes('USING btree'));
      const hasGinPayload = defs.some((d) => d.includes('USING gin') && d.includes('payload'));
      expect(hasBtree, `${table} missing btree index`).toBe(true);
      expect(hasGinPayload, `${table} missing GIN(payload) index`).toBe(true);
    });
  }
});
