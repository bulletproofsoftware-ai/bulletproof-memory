/**
 * W2-B1: Memory Enhancements
 *
 * REQ-EVO-003: Contradiction Detection & Resolution
 * REQ-EVO-004: Memory Provenance Chain
 * REQ-EVO-005: Hierarchical Abstraction Layers
 * REQ-EVO-007: Active Pruning with Explanation
 */

import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Dependency injection interface
// ---------------------------------------------------------------------------

export interface MemoryEnhancementDeps {
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

export const ENHANCEMENT_COLLECTIONS = {
  HEURISTICS: "heuristics",
  COLD: "memories_cold",
};

// ---------------------------------------------------------------------------
// Types: REQ-EVO-003 Contradiction Detection
// ---------------------------------------------------------------------------

export interface ContradictionResult {
  has_contradiction: boolean;
  contradictions: ContradictionMatch[];
}

export interface ContradictionMatch {
  existing_memory_id: string;
  existing_content_preview: string;
  similarity: number;
  opposition_score: number;
  entity: string;
  explanation: string;
}

export interface ResolutionResult {
  winner_id: string;
  loser_id: string;
  supersedes_edge_id: string;
  explanation: string;
}

// ---------------------------------------------------------------------------
// Types: REQ-EVO-004 Memory Provenance
// ---------------------------------------------------------------------------

export type ConfidenceBasis = "direct_observation" | "inference" | "operator_stated" | "derived";

export type EvidenceType = "tool_output" | "web_fetch" | "file_read";

export interface ProvenanceEvidence {
  type: EvidenceType;
  source: string;
  content_hash: string;
}

export interface Provenance {
  created_by: string;
  session_id: string;
  evidence: ProvenanceEvidence[];
  confidence_basis: ConfidenceBasis;
  created_at: string;
}

export interface ImpactResult {
  memory_id: string;
  provenance_hash: string;
  downstream: DownstreamNode[];
  total_downstream: number;
}

export interface DownstreamNode {
  memory_id: string;
  edge_type: string;
  depth: number;
  content_preview: string;
  provenance_hash: string | null;
}

// ---------------------------------------------------------------------------
// Types: REQ-EVO-005 Hierarchical Abstraction
// ---------------------------------------------------------------------------

export type AbstractionTier = "episodes" | "claude_memories" | "heuristics";

export interface ConsolidationResult {
  facts: ExtractedItem[];
  principles: ExtractedItem[];
  heuristics: ExtractedItem[];
  edges_created: number;
}

export interface ExtractedItem {
  id: string;
  content: string;
  source_ids: string[];
  tier: string;
}

// ---------------------------------------------------------------------------
// Types: REQ-EVO-007 Active Pruning
// ---------------------------------------------------------------------------

export interface PruneCandidate {
  id: string;
  content_preview: string;
  collection: string;
  reason: string;
  temporal_score: number;
  confidence: number;
  last_accessed: string | null;
  status: string | null;
  created_at: string | null;
}

export interface PruneExplanation {
  candidate: PruneCandidate;
  explanation: string;
  retention_value: number;
}

export interface PruneResult {
  pruned_count: number;
  cold_collection: string;
  retention_days: number;
  audit_ids: string[];
  explanations: PruneExplanation[];
}

// ---------------------------------------------------------------------------
// REQ-EVO-003: Contradiction Detection & Resolution
// ---------------------------------------------------------------------------

export class ContradictionDetector {
  private deps: MemoryEnhancementDeps;
  private readonly CONTRADICTION_THRESHOLD = 0.6;

  constructor(deps: MemoryEnhancementDeps) {
    this.deps = deps;
  }

