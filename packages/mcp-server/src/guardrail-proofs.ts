/**
 * REQ-EVO-013: Proof-of-Guardrail Attestation
 *
 * Cryptographic proof chain for guardrail enforcement.
 * Produces Ed25519-signed attestation records with Merkle batching
 * and optional Rekor transparency log publication.
 */

import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import type { Database as DatabaseType, Statement } from "better-sqlite3";

// Statement type aliases for clarity
type ParamlessStatement<R = unknown> = Statement<[], R>;
type BindStatement<R = unknown> = Statement<unknown[], R>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OperationDescriptor {
  tool_name: string;
  args_hash: string;
  session_id: string;
  timestamp: string;
}

export interface HookExecutionLog {
  pre_hook_ran: boolean;
  post_hook_ran: boolean;
  policy_checks: string[];
  duration_ms: number;
}

export type PolicyDecision = "ALLOW" | "DENY" | "WARN";

export interface ProofRecord {
  id: string;
  operation_id: string;
  h1: string;
  h2: string;
  signature: string;
  policy_version: string;
  operation_request: string;
  hook_log: string;
  policy_decision: PolicyDecision;
  timestamp: string;
  merkle_batch_id: string | null;
  merkle_leaf_index: number | null;
  rekor_entry_uuid: string | null;
  prev_hash: string | null;
}

export interface MerkleProof {
  leaf_hash: string;
  path: Array<{ hash: string; position: "left" | "right" }>;
  root: string;
  leaf_index: number;
  batch_id: string;
}

export interface VerificationResult {
  valid: boolean;
  signature_valid: boolean;
  chain_valid: boolean;
  merkle_path_valid: boolean;
  rekor_published: boolean;
  rekor_uuid?: string;
  error?: string;
}

interface MerkleBatchRow {
  batch_id: string;
  created_at: string;
  proof_count: number;
  merkle_root: string;
  rekor_uuid: string | null;
  rekor_log_index: number | null;
  published_at: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  // Clamp to 2^20 (1M leaves) to avoid excessive iteration
  const MAX_POWER = 1 << 20;
  if (n > MAX_POWER) return MAX_POWER;
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * Build a full binary Merkle tree from leaf hashes.
 * Returns array of layers where layers[0] = leaves (padded to power-of-2),
 * layers[last] = [root].
 */
function buildMerkleTree(leafHashes: string[]): string[][] {
  if (leafHashes.length === 0) return [[]];

  const padded = [...leafHashes];
  const target = nextPowerOfTwo(padded.length);
  while (padded.length < target) {
    padded.push(padded[padded.length - 1]);
  }

  const layers: string[][] = [padded];
  let current = padded;

  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      next.push(sha256(current[i] + current[i + 1]));
    }
    layers.push(next);
    current = next;
  }

  return layers;
}

/**
 * Extract Merkle proof path for a given leaf index from pre-built layers.
 */
function extractMerklePath(
  layers: string[][],
  leafIndex: number
): Array<{ hash: string; position: "left" | "right" }> {
  const path: Array<{ hash: string; position: "left" | "right" }> = [];
  let idx = leafIndex;

  for (let layer = 0; layer < layers.length - 1; layer++) {
    const isLeft = idx % 2 === 0;
    const siblingIdx = isLeft ? idx + 1 : idx - 1;
    path.push({
      hash: layers[layer][siblingIdx],
      position: isLeft ? "right" : "left",
    });
    idx = Math.floor(idx / 2);
  }

  return path;
}

/**
 * Verify a Merkle proof path leads to the expected root.
 */
