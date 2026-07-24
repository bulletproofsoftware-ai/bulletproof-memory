#!/bin/bash
# REQ-EVO-001 + REQ-EVO-002: Create payload indexes for causal graph and temporal reasoning
# Idempotent — Qdrant returns 200 if index already exists

set -euo pipefail

QDRANT_URL="${QDRANT_URL:-http://localhost:6334}"
QDRANT_API_KEY="${QDRANT_API_KEY:-}"

echo "Creating REQ-EVO indexes on Qdrant at ${QDRANT_URL}..."

# REQ-EVO-001: Causal edge type index on memory_links
echo "  memory_links.edge_type (keyword)..."
curl -s -X PUT "${QDRANT_URL}/collections/memory_links/index" \
  -H "api-key: ${QDRANT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"field_name": "edge_type", "field_schema": "keyword"}' | jq -r '.status // .result'

# REQ-EVO-001: Auto-generated flag on memory_links
echo "  memory_links.auto_generated (bool)..."
curl -s -X PUT "${QDRANT_URL}/collections/memory_links/index" \
  -H "api-key: ${QDRANT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"field_name": "auto_generated", "field_schema": "bool"}' | jq -r '.status // .result'

# REQ-EVO-002: Temporal class index on claude_memories
echo "  claude_memories.temporal_class (keyword)..."
curl -s -X PUT "${QDRANT_URL}/collections/claude_memories/index" \
  -H "api-key: ${QDRANT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"field_name": "temporal_class", "field_schema": "keyword"}' | jq -r '.status // .result'

# REQ-EVO-002: Last verified date index
echo "  claude_memories.last_verified_date (keyword)..."
curl -s -X PUT "${QDRANT_URL}/collections/claude_memories/index" \
  -H "api-key: ${QDRANT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"field_name": "last_verified_date", "field_schema": "keyword"}' | jq -r '.status // .result'

# REQ-EVO-002: Deadline date index
echo "  claude_memories.deadline_date (keyword)..."
curl -s -X PUT "${QDRANT_URL}/collections/claude_memories/index" \
  -H "api-key: ${QDRANT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"field_name": "deadline_date", "field_schema": "keyword"}' | jq -r '.status // .result'

echo "Done. All REQ-EVO indexes created."
