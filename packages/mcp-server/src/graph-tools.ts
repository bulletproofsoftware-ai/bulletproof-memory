/**
 * Stage-final / Sub-task A: graph_* MCP tools, backed by docker-exec mgconsole.
 *
 * Why: neo4j-driver v5/v6 cannot authenticate against Memgraph 3.x community
 * in this configuration (Stage #12 partial). The migration scripts already
 * use the docker-exec mgconsole transport successfully — this file applies
 * the same transport to the MCP runtime.
 *
 * Public surface is identical to the previous neo4j-driver-backed version:
 *   graphStore, graphQuery, graphTraverse, graphNeighbors, graphPath,
 *   graphTimeTravel, closeDriver.
 *
 * Failure policy (CISO C-SA-D):
 *   - Reads return [] (or zero-row equivalent) on transport/parse failure,
 *     and log a console.warn with truncated reason. MCP server stays up.
 *   - Writes (graphStore) re-throw with a sanitized message.
 */
import {
  runMgconsole,
  parseTable,
  escapeStringLit,
  escapeNumericLit,
  sanitizeIdentifier,
  type ParsedValue,
  type NodeValue,
} from "./lib/mgconsole-parser.js";

/** Sentinel close — keeps the export so src/index.ts still compiles. */
export async function closeDriver(): Promise<void> {
  // No long-lived driver; nothing to close.
  return;
}

function isNode(v: ParsedValue): v is NodeValue {
  return typeof v === "object" && v !== null && (v as NodeValue).__type === "node";
}

function nodeProps(v: ParsedValue): Record<string, ParsedValue> {
  return isNode(v) ? (v as NodeValue).properties : {};
}

