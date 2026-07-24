# Claude Code integration (optional)

The memory system runs fully without Claude Code. If you *do* use
[Claude Code](https://claude.com/claude-code), these hooks add automatic
memory recall and project-memory loading at session start.

## Hooks

- **`hooks/prompt-memory-recall.sh`** — on each user prompt, embeds the prompt
  (via Ollama), searches Qdrant (`claude_memories` + `episodes`), and injects the
  top matches as context.
- **`hooks/load-project-memory.sh`** — at session start, loads memories scoped to
  the current project.

Both read your Qdrant API key from an env file. Point them at it with:

```bash
export BPM_ENV_FILE="$HOME/.bulletproof-memory/.env"   # defaults to this if unset
```

(That `.env` just needs `QDRANT_API_KEY=...`; the stack's root `.env` works too.)

## Install

Wire them into `~/.claude/settings.json` as hooks. Example:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command",
        "command": "bash /path/to/bulletproof-memory/integrations/claude-code/hooks/prompt-memory-recall.sh" }] }
    ],
    "SessionStart": [
      { "hooks": [{ "type": "command",
        "command": "bash /path/to/bulletproof-memory/integrations/claude-code/hooks/load-project-memory.sh" }] }
    ]
  }
}
```

Run `./install-hooks.sh` to print the exact snippet with absolute paths filled in.