  /**
   * Extract the primary entity/subject from content using local LLM.
   */
  private async extractEntity(content: string): Promise<string> {
    const prompt = `Extract the primary entity or subject from this statement. Respond with ONLY the entity name, nothing else.

Statement: "${content.slice(0, 500)}"

Entity:`;
    const result = await this.deps.ollamaGenerate(prompt);
    if (result && result.length < 100) {
      return result.replace(/['"]/g, "").trim();
    }
    // Fallback: use first noun-like phrase (words before first verb-like pattern)
    const words = content.split(/\s+/).slice(0, 5);
    return words.join(" ");
  }

  /**
   * Determine if two statements are semantically opposed using local LLM.
   * Returns a score 0-1 where 1 = fully opposed.
   */
  private async checkSemanticOpposition(contentA: string, contentB: string): Promise<{ score: number; explanation: string }> {
    const prompt = `Do these two statements contradict each other? Rate the contradiction on a scale of 0.0 to 1.0 where 0.0 means no contradiction and 1.0 means complete contradiction.

Statement A: "${contentA.slice(0, 400)}"
Statement B: "${contentB.slice(0, 400)}"

Respond with ONLY a JSON object like {"score": 0.8, "explanation": "brief reason"}. No other text.`;

    const result = await this.deps.ollamaGenerate(prompt);
    if (result) {
      try {
        // Try to parse JSON from the response
        const jsonMatch = result.match(/\{[^}]+\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const score = typeof parsed.score === "number" ? Math.min(1, Math.max(0, parsed.score)) : 0;
          return { score, explanation: parsed.explanation || "LLM-assessed contradiction" };
        }
      } catch {
        // Try to extract just a number
        const numMatch = result.match(/(\d+\.?\d*)/);
        if (numMatch) {
          const score = Math.min(1, Math.max(0, parseFloat(numMatch[1])));
          return { score, explanation: "LLM-assessed contradiction" };
        }
      }
    }
    // Fallback: keyword-based opposition detection
    return this.keywordOppositionCheck(contentA, contentB);
  }

  /**
   * Keyword-based fallback for opposition detection when LLM is unavailable.
   */
  private keywordOppositionCheck(a: string, b: string): { score: number; explanation: string } {
    const la = a.toLowerCase();
    const lb = b.toLowerCase();

    const oppositionPairs: [RegExp, RegExp][] = [
      [/\bnot\b/, /\bis\b/],
      [/\bnever\b/, /\balways\b/],
      [/\bprefer\b/, /\bavoid\b/],
      [/\bdislike\b/, /\blike\b/],
      [/\bwrong\b/, /\bcorrect\b/],
      [/\bdisable\b/, /\benable\b/],
      [/\breject\b/, /\baccept\b/],
      [/\bno longer\b/, /\bcurrently\b/],
      [/\binstead of\b/, /\buse\b/],
      [/\breplaced\b/, /\buse\b/],
    ];

    let hits = 0;
    for (const [patA, patB] of oppositionPairs) {
      if ((patA.test(la) && patB.test(lb)) || (patB.test(la) && patA.test(lb))) {
        hits++;
      }
    }

    // Check for explicit negation patterns
    const negationPatterns = [
      /\bnot\b/, /\bno\b/, /\bnever\b/, /\bdon't\b/, /\bdoesn't\b/,
      /\bwon't\b/, /\bcan't\b/, /\bshouldn't\b/, /\bisn't\b/, /\bwasn't\b/,
    ];
    const aNegated = negationPatterns.some(p => p.test(la));
    const bNegated = negationPatterns.some(p => p.test(lb));
    if (aNegated !== bNegated) {
      hits += 2;
    }

    const score = Math.min(1.0, hits * 0.25);
    return {
      score,
      explanation: hits > 0 ? `Keyword opposition detected (${hits} signals)` : "No keyword opposition found",
    };
  }

  /**
   * Detect contradictions between new content and existing memories.
   */
  async detect(newContent: string, existingMemories: Array<{ id: string; score: number; payload?: Record<string, unknown> }>): Promise<ContradictionResult> {
    const entity = await this.extractEntity(newContent);
    const contradictions: ContradictionMatch[] = [];

    for (const mem of existingMemories) {
      // Only check memories with cosine similarity above threshold
      if (mem.score < this.CONTRADICTION_THRESHOLD) continue;

      const existingContent = (mem.payload?.content as string) || "";
      if (!existingContent) continue;

      // Check for semantic opposition
      const opposition = await this.checkSemanticOpposition(newContent, existingContent);

      if (opposition.score >= 0.5) {
        contradictions.push({
          existing_memory_id: mem.id as string,
          existing_content_preview: existingContent.slice(0, 200),
          similarity: mem.score,
          opposition_score: opposition.score,
          entity,
          explanation: opposition.explanation,
        });
      }
    }

    // Sort by opposition score descending
    contradictions.sort((a, b) => b.opposition_score - a.opposition_score);

    return {
      has_contradiction: contradictions.length > 0,
      contradictions,
    };
  }

  /**
   * Resolve a contradiction by marking a winner and loser.
   * The winning memory gets a 'supersedes' edge, loser gets status: superseded.
   */
  async resolve(
    winnerId: string,
    loserId: string,
    collection: string = "claude_memories"
  ): Promise<ResolutionResult> {
    // Mark loser as superseded
    await this.deps.updatePayload(collection, [loserId], {
      status: "superseded",
      superseded_by: winnerId,
      superseded_at: new Date().toISOString(),
    });

    // Create supersedes edge in memory_links
    const edgeId = this.deps.generateUUID();
    const linkText = `${winnerId} supersedes ${loserId}`;
    const embedding = await this.deps.generateEmbedding(linkText);
    if (embedding) {
      await this.deps.storePoint("memory_links", edgeId, embedding, {
        source_id: winnerId,
        target_id: loserId,
        edge_type: "supersedes",
        relationship: "supersedes",
        confidence: 1.0,
        strength: 1.0,
        created_at: new Date().toISOString(),
        auto_generated: true,
      });
    }

    // Also create contradicts edge for provenance
    const contradictEdgeId = this.deps.generateUUID();
    const contradictText = `${winnerId} contradicts ${loserId}`;
    const contradictEmbed = await this.deps.generateEmbedding(contradictText);
    if (contradictEmbed) {
      await this.deps.storePoint("memory_links", contradictEdgeId, contradictEmbed, {
        source_id: winnerId,
        target_id: loserId,
        edge_type: "contradicts",
        relationship: "contradicts",
        confidence: 1.0,
        strength: 1.0,
        created_at: new Date().toISOString(),
        auto_generated: true,
      });
    }

    await this.deps.logAudit("contradiction_resolved", {
      winner_id: winnerId,
      loser_id: loserId,
      supersedes_edge_id: edgeId,
    });

    return {
      winner_id: winnerId,
      loser_id: loserId,
      supersedes_edge_id: edgeId,
      explanation: `Memory ${winnerId} supersedes ${loserId}. Loser marked as superseded.`,
    };
  }
}

// ---------------------------------------------------------------------------
// REQ-EVO-004: Memory Provenance Chain
// ---------------------------------------------------------------------------

export class ProvenanceManager {
  private deps: MemoryEnhancementDeps;

  constructor(deps: MemoryEnhancementDeps) {
    this.deps = deps;
  }

  /**
   * Create a provenance record for a memory.
   */
  createProvenance(context: {
    created_by?: string;
    session_id: string;
    evidence?: Array<{ type: EvidenceType; source: string; content: string }>;
    confidence_basis?: ConfidenceBasis;
  }): Provenance {
    const evidence: ProvenanceEvidence[] = (context.evidence || []).map(e => ({
      type: e.type,
      source: e.source,
      content_hash: createHash("sha256").update(e.content).digest("hex"),
    }));

    return {
      created_by: context.created_by || "claude-agent",
      session_id: context.session_id,
      evidence,
      confidence_basis: context.confidence_basis || "operator_stated",
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Compute SHA-256 hash of canonical provenance JSON.
   */
  computeHash(provenance: Provenance): string {
    // Canonical form: sorted keys, no whitespace
    const canonical = JSON.stringify(provenance, Object.keys(provenance).sort());
    return createHash("sha256").update(canonical).digest("hex");
  }

  /**
   * Forward-trace: traverse informed/derived_from edges to find downstream impacts.
   */
  async forwardTrace(memoryId: string): Promise<ImpactResult> {
    const visited = new Set<string>();
    const downstream: DownstreamNode[] = [];
    const queue: { id: string; depth: number; edge_type: string }[] = [];

    // Seed with direct outgoing edges
    const directEdges = await this.deps.scrollPoints("memory_links", {
      must: [{ key: "source_id", match: { value: memoryId } }],
    }, 100) as Array<{ payload?: Record<string, unknown> }>;

    for (const edge of directEdges) {
      const edgeType = (edge.payload?.edge_type as string) || (edge.payload?.relationship as string) || "";
      if (edgeType === "informed" || edgeType === "derived_from" || edgeType === "supersedes" || edgeType === "contradicts") {
        const targetId = edge.payload?.target_id as string;
        if (targetId && !visited.has(targetId)) {
          queue.push({ id: targetId, depth: 1, edge_type: edgeType });
        }
      }
    }

    // BFS traversal
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id) || current.depth > 5) continue;
      visited.add(current.id);

      // Fetch the memory to get content and provenance
      let contentPreview = "[unavailable]";
      let provenanceHash: string | null = null;
      try {
        const mem = await this.deps.getPoint("claude_memories", current.id) as { payload?: Record<string, unknown> } | null;
        if (mem?.payload) {
          contentPreview = ((mem.payload.content as string) || "").slice(0, 120);
          if (mem.payload.provenance_hash) {
            provenanceHash = mem.payload.provenance_hash as string;
          }
        }
      } catch { /* memory may have been deleted */ }

      downstream.push({
        memory_id: current.id,
        edge_type: current.edge_type,
        depth: current.depth,
        content_preview: contentPreview,
        provenance_hash: provenanceHash,
      });

      // Continue traversal
      if (current.depth < 5) {
        try {
          const nextEdges = await this.deps.scrollPoints("memory_links", {
            must: [{ key: "source_id", match: { value: current.id } }],
          }, 50) as Array<{ payload?: Record<string, unknown> }>;

          for (const edge of nextEdges) {
            const et = (edge.payload?.edge_type as string) || (edge.payload?.relationship as string) || "";
            if (et === "informed" || et === "derived_from") {
              const tid = edge.payload?.target_id as string;
              if (tid && !visited.has(tid)) {
                queue.push({ id: tid, depth: current.depth + 1, edge_type: et });
              }
            }
          }
        } catch { /* skip on error */ }
      }
    }

    // Get provenance hash of the root memory
    let rootHash = "";
    try {
      const root = await this.deps.getPoint("claude_memories", memoryId) as { payload?: Record<string, unknown> } | null;
      rootHash = (root?.payload?.provenance_hash as string) || "";
    } catch { /* skip */ }

    return {
      memory_id: memoryId,
      provenance_hash: rootHash,
      downstream,
      total_downstream: downstream.length,
    };
  }
}

// ---------------------------------------------------------------------------
// REQ-EVO-005: Hierarchical Abstraction Layers
// ---------------------------------------------------------------------------

export class AbstractionEngine {
  private deps: MemoryEnhancementDeps;

