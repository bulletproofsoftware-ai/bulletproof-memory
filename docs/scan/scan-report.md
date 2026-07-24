# Security & Quality Scan Report — bulletproof-memory

This repository is scanned with
[Code Hardener](https://github.com/bulletproofsoftware-ai/bulletproof-codehardener) using
its **standard** code-assurance profile (12 scanners: SAST, SCA, secrets, IaC, container,
supply-chain). The profile is chosen deliberately: it runs the scanners that produce
meaningful results against a **static repository** and omits the ones that require a
**live running deployment** (dynamic API replay, LLM output evaluation) — which would
otherwise report noise, not real defects.

## Result

| Metric | Value |
|--------|-------|
| **Score** | **826 / 1000 — "good"** |
| **Critical** | **0** |
| **High** | **0** |
| **Secrets (gitleaks)** | **0 — PASS** |
| Medium / Low / Info | 137 / 163 / 6 |

**Zero critical and zero high findings.** The remaining items are low-severity
dependency/OS advisories in upstream base images and code-hygiene warnings (unused
variables) — none carry security impact. Details below.

## Signed evidence (committed alongside this report)

| Artifact | File | What it is |
|----------|------|------------|
| **Signed PDF report** | [`bulletproof-memory-scan-report.pdf`](bulletproof-memory-scan-report.pdf) | The full Code Hardener assurance report + attestation certificate (58 pages) |
| **In-toto attestation** | [`attestation.json`](attestation.json) | Ed25519 signature over the scanned artifact digest |
| **Full report** | [`scan-report-full.md`](scan-report-full.md) | Complete per-finding detail |
| **SARIF** | [`scan-report.sarif.json`](scan-report.sarif.json) | Machine-readable results for IDE/CI import |

The PDF's first page is a cryptographic **attestation certificate**: an **in-toto**
predicate signed with **Ed25519**, over the scan's subject digest. (It is a *local*
signer — it attests the scan was produced by this Code Hardener instance; it is not
anchored in a public transparency log.)

---

## Security fixes applied

The scan surfaced genuine issues, which were **fixed** (not dispositioned away) and the
repository re-scanned to confirm resolution:

| Finding | Scanner | Severity | Fix |
|---------|---------|----------|-----|
| `python-multipart@0.0.20` — CVE-2026-24486 (arbitrary file write), CVE-2026-42561 / CVE-2026-53539 (DoS) | trivy, grype | HIGH | Bumped `python-multipart` → `0.0.32`. |
| `@hono/node-server` — GHSA-frvp-7c67-39w9 (path traversal in `serve-static`, Windows) | grype, trivy | MEDIUM | Added an npm `override` to `^2.0.5` (patched). Transitive via the MCP SDK; the vulnerable `serve-static` path is unused, but resolved cleanly anyway. |
| `weak-hash-md5-sha1-js` | opengrep | HIGH | Replaced MD5 with SHA-256 (ID derivation, not a security hash). |
| `missing-user` (containers run as root) | opengrep, dockle | HIGH | Both Dockerfiles now run **non-root** (`node` / `appuser`). Verified via `docker run … id -un`. |
| `insecure-random-js-general` | opengrep | MEDIUM | Replaced `Math.random()` with crypto `randomUUID` / `randomBytes` for session IDs and UUIDs. |
| `github-actions-mutable-action-tag` | opengrep | MEDIUM | Pinned GitHub Actions to commit SHAs. |
| `hardcoded_sql_expressions` (B608) | bandit | MEDIUM | Reviewed each: all parameterized (`$1/$2`) with validated identifiers — annotated `# nosec` with rationale. |
| OpenSSF Scorecard: Security-Policy, Dependency-Update-Tool | scorecard | — | Added `SECURITY.md` and `dependabot.yml`. |

After these fixes, the re-scan reports **0 critical / 0 high**.

---

## What remains (and why it's low-risk)

The residual medium/low findings are documented honestly rather than hidden:

| Driver | ~Count | Nature |
|--------|--------|--------|
| `trivy` low-severity OS CVEs | ~150 (low) | Advisories in the **upstream base images** (`qdrant`/`postgres`/`ollama`/`n8n`), not this project's code. Tracked via Dependabot + `docker compose pull` (see [Administrator Guide](../ADMINISTRATOR.md#upgrades)). |
| `oxlint` unused variables/imports | ~127 (medium) | Code-hygiene warnings — no security or runtime impact. Left as-is because the linter's autofix removes defensive null-guards (behavior change); not worth the risk for cosmetic warnings. |
| `opengrep` residual medium | ~10 | Reviewed; the SQL ones are parameterized-safe (annotated), the rest are defensive-coding suggestions on non-security paths. |

None of these are exploitable in the shipped configuration.

---

## Scanner coverage (standard profile)

12 scanners executed. Highlights:

- **Secrets:** gitleaks — **PASS (0)**.
- **SAST:** opengrep, oxlint, ruff, bandit — **0 high/critical**.
- **SCA / supply chain:** trivy, grype, syft — application-dependency CVEs fixed; residual are upstream base-image OS advisories.
- **IaC / containers:** checkov (PASS), dockle, hadolint — non-root enforced.

---

## Reproducing this scan

```bash
# With a local Code Hardener instance (localhost:7002):
#   1. Create a project pointing at this repo
#   2. POST /api/v1/scans with scanType=standard
#   3. Download the signed PDF from the portal's scan page ("Download Report"),
#      or GET /api/v1/scans/<id>/report?format=markdown|sarif and
#      GET /api/v1/scans/<id>/attestation for the Ed25519 in-toto attestation.
```

---

Apache-2.0 © 2026 bulletproofsoftware-ai. See [LICENSE](../../LICENSE) and [NOTICE](../../NOTICE).
