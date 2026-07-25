# DegenFeed — OWASP Top 10 (2025/2026) Security Audit

**Audit Date:** 2026-07-25  
**Auditor:** Security Specialist — Rug Munch Media  
**Scope:** Full stack: Next.js 16 app, middleware, auth, storage, web3 packages, Docker infrastructure  
**Type:** Automated + Manual code review  

---

## Summary

| Severity | Count | Key Issues |
|----------|-------|------------|
| 🔴 CRITICAL | 3 | Plaintext secrets in IndexedDB, CSP `unsafe-eval`, vitest CVE |
| 🟠 HIGH | 7 | No CSRF protection, weak CSP, valibot ReDoS, nonce reuse potential |
| 🟡 MEDIUM | 6 | No SBOM, no audit logging middleware, SSRF in identity-hub |
| 🔵 LOW | 4 | Verbose nginx headers, `latest` image tags, no Prometheus metrics |
| ℹ️ INFO | 5 | Good: SIWE, rate limiting, fail2ban, Docker hardening, immutable contracts |

---

## 1. Broken Access Control

### 1.1 ✅ Admin Route Protection — GOOD
**File:** `apps/web/src/middleware.ts`

- Admin routes (`/api/admin/*`) protected by wallet address whitelist:
  ```typescript
  const admins = adminWallets.split(',').map((a) => a.trim().toLowerCase());
  if (!admins.includes(payload.address.toLowerCase())) {
    return stamp(forbiddenResponse(corsHeaders));
  }
  ```
- Admin wallets loaded from `ADMIN_WALLETS` env var (NOT hardcoded)
- Double-checked in `next.config.mjs`: `NEXT_PUBLIC_ADMIN_WALLETS` used for UI gating

### 1.2 ✅ Session Verification — GOOD
- Session cookie (`__Host-dfid`) HMAC-SHA256 signed
- JWT fallback via `rmi-backend` Bearer tokens
- Mutating methods (POST/PUT/PATCH/DELETE) require verified session
- Expiry check: `payload.exp < Date.now()`

### 1.3 ❌ MISSING: CSRF Protection — HIGH
**Findings:**
- `x-csrf-token` header is captured in `verifyWalletSignature()` but **never validated server-side**
- No CSRF token verification in middleware or API routes
- Session cookie is vulnerable to CSRF attacks

**Fix Required:**
```typescript
// In middleware.ts — validate CSRF for cookie-based auth
if (method !== 'GET' && _authMethod === 'wallet') {
  const csrf = request.headers.get('x-csrf-token');
  if (!csrf || !validateCsrf(csrf, payload.address)) {
    return stamp(forbiddenResponse(corsHeaders));
  }
}
```

**CWE:** CWE-352 (Cross-Site Request Forgery)  
**CVSS 3.1:** 8.8 (AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H)

---

## 2. Cryptographic Failures

### 2.1 ✅ HMAC-SHA256 for Session Tokens — GOOD
**File:** `packages/auth/src/token.ts`
- Uses Web Crypto API `HMAC` with `SHA-256`
- Secret loaded from `SESSION_SECRET` env var
- Proper base64url decoding

### 2.2 ✅ AES-GCM for Encrypted Storage — GOOD
**File:** `packages/auth/src/crypto.ts`
- PBKDF2 key derivation: 600,000 iterations, SHA-256
- AES-256-GCM encryption
- Random salt (16 bytes) and IV (12 bytes) per encryption

### 2.3 🔴 CRITICAL: Plaintext Secrets in IndexedDB
**File:** `packages/auth/src/persistence.ts`
```typescript
if (args.secret) {
  mergedKeys._secret = args.secret; // PLAINTEXT!
}
```
- Farcaster signer keys, Nostr nsec keys, Bluesky access JWTs stored **in plaintext** in IndexedDB
- Comment explicitly says "encryption with hardcoded passphrase provides no additional security"
- Any XSS can exfiltrate ALL protocol credentials

**Impact:** Compromise of all linked protocol accounts if XSS is achieved  
**CWE:** CWE-312 (Cleartext Storage of Sensitive Information)  
**CVSS 3.1:** 9.1 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N)

### 2.4 ❌ SESSION_SECRET/AUTH_SECRET Key Rotation
- No key rotation mechanism exists
- No key versioning in cookie format
- Compromised secret requires all sessions to be invalidated — no way to do this

**Fix Required:** Add key version prefix to cookie format, support multiple active keys

