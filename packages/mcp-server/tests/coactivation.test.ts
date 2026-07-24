// E3 — Coactivation Recall Signal (Spreading Activation)
// Spec: TODO/spec-E3-coactivation.md  (§7 Test Plan, PRD §4.3)
//
// Pure-function + injected-fetcher tests for the coactivation boost. The
// link-fetch and recall-history are injected via computeCoactivationBoosts'
// optional test seams so no live Qdrant / MCP server is required — fully
// deterministic. Production call sites pass no opts, reproducing spec §5.2/§5.3.

import { describe, it, expect, vi } from 'vitest';
import {
  coactivationRecencyWeight,
  computeCoactivationBoosts,
  COACTIVATION_CAP,
  COACTIVATION_GAIN_K,
  COACTIVATION_RECENCY_HALFLIFE_MS,
  COACTIVATION_RECENCY_FLOOR,
  DEFAULT_EDGE_WEIGHT,
} from '../src/index.js';

const HOUR = 60 * 60 * 1000;
const NOW = 1_700_000_000_000; // fixed clock (epoch ms)

// Helper: a recall-history map keyed memoryId -> { lastRecalledAt }.
function history(...entries: Array<[string, number]>): Map<string, { lastRecalledAt: number }> {
  return new Map(entries.map(([id, t]) => [id, { lastRecalledAt: t }]));
}

// Helper: an in-memory link fetcher returning the supplied triples regardless of input.
function staticFetcher(rows: Array<{ candidate_id: string; neighbor_id: string; weight: number }>) {
  return async () => rows;
}

describe('E3 — coactivationRecencyWeight (pure, PRD §4.4)', () => {
  it('T1: 0h=1.0, 2h=0.5, 16h < floor', () => {
    expect(coactivationRecencyWeight(NOW, NOW)).toBeCloseTo(1.0, 9);
    expect(coactivationRecencyWeight(NOW - 2 * HOUR, NOW)).toBeCloseTo(0.5, 9);
    expect(coactivationRecencyWeight(NOW - 16 * HOUR, NOW)).toBeLessThan(COACTIVATION_RECENCY_FLOOR);
    // future timestamp clamps age to 0 -> weight 1.0 (no >1 blowup)
    expect(coactivationRecencyWeight(NOW + 5 * HOUR, NOW)).toBeCloseTo(1.0, 9);
  });

  it('half-life constant is exactly 2 hours', () => {
    expect(COACTIVATION_RECENCY_HALFLIFE_MS).toBe(2 * HOUR);
  });
});

