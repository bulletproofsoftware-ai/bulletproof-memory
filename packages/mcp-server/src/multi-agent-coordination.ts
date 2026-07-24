/**
 * W2-B4: Multi-Agent Architecture
 *
 * REQ-EVO-022: Emergent Task Specialization
 * REQ-EVO-028: Cost-Aware Agent Routing with Model Cascading
 * REQ-EVO-025: Parallel Agent State Coordination (PARL)
 * REQ-EVO-023: Byzantine Fault Tolerance for Agent Consensus
 */

import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Dependency injection interface
// ---------------------------------------------------------------------------

export interface MultiAgentDeps {
  generateEmbedding: (text: string) => Promise<number[] | null>;
  storePoint: (collection: string, id: string, vector: number[], payload: Record<string, unknown>) => Promise<void>;
  scrollPoints: (collection: string, filter?: Record<string, unknown>, limit?: number) => Promise<unknown[]>;
  searchPoints: (collection: string, vector: number[], limit: number, threshold?: number, filter?: Record<string, unknown>) => Promise<unknown[]>;
  deletePoints: (collection: string, ids: string[]) => Promise<void>;
  updatePayload: (collection: string, ids: string[], payload: Record<string, unknown>) => Promise<void>;
  logAudit: (action: string, details: Record<string, unknown>, sensitivity?: string, project?: string) => Promise<string | null>;
  generateUUID: () => string;
}

// ---------------------------------------------------------------------------
// Collection constants
// ---------------------------------------------------------------------------

export const MULTI_AGENT_COLLECTIONS = {
  TASK_SPECIALIZATION: "task_specialization",
  COST_ROUTING: "cost_routing",
  BFT_CONSENSUS: "bft_consensus",
};

// ---------------------------------------------------------------------------
// Types: REQ-EVO-022 Task Specialization
// ---------------------------------------------------------------------------

export interface PerformanceRecord {
  agent_id: string;
  task_type: string;
  attempts: number;
  successes: number;
  failures: number;
  total_cost: number;
  total_time_ms: number;
  avg_cost: number;
  avg_time_ms: number;
  success_rate: number;
  last_updated: string;
}

export interface RoutingScore {
  agent_id: string;
  score: number;
  breakdown: {
    capability_match: number;
    success_rate: number;
    cost_efficiency: number;
    availability: number;
  };
  is_specialist: boolean;
  specialization_sigma: number;
}

export interface SpecializationReport {
  agent_id: string;
  specializations: Array<{
    task_type: string;
    sigma_above_mean: number;
    success_rate: number;
    total_attempts: number;
  }>;
  generalist_score: number;
}

// ---------------------------------------------------------------------------
// Types: REQ-EVO-028 Cost-Aware Routing
// ---------------------------------------------------------------------------

export type ModelTier = "haiku" | "sonnet" | "opus";
export type TaskComplexity = "simple" | "medium" | "complex";

export interface ModelConfig {
  tier: ModelTier;
  cost_per_1k_tokens: number;
  max_tokens: number;
  label: string;
}

export interface CostOutcome {
  id: string;
  task_type: string;
  model_tier: ModelTier;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: number;
  outcome: "success" | "failure" | "escalated";
  complexity: TaskComplexity;
  timestamp: string;
}

export interface CostAnalytics {
  total_cost: number;
  total_tasks: number;
  by_model: Record<ModelTier, {
    tasks: number;
    total_cost: number;
    success_rate: number;
    avg_tokens: number;
  }>;
  by_complexity: Record<TaskComplexity, {
    tasks: number;
    avg_cost: number;
    escalation_rate: number;
  }>;
  cost_savings_estimate: number;
  period_start: string;
  period_end: string;
}

export interface DailyBudget {
  model_tier: ModelTier;
  daily_limit: number;
  spent_today: number;
  remaining: number;
  reset_at: string;
}

// ---------------------------------------------------------------------------
// Types: REQ-EVO-025 PARL Coordination
// ---------------------------------------------------------------------------

export type LockType = "read" | "write";

export interface LockRecord {
  resource_id: string;
  agent_id: string;
  lock_type: LockType;
  acquired_at: number;
  ttl_ms: number;
  expires_at: number;
}

export interface HeartbeatRecord {
  agent_id: string;
  last_heartbeat: number;
  status: "alive" | "suspected" | "dead";
}

export interface StateEvent {
  source_agent_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  sequence: number;
}

// ---------------------------------------------------------------------------
// Types: REQ-EVO-023 BFT Consensus
// ---------------------------------------------------------------------------

export interface AgentVote {
  agent_id: string;
  proposal_id: string;
  verdict: "approve" | "reject" | "abstain";
  confidence: number;
  reasoning: string;
  evidence_hashes: string[];
  is_critical: boolean;
  timestamp: string;
  weight: number;
}

export type ConsensusOutcome = "accepted" | "accepted_with_dissent" | "rejected" | "rejected_with_dissent" | "escalated" | "pending";

export interface ConsensusResult {
  proposal_id: string;
  outcome: ConsensusOutcome;
  total_votes: number;
  approve_count: number;
  reject_count: number;
  abstain_count: number;
  weighted_approve: number;
  weighted_reject: number;
  dissenting_agents: string[];
  is_critical: boolean;
  escalation_reason?: string;
  decided_at: string;
}

export interface VotingHistoryEntry {
  proposal_id: string;
  outcome: ConsensusOutcome;
  vote_count: number;
  decided_at: string;
}

// ============================================================================
// REQ-EVO-022: Emergent Task Specialization Engine
// ============================================================================

export class TaskSpecializationEngine {
  private matrix: Map<string, PerformanceRecord> = new Map();
  private agentAvailability: Map<string, boolean> = new Map();
  private deps: MultiAgentDeps;

  constructor(deps: MultiAgentDeps) {
    this.deps = deps;
  }

  private matrixKey(agentId: string, taskType: string): string {
    return `${agentId}::${taskType}`;
  }

