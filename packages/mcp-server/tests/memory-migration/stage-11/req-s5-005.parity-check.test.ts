import { beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { exportPgEnvToProcess, pgEnv, tcpProbe, qdrantCollectionExists } from './_helpers.js';

let stackOnline = false;
let qdrantSourcePresent = false;

beforeAll(async () => {
  exportPgEnvToProcess();
  const c = pgEnv();
  stackOnline = await tcpProbe(c.host, c.port, 1500);
  qdrantSourcePresent = await qdrantCollectionExists('memories_cold');
});

function runParityCheck(): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const script = join(process.cwd(), 'scripts/migrations/stage-11/parity-check.ts');
    const child = spawn('npx', ['tsx', script], { env: { ...process.env } });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => resolve({ code: code ?? 1, stderr }));
  });
}

describe('Stage #11 — parity check (REQ-S5-005)', () => {
  it('parity-check exits 0 with overall: true', async () => {
    if (!stackOnline || !qdrantSourcePresent) return;
    const { code, stderr } = await runParityCheck();
    expect(stderr).toContain('"overall"');
    const firstBrace = stderr.indexOf('{');
    const lastBrace = stderr.lastIndexOf('}');
    expect(firstBrace).toBeGreaterThanOrEqual(0);
    const summary = JSON.parse(stderr.slice(firstBrace, lastBrace + 1));
    expect(summary.overall).toBe(true);
    expect(summary.results.length).toBe(1);
    expect(summary.results[0].collection).toBe('memories_cold');
    expect(code).toBe(0);
  }, 60_000);

  it('reports delta and within_tolerance', async () => {
    if (!stackOnline || !qdrantSourcePresent) return;
    const { stderr } = await runParityCheck();
    const firstBrace = stderr.indexOf('{');
    const lastBrace = stderr.lastIndexOf('}');
    const summary = JSON.parse(stderr.slice(firstBrace, lastBrace + 1));
    expect(summary.results[0].within_tolerance).toBe(true);
    expect(summary.results[0].delta).toBeLessThanOrEqual(2);
    expect(summary.results[0].missing.length).toBe(0);
  }, 60_000);
});