function logReadFailure(fn: string, error?: string): void {
  // C-SA-E: truncate error reason.
  const reason = (error || "unknown").slice(0, 400);
  // eslint-disable-next-line no-console
  console.warn(`[graph-tools][${fn}] mgconsole transport failed: ${reason}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// graphStore
// ─────────────────────────────────────────────────────────────────────────────

export async function graphStore(args: {
  node_type: string;
  node_id: string;
  properties?: Record<string, unknown>;
  edges?: Array<{ target_id: string; relationship: string; properties?: Record<string, unknown> }>;
}): Promise<{ node_id: string; edges_created: number }> {
  const validFrom = new Date().toISOString();
  const label = sanitizeIdentifier(args.node_type, "Node");
  const propsObj: Record<string, unknown> = { ...(args.properties || {}), node_id: args.node_id, valid_from: validFrom };
  const propsLit = formatPropertyMap(propsObj);

  const mergeNode =
    `MERGE (n:${label} {node_id: ${escapeStringLit(args.node_id)}}) SET n += ${propsLit} RETURN n.node_id AS id;`;
  const r1 = runMgconsole(mergeNode);
  if (!r1.ok) {
    throw new Error(`graphStore: MERGE node failed: ${(r1.error || "unknown").slice(0, 200)}`);
  }

  let edgesCreated = 0;
  if (args.edges) {
    for (const edge of args.edges) {
      const relType = sanitizeIdentifier(edge.relationship, "RELATED");
      const edgePropsObj: Record<string, unknown> = { ...(edge.properties || {}), valid_from: validFrom };
      const edgePropsLit = formatPropertyMap(edgePropsObj);
      const mergeEdge =
        `MATCH (a {node_id: ${escapeStringLit(args.node_id)}}), (b {node_id: ${escapeStringLit(edge.target_id)}}) ` +
        `MERGE (a)-[r:${relType}]->(b) SET r += ${edgePropsLit} RETURN type(r) AS t;`;
      const r2 = runMgconsole(mergeEdge);
      if (!r2.ok) {
        throw new Error(`graphStore: MERGE edge failed: ${(r2.error || "unknown").slice(0, 200)}`);
      }
      edgesCreated++;
    }
  }

  return { node_id: args.node_id, edges_created: edgesCreated };
}

/** Build a Cypher property-map literal `{key: value, ...}` from a plain object. */
function formatPropertyMap(props: Record<string, unknown>): string {
  const entries: string[] = [];
  for (const [k, v] of Object.entries(props)) {
    const key = sanitizeIdentifier(k, "");
    if (!key) continue; // skip keys that resolve to empty after sanitization
    if (v === null || v === undefined) {
      entries.push(`${key}: null`);
    } else if (typeof v === "number") {
      entries.push(`${key}: ${escapeNumericLit(v)}`);
    } else if (typeof v === "boolean") {
      entries.push(`${key}: ${v ? "true" : "false"}`);
    } else {
      entries.push(`${key}: ${escapeStringLit(String(v))}`);
    }
  }
  return `{${entries.join(", ")}}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// graphQuery
// ─────────────────────────────────────────────────────────────────────────────

export async function graphQuery(args: {
  query: string;
  parameters?: Record<string, unknown>;
}): Promise<Record<string, unknown>[]> {
  // CISO note: parameters CANNOT be cleanly passed through mgconsole CLI. If
  // the caller provides them, we substitute them by replacing $name tokens
  // with escaped literals. This mirrors how the migration scripts inline
  // values. The caller's `query` itself is passed through as-is (its trust
  // boundary is the LLM agent, same as with neo4j-driver).
  let cypher = args.query;
  if (args.parameters) {
    cypher = substituteParams(cypher, args.parameters);
  }
  if (!cypher.trim().endsWith(";")) cypher = cypher.trim() + ";";

  const r = runMgconsole(cypher);
  if (!r.ok) {
    logReadFailure("graphQuery", r.error);
    return [];
  }
  const parsed = parseTable(r.stdout);
  if (!parsed.ok) {
    logReadFailure("graphQuery", parsed.error);
    return [];
  }
  return parsed.rows as Record<string, unknown>[];
}

/** Replace $name with escaped literal. Only matches outside quoted strings. */
function substituteParams(cypher: string, params: Record<string, unknown>): string {
  // Build a regex that matches $word — but we must not substitute inside
  // string literals. Simplest robust approach: tokenize quote runs and only
  // substitute between them.
  let out = "";
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  while (i < cypher.length) {
    const c = cypher[i]!;
    if (c === "\\" && i + 1 < cypher.length) {
      out += c + cypher[i + 1]!;
      i += 2;
      continue;
    }
    if (c === "'" && !inDouble) {
      inSingle = !inSingle;
      out += c;
      i++;
      continue;
    }
    if (c === '"' && !inSingle) {
      inDouble = !inDouble;
      out += c;
      i++;
      continue;
    }
    if (c === "$" && !inSingle && !inDouble) {
      // Match identifier
      let j = i + 1;
      while (j < cypher.length && /[a-zA-Z0-9_]/.test(cypher[j]!)) j++;
      const name = cypher.slice(i + 1, j);
      if (name && Object.prototype.hasOwnProperty.call(params, name)) {
        const v = params[name];
        if (typeof v === "number") out += escapeNumericLit(v);
        else if (v === null || v === undefined) out += "null";
        else if (typeof v === "boolean") out += v ? "true" : "false";
        else out += escapeStringLit(String(v));
        i = j;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// graphTraverse
// ─────────────────────────────────────────────────────────────────────────────

export async function graphTraverse(args: {
  start_id: string;
  direction?: "outgoing" | "incoming" | "both";
  max_depth?: number;
  relationship_filter?: string;
}): Promise<{ nodes: Record<string, unknown>[]; edges: Record<string, unknown>[] }> {
  const depth = Math.max(1, Math.min(10, args.max_depth || 3));
  const dir = args.direction || "outgoing";
  const relFilter = args.relationship_filter
    ? `:${sanitizeIdentifier(args.relationship_filter, "RELATED")}`
    : "";

  // Memgraph variable-length: use BFS for both shortest-paths-style queries
  // and for general traversal. Use generic `[r:Type*1..N]` for outgoing/incoming.
  const startLit = escapeStringLit(args.start_id);
  const arrow =
    dir === "outgoing"
      ? `-[r${relFilter}*1..${depth}]->`
      : dir === "incoming"
      ? `<-[r${relFilter}*1..${depth}]-`
      : `-[r${relFilter}*1..${depth}]-`;

  const cypher =
    `MATCH p = (start {node_id: ${startLit}})${arrow}(end) ` +
    `RETURN nodes(p) AS nodes, relationships(p) AS edges LIMIT 100;`;

  const r = runMgconsole(cypher);
  if (!r.ok) {
    logReadFailure("graphTraverse", r.error);
    return { nodes: [], edges: [] };
  }
  const parsed = parseTable(r.stdout);
  if (!parsed.ok) {
    logReadFailure("graphTraverse", parsed.error);
    return { nodes: [], edges: [] };
  }

  const nodesMap = new Map<string, Record<string, unknown>>();
  const edgesList: Record<string, unknown>[] = [];

  for (const row of parsed.rows) {
    const nodeList = row.nodes;
    const edgeList = row.edges;
    if (Array.isArray(nodeList)) {
      for (const n of nodeList) {
        const props = nodeProps(n);
        const nid = props.node_id;
        if (typeof nid === "string") {
          nodesMap.set(nid, props as Record<string, unknown>);
        }
      }
    }
    if (Array.isArray(edgeList)) {
      // mgconsole serializes a relationship as e.g. `[:RELATED {strength: 0.8}]`
      // We get strings here from parseCell's fallback path. Convert minimally.
      for (const e of edgeList) {
        if (typeof e === "string" && e.startsWith("[") && e.endsWith("]")) {
          const t = e.match(/:([A-Za-z0-9_]+)/);
          edgesList.push({ type: t ? t[1]! : null, raw: e });
        } else if (isNode(e)) {
          // shouldn't happen for relationships, but be lenient
          edgesList.push({ properties: e.properties });
        } else {
          edgesList.push({ raw: e });
        }
      }
    }
  }

  return { nodes: Array.from(nodesMap.values()), edges: edgesList };
}

// ─────────────────────────────────────────────────────────────────────────────
// graphNeighbors
// ─────────────────────────────────────────────────────────────────────────────

export async function graphNeighbors(args: {
  node_id: string;
  direction?: "outgoing" | "incoming" | "both";
  relationship_filter?: string;
}): Promise<Array<{ node: Record<string, unknown>; relationship: string; direction: string }>> {
  const dir = args.direction || "both";
  const relFilter = args.relationship_filter
    ? `:${sanitizeIdentifier(args.relationship_filter, "RELATED")}`
    : "";
  const nodeLit = escapeStringLit(args.node_id);

  let cypher: string;
  if (dir === "outgoing") {
    cypher =
      `MATCH (a {node_id: ${nodeLit}})-[r${relFilter}]->(b) ` +
      `RETURN b AS node, type(r) AS relationship, 'outgoing' AS direction LIMIT 100;`;
  } else if (dir === "incoming") {
    cypher =
      `MATCH (a {node_id: ${nodeLit}})<-[r${relFilter}]-(b) ` +
      `RETURN b AS node, type(r) AS relationship, 'incoming' AS direction LIMIT 100;`;
  } else {
    cypher =
      `MATCH (a {node_id: ${nodeLit}})-[r${relFilter}]-(b) ` +
      `RETURN b AS node, type(r) AS relationship, ` +
      `CASE WHEN startNode(r) = a THEN 'outgoing' ELSE 'incoming' END AS direction LIMIT 100;`;
  }

  const r = runMgconsole(cypher);
  if (!r.ok) {
    logReadFailure("graphNeighbors", r.error);
    return [];
  }
  const parsed = parseTable(r.stdout);
  if (!parsed.ok) {
    logReadFailure("graphNeighbors", parsed.error);
    return [];
  }

  const out: Array<{ node: Record<string, unknown>; relationship: string; direction: string }> = [];
  for (const row of parsed.rows) {
    const node = nodeProps(row.node);
    const rel = typeof row.relationship === "string" ? row.relationship : String(row.relationship ?? "");
    const direction = typeof row.direction === "string" ? row.direction : String(row.direction ?? "");
    out.push({
      node: node as Record<string, unknown>,
      relationship: rel,
      direction,
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// graphPath
// ─────────────────────────────────────────────────────────────────────────────

export async function graphPath(args: {
  from_id: string;
  to_id: string;
  max_depth?: number;
}): Promise<{ found: boolean; length: number; nodes: Record<string, unknown>[]; relationships: string[] }> {
  const depth = Math.max(1, Math.min(10, args.max_depth || 6));
  const fromLit = escapeStringLit(args.from_id);
  const toLit = escapeStringLit(args.to_id);
  // Memgraph BFS variable-length is the supported shortest-path form here.
  const cypher =
    `MATCH p = (a {node_id: ${fromLit}})-[*BFS..${depth}]-(b {node_id: ${toLit}}) ` +
    `RETURN nodes(p) AS nodes, [r IN relationships(p) | type(r)] AS rels LIMIT 1;`;
  const r = runMgconsole(cypher);
  if (!r.ok) {
    logReadFailure("graphPath", r.error);
    return { found: false, length: 0, nodes: [], relationships: [] };
  }
  const parsed = parseTable(r.stdout);
  if (!parsed.ok) {
    logReadFailure("graphPath", parsed.error);
    return { found: false, length: 0, nodes: [], relationships: [] };
  }
  if (parsed.rows.length === 0) {
    return { found: false, length: 0, nodes: [], relationships: [] };
  }
  const row = parsed.rows[0]!;
  const nodes = Array.isArray(row.nodes) ? row.nodes : [];
  const rels = Array.isArray(row.rels) ? row.rels : [];
  const nodeProperties = nodes.map((n) => nodeProps(n) as Record<string, unknown>);
  const relStrings: string[] = rels
    .map((r2) => (typeof r2 === "string" ? r2 : String(r2 ?? "")))
    .filter((s) => s.length > 0);
  return {
    found: true,
    length: Math.max(0, nodeProperties.length - 1),
    nodes: nodeProperties,
    relationships: relStrings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// graphTimeTravel
// ─────────────────────────────────────────────────────────────────────────────

export async function graphTimeTravel(args: {
  node_id?: string;
  query?: string;
  as_of: string;
}): Promise<Record<string, unknown>[]> {
  if (!args.as_of || typeof args.as_of !== "string") {
    throw new Error("graphTimeTravel requires an as_of ISO8601 string");
  }
  if (args.query) {
    // CISO note: arbitrary Cypher with `as_of` substituted as a $as_of param.
    // We treat the user's query as trusted-from-agent (same as graphQuery).
    const cypher = substituteParams(args.query, { as_of: args.as_of });
    return graphQuery({ query: cypher });
  }
  if (args.node_id) {
    const nodeLit = escapeStringLit(args.node_id);
    const asOfLit = escapeStringLit(args.as_of);
    const cypher =
      `MATCH (n {node_id: ${nodeLit}}) ` +
      `WHERE n.valid_from <= ${asOfLit} AND (n.valid_to IS NULL OR n.valid_to > ${asOfLit}) ` +
      `RETURN n LIMIT 100;`;
    const r = runMgconsole(cypher);
    if (!r.ok) {
      logReadFailure("graphTimeTravel", r.error);
      return [];
    }
    const parsed = parseTable(r.stdout);
    if (!parsed.ok) {
      logReadFailure("graphTimeTravel", parsed.error);
      return [];
    }
    return parsed.rows.map((row) => {
      const n = row.n;
      return isNode(n) ? (n.properties as Record<string, unknown>) : (row as Record<string, unknown>);
    });
  }
  throw new Error("graphTimeTravel requires either node_id or query");
}
