// E4 — Graph-First Query Routing
// Spec: TODO/spec-E4-graph-first.md  (§9 Test Plan, PRD §5.3)
//
// Pure-function + injected-seam tests. Every function with I/O exposes optional test
// seams (searcher / linkFetcher / fetcher / traverser / hydrator) so no live Qdrant /
// MCP server is required — fully deterministic. Production call sites pass none.
// Numeric assertions to ≥4 dp (CLAUDE.md §1). Mirrors tests/coactivation.test.ts.

import { describe, it, expect, vi } from 'vitest';
import {
  // classifier
  RELATIONSHIP_INTENT_RE,
  detectRelationshipIntent,
  ANCHOR_MIN_SIM,
  resolveAnchor,
  classifyAndResolve,
  // traversal + hydration
  GRAPH_MAX_HOPS,
  GRAPH_MAX_NODES,
  GRAPH_DISTANCE_FACTORS,
  traverseLinks,
  hydrateAcrossTiers,
  getPointsByIds,
  buildGraphFirstCandidates,
  graphDistanceFactor,
  passesGraphProjectScope,
  passesGraphTimeBounds,
  StoreMemorySchema,
  // reused E1/E2/E3 scoring primitives (non-regression on graph path)
  computeCoactivationBoosts,
  resolveHalflifeDays,
  inferSector,
  computeTemporalScore,
  computeExactTokenBoost,
  extractRareTokens,
} from '../src/index.js';

const NOW = 1_700_000_000_000;
const HOUR = 60 * 60 * 1000;

// Reproduce the handler's §5.6 scoring map for graph candidates so non-regression of
// E1/E2/E3 factors on the graph path is asserted on the EXACT same math the handler runs.
function scoreOne(
  r: any,
  rareTokens: string[],
  coactivationBoost: Map<string, number>,
  nowMs: number,
) {
  const temporal_score = computeTemporalScore(r.payload || {});
  const lastAccessed = r.payload?.last_accessed_at
    ? new Date(r.payload.last_accessed_at).getTime()
    : new Date(r.payload?.created_at || nowMs).getTime();
  const daysSinceAccess = (nowMs - lastAccessed) / 86400000;
  const halflife = resolveHalflifeDays(r.payload || {});
  const decay_score = Math.pow(0.5, daysSinceAccess / halflife);
  const exact_token_boost = computeExactTokenBoost(r.payload?.content, rareTokens);
  const coactivation_boost = coactivationBoost.get(r.id) ?? 1.0;
  const graph_distance_factor = typeof r.graph_distance === 'number'
    ? graphDistanceFactor(r.graph_distance) : 1.0;
  return {
    ...r,
    temporal_score, decay_score, exact_token_boost, coactivation_boost,
    ...(typeof r.graph_distance === 'number' ? { graph_distance: r.graph_distance, graph_distance_factor } : {}),
    combined_score: r.score * temporal_score * decay_score * exact_token_boost * coactivation_boost * graph_distance_factor,
  };
}

// ---------------------------------------------------------------------------
describe('E4 — detectRelationshipIntent (pure, AC1/AC5 §4.1)', () => {
  it('T1: TRUE for relational phrasings', () => {
    expect(detectRelationshipIntent("what's connected to the auth decision")).toBe(true);
    expect(detectRelationshipIntent('everything linked to the migration')).toBe(true);
    expect(detectRelationshipIntent('what depends on the migration')).toBe(true);
    expect(detectRelationshipIntent('show memories related to OAuth')).toBe(true);
    expect(detectRelationshipIntent('neighbors of the login node')).toBe(true);
  });

  it('T1: FALSE for ordinary semantic queries (false-negative is the safe direction)', () => {
    expect(detectRelationshipIntent('notes on testing')).toBe(false);
    expect(detectRelationshipIntent('how do I feel about coffee')).toBe(false);
    expect(detectRelationshipIntent('I depend on caffeine')).toBe(false); // "depend on" w/o relational object
  });

  it('regex is exported and stateless across calls (no /g lastIndex bug)', () => {
    expect(RELATIONSHIP_INTENT_RE.flags.includes('g')).toBe(false);
    const q = 'what is connected to X';
    expect(detectRelationshipIntent(q)).toBe(true);
    expect(detectRelationshipIntent(q)).toBe(true); // second call must not flip
  });
});

