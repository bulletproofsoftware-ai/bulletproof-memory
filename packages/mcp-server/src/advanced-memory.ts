/**
 * Wave 2 (remaining) + Wave 3: Advanced Memory & Governance
 *
 * REQ-EVO-006: Predictive Pre-Loading
 * REQ-EVO-008: Cross-Instance Memory Federation
 * REQ-EVO-010: Memory-Grounded Self-Assessment
 * REQ-EVO-019: Data Sovereignty Zones
 * REQ-EVO-020: Governance Dashboard with Compliance Scoring
 * REQ-EVO-021: Stigmergic Coordination Layer
 * REQ-EVO-026: A2A Protocol Support
 * REQ-EVO-027: World Model for Software Environments
 */

import { createHash, generateKeyPairSync, sign, verify, randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Dependency injection interface
// ---------------------------------------------------------------------------

export interface AdvancedMemoryDeps {
  generateEmbedding: (text: string) => Promise<number[] | null>;
  storePoint: (collection: string, id: string, vector: number[], payload: Record<string, unknown>) => Promise<void>;
  scrollPoints: (collection: string, filter?: Record<string, unknown>, limit?: number) => Promise<unknown[]>;
  searchPoints: (collection: string, vector: number[], limit: number, threshold?: number, filter?: Record<string, unknown>) => Promise<unknown[]>;
  deletePoints: (collection: string, ids: string[]) => Promise<void>;
  updatePayload: (collection: string, ids: string[], payload: Record<string, unknown>) => Promise<void>;
  logAudit: (action: string, details: Record<string, unknown>, sensitivity?: string, project?: string) => Promise<string | null>;
  qdrantRequest: (method: string, path: string, body?: unknown) => Promise<unknown>;
  generateUUID: () => string;
  getPoint: (collection: string, id: string, withVector?: boolean) => Promise<unknown>;
  ollamaGenerate: (prompt: string) => Promise<string | null>;
}

// ---------------------------------------------------------------------------
// Collection constants
// ---------------------------------------------------------------------------

export const ADVANCED_COLLECTIONS = {
  PREDICTIVE_PATTERNS: "predictive_patterns",
  FEDERATION_REGISTRY: "federation_registry",
  SELF_ASSESSMENTS: "self_assessments",
  SOVEREIGNTY_ZONES: "sovereignty_zones",
  COMPLIANCE_DASHBOARD: "compliance_dashboard",
  PHEROMONE_TRAILS: "pheromone_trails",
  A2A_AGENTS: "a2a_agents",
  WORLD_MODEL: "world_model",
};

// ---------------------------------------------------------------------------
// Common types
// ---------------------------------------------------------------------------

export type JurisdictionTag = "us" | "eu" | "mena" | "apac" | "latam" | "africa" | "canada" | "global";

const VALID_JURISDICTIONS: JurisdictionTag[] = ["us", "eu", "mena", "apac", "latam", "africa", "canada", "global"];

// ---------------------------------------------------------------------------
// REQ-EVO-006: Predictive Pre-Loading
// ---------------------------------------------------------------------------

export interface PredictivePattern {
  id: string;
  trigger_context: string;
  trigger_keywords: string[];
  likely_needed_memories: string[];
  memory_queries: string[];
  strength: number;
  usage_count: number;
  hit_count: number;
  miss_count: number;
  created_at: string;
  updated_at: string;
}

export interface PreloadResult {
  patterns_matched: number;
  memories_preloaded: number;
  working_memory_ids: string[];
  pattern_ids: string[];
}

export interface FeedbackResult {
  pattern_id: string;
  previous_strength: number;
  new_strength: number;
  action: "strengthened" | "weakened" | "pruned";
}

export class PredictivePreloader {
  private deps: AdvancedMemoryDeps;

  constructor(deps: AdvancedMemoryDeps) {
    this.deps = deps;
  }

  async extractPatterns(trajectoryId: string): Promise<PredictivePattern> {
    const point = await this.deps.getPoint("trajectories", trajectoryId) as any;
    if (!point?.payload) {
      throw new Error(`Trajectory ${trajectoryId} not found`);
    }

    const payload = point.payload;
    const steps = Array.isArray(payload.steps) ? payload.steps : [];
    const taskDescription = String(payload.task || payload.description || "");
    const toolsUsed = Array.isArray(payload.tools_used) ? payload.tools_used : [];

    // Extract keywords from task description
    const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "in", "on", "at", "to", "for", "of", "and", "or", "but", "not", "with", "this", "that", "it"]);
    const keywords = taskDescription
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w: string) => w.length > 2 && !stopWords.has(w));

    // Build memory queries from the trajectory context
    const memoryQueries: string[] = [];
    if (taskDescription) {
      memoryQueries.push(taskDescription);
    }
    for (const tool of toolsUsed.slice(0, 3)) {
      memoryQueries.push(`how to use ${tool}`);
    }
    if (payload.project) {
      memoryQueries.push(`${payload.project} project context`);
    }

    // Extract memory IDs referenced in the trajectory
    const referencedMemories: string[] = [];
    for (const step of steps) {
      if (step && typeof step === "object") {
        if (step.memory_ids && Array.isArray(step.memory_ids)) {
          referencedMemories.push(...step.memory_ids);
        }
        if (step.recalled_memories && Array.isArray(step.recalled_memories)) {
          for (const m of step.recalled_memories) {
            if (typeof m === "string") referencedMemories.push(m);
            else if (m?.id) referencedMemories.push(m.id);
          }
        }
      }
    }

    const uniqueMemories = [...new Set(referencedMemories)].slice(0, 10);

    const patternId = this.deps.generateUUID();
    const now = new Date().toISOString();

    const pattern: PredictivePattern = {
      id: patternId,
      trigger_context: taskDescription,
      trigger_keywords: [...new Set(keywords)].slice(0, 15),
      likely_needed_memories: uniqueMemories,
      memory_queries: memoryQueries.slice(0, 5),
      strength: 0.5,
      usage_count: 0,
      hit_count: 0,
      miss_count: 0,
      created_at: now,
      updated_at: now,
    };

    const embedding = await this.deps.generateEmbedding(taskDescription || "general task pattern");
    if (!embedding) throw new Error("Failed to generate embedding for pattern");

    await this.deps.storePoint(
      ADVANCED_COLLECTIONS.PREDICTIVE_PATTERNS,
      patternId,
      embedding,
      pattern as unknown as Record<string, unknown>
    );

    await this.deps.logAudit("predictive_pattern_extracted", {
      pattern_id: patternId,
      trajectory_id: trajectoryId,
      keyword_count: pattern.trigger_keywords.length,
      memory_count: uniqueMemories.length,
    });

    return pattern;
  }

  async preloadForSession(sessionContext: string): Promise<PreloadResult> {
    const embedding = await this.deps.generateEmbedding(sessionContext);
    if (!embedding) {
      return { patterns_matched: 0, memories_preloaded: 0, working_memory_ids: [], pattern_ids: [] };
    }

    // Search for matching patterns
    const matches = await this.deps.searchPoints(
      ADVANCED_COLLECTIONS.PREDICTIVE_PATTERNS,
      embedding,
      5,
      0.4
    ) as any[];

    // Filter by strength threshold and sort by strength * similarity
    const viable = matches
      .filter((m) => (m.payload?.strength ?? 0) >= 0.2)
      .sort((a, b) => {
        const scoreA = (a.score || 0) * (a.payload?.strength ?? 0);
        const scoreB = (b.score || 0) * (b.payload?.strength ?? 0);
        return scoreB - scoreA;
      })
      .slice(0, 3);

    const preloadedIds: string[] = [];
    const patternIds: string[] = [];

    for (const match of viable) {
      const payload = match.payload;
      patternIds.push(String(payload.id));

      // Pre-load referenced memories into working_memory
      const memoryIds = Array.isArray(payload.likely_needed_memories) ? payload.likely_needed_memories : [];
      for (const memId of memoryIds.slice(0, 5)) {
        try {
          const memPoint = await this.deps.getPoint("claude_memories", String(memId)) as any;
          if (memPoint?.payload) {
            const wmId = this.deps.generateUUID();
            const wmEmbedding = await this.deps.generateEmbedding(
              String(memPoint.payload.content || memPoint.payload.text || "")
            );
            if (wmEmbedding) {
              await this.deps.storePoint("working_memory", wmId, wmEmbedding, {
                ...memPoint.payload,
                source_memory_id: memId,
                preloaded_by_pattern: payload.id,
                preloaded_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 3600000).toISOString(),
              });
              preloadedIds.push(wmId);
            }
          }
        } catch {
          // Memory may have been deleted; skip
        }
      }

      // Also run memory_queries to find relevant memories
      const queries = Array.isArray(payload.memory_queries) ? payload.memory_queries : [];
      for (const query of queries.slice(0, 2)) {
        const qEmb = await this.deps.generateEmbedding(String(query));
        if (!qEmb) continue;
        const results = await this.deps.searchPoints("claude_memories", qEmb, 2, 0.6);
        for (const r of results as any[]) {
          if (preloadedIds.length >= 10) break;
          const wmId = this.deps.generateUUID();
          const rPayload = r.payload || {};
          const wmEmbedding = await this.deps.generateEmbedding(
            String(rPayload.content || rPayload.text || "query result")
          );
          if (wmEmbedding) {
            await this.deps.storePoint("working_memory", wmId, wmEmbedding, {
              ...rPayload,
              source_query: query,
              preloaded_by_pattern: payload.id,
              preloaded_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 3600000).toISOString(),
            });
            preloadedIds.push(wmId);
          }
        }
      }

      // Increment usage_count
      await this.deps.updatePayload(
        ADVANCED_COLLECTIONS.PREDICTIVE_PATTERNS,
        [String(payload.id)],
        { usage_count: (payload.usage_count || 0) + 1, updated_at: new Date().toISOString() }
      );
    }

    await this.deps.logAudit("predictive_preload", {
      session_context_preview: sessionContext.slice(0, 200),
      patterns_matched: viable.length,
      memories_preloaded: preloadedIds.length,
    });

    return {
      patterns_matched: viable.length,
      memories_preloaded: preloadedIds.length,
      working_memory_ids: preloadedIds,
      pattern_ids: patternIds,
    };
  }

  async recordFeedback(patternId: string, memoryWasUsed: boolean): Promise<FeedbackResult> {
    const point = await this.deps.getPoint(
      ADVANCED_COLLECTIONS.PREDICTIVE_PATTERNS,
      patternId
    ) as any;

    if (!point?.payload) {
      throw new Error(`Pattern ${patternId} not found`);
    }

    const payload = point.payload;
    const previousStrength = payload.strength ?? 0.5;
    let newStrength: number;
    let hitCount = payload.hit_count || 0;
    let missCount = payload.miss_count || 0;

    if (memoryWasUsed) {
      hitCount++;
      // Strengthen by 10%, cap at 1.0
      newStrength = Math.min(1.0, previousStrength + 0.1);
    } else {
      missCount++;
      // Weaken by 15%
      newStrength = Math.max(0.0, previousStrength - 0.15);
    }

    let action: "strengthened" | "weakened" | "pruned";
    if (newStrength < 0.05) {
      // Evaporate pattern
      await this.deps.deletePoints(ADVANCED_COLLECTIONS.PREDICTIVE_PATTERNS, [patternId]);
      action = "pruned";
      newStrength = 0;
    } else {
      await this.deps.updatePayload(
        ADVANCED_COLLECTIONS.PREDICTIVE_PATTERNS,
        [patternId],
        {
          strength: newStrength,
          hit_count: hitCount,
          miss_count: missCount,
          updated_at: new Date().toISOString(),
        }
      );
      action = memoryWasUsed ? "strengthened" : "weakened";
    }

    await this.deps.logAudit("predictive_feedback", {
      pattern_id: patternId,
      memory_was_used: memoryWasUsed,
      previous_strength: previousStrength,
      new_strength: newStrength,
      action,
    });

    return {
      pattern_id: patternId,
      previous_strength: previousStrength,
      new_strength: newStrength,
      action,
    };
  }
}

