/**
 * REQ-EVO-012: Formal Verification Pipeline
 *
 * TypeScript-native verification engine that checks conductor workflow DAGs for:
 * - Safety: no agent executes without passing quality gates
 * - Liveness: every workflow reaches completion or explicit failure
 * - Invariants: trust levels never increase through delegation,
 *   data classification never elevates
 *
 * Includes workflow-to-spec compiler, exhaustive state enumeration (BFS),
 * bounded checking for large workflows, and Ed25519-signed verification certificates.
 */

import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkflowPhase {
  id: string;
  name: string;
  agents: string[];
  gates: string[];           // Gate IDs that must pass before execution
  trust_level: number;       // 0-100, lower = less privileged
  data_classification: DataClassification;
  is_terminal: boolean;      // true for completion/failure states
  is_failure: boolean;       // true only for explicit failure states
}

export type DataClassification = "public" | "internal" | "confidential" | "restricted";

const CLASSIFICATION_RANK: Record<DataClassification, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
};

export interface WorkflowTransition {
  from: string;              // Phase ID
  to: string;                // Phase ID
  condition: string;         // Human-readable condition
  requires_gate: string | null; // Gate ID that must pass for transition
}

export interface WorkflowGate {
  id: string;
  name: string;
  type: "quality" | "approval" | "automated" | "security";
  required_for: string[];    // Phase IDs that require this gate
}

export interface WorkflowSpec {
  id: string;
  name: string;
  version: string;
  phases: WorkflowPhase[];
  transitions: WorkflowTransition[];
  gates: WorkflowGate[];
  initial_phase: string;
  metadata: Record<string, unknown>;
  compiled_at: string;
  source_hash: string;
}

export type PropertyType = "safety" | "liveness" | "invariant";

export interface VerificationProperty {
  id: string;
  name: string;
  type: PropertyType;
  description: string;
  check: (state: VerificationState, spec: WorkflowSpec) => PropertyViolation | null;
}

export interface PropertyViolation {
  property_id: string;
  property_name: string;
  property_type: PropertyType;
  message: string;
  violating_state: string;
  trace: string[];           // Path from initial state to violation
}

export interface VerificationState {
  phase_id: string;
  passed_gates: Set<string>;
  trust_level: number;
  data_classification: DataClassification;
  delegation_chain: string[];
  visited_phases: string[];
  depth: number;
}

export interface VerificationResult {
  spec_id: string;
  spec_name: string;
  spec_hash: string;
  verified: boolean;
  total_states_explored: number;
  max_depth: number;
  properties_checked: number;
  properties_passed: number;
  violations: PropertyViolation[];
  duration_ms: number;
  bounded: boolean;          // true if bounded checking was used
  bound_limit: number;
  timestamp: string;
}

export interface VerificationCertificate {
  id: string;
  result: VerificationResult;
  signature: string;         // Ed25519 signature (hex)
  public_key: string;        // Signing public key (hex)
  issued_at: string;
  expires_at: string;
  certificate_hash: string;
}

// Conductor workflow JSON structure (input format)
export interface ConductorWorkflow {
  name: string;
  version?: string;
  phases?: ConductorPhase[];
  tasks?: ConductorTask[];
  transitions?: ConductorTransitionDef[];
  gates?: ConductorGateDef[];
  metadata?: Record<string, unknown>;
}

interface ConductorPhase {
  id: string;
  name: string;
  agents?: string[];
  gates?: string[];
  trust_level?: number;
  data_classification?: string;
  is_terminal?: boolean;
  is_failure?: boolean;
}

interface ConductorTask {
  taskReferenceName: string;
  name: string;
  type?: string;
  inputParameters?: Record<string, unknown>;
}

interface ConductorTransitionDef {
  from: string;
  to: string;
  condition?: string;
  requires_gate?: string;
}

interface ConductorGateDef {
  id: string;
  name: string;
  type?: string;
  required_for?: string[];
}

