/**
 * REQ-EVO-016: Non-Human Identity Lifecycle Manager
 *
 * Full lifecycle management for agent identities:
 * CREATED -> ACTIVE -> ESCALATED -> DORMANT -> TERMINATED
 *
 * Integrates with AgentIdentityManager (REQ-EVO-015) for identity creation
 * and key management. Adds state machine, dormancy detection, and
 * permission review capabilities.
 */

import crypto from "node:crypto";
import {
  AgentIdentityManager,
  type AgentIdentity,
  type IdentityDeps,
} from "./agent-identity.js";
// Stage #8 dual-write mirror (flag-gated, non-fatal)
import { mirrorNhiLifecycle, mirrorNhiTransitions } from "./postgres-mirror.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export enum NHIState {
  CREATED = "CREATED",
  ACTIVE = "ACTIVE",
  ESCALATED = "ESCALATED",
  DORMANT = "DORMANT",
  TERMINATED = "TERMINATED",
}

export interface NHITransition {
  id: string;
  agent_id: string;
  from_state: NHIState;
  to_state: NHIState;
  timestamp: string;
  reason: string;
  approved_by: string | null;
  metadata: Record<string, unknown>;
}

export interface NHIRecord {
  agent_id: string;
  name: string;
  state: NHIState;
  permissions: string[];
  base_permissions: string[];         // Original least-privilege set
  escalated_permissions: string[];    // Temporarily elevated permissions
  escalation_expires_at: string | null;
  escalation_reason: string | null;
  last_activity: string;
  created_at: string;
  terminated_at: string | null;
  termination_reason: string | null;
  transition_count: number;
  permission_usage: Record<string, string>;  // permission -> last_used timestamp
}

// Valid state transitions
const VALID_TRANSITIONS: Record<NHIState, NHIState[]> = {
  [NHIState.CREATED]: [NHIState.ACTIVE, NHIState.TERMINATED],
  [NHIState.ACTIVE]: [NHIState.ESCALATED, NHIState.DORMANT, NHIState.TERMINATED],
  [NHIState.ESCALATED]: [NHIState.ACTIVE, NHIState.TERMINATED],
  [NHIState.DORMANT]: [NHIState.ACTIVE, NHIState.TERMINATED],
  [NHIState.TERMINATED]: [],  // Terminal state
};

// Escalation limits
const MAX_ESCALATION_MINUTES = 60;
const DORMANCY_THRESHOLD_MS = 24 * 60 * 60 * 1000;  // 24 hours
const PERMISSION_UNUSED_DAYS = 30;

// Qdrant collection for NHI records and transitions
const NHI_COLLECTION = "nhi_lifecycle";
const NHI_TRANSITIONS_COLLECTION = "nhi_transitions";

// ---------------------------------------------------------------------------
// NHILifecycleManager
// ---------------------------------------------------------------------------

export class NHILifecycleManager {
  private identityManager: AgentIdentityManager;
  private deps: IdentityDeps;

  constructor(identityManager: AgentIdentityManager, deps: IdentityDeps) {
    this.identityManager = identityManager;
    this.deps = deps;
  }

  /**
   * Spawn a new agent with least-privilege permissions.
   * Creates identity (REQ-EVO-015) and sets state to ACTIVE.
   */
  async spawn(
    name: string,
    permissions: string[],
    reason: string = "agent spawned"
  ): Promise<{ identity: AgentIdentity; nhi_record: NHIRecord }> {
    // Create the cryptographic identity
    const identity = await this.identityManager.createIdentity(name, permissions);

    const now = new Date().toISOString();

    const nhiRecord: NHIRecord = {
      agent_id: identity.id,
      name,
      state: NHIState.ACTIVE,
      permissions,
      base_permissions: [...permissions],
      escalated_permissions: [],
      escalation_expires_at: null,
      escalation_reason: null,
      last_activity: now,
      created_at: now,
      terminated_at: null,
      termination_reason: null,
      transition_count: 1,
      permission_usage: {},
    };

    // Store NHI record
    const embedding = await this.deps.generateEmbedding(
      `NHI lifecycle ${name} state active permissions ${permissions.join(" ")}`
    );
    if (!embedding) throw new Error("Failed to generate embedding for NHI record");

    await this.deps.storePoint(NHI_COLLECTION, identity.id, embedding, nhiRecord as unknown as Record<string, unknown>);
    await mirrorNhiLifecycle(identity.id, nhiRecord as unknown as Record<string, unknown>);

    // Log initial transitions: CREATED -> ACTIVE
    await this.logTransition(identity.id, NHIState.CREATED, NHIState.ACTIVE, reason, null);

    await this.deps.logAudit("NHI_SPAWNED", {
      agent_id: identity.id,
      name,
      permissions,
      state: NHIState.ACTIVE,
    });

    return { identity, nhi_record: nhiRecord };
  }

