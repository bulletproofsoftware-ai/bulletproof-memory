import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Stage #11 — SQL injection guard (C-S11-A)', () => {
  it('postgres-cold.ts and run-collection.ts use only $N parameterization', () => {
    const files = [
      join(process.cwd(), 'src/postgres-cold.ts'),
      join(process.cwd(), 'scripts/migrations/stage-11/lib/run-collection.ts'),
    ];
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      // Find any backticked block that contains INSERT/UPDATE/DELETE and a ${...} expression
      const matches = text.match(/`[^`]*(INSERT|UPDATE|DELETE)[^`]*\$\{[^}]+\}[^`]*`/gs) || [];
      for (const m of matches) {
        // Allowed: table, cols.join(...), placeholders, schema constants
        const allowed = /\$\{(table|cols\.join\([^)]+\)|placeholders|tableName|STAGE_11_SCHEMA|collection|whereSql)[^}]*\}/g;
        const stripped = m.replace(allowed, 'OK');
        expect(stripped).not.toMatch(/\$\{[^}]+\}/);
      }
    }
  });

  it('no DELETE/PUT/PATCH to Qdrant in stage-11 scripts (C-S11-D)', () => {
    const text = readFileSync(join(process.cwd(), 'scripts/migrations/stage-11/lib/run-collection.ts'), 'utf8');
    expect(text).not.toMatch(/method\s*[:=]\s*["']DELETE["']/);
    expect(text).not.toMatch(/method\s*[:=]\s*["']PUT["']/);
    expect(text).not.toMatch(/method\s*[:=]\s*["']PATCH["']/);
  });
});
