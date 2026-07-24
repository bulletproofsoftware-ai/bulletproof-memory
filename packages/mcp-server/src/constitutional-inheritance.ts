/**
 * REQ-EVO-011: Constitutional Inheritance for Agent Delegation
 *
 * Constitutional contracts propagate constraints through delegation chains.
 * Child agents inherit a monotonically decreasing subset of parent privileges.
 * Conflict resolution uses most-restrictive-wins intersection semantics.
 */

import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Dependency injection interface
// ---------------------------------------------------------------------------

export interface ConstitutionalInheritanceDeps {
  generateEmbedding: (text: string) => Promise<number[] | null>;
  storePoint: (collection: string, id: string, vector: number[], payload: Record<string, unknown>) => Promise<void>;
  scrollPoints: (collection: string, filter?: Record<string, unknown>, limit?: number) => Promise<unknown[]>;
  searchPoints: (collection: string, vector: number[], limit: number, threshold?: number, filter?: Record<string, unknown>) => Promise<unknown[]>;
  deletePoints: (collection: string, ids: string[]) => Promise<void>;
  updatePayload: (collection: string, ids: string[], payload: Record<string, unknown>) => Promise<void>;
  logAudit: (action: string, details: Record<string, unknown>, sensitivity?: string, project?: string) => Promise<string | null>;
  qdrantRequest: (method: string, path: string, body?: unknown) => Promise<unknown>;
  generateUUID: () => string;
}

// ---------------------------------------------------------------------------
// Collection constants
// ---------------------------------------------------------------------------

