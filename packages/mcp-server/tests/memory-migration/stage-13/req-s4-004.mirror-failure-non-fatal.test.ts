/**
 * REQ-S4-004 + CISO C-S13-E — Mirror failures are non-fatal.
 * Inject a poisoned pool; assert mirrorEpisode/mirrorSessionTranscript do not throw.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import {
  __closePoolForTests,
  __resetStatsForTests,
  mirrorEpisode,
  mirrorSessionTranscript,
  mirrorStats,
  setPoolForTests,
} from '../../../src/postgres-mirror.js';

const ID = '22222222-2222-2222-2222-000000000001';

class PoisonedPool {
  // Minimal Pool shape — only what execInsertStage13 uses.
  async connect(): Promise<never> {
    throw new Error('poisoned: connection refused');
  }
  on(): this { return this; }
  end(): Promise<void> { return Promise.resolve(); }
}

beforeAll(() => {
  // Force the flag on so the mirror actually attempts a write.
  process.env.STAGE_13_DUAL_WRITE = 'true';
});

afterAll(async () => {
  delete process.env.STAGE_13_DUAL_WRITE;
  setPoolForTests(null);
  await __closePoolForTests();
});

beforeEach(() => {
  __resetStatsForTests();
  setPoolForTests(new PoisonedPool() as unknown as Pool);
});

afterEach(() => {
  setPoolForTests(null);
});

describe('Stage #13 — mirror failure non-fatal (C-S13-E)', () => {
  it('mirrorEpisode does not throw when pool is poisoned', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      await expect(
        mirrorEpisode(ID, { task: 't', project: '__nf_test__' })
      ).resolves.toBeUndefined();
    } finally {
      stderr.mockRestore();
    }
  });

  it('mirrorSessionTranscript does not throw when pool is poisoned', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      await expect(
        mirrorSessionTranscript(ID, { session_id: 's', project: '__nf_test__', transcript: 'x' })
      ).resolves.toBeUndefined();
    } finally {
      stderr.mockRestore();
    }
  });

  it('mirrorStats.failures increments on poisoned pool', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      await mirrorEpisode(ID, { task: 't', project: '__nf_test__' });
      expect(mirrorStats.failures).toBeGreaterThan(0);
    } finally {
      stderr.mockRestore();
    }
  });

  it('mirrorStats.lastErrorAt is ISO timestamp after failure', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      await mirrorEpisode(ID, { task: 't', project: '__nf_test__' });
      expect(mirrorStats.lastErrorAt).not.toBeNull();
      // parseable as a date
      const parsed = Date.parse(mirrorStats.lastErrorAt!);
      expect(Number.isFinite(parsed)).toBe(true);
    } finally {
      stderr.mockRestore();
    }
  });

  it('stderr emits structured prefix on failure', async () => {
    const lines: string[] = [];
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation((s) => {
      if (typeof s === 'string') lines.push(s);
      return true;
    });
    try {
      await mirrorEpisode(ID, { task: 't', project: '__nf_test__' });
      // Expect at least one line with the [postgres-mirror][episodes] prefix.
      const found = lines.some((l) => l.includes('[postgres-mirror][episodes]'));
      expect(found).toBe(true);
    } finally {
      stderr.mockRestore();
    }
  });

  it('no connection-string leak in stderr', async () => {
    const lines: string[] = [];
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation((s) => {
      if (typeof s === 'string') lines.push(s);
      return true;
    });
    try {
      await mirrorEpisode(ID, { task: 't', project: '__nf_test__' });
      // The PoisonedPool throws before any DB query — so password should never
      // be in stderr. But check anyway: the actual password value must not
      // appear in any stderr line.
      const password = process.env.CLAUDE_MEMORY_PG_PASSWORD;
      // In CI without env loaded, password may be undefined — that's fine, the
      // assertion still holds (no leak possible).
      if (password) {
        for (const l of lines) {
          expect(l).not.toContain(password);
        }
      }
    } finally {
      stderr.mockRestore();
    }
  });
});
