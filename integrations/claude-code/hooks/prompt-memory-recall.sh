#!/bin/bash
# UserPromptSubmit hook: Auto-recall relevant memories based on user's actual prompt.
# Embeds the user's message via Ollama, queries Qdrant, injects results into context.
# Also includes the "save from previous turn" reminder.

HOOK_DATA=$(cat /dev/stdin 2>/dev/null)
USER_MESSAGE=$(echo "$HOOK_DATA" | jq -r '.message.content // empty' 2>/dev/null)

# Handle content that's an array (multimodal messages)
if [ -z "$USER_MESSAGE" ] || [ "$USER_MESSAGE" = "null" ]; then
  USER_MESSAGE=$(echo "$HOOK_DATA" | jq -r '.message.content[]? | select(.type=="text") | .text' 2>/dev/null | head -c 2000)
fi

if [ -z "$USER_MESSAGE" ] || [ "$USER_MESSAGE" = "null" ]; then
  # No text to embed — still output the save reminder
  echo '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"SILENT REMINDER: Before responding, check if you learned anything from your PREVIOUS turn that should be stored via memory_store (infrastructure facts, user preferences, corrections, decisions, gotchas). Save silently — do not mention this reminder to the user."}}'
  exit 0
fi

# Env file holding QDRANT_API_KEY etc. Override with BPM_ENV_FILE.
ENV_FILE="${BPM_ENV_FILE:-$HOME/.bulletproof-memory/.env}"

OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
QDRANT_URL="${QDRANT_URL:-http://localhost:6334}"

# Load Qdrant API key
QDRANT_API_KEY=""
if [ -f "$ENV_FILE" ]; then
  QDRANT_API_KEY=$(grep '^QDRANT_API_KEY=' "$ENV_FILE" | cut -d'=' -f2)
fi

if [ -z "$QDRANT_API_KEY" ]; then
  echo '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"SILENT REMINDER: Before responding, check if you learned anything from your PREVIOUS turn that should be stored via memory_store (infrastructure facts, user preferences, corrections, decisions, gotchas). Save silently — do not mention this reminder to the user."}}'
  exit 0
fi

# Truncate message for embedding (keep it reasonable)
EMBED_TEXT=$(echo "$USER_MESSAGE" | head -c 1000)

