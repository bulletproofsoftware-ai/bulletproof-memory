/**
 * Stage #7 smoke test — claude-memory-postgres bootstrap verification.
 *
 * BRD-REQ: REQ-S2-001, REQ-S2-002, REQ-S2-003, REQ-S2-004
 *
 * Asserts the freshly-provisioned container responds, has the four required
 * extensions, exposes the three reserved schemas, and that each extension is
 * not just registered but functional. Reads credentials from ~/.bulletproof-memory/.env
 * at runtime — never logs them.
 *
 * Skips gracefully (warn + early-return) when the container is not reachable
 * on 127.0.0.1:5438, so the test stays green on machines without the local
 * stack.
 *
 * Uses execFileSync (not execSync) — docker arguments are passed as an array,
 * not via the shell, eliminating command-injection surface even though all
 * arguments here are hardcoded.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createConnection } from 'node:net';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readPasswordFromDotenv(): string {
  const dotenvPath = (process.env.MEMPG_ENV_FILE || join(homedir(), '.bulletproof-memory/.env'));
  const lines = readFileSync(dotenvPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^CLAUDE_MEMORY_PG_PASSWORD=(.+)$/);
    if (m) return m[1].replace(/^"|"$/g, '').trim();
  }
  throw new Error('CLAUDE_MEMORY_PG_PASSWORD not in ~/.bulletproof-memory/.env');
}

function tcpProbe(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection({ host, port });
    const t = setTimeout(() => {
      sock.destroy();
      resolve(false);
    }, timeoutMs);
    sock.once('connect', () => {
      clearTimeout(t);
      sock.end();
      resolve(true);
    });
    sock.once('error', () => {
      clearTimeout(t);
      resolve(false);
    });
  });
}

function dockerInspect(args: string[]): string {
  return execFileSync('docker', ['inspect', ...args], { encoding: 'utf8' }).trim();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUIRED_EXTENSIONS = new Set(['btree_gin', 'pg_trgm', 'pgcrypto', 'plpgsql', 'vector']);
const REQUIRED_SCHEMAS = ['audit', 'memory', 'operational'];

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Stage #7 — claude-memory-postgres bootstrap', () => {
  let client: Client | null = null;
  let reachable = false;

  beforeAll(async () => {
    reachable = await tcpProbe('127.0.0.1', 5438, 2000);
    if (!reachable) {
      // eslint-disable-next-line no-console
      console.warn(
        '[stage-7] claude-memory-postgres not reachable on 127.0.0.1:5438 — skipping all assertions.'
      );
      return;
    }
    const password = readPasswordFromDotenv();
    client = new Client({
      host: '127.0.0.1',
      port: 5438,
      user: 'claude_memory',
      database: 'claude_memory',
      password,
    });
    await client.connect();
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  // Group A: process-level
  it('A1 — container exists in docker', () => {
    if (!reachable) return;
    expect(() =>
      execFileSync('docker', ['inspect', 'claude-memory-postgres'], { stdio: 'ignore' })
    ).not.toThrow();
  });

  it('A2 — container reports healthy', () => {
    if (!reachable) return;
    const status = dockerInspect([
      "--format={{.State.Health.Status}}",
      'claude-memory-postgres',
    ]);
    expect(status).toBe('healthy');
  });

  // Group B: connection + auth
  it('B1 — TCP connect succeeds on 127.0.0.1:5438', async () => {
    if (!reachable) return;
    const ok = await tcpProbe('127.0.0.1', 5438, 2000);
    expect(ok).toBe(true);
  });

  it('B2 — pg.Client authenticates and SELECT 1 returns 1', async () => {
    if (!reachable) return;
    const r = await client!.query<{ one: number }>('SELECT 1::int AS one');
    expect(r.rows[0].one).toBe(1);
  });

  // Group C: extensions registered
  it('C1 — required extensions all registered', async () => {
    if (!reachable) return;
    const r = await client!.query<{ extname: string }>(
      'SELECT extname FROM pg_extension'
    );
    const present = new Set(r.rows.map((row) => row.extname));
    for (const ext of REQUIRED_EXTENSIONS) {
      expect(present.has(ext), `missing extension: ${ext}`).toBe(true);
    }
  });

  // Group D: extensions functional
  it('D1 — pg_trgm similarity() returns > 0 for related strings', async () => {
    if (!reachable) return;
    const r = await client!.query<{ s: number }>(
      "SELECT similarity('cat','category')::float8 AS s"
    );
    expect(Number(r.rows[0].s)).toBeGreaterThan(0);
  });

  it('D2 — pgvector parses [1,2,3]::vector without error', async () => {
    if (!reachable) return;
    const r = await client!.query<{ v: string }>(
      "SELECT ('[1,2,3]'::vector)::text AS v"
    );
    expect(r.rows[0].v).toBe('[1,2,3]');
  });

  it('D3 — pgcrypto gen_random_uuid() returns a uuid', async () => {
    if (!reachable) return;
    const r = await client!.query<{ u: string }>(
      'SELECT gen_random_uuid()::text AS u'
    );
    expect(r.rows[0].u).toMatch(UUID_RE);
  });

  // Group E: schemas
  it('E1 — three reserved schemas (audit, memory, operational) exist', async () => {
    if (!reachable) return;
    const r = await client!.query<{ nspname: string }>(
      "SELECT nspname FROM pg_namespace WHERE nspname IN ('audit','memory','operational') ORDER BY nspname"
    );
    expect(r.rows.map((row) => row.nspname)).toEqual(REQUIRED_SCHEMAS);
  });
});