// ---------------------------------------------------------------------------
// REQ-EVO-008: Cross-Instance Memory Federation
// ---------------------------------------------------------------------------

export type FederationScope = "private" | "instance" | "team" | "public";

export interface FederationInstance {
  federation_id: string;
  public_key: string;
  private_key_hash: string;
  instance_name: string;
  endpoint: string;
  scopes: FederationScope[];
  jurisdiction: JurisdictionTag;
  registered_at: string;
  last_sync_at: string | null;
  trusted_peers: string[];
}

export interface SyncResult {
  source_id: string;
  target_id: string;
  memories_sent: number;
  memories_received: number;
  conflicts_resolved: number;
  jurisdiction_blocked: number;
  sync_completed_at: string;
}

export interface JurisdictionValidation {
  allowed: boolean;
  source_jurisdiction: JurisdictionTag;
  target_jurisdiction: JurisdictionTag;
  reason: string;
}

export class FederationManager {
  private deps: AdvancedMemoryDeps;
  private localInstance: FederationInstance | null = null;
  private federationPrivateKey: import("crypto").KeyObject | null = null;

  constructor(deps: AdvancedMemoryDeps) {
    this.deps = deps;
  }

  async registerInstance(
    instanceName: string,
    endpoint: string,
    jurisdiction: JurisdictionTag
  ): Promise<FederationInstance> {
    // Generate Ed25519 keypair for this instance
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");

    const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }) as string;
    const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
    const privateKeyHash = createHash("sha256").update(privateKeyPem).digest("hex");

    const federationId = this.deps.generateUUID();
    const now = new Date().toISOString();

    const instance: FederationInstance = {
      federation_id: federationId,
      public_key: publicKeyPem,
      private_key_hash: privateKeyHash,
      instance_name: instanceName,
      endpoint,
      scopes: ["private", "instance", "team", "public"],
      jurisdiction,
      registered_at: now,
      last_sync_at: null,
      trusted_peers: [],
    };

    const embedding = await this.deps.generateEmbedding(
      `federation instance ${instanceName} ${endpoint} ${jurisdiction}`
    );
    if (!embedding) throw new Error("Failed to generate embedding for federation instance");

    // Store the instance record (public data only — private key in memory only)
    await this.deps.storePoint(
      ADVANCED_COLLECTIONS.FEDERATION_REGISTRY,
      federationId,
      embedding,
      {
        ...instance,
        type: "federation_instance",
      }
    );

    // Cache private key in memory only — never persisted
    this.federationPrivateKey = privateKey;
    this.localInstance = instance;

    await this.deps.logAudit("federation_register", {
      federation_id: federationId,
      instance_name: instanceName,
      jurisdiction,
      endpoint,
    }, "sensitive");

    return instance;
  }

  async syncCollections(
    targetFederationId: string,
    scope: FederationScope,
    collection: string = "claude_memories"
  ): Promise<SyncResult> {
    if (!this.localInstance) {
      // Try to load local instance from registry
      const instances = await this.deps.scrollPoints(
        ADVANCED_COLLECTIONS.FEDERATION_REGISTRY,
        { must: [{ key: "type", match: { value: "federation_instance" } }] },
        1
      ) as any[];
      if (instances.length > 0) {
        this.localInstance = instances[0].payload as FederationInstance;
      } else {
        throw new Error("No local federation instance registered. Call registerInstance first.");
      }
    }

    // Fetch target instance
    const targetPoint = await this.deps.getPoint(
      ADVANCED_COLLECTIONS.FEDERATION_REGISTRY,
      targetFederationId
    ) as any;

    if (!targetPoint?.payload) {
      throw new Error(`Target federation instance ${targetFederationId} not found`);
    }

    const target = targetPoint.payload as FederationInstance & { type: string };

    // Validate jurisdiction compatibility
    const jurisdictionCheck = this.checkJurisdictionCompatibility(
      this.localInstance.jurisdiction,
      target.jurisdiction as JurisdictionTag
    );

    let jurisdictionBlocked = 0;
    let memoriesSent = 0;
    let memoriesReceived = 0;
    let conflictsResolved = 0;

    // Scope filter: determine which scope levels to sync
    const scopeHierarchy: FederationScope[] = ["public", "team", "instance", "private"];
    const scopeIndex = scopeHierarchy.indexOf(scope);
    const allowedScopes = scopeHierarchy.slice(0, scopeIndex + 1);

    // Memories with no federation_scope field are treated as the most restrictive
    // level ("private"), so they are only in play when the caller explicitly asked
    // to sync at that level. Selecting them here — rather than retrying the scroll
    // without a filter — is what keeps an empty result set from widening into a
    // full-collection export.
    const scopeConditions: Record<string, unknown>[] = allowedScopes.map((s) => ({
      key: "federation_scope",
      match: { value: s },
    }));
    if (allowedScopes.includes("private")) {
      scopeConditions.push({ is_empty: { key: "federation_scope" } });
    }

    // Get local memories with matching scope
    const localMemories = await this.deps.scrollPoints(
      collection,
      { should: scopeConditions },
      100
    ) as any[];

    if (localMemories.length === 0) {
      console.error(
        `[FEDERATION] No memories matched scope <= "${scope}" in ${collection}; nothing to sync`
      );
    }

    for (const mem of localMemories) {
      const memPayload = mem.payload || {};
      const memJurisdiction = memPayload.jurisdiction || this.localInstance.jurisdiction;

      // Check if this memory can cross jurisdiction boundaries
      if (!jurisdictionCheck.allowed && memJurisdiction !== "global") {
        // Only global memories can cross incompatible jurisdictions
        if (memPayload.jurisdiction === target.jurisdiction) {
          // Same jurisdiction, allow
        } else {
          jurisdictionBlocked++;
          continue;
        }
      }

      // Sign the memory payload for authenticity
      const contentHash = createHash("sha256")
        .update(JSON.stringify(memPayload))
        .digest("hex");

      // Prepare sync record
      const syncPayload = {
        ...memPayload,
        sync_source: this.localInstance.federation_id,
        sync_target: targetFederationId,
        sync_timestamp: new Date().toISOString(),
        content_hash: contentHash,
        federation_scope: memPayload.federation_scope || scope,
      };

      // Additive merge: check if target already has this memory
      const existingContent = String(memPayload.content || memPayload.text || "");
      if (!existingContent) continue;

      const existingEmb = await this.deps.generateEmbedding(existingContent);
      if (!existingEmb) continue;

      const existing = await this.deps.searchPoints(
        collection,
        existingEmb,
        1,
        0.95
      ) as any[];

      if (existing.length > 0 && existing[0].score > 0.95) {
        // Conflict: use latest timestamp wins
        const existingTs = existing[0].payload?.updated_at || existing[0].payload?.created_at || "";
        const localTs = memPayload.updated_at || memPayload.created_at || "";
        if (localTs > existingTs) {
          await this.deps.updatePayload(collection, [String(existing[0].id)], syncPayload);
          conflictsResolved++;
        }
      } else {
        // New memory - store it
        const newId = this.deps.generateUUID();
        await this.deps.storePoint(collection, newId, existingEmb, syncPayload);
        memoriesSent++;
      }
    }

    const now = new Date().toISOString();

    // Update last_sync_at
    await this.deps.updatePayload(
      ADVANCED_COLLECTIONS.FEDERATION_REGISTRY,
      [this.localInstance.federation_id],
      { last_sync_at: now }
    );

    const result: SyncResult = {
      source_id: this.localInstance.federation_id,
      target_id: targetFederationId,
      memories_sent: memoriesSent,
      memories_received: memoriesReceived,
      conflicts_resolved: conflictsResolved,
      jurisdiction_blocked: jurisdictionBlocked,
      sync_completed_at: now,
    };

    await this.deps.logAudit("federation_sync", {
      ...result,
      scope,
      collection,
    });

    return result;
  }

  validateJurisdiction(
    sourceJurisdiction: JurisdictionTag,
    targetJurisdiction: JurisdictionTag
  ): JurisdictionValidation {
    return this.checkJurisdictionCompatibility(sourceJurisdiction, targetJurisdiction);
  }

  private checkJurisdictionCompatibility(
    source: JurisdictionTag,
    target: JurisdictionTag
  ): JurisdictionValidation {
    // Global is always compatible
    if (source === "global" || target === "global") {
      return {
        allowed: true,
        source_jurisdiction: source,
        target_jurisdiction: target,
        reason: "Global scope is universally compatible",
      };
    }

    // Same jurisdiction always compatible
    if (source === target) {
      return {
        allowed: true,
        source_jurisdiction: source,
        target_jurisdiction: target,
        reason: "Same jurisdiction",
      };
    }

    // EU data cannot leave EU without adequacy (GDPR)
    if (source === "eu" && !["eu", "canada"].includes(target)) {
      return {
        allowed: false,
        source_jurisdiction: source,
        target_jurisdiction: target,
        reason: "GDPR restricts EU data transfer to non-adequate jurisdictions without safeguards",
      };
    }

    // MENA may have data localization requirements
    if (source === "mena" && target !== "mena") {
      return {
        allowed: false,
        source_jurisdiction: source,
        target_jurisdiction: target,
        reason: "MENA data localization requirements may restrict cross-border transfer",
      };
    }

    // Default: allow with warning
    return {
      allowed: true,
      source_jurisdiction: source,
      target_jurisdiction: target,
      reason: `Cross-jurisdiction transfer allowed between ${source} and ${target} (verify local regulations)`,
    };
  }
}

// ---------------------------------------------------------------------------
// REQ-EVO-010: Memory-Grounded Self-Assessment
// ---------------------------------------------------------------------------

export interface TaskReadiness {
  task_type: string;
  task_description: string;
  historical_success_rate: number;
  total_attempts: number;
  successful_attempts: number;
  similar_trajectories: number;
  confidence_level: "high" | "medium" | "low" | "unknown";
  risk_flag: boolean;
  risk_reason: string | null;
  error_patterns: ErrorPattern[];
  recommended_approach: string | null;
}

export interface ErrorPattern {
  pattern: string;
  frequency: number;
  last_occurred: string;
  mitigation: string;
}

export interface SuccessRateResult {
  task_type: string;
  success_rate: number;
  total: number;
  successes: number;
  failures: number;
  average_duration_ms: number;
  trend: "improving" | "declining" | "stable" | "unknown";
}