// Dependencies injected from index.ts
export interface VerificationDeps {
  logAudit: (action: string, details: Record<string, unknown>) => Promise<string | null>;
  storePoint: (collection: string, id: string, vector: number[], payload: Record<string, unknown>) => Promise<void>;
  scrollPoints: (collection: string, filter?: Record<string, unknown>, limit?: number) => Promise<unknown[]>;
  generateEmbedding: (text: string) => Promise<number[] | null>;
  searchPoints: (collection: string, vector: number[], limit: number, threshold?: number, filter?: Record<string, unknown>) => Promise<unknown[]>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VERIFICATION_COLLECTION = "formal_verification";
const MAX_STATES_EXHAUSTIVE = 10000;
const DEFAULT_BOUND_LIMIT = 50;
const CERTIFICATE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---------------------------------------------------------------------------
// Default Properties
// ---------------------------------------------------------------------------

function createDefaultProperties(): VerificationProperty[] {
  return [
    {
      id: "safety-gate-ordering",
      name: "Gate Ordering Safety",
      type: "safety",
      description: "No agent executes in a phase without all required gates passing first",
      check: (state: VerificationState, spec: WorkflowSpec): PropertyViolation | null => {
        const phase = spec.phases.find((p) => p.id === state.phase_id);
        if (!phase) return null;
        for (const gateId of phase.gates) {
          if (!state.passed_gates.has(gateId)) {
            return {
              property_id: "safety-gate-ordering",
              property_name: "Gate Ordering Safety",
              property_type: "safety",
              message: `Phase '${phase.name}' (${phase.id}) entered without gate '${gateId}' passing`,
              violating_state: state.phase_id,
              trace: [...state.visited_phases],
            };
          }
        }
        return null;
      },
    },
    {
      id: "invariant-trust-monotonicity",
      name: "Trust Level Monotonicity",
      type: "invariant",
      description: "Trust levels never increase through delegation chains",
      check: (state: VerificationState, spec: WorkflowSpec): PropertyViolation | null => {
        const phase = spec.phases.find((p) => p.id === state.phase_id);
        if (!phase) return null;
        if (state.delegation_chain.length > 1 && phase.trust_level > state.trust_level) {
          return {
            property_id: "invariant-trust-monotonicity",
            property_name: "Trust Level Monotonicity",
            property_type: "invariant",
            message: `Trust level increased from ${state.trust_level} to ${phase.trust_level} through delegation in phase '${phase.name}'`,
            violating_state: state.phase_id,
            trace: [...state.visited_phases],
          };
        }
        return null;
      },
    },
    {
      id: "invariant-classification-monotonicity",
      name: "Data Classification Monotonicity",
      type: "invariant",
      description: "Data classification never elevates (e.g., confidential cannot become public)",
      check: (state: VerificationState, spec: WorkflowSpec): PropertyViolation | null => {
        const phase = spec.phases.find((p) => p.id === state.phase_id);
        if (!phase) return null;
        const currentRank = CLASSIFICATION_RANK[state.data_classification];
        const phaseRank = CLASSIFICATION_RANK[phase.data_classification];
        if (phaseRank < currentRank) {
          return {
            property_id: "invariant-classification-monotonicity",
            property_name: "Data Classification Monotonicity",
            property_type: "invariant",
            message: `Data classification downgraded from '${state.data_classification}' to '${phase.data_classification}' in phase '${phase.name}'`,
            violating_state: state.phase_id,
            trace: [...state.visited_phases],
          };
        }
        return null;
      },
    },
    {
      id: "liveness-termination",
      name: "Termination Guarantee",
      type: "liveness",
      description: "Every reachable path eventually reaches a terminal phase (completion or explicit failure)",
      // This is checked globally after BFS, not per-state
      check: (): PropertyViolation | null => null,
    },
  ];
}

// ---------------------------------------------------------------------------
// WorkflowVerifier
// ---------------------------------------------------------------------------

export class WorkflowVerifier {
  private deps: VerificationDeps;
  private signingKey: crypto.KeyObject;
  private verifyKey: crypto.KeyObject;
  private publicKeyHex: string;
  private resultCache: Map<string, VerificationCertificate>;

  constructor(deps: VerificationDeps) {
    this.deps = deps;
    const keypair = crypto.generateKeyPairSync("ed25519");
    this.signingKey = keypair.privateKey;
    this.verifyKey = keypair.publicKey;
    this.publicKeyHex = keypair.publicKey.export({ type: "spki", format: "der" }).toString("hex");
    this.resultCache = new Map();
  }

