# Security Scan Report: bulletproof-memory

**Scan ID:** `89434999-3fbf-4468-b2b0-3744a1a398c0`
**Date:** 2026-07-24T19:11:35.814Z
**Score:** 826/1000 (good)
**Branch:** main | **Commit:** `N/A`
**Profile:** standard

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 137 |
| Low | 163 |
| Info | 6 |
| **Total (open)** | **306** |

> **Note:** The counts above reflect _open_ findings only.
> 1 scanner(s) were skipped — see "Skipped Scanners" below.

## Scanners Executed

| Scanner | Status | Findings | Duration | Notes |
|---------|--------|----------|----------|-------|
| trivy | pass | 155 | 1.6s |  |
| gitleaks | pass | 0 | 0.6s |  |
| opengrep | pass | 20 | 14.5s |  |
| checkov | pass | 0 | 2.2s |  |
| grype | pass | 0 | 1.8s |  |
| syft | pass | 10 | 1.5s |  |
| package-validator | skipped | 0 | 0.0s |  |
| oxlint | pass | 129 | 0.0s |  |
| ruff | pass | 0 | 0.0s |  |
| actionlint | pass | 0 | 0.0s |  |
| jscpd | pass | 0 | 0.0s |  |
| typos | fail | 0 | 0.0s | _error: Cannot read properties of undefined (reading 'length')_ |
| _file_inventory | pass | 0 | 0.0s |  |

## Medium Findings (137)

### [MEDIUM] Variable 'filter' is declared but never used. Unused variables should start with a '_'.

- **File:** `packages/mcp-server/src/red-team-agent.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Variable 'filter' is declared but never used. Unused variables should start with a '_'.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Variable 'filter' is declared but never used. Unused variables should start with a '_'.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Identifier 'createHash' is imported but never used.

- **File:** `packages/mcp-server/src/red-team-agent.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Identifier 'createHash' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Identifier 'createHash' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Parameter 'composite' is declared but never used. Unused parameters should start with a '_'.

- **File:** `packages/mcp-server/src/advanced-memory.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Parameter 'composite' is declared but never used. Unused parameters should start with a '_'.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Parameter 'composite' is declared but never used. Unused parameters should start with a '_'.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Identifier 'randomBytes' is imported but never used.

- **File:** `packages/mcp-server/src/advanced-memory.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Identifier 'randomBytes' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Identifier 'randomBytes' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Identifier 'verify' is imported but never used.

- **File:** `packages/mcp-server/src/advanced-memory.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Identifier 'verify' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Identifier 'verify' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Identifier 'sign' is imported but never used.

- **File:** `packages/mcp-server/src/advanced-memory.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Identifier 'sign' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Identifier 'sign' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Variable 'nonAbstainVotes' is declared but never used. Unused variables should start with a '_'.

- **File:** `packages/mcp-server/src/multi-agent-coordination.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Variable 'nonAbstainVotes' is declared but never used. Unused variables should start with a '_'.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Variable 'nonAbstainVotes' is declared but never used. Unused variables should start with a '_'.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Variable 'hasWriteLock' is declared but never used. Unused variables should start with a '_'.

- **File:** `packages/mcp-server/src/multi-agent-coordination.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Variable 'hasWriteLock' is declared but never used. Unused variables should start with a '_'.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Variable 'hasWriteLock' is declared but never used. Unused variables should start with a '_'.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Variable 'locks' is declared but never used. Unused variables should start with a '_'.

- **File:** `packages/mcp-server/src/multi-agent-coordination.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Variable 'locks' is declared but never used. Unused variables should start with a '_'.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Variable 'locks' is declared but never used. Unused variables should start with a '_'.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Variable 'now' is declared but never used. Unused variables should start with a '_'.

- **File:** `packages/mcp-server/src/multi-agent-coordination.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Variable 'now' is declared but never used. Unused variables should start with a '_'.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Variable 'now' is declared but never used. Unused variables should start with a '_'.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Catch parameter '_err' is caught but never used.