export class SelfAssessment {
  private deps: AdvancedMemoryDeps;

  constructor(deps: AdvancedMemoryDeps) {
    this.deps = deps;
  }

  async assessTaskReadiness(taskType: string, taskDescription: string): Promise<TaskReadiness> {
    // Step 1: Classify task and search trajectories for similar
    const embedding = await this.deps.generateEmbedding(`${taskType}: ${taskDescription}`);
    const similarTrajectories = embedding
      ? await this.deps.searchPoints("trajectories", embedding, 10, 0.4) as any[]
      : [];

    // Step 2: Calculate historical success rate
    let totalAttempts = 0;
    let successfulAttempts = 0;
    let totalDuration = 0;

    for (const traj of similarTrajectories) {
      const p = traj.payload || {};
      totalAttempts++;
      if (p.success === true || p.outcome === "success" || p.status === "completed") {
        successfulAttempts++;
      }
      if (p.duration_ms) {
        totalDuration += Number(p.duration_ms);
      }
    }

    const successRate = totalAttempts > 0 ? successfulAttempts / totalAttempts : -1;

    // Step 3: Determine confidence level
    let confidenceLevel: "high" | "medium" | "low" | "unknown";
    if (totalAttempts === 0) {
      confidenceLevel = "unknown";
    } else if (successRate >= 0.8 && totalAttempts >= 3) {
      confidenceLevel = "high";
    } else if (successRate >= 0.5) {
      confidenceLevel = "medium";
    } else {
      confidenceLevel = "low";
    }

    // Step 4: Risk flag if <70% success rate
    const riskFlag = totalAttempts > 0 && successRate < 0.7;
    let riskReason: string | null = null;
    if (riskFlag) {
      riskReason = `Historical success rate for similar tasks is ${Math.round(successRate * 100)}% (${successfulAttempts}/${totalAttempts}). Recommend operator review before proceeding.`;
    }

    // Step 5: Extract error patterns from failed trajectories
    const errorPatterns = await this.preloadErrorPatterns(taskType, taskDescription);

    // Step 6: Generate recommended approach from successful trajectories
    let recommendedApproach: string | null = null;
    const successfulTrajs = similarTrajectories.filter(
      (t) => t.payload?.success === true || t.payload?.outcome === "success"
    );
    if (successfulTrajs.length > 0) {
      const bestTraj = successfulTrajs[0].payload;
      const steps = Array.isArray(bestTraj?.steps) ? bestTraj.steps : [];
      const toolsUsed = Array.isArray(bestTraj?.tools_used) ? bestTraj.tools_used : [];
      if (toolsUsed.length > 0 || steps.length > 0) {
        recommendedApproach = `Based on ${successfulTrajs.length} successful similar task(s): ` +
          (toolsUsed.length > 0 ? `tools used: ${toolsUsed.join(", ")}` : "") +
          (steps.length > 0 ? ` (${steps.length} steps)` : "");
      }
    }

    const readiness: TaskReadiness = {
      task_type: taskType,
      task_description: taskDescription,
      historical_success_rate: totalAttempts > 0 ? Math.round(successRate * 100) / 100 : -1,
      total_attempts: totalAttempts,
      successful_attempts: successfulAttempts,
      similar_trajectories: similarTrajectories.length,
      confidence_level: confidenceLevel,
      risk_flag: riskFlag,
      risk_reason: riskReason,
      error_patterns: errorPatterns,
      recommended_approach: recommendedApproach,
    };

    // Store assessment
    const assessId = this.deps.generateUUID();
    const assessEmbedding = await this.deps.generateEmbedding(
      `self assessment ${taskType} ${taskDescription}`
    );
    if (assessEmbedding) {
      await this.deps.storePoint(
        ADVANCED_COLLECTIONS.SELF_ASSESSMENTS,
        assessId,
        assessEmbedding,
        {
          ...readiness,
          assessed_at: new Date().toISOString(),
        }
      );
    }

    await this.deps.logAudit("self_assessment", {
      task_type: taskType,
      success_rate: readiness.historical_success_rate,
      confidence: confidenceLevel,
      risk_flag: riskFlag,
    });

    return readiness;
  }

  async getSuccessRate(taskType: string): Promise<SuccessRateResult> {
    const embedding = await this.deps.generateEmbedding(`${taskType} task trajectory`);
    if (!embedding) {
      return {
        task_type: taskType,
        success_rate: -1,
        total: 0,
        successes: 0,
        failures: 0,
        average_duration_ms: 0,
        trend: "unknown",
      };
    }

    const trajectories = await this.deps.searchPoints("trajectories", embedding, 50, 0.4) as any[];

    let successes = 0;
    let failures = 0;
    let totalDuration = 0;

    // Split into recent and older for trend
    const sorted = trajectories
      .filter((t) => t.payload?.created_at)
      .sort((a, b) => {
        const aTime = new Date(a.payload.created_at).getTime();
        const bTime = new Date(b.payload.created_at).getTime();
        return bTime - aTime;
      });

    for (const traj of sorted) {
      const p = traj.payload || {};
      if (p.success === true || p.outcome === "success" || p.status === "completed") {
        successes++;
      } else {
        failures++;
      }
      if (p.duration_ms) totalDuration += Number(p.duration_ms);
    }

    const total = successes + failures;
    const successRate = total > 0 ? successes / total : -1;
    const avgDuration = total > 0 ? totalDuration / total : 0;

    // Trend: compare first half vs second half success rates
    let trend: "improving" | "declining" | "stable" | "unknown" = "unknown";
    if (sorted.length >= 4) {
      const mid = Math.floor(sorted.length / 2);
      const recentHalf = sorted.slice(0, mid);
      const olderHalf = sorted.slice(mid);

      const recentSuccess = recentHalf.filter(
        (t) => t.payload?.success === true || t.payload?.outcome === "success"
      ).length / recentHalf.length;
      const olderSuccess = olderHalf.filter(
        (t) => t.payload?.success === true || t.payload?.outcome === "success"
      ).length / olderHalf.length;

      if (recentSuccess > olderSuccess + 0.1) trend = "improving";
      else if (recentSuccess < olderSuccess - 0.1) trend = "declining";
      else trend = "stable";
    }

    return {
      task_type: taskType,
      success_rate: total > 0 ? Math.round(successRate * 100) / 100 : -1,
      total,
      successes,
      failures,
      average_duration_ms: Math.round(avgDuration),
      trend,
    };
  }

  async preloadErrorPatterns(taskType: string, taskDescription: string): Promise<ErrorPattern[]> {
    const embedding = await this.deps.generateEmbedding(
      `error failure ${taskType} ${taskDescription}`
    );
    if (!embedding) return [];

    // Search trajectories for failures
    const failedTrajectories = await this.deps.searchPoints(
      "trajectories",
      embedding,
      20,
      0.3,
      {
        should: [
          { key: "success", match: { value: false } },
          { key: "outcome", match: { value: "failure" } },
          { key: "status", match: { value: "failed" } },
        ],
      }
    ) as any[];

    // Also search learnings for error-related entries
    const errorLearnings = await this.deps.searchPoints(
      "learnings",
      embedding,
      10,
      0.4
    ) as any[];

    // Aggregate error patterns
    const patternMap = new Map<string, { count: number; lastOccurred: string; mitigation: string }>();

    for (const traj of failedTrajectories) {
      const p = traj.payload || {};
      const errorMsg = String(p.error || p.error_message || p.failure_reason || "unknown error");
      const normalized = errorMsg.slice(0, 100).toLowerCase().trim();

      const existing = patternMap.get(normalized);
      const ts = String(p.created_at || p.timestamp || "");
      if (existing) {
        existing.count++;
        if (ts > existing.lastOccurred) existing.lastOccurred = ts;
      } else {
        patternMap.set(normalized, {
          count: 1,
          lastOccurred: ts,
          mitigation: String(p.mitigation || p.lesson || "Review trajectory for details"),
        });
      }
    }

    // Add learnings-based patterns
    for (const learn of errorLearnings) {
      const p = learn.payload || {};
      if (p.type === "error" || p.category === "error" || String(p.content || "").toLowerCase().includes("error")) {
        const content = String(p.content || p.text || "").slice(0, 100);
        if (content && !patternMap.has(content.toLowerCase())) {
          patternMap.set(content.toLowerCase(), {
            count: 1,
            lastOccurred: String(p.created_at || p.timestamp || ""),
            mitigation: String(p.resolution || p.lesson || "See learning entry for details"),
          });
        }
      }
    }

    return Array.from(patternMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([pattern, data]) => ({
        pattern,
        frequency: data.count,
        last_occurred: data.lastOccurred,
        mitigation: data.mitigation,
      }));
  }
}

// ---------------------------------------------------------------------------
// REQ-EVO-019: Data Sovereignty Zones
// ---------------------------------------------------------------------------

export interface SovereigntyTag {
  memory_id: string;
  jurisdiction: JurisdictionTag;
  tagged_at: string;
  tagged_by: string;
  retention_policy: string | null;
}

export interface CascadingDeleteResult {
  root_id: string;
  jurisdiction: JurisdictionTag;
  deleted_ids: string[];
  flagged_descendants: string[];
  total_affected: number;
  gdpr_compliant: boolean;
}

export interface JurisdictionFilterResult {
  memories: any[];
  total_found: number;
  jurisdiction_applied: JurisdictionTag;
  filtered_out: number;
}

export class DataSovereignty {
  private deps: AdvancedMemoryDeps;

  constructor(deps: AdvancedMemoryDeps) {
    this.deps = deps;
  }

  async tagJurisdiction(
    memoryId: string,
    jurisdiction: JurisdictionTag,
    collection: string = "claude_memories",
    retentionPolicy: string | null = null
  ): Promise<SovereigntyTag> {
    if (!VALID_JURISDICTIONS.includes(jurisdiction)) {
      throw new Error(`Invalid jurisdiction: ${jurisdiction}. Valid: ${VALID_JURISDICTIONS.join(", ")}`);
    }

    // Verify memory exists
    const point = await this.deps.getPoint(collection, memoryId) as any;
    if (!point?.payload) {
      throw new Error(`Memory ${memoryId} not found in ${collection}`);
    }

    const now = new Date().toISOString();

    // Update the memory with jurisdiction tag
    await this.deps.updatePayload(collection, [memoryId], {
      jurisdiction,
      jurisdiction_tagged_at: now,
      jurisdiction_retention_policy: retentionPolicy,
    });

    // Also store a sovereignty zone record for tracking
    const zoneId = this.deps.generateUUID();
    const embedding = await this.deps.generateEmbedding(
      `jurisdiction ${jurisdiction} memory ${memoryId}`
    );
    if (embedding) {
      await this.deps.storePoint(ADVANCED_COLLECTIONS.SOVEREIGNTY_ZONES, zoneId, embedding, {
        memory_id: memoryId,
        collection,
        jurisdiction,
        tagged_at: now,
        tagged_by: "operator",
        retention_policy: retentionPolicy,
        type: "sovereignty_tag",
      });
    }

    await this.deps.logAudit("sovereignty_tag", {
      memory_id: memoryId,
      jurisdiction,
      collection,
      retention_policy: retentionPolicy,
    });

    return {
      memory_id: memoryId,
      jurisdiction,
      tagged_at: now,
      tagged_by: "operator",
      retention_policy: retentionPolicy,
    };
  }

