#!/bin/bash
set -e
[ -f "$(dirname "$0")/../.env" ] && source "$(dirname "$0")/../.env"
QDRANT_URL="${QDRANT_URL:-http://localhost:6334}"
QDRANT_API_KEY="${QDRANT_API_KEY:-}"

echo "Creating session_transcripts collection..."
curl -s -X PUT "$QDRANT_URL/collections/session_transcripts" \
  -H "Content-Type: application/json" \
  -H "api-key: $QDRANT_API_KEY" \
  -d '{"vectors": {"size": 768, "distance": "Cosine"}}'

echo ""
echo "Creating payload indexes..."
curl -s -X PUT "$QDRANT_URL/collections/session_transcripts/index" \
  -H "Content-Type: application/json" \
  -H "api-key: $QDRANT_API_KEY" \
  -d '{"field_name": "processed", "field_schema": "bool"}'

curl -s -X PUT "$QDRANT_URL/collections/session_transcripts/index" \
  -H "Content-Type: application/json" \
  -H "api-key: $QDRANT_API_KEY" \
  -d '{"field_name": "expires_at", "field_schema": "keyword"}'

echo ""
echo "session_transcripts collection created with indexes on processed and expires_at"