  // Tier weights for recall priority
  private static readonly TIER_WEIGHTS: Record<string, number> = {
    episodes: 1,
    claude_memories: 2,   // facts
    principles: 3,        // derived from facts — stored in claude_memories with tier=principle
    heuristics: 4,
  };

  constructor(deps: MemoryEnhancementDeps) {
    this.deps = deps;
  }

  /**
   * Get the abstraction weight multiplier for a collection/tier.
   */
  getAbstractionWeight(collection: string): number {
    return AbstractionEngine.TIER_WEIGHTS[collection] || 1;
  }

  /**
   * Extract facts from a set of episode memories using LLM.
   */
  private async extractFacts(episodes: Array<{ id: string; content: string }>): Promise<ExtractedItem[]> {
    if (episodes.length === 0) return [];

    const episodeSummaries = episodes.map((e, i) => `${i + 1}. ${e.content.slice(0, 300)}`).join("\n");

    const prompt = `Given these episode records, extract distinct factual statements. Each fact should be a standalone, verifiable statement.

Episodes:
${episodeSummaries}

Respond with ONLY a JSON array of strings, each being one fact. Example: ["Fact one", "Fact two"]
No other text.`;

    const result = await this.deps.ollamaGenerate(prompt);
    const facts: ExtractedItem[] = [];

    if (result) {
      try {
        const arrMatch = result.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          const parsed = JSON.parse(arrMatch[0]) as string[];
          for (const factContent of parsed) {
            if (typeof factContent !== "string" || factContent.length < 5) continue;

            const id = this.deps.generateUUID();
            const embedding = await this.deps.generateEmbedding(factContent);
            if (!embedding) continue;

            await this.deps.storePoint("claude_memories", id, embedding, {
              content: factContent,
              type: "fact",
              tier: "fact",
              abstraction_tier: "fact",
              tags: ["consolidated", "auto-extracted"],
              created_at: new Date().toISOString(),
              source_episode_ids: episodes.map(e => e.id),
              temporal_class: "permanent",
              last_verified_date: new Date().toISOString(),
            });

            // Create derived_from edges to source episodes
            for (const ep of episodes) {
              const edgeId = this.deps.generateUUID();
              const linkText = `${id} derived_from ${ep.id}`;
              const linkEmbed = await this.deps.generateEmbedding(linkText);
              if (linkEmbed) {
                await this.deps.storePoint("memory_links", edgeId, linkEmbed, {
                  source_id: id,
                  target_id: ep.id,
                  edge_type: "derived_from",
                  relationship: "derived_from",
                  confidence: 0.9,
                  strength: 0.9,
                  created_at: new Date().toISOString(),
                  auto_generated: true,
                });
              }
            }

            facts.push({
              id,
              content: factContent,
              source_ids: episodes.map(e => e.id),
              tier: "fact",
            });
          }
        }
      } catch { /* parse failure - skip */ }
    }

