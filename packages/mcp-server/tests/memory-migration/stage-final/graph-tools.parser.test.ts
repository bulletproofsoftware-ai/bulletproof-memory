/**
 * Sub-task A — mgconsole parser unit tests.
 * No docker, no network. Pure string-in, structured-out.
 */
import { describe, it, expect } from "vitest";
import {
  parseTable,
  parseCell,
  escapeStringLit,
  escapeNumericLit,
  sanitizeIdentifier,
} from "../../../src/lib/mgconsole-parser.js";

describe("Sub-task A — mgconsole-parser", () => {
  // P-01
  it("parses empty stdout as empty rows", () => {
    const r = parseTable("");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rows).toEqual([]);
  });

  // P-02
  it("parses single number cell", () => {
    const stdout = [
      "+------+",
      "| c    |",
      "+------+",
      "| 1158 |",
      "+------+",
      "",
    ].join("\n");
    const r = parseTable(stdout);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rows).toHaveLength(1);
      expect(r.rows[0]!.c).toBe(1158);
    }
  });

  // P-03
  it("parses single quoted-string cell", () => {
    const stdout = [
      "+---------+",
      "| rel     |",
      "+---------+",
      `| "RELATED" |`,
      "+---------+",
    ].join("\n");
    const r = parseTable(stdout);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rows[0]!.rel).toBe("RELATED");
    }
  });

  // P-04
  it("parses single node cell with multiple props", () => {
    const stdout = [
      "+----------------------------------------------------------------------------------+",
      "| n                                                                                |",
      "+----------------------------------------------------------------------------------+",
      `| (:Memory {node_id: "abc-123", valid_from: "2026-03-14T12:26:36.707371+00:00"})  |`,
      "+----------------------------------------------------------------------------------+",
    ].join("\n");
    const r = parseTable(stdout);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const n = r.rows[0]!.n;
      expect(n).toBeTruthy();
      // @ts-expect-error narrowing in test
      expect(n.__type).toBe("node");
      // @ts-expect-error narrowing in test
      expect(n.labels).toEqual(["Memory"]);
      // @ts-expect-error narrowing in test
      expect(n.properties.node_id).toBe("abc-123");
      // @ts-expect-error narrowing in test
      expect(n.properties.valid_from).toBe("2026-03-14T12:26:36.707371+00:00");
    }
  });

  // P-05
  it("parses multi-row multi-column mixed result", () => {
    const stdout = [
      "+-----+-----+-----+",
      "| a   | b   | c   |",
      "+-----+-----+-----+",
      "| 1   | 2   | 3   |",
      "| 4   | 5   | 6   |",
      "+-----+-----+-----+",
    ].join("\n");
    const r = parseTable(stdout);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rows).toHaveLength(2);
      expect(r.rows[0]).toEqual({ a: 1, b: 2, c: 3 });
      expect(r.rows[1]).toEqual({ a: 4, b: 5, c: 6 });
    }
  });

  // P-06
  it("detects error output", () => {
    const stdout = "Client received query exception: Error on line 1 position 11.";
    const r = parseTable(stdout);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Client received query exception");
  });

  // P-07
  it("parses quoted-string with internal escaped quote", () => {
    const cell = `"O\\'Brien"`;
    expect(parseCell(cell)).toBe(`O'Brien`);
    const cell2 = `"backslash: \\\\ here"`;
    expect(parseCell(cell2)).toBe("backslash: \\ here");
  });

  // P-08
  it("parses null cell", () => {
    expect(parseCell("null")).toBeNull();
    expect(parseCell("NULL")).toBeNull(); // case-insensitive
    expect(parseCell("")).toBeNull();
  });

  // P-09
  it("parses list/collection cell containing nodes", () => {
    const cell = `[(:Memory {node_id: "n1"}), (:Memory {node_id: "n2"})]`;
    const v = parseCell(cell);
    expect(Array.isArray(v)).toBe(true);
    if (Array.isArray(v)) {
      expect(v).toHaveLength(2);
      // @ts-expect-error narrowing
      expect(v[0].properties.node_id).toBe("n1");
      // @ts-expect-error narrowing
      expect(v[1].properties.node_id).toBe("n2");
    }
  });

  // P-10
  it("escapeStringLit — single quote", () => {
    expect(escapeStringLit("O'Brien")).toBe(`'O\\'Brien'`);
  });

  // P-11
  it("escapeStringLit — backslash", () => {
    expect(escapeStringLit("a\\b")).toBe("'a\\\\b'");
  });

  // P-12
  it("escapeStringLit — null and undefined → null literal", () => {
    expect(escapeStringLit(null)).toBe("null");
    expect(escapeStringLit(undefined)).toBe("null");
  });

  // P-13
  it("escapeStringLit — injection attempt is contained", () => {
    const attempt = `'); DROP ALL; //`;
    const escaped = escapeStringLit(attempt);
    // Must start and end with single quote (the literal wrappers).
    expect(escaped.startsWith("'")).toBe(true);
    expect(escaped.endsWith("'")).toBe(true);
    // Exact expected escape: each inner ' becomes \', so `');` becomes `\');`.
    expect(escaped).toBe(`'\\'); DROP ALL; //'`);
    // The unescaped sequence `'); DROP` (with bare single-quote) must NOT
    // appear in the output — every inner quote is preceded by `\`.
    // Drop the leading and trailing quote wrappers and confirm the inner
    // body contains no bare unescaped quote.
    const inner = escaped.slice(1, -1);
    // Replace all escaped quotes with a placeholder, then check no bare quote remains.
    const stripped = inner.replace(/\\'/g, "X");
    expect(stripped.includes("'")).toBe(false);
  });

  // P-14
  it("sanitizeIdentifier strips dangerous chars", () => {
    expect(sanitizeIdentifier("Memory'; DROP //", "Default")).toBe("MemoryDROP");
    expect(sanitizeIdentifier("related-to", "RELATED")).toBe("relatedto");
    expect(sanitizeIdentifier("", "RELATED")).toBe("RELATED");
    expect(sanitizeIdentifier(123, "RELATED")).toBe("RELATED"); // non-string
  });

  // P-15 — escapeNumericLit
  it("escapeNumericLit handles finite numbers and falls back to null", () => {
    expect(escapeNumericLit(42)).toBe("42");
    expect(escapeNumericLit(0.5)).toBe("0.5");
    expect(escapeNumericLit(NaN)).toBe("null");
    expect(escapeNumericLit(Infinity)).toBe("null");
    expect(escapeNumericLit("42")).toBe("null"); // strings → null
  });
});
