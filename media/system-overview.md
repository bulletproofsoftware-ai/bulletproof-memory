# Bulletproof-Memory: Comprehensive Briefing Document

## Executive Summary

Bulletproof-memory is a complete, self-hostable memory system designed to provide persistent, semantic, and tiered recall for AI agents. It addresses the fundamental limitation of Large Language Model (LLM) agents: statelessness between sessions. By implementing a tiered storage architecture that mirrors human memory—moving from active "hot" tiers to archival "cold" tiers—the system ensures that an agent's prior decisions, preferences, and facts are preserved without overwhelming the active context.

The system is delivered as a turnkey stack orchestrated via Docker Compose, comprising an MCP (Model Context Protocol) server, a web dashboard, and 34 automated maintenance workflows. Built with a "private-by-default" philosophy, it utilizes local embeddings via Ollama to ensure that memory content never leaves the local infrastructure.

## System Overview and Architecture

The bulletproof-memory stack consists of six core services (and one optional service) orchestrated to handle different aspects of memory storage and retrieval.

### Core Service Architecture

| Service | Image | Role | Default Host Port |
| :--- | :--- | :--- | :--- |
| **qdrant** | qdrant/qdrant | Vector store for hot, warm, long-term, and short-term tiers. | 6334 → 6333 |
| **postgres** | postgres:16-alpine | Cold tier (FTS + trigram), episodes, transcripts, audit, and n8n backing store. | 5432 |
| **ollama** | ollama/ollama | Local embeddings (nomic-embed-text, 768-dim). | 11434 |
| **n8n** | n8nio/n8n | Automation engine for 34 scheduled maintenance workflows. | 5679 → 5678 |
| **mcp-server** | packages/mcp-server | MCP tools (stdio) and governance HTTP. | 5681 |
| **dashboard** | packages/dashboard | FastAPI web UI for browsing and visualization. | 8092 |
| **memgraph** | memgraph/memgraph | (Optional) Memory-link graph for related memories. | 7687 |

### Persistent State
All persistent data is stored in named Docker volumes: `qdrant_data`, `postgres_data`, `ollama_data`, `n8n_data`, and `memgraph_data`. These volumes represent the entirety of the system's memory and require regular backups.

## The Tiered Memory Model

The system employs a sophisticated mental model where memory is both **tiered** and **semantic**.

### Storage Tiers
1.  **Vector Tiers (Qdrant):** Includes Hot, Warm, Short-term, and Long-term pools. These handle semantic recall over the active memory set. Keeping the active pool small ensures high precision and low competitor density during queries.
2.  **Cold Tier (Postgres):** Utilizes Full-Text Search (FTS) and trigram matching. It serves as a fallback for information that has aged out of the vector tiers.
3.  **Relational Tiers (Postgres):** Stores rich, structured records such as multi-step episodes, session transcripts, and an audit trail.
4.  **Graph Tier (Memgraph):** An optional tier that builds a "RELATED" graph between memories for complex traversal queries.

### The Recall and Promotion Flow
When a query is initiated, the system first searches the vector tiers. If no high-quality match is found, it falls back to the Postgres cold tier. If a match is found in the cold tier, that memory is automatically re-embedded and **promoted** back to a warm vector tier to ensure faster access in future sessions.

## Model Context Protocol (MCP) and Tools

The MCP server acts as the primary interface for AI agents. While the server exposes **75 total tools**, approximately 90% of daily interaction occurs through two primary functions:

*   **`memory_store`**: Writes a memory by capturing content, a free-form type label (e.g., fact, decision), and optional project scoping.
*   **`memory_recall`**: Performs a semantic search across all tiers with automatic cold-tier promotion.

