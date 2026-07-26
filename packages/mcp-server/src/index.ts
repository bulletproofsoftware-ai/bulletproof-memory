#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { graphStore, graphQuery, graphTraverse, graphNeighbors, graphPath, graphTimeTravel } from "./graph-tools.js";
import { stigmergyDeposit, stigmergySense, stigmergyDecay } from "./stigmergy-tools.js";
import { createHash, timingSafeEqual, randomBytes, randomUUID } from "crypto";
import { createServer } from "http";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

// REQ-EVO-014: ISO 42001 Compliance Automation
import {
  generateComplianceReport,
  buildCSV,
  buildMarkdown,
  ISO42001_CONTROLS,
  type AuditEvent,
  type ComplianceReport,
} from "./iso42001.js";

// REQ-EVO-013: Proof-of-Guardrail Attestation
import {
  initGuardrailProofs,
  type GuardrailProofEngine,
  type PolicyDecision,
} from "./guardrail-proofs.js";

// REQ-EVO-015: PQC-Native Agent Identity
import {
  AgentIdentityManager,
  IDENTITY_COLLECTIONS,
  type AgentIdentity,
  type DelegationToken,
} from "./agent-identity.js";

// REQ-EVO-016: Non-Human Identity Lifecycle Manager
import {
  NHILifecycleManager,
  NHI_COLLECTIONS,
  NHIState,
  type NHIRecord,
} from "./nhi-lifecycle.js";

// REQ-EVO-017: Real-Time Constitutional Monitor Agent
import {
  ConstitutionalMonitor,
  MONITOR_COLLECTIONS,
  type MonitorAssessment,
  type DriftVerdict,
} from "./constitutional-monitor.js";

// REQ-EVO-031: Time-Travel Debugging
import {
  TimeTravelDebugger,
  TIME_TRAVEL_COLLECTIONS,
  type SessionRecording,
  type ReplayState,
  type RecordedToolCall,
} from "./time-travel-debug.js";

// REQ-EVO-012: Formal Verification Pipeline
import {
  WorkflowVerifier,
  VERIFICATION_COLLECTIONS,
  type WorkflowSpec,
  type VerificationResult,
  type VerificationCertificate,
  type ConductorWorkflow,
} from "./formal-verification.js";

// REQ-EVO-024: Agent Digital Twin Sandbox
import {
  DigitalTwinManager,
  TWIN_COLLECTIONS,
  type SandboxState,
  type ScenarioDefinition,
  type SandboxResult,
} from "./digital-twin.js";

// REQ-EVO-009/035: Context Compartments & Budget Manager
import {
  ContextManager,
  type ContextCompartment,
  type CompartmentItem,
} from "./context-manager.js";

// W2-B1: Memory Enhancements (REQ-EVO-003/004/005/007)
import {
  ContradictionDetector,
  ProvenanceManager,
  AbstractionEngine,
  PruningEngine,
  ENHANCEMENT_COLLECTIONS,
  type ContradictionResult,
  type Provenance,
  type ImpactResult,
  type ConsolidationResult,
  type PruneCandidate,
  type PruneExplanation,
} from "./memory-enhancements.js";

// W2-B3: Governance Enhancements (REQ-EVO-011/018)
import {
  ConstitutionalInheritanceManager,
  INHERITANCE_COLLECTIONS,
  type ConstitutionalContract,
  type ConstitutionalConstraints,
  type EnforcementDecision,
  type ContractChainEntry,
  type ConflictResolutionResult,
} from "./constitutional-inheritance.js";

import {
  RedTeamAgent,
  RED_TEAM_COLLECTIONS,
  AttackCategory,
  type RedTeamFinding,
  type CampaignResult,
  type TrendAnalysis,
} from "./red-team-agent.js";

// W3: Developer Experience + Multi-Agent Enhancements (REQ-EVO-029/030/032/033/034/036/037/038)
import {
  AgentMarketplace,
  MicroAgentSwarm,
  CausalDebugger,
  FlowDebugger,
  WorkflowCompiler,
  SkillDiscovery,
  MultiModalHandler,
  BenchmarkSuite,
  DX_COLLECTIONS,
  type MarketplaceEntry,
  type SwarmResult,
  type CausalAnalysis,
  type WorkflowDAG,
  type CompiledWorkflow,
  type DiscoveredSkill,
  type MultiModalArtifact,
  type BenchmarkRun,
  type AgentScorecard,
} from "./dx-tooling.js";

// W2-B4: Multi-Agent Architecture (REQ-EVO-022/028/025/023)
import {
  TaskSpecializationEngine,
  CostAwareRouter,
  PARLCoordinator,
  BFTConsensus,
  MULTI_AGENT_COLLECTIONS,
  type PerformanceRecord,
  type RoutingScore,
  type SpecializationReport,
  type ModelTier,
  type TaskComplexity,
  type CostOutcome,
  type CostAnalytics,
  type DailyBudget,
  type LockType,
  type LockRecord,
  type HeartbeatRecord,
  type StateEvent,
  type AgentVote,
  type ConsensusResult,
  type VotingHistoryEntry,
} from "./multi-agent-coordination.js";

// W2-R + W3: Advanced Memory & Governance (REQ-EVO-006/008/010/019/020/021/026/027)
import {
  PredictivePreloader,
  FederationManager,
  SelfAssessment,
  DataSovereignty,
  ComplianceDashboard,
  StigmergicCoordinator,
  A2AProtocolBridge,
  WorldModel,
  ADVANCED_COLLECTIONS,
  type PreloadResult,
  type FeedbackResult,
  type PredictivePattern,
  type FederationInstance,
  type SyncResult,
  type JurisdictionValidation,
  type TaskReadiness,
  type SuccessRateResult,
  type ErrorPattern,
  type SovereigntyTag,
  type CascadingDeleteResult,
  type JurisdictionFilterResult,
  type DashboardResult,
  type FrameworkScore,
  type ComplianceTrend,
  type ComplianceGap,
  type PheromoneTrail,
  type TrailGuidance,
  type DecayResult,
  type A2AAgentCard,
  type A2ATaskRequest,
  type A2ATaskResult,
  type AgentDiscoveryResult,
  type PredictionResult,
  type ObservationRecord,
  type ModelCoverage,
  type JurisdictionTag,
} from "./advanced-memory.js";

// W3-Completion + W4: Frontier Capabilities (REQ-EVO-039/040/051/053/056/057)
import {
  AgentDevEnvironment,
  SemanticDiff,
  HippocampalConsolidation,
  WorkflowOptimizer,
  TemporalPlanner,
  MetaAgent,
  FRONTIER_COLLECTIONS,
  type DevInstance,
  type HotReloadResult,
  type TestInteractionResult,
  type BehaviorComparison,
  type PromotionResult,
  type SemanticDiffResult,
  type ImpactAssessment,
  type ConsolidationCycle,
  type TierTransferRecord,
  type ConsolidationStatus,
  type WorkflowAnalysis,
  type OptimizationProposal,
  type ABTestResult,
  type ImprovementMetrics,
  type TemporalPlan,
  type GanttChart,
  type TemporalTask,
  type EcosystemAssessment,
  type SelfAssessment as MetaSelfAssessment,
} from "./frontier-capabilities.js";
// Stage #8 dual-write mirror (flag-gated; no behavior change when STAGE_8_DUAL_WRITE != 'true')
import {
  mirrorAuditLog,
  mirrorBenchmarks,
  mirrorConsolidationCycles,
  mirrorAgentIdentitySessions,
  mirrorDelegationTokens,
  mirrorNhiLifecycle,
  mirrorNhiTransitions,
  mirrorBenchmarkRuns,
  // Stage #13 dual-write mirror (flag-gated; STAGE_13_DUAL_WRITE)
  mirrorEpisode,
} from "./postgres-mirror.js";
// Stage #11 cold-tier postgres search (replaces Qdrant memories_cold search in recall)
import { searchColdPostgres, touchColdAccess, getColdRow, deleteColdRow } from "./postgres-cold.js";
import { writeRecallTrace, recordTraceFeedback } from "./recall-trace.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6334";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || "";

// ============================================
// Stage #9 (REQ-S0-001): Collection-size cache for empty-collection guard
// Skips searchPoints round-trips when HOT/SHORT_TERM are empty.
// CISO S0-001-A: rate-limit invalidations to >=1s between calls.
// ============================================
export const collectionSizeCache = new Map<string, { count: number; refreshed_at: number }>();
export const collectionSizeLastInvalidatedAt = new Map<string, number>();
const COLLECTION_SIZE_TTL_MS = 60_000;
const COLLECTION_INVALIDATE_FLOOR_MS = 1_000;
const RECALL_SKIP_THRESHOLD = 0; // skip only when truly empty

export async function getCachedCollectionCount(collection: string): Promise<number | null> {
  const cached = collectionSizeCache.get(collection);
  const now = Date.now();
  if (cached && now - cached.refreshed_at < COLLECTION_SIZE_TTL_MS) {
    return cached.count;
  }
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (QDRANT_API_KEY) headers["api-key"] = QDRANT_API_KEY;
    const res = await fetch(`${QDRANT_URL}/collections/${encodeURIComponent(collection)}`, { headers });
    if (!res.ok) return null;
    const data: any = await res.json();
    const count = data?.result?.points_count ?? data?.result?.vectors_count ?? 0;
    collectionSizeCache.set(collection, { count, refreshed_at: now });
    return count;
  } catch {
    return null;
  }
}

export function invalidateCollectionSizeCache(collection: string): void {
  const now = Date.now();
  const last = collectionSizeLastInvalidatedAt.get(collection) || 0;
  if (now - last < COLLECTION_INVALIDATE_FLOOR_MS) return; // floor per CISO S0-001-A
  collectionSizeCache.delete(collection);
  collectionSizeLastInvalidatedAt.set(collection, now);
}

// ============================================
// Stage #9 (REQ-S0-003): Exact-token boost for recall ranking.
// Adds a lexical signal on top of the semantic embedding score.
// CISO S0-003-A: cap rare-token count at 16 to bound regex work.
// ============================================
const RARE_TOKEN_STOPLIST = new Set<string>([
  "the","that","with","from","this","what","when","where","which",
  "your","have","will","been","were","would","could","should","about",
  "after","before","above","below","they","them","there","then","than",
  "into","also","just","only","more","most","some","such","over","under",
]);
const RARE_TOKEN_MIN_LEN = 4;
const RARE_TOKEN_MAX_COUNT = 16;
const EXACT_TOKEN_BOOST_FACTOR = 1.3;
const EXACT_TOKEN_BOOST_CAP = 1.5;
const EXACT_TOKEN_CONTENT_LIMIT = 4096;

export function extractRareTokens(query: string): string[] {
  const tokens = query.toLowerCase().split(/[^a-z0-9_]+/g);
  const out: string[] = [];
  for (const t of tokens) {
    if (t.length >= RARE_TOKEN_MIN_LEN && !RARE_TOKEN_STOPLIST.has(t)) {
      out.push(t);
      if (out.length >= RARE_TOKEN_MAX_COUNT) break;
    }
  }
  return out;
}

export function computeExactTokenBoost(content: string | undefined, rareTokens: string[]): number {
  if (!content || rareTokens.length === 0) return 1;
  const haystack = content.toLowerCase().slice(0, EXACT_TOKEN_CONTENT_LIMIT);
  let boost = 1;
  for (const tok of rareTokens) {
    const escaped = tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`);
    if (re.test(haystack)) {
      boost *= EXACT_TOKEN_BOOST_FACTOR;
      if (boost >= EXACT_TOKEN_BOOST_CAP) return EXACT_TOKEN_BOOST_CAP;
    }
  }
  return boost;
}
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const SESSION_ID = `session_${Date.now()}_${randomBytes(4).toString("hex")}`;
const GOVERNANCE_HTTP_PORT = parseInt(process.env.GOVERNANCE_HTTP_PORT || "5681");
// Dedicated secret — deliberately does NOT fall back to QDRANT_API_KEY. This server is
// bound to 0.0.0.0 (LAN-reachable, required for Docker-container callers like n8n), so
// reusing the Qdrant key would mean a leaked/guessed governance key also compromises the
// vector store. See docs/self-test.md "Governance HTTP hardening" for the full rationale.
const GOVERNANCE_API_KEY = process.env.GOVERNANCE_API_KEY || "";

// Project scoping: auto-detect from env or working directory
function detectActiveProject(): string {
  if (process.env.CLAUDE_PROJECT) return process.env.CLAUDE_PROJECT;
  const cwd = process.env.PWD || process.cwd();
  const basename = cwd.split("/").filter(Boolean).pop();
  return basename || "global";
}
const ACTIVE_PROJECT = detectActiveProject();

// REQ-EVO-013: Proof engine singleton (initialized in main())
let proofEngine: GuardrailProofEngine | null = null;

// REQ-EVO-015/016/017: Agent identity, lifecycle, and monitor singletons
let identityManager: AgentIdentityManager | null = null;
let lifecycleManager: NHILifecycleManager | null = null;
let constitutionalMonitor: ConstitutionalMonitor | null = null;

// REQ-EVO-031: Time-Travel Debugging singleton
let timeTravelDebugger: TimeTravelDebugger | null = null;

// REQ-EVO-012/024: Formal Verification and Digital Twin singletons
let workflowVerifier: WorkflowVerifier | null = null;
let digitalTwinManager: DigitalTwinManager | null = null;

// REQ-EVO-009/035: Context Budget Manager singleton
let contextManager: ContextManager | null = null;

// W2-B1: Memory Enhancement singletons
let contradictionDetector: ContradictionDetector | null = null;
let provenanceManager: ProvenanceManager | null = null;
let abstractionEngine: AbstractionEngine | null = null;
let pruningEngine: PruningEngine | null = null;

// W2-B3: Governance Enhancement singletons
let inheritanceManager: ConstitutionalInheritanceManager | null = null;
let redTeamAgent: RedTeamAgent | null = null;

// W2-B4: Multi-Agent Architecture singletons
let taskSpecEngine: TaskSpecializationEngine | null = null;
let costRouter: CostAwareRouter | null = null;
let parlCoordinator: PARLCoordinator | null = null;
let bftConsensus: BFTConsensus | null = null;

// W3: Developer Experience + Multi-Agent Enhancement singletons
let agentMarketplace: AgentMarketplace | null = null;
let microSwarm: MicroAgentSwarm | null = null;
let causalDebugger: CausalDebugger | null = null;
let flowDebugger: FlowDebugger | null = null;
let workflowCompiler: WorkflowCompiler | null = null;
let skillDiscovery: SkillDiscovery | null = null;
let multiModalHandler: MultiModalHandler | null = null;
let benchmarkSuite: BenchmarkSuite | null = null;

// W2-R + W3: Advanced Memory & Governance singletons
let predictivePreloader: PredictivePreloader | null = null;
let federationManager: FederationManager | null = null;
let selfAssessment: SelfAssessment | null = null;
let dataSovereignty: DataSovereignty | null = null;
let complianceDashboard: ComplianceDashboard | null = null;
let stigmergicCoordinator: StigmergicCoordinator | null = null;
let a2aProtocolBridge: A2AProtocolBridge | null = null;
let worldModel: WorldModel | null = null;

// W3-Completion + W4: Frontier Capability singletons
let agentDevEnv: AgentDevEnvironment | null = null;
let semanticDiff: SemanticDiff | null = null;
let hippocampalConsolidation: HippocampalConsolidation | null = null;
let workflowOptimizer: WorkflowOptimizer | null = null;
let temporalPlanner: TemporalPlanner | null = null;
let metaAgent: MetaAgent | null = null;

// Governance actions that generate cryptographic proofs
const GOVERNED_ACTIONS = new Set([
  "classify", "expire", "store", "POLICY_DENY", "TRUST_DENY",
  "DATA_CLASSIFICATION", "TIER_CLASSIFICATION",
]);

// Collection names
const COLLECTIONS = {
  // Tiered memory collections
  LONG_TERM: "claude_memories",
  SHORT_TERM: "short_term_memory",
  WORKING: "working_memory",
  // Hot/Warm/Cold tiering for auto-migration
  HOT: "memories_hot",      // Recent, frequently accessed (last 7 days)
  WARM: "memories_warm",    // Project-active, moderate access
  COLD: "memories_cold",    // Archived, rarely accessed (>90 days)
  // Specialized collections
  EPISODES: "episodes",
  LEARNINGS: "learnings",
  BENCHMARKS: "benchmarks",
  PROCEDURES: "procedures",     // NEW: Procedural memory
  TRAJECTORIES: "trajectories", // NEW: Successful execution traces
  LINKS: "memory_links",        // NEW: Memory relationships
  OBSIDIAN: "obsidian_docs",
  AUDIT_LOG: "audit_log",
};

// TTL constants (in milliseconds)
const TTL = {
  WORKING: 60 * 60 * 1000,
  SHORT_TERM: 24 * 60 * 60 * 1000,
  SENSITIVE: 90 * 24 * 60 * 60 * 1000,
  RESTRICTED: 60 * 60 * 1000,
};

const SensitivityLevel = z.enum(["public", "internal", "sensitive", "restricted"]);
type SensitivityLevel = z.infer<typeof SensitivityLevel>;

// REQ-EVO-002: Temporal class (must be before StoreMemorySchema)
const TemporalClass = z.enum(["permanent", "decaying", "deadline", "periodic"]);
type TemporalClassT = z.infer<typeof TemporalClass>;

// REQ-EVO-001: Causal edge types (must be before MemoryLinkSchema)
const CausalEdgeType = z.enum([
  "caused_by", "resolved_by", "contradicts", "supersedes", "derived_from", "informed"
]);
type CausalEdgeTypeT = z.infer<typeof CausalEdgeType>;

// Memory type enum
const MemoryType = z.enum(["preference", "fact", "context", "decision"]);

// ── Feature 1: Provenance & use-policy ──────────────────────────────────────
// Provenance = the trust origin of a stored memory. Computed SERVER-SIDE and
// treated as authoritative (never client-trusted for the *derivation defaults*).
//
// CISO Condition A — Trust boundary & residual risk:
//   "Server-side, never client-trusted" describes the DERIVATION DEFAULTS, not the
//   EXPLICIT override. If a caller supplies provenance_status:"user_confirmed"
//   explicitly, the gate honors it verbatim (explicit always wins over derivation).
//   There is NO cryptographic proof of actual human confirmation — only a
//   self-asserted string on the payload. This is a DELIBERATE, accepted design.
//   The trust boundary this gate defends is the CLASS OF WRITER (a low-trust
//   automated extractor like "session-analyzer-auto", identified by `source`,
//   can never mint an instruction-grade memory FOR ITSELF), NOT authentication of
//   a human's intent. Threat model = memory-mediated privilege escalation by an
//   automated/compromised writer — NOT a guarantee that every user_confirmed
//   memory was actually reviewed by the operator. Do NOT describe
//   can_use_as_instruction as "proven" or "verified" trust in user-facing docs.
const ProvenanceStatus = z.enum([
  "observed",       // directly witnessed by the agent in-session (tool output, file read, command result)
  "inferred",       // deduced/synthesized by a model from other data — NOT directly witnessed
  "user_confirmed", // the human operator explicitly confirmed this exact statement
  "imported",       // brought in from a trusted external corpus the operator authorized
  "generated",      // produced by an automated extraction/summarization pass, no human in the loop
]);
type ProvenanceStatusT = z.infer<typeof ProvenanceStatus>;

// Server-side provenance derivation, used ONLY when provenance_status is omitted.
// Automated-extraction sources (session-analyzer-auto and friends) can NEVER
// default to a trust-implying value. The regex catches known auto-writers.
// NOTE: this regex + enum is intentionally MIRRORED in the governance-plugin
// PreToolUse hook (hooks/memory_integrity_hook.py::_derive_prov). A conformance
// test (tests/feature-provenance.test.ts + the plugin's pytest, both fed
// tests/fixtures/provenance-derivation.json) asserts the two stay in lockstep;
// if you change this regex, change the hook's too or the build fails (CISO Cond B).
function deriveProvenance(src: string | null | undefined): ProvenanceStatusT {
  if (!src) return "observed";
  const s = src.toLowerCase();
  if (/auto|analyz|extract|summari|generat|digest|consolidat/.test(s)) return "generated";
  if (s === "user") return "user_confirmed";
  if (s === "import" || s === "imported") return "imported";
  return "observed";
}

// Resolved use-policy result. `violation:true` means the write MUST be rejected
// (never stored) — the caller turns it into an isError MCP response.
export interface ResolvedUsePolicy {
  violation: boolean;
  reason?: string;
  provenance_status: ProvenanceStatusT;
  can_use_as_instruction: boolean;
  can_use_as_evidence: boolean;
  requires_user_confirmation: boolean;
}

// Pure, side-effect-free policy resolver — the single source of truth for the
// use-policy rules. Unit-tested directly (no Qdrant needed). The memory_store
// handler calls this and, on violation, rejects the write without storing.
//
// Rules:
//   provenance_status: explicit value wins; else derived from `source`.
//   can_use_as_instruction: true ONLY if provenance ∈ {user_confirmed, imported}.
//     A client-supplied true with any other provenance is a HARD REJECTION
//     (not a silent downgrade). Omitted => the computed default (INSTRUCTION_OK).
//   can_use_as_evidence: default true for ALL provenance; client may lower to false.
//   requires_user_confirmation: safety FLOOR of true when provenance ∈
//     {inferred, generated} (cannot be lowered); else client-true honored, else false.
export function resolveUsePolicy(args: {
  source?: string | null;
  provenance_status?: ProvenanceStatusT;
  can_use_as_instruction?: boolean;
  can_use_as_evidence?: boolean;
  requires_user_confirmation?: boolean;
}): ResolvedUsePolicy {
  const provenance_status: ProvenanceStatusT =
    args.provenance_status ?? deriveProvenance(args.source);

  const INSTRUCTION_OK =
    provenance_status === "user_confirmed" || provenance_status === "imported";

  // HARD GATE: client cannot mark a low-trust memory as instruction-usable.
  if (args.can_use_as_instruction === true && !INSTRUCTION_OK) {
    return {
      violation: true,
      reason:
        "can_use_as_instruction=true requires provenance_status of 'user_confirmed' or " +
        `'imported' (got '${provenance_status}'). Memory NOT stored.`,
      provenance_status,
      can_use_as_instruction: false,
      can_use_as_evidence: args.can_use_as_evidence === false ? false : true,
      requires_user_confirmation:
        provenance_status === "inferred" || provenance_status === "generated"
          ? true
          : args.requires_user_confirmation === true,
    };
  }

  const can_use_as_instruction =
    args.can_use_as_instruction === true ? true // honored (INSTRUCTION_OK already asserted)
      : INSTRUCTION_OK;                          // default: allowed only for trusted provenance
  const can_use_as_evidence =
    args.can_use_as_evidence === false ? false : true; // default true; client may lower
  const requires_user_confirmation =
    provenance_status === "inferred" || provenance_status === "generated"
      ? true                                     // safety floor — cannot be lowered
      : (args.requires_user_confirmation === true ? true : false);

  return {
    violation: false,
    provenance_status,
    can_use_as_instruction,
    can_use_as_evidence,
    requires_user_confirmation,
  };
}

// E1 (PRD §2.2): Cognitive-class sector enum — ORTHOGONAL to MemoryType.
// `type` = content shape; `sector` = cognitive class. Additive, non-breaking.
export const MemorySector = z.enum([
  "episodic",    // events, temporal occurrences
  "semantic",    // declarative facts / knowledge
  "procedural",  // reusable steps
  "emotional",   // subjective reactions, friction/frustration markers
  "reflective",  // meta-insights, lessons-learned, corrections internalized
]);
type MemorySectorT = z.infer<typeof MemorySector>;

// E1 (PRD §2.2): type -> sector auto-inference. Used at BOTH write-time and
// read-time so the mapping cannot drift. Explicit sector always overrides this.
export const TYPE_TO_SECTOR: Record<string, MemorySectorT> = {
  fact:       "semantic",
  preference: "semantic",
  context:    "episodic",
  decision:   "reflective",
};

// E2 (PRD §3.2): per-sector default half-life (days). Consumed ONLY when a
// memory has no explicit decay_halflife_days. Explicit per-memory values win.
export const SECTOR_HALFLIFE_DAYS: Record<MemorySectorT, number> = {
  episodic:   30,   // events fade fast
  emotional:  21,   // reactions fade fastest
  procedural: 120,  // skills persist
  semantic:   180,  // facts persist longest
  reflective: 365,  // lessons-learned are sticky by design
};

// Final fallback half-life when sector cannot be determined (defensive only).
export const DEFAULT_HALFLIFE_DAYS = 90;

// E1: resolve a memory's sector. Explicit payload.sector wins; else infer from
// type; else default to "semantic". Used at write (to persist) and read
// (to infer for legacy memories lacking the field).
export function inferSector(payload: { sector?: string; type?: string }): MemorySectorT {
  if (payload.sector && (MemorySector.options as readonly string[]).includes(payload.sector)) {
    return payload.sector as MemorySectorT;
  }
  const fromType = payload.type ? TYPE_TO_SECTOR[payload.type] : undefined;
  return fromType ?? "semantic";
}

// E2: resolve the half-life for a memory.
// Order: explicit decay_halflife_days  ->  SECTOR_HALFLIFE_DAYS[sector]  ->  90.
// `explicit` is a real stored number (legacy memories have 90 baked in; new
// memories have the write-time-resolved value), so this is trustworthy at recall.
export function resolveHalflifeDays(payload: {
  decay_halflife_days?: number | null;
  sector?: string;
  type?: string;
}): number {
  if (typeof payload.decay_halflife_days === "number" && payload.decay_halflife_days > 0) {
    return payload.decay_halflife_days;
  }
  const sector = inferSector(payload);
  return SECTOR_HALFLIFE_DAYS[sector] ?? DEFAULT_HALFLIFE_DAYS;
}

// Scratch operation enum
const ScratchOperation = z.enum(["create", "read", "update", "delete", "list", "clear"]);

// Episode status enum
const EpisodeStatus = z.enum(["active", "completed", "failed", "abandoned"]);

// Input schemas
export const StoreMemorySchema = z.object({
  content: z.string().describe("The information to store in memory"),
  // Resilience: large tool-call payloads can lose the `type` field in the
  // harness<->server transport (content arrives intact, only `type` drops),
  // which previously hard-failed the whole write with a zod "type required"
  // error. Default to "fact" so a dropped/omitted type stores the memory
  // instead of losing it. Explicit values are always honored.
  type: MemoryType.optional().default("fact").describe("Category of memory: preference, fact, context, or decision (defaults to 'fact' if omitted)"),
  // E1 (PRD §2.2): orthogonal cognitive class. Auto-inferred from `type` if omitted.
  // Explicit value always wins. Does NOT replace `type`.
  sector: MemorySector.optional()
    .describe("Cognitive class: episodic, semantic, procedural, emotional, or reflective. Auto-inferred from type if omitted (fact/preference->semantic, context->episodic, decision->reflective)."),
  tags: z.array(z.string()).optional().describe("Tags for organizing the memory"),
  project: z.string().optional().describe("Project scope for the memory (defaults to auto-detected project from working directory)"),
  sensitivity: SensitivityLevel.optional().describe("Manual sensitivity override: public, internal, sensitive, or restricted"),
  // REQ-EVO-002: Temporal reasoning fields
  temporal_class: TemporalClass.optional().default("permanent")
    .describe("Temporal lifecycle: permanent (no decay), decaying (halflife), deadline (urgency), periodic (resets on verify)"),
  // E2/Q4: NO schema default. Half-life is resolved at write-time AFTER sector
  // inference (see memory_store handler) so the stored value is authoritative
  // and "explicit vs default" is distinguishable. Omission => sector default.
  decay_halflife_days: z.number().positive().optional()
    .describe("Half-life in days for decaying/periodic memories. If omitted, defaults to the sector-specific half-life (episodic 30, emotional 21, procedural 120, semantic 180, reflective 365)."),
  deadline_date: z.string().optional()
    .describe("ISO 8601 deadline date for deadline-class memories"),
  last_verified_date: z.string().optional()
    .describe("ISO 8601 date when memory was last confirmed current"),
  // ── Provenance & use-policy (Feature 1) ──────────────────────────────
  // All resolved SERVER-SIDE in the handler (see resolveUsePolicy); client
  // values are advisory EXCEPT can_use_as_instruction=true, which is validated
  // and HARD-REJECTS the write if provenance is not user_confirmed|imported.
  // No `.default(...)` here — defaults are resolved in the handler AFTER
  // provenance derivation so "explicit vs default" stays distinguishable (same
  // pattern as decay_halflife_days, see comment above).
  source: z.string().max(200).optional()
    .describe("Origin tag of the writer (e.g. 'session-analyzer-auto', 'user', 'cli', a tool name). Drives provenance derivation when provenance_status is omitted."),
  provenance_status: ProvenanceStatus.optional()
    .describe("Trust origin. If omitted, derived server-side from `source` (automated sources -> 'generated', never a trusting value). Explicit value always wins over derivation."),
  can_use_as_instruction: z.boolean().optional()
    .describe("May this be used as a directive the agent follows? Server enforces: true is ONLY valid when provenance_status is user_confirmed or imported; otherwise the write is REJECTED (not stored)."),
  can_use_as_evidence: z.boolean().optional()
    .describe("May this be cited as supporting evidence? Defaults true for all provenance; client may lower to false."),
  requires_user_confirmation: z.boolean().optional()
    .describe("Should a consumer confirm with the operator before acting? Server floors this to true when provenance is inferred/generated."),
});

export const RecallMemorySchema = z.object({
  query: z.string().describe("Natural language search query to find relevant memories"),
  limit: z.number().optional().default(5).describe("Maximum number of memories to return (default: 5)"),
  include_short_term: z.boolean().optional().default(true).describe("Include short-term memories in search"),
  project: z.string().optional().describe("Project scope filter (defaults to auto-detected project from working directory)"),
  // E1 (PRD §2.3): optional cognitive-class filter. Matches stored `sector` and,
  // for legacy memories lacking it, the sector inferred from `type`.
  sector: MemorySector.optional()
    .describe("Optional filter: only return memories of this cognitive class (episodic, semantic, procedural, emotional, reflective)."),
  include_all_projects: z.boolean().optional().default(false).describe("Set true to search across all projects, ignoring project filter"),
  // Stage #9 REQ-S0-002: optional time-range filters
  created_after: z.string().datetime({ offset: true }).optional()
    .describe("ISO 8601 datetime; filter to memories created at/after this instant"),
  last_accessed_after: z.string().datetime({ offset: true }).optional()
    .describe("ISO 8601 datetime; filter to memories last accessed at/after this instant"),
  // Stage #9 REQ-S0-005: optional explicit verification of top result
  verify_top: z.boolean().optional().default(false)
    .describe("If true, run memory_verify on the top result and annotate the response (paper's explicit-verification escape hatch)"),
});

const RagSearchSchema = z.object({
  query: z.string().describe("Natural language query to search the Obsidian vault documents"),
  limit: z.number().optional().default(5).describe("Maximum number of document chunks to return (default: 5)"),
  threshold: z.number().optional().default(0.4).describe("Minimum similarity score threshold (0-1, default: 0.4)"),
});

const ScratchSchema = z.object({
  operation: ScratchOperation.describe("Operation to perform: create, read, update, delete, list, or clear"),
  key: z.string().optional().describe("Named key for the scratch slot (required for create/read/update/delete)"),
  content: z.string().optional().describe("Content to store (required for create/update)"),
  ttl_minutes: z.number().optional().default(60).describe("Time-to-live in minutes (default: 60)"),
  task_id: z.string().optional().describe("Task ID to associate scratch with (for auto-cleanup)"),
});

const PromoteMemorySchema = z.object({
  memory_id: z.string().describe("ID of the memory to promote"),
  from_tier: z.enum(["working", "short_term"]).describe("Source tier"),
  to_tier: z.enum(["short_term", "long_term"]).describe("Destination tier"),
  type: MemoryType.optional().describe("Memory type (required when promoting to long_term)"),
});

const SummarizeMemorySchema = z.object({
  memory_ids: z.array(z.string()).describe("IDs of memories to summarize"),
  tier: z.enum(["working", "short_term", "long_term"]).describe("Which tier the memories are in"),
});

const EpisodeSchema = z.object({
  operation: z.enum(["start", "update", "complete", "search", "get"]).describe("Episode operation"),
  episode_id: z.string().optional().describe("Episode ID (required for update/complete/get)"),
  task: z.string().optional().describe("Task description (required for start)"),
  project: z.string().optional().describe("Project name"),
  agents_invoked: z.array(z.string()).optional().describe("List of agents used"),
  tools_used: z.array(z.string()).optional().describe("List of tools used"),
  files_modified: z.array(z.string()).optional().describe("List of files modified"),
  outcome: EpisodeStatus.optional().describe("Episode outcome"),
  learnings: z.array(z.string()).optional().describe("Learnings extracted from episode"),
  query: z.string().optional().describe("Search query (for search operation)"),
  limit: z.number().optional().default(5).describe("Number of results for search"),
});

const LearningSchema = z.object({
  operation: z.enum(["store", "search", "apply"]).describe("Learning operation"),
  content: z.string().optional().describe("Learning content (for store)"),
  domain: z.string().optional().describe("Domain/category of learning"),
  agent: z.string().optional().describe("Related agent name"),
  error_type: z.string().optional().describe("Type of error this learning addresses"),
  query: z.string().optional().describe("Search query (for search)"),
  limit: z.number().optional().default(5).describe("Number of results"),
});

const BenchmarkSchema = z.object({
  operation: z.enum(["record", "query", "compare"]).describe("Benchmark operation"),
  agent: z.string().optional().describe("Agent being benchmarked"),
  task_type: z.string().optional().describe("Type of task"),
  success: z.boolean().optional().describe("Whether task succeeded"),
  duration_ms: z.number().optional().describe("Execution duration in milliseconds"),
  tokens_used: z.number().optional().describe("Tokens consumed"),
  metadata: z.record(z.string(), z.unknown()).optional().describe("Additional metadata"),
  query: z.string().optional().describe("Query for searching benchmarks"),
  limit: z.number().optional().default(10).describe("Number of results"),
});

// NEW: Procedural Memory Schema
const ProcedureSchema = z.object({
  operation: z.enum(["capture", "search", "apply", "feedback", "list"]).describe("Procedure operation"),
  // For capture
  episode_id: z.string().optional().describe("Source episode ID"),
  name: z.string().optional().describe("Procedure name"),
  task_type: z.string().optional().describe("Type of task (database_migration, api_integration, etc.)"),
  domain: z.string().optional().describe("Domain (backend, frontend, devops, security)"),
  triggers: z.object({
    keywords: z.array(z.string()).optional(),
    file_patterns: z.array(z.string()).optional(),
    task_patterns: z.array(z.string()).optional(),
  }).optional().describe("Trigger conditions for this procedure"),
  steps: z.array(z.object({
    step: z.number(),
    action: z.string(),
    tools: z.array(z.string()).optional(),
    command_template: z.string().optional(),
    decision_points: z.array(z.object({
      condition: z.string(),
      action: z.string(),
    })).optional(),
  })).optional().describe("Procedure steps"),
  notes: z.string().optional().describe("Additional notes"),
  // For search/apply
  procedure_id: z.string().optional().describe("Procedure ID"),
  query: z.string().optional().describe("Search query"),
  context: z.record(z.string(), z.string()).optional().describe("Context variables for template substitution"),
  limit: z.number().optional().default(3).describe("Number of results"),
  // For feedback
  success: z.boolean().optional().describe("Whether procedure application succeeded"),
  improvement_notes: z.string().optional().describe("Notes on improvement"),
  refinements: z.array(z.string()).optional().describe("Suggested refinements"),
});

// NEW: Trajectory Schema (successful execution traces for few-shot learning)
const TrajectorySchema = z.object({
  operation: z.enum(["store", "recall", "feedback"]).describe("Trajectory operation"),
  // For store
  task_description: z.string().optional().describe("Description of the task"),
  task_type: z.string().optional().describe("Type of task"),
  execution_trace: z.array(z.object({
    step: z.number(),
    action: z.string(),
    tool: z.string().optional(),
    input_summary: z.string().optional(),
    output_summary: z.string().optional(),
    decision: z.string().optional(),
  })).optional().describe("Step-by-step execution trace"),
  key_decisions: z.array(z.string()).optional().describe("Important decisions made"),
  outcome: z.object({
    success: z.boolean(),
    metrics: z.record(z.string(), z.unknown()).optional(),
  }).optional().describe("Task outcome"),
  // For recall
  query: z.string().optional().describe("Search query for similar trajectories"),
  limit: z.number().optional().default(3).describe("Number of trajectories to return"),
  min_success_rate: z.number().optional().default(0.8).describe("Minimum success rate filter"),
  // For feedback
  trajectory_id: z.string().optional().describe("Trajectory ID"),
  was_helpful: z.boolean().optional().describe("Whether the trajectory was helpful"),
});

// NEW: Memory Link Schema (for knowledge graph relationships)
const MemoryLinkSchema = z.object({
  operation: z.enum(["link", "unlink", "traverse", "cluster", "prune"]).describe("Link operation"),
  // For link/unlink
  source_id: z.string().optional().describe("Source memory ID"),
  target_id: z.string().optional().describe("Target memory ID"),
  relationship: z.enum([
    "supports",      // Source supports/validates target
    "contradicts",   // Source contradicts target
    "extends",       // Source extends/elaborates target
    "supersedes",    // Source replaces/updates target
    "related",       // General relationship
    "prerequisite",  // Target requires source
    "derived_from",  // Source was derived from target
  ]).optional().describe("Type of relationship"),
  strength: z.number().optional().default(1.0).describe("Relationship strength 0-1"),
  // For traverse
  start_id: z.string().optional().describe("Starting memory ID for traversal"),
  max_depth: z.number().optional().default(2).describe("Maximum traversal depth"),
  relationship_filter: z.array(z.string()).optional().describe("Filter by relationship types"),
  // For cluster
  query: z.string().optional().describe("Query to find memories to cluster"),
  min_cluster_size: z.number().optional().default(3).describe("Minimum cluster size"),
  similarity_threshold: z.number().optional().default(0.85).describe("Similarity threshold for clustering"),
  action: z.enum(["identify", "merge", "summarize"]).optional().describe("What to do with clusters"),
  // For prune
  criteria: z.object({
    older_than_days: z.number().optional(),
    access_count_below: z.number().optional(),
    score_below: z.number().optional(),
    superseded: z.boolean().optional(),
  }).optional().describe("Pruning criteria"),
  dry_run: z.boolean().optional().default(true).describe("Preview without deleting"),
});

// ============================================
// REQ-EVO-001: Causal Memory Graph Schemas
// ============================================

const MemoryTraceSchema = z.object({
  memory_id: z.string().describe("Memory ID to trace causal chain for"),
  direction: z.enum(["upstream", "downstream", "both"]).optional().default("both")
    .describe("upstream = what caused this, downstream = what this caused"),
  depth: z.number().optional().default(3).describe("Maximum traversal depth (default: 3)"),
});

const MemoryImpactSchema = z.object({
  memory_id: z.string().describe("Memory ID to assess downstream impact of"),
  edge_types: z.array(CausalEdgeType).optional()
    .describe("Filter to specific edge types (default: all)"),
});

// ============================================
// REQ-EVO-002: Temporal Reasoning Schemas
// ============================================

const MemoryVerifySchema = z.object({
  memory_id: z.string().describe("Memory ID to mark as verified/current"),
  collection: z.string().optional().default("claude_memories").describe("Collection the memory is in"),
  notes: z.string().optional().describe("Optional notes about the verification"),
});

const MemoryForgetSchema = z.object({
  mode: z.enum(["search", "delete"]).describe("search = find matches, delete = remove them"),
  query: z.string().optional().describe("Semantic search query (for mode=search)"),
  memory_ids: z.array(z.string()).optional().describe("IDs to delete (for mode=delete)"),
  collection: z.string().optional().describe("Collection to search/delete from (default: searches all)"),
  confirm: z.boolean().default(false).describe("Must be true to actually delete"),
});

// Helper function to generate embedding via Ollama
async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
    });
    if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
    const data = await response.json();
    return data.embedding;
  } catch (error) {
    console.error("Embedding error:", error);
    return null;
  }
}

// Helper function to generate a UUID (v4, cryptographically random).
function generateUUID(): string {
  return randomUUID();
}

// Deterministic UUID from a string key (for scratch pad IDs).
// Uses SHA-256 (not MD5) and takes the first 32 hex chars for the UUID layout —
// this is an ID-derivation, not a security hash, but SHA-256 avoids the broken-hash
// warning and costs nothing here.
function keyToUUID(key: string): string {
  const hash = createHash('sha256').update(key).digest('hex').slice(0, 32);
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-');
}

// Helper function to call Qdrant
async function qdrantRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const response = await fetch(`${QDRANT_URL}${path}`, {
    method,
    headers: {
      "api-key": QDRANT_API_KEY,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Qdrant error: ${response.status} - ${errorText}`);
  }
  return response.json();
}

// Helper to store a point in Qdrant
async function storePoint(
  collection: string,
  id: string,
  vector: number[],
  payload: Record<string, unknown>
): Promise<void> {
  await qdrantRequest("PUT", `/collections/${collection}/points`, {
    points: [{ id, vector, payload }],
  });
}

// Helper to search Qdrant
async function searchPoints(
  collection: string,
  vector: number[],
  limit: number,
  threshold: number = 0.5,
  filter?: Record<string, unknown>
): Promise<unknown[]> {
  const body: Record<string, unknown> = {
    vector,
    limit,
    score_threshold: threshold,
    with_payload: true,
  };
  if (filter) body.filter = filter;

  const result = await qdrantRequest("POST", `/collections/${collection}/points/search`, body) as { result: unknown[] };
  return result.result || [];
}

// Helper to get a point by ID
async function getPoint(collection: string, id: string, withVector: boolean = false): Promise<unknown> {
  const path = `/collections/${collection}/points/${id}${withVector ? '?with_vector=true' : ''}`;
  const result = await qdrantRequest("GET", path) as { result: unknown };
  return result.result;
}

// E4 (PRD §5 / spec §5.2): batch-fetch points by id from ONE collection via Qdrant's
// retrieve endpoint (POST /collections/{c}/points with {ids, with_payload}). The single
// getPoint above is N round-trips for a hydration set; this is one. Returns the points that
// exist (missing ids are simply absent). Throws on transport error → caller's graph-first
// try/catch fails open to vector-first.
export async function getPointsByIds(
  collection: string,
  ids: string[],
  withPayload: boolean = true,
): Promise<Array<{ id: string; payload?: any; vector?: number[] }>> {
  if (ids.length === 0) return [];
  const result = await qdrantRequest("POST", `/collections/${collection}/points`, {
    ids,
    with_payload: withPayload,
    with_vector: false,
  }) as { result?: Array<{ id: string; payload?: any }> };
  return result.result ?? [];
}

// Helper to delete points
async function deletePoints(collection: string, ids: string[]): Promise<void> {
  await qdrantRequest("POST", `/collections/${collection}/points/delete`, {
    points: ids,
  });
}

async function ensureCollection(name: string, size: number = 768): Promise<void> {
  try {
    await qdrantRequest("GET", `/collections/${name}`);
  } catch {
    await qdrantRequest("PUT", `/collections/${name}`, {
      vectors: { size, distance: "Cosine" },
    });
  }
}

async function logAudit(
  action: string,
  details: Record<string, unknown>,
  sensitivity: string = "internal",
  project: string = ACTIVE_PROJECT
): Promise<string | null> {
  try {
    const contentPreview = typeof details.content_preview === "string"
      ? details.content_preview : "";
    const text = `${action} ${project} ${sensitivity} ${contentPreview}`;
    const embedding = await generateEmbedding(text);
    if (!embedding) return null;

    const id = generateUUID();
    const ts = new Date().toISOString();
    await storePoint(COLLECTIONS.AUDIT_LOG, id, embedding, {
      action,
      timestamp: ts,
      session_id: SESSION_ID,
      project,
      sensitivity,
      details,
    });
    // Stage #8 dual-write mirror (flag-gated, non-fatal — see src/postgres-mirror.ts)
    await mirrorAuditLog(id, {
      action,
      timestamp: ts,
      session_id: SESSION_ID,
      project,
      sensitivity,
      details,
    });

    // REQ-EVO-013: Generate cryptographic proof for governed actions
    if (proofEngine && GOVERNED_ACTIONS.has(action)) {
      try {
        const argsHash = createHash("sha256")
          .update(JSON.stringify(details))
          .digest("hex");
        const req = {
          tool_name: action,
          args_hash: argsHash,
          session_id: SESSION_ID,
          timestamp: ts,
        };
        const h1 = proofEngine.preProof(req);
        proofEngine.postProof({
          h1,
          operation_id: id,
          hook_log: {
            pre_hook_ran: true,
            post_hook_ran: true,
            policy_checks: [action],
            duration_ms: 0,
          },
          policy_decision: (details.denied ? "DENY" : "ALLOW") as PolicyDecision,
          req,
        });
      } catch {
        // Proof generation failure must not block audit logging
      }
    }

    return id;
  } catch {
    // Audit failures are silently swallowed
    return null;
  }
}

async function ollamaGenerate(prompt: string): Promise<string | null> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.3:70b",
        prompt,
        stream: false,
        options: { temperature: 0, num_predict: 10 },
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.response?.trim() || null;
  } catch {
    return null;
  }
}

async function anthropicClassify(content: string): Promise<SensitivityLevel | null> {
  if (!ANTHROPIC_API_KEY) return null;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 10,
        messages: [{
          role: "user",
          content: `Classify this memory's sensitivity level. Respond with exactly one word.

Levels:
- public: Safe if leaked. Travel preferences, tool configs, editor settings, general knowledge.
- internal: Private but not harmful. Project context, workflow patterns, architecture decisions.
- sensitive: Professional credentials, employer details, client context, financial figures, decision rationale with identifying info.
- restricted: Passwords, API keys, secrets, tokens, one-time credentials.

Memory: "${content.slice(0, 500)}"

Classification:`,
        }],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const result = data.content?.[0]?.text?.trim().toLowerCase();
    if (["public", "internal", "sensitive", "restricted"].includes(result)) {
      return result as SensitivityLevel;
    }
    return null;
  } catch {
    return null;
  }
}

async function classifyMemory(content: string): Promise<{
  level: SensitivityLevel;
  classifier: "ollama" | "anthropic" | "default";
}> {
  const prompt = `Classify this memory's sensitivity level. Respond with exactly one word: public, internal, sensitive, or restricted.

Levels:
- public: Safe if leaked. Travel preferences, tool configs, editor settings, general knowledge.
- internal: Private but not harmful. Project context, workflow patterns, architecture decisions.
- sensitive: Professional credentials, employer details, client context, financial figures, decision rationale with identifying info.
- restricted: Passwords, API keys, secrets, tokens, one-time credentials.

Memory: "${content.slice(0, 500)}"

Classification:`;

  const ollamaResult = await ollamaGenerate(prompt);
  if (ollamaResult) {
    const cleaned = ollamaResult.toLowerCase().replace(/[^a-z]/g, "");
    if (["public", "internal", "sensitive", "restricted"].includes(cleaned)) {
      return { level: cleaned as SensitivityLevel, classifier: "ollama" };
    }
  }

  const anthropicResult = await anthropicClassify(content);
  if (anthropicResult) {
    return { level: anthropicResult, classifier: "anthropic" };
  }

  return { level: "internal", classifier: "default" };
}

function computeExpiresAt(sensitivity: SensitivityLevel): string | null {
  switch (sensitivity) {
    case "sensitive":
      return new Date(Date.now() + TTL.SENSITIVE).toISOString();
    case "restricted":
      return new Date(Date.now() + TTL.RESTRICTED).toISOString();
    default:
      return null;
  }
}

function isExpired(point: any): boolean {
  const expiresAt = point.payload?.expires_at;
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

// Helper to scroll through points
async function scrollPoints(
  collection: string,
  filter?: Record<string, unknown>,
  limit: number = 100,
  offset?: string | number
): Promise<unknown[]> {
  const body: Record<string, unknown> = {
    limit,
    with_payload: true,
    with_vector: false,
  };
  if (filter) body.filter = filter;
  // Qdrant paginates scroll by point id (its own stable ordering). `offset` is
  // inclusive, so callers that page with the previous page's last id must
  // de-duplicate that one repeated point.
  if (offset !== undefined) body.offset = offset;

  const result = await qdrantRequest("POST", `/collections/${collection}/points/scroll`, body) as { result: { points: unknown[] } };
  return result.result?.points || [];
}

// ============================================
// REQ-EVO-002: Temporal Scoring
// ============================================

export function computeTemporalScore(payload: any): number {
  const tc = payload.temporal_class || "permanent";
  const now = Date.now();

  switch (tc) {
    case "permanent":
      return 1.0;

    case "decaying": {
      const createdAt = payload.created_at ? new Date(payload.created_at).getTime() : now;
      const halflifeDays = resolveHalflifeDays(payload);
      const ageDays = (now - createdAt) / 86400000;
      return Math.pow(0.5, ageDays / halflifeDays);
    }

    case "deadline": {
      if (!payload.deadline_date) return 1.0;
      const deadlineMs = new Date(payload.deadline_date).getTime();
      const daysUntil = (deadlineMs - now) / 86400000;
      if (daysUntil < 0) return 0.1;
      if (daysUntil <= 1) return 2.0;
      if (daysUntil <= 7) return 1.5;
      if (daysUntil <= 30) return 1.2;
      return 1.0;
    }

    case "periodic": {
      const baseDate = payload.last_verified_date
        ? new Date(payload.last_verified_date).getTime()
        : (payload.created_at ? new Date(payload.created_at).getTime() : now);
      const halflifeDays = resolveHalflifeDays(payload);
      const ageDays = (now - baseDate) / 86400000;
      return Math.pow(0.5, ageDays / halflifeDays);
    }

    default:
      return 1.0;
  }
}

// ============================================
// REQ-EVO-001: Causal Edge Detection
// ============================================

function inferCausalEdgeType(
  newContent: string,
  existingContent: string,
  similarity: number
): CausalEdgeTypeT | null {
  if (similarity < 0.82) return null;

  const n = newContent.toLowerCase();

  if (n.includes("fixed") || n.includes("resolved") || n.includes("solution for")) return "resolved_by";
  if (n.includes("because") || n.includes("caused by") || n.includes("result of")) return "caused_by";
  if (n.includes("instead") || n.includes("replaced") || n.includes("no longer") || n.includes("updated from")) return "supersedes";
  if (n.includes("contradicts") || n.includes("disagree") || n.includes("opposite") || n.includes("but actually")) return "contradicts";
  if (n.includes("based on") || n.includes("derived from") || n.includes("following up on")) return "derived_from";

  if (similarity >= 0.88) return "informed";

  return null;
}

async function createCausalEdgesAsync(
  newMemoryId: string,
  newContent: string,
  embedding: number[]
): Promise<void> {
  try {
    const candidates = await searchPoints(
      COLLECTIONS.LONG_TERM, embedding, 3, 0.82
    ) as any[];

    for (const candidate of candidates) {
      if (candidate.id === newMemoryId) continue;
      const edgeType = inferCausalEdgeType(newContent, candidate.payload?.content || "", candidate.score);
      if (!edgeType) continue;

      const evidence = createHash("sha256")
        .update(candidate.payload?.content || "")
        .digest("hex")
        .slice(0, 16);

      const edgeId = generateUUID();
      const linkText = `${newMemoryId} ${edgeType} ${candidate.id}`;
      const linkEmbedding = await generateEmbedding(linkText);
      if (!linkEmbedding) continue;

      await storePoint(COLLECTIONS.LINKS, edgeId, linkEmbedding, {
        source_id: newMemoryId,
        target_id: candidate.id as string,
        edge_type: edgeType,
        relationship: edgeType,
        confidence: candidate.score,
        strength: candidate.score,
        timestamp: new Date().toISOString(),
        evidence,
        auto_generated: true,
      });
    }
  } catch {
    // Fire-and-forget: causal edge creation must never block memory_store
  }
}

// Helper to update payload fields on existing Qdrant points (without re-uploading vector)
async function updatePayload(
  collection: string,
  ids: string[],
  payload: Record<string, unknown>
): Promise<void> {
  await qdrantRequest("POST", `/collections/${collection}/points/payload`, {
    payload,
    points: ids,
  });
}

// Create server
const server = new McpServer({
  name: "claude-memory",
  version: "2.0.0",
});

// HTTP-exposed tool registry — the governance HTTP server's /tools/call allowlist.
// Registrations are intercepted so the HTTP bridge dispatches to the exact same
// handlers and zod schemas as the MCP surface (no duplicated logic). Only tools
// named here are callable over HTTP; everything else remains MCP/stdio-only.
// Consumers: the scheduled n8n governance-sweep workflows (semantic-diff,
// memory-verify-sweep, red-team-scan, compliance-dashboard, formal-verify,
// self-assessment-report, organize-clusters, contradiction-check).
const HTTP_TOOL_ALLOWLIST = new Set([
  "memory_recall",
  "semantic_diff",
  "memory_verify",
  "red_team",
  "compliance_dashboard",
  "formal_verify",
  "self_assess",
  "memory_organize",
  "contradiction_check",
]);
const httpExposedTools = new Map<string, (args: unknown) => Promise<unknown>>();
{
  const originalTool = server.tool.bind(server);
  (server as any).tool = (name: string, ...rest: any[]) => {
    if (HTTP_TOOL_ALLOWLIST.has(name) && rest.length >= 2) {
      const handler = rest[rest.length - 1];
      const shape = rest[rest.length - 2];
      if (typeof handler === "function" && shape && typeof shape === "object") {
        httpExposedTools.set(name, async (args: unknown) =>
          handler(z.object(shape as z.ZodRawShape).parse(args ?? {}))
        );
      }
    }
    return (originalTool as any)(name, ...rest);
  };
}

// Option 5: Noguchi Self-Organizing — track recalled memory IDs per session.
// E3 (PRD §4.2): + lastRecalledAt drives recency_weight() for coactivation spreading-activation.
const sessionRecalledIds: Map<
  string,
  { tier: string; count: number; lastRecalledAt: number }  // lastRecalledAt = epoch ms
> = new Map();

// ============================================
// E3: Coactivation Recall Signal (Spreading Activation) — PRD §4
// A 5th multiplicative factor on combined_score: a candidate is boosted when it is
// linked (in the Qdrant memory_links collection) to memories recently recalled this
// session. Read-only, gated (cold-session skip + top-N), fail-open. Spec: TODO/spec-E3-coactivation.md.
// ============================================

// E3 tunables (PRD §4.2.3 / §4.4).
export const COACTIVATION_GAIN_K = 0.1;
export const COACTIVATION_CAP = 1.5;
export const DEFAULT_EDGE_WEIGHT = 1.0;
// E3 (PRD §4.2 + §4.4): aggressive recency decay — half-life 2h, "hours not days".
export const COACTIVATION_RECENCY_HALFLIFE_MS = 2 * 60 * 60 * 1000; // 2 hours
export const COACTIVATION_RECENCY_FLOOR = 0.05; // ids below this are dropped from the recent set (≈8.6h)
export const LINK_SCROLL_LIMIT = 1000; // bound rows per direction; with N≤30 candidates this is generous headroom

// Returns a weight in (0, 1]; 1.0 at age 0, 0.5 at 2h, ~0.0055 at 16h.
export function coactivationRecencyWeight(lastRecalledAt: number, nowMs: number): number {
  const ageMs = Math.max(0, nowMs - lastRecalledAt);
  return Math.pow(0.5, ageMs / COACTIVATION_RECENCY_HALFLIFE_MS);
}

/**
 * E3 coactivation: read memory_links for a SET of candidate memory ids from Qdrant.
 * Two scroll round-trips total (outgoing source_id∈ids, incoming target_id∈ids) — D9 undirected.
 * Reuses the established scrollPoints(COLLECTIONS.LINKS, {must:[{key,match}]}) pattern (index.ts:3051/3055/3494/3511),
 * but with match:{any:[...]} for batched set-membership instead of match:{value:x} (precedent: index.ts:8759).
 * Edge weight = payload.strength (the writers' weight field; explicit tool default 1.0, auto-link = similarity),
 *   defaulting to 1.0 when absent/non-finite. NO 'weight' field exists on link payloads.
 * Read-only. Returns triples {candidate_id, neighbor_id, weight}. Caller fails open on throw.
 */
export async function fetchCandidateLinks(
  candidateIds: string[],
): Promise<Array<{ candidate_id: string; neighbor_id: string; weight: number }>> {
  if (candidateIds.length === 0) return [];
  const out: Array<{ candidate_id: string; neighbor_id: string; weight: number }> = [];

  const toWeight = (p: any): number => {
    const s = typeof p?.strength === "number" ? p.strength : Number(p?.strength);
    return Number.isFinite(s) ? s : DEFAULT_EDGE_WEIGHT;
  };

  // The two scrolls are independent (outgoing source_id∈ids, incoming target_id∈ids) — run them
  // concurrently. This is on the warm-path coactivation hot loop, so the round-trips overlap
  // instead of serializing (~halves added latency per warm recall).
  const [outgoing, incoming] = await Promise.all([
    // Outgoing: candidate is the source → neighbor is target_id.
    scrollPoints(
      COLLECTIONS.LINKS,
      { must: [{ key: "source_id", match: { any: candidateIds } }] },
      LINK_SCROLL_LIMIT,
    ) as Promise<Array<{ payload?: any }>>,
    // Incoming: candidate is the target → neighbor is source_id.
    scrollPoints(
      COLLECTIONS.LINKS,
      { must: [{ key: "target_id", match: { any: candidateIds } }] },
      LINK_SCROLL_LIMIT,
    ) as Promise<Array<{ payload?: any }>>,
  ]);
  for (const l of outgoing) {
    const p = l.payload || {};
    if (typeof p.source_id === "string" && typeof p.target_id === "string") {
      out.push({ candidate_id: p.source_id, neighbor_id: p.target_id, weight: toWeight(p) });
    }
  }

  for (const l of incoming) {
    const p = l.payload || {};
    if (typeof p.source_id === "string" && typeof p.target_id === "string") {
      out.push({ candidate_id: p.target_id, neighbor_id: p.source_id, weight: toWeight(p) });
    }
  }

  return out;
}

/**
 * E3: compute coactivation_boost ∈ [1.0, CAP] per candidate id (absent ⇒ caller uses 1.0).
 * Cold-session gate (D7): empty recent set ⇒ empty map, ZERO link queries.
 * Top-N gate (D6): only the strongest limit×3 base-score candidates get a link lookup.
 * Fail-open (D11): any throw ⇒ empty map (every candidate ⇒ 1.0), logged.
 *
 * The optional params exist only as test seams (per spec §7 test plan: T2 spy zero-queries,
 * T3 inject a link, T5 stub a throw, T8 self-exclusion). Production calls pass none, so the
 * defaults reproduce spec §5.2/§5.3 behavior exactly (module sessionRecalledIds, real fetcher, Date.now()).
 */
export async function computeCoactivationBoosts(
  candidates: Array<{ id: string; score: number }>,
  limit: number,
  opts?: {
    recentHistory?: Map<string, { lastRecalledAt: number }>;
    linkFetcher?: (candidateIds: string[]) => Promise<Array<{ candidate_id: string; neighbor_id: string; weight: number }>>;
    nowMs?: number;
  },
): Promise<Map<string, number>> {
  const boosts = new Map<string, number>();   // default: absent ⇒ caller uses 1.0
  const nowMs = opts?.nowMs ?? Date.now();
  const history = opts?.recentHistory ?? sessionRecalledIds;
  const linkFetcher = opts?.linkFetcher ?? fetchCandidateLinks;

  // D7 cold-session gate: build the recent set with recency weights, drop stale ids.
  // Eviction (leak fix): entries whose recency_weight has decayed below the floor are
  // already dead to every consumer (excluded from recentSet here, and recencyWeight is
  // monotonically decreasing as nowMs advances, so a sub-floor entry can never re-cross it).
  // Delete them from the backing history Map to bound its unbounded growth + the per-recall
  // O(total-unique-recalls-ever) iteration cost. This runs ONLY on a real recall — the cold
  // no-recall fast path never reaches here, so eviction adds no I/O and never fires when no
  // recall is happening. We never evict an id we're about to update: the just-recalled ids
  // are re-inserted fresh AFTER scoring (write-back loop ~line 1900) with w≈1.0, well above
  // the floor. Mutating the Map mid-iteration is safe (Map.delete during for…of is defined).
  const recentSet = new Map<string, number>(); // memoryId -> recency_weight
  for (const [id, info] of history.entries()) {
    const w = coactivationRecencyWeight(info.lastRecalledAt, nowMs);
    if (w >= COACTIVATION_RECENCY_FLOOR) recentSet.set(id, w);
    else history.delete(id);  // prune stale: dead to every consumer, can never recover
  }
  if (recentSet.size === 0) return boosts;        // cold session → all boosts 1.0, zero Qdrant calls

  // D6 top-N gate: only the strongest base candidates get a link lookup.
  const topN = [...candidates]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, Math.max(1, limit * 3));
  const candidateIds = topN.map((c) => c.id);
  if (candidateIds.length === 0) return boosts;
  const candidateSet = new Set(candidateIds);

  // D11 FAIL-OPEN: any throw below → return empty map → caller uses 1.0 for all.
  try {
    // Read links for the top-N candidates from the Qdrant memory_links collection.
    const neighborRows = await linkFetcher(candidateIds);

    // Aggregate Σ(edge_weight · recency_weight(neighbor)) over neighbors in the recent set.
    const sums = new Map<string, number>();
    for (const row of neighborRows) {
      if (!candidateSet.has(row.candidate_id)) continue;          // safety: only score real candidates
      if (row.neighbor_id === row.candidate_id) continue;         // D10 self-exclusion (self-link)
      const rw = recentSet.get(row.neighbor_id);
      if (rw === undefined) continue;                             // neighbor not recently recalled
      const w = Number.isFinite(row.weight) ? row.weight : DEFAULT_EDGE_WEIGHT;
      sums.set(row.candidate_id, (sums.get(row.candidate_id) ?? 0) + w * rw);
    }

    for (const [cid, s] of sums.entries()) {
      const boost = Math.min(COACTIVATION_CAP, 1 + COACTIVATION_GAIN_K * s);
      boosts.set(cid, Math.max(1.0, boost));                      // clamp [1.0, CAP]
    }
  } catch (err) {
    console.warn(`[coactivation] fail-open: ${(err instanceof Error ? err.message : String(err)).slice(0, 200)}`);
    return new Map(); // explicit: every candidate → 1.0
  }

  return boosts;
}

// ============================================
// E4 — GRAPH-FIRST QUERY ROUTING (PRD §5 / spec TODO/spec-E4-graph-first.md)
// A heuristic classifier routes relationship-anchored queries to a graph-first path:
// resolve a project-scoped anchor (1 reused-embedding vector search), traverse the Qdrant
// memory_links graph 2 hops (reusing E3's fetchCandidateLinks), hydrate neighbors by id,
// and rank them through the SAME E1/E2/E3 5-factor pipeline + a 6th graph-distance factor.
// Fail-open everywhere: ordinary queries (no relationship intent) return BEFORE any graph
// I/O so the GRAPH_DISTANCE factor stays 1.0 on the vector-first path (graph-first-specific
// ranking does not apply); any graph error/empty set falls back transparently to vector-first.
// NOTE: vector-first ranking is identical to pre-E4 behavior ONLY in a COLD session (no recent
// recalls). Once coactivation is warm, E3's coactivation_boost (≥1.0) applies on ALL recalls,
// including vector-first, and legitimately changes combined_score/ranking — this is intended.
// All opts? params are test seams (production passes none).
// ============================================

// E4 (PRD §5.2): relationship-intent phrases. Ordered by specificity; any hit ⇒ intent.
// Pure heuristic — NO LLM, NO network. Sub-millisecond. Conservative on purpose:
// false-negative (miss an intent → vector-first) is harmless (default unchanged);
// false-positive (spurious graph-first) is bounded by anchor-resolution gating + fail-open.
// NOTE (spec §4.1 fidelity): the dependency phrases ("depends on" / "dependent on") are
// gated behind a relational lead-in (what/which/who/that/everything/anything/nothing) so
// "I depend on caffeine" does NOT route graph-first while "what depends on the auth decision"
// does. The spec's prose example ("I depend on coffee" → vector-first) and its own T1 case
// require this; a bare "depends? on" alternative would false-positive on personal-subject
// sentences. All other relational phrases match directly.
export const RELATIONSHIP_INTENT_RE =
  /\b(connected to|connections? (of|to|between)|related to|relationship(s)? (with|between|of)|linked to|links? to|(?:what|which|who|that|everything|anything|nothing|things?) (?:\w+ )*?depend(?:s|ent)? on|associated with|tied to|what(?:'s| is) (?:linked|connected|related)|everything (?:about|linked|connected|related)|neighbou?rs? of|edges? (?:from|to))\b/i;

export function detectRelationshipIntent(query: string): boolean {
  return RELATIONSHIP_INTENT_RE.test(query);
}

// E4 anchor-resolution floor: anchor must be a reasonably strong semantic hit,
// else we have no trustworthy graph entry point → fall back to vector-first.
export const ANCHOR_MIN_SIM = 0.55;

// Resolve the single best anchor memory id for a relationship query.
// Reuses the query embedding already computed in the recall handler (no re-embed).
// Returns null if nothing clears ANCHOR_MIN_SIM (→ caller routes vector-first).
export async function resolveAnchor(
  queryEmbedding: number[],
  projectFilter: Record<string, unknown> | undefined,
  opts?: { searcher?: (vec: number[], limit: number, threshold: number, filter?: any) => Promise<any[]> },
): Promise<{ id: string; score: number; tier: string; payload: any } | null> {
  const searcher = opts?.searcher
    ?? ((vec, limit, threshold, filter) => searchPoints(COLLECTIONS.LONG_TERM, vec, limit, threshold, filter) as Promise<any[]>);
  try {
    const hits = await searcher(queryEmbedding, 1, ANCHOR_MIN_SIM, projectFilter);
    const top = hits?.[0];
    if (!top || typeof top.id !== "string") return null;
    return { id: top.id, score: top.score ?? 0, tier: "long_term", payload: top.payload ?? {} };
  } catch {
    return null; // fail-open: unresolved anchor → vector-first
  }
}

// E4 (PRD §5.2): classify + resolve in one call. Pure-intent gate first (no I/O on
// the common path), then anchor resolution only if intent present.
export type RecallRoute =
  | { strategy: "graph-first"; anchorId: string; anchorScore: number }
  | { strategy: "vector-first" };

export async function classifyAndResolve(
  query: string,
  queryEmbedding: number[],
  projectFilter: Record<string, unknown> | undefined,
  opts?: { resolver?: typeof resolveAnchor },
): Promise<RecallRoute> {
  if (!detectRelationshipIntent(query)) return { strategy: "vector-first" }; // AC1 fast path, ZERO I/O
  const resolve = opts?.resolver ?? resolveAnchor;
  const anchor = await resolve(queryEmbedding, projectFilter);
  if (!anchor) return { strategy: "vector-first" };                          // AC3 unresolved → fallback
  return { strategy: "graph-first", anchorId: anchor.id, anchorScore: anchor.score };
}

// E4 traversal config.
export const GRAPH_MAX_HOPS = 2;          // PRD §5.2: "bounded depth, e.g. 2"
export const GRAPH_MAX_NODES = 200;       // safety cap on hydration set size
// Graph-distance ranking factor: closer hops rank higher. Anchor(0)=1.0, hop1=0.85, hop2=0.7.
export const GRAPH_DISTANCE_FACTORS = [1.0, 0.85, 0.7];

// BFS over memory_links to GRAPH_MAX_HOPS using E3's fetchCandidateLinks per frontier.
// Returns id -> minimum hop distance (anchor = 0). Excludes nothing yet; caller hydrates.
//
// DEFENSE-IN-DEPTH NOTE (cross-project frontier): this is a pure ID-graph BFS — fetchCandidateLinks
// returns only {candidate_id, neighbor_id, weight} from link payloads, so a node's `project` is NOT
// known mid-traversal. Pruning cross-project nodes BEFORE they enter the frontier would require the
// memory_links payloads themselves to carry `project` (a writer-side schema change + backfill — a
// larger change deferred here). Project enforcement therefore happens at hydration time in
// buildGraphFirstCandidates via passesGraphProjectScope (fail-closed; the surfacing path is already
// closed). Frontier-level pruning is a CONSCIOUS DEFERRAL, not an oversight: a cross-project node can
// be transiently walked as a BFS waypoint but can never be surfaced, and the bounded maxNodes/maxHops
// cap the blast radius. Revisit if link payloads gain a `project` field.
export async function traverseLinks(
  anchorId: string,
  opts?: { linkFetcher?: typeof fetchCandidateLinks; maxHops?: number; maxNodes?: number },
): Promise<Map<string, number>> {
  const linkFetcher = opts?.linkFetcher ?? fetchCandidateLinks;
  const maxHops = opts?.maxHops ?? GRAPH_MAX_HOPS;
  const maxNodes = opts?.maxNodes ?? GRAPH_MAX_NODES;

  const dist = new Map<string, number>([[anchorId, 0]]);
  let frontier = [anchorId];
  for (let hop = 1; hop <= maxHops && frontier.length > 0 && dist.size < maxNodes; hop++) {
    const rows = await linkFetcher(frontier);                 // E3 helper, both directions
    const next: string[] = [];
    for (const row of rows) {
      const nb = row.neighbor_id;
      if (nb === row.candidate_id) continue;                  // self-link
      if (!dist.has(nb)) {                                    // first time seen = shortest hop
        dist.set(nb, hop);
        next.push(nb);
        if (dist.size >= maxNodes) break;
      }
    }
    frontier = next;
  }
  return dist;
}

// E4: hydrate a set of memory ids across the Qdrant tier collections, preferring
// the HOT-est tier a given id is found in (mirrors recall's tier precedence).
// Tier order matches the merge order's intent: hot > warm > long_term > short_term.
export const HYDRATION_TIERS: Array<{ tier: string; collection: string }> = [
  { tier: "hot",        collection: COLLECTIONS.HOT },
  { tier: "warm",       collection: COLLECTIONS.WARM },
  { tier: "long_term",  collection: COLLECTIONS.LONG_TERM },
  { tier: "short_term", collection: COLLECTIONS.SHORT_TERM },
];

export async function hydrateAcrossTiers(
  ids: string[],
  opts?: { fetcher?: typeof getPointsByIds; tiers?: typeof HYDRATION_TIERS },
): Promise<Map<string, { id: string; payload: any; tier: string }>> {
  const fetcher = opts?.fetcher ?? getPointsByIds;
  const tiers = opts?.tiers ?? HYDRATION_TIERS;
  const found = new Map<string, { id: string; payload: any; tier: string }>();
  let remaining = [...new Set(ids)];
  for (const { tier, collection } of tiers) {
    if (remaining.length === 0) break;
    const pts = await fetcher(collection, remaining, true);          // batch
    for (const p of pts) {
      if (typeof p.id === "string" && !found.has(p.id)) {
        found.set(p.id, { id: p.id, payload: p.payload ?? {}, tier });
      }
    }
    remaining = remaining.filter((id) => !found.has(id));
  }
  return found;
}

// E4: hop → multiplicative factor. Anchor/0 = 1.0, hop1 = 0.85, hop2 = 0.7.
// Out-of-range hops clamp to the last (deepest) factor.
export function graphDistanceFactor(hop: number): number {
  if (hop < 0) return 1.0;
  return GRAPH_DISTANCE_FACTORS[Math.min(hop, GRAPH_DISTANCE_FACTORS.length - 1)];
}

// E4 (spec §11 R6): a hydrated graph neighbor could belong to a DIFFERENT project than the
// query's. Anchor resolution is project-scoped, but fetchCandidateLinks/hydration are not.
// This is a correctness/privacy filter: keep a node only if its payload.project matches the
// active project OR "global" (mirrors recall's projectFilter.should semantics). When the
// caller resolves no project scope (include_all_projects), every node is kept.
//
// CISO HIGH remediation (cross-project tenancy gap): an UNSCOPED neighbor (no payload.project)
// is now FAIL-CLOSED on the graph-first path — it is DROPPED, not kept. Legacy/unscoped
// memories belonging to another project could otherwise be walked into the BFS frontier and
// surfaced when recalling in a different project, making graph-first MORE permissive than
// vector-first (whose Qdrant `should:[project, global]` filter never returns unscoped points).
// The ANCHOR is exempt: it was resolved via a project-scoped vector search, so an
// unscoped-but-legitimate anchor must not be dropped. `isAnchor` flags that exemption.
export function passesGraphProjectScope(
  payload: any,
  activeProject: string | undefined,
  isAnchor: boolean = false,
): boolean {
  if (!activeProject) return true;                 // include_all_projects → no scoping
  const p = payload?.project;
  if (p === undefined || p === null) {
    // Unscoped node: keep ONLY if it is the project-validated anchor; otherwise FAIL-CLOSED.
    return isAnchor;
  }
  return p === activeProject || p === "global";
}

// E4: a hydrated graph-first node honors the same created_after/last_accessed_after time bounds
// the vector-first path applies via combinedFilter. Without this, graph-first would silently
// ignore those recall args (anchor resolution + neighbor hydration are not time-filtered). A node
// is kept only if BOTH requested bounds are satisfied; missing timestamps fail the active bound
// (mirrors Qdrant `range: { gte }`, which never matches a point lacking the field). Bounds absent
// ⇒ no constraint. The ANCHOR is NOT exempt: vector-first applies the same bounds to all hits.
export function passesGraphTimeBounds(
  payload: any,
  createdAfter: string | undefined,
  lastAccessedAfter: string | undefined,
): boolean {
  if (createdAfter) {
    const c = payload?.created_at;
    if (typeof c !== "string" || c < createdAfter) return false;
  }
  if (lastAccessedAfter) {
    const a = payload?.last_accessed_at;
    if (typeof a !== "string" || a < lastAccessedAfter) return false;
  }
  return true;
}

// E4: build graph-first candidate set in the {id,score,payload,tier,graph_distance} shape
// the shared scoring map consumes. Throws → caller falls open to vector-first.
// `activeProject` (undefined when include_all_projects) drives the R6 post-hydration filter.
// `timeBounds` (created_after/last_accessed_after) makes graph-first honor the SAME time-range
// recall args as vector-first — without it those args were silently ignored on the graph path.
export async function buildGraphFirstCandidates(
  anchorId: string,
  activeProject: string | undefined,
  opts?: {
    traverser?: typeof traverseLinks;
    hydrator?: typeof hydrateAcrossTiers;
    timeBounds?: { createdAfter?: string; lastAccessedAfter?: string };
  },
): Promise<Array<{ id: string; score: number; payload: any; tier: string; graph_distance: number }>> {
  const traverse = opts?.traverser ?? traverseLinks;
  const hydrate = opts?.hydrator ?? hydrateAcrossTiers;
  const createdAfter = opts?.timeBounds?.createdAfter;
  const lastAccessedAfter = opts?.timeBounds?.lastAccessedAfter;

  const dist = await traverse(anchorId);                 // id -> hop (anchor=0)
  const ids = [...dist.keys()];
  if (ids.length <= 1) {                                  // only the anchor, no links
    // JUST the anchor with no neighbors → caller treats this as "no graph value" and falls
    // back to vector-first (§5.5) to avoid returning a degenerate result. Return [].
    return [];
  }
  const hydrated = await hydrate(ids);                    // ≤4 batch round-trips
  const out: Array<{ id: string; score: number; payload: any; tier: string; graph_distance: number }> = [];
  for (const [id, hop] of dist.entries()) {
    const h = hydrated.get(id);
    if (!h) continue;                                     // not in any Qdrant tier (e.g. deleted) → skip
    // R6: cross-project leakage guard. Anchor (hop 0) is exempt from the fail-closed unscoped
    // rule — it was resolved via a project-scoped vector search and is already validated.
    if (!passesGraphProjectScope(h.payload, activeProject, id === anchorId)) continue;
    // Stage #9 REQ-S0-002 parity: graph-first honors created_after/last_accessed_after like
    // vector-first does. Applied to every node (anchor included) to match the vector path.
    if (!passesGraphTimeBounds(h.payload, createdAfter, lastAccessedAfter)) continue;
    out.push({ id, score: 1.0, payload: h.payload, tier: h.tier, graph_distance: hop });
  }
  return out;
}

// ============================================
// LONG-TERM MEMORY TOOLS (Original)
// ============================================

server.tool(
  "memory_store",
  "Store information in persistent long-term memory with semantic embeddings. Use for preferences, facts, decisions, and context that should persist across sessions.",
  StoreMemorySchema.shape,
  async (args) => {
    try {
      const embedding = await generateEmbedding(args.content);
      if (!embedding) throw new Error("Failed to generate embedding");

      let sensitivity: SensitivityLevel;
      let classifier: string;
      if (args.sensitivity) {
        sensitivity = args.sensitivity;
        classifier = "manual";
      } else {
        const classification = await classifyMemory(args.content);
        sensitivity = classification.level;
        classifier = classification.classifier;
      }

      const expires_at = computeExpiresAt(sensitivity);
      const id = generateUUID();
      const now = new Date().toISOString();
      // E1: resolve & persist sector (explicit wins, else inferred from type).
      const resolvedSector = inferSector({ sector: args.sector, type: args.type });
      // E2/Q4: resolve half-life at write time, AFTER sector is known.
      // Order: explicit arg -> sector default -> 90.
      const resolvedHalflifeDays =
        (typeof args.decay_halflife_days === "number" && args.decay_halflife_days > 0)
          ? args.decay_halflife_days
          : (SECTOR_HALFLIFE_DAYS[resolvedSector] ?? DEFAULT_HALFLIFE_DAYS);

      // ── Feature 1: resolve provenance + use-policy (server-authoritative) ──
      // Single source of truth: resolveUsePolicy (pure, unit-tested). On a
      // policy violation the write is REJECTED — nothing is stored.
      const source = args.source ?? null;
      const usePolicy = resolveUsePolicy({
        source,
        provenance_status: args.provenance_status,
        can_use_as_instruction: args.can_use_as_instruction,
        can_use_as_evidence: args.can_use_as_evidence,
        requires_user_confirmation: args.requires_user_confirmation,
      });
      if (usePolicy.violation) {
        // HARD GATE: client cannot mark a low-trust memory as instruction-usable.
        // Mirrors the integrity hook's fail-closed contract for policy violations.
        await logAudit("policy_reject", {
          reason: usePolicy.reason,
          provenance_status: usePolicy.provenance_status,
          source,
          content_preview: args.content.slice(0, 80),
        }).catch(() => {});
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: `PolicyViolation: ${usePolicy.reason}`,
            }, null, 2),
          }],
          isError: true,
        };
      }
      const provenance_status = usePolicy.provenance_status;
      const can_use_as_instruction = usePolicy.can_use_as_instruction;
      const can_use_as_evidence = usePolicy.can_use_as_evidence;
      const requires_user_confirmation = usePolicy.requires_user_confirmation;

      const payload = {
        content: args.content,
        type: args.type,
        sector: resolvedSector,
        tags: args.tags || [],
        project: args.project || ACTIVE_PROJECT,
        created_at: now,
        tier: "long_term",
        sensitivity,
        expires_at,
        // REQ-EVO-002: Temporal reasoning fields
        temporal_class: args.temporal_class || "permanent",
        decay_halflife_days: resolvedHalflifeDays,
        deadline_date: args.deadline_date || null,
        last_verified_date: args.last_verified_date || now,
        // Feature 1: provenance & use-policy (all server-resolved above).
        source,
        provenance_status,
        can_use_as_instruction,
        can_use_as_evidence,
        requires_user_confirmation,
      };

      await storePoint(COLLECTIONS.LONG_TERM, id, embedding, payload);

      // REQ-EVO-001: Fire-and-forget causal edge detection
      createCausalEdgesAsync(id, args.content, embedding).catch(() => {});

      await logAudit("store", {
        collection: COLLECTIONS.LONG_TERM,
        memory_id: id,
        sensitivity,
        classifier,
        content_preview: args.content.slice(0, 80),
        project: args.project || ACTIVE_PROJECT,
        tags: args.tags || [],
      }, sensitivity, args.project || ACTIVE_PROJECT);

      await logAudit("classify", {
        memory_id: id,
        assigned_level: sensitivity,
        classifier_used: classifier,
      }, sensitivity, args.project || ACTIVE_PROJECT);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            id,
            sensitivity,
            expires_at,
            classifier,
            project: args.project || ACTIVE_PROJECT,
            // Feature 1: echo resolved use-policy so callers see what was applied.
            provenance_status,
            can_use_as_instruction,
            requires_user_confirmation,
            message: `Memory stored (${sensitivity}, project: ${args.project || ACTIVE_PROJECT})${expires_at ? `, expires ${expires_at}` : ""}`,
          }, null, 2),
        }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error storing memory: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

async function handleMemoryRecall(args: z.infer<typeof RecallMemorySchema>) {
    try {
      // Feature 2: generate the trace_id EARLY so the response can include it even
      // if the (fire-and-forget) trace write is slow or the PG is down.
      const trace_id = generateUUID();
      const embedding = await generateEmbedding(args.query);
      if (!embedding) throw new Error("Failed to generate embedding");
      const limit = args.limit || 5;

      // Project scoping: filter to current project + "global" unless include_all_projects
      const projectFilter = args.include_all_projects ? undefined : {
        should: [
          { key: "project", match: { value: args.project || ACTIVE_PROJECT } },
          { key: "project", match: { value: "global" } },
        ],
      };

      // Stage #9 REQ-S0-002: combine project filter with optional time-range filters.
      // CISO S0-002-A: project-scope is preserved.
      const mustClauses: any[] = [];
      if (args.created_after) mustClauses.push({ key: "created_at", range: { gte: args.created_after } });
      if (args.last_accessed_after) mustClauses.push({ key: "last_accessed_at", range: { gte: args.last_accessed_after } });
      const combinedFilter: any = (() => {
        if (mustClauses.length === 0) return projectFilter;
        if (!projectFilter) return { must: mustClauses };
        return { must: mustClauses, should: projectFilter.should };
      })();

      // Stage #9 REQ-S0-003: precompute rare tokens once for exact-token boost.
      // E4: hoisted ABOVE the search-block guard so the graph-first scoring map (which also
      // computes exact_token_boost) can use it on the graph path.
      const rareTokens = extractRareTokens(args.query);

      // E4 (PRD §5.2): classify query + resolve anchor. Pure-intent gate first (no I/O on
      // the common path) → ordinary queries return vector-first with ZERO added I/O (AC1).
      // Anchor RESOLUTION is project-scoped (projectFilter), not combinedFilter — so the anchor
      // SELECTION step won't honor created_after/last_accessed_after (acceptable, spec §11 minor).
      // The resolved candidate set (anchor + neighbors) IS time-filtered downstream in
      // buildGraphFirstCandidates via timeBounds, so out-of-window nodes never surface.
      const route = await classifyAndResolve(args.query, embedding, projectFilter);
      const activeProjectScope = args.include_all_projects ? undefined : (args.project || ACTIVE_PROJECT);
      let strategy: "graph-first" | "vector-first" = "vector-first";
      let merged: any[] | null = null;

      if (route.strategy === "graph-first") {
        try {
          // Thread created_after/last_accessed_after so graph-first honors the SAME time-range
          // bounds as the vector-first combinedFilter (otherwise they'd be silently ignored).
          const graphCandidates = await buildGraphFirstCandidates(route.anchorId, activeProjectScope, {
            timeBounds: { createdAfter: args.created_after, lastAccessedAfter: args.last_accessed_after },
          });
          if (graphCandidates.length > 0) {
            merged = graphCandidates.map((r) => ({ ...r }));   // already {id,score,payload,tier,graph_distance}
            strategy = "graph-first";
          }
          // empty graph set → leave merged null → vector-first fallback (§5.5)
        } catch (err) {
          console.warn(`[graph-first] fail-open: ${(err instanceof Error ? err.message : String(err)).slice(0, 200)}`);
          merged = null;  // AC3 transparent fallback
        }
      }

      // E4: vector-first path runs ONLY when graph-first did not produce a candidate set
      // (ordinary query, unresolved anchor, degenerate/empty graph, or graph error). The
      // existing 5-tier SEARCH below is unchanged inside this guard; downstream RANKING is
      // unchanged vs. pre-E4 only in a cold session — E3 coactivation_boost still applies to
      // these vector-first results once the session is warm (see computeCoactivationBoosts).
      let collectionsSearched: string[] = [];
      if (merged === null) {
        strategy = "vector-first";

        // Stage #9 REQ-S0-001: skip Qdrant round-trips to known-empty collections (HOT, SHORT_TERM).
        // Cache returns null on error → fall through to normal search (fail-open).
        const hotCount = await getCachedCollectionCount(COLLECTIONS.HOT);
        const shortTermCount = await getCachedCollectionCount(COLLECTIONS.SHORT_TERM);
        const shouldSearchHot = hotCount === null || hotCount > RECALL_SKIP_THRESHOLD;
        const shouldSearchShortTerm = (args.include_short_term !== false) &&
          (shortTermCount === null || shortTermCount > RECALL_SKIP_THRESHOLD);

        // Stage #11: COLD tier search now goes through Postgres tsvector + pg_trgm.
        // C-S11-G: project scope honored (passes args.project and include_all_projects).
        // C-S11-F: searchColdPostgres returns [] on error — does not throw.
        const [hotResults, warmResults, coldResults, longTermResults, shortTermResults] = await Promise.all([
          shouldSearchHot
            ? searchPoints(COLLECTIONS.HOT, embedding, limit, 0.5, combinedFilter).catch(() => [] as unknown[])
            : Promise.resolve([] as unknown[]),
          searchPoints(COLLECTIONS.WARM, embedding, limit, 0.5, combinedFilter).catch(() => [] as unknown[]),
          searchColdPostgres(args.query, {
            limit,
            project: args.project ?? ACTIVE_PROJECT,
            includeAllProjects: args.include_all_projects === true,
            createdAfter: args.created_after ?? null,
            lastAccessedAfter: args.last_accessed_after ?? null,
          }).catch(() => [] as unknown[]),
          searchPoints(COLLECTIONS.LONG_TERM, embedding, limit, 0.5, combinedFilter),
          shouldSearchShortTerm
            ? searchPoints(COLLECTIONS.SHORT_TERM, embedding, limit, 0.5, combinedFilter)
            : Promise.resolve([] as unknown[]),
        ]);

        if (shouldSearchHot) collectionsSearched.push("hot");
        collectionsSearched.push("warm", "cold", "long_term");
        if (shouldSearchShortTerm) collectionsSearched.push("short_term");

        // Merge all results with tier labels
        merged = [
          ...hotResults.map((r: any) => ({ ...r, tier: "hot" })),
          ...warmResults.map((r: any) => ({ ...r, tier: "warm" })),
          ...coldResults.map((r: any) => ({ ...r, tier: "cold" })),
          ...longTermResults.map((r: any) => ({ ...r, tier: "long_term" })),
          ...shortTermResults.map((r: any) => ({ ...r, tier: "short_term" })),
        ];
      } else {
        // E4: graph-first produced the candidate set; record it for the audit trail.
        collectionsSearched = ["graph:memory_links"];
      }

      // E3 (PRD §4.2): compute coactivation boosts BEFORE the synchronous scoring chain.
      // Cold-session/fail-open safe; returns a Map<memoryId, boost> (absent ⇒ 1.0).
      const coactivationBoost = await computeCoactivationBoosts(merged, limit);

      const allResults = merged.map((r: any) => {
        const temporal_score = computeTemporalScore(r.payload || {});
        // Option 4: Forgetting Curve Decay — re-rank by last access recency
        const lastAccessed = r.payload?.last_accessed_at ? new Date(r.payload.last_accessed_at).getTime() : new Date(r.payload?.created_at || Date.now()).getTime();
        const daysSinceAccess = (Date.now() - lastAccessed) / 86400000;
        const halflife = resolveHalflifeDays(r.payload || {});
        const decay_score = Math.pow(0.5, daysSinceAccess / halflife);
        // Stage #9 REQ-S0-003: lexical boost from verbatim rare-token matches in content
        const exact_token_boost = computeExactTokenBoost(r.payload?.content, rareTokens);
        // E3 (PRD §4.2/§4.3): 5th multiplicative factor; default neutral when absent.
        const coactivation_boost = coactivationBoost.get(r.id) ?? 1.0;
        // E4 (PRD §5 / spec §5.6): 6th OPTIONAL multiplicative factor. 1.0 when absent
        // (vector-first results have no graph_distance), so the GRAPH_DISTANCE factor alone
        // is neutral on the vector-first path. This does NOT make combined_score byte-for-byte
        // unchanged: the E3 coactivation_boost factor above can be >1.0 for any vector-first
        // result linked to a recently-recalled memory (warm session) and re-ranks accordingly.
        const graph_distance_factor = typeof r.graph_distance === "number"
          ? graphDistanceFactor(r.graph_distance) : 1.0;
        return {
          ...r,
          temporal_score,
          decay_score,
          exact_token_boost,
          coactivation_boost,                                            // E3: surfaced for explainability (PRD §4.3)
          // E4: surface graph_distance + factor per-result ONLY on the graph path (AC4 explainability).
          ...(typeof r.graph_distance === "number" ? { graph_distance: r.graph_distance, graph_distance_factor } : {}),
          combined_score: r.score * temporal_score * decay_score * exact_token_boost * coactivation_boost * graph_distance_factor,
        };
      })
      // E1 (PRD §2.3): optional sector filter (inferred for legacy memories).
      .filter((r: any) => {
        if (!args.sector) return true;
        return inferSector(r.payload || {}) === args.sector;
      })
      // Deduplicate by content (same memory might exist in multiple tiers)
      .filter((r: any, i: number, arr: any[]) => {
        const content = r.payload?.content;
        return !content || arr.findIndex((x: any) => x.payload?.content === content) === i;
      })
      .sort((a: any, b: any) => b.combined_score - a.combined_score)
      .slice(0, limit);

      const validResults = allResults.filter((r: any) => !isExpired(r));
      const expiredResults = allResults.filter((r: any) => isExpired(r));
      for (const expired of expiredResults) {
        if (expired.tier === "cold") {
          // Stage #11: cold rows live in Postgres now.
          deleteColdRow(expired.id).catch(() => {});
        } else {
          const collection = expired.tier === "short_term" ? COLLECTIONS.SHORT_TERM
            : expired.tier === "hot" ? COLLECTIONS.HOT
            : expired.tier === "warm" ? COLLECTIONS.WARM
            : COLLECTIONS.LONG_TERM;
          deletePoints(collection, [expired.id]).catch(() => {});
        }
        logAudit("expire", {
          memory_id: expired.id,
          sensitivity: expired.payload?.sensitivity || "unknown",
          age_days: Math.floor((Date.now() - new Date(expired.payload?.created_at).getTime()) / 86400000),
        }, expired.payload?.sensitivity || "unknown").catch(() => {});
      }

      await logAudit("recall", {
        query: args.query,
        strategy,                                   // E4 (AC4): explainability in audit trail
        results_count: validResults.length,
        expired_filtered: expiredResults.length,
        collections_searched: collectionsSearched.join(","),
        top_score: validResults.length > 0 ? (validResults[0] as any).score : null,
        project_filter: args.include_all_projects ? "all" : (args.project || ACTIVE_PROJECT),
      });

      // Option 1: LRU Access Tracking — fire-and-forget update access_count and last_accessed_at
      // Option 2: Auto-promote to hot tier after 5+ accesses
      // Option 5: Track recalled IDs for Noguchi self-organizing
      const now = new Date().toISOString();
      for (const result of validResults) {
        const r = result as any;
        // Track for Noguchi: record every recall per session
        const existing = sessionRecalledIds.get(r.id);
        sessionRecalledIds.set(r.id, {
          tier: r.tier,
          count: (existing?.count || 0) + 1,
          lastRecalledAt: Date.now(),  // E3: drives recency_weight() for coactivation
        });
        const tierToCollection: Record<string, string> = {
          short_term: COLLECTIONS.SHORT_TERM,
          hot: COLLECTIONS.HOT,
          warm: COLLECTIONS.WARM,
          cold: COLLECTIONS.COLD,
          long_term: COLLECTIONS.LONG_TERM,
        };
        const collection = tierToCollection[r.tier] || COLLECTIONS.LONG_TERM;
        const currentCount = (r.payload?.access_count || 0) + 1;

        if (r.tier === "cold") {
          // Stage #11: cold rows live in Postgres now — update counter there.
          touchColdAccess(r.id).catch(() => {});
          // Stage #11 promotion path (REQ-S5-004): fire-and-forget re-embed
          // + copy into memories_warm. The Postgres row stays (copy not move).
          (async () => {
            try {
              const row = await getColdRow(r.id);
              if (!row || !row.content) return;
              const emb = await generateEmbedding(row.content);
              if (!emb) return;
              const warmPayload = {
                ...row.payload,
                tier: "warm",
                promoted_from: "cold",
                promoted_at: now,
                content: row.content,
              };
              await storePoint(COLLECTIONS.WARM, r.id, emb, warmPayload);
            } catch {
              // C-S11-I: silently skip if Ollama/Qdrant down.
            }
          })();
        } else {
          updatePayload(collection, [r.id], {
            access_count: currentCount,
            last_accessed_at: now,
          }).catch(() => {});
        }

        // Auto-promote: if access_count >= 5 and not already in hot, copy to hot
        // Stage #11: skip auto-promote for cold rows (they're handled by the cold-specific path above).
        if (currentCount >= 5 && r.tier !== "hot" && r.tier !== "short_term" && r.tier !== "cold") {
          (async () => {
            try {
              const point = await getPoint(collection, r.id, true) as any;
              if (!point?.vector) return;
              const hotPayload = { ...point.payload, tier: "hot", promoted_from: r.tier, promoted_at: now };
              await storePoint(COLLECTIONS.HOT, r.id, point.vector, hotPayload);
              // Stage #9 REQ-S0-001: invalidate HOT count cache so next recall re-checks
              invalidateCollectionSizeCache(COLLECTIONS.HOT);
            } catch {}
          })();
        }
      }

      // Stage #9 REQ-S0-005: optional explicit verification of top result.
      // CISO S0-005-A: re-uses existing memory_verify handler (which already enforces collection scope).
      // NOTE: existing memory_verify is a temporal "mark as accurate" touch, not a semantic verifier;
      // this materializes the literal spec while preserving the recall response shape.
      let finalResults: any[] = validResults as any[];
      if (args.verify_top && finalResults.length > 0) {
        const top = finalResults[0] as any;
        try {
          const tierToCollection: Record<string, string> = {
            short_term: COLLECTIONS.SHORT_TERM,
            hot: COLLECTIONS.HOT,
            warm: COLLECTIONS.WARM,
            cold: COLLECTIONS.COLD,
            long_term: COLLECTIONS.LONG_TERM,
          };
          const topCollection = tierToCollection[top.tier] || COLLECTIONS.LONG_TERM;
          const mem = await getPoint(topCollection, top.id) as any;
          if (mem) {
            const verifiedAt = new Date().toISOString();
            const verificationHistory = mem.payload?.verification_history || [];
            verificationHistory.push({ date: verifiedAt, notes: `verify_top via memory_recall query: ${args.query.slice(0, 120)}` });
            while (verificationHistory.length > 5) verificationHistory.shift();
            await updatePayload(topCollection, [top.id], {
              last_verified_date: verifiedAt,
              verification_history: verificationHistory,
            });
            const updatedPayload = { ...mem.payload, last_verified_date: verifiedAt };
            const new_temporal_score = computeTemporalScore(updatedPayload);
            finalResults[0] = { ...top, verification: { verdict: "pass", verified_at: verifiedAt, new_temporal_score } };
          } else {
            finalResults[0] = { ...top, verification: { verdict: "error", error: "memory not found" } };
          }
        } catch (e) {
          // fail-open: do not break recall on verification error
          finalResults[0] = { ...top, verification: { verdict: "error", error: e instanceof Error ? e.message : String(e) } };
        }
      }

      // Feature 2: fire-and-forget recall trace (never awaited on the hot path;
      // never throws — writeRecallTrace swallows all errors, .catch is belt-and-braces).
      // Built AFTER finalResults is settled so rank/score/tier reflect what was returned.
      writeRecallTrace({
        trace_id,
        query: args.query,
        project: args.include_all_projects ? "all" : (args.project || ACTIVE_PROJECT),
        strategy,
        results: (finalResults as any[]).slice(0, 50).map((r, i) => ({
          memory_id: r.id,
          rank: i + 1,
          score: typeof r.combined_score === "number" ? r.combined_score
                 : (typeof r.score === "number" ? r.score : null),
          tier: r.tier ?? null,
        })),
      }).catch(() => {});

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ success: true, trace_id, project: args.include_all_projects ? "all" : (args.project || ACTIVE_PROJECT), strategy, memories: finalResults }, null, 2),
        }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error recalling memories: ${errorMessage}` }],
        isError: true,
      };
    }
}

server.tool(
  "memory_recall",
  "Search stored memories using semantic similarity. Searches both long-term and optionally short-term memories.",
  RecallMemorySchema.shape,
  handleMemoryRecall
);

// ============================================
// PIN MEMORY (Stage #9b — REQ-S9B-001)
// Pin/unpin a memory so the hippocampal-consolidation workflow does NOT drain
// it out of HOT. Materializes operator-deliberate Option C from REQ-S0-004.
// ============================================

const PinMemorySchema = z.object({
  memory_id: z.string().describe("The Qdrant point id of the memory to pin/unpin"),
  pinned: z.boolean().describe("True to pin (skip consolidation drainage); false to unpin"),
  tier: z.enum(["hot", "warm", "cold", "long_term", "short_term"]).optional()
    .describe("Optional tier hint to avoid scanning all 5 tier collections"),
});

server.tool(
  "pin_memory",
  "Pin or unpin a memory so the hippocampal-consolidation workflow does not drain it out of HOT. Pinned memories persist in their tier until unpinned.",
  PinMemorySchema.shape,
  async (args) => {
    try {
      const tierToCollection: Record<string, string> = {
        short_term: COLLECTIONS.SHORT_TERM,
        hot: COLLECTIONS.HOT,
        warm: COLLECTIONS.WARM,
        cold: COLLECTIONS.COLD,
        long_term: COLLECTIONS.LONG_TERM,
      };

      // Discover the collection (CISO C-S9B-A: must verify memory exists before mutating).
      let foundCollection: string | null = null;
      let foundPayload: Record<string, unknown> | null = null;

      if (args.tier && tierToCollection[args.tier]) {
        const col = tierToCollection[args.tier];
        const p = await getPoint(col, args.memory_id) as { payload?: Record<string, unknown> } | null;
        if (p && p.payload) {
          foundCollection = col;
          foundPayload = p.payload;
        }
      } else {
        // Scan all 5 tier collections in deterministic order.
        for (const t of ["hot", "warm", "cold", "long_term", "short_term"] as const) {
          const col = tierToCollection[t];
          const p = await getPoint(col, args.memory_id) as { payload?: Record<string, unknown> } | null;
          if (p && p.payload) {
            foundCollection = col;
            foundPayload = p.payload;
            break;
          }
        }
      }

      if (!foundCollection || !foundPayload) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: `Memory ${args.memory_id} not found in any tier`,
            }, null, 2),
          }],
          isError: true,
        };
      }

      // CISO C-S9B-B: ONLY modify pinned + pinned_at. All other fields preserved.
      const now = new Date().toISOString();
      const update: Record<string, unknown> = { pinned: args.pinned };
      if (args.pinned) {
        update.pinned_at = now;
      } else {
        update.pinned_at = null;
      }

      await updatePayload(foundCollection, [args.memory_id], update);

      // CISO C-S9B-E: emit audit event.
      const sensitivityField = (foundPayload as { sensitivity?: SensitivityLevel }).sensitivity || "internal";
      const projectField = (foundPayload as { project?: string }).project || ACTIVE_PROJECT;
      await logAudit("pin", {
        memory_id: args.memory_id,
        tier_collection: foundCollection,
        pinned: args.pinned,
      }, sensitivityField, projectField);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            memory_id: args.memory_id,
            tier_collection: foundCollection,
            pinned: args.pinned,
            pinned_at: args.pinned ? now : null,
          }, null, 2),
        }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error pinning memory: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "rag_search",
  "Search the Obsidian vault using semantic similarity to find relevant document chunks.",
  RagSearchSchema.shape,
  async (args) => {
    try {
      const embedding = await generateEmbedding(args.query);
      if (!embedding) throw new Error("Failed to generate embedding");

      const results = await searchPoints(
        COLLECTIONS.OBSIDIAN,
        embedding,
        args.limit || 5,
        args.threshold || 0.4
      );

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ success: true, documents: results }, null, 2),
        }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error searching vault: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

// ============================================
// Option 5: NOGUCHI SELF-ORGANIZING TOOLS
// ============================================

server.tool(
  "session_recalled",
  "Get all memory IDs recalled during this session. Use at SessionEnd to identify which memories were accessed, enabling Noguchi self-organizing boosting.",
  {},
  async () => {
    const entries = Array.from(sessionRecalledIds.entries()).map(([id, info]) => ({
      id,
      tier: info.tier,
      recall_count: info.count,
    }));
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          success: true,
          session_recalls: entries,
          total_unique: entries.length,
          total_recalls: entries.reduce((sum, e) => sum + e.recall_count, 0),
        }, null, 2),
      }],
    };
  }
);

server.tool(
  "memory_boost",
  "Boost a memory's relevance score (Noguchi self-organizing). Call at SessionEnd for memories that were recalled AND actually influenced behavior. Increases decay halflife and resets access timestamp.",
  {
    memory_id: z.string().describe("ID of the memory to boost"),
    boost_reason: z.string().optional().describe("Why this memory was useful (for audit)"),
  },
  async (args) => {
    try {
      const tierToCollection: Record<string, string> = {
        short_term: COLLECTIONS.SHORT_TERM,
        hot: COLLECTIONS.HOT,
        warm: COLLECTIONS.WARM,
        cold: COLLECTIONS.COLD,
        long_term: COLLECTIONS.LONG_TERM,
      };

      // Find the memory in any collection
      let point: any = null;
      let foundCollection = "";
      for (const [tier, col] of Object.entries(tierToCollection)) {
        try {
          const p = await getPoint(col, args.memory_id);
          if (p) {
            point = p;
            foundCollection = col;
            break;
          }
        } catch {}
      }

      if (!point) {
        return {
          content: [{ type: "text" as const, text: "Memory not found in any collection" }],
          isError: true,
        };
      }

      const now = new Date().toISOString();
      const currentHalflife = point.payload?.decay_halflife_days || 90;
      const currentBoosts = point.payload?.noguchi_boost_count || 0;
      // Each boost increases halflife by 30 days (caps at 365)
      const newHalflife = Math.min(currentHalflife + 30, 365);

      await updatePayload(foundCollection, [args.memory_id], {
        decay_halflife_days: newHalflife,
        last_accessed_at: now,
        last_verified_date: now,
        noguchi_boost_count: currentBoosts + 1,
        noguchi_last_boost: now,
        noguchi_boost_reason: args.boost_reason || null,
      });

      await logAudit("noguchi_boost", {
        memory_id: args.memory_id,
        collection: foundCollection,
        old_halflife: currentHalflife,
        new_halflife: newHalflife,
        boost_count: currentBoosts + 1,
        reason: args.boost_reason,
      });

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            memory_id: args.memory_id,
            old_halflife_days: currentHalflife,
            new_halflife_days: newHalflife,
            boost_count: currentBoosts + 1,
            message: `Memory boosted: halflife ${currentHalflife}d → ${newHalflife}d`,
          }, null, 2),
        }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error boosting memory: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

// ============================================
// WORKING MEMORY (SCRATCH SPACE) TOOLS
// ============================================

server.tool(
  "memory_scratch",
  "Working memory scratch space for intermediate reasoning. Ephemeral storage that auto-expires. Use to offload context during complex reasoning.",
  ScratchSchema.shape,
  async (args) => {
    try {
      const { operation, key, content, ttl_minutes, task_id } = args;

      switch (operation) {
        case "create":
        case "update": {
          if (!key || !content) throw new Error("Key and content required for create/update");

          const embedding = await generateEmbedding(content);
          if (!embedding) throw new Error("Failed to generate embedding");

          const id = keyToUUID(`scratch_${key}`);
          const expires_at = new Date(Date.now() + (ttl_minutes || 60) * 60 * 1000).toISOString();

          await storePoint(COLLECTIONS.WORKING, id, embedding, {
            key,
            content,
            task_id: task_id || "default",
            created_at: new Date().toISOString(),
            expires_at,
            tier: "working",
          });

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, key, expires_at, message: `Scratch ${operation}d` }, null, 2),
            }],
          };
        }

        case "read": {
          if (!key) throw new Error("Key required for read");

          try {
            const point = await getPoint(COLLECTIONS.WORKING, keyToUUID(`scratch_${key}`)) as any;
            if (!point) throw new Error("Scratch not found");

            // Check expiration
            if (point.payload?.expires_at && new Date(point.payload.expires_at) < new Date()) {
              await deletePoints(COLLECTIONS.WORKING, [keyToUUID(`scratch_${key}`)]);
              throw new Error("Scratch has expired");
            }

            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({ success: true, key, content: point.payload?.content, expires_at: point.payload?.expires_at }, null, 2),
              }],
            };
          } catch {
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({ success: false, key, message: "Scratch not found or expired" }, null, 2),
              }],
            };
          }
        }

        case "delete": {
          if (!key) throw new Error("Key required for delete");
          await deletePoints(COLLECTIONS.WORKING, [keyToUUID(`scratch_${key}`)]);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, key, message: "Scratch deleted" }, null, 2),
            }],
          };
        }

        case "list": {
          const filter = task_id ? { must: [{ key: "task_id", match: { value: task_id } }] } : undefined;
          const points = await scrollPoints(COLLECTIONS.WORKING, filter, 100);
          const scratches = points.map((p: any) => ({
            key: p.payload?.key,
            task_id: p.payload?.task_id,
            expires_at: p.payload?.expires_at,
            preview: p.payload?.content?.substring(0, 100) + "...",
          }));
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, scratches }, null, 2),
            }],
          };
        }

        case "clear": {
          const filter = task_id
            ? { must: [{ key: "task_id", match: { value: task_id } }] }
            : undefined;
          const points = await scrollPoints(COLLECTIONS.WORKING, filter, 1000);
          const ids = points.map((p: any) => p.id);
          if (ids.length > 0) {
            await deletePoints(COLLECTIONS.WORKING, ids);
          }
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, cleared: ids.length, message: "Scratch space cleared" }, null, 2),
            }],
          };
        }

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error in scratch operation: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

// ============================================
// MEMORY TIER MANAGEMENT
// ============================================

server.tool(
  "memory_promote",
  "Promote memory from one tier to another (working -> short_term -> long_term). Use to preserve important working memory before it expires.",
  PromoteMemorySchema.shape,
  async (args) => {
    try {
      const { memory_id, from_tier, to_tier, type } = args;

      // Determine source collection
      const sourceCollection = from_tier === "working" ? COLLECTIONS.WORKING : COLLECTIONS.SHORT_TERM;
      const destCollection = to_tier === "short_term" ? COLLECTIONS.SHORT_TERM : COLLECTIONS.LONG_TERM;

      // Get source point
      const point = await getPoint(sourceCollection, memory_id) as any;
      if (!point) throw new Error("Memory not found in source tier");

      // Generate new embedding if needed (content might have been modified)
      const content = point.payload?.content;
      if (!content) throw new Error("Memory has no content");

      const embedding = await generateEmbedding(content);
      if (!embedding) throw new Error("Failed to generate embedding");

      // Create new payload for destination
      const newPayload: Record<string, unknown> = {
        ...point.payload,
        tier: to_tier,
        promoted_from: from_tier,
        promoted_at: new Date().toISOString(),
      };

      // Add required fields for long-term
      if (to_tier === "long_term") {
        if (!type) throw new Error("Type required when promoting to long_term");
        newPayload.type = type;
        delete newPayload.expires_at;
      } else {
        // Set new expiration for short-term
        newPayload.expires_at = new Date(Date.now() + TTL.SHORT_TERM).toISOString();
      }

      // Store in destination
      const newId = generateUUID();
      await storePoint(destCollection, newId, embedding, newPayload);

      // Delete from source
      await deletePoints(sourceCollection, [memory_id]);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            old_id: memory_id,
            new_id: newId,
            from_tier,
            to_tier,
            message: "Memory promoted successfully",
          }, null, 2),
        }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error promoting memory: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "memory_summarize",
  "Summarize multiple memories into a consolidated memory. Use to compress verbose memories while preserving key information.",
  SummarizeMemorySchema.shape,
  async (args) => {
    try {
      const { memory_ids, tier } = args;

      // Determine collection
      const collection = tier === "working" ? COLLECTIONS.WORKING
        : tier === "short_term" ? COLLECTIONS.SHORT_TERM
        : COLLECTIONS.LONG_TERM;

      // Fetch all memories
      const memories: string[] = [];
      for (const id of memory_ids) {
        try {
          const point = await getPoint(collection, id) as any;
          if (point?.payload?.content) {
            memories.push(point.payload.content);
          }
        } catch {
          // Skip missing memories
        }
      }

      if (memories.length === 0) {
        throw new Error("No memories found to summarize");
      }

      // Create summary (simple concatenation with marker - in production, use LLM)
      const summary = `[SUMMARIZED from ${memories.length} memories]\n\n` +
        memories.map((m, i) => `[${i + 1}] ${m}`).join("\n\n---\n\n");

      // Store summary
      const embedding = await generateEmbedding(summary);
      if (!embedding) throw new Error("Failed to generate embedding");

      const newId = generateUUID();
      await storePoint(collection, newId, embedding, {
        content: summary,
        type: "context",
        summarized_from: memory_ids,
        created_at: new Date().toISOString(),
        tier,
        is_summary: true,
      });

      // Optionally delete originals (commented out for safety)
      // await deletePoints(collection, memory_ids);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            summary_id: newId,
            source_count: memories.length,
            message: "Memories summarized (originals preserved)",
          }, null, 2),
        }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error summarizing memories: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

// ============================================
// EPISODE MANAGEMENT
// ============================================

server.tool(
  "episode",
  "Manage task episodes for learning. Record task executions with context, actions, and outcomes for future reference.",
  EpisodeSchema.shape,
  async (args) => {
    try {
      const { operation } = args;

      switch (operation) {
        case "start": {
          if (!args.task) throw new Error("Task description required");

          const embedding = await generateEmbedding(args.task);
          if (!embedding) throw new Error("Failed to generate embedding");

          const id = generateUUID();
          const { level: sensitivity, classifier } = await classifyMemory(args.task);
          const expires_at = computeExpiresAt(sensitivity);

          const episodeStartPayload = {
            task: args.task,
            project: args.project || ACTIVE_PROJECT,
            status: "active",
            started_at: new Date().toISOString(),
            agents_invoked: [],
            tools_used: [],
            files_modified: [],
            learnings: [],
            sensitivity,
            expires_at,
          };
          await storePoint(COLLECTIONS.EPISODES, id, embedding, episodeStartPayload);
          // Stage #13 dual-write to memory.episodes (flag-gated, non-fatal).
          await mirrorEpisode(id, episodeStartPayload).catch(() => {});

          await logAudit("store", {
            collection: COLLECTIONS.EPISODES,
            memory_id: id,
            sensitivity,
            classifier,
            content_preview: args.task.slice(0, 80),
          }, sensitivity);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, episode_id: id, status: "active" }, null, 2),
            }],
          };
        }

        case "update": {
          if (!args.episode_id) throw new Error("Episode ID required");

          const point = await getPoint(COLLECTIONS.EPISODES, args.episode_id) as any;
          if (!point) throw new Error("Episode not found");

          const payload = point.payload || {};

          // Merge arrays
          if (args.agents_invoked) {
            payload.agents_invoked = [...new Set([...(payload.agents_invoked || []), ...args.agents_invoked])];
          }
          if (args.tools_used) {
            payload.tools_used = [...new Set([...(payload.tools_used || []), ...args.tools_used])];
          }
          if (args.files_modified) {
            payload.files_modified = [...new Set([...(payload.files_modified || []), ...args.files_modified])];
          }
          if (args.learnings) {
            payload.learnings = [...(payload.learnings || []), ...args.learnings];
          }

          payload.updated_at = new Date().toISOString();

          // Re-embed with updated context
          const contextText = `${payload.task} ${payload.agents_invoked?.join(" ")} ${payload.tools_used?.join(" ")}`;
          const embedding = await generateEmbedding(contextText);
          if (!embedding) throw new Error("Failed to generate embedding");

          await storePoint(COLLECTIONS.EPISODES, args.episode_id, embedding, payload);
          // Stage #13 dual-write (flag-gated, non-fatal). Update path: ON CONFLICT
          // DO NOTHING in Postgres means we won't overwrite a row that already exists.
          // For now we accept that the Postgres row reflects state-at-start; final
          // state lands on completion. A future "ON CONFLICT DO UPDATE" path can
          // be added when stricter parity is required.
          await mirrorEpisode(args.episode_id, payload).catch(() => {});

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, episode_id: args.episode_id, message: "Episode updated" }, null, 2),
            }],
          };
        }

        case "complete": {
          if (!args.episode_id) throw new Error("Episode ID required");

          const point = await getPoint(COLLECTIONS.EPISODES, args.episode_id) as any;
          if (!point) throw new Error("Episode not found");

          const payload = point.payload || {};
          payload.status = args.outcome || "completed";
          payload.completed_at = new Date().toISOString();
          payload.duration_ms = new Date().getTime() - new Date(payload.started_at).getTime();

          if (args.learnings) {
            payload.learnings = [...(payload.learnings || []), ...args.learnings];
          }

          const contextText = `${payload.task} ${payload.status} ${payload.learnings?.join(" ")}`;
          const embedding = await generateEmbedding(contextText);
          if (!embedding) throw new Error("Failed to generate embedding");

          await storePoint(COLLECTIONS.EPISODES, args.episode_id, embedding, payload);
          // Stage #13 dual-write (flag-gated, non-fatal). On completion the row
          // may already exist (from `start`) — ON CONFLICT DO NOTHING preserves it.
          await mirrorEpisode(args.episode_id, payload).catch(() => {});

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                episode_id: args.episode_id,
                status: payload.status,
                duration_ms: payload.duration_ms,
              }, null, 2),
            }],
          };
        }

        case "search": {
          if (!args.query) throw new Error("Query required for search");

          const embedding = await generateEmbedding(args.query);
          if (!embedding) throw new Error("Failed to generate embedding");

          const results = await searchPoints(COLLECTIONS.EPISODES, embedding, args.limit || 5, 0.3);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, episodes: results }, null, 2),
            }],
          };
        }

        case "get": {
          if (!args.episode_id) throw new Error("Episode ID required");

          const point = await getPoint(COLLECTIONS.EPISODES, args.episode_id) as any;
          if (!point) throw new Error("Episode not found");

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, episode: point.payload }, null, 2),
            }],
          };
        }

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error in episode operation: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

// ============================================
// LEARNING MANAGEMENT
// ============================================

server.tool(
  "learning",
  "Manage learnings extracted from task executions. Store, search, and apply learnings to improve future performance.",
  LearningSchema.shape,
  async (args) => {
    try {
      const { operation } = args;

      switch (operation) {
        case "store": {
          if (!args.content) throw new Error("Content required");

          const embedding = await generateEmbedding(args.content);
          if (!embedding) throw new Error("Failed to generate embedding");

          const id = generateUUID();
          const { level: sensitivity, classifier } = await classifyMemory(args.content);
          const expires_at = computeExpiresAt(sensitivity);

          await storePoint(COLLECTIONS.LEARNINGS, id, embedding, {
            content: args.content,
            domain: args.domain || "general",
            agent: args.agent,
            error_type: args.error_type,
            project: ACTIVE_PROJECT,
            created_at: new Date().toISOString(),
            applied_count: 0,
            effectiveness_score: null,
            sensitivity,
            expires_at,
          });

          await logAudit("store", {
            collection: COLLECTIONS.LEARNINGS,
            memory_id: id,
            sensitivity,
            classifier,
            content_preview: args.content.slice(0, 80),
          }, sensitivity);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, learning_id: id }, null, 2),
            }],
          };
        }

        case "search": {
          if (!args.query) throw new Error("Query required");

          const embedding = await generateEmbedding(args.query);
          if (!embedding) throw new Error("Failed to generate embedding");

          const must: Record<string, unknown>[] = [];
          if (args.domain) must.push({ key: "domain", match: { value: args.domain } });
          if (args.agent) must.push({ key: "agent", match: { value: args.agent } });
          if (args.error_type) must.push({ key: "error_type", match: { value: args.error_type } });

          const projectShould = [
            { key: "project", match: { value: ACTIVE_PROJECT } },
            { key: "project", match: { value: "global" } },
          ];
          const filter = must.length > 0
            ? { must, should: projectShould }
            : { should: projectShould };
          const results = await searchPoints(COLLECTIONS.LEARNINGS, embedding, args.limit || 5, 0.3, filter);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, learnings: results }, null, 2),
            }],
          };
        }

        case "apply": {
          // Search for relevant learnings and return them formatted for injection
          if (!args.query) throw new Error("Query required");

          const embedding = await generateEmbedding(args.query);
          if (!embedding) throw new Error("Failed to generate embedding");

          const projectShould2 = [
            { key: "project", match: { value: ACTIVE_PROJECT } },
            { key: "project", match: { value: "global" } },
          ];
          const filter = args.agent
            ? { must: [{ key: "agent", match: { value: args.agent } }], should: projectShould2 }
            : { should: projectShould2 };
          const results = await searchPoints(COLLECTIONS.LEARNINGS, embedding, args.limit || 3, 0.4, filter) as any[];

          if (results.length === 0) {
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({ success: true, learnings: [], message: "No relevant learnings found" }, null, 2),
              }],
            };
          }

          // Format for prompt injection
          const formatted = results.map((r: any, i: number) =>
            `[Learning ${i + 1}] ${r.payload?.content}`
          ).join("\n\n");

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                count: results.length,
                formatted_learnings: formatted,
                raw_learnings: results,
              }, null, 2),
            }],
          };
        }

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error in learning operation: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

// ============================================
// BENCHMARKING
// ============================================

server.tool(
  "benchmark",
  "Record and query performance benchmarks. Track agent success rates, execution times, and token usage.",
  BenchmarkSchema.shape,
  async (args) => {
    try {
      const { operation } = args;

      switch (operation) {
        case "record": {
          if (!args.agent || !args.task_type || args.success === undefined) {
            throw new Error("Agent, task_type, and success required");
          }

          const text = `${args.agent} ${args.task_type} ${args.success ? "success" : "failure"}`;
          const embedding = await generateEmbedding(text);
          if (!embedding) throw new Error("Failed to generate embedding");

          const id = generateUUID();
          const benchmarksPayload = {
            agent: args.agent,
            task_type: args.task_type,
            success: args.success,
            duration_ms: args.duration_ms,
            tokens_used: args.tokens_used,
            metadata: args.metadata || {},
            recorded_at: new Date().toISOString(),
          };
          await storePoint(COLLECTIONS.BENCHMARKS, id, embedding, benchmarksPayload);
          // Stage #8 dual-write mirror (flag-gated, non-fatal)
          await mirrorBenchmarks(id, benchmarksPayload);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, benchmark_id: id }, null, 2),
            }],
          };
        }

        case "query": {
          // Get recent benchmarks, optionally filtered
          const filter: Record<string, unknown>[] = [];
          if (args.agent) filter.push({ key: "agent", match: { value: args.agent } });
          if (args.task_type) filter.push({ key: "task_type", match: { value: args.task_type } });

          const filterObj = filter.length > 0 ? { must: filter } : undefined;
          const points = await scrollPoints(COLLECTIONS.BENCHMARKS, filterObj, args.limit || 10);

          // Calculate stats
          const successes = points.filter((p: any) => p.payload?.success).length;
          const total = points.length;
          const avgDuration = points.reduce((sum: number, p: any) => sum + (p.payload?.duration_ms || 0), 0) / (total || 1);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                stats: {
                  total,
                  successes,
                  failures: total - successes,
                  success_rate: total > 0 ? (successes / total * 100).toFixed(1) + "%" : "N/A",
                  avg_duration_ms: Math.round(avgDuration),
                },
                benchmarks: points.map((p: any) => p.payload),
              }, null, 2),
            }],
          };
        }

        case "compare": {
          // Compare performance across agents or task types
          const points = await scrollPoints(COLLECTIONS.BENCHMARKS, undefined, 1000);

          // Group by agent
          const byAgent: Record<string, { success: number; total: number; duration: number }> = {};
          for (const p of points as any[]) {
            const agent = p.payload?.agent || "unknown";
            if (!byAgent[agent]) byAgent[agent] = { success: 0, total: 0, duration: 0 };
            byAgent[agent].total++;
            if (p.payload?.success) byAgent[agent].success++;
            byAgent[agent].duration += p.payload?.duration_ms || 0;
          }

          const comparison = Object.entries(byAgent).map(([agent, stats]) => ({
            agent,
            total: stats.total,
            success_rate: ((stats.success / stats.total) * 100).toFixed(1) + "%",
            avg_duration_ms: Math.round(stats.duration / stats.total),
          })).sort((a, b) => parseFloat(b.success_rate) - parseFloat(a.success_rate));

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, comparison }, null, 2),
            }],
          };
        }

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error in benchmark operation: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

// ============================================
// PROCEDURAL MEMORY
// ============================================

server.tool(
  "procedure",
  "Manage procedural memory - reusable step-by-step patterns extracted from successful task executions. Capture, search, apply, and improve procedures.",
  ProcedureSchema.shape,
  async (args) => {
    try {
      const { operation } = args;

      switch (operation) {
        case "capture": {
          if (!args.name || !args.steps) throw new Error("Name and steps required");

          const searchText = `${args.name} ${args.task_type || ""} ${args.domain || ""} ${args.triggers?.keywords?.join(" ") || ""}`;
          const embedding = await generateEmbedding(searchText);
          if (!embedding) throw new Error("Failed to generate embedding");

          const id = generateUUID();
          const { level: sensitivity, classifier } = await classifyMemory(args.name + " " + (args.task_type || ""));
          const expires_at = computeExpiresAt(sensitivity);

          await storePoint(COLLECTIONS.PROCEDURES, id, embedding, {
            name: args.name,
            task_type: args.task_type,
            domain: args.domain,
            triggers: args.triggers || {},
            steps: args.steps,
            notes: args.notes,
            source_episode: args.episode_id,
            project: ACTIVE_PROJECT,
            created_at: new Date().toISOString(),
            version: 1,
            times_used: 0,
            success_count: 0,
            failure_count: 0,
            status: "new",
            sensitivity,
            expires_at,
          });

          await logAudit("store", {
            collection: COLLECTIONS.PROCEDURES,
            memory_id: id,
            sensitivity,
            classifier,
            content_preview: args.name.slice(0, 80),
          }, sensitivity);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, procedure_id: id, name: args.name }, null, 2),
            }],
          };
        }

        case "search": {
          if (!args.query) throw new Error("Query required");

          const embedding = await generateEmbedding(args.query);
          if (!embedding) throw new Error("Failed to generate embedding");

          const procMust: Record<string, unknown>[] = [];
          if (args.task_type) procMust.push({ key: "task_type", match: { value: args.task_type } });
          if (args.domain) procMust.push({ key: "domain", match: { value: args.domain } });

          const procProjectShould = [
            { key: "project", match: { value: ACTIVE_PROJECT } },
            { key: "project", match: { value: "global" } },
          ];
          const filterObj = procMust.length > 0
            ? { must: procMust, should: procProjectShould }
            : { should: procProjectShould };
          const results = await searchPoints(COLLECTIONS.PROCEDURES, embedding, args.limit || 3, 0.5, filterObj);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, procedures: results }, null, 2),
            }],
          };
        }

        case "apply": {
          if (!args.procedure_id) throw new Error("Procedure ID required");

          const point = await getPoint(COLLECTIONS.PROCEDURES, args.procedure_id) as any;
          if (!point) throw new Error("Procedure not found");

          const procedure = point.payload;

          // Format as few-shot example
          let formatted = `## PROCEDURAL KNOWLEDGE: ${procedure.name}\n\n`;
          formatted += `**Task Type:** ${procedure.task_type || "general"}\n`;
          formatted += `**Success Rate:** ${procedure.times_used > 0 ? ((procedure.success_count / procedure.times_used) * 100).toFixed(0) : "N/A"}%\n`;
          formatted += `**Times Used:** ${procedure.times_used}\n\n`;
          formatted += `### Steps:\n\n`;

          for (const step of procedure.steps || []) {
            formatted += `**Step ${step.step}: ${step.action}**\n`;
            if (step.tools) formatted += `- Tools: ${step.tools.join(", ")}\n`;
            if (step.command_template) {
              let template = step.command_template;
              // Substitute context variables
              if (args.context) {
                for (const [key, value] of Object.entries(args.context)) {
                  template = template.replace(new RegExp(`\\$${key}`, "g"), value);
                }
              }
              formatted += `- Command: \`${template}\`\n`;
            }
            if (step.decision_points) {
              for (const dp of step.decision_points) {
                formatted += `- ⚠️ If ${dp.condition}: ${dp.action}\n`;
              }
            }
            formatted += "\n";
          }

          if (procedure.notes) {
            formatted += `### Notes:\n${procedure.notes}\n`;
          }

          // Update usage count
          procedure.times_used = (procedure.times_used || 0) + 1;
          procedure.last_used = new Date().toISOString();

          const embedding = await generateEmbedding(`${procedure.name} ${procedure.task_type}`);
          if (embedding) {
            await storePoint(COLLECTIONS.PROCEDURES, args.procedure_id, embedding, procedure);
          }

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                formatted_procedure: formatted,
                raw_procedure: procedure,
              }, null, 2),
            }],
          };
        }

        case "feedback": {
          if (!args.procedure_id) throw new Error("Procedure ID required");

          const point = await getPoint(COLLECTIONS.PROCEDURES, args.procedure_id) as any;
          if (!point) throw new Error("Procedure not found");

          const procedure = point.payload;

          if (args.success !== undefined) {
            if (args.success) {
              procedure.success_count = (procedure.success_count || 0) + 1;
            } else {
              procedure.failure_count = (procedure.failure_count || 0) + 1;
            }
          }

          if (args.improvement_notes) {
            procedure.feedback_history = procedure.feedback_history || [];
            procedure.feedback_history.push({
              timestamp: new Date().toISOString(),
              notes: args.improvement_notes,
              refinements: args.refinements,
            });
          }

          // Update status based on metrics
          const totalUses = procedure.times_used || 0;
          const successRate = totalUses > 0 ? procedure.success_count / totalUses : 0;

          if (totalUses >= 10 && successRate >= 0.85) {
            procedure.status = "trusted";
          } else if (totalUses >= 3 && successRate >= 0.7) {
            procedure.status = "proven";
          }

          procedure.updated_at = new Date().toISOString();

          const embedding = await generateEmbedding(`${procedure.name} ${procedure.task_type}`);
          if (embedding) {
            await storePoint(COLLECTIONS.PROCEDURES, args.procedure_id, embedding, procedure);
          }

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                procedure_id: args.procedure_id,
                status: procedure.status,
                success_rate: totalUses > 0 ? (successRate * 100).toFixed(0) + "%" : "N/A",
              }, null, 2),
            }],
          };
        }

        case "list": {
          const filter: Record<string, unknown>[] = [];
          if (args.task_type) filter.push({ key: "task_type", match: { value: args.task_type } });
          if (args.domain) filter.push({ key: "domain", match: { value: args.domain } });

          const filterObj = filter.length > 0 ? { must: filter } : undefined;
          const points = await scrollPoints(COLLECTIONS.PROCEDURES, filterObj, args.limit || 20);

          const procedures = points.map((p: any) => ({
            id: p.id,
            name: p.payload?.name,
            task_type: p.payload?.task_type,
            domain: p.payload?.domain,
            status: p.payload?.status,
            times_used: p.payload?.times_used,
            success_rate: p.payload?.times_used > 0
              ? ((p.payload?.success_count / p.payload?.times_used) * 100).toFixed(0) + "%"
              : "N/A",
          }));

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, procedures }, null, 2),
            }],
          };
        }

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error in procedure operation: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

// ============================================
// TRAJECTORY MEMORY (Few-Shot Learning)
// ============================================

server.tool(
  "trajectory",
  "Store and recall successful execution trajectories for few-shot learning. When similar tasks are attempted, relevant past successes are provided as examples.",
  TrajectorySchema.shape,
  async (args) => {
    try {
      const { operation } = args;

      switch (operation) {
        case "store": {
          if (!args.task_description || !args.execution_trace || !args.outcome) {
            throw new Error("task_description, execution_trace, and outcome required");
          }

          // Only store successful trajectories
          if (!args.outcome.success) {
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  success: false,
                  message: "Only successful trajectories are stored for few-shot learning",
                }, null, 2),
              }],
            };
          }

          const searchText = `${args.task_description} ${args.task_type || ""} ${args.key_decisions?.join(" ") || ""}`;
          const embedding = await generateEmbedding(searchText);
          if (!embedding) throw new Error("Failed to generate embedding");

          const id = generateUUID();
          const { level: sensitivity, classifier } = await classifyMemory(args.task_description);
          const expires_at = computeExpiresAt(sensitivity);

          await storePoint(COLLECTIONS.TRAJECTORIES, id, embedding, {
            task_description: args.task_description,
            task_type: args.task_type,
            execution_trace: args.execution_trace,
            key_decisions: args.key_decisions || [],
            outcome: args.outcome,
            project: ACTIVE_PROJECT,
            created_at: new Date().toISOString(),
            times_recalled: 0,
            helpfulness_score: null,
            helpfulness_count: 0,
            sensitivity,
            expires_at,
          });

          await logAudit("store", {
            collection: COLLECTIONS.TRAJECTORIES,
            memory_id: id,
            sensitivity,
            classifier,
            content_preview: args.task_description.slice(0, 80),
          }, sensitivity);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, trajectory_id: id }, null, 2),
            }],
          };
        }

        case "recall": {
          if (!args.query) throw new Error("Query required");

          const embedding = await generateEmbedding(args.query);
          if (!embedding) throw new Error("Failed to generate embedding");

          const trajProjectFilter = {
            should: [
              { key: "project", match: { value: ACTIVE_PROJECT } },
              { key: "project", match: { value: "global" } },
            ],
          };
          const results = await searchPoints(
            COLLECTIONS.TRAJECTORIES,
            embedding,
            args.limit || 3,
            0.6,
            trajProjectFilter
          ) as any[];

          if (results.length === 0) {
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  success: true,
                  trajectories: [],
                  message: "No similar successful trajectories found",
                }, null, 2),
              }],
            };
          }

          // Format as few-shot examples
          let formatted = "## RELEVANT PAST SUCCESSES (Few-Shot Examples)\n\n";

          for (let i = 0; i < results.length; i++) {
            const traj = results[i].payload;
            formatted += `### Example ${i + 1}: ${traj.task_description}\n\n`;
            formatted += `**Task Type:** ${traj.task_type || "general"}\n`;
            formatted += `**Helpfulness:** ${traj.helpfulness_score ? (traj.helpfulness_score * 100).toFixed(0) + "%" : "Not rated"}\n\n`;
            formatted += `**Execution Steps:**\n`;

            for (const step of traj.execution_trace || []) {
              formatted += `${step.step}. ${step.action}`;
              if (step.tool) formatted += ` [${step.tool}]`;
              if (step.decision) formatted += `\n   → Decision: ${step.decision}`;
              formatted += "\n";
            }

            if (traj.key_decisions?.length) {
              formatted += `\n**Key Decisions:**\n`;
              for (const decision of traj.key_decisions) {
                formatted += `- ${decision}\n`;
              }
            }

            formatted += "\n---\n\n";

            // Update recall count
            traj.times_recalled = (traj.times_recalled || 0) + 1;
            traj.last_recalled = new Date().toISOString();

            const trajEmbedding = await generateEmbedding(`${traj.task_description} ${traj.task_type}`);
            if (trajEmbedding) {
              await storePoint(COLLECTIONS.TRAJECTORIES, results[i].id, trajEmbedding, traj);
            }
          }

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                count: results.length,
                formatted_examples: formatted,
                trajectories: results,
              }, null, 2),
            }],
          };
        }

        case "feedback": {
          if (!args.trajectory_id || args.was_helpful === undefined) {
            throw new Error("trajectory_id and was_helpful required");
          }

          const point = await getPoint(COLLECTIONS.TRAJECTORIES, args.trajectory_id) as any;
          if (!point) throw new Error("Trajectory not found");

          const traj = point.payload;

          // Update helpfulness score (running average)
          const oldCount = traj.helpfulness_count || 0;
          const oldScore = traj.helpfulness_score || 0;
          const newValue = args.was_helpful ? 1 : 0;

          traj.helpfulness_count = oldCount + 1;
          traj.helpfulness_score = (oldScore * oldCount + newValue) / traj.helpfulness_count;
          traj.updated_at = new Date().toISOString();

          const embedding = await generateEmbedding(`${traj.task_description} ${traj.task_type}`);
          if (embedding) {
            await storePoint(COLLECTIONS.TRAJECTORIES, args.trajectory_id, embedding, traj);
          }

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                trajectory_id: args.trajectory_id,
                helpfulness_score: (traj.helpfulness_score * 100).toFixed(0) + "%",
                feedback_count: traj.helpfulness_count,
              }, null, 2),
            }],
          };
        }

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error in trajectory operation: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

// ============================================
// MEMORY SELF-ORGANIZATION (Links, Clusters, Pruning)
// ============================================

server.tool(
  "memory_organize",
  "Self-organizing memory operations: link memories together, find clusters, prune stale memories. Enables knowledge graph relationships and intelligent memory management.",
  MemoryLinkSchema.shape,
  async (args) => {
    try {
      const { operation } = args;

      switch (operation) {
        case "link": {
          if (!args.source_id || !args.target_id || !args.relationship) {
            throw new Error("source_id, target_id, and relationship required");
          }

          const linkText = `${args.source_id} ${args.relationship} ${args.target_id}`;
          const embedding = await generateEmbedding(linkText);
          if (!embedding) throw new Error("Failed to generate embedding");

          const id = keyToUUID(`link_${args.source_id}_${args.target_id}`);
          await storePoint(COLLECTIONS.LINKS, id, embedding, {
            source_id: args.source_id,
            target_id: args.target_id,
            relationship: args.relationship,
            strength: args.strength || 1.0,
            created_at: new Date().toISOString(),
          });

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                link_id: id,
                relationship: args.relationship,
              }, null, 2),
            }],
          };
        }

        case "unlink": {
          if (!args.source_id || !args.target_id) {
            throw new Error("source_id and target_id required");
          }

          const id = keyToUUID(`link_${args.source_id}_${args.target_id}`);
          await deletePoints(COLLECTIONS.LINKS, [id]);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, message: "Link removed" }, null, 2),
            }],
          };
        }

        case "traverse": {
          if (!args.start_id) throw new Error("start_id required");

          const maxDepth = args.max_depth || 2;
          const visited = new Set<string>();
          const graph: Record<string, any[]> = {};

          async function traverseLevel(nodeId: string, depth: number) {
            if (depth > maxDepth || visited.has(nodeId)) return;
            visited.add(nodeId);

            // Find links from this node
            const outgoingFilter = { must: [{ key: "source_id", match: { value: nodeId } }] };
            const outgoing = await scrollPoints(COLLECTIONS.LINKS, outgoingFilter, 50);

            // Find links to this node
            const incomingFilter = { must: [{ key: "target_id", match: { value: nodeId } }] };
            const incoming = await scrollPoints(COLLECTIONS.LINKS, incomingFilter, 50);

            graph[nodeId] = [
              ...outgoing.map((l: any) => ({
                direction: "outgoing",
                target: l.payload?.target_id,
                relationship: l.payload?.relationship,
                strength: l.payload?.strength,
              })),
              ...incoming.map((l: any) => ({
                direction: "incoming",
                source: l.payload?.source_id,
                relationship: l.payload?.relationship,
                strength: l.payload?.strength,
              })),
            ];

            // Filter by relationship type if specified
            if (args.relationship_filter?.length) {
              graph[nodeId] = graph[nodeId].filter(
                (link) => args.relationship_filter!.includes(link.relationship)
              );
            }

            // Recurse
            for (const link of graph[nodeId]) {
              const nextId = link.direction === "outgoing" ? link.target : link.source;
              if (nextId) await traverseLevel(nextId, depth + 1);
            }
          }

          await traverseLevel(args.start_id, 0);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                start_id: args.start_id,
                nodes_visited: visited.size,
                graph,
              }, null, 2),
            }],
          };
        }

        case "cluster": {
          if (!args.query) throw new Error("Query required for clustering");

          const embedding = await generateEmbedding(args.query);
          if (!embedding) throw new Error("Failed to generate embedding");

          // Get candidate memories
          const candidates = await searchPoints(
            COLLECTIONS.LONG_TERM,
            embedding,
            50,
            args.similarity_threshold || 0.85
          ) as any[];

          if (candidates.length < (args.min_cluster_size || 3)) {
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  success: true,
                  message: "Not enough similar memories for clustering",
                  candidates_found: candidates.length,
                  min_required: args.min_cluster_size || 3,
                }, null, 2),
              }],
            };
          }

          // Simple clustering: group by high similarity
          const cluster = {
            members: candidates.map((c: any) => ({
              id: c.id,
              content: c.payload?.content,
              score: c.score,
            })),
            summary_preview: candidates.map((c: any) => c.payload?.content?.substring(0, 50)).join(" | "),
          };

          if (args.action === "identify") {
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  success: true,
                  action: "identify",
                  cluster,
                }, null, 2),
              }],
            };
          }

          if (args.action === "summarize") {
            // Create summary (simple concatenation - in production, use LLM)
            const contents = candidates.map((c: any) => c.payload?.content).filter(Boolean);
            const summary = `[CLUSTER SUMMARY - ${contents.length} memories]\n\n` +
              contents.map((c: string, i: number) => `${i + 1}. ${c}`).join("\n\n");

            const summaryEmbedding = await generateEmbedding(summary);
            if (!summaryEmbedding) throw new Error("Failed to generate summary embedding");

            const summaryId = generateUUID();
            await storePoint(COLLECTIONS.LONG_TERM, summaryId, summaryEmbedding, {
              content: summary,
              type: "context",
              is_cluster_summary: true,
              member_ids: candidates.map((c: any) => c.id),
              created_at: new Date().toISOString(),
              tier: "long_term",
            });

            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  success: true,
                  action: "summarize",
                  summary_id: summaryId,
                  members_summarized: candidates.length,
                  message: "Cluster summarized. Original memories preserved.",
                }, null, 2),
              }],
            };
          }

          if (args.action === "merge") {
            // Merge into single memory, delete originals
            const contents = candidates.map((c: any) => c.payload?.content).filter(Boolean);
            const merged = contents.join("\n\n---\n\n");

            const mergedEmbedding = await generateEmbedding(merged);
            if (!mergedEmbedding) throw new Error("Failed to generate merged embedding");

            const mergedId = generateUUID();
            await storePoint(COLLECTIONS.LONG_TERM, mergedId, mergedEmbedding, {
              content: merged,
              type: "context",
              is_merged: true,
              source_ids: candidates.map((c: any) => c.id),
              created_at: new Date().toISOString(),
              tier: "long_term",
            });

            // Delete originals
            const idsToDelete = candidates.map((c: any) => c.id);
            await deletePoints(COLLECTIONS.LONG_TERM, idsToDelete);

            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  success: true,
                  action: "merge",
                  merged_id: mergedId,
                  memories_merged: idsToDelete.length,
                }, null, 2),
              }],
            };
          }

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, cluster }, null, 2),
            }],
          };
        }

        case "prune": {
          if (!args.criteria) throw new Error("Criteria required for pruning");

          const dryRun = args.dry_run !== false;

          // Build filter based on criteria
          const must: Record<string, unknown>[] = [];

          if (args.criteria.older_than_days) {
            const cutoff = new Date(Date.now() - args.criteria.older_than_days * 24 * 60 * 60 * 1000);
            must.push({
              key: "created_at",
              range: { lt: cutoff.toISOString() },
            });
          }

          // Get candidates
          const filterObj = must.length > 0 ? { must } : undefined;
          const candidates = await scrollPoints(COLLECTIONS.LONG_TERM, filterObj, 1000) as any[];

          // Further filter in code
          let toDelete = candidates;

          if (args.criteria.superseded) {
            // Find memories that have been superseded
            const supersededLinks = await scrollPoints(COLLECTIONS.LINKS, {
              must: [{ key: "relationship", match: { value: "supersedes" } }],
            }, 1000);
            const supersededIds = new Set(supersededLinks.map((l: any) => l.payload?.target_id));
            toDelete = toDelete.filter((m: any) => supersededIds.has(m.id));
          }

          const pruneList = toDelete.map((m: any) => ({
            id: m.id,
            content_preview: m.payload?.content?.substring(0, 100),
            created_at: m.payload?.created_at,
          }));

          if (dryRun) {
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  success: true,
                  dry_run: true,
                  would_delete: pruneList.length,
                  candidates: pruneList.slice(0, 10),
                  message: "Set dry_run=false to actually delete",
                }, null, 2),
              }],
            };
          }

          // Actually delete
          const idsToDelete = toDelete.map((m: any) => m.id);
          if (idsToDelete.length > 0) {
            await deletePoints(COLLECTIONS.LONG_TERM, idsToDelete);
          }

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                deleted: idsToDelete.length,
              }, null, 2),
            }],
          };
        }

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error in memory organization: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "memory_forget",
  "Search for and delete specific memories. Two-step: first search to find matches, then delete with confirmation. Cannot delete audit log entries.",
  MemoryForgetSchema.shape,
  async (args) => {
    try {
      const { mode } = args;

      if (mode === "search") {
        if (!args.query) throw new Error("Query required for search mode");
        const embedding = await generateEmbedding(args.query);
        if (!embedding) throw new Error("Failed to generate embedding");

        const searchCollections = [
          { name: COLLECTIONS.LONG_TERM, label: "long_term" },
          { name: COLLECTIONS.SHORT_TERM, label: "short_term" },
          { name: COLLECTIONS.WORKING, label: "working" },
          { name: COLLECTIONS.LEARNINGS, label: "learnings" },
          { name: COLLECTIONS.PROCEDURES, label: "procedures" },
          { name: COLLECTIONS.TRAJECTORIES, label: "trajectories" },
          { name: COLLECTIONS.EPISODES, label: "episodes" },
        ];

        const allMatches: any[] = [];
        for (const col of searchCollections) {
          if (args.collection && args.collection !== col.label) continue;
          try {
            const results = await searchPoints(col.name, embedding, 5, 0.3);
            for (const r of results as any[]) {
              allMatches.push({
                id: r.id,
                collection: col.label,
                score: r.score,
                sensitivity: r.payload?.sensitivity || "unclassified",
                content_preview: (r.payload?.content || r.payload?.task || r.payload?.name || "").slice(0, 120),
                created_at: r.payload?.created_at,
                expires_at: r.payload?.expires_at,
              });
            }
          } catch { /* skip unhealthy collections */ }
        }
        allMatches.sort((a, b) => b.score - a.score);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              mode: "search",
              matches: allMatches.slice(0, 20),
              message: `Found ${allMatches.length} matches. Use mode=delete with memory_ids and confirm=true to delete.`,
            }, null, 2),
          }],
        };
      }

      if (mode === "delete") {
        if (!args.memory_ids?.length) throw new Error("memory_ids required for delete mode");
        if (!args.confirm) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                message: "Set confirm=true to actually delete. This is a safety check.",
                would_delete: args.memory_ids,
              }, null, 2),
            }],
          };
        }

        const deleted: string[] = [];
        const failed: string[] = [];
        const collectionMap: Record<string, string> = {
          long_term: COLLECTIONS.LONG_TERM,
          short_term: COLLECTIONS.SHORT_TERM,
          working: COLLECTIONS.WORKING,
          learnings: COLLECTIONS.LEARNINGS,
          procedures: COLLECTIONS.PROCEDURES,
          trajectories: COLLECTIONS.TRAJECTORIES,
          episodes: COLLECTIONS.EPISODES,
        };

        for (const memId of args.memory_ids) {
          let found = false;
          const collectionsToTry = args.collection
            ? [{ label: args.collection, name: collectionMap[args.collection] || args.collection }]
            : Object.entries(collectionMap).map(([label, name]) => ({ label, name }));

          for (const col of collectionsToTry) {
            try {
              const point = await getPoint(col.name, memId) as any;
              if (point) {
                await deletePoints(col.name, [memId]);
                deleted.push(memId);
                found = true;
                await logAudit("forget", {
                  memory_id: memId,
                  collection: col.label,
                  content_preview: (point.payload?.content || "").slice(0, 80),
                  sensitivity: point.payload?.sensitivity || "unclassified",
                  reason: args.query || "manual deletion",
                }, point.payload?.sensitivity || "internal");
                break;
              }
            } catch { /* try next collection */ }
          }
          if (!found) failed.push(memId);
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              mode: "delete",
              deleted,
              failed,
              message: `Deleted ${deleted.length} memories. ${failed.length} not found.`,
            }, null, 2),
          }],
        };
      }

      throw new Error(`Unknown mode: ${mode}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error in forget operation: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

// ============================================
// REQ-EVO-001: Causal Memory Graph Tools
// ============================================

server.tool(
  "memory_trace",
  "Trace the causal chain of a memory. Returns upstream causes (what led to this memory) and downstream effects (what this memory influenced) via typed causal edges.",
  MemoryTraceSchema.shape,
  async (args) => {
    try {
      // Verify root memory exists
      const root = await getPoint(COLLECTIONS.LONG_TERM, args.memory_id) as any;
      if (!root) throw new Error(`Memory ${args.memory_id} not found`);

      const direction = args.direction || "both";
      const maxDepth = args.depth || 3;
      const chain: any[] = [];
      const visited = new Set<string>();
      const queue: { id: string; depth: number; edge_type: string | null; direction: string }[] = [
        { id: args.memory_id, depth: 0, edge_type: null, direction: "root" },
      ];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current.id) || current.depth > maxDepth) continue;
        visited.add(current.id);

        // Get memory content
        let memoryData: any = null;
        try {
          memoryData = await getPoint(COLLECTIONS.LONG_TERM, current.id) as any;
        } catch { /* memory may have been deleted */ }

        chain.push({
          id: current.id,
          depth: current.depth,
          edge_type: current.edge_type,
          direction: current.direction,
          content_preview: memoryData?.payload?.content?.slice(0, 120) || "[unavailable]",
          temporal_class: memoryData?.payload?.temporal_class || "permanent",
          temporal_score: memoryData ? computeTemporalScore(memoryData.payload || {}) : 0,
        });

        if (current.depth >= maxDepth) continue;

        // Downstream: this memory is the source
        if (direction === "downstream" || direction === "both") {
          const downstream = await scrollPoints(COLLECTIONS.LINKS, {
            must: [{ key: "source_id", match: { value: current.id } }],
          }, 20) as any[];
          for (const link of downstream) {
            if (!visited.has(link.payload?.target_id)) {
              queue.push({
                id: link.payload.target_id,
                depth: current.depth + 1,
                edge_type: link.payload.edge_type || link.payload.relationship,
                direction: "downstream",
              });
            }
          }
        }

        // Upstream: this memory is the target
        if (direction === "upstream" || direction === "both") {
          const upstream = await scrollPoints(COLLECTIONS.LINKS, {
            must: [{ key: "target_id", match: { value: current.id } }],
          }, 20) as any[];
          for (const link of upstream) {
            if (!visited.has(link.payload?.source_id)) {
              queue.push({
                id: link.payload.source_id,
                depth: current.depth + 1,
                edge_type: link.payload.edge_type || link.payload.relationship,
                direction: "upstream",
              });
            }
          }
        }
      }

      await logAudit("trace", {
        memory_id: args.memory_id,
        direction,
        depth_reached: Math.max(...chain.map(n => n.depth), 0),
        nodes_found: chain.length,
      });

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            root_memory: args.memory_id,
            direction,
            max_depth: maxDepth,
            depth_reached: Math.max(...chain.map(n => n.depth), 0),
            chain,
          }, null, 2),
        }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error tracing memory: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "memory_impact",
  "Assess the downstream impact of a memory — what decisions, facts, or contexts were derived from or informed by it. Use before invalidating or deleting a memory.",
  MemoryImpactSchema.shape,
  async (args) => {
    try {
      // Find all edges where this memory is the source (it influenced others)
      const edges = await scrollPoints(COLLECTIONS.LINKS, {
        must: [{ key: "source_id", match: { value: args.memory_id } }],
      }, 100) as any[];

      // Filter by edge types if specified
      const filtered = args.edge_types
        ? edges.filter((e: any) => args.edge_types!.includes(e.payload?.edge_type))
        : edges;

      // Fetch affected memories
      const affected = [];
      for (const edge of filtered) {
        try {
          const mem = await getPoint(COLLECTIONS.LONG_TERM, edge.payload.target_id) as any;
          affected.push({
            memory_id: edge.payload.target_id,
            edge_type: edge.payload.edge_type || edge.payload.relationship,
            confidence: edge.payload.confidence || edge.payload.strength,
            content_preview: mem?.payload?.content?.slice(0, 120) || "[unavailable]",
            temporal_score: mem ? computeTemporalScore(mem.payload || {}) : 0,
          });
        } catch { /* skip unavailable memories */ }
      }

      affected.sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0));

      await logAudit("impact_assessment", {
        memory_id: args.memory_id,
        impact_count: affected.length,
        edge_types_found: [...new Set(affected.map(a => a.edge_type))],
      });

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            memory_id: args.memory_id,
            impact_count: affected.length,
            affected_memories: affected,
            total_confidence: affected.reduce((sum, a) => sum + (a.confidence || 0), 0),
          }, null, 2),
        }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error assessing impact: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

// ============================================
// REQ-EVO-002: Temporal Reasoning Tools
// ============================================

server.tool(
  "memory_verify",
  "Mark a memory as currently verified and accurate. Resets the temporal decay clock for periodic memories, boosting their recall score.",
  MemoryVerifySchema.shape,
  async (args) => {
    try {
      const collection = args.collection || COLLECTIONS.LONG_TERM;
      const mem = await getPoint(collection, args.memory_id) as any;
      if (!mem) throw new Error(`Memory ${args.memory_id} not found`);

      const now = new Date().toISOString();
      const verificationHistory = mem.payload?.verification_history || [];
      verificationHistory.push({
        date: now,
        notes: args.notes || null,
      });
      // Keep last 5 verifications
      while (verificationHistory.length > 5) verificationHistory.shift();

      await updatePayload(collection, [args.memory_id], {
        last_verified_date: now,
        verification_history: verificationHistory,
      });

      // Compute new temporal score
      const updatedPayload = { ...mem.payload, last_verified_date: now };
      const newTemporalScore = computeTemporalScore(updatedPayload);

      await logAudit("verify", {
        memory_id: args.memory_id,
        collection,
        previous_verified: mem.payload?.last_verified_date || "never",
        new_temporal_score: newTemporalScore,
        notes: args.notes,
      });

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            memory_id: args.memory_id,
            verified_at: now,
            new_temporal_score: newTemporalScore,
            verification_count: verificationHistory.length,
            message: `Memory verified. Temporal score: ${newTemporalScore.toFixed(3)}`,
          }, null, 2),
        }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error verifying memory: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

// ============================================
// Feature 2: Recall-trace feedback tool
// ============================================
// Report back which memories from a prior memory_recall (by trace_id) were used
// or ignored. Fail-open analytics: even a PG failure returns success:true-ish
// (never isError), because feedback is non-critical.
const MemoryTraceFeedbackSchema = z.object({
  trace_id: z.string().uuid().describe("The trace_id returned by a prior memory_recall call."),
  used_memory_ids: z.array(z.string()).default([])
    .describe("IDs of returned memories that were actually used."),
  ignored: z.array(z.object({
    memory_id: z.string(),
    reason: z.string().max(500),
  })).default([]).describe("Memories that were returned but ignored, with a short reason each."),
});

server.tool(
  "memory_trace_feedback",
  "Report back which memories from a prior memory_recall (identified by trace_id) were actually used, and why others were ignored. Feeds recall-quality analytics. Fail-open: never blocks.",
  MemoryTraceFeedbackSchema.shape,
  async (args) => {
    const res = await recordTraceFeedback({
      trace_id: args.trace_id,
      used_memory_ids: args.used_memory_ids,
      ignored: args.ignored,
    });
    // Best-effort audit trail (mirrors existing logAudit usage).
    await logAudit("recall_trace_feedback", {
      trace_id: args.trace_id,
      used: args.used_memory_ids.length,
      ignored: args.ignored.length,
      updated_rows: res.updated,
      ok: res.ok,
    }).catch(() => {});
    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        success: res.ok,
        trace_id: args.trace_id,
        updated_rows: res.updated,
        ...(res.error ? { error: res.error } : {}),
      }, null, 2) }],
      // NOT isError even on ok:false — feedback failure is non-fatal analytics.
    };
  }
);

// ============================================
// REQ-EVO-014: ISO 42001 Compliance Tools
// ============================================

server.tool(
  "governance_report",
  "Generate an ISO 42001 compliance evidence package. Queries the audit log, maps events to ~40 controls, computes compliance score, identifies gaps, and outputs JSON/CSV/Markdown.",
  z.object({
    period_days: z.number().optional().default(30)
      .describe("Reporting period in days back from now (default: 30)"),
    control_ids: z.array(z.string()).optional()
      .describe("Filter to specific control IDs (e.g. ['6.1.2', '7.2']); default is all"),
    format: z.enum(["json", "markdown", "csv", "all"]).optional().default("all")
      .describe("Output format: json, markdown, csv, or all"),
  }).shape,
  async (args) => {
    try {
      const now = new Date();
      const periodStart = new Date(now.getTime() - args.period_days * 24 * 60 * 60 * 1000);

      const deps = {
        scrollAuditLog: async (filter?: Record<string, unknown>, limit?: number, offset?: string | number) => {
          const points = await scrollPoints(COLLECTIONS.AUDIT_LOG, filter, limit || 10000, offset);
          return points.map((p: any) => ({
            id: p.id,
            action: p.payload?.action || "",
            timestamp: p.payload?.timestamp || "",
            session_id: p.payload?.session_id || "",
            project: p.payload?.project || "",
            sensitivity: p.payload?.sensitivity || "",
            details: p.payload?.details || {},
          })) as AuditEvent[];
        },
      };

      const report = await generateComplianceReport(
        {
          period_start: periodStart.toISOString(),
          period_end: now.toISOString(),
          controls: args.control_ids,
        },
        deps
      );

      let output: string;
      if (args.format === "csv") {
        output = buildCSV(report);
      } else if (args.format === "markdown") {
        output = buildMarkdown(report);
      } else if (args.format === "json") {
        output = JSON.stringify(report, null, 2);
      } else {
        output = JSON.stringify({
          json: report,
          csv: buildCSV(report),
          markdown: buildMarkdown(report),
        }, null, 2);
      }

      await logAudit("compliance_report_generated", {
        period_days: args.period_days,
        compliance_score: report.compliance_score,
        satisfied: report.satisfied_controls,
        gaps: report.gap_controls,
        total: report.total_controls,
      });

      return {
        content: [{ type: "text" as const, text: output }],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error generating compliance report: ${msg}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "governance_gap_analysis",
  "List ISO 42001 controls with insufficient audit evidence and actionable remediation recommendations.",
  z.object({
    period_days: z.number().optional().default(90)
      .describe("Reporting period in days back from now (default: 90)"),
  }).shape,
  async (args) => {
    try {
      const now = new Date();
      const periodStart = new Date(now.getTime() - args.period_days * 24 * 60 * 60 * 1000);

      const deps = {
        scrollAuditLog: async (filter?: Record<string, unknown>, limit?: number, offset?: string | number) => {
          const points = await scrollPoints(COLLECTIONS.AUDIT_LOG, filter, limit || 10000, offset);
          return points.map((p: any) => ({
            id: p.id,
            action: p.payload?.action || "",
            timestamp: p.payload?.timestamp || "",
            session_id: p.payload?.session_id || "",
            project: p.payload?.project || "",
            sensitivity: p.payload?.sensitivity || "",
            details: p.payload?.details || {},
          })) as AuditEvent[];
        },
      };

      const report = await generateComplianceReport(
        { period_start: periodStart.toISOString(), period_end: now.toISOString() },
        deps
      );

      const gaps = report.gap_analysis;
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            period_days: args.period_days,
            compliance_score: report.compliance_score,
            total_gaps: gaps.length,
            gaps,
          }, null, 2),
        }],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error running gap analysis: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ============================================
// REQ-EVO-013: Proof-of-Guardrail Tools
// ============================================

server.tool(
  "guardrail_proof",
  "Manage cryptographic guardrail attestation proofs. Generate pre-operation hashes, complete proofs, verify chains, inspect Merkle batches, and trigger batch publication.",
  z.object({
    operation: z.enum(["generate_h1", "complete_proof", "verify", "get_merkle_proof", "batch_now", "stats"])
      .describe("Operation to perform"),
    tool_name: z.string().optional().describe("Tool name for generate_h1"),
    args_hash: z.string().optional().describe("SHA256 hash of tool args for generate_h1"),
    h1: z.string().optional().describe("H1 hash from generate_h1 (for complete_proof)"),
    operation_id: z.string().optional().describe("Audit log entry ID (for complete_proof)"),
    policy_decision: z.enum(["ALLOW", "DENY", "WARN"]).optional().describe("Policy decision (for complete_proof)"),
    proof_id: z.string().optional().describe("Proof record ID (for verify/get_merkle_proof)"),
  }).shape,
  async (args) => {
    if (!proofEngine) {
      return {
        content: [{ type: "text" as const, text: "Proof engine not initialized. Run init-governance.sh first." }],
        isError: true,
      };
    }

    try {
      switch (args.operation) {
        case "generate_h1": {
          if (!args.tool_name) throw new Error("tool_name required for generate_h1");
          const req = {
            tool_name: args.tool_name,
            args_hash: args.args_hash || "",
            session_id: SESSION_ID,
            timestamp: new Date().toISOString(),
          };
          const h1 = proofEngine.preProof(req);
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ h1, req }, null, 2) }],
          };
        }

        case "complete_proof": {
          if (!args.h1) throw new Error("h1 required for complete_proof");
          if (!args.operation_id) throw new Error("operation_id required for complete_proof");
          const proofId = proofEngine.postProof({
            h1: args.h1,
            operation_id: args.operation_id,
            hook_log: {
              pre_hook_ran: true,
              post_hook_ran: true,
              policy_checks: [args.tool_name || "unknown"],
              duration_ms: 0,
            },
            policy_decision: (args.policy_decision || "ALLOW") as PolicyDecision,
            req: {
              tool_name: args.tool_name || "unknown",
              args_hash: args.args_hash || "",
              session_id: SESSION_ID,
              timestamp: new Date().toISOString(),
            },
          });
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ proof_id: proofId, status: "proof_recorded" }, null, 2) }],
          };
        }

        case "verify": {
          if (!args.proof_id) throw new Error("proof_id required for verify");
          const result = await proofEngine.verifyProof(args.proof_id);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          };
        }

        case "get_merkle_proof": {
          if (!args.proof_id) throw new Error("proof_id required for get_merkle_proof");
          const merkleProof = proofEngine.getMerkleProof(args.proof_id);
          if (!merkleProof) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ error: "Proof not yet batched into a Merkle tree" }) }],
            };
          }
          return {
            content: [{ type: "text" as const, text: JSON.stringify(merkleProof, null, 2) }],
          };
        }

        case "batch_now": {
          const batchResult = await proofEngine.batchAndPublish();
          if (!batchResult) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ message: "No unbatched proofs to process" }) }],
            };
          }
          return {
            content: [{ type: "text" as const, text: JSON.stringify(batchResult, null, 2) }],
          };
        }

        case "stats": {
          const stats = proofEngine.getStats();
          return {
            content: [{ type: "text" as const, text: JSON.stringify(stats, null, 2) }],
          };
        }

        default:
          return {
            content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }],
            isError: true,
          };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Guardrail proof error: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ============================================
// REQ-EVO-015: Agent Identity Tool
// ============================================

server.tool(
  "agent_identity",
  "Manage PQC-ready agent identities: create/list/rotate/revoke identities, sign/verify delegation tokens, check rotation status, and get C-BOM.",
  z.object({
    operation: z.enum([
      "create", "get", "list", "rotate_keys", "revoke",
      "sign_token", "verify_token", "check_rotation", "cbom",
    ]).describe("Identity operation to perform"),
    name: z.string().optional().describe("Agent name (for create)"),
    agent_id: z.string().optional().describe("Agent ID (for get/rotate/revoke/sign_token)"),
    permissions: z.array(z.string()).optional().describe("Permissions list (for create/sign_token)"),
    scope: z.string().optional().describe("Delegation scope (for sign_token)"),
    ttl_seconds: z.number().optional().default(3600).describe("Token TTL in seconds (for sign_token)"),
    token: z.string().optional().describe("JSON-serialized delegation token (for verify_token)"),
    status_filter: z.string().optional().describe("Filter by status: active/deprecated/revoked (for list)"),
    reason: z.string().optional().describe("Reason (for revoke)"),
  }).shape,
  async (args) => {
    if (!identityManager) {
      return {
        content: [{ type: "text" as const, text: "Agent Identity Manager not initialized." }],
        isError: true,
      };
    }

    try {
      switch (args.operation) {
        case "create": {
          if (!args.name) throw new Error("name required for create");
          const identity = await identityManager.createIdentity(
            args.name,
            args.permissions || []
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                id: identity.id,
                name: identity.name,
                algorithm: identity.algorithm,
                pqc_ready: identity.pqc_ready,
                pqc_algorithm: identity.pqc_algorithm,
                status: identity.status,
                created_at: identity.created_at,
                permissions: identity.permissions,
                c_bom_entry: identity.c_bom_entry,
              }, null, 2),
            }],
          };
        }

        case "get": {
          if (!args.agent_id) throw new Error("agent_id required for get");
          const identity = await identityManager.getIdentity(args.agent_id);
          if (!identity) throw new Error(`Agent ${args.agent_id} not found`);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                id: identity.id,
                name: identity.name,
                algorithm: identity.algorithm,
                pqc_ready: identity.pqc_ready,
                status: identity.status,
                created_at: identity.created_at,
                rotated_at: identity.rotated_at,
                permissions: identity.permissions,
                deprecated_keys_count: identity.deprecated_keys.length,
              }, null, 2),
            }],
          };
        }

        case "list": {
          const identities = await identityManager.listIdentities(args.status_filter);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                count: identities.length,
                identities: identities.map(i => ({
                  id: i.id,
                  name: i.name,
                  algorithm: i.algorithm,
                  status: i.status,
                  pqc_ready: i.pqc_ready,
                  created_at: i.created_at,
                  rotated_at: i.rotated_at,
                })),
              }, null, 2),
            }],
          };
        }

        case "rotate_keys": {
          if (!args.agent_id) throw new Error("agent_id required for rotate_keys");
          const result = await identityManager.rotateKeys(args.agent_id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        }

        case "revoke": {
          if (!args.agent_id) throw new Error("agent_id required for revoke");
          await identityManager.revokeIdentity(args.agent_id, args.reason || "manual revocation");
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ status: "revoked", agent_id: args.agent_id }, null, 2),
            }],
          };
        }

        case "sign_token": {
          if (!args.agent_id) throw new Error("agent_id required for sign_token");
          if (!args.scope) throw new Error("scope required for sign_token");
          const token = await identityManager.signDelegationToken(
            args.agent_id,
            args.scope,
            args.permissions || [],
            args.ttl_seconds || 3600
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(token, null, 2),
            }],
          };
        }

        case "verify_token": {
          if (!args.token) throw new Error("token JSON required for verify_token");
          const tokenObj = JSON.parse(args.token) as DelegationToken;
          const result = await identityManager.verifyDelegationToken(tokenObj);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        }

        case "check_rotation": {
          const needsRotation = await identityManager.checkRotationNeeded();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                agents_needing_rotation: needsRotation.length,
                agents: needsRotation,
              }, null, 2),
            }],
          };
        }

        case "cbom": {
          const cbom = await identityManager.getCBOM();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                pqc_readiness_summary: {
                  total: cbom.length,
                  interface_ready: cbom.filter(c => c.pqc_readiness === "interface_ready").length,
                  fully_migrated: cbom.filter(c => c.pqc_readiness === "fully_migrated").length,
                  not_ready: cbom.filter(c => c.pqc_readiness === "not_ready").length,
                },
                entries: cbom,
              }, null, 2),
            }],
          };
        }

        default:
          return {
            content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }],
            isError: true,
          };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Agent identity error: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ============================================
// REQ-EVO-016: NHI Lifecycle Tool
// ============================================

server.tool(
  "nhi_lifecycle",
  "Non-Human Identity lifecycle management: spawn/escalate/deescalate/terminate agents, check dormancy, review permissions, get inventory and history.",
  z.object({
    operation: z.enum([
      "spawn", "escalate", "deescalate", "terminate",
      "reactivate", "check_dormancy", "review_permissions",
      "get_record", "get_history", "get_inventory", "record_usage",
    ]).describe("Lifecycle operation to perform"),
    name: z.string().optional().describe("Agent name (for spawn)"),
    agent_id: z.string().optional().describe("Agent ID"),
    permissions: z.array(z.string()).optional().describe("Permissions (for spawn/escalate)"),
    reason: z.string().optional().describe("Reason for the operation"),
    duration_minutes: z.number().optional().default(30).describe("Escalation duration in minutes (max 60)"),
    approved_by: z.string().optional().default("system").describe("Who approved the operation"),
    permission: z.string().optional().describe("Permission name (for record_usage)"),
  }).shape,
  async (args) => {
    if (!lifecycleManager) {
      return {
        content: [{ type: "text" as const, text: "NHI Lifecycle Manager not initialized." }],
        isError: true,
      };
    }

    try {
      switch (args.operation) {
        case "spawn": {
          if (!args.name) throw new Error("name required for spawn");
          const result = await lifecycleManager.spawn(
            args.name,
            args.permissions || [],
            args.reason || "agent spawned"
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                agent_id: result.identity.id,
                name: result.identity.name,
                state: result.nhi_record.state,
                algorithm: result.identity.algorithm,
                permissions: result.nhi_record.permissions,
                pqc_ready: result.identity.pqc_ready,
              }, null, 2),
            }],
          };
        }

        case "escalate": {
          if (!args.agent_id) throw new Error("agent_id required for escalate");
          if (!args.reason) throw new Error("reason required for escalate");
          const record = await lifecycleManager.escalate(
            args.agent_id,
            args.permissions || [],
            args.reason,
            args.duration_minutes || 30,
            args.approved_by || "system"
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                agent_id: record.agent_id,
                state: record.state,
                permissions: record.permissions,
                escalated_permissions: record.escalated_permissions,
                escalation_expires_at: record.escalation_expires_at,
              }, null, 2),
            }],
          };
        }

        case "deescalate": {
          if (!args.agent_id) throw new Error("agent_id required for deescalate");
          const record = await lifecycleManager.deescalate(
            args.agent_id,
            args.reason || "manual de-escalation"
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                agent_id: record.agent_id,
                state: record.state,
                permissions: record.permissions,
              }, null, 2),
            }],
          };
        }

        case "terminate": {
          if (!args.agent_id) throw new Error("agent_id required for terminate");
          await lifecycleManager.terminate(args.agent_id, args.reason || "manual termination");
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                agent_id: args.agent_id,
                state: "TERMINATED",
                reason: args.reason || "manual termination",
              }, null, 2),
            }],
          };
        }

        case "reactivate": {
          if (!args.agent_id) throw new Error("agent_id required for reactivate");
          const record = await lifecycleManager.reactivate(
            args.agent_id,
            args.reason || "activity detected"
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                agent_id: record.agent_id,
                state: record.state,
                permissions: record.permissions,
              }, null, 2),
            }],
          };
        }

        case "check_dormancy": {
          const result = await lifecycleManager.checkDormancy();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                dormant_agents: result.dormant,
                deescalated_agents: result.deescalated,
                summary: `${result.dormant.length} agents marked dormant, ${result.deescalated.length} escalations expired`,
              }, null, 2),
            }],
          };
        }

        case "review_permissions": {
          const reviews = await lifecycleManager.reviewPermissions();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                agents_flagged: reviews.length,
                reviews,
              }, null, 2),
            }],
          };
        }

        case "get_record": {
          if (!args.agent_id) throw new Error("agent_id required for get_record");
          const record = await lifecycleManager.getNHIRecord(args.agent_id);
          if (!record) throw new Error(`NHI record not found for ${args.agent_id}`);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(record, null, 2),
            }],
          };
        }

        case "get_history": {
          if (!args.agent_id) throw new Error("agent_id required for get_history");
          const history = await lifecycleManager.getLifecycleHistory(args.agent_id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                agent_id: args.agent_id,
                transitions: history.length,
                history,
              }, null, 2),
            }],
          };
        }

        case "get_inventory": {
          const inventory = await lifecycleManager.getInventory();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(inventory, null, 2),
            }],
          };
        }

        case "record_usage": {
          if (!args.agent_id) throw new Error("agent_id required for record_usage");
          if (!args.permission) throw new Error("permission required for record_usage");
          await lifecycleManager.recordPermissionUsage(args.agent_id, args.permission);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ status: "recorded", agent_id: args.agent_id, permission: args.permission }, null, 2),
            }],
          };
        }

        default:
          return {
            content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }],
            isError: true,
          };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `NHI lifecycle error: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ============================================
// REQ-EVO-017: Constitutional Monitor Tool
// ============================================

server.tool(
  "constitutional_monitor",
  "Real-time constitutional alignment monitor: assess action alignment with stated objectives, set objectives, get drift statistics.",
  z.object({
    operation: z.enum([
      "set_objective", "assess", "get_stats",
      "get_recent", "get_objective",
    ]).describe("Monitor operation to perform"),
    objective: z.string().optional().describe("Task objective (for set_objective)"),
    expected_scopes: z.array(z.string()).optional().describe("Expected resource scopes (for set_objective)"),
    action: z.string().optional().describe("Proposed action to assess (for assess)"),
    action_history: z.array(z.string()).optional().describe("Recent action history (for assess)"),
    resources_accessed: z.array(z.string()).optional().describe("Resources the action will access (for assess)"),
    limit: z.number().optional().default(10).describe("Number of recent assessments to return"),
  }).shape,
  async (args) => {
    if (!constitutionalMonitor) {
      return {
        content: [{ type: "text" as const, text: "Constitutional Monitor not initialized." }],
        isError: true,
      };
    }

    try {
      switch (args.operation) {
        case "set_objective": {
          if (!args.objective) throw new Error("objective required for set_objective");
          const result = await constitutionalMonitor.setObjective(
            args.objective,
            args.expected_scopes || []
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                status: "objective_set",
                ...result,
              }, null, 2),
            }],
          };
        }

        case "assess": {
          if (!args.action) throw new Error("action required for assess");
          const assessment = await constitutionalMonitor.assess(
            args.action,
            args.action_history || [],
            args.resources_accessed || []
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(assessment, null, 2),
            }],
          };
        }

        case "get_stats": {
          const stats = constitutionalMonitor.getDriftStats();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(stats, null, 2),
            }],
          };
        }

        case "get_recent": {
          const recent = constitutionalMonitor.getRecentAssessments(args.limit || 10);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                count: recent.length,
                assessments: recent,
              }, null, 2),
            }],
          };
        }

        case "get_objective": {
          const objective = constitutionalMonitor.getObjectiveState();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(objective || { status: "no_objective_set" }, null, 2),
            }],
          };
        }

        default:
          return {
            content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }],
            isError: true,
          };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Constitutional monitor error: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ============================================
// REQ-EVO-031: Time-Travel Debugging Tool
// ============================================

server.tool(
  "time_travel",
  "Time-travel debugging: record agent sessions, replay with frozen world state, modify steps for what-if analysis, compare executions, view timelines.",
  z.object({
    operation: z.enum([
      "start_recording", "record_call", "stop_recording",
      "list_recordings", "get_recording", "start_replay",
      "replay_step", "replay_all", "modify_step",
      "compare", "timeline", "delete_recording",
      "get_replay_state", "list_replays",
    ]).describe("Time-travel operation to perform"),
    session_id: z.string().optional().describe("Session ID (for start_recording)"),
    description: z.string().optional().describe("Description (for start_recording)"),
    recording_id: z.string().optional().describe("Recording ID"),
    replay_id: z.string().optional().describe("Replay ID"),
    tool_name: z.string().optional().describe("Tool name (for record_call)"),
    parameters: z.record(z.string(), z.unknown()).optional().describe("Tool parameters (for record_call)"),
    response: z.unknown().optional().describe("Tool response (for record_call)"),
    step_number: z.number().optional().describe("Step number (for modify_step)"),
    modification_type: z.enum(["response_override", "parameter_override", "skip", "inject"]).optional().describe("Type of modification"),
    modification_value: z.unknown().optional().describe("Modified value"),
    original_id: z.string().optional().describe("Original recording ID (for compare)"),
    modified_id: z.string().optional().describe("Modified replay/recording ID (for compare)"),
    limit: z.number().optional().default(20).describe("Result limit"),
    actual_tool_name: z.string().optional().describe("Actual tool name during replay (for divergence detection)"),
    actual_params: z.record(z.string(), z.unknown()).optional().describe("Actual parameters during replay (for divergence detection)"),
  }).shape,
  async (args) => {
    if (!timeTravelDebugger) {
      return {
        content: [{ type: "text" as const, text: "Time-Travel Debugger not initialized." }],
        isError: true,
      };
    }

    try {
      switch (args.operation) {
        case "start_recording": {
          if (!args.session_id) throw new Error("session_id required for start_recording");
          const result = await timeTravelDebugger.startRecording(args.session_id, args.description);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        }

        case "record_call": {
          if (!args.recording_id) throw new Error("recording_id required for record_call");
          if (!args.tool_name) throw new Error("tool_name required for record_call");
          const result = await timeTravelDebugger.recordToolCall(
            args.recording_id,
            args.tool_name,
            args.parameters || {},
            args.response
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                recorded: true,
                sequence_number: result.sequence_number,
                tool_name: result.tool_name,
                parameters_hash: result.parameters_hash,
                response_hash: result.response_hash,
              }, null, 2),
            }],
          };
        }

        case "stop_recording": {
          if (!args.recording_id) throw new Error("recording_id required for stop_recording");
          const result = await timeTravelDebugger.stopRecording(args.recording_id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        }

        case "list_recordings": {
          const recordings = await timeTravelDebugger.listRecordings(args.limit || 20);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ count: recordings.length, recordings }, null, 2),
            }],
          };
        }

        case "get_recording": {
          if (!args.recording_id) throw new Error("recording_id required for get_recording");
          const result = await timeTravelDebugger.getRecording(args.recording_id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                recording: result.recording,
                tool_call_count: result.tool_calls.length,
                tool_calls: result.tool_calls.map((tc) => ({
                  step: tc.sequence_number - 1,
                  tool_name: tc.tool_name,
                  parameters_hash: tc.parameters_hash,
                  response_hash: tc.response_hash,
                  timestamp: tc.timestamp,
                })),
              }, null, 2),
            }],
          };
        }

        case "start_replay": {
          if (!args.recording_id) throw new Error("recording_id required for start_replay");
          const result = await timeTravelDebugger.startReplay(args.recording_id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        }

        case "replay_step": {
          if (!args.replay_id) throw new Error("replay_id required for replay_step");
          const result = await timeTravelDebugger.replayStep(
            args.replay_id,
            args.actual_tool_name,
            args.actual_params
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        }

        case "replay_all": {
          if (!args.recording_id) throw new Error("recording_id required for replay_all");
          const result = await timeTravelDebugger.replayAll(args.recording_id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        }

        case "modify_step": {
          if (!args.replay_id) throw new Error("replay_id required for modify_step");
          if (args.step_number === undefined) throw new Error("step_number required for modify_step");
          if (!args.modification_type) throw new Error("modification_type required for modify_step");
          const result = timeTravelDebugger.modifyStep(args.replay_id, args.step_number, {
            type: args.modification_type,
            value: args.modification_value,
          });
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        }

        case "compare": {
          if (!args.original_id) throw new Error("original_id required for compare");
          if (!args.modified_id) throw new Error("modified_id required for compare");
          const result = await timeTravelDebugger.compareExecutions(args.original_id, args.modified_id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        }

        case "timeline": {
          if (!args.recording_id) throw new Error("recording_id required for timeline");
          const result = await timeTravelDebugger.getTimeline(args.recording_id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        }

        case "delete_recording": {
          if (!args.recording_id) throw new Error("recording_id required for delete_recording");
          const result = await timeTravelDebugger.deleteRecording(args.recording_id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        }

        case "get_replay_state": {
          if (!args.replay_id) throw new Error("replay_id required for get_replay_state");
          const state = timeTravelDebugger.getReplayState(args.replay_id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(state || { error: "Replay not found" }, null, 2),
            }],
          };
        }

        case "list_replays": {
          const replays = timeTravelDebugger.listReplays();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ count: replays.length, replays }, null, 2),
            }],
          };
        }

        default:
          return {
            content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }],
            isError: true,
          };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Time-travel debug error: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ============================================
// REQ-EVO-012: Formal Verification Tool
// ============================================

server.tool(
  "formal_verify",
  "Formal verification pipeline: compile conductor workflow DAGs into verifiable specs, run safety/liveness/invariant checks via exhaustive state enumeration, generate Ed25519-signed certificates, check cache.",
  z.object({
    operation: z.enum([
      "compile", "verify", "full_verify", "get_certificate",
      "list_verifications", "verify_certificate",
    ]).describe("Verification operation to perform"),
    workflow: z.record(z.string(), z.unknown()).optional().describe("Conductor workflow JSON (for compile/verify/full_verify)"),
    spec: z.record(z.string(), z.unknown()).optional().describe("Compiled WorkflowSpec (for verify)"),
    certificate: z.record(z.string(), z.unknown()).optional().describe("VerificationCertificate (for verify_certificate)"),
    workflow_hash: z.string().optional().describe("Workflow source hash (for get_certificate cache lookup)"),
    limit: z.number().optional().default(20).describe("Result limit for list_verifications"),
  }).shape,
  async (args) => {
    if (!workflowVerifier) {
      return {
        content: [{ type: "text" as const, text: "Formal Verification pipeline not initialized." }],
        isError: true,
      };
    }

    try {
      switch (args.operation) {
        case "compile": {
          if (!args.workflow) throw new Error("workflow required for compile");
          const spec = workflowVerifier.compileWorkflow(args.workflow as unknown as ConductorWorkflow);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                spec_id: spec.id,
                name: spec.name,
                phases: spec.phases.length,
                transitions: spec.transitions.length,
                gates: spec.gates.length,
                source_hash: spec.source_hash,
                compiled_at: spec.compiled_at,
              }, null, 2),
            }],
          };
        }

        case "verify": {
          if (!args.spec && !args.workflow) throw new Error("spec or workflow required for verify");
          let spec: WorkflowSpec;
          if (args.spec) {
            spec = args.spec as unknown as WorkflowSpec;
          } else {
            spec = workflowVerifier.compileWorkflow(args.workflow as unknown as ConductorWorkflow);
          }
          const result = workflowVerifier.verify(spec);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                verified: result.verified,
                states_explored: result.total_states_explored,
                max_depth: result.max_depth,
                properties_checked: result.properties_checked,
                properties_passed: result.properties_passed,
                violations_count: result.violations.length,
                violations: result.violations,
                bounded: result.bounded,
                duration_ms: result.duration_ms,
              }, null, 2),
            }],
          };
        }

        case "full_verify": {
          if (!args.workflow) throw new Error("workflow required for full_verify");
          const fullResult = await workflowVerifier.fullVerification(
            args.workflow as unknown as ConductorWorkflow
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                cached: fullResult.cached,
                verified: fullResult.result.verified,
                certificate_id: fullResult.certificate.id,
                certificate_hash: fullResult.certificate.certificate_hash,
                spec_name: fullResult.spec.name,
                states_explored: fullResult.result.total_states_explored,
                violations_count: fullResult.result.violations.length,
                violations: fullResult.result.violations,
                duration_ms: fullResult.result.duration_ms,
                issued_at: fullResult.certificate.issued_at,
                expires_at: fullResult.certificate.expires_at,
              }, null, 2),
            }],
          };
        }

        case "get_certificate": {
          if (!args.workflow_hash) throw new Error("workflow_hash required for get_certificate");
          const cached = workflowVerifier.getCachedResult(args.workflow_hash);
          if (!cached) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ found: false, message: "No cached certificate for this workflow hash" }) }],
            };
          }
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                found: true,
                certificate_id: cached.id,
                verified: cached.result.verified,
                certificate_hash: cached.certificate_hash,
                issued_at: cached.issued_at,
                expires_at: cached.expires_at,
              }, null, 2),
            }],
          };
        }

        case "list_verifications": {
          const records = await workflowVerifier.listVerifications(args.limit || 20);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ count: records.length, verifications: records }, null, 2),
            }],
          };
        }

        case "verify_certificate": {
          if (!args.certificate) throw new Error("certificate required for verify_certificate");
          const valid = workflowVerifier.verifyCertificate(
            args.certificate as unknown as VerificationCertificate
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ valid, certificate_id: (args.certificate as Record<string, unknown>).id }, null, 2),
            }],
          };
        }

        default:
          return {
            content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }],
            isError: true,
          };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Formal verification error: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ============================================
// REQ-EVO-024: Agent Digital Twin Sandbox Tool
// ============================================

server.tool(
  "digital_twin",
  "Agent Digital Twin sandbox: create snapshots of agent state, run isolated scenarios, compare behavior against baselines, get promotion recommendations.",
  z.object({
    operation: z.enum([
      "create_snapshot", "create_sandbox", "run_scenario",
      "compare", "list_sandboxes", "destroy_sandbox",
      "promotion_report", "list_scenarios", "get_sandbox",
    ]).describe("Digital twin operation to perform"),
    agent_id: z.string().optional().describe("Agent ID (for create_snapshot)"),
    snapshot: z.record(z.string(), z.unknown()).optional().describe("SandboxState snapshot (for create_sandbox)"),
    snapshot_id: z.string().optional().describe("Snapshot ID (for create_sandbox)"),
    sandbox_id: z.string().optional().describe("Sandbox ID"),
    scenario_name: z.string().optional().describe("Predefined scenario name or custom scenario JSON"),
    scenario: z.record(z.string(), z.unknown()).optional().describe("Custom ScenarioDefinition (for run_scenario)"),
    baseline: z.record(z.string(), z.unknown()).optional().describe("Baseline behavior profile (for compare)"),
  }).shape,
  async (args) => {
    if (!digitalTwinManager) {
      return {
        content: [{ type: "text" as const, text: "Digital Twin Manager not initialized." }],
        isError: true,
      };
    }

    try {
      switch (args.operation) {
        case "create_snapshot": {
          const result = await digitalTwinManager.createSnapshot(args.agent_id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                snapshot_id: result.snapshot_id,
                agent_id: result.snapshot.agent_config.agent_id,
                agent_name: result.snapshot.agent_config.name,
                memory_count: result.snapshot.memory_snapshot.length,
                captured_at: result.snapshot.captured_at,
              }, null, 2),
            }],
          };
        }

        case "create_sandbox": {
          if (!args.snapshot) throw new Error("snapshot required for create_sandbox");
          const result = await digitalTwinManager.createSandbox(
            args.snapshot as unknown as SandboxState,
            args.snapshot_id
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                sandbox_id: result.sandbox_id,
                agent_id: result.sandbox.snapshot.agent_config.agent_id,
                status: result.sandbox.status,
                created_at: result.sandbox.created_at,
              }, null, 2),
            }],
          };
        }

        case "run_scenario": {
          if (!args.sandbox_id) throw new Error("sandbox_id required for run_scenario");
          const scenarioArg = args.scenario_name || args.scenario;
          if (!scenarioArg) throw new Error("scenario_name or scenario required for run_scenario");
          const result = await digitalTwinManager.runScenario(
            args.sandbox_id,
            typeof scenarioArg === "string"
              ? scenarioArg
              : scenarioArg as unknown as ScenarioDefinition
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                scenario_name: result.scenario_name,
                passed: result.passed,
                steps_total: result.steps_total,
                steps_succeeded: result.steps_succeeded,
                steps_failed: result.steps_failed,
                steps_errored: result.steps_errored,
                duration_ms: result.total_duration_ms,
                step_results: result.step_results,
              }, null, 2),
            }],
          };
        }

        case "compare": {
          if (!args.sandbox_id) throw new Error("sandbox_id required for compare");
          const diffs = digitalTwinManager.compareResults(
            args.sandbox_id,
            args.baseline as Record<string, unknown> | undefined
          );
          const modified = diffs.filter((d) => d.change_type === "modified").length;
          const added = diffs.filter((d) => d.change_type === "added").length;
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                total_fields: diffs.length,
                modified,
                added,
                removed: diffs.filter((d) => d.change_type === "removed").length,
                unchanged: diffs.filter((d) => d.change_type === "unchanged").length,
                diffs,
              }, null, 2),
            }],
          };
        }

        case "list_sandboxes": {
          const sandboxes = digitalTwinManager.listSandboxes();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ count: sandboxes.length, sandboxes }, null, 2),
            }],
          };
        }

        case "destroy_sandbox": {
          if (!args.sandbox_id) throw new Error("sandbox_id required for destroy_sandbox");
          const result = await digitalTwinManager.destroySandbox(args.sandbox_id);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          };
        }

        case "promotion_report": {
          if (!args.sandbox_id) throw new Error("sandbox_id required for promotion_report");
          const report = digitalTwinManager.getPromotionReport(args.sandbox_id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                sandbox_id: report.sandbox_id,
                decision: report.promotion_recommendation.decision,
                confidence: report.promotion_recommendation.confidence,
                reasons: report.promotion_recommendation.reasons,
                risk_factors: report.promotion_recommendation.risk_factors,
                scenarios_passed: report.promotion_recommendation.scenarios_passed,
                scenarios_total: report.promotion_recommendation.scenarios_total,
                behavior_diffs_count: report.behavior_diffs.length,
              }, null, 2),
            }],
          };
        }

        case "list_scenarios": {
          const scenarios = digitalTwinManager.listScenarios();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ count: scenarios.length, scenarios }, null, 2),
            }],
          };
        }

        case "get_sandbox": {
          if (!args.sandbox_id) throw new Error("sandbox_id required for get_sandbox");
          const sandbox = digitalTwinManager.getSandbox(args.sandbox_id);
          if (!sandbox) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ found: false, sandbox_id: args.sandbox_id }) }],
            };
          }
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                id: sandbox.id,
                agent_id: sandbox.snapshot.agent_config.agent_id,
                status: sandbox.status,
                scenarios_run: sandbox.scenario_results.length,
                memory_count: sandbox.snapshot.memory_snapshot.length,
                created_at: sandbox.created_at,
              }, null, 2),
            }],
          };
        }

        default:
          return {
            content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }],
            isError: true,
          };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Digital twin error: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ============================================
// REQ-EVO-009/035: Context Budget Manager
// ============================================

server.tool(
  "context_budget",
  "Manage context window budget across structured compartments (active_task, project_background, operator_preferences, safety_constraints, ambient_knowledge). View budgets, add/remove content, pin/unpin items, enforce eviction, get alerts.",
  z.object({
    operation: z.enum([
      "get_budget", "add_item", "remove_item", "pin_item", "unpin_item",
      "enforce_budgets", "get_eviction_log", "get_alerts",
      "list_items", "set_total_budget", "estimate_tokens",
    ]).describe("Context budget operation to perform"),
    compartment: z.enum([
      "active_task", "project_background", "operator_preferences",
      "safety_constraints", "ambient_knowledge",
    ]).optional().describe("Target compartment (for add_item, list_items)"),
    content: z.string().optional().describe("Content to add (for add_item) or estimate (for estimate_tokens)"),
    item_id: z.string().optional().describe("Item ID (for remove_item, pin_item, unpin_item)"),
    pinned: z.boolean().optional().describe("Pin the item on add (for add_item)"),
    priority: z.number().optional().describe("Custom priority (higher = harder to evict, for add_item)"),
    total_budget: z.number().optional().describe("New total budget in tokens (for set_total_budget)"),
    limit: z.number().optional().describe("Max eviction log entries to return (for get_eviction_log)"),
    metadata: z.record(z.string(), z.unknown()).optional().describe("Optional metadata for the item (for add_item)"),
  }).shape,
  async (args) => {
    if (!contextManager) {
      return {
        content: [{ type: "text" as const, text: "Context Manager not initialized." }],
        isError: true,
      };
    }

    try {
      switch (args.operation) {
        case "get_budget": {
          const summary = contextManager.getSummary();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(summary, null, 2),
            }],
          };
        }

        case "add_item": {
          if (!args.compartment) throw new Error("compartment required for add_item");
          if (!args.content) throw new Error("content required for add_item");
          const item = contextManager.addItem(
            args.compartment as ContextCompartment,
            args.content,
            {
              pinned: args.pinned,
              priority: args.priority,
              metadata: args.metadata as Record<string, unknown> | undefined,
            }
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                added: true,
                item_id: item.id,
                compartment: item.compartment,
                token_count: item.token_count,
                pinned: item.pinned,
                priority: item.priority,
              }, null, 2),
            }],
          };
        }

        case "remove_item": {
          if (!args.item_id) throw new Error("item_id required for remove_item");
          const removed = contextManager.removeItem(args.item_id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ removed, item_id: args.item_id }, null, 2),
            }],
          };
        }

        case "pin_item": {
          if (!args.item_id) throw new Error("item_id required for pin_item");
          const pinned = contextManager.pinItem(args.item_id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ pinned, item_id: args.item_id }, null, 2),
            }],
          };
        }

        case "unpin_item": {
          if (!args.item_id) throw new Error("item_id required for unpin_item");
          const unpinned = contextManager.unpinItem(args.item_id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                unpinned,
                item_id: args.item_id,
                note: !unpinned ? "Item not found or is in safety_constraints (cannot unpin)" : undefined,
              }, null, 2),
            }],
          };
        }

        case "enforce_budgets": {
          const evictions = contextManager.enforceBudgets();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                evictions_performed: evictions.length,
                evictions: evictions.map((e) => ({
                  item_id: e.item_id,
                  compartment: e.compartment,
                  tokens: e.token_count,
                  reason: e.reason,
                  preview: e.content_preview,
                })),
              }, null, 2),
            }],
          };
        }

        case "get_eviction_log": {
          const log = contextManager.getEvictionLog(args.limit);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ count: log.length, evictions: log }, null, 2),
            }],
          };
        }

        case "get_alerts": {
          const alerts = contextManager.getAlerts();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                alert_count: alerts.length,
                alerts,
              }, null, 2),
            }],
          };
        }

        case "list_items": {
          if (!args.compartment) throw new Error("compartment required for list_items");
          const items = contextManager.getCompartmentItems(args.compartment as ContextCompartment);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                compartment: args.compartment,
                count: items.length,
                items: items.map((i) => ({
                  id: i.id,
                  token_count: i.token_count,
                  pinned: i.pinned,
                  priority: i.priority,
                  added_at: i.added_at,
                  content_preview: i.content.slice(0, 120) + (i.content.length > 120 ? "..." : ""),
                })),
              }, null, 2),
            }],
          };
        }

        case "set_total_budget": {
          if (args.total_budget === undefined) throw new Error("total_budget required for set_total_budget");
          contextManager.setTotalBudget(args.total_budget);
          const summary = contextManager.getSummary();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                updated: true,
                new_total_budget: args.total_budget,
                compartments: summary.compartments,
              }, null, 2),
            }],
          };
        }

        case "estimate_tokens": {
          if (!args.content) throw new Error("content required for estimate_tokens");
          const tokens = contextManager.estimateTokens(args.content);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                text_length: args.content.length,
                estimated_tokens: tokens,
                method: "4 chars ≈ 1 token",
              }, null, 2),
            }],
          };
        }

        default:
          return {
            content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }],
            isError: true,
          };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Context budget error: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ============================================
// W2-B1: Memory Enhancement Tools (REQ-EVO-003/004/005/007)
// ============================================

server.tool(
  "contradiction_check",
  "Detect and resolve contradictions in stored memories. Operations: detect (find contradictions for given content), resolve (mark winner/loser between contradicting memories).",
  z.object({
    operation: z.enum(["detect", "resolve"]).describe("detect = find contradictions, resolve = pick winner"),
    content: z.string().optional().describe("New memory content to check for contradictions (for detect)"),
    winner_id: z.string().optional().describe("ID of the winning memory (for resolve)"),
    loser_id: z.string().optional().describe("ID of the losing/superseded memory (for resolve)"),
    collection: z.string().optional().default("claude_memories").describe("Collection to search (default: claude_memories)"),
    limit: z.number().optional().default(10).describe("Max existing memories to compare against (for detect)"),
  }).shape,
  async (args) => {
    if (!contradictionDetector) {
      return {
        content: [{ type: "text" as const, text: "Contradiction Detector not initialized." }],
        isError: true,
      };
    }

    try {
      switch (args.operation) {
        case "detect": {
          if (!args.content) throw new Error("content required for detect operation");

          const embedding = await generateEmbedding(args.content);
          if (!embedding) throw new Error("Failed to generate embedding");

          const collection = args.collection || "claude_memories";
          const existingMemories = await searchPoints(
            collection, embedding, args.limit || 10, 0.5
          ) as Array<{ id: string; score: number; payload?: Record<string, unknown> }>;

          const result = await contradictionDetector.detect(args.content, existingMemories);

          await logAudit("contradiction_check", {
            content_preview: args.content.slice(0, 80),
            contradictions_found: result.contradictions.length,
            has_contradiction: result.has_contradiction,
          });

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                has_contradiction: result.has_contradiction,
                contradiction_count: result.contradictions.length,
                contradictions: result.contradictions,
                message: result.has_contradiction
                  ? `Found ${result.contradictions.length} contradiction(s). Use resolve operation to pick a winner.`
                  : "No contradictions detected.",
              }, null, 2),
            }],
          };
        }

        case "resolve": {
          if (!args.winner_id || !args.loser_id) {
            throw new Error("winner_id and loser_id required for resolve operation");
          }

          const result = await contradictionDetector.resolve(
            args.winner_id,
            args.loser_id,
            args.collection || "claude_memories"
          );

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                ...result,
              }, null, 2),
            }],
          };
        }

        default:
          return {
            content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }],
            isError: true,
          };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Contradiction check error: ${msg}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "memory_provenance",
  "Manage memory provenance chains. Operations: trace (forward-trace downstream impacts via informed/derived_from edges), create (attach provenance to a memory).",
  z.object({
    operation: z.enum(["trace", "create"]).describe("trace = forward-trace impacts, create = attach provenance"),
    memory_id: z.string().describe("Memory ID to trace or attach provenance to"),
    // For create operation
    created_by: z.string().optional().default("claude-agent").describe("Who created this memory"),
    session_id: z.string().optional().describe("Session ID for provenance"),
    evidence: z.array(z.object({
      type: z.enum(["tool_output", "web_fetch", "file_read"]).describe("Evidence type"),
      source: z.string().describe("Source identifier (tool name, URL, file path)"),
      content: z.string().describe("Evidence content for hashing"),
    })).optional().describe("Evidence supporting this memory (for create)"),
    confidence_basis: z.enum(["direct_observation", "inference", "operator_stated", "derived"]).optional()
      .describe("How confident we are in this memory (for create)"),
  }).shape,
  async (args) => {
    if (!provenanceManager) {
      return {
        content: [{ type: "text" as const, text: "Provenance Manager not initialized." }],
        isError: true,
      };
    }

    try {
      switch (args.operation) {
        case "trace": {
          const result = await provenanceManager.forwardTrace(args.memory_id);

          await logAudit("provenance_trace", {
            memory_id: args.memory_id,
            downstream_count: result.total_downstream,
          });

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                ...result,
              }, null, 2),
            }],
          };
        }

        case "create": {
          const provenance = provenanceManager.createProvenance({
            created_by: args.created_by || "claude-agent",
            session_id: args.session_id || SESSION_ID,
            evidence: args.evidence?.map(e => ({
              type: e.type as "tool_output" | "web_fetch" | "file_read",
              source: e.source,
              content: e.content,
            })),
            confidence_basis: args.confidence_basis as "direct_observation" | "inference" | "operator_stated" | "derived" | undefined,
          });

          const provenanceHash = provenanceManager.computeHash(provenance);

          // Update the memory with provenance data
          await updatePayload(
            "claude_memories",
            [args.memory_id],
            {
              provenance,
              provenance_hash: provenanceHash,
            }
          );

          await logAudit("provenance_created", {
            memory_id: args.memory_id,
            provenance_hash: provenanceHash,
            confidence_basis: provenance.confidence_basis,
            evidence_count: provenance.evidence.length,
          });

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                memory_id: args.memory_id,
                provenance,
                provenance_hash: provenanceHash,
              }, null, 2),
            }],
          };
        }

        default:
          return {
            content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }],
            isError: true,
          };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Provenance error: ${msg}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "memory_consolidate",
  "Consolidate episode memories into higher abstraction layers: Episodes → Facts → Principles → Heuristics. Each promotion creates derived_from causal edges.",
  z.object({
    operation: z.enum(["consolidate", "weight"]).describe("consolidate = run full pipeline, weight = get tier weight"),
    // For consolidate
    episode_ids: z.array(z.string()).optional().describe("Episode IDs to consolidate (if omitted, fetches recent episodes)"),
    max_episodes: z.number().optional().default(20).describe("Max episodes to process if fetching automatically"),
    // For weight
    collection: z.string().optional().describe("Collection name to get abstraction weight for"),
  }).shape,
  async (args) => {
    if (!abstractionEngine) {
      return {
        content: [{ type: "text" as const, text: "Abstraction Engine not initialized." }],
        isError: true,
      };
    }

    try {
      switch (args.operation) {
        case "consolidate": {
          // Gather episodes: either from provided IDs or by fetching recent ones
          let episodes: Array<{ id: string; content: string }> = [];

          if (args.episode_ids && args.episode_ids.length > 0) {
            for (const epId of args.episode_ids) {
              try {
                const ep = await getPoint("episodes", epId) as { payload?: Record<string, unknown> } | null;
                if (ep?.payload) {
                  const content = (ep.payload.task as string) || (ep.payload.content as string) || "";
                  const learnings = (ep.payload.learnings as string[]) || [];
                  const fullContent = learnings.length > 0
                    ? `${content} | Learnings: ${learnings.join("; ")}`
                    : content;
                  episodes.push({ id: epId, content: fullContent });
                }
              } catch { /* skip missing episodes */ }
            }
          } else {
            // Fetch recent completed episodes
            const recentEpisodes = await scrollPoints("episodes", {
              must: [{ key: "status", match: { value: "completed" } }],
            }, args.max_episodes || 20) as Array<{ id: string; payload?: Record<string, unknown> }>;

            for (const ep of recentEpisodes) {
              const content = (ep.payload?.task as string) || (ep.payload?.content as string) || "";
              const learnings = (ep.payload?.learnings as string[]) || [];
              const fullContent = learnings.length > 0
                ? `${content} | Learnings: ${learnings.join("; ")}`
                : content;
              episodes.push({ id: ep.id as string, content: fullContent });
            }
          }

          if (episodes.length === 0) {
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  success: true,
                  message: "No episodes found to consolidate.",
                  facts: [], principles: [], heuristics: [], edges_created: 0,
                }, null, 2),
              }],
            };
          }

          const result = await abstractionEngine.consolidate(episodes);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                episodes_processed: episodes.length,
                facts_extracted: result.facts.length,
                facts: result.facts.map(f => ({ id: f.id, content: f.content, sources: f.source_ids.length })),
                principles_derived: result.principles.length,
                principles: result.principles.map(p => ({ id: p.id, content: p.content, sources: p.source_ids.length })),
                heuristics_created: result.heuristics.length,
                heuristics: result.heuristics.map(h => ({ id: h.id, content: h.content, sources: h.source_ids.length })),
                edges_created: result.edges_created,
              }, null, 2),
            }],
          };
        }

        case "weight": {
          if (!args.collection) throw new Error("collection required for weight operation");
          const weight = abstractionEngine.getAbstractionWeight(args.collection);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                collection: args.collection,
                weight,
                description: `Memories in ${args.collection} get ${weight}x recall priority multiplier`,
              }, null, 2),
            }],
          };
        }

        default:
          return {
            content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }],
            isError: true,
          };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Consolidation error: ${msg}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "memory_prune",
  "Identify and prune stale/superseded memories. Candidates are soft-deleted to memories_cold with 90-day retention. Generates explanations and MEMORY_PRUNED audit events.",
  z.object({
    operation: z.enum(["identify", "explain", "execute"]).describe("identify = find candidates, explain = get explanation, execute = prune"),
    collection: z.string().optional().default("claude_memories").describe("Collection to prune from"),
    limit: z.number().optional().default(20).describe("Max candidates to return (for identify)"),
    candidate_id: z.string().optional().describe("Candidate memory ID (for explain/execute)"),
    candidate_ids: z.array(z.string()).optional().describe("Batch of candidate IDs to prune (for execute)"),
    dry_run: z.boolean().optional().default(true).describe("Preview without actually pruning (for execute)"),
  }).shape,
  async (args) => {
    if (!pruningEngine) {
      return {
        content: [{ type: "text" as const, text: "Pruning Engine not initialized." }],
        isError: true,
      };
    }

    try {
      switch (args.operation) {
        case "identify": {
          const candidates = await pruningEngine.identifyCandidates({
            collection: args.collection || "claude_memories",
            limit: args.limit || 20,
          });

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                candidate_count: candidates.length,
                candidates,
                message: candidates.length > 0
                  ? `Found ${candidates.length} prune candidate(s). Use explain or execute operations to proceed.`
                  : "No prune candidates found.",
              }, null, 2),
            }],
          };
        }

        case "explain": {
          if (!args.candidate_id) throw new Error("candidate_id required for explain operation");

          // First identify to get candidate details
          const candidates = await pruningEngine.identifyCandidates({
            collection: args.collection || "claude_memories",
            limit: 100,
          });

          const candidate = candidates.find(c => c.id === args.candidate_id);
          if (!candidate) {
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  success: false,
                  message: `Memory ${args.candidate_id} is not a prune candidate (it does not meet pruning criteria).`,
                }, null, 2),
              }],
            };
          }

          const explanation = await pruningEngine.generateExplanation(candidate);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                ...explanation,
              }, null, 2),
            }],
          };
        }

        case "execute": {
          const ids = args.candidate_ids || (args.candidate_id ? [args.candidate_id] : []);
          if (ids.length === 0) throw new Error("candidate_id or candidate_ids required for execute");

          if (args.dry_run) {
            // Generate explanations without actually pruning
            const candidates = await pruningEngine.identifyCandidates({
              collection: args.collection || "claude_memories",
              limit: 200,
            });

            const explanations: PruneExplanation[] = [];
            for (const id of ids) {
              const candidate = candidates.find(c => c.id === id);
              if (candidate) {
                const expl = await pruningEngine.generateExplanation(candidate);
                explanations.push(expl);
              }
            }

            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  success: true,
                  dry_run: true,
                  would_prune: explanations.length,
                  explanations,
                  message: "Dry run complete. Set dry_run=false to execute.",
                }, null, 2),
              }],
            };
          }

          // Actually prune
          const results = [];
          for (const id of ids) {
            try {
              const result = await pruningEngine.executePrune(
                id,
                args.collection || "claude_memories"
              );
              results.push({ id, ...result });
            } catch (err) {
              results.push({
                id,
                pruned: false,
                error: err instanceof Error ? err.message : "Unknown error",
              });
            }
          }

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                dry_run: false,
                pruned_count: results.filter(r => r.pruned).length,
                failed_count: results.filter(r => !r.pruned).length,
                results,
                cold_collection: ENHANCEMENT_COLLECTIONS.COLD,
                retention_days: 90,
              }, null, 2),
            }],
          };
        }

        default:
          return {
            content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }],
            isError: true,
          };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Prune error: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ============================================
// W2-B3: Constitutional Inheritance Tool (REQ-EVO-011)
// ============================================

server.tool(
  "constitutional_contract",
  "Manage constitutional contracts for agent delegation chains. Contracts propagate constraints with monotonically decreasing privileges. Operations: create (new contract), validate (check child vs parent), delegate (create child contract from parent), enforce (check action against contract), resolve_conflicts (merge multiple contracts), get_chain (full delegation chain), list (contracts for agent).",
  z.object({
    operation: z.enum(["create", "validate", "delegate", "enforce", "resolve_conflicts", "get_chain", "list"])
      .describe("Contract operation to perform"),
    agent_id: z.string().optional().describe("Agent ID (for create/list)"),
    parent_id: z.string().optional().describe("Parent contract ID (for create/delegate)"),
    contract_id: z.string().optional().describe("Contract ID (for enforce/get_chain)"),
    contract_ids: z.array(z.string()).optional().describe("Contract IDs (for resolve_conflicts)"),
    constraints: z.object({
      behavioral_rules: z.array(z.string()).describe("Behavioral constraint rules (prefix 'DENY:' for deny patterns)"),
      data_classification_ceiling: z.enum(["public", "internal", "sensitive", "restricted"]).describe("Maximum data classification this agent can access"),
      permitted_actions: z.array(z.string()).describe("Allowed actions ('*' for wildcard)"),
      prohibited_actions: z.array(z.string()).describe("Explicitly denied actions"),
    }).optional().describe("Constitutional constraints (for create/validate/delegate)"),
    parent_constraints: z.object({
      behavioral_rules: z.array(z.string()),
      data_classification_ceiling: z.enum(["public", "internal", "sensitive", "restricted"]),
      permitted_actions: z.array(z.string()),
      prohibited_actions: z.array(z.string()),
    }).optional().describe("Parent constraints (for validate)"),
    inheritance_mode: z.enum(["strict", "additive"]).optional().default("strict")
      .describe("How constraints are inherited: strict (exact subset) or additive (can add restrictions)"),
    expiry: z.string().optional().describe("ISO 8601 expiry date for the contract"),
    proposed_action: z.string().optional().describe("Action to check (for enforce)"),
    data_classification: z.enum(["public", "internal", "sensitive", "restricted"]).optional()
      .describe("Data classification of proposed action (for enforce)"),
  }).shape,
  async (args) => {
    if (!inheritanceManager) {
      return {
        content: [{ type: "text" as const, text: "Constitutional Inheritance Manager not initialized." }],
        isError: true,
      };
    }

    try {
      switch (args.operation) {
        case "create": {
          if (!args.agent_id) throw new Error("agent_id required for create");
          if (!args.constraints) throw new Error("constraints required for create");

          const contract = await inheritanceManager.createContract(
            args.agent_id,
            args.parent_id || null,
            args.constraints,
            args.inheritance_mode || "strict",
            args.expiry || null
          );

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                contract,
                message: `Constitutional contract created for agent '${args.agent_id}' (chain depth: ${contract.chain_depth})`,
              }, null, 2),
            }],
          };
        }

        case "validate": {
          if (!args.constraints) throw new Error("constraints required for validate");
          if (!args.parent_constraints) throw new Error("parent_constraints required for validate");

          const result = inheritanceManager.validateContract(args.constraints, args.parent_constraints);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                valid: result.valid,
                violations: result.violations,
                message: result.valid
                  ? "Child constraints are a valid subset of parent permissions."
                  : `Validation failed: ${result.violations.length} violation(s) detected.`,
              }, null, 2),
            }],
          };
        }

        case "delegate": {
          if (!args.parent_id) throw new Error("parent_id (parent contract ID) required for delegate");
          if (!args.agent_id) throw new Error("agent_id (child agent) required for delegate");
          if (!args.constraints) throw new Error("constraints required for delegate");

          const childContract = await inheritanceManager.delegateWithContract(
            args.parent_id,
            args.agent_id,
            args.constraints,
            args.expiry || null
          );

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                child_contract: childContract,
                message: `Delegation contract created: parent ${args.parent_id} -> child ${childContract.id} (depth: ${childContract.chain_depth})`,
              }, null, 2),
            }],
          };
        }

        case "enforce": {
          if (!args.contract_id) throw new Error("contract_id required for enforce");
          if (!args.proposed_action) throw new Error("proposed_action required for enforce");

          const chain = await inheritanceManager.getContractChain(args.contract_id);
          if (chain.length === 0) throw new Error(`Contract '${args.contract_id}' not found`);

          // Enforce against the contract at the head of the chain
          const contract = chain[0];
          const contractObj = {
            id: contract.contract_id,
            parent_id: chain.length > 1 ? chain[1].contract_id : null,
            agent_id: contract.agent_id,
            constraints: contract.constraints,
            inheritance_mode: contract.inheritance_mode,
            conflict_resolution: "most_restrictive_wins" as const,
            expiry: contract.expiry,
            created_at: "",
            chain_depth: contract.depth,
            constraint_hash: "",
          };

          const decision = inheritanceManager.enforceContract(
            contractObj,
            args.proposed_action,
            args.data_classification
          );

          await logAudit("contract_enforcement", {
            contract_id: args.contract_id,
            action: args.proposed_action,
            result: decision.result,
            violated_rules: decision.violated_rules,
            content_preview: `Enforce: ${args.proposed_action} -> ${decision.result}`,
          });

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                decision,
                chain_depth: chain.length,
              }, null, 2),
            }],
          };
        }

        case "resolve_conflicts": {
          if (!args.contract_ids || args.contract_ids.length === 0) {
            throw new Error("contract_ids required for resolve_conflicts");
          }

          const contracts = [];
          for (const cid of args.contract_ids) {
            const chain = await inheritanceManager.getContractChain(cid);
            if (chain.length > 0) {
              contracts.push({
                id: chain[0].contract_id,
                parent_id: null,
                agent_id: chain[0].agent_id,
                constraints: chain[0].constraints,
                inheritance_mode: chain[0].inheritance_mode,
                conflict_resolution: "most_restrictive_wins" as const,
                expiry: chain[0].expiry,
                created_at: "",
                chain_depth: chain[0].depth,
                constraint_hash: "",
              });
            }
          }

          if (contracts.length === 0) throw new Error("No valid contracts found for resolution");

          const result = inheritanceManager.resolveConflicts(contracts);

          await logAudit("contract_conflict_resolution", {
            contract_ids: args.contract_ids,
            conflicts_found: result.conflicts_found,
            content_preview: `Resolved ${result.conflicts_found} conflicts across ${contracts.length} contracts`,
          });

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                ...result,
              }, null, 2),
            }],
          };
        }

        case "get_chain": {
          if (!args.contract_id) throw new Error("contract_id required for get_chain");

          const chain = await inheritanceManager.getContractChain(args.contract_id);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                contract_id: args.contract_id,
                chain_length: chain.length,
                chain,
                has_expired: chain.some((c) => c.is_expired),
              }, null, 2),
            }],
          };
        }

        case "list": {
          if (!args.agent_id) throw new Error("agent_id required for list");

          const contracts = await inheritanceManager.listContractsByAgent(args.agent_id);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                agent_id: args.agent_id,
                contract_count: contracts.length,
                contracts,
              }, null, 2),
            }],
          };
        }

        default:
          return {
            content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }],
            isError: true,
          };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Constitutional contract error: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ============================================
// W2-B3: Red Team Agent Tool (REQ-EVO-018)
// ============================================

server.tool(
  "red_team",
  "Run adversarial self-testing campaigns to probe for vulnerabilities. Simulates attacks without executing destructive actions. Operations: campaign (run full test), findings (list findings), trend (compare campaigns over time), report (generate full report).",
  z.object({
    operation: z.enum(["campaign", "findings", "trend", "report"])
      .describe("Red team operation to perform"),
    categories: z.array(z.enum([
      "goal_hijacking", "tool_misuse", "privilege_escalation",
      "memory_poisoning", "prompt_injection", "data_exfiltration",
    ])).optional().describe("Attack categories to test (default: all)"),
    depth: z.number().optional().default(1)
      .describe("Test depth: 1=quick scan, 2=full suite (default: 1)"),
    severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional()
      .describe("Filter findings by severity (for findings operation)"),
    limit: z.number().optional().default(50)
      .describe("Max findings to return (for findings operation)"),
  }).shape,
  async (args) => {
    if (!redTeamAgent) {
      return {
        content: [{ type: "text" as const, text: "Red Team Agent not initialized." }],
        isError: true,
      };
    }

    try {
      switch (args.operation) {
        case "campaign": {
          const categories = args.categories?.map((c) => c as AttackCategory);
          const result = await redTeamAgent.runCampaign(categories, args.depth || 1);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                campaign_id: result.id,
                started_at: result.started_at,
                completed_at: result.completed_at,
                categories_tested: result.categories_tested,
                depth: result.depth,
                total_findings: result.findings.length,
                summary: result.summary,
                uncaught_findings: result.findings
                  .filter((f) => !f.defense_caught)
                  .map((f) => ({
                    category: f.category,
                    severity: f.severity,
                    description: f.description,
                    remediation: f.remediation,
                  })),
                message: `Campaign complete: ${result.summary.total_tests} tests, ${Math.round(result.summary.defense_catch_rate * 100)}% catch rate, overall risk: ${result.summary.overall_risk}`,
              }, null, 2),
            }],
          };
        }

        case "findings": {
          const findings = await redTeamAgent.getFindings(
            args.severity as any,
            args.limit || 50
          );

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                finding_count: findings.length,
                severity_filter: args.severity || "all",
                findings,
              }, null, 2),
            }],
          };
        }

        case "trend": {
          const trend = await redTeamAgent.getTrendAnalysis();

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                ...trend,
              }, null, 2),
            }],
          };
        }

        case "report": {
          const report = await redTeamAgent.generateReport();

          return {
            content: [{
              type: "text" as const,
              text: report,
            }],
          };
        }

        default:
          return {
            content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }],
            isError: true,
          };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Red team error: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ============================================
// W2-B4: Multi-Agent Architecture Tools (REQ-EVO-022/028/025/023)
// ============================================

server.tool(
  "task_specialization",
  "Track agent performance per task type, compute routing scores, detect specialization. Operations: record_outcome, routing_score, specialization_report, performance_matrix, best_agent, set_availability.",
  z.object({
    operation: z.enum(["record_outcome", "routing_score", "specialization_report", "performance_matrix", "best_agent", "set_availability"])
      .describe("Operation to perform"),
    agent_id: z.string().optional().describe("Agent ID (required for most operations)"),
    task_type: z.string().optional().describe("Task type (for record_outcome, routing_score, best_agent)"),
    success: z.boolean().optional().describe("Whether the task succeeded (for record_outcome)"),
    cost: z.number().optional().describe("Cost of the task execution (for record_outcome)"),
    time_ms: z.number().optional().describe("Time in ms for the task execution (for record_outcome)"),
    agent_ids: z.array(z.string()).optional().describe("List of candidate agent IDs (for best_agent)"),
    available: z.boolean().optional().describe("Whether agent is available (for set_availability)"),
  }).shape,
  async (args) => {
    if (!taskSpecEngine) {
      return {
        content: [{ type: "text" as const, text: "Task Specialization Engine not initialized." }],
        isError: true,
      };
    }

    try {
      switch (args.operation) {
        case "record_outcome": {
          if (!args.agent_id || !args.task_type || args.success === undefined || args.cost === undefined || args.time_ms === undefined) {
            throw new Error("agent_id, task_type, success, cost, and time_ms are required for record_outcome");
          }
          const record = await taskSpecEngine.recordOutcome({
            agent_id: args.agent_id,
            task_type: args.task_type,
            success: args.success,
            cost: args.cost,
            time_ms: args.time_ms,
          });
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, record }, null, 2),
            }],
          };
        }

        case "routing_score": {
          if (!args.agent_id || !args.task_type) {
            throw new Error("agent_id and task_type are required for routing_score");
          }
          const score = taskSpecEngine.getRoutingScore(args.agent_id, args.task_type);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, routing_score: score }, null, 2),
            }],
          };
        }

        case "specialization_report": {
          if (!args.agent_id) {
            throw new Error("agent_id is required for specialization_report");
          }
          const report = taskSpecEngine.getSpecializationReport(args.agent_id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, report }, null, 2),
            }],
          };
        }

        case "performance_matrix": {
          const matrix = taskSpecEngine.getPerformanceMatrix();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                total_records: matrix.length,
                matrix,
              }, null, 2),
            }],
          };
        }

        case "best_agent": {
          if (!args.task_type || !args.agent_ids || args.agent_ids.length === 0) {
            throw new Error("task_type and agent_ids are required for best_agent");
          }
          const best = taskSpecEngine.getBestAgent(args.task_type, args.agent_ids);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                best_agent: best,
              }, null, 2),
            }],
          };
        }

        case "set_availability": {
          if (!args.agent_id || args.available === undefined) {
            throw new Error("agent_id and available are required for set_availability");
          }
          taskSpecEngine.setAvailability(args.agent_id, args.available);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                agent_id: args.agent_id,
                available: args.available,
              }, null, 2),
            }],
          };
        }

        default:
          return {
            content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }],
            isError: true,
          };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Task specialization error: ${msg}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "cost_router",
  "Cost-aware agent routing with 3-tier model cascading (Haiku/Sonnet/Opus). Operations: classify, select_model, record_outcome, analytics, set_budget, check_budget.",
  z.object({
    operation: z.enum(["classify", "select_model", "record_outcome", "analytics", "set_budget", "check_budget"])
      .describe("Operation to perform"),
    task_description: z.string().optional().describe("Task description (for classify, select_model)"),
    complexity: z.enum(["simple", "medium", "complex"]).optional().describe("Override complexity (for select_model)"),
    force_tier: z.enum(["haiku", "sonnet", "opus"]).optional().describe("Force a specific model tier (for select_model)"),
    failed_tiers: z.array(z.enum(["haiku", "sonnet", "opus"])).optional().describe("Tiers that already failed (for cascading)"),
    task_type: z.string().optional().describe("Task type label (for record_outcome)"),
    model_tier: z.enum(["haiku", "sonnet", "opus"]).optional().describe("Model used (for record_outcome)"),
    input_tokens: z.number().optional().describe("Input token count (for record_outcome)"),
    output_tokens: z.number().optional().describe("Output token count (for record_outcome)"),
    outcome: z.enum(["success", "failure", "escalated"]).optional().describe("Task outcome (for record_outcome)"),
    tier: z.enum(["haiku", "sonnet", "opus"]).optional().describe("Model tier (for set_budget, check_budget)"),
    daily_limit: z.number().optional().describe("Daily budget limit in $ (for set_budget)"),
    since: z.string().optional().describe("ISO date to filter analytics from"),
  }).shape,
  async (args) => {
    if (!costRouter) {
      return {
        content: [{ type: "text" as const, text: "Cost-Aware Router not initialized." }],
        isError: true,
      };
    }

    try {
      switch (args.operation) {
        case "classify": {
          if (!args.task_description) throw new Error("task_description required for classify");
          const complexity = costRouter.classifyComplexity(args.task_description);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, complexity, task_description: args.task_description.slice(0, 100) }, null, 2),
            }],
          };
        }

        case "select_model": {
          if (!args.task_description) throw new Error("task_description required for select_model");
          const selection = costRouter.selectModel({
            task_description: args.task_description,
            complexity: args.complexity as TaskComplexity | undefined,
            force_tier: args.force_tier as ModelTier | undefined,
            failed_tiers: args.failed_tiers as ModelTier[] | undefined,
          });
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, selection }, null, 2),
            }],
          };
        }

        case "record_outcome": {
          if (!args.task_type || !args.model_tier || args.input_tokens === undefined || args.output_tokens === undefined || !args.outcome) {
            throw new Error("task_type, model_tier, input_tokens, output_tokens, and outcome are required");
          }
          const complexity = args.complexity || costRouter.classifyComplexity(args.task_type);
          const record = await costRouter.recordOutcome({
            task_type: args.task_type,
            model_tier: args.model_tier as ModelTier,
            input_tokens: args.input_tokens,
            output_tokens: args.output_tokens,
            outcome: args.outcome,
            complexity: complexity as TaskComplexity,
          });
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, record }, null, 2),
            }],
          };
        }

        case "analytics": {
          const analytics = costRouter.getCostAnalytics(args.since);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, analytics }, null, 2),
            }],
          };
        }

        case "set_budget": {
          if (!args.tier || args.daily_limit === undefined) {
            throw new Error("tier and daily_limit are required for set_budget");
          }
          const budget = costRouter.setDailyBudget(args.tier as ModelTier, args.daily_limit);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, budget }, null, 2),
            }],
          };
        }

        case "check_budget": {
          if (!args.tier) throw new Error("tier is required for check_budget");
          const budget = costRouter.checkBudget(args.tier as ModelTier);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, budget }, null, 2),
            }],
          };
        }

        default:
          return {
            content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }],
            isError: true,
          };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Cost router error: ${msg}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "parl_coordinator",
  "Parallel Agent State Coordination (PARL). Advisory locks, state broadcast, heartbeat monitoring. Operations: acquire_lock, release_lock, broadcast_state, get_state_log, heartbeat, check_health, get_active_locks.",
  z.object({
    operation: z.enum(["acquire_lock", "release_lock", "broadcast_state", "get_state_log", "heartbeat", "check_health", "get_active_locks"])
      .describe("Operation to perform"),
    resource_id: z.string().optional().describe("Resource to lock/unlock"),
    agent_id: z.string().optional().describe("Agent ID"),
    lock_type: z.enum(["read", "write"]).optional().describe("Lock type (for acquire_lock)"),
    ttl_ms: z.number().optional().describe("Lock TTL in ms, max 300000 (for acquire_lock)"),
    event_type: z.string().optional().describe("Event type (for broadcast_state, get_state_log)"),
    payload: z.record(z.string(), z.unknown()).optional().describe("Event payload (for broadcast_state)"),
    since_sequence: z.number().optional().describe("Get events after this sequence number (for get_state_log)"),
    limit: z.number().optional().describe("Max events to return (for get_state_log)"),
  }).shape,
  async (args) => {
    if (!parlCoordinator) {
      return {
        content: [{ type: "text" as const, text: "PARL Coordinator not initialized." }],
        isError: true,
      };
    }

    try {
      switch (args.operation) {
        case "acquire_lock": {
          if (!args.resource_id || !args.agent_id || !args.lock_type) {
            throw new Error("resource_id, agent_id, and lock_type are required for acquire_lock");
          }
          const result = await parlCoordinator.acquireLock({
            resource_id: args.resource_id,
            agent_id: args.agent_id,
            lock_type: args.lock_type as LockType,
            ttl_ms: args.ttl_ms,
          });
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, ...result }, null, 2),
            }],
          };
        }

        case "release_lock": {
          if (!args.resource_id || !args.agent_id) {
            throw new Error("resource_id and agent_id are required for release_lock");
          }
          const result = await parlCoordinator.releaseLock({
            resource_id: args.resource_id,
            agent_id: args.agent_id,
          });
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, ...result }, null, 2),
            }],
          };
        }

        case "broadcast_state": {
          if (!args.agent_id || !args.event_type || !args.payload) {
            throw new Error("agent_id, event_type, and payload are required for broadcast_state");
          }
          const event = parlCoordinator.broadcastState({
            source_agent_id: args.agent_id,
            event_type: args.event_type,
            payload: args.payload as Record<string, unknown>,
          });
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, event }, null, 2),
            }],
          };
        }

        case "get_state_log": {
          const events = parlCoordinator.getStateLog({
            event_type: args.event_type,
            since_sequence: args.since_sequence,
            limit: args.limit,
          });
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, event_count: events.length, events }, null, 2),
            }],
          };
        }

        case "heartbeat": {
          if (!args.agent_id) throw new Error("agent_id required for heartbeat");
          const record = parlCoordinator.heartbeat(args.agent_id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, heartbeat: record }, null, 2),
            }],
          };
        }

        case "check_health": {
          const health = parlCoordinator.checkHealth();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                alive_count: health.alive.length,
                suspected_count: health.suspected.length,
                dead_count: health.dead.length,
                ...health,
              }, null, 2),
            }],
          };
        }

        case "get_active_locks": {
          const locks = parlCoordinator.getActiveLocks();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, lock_count: locks.length, locks }, null, 2),
            }],
          };
        }

        default:
          return {
            content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }],
            isError: true,
          };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `PARL coordinator error: ${msg}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "bft_consensus",
  "Byzantine Fault Tolerance for agent consensus. Voting protocol with weighted confidence. Operations: submit_vote, tally, get_result, adjust_weights, voting_history, get_votes, get_weight, set_weight.",
  z.object({
    operation: z.enum(["submit_vote", "tally", "get_result", "adjust_weights", "voting_history", "get_votes", "get_weight", "set_weight"])
      .describe("Operation to perform"),
    agent_id: z.string().optional().describe("Agent ID (for submit_vote, get_weight, set_weight)"),
    proposal_id: z.string().optional().describe("Proposal ID (for submit_vote, tally, get_result, adjust_weights, get_votes)"),
    verdict: z.enum(["approve", "reject", "abstain"]).optional().describe("Vote verdict (for submit_vote)"),
    confidence: z.number().optional().describe("Confidence 0.0-1.0 (for submit_vote)"),
    reasoning: z.string().optional().describe("Vote reasoning (for submit_vote)"),
    evidence_hashes: z.array(z.string()).optional().describe("SHA-256 hashes of evidence (for submit_vote)"),
    is_critical: z.boolean().optional().describe("Whether this is a critical finding (for submit_vote)"),
    weight: z.number().optional().describe("Agent weight 0.5-2.0 (for set_weight)"),
    limit: z.number().optional().describe("Max results (for voting_history)"),
  }).shape,
  async (args) => {
    if (!bftConsensus) {
      return {
        content: [{ type: "text" as const, text: "BFT Consensus not initialized." }],
        isError: true,
      };
    }

    try {
      switch (args.operation) {
        case "submit_vote": {
          if (!args.agent_id || !args.proposal_id || !args.verdict || args.confidence === undefined || !args.reasoning) {
            throw new Error("agent_id, proposal_id, verdict, confidence, and reasoning are required for submit_vote");
          }
          const vote = await bftConsensus.submitVote({
            agent_id: args.agent_id,
            proposal_id: args.proposal_id,
            verdict: args.verdict,
            confidence: args.confidence,
            reasoning: args.reasoning,
            evidence_hashes: args.evidence_hashes || [],
            is_critical: args.is_critical,
          });
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, vote }, null, 2),
            }],
          };
        }

        case "tally": {
          if (!args.proposal_id) throw new Error("proposal_id required for tally");
          const result = bftConsensus.tally(args.proposal_id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, consensus: result }, null, 2),
            }],
          };
        }

        case "get_result": {
          if (!args.proposal_id) throw new Error("proposal_id required for get_result");
          const result = bftConsensus.getConsensusResult(args.proposal_id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, consensus: result }, null, 2),
            }],
          };
        }

        case "adjust_weights": {
          if (!args.proposal_id) throw new Error("proposal_id required for adjust_weights");
          const adjustments = await bftConsensus.adjustWeights(args.proposal_id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, adjustments }, null, 2),
            }],
          };
        }

        case "voting_history": {
          const history = bftConsensus.getVotingHistory(args.limit);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, total_proposals: history.length, history }, null, 2),
            }],
          };
        }

        case "get_votes": {
          if (!args.proposal_id) throw new Error("proposal_id required for get_votes");
          const votes = bftConsensus.getVotes(args.proposal_id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, vote_count: votes.length, votes }, null, 2),
            }],
          };
        }

        case "get_weight": {
          if (!args.agent_id) throw new Error("agent_id required for get_weight");
          const w = bftConsensus.getWeight(args.agent_id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, agent_id: args.agent_id, weight: w }, null, 2),
            }],
          };
        }

        case "set_weight": {
          if (!args.agent_id || args.weight === undefined) {
            throw new Error("agent_id and weight are required for set_weight");
          }
          const newWeight = bftConsensus.setWeight(args.agent_id, args.weight);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: true, agent_id: args.agent_id, weight: newWeight }, null, 2),
            }],
          };
        }

        default:
          return {
            content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }],
            isError: true,
          };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `BFT consensus error: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ============================================
// W3: Agent Capability Marketplace (REQ-EVO-029)
// ============================================

server.tool(
  "agent_marketplace",
  "Agent Capability Marketplace: publish, install, search, certify, and list installed agents. Operations: publish, install, search, certify, list_installed.",
  z.object({
    operation: z.enum(["publish", "install", "search", "certify", "list_installed"])
      .describe("Operation to perform"),
    name: z.string().optional().describe("Agent name (for publish)"),
    version: z.string().optional().describe("Semver version (for publish)"),
    capability_declaration: z.array(z.string()).optional().describe("Capabilities (for publish)"),
    author: z.string().optional().describe("Author name (for publish)"),
    description: z.string().optional().describe("Description (for publish)"),
    dependencies: z.array(z.string()).optional().describe("Dependency names (for publish)"),
    signature: z.string().optional().describe("Manifest signature (for publish)"),
    marketplace_id: z.string().optional().describe("Marketplace entry ID (for install, certify)"),
    query: z.string().optional().describe("Search query (for search)"),
    certifier: z.string().optional().describe("Certifier identity (for certify)"),
    limit: z.number().optional().describe("Max results (for search)"),
  }).shape,
  async (args) => {
    if (!agentMarketplace) {
      return { content: [{ type: "text" as const, text: "Agent Marketplace not initialized." }], isError: true };
    }
    try {
      switch (args.operation) {
        case "publish": {
          if (!args.name || !args.version || !args.capability_declaration || !args.author || !args.description) {
            throw new Error("name, version, capability_declaration, author, and description are required for publish");
          }
          const entry = await agentMarketplace.publish({
            name: args.name,
            version: args.version,
            capability_declaration: args.capability_declaration,
            author: args.author,
            description: args.description,
            dependencies: args.dependencies,
            signature: args.signature,
          });
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, entry }, null, 2) }] };
        }
        case "install": {
          if (!args.marketplace_id) throw new Error("marketplace_id required for install");
          const installed = await agentMarketplace.install(args.marketplace_id);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, installed }, null, 2) }] };
        }
        case "search": {
          if (!args.query) throw new Error("query required for search");
          const results = await agentMarketplace.search(args.query, args.limit || 10);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, count: results.length, results }, null, 2) }] };
        }
        case "certify": {
          if (!args.marketplace_id || !args.certifier) throw new Error("marketplace_id and certifier required for certify");
          const certified = await agentMarketplace.certify(args.marketplace_id, args.certifier);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, certified }, null, 2) }] };
        }
        case "list_installed": {
          const list = agentMarketplace.listInstalled();
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, count: list.length, installed: list }, null, 2) }] };
        }
        default:
          return { content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }], isError: true };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text" as const, text: `Marketplace error: ${msg}` }], isError: true };
    }
  }
);

// ============================================
// W3: Micro-Agent Swarms (REQ-EVO-030)
// ============================================

server.tool(
  "micro_swarm",
  "Micro-Agent Swarms: decompose tasks into parallel micro-agents (Haiku-class, stateless, <2s each). BFT consensus aggregation. Operations: decompose, execute, get_profiles.",
  z.object({
    operation: z.enum(["decompose", "execute", "get_profiles"])
      .describe("Operation to perform"),
    task: z.string().optional().describe("Task description (for decompose, execute)"),
    profile: z.enum(["code_review_swarm", "security_scan_swarm", "documentation_swarm", "test_coverage_swarm", "dependency_audit_swarm"])
      .optional().describe("Swarm profile (for decompose, execute)"),
    context: z.record(z.string(), z.unknown()).optional().describe("Additional context (for execute)"),
  }).shape,
  async (args) => {
    if (!microSwarm) {
      return { content: [{ type: "text" as const, text: "Micro-Agent Swarm not initialized." }], isError: true };
    }
    try {
      switch (args.operation) {
        case "decompose": {
          if (!args.task || !args.profile) throw new Error("task and profile required for decompose");
          const tasks = microSwarm.decompose(args.task, args.profile);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, micro_tasks: tasks }, null, 2) }] };
        }
        case "execute": {
          if (!args.task || !args.profile) throw new Error("task and profile required for execute");
          const result = await microSwarm.executeSwarm(args.task, args.profile, args.context);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, result }, null, 2) }] };
        }
        case "get_profiles": {
          const profiles = microSwarm.getSwarmProfiles();
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, profiles }, null, 2) }] };
        }
        default:
          return { content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }], isError: true };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text" as const, text: `Swarm error: ${msg}` }], isError: true };
    }
  }
);

// ============================================
// W3: Causal Reasoning Debugger (REQ-EVO-032)
// ============================================

server.tool(
  "causal_debug",
  "Causal Reasoning Debugger: analyze decisions, find alternative memories, run counterfactual scenarios. Operations: analyze, find_alternatives, counterfactual.",
  z.object({
    operation: z.enum(["analyze", "find_alternatives", "counterfactual"])
      .describe("Operation to perform"),
    decision_point: z.string().optional().describe("Description of the decision (for analyze)"),
    recalled_memory_ids: z.array(z.string()).optional().describe("Memory IDs that were in context (for analyze)"),
    query_used: z.string().optional().describe("Query that was used for recall (for analyze, find_alternatives)"),
    outcome: z.string().optional().describe("What happened (for analyze)"),
    collection: z.string().optional().describe("Memory collection to search (default: claude_memories)"),
    exclude_ids: z.array(z.string()).optional().describe("Memory IDs to exclude (for find_alternatives)"),
    original_analysis_id: z.string().optional().describe("Analysis ID to replay (for counterfactual)"),
    include_memory_ids: z.array(z.string()).optional().describe("Memories to include in replay (for counterfactual)"),
    exclude_memory_ids: z.array(z.string()).optional().describe("Memories to exclude from replay (for counterfactual)"),
    decision_context: z.string().optional().describe("Context for counterfactual replay"),
    limit: z.number().optional().describe("Max results"),
  }).shape,
  async (args) => {
    if (!causalDebugger) {
      return { content: [{ type: "text" as const, text: "Causal Debugger not initialized." }], isError: true };
    }
    try {
      switch (args.operation) {
        case "analyze": {
          if (!args.decision_point || !args.recalled_memory_ids || !args.query_used || !args.outcome) {
            throw new Error("decision_point, recalled_memory_ids, query_used, and outcome required for analyze");
          }
          const analysis = await causalDebugger.analyzeDecision({
            decision_point: args.decision_point,
            recalled_memory_ids: args.recalled_memory_ids,
            query_used: args.query_used,
            outcome: args.outcome,
            collection: args.collection,
          });
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, analysis }, null, 2) }] };
        }
        case "find_alternatives": {
          if (!args.query_used) throw new Error("query_used required for find_alternatives");
          const alternatives = await causalDebugger.findAlternativeMemories(
            args.query_used,
            args.exclude_ids || [],
            args.collection || "claude_memories",
            args.limit || 20
          );
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, count: alternatives.length, alternatives }, null, 2) }] };
        }
        case "counterfactual": {
          if (!args.original_analysis_id || !args.decision_context) {
            throw new Error("original_analysis_id and decision_context required for counterfactual");
          }
          const result = await causalDebugger.runCounterfactual({
            original_analysis_id: args.original_analysis_id,
            include_memory_ids: args.include_memory_ids || [],
            exclude_memory_ids: args.exclude_memory_ids || [],
            decision_context: args.decision_context,
          });
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, ...result }, null, 2) }] };
        }
        default:
          return { content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }], isError: true };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text" as const, text: `Causal debug error: ${msg}` }], isError: true };
    }
  }
);

// ============================================
// W3: Visual Agent Flow Debugger (REQ-EVO-033)
// ============================================

server.tool(
  "flow_debug",
  "Visual Agent Flow Debugger: DAG workflow representation, live state tracking, execution comparison, history. Operations: get_dag, live_state, compare, history.",
  z.object({
    operation: z.enum(["get_dag", "live_state", "compare", "history"])
      .describe("Operation to perform"),
    workflow_id: z.string().optional().describe("Workflow ID (for get_dag)"),
    conductor_state: z.record(z.string(), z.unknown()).optional().describe("Conductor state JSON (for get_dag)"),
    execution_id_a: z.string().optional().describe("First execution ID (for compare)"),
    execution_id_b: z.string().optional().describe("Second execution ID (for compare)"),
    limit: z.number().optional().describe("Max results (for history)"),
  }).shape,
  async (args) => {
    if (!flowDebugger) {
      return { content: [{ type: "text" as const, text: "Flow Debugger not initialized." }], isError: true };
    }
    try {
      switch (args.operation) {
        case "get_dag": {
          const dag = await flowDebugger.getWorkflowDAG({
            workflow_id: args.workflow_id,
            conductor_state: args.conductor_state,
          });
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, dag }, null, 2) }] };
        }
        case "live_state": {
          const state = await flowDebugger.getLiveState();
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, state }, null, 2) }] };
        }
        case "compare": {
          if (!args.execution_id_a || !args.execution_id_b) {
            throw new Error("execution_id_a and execution_id_b required for compare");
          }
          const comparison = await flowDebugger.compareExecutions(args.execution_id_a, args.execution_id_b);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, comparison }, null, 2) }] };
        }
        case "history": {
          const history = await flowDebugger.getHistory(args.limit || 20);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, count: history.length, history }, null, 2) }] };
        }
        default:
          return { content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }], isError: true };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text" as const, text: `Flow debug error: ${msg}` }], isError: true };
    }
  }
);

// ============================================
// W3: Natural Language Workflow Authoring (REQ-EVO-034)
// ============================================

server.tool(
  "workflow_author",
  "Natural Language Workflow Authoring: compile NL descriptions to conductor workflows, use templates, refine. Operations: compile, get_templates, refine.",
  z.object({
    operation: z.enum(["compile", "get_templates", "refine"])
      .describe("Operation to perform"),
    description: z.string().optional().describe("Natural language workflow description (for compile)"),
    available_agents: z.array(z.object({
      id: z.string(),
      capabilities: z.array(z.string()),
    })).optional().describe("Available agents with capabilities (for compile)"),
    workflow_id: z.string().optional().describe("Workflow ID to refine (for refine)"),
    refinement: z.string().optional().describe("Refinement description (for refine)"),
  }).shape,
  async (args) => {
    if (!workflowCompiler) {
      return { content: [{ type: "text" as const, text: "Workflow Compiler not initialized." }], isError: true };
    }
    try {
      switch (args.operation) {
        case "compile": {
          if (!args.description) throw new Error("description required for compile");
          const workflow = await workflowCompiler.compileFromNL(args.description, args.available_agents);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, workflow }, null, 2) }] };
        }
        case "get_templates": {
          const templates = workflowCompiler.getTemplates();
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, templates }, null, 2) }] };
        }
        case "refine": {
          if (!args.workflow_id || !args.refinement) throw new Error("workflow_id and refinement required for refine");
          const refined = await workflowCompiler.refineWorkflow(args.workflow_id, args.refinement);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, workflow: refined }, null, 2) }] };
        }
        default:
          return { content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }], isError: true };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text" as const, text: `Workflow compiler error: ${msg}` }], isError: true };
    }
  }
);

// ============================================
// W3: Automated Skill Discovery (REQ-EVO-036)
// ============================================

server.tool(
  "skill_discovery",
  "Automated Skill Discovery from Trajectories: detect repeating tool sequences, propose skills, manage lifecycle. Operations: detect_patterns, propose_skills, manage_lifecycle.",
  z.object({
    operation: z.enum(["detect_patterns", "propose_skills", "manage_lifecycle"])
      .describe("Operation to perform"),
    trajectory_collection: z.string().optional().describe("Trajectory collection name (default: trajectories)"),
    limit: z.number().optional().describe("Max trajectories to analyze"),
  }).shape,
  async (args) => {
    if (!skillDiscovery) {
      return { content: [{ type: "text" as const, text: "Skill Discovery not initialized." }], isError: true };
    }
    try {
      switch (args.operation) {
        case "detect_patterns": {
          const patterns = await skillDiscovery.detectPatterns(args.trajectory_collection, args.limit);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, count: patterns.length, patterns }, null, 2) }] };
        }
        case "propose_skills": {
          const skills = await skillDiscovery.proposeSkills();
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, count: skills.length, skills }, null, 2) }] };
        }
        case "manage_lifecycle": {
          const result = await skillDiscovery.manageLifecycle();
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, ...result }, null, 2) }] };
        }
        default:
          return { content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }], isError: true };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text" as const, text: `Skill discovery error: ${msg}` }], isError: true };
    }
  }
);

// ============================================
// W3: Multi-Modal Agent Inputs (REQ-EVO-037)
// ============================================

server.tool(
  "multimodal_input",
  "Multi-Modal Agent Inputs: process images, audio, and architecture diagrams. Extract structured text with modality tags. Operations: process_image, process_audio, process_diagram, get_stats.",
  z.object({
    operation: z.enum(["process_image", "process_audio", "process_diagram", "get_stats"])
      .describe("Operation to perform"),
    source_path: z.string().optional().describe("File path (for process_image, process_audio, process_diagram)"),
    description: z.string().optional().describe("Description/context (for process_image, process_diagram)"),
    extract_text: z.boolean().optional().describe("Whether to extract text from image"),
    language: z.string().optional().describe("Audio language (for process_audio)"),
    whisper_model: z.string().optional().describe("Whisper model name (for process_audio)"),
    diagram_type: z.string().optional().describe("Diagram type: architecture, sequence, flow, etc. (for process_diagram)"),
  }).shape,
  async (args) => {
    if (!multiModalHandler) {
      return { content: [{ type: "text" as const, text: "Multi-Modal Handler not initialized." }], isError: true };
    }
    try {
      switch (args.operation) {
        case "process_image": {
          if (!args.source_path) throw new Error("source_path required for process_image");
          const artifact = await multiModalHandler.processImage({
            source_path: args.source_path,
            description: args.description,
            extract_text: args.extract_text,
          });
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, artifact }, null, 2) }] };
        }
        case "process_audio": {
          if (!args.source_path) throw new Error("source_path required for process_audio");
          const artifact = await multiModalHandler.processAudio({
            source_path: args.source_path,
            language: args.language,
            whisper_model: args.whisper_model,
          });
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, artifact }, null, 2) }] };
        }
        case "process_diagram": {
          if (!args.source_path) throw new Error("source_path required for process_diagram");
          const artifact = await multiModalHandler.processDiagram({
            source_path: args.source_path,
            diagram_type: args.diagram_type,
            description: args.description,
          });
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, artifact }, null, 2) }] };
        }
        case "get_stats": {
          const stats = await multiModalHandler.getModalityStats();
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, stats }, null, 2) }] };
        }
        default:
          return { content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }], isError: true };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text" as const, text: `Multi-modal error: ${msg}` }], isError: true };
    }
  }
);

// ============================================
// W3: Agent Performance Benchmarking Suite (REQ-EVO-038)
// ============================================

server.tool(
  "benchmark_suite",
  "Agent Performance Benchmarking Suite: run benchmarks across 7 dimensions, detect regressions (>10% alert), historical trends, per-agent scorecards. Operations: run, compare, get_regressions, get_scorecard.",
  z.object({
    operation: z.enum(["run", "compare", "get_regressions", "get_scorecard"])
      .describe("Operation to perform"),
    agent_id: z.string().optional().describe("Agent ID (for run, get_regressions, get_scorecard)"),
    suite_name: z.string().optional().describe("Benchmark suite name (for run)"),
    test_results: z.array(z.object({
      name: z.string(),
      passed: z.boolean(),
      duration_ms: z.number(),
      steps_used: z.number(),
      cost: z.number(),
      errors: z.number(),
      notes: z.string().optional(),
    })).optional().describe("Test results to record (for run)"),
    baseline_id: z.string().optional().describe("Baseline benchmark ID for comparison (for run, compare)"),
    current_id: z.string().optional().describe("Current benchmark ID (for compare)"),
  }).shape,
  async (args) => {
    if (!benchmarkSuite) {
      return { content: [{ type: "text" as const, text: "Benchmark Suite not initialized." }], isError: true };
    }
    try {
      switch (args.operation) {
        case "run": {
          if (!args.agent_id) throw new Error("agent_id required for run");
          const result = await benchmarkSuite.runBenchmark({
            agent_id: args.agent_id,
            suite_name: args.suite_name,
            test_results: args.test_results,
            baseline_id: args.baseline_id,
          });
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, benchmark: result }, null, 2) }] };
        }
        case "compare": {
          if (!args.current_id || !args.baseline_id) {
            throw new Error("current_id and baseline_id required for compare");
          }
          const comparison = await benchmarkSuite.compareWithBaseline(args.current_id, args.baseline_id);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, comparison }, null, 2) }] };
        }
        case "get_regressions": {
          if (!args.agent_id) throw new Error("agent_id required for get_regressions");
          const regressions = await benchmarkSuite.getRegressions(args.agent_id);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, ...regressions }, null, 2) }] };
        }
        case "get_scorecard": {
          if (!args.agent_id) throw new Error("agent_id required for get_scorecard");
          const scorecard = await benchmarkSuite.getScorecard(args.agent_id);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, scorecard }, null, 2) }] };
        }
        default:
          return { content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }], isError: true };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text" as const, text: `Benchmark error: ${msg}` }], isError: true };
    }
  }
);

// ============================================
// REQ-EVO-039: Collaborative Agent Development Environment
// ============================================

server.tool(
  "agent_dev_env",
  "Create isolated dev environments with dev_* prefixed Qdrant collections, hot-reload file changes, test agent interactions, compare dev vs production behavior, and promote through dev -> sandbox -> production stages.",
  z.object({
    operation: z.enum(["create", "hot_reload", "test", "compare", "promote", "list"]).describe("Operation to perform"),
    instance_id: z.string().optional().describe("Dev instance ID (for hot_reload/test/compare/promote)"),
    name: z.string().optional().describe("Instance name (for create)"),
    config: z.record(z.string(), z.unknown()).optional().describe("Configuration object (for create)"),
    files: z.record(z.string(), z.string()).optional().describe("File path -> content map (for hot_reload)"),
    message: z.string().optional().describe("Test message (for test/compare)"),
  }).shape,
  async (args) => {
    if (!agentDevEnv) {
      return { content: [{ type: "text" as const, text: "Agent Dev Environment not initialized." }], isError: true };
    }

    try {
      switch (args.operation) {
        case "create": {
          const instance = await agentDevEnv.createDevInstance(args.name || "unnamed", args.config || {});
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, instance }, null, 2) }] };
        }
        case "hot_reload": {
          if (!args.instance_id) throw new Error("instance_id required for hot_reload");
          if (!args.files) throw new Error("files required for hot_reload");
          const result = await agentDevEnv.hotReload(args.instance_id, args.files);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, ...result }, null, 2) }] };
        }
        case "test": {
          if (!args.instance_id) throw new Error("instance_id required for test");
          if (!args.message) throw new Error("message required for test");
          const result = await agentDevEnv.testInteraction(args.instance_id, args.message);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, ...result }, null, 2) }] };
        }
        case "compare": {
          if (!args.instance_id) throw new Error("instance_id required for compare");
          if (!args.message) throw new Error("message required for compare");
          const result = await agentDevEnv.compareBehavior(args.instance_id, args.message);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, ...result }, null, 2) }] };
        }
        case "promote": {
          if (!args.instance_id) throw new Error("instance_id required for promote");
          const result = await agentDevEnv.promote(args.instance_id);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, ...result }, null, 2) }] };
        }
        case "list": {
          const instances = agentDevEnv.listInstances();
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, count: instances.length, instances }, null, 2) }] };
        }
        default:
          return { content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }], isError: true };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text" as const, text: `Agent dev env error: ${msg}` }], isError: true };
    }
  }
);

// ============================================
// REQ-EVO-040: Semantic Diff for Agent Behavior Changes
// ============================================

server.tool(
  "semantic_diff",
  "Run behavioral diffs between agent versions against test scenarios. Compares tool calls, memory access, decisions, and governance events. Classifies risk as Low/Medium/High/Critical and generates impact assessments.",
  z.object({
    operation: z.enum(["diff", "classify_risk", "impact_assessment"]).describe("Operation to perform"),
    before_version: z.string().optional().describe("Before version identifier (for diff)"),
    after_version: z.string().optional().describe("After version identifier (for diff)"),
    scenarios: z.array(z.object({
      name: z.string(),
      description: z.string(),
      test_message: z.string(),
    })).optional().describe("Test scenarios to run (for diff)"),
    diff_id: z.string().optional().describe("Diff result ID (for classify_risk/impact_assessment)"),
  }).shape,
  async (args) => {
    if (!semanticDiff) {
      return { content: [{ type: "text" as const, text: "Semantic Diff not initialized." }], isError: true };
    }

    try {
      switch (args.operation) {
        case "diff": {
          if (!args.before_version || !args.after_version || !args.scenarios) {
            throw new Error("before_version, after_version, and scenarios required for diff");
          }
          const result = await semanticDiff.diffBehavior(args.before_version, args.after_version, args.scenarios);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, ...result }, null, 2) }] };
        }
        case "classify_risk": {
          if (!args.diff_id) throw new Error("diff_id required for classify_risk");
          const result = semanticDiff.classifyRisk(args.diff_id);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, ...result }, null, 2) }] };
        }
        case "impact_assessment": {
          if (!args.diff_id) throw new Error("diff_id required for impact_assessment");
          const result = semanticDiff.getImpactAssessment(args.diff_id);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, ...result }, null, 2) }] };
        }
        default:
          return { content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }], isError: true };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text" as const, text: `Semantic diff error: ${msg}` }], isError: true };
    }
  }
);

// ============================================
// REQ-EVO-051: Hippocampal Memory Consolidation Cycles
// ============================================

server.tool(
  "hippocampal_consolidation",
  "Run hippocampal-inspired memory consolidation cycles with 5 phases: replay, extraction, integration, pruning, reorganization. Manages tier transfers between hot/warm/long_term/pruned tiers based on age, recall frequency, and consolidation status.",
  z.object({
    operation: z.enum(["run_cycle", "tier_transfer", "status"]).describe("Operation to perform"),
    memory_id: z.string().optional().describe("Memory ID (for tier_transfer)"),
    from_tier: z.enum(["hot", "warm", "long_term", "pruned"]).optional().describe("Source tier (for tier_transfer)"),
    to_tier: z.enum(["hot", "warm", "long_term", "pruned"]).optional().describe("Destination tier (for tier_transfer)"),
    reason: z.string().optional().describe("Reason for transfer (for tier_transfer)"),
  }).shape,
  async (args) => {
    if (!hippocampalConsolidation) {
      return { content: [{ type: "text" as const, text: "Hippocampal Consolidation not initialized." }], isError: true };
    }

    try {
      switch (args.operation) {
        case "run_cycle": {
          const result = await hippocampalConsolidation.runConsolidationCycle();
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, cycle: result }, null, 2) }] };
        }
        case "tier_transfer": {
          if (!args.memory_id || !args.from_tier || !args.to_tier || !args.reason) {
            throw new Error("memory_id, from_tier, to_tier, and reason required for tier_transfer");
          }
          const result = await hippocampalConsolidation.tierTransfer(
            args.memory_id, args.from_tier, args.to_tier, args.reason
          );
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, transfer: result }, null, 2) }] };
        }
        case "status": {
          const result = await hippocampalConsolidation.getConsolidationStatus();
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, ...result }, null, 2) }] };
        }
        default:
          return { content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }], isError: true };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text" as const, text: `Hippocampal consolidation error: ${msg}` }], isError: true };
    }
  }
);

// ============================================
// REQ-EVO-053: Self-Improving Workflow Optimizer
// ============================================

server.tool(
  "workflow_optimizer",
  "Analyze completed workflow executions for inefficiencies. Identifies bottlenecks, parallelization opportunities, gate simplifications, and agent reallocations. Supports A/B testing of optimized vs original workflows and tracks improvement metrics.",
  z.object({
    operation: z.enum(["analyze", "propose", "ab_test", "metrics"]).describe("Operation to perform"),
    workflow_id: z.string().optional().describe("Workflow ID (for analyze/propose/ab_test)"),
    executions: z.array(z.object({
      steps: z.array(z.object({
        name: z.string(),
        duration_ms: z.number(),
        agent: z.string().optional(),
        gate_checks: z.number().optional(),
        dependencies: z.array(z.string()).optional(),
      })),
      total_duration_ms: z.number(),
    })).optional().describe("Execution data (for analyze)"),
    original: z.object({
      duration_ms: z.number(),
      outcome: z.string(),
    }).optional().describe("Original execution result (for ab_test)"),
    optimized: z.object({
      duration_ms: z.number(),
      outcome: z.string(),
    }).optional().describe("Optimized execution result (for ab_test)"),
  }).shape,
  async (args) => {
    if (!workflowOptimizer) {
      return { content: [{ type: "text" as const, text: "Workflow Optimizer not initialized." }], isError: true };
    }

    try {
      switch (args.operation) {
        case "analyze": {
          if (!args.workflow_id || !args.executions) {
            throw new Error("workflow_id and executions required for analyze");
          }
          const result = await workflowOptimizer.analyzeWorkflow(args.workflow_id, args.executions);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, analysis: result }, null, 2) }] };
        }
        case "propose": {
          if (!args.workflow_id) throw new Error("workflow_id required for propose");
          const result = await workflowOptimizer.proposeOptimizations(args.workflow_id);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, proposal: result }, null, 2) }] };
        }
        case "ab_test": {
          if (!args.workflow_id || !args.original || !args.optimized) {
            throw new Error("workflow_id, original, and optimized required for ab_test");
          }
          const result = await workflowOptimizer.abTest(args.workflow_id, args.original, args.optimized);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, ab_test: result }, null, 2) }] };
        }
        case "metrics": {
          const result = workflowOptimizer.getImprovementMetrics();
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, metrics: result }, null, 2) }] };
        }
        default:
          return { content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }], isError: true };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text" as const, text: `Workflow optimizer error: ${msg}` }], isError: true };
    }
  }
);

// ============================================
// REQ-EVO-056: Temporal Reasoning as First-Class Planning
// ============================================

server.tool(
  "temporal_planner",
  "Temporal-aware task planning with deadlines, dependencies, and constraints. Creates schedules using topological sort and forward/backward passes, identifies critical paths, optimizes schedules, and generates Gantt chart representations in JSON.",
  z.object({
    operation: z.enum(["create_plan", "critical_path", "optimize", "gantt"]).describe("Operation to perform"),
    plan_id: z.string().optional().describe("Plan ID (for critical_path/optimize/gantt)"),
    tasks: z.array(z.object({
      id: z.string(),
      name: z.string(),
      duration_minutes: z.number(),
      deadline: z.string().optional(),
      dependencies: z.array(z.string()),
      assigned_agent: z.string().optional(),
      priority: z.number(),
      constraints: z.array(z.object({
        type: z.enum(["start_after", "finish_before", "concurrent_with", "gap_between"]),
        target_task_id: z.string().optional(),
        datetime: z.string().optional(),
        gap_minutes: z.number().optional(),
      })),
    })).optional().describe("Tasks to plan (for create_plan)"),
    start_time: z.string().optional().describe("ISO 8601 plan start time (for create_plan)"),
  }).shape,
  async (args) => {
    if (!temporalPlanner) {
      return { content: [{ type: "text" as const, text: "Temporal Planner not initialized." }], isError: true };
    }

    try {
      switch (args.operation) {
        case "create_plan": {
          if (!args.tasks) throw new Error("tasks required for create_plan");
          const result = await temporalPlanner.createPlan(args.tasks, args.start_time);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, plan: result }, null, 2) }] };
        }
        case "critical_path": {
          if (!args.plan_id) throw new Error("plan_id required for critical_path");
          const result = temporalPlanner.criticalPath(args.plan_id);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, ...result }, null, 2) }] };
        }
        case "optimize": {
          if (!args.plan_id) throw new Error("plan_id required for optimize");
          const result = await temporalPlanner.optimizeSchedule(args.plan_id);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, optimized_plan: result }, null, 2) }] };
        }
        case "gantt": {
          if (!args.plan_id) throw new Error("plan_id required for gantt");
          const result = temporalPlanner.getGantt(args.plan_id);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, gantt: result }, null, 2) }] };
        }
        default:
          return { content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }], isError: true };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text" as const, text: `Temporal planner error: ${msg}` }], isError: true };
    }
  }
);

// ============================================
// REQ-EVO-057: The Meta-Agent
// ============================================

server.tool(
  "meta_agent",
  "Meta-agent that monitors and improves the agent ecosystem. Detects underperformers, suggests configuration changes, proposes agent compositions, identifies capability gaps. Subject to same governance constraints - cannot self-modify without approval.",
  z.object({
    operation: z.enum(["assess", "underperformers", "suggest_changes", "propose_compositions", "self_assess", "record_outcome", "get_suggestions"]).describe("Operation to perform"),
    agents: z.array(z.object({
      id: z.string(),
      name: z.string(),
      metrics: z.record(z.string(), z.number()),
      capabilities: z.array(z.string()),
      last_active: z.string(),
    })).optional().describe("Agent data for ecosystem assessment (for assess)"),
    suggestion_id: z.string().optional().describe("Suggestion ID (for record_outcome)"),
    successful: z.boolean().optional().describe("Whether suggestion was successful (for record_outcome)"),
  }).shape,
  async (args) => {
    if (!metaAgent) {
      return { content: [{ type: "text" as const, text: "Meta-Agent not initialized." }], isError: true };
    }

    try {
      switch (args.operation) {
        case "assess": {
          if (!args.agents) throw new Error("agents required for assess");
          const result = await metaAgent.assessEcosystem(args.agents);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, assessment: result }, null, 2) }] };
        }
        case "underperformers": {
          const result = metaAgent.detectUnderperformers();
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, count: result.length, underperformers: result }, null, 2) }] };
        }
        case "suggest_changes": {
          const result = metaAgent.suggestChanges();
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, count: result.length, suggestions: result }, null, 2) }] };
        }
        case "propose_compositions": {
          const result = metaAgent.proposeCompositions();
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, count: result.length, proposals: result }, null, 2) }] };
        }
        case "self_assess": {
          const result = await metaAgent.selfAssess();
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, self_assessment: result }, null, 2) }] };
        }
        case "record_outcome": {
          if (!args.suggestion_id || args.successful === undefined) {
            throw new Error("suggestion_id and successful required for record_outcome");
          }
          metaAgent.recordSuggestionOutcome(args.suggestion_id, args.successful);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, message: `Outcome recorded for suggestion ${args.suggestion_id}` }, null, 2) }] };
        }
        case "get_suggestions": {
          const result = metaAgent.getSuggestions();
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, count: result.length, suggestions: result }, null, 2) }] };
        }
        default:
          return { content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }], isError: true };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text" as const, text: `Meta-agent error: ${msg}` }], isError: true };
    }
  }
);

// ============================================
// ============================================
// W2-R + W3: Advanced Memory & Governance Tools
// ============================================

// REQ-EVO-006: Predictive Pre-Loading
server.tool(
  "predictive_preload",
  "Predictive pre-loading of memories based on trajectory patterns. Operations: extract (extract patterns from trajectory), preload (pre-load memories for session), feedback (strengthen/weaken prediction).",
  z.object({
    operation: z.enum(["extract", "preload", "feedback"])
      .describe("Operation to perform"),
    trajectory_id: z.string().optional()
      .describe("Trajectory ID (for extract)"),
    session_context: z.string().optional()
      .describe("Session context description (for preload)"),
    pattern_id: z.string().optional()
      .describe("Pattern ID (for feedback)"),
    memory_was_used: z.boolean().optional()
      .describe("Whether pre-loaded memory was actually used (for feedback)"),
  }).shape,
  async (args) => {
    if (!predictivePreloader) {
      return { content: [{ type: "text" as const, text: "Predictive Preloader not initialized." }], isError: true };
    }
    try {
      switch (args.operation) {
        case "extract": {
          if (!args.trajectory_id) throw new Error("trajectory_id required for extract");
          const pattern = await predictivePreloader.extractPatterns(args.trajectory_id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                pattern_id: pattern.id,
                trigger_keywords: pattern.trigger_keywords,
                memory_queries: pattern.memory_queries,
                likely_needed_memories: pattern.likely_needed_memories.length,
                strength: pattern.strength,
                message: `Pattern extracted with ${pattern.trigger_keywords.length} keywords and ${pattern.likely_needed_memories.length} memory references`,
              }, null, 2),
            }],
          };
        }
        case "preload": {
          if (!args.session_context) throw new Error("session_context required for preload");
          const result = await predictivePreloader.preloadForSession(args.session_context);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                ...result,
                message: `Matched ${result.patterns_matched} patterns, pre-loaded ${result.memories_preloaded} memories to working memory`,
              }, null, 2),
            }],
          };
        }
        case "feedback": {
          if (!args.pattern_id) throw new Error("pattern_id required for feedback");
          if (args.memory_was_used === undefined) throw new Error("memory_was_used required for feedback");
          const feedback = await predictivePreloader.recordFeedback(args.pattern_id, args.memory_was_used);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                ...feedback,
                message: `Pattern ${feedback.action}: strength ${feedback.previous_strength.toFixed(2)} -> ${feedback.new_strength.toFixed(2)}`,
              }, null, 2),
            }],
          };
        }
        default:
          return { content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }], isError: true };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text" as const, text: `Predictive preload error: ${msg}` }], isError: true };
    }
  }
);

// REQ-EVO-008: Cross-Instance Memory Federation
server.tool(
  "federation",
  "Cross-instance memory federation with Ed25519 keypairs, scoped sync, and jurisdiction validation. Operations: register (register local instance), sync (sync with target), validate_jurisdiction (check jurisdiction compatibility).",
  z.object({
    operation: z.enum(["register", "sync", "validate_jurisdiction"])
      .describe("Federation operation to perform"),
    instance_name: z.string().optional()
      .describe("Instance name (for register)"),
    endpoint: z.string().optional()
      .describe("Instance endpoint URL (for register)"),
    jurisdiction: z.enum(["us", "eu", "mena", "apac", "latam", "africa", "canada", "global"]).optional()
      .describe("Jurisdiction tag"),
    target_federation_id: z.string().optional()
      .describe("Target federation ID (for sync)"),
    scope: z.enum(["private", "instance", "team", "public"]).optional()
      .describe("Sync scope (for sync)"),
    collection: z.string().optional()
      .describe("Collection to sync (default: claude_memories)"),
    source_jurisdiction: z.enum(["us", "eu", "mena", "apac", "latam", "africa", "canada", "global"]).optional()
      .describe("Source jurisdiction (for validate_jurisdiction)"),
    target_jurisdiction: z.enum(["us", "eu", "mena", "apac", "latam", "africa", "canada", "global"]).optional()
      .describe("Target jurisdiction (for validate_jurisdiction)"),
  }).shape,
  async (args) => {
    if (!federationManager) {
      return { content: [{ type: "text" as const, text: "Federation Manager not initialized." }], isError: true };
    }
    try {
      switch (args.operation) {
        case "register": {
          if (!args.instance_name) throw new Error("instance_name required");
          if (!args.endpoint) throw new Error("endpoint required");
          if (!args.jurisdiction) throw new Error("jurisdiction required");
          const instance = await federationManager.registerInstance(
            args.instance_name, args.endpoint, args.jurisdiction as JurisdictionTag
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                federation_id: instance.federation_id,
                instance_name: instance.instance_name,
                jurisdiction: instance.jurisdiction,
                message: `Federation instance '${instance.instance_name}' registered with Ed25519 keypair`,
              }, null, 2),
            }],
          };
        }
        case "sync": {
          if (!args.target_federation_id) throw new Error("target_federation_id required");
          const result = await federationManager.syncCollections(
            args.target_federation_id,
            (args.scope || "public") as any,
            args.collection
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                ...result,
                message: `Sync complete: ${result.memories_sent} sent, ${result.conflicts_resolved} conflicts resolved, ${result.jurisdiction_blocked} blocked by jurisdiction`,
              }, null, 2),
            }],
          };
        }
        case "validate_jurisdiction": {
          if (!args.source_jurisdiction || !args.target_jurisdiction) {
            throw new Error("source_jurisdiction and target_jurisdiction required");
          }
          const validation = federationManager.validateJurisdiction(
            args.source_jurisdiction as JurisdictionTag,
            args.target_jurisdiction as JurisdictionTag
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                ...validation,
              }, null, 2),
            }],
          };
        }
        default:
          return { content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }], isError: true };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text" as const, text: `Federation error: ${msg}` }], isError: true };
    }
  }
);

// REQ-EVO-010: Memory-Grounded Self-Assessment
server.tool(
  "self_assess",
  "Memory-grounded self-assessment at task start. Classify task type, search trajectories for similar, calculate success rate, flag risks <70%, pre-load error patterns. Operations: assess (full readiness check), success_rate (historical rate), error_patterns (pre-load errors).",
  z.object({
    operation: z.enum(["assess", "success_rate", "error_patterns"])
      .describe("Assessment operation"),
    task_type: z.string().describe("Type of task (e.g., 'code_review', 'debugging', 'deployment')"),
    task_description: z.string().optional()
      .describe("Detailed task description (for assess and error_patterns)"),
  }).shape,
  async (args) => {
    if (!selfAssessment) {
      return { content: [{ type: "text" as const, text: "Self-Assessment not initialized." }], isError: true };
    }
    try {
      switch (args.operation) {
        case "assess": {
          const readiness = await selfAssessment.assessTaskReadiness(
            args.task_type, args.task_description || args.task_type
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                ...readiness,
                message: readiness.risk_flag
                  ? `WARNING: Historical success rate is ${Math.round(readiness.historical_success_rate * 100)}%. ${readiness.risk_reason}`
                  : `Confidence: ${readiness.confidence_level} (${readiness.total_attempts} similar tasks found, ${Math.round(readiness.historical_success_rate * 100)}% success rate)`,
              }, null, 2),
            }],
          };
        }
        case "success_rate": {
          const rate = await selfAssessment.getSuccessRate(args.task_type);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                ...rate,
                message: `${args.task_type}: ${rate.total > 0 ? Math.round(rate.success_rate * 100) + '%' : 'no data'} success rate (${rate.successes}/${rate.total}), trend: ${rate.trend}`,
              }, null, 2),
            }],
          };
        }
        case "error_patterns": {
          const patterns = await selfAssessment.preloadErrorPatterns(
            args.task_type, args.task_description || args.task_type
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                task_type: args.task_type,
                error_pattern_count: patterns.length,
                patterns,
                message: `Found ${patterns.length} error patterns for '${args.task_type}'`,
              }, null, 2),
            }],
          };
        }
        default:
          return { content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }], isError: true };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text" as const, text: `Self-assessment error: ${msg}` }], isError: true };
    }
  }
);

// REQ-EVO-019: Data Sovereignty Zones
server.tool(
  "data_sovereignty",
  "Per-memory jurisdiction tagging, GDPR cascading deletion, and jurisdiction-filtered recall. Operations: tag (assign jurisdiction), cascading_delete (GDPR-compliant recursive delete), filter (recall with jurisdiction filter).",
  z.object({
    operation: z.enum(["tag", "cascading_delete", "filter"])
      .describe("Sovereignty operation"),
    memory_id: z.string().optional()
      .describe("Memory ID (for tag, cascading_delete)"),
    jurisdiction: z.enum(["us", "eu", "mena", "apac", "latam", "africa", "canada", "global"])
      .describe("Jurisdiction tag"),
    collection: z.string().optional()
      .describe("Collection (default: claude_memories)"),
    retention_policy: z.string().optional()
      .describe("Retention policy description (for tag)"),
    query: z.string().optional()
      .describe("Search query (for filter)"),
    limit: z.number().optional().default(10)
      .describe("Max results (for filter)"),
  }).shape,
  async (args) => {
    if (!dataSovereignty) {
      return { content: [{ type: "text" as const, text: "Data Sovereignty not initialized." }], isError: true };
    }
    try {
      switch (args.operation) {
        case "tag": {
          if (!args.memory_id) throw new Error("memory_id required for tag");
          const tag = await dataSovereignty.tagJurisdiction(
            args.memory_id, args.jurisdiction as JurisdictionTag,
            args.collection, args.retention_policy
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                ...tag,
                message: `Memory ${args.memory_id} tagged with jurisdiction '${args.jurisdiction}'`,
              }, null, 2),
            }],
          };
        }
        case "cascading_delete": {
          if (!args.memory_id) throw new Error("memory_id required for cascading_delete");
          const result = await dataSovereignty.cascadingDelete(
            args.memory_id, args.jurisdiction as JurisdictionTag, args.collection
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                ...result,
                message: `Cascading delete: ${result.total_affected} memories deleted, ${result.flagged_descendants.length} descendants flagged${result.gdpr_compliant ? ' (GDPR compliant)' : ''}`,
              }, null, 2),
            }],
          };
        }
        case "filter": {
          if (!args.query) throw new Error("query required for filter");
          const filtered = await dataSovereignty.filterByJurisdiction(
            args.query, args.jurisdiction as JurisdictionTag,
            args.collection, args.limit
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                ...filtered,
                message: `Found ${filtered.total_found} memories in jurisdiction '${args.jurisdiction}' (${filtered.filtered_out} filtered out)`,
              }, null, 2),
            }],
          };
        }
        default:
          return { content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }], isError: true };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text" as const, text: `Data sovereignty error: ${msg}` }], isError: true };
    }
  }
);

// REQ-EVO-020: Governance Dashboard with Compliance Scoring
server.tool(
  "compliance_dashboard",
  "Multi-framework compliance scoring dashboard. ISO 42001, EU AI Act, OWASP Agentic Top 10. Operations: overall (weighted score), frameworks (per-framework scores), trends (30/60/90 day), gaps (gap list with remediation).",
  z.object({
    operation: z.enum(["overall", "frameworks", "trends", "gaps"])
      .describe("Dashboard operation"),
  }).shape,
  async (args) => {
    if (!complianceDashboard) {
      return { content: [{ type: "text" as const, text: "Compliance Dashboard not initialized." }], isError: true };
    }
    try {
      switch (args.operation) {
        case "overall": {
          const result = await complianceDashboard.getOverallScore();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                ...result,
                message: `Overall compliance score: ${result.overall_score}% | ${result.framework_scores.map(f => `${f.framework}: ${f.score}%`).join(' | ')} | ${result.gaps.filter(g => g.priority === 'critical').length} critical gaps`,
              }, null, 2),
            }],
          };
        }
        case "frameworks": {
          const scores = await complianceDashboard.getFrameworkScores();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                framework_count: scores.length,
                scores,
                message: scores.map(s => `${s.framework}: ${s.score}% (${s.controls_with_evidence}/${s.controls_total} controls satisfied)`).join('; '),
              }, null, 2),
            }],
          };
        }
        case "trends": {
          const trends = await complianceDashboard.getTrends();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                trend_count: trends.length,
                trends,
              }, null, 2),
            }],
          };
        }
        case "gaps": {
          const gaps = await complianceDashboard.getGaps();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                total_gaps: gaps.length,
                critical: gaps.filter(g => g.priority === "critical").length,
                high: gaps.filter(g => g.priority === "high").length,
                medium: gaps.filter(g => g.priority === "medium").length,
                low: gaps.filter(g => g.priority === "low").length,
                gaps,
              }, null, 2),
            }],
          };
        }
        default:
          return { content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }], isError: true };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text" as const, text: `Compliance dashboard error: ${msg}` }], isError: true };
    }
  }
);

// REQ-EVO-021: Stigmergic Coordination Layer
server.tool(
  "stigmergy",
  "Stigmergic coordination via pheromone trails in Qdrant. Trails encode successful tool chains, decay daily, evaporate when weak. Operations: reinforce (add/strengthen trail), decay (apply daily decay), guidance (get top trails for task).",
  z.object({
    operation: z.enum(["reinforce", "decay", "guidance"])
      .describe("Stigmergy operation"),
    task_type: z.string().optional()
      .describe("Task type (for reinforce, guidance)"),
    tool_chain: z.array(z.string()).optional()
      .describe("Ordered list of tools used (for reinforce)"),
    success_score: z.number().optional()
      .describe("Success score 0.0-1.0 (for reinforce)"),
    context_tags: z.array(z.string()).optional()
      .describe("Context tags (for reinforce, guidance)"),
  }).shape,
  async (args) => {
    if (!stigmergicCoordinator) {
      return { content: [{ type: "text" as const, text: "Stigmergic Coordinator not initialized." }], isError: true };
    }
    try {
      switch (args.operation) {
        case "reinforce": {
          if (!args.task_type) throw new Error("task_type required");
          if (!args.tool_chain || args.tool_chain.length === 0) throw new Error("tool_chain required");
          if (args.success_score === undefined) throw new Error("success_score required");
          const trail = await stigmergicCoordinator.reinforceTrail(
            args.task_type, args.tool_chain, args.success_score, args.context_tags
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                trail_id: trail.id,
                task_type: trail.task_type,
                pheromone_strength: trail.pheromone_strength,
                reinforcement_count: trail.reinforcement_count,
                message: `Trail reinforced: ${trail.tool_chain.join(' -> ')} (strength: ${trail.pheromone_strength.toFixed(2)}, reinforced ${trail.reinforcement_count}x)`,
              }, null, 2),
            }],
          };
        }
        case "decay": {
          const result = await stigmergicCoordinator.decayTrails();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                ...result,
                message: `Decay applied: ${result.decayed} decayed, ${result.evaporated} evaporated, ${result.remaining} remaining`,
              }, null, 2),
            }],
          };
        }
        case "guidance": {
          if (!args.task_type) throw new Error("task_type required");
          const guidance = await stigmergicCoordinator.getGuidance(
            args.task_type, args.context_tags
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                trail_count: guidance.trails.length,
                ...guidance,
              }, null, 2),
            }],
          };
        }
        default:
          return { content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }], isError: true };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text" as const, text: `Stigmergy error: ${msg}` }], isError: true };
    }
  }
);

// REQ-EVO-026: A2A Protocol Support
server.tool(
  "a2a_protocol",
  "Agent-to-Agent protocol bridge. JSON-LD agent cards, governance-validated task routing, agent discovery. Operations: agent_card (get/create local card), handle_task (receive incoming task), discover (find agents), delegate (send task to agent).",
  z.object({
    operation: z.enum(["agent_card", "handle_task", "discover", "delegate"])
      .describe("A2A operation"),
    agent_id: z.string().optional()
      .describe("Agent ID (for agent_card lookup, delegate target)"),
    task_type: z.string().optional()
      .describe("Task type (for handle_task, delegate)"),
    payload: z.record(z.string(), z.unknown()).optional()
      .describe("Task payload (for handle_task, delegate)"),
    priority: z.enum(["low", "medium", "high", "critical"]).optional()
      .describe("Task priority (for handle_task, delegate)"),
    source_agent: z.string().optional()
      .describe("Source agent ID (for handle_task)"),
    query: z.string().optional()
      .describe("Discovery query (for discover)"),
    capability_filter: z.string().optional()
      .describe("Filter by capability (for discover)"),
  }).shape,
  async (args) => {
    if (!a2aProtocolBridge) {
      return { content: [{ type: "text" as const, text: "A2A Protocol Bridge not initialized." }], isError: true };
    }
    try {
      switch (args.operation) {
        case "agent_card": {
          const card = await a2aProtocolBridge.getAgentCard(args.agent_id);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                card,
                message: `Agent card: ${card.name} (${card.capabilities.length} capabilities, trust: ${card.trust_level})`,
              }, null, 2),
            }],
          };
        }
        case "handle_task": {
          if (!args.task_type) throw new Error("task_type required");
          if (!args.source_agent) throw new Error("source_agent required");
          const request: A2ATaskRequest = {
            task_id: args.payload?.task_id as string || `task_${Date.now()}`,
            source_agent: args.source_agent,
            target_agent: (await a2aProtocolBridge.getAgentCard()).id,
            task_type: args.task_type,
            payload: args.payload || {},
            priority: (args.priority || "medium") as any,
            deadline: null,
            governance_validated: false,
          };
          const result = await a2aProtocolBridge.handleIncomingTask(request);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: result.status !== "failed",
                ...result,
                message: `Task ${result.task_id}: ${result.status}${result.error ? ` (${result.error})` : ''}`,
              }, null, 2),
            }],
          };
        }
        case "discover": {
          if (!args.query) throw new Error("query required for discover");
          const discovered = await a2aProtocolBridge.discoverAgents(
            args.query, args.capability_filter
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                ...discovered,
                message: `Found ${discovered.total_found} agents matching '${args.query}'`,
              }, null, 2),
            }],
          };
        }
        case "delegate": {
          if (!args.agent_id) throw new Error("agent_id required for delegate");
          if (!args.task_type) throw new Error("task_type required for delegate");
          const result = await a2aProtocolBridge.delegateTask(
            args.agent_id, args.task_type,
            args.payload || {},
            (args.priority || "medium") as any
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: result.status !== "failed",
                ...result,
                message: `Task delegation: ${result.status}${result.error ? ` (${result.error})` : ''}`,
              }, null, 2),
            }],
          };
        }
        default:
          return { content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }], isError: true };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text" as const, text: `A2A protocol error: ${msg}` }], isError: true };
    }
  }
);

// REQ-EVO-027: World Model for Software Environments
server.tool(
  "world_model",
  "World model of software environments in Qdrant. Service models with error patterns, rate limits, dependencies, state effects. Operations: predict (query model before plans), observe (record actual outcome), update (update model), coverage (model coverage report).",
  z.object({
    operation: z.enum(["predict", "observe", "update", "coverage"])
      .describe("World model operation"),
    service_name: z.string().optional()
      .describe("Service name (for predict, observe, update)"),
    operation_name: z.string().optional()
      .describe("Operation/endpoint name (for predict, observe)"),
    actual_status: z.number().optional()
      .describe("HTTP status code of actual response (for observe)"),
    actual_latency_ms: z.number().optional()
      .describe("Actual latency in ms (for observe)"),
    error: z.string().optional()
      .describe("Error message if failed (for observe)"),
    endpoint: z.string().optional()
      .describe("Service endpoint URL (for update)"),
    response_schema: z.record(z.string(), z.unknown()).optional()
      .describe("Response schema (for update)"),
    dependencies: z.array(z.string()).optional()
      .describe("Service dependencies (for update)"),
    state_effects: z.array(z.object({
      operation: z.string(),
      affected_services: z.array(z.string()),
      side_effects: z.array(z.string()),
      reversible: z.boolean(),
    })).optional()
      .describe("State effects of operations (for update)"),
    rate_limits: z.object({
      requests_per_minute: z.number().nullable().optional(),
      requests_per_hour: z.number().nullable().optional(),
      concurrent_limit: z.number().nullable().optional(),
      observed_throttle_count: z.number().optional(),
    }).optional()
      .describe("Rate limit info (for update)"),
  }).shape,
  async (args) => {
    if (!worldModel) {
      return { content: [{ type: "text" as const, text: "World Model not initialized." }], isError: true };
    }
    try {
      switch (args.operation) {
        case "predict": {
          if (!args.service_name) throw new Error("service_name required for predict");
          const prediction = await worldModel.predict(args.service_name, args.operation_name);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                ...prediction,
              }, null, 2),
            }],
          };
        }
        case "observe": {
          if (!args.service_name) throw new Error("service_name required for observe");
          if (args.actual_status === undefined) throw new Error("actual_status required for observe");
          if (args.actual_latency_ms === undefined) throw new Error("actual_latency_ms required for observe");
          const observation: ObservationRecord = {
            service_name: args.service_name,
            operation: args.operation_name || "unknown",
            actual_status: args.actual_status,
            actual_latency_ms: args.actual_latency_ms,
            error: args.error || null,
            timestamp: new Date().toISOString(),
          };
          const result = await worldModel.recordObservation(observation);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                ...result,
                message: `Observation recorded for '${args.service_name}': status ${args.actual_status}, ${args.actual_latency_ms}ms${args.error ? ` (error: ${args.error})` : ''}`,
              }, null, 2),
            }],
          };
        }
        case "update": {
          if (!args.service_name) throw new Error("service_name required for update");
          const model = await worldModel.updateModel(args.service_name, {
            endpoint: args.endpoint,
            response_schema: args.response_schema,
            dependencies: args.dependencies,
            state_effects: args.state_effects,
            rate_limits: args.rate_limits as any,
          });
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                model,
                message: `World model updated for '${args.service_name}'`,
              }, null, 2),
            }],
          };
        }
        case "coverage": {
          const coverage = await worldModel.getModelCoverage();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                ...coverage,
                message: `World model coverage: ${coverage.total_services} services, ${Math.round(coverage.overall_accuracy * 100)}% overall accuracy`,
              }, null, 2),
            }],
          };
        }
        default:
          return { content: [{ type: "text" as const, text: `Unknown operation: ${args.operation}` }], isError: true };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text" as const, text: `World model error: ${msg}` }], isError: true };
    }
  }
);

// REQ-EVO-014: Governance HTTP Server (for n8n integration)
// ============================================

// Constant-time key comparison — a naive `!==` string compare leaks timing information
// that becomes a practical network-observable side channel now that this server is
// LAN-reachable (0.0.0.0 bind). timingSafeEqual requires equal-length buffers, so a
// length mismatch is checked first (this leaks length, not content, which is standard
// practice for this primitive) and hashed to a fixed size to avoid any length signal.
function isValidGovernanceKey(provided: string | string[] | undefined): boolean {
  if (typeof provided !== "string" || !GOVERNANCE_API_KEY) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(GOVERNANCE_API_KEY).digest();
  return timingSafeEqual(a, b);
}

function startGovernanceHttpServer(): void {
  if (!GOVERNANCE_API_KEY) {
    console.error(
      "Governance HTTP server NOT started: GOVERNANCE_API_KEY is not set. " +
      "This server binds to 0.0.0.0 (LAN-reachable) and requires its own dedicated key " +
      "— it no longer falls back to QDRANT_API_KEY. Set GOVERNANCE_API_KEY to enable it."
    );
    return;
  }
  const httpServer = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");

    if (!isValidGovernanceKey(req.headers["x-api-key"])) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    if (req.method === "GET" && req.url === "/governance/health") {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, proof_engine: !!proofEngine }));
      return;
    }

    if (req.method === "POST" && req.url === "/tools/call") {
      let body = "";
      req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      req.on("end", async () => {
        try {
          const params = body ? JSON.parse(body) : {};
          const toolHandler = httpExposedTools.get(params.tool);
          if (!toolHandler) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: `Unsupported tool: ${params.tool}` }));
            return;
          }
          const result = await toolHandler(params.args || {});
          res.writeHead(200);
          res.end(JSON.stringify(result));
        } catch (err) {
          if (err instanceof z.ZodError) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: `Invalid args for ${JSON.parse(body || "{}").tool}: ${err.message}` }));
            return;
          }
          res.writeHead(500);
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }));
        }
      });
      return;
    }

    if (req.method === "POST" && req.url === "/governance/report") {
      let body = "";
      req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      req.on("end", async () => {
        try {
          const params = body ? JSON.parse(body) : {};
          const periodDays = params.period_days || 30;
          const now = new Date();
          const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

          const deps = {
            scrollAuditLog: async (filter?: Record<string, unknown>, limit?: number, offset?: string | number) => {
              const points = await scrollPoints(COLLECTIONS.AUDIT_LOG, filter, limit || 10000, offset);
              return points.map((p: any) => ({
                id: p.id,
                action: p.payload?.action || "",
                timestamp: p.payload?.timestamp || "",
                session_id: p.payload?.session_id || "",
                project: p.payload?.project || "",
                sensitivity: p.payload?.sensitivity || "",
                details: p.payload?.details || {},
              })) as AuditEvent[];
            },
          };

          const report = await generateComplianceReport(
            { period_start: periodStart.toISOString(), period_end: now.toISOString(), controls: params.control_ids },
            deps
          );

          res.writeHead(200);
          res.end(JSON.stringify(report, null, 2));
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  });

  httpServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Governance HTTP port ${GOVERNANCE_HTTP_PORT} in use, skipping HTTP server`);
    } else {
      console.error(`Governance HTTP server error: ${err.message}`);
    }
  });

  httpServer.listen(GOVERNANCE_HTTP_PORT, "0.0.0.0", () => {
    console.error(`Governance HTTP server listening on 0.0.0.0:${GOVERNANCE_HTTP_PORT}`);
  });
}

// ─── GraphRAG Tools (PRD System Enhancement Suite) ───

server.tool(
  "graph_store",
  "Store a node in the Memgraph knowledge graph with optional edges. Nodes get valid_from/valid_to for temporal queries.",
  z.object({
    node_type: z.string().describe("Node label/type (e.g., Agent, Project, PRD)"),
    node_id: z.string().describe("Unique node identifier"),
    properties: z.record(z.string(), z.unknown()).optional().describe("Node properties"),
    edges: z.array(z.object({
      target_id: z.string(),
      relationship: z.string(),
      properties: z.record(z.string(), z.unknown()).optional(),
    })).optional().describe("Outgoing edges to create"),
  }).shape,
  async (args) => {
    try {
      const result = await graphStore(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `graph_store error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  }
);

server.tool(
  "graph_query",
  "Run a Cypher query against the Memgraph knowledge graph. Use for complex multi-hop queries.",
  z.object({
    query: z.string().describe("Cypher query string"),
    parameters: z.record(z.string(), z.unknown()).optional().describe("Query parameters"),
  }).shape,
  async (args) => {
    try {
      const result = await graphQuery(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `graph_query error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  }
);

server.tool(
  "graph_traverse",
  "BFS/DFS traversal from a start node up to max_depth hops. Returns subgraph as nodes and edges.",
  z.object({
    start_id: z.string(),
    direction: z.enum(["outgoing", "incoming", "both"]).optional(),
    max_depth: z.number().int().min(1).max(10).optional(),
    relationship_filter: z.string().optional(),
  }).shape,
  async (args) => {
    try {
      const result = await graphTraverse(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `graph_traverse error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  }
);

server.tool(
  "graph_neighbors",
  "Get immediate neighbors (1-hop) of a node with relationship types.",
  z.object({
    node_id: z.string(),
    direction: z.enum(["outgoing", "incoming", "both"]).optional(),
    relationship_filter: z.string().optional(),
  }).shape,
  async (args) => {
    try {
      const result = await graphNeighbors(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `graph_neighbors error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  }
);

server.tool(
  "graph_path",
  "Find shortest path between two nodes in the knowledge graph.",
  z.object({
    from_id: z.string(),
    to_id: z.string(),
    max_depth: z.number().int().min(1).max(10).optional(),
  }).shape,
  async (args) => {
    try {
      const result = await graphPath(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `graph_path error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  }
);

server.tool(
  "graph_time_travel",
  "Query the knowledge graph as it existed at a specific historical timestamp.",
  z.object({
    node_id: z.string().optional(),
    query: z.string().optional(),
    as_of: z.string().describe("ISO8601 timestamp"),
  }).shape,
  async (args) => {
    try {
      const result = await graphTimeTravel(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `graph_time_travel error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  }
);

// ─── Stigmergy Tools (PRD System Enhancement Suite) ───

server.tool(
  "stigmergy_deposit",
  "Deposit a trace in the shared workspace. Agents read traces to coordinate without direct messaging.",
  z.object({
    trace_type: z.string().describe("Type of trace (e.g., 'critical_bug_found', 'review_needed')"),
    content: z.string().describe("Trace content (searchable by semantic similarity)"),
    strength: z.number().min(0).max(1).optional().describe("Initial strength (0-1, default 1.0)"),
    tags: z.array(z.string()).optional(),
    ttl_hours: z.number().int().min(1).optional().describe("Time-to-live in hours (default 24)"),
  }).shape,
  async (args) => {
    try {
      const result = await stigmergyDeposit(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `stigmergy_deposit error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  }
);

server.tool(
  "stigmergy_sense",
  "Detect relevant traces in the shared workspace via semantic search.",
  z.object({
    query: z.string().describe("Query for semantic search"),
    min_strength: z.number().min(0).max(1).optional(),
    max_age_hours: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }).shape,
  async (args) => {
    try {
      const result = await stigmergySense(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `stigmergy_sense error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  }
);

server.tool(
  "stigmergy_decay",
  "Apply decay to all traces. Reduces strength by decay_rate, removes traces below 0.1 threshold.",
  z.object({
    decay_rate: z.number().min(0).max(1).describe("Decay rate (0-1)"),
  }).shape,
  async (args) => {
    try {
      const result = await stigmergyDecay(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `stigmergy_decay error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  }
);

// Wait for Qdrant to become available (handles Docker starting after MCP server)
async function waitForQdrant(maxAttempts = 15, baseDelayMs = 2000): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await qdrantRequest("GET", "/collections");
      console.error(`Qdrant connected (attempt ${attempt}/${maxAttempts})`);
      return true;
    } catch (err) {
      const delay = Math.min(baseDelayMs * attempt, 10000);
      console.error(`Qdrant not ready (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return false;
}

// ============================================
// PRD 14 REQ-PK-005 — Process Knowledge MCP Tools
// ============================================
// Three typed tools over the `process_knowledge` Qdrant collection
// (vec_size=384, populated by scripts/ingest_process_knowledge.py).
//
// We do NOT use vector search here — the collection is at 384 dims while
// this MCP server's generateEmbedding() helper produces 768-dim Ollama
// embeddings. Re-embedding from Node would require a 384-dim model. So
// these tools use Qdrant scroll + payload filters + in-process keyword
// scoring. Semantic ranking is a future enhancement; the CURRENT
// `memory_recall` interface (with project="process_knowledge") covers
// the semantic case using its own embedding pipeline.

const PROCESS_KNOWLEDGE_COLLECTION = "process_knowledge";

// Lightweight token overlap score for in-process ranking.
function tokenOverlapScore(query: string, text: string): number {
  if (!query || !text) return 0;
  const tokenize = (s: string): Set<string> => {
    return new Set(
      s.toLowerCase()
        .replace(/[^a-z0-9 _.-]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length >= 2)
    );
  };
  const q = tokenize(query);
  const t = tokenize(text);
  if (q.size === 0 || t.size === 0) return 0;
  let intersect = 0;
  for (const tok of q) {
    if (t.has(tok)) intersect += 1;
  }
  // Jaccard-like score normalized to [0, 1].
  return intersect / Math.max(q.size, 1);
}

// Build the searchable text for a process knowledge record.
function processKnowledgeSearchText(payload: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const k of ["name", "id", "domain", "knowledge_type"]) {
    const v = payload[k];
    if (typeof v === "string") parts.push(v);
  }
  const rec = payload["record"] as Record<string, unknown> | undefined;
  if (rec && typeof rec === "object") {
    for (const k of [
      "description",
      "condition",
      "action",
      "scenario",
      "exception",
      "standard_behavior",
      "calculation",
      "source",
    ]) {
      const v = rec[k];
      if (typeof v === "string") parts.push(v);
    }
    const tags = rec["tags"];
    if (Array.isArray(tags)) parts.push(tags.filter((x) => typeof x === "string").join(" "));
    const steps = rec["steps"];
    if (Array.isArray(steps)) {
      for (const s of steps.slice(0, 5)) {
        if (s && typeof s === "object" && typeof (s as Record<string, unknown>)["action"] === "string") {
          parts.push((s as Record<string, unknown>)["action"] as string);
        }
      }
    }
  }
  return parts.join(" | ");
}

// Common scroll helper with optional payload filter.
//
// Phase 5 adversarial review fix: paginate via `next_page_offset` so
// collections that grow beyond a single 1000-point page are still fully
// queried. Earlier implementation hard-capped at 1000 with no looping —
// once the process_knowledge collection exceeds 1k entries, the
// regulatory validation tool (`process_validate`) would silently miss
// rules.
//
// Hard cap: 50,000 points (50 pages) to bound memory in pathological
// cases. The current collection has 39 points; this ceiling exists for
// the scaling path only and is well above any plausible live size.
async function scrollProcessKnowledge(
  filter: Record<string, unknown> | null,
  hardCap = 50000
): Promise<Array<Record<string, unknown>>> {
  const PAGE_SIZE = 1000;
  const all: Array<Record<string, unknown>> = [];
  let offset: unknown = undefined;
  while (all.length < hardCap) {
    const body: Record<string, unknown> = {
      limit: PAGE_SIZE,
      with_payload: true,
      with_vector: false,
    };
    if (filter) body.filter = filter;
    if (offset !== undefined) body.offset = offset;
    const resp = (await qdrantRequest(
      "POST",
      `/collections/${PROCESS_KNOWLEDGE_COLLECTION}/points/scroll`,
      body
    )) as { result: { points?: Array<Record<string, unknown>>; next_page_offset?: unknown } };
    const page = resp.result?.points || [];
    all.push(...page);
    const next = resp.result?.next_page_offset;
    if (!next || page.length === 0) break;
    offset = next;
  }
  return all;
}

// Build a Qdrant payload filter from optional domain/type/status/tags.
function buildPayloadFilter(args: {
  domain?: string;
  knowledge_type?: string;
  status?: string;
  tags?: string[];
}): Record<string, unknown> | null {
  const must: Array<Record<string, unknown>> = [];
  if (args.domain) {
    must.push({ key: "domain", match: { value: args.domain } });
  }
  if (args.knowledge_type) {
    must.push({ key: "knowledge_type", match: { value: args.knowledge_type } });
  }
  if (args.status) {
    must.push({ key: "status", match: { value: args.status } });
  }
  if (args.tags && args.tags.length > 0) {
    // Match ANY of the tags (Qdrant any-match).
    must.push({ key: "tags", match: { any: args.tags } });
  }
  return must.length > 0 ? { must } : null;
}

const ProcessQuerySchema = z.object({
  query: z.string().describe("Natural language query to match against rule names, conditions, actions, and SOPs."),
  domain: z.string().optional().describe("Restrict to a single domain (e.g. 'security.cis_controls', 'insurance.underwriting')."),
  knowledge_type: z.enum(["rule", "decision_tree", "sop", "edge_case"]).optional().describe("Restrict to one knowledge type."),
  status: z.string().default("active").describe("Filter by status (default: 'active')."),
  tags: z.array(z.string()).optional().describe("Match any of these tags."),
  limit: z.number().default(10).describe("Maximum number of results to return."),
});

const ProcessLookupSchema = z.object({
  id: z.string().optional().describe("Knowledge entry ID (e.g. 'SEC-CIS-001'). Domain required if multiple matches possible."),
  domain: z.string().optional().describe("Domain (required if id alone is ambiguous)."),
  point_id: z.string().optional().describe("Direct Qdrant point UUID — bypasses the id+domain lookup."),
});

const ProcessValidateSchema = z.object({
  proposed_action: z.string().describe("Description of the action being validated. Should mention domain entities, e.g. 'deploy container running as root user'."),
  domain: z.string().optional().describe("Restrict applicable rules to a single domain."),
  knowledge_type: z.enum(["rule", "decision_tree", "sop", "edge_case"]).optional().describe("Restrict to one knowledge type (default: rule + edge_case)."),
});

server.tool(
  "process_query",
  "Search the process knowledge base for rules, decision trees, SOPs, or edge cases that match a natural language query, optionally filtered by domain, knowledge_type, status, and tags. Returns top matches with provenance.",
  ProcessQuerySchema.shape,
  async (args) => {
    try {
      const filter = buildPayloadFilter(args);
      const points = await scrollProcessKnowledge(filter);
      const ranked = points
        .map((p) => {
          const payload = (p["payload"] as Record<string, unknown>) || {};
          const text = processKnowledgeSearchText(payload);
          return { p, payload, score: tokenOverlapScore(args.query, text), text };
        })
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, args.limit);
      const results = ranked.map(({ p, payload, score }) => ({
        score: Math.round(score * 1000) / 1000,
        id: payload["id"],
        knowledge_type: payload["knowledge_type"],
        domain: payload["domain"],
        name: payload["name"],
        status: payload["status"],
        tags: payload["tags"] || [],
        source_file: payload["source_file"],
        record: payload["record"],
        point_id: p["id"],
      }));
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                query: args.query,
                domain_filter: args.domain || null,
                type_filter: args.knowledge_type || null,
                tags_filter: args.tags || null,
                total_scanned: points.length,
                results,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      const m = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `process_query error: ${m}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "process_lookup",
  "Exact retrieval of a single process knowledge entry by ID (e.g. 'SEC-CIS-001') or by Qdrant point UUID. Returns the full record with provenance and version history.",
  ProcessLookupSchema.shape,
  async (args) => {
    try {
      if (!args.id && !args.point_id) {
        return {
          content: [
            {
              type: "text" as const,
              text: "process_lookup requires either `id` (with optional `domain`) or `point_id`.",
            },
          ],
          isError: true,
        };
      }
      // Direct point UUID path
      if (args.point_id) {
        const pt = (await qdrantRequest(
          "GET",
          `/collections/${PROCESS_KNOWLEDGE_COLLECTION}/points/${args.point_id}`
        )) as { result: Record<string, unknown> | null };
        if (!pt.result) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ found: false, point_id: args.point_id }, null, 2),
              },
            ],
          };
        }
        const payload = (pt.result["payload"] as Record<string, unknown>) || {};
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  found: true,
                  id: payload["id"],
                  point_id: pt.result["id"],
                  record: {
                    id: payload["id"],
                    knowledge_type: payload["knowledge_type"],
                    domain: payload["domain"],
                    name: payload["name"],
                    source_file: payload["source_file"],
                    status: payload["status"],
                    tags: payload["tags"] || [],
                    version: payload["version"],
                    record: payload["record"],
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      }
      // ID + optional domain path
      const filter: Record<string, unknown> = {
        must: [
          { key: "id", match: { value: args.id } },
          ...(args.domain ? [{ key: "domain", match: { value: args.domain } }] : []),
        ],
      };
      const points = await scrollProcessKnowledge(filter);
      if (points.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ found: false, id: args.id, domain: args.domain || null }, null, 2),
            },
          ],
        };
      }
      if (points.length > 1 && !args.domain) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  found: false,
                  id: args.id,
                  ambiguous: true,
                  matches: points.map((p) => {
                    const pl = (p["payload"] as Record<string, unknown>) || {};
                    return { domain: pl["domain"], knowledge_type: pl["knowledge_type"] };
                  }),
                  hint: "Pass `domain` to disambiguate.",
                },
                null,
                2
              ),
            },
          ],
        };
      }
      const point = points[0];
      const payload = (point["payload"] as Record<string, unknown>) || {};
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                found: true,
                id: payload["id"],
                point_id: point["id"],
                record: {
                  id: payload["id"],
                  knowledge_type: payload["knowledge_type"],
                  domain: payload["domain"],
                  name: payload["name"],
                  source_file: payload["source_file"],
                  status: payload["status"],
                  tags: payload["tags"] || [],
                  version: payload["version"],
                  record: payload["record"],
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      const m = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `process_lookup error: ${m}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "process_validate",
  "Validate a proposed action against applicable rules and edge cases. Returns matching rules whose conditions look applicable to the action, with their actions/exceptions. The agent applies the cited rules to its decision.",
  ProcessValidateSchema.shape,
  async (args) => {
    try {
      const must: Array<Record<string, unknown>> = [{ key: "status", match: { value: "active" } }];
      if (args.domain) {
        must.push({ key: "domain", match: { value: args.domain } });
      }
      if (args.knowledge_type) {
        must.push({ key: "knowledge_type", match: { value: args.knowledge_type } });
      } else {
        // Default to rule + edge_case (the two types that prescribe outcomes).
        // Qdrant has no inline OR on a single key — emulate with `should`.
        // We perform two scrolls and merge.
      }
      const points: Array<Record<string, unknown>> = [];
      if (args.knowledge_type) {
        points.push(...(await scrollProcessKnowledge({ must })));
      } else {
        for (const kt of ["rule", "edge_case"]) {
          const f = {
            must: [...must, { key: "knowledge_type", match: { value: kt } }],
          };
          points.push(...(await scrollProcessKnowledge(f)));
        }
      }
      // Score each by token overlap between proposed_action and the rule's
      // condition + action fields (for rules) or scenario + exception fields
      // (for edge_cases).
      const ranked = points
        .map((p) => {
          const payload = (p["payload"] as Record<string, unknown>) || {};
          const rec = (payload["record"] as Record<string, unknown>) || {};
          const text =
            (typeof rec["condition"] === "string" ? rec["condition"] + " " : "") +
            (typeof rec["scenario"] === "string" ? rec["scenario"] + " " : "") +
            (typeof rec["action"] === "string" ? rec["action"] + " " : "") +
            (typeof rec["exception"] === "string" ? rec["exception"] + " " : "") +
            (typeof payload["name"] === "string" ? payload["name"] + " " : "") +
            (Array.isArray(payload["tags"]) ? (payload["tags"] as string[]).join(" ") : "");
          return { p, payload, rec, score: tokenOverlapScore(args.proposed_action, text) };
        })
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score);
      const findings = ranked.slice(0, 25).map(({ p, payload, rec, score }) => ({
        relevance: Math.round(score * 1000) / 1000,
        id: payload["id"],
        knowledge_type: payload["knowledge_type"],
        domain: payload["domain"],
        name: payload["name"],
        condition: rec["condition"] || rec["scenario"] || null,
        action: rec["action"] || rec["exception"] || null,
        priority: rec["priority"] !== undefined ? rec["priority"] : null,
        source: rec["source"] || payload["source_file"] || null,
        point_id: p["id"],
      }));
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                proposed_action: args.proposed_action,
                domain_filter: args.domain || null,
                type_filter: args.knowledge_type || "rule + edge_case",
                total_active_scanned: points.length,
                applicable_count: findings.length,
                findings,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      const m = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `process_validate error: ${m}` }],
        isError: true,
      };
    }
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();

  const qdrantReady = await waitForQdrant();
  if (!qdrantReady) {
    console.error("WARNING: Qdrant unavailable after retries. Starting in degraded mode — memory tools will fail until Qdrant is reachable.");
  }

  if (qdrantReady) {
    try {
      await ensureCollection(COLLECTIONS.AUDIT_LOG);
    } catch (err) {
      console.error("Failed to ensure audit_log collection (non-fatal):", err instanceof Error ? err.message : err);
    }
  }

  // REQ-EVO-013: Initialize proof engine (non-fatal if keys not present)
  try {
    proofEngine = await initGuardrailProofs({
      dbPath: process.env.PROOF_DB_PATH || join(__dirname, "..", "data", "guardrail-proofs.db"),
      privateKeyPath: process.env.ED25519_PRIVATE_KEY_PATH || join(__dirname, "..", "keys", "ed25519-private.pem"),
      publicKeyPath: process.env.ED25519_PUBLIC_KEY_PATH || join(__dirname, "..", "keys", "ed25519-public.pem"),
      policyVersion: "1.0.0",
      rekorUrl: process.env.REKOR_URL || "https://rekor.sigstore.dev",
    });
    console.error("REQ-EVO-013: Proof-of-Guardrail engine initialized");

    // Hourly Merkle batch + Rekor publication
    setInterval(() => {
      proofEngine?.batchAndPublish().catch((err) =>
        console.error("Merkle batch error:", err)
      );
    }, 60 * 60 * 1000);
  } catch (err) {
    console.error("REQ-EVO-013: Proof engine init skipped (run init-governance.sh):", err instanceof Error ? err.message : err);
  }

  // REQ-EVO-015/016/017: Initialize agent identity, lifecycle, and constitutional monitor
  try {
    // Ensure collections for W1-B3 modules
    await ensureCollection(IDENTITY_COLLECTIONS.AGENT_IDENTITIES);
    await ensureCollection(IDENTITY_COLLECTIONS.DELEGATION_TOKENS);
    await ensureCollection(NHI_COLLECTIONS.NHI_LIFECYCLE);
    await ensureCollection(NHI_COLLECTIONS.NHI_TRANSITIONS);
    await ensureCollection(MONITOR_COLLECTIONS.CONSTITUTIONAL_ASSESSMENTS);

    // Shared dependency bag for the new modules
    const w1b3Deps = {
      generateEmbedding,
      storePoint,
      scrollPoints,
      searchPoints,
      deletePoints,
      updatePayload,
      logAudit,
      qdrantRequest,
    };

    // REQ-EVO-015: Agent Identity Manager
    identityManager = new AgentIdentityManager(w1b3Deps);
    console.error("REQ-EVO-015: Agent Identity Manager initialized (Ed25519 + PQC-ready)");

    // REQ-EVO-016: NHI Lifecycle Manager (wraps identity manager)
    lifecycleManager = new NHILifecycleManager(identityManager, w1b3Deps);
    console.error("REQ-EVO-016: NHI Lifecycle Manager initialized");

    // Periodic dormancy check (every 15 minutes)
    setInterval(() => {
      lifecycleManager?.checkDormancy().catch((err) =>
        console.error("NHI dormancy check error:", err)
      );
    }, 15 * 60 * 1000);

    // REQ-EVO-017: Constitutional Monitor
    constitutionalMonitor = new ConstitutionalMonitor({
      generateEmbedding,
      storePoint,
      scrollPoints,
      logAudit,
      ollamaUrl: OLLAMA_URL,
      anthropicApiKey: ANTHROPIC_API_KEY,
    });
    console.error("REQ-EVO-017: Constitutional Monitor initialized");
  } catch (err) {
    console.error("W1-B3 initialization error (non-fatal):", err instanceof Error ? err.message : err);
  }

  // REQ-EVO-031: Initialize Time-Travel Debugger
  try {
    await ensureCollection(TIME_TRAVEL_COLLECTIONS.SESSION_RECORDINGS);

    timeTravelDebugger = new TimeTravelDebugger({
      storePoint,
      scrollPoints,
      generateEmbedding,
      generateUUID,
    });
    console.error("REQ-EVO-031: Time-Travel Debugger initialized");
  } catch (err) {
    console.error("REQ-EVO-031: Time-Travel Debugger init error (non-fatal):", err instanceof Error ? err.message : err);
  }

  // REQ-EVO-012: Initialize Formal Verification Pipeline
  try {
    await ensureCollection(VERIFICATION_COLLECTIONS.FORMAL_VERIFICATION);

    workflowVerifier = new WorkflowVerifier({
      logAudit,
      storePoint,
      scrollPoints,
      generateEmbedding,
      searchPoints,
    });
    console.error("REQ-EVO-012: Formal Verification Pipeline initialized");
  } catch (err) {
    console.error("REQ-EVO-012: Formal Verification init error (non-fatal):", err instanceof Error ? err.message : err);
  }

  // REQ-EVO-024: Initialize Digital Twin Manager
  try {
    await ensureCollection(TWIN_COLLECTIONS.SANDBOX_RUNS);

    digitalTwinManager = new DigitalTwinManager({
      generateEmbedding,
      storePoint,
      scrollPoints,
      searchPoints,
      deletePoints,
      logAudit,
    });
    console.error("REQ-EVO-024: Digital Twin Manager initialized");
  } catch (err) {
    console.error("REQ-EVO-024: Digital Twin Manager init error (non-fatal):", err instanceof Error ? err.message : err);
  }

  // REQ-EVO-009/035: Initialize Context Budget Manager
  try {
    contextManager = new ContextManager({ logAudit });
    console.error("REQ-EVO-009/035: Context Budget Manager initialized (200k token budget)");
  } catch (err) {
    console.error("REQ-EVO-009/035: Context Manager init error (non-fatal):", err instanceof Error ? err.message : err);
  }

  // W2-B1: Initialize Memory Enhancements (REQ-EVO-003/004/005/007)
  try {
    await ensureCollection(ENHANCEMENT_COLLECTIONS.HEURISTICS);
    await ensureCollection(ENHANCEMENT_COLLECTIONS.COLD);

    const enhancementDeps = {
      generateEmbedding,
      storePoint,
      scrollPoints,
      searchPoints,
      deletePoints,
      updatePayload,
      logAudit,
      qdrantRequest,
      generateUUID,
      getPoint,
      ollamaGenerate,
      computeTemporalScore,
    };

    contradictionDetector = new ContradictionDetector(enhancementDeps);
    provenanceManager = new ProvenanceManager(enhancementDeps);
    abstractionEngine = new AbstractionEngine(enhancementDeps);
    pruningEngine = new PruningEngine(enhancementDeps);

    console.error("W2-B1: Memory Enhancements initialized (contradiction detection, provenance, abstraction, pruning)");
  } catch (err) {
    console.error("W2-B1: Memory Enhancements init error (non-fatal):", err instanceof Error ? err.message : err);
  }

  // W2-B3: Initialize Governance Enhancements (REQ-EVO-011/018)
  try {
    await ensureCollection(INHERITANCE_COLLECTIONS.CONSTITUTIONAL_CONTRACTS);
    await ensureCollection(RED_TEAM_COLLECTIONS.RED_TEAM_CAMPAIGNS);

    const w2b3Deps = {
      generateEmbedding,
      storePoint,
      scrollPoints,
      searchPoints,
      deletePoints,
      updatePayload,
      logAudit,
      qdrantRequest,
      generateUUID,
    };

    inheritanceManager = new ConstitutionalInheritanceManager(w2b3Deps);
    console.error("REQ-EVO-011: Constitutional Inheritance Manager initialized");

    redTeamAgent = new RedTeamAgent({
      generateEmbedding,
      storePoint,
      scrollPoints,
      searchPoints,
      logAudit,
      generateUUID,
      ollamaGenerate,
      ollamaUrl: OLLAMA_URL,
    });
    console.error("REQ-EVO-018: Red Team Agent initialized");
  } catch (err) {
    console.error("W2-B3: Governance Enhancements init error (non-fatal):", err instanceof Error ? err.message : err);
  }

  // W2-B4: Initialize Multi-Agent Architecture (REQ-EVO-022/028/025/023)
  try {
    await ensureCollection(MULTI_AGENT_COLLECTIONS.TASK_SPECIALIZATION);
    await ensureCollection(MULTI_AGENT_COLLECTIONS.COST_ROUTING);
    await ensureCollection(MULTI_AGENT_COLLECTIONS.BFT_CONSENSUS);

    const w2b4Deps = {
      generateEmbedding,
      storePoint,
      scrollPoints,
      searchPoints,
      deletePoints,
      updatePayload,
      logAudit,
      generateUUID,
    };

    taskSpecEngine = new TaskSpecializationEngine(w2b4Deps);
    costRouter = new CostAwareRouter(w2b4Deps);
    parlCoordinator = new PARLCoordinator(w2b4Deps);
    bftConsensus = new BFTConsensus(w2b4Deps);

    console.error("W2-B4: Multi-Agent Architecture initialized (task specialization, cost routing, PARL coordination, BFT consensus)");
  } catch (err) {
    console.error("W2-B4: Multi-Agent Architecture init error (non-fatal):", err instanceof Error ? err.message : err);
  }

  // W2-R + W3: Initialize Advanced Memory & Governance (REQ-EVO-006/008/010/019/020/021/026/027)
  try {
    await ensureCollection(ADVANCED_COLLECTIONS.PREDICTIVE_PATTERNS);
    await ensureCollection(ADVANCED_COLLECTIONS.FEDERATION_REGISTRY);
    await ensureCollection(ADVANCED_COLLECTIONS.SELF_ASSESSMENTS);
    await ensureCollection(ADVANCED_COLLECTIONS.SOVEREIGNTY_ZONES);
    await ensureCollection(ADVANCED_COLLECTIONS.COMPLIANCE_DASHBOARD);
    await ensureCollection(ADVANCED_COLLECTIONS.PHEROMONE_TRAILS);
    await ensureCollection(ADVANCED_COLLECTIONS.A2A_AGENTS);
    await ensureCollection(ADVANCED_COLLECTIONS.WORLD_MODEL);

    const advancedDeps = {
      generateEmbedding,
      storePoint,
      scrollPoints,
      searchPoints,
      deletePoints,
      updatePayload,
      logAudit,
      qdrantRequest,
      generateUUID,
      getPoint,
      ollamaGenerate,
    };

    predictivePreloader = new PredictivePreloader(advancedDeps);
    federationManager = new FederationManager(advancedDeps);
    selfAssessment = new SelfAssessment(advancedDeps);
    dataSovereignty = new DataSovereignty(advancedDeps);
    complianceDashboard = new ComplianceDashboard(advancedDeps);
    stigmergicCoordinator = new StigmergicCoordinator(advancedDeps);
    a2aProtocolBridge = new A2AProtocolBridge(advancedDeps);
    worldModel = new WorldModel(advancedDeps);

    // Daily pheromone decay
    setInterval(() => {
      stigmergicCoordinator?.decayTrails().catch((err) =>
        console.error("Pheromone decay error:", err)
      );
    }, 24 * 60 * 60 * 1000);

    console.error("W2-R+W3: Advanced Memory & Governance initialized (predictive preloading, federation, self-assessment, sovereignty, compliance dashboard, stigmergy, A2A, world model)");
  } catch (err) {
    console.error("W2-R+W3: Advanced Memory & Governance init error (non-fatal):", err instanceof Error ? err.message : err);
  }

  // W3-DX: Initialize Developer Experience + Multi-Agent Enhancements (REQ-EVO-029/030/032/033/034/036/037/038)
  try {
    await ensureCollection(DX_COLLECTIONS.MARKETPLACE);
    await ensureCollection(DX_COLLECTIONS.SWARM_RUNS);
    await ensureCollection(DX_COLLECTIONS.CAUSAL_ANALYSIS);
    await ensureCollection(DX_COLLECTIONS.WORKFLOW_FLOWS);
    await ensureCollection(DX_COLLECTIONS.COMPILED_WORKFLOWS);
    await ensureCollection(DX_COLLECTIONS.DISCOVERED_SKILLS);
    await ensureCollection(DX_COLLECTIONS.MULTIMODAL_ARTIFACTS);
    await ensureCollection(DX_COLLECTIONS.BENCHMARK_RUNS);

    const dxDeps = {
      generateEmbedding,
      storePoint,
      scrollPoints,
      searchPoints,
      deletePoints,
      updatePayload,
      logAudit,
      generateUUID,
      ollamaGenerate,
    };

    agentMarketplace = new AgentMarketplace(dxDeps);
    microSwarm = new MicroAgentSwarm(dxDeps);
    causalDebugger = new CausalDebugger(dxDeps);
    flowDebugger = new FlowDebugger(dxDeps);
    workflowCompiler = new WorkflowCompiler(dxDeps);
    skillDiscovery = new SkillDiscovery(dxDeps);
    multiModalHandler = new MultiModalHandler(dxDeps);
    benchmarkSuite = new BenchmarkSuite(dxDeps);

    console.error("W3-DX: Developer Experience initialized (marketplace, micro-swarms, causal debugger, flow debugger, workflow compiler, skill discovery, multi-modal, benchmarking)");
  } catch (err) {
    console.error("W3-DX: Developer Experience init error (non-fatal):", err instanceof Error ? err.message : err);
  }

  // W3-Completion + W4: Initialize Frontier Capabilities (REQ-EVO-039/040/051/053/056/057)
  try {
    await ensureCollection(FRONTIER_COLLECTIONS.DEV_ENVIRONMENTS);
    await ensureCollection(FRONTIER_COLLECTIONS.SEMANTIC_DIFFS);
    await ensureCollection(FRONTIER_COLLECTIONS.CONSOLIDATION_CYCLES);
    await ensureCollection(FRONTIER_COLLECTIONS.WORKFLOW_OPTIMIZATIONS);
    await ensureCollection(FRONTIER_COLLECTIONS.TEMPORAL_PLANS);
    await ensureCollection(FRONTIER_COLLECTIONS.META_AGENT);

    const frontierDeps = {
      generateEmbedding,
      storePoint,
      scrollPoints,
      searchPoints,
      deletePoints,
      updatePayload,
      logAudit,
      qdrantRequest,
      generateUUID,
      getPoint,
      ollamaGenerate,
      computeTemporalScore,
    };

    agentDevEnv = new AgentDevEnvironment(frontierDeps);
    console.error("REQ-EVO-039: Agent Dev Environment initialized");

    semanticDiff = new SemanticDiff(frontierDeps);
    console.error("REQ-EVO-040: Semantic Diff initialized");

    hippocampalConsolidation = new HippocampalConsolidation(frontierDeps);
    console.error("REQ-EVO-051: Hippocampal Consolidation initialized");

    // Daily consolidation cycle (simulated cron)
    setInterval(() => {
      hippocampalConsolidation?.runConsolidationCycle().catch((err) =>
        console.error("Hippocampal consolidation cycle error:", err)
      );
    }, 24 * 60 * 60 * 1000);

    workflowOptimizer = new WorkflowOptimizer(frontierDeps);
    console.error("REQ-EVO-053: Workflow Optimizer initialized");

    temporalPlanner = new TemporalPlanner(frontierDeps);
    console.error("REQ-EVO-056: Temporal Planner initialized");

    metaAgent = new MetaAgent(frontierDeps);
    console.error("REQ-EVO-057: Meta-Agent initialized");

    console.error("W3+W4: Frontier Capabilities initialized (dev env, semantic diff, hippocampal consolidation, workflow optimizer, temporal planner, meta-agent)");
  } catch (err) {
    console.error("W3+W4: Frontier Capabilities init error (non-fatal):", err instanceof Error ? err.message : err);
  }

  // REQ-EVO-014: Start governance HTTP server for n8n integration
  try {
    startGovernanceHttpServer();
  } catch (err) {
    console.error("Governance HTTP server failed to start:", err instanceof Error ? err.message : err);
  }

  await server.connect(transport);
  console.error(`Claude Memory MCP Server v6.0 running [project: ${ACTIVE_PROJECT}]`);
}

// Only auto-start when executed as a script (not when imported by tests/tooling).
// Stage #9 REQ-S0-006: keep test imports side-effect-free.
const isDirectRun = (() => {
  try {
    const entry = process.argv[1] ? new URL(`file://${process.argv[1]}`).href : "";
    return import.meta.url === entry;
  } catch {
    return false;
  }
})();
if (isDirectRun) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
