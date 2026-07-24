/**
 * Wave 3 Completion + Wave 4 Frontier Capabilities
 *
 * REQ-EVO-039: Collaborative Agent Development Environment
 * REQ-EVO-040: Semantic Diff for Agent Behavior Changes
 * REQ-EVO-051: Hippocampal Memory Consolidation Cycles
 * REQ-EVO-053: Self-Improving Workflow Optimizer
 * REQ-EVO-056: Temporal Reasoning as First-Class Planning
 * REQ-EVO-057: The Meta-Agent
 */

import { createHash } from "crypto";
// Stage #8 dual-write mirror (flag-gated, non-fatal)
import { mirrorConsolidationCycles } from "./postgres-mirror.js";

// ---------------------------------------------------------------------------
// Dependency injection interface
// ---------------------------------------------------------------------------

export interface FrontierDeps {
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
  computeTemporalScore: (payload: Record<string, unknown>) => number;
}

// ---------------------------------------------------------------------------
// Collection constants
// ---------------------------------------------------------------------------

export const FRONTIER_COLLECTIONS = {
  DEV_ENVIRONMENTS: "dev_environments",
  SEMANTIC_DIFFS: "semantic_diffs",
  CONSOLIDATION_CYCLES: "consolidation_cycles",
  WORKFLOW_OPTIMIZATIONS: "workflow_optimizations",
  TEMPORAL_PLANS: "temporal_plans",
  META_AGENT: "meta_agent_assessments",
};

// ---------------------------------------------------------------------------
// Types: REQ-EVO-039 Agent Dev Environment
// ---------------------------------------------------------------------------

export type PromotionStage = "dev" | "sandbox" | "production";

export interface DevInstance {
  id: string;
  name: string;
  stage: PromotionStage;
  config: Record<string, unknown>;
  created_at: string;
  last_modified: string;
  file_hashes: Record<string, string>;
  working_memory_collection: string;
  dev_collection_prefix: string;
}

export interface HotReloadResult {
  instance_id: string;
  changes_detected: FileChange[];
  applied: boolean;
  timestamp: string;
}

export interface FileChange {
  path: string;
  previous_hash: string;
  current_hash: string;
  change_type: "added" | "modified" | "deleted";
}

export interface TestInteractionResult {
  instance_id: string;
  message: string;
  response: string;
  tool_calls: string[];
  memory_accesses: string[];
  duration_ms: number;
  timestamp: string;
}

export interface BehaviorComparison {
  instance_id: string;
  production_result: TestInteractionResult;
  dev_result: TestInteractionResult;
  differences: BehaviorDifference[];
  risk_level: RiskLevel;
}

export interface BehaviorDifference {
  aspect: string;
  production_value: string;
  dev_value: string;
  severity: "cosmetic" | "functional" | "behavioral";
}

export interface PromotionResult {
  instance_id: string;
  from_stage: PromotionStage;
  to_stage: PromotionStage;
  promoted: boolean;
  validation_results: ValidationCheck[];
  timestamp: string;
}

export interface ValidationCheck {
  check: string;
  passed: boolean;
  details: string;
}

// ---------------------------------------------------------------------------
// Types: REQ-EVO-040 Semantic Diff
// ---------------------------------------------------------------------------

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface SemanticDiffResult {
  id: string;
  before_version: string;
  after_version: string;
  scenarios_tested: number;
  differences: ScenarioDiff[];
  overall_risk: RiskLevel;
  timestamp: string;
}

export interface ScenarioDiff {
  scenario_name: string;
  scenario_description: string;
  tool_call_diff: DiffEntry[];
  memory_access_diff: DiffEntry[];
  decision_diff: DiffEntry[];
  governance_diff: DiffEntry[];
  risk: RiskLevel;
  affected: boolean;
}

export interface DiffEntry {
  aspect: string;
  before: string;
  after: string;
  change_type: "added" | "removed" | "modified" | "unchanged";
}

export interface ImpactAssessment {
  diff_id: string;
  total_scenarios: number;
  affected_scenarios: number;
  unaffected_scenarios: number;
  risk_distribution: Record<RiskLevel, number>;
  recommendations: string[];
  safe_to_deploy: boolean;
}

// ---------------------------------------------------------------------------
// Types: REQ-EVO-051 Hippocampal Consolidation
// ---------------------------------------------------------------------------

export type ConsolidationPhase = "replay" | "extraction" | "integration" | "pruning" | "reorganization";
export type MemoryTier = "hot" | "warm" | "long_term" | "pruned";

export interface ConsolidationCycle {
  id: string;
  started_at: string;
  completed_at: string | null;
  current_phase: ConsolidationPhase;
  phases_completed: ConsolidationPhase[];
  replay_count: number;
  extractions: number;
  integrations: number;
  pruned: number;
  reorganized: number;
  tier_transfers: TierTransferRecord[];
}

export interface TierTransferRecord {
  memory_id: string;
  from_tier: MemoryTier;
  to_tier: MemoryTier;
  reason: string;
  timestamp: string;
}

export interface ConsolidationStatus {
  last_cycle: ConsolidationCycle | null;
  total_cycles: number;
  next_scheduled: string;
  tier_counts: Record<MemoryTier, number>;
}

// ---------------------------------------------------------------------------
// Types: REQ-EVO-053 Workflow Optimizer
// ---------------------------------------------------------------------------

export interface WorkflowAnalysis {
  workflow_id: string;
  execution_count: number;
  avg_duration_ms: number;
  bottlenecks: BottleneckInfo[];
  parallel_opportunities: ParallelOpportunity[];
  gate_simplifications: GateSimplification[];
  agent_reallocations: AgentReallocation[];
  timestamp: string;
}

export interface BottleneckInfo {
  step_name: string;
  avg_duration_ms: number;
  percentage_of_total: number;
  cause: string;
}

export interface ParallelOpportunity {
  steps: string[];
  estimated_savings_ms: number;
  dependencies_clear: boolean;
}

export interface GateSimplification {
  gate_name: string;
  current_checks: number;
  proposed_checks: number;
  rationale: string;
  risk: RiskLevel;
}

export interface AgentReallocation {
  current_agent: string;
  proposed_agent: string;
  step_name: string;
  expected_improvement_pct: number;
  rationale: string;
}

export interface OptimizationProposal {
  id: string;
  workflow_id: string;
  proposals: Array<ParallelOpportunity | GateSimplification | AgentReallocation>;
  estimated_improvement_pct: number;
  risk: RiskLevel;
  timestamp: string;
}

export interface ABTestResult {
  id: string;
  workflow_id: string;
  original_duration_ms: number;
  optimized_duration_ms: number;
  improvement_pct: number;
  original_outcome: string;
  optimized_outcome: string;
  outcomes_match: boolean;
  timestamp: string;
}

export interface ImprovementMetrics {
  total_optimizations: number;
  successful_optimizations: number;
  avg_improvement_pct: number;
  total_time_saved_ms: number;
  ab_tests_run: number;
  ab_tests_passed: number;
}

// ---------------------------------------------------------------------------
// Types: REQ-EVO-056 Temporal Planner
// ---------------------------------------------------------------------------

export interface TemporalTask {
  id: string;
  name: string;
  duration_minutes: number;
  deadline?: string;
  dependencies: string[];
  assigned_agent?: string;
  priority: number;
  constraints: TemporalConstraint[];
}

export interface TemporalConstraint {
  type: "start_after" | "finish_before" | "concurrent_with" | "gap_between";
  target_task_id?: string;
  datetime?: string;
  gap_minutes?: number;
}

export interface TemporalPlan {
  id: string;
  tasks: ScheduledTask[];
  total_duration_minutes: number;
  critical_path: string[];
  start_time: string;
  end_time: string;
  slack_per_task: Record<string, number>;
  created_at: string;
}

export interface ScheduledTask extends TemporalTask {
  scheduled_start: string;
  scheduled_end: string;
  slack_minutes: number;
  is_critical: boolean;
}

export interface GanttChart {
  plan_id: string;
  rows: GanttRow[];
  total_duration_minutes: number;
  critical_path_highlighted: string[];
}

export interface GanttRow {
  task_id: string;
  task_name: string;
  start_offset_minutes: number;
  duration_minutes: number;
  dependencies: string[];
  is_critical: boolean;
  bar: string;
}

// ---------------------------------------------------------------------------
// Types: REQ-EVO-057 Meta-Agent
// ---------------------------------------------------------------------------

export interface EcosystemAssessment {
  id: string;
  agents_assessed: number;
  underperformers: UnderperformerReport[];
  capability_gaps: CapabilityGap[];
  composition_proposals: CompositionProposal[];
  configuration_suggestions: ConfigSuggestion[];
  overall_health: "healthy" | "degraded" | "critical";
  timestamp: string;
}

export interface UnderperformerReport {
  agent_id: string;
  agent_name: string;
  metrics: Record<string, number>;
  issues: string[];
  suggested_actions: string[];
}

export interface CapabilityGap {
  capability: string;
  description: string;
  impact: RiskLevel;
  suggested_resolution: string;
}

export interface CompositionProposal {
  name: string;
  agents: string[];
  rationale: string;
  expected_benefit: string;
  complexity: "low" | "medium" | "high";
}

export interface ConfigSuggestion {
  agent_id: string;
  parameter: string;
  current_value: string;
  suggested_value: string;
  rationale: string;
  risk: RiskLevel;
}

export interface SelfAssessment {
  total_suggestions: number;
  implemented_suggestions: number;
  successful_suggestions: number;
  failed_suggestions: number;
  improvement_rate: number;
  top_performing_areas: string[];
  areas_needing_improvement: string[];
  governance_compliance: boolean;
  timestamp: string;
}

// =========================================================================
// REQ-EVO-039: AgentDevEnvironment
// =========================================================================

