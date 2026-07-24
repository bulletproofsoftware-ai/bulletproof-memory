/**
 * CISO C-S13-D — Migration scripts must NOT write to Qdrant.
 * Grep the scripts/migrations/stage-13 tree for DELETE/PUT/PATCH HTTP method strings.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir)) {
    const p = join(dir, ent);
    if (statSync(p).isDirectory()) {
      out.push(...walk(p));
    } else if (p.endsWith('.ts')) {
      out.push(p);
    }
  }
  return out;
}

describe('Stage #13 — migration scripts must not write to Qdrant (C-S13-D)', () => {
  it('no DELETE/PUT/PATCH HTTP methods in scripts/migrations/stage-13', () => {
    const root = join(process.cwd(), 'scripts/migrations/stage-13');
    const files = walk(root);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      // Match method assignment patterns like method: "DELETE" or method = 'PUT'.
      // Stage #13 lib imports from Stage #8 (qdrant.ts), which we audit separately.
      // This test only looks at NEW Stage #13 code.
      expect(text).not.toMatch(/method\s*[:=]\s*["']DELETE["']/);
      expect(text).not.toMatch(/method\s*[:=]\s*["']PUT["']/);
      expect(text).not.toMatch(/method\s*[:=]\s*["']PATCH["']/);
    }
  });
});
