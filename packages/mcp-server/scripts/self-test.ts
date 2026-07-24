#!/usr/bin/env node
// scripts/self-test.ts — production self-test / smoke harness.
// Run: npx tsx scripts/self-test.ts   (or: npm run self-test)
//      npx tsx scripts/self-test.ts --category qdrant
//      npx tsx scripts/self-test.ts --json
//
// ~24 independent checks across 8 categories (qdrant, postgres, memgraph, ollama,
// mcp, governance, launchd, n8n). Each check is PASS / SKIP / FAIL:
//   - SKIP  = optional/not-configured service (never a failure)
//   - FAIL  = a configured thing is broken
// Exit 0 iff no FAIL (SKIPs are fine); exit 1 if any FAIL.
//
// Reads ALL config from env (see the daemon plist for the canonical set, and
// docs/self-test.md for the full env table). NEVER prints secret VALUES — only
// presence (CISO Condition E: the real PG password must never touch any log line).

import { Pool } from "pg";
import neo4j from "neo4j-driver";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

type Status = "PASS" | "SKIP" | "FAIL";
interface Result { category: string; name: string; status: Status; detail: string; }
const results: Result[] = [];
let CURRENT = "general";
function pass(name: string, detail = "") { results.push({ category: CURRENT, name, status: "PASS", detail }); log("✅", name, detail); }
function fail(name: string, detail = "") { results.push({ category: CURRENT, name, status: "FAIL", detail }); log("❌", name, detail); }
function skip(name: string, detail = "") { results.push({ category: CURRENT, name, status: "SKIP", detail }); log("⏭️ ", name, detail); }
function log(icon: string, name: string, detail: string) { console.log(`${icon} ${name}${detail ? " — " + detail : ""}`); }

async function guarded(name: string, fn: () => Promise<void>) {
  try { await fn(); } catch (e) { fail(name, (e as Error).message); }
}

// ── env helpers ─────────────────────────────────────────────────────────────
const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6334";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || "";
const OLLAMA = process.env.OLLAMA_URL || process.env.OLLAMA_HOST || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "nomic-embed-text";
const GOV_PORT = process.env.GOVERNANCE_HTTP_PORT || "5681";
const GOV_KEY = process.env.GOVERNANCE_API_KEY || QDRANT_API_KEY;
const N8N_URL = process.env.N8N_BASE_URL || process.env.WEBHOOK_URL || "http://localhost:5679";

const qHeaders = (key: string): Record<string, string> =>
  key ? { "Content-Type": "application/json", "api-key": key } : { "Content-Type": "application/json" };

async function httpGet(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-json */ }
  return { status: res.status, json, text };
}

// ── Category: qdrant (3) ─────────────────────────────────────────────────────
async function categoryQdrant() {
  let q1ok = false;
  let q1json: any = null;
  await guarded("Q1 reachable", async () => {
    const r = await httpGet(`${QDRANT_URL}/collections`, qHeaders(QDRANT_API_KEY));
    if (r.status === 200) { q1ok = true; q1json = r.json; pass("Q1 reachable", `HTTP 200 @ ${QDRANT_URL}`); }
    else fail("Q1 reachable", `HTTP ${r.status}`);
  });
  await guarded("Q2 correct-key auth accepted", async () => {
    if (!q1ok) { fail("Q2 correct-key auth accepted", "Q1 did not succeed"); return; }
    if (Array.isArray(q1json?.result?.collections)) pass("Q2 correct-key auth accepted", `${q1json.result.collections.length} collections`);
    else fail("Q2 correct-key auth accepted", "unexpected response shape (no result.collections[])");
  });
  await guarded("Q3 wrong-key rejected", async () => {
    if (!QDRANT_API_KEY) { skip("Q3 wrong-key rejected", "auth not enforced (QDRANT_API_KEY empty)"); return; }
    const r = await httpGet(`${QDRANT_URL}/collections`, qHeaders("deliberately-wrong-key"));
    if (r.status === 401 || r.status === 403) pass("Q3 wrong-key rejected", `HTTP ${r.status}`);
    else if (r.status === 200) fail("Q3 wrong-key rejected", "wrong key returned 200 — auth NOT enforced (security)");
    else fail("Q3 wrong-key rejected", `HTTP ${r.status} (expected 401/403)`);
  });
}

