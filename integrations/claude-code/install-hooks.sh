#!/usr/bin/env bash
# Print the ~/.claude/settings.json hook snippet with absolute paths resolved.
set -euo pipefail
HOOK_DIR="$(cd "$(dirname "$0")/hooks" && pwd)"
cat <<JSON
Add this to the "hooks" section of ~/.claude/settings.json:

  "UserPromptSubmit": [
    { "hooks": [{ "type": "command",
      "command": "bash $HOOK_DIR/prompt-memory-recall.sh" }] }
  ],
  "SessionStart": [
    { "hooks": [{ "type": "command",
      "command": "bash $HOOK_DIR/load-project-memory.sh" }] }
  ]

Then set (or add to your shell profile):
  export BPM_ENV_FILE="\$HOME/.bulletproof-memory/.env"
JSON
