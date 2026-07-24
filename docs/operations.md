# Operations — the scheduled memory workflows

The stack ships **34 n8n workflows**. Most are time-scheduled (the schedule is encoded
in the filename); a few are event/webhook-driven helpers. All run inside the n8n
container, so scheduling is cross-platform — there is no host cron or launchd.

After install, they appear in the n8n UI (http://localhost:5679) and are activated by
`workflows/import-workflows.sh`. You can pause/edit any of them there.

## Daily

| Workflow | ~Time | Purpose |
|----------|-------|---------|
| `memory-contradiction-check` | 01:00 | Flag contradictory memories |
| `memory-daily-conflict-resolver` | 01:30 | Resolve flagged conflicts |
| `memory-exact-dedup` | 02:00 | Remove exact-duplicate memories |
| `memory-predictive-pattern-extraction` | 02:00 | Mine predictive patterns |
| `memory-ttl-sweep` | 03:00 UTC | Expire TTL'd memories |
| `memory-hippocampal-consolidation` | 03:00 | Consolidate short→long term |
| `memory-tier-transfer` | 03:30 | Move memories across hot/warm/cold tiers |
| `memory-stigmergy-decay` | 04:00 | Decay stigmergic pheromone trails |
| `memory-stigmergy-auto-reinforce` | 04:30 | Reinforce active trails |
| `memory-world-model-sync` | 05:00 | Sync the world-model collection |
| `memory-causal-pattern-extraction` | 05:30 | Extract causal graph edges |
| `memory-session-recording-sync` | 06:00 | Sync session recordings |
| `memory-memory-verify-sweep` | 06:30 | Verify memory integrity |
| `session-transcript-extraction` | every 4h | Extract + index session transcripts |

## Weekly

| Workflow | ~Time | Purpose |
|----------|-------|---------|
| `memory-hot-rehydration` | Sun 02:00 | Rehydrate the hot tier |
| `memory-memory-organize-clusters` | Sun 02:30 | Re-cluster memories |
| `memory-active-pruning` | Sun 05:00 | Prune stale/low-value memories |
| `memory-benchmark-auto-record` | Sun 06:00 | Record memory-quality benchmarks |
| `memory-drm-canary` | Mon 03:00 | DRM canary integrity check |
| `memory-permission-review` | Mon 06:00 | Review memory permissions |
| `memory-identity-auto-register` | Mon 07:00 | Register agent identities |
| `memory-nhi-lifecycle-tracker` | Mon 07:30 | Track non-human-identity lifecycle |
| `memory-red-team-scan` | Wed 02:00 | Adversarial red-team scan |
| `memory-self-assessment-report` | Tue 06:00 | Self-assessment report |
| `memory-semantic-diff` | Thu 03:00 | Semantic diff of memory changes |
| `memory-formal-verify` | Sat 04:00 | Formal verification sweep |
| `memory-compliance-dashboard` | Fri 07:00 | Refresh compliance dashboard |

## On-demand / helper (not scheduled)

| Workflow | Purpose |
|----------|---------|
| `claude-memory-gateway` | HTTP gateway that fronts memory operations |
| `memory-compaction-workflow` | Manual compaction pass |
| `memory-hierarchical-abstraction-llm` | LLM-driven abstraction (needs Anthropic credential) |
| `memory-benchmark-regression` | Benchmark regression check |
| `memory-compliance-report` | Generate a compliance report |
| `memory-skill-discovery` | Discover reusable skills from trajectories |
| `agent-output-visual-formatter` | Format agent output for display |

## Credentials the workflows expect

Created once in n8n (not shipped in the JSON):
- **Qdrant** — Header Auth credential: `api-key: <QDRANT_API_KEY>`.
- **Anthropic** — API key, used by the LLM-backed workflows.

If a workflow errors on run, check that its credential is set and that the Qdrant
collection it targets exists (created by `init/run-init.sh`).