    return facts;
  }

  /**
   * Group related facts into principles.
   */
  private async groupIntoPrinciples(facts: ExtractedItem[]): Promise<ExtractedItem[]> {
    if (facts.length < 2) return [];

    const factSummaries = facts.map((f, i) => `${i + 1}. ${f.content.slice(0, 200)}`).join("\n");

    const prompt = `Given these facts, derive general principles that explain or unite multiple facts. A principle is a broader rule or pattern.

Facts:
${factSummaries}

Respond with ONLY a JSON array of objects: [{"principle": "text", "source_indices": [0, 1]}]
Source indices are 0-based indices into the facts list.
No other text.`;

    const result = await this.deps.ollamaGenerate(prompt);
    const principles: ExtractedItem[] = [];

    if (result) {
      try {
        const arrMatch = result.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          const parsed = JSON.parse(arrMatch[0]) as Array<{ principle: string; source_indices: number[] }>;
          for (const p of parsed) {
            if (!p.principle || p.principle.length < 5) continue;

            const id = this.deps.generateUUID();
            const embedding = await this.deps.generateEmbedding(p.principle);
            if (!embedding) continue;

            const sourceIds = (p.source_indices || [])
              .filter(i => i >= 0 && i < facts.length)
              .map(i => facts[i].id);

            await this.deps.storePoint("claude_memories", id, embedding, {
              content: p.principle,
              type: "fact",
              tier: "principle",
              abstraction_tier: "principle",
              tags: ["consolidated", "principle", "auto-derived"],
              created_at: new Date().toISOString(),
              source_fact_ids: sourceIds,
              temporal_class: "permanent",
              last_verified_date: new Date().toISOString(),
            });

            // Create derived_from edges
            for (const srcId of sourceIds) {
              const edgeId = this.deps.generateUUID();
              const linkText = `${id} derived_from ${srcId}`;
              const linkEmbed = await this.deps.generateEmbedding(linkText);
              if (linkEmbed) {
                await this.deps.storePoint("memory_links", edgeId, linkEmbed, {
                  source_id: id,
                  target_id: srcId,
                  edge_type: "derived_from",
                  relationship: "derived_from",
                  confidence: 0.85,
                  strength: 0.85,
                  created_at: new Date().toISOString(),
                  auto_generated: true,
                });
              }
            }

            principles.push({
              id,
              content: p.principle,
              source_ids: sourceIds,
              tier: "principle",
            });
          }
        }
      } catch { /* parse failure */ }
    }

