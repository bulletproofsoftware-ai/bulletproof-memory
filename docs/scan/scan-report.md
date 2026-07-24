# Security & Quality Scan Report — bulletproof-memory

This report documents the security and quality scan of `bulletproof-memory`, run with
[Code Hardener](https://github.com/bulletproofsoftware-ai/bulletproof-codehardener) in
**comprehensive** mode (59 scanners across SAST, SCA, secrets, IaC, containers, DAST, API,
and LLM-evaluation categories).

It is an honest, self-hosted scan of the actual repository — not a curated summary. Where
findings are scan-context artifacts rather than code defects, that is stated explicitly.

## Signed evidence (committed alongside this report)

| Artifact | File | What it is |
|----------|------|------------|
| **Signed PDF report** | [`bulletproof-memory-scan-report.pdf`](bulletproof-memory-scan-report.pdf) | 70-page native Code Hardener report |
| **In-toto attestation** | [`attestation.json`](attestation.json) | Ed25519 signature over the scanned artifact digest |
| **Full markdown report** | [`scan-report-full.md`](scan-report-full.md) | Complete per-finding detail |
| **SARIF** | [`scan-report.sarif.json`](scan-report.sarif.json) | Machine-readable results for IDE/CI import |

The attestation is an **in-toto** predicate signed with **Ed25519** (`ed25519-local`) over
the scan's subject digest. It is a *local* signer — it attests the scan was produced by
this Code Hardener instance; it is not anchored in a public Rekor transparency log.

---

## Result summary

Two scans were run: a baseline, then a re-scan after fixing the code findings below.

| | Baseline | After fixes |
|---|---|---|
| **Critical findings** | **0** | **0** |
| **Secrets (gitleaks)** | **0** | **0** |
| opengrep HIGH (code) | 3 | **0** ✅ |
| dockle (container) | 4 | 1 *(see below)* |
| bandit MEDIUM (SQL) | 4 | **0** ✅ |
| ruff (Python lint) | 1 | **0** ✅ |
| Total findings | 813 | 799 |
| Composite score | 511/1000 | ~391–511/1000 |

**Every genuine code-security finding was resolved.** The composite score remains in the
"poor" band for a reason that is *not* code quality — see [Understanding the
score](#understanding-the-score).

---

## Findings that were fixed (real code issues)

| Finding | Scanner | Severity | Fix |
|---------|---------|----------|-----|
| `weak-hash-md5-sha1-js` | opengrep | HIGH | `index.ts`: replaced MD5 with SHA-256 in `keyToUUID` (a deterministic ID derivation, not a security hash — but SHA-256 removes the broken-hash warning at no cost). |
| `missing-user` / `missing-user-entrypoint` | opengrep | HIGH | Both Dockerfiles now run as a **non-root** user (`node` / `appuser`) instead of root. Verified: `docker run … id -un` returns the non-root user. |
| `CIS-DI-0001` (create a user) | dockle | MEDIUM | Same non-root `USER` change. |
| `CIS-DI-0006` (add HEALTHCHECK) | dockle | MEDIUM | Added a `HEALTHCHECK` to the dashboard image (HTTP `/health`). |
| `hardcoded_sql_expressions` (B608) ×4 | bandit | MEDIUM | Reviewed each site: all use **parameterized** queries (`$1/$2`) with validated/whitelisted identifiers — no user input is interpolated into SQL. Annotated `# nosec B608` with the rationale at the source. |
| `F401` unused import | ruff | MEDIUM | Removed the unused `fastapi.Depends` import. |

All fixes were committed and the repository re-scanned to confirm the findings dropped
(opengrep HIGH: 3 → **0**; bandit MEDIUM: 4 → **0**; ruff: 1 → **0**).

### The one remaining dockle finding — by design

The MCP server image still reports `CIS-DI-0006: Add HEALTHCHECK`. This is **intentional**:
the MCP server communicates over **stdio** and exposes no HTTP port to health-check
(the governance HTTP endpoint is optional and not the primary interface). A healthcheck
there would be misleading, so it is deliberately omitted rather than faked.

---

## Understanding the score

The composite score is in the "poor" band despite **0 critical findings and 0 secrets**.
This is an artifact of running the *comprehensive* 59-scanner profile against a **static
repository** with no live deployment. The findings driving the number are overwhelmingly
**not code defects**:

| Driver | ~Count | Why it fires on a static scan |
|--------|--------|-------------------------------|
| `deepeval` | ~196 | LLM output-quality evaluation — needs a **live model/app endpoint** to evaluate; nothing to score in a repo. |
| `keploy` | ~158 | API record/replay testing — needs a **running server** to capture traffic. |
| `trivy` | ~163 | Dependency/OS CVEs — but **~155 are LOW** and originate in the **upstream base images** (`qdrant`/`postgres`/`ollama`/`n8n`), not this project's code. |
| `scorecard` | ~10 | OSSF repo-governance checks (branch protection, signed releases, a SECURITY.md) — **repository configuration**, not code. Improves as the public repo matures. |
| `threatmodel` | ~77 | LLM-generated threat-model observations, advisory. |

Interpreting this repo's *code* posture: filter to the code scanners (opengrep, bandit,
gosec, oxlint, ruff, hadolint, dockle) and dependency scanners (trivy/grype/syft). After
the fixes, the code scanners report **0 high/critical** — the remaining code-scanner items
are medium/low style findings (unused variables, `assert` in tests, `try/except/pass`) that
carry no security impact.

We deliberately **do not disposition the no-live-target findings away to inflate the
number** — they are recorded honestly. A future run against a live deployment (with a
target URL and API spec configured) would exercise those scanners meaningfully.

---

## Scanner coverage

Comprehensive mode ran the full 59-scanner suite. Highlights of what executed and passed:

- **Secrets:** gitleaks — **clean** (0).
- **SAST:** opengrep, bandit, oxlint, ruff — 0 high/critical after fixes.
- **SCA / supply chain:** trivy, grype, syft, cdxgen — dependency inventory clean of
  criticals; base-image OS CVEs tracked (see [SBOM](../SBOM.md)).
- **Containers:** dockle, hadolint — non-root enforced; one by-design healthcheck note.

~38 scanners **skipped** with explicit reasons (no live target URL, no API spec, no
matching files for that language, no Kubernetes manifests, etc.). Skip reasons are
enumerated in the full markdown report and the SARIF `invocations[]`.

---

## Reproducing this scan

```bash
# With a local Code Hardener instance (localhost:7002):
#   1. Create a project pointing at this repo
#   2. POST /api/v1/scans with scanType=comprehensive
#   3. GET  /api/v1/scans/<id>/report?format=markdown   (full detail)
#      GET  /api/v1/scans/<id>/report?format=sarif       (machine-readable)
#      GET  /api/v1/scans/<id>/attestation               (Ed25519 in-toto)
#      POST /api/v1/reports {format:pdf,...} + GET /reports/<id>/download  (signed PDF)
```

---

Apache-2.0 © 2026 bulletproofsoftware-ai. See [LICENSE](../../LICENSE) and [NOTICE](../../NOTICE).