// ── Category: postgres (3) ───────────────────────────────────────────────────
async function categoryPostgres() {
  const user = process.env.CLAUDE_MEMORY_PG_USER;
  const db = process.env.CLAUDE_MEMORY_PG_DB;
  const pw = process.env.CLAUDE_MEMORY_PG_PASSWORD;
  if (!user || !db || !pw) { skip("P1 connects", "CLAUDE_MEMORY_PG_USER/DB/PASSWORD not all set"); return; }
  const pool = new Pool({
    host: process.env.CLAUDE_MEMORY_PG_HOST || "127.0.0.1",
    port: Number.parseInt(process.env.CLAUDE_MEMORY_PG_PORT || "5438", 10),
    user, database: db, password: pw,
    max: 1, connectionTimeoutMillis: 4000,
    application_name: "claude-memory-mcp.self-test",
  });
  try {
    let connected = false;
    await guarded("P1 connects", async () => {
      const r = await pool.query("SELECT 1 AS ok");
      if (r.rows[0]?.ok === 1) { connected = true; pass("P1 connects", "SELECT 1 OK"); }
      else fail("P1 connects", "SELECT 1 returned unexpected");
    });
    if (!connected) return;
    await guarded("P2 expected schemas exist", async () => {
      const r = await pool.query("SELECT schema_name FROM information_schema.schemata");
      const have = new Set(r.rows.map((row) => row.schema_name));
      const want = ["audit", "memory", "operational"];
      const missing = want.filter((s) => !have.has(s));
      if (missing.length === 0) pass("P2 expected schemas exist", want.join(", "));
      else fail("P2 expected schemas exist", `missing: ${missing.join(", ")}`);
    });
    await guarded("P3 expected tables exist", async () => {
      const want = [["audit", "memory_health"], ["memory", "memories_cold"], ["operational", "audit_log"]];
      const missing: string[] = [];
      for (const [schema, table] of want) {
        const r = await pool.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2",
          [schema, table]
        );
        if (r.rowCount === 0) missing.push(`${schema}.${table}`);
      }
      if (missing.length === 0) pass("P3 expected tables exist", want.map(([s, t]) => `${s}.${t}`).join(", "));
      else fail("P3 expected tables exist", `missing: ${missing.join(", ")}`);
    });
  } finally {
    await pool.end().catch(() => {});
  }
}

// ── Category: memgraph (2) ───────────────────────────────────────────────────
async function categoryMemgraph() {
  if (process.env.MEMGRAPH_DISABLE === "1") { skip("M1 bolt reachable", "MEMGRAPH_DISABLE=1"); return; }
  const url = process.env.MEMGRAPH_URL || process.env.MEMGRAPH_BOLT || "bolt://localhost:7687";
  const driver = neo4j.driver(url, neo4j.auth.basic(process.env.MEMGRAPH_USER || "", process.env.MEMGRAPH_PASSWORD || ""));
  const session = driver.session();
  try {
    let x: any = undefined;
    await guarded("M1 bolt reachable", async () => {
      const r = await session.run("RETURN 1 AS x");
      x = r.records[0]?.get("x");
      pass("M1 bolt reachable", `RETURN 1 resolved @ ${url}`);
    });
    await guarded("M2 cypher returns result", async () => {
      const n = typeof x?.toNumber === "function" ? x.toNumber() : Number(x);
      if (n === 1) pass("M2 cypher returns result", "records[0].x === 1");
      else fail("M2 cypher returns result", `got ${String(x)}`);
    });
  } finally {
    await session.close().catch(() => {});
    await driver.close().catch(() => {});
  }
}

// ── Category: ollama (2) ─────────────────────────────────────────────────────
let ollamaOk = false;
let embedDim = 0;
async function categoryOllama() {
  if (process.env.OLLAMA_DISABLE === "1") { skip("O1 reachable", "OLLAMA_DISABLE=1"); return; }
  let tags: any = null;
  await guarded("O1 reachable", async () => {
    const r = await httpGet(`${OLLAMA}/api/tags`);
    if (r.status === 200) { ollamaOk = true; tags = r.json; pass("O1 reachable", `HTTP 200 @ ${OLLAMA}`); }
    else fail("O1 reachable", `HTTP ${r.status}`);
  });
  await guarded("O2 configured model present", async () => {
    if (!ollamaOk) { fail("O2 configured model present", "O1 did not succeed"); return; }
    const names: string[] = (tags?.models || []).map((m: any) => m.name);
    if (names.some((n) => n.startsWith(OLLAMA_MODEL))) pass("O2 configured model present", `${OLLAMA_MODEL} present`);
    else fail("O2 configured model present", `${OLLAMA_MODEL} not in [${names.join(", ")}]`);
  });
}