    return principles;
  }

  /**
   * Group principles into high-level heuristics stored in the heuristics collection.
   */
  private async groupIntoHeuristics(principles: ExtractedItem[]): Promise<ExtractedItem[]> {
    if (principles.length < 2) return [];

    const principleSummaries = principles.map((p, i) => `${i + 1}. ${p.content.slice(0, 200)}`).join("\n");

    const prompt = `Given these principles, derive actionable heuristics — quick decision rules or rules of thumb that an AI agent should follow.

Principles:
${principleSummaries}

Respond with ONLY a JSON array of objects: [{"heuristic": "text", "source_indices": [0, 1]}]
Source indices are 0-based indices into the principles list.
No other text.`;

    const result = await this.deps.ollamaGenerate(prompt);
    const heuristics: ExtractedItem[] = [];

    if (result) {
      try {
        const arrMatch = result.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          const parsed = JSON.parse(arrMatch[0]) as Array<{ heuristic: string; source_indices: number[] }>;
          for (const h of parsed) {
            if (!h.heuristic || h.heuristic.length < 5) continue;

            const id = this.deps.generateUUID();
            const embedding = await this.deps.generateEmbedding(h.heuristic);
            if (!embedding) continue;

            const sourceIds = (h.source_indices || [])
              .filter(i => i >= 0 && i < principles.length)
              .map(i => principles[i].id);

            await this.deps.storePoint(ENHANCEMENT_COLLECTIONS.HEURISTICS, id, embedding, {
              content: h.heuristic,
              type: "heuristic",
              tier: "heuristic",
              abstraction_tier: "heuristic",
              tags: ["consolidated", "heuristic", "auto-derived"],
              created_at: new Date().toISOString(),
              source_principle_ids: sourceIds,
              temporal_class: "permanent",
              last_verified_date: new Date().toISOString(),
            });

            // Create derived_from edges
            for (const srcId of sourceIds) {
              const edgeId = this.deps.generateUUID();
              const linkText = `${id} derived_from ${srcId}`;
              const linkEmbed = await this.deps.generateEmbedding(linkText);
              if (linkEmbed) {
                await this.deps.storePoint("memory_links", edgeId, linkEmbed, {
                  source_id: id,
                  target_id: srcId,
                  edge_type: "derived_from",
                  relationship: "derived_from",
                  confidence: 0.8,
                  strength: 0.8,
                  created_at: new Date().toISOString(),
                  auto_generated: true,
                });
              }
            }

            heuristics.push({
              id,
              content: h.heuristic,
              source_ids: sourceIds,
              tier: "heuristic",
            });
          }
        }
      } catch { /* parse failure */ }
    }

