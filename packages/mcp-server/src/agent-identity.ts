/**
 * REQ-EVO-015: PQC-Native Agent Identity
 *
 * Hybrid Ed25519 + PQC-ready agent identity management.
 * Generates Ed25519 keypairs now; designed for ML-DSA-65 swap when liboqs stabilizes.
 * Provides full key management, rotation, and delegation token infrastructure.
 */

import crypto from "node:crypto";
// Stage #8 dual-write mirror (flag-gated, non-fatal)
import { mirrorDelegationTokens } from "./postgres-mirror.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentIdentity {
  id: string;
  name: string;
  public_key: string;        // PEM-encoded public key
  private_key_hash: string;  // SHA-256 hash of private key (never store raw)
  algorithm: "Ed25519" | "ML-DSA-65";
  permissions: string[];
  created_at: string;
  rotated_at: string | null;
  pqc_ready: boolean;
  pqc_algorithm: string;     // Target PQC algorithm
  c_bom_entry: CBOMEntry;
  status: "active" | "deprecated" | "revoked";
  deprecated_keys: DeprecatedKey[];
}

export interface DeprecatedKey {
  public_key: string;
  deprecated_at: string;
  valid_until: string;  // Overlap period end
}

export interface CBOMEntry {
  component: string;
  algorithm_current: string;
  algorithm_target: string;
  pqc_readiness: "not_ready" | "interface_ready" | "fully_migrated";
  last_assessed: string;
}

export interface DelegationToken {
  token_id: string;
  agent_id: string;
  scope: string;
  permissions: string[];
  issued_at: string;
  expires_at: string;
  algorithm: "Ed25519" | "ML-DSA-65" | "HMAC-SHA256";
  signed_payload: string;  // Base64-encoded signature
  payload_hash: string;    // SHA-256 of the canonical payload
  revoked: boolean;
}

export interface DelegationTokenPayload {
  token_id: string;
  agent_id: string;
  scope: string;
  permissions: string[];
  issued_at: string;
  expires_at: string;
}

// Dependencies injected from index.ts
export interface IdentityDeps {
  generateEmbedding: (text: string) => Promise<number[] | null>;
  storePoint: (collection: string, id: string, vector: number[], payload: Record<string, unknown>) => Promise<void>;
  scrollPoints: (collection: string, filter?: Record<string, unknown>, limit?: number) => Promise<unknown[]>;
  searchPoints: (collection: string, vector: number[], limit: number, threshold?: number, filter?: Record<string, unknown>) => Promise<unknown[]>;
  deletePoints: (collection: string, ids: string[]) => Promise<void>;
  updatePayload: (collection: string, ids: string[], payload: Record<string, unknown>) => Promise<void>;
  logAudit: (action: string, details: Record<string, unknown>) => Promise<string | null>;
  qdrantRequest: (method: string, path: string, body?: unknown) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLLECTION = "agent_identities";
const TOKEN_COLLECTION = "delegation_tokens";
const KEY_ROTATION_DAYS = 30;
const KEY_OVERLAP_DAYS = 7;  // Old key remains valid for 7 days after rotation

// ---------------------------------------------------------------------------
// AgentIdentityManager
// ---------------------------------------------------------------------------

export class AgentIdentityManager {
  private deps: IdentityDeps;
  // In-memory cache of private keys for signing (keyed by agent_id)
  private privateKeys: Map<string, crypto.KeyObject> = new Map();

  constructor(deps: IdentityDeps) {
    this.deps = deps;
  }

  /**
   * Create a new agent identity with Ed25519 keypair.
   */
  async createIdentity(name: string, permissions: string[]): Promise<AgentIdentity> {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

    const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }) as string;
    const privateKeyDer = privateKey.export({ type: "pkcs8", format: "der" });
    const privateKeyHash = crypto.createHash("sha256").update(privateKeyDer).digest("hex");

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // Cache the private key in memory for signing
    this.privateKeys.set(id, privateKey);

    const cbomEntry: CBOMEntry = {
      component: `agent-identity:${name}`,
      algorithm_current: "Ed25519",
      algorithm_target: "ML-DSA-65",
      pqc_readiness: "interface_ready",
      last_assessed: now,
    };

    const identity: AgentIdentity = {
      id,
      name,
      public_key: publicKeyPem,
      private_key_hash: privateKeyHash,
      algorithm: "Ed25519",
      permissions,
      created_at: now,
      rotated_at: null,
      pqc_ready: false,
      pqc_algorithm: "ML-DSA-65",
      c_bom_entry: cbomEntry,
      status: "active",
      deprecated_keys: [],
    };

    // Store in Qdrant with embedding for semantic lookup
    const embedding = await this.deps.generateEmbedding(
      `agent identity ${name} permissions: ${permissions.join(", ")}`
    );
    if (!embedding) {
      throw new Error("Failed to generate embedding for agent identity");
    }

    // Store identity (public data only — private key stays in memory cache only)
    await this.deps.storePoint(COLLECTION, id, embedding, {
      ...identity,
    });

    // Cache private key in memory only — never persisted to Qdrant
    this.privateKeys.set(id, privateKey);