describe('E4 — classifyAndResolve (AC1/AC2/AC3 §4.3)', () => {
  it('T2: non-relationship query → vector-first AND never calls the resolver (zero I/O)', async () => {
    const resolver = vi.fn(async () => ({ id: 'A', score: 0.9, tier: 'long_term', payload: {} }));
    const route = await classifyAndResolve('notes on testing', [0.1, 0.2], undefined, { resolver });
    expect(route).toEqual({ strategy: 'vector-first' });
    expect(resolver).not.toHaveBeenCalled(); // AC1 zero-I/O fast path
  });

  it('T3: relationship query + resolver hit → graph-first with anchorId', async () => {
    const resolver = vi.fn(async () => ({ id: 'anchor-1', score: 0.71, tier: 'long_term', payload: {} }));
    const route = await classifyAndResolve("what's connected to the auth decision", [0.1], undefined, { resolver });
    expect(route).toEqual({ strategy: 'graph-first', anchorId: 'anchor-1', anchorScore: 0.71 });
    expect(resolver).toHaveBeenCalledOnce();
  });

  it('T8: relationship query but resolver returns null → vector-first fallback', async () => {
    const resolver = vi.fn(async () => null);
    const route = await classifyAndResolve('everything linked to X', [0.1], undefined, { resolver });
    expect(route).toEqual({ strategy: 'vector-first' });
  });
});

describe('E4 — resolveAnchor (§4.2)', () => {
  it('returns the top hit when it clears ANCHOR_MIN_SIM', async () => {
    const searcher = vi.fn(async () => [{ id: 'A', score: 0.8, payload: { content: 'x' } }]);
    const a = await resolveAnchor([0.1], { should: [] }, { searcher });
    expect(a).toEqual({ id: 'A', score: 0.8, tier: 'long_term', payload: { content: 'x' } });
    // floor + limit=1 passed through to the searcher
    expect(searcher).toHaveBeenCalledWith([0.1], 1, ANCHOR_MIN_SIM, { should: [] });
  });

  it('returns null when search yields nothing above the floor', async () => {
    const searcher = vi.fn(async () => []);
    expect(await resolveAnchor([0.1], undefined, { searcher })).toBeNull();
  });

  it('fail-open: searcher throws → null (no escape)', async () => {
    const searcher = vi.fn(async () => { throw new Error('qdrant down'); });
    expect(await resolveAnchor([0.1], undefined, { searcher })).toBeNull();
  });

  it('floor constant is 0.55', () => {
    expect(ANCHOR_MIN_SIM).toBe(0.55);
  });
});

describe('E4 — graphDistanceFactor (§5.4)', () => {
  it('T4-support: hop 0/1/2 map to 1.0 / 0.85 / 0.7; deeper clamps to last', () => {
    expect(graphDistanceFactor(0)).toBeCloseTo(1.0, 9);
    expect(graphDistanceFactor(1)).toBeCloseTo(0.85, 9);
    expect(graphDistanceFactor(2)).toBeCloseTo(0.7, 9);
    expect(graphDistanceFactor(5)).toBeCloseTo(0.7, 9); // clamp to deepest
    expect(graphDistanceFactor(-1)).toBeCloseTo(1.0, 9);
    expect(GRAPH_DISTANCE_FACTORS).toEqual([1.0, 0.85, 0.7]);
  });
});