    return heuristics;
  }

  /**
   * Full consolidation pipeline: Episodes → Facts → Principles → Heuristics
   */
  async consolidate(episodes: Array<{ id: string; content: string }>): Promise<ConsolidationResult> {
    let edgesCreated = 0;

    // Step 1: Extract facts from episodes
    const facts = await this.extractFacts(episodes);
    edgesCreated += facts.reduce((sum, f) => sum + f.source_ids.length, 0);

    // Step 2: Group facts into principles
    const principles = await this.groupIntoPrinciples(facts);
    edgesCreated += principles.reduce((sum, p) => sum + p.source_ids.length, 0);

    // Step 3: Group principles into heuristics
    const heuristics = await this.groupIntoHeuristics(principles);
    edgesCreated += heuristics.reduce((sum, h) => sum + h.source_ids.length, 0);

    await this.deps.logAudit("memory_consolidation", {
      episodes_processed: episodes.length,
      facts_extracted: facts.length,
      principles_derived: principles.length,
      heuristics_created: heuristics.length,
      edges_created: edgesCreated,
    });

    return { facts, principles, heuristics, edges_created: edgesCreated };
  }
}

// ---------------------------------------------------------------------------
// REQ-EVO-007: Active Pruning with Explanation
// ---------------------------------------------------------------------------

