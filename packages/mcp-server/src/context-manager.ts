/**
 * REQ-EVO-009: Structured Context Compartments
 * REQ-EVO-035: Context Budget Manager
 *
 * Manages context window budget across five structured compartments with
 * priority-based eviction, pinning support, budget alerts, and operator-facing UX.
 *
 * Compartment allocations (% of total budget):
 *   - active_task: 40%
 *   - project_background: 20%
 *   - operator_preferences: 10%
 *   - safety_constraints: 10% (pinned, never evicted)
 *   - ambient_knowledge: 20%
 *
 * Eviction priority (lowest evicted first):
 *   Safety > Operator > Project > Ambient > Active Task (oldest first)
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContextCompartment =
  | "active_task"
  | "project_background"
  | "operator_preferences"
  | "safety_constraints"
  | "ambient_knowledge";

export interface CompartmentItem {
  id: string;
  content: string;
  compartment: ContextCompartment;
  token_count: number;
  pinned: boolean;
  priority: number;
  added_at: string;
  metadata?: Record<string, unknown>;
}

export interface CompartmentBudget {
  compartment: ContextCompartment;
  used: number;
  limit: number;
  percentage: number;
  items_count: number;
}

export interface EvictionRecord {
  item_id: string;
  compartment: ContextCompartment;
  token_count: number;
  reason: string;
  evicted_at: string;
  content_preview: string;
}

export interface BudgetAlert {
  compartment: ContextCompartment;
  usage_percentage: number;
  used: number;
  limit: number;
  message: string;
}

interface AddItemOptions {
  pinned?: boolean;
  priority?: number;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TOTAL_BUDGET = 200_000;

const COMPARTMENT_ALLOCATIONS: Record<ContextCompartment, number> = {
  active_task: 0.40,
  project_background: 0.20,
  operator_preferences: 0.10,
  safety_constraints: 0.10,
  ambient_knowledge: 0.20,
};

/**
 * Eviction priority: higher number = harder to evict.
 * safety_constraints = 100 (never evicted).
 */
const EVICTION_PRIORITY: Record<ContextCompartment, number> = {
  active_task: 1,
  ambient_knowledge: 2,
  project_background: 3,
  operator_preferences: 4,
  safety_constraints: 100,
};

const ALERT_THRESHOLD = 0.90;
const MAX_EVICTION_LOG = 200;
const CONTENT_PREVIEW_LENGTH = 80;

// ---------------------------------------------------------------------------
// Dependencies (injected, not imported from index.ts)
// ---------------------------------------------------------------------------

export interface ContextManagerDeps {
  logAudit: (action: string, details: Record<string, unknown>, sensitivity?: string, project?: string) => Promise<string | null>;
}

// ---------------------------------------------------------------------------
// ContextManager
// ---------------------------------------------------------------------------

export class ContextManager {
  private items: Map<string, CompartmentItem> = new Map();
  private evictionLog: EvictionRecord[] = [];
  private totalBudget: number = DEFAULT_TOTAL_BUDGET;
  private deps: ContextManagerDeps;

  constructor(deps: ContextManagerDeps) {
    this.deps = deps;
  }

  // -----------------------------------------------------------------------
  // Token estimation
  // -----------------------------------------------------------------------

  /**
   * Approximate token count using byte length for better non-ASCII (CJK/emoji) handling.
   * ~4 bytes per token is a reasonable approximation across scripts.
   */
  estimateTokens(text: string): number {
    return Math.ceil(Buffer.byteLength(text, "utf-8") / 4);
  }

  // -----------------------------------------------------------------------
  // Budget management
  // -----------------------------------------------------------------------

  setTotalBudget(tokens: number): void {
    if (tokens < 1000) {
      throw new Error("Total budget must be at least 1000 tokens");
    }
    this.totalBudget = tokens;
  }

  getTotalBudget(): number {
    return this.totalBudget;
  }

  private getCompartmentLimit(compartment: ContextCompartment): number {
    return Math.floor(this.totalBudget * COMPARTMENT_ALLOCATIONS[compartment]);
  }

