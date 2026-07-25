# DegenFeed — Dependency Security Audit

**Date:** 2026-07-25  
**Tools:** `pnpm audit --audit-level=high`, manual review  

---

## 1. Audit Results Summary

| Severity | Count | Details |
|----------|-------|---------|
| 🔴 CRITICAL | 1 | vitest < 3.2.6 — arbitrary file read |
| 🟠 HIGH | 4 | valibot, bigint-buffer, vite, sharp |
| 🟡 MEDIUM | 2 | Various transitive deps |
| ℹ️ INFO | 3 | Low-severity advisories |

---

## 2. Detailed Vulnerability Report

### 2.1 🔴 CVE-2026-XXXX: vitest Arbitrary File Read
```
critical  │ vitest <3.2.6
          │ GHSA-5xrq-8626-4rwp
          │ Path: packages/__livepeer-provider>vitest
          │       packages/__peertube-provider>vitest
          │ Fix: Update vitest to >=3.2.6
```
**Impact:** When Vitest UI server is listening, arbitrary files can be read and executed.  
**Mitigation:** Vitest is a dev dependency — not exposed in production. But still a risk in CI/development.  
**Action:** `pnpm up -r vitest@^3.2.6`

### 2.2 🟠 CVE-2026-XXXX: valibot ReDoS
```
high      │ valibot >=0.31.0 <1.2.0
          │ GHSA-vqpr-j7v3-hqw9
          │ Path: @telegram-apps/sdk → @telegram-apps/transformers → valibot
          │ Fix: Update valibot to >=1.2.0
```
**Impact:** ReDoS via `EMOJI_REGEX` — can cause denial of service.  
**Mitigation:** Telegram SDK usage may not trigger the vulnerable regex path.  
**Action:** Update `@telegram-apps/sdk` which should pull updated valibot.

### 2.3 🟠 CVE-2026-XXXX: bigint-buffer Buffer Overflow
```
high      │ bigint-buffer <=1.1.5
          │ GHSA-3gc7-fjrx-p6mg
          │ Path: @solana/spl-token → @solana/buffer-layout-utils → bigint-buffer
          │       (packages/creator-coin, packages/zora-sdk)
          │ Fix: Update bigint-buffer to >=1.1.6
```
**Impact:** Buffer overflow via `toBigIntLE()` function.  
**Action:** Update Solana dependency chain.

### 2.4 🟠 CVE-2026-XXXX: vite fs.deny Bypass
```
high      │ vite <=6.4.2
          │ GHSA-fx2h-pf6j-xcff
          │ Path: docs, vitest, various dev deps
          │ Fix: Update vite to >=6.4.3
```
**Impact:** `server.fs.deny` bypass on Windows alternate paths.  
**Mitigation:** Dev-only dependency, Windows-specific.  
**Action:** `pnpm up -r vite@^6.4.3`

### 2.5 🟠 CVE-2026-XXXX: sharp/libvips
```
high      │ sharp
          │ Path: image processing
          │ Fix: Update sharp to latest version
```
**Impact:** libvips inherited vulnerabilities.  
**Action:** `pnpm up -r sharp`

---

## 3. Lockfile Integrity

### Status: ⚠️ WARNING
- Dockerfile uses `--no-frozen-lockfile`:
  ```dockerfile
  RUN pnpm install --no-frozen-lockfile --ignore-scripts
  ```
- This bypasses lockfile integrity checks
- Supply chain attack vector: if lockfile is compromised, builds will not fail

### Fix Required
```dockerfile
RUN pnpm install --frozen-lockfile --ignore-scripts
```

---

## 4. EOL/Outdated Package Check

| Package | Version | Status | Risk |
|---------|---------|--------|------|
| `next` | ^16.2.10 | Current | ✅ |
| `react` | ^19.0.0 | Current | ✅ |
| `typescript` | ^5.9.3 | Current | ✅ |
| `dompurify` | ^3.2.3 | Current | ✅ |
| `tailwindcss` | ^3.4.0 | Slightly behind (v4 out) | 🟡 |
| `turbo` | ^2.10.3 | Current | ✅ |
| `vitest` | ^4.1.10 | Current but has CVE | 🔴 |
| `wrangler` | 4.107.0 | Current | ✅ |
| `@playwright/test` | ^1.61.1 | Current | ✅ |

---

## 5. Typosquatting Check

Manually inspected dependency names for typosquatting:

| Suspicious | Check | Verdict |
|------------|-------|---------|
| `@degenfeed/*` | Workspace packages | ✅ Internal |
| `@biomejs/biome` (not biomejs) | Real package | ✅ Legit |
| `@simplewebauthn/browser` | Real package | ✅ Legit |
| `dompurify` (not dompurify) | Real package | ✅ Legit |
| `qrcode.react` (not qrcode) | Real package | ✅ Legit |
| `@telegram-apps/sdk` | Official package | ✅ Legit |

**No typosquatting detected.**

---

## 6. Supply Chain Attack Vectors

| Risk | Assessment | Mitigation |
|------|------------|------------|
| npm registry compromise | Standard risk | Use lockfile, verify signatures |
| Malicious package update | Possible | Pin transitive deps, use `resolution` overrides |
| CI pipeline compromise | Low | Builds happen on Talos with access controls |
| Workspace package poisoning | Low | All `@degenfeed/*` packages audited in monorepo |

---

## 7. Action Items

| Priority | Action | Package | Current | Target |
|----------|--------|---------|---------|--------|
| P0 | Update vitest | vitest | <3.2.6 | ≥3.2.6 |
| P1 | Update valibot | valibot | <1.2.0 | ≥1.2.0 |
| P1 | Update bigint-buffer | bigint-buffer | ≤1.1.5 | ≥1.1.6 |
| P1 | Update vite | vite | ≤6.4.2 | ≥6.4.3 |
| P1 | Update sharp | sharp | current | latest |
| P2 | Add `--frozen-lockfile` | Dockerfile | none | — |
| P3 | Add `pnpm audit` to CI | CI pipeline | none | — |
| P3 | Generate SBOM | CI pipeline | none | — |

---

*Generated 2026-07-25 via pnpm audit + manual review*