- **File:** `packages/mcp-server/src/multi-agent-coordination.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Catch parameter '_err' is caught but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Catch parameter '_err' is caught but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Variable 'key' is declared but never used. Unused variables should start with a '_'.

- **File:** `packages/mcp-server/src/multi-agent-coordination.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Variable 'key' is declared but never used. Unused variables should start with a '_'.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Variable 'key' is declared but never used. Unused variables should start with a '_'.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Identifier 'createHash' is imported but never used.

- **File:** `packages/mcp-server/src/multi-agent-coordination.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Identifier 'createHash' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Identifier 'createHash' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Variable 'avgDuration' is declared but never used. Unused variables should start with a '_'.

- **File:** `packages/mcp-server/src/frontier-capabilities.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Variable 'avgDuration' is declared but never used. Unused variables should start with a '_'.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Variable 'avgDuration' is declared but never used. Unused variables should start with a '_'.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Catch parameter 'err' is caught but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Catch parameter 'err' is caught but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Catch parameter 'err' is caught but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Variable 'tier' is declared but never used. Unused variables should start with a '_'.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Variable 'tier' is declared but never used. Unused variables should start with a '_'.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Variable 'tier' is declared but never used. Unused variables should start with a '_'.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type alias 'TemporalClassT' is declared but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type alias 'TemporalClassT' is declared but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type alias 'TemporalClassT' is declared but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Identifier 'mirrorBenchmarkRuns' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Identifier 'mirrorBenchmarkRuns' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Identifier 'mirrorBenchmarkRuns' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Identifier 'mirrorNhiTransitions' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Identifier 'mirrorNhiTransitions' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Identifier 'mirrorNhiTransitions' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Identifier 'mirrorNhiLifecycle' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Identifier 'mirrorNhiLifecycle' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Identifier 'mirrorNhiLifecycle' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Identifier 'mirrorDelegationTokens' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Identifier 'mirrorDelegationTokens' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Identifier 'mirrorDelegationTokens' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Identifier 'mirrorAgentIdentitySessions' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Identifier 'mirrorAgentIdentitySessions' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Identifier 'mirrorAgentIdentitySessions' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Identifier 'mirrorConsolidationCycles' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Identifier 'mirrorConsolidationCycles' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Identifier 'mirrorConsolidationCycles' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'MetaSelfAssessment' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'MetaSelfAssessment' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'MetaSelfAssessment' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'EcosystemAssessment' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'EcosystemAssessment' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'EcosystemAssessment' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'TemporalTask' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'TemporalTask' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'TemporalTask' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'GanttChart' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'GanttChart' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'GanttChart' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'TemporalPlan' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'TemporalPlan' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'TemporalPlan' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'ImprovementMetrics' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'ImprovementMetrics' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'ImprovementMetrics' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'ABTestResult' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'ABTestResult' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'ABTestResult' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'OptimizationProposal' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'OptimizationProposal' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'OptimizationProposal' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'WorkflowAnalysis' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'WorkflowAnalysis' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'WorkflowAnalysis' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'ConsolidationStatus' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'ConsolidationStatus' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'ConsolidationStatus' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'TierTransferRecord' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'TierTransferRecord' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'TierTransferRecord' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'ConsolidationCycle' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'ConsolidationCycle' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'ConsolidationCycle' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'ImpactAssessment' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'ImpactAssessment' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'ImpactAssessment' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'SemanticDiffResult' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'SemanticDiffResult' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'SemanticDiffResult' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'PromotionResult' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'PromotionResult' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'PromotionResult' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'BehaviorComparison' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'BehaviorComparison' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'BehaviorComparison' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'TestInteractionResult' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'TestInteractionResult' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'TestInteractionResult' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'HotReloadResult' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'HotReloadResult' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'HotReloadResult' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'DevInstance' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'DevInstance' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'DevInstance' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'ModelCoverage' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'ModelCoverage' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'ModelCoverage' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'PredictionResult' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'PredictionResult' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'PredictionResult' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'AgentDiscoveryResult' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'AgentDiscoveryResult' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'AgentDiscoveryResult' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'A2ATaskResult' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'A2ATaskResult' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'A2ATaskResult' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'A2AAgentCard' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'A2AAgentCard' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'A2AAgentCard' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'DecayResult' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'DecayResult' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'DecayResult' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'TrailGuidance' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'TrailGuidance' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'TrailGuidance' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

