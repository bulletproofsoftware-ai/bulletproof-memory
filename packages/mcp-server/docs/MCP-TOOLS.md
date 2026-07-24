# MCP Tools Reference

Complete inventory of tools provided by the Claude Memory MCP server.

## Core Memory Tools

### memory_store
Store a fact, decision, episode, or observation with semantic metadata.

**Signature:**
```typescript
memory_store(args: {
  content: string;
  type?: "fact" | "decision" | "episode" | "observation";
  sector?: "episodic" | "semantic" | "procedural" | "emotional" | "reflective";
  tags?: string[];
  project?: string;
  sensitivity?: string;
  temporal_class?: "permanent" | "temporary";
  decay_halflife_days?: number;
  deadline_date?: string;
  last_verified_date?: string;
  
  // Feature 1 (v1.1): Provenance & Use-Policy
  source?: string;  // e.g. "session-analyzer-auto", "user", "cli"
  provenance_status?: "observed" | "inferred" | "user_confirmed" | "imported" | "generated";
  can_use_as_instruction?: boolean;  // Enforced: true only if provenance is user_confirmed|imported
  can_use_as_evidence?: boolean;     // Default: true
  requires_user_confirmation?: boolean;  // Safety floor: true for inferred|generated
}) => {
  success: boolean;
  id: string;
  sensitivity: string;
  expires_at?: string;
  classifier?: string;
  project?: string;
  message?: string;
  
  // Feature 1: echoed policy resolution
  provenance_status: string;
  can_use_as_instruction: boolean;
  requires_user_confirmation: boolean;
}
```

**Behavior:**
- If `provenance_status` is omitted, derived server-side from `source`:
  - Sources matching `/auto|analyz|extract|summari|generat|digest|consolidat/i` → `"generated"`
  - Source `"user"` (case-insensitive) → `"user_confirmed"`
  - Source `"import"` or `"imported"` → `"imported"`
  - Everything else → `"observed"`
- **Policy gate (Feature 1):** If `can_use_as_instruction=true` AND provenance is not `user_confirmed|imported`, the write is **REJECTED** (not stored, returns isError=true)
- **Safety floor:** `requires_user_confirmation` is floored to `true` for inferred/generated provenance (client cannot lower it)
- Backward compatible: all new fields optional; existing calls work unchanged

**Returns:** Success with ID and resolved policy flags, or error if policy violated.

---

### memory_recall
Retrieve memories by semantic query using multiple strategies (vector, graph, hybrid).

**Signature:**
```typescript
memory_recall(args: {
  query: string;
  limit?: number;  // default 5
  include_short_term?: boolean;  // default true
  project?: string;
  sector?: string;
  include_all_projects?: boolean;  // default false
  created_after?: string;
  last_accessed_after?: string;
  verify_top?: boolean;  // touch last_verified_date on returned memories
}) => {
  success: boolean;
  trace_id: string;  // Feature 2 (v1.1): durable trace ID for this recall
  project: string;
  strategy: string;  // "vector-first" | "graph-first"
  memories: Array<{
    id: string;
    score: number;               // raw vector/graph similarity score
    combined_score: number;      // score after temporal/coactivation/token-boost weighting
    temporal_score?: number;
    decay_score?: number;
    tier: "hot" | "warm" | "cold" | "long_term" | "short_term" | "graph";
    payload: {                   // the actual stored fields live here, NOT top-level
      content: string;
      type: string;
      sector?: string;
      tags?: string[];
      project?: string;
      created_at?: string;
      last_accessed_at?: string;
      provenance_status?: string;         // Feature 1
      can_use_as_instruction?: boolean;   // Feature 1
      can_use_as_evidence?: boolean;      // Feature 1
      requires_user_confirmation?: boolean; // Feature 1
      // ...plus every other field memory_store accepted for this memory
    };
  }>;
}
```
> The `content`/`type`/`sector`/`tags`/provenance fields live under `payload`, not at the
> top level of each memory element — confirmed against a live `/tools/call` response
> during this session's implementation work, not just the source.

