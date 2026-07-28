# Deployment Guide

## Overview

Claude Memory MCP v1.1 adds three production features:
1. **Provenance gates** — policy-enforced memory trust levels
2. **Recall traces** — durable audit trail of every recall with analytics
3. **Self-test harness** — live health check of all dependencies

This guide covers upgrading from v1.0 and new deployment requirements.

## Breaking Change: GOVERNANCE_API_KEY (v1.1)

### The Change
In v1.0, the governance HTTP server could fall back to `QDRANT_API_KEY` if `GOVERNANCE_API_KEY` was not set. **This fallback has been removed in v1.1** for security (hardening commit a99de92).

### What Fails
If you upgrade without setting `GOVERNANCE_API_KEY`:
```
Governance HTTP server NOT started: GOVERNANCE_API_KEY is not set.
Set this to a strong value different from QDRANT_API_KEY — it no longer
falls back to QDRANT_API_KEY. Set GOVERNANCE_API_KEY to enable it.
```

The governance HTTP bridge (`/governance/health`, `/tools/call`, `/governance/report`) will not start. If you depend on this for Claude Code's governance hooks, your integrity checks will fail or degrade.

### How to Fix
**Before upgrading**, ensure you have set `GOVERNANCE_API_KEY`:

```bash
# In .env or your environment setup script:
export GOVERNANCE_API_KEY="<strong-random-32-char-value>"

# e.g. using openssl:
export GOVERNANCE_API_KEY=$(openssl rand -hex 16)

# Or in the launchd plist (if running via daemon):
# Add this key-value pair:
#   <key>GOVERNANCE_API_KEY</key>
#   <string><strong-random-value></string>
```

The value should be:
- Random and strong (at least 32 characters, or use openssl rand)
- Different from `QDRANT_API_KEY`
- Kept in a secrets manager (not hardcoded in git)

### Post-Upgrade Verification
```bash
# Check that the HTTP bridge started:
curl -X GET http://localhost:5681/governance/health \
  -H "x-api-key: $GOVERNANCE_API_KEY"
# Should return: { "ok": true, ... }

# Or run the self-test:
npm run self-test --category governance
```

If the server doesn't start, check logs:
```bash
# For daemon:
log stream --predicate 'process == "node"' --level debug

# For direct run:
npm start 2>&1 | grep "Governance HTTP"
```

## Pre-Deployment Checklist

### Environment Variables
- [ ] `QDRANT_URL` — accessible, auth enabled if needed
- [ ] `QDRANT_API_KEY` — set and valid
- [ ] `CLAUDE_MEMORY_PG_HOST/PORT/USER/DB/PASSWORD` — PostgreSQL accessible with these credentials
- [ ] `GOVERNANCE_API_KEY` — set to a strong, unique value (NEW in v1.1)
- [ ] `OLLAMA_URL` / `OLLAMA_HOST` — embedding service running
- [ ] `GOVERNANCE_HTTP_PORT` — free (default 5681)
- [ ] Secrets stored in vault/secrets manager, not in `.env` or plist in git

### PostgreSQL
- [ ] User has CREATE TABLE rights on `audit` schema
- [ ] PostgreSQL at `CLAUDE_MEMORY_PG_HOST:CLAUDE_MEMORY_PG_PORT`
- [ ] Database `CLAUDE_MEMORY_PG_DB` exists
- [ ] Schemas present: `memory`, `audit`, `operational`
  ```sql
  \dn  -- list schemas
  ```
- [ ] Tables exist:
  ```sql
  SELECT tablename FROM pg_tables 
  WHERE schemaname = 'audit' OR schemaname = 'memory';
  ```
  
  Expected in `audit`: `memory_health` (pre-existing)
  
  Expected in `memory`: `beliefs`, `episodes`, `memories_cold`, `migration_tracker`, `session_transcripts`
  
  NEW in v1.1 — apply migrations to create:
  - `audit.recall_trace`
  - `audit.recall_trace_result`
  
  See **PostgreSQL Migrations** below.

### Qdrant
- [ ] Collection `claude_memories` exists
- [ ] Collections `memories_hot`, `memories_warm`, `memories_cold`, `audit_log` present (or created on first write)

