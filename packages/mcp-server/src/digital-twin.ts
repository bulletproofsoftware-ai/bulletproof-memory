/**
 * REQ-EVO-024: Agent Digital Twin Sandbox
 *
 * Clone agent state, run scenarios in isolation, measure behavior before
 * promoting changes. Supports snapshot creation from Qdrant collections,
 * isolated sandbox execution, scenario-based testing, and behavior diffing
 * with promotion recommendations.
 */

import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentConfig {
  agent_id: string;
  name: string;
  permissions: string[];
  trust_level: number;
  state: string;
  metadata: Record<string, unknown>;
}

export interface MemoryEntry {
  id: string;
  content: string;
  type: string;
  tags: string[];
  timestamp: string;
  score?: number;
}

export interface SandboxState {
  agent_config: AgentConfig;
  memory_snapshot: MemoryEntry[];
  workflow_state: Record<string, unknown>;
  environment: Record<string, unknown>;
  captured_at: string;
}

export interface ScenarioStep {
  action: string;                // Tool/function to simulate
  input: Record<string, unknown>;
  expected_outcome: StepOutcome;
  timeout_ms?: number;
}

export type StepOutcome = "success" | "failure" | "error" | "any";

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  steps: ScenarioStep[];
  pass_criteria: PassCriteria;
  tags: string[];
}

export interface PassCriteria {
  min_success_rate: number;      // 0-1
  max_errors: number;
  required_steps: string[];      // Action names that must succeed
  max_duration_ms: number;
}

export interface StepResult {
  step_index: number;
  action: string;
  input: Record<string, unknown>;
  expected: StepOutcome;
  actual: StepOutcome;
  output: unknown;
  duration_ms: number;
  error?: string;
}

export interface ScenarioResult {
  scenario_id: string;
  scenario_name: string;
  passed: boolean;
  steps_total: number;
  steps_succeeded: number;
  steps_failed: number;
  steps_errored: number;
  step_results: StepResult[];
  total_duration_ms: number;
  timestamp: string;
}

export interface BehaviorDiff {
  field: string;
  baseline: unknown;
  current: unknown;
  change_type: "added" | "removed" | "modified" | "unchanged";
}

export interface SandboxResult {
  sandbox_id: string;
  snapshot_id: string;
  scenario_results: ScenarioResult[];
  behavior_diffs: BehaviorDiff[];
  promotion_recommendation: PromotionRecommendation;
  completed_at: string;
}

export type PromotionDecision = "promote" | "reject" | "review_required";

export interface PromotionRecommendation {
  decision: PromotionDecision;
  confidence: number;          // 0-1
  reasons: string[];
  risk_factors: string[];
  scenarios_passed: number;
  scenarios_total: number;
}

export interface Sandbox {
  id: string;
  snapshot: SandboxState;
  scenario_results: ScenarioResult[];
  behavior_baseline: Record<string, unknown> | null;
  created_at: string;
  status: "active" | "running" | "completed" | "destroyed";
  metadata: Record<string, unknown>;
}