  /**
   * Record an outcome (success/failure) for an agent performing a task type.
   */
  async recordOutcome(params: {
    agent_id: string;
    task_type: string;
    success: boolean;
    cost: number;
    time_ms: number;
  }): Promise<PerformanceRecord> {
    const key = this.matrixKey(params.agent_id, params.task_type);
    const existing = this.matrix.get(key);

    const record: PerformanceRecord = existing
      ? { ...existing }
      : {
          agent_id: params.agent_id,
          task_type: params.task_type,
          attempts: 0,
          successes: 0,
          failures: 0,
          total_cost: 0,
          total_time_ms: 0,
          avg_cost: 0,
          avg_time_ms: 0,
          success_rate: 0,
          last_updated: new Date().toISOString(),
        };

    record.attempts += 1;
    if (params.success) {
      record.successes += 1;
    } else {
      record.failures += 1;
    }
    record.total_cost += params.cost;
    record.total_time_ms += params.time_ms;
    record.avg_cost = record.total_cost / record.attempts;
    record.avg_time_ms = record.total_time_ms / record.attempts;
    record.success_rate = record.successes / record.attempts;
    record.last_updated = new Date().toISOString();

    this.matrix.set(key, record);

    // Persist to Qdrant
    const embedding = await this.deps.generateEmbedding(
      `agent ${params.agent_id} task ${params.task_type} performance`
    );
    if (embedding) {
      const id = this.deps.generateUUID();
      await this.deps.storePoint(
        MULTI_AGENT_COLLECTIONS.TASK_SPECIALIZATION,
        id,
        embedding,
        {
          record_type: "performance",
          ...record,
        }
      );
    }

    await this.deps.logAudit("task_specialization_outcome", {
      agent_id: params.agent_id,
      task_type: params.task_type,
      success: params.success,
      attempts: record.attempts,
      success_rate: record.success_rate,
    });

    return record;
  }

  /**
   * Set agent availability (used in routing score).
   */
  setAvailability(agentId: string, available: boolean): void {
    this.agentAvailability.set(agentId, available);
  }

  /**
   * Compute routing score for an agent on a given task type.
   * Score = capability_match*0.4 + success_rate*0.3 + cost_efficiency*0.2 + availability*0.1
   */
  getRoutingScore(agentId: string, taskType: string): RoutingScore {
    const key = this.matrixKey(agentId, taskType);
    const record = this.matrix.get(key);
    const available = this.agentAvailability.get(agentId) ?? true;

    // Capability match: based on whether agent has history with this task type
    let capabilityMatch = 0;
    if (record && record.attempts > 0) {
      // More attempts = higher capability match, capped at 1.0
      capabilityMatch = Math.min(1.0, record.attempts / 20);
      // Boost if specialist
      const report = this.getSpecializationReport(agentId);
      const spec = report.specializations.find((s) => s.task_type === taskType);
      if (spec && spec.sigma_above_mean >= 2.0) {
        capabilityMatch = 1.0;
      }
    }

    // Success rate: direct from record
    const successRate = record ? record.success_rate : 0.5; // default 0.5 for unknown

    // Cost efficiency: compare against all agents doing same task type
    let costEfficiency = 0.5;
    const allRecordsForType = this.getRecordsForTaskType(taskType);
    if (allRecordsForType.length > 1 && record) {
      const costs = allRecordsForType.map((r) => r.avg_cost);
      const maxCost = Math.max(...costs);
      const minCost = Math.min(...costs);
      if (maxCost > minCost) {
        // Lower cost = higher efficiency (inverted normalized)
        costEfficiency = 1.0 - (record.avg_cost - minCost) / (maxCost - minCost);
      } else {
        costEfficiency = 1.0;
      }
    } else if (record) {
      costEfficiency = 0.7; // Slightly above default if has record but no comparison
    }

    const availabilityScore = available ? 1.0 : 0.0;

    const score =
      capabilityMatch * 0.4 +
      successRate * 0.3 +
      costEfficiency * 0.2 +
      availabilityScore * 0.1;

    // Check specialization
    const specReport = this.getSpecializationReport(agentId);
    const specEntry = specReport.specializations.find((s) => s.task_type === taskType);

    return {
      agent_id: agentId,
      score,
      breakdown: {
        capability_match: capabilityMatch,
        success_rate: successRate,
        cost_efficiency: costEfficiency,
        availability: availabilityScore,
      },
      is_specialist: specEntry ? specEntry.sigma_above_mean >= 2.0 : false,
      specialization_sigma: specEntry ? specEntry.sigma_above_mean : 0,
    };
  }

  /**
   * Detect specialization: agents >2 stdev better than mean on specific task types.
   */
  getSpecializationReport(agentId: string): SpecializationReport {
    // Gather all task types this agent has worked on
    const agentRecords: PerformanceRecord[] = [];
    for (const [key, record] of this.matrix) {
      if (record.agent_id === agentId) {
        agentRecords.push(record);
      }
    }

    const specializations: SpecializationReport["specializations"] = [];
    let totalSigma = 0;
    let taskCount = 0;

    for (const agentRecord of agentRecords) {
      if (agentRecord.attempts < 3) continue; // Need minimum 3 attempts for significance

      // Get all agents' success rates for this task type
      const allRates = this.getRecordsForTaskType(agentRecord.task_type)
        .filter((r) => r.attempts >= 3)
        .map((r) => r.success_rate);

      if (allRates.length < 2) {
        // Only one agent — can't compute stdev
        if (agentRecord.success_rate > 0.8) {
          specializations.push({
            task_type: agentRecord.task_type,
            sigma_above_mean: 2.0, // Mark as specialist by default if high rate
            success_rate: agentRecord.success_rate,
            total_attempts: agentRecord.attempts,
          });
        }
        continue;
      }

      const mean = allRates.reduce((a, b) => a + b, 0) / allRates.length;
      const variance = allRates.reduce((sum, r) => sum + (r - mean) ** 2, 0) / allRates.length;
      const stdev = Math.sqrt(variance);

      const sigmaAboveMean = stdev > 0 ? (agentRecord.success_rate - mean) / stdev : 0;
      totalSigma += Math.max(0, sigmaAboveMean);
      taskCount++;

      if (sigmaAboveMean >= 2.0) {
        specializations.push({
          task_type: agentRecord.task_type,
          sigma_above_mean: Math.round(sigmaAboveMean * 100) / 100,
          success_rate: agentRecord.success_rate,
          total_attempts: agentRecord.attempts,
        });
      }
    }

    // Generalist score: inverse of max specialization sigma (high specialization = low generalist)
    const generalistScore = taskCount > 0
      ? Math.max(0, 1.0 - (totalSigma / taskCount) / 3.0)
      : 0.5;

    return {
      agent_id: agentId,
      specializations,
      generalist_score: Math.round(generalistScore * 100) / 100,
    };
  }