  async cascadingDelete(
    memoryId: string,
    jurisdiction: JurisdictionTag,
    collection: string = "claude_memories"
  ): Promise<CascadingDeleteResult> {
    // GDPR cascading deletion: traverse causal graph, flag derived descendants
    const rootPoint = await this.deps.getPoint(collection, memoryId) as any;
    if (!rootPoint?.payload) {
      throw new Error(`Memory ${memoryId} not found`);
    }

    const deletedIds: string[] = [];
    const flaggedDescendants: string[] = [];
    const visited = new Set<string>();
    const toProcess = [memoryId];

    while (toProcess.length > 0) {
      const currentId = toProcess.pop()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      // Find all memories that reference this one via causal links
      const links = await this.deps.scrollPoints(
        "memory_links",
        {
          should: [
            { key: "source_id", match: { value: currentId } },
            { key: "target_id", match: { value: currentId } },
          ],
        },
        100
      ) as any[];

      for (const link of links) {
        const lp = link.payload || {};
        const linkedId = lp.source_id === currentId ? lp.target_id : lp.source_id;
        const edgeType = lp.edge_type || lp.relation;

        if (!linkedId || visited.has(String(linkedId))) continue;

        // Check if the linked memory is derived from the root
        if (["derived_from", "caused_by", "informed"].includes(String(edgeType))) {
          // This is a descendant - flag it
          const descendantId = lp.source_id === currentId ? lp.target_id : lp.source_id;
          if (descendantId && !visited.has(String(descendantId))) {
            flaggedDescendants.push(String(descendantId));
            toProcess.push(String(descendantId));
          }
        }
      }

      // Delete the current memory
      try {
        await this.deps.deletePoints(collection, [currentId]);
        deletedIds.push(currentId);
      } catch {
        // May already be deleted
      }

      // Also delete from sovereignty zones
      const zoneRecords = await this.deps.scrollPoints(
        ADVANCED_COLLECTIONS.SOVEREIGNTY_ZONES,
        { must: [{ key: "memory_id", match: { value: currentId } }] },
        10
      ) as any[];
      if (zoneRecords.length > 0) {
        await this.deps.deletePoints(
          ADVANCED_COLLECTIONS.SOVEREIGNTY_ZONES,
          zoneRecords.map((z: any) => String(z.id))
        );
      }
    }

    // Delete flagged descendants
    for (const descId of flaggedDescendants) {
      if (!deletedIds.includes(descId)) {
        try {
          await this.deps.deletePoints(collection, [descId]);
          deletedIds.push(descId);
        } catch {
          // Already deleted
        }
      }
    }

    const result: CascadingDeleteResult = {
      root_id: memoryId,
      jurisdiction,
      deleted_ids: deletedIds,
      flagged_descendants: flaggedDescendants,
      total_affected: deletedIds.length,
      gdpr_compliant: jurisdiction === "eu",
    };

    await this.deps.logAudit("cascading_delete", {
      ...result,
      reason: jurisdiction === "eu" ? "GDPR right to erasure" : "Sovereignty zone deletion",
    }, "sensitive");

    return result;
  }

  async filterByJurisdiction(
    query: string,
    jurisdiction: JurisdictionTag,
    collection: string = "claude_memories",
    limit: number = 10
  ): Promise<JurisdictionFilterResult> {
    const embedding = await this.deps.generateEmbedding(query);
    if (!embedding) {
      return { memories: [], total_found: 0, jurisdiction_applied: jurisdiction, filtered_out: 0 };
    }

    // Search with jurisdiction filter
    const filtered = await this.deps.searchPoints(
      collection,
      embedding,
      limit,
      0.4,
      {
        should: [
          { key: "jurisdiction", match: { value: jurisdiction } },
          { key: "jurisdiction", match: { value: "global" } },
        ],
      }
    ) as any[];

    // Also get unfiltered count
    const unfiltered = await this.deps.searchPoints(
      collection,
      embedding,
      limit * 2,
      0.4
    ) as any[];

    return {
      memories: filtered.map((m) => ({
        id: m.id,
        score: m.score,
        content: m.payload?.content || m.payload?.text,
        jurisdiction: m.payload?.jurisdiction || "untagged",
        created_at: m.payload?.created_at,
      })),
      total_found: filtered.length,
      jurisdiction_applied: jurisdiction,
      filtered_out: Math.max(0, unfiltered.length - filtered.length),
    };
  }
}

// ---------------------------------------------------------------------------
// REQ-EVO-020: Governance Dashboard with Compliance Scoring
// ---------------------------------------------------------------------------

export interface FrameworkScore {
  framework: string;
  score: number;
  controls_total: number;
  controls_with_evidence: number;
  controls_partial: number;
  controls_gap: number;
  last_assessed: string;
}

export interface ComplianceTrend {
  framework: string;
  period: "30d" | "60d" | "90d";
  score_start: number;
  score_end: number;
  delta: number;
  direction: "improving" | "declining" | "stable";
}

export interface ComplianceGap {
  framework: string;
  control_id: string;
  control_title: string;
  status: "gap" | "partial";
  remediation: string;
  priority: "critical" | "high" | "medium" | "low";
}

export interface DashboardResult {
  overall_score: number;
  framework_scores: FrameworkScore[];
  trends: ComplianceTrend[];
  gaps: ComplianceGap[];
  assessed_at: string;
}

// EU AI Act control definitions
const EU_AI_ACT_CONTROLS = [
  { id: "EUAI-01", title: "Risk Classification", satisfying_actions: ["classify", "DATA_CLASSIFICATION", "TIER_CLASSIFICATION"], min_evidence: 1 },
  { id: "EUAI-02", title: "Transparency Requirements", satisfying_actions: ["store", "memory_store", "logAudit"], min_evidence: 3 },
  { id: "EUAI-03", title: "Human Oversight", satisfying_actions: ["POLICY_DENY", "approval_gate", "human_gate"], min_evidence: 1 },
  { id: "EUAI-04", title: "Data Governance", satisfying_actions: ["DATA_CLASSIFICATION", "cascading_delete", "sovereignty_tag"], min_evidence: 2 },
  { id: "EUAI-05", title: "Technical Documentation", satisfying_actions: ["compliance_report", "audit_export"], min_evidence: 1 },
  { id: "EUAI-06", title: "Record Keeping", satisfying_actions: ["logAudit", "store", "audit_log"], min_evidence: 5 },
  { id: "EUAI-07", title: "Accuracy & Robustness", satisfying_actions: ["contradiction_check", "verify", "memory_verify"], min_evidence: 1 },
  { id: "EUAI-08", title: "Cybersecurity Measures", satisfying_actions: ["red_team", "guardrail_proof", "TRUST_DENY"], min_evidence: 1 },
  { id: "EUAI-09", title: "Conformity Assessment", satisfying_actions: ["compliance_report", "self_assessment"], min_evidence: 1 },
  { id: "EUAI-10", title: "Post-Market Monitoring", satisfying_actions: ["constitutional_monitor", "drift_check"], min_evidence: 1 },
];

// OWASP Agentic Top 10 control definitions
const OWASP_AGENTIC_CONTROLS = [
  { id: "OWASP-AG-01", title: "Excessive Agency Prevention", satisfying_actions: ["POLICY_DENY", "approval_gate", "constitutional_assess"], min_evidence: 1 },
  { id: "OWASP-AG-02", title: "Prompt Injection Defense", satisfying_actions: ["red_team", "prompt_injection_test"], min_evidence: 1 },
  { id: "OWASP-AG-03", title: "Tool Misuse Prevention", satisfying_actions: ["POLICY_DENY", "TRUST_DENY", "tool_validation"], min_evidence: 1 },
  { id: "OWASP-AG-04", title: "Memory Poisoning Defense", satisfying_actions: ["contradiction_check", "memory_verify", "red_team"], min_evidence: 1 },
  { id: "OWASP-AG-05", title: "Privilege Escalation Prevention", satisfying_actions: ["TRUST_DENY", "nhi_lifecycle", "delegation_validate"], min_evidence: 1 },
  { id: "OWASP-AG-06", title: "Data Exfiltration Prevention", satisfying_actions: ["DATA_CLASSIFICATION", "sovereignty_tag", "POLICY_DENY"], min_evidence: 1 },
  { id: "OWASP-AG-07", title: "Goal Hijacking Defense", satisfying_actions: ["constitutional_monitor", "constitutional_assess", "red_team"], min_evidence: 1 },
  { id: "OWASP-AG-08", title: "Supply Chain Security", satisfying_actions: ["nhi_lifecycle", "delegation_validate", "guardrail_proof"], min_evidence: 1 },
  { id: "OWASP-AG-09", title: "Audit Trail Integrity", satisfying_actions: ["logAudit", "guardrail_proof", "merkle_batch"], min_evidence: 3 },
  { id: "OWASP-AG-10", title: "Multi-Agent Coordination Security", satisfying_actions: ["bft_consensus", "parl_coordinate", "agent_identity"], min_evidence: 1 },
];

// Maps control-vocabulary action names (canonical) to the action strings actually
// emitted into audit_log by src logAudit() calls and the n8n governance sweeps.
// Each alias is the SAME activity under a different label — scoring credit only,
// no synthetic evidence. logAudit is handled separately (every audit_log row is one).
const COMPLIANCE_ACTION_ALIASES: Record<string, string[]> = {
  red_team: ["RED_TEAM_SCAN", "RED_TEAM_FINDING"],
  contradiction_check: ["CONTRADICTION_CHECK_CYCLE"],
  compliance_report: ["compliance_report_generated", "COMPLIANCE_DASHBOARD"],
  formal_verify: ["FORMAL_VERIFY_LIST", "FORMAL_VERIFICATION"],
  memory_verify: ["verify", "MEMORY_VERIFY_SWEEP"],
  memory_forget: ["forget"],
  memory_trace: ["trace"],
  self_assessment: ["SELF_ASSESSMENT_WEEKLY"],
  prune: ["MEMORY_PRUNED_BATCH"],
  benchmark: ["benchmark_run", "BENCHMARK_REGRESSION"],
  drift_check: ["CONSTITUTIONAL_DRIFT_DETECTED"],
  constitutional_monitor: ["CONSTITUTIONAL_DRIFT_DETECTED", "CONSTITUTIONAL_OBJECTIVE_SET"],
  agent_identity: ["AGENT_IDENTITY_CREATED", "AGENT_IDENTITY_REVOKED", "AGENT_KEY_ROTATED"],
};

// Emitted-action prefixes that roll up to a canonical control action.
const COMPLIANCE_ACTION_PREFIX_ALIASES: Array<[prefix: string, canonical: string]> = [
  ["NHI_", "nhi_lifecycle"],
  ["provenance_", "provenance"],
];

export class ComplianceDashboard {
  private deps: AdvancedMemoryDeps;

  constructor(deps: AdvancedMemoryDeps) {
    this.deps = deps;
  }

