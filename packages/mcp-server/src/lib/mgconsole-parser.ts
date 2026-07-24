/**
 * Stage-final / Sub-task A: mgconsole transport + output parser for Memgraph.
 *
 * Why this exists: neo4j-driver v5/v6 cannot authenticate against Memgraph 3.x
 * community in this configuration. The migration scripts under
 * scripts/migrations/stage-12 already use this transport successfully — this
 * module brings the same approach to the MCP runtime.
 *
 * Security boundary (CISO C-SA-A):
 *  - We invoke `docker` with a FIXED argv array via execFileSync (no shell).
 *  - The Cypher query is passed via STDIN, never as a shell argument.
 *  - Any user-supplied string values inlined into generated Cypher MUST go
 *    through escapeStringLit. Identifier positions go through sanitizeIdentifier.
 */
import { execFileSync, type ExecFileSyncOptions } from "node:child_process";

const CONTAINER = process.env.MEMGRAPH_CONTAINER || "memgraph";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BUFFER = 8 * 1024 * 1024;

// ─────────────────────────────────────────────────────────────────────────────
// Transport
// ─────────────────────────────────────────────────────────────────────────────

export interface MgconsoleResult {
  ok: boolean;
  stdout: string;
  error?: string;
}

/**
 * Run a Cypher statement against the Memgraph container via mgconsole.
 *
 * Returns a structured result instead of throwing on container/query failure
 * so callers can decide between empty-result-vs-throw policy per call site
 * (CISO C-SA-D: read paths return [], write paths re-throw).
 */
