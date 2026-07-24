/**
 * Stage #10 — DRM false-recall canary.
 * Verifies the canary fixture, the n8n workflow JSON, and the Postgres schema.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let stackOnline = false;
let pool: Pool | null = null;

import { createConnection } from 'node:net';
function tcpProbe(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection({ host, port });
    const t = setTimeout(() => { sock.destroy(); resolve(false); }, timeoutMs);
    sock.once('connect', () => { clearTimeout(t); sock.end(); resolve(true); });
    sock.once('error', () => { clearTimeout(t); resolve(false); });
  });
}

beforeAll(async () => {
  stackOnline = await tcpProbe('127.0.0.1', 5438, 1500);
  if (!stackOnline) return;
  const env = (() => {
    const text = readFileSync((process.env.MEMPG_ENV_FILE || `${process.env.HOME}/.bulletproof-memory/.env`), 'utf8');
    const out: Record<string, string> = {};
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
    return out;
  })();
  pool = new Pool({
    user: env.CLAUDE_MEMORY_PG_USER || 'claude_memory',
    database: env.CLAUDE_MEMORY_PG_DB || 'claude_memory',
    password: env.CLAUDE_MEMORY_PG_PASSWORD,
    host: '127.0.0.1', port: 5438, max: 1,
  });
});

afterAll(async () => { if (pool) await pool.end(); });

describe('Stage #10 — DRM canary (REQ-S7-001/002/003)', () => {
  it('canary-pairs.json has 10 cases', () => {
    const text = readFileSync(join(process.cwd(), 'scripts/migrations/stage-10/canary-pairs.json'), 'utf8');
    const parsed = JSON.parse(text);
    expect(parsed.cases).toHaveLength(10);
    expect(parsed.version).toBe(1);
  });

  it('each canary case has required fields', () => {
    const parsed = JSON.parse(readFileSync(join(process.cwd(), 'scripts/migrations/stage-10/canary-pairs.json'), 'utf8'));
    for (const c of parsed.cases) {
      expect(typeof c.id).toBe('string');
      expect(typeof c.query).toBe('string');
      expect(typeof c.expected_concept).toBe('string');
      expect(typeof c.lure_concept).toBe('string');
      expect(typeof c.unrelated_concept).toBe('string');
    }
  });

  it('n8n workflow file exists and is valid JSON', () => {
    const text = readFileSync(join(process.cwd(), 'workflows/memory-drm-canary-weekly-mon-3am.json'), 'utf8');
    const parsed = JSON.parse(text);
    expect(parsed.name).toBe('memory-drm-canary-weekly-mon-3am');
    expect(parsed.activeVersion).toBeDefined();
    expect(parsed.activeVersion.nodes.length).toBeGreaterThan(4);
  });

  it('workflow uses Mon 3AM cron expression', () => {
    const parsed = JSON.parse(readFileSync(join(process.cwd(), 'workflows/memory-drm-canary-weekly-mon-3am.json'), 'utf8'));
    const schedule = parsed.activeVersion.nodes.find((n: { id: string }) => n.id === 'schedule');
    expect(schedule.parameters.rule.interval[0].expression).toBe('0 3 * * 1');
  });

  it('audit.memory_health table exists', async () => {
    if (!stackOnline) return;
    const r = await pool!.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema='audit' AND table_name='memory_health'"
    );
    expect(r.rowCount).toBe(1);
  });

  it('audit.memory_health has expected columns', async () => {
    if (!stackOnline) return;
    const r = await pool!.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='audit' AND table_name='memory_health'"
    );
    const cols = r.rows.map((x) => x.column_name as string);
    for (const c of ['id', 'canary_run_id', 'query', 'actual_top_id', 'lure_returned', 'run_at', 'hit_rate', 'lure_fa_rate', 'unrelated_fa_rate', 'case_count']) {
      expect(cols).toContain(c);
    }
  });

  it('can insert + read a memory_health row', async () => {
    if (!stackOnline) return;
    const runId = `test-${Date.now()}`;
    try {
      await pool!.query(
        `INSERT INTO audit.memory_health (canary_run_id, query, hit_rate, lure_fa_rate, unrelated_fa_rate, case_count)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [runId, 'test query', 0.9, 0.1, 0.0, 10]
      );
      const r = await pool!.query(
        `SELECT hit_rate, lure_fa_rate FROM audit.memory_health WHERE canary_run_id=$1`,
        [runId]
      );
      expect(r.rowCount).toBe(1);
      expect(parseFloat(r.rows[0].hit_rate)).toBeCloseTo(0.9);
    } finally {
      await pool!.query(`DELETE FROM audit.memory_health WHERE canary_run_id=$1`, [runId]);
    }
  });
});