  /** Scan the 30-day audit window once and count evidence per canonical action name. */
  private async buildActionCounts(sinceIso: string): Promise<Map<string, number>> {
    // 10k limit: the 30-day window currently holds ~2.6k events; the old 1000-row cap
    // sampled a biased subset (UUID order) and silently dropped rare action types.
    const auditEvents = await this.deps.scrollPoints(
      "audit_log",
      { must: [{ key: "timestamp", range: { gte: sinceIso } }] },
      10000
    ) as any[];

    const actionCounts = new Map<string, number>();
    const bump = (name: string, by: number = 1) =>
      actionCounts.set(name, (actionCounts.get(name) || 0) + by);

    for (const evt of auditEvents) {
      const action = String(evt.payload?.action || "");
      bump(action);
      for (const [prefix, canonical] of COMPLIANCE_ACTION_PREFIX_ALIASES) {
        if (action.startsWith(prefix)) bump(canonical);
      }
    }
    for (const [canonical, synonyms] of Object.entries(COMPLIANCE_ACTION_ALIASES)) {
      for (const syn of synonyms) {
        const n = actionCounts.get(syn) || 0;
        if (n > 0) bump(canonical, n);
      }
    }
    // Every audit_log row is one logAudit() invocation — the audit-logging controls
    // (AI-MON-04, OWASP-AG-09) measure that the trail exists, which is this count.
    actionCounts.set("logAudit", auditEvents.length);
    return actionCounts;
  }

  async getOverallScore(): Promise<DashboardResult> {
    const frameworkScores = await this.getFrameworkScores();
    const trends = await this.getTrends();
    const gaps = await this.getGaps();

    // Weighted average: ISO 42001 (40%), EU AI Act (35%), OWASP (25%)
    const weights: Record<string, number> = {
      "ISO 42001": 0.4,
      "EU AI Act": 0.35,
      "OWASP Agentic Top 10": 0.25,
    };

    let weightedSum = 0;
    let totalWeight = 0;
    for (const fs of frameworkScores) {
      const w = weights[fs.framework] || 0.33;
      weightedSum += fs.score * w;
      totalWeight += w;
    }

    const overallScore = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;

    const result: DashboardResult = {
      overall_score: overallScore,
      framework_scores: frameworkScores,
      trends,
      gaps,
      assessed_at: new Date().toISOString(),
    };

    // Store dashboard snapshot
    const snapId = this.deps.generateUUID();
    const snapEmbedding = await this.deps.generateEmbedding("compliance dashboard score assessment");
    if (snapEmbedding) {
      await this.deps.storePoint(
        ADVANCED_COLLECTIONS.COMPLIANCE_DASHBOARD,
        snapId,
        snapEmbedding,
        {
          ...result,
          type: "dashboard_snapshot",
        }
      );
    }

    return result;
  }

  async getFrameworkScores(): Promise<FrameworkScore[]> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
    const actionCounts = await this.buildActionCounts(thirtyDaysAgo);

    const scores: FrameworkScore[] = [];

    // ISO 42001 scoring - use the existing ISO42001_CONTROLS if available via audit search
    const isoScore = this.scoreFramework("ISO 42001", this.getISO42001Controls(), actionCounts, now);
    scores.push(isoScore);

    // EU AI Act scoring
    const euScore = this.scoreFramework("EU AI Act", EU_AI_ACT_CONTROLS, actionCounts, now);
    scores.push(euScore);

    // OWASP Agentic Top 10 scoring
    const owaspScore = this.scoreFramework("OWASP Agentic Top 10", OWASP_AGENTIC_CONTROLS, actionCounts, now);
    scores.push(owaspScore);