### Memgraph
- [ ] Bolt endpoint accessible at configured URL (default `bolt://localhost:7687`)
- [ ] Graph initialized with `memory_links` relationship type

### Ollama
- [ ] Embedding service running and healthy
- [ ] Configured model available (default `nomic-embed-text`)
  ```bash
  curl http://localhost:11434/api/tags
  ```

### n8n (Optional)
- [ ] If running `DRM canary` or other workflows, n8n accessible
- [ ] Webhook API key set if using webhooks
- [ ] Workflows deployed

## PostgreSQL Migrations

### New Tables (Feature 2: Recall Traces)

Apply this migration to the COLD-tier PostgreSQL. **Preferred: use the dedicated runner** —
it applies the same idempotent SQL and then verifies both tables actually exist afterward
(fails loudly with a clear error if not, rather than silently leaving the recall-trace
feature non-functional):

```bash
# From repo root, with CLAUDE_MEMORY_PG_* exported (see the daemon plist for the canonical set):
npx tsx scripts/migrations/feature-recall-traces/run.ts
```

Or apply the raw SQL directly with `psql` (also idempotent — safe to re-run):

```bash
psql $CLAUDE_MEMORY_PG_CONNECTION_STRING < scripts/migrations/feature-recall-traces/001_recall_traces.sql
```

Or manually:

```sql
-- Connects to CLAUDE_MEMORY_PG_HOST:CLAUDE_MEMORY_PG_PORT as CLAUDE_MEMORY_PG_USER
CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS audit.recall_trace (
    trace_id        uuid        PRIMARY KEY,
    query           text        NOT NULL,
    project         text,
    strategy        text,
    result_count    integer     NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    session_id      text,
    agent_id        text
);

CREATE INDEX IF NOT EXISTS idx_recall_trace_created_at
    ON audit.recall_trace (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recall_trace_project
    ON audit.recall_trace (project);

CREATE TABLE IF NOT EXISTS audit.recall_trace_result (
    id              bigserial   PRIMARY KEY,
    trace_id        uuid        NOT NULL
                        REFERENCES audit.recall_trace(trace_id) ON DELETE CASCADE,
    memory_id       text        NOT NULL,
    rank            integer     NOT NULL,
    score           double precision,
    tier            text,
    was_used        boolean,
    ignore_reason   text,
    feedback_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_recall_trace_result_trace
    ON audit.recall_trace_result (trace_id);
CREATE INDEX IF NOT EXISTS idx_recall_trace_result_memory
    ON audit.recall_trace_result (memory_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_recall_trace_result_trace_memory
    ON audit.recall_trace_result (trace_id, memory_id);
```

## Deployment Steps

### 1. Stage the Code
```bash
cd /path/to/claude-memory-mcp
git pull origin main
npm install
npm run build
```

### 2. Verify Configuration
```bash
# Set all required env vars (or source your .env / plist)
export GOVERNANCE_API_KEY="..."  # NEW in v1.1!
export QDRANT_API_KEY="..."
export CLAUDE_MEMORY_PG_USER="..."
export CLAUDE_MEMORY_PG_PASSWORD="..."
export CLAUDE_MEMORY_PG_DB="..."

# Check connectivity
npm run self-test
```

### 3. Apply Migrations
```bash
psql -h $CLAUDE_MEMORY_PG_HOST \
     -p $CLAUDE_MEMORY_PG_PORT \
     -U $CLAUDE_MEMORY_PG_USER \
     -d $CLAUDE_MEMORY_PG_DB \
     < scripts/migrations/feature-recall-traces/001_recall_traces.sql
```

### 4. Start/Restart Server
```bash
# If running as daemon (macOS):
launchctl unload ~/Library/LaunchAgents/com.claude.memory-tools-daemon.plist
launchctl load ~/Library/LaunchAgents/com.claude.memory-tools-daemon.plist

# If running manually:
npm start
```

### 5. Verify Startup
```bash
# Check logs (daemon):
log stream --predicate 'process == "node"' --level debug

# Check governance HTTP bridge:
curl -X GET http://localhost:5681/governance/health \
  -H "x-api-key: $GOVERNANCE_API_KEY"

# Run smoke test:
npm run self-test
```

## Feature-Specific Deployment Notes