  /**
   * Compile a conductor workflow JSON into a WorkflowSpec for verification.
   */
  compileWorkflow(conductorState: ConductorWorkflow): WorkflowSpec {
    const phases: WorkflowPhase[] = [];
    const transitions: WorkflowTransition[] = [];
    const gates: WorkflowGate[] = [];

    // Parse phases from conductor format
    if (conductorState.phases && conductorState.phases.length > 0) {
      for (const cp of conductorState.phases) {
        const classification = this.parseClassification(cp.data_classification);
        phases.push({
          id: cp.id,
          name: cp.name,
          agents: cp.agents || [],
          gates: cp.gates || [],
          trust_level: cp.trust_level ?? 50,
          data_classification: classification,
          is_terminal: cp.is_terminal ?? false,
          is_failure: cp.is_failure ?? false,
        });
      }
    } else if (conductorState.tasks && conductorState.tasks.length > 0) {
      // Fallback: convert tasks to phases
      for (let i = 0; i < conductorState.tasks.length; i++) {
        const task = conductorState.tasks[i];
        phases.push({
          id: task.taskReferenceName,
          name: task.name,
          agents: [task.type || "default"],
          gates: [],
          trust_level: 50,
          data_classification: "internal",
          is_terminal: i === conductorState.tasks.length - 1,
          is_failure: false,
        });
        // Chain tasks sequentially
        if (i > 0) {
          transitions.push({
            from: conductorState.tasks[i - 1].taskReferenceName,
            to: task.taskReferenceName,
            condition: "sequential",
            requires_gate: null,
          });
        }
      }
    }

    // Parse gates
    if (conductorState.gates) {
      for (const cg of conductorState.gates) {
        gates.push({
          id: cg.id,
          name: cg.name,
          type: this.parseGateType(cg.type),
          required_for: cg.required_for || [],
        });
      }
    }

    // Parse transitions
    if (conductorState.transitions) {
      for (const ct of conductorState.transitions) {
        transitions.push({
          from: ct.from,
          to: ct.to,
          condition: ct.condition || "default",
          requires_gate: ct.requires_gate || null,
        });
      }
    }

    // Ensure at least a start and end phase for empty workflows
    if (phases.length === 0) {
      phases.push({
        id: "start",
        name: "Start",
        agents: [],
        gates: [],
        trust_level: 50,
        data_classification: "internal",
        is_terminal: false,
        is_failure: false,
      });
      phases.push({
        id: "end",
        name: "End",
        agents: [],
        gates: [],
        trust_level: 50,
        data_classification: "internal",
        is_terminal: true,
        is_failure: false,
      });
      transitions.push({
        from: "start",
        to: "end",
        condition: "default",
        requires_gate: null,
      });
    }

    const initialPhase = phases.length > 0 ? phases[0].id : "start";
    const sourceStr = JSON.stringify(conductorState);
    const sourceHash = crypto.createHash("sha256").update(sourceStr).digest("hex");

    return {
      id: crypto.randomUUID(),
      name: conductorState.name || "unnamed-workflow",
      version: conductorState.version || "1.0.0",
      phases,
      transitions,
      gates,
      initial_phase: initialPhase,
      metadata: conductorState.metadata || {},
      compiled_at: new Date().toISOString(),
      source_hash: sourceHash,
    };
  }