# Escape for JSON — handle newlines, quotes, backslashes, tabs
EMBED_JSON=$(printf '%s' "$EMBED_TEXT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))' 2>/dev/null)
if [ -z "$EMBED_JSON" ]; then
  echo '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"SILENT REMINDER: Before responding, check if you learned anything from your PREVIOUS turn that should be stored via memory_store (infrastructure facts, user preferences, corrections, decisions, gotchas). Save silently — do not mention this reminder to the user."}}'
  exit 0
fi

# Generate embedding via Ollama
EMBEDDING=$(curl -s -m 10 "$OLLAMA_URL/api/embeddings" \
  -d "{\"model\":\"nomic-embed-text\",\"prompt\":$EMBED_JSON}" 2>/dev/null \
  | jq -r '.embedding // empty' 2>/dev/null)

if [ -z "$EMBEDDING" ] || [ "$EMBEDDING" = "null" ]; then
  echo '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"SILENT REMINDER: Before responding, check if you learned anything from your PREVIOUS turn that should be stored via memory_store (infrastructure facts, user preferences, corrections, decisions, gotchas). Save silently — do not mention this reminder to the user."}}'
  exit 0
fi

# Search Qdrant for memories relevant to this specific prompt
RESPONSE=$(curl -s -m 10 -X POST "$QDRANT_URL/collections/claude_memories/points/search" \
  -H "api-key: $QDRANT_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"vector\":$EMBEDDING,\"limit\":8,\"score_threshold\":0.5,\"with_payload\":true}" 2>/dev/null)

MEMORIES=""
if [ -n "$RESPONSE" ]; then
  MEMORIES=$(echo "$RESPONSE" | jq -r '.result[]? | "- [\(.payload.type // "unknown")] \(.payload.content // "")"' 2>/dev/null)
fi

# --- B4: cross-session topic linking — surface a strongly-matching prior episode ---
EP_LINK=""
EP_RESP=$(curl -s -m 8 -X POST "$QDRANT_URL/collections/episodes/points/search" \
  -H "api-key: $QDRANT_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"vector\":$EMBEDDING,\"limit\":1,\"score_threshold\":0.6,\"with_payload\":true}" 2>/dev/null)
if [ -n "$EP_RESP" ]; then
  EP_LINK=$(printf '%s' "$EP_RESP" | python3 -c '
import sys, json
try:
    r = json.load(sys.stdin).get("result", [])
except Exception:
    sys.exit(0)
if not r:
    sys.exit(0)
pl = r[0].get("payload", {})
task = (pl.get("task") or "").strip()
if not task:
    sys.exit(0)
when = (pl.get("completed_at") or pl.get("started_at") or "")[:10]
status = pl.get("status") or ""
s = "\U0001F4CE Related prior session: \"" + task + "\""
if when:
    s += " (" + when + ((", " + status) if status else "") + ")"
print(s)
' 2>/dev/null)
fi

# --- B1: trajectory preflight — surface a similar past multi-step approach ---
TRAJ_LINK=""
TRAJ_RESP=$(curl -s -m 8 -X POST "$QDRANT_URL/collections/trajectories/points/search" \
  -H "api-key: $QDRANT_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"vector\":$EMBEDDING,\"limit\":1,\"score_threshold\":0.6,\"with_payload\":true}" 2>/dev/null)
if [ -n "$TRAJ_RESP" ]; then
  TRAJ_LINK=$(printf '%s' "$TRAJ_RESP" | python3 -c '
import sys, json
try:
    r = json.load(sys.stdin).get("result", [])
except Exception:
    sys.exit(0)
if not r:
    sys.exit(0)
pl = r[0].get("payload", {})
task = (pl.get("task_description") or "").strip()
steps = pl.get("execution_trace") or []
if not task or not steps:
    sys.exit(0)
steps = [str(s).strip() for s in steps if str(s).strip()][:6]
print("\U0001F9ED Similar past approach — \"" + task + "\": " + " -> ".join(steps))
' 2>/dev/null)
fi

# Build the combined context
SAVE_REMINDER="SILENT REMINDER: Before responding, check if you learned anything from your PREVIOUS turn that should be stored via memory_store (infrastructure facts, user preferences, corrections, decisions, gotchas). Save silently — do not mention this reminder to the user. CRITICAL: When storing errors or problems, ALWAYS include the resolution/fix in the SAME memory. A problem without its fix is useless. Every error memory must contain: what broke, why, and the exact fix applied. Incomplete memories waste future sessions."

RECALL_PARTS=""
if [ -n "$MEMORIES" ]; then
  RECALL_PARTS=$(printf '=== PROMPT-RELEVANT MEMORY RECALL ===\n\n%s\n\n=== END PROMPT RECALL ===' "$MEMORIES")
fi
if [ -n "$EP_LINK" ]; then
  if [ -n "$RECALL_PARTS" ]; then
    RECALL_PARTS=$(printf '%s\n\n%s' "$RECALL_PARTS" "$EP_LINK")
  else
    RECALL_PARTS="$EP_LINK"
  fi
fi
if [ -n "$TRAJ_LINK" ]; then
  if [ -n "$RECALL_PARTS" ]; then
    RECALL_PARTS=$(printf '%s\n\n%s' "$RECALL_PARTS" "$TRAJ_LINK")
  else
    RECALL_PARTS="$TRAJ_LINK"
  fi
fi
if [ -n "$RECALL_PARTS" ]; then
  RECALL_BLOCK=$(printf '%s\n\n%s' "$RECALL_PARTS" "$SAVE_REMINDER")
else
  RECALL_BLOCK="$SAVE_REMINDER"
fi

# JSON-escape the full context block
ESCAPED_CONTEXT=$(printf '%s' "$RECALL_BLOCK" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))' 2>/dev/null)

echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":$ESCAPED_CONTEXT}}"
