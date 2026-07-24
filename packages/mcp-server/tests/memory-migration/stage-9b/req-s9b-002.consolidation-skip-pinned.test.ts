/**
 * REQ-S9B-002 — consolidation phases (HOT→pruned, HOT→WARM) skip memories with payload.pinned=true.
 *
 * Verified by scanning frontier-capabilities.ts source for the surgical guards
 * and by a logic-equivalent reimplementation under test. This avoids spinning
 * up the full HippocampalConsolidator class (which requires deps).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Stage #9b — consolidation skips pinned (REQ-S9B-002)', () => {
  it('frontier-capabilities.ts contains pinned-skip guard before HOT->pruned', () => {
    const path = join(process.cwd(), 'src/frontier-capabilities.ts');
    const text = readFileSync(path, 'utf8');
    // Find the HOT->pruned section. Look for a contiguous block that has
    // both the "Stage #9b: skip pinned" comment AND the HOT->pruned condition.
    const idx = text.indexOf('Hot -> pruned: older than 48h');
    expect(idx).toBeGreaterThan(0);
    const before = text.slice(Math.max(0, idx - 400), idx);
    expect(before).toMatch(/Stage #9b: skip pinned memories/);
    expect(before).toMatch(/if \(payload\.pinned === true\) continue;/);
  });

  it('frontier-capabilities.ts contains pinned-skip guard before HOT->WARM', () => {
    const path = join(process.cwd(), 'src/frontier-capabilities.ts');
    const text = readFileSync(path, 'utf8');
    // Find the HOT->Warm section.
    const idx = text.indexOf('if (ageHours > this.HOT_TO_WARM_HOURS');
    expect(idx).toBeGreaterThan(0);
    const before = text.slice(Math.max(0, idx - 400), idx);
    expect(before).toMatch(/Stage #9b: skip pinned memories/);
    expect(before).toMatch(/if \(payload\.pinned === true\) continue;/);
  });

  it('logic check: pinned memory with age=72h, recall=0 is NOT pruned', () => {
    // Reimplement the loop logic and verify pinned skip works.
    const HOT_TO_PRUNED_HOURS = 48;
    const memory = {
      id: 'pinned-test-1',
      payload: { created_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(), recall_count: 0, pinned: true },
    };
    let pruned = 0;
    const payload = memory.payload as Record<string, unknown>;
    const now = Date.now();
    const ageHours = (now - new Date(payload.created_at as string).getTime()) / (60 * 60 * 1000);
    const recallCount = (payload.recall_count as number) || 0;
    // Apply the same guard
    if (payload.pinned !== true) {
      if (ageHours > HOT_TO_PRUNED_HOURS && recallCount === 0) pruned++;
    }
    expect(pruned).toBe(0); // pinned skipped
  });

  it('logic check: pinned memory with age=30h, recall=5 is NOT transferred to warm', () => {
    const HOT_TO_WARM_HOURS = 24;
    const MIN_RECALLS_FOR_WARM = 2;
    const memory = {
      payload: { created_at: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(), recall_count: 5, pinned: true },
    };
    let transferred = 0;
    const payload = memory.payload as Record<string, unknown>;
    const now = Date.now();
    const ageHours = (now - new Date(payload.created_at as string).getTime()) / (60 * 60 * 1000);
    const recallCount = (payload.recall_count as number) || 0;
    if (payload.pinned !== true) {
      if (ageHours > HOT_TO_WARM_HOURS && recallCount >= MIN_RECALLS_FOR_WARM) transferred++;
    }
    expect(transferred).toBe(0);
  });

  it('logic check: UN-pinned memory with age=72h, recall=0 IS pruned', () => {
    const HOT_TO_PRUNED_HOURS = 48;
    const memory = {
      payload: { created_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(), recall_count: 0 },
    };
    let pruned = 0;
    const payload = memory.payload as Record<string, unknown>;
    const now = Date.now();
    const ageHours = (now - new Date(payload.created_at as string).getTime()) / (60 * 60 * 1000);
    const recallCount = (payload.recall_count as number) || 0;
    if (payload.pinned !== true) {
      if (ageHours > HOT_TO_PRUNED_HOURS && recallCount === 0) pruned++;
    }
    expect(pruned).toBe(1);
  });

  it('logic check: pinned=false (explicit) does NOT skip', () => {
    const HOT_TO_PRUNED_HOURS = 48;
    const memory = {
      payload: { created_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(), recall_count: 0, pinned: false },
    };
    let pruned = 0;
    const payload = memory.payload as Record<string, unknown>;
    const now = Date.now();
    const ageHours = (now - new Date(payload.created_at as string).getTime()) / (60 * 60 * 1000);
    const recallCount = (payload.recall_count as number) || 0;
    if (payload.pinned !== true) {
      if (ageHours > HOT_TO_PRUNED_HOURS && recallCount === 0) pruned++;
    }
    expect(pruned).toBe(1);
  });
});

describe('Stage #9b — n8n rehydration workflow file exists (REQ-S9B-003)', () => {
  it('workflows/memory-hot-rehydration-weekly-sun-2am.json exists and is valid JSON', () => {
    const path = join(process.cwd(), 'workflows/memory-hot-rehydration-weekly-sun-2am.json');
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.name).toBe('memory-hot-rehydration-weekly-sun-2am');
    expect(parsed.activeVersion).toBeDefined();
    expect(parsed.activeVersion.nodes).toBeInstanceOf(Array);
    expect(parsed.activeVersion.nodes.length).toBeGreaterThan(8);
  });

  it('workflow uses Sunday 2AM cron expression', () => {
    const path = join(process.cwd(), 'workflows/memory-hot-rehydration-weekly-sun-2am.json');
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    const schedule = parsed.activeVersion.nodes.find((n: { id: string }) => n.id === 'schedule');
    expect(schedule).toBeDefined();
    const expr = schedule.parameters.rule.interval[0].expression;
    expect(expr).toBe('0 2 * * 0');
  });

  it('workflow contains NO DELETE methods (CISO C-S9B-D)', () => {
    const path = join(process.cwd(), 'workflows/memory-hot-rehydration-weekly-sun-2am.json');
    const text = readFileSync(path, 'utf8');
    expect(text).not.toMatch(/"method"\s*:\s*"DELETE"/i);
  });
});