  /**
   * Return the full performance matrix.
   */
  getPerformanceMatrix(): PerformanceRecord[] {
    return Array.from(this.matrix.values());
  }

  /**
   * Get all records for a specific task type across all agents.
   */
  private getRecordsForTaskType(taskType: string): PerformanceRecord[] {
    const records: PerformanceRecord[] = [];
    for (const record of this.matrix.values()) {
      if (record.task_type === taskType) {
        records.push(record);
      }
    }
    return records;
  }

  /**
   * Get best agent for a task type by routing score.
   */
  getBestAgent(taskType: string, agentIds: string[]): RoutingScore | null {
    if (agentIds.length === 0) return null;

    let best: RoutingScore | null = null;
    for (const agentId of agentIds) {
      const score = this.getRoutingScore(agentId, taskType);
      if (!best || score.score > best.score) {
        best = score;
      }
    }
    return best;
  }
}

// ============================================================================
// REQ-EVO-028: Cost-Aware Agent Routing with Model Cascading
// ============================================================================

const MODEL_CONFIGS: Record<ModelTier, ModelConfig> = {
  haiku: {
    tier: "haiku",
    cost_per_1k_tokens: 0.001,
    max_tokens: 4096,
    label: "Claude Haiku (~$0.001/call)",
  },
  sonnet: {
    tier: "sonnet",
    cost_per_1k_tokens: 0.01,
    max_tokens: 8192,
    label: "Claude Sonnet (~$0.01/call)",
  },
  opus: {
    tier: "opus",
    cost_per_1k_tokens: 0.10,
    max_tokens: 16384,
    label: "Claude Opus (~$0.10/call)",
  },
};

const TIER_ORDER: ModelTier[] = ["haiku", "sonnet", "opus"];

export class CostAwareRouter {
  private outcomes: CostOutcome[] = [];
  private budgets: Map<ModelTier, { daily_limit: number; spent_today: number; reset_date: string }> = new Map();
  private deps: MultiAgentDeps;

  constructor(deps: MultiAgentDeps) {
    this.deps = deps;
    // Initialize default budgets
    const today = new Date().toISOString().split("T")[0];
    this.budgets.set("haiku", { daily_limit: 10.0, spent_today: 0, reset_date: today });
    this.budgets.set("sonnet", { daily_limit: 50.0, spent_today: 0, reset_date: today });
    this.budgets.set("opus", { daily_limit: 100.0, spent_today: 0, reset_date: today });
  }

  /**
   * Classify task complexity using heuristics on the task description.
   */
  classifyComplexity(taskDescription: string): TaskComplexity {
    const lower = taskDescription.toLowerCase();
    const wordCount = taskDescription.split(/\s+/).length;

    // Complex indicators
    const complexPatterns = [
      /multi[- ]?step/i,
      /architect/i,
      /design\s+(system|pattern)/i,
      /security\s+(audit|review|assessment)/i,
      /formal\s+verif/i,
      /consensus/i,
      /refactor.*large/i,
      /migration/i,
      /cross[- ]?service/i,
      /distributed/i,
      /compliance/i,
      /regulatory/i,
    ];

    // Simple indicators
    const simplePatterns = [
      /^(list|get|show|display|print|read|check|status)\b/i,
      /^(what|who|where|when)\s+(is|are|was|were)\b/i,
      /lookup/i,
      /^format/i,
      /^count/i,
      /^find\s+\w+$/i,
      /simple/i,
      /trivial/i,
    ];

    const complexScore = complexPatterns.reduce(
      (count, pat) => count + (pat.test(lower) ? 1 : 0),
      0
    );
    const simpleScore = simplePatterns.reduce(
      (count, pat) => count + (pat.test(lower) ? 1 : 0),
      0
    );

    // Word count factor
    const lengthFactor = wordCount > 100 ? 2 : wordCount > 50 ? 1 : 0;

    const finalScore = complexScore + lengthFactor - simpleScore;

    if (finalScore >= 2) return "complex";
    if (finalScore <= -1 || (simpleScore > 0 && complexScore === 0)) return "simple";
    return "medium";
  }

