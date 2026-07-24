#!/bin/bash
# Initialize Qdrant collection for Claude memories

set -e

# Load environment variables if a .env is present alongside the stack.
[ -f "$(dirname "$0")/../.env" ] && source "$(dirname "$0")/../.env"

QDRANT_URL="${QDRANT_URL:-http://localhost:6334}"
QDRANT_API_KEY="${QDRANT_API_KEY:-}"

echo "Waiting for Qdrant to be ready at $QDRANT_URL ..."
tries=0
until curl -s "$QDRANT_URL/collections" -H "api-key: $QDRANT_API_KEY" 2>/dev/null | grep -q "collections"; do
    tries=$((tries + 1))
    if [ "$tries" -ge 30 ]; then
        echo "ERROR: Qdrant not ready after 60s. Check QDRANT_URL and QDRANT_API_KEY." >&2
        curl -s "$QDRANT_URL/collections" -H "api-key: $QDRANT_API_KEY" | head -c 200 >&2; echo >&2
        exit 1
    fi
    echo "Qdrant not ready, waiting... ($tries/30)"
    sleep 2
done

echo "Qdrant is ready. Creating collection..."

# Create the claude_memories collection with API key
curl -s -X PUT "$QDRANT_URL/collections/claude_memories" \
  -H "Content-Type: application/json" \
  -H "api-key: $QDRANT_API_KEY" \
  -d '{
    "vectors": {
      "size": 768,
      "distance": "Cosine"
    }
  }'

echo ""
echo "Collection created successfully!"

# Verify collection
echo "Verifying collection..."
curl -s "$QDRANT_URL/collections/claude_memories" \
  -H "api-key: $QDRANT_API_KEY" | jq .

echo ""
echo "Qdrant initialization complete!"
