# DegenFeed Security Testing Plan

> **Version:** 1.0
> **Date:** 2026-07-25
> **Scope:** All DegenFeed components (Worker API, frontend, infrastructure, smart contracts)
> **Standard:** OWASP Top 10 (2025), OWASP API Top 10 (2023), OWASP ASVS Level 2

---

## Table of Contents

1. [Smart Contract Security Testing](#1-smart-contract-security-testing)
2. [API Security Testing](#2-api-security-testing)
3. [Frontend Security Testing](#3-frontend-security-testing)
4. [Infrastructure Security Testing](#4-infrastructure-security-testing)
5. [Web3-Specific Security Testing](#5-web3-specific-security-testing)
6. [Test Matrix Summary](#6-test-matrix-summary)
7. [Testing Tools & Automation](#7-testing-tools--automation)
8. [Remediation SLA](#8-remediation-sla)

---

## 1. Smart Contract Security Testing

### 1.1 Reentrancy

**Test cases:**
| # | Test | Expected Behavior | Tool |
|---|------|-------------------|------|
| R-01 | External call in `withdraw()` before state update | Revert with `ReentrancyGuard` activated | Slither, Echidna |
| R-02 | Cross-function reentrancy (two functions sharing state) | Revert or state consistent | Manual review |
| R-03 | Read-only reentrancy via view functions | State must be consistent even during reentrancy | Foundry fuzz |
| R-04 | ERC-1155/ERC-777 callback reentrancy | CEI pattern verified | Slither |

**Implementation requirements:**
- All state-changing functions use `ReentrancyGuard` from OpenZeppelin
- CEI (Checks-Effects-Interactions) pattern enforced in code review
- No `tx.origin` checks — use `msg.sender`

### 1.2 Integer Overflow / Underflow

| # | Test | Expected | Tool |
|---|------|----------|------|
| INT-01 | `totalSupply + amount > MAX` | Revert on overflow | Foundry fuzz |
| INT-02 | `balance - amount < 0` | Revert on underflow | Foundry fuzz |
| INT-03 | Multiplication overflow in fee calculation | Use SafeMath / Solidity 0.8+ built-in | Slither |
| INT-04 | Block timestamp manipulation in time-dependent logic | Use block number, not timestamp | Manual |

### 1.3 Access Control

| # | Test | Expected | Tool |
|---|------|----------|------|
| AC-01 | Non-owner calls `onlyOwner` function | Revert | Foundry |
| AC-02 | Non-admin calls `onlyAdmin` function | Revert | Foundry |
| AC-03 | Renounced ownership still allows privileged ops | Function must be locked | Manual |
| AC-04 | Role inheritance (DEFAULT_ADMIN_ROLE vs MINTER_ROLE) | Correct hierarchy enforced | OpenZeppelin test |
| AC-05 | Self-destruct protection | `selfdestruct` should revert | Slither |

### 1.4 Flash Loan Attacks

| # | Test | Expected | Tool |
|---|------|----------|------|
| FL-01 | Flash loan manipulates oracle price within a single tx | Oracle uses TWAP, not spot price | Echidna |
| FL-02 | Flash loan manipulates LP reserves | Verify invariant before and after | Foundry invariant |
| FL-03 | Re-entering contract after flash loan | ReentrancyGuard must protect | Echidna |

### 1.5 Solana Program Testing (Anchor)

| # | Test | Expected | Tool |
|---|------|----------|------|
| SP-01 | Account validation bypass (wrong account type) | Anchor `Account` macro catches mismatch | Anchor tests |
| SP-02 | Signer check missing on privileged instruction | `Signer` type required | Trident |
| SP-03 | Arbitrary CPI (cross-program invocation) | CPI targets must be allowlisted | Manual |
| SP-04 | Account closing — rent reclamation steal | Close account after draining rent | Manual |

---

## 2. API Security Testing

### 2.1 Authentication Bypass

| # | Test | Expected Behavior | Tool |
|---|------|-------------------|------|
| AUTH-01 | Request without `Authorization` header to protected route | `401 Unauthorized` | Postman, curl |
| AUTH-02 | Request with expired JWT/session | `401 Unauthorized` | Custom script |
| AUTH-03 | Request with malformed JWT (alg:none) | `401 Unauthorized` | jwt_tool |
| AUTH-04 | JWT token with modified payload | Signature verification fails | Custom |
| AUTH-05 | Session replay after logout (`clearSessionCookie`) | `401 Unauthorized`, session revoked | Custom |
| AUTH-06 | CSRF token reuse across sessions | Token mismatch → 403 | Custom |
| AUTH-07 | API key in URL query param (instead of header) | Should warn or reject | Automated scan |

### 2.2 Rate Limit Bypass

| # | Test | Expected | Tool |
|---|------|----------|------|
| RL-01 | Rapid requests to `/api/auth/wallet/verify` | 429 after 5 attempts/min | wrk, ab |
| RL-02 | IP rotation to bypass rate limits | Per-IP limit enforced | Custom |
| RL-03 | `X-Forwarded-For` spoofing to reset rate limit | Trust CF-Connecting-IP only | Custom |
| RL-04 | Rate limit on `GET /api/feed/*` | 1000/min anon, 2000/min auth | wrk |
| RL-05 | Brute force protection: 3 failures → 1 req/min escalation | Block after pattern detected | Custom |

### 2.3 Injection Attacks

| # | Test | Expected | Tool |
|---|------|----------|------|
| INJ-01 | SQL injection in query params | Rejected by input validator | sqlmap |
| INJ-02 | NoSQL injection in JSON body | Rejected by input validator | Custom |
| INJ-03 | XSS in name/bio fields (stored XSS) | HTML-escaped on output | ZAP |
| INJ-04 | XSS via `Content-Type: text/html` response | Content-Type must be JSON | ZAP |
| INJ-05 | SSTI in email templates | Template engine auto-escapes | Manual |
| INJ-06 | Path traversal in file uploads (`../../../etc/passwd`) | Rejected by URL validator | Custom |
| INJ-07 | LDAP injection in authentication flow | Not applicable (wallet auth) | N/A |
| INJ-08 | XXE in XML processing | Not applicable (JSON only) | N/A |

### 2.4 CSRF

| # | Test | Expected | Tool |
|---|------|----------|------|
| CSRF-01 | POST without Origin/Referer header | 403 | Custom header manipulation |
| CSRF-02 | POST with spoofed Origin header | 403 if not in allowlist | Custom |
| CSRF-03 | POST without X-CSRF-Token (cookie session) | 403 | Custom |
| CSRF-04 | Cross-origin GET to sensitive route | Safe methods allowed | CORS checker |
| CSRF-05 | CSRF on `/api/auth/*` endpoints | OAuth state nonce protects | Manual |

### 2.5 Mass Assignment

| # | Test | Expected | Tool |
|---|------|----------|------|
| MA-01 | Set `role=admin` in user registration payload | Field ignored or rejected | Custom |
| MA-02 | Set `balance=999999` in profile update | Field not writable | Custom |
| MA-03 | Set `isVerified=true` in any request | Not updatable via API | Custom |

---

## 3. Frontend Security Testing

### 3.1 Cross-Site Scripting (XSS)

| # | Test | Expected | Tool |
|---|------|----------|------|
| XSS-01 | Stored XSS in feed item display | React auto-escapes, CSP blocks inline scripts | Playwright |
| XSS-02 | DOM-based XSS via URL hash/fragment | Sanitize `location.hash` before use | Playwright |
| XSS-03 | Stored XSS in user bio/meta | Sanitize on input, escape on output | ZAP |
| XSS-04 | Mermaid/LaTeX injection in markdown | Strip dangerous elements | Playwright |
| XSS-05 | SVG upload with embedded XSS | Strip `<script>` from SVGs | Custom |

### 3.2 CSP Bypass

| # | Test | Expected | Tool |
|---|------|----------|------|
| CSP-01 | Inline script injection | Blocked by CSP `script-src 'self'` | Browser dev tools |
| CSP-02 | `eval()` usage | Blocked by CSP `'unsafe-eval'` absent | CSP evaluator |
| CSP-03 | `data:` URI in script src | Blocked by CSP unless allowed | CSP evaluator |
| CSP-04 | JSONP endpoint abuse | CSP `connect-src` restricts | Manual review |

### 3.3 Clickjacking

| # | Test | Expected | Tool |
|---|------|----------|------|
| CJ-01 | Embed `/api/profile/delete` in iframe | X-Frame-Options: DENY | Custom test page |
| CJ-02 | Embed login page in iframe | X-Frame-Options: SAMEORIGIN | Custom test page |
| CJ-03 | Embed widget in third-party iframe | Intentional (frame-ancestors *) | Manual |

### 3.4 Wallet Connection Security

| # | Test | Expected | Tool |
|---|------|----------|------|
| WC-01 | Fake wallet provider (iframe injection) | EIP-1193 provider validation | Playwright |
| WC-02 | `eth_requestAccounts` before user gesture | Must be user-initiated | Manual |
| WC-03 | Chain ID manipulation (phishing chain) | Verify chain matches expected | Manual |
| WC-04 | WalletConnect deep link phishing | Validate URI origin | Manual |

---

## 4. Infrastructure Security Testing

### 4.1 Docker Container Security

| # | Test | Expected | Tool |
|---|------|----------|------|
| DOCK-01 | Container runs as root | Non-root user required | `docker scan`, `grype` |
| DOCK-02 | Container has unnecessary capabilities | Drop all, add only needed | `capsh --print` |
| DOCK-03 | Container can escape via `--privileged` | Not privileged | `docker inspect` |
| DOCK-04 | Secrets in environment variables | Use Docker secrets or vault | `trivy` |
| DOCK-05 | Image has high-severity CVEs | Must be patched | `grype`, `trivy` |
| DOCK-06 | Container has writable rootfs | Read-only rootfs enforced | Container config |

### 4.2 Network Exposure

| # | Test | Expected | Tool |
|---|------|----------|------|
| NET-01 | Unnecessary ports exposed | Only 80/443, 22 (admin only) | `nmap` |
| NET-02 | Internal services exposed to internet | Cloudflare Tunnel only | `nmap`, Cloudflare |
| NET-03 | Database accessible from outside | `0.0.0.0` binding → reject | `ss -tlnp` |
| NET-04 | Redis without authentication | `requirepass` must be set | `nmap` + Redis scan |
| NET-05 | DNS zone transfer enabled | Must be locked | `dig axfr` |

### 4.3 Secret Leakage

| # | Test | Expected | Tool |
|---|------|----------|------|
| SEC-01 | Hardcoded API keys in source code | Pre-commit hooks catch | `gitleaks` |
| SEC-02 | `.env` committed to git | `.env` in `.gitignore`, pre-commit check | `gitleaks` |
| SEC-03 | Secrets in CI logs | Redact by CI system | Manual |
| SEC-04 | Secrets in Docker image layers | Multi-stage builds, `.dockerignore` | `dive`, `trivy` |
| SEC-05 | Secrets in error responses | Never include in response body | Manual |

### 4.4 TLS / SSL

| # | Test | Expected | Tool |
|---|------|----------|------|
| TLS-01 | Weak cipher suites | TLS 1.2+ only, strong ciphers | `testssl.sh` |
| TLS-02 | Expired certificate | Auto-renewal via acme.sh | `certbot` |
| TLS-03 | HSTS not enforced | `Strict-Transport-Security` header present | `securityheaders.com` |
| TLS-04 | OCSP stapling | Enabled | `openssl s_client` |

---

## 5. Web3-Specific Security Testing

### 5.1 Signature Replay

| # | Test | Expected | Tool |
|---|------|----------|------|
| SR-01 | Reuse nonce from `/api/auth/wallet/nonce` | Nonce consumed after use | Custom test |
| SR-02 | Replay signed message on different chain | EIP-712 includes `chainId` | Manual |
| SR-03 | Replay signed typed data after deadline | Deadline in EIP-712 message | Manual |
| SR-04 | Cross-chain replay (Ethereum → Polygon) | Different contract address in domain | Manual |

### 5.2 Nonce Reuse

| # | Test | Expected | Tool |
|---|------|----------|------|
| NR-01 | Same nonce used for two wallet verifications | Second call returns 401 | Custom |
| NR-02 | Predictable nonce (sequential, timestamp) | Crypto.randomBytes(32) | Custom |
| NR-03 | Nonce stored without expiry | KV TTL = 300 seconds | Manual |

### 5.3 Wallet Hijacking

| # | Test | Expected | Tool |
|---|------|----------|------|
| WH-01 | Attacker swaps wallet address mid-connection | Provider mismatch detection | Manual |
| WH-02 | Signature request URI phishing | Validate domain in WalletConnect | Manual |
| WH-03 | Session key theft via XSS | CSP + HttpOnly cookie mitigates | Playwright |
| WH-04 | Hardware wallet address verification skip | Require display verification | Manual |

### 5.4 MEV Protection

| # | Test | Expected | Tool |
|---|------|----------|------|
| MEV-01 | Sandwich attack on swap | Slippage protection + deadline | Foundry |
| MEV-02 | Frontrun on tip placement | Commit-reveal scheme considered | Manual |
| MEV-03 | Backrun on dispatcher call | Sequential nonce prevents reorder | Manual |
| MEV-04 | Flashbots / private mempool | RPC configured for private txs | RPC config |

### 5.5 Oracle Manipulation

| # | Test | Expected | Tool |
|---|------|----------|------|
| OR-01 | TWAP manipulation with large swap | Use multi-block TWAP | Echidna |
| OR-02 | Oracle frontrun | Use multiple oracle sources | Manual |
| OR-03 | Stale oracle price | Check oracle freshness (timestamp) | Manual |

---

## 6. Test Matrix Summary

| Category | Tests | Manual | Automated | Critical | High | Medium | Low |
|----------|-------|--------|-----------|----------|------|--------|-----|
| Smart Contract | 18 | 8 | 10 | 6 | 7 | 4 | 1 |
| API Security | 20 | 5 | 15 | 8 | 6 | 5 | 1 |
| Frontend Security | 15 | 5 | 10 | 5 | 5 | 4 | 1 |
| Infrastructure | 17 | 4 | 13 | 7 | 6 | 3 | 1 |
| Web3-Specific | 19 | 9 | 10 | 8 | 6 | 4 | 1 |
| **Total** | **89** | **31** | **58** | **34** | **30** | **20** | **5** |

---

## 7. Testing Tools & Automation

### 7.1 SAST (Static Analysis)

| Tool | Scope | Integration |
|------|-------|-------------|
| Semgrep | TypeScript, Solidity | CI (`semgrep --config=auto`) |
| CodeQL | TypeScript, Solidity | CI (GitHub Actions) |
| Slither | Solidity | CI (pre-deploy gate) |
| ESLint security plugin | TypeScript | `pnpm lint` |
| gitleaks | All files | Pre-commit hook |

### 7.2 DAST (Dynamic Analysis)

| Tool | Scope | Frequency |
|------|-------|-----------|
| OWASP ZAP | API, Frontend | Weekly (scheduled) |
| nuclei | Infrastructure | Daily |
| testssl.sh | TLS endpoints | Weekly |
| nmap | Network | Monthly |

### 7.3 Fuzzing

| Tool | Scope | Integration |
|------|-------|-------------|
| Foundry fuzz | Solana/EVM contracts | Pre-deploy |
| Echidna | EVM invariants | Weekly |
| sqlmap | API SQLi | Monthly |
| Burp Intruder / custom | API endpoints | Ad-hoc |

### 7.4 Dependency Scanning

| Tool | Scope | Frequency |
|------|-------|-----------|
| `pnpm audit` | Node.js deps | Every PR |
| Renovate | Auto-update | Continuous |
| Dependabot | GitHub integration | Continuous |
| `trivy` | Container images | Every build |

---

## 8. Remediation SLA

| Severity | Response | Fix Timeframe |
|----------|----------|---------------|
| **Critical** | Immediate (pager) | 24 hours |
| **High** | Within 4 hours | 72 hours |
| **Medium** | Within 24 hours | 7 days |
| **Low** | Next sprint | 30 days |

---

**Owner:** Security Team, Rug Munch Media
**Last updated:** 2026-07-25
