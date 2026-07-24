// REQ-S0-001 — collection-size cache for empty-collection guard
// Tests the pure helper surface exported from src/index.ts:
//   - getCachedCollectionCount: TTL caching, fall-through on error
//   - invalidateCollectionSizeCache: 1-second floor (CISO S0-001-A)
// Recall-handler integration is exercised via build + smoke test, not here.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  collectionSizeCache,
  collectionSizeLastInvalidatedAt,
  getCachedCollectionCount,
  invalidateCollectionSizeCache,
} from '../../../src/index.ts';

// We mock global fetch so we control Qdrant responses without hitting the network.
const realFetch = globalThis.fetch;

beforeEach(() => {
  collectionSizeCache.clear();
  collectionSizeLastInvalidatedAt.clear();
});
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.useRealTimers();
});

describe('REQ-S0-001 getCachedCollectionCount', () => {
  it('returns 0 for a known-empty collection and caches it', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response(JSON.stringify({ result: { points_count: 0 } }), { status: 200 });
    }) as any;

    const a = await getCachedCollectionCount('memories_hot');
    const b = await getCachedCollectionCount('memories_hot');
    expect(a).toBe(0);
    expect(b).toBe(0);
    expect(calls).toBe(1); // second call served from cache
  });

  it('returns positive count for a populated collection', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ result: { points_count: 13895 } }), { status: 200 })) as any;
    const n = await getCachedCollectionCount('memories_warm');
    expect(n).toBe(13895);
  });

  it('returns null when Qdrant request errors (fail-open)', async () => {
    globalThis.fetch = (async () => {
      throw new Error('connection refused');
    }) as any;
    const n = await getCachedCollectionCount('memories_hot');
    expect(n).toBeNull();
  });

  it('returns null when Qdrant returns non-2xx (fail-open)', async () => {
    globalThis.fetch = (async () => new Response('not found', { status: 404 })) as any;
    const n = await getCachedCollectionCount('does_not_exist');
    expect(n).toBeNull();
  });

  it('falls back to vectors_count when points_count is absent', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ result: { vectors_count: 42 } }), { status: 200 })) as any;
    const n = await getCachedCollectionCount('legacy_shape');
    expect(n).toBe(42);
  });

  it('refreshes after TTL expires', async () => {
    vi.useFakeTimers();
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response(JSON.stringify({ result: { points_count: 0 } }), { status: 200 });
    }) as any;

    await getCachedCollectionCount('memories_hot');
    expect(calls).toBe(1);
    vi.advanceTimersByTime(61_000); // > 60s TTL
    await getCachedCollectionCount('memories_hot');
    expect(calls).toBe(2);
  });
});

describe('REQ-S0-001 invalidateCollectionSizeCache (CISO S0-001-A floor)', () => {
  it('clears cache on first invalidate', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ result: { points_count: 5 } }), { status: 200 })) as any;
    await getCachedCollectionCount('memories_hot');
    expect(collectionSizeCache.has('memories_hot')).toBe(true);
    invalidateCollectionSizeCache('memories_hot');
    expect(collectionSizeCache.has('memories_hot')).toBe(false);
  });

  it('rate-limits invalidations to >=1s apart', async () => {
    // Pin the fake clock to a real-looking timestamp so the very first invalidate
    // (which sees last=0 internally) trivially clears the >=1s floor.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-16T23:55:00Z'));

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ result: { points_count: 5 } }), { status: 200 })) as any;

    await getCachedCollectionCount('memories_hot');
    invalidateCollectionSizeCache('memories_hot'); // first → succeeds
    expect(collectionSizeCache.has('memories_hot')).toBe(false);

    // Repopulate
    await getCachedCollectionCount('memories_hot');
    expect(collectionSizeCache.has('memories_hot')).toBe(true);

    // Second invalidate within 1s should be a no-op
    vi.advanceTimersByTime(500);
    invalidateCollectionSizeCache('memories_hot');
    expect(collectionSizeCache.has('memories_hot')).toBe(true); // still cached → floor honored

    // After 1.5s total it should succeed
    vi.advanceTimersByTime(600);
    invalidateCollectionSizeCache('memories_hot');
    expect(collectionSizeCache.has('memories_hot')).toBe(false);
  });
});
