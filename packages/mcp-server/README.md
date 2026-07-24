# bulletproof-memory

**Persistent, tiered memory for AI agents — an MCP server with semantic recall over Qdrant + Postgres.**

`bulletproof-memory` is a [Model Context Protocol](https://modelcontextprotocol.io) (MCP)
server that gives an AI agent durable, searchable memory. Store facts, preferences,
decisions, and context; recall them later by meaning, not just keywords. Memory is
organized into tiers (hot / warm / cold / long-term) backed by a Qdrant vector store,
a PostgreSQL relational tier, and an optional Memgraph graph of memory links.

It pairs with the [dashboard package](../dashboard/)
for a web UI over the same collections.

---

## Getting started (the two tools you need first)

The server exposes 75 tools, but you only need two to start:

- **`memory_store`** — write a memory (content + type + optional tags/project).
- **`memory_recall`** — semantic search across all tiers.

Everything else (consolidation, graph links, provenance, governance, etc.) builds on
those. See [`docs/MCP-TOOLS.md`](docs/MCP-TOOLS.md) for the full catalog.

---

## Quickstart (Docker Compose)

The fastest path brings up the whole stack — Qdrant, Postgres, Ollama (for embeddings),
and this server — with one command. The compose file lives in the
[dashboard repo](https://github.com/bulletproofsoftware-ai/bulletproof-memory/tree/main/packages/dashboard)
so a single stack serves both the server and the UI:

```bash
git clone https://github.com/bulletproofsoftware-ai/bulletproof-memory.git
cd bulletproof-memory/packages/mcp-server-dashboard
cp .env.example .env      # review the values
docker compose up -d
```

> **Bring your own Ollama.** The compose file includes an Ollama service and pulls the
> `nomic-embed-text` embedding model on first run (a multi-GB download). If you already
> run Ollama, comment out the `ollama` service and point `OLLAMA_URL` at your instance.

## Manual install (this server on its own)

```bash
git clone https://github.com/bulletproofsoftware-ai/bulletproof-memory.git
cd bulletproof-memory/packages/mcp-server
npm install
npm run build
cp .env.example .env       # fill in QDRANT_URL, OLLAMA_URL, Postgres creds
node dist/index.js
```

You supply your own Qdrant, Ollama, and Postgres — see `.env.example` for every
variable. A running Qdrant on `localhost:6334` and Ollama on `localhost:11434` are
the minimum for basic store/recall.

---

## Wiring it into an MCP client

Add the server to your MCP client config (Claude Desktop, Claude Code, etc.):

```json
{
  "mcpServers": {
    "bulletproof-memory": {
      "command": "node",
      "args": ["/absolute/path/to/bulletproof-memory/dist/index.js"],
      "env": {
        "QDRANT_URL": "http://localhost:6334",
        "OLLAMA_URL": "http://localhost:11434"
      }
    }
  }
}
```

Restart the client and the memory tools appear.

---

## Architecture

| Backend  | Role |
|----------|------|
| **Qdrant** | Vector store for hot / warm / long-term / short-term tiers. Semantic recall. |
| **PostgreSQL** | Cold tier (full-text + trigram search), episodes, session transcripts, audit. |
| **Ollama** | Local embeddings (`nomic-embed-text`, 768-dim). |
| **Memgraph** *(optional)* | Graph of `RELATED` links between memories. |

Recall searches the vector tiers first, falls back to the Postgres cold tier, and
promotes cold hits back to a warm tier on access. See
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full deployment guide and
[`docs/self-test.md`](docs/self-test.md) for the built-in diagnostic
(`npm run self-test`).

---

## Development

```bash
npm install
npm run build      # tsc -> dist/
npm test           # vitest (tests skip-gate when backends are offline)
npm run self-test  # end-to-end diagnostic against a live stack
```

Tests are designed to skip gracefully when Qdrant/Postgres aren't reachable, so a
bare `npm test` stays green on a machine without the stack running.

---

## License

Apache-2.0 © 2026 bulletproofsoftware-ai. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