---

## 3. Injection

### 3.1 ✅ Cross-Site Scripting (XSS) — PARTIAL
- `apps/web/package.json` includes `dompurify: ^3.2.3` ✅
- Content Security Policy header set in next.config.mjs

### 3.2 🔴 CRITICAL: CSP `unsafe-eval` and `unsafe-inline`
**File:** `apps/web/next.config.mjs`
```javascript
"script-src 'self' 'unsafe-inline' 'unsafe-eval';"
```
- `unsafe-eval` allows `eval()`, `setTimeout(string)`, `new Function()` — XSS vector
- `unsafe-inline` allows inline script execution — bypasses CSP protections
- These are **required** by Next.js for dev mode but should be removed in production

**CWE:** CWE-79 (Cross-site Scripting)  
**CVSS 3.1:** 7.6 (AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:L/A:L)

### 3.3 ✅ API Request Validation
- No raw SQL queries found — all data via IndexedDB (client-side)
- No command injection vectors found
- Server-side API routes in middleware validate request methods

### 3.4 ❌ No Input Sanitization in Identity Hub
**File:** `packages/auth/src/identity-hub.ts`
- Wallet addresses, protocol identifiers used directly in KV keys without sanitization
- No size limits on identity metadata
- Potential for KV key injection via crafted identifiers

---

## 4. Insecure Design

### 4.1 ✅ Rate Limiting — GOOD
**File:** `apps/web/src/middleware.ts`
- Token bucket algorithm
- Tiered limits:
  - Auth: 5 req/60s
  - Tip: 10 req/60s
  - Publish: 20 req/60s
  - Admin: 20 req/60s
  - Write: 30 req/60s
  - Global: 100 req/60s
- IP-based tracking with `X-RateLimit-*` headers
- Nginx-level rate limiting in `security-headers.conf` (belt-and-suspenders)

### 4.2 ✅ Nginx Rate Limiting — GOOD
**File:** `/srv/degenfeed/nginx/security-headers.conf`
```nginx
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=federation:10m rate=60r/m;
limit_req_zone $binary_remote_addr zone=search:10m rate=10r/m;
```

### 4.3 ✅ CORS Configuration — GOOD
- Origin whitelist: `degenfeed.xyz`, `localhost:3000`, `localhost:3001`
- Credentials enabled
- Max-Age: 86400s (24h)
- Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS

### 4.4 ❌ No CSRF Tokens — HIGH
(See Section 1.3)

---

## 5. Security Misconfiguration

### 5.1 ✅ Security Headers — GOOD
**Next.js config:**
- `X-Frame-Options: DENY` ✅
- `X-Content-Type-Options: nosniff` ✅
- `Referrer-Policy: strict-origin-when-cross-origin` ✅
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` ✅
- `poweredByHeader: false` ✅

**Nginx (security-headers.conf):**
- HSTS with preload: `max-age=63072000; includeSubDomains; preload` ✅
- `Permissions-Policy` with restricted features ✅
- CSP with strong defaults ✅
- `Access-Control-Allow-Origin` properly set ✅
- `server_tokens off` ✅

### 5.2 ❌ Missing Headers
- No `Cross-Origin-Embedder-Policy` (COEP)
- No `Cross-Origin-Opener-Policy` (COOP)
- No `Cross-Origin-Resource-Policy` (CORP)

### 5.3 ❌ .env File Exposed
**File:** `/srv/degenfeed/.env`
- Contains credentials: `MEILI_MASTER_KEY`, `LEMMY_DB_PASSWORD`, `LEMMY_ADMIN_PASSWORD`, `LEMMY_PICTRS_KEY`
- Comment at top: `TODO: move ALL secrets to gopass — do not store plaintext in .env`
- File is readable by Docker containers via `env_file:` directive

### 5.4 ❌ NEXT_PUBLIC_ADMIN_WALLETS Hardcoded in Dockerfile
**File:** `/srv/degenfeed/docker-compose.yml`
```yaml
args:
  NEXT_PUBLIC_ADMIN_WALLETS: "0x1e3ac01d0fdb976179790bdd02823196a92705c9"
