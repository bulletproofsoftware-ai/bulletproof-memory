/**
 * CISO C-S13-A — SQL injection guard.
 * Greps the Stage #13 mirror additions and migration scripts for forbidden patterns.
 * Verifies that payloads containing SQL meta-chars are stored as data, not executed.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mirrorEpisode, __closePoolForTests, __resetStatsForTests } from '../../../src/postgres-mirror.js';
import { exportPgEnvToProcess, pgEnv, tcpProbe } from './_helpers.js';

let stackOnline = false;

beforeAll(async () => {
  exportPgEnvToProcess();
  const c = pgEnv();
  stackOnline = await tcpProbe(c.host, c.port, 1500);
});

afterAll(async () => {
  await __closePoolForTests();
});

describe('Stage #13 — SQL injection guard (C-S13-A)', () => {
  it('no string concatenation of values into Stage #13 SQL', () => {
    // Walk the Stage #13 mirror code and the run-collection runner; assert
    // that no INSERT-string is built with a template literal containing a
    // value placeholder (we only allow column-name + table-name interpolation).
    const files = [
      join(process.cwd(), 'src/postgres-mirror.ts'),
      join(process.cwd(), 'scripts/migrations/stage-13/lib/run-collection.ts'),
    ];
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      // Find any INSERT statement inside a template literal.
      // Pattern: backtick-bound segment that contains "INSERT" and a "${" expression.
      // This is a heuristic — false positive is acceptable if it makes us audit.
      // We only forbid `${var}` patterns inside INSERT segments that aren't a
      // hot column name array (cols.join(', ')) or table constants.
      const matches = text.match(/`[^`]*INSERT[^`]*\$\{[^}]+\}[^`]*`/gs) || [];
      for (const m of matches) {
        // Allowed interpolations: ${table}, ${cols.join(...)}, ${placeholders}, ${fixedPlaceholders}, ${STAGE_13_SCHEMA}.${...}
        const allowed = /\$\{(table|cols\.join\([^)]+\)|placeholders|fixedPlaceholders|STAGE_13_SCHEMA|collection|tableName)[^}]*\}/g;
        const stripped = m.replace(allowed, 'OK');
        // After stripping the allowed interpolations, NO ${...} expressions should remain.
        expect(stripped).not.toMatch(/\$\{[^}]+\}/);
      }
    }
  });

  it('mirrorEpisode stores SQL-meta chars in payload without injection', async () => {
    if (!stackOnline) return;
    process.env.STAGE_13_DUAL_WRITE = 'true';
    __resetStatsForTests();
    const ID = '33333333-3333-3333-3333-000000000001';
    const TEST_PROJECT = '__inj_test__';
    const evil = `'; DROP TABLE memory.episodes; --`;

    try {
      await mirrorEpisode(ID, {
        task: evil,
        project: TEST_PROJECT,
        status: 'completed',
        learnings: [evil],
      });
      // Table still exists, row inserted with verbatim payload.
      const c = pgEnv();
      const p = new Pool({ user: c.user, database: c.database, password: c.password, host: c.host, port: c.port, max: 1 });
      try {
        const r = await p.query(`SELECT task, learnings FROM memory.episodes WHERE qdrant_id=$1`, [ID]);
        expect(r.rowCount).toBe(1);
        expect(r.rows[0].task).toBe(evil);
        expect(r.rows[0].learnings).toEqual([evil]);
        // Table should still exist with rows
        const count = await p.query('SELECT count(*)::int AS c FROM memory.episodes');
        expect((count.rows[0].c as number)).toBeGreaterThanOrEqual(1);
        // cleanup
        await p.query(`DELETE FROM memory.episodes WHERE qdrant_id=$1`, [ID]);
      } finally {
        await p.end();
      }
    } finally {
      delete process.env.STAGE_13_DUAL_WRITE;
    }
  });
});