  /**
   * Escalate an agent's permissions temporarily.
   * ACTIVE -> ESCALATED (max 60 minutes).
   */
  async escalate(
    agentId: string,
    additionalPermissions: string[],
    reason: string,
    durationMinutes: number = 30,
    approvedBy: string = "system"
  ): Promise<NHIRecord> {
    const record = await this.getNHIRecord(agentId);
    if (!record) throw new Error(`NHI record not found for agent ${agentId}`);

    this.validateTransition(record.state, NHIState.ESCALATED);

    // Cap escalation duration
    const effectiveDuration = Math.min(durationMinutes, MAX_ESCALATION_MINUTES);
    const expiresAt = new Date(Date.now() + effectiveDuration * 60 * 1000).toISOString();

    const mergedPermissions = [...new Set([...record.base_permissions, ...additionalPermissions])];

    await this.deps.updatePayload(NHI_COLLECTION, [agentId], {
      state: NHIState.ESCALATED,
      permissions: mergedPermissions,
      escalated_permissions: additionalPermissions,
      escalation_expires_at: expiresAt,
      escalation_reason: reason,
      last_activity: new Date().toISOString(),
      transition_count: record.transition_count + 1,
    });

    await this.logTransition(agentId, record.state, NHIState.ESCALATED, reason, approvedBy, {
      additional_permissions: additionalPermissions,
      duration_minutes: effectiveDuration,
      expires_at: expiresAt,
    });

    await this.deps.logAudit("NHI_ESCALATED", {
      agent_id: agentId,
      name: record.name,
      additional_permissions: additionalPermissions,
      duration_minutes: effectiveDuration,
      reason,
      approved_by: approvedBy,
    });

    return {
      ...record,
      state: NHIState.ESCALATED,
      permissions: mergedPermissions,
      escalated_permissions: additionalPermissions,
      escalation_expires_at: expiresAt,
      escalation_reason: reason,
      transition_count: record.transition_count + 1,
    };
  }

  /**
   * De-escalate: ESCALATED -> ACTIVE. Restores base permissions.
   */
  async deescalate(agentId: string, reason: string = "escalation expired"): Promise<NHIRecord> {
    const record = await this.getNHIRecord(agentId);
    if (!record) throw new Error(`NHI record not found for agent ${agentId}`);

    this.validateTransition(record.state, NHIState.ACTIVE);

    await this.deps.updatePayload(NHI_COLLECTION, [agentId], {
      state: NHIState.ACTIVE,
      permissions: record.base_permissions,
      escalated_permissions: [],
      escalation_expires_at: null,
      escalation_reason: null,
      last_activity: new Date().toISOString(),
      transition_count: record.transition_count + 1,
    });

    await this.logTransition(agentId, record.state, NHIState.ACTIVE, reason, null);

    await this.deps.logAudit("NHI_DEESCALATED", {
      agent_id: agentId,
      name: record.name,
      reason,
    });

    return {
      ...record,
      state: NHIState.ACTIVE,
      permissions: record.base_permissions,
      escalated_permissions: [],
      escalation_expires_at: null,
      escalation_reason: null,
      transition_count: record.transition_count + 1,
    };
  }