```
- Admin wallet address is compiled into client-side JavaScript bundle
- Reduces security of admin gating (attackers can see valid admin wallets)

---

## 6. Vulnerable and Outdated Components

### 6.1 🔴 CRITICAL: Vitest CVE
| Detail | Value |
|--------|-------|
| Package | `vitest` <3.2.6 |
| CVE | GHSA-5xrq-8626-4rwp |
| Severity | CRITICAL |
| Impact | Arbitrary file read/execute when Vitest UI is listening |
| Paths | `packages/__livepeer-provider`, `packages/__peertube-provider` |
| Fix | Update to ≥3.2.6 |

### 6.2 🟠 HIGH: valibot ReDoS
| Detail | Value |
|--------|-------|
| Package | `valibot` ≥0.31.0 <1.2.0 |
| CVE | GHSA-vqpr-j7v3-hqw9 |
| Severity | HIGH |
| Impact | ReDoS via `EMOJI_REGEX` |
| Paths | `@telegram-apps/sdk` → `@telegram-apps/transformers` |
| Fix | Update valibot to ≥1.2.0 |

### 6.3 🟠 HIGH: bigint-buffer Buffer Overflow
| Detail | Value |
|--------|-------|
| Package | `bigint-buffer` ≤1.1.5 |
| Severity | HIGH |
| Impact | Buffer overflow via `toBigIntLE()` |
| Paths | Solana SPL token dependencies |
| Fix | Update to ≥1.1.6 |

### 6.4 🟠 HIGH: vite fs.deny bypass
| Detail | Value |
|--------|-------|
| Package | `vite` ≤6.4.2 |
| Severity | HIGH |
| Impact | `server.fs.deny` bypass on Windows |
| Fix | Update to ≥6.4.3 |

### 6.5 🟠 HIGH: sharp/libvips CVEs
| Detail | Value |
|--------|-------|
| Package | `sharp` |
| Severity | HIGH |
| Impact | Inherited libvips vulnerabilities |
| Fix | Update sharp to latest |

### 6.6 ❌ `latest` Image Tags — Supply Chain Risk
Containers using `:latest` tags:
- `quay.io/redlib/redlib:latest`
- `scsibug/nostr-rs-relay:latest`
- `gabekangas/owncast:latest`

**Fix:** Pin to specific versions or digests.

---

## 7. Authentication Failures

### 7.1 ✅ SIWE (Sign-In with Ethereum) — GOOD
**File:** `packages/auth/src/providers/wallet.ts`
- Proper EIP-4361 / SIWE message format
- Domain, chain ID, nonce, issued-at, expiration time
- `window.location.host` used for domain binding

### 7.2 ✅ Solana Sign-In — GOOD
- Proper message format with nonce and timestamp
- `credentials: 'include'` for cookie-based session

### 7.3 ✅ Session Expiry — GOOD
- Cookie-based sessions have `exp` field with timestamp
- JWT tokens verified with `Date.now() / 1000 > payload.exp`
- Unlock sessions tracked with `unlockedAt`

### 7.4 ✅ HMAC-SHA256 Session Signing — GOOD
- Double verification: both in middleware and auth package
- Key imported via Web Crypto API

### 7.5 ❌ No Audit Logging for Failed Auth
**Finding:** Middleware returns 401/403 but does **not log** the event
- No centralized auth failure logging
- No alerts on brute force attempts
- Fail2ban covers nginx-level, but application-level failures are silent

---

## 8. Software and Data Integrity

### 8.1 ❌ No Lockfile Verification
- `pnpm install --no-frozen-lockfile` in Dockerfile bypasses lockfile integrity
- allows supply chain attacks if lockfile is compromised

**Fix:**
```dockerfile
RUN pnpm install --frozen-lockfile --ignore-scripts
```

### 8.2 ❌ No SBOM Generation
- No Software Bill of Materials
- Cannot verify dependency chain

### 8.3 ❌ No Package Signing Verification
- No checksum verification on installed packages
- No `pnpm audit` in CI pipeline

---

## 9. Logging and Monitoring

### 9.1 ✅ Fail2ban — GOOD
**File:** `/srv/degenfeed/fail2ban/jail.local`
- SSH: 5 retries, 1h ban
- Nginx auth: 10 retries, 30min ban
- Nginx 404 flood: 60 req/60s, 30min ban
- Bot search: 10 retries, 24h ban
- Rate limit abuse: 5 retries, 1h ban

### 9.2 ✅ Health Checks — GOOD
- All Docker services have health checks
- Prometheus targets configured: `/srv/degenfeed/prometheus-targets.json`

### 9.3 ❌ No Application-Level Security Audit Logging
- No structured audit events for:
  - Auth failures (invalid signatures)
  - Admin actions
  - Rate limit exceedances
  - Suspicious requests
- Correlation ID (`x-request-id`) present but not logged

### 9.4 ❌ No SIEM Integration
- No log aggregation to external SIEM
- No alerting rules for security events
- No retention policy for audit logs

---

## 10. Server-Side Request Forgery (SSRF)

### 10.1 ✅ Image Remote Patterns — GOOD
**File:** `next.config.mjs`
```javascript
remotePatterns: [
  { protocol: 'https', hostname: '**.degenfeed.xyz' },
  { protocol: 'https', hostname: 'pbs.twimg.com' },
  // ...strict allowlist
]
```
- Whitelist approach prevents SSRF via image optimization

### 10.2 🟡 MEDIUM: SSRF Risk in Identity Hub
**File:** `packages/auth/src/identity-hub.ts`
```typescript
const res = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createAccount`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ handle, email: ... }),
});
```
- `pdsUrl` is hardcoded ✅ (`https://pds.degenfeed.xyz`)
- But if `encryptionSecret` is ever empty, no data validation on responses
- Auto-create endpoint accepts protocol list from caller — could be abused

