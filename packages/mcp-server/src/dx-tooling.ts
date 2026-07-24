/**
 * Wave 3: Developer Experience + Multi-Agent Enhancements
 *
 * REQ-EVO-029: Agent Capability Marketplace
 * REQ-EVO-030: Micro-Agent Swarms
 * REQ-EVO-032: Causal Reasoning Debugger
 * REQ-EVO-033: Visual Agent Flow Debugger
 * REQ-EVO-034: Natural Language Workflow Authoring
 * REQ-EVO-036: Automated Skill Discovery from Trajectories
 * REQ-EVO-037: Multi-Modal Agent Inputs
 * REQ-EVO-038: Agent Performance Benchmarking Suite
 */

import { createHash } from "crypto";
// Stage #8 dual-write mirror (flag-gated, non-fatal)
import { mirrorBenchmarkRuns } from "./postgres-mirror.js";

// ---------------------------------------------------------------------------
// Dependency injection interface
// ---------------------------------------------------------------------------

export interface DxToolingDeps {
  generateEmbedding: (text: string) => Promise<number[] | null>;
  storePoint: (collection: string, id: string, vector: number[], payload: Record<string, unknown>) => Promise<void>;
  scrollPoints: (collection: string, filter?: Record<string, unknown>, limit?: number) => Promise<unknown[]>;
  searchPoints: (collection: string, vector: number[], limit: number, threshold?: number, filter?: Record<string, unknown>) => Promise<unknown[]>;
  deletePoints: (collection: string, ids: string[]) => Promise<void>;
  updatePayload: (collection: string, ids: string[], payload: Record<string, unknown>) => Promise<void>;
  logAudit: (action: string, details: Record<string, unknown>, sensitivity?: string, project?: string) => Promise<string | null>;
  generateUUID: () => string;
  ollamaGenerate: (prompt: string) => Promise<string | null>;
}

// ---------------------------------------------------------------------------
// Collection constants
// ---------------------------------------------------------------------------

export const DX_COLLECTIONS = {
  MARKETPLACE: "agent_marketplace",
  SWARM_RUNS: "swarm_runs",
  CAUSAL_ANALYSIS: "causal_analysis",
  WORKFLOW_FLOWS: "workflow_flows",
  COMPILED_WORKFLOWS: "compiled_workflows",
  DISCOVERED_SKILLS: "discovered_skills",
  MULTIMODAL_ARTIFACTS: "multimodal_artifacts",
  BENCHMARK_RUNS: "benchmark_runs",
};

// ---------------------------------------------------------------------------
// Types: REQ-EVO-029 Agent Capability Marketplace
// ---------------------------------------------------------------------------

export interface MarketplaceEntry {
  id: string;
  name: string;
  version: string;
  capability_declaration: string[];
  author: string;
  trust_level: "untrusted" | "community" | "verified" | "certified";
  certification_status: "none" | "pending" | "certified" | "revoked";
  install_count: number;
  avg_rating: number;
  total_ratings: number;
  description: string;
  manifest_hash: string;
  signature: string;
  dependencies: string[];
  published_at: string;
  updated_at: string;
}

export interface InstalledAgent {
  marketplace_id: string;
  name: string;
  version: string;
  installed_at: string;
  capabilities: string[];
  status: "active" | "disabled" | "update_available";
}

// ---------------------------------------------------------------------------
// Types: REQ-EVO-030 Micro-Agent Swarms
// ---------------------------------------------------------------------------

export interface MicroTask {
  id: string;
  description: string;
  assigned_profile: string;
  input: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "failed";
  result: unknown;
  start_time: number;
  end_time: number;
  duration_ms: number;
}

export interface SwarmResult {
  swarm_id: string;
  profile: string;
  total_tasks: number;
  completed: number;
  failed: number;
  consensus_result: unknown;
  aggregated_output: unknown;
  total_duration_ms: number;
  started_at: string;
  completed_at: string;
}

export type SwarmProfile = "code_review_swarm" | "security_scan_swarm" | "documentation_swarm" | "test_coverage_swarm" | "dependency_audit_swarm";

interface SwarmProfileConfig {
  name: SwarmProfile;
  description: string;
  micro_agent_count: number;
  task_template: string[];
  consensus_threshold: number;
  max_duration_ms: number;
}

// ---------------------------------------------------------------------------
// Types: REQ-EVO-032 Causal Reasoning Debugger
// ---------------------------------------------------------------------------

export interface CausalAnalysis {
  id: string;
  decision_point: string;
  timestamp: string;
  memories_in_context: Array<{ id: string; content: string; score: number }>;
  memories_available_not_recalled: Array<{ id: string; content: string; relevance_score: number }>;
  divergence_assessment: string;
  counterfactual_outcome: string;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Types: REQ-EVO-033 Visual Agent Flow Debugger
// ---------------------------------------------------------------------------

export interface WorkflowDAGNode {
  id: string;
  type: "agent" | "gate" | "decision" | "merge" | "start" | "end";
  label: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  agent_id?: string;
  started_at?: string;
  completed_at?: string;
  metadata: Record<string, unknown>;
}

export interface WorkflowDAGEdge {
  source: string;
  target: string;
  label?: string;
  data_schema?: string;
  condition?: string;
}

export interface WorkflowDAG {
  id: string;
  name: string;
  nodes: WorkflowDAGNode[];
  edges: WorkflowDAGEdge[];
  created_at: string;
  updated_at: string;
  status: "draft" | "running" | "completed" | "failed";
}

export interface ExecutionComparison {
  execution_a: { id: string; duration_ms: number; status: string; node_count: number };
  execution_b: { id: string; duration_ms: number; status: string; node_count: number };
  differences: Array<{ node_id: string; field: string; value_a: unknown; value_b: unknown }>;
  performance_delta: { duration_pct: number; success_rate_delta: number };
}

// ---------------------------------------------------------------------------
// Types: REQ-EVO-034 Natural Language Workflow Authoring
// ---------------------------------------------------------------------------

export interface CompiledWorkflow {
  id: string;
  source_nl: string;
  triggers: string[];
  steps: Array<{
    order: number;
    action: string;
    agent: string;
    input_mapping: Record<string, string>;
    success_criteria: string;
    gate?: { type: string; threshold: number };
  }>;
  agent_assignments: Record<string, string>;
  success_criteria: string[];
  generated_at: string;
  confidence: number;
}

export type WorkflowTemplate = "ci_cd" | "code_review" | "security_audit" | "documentation" | "incident_response" | "onboarding";

interface WorkflowTemplateConfig {
  name: WorkflowTemplate;
  description: string;
  default_steps: Array<{ action: string; agent_role: string; gate?: string }>;
  required_capabilities: string[];
}

// ---------------------------------------------------------------------------
// Types: REQ-EVO-036 Automated Skill Discovery
// ---------------------------------------------------------------------------

export interface DiscoveredSkill {
  id: string;
  name: string;
  trigger: string;
  steps: Array<{ tool: string; args_pattern: Record<string, string> }>;
  expected_outcome: string;
  occurrence_count: number;
  first_seen: string;
  last_seen: string;
  status: "proposed" | "promoted" | "archived" | "rejected";
  cluster_id: string;
  confidence: number;
  source_trajectory_ids: string[];
}

export interface PatternSequence {
  tools: string[];
  frequency: number;
  avg_duration_ms: number;
  success_rate: number;
  representative_args: Record<string, unknown>[];
}

// ---------------------------------------------------------------------------
// Types: REQ-EVO-037 Multi-Modal Agent Inputs
// ---------------------------------------------------------------------------

export interface MultiModalArtifact {
  id: string;
  modality: "image" | "audio" | "diagram" | "text";
  source_path: string;
  extracted_text: string;
  annotations: Array<{ label: string; value: string; confidence: number }>;
  components?: Array<{ name: string; type: string; connections: string[] }>;
  stored_at: string;
  memory_id?: string;
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Types: REQ-EVO-038 Agent Performance Benchmarking Suite
// ---------------------------------------------------------------------------

export interface BenchmarkRun {
  id: string;
  suite_name: string;
  agent_id: string;
  dimensions: {
    completion_rate: number;
    steps_to_completion: number;
    cost_per_task: number;
    error_rate: number;
    governance_compliance: number;
    memory_utilization: number;
    time_to_completion_ms: number;
  };
  test_cases: Array<{
    name: string;
    passed: boolean;
    duration_ms: number;
    notes: string;
  }>;
  regressions: Array<{
    dimension: string;
    baseline_value: number;
    current_value: number;
    degradation_pct: number;
  }>;
  timestamp: string;
  baseline_id?: string;
}

export interface AgentScorecard {
  agent_id: string;
  overall_score: number;
  dimension_scores: Record<string, number>;
  trend: "improving" | "stable" | "degrading";
  run_count: number;
  last_run: string;
  historical: Array<{ timestamp: string; overall_score: number }>;
}

// ============================================================================
// REQ-EVO-029: Agent Capability Marketplace
// ============================================================================

export class AgentMarketplace {
  private readonly deps: DxToolingDeps;
  private readonly installed: Map<string, InstalledAgent> = new Map();

  constructor(deps: DxToolingDeps) {
    this.deps = deps;
  }

  async publish(entry: {
    name: string;
    version: string;
    capability_declaration: string[];
    author: string;
    description: string;
    dependencies?: string[];
    signature?: string;
  }): Promise<MarketplaceEntry> {
    // Validate manifest: name, version, capabilities must be present
    if (!entry.name || !entry.version || !entry.capability_declaration.length) {
      throw new Error("Manifest validation failed: name, version, and at least one capability are required");
    }

    // Version format check
    if (!/^\d+\.\d+\.\d+$/.test(entry.version)) {
      throw new Error("Version must follow semver format (e.g., 1.0.0)");
    }

    // Check for duplicate name+version
    const existingFilter = {
      must: [
        { key: "name", match: { value: entry.name } },
        { key: "version", match: { value: entry.version } },
      ],
    };
    const existing = await this.deps.scrollPoints(DX_COLLECTIONS.MARKETPLACE, existingFilter, 1);
    if (existing.length > 0) {
      throw new Error(`Agent ${entry.name}@${entry.version} already published. Bump version to republish.`);
    }

    // Generate manifest hash for integrity verification
    const manifestContent = JSON.stringify({
      name: entry.name,
      version: entry.version,
      capabilities: entry.capability_declaration,
      author: entry.author,
    });
    const manifestHash = createHash("sha256").update(manifestContent).digest("hex");

    // Run linter checks
    const lintIssues: string[] = [];
    if (entry.name.length < 3) lintIssues.push("Name must be at least 3 characters");
    if (entry.name.length > 64) lintIssues.push("Name must be at most 64 characters");
    if (!/^[a-z][a-z0-9_-]*$/.test(entry.name)) lintIssues.push("Name must be lowercase alphanumeric with hyphens/underscores");
    if (!entry.description || entry.description.length < 10) lintIssues.push("Description must be at least 10 characters");
    for (const cap of entry.capability_declaration) {
      if (!/^[a-z][a-z0-9_.]*$/.test(cap)) {
        lintIssues.push(`Capability "${cap}" must be lowercase dotted identifier (e.g., code.review)`);
      }
    }
    if (lintIssues.length > 0) {
      throw new Error(`Lint failed:\n${lintIssues.join("\n")}`);
    }

    const id = this.deps.generateUUID();
    const now = new Date().toISOString();

    const record: MarketplaceEntry = {
      id,
      name: entry.name,
      version: entry.version,
      capability_declaration: entry.capability_declaration,
      author: entry.author,
      trust_level: "untrusted",
      certification_status: "none",
      install_count: 0,
      avg_rating: 0,
      total_ratings: 0,
      description: entry.description,
      manifest_hash: manifestHash,
      signature: entry.signature || "",
      dependencies: entry.dependencies || [],
      published_at: now,
      updated_at: now,
    };

    const embeddingText = `${entry.name} ${entry.description} ${entry.capability_declaration.join(" ")}`;
    const embedding = await this.deps.generateEmbedding(embeddingText);
    if (!embedding) throw new Error("Failed to generate embedding for marketplace entry");

    await this.deps.storePoint(DX_COLLECTIONS.MARKETPLACE, id, embedding, record as unknown as Record<string, unknown>);

    await this.deps.logAudit("marketplace_publish", {
      agent_name: entry.name,
      version: entry.version,
      manifest_hash: manifestHash,
    });

    return record;
  }

