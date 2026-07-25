# DegenFeed Security Documentation

> Central index for all security-related documentation.

## Documents

| Document | Description | Audience |
|----------|-------------|----------|
| [SECURITY-MODEL.md](./SECURITY-MODEL.md) | Defense-in-depth architecture, key management, encryption, auth flow, incident response | All engineers |
| [SECURITY-TESTING-PLAN.md](./SECURITY-TESTING-PLAN.md) | 89 test cases across 5 categories with tool integrations | QA, Security team |
| [PROTOCOL-SECURITY-RESEARCH.md](./PROTOCOL-SECURITY-RESEARCH.md) | In-depth analysis of 7 protocols' security models | Protocol integrators |
| [../SECURITY-AUDIT-2026-07.md](../SECURITY-AUDIT-2026-07.md) | Most recent security audit (2026-07-18) | All stakeholders |
| [../SECURITY.md](../SECURITY.md) | Vulnerability reporting policy, safe harbor, disclosure | External researchers |

## Quick Reference

### Security Contacts

| Role | Contact |
|------|---------|
| Security reports | security@degenfeed.xyz |
| Incident escalation | On-call pager (internal) |
| Bug bounty | Contact security@ for details |

### Key Principles

1. **Defense in depth** — 7 security layers from infrastructure to monitoring
2. **Least privilege** — every system component has minimum required access
3. **Fail closed** — on KV/DB failure, deny access (not grant it)
4. **No secrets in code** — pre-commit hooks prevent secret leakage
5. **Encrypt everything** — at rest, in transit, and end-to-end for messaging
6. **Assume breach** — design for compromise (key rotation, session revocation)

### Required Reading

All engineers must read:
1. [SECURITY-MODEL.md](./SECURITY-MODEL.md) — the full security model
2. [../SECURITY.md](../SECURITY.md) — vulnerability reporting policy
3. [SECURITY-TESTING-PLAN.md](./SECURITY-TESTING-PLAN.md) — test plan overview

---

**Last updated:** 2026-07-25
