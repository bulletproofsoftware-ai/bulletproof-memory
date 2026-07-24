/**
 * Shared helpers for Stage #8 vitest suites.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createConnection } from 'node:net';

export function tcpProbe(host: string, port: number, timeoutMs: number): Promise<boolean> {
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

interface Dotenv {
  [k: string]: string;
}

let cached: Dotenv | null = null;

function loadDotenv(): Dotenv {
  if (cached) return cached;
  const path = (process.env.MEMPG_ENV_FILE || join(homedir(), '.bulletproof-memory/.env'));
  const text = readFileSync(path, 'utf8');
  const out: Dotenv = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim().replace(/^"|"$/g, '');
    if (k) out[k] = v;
  }
  cached = out;
  return out;
}

export function pgEnv(): { user: string; database: string; password: string; host: string; port: number } {
  const env = loadDotenv();
  if (!env.CLAUDE_MEMORY_PG_PASSWORD)
    throw new Error('CLAUDE_MEMORY_PG_PASSWORD missing from ~/.bulletproof-memory/.env');
  return {
    user: env.CLAUDE_MEMORY_PG_USER || 'claude_memory',
    database: env.CLAUDE_MEMORY_PG_DB || 'claude_memory',
    password: env.CLAUDE_MEMORY_PG_PASSWORD,
    host: env.CLAUDE_MEMORY_PG_HOST || '127.0.0.1',
    port: Number.parseInt(env.CLAUDE_MEMORY_PG_PORT || '5438', 10),
  };
}

export function exportPgEnvToProcess(): void {
  const c = pgEnv();
  process.env.CLAUDE_MEMORY_PG_USER = c.user;
  process.env.CLAUDE_MEMORY_PG_DB = c.database;
  process.env.CLAUDE_MEMORY_PG_PASSWORD = c.password;
  process.env.CLAUDE_MEMORY_PG_HOST = c.host;
  process.env.CLAUDE_MEMORY_PG_PORT = String(c.port);
}

/**
 * Probe whether a Qdrant collection exists. Used as a post-drop skip-gate
 * for migration/parity tests that require source collections to be present.
 * Returns false on network failure (treat as absent — safe default).
 */
export async function qdrantCollectionExists(collection: string): Promise<boolean> {
  try {
    const env = loadDotenv();
    const url = env.QDRANT_URL || 'http://localhost:6334';
    const key = env.QDRANT_API_KEY;
    if (!key) return false;
    const res = await fetch(`${url}/collections/${encodeURIComponent(collection)}`, {
      method: 'GET',
      headers: { 'api-key': key },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const STAGE_8_TABLES = [
  'audit_log',
  'forensic_events',
  'guardian_audit_log',
  'benchmark_runs',
  'benchmarks',
  'consolidation_cycles',
  'agent_identity_sessions',
  'delegation_tokens',
  'nhi_lifecycle',
  'nhi_transitions',
  'compliance_dashboard',
  'compliance_trends',
] as const;