describe('E3 — cold session (PRD §4.3 AC1)', () => {
  it('T2: empty history → empty map AND zero link queries', async () => {
    const fetcher = vi.fn(staticFetcher([]));
    const candidates = [
      { id: 'A', score: 0.9 },
      { id: 'B', score: 0.8 },
    ];
    const boosts = await computeCoactivationBoosts(candidates, 10, {
      recentHistory: history(),     // empty
      linkFetcher: fetcher,
      nowMs: NOW,
    });
    expect(boosts.size).toBe(0);            // every candidate reads ?? 1.0
    expect(fetcher).not.toHaveBeenCalled(); // ZERO link queries on a cold session
    // combined_score parity: with boost 1.0, the 5-factor product == the 4-factor product.
    const base = 0.9 * 1 * 1 * 1;
    expect(base * (boosts.get('A') ?? 1.0)).toBe(base);
  });

  it('history exists but all stale (below floor) → still empty map, zero queries', async () => {
    const fetcher = vi.fn(staticFetcher([{ candidate_id: 'A', neighbor_id: 'X', weight: 1.0 }]));
    const boosts = await computeCoactivationBoosts([{ id: 'A', score: 0.9 }], 10, {
      recentHistory: history(['X', NOW - 16 * HOUR]), // weight ~0.0055 < floor
      linkFetcher: fetcher,
      nowMs: NOW,
    });
    expect(boosts.size).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('E3 — boost computation (PRD §4.3 AC2, AC6, AC7)', () => {
  it('T3: linked candidate outranks equal-similarity unlinked at exactly 1.1×', async () => {
    // A linked to X (strength 1.0); X recalled now (recency 1.0). B unlinked.
    const fetcher = staticFetcher([{ candidate_id: 'A', neighbor_id: 'X', weight: 1.0 }]);
    const boosts = await computeCoactivationBoosts(
      [{ id: 'A', score: 0.8 }, { id: 'B', score: 0.8 }],
      10,
      { recentHistory: history(['X', NOW]), linkFetcher: fetcher, nowMs: NOW },
    );
    const boostA = boosts.get('A') ?? 1.0;
    const boostB = boosts.get('B') ?? 1.0;
    expect(boostA).toBeCloseTo(1.1, 9);          // 1 + 0.1*(1.0*1.0)
    expect(boostB).toBe(1.0);                    // unlinked → absent → 1.0
    // identical base factors → A's combined_score is 1.1× B's → A sorts above B.
    const base = 0.8 * 1 * 1 * 1;
    const combinedA = base * boostA;
    const combinedB = base * boostB;
    expect(combinedA).toBeGreaterThan(combinedB);
    expect(combinedA / combinedB).toBeCloseTo(1.1, 9);
  });

  it('T9: recency decay shapes boost — neighbor 2h old (recency 0.5) → 1.05', async () => {
    const fetcher = staticFetcher([{ candidate_id: 'A', neighbor_id: 'X', weight: 1.0 }]);
    const boosts = await computeCoactivationBoosts([{ id: 'A', score: 0.8 }], 10, {
      recentHistory: history(['X', NOW - 2 * HOUR]),
      linkFetcher: fetcher,
      nowMs: NOW,
    });
    expect(boosts.get('A')).toBeCloseTo(1.05, 9); // 1 + 0.1*(1.0*0.5)
  });

  it('T4: CAP enforced — 100 fresh neighbors strength 1.0 → clamped to 1.5', async () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      candidate_id: 'A',
      neighbor_id: `X${i}`,
      weight: 1.0,
    }));
    const hist = history(...rows.map((r, i): [string, number] => [`X${i}`, NOW]));
    const boosts = await computeCoactivationBoosts([{ id: 'A', score: 0.8 }], 200, {
      recentHistory: hist,
      linkFetcher: staticFetcher(rows),
      nowMs: NOW,
    });
    // raw = 1 + 0.1*100 = 11 → clamp to CAP.
    expect(boosts.get('A')).toBe(COACTIVATION_CAP);
    expect(COACTIVATION_CAP).toBe(1.5);
  });

  it('strength weights are honored (0.8 link → 1.08)', async () => {
    const fetcher = staticFetcher([{ candidate_id: 'A', neighbor_id: 'X', weight: 0.8 }]);
    const boosts = await computeCoactivationBoosts([{ id: 'A', score: 0.8 }], 10, {
      recentHistory: history(['X', NOW]),
      linkFetcher: fetcher,
      nowMs: NOW,
    });
    expect(boosts.get('A')).toBeCloseTo(1 + COACTIVATION_GAIN_K * 0.8, 9); // 1.08
  });

  it('non-finite weight falls back to DEFAULT_EDGE_WEIGHT (1.0)', async () => {
    const fetcher = staticFetcher([{ candidate_id: 'A', neighbor_id: 'X', weight: NaN }]);
    const boosts = await computeCoactivationBoosts([{ id: 'A', score: 0.8 }], 10, {
      recentHistory: history(['X', NOW]),
      linkFetcher: fetcher,
      nowMs: NOW,
    });
    expect(boosts.get('A')).toBeCloseTo(1 + COACTIVATION_GAIN_K * DEFAULT_EDGE_WEIGHT, 9); // 1.1
  });
});

describe('E3 — self-exclusion & bidirectional (PRD §4 D9/D10)', () => {
  it('T8: a self-link (neighbor_id === candidate_id) does NOT boost', async () => {
    // c is itself in the recent set AND there is a self-link c↔c.
    const fetcher = staticFetcher([{ candidate_id: 'C', neighbor_id: 'C', weight: 1.0 }]);
    const boosts = await computeCoactivationBoosts([{ id: 'C', score: 0.8 }], 10, {
      recentHistory: history(['C', NOW]),
      linkFetcher: fetcher,
      nowMs: NOW,
    });
    expect(boosts.has('C')).toBe(false); // self-link dropped → no contribution → absent → 1.0
  });

  it('T12: both directions count (outgoing A→X and incoming X→B aggregate identically here)', async () => {
    // The fetcher already normalizes both directions into {candidate_id, neighbor_id};
    // computeCoactivationBoosts is direction-agnostic once normalized. Assert two
    // candidates each linked once to a fresh neighbor both get 1.1.
    const fetcher = staticFetcher([
      { candidate_id: 'A', neighbor_id: 'X', weight: 1.0 }, // came from outgoing source_id=A
      { candidate_id: 'B', neighbor_id: 'X', weight: 1.0 }, // came from incoming target_id=B
    ]);
    const boosts = await computeCoactivationBoosts(
      [{ id: 'A', score: 0.8 }, { id: 'B', score: 0.8 }],
      10,
      { recentHistory: history(['X', NOW]), linkFetcher: fetcher, nowMs: NOW },
    );
    expect(boosts.get('A')).toBeCloseTo(1.1, 9);
    expect(boosts.get('B')).toBeCloseTo(1.1, 9);
  });

  it('neighbor not in recent set contributes nothing', async () => {
    const fetcher = staticFetcher([{ candidate_id: 'A', neighbor_id: 'Z', weight: 1.0 }]);
    const boosts = await computeCoactivationBoosts([{ id: 'A', score: 0.8 }], 10, {
      recentHistory: history(['X', NOW]), // Z is not recalled
      linkFetcher: fetcher,
      nowMs: NOW,
    });
    expect(boosts.has('A')).toBe(false);
  });
});

