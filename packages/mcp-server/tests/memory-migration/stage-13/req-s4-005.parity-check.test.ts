/**
 * REQ-S4-005 — Parity check runs and returns overall: true when data is consistent.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { exportPgEnvToProcess, pgEnv, tcpProbe, qdrantCollectionExists } from './_helpers.js';

let stackOnline = false;
let qdrantSourcesPresent = false;

beforeAll(async () => {
  exportPgEnvToProcess();
  const c = pgEnv();
  stackOnline = await tcpProbe(c.host, c.port, 1500);
  const epOk = await qdrantCollectionExists('episodes');
  const stOk = await qdrantCollectionExists('session_transcripts');
  qdrantSourcesPresent = epOk && stOk;
});

afterAll(async () => {});

function runParityCheck(): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const script = join(process.cwd(), 'scripts/migrations/stage-13/parity-check.ts');
    const child = spawn('npx', ['tsx', script], {
      env: { ...process.env },
    });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => resolve({ code: code ?? 1, stderr }));
  });
}

describe('Stage #13 — parity check (REQ-S4-005)', () => {
  it('parity-check exits 0 with overall: true when data consistent', async () => {
    if (!stackOnline || !qdrantSourcesPresent) return;
    const { code, stderr } = await runParityCheck();
    // The parity-check writes JSON to stderr.
    expect(stderr).toContain('"overall"');
    // Extract the summary JSON (last non-empty line that starts with `{` and ends with `}`)
    const lines = stderr.split('\n').filter((l) => l.trim().length);
    // The summary is the JSON pretty-printed across lines. Find first { and last }
    const firstBrace = stderr.indexOf('{');
    const lastBrace = stderr.lastIndexOf('}');
    expect(firstBrace).toBeGreaterThanOrEqual(0);
    expect(lastBrace).toBeGreaterThan(firstBrace);
    const json = stderr.slice(firstBrace, lastBrace + 1);
    const summary = JSON.parse(json);
    expect(summary.overall).toBe(true);
    expect(summary.tolerance).toBe(2);
    expect(summary.sample_size).toBe(10);
    expect(Array.isArray(summary.results)).toBe(true);
    expect(summary.results.length).toBe(2);
    expect(summary.no_errors).toBe(true);
    expect(summary.all_have_pg_rows_when_qdrant_has_rows).toBe(true);
    // 0 exit code expected when overall:true
    expect(code).toBe(0);
    void lines;
  }, 60_000);

  it('parity-check covers both stage-13 collections', async () => {
    if (!stackOnline || !qdrantSourcesPresent) return;
    const { stderr } = await runParityCheck();
    expect(stderr).toContain('"collection": "episodes"');
    expect(stderr).toContain('"collection": "session_transcripts"');
  }, 60_000);

  it('parity-check reports per-collection delta and within_tolerance', async () => {
    if (!stackOnline || !qdrantSourcesPresent) return;
    const { stderr } = await runParityCheck();
    const firstBrace = stderr.indexOf('{');
    const lastBrace = stderr.lastIndexOf('}');
    const summary = JSON.parse(stderr.slice(firstBrace, lastBrace + 1));
    for (const r of summary.results as Array<{ delta: number; within_tolerance: boolean; q_count: number; p_count: number }>) {
      expect(typeof r.delta).toBe('number');
      expect(typeof r.within_tolerance).toBe('boolean');
      expect(r.delta).toBeLessThanOrEqual(2);
      expect(r.within_tolerance).toBe(true);
    }
  }, 60_000);

  it('parity-check 10-sample check passes for each collection', async () => {
    if (!stackOnline || !qdrantSourcesPresent) return;
    const { stderr } = await runParityCheck();
    const firstBrace = stderr.indexOf('{');
    const lastBrace = stderr.lastIndexOf('}');
    const summary = JSON.parse(stderr.slice(firstBrace, lastBrace + 1));
    expect(summary.all_sample_present).toBe(true);
    for (const r of summary.results as Array<{ missing: string[]; sampled: number; q_count: number }>) {
      expect(r.missing.length).toBe(0);
      if (r.q_count > 0) {
        expect(r.sampled).toBeGreaterThan(0);
      }
    }
  }, 60_000);
});