### Feature 1: Provenance Gates
- No new infrastructure required
- Works immediately after deploy with backward compatibility
- Existing `memory_store` calls without provenance fields work unchanged
- Governance hook (`~/Code/governance-plugin`) must also be synced (separate repo)

### Feature 2: Recall Traces
- **Requires PostgreSQL migration** (see above)
- Traces fire-and-forget (fail-open) — never delay recall
- Retention: 90 days by default
  ```sql
  -- Manual prune:
  SELECT audit.prune_recall_traces(90);  -- drop traces older than 90 days
  ```

### Feature 3: Self-Test Harness
- No infrastructure changes
- Use to verify deployment health:
  ```bash
  npm run self-test
  npx tsx scripts/self-test.ts --json  # machine-readable
  ```

## Rollback Plan

### If GOVERNANCE_API_KEY Is Wrong
```bash
# Temporarily set fallback in env:
export GOVERNANCE_API_KEY=$(echo -n "$QDRANT_API_KEY" | openssl dgst -sha256)
# (This allows the server to start; fix the real value soon)

# Or disable governance HTTP entirely (temporary):
export GOVERNANCE_HTTP_PORT=0  # skip starting the bridge
```

### If Recall Traces Cause Issues
- Trace writes are fail-open — they never block recall
- If PostgreSQL is down, recalls still work (traces just don't persist)
- If the tables don't exist, writes fail gracefully and are logged to stderr
- To disable traces temporarily, the feature has no kill-switch — the code always attempts the write

If you need to revert:
```bash
git revert a99de92  # revert security hardening
git revert 5cda577  # revert feature implementation
```

### If PostgreSQL Migration Fails
The new tables (`audit.recall_trace`, `audit.recall_trace_result`) are optional for operation — if migration fails, the feature degrades gracefully (traces just don't persist). Fix the PostgreSQL issue and re-apply the migration.

```bash
# Check migration status:
psql -h $CLAUDE_MEMORY_PG_HOST -U $CLAUDE_MEMORY_PG_USER -d $CLAUDE_MEMORY_PG_DB \
  -c "\dt audit.*"
```

## Monitoring

### Logs to Watch
- `Governance HTTP server listening on 0.0.0.0:5681` — startup success
- `[recall-trace][write]` — trace write failures (logged to stderr, non-fatal)
- `[memory-store][policy_reject]` — attempts to violate provenance policy

### Metrics to Track
- Recall latency (must not increase with trace writes)
- Postgres connection pool health (check logs for exhaustion)
- Governance HTTP bridge uptime (health check every 60s)
- n8n workflow completion rate (DRM canary, consolidation)

### Health Check
```bash
# HTTP bridge:
curl -s http://localhost:5681/governance/health -H "x-api-key: $GOVERNANCE_API_KEY" | jq .

# Full stack:
npm run self-test --category all
```

## Troubleshooting

### "GOVERNANCE_API_KEY is not set"
- Check: `echo $GOVERNANCE_API_KEY`
- If empty, set it in your `.env`, plist, or shell environment
- Restart the server after setting

### "Cannot connect to PostgreSQL"
- Check `CLAUDE_MEMORY_PG_HOST`, `CLAUDE_MEMORY_PG_PORT`, `CLAUDE_MEMORY_PG_USER`, `CLAUDE_MEMORY_PG_PASSWORD`
- Test manually: `psql -h $HOST -p $PORT -U $USER -d $DB`

### "recall_trace table does not exist"
- Apply the migration: see **PostgreSQL Migrations** section
- Traces will not persist until the table exists, but recalls will still work

### "Governance hook is blocking recalls"
- Check that the hook in `~/Code/governance-plugin` is also updated to v1.1
- The hook runs in parallel to the server's policy gate — they enforce the same rule
- If only the hook is updated (and server is old), policy blocks might occur from the hook even though the server would allow it

### "Self-test reports SKIP for governance"
- If `SELFTEST_GOV_OPTIONAL=1`, governance tests are skipped (expected for dev setups)
- If `GOVERNANCE_API_KEY` is not set, governance tests fail — this is the issue to fix

## Support

- **Self-test:** [`self-test.md`](self-test.md)
- **Issues:** Check logs and run `npm run self-test --json` for diagnostics