function verifyMerklePath(
  leafHash: string,
  path: Array<{ hash: string; position: "left" | "right" }>,
  root: string
): boolean {
  let current = leafHash;
  for (const step of path) {
    if (step.position === "left") {
      current = sha256(step.hash + current);
    } else {
      current = sha256(current + step.hash);
    }
  }
  return current === root;
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS guardrail_proofs (
  id                TEXT PRIMARY KEY,
  operation_id      TEXT NOT NULL,
  h1                TEXT NOT NULL,
  h2                TEXT NOT NULL,
  signature         TEXT NOT NULL,
  policy_version    TEXT NOT NULL,
  operation_request TEXT NOT NULL,
  hook_log          TEXT NOT NULL,
  policy_decision   TEXT NOT NULL CHECK(policy_decision IN ('ALLOW','DENY','WARN')),
  timestamp         TEXT NOT NULL,
  merkle_batch_id   TEXT,
  merkle_leaf_index INTEGER,
  rekor_entry_uuid  TEXT,
  prev_hash         TEXT
);

CREATE INDEX IF NOT EXISTS idx_proofs_timestamp ON guardrail_proofs(timestamp);
CREATE INDEX IF NOT EXISTS idx_proofs_batch ON guardrail_proofs(merkle_batch_id);
CREATE INDEX IF NOT EXISTS idx_proofs_operation ON guardrail_proofs(operation_id);

CREATE TABLE IF NOT EXISTS merkle_batches (
  batch_id        TEXT PRIMARY KEY,
  created_at      TEXT NOT NULL,
  proof_count     INTEGER NOT NULL,
  merkle_root     TEXT NOT NULL,
  rekor_uuid      TEXT,
  rekor_log_index INTEGER,
  published_at    TEXT
);
`;

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class GuardrailProofEngine {
  private db: DatabaseType;
  private privateKey: crypto.KeyObject;
  private publicKey: crypto.KeyObject;
  private publicKeyPem: string;
  private policyVersion: string;
  private rekorUrl: string;

  // Prepared statements — parameterless vs parameterized
  private stmtInsertProof!: BindStatement;
  private stmtGetLastH2!: ParamlessStatement<{ h2: string }>;
  private stmtGetProof!: BindStatement;
  private stmtGetUnbatched!: ParamlessStatement<ProofRecord>;
  private stmtUpdateBatch!: BindStatement;
  private stmtInsertBatch!: BindStatement;
  private stmtGetBatch!: BindStatement;
  private stmtGetBatchProofs!: BindStatement;
  private stmtUpdateBatchRekor!: BindStatement;
  private stmtCountProofs!: ParamlessStatement<{ cnt: number }>;
  private stmtCountBatches!: ParamlessStatement<{ cnt: number }>;
  private stmtCountPending!: ParamlessStatement<{ cnt: number }>;
  private stmtLastBatch!: ParamlessStatement<{ created_at: string }>;

  constructor(
    db: DatabaseType,
    privateKey: crypto.KeyObject,
    publicKey: crypto.KeyObject,
    publicKeyPem: string,
    policyVersion: string,
    rekorUrl: string
  ) {
    this.db = db;
    this.privateKey = privateKey;
    this.publicKey = publicKey;
    this.publicKeyPem = publicKeyPem;
    this.policyVersion = policyVersion;
    this.rekorUrl = rekorUrl;

    this.prepareStatements();
  }

  private prepareStatements(): void {
    this.stmtInsertProof = this.db.prepare(`
      INSERT INTO guardrail_proofs
        (id, operation_id, h1, h2, signature, policy_version,
         operation_request, hook_log, policy_decision, timestamp,
         merkle_batch_id, merkle_leaf_index, rekor_entry_uuid, prev_hash)
      VALUES
        (@id, @operation_id, @h1, @h2, @signature, @policy_version,
         @operation_request, @hook_log, @policy_decision, @timestamp,
         @merkle_batch_id, @merkle_leaf_index, @rekor_entry_uuid, @prev_hash)
    `);

    this.stmtGetLastH2 = this.db.prepare<[], { h2: string }>(
      `SELECT h2 FROM guardrail_proofs ORDER BY rowid DESC LIMIT 1`
    );

    this.stmtGetProof = this.db.prepare(
      `SELECT * FROM guardrail_proofs WHERE id = ?`
    );

    this.stmtGetUnbatched = this.db.prepare<[], ProofRecord>(
      `SELECT * FROM guardrail_proofs WHERE merkle_batch_id IS NULL ORDER BY rowid ASC`
    );

    this.stmtUpdateBatch = this.db.prepare(
      `UPDATE guardrail_proofs SET merkle_batch_id = @batch_id, merkle_leaf_index = @leaf_index WHERE id = @id`
    );

    this.stmtInsertBatch = this.db.prepare(`
      INSERT INTO merkle_batches
        (batch_id, created_at, proof_count, merkle_root, rekor_uuid, rekor_log_index, published_at)
      VALUES
        (@batch_id, @created_at, @proof_count, @merkle_root, @rekor_uuid, @rekor_log_index, @published_at)
    `);

    this.stmtGetBatch = this.db.prepare(
      `SELECT * FROM merkle_batches WHERE batch_id = ?`
    );

    this.stmtGetBatchProofs = this.db.prepare(
      `SELECT * FROM guardrail_proofs WHERE merkle_batch_id = ? ORDER BY merkle_leaf_index ASC`
    );

    this.stmtUpdateBatchRekor = this.db.prepare(
      `UPDATE merkle_batches SET rekor_uuid = @rekor_uuid, rekor_log_index = @rekor_log_index, published_at = @published_at WHERE batch_id = @batch_id`
    );

    this.stmtCountProofs = this.db.prepare<[], { cnt: number }>(
      `SELECT COUNT(*) as cnt FROM guardrail_proofs`
    );

    this.stmtCountBatches = this.db.prepare<[], { cnt: number }>(
      `SELECT COUNT(*) as cnt FROM merkle_batches`
    );

    this.stmtCountPending = this.db.prepare<[], { cnt: number }>(
      `SELECT COUNT(*) as cnt FROM guardrail_proofs WHERE merkle_batch_id IS NULL`
    );

    this.stmtLastBatch = this.db.prepare<[], { created_at: string }>(
      `SELECT created_at FROM merkle_batches ORDER BY rowid DESC LIMIT 1`
    );
  }

  // -------------------------------------------------------------------------
  // Pre-proof: compute H1 synchronously
  // -------------------------------------------------------------------------

  preProof(req: OperationDescriptor): string {
    const input = this.policyVersion + ":" + JSON.stringify(req);
    return sha256(input);
  }

  // -------------------------------------------------------------------------
  // Post-proof: compute H2, sign, chain, store synchronously
  // -------------------------------------------------------------------------

  postProof(opts: {
    h1: string;
    operation_id: string;
    hook_log: HookExecutionLog;
    policy_decision: PolicyDecision;
    req: OperationDescriptor;
  }): string {
    const ts = new Date().toISOString();
    const hookLogJson = JSON.stringify(opts.hook_log);

    // H2 = SHA256(H1 + ":" + hookLog + ":" + decision + ":" + timestamp)
    const h2Input =
      opts.h1 + ":" + hookLogJson + ":" + opts.policy_decision + ":" + ts;
    const h2 = sha256(h2Input);

    // Ed25519 signature of H2 (raw binary digest, not hex string)
    const sig = crypto.sign(null, Buffer.from(h2, "hex"), this.privateKey);
    const sigBase64 = sig.toString("base64");

    // Chain hash: SHA256 of previous proof's H2
    const lastRow = this.stmtGetLastH2.get();
    const prevHash = lastRow ? sha256(lastRow.h2) : null;

    const id = crypto.randomUUID();
    const operationRequestJson = JSON.stringify(opts.req);

    this.stmtInsertProof.run({
      id,
      operation_id: opts.operation_id,
      h1: opts.h1,
      h2,
      signature: sigBase64,
      policy_version: this.policyVersion,
      operation_request: operationRequestJson,
      hook_log: hookLogJson,
      policy_decision: opts.policy_decision,
      timestamp: ts,
      merkle_batch_id: null,
      merkle_leaf_index: null,
      rekor_entry_uuid: null,
      prev_hash: prevHash,
    });

    return id;
  }

  // -------------------------------------------------------------------------
  // Batch & Publish: collect unbatched proofs, Merkle tree, optional Rekor
  // -------------------------------------------------------------------------

  async batchAndPublish(): Promise<{
    batch_id: string;
    root: string;
    proof_count: number;
    rekor_uuid?: string;
  } | null> {
    const unbatched = this.stmtGetUnbatched.all();
    if (unbatched.length === 0) return null;

    // Build Merkle tree from H2 hashes
    const leafHashes = unbatched.map((p) => sha256(p.h2));
    const layers = buildMerkleTree(leafHashes);
    const root = layers[layers.length - 1][0];
    const batchId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Update each proof with batch assignment (transactional)
    const assignBatch = this.db.transaction(() => {
      for (let i = 0; i < unbatched.length; i++) {
        this.stmtUpdateBatch.run({
          batch_id: batchId,
          leaf_index: i,
          id: unbatched[i].id,
        });
      }

      this.stmtInsertBatch.run({
        batch_id: batchId,
        created_at: now,
        proof_count: unbatched.length,
        merkle_root: root,
        rekor_uuid: null,
        rekor_log_index: null,
        published_at: null,
      });
    });
    assignBatch();

    // Attempt Rekor publication (non-fatal)
    let rekorUuid: string | undefined;
    try {
      const result = await this.publishToRekor(root);
      if (result) {
        rekorUuid = result.uuid;
        this.stmtUpdateBatchRekor.run({
          batch_id: batchId,
          rekor_uuid: result.uuid,
          rekor_log_index: result.logIndex,
          published_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error(
        `[guardrail-proofs] Rekor publication failed for batch ${batchId}:`,
        err instanceof Error ? err.message : String(err)
      );
    }

    return {
      batch_id: batchId,
      root,
      proof_count: unbatched.length,
      rekor_uuid: rekorUuid,
    };
  }

  // -------------------------------------------------------------------------
  // Rekor publication
  // -------------------------------------------------------------------------

  private async publishToRekor(
    merkleRoot: string
  ): Promise<{ uuid: string; logIndex: number } | null> {
    // Use 'rekord' type which sends raw data + signature. Rekor computes
    // the hash itself and verifies the Ed25519 signature against the raw data.
    // This avoids the hashedrekord incompatibility with Node.js Ed25519.
    const dataBytes = Buffer.from(merkleRoot, "utf-8");
    const rootSig = crypto.sign(null, dataBytes, this.privateKey);

    // rekord v0.0.1: publicKey and data content must be base64 of the raw bytes.
    // PEM is already text, so base64-encode the PEM string directly.
    // Signature content is already base64.
    // Data content is base64 of the raw merkle root string.
    const pubKeyB64 = Buffer.from(this.publicKeyPem).toString("base64");
    const dataB64 = Buffer.from(merkleRoot).toString("base64");
    const sigB64 = rootSig.toString("base64");

    const body = {
      apiVersion: "0.0.1",
      kind: "rekord",
      spec: {
        signature: {
          format: "x509",
          content: sigB64,
          publicKey: {
            content: pubKeyB64,
          },
        },
        data: {
          content: dataB64,
        },
      },
    };

    const url = `${this.rekorUrl}/api/v1/log/entries`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Rekor responded ${response.status}: ${text.slice(0, 200)}`
      );
    }

    const data = (await response.json()) as Record<
      string,
      { logIndex: number }
    >;
    const entries = Object.entries(data);
    if (entries.length === 0) {
      throw new Error("Rekor returned empty response");
    }

    const [uuid, entry] = entries[0];
    return { uuid, logIndex: entry.logIndex };
  }

  // -------------------------------------------------------------------------
  // Verification
  // -------------------------------------------------------------------------

  async verifyProof(proofId: string): Promise<VerificationResult> {
    const proof = this.stmtGetProof.get(proofId) as ProofRecord | undefined;
    if (!proof) {
      return {
        valid: false,
        signature_valid: false,
        chain_valid: false,
        merkle_path_valid: false,
        rekor_published: false,
        error: `Proof ${proofId} not found`,
      };
    }

    // 1. Verify Ed25519 signature of H2
    let signatureValid = false;
    try {
      signatureValid = crypto.verify(
        null,
        Buffer.from(proof.h2, "hex"),
        this.publicKey,
        Buffer.from(proof.signature, "base64")
      );
    } catch {
      signatureValid = false;
    }

    // 2. Verify chain hash
    let chainValid = false;
    if (proof.prev_hash === null) {
      // First proof in chain -- verify no earlier proof exists
      const earlier = this.db
        .prepare(
          `SELECT h2 FROM guardrail_proofs WHERE rowid < (SELECT rowid FROM guardrail_proofs WHERE id = ?) ORDER BY rowid DESC LIMIT 1`
        )
        .get(proofId) as { h2: string } | undefined;
      chainValid = earlier === undefined;
    } else {
      // prev_hash should equal SHA256(previous proof's H2)
      const prevProof = this.db
        .prepare(
          `SELECT h2 FROM guardrail_proofs WHERE rowid = (SELECT rowid FROM guardrail_proofs WHERE id = ?) - 1`
        )
        .get(proofId) as { h2: string } | undefined;
      if (prevProof) {
        chainValid = proof.prev_hash === sha256(prevProof.h2);
      }
    }

    // 3. Verify Merkle path (if batched)
    let merklePathValid = false;
    if (proof.merkle_batch_id !== null) {
      const mp = this.getMerkleProof(proofId);
      if (mp) {
        merklePathValid = verifyMerklePath(mp.leaf_hash, mp.path, mp.root);
      }
    }

    // 4. Check Rekor publication status
    let rekorPublished = false;
    let rekorUuid: string | undefined;
    if (proof.merkle_batch_id) {
      const batch = this.stmtGetBatch.get(proof.merkle_batch_id) as
        | MerkleBatchRow
        | undefined;
      if (batch && batch.rekor_uuid) {
        rekorPublished = true;
        rekorUuid = batch.rekor_uuid;
      }
    }

    const valid =
      signatureValid &&
      chainValid &&
      (proof.merkle_batch_id === null || merklePathValid);

    return {
      valid,
      signature_valid: signatureValid,
      chain_valid: chainValid,
      merkle_path_valid: merklePathValid,
      rekor_published: rekorPublished,
      rekor_uuid: rekorUuid,
    };
  }

  // -------------------------------------------------------------------------
  // Merkle proof extraction
  // -------------------------------------------------------------------------

  getMerkleProof(proofId: string): MerkleProof | null {
    const proof = this.stmtGetProof.get(proofId) as ProofRecord | undefined;
    if (
      !proof ||
      proof.merkle_batch_id === null ||
      proof.merkle_leaf_index === null
    ) {
      return null;
    }

    const batch = this.stmtGetBatch.get(proof.merkle_batch_id) as
      | MerkleBatchRow
      | undefined;
    if (!batch) return null;

    // Rebuild the tree from batch proofs to extract path
    const batchProofs = this.stmtGetBatchProofs.all(
      proof.merkle_batch_id
    ) as ProofRecord[];

    const leafHashes = batchProofs.map((p) => sha256(p.h2));
    const layers = buildMerkleTree(leafHashes);
    const root = layers[layers.length - 1][0];

    // Sanity: rebuilt root must match stored root
    if (root !== batch.merkle_root) return null;

    const path = extractMerklePath(layers, proof.merkle_leaf_index);

    return {
      leaf_hash: leafHashes[proof.merkle_leaf_index],
      path,
      root,
      leaf_index: proof.merkle_leaf_index,
      batch_id: proof.merkle_batch_id,
    };
  }

  // -------------------------------------------------------------------------
  // Stats
  // -------------------------------------------------------------------------

  getStats(): {
    total_proofs: number;
    total_batches: number;
    pending_batch: number;
    last_batch_at: string | null;
  } {
    const totalProofs = this.stmtCountProofs.get()!.cnt;
    const totalBatches = this.stmtCountBatches.get()!.cnt;
    const pendingBatch = this.stmtCountPending.get()!.cnt;
    const lastBatchRow = this.stmtLastBatch.get();

    return {
      total_proofs: totalProofs,
      total_batches: totalBatches,
      pending_batch: pendingBatch,
      last_batch_at: lastBatchRow?.created_at ?? null,
    };
  }
}

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