  /**
   * Run verification on a WorkflowSpec, checking all provided properties.
   * Uses exhaustive BFS for small state spaces, bounded checking for large ones.
   */
  verify(spec: WorkflowSpec, properties?: VerificationProperty[]): VerificationResult {
    const startTime = Date.now();
    const props = properties || createDefaultProperties();
    const violations: PropertyViolation[] = [];

    // Build adjacency map
    const adjacency = new Map<string, WorkflowTransition[]>();
    for (const phase of spec.phases) {
      adjacency.set(phase.id, []);
    }
    for (const t of spec.transitions) {
      const arr = adjacency.get(t.from);
      if (arr) arr.push(t);
    }

    // Determine bounding
    const estimatedStates = this.estimateStateSpace(spec);
    const bounded = estimatedStates > MAX_STATES_EXHAUSTIVE;
    const boundLimit = bounded ? DEFAULT_BOUND_LIMIT : MAX_STATES_EXHAUSTIVE;

    // BFS state exploration
    const initialPhase = spec.phases.find((p) => p.id === spec.initial_phase);
    if (!initialPhase) {
      return this.buildResult(spec, false, 0, 0, props.length, 0,
        [{
          property_id: "system",
          property_name: "System Check",
          property_type: "safety",
          message: `Initial phase '${spec.initial_phase}' not found in spec`,
          violating_state: spec.initial_phase,
          trace: [],
        }],
        Date.now() - startTime, bounded, boundLimit);
    }

    const initialState: VerificationState = {
      phase_id: initialPhase.id,
      passed_gates: new Set<string>(),
      trust_level: initialPhase.trust_level,
      data_classification: initialPhase.data_classification,
      delegation_chain: [],
      visited_phases: [initialPhase.id],
      depth: 0,
    };

    const queue: VerificationState[] = [initialState];
    const visited = new Set<string>();
    let totalExplored = 0;
    let maxDepth = 0;

    // Build O(1) phase lookup map to avoid repeated O(n) find() in the BFS loop
    const phaseMap = new Map<string, WorkflowPhase>();
    for (const phase of spec.phases) {
      phaseMap.set(phase.id, phase);
    }

    // Track which violations we've already seen (by property_id + violating_state)
    const violationKeys = new Set<string>();

    // Track which phases can reach a terminal for liveness checking
    const reachesTerminal = new Set<string>();
    const allReachablePhases = new Set<string>();
    // Track dead-end non-terminal phases
    const deadEndPhases = new Set<string>();

    while (queue.length > 0 && totalExplored < boundLimit) {
      const state = queue.shift()!;
      const stateKey = this.stateKey(state);
      if (visited.has(stateKey)) continue;
      visited.add(stateKey);
      totalExplored++;
      maxDepth = Math.max(maxDepth, state.depth);
      allReachablePhases.add(state.phase_id);

      const currentPhase = phaseMap.get(state.phase_id);
      if (!currentPhase) continue;

      // Check per-state properties (safety, invariant)
      for (const prop of props) {
        if (prop.type === "liveness") continue;
        const violation = prop.check(state, spec);
        if (violation) {
          const dedupKey = `${violation.property_id}::${violation.violating_state}`;
          if (!violationKeys.has(dedupKey)) {
            violationKeys.add(dedupKey);
            violations.push(violation);
          }
        }
      }

      // Mark terminal phases
      if (currentPhase.is_terminal) {
        reachesTerminal.add(state.phase_id);
        continue; // Don't explore beyond terminal
      }

      // Get outgoing transitions
      const outgoing = adjacency.get(state.phase_id) || [];
      if (outgoing.length === 0) {
        // Non-terminal with no outgoing transitions = dead end
        deadEndPhases.add(state.phase_id);
        continue;
      }

      for (const transition of outgoing) {
        const targetPhase = phaseMap.get(transition.to);
        if (!targetPhase) continue;

        // Apply gate effects
        const newGates = new Set(state.passed_gates);
        if (transition.requires_gate) {
          newGates.add(transition.requires_gate);
        }

        // Compute trust and classification for successor
        const newTrust = Math.min(state.trust_level, targetPhase.trust_level);
        const newClassRank = Math.max(
          CLASSIFICATION_RANK[state.data_classification],
          CLASSIFICATION_RANK[targetPhase.data_classification]
        );
        const newClassification = (Object.entries(CLASSIFICATION_RANK) as [DataClassification, number][])
          .find(([, rank]) => rank === newClassRank)?.[0] || state.data_classification;

        const newState: VerificationState = {
          phase_id: targetPhase.id,
          passed_gates: newGates,
          trust_level: newTrust,
          data_classification: newClassification,
          delegation_chain: [...state.delegation_chain, ...targetPhase.agents],
          visited_phases: [...state.visited_phases, targetPhase.id],
          depth: state.depth + 1,
        };

        queue.push(newState);
      }
    }

    // Liveness check: propagate reachability backwards
    // All non-terminal reachable phases must eventually reach a terminal
    // Dead-end non-terminal phases violate liveness
    for (const phaseId of deadEndPhases) {
      const phase = phaseMap.get(phaseId);
      const phaseName = phase?.name || phaseId;
      const dedupKey = `liveness-termination::${phaseId}`;
      if (violationKeys.has(dedupKey)) continue;
      violationKeys.add(dedupKey);
      violations.push({
        property_id: "liveness-termination",
        property_name: "Termination Guarantee",
        property_type: "liveness",
        message: `Phase '${phaseName}' (${phaseId}) is reachable but has no outgoing transitions and is not terminal`,
        violating_state: phaseId,
        trace: this.findPathTo(spec, adjacency, spec.initial_phase, phaseId),
      });
    }

    // Check for cycles that don't include any path to terminal
    const cycleViolation = this.checkLivenessCycles(spec, adjacency, reachesTerminal, allReachablePhases);
    if (cycleViolation) {
      violations.push(cycleViolation);
    }

    const propertiesPassed = props.length - new Set(violations.map((v) => v.property_id)).size;

    return this.buildResult(
      spec, violations.length === 0, totalExplored, maxDepth,
      props.length, propertiesPassed, violations,
      Date.now() - startTime, bounded, boundLimit
    );
  }

