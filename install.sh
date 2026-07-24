#!/usr/bin/env bash
# bulletproof-memory — one-command install.
# Brings up the full memory system: Qdrant + Postgres + Ollama + n8n + MCP server
# + dashboard, initializes collections, and imports the scheduled workflows.
set -euo pipefail

cd "$(cd "$(dirname "$0")" && pwd)"

DOCKER="${DOCKER:-docker}"

say() { printf "\n\033[1m==> %s\033[0m\n" "$1"; }
die() { printf "\n\033[31mERROR: %s\033[0m\n" "$1" >&2; exit 1; }

# 1. Preflight
say "Checking Docker"
command -v "$DOCKER" >/dev/null 2>&1 || die "Docker not found. Install Docker Desktop / Engine first."
$DOCKER info >/dev/null 2>&1 || die "Docker daemon not reachable. Start Docker and retry."
$DOCKER compose version >/dev/null 2>&1 || die "'docker compose' plugin not available."

# 2. .env
if [ ! -f .env ]; then
  say "Creating .env from .env.example (review the values!)"
  cp .env.example .env
  echo "   A default .env was created. For production, edit it and set:"
  echo "     QDRANT_API_KEY, MEMPG_PASSWORD, DASHBOARD_PASS_HASH, SESSION_SECRET,"
  echo "     N8N_ENCRYPTION_KEY, GOVERNANCE_API_KEY"
fi

# 3. Bring up the stack
say "Starting containers (docker compose up -d)"
$DOCKER compose up -d --build

# 4. Wait for core backends to be healthy
say "Waiting for Qdrant + Postgres to be healthy"
for i in $(seq 1 60); do
  q=$($DOCKER compose ps qdrant --format '{{.Health}}' 2>/dev/null || echo "")
  p=$($DOCKER compose ps postgres --format '{{.Health}}' 2>/dev/null || echo "")
  echo "   [$i] qdrant=$q postgres=$p"
  [ "$q" = "healthy" ] && [ "$p" = "healthy" ] && break
  sleep 5
done

# 5. Initialize collections / schema / indexes
say "Initializing Qdrant collections and indexes"
# shellcheck disable=SC1091
set -a; [ -f .env ] && . ./.env; set +a
bash init/run-init.sh

# 6. Import + activate the scheduled workflows
say "Importing memory workflows into n8n"
# Give n8n a moment to finish first-boot migrations.
sleep 15
bash workflows/import-workflows.sh || echo "   (workflow import had issues — see n8n UI at the n8n port)"

# 6b. Restart n8n so the imported webhook workflows register their endpoints,
# then seed the DRM-canary fixture memories the weekly canary probes against.
say "Registering webhooks and seeding DRM-canary fixtures"
$DOCKER compose restart n8n >/dev/null 2>&1 || true
sleep 20
bash init/seed-canary-fixtures.sh || \
  echo "   (canary fixture seeding failed — re-run init/seed-canary-fixtures.sh once the stack is fully up)"

# 7. Done
say "Install complete"
DASH_PORT="${DASHBOARD_PORT:-8092}"
N8N_PORT="${N8N_PORT:-5679}"
cat <<EOF

  Dashboard:  http://localhost:${DASH_PORT}
  n8n:        http://localhost:${N8N_PORT}   (create your Qdrant + Anthropic credentials here)
  Qdrant:     http://localhost:${QDRANT_PORT:-6334}

  Next steps:
    1. Open n8n and create the credentials the workflows reference
       (a Qdrant "api-key" header credential, and an Anthropic API credential).
    2. Set your dashboard password hash in .env (DASHBOARD_PASS_HASH) and
       re-run: docker compose up -d
    3. Point your MCP client at the MCP server (see bulletproof-memory README).

EOF
