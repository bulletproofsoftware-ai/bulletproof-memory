// Feature 3 — Self-Test Harness
// Spec: docs/specs/2026-07-02-openmemory-3-features-spec.md §3.6
//
// AC-7 (pre-sweep): seed an orphaned _selftest:true point in claude_memories, run
// the pre-sweep, confirm it is cleared. Gated on a reachable Qdrant with a key.
//
// The full dashboard / exit-code behavior (AC-1..AC-5, AC-8) is exercised by the
// live run captured in the PR evidence; this file covers the pre-sweep unit + a
// smoke of the presweep export.

import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { presweepSelftestPoints } from "../scripts/self-test.js";

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6334";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || "";

async function qdrantReachable(): Promise<boolean> {
  try {
    const r = await fetch(`${QDRANT_URL}/collections`, {
      headers: QDRANT_API_KEY ? { "api-key": QDRANT_API_KEY } : {},
    });
    return r.status === 200;
  } catch { return false; }
}

const HAVE_QDRANT = await qdrantReachable();

describe.runIf(HAVE_QDRANT)("AC-7 — MC0 pre-sweep clears orphaned _selftest points", () => {
  const headers: Record<string, string> = QDRANT_API_KEY
    ? { "Content-Type": "application/json", "api-key": QDRANT_API_KEY }
    : { "Content-Type": "application/json" };

  it("seeds an orphaned point, then pre-sweep removes it", async () => {
    // Embed dim probe.
    const info = await fetch(`${QDRANT_URL}/collections/claude_memories`, { headers }).then((r) => r.json());
    const dim: number = info?.result?.config?.params?.vectors?.size || 768;
    const vec = Array.from({ length: dim }, (_, i) => Math.sin(i) * 0.001);
    const orphanId = randomUUID();

    // Seed an orphaned _selftest point (simulates a prior hard-killed run).
    const put = await fetch(`${QDRANT_URL}/collections/claude_memories/points?wait=true`, {
      method: "PUT", headers,
      body: JSON.stringify({ points: [{ id: orphanId, vector: vec, payload: { content: `ORPHAN-${orphanId}`, _selftest: true, project: "self-test" } }] }),
    });
    expect(put.status).toBe(200);

    // Pre-sweep should clear >= 1 (our orphan, plus any other leftovers).
    const cleared = await presweepSelftestPoints();
    expect(cleared).toBeGreaterThanOrEqual(1);

    // Confirm the orphan is gone.
    const check = await fetch(`${QDRANT_URL}/collections/claude_memories/points`, {
      method: "POST", headers,
      body: JSON.stringify({ ids: [orphanId], with_payload: false, with_vector: false }),
    }).then((r) => r.json());
    expect((check?.result || []).length).toBe(0);

    // And a second pre-sweep now clears 0 (idempotent, self-healing complete).
    const clearedAgain = await presweepSelftestPoints();
    expect(clearedAgain).toBe(0);
  });
});

describe.skipIf(HAVE_QDRANT)("AC-7 pre-sweep (skipped — Qdrant unreachable)", () => {
  it("documents the skip", () => {
    expect(typeof presweepSelftestPoints).toBe("function");
  });
});
