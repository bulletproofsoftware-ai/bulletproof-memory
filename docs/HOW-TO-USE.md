# How To Use — bulletproof-memory

Once the stack is running (see the [Install Guide](INSTALL.md)), this guide shows you how
to actually *use* the memory system day to day: connecting a client, storing and recalling
memories, browsing the dashboard, and the handful of tools you'll reach for most.

---

## The mental model

Memory is **tiered** and **semantic**:

- You **store** a memory (a fact, a decision, a preference, some context). It's embedded
  into a vector and placed in a tier.
- You **recall** by *meaning*, not exact keywords — "what did we decide about auth?" finds
  the relevant memory even if it never used the word "auth".
- Tiers move automatically: hot (recent/active) → warm → long-term, with a Postgres
  **cold** tier for full-text fallback. Scheduled workflows handle consolidation, decay,
  and promotion so you don't manage tiers by hand.

The MCP server exposes **75 tools**, but 90% of use is two of them: `memory_store` and
`memory_recall`.

---

## Connecting an MCP client

Add the server to any [MCP](https://modelcontextprotocol.io) client (Claude Desktop,
Claude Code, or your own). Point it at the built server and your running backends:

```json
{
  "mcpServers": {
    "bulletproof-memory": {
      "command": "node",
      "args": ["/absolute/path/to/bulletproof-memory/packages/mcp-server/dist/index.js"],
      "env": {
        "QDRANT_URL": "http://localhost:6334",
        "OLLAMA_URL": "http://localhost:11434"
      }
    }
  }
}
```

Restart the client; the memory tools appear. (If you ran the turnkey stack, the server is
also running in Docker — this config runs a second, client-attached stdio instance
sharing the same Qdrant/Ollama. That's expected and fine.)

### Claude Code hooks (optional)

For automatic session recall/capture in Claude Code, install the bundled hooks:

```bash
bash integrations/claude-code/install-hooks.sh
```

See [`integrations/claude-code/README.md`](../integrations/claude-code/README.md) for what
each hook does.

---

## The two tools you need first

### Store a memory

```
memory_store(
  content: "The team decided to standardize on Apache-2.0 for all public repos.",
  type: "decision",
  tags: ["licensing", "oss"],
  project: "bulletproof"
)
```

`type` is a free-form label you choose (`fact`, `decision`, `preference`, `context`,
`procedure`, …). `project` scopes the memory so recall can filter to one project.

### Recall a memory

```
memory_recall(
  query: "what license did we pick for open source?",
  limit: 5,
  project: "bulletproof"     // optional filter
)
```

Recall searches the vector tiers first, falls back to the Postgres cold tier, and
**promotes** any cold hit back to a warm tier so it's fast next time. Results come back
ranked with scores.

---

## Everyday tasks

| I want to… | Tool | Notes |
|------------|------|-------|
| Save something to remember | `memory_store` | The everyday write. |
| Find something by meaning | `memory_recall` | The everyday read. |
| Keep a memory from being pruned | `pin_memory` | Sets `pinned=true`; the weekly pruning/decay workflows skip it. |
| Delete a wrong/stale memory | `memory_forget` | Two-step: search, then delete with `confirm:true`. |
| Store a rich, multi-step episode | `episode` | Relational episode records (not just flat memories). |
| Link two related memories | `graph_store` / `graph_neighbors` | Builds/queries the Memgraph `RELATED` graph. |
| Record a reusable procedure | `procedure` / `trajectory` | For repeatable how-tos mined from successful runs. |
| Check where a memory came from | `memory_provenance` | Provenance + confirmation status. |

The complete catalog — all 75 tools with parameters — is in the MCP server's
[`docs/MCP-TOOLS.md`](../packages/mcp-server/docs/MCP-TOOLS.md).

---

## Using the dashboard

Open **http://localhost:8092** (log in with `DASHBOARD_USER` / your password). The
dashboard is a read-and-explore UI over the same backends the MCP server writes to:

- **Browse & search** memories across tiers.
- **Visualize** tier distribution and memory-link graphs.
- **Inspect** episodes, session transcripts, and audit events.
- **Monitor** the health of the scheduled workflows and backends.

Nothing you do in an MCP client is hidden from the dashboard — they share Qdrant and
Postgres.

---

## What runs on a schedule

You don't have to trigger maintenance manually. After install, 34 n8n workflows run on
schedules (encoded in each workflow's filename) inside the n8n container — no host cron,
so it's identical on macOS, Linux, and Windows. Examples:

- **Daily:** contradiction check, exact-dedup, TTL sweep, hippocampal consolidation,
  tier transfer, integrity verify.
- **Weekly:** hot-tier rehydration, re-clustering, active pruning, DRM canary, red-team
  scan, formal-verify sweep.

The full schedule and the purpose of every workflow is documented in
[`docs/operations.md`](operations.md). You can pause or edit any of them in the n8n UI.

---

## A quick end-to-end check

```bash
# 1. In your MCP client, store then recall:
#    memory_store(content:"Ports default to 6334/5432/11434", type:"fact")
#    memory_recall(query:"which ports does the memory stack use")
#
# 2. Confirm it landed in Qdrant:
curl -s -H "api-key: $(grep '^QDRANT_API_KEY=' .env | cut -d= -f2)" \
  http://localhost:6334/collections | python3 -m json.tool

# 3. See it in the dashboard:
open http://localhost:8092    # (macOS; use your browser otherwise)
```

If store→recall round-trips and the memory shows in the dashboard, you're fully wired.

---

Apache-2.0 © 2026 bulletproofsoftware-ai. See [LICENSE](../LICENSE) and [NOTICE](../NOTICE).
