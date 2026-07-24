# Software Bill of Materials — bulletproof-memory

This SBOM inventories the third-party software dependencies of `bulletproof-memory`,
generated from the repository's **actual dependency manifests**, not hand-authored. It
covers the two shipped packages:

- **MCP server** (`packages/mcp-server/`) — Node.js / TypeScript
- **Dashboard** (`packages/dashboard/`) — Python / FastAPI

A machine-readable CycloneDX 1.5 SBOM for the MCP server is committed alongside this
document at [`mcp-server.cyclonedx.json`](mcp-server.cyclonedx.json). Code Hardener's
`syft`/`cdxgen` scanners also inventory the dependency graph during the security scan (see
the [Scan Report](scan/scan-report.md)).

> **Regenerate at any time:**
> ```bash
> # MCP server (npm) — CycloneDX
> cd packages/mcp-server && npm install && npm sbom --sbom-format cyclonedx --omit dev
> # Dashboard (Python) — the pinned manifest is packages/dashboard/app/requirements.txt
> ```

---

## MCP server (Node.js)

`package.json` name `bulletproof-memory@1.0.0`. **5 direct runtime dependencies**,
resolving to **137 total runtime components** (transitive included).

### Direct runtime dependencies

| Package | Version | License |
|---------|---------|---------|
| `@modelcontextprotocol/sdk` | ^1.0.0 | MIT |
| `better-sqlite3` | ^12.11.1 | MIT |
| `neo4j-driver` | ^5.28.3 | Apache-2.0 |
| `pg` | ^8.20.0 | MIT |
| `zod` | ^3.23.0 | MIT |

`better-sqlite3` builds a native addon (needs a build toolchain at image build time —
handled in the multi-stage `Dockerfile`). `pg` talks to the Postgres tiers; `neo4j-driver`
to the optional Memgraph link graph; `zod` validates tool inputs; the MCP SDK provides the
protocol server.

### License distribution (137 runtime components, transitive)

| Count | License |
|-------|---------|
| 113 | MIT |
| 11 | ISC |
| 6 | Apache-2.0 |
| 3 | BSD-3-Clause |
| 1 | BSD-2-Clause |
| 1 | 0BSD |
| 1 | (MIT OR WTFPL) |
| 1 | (BSD-2-Clause OR MIT OR Apache-2.0) |

**All permissive.** No copyleft (GPL/LGPL/AGPL), no source-available or commercial
licenses. Compatible with the project's own Apache-2.0 license and with commercial
redistribution.

*Dev-only dependencies* (`typescript`, `vitest`, `tsx`, and `@types/*`) are excluded from
this runtime inventory — they don't ship in the production image (`npm install --omit=dev`)
and aren't part of the deployed attack surface.

---

## Dashboard (Python)

Pinned in [`packages/dashboard/app/requirements.txt`](../packages/dashboard/app/requirements.txt).
**8 direct dependencies, all exact-pinned** (`==`):

| Package | Version | License | Role |
|---------|---------|---------|------|
| `fastapi` | 0.115.12 | MIT | Web framework |
| `uvicorn` | 0.34.2 | BSD-3-Clause | ASGI server |
| `httpx` | 0.28.1 | BSD-3-Clause | Async HTTP client (talks to Qdrant/Ollama) |
| `jinja2` | 3.1.6 | BSD-3-Clause | HTML templating |
| `pyyaml` | 6.0.2 | MIT | Config parsing (`config.yaml`) |
| `asyncpg` | 0.30.0 | Apache-2.0 | Async Postgres driver |
| `python-multipart` | 0.0.20 | Apache-2.0 | Form parsing |
| `itsdangerous` | 2.2.0 | BSD-3-Clause | Session-cookie signing |

**All permissive** (MIT / BSD-3-Clause / Apache-2.0). Exact pinning means reproducible
builds — the same versions install every time.

---

## Base images

The runtime is delivered as containers built on official upstream base images (see each
package's `Dockerfile` and `docker-compose.yml`):

| Image | Used by |
|-------|---------|
| `node:20-slim` | MCP server |
| `python:3.12-slim` | Dashboard |
| `qdrant/qdrant` | Vector store |
| `postgres:16-alpine` | Relational tiers |
| `ollama/ollama` | Embeddings |
| `n8nio/n8n` | Scheduled workflows |
| `memgraph/memgraph` *(optional)* | Link graph |

OS-level CVEs reported against these base images originate upstream, not from this
project's code; keep them current with `docker compose pull` (see the
[Administrator Guide](ADMINISTRATOR.md#upgrades)). The current scan disposition of
base-image CVEs is documented in the [Scan Report](scan/scan-report.md).

---

## Provenance & integrity

- The MCP server's dependency graph is captured in the committed CycloneDX SBOM
  ([`mcp-server.cyclonedx.json`](mcp-server.cyclonedx.json)).
- Each security scan produces an **Ed25519 in-toto attestation** over the scanned
  artifact — see [`scan/attestation.json`](scan/attestation.json).
- Secret scanning (gitleaks) runs clean — **0 secrets** in the tree or history.

---

Apache-2.0 © 2026 bulletproofsoftware-ai. See [LICENSE](../LICENSE) and [NOTICE](../NOTICE).