export function runMgconsole(
  cypher: string,
  opts: { timeoutMs?: number; container?: string } = {}
): MgconsoleResult {
  const container = opts.container || CONTAINER;
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
  const options: ExecFileSyncOptions = {
    input: cypher.endsWith("\n") ? cypher : cypher + "\n",
    encoding: "utf8",
    maxBuffer: DEFAULT_MAX_BUFFER,
    timeout: timeoutMs,
    stdio: ["pipe", "pipe", "pipe"],
  };
  try {
    const stdout = execFileSync(
      "docker",
      [
        "exec",
        "-i",
        container,
        "mgconsole",
        "--host",
        "127.0.0.1",
        "--port",
        "7687",
        "--use_ssl=false",
      ],
      options
    ) as string;
    if (/Client received query exception|Failed query/i.test(stdout)) {
      // C-SA-E: truncate at 400 chars; this output is parsed (not bare query).
      return { ok: false, stdout, error: stdout.slice(0, 400) };
    }
    return { ok: true, stdout };
  } catch (e) {
    const msg = (e as Error).message || String(e);
    return { ok: false, stdout: "", error: msg.slice(0, 400) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Escape helpers (CISO C-SA-B, C-SA-C)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escape a value for inline use as a Cypher string literal.
 *  - null/undefined → bare `null` (Cypher null, not the string "null")
 *  - everything else → 'escaped' with backslash + single-quote escaped.
 */
export function escapeStringLit(v: unknown): string {
  if (v === null || v === undefined) return "null";
  const s = String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `'${s}'`;
}

/**
 * Escape a value for inline use as a Cypher numeric literal.
 * Non-finite values (NaN, Infinity, non-number) → `null`.
 */
export function escapeNumericLit(v: unknown): string {
  return typeof v === "number" && Number.isFinite(v) ? String(v) : "null";
}

/**
 * Sanitize a value for use in a Cypher label or relationship type position
 * (which cannot be parameterized or quoted). Strips everything outside
 * `[a-zA-Z0-9_]`. Falls back to the provided default if the result is empty.
 */
export function sanitizeIdentifier(v: unknown, fallback: string): string {
  const s = typeof v === "string" ? v : "";
  const cleaned = s.replace(/[^a-zA-Z0-9_]/g, "");
  return cleaned || fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────────────────────

export type ParsedValue = number | string | null | NodeValue | ListValue;
export interface NodeValue {
  __type: "node";
  labels: string[];
  properties: Record<string, ParsedValue>;
}
export type ListValue = ParsedValue[];

export type ParseResult =
  | { ok: true; rows: Array<Record<string, ParsedValue>> }
  | { ok: false; error: string };

/**
 * Parse mgconsole's ASCII-table output into structured rows.
 *
 * The format we accept (single-table output):
 *
 *   +-----+-----+
 *   | a   | b   |
 *   +-----+-----+
 *   | 1   | 2   |
 *   | 3   | 4   |
 *   +-----+-----+
 *
 * We tolerate:
 *  - Leading banner/log lines before the first +--- separator.
 *  - Trailing blank lines after the closing separator.
 *  - Variable column widths.
 *  - Empty result (header but no data rows).
 *
 * We do NOT recurse into nested structures inside a single cell — the cell
 * tokenizer handles atoms (number, quoted-string, null, node literal, list).
 */
export function parseTable(stdout: string): ParseResult {
  if (/Client received query exception|Failed query/i.test(stdout)) {
    return { ok: false, error: stdout.slice(0, 400) };
  }

  const lines = stdout.split("\n");
  // Find the first separator line.
  let i = 0;
  while (i < lines.length && !/^\+[-+]+\+$/.test(lines[i]!)) i++;
  if (i >= lines.length) {
    // No table at all — treat as empty result.
    return { ok: true, rows: [] };
  }
  // The next line should be the header row.
  const headerLine = lines[i + 1];
  if (!headerLine || !headerLine.startsWith("|")) {
    return { ok: true, rows: [] };
  }
  const headers = splitRow(headerLine);
  // The line after header is another separator.
  // Then data rows until another separator.
  const rows: Array<Record<string, ParsedValue>> = [];
  let j = i + 3;
  while (j < lines.length) {
    const line = lines[j]!;
    if (/^\+[-+]+\+$/.test(line)) break; // end of data
    if (!line || !line.startsWith("|")) {
      j++;
      continue;
    }
    const cells = splitRow(line);
    if (cells.length !== headers.length) {
      // mgconsole wraps long cells across multiple printed lines — we don't
      // currently handle wrapped output. For the Cypher we generate, cells fit
      // on one line. Skip malformed.
      j++;
      continue;
    }
    const row: Record<string, ParsedValue> = {};
    for (let k = 0; k < headers.length; k++) {
      row[headers[k]!] = parseCell(cells[k]!);
    }
    rows.push(row);
    j++;
  }
  return { ok: true, rows };
}

/** Split `| a | b | c |` into ['a', 'b', 'c'] preserving inner content. */
function splitRow(line: string): string[] {
  // Strip leading and trailing pipe.
  const inner = line.replace(/^\|/, "").replace(/\|$/, "");
  // Split on pipe boundaries — but pipes can appear inside quoted strings.
  // Strategy: scan char-by-char, tracking quote state.
  const cells: string[] = [];
  let buf = "";
  let inQuote = false;
  let depth = 0; // for {}, []
  for (let k = 0; k < inner.length; k++) {
    const c = inner[k]!;
    if (c === "\\" && k + 1 < inner.length) {
      buf += c + inner[k + 1]!;
      k++;
      continue;
    }
    if (c === '"') {
      inQuote = !inQuote;
      buf += c;
      continue;
    }
    if (!inQuote) {
      if (c === "{" || c === "[" || c === "(") depth++;
      else if (c === "}" || c === "]" || c === ")") depth--;
    }
    if (c === "|" && !inQuote && depth === 0) {
      cells.push(buf.trim());
      buf = "";
      continue;
    }
    buf += c;
  }
  cells.push(buf.trim());
  return cells;
}

/**
 * Parse a single cell value. Returns one of:
 *  - number
 *  - string (quoted-string with quotes stripped)
 *  - null
 *  - NodeValue (for `(:Label {key: value, ...})` literals)
 *  - ListValue (for `[item, item, ...]` literals)
 *
 * Anything we don't recognize is returned as the raw string (best-effort).
 */
export function parseCell(raw: string): ParsedValue {
  const s = raw.trim();
  if (s === "" || s.toLowerCase() === "null") return null;
  // Boolean — mgconsole prints `true`/`false`.
  if (s === "true") return "true";
  if (s === "false") return "false";
  // Number — must be entirely numeric.
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }
  // Quoted string.
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    return unquoteString(s);
  }
  // Node literal.
  if (s.startsWith("(") && s.endsWith(")")) {
    const node = parseNodeLiteral(s);
    if (node) return node;
  }
  // List literal.
  if (s.startsWith("[") && s.endsWith("]")) {
    const list = parseListLiteral(s);
    if (list) return list;
  }
  // Fallback — return as-is so caller can at least see it.
  return s;
}

function unquoteString(s: string): string {
  const inner = s.slice(1, -1);
  // Unescape backslash-escaped quotes and backslashes.
  let out = "";
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]!;
    if (c === "\\" && i + 1 < inner.length) {
      const next = inner[i + 1]!;
      if (next === '"' || next === "\\" || next === "'") {
        out += next;
        i++;
        continue;
      }
      // Other escapes: pass through literally.
      out += c + next;
      i++;
      continue;
    }
    out += c;
  }
  return out;
}