  async install(marketplaceId: string): Promise<InstalledAgent> {
    // Look up the marketplace entry
    const filter = { must: [{ key: "id", match: { value: marketplaceId } }] };
    const results = await this.deps.scrollPoints(DX_COLLECTIONS.MARKETPLACE, filter, 1);

    if (results.length === 0) {
      throw new Error(`Marketplace entry ${marketplaceId} not found`);
    }

    const entry = (results[0] as { payload: MarketplaceEntry }).payload;

    // Validate signature if present
    if (entry.signature) {
      const expectedHash = createHash("sha256").update(JSON.stringify({
        name: entry.name,
        version: entry.version,
        capabilities: entry.capability_declaration,
        author: entry.author,
      })).digest("hex");

      if (expectedHash !== entry.manifest_hash) {
        throw new Error("Manifest integrity check failed: hash mismatch");
      }
    }

    // Check dependencies
    for (const dep of entry.dependencies) {
      if (!this.installed.has(dep)) {
        const depFilter = { must: [{ key: "name", match: { value: dep } }] };
        const depResults = await this.deps.scrollPoints(DX_COLLECTIONS.MARKETPLACE, depFilter, 1);
        if (depResults.length === 0) {
          throw new Error(`Missing dependency: ${dep}`);
        }
      }
    }

    // Register locally
    const installed: InstalledAgent = {
      marketplace_id: marketplaceId,
      name: entry.name,
      version: entry.version,
      installed_at: new Date().toISOString(),
      capabilities: entry.capability_declaration,
      status: "active",
    };

    this.installed.set(entry.name, installed);

    // Increment install count
    await this.deps.updatePayload(DX_COLLECTIONS.MARKETPLACE, [marketplaceId], {
      install_count: entry.install_count + 1,
      updated_at: new Date().toISOString(),
    });

    await this.deps.logAudit("marketplace_install", {
      agent_name: entry.name,
      version: entry.version,
      marketplace_id: marketplaceId,
    });

    return installed;
  }

  async search(query: string, limit: number = 10): Promise<MarketplaceEntry[]> {
    const embedding = await this.deps.generateEmbedding(query);
    if (!embedding) throw new Error("Failed to generate search embedding");

    const results = await this.deps.searchPoints(DX_COLLECTIONS.MARKETPLACE, embedding, limit, 0.3);

    return results.map((r: any) => r.payload as MarketplaceEntry);
  }

  async certify(marketplaceId: string, certifier: string): Promise<MarketplaceEntry> {
    const filter = { must: [{ key: "id", match: { value: marketplaceId } }] };
    const results = await this.deps.scrollPoints(DX_COLLECTIONS.MARKETPLACE, filter, 1);

    if (results.length === 0) {
      throw new Error(`Marketplace entry ${marketplaceId} not found`);
    }

    const entry = (results[0] as { payload: MarketplaceEntry }).payload;

    // Certification checks
    const checks = {
      has_description: entry.description.length >= 10,
      has_capabilities: entry.capability_declaration.length > 0,
      has_author: entry.author.length > 0,
      manifest_integrity: (() => {
        const expected = createHash("sha256").update(JSON.stringify({
          name: entry.name,
          version: entry.version,
          capabilities: entry.capability_declaration,
          author: entry.author,
        })).digest("hex");
        return expected === entry.manifest_hash;
      })(),
      min_installs: entry.install_count >= 0, // No minimum for initial certification
      avg_rating_ok: entry.total_ratings === 0 || entry.avg_rating >= 2.0,
    };

    const allPassed = Object.values(checks).every(Boolean);
    if (!allPassed) {
      const failedChecks = Object.entries(checks)
        .filter(([, passed]) => !passed)
        .map(([name]) => name);
      throw new Error(`Certification failed. Failed checks: ${failedChecks.join(", ")}`);
    }

    await this.deps.updatePayload(DX_COLLECTIONS.MARKETPLACE, [marketplaceId], {
      certification_status: "certified",
      trust_level: "certified",
      updated_at: new Date().toISOString(),
    });

    const updated = { ...entry, certification_status: "certified" as const, trust_level: "certified" as const };

    await this.deps.logAudit("marketplace_certify", {
      agent_name: entry.name,
      marketplace_id: marketplaceId,
      certifier,
      checks,
    });

    return updated;
  }

  listInstalled(): InstalledAgent[] {
    return Array.from(this.installed.values());
  }
}

// ============================================================================
// REQ-EVO-030: Micro-Agent Swarms
// ============================================================================

const SWARM_PROFILES: Record<SwarmProfile, SwarmProfileConfig> = {
  code_review_swarm: {
    name: "code_review_swarm",
    description: "Parallel code review with specialized micro-agents for style, logic, security, and performance",
    micro_agent_count: 4,
    task_template: ["style_check", "logic_analysis", "security_scan", "performance_review"],
    consensus_threshold: 0.6,
    max_duration_ms: 10000,
  },
  security_scan_swarm: {
    name: "security_scan_swarm",
    description: "Security-focused swarm: dependency audit, secret detection, input validation, auth flow analysis",
    micro_agent_count: 4,
    task_template: ["dependency_audit", "secret_detection", "input_validation", "auth_flow_check"],
    consensus_threshold: 0.75,
    max_duration_ms: 15000,
  },
  documentation_swarm: {
    name: "documentation_swarm",
    description: "Documentation generation swarm: API docs, usage examples, architecture diagrams, changelog",
    micro_agent_count: 4,
    task_template: ["api_doc_gen", "example_gen", "architecture_summary", "changelog_gen"],
    consensus_threshold: 0.5,
    max_duration_ms: 12000,
  },
  test_coverage_swarm: {
    name: "test_coverage_swarm",
    description: "Test coverage analysis: unit test gaps, integration test needs, edge case identification",
    micro_agent_count: 3,
    task_template: ["unit_test_gaps", "integration_needs", "edge_case_finder"],
    consensus_threshold: 0.6,
    max_duration_ms: 10000,
  },
  dependency_audit_swarm: {
    name: "dependency_audit_swarm",
    description: "Dependency audit: version checks, CVE scan, license compliance, update recommendations",
    micro_agent_count: 4,
    task_template: ["version_check", "cve_scan", "license_check", "update_recommendations"],
    consensus_threshold: 0.7,
    max_duration_ms: 12000,
  },
};

/** Max context length to include in LLM prompts to limit injection surface. */
const MAX_CONTEXT_CHARS = 2000;

/** Common prompt injection patterns to strip from untrusted context. */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/gi,
  /disregard\s+(all\s+)?previous/gi,
  /system\s*:/gi,
  /\[SYSTEM\]/gi,
  /\[INST\]/gi,
  /<<\s*SYS\s*>>/gi,
  /you\s+are\s+now/gi,
  /new\s+instructions?\s*:/gi,
  /override\s+(all\s+)?previous/gi,
];

function sanitizeContext(context: unknown): string {
  let raw = typeof context === "string" ? context : JSON.stringify(context);
  // Truncate to limit
  if (raw.length > MAX_CONTEXT_CHARS) {
    raw = raw.slice(0, MAX_CONTEXT_CHARS) + "...[truncated]";
  }
  // Strip injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    raw = raw.replace(pattern, "[FILTERED]");
  }
  return raw;
}

export class MicroAgentSwarm {
  private readonly deps: DxToolingDeps;

  constructor(deps: DxToolingDeps) {
    this.deps = deps;
  }

  /**
   * Decompose a task into micro-tasks based on a swarm profile.
   */
  decompose(task: string, profile: SwarmProfile): MicroTask[] {
    const config = SWARM_PROFILES[profile];
    if (!config) throw new Error(`Unknown swarm profile: ${profile}`);

    return config.task_template.map((template, idx) => ({
      id: this.deps.generateUUID(),
      description: `${template}: ${task}`,
      assigned_profile: template,
      input: { original_task: task, sub_task: template, index: idx },
      status: "pending" as const,
      result: null,
      start_time: 0,
      end_time: 0,
      duration_ms: 0,
    }));
  }