**Behavior:**
- Searches HOT → WARM → LONG_TERM tiers first, then COLD PostgreSQL
- Graph-based expansion via Memgraph for entity coactivation
- **Feature 2 (v1.1):** Persists a durable trace to `audit.recall_trace` with query, results, and tier info. Trace write is fire-and-forget (fail-open).
- Returns `trace_id` so downstream code can report back which memories were used via `memory_trace_feedback`
- If `verify_top=true`, touches `last_verified_date` on the returned memories

**Returns:** Ranked list of memories with scores and tiers.

---

### memory_forget
Delete memories by query or ID.

**Signature:**
```typescript
memory_forget(args: {
  query?: string;  // semantic query to match
  ids?: string[];  // specific memory IDs
  project?: string;
  mode: "search" | "delete";
  confirm: boolean;  // must be true to actually delete
}) => {
  success: boolean;
  deleted: number;
  message: string;
}
```

**Behavior:**
- `mode: "search"` — find matching memories without deleting (dry-run)
- `mode: "delete"` with `confirm: true` — actually delete
- Deletes from all tiers (HOT, WARM, LONG_TERM, COLD, graph)
- Audit logged

**Returns:** Count of deleted memories.

---

### memory_verify
Touch a memory's `last_verified_date` and update decay model.

**Signature:**
```typescript
memory_verify(args: {
  ids: string[];
  verified: boolean;  // default true
  update_decay?: boolean;  // recalculate decay curve
}) => {
  success: boolean;
  updated: number;
  message: string;
}
```

**Behavior:**
- Updates `last_verified_date` to now
- Used for temporal freshness gating and decay model updates
- Does NOT verify semantic correctness (see `memory_trace_feedback` for recall-quality feedback)

**Returns:** Count updated.

---

### memory_trace_feedback (NEW in v1.1)
Report which memories from a prior `memory_recall` were actually used, and why others were ignored.

**Signature:**
```typescript
memory_trace_feedback(args: {
  trace_id: string;  // from a prior memory_recall response, must be a UUID
  used_memory_ids?: string[];  // IDs that were actually used (default [])
  ignored?: Array<{
    memory_id: string;
    reason: string;  // max 500 chars, e.g. "not relevant to question"
  }>;  // default []
}) => {
  success: boolean;     // false only on a real feedback-write failure; a trace_id
                         // that doesn't exist still returns success:true, updated_rows:0
  trace_id: string;
  updated_rows: number;
  error?: string;       // present only when success is false
}
```

**Behavior:**
- Finds the trace by `trace_id` (stored in `audit.recall_trace`)
- Updates `audit.recall_trace_result` rows with `was_used=true/false` and `ignore_reason`
- Returns immediately; never blocks on PostgreSQL issues (fail-open) — even on failure this
  tool never sets `isError` on the MCP response, since feedback is non-fatal analytics
- Enables recall-quality analytics and ranking feedback

**Returns:** `success`, the echoed `trace_id`, and `updated_rows` (count of rows touched).

---

## Operational/Analytics Tools

### memory_consolidate
Trigger hippocampal consolidation (HOT/WARM → COLD tier).

**Signature:**
```typescript
memory_consolidate(args: {
  mode?: "hot" | "warm" | "auto";  // which tier to consolidate
  batch_size?: number;
  dry_run?: boolean;
}) => {
  success: boolean;
  consolidated: number;
  message: string;
}
```

---

### memory_organize
Reorganize memories by sector (episodic, semantic, procedural, emotional, reflective).

**Signature:**
```typescript
memory_organize(args: {
  query?: string;
  project?: string;
  reassign_sectors?: boolean;
}) => {
  success: boolean;
  organized: number;
  sectors: Record<string, number>;
}
```

---

### memory_summarize
Create digest summaries of memory sets.

**Signature:**
```typescript
memory_summarize(args: {
  query: string;
  project?: string;
  style?: "bullet" | "paragraph" | "timeline";
  max_length?: number;
}) => {
  success: boolean;
  summary: string;
  source_ids: string[];
}
```

---

### memory_impact
Measure a memory's influence on downstream decisions.

**Signature:**
```typescript
memory_impact(args: {
  memory_id: string;
  days?: number;  // lookback window
}) => {
  success: boolean;
  impact_score: number;
  decision_count: number;
  influence_chain: string[];
}
```