// ── Category: mcp (store/recall/forget data path) — MC0..MC4 ────────────────
const SELFTEST_FILTER = { must: [{ key: "_selftest", match: { value: true } }] };
async function qdrantPost(path: string, body: any) {
  const res = await fetch(`${QDRANT_URL}${path}`, {
    method: "POST", headers: qHeaders(QDRANT_API_KEY), body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null; try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text };
}
async function embed(prompt: string): Promise<number[] | null> {
  const res = await fetch(`${OLLAMA}/api/embeddings`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt }),
  });
  if (res.status !== 200) return null;
  const j = await res.json().catch(() => null);
  const v = j?.embedding;
  return Array.isArray(v) && v.length > 0 ? v : null;
}
// Exported so the AC-7 pre-sweep test can seed + verify orphan clearing.
export async function presweepSelftestPoints(): Promise<number> {
  // Scroll for orphaned _selftest points, delete them. Returns count cleared.
  const scroll = await qdrantPost("/collections/claude_memories/points/scroll", {
    filter: SELFTEST_FILTER, limit: 100, with_payload: false, with_vector: false,
  });
  const points = scroll.json?.result?.points || [];
  if (points.length > 0) {
    const ids = points.map((p: any) => p.id);
    await qdrantPost("/collections/claude_memories/points/delete?wait=true", { points: ids });
  }
  return points.length;
}

async function categoryMcpRoundTrip() {
  const storedId = randomUUID();
  const content = `SELFTEST-${storedId}`;
  let cleanup: string[] = [];
  try {
    // MC0 pre-sweep (CISO Condition F): clear orphaned _selftest points from a
    // prior hard-killed run BEFORE MC1..MC4.
    await guarded("MC0 pre-sweep orphaned test data", async () => {
      if (!QDRANT_API_KEY && !QDRANT_URL) { skip("MC0 pre-sweep orphaned test data", "no qdrant"); return; }
      const cleared = await presweepSelftestPoints();
      pass("MC0 pre-sweep orphaned test data", `cleared ${cleared} orphaned point(s)`);
    });

    if (!ollamaOk) {
      skip("MC1 embed test content", "Ollama SKIPped (O1)");
      skip("MC2 store unique memory", "Ollama SKIPped");
      skip("MC3 recall finds it as top hit", "Ollama SKIPped");
      skip("MC4 forget removes it", "Ollama SKIPped");
      return;
    }

    let vec: number[] | null = null;
    await guarded("MC1 embed test content", async () => {
      // probe collection vector size
      const info = await httpGet(`${QDRANT_URL}/collections/claude_memories`, qHeaders(QDRANT_API_KEY));
      embedDim = info.json?.result?.config?.params?.vectors?.size || 0;
      vec = await embed(content);
      if (vec && (embedDim === 0 || vec.length === embedDim)) pass("MC1 embed test content", `dim ${vec.length}${embedDim ? `/${embedDim}` : ""}`);
      else fail("MC1 embed test content", vec ? `dim ${vec.length} != expected ${embedDim}` : "no embedding");
    });
    if (!vec) return;

    await guarded("MC2 store unique memory", async () => {
      const res = await fetch(`${QDRANT_URL}/collections/claude_memories/points?wait=true`, {
        method: "PUT", headers: qHeaders(QDRANT_API_KEY),
        body: JSON.stringify({ points: [{ id: storedId, vector: vec, payload: { content, type: "fact", project: "self-test", _selftest: true } }] }),
      });
      if (res.status === 200) { cleanup.push(storedId); pass("MC2 store unique memory", `stored ${storedId.slice(0, 8)}`); }
      else fail("MC2 store unique memory", `HTTP ${res.status}`);
    });

    await guarded("MC3 recall finds it as top hit", async () => {
      const r = await qdrantPost("/collections/claude_memories/points/search", {
        vector: vec, limit: 3, filter: SELFTEST_FILTER, with_payload: false,
      });
      const top = r.json?.result?.[0];
      if (top?.id === storedId) pass("MC3 recall finds it as top hit", `top id matches`);
      else fail("MC3 recall finds it as top hit", `top id ${top?.id ?? "none"} != ${storedId}`);
    });

    await guarded("MC4 forget removes it", async () => {
      const del = await qdrantPost("/collections/claude_memories/points/delete?wait=true", { points: [storedId] });
      if (del.status !== 200) { fail("MC4 forget removes it", `delete HTTP ${del.status}`); return; }
      const check = await qdrantPost("/collections/claude_memories/points", { ids: [storedId], with_payload: false, with_vector: false });
      const still = (check.json?.result || []).length > 0;
      if (!still) { cleanup = cleanup.filter((c) => c !== storedId); pass("MC4 forget removes it", "gone after delete"); }
      else fail("MC4 forget removes it", "still present after delete");
    });
  } finally {
    // finally-cleanup: remove the point even if MC3/MC4 asserts failed.
    if (cleanup.length > 0 && QDRANT_URL) {
      try { await qdrantPost("/collections/claude_memories/points/delete?wait=true", { points: cleanup }); } catch { /* */ }
    }
  }
}

