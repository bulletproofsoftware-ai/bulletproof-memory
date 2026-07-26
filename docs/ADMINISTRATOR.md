# Administrator Guide — bulletproof-memory

Operating the memory system in production: architecture, configuration, backups,
upgrades, security hardening, monitoring, and runbooks. If you just want to install and
use it, start with the [Install Guide](INSTALL.md) and [How To Use](HOW-TO-USE.md).

---

## Architecture at a glance

The stack is six services orchestrated by `docker-compose.yml`:

| Service | Image | Role | Host port (default) |
|---------|-------|------|---------------------|
| **qdrant** | `qdrant/qdrant` | Vector store — hot / warm / long-term / short-term tiers | 6334 → 6333 |
| **postgres** | `postgres:16-alpine` | Cold tier (FTS + trigram), episodes, transcripts, audit; also n8n's backing store | 5432 |
| **ollama** | `ollama/ollama` | Local embeddings (`nomic-embed-text`, 768-dim) | 11434 |
| **n8n** | `n8nio/n8n` | Runs the 34 scheduled maintenance workflows | 5679 → 5678 |
| **mcp-server** | built from `packages/mcp-server` | MCP tools (stdio) + governance HTTP | 5681 |
| **dashboard** | built from `packages/dashboard` | FastAPI web UI | 8092 |
| **memgraph** *(optional)* | `memgraph/memgraph` | Memory-link graph | 7687 |