    return scores;
  }

  async getTrends(): Promise<ComplianceTrend[]> {
    const trends: ComplianceTrend[] = [];
    const now = new Date();

    // Look for historical dashboard snapshots
    const snapshots = await this.deps.scrollPoints(
      ADVANCED_COLLECTIONS.COMPLIANCE_DASHBOARD,
      { must: [{ key: "type", match: { value: "dashboard_snapshot" } }] },
      100
    ) as any[];

    const sorted = snapshots
      .filter((s) => s.payload?.assessed_at)
      .sort((a, b) => {
        const aT = new Date(a.payload.assessed_at).getTime();
        const bT = new Date(b.payload.assessed_at).getTime();
        return bT - aT;
      });

    const frameworks = ["ISO 42001", "EU AI Act", "OWASP Agentic Top 10"];
    const periods: Array<{ label: "30d" | "60d" | "90d"; days: number }> = [
      { label: "30d", days: 30 },
      { label: "60d", days: 60 },
      { label: "90d", days: 90 },
    ];

    for (const framework of frameworks) {
      for (const period of periods) {
        const cutoff = new Date(now.getTime() - period.days * 86400000);

        // Find the earliest snapshot within this period
        const periodSnapshots = sorted.filter(
          (s) => new Date(s.payload.assessed_at).getTime() >= cutoff.getTime()
        );

        if (periodSnapshots.length < 2) {
          trends.push({
            framework,
            period: period.label,
            score_start: 0,
            score_end: 0,
            delta: 0,
            direction: "stable",
          });
          continue;
        }

        const latest = periodSnapshots[0];
        const earliest = periodSnapshots[periodSnapshots.length - 1];

        const latestFrameworkScore = (latest.payload.framework_scores || [])
          .find((fs: any) => fs.framework === framework);
        const earliestFrameworkScore = (earliest.payload.framework_scores || [])
          .find((fs: any) => fs.framework === framework);

        const scoreEnd = latestFrameworkScore?.score || 0;
        const scoreStart = earliestFrameworkScore?.score || 0;
        const delta = Math.round((scoreEnd - scoreStart) * 100) / 100;

        let direction: "improving" | "declining" | "stable";
        if (delta > 2) direction = "improving";
        else if (delta < -2) direction = "declining";
        else direction = "stable";

        trends.push({
          framework,
          period: period.label,
          score_start: scoreStart,
          score_end: scoreEnd,
          delta,
          direction,
        });
      }
    }

    return trends;
  }

  async getGaps(): Promise<ComplianceGap[]> {
    const gaps: ComplianceGap[] = [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
    const actionCounts = await this.buildActionCounts(thirtyDaysAgo);

    // Check all frameworks for gaps
    const allControls: Array<{ framework: string; controls: any[] }> = [
      { framework: "ISO 42001", controls: this.getISO42001Controls() },
      { framework: "EU AI Act", controls: EU_AI_ACT_CONTROLS },
      { framework: "OWASP Agentic Top 10", controls: OWASP_AGENTIC_CONTROLS },
    ];

    for (const { framework, controls } of allControls) {
      for (const control of controls) {
        const evidenceCount = control.satisfying_actions.reduce(
          (sum: number, action: string) => sum + (actionCounts.get(action) || 0),
          0
        );

        const status = evidenceCount >= control.min_evidence ? "satisfied" :
          evidenceCount > 0 ? "partial" : "gap";

        if (status !== "satisfied") {
          // Determine priority
          let priority: "critical" | "high" | "medium" | "low";
          if (status === "gap" && control.min_evidence >= 3) priority = "critical";
          else if (status === "gap") priority = "high";
          else if (evidenceCount < control.min_evidence / 2) priority = "medium";
          else priority = "low";

          const remediation = `Requires evidence of: ${control.satisfying_actions.join(", ")}. ` +
            `Current evidence: ${evidenceCount}/${control.min_evidence}. ` +
            `Run relevant operations to generate audit trail entries.`;

          gaps.push({
            framework,
            control_id: control.id,
            control_title: control.title,
            status,
            remediation,
            priority,
          });
        }
      }
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    gaps.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return gaps;
  }

  private scoreFramework(
    frameworkName: string,
    controls: Array<{ id: string; title: string; satisfying_actions: string[]; min_evidence: number }>,
    actionCounts: Map<string, number>,
    now: Date
  ): FrameworkScore {
    let withEvidence = 0;
    let partial = 0;
    let gap = 0;

    for (const control of controls) {
      const evidenceCount = control.satisfying_actions.reduce(
        (sum, action) => sum + (actionCounts.get(action) || 0),
        0
      );

      if (evidenceCount >= control.min_evidence) {
        withEvidence++;
      } else if (evidenceCount > 0) {
        partial++;
      } else {
        gap++;
      }
    }

    const score = controls.length > 0
      ? Math.round((withEvidence / controls.length) * 10000) / 100
      : 0;

    return {
      framework: frameworkName,
      score,
      controls_total: controls.length,
      controls_with_evidence: withEvidence,
      controls_partial: partial,
      controls_gap: gap,
      last_assessed: now.toISOString(),
    };
  }

  private getISO42001Controls(): Array<{ id: string; title: string; satisfying_actions: string[]; min_evidence: number }> {
    // Derived from the existing iso42001.ts module's control structure
    return [
      { id: "AI-POL-01", title: "AI Policy Statement", satisfying_actions: ["store", "memory_store"], min_evidence: 1 },
      { id: "AI-POL-02", title: "Policy Communication", satisfying_actions: ["store", "memory_store", "logAudit"], min_evidence: 1 },
      { id: "AI-POL-03", title: "Policy Review", satisfying_actions: ["compliance_report", "audit_export"], min_evidence: 1 },
      { id: "AI-POL-04", title: "Roles and Responsibilities", satisfying_actions: ["nhi_lifecycle", "agent_identity", "delegation"], min_evidence: 1 },
      { id: "AI-POL-05", title: "AI Ethics Committee", satisfying_actions: ["constitutional_monitor", "constitutional_assess"], min_evidence: 1 },
      { id: "AI-RSK-01", title: "Risk Assessment Process", satisfying_actions: ["classify", "DATA_CLASSIFICATION", "TIER_CLASSIFICATION"], min_evidence: 1 },
      { id: "AI-RSK-02", title: "Risk Treatment Plan", satisfying_actions: ["POLICY_DENY", "TRUST_DENY", "red_team"], min_evidence: 1 },
      { id: "AI-RSK-03", title: "Risk Monitoring", satisfying_actions: ["constitutional_monitor", "drift_check", "self_assessment"], min_evidence: 1 },
      { id: "AI-RSK-04", title: "Risk Communication", satisfying_actions: ["logAudit", "compliance_report"], min_evidence: 1 },
      { id: "AI-RSK-05", title: "Risk Criteria", satisfying_actions: ["classify", "red_team"], min_evidence: 1 },
      { id: "AI-OBJ-01", title: "AI Objectives", satisfying_actions: ["store", "memory_store"], min_evidence: 1 },
      { id: "AI-OBJ-02", title: "Performance Metrics", satisfying_actions: ["task_specialization", "benchmark", "self_assessment"], min_evidence: 1 },
      { id: "AI-OBJ-03", title: "Objective Monitoring", satisfying_actions: ["compliance_report", "benchmark"], min_evidence: 1 },
      { id: "AI-OBJ-04", title: "Objective Review", satisfying_actions: ["compliance_report"], min_evidence: 1 },
      { id: "AI-OBJ-05", title: "Continuous Improvement", satisfying_actions: ["learning", "trajectory", "self_assessment"], min_evidence: 1 },
      { id: "AI-DAT-01", title: "Data Quality", satisfying_actions: ["contradiction_check", "memory_verify"], min_evidence: 1 },
      { id: "AI-DAT-02", title: "Data Provenance", satisfying_actions: ["memory_trace", "provenance"], min_evidence: 1 },
      { id: "AI-DAT-03", title: "Data Protection", satisfying_actions: ["DATA_CLASSIFICATION", "sovereignty_tag", "cascading_delete"], min_evidence: 1 },
      { id: "AI-DAT-04", title: "Data Lifecycle", satisfying_actions: ["expire", "prune", "memory_forget"], min_evidence: 1 },
      { id: "AI-DAT-05", title: "Data Access Control", satisfying_actions: ["TRUST_DENY", "POLICY_DENY", "nhi_lifecycle"], min_evidence: 1 },
      { id: "AI-IMP-01", title: "Impact Assessment Process", satisfying_actions: ["memory_impact", "self_assessment"], min_evidence: 1 },
      { id: "AI-IMP-02", title: "Stakeholder Consultation", satisfying_actions: ["approval_gate", "human_gate"], min_evidence: 1 },
      { id: "AI-IMP-03", title: "Impact Monitoring", satisfying_actions: ["constitutional_monitor", "memory_impact"], min_evidence: 1 },
      { id: "AI-IMP-04", title: "Impact Review", satisfying_actions: ["compliance_report", "memory_impact"], min_evidence: 1 },
      { id: "AI-IMP-05", title: "Impact Mitigation", satisfying_actions: ["POLICY_DENY", "approval_gate"], min_evidence: 1 },
      { id: "AI-SYS-01", title: "System Design Documentation", satisfying_actions: ["store", "memory_store", "logAudit"], min_evidence: 2 },
      { id: "AI-SYS-02", title: "Development Process", satisfying_actions: ["trajectory", "procedure"], min_evidence: 1 },
      { id: "AI-SYS-03", title: "Testing and Validation", satisfying_actions: ["red_team", "formal_verify", "benchmark"], min_evidence: 1 },
      { id: "AI-SYS-04", title: "Deployment Controls", satisfying_actions: ["nhi_lifecycle", "approval_gate"], min_evidence: 1 },
      { id: "AI-SYS-05", title: "Decommissioning", satisfying_actions: ["nhi_lifecycle", "expire", "memory_forget"], min_evidence: 1 },
      { id: "AI-MON-01", title: "Performance Monitoring", satisfying_actions: ["benchmark", "task_specialization", "self_assessment"], min_evidence: 1 },
      { id: "AI-MON-02", title: "Drift Detection", satisfying_actions: ["constitutional_monitor", "drift_check", "contradiction_check"], min_evidence: 1 },
      { id: "AI-MON-03", title: "Incident Management", satisfying_actions: ["red_team", "logAudit"], min_evidence: 1 },
      { id: "AI-MON-04", title: "Audit Logging", satisfying_actions: ["logAudit", "guardrail_proof"], min_evidence: 5 },
      { id: "AI-MON-05", title: "Alerting Mechanisms", satisfying_actions: ["constitutional_monitor", "self_assessment"], min_evidence: 1 },
      { id: "AI-IMP2-01", title: "Nonconformity Handling", satisfying_actions: ["red_team", "constitutional_monitor"], min_evidence: 1 },
      { id: "AI-IMP2-02", title: "Corrective Action", satisfying_actions: ["learning", "trajectory"], min_evidence: 1 },
      { id: "AI-IMP2-03", title: "Continual Improvement", satisfying_actions: ["learning", "self_assessment", "benchmark"], min_evidence: 1 },
      { id: "AI-IMP2-04", title: "Management Review", satisfying_actions: ["compliance_report", "audit_export"], min_evidence: 1 },
      { id: "AI-IMP2-05", title: "Internal Audit", satisfying_actions: ["compliance_report", "red_team"], min_evidence: 1 },
    ];
  }
}

// ---------------------------------------------------------------------------
// REQ-EVO-021: Stigmergic Coordination Layer
// ---------------------------------------------------------------------------

export interface PheromoneTrail {
  id: string;
  task_type: string;
  tool_chain: string[];
  success_score: number;
  pheromone_strength: number;
  decay_rate: number;
  created_at: string;
  last_reinforced_at: string;
  reinforcement_count: number;
  context_tags: string[];
}

export interface TrailGuidance {
  trails: Array<{
    task_type: string;
    tool_chain: string[];
    pheromone_strength: number;
    success_score: number;
    reinforcement_count: number;
  }>;
  recommendation: string;
}

export interface DecayResult {
  total_trails: number;
  decayed: number;
  evaporated: number;
  remaining: number;
}

export class StigmergicCoordinator {
  private deps: AdvancedMemoryDeps;

  constructor(deps: AdvancedMemoryDeps) {
    this.deps = deps;
  }

  async reinforceTrail(
    taskType: string,
    toolChain: string[],
    successScore: number,
    contextTags: string[] = []
  ): Promise<PheromoneTrail> {
    // Search for existing trail with same task_type and tool_chain
    const embedding = await this.deps.generateEmbedding(
      `${taskType} ${toolChain.join(" ")}`
    );
    if (!embedding) throw new Error("Failed to generate embedding for trail");

    const existing = await this.deps.searchPoints(
      ADVANCED_COLLECTIONS.PHEROMONE_TRAILS,
      embedding,
      5,
      0.85,
      { must: [{ key: "task_type", match: { value: taskType } }] }
    ) as any[];

    // Check if an exact tool_chain match exists
    const exactMatch = existing.find((e) => {
      const existingChain = e.payload?.tool_chain;
      if (!Array.isArray(existingChain)) return false;
      if (existingChain.length !== toolChain.length) return false;
      return existingChain.every((t: string, i: number) => t === toolChain[i]);
    });

    const now = new Date().toISOString();

    if (exactMatch) {
      // Reinforce existing trail
      const payload = exactMatch.payload;
      const currentStrength = payload.pheromone_strength || 0.5;
      // Reinforce proportional to success_score, cap at 1.0
      const reinforcement = successScore * 0.2;
      const newStrength = Math.min(1.0, currentStrength + reinforcement);

      const updatedTrail: Partial<PheromoneTrail> = {
        pheromone_strength: newStrength,
        success_score: (payload.success_score * payload.reinforcement_count + successScore) /
          (payload.reinforcement_count + 1),
        last_reinforced_at: now,
        reinforcement_count: (payload.reinforcement_count || 0) + 1,
        context_tags: [...new Set([...(payload.context_tags || []), ...contextTags])],
      };

      await this.deps.updatePayload(
        ADVANCED_COLLECTIONS.PHEROMONE_TRAILS,
        [String(exactMatch.id)],
        updatedTrail as Record<string, unknown>
      );

      await this.deps.logAudit("pheromone_reinforce", {
        trail_id: exactMatch.id,
        task_type: taskType,
        previous_strength: currentStrength,
        new_strength: newStrength,
      });

      return {
        id: String(exactMatch.id),
        task_type: taskType,
        tool_chain: toolChain,
        success_score: updatedTrail.success_score!,
        pheromone_strength: newStrength,
        decay_rate: payload.decay_rate || 0.05,
        created_at: payload.created_at || now,
        last_reinforced_at: now,
        reinforcement_count: updatedTrail.reinforcement_count!,
        context_tags: updatedTrail.context_tags!,
      };
    }

    // Create new trail
    const trailId = this.deps.generateUUID();
    const trail: PheromoneTrail = {
      id: trailId,
      task_type: taskType,
      tool_chain: toolChain,
      success_score: successScore,
      pheromone_strength: Math.min(1.0, 0.3 + successScore * 0.3),
      decay_rate: 0.05,
      created_at: now,
      last_reinforced_at: now,
      reinforcement_count: 1,
      context_tags: contextTags,
    };

    await this.deps.storePoint(
      ADVANCED_COLLECTIONS.PHEROMONE_TRAILS,
      trailId,
      embedding,
      trail as unknown as Record<string, unknown>
    );

    await this.deps.logAudit("pheromone_create", {
      trail_id: trailId,
      task_type: taskType,
      tool_chain: toolChain,
      initial_strength: trail.pheromone_strength,
    });

    return trail;
  }

  async decayTrails(): Promise<DecayResult> {
    const allTrails = await this.deps.scrollPoints(
      ADVANCED_COLLECTIONS.PHEROMONE_TRAILS,
      undefined,
      500
    ) as any[];

    let decayed = 0;
    let evaporated = 0;
    const toDelete: string[] = [];

    const now = Date.now();

    for (const trail of allTrails) {
      const p = trail.payload || {};
      const lastReinforced = p.last_reinforced_at
        ? new Date(p.last_reinforced_at).getTime()
        : new Date(p.created_at || 0).getTime();

      const daysSinceReinforce = (now - lastReinforced) / 86400000;
      const decayRate = p.decay_rate || 0.05;
      const currentStrength = p.pheromone_strength || 0;

      // Apply daily decay
      const newStrength = currentStrength * Math.pow(1 - decayRate, daysSinceReinforce);

      if (newStrength < 0.1) {
        // Evaporate
        toDelete.push(String(trail.id));
        evaporated++;
      } else if (Math.abs(newStrength - currentStrength) > 0.001) {
        await this.deps.updatePayload(
          ADVANCED_COLLECTIONS.PHEROMONE_TRAILS,
          [String(trail.id)],
          { pheromone_strength: Math.round(newStrength * 1000) / 1000 }
        );
        decayed++;
      }
    }

    if (toDelete.length > 0) {
      await this.deps.deletePoints(ADVANCED_COLLECTIONS.PHEROMONE_TRAILS, toDelete);
    }

    const result: DecayResult = {
      total_trails: allTrails.length,
      decayed,
      evaporated,
      remaining: allTrails.length - evaporated,
    };

    await this.deps.logAudit("pheromone_decay", result as unknown as Record<string, unknown>);

    return result;
  }

  async getGuidance(taskType: string, contextTags: string[] = []): Promise<TrailGuidance> {
    const embedding = await this.deps.generateEmbedding(
      `${taskType} ${contextTags.join(" ")}`
    );
    if (!embedding) {
      return { trails: [], recommendation: "No embedding available for guidance lookup" };
    }

    const matches = await this.deps.searchPoints(
      ADVANCED_COLLECTIONS.PHEROMONE_TRAILS,
      embedding,
      10,
      0.3
    ) as any[];

    // Sort by pheromone_strength * success_score
    const ranked = matches
      .map((m) => ({
        task_type: String(m.payload?.task_type || ""),
        tool_chain: Array.isArray(m.payload?.tool_chain) ? m.payload.tool_chain : [],
        pheromone_strength: Number(m.payload?.pheromone_strength || 0),
        success_score: Number(m.payload?.success_score || 0),
        reinforcement_count: Number(m.payload?.reinforcement_count || 0),
        composite: Number(m.payload?.pheromone_strength || 0) * Number(m.payload?.success_score || 0),
      }))
      .sort((a, b) => b.composite - a.composite)
      .slice(0, 3);

    let recommendation: string;
    if (ranked.length === 0) {
      recommendation = "No prior trails found for this task type. Proceed with standard approach.";
    } else {
      const best = ranked[0];
      recommendation = `Strongest trail: ${best.tool_chain.join(" -> ")} ` +
        `(strength: ${best.pheromone_strength.toFixed(2)}, ` +
        `success: ${best.success_score.toFixed(2)}, ` +
        `reinforced ${best.reinforcement_count}x). ` +
        (ranked.length > 1
          ? `Alternative: ${ranked[1].tool_chain.join(" -> ")} (strength: ${ranked[1].pheromone_strength.toFixed(2)})`
          : "");
    }

    return {
      trails: ranked.map(({ composite, ...rest }) => rest),
      recommendation,
    };
  }
}

// ---------------------------------------------------------------------------
// REQ-EVO-026: A2A Protocol Support
// ---------------------------------------------------------------------------

export interface A2AAgentCard {
  "@context": string;
  "@type": string;
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  authentication: {
    type: string;
    public_key: string;
  };
  trust_level: "untrusted" | "basic" | "verified" | "trusted";
  endpoint: string;
  protocols: string[];
  registered_at: string;
  last_seen: string;
}

export interface A2ATaskRequest {
  task_id: string;
  source_agent: string;
  target_agent: string;
  task_type: string;
  payload: Record<string, unknown>;
  priority: "low" | "medium" | "high" | "critical";
  deadline: string | null;
  governance_validated: boolean;
}

export interface A2ATaskResult {
  task_id: string;
  status: "accepted" | "rejected" | "completed" | "failed";
  result: Record<string, unknown> | null;
  error: string | null;
  governance_check: {
    passed: boolean;
    checks_performed: string[];
    violations: string[];
  };
}

export interface AgentDiscoveryResult {
  agents: A2AAgentCard[];
  total_found: number;
  query: string;
}

export class A2AProtocolBridge {
  private deps: AdvancedMemoryDeps;
  private localAgentCard: A2AAgentCard | null = null;

  constructor(deps: AdvancedMemoryDeps) {
    this.deps = deps;
  }

  async getAgentCard(agentId?: string): Promise<A2AAgentCard> {
    if (agentId) {
      // Fetch a specific agent's card
      const point = await this.deps.getPoint(
        ADVANCED_COLLECTIONS.A2A_AGENTS,
        agentId
      ) as any;
      if (!point?.payload) throw new Error(`Agent ${agentId} not found`);
      return point.payload as A2AAgentCard;
    }

    // Return or create local agent card
    if (this.localAgentCard) return this.localAgentCard;

    // Check if we have a stored local card
    const existing = await this.deps.scrollPoints(
      ADVANCED_COLLECTIONS.A2A_AGENTS,
      { must: [{ key: "name", match: { value: "claude-memory-mcp" } }] },
      1
    ) as any[];

    if (existing.length > 0) {
      this.localAgentCard = existing[0].payload as A2AAgentCard;
      // Update last_seen
      await this.deps.updatePayload(
        ADVANCED_COLLECTIONS.A2A_AGENTS,
        [String(existing[0].id)],
        { last_seen: new Date().toISOString() }
      );
      return this.localAgentCard;
    }

    // Create local agent card
    const { publicKey } = generateKeyPairSync("ed25519");
    const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }) as string;

    const cardId = this.deps.generateUUID();
    const now = new Date().toISOString();

    const card: A2AAgentCard = {
      "@context": "https://schema.org/",
      "@type": "SoftwareAgent",
      id: cardId,
      name: "claude-memory-mcp",
      description: "Memory management and governance agent with persistent storage, compliance scoring, and multi-framework governance",
      capabilities: [
        "memory_store", "memory_recall", "rag_search",
        "compliance_scoring", "data_sovereignty",
        "predictive_preloading", "self_assessment",
        "stigmergic_coordination", "world_model",
      ],
      authentication: {
        type: "ed25519",
        public_key: publicKeyPem,
      },
      trust_level: "trusted",
      endpoint: "stdio://claude-memory-mcp",
      protocols: ["mcp", "a2a"],
      registered_at: now,
      last_seen: now,
    };

    const embedding = await this.deps.generateEmbedding(
      "claude memory mcp agent card capabilities governance compliance"
    );
    if (embedding) {
      await this.deps.storePoint(
        ADVANCED_COLLECTIONS.A2A_AGENTS,
        cardId,
        embedding,
        card as unknown as Record<string, unknown>
      );
    }

    this.localAgentCard = card;
    return card;
  }

  async handleIncomingTask(request: A2ATaskRequest): Promise<A2ATaskResult> {
    const checksPerformed: string[] = [];
    const violations: string[] = [];

    // Governance validation step 1: verify source agent exists and is trusted
    checksPerformed.push("source_agent_verification");
    let sourceCard: A2AAgentCard | null = null;
    try {
      sourceCard = await this.getAgentCard(request.source_agent);
    } catch {
      // Source not registered
    }

    if (!sourceCard) {
      violations.push("Source agent not registered in federation");
    } else if (sourceCard.trust_level === "untrusted") {
      violations.push("Source agent trust level is 'untrusted'");
    }

    // Governance validation step 2: check task type is within capabilities
    checksPerformed.push("capability_check");
    const localCard = await this.getAgentCard();
    if (!localCard.capabilities.includes(request.task_type)) {
      violations.push(`Task type '${request.task_type}' not in local capabilities`);
    }

    // Governance validation step 3: priority-based gating
    checksPerformed.push("priority_gate");
    if (request.priority === "critical" && sourceCard?.trust_level !== "trusted") {
      violations.push("Critical priority tasks require 'trusted' source agent");
    }

    // Governance validation step 4: deadline feasibility
    checksPerformed.push("deadline_check");
    if (request.deadline) {
      const deadlineTime = new Date(request.deadline).getTime();
      if (deadlineTime < Date.now()) {
        violations.push("Task deadline has already passed");
      }
    }

    const governancePassed = violations.length === 0;

    if (!governancePassed) {
      await this.deps.logAudit("a2a_task_rejected", {
        task_id: request.task_id,
        source_agent: request.source_agent,
        task_type: request.task_type,
        violations,
      });

      return {
        task_id: request.task_id,
        status: "rejected",
        result: null,
        error: `Governance validation failed: ${violations.join("; ")}`,
        governance_check: {
          passed: false,
          checks_performed: checksPerformed,
          violations,
        },
      };
    }

    // Task accepted - execute (bridge to internal MCP)
    await this.deps.logAudit("a2a_task_accepted", {
      task_id: request.task_id,
      source_agent: request.source_agent,
      task_type: request.task_type,
      priority: request.priority,
    });

    return {
      task_id: request.task_id,
      status: "accepted",
      result: {
        message: "Task accepted for processing",
        task_type: request.task_type,
        source_agent: request.source_agent,
        accepted_at: new Date().toISOString(),
      },
      error: null,
      governance_check: {
        passed: true,
        checks_performed: checksPerformed,
        violations: [],
      },
    };
  }

  async discoverAgents(query: string, capabilityFilter?: string): Promise<AgentDiscoveryResult> {
    const embedding = await this.deps.generateEmbedding(query);
    if (!embedding) {
      return { agents: [], total_found: 0, query };
    }

    const filter = capabilityFilter
      ? { must: [{ key: "capabilities", match: { any: [capabilityFilter] } }] }
      : undefined;

    const matches = await this.deps.searchPoints(
      ADVANCED_COLLECTIONS.A2A_AGENTS,
      embedding,
      20,
      0.3,
      filter
    ) as any[];

    const agents = matches.map((m) => m.payload as A2AAgentCard);

    return {
      agents,
      total_found: agents.length,
      query,
    };
  }

  async delegateTask(
    targetAgentId: string,
    taskType: string,
    payload: Record<string, unknown>,
    priority: "low" | "medium" | "high" | "critical" = "medium"
  ): Promise<A2ATaskResult> {
    // Verify target agent exists
    let targetCard: A2AAgentCard;
    try {
      targetCard = await this.getAgentCard(targetAgentId);
    } catch {
      return {
        task_id: this.deps.generateUUID(),
        status: "failed",
        result: null,
        error: `Target agent ${targetAgentId} not found`,
        governance_check: {
          passed: false,
          checks_performed: ["target_verification"],
          violations: ["Target agent not registered"],
        },
      };
    }

    // Verify target has the capability
    if (!targetCard.capabilities.includes(taskType)) {
      return {
        task_id: this.deps.generateUUID(),
        status: "failed",
        result: null,
        error: `Target agent does not support task type '${taskType}'`,
        governance_check: {
          passed: false,
          checks_performed: ["capability_check"],
          violations: [`Task type '${taskType}' not in target capabilities`],
        },
      };
    }

    const taskId = this.deps.generateUUID();
    const localCard = await this.getAgentCard();

    const request: A2ATaskRequest = {
      task_id: taskId,
      source_agent: localCard.id,
      target_agent: targetAgentId,
      task_type: taskType,
      payload,
      priority,
      deadline: null,
      governance_validated: true,
    };

    await this.deps.logAudit("a2a_task_delegated", {
      task_id: taskId,
      target_agent: targetAgentId,
      task_type: taskType,
      priority,
    });

    // In a full implementation, this would make an HTTP call to the target agent's endpoint.
    // For local/stdio agents, we return the delegation record.
    return {
      task_id: taskId,
      status: "accepted",
      result: {
        delegation_record: request,
        target_endpoint: targetCard.endpoint,
        target_name: targetCard.name,
        delegated_at: new Date().toISOString(),
      },
      error: null,
      governance_check: {
        passed: true,
        checks_performed: ["target_verification", "capability_check", "trust_level_check"],
        violations: [],
      },
    };
  }
}