export async function initGuardrailProofs(opts: {
  dbPath: string;
  privateKeyPath: string;
  publicKeyPath: string;
  policyVersion: string;
  rekorUrl?: string;
}): Promise<GuardrailProofEngine> {
  const db = new Database(opts.dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA_SQL);

  // Validate key paths are within the allowed keys directory
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const allowedKeysDir = resolve(join(__dirname, "..", "keys"));
  const resolvedPrivateKeyPath = resolve(opts.privateKeyPath);
  const resolvedPublicKeyPath = resolve(opts.publicKeyPath);

  if (!resolvedPrivateKeyPath.startsWith(allowedKeysDir + "/") && resolvedPrivateKeyPath !== allowedKeysDir) {
    throw new Error(`Private key path must be within ${allowedKeysDir}, got: ${resolvedPrivateKeyPath}`);
  }
  if (!resolvedPublicKeyPath.startsWith(allowedKeysDir + "/") && resolvedPublicKeyPath !== allowedKeysDir) {
    throw new Error(`Public key path must be within ${allowedKeysDir}, got: ${resolvedPublicKeyPath}`);
  }

  const privatePem = readFileSync(resolvedPrivateKeyPath, "utf-8");
  const publicPem = readFileSync(resolvedPublicKeyPath, "utf-8");

  const privateKey = crypto.createPrivateKey(privatePem);
  const publicKey = crypto.createPublicKey(publicPem);

  const rekorUrl = opts.rekorUrl ?? "https://rekor.sigstore.dev";

  return new GuardrailProofEngine(
    db,
    privateKey,
    publicKey,
    publicPem,
    opts.policyVersion,
    rekorUrl
  );
}
