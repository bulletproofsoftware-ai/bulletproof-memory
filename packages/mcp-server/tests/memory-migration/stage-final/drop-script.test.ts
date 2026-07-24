/**
 * Sub-task B — drop script unit tests (no Qdrant calls; tests the script's
 * static safety properties).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SCRIPT_PATH = join(
  process.cwd(),
  "scripts/migrations/stage-final/drop-qdrant-collections.ts"
);

describe("Sub-task B — drop-qdrant-collections script (static)", () => {
  let script: string;
  it("loads", () => {
    script = readFileSync(SCRIPT_PATH, "utf8");
    expect(script.length).toBeGreaterThan(1000);
  });

  it("allowlist contains exactly 16 collections", () => {
    script = readFileSync(SCRIPT_PATH, "utf8");
    const matches = script.match(/\{\s*collection:\s*"[^"]+"/g) || [];
    expect(matches.length).toBe(16);
  });

  it("allowlist includes all 12 Stage-#8 collections", () => {
    script = readFileSync(SCRIPT_PATH, "utf8");
    const required = [
      "audit_log",
      "forensic_events",
      "guardian_audit_log",
      "benchmark_runs",
      "benchmarks",
      "consolidation_cycles",
      "agent_identity_sessions",
      "delegation_tokens",
      "nhi_lifecycle",
      "nhi_transitions",
      "compliance_dashboard",
      "compliance_trends",
    ];
    for (const name of required) {
      expect(script).toContain(`collection: "${name}"`);
    }
  });

  it("allowlist includes Stage-#13 collections", () => {
    script = readFileSync(SCRIPT_PATH, "utf8");
    expect(script).toContain(`collection: "episodes"`);
    expect(script).toContain(`collection: "session_transcripts"`);
  });

  it("allowlist includes Stage-#11 memories_cold", () => {
    script = readFileSync(SCRIPT_PATH, "utf8");
    expect(script).toContain(`collection: "memories_cold"`);
  });

  it("allowlist includes Stage-#12 memory_links", () => {
    script = readFileSync(SCRIPT_PATH, "utf8");
    expect(script).toContain(`collection: "memory_links"`);
  });

  it("does NOT include forbidden collections (memories_hot, memories_warm, claude_memories)", () => {
    script = readFileSync(SCRIPT_PATH, "utf8");
    expect(script).not.toContain(`collection: "memories_hot"`);
    expect(script).not.toContain(`collection: "memories_warm"`);
    expect(script).not.toContain(`collection: "claude_memories"`);
  });

  it("enforces allowlist length check at module load", () => {
    script = readFileSync(SCRIPT_PATH, "utf8");
    expect(script).toContain("ALLOWLIST.length !== 16");
  });

  it("uses HTTP DELETE method (not POST or PATCH)", () => {
    script = readFileSync(SCRIPT_PATH, "utf8");
    expect(script).toContain(`method: "DELETE"`);
    expect(script).not.toMatch(/method:\s*"PUT"/);
    expect(script).not.toMatch(/method:\s*"PATCH"/);
  });

  it("verifies 404 after delete", () => {
    script = readFileSync(SCRIPT_PATH, "utf8");
    expect(script).toContain("qdrantVerifyGone");
    expect(script).toMatch(/res\.status\s*===\s*404/);
  });

  it("audit_log table identifier is hardcoded and not user-controlled", () => {
    script = readFileSync(SCRIPT_PATH, "utf8");
    // table identifier comes from the static ALLOWLIST records — no user input.
    expect(script).toContain(`pg_table: "operational.audit_log"`);
    // SQL identifier regex check
    expect(script).toContain("/^[a-z_][a-z0-9_]*\\.[a-z_][a-z0-9_]*$/i");
  });

  it("does not log api-key value to stdout/log", () => {
    script = readFileSync(SCRIPT_PATH, "utf8");
    expect(script).not.toMatch(/logLine\([^)]*api-key/);
    expect(script).not.toMatch(/logLine\([^)]*apiKey/);
    expect(script).not.toMatch(/logLine\([^)]*QDRANT_API_KEY/);
  });

  it("audit-log insert uses parameterized query", () => {
    script = readFileSync(SCRIPT_PATH, "utf8");
    expect(script).toContain("INSERT INTO operational.audit_log");
    expect(script).toMatch(/\$1.*\$5/s);
  });
});