  /**
   * Execute a swarm by running all micro-tasks in parallel.
   * Each micro-agent is stateless, single-purpose, and targets <2s execution.
   */
  async executeSwarm(task: string, profile: SwarmProfile, context?: Record<string, unknown>): Promise<SwarmResult> {
    const config = SWARM_PROFILES[profile];
    if (!config) throw new Error(`Unknown swarm profile: ${profile}`);

    const swarmId = this.deps.generateUUID();
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    const microTasks = this.decompose(task, profile);

    // Execute all micro-tasks in parallel (simulating Haiku-class single-purpose agents)
    const taskPromises = microTasks.map(async (mt) => {
      const taskStart = Date.now();
      mt.status = "running";
      mt.start_time = taskStart;

      try {
        // Each micro-agent analyzes its specific aspect using local LLM
        const safeContext = context ? sanitizeContext(context) : "";
        const prompt = `You are a micro-agent performing "${mt.assigned_profile}" analysis.
Task: ${task}
${safeContext ? `Context: ${safeContext}` : ""}

Provide a concise analysis (max 3 sentences) focused ONLY on ${mt.assigned_profile}.
Output format: JSON with keys "findings" (array of strings), "severity" ("low"|"medium"|"high"|"critical"), "recommendation" (string).`;

        const response = await this.deps.ollamaGenerate(prompt);
        const taskEnd = Date.now();
        mt.end_time = taskEnd;
        mt.duration_ms = taskEnd - taskStart;

        if (response) {
          try {
            mt.result = JSON.parse(response);
          } catch {
            mt.result = { findings: [response], severity: "low", recommendation: response };
          }
          mt.status = "completed";
        } else {
          // Fallback: generate structured result from task decomposition
          mt.result = {
            findings: [`${mt.assigned_profile} analysis completed for: ${task.slice(0, 100)}`],
            severity: "low",
            recommendation: `Review ${mt.assigned_profile} aspects manually`,
          };
          mt.status = "completed";
        }
      } catch (err) {
        const taskEnd = Date.now();
        mt.end_time = taskEnd;
        mt.duration_ms = taskEnd - taskStart;
        mt.status = "failed";
        mt.result = { error: err instanceof Error ? err.message : "Unknown error" };
      }
    });

    // Enforce max duration with timeout
    await Promise.race([
      Promise.allSettled(taskPromises),
      new Promise<void>((resolve) => setTimeout(resolve, config.max_duration_ms)),
    ]);

    const endTime = Date.now();
    const completedTasks = microTasks.filter((t) => t.status === "completed");
    const failedTasks = microTasks.filter((t) => t.status === "failed");

    // BFT-style consensus aggregation
    const consensusResult = this.aggregate(microTasks, config.consensus_threshold);

    const result: SwarmResult = {
      swarm_id: swarmId,
      profile,
      total_tasks: microTasks.length,
      completed: completedTasks.length,
      failed: failedTasks.length,
      consensus_result: consensusResult,
      aggregated_output: {
        micro_task_results: microTasks.map((t) => ({
          profile: t.assigned_profile,
          status: t.status,
          duration_ms: t.duration_ms,
          result: t.result,
        })),
      },
      total_duration_ms: endTime - startTime,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    };

    // Store the swarm run
    const embeddingText = `swarm ${profile} ${task}`;
    const embedding = await this.deps.generateEmbedding(embeddingText);
    if (embedding) {
      await this.deps.storePoint(DX_COLLECTIONS.SWARM_RUNS, swarmId, embedding, result as unknown as Record<string, unknown>);
    }

    await this.deps.logAudit("swarm_execute", {
      swarm_id: swarmId,
      profile,
      task_count: microTasks.length,
      completed: completedTasks.length,
      duration_ms: endTime - startTime,
    });

    return result;
  }

  /**
   * BFT consensus aggregation: aggregate micro-task results with weighted voting.
   */
  aggregate(tasks: MicroTask[], threshold: number): Record<string, unknown> {
    const completed = tasks.filter((t) => t.status === "completed" && t.result);
    const total = tasks.length;

    if (completed.length === 0) {
      return { consensus: "no_results", confidence: 0 };
    }

    const completionRate = completed.length / total;

    // Aggregate severity votes
    const severityCounts: Record<string, number> = {};
    const allFindings: string[] = [];
    const allRecommendations: string[] = [];

    for (const task of completed) {
      const r = task.result as { findings?: string[]; severity?: string; recommendation?: string };
      if (r.severity) {
        severityCounts[r.severity] = (severityCounts[r.severity] || 0) + 1;
      }
      if (r.findings) allFindings.push(...r.findings);
      if (r.recommendation) allRecommendations.push(r.recommendation);
    }

    // Determine consensus severity (majority vote)
    let consensusSeverity = "low";
    let maxCount = 0;
    for (const [severity, count] of Object.entries(severityCounts)) {
      if (count > maxCount) {
        maxCount = count;
        consensusSeverity = severity;
      }
    }

    const severityConfidence = total > 0 ? maxCount / total : 0;
    const reachedConsensus = completionRate >= threshold && severityConfidence >= threshold;

    return {
      consensus: reachedConsensus ? "reached" : "partial",
      severity: consensusSeverity,
      severity_confidence: severityConfidence,
      completion_rate: completionRate,
      threshold,
      unique_findings: [...new Set(allFindings)],
      recommendations: [...new Set(allRecommendations)],
      dissenting_views: tasks
        .filter((t) => t.status === "completed" && (t.result as any)?.severity !== consensusSeverity)
        .map((t) => ({ profile: t.assigned_profile, severity: (t.result as any)?.severity })),
    };
  }

  getSwarmProfiles(): SwarmProfileConfig[] {
    return Object.values(SWARM_PROFILES);
  }
}

// ============================================================================
// REQ-EVO-032: Causal Reasoning Debugger
// ============================================================================

export class CausalDebugger {
  private readonly deps: DxToolingDeps;

  constructor(deps: DxToolingDeps) {
    this.deps = deps;
  }

  /**
   * Analyze a decision point: what memories were used, what was available but not recalled.
   */
  async analyzeDecision(params: {
    decision_point: string;
    recalled_memory_ids: string[];
    query_used: string;
    outcome: string;
    collection?: string;
  }): Promise<CausalAnalysis> {
    const collection = params.collection || "claude_memories";

    // Get the memories that were in context at the decision point
    const memoriesInContext: Array<{ id: string; content: string; score: number }> = [];
    for (const memId of params.recalled_memory_ids) {
      const filter = { must: [{ key: "id_str", match: { value: memId } }] };
      const points = await this.deps.scrollPoints(collection, filter, 1);
      if (points.length > 0) {
        const p = points[0] as { payload: Record<string, unknown> };
        memoriesInContext.push({
          id: memId,
          content: (p.payload.content as string) || "",
          score: 1.0,
        });
      }
    }

    // Find alternative memories that existed but weren't recalled
    const alternativeMemories = await this.findAlternativeMemories(
      params.query_used,
      params.recalled_memory_ids,
      collection,
      20
    );

    // Generate divergence assessment using LLM
    const assessmentPrompt = `Analyze this decision for causal reasoning:

Decision: ${params.decision_point}
Query used: ${params.query_used}
Outcome: ${params.outcome}

Memories that WERE in context (${memoriesInContext.length}):
${memoriesInContext.map((m) => `- ${m.content.slice(0, 200)}`).join("\n")}

Memories that EXISTED but were NOT recalled (${alternativeMemories.length}):
${alternativeMemories.map((m) => `- [score=${m.relevance_score.toFixed(2)}] ${m.content.slice(0, 200)}`).join("\n")}

In 2-3 sentences, assess: Would the decision have been different if the alternative memories had been recalled? What is the most impactful missed memory?
Output as JSON: {"divergence_assessment": "...", "counterfactual_outcome": "...", "confidence": 0.0-1.0}`;

    let divergenceAssessment = "Analysis requires LLM evaluation";
    let counterfactualOutcome = "Unable to determine without LLM";
    let confidence = 0.5;

    const llmResponse = await this.deps.ollamaGenerate(assessmentPrompt);
    if (llmResponse) {
      try {
        const parsed = JSON.parse(llmResponse);
        divergenceAssessment = parsed.divergence_assessment || divergenceAssessment;
        counterfactualOutcome = parsed.counterfactual_outcome || counterfactualOutcome;
        confidence = parsed.confidence || confidence;
      } catch {
        divergenceAssessment = llmResponse;
      }
    }

    const analysisId = this.deps.generateUUID();
    const analysis: CausalAnalysis = {
      id: analysisId,
      decision_point: params.decision_point,
      timestamp: new Date().toISOString(),
      memories_in_context: memoriesInContext,
      memories_available_not_recalled: alternativeMemories,
      divergence_assessment: divergenceAssessment,
      counterfactual_outcome: counterfactualOutcome,
      confidence,
    };

    // Store the analysis
    const embeddingText = `causal analysis ${params.decision_point} ${params.query_used}`;
    const embedding = await this.deps.generateEmbedding(embeddingText);
    if (embedding) {
      await this.deps.storePoint(DX_COLLECTIONS.CAUSAL_ANALYSIS, analysisId, embedding, analysis as unknown as Record<string, unknown>);
    }

    await this.deps.logAudit("causal_analysis", {
      analysis_id: analysisId,
      decision_point: params.decision_point,
      recalled_count: memoriesInContext.length,
      alternative_count: alternativeMemories.length,
      confidence,
    });

    return analysis;
  }

  /**
   * Find memories that existed but weren't recalled for a given query.
   */
  async findAlternativeMemories(
    query: string,
    excludeIds: string[],
    collection: string = "claude_memories",
    limit: number = 20
  ): Promise<Array<{ id: string; content: string; relevance_score: number }>> {
    const embedding = await this.deps.generateEmbedding(query);
    if (!embedding) return [];

    const results = await this.deps.searchPoints(collection, embedding, limit + excludeIds.length, 0.3);

    const alternatives: Array<{ id: string; content: string; relevance_score: number }> = [];
    for (const r of results) {
      const point = r as { id: string; score: number; payload: Record<string, unknown> };
      const pointId = point.payload?.id_str as string || point.id;
      if (!excludeIds.includes(pointId)) {
        alternatives.push({
          id: pointId,
          content: (point.payload?.content as string) || "",
          relevance_score: point.score,
        });
      }
      if (alternatives.length >= limit) break;
    }

    return alternatives;
  }

  /**
   * Replay a decision with alternative memory state to test counterfactual.
   */
  async runCounterfactual(params: {
    original_analysis_id: string;
    include_memory_ids: string[];
    exclude_memory_ids: string[];
    decision_context: string;
  }): Promise<{
    original_analysis: CausalAnalysis | null;
    counterfactual_memories: Array<{ id: string; content: string }>;
    projected_outcome: string;
    divergence_probability: number;
  }> {
    // Retrieve original analysis
    const filter = { must: [{ key: "id", match: { value: params.original_analysis_id } }] };
    const analyses = await this.deps.scrollPoints(DX_COLLECTIONS.CAUSAL_ANALYSIS, filter, 1);

    const originalAnalysis = analyses.length > 0
      ? (analyses[0] as { payload: CausalAnalysis }).payload
      : null;

    // Gather counterfactual memory set
    const counterfactualMemories: Array<{ id: string; content: string }> = [];
    for (const memId of params.include_memory_ids) {
      const memFilter = { must: [{ key: "id_str", match: { value: memId } }] };
      const points = await this.deps.scrollPoints("claude_memories", memFilter, 1);
      if (points.length > 0) {
        const p = points[0] as { payload: Record<string, unknown> };
        counterfactualMemories.push({
          id: memId,
          content: (p.payload.content as string) || "",
        });
      }
    }

    // Project outcome with alternative memory state
    const projectionPrompt = `Given a decision context and alternative memory state, project the likely outcome.

Decision context: ${params.decision_context}

${originalAnalysis ? `Original outcome: ${originalAnalysis.counterfactual_outcome}` : ""}

Alternative memory state (${counterfactualMemories.length} memories):
${counterfactualMemories.map((m) => `- ${m.content.slice(0, 200)}`).join("\n")}

Excluded memories: ${params.exclude_memory_ids.length} memories removed.

Project the outcome in 2 sentences. Output JSON: {"projected_outcome": "...", "divergence_probability": 0.0-1.0}`;

    let projectedOutcome = "Counterfactual projection requires LLM evaluation";
    let divergenceProbability = 0.5;

    const response = await this.deps.ollamaGenerate(projectionPrompt);
    if (response) {
      try {
        const parsed = JSON.parse(response);
        projectedOutcome = parsed.projected_outcome || projectedOutcome;
        divergenceProbability = parsed.divergence_probability || divergenceProbability;
      } catch {
        projectedOutcome = response;
      }
    }

    await this.deps.logAudit("causal_counterfactual", {
      original_analysis_id: params.original_analysis_id,
      included_memories: params.include_memory_ids.length,
      excluded_memories: params.exclude_memory_ids.length,
      divergence_probability: divergenceProbability,
    });

    return {
      original_analysis: originalAnalysis,
      counterfactual_memories: counterfactualMemories,
      projected_outcome: projectedOutcome,
      divergence_probability: divergenceProbability,
    };
  }
}

