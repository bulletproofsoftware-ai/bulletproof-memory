/**
 * CISO C-S8-D — migration scripts must NEVER write to Qdrant.
 *
 * Static grep across scripts/migrations/stage-8/**.ts asserting no
 * qdrantRequest("PUT", ...) or qdrantRequest("POST", ...points...) appears.
 *
 * No container required.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const MIGRATIONS_DIR = join(REPO_ROOT, 'scripts/migrations/stage-8');

function listTs(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) listTs(p, acc);
    else if (entry.name.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

const PUT_RE = /qdrantRequest\s*\(\s*["']PUT["']/;
const POST_POINTS_RE = /qdrantRequest\s*\(\s*["']POST["'][^)]*points/;

describe('Stage #8 — CISO C-S8-D no Qdrant write from migration scripts', () => {
  it('migration scripts contain zero PUT qdrantRequest calls', () => {
    const files = listTs(MIGRATIONS_DIR);
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      if (PUT_RE.test(src)) offenders.push(f.slice(REPO_ROOT.length + 1));
    }
    expect(offenders).toEqual([]);
  });

  it('migration scripts contain zero POST to /points endpoints', () => {
    const files = listTs(MIGRATIONS_DIR);
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      if (POST_POINTS_RE.test(src)) offenders.push(f.slice(REPO_ROOT.length + 1));
    }
    expect(offenders).toEqual([]);
  });
});