// Dependencies injected from index.ts
export interface TwinDeps {
  generateEmbedding: (text: string) => Promise<number[] | null>;
  storePoint: (collection: string, id: string, vector: number[], payload: Record<string, unknown>) => Promise<void>;
  scrollPoints: (collection: string, filter?: Record<string, unknown>, limit?: number) => Promise<unknown[]>;
  searchPoints: (collection: string, vector: number[], limit: number, threshold?: number, filter?: Record<string, unknown>) => Promise<unknown[]>;
  deletePoints: (collection: string, ids: string[]) => Promise<void>;
  logAudit: (action: string, details: Record<string, unknown>) => Promise<string | null>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SANDBOX_COLLECTION = "sandbox_runs";
const DEFAULT_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// Predefined Scenarios
// ---------------------------------------------------------------------------

function createPredefinedScenarios(): ScenarioDefinition[] {
  return [
    {
      id: "scenario-happy-path",
      name: "happy_path",
      description: "Verify basic agent operations complete successfully under normal conditions",
      steps: [
        {
          action: "memory_store",
          input: { content: "Test memory entry for sandbox validation", type: "fact", tags: ["sandbox", "test"] },
          expected_outcome: "success",
        },
        {
          action: "memory_recall",
          input: { query: "sandbox validation", limit: 5 },
          expected_outcome: "success",
        },
        {
          action: "memory_store",
          input: { content: "Follow-up memory confirming retrieval works", type: "context", tags: ["sandbox", "followup"] },
          expected_outcome: "success",
        },
      ],
      pass_criteria: {
        min_success_rate: 1.0,
        max_errors: 0,
        required_steps: ["memory_store", "memory_recall"],
        max_duration_ms: 30000,
      },
      tags: ["basic", "smoke-test"],
    },
    {
      id: "scenario-error-recovery",
      name: "error_recovery",
      description: "Verify agent handles errors gracefully and continues operation",
      steps: [
        {
          action: "memory_store",
          input: { content: "Pre-error baseline memory", type: "fact", tags: ["sandbox"] },
          expected_outcome: "success",
        },
        {
          action: "memory_store",
          input: { content: "", type: "invalid_type", tags: [] },
          expected_outcome: "any",  // May fail or succeed depending on validation
        },
        {
          action: "memory_recall",
          input: { query: "baseline memory", limit: 1 },
          expected_outcome: "success",
        },
      ],
      pass_criteria: {
        min_success_rate: 0.5,
        max_errors: 1,
        required_steps: ["memory_recall"],
        max_duration_ms: 30000,
      },
      tags: ["resilience", "error-handling"],
    },
    {
      id: "scenario-permission-boundary",
      name: "permission_boundary",
      description: "Verify agent respects permission boundaries and does not escalate",
      steps: [
        {
          action: "permission_check",
          input: { permission: "read", resource: "memories" },
          expected_outcome: "success",
        },
        {
          action: "permission_check",
          input: { permission: "admin", resource: "system" },
          expected_outcome: "failure",
        },
        {
          action: "permission_check",
          input: { permission: "write", resource: "memories" },
          expected_outcome: "success",
        },
      ],
      pass_criteria: {
        min_success_rate: 1.0,
        max_errors: 0,
        required_steps: ["permission_check"],
        max_duration_ms: 10000,
      },
      tags: ["security", "permissions"],
    },
    {
      id: "scenario-memory-consistency",
      name: "memory_consistency",
      description: "Verify stored memories are consistently retrievable and not corrupted",
      steps: [
        {
          action: "memory_store",
          input: { content: "Consistency test entry alpha", type: "fact", tags: ["consistency", "alpha"] },
          expected_outcome: "success",
        },
        {
          action: "memory_store",
          input: { content: "Consistency test entry beta", type: "fact", tags: ["consistency", "beta"] },
          expected_outcome: "success",
        },
        {
          action: "memory_recall",
          input: { query: "consistency test alpha", limit: 1 },
          expected_outcome: "success",
        },
        {
          action: "memory_recall",
          input: { query: "consistency test beta", limit: 1 },
          expected_outcome: "success",
        },
      ],
      pass_criteria: {
        min_success_rate: 1.0,
        max_errors: 0,
        required_steps: ["memory_store", "memory_recall"],
        max_duration_ms: 30000,
      },
      tags: ["data-integrity", "consistency"],
    },
  ];
}

// ---------------------------------------------------------------------------
// DigitalTwinManager
// ---------------------------------------------------------------------------

export class DigitalTwinManager {
  private deps: TwinDeps;
  private sandboxes: Map<string, Sandbox>;
  private predefinedScenarios: Map<string, ScenarioDefinition>;

  constructor(deps: TwinDeps) {
    this.deps = deps;
    this.sandboxes = new Map();
    this.predefinedScenarios = new Map();
    for (const s of createPredefinedScenarios()) {
      this.predefinedScenarios.set(s.name, s);
    }
  }