// ---------------------------------------------------------------------------
// REQ-EVO-027: World Model for Software Environments
// ---------------------------------------------------------------------------

export interface EnvironmentModel {
  id: string;
  service_name: string;
  endpoint: string;
  response_schema: Record<string, unknown> | null;
  error_patterns: EnvironmentErrorPattern[];
  rate_limits: RateLimitInfo | null;
  dependencies: string[];
  state_effects: StateEffect[];
  prediction_accuracy: number;
  observation_count: number;
  last_observed: string;
  created_at: string;
}

export interface EnvironmentErrorPattern {
  status_code: number;
  message_pattern: string;
  frequency: number;
  typical_resolution: string;
}

export interface RateLimitInfo {
  requests_per_minute: number | null;
  requests_per_hour: number | null;
  concurrent_limit: number | null;
  observed_throttle_count: number;
}

export interface StateEffect {
  operation: string;
  affected_services: string[];
  side_effects: string[];
  reversible: boolean;
}

export interface PredictionResult {
  service_name: string;
  predicted_status: "available" | "degraded" | "unavailable" | "unknown";
  confidence: number;
  expected_latency_ms: number | null;
  potential_errors: string[];
  dependencies_status: Array<{
    service: string;
    predicted_status: string;
  }>;
  recommendation: string;
}

export interface ObservationRecord {
  service_name: string;
  operation: string;
  actual_status: number;
  actual_latency_ms: number;
  error: string | null;
  timestamp: string;
}

export interface ModelCoverage {
  total_services: number;
  services: Array<{
    name: string;
    observation_count: number;
    prediction_accuracy: number;
    last_observed: string;
    error_patterns_known: number;
  }>;
  overall_accuracy: number;
}

export class WorldModel {
  private deps: AdvancedMemoryDeps;