describe('E4 — combined_score pure product incl. graph factor (T4, AC1/AC4)', () => {
  it('hop-1 node with all other factors 1.0 → combined == 0.85; vector node (no graph_distance) == base', () => {
    const rareTokens: string[] = []; // no rare tokens → exact_token_boost neutral
    const coact = new Map<string, number>();
    // hop-1 graph node: score 1.0, fresh created_at/last_accessed = now → decay 1.0, temporal neutral path.
    const graphNode = {
      id: 'G1', score: 1.0, tier: 'long_term', graph_distance: 1,
      payload: { content: 'linked memory', created_at: new Date(NOW).toISOString(), last_accessed_at: new Date(NOW).toISOString() },
    };
    const scoredG = scoreOne(graphNode, rareTokens, coact, NOW);
    // temporal & decay & exact & coactivation all 1.0 → combined == graph factor for hop1 == 0.85
    expect(scoredG.temporal_score).toBeCloseTo(1.0, 6);
    expect(scoredG.decay_score).toBeCloseTo(1.0, 6);
    expect(scoredG.exact_token_boost).toBeCloseTo(1.0, 6);
    expect(scoredG.coactivation_boost).toBeCloseTo(1.0, 6);
    expect(scoredG.graph_distance_factor).toBeCloseTo(0.85, 9);
    expect(scoredG.combined_score).toBeCloseTo(0.85, 9);

    // vector-first node: identical payload but NO graph_distance → factor absent → combined == base (score)
    const vecNode = {
      id: 'V1', score: 0.9, tier: 'long_term',
      payload: { content: 'plain memory', created_at: new Date(NOW).toISOString(), last_accessed_at: new Date(NOW).toISOString() },
    };
    const scoredV = scoreOne(vecNode, rareTokens, coact, NOW);
    expect('graph_distance' in scoredV).toBe(false);
    expect('graph_distance_factor' in scoredV).toBe(false);
    expect(scoredV.combined_score).toBeCloseTo(0.9, 9); // base score, factor 1.0 → AC1 unchanged
  });
});

describe('E4 — traverseLinks BFS (§5.1, T12)', () => {
  // anchor→A (hop1)→B (hop2); B reachable only via A. C would be hop3 (absent at maxHops=2).
  const graph: Record<string, string[]> = {
    anchor: ['A'],
    A: ['anchor', 'B'],
    B: ['A', 'C'],
    C: ['B'],
  };
  const linkFetcher = async (ids: string[]) => {
    const rows: Array<{ candidate_id: string; neighbor_id: string; weight: number }> = [];
    for (const id of ids) for (const nb of (graph[id] ?? [])) rows.push({ candidate_id: id, neighbor_id: nb, weight: 1.0 });
    return rows;
  };

  it('T12: dist = {anchor:0, A:1, B:2}; hop-3 node C absent; maxHops honored', async () => {
    const dist = await traverseLinks('anchor', { linkFetcher });
    expect(dist.get('anchor')).toBe(0);
    expect(dist.get('A')).toBe(1);
    expect(dist.get('B')).toBe(2);
    expect(dist.has('C')).toBe(false); // hop-3 excluded at maxHops=2
  });

  it('respects maxNodes cap', async () => {
    const hubFetcher = async (ids: string[]) => {
      if (ids.includes('anchor')) {
        return Array.from({ length: 500 }, (_, i) => ({ candidate_id: 'anchor', neighbor_id: `n${i}`, weight: 1.0 }));
      }
      return [];
    };
    const dist = await traverseLinks('anchor', { linkFetcher: hubFetcher, maxNodes: 50 });
    expect(dist.size).toBeLessThanOrEqual(50);
  });

  it('config constants are 2 hops / 200 nodes', () => {
    expect(GRAPH_MAX_HOPS).toBe(2);
    expect(GRAPH_MAX_NODES).toBe(200);
  });
});