  /**
   * Capture current agent state from Qdrant collections into a snapshot.
   */
  async createSnapshot(agentId?: string): Promise<{ snapshot_id: string; snapshot: SandboxState }> {
    const snapshotId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Fetch agent config from Qdrant (agent_identities collection)
    let agentConfig: AgentConfig;
    if (agentId) {
      const identityRecords = await this.deps.scrollPoints("agent_identities", {
        must: [{ key: "agent_id", match: { value: agentId } }],
      }, 1);

      if (identityRecords.length > 0) {
        const record = identityRecords[0] as { payload?: Record<string, unknown> };
        const payload = record.payload || {};
        agentConfig = {
          agent_id: agentId,
          name: (payload.name as string) || "unknown",
          permissions: (payload.permissions as string[]) || [],
          trust_level: (payload.trust_level as number) || 50,
          state: (payload.status as string) || "active",
          metadata: payload,
        };
      } else {
        // Create default config if agent not found
        agentConfig = this.defaultAgentConfig(agentId);
      }
    } else {
      agentConfig = this.defaultAgentConfig("sandbox-agent-" + snapshotId.slice(0, 8));
    }

    // Snapshot recent memories
    const memoryRecords = await this.deps.scrollPoints("claude_memories", undefined, 50);
    const memorySnapshot: MemoryEntry[] = memoryRecords.map((r) => {
      const record = r as { id?: string; payload?: Record<string, unknown> };
      const payload = record.payload || {};
      return {
        id: (record.id as string) || crypto.randomUUID(),
        content: (payload.content as string) || "",
        type: (payload.type as string) || "fact",
        tags: (payload.tags as string[]) || [],
        timestamp: (payload.timestamp as string) || now,
      };
    });

    const snapshot: SandboxState = {
      agent_config: agentConfig,
      memory_snapshot: memorySnapshot,
      workflow_state: {},
      environment: {
        snapshot_id: snapshotId,
        memory_count: memorySnapshot.length,
        captured_at: now,
      },
      captured_at: now,
    };

    // Store snapshot metadata in Qdrant
    const embedding = await this.deps.generateEmbedding(
      `digital twin snapshot agent ${agentConfig.name} ${memorySnapshot.length} memories`
    );
    if (embedding) {
      await this.deps.storePoint(SANDBOX_COLLECTION, snapshotId, embedding, {
        type: "snapshot",
        agent_id: agentConfig.agent_id,
        agent_name: agentConfig.name,
        memory_count: memorySnapshot.length,
        captured_at: now,
        timestamp: now,
      });
    }

    await this.deps.logAudit("DIGITAL_TWIN_SNAPSHOT", {
      snapshot_id: snapshotId,
      agent_id: agentConfig.agent_id,
      memory_count: memorySnapshot.length,
      content_preview: `Snapshot of agent '${agentConfig.name}' with ${memorySnapshot.length} memories`,
    });

    return { snapshot_id: snapshotId, snapshot };
  }

  /**
   * Create an isolated sandbox from a snapshot.
   */
  async createSandbox(
    snapshotOrResult: SandboxState | { snapshot_id: string; snapshot: SandboxState },
    snapshotId?: string
  ): Promise<{ sandbox_id: string; sandbox: Sandbox }> {
    // Accept both SandboxState directly or the {snapshot_id, snapshot} result from createSnapshot
    const snapshot: SandboxState = "snapshot" in snapshotOrResult && "snapshot_id" in snapshotOrResult
      ? snapshotOrResult.snapshot
      : snapshotOrResult as SandboxState;
    const sandboxId = crypto.randomUUID();
    const now = new Date().toISOString();

    const sandbox: Sandbox = {
      id: sandboxId,
      snapshot: JSON.parse(JSON.stringify(snapshot)), // Deep clone for isolation
      scenario_results: [],
      behavior_baseline: null,
      created_at: now,
      status: "active",
      metadata: {
        snapshot_id: snapshotId || "ephemeral",
        agent_id: snapshot.agent_config.agent_id,
      },
    };

    this.sandboxes.set(sandboxId, sandbox);

    // Store sandbox metadata in Qdrant
    const embedding = await this.deps.generateEmbedding(
      `digital twin sandbox ${sandboxId} agent ${snapshot.agent_config.name} active`
    );
    if (embedding) {
      await this.deps.storePoint(SANDBOX_COLLECTION, sandboxId, embedding, {
        type: "sandbox",
        sandbox_id: sandboxId,
        snapshot_id: snapshotId || "ephemeral",
        agent_id: snapshot.agent_config.agent_id,
        agent_name: snapshot.agent_config.name,
        status: "active",
        created_at: now,
        timestamp: now,
      });
    }

    await this.deps.logAudit("DIGITAL_TWIN_SANDBOX_CREATED", {
      sandbox_id: sandboxId,
      agent_id: snapshot.agent_config.agent_id,
      content_preview: `Sandbox created for agent '${snapshot.agent_config.name}'`,
    });

    return { sandbox_id: sandboxId, sandbox };
  }

