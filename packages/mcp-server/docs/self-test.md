# Self-Test / Smoke Harness

`scripts/self-test.ts` — a runnable diagnostic that probes every live dependency of
the memory stack and reports **PASS / SKIP / FAIL** per check, grouped by category.

- **PASS** — the check succeeded.
- **SKIP** — an optional/not-configured service (e.g. no `N8N_API_KEY`, `OLLAMA_DISABLE=1`,
  non-macOS). A SKIP is **never** a failure.
- **FAIL** — a configured thing is broken.

**Exit code:** `0` iff there are no FAILs (SKIPs are fine); `1` if any FAIL; `2` on a
harness-level fatal.

**NEW in v1.1:** The governance category (`G1–G5`) tests the governance HTTP bridge, which now requires a dedicated `GOVERNANCE_API_KEY` environment variable (it no longer falls back to `QDRANT_API_KEY`). If the `governance` test shows FAIL, check that `GOVERNANCE_API_KEY` is set. See [DEPLOYMENT.md](DEPLOYMENT.md#breaking-change-governance_api_key-v11).

> **Canonical repo copy.** A readable mirror belongs in `Obsidian/Projects/claude-memory-mcp/`
> per the repo's docs-to-Obsidian rule. The repo copy is the source of truth.

## How to run

```bash
# All categories (reads config from env — see the daemon plist for the canonical set):
npm run self-test
# or:
npx tsx scripts/self-test.ts

# One category only:
npx tsx scripts/self-test.ts --category qdrant

# Machine-readable output (still prints the human dashboard too):
npx tsx scripts/self-test.ts --json
```

The harness reads **all** config from environment variables. When run outside the
launchd daemon's environment, export the relevant vars first (the daemon plist
`~/Library/LaunchAgents/com.claude.memory-tools-daemon.plist` is the canonical set;
`CLAUDE_MEMORY_PG_*`, `QDRANT_API_KEY`, etc. live there).

## Categories & checks (~24)

| Category | Checks |
|----------|--------|
| `qdrant` | Q1 reachable, Q2 correct-key accepted, Q3 wrong-key rejected |
| `postgres` | P1 connects, P2 schemas (`audit`,`memory`,`operational`), P3 tables (`audit.memory_health`, `memory.memories_cold`, `operational.audit_log`) |
| `memgraph` | M1 bolt reachable, M2 cypher returns result |
| `ollama` | O1 reachable, O2 configured model present |
| `mcp` | MC0 pre-sweep, MC1 embed, MC2 store, MC3 recall-top-hit, MC4 forget |
| `governance` | G1 health+key, G2 wrong-key 401, G3 tools/call recall, G4 wrong-key 401, G5 unknown-tool 400 |
| `launchd` (macOS) | L1 daemon running, L2 plist has PG env keys |
| `n8n` | N1 reachable, N2 DRM canary exists+active, N3 container timezone |

### MC category — production data path (self-healing)

The `mcp` category exercises the real **store → recall → forget** data path against the
**production** `claude_memories` Qdrant collection, tagged with a unique `_selftest:true`
marker + `project:"self-test"` so it never collides with real memories.

- **MC0 pre-sweep** (CISO Condition F): before MC1–MC4, every run clears any orphaned
  `_selftest:true` points left behind by a prior **hard-killed** run (SIGKILL/OOM between
  MC2 store and cleanup). This self-heals leftover test data at the start of every run,
  complementing the post-run `finally`-cleanup.
- A `finally` block also deletes the freshly-stored point even if MC3/MC4 assertions fail.

## CISO conditions covered

- **Condition E — password never logged.** The `launchd` L2 check greps the plist for the
  presence of the **KEY NAME** `<key>CLAUDE_MEMORY_PG_PASSWORD</key>` only; it never reads
  or prints the password **value**. QA verifies this by grepping the real PG password string
  against captured self-test stdout/stderr and confirming **zero matches** (verified at QA time).
- **Condition F — pre-sweep.** MC0 above.

## Environment variables

| Var | Default | Required | Notes |
|-----|---------|----------|-------|
| `QDRANT_URL` | `http://localhost:6334` | No | Qdrant endpoint |
| `QDRANT_API_KEY` | `""` | Yes (if Qdrant has auth) | API key for Qdrant |
| `OLLAMA_URL` / `OLLAMA_HOST` | `http://localhost:11434` | No | Embedding service |
| `OLLAMA_MODEL` | `nomic-embed-text` | No | Embedding model |
| `CLAUDE_MEMORY_PG_HOST/PORT/USER/DB/PASSWORD` | 127.0.0.1 / 5438 / — / — / — | Yes (all) | PostgreSQL credentials |
| `MEMGRAPH_URL` (or `MEMGRAPH_BOLT`) | `bolt://localhost:7687` | No | Graph DB endpoint |
| `MEMGRAPH_USER` / `MEMGRAPH_PASSWORD` | `""` | No | Graph auth (optional) |
| `GOVERNANCE_HTTP_PORT` | `5681` | No | HTTP bridge port |
| `GOVERNANCE_API_KEY` | **(required, no fallback)** | **Yes** | **NEW in v1.1** — API key for governance HTTP bridge. Does NOT fall back to `QDRANT_API_KEY`. Must be set to enable `/governance/*` endpoints. |
| `N8N_BASE_URL` / `WEBHOOK_URL` | `http://localhost:5679` | No | n8n endpoint |
| `N8N_API_KEY` | — (SKIP if absent) | No | n8n API key (test skipped if missing) |
| `N8N_DB_HOST/PORT/USER/DB/PASSWORD` | — | No | n8n database (fallback for N2 check) |
| `SELFTEST_EXPECTED_TZ` | `America/New_York` | No | n8n N3 check (container timezone) |

### Skip toggles

`OLLAMA_DISABLE=1`, `MEMGRAPH_DISABLE=1`, `N8N_DISABLE=1`, `SELFTEST_GOV_OPTIONAL=1`,
`SELFTEST_SKIP_DOCKER=1`.

## Related: Feature 2 recall-trace retention (CISO Condition D)

The recall-trace tables (`audit.recall_trace`, `audit.recall_trace_result`) persist recall
**query text**. Access to the COLD Postgres `audit` schema must not be broader than the
sensitivity of the underlying memories. A retention prune is provided:

```sql
SELECT audit.prune_recall_traces(90);  -- drop traces older than 90 days (CASCADE removes results)
```

Chosen retention: **90 days**. Note the forgotten-memory gap: `memory_forget` does not
cascade-delete a memory's ID from old `recall_trace_result` rows (analytics, not a live
index) — the prune eventually clears them. Documented in `001_recall_traces.sql`.