### Specialized Maintenance Tools
| Tool Category | Purpose |
| :--- | :--- |
| **Persistence** | `pin_memory` sets a memory to be skipped by weekly pruning workflows. |
| **Deletion** | `memory_forget` uses a two-step confirmation process to remove stale data. |
| **Relational** | `episode` stores multi-step records; `procedure` / `trajectory` stores reusable how-tos. |
| **Governance** | `memory_provenance` checks the origin and confirmation status of a memory. |

## Scheduled Maintenance Workflows

The system's health is maintained by 34 n8n workflows that run on internal schedules, eliminating the need for host-level cron jobs.

### Notable Workflow Schedules
*   **Daily:** Contradiction checks, exact-deduplication, TTL (Time-To-Live) sweeps, hippocampal consolidation (short to long-term transfer), and transcript extraction.
*   **Weekly:** Hot-tier rehydration, re-clustering, active pruning, red-team scans, and "DRM canary" integrity checks.
*   **Safety/Safety-Relevant:** Includes `memory-red-team-scan` (adversarial testing) and `memory-formal-verify`.

## Installation and Deployment

Bulletproof-memory offers two primary installation paths:

1.  **Turnkey Stack (Recommended):** A single `install.sh` command that performs preflight checks, bootstraps the `.env` file, builds the Docker containers, initializes Qdrant collections, and imports the 34 n8n workflows.
2.  **MCP Server Only:** Allows users to run the MCP server against existing Qdrant, Ollama, or Postgres infrastructure.

### Prerequisites
*   **Docker Engine + Compose v2**: Essential for orchestration.
*   **Disk Space**: 5–8 GB (primarily for the `nomic-embed-text` model).
*   **RAM**: 4 GB minimum; 8 GB recommended if Memgraph is enabled.
*   **Node.js 20+**: Required only for the standalone MCP server path.

## Security Posture

The system is designed with rigorous security hardening and supply-chain transparency.

### Core Security Features
*   **Non-Root Execution:** Application containers run as `node` or `appuser`.
*   **Governance HTTP (`:5681`)**: Fronts privileged memory operations and is guarded by a `GOVERNANCE_API_KEY`.
*   **Secret Management**: All critical credentials (QDRANT_API_KEY, N8N_ENCRYPTION_KEY, etc.) are environment-driven and must be changed from their defaults for production use.
*   **Supply Chain**: A Software Bill of Materials (SBOM) is provided, documenting 137 runtime components for the MCP server and 8 exact-pinned dependencies for the dashboard. All dependencies use permissive licenses (MIT, Apache-2.0, BSD).

## Important Quotes

> "LLM agents are stateless between sessions. Everything an agent 'knew' — decisions, preferences, prior context, hard-won facts — evaporates when the conversation ends." — *OVERVIEW.md*

> "Test a restore periodically — an untested backup is a hope, not a plan." — *ADMINISTRATOR.md regarding Postgres and Qdrant backups.*

> "Recall searches the vector tiers first, falls back to the Postgres cold tier, and promotes any cold hit back to a warm tier so it's fast next time." — *HOW-TO-USE.md*

## Actionable Insights for Administrators

*   **Secret Rotation:** Do not ship with default credentials. The single most important security step is rotating all default secrets found in the `.env` file, specifically the `QDRANT_API_KEY` and `GOVERNANCE_API_KEY`.
*   **Volume Backups:** Regular backups must target the named Docker volumes. Use the provided Qdrant helper (`qdrant-backup.sh`) and standard `pg_dump` for Postgres.
*   **Workflow Monitoring:** Access the n8n UI at `http://localhost:5679` to ensure the 34 maintenance workflows are active. The "DRM canary" should be checked weekly (Monday 03:00) to confirm system integrity.
*   **Embedding Model Constraints:** If the `EMBED_MODEL` is changed from the default `nomic-embed-text`, collections must be re-initialized because existing vectors are not automatically re-embedded and dimensions must match.
*   **Port Management:** For single-host deployments, bind compose ports to `127.0.0.1` and use SSH tunnels or a TLS-enabled reverse proxy to prevent unauthorized external access.