### 10.3 ✅ No Open Redirectors
- No user-controlled redirects found
- All URLs in `remotePatterns` are static

### 10.4 ✅ Cloudflare WAF Mitigation
- Requests go through Cloudflare before reaching origin
- WAF rules can block SSRF attempts at edge

---

## Fix Priority Matrix

| ID | Finding | Severity | Effort | Priority |
|----|---------|----------|--------|----------|
| F-1 | Plaintext secrets in IndexedDB | CRITICAL | 2 days | P0 |
| F-2 | CSP `unsafe-eval` + `unsafe-inline` | CRITICAL | 4 hours | P0 |
| F-3 | vitest CVE (dev only, lower risk | CRITICAL | 30 min | P0 |
| F-4 | Missing CSRF protection | HIGH | 1 day | P1 |
| F-5 | valibot ReDoS CVE | HIGH | 1 hour | P1 |
| F-6 | bigint-buffer overflow CVE | HIGH | 1 hour | P1 |
| F-7 | `latest` image tags | HIGH | 2 hours | P1 |
| F-8 | SSRF in identity-hub auto-create | MEDIUM | 4 hours | P2 |
| F-9 | No audit logging | MEDIUM | 2 days | P2 |
| F-10 | No lockfile verification | MEDIUM | 30 min | P2 |
| F-11 | No SBOM | MEDIUM | 1 hour | P3 |
| F-12 | Missing COOP/COEP/CORP headers | LOW | 30 min | P3 |

---

## OWASP Risk Score Summary

| Category | Score (1-10) | Assessment |
|----------|--------------|------------|
| A01: Broken Access Control | 4/10 | Good middleware, missing CSRF |
| A02: Cryptographic Failures | 7/10 | Strong crypto, but plaintext IndexedDB |
| A03: Injection | 5/10 | CSP issues, no SQL injection |
| A04: Insecure Design | 3/10 | Rate limiting good, CSRF missing |
| A05: Security Misconfiguration | 4/10 | Good headers, exposed .env |
| A06: Vulnerable Components | 6/10 | CVEs found, `latest` tags |
| A07: Auth Failures | 3/10 | SIWE good, no logging |
| A08: Software Integrity | 5/10 | No SBOM, no lockfile check |
| A09: Logging/Monitoring | 5/10 | Fail2ban good, app-level missing |
| A10: SSRF | 2/10 | Remote patterns good, minor risk |
| **OVERALL** | **4.4/10** | **Multiple critical/high issues** |

---

## Remediation Plan

### Immediate (24h)
1. Remove `'unsafe-eval'` from CSP and use strict CSP with nonces
2. Update vitest, valibot, bigint-buffer, vite, sharp
3. Pin all Docker images to specific versions
4. Add `.env` to `.gitignore` and migrate secrets to gopass

### Short Term (1 week)
1. Implement CSRF protection with double-submit cookie pattern
2. Encrypt plaintext secrets in IndexedDB with wallet-derived key
3. Add application-level audit logging middleware
4. Add `--frozen-lockfile` to Dockerfile

### Medium Term (1 month)
1. Add SBOM generation to CI pipeline
2. Add SAST scanning (Semgrep, CodeQL)
3. Implement COOP/COEP/CORP headers
4. Add Prometheus metrics for security events

---

*Audit performed 2026-07-25 by Security Specialist — Rug Munch Media*