  /**
   * Select the appropriate model tier based on complexity, with budget check.
   * Returns the selected tier and whether it was escalated.
   */
  selectModel(params: {
    task_description: string;
    complexity?: TaskComplexity;
    force_tier?: ModelTier;
    failed_tiers?: ModelTier[];
  }): { tier: ModelTier; config: ModelConfig; escalated: boolean; reason: string } {
    const complexity = params.complexity || this.classifyComplexity(params.task_description);
    const failedTiers = new Set(params.failed_tiers || []);

    if (params.force_tier && !failedTiers.has(params.force_tier)) {
      const budget = this.checkBudget(params.force_tier);
      if (budget.remaining > 0) {
        return {
          tier: params.force_tier,
          config: MODEL_CONFIGS[params.force_tier],
          escalated: false,
          reason: `Forced tier: ${params.force_tier}`,
        };
      }
    }

    // Map complexity to starting tier
    let startTier: ModelTier;
    switch (complexity) {
      case "simple":
        startTier = "haiku";
        break;
      case "medium":
        startTier = "sonnet";
        break;
      case "complex":
        startTier = "opus";
        break;
    }

    // Walk up from starting tier, skipping failed and over-budget tiers
    const startIdx = TIER_ORDER.indexOf(startTier);
    for (let i = startIdx; i < TIER_ORDER.length; i++) {
      const tier = TIER_ORDER[i];
      if (failedTiers.has(tier)) continue;

      const budget = this.checkBudget(tier);
      if (budget.remaining <= 0) continue;

      return {
        tier,
        config: MODEL_CONFIGS[tier],
        escalated: i > startIdx,
        reason: i > startIdx
          ? `Escalated from ${startTier} to ${tier} (${failedTiers.size > 0 ? "lower tier failure" : "budget exhausted"})`
          : `Matched complexity '${complexity}' to ${tier}`,
      };
    }

    // All tiers exhausted or over budget — return opus as last resort
    return {
      tier: "opus",
      config: MODEL_CONFIGS.opus,
      escalated: true,
      reason: "All preferred tiers exhausted or over budget; falling back to opus",
    };
  }

  /**
   * Record an outcome after a model call completes.
   */
  async recordOutcome(params: {
    task_type: string;
    model_tier: ModelTier;
    input_tokens: number;
    output_tokens: number;
    outcome: "success" | "failure" | "escalated";
    complexity: TaskComplexity;
  }): Promise<CostOutcome> {
    const totalTokens = params.input_tokens + params.output_tokens;
    const costPer1k = MODEL_CONFIGS[params.model_tier].cost_per_1k_tokens;
    const cost = (totalTokens / 1000) * costPer1k;

    const record: CostOutcome = {
      id: this.deps.generateUUID(),
      task_type: params.task_type,
      model_tier: params.model_tier,
      input_tokens: params.input_tokens,
      output_tokens: params.output_tokens,
      total_tokens: totalTokens,
      cost,
      outcome: params.outcome,
      complexity: params.complexity,
      timestamp: new Date().toISOString(),
    };

    this.outcomes.push(record);

    // Update daily budget
    this.resetBudgetIfNewDay(params.model_tier);
    const budget = this.budgets.get(params.model_tier);
    if (budget) {
      budget.spent_today += cost;
    }

    // Persist to Qdrant
    const embedding = await this.deps.generateEmbedding(
      `cost outcome ${params.task_type} ${params.model_tier} ${params.outcome}`
    );
    if (embedding) {
      await this.deps.storePoint(
        MULTI_AGENT_COLLECTIONS.COST_ROUTING,
        record.id,
        embedding,
        {
          record_type: "cost_outcome",
          ...record,
        }
      );
    }

    await this.deps.logAudit("cost_router_outcome", {
      task_type: params.task_type,
      model_tier: params.model_tier,
      cost,
      outcome: params.outcome,
      total_tokens: totalTokens,
    });

    return record;
  }

  /**
   * Get cost analytics across all recorded outcomes.
   */
  getCostAnalytics(since?: string): CostAnalytics {
    const sinceTs = since ? new Date(since).getTime() : 0;
    const filtered = this.outcomes.filter(
      (o) => new Date(o.timestamp).getTime() >= sinceTs
    );

    const byModel: CostAnalytics["by_model"] = {
      haiku: { tasks: 0, total_cost: 0, success_rate: 0, avg_tokens: 0 },
      sonnet: { tasks: 0, total_cost: 0, success_rate: 0, avg_tokens: 0 },
      opus: { tasks: 0, total_cost: 0, success_rate: 0, avg_tokens: 0 },
    };

    const byComplexity: CostAnalytics["by_complexity"] = {
      simple: { tasks: 0, avg_cost: 0, escalation_rate: 0 },
      medium: { tasks: 0, avg_cost: 0, escalation_rate: 0 },
      complex: { tasks: 0, avg_cost: 0, escalation_rate: 0 },
    };

    const modelSuccesses: Record<ModelTier, number> = { haiku: 0, sonnet: 0, opus: 0 };
    const modelTokens: Record<ModelTier, number> = { haiku: 0, sonnet: 0, opus: 0 };
    const complexityCosts: Record<TaskComplexity, number> = { simple: 0, medium: 0, complex: 0 };
    const complexityEscalations: Record<TaskComplexity, number> = { simple: 0, medium: 0, complex: 0 };

    let totalCost = 0;

    for (const o of filtered) {
      totalCost += o.cost;

      byModel[o.model_tier].tasks += 1;
      byModel[o.model_tier].total_cost += o.cost;
      modelTokens[o.model_tier] += o.total_tokens;
      if (o.outcome === "success") modelSuccesses[o.model_tier] += 1;

      byComplexity[o.complexity].tasks += 1;
      complexityCosts[o.complexity] += o.cost;
      if (o.outcome === "escalated") complexityEscalations[o.complexity] += 1;
    }

    // Compute averages
    for (const tier of TIER_ORDER) {
      const m = byModel[tier];
      if (m.tasks > 0) {
        m.success_rate = modelSuccesses[tier] / m.tasks;
        m.avg_tokens = modelTokens[tier] / m.tasks;
        m.total_cost = Math.round(m.total_cost * 10000) / 10000;
      }
    }

    for (const complexity of ["simple", "medium", "complex"] as TaskComplexity[]) {
      const c = byComplexity[complexity];
      if (c.tasks > 0) {
        c.avg_cost = Math.round((complexityCosts[complexity] / c.tasks) * 10000) / 10000;
        c.escalation_rate = complexityEscalations[complexity] / c.tasks;
      }
    }

    // Estimate savings: how much would it cost if everything ran on opus?
    const opusCostPer1k = MODEL_CONFIGS.opus.cost_per_1k_tokens;
    const allTokens = filtered.reduce((sum, o) => sum + o.total_tokens, 0);
    const hypotheticalAllOpus = (allTokens / 1000) * opusCostPer1k;
    const savings = hypotheticalAllOpus - totalCost;

    const timestamps = filtered.map((o) => o.timestamp);

    return {
      total_cost: Math.round(totalCost * 10000) / 10000,
      total_tasks: filtered.length,
      by_model: byModel,
      by_complexity: byComplexity,
      cost_savings_estimate: Math.round(Math.max(0, savings) * 10000) / 10000,
      period_start: timestamps.length > 0 ? timestamps.sort()[0] : new Date().toISOString(),
      period_end: timestamps.length > 0 ? timestamps.sort().reverse()[0] : new Date().toISOString(),
    };
  }

