#!/usr/bin/env npx tsx

/**
 * Backfill Classification Script
 *
 * Classifies all existing memories in Qdrant that don't have a `sensitivity` field.
 * Uses embedding similarity (nomic-embed-text) to classify into public/internal/sensitive/restricted.
 *
 * Usage:
 *   npx tsx scripts/backfill-classify.ts --dry-run                          # Preview only (default)
 *   npx tsx scripts/backfill-classify.ts --write                             # Apply classifications
 *   npx tsx scripts/backfill-classify.ts --write --overrides overrides.json  # Apply with manual overrides
 *   npx tsx scripts/backfill-classify.ts --help                              # Show usage
 */

import { randomBytes } from "node:crypto";
import { readFileSync } from "fs";
import { resolve } from "path";

// ─── Configuration ───────────────────────────────────────────────────────────

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6334";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || "";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_EMBED_MODEL = "nomic-embed-text";

const BATCH_SIZE = 25;
const BATCH_DELAY_MS = 2000;
const SCROLL_LIMIT = 100;

// randomBytes, not Math.random: this id is written into audit rows, so it wants
// to be unguessable rather than merely unlikely to collide.
const SESSION_ID = `backfill_${Date.now()}_${randomBytes(4).toString("hex")}`;

// TTL constants (in milliseconds)
const TTL = {
  SENSITIVE: 90 * 24 * 60 * 60 * 1000,  // 90 days
  RESTRICTED: 60 * 60 * 1000,            // 1 hour
};

type SensitivityLevel = "public" | "internal" | "sensitive" | "restricted";
type Classifier = "embedding" | "default";

const VALID_LEVELS: SensitivityLevel[] = ["public", "internal", "sensitive", "restricted"];

// Collections to scan (skip audit_log)
const COLLECTIONS_TO_SCAN = [
  "claude_memories",
  "short_term_memory",
  "working_memory",
  "learnings",
  "procedures",
  "trajectories",
  "episodes",
];

// ─── Qdrant HTTP Helpers ─────────────────────────────────────────────────────

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

interface QdrantPoint {
  id: string;
  payload: Record<string, unknown>;
}

interface ScrollResponse {
  result: {
    points: QdrantPoint[];
    next_page_offset: string | number | null;
  };
}

/**
 * Scroll ALL points from a collection, paginating through results.
 * Filters to only points missing the `sensitivity` field.
 */
async function scrollAllUnclassified(collection: string): Promise<QdrantPoint[]> {
  const allPoints: QdrantPoint[] = [];
  let offset: string | number | null = null;

  while (true) {
    const body: Record<string, unknown> = {
      limit: SCROLL_LIMIT,
      with_payload: true,
      with_vector: false,
    };
    if (offset !== null) {
      body.offset = offset;
    }

    let result: ScrollResponse;
    try {
      result = await qdrantRequest("POST", `/collections/${collection}/points/scroll`, body) as ScrollResponse;
    } catch (err) {
      // Collection might not exist
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("404") || msg.includes("Not found") || msg.includes("doesn't exist")) {
        log(`  Collection '${collection}' not found, skipping.`);
        return [];
      }
      throw err;
    }

    const points = result.result?.points || [];

    // Filter: only points WITHOUT a sensitivity field
    for (const point of points) {
      if (!point.payload || point.payload.sensitivity === undefined || point.payload.sensitivity === null) {
        allPoints.push(point);
      }
    }

    const nextOffset = result.result?.next_page_offset;
    if (nextOffset === null || nextOffset === undefined) {
      break;
    }
    offset = nextOffset;
  }

  return allPoints;
}

// ─── Embedding-Based Classification ─────────────────────────────────────────

// Reference descriptions for each sensitivity level. Each memory is embedded
// and compared against these via cosine similarity — nearest one wins.
const LEVEL_DESCRIPTIONS: Record<SensitivityLevel, string> = {
  public: "General programming knowledge. Open-source documentation. Publicly available technical facts. Common algorithms. Standard library usage. Well-known design patterns. Public GitHub repos. Stack Overflow answers.",
  internal: "Project architecture decisions. Workflow automation patterns. Code structure and conventions. Editor and tool configurations. Internal process documentation. Sprint planning. Technical debt notes. Deployment procedures and server setup. Docker configuration. CI/CD pipelines. Bug fixes and debugging sessions. Infrastructure provisioning. nginx reverse proxy setup. Flask and React application development.",
  sensitive: "Personal preferences and habits. Travel itineraries and flight details. Hotel and airline loyalty program status. Home airport. Employer and client names. Financial figures and budgets. Geographic location details. Job title and role. Decision rationale with identifying information. Loyalty tier status like Diamond or Platinum.",
  restricted: "Literal passwords written in plain text. Literal API key values like sk-ant-api or ghp_ or eyJ. SSH private key contents. Database connection strings with credentials. .env file contents with secrets. Bearer token values. Encryption key material. Professional certifications and credential names.",
};

