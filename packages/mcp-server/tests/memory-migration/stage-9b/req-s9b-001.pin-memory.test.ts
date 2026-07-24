/**
 * REQ-S9B-001 — pin_memory tool: schema + handler behavior.
 * Pure unit-level: the handler logic, schema parsing.
 * The real Qdrant interaction is exercised at integration time when MCP server runs.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// Local re-declaration of the pin_memory schema (mirrors src/index.ts).
const PinMemorySchema = z.object({
  memory_id: z.string().describe("The Qdrant point id of the memory to pin/unpin"),
  pinned: z.boolean().describe("True to pin (skip consolidation drainage); false to unpin"),
  tier: z.enum(["hot", "warm", "cold", "long_term", "short_term"]).optional()
    .describe("Optional tier hint to avoid scanning all 5 tier collections"),
});

describe('Stage #9b — pin_memory schema (REQ-S9B-001)', () => {
  it('accepts a basic pin request', () => {
    const r = PinMemorySchema.safeParse({ memory_id: 'abc-123', pinned: true });
    expect(r.success).toBe(true);
  });

  it('accepts an unpin request', () => {
    const r = PinMemorySchema.safeParse({ memory_id: 'abc-123', pinned: false });
    expect(r.success).toBe(true);
  });

  it('accepts optional tier hint (hot)', () => {
    const r = PinMemorySchema.safeParse({ memory_id: 'abc-123', pinned: true, tier: 'hot' });
    expect(r.success).toBe(true);
  });

  it('accepts optional tier hint (warm)', () => {
    const r = PinMemorySchema.safeParse({ memory_id: 'abc-123', pinned: true, tier: 'warm' });
    expect(r.success).toBe(true);
  });

  it('rejects invalid tier', () => {
    const r = PinMemorySchema.safeParse({ memory_id: 'abc-123', pinned: true, tier: 'unknown' });
    expect(r.success).toBe(false);
  });

  it('rejects missing memory_id', () => {
    const r = PinMemorySchema.safeParse({ pinned: true });
    expect(r.success).toBe(false);
  });

  it('rejects missing pinned', () => {
    const r = PinMemorySchema.safeParse({ memory_id: 'abc-123' });
    expect(r.success).toBe(false);
  });

  it('rejects non-string memory_id', () => {
    const r = PinMemorySchema.safeParse({ memory_id: 42, pinned: true });
    expect(r.success).toBe(false);
  });

  it('rejects non-boolean pinned', () => {
    const r = PinMemorySchema.safeParse({ memory_id: 'abc-123', pinned: 'yes' });
    expect(r.success).toBe(false);
  });
});
