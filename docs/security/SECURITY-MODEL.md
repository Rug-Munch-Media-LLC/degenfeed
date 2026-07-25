# DegenFeed Security Model

> **Version:** 2.0
> **Date:** 2026-07-25
> **Classification:** Internal — security-sensitive
> **Review cadence:** Quarterly

---

## Table of Contents

1. [Defense in Depth Architecture](#1-defense-in-depth-architecture)
2. [Key Management](#2-key-management)
3. [Data Encryption](#3-data-encryption)
4. [Authentication Flow](#4-authentication-flow)
5. [Authorization Model](#5-authorization-model)
6. [Incident Response Plan](#6-incident-response-plan)
7. [Security Contact](#7-security-contact)
8. [Compliance & Audits](#8-compliance--audits)
9. [Threat Model Addendum](#9-threat-model-addendum)

---

## 1. Defense in Depth Architecture

DegenFeed employs a layered security model across 7 distinct layers:

```
┌──────────────────────────────────────────────────────────────┐
│ Layer 7: Security Monitoring & Incident Response              │
│   SIEM logging, anomaly detection, circuit breakers          │
├──────────────────────────────────────────────────────────────┤
│ Layer 6: Business Logic Security                              │
│   Rate limiting, nonce validation, signature expiry           │
├──────────────────────────────────────────────────────────────┤
│ Layer 5: Application Security (Worker API)                    │
│   Input validation, CSRF protection, CSP, security headers   │
├──────────────────────────────────────────────────────────────┤
│ Layer 4: Authentication & Authorization                       │
│   Wallet signatures, session tokens, API keys, WebAuthn      │
├──────────────────────────────────────────────────────────────┤
│ Layer 3: Transport Security                                   │
│   TLS 1.3, HSTS, certificate auto-renewal                    │
├──────────────────────────────────────────────────────────────┤
│ Layer 2: Network Security                                     │
│   Cloudflare WAF, DDoS protection, Cloudflare Tunnel         │
├──────────────────────────────────────────────────────────────┤
│ Layer 1: Infrastructure Security                              │
│   Hardened containers, non-root users, read-only filesystems │
└──────────────────────────────────────────────────────────────┘
```

### 1.1 Layer 7 — Security Monitoring

| Component | Implementation | Details |
|-----------|---------------|---------|
| Security event logging | KV-backed `SecurityEvent` store | 90-day retention, 22 event types |
| Circuit breaker | Stateful (CLOSED→HALF_OPEN→OPEN) | Per-IP and per-address tracking |
| Rate limit monitoring | KV counters with escalation | Brute force → 5/min → 1/min after 3 failures |
| Error aggregation | Structured JSON logging | Route-level error tracking |
| Admin audit log | Admin action event logging | All state changes by admins recorded |

### 1.2 Layer 6 — Business Logic Security

```
┌─────────────────────────────────────────────────────────┐
│              Request Flow                                │
│                                                         │
│ 1. TLS termination (Cloudflare)                         │
│ 2. WAF rules (rate limit, IP blocklist)                │
│ 3. Request ID correlation                               │
│ 4. Security headers (CSP, HSTS, CORS)                  │
│ 5. CORS origin validation                               │
│ 6. Input validation (injection, size, type)             │
│ 7. CSRF origin + token check                           │
│ 8. API key / session authentication                    │
│ 9. Tiered rate limiting                                 │
│ 10. Circuit breaker check                              │
│ 11. Route handler → business logic                     │
│ 12. Signature verification (wallet actions)            │
│ 13. Nonce consumption (replay protection)              │
│ 14. Security event logging (async)                     │
└─────────────────────────────────────────────────────────┘
```

### 1.3 Layer 5 — Application Security

**Input validation** runs as middleware on every request (see `lib/input-validator.ts`):
- XSS and injection pattern detection (40+ patterns)
- Protocol identifier validation (Nostr, Farcaster, Bluesky, Lens)
- Wallet address validation (EVM, Solana)
- URL safety checks (reject `javascript:`, `data:`, `file:` URIs)
- Body size limits per endpoint group (512B to 2MB)
- Content-Type enforcement (JSON-only for state-changing methods)

**CSRF protection** (see `app.ts` middleware):
- Origin/Referer header validation against `ALLOWED_ORIGINS` allowlist
- `X-CSRF-Token` validation for cookie-authenticated sessions
- Bearer token requests are exempt (API clients independently authenticated)
- Webhook paths are exempt (signed payloads provide own authenticity)

**Security headers** (see `app.ts` middleware):
| Header | Value |
|--------|-------|
| `Content-Security-Policy` | Route-aware (API: `default-src 'none'`) |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` (API) / `SAMEORIGIN` (embed) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` (admin) / `cross-origin` (API) |
| `Cache-Control` | `no-store` on auth/wallet/session endpoints |

### 1.4 Layer 4 — Authentication

See [§4 Authentication Flow](#4-authentication-flow) below.

### 1.5 Layer 3 — Transport Security

- **TLS 1.3** enforced on all public endpoints via Cloudflare
- **HSTS preload** — domain registered in Chrome/Firefox HSTS preload lists
- **Certificate auto-renewal** via acme.sh with 30-day renewal window
- **OCSP stapling** enabled
- **Internal traffic** between services uses mutual TLS where available

### 1.6 Layer 2 — Network Security

- **Cloudflare WAF** — managed ruleset + custom rules for API abuse
- **DDoS protection** — Cloudflare's L3/L4/L7 mitigation
- **Cloudflare Tunnel** — no public IP for origin servers
- **IP blocklisting** — fail2ban on SSH, Cloudflare IP Access rules
- **Rate limiting** — KV-backed fixed-window counters (see §4.1 tiered approach)

### 1.7 Layer 1 — Infrastructure Security

| Measure | Implementation |
|---------|---------------|
| Container non-root | Dockerfiles specify `USER node` or 65534 |
| Read-only rootfs | Docker `--read-only` flag with tmpfs for writable dirs |
| Capability dropping | `--cap-drop=ALL --cap-add=NET_BIND_SERVICE` |
| Immutable tags | Docker images pinned by SHA256 digest |
| No secrets in images | Build args for secrets, multi-stage builds |
| Minimal base images | `node:22-alpine`, `python:3.12-slim` |

---

## 2. Key Management

### 2.1 Key Hierarchy

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Custodian (Hardware)                           │
│   Master Recovery Key — 12/24-word mnemonic (offline cold storage) │
├───────────────────────────┬─────────────────────────────────────────┤
│                           │                                         │
│           ┌───────────────┴───────────────┐                         │
│           │   HSM-Backed Key (Cloud HSM)   │                        │
│           │   AUTH_SECRET, API signing     │                        │
│           └───────────────┬───────────────┘                         │
│                           │                                         │
│           ┌───────────────┴───────────────┐                         │
│           │   Environment-Specific Keys   │                         │
│           │   Production / Staging / Dev  │                         │
│           └───────────────┬───────────────┘                         │
│                           │                                         │
│           ┌───────────────┴───────────────┐                         │
│           │    Application-Level Keys     │                         │
│           │    (per-service, rotated)     │                         │
│           └───────────────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Key Storage

| Key Type | Storage | Rotation | Access |
|----------|---------|----------|--------|
| `AUTH_SECRET` | Cloudflare Workers Secrets (encrypted env) | Every 90 days | Worker runtime only |
| API signing keys | Cloudflare Workers Secrets | Every 180 days | Worker runtime only |
| Premium wallet key | Cloudflare Workers Secrets + HSM | Per-transaction signing | Transaction service only |
| Database credentials | Docker secrets (tmpfs) | Every 30 days | Container init |
| Cloudflare API tokens | gopass (operator machines) | Every 90 days | CI/CD pipelines |
| R2 bucket keys | Cloudflare API tokens | Every 90 days | Worker runtime |
| HSM master key | Hardware Security Module (YubiHSM) | Physical rotation | Admin operations |

### 2.3 Key Rotation Policy

| Trigger | Action |
|---------|--------|
| Scheduled (90 days) | Rotate `AUTH_SECRET` — invalidate all sessions, require re-login |
| Employee offboarding | Rotate all keys accessible to departing employee |
| Security incident | Immediate rotation of compromised keys |
| Version upgrade | Rotate keys if cryptographic algorithm is deprecated |
| Post-mortem finding | Rotate keys if rotation was identified as a gap |

### 2.4 What Keys/Secrets Are NOT Used

| Prohibited Practice | Reason |
|--------------------|--------|
| Hardcoded keys in source | gitleaks pre-commit hook blocks |
| Keys in environment files | `.env` is in `.gitignore`, pre-commit check |
| Keys in Docker images | Multi-stage builds, `.dockerignore` |
| Keys in error responses | Error handler strips all sensitive data |
| Keys in logs | `console.log` in Worker strips secrets |
| Keys in URLs | API keys must be in `Authorization: Bearer` header |

---

## 3. Data Encryption

### 3.1 Encryption at Rest

| Data Store | Encryption Method | Key Management |
|-----------|-------------------|----------------|
| Cloudflare KV | Transparent encryption at rest (Cloudflare-managed) | Cloudflare KMS |
| R2 (media) | Server-side encryption with AES-256 | Cloudflare-managed |
| PostgreSQL (if used) | TDE (Transparent Data Encryption) | HSM-backed |
| Redis / DragonflyDB | AES-256 at rest (DragonflyDB enterprise) | Environment key |
| IPFS / Filecoin | Content-addressed, encryption optional | User-controlled |
| Arweave | Content-addressed, encryption optional | User-controlled |

### 3.2 Encryption in Transit

| Channel | Protocol | Details |
|---------|----------|---------|
| User → Worker | TLS 1.3 | Cloudflare edge terminates TLS |
| Worker → Internal | TLS 1.2+ (mutual TLS for critical paths) | Service bindings where possible |
| Worker → DB | TLS 1.2+ | Connection strings enforce TLS |
| Worker → Relay | WSS (TLS 1.3) | Nostr relay connections |
| Worker → Hub | gRPC with TLS | Farcaster hub connections |
| Peer-to-peer (chat) | Signal Protocol (X3DH + Double Ratchet) | Perfect Forward Secrecy |

### 3.3 End-to-End Encryption (Messaging)

```
┌────────────┐                    ┌────────────┐
│   Alice    │                    │    Bob     │
│  (Device)  │                    │  (Device)  │
└─────┬──────┘                    └─────┬──────┘
      │                                 │
      │  X3DH Key Agreement             │
      │  ──────────────────────────────▶  │
      │  ◀──────────────────────────────  │
      │                                 │
      │  Double Ratchet (per message)    │
      │  ──────────────────────────────▶  │
      │  ◀──────────────────────────────  │
      │                                 │
      │         Server (Blind Relay)     │
      │         ┌─────────────────────┐  │
      │         │ Encrypted envelopes │  │
      │         │ Cannot decrypt      │  │
      │         │ Cannot identify     │  │
      │         │ sender (Sealed Snd)│  │
      │         └─────────────────────┘  │
```

All cross-platform messaging uses the Signal Protocol:
- **X3DH** for initial key agreement
- **Double Ratchet** for per-message forward secrecy
- **Sealed Sender** for metadata protection (server cannot see sender)
- **AES-256-GCM** for message encryption
- **HMAC-SHA256** for authentication tags

### 3.4 Data Retention

| Data Category | Retention | Deletion Method |
|--------------|-----------|-----------------|
| Security event logs | 90 days | KV TTL auto-expiry |
| Session tokens | 7 days (sliding) | Cookie expiry + KV revocation |
| Chat messages | 30 days (default, user-configurable) | KV delete |
| Encrypted message envelopes | 90 days | KV TTL auto-expiry |
| Pre-key bundles | 90 days | KV TTL auto-expiry |
| Analytics data | 13 months | Rolling window |
| User content (posts) | Until account deletion | R2 + KV cascade delete |
| Media files | Until account deletion + 30 days | R2 lifecycle policy |
| Error logs | 30 days | KV TTL auto-expiry |

---

## 4. Authentication Flow

### 4.1 Primary Auth: Wallet Signature

```
┌─────────┐     ┌──────────┐     ┌────────┐
│  Client  │     │  Worker  │      │  KV    │
└────┬────┘     └────┬─────┘      └───┬────┘
     │                │                │
     │ GET /nonce     │                │
     │────────────────▶                │
     │                │ Generate nonce │
     │                │────────────────▶│
     │ { nonce }      │                │
     │◄───────────────│                │
     │                │                │
     │ User signs     │                │
     │ message with   │                │
     │ wallet         │                │
     │                │                │
     │ POST /verify   │                │
     │ { sig, nonce } │                │
     │────────────────▶                │
     │                │ Verify nonce   │
     │                │────────────────▶│
     │                │◄───────────────│
     │                │ Verify sig     │
     │                │ Create session │
     │                │ Store CSRF     │
     │                │ Log security   │
     │ { session,    │ event          │
     │   csrfToken } │                │
     │◄───────────────│                │
```

**Security properties:**
- Nonce is consumed after first use (prevents replay)
- Nonce TTL is 300 seconds
- Signatures verified via @noble/curves (secp256k1 for EVM, ed25519 for Solana)
- Session is HMAC-SHA256 signed (stateless, verified on every request)
- CSRF token stored in KV keyed by session cookie value
- Brute force protection: 5 attempts/min, then 1 attempt/min after 3 failures

### 4.2 Secondary Auth: OAuth (Protocol Connections)

| Provider | OAuth Version | Scope | Token Lifetime |
|----------|--------------|-------|----------------|
| Mastodon/GotoSocial | OAuth 2.0 | `read write follow push` | 90 days |
| Bluesky | AT Protocol | `com.atproto.*` | 2 hours (access) / 90 days (refresh) |
| GitHub | OAuth 2.0 | `user:email` | No expiry |
| Discord | OAuth 2.0 | `identify` | 7 days |
| Reddit | OAuth 2.0 | `identity` | 1 year |
| Google | OAuth 2.0 | `openid email` | 1 hour |
| Twitter/X | OAuth 2.0 | `tweet.read users.read` | 2 hours |

OAuth tokens are stored encrypted at rest. Encryption key is derived from the user's wallet address via HKDF.

### 4.3 Additional Auth Methods

| Method | Use Case | Security Level |
|--------|----------|---------------|
| WebAuthn (passkeys) | 2FA for admin accounts | High (phishing-resistant) |
| TOTP (authenticator app) | 2FA for premium accounts | Medium |
| Hardware wallet (Ledger, Trezor) | 2FA for high-value operations | Very High |
| Recovery codes | Account recovery (one-time use) | Medium (limited to 10 codes) |
| Email + password | Fallback auth (non-custodial users) | Low (avoid if possible) |

### 4.4 Session Lifecycle

```
Create: wallet verify → HMAC-signed cookie (__Host-dfid)
         ├ Max-Age: 7 days
         ├ HttpOnly: true
         ├ Secure: true
         └ SameSite: Strict

Refresh: On every authenticated request (sliding 7-day TTL)

Revoke:  POST /api/session/revoke
         ├ Nonce added to KV blocklist
         ├ CSRF token deleted
         └ Cookie cleared

Expire:  Cookie naturally expires after 7 days
         KV blocklist entry auto-expires

Revoke All: POST /api/session/revoke-all
            ├ Address-level block marker in KV (7-day TTL)
            └ All sessions for this address rejected
```

---

## 5. Authorization Model

### 5.1 Role-Based Access

| Role | Access | Auth Method |
|------|--------|-------------|
| Anonymous | Public feeds, health endpoints | None |
| Authenticated user | Own data, feed personalization | Session cookie |
| API client (read) | Public data via `/v1/*` | API key (scoped) |
| API client (write) | Limited write operations | API key (scoped) |
| Premium user | Premium features, priority rate limits | Session + subscription check |
| Admin | Admin dashboard, moderation | Session + wallet allowlist |
| System (cron) | Scheduled tasks | Internal invocation |

### 5.2 API Key Scopes

| Scope | Permissions | Rate Limit |
|-------|-------------|------------|
| `feed:read` | Read public feed data | 120 req/min |
| `tips:send` | Send tips on behalf of user | 30 req/min |
| `content:read` | Read public content | 120 req/min |
| `content:write` | Create/update content | 30 req/min |
| `admin:read` | Read admin data | 10 req/min |
| `admin:write` | Perform admin actions | 5 req/min |

### 5.3 Resource-Level Authorization

```
Rule: A user can only access their own resources unless explicitly shared.

Enforcement:
  - All data queries filter by session address
  - Cross-user operations (tips, follows) create new records, not modify existing
  - Admin operations require address in ADMIN_WALLETS env var
  - API key operations scoped to the key's owner
```

---

## 6. Incident Response Plan

### 6.1 Triage Process

```
Detection
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ 1. Identify                                              │
│    ▪ What happened?                                      │
│    ▪ When did it start?                                  │
│    ▪ What is the blast radius?                           │
│    ▪ Is it ongoing?                                      │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Contain                                               │
│    ▪ Block affected IPs (Cloudflare WAF)                 │
│    ▪ Revoke affected keys/secrets                        │
│    ▪ Reset affected tokens/sessions                      │
│    ▪ Enable circuit breaker for affected endpoints       │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Eradicate                                             │
│    ▪ Rotate all potentially compromised keys             │
│    ▪ Patch identified vulnerability                      │
│    ▪ Verify fix with security scan                       │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Recover                                               │
│    ▪ Restore from backup (if data loss)                  │
│    ▪ Verify system integrity                             │
│    ▪ Re-enable services gradually                        │
│    ▪ Monitor for recurrence                              │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Post-Mortem                                           │
│    ▪ Root cause analysis (within 72 hours)               │
│    ▪ Update security model                               │
│    ▪ Update runbooks                                     │
│    ▪ Implement preventive controls                       │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Incident Severity Matrix

| Severity | Definition | Response Time | Reporting |
|----------|-----------|---------------|-----------|
| **SEV-1** | Active data breach, system compromise, unauthorized admin access | 15 minutes | Pager + Slack + Email |
| **SEV-2** | Potential breach, crypto key compromise, authentication bypass | 1 hour | Slack + Email |
| **SEV-3** | Vulnerability discovered, suspicious activity pattern | 4 hours | Email |
| **SEV-4** | Minor issue, misconfiguration | 24 hours | Jira ticket |

### 6.3 Communication Plan

| Audience | Channel | Timing |
|----------|---------|--------|
| Internal team | Slack #security | Immediate (SEV-1/2) |
| Engineering | Slack #engineering | Within 1 hour |
| Users | `status.degenfeed.xyz` | Within 4 hours (SEV-1) |
| Regulators | Email | Within 72 hours (GDPR breach) |
| Security researchers | `security@degenfeed.xyz` | After containment |

### 6.4 Post-Mortem Requirements

Every security incident requires a post-mortem within 72 hours containing:
1. **Timeline** — when each event occurred
2. **Root cause** — the technical failure that enabled the incident
3. **Blast radius** — what data/systems were affected
4. **Containment** — what stopped the incident from spreading
5. **Recovery** — how normal operation was restored
6. **Prevention** — specific controls added to prevent recurrence
7. **Action items** — owner and due date for each fix

---

## 7. Security Contact

### 7.1 Responsible Disclosure

| Method | Details |
|--------|---------|
| Email | `security@degenfeed.xyz` |
| PGP key | Available at `/.well-known/security.txt` |
| Bug bounty | Contact for details |
| Response SLA | 48 hours acknowledgment |
| Safe harbor | We do not pursue legal action against good-faith researchers |

### 7.2 Bug Bounty Scope

| In Scope | Out of Scope |
|----------|-------------|
| Worker API vulnerabilities | Third-party relay/hub infrastructure |
| Frontend XSS/CSRF | Physical attacks |
| Authentication bypass | Social engineering |
| Smart contract vulnerabilities | Protocol-level bugs (Nostr, Farcaster, etc.) |
| Privilege escalation | Rate limiting bypass (informational only) |
| Data exposure | DNS/TCP-level attacks |

### 7.3 Internal Escalation

```
Level 1: On-call engineer (24/7 pager)
Level 2: Security team lead (within 30 min)
Level 3: CTO / Head of Engineering (within 1 hour)
Level 4: CEO (SEV-1 only)
```

---

## 8. Compliance & Audits

| Standard | Status | Next Audit |
|----------|--------|------------|
| OWASP Top 10 (2025) | Compliant | Q4 2026 |
| OWASP API Top 10 (2023) | Compliant | Q4 2026 |
| OWASP ASVS Level 2 | Target | Q1 2027 |
| SOC 2 Type I | Planned | Q2 2027 |
| GDPR | Compliant | Ongoing |

### 8.1 Third-Party Audits

| Scope | Auditor | Frequency | Last Audit |
|-------|---------|-----------|------------|
| Full web application | Internal security team | Quarterly | 2026-07-18 |
| Smart contracts | External auditor | Per deployment | TBD |
| Infrastructure | Internal ops team | Monthly | Ongoing |
| Dependency scan | Automated | Every PR | Continuous |

---

## 9. Threat Model Addendum

### 9.1 STRIDE Analysis

| Threat | Mitigation | Priority |
|--------|-----------|----------|
| **S**poofing — attacker pretends to be another user | Wallet signature verification, HMAC session cookies | Critical |
| **T**ampering — attacker modifies data in transit | TLS 1.3, HMAC session signing, signature verification | High |
| **R**epudiation — user denies their actions | Security event logging, signature audit trail | Medium |
| **I**nformation disclosure — attacker accesses unauthorized data | CORS, CSP, access control checks, encryption | Critical |
| **D**enial of service — attacker overwhelms system | Rate limiting, circuit breaker, WAF, KV-backed counters | High |
| **E**levation of privilege — attacker gains admin access | Wallet allowlist, session verification, admin guard | Critical |

### 9.2 Data Flow Diagram (Sensitive Operations)

```
User Wallet
    │
    │ Sign message
    ▼
DegenFeed Frontend (Browser)
    │
    │ HTTPS + TLS 1.3
    ▼
Cloudflare Edge (WAF + DDoS)
    │
    ▼
Worker API (Hono)
    │
    ├─► KV (Nonce, Session, CSRF)
    ├─► R2 (Media, Content)
    ├─► RPC (Blockchain interactions)
    └─► External APIs (Nostr relays, Farcaster hubs, etc.)
```

### 9.3 Trust Boundaries

| Boundary | Trust Level | Notes |
|----------|-------------|-------|
| User's browser | Low | CSP, XSS protection |
| Cloudflare edge | High | Terminates TLS, enforces WAF |
| Worker runtime | High | Sandboxed by Cloudflare |
| KV namespace | High | Encrypted at rest |
| R2 bucket | High | Encrypted at rest |
| External relay | Low | Signed events verified |
| External hub | Medium | gRPC with peer ID verification |
| Database (if used) | High | TLS + encryption at rest |

---

**Security contact:** security@degenfeed.xyz
**Last updated:** 2026-07-25
**Next review:** 2026-10-25
