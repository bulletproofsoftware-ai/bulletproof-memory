/**
 * REQ-S3-003 + CISO C-S8-E — mirror must never throw, even on hard PG failure.
 *
 * Override the module-level pool with a poisoned DSN, attempt a mirror call,
 * assert no throw escapes and the failure counter increments.
 *
 * Does NOT require the live container — runs everywhere.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

describe('Stage #8 — REQ-S3-003 mirror failure isolation', () => {
  afterEach(async () => {
    const mod = await import('../../../src/postgres-mirror.js');
    await mod.__closePoolForTests();
  });

  it('PG connection error does not throw out of mirrorAuditLog', async () => {
    process.env.STAGE_8_DUAL_WRITE = 'true';
    const mod = await import('../../../src/postgres-mirror.js');
    mod.__resetStatsForTests();
    // Poison the pool with an unreachable host:port.
    const poisoned = new Pool({
      host: '127.0.0.1',
      port: 9, // discard service typically refuses pg protocol
      user: 'nope',
      database: 'nope',
      password: 'nope',
      connectionTimeoutMillis: 500,
      max: 1,
    });
    // pg.Pool emits 'error' on idle clients — must be handled or process exits.
    poisoned.on('error', () => { /* swallow */ });
    mod.setPoolForTests(poisoned);

    let threw = false;
    try {
      await mod.mirrorAuditLog(randomUUID(), {
        action: 'FAIL_TEST',
        timestamp: new Date().toISOString(),
        project: '__stage8_test__',
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(mod.mirrorStats.attempts).toBeGreaterThan(0);
    expect(mod.mirrorStats.failures).toBeGreaterThan(0);

    await poisoned.end().catch(() => undefined);
  });
});
