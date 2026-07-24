// REQ-S0-003 — exact-token boost (extractRareTokens + computeExactTokenBoost)
// Pure-function tests covering stoplist filtering, length floor, boost cap, regex safety.

import { describe, it, expect } from 'vitest';
import { extractRareTokens, computeExactTokenBoost } from '../../../src/index.ts';

describe('REQ-S0-003 extractRareTokens', () => {
  it('returns tokens of length >=4 not in stoplist', () => {
    expect(extractRareTokens('barman semantic verification')).toEqual([
      'barman',
      'semantic',
      'verification',
    ]);
  });

  it('drops stopwords even when long enough', () => {
    expect(extractRareTokens('that would have been should')).toEqual([]);
  });

  it('drops short tokens (<4)', () => {
    expect(extractRareTokens('a an it on at')).toEqual([]);
  });

  it('lowercases and splits on non-alphanumeric/underscore', () => {
    expect(extractRareTokens('Qdrant-COLD; postgres/tsvector')).toEqual([
      'qdrant',
      'cold',
      'postgres',
      'tsvector',
    ]);
  });

  it('caps at 16 tokens per CISO S0-003-A', () => {
    const big = Array.from({ length: 30 }, (_, i) => `token${i}`).join(' ');
    expect(extractRareTokens(big).length).toBe(16);
  });

  it('handles empty / whitespace-only query', () => {
    expect(extractRareTokens('')).toEqual([]);
    expect(extractRareTokens('   ')).toEqual([]);
  });
});

describe('REQ-S0-003 computeExactTokenBoost', () => {
  it('returns 1 when content is missing', () => {
    expect(computeExactTokenBoost(undefined, ['foo'])).toBe(1);
  });

  it('returns 1 when no rare tokens', () => {
    expect(computeExactTokenBoost('anything goes here', [])).toBe(1);
  });

  it('applies 1.3x boost for one verbatim token', () => {
    expect(computeExactTokenBoost('the qdrant collection', ['qdrant'])).toBeCloseTo(1.3, 5);
  });

  it('caps at 1.5x even with many matches', () => {
    const content = 'alpha beta gamma delta epsilon zeta';
    const tokens = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta'];
    expect(computeExactTokenBoost(content, tokens)).toBe(1.5);
  });

  it('matches whole words only (not substrings)', () => {
    // "cold" should NOT match "colder"
    expect(computeExactTokenBoost('colder weather today', ['cold'])).toBe(1);
  });

  it('is case-insensitive on content', () => {
    expect(computeExactTokenBoost('QDRANT VECTORS', ['qdrant'])).toBeCloseTo(1.3, 5);
  });

  it('does not crash on regex metachars in tokens', () => {
    // extractRareTokens strips these, but compute is defensive — feed raw
    expect(computeExactTokenBoost('hello world', ['a.b*c'])).toBe(1);
  });

  it('truncates content scan to 4096 chars', () => {
    const padding = ' '.repeat(5000);
    const content = padding + 'qdrant';
    // qdrant lives past the truncation window → no boost
    expect(computeExactTokenBoost(content, ['qdrant'])).toBe(1);
  });
});