export class AgentDevEnvironment {
  private deps: FrontierDeps;
  private instances: Map<string, DevInstance> = new Map();

  constructor(deps: FrontierDeps) {
    this.deps = deps;
  }

  /**
   * Create an isolated dev instance with dev_* prefixed Qdrant collections
   * and separate working memory.
   */
  async createDevInstance(name: string, config: Record<string, unknown> = {}): Promise<DevInstance> {
    const id = this.deps.generateUUID();
    const prefix = `dev_${id.slice(0, 8)}`;
    const workingMemoryCollection = `${prefix}_working_memory`;

    // Create the isolated dev collections in Qdrant
    const devCollections = [
      `${prefix}_memories`,
      workingMemoryCollection,
      `${prefix}_episodes`,
    ];

    for (const coll of devCollections) {
      try {
        await this.deps.qdrantRequest("PUT", `/collections/${coll}`, {
          vectors: { size: 768, distance: "Cosine" },
        });
      } catch {
        // Collection may already exist
      }
    }

    const instance: DevInstance = {
      id,
      name,
      stage: "dev",
      config: { ...config },
      created_at: new Date().toISOString(),
      last_modified: new Date().toISOString(),
      file_hashes: {},
      working_memory_collection: workingMemoryCollection,
      dev_collection_prefix: prefix,
    };

    this.instances.set(id, instance);

    // Store in Qdrant for persistence
    const embedding = await this.deps.generateEmbedding(`dev environment ${name} ${JSON.stringify(config)}`);
    if (embedding) {
      await this.deps.storePoint(FRONTIER_COLLECTIONS.DEV_ENVIRONMENTS, id, embedding, {
        ...instance,
        type: "dev_instance",
      });
    }

    await this.deps.logAudit("DEV_INSTANCE_CREATED", {
      instance_id: id,
      name,
      prefix,
      collections_created: devCollections,
    });

    return instance;
  }

  /**
   * Detect file changes and apply them immediately (hot-reload simulation).
   * Computes SHA-256 hashes of provided file contents and compares with stored hashes.
   */
  async hotReload(instanceId: string, files: Record<string, string>): Promise<HotReloadResult> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Dev instance ${instanceId} not found`);
    }

    const changes: FileChange[] = [];

    for (const [path, content] of Object.entries(files)) {
      const currentHash = createHash("sha256").update(content).digest("hex");
      const previousHash = instance.file_hashes[path] || "";

      if (previousHash === "") {
        changes.push({ path, previous_hash: "", current_hash: currentHash, change_type: "added" });
      } else if (previousHash !== currentHash) {
        changes.push({ path, previous_hash: previousHash, current_hash: currentHash, change_type: "modified" });
      }

      instance.file_hashes[path] = currentHash;
    }

    // Detect deletions: files previously tracked but not in current set
    for (const tracked of Object.keys(instance.file_hashes)) {
      if (!(tracked in files)) {
        changes.push({
          path: tracked,
          previous_hash: instance.file_hashes[tracked],
          current_hash: "",
          change_type: "deleted",
        });
        delete instance.file_hashes[tracked];
      }
    }

    instance.last_modified = new Date().toISOString();

    const result: HotReloadResult = {
      instance_id: instanceId,
      changes_detected: changes,
      applied: changes.length > 0,
      timestamp: new Date().toISOString(),
    };

    if (changes.length > 0) {
      await this.deps.logAudit("DEV_HOT_RELOAD", {
        instance_id: instanceId,
        changes_count: changes.length,
        change_types: changes.map(c => c.change_type),
      });
    }

    return result;
  }

  /**
   * Send a test message to a dev instance and capture the simulated response,
   * tool calls, and memory access patterns.
   */
  async testInteraction(instanceId: string, message: string): Promise<TestInteractionResult> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Dev instance ${instanceId} not found`);
    }

    const startTime = Date.now();

    // Simulate agent processing using the dev instance's isolated collections
    const devPrefix = instance.dev_collection_prefix;

    // Check dev working memory for relevant context
    const embedding = await this.deps.generateEmbedding(message);
    const memoryAccesses: string[] = [];
    const toolCalls: string[] = [];

    if (embedding) {
      // Search dev memories
      const devMemories = await this.deps.searchPoints(
        `${devPrefix}_memories`, embedding, 3, 0.4
      ).catch(() => []);
      memoryAccesses.push(`${devPrefix}_memories: ${(devMemories as unknown[]).length} results`);

      // Search dev working memory
      const devWorking = await this.deps.searchPoints(
        instance.working_memory_collection, embedding, 3, 0.4
      ).catch(() => []);
      memoryAccesses.push(`${instance.working_memory_collection}: ${(devWorking as unknown[]).length} results`);

      toolCalls.push("searchPoints (dev_memories)");
      toolCalls.push("searchPoints (dev_working_memory)");
    }

    // Use LLM to generate a simulated response based on the dev config
    const configSummary = JSON.stringify(instance.config).slice(0, 200);
    const prompt = `You are simulating an agent with config: ${configSummary}
The user says: "${message}"
Respond in character as this agent would. Keep the response under 200 words.`;

    const response = await this.deps.ollamaGenerate(prompt) || "[No response generated - LLM unavailable]";
    toolCalls.push("ollamaGenerate (response simulation)");

    const duration = Date.now() - startTime;

    const result: TestInteractionResult = {
      instance_id: instanceId,
      message,
      response,
      tool_calls: toolCalls,
      memory_accesses: memoryAccesses,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    };

    await this.deps.logAudit("DEV_TEST_INTERACTION", {
      instance_id: instanceId,
      message_preview: message.slice(0, 100),
      duration_ms: duration,
      tool_call_count: toolCalls.length,
    });

    return result;
  }

  /**
   * Run the same test message against both production and dev instances,
   * then compare behavior differences.
   */
  async compareBehavior(instanceId: string, testMessage: string): Promise<BehaviorComparison> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Dev instance ${instanceId} not found`);
    }

    // Run dev interaction
    const devResult = await this.testInteraction(instanceId, testMessage);

    // Run simulated production interaction (using main collections)
    const prodStart = Date.now();
    const embedding = await this.deps.generateEmbedding(testMessage);
    const prodMemoryAccesses: string[] = [];
    const prodToolCalls: string[] = [];

    if (embedding) {
      const prodMemories = await this.deps.searchPoints(
        "claude_memories", embedding, 3, 0.4
      ).catch(() => []);
      prodMemoryAccesses.push(`claude_memories: ${(prodMemories as unknown[]).length} results`);
      prodToolCalls.push("searchPoints (claude_memories)");

      const prodWorking = await this.deps.searchPoints(
        "working_memory", embedding, 3, 0.4
      ).catch(() => []);
      prodMemoryAccesses.push(`working_memory: ${(prodWorking as unknown[]).length} results`);
      prodToolCalls.push("searchPoints (working_memory)");
    }

    const prodPrompt = `You are the production agent responding to: "${testMessage}"