  /**
   * Generate an Ed25519-signed verification certificate.
   */
  generateCertificate(result: VerificationResult): VerificationCertificate {
    const id = crypto.randomUUID();
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + CERTIFICATE_TTL_MS).toISOString();

    const payload = JSON.stringify({
      id,
      result_hash: crypto.createHash("sha256").update(JSON.stringify(result)).digest("hex"),
      issued_at: issuedAt,
      expires_at: expiresAt,
      spec_id: result.spec_id,
      verified: result.verified,
    });

    const signature = crypto.sign(null, Buffer.from(payload), this.signingKey).toString("hex");
    const certificateHash = crypto.createHash("sha256").update(payload + signature).digest("hex");

    return {
      id,
      result,
      signature,
      public_key: this.publicKeyHex,
      issued_at: issuedAt,
      expires_at: expiresAt,
      certificate_hash: certificateHash,
    };
  }

  /**
   * Verify a certificate's signature is valid.
   */
  verifyCertificate(cert: VerificationCertificate): boolean {
    const payload = JSON.stringify({
      id: cert.id,
      result_hash: crypto.createHash("sha256").update(JSON.stringify(cert.result)).digest("hex"),
      issued_at: cert.issued_at,
      expires_at: cert.expires_at,
      spec_id: cert.result.spec_id,
      verified: cert.result.verified,
    });
    try {
      return crypto.verify(null, Buffer.from(payload), this.verifyKey, Buffer.from(cert.signature, "hex"));
    } catch {
      return false;
    }
  }

  /**
   * Check cache for a previously verified workflow by its source hash.
   */
  getCachedResult(workflowHash: string): VerificationCertificate | null {
    const cached = this.resultCache.get(workflowHash);
    if (!cached) return null;
    // Check expiry
    if (new Date(cached.expires_at).getTime() < Date.now()) {
      this.resultCache.delete(workflowHash);
      return null;
    }
    return cached;
  }

  /**
   * Store a certificate in cache, keyed by spec source hash.
   */
  cacheResult(specHash: string, cert: VerificationCertificate): void {
    this.resultCache.set(specHash, cert);
  }

  /**
   * Full pipeline: compile, check cache, verify, certify, store in Qdrant.
   */
  async fullVerification(
    conductorState: ConductorWorkflow,
    properties?: VerificationProperty[]
  ): Promise<{ spec: WorkflowSpec; result: VerificationResult; certificate: VerificationCertificate; cached: boolean }> {
    const spec = this.compileWorkflow(conductorState);

    // Check cache
    const cached = this.getCachedResult(spec.source_hash);
    if (cached) {
      return {
        spec,
        result: cached.result,
        certificate: cached,
        cached: true,
      };
    }

    // Verify
    const result = this.verify(spec, properties);
    const certificate = this.generateCertificate(result);

    // Cache
    this.cacheResult(spec.source_hash, certificate);

    // Store in Qdrant
    const embedding = await this.deps.generateEmbedding(
      `formal verification ${spec.name} ${result.verified ? "passed" : "failed"} ` +
      `${result.violations.length} violations ${result.total_states_explored} states`
    );
    if (embedding) {
      await this.deps.storePoint(VERIFICATION_COLLECTION, certificate.id, embedding, {
        type: "verification_certificate",
        spec_id: spec.id,
        spec_name: spec.name,
        spec_hash: spec.source_hash,
        verified: result.verified,
        violations_count: result.violations.length,
        states_explored: result.total_states_explored,
        bounded: result.bounded,
        certificate_hash: certificate.certificate_hash,
        issued_at: certificate.issued_at,
        expires_at: certificate.expires_at,
        duration_ms: result.duration_ms,
        timestamp: new Date().toISOString(),
      });
    }

    // Audit log
    await this.deps.logAudit("FORMAL_VERIFICATION", {
      spec_id: spec.id,
      spec_name: spec.name,
      verified: result.verified,
      violations_count: result.violations.length,
      states_explored: result.total_states_explored,
      certificate_id: certificate.id,
      content_preview: `Verified workflow '${spec.name}': ${result.verified ? "PASS" : "FAIL"}`,
    });

    return { spec, result, certificate, cached: false };
  }