  /**
   * Set a daily budget limit for a model tier.
   */
  setDailyBudget(tier: ModelTier, limit: number): DailyBudget {
    const today = new Date().toISOString().split("T")[0];
    const existing = this.budgets.get(tier);
    const spent = existing?.reset_date === today ? (existing?.spent_today ?? 0) : 0;

    this.budgets.set(tier, { daily_limit: limit, spent_today: spent, reset_date: today });

    const resetAt = new Date();
    resetAt.setUTCHours(24, 0, 0, 0);

    return {
      model_tier: tier,
      daily_limit: limit,
      spent_today: spent,
      remaining: Math.max(0, limit - spent),
      reset_at: resetAt.toISOString(),
    };
  }

  /**
   * Check remaining budget for a tier.
   */
  checkBudget(tier: ModelTier): DailyBudget {
    this.resetBudgetIfNewDay(tier);
    const budget = this.budgets.get(tier);
    const limit = budget?.daily_limit ?? 100;
    const spent = budget?.spent_today ?? 0;

    const resetAt = new Date();
    resetAt.setUTCHours(24, 0, 0, 0);

    return {
      model_tier: tier,
      daily_limit: limit,
      spent_today: Math.round(spent * 10000) / 10000,
      remaining: Math.round(Math.max(0, limit - spent) * 10000) / 10000,
      reset_at: resetAt.toISOString(),
    };
  }

  private resetBudgetIfNewDay(tier: ModelTier): void {
    const today = new Date().toISOString().split("T")[0];
    const budget = this.budgets.get(tier);
    if (budget && budget.reset_date !== today) {
      budget.spent_today = 0;
      budget.reset_date = today;
    }
  }
}

// ============================================================================
// REQ-EVO-025: Parallel Agent State Coordination (PARL)
// ============================================================================

export class PARLCoordinator {
  private locks: Map<string, LockRecord[]> = new Map();
  private writeQueue: Map<string, Array<{ agent_id: string; resolve: (acquired: boolean) => void }>> = new Map();
  private heartbeats: Map<string, HeartbeatRecord> = new Map();
  private stateLog: StateEvent[] = [];
  private stateListeners: Map<string, ((event: StateEvent) => void)[]> = new Map();
  private sequence = 0;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private deps: MultiAgentDeps;

  private static readonly MAX_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly HEARTBEAT_INTERVAL_MS = 30 * 1000;
  private static readonly HEARTBEAT_TIMEOUT_MS = 60 * 1000;

  constructor(deps: MultiAgentDeps) {
    this.deps = deps;
    // Heartbeat monitor is started lazily on first heartbeat() or acquireLock() call
  }

  private ensureHeartbeatMonitor(): void {
    if (!this.heartbeatInterval) {
      this.startHeartbeatMonitor();
    }
  }

  /**
   * Acquire a lock on a resource.
   * Read-read: allowed concurrently.
   * Read-write: readers proceed, writer waits.
   * Write-write: second writer queued.
   */
  async acquireLock(params: {
    resource_id: string;
    agent_id: string;
    lock_type: LockType;
    ttl_ms?: number;
  }): Promise<{ acquired: boolean; lock?: LockRecord; queue_position?: number }> {
    this.ensureHeartbeatMonitor();
    const ttl = Math.min(params.ttl_ms ?? PARLCoordinator.MAX_TTL_MS, PARLCoordinator.MAX_TTL_MS);
    const now = Date.now();

    // Clean expired locks first
    this.cleanExpiredLocks(params.resource_id);

    const existing = this.locks.get(params.resource_id) || [];

    // Check if this agent already holds a lock on this resource
    const agentLock = existing.find((l) => l.agent_id === params.agent_id);
    if (agentLock) {
      // Refresh TTL
      agentLock.ttl_ms = ttl;
      agentLock.expires_at = now + ttl;
      return { acquired: true, lock: agentLock };
    }

    const hasWriteLock = existing.some((l) => l.lock_type === "write");
    const hasReadLocks = existing.some((l) => l.lock_type === "read");

    if (params.lock_type === "read") {
      if (hasWriteLock) {
        // Read-write conflict: readers wait when writer holds lock
        // Actually per spec: "Read-write -> readers proceed, writer waits"
        // This means if there's a write lock, new readers DO wait
        // But the spec says the WRITER waits if readers exist
        // Let readers proceed even if writer exists? No - spec says:
        // "Read-write → readers proceed, writer waits" — this describes write acquisition, not read
        // A write lock holder blocks new reads. New read requests when writer present = queue
        // Actually re-reading: "readers proceed, writer waits" means existing readers keep going,
        // the new writer waits for readers to finish. So read can always acquire unless write lock exists.
        // If write lock already held, read must wait.

        // Read blocked by write lock — return failure immediately; caller retries
        const queue = this.writeQueue.get(params.resource_id) || [];
        const position = queue.length + 1;
        return { acquired: false, queue_position: position };
      }

      // No write lock: read can proceed
      const lock = this.createLockRecord(params.resource_id, params.agent_id, "read", ttl);
      return { acquired: true, lock };
    }

    // Write lock requested
    if (hasWriteLock || hasReadLocks) {
      // Write-write conflict or read-write conflict — return failure immediately; caller retries
      const queue = this.writeQueue.get(params.resource_id) || [];
      const position = queue.length + 1;
      return { acquired: false, queue_position: position };
    }

    // No existing locks: write can proceed
    const lock = this.createLockRecord(params.resource_id, params.agent_id, "write", ttl);
    return { acquired: true, lock };
  }

