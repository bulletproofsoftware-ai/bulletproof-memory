# Security Scan Report: bulletproof-memory

**Scan ID:** `f66b0d0a-0973-4f14-9f87-b2cf0d7870d8`
**Date:** 2026-07-24T18:36:35.338Z
**Score:** 511/1000 (poor)
**Branch:** main | **Commit:** `N/A`
**Profile:** comprehensive

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 190 |
| Medium | 402 |
| Low | 187 |
| Info | 20 |
| **Total (open)** | **799** |

> **Note:** The counts above reflect _open_ findings only.
> 38 scanner(s) were skipped — see "Skipped Scanners" below.

## Scanners Executed

| Scanner | Status | Findings | Duration | Notes |
|---------|--------|----------|----------|-------|
| opengrep | pass | 17 | 15.5s |  |
| bandit | pass | 19 | 0.2s |  |
| gosec | skipped | 0 | 0.0s | _skipped: no_matching_files_ |
| eslint-security | pass | 0 | 0.1s |  |
| pmd | skipped | 0 | 0.0s | _skipped: no_matching_files_ |
| nuclei | skipped | 0 | 0.0s | _skipped: no_target_url_ |
| zap | skipped | 0 | 0.0s | _skipped: no_target_url_ |
| trivy | pass | 162 | 1.5s |  |
| grype | pass | 8 | 1.0s |  |
| gitleaks | pass | 0 | 0.3s |  |
| checkov | pass | 0 | 0.9s |  |
| newman | skipped | 0 | 0.0s | _skipped: no_postman_collection_ |
| restler | skipped | 0 | 0.0s | _skipped: no_api_spec_ |
| schemathesis | skipped | 0 | 0.0s | _skipped: no_api_spec_ |
| keploy | pass | 158 | 0.0s |  |
| syft | pass | 8 | 1.6s |  |
| cosign | skipped | 0 | 0.0s | _skipped: no_container_image_ |
| dockle | pass | 1 | 0.0s |  |
| hadolint | pass | 3 | 0.0s |  |
| opa | skipped | 0 | 0.0s | _skipped: no_matching_files_ |
| conftest | skipped | 0 | 0.0s | _skipped: no_policy_dir_ |
| package-validator | skipped | 0 | 0.0s |  |
| scancode | skipped | 0 | 0.4s | _skipped: tool_not_installed_ |
| stryker | skipped | 0 | 0.0s | _skipped: no_matching_files_ |
| mutmut | skipped | 0 | 0.0s | _skipped: no_python_project_ |
| pitest | skipped | 0 | 0.0s | _skipped: no_java_project_ |
| deepeval | pass | 196 | 0.1s |  |
| jest | skipped | 0 | 0.0s | _skipped: no_matching_files_ |
| pytest | pass | 0 | 1.4s |  |
| aflpp | skipped | 0 | 0.0s | _skipped: no_c_project_ |
| threatmodel | pass | 77 | 0.1s |  |
| knip | skipped | 0 | 0.0s | _skipped: no_matching_files_ |
| oxlint | pass | 129 | 0.0s |  |
| jscpd | pass | 0 | 0.0s |  |
| ruff | pass | 0 | 0.0s |  |
| phpstan | skipped | 0 | 0.0s | _skipped: no_matching_files_ |
| typos | pass | 18 | 0.0s |  |
| libyear | skipped | 0 | 0.0s |  |
| actionlint | skipped | 0 | 0.0s | _skipped: no_matching_files_ |
| poutine | skipped | 0 | 0.0s | _skipped: no_ci_config_ |
| scorecard | pass | 10 | 0.7s |  |
| kubeconform | skipped | 0 | 0.0s | _skipped: no_k8s_manifests_ |
| kube-linter | skipped | 0 | 0.0s | _skipped: no_k8s_manifests_ |
| cargo-audit | skipped | 0 | 0.0s | _skipped: no_rust_project_ |
| spectral | skipped | 0 | 0.0s | _skipped: no_api_spec_ |
| dotenv-linter | skipped | 0 | 0.0s | _skipped: no_matching_files_ |
| license-finder | skipped | 0 | 0.0s | _skipped: no_matching_files_ |
| cdxgen | skipped | 0 | 0.0s | _skipped: no_matching_files_ |
| selenium-gen | pass | 2 | 0.2s |  |
| lychee | pass | 0 | 0.8s |  |
| axe-core | skipped | 0 | 0.0s | _skipped: no_target_url_ |
| c8 | skipped | 0 | 0.0s | _skipped: no_test_config_ |
| fast-check | skipped | 0 | 0.0s | _skipped: no_matching_files_ |
| hypothesis | skipped | 0 | 0.0s | _skipped: no_property_tests_ |
| sqlmap | skipped | 0 | 0.0s | _skipped: no_target_url_ |
| dalfox | skipped | 0 | 0.0s | _skipped: no_target_url_ |
| ffuf | skipped | 0 | 0.0s | _skipped: no_target_url_ |
| socket | skipped | 0 | 0.0s | _skipped: no_package_manifest_ |
| giskard | skipped | 0 | 0.0s | _skipped: no_llm_integration_ |
| _file_inventory | pass | 0 | 0.0s |  |