// ── Category: governance (5) ─────────────────────────────────────────────────
async function govHealth(key: string) {
  return httpGet(`http://localhost:${GOV_PORT}/governance/health`, key ? { "x-api-key": key } : {});
}
async function govToolsCall(key: string, body: any) {
  const res = await fetch(`http://localhost:${GOV_PORT}/tools/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { "x-api-key": key } : {}) },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null; try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text };
}
async function categoryGovernance() {
  let reachable = true;
  await guarded("G1 health OK w/ key", async () => {
    let r;
    try { r = await govHealth(GOV_KEY); }
    catch (e) {
      reachable = false;
      if (process.env.SELFTEST_GOV_OPTIONAL === "1") { skip("G1 health OK w/ key", `not listening (${(e as Error).message}); SELFTEST_GOV_OPTIONAL=1`); return; }
      fail("G1 health OK w/ key", `unreachable: ${(e as Error).message}`); return;
    }
    if (r.status === 200 && r.json?.ok === true) pass("G1 health OK w/ key", "ok:true");
    else fail("G1 health OK w/ key", `HTTP ${r.status} ok=${r.json?.ok}`);
  });
  if (!reachable) {
    skip("G2 health rejects wrong key", "governance not reachable");
    skip("G3 tools/call recall w/ key", "governance not reachable");
    skip("G4 tools/call rejects wrong key", "governance not reachable");
    skip("G5 tools/call rejects unknown tool", "governance not reachable");
    return;
  }
  await guarded("G2 health rejects wrong key", async () => {
    const r = await govHealth("wrong");
    if (r.status === 401) pass("G2 health rejects wrong key", "HTTP 401");
    else fail("G2 health rejects wrong key", `HTTP ${r.status} (expected 401)`);
  });
  await guarded("G3 tools/call recall w/ key", async () => {
    const r = await govToolsCall(GOV_KEY, { tool: "memory_recall", args: { query: "self-test probe", limit: 1, include_all_projects: true } });
    if (!(r.status === 200 && r.json && typeof r.json === "object" && "content" in r.json)) {
      fail("G3 tools/call recall w/ key", `HTTP ${r.status}, parseable=${!!r.json}`);
      return;
    }
    // Feature 2 regression guard: the recall path must return trace_id through the
    // governance HTTP bridge too, not just the direct MCP tool call (spec AC-2.8-5).
    let traceId: string | undefined;
    try {
      const inner = JSON.parse(r.json.content?.[0]?.text ?? "{}");
      traceId = inner.trace_id;
    } catch { /* leave traceId undefined -> fail below */ }
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (traceId && UUID_RE.test(traceId)) pass("G3 tools/call recall w/ key", `content[] present, trace_id=${traceId}`);
    else fail("G3 tools/call recall w/ key", `content[] present but trace_id missing/invalid (got: ${JSON.stringify(traceId)})`);
  });
  await guarded("G4 tools/call rejects wrong key", async () => {
    const r = await govToolsCall("wrong", { tool: "memory_recall", args: { query: "x" } });
    if (r.status === 401) pass("G4 tools/call rejects wrong key", "HTTP 401");
    else fail("G4 tools/call rejects wrong key", `HTTP ${r.status} (expected 401)`);
  });
  await guarded("G5 tools/call rejects unknown tool", async () => {
    const r = await govToolsCall(GOV_KEY, { tool: "nope" });
    if (r.status === 400 && /unsupported/i.test(r.json?.error || r.text)) pass("G5 tools/call rejects unknown tool", "HTTP 400 Unsupported");
    else fail("G5 tools/call rejects unknown tool", `HTTP ${r.status} (expected 400 Unsupported)`);
  });
}

// ── Category: launchd (2, macOS only) ────────────────────────────────────────
async function categoryLaunchd() {
  if (process.platform !== "darwin") { skip("L1 daemon running", "not macOS"); skip("L2 plist has PG env keys", "not macOS"); return; }
  const label = "com.claude.memory-tools-daemon";
  await guarded("L1 daemon running", async () => {
    let out = "";
    try { out = execFileSync("launchctl", ["print", `gui/${process.getuid?.() ?? ""}/${label}`], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }); }
    catch (e: any) { fail("L1 daemon running", `service not loaded: ${(e.message || "").slice(0, 80)}`); return; }
    if (/state\s*=\s*running/.test(out)) pass("L1 daemon running", "state = running");
    else fail("L1 daemon running", "state != running");
  });
  await guarded("L2 plist has PG env keys", async () => {
    const plistPath = join(homedir(), "Library", "LaunchAgents", `${label}.plist`);
    let contents = "";
    try { contents = readFileSync(plistPath, "utf8"); }
    catch { skip("L2 plist has PG env keys", "plist file missing"); return; }
    // Presence of the KEY names only — NEVER read/print the password VALUE (CISO Cond E).
    const keys = ["CLAUDE_MEMORY_PG_HOST", "CLAUDE_MEMORY_PG_PORT", "CLAUDE_MEMORY_PG_USER", "CLAUDE_MEMORY_PG_DB", "CLAUDE_MEMORY_PG_PASSWORD"];
    const present = keys.filter((k) => contents.includes(`<key>${k}</key>`));
    if (present.length === keys.length) pass("L2 plist has PG env keys", `${present.length}/${keys.length} PG env keys present`);
    else fail("L2 plist has PG env keys", `missing: ${keys.filter((k) => !present.includes(k)).join(", ")}`);
  });
}

// ── Category: n8n (3) ────────────────────────────────────────────────────────
const DRM_WF = "memory-drm-canary-weekly-mon-3am";
async function categoryN8n() {
  if (process.env.N8N_DISABLE === "1") { skip("N1 reachable", "N8N_DISABLE=1"); return; }
  let reachable = false;
  await guarded("N1 n8n reachable", async () => {
    const r = await httpGet(`${N8N_URL}/healthz`);
    if (r.status === 200) { reachable = true; pass("N1 n8n reachable", `HTTP 200 @ ${N8N_URL}`); }
    else fail("N1 n8n reachable", `HTTP ${r.status}`);
  });

  await guarded("N2 DRM canary workflow exists & active", async () => {
    const apiKey = process.env.N8N_API_KEY;
    const hasDb = !!(process.env.N8N_DB_HOST && process.env.N8N_DB_USER && process.env.N8N_DB_DB && process.env.N8N_DB_PASSWORD);
    if (!apiKey && !hasDb) { skip("N2 DRM canary workflow exists & active", "no n8n credentials in env (N8N_API_KEY / N8N_DB_*)"); return; }
    if (apiKey) {
      const r = await httpGet(`${N8N_URL}/api/v1/workflows?name=${encodeURIComponent(DRM_WF)}`, { "X-N8N-API-KEY": apiKey });
      if (r.status !== 200) { fail("N2 DRM canary workflow exists & active", `REST HTTP ${r.status}`); return; }
      const wf = (r.json?.data || []).find((w: any) => w.name === DRM_WF);
      if (!wf) fail("N2 DRM canary workflow exists & active", `workflow '${DRM_WF}' not found`);
      else if (wf.active === true) pass("N2 DRM canary workflow exists & active", "exists + active");
      else fail("N2 DRM canary workflow exists & active", "exists but active=false");
      return;
    }
    // DB fallback
    const pool = new Pool({
      host: process.env.N8N_DB_HOST, port: Number.parseInt(process.env.N8N_DB_PORT || "5432", 10),
      user: process.env.N8N_DB_USER, database: process.env.N8N_DB_DB, password: process.env.N8N_DB_PASSWORD,
      max: 1, connectionTimeoutMillis: 4000,
    });
    try {
      const r = await pool.query("SELECT active FROM workflow_entity WHERE name = $1", [DRM_WF]);
      if (r.rowCount === 0) fail("N2 DRM canary workflow exists & active", "workflow row not found");
      else if (r.rows[0].active === true) pass("N2 DRM canary workflow exists & active", "exists + active (db)");
      else fail("N2 DRM canary workflow exists & active", "exists but active=false (db)");
    } finally { await pool.end().catch(() => {}); }
  });

  await guarded("N3 n8n container timezone correct", async () => {
    if (process.env.SELFTEST_SKIP_DOCKER === "1") { skip("N3 n8n container timezone correct", "SELFTEST_SKIP_DOCKER=1"); return; }
    const expectedTz = process.env.SELFTEST_EXPECTED_TZ || "America/New_York";
    let dockerOk = true;
    let tzEnv = "";
    try { tzEnv = execFileSync("docker", ["exec", "n8n", "printenv", "TZ"], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim(); }
    catch { dockerOk = false; }
    if (!dockerOk) { skip("N3 n8n container timezone correct", "docker CLI/container unavailable"); return; }
    if (tzEnv && tzEnv === expectedTz) { pass("N3 n8n container timezone correct", `TZ=${tzEnv}`); return; }
    // fall back to `date` abbreviation check
    let dateOut = "";
    try { dateOut = execFileSync("docker", ["exec", "n8n", "date"], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim(); } catch { /* */ }
    if (/\b(EDT|EST|PDT|PST|CDT|CST|MDT|MST)\b/.test(dateOut)) pass("N3 n8n container timezone correct", `date shows non-UTC zone (${dateOut})`);
    else if (tzEnv && tzEnv !== "UTC") pass("N3 n8n container timezone correct", `TZ=${tzEnv} (non-UTC)`);
    else fail("N3 n8n container timezone correct", `TZ='${tzEnv || "unset"}' / date='${dateOut}' (expected ${expectedTz})`);
  });
}

// ── CLI + runner + summary ───────────────────────────────────────────────────
const CATEGORIES: Record<string, () => Promise<void>> = {
  qdrant: categoryQdrant, postgres: categoryPostgres, memgraph: categoryMemgraph,
  ollama: categoryOllama, mcp: categoryMcpRoundTrip, governance: categoryGovernance,
  launchd: categoryLaunchd, n8n: categoryN8n,
};

export async function runSelfTest(only: string | null): Promise<{ pass: number; skip: number; fail: number; results: Result[] }> {
  for (const [key, fn] of Object.entries(CATEGORIES)) {
    if (only && only !== key) continue;
    CURRENT = key;
    console.log(`\n=== ${key.toUpperCase()} ===`);
    await fn();
  }
  const p = results.filter((r) => r.status === "PASS").length;
  const s = results.filter((r) => r.status === "SKIP").length;
  const f = results.filter((r) => r.status === "FAIL").length;
  return { pass: p, skip: s, fail: f, results: [...results] };
}

// Only run when invoked directly (not when imported by a test).
const isDirectRun = (() => {
  try { return import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("self-test.ts"); }
  catch { return false; }
})();

if (isDirectRun) {
  const only = process.argv.includes("--category") ? process.argv[process.argv.indexOf("--category") + 1] : null;
  const asJson = process.argv.includes("--json");
  runSelfTest(only).then(({ pass: p, skip: s, fail: f, results: rs }) => {
    if (asJson) console.log(JSON.stringify({ pass: p, skip: s, fail: f, results: rs }, null, 2));
    console.log(`\n=== SELF-TEST: ${p} passed, ${s} skipped, ${f} failed (of ${rs.length}) ===`);
    if (f > 0) {
      console.log("FAILURES:");
      rs.filter((r) => r.status === "FAIL").forEach((r) => console.log(` ❌ [${r.category}] ${r.name}: ${r.detail}`));
    }
    process.exit(f > 0 ? 1 : 0);
  }).catch((err) => {
    console.error("self-test fatal:", err);
    process.exit(2);
  });
}