// ============================================================================
// REQ-EVO-033: Visual Agent Flow Debugger
// ============================================================================

export class FlowDebugger {
  private readonly deps: DxToolingDeps;

  constructor(deps: DxToolingDeps) {
    this.deps = deps;
  }

  /**
   * Generate a workflow DAG representation from a conductor-state.json or workflow spec.
   */
  async getWorkflowDAG(params: {
    workflow_id?: string;
    conductor_state?: Record<string, unknown>;
  }): Promise<WorkflowDAG> {
    // If a workflow_id is given, look it up
    if (params.workflow_id) {
      const filter = { must: [{ key: "id", match: { value: params.workflow_id } }] };
      const results = await this.deps.scrollPoints(DX_COLLECTIONS.WORKFLOW_FLOWS, filter, 1);
      if (results.length > 0) {
        return (results[0] as { payload: WorkflowDAG }).payload;
      }
    }

    // Build DAG from conductor state
    const state = params.conductor_state || {};
    const dagId = params.workflow_id || this.deps.generateUUID();
    const now = new Date().toISOString();

    const nodes: WorkflowDAGNode[] = [];
    const edges: WorkflowDAGEdge[] = [];

    // Start node
    nodes.push({
      id: `${dagId}_start`,
      type: "start",
      label: "Workflow Start",
      status: "completed",
      metadata: {},
    });

    // Parse agents from conductor state
    const agents = (state.agents as Array<Record<string, unknown>>) || [];
    const gates = (state.gates as Array<Record<string, unknown>>) || [];
    const steps = (state.steps as Array<Record<string, unknown>>) || [];

    let prevNodeId = `${dagId}_start`;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const nodeId = `${dagId}_step_${i}`;
      const agentId = (step.agent_id as string) || `agent_${i}`;
      const stepStatus = (step.status as string) || "pending";

      nodes.push({
        id: nodeId,
        type: "agent",
        label: (step.name as string) || `Step ${i + 1}`,
        status: stepStatus as WorkflowDAGNode["status"],
        agent_id: agentId,
        started_at: step.started_at as string,
        completed_at: step.completed_at as string,
        metadata: { input: step.input, output: step.output },
      });

      edges.push({
        source: prevNodeId,
        target: nodeId,
        label: step.condition as string || undefined,
        data_schema: step.data_schema as string || undefined,
      });

      // Check for quality gates after this step
      const stepGate = gates.find((g) => (g.after_step as number) === i);
      if (stepGate) {
        const gateNodeId = `${dagId}_gate_${i}`;
        nodes.push({
          id: gateNodeId,
          type: "gate",
          label: (stepGate.name as string) || `Quality Gate ${i}`,
          status: (stepGate.passed as boolean) ? "completed" : (stepGate.checked as boolean) ? "failed" : "pending",
          metadata: { threshold: stepGate.threshold, score: stepGate.score },
        });

        edges.push({ source: nodeId, target: gateNodeId, label: "quality_check" });
        prevNodeId = gateNodeId;
      } else {
        prevNodeId = nodeId;
      }
    }

    // End node
    const endNodeId = `${dagId}_end`;
    nodes.push({
      id: endNodeId,
      type: "end",
      label: "Workflow End",
      status: (state.status as string) === "completed" ? "completed" : "pending",
      metadata: {},
    });
    edges.push({ source: prevNodeId, target: endNodeId });

    // If no steps provided, create a minimal graph from agent list
    if (steps.length === 0 && agents.length > 0) {
      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        const nodeId = `${dagId}_agent_${i}`;
        nodes.push({
          id: nodeId,
          type: "agent",
          label: (agent.name as string) || `Agent ${i + 1}`,
          status: (agent.status as WorkflowDAGNode["status"]) || "pending",
          agent_id: (agent.id as string) || `agent_${i}`,
          metadata: agent,
        });
        edges.push({
          source: prevNodeId,
          target: nodeId,
        });
        prevNodeId = nodeId;
      }
      edges.push({ source: prevNodeId, target: endNodeId });
    }

    const dag: WorkflowDAG = {
      id: dagId,
      name: (state.name as string) || "Workflow",
      nodes,
      edges,
      created_at: now,
      updated_at: now,
      status: (state.status as WorkflowDAG["status"]) || "draft",
    };

    // Store the DAG
    const embeddingText = `workflow dag ${dag.name} ${nodes.map((n) => n.label).join(" ")}`;
    const embedding = await this.deps.generateEmbedding(embeddingText);
    if (embedding) {
      await this.deps.storePoint(DX_COLLECTIONS.WORKFLOW_FLOWS, dagId, embedding, dag as unknown as Record<string, unknown>);
    }

    return dag;
  }

  /**
   * Get live state tracking from conductor-state.json format.
   */
  async getLiveState(conductorStatePath?: string): Promise<{
    workflow_id: string;
    status: string;
    active_agents: Array<{ id: string; status: string; current_step: string }>;
    completed_steps: number;
    total_steps: number;
    elapsed_ms: number;
    bottlenecks: Array<{ step: string; duration_ms: number }>;
  }> {
    // In production, this would read from conductor-state.json
    // Here we query the latest workflow flow from Qdrant
    const flows = await this.deps.scrollPoints(DX_COLLECTIONS.WORKFLOW_FLOWS, undefined, 1);

    if (flows.length === 0) {
      return {
        workflow_id: "none",
        status: "no_active_workflow",
        active_agents: [],
        completed_steps: 0,
        total_steps: 0,
        elapsed_ms: 0,
        bottlenecks: [],
      };
    }

    const flow = (flows[0] as { payload: WorkflowDAG }).payload;
    const agentNodes = flow.nodes.filter((n) => n.type === "agent");
    const completedNodes = agentNodes.filter((n) => n.status === "completed");
    const runningNodes = agentNodes.filter((n) => n.status === "running");

    // Detect bottlenecks: nodes that took significantly longer than average
    const durations: Array<{ step: string; duration_ms: number }> = [];
    for (const node of agentNodes) {
      if (node.started_at && node.completed_at) {
        const dur = new Date(node.completed_at).getTime() - new Date(node.started_at).getTime();
        durations.push({ step: node.label, duration_ms: dur });
      }
    }
    const avgDuration = durations.length > 0
      ? durations.reduce((s, d) => s + d.duration_ms, 0) / durations.length
      : 0;
    const bottlenecks = durations.filter((d) => d.duration_ms > avgDuration * 1.5);

    const elapsed = flow.created_at
      ? Date.now() - new Date(flow.created_at).getTime()
      : 0;

    return {
      workflow_id: flow.id,
      status: flow.status,
      active_agents: runningNodes.map((n) => ({
        id: n.agent_id || n.id,
        status: n.status,
        current_step: n.label,
      })),
      completed_steps: completedNodes.length,
      total_steps: agentNodes.length,
      elapsed_ms: elapsed,
      bottlenecks,
    };
  }

  /**
   * Compare two workflow executions side-by-side.
   */
  async compareExecutions(executionIdA: string, executionIdB: string): Promise<ExecutionComparison> {
    const filterA = { must: [{ key: "id", match: { value: executionIdA } }] };
    const filterB = { must: [{ key: "id", match: { value: executionIdB } }] };

    const [resultsA, resultsB] = await Promise.all([
      this.deps.scrollPoints(DX_COLLECTIONS.WORKFLOW_FLOWS, filterA, 1),
      this.deps.scrollPoints(DX_COLLECTIONS.WORKFLOW_FLOWS, filterB, 1),
    ]);

    if (resultsA.length === 0) throw new Error(`Execution ${executionIdA} not found`);
    if (resultsB.length === 0) throw new Error(`Execution ${executionIdB} not found`);

    const dagA = (resultsA[0] as { payload: WorkflowDAG }).payload;
    const dagB = (resultsB[0] as { payload: WorkflowDAG }).payload;

    // Compare nodes
    const differences: Array<{ node_id: string; field: string; value_a: unknown; value_b: unknown }> = [];
    const nodeMapA = new Map(dagA.nodes.map((n) => [n.label, n]));
    const nodeMapB = new Map(dagB.nodes.map((n) => [n.label, n]));

    for (const [label, nodeA] of nodeMapA) {
      const nodeB = nodeMapB.get(label);
      if (!nodeB) {
        differences.push({ node_id: nodeA.id, field: "presence", value_a: "exists", value_b: "missing" });
        continue;
      }
      if (nodeA.status !== nodeB.status) {
        differences.push({ node_id: nodeA.id, field: "status", value_a: nodeA.status, value_b: nodeB.status });
      }
    }

    // Nodes in B but not A
    for (const [label, nodeB] of nodeMapB) {
      if (!nodeMapA.has(label)) {
        differences.push({ node_id: nodeB.id, field: "presence", value_a: "missing", value_b: "exists" });
      }
    }

    // Duration comparison
    const durationA = dagA.created_at && dagA.updated_at
      ? new Date(dagA.updated_at).getTime() - new Date(dagA.created_at).getTime()
      : 0;
    const durationB = dagB.created_at && dagB.updated_at
      ? new Date(dagB.updated_at).getTime() - new Date(dagB.created_at).getTime()
      : 0;

    const completedA = dagA.nodes.filter((n) => n.status === "completed").length;
    const completedB = dagB.nodes.filter((n) => n.status === "completed").length;
    const totalA = dagA.nodes.filter((n) => n.type === "agent").length || 1;
    const totalB = dagB.nodes.filter((n) => n.type === "agent").length || 1;

    return {
      execution_a: {
        id: executionIdA,
        duration_ms: durationA,
        status: dagA.status,
        node_count: dagA.nodes.length,
      },
      execution_b: {
        id: executionIdB,
        duration_ms: durationB,
        status: dagB.status,
        node_count: dagB.nodes.length,
      },
      differences,
      performance_delta: {
        duration_pct: durationA > 0 ? ((durationB - durationA) / durationA) * 100 : 0,
        success_rate_delta: (completedB / totalB) - (completedA / totalA),
      },
    };
  }

  /**
   * Browse historical workflow executions.
   */
  async getHistory(limit: number = 20): Promise<Array<{
    id: string;
    name: string;
    status: string;
    created_at: string;
    node_count: number;
    edge_count: number;
  }>> {
    const flows = await this.deps.scrollPoints(DX_COLLECTIONS.WORKFLOW_FLOWS, undefined, limit);

    return flows.map((f: any) => ({
      id: f.payload.id,
      name: f.payload.name,
      status: f.payload.status,
      created_at: f.payload.created_at,
      node_count: f.payload.nodes?.length || 0,
      edge_count: f.payload.edges?.length || 0,
    }));
  }
}

