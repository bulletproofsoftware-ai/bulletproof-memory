#!/bin/bash
# SessionStart hook: Auto-recall relevant memories from Qdrant.
# Works on both laptop (macOS) and c2 (Linux). Detects host automatically.
# Queries Qdrant directly via API for reliability (no n8n dependency).

SESSION_DATA=$(cat /dev/stdin 2>/dev/null)
CWD=$(echo "$SESSION_DATA" | jq -r '.cwd // empty' 2>/dev/null)

if [ -z "$CWD" ]; then
  exit 0
fi

# Env file holding QDRANT_API_KEY etc. Override with BPM_ENV_FILE.
ENV_FILE="${BPM_ENV_FILE:-$HOME/.bulletproof-memory/.env}"
OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"

# Load Qdrant API key from .env
QDRANT_API_KEY=""
if [ -f "$ENV_FILE" ]; then
  QDRANT_API_KEY=$(grep '^QDRANT_API_KEY=' "$ENV_FILE" | cut -d'=' -f2)
fi

if [ -z "$QDRANT_API_KEY" ]; then
  exit 0
fi

QDRANT_URL="http://localhost:6334"

# Extract project name from CWD for the query
PROJECT_NAME=$(basename "$CWD")

# Generate embedding via Ollama for semantic search
EMBED_TEXT="project $PROJECT_NAME context preferences workflow decisions corrections"
EMBEDDING=$(curl -s -m 15 "$OLLAMA_URL/api/embeddings" \
  -d "{\"model\":\"nomic-embed-text\",\"prompt\":\"$EMBED_TEXT\"}" 2>/dev/null \
  | jq -r '.embedding // empty' 2>/dev/null)

if [ -z "$EMBEDDING" ] || [ "$EMBEDDING" = "null" ]; then
  exit 0
fi

# Search claude_memories collection directly via Qdrant API
RESPONSE=$(curl -s -m 10 -X POST "$QDRANT_URL/collections/claude_memories/points/search" \
  -H "api-key: $QDRANT_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"vector\":$EMBEDDING,\"limit\":10,\"score_threshold\":0.4,\"with_payload\":true}" 2>/dev/null)

if [ -z "$RESPONSE" ]; then
  exit 0
fi

# Extract memory contents
MEMORIES=$(echo "$RESPONSE" | jq -r '.result[]? | "- [\(.payload.type // "unknown")] \(.payload.content // "")"' 2>/dev/null)

if [ -z "$MEMORIES" ]; then
  exit 0
fi

echo "=== QDRANT MEMORY RECALL (auto-loaded for $PROJECT_NAME) ==="
echo ""
echo "$MEMORIES"
echo ""
echo "=== END AUTO-RECALL ==="