export class PruningEngine {
  private deps: MemoryEnhancementDeps;
  private readonly COLD_RETENTION_DAYS = 90;

  constructor(deps: MemoryEnhancementDeps) {
    this.deps = deps;
  }

  /**
   * Identify prune candidates based on multiple criteria:
   * - temporal_score < 0.1
   * - confidence < 0.2
   * - status: superseded
   * - unused > 180 days
   */
  async identifyCandidates(opts?: {
    collection?: string;
    limit?: number;
    dry_run?: boolean;
  }): Promise<PruneCandidate[]> {
    const collection = opts?.collection || "claude_memories";
    const limit = opts?.limit || 50;
    const candidates: PruneCandidate[] = [];
    const now = Date.now();
    const unusedThresholdMs = 180 * 24 * 60 * 60 * 1000;

    // First pass: fetch superseded points from Qdrant with server-side filter
    const supersededFilter = {
      must: [{ key: "status", match: { value: "superseded" } }],
    };
    const supersededPoints = await this.deps.scrollPoints(collection, supersededFilter, limit) as Array<{
      id: string;
      payload?: Record<string, unknown>;
    }>;

    // Second pass: fetch remaining points without status filter for other criteria
    // (temporal_score, confidence, and unused age can't be filtered at Qdrant level)
    const remainingLimit = Math.max(0, (limit * 3) - supersededPoints.length);
    const otherPoints = remainingLimit > 0
      ? await this.deps.scrollPoints(collection, undefined, remainingLimit) as Array<{
          id: string;
          payload?: Record<string, unknown>;
        }>
      : [];

    // Deduplicate: superseded points may appear in both sets
    const seenIds = new Set(supersededPoints.map(p => p.id));
    const allPoints = [...supersededPoints];
    for (const p of otherPoints) {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        allPoints.push(p);
      }
    }

    for (const point of allPoints) {
      const payload = point.payload || {};
      const reasons: string[] = [];

      // Check temporal score
      const temporalScore = this.deps.computeTemporalScore(payload);
      if (temporalScore < 0.1) {
        reasons.push(`temporal_score=${temporalScore.toFixed(4)} (threshold: 0.1)`);
      }

      // Check confidence (if stored)
      const confidence = typeof payload.confidence === "number" ? payload.confidence : 1.0;
      if (confidence < 0.2) {
        reasons.push(`confidence=${confidence.toFixed(2)} (threshold: 0.2)`);
      }

      // Check if superseded
      const status = payload.status as string | undefined;
      if (status === "superseded") {
        reasons.push("status=superseded");
      }

      // Check last access / creation date for unused threshold
      const lastAccessed = (payload.last_accessed as string) || (payload.created_at as string);
      if (lastAccessed) {
        const lastAccessedMs = new Date(lastAccessed).getTime();
        const daysSinceAccess = (now - lastAccessedMs) / (24 * 60 * 60 * 1000);
        if (daysSinceAccess > 180) {
          reasons.push(`unused for ${Math.round(daysSinceAccess)} days (threshold: 180)`);
        }
      }

      if (reasons.length > 0) {
        candidates.push({
          id: point.id,
          content_preview: ((payload.content as string) || "").slice(0, 150),
          collection,
          reason: reasons.join("; "),
          temporal_score: temporalScore,
          confidence,
          last_accessed: (payload.last_accessed as string) || null,
          status: status || null,
          created_at: (payload.created_at as string) || null,
        });
      }
    }

    // Sort by number of reasons (most reasons = most pruneable) then by temporal score ascending
    candidates.sort((a, b) => {
      const aReasons = a.reason.split(";").length;
      const bReasons = b.reason.split(";").length;
      if (bReasons !== aReasons) return bReasons - aReasons;
      return a.temporal_score - b.temporal_score;
    });

