# bulletproof-memory

**Persistent, tiered memory for AI agents — the full system in one repo.**

A complete, self-hostable memory system for AI agents: an MCP server with semantic
recall, a web dashboard, and the scheduled maintenance workflows that keep it healthy.
One clone, one command, and it runs.

![bulletproof-memory — tiered memory system for AI agents](docs/media/infographic.png)

> 📊 A [system-overview slide deck](media/system-overview-deck.pdf) and
> [explainer video](media/system-overview.mp4) are in [`media/`](media/); full
> documentation (install, admin, how-to, SBOM, signed scan report) is in [`docs/`](docs/).

## What's in here

| Path | What it is |
|------|------------|
| [`packages/mcp-server/`](packages/mcp-server/) | The MCP server — `memory_store` / `memory_recall` and 70+ tools over Qdrant + Postgres |
| [`packages/dashboard/`](packages/dashboard/) | FastAPI web dashboard to browse, search, and visualize memory |
| [`workflows/`](workflows/) | 34 scheduled n8n workflows (consolidation, decay, tier-transfer, DRM canary, dedup, …) |
| [`init/`](init/) | Qdrant/Postgres initialization scripts |
| [`integrations/claude-code/`](integrations/claude-code/) | Optional Claude Code hooks (session recall/capture) |
| `docker-compose.yml`, `install.sh` | The turnkey stack |

## Quickstart

```bash
git clone https://github.com/bulletproofsoftware-ai/bulletproof-memory.git
cd bulletproof-memory
./install.sh
```

`install.sh` brings up **Qdrant + Postgres + Ollama + n8n + the MCP server + the
dashboard**, initializes collections, and imports the 34 workflows. Then open the
dashboard at **http://localhost:8092**.

> **Bring your own Ollama.** The `ollama` service pulls `nomic-embed-text` on first run
> (multi-GB). Already have Ollama? Comment out that service and set `OLLAMA_URL`.

## Architecture

| Backend | Role |
|---------|------|
| **Qdrant** | Vector store — hot / warm / long-term / short-term tiers |
| **Postgres** | Cold tier (full-text + trigram), episodes, transcripts, audit |
| **Ollama** | Local embeddings (`nomic-embed-text`, 768-dim) |
| **n8n** | Runs the scheduled maintenance workflows |
| **Memgraph** *(optional)* | Memory-link graph |

Recall searches the vector tiers first, falls back to the Postgres cold tier, and
promotes cold hits back to a warm tier on access. The n8n workflows handle
consolidation, decay, tier transitions, and integrity checks on a schedule.

## The two packages

Each package has its own README with standalone setup:

- **[MCP server](packages/mcp-server/README.md)** — wire it into any MCP client
  (Claude Desktop, Claude Code). Getting started focuses on `memory_store` /
  `memory_recall`; see its `docs/MCP-TOOLS.md` for the full tool catalog.
- **[Dashboard](packages/dashboard/README.md)** — the web UI over the same backends.

## Using it with an MCP client

```json
{
  "mcpServers": {
    "bulletproof-memory": {
      "command": "node",
      "args": ["/absolute/path/to/bulletproof-memory/packages/mcp-server/dist/index.js"],
      "env": { "QDRANT_URL": "http://localhost:6334", "OLLAMA_URL": "http://localhost:11434" }
    }
  }
}
```

## Operations

See [`docs/operations.md`](docs/operations.md) for what each scheduled workflow does
and when it runs.

## License

Apache-2.0 © 2026 bulletproofsoftware-ai. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