---

### memory_promote
Manually promote a memory to HOT tier (higher priority for recall).

**Signature:**
```typescript
memory_promote(args: {
  ids: string[];
  ttl_days?: number;  // how long to keep in HOT
}) => {
  success: boolean;
  promoted: number;
}
```

---

### memory_prune
Remove stale, low-value memories.

**Signature:**
```typescript
memory_prune(args: {
  strategy?: "age" | "score" | "hybrid";
  threshold?: number;
  dry_run?: boolean;
}) => {
  success: boolean;
  pruned: number;
  freed_capacity: string;
}
```

---

### memory_boost
Manually increase a memory's decay half-life.

**Signature:**
```typescript
memory_boost(args: {
  ids: string[];
  new_halflife_days: number;
}) => {
  success: boolean;
  boosted: number;
}
```

---

## Graph & Analytics Tools

### graph_query
Query the memory graph (Memgraph backend).

**Signature:**
```typescript
graph_query(args: {
  cypher: string;  // Cypher query
  params?: Record<string, any>;
}) => {
  success: boolean;
  results: any[];
}
```

**Example:**
```
MATCH (m:Memory)-[r:RELATED_TO]->(n:Memory)
WHERE m.project = 'claude-memory-mcp'
RETURN m.id, r.strength, n.id LIMIT 10
```

---

### graph_neighbors
Find related memories by proximity in the memory graph.

**Signature:**
```typescript
graph_neighbors(args: {
  memory_id: string;
  depth?: number;  // 1, 2, 3 hops
  filter?: string;  // Cypher MATCH filter
}) => {
  success: boolean;
  neighbors: Array<{
    id: string;
    distance: number;
    relationship: string;
    strength: number;
  }>;
}
```

---

### graph_path
Trace chains of related memories.

**Signature:**
```typescript
graph_path(args: {
  start_id: string;
  end_id: string;
}) => {
  success: boolean;
  path: Array<{
    id: string;
    type: string;
    relationship?: string;
  }>;
  distance: number;
}
```

---

### graph_time_travel
Reconstruct past memory states (via temporal snapshots in Memgraph).

**Signature:**
```typescript
graph_time_travel(args: {
  memory_id: string;
  timestamp: string;  // ISO 8601 date
}) => {
  success: boolean;
  state: {
    content: string;
    sector: string;
    tags: string[];
    decay_score: number;
  };
}
```

---

## Other Tools

### memory_recall_trace_cleanup (internal)
Administrative: manually delete old recall traces (normally handled by 90-day prune).

```typescript
memory_recall_trace_cleanup(args: {
  older_than_days: number;
  dry_run?: boolean;
}) => {
  success: boolean;
  deleted: number;
}
```

---

## Tool Categories by Use Case

### For Writing Memories
- `memory_store` — primary write interface; includes Feature 1 provenance
- `memory_verify` — update freshness

### For Retrieving Memories
- `memory_recall` — primary read interface; returns Feature 2 trace_id
- `graph_query` — advanced graph queries
- `graph_neighbors` — find related memories

### For Analytics & Feedback
- `memory_trace_feedback` — report which recalled memories were used (Feature 2)
- `memory_impact` — measure influence
- `graph_path` — trace decision chains

### For Maintenance
- `memory_forget` — delete stale memories
- `memory_prune` — automated cleanup
- `memory_consolidate` — move to COLD tier
- `memory_promote` — keep in HOT tier

### For Organization
- `memory_organize` — reassign sectors
- `memory_summarize` — digest summaries
- `memory_boost` — increase half-life

---

## Error Handling

All tools return `{ success: boolean }` in the response. If `success: false`, check:
- `error` or `message` field for details
- Server logs (stderr) for debug info
- `npm run self-test` to verify dependencies

**Policy violations (Feature 1)** return `isError: true` from `memory_store` with a clear message about provenance mismatch.

---

## Backward Compatibility

All new fields in v1.1 are **optional** on `memory_store` inputs. Existing code that doesn't supply `source`, `provenance_status`, etc. continues to work unchanged. The server computes sensible defaults.

---

**Last Updated:** 2026-07-02  
**Version:** 1.1.0