    await this.deps.logAudit("AGENT_IDENTITY_CREATED", {
      agent_id: id,
      name,
      algorithm: "Ed25519",
      permissions,
      pqc_ready: false,
    });

    return identity;
  }

  /**
   * Get an agent identity by ID.
   */
  async getIdentity(agentId: string): Promise<AgentIdentity | null> {
    try {
      const result = await this.deps.qdrantRequest(
        "GET",
        `/collections/${COLLECTION}/points/${agentId}`
      ) as { result: { payload: Record<string, unknown> } };

      if (!result?.result?.payload) return null;
      return this.payloadToIdentity(result.result.payload);
    } catch {
      return null;
    }
  }

  /**
   * List all agent identities, optionally filtered by status.
   */
  async listIdentities(statusFilter?: string): Promise<AgentIdentity[]> {
    const filter = statusFilter
      ? { must: [{ key: "status", match: { value: statusFilter } }] }
      : undefined;

    const points = await this.deps.scrollPoints(COLLECTION, filter, 100) as any[];
    return points.map((p: any) => this.payloadToIdentity(p.payload));
  }

  /**
   * Sign a delegation token for an agent.
   */
  async signDelegationToken(
    agentId: string,
    scope: string,
    permissions: string[],
    ttlSeconds: number = 3600
  ): Promise<DelegationToken> {
    const identity = await this.getIdentity(agentId);
    if (!identity) throw new Error(`Agent ${agentId} not found`);
    if (identity.status === "revoked") throw new Error(`Agent ${agentId} is revoked`);

    const privateKey = await this.loadPrivateKey(agentId);
    if (!privateKey) throw new Error(`No private key available for agent ${agentId}`);

    const now = new Date();
    const tokenId = crypto.randomUUID();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    const payload: DelegationTokenPayload = {
      token_id: tokenId,
      agent_id: agentId,
      scope,
      permissions,
      issued_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    const canonicalPayload = JSON.stringify(payload);
    const payloadHash = crypto.createHash("sha256").update(canonicalPayload).digest("hex");

    // Ed25519 sign the raw binary digest, not the hex string
    const signature = crypto.sign(null, Buffer.from(payloadHash, "hex"), privateKey);
    const signedPayload = signature.toString("base64");

    const token: DelegationToken = {
      token_id: tokenId,
      agent_id: agentId,
      scope,
      permissions,
      issued_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      algorithm: identity.algorithm,
      signed_payload: signedPayload,
      payload_hash: payloadHash,
      revoked: false,
    };

    // Store token for audit trail
    const embedding = await this.deps.generateEmbedding(
      `delegation token ${scope} agent ${identity.name} permissions ${permissions.join(" ")}`
    );
    if (embedding) {
      await this.deps.storePoint(TOKEN_COLLECTION, tokenId, embedding, token as unknown as Record<string, unknown>);
      await mirrorDelegationTokens(tokenId, token as unknown as Record<string, unknown>);
    }

    await this.deps.logAudit("DELEGATION_TOKEN_SIGNED", {
      token_id: tokenId,
      agent_id: agentId,
      scope,
      permissions,
      algorithm: identity.algorithm,
      expires_at: expiresAt.toISOString(),
    });

    return token;
  }

  /**
   * Verify a delegation token's signature and expiry.
   */
  async verifyDelegationToken(token: DelegationToken): Promise<{
    valid: boolean;
    expired: boolean;
    signature_valid: boolean;
    agent_active: boolean;
    error?: string;
  }> {
    const identity = await this.getIdentity(token.agent_id);
    if (!identity) {
      return { valid: false, expired: false, signature_valid: false, agent_active: false, error: "Agent not found" };
    }

    const agentActive = identity.status === "active" || identity.status === "deprecated";
    const expired = new Date(token.expires_at) < new Date();

    if (token.revoked) {
      return { valid: false, expired, signature_valid: false, agent_active: agentActive, error: "Token revoked" };
    }

    // Verify signature against current or deprecated keys
    let signatureValid = false;
    const keysToTry = [identity.public_key, ...identity.deprecated_keys.map(dk => dk.public_key)];

    for (const keyPem of keysToTry) {
      try {
        const publicKey = crypto.createPublicKey(keyPem);
        signatureValid = crypto.verify(
          null,
          Buffer.from(token.payload_hash, "hex"),
          publicKey,
          Buffer.from(token.signed_payload, "base64")
        );
        if (signatureValid) break;
      } catch {
        continue;
      }
    }

    return {
      valid: signatureValid && !expired && agentActive && !token.revoked,
      expired,
      signature_valid: signatureValid,
      agent_active: agentActive,
    };
  }

  /**
   * Rotate keys for an agent. Old key remains valid for KEY_OVERLAP_DAYS.
   */
  async rotateKeys(agentId: string): Promise<{
    new_public_key: string;
    old_key_valid_until: string;
    algorithm: string;
  }> {
    const identity = await this.getIdentity(agentId);
    if (!identity) throw new Error(`Agent ${agentId} not found`);
    if (identity.status === "revoked") throw new Error(`Agent ${agentId} is revoked`);

    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    const newPublicKeyPem = publicKey.export({ type: "spki", format: "pem" }) as string;
    const newPrivateKeyDer = privateKey.export({ type: "pkcs8", format: "der" });
    const newPrivateKeyHash = crypto.createHash("sha256").update(newPrivateKeyDer).digest("hex");

    const now = new Date();
    const overlapEnd = new Date(now.getTime() + KEY_OVERLAP_DAYS * 24 * 60 * 60 * 1000);

    // Move current key to deprecated
    const deprecatedKeys = [...identity.deprecated_keys];
    deprecatedKeys.push({
      public_key: identity.public_key,
      deprecated_at: now.toISOString(),
      valid_until: overlapEnd.toISOString(),
    });

    // Remove expired deprecated keys
    const activeDeprecated = deprecatedKeys.filter(
      dk => new Date(dk.valid_until) > now
    );

    // Update in-memory private key
    this.privateKeys.set(agentId, privateKey);

    // Update in Qdrant (public data only — private key stays in memory)
    await this.deps.updatePayload(COLLECTION, [agentId], {
      public_key: newPublicKeyPem,
      private_key_hash: newPrivateKeyHash,
      rotated_at: now.toISOString(),
      deprecated_keys: activeDeprecated,
      "c_bom_entry.last_assessed": now.toISOString(),
    });

    await this.deps.logAudit("AGENT_KEY_ROTATED", {
      agent_id: agentId,
      algorithm: identity.algorithm,
      old_key_valid_until: overlapEnd.toISOString(),
    });

    return {
      new_public_key: newPublicKeyPem,
      old_key_valid_until: overlapEnd.toISOString(),
      algorithm: identity.algorithm,
    };
  }

  /**
   * Revoke an agent identity permanently.
   */
  async revokeIdentity(agentId: string, reason: string = "manual revocation"): Promise<void> {
    const identity = await this.getIdentity(agentId);
    if (!identity) throw new Error(`Agent ${agentId} not found`);

    await this.deps.updatePayload(COLLECTION, [agentId], {
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoke_reason: reason,
    });

    // Remove cached private key
    this.privateKeys.delete(agentId);

    await this.deps.logAudit("AGENT_IDENTITY_REVOKED", {
      agent_id: agentId,
      name: identity.name,
      reason,
    });
  }

  /**
   * Check which identities need key rotation (>30 days since last rotation).
   */
  async checkRotationNeeded(): Promise<Array<{ agent_id: string; name: string; days_since_rotation: number }>> {
    const identities = await this.listIdentities("active");
    const now = Date.now();
    const results: Array<{ agent_id: string; name: string; days_since_rotation: number }> = [];

    for (const identity of identities) {
      const lastRotation = identity.rotated_at
        ? new Date(identity.rotated_at).getTime()
        : new Date(identity.created_at).getTime();
      const daysSince = Math.floor((now - lastRotation) / (24 * 60 * 60 * 1000));

      if (daysSince >= KEY_ROTATION_DAYS) {
        results.push({
          agent_id: identity.id,
          name: identity.name,
          days_since_rotation: daysSince,
        });
      }
    }

    return results;
  }

  /**
   * Get C-BOM (Cryptographic Bill of Materials) for all identities.
   */
  async getCBOM(): Promise<CBOMEntry[]> {
    const identities = await this.listIdentities();
    return identities.map(i => i.c_bom_entry);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async loadPrivateKey(agentId: string): Promise<crypto.KeyObject | null> {
    // Private keys are ONLY in memory — never persisted to Qdrant
    // After server restart, keys must be regenerated via rotateKeys()
    const cached = this.privateKeys.get(agentId);
    return cached ?? null;
  }

  private payloadToIdentity(payload: Record<string, unknown>): AgentIdentity {
    return {
      id: payload.id as string,
      name: payload.name as string,
      public_key: payload.public_key as string,
      private_key_hash: payload.private_key_hash as string,
      algorithm: (payload.algorithm as "Ed25519" | "ML-DSA-65") || "Ed25519",
      permissions: (payload.permissions as string[]) || [],
      created_at: payload.created_at as string,
      rotated_at: (payload.rotated_at as string) || null,
      pqc_ready: (payload.pqc_ready as boolean) || false,
      pqc_algorithm: (payload.pqc_algorithm as string) || "ML-DSA-65",
      c_bom_entry: (payload.c_bom_entry as CBOMEntry) || {
        component: `agent-identity:${payload.name}`,
        algorithm_current: "Ed25519",
        algorithm_target: "ML-DSA-65",
        pqc_readiness: "interface_ready",
        last_assessed: payload.created_at as string,
      },
      status: (payload.status as "active" | "deprecated" | "revoked") || "active",
      deprecated_keys: (payload.deprecated_keys as DeprecatedKey[]) || [],
    };
  }
}

// ---------------------------------------------------------------------------
// Collection constants (exported for main init)
// ---------------------------------------------------------------------------

export const IDENTITY_COLLECTIONS = {
  AGENT_IDENTITIES: COLLECTION,
  DELEGATION_TOKENS: TOKEN_COLLECTION,
} as const;