### [MEDIUM] Type 'PheromoneTrail' is imported but never used.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** oxlint
- **Rule:** `OXLINT-UNKNOWN`

**What's wrong:** Type 'PheromoneTrail' is imported but never used.

**How to fix:** Review this finding and apply the appropriate fix based on the description: Type 'PheromoneTrail' is imported but never used.

**Action:** Plan to fix this issue in your next sprint or release.

---

> ... and 87 more medium findings

## Low Findings (163)

- **SBOM-LICENSE-UNKNOWN**: Unknown License: uvicorn@0.34.2 (`/packages/dashboard/app/requirements.txt`)
- **SBOM-LICENSE-UNKNOWN**: Unknown License: pyyaml@6.0.2 (`/packages/dashboard/app/requirements.txt`)
- **SBOM-LICENSE-UNKNOWN**: Unknown License: python-multipart@0.0.32 (`/packages/dashboard/app/requirements.txt`)
- **SBOM-LICENSE-UNKNOWN**: Unknown License: jinja2@3.1.6 (`/packages/dashboard/app/requirements.txt`)
- **SBOM-LICENSE-UNKNOWN**: Unknown License: itsdangerous@2.2.0 (`/packages/dashboard/app/requirements.txt`)
- **SBOM-LICENSE-UNKNOWN**: Unknown License: httpx@0.28.1 (`/packages/dashboard/app/requirements.txt`)
- **SBOM-LICENSE-UNKNOWN**: Unknown License: fastapi@0.115.12 (`/packages/dashboard/app/requirements.txt`)
- **SBOM-LICENSE-UNKNOWN**: Unknown License: asyncpg@0.30.0 (`/packages/dashboard/app/requirements.txt`)
- **SBOM-LICENSE-UNKNOWN**: Unknown License: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 (`/.github/workflows/ci.yml`)
- **SBOM-LICENSE-UNKNOWN**: Unknown License: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 (`/.github/workflows/ci.yml`)
- **javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring**: unsafe-formatstring (`packages/mcp-server/src/guardrail-proofs.ts:436`)
- **LICENSE-Apache-2.0**: License Compliance: Apache-2.0 in  (`packages/mcp-server/LICENSE`)
- **LICENSE-Apache-2.0**: License Compliance: Apache-2.0 in  (`packages/dashboard/LICENSE`)
- **LICENSE-Apache-2.0**: License Compliance: Apache-2.0 in  (`LICENSE`)
- **LICENSE-Apache-2.0**: License Compliance: Apache-2.0 in python-multipart (`packages/dashboard/app/requirements.txt`)
- **LICENSE-BSD-3-Clause**: License Compliance: BSD-3-Clause in jinja2 (`packages/dashboard/app/requirements.txt`)
- **LICENSE-BSD-3-Clause**: License Compliance: BSD-3-Clause in itsdangerous (`packages/dashboard/app/requirements.txt`)
- **LICENSE-BSD-3-Clause**: License Compliance: BSD-3-Clause in httpx (`packages/dashboard/app/requirements.txt`)
- **LICENSE-ISC**: License Compliance: ISC in zod-to-json-schema (`packages/mcp-server/package-lock.json`)
- **LICENSE-MIT**: License Compliance: MIT in xtend (`packages/mcp-server/package-lock.json`)
- **LICENSE-ISC**: License Compliance: ISC in wrappy (`packages/mcp-server/package-lock.json`)
- **LICENSE-ISC**: License Compliance: ISC in which (`packages/mcp-server/package-lock.json`)
- **LICENSE-MIT**: License Compliance: MIT in vary (`packages/mcp-server/package-lock.json`)
- **LICENSE-MIT**: License Compliance: MIT in util-deprecate (`packages/mcp-server/package-lock.json`)
- **LICENSE-MIT**: License Compliance: MIT in unpipe (`packages/mcp-server/package-lock.json`)
- **LICENSE-MIT**: License Compliance: MIT in type-is (`packages/mcp-server/package-lock.json`)
- **LICENSE-Apache-2.0**: License Compliance: Apache-2.0 in tunnel-agent (`packages/mcp-server/package-lock.json`)
- **LICENSE-0BSD**: License Compliance: 0BSD in tslib (`packages/mcp-server/package-lock.json`)
- **LICENSE-MIT**: License Compliance: MIT in toidentifier (`packages/mcp-server/package-lock.json`)
- **LICENSE-MIT**: License Compliance: MIT in tar-stream (`packages/mcp-server/package-lock.json`)
- **LICENSE-MIT**: License Compliance: MIT in tar-fs (`packages/mcp-server/package-lock.json`)
- **LICENSE-MIT**: License Compliance: MIT in strip-json-comments (`packages/mcp-server/package-lock.json`)
- **LICENSE-MIT**: License Compliance: MIT in string_decoder (`packages/mcp-server/package-lock.json`)
- **LICENSE-MIT**: License Compliance: MIT in statuses (`packages/mcp-server/package-lock.json`)
- **LICENSE-ISC**: License Compliance: ISC in split2 (`packages/mcp-server/package-lock.json`)
- **LICENSE-MIT**: License Compliance: MIT in simple-get (`packages/mcp-server/package-lock.json`)
- **LICENSE-MIT**: License Compliance: MIT in simple-concat (`packages/mcp-server/package-lock.json`)
- **LICENSE-MIT**: License Compliance: MIT in side-channel-weakmap (`packages/mcp-server/package-lock.json`)
- **LICENSE-MIT**: License Compliance: MIT in side-channel-map (`packages/mcp-server/package-lock.json`)
- **LICENSE-MIT**: License Compliance: MIT in side-channel-list (`packages/mcp-server/package-lock.json`)
- **LICENSE-MIT**: License Compliance: MIT in side-channel (`packages/mcp-server/package-lock.json`)
- **LICENSE-MIT**: License Compliance: MIT in shebang-regex (`packages/mcp-server/package-lock.json`)
- **LICENSE-MIT**: License Compliance: MIT in shebang-command (`packages/mcp-server/package-lock.json`)
- **LICENSE-ISC**: License Compliance: ISC in setprototypeof (`packages/mcp-server/package-lock.json`)
- **LICENSE-MIT**: License Compliance: MIT in serve-static (`packages/mcp-server/package-lock.json`)
- **LICENSE-MIT**: License Compliance: MIT in send (`packages/mcp-server/package-lock.json`)
- **LICENSE-ISC**: License Compliance: ISC in semver (`packages/mcp-server/package-lock.json`)
- **LICENSE-MIT**: License Compliance: MIT in safer-buffer (`packages/mcp-server/package-lock.json`)
- **LICENSE-MIT**: License Compliance: MIT in safe-buffer (`packages/mcp-server/package-lock.json`)
- **LICENSE-Apache-2.0**: License Compliance: Apache-2.0 in rxjs (`packages/mcp-server/package-lock.json`)

> ... and 113 more low findings

## Skipped Scanners (1)

Scanners that did not run on this scan, with the reason why and how to enable them.

| Scanner | Reason | How to enable |
|---------|--------|---------------|
| `package-validator` | unknown | _(no hint)_ |

## Recommendations

1. Update 152 vulnerable dependency/dependencies -- run `npm audit fix` or equivalent

---
*Generated by Code Hardener v0.1.0 | 2026-07-24T19:13:05.032Z*