  /**
   * Check all ACTIVE identities for dormancy (>24h since last activity).
   * Also checks for expired escalations.
   */
  async checkDormancy(): Promise<{
    dormant: Array<{ agent_id: string; name: string; hours_inactive: number }>;
    deescalated: Array<{ agent_id: string; name: string; reason: string }>;
  }> {
    const now = Date.now();
    const dormantResults: Array<{ agent_id: string; name: string; hours_inactive: number }> = [];
    const deescalatedResults: Array<{ agent_id: string; name: string; reason: string }> = [];

    // Check active agents for dormancy
    const activePoints = await this.deps.scrollPoints(NHI_COLLECTION, {
      must: [{ key: "state", match: { value: NHIState.ACTIVE } }],
    }, 1000) as any[];

    // Collect all agents that need dormancy transition
    const dormantAgents: Array<{ point: any; hoursInactive: number }> = [];
    for (const point of activePoints) {
      const lastActivity = new Date(point.payload.last_activity).getTime();
      const inactiveMs = now - lastActivity;

      if (inactiveMs > DORMANCY_THRESHOLD_MS) {
        const hoursInactive = Math.floor(inactiveMs / (60 * 60 * 1000));
        dormantAgents.push({ point, hoursInactive });
      }
    }

    // Batch update all dormant agents in a single call
    if (dormantAgents.length > 0) {
      const dormantIds = dormantAgents.map(a => a.point.id as string);
      await this.deps.updatePayload(NHI_COLLECTION, dormantIds, {
        state: NHIState.DORMANT,
      });

      // Log transitions and build results (these require per-agent data)
      for (const { point, hoursInactive } of dormantAgents) {
        // Update transition_count individually since each agent has a different count
        await this.deps.updatePayload(NHI_COLLECTION, [point.id], {
          transition_count: (point.payload.transition_count || 0) + 1,
        });

        await this.logTransition(
          point.id as string,
          NHIState.ACTIVE,
          NHIState.DORMANT,
          `Auto-dormancy: ${hoursInactive}h inactive`,
          null
        );

        dormantResults.push({
          agent_id: point.id as string,
          name: point.payload.name as string,
          hours_inactive: hoursInactive,
        });
      }
    }

    // Check escalated agents for expired escalations
    const escalatedPoints = await this.deps.scrollPoints(NHI_COLLECTION, {
      must: [{ key: "state", match: { value: NHIState.ESCALATED } }],
    }, 1000) as any[];

    for (const point of escalatedPoints) {
      const expiresAt = point.payload.escalation_expires_at;
      if (expiresAt && new Date(expiresAt).getTime() < now) {
        await this.deescalate(
          point.id as string,
          "escalation expired automatically"
        );
        deescalatedResults.push({
          agent_id: point.id as string,
          name: point.payload.name as string,
          reason: "escalation expired",
        });
      }
    }

    if (dormantResults.length > 0 || deescalatedResults.length > 0) {
      await this.deps.logAudit("NHI_DORMANCY_CHECK", {
        dormant_count: dormantResults.length,
        deescalated_count: deescalatedResults.length,
        dormant_agents: dormantResults.map(d => d.agent_id),
        deescalated_agents: deescalatedResults.map(d => d.agent_id),
      });
    }

    return { dormant: dormantResults, deescalated: deescalatedResults };
  }

  /**
   * Reactivate a dormant agent: DORMANT -> ACTIVE.
   */
  async reactivate(agentId: string, reason: string = "activity detected"): Promise<NHIRecord> {
    const record = await this.getNHIRecord(agentId);
    if (!record) throw new Error(`NHI record not found for agent ${agentId}`);

    this.validateTransition(record.state, NHIState.ACTIVE);

    await this.deps.updatePayload(NHI_COLLECTION, [agentId], {
      state: NHIState.ACTIVE,
      last_activity: new Date().toISOString(),
      transition_count: record.transition_count + 1,
    });

    await this.logTransition(agentId, record.state, NHIState.ACTIVE, reason, null);

    await this.deps.logAudit("NHI_REACTIVATED", {
      agent_id: agentId,
      name: record.name,
      reason,
    });

    return {
      ...record,
      state: NHIState.ACTIVE,
      last_activity: new Date().toISOString(),
      transition_count: record.transition_count + 1,
    };
  }