Persistent state lives in named Docker volumes: `qdrant_data`, `postgres_data`,
`ollama_data`, `n8n_data`, `memgraph_data`. **These volumes are your data** — back them
up (see [Backups](#backups)).

Both application containers run as **non-root** (`node` / `appuser`) and the dashboard
ships a `HEALTHCHECK`. Qdrant and Postgres have compose-level healthchecks that gate
`install.sh` and the `depends_on` ordering.

---

## Configuration reference

All configuration is environment-driven via `.env` (from
[`.env.example`](../.env.example)).

### Must-change for production

| Variable | Purpose | How to generate |
|----------|---------|-----------------|
| `QDRANT_API_KEY` | Auth for Qdrant; shared by init, server, dashboard | `openssl rand -hex 32` |
| `MEMPG_PASSWORD` | Postgres password | strong random |
| `N8N_ENCRYPTION_KEY` | Encrypts n8n's stored credentials | `openssl rand -hex 24` |
| `GOVERNANCE_API_KEY` | Guards the MCP governance HTTP endpoint (`:5681`) | `openssl rand -hex 32` |
| `DASHBOARD_PASS_HASH` | Dashboard login (salted PBKDF2-HMAC-SHA256, 600k iterations) | see [INSTALL](INSTALL.md) for the generator; the legacy bare SHA-256 digest still authenticates but logs a warning |
| `SESSION_SECRET` | Dashboard session signing | `python3 -c "import secrets;print(secrets.token_hex(32))"` |

> **Do not ship the defaults.** `QDRANT_API_KEY=bpm-dev-local-key-change-me` and the
> `changeme-*` values exist only so a local first-run works. Any internet-reachable
> deployment must replace all of them.

### Ports

Every port is overridable (`QDRANT_PORT`, `MEMPG_PORT`, `OLLAMA_PORT`, `N8N_PORT`,
`GOVERNANCE_HTTP_PORT`, `DASHBOARD_PORT`, `MEMGRAPH_PORT`). Change these on collision with
existing services.

### Embeddings

`EMBED_MODEL` defaults to `nomic-embed-text` (768-dim). If you change it, you must
re-initialize collections (dimensions must match) — existing vectors are not
automatically re-embedded.

---

## The scheduled workflows

34 n8n workflows run maintenance on schedules encoded in their filenames — **inside the
n8n container**, so there is no host cron/launchd and scheduling is identical across
macOS, Linux, and Windows. Full catalog and timing: [`operations.md`](operations.md).

Administration:

- **View / pause / edit:** the n8n UI at `http://localhost:5679`.
- **Credentials they need (one-time):** a Qdrant header credential named `api-key`
  (value = `QDRANT_API_KEY`) and an Anthropic API credential (for LLM-driven
  abstraction/reporting workflows). Create these in n8n after install.
- **Re-import:** `bash workflows/import-workflows.sh` (idempotent).

Notable safety-relevant workflows: `memory-drm-canary` (integrity canary),
`memory-contradiction-check` + `memory-daily-conflict-resolver` (consistency),
`memory-red-team-scan` (adversarial), `memory-formal-verify`, and `memory-ttl-sweep`
(expiry).

---

## Backups

Your data is in the Docker volumes. Two things to back up regularly:

### Qdrant (vectors)

A helper is included:

```bash
bash init/backup-qdrant.sh          # snapshots collections
```

Or snapshot the volume directly:

```bash
docker run --rm -v bulletproof-memory_qdrant_data:/data -v "$PWD/backups:/backup" \
  alpine tar czf /backup/qdrant-$(date +%F).tar.gz -C /data .
```

### Postgres (cold tier, episodes, transcripts, audit, n8n)

```bash
docker compose exec -T postgres pg_dump -U "${MEMPG_USER:-memory}" "${MEMPG_DB:-memory}" \
  | gzip > backups/postgres-$(date +%F).sql.gz
```

Restore:

```bash
gunzip -c backups/postgres-YYYY-MM-DD.sql.gz \
  | docker compose exec -T postgres psql -U "${MEMPG_USER:-memory}" "${MEMPG_DB:-memory}"
```

Store backups off-box. Test a restore periodically — an untested backup is a hope, not a
plan.

---

## Upgrades

```bash
git pull
docker compose pull            # pull newer base images (qdrant/postgres/ollama/n8n)
docker compose up -d --build   # rebuild app images + recreate changed services
bash init/run-init.sh          # idempotent; applies any new indexes/schema
```

- The `init/*` scripts are idempotent — safe to re-run.
- Re-run `workflows/import-workflows.sh` if a release adds/changes workflows.
- **Back up first** (above) before any major version bump of Qdrant or Postgres.

---

## Security hardening

- **Rotate all default secrets** (see the must-change table). The single most important
  step.
- **Rotate `QDRANT_API_KEY` periodically.** All services read it from `.env`; update the
  value and `docker compose up -d` to roll it. Empty is *not* the same as unset — Qdrant
  enables auth whenever the key is non-empty.
- **Don't expose ports you don't need.** For a single-host deploy, bind the compose ports
  to `127.0.0.1` (edit the `ports:` mappings) and reach them via SSH tunnel or a reverse
  proxy with TLS.
- **Governance HTTP (`:5681`)** requires `GOVERNANCE_API_KEY` for `/tools/call`. Keep this
  key secret; it fronts privileged memory operations.
- **Containers run non-root** and the dashboard is behind a login (`DASHBOARD_PASS_HASH`).
  Put the dashboard behind a reverse proxy with TLS for any non-localhost access.
- **n8n credentials are encrypted** with `N8N_ENCRYPTION_KEY` — losing this key means
  re-entering every credential, so back it up securely.

See the [Scan Report](scan/scan-report.md) for the current security-scan posture and how
each finding was dispositioned.

---

## Monitoring & health

| Check | Command |
|-------|---------|
| All containers up + healthy | `docker compose ps` |
| Qdrant collections | `curl -s -H "api-key: $QDRANT_API_KEY" localhost:6334/collections` |
| Dashboard health | `curl -s localhost:8092/health` |
| n8n health | `curl -s localhost:5679/healthz` |
| Workflow status | n8n UI → each workflow's executions tab |
| DRM canary | `memory-drm-canary` workflow's last execution (weekly Mon 03:00) |

The dashboard surfaces backend health and tier distribution visually at `/`.

---

## Runbooks

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Recall returns nothing | Ollama not ready / model not pulled | `docker compose logs ollama`; confirm `nomic-embed-text` pulled. Bring-your-own-Ollama? check `OLLAMA_URL`. |
| `401` from Qdrant | `QDRANT_API_KEY` mismatch between services | Ensure the same value is in `.env`, then `docker compose up -d`. |
| Dashboard 500s on a page | Postgres tier not reachable | `docker compose logs postgres dashboard`; confirm `postgres` healthy. |
| Workflows not running | n8n credentials missing / workflows inactive | Open n8n UI; create the Qdrant + Anthropic credentials; activate workflows. |
| Container unhealthy after upgrade | Image/schema mismatch | `bash init/run-init.sh`; check `docker compose logs <service>`. |
| Disk filling up | Vector/transcript growth | Confirm `memory-active-pruning` + `memory-ttl-sweep` are active; prune old backups. |

---

## Uninstall / reset

```bash
docker compose down            # stop containers, keep data volumes
docker compose down -v         # stop AND delete all data volumes (DESTRUCTIVE)
```

`down -v` erases every memory, transcript, and workflow — back up first if you might want
the data.

---

Apache-2.0 © 2026 bulletproofsoftware-ai. See [LICENSE](../LICENSE) and [NOTICE](../NOTICE).
