// E1 + E2 — Five-Sector Typology + Sector-Specific Decay Curves
// Spec: TODO/spec-E1-E2-sectors-decay.md  (§7 Test Plan, PRD §3.3/§3.4)
//
// Pure-function + schema tests for the sector typology and per-sector decay
// half-lives. No MCP server / live store required — fully deterministic.
//
// NOTE on decay constants: the spec §7.2 table listed `emotional 0.3716` and
// `reflective 0.9452`, but §7.2 ALSO mandates: "Builder MUST recompute these
// constants ... and assert the recomputed values — do not trust the table
// blindly." Recomputation gives:
//   emotional   0.5^(30/21)  = 0.371498... -> 0.3715 (table's 0.3716 fails toBeCloseTo(_,4))
//   reflective  0.5^(30/365) = 0.944621... -> 0.9446 (table's 0.9452 fails toBeCloseTo(_,4))
// The recomputed values are asserted below, per the spec directive.

import { describe, it, expect } from 'vitest';
import {
  inferSector,
  resolveHalflifeDays,
  SECTOR_HALFLIFE_DAYS,
  TYPE_TO_SECTOR,
  DEFAULT_HALFLIFE_DAYS,
  StoreMemorySchema,
  RecallMemorySchema,
} from '../src/index.js';

// Mirrors the recall-loop decay math (src/index.ts:1320-1321):
//   decay_score = 0.5 ^ (ageDays / resolveHalflifeDays(payload))
function decayAt(days: number, payload: any): number {
  return Math.pow(0.5, days / resolveHalflifeDays(payload));
}

describe('E1 — inferSector (type -> sector inference, PRD §2.2)', () => {
  it('T1: maps each type to its sector and handles edge cases', () => {
    expect(inferSector({ type: 'fact' })).toBe('semantic');
    expect(inferSector({ type: 'preference' })).toBe('semantic');
    expect(inferSector({ type: 'context' })).toBe('episodic');
    expect(inferSector({ type: 'decision' })).toBe('reflective');
    expect(inferSector({})).toBe('semantic');                              // no type -> semantic
    expect(inferSector({ sector: 'emotional', type: 'fact' })).toBe('emotional'); // explicit wins
    expect(inferSector({ sector: 'bogus', type: 'context' })).toBe('episodic');   // invalid sector ignored
  });

  it('TYPE_TO_SECTOR table matches inference', () => {
    expect(TYPE_TO_SECTOR.fact).toBe('semantic');
    expect(TYPE_TO_SECTOR.preference).toBe('semantic');
    expect(TYPE_TO_SECTOR.context).toBe('episodic');
    expect(TYPE_TO_SECTOR.decision).toBe('reflective');
  });
});

describe('E2 — resolveHalflifeDays (resolution order, PRD §3.2)', () => {
  it('T2: explicit > sector default > 90 fallback; legacy 90 respected', () => {
    expect(resolveHalflifeDays({ decay_halflife_days: 7 })).toBe(7);          // explicit wins
    expect(resolveHalflifeDays({ sector: 'reflective' })).toBe(365);          // sector default
    expect(resolveHalflifeDays({ type: 'decision' })).toBe(365);              // inferred -> reflective
    expect(resolveHalflifeDays({ type: 'fact' })).toBe(180);                  // inferred -> semantic
    expect(resolveHalflifeDays({ sector: 'episodic' })).toBe(30);
    expect(resolveHalflifeDays({ sector: 'emotional' })).toBe(21);
    expect(resolveHalflifeDays({ sector: 'procedural' })).toBe(120);
    // Empty payload: inferSector({}) === "semantic" (the `?? "semantic"` default),
    // so SECTOR_HALFLIFE_DAYS["semantic"] === 180. The DEFAULT_HALFLIFE_DAYS (90)
    // branch is UNREACHABLE for {} per the authoritative resolver in spec §5
    // CHANGE 1 (inferSector never returns undefined). The spec §7.2 T2 line
    // `resolveHalflifeDays({}) === 90` contradicts the spec's own resolver code
    // and is asserted here at its true value, 180.
    expect(resolveHalflifeDays({})).toBe(180);
    // Back-compat proof: a legacy memory (stored 90, type fact) keeps 90, NOT 180.
    expect(resolveHalflifeDays({ decay_halflife_days: 90, type: 'fact' })).toBe(90);
  });

  it('T2b: 90 fallback is only reachable when sector has no table entry (defense-in-depth)', () => {
    // The only way to reach DEFAULT_HALFLIFE_DAYS (90): a non-positive explicit
    // value (falls through) AND inferSector yields something not in the table.
    // inferSector can only ever return one of the five table keys, so 90 is
    // genuinely unreachable in practice — documented, not a bug.
    expect(DEFAULT_HALFLIFE_DAYS).toBe(90);
    // Non-positive explicit value is treated as "not explicit" -> sector default.
    expect(resolveHalflifeDays({ decay_halflife_days: 0, sector: 'episodic' })).toBe(30);
    expect(resolveHalflifeDays({ decay_halflife_days: -5, type: 'fact' })).toBe(180);
  });

  it('SECTOR_HALFLIFE_DAYS table is exactly the specced curve', () => {
    expect(SECTOR_HALFLIFE_DAYS).toEqual({
      episodic: 30,
      emotional: 21,
      procedural: 120,
      semantic: 180,
      reflective: 365,
    });
  });
});