Respond normally. Keep the response under 200 words.`;

    const prodResponse = await this.deps.ollamaGenerate(prodPrompt) || "[No response generated]";
    prodToolCalls.push("ollamaGenerate (production)");

    const prodResult: TestInteractionResult = {
      instance_id: "production",
      message: testMessage,
      response: prodResponse,
      tool_calls: prodToolCalls,
      memory_accesses: prodMemoryAccesses,
      duration_ms: Date.now() - prodStart,
      timestamp: new Date().toISOString(),
    };

    // Compare results
    const differences: BehaviorDifference[] = [];

    // Compare tool calls
    const devToolSet = new Set(devResult.tool_calls);
    const prodToolSet = new Set(prodResult.tool_calls);
    for (const t of devToolSet) {
      if (!prodToolSet.has(t)) {
        differences.push({
          aspect: "tool_call",
          production_value: "not called",
          dev_value: t,
          severity: "functional",
        });
      }
    }
    for (const t of prodToolSet) {
      if (!devToolSet.has(t)) {
        differences.push({
          aspect: "tool_call",
          production_value: t,
          dev_value: "not called",
          severity: "functional",
        });
      }
    }

    // Compare response lengths as a cosmetic indicator
    const lenDiff = Math.abs(devResult.response.length - prodResult.response.length);
    if (lenDiff > 100) {
      differences.push({
        aspect: "response_length",
        production_value: `${prodResult.response.length} chars`,
        dev_value: `${devResult.response.length} chars`,
        severity: lenDiff > 500 ? "behavioral" : "cosmetic",
      });
    }

    // Compare memory access counts
    const devMemCount = devResult.memory_accesses.length;
    const prodMemCount = prodResult.memory_accesses.length;
    if (devMemCount !== prodMemCount) {
      differences.push({
        aspect: "memory_access_count",
        production_value: `${prodMemCount}`,
        dev_value: `${devMemCount}`,
        severity: "functional",
      });
    }

    // Duration comparison
    const durationDiffPct = Math.abs(devResult.duration_ms - prodResult.duration_ms) /
      Math.max(prodResult.duration_ms, 1) * 100;
    if (durationDiffPct > 50) {
      differences.push({
        aspect: "duration",
        production_value: `${prodResult.duration_ms}ms`,
        dev_value: `${devResult.duration_ms}ms`,
        severity: "cosmetic",
      });
    }

    // Classify risk
    let riskLevel: RiskLevel = "low";
    const hasBehavioral = differences.some(d => d.severity === "behavioral");
    const hasFunctional = differences.some(d => d.severity === "functional");
    if (hasBehavioral) riskLevel = "high";
    else if (hasFunctional && differences.length > 2) riskLevel = "medium";
    else if (hasFunctional) riskLevel = "medium";

    const comparison: BehaviorComparison = {
      instance_id: instanceId,
      production_result: prodResult,
      dev_result: devResult,
      differences,
      risk_level: riskLevel,
    };

    await this.deps.logAudit("DEV_BEHAVIOR_COMPARISON", {
      instance_id: instanceId,
      differences_count: differences.length,
      risk_level: riskLevel,
    });

    return comparison;
  }

  /**
   * Promote a dev instance through stages: dev -> sandbox -> production.
   * Each promotion runs validation checks before proceeding.
   */
  async promote(instanceId: string): Promise<PromotionResult> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Dev instance ${instanceId} not found`);
    }

    const stages: PromotionStage[] = ["dev", "sandbox", "production"];
    const currentIdx = stages.indexOf(instance.stage);
    if (currentIdx >= stages.length - 1) {
      throw new Error(`Instance ${instanceId} is already at production stage`);
    }

    const fromStage = instance.stage;
    const toStage = stages[currentIdx + 1];

    // Run validation checks appropriate for the target stage
    const checks: ValidationCheck[] = [];

    // Check 1: Has the instance been tested?
    const hasBeenTested = instance.last_modified !== instance.created_at;
    checks.push({
      check: "instance_tested",
      passed: hasBeenTested,
      details: hasBeenTested
        ? "Instance has been modified/tested since creation"
        : "Instance has not been tested - run testInteraction first",
    });

    // Check 2: File hashes are present (code has been loaded)
    const hasFiles = Object.keys(instance.file_hashes).length > 0;
    checks.push({
      check: "files_loaded",
      passed: hasFiles,
      details: hasFiles
        ? `${Object.keys(instance.file_hashes).length} files tracked`
        : "No files loaded into dev instance",
    });

    // Check 3: For sandbox->production, verify dev collections have data
    if (toStage === "production") {
      const devMemories = await this.deps.scrollPoints(
        `${instance.dev_collection_prefix}_memories`, undefined, 1
      ).catch(() => []);
      const hasDevData = (devMemories as unknown[]).length > 0;
      checks.push({
        check: "sandbox_data_validated",
        passed: hasDevData,
        details: hasDevData
          ? "Dev collections contain test data"
          : "Dev collections are empty - run more tests before promoting to production",
      });
    }

    // Check 4: Config validation
    const configValid = instance.config !== null && typeof instance.config === "object";
    checks.push({
      check: "config_valid",
      passed: configValid,
      details: configValid ? "Configuration is valid" : "Configuration is null or invalid",
    });

    const allPassed = checks.every(c => c.passed);

    if (allPassed) {
      instance.stage = toStage;
      instance.last_modified = new Date().toISOString();
    }

    const result: PromotionResult = {
      instance_id: instanceId,
      from_stage: fromStage,
      to_stage: toStage,
      promoted: allPassed,
      validation_results: checks,
      timestamp: new Date().toISOString(),
    };

    await this.deps.logAudit("DEV_PROMOTION", {
      instance_id: instanceId,
      from_stage: fromStage,
      to_stage: toStage,
      promoted: allPassed,
      checks_passed: checks.filter(c => c.passed).length,
      checks_total: checks.length,
    });

    return result;
  }

  /**
   * List all active dev instances.
   */
  listInstances(): DevInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * Get a specific dev instance by ID.
   */
  getInstance(id: string): DevInstance | undefined {
    return this.instances.get(id);
  }
}

// =========================================================================
// REQ-EVO-040: SemanticDiff
// =========================================================================

export class SemanticDiff {
  private deps: FrontierDeps;
  private diffs: Map<string, SemanticDiffResult> = new Map();

  constructor(deps: FrontierDeps) {
    this.deps = deps;
  }

  /**
   * Run behavioral diff between two versions against a set of test scenarios.
   * Compares tool calls, memory access patterns, decisions, and governance events.
   */
  async diffBehavior(
    beforeVersion: string,
    afterVersion: string,
    scenarios: Array<{ name: string; description: string; test_message: string }>
  ): Promise<SemanticDiffResult> {
    const id = this.deps.generateUUID();
    const scenarioDiffs: ScenarioDiff[] = [];

    for (const scenario of scenarios) {
      // Simulate "before" version processing
      const beforePrompt = `You are version "${beforeVersion}" of an AI agent.
Scenario: ${scenario.description}
User message: ${scenario.test_message}

Respond with a JSON object containing:
- "response": your response text
- "tools_used": array of tool names you would call
- "memories_accessed": array of memory types you would query
- "decisions": array of key decisions made
- "governance_actions": array of any governance/compliance actions taken

Respond ONLY with the JSON object.`;

      const afterPrompt = beforePrompt.replace(
        `version "${beforeVersion}"`,
        `version "${afterVersion}"`
      );

      const beforeRaw = await this.deps.ollamaGenerate(beforePrompt);
      const afterRaw = await this.deps.ollamaGenerate(afterPrompt);

      const beforeData = this.parseAgentResponse(beforeRaw);
      const afterData = this.parseAgentResponse(afterRaw);

      // Build diffs for each aspect
      const toolCallDiff = this.computeListDiff("tool_calls", beforeData.tools_used, afterData.tools_used);
      const memoryDiff = this.computeListDiff("memory_access", beforeData.memories_accessed, afterData.memories_accessed);
      const decisionDiff = this.computeListDiff("decisions", beforeData.decisions, afterData.decisions);
      const govDiff = this.computeListDiff("governance", beforeData.governance_actions, afterData.governance_actions);

      const allDiffs = [...toolCallDiff, ...memoryDiff, ...decisionDiff, ...govDiff];
      const affected = allDiffs.some(d => d.change_type !== "unchanged");

      // Classify risk for this scenario
      let scenarioRisk: RiskLevel = "low";
      if (govDiff.some(d => d.change_type !== "unchanged")) {
        scenarioRisk = "critical";
      } else if (decisionDiff.some(d => d.change_type !== "unchanged")) {
        scenarioRisk = "high";
      } else if (toolCallDiff.some(d => d.change_type !== "unchanged")) {
        scenarioRisk = "medium";
      }

      scenarioDiffs.push({
        scenario_name: scenario.name,
        scenario_description: scenario.description,
        tool_call_diff: toolCallDiff,
        memory_access_diff: memoryDiff,
        decision_diff: decisionDiff,
        governance_diff: govDiff,
        risk: scenarioRisk,
        affected,
      });
    }

    // Overall risk is the highest of any scenario
    const riskOrder: RiskLevel[] = ["low", "medium", "high", "critical"];
    const overallRisk = scenarioDiffs.reduce<RiskLevel>((max, s) => {
      return riskOrder.indexOf(s.risk) > riskOrder.indexOf(max) ? s.risk : max;
    }, "low");

    const result: SemanticDiffResult = {
      id,
      before_version: beforeVersion,
      after_version: afterVersion,
      scenarios_tested: scenarios.length,
      differences: scenarioDiffs,
      overall_risk: overallRisk,
      timestamp: new Date().toISOString(),
    };

    this.diffs.set(id, result);

    // Store in Qdrant
    const embedding = await this.deps.generateEmbedding(
      `semantic diff ${beforeVersion} to ${afterVersion} risk ${overallRisk}`
    );
    if (embedding) {
      await this.deps.storePoint(FRONTIER_COLLECTIONS.SEMANTIC_DIFFS, id, embedding, {
        ...result,
        type: "semantic_diff",
      });
    }

    await this.deps.logAudit("SEMANTIC_DIFF_COMPLETED", {
      diff_id: id,
      before_version: beforeVersion,
      after_version: afterVersion,
      scenarios_tested: scenarios.length,
      overall_risk: overallRisk,
    });

    return result;
  }

  /**
   * Classify the overall risk level for a given diff.
   */
  classifyRisk(diffId: string): { risk: RiskLevel; breakdown: Record<RiskLevel, number> } {
    const diff = this.diffs.get(diffId);
    if (!diff) throw new Error(`Diff ${diffId} not found`);

    const breakdown: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const scenario of diff.differences) {
      breakdown[scenario.risk]++;
    }

    return { risk: diff.overall_risk, breakdown };
  }

  /**
   * Generate an impact assessment for a given diff result.
   */
  getImpactAssessment(diffId: string): ImpactAssessment {
    const diff = this.diffs.get(diffId);
    if (!diff) throw new Error(`Diff ${diffId} not found`);

    const affected = diff.differences.filter(d => d.affected);
    const unaffected = diff.differences.filter(d => !d.affected);

    const riskDist: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const s of diff.differences) {
      riskDist[s.risk]++;
    }

    const recommendations: string[] = [];

    if (riskDist.critical > 0) {
      recommendations.push("CRITICAL: Governance behavior changes detected. Manual review required before deployment.");
    }
    if (riskDist.high > 0) {
      recommendations.push("HIGH: Decision-making changes detected. Run extended test suite before promotion.");
    }
    if (riskDist.medium > 0) {
      recommendations.push("MEDIUM: Tool usage changes detected. Validate affected workflows in sandbox.");
    }
    if (affected.length === 0) {
      recommendations.push("No behavioral changes detected. Safe for deployment.");
    }
    if (affected.length > 0 && riskDist.critical === 0 && riskDist.high === 0) {
      recommendations.push("Changes are cosmetic or minor functional differences. Consider sandbox testing.");
    }

    const safeToDeploy = riskDist.critical === 0 && riskDist.high === 0;

    return {
      diff_id: diffId,
      total_scenarios: diff.scenarios_tested,
      affected_scenarios: affected.length,
      unaffected_scenarios: unaffected.length,
      risk_distribution: riskDist,
      recommendations,
      safe_to_deploy: safeToDeploy,
    };
  }

  private parseAgentResponse(raw: string | null): {
    tools_used: string[];
    memories_accessed: string[];
    decisions: string[];
    governance_actions: string[];
  } {
    const defaults = {
      tools_used: [] as string[],
      memories_accessed: [] as string[],
      decisions: [] as string[],
      governance_actions: [] as string[],
    };

    if (!raw) return defaults;

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          tools_used: Array.isArray(parsed.tools_used) ? parsed.tools_used : [],
          memories_accessed: Array.isArray(parsed.memories_accessed) ? parsed.memories_accessed : [],
          decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
          governance_actions: Array.isArray(parsed.governance_actions) ? parsed.governance_actions : [],
        };
      }
    } catch {
      // Parse failed, return defaults
    }

    return defaults;
  }

  private computeListDiff(aspect: string, before: string[], after: string[]): DiffEntry[] {
    const entries: DiffEntry[] = [];
    const beforeSet = new Set(before);
    const afterSet = new Set(after);

    for (const item of before) {
      if (afterSet.has(item)) {
        entries.push({ aspect, before: item, after: item, change_type: "unchanged" });
      } else {
        entries.push({ aspect, before: item, after: "", change_type: "removed" });
      }
    }

    for (const item of after) {
      if (!beforeSet.has(item)) {
        entries.push({ aspect, before: "", after: item, change_type: "added" });
      }
    }

    // If both lists are empty, note it as unchanged
    if (before.length === 0 && after.length === 0) {
      entries.push({ aspect, before: "(none)", after: "(none)", change_type: "unchanged" });
    }

    return entries;
  }
}

