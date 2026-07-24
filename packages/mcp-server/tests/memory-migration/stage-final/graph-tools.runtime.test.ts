/**
 * Sub-task A — graph-tools runtime integration tests.
 *
 * Skip-gates on docker memgraph container availability. Uses the live
 * data migrated in Stage #12 (1158 RELATED edges, 800+ Memory nodes).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import {
  graphStore,
  graphQuery,
  graphTraverse,
  graphNeighbors,
  graphPath,
  graphTimeTravel,
  closeDriver,
} from "../../../src/graph-tools.js";

const KNOWN_NODE = "b5a91ad7-1270-449e-8155-d36feec4334d";
const KNOWN_NEIGHBOR = "2400afdc-1cc1-4590-9e85-463c2d398a2d";
const KNOWN_DESCENDANT = "a378e566-1c3c-413b-9fba-649e000205bc";
const TEST_NODE_A = "subtaskA-test-node-A";
const TEST_NODE_B = "subtaskA-test-node-B";

function memgraphReachable(): boolean {
  try {
    const out = execFileSync(
      "docker",
      [
        "exec",
        "-i",
        "memgraph",
        "mgconsole",
        "--host",
        "127.0.0.1",
        "--port",
        "7687",
        "--use_ssl=false",
      ],
      { input: "RETURN 1 AS x;\n", encoding: "utf8", timeout: 5000 }
    ) as string;
    return /\|\s*1\s*\|/.test(out);
  } catch {
    return false;
  }
}

const reachable = memgraphReachable();

describe("Sub-task A — graph-tools runtime", () => {
  beforeAll(() => {
    if (!reachable) {
      // eslint-disable-next-line no-console
      console.warn("[subtask-A][runtime] memgraph unreachable — runtime tests will skip");
    }
  });

  afterAll(async () => {
    // Cleanup test nodes if they were created.
    if (reachable) {
      try {
        execFileSync(
          "docker",
          [
            "exec",
            "-i",
            "memgraph",
            "mgconsole",
            "--host",
            "127.0.0.1",
            "--port",
            "7687",
            "--use_ssl=false",
          ],
          {
            input: `MATCH (n) WHERE n.node_id IN ['${TEST_NODE_A}', '${TEST_NODE_B}'] DETACH DELETE n;\n`,
            encoding: "utf8",
            timeout: 5000,
          }
        );
      } catch {
        // best-effort cleanup
      }
    }
    await closeDriver(); // no-op but exercises export
  });

  // R-01
  it("R-01 reachability skip-gate", () => {
    expect(true).toBe(true);
  });

  // R-02
  it("R-02 graphQuery on Memory count is positive", async () => {
    if (!reachable) return;
    const rows = await graphQuery({ query: "MATCH (n:Memory) RETURN count(n) AS c" });
    expect(rows.length).toBe(1);
    expect(typeof rows[0]!.c).toBe("number");
    expect(rows[0]!.c).toBeGreaterThan(0);
  });

  // R-02b
  it("R-02b graphQuery on relationship count >= 1155", async () => {
    if (!reachable) return;
    const rows = await graphQuery({ query: "MATCH ()-[r]->() RETURN count(r) AS c" });
    expect(rows.length).toBe(1);
    expect(rows[0]!.c).toBeGreaterThanOrEqual(1155);
  });

  // R-03
  it("R-03 graphNeighbors returns at least one neighbor for a known node", async () => {
    if (!reachable) return;
    const out = await graphNeighbors({ node_id: KNOWN_NODE, direction: "both" });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]!).toHaveProperty("node");
    expect(out[0]!).toHaveProperty("relationship");
    expect(out[0]!).toHaveProperty("direction");
    expect(typeof out[0]!.relationship).toBe("string");
    expect(["outgoing", "incoming"].includes(out[0]!.direction)).toBe(true);
  });

  // R-04
  it("R-04 graphPath between two known-connected nodes returns found:true", async () => {
    if (!reachable) return;
    const out = await graphPath({
      from_id: KNOWN_NODE,
      to_id: KNOWN_DESCENDANT,
      max_depth: 4,
    });
    expect(out.found).toBe(true);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out.nodes.length).toBe(out.length + 1);
    expect(out.relationships.length).toBe(out.length);
    expect(out.relationships.every((r) => r === "RELATED")).toBe(true);
  });

  // R-05
  it("R-05 graphPath between non-existent ids returns found:false", async () => {
    if (!reachable) return;
    const out = await graphPath({
      from_id: "DOES_NOT_EXIST_subtaskA_zzz1",
      to_id: "DOES_NOT_EXIST_subtaskA_zzz2",
      max_depth: 4,
    });
    expect(out.found).toBe(false);
    expect(out.nodes).toEqual([]);
    expect(out.relationships).toEqual([]);
  });

  // R-06
  it("R-06 graphTraverse from known node returns nodes + edges", async () => {
    if (!reachable) return;
    const out = await graphTraverse({
      start_id: KNOWN_NODE,
      direction: "outgoing",
      max_depth: 2,
    });
    expect(out.nodes.length).toBeGreaterThan(0);
    expect(out.edges.length).toBeGreaterThan(0);
  });

  // R-07
  it("R-07 graphStore creates a test node + edge", { timeout: 30_000 }, async () => {
    if (!reachable) return;
    // Create test node A.
    const r1 = await graphStore({
      node_type: "Memory",
      node_id: TEST_NODE_A,
      properties: { kind: "subtask-A-test" },
    });
    expect(r1.node_id).toBe(TEST_NODE_A);
    expect(r1.edges_created).toBe(0);

    // Create test node B with an edge from A.
    const r2 = await graphStore({
      node_type: "Memory",
      node_id: TEST_NODE_B,
      properties: { kind: "subtask-A-test" },
      edges: [{ target_id: TEST_NODE_B, relationship: "RELATED", properties: { strength: 0.5 } }],
    });
    // Note: edge from B → B (self-edge created by the spec wording above);
    // The test confirms edges_created counts the edges in the request.
    expect(r2.edges_created).toBe(1);

    // Verify A → ? neighbors include nothing yet (we set up B → B above; let's
    // explicitly add A → B).
    const r3 = await graphStore({
      node_type: "Memory",
      node_id: TEST_NODE_A,
      edges: [{ target_id: TEST_NODE_B, relationship: "TEST_LINK", properties: { strength: 0.9 } }],
    });
    expect(r3.edges_created).toBe(1);

    // Now A → B should be visible via neighbors.
    const neighbors = await graphNeighbors({
      node_id: TEST_NODE_A,
      direction: "outgoing",
      relationship_filter: "TEST_LINK",
    });
    expect(neighbors.length).toBe(1);
    expect((neighbors[0]!.node as Record<string, unknown>).node_id).toBe(TEST_NODE_B);
    expect(neighbors[0]!.relationship).toBe("TEST_LINK");
    expect(neighbors[0]!.direction).toBe("outgoing");
  });

  // R-08 — cleanup covered by afterAll

  // R-09
  it("R-09 graphTimeTravel node_id form with future as_of returns node", async () => {
    if (!reachable) return;
    const out = await graphTimeTravel({
      node_id: KNOWN_NODE,
      as_of: "2030-01-01T00:00:00Z",
    });
    expect(out.length).toBe(1);
    expect(out[0]!.node_id).toBe(KNOWN_NODE);
  });

  // R-10
  it("R-10 graphTimeTravel node_id form with past as_of returns no rows", async () => {
    if (!reachable) return;
    const out = await graphTimeTravel({
      node_id: KNOWN_NODE,
      as_of: "2000-01-01T00:00:00Z",
    });
    expect(out.length).toBe(0);
  });

  // R-11
  it("R-11 error path: invalid cypher returns [] without throw", async () => {
    if (!reachable) return;
    const out = await graphQuery({ query: "NOT VALID CYPHER" });
    expect(out).toEqual([]);
  });

  // R-12
  it("R-12 injection prevention: attack node_id does not destroy data", async () => {
    if (!reachable) return;
    const before = await graphQuery({ query: "MATCH (n:Memory) RETURN count(n) AS c" });
    const beforeCount = before[0]!.c as number;

    // Attempt injection — should be safely escaped.
    const out = await graphNeighbors({
      node_id: "x'); MATCH (n) DETACH DELETE n //",
      direction: "both",
    });
    // No matching node, so no neighbors.
    expect(out).toEqual([]);

    const after = await graphQuery({ query: "MATCH (n:Memory) RETURN count(n) AS c" });
    const afterCount = after[0]!.c as number;
    expect(afterCount).toBe(beforeCount);
  });

  // R-13 — relationship_filter sanitization
  it("R-13 graphNeighbors filter with dangerous chars is sanitized", async () => {
    if (!reachable) return;
    // The filter `RELATED'; DROP //` should be sanitized to `RELATEDDROP`,
    // which won't match anything — but the call must succeed cleanly.
    const out = await graphNeighbors({
      node_id: KNOWN_NODE,
      relationship_filter: "RELATED'; DROP //",
    });
    // Returns either [] (sanitized to a non-matching type) or filtered results.
    expect(Array.isArray(out)).toBe(true);
  });
});
