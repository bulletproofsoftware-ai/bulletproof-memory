/**
 * Round-2 adversarial review regressions.
 *
 * Three corroborated HIGH findings:
 *
 *  1. advanced-memory.ts — syncCollections() retried the scoped scroll *without any
 *     filter* when it came back empty, exporting every memory in the collection
 *     (including `private`) to the peer instance.
 *  2. constitutional-inheritance.ts — createContract() skipped parent validation
 *     entirely when the named parent could not be resolved, so an unresolvable
 *     parent_id yielded an unconstrained contract at chain depth 0.
 *  3. iso42001.ts — generateComplianceReport() paginated with `gt: lastTimestamp`,
 *     dropping every other event sharing that timestamp (and assuming a
 *     timestamp ordering that Qdrant's scroll does not provide).
 */

import { describe, it, expect } from "vitest";

import { FederationManager, ADVANCED_COLLECTIONS } from "../src/advanced-memory.js";
import type { AdvancedMemoryDeps } from "../src/advanced-memory.js";
import { ConstitutionalInheritanceManager } from "../src/constitutional-inheritance.js";
import type {
  ConstitutionalInheritanceDeps,
  ConstitutionalConstraints,
} from "../src/constitutional-inheritance.js";
import { generateComplianceReport } from "../src/iso42001.js";
import type { AuditEvent } from "../src/iso42001.js";

// ---------------------------------------------------------------------------
// Finding 1 — federation scope failure leaks all memories
// ---------------------------------------------------------------------------

interface ScrollCall {
  collection: string;
  filter?: Record<string, unknown>;
  limit?: number;
}

function federationHarness(scrollResult: unknown[]) {
  const scrollCalls: ScrollCall[] = [];

  const deps: AdvancedMemoryDeps = {
    generateEmbedding: async () => [0.1, 0.2, 0.3],
    storePoint: async () => {},
    scrollPoints: async (collection, filter, limit) => {
      scrollCalls.push({ collection, filter, limit });
      if (collection === ADVANCED_COLLECTIONS.FEDERATION_REGISTRY) {
        return [
          {
            id: "local",
            payload: {
              federation_id: "local-fed",
              instance_name: "local",
              jurisdiction: "US",
              endpoint: "https://local.example",
            },
          },
        ];
      }
      return scrollResult;
    },
    searchPoints: async () => [],
    deletePoints: async () => {},
    updatePayload: async () => {},
    logAudit: async () => null,
    qdrantRequest: async () => ({}),
    generateUUID: () => "uuid-fixed",
    getPoint: async () => ({
      payload: {
        type: "federation_instance",
        federation_id: "remote-fed",
        instance_name: "remote",
        jurisdiction: "US",
        endpoint: "https://remote.example",
      },
    }),
    ollamaGenerate: async () => null,
  };

  return { deps, scrollCalls };
}

function memoryScrollCalls(calls: ScrollCall[]): ScrollCall[] {
  return calls.filter((c) => c.collection === "claude_memories");
}

