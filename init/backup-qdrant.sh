#!/bin/bash
# Backup Qdrant collections via snapshot API.

QDRANT_URL="${QDRANT_URL:-http://localhost:6334}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/.bulletproof-memory/backups/qdrant}"
DATE=$(date +%Y-%m-%d)

# API key: from env, or from an optional env file (override with BPM_ENV_FILE).
ENV_FILE="${BPM_ENV_FILE:-$HOME/.bulletproof-memory/.env}"
QDRANT_API_KEY="${QDRANT_API_KEY:-}"
if [ -z "$QDRANT_API_KEY" ] && [ -f "$ENV_FILE" ]; then
    QDRANT_API_KEY=$(grep '^QDRANT_API_KEY=' "$ENV_FILE" | cut -d'=' -f2)
fi

mkdir -p "$BACKUP_DIR"

# Create snapshots for each collection
for collection in claude_memories claude_short_term; do
    echo "[$(date)] Creating snapshot for $collection..."
    RESULT=$(curl -sf -X POST "$QDRANT_URL/collections/$collection/snapshots" -H "api-key: $QDRANT_API_KEY" 2>/dev/null)
    if [ $? -eq 0 ]; then
        SNAPSHOT=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['name'])" 2>/dev/null)
        if [ -n "$SNAPSHOT" ]; then
            curl -sf "$QDRANT_URL/collections/$collection/snapshots/$SNAPSHOT" -H "api-key: $QDRANT_API_KEY" -o "$BACKUP_DIR/${collection}-${DATE}.snapshot" 2>/dev/null
            echo "[$(date)] Backed up $collection -> ${collection}-${DATE}.snapshot"
        fi
    else
        echo "[$(date)] ERROR: Failed to snapshot $collection"
    fi
done

# Prune backups older than 7 days
find "$BACKUP_DIR" -name "*.snapshot" -mtime +7 -delete 2>/dev/null
echo "[$(date)] Backup complete"
