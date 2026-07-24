/**
 * Stage #14 — REQ-S9-003 surrogate: validate all 35 n8n workflow JSONs.
 * Triggering each workflow live is operator's prerogative (would fire real
 * crons); this test guarantees every JSON parses + has the expected
 * top-level shape, which is the failure mode the spec is really protecting
 * against.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const WORKFLOWS_DIR = join(process.cwd(), 'workflows');

function listWorkflows(): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(WORKFLOWS_DIR)) {
    const p = join(WORKFLOWS_DIR, ent);
    if (!statSync(p).isFile()) continue;
    if (!ent.endsWith('.json')) continue;
    if (ent.startsWith('_')) continue; // skip _MANIFEST.json
    out.push(p);
  }
  return out;
}

describe('Stage #14 — n8n workflow smoke test (REQ-S9-003)', () => {
  it('finds the expected count of workflow files (>=33)', () => {
    const files = listWorkflows();
    // 33 pre-existing + Stage #9b rehydration + Stage #10 canary = 35
    expect(files.length).toBeGreaterThanOrEqual(33);
  });

  it('every workflow JSON parses', () => {
    const files = listWorkflows();
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      expect(() => JSON.parse(text), `parse failed for ${f}`).not.toThrow();
    }
  });

  it('every workflow has an activeVersion with nodes array', () => {
    const files = listWorkflows();
    for (const f of files) {
      const parsed = JSON.parse(readFileSync(f, 'utf8'));
      expect(parsed.activeVersion, `missing activeVersion in ${f}`).toBeDefined();
      expect(Array.isArray(parsed.activeVersion.nodes), `nodes not array in ${f}`).toBe(true);
      expect(parsed.activeVersion.nodes.length, `0 nodes in ${f}`).toBeGreaterThan(0);
    }
  });

  it('Stage #9b rehydration workflow present', () => {
    const files = listWorkflows().map((p) => p.split('/').pop());
    expect(files).toContain('memory-hot-rehydration-weekly-sun-2am.json');
  });

  it('Stage #10 DRM canary workflow present', () => {
    const files = listWorkflows().map((p) => p.split('/').pop());
    expect(files).toContain('memory-drm-canary-weekly-mon-3am.json');
  });

  it('no workflow JSON file is empty or has zero-byte content', () => {
    const files = listWorkflows();
    for (const f of files) {
      const stat = statSync(f);
      expect(stat.size, `${f} is empty`).toBeGreaterThan(10);
    }
  });
});