// Pre-computed reference embeddings, populated at startup
let referenceEmbeddings: Map<SensitivityLevel, number[]> | null = null;

async function initReferenceEmbeddings(): Promise<void> {
  referenceEmbeddings = new Map();
  for (const level of VALID_LEVELS) {
    const embedding = await generateEmbedding(LEVEL_DESCRIPTIONS[level]);
    if (!embedding) {
      throw new Error(`Failed to generate reference embedding for "${level}" — is Ollama running with ${OLLAMA_EMBED_MODEL}?`);
    }
    referenceEmbeddings.set(level, embedding);
  }
  log(`Initialized ${referenceEmbeddings.size} reference embeddings (${OLLAMA_EMBED_MODEL})`);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

async function classifyMemory(content: string): Promise<{
  level: SensitivityLevel;
  classifier: Classifier;
}> {
  if (!referenceEmbeddings) {
    return { level: "internal", classifier: "default" };
  }

  const contentEmbedding = await generateEmbedding(content.slice(0, 1500));
  if (!contentEmbedding) {
    return { level: "internal", classifier: "default" };
  }

  let bestLevel: SensitivityLevel = "internal";
  let bestScore = -Infinity;

  for (const [level, refEmb] of referenceEmbeddings) {
    const score = cosineSimilarity(contentEmbedding, refEmb);
    if (score > bestScore) {
      bestScore = score;
      bestLevel = level;
    }
  }

  return { level: bestLevel, classifier: "embedding" };
}

// ─── TTL / Expiry Computation ────────────────────────────────────────────────

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

// ─── Embedding & Audit Log ───────────────────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_EMBED_MODEL, prompt: text }),
    });
    if (!response.ok) return null;
    const data = await response.json() as { embedding?: number[] };
    return data.embedding || null;
  } catch {
    return null;
  }
}

async function logAuditEntry(
  pointId: string,
  collection: string,
  level: SensitivityLevel,
  classifier: Classifier,
  contentPreview: string,
  expiresAt: string | null
): Promise<void> {
  try {
    const text = `backfill_classify global ${level} ${contentPreview.slice(0, 200)}`;
    const embedding = await generateEmbedding(text);
    if (!embedding) return;

    const id = crypto.randomUUID();
    await qdrantRequest("PUT", `/collections/audit_log/points`, {
      points: [{
        id,
        vector: embedding,
        payload: {
          action: "backfill_classify",
          timestamp: new Date().toISOString(),
          session_id: SESSION_ID,
          details: {
            memory_id: pointId,
            collection,
            assigned_level: level,
            classifier,
            content_preview: contentPreview.slice(0, 200),
            expires_at: expiresAt,
          },
        },
      }],
    });
  } catch {
    // Audit failures are silently swallowed, matching MCP server behavior
  }
}

// ─── Payload Update ──────────────────────────────────────────────────────────

async function updatePointPayload(
  collection: string,
  pointIds: string[],
  payload: Record<string, unknown>
): Promise<void> {
  await qdrantRequest("POST", `/collections/${collection}/points/payload`, {
    payload,
    points: pointIds,
  });
}

// ─── Content Extraction ──────────────────────────────────────────────────────

