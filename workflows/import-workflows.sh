#!/usr/bin/env bash
# Import all memory workflows into the running n8n container.
# Workflows are bind-mounted at /workflows and carry stable ids.
set -euo pipefail

DOCKER="${DOCKER:-docker}"
N8N_CONTAINER="${N8N_CONTAINER:-$($DOCKER compose ps -q n8n 2>/dev/null || echo n8n)}"

if [ -z "$N8N_CONTAINER" ]; then
  echo "ERROR: n8n container not found. Is the stack up? (docker compose up -d)" >&2
  exit 1
fi

# n8n (2.x) assigns imported workflows to a project. Discover the personal
# project id from the n8n database so import doesn't hit a FK constraint.
PROJECT_ID="${N8N_PROJECT_ID:-}"
if [ -z "$PROJECT_ID" ]; then
  PG_CONTAINER="$($DOCKER compose ps -q postgres 2>/dev/null || echo postgres)"
  PROJECT_ID="$($DOCKER exec "$PG_CONTAINER" psql -U "${MEMPG_USER:-memory}" -d "${MEMPG_DB:-memory}" -tAc \
    "SELECT id FROM project WHERE type='personal' ORDER BY \"createdAt\" LIMIT 1;" 2>/dev/null | tr -d '[:space:]' || true)"
fi

PROJ_ARG=()
if [ -n "$PROJECT_ID" ]; then
  echo "==> Importing into n8n personal project: $PROJECT_ID"
  PROJ_ARG=(--projectId="$PROJECT_ID")
else
  echo "==> No project id discovered; importing without one (n8n may assign a default)."
fi

echo "==> Importing workflows (container: $N8N_CONTAINER)"
$DOCKER exec "$N8N_CONTAINER" n8n import:workflow --separate --input=/workflows "${PROJ_ARG[@]}" 2>&1 \
  | grep -vE 'Error tracking' || true

echo "==> Activating imported workflows"
$DOCKER exec "$N8N_CONTAINER" sh -c '
  for id in $(n8n list:workflow 2>/dev/null | grep -vE "Error tracking" | cut -d"|" -f1); do
    n8n update:workflow --id="$id" --active=true >/dev/null 2>&1 || true
  done
' || echo "   (activation had non-fatal errors — activate in the n8n UI if needed)"

COUNT=$($DOCKER exec "$N8N_CONTAINER" sh -c 'n8n list:workflow 2>/dev/null | grep -vcE "Error tracking"' | tr -d ' ')
echo "==> Done. Workflows present in n8n: $COUNT"