## High Findings (190)

### [HIGH] Using outdated libraries with known security issues.

- **Scanner:** scorecard
- **Rule:** `SCORECARD-VULNERABILITIES`
- **OWASP:** A06:2021-Vulnerable and Outdated Components

**What's wrong:** 8 existing vulnerabilities detected

**How to fix:** Improve the Vulnerabilities score. See: https://github.com/ossf/scorecard/blob/b0143fc57d8d38748990027266de715052806f4b/docs/checks.md#vulnerabilities

**Action:** Address this issue as soon as possible.

---

### [HIGH] Using outdated libraries with known security issues.

- **Scanner:** scorecard
- **Rule:** `SCORECARD-TOKEN-PERMISSIONS`
- **OWASP:** A06:2021-Vulnerable and Outdated Components

**What's wrong:** No tokens found

**How to fix:** Improve the Token-Permissions score. See: https://github.com/ossf/scorecard/blob/b0143fc57d8d38748990027266de715052806f4b/docs/checks.md#token-permissions

**Action:** Address this issue as soon as possible.

---

### [HIGH] Using outdated libraries with known security issues.

- **Scanner:** scorecard
- **Rule:** `SCORECARD-SECURITY-POLICY`
- **OWASP:** A06:2021-Vulnerable and Outdated Components

**What's wrong:** security policy file not detected

**How to fix:** Improve the Security-Policy score. See: https://github.com/ossf/scorecard/blob/b0143fc57d8d38748990027266de715052806f4b/docs/checks.md#security-policy

**Action:** Address this issue as soon as possible.

---

### [HIGH] Using outdated libraries with known security issues.

- **Scanner:** scorecard
- **Rule:** `SCORECARD-SAST`
- **OWASP:** A06:2021-Vulnerable and Outdated Components

**What's wrong:** no SAST tool detected

**How to fix:** Improve the SAST score. See: https://github.com/ossf/scorecard/blob/b0143fc57d8d38748990027266de715052806f4b/docs/checks.md#sast

**Action:** Address this issue as soon as possible.

---

### [HIGH] Using outdated libraries with known security issues.

- **Scanner:** scorecard
- **Rule:** `SCORECARD-PINNED-DEPENDENCIES`
- **OWASP:** A06:2021-Vulnerable and Outdated Components

**What's wrong:** dependency not pinned by hash detected -- score normalized to 0

**How to fix:** Improve the Pinned-Dependencies score. See: https://github.com/ossf/scorecard/blob/b0143fc57d8d38748990027266de715052806f4b/docs/checks.md#pinned-dependencies

**Action:** Address this issue as soon as possible.

---

### [HIGH] Using outdated libraries with known security issues.

- **Scanner:** scorecard
- **Rule:** `SCORECARD-PACKAGING`
- **OWASP:** A06:2021-Vulnerable and Outdated Components

**What's wrong:** packaging workflow not detected

**How to fix:** Improve the Packaging score. See: https://github.com/ossf/scorecard/blob/b0143fc57d8d38748990027266de715052806f4b/docs/checks.md#packaging

**Action:** Address this issue as soon as possible.

---

### [HIGH] Using outdated libraries with known security issues.

- **Scanner:** scorecard
- **Rule:** `SCORECARD-FUZZING`
- **OWASP:** A06:2021-Vulnerable and Outdated Components

**What's wrong:** project is not fuzzed

**How to fix:** Improve the Fuzzing score. See: https://github.com/ossf/scorecard/blob/b0143fc57d8d38748990027266de715052806f4b/docs/checks.md#fuzzing

**Action:** Address this issue as soon as possible.

---

### [HIGH] Using outdated libraries with known security issues.

- **Scanner:** scorecard
- **Rule:** `SCORECARD-DEPENDENCY-UPDATE-TOOL`
- **OWASP:** A06:2021-Vulnerable and Outdated Components

**What's wrong:** no update tool detected

**How to fix:** Improve the Dependency-Update-Tool score. See: https://github.com/ossf/scorecard/blob/b0143fc57d8d38748990027266de715052806f4b/docs/checks.md#dependency-update-tool

**Action:** Address this issue as soon as possible.

---

### [HIGH] Using outdated libraries with known security issues.

- **Scanner:** scorecard
- **Rule:** `SCORECARD-DANGEROUS-WORKFLOW`
- **OWASP:** A06:2021-Vulnerable and Outdated Components

**What's wrong:** no workflows found

**How to fix:** Improve the Dangerous-Workflow score. See: https://github.com/ossf/scorecard/blob/b0143fc57d8d38748990027266de715052806f4b/docs/checks.md#dangerous-workflow

**Action:** Address this issue as soon as possible.

---

### [HIGH] Error handling patterns are inconsistent in this file. 10 except...pass block(s) — errors silently ignored. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

