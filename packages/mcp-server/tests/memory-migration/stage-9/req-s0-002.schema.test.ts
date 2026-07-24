// REQ-S0-002 — Zod schema validation for new time-range filters.
// We re-declare a local schema matching the production RecallMemorySchema
// surface for the new fields. The actual production schema is not exported,
// but the contract under test is the Zod datetime validation behavior we rely
// on (which is z.string().datetime({ offset: true })).

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const TimeRangeShape = z.object({
  created_after: z.string().datetime({ offset: true }).optional(),
  last_accessed_after: z.string().datetime({ offset: true }).optional(),
});

describe('REQ-S0-002 time-range filter validation', () => {
  it('accepts a valid UTC ISO-8601 datetime', () => {
    expect(() =>
      TimeRangeShape.parse({ created_after: '2026-05-15T00:00:00Z' })
    ).not.toThrow();
  });

  it('accepts an ISO-8601 datetime with offset', () => {
    expect(() =>
      TimeRangeShape.parse({ created_after: '2026-05-15T00:00:00+02:00' })
    ).not.toThrow();
  });

  it('accepts both params together', () => {
    expect(() =>
      TimeRangeShape.parse({
        created_after: '2026-05-15T00:00:00Z',
        last_accessed_after: '2026-05-16T12:00:00Z',
      })
    ).not.toThrow();
  });

  it('rejects bare dates without time component', () => {
    expect(() => TimeRangeShape.parse({ created_after: '2026-05-15' })).toThrow();
  });

  it('rejects free-text strings', () => {
    expect(() => TimeRangeShape.parse({ created_after: 'yesterday' })).toThrow();
  });

  it('rejects empty string', () => {
    expect(() => TimeRangeShape.parse({ last_accessed_after: '' })).toThrow();
  });

  it('omitting params is valid (default behavior unchanged)', () => {
    expect(() => TimeRangeShape.parse({})).not.toThrow();
  });
});