  /**
   * Release a lock held by an agent on a resource.
   */
  async releaseLock(params: {
    resource_id: string;
    agent_id: string;
  }): Promise<{ released: boolean; promoted_agents: string[] }> {
    const existing = this.locks.get(params.resource_id) || [];
    const lockIdx = existing.findIndex((l) => l.agent_id === params.agent_id);

    if (lockIdx === -1) {
      return { released: false, promoted_agents: [] };
    }

    existing.splice(lockIdx, 1);
    if (existing.length === 0) {
      this.locks.delete(params.resource_id);
    } else {
      this.locks.set(params.resource_id, existing);
    }

    // Process queue
    const promoted = this.processQueue(params.resource_id);

    await this.deps.logAudit("parl_lock_released", {
      resource_id: params.resource_id,
      agent_id: params.agent_id,
      promoted_agents: promoted,
    });

    return { released: true, promoted_agents: promoted };
  }

  /**
   * Broadcast a state event to all listeners.
   */
  broadcastState(params: {
    source_agent_id: string;
    event_type: string;
    payload: Record<string, unknown>;
  }): StateEvent {
    this.sequence++;
    const event: StateEvent = {
      source_agent_id: params.source_agent_id,
      event_type: params.event_type,
      payload: params.payload,
      timestamp: Date.now(),
      sequence: this.sequence,
    };

    this.stateLog.push(event);

    // Trim state log to last 1000 events
    if (this.stateLog.length > 1000) {
      this.stateLog = this.stateLog.slice(-1000);
    }

    // Notify listeners
    const listeners = this.stateListeners.get(params.event_type) || [];
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (_err) {
        // Listener errors don't propagate
      }
    }

    // Also notify wildcard listeners
    const wildcardListeners = this.stateListeners.get("*") || [];
    for (const listener of wildcardListeners) {
      try {
        listener(event);
      } catch (_err) {
        // Listener errors don't propagate
      }
    }

    return event;
  }

  /**
   * Register a listener for state events.
   */
  receiveState(agentId: string, eventType: string, callback: (event: StateEvent) => void): void {
    const listeners = this.stateListeners.get(eventType) || [];
    listeners.push(callback);
    this.stateListeners.set(eventType, listeners);
  }

  /**
   * Get recent state events, optionally filtered by type.
   */
  getStateLog(params?: { event_type?: string; since_sequence?: number; limit?: number }): StateEvent[] {
    let events = this.stateLog;

    if (params?.event_type) {
      events = events.filter((e) => e.event_type === params.event_type);
    }
    if (params?.since_sequence !== undefined) {
      events = events.filter((e) => e.sequence > params.since_sequence!);
    }

    const limit = params?.limit ?? 50;
    return events.slice(-limit);
  }

  /**
   * Record a heartbeat for an agent.
   */
  heartbeat(agentId: string): HeartbeatRecord {
    this.ensureHeartbeatMonitor();
    const record: HeartbeatRecord = {
      agent_id: agentId,
      last_heartbeat: Date.now(),
      status: "alive",
    };
    this.heartbeats.set(agentId, record);
    return record;
  }

  /**
   * Check health of all agents. Returns agents grouped by status.
   */
  checkHealth(): {
    alive: HeartbeatRecord[];
    suspected: HeartbeatRecord[];
    dead: HeartbeatRecord[];
  } {
    const now = Date.now();
    const alive: HeartbeatRecord[] = [];
    const suspected: HeartbeatRecord[] = [];
    const dead: HeartbeatRecord[] = [];

    for (const [agentId, record] of this.heartbeats) {
      const elapsed = now - record.last_heartbeat;

      if (elapsed <= PARLCoordinator.HEARTBEAT_INTERVAL_MS) {
        record.status = "alive";
        alive.push(record);
      } else if (elapsed <= PARLCoordinator.HEARTBEAT_TIMEOUT_MS) {
        record.status = "suspected";
        suspected.push(record);
      } else {
        record.status = "dead";
        dead.push(record);

        // Release all locks held by dead agents
        this.releaseAllLocksForAgent(agentId);
      }
    }

    return { alive, suspected, dead };
  }

  /**
   * Get all active (non-expired) locks.
   */
  getActiveLocks(): LockRecord[] {
    const now = Date.now();
    const active: LockRecord[] = [];
    for (const [resourceId, locks] of this.locks) {
      this.cleanExpiredLocks(resourceId);
      const remaining = this.locks.get(resourceId) || [];
      active.push(...remaining);
    }
    return active;
  }

  /**
   * Shutdown the heartbeat monitor.
   */
  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // --- Private helpers ---

  private createLockRecord(
    resourceId: string,
    agentId: string,
    lockType: LockType,
    ttl: number
  ): LockRecord {
    const now = Date.now();
    const lock: LockRecord = {
      resource_id: resourceId,
      agent_id: agentId,
      lock_type: lockType,
      acquired_at: now,
      ttl_ms: ttl,
      expires_at: now + ttl,
    };

    const existing = this.locks.get(resourceId) || [];
    existing.push(lock);
    this.locks.set(resourceId, existing);
    return lock;
  }

  private cleanExpiredLocks(resourceId: string): void {
    const now = Date.now();
    const existing = this.locks.get(resourceId) || [];
    const valid = existing.filter((l) => l.expires_at > now);

    if (valid.length === 0) {
      this.locks.delete(resourceId);
    } else {
      this.locks.set(resourceId, valid);
    }

    // If locks were cleaned, try to promote queued requests
    if (valid.length < existing.length) {
      this.processQueue(resourceId);
    }
  }

  private processQueue(resourceId: string): string[] {
    const queue = this.writeQueue.get(resourceId) || [];
    if (queue.length === 0) return [];

    const currentLocks = this.locks.get(resourceId) || [];
    const promoted: string[] = [];

    // Try to promote the next queued request
    while (queue.length > 0) {
      const hasWriteLock = currentLocks.some((l) => l.lock_type === "write");
      const hasAnyLock = currentLocks.length > 0;

      const next = queue[0];

      // If no locks exist, promote the next request
      if (!hasAnyLock) {
        queue.shift();
        next.resolve(true);
        promoted.push(next.agent_id);
        break; // After granting one write, stop
      } else {
        break; // Can't promote while locks exist
      }
    }

    if (queue.length === 0) {
      this.writeQueue.delete(resourceId);
    } else {
      this.writeQueue.set(resourceId, queue);
    }

    return promoted;
  }

  private releaseAllLocksForAgent(agentId: string): void {
    for (const [resourceId, locks] of this.locks) {
      const remaining = locks.filter((l) => l.agent_id !== agentId);
      if (remaining.length === 0) {
        this.locks.delete(resourceId);
      } else {
        this.locks.set(resourceId, remaining);
      }
      this.processQueue(resourceId);
    }
  }

  private startHeartbeatMonitor(): void {
    this.heartbeatInterval = setInterval(() => {
      this.checkHealth();
    }, PARLCoordinator.HEARTBEAT_INTERVAL_MS);

    // Prevent the interval from keeping the process alive
    if (this.heartbeatInterval && typeof this.heartbeatInterval === "object" && "unref" in this.heartbeatInterval) {
      (this.heartbeatInterval as NodeJS.Timeout).unref();
    }
  }
}