  private getCompartmentUsed(compartment: ContextCompartment): number {
    let used = 0;
    for (const item of this.items.values()) {
      if (item.compartment === compartment) {
        used += item.token_count;
      }
    }
    return used;
  }

  getBudget(): CompartmentBudget[] {
    const compartments: ContextCompartment[] = [
      "active_task",
      "project_background",
      "operator_preferences",
      "safety_constraints",
      "ambient_knowledge",
    ];

    return compartments.map((compartment) => {
      const limit = this.getCompartmentLimit(compartment);
      const used = this.getCompartmentUsed(compartment);
      let itemsCount = 0;
      for (const item of this.items.values()) {
        if (item.compartment === compartment) itemsCount++;
      }
      return {
        compartment,
        used,
        limit,
        percentage: limit > 0 ? Math.round((used / limit) * 10000) / 100 : 0,
        items_count: itemsCount,
      };
    });
  }

  // -----------------------------------------------------------------------
  // Item management
  // -----------------------------------------------------------------------

  addItem(
    compartment: ContextCompartment,
    content: string,
    opts?: AddItemOptions
  ): CompartmentItem {
    const tokenCount = this.estimateTokens(content);
    const isPinned =
      compartment === "safety_constraints" ? true : opts?.pinned ?? false;

    const item: CompartmentItem = {
      id: randomUUID(),
      content,
      compartment,
      token_count: tokenCount,
      pinned: isPinned,
      priority: opts?.priority ?? EVICTION_PRIORITY[compartment],
      added_at: new Date().toISOString(),
      metadata: opts?.metadata,
    };

    this.items.set(item.id, item);

    // Auto-enforce budgets after adding
    this.enforceBudgets();

    return item;
  }

  removeItem(itemId: string): boolean {
    const item = this.items.get(itemId);
    if (!item) return false;

    this.items.delete(itemId);
    return true;
  }

  pinItem(itemId: string): boolean {
    const item = this.items.get(itemId);
    if (!item) return false;

    item.pinned = true;
    return true;
  }

  unpinItem(itemId: string): boolean {
    const item = this.items.get(itemId);
    if (!item) return false;

    // Safety constraints items cannot be unpinned
    if (item.compartment === "safety_constraints") {
      return false;
    }

    item.pinned = false;
    return true;
  }

  getCompartmentItems(compartment: ContextCompartment): CompartmentItem[] {
    const result: CompartmentItem[] = [];
    for (const item of this.items.values()) {
      if (item.compartment === compartment) {
        result.push(item);
      }
    }
    // Sort by added_at ascending (oldest first)
    result.sort((a, b) => a.added_at.localeCompare(b.added_at));
    return result;
  }

  // -----------------------------------------------------------------------
  // Budget enforcement & eviction
  // -----------------------------------------------------------------------

