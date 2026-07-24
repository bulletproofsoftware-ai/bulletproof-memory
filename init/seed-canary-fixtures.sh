#!/usr/bin/env bash
# Seed the DRM-canary fixture memories through the Claude Memory Gateway.
#
# The weekly DRM canary (workflows/memory-drm-canary-weekly-mon-3am.json)
# probes recall accuracy against these ten fixture facts about the shipped
# stack itself, so a fresh install can satisfy every case. Idempotent in
# effect: re-running stores duplicate fixtures, which the exact-dedup
# workflow removes on its next run.
#
# Requires the stack to be up with workflows imported and active
# (docker compose up -d && workflows/import-workflows.sh).
#
# Env:
#   MEMORY_GATEWAY_URL  gateway endpoint (default http://localhost:${N8N_PORT:-5679}/webhook/memory)
#   WEBHOOK_API_KEY     gateway API key (required; same value the n8n stack uses)
set -euo pipefail

GATEWAY_URL="${MEMORY_GATEWAY_URL:-http://localhost:${N8N_PORT:-5679}/webhook/memory}"
: "${WEBHOOK_API_KEY:?WEBHOOK_API_KEY must be set (the gateway rejects unauthenticated requests)}"

FIXTURES=(
  "The memory system embeds all content with the nomic-embed-text model."
  "Memory embeddings are 768-dimensional vectors."
  "Memories move between tier levels: hot, warm, and cold."
  "Memgraph exposes the bolt protocol on port 7687 for graph queries."
  "The primary Qdrant collection storing memories is claude_memories."
  "Hippocampal consolidation runs nightly to consolidate episodic memories."
  "Session transcripts are full-text searchable via a stored generated tsvector column."
  "The weekly DRM canary probes recall accuracy with fixed query/answer pairs."
  "Ollama is the service that generates the embeddings for memory storage and recall."
  "Canary run results are recorded in the audit.memory_health table."
)

echo "==> Seeding ${#FIXTURES[@]} canary fixture memories via $GATEWAY_URL"
i=0
for content in "${FIXTURES[@]}"; do
  i=$((i+1))
  BODY=$(python3 - "$content" <<'PY'
import json, sys
print(json.dumps({"action": "store", "content": sys.argv[1],
                  "type": "fact", "tags": ["canary-fixture"]}))
PY
)
  if curl -sf -X POST "$GATEWAY_URL" \
      -H "Content-Type: application/json" \
      -H "x-api-key: $WEBHOOK_API_KEY" \
      -d "$BODY" >/dev/null; then
    echo "   [$i/${#FIXTURES[@]}] seeded"
  else
    echo "   [$i/${#FIXTURES[@]}] FAILED — is the stack up with workflows imported?" >&2
    exit 1
  fi
done
echo "==> Canary fixtures seeded."