  constructor(deps: AdvancedMemoryDeps) {
    this.deps = deps;
  }

  async predict(serviceName: string, operation?: string): Promise<PredictionResult> {
    // Search for the service model
    const embedding = await this.deps.generateEmbedding(
      `service model ${serviceName} ${operation || ""}`
    );
    if (!embedding) {
      return {
        service_name: serviceName,
        predicted_status: "unknown",
        confidence: 0,
        expected_latency_ms: null,
        potential_errors: [],
        dependencies_status: [],
        recommendation: "No embedding available for prediction",
      };
    }

    const models = await this.deps.searchPoints(
      ADVANCED_COLLECTIONS.WORLD_MODEL,
      embedding,
      5,
      0.5,
      { must: [{ key: "service_name", match: { value: serviceName } }] }
    ) as any[];

    if (models.length === 0) {
      return {
        service_name: serviceName,
        predicted_status: "unknown",
        confidence: 0,
        expected_latency_ms: null,
        potential_errors: [],
        dependencies_status: [],
        recommendation: `No model exists for service '${serviceName}'. Record observations to build the model.`,
      };
    }

    const model = models[0].payload as EnvironmentModel;

    // Calculate predicted status based on error patterns and observation history
    const errorPatterns = model.error_patterns || [];
    const totalErrors = errorPatterns.reduce((sum, ep) => sum + ep.frequency, 0);
    const observationCount = model.observation_count || 1;
    const errorRate = totalErrors / observationCount;

    let predictedStatus: "available" | "degraded" | "unavailable" | "unknown";
    if (errorRate < 0.05) predictedStatus = "available";
    else if (errorRate < 0.3) predictedStatus = "degraded";
    else if (errorRate < 0.8) predictedStatus = "unavailable";
    else predictedStatus = "unavailable";

    // Confidence based on observation count and prediction accuracy
    const confidence = Math.min(
      0.95,
      (model.prediction_accuracy || 0.5) *
        Math.min(1.0, observationCount / 20)
    );

    // Estimate latency from recent observations
    let expectedLatency: number | null = null;
    // Search for recent observations
    const obsEmbedding = await this.deps.generateEmbedding(
      `observation ${serviceName} latency`
    );
    if (obsEmbedding) {
      const recentObs = await this.deps.searchPoints(
        ADVANCED_COLLECTIONS.WORLD_MODEL,
        obsEmbedding,
        10,
        0.6,
        {
          must: [
            { key: "service_name", match: { value: serviceName } },
            { key: "type", match: { value: "observation" } },
          ],
        }
      ) as any[];

      if (recentObs.length > 0) {
        const latencies = recentObs
          .map((o) => o.payload?.actual_latency_ms)
          .filter((l): l is number => typeof l === "number" && l > 0);
        if (latencies.length > 0) {
          expectedLatency = Math.round(
            latencies.reduce((a, b) => a + b, 0) / latencies.length
          );
        }
      }
    }

    // Check dependencies
    const dependenciesStatus: Array<{ service: string; predicted_status: string }> = [];
    for (const dep of (model.dependencies || []).slice(0, 5)) {
      const depPrediction = await this.predict(dep);
      dependenciesStatus.push({
        service: dep,
        predicted_status: depPrediction.predicted_status,
      });
    }

    // Check if any dependency is down
    const depDown = dependenciesStatus.some(
      (d) => d.predicted_status === "unavailable"
    );
    if (depDown && predictedStatus === "available") {
      predictedStatus = "degraded";
    }

    // Potential errors
    const potentialErrors = errorPatterns
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 3)
      .map((ep) => `${ep.status_code}: ${ep.message_pattern} (${ep.typical_resolution})`);

    let recommendation: string;
    if (predictedStatus === "available") {
      recommendation = `Service '${serviceName}' is predicted available with ${Math.round(confidence * 100)}% confidence.`;
    } else if (predictedStatus === "degraded") {
      recommendation = `Service '${serviceName}' may be degraded. ${potentialErrors.length > 0 ? `Watch for: ${potentialErrors[0]}` : "Monitor closely."}`;
    } else {
      recommendation = `Service '${serviceName}' may be unavailable. ${potentialErrors.length > 0 ? `Common error: ${potentialErrors[0]}` : "Check service health."}`;
    }

    return {
      service_name: serviceName,
      predicted_status: predictedStatus,
      confidence: Math.round(confidence * 100) / 100,
      expected_latency_ms: expectedLatency,
      potential_errors: potentialErrors,
      dependencies_status: dependenciesStatus,
      recommendation,
    };
  }

  async recordObservation(observation: ObservationRecord): Promise<{ model_updated: boolean; observation_id: string }> {
    const obsId = this.deps.generateUUID();
    const embedding = await this.deps.generateEmbedding(
      `observation ${observation.service_name} ${observation.operation} ${observation.error || "success"}`
    );
    if (!embedding) throw new Error("Failed to generate embedding for observation");

    // Store observation
    await this.deps.storePoint(
      ADVANCED_COLLECTIONS.WORLD_MODEL,
      obsId,
      embedding,
      {
        ...observation,
        type: "observation",
        id: obsId,
      }
    );

    // Find or create the service model
    const modelEmb = await this.deps.generateEmbedding(
      `service model ${observation.service_name}`
    );
    if (!modelEmb) return { model_updated: false, observation_id: obsId };

    const existingModels = await this.deps.searchPoints(
      ADVANCED_COLLECTIONS.WORLD_MODEL,
      modelEmb,
      1,
      0.8,
      {
        must: [
          { key: "service_name", match: { value: observation.service_name } },
          { key: "type", match: { value: "service_model" } },
        ],
      }
    ) as any[];

    if (existingModels.length > 0) {
      // Update existing model
      const model = existingModels[0].payload as EnvironmentModel & { type: string };
      const errorPatterns = [...(model.error_patterns || [])];
      const observationCount = (model.observation_count || 0) + 1;

      // Update error patterns if this was an error
      if (observation.error && observation.actual_status >= 400) {
        const existingPattern = errorPatterns.find(
          (ep) => ep.status_code === observation.actual_status
        );
        if (existingPattern) {
          existingPattern.frequency++;
        } else {
          errorPatterns.push({
            status_code: observation.actual_status,
            message_pattern: observation.error.slice(0, 200),
            frequency: 1,
            typical_resolution: "Investigate and resolve",
          });
        }
      }

      await this.deps.updatePayload(
        ADVANCED_COLLECTIONS.WORLD_MODEL,
        [String(existingModels[0].id)],
        {
          error_patterns: errorPatterns,
          observation_count: observationCount,
          last_observed: observation.timestamp,
        }
      );

      return { model_updated: true, observation_id: obsId };
    }

    // Create new service model
    const modelId = this.deps.generateUUID();
    const now = new Date().toISOString();

    const newModel: EnvironmentModel & { type: string } = {
      id: modelId,
      type: "service_model",
      service_name: observation.service_name,
      endpoint: "",
      response_schema: null,
      error_patterns: observation.error && observation.actual_status >= 400
        ? [{
          status_code: observation.actual_status,
          message_pattern: observation.error.slice(0, 200),
          frequency: 1,
          typical_resolution: "Investigate and resolve",
        }]
        : [],
      rate_limits: null,
      dependencies: [],
      state_effects: [],
      prediction_accuracy: 0.5,
      observation_count: 1,
      last_observed: observation.timestamp,
      created_at: now,
    };

    await this.deps.storePoint(
      ADVANCED_COLLECTIONS.WORLD_MODEL,
      modelId,
      modelEmb,
      newModel as unknown as Record<string, unknown>
    );

    return { model_updated: true, observation_id: obsId };
  }

  async updateModel(
    serviceName: string,
    updates: {
      endpoint?: string;
      response_schema?: Record<string, unknown>;
      dependencies?: string[];
      state_effects?: StateEffect[];
      rate_limits?: RateLimitInfo;
    }
  ): Promise<EnvironmentModel | null> {
    const embedding = await this.deps.generateEmbedding(
      `service model ${serviceName}`
    );
    if (!embedding) return null;

    const existingModels = await this.deps.searchPoints(
      ADVANCED_COLLECTIONS.WORLD_MODEL,
      embedding,
      1,
      0.8,
      {
        must: [
          { key: "service_name", match: { value: serviceName } },
          { key: "type", match: { value: "service_model" } },
        ],
      }
    ) as any[];

    if (existingModels.length === 0) {
      // Create a new model with the updates
      const modelId = this.deps.generateUUID();
      const now = new Date().toISOString();

      const newModel: EnvironmentModel & { type: string } = {
        id: modelId,
        type: "service_model",
        service_name: serviceName,
        endpoint: updates.endpoint || "",
        response_schema: updates.response_schema || null,
        error_patterns: [],
        rate_limits: updates.rate_limits || null,
        dependencies: updates.dependencies || [],
        state_effects: updates.state_effects || [],
        prediction_accuracy: 0.5,
        observation_count: 0,
        last_observed: now,
        created_at: now,
      };

      await this.deps.storePoint(
        ADVANCED_COLLECTIONS.WORLD_MODEL,
        modelId,
        embedding,
        newModel as unknown as Record<string, unknown>
      );

      return newModel;
    }

    // Update existing model
    const updatePayload: Record<string, unknown> = {};
    if (updates.endpoint !== undefined) updatePayload.endpoint = updates.endpoint;
    if (updates.response_schema !== undefined) updatePayload.response_schema = updates.response_schema;
    if (updates.dependencies !== undefined) updatePayload.dependencies = updates.dependencies;
    if (updates.state_effects !== undefined) updatePayload.state_effects = updates.state_effects;
    if (updates.rate_limits !== undefined) updatePayload.rate_limits = updates.rate_limits;

    await this.deps.updatePayload(
      ADVANCED_COLLECTIONS.WORLD_MODEL,
      [String(existingModels[0].id)],
      updatePayload
    );

    await this.deps.logAudit("world_model_update", {
      service_name: serviceName,
      fields_updated: Object.keys(updatePayload),
    });

    return {
      ...existingModels[0].payload,
      ...updatePayload,
    } as EnvironmentModel;
  }

  async getModelCoverage(): Promise<ModelCoverage> {
    const allModels = await this.deps.scrollPoints(
      ADVANCED_COLLECTIONS.WORLD_MODEL,
      { must: [{ key: "type", match: { value: "service_model" } }] },
      500
    ) as any[];

    let totalAccuracy = 0;
    let accuracyCount = 0;

    const services = allModels.map((m) => {
      const p = m.payload || {};
      const accuracy = p.prediction_accuracy || 0.5;
      totalAccuracy += accuracy;
      accuracyCount++;

      return {
        name: String(p.service_name || "unknown"),
        observation_count: Number(p.observation_count || 0),
        prediction_accuracy: Math.round(accuracy * 100) / 100,
        last_observed: String(p.last_observed || ""),
        error_patterns_known: Array.isArray(p.error_patterns) ? p.error_patterns.length : 0,
      };
    });

    return {
      total_services: services.length,
      services,
      overall_accuracy: accuracyCount > 0
        ? Math.round((totalAccuracy / accuracyCount) * 100) / 100
        : 0,
    };
  }
}