  /**
   * Terminate an agent. This is a terminal state.
   */
  async terminate(agentId: string, reason: string = "session end"): Promise<void> {
    const record = await this.getNHIRecord(agentId);
    if (!record) throw new Error(`NHI record not found for agent ${agentId}`);

    if (record.state === NHIState.TERMINATED) {
      return; // Already terminated, idempotent
    }

    this.validateTransition(record.state, NHIState.TERMINATED);

    const now = new Date().toISOString();

    await this.deps.updatePayload(NHI_COLLECTION, [agentId], {
      state: NHIState.TERMINATED,
      terminated_at: now,
      termination_reason: reason,
      permissions: [],
      escalated_permissions: [],
      escalation_expires_at: null,
      transition_count: record.transition_count + 1,
    });

    // Revoke the underlying identity
    await this.identityManager.revokeIdentity(agentId, reason);

    await this.logTransition(agentId, record.state, NHIState.TERMINATED, reason, null);

    await this.deps.logAudit("NHI_TERMINATED", {
      agent_id: agentId,
      name: record.name,
      reason,
      previous_state: record.state,
    });
  }

  /**
   * Record that a permission was used by an agent (for usage tracking).
   */
  async recordPermissionUsage(agentId: string, permission: string): Promise<void> {
    const record = await this.getNHIRecord(agentId);
    if (!record) return;

    const usage = { ...record.permission_usage };
    usage[permission] = new Date().toISOString();

    await this.deps.updatePayload(NHI_COLLECTION, [agentId], {
      permission_usage: usage,
      last_activity: new Date().toISOString(),
    });
  }

  /**
   * Review permissions across all active agents. Flag unused permissions.
   */
  async reviewPermissions(): Promise<Array<{
    agent_id: string;
    name: string;
    unused_permissions: string[];
    days_unused: number;
    recommendation: string;
  }>> {
    const now = Date.now();
    const results: Array<{
      agent_id: string;
      name: string;
      unused_permissions: string[];
      days_unused: number;
      recommendation: string;
    }> = [];

    // Get all non-terminated agents
    const points = await this.deps.scrollPoints(NHI_COLLECTION, {
      must_not: [{ key: "state", match: { value: NHIState.TERMINATED } }],
    }, 1000) as any[];

    for (const point of points) {
      const permissions = (point.payload.base_permissions as string[]) || [];
      const usage = (point.payload.permission_usage as Record<string, string>) || {};
      const unusedPermissions: string[] = [];
      let maxUnusedDays = 0;

      for (const perm of permissions) {
        const lastUsed = usage[perm];
        if (!lastUsed) {
          // Never used — count from creation
          const daysSinceCreation = Math.floor(
            (now - new Date(point.payload.created_at as string).getTime()) / (24 * 60 * 60 * 1000)
          );
          if (daysSinceCreation >= PERMISSION_UNUSED_DAYS) {
            unusedPermissions.push(perm);
            maxUnusedDays = Math.max(maxUnusedDays, daysSinceCreation);
          }
        } else {
          const daysSinceUse = Math.floor(
            (now - new Date(lastUsed).getTime()) / (24 * 60 * 60 * 1000)
          );
          if (daysSinceUse >= PERMISSION_UNUSED_DAYS) {
            unusedPermissions.push(perm);
            maxUnusedDays = Math.max(maxUnusedDays, daysSinceUse);
          }
        }
      }

      if (unusedPermissions.length > 0) {
        const unusedRatio = unusedPermissions.length / permissions.length;
        let recommendation: string;
        if (unusedRatio >= 0.75) {
          recommendation = "REVIEW_URGENTLY: >75% permissions unused, consider termination or significant scope reduction";
        } else if (unusedRatio >= 0.5) {
          recommendation = "REVIEW: >50% permissions unused, consider scope reduction";
        } else {
          recommendation = "MONITOR: Some permissions unused, verify they are still needed";
        }

        results.push({
          agent_id: point.id as string,
          name: point.payload.name as string,
          unused_permissions: unusedPermissions,
          days_unused: maxUnusedDays,
          recommendation,
        });
      }
    }

    if (results.length > 0) {
      await this.deps.logAudit("NHI_PERMISSION_REVIEW", {
        agents_reviewed: points.length,
        agents_flagged: results.length,
        flagged_agents: results.map(r => ({ id: r.agent_id, unused: r.unused_permissions.length })),
      });
    }

    return results;
  }