/** Parse `(:Label1:Label2 {key: value, key2: value2})` into NodeValue. */
function parseNodeLiteral(s: string): NodeValue | null {
  const inner = s.slice(1, -1).trim();
  // Pattern: optional :Label parts, optional { ... } property block.
  const propStart = inner.indexOf("{");
  let labelPart: string;
  let propPart: string | null = null;
  if (propStart >= 0) {
    labelPart = inner.slice(0, propStart).trim();
    const propEnd = inner.lastIndexOf("}");
    if (propEnd <= propStart) return null;
    propPart = inner.slice(propStart + 1, propEnd).trim();
  } else {
    labelPart = inner.trim();
  }
  const labels: string[] = [];
  for (const tok of labelPart.split(":")) {
    const t = tok.trim();
    if (t) labels.push(t);
  }
  const properties: Record<string, ParsedValue> = {};
  if (propPart) {
    for (const [k, v] of splitKvPairs(propPart)) {
      properties[k] = parseCell(v);
    }
  }
  return { __type: "node", labels, properties };
}

/** Parse `[a, b, c]` into ListValue. */
function parseListLiteral(s: string): ListValue | null {
  const inner = s.slice(1, -1).trim();
  if (!inner) return [];
  const tokens = splitTopLevel(inner, ",");
  return tokens.map((t) => parseCell(t.trim()));
}

/** Split `key: value, key2: value2` respecting quotes/braces. */
function splitKvPairs(input: string): Array<[string, string]> {
  const pairs = splitTopLevel(input, ",");
  const out: Array<[string, string]> = [];
  for (const pair of pairs) {
    const colonIdx = findTopLevelColon(pair);
    if (colonIdx < 0) continue;
    const k = pair.slice(0, colonIdx).trim();
    const v = pair.slice(colonIdx + 1).trim();
    if (k) out.push([k, v]);
  }
  return out;
}

/** Find the first colon NOT inside a quote or brace. */
function findTopLevelColon(s: string): number {
  let inQuote = false;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === "\\" && i + 1 < s.length) {
      i++;
      continue;
    }
    if (c === '"') inQuote = !inQuote;
    if (!inQuote) {
      if (c === "{" || c === "[" || c === "(") depth++;
      else if (c === "}" || c === "]" || c === ")") depth--;
      if (c === ":" && depth === 0) return i;
    }
  }
  return -1;
}

/** Split `a, b, c` respecting quotes and brace depth. */
function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inQuote = false;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === "\\" && i + 1 < s.length) {
      buf += c + s[i + 1]!;
      i++;
      continue;
    }
    if (c === '"') {
      inQuote = !inQuote;
      buf += c;
      continue;
    }
    if (!inQuote) {
      if (c === "{" || c === "[" || c === "(") depth++;
      else if (c === "}" || c === "]" || c === ")") depth--;
      if (c === sep && depth === 0) {
        out.push(buf);
        buf = "";
        continue;
      }
    }
    buf += c;
  }
  if (buf.trim()) out.push(buf);
  return out;
}
