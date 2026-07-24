# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in bulletproof-memory, please report it
responsibly. **Do not open a public issue for security problems.**

Instead, use GitHub's private vulnerability reporting:
**[Report a vulnerability](https://github.com/bulletproofsoftware-ai/bulletproof-memory/security/advisories/new)**

Please include:

- A description of the vulnerability and its impact
- Steps to reproduce (proof-of-concept if possible)
- Affected version(s) and configuration

We aim to acknowledge reports within 5 business days and to provide a remediation
timeline after triage.

## Supported Versions

Security fixes are applied to the latest release on the `main` branch.

## Scope

This project is self-hosted. Deployments are responsible for their own infrastructure
hardening (secrets rotation, network exposure, TLS). See
[`docs/ADMINISTRATOR.md`](docs/ADMINISTRATOR.md#security-hardening) for the hardening guide.