  /**
   * Get full lifecycle transition history for an agent.
   */
  async getLifecycleHistory(agentId: string): Promise<NHITransition[]> {
    const points = await this.deps.scrollPoints(NHI_TRANSITIONS_COLLECTION, {
      must: [{ key: "agent_id", match: { value: agentId } }],
    }, 1000) as any[];

    return points
      .map((p: any) => ({
        id: p.payload.id as string,
        agent_id: p.payload.agent_id as string,
        from_state: p.payload.from_state as NHIState,
        to_state: p.payload.to_state as NHIState,
        timestamp: p.payload.timestamp as string,
        reason: p.payload.reason as string,
        approved_by: (p.payload.approved_by as string) || null,
        metadata: (p.payload.metadata as Record<string, unknown>) || {},
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  /**
   * Get full inventory of all NHI records with their states.
   */
  async getInventory(): Promise<{
    total: number;
    by_state: Record<string, number>;
    records: NHIRecord[];
  }> {
    const points = await this.deps.scrollPoints(NHI_COLLECTION, undefined, 1000) as any[];
    const records = points.map((p: any) => this.payloadToNHIRecord(p.payload, p.id as string));

    const byState: Record<string, number> = {};
    for (const r of records) {
      byState[r.state] = (byState[r.state] || 0) + 1;
    }

    return {
      total: records.length,
      by_state: byState,
      records,
    };
  }

  /**
   * Get NHI record for a specific agent.
   */
  async getNHIRecord(agentId: string): Promise<NHIRecord | null> {
    try {
      const result = await this.deps.qdrantRequest(
        "GET",
        `/collections/${NHI_COLLECTION}/points/${agentId}`
      ) as { result: { id: string; payload: Record<string, unknown> } };

      if (!result?.result?.payload) return null;
      return this.payloadToNHIRecord(result.result.payload, agentId);
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private validateTransition(fromState: NHIState, toState: NHIState): void {
    const allowed = VALID_TRANSITIONS[fromState];
    if (!allowed || !allowed.includes(toState)) {
      throw new Error(`Invalid state transition: ${fromState} -> ${toState}. Allowed from ${fromState}: [${allowed.join(", ")}]`);
    }
  }

  private async logTransition(
    agentId: string,
    fromState: NHIState,
    toState: NHIState,
    reason: string,
    approvedBy: string | null,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    const transitionId = crypto.randomUUID();
    const transition: NHITransition = {
      id: transitionId,
      agent_id: agentId,
      from_state: fromState,
      to_state: toState,
      timestamp: new Date().toISOString(),
      reason,
      approved_by: approvedBy,
      metadata,
    };

    const embedding = await this.deps.generateEmbedding(
      `NHI transition ${agentId} ${fromState} to ${toState} ${reason}`
    );
    if (embedding) {
      await this.deps.storePoint(
        NHI_TRANSITIONS_COLLECTION,
        transitionId,
        embedding,
        transition as unknown as Record<string, unknown>
      );
      await mirrorNhiTransitions(transitionId, transition as unknown as Record<string, unknown>);
    }
  }

  private payloadToNHIRecord(payload: Record<string, unknown>, agentId: string): NHIRecord {
    return {
      agent_id: agentId,
      name: (payload.name as string) || "",
      state: (payload.state as NHIState) || NHIState.CREATED,
      permissions: (payload.permissions as string[]) || [],
      base_permissions: (payload.base_permissions as string[]) || [],
      escalated_permissions: (payload.escalated_permissions as string[]) || [],
      escalation_expires_at: (payload.escalation_expires_at as string) || null,
      escalation_reason: (payload.escalation_reason as string) || null,
      last_activity: (payload.last_activity as string) || "",
      created_at: (payload.created_at as string) || "",
      terminated_at: (payload.terminated_at as string) || null,
      termination_reason: (payload.termination_reason as string) || null,
      transition_count: (payload.transition_count as number) || 0,
      permission_usage: (payload.permission_usage as Record<string, string>) || {},
    };
  }
}

// ---------------------------------------------------------------------------
// Collection constants (exported for main init)
// ---------------------------------------------------------------------------

export const NHI_COLLECTIONS = {
  NHI_LIFECYCLE: NHI_COLLECTION,
  NHI_TRANSITIONS: NHI_TRANSITIONS_COLLECTION,
} as const;