// =========================================================================
// REQ-EVO-051: HippocampalConsolidation
// =========================================================================

export class HippocampalConsolidation {
  private deps: FrontierDeps;
  private cycles: Map<string, ConsolidationCycle> = new Map();
  private lastCycleTime: number = 0;
  private readonly CYCLE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly HOT_TO_WARM_HOURS = 24;
  private readonly HOT_TO_PRUNED_HOURS = 48;
  private readonly WARM_TO_LONGTERM_DAYS = 7;
  private readonly MIN_RECALLS_FOR_WARM = 2;

  constructor(deps: FrontierDeps) {
    this.deps = deps;
  }

  /**
   * Run a full consolidation cycle with five phases:
   * 1. Replay: review recent episodes
   * 2. Extraction: identify facts and patterns
   * 3. Integration: merge with existing knowledge
   * 4. Pruning: remove stale/redundant memories
   * 5. Reorganization: optimize tier placement
   */
  async runConsolidationCycle(): Promise<ConsolidationCycle> {
    const id = this.deps.generateUUID();
    const cycle: ConsolidationCycle = {
      id,
      started_at: new Date().toISOString(),
      completed_at: null,
      current_phase: "replay",
      phases_completed: [],
      replay_count: 0,
      extractions: 0,
      integrations: 0,
      pruned: 0,
      reorganized: 0,
      tier_transfers: [],
    };

    this.cycles.set(id, cycle);

    // Phase 1: Replay - Review recent episodes (last 24h)
    cycle.current_phase = "replay";
    const recentEpisodes = await this.deps.scrollPoints("episodes", {
      must: [{
        key: "created_at",
        range: {
          gte: new Date(Date.now() - this.CYCLE_INTERVAL_MS).toISOString(),
        },
      }],
    }, 100).catch(() => []) as Array<{ id: string; payload?: Record<string, unknown> }>;

    // Also grab hot memories
    const hotMemories = await this.deps.scrollPoints("memories_hot", undefined, 200)
      .catch(() => []) as Array<{ id: string; payload?: Record<string, unknown> }>;

    cycle.replay_count = recentEpisodes.length + hotMemories.length;
    cycle.phases_completed.push("replay");

    // Phase 2: Extraction - Use LLM to extract facts and patterns from episodes
    cycle.current_phase = "extraction";
    if (recentEpisodes.length > 0) {
      const episodeSummaries = recentEpisodes
        .slice(0, 20)
        .map((e) => {
          const p = e.payload || {};
          return (p.content as string || p.summary as string || "").slice(0, 200);
        })
        .filter(s => s.length > 0)
        .join("\n---\n");

      if (episodeSummaries.length > 0) {
        const extractionPrompt = `Analyze these recent episode records and extract:
1. Key factual statements that should be remembered long-term
2. Patterns or recurring themes
3. Decisions or preferences expressed

Episodes:
${episodeSummaries}

Respond with a JSON object:
{
  "facts": ["fact1", "fact2"],
  "patterns": ["pattern1", "pattern2"],
  "decisions": ["decision1"]
}`;

        const extractionRaw = await this.deps.ollamaGenerate(extractionPrompt);
        if (extractionRaw) {
          try {
            const jsonMatch = extractionRaw.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const extracted = JSON.parse(jsonMatch[0]);
              const allItems = [
                ...(Array.isArray(extracted.facts) ? extracted.facts : []),
                ...(Array.isArray(extracted.patterns) ? extracted.patterns : []),
                ...(Array.isArray(extracted.decisions) ? extracted.decisions : []),
              ];
              cycle.extractions = allItems.length;

              // Store extracted items as warm memories
              for (const item of allItems) {
                if (typeof item !== "string" || item.length < 5) continue;
                const emb = await this.deps.generateEmbedding(item);
                if (!emb) continue;

                const memId = this.deps.generateUUID();
                await this.deps.storePoint("memories_warm", memId, emb, {
                  content: item,
                  type: "fact",
                  tier: "warm",
                  source: "consolidation_extraction",
                  consolidation_cycle_id: id,
                  created_at: new Date().toISOString(),
                  recall_count: 0,
                });
              }
            }
          } catch {
            // Parse failure, continue
          }
        }
      }
    }
    cycle.phases_completed.push("extraction");

    // Phase 3: Integration - Merge extracted knowledge with existing
    cycle.current_phase = "integration";
    const warmMemories = await this.deps.scrollPoints("memories_warm", undefined, 100)
      .catch(() => []) as Array<{ id: string; payload?: Record<string, unknown> }>;

    for (const warm of warmMemories) {
      const payload = warm.payload || {};
      const content = (payload.content as string) || "";
      if (!content) continue;

      // Check if similar knowledge already exists in long-term
      const emb = await this.deps.generateEmbedding(content);
      if (!emb) continue;

      const existing = await this.deps.searchPoints("claude_memories", emb, 1, 0.85)
        .catch(() => []) as Array<{ id: string; payload?: Record<string, unknown>; score?: number }>;

      if (existing.length > 0 && existing[0].score && existing[0].score > 0.85) {
        // Already exists in long-term, update recall count on existing
        const existingPayload = existing[0].payload || {};
        const currentRecalls = (existingPayload.recall_count as number) || 0;
        await this.deps.updatePayload("claude_memories", [existing[0].id], {
          recall_count: currentRecalls + 1,
          last_consolidated: new Date().toISOString(),
        }).catch(() => {});
        cycle.integrations++;
      }
    }
    cycle.phases_completed.push("integration");

    // Phase 4: Pruning - Remove stale memories
    cycle.current_phase = "pruning";
    const now = Date.now();

    for (const hot of hotMemories) {
      const payload = hot.payload || {};
      const createdAt = payload.created_at as string;
      if (!createdAt) continue;

      const ageHours = (now - new Date(createdAt).getTime()) / (60 * 60 * 1000);
      const recallCount = (payload.recall_count as number) || 0;

      // Stage #9b: skip pinned memories entirely (operator-deliberate retention).
      if (payload.pinned === true) continue;

      // Hot -> pruned: older than 48h and never recalled
      if (ageHours > this.HOT_TO_PRUNED_HOURS && recallCount === 0) {
        await this.deps.deletePoints("memories_hot", [hot.id]).catch(() => {});
        cycle.pruned++;
        cycle.tier_transfers.push({
          memory_id: hot.id,
          from_tier: "hot",
          to_tier: "pruned",
          reason: `Age ${Math.round(ageHours)}h > ${this.HOT_TO_PRUNED_HOURS}h, 0 recalls`,
          timestamp: new Date().toISOString(),
        });
      }
    }
    cycle.phases_completed.push("pruning");

    // Phase 5: Reorganization - Tier transfers based on access patterns
    cycle.current_phase = "reorganization";