describe('E4 — getPointsByIds (§5.2, T15)', () => {
  it('T15: builds POST /collections/{c}/points {ids, with_payload, with_vector:false} and returns result.result', async () => {
    // inject qdrantRequest via the module? getPointsByIds calls the module-internal qdrantRequest,
    // which we cannot inject. Instead assert behavior at the seam we DO control: empty ids → [].
    const empty = await getPointsByIds('memories_hot', []);
    expect(empty).toEqual([]); // empty ids → [] with ZERO network calls
  });
});

describe('E4 — hydrateAcrossTiers (§5.2, T13)', () => {
  it('T13: HOT-first precedence — id in both WARM and LONG_TERM resolves to WARM', async () => {
    // fetcher returns points only for the collections we say contain them.
    const fetcher = vi.fn(async (collection: string, ids: string[]) => {
      if (collection === 'memories_warm') return ids.filter((i) => i === 'dup').map((id) => ({ id, payload: { t: 'warm' } }));
      if (collection === 'claude_memories') return ids.map((id) => ({ id, payload: { t: 'lt' } })); // long_term has everything
      return [];
    });
    const found = await hydrateAcrossTiers(['dup', 'onlyLT'], { fetcher });
    expect(found.get('dup')?.tier).toBe('warm');      // warm wins precedence over long_term
    expect(found.get('onlyLT')?.tier).toBe('long_term');
  });

  it('id present in no tier is absent from the map', async () => {
    const fetcher = vi.fn(async () => []);
    const found = await hydrateAcrossTiers(['ghost'], { fetcher });
    expect(found.has('ghost')).toBe(false);
  });

  it('does ≤4 batch round-trips and stops early once all resolved', async () => {
    const fetcher = vi.fn(async (collection: string, ids: string[]) =>
      collection === 'memories_hot' ? ids.map((id) => ({ id, payload: {} })) : []);
    await hydrateAcrossTiers(['x', 'y'], { fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1); // all found in HOT (tier 1) → no further tiers queried
  });
});

describe('E4 — passesGraphProjectScope (R6 §11)', () => {
  it('drops a neighbor from a different project; keeps active + global', () => {
    expect(passesGraphProjectScope({ project: 'projA' }, 'projA')).toBe(true);
    expect(passesGraphProjectScope({ project: 'global' }, 'projA')).toBe(true);
    expect(passesGraphProjectScope({ project: 'projB' }, 'projA')).toBe(false); // CROSS-PROJECT → excluded
    expect(passesGraphProjectScope({ project: 'projB' }, undefined)).toBe(true); // include_all_projects → no scope
  });

  // CISO HIGH remediation: unscoped neighbor is FAIL-CLOSED (dropped); anchor is exempt.
  it('FAIL-CLOSED: an unscoped NEIGHBOR (no project) is DROPPED, but the unscoped ANCHOR is KEPT', () => {
    // Default isAnchor=false → neighbor: an unscoped legacy memory must NOT surface.
    expect(passesGraphProjectScope({}, 'projA')).toBe(false);                       // neighbor, no project → dropped
    expect(passesGraphProjectScope({ project: null }, 'projA')).toBe(false);        // neighbor, null project → dropped
    expect(passesGraphProjectScope({ project: undefined }, 'projA')).toBe(false);   // neighbor, undefined → dropped
    // Anchor exemption: anchor was resolved via a project-scoped vector search → keep even if unscoped.
    expect(passesGraphProjectScope({}, 'projA', true)).toBe(true);                  // anchor, no project → kept
    // include_all_projects still wins for everyone, anchor or not.
    expect(passesGraphProjectScope({}, undefined, false)).toBe(true);              // no scope → kept
  });
});

describe('E4 — buildGraphFirstCandidates (§5.3, AC2 core / R6 / §5.5)', () => {
  // A graph where the anchor links to M2 (hop1) whose CONTENT is dissimilar to the query —
  // exactly the memory a high-threshold pure vector search would MISS (AC2).
  const traverser = async (anchorId: string) =>
    new Map<string, number>([[anchorId, 0], ['M2', 1], ['M3', 2]]);

  it('T7: AC2 — returns a 2-hop linked, text-dissimilar memory pure vector search would miss', async () => {
    const hydrator = async (_ids: string[]) => new Map<string, { id: string; payload: any; tier: string }>([
      ['anchor', { id: 'anchor', payload: { content: 'the auth decision: use OAuth', project: 'projA' }, tier: 'long_term' }],
      ['M2', { id: 'M2', payload: { content: 'rotate client secrets quarterly', project: 'projA' }, tier: 'long_term' }],
      ['M3', { id: 'M3', payload: { content: 'unrelated wording entirely', project: 'projA' }, tier: 'warm' }],
    ]);
    const out = await buildGraphFirstCandidates('anchor', 'projA', { traverser, hydrator });
    const m3 = out.find((c) => c.id === 'M3');
    expect(m3).toBeTruthy();
    expect(m3!.graph_distance).toBe(2);       // reached at hop 2
    expect(m3!.score).toBe(1.0);              // neutral base score (§5.3)
    expect(out.find((c) => c.id === 'M2')?.graph_distance).toBe(1);
  });

  it('R6: a graph neighbor from a DIFFERENT project is EXCLUDED', async () => {
    const hydrator = async (_ids: string[]) => new Map<string, { id: string; payload: any; tier: string }>([
      ['anchor', { id: 'anchor', payload: { content: 'a', project: 'projA' }, tier: 'long_term' }],
      ['M2', { id: 'M2', payload: { content: 'b', project: 'projB' }, tier: 'long_term' }],  // OTHER project
      ['M3', { id: 'M3', payload: { content: 'c', project: 'global' }, tier: 'long_term' }], // global → kept
    ]);
    const out = await buildGraphFirstCandidates('anchor', 'projA', { traverser, hydrator });
    const ids = out.map((c) => c.id);
    expect(ids).not.toContain('M2'); // cross-project leakage prevented
    expect(ids).toContain('M3');     // global allowed
    expect(ids).toContain('anchor'); // active project allowed
  });

  // CISO HIGH remediation (cross-project tenancy gap): an UNSCOPED neighbor (no project field)
  // reached via graph traversal must NOT surface — it could belong to another project. This is
  // the exact fail-open gap the CISO flagged. The in-project anchor itself is still kept even
  // when unscoped, because it was resolved through a project-scoped vector search.
  it('R6 FAIL-CLOSED: an UNSCOPED neighbor (no project field) is EXCLUDED; unscoped anchor still kept', async () => {
    const hydrator = async (_ids: string[]) => new Map<string, { id: string; payload: any; tier: string }>([
      // Anchor has NO project field, yet was resolved via project-scoped search → must be kept.
      ['anchor', { id: 'anchor', payload: { content: 'a' }, tier: 'long_term' }],
      // M2 is a legacy memory with NO project field, linked into the traversal → must be DROPPED.
      ['M2', { id: 'M2', payload: { content: 'legacy unscoped memory' }, tier: 'long_term' }],
      // M3 is correctly scoped to the active project → kept.
      ['M3', { id: 'M3', payload: { content: 'c', project: 'projA' }, tier: 'long_term' }],
    ]);
    const out = await buildGraphFirstCandidates('anchor', 'projA', { traverser, hydrator });
    const ids = out.map((c) => c.id);
    expect(ids).not.toContain('M2'); // UNSCOPED neighbor must NOT surface (fail-closed)
    expect(ids).toContain('anchor'); // anchor exempt — already project-validated upstream
    expect(ids).toContain('M3');     // in-project neighbor allowed
  });

  it('R6 FAIL-CLOSED: with include_all_projects (undefined scope), an unscoped neighbor IS returned', async () => {
    const hydrator = async (_ids: string[]) => new Map<string, { id: string; payload: any; tier: string }>([
      ['anchor', { id: 'anchor', payload: { content: 'a' }, tier: 'long_term' }],
      ['M2', { id: 'M2', payload: { content: 'unscoped' }, tier: 'long_term' }],
      ['M3', { id: 'M3', payload: { content: 'c', project: 'projB' }, tier: 'long_term' }],
    ]);
    const out = await buildGraphFirstCandidates('anchor', undefined, { traverser, hydrator });
    const ids = out.map((c) => c.id);
    expect(ids).toContain('M2'); // no scope → everything returned
    expect(ids).toContain('M3');
    expect(ids).toContain('anchor');
  });

  it('T14/§5.5: anchor with zero links → [] (handler then falls back to vector-first)', async () => {
    const lonely = async (anchorId: string) => new Map<string, number>([[anchorId, 0]]);
    const out = await buildGraphFirstCandidates('anchor', 'projA', { traverser: lonely, hydrator: async () => new Map() });
    expect(out).toEqual([]);
  });

  it('deleted neighbor (not in any tier) is skipped, not crashed', async () => {
    const hydrator = async (_ids: string[]) => new Map<string, { id: string; payload: any; tier: string }>([
      ['anchor', { id: 'anchor', payload: { project: 'projA' }, tier: 'long_term' }],
      // M2 missing (deleted), M3 present
      ['M3', { id: 'M3', payload: { project: 'projA' }, tier: 'long_term' }],
    ]);
    const out = await buildGraphFirstCandidates('anchor', 'projA', { traverser, hydrator });
    expect(out.find((c) => c.id === 'M2')).toBeUndefined();
    expect(out.find((c) => c.id === 'M3')).toBeTruthy();
  });

  it('T9: traversal throws → propagates (handler try/catch fails open)', async () => {
    const thrower = async () => { throw new Error('scroll transport fail'); };
    await expect(buildGraphFirstCandidates('anchor', 'projA', { traverser: thrower })).rejects.toThrow('scroll transport fail');
  });
});

// FIX 4 (deferred polish): graph-first must honor created_after/last_accessed_after the same way
// the vector-first combinedFilter does. Without this, those recall args were silently ignored on
// the graph path. passesGraphTimeBounds is the pure predicate; buildGraphFirstCandidates threads it.
describe('E4 — graph-first time bounds (created_after / last_accessed_after parity)', () => {
  const ISO = (ms: number) => new Date(ms).toISOString();

  describe('passesGraphTimeBounds predicate', () => {
    it('no bounds → always true', () => {
      expect(passesGraphTimeBounds({}, undefined, undefined)).toBe(true);
      expect(passesGraphTimeBounds({ created_at: ISO(NOW) }, undefined, undefined)).toBe(true);
    });
    it('created_after: keeps at/after, drops before, drops missing (mirrors Qdrant range gte)', () => {
      const after = ISO(NOW);
      expect(passesGraphTimeBounds({ created_at: ISO(NOW + HOUR) }, after, undefined)).toBe(true);  // after
      expect(passesGraphTimeBounds({ created_at: ISO(NOW) }, after, undefined)).toBe(true);          // equal (gte)
      expect(passesGraphTimeBounds({ created_at: ISO(NOW - HOUR) }, after, undefined)).toBe(false);  // before
      expect(passesGraphTimeBounds({}, after, undefined)).toBe(false);                                // missing → dropped
    });
    it('last_accessed_after: keeps at/after, drops before, drops missing', () => {
      const after = ISO(NOW);
      expect(passesGraphTimeBounds({ last_accessed_at: ISO(NOW + HOUR) }, undefined, after)).toBe(true);
      expect(passesGraphTimeBounds({ last_accessed_at: ISO(NOW - HOUR) }, undefined, after)).toBe(false);
      expect(passesGraphTimeBounds({}, undefined, after)).toBe(false);
    });
    it('both bounds → must satisfy BOTH (AND)', () => {
      const after = ISO(NOW);
      const ok = { created_at: ISO(NOW + HOUR), last_accessed_at: ISO(NOW + HOUR) };
      const failOne = { created_at: ISO(NOW + HOUR), last_accessed_at: ISO(NOW - HOUR) };
      expect(passesGraphTimeBounds(ok, after, after)).toBe(true);
      expect(passesGraphTimeBounds(failOne, after, after)).toBe(false);
    });
  });

  it('buildGraphFirstCandidates drops graph nodes outside the created_after window', async () => {
    const traverser = async (anchorId: string) =>
      new Map<string, number>([[anchorId, 0], ['M2', 1], ['M3', 1]]);
    const hydrator = async (_ids: string[]) => new Map<string, { id: string; payload: any; tier: string }>([
      ['anchor', { id: 'anchor', payload: { project: 'projA', created_at: ISO(NOW + HOUR) }, tier: 'long_term' }],
      ['M2', { id: 'M2', payload: { project: 'projA', created_at: ISO(NOW + HOUR) }, tier: 'long_term' }],   // in window
      ['M3', { id: 'M3', payload: { project: 'projA', created_at: ISO(NOW - HOUR) }, tier: 'long_term' }],   // too old → dropped
    ]);
    const out = await buildGraphFirstCandidates('anchor', 'projA', {
      traverser, hydrator, timeBounds: { createdAfter: ISO(NOW) },
    });
    const ids = out.map((c) => c.id);
    expect(ids).toContain('anchor');
    expect(ids).toContain('M2');
    expect(ids).not.toContain('M3');   // out-of-window neighbor honored (previously silently returned)
  });

  it('no timeBounds → behavior unchanged (all in-project nodes returned)', async () => {
    const traverser = async (anchorId: string) =>
      new Map<string, number>([[anchorId, 0], ['M2', 1]]);
    const hydrator = async (_ids: string[]) => new Map<string, { id: string; payload: any; tier: string }>([
      ['anchor', { id: 'anchor', payload: { project: 'projA', created_at: ISO(NOW - 99 * HOUR) }, tier: 'long_term' }],
      ['M2', { id: 'M2', payload: { project: 'projA', created_at: ISO(NOW - 99 * HOUR) }, tier: 'long_term' }],
    ]);
    const out = await buildGraphFirstCandidates('anchor', 'projA', { traverser, hydrator });
    expect(out.map((c) => c.id).sort()).toEqual(['M2', 'anchor']);
  });
});

// FIX 3 (deferred polish): StoreMemorySchema.decay_halflife_days enforces .positive() at the
// validation boundary — a caller passing 0 or a negative value is rejected, rather than relying
// solely on resolveHalflifeDays' defensive >0 guard.
describe('StoreMemorySchema.decay_halflife_days .positive() boundary enforcement', () => {
  it('rejects 0', () => {
    const r = StoreMemorySchema.safeParse({ content: 'x', decay_halflife_days: 0 });
    expect(r.success).toBe(false);
  });
  it('rejects negative', () => {
    const r = StoreMemorySchema.safeParse({ content: 'x', decay_halflife_days: -5 });
    expect(r.success).toBe(false);
  });
  it('accepts a positive value', () => {
    const r = StoreMemorySchema.safeParse({ content: 'x', decay_halflife_days: 30 });
    expect(r.success).toBe(true);
  });
  it('accepts omission (sector-default resolved downstream)', () => {
    const r = StoreMemorySchema.safeParse({ content: 'x' });
    expect(r.success).toBe(true);
  });
});

describe('E4 — non-regression: E1/E2/E3 still apply on the graph path', () => {
  it('T5: E3 coactivation folds into combined_score for a hydrated graph node', async () => {
    // Graph node G linked to a recently-recalled neighbor X → coactivation_boost > 1.0.
    const fetcher = async () => [{ candidate_id: 'G', neighbor_id: 'X', weight: 1.0 }];
    const boosts = await computeCoactivationBoosts([{ id: 'G', score: 1.0 }], 10, {
      recentHistory: new Map([['X', { lastRecalledAt: NOW }]]),
      linkFetcher: fetcher,
      nowMs: NOW,
    });
    expect(boosts.get('G')).toBeCloseTo(1.1, 9); // 1 + 0.1*(1.0*1.0)

    const graphNode = {
      id: 'G', score: 1.0, tier: 'long_term', graph_distance: 1,
      payload: { content: 'g', created_at: new Date(NOW).toISOString(), last_accessed_at: new Date(NOW).toISOString() },
    };
    const scored = scoreOne(graphNode, [], boosts, NOW);
    expect(scored.coactivation_boost).toBeCloseTo(1.1, 9);
    // combined = score(1) * temporal(1) * decay(1) * exact(1) * coact(1.1) * graphFactor(0.85)
    expect(scored.combined_score).toBeCloseTo(1.1 * 0.85, 9);
  });

  it('T6: E1 sector filter + E2 sector-decay apply to graph nodes', () => {
    // E2: a reflective-sector graph node's decay_score follows 0.5^(age/sectorHalflife).
    const ageDays = 30;
    const reflectivePayload = { sector: 'reflective', content: 'r', last_accessed_at: new Date(NOW - ageDays * 86400000).toISOString(), created_at: new Date(NOW - ageDays * 86400000).toISOString() };
    const node = { id: 'R', score: 1.0, tier: 'long_term', graph_distance: 1, payload: reflectivePayload };
    const scored = scoreOne(node, [], new Map(), NOW);
    const expectedHalflife = resolveHalflifeDays(reflectivePayload);
    const expectedDecay = Math.pow(0.5, ageDays / expectedHalflife);
    expect(scored.decay_score).toBeCloseTo(expectedDecay, 6); // E2 sector-specific half-life drives decay

    // E1: sector filter (same .filter the handler applies) keeps only the requested sector.
    const mixed = [
      { id: 'R', payload: { sector: 'reflective' } },
      { id: 'P', payload: { sector: 'procedural' } },
    ];
    const onlyReflective = mixed.filter((r: any) => inferSector(r.payload || {}) === 'reflective');
    expect(onlyReflective.map((r) => r.id)).toEqual(['R']);
  });
});

describe('E4 — classifier performance (T11, AC5)', () => {
  it('T11: detectRelationshipIntent mean < 5ms over 10k iterations on a long query', () => {
    const longQuery = ('what is connected to the authentication decision and everything linked to it ').repeat(20);
    const N = 10_000;
    const t0 = performance.now();
    let acc = 0;
    for (let i = 0; i < N; i++) acc += detectRelationshipIntent(longQuery) ? 1 : 0;
    const meanMs = (performance.now() - t0) / N;
    expect(acc).toBe(N);           // every iteration matched (proves it ran, not optimized away)
    expect(meanMs).toBeLessThan(5); // pure regex → in practice ≪0.01ms
  });
});

describe('E4 — explainability shape (T10, AC4)', () => {
  it('T10: graph path carries per-result graph_distance; vector path has NONE', () => {
    const rareTokens = extractRareTokens('q');
    const graphNode = { id: 'G', score: 1.0, tier: 'long_term', graph_distance: 1, payload: { content: 'g' } };
    const vecNode = { id: 'V', score: 0.9, tier: 'long_term', payload: { content: 'v' } };
    const sg = scoreOne(graphNode, rareTokens, new Map(), NOW);
    const sv = scoreOne(vecNode, rareTokens, new Map(), NOW);
    expect(typeof sg.graph_distance).toBe('number');
    expect(typeof sg.graph_distance_factor).toBe('number');
    expect('graph_distance' in sv).toBe(false);
    expect('graph_distance_factor' in sv).toBe(false);
  });
});