function extractContent(point: QdrantPoint): string {
  const p = point.payload;
  // Try common content fields
  if (typeof p.content === "string") return p.content;
  if (typeof p.task === "string") return p.task;
  if (typeof p.task_description === "string") return p.task_description;
  if (typeof p.name === "string") return p.name;
  if (typeof p.description === "string") return p.description;
  if (typeof p.text === "string") return p.text;
  if (typeof p.summary === "string") return p.summary;

  // Last resort: stringify the whole payload
  try {
    return JSON.stringify(p).slice(0, 500);
  } catch {
    return "";
  }
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

// ─── Logging ─────────────────────────────────────────────────────────────────

function log(msg: string): void {
  console.log(msg);
}

function logError(msg: string): void {
  console.error(`[ERROR] ${msg}`);
}

// ─── Sleep ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Overrides ───────────────────────────────────────────────────────────────

function loadOverrides(filePath: string): Map<string, SensitivityLevel> {
  const overrides = new Map<string, SensitivityLevel>();
  try {
    const absPath = resolve(filePath);
    const raw = readFileSync(absPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, string>;

    for (const [id, level] of Object.entries(parsed)) {
      if (VALID_LEVELS.includes(level as SensitivityLevel)) {
        overrides.set(id, level as SensitivityLevel);
      } else {
        logError(`Override for ${id} has invalid level "${level}", skipping.`);
      }
    }

    log(`Loaded ${overrides.size} override(s) from ${absPath}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError(`Failed to load overrides file: ${msg}`);
    process.exit(1);
  }
  return overrides;
}

// ─── CLI Parsing ─────────────────────────────────────────────────────────────

interface CliArgs {
  mode: "dry-run" | "write";
  overridesFile: string | null;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Backfill Classification Script
===============================

Classifies all existing memories in Qdrant that don't have a sensitivity field.
Uses embedding similarity (nomic-embed-text via Ollama) — no LLM inference needed.

Usage:
  npx tsx scripts/backfill-classify.ts --dry-run                          # Preview only (default)
  npx tsx scripts/backfill-classify.ts --write                             # Apply classifications
  npx tsx scripts/backfill-classify.ts --write --overrides overrides.json  # Apply with manual overrides
  npx tsx scripts/backfill-classify.ts --help                              # Show this help

Options:
  --dry-run              Preview classifications without writing (default)
  --write                Apply classifications to Qdrant
  --overrides <file>     JSON file with manual overrides: {"memory-id": "public", ...}
  --help, -h             Show this help

Environment:
  QDRANT_URL             Qdrant REST endpoint (default: http://localhost:6334)
  QDRANT_API_KEY         Qdrant API key
  OLLAMA_URL             Ollama API endpoint (default: http://localhost:11434)

Collections scanned: ${COLLECTIONS_TO_SCAN.join(", ")}
`);
    process.exit(0);
  }

  const mode: "dry-run" | "write" = args.includes("--write") ? "write" : "dry-run";
  let overridesFile: string | null = null;

  const overridesIdx = args.indexOf("--overrides");
  if (overridesIdx !== -1) {
    if (overridesIdx + 1 >= args.length) {
      logError("--overrides requires a file path argument");
      process.exit(1);
    }
    overridesFile = args[overridesIdx + 1];
  }

  return { mode, overridesFile };
}

// ─── Classification Result ───────────────────────────────────────────────────

interface ClassifiedEntry {
  id: string;
  collection: string;
  contentPreview: string;
  level: SensitivityLevel;
  classifier: Classifier | "override";
  expiresAt: string | null;
  flaggedForReview: boolean;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startTime = Date.now();
  const cli = parseArgs();

  log(`\n=== Backfill Classification ===`);
  log(`Mode: ${cli.mode}`);
  log(`Session: ${SESSION_ID}`);
  log(`Qdrant: ${QDRANT_URL}`);
  log(`Ollama: ${OLLAMA_URL}`);
  log(`Classifier: embedding similarity (${OLLAMA_EMBED_MODEL})`);
  log(``);

  // Initialize reference embeddings for similarity-based classification
  await initReferenceEmbeddings();

  // Load overrides if specified
  const overrides = cli.overridesFile ? loadOverrides(cli.overridesFile) : new Map<string, SensitivityLevel>();

  // Collect all unclassified points across collections
  const allEntries: Array<{ point: QdrantPoint; collection: string }> = [];

  for (const collection of COLLECTIONS_TO_SCAN) {
    log(`Scanning collection: ${collection} ...`);
    const points = await scrollAllUnclassified(collection);
    log(`  Found ${points.length} unclassified point(s).`);
    for (const point of points) {
      allEntries.push({ point, collection });
    }
  }

  if (allEntries.length === 0) {
    log(`\nNo unclassified memories found. Nothing to do.`);
    return;
  }

  log(`\nTotal unclassified: ${allEntries.length}`);
  log(`Processing in batches of ${BATCH_SIZE} with ${BATCH_DELAY_MS}ms pause between batches...\n`);

  // Classify in batches
  const classified: ClassifiedEntry[] = [];
  const errors: Array<{ id: string; collection: string; error: string }> = [];
  let batchNum = 0;

  for (let i = 0; i < allEntries.length; i += BATCH_SIZE) {
    batchNum++;
    const batch = allEntries.slice(i, i + BATCH_SIZE);
    log(`Batch ${batchNum} (${batch.length} entries)...`);

    for (const { point, collection } of batch) {
      const content = extractContent(point);
      const preview = truncate(content.replace(/\n/g, " "), 80);
      const pointId = String(point.id);

      try {
        let level: SensitivityLevel;
        let classifier: Classifier | "override";

        // Check overrides first
        if (overrides.has(pointId)) {
          level = overrides.get(pointId)!;
          classifier = "override";
        } else {
          const result = await classifyMemory(content);
          level = result.level;
          classifier = result.classifier;
        }

        // Compute expires_at
        let expiresAt = computeExpiresAt(level);
        let flaggedForReview = false;

        // Handle "restricted" entries older than 1 hour: flag for review
        if (level === "restricted") {
          const createdAt = point.payload.created_at || point.payload.timestamp;
          if (typeof createdAt === "string") {
            const createdDate = new Date(createdAt);
            const oneHourAgo = new Date(Date.now() - TTL.RESTRICTED);
            if (createdDate < oneHourAgo) {
              flaggedForReview = true;
              // Don't auto-set 1hr TTL for old restricted entries
              expiresAt = null;
            }
          } else {
            // No timestamp means we can't determine age; flag for safety
            flaggedForReview = true;
            expiresAt = null;
          }
        }

        classified.push({
          id: pointId,
          collection,
          contentPreview: preview,
          level,
          classifier,
          expiresAt,
          flaggedForReview,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ id: pointId, collection, error: msg });
        logError(`  Failed to classify ${pointId} in ${collection}: ${msg}`);
      }
    }

    // Rate limiting: pause between batches (skip after last batch)
    if (i + BATCH_SIZE < allEntries.length) {
      log(`  Pausing ${BATCH_DELAY_MS}ms...`);
      await sleep(BATCH_DELAY_MS);
    }
  }

  // ─── Output Results ──────────────────────────────────────────────────────

  if (cli.mode === "dry-run") {
    log(`\n--- DRY RUN RESULTS ---\n`);
    log(`| ID | Collection | Content Preview (80 chars) | Proposed Level | Classifier |`);
    log(`|----|------------|---------------------------|----------------|------------|`);

    for (const entry of classified) {
      const reviewFlag = entry.flaggedForReview ? " [REVIEW]" : "";
      const idShort = entry.id.length > 12 ? entry.id.slice(0, 12) + "..." : entry.id;
      log(`| ${idShort} | ${entry.collection} | ${entry.contentPreview} | ${entry.level}${reviewFlag} | ${entry.classifier} |`);
    }
  }

  if (cli.mode === "write") {
    log(`\n--- WRITING CLASSIFICATIONS ---\n`);

    let written = 0;
    let reviewCount = 0;

    // Group by collection for batch updates
    const byCollection = new Map<string, ClassifiedEntry[]>();
    for (const entry of classified) {
      if (!byCollection.has(entry.collection)) {
        byCollection.set(entry.collection, []);
      }
      byCollection.get(entry.collection)!.push(entry);
    }

    for (const [collection, entries] of byCollection) {
      log(`Writing ${entries.length} classification(s) to ${collection}...`);

      // Process in smaller sub-batches for the update API
      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const subBatch = entries.slice(i, i + BATCH_SIZE);

        // Group by (level, expiresAt) for efficient batch updates
        const groups = new Map<string, ClassifiedEntry[]>();
        for (const entry of subBatch) {
          const key = `${entry.level}|${entry.expiresAt ?? "null"}`;
          if (!groups.has(key)) {
            groups.set(key, []);
          }
          groups.get(key)!.push(entry);
        }

        for (const [, groupEntries] of groups) {
          const first = groupEntries[0];
          const pointIds = groupEntries.map(e => e.id);
          const payload: Record<string, unknown> = {
            sensitivity: first.level,
            expires_at: first.expiresAt,
          };

          try {
            await updatePointPayload(collection, pointIds, payload);
            written += groupEntries.length;

            // Log each to audit_log
            for (const entry of groupEntries) {
              if (entry.flaggedForReview) {
                reviewCount++;
              }
              await logAuditEntry(
                entry.id,
                collection,
                entry.level,
                entry.classifier as Classifier,
                entry.contentPreview,
                entry.expiresAt
              );
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logError(`  Failed to update ${pointIds.length} point(s) in ${collection}: ${msg}`);
            for (const entry of groupEntries) {
              errors.push({ id: entry.id, collection, error: msg });
            }
          }
        }
      }
    }

    log(`\nWritten: ${written}`);
    if (reviewCount > 0) {
      log(`Flagged for review (restricted but older than 1hr): ${reviewCount}`);
    }
  }

  // ─── Summary ─────────────────────────────────────────────────────────────

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const counts: Record<string, number> = {};
  for (const entry of classified) {
    counts[entry.level] = (counts[entry.level] || 0) + 1;
  }

  const flagged = classified.filter(e => e.flaggedForReview).length;

  log(`\n=== SUMMARY ===`);
  log(`Total processed:  ${classified.length}`);
  for (const level of VALID_LEVELS) {
    log(`  ${level.padEnd(12)}: ${counts[level] || 0}`);
  }
  if (flagged > 0) {
    log(`  flagged(review): ${flagged}`);
  }
  log(`Errors:           ${errors.length}`);
  log(`Time taken:       ${elapsed}s`);
  log(`Mode:             ${cli.mode}`);
  log(`Session:          ${SESSION_ID}`);

  if (errors.length > 0) {
    log(`\n--- ERRORS ---`);
    for (const { id, collection, error } of errors) {
      log(`  ${collection}/${id}: ${error}`);
    }
  }

  log(``);
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

main().catch((err) => {
  logError(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