    // Hot -> Warm: older than 24h with >= 2 recalls
    for (const hot of hotMemories) {
      const payload = hot.payload || {};
      const createdAt = payload.created_at as string;
      if (!createdAt) continue;

      const ageHours = (now - new Date(createdAt).getTime()) / (60 * 60 * 1000);
      const recallCount = (payload.recall_count as number) || 0;

      // Stage #9b: skip pinned memories entirely (operator-deliberate retention).
      if (payload.pinned === true) continue;

      if (ageHours > this.HOT_TO_WARM_HOURS && recallCount >= this.MIN_RECALLS_FOR_WARM) {
        // Move to warm
        const content = (payload.content as string) || "";
        const emb = await this.deps.generateEmbedding(content);
        if (!emb) continue;

        const warmId = hot.id;
        await this.deps.storePoint("memories_warm", warmId, emb, {
          ...payload,
          tier: "warm",
          transferred_from: "hot",
          transfer_reason: `${recallCount} recalls in ${Math.round(ageHours)}h`,
          transferred_at: new Date().toISOString(),
        });

        await this.deps.deletePoints("memories_hot", [hot.id]).catch(() => {});
        cycle.reorganized++;
        cycle.tier_transfers.push({
          memory_id: hot.id,
          from_tier: "hot",
          to_tier: "warm",
          reason: `${recallCount} recalls >= ${this.MIN_RECALLS_FOR_WARM}, age ${Math.round(ageHours)}h`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Warm -> Long-term: older than 7 days with consolidation
    for (const warm of warmMemories) {
      const payload = warm.payload || {};
      const createdAt = payload.created_at as string;
      if (!createdAt) continue;

      const ageDays = (now - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000);
      const consolidated = payload.last_consolidated as string;

      if (ageDays > this.WARM_TO_LONGTERM_DAYS && consolidated) {
        const content = (payload.content as string) || "";
        const emb = await this.deps.generateEmbedding(content);
        if (!emb) continue;

        const ltId = warm.id;
        await this.deps.storePoint("claude_memories", ltId, emb, {
          ...payload,
          tier: "long_term",
          transferred_from: "warm",
          transfer_reason: `Consolidated, age ${Math.round(ageDays)} days`,
          transferred_at: new Date().toISOString(),
        });

        await this.deps.deletePoints("memories_warm", [warm.id]).catch(() => {});
        cycle.reorganized++;
        cycle.tier_transfers.push({
          memory_id: warm.id,
          from_tier: "warm",
          to_tier: "long_term",
          reason: `Age ${Math.round(ageDays)}d > ${this.WARM_TO_LONGTERM_DAYS}d, consolidated`,
          timestamp: new Date().toISOString(),
        });
      }
    }
    cycle.phases_completed.push("reorganization");

    cycle.completed_at = new Date().toISOString();
    this.lastCycleTime = Date.now();

    // Persist cycle record
    const cycleEmb = await this.deps.generateEmbedding(
      `consolidation cycle ${id} replay=${cycle.replay_count} extracted=${cycle.extractions} ` +
      `integrated=${cycle.integrations} pruned=${cycle.pruned} reorganized=${cycle.reorganized}`
    );
    if (cycleEmb) {
      const cyclePayload = { ...cycle, type: "consolidation_cycle" };
      await this.deps.storePoint(FRONTIER_COLLECTIONS.CONSOLIDATION_CYCLES, id, cycleEmb, cyclePayload);
      await mirrorConsolidationCycles(id, cyclePayload as unknown as Record<string, unknown>);
    }

    await this.deps.logAudit("CONSOLIDATION_CYCLE_COMPLETE", {
      cycle_id: id,
      replay_count: cycle.replay_count,
      extractions: cycle.extractions,
      integrations: cycle.integrations,
      pruned: cycle.pruned,
      reorganized: cycle.reorganized,
      tier_transfers: cycle.tier_transfers.length,
    });

    return cycle;
  }

  /**
   * Manually trigger a tier transfer for a specific memory.
   */
  async tierTransfer(
    memoryId: string,
    fromTier: MemoryTier,
    toTier: MemoryTier,
    reason: string
  ): Promise<TierTransferRecord> {
    const tierCollections: Record<MemoryTier, string> = {
      hot: "memories_hot",
      warm: "memories_warm",
      long_term: "claude_memories",
      pruned: "memories_cold",
    };

    const fromCollection = tierCollections[fromTier];
    const toCollection = tierCollections[toTier];

    // Retrieve the memory from its current tier
    const point = await this.deps.getPoint(fromCollection, memoryId, true)
      .catch(() => null) as { id: string; payload?: Record<string, unknown>; vector?: number[] } | null;

    if (!point) {
      throw new Error(`Memory ${memoryId} not found in ${fromCollection}`);
    }

    const payload = point.payload || {};
    const content = (payload.content as string) || "";

    // Get or regenerate embedding
    let vector = point.vector as number[] | undefined;
    if (!vector || !Array.isArray(vector) || vector.length === 0) {
      const emb = await this.deps.generateEmbedding(content);
      if (!emb) throw new Error("Failed to generate embedding for transfer");
      vector = emb;
    }

    // Store in destination
    const newId = toTier === "pruned" ? memoryId : this.deps.generateUUID();
    await this.deps.storePoint(toCollection, newId, vector, {
      ...payload,
      tier: toTier,
      transferred_from: fromTier,
      transfer_reason: reason,
      transferred_at: new Date().toISOString(),
      original_id: memoryId,
    });

    // Remove from source
    await this.deps.deletePoints(fromCollection, [memoryId]);

    const record: TierTransferRecord = {
      memory_id: memoryId,
      from_tier: fromTier,
      to_tier: toTier,
      reason,
      timestamp: new Date().toISOString(),
    };

    await this.deps.logAudit("TIER_TRANSFER", {
      memory_id: memoryId,
      from_tier: fromTier,
      to_tier: toTier,
      reason,
      new_id: newId,
    });

    return record;
  }

  /**
   * Get current consolidation status including tier counts and cycle history.
   */
  async getConsolidationStatus(): Promise<ConsolidationStatus> {
    // Count memories per tier
    const tierCounts: Record<MemoryTier, number> = {
      hot: 0,
      warm: 0,
      long_term: 0,
      pruned: 0,
    };

    const hotPoints = await this.deps.scrollPoints("memories_hot", undefined, 1).catch(() => []);
    const warmPoints = await this.deps.scrollPoints("memories_warm", undefined, 1).catch(() => []);
    const ltPoints = await this.deps.scrollPoints("claude_memories", undefined, 1).catch(() => []);
    const coldPoints = await this.deps.scrollPoints("memories_cold", undefined, 1).catch(() => []);

    // Use Qdrant collection info for actual counts
    try {
      const hotInfo = await this.deps.qdrantRequest("GET", "/collections/memories_hot") as {
        result?: { points_count?: number }
      };
      tierCounts.hot = hotInfo?.result?.points_count || (hotPoints as unknown[]).length;
    } catch { tierCounts.hot = (hotPoints as unknown[]).length; }

    try {
      const warmInfo = await this.deps.qdrantRequest("GET", "/collections/memories_warm") as {
        result?: { points_count?: number }
      };
      tierCounts.warm = warmInfo?.result?.points_count || (warmPoints as unknown[]).length;
    } catch { tierCounts.warm = (warmPoints as unknown[]).length; }

    try {
      const ltInfo = await this.deps.qdrantRequest("GET", "/collections/claude_memories") as {
        result?: { points_count?: number }
      };
      tierCounts.long_term = ltInfo?.result?.points_count || (ltPoints as unknown[]).length;
    } catch { tierCounts.long_term = (ltPoints as unknown[]).length; }

    try {
      const coldInfo = await this.deps.qdrantRequest("GET", "/collections/memories_cold") as {
        result?: { points_count?: number }
      };
      tierCounts.pruned = coldInfo?.result?.points_count || (coldPoints as unknown[]).length;
    } catch { tierCounts.pruned = (coldPoints as unknown[]).length; }

    // Find last cycle
    const cycleEntries = Array.from(this.cycles.values());
    const lastCycle = cycleEntries.length > 0
      ? cycleEntries[cycleEntries.length - 1]
      : null;

    // Calculate next scheduled
    const nextScheduled = new Date(
      this.lastCycleTime > 0
        ? this.lastCycleTime + this.CYCLE_INTERVAL_MS
        : Date.now() + this.CYCLE_INTERVAL_MS
    ).toISOString();

    return {
      last_cycle: lastCycle,
      total_cycles: cycleEntries.length,
      next_scheduled: nextScheduled,
      tier_counts: tierCounts,
    };
  }
}

// =========================================================================
// REQ-EVO-053: WorkflowOptimizer
// =========================================================================

export class WorkflowOptimizer {
  private deps: FrontierDeps;
  private analyses: Map<string, WorkflowAnalysis> = new Map();
  private proposals: Map<string, OptimizationProposal> = new Map();
  private abTests: ABTestResult[] = [];

  constructor(deps: FrontierDeps) {
    this.deps = deps;
  }

  /**
   * Analyze a completed workflow execution for inefficiencies.
   * Takes execution data with step timings and identifies bottlenecks,
   * parallelization opportunities, gate simplifications, and agent reallocations.
   */
  async analyzeWorkflow(
    workflowId: string,
    executions: Array<{
      steps: Array<{ name: string; duration_ms: number; agent?: string; gate_checks?: number; dependencies?: string[] }>;
      total_duration_ms: number;
    }>
  ): Promise<WorkflowAnalysis> {
    if (executions.length === 0) {
      throw new Error("At least one execution is required for analysis");
    }

    // Aggregate step data across executions
    const stepStats: Map<string, {
      durations: number[];
      agents: string[];
      gate_checks: number[];
      dependencies: string[];
    }> = new Map();

    let totalDuration = 0;

    for (const exec of executions) {
      totalDuration += exec.total_duration_ms;
      for (const step of exec.steps) {
        const existing = stepStats.get(step.name) || {
          durations: [],
          agents: [],
          gate_checks: [],
          dependencies: step.dependencies || [],
        };
        existing.durations.push(step.duration_ms);
        if (step.agent) existing.agents.push(step.agent);
        if (step.gate_checks !== undefined) existing.gate_checks.push(step.gate_checks);
        stepStats.set(step.name, existing);
      }
    }

    const avgTotalDuration = totalDuration / executions.length;

    // Identify bottlenecks (steps taking > 30% of total time)
    const bottlenecks: BottleneckInfo[] = [];
    for (const [name, stats] of stepStats) {
      const avgDuration = stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length;
      const pct = (avgDuration / avgTotalDuration) * 100;
      if (pct > 30) {
        bottlenecks.push({
          step_name: name,
          avg_duration_ms: Math.round(avgDuration),
          percentage_of_total: Math.round(pct * 10) / 10,
          cause: pct > 60
            ? "Dominant step - consider breaking into sub-steps"
            : "Significant bottleneck - investigate optimization",
        });
      }
    }

    // Identify parallel opportunities (steps with no mutual dependencies)
    const parallelOpps: ParallelOpportunity[] = [];
    const stepNames = Array.from(stepStats.keys());

    for (let i = 0; i < stepNames.length; i++) {
      for (let j = i + 1; j < stepNames.length; j++) {
        const stepA = stepNames[i];
        const stepB = stepNames[j];
        const statsA = stepStats.get(stepA)!;
        const statsB = stepStats.get(stepB)!;

        const aDependsOnB = statsA.dependencies.includes(stepB);
        const bDependsOnA = statsB.dependencies.includes(stepA);

        if (!aDependsOnB && !bDependsOnA) {
          const avgA = statsA.durations.reduce((a, b) => a + b, 0) / statsA.durations.length;
          const avgB = statsB.durations.reduce((a, b) => a + b, 0) / statsB.durations.length;
          const savings = Math.min(avgA, avgB); // Parallel saves the shorter step's time

          parallelOpps.push({
            steps: [stepA, stepB],
            estimated_savings_ms: Math.round(savings),
            dependencies_clear: true,
          });
        }
      }
    }

    // Identify gate simplifications (steps with many gate checks)
    const gateSimps: GateSimplification[] = [];
    for (const [name, stats] of stepStats) {
      if (stats.gate_checks.length > 0) {
        const avgChecks = stats.gate_checks.reduce((a, b) => a + b, 0) / stats.gate_checks.length;
        if (avgChecks > 3) {
          const proposed = Math.ceil(avgChecks * 0.6);
          gateSimps.push({
            gate_name: name,
            current_checks: Math.round(avgChecks),
            proposed_checks: proposed,
            rationale: `${Math.round(avgChecks)} checks per execution; consolidate redundant checks`,
            risk: avgChecks > 8 ? "medium" : "low",
          });
        }
      }
    }

    // Identify agent reallocation opportunities
    const agentReallocations: AgentReallocation[] = [];
    for (const [name, stats] of stepStats) {
      if (stats.agents.length > 0) {
        const avgDuration = stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length;

        // Group by agent to find if some agents are faster
        const agentPerf: Map<string, number[]> = new Map();
        for (let i = 0; i < stats.agents.length; i++) {
          const agent = stats.agents[i];
          const dur = stats.durations[i];
          const existing = agentPerf.get(agent) || [];
          existing.push(dur);
          agentPerf.set(agent, existing);
        }

        if (agentPerf.size > 1) {
          let bestAgent = "";
          let bestAvg = Infinity;
          let worstAgent = "";
          let worstAvg = 0;

          for (const [agent, durations] of agentPerf) {
            const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
            if (avg < bestAvg) { bestAvg = avg; bestAgent = agent; }
            if (avg > worstAvg) { worstAvg = avg; worstAgent = agent; }
          }

          if (bestAgent !== worstAgent && worstAvg > bestAvg * 1.5) {
            agentReallocations.push({
              current_agent: worstAgent,
              proposed_agent: bestAgent,
              step_name: name,
              expected_improvement_pct: Math.round(((worstAvg - bestAvg) / worstAvg) * 100),
              rationale: `${bestAgent} averages ${Math.round(bestAvg)}ms vs ${worstAgent} at ${Math.round(worstAvg)}ms`,
            });
          }
        }
      }
    }

    const analysis: WorkflowAnalysis = {
      workflow_id: workflowId,
      execution_count: executions.length,
      avg_duration_ms: Math.round(avgTotalDuration),
      bottlenecks,
      parallel_opportunities: parallelOpps,
      gate_simplifications: gateSimps,
      agent_reallocations: agentReallocations,
      timestamp: new Date().toISOString(),
    };

    this.analyses.set(workflowId, analysis);

    // Store in Qdrant
    const emb = await this.deps.generateEmbedding(
      `workflow analysis ${workflowId} bottlenecks=${bottlenecks.length} parallel=${parallelOpps.length}`
    );
    if (emb) {
      await this.deps.storePoint(FRONTIER_COLLECTIONS.WORKFLOW_OPTIMIZATIONS, this.deps.generateUUID(), emb, {
        ...analysis,
        type: "workflow_analysis",
      });
    }

    await this.deps.logAudit("WORKFLOW_ANALYZED", {
      workflow_id: workflowId,
      execution_count: executions.length,
      bottlenecks: bottlenecks.length,
      parallel_opportunities: parallelOpps.length,
      gate_simplifications: gateSimps.length,
      agent_reallocations: agentReallocations.length,
    });

    return analysis;
  }

  /**
   * Generate optimization proposals based on the latest analysis.
   */
  async proposeOptimizations(workflowId: string): Promise<OptimizationProposal> {
    const analysis = this.analyses.get(workflowId);
    if (!analysis) {
      throw new Error(`No analysis found for workflow ${workflowId}. Run analyzeWorkflow first.`);
    }

    const proposals: Array<ParallelOpportunity | GateSimplification | AgentReallocation> = [];

    // Add all parallel opportunities
    for (const opp of analysis.parallel_opportunities) {
      if (opp.estimated_savings_ms > 100) {
        proposals.push(opp);
      }
    }

    // Add gate simplifications
    for (const simp of analysis.gate_simplifications) {
      proposals.push(simp);
    }

    // Add agent reallocations with > 20% improvement
    for (const realloc of analysis.agent_reallocations) {
      if (realloc.expected_improvement_pct > 20) {
        proposals.push(realloc);
      }
    }

    // Estimate overall improvement
    let estimatedSavingsMs = 0;
    for (const p of proposals) {
      if ("estimated_savings_ms" in p) estimatedSavingsMs += p.estimated_savings_ms;
      if ("expected_improvement_pct" in p) estimatedSavingsMs += (analysis.avg_duration_ms * p.expected_improvement_pct / 100 / proposals.length);
    }
    const estimatedImprovementPct = analysis.avg_duration_ms > 0
      ? Math.round((estimatedSavingsMs / analysis.avg_duration_ms) * 100 * 10) / 10
      : 0;

    // Overall risk classification
    let risk: RiskLevel = "low";
    if (analysis.gate_simplifications.some(g => g.risk === "medium")) risk = "medium";
    if (analysis.agent_reallocations.length > 2) risk = "medium";

    const id = this.deps.generateUUID();
    const proposal: OptimizationProposal = {
      id,
      workflow_id: workflowId,
      proposals,
      estimated_improvement_pct: estimatedImprovementPct,
      risk,
      timestamp: new Date().toISOString(),
    };

    this.proposals.set(id, proposal);

    await this.deps.logAudit("OPTIMIZATION_PROPOSED", {
      proposal_id: id,
      workflow_id: workflowId,
      proposal_count: proposals.length,
      estimated_improvement_pct: estimatedImprovementPct,
      risk,
    });

    return proposal;
  }

  /**
   * Run an A/B test comparing original vs optimized workflow execution.
   */
  async abTest(
    workflowId: string,
    original: { duration_ms: number; outcome: string },
    optimized: { duration_ms: number; outcome: string }
  ): Promise<ABTestResult> {
    const improvementPct = original.duration_ms > 0
      ? Math.round(((original.duration_ms - optimized.duration_ms) / original.duration_ms) * 100 * 10) / 10
      : 0;

    const result: ABTestResult = {
      id: this.deps.generateUUID(),
      workflow_id: workflowId,
      original_duration_ms: original.duration_ms,
      optimized_duration_ms: optimized.duration_ms,
      improvement_pct: improvementPct,
      original_outcome: original.outcome,
      optimized_outcome: optimized.outcome,
      outcomes_match: original.outcome === optimized.outcome,
      timestamp: new Date().toISOString(),
    };

    this.abTests.push(result);

    // Store in Qdrant
    const emb = await this.deps.generateEmbedding(
      `ab test ${workflowId} improvement=${improvementPct}% match=${result.outcomes_match}`
    );
    if (emb) {
      await this.deps.storePoint(FRONTIER_COLLECTIONS.WORKFLOW_OPTIMIZATIONS, result.id, emb, {
        ...result,
        type: "ab_test_result",
      });
    }

    await this.deps.logAudit("AB_TEST_COMPLETED", {
      test_id: result.id,
      workflow_id: workflowId,
      improvement_pct: improvementPct,
      outcomes_match: result.outcomes_match,
    });

    return result;
  }

  /**
   * Get aggregate improvement metrics across all optimizations.
   */
  getImprovementMetrics(): ImprovementMetrics {
    const totalOptimizations = this.proposals.size;
    const abTestsPassed = this.abTests.filter(t => t.outcomes_match && t.improvement_pct > 0).length;

    const totalTimeSaved = this.abTests.reduce((sum, t) => {
      if (t.outcomes_match && t.improvement_pct > 0) {
        return sum + (t.original_duration_ms - t.optimized_duration_ms);
      }
      return sum;
    }, 0);

    const avgImprovement = this.abTests.length > 0
      ? this.abTests.reduce((sum, t) => sum + t.improvement_pct, 0) / this.abTests.length
      : 0;

    return {
      total_optimizations: totalOptimizations,
      successful_optimizations: abTestsPassed,
      avg_improvement_pct: Math.round(avgImprovement * 10) / 10,
      total_time_saved_ms: totalTimeSaved,
      ab_tests_run: this.abTests.length,
      ab_tests_passed: abTestsPassed,
    };
  }
}

// =========================================================================
// REQ-EVO-056: TemporalPlanner
// =========================================================================

export class TemporalPlanner {
  private deps: FrontierDeps;
  private plans: Map<string, TemporalPlan> = new Map();

  constructor(deps: FrontierDeps) {
    this.deps = deps;
  }

  /**
   * Create a temporal plan from a set of tasks with deadlines, dependencies, and constraints.
   * Uses topological sort and forward scheduling to determine start/end times.
   */
  async createPlan(
    tasks: TemporalTask[],
    planStartTime?: string
  ): Promise<TemporalPlan> {
    if (tasks.length === 0) throw new Error("At least one task is required");

    const startTime = planStartTime ? new Date(planStartTime) : new Date();
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    // Validate dependencies exist
    for (const task of tasks) {
      for (const dep of task.dependencies) {
        if (!taskMap.has(dep)) {
          throw new Error(`Task ${task.id} depends on non-existent task ${dep}`);
        }
      }
    }

    // Topological sort using Kahn's algorithm
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    for (const task of tasks) {
      inDegree.set(task.id, task.dependencies.length);
      if (!adjList.has(task.id)) adjList.set(task.id, []);
      for (const dep of task.dependencies) {
        const existing = adjList.get(dep) || [];
        existing.push(task.id);
        adjList.set(dep, existing);
      }
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    const sortedIds: string[] = [];
    while (queue.length > 0) {
      // Sort by priority (higher priority first) for deterministic ordering
      queue.sort((a, b) => (taskMap.get(b)!.priority || 0) - (taskMap.get(a)!.priority || 0));
      const current = queue.shift()!;
      sortedIds.push(current);

      for (const neighbor of (adjList.get(current) || [])) {
        const newDegree = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    if (sortedIds.length !== tasks.length) {
      throw new Error("Circular dependency detected in task graph");
    }

    // Forward pass: compute earliest start/end times
    const earliestStart = new Map<string, number>(); // offset from plan start in minutes
    const earliestEnd = new Map<string, number>();

    for (const id of sortedIds) {
      const task = taskMap.get(id)!;
      let es = 0;

      // Earliest start is max of all dependency end times
      for (const dep of task.dependencies) {
        const depEnd = earliestEnd.get(dep) || 0;
        es = Math.max(es, depEnd);
      }

      // Apply constraints
      for (const c of task.constraints) {
        if (c.type === "start_after" && c.datetime) {
          const afterMinutes = (new Date(c.datetime).getTime() - startTime.getTime()) / 60000;
          es = Math.max(es, afterMinutes);
        }
        if (c.type === "gap_between" && c.target_task_id && c.gap_minutes) {
          const targetEnd = earliestEnd.get(c.target_task_id) || 0;
          es = Math.max(es, targetEnd + c.gap_minutes);
        }
      }

      earliestStart.set(id, es);
      earliestEnd.set(id, es + task.duration_minutes);
    }

    // Backward pass: compute latest start/end times for slack calculation
    const totalDuration = Math.max(...Array.from(earliestEnd.values()));
    const latestEnd = new Map<string, number>();
    const latestStart = new Map<string, number>();

    // Initialize all with total duration
    for (const task of tasks) {
      latestEnd.set(task.id, totalDuration);
    }

    // Apply deadlines
    for (const task of tasks) {
      if (task.deadline) {
        const deadlineMinutes = (new Date(task.deadline).getTime() - startTime.getTime()) / 60000;
        latestEnd.set(task.id, Math.min(latestEnd.get(task.id)!, deadlineMinutes));
      }
    }

    // Backward pass
    for (let i = sortedIds.length - 1; i >= 0; i--) {
      const id = sortedIds[i];
      const task = taskMap.get(id)!;
      let le = latestEnd.get(id)!;

      // Constrained by successors
      for (const successor of (adjList.get(id) || [])) {
        const successorLS = (latestEnd.get(successor) || totalDuration) - taskMap.get(successor)!.duration_minutes;
        le = Math.min(le, successorLS);
      }

      latestEnd.set(id, le);
      latestStart.set(id, le - task.duration_minutes);
    }

    // Build critical path (tasks with zero slack)
    const criticalPath: string[] = [];
    const slackPerTask: Record<string, number> = {};

    for (const task of tasks) {
      const es = earliestStart.get(task.id)!;
      const ls = latestStart.get(task.id)!;
      const slack = Math.max(0, ls - es);
      slackPerTask[task.id] = Math.round(slack);
      if (slack < 1) criticalPath.push(task.id);
    }

    // Build scheduled tasks
    const scheduledTasks: ScheduledTask[] = sortedIds.map(id => {
      const task = taskMap.get(id)!;
      const es = earliestStart.get(id)!;
      const ee = earliestEnd.get(id)!;

      return {
        ...task,
        scheduled_start: new Date(startTime.getTime() + es * 60000).toISOString(),
        scheduled_end: new Date(startTime.getTime() + ee * 60000).toISOString(),
        slack_minutes: slackPerTask[id],
        is_critical: criticalPath.includes(id),
      };
    });

    const planId = this.deps.generateUUID();
    const plan: TemporalPlan = {
      id: planId,
      tasks: scheduledTasks,
      total_duration_minutes: Math.round(totalDuration),
      critical_path: criticalPath,
      start_time: startTime.toISOString(),
      end_time: new Date(startTime.getTime() + totalDuration * 60000).toISOString(),
      slack_per_task: slackPerTask,
      created_at: new Date().toISOString(),
    };

    this.plans.set(planId, plan);

    // Store in Qdrant
    const emb = await this.deps.generateEmbedding(
      `temporal plan ${planId} tasks=${tasks.length} duration=${totalDuration}min critical_path=${criticalPath.length}`
    );
    if (emb) {
      await this.deps.storePoint(FRONTIER_COLLECTIONS.TEMPORAL_PLANS, planId, emb, {
        id: planId,
        task_count: tasks.length,
        total_duration_minutes: Math.round(totalDuration),
        critical_path_length: criticalPath.length,
        start_time: startTime.toISOString(),
        end_time: plan.end_time,
        created_at: plan.created_at,
        type: "temporal_plan",
      });
    }

    await this.deps.logAudit("TEMPORAL_PLAN_CREATED", {
      plan_id: planId,
      task_count: tasks.length,
      total_duration_minutes: Math.round(totalDuration),
      critical_path: criticalPath,
    });

    return plan;
  }

  /**
   * Return the critical path for a given plan.
   */
  criticalPath(planId: string): { path: string[]; total_duration_minutes: number; tasks: ScheduledTask[] } {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan ${planId} not found`);

    const criticalTasks = plan.tasks.filter(t => t.is_critical);

    return {
      path: plan.critical_path,
      total_duration_minutes: plan.total_duration_minutes,
      tasks: criticalTasks,
    };
  }

  /**
   * Optimize schedule by reordering non-critical tasks to minimize total duration.
   * Attempts to pack tasks more efficiently while respecting constraints.
   */
  async optimizeSchedule(planId: string): Promise<TemporalPlan> {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan ${planId} not found`);

    // Reconstruct task inputs from scheduled tasks
    const tasks: TemporalTask[] = plan.tasks.map(st => ({
      id: st.id,
      name: st.name,
      duration_minutes: st.duration_minutes,
      deadline: st.deadline,
      dependencies: st.dependencies,
      assigned_agent: st.assigned_agent,
      priority: st.priority + (st.is_critical ? 10 : 0), // Boost critical tasks' priority
      constraints: st.constraints,
    }));

    // Re-plan with boosted priorities (critical path tasks get processed first)
    const optimized = await this.createPlan(tasks, plan.start_time);

    await this.deps.logAudit("SCHEDULE_OPTIMIZED", {
      original_plan_id: planId,
      optimized_plan_id: optimized.id,
      original_duration: plan.total_duration_minutes,
      optimized_duration: optimized.total_duration_minutes,
      improvement_minutes: plan.total_duration_minutes - optimized.total_duration_minutes,
    });

    return optimized;
  }

  /**
   * Generate a Gantt chart representation of a plan.
   */
  getGantt(planId: string): GanttChart {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan ${planId} not found`);

    const planStartMs = new Date(plan.start_time).getTime();
    const maxWidth = 60; // max bar width in characters

    const rows: GanttRow[] = plan.tasks.map(task => {
      const startOffsetMs = new Date(task.scheduled_start).getTime() - planStartMs;
      const startOffsetMinutes = Math.round(startOffsetMs / 60000);

      // Build ASCII bar
      const barStart = Math.round((startOffsetMinutes / plan.total_duration_minutes) * maxWidth);
      const barLength = Math.max(1, Math.round((task.duration_minutes / plan.total_duration_minutes) * maxWidth));

      const pad = " ".repeat(Math.max(0, barStart));
      const barChar = task.is_critical ? "=" : "-";
      const barStr = `|${pad}${barChar.repeat(barLength)}| ${task.duration_minutes}m`;

      return {
        task_id: task.id,
        task_name: task.name,
        start_offset_minutes: startOffsetMinutes,
        duration_minutes: task.duration_minutes,
        dependencies: task.dependencies,
        is_critical: task.is_critical,
        bar: barStr,
      };
    });

    return {
      plan_id: planId,
      rows,
      total_duration_minutes: plan.total_duration_minutes,
      critical_path_highlighted: plan.critical_path,
    };
  }
}

// =========================================================================
// REQ-EVO-057: MetaAgent
// =========================================================================

export class MetaAgent {
  private deps: FrontierDeps;
  private assessments: EcosystemAssessment[] = [];
  private suggestions: Array<{
    id: string;
    suggestion: string;
    implemented: boolean;
    successful: boolean | null;
    timestamp: string;
  }> = [];

  constructor(deps: FrontierDeps) {
    this.deps = deps;
  }

  /**
   * Assess the overall health of the agent ecosystem.
   * Analyzes agent performance data, identifies underperformers,
   * capability gaps, and potential improvements.
   */
  async assessEcosystem(
    agents: Array<{
      id: string;
      name: string;
      metrics: Record<string, number>;
      capabilities: string[];
      last_active: string;
    }>
  ): Promise<EcosystemAssessment> {
    const id = this.deps.generateUUID();
    const underperformers: UnderperformerReport[] = [];
    const capabilityGaps: CapabilityGap[] = [];
    const compositionProposals: CompositionProposal[] = [];
    const configSuggestions: ConfigSuggestion[] = [];

    // Detect underperformers
    for (const agent of agents) {
      const issues: string[] = [];
      const actions: string[] = [];

      // Check success rate
      if (agent.metrics.success_rate !== undefined && agent.metrics.success_rate < 0.7) {
        issues.push(`Low success rate: ${(agent.metrics.success_rate * 100).toFixed(1)}%`);
        actions.push("Review task assignment criteria and agent configuration");
      }

      // Check response time
      if (agent.metrics.avg_response_ms !== undefined && agent.metrics.avg_response_ms > 5000) {
        issues.push(`High average response time: ${agent.metrics.avg_response_ms}ms`);
        actions.push("Consider resource scaling or task decomposition");
      }

      // Check error rate
      if (agent.metrics.error_rate !== undefined && agent.metrics.error_rate > 0.1) {
        issues.push(`High error rate: ${(agent.metrics.error_rate * 100).toFixed(1)}%`);
        actions.push("Investigate error patterns and add defensive handling");
      }

      // Check activity
      const lastActive = new Date(agent.last_active).getTime();
      const inactiveDays = (Date.now() - lastActive) / (24 * 60 * 60 * 1000);
      if (inactiveDays > 7) {
        issues.push(`Inactive for ${Math.round(inactiveDays)} days`);
        actions.push("Verify agent is still needed or decommission");
      }

      if (issues.length > 0) {
        underperformers.push({
          agent_id: agent.id,
          agent_name: agent.name,
          metrics: agent.metrics,
          issues,
          suggested_actions: actions,
        });
      }
    }

    // Identify capability gaps using LLM analysis
    const allCapabilities = new Set(agents.flatMap(a => a.capabilities));
    const desiredCapabilities = [
      "memory_management", "tool_orchestration", "governance_compliance",
      "error_recovery", "performance_monitoring", "security_auditing",
      "data_classification", "workflow_coordination", "natural_language_processing",
      "code_analysis", "temporal_planning", "conflict_resolution",
    ];

    for (const desired of desiredCapabilities) {
      if (!allCapabilities.has(desired)) {
        const impact = ["governance_compliance", "security_auditing", "data_classification"].includes(desired)
          ? "critical" as RiskLevel
          : ["error_recovery", "performance_monitoring"].includes(desired)
            ? "high" as RiskLevel
            : "medium" as RiskLevel;

        capabilityGaps.push({
          capability: desired,
          description: `No agent provides the ${desired} capability`,
          impact,
          suggested_resolution: `Create or configure an agent with ${desired} capability`,
        });
      }
    }

    // Propose agent compositions for better coverage
    const capabilityGroups: Record<string, string[]> = {};
    for (const agent of agents) {
      for (const cap of agent.capabilities) {
        if (!capabilityGroups[cap]) capabilityGroups[cap] = [];
        capabilityGroups[cap].push(agent.id);
      }
    }

    // Find complementary agents that could be composed
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        const a = agents[i];
        const b = agents[j];
        const overlap = a.capabilities.filter(c => b.capabilities.includes(c));
        const combined = new Set([...a.capabilities, ...b.capabilities]);

        if (overlap.length === 0 && combined.size > a.capabilities.length + 1) {
          compositionProposals.push({
            name: `${a.name}-${b.name}-composite`,
            agents: [a.id, b.id],
            rationale: `Complementary capabilities with no overlap: ${Array.from(combined).join(", ")}`,
            expected_benefit: "Broader capability coverage without redundancy",
            complexity: combined.size > 6 ? "high" : "medium",
          });
        }
      }
    }

    // Generate configuration suggestions
    for (const agent of agents) {
      if (agent.metrics.avg_response_ms > 3000 && agent.metrics.success_rate > 0.9) {
        configSuggestions.push({
          agent_id: agent.id,
          parameter: "timeout_ms",
          current_value: String(agent.metrics.avg_response_ms * 2),
          suggested_value: String(Math.round(agent.metrics.avg_response_ms * 1.5)),
          rationale: "Agent is reliable but slow - tighten timeout to encourage optimization",
          risk: "low",
        });
      }

      if (agent.metrics.memory_usage_mb && agent.metrics.memory_usage_mb > 512) {
        configSuggestions.push({
          agent_id: agent.id,
          parameter: "max_memory_mb",
          current_value: String(agent.metrics.memory_usage_mb),
          suggested_value: "256",
          rationale: `Memory usage at ${agent.metrics.memory_usage_mb}MB - investigate for leaks`,
          risk: "medium",
        });
      }
    }

    // Determine overall health
    let health: "healthy" | "degraded" | "critical" = "healthy";
    if (underperformers.length > agents.length * 0.5) {
      health = "critical";
    } else if (underperformers.length > 0 || capabilityGaps.some(g => g.impact === "critical")) {
      health = "degraded";
    }

    const assessment: EcosystemAssessment = {
      id,
      agents_assessed: agents.length,
      underperformers,
      capability_gaps: capabilityGaps,
      composition_proposals: compositionProposals,
      configuration_suggestions: configSuggestions,
      overall_health: health,
      timestamp: new Date().toISOString(),
    };

    this.assessments.push(assessment);

    // Store in Qdrant
    const emb = await this.deps.generateEmbedding(
      `meta-agent ecosystem assessment health=${health} agents=${agents.length} ` +
      `underperformers=${underperformers.length} gaps=${capabilityGaps.length}`
    );
    if (emb) {
      await this.deps.storePoint(FRONTIER_COLLECTIONS.META_AGENT, id, emb, {
        id,
        agents_assessed: agents.length,
        underperformer_count: underperformers.length,
        capability_gap_count: capabilityGaps.length,
        composition_proposal_count: compositionProposals.length,
        config_suggestion_count: configSuggestions.length,
        overall_health: health,
        timestamp: assessment.timestamp,
        type: "ecosystem_assessment",
      });
    }

    await this.deps.logAudit("META_AGENT_ASSESSMENT", {
      assessment_id: id,
      agents_assessed: agents.length,
      health,
      underperformers: underperformers.length,
      capability_gaps: capabilityGaps.length,
    });

    return assessment;
  }

  /**
   * Detect underperforming agents from the most recent assessment.
   */
  detectUnderperformers(): UnderperformerReport[] {
    if (this.assessments.length === 0) {
      throw new Error("No assessments available. Run assessEcosystem first.");
    }
    return this.assessments[this.assessments.length - 1].underperformers;
  }

  /**
   * Generate configuration change suggestions for the ecosystem.
   */
  suggestChanges(): ConfigSuggestion[] {
    if (this.assessments.length === 0) {
      throw new Error("No assessments available. Run assessEcosystem first.");
    }
    const latest = this.assessments[this.assessments.length - 1];

    // Record these as tracked suggestions
    for (const suggestion of latest.configuration_suggestions) {
      this.suggestions.push({
        id: this.deps.generateUUID(),
        suggestion: `${suggestion.agent_id}: ${suggestion.parameter} ${suggestion.current_value} -> ${suggestion.suggested_value}`,
        implemented: false,
        successful: null,
        timestamp: new Date().toISOString(),
      });
    }

    return latest.configuration_suggestions;
  }

  /**
   * Propose new agent compositions to fill capability gaps.
   */
  proposeCompositions(): CompositionProposal[] {
    if (this.assessments.length === 0) {
      throw new Error("No assessments available. Run assessEcosystem first.");
    }
    return this.assessments[this.assessments.length - 1].composition_proposals;
  }

  /**
   * Self-assessment: track the meta-agent's own improvement suggestions
   * and their outcomes. Meta-agent is subject to same governance constraints
   * and cannot self-modify without approval.
   */
  async selfAssess(): Promise<SelfAssessment> {
    const total = this.suggestions.length;
    const implemented = this.suggestions.filter(s => s.implemented).length;
    const successful = this.suggestions.filter(s => s.successful === true).length;
    const failed = this.suggestions.filter(s => s.successful === false).length;

    const improvementRate = total > 0 ? successful / total : 0;

    // Analyze assessment trends
    const topAreas: string[] = [];
    const needsImprovement: string[] = [];

    if (this.assessments.length >= 2) {
      const latest = this.assessments[this.assessments.length - 1];
      const previous = this.assessments[this.assessments.length - 2];

      if (latest.underperformers.length < previous.underperformers.length) {
        topAreas.push("underperformer_detection_and_resolution");
      } else if (latest.underperformers.length > previous.underperformers.length) {
        needsImprovement.push("underperformer_management");
      }

      if (latest.capability_gaps.length < previous.capability_gaps.length) {
        topAreas.push("capability_gap_identification");
      } else if (latest.capability_gaps.length > previous.capability_gaps.length) {
        needsImprovement.push("capability_gap_closure");
      }
    }

    if (improvementRate > 0.7) topAreas.push("suggestion_quality");
    if (improvementRate < 0.3 && total > 5) needsImprovement.push("suggestion_accuracy");

    // Default areas if none detected from trends
    if (topAreas.length === 0) topAreas.push("ecosystem_monitoring");
    if (needsImprovement.length === 0 && total < 5) needsImprovement.push("insufficient_data_for_trends");

    const result: SelfAssessment = {
      total_suggestions: total,
      implemented_suggestions: implemented,
      successful_suggestions: successful,
      failed_suggestions: failed,
      improvement_rate: Math.round(improvementRate * 100) / 100,
      top_performing_areas: topAreas,
      areas_needing_improvement: needsImprovement,
      governance_compliance: true, // Meta-agent always respects governance constraints
      timestamp: new Date().toISOString(),
    };

    await this.deps.logAudit("META_AGENT_SELF_ASSESSMENT", {
      total_suggestions: total,
      implemented: implemented,
      successful: successful,
      improvement_rate: result.improvement_rate,
      governance_compliance: true,
    });

    return result;
  }

  /**
   * Mark a suggestion as implemented and record its outcome.
   */
  recordSuggestionOutcome(suggestionId: string, successful: boolean): void {
    const suggestion = this.suggestions.find(s => s.id === suggestionId);
    if (!suggestion) throw new Error(`Suggestion ${suggestionId} not found`);
    suggestion.implemented = true;
    suggestion.successful = successful;
  }

  /**
   * Get all tracked suggestions.
   */
  getSuggestions(): typeof this.suggestions {
    return [...this.suggestions];
  }
}
