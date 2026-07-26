# Install Guide — bulletproof-memory

This guide takes you from a clean machine to a running memory system: the MCP server,
the web dashboard, and the 34 scheduled maintenance workflows, all backed by Qdrant,
Postgres, Ollama, and n8n.

There are two paths:

1. **[Turnkey stack](#1-turnkey-stack-recommended)** — one clone, one command. Brings up
   everything. Recommended for almost everyone.
2. **[MCP server only](#2-mcp-server-only)** — run just the MCP server against your own
   Qdrant / Ollama / Postgres.

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| **Docker Engine + Compose v2** | `docker compose version` must work. Docker Desktop (macOS/Windows) or Docker Engine (Linux). |
| **Disk** | ~5–8 GB free. The Ollama image pulls the `nomic-embed-text` model (multi-GB) on first run. |
| **RAM** | 4 GB is enough for a local install; 8 GB comfortable with Memgraph enabled. |
| **Ports** | Defaults: `6334` (Qdrant), `5432` (Postgres), `11434` (Ollama), `5679` (n8n), `5681` (governance HTTP), `8092` (dashboard), `7687` (Memgraph). All overridable in `.env`. |
| **Node.js 20+** | Only for the *MCP-server-only* path (§2). Not needed for the turnkey stack. |

> **Bring your own Ollama.** The `ollama` service in the compose file pulls
> `nomic-embed-text` on first boot. If you already run Ollama, comment out that service
> in `docker-compose.yml` and set `OLLAMA_URL` in `.env` to your existing instance.

---

## 1. Turnkey stack (recommended)

```bash
git clone https://github.com/bulletproofsoftware-ai/bulletproof-memory.git
cd bulletproof-memory
./install.sh
```

`install.sh` performs, in order:

1. **Preflight** — verifies Docker is installed, the daemon is reachable, and the
   `compose` plugin is present. Fails fast with a clear message if not.
2. **`.env` bootstrap** — copies `.env.example` → `.env` if you don't have one yet, and
   prints the values you should set for production (see [Configuration](#configuration)).
3. **`docker compose up -d --build`** — builds and starts Qdrant, Postgres, Ollama, n8n,
   the MCP server, and the dashboard.
4. **Health wait** — polls until Qdrant and Postgres report healthy (up to ~5 minutes).
5. **Initialization** — runs `init/run-init.sh` to create the Qdrant collections,
   indexes, governance schema, and session-transcript tables.
6. **Workflow import** — waits for n8n's first-boot migration, then runs
   `workflows/import-workflows.sh` to load the 34 scheduled workflows.

When it finishes you'll see the service URLs printed:

```
  Dashboard:  http://localhost:8092
  n8n:        http://localhost:5679
  Qdrant:     http://localhost:6334
```

### Verify the install

```bash
# All containers up?
docker compose ps

# Qdrant answering (needs your QDRANT_API_KEY from .env)
curl -s -H "api-key: $(grep '^QDRANT_API_KEY=' .env | cut -d= -f2)" \
  http://localhost:6334/collections | python3 -m json.tool

# Dashboard reachable
curl -s -o /dev/null -w "dashboard -> HTTP %{http_code}\n" http://localhost:8092/
```

Then open **http://localhost:8092** in a browser.

### Post-install steps

The installer prints these; they're required for full functionality:

1. **Create n8n credentials.** Open n8n (`http://localhost:5679`). The workflows
   reference two credentials you must create once:
   - a **Qdrant** header credential named `api-key` (value = your `QDRANT_API_KEY`), and
   - an **Anthropic API** credential (for the LLM-driven abstraction/report workflows).
2. **Set a dashboard password.** Generate a hash and put it in `.env`, then re-apply:
   ```bash
   python3 -c "import hashlib,secrets;p='YOUR_PASSWORD';s=secrets.token_hex(16);print('pbkdf2_sha256\$600000\$'+s+'\$'+hashlib.pbkdf2_hmac('sha256',p.encode(),bytes.fromhex(s),600000).hex())"
   # paste into DASHBOARD_PASS_HASH in .env, then:
   docker compose up -d
   ```
3. **Wire your MCP client** to the server — see
   [How To Use](HOW-TO-USE.md#connecting-an-mcp-client).

---

## 2. MCP server only

Run just the MCP server against infrastructure you already have (or intend to host
separately). You supply Qdrant, Ollama, and optionally Postgres.

```bash
git clone https://github.com/bulletproofsoftware-ai/bulletproof-memory.git
cd bulletproof-memory/packages/mcp-server
npm install
npm run build            # tsc -> dist/
cp .env.example .env     # set QDRANT_URL, OLLAMA_URL, Postgres creds
node dist/index.js
```

Minimum for basic `memory_store` / `memory_recall`: a reachable Qdrant (default
`http://localhost:6334`) and Ollama (`http://localhost:11434`) with `nomic-embed-text`
pulled. Postgres adds the cold tier, episodes, transcripts, and audit; Memgraph adds the
memory-link graph.

Run the built-in diagnostic against your stack:

```bash
npm run self-test
```

---

## Configuration

All configuration is environment-driven via `.env` (copied from
[`.env.example`](../.env.example)). The values you should change for any non-local
deployment:

| Variable | Default | Change for production? |
|----------|---------|------------------------|
| `QDRANT_API_KEY` | `bpm-dev-local-key-change-me` | **Yes** — set a strong key. Read by init, server, and dashboard. |
| `MEMPG_PASSWORD` | `memory` | **Yes** — Postgres password. |
| `N8N_ENCRYPTION_KEY` | `changeme-encryption-key` | **Yes** — encrypts stored n8n credentials. |
| `GOVERNANCE_API_KEY` | `changeme-governance-key` | **Yes** — guards the MCP governance HTTP endpoint (`:5681`). |
| `DASHBOARD_PASS_HASH` | *(empty)* | **Yes** — SHA-256 of your dashboard password. |
| `SESSION_SECRET` | *(empty)* | **Yes** — random 32-byte hex for dashboard sessions. |
| `DASHBOARD_USER` | `admin` | Optional — dashboard login username. |
| `EMBED_MODEL` | `nomic-embed-text` | Change only if you use a different Ollama embedding model. |
| Port variables | see table above | Change on collision with existing services. |

Full administration (backups, upgrades, scaling, security hardening) is covered in the
[Administrator Guide](ADMINISTRATOR.md).

---

## Troubleshooting install

| Symptom | Cause / fix |
|---------|-------------|
| `Docker daemon not reachable` | Start Docker Desktop / `systemctl start docker`, then re-run `./install.sh`. |
| Qdrant/Postgres never report healthy | Check `docker compose logs qdrant postgres`. Usually a port collision — change the port in `.env`. |
| Workflow import "had issues" | n8n was still migrating. Re-run `bash workflows/import-workflows.sh`, or import from the n8n UI. |
| Ollama pull is slow / stalls | The `nomic-embed-text` model is multi-GB. Watch `docker compose logs ollama`; or bring your own Ollama and comment out the service. |
| Dashboard shows 401 / can't log in | `DASHBOARD_PASS_HASH` unset. Set it (see post-install step 2) and `docker compose up -d`. |

More runbooks are in the [Administrator Guide](ADMINISTRATOR.md#runbooks).

---

Apache-2.0 © 2026 bulletproofsoftware-ai. See [LICENSE](../LICENSE) and [NOTICE](../NOTICE).