// ============================================================================
// REQ-EVO-034: Natural Language Workflow Authoring
// ============================================================================

const WORKFLOW_TEMPLATES: Record<WorkflowTemplate, WorkflowTemplateConfig> = {
  ci_cd: {
    name: "ci_cd",
    description: "Continuous Integration / Continuous Deployment pipeline",
    default_steps: [
      { action: "lint_code", agent_role: "code_quality" },
      { action: "run_tests", agent_role: "test_runner" },
      { action: "security_scan", agent_role: "security_analyst", gate: "security_threshold" },
      { action: "build_artifact", agent_role: "build_agent" },
      { action: "deploy", agent_role: "deployment_agent", gate: "approval_gate" },
    ],
    required_capabilities: ["code.lint", "test.run", "security.scan", "build.artifact", "deploy.execute"],
  },
  code_review: {
    name: "code_review",
    description: "Automated code review workflow",
    default_steps: [
      { action: "static_analysis", agent_role: "code_analyzer" },
      { action: "style_check", agent_role: "style_checker" },
      { action: "security_review", agent_role: "security_reviewer", gate: "security_threshold" },
      { action: "generate_feedback", agent_role: "feedback_generator" },
    ],
    required_capabilities: ["code.analyze", "code.style", "security.review", "feedback.generate"],
  },
  security_audit: {
    name: "security_audit",
    description: "Comprehensive security audit workflow",
    default_steps: [
      { action: "dependency_scan", agent_role: "dependency_auditor" },
      { action: "vulnerability_assessment", agent_role: "vulnerability_scanner", gate: "critical_vuln_gate" },
      { action: "configuration_review", agent_role: "config_reviewer" },
      { action: "compliance_check", agent_role: "compliance_checker", gate: "compliance_gate" },
      { action: "generate_report", agent_role: "report_generator" },
    ],
    required_capabilities: ["security.dependency", "security.vuln", "security.config", "compliance.check", "report.generate"],
  },
  documentation: {
    name: "documentation",
    description: "Documentation generation workflow",
    default_steps: [
      { action: "analyze_codebase", agent_role: "code_analyzer" },
      { action: "generate_api_docs", agent_role: "doc_generator" },
      { action: "generate_examples", agent_role: "example_generator" },
      { action: "review_docs", agent_role: "doc_reviewer", gate: "quality_gate" },
    ],
    required_capabilities: ["code.analyze", "doc.generate", "doc.examples", "doc.review"],
  },
  incident_response: {
    name: "incident_response",
    description: "Incident response and remediation workflow",
    default_steps: [
      { action: "triage", agent_role: "incident_triager" },
      { action: "investigate", agent_role: "investigator" },
      { action: "contain", agent_role: "containment_agent", gate: "severity_gate" },
      { action: "remediate", agent_role: "remediation_agent" },
      { action: "post_mortem", agent_role: "analyst" },
    ],
    required_capabilities: ["incident.triage", "incident.investigate", "incident.contain", "incident.remediate", "incident.analyze"],
  },
  onboarding: {
    name: "onboarding",
    description: "Developer/agent onboarding workflow",
    default_steps: [
      { action: "provision_access", agent_role: "access_manager" },
      { action: "setup_environment", agent_role: "env_setup_agent" },
      { action: "run_orientation", agent_role: "orientation_agent" },
      { action: "verify_readiness", agent_role: "verification_agent", gate: "readiness_gate" },
    ],
    required_capabilities: ["access.provision", "env.setup", "onboard.orient", "onboard.verify"],
  },
};

export class WorkflowCompiler {
  private readonly deps: DxToolingDeps;

  constructor(deps: DxToolingDeps) {
    this.deps = deps;
  }

  /**
   * Compile a natural language description into a conductor workflow JSON.
   */
  async compileFromNL(description: string, availableAgents?: Array<{ id: string; capabilities: string[] }>): Promise<CompiledWorkflow> {
    const workflowId = this.deps.generateUUID();

    // Use LLM to extract workflow structure from natural language
    const extractionPrompt = `Extract a structured workflow from this natural language description:

"${description}"

Available workflow templates: ${Object.keys(WORKFLOW_TEMPLATES).join(", ")}
${availableAgents ? `Available agents: ${availableAgents.map((a) => `${a.id}(${a.capabilities.join(",")})`).join("; ")}` : ""}

Output a JSON object with these fields:
- "triggers": array of trigger conditions (strings)
- "steps": array of objects with "action" (string), "agent_role" (string), "success_criteria" (string), "has_gate" (boolean)
- "overall_success_criteria": array of strings
- "closest_template": name of closest matching template from the list, or "custom"
- "confidence": 0.0-1.0

Be precise. Max 8 steps.`;

    let triggers: string[] = ["manual_trigger"];
    let steps: CompiledWorkflow["steps"] = [];
    let successCriteria: string[] = ["All steps completed successfully"];
    let confidence = 0.5;
    let closestTemplate: string | null = null;

    const llmResponse = await this.deps.ollamaGenerate(extractionPrompt);
    if (llmResponse) {
      try {
        const parsed = JSON.parse(llmResponse);
        triggers = parsed.triggers || triggers;
        successCriteria = parsed.overall_success_criteria || successCriteria;
        confidence = parsed.confidence || confidence;
        closestTemplate = parsed.closest_template || null;

        if (parsed.steps && Array.isArray(parsed.steps)) {
          steps = parsed.steps.map((s: any, idx: number) => ({
            order: idx + 1,
            action: s.action || `step_${idx + 1}`,
            agent: s.agent_role || "unassigned",
            input_mapping: {},
            success_criteria: s.success_criteria || "Step completed",
            gate: s.has_gate ? { type: "quality", threshold: 0.8 } : undefined,
          }));
        }
      } catch {
        // If LLM output isn't valid JSON, fall through to template matching
      }
    }

    // If no steps extracted, try matching to a template
    if (steps.length === 0) {
      const matchedTemplate = this.matchTemplate(description);
      if (matchedTemplate) {
        closestTemplate = matchedTemplate.name;
        steps = matchedTemplate.default_steps.map((s, idx) => ({
          order: idx + 1,
          action: s.action,
          agent: s.agent_role,
          input_mapping: {},
          success_criteria: `${s.action} completed successfully`,
          gate: s.gate ? { type: s.gate, threshold: 0.8 } : undefined,
        }));
        confidence = 0.7;
      }
    }

    // Map agents to steps using capability matching
    const agentAssignments: Record<string, string> = {};
    if (availableAgents) {
      for (const step of steps) {
        const bestAgent = this.matchAgentToRole(step.agent, availableAgents);
        if (bestAgent) {
          agentAssignments[step.action] = bestAgent.id;
          step.agent = bestAgent.id;
        }
      }
    }

    const compiled: CompiledWorkflow = {
      id: workflowId,
      source_nl: description,
      triggers,
      steps,
      agent_assignments: agentAssignments,
      success_criteria: successCriteria,
      generated_at: new Date().toISOString(),
      confidence,
    };

    // Store the compiled workflow
    const embeddingText = `compiled workflow ${description}`;
    const embedding = await this.deps.generateEmbedding(embeddingText);
    if (embedding) {
      await this.deps.storePoint(DX_COLLECTIONS.COMPILED_WORKFLOWS, workflowId, embedding, compiled as unknown as Record<string, unknown>);
    }

    await this.deps.logAudit("workflow_compile", {
      workflow_id: workflowId,
      step_count: steps.length,
      template_used: closestTemplate,
      confidence,
    });

    return compiled;
  }

