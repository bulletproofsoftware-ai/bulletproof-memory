#!/usr/bin/env bash
# Run all Qdrant/Postgres initialization against the live stack.
# Idempotent — safe to re-run. Targets the compose Qdrant by default.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Point the init scripts at the host-published Qdrant port (compose maps 6333->QDRANT_PORT).
export QDRANT_URL="${QDRANT_URL:-http://localhost:${QDRANT_PORT:-6334}}"
export QDRANT_API_KEY="${QDRANT_API_KEY:-}"

echo "==> Initializing Qdrant collections at $QDRANT_URL"
bash init-qdrant.sh || echo "   (init-qdrant.sh: non-fatal)"
bash init-collections-v3.sh
bash init-session-transcripts.sh
bash init-evo-indexes.sh

echo "==> Governance infra (Ed25519 keys) — the MCP server also self-generates these if absent."
bash init-governance.sh 2>/dev/null || echo "   (init-governance.sh skipped — MCP server will self-generate)"

echo "==> Initialization complete."
