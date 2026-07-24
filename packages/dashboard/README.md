# bulletproof-memory — dashboard

**A web dashboard for [bulletproof-memory](https://github.com/bulletproofsoftware-ai/bulletproof-memory) — browse, search, and visualize an AI agent's memory.**

A FastAPI + server-rendered dashboard over the same Qdrant and Postgres backends
the [bulletproof-memory](https://github.com/bulletproofsoftware-ai/bulletproof-memory)
MCP server writes to. It auto-discovers your Qdrant collections at runtime, so new
collections appear automatically without config changes.

## Pages

| Page | What it shows |
|------|---------------|
| **Dashboard** | Health of every backend + memory counts at a glance |
| **Memories** | Browse & filter stored memories across tiers |
| **Search** | Semantic search over collections (via Ollama embeddings) |
| **Explorer** | Drill into any discovered Qdrant collection |
| **Tiers** | Hot / warm / cold / long-term tier views |
| **Knowledge** | Episodes, learnings, procedures, trajectories |
| **Graph** | Memory-link graph (Memgraph) |
| **Governance** | Constitutional assessments, red-team, compliance |
| **Sessions** | Session recordings & transcripts |
| **Decisions** | A Postgres-backed log of recorded decisions |
| **Analytics** | Aggregate stats and trends |
| **System** | Live backend health (Qdrant, Postgres, Ollama, Memgraph, n8n) |

---

## Quickstart (Docker Compose — the whole stack)

The dashboard runs as part of the full stack. From the **repo root**, one command
brings up Qdrant + Postgres + Ollama + n8n + the MCP server + this dashboard:

```bash
git clone https://github.com/bulletproofsoftware-ai/bulletproof-memory.git
cd bulletproof-memory
cp .env.example .env      # set DASHBOARD_PASS_HASH, review the rest
./install.sh              # or: docker compose up -d
```

Open **http://localhost:8092** and log in. See the
[root README](../../README.md) for the full stack.

> **Bring your own Ollama.** The `ollama` service pulls `nomic-embed-text` on first
> run (a multi-GB download). If you already run Ollama, comment out the `ollama`
> service and set `OLLAMA_URL` in `.env` to your instance.

### Set the login password

Auth uses a SHA-256 hash, not a plaintext password:

```bash
python3 -c "import hashlib; print(hashlib.sha256('yourpassword'.encode()).hexdigest())"
# put the result in .env as DASHBOARD_PASS_HASH
```

---

## Manual install (dashboard only)

```bash
cd app
pip install -r requirements.txt
cp ../.env.example ../.env     # fill in backend URLs + DASHBOARD_PASS_HASH
uvicorn main:app --host 0.0.0.0 --port 8092
```

You supply your own Qdrant, Ollama, and Postgres — see `.env.example` for every
variable the app reads.

---

## Configuration

- **Backends & auth** are configured via environment variables — see `.env.example`.
- **Collection grouping/labels** are advisory and live in `config.yaml`. Collections
  are *discovered* from live Qdrant at runtime; unknown ones still render (grouped as
  "other"). The config never needs to be kept in sync with your collections.

---

## Development

```bash
cd app && pip install -r requirements.txt
python3 -m pytest ../tests -q      # discovery tests
python3 -m py_compile main.py discovery.py routes_extended.py
```

---

## License

Apache-2.0 © 2026 bulletproofsoftware-ai. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