    return candidates.slice(0, limit);
  }

  /**
   * Generate a human-readable explanation for why a candidate should be pruned.
   */
  async generateExplanation(candidate: PruneCandidate): Promise<PruneExplanation> {
    // Compute a retention value (0-1, lower = safer to prune)
    let retentionValue = 0.5;
    if (candidate.temporal_score < 0.05) retentionValue -= 0.2;
    if (candidate.confidence < 0.1) retentionValue -= 0.15;
    if (candidate.status === "superseded") retentionValue -= 0.25;
    if (candidate.last_accessed) {
      const daysSinceAccess = (Date.now() - new Date(candidate.last_accessed).getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceAccess > 365) retentionValue -= 0.15;
      else if (daysSinceAccess > 180) retentionValue -= 0.1;
    }
    retentionValue = Math.max(0, Math.min(1, retentionValue));

    // Build explanation
    const parts: string[] = [];

    if (candidate.status === "superseded") {
      parts.push("This memory has been superseded by a newer, contradicting memory and is no longer the authoritative version.");
    }

    if (candidate.temporal_score < 0.1) {
      parts.push(`Its temporal relevance score has decayed to ${candidate.temporal_score.toFixed(4)}, well below the 0.1 threshold.`);
    }

    if (candidate.confidence < 0.2) {
      parts.push(`Its confidence score (${candidate.confidence.toFixed(2)}) is below the 0.2 minimum threshold.`);
    }

    if (candidate.last_accessed) {
      const daysSinceAccess = (Date.now() - new Date(candidate.last_accessed).getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceAccess > 180) {
        parts.push(`It has not been accessed in ${Math.round(daysSinceAccess)} days (threshold: 180 days).`);
      }
    }

    const explanation = parts.length > 0
      ? `Prune candidate: ${parts.join(" ")}`
      : `Matched pruning criteria: ${candidate.reason}`;

    return {
      candidate,
      explanation,
      retention_value: retentionValue,
    };
  }

  /**
   * Execute pruning: move candidate to memories_cold (soft delete) with 90-day retention.
   * Creates MEMORY_PRUNED audit event.
   */
  async executePrune(candidateId: string, collection: string = "claude_memories", explanation?: string): Promise<{
    pruned: boolean;
    cold_id: string;
    audit_id: string | null;
    retention_expires: string;
  }> {
    // Fetch the original memory with its vector
    const original = await this.deps.getPoint(collection, candidateId, true) as {
      id: string;
      payload?: Record<string, unknown>;
      vector?: number[];
    } | null;

    if (!original) {
      throw new Error(`Memory ${candidateId} not found in ${collection}`);
    }

    const retentionExpires = new Date(Date.now() + this.COLD_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Store in cold collection with pruning metadata
    const coldId = this.deps.generateUUID();
    const coldPayload: Record<string, unknown> = {
      ...(original.payload || {}),
      original_id: candidateId,
      original_collection: collection,
      pruned_at: new Date().toISOString(),
      prune_explanation: explanation || "Matched pruning criteria",
      retention_expires: retentionExpires,
      cold_status: "soft_deleted",
    };

    // If we have a vector, store it; otherwise generate a new embedding
    let vector = original.vector as number[] | undefined;
    if (!vector || !Array.isArray(vector) || vector.length === 0) {
      const content = (original.payload?.content as string) || "";
      const generated = await this.deps.generateEmbedding(content || "pruned memory");
      if (generated) {
        vector = generated;
      }
    }

    if (vector && vector.length > 0) {
      await this.deps.storePoint(ENHANCEMENT_COLLECTIONS.COLD, coldId, vector, coldPayload);
    }

    // Delete from original collection
    await this.deps.deletePoints(collection, [candidateId]);

    // Create audit event
    const auditId = await this.deps.logAudit("MEMORY_PRUNED", {
      original_id: candidateId,
      original_collection: collection,
      cold_id: coldId,
      cold_collection: ENHANCEMENT_COLLECTIONS.COLD,
      retention_expires: retentionExpires,
      prune_explanation: explanation || "Matched pruning criteria",
      content_preview: ((original.payload?.content as string) || "").slice(0, 80),
    });

    return {
      pruned: true,
      cold_id: coldId,
      audit_id: auditId,
      retention_expires: retentionExpires,
    };
  }
}