describe("federation sync scope enforcement", () => {
  it("does not re-scroll unfiltered when the scoped scroll returns nothing", async () => {
    const { deps, scrollCalls } = federationHarness([]);
    const manager = new FederationManager(deps);

    await manager.syncCollections("remote-fed", "public");

    const memoryCalls = memoryScrollCalls(scrollCalls);
    expect(memoryCalls.length).toBe(1);
    // The old fallback issued a second scroll with `undefined` as the filter.
    for (const call of memoryCalls) {
      expect(call.filter).toBeDefined();
    }
  });

  it("never selects private or unlabelled memories for a public-scope sync", async () => {
    const { deps, scrollCalls } = federationHarness([]);
    const manager = new FederationManager(deps);

    await manager.syncCollections("remote-fed", "public");

    const filter = memoryScrollCalls(scrollCalls)[0].filter as {
      should: Array<Record<string, any>>;
    };
    const scopeValues = filter.should
      .filter((c) => c.key === "federation_scope")
      .map((c) => c.match.value);

    expect(scopeValues).toEqual(["public"]);
    expect(scopeValues).not.toContain("private");
    // Unlabelled memories default to the most restrictive level, so a public sync
    // must not ask for them either.
    expect(filter.should.some((c) => "is_empty" in c)).toBe(false);
  });

  it("includes unlabelled memories only when the caller asks for private scope", async () => {
    const { deps, scrollCalls } = federationHarness([]);
    const manager = new FederationManager(deps);

    await manager.syncCollections("remote-fed", "private");

    const filter = memoryScrollCalls(scrollCalls)[0].filter as {
      should: Array<Record<string, any>>;
    };
    expect(filter.should.some((c) => c.is_empty?.key === "federation_scope")).toBe(true);
  });

  it("does not send a private memory during a public-scope sync", async () => {
    // The scoped scroll matches nothing; a private memory sitting in the collection
    // is exactly what the old unfiltered retry would have exported.
    const { deps, scrollCalls } = federationHarness([]);
    let stored = 0;
    const spyingDeps: AdvancedMemoryDeps = {
      ...deps,
      storePoint: async () => {
        stored++;
      },
    };
    const manager = new FederationManager(spyingDeps);

    const result = await manager.syncCollections("remote-fed", "public");

    expect(result.memories_sent).toBe(0);
    expect(stored).toBe(0);
    expect(memoryScrollCalls(scrollCalls).length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Finding 2 — missing parent contract validation
// ---------------------------------------------------------------------------

const PERMISSIVE: ConstitutionalConstraints = {
  behavioral_rules: ["do anything"],
  data_classification_ceiling: "restricted",
  permitted_actions: ["read", "write", "delete", "exfiltrate"],
  prohibited_actions: [],
};

function inheritanceHarness(contracts: Record<string, Record<string, unknown>>) {
  const stored: Array<{ id: string; payload: Record<string, unknown> }> = [];

  const deps: ConstitutionalInheritanceDeps = {
    generateEmbedding: async () => [0.1, 0.2, 0.3],
    storePoint: async (_collection, id, _vector, payload) => {
      stored.push({ id, payload });
    },
    scrollPoints: async (_collection, filter) => {
      const wanted = (filter as any)?.must?.[0]?.match?.value as string | undefined;
      if (wanted && contracts[wanted]) {
        return [{ id: wanted, payload: contracts[wanted] }];
      }
      return [];
    },
    searchPoints: async () => [],
    deletePoints: async () => {},
    updatePayload: async () => {},
    logAudit: async () => null,
    qdrantRequest: async () => ({}),
    generateUUID: () => "child-uuid",
  };

  return { deps, stored };
}

describe("constitutional contract parent validation", () => {
  it("refuses to create a child contract when the parent cannot be resolved", async () => {
    const { deps, stored } = inheritanceHarness({});
    const manager = new ConstitutionalInheritanceManager(deps);

    await expect(
      manager.createContract("rogue-agent", "no-such-parent", PERMISSIVE, "strict"),
    ).rejects.toThrow(/parent contract no-such-parent not found/i);

    expect(stored).toHaveLength(0);
  });

  it("still enforces the constraint check when the parent does resolve", async () => {
    const { deps } = inheritanceHarness({
      "parent-1": {
        id: "parent-1",
        parent_id: null,
        agent_id: "parent-agent",
        constraints: JSON.stringify({
          behavioral_rules: [],
          data_classification_ceiling: "internal",
          permitted_actions: ["read"],
          prohibited_actions: ["delete"],
        }),
        inheritance_mode: "strict",
        conflict_resolution: "most_restrictive_wins",
        expiry: null,
        created_at: new Date().toISOString(),
        chain_depth: 0,
        constraint_hash: "hash",
      },
    });
    const manager = new ConstitutionalInheritanceManager(deps);

    await expect(
      manager.createContract("child-agent", "parent-1", PERMISSIVE, "strict"),
    ).rejects.toThrow(/child cannot exceed parent permissions/i);
  });

  it("creates a root contract normally when no parent is claimed", async () => {
    const { deps, stored } = inheritanceHarness({});
    const manager = new ConstitutionalInheritanceManager(deps);

    const contract = await manager.createContract("root-agent", null, PERMISSIVE, "strict");

    expect(contract.chain_depth).toBe(0);
    expect(contract.parent_id).toBeNull();
    expect(stored).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Finding 3 — pagination timestamp collision
// ---------------------------------------------------------------------------

const PAGE_SIZE = 1000;

function makeEvents(count: number, timestampFor: (i: number) => string): AuditEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `evt-${String(i).padStart(5, "0")}`,
    // Satisfies ISO 42001 control 5.2, whose event_count is what the assertions read.
    action: "recall",
    timestamp: timestampFor(i),
    session_id: "s",
    project: "p",
    sensitivity: "internal",
    details: {},
  }));
}

/**
 * Stand-in for the real deps closure: filters by the timestamp window, orders by
 * point id (which is what Qdrant's scroll actually does), and honours an
 * inclusive `offset` cursor.
 */
function scrollAuditLogFake(all: AuditEvent[]) {
  const seenFilters: Array<Record<string, unknown> | undefined> = [];

  const fn = async (
    filter?: Record<string, unknown>,
    limit?: number,
    offset?: string | number,
  ): Promise<AuditEvent[]> => {
    seenFilters.push(filter);
    const conditions = ((filter as any)?.must ?? []) as Array<any>;

    let rows = [...all].sort((a, b) => a.id.localeCompare(b.id));
    for (const cond of conditions) {
      if (cond.key !== "timestamp") continue;
      const range = cond.range ?? {};
      if (range.gte !== undefined) rows = rows.filter((r) => r.timestamp >= range.gte);
      if (range.gt !== undefined) rows = rows.filter((r) => r.timestamp > range.gt);
      if (range.lte !== undefined) rows = rows.filter((r) => r.timestamp <= range.lte);
      if (range.lt !== undefined) rows = rows.filter((r) => r.timestamp < range.lt);
    }

    if (offset !== undefined) {
      const start = rows.findIndex((r) => r.id === offset);
      rows = start === -1 ? [] : rows.slice(start);
    }

    return rows.slice(0, limit ?? 100);
  };

  return { fn, seenFilters };
}

/**
 * Runs a report over `all` and returns how many events control 5.2 actually saw —
 * i.e. how many of the seeded events survived pagination.
 */
async function countIngestedEvents(all: AuditEvent[]): Promise<number> {
  const { fn } = scrollAuditLogFake(all);
  const report = await generateComplianceReport(
    {
      period_start: "2026-01-01T00:00:00.000Z",
      period_end: "2026-12-31T23:59:59.999Z",
      controls: ["5.2"],
    },
    { scrollAuditLog: fn },
  );
  const control = report.controls.find((c) => c.control.id === "5.2");
  expect(control).toBeDefined();
  return control!.event_count;
}

describe("ISO 42001 compliance report pagination", () => {
  it("keeps every event when a page boundary lands inside one millisecond", async () => {
    // Every event in the second page-boundary cluster shares one timestamp: the
    // `gt: lastTimestamp` cursor discarded all but the first of them.
    const events = makeEvents(PAGE_SIZE + 500, (i) =>
      i < PAGE_SIZE - 1
        ? new Date(Date.UTC(2026, 2, 1, 0, 0, 0, 0) + i).toISOString()
        : "2026-03-01T12:00:00.000Z",
    );

    const total = await countIngestedEvents(events);
    expect(total).toBe(events.length);
  });

  it("keeps every event when ids and timestamps disagree on ordering", async () => {
    // Qdrant scroll orders by point id, so the last row of a page is not the
    // newest row of that page. A timestamp cursor skips everything in between.
    const events = makeEvents(PAGE_SIZE + 250, (i) =>
      new Date(Date.UTC(2026, 3, 1) + (PAGE_SIZE + 250 - i) * 1000).toISOString(),
    );

    const total = await countIngestedEvents(events);
    expect(total).toBe(events.length);
  });

  it("terminates and returns everything for a single short page", async () => {
    const events = makeEvents(12, (i) => new Date(Date.UTC(2026, 4, 1) + i * 1000).toISOString());

    const total = await countIngestedEvents(events);
    expect(total).toBe(12);
  });

  it("never widens the time window while paginating", async () => {
    const events = makeEvents(PAGE_SIZE + 10, (i) =>
      new Date(Date.UTC(2026, 5, 1) + i * 1000).toISOString(),
    );
    const { fn, seenFilters } = scrollAuditLogFake(events);

    await generateComplianceReport(
      { period_start: "2026-01-01T00:00:00.000Z", period_end: "2026-12-31T23:59:59.999Z" },
      { scrollAuditLog: fn },
    );

    expect(seenFilters.length).toBeGreaterThan(1);
    for (const filter of seenFilters) {
      const conditions = ((filter as any)?.must ?? []) as Array<any>;
      expect(conditions).toHaveLength(2);
      expect(conditions[0].range.gte).toBe("2026-01-01T00:00:00.000Z");
      expect(conditions[1].range.lte).toBe("2026-12-31T23:59:59.999Z");
    }
  });
});
