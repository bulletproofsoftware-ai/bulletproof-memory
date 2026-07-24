/**
 * CISO C-S8-A — independent static-analysis guard against SQL injection
 * via template-string interpolation in .query(...) calls.
 *
 * Allowlist: ${IDENTIFIER} only where IDENTIFIER matches /^[A-Z_][A-Z0-9_]*$/
 * (i.e., uppercase compile-time constants like TABLE, SCHEMA).
 *
 * Runs everywhere; no container required.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');

interface Offender { file: string; line: number; snippet: string; }

const ALLOWED_IDENT = /^[A-Z_][A-Z0-9_]*$/;

function scanForInterpolation(file: string, src: string): Offender[] {
  const offenders: Offender[] = [];
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^.*\/\/.*$/gm, (m) => m.replace(/[^\n]/g, ' '));

  const re = /\.query\s*\(\s*`([^`]*)`/g;
  let m;
  while ((m = re.exec(stripped)) !== null) {
    const tpl = m[1];
    const exprRe = /\$\{([^}]+)\}/g;
    let em;
    while ((em = exprRe.exec(tpl)) !== null) {
      const expr = em[1].trim();
      if (ALLOWED_IDENT.test(expr)) continue;
      const lineNum = src.slice(0, m.index + tpl.indexOf(em[0])).split('\n').length;
      offenders.push({ file, line: lineNum, snippet: em[0] });
    }
  }
  return offenders;
}

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walkTsFiles(p, acc);
    else if (entry.name.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

const TARGETS: string[] = [
  join(REPO_ROOT, 'src/postgres-mirror.ts'),
  ...walkTsFiles(join(REPO_ROOT, 'scripts/migrations/stage-8')),
];

describe('Stage #8 — CISO C-S8-A SQL injection static guard', () => {
  for (const file of TARGETS) {
    const rel = file.slice(REPO_ROOT.length + 1);
    it(`${rel} uses only $N parameters (no value interpolation in .query() templates)`, () => {
      const src = readFileSync(file, 'utf8');
      const offenders = scanForInterpolation(rel, src);
      if (offenders.length > 0) {
        const detail = offenders.map((o) => `  ${o.file}:${o.line}  ${o.snippet}`).join('\n');
        throw new Error(`Found unsafe interpolation in .query() templates:\n${detail}`);
      }
      expect(offenders.length).toBe(0);
    });
  }
});