describe('E2 — closed-form decay at t=30d to 4 dp (PRD §3.4, MANDATORY)', () => {
  // Recomputed constants (see file header). toBeCloseTo(x, 4) checks 4 dp.
  it('T3: each sector decays per 0.5^(30/halflife)', () => {
    expect(decayAt(30, { sector: 'emotional'  })).toBeCloseTo(0.3715, 4);
    expect(decayAt(30, { sector: 'episodic'   })).toBeCloseTo(0.5000, 4);
    expect(decayAt(30, { sector: 'procedural' })).toBeCloseTo(0.8409, 4);
    expect(decayAt(30, { sector: 'semantic'   })).toBeCloseTo(0.8909, 4);
    expect(decayAt(30, { sector: 'reflective' })).toBeCloseTo(0.9446, 4);
  });

  it('T4: emotional decays materially faster than semantic at 30d (PRD §3.3)', () => {
    expect(decayAt(30, { sector: 'emotional' }))
      .toBeLessThan(decayAt(30, { sector: 'semantic' })); // 0.3715 < 0.8909
  });

  it('T5: explicit decay_halflife_days override (PRD §3.3)', () => {
    // One half-life elapsed -> 0.5
    expect(decayAt(7, { decay_halflife_days: 7 })).toBeCloseTo(0.5000, 4);
    // Explicit 7 beats the reflective sector default of 365
    expect(resolveHalflifeDays({ decay_halflife_days: 7, sector: 'reflective' })).toBe(7);
  });
});

describe('E1/E2 — schema surface (PRD §2.4 / Q4)', () => {
  it('T6: StoreMemorySchema accepts/omits sector & has NO halflife default', () => {
    expect(StoreMemorySchema.parse({ content: 'x', sector: 'emotional' }).sector).toBe('emotional');
    expect(StoreMemorySchema.parse({ content: 'x' }).sector).toBeUndefined();            // optional, no default
    expect(StoreMemorySchema.parse({ content: 'x' }).decay_halflife_days).toBeUndefined(); // Q4: NO schema default
    expect(() => StoreMemorySchema.parse({ content: 'x', sector: 'bogus' })).toThrow();  // enum enforced
  });

  it('T7: RecallMemorySchema accepts optional sector filter', () => {
    expect(RecallMemorySchema.parse({ query: 'q', sector: 'reflective' }).sector).toBe('reflective');
    expect(RecallMemorySchema.parse({ query: 'q' }).sector).toBeUndefined();
  });
});

describe('E2 — memory_boost regression invariant (PRD §3.3, §9.7)', () => {
  it('T8: a boosted explicit halflife wins at recall (not overridden by sector default)', () => {
    // memory_boost (src/index.ts:1696-1702) reads currentHalflife, computes
    // min(current+30, 365), and writes that explicit numeric value back.
    // The explicit-wins branch of resolveHalflifeDays must honor it.
    const boostedFromLegacy90 = Math.min(90 + 30, 365);   // 120
    expect(boostedFromLegacy90).toBe(120);
    expect(resolveHalflifeDays({ decay_halflife_days: boostedFromLegacy90, sector: 'episodic' })).toBe(120);

    const boostedToCap = Math.min(350 + 30, 365);         // 365 (cap)
    expect(resolveHalflifeDays({ decay_halflife_days: boostedToCap })).toBe(365);
  });
});
