#!/bin/bash

# Initialize Qdrant collections for Claude Memory v3.0
# Includes tiered memory, procedural memory, trajectories, and links

QDRANT_URL="${QDRANT_URL:-http://localhost:6334}"
QDRANT_API_KEY="${QDRANT_API_KEY:?QDRANT_API_KEY must be set}"
VECTOR_SIZE=768  # nomic-embed-text dimension

echo "=== Claude Memory v3.0 Collection Initialization ==="
echo "Qdrant URL: $QDRANT_URL"
echo ""

# Function to create collection
create_collection() {
    local name=$1
    local description=$2

    echo "Creating collection: $name ($description)"

    curl -s -X PUT "$QDRANT_URL/collections/$name" \
        -H "api-key: $QDRANT_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"vectors\": {
                \"size\": $VECTOR_SIZE,
                \"distance\": \"Cosine\"
            },
            \"optimizers_config\": {
                \"indexing_threshold\": 10000
            },
            \"on_disk_payload\": true
        }" | jq .

    echo ""
}

# Core memory collections (may already exist)
echo "=== Core Memory Collections ==="
create_collection "claude_memories" "Primary long-term memory storage"
create_collection "short_term_memory" "24-hour TTL memory"
create_collection "working_memory" "Session scratch space (1-hour TTL)"

# Tiered memory collections (NEW)
echo "=== Tiered Memory Collections (Hot/Warm/Cold) ==="
create_collection "memories_hot" "Frequently accessed, last 7 days"
create_collection "memories_warm" "Project-active, moderate access"
create_collection "memories_cold" "Archived, rarely accessed (>90 days)"

# Specialized collections (may already exist)
echo "=== Specialized Collections ==="
create_collection "episodes" "Task execution episodes"
create_collection "learnings" "Extracted learnings"
create_collection "benchmarks" "Performance benchmarks"

# NEW specialized collections
echo "=== New Specialized Collections ==="
create_collection "procedures" "Procedural memory - reusable task patterns"
create_collection "trajectories" "Successful execution traces for few-shot learning"
create_collection "memory_links" "Memory relationship graph edges"

echo "=== Creating payload indexes for efficient filtering ==="

# Index common filter fields
for collection in claude_memories short_term_memory memories_hot memories_warm memories_cold; do
    echo "Indexing $collection..."

    # Type index
    curl -s -X PUT "$QDRANT_URL/collections/$collection/index" \
        -H "api-key: $QDRANT_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"field_name": "type", "field_schema": "keyword"}' > /dev/null

    # Project index
    curl -s -X PUT "$QDRANT_URL/collections/$collection/index" \
        -H "api-key: $QDRANT_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"field_name": "project", "field_schema": "keyword"}' > /dev/null

    # Tier index
    curl -s -X PUT "$QDRANT_URL/collections/$collection/index" \
        -H "api-key: $QDRANT_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"field_name": "tier", "field_schema": "keyword"}' > /dev/null

    # Created_at index for time-based queries
    curl -s -X PUT "$QDRANT_URL/collections/$collection/index" \
        -H "api-key: $QDRANT_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"field_name": "created_at", "field_schema": "keyword"}' > /dev/null

    # Access count for hot/warm/cold migration
    curl -s -X PUT "$QDRANT_URL/collections/$collection/index" \
        -H "api-key: $QDRANT_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"field_name": "access_count", "field_schema": "integer"}' > /dev/null
done

# Procedure-specific indexes
echo "Indexing procedures..."
curl -s -X PUT "$QDRANT_URL/collections/procedures/index" \
    -H "api-key: $QDRANT_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"field_name": "task_type", "field_schema": "keyword"}' > /dev/null

curl -s -X PUT "$QDRANT_URL/collections/procedures/index" \
    -H "api-key: $QDRANT_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"field_name": "domain", "field_schema": "keyword"}' > /dev/null

curl -s -X PUT "$QDRANT_URL/collections/procedures/index" \
    -H "api-key: $QDRANT_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"field_name": "status", "field_schema": "keyword"}' > /dev/null

# Link-specific indexes
echo "Indexing memory_links..."
curl -s -X PUT "$QDRANT_URL/collections/memory_links/index" \
    -H "api-key: $QDRANT_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"field_name": "source_id", "field_schema": "keyword"}' > /dev/null

curl -s -X PUT "$QDRANT_URL/collections/memory_links/index" \
    -H "api-key: $QDRANT_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"field_name": "target_id", "field_schema": "keyword"}' > /dev/null

curl -s -X PUT "$QDRANT_URL/collections/memory_links/index" \
    -H "api-key: $QDRANT_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"field_name": "relationship", "field_schema": "keyword"}' > /dev/null

echo ""
echo "=== Collection Status ==="
curl -s "$QDRANT_URL/collections" -H "api-key: $QDRANT_API_KEY" | jq '.result.collections[] | {name, vectors_count, points_count}'

echo ""
echo "=== Initialization Complete ==="
echo "New capabilities:"
echo "  - Procedural memory (procedure tool)"
echo "  - Trajectory learning (trajectory tool)"
echo "  - Memory self-organization (memory_organize tool)"
echo "  - Tiered storage ready (hot/warm/cold)"
echo ""
echo "Run 'npm run build' in claude-memory-mcp/ then restart Claude Code"