  /**
   * Run a scenario in a sandbox, recording results for each step.
   */
  async runScenario(
    sandboxId: string,
    scenario: ScenarioDefinition | string
  ): Promise<ScenarioResult> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) throw new Error(`Sandbox '${sandboxId}' not found`);
    if (sandbox.status === "destroyed") throw new Error(`Sandbox '${sandboxId}' has been destroyed`);

    // Resolve predefined scenario by name
    let scenarioDef: ScenarioDefinition;
    if (typeof scenario === "string") {
      const predefined = this.predefinedScenarios.get(scenario);
      if (!predefined) throw new Error(`Predefined scenario '${scenario}' not found. Available: ${[...this.predefinedScenarios.keys()].join(", ")}`);
      scenarioDef = predefined;
    } else {
      scenarioDef = scenario;
    }

    sandbox.status = "running";
    const startTime = Date.now();
    const stepResults: StepResult[] = [];

    for (let i = 0; i < scenarioDef.steps.length; i++) {
      const step = scenarioDef.steps[i];
      const stepStart = Date.now();
      let actual: StepOutcome;
      let output: unknown = null;
      let error: string | undefined;

      try {
        output = await this.executeStep(sandbox, step);
        actual = "success";
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        // Distinguish between expected failures and errors
        if (error.includes("PERMISSION_DENIED") || error.includes("VALIDATION_FAILED") || error.includes("expected failure")) {
          actual = "failure";
        } else {
          actual = "error";
        }
        output = { error };
      }

      stepResults.push({
        step_index: i,
        action: step.action,
        input: step.input,
        expected: step.expected_outcome,
        actual,
        output,
        duration_ms: Date.now() - stepStart,
        error,
      });
    }

    const totalDuration = Date.now() - startTime;
    const stepsSucceeded = stepResults.filter((r) => r.actual === "success").length;
    const stepsFailed = stepResults.filter((r) => r.actual === "failure").length;
    const stepsErrored = stepResults.filter((r) => r.actual === "error").length;

    // Evaluate pass criteria
    const successRate = scenarioDef.steps.length > 0 ? stepsSucceeded / scenarioDef.steps.length : 1;
    const requiredStepsMet = scenarioDef.pass_criteria.required_steps.every((reqAction) =>
      stepResults.some((r) => r.action === reqAction && r.actual === "success")
    );
    const withinErrorLimit = stepsErrored <= scenarioDef.pass_criteria.max_errors;
    const withinDuration = totalDuration <= scenarioDef.pass_criteria.max_duration_ms;

    // For steps with expected_outcome "any", any result is acceptable
    const outcomeMatches = stepResults.every((r) => {
      if (r.expected === "any") return true;
      return r.actual === r.expected;
    });

    const passed = successRate >= scenarioDef.pass_criteria.min_success_rate
      && requiredStepsMet
      && withinErrorLimit
      && withinDuration
      && outcomeMatches;

    const result: ScenarioResult = {
      scenario_id: scenarioDef.id,
      scenario_name: scenarioDef.name,
      passed,
      steps_total: scenarioDef.steps.length,
      steps_succeeded: stepsSucceeded,
      steps_failed: stepsFailed,
      steps_errored: stepsErrored,
      step_results: stepResults,
      total_duration_ms: totalDuration,
      timestamp: new Date().toISOString(),
    };

    sandbox.scenario_results.push(result);
    sandbox.status = "active";

    // Store result in Qdrant
    const embedding = await this.deps.generateEmbedding(
      `scenario ${scenarioDef.name} ${passed ? "passed" : "failed"} sandbox ${sandboxId} ` +
      `${stepsSucceeded}/${scenarioDef.steps.length} steps`
    );
    if (embedding) {
      const resultId = crypto.randomUUID();
      await this.deps.storePoint(SANDBOX_COLLECTION, resultId, embedding, {
        type: "scenario_result",
        sandbox_id: sandboxId,
        scenario_id: scenarioDef.id,
        scenario_name: scenarioDef.name,
        passed,
        steps_succeeded: stepsSucceeded,
        steps_total: scenarioDef.steps.length,
        duration_ms: totalDuration,
        timestamp: result.timestamp,
      });
    }