// ============================================================================
// REQ-EVO-023: Byzantine Fault Tolerance for Agent Consensus
// ============================================================================

export class BFTConsensus {
  private votes: Map<string, AgentVote[]> = new Map();
  private results: Map<string, ConsensusResult> = new Map();
  private agentWeights: Map<string, number> = new Map();
  private deps: MultiAgentDeps;

  private static readonly MIN_WEIGHT = 0.5;
  private static readonly MAX_WEIGHT = 2.0;
  private static readonly DEFAULT_WEIGHT = 1.0;
  private static readonly WEIGHT_ADJUSTMENT = 0.1;

  constructor(deps: MultiAgentDeps) {
    this.deps = deps;
  }

  /**
   * Submit a vote for a proposal from an agent.
   */
  async submitVote(params: {
    agent_id: string;
    proposal_id: string;
    verdict: "approve" | "reject" | "abstain";
    confidence: number;
    reasoning: string;
    evidence_hashes: string[];
    is_critical?: boolean;
  }): Promise<AgentVote> {
    const weight = this.agentWeights.get(params.agent_id) ?? BFTConsensus.DEFAULT_WEIGHT;
    const confidence = Math.max(0, Math.min(1, params.confidence));

    const vote: AgentVote = {
      agent_id: params.agent_id,
      proposal_id: params.proposal_id,
      verdict: params.verdict,
      confidence,
      reasoning: params.reasoning,
      evidence_hashes: params.evidence_hashes,
      is_critical: params.is_critical ?? false,
      timestamp: new Date().toISOString(),
      weight,
    };

    const existingVotes = this.votes.get(params.proposal_id) || [];

    // Replace existing vote from same agent
    const existingIdx = existingVotes.findIndex((v) => v.agent_id === params.agent_id);
    if (existingIdx >= 0) {
      existingVotes[existingIdx] = vote;
    } else {
      existingVotes.push(vote);
    }

    this.votes.set(params.proposal_id, existingVotes);

    // Persist to Qdrant
    const embedding = await this.deps.generateEmbedding(
      `bft vote ${params.proposal_id} ${params.verdict} ${params.reasoning.slice(0, 100)}`
    );
    if (embedding) {
      const id = this.deps.generateUUID();
      await this.deps.storePoint(
        MULTI_AGENT_COLLECTIONS.BFT_CONSENSUS,
        id,
        embedding,
        {
          record_type: "vote",
          agent_id: params.agent_id,
          proposal_id: params.proposal_id,
          verdict: params.verdict,
          confidence,
          reasoning: params.reasoning,
          evidence_hashes: params.evidence_hashes,
          is_critical: vote.is_critical,
          weight,
          timestamp: vote.timestamp,
        }
      );
    }

    await this.deps.logAudit("bft_vote_submitted", {
      agent_id: params.agent_id,
      proposal_id: params.proposal_id,
      verdict: params.verdict,
      confidence,
      weight,
    });

    return vote;
  }

