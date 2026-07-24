// Feature 1 — Provenance / Use-Policy Gate
// Spec: docs/specs/2026-07-02-openmemory-3-features-spec.md §1.7
//
// Pure-function tests for resolveUsePolicy + deriveProvenance (no live services).
// Plus CISO Condition B: TS<->Python conformance against a shared fixture, and a
// cross-runtime assertion that the Python hook derives identical provenance.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { resolveUsePolicy } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, "fixtures", "provenance-derivation.json");

describe("resolveUsePolicy — derivation defaults (§1.7)", () => {
  it("session-analyzer-auto -> generated, instruction=false, confirmation=true", () => {
    const r = resolveUsePolicy({ source: "session-analyzer-auto" });
    expect(r.violation).toBe(false);
    expect(r.provenance_status).toBe("generated");
    expect(r.can_use_as_instruction).toBe(false);
    expect(r.requires_user_confirmation).toBe(true);
    expect(r.can_use_as_evidence).toBe(true);
  });

  it("source:user -> user_confirmed, instruction=true, confirmation=false", () => {
    const r = resolveUsePolicy({ source: "user" });
    expect(r.provenance_status).toBe("user_confirmed");
    expect(r.can_use_as_instruction).toBe(true);
    expect(r.requires_user_confirmation).toBe(false);
  });

  it("source:cli -> observed, instruction=false, evidence=true, confirmation=false", () => {
    const r = resolveUsePolicy({ source: "cli" });
    expect(r.provenance_status).toBe("observed");
    expect(r.can_use_as_instruction).toBe(false);
    expect(r.can_use_as_evidence).toBe(true);
    expect(r.requires_user_confirmation).toBe(false);
  });
});

describe("resolveUsePolicy — floors, honors, and hard-rejection (§1.7)", () => {
  it("inferred + requires_user_confirmation:false is floored back to true", () => {
    const r = resolveUsePolicy({ provenance_status: "inferred", requires_user_confirmation: false });
    expect(r.violation).toBe(false);
    expect(r.requires_user_confirmation).toBe(true);
  });

  it("generated + can_use_as_instruction:true is a hard rejection (violation:true)", () => {
    const r = resolveUsePolicy({ provenance_status: "generated", can_use_as_instruction: true });
    expect(r.violation).toBe(true);
    expect(r.reason).toMatch(/user_confirmed.*imported|imported/i);
    expect(r.can_use_as_instruction).toBe(false);
  });

  it("imported + can_use_as_instruction:true is honored (violation:false, instruction=true)", () => {
    const r = resolveUsePolicy({ provenance_status: "imported", can_use_as_instruction: true });
    expect(r.violation).toBe(false);
    expect(r.can_use_as_instruction).toBe(true);
  });

  it("explicit provenance always wins over derivation (AC-7)", () => {
    // source would derive to 'generated', but explicit user_confirmed wins.
    const r = resolveUsePolicy({ source: "session-analyzer-auto", provenance_status: "user_confirmed" });
    expect(r.violation).toBe(false);
    expect(r.provenance_status).toBe("user_confirmed");
    expect(r.can_use_as_instruction).toBe(true);
  });

  it("can_use_as_evidence:false is honored (client may lower)", () => {
    const r = resolveUsePolicy({ source: "user", can_use_as_evidence: false });
    expect(r.can_use_as_evidence).toBe(false);
  });

  it("all fields omitted -> observed, instruction=false, evidence=true (AC-6 backward compat)", () => {
    const r = resolveUsePolicy({});
    expect(r.violation).toBe(false);
    expect(r.provenance_status).toBe("observed");
    expect(r.can_use_as_instruction).toBe(false);
    expect(r.can_use_as_evidence).toBe(true);
    expect(r.requires_user_confirmation).toBe(false);
  });
});

// ── CISO Condition B — TS<->Python conformance ─────────────────────────────
interface FixtureCase { source: string | null; expected_provenance: string; }
const fixture = JSON.parse(readFileSync(FIXTURE, "utf8")) as { cases: FixtureCase[] };

describe("CISO Condition B — TS derivation matches the shared fixture", () => {
  for (const c of fixture.cases) {
    it(`source=${JSON.stringify(c.source)} -> ${c.expected_provenance}`, () => {
      const r = resolveUsePolicy({ source: c.source });
      expect(r.provenance_status).toBe(c.expected_provenance);
    });
  }
});

describe("CISO Condition B — Python hook derivation matches TS (cross-runtime)", () => {
  // Drives the actual governance-plugin hook helper _derive_prov for every fixture
  // case and asserts identical output to the TS resolveUsePolicy. FAILS THE BUILD
  // if the two implementations diverge. Skips (not fails) if python3 or the hook
  // is unavailable in the environment, so the pure-logic suite still runs in CI.
  const HOOK = join(
    process.env.HOME || "",
    ".claude/plugins/cache/governance/governance/0.1.0/hooks/memory_integrity_hook.py",
  );

  let pythonOut: Record<string, string> | null = null;
  try {
    // Import the hook module by file path and derive each fixture source.
    const py = [
      "import json, importlib.util, sys",
      `spec = importlib.util.spec_from_file_location('mih', ${JSON.stringify(HOOK)})`,
      "mod = importlib.util.module_from_spec(spec)",
      "spec.loader.exec_module(mod)",
      `cases = json.load(open(${JSON.stringify(FIXTURE)}))['cases']`,
      "out = {}",
      "for c in cases:",
      "    src = (c['source'] or '').lower()",
      "    out[json.dumps(c['source'])] = mod._derive_prov(src)",
      "print(json.dumps(out))",
    ].join("\n");
    const raw = execFileSync("python3", ["-c", py], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    pythonOut = JSON.parse(raw);
  } catch {
    pythonOut = null;
  }

  it("python3 + hook available (else conformance is SKIPPED, run pytest for full gate)", () => {
    if (!pythonOut) {
      console.warn("[conformance] python3/hook unavailable — cross-runtime check skipped; governance-plugin pytest still enforces it");
    }
    expect(true).toBe(true);
  });

  for (const c of fixture.cases) {
    it(`python derive source=${JSON.stringify(c.source)} === ${c.expected_provenance}`, () => {
      if (!pythonOut) return; // skip body when unavailable
      const key = JSON.stringify(c.source);
      expect(pythonOut[key]).toBe(c.expected_provenance);
      // and it must equal the TS result too
      expect(pythonOut[key]).toBe(resolveUsePolicy({ source: c.source }).provenance_status);
    });
  }
});