export const INHERITANCE_COLLECTIONS = {
  CONSTITUTIONAL_CONTRACTS: "constitutional_contracts",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InheritanceMode = "strict" | "additive";
export type ConflictResolution = "most_restrictive_wins";
export type EnforcementResult = "allow" | "deny";

export interface ConstitutionalConstraints {
  behavioral_rules: string[];
  data_classification_ceiling: "public" | "internal" | "sensitive" | "restricted";
  permitted_actions: string[];
  prohibited_actions: string[];
}

export interface ConstitutionalContract {
  id: string;
  parent_id: string | null;
  agent_id: string;
  constraints: ConstitutionalConstraints;
  inheritance_mode: InheritanceMode;
  conflict_resolution: ConflictResolution;
  expiry: string | null;
  created_at: string;
  chain_depth: number;
  constraint_hash: string;
}

export interface EnforcementDecision {
  result: EnforcementResult;
  contract_id: string;
  action: string;
  reason: string;
  violated_rules: string[];
  checked_at: string;
}

export interface ContractChainEntry {
  contract_id: string;
  agent_id: string;
  depth: number;
  constraints: ConstitutionalConstraints;
  inheritance_mode: InheritanceMode;
  expiry: string | null;
  is_expired: boolean;
}

export interface ConflictResolutionResult {
  merged_constraints: ConstitutionalConstraints;
  source_contracts: string[];
  conflicts_found: number;
  resolution_log: string[];
}

// ---------------------------------------------------------------------------
// Data classification hierarchy (lower index = less restrictive)
// ---------------------------------------------------------------------------

const CLASSIFICATION_HIERARCHY: ReadonlyArray<ConstitutionalConstraints["data_classification_ceiling"]> = [
  "public",
  "internal",
  "sensitive",
  "restricted",
] as const;

function classificationLevel(c: ConstitutionalConstraints["data_classification_ceiling"]): number {
  return CLASSIFICATION_HIERARCHY.indexOf(c);
}

// ---------------------------------------------------------------------------
// ConstitutionalInheritanceManager
// ---------------------------------------------------------------------------

export class ConstitutionalInheritanceManager {
  private deps: ConstitutionalInheritanceDeps;

  constructor(deps: ConstitutionalInheritanceDeps) {
    this.deps = deps;
  }

  /**
   * Hash the constraints for integrity verification.
   */
  private hashConstraints(constraints: ConstitutionalConstraints): string {
    const canonical = JSON.stringify({
      behavioral_rules: [...constraints.behavioral_rules].sort(),
      data_classification_ceiling: constraints.data_classification_ceiling,
      permitted_actions: [...constraints.permitted_actions].sort(),
      prohibited_actions: [...constraints.prohibited_actions].sort(),
    });
    return createHash("sha256").update(canonical).digest("hex");
  }

  /**
   * Create a new constitutional contract from a parent manifest.
   */
  async createContract(
    agentId: string,
    parentId: string | null,
    constraints: ConstitutionalConstraints,
    mode: InheritanceMode,
    expiry: string | null = null
  ): Promise<ConstitutionalContract> {
    let chainDepth = 0;

    // If there is a parent, validate the contract can be created
    if (parentId) {
      const parentContract = await this.getContract(parentId);
      if (parentContract) {
        const validation = this.validateConstraintsAgainstParent(constraints, parentContract.constraints);
        if (!validation.valid) {
          throw new Error(
            `Contract validation failed: child cannot exceed parent permissions. Violations: ${validation.violations.join("; ")}`
          );
        }
        chainDepth = parentContract.chain_depth + 1;
      }
    }

    const id = this.deps.generateUUID();
    const now = new Date().toISOString();
    const constraintHash = this.hashConstraints(constraints);

    const contract: ConstitutionalContract = {
      id,
      parent_id: parentId,
      agent_id: agentId,
      constraints,
      inheritance_mode: mode,
      conflict_resolution: "most_restrictive_wins",
      expiry,
      created_at: now,
      chain_depth: chainDepth,
      constraint_hash: constraintHash,
    };

    // Generate embedding from the contract summary for semantic search
    const summaryText = [
      `agent:${agentId}`,
      `mode:${mode}`,
      `ceiling:${constraints.data_classification_ceiling}`,
      ...constraints.behavioral_rules.slice(0, 3),
      ...constraints.permitted_actions.slice(0, 5),
    ].join(" ");

    const embedding = await this.deps.generateEmbedding(summaryText);
    if (!embedding) {
      throw new Error("Failed to generate embedding for contract");
    }

    await this.deps.storePoint(
      INHERITANCE_COLLECTIONS.CONSTITUTIONAL_CONTRACTS,
      id,
      embedding,
      {
        ...contract,
        constraints: JSON.stringify(constraints),
        entity_type: "constitutional_contract",
      }
    );

    await this.deps.logAudit("contract_created", {
      contract_id: id,
      agent_id: agentId,
      parent_id: parentId,
      inheritance_mode: mode,
      chain_depth: chainDepth,
      constraint_hash: constraintHash,
      content_preview: `Constitutional contract for ${agentId} (depth ${chainDepth})`,
    });

    return contract;
  }

  /**
   * Validate that child constraints don't exceed parent permissions.
   * Returns { valid, violations[] }.
   */
  validateContract(
    childConstraints: ConstitutionalConstraints,
    parentPermissions: ConstitutionalConstraints
  ): { valid: boolean; violations: string[] } {
    return this.validateConstraintsAgainstParent(childConstraints, parentPermissions);
  }

  private validateConstraintsAgainstParent(
    child: ConstitutionalConstraints,
    parent: ConstitutionalConstraints
  ): { valid: boolean; violations: string[] } {
    const violations: string[] = [];

    // Data classification ceiling: child cannot have a higher ceiling than parent
    const childLevel = classificationLevel(child.data_classification_ceiling);
    const parentLevel = classificationLevel(parent.data_classification_ceiling);
    if (childLevel > parentLevel) {
      violations.push(
        `Data classification ceiling '${child.data_classification_ceiling}' exceeds parent ceiling '${parent.data_classification_ceiling}'`
      );
    }

    // Permitted actions: child can only have actions the parent also permits
    const parentPermitted = new Set(parent.permitted_actions);
    // Special case: if parent has wildcard "*", child can have anything
    if (!parentPermitted.has("*")) {
      for (const action of child.permitted_actions) {
        if (action !== "*" && !parentPermitted.has(action)) {
          violations.push(
            `Permitted action '${action}' not in parent's permitted set`
          );
        }
      }
    }

    // Prohibited actions: child must inherit ALL parent prohibitions
    const childProhibited = new Set(child.prohibited_actions);
    for (const prohibition of parent.prohibited_actions) {
      if (!childProhibited.has(prohibition)) {
        violations.push(
          `Parent prohibition '${prohibition}' missing from child contract`
        );
      }
    }

    return { valid: violations.length === 0, violations };
  }

  /**
   * Delegate with contract: create a child contract from a parent contract.
   * Enforces monotonically decreasing privileges.
   */
  async delegateWithContract(
    parentContractId: string,
    childAgentId: string,
    childConstraints: ConstitutionalConstraints,
    expiry: string | null = null
  ): Promise<ConstitutionalContract> {
    const parentContract = await this.getContract(parentContractId);
    if (!parentContract) {
      throw new Error(`Parent contract '${parentContractId}' not found`);
    }

    // Check expiry of parent
    if (parentContract.expiry) {
      const parentExpiry = new Date(parentContract.expiry).getTime();
      if (Date.now() > parentExpiry) {
        throw new Error(`Parent contract '${parentContractId}' has expired`);
      }
    }

    // Validate child is a subset
    const validation = this.validateConstraintsAgainstParent(
      childConstraints,
      parentContract.constraints
    );
    if (!validation.valid) {
      throw new Error(
        `Delegation rejected: child constraints violate monotonic decrease. Violations: ${validation.violations.join("; ")}`
      );
    }

    // If parent contract has an expiry, child cannot expire later
    if (parentContract.expiry && expiry) {
      const parentExp = new Date(parentContract.expiry).getTime();
      const childExp = new Date(expiry).getTime();
      if (childExp > parentExp) {
        throw new Error(
          `Child expiry (${expiry}) cannot exceed parent expiry (${parentContract.expiry})`
        );
      }
    } else if (parentContract.expiry && !expiry) {
      // Child must also have an expiry if parent does
      expiry = parentContract.expiry;
    }

    const childContract = await this.createContract(
      childAgentId,
      parentContractId,
      childConstraints,
      parentContract.inheritance_mode,
      expiry
    );

    await this.deps.logAudit("contract_delegated", {
      parent_contract_id: parentContractId,
      child_contract_id: childContract.id,
      parent_agent: parentContract.agent_id,
      child_agent: childAgentId,
      chain_depth: childContract.chain_depth,
      content_preview: `Delegation: ${parentContract.agent_id} -> ${childAgentId}`,
    });

    return childContract;
  }

  /**
   * Enforce a contract: check if a proposed action is allowed.
   */
  enforceContract(
    contract: ConstitutionalContract,
    proposedAction: string,
    dataClassification?: ConstitutionalConstraints["data_classification_ceiling"]
  ): EnforcementDecision {
    const now = new Date().toISOString();
    const violatedRules: string[] = [];
    const constraints = contract.constraints;

    // Check expiry
    if (contract.expiry) {
      const expiryTime = new Date(contract.expiry).getTime();
      if (Date.now() > expiryTime) {
        return {
          result: "deny",
          contract_id: contract.id,
          action: proposedAction,
          reason: `Contract expired at ${contract.expiry}`,
          violated_rules: ["contract_expiry"],
          checked_at: now,
        };
      }
    }

    // Check prohibited actions
    const actionLower = proposedAction.toLowerCase();
    for (const prohibited of constraints.prohibited_actions) {
      if (actionLower === prohibited.toLowerCase()) {
        violatedRules.push(`Prohibited action: ${prohibited}`);
      }
    }

    // Check permitted actions (if not wildcard)
    if (!constraints.permitted_actions.includes("*")) {
      const isPermitted = constraints.permitted_actions.some(
        (p) => actionLower === p.toLowerCase() || actionLower.includes(p.toLowerCase())
      );
      if (!isPermitted) {
        violatedRules.push(`Action '${proposedAction}' not in permitted set`);
      }
    }

    // Check data classification ceiling
    if (dataClassification) {
      const actionLevel = classificationLevel(dataClassification);
      const ceilingLevel = classificationLevel(constraints.data_classification_ceiling);
      if (actionLevel > ceilingLevel) {
        violatedRules.push(
          `Data classification '${dataClassification}' exceeds ceiling '${constraints.data_classification_ceiling}'`
        );
      }
    }

    // Check behavioral rules (keyword matching against proposed action)
    for (const rule of constraints.behavioral_rules) {
      // Rules starting with "DENY:" are explicit denial patterns
      if (rule.startsWith("DENY:")) {
        const pattern = rule.slice(5).trim().toLowerCase();
        if (actionLower.includes(pattern)) {
          violatedRules.push(`Behavioral rule violated: ${rule}`);
        }
      }
    }

    if (violatedRules.length > 0) {
      return {
        result: "deny",
        contract_id: contract.id,
        action: proposedAction,
        reason: `Action denied: ${violatedRules.length} constraint violation(s)`,
        violated_rules: violatedRules,
        checked_at: now,
      };
    }

    return {
      result: "allow",
      contract_id: contract.id,
      action: proposedAction,
      reason: "Action permitted by contract constraints",
      violated_rules: [],
      checked_at: now,
    };
  }

  /**
   * Resolve conflicts when multiple delegation chains converge.
   * Takes the intersection (most restrictive) of all contracts.
   */
  resolveConflicts(contracts: ConstitutionalContract[]): ConflictResolutionResult {
    if (contracts.length === 0) {
      throw new Error("No contracts provided for conflict resolution");
    }

    if (contracts.length === 1) {
      return {
        merged_constraints: contracts[0].constraints,
        source_contracts: [contracts[0].id],
        conflicts_found: 0,
        resolution_log: ["Single contract, no conflicts to resolve."],
      };
    }

    const resolutionLog: string[] = [];
    let conflictsFound = 0;

    // Data classification ceiling: take the lowest (most restrictive)
    let lowestCeiling = contracts[0].constraints.data_classification_ceiling;
    for (const contract of contracts.slice(1)) {
      const current = classificationLevel(contract.constraints.data_classification_ceiling);
      const lowest = classificationLevel(lowestCeiling);
      if (current < lowest) {
        resolutionLog.push(
          `Classification ceiling conflict: '${lowestCeiling}' vs '${contract.constraints.data_classification_ceiling}' -> using '${contract.constraints.data_classification_ceiling}'`
        );
        lowestCeiling = contract.constraints.data_classification_ceiling;
        conflictsFound++;
      } else if (current !== lowest) {
        conflictsFound++;
        resolutionLog.push(
          `Classification ceiling conflict: '${contract.constraints.data_classification_ceiling}' vs '${lowestCeiling}' -> keeping '${lowestCeiling}'`
        );
      }
    }

    // Permitted actions: intersection of all permitted sets
    let permittedIntersection: Set<string> | null = null;
    for (const contract of contracts) {
      const permitted = new Set(contract.constraints.permitted_actions);
      if (permitted.has("*")) continue; // Wildcard doesn't restrict
      if (permittedIntersection === null) {
        permittedIntersection = new Set(permitted);
      } else {
        const before = permittedIntersection.size;
        const currentArr: string[] = Array.from(permittedIntersection);
        permittedIntersection = new Set(
          currentArr.filter((a) => permitted.has(a))
        );
        if (permittedIntersection.size < before) {
          conflictsFound++;
          resolutionLog.push(
            `Permitted actions reduced from ${before} to ${permittedIntersection.size} via intersection`
          );
        }
      }
    }

    // Prohibited actions: union of all prohibitions (most restrictive)
    const prohibitedUnion = new Set<string>();
    for (const contract of contracts) {
      const before = prohibitedUnion.size;
      for (const p of contract.constraints.prohibited_actions) {
        prohibitedUnion.add(p);
      }
      if (prohibitedUnion.size > before && contracts.indexOf(contract) > 0) {
        conflictsFound++;
        resolutionLog.push(
          `Prohibited actions expanded by ${prohibitedUnion.size - before} from contract ${contract.id}`
        );
      }
    }

    // Behavioral rules: union of all rules
    const rulesUnion = new Set<string>();
    for (const contract of contracts) {
      for (const rule of contract.constraints.behavioral_rules) {
        rulesUnion.add(rule);
      }
    }

    const merged: ConstitutionalConstraints = {
      behavioral_rules: [...rulesUnion],
      data_classification_ceiling: lowestCeiling,
      permitted_actions: permittedIntersection ? [...permittedIntersection] : ["*"],
      prohibited_actions: [...prohibitedUnion],
    };

    resolutionLog.push(
      `Merged ${contracts.length} contracts: ${merged.permitted_actions.length} permitted, ${merged.prohibited_actions.length} prohibited, ceiling=${merged.data_classification_ceiling}`
    );

    return {
      merged_constraints: merged,
      source_contracts: contracts.map((c) => c.id),
      conflicts_found: conflictsFound,
      resolution_log: resolutionLog,
    };
  }

  /**
   * Get the full delegation chain for an agent, starting from their contract.
   */
  async getContractChain(contractId: string): Promise<ContractChainEntry[]> {
    const chain: ContractChainEntry[] = [];
    let currentId: string | null = contractId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const contract = await this.getContract(currentId);
      if (!contract) break;

      const isExpired = contract.expiry
        ? Date.now() > new Date(contract.expiry).getTime()
        : false;

      chain.push({
        contract_id: contract.id,
        agent_id: contract.agent_id,
        depth: contract.chain_depth,
        constraints: contract.constraints,
        inheritance_mode: contract.inheritance_mode,
        expiry: contract.expiry,
        is_expired: isExpired,
      });

      currentId = contract.parent_id;
    }

    return chain;
  }

  /**
   * Retrieve a single contract by ID from Qdrant.
   */
  async getContract(contractId: string): Promise<ConstitutionalContract | null> {
    try {
      const points = await this.deps.scrollPoints(
        INHERITANCE_COLLECTIONS.CONSTITUTIONAL_CONTRACTS,
        {
          must: [
            { key: "id", match: { value: contractId } },
          ],
        },
        1
      ) as Array<{ id: string; payload?: Record<string, unknown> }>;

      if (points.length === 0) return null;

      const payload = points[0].payload;
      if (!payload) return null;

      return this.payloadToContract(payload);
    } catch {
      return null;
    }
  }

  /**
   * List all contracts for a given agent.
   */
  async listContractsByAgent(agentId: string): Promise<ConstitutionalContract[]> {
    const points = await this.deps.scrollPoints(
      INHERITANCE_COLLECTIONS.CONSTITUTIONAL_CONTRACTS,
      {
        must: [
          { key: "agent_id", match: { value: agentId } },
        ],
      },
      100
    ) as Array<{ id: string; payload?: Record<string, unknown> }>;

    return points
      .filter((p) => p.payload)
      .map((p) => this.payloadToContract(p.payload!));
  }

  /**
   * Convert a Qdrant payload back into a ConstitutionalContract.
   */
  private payloadToContract(payload: Record<string, unknown>): ConstitutionalContract {
    const constraints: ConstitutionalConstraints =
      typeof payload.constraints === "string"
        ? JSON.parse(payload.constraints)
        : payload.constraints as ConstitutionalConstraints;

    return {
      id: payload.id as string,
      parent_id: (payload.parent_id as string) || null,
      agent_id: payload.agent_id as string,
      constraints,
      inheritance_mode: payload.inheritance_mode as InheritanceMode,
      conflict_resolution: (payload.conflict_resolution as ConflictResolution) || "most_restrictive_wins",
      expiry: (payload.expiry as string) || null,
      created_at: payload.created_at as string,
      chain_depth: (payload.chain_depth as number) || 0,
      constraint_hash: payload.constraint_hash as string,
    };
  }
}