  /**
   * List recent verification results from Qdrant.
   */
  async listVerifications(limit: number = 20): Promise<unknown[]> {
    return this.deps.scrollPoints(VERIFICATION_COLLECTION, undefined, limit);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private parseClassification(val?: string): DataClassification {
    if (!val) return "internal";
    const lower = val.toLowerCase();
    if (lower === "public" || lower === "internal" || lower === "confidential" || lower === "restricted") {
      return lower as DataClassification;
    }
    return "internal";
  }

  private parseGateType(val?: string): "quality" | "approval" | "automated" | "security" {
    if (!val) return "automated";
    const lower = val.toLowerCase();
    if (lower === "quality" || lower === "approval" || lower === "automated" || lower === "security") {
      return lower;
    }
    return "automated";
  }

  private stateKey(state: VerificationState): string {
    const gatesSorted = [...state.passed_gates].sort().join(",");
    return `${state.phase_id}|${gatesSorted}|${state.trust_level}|${state.data_classification}`;
  }

  private estimateStateSpace(spec: WorkflowSpec): number {
    const numPhases = spec.phases.length;
    const numGates = spec.gates.length;
    // Each gate can be passed or not = 2^numGates states per phase
    return numPhases * Math.pow(2, Math.min(numGates, 20));
  }

  private findPathTo(
    spec: WorkflowSpec,
    adjacency: Map<string, WorkflowTransition[]>,
    from: string,
    to: string
  ): string[] {
    // BFS to find shortest path
    const queue: { id: string; path: string[] }[] = [{ id: from, path: [from] }];
    const seen = new Set<string>();
    while (queue.length > 0) {
      const { id, path } = queue.shift()!;
      if (id === to) return path;
      if (seen.has(id)) continue;
      seen.add(id);
      const outgoing = adjacency.get(id) || [];
      for (const t of outgoing) {
        queue.push({ id: t.to, path: [...path, t.to] });
      }
    }
    return [from, "...", to];
  }

  private checkLivenessCycles(
    spec: WorkflowSpec,
    adjacency: Map<string, WorkflowTransition[]>,
    reachesTerminal: Set<string>,
    allReachable: Set<string>
  ): PropertyViolation | null {
    // Backward reachability: which phases can reach a terminal?
    const canReachTerminal = new Set<string>(reachesTerminal);
    const reverseAdj = new Map<string, string[]>();
    for (const phase of spec.phases) {
      reverseAdj.set(phase.id, []);
    }
    for (const t of spec.transitions) {
      const arr = reverseAdj.get(t.to);
      if (arr) arr.push(t.from);
    }

    // BFS backwards from terminals
    const backQueue = [...reachesTerminal];
    while (backQueue.length > 0) {
      const current = backQueue.shift()!;
      const predecessors = reverseAdj.get(current) || [];
      for (const pred of predecessors) {
        if (!canReachTerminal.has(pred)) {
          canReachTerminal.add(pred);
          backQueue.push(pred);
        }
      }
    }

    // Any reachable phase that cannot reach a terminal is stuck in a cycle
    for (const phaseId of allReachable) {
      const phase = spec.phases.find((p) => p.id === phaseId);
      if (phase?.is_terminal) continue;
      if (!canReachTerminal.has(phaseId)) {
        return {
          property_id: "liveness-termination",
          property_name: "Termination Guarantee",
          property_type: "liveness",
          message: `Phase '${phase?.name || phaseId}' (${phaseId}) is in a cycle with no path to any terminal phase`,
          violating_state: phaseId,
          trace: this.findPathTo(spec, adjacency, spec.initial_phase, phaseId),
        };
      }
    }

    return null;
  }

  private buildResult(
    spec: WorkflowSpec,
    verified: boolean,
    totalStates: number,
    maxDepth: number,
    propsChecked: number,
    propsPassed: number,
    violations: PropertyViolation[],
    durationMs: number,
    bounded: boolean,
    boundLimit: number
  ): VerificationResult {
    return {
      spec_id: spec.id,
      spec_name: spec.name,
      spec_hash: spec.source_hash,
      verified,
      total_states_explored: totalStates,
      max_depth: maxDepth,
      properties_checked: propsChecked,
      properties_passed: propsPassed,
      violations,
      duration_ms: durationMs,
      bounded,
      bound_limit: boundLimit,
      timestamp: new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Collection constants (exported for main init)
// ---------------------------------------------------------------------------

export const VERIFICATION_COLLECTIONS = {
  FORMAL_VERIFICATION: VERIFICATION_COLLECTION,
} as const;