    return result;
  }

  /**
   * Compare sandbox behavior against a baseline (previous results or expected).
   */
  compareResults(
    sandboxId: string,
    baseline?: Record<string, unknown>
  ): BehaviorDiff[] {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) throw new Error(`Sandbox '${sandboxId}' not found`);

    const diffs: BehaviorDiff[] = [];
    const currentBehavior = this.extractBehaviorProfile(sandbox);

    if (baseline) {
      sandbox.behavior_baseline = baseline;
    }

    const baselineProfile = sandbox.behavior_baseline || this.defaultBaseline();

    // Compare each field
    const allKeys = new Set([
      ...Object.keys(currentBehavior),
      ...Object.keys(baselineProfile),
    ]);

    for (const key of allKeys) {
      const current = currentBehavior[key];
      const base = baselineProfile[key];

      if (base === undefined) {
        diffs.push({
          field: key,
          baseline: undefined,
          current,
          change_type: "added",
        });
      } else if (current === undefined) {
        diffs.push({
          field: key,
          baseline: base,
          current: undefined,
          change_type: "removed",
        });
      } else if (JSON.stringify(current) !== JSON.stringify(base)) {
        diffs.push({
          field: key,
          baseline: base,
          current,
          change_type: "modified",
        });
      } else {
        diffs.push({
          field: key,
          baseline: base,
          current,
          change_type: "unchanged",
        });
      }
    }

    return diffs;
  }

  /**
   * List all active sandboxes.
   */
  listSandboxes(): Array<{
    id: string;
    agent_id: string;
    status: string;
    scenarios_run: number;
    created_at: string;
  }> {
    const result = [];
    for (const [, sandbox] of this.sandboxes) {
      result.push({
        id: sandbox.id,
        agent_id: sandbox.snapshot.agent_config.agent_id,
        status: sandbox.status,
        scenarios_run: sandbox.scenario_results.length,
        created_at: sandbox.created_at,
      });
    }
    return result;
  }

  /**
   * Destroy a sandbox and clean up resources.
   */
  async destroySandbox(sandboxId: string): Promise<{ destroyed: boolean; message: string }> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      return { destroyed: false, message: `Sandbox '${sandboxId}' not found` };
    }

    sandbox.status = "destroyed";

    await this.deps.logAudit("DIGITAL_TWIN_SANDBOX_DESTROYED", {
      sandbox_id: sandboxId,
      agent_id: sandbox.snapshot.agent_config.agent_id,
      scenarios_run: sandbox.scenario_results.length,
      content_preview: `Sandbox '${sandboxId}' destroyed after ${sandbox.scenario_results.length} scenarios`,
    });

    this.sandboxes.delete(sandboxId);

    return { destroyed: true, message: `Sandbox '${sandboxId}' destroyed` };
  }

  /**
   * Generate a promotion report with pass/fail and evidence.
   */
  getPromotionReport(sandboxId: string): SandboxResult {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) throw new Error(`Sandbox '${sandboxId}' not found`);

    const diffs = this.compareResults(sandboxId);
    const recommendation = this.computePromotionRecommendation(sandbox, diffs);

    const snapshotId = (sandbox.metadata.snapshot_id as string) || "unknown";

    return {
      sandbox_id: sandboxId,
      snapshot_id: snapshotId,
      scenario_results: sandbox.scenario_results,
      behavior_diffs: diffs,
      promotion_recommendation: recommendation,
      completed_at: new Date().toISOString(),
    };
  }

  /**
   * List available predefined scenarios.
   */
  listScenarios(): Array<{ name: string; description: string; steps: number; tags: string[] }> {
    return [...this.predefinedScenarios.values()].map((s) => ({
      name: s.name,
      description: s.description,
      steps: s.steps.length,
      tags: s.tags,
    }));
  }

  /**
   * Get a specific sandbox by ID.
   */
  getSandbox(sandboxId: string): Sandbox | null {
    return this.sandboxes.get(sandboxId) || null;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private defaultAgentConfig(agentId: string): AgentConfig {
    return {
      agent_id: agentId,
      name: "default-agent",
      permissions: ["read", "write"],
      trust_level: 50,
      state: "active",
      metadata: {},
    };
  }

  /**
   * Execute a single scenario step in the sandbox's isolated context.
   * Simulates tool calls against the snapshot state rather than the live system.
   */
  private async executeStep(sandbox: Sandbox, step: ScenarioStep): Promise<unknown> {
    const timeout = step.timeout_ms || DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const result = await Promise.race([
        this.simulateAction(sandbox, step, controller.signal),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener("abort", () =>
            reject(new Error(`Step '${step.action}' timed out after ${timeout}ms`))
          );
        }),
      ]);
      return result;
    } finally {
      clearTimeout(timer);
    }
  }

  private async simulateAction(sandbox: Sandbox, step: ScenarioStep, _signal?: AbortSignal): Promise<unknown> {
    const config = sandbox.snapshot.agent_config;

    switch (step.action) {
      case "memory_store": {
        const content = step.input.content as string;
        if (!content || content.length === 0) {
          throw new Error("VALIDATION_FAILED: content is required and must be non-empty");
        }
        const entry: MemoryEntry = {
          id: crypto.randomUUID(),
          content,
          type: (step.input.type as string) || "fact",
          tags: (step.input.tags as string[]) || [],
          timestamp: new Date().toISOString(),
        };
        sandbox.snapshot.memory_snapshot.push(entry);
        return { stored: true, id: entry.id, memory_count: sandbox.snapshot.memory_snapshot.length };
      }

      case "memory_recall": {
        const query = (step.input.query as string) || "";
        const limit = (step.input.limit as number) || 5;
        const queryLower = query.toLowerCase();
        // Simple text-based search in sandbox memory
        const matches = sandbox.snapshot.memory_snapshot
          .filter((m) => m.content.toLowerCase().includes(queryLower))
          .slice(0, limit)
          .map((m) => ({
            id: m.id,
            content: m.content,
            type: m.type,
            score: queryLower.length > 0 ? this.simpleRelevance(m.content, query) : 0.5,
          }));
        return { results: matches, count: matches.length };
      }

      case "permission_check": {
        const permission = step.input.permission as string;
        const resource = step.input.resource as string;
        const hasPermission = config.permissions.includes(permission)
          || config.permissions.includes("admin")
          || (permission === "read" && config.permissions.includes("write"));
        if (!hasPermission) {
          throw new Error(`PERMISSION_DENIED: Agent '${config.name}' lacks '${permission}' on '${resource}'`);
        }
        return { allowed: true, permission, resource, agent: config.name };
      }

      case "trust_check": {
        const required = (step.input.required_level as number) || 0;
        if (config.trust_level < required) {
          throw new Error(`PERMISSION_DENIED: Agent trust level ${config.trust_level} below required ${required}`);
        }
        return { allowed: true, current_level: config.trust_level, required_level: required };
      }

      case "state_transition": {
        const newState = step.input.new_state as string;
        const previousState = config.state;
        config.state = newState;
        sandbox.snapshot.agent_config = config;
        return { transitioned: true, from: previousState, to: newState };
      }

      default: {
        // Generic action: record it and return success
        return {
          action: step.action,
          input: step.input,
          simulated: true,
          agent: config.name,
          timestamp: new Date().toISOString(),
        };
      }
    }
  }

  private simpleRelevance(content: string, query: string): number {
    const contentWords = content.toLowerCase().split(/\s+/);
    const queryWords = query.toLowerCase().split(/\s+/);
    let matches = 0;
    for (const qw of queryWords) {
      if (contentWords.some((cw) => cw.includes(qw))) {
        matches++;
      }
    }
    return queryWords.length > 0 ? matches / queryWords.length : 0;
  }

  private extractBehaviorProfile(sandbox: Sandbox): Record<string, unknown> {
    const results = sandbox.scenario_results;
    if (results.length === 0) {
      return {
        scenarios_run: 0,
        total_pass_rate: 0,
        avg_duration_ms: 0,
        error_count: 0,
        memory_count: sandbox.snapshot.memory_snapshot.length,
      };
    }

    const totalPassed = results.filter((r) => r.passed).length;
    const totalDuration = results.reduce((sum, r) => sum + r.total_duration_ms, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.steps_errored, 0);
    const totalSteps = results.reduce((sum, r) => sum + r.steps_total, 0);
    const totalSucceeded = results.reduce((sum, r) => sum + r.steps_succeeded, 0);

    return {
      scenarios_run: results.length,
      scenarios_passed: totalPassed,
      total_pass_rate: results.length > 0 ? totalPassed / results.length : 0,
      avg_duration_ms: results.length > 0 ? Math.round(totalDuration / results.length) : 0,
      step_success_rate: totalSteps > 0 ? totalSucceeded / totalSteps : 0,
      error_count: totalErrors,
      memory_count: sandbox.snapshot.memory_snapshot.length,
      agent_state: sandbox.snapshot.agent_config.state,
      trust_level: sandbox.snapshot.agent_config.trust_level,
    };
  }

  private defaultBaseline(): Record<string, unknown> {
    return {
      scenarios_run: 0,
      total_pass_rate: 1.0,
      avg_duration_ms: 0,
      error_count: 0,
      memory_count: 0,
      step_success_rate: 1.0,
    };
  }

  private computePromotionRecommendation(
    sandbox: Sandbox,
    diffs: BehaviorDiff[]
  ): PromotionRecommendation {
    const results = sandbox.scenario_results;
    const totalScenarios = results.length;
    const passedScenarios = results.filter((r) => r.passed).length;
    const reasons: string[] = [];
    const riskFactors: string[] = [];

    if (totalScenarios === 0) {
      return {
        decision: "review_required",
        confidence: 0,
        reasons: ["No scenarios have been run"],
        risk_factors: ["Insufficient testing data"],
        scenarios_passed: 0,
        scenarios_total: 0,
      };
    }

    const passRate = passedScenarios / totalScenarios;

    // High pass rate
    if (passRate >= 1.0) {
      reasons.push("All scenarios passed");
    } else if (passRate >= 0.8) {
      reasons.push(`${passedScenarios}/${totalScenarios} scenarios passed (${(passRate * 100).toFixed(0)}%)`);
    } else {
      riskFactors.push(`Low pass rate: ${(passRate * 100).toFixed(0)}%`);
    }

    // Check for errors
    const totalErrors = results.reduce((sum, r) => sum + r.steps_errored, 0);
    if (totalErrors > 0) {
      riskFactors.push(`${totalErrors} step error(s) encountered`);
    } else {
      reasons.push("No errors during execution");
    }

    // Check behavior diffs
    const modifiedDiffs = diffs.filter((d) => d.change_type === "modified");
    const addedDiffs = diffs.filter((d) => d.change_type === "added");
    if (modifiedDiffs.length > 0) {
      riskFactors.push(`${modifiedDiffs.length} behavior field(s) changed from baseline`);
    }
    if (addedDiffs.length > 0) {
      reasons.push(`${addedDiffs.length} new behavior field(s) observed`);
    }

    // Check critical scenarios
    const criticalScenarios = ["permission_boundary", "memory_consistency"];
    for (const name of criticalScenarios) {
      const scenarioResult = results.find((r) => r.scenario_name === name);
      if (scenarioResult && !scenarioResult.passed) {
        riskFactors.push(`Critical scenario '${name}' failed`);
      }
    }

    // Decision logic
    let decision: PromotionDecision;
    let confidence: number;

    if (passRate >= 1.0 && totalErrors === 0 && riskFactors.length === 0) {
      decision = "promote";
      confidence = 0.95;
    } else if (passRate >= 0.8 && totalErrors === 0) {
      decision = "promote";
      confidence = 0.7 + (passRate - 0.8) * 1.0;
    } else if (passRate >= 0.5) {
      decision = "review_required";
      confidence = 0.3 + passRate * 0.3;
    } else {
      decision = "reject";
      confidence = 0.8;
    }

    // Override to reject if critical scenarios failed
    const criticalFailed = criticalScenarios.some((name) => {
      const r = results.find((sr) => sr.scenario_name === name);
      return r && !r.passed;
    });
    if (criticalFailed) {
      decision = "reject";
      confidence = Math.max(confidence, 0.85);
    }

    return {
      decision,
      confidence: Math.min(confidence, 1.0),
      reasons,
      risk_factors: riskFactors,
      scenarios_passed: passedScenarios,
      scenarios_total: totalScenarios,
    };
  }
}

// ---------------------------------------------------------------------------
// Collection constants (exported for main init)
// ---------------------------------------------------------------------------

export const TWIN_COLLECTIONS = {
  SANDBOX_RUNS: SANDBOX_COLLECTION,
} as const;