  /**
   * Evict items from over-budget compartments.
   *
   * Priority order (evict from lowest priority first):
   *   Active Task (oldest first) > Ambient > Project > Operator > Safety (never)
   *
   * Within a compartment, unpinned items are evicted before pinned items,
   * and older items are evicted before newer items.
   */
  enforceBudgets(): EvictionRecord[] {
    const evicted: EvictionRecord[] = [];

    const compartments: ContextCompartment[] = [
      "active_task",
      "project_background",
      "operator_preferences",
      "safety_constraints",
      "ambient_knowledge",
    ];

    for (const compartment of compartments) {
      // Safety constraints are never evicted
      if (compartment === "safety_constraints") continue;

      const limit = this.getCompartmentLimit(compartment);
      let used = this.getCompartmentUsed(compartment);

      if (used <= limit) continue;

      // Get eviction candidates: unpinned items sorted by priority asc, then oldest first
      const candidates = this.getEvictionCandidates(compartment);

      for (const candidate of candidates) {
        if (used <= limit) break;

        const record: EvictionRecord = {
          item_id: candidate.id,
          compartment,
          token_count: candidate.token_count,
          reason: `Compartment '${compartment}' over budget (${used}/${limit} tokens). ` +
            `Evicting lowest-priority unpinned item (priority=${candidate.priority}).`,
          evicted_at: new Date().toISOString(),
          content_preview: candidate.content.slice(0, CONTENT_PREVIEW_LENGTH) +
            (candidate.content.length > CONTENT_PREVIEW_LENGTH ? "..." : ""),
        };

        this.items.delete(candidate.id);
        used -= candidate.token_count;

        evicted.push(record);
        this.evictionLog.push(record);

        // Trim eviction log to max size
        if (this.evictionLog.length > MAX_EVICTION_LOG) {
          this.evictionLog = this.evictionLog.slice(-MAX_EVICTION_LOG);
        }
      }

      // If still over budget after evicting all candidates, log warning
      if (used > limit) {
        const warningRecord: EvictionRecord = {
          item_id: "NONE",
          compartment,
          token_count: 0,
          reason: `WARNING: Compartment '${compartment}' still over budget (${used}/${limit}) ` +
            `after evicting all eligible items. Remaining items are pinned.`,
          evicted_at: new Date().toISOString(),
          content_preview: "",
        };
        this.evictionLog.push(warningRecord);
      }
    }

    // Log evictions to audit trail (fire-and-forget)
    if (evicted.length > 0) {
      this.deps.logAudit("context_eviction", {
        evicted_count: evicted.length,
        evictions: evicted.map((e) => ({
          item_id: e.item_id,
          compartment: e.compartment,
          tokens: e.token_count,
        })),
      }).catch(() => {
        // Non-fatal: audit logging failure doesn't block operation
      });
    }

    return evicted;
  }

  /**
   * Get eviction candidates for a compartment, sorted by eviction order:
   * - Unpinned before pinned
   * - Lower priority first
   * - Older items first within same priority
   */
  private getEvictionCandidates(compartment: ContextCompartment): CompartmentItem[] {
    const candidates: CompartmentItem[] = [];
    for (const item of this.items.values()) {
      if (item.compartment === compartment && !item.pinned) {
        candidates.push(item);
      }
    }

    candidates.sort((a, b) => {
      // Lower priority evicted first
      if (a.priority !== b.priority) return a.priority - b.priority;
      // Older items evicted first
      return a.added_at.localeCompare(b.added_at);
    });

    return candidates;
  }

  // -----------------------------------------------------------------------
  // Alerts
  // -----------------------------------------------------------------------

  getAlerts(): BudgetAlert[] {
    const alerts: BudgetAlert[] = [];

    const budgets = this.getBudget();
    for (const budget of budgets) {
      const usageRatio = budget.limit > 0 ? budget.used / budget.limit : 0;
      if (usageRatio >= ALERT_THRESHOLD) {
        alerts.push({
          compartment: budget.compartment,
          usage_percentage: budget.percentage,
          used: budget.used,
          limit: budget.limit,
          message: `Compartment '${budget.compartment}' is at ${budget.percentage}% capacity ` +
            `(${budget.used}/${budget.limit} tokens). Consider eviction or budget adjustment.`,
        });
      }
    }

    return alerts;
  }

  // -----------------------------------------------------------------------
  // Eviction log
  // -----------------------------------------------------------------------

  getEvictionLog(limit?: number): EvictionRecord[] {
    const effectiveLimit = limit ?? 50;
    return this.evictionLog.slice(-effectiveLimit);
  }

  // -----------------------------------------------------------------------
  // Full state summary (for context_budget tool)
  // -----------------------------------------------------------------------

  getSummary(): {
    total_budget: number;
    total_used: number;
    total_percentage: number;
    compartments: CompartmentBudget[];
    alerts: BudgetAlert[];
    recent_evictions: number;
  } {
    const budgets = this.getBudget();
    const totalUsed = budgets.reduce((sum, b) => sum + b.used, 0);

    return {
      total_budget: this.totalBudget,
      total_used: totalUsed,
      total_percentage:
        this.totalBudget > 0
          ? Math.round((totalUsed / this.totalBudget) * 10000) / 100
          : 0,
      compartments: budgets,
      alerts: this.getAlerts(),
      recent_evictions: this.evictionLog.length,
    };
  }
}