  /**
   * Tally votes and determine consensus for a proposal.
   * - Unanimous → accept
   * - Supermajority (>=2/3) → accept majority + record dissent
   * - No consensus → escalate
   * - CRITICAL findings: require unanimous to dismiss, single dissent → escalate
   */
  tally(proposalId: string): ConsensusResult {
    const votes = this.votes.get(proposalId) || [];

    if (votes.length === 0) {
      const result: ConsensusResult = {
        proposal_id: proposalId,
        outcome: "pending",
        total_votes: 0,
        approve_count: 0,
        reject_count: 0,
        abstain_count: 0,
        weighted_approve: 0,
        weighted_reject: 0,
        dissenting_agents: [],
        is_critical: false,
        decided_at: new Date().toISOString(),
      };
      this.results.set(proposalId, result);
      return result;
    }

    const isCritical = votes.some((v) => v.is_critical);
    const nonAbstainVotes = votes.filter((v) => v.verdict !== "abstain");

    let approveCount = 0;
    let rejectCount = 0;
    let abstainCount = 0;
    let weightedApprove = 0;
    let weightedReject = 0;

    for (const vote of votes) {
      switch (vote.verdict) {
        case "approve":
          approveCount++;
          weightedApprove += vote.weight * vote.confidence;
          break;
        case "reject":
          rejectCount++;
          weightedReject += vote.weight * vote.confidence;
          break;
        case "abstain":
          abstainCount++;
          break;
      }
    }

    let outcome: ConsensusOutcome;
    let dissenting: string[] = [];
    let escalationReason: string | undefined;

    const totalNonAbstain = approveCount + rejectCount;

    if (totalNonAbstain === 0) {
      outcome = "pending";
    } else if (isCritical) {
      // CRITICAL findings: unanimous required to dismiss, single dissent = escalate
      if (rejectCount === 0 && approveCount === totalNonAbstain) {
        outcome = "accepted";
      } else if (approveCount === 0 && rejectCount === totalNonAbstain) {
        outcome = "rejected";
      } else {
        // Any dissent on critical = escalate
        outcome = "escalated";
        dissenting = votes
          .filter((v) => v.verdict !== votes[0].verdict && v.verdict !== "abstain")
          .map((v) => v.agent_id);
        escalationReason = `Critical finding with dissent: ${approveCount} approve, ${rejectCount} reject. Unanimous required for critical decisions.`;
      }
    } else {
      // Non-critical: use supermajority (>=2/3) threshold
      const approveRatio = approveCount / totalNonAbstain;
      const rejectRatio = rejectCount / totalNonAbstain;

      if (approveCount === totalNonAbstain) {
        // Unanimous approve
        outcome = "accepted";
      } else if (rejectCount === totalNonAbstain) {
        // Unanimous reject
        outcome = "rejected";
      } else if (approveRatio >= 2 / 3) {
        // Supermajority approve
        outcome = "accepted_with_dissent";
        dissenting = votes.filter((v) => v.verdict === "reject").map((v) => v.agent_id);
      } else if (rejectRatio >= 2 / 3) {
        // Supermajority reject
        outcome = "rejected_with_dissent";
        dissenting = votes.filter((v) => v.verdict === "approve").map((v) => v.agent_id);
      } else {
        // No consensus
        outcome = "escalated";
        dissenting = votes.filter((v) => v.verdict !== "abstain").map((v) => v.agent_id);
        escalationReason = `No supermajority: ${approveCount}/${totalNonAbstain} approve (need >= ${Math.ceil(totalNonAbstain * 2 / 3)})`;
      }
    }

    const result: ConsensusResult = {
      proposal_id: proposalId,
      outcome,
      total_votes: votes.length,
      approve_count: approveCount,
      reject_count: rejectCount,
      abstain_count: abstainCount,
      weighted_approve: Math.round(weightedApprove * 1000) / 1000,
      weighted_reject: Math.round(weightedReject * 1000) / 1000,
      dissenting_agents: dissenting,
      is_critical: isCritical,
      escalation_reason: escalationReason,
      decided_at: new Date().toISOString(),
    };

    this.results.set(proposalId, result);
    return result;
  }

  /**
   * Get the consensus result for a proposal (tally if not yet computed).
   */
  getConsensusResult(proposalId: string): ConsensusResult {
    const existing = this.results.get(proposalId);
    if (existing) return existing;
    return this.tally(proposalId);
  }

  /**
   * Adjust agent weights based on track record.
   * Agents whose votes align with final consensus get weight bumped up;
   * those that dissented get weight reduced.
   */
  async adjustWeights(proposalId: string): Promise<Record<string, { old_weight: number; new_weight: number }>> {
    const result = this.getConsensusResult(proposalId);
    const votes = this.votes.get(proposalId) || [];
    const adjustments: Record<string, { old_weight: number; new_weight: number }> = {};

    if (result.outcome === "pending" || result.outcome === "escalated") {
      return adjustments; // No adjustments for unresolved proposals
    }

    const majorityVerdict = result.approve_count >= result.reject_count ? "approve" : "reject";

    for (const vote of votes) {
      if (vote.verdict === "abstain") continue;

      const oldWeight = this.agentWeights.get(vote.agent_id) ?? BFTConsensus.DEFAULT_WEIGHT;
      let newWeight = oldWeight;

      if (vote.verdict === majorityVerdict) {
        // Aligned with consensus: bump up
        newWeight = Math.min(BFTConsensus.MAX_WEIGHT, oldWeight + BFTConsensus.WEIGHT_ADJUSTMENT);
      } else {
        // Dissented: reduce
        newWeight = Math.max(BFTConsensus.MIN_WEIGHT, oldWeight - BFTConsensus.WEIGHT_ADJUSTMENT);
      }

      newWeight = Math.round(newWeight * 100) / 100;
      this.agentWeights.set(vote.agent_id, newWeight);

      adjustments[vote.agent_id] = {
        old_weight: Math.round(oldWeight * 100) / 100,
        new_weight: newWeight,
      };
    }

    await this.deps.logAudit("bft_weights_adjusted", {
      proposal_id: proposalId,
      outcome: result.outcome,
      adjustments,
    });

    return adjustments;
  }

  /**
   * Get voting history across all proposals.
   */
  getVotingHistory(limit?: number): VotingHistoryEntry[] {
    const entries: VotingHistoryEntry[] = [];

    for (const [proposalId, result] of this.results) {
      entries.push({
        proposal_id: proposalId,
        outcome: result.outcome,
        vote_count: result.total_votes,
        decided_at: result.decided_at,
      });
    }

    // Sort by decided_at descending
    entries.sort((a, b) => b.decided_at.localeCompare(a.decided_at));

    return entries.slice(0, limit ?? 50);
  }

  /**
   * Get votes for a specific proposal.
   */
  getVotes(proposalId: string): AgentVote[] {
    return this.votes.get(proposalId) || [];
  }

  /**
   * Get current weight for an agent.
   */
  getWeight(agentId: string): number {
    return this.agentWeights.get(agentId) ?? BFTConsensus.DEFAULT_WEIGHT;
  }

  /**
   * Set weight for an agent (manual override).
   */
  setWeight(agentId: string, weight: number): number {
    const clamped = Math.max(
      BFTConsensus.MIN_WEIGHT,
      Math.min(BFTConsensus.MAX_WEIGHT, weight)
    );
    const rounded = Math.round(clamped * 100) / 100;
    this.agentWeights.set(agentId, rounded);
    return rounded;
  }
}