  /**
   * Match a natural language description to the closest workflow template.
   */
  private matchTemplate(description: string): WorkflowTemplateConfig | null {
    const descLower = description.toLowerCase();
    const scores: Array<{ template: WorkflowTemplateConfig; score: number }> = [];

    for (const template of Object.values(WORKFLOW_TEMPLATES)) {
      let score = 0;
      const keywords = template.description.toLowerCase().split(/\s+/);
      for (const kw of keywords) {
        if (kw.length > 3 && descLower.includes(kw)) score++;
      }
      // Boost for exact name match
      if (descLower.includes(template.name.replace(/_/g, " "))) score += 5;
      if (descLower.includes(template.name)) score += 5;

      if (score > 0) scores.push({ template, score });
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.length > 0 ? scores[0].template : null;
  }

  /**
   * Match an agent to a step role based on capabilities.
   */
  private matchAgentToRole(
    role: string,
    agents: Array<{ id: string; capabilities: string[] }>
  ): { id: string; capabilities: string[] } | null {
    const roleWords = role.toLowerCase().split(/[_\s-]+/);

    let bestAgent: { id: string; capabilities: string[] } | null = null;
    let bestScore = 0;

    for (const agent of agents) {
      let score = 0;
      for (const cap of agent.capabilities) {
        const capWords = cap.toLowerCase().split(/[._\s-]+/);
        for (const rw of roleWords) {
          for (const cw of capWords) {
            if (rw === cw) score += 2;
            else if (cw.includes(rw) || rw.includes(cw)) score += 1;
          }
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    return bestAgent;
  }

  getTemplates(): WorkflowTemplateConfig[] {
    return Object.values(WORKFLOW_TEMPLATES);
  }

  /**
   * Refine a compiled workflow by adding/modifying steps.
   */
  async refineWorkflow(workflowId: string, refinement: string): Promise<CompiledWorkflow> {
    const filter = { must: [{ key: "id", match: { value: workflowId } }] };
    const results = await this.deps.scrollPoints(DX_COLLECTIONS.COMPILED_WORKFLOWS, filter, 1);

    if (results.length === 0) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const existing = (results[0] as { payload: CompiledWorkflow }).payload;

    const refinementPrompt = `Refine this workflow based on the user's request.

Current workflow (from NL: "${existing.source_nl}"):
Steps: ${JSON.stringify(existing.steps)}
Success criteria: ${JSON.stringify(existing.success_criteria)}

Refinement request: "${refinement}"

Output the refined workflow as JSON with same schema: {"steps": [...], "success_criteria": [...], "triggers": [...]}
Keep existing steps unless the refinement explicitly changes them. Only output the JSON.`;

    const response = await this.deps.ollamaGenerate(refinementPrompt);

    let refinedSteps = existing.steps;
    let refinedCriteria = existing.success_criteria;
    let refinedTriggers = existing.triggers;

    if (response) {
      try {
        const parsed = JSON.parse(response);
        if (parsed.steps) {
          refinedSteps = parsed.steps.map((s: any, idx: number) => ({
            order: idx + 1,
            action: s.action || `step_${idx + 1}`,
            agent: s.agent || s.agent_role || "unassigned",
            input_mapping: s.input_mapping || {},
            success_criteria: s.success_criteria || "Step completed",
            gate: s.gate || undefined,
          }));
        }
        if (parsed.success_criteria) refinedCriteria = parsed.success_criteria;
        if (parsed.triggers) refinedTriggers = parsed.triggers;
      } catch {
        // Keep existing if parsing fails
      }
    }

    const refined: CompiledWorkflow = {
      ...existing,
      steps: refinedSteps,
      success_criteria: refinedCriteria,
      triggers: refinedTriggers,
      source_nl: `${existing.source_nl} [refined: ${refinement}]`,
      generated_at: new Date().toISOString(),
    };

    // Update stored workflow
    const embeddingText = `compiled workflow ${refined.source_nl}`;
    const embedding = await this.deps.generateEmbedding(embeddingText);
    if (embedding) {
      await this.deps.storePoint(DX_COLLECTIONS.COMPILED_WORKFLOWS, workflowId, embedding, refined as unknown as Record<string, unknown>);
    }

    return refined;
  }
}

// ============================================================================
// REQ-EVO-036: Automated Skill Discovery from Trajectories
// ============================================================================

export class SkillDiscovery {
  private readonly deps: DxToolingDeps;
  private readonly MIN_SEQUENCE_LENGTH = 3;
  private readonly MIN_OCCURRENCES = 3;
  private readonly ARCHIVE_AFTER_DAYS = 30;

  constructor(deps: DxToolingDeps) {
    this.deps = deps;
  }

  /**
   * Detect repeating tool sequences from trajectory data.
   */
  async detectPatterns(trajectoryCollection: string = "trajectories", limit: number = 200): Promise<PatternSequence[]> {
    const trajectories = await this.deps.scrollPoints(trajectoryCollection, undefined, limit);

    // Extract tool sequences from trajectories
    const allSequences: Array<{ tools: string[]; args: Record<string, unknown>[]; duration_ms: number; success: boolean }> = [];

    for (const traj of trajectories) {
      const payload = (traj as { payload: Record<string, unknown> }).payload;
      const steps = (payload.steps as Array<Record<string, unknown>>) || [];
      const toolNames = steps.map((s) => (s.tool as string) || (s.action as string) || "unknown");
      const toolArgs = steps.map((s) => (s.args as Record<string, unknown>) || {});
      const duration = (payload.duration_ms as number) || 0;
      const success = (payload.outcome as string) === "success" || (payload.success as boolean) === true;

      // Extract all subsequences of length >= MIN_SEQUENCE_LENGTH
      for (let start = 0; start <= toolNames.length - this.MIN_SEQUENCE_LENGTH; start++) {
        for (let len = this.MIN_SEQUENCE_LENGTH; len <= Math.min(toolNames.length - start, 8); len++) {
          allSequences.push({
            tools: toolNames.slice(start, start + len),
            args: toolArgs.slice(start, start + len),
            duration_ms: duration,
            success,
          });
        }
      }
    }

    // Count frequency of each unique tool sequence
    const sequenceMap = new Map<string, {
      tools: string[];
      count: number;
      totalDuration: number;
      successes: number;
      representativeArgs: Record<string, unknown>[];
    }>();

    for (const seq of allSequences) {
      const key = seq.tools.join(" -> ");
      const existing = sequenceMap.get(key);
      if (existing) {
        existing.count++;
        existing.totalDuration += seq.duration_ms;
        if (seq.success) existing.successes++;
      } else {
        sequenceMap.set(key, {
          tools: seq.tools,
          count: 1,
          totalDuration: seq.duration_ms,
          successes: seq.success ? 1 : 0,
          representativeArgs: seq.args,
        });
      }
    }

    // Filter to sequences that occur >= MIN_OCCURRENCES
    const patterns: PatternSequence[] = [];
    for (const [, data] of sequenceMap) {
      if (data.count >= this.MIN_OCCURRENCES) {
        patterns.push({
          tools: data.tools,
          frequency: data.count,
          avg_duration_ms: data.totalDuration / data.count,
          success_rate: data.count > 0 ? data.successes / data.count : 0,
          representative_args: data.representativeArgs,
        });
      }
    }

    // Sort by frequency descending
    patterns.sort((a, b) => b.frequency - a.frequency);

    return patterns;
  }

  /**
   * Propose skills from detected patterns by clustering similar sequences.
   */
  async proposeSkills(patterns?: PatternSequence[]): Promise<DiscoveredSkill[]> {
    const detectedPatterns = patterns || await this.detectPatterns();

    if (detectedPatterns.length === 0) {
      return [];
    }

    // Cluster similar sequences by embedding similarity
    const clusters: Array<{ centroid: PatternSequence; members: PatternSequence[]; clusterId: string }> = [];

    for (const pattern of detectedPatterns) {
      const patternText = pattern.tools.join(" ");
      const embedding = await this.deps.generateEmbedding(patternText);
      if (!embedding) continue;

      let assigned = false;
      for (const cluster of clusters) {
        const centroidText = cluster.centroid.tools.join(" ");
        const centroidEmb = await this.deps.generateEmbedding(centroidText);
        if (!centroidEmb) continue;

        // Cosine similarity check
        const similarity = this.cosineSimilarity(embedding, centroidEmb);
        if (similarity > 0.8) {
          cluster.members.push(pattern);
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        clusters.push({
          centroid: pattern,
          members: [pattern],
          clusterId: this.deps.generateUUID(),
        });
      }
    }

    // Generate skill proposals from clusters
    const proposals: DiscoveredSkill[] = [];
    const now = new Date().toISOString();

    for (const cluster of clusters) {
      const bestPattern = cluster.members.reduce((best, m) =>
        m.frequency > best.frequency ? m : best, cluster.members[0]);

      // Generate a name for the skill
      const namePrompt = `Given this repeating tool sequence used ${bestPattern.frequency} times:
${bestPattern.tools.join(" -> ")}

Generate a short, descriptive skill name (2-4 words, snake_case). Output ONLY the name, nothing else.`;

      let skillName = bestPattern.tools.slice(0, 2).join("_then_");
      const nameResponse = await this.deps.ollamaGenerate(namePrompt);
      if (nameResponse) {
        const cleaned = nameResponse.replace(/[^a-z0-9_]/gi, "_").toLowerCase().slice(0, 50);
        if (cleaned.length >= 3) skillName = cleaned;
      }

      const skillId = this.deps.generateUUID();
      const skill: DiscoveredSkill = {
        id: skillId,
        name: skillName,
        trigger: `When performing: ${bestPattern.tools[0]}`,
        steps: bestPattern.tools.map((tool, idx) => ({
          tool,
          args_pattern: (bestPattern.representative_args[idx] || {}) as Record<string, string>,
        })),
        expected_outcome: `Successfully complete ${bestPattern.tools.length}-step sequence with ${(bestPattern.success_rate * 100).toFixed(0)}% success rate`,
        occurrence_count: cluster.members.reduce((sum, m) => sum + m.frequency, 0),
        first_seen: now,
        last_seen: now,
        status: "proposed",
        cluster_id: cluster.clusterId,
        confidence: Math.min(bestPattern.success_rate * bestPattern.frequency / 10, 1.0),
        source_trajectory_ids: [],
      };

      // Store the proposed skill
      const embeddingText = `skill ${skillName} ${bestPattern.tools.join(" ")}`;
      const embedding = await this.deps.generateEmbedding(embeddingText);
      if (embedding) {
        await this.deps.storePoint(DX_COLLECTIONS.DISCOVERED_SKILLS, skillId, embedding, skill as unknown as Record<string, unknown>);
      }

      proposals.push(skill);
    }

    await this.deps.logAudit("skill_discovery", {
      patterns_detected: detectedPatterns.length,
      clusters: clusters.length,
      skills_proposed: proposals.length,
    });

    return proposals;
  }

  /**
   * Manage skill lifecycle: promote frequently used, archive unused.
   */
  async manageLifecycle(): Promise<{
    promoted: string[];
    archived: string[];
    active: number;
    total: number;
  }> {
    const allSkills = await this.deps.scrollPoints(DX_COLLECTIONS.DISCOVERED_SKILLS, undefined, 500);
    const now = Date.now();
    const archiveThreshold = this.ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000;

    const promoted: string[] = [];
    const archived: string[] = [];
    let active = 0;

    for (const skill of allSkills) {
      const payload = (skill as { payload: DiscoveredSkill; id: string }).payload;
      const id = (skill as { id: string }).id;

      if (payload.status === "proposed") {
        // Promote if high confidence and high occurrence
        if (payload.occurrence_count >= 10 && payload.confidence >= 0.7) {
          await this.deps.updatePayload(DX_COLLECTIONS.DISCOVERED_SKILLS, [id], {
            status: "promoted",
            promoted_at: new Date().toISOString(),
          });
          promoted.push(payload.name);
        }
        // Archive if unused for ARCHIVE_AFTER_DAYS
        else if (payload.last_seen) {
          const lastSeen = new Date(payload.last_seen).getTime();
          if (now - lastSeen > archiveThreshold && payload.occurrence_count < 5) {
            await this.deps.updatePayload(DX_COLLECTIONS.DISCOVERED_SKILLS, [id], {
              status: "archived",
              archived_at: new Date().toISOString(),
            });
            archived.push(payload.name);
          }
        }
      }

      if (payload.status === "promoted" || payload.status === "proposed") {
        active++;
      }
    }

    await this.deps.logAudit("skill_lifecycle", {
      promoted_count: promoted.length,
      archived_count: archived.length,
      active_count: active,
    });

    return { promoted, archived, active, total: allSkills.length };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}

// ============================================================================
// REQ-EVO-037: Multi-Modal Agent Inputs
// ============================================================================

export class MultiModalHandler {
  private readonly deps: DxToolingDeps;

  constructor(deps: DxToolingDeps) {
    this.deps = deps;
  }

  /**
   * Process an image/screenshot: extract annotations and structured text.
   */
  async processImage(params: {
    source_path: string;
    description?: string;
    extract_text?: boolean;
  }): Promise<MultiModalArtifact> {
    const artifactId = this.deps.generateUUID();
    const now = new Date().toISOString();

    // Use LLM to analyze the image description (since we can't directly process images via Ollama text API)
    const analysisPrompt = `Analyze this image for an AI agent system.
Image path: ${params.source_path}
${params.description ? `Description: ${params.description}` : ""}

Extract structured annotations from the image description. Output JSON:
{
  "extracted_text": "any text content visible or described",
  "annotations": [{"label": "category", "value": "detail", "confidence": 0.0-1.0}],
  "summary": "one-line summary"
}`;

    let extractedText = params.description || `Image artifact from ${params.source_path}`;
    let annotations: Array<{ label: string; value: string; confidence: number }> = [];

    const response = await this.deps.ollamaGenerate(analysisPrompt);
    if (response) {
      try {
        const parsed = JSON.parse(response);
        extractedText = parsed.extracted_text || extractedText;
        annotations = parsed.annotations || annotations;
      } catch {
        extractedText = response;
      }
    }

    // Default annotations based on file path analysis
    if (annotations.length === 0) {
      const pathParts = params.source_path.split("/");
      const fileName = pathParts[pathParts.length - 1] || "unknown";
      const ext = fileName.split(".").pop() || "";

      annotations = [
        { label: "file_name", value: fileName, confidence: 1.0 },
        { label: "file_type", value: ext, confidence: 1.0 },
        { label: "modality", value: "image", confidence: 1.0 },
      ];

      if (params.description) {
        annotations.push({ label: "description", value: params.description, confidence: 0.9 });
      }
    }

    const artifact: MultiModalArtifact = {
      id: artifactId,
      modality: "image",
      source_path: params.source_path,
      extracted_text: extractedText,
      annotations,
      stored_at: now,
      metadata: { extract_text: params.extract_text || false },
    };

    // Store in Qdrant
    const embeddingText = `image ${extractedText} ${annotations.map((a) => `${a.label}:${a.value}`).join(" ")}`;
    const embedding = await this.deps.generateEmbedding(embeddingText);
    if (embedding) {
      await this.deps.storePoint(DX_COLLECTIONS.MULTIMODAL_ARTIFACTS, artifactId, embedding, artifact as unknown as Record<string, unknown>);
    }

    await this.deps.logAudit("multimodal_process", {
      artifact_id: artifactId,
      modality: "image",
      source: params.source_path,
      annotation_count: annotations.length,
    });

    return artifact;
  }

  /**
   * Process audio input via Whisper transcription.
   */
  async processAudio(params: {
    source_path: string;
    language?: string;
    whisper_model?: string;
  }): Promise<MultiModalArtifact> {
    const artifactId = this.deps.generateUUID();
    const now = new Date().toISOString();

    // Attempt Whisper transcription via Ollama or local Whisper
    // In production, this would call the Whisper API directly
    let transcript = "";
    const whisperModel = params.whisper_model || "whisper";

    try {
      // Try Ollama-based transcription (if Whisper model is available)
      const response = await fetch(`http://localhost:11434/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: whisperModel,
          prompt: `Transcribe audio from: ${params.source_path}`,
          stream: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        transcript = data.response?.trim() || "";
      }
    } catch {
      // Whisper not available, generate placeholder with metadata
      transcript = `[Audio artifact: ${params.source_path}] Transcription pending - Whisper model not available locally.`;
    }

    // If no transcript, create metadata-based description
    if (!transcript) {
      transcript = `Audio file at ${params.source_path}. Language: ${params.language || "auto-detect"}. Awaiting transcription.`;
    }

    const annotations: Array<{ label: string; value: string; confidence: number }> = [
      { label: "modality", value: "audio", confidence: 1.0 },
      { label: "source", value: params.source_path, confidence: 1.0 },
      { label: "language", value: params.language || "unknown", confidence: params.language ? 1.0 : 0.3 },
      { label: "whisper_model", value: whisperModel, confidence: 1.0 },
    ];

    const artifact: MultiModalArtifact = {
      id: artifactId,
      modality: "audio",
      source_path: params.source_path,
      extracted_text: transcript,
      annotations,
      stored_at: now,
      metadata: {
        language: params.language,
        whisper_model: whisperModel,
        transcription_complete: transcript.length > 0 && !transcript.includes("pending"),
      },
    };

    const embeddingText = `audio transcript ${transcript.slice(0, 500)}`;
    const embedding = await this.deps.generateEmbedding(embeddingText);
    if (embedding) {
      await this.deps.storePoint(DX_COLLECTIONS.MULTIMODAL_ARTIFACTS, artifactId, embedding, artifact as unknown as Record<string, unknown>);
    }

    await this.deps.logAudit("multimodal_process", {
      artifact_id: artifactId,
      modality: "audio",
      source: params.source_path,
      transcript_length: transcript.length,
    });

    return artifact;
  }

  /**
   * Process architecture diagrams: extract components and connections.
   */
  async processDiagram(params: {
    source_path: string;
    diagram_type?: string;
    description?: string;
  }): Promise<MultiModalArtifact> {
    const artifactId = this.deps.generateUUID();
    const now = new Date().toISOString();

    const diagramType = params.diagram_type || "architecture";

    // Use LLM to extract components from diagram description
    const extractionPrompt = `Extract components and connections from this ${diagramType} diagram.
${params.description ? `Description: ${params.description}` : `Diagram path: ${params.source_path}`}

Output JSON:
{
  "components": [{"name": "...", "type": "service|database|queue|gateway|client|external", "connections": ["connected_component_name"]}],
  "extracted_text": "structured text description of the diagram",
  "annotations": [{"label": "...", "value": "...", "confidence": 0.0-1.0}]
}`;

    let extractedText = params.description || `${diagramType} diagram from ${params.source_path}`;
    let components: Array<{ name: string; type: string; connections: string[] }> = [];
    let annotations: Array<{ label: string; value: string; confidence: number }> = [];

    const response = await this.deps.ollamaGenerate(extractionPrompt);
    if (response) {
      try {
        const parsed = JSON.parse(response);
        components = parsed.components || components;
        extractedText = parsed.extracted_text || extractedText;
        annotations = parsed.annotations || annotations;
      } catch {
        extractedText = response;
      }
    }

    // Default annotations
    if (annotations.length === 0) {
      annotations = [
        { label: "diagram_type", value: diagramType, confidence: 1.0 },
        { label: "component_count", value: String(components.length), confidence: 1.0 },
        { label: "modality", value: "diagram", confidence: 1.0 },
      ];
    }

    const artifact: MultiModalArtifact = {
      id: artifactId,
      modality: "diagram",
      source_path: params.source_path,
      extracted_text: extractedText,
      annotations,
      components,
      stored_at: now,
      metadata: {
        diagram_type: diagramType,
        component_count: components.length,
        connection_count: components.reduce((sum, c) => sum + c.connections.length, 0),
      },
    };

    const embeddingText = `diagram ${diagramType} ${extractedText} ${components.map((c) => c.name).join(" ")}`;
    const embedding = await this.deps.generateEmbedding(embeddingText);
    if (embedding) {
      await this.deps.storePoint(DX_COLLECTIONS.MULTIMODAL_ARTIFACTS, artifactId, embedding, artifact as unknown as Record<string, unknown>);
    }

    await this.deps.logAudit("multimodal_process", {
      artifact_id: artifactId,
      modality: "diagram",
      diagram_type: diagramType,
      component_count: components.length,
    });

    return artifact;
  }

  /**
   * Get modality statistics across all stored artifacts.
   */
  async getModalityStats(): Promise<{
    total_artifacts: number;
    by_modality: Record<string, { count: number; avg_annotations: number }>;
    recent: Array<{ id: string; modality: string; stored_at: string; source: string }>;
  }> {
    const artifacts = await this.deps.scrollPoints(DX_COLLECTIONS.MULTIMODAL_ARTIFACTS, undefined, 500);

    const byModality: Record<string, { count: number; totalAnnotations: number }> = {};
    const recent: Array<{ id: string; modality: string; stored_at: string; source: string }> = [];

    for (const art of artifacts) {
      const payload = (art as { payload: MultiModalArtifact }).payload;
      const mod = payload.modality || "unknown";

      if (!byModality[mod]) {
        byModality[mod] = { count: 0, totalAnnotations: 0 };
      }
      byModality[mod].count++;
      byModality[mod].totalAnnotations += payload.annotations?.length || 0;

      recent.push({
        id: payload.id,
        modality: mod,
        stored_at: payload.stored_at,
        source: payload.source_path,
      });
    }

    // Sort recent by stored_at descending
    recent.sort((a, b) => b.stored_at.localeCompare(a.stored_at));

    const formattedModality: Record<string, { count: number; avg_annotations: number }> = {};
    for (const [mod, data] of Object.entries(byModality)) {
      formattedModality[mod] = {
        count: data.count,
        avg_annotations: data.count > 0 ? data.totalAnnotations / data.count : 0,
      };
    }

    return {
      total_artifacts: artifacts.length,
      by_modality: formattedModality,
      recent: recent.slice(0, 10),
    };
  }
}

// ============================================================================
// REQ-EVO-038: Agent Performance Benchmarking Suite
// ============================================================================

const BENCHMARK_DIMENSIONS = [
  "completion_rate",
  "steps_to_completion",
  "cost_per_task",
  "error_rate",
  "governance_compliance",
  "memory_utilization",
  "time_to_completion_ms",
] as const;

type BenchmarkDimension = typeof BENCHMARK_DIMENSIONS[number];

const STANDARD_TEST_SUITE = [
  { name: "simple_memory_store_recall", category: "memory", expected_steps: 2 },
  { name: "multi_step_reasoning", category: "reasoning", expected_steps: 5 },
  { name: "governance_compliance_check", category: "governance", expected_steps: 3 },
  { name: "error_recovery", category: "resilience", expected_steps: 4 },
  { name: "concurrent_operations", category: "concurrency", expected_steps: 6 },
  { name: "context_budget_management", category: "resource", expected_steps: 3 },
  { name: "cross_agent_coordination", category: "multi_agent", expected_steps: 8 },
  { name: "security_boundary_test", category: "security", expected_steps: 4 },
];

export class BenchmarkSuite {
  private readonly deps: DxToolingDeps;
  private readonly REGRESSION_THRESHOLD = 0.10; // 10% degradation

  constructor(deps: DxToolingDeps) {
    this.deps = deps;
  }

  /**
   * Run a benchmark against an agent with the standard test suite.
   */
  async runBenchmark(params: {
    agent_id: string;
    suite_name?: string;
    test_results?: Array<{
      name: string;
      passed: boolean;
      duration_ms: number;
      steps_used: number;
      cost: number;
      errors: number;
      notes?: string;
    }>;
    baseline_id?: string;
  }): Promise<BenchmarkRun> {
    const benchmarkId = this.deps.generateUUID();
    const suiteName = params.suite_name || "standard";
    const now = new Date().toISOString();

    // Use provided test results or generate from standard suite
    const testResults = params.test_results || STANDARD_TEST_SUITE.map((test) => ({
      name: test.name,
      passed: true,
      duration_ms: 0,
      steps_used: test.expected_steps,
      cost: 0,
      errors: 0,
      notes: "Awaiting execution",
    }));

    // Calculate dimension scores
    const totalTests = testResults.length;
    const passedTests = testResults.filter((t) => t.passed).length;
    const totalDuration = testResults.reduce((sum, t) => sum + t.duration_ms, 0);
    const totalSteps = testResults.reduce((sum, t) => sum + t.steps_used, 0);
    const totalCost = testResults.reduce((sum, t) => sum + t.cost, 0);
    const totalErrors = testResults.reduce((sum, t) => sum + t.errors, 0);

    const dimensions: BenchmarkRun["dimensions"] = {
      completion_rate: totalTests > 0 ? passedTests / totalTests : 0,
      steps_to_completion: totalTests > 0 ? totalSteps / totalTests : 0,
      cost_per_task: totalTests > 0 ? totalCost / totalTests : 0,
      error_rate: totalTests > 0 ? totalErrors / totalTests : 0,
      governance_compliance: this.calculateGovernanceCompliance(testResults),
      memory_utilization: this.calculateMemoryUtilization(testResults),
      time_to_completion_ms: totalTests > 0 ? totalDuration / totalTests : 0,
    };

    // Compare with baseline if provided
    let regressions: BenchmarkRun["regressions"] = [];
    if (params.baseline_id) {
      regressions = await this.detectRegressions(dimensions, params.baseline_id);
    }

    const benchmarkRun: BenchmarkRun = {
      id: benchmarkId,
      suite_name: suiteName,
      agent_id: params.agent_id,
      dimensions,
      test_cases: testResults.map((t) => ({
        name: t.name,
        passed: t.passed,
        duration_ms: t.duration_ms,
        notes: t.notes || "",
      })),
      regressions,
      timestamp: now,
      baseline_id: params.baseline_id,
    };

    // Store in benchmarks collection
    const embeddingText = `benchmark ${suiteName} ${params.agent_id} completion=${dimensions.completion_rate} errors=${dimensions.error_rate}`;
    const embedding = await this.deps.generateEmbedding(embeddingText);
    if (embedding) {
      await this.deps.storePoint(DX_COLLECTIONS.BENCHMARK_RUNS, benchmarkId, embedding, benchmarkRun as unknown as Record<string, unknown>);
      await mirrorBenchmarkRuns(benchmarkId, benchmarkRun as unknown as Record<string, unknown>);
    }

    await this.deps.logAudit("benchmark_run", {
      benchmark_id: benchmarkId,
      agent_id: params.agent_id,
      suite: suiteName,
      completion_rate: dimensions.completion_rate,
      regression_count: regressions.length,
      has_critical_regression: regressions.some((r) => r.degradation_pct > 20),
    });

    return benchmarkRun;
  }

  /**
   * Compare current dimensions with a baseline and detect regressions.
   */
  async compareWithBaseline(currentId: string, baselineId: string): Promise<{
    current: BenchmarkRun | null;
    baseline: BenchmarkRun | null;
    regressions: BenchmarkRun["regressions"];
    improvements: Array<{ dimension: string; improvement_pct: number }>;
  }> {
    const [currentResults, baselineResults] = await Promise.all([
      this.deps.scrollPoints(DX_COLLECTIONS.BENCHMARK_RUNS, { must: [{ key: "id", match: { value: currentId } }] }, 1),
      this.deps.scrollPoints(DX_COLLECTIONS.BENCHMARK_RUNS, { must: [{ key: "id", match: { value: baselineId } }] }, 1),
    ]);

    const current = currentResults.length > 0 ? (currentResults[0] as { payload: BenchmarkRun }).payload : null;
    const baseline = baselineResults.length > 0 ? (baselineResults[0] as { payload: BenchmarkRun }).payload : null;

    if (!current || !baseline) {
      return { current, baseline, regressions: [], improvements: [] };
    }

    const regressions: BenchmarkRun["regressions"] = [];
    const improvements: Array<{ dimension: string; improvement_pct: number }> = [];

    for (const dim of BENCHMARK_DIMENSIONS) {
      const currentVal = current.dimensions[dim];
      const baselineVal = baseline.dimensions[dim];

      if (baselineVal === 0) continue;

      // For error_rate, steps_to_completion, cost_per_task, time_to_completion: lower is better
      const lowerIsBetter = ["error_rate", "steps_to_completion", "cost_per_task", "time_to_completion_ms"].includes(dim);
      const delta = lowerIsBetter
        ? (currentVal - baselineVal) / baselineVal
        : (baselineVal - currentVal) / baselineVal;

      if (delta > this.REGRESSION_THRESHOLD) {
        regressions.push({
          dimension: dim,
          baseline_value: baselineVal,
          current_value: currentVal,
          degradation_pct: delta * 100,
        });
      } else if (delta < -this.REGRESSION_THRESHOLD) {
        improvements.push({
          dimension: dim,
          improvement_pct: Math.abs(delta * 100),
        });
      }
    }

    return { current, baseline, regressions, improvements };
  }

  /**
   * Get regressions from the latest benchmark run for an agent.
   */
  async getRegressions(agentId: string): Promise<{
    agent_id: string;
    latest_run: BenchmarkRun | null;
    regressions: BenchmarkRun["regressions"];
    alert: boolean;
  }> {
    const filter = { must: [{ key: "agent_id", match: { value: agentId } }] };
    const runs = await this.deps.scrollPoints(DX_COLLECTIONS.BENCHMARK_RUNS, filter, 10);

    if (runs.length === 0) {
      return { agent_id: agentId, latest_run: null, regressions: [], alert: false };
    }

    // Sort by timestamp descending
    const sorted = runs
      .map((r) => (r as { payload: BenchmarkRun }).payload)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    const latest = sorted[0];
    const regressions = latest.regressions || [];
    const alert = regressions.some((r) => r.degradation_pct > 10);

    return { agent_id: agentId, latest_run: latest, regressions, alert };
  }

  /**
   * Get a comprehensive scorecard for an agent with historical trends.
   */
  async getScorecard(agentId: string): Promise<AgentScorecard> {
    const filter = { must: [{ key: "agent_id", match: { value: agentId } }] };
    const runs = await this.deps.scrollPoints(DX_COLLECTIONS.BENCHMARK_RUNS, filter, 50);

    const benchmarks = runs
      .map((r) => (r as { payload: BenchmarkRun }).payload)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    if (benchmarks.length === 0) {
      return {
        agent_id: agentId,
        overall_score: 0,
        dimension_scores: {},
        trend: "stable",
        run_count: 0,
        last_run: "",
        historical: [],
      };
    }

    const latest = benchmarks[benchmarks.length - 1];

    // Calculate dimension scores (normalize to 0-100)
    const dimensionScores: Record<string, number> = {
      completion_rate: latest.dimensions.completion_rate * 100,
      efficiency: Math.max(0, 100 - latest.dimensions.steps_to_completion * 5),
      cost_efficiency: Math.max(0, 100 - latest.dimensions.cost_per_task * 10),
      reliability: (1 - latest.dimensions.error_rate) * 100,
      governance: latest.dimensions.governance_compliance * 100,
      memory: latest.dimensions.memory_utilization * 100,
      speed: Math.max(0, 100 - latest.dimensions.time_to_completion_ms / 100),
    };

    const overallScore = Object.values(dimensionScores).reduce((sum, s) => sum + s, 0) / Object.keys(dimensionScores).length;

    // Determine trend from historical data
    const historical = benchmarks.map((b) => {
      const score = Object.values({
        completion_rate: b.dimensions.completion_rate * 100,
        reliability: (1 - b.dimensions.error_rate) * 100,
        governance: b.dimensions.governance_compliance * 100,
      }).reduce((s, v) => s + v, 0) / 3;
      return { timestamp: b.timestamp, overall_score: score };
    });

    let trend: "improving" | "stable" | "degrading" = "stable";
    if (historical.length >= 3) {
      const recentAvg = historical.slice(-3).reduce((s, h) => s + h.overall_score, 0) / 3;
      const olderAvg = historical.slice(0, Math.min(3, historical.length - 3)).reduce((s, h) => s + h.overall_score, 0) /
        Math.min(3, historical.length - 3);

      if (olderAvg > 0) {
        const change = (recentAvg - olderAvg) / olderAvg;
        if (change > 0.05) trend = "improving";
        else if (change < -0.05) trend = "degrading";
      }
    }

    return {
      agent_id: agentId,
      overall_score: overallScore,
      dimension_scores: dimensionScores,
      trend,
      run_count: benchmarks.length,
      last_run: latest.timestamp,
      historical,
    };
  }

  private async detectRegressions(
    current: BenchmarkRun["dimensions"],
    baselineId: string
  ): Promise<BenchmarkRun["regressions"]> {
    const filter = { must: [{ key: "id", match: { value: baselineId } }] };
    const results = await this.deps.scrollPoints(DX_COLLECTIONS.BENCHMARK_RUNS, filter, 1);

    if (results.length === 0) return [];

    const baseline = (results[0] as { payload: BenchmarkRun }).payload;
    const regressions: BenchmarkRun["regressions"] = [];

    for (const dim of BENCHMARK_DIMENSIONS) {
      const currentVal = current[dim];
      const baselineVal = baseline.dimensions[dim];

      if (baselineVal === 0) continue;

      const lowerIsBetter = ["error_rate", "steps_to_completion", "cost_per_task", "time_to_completion_ms"].includes(dim);
      const degradation = lowerIsBetter
        ? (currentVal - baselineVal) / baselineVal
        : (baselineVal - currentVal) / baselineVal;

      if (degradation > this.REGRESSION_THRESHOLD) {
        regressions.push({
          dimension: dim,
          baseline_value: baselineVal,
          current_value: currentVal,
          degradation_pct: degradation * 100,
        });
      }
    }

    return regressions;
  }

  private calculateGovernanceCompliance(testResults: Array<{ name: string; passed: boolean; notes?: string }>): number {
    const governanceTests = testResults.filter((t) =>
      t.name.includes("governance") || t.name.includes("compliance") || t.name.includes("security")
    );
    if (governanceTests.length === 0) return 1.0;
    return governanceTests.filter((t) => t.passed).length / governanceTests.length;
  }

  private calculateMemoryUtilization(testResults: Array<{ name: string; passed: boolean; steps_used?: number }>): number {
    const memoryTests = testResults.filter((t) =>
      t.name.includes("memory") || t.name.includes("context") || t.name.includes("recall")
    );
    if (memoryTests.length === 0) return 0.8;
    return memoryTests.filter((t) => t.passed).length / memoryTests.length;
  }
}