- **File:** `packages/dashboard/app/main.py`
- **Scanner:** deepeval
- **Rule:** `DEEPEVAL-002`
- **CWE:** [CWE-755](https://cwe.mitre.org/data/definitions/755.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** Error handling patterns are inconsistent in this file. 10 except...pass block(s) — errors silently ignored. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

**How to fix:** Standardize error handling: use either try/catch or .catch() consistently. Ensure all async operations have error handling. Remove empty catch blocks.

**Action:** Address this issue as soon as possible.

---

### [HIGH] Error handling patterns are inconsistent in this file. 21 await calls but only 0 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

- **File:** `packages/mcp-server/src/time-travel-debug.ts`
- **Scanner:** deepeval
- **Rule:** `DEEPEVAL-002`
- **CWE:** [CWE-755](https://cwe.mitre.org/data/definitions/755.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** Error handling patterns are inconsistent in this file. 21 await calls but only 0 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

**How to fix:** Standardize error handling: use either try/catch or .catch() consistently. Ensure all async operations have error handling. Remove empty catch blocks.

**Action:** Address this issue as soon as possible.

---

### [HIGH] Error handling patterns are inconsistent in this file. 13 await calls but only 2 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

- **File:** `packages/mcp-server/src/digital-twin.ts`
- **Scanner:** deepeval
- **Rule:** `DEEPEVAL-002`
- **CWE:** [CWE-755](https://cwe.mitre.org/data/definitions/755.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** Error handling patterns are inconsistent in this file. 13 await calls but only 2 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

**How to fix:** Standardize error handling: use either try/catch or .catch() consistently. Ensure all async operations have error handling. Remove empty catch blocks.

**Action:** Address this issue as soon as possible.

---

### [HIGH] Error handling patterns are inconsistent in this file. 20 await calls but only 2 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

- **File:** `packages/mcp-server/src/agent-identity.ts`
- **Scanner:** deepeval
- **Rule:** `DEEPEVAL-002`
- **CWE:** [CWE-755](https://cwe.mitre.org/data/definitions/755.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** Error handling patterns are inconsistent in this file. 20 await calls but only 2 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

**How to fix:** Standardize error handling: use either try/catch or .catch() consistently. Ensure all async operations have error handling. Remove empty catch blocks.

**Action:** Address this issue as soon as possible.

---

### [HIGH] Error handling patterns are inconsistent in this file. 10 await calls but only 1 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

- **File:** `packages/mcp-server/src/constitutional-inheritance.ts`
- **Scanner:** deepeval
- **Rule:** `DEEPEVAL-002`
- **CWE:** [CWE-755](https://cwe.mitre.org/data/definitions/755.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** Error handling patterns are inconsistent in this file. 10 await calls but only 1 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

**How to fix:** Standardize error handling: use either try/catch or .catch() consistently. Ensure all async operations have error handling. Remove empty catch blocks.

**Action:** Address this issue as soon as possible.

---

### [HIGH] Error handling patterns are inconsistent in this file. 21 await calls but only 5 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

- **File:** `packages/mcp-server/src/postgres-mirror.ts`
- **Scanner:** deepeval
- **Rule:** `DEEPEVAL-002`
- **CWE:** [CWE-755](https://cwe.mitre.org/data/definitions/755.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** Error handling patterns are inconsistent in this file. 21 await calls but only 5 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

**How to fix:** Standardize error handling: use either try/catch or .catch() consistently. Ensure all async operations have error handling. Remove empty catch blocks.

**Action:** Address this issue as soon as possible.

---

### [HIGH] Error handling patterns are inconsistent in this file. Mixed error handling: 113 try/catch blocks and 20 .catch() chains. 380 await calls but only 133 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

- **File:** `packages/mcp-server/src/index.ts`
- **Scanner:** deepeval
- **Rule:** `DEEPEVAL-002`
- **CWE:** [CWE-755](https://cwe.mitre.org/data/definitions/755.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** Error handling patterns are inconsistent in this file. Mixed error handling: 113 try/catch blocks and 20 .catch() chains. 380 await calls but only 133 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

**How to fix:** Standardize error handling: use either try/catch or .catch() consistently. Ensure all async operations have error handling. Remove empty catch blocks.

**Action:** Address this issue as soon as possible.

---

### [HIGH] Error handling patterns are inconsistent in this file. Mixed error handling: 7 try/catch blocks and 18 .catch() chains. 72 await calls but only 25 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

- **File:** `packages/mcp-server/src/frontier-capabilities.ts`
- **Scanner:** deepeval
- **Rule:** `DEEPEVAL-002`
- **CWE:** [CWE-755](https://cwe.mitre.org/data/definitions/755.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** Error handling patterns are inconsistent in this file. Mixed error handling: 7 try/catch blocks and 18 .catch() chains. 72 await calls but only 25 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

**How to fix:** Standardize error handling: use either try/catch or .catch() consistently. Ensure all async operations have error handling. Remove empty catch blocks.

**Action:** Address this issue as soon as possible.

---

### [HIGH] Error handling patterns are inconsistent in this file. 11 await calls but only 2 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

- **File:** `packages/mcp-server/src/multi-agent-coordination.ts`
- **Scanner:** deepeval
- **Rule:** `DEEPEVAL-002`
- **CWE:** [CWE-755](https://cwe.mitre.org/data/definitions/755.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** Error handling patterns are inconsistent in this file. 11 await calls but only 2 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

**How to fix:** Standardize error handling: use either try/catch or .catch() consistently. Ensure all async operations have error handling. Remove empty catch blocks.

**Action:** Address this issue as soon as possible.

---

### [HIGH] Error handling patterns are inconsistent in this file. 110 await calls but only 5 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

- **File:** `packages/mcp-server/src/advanced-memory.ts`
- **Scanner:** deepeval
- **Rule:** `DEEPEVAL-002`
- **CWE:** [CWE-755](https://cwe.mitre.org/data/definitions/755.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** Error handling patterns are inconsistent in this file. 110 await calls but only 5 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

**How to fix:** Standardize error handling: use either try/catch or .catch() consistently. Ensure all async operations have error handling. Remove empty catch blocks.

**Action:** Address this issue as soon as possible.

---

### [HIGH] Error handling patterns are inconsistent in this file. 11 await calls but only 2 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

- **File:** `packages/mcp-server/src/red-team-agent.ts`
- **Scanner:** deepeval
- **Rule:** `DEEPEVAL-002`
- **CWE:** [CWE-755](https://cwe.mitre.org/data/definitions/755.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** Error handling patterns are inconsistent in this file. 11 await calls but only 2 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

**How to fix:** Standardize error handling: use either try/catch or .catch() consistently. Ensure all async operations have error handling. Remove empty catch blocks.

**Action:** Address this issue as soon as possible.

---

### [HIGH] Error handling patterns are inconsistent in this file. 40 await calls but only 7 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

- **File:** `packages/mcp-server/src/memory-enhancements.ts`
- **Scanner:** deepeval
- **Rule:** `DEEPEVAL-002`
- **CWE:** [CWE-755](https://cwe.mitre.org/data/definitions/755.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** Error handling patterns are inconsistent in this file. 40 await calls but only 7 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

**How to fix:** Standardize error handling: use either try/catch or .catch() consistently. Ensure all async operations have error handling. Remove empty catch blocks.

**Action:** Address this issue as soon as possible.

---

### [HIGH] Error handling patterns are inconsistent in this file. 29 await calls but only 5 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

- **File:** `packages/mcp-server/src/constitutional-monitor.ts`
- **Scanner:** deepeval
- **Rule:** `DEEPEVAL-002`
- **CWE:** [CWE-755](https://cwe.mitre.org/data/definitions/755.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** Error handling patterns are inconsistent in this file. 29 await calls but only 5 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

**How to fix:** Standardize error handling: use either try/catch or .catch() consistently. Ensure all async operations have error handling. Remove empty catch blocks.

**Action:** Address this issue as soon as possible.

---

### [HIGH] Error handling patterns are inconsistent in this file. 79 await calls but only 9 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

- **File:** `packages/mcp-server/src/dx-tooling.ts`
- **Scanner:** deepeval
- **Rule:** `DEEPEVAL-002`
- **CWE:** [CWE-755](https://cwe.mitre.org/data/definitions/755.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** Error handling patterns are inconsistent in this file. 79 await calls but only 9 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

**How to fix:** Standardize error handling: use either try/catch or .catch() consistently. Ensure all async operations have error handling. Remove empty catch blocks.

**Action:** Address this issue as soon as possible.

---

### [HIGH] Error handling patterns are inconsistent in this file. 11 await calls but only 0 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

- **File:** `packages/mcp-server/src/stigmergy-tools.ts`
- **Scanner:** deepeval
- **Rule:** `DEEPEVAL-002`
- **CWE:** [CWE-755](https://cwe.mitre.org/data/definitions/755.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** Error handling patterns are inconsistent in this file. 11 await calls but only 0 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

**How to fix:** Standardize error handling: use either try/catch or .catch() consistently. Ensure all async operations have error handling. Remove empty catch blocks.

**Action:** Address this issue as soon as possible.

---

### [HIGH] Error handling patterns are inconsistent in this file. 40 await calls but only 1 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

- **File:** `packages/mcp-server/src/nhi-lifecycle.ts`
- **Scanner:** deepeval
- **Rule:** `DEEPEVAL-002`
- **CWE:** [CWE-755](https://cwe.mitre.org/data/definitions/755.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** Error handling patterns are inconsistent in this file. 40 await calls but only 1 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

**How to fix:** Standardize error handling: use either try/catch or .catch() consistently. Ensure all async operations have error handling. Remove empty catch blocks.

**Action:** Address this issue as soon as possible.

---

### [HIGH] Error handling patterns are inconsistent in this file. Mixed error handling: 16 try/catch blocks and 6 .catch() chains. 64 await calls but only 22 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

- **File:** `packages/mcp-server/scripts/self-test.ts`
- **Scanner:** deepeval
- **Rule:** `DEEPEVAL-002`
- **CWE:** [CWE-755](https://cwe.mitre.org/data/definitions/755.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** Error handling patterns are inconsistent in this file. Mixed error handling: 16 try/catch blocks and 6 .catch() chains. 64 await calls but only 22 error handlers. AI-generated code often has inconsistent error handling because different parts of the file may have been generated in separate prompts or sessions, each using a different error handling approach.

**How to fix:** Standardize error handling: use either try/catch or .catch() consistently. Ensure all async operations have error handling. Remove empty catch blocks.

**Action:** Address this issue as soon as possible.

---

### [HIGH] The endpoint ALL session_collections is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

- **File:** `packages/dashboard/app/routes_extended.py:226`
- **Scanner:** keploy
- **Rule:** `KEPLOY-001`
- **CWE:** [CWE-1164](https://cwe.mitre.org/data/definitions/1164.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** The endpoint ALL session_collections is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

**Code:**
```python
names = cfg.get("session_collections", ["tg_sessions", "session_recordings"])
```

**How to fix:** Add an API test for ALL session_collections that validates the response status, body structure, and error handling.

**Action:** Address this issue as soon as possible.

---

### [HIGH] The endpoint ALL /api/sessions is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

- **File:** `packages/dashboard/app/routes_extended.py:223`
- **Scanner:** keploy
- **Rule:** `KEPLOY-001`
- **CWE:** [CWE-1164](https://cwe.mitre.org/data/definitions/1164.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** The endpoint ALL /api/sessions is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

**Code:**
```python
@router.get("/api/sessions")
```

**How to fix:** Add an API test for ALL /api/sessions that validates the response status, body structure, and error handling.

**Action:** Address this issue as soon as possible.

---

### [HIGH] The endpoint ALL governance_collections is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

- **File:** `packages/dashboard/app/routes_extended.py:216`
- **Scanner:** keploy
- **Rule:** `KEPLOY-001`
- **CWE:** [CWE-1164](https://cwe.mitre.org/data/definitions/1164.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** The endpoint ALL governance_collections is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

**Code:**
```python
names = cfg.get("governance_collections", [
```

**How to fix:** Add an API test for ALL governance_collections that validates the response status, body structure, and error handling.

**Action:** Address this issue as soon as possible.

---

### [HIGH] The endpoint ALL /api/governance is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

- **File:** `packages/dashboard/app/routes_extended.py:213`
- **Scanner:** keploy
- **Rule:** `KEPLOY-001`
- **CWE:** [CWE-1164](https://cwe.mitre.org/data/definitions/1164.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** The endpoint ALL /api/governance is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

**Code:**
```python
@router.get("/api/governance")
```

**How to fix:** Add an API test for ALL /api/governance that validates the response status, body structure, and error handling.

**Action:** Address this issue as soon as possible.

---

### [HIGH] The endpoint ALL knowledge_collections is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

- **File:** `packages/dashboard/app/routes_extended.py:206`
- **Scanner:** keploy
- **Rule:** `KEPLOY-001`
- **CWE:** [CWE-1164](https://cwe.mitre.org/data/definitions/1164.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** The endpoint ALL knowledge_collections is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

**Code:**
```python
names = cfg.get("knowledge_collections", [
```

**How to fix:** Add an API test for ALL knowledge_collections that validates the response status, body structure, and error handling.

**Action:** Address this issue as soon as possible.

---

### [HIGH] The endpoint ALL /api/knowledge is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

- **File:** `packages/dashboard/app/routes_extended.py:203`
- **Scanner:** keploy
- **Rule:** `KEPLOY-001`
- **CWE:** [CWE-1164](https://cwe.mitre.org/data/definitions/1164.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** The endpoint ALL /api/knowledge is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

**Code:**
```python
@router.get("/api/knowledge")
```

**How to fix:** Add an API test for ALL /api/knowledge that validates the response status, body structure, and error handling.

**Action:** Address this issue as soon as possible.

---

### [HIGH] The endpoint ALL tiers_collections is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

- **File:** `packages/dashboard/app/routes_extended.py:196`
- **Scanner:** keploy
- **Rule:** `KEPLOY-001`
- **CWE:** [CWE-1164](https://cwe.mitre.org/data/definitions/1164.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** The endpoint ALL tiers_collections is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

**Code:**
```python
names = cfg.get("tiers_collections", [
```

**How to fix:** Add an API test for ALL tiers_collections that validates the response status, body structure, and error handling.

**Action:** Address this issue as soon as possible.

---

### [HIGH] The endpoint ALL /api/tiers is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

- **File:** `packages/dashboard/app/routes_extended.py:193`
- **Scanner:** keploy
- **Rule:** `KEPLOY-001`
- **CWE:** [CWE-1164](https://cwe.mitre.org/data/definitions/1164.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** The endpoint ALL /api/tiers is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

**Code:**
```python
@router.get("/api/tiers")
```

**How to fix:** Add an API test for ALL /api/tiers that validates the response status, body structure, and error handling.

**Action:** Address this issue as soon as possible.

---

### [HIGH] The endpoint ALL /api/pg2/table/{schema}/{table} is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

- **File:** `packages/dashboard/app/routes_extended.py:113`
- **Scanner:** keploy
- **Rule:** `KEPLOY-001`
- **CWE:** [CWE-1164](https://cwe.mitre.org/data/definitions/1164.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** The endpoint ALL /api/pg2/table/{schema}/{table} is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

**Code:**
```python
@router.get("/api/pg2/table/{schema}/{table}")
```

**How to fix:** Add an API test for ALL /api/pg2/table/{schema}/{table} that validates the response status, body structure, and error handling.

**Action:** Address this issue as soon as possible.

---

### [HIGH] The endpoint ALL /api/pg2/tables is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

- **File:** `packages/dashboard/app/routes_extended.py:102`
- **Scanner:** keploy
- **Rule:** `KEPLOY-001`
- **CWE:** [CWE-1164](https://cwe.mitre.org/data/definitions/1164.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** The endpoint ALL /api/pg2/tables is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

**Code:**
```python
@router.get("/api/pg2/tables")
```

**How to fix:** Add an API test for ALL /api/pg2/tables that validates the response status, body structure, and error handling.

**Action:** Address this issue as soon as possible.

---

### [HIGH] The endpoint ALL /api/collection/{name} is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

- **File:** `packages/dashboard/app/routes_extended.py:75`
- **Scanner:** keploy
- **Rule:** `KEPLOY-001`
- **CWE:** [CWE-1164](https://cwe.mitre.org/data/definitions/1164.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** The endpoint ALL /api/collection/{name} is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

**Code:**
```python
@router.get("/api/collection/{name}")
```

**How to fix:** Add an API test for ALL /api/collection/{name} that validates the response status, body structure, and error handling.

**Action:** Address this issue as soon as possible.

---

### [HIGH] The endpoint ALL /api/collections is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

- **File:** `packages/dashboard/app/routes_extended.py:66`
- **Scanner:** keploy
- **Rule:** `KEPLOY-001`
- **CWE:** [CWE-1164](https://cwe.mitre.org/data/definitions/1164.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** The endpoint ALL /api/collections is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

**Code:**
```python
@router.get("/api/collections")
```

**How to fix:** Add an API test for ALL /api/collections that validates the response status, body structure, and error handling.

**Action:** Address this issue as soon as possible.

---

### [HIGH] The endpoint GET /api/sessions is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

- **File:** `packages/dashboard/app/routes_extended.py:223`
- **Scanner:** keploy
- **Rule:** `KEPLOY-001`
- **CWE:** [CWE-1164](https://cwe.mitre.org/data/definitions/1164.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** The endpoint GET /api/sessions is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

**Code:**
```python
@router.get("/api/sessions")
```

**How to fix:** Add an API test for GET /api/sessions that validates the response status, body structure, and error handling.

**Action:** Address this issue as soon as possible.

---

### [HIGH] The endpoint GET /api/governance is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

- **File:** `packages/dashboard/app/routes_extended.py:213`
- **Scanner:** keploy
- **Rule:** `KEPLOY-001`
- **CWE:** [CWE-1164](https://cwe.mitre.org/data/definitions/1164.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** The endpoint GET /api/governance is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

**Code:**
```python
@router.get("/api/governance")
```

**How to fix:** Add an API test for GET /api/governance that validates the response status, body structure, and error handling.

**Action:** Address this issue as soon as possible.

---

### [HIGH] The endpoint GET /api/knowledge is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

- **File:** `packages/dashboard/app/routes_extended.py:203`
- **Scanner:** keploy
- **Rule:** `KEPLOY-001`
- **CWE:** [CWE-1164](https://cwe.mitre.org/data/definitions/1164.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** The endpoint GET /api/knowledge is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

**Code:**
```python
@router.get("/api/knowledge")
```

**How to fix:** Add an API test for GET /api/knowledge that validates the response status, body structure, and error handling.

**Action:** Address this issue as soon as possible.

---

### [HIGH] The endpoint GET /api/tiers is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

- **File:** `packages/dashboard/app/routes_extended.py:193`
- **Scanner:** keploy
- **Rule:** `KEPLOY-001`
- **CWE:** [CWE-1164](https://cwe.mitre.org/data/definitions/1164.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** The endpoint GET /api/tiers is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

**Code:**
```python
@router.get("/api/tiers")
```

**How to fix:** Add an API test for GET /api/tiers that validates the response status, body structure, and error handling.

**Action:** Address this issue as soon as possible.

---

### [HIGH] The endpoint GET /api/pg2/table/{schema}/{table} is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

- **File:** `packages/dashboard/app/routes_extended.py:113`
- **Scanner:** keploy
- **Rule:** `KEPLOY-001`
- **CWE:** [CWE-1164](https://cwe.mitre.org/data/definitions/1164.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** The endpoint GET /api/pg2/table/{schema}/{table} is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

**Code:**
```python
@router.get("/api/pg2/table/{schema}/{table}")
```

**How to fix:** Add an API test for GET /api/pg2/table/{schema}/{table} that validates the response status, body structure, and error handling.

**Action:** Address this issue as soon as possible.

---

### [HIGH] The endpoint GET /api/pg2/tables is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

- **File:** `packages/dashboard/app/routes_extended.py:102`
- **Scanner:** keploy
- **Rule:** `KEPLOY-001`
- **CWE:** [CWE-1164](https://cwe.mitre.org/data/definitions/1164.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** The endpoint GET /api/pg2/tables is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

**Code:**
```python
@router.get("/api/pg2/tables")
```

**How to fix:** Add an API test for GET /api/pg2/tables that validates the response status, body structure, and error handling.

**Action:** Address this issue as soon as possible.

---

### [HIGH] The endpoint GET /api/collection/{name} is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

- **File:** `packages/dashboard/app/routes_extended.py:75`
- **Scanner:** keploy
- **Rule:** `KEPLOY-001`
- **CWE:** [CWE-1164](https://cwe.mitre.org/data/definitions/1164.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** The endpoint GET /api/collection/{name} is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

**Code:**
```python
@router.get("/api/collection/{name}")
```

**How to fix:** Add an API test for GET /api/collection/{name} that validates the response status, body structure, and error handling.

**Action:** Address this issue as soon as possible.

---

### [HIGH] The endpoint GET /api/collections is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

- **File:** `packages/dashboard/app/routes_extended.py:66`
- **Scanner:** keploy
- **Rule:** `KEPLOY-001`
- **CWE:** [CWE-1164](https://cwe.mitre.org/data/definitions/1164.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** The endpoint GET /api/collections is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

**Code:**
```python
@router.get("/api/collections")
```

**How to fix:** Add an API test for GET /api/collections that validates the response status, body structure, and error handling.

**Action:** Address this issue as soon as possible.

---

### [HIGH] The endpoint ALL content_preview is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

- **File:** `packages/dashboard/app/main.py:1359`
- **Scanner:** keploy
- **Rule:** `KEPLOY-001`
- **CWE:** [CWE-1164](https://cwe.mitre.org/data/definitions/1164.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** The endpoint ALL content_preview is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

**Code:**
```python
audit_text = f"dashboard_{action} {memory_id} {details.get('content_preview', '')[:100]}"
```

**How to fix:** Add an API test for ALL content_preview that validates the response status, body structure, and error handling.

**Action:** Address this issue as soon as possible.

---

### [HIGH] The endpoint ALL details is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

- **File:** `packages/dashboard/app/main.py:1315`
- **Scanner:** keploy
- **Rule:** `KEPLOY-001`
- **CWE:** [CWE-1164](https://cwe.mitre.org/data/definitions/1164.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** The endpoint ALL details is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

**Code:**
```python
"details": p.get("payload", {}).get("details", {}),
```

**How to fix:** Add an API test for ALL details that validates the response status, body structure, and error handling.

**Action:** Address this issue as soon as possible.

---

### [HIGH] The endpoint ALL action is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

- **File:** `packages/dashboard/app/main.py:1313`
- **Scanner:** keploy
- **Rule:** `KEPLOY-001`
- **CWE:** [CWE-1164](https://cwe.mitre.org/data/definitions/1164.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** The endpoint ALL action is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

**Code:**
```python
"action": p.get("payload", {}).get("action"),
```

**How to fix:** Add an API test for ALL action that validates the response status, body structure, and error handling.

**Action:** Address this issue as soon as possible.

---

### [HIGH] The endpoint ALL timestamp is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

- **File:** `packages/dashboard/app/main.py:1307`
- **Scanner:** keploy
- **Rule:** `KEPLOY-001`
- **CWE:** [CWE-1164](https://cwe.mitre.org/data/definitions/1164.html)
- **OWASP:** A04:2021-Insecure Design

**What's wrong:** The endpoint ALL timestamp is defined in the codebase but has no corresponding API test. Untested endpoints are a significant risk in AI-generated codebases because the AI may produce handlers with incorrect logic, missing input validation, or broken error handling that goes undetected without tests.

**Code:**
```python
points.sort(key=lambda p: p.get("payload", {}).get("timestamp", ""), reverse=True)
```

**How to fix:** Add an API test for ALL timestamp that validates the response status, body structure, and error handling.

**Action:** Address this issue as soon as possible.

---

> ... and 140 more high findings

## Medium Findings (402)

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

> ... and 352 more medium findings

## Low Findings (187)

- **SCORECARD-BINARY-ARTIFACTS**: OpenSSF Scorecard: Binary-Artifacts (7/10) (N/A)
- **DEEPEVAL-005**: Over-engineered abstraction in packages/mcp-server/scripts/self-test.ts:272 (`packages/mcp-server/scripts/self-test.ts:272`)
- **SBOM-LICENSE-UNKNOWN**: Unknown License: uvicorn@0.34.2 (`/packages/dashboard/app/requirements.txt`)
- **SBOM-LICENSE-UNKNOWN**: Unknown License: pyyaml@6.0.2 (`/packages/dashboard/app/requirements.txt`)
- **SBOM-LICENSE-UNKNOWN**: Unknown License: python-multipart@0.0.20 (`/packages/dashboard/app/requirements.txt`)
- **SBOM-LICENSE-UNKNOWN**: Unknown License: jinja2@3.1.6 (`/packages/dashboard/app/requirements.txt`)
- **SBOM-LICENSE-UNKNOWN**: Unknown License: itsdangerous@2.2.0 (`/packages/dashboard/app/requirements.txt`)
- **SBOM-LICENSE-UNKNOWN**: Unknown License: httpx@0.28.1 (`/packages/dashboard/app/requirements.txt`)
- **SBOM-LICENSE-UNKNOWN**: Unknown License: fastapi@0.115.12 (`/packages/dashboard/app/requirements.txt`)
- **SBOM-LICENSE-UNKNOWN**: Unknown License: asyncpg@0.30.0 (`/packages/dashboard/app/requirements.txt`)
- **CVE-2026-53538**: CVE-2026-53538: Vulnerability in python-multipart@0.0.20 (`/packages/dashboard/app/requirements.txt`)
- **CVE-2026-53537**: CVE-2026-53537: Vulnerability in python-multipart@0.0.20 (`/packages/dashboard/app/requirements.txt`)
- **CVE-2026-53540**: CVE-2026-53540: Vulnerability in python-multipart@0.0.20 (`/packages/dashboard/app/requirements.txt`)
- **LICENSE-Apache-2.0**: License Compliance: Apache-2.0 in  (`packages/mcp-server/LICENSE`)
- **LICENSE-Apache-2.0**: License Compliance: Apache-2.0 in  (`packages/dashboard/LICENSE`)
- **LICENSE-Apache-2.0**: License Compliance: Apache-2.0 in  (`LICENSE`)
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

> ... and 137 more low findings

## Skipped Scanners (38)

Scanners that did not run on this scan, with the reason why and how to enable them.

| Scanner | Reason | How to enable |
|---------|--------|---------------|
| `actionlint` | no_matching_files | No .github/workflows directory found — actionlint requires GitHub Actions workflow files |
| `aflpp` | no_c_project | No C/C++ project detected — AFL++ requires a Makefile or CMakeLists.txt with .c/.cpp source files |
| `axe-core` | no_target_url | Add a target URL to enable WCAG accessibility testing |
| `c8` | no_test_config | Run tests with coverage enabled first (e.g., jest --coverage or c8 npx jest) |
| `cargo-audit` | no_rust_project | No Cargo.lock found — cargo-audit requires a Rust project with dependencies |
| `cdxgen` | no_matching_files | No package manifest found for SBOM generation |
| `conftest` | no_policy_dir | No policy/ directory found — Conftest requires Rego policies in a policy/ directory |
| `cosign` | no_container_image | Add Container Image in Project Settings to verify signatures |
| `dalfox` | no_target_url | Add a target URL to enable XSS vulnerability scanning with dalfox |
| `dotenv-linter` | no_matching_files | No .env files found — dotenv-linter checks .env files for formatting and security issues |
| `fast-check` | no_matching_files | No JavaScript/TypeScript project detected — fast-check requires a Node.js project |
| `ffuf` | no_target_url | Add a target URL to enable hidden endpoint discovery with ffuf |
| `giskard` | no_llm_integration | Giskard requires LLM integrations (openai, anthropic, langchain, etc.) to test for prompt injection vulnerabilities |
| `gosec` | no_matching_files | No .go files found — Gosec requires a Go project |
| `hypothesis` | no_property_tests | Add hypothesis to your Python dependencies to enable property-based testing |
| `jest` | no_matching_files | No package.json found — Jest requires a JavaScript/TypeScript project |
| `knip` | no_matching_files | No package.json found — Knip requires a Node.js project |
| `kube-linter` | no_k8s_manifests | No Kubernetes manifests found (no files with kind: + apiVersion:) |
| `kubeconform` | no_k8s_manifests | YAML files exist but none contain Kubernetes markers (kind: + apiVersion:) |
| `libyear` | unknown | _(no hint)_ |
| `license-finder` | no_matching_files | No package manifest found (package.json, Gemfile, requirements.txt, etc.) |
| `mutmut` | no_python_project | No setup.py, pyproject.toml, or requirements.txt found — mutmut requires a Python project |
| `newman` | no_postman_collection | Add a *.postman_collection.json file to your project, or import your API into Postman and export the collection. |
| `nuclei` | no_target_url | Add Application URL in Project Settings to enable DAST scanning |
| `opa` | no_matching_files | No .rego policy files found — OPA requires Rego policies to evaluate |
| `package-validator` | unknown | _(no hint)_ |
| `phpstan` | no_matching_files | No .php files found — PHPStan requires a PHP project |
| `pitest` | no_java_project | No pom.xml or build.gradle found — Pitest requires a Maven or Gradle Java project |
| `pmd` | no_matching_files | No .java files found — PMD requires a Java project |
| `poutine` | no_ci_config | No .github/workflows or .gitlab-ci.yml found — Poutine requires CI/CD pipeline definitions |
| `restler` | no_api_spec | Add an openapi.json/yaml or swagger.json/yaml to your project, or set openapiSpecPath on the project. |
| `scancode` | tool_not_installed | ScanCode timed out or produced no output — use license-finder for license compliance on large repos |
| `schemathesis` | no_api_spec | Add an openapi.json/yaml or swagger.json/yaml to your project, or set openapiSpecPath on the project. |
| `socket` | no_package_manifest | Socket.dev requires a package manifest file to analyze dependencies |
| `spectral` | no_api_spec | Add an openapi.json/yaml or swagger.json/yaml to your project, or set openapiSpecPath on the project. |
| `sqlmap` | no_target_url | Add a target URL to enable SQL injection testing |
| `stryker` | no_matching_files | No package.json found — Stryker requires a JavaScript/TypeScript project |
| `zap` | no_target_url | Add Application URL in Project Settings to enable DAST scanning |

## Recommendations

1. Schedule remediation for 190 high severity finding(s) within the current sprint
2. Update 167 vulnerable dependency/dependencies -- run `npm audit fix` or equivalent

---
*Generated by Code Hardener v0.1.0 | 2026-07-24T18:38:02.619Z*