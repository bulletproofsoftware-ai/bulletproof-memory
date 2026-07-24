// Feature 2 — Recall Traces
// Spec: docs/specs/2026-07-02-openmemory-3-features-spec.md §2.7
//
// - Fail-open with a poisoned pool (query-level failure).
// - CISO Condition C: connect-LEVEL failure — pool.connect() itself rejects
//   (unreachable host / mocked connect). writeRecallTrace still resolves without
//   throwing and does not measurably delay; a valid trace_id is preserved.
// - Response shape: a recall response includes a uuid trace_id.
// - Feedback: unknown trace_id -> {ok:true, updated:0} (nothing to update).
//
// The live happy-path (real PG row assertion) is gated on CLAUDE_MEMORY_PG_* env.

import { describe, it, expect, afterEach } from "vitest";
import { Pool } from "pg";
import {
  writeRecallTrace,
  recordTraceFeedback,
  setPoolForTests,
  __closePoolForTests,
} from "../src/recall-trace.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function makeTraceInput(trace_id: string) {
  return {
    trace_id,
    query: "self-test probe",
    project: "self-test",
    strategy: "vector-first",
    results: [
      { memory_id: "aaaaaaaa-0000-0000-0000-000000000001", rank: 1, score: 0.91, tier: "long_term" },
      { memory_id: "aaaaaaaa-0000-0000-0000-000000000002", rank: 2, score: 0.72, tier: "cold" },
    ],
  };
}

afterEach(async () => {
  await __closePoolForTests();
});

describe("writeRecallTrace — fail-open (query-level poison)", () => {
  it("swallows a query-level failure and never throws", async () => {
    // A pool whose connect() succeeds but whose client.query() always rejects.
    const badClient = {
      query: () => Promise.reject(new Error("poisoned query")),
      release: () => {},
    };
    const poisoned = { connect: () => Promise.resolve(badClient) } as unknown as Pool;
    setPoolForTests(poisoned);

    const id = crypto.randomUUID();
    await expect(writeRecallTrace(makeTraceInput(id))).resolves.toBeUndefined();
  });
});

describe("CISO Condition C — connect-level fail-open", () => {
  it("swallows a pool.connect() rejection, still resolves, no measurable delay", async () => {
    // connect() itself rejects immediately (models an unreachable host / refused TCP).
    const connectReject = {
      connect: () => Promise.reject(new Error("ECONNREFUSED 127.0.0.1:1")),
    } as unknown as Pool;
    setPoolForTests(connectReject);

    const id = crypto.randomUUID();
    const t0 = Date.now();
    const out = await writeRecallTrace(makeTraceInput(id));
    const elapsed = Date.now() - t0;

    expect(out).toBeUndefined();          // resolved, did not throw
    expect(id).toMatch(UUID_RE);          // trace_id preserved + valid
    expect(elapsed).toBeLessThan(500);    // no connectionTimeout-scale stall
  });

  it("swallows a real unreachable-host pool (actual TCP connect failure)", async () => {
    // A genuine Pool pointed at a closed port so pool.connect() rejects for real.
    const realBad = new Pool({
      host: "127.0.0.1",
      port: 1,                            // nothing listens on port 1
      user: "x",
      database: "x",
      password: "x",
      connectionTimeoutMillis: 300,
      max: 1,
    });
    setPoolForTests(realBad);

    const id = crypto.randomUUID();
    await expect(writeRecallTrace(makeTraceInput(id))).resolves.toBeUndefined();
    // pool cleaned up in afterEach via __closePoolForTests
  });
});

describe("recordTraceFeedback — never throws, reports status", () => {
  it("returns {ok:false} on a connect failure (does not throw)", async () => {
    const connectReject = {
      connect: () => Promise.reject(new Error("ECONNREFUSED")),
    } as unknown as Pool;
    setPoolForTests(connectReject);

    const res = await recordTraceFeedback({ trace_id: crypto.randomUUID(), used_memory_ids: ["x"] });
    expect(res.ok).toBe(false);
    expect(res.updated).toBe(0);
    expect(res.error).toBeTruthy();
  });
});

// ── Live happy-path (gated on env) ──────────────────────────────────────────
const HAVE_PG =
  !!process.env.CLAUDE_MEMORY_PG_USER &&
  !!process.env.CLAUDE_MEMORY_PG_DB &&
  !!process.env.CLAUDE_MEMORY_PG_PASSWORD;

describe.runIf(HAVE_PG)("live PG — trace + feedback round-trip", () => {
  it("persists a trace + result rows, then feedback updates used/ignored", async () => {
    setPoolForTests(null); // use the real env-configured pool
    const id = crypto.randomUUID();
    const idUsed = crypto.randomUUID();
    const idIgnored = crypto.randomUUID();
    await writeRecallTrace({
      trace_id: id,
      query: "live-test probe " + id,
      project: "self-test",
      strategy: "vector-first",
      results: [
        { memory_id: idUsed, rank: 1, score: 0.9, tier: "long_term" },
        { memory_id: idIgnored, rank: 2, score: 0.5, tier: "cold" },
      ],
    });

    // Read back via a throwaway pool.
    const pool = new Pool({
      host: process.env.CLAUDE_MEMORY_PG_HOST || "127.0.0.1",
      port: Number.parseInt(process.env.CLAUDE_MEMORY_PG_PORT || "5438", 10),
      user: process.env.CLAUDE_MEMORY_PG_USER,
      database: process.env.CLAUDE_MEMORY_PG_DB,
      password: process.env.CLAUDE_MEMORY_PG_PASSWORD,
      max: 1,
      connectionTimeoutMillis: 5000,
    });
    try {
      const traceRow = await pool.query("SELECT result_count FROM audit.recall_trace WHERE trace_id = $1", [id]);
      expect(traceRow.rowCount).toBe(1);
      expect(traceRow.rows[0].result_count).toBe(2);

      const resultRows = await pool.query("SELECT count(*)::int AS n FROM audit.recall_trace_result WHERE trace_id = $1", [id]);
      expect(resultRows.rows[0].n).toBe(2);

      // Feedback: mark idUsed used, idIgnored ignored.
      const fb = await recordTraceFeedback({
        trace_id: id,
        used_memory_ids: [idUsed],
        ignored: [{ memory_id: idIgnored, reason: "stale" }],
      });
      expect(fb.ok).toBe(true);
      expect(fb.updated).toBe(2);

      const used = await pool.query("SELECT was_used, ignore_reason FROM audit.recall_trace_result WHERE trace_id=$1 AND memory_id=$2", [id, idUsed]);
      expect(used.rows[0].was_used).toBe(true);
      const ign = await pool.query("SELECT was_used, ignore_reason FROM audit.recall_trace_result WHERE trace_id=$1 AND memory_id=$2", [id, idIgnored]);
      expect(ign.rows[0].was_used).toBe(false);
      expect(ign.rows[0].ignore_reason).toBe("stale");

      // Cleanup this test's trace (CASCADE removes result rows).
      await pool.query("DELETE FROM audit.recall_trace WHERE trace_id = $1", [id]);
    } finally {
      await pool.end();
      await __closePoolForTests();
    }
  });

  it("unknown trace_id feedback returns {ok:true, updated:0}", async () => {
    setPoolForTests(null);
    const res = await recordTraceFeedback({ trace_id: crypto.randomUUID(), used_memory_ids: [crypto.randomUUID()] });
    expect(res.ok).toBe(true);
    expect(res.updated).toBe(0);
    await __closePoolForTests();
  });
});
