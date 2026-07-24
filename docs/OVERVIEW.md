# Comprehensive Overview — bulletproof-memory

A complete, self-hostable **memory system for AI agents**: durable, semantic, tiered
recall that runs entirely on your own infrastructure. This document is the conceptual and
architectural reference — what the system is, why it's built this way, and how the pieces
fit together.

- **New here?** → [Install Guide](INSTALL.md) then [How To Use](HOW-TO-USE.md)
- **Running it in production?** → [Administrator Guide](ADMINISTRATOR.md)
- **Security posture?** → [Scan Report](scan/scan-report.md) · [SBOM](SBOM.md)

---

## The problem it solves

LLM agents are stateless between sessions. Everything an agent "knew" — decisions,
preferences, prior context, hard-won facts — evaporates when the conversation ends.
Bolting a plain vector database on top helps, but naively storing every embedding grows
unbounded, floods recall with near-duplicates, and has no notion of what matters now
versus what mattered months ago.

`bulletproof-memory` treats agent memory the way a memory *system* should: **tiered**
storage that mirrors hot/warm/cold access patterns, **semantic** recall by meaning,
**scheduled consolidation** that keeps the active set small and relevant, and
**governance/provenance** so you can trust what's stored. It's delivered as an
[MCP](https://modelcontextprotocol.io) server so any MCP-capable agent can use it, plus a
dashboard and the maintenance automation that keeps it healthy.

---

## What's in the repository

| Path | What it is |
|------|------------|
| [`packages/mcp-server/`](../packages/mcp-server/) | The MCP server (TypeScript): `memory_store` / `memory_recall` and 75 tools over Qdrant + Postgres |
| [`packages/dashboard/`](../packages/dashboard/) | FastAPI web dashboard to browse, search, and visualize memory |
| [`workflows/`](../workflows/) | 34 scheduled n8n workflows (consolidation, decay, tier-transfer, DRM canary, dedup, …) |
| [`init/`](../init/) | Qdrant/Postgres initialization scripts (collections, indexes, governance schema, transcripts) |
| [`integrations/claude-code/`](../integrations/claude-code/) | Optional Claude Code hooks (session recall/capture) |
| `docker-compose.yml`, `install.sh` | The turnkey stack — one clone, one command |

---

## The tiered memory model

Memory is organized into tiers backed by different stores, each suited to a different
access pattern:

| Tier | Store | Purpose |
|------|-------|---------|
| **Hot / Warm / Short-term / Long-term** | Qdrant (vectors) | Semantic recall over the active pool. Kept small so every query has low competitor density. |
| **Cold** | Postgres (FTS + trigram) | Full-text fallback for anything aged out of the vector pool. |
| **Episodes / Transcripts / Audit** | Postgres (relational) | Rich structured records: multi-step episodes, session transcripts (searchable), and the audit trail. |
| **Links** *(optional)* | Memgraph | A `RELATED` graph between memories for traversal queries. |

**Recall flow:** a query searches the vector tiers first; on a miss it falls back to the
Postgres cold tier; a cold hit is re-embedded and **promoted** back to a warm tier so it's
fast next time. This keeps the hot pool lean (better recall precision) without losing
long-tail knowledge.

---

## The backends

| Backend | Role | Why |
|---------|------|-----|
| **Qdrant** | Vector store for the semantic tiers | Fast approximate-NN search with payload filtering and per-collection API-key auth. |
| **PostgreSQL** | Cold tier + relational data + n8n store | `tsvector` + `pg_trgm` hybrid search; rich schema for episodes/transcripts; battle-tested durability. |
| **Ollama** | Local embeddings (`nomic-embed-text`, 768-dim) | Embeddings never leave your machine — no external API calls for the core store/recall path. |
| **n8n** | Runs the scheduled maintenance workflows | Cross-platform scheduling inside a container (no host cron/launchd); visual, pausable, auditable. |
| **Memgraph** *(optional)* | Memory-link graph | Graph traversal over `RELATED` edges when you need it; skippable if you don't. |

---

## The MCP server

The server exposes **75 tools**, but everyday use is two of them:

- **`memory_store`** — write a memory (content + type + optional tags/project).
- **`memory_recall`** — semantic search across all tiers, with cold-tier fallback and
  promotion.

The rest build on those: `pin_memory` (protect from pruning), `memory_forget`,
`episode`, `graph_*` (link graph), `procedure` / `trajectory` (reusable how-tos),
`memory_provenance`, and a large surface of consolidation, governance, and analysis
tools. Full catalog: [`packages/mcp-server/docs/MCP-TOOLS.md`](../packages/mcp-server/docs/MCP-TOOLS.md).

It speaks MCP over **stdio** (for direct client attachment) and also exposes a
**governance HTTP** endpoint (`:5681`, guarded by `GOVERNANCE_API_KEY`) for privileged
`/tools/call` access.

---

## The dashboard

A FastAPI web UI (`:8092`) over the same Qdrant + Postgres the server writes to. It lets
you browse and search memories, visualize tier distribution and the memory-link graph,
inspect episodes/transcripts/audit events, and monitor backend and workflow health.
Nothing done through an MCP client is hidden from the dashboard — they share the stores.

---

## Scheduled maintenance (what keeps it healthy)

34 n8n workflows run on schedules encoded in their filenames, **inside the n8n
container** — so scheduling is identical on macOS, Linux, and Windows with no host cron.
Categories:

- **Daily:** contradiction check + conflict resolution, exact-dedup, TTL sweep,
  hippocampal consolidation (short→long), tier transfer, integrity verify, transcript
  extraction.
- **Weekly:** hot-tier rehydration, re-clustering, active pruning, benchmark recording,
  DRM canary, permission review, identity/NHI lifecycle, red-team scan, self-assessment,
  semantic diff, formal-verify, compliance dashboard.
- **On-demand helpers:** gateway, manual compaction, LLM abstraction, skill discovery,
  report generation.

These are what turn a raw vector database into a *managed* memory system. Full schedule:
[`operations.md`](operations.md).

---

## Design principles

- **Self-hostable, private by default.** Every component runs on your infrastructure;
  embeddings are local via Ollama. No memory content leaves your machine on the core path.
- **Small active pool.** Consolidation, decay, and pruning keep the hot set lean so recall
  stays precise as total memory grows.
- **Cross-platform scheduling.** Maintenance runs in n8n, not host cron — the same install
  behaves identically everywhere.
- **Governed and auditable.** Provenance, permission review, an audit trail, and a DRM
  integrity canary; the dashboard makes state visible.
- **Turnkey.** One clone + `./install.sh` brings up the entire stack, initializes it, and
  imports the workflows.

---

## Security & supply chain

- Both application containers run **non-root**; the dashboard ships a `HEALTHCHECK`.
- Secrets are env-driven with clearly-flagged must-change defaults (see the
  [Administrator Guide](ADMINISTRATOR.md#security-hardening)).
- The dependency posture is documented in the [SBOM](SBOM.md) (generated from the real
  manifests), and the current scan posture — with each finding dispositioned — is in the
  [Scan Report](scan/scan-report.md), backed by a signed Code Hardener report and an
  Ed25519 in-toto attestation.

---

## Where to go next

| I want to… | Read |
|------------|------|
| Install it | [INSTALL.md](INSTALL.md) |
| Use it day to day | [HOW-TO-USE.md](HOW-TO-USE.md) |
| Operate it in production | [ADMINISTRATOR.md](ADMINISTRATOR.md) |
| See the dependency inventory | [SBOM.md](SBOM.md) |
| See the security posture | [scan/scan-report.md](scan/scan-report.md) |
| Understand the scheduled jobs | [operations.md](operations.md) |
| See the full MCP tool catalog | [../packages/mcp-server/docs/MCP-TOOLS.md](../packages/mcp-server/docs/MCP-TOOLS.md) |

---

Apache-2.0 © 2026 bulletproofsoftware-ai. See [LICENSE](../LICENSE) and [NOTICE](../NOTICE).