describe('E3 — fail-open (PRD §4.3 AC3)', () => {
  it('T5a: linkFetcher throws → empty map, console.warn fired, no throw escapes', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const thrower = vi.fn(async () => {
      throw new Error('qdrant transport fail');
    });
    const boosts = await computeCoactivationBoosts([{ id: 'A', score: 0.8 }], 10, {
      recentHistory: history(['X', NOW]),
      linkFetcher: thrower,
      nowMs: NOW,
    });
    expect(boosts.size).toBe(0);               // every candidate → 1.0
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0][0])).toContain('[coactivation] fail-open');
    warn.mockRestore();
  });

  it('T5b: empty/missing collection (fetcher returns []) → boosts all 1.0, no throw', async () => {
    const boosts = await computeCoactivationBoosts([{ id: 'A', score: 0.8 }], 10, {
      recentHistory: history(['X', NOW]),
      linkFetcher: staticFetcher([]),
      nowMs: NOW,
    });
    expect(boosts.size).toBe(0);
  });
});

describe('E3 — stale-entry eviction (leak fix)', () => {
  it('prunes entries below the recency floor from the history Map after a recall', async () => {
    // Fresh entry X (recallable) + stale entry OLD (16h old, weight ~0.0055 < floor).
    const hist = history(['X', NOW], ['OLD', NOW - 16 * HOUR]);
    expect(hist.has('OLD')).toBe(true); // present before the recall
    expect(hist.size).toBe(2);

    await computeCoactivationBoosts([{ id: 'A', score: 0.8 }], 10, {
      recentHistory: hist,
      linkFetcher: staticFetcher([{ candidate_id: 'A', neighbor_id: 'X', weight: 1.0 }]),
      nowMs: NOW,
    });

    // The sub-floor entry is evicted; the fresh one survives → Map is bounded.
    expect(hist.has('OLD')).toBe(false);
    expect(hist.has('X')).toBe(true);
    expect(hist.size).toBe(1);
  });

  it('does NOT evict the just-recalled (fresh) ids — only sub-floor entries are pruned', async () => {
    // Two fresh entries + one stale. Only the stale one should disappear.
    const hist = history(['fresh1', NOW], ['fresh2', NOW - HOUR], ['stale', NOW - 20 * HOUR]);
    await computeCoactivationBoosts([{ id: 'A', score: 0.8 }], 10, {
      recentHistory: hist,
      linkFetcher: staticFetcher([]),
      nowMs: NOW,
    });
    expect(hist.has('fresh1')).toBe(true);
    expect(hist.has('fresh2')).toBe(true);
    expect(hist.has('stale')).toBe(false);
  });

  it('repeated recalls do not let stale entries accumulate (cold session left empty)', async () => {
    // All entries stale → after the call the Map is fully drained (cold-session return path).
    const hist = history(['a', NOW - 16 * HOUR], ['b', NOW - 18 * HOUR], ['c', NOW - 24 * HOUR]);
    const boosts = await computeCoactivationBoosts([{ id: 'A', score: 0.8 }], 10, {
      recentHistory: hist,
      linkFetcher: staticFetcher([{ candidate_id: 'A', neighbor_id: 'a', weight: 1.0 }]),
      nowMs: NOW,
    });
    expect(boosts.size).toBe(0); // cold session → all boosts 1.0
    expect(hist.size).toBe(0);   // and the stale entries were pruned, not retained
  });
});

describe('E3 — top-N gate (PRD §4.2 D6)', () => {
  it('only the strongest limit×3 candidate ids are passed to the fetcher', async () => {
    const fetcher = vi.fn(staticFetcher([]));
    // limit=1 → top-N = 3. Supply 5 candidates; only the 3 highest-score ids go to the fetcher.
    const candidates = [
      { id: 'lo1', score: 0.1 },
      { id: 'hi1', score: 0.9 },
      { id: 'lo2', score: 0.2 },
      { id: 'hi2', score: 0.8 },
      { id: 'hi3', score: 0.7 },
    ];
    await computeCoactivationBoosts(candidates, 1, {
      recentHistory: history(['X', NOW]),
      linkFetcher: fetcher,
      nowMs: NOW,
    });
    expect(fetcher).toHaveBeenCalledOnce();
    const passedIds: string[] = fetcher.mock.calls[0][0];
    expect(passedIds).toHaveLength(3);
    expect(new Set(passedIds)).toEqual(new Set(['hi1', 'hi2', 'hi3']));
  });
});
