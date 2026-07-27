# NEXT WINS — Production Roadmap & Priorities

> **Synthesis Date:** 2026-07-25
> **Scope:** degenfeed-web monorepo (2,390 TS/TSX files, 43 packages, 241 routes, 420 components, 189 pages)
> **Infrastructure:** Talos (netcup), Hydra (contabo), Cinnabox, Cloudflare (Pages + Workers + KV + DNS)

---

## TABLE OF CONTENTS

1. [CURRENT STATE SUMMARY](#1-current-state-summary)
2. [PRIORITIZED GAPS](#2-prioritized-gaps)
3. [ROADMAP](#3-roadmap)
4. [PRODUCTION READINESS ASSESSMENT](#4-production-readiness-assessment)
5. [QUALITY SCORECARD](#5-quality-scorecard)
6. [FINAL RECOMMENDATIONS](#6-final-recommendations)

---

## 1. CURRENT STATE SUMMARY

### What's Running in Production

| Area | Status | Details |
|------|--------|---------|
| **Frontend** | ✅ Live | Next.js 15 + React 19 on Cloudflare Pages at app.degenfeed.xyz |
| **Landing** | ✅ Live | degenfeed.xyz served via Cloudflare Worker |
| **API** | ✅ Live | Hono/CF Worker 241 routes, 170 lib files, 59 feed files |
| **Feed Aggregation** | ✅ Live | 12 protocol feeds, 25 protocol ecosystem |
| **Auth** | ✅ Live | OIDC + Wallet (Solana+EVM) + session cookies |
| **Composer** | ✅ Live | Cross-protocol publishing to Nostr/FC/Lens/BSky/Mastodon |
| **Premium** | ✅ Live | Tier system ($0/$10/$25/Enterprise) |
| **Notifications** | ✅ Live | Unified notification bell |
| **News** | ✅ Live | 31 sources, 50+ stories |
| **Video Hub** | ✅ Live | PeerTube + YouTube + Owncast |
| **Audio Spaces** | 🔴 NOT | Nostr Nests 404 |
| **Self-hosted** | ✅ | GotoSocial, Lemmy, Owncast (partial) |
| **Monitoring** | ✅ | Uptime Kuma (7 services) |

### Scale

| Metric | Count |
|--------|-------|
| JS/TS files | 2,390 |
| API routes | 241 |
| Frontend components | 420 |
| Frontend pages | 189 |
| Packages | 43 |
| Bridge providers | 85 (89 files) |
| Protocol ecosystem | 25 (4 OWN, 12 PARTICIPATE, 9 BRIDGE) |
| Test files | 147 (plus 15 e2e) |
| Large files >1000 lines | 30+ |
| Infrastructure hosts | 4 (Cloudflare, Talos, Hydra, Cinnabox) |
| Docker containers | 19 running |

---

## 2. PRIORITIZED GAPS

### 🔴 CRITICAL — Ship-Blocking (Fix Before Production Launch)

| # | Gap | Area | Effort | Impact | Details |
|---|-----|------|--------|--------|---------|
| C1 | **8 packages fail typecheck** | Backend/API | 2d | HIGH | @degenfeed/spaces-audio, ranking, web3, mastodon-sdk, feed-core, zora-sdk, realtime all have type errors. This means the "make ci" gate is not authoritative. |
| C2 | **15 dependency vulnerabilities (7 high)** | Security | 1d | HIGH | next@16.2.10 (4 SSRF/DoS), postcss (path traversal), sharp (libvips CVEs), brace-expansion (DoS). Next bump to 16.2.11 patches 4 of these. |
| C3 | **Stripe production keys** | Business/Security | 0.5d | HIGH | Test mode only — no real payments. Requires rotating pk_test key in Stripe dashboard + gopass. |
| C4 | **Nostr Nests (spaces.degenfeed.xyz) down** | Infra | 1d | MEDIUM | 404 — service needs restart on Hydra. Blocks audio spaces feature. |
| C5 | **Feed API cold-start timeout (8s)** | API | 1d | MEDIUM | First request after cache expiry times out. KV warmup cron needed. |
| C6 | **CI gates not authoritative** | DevOps | 1d | HIGH | `continue-on-error: true` and `|| true` in pipelines. CI currently doesn't fail when it should. |

### 🟠 HIGH — Major Quality Issues (Fix Before Public Beta)

| # | Gap | Area | Effort | Impact | Details |
|---|-----|------|--------|--------|---------|
| H1 | **Large file decomposition** | Code Quality | 3d | HIGH | 30+ files >1000 lines. Worst: rss/config.ts (2832), video/page.tsx (2145), rss.ts (1821), video-platform-wrapper (1627), live-aggregator (1562), VideoCall.tsx (1474), unified-room.ts (1431), feed-core/index.ts (1423), crossposter.ts (1372) |
| H2 | **Missing mobile layout** | Frontend | 2d | HIGH | Bottom nav not implemented. Right sidebar hidden on mobile but no proper responsive layout. Safe-area not handled. |
| H3 | **Bridge write paths blocked** | Bridge | 2d | MEDIUM | Farcaster→AP and Lens→AP bridge write paths missing GTS_ACCESS_TOKEN. Cross-protocol posting half-functional. |
| H4 | **Owncast status API 403** | Infra | 0.5d | LOW | Streaming server status endpoint returns 403. Need auth config fix. |
| H5 | **Test coverage unknown/insufficient** | Quality | 3d | HIGH | 147 test files across 2,390 source files — many packages have zero tests. No coverage threshold in CI. |
| H6 | **MeiliSearch not fully configured** | Search | 1d | MEDIUM | Indexing complete, but search frontend not wired. Search bar shows but doesn't search. |
| H7 | **No performance budget** | Frontend | 0.5d | MEDIUM | No Lighthouse CI thresholds, no bundle size monitoring, no performance regression detection. |
| H8 | **'unsafe-eval' in CSP** | Security | 1d | LOW | Next.js CSP includes unsafe-eval. Needs client-side eval audit to remove. |

### 🟡 MEDIUM — Important But Not Blocking

| # | Gap | Area | Effort | Impact | Details |
|---|-----|------|--------|--------|---------|
| M1 | **Code split god bundles** | Code Quality | 5d | MEDIUM | 170 lib files in workers/api/src/lib/ — many >800 lines, should be directories with sub-modules |
| M2 | **KV rate limiter not atomic** | Architecture | 1d | LOW | CF Workers isolates may race on KV writes. Worst case: slight over-allowance. Durable Objects fix. |
| M3 | **No IP reputation/blocklist** | Security | 2d | MEDIUM | Need Cloudflare WAF or IP intelligence integration for feed endpoints. |
| M4 | **Documentation contradictions** | Docs | 1d | LOW | Old IPs ([INTERNAL_IP], [INTERNAL_IP]), wrong service locations, stale file-size claims. |
| M5 | **Structured logging missing** | Observability | 2d | MEDIUM | Most API routes use console.log. No structured logger with correlation IDs. |
| M6 | **MeiliSearch frontend integration** | Frontend | 2d | MEDIUM | Global search bar exists but doesn't connect to MeiliSearch. |
| M7 | **Renovate bot token placeholder** | DevOps | 0.5d | LOW | Renovate can't run — token still placeholder in config. |
| M8 | **gitleaks pre-commit missing** | Security | 0.5d | LOW | Not in lefthook.yml — secrets could be committed. |

### 🔵 LOW — Nice to Have

| # | Gap | Area | Effort | Details |
|---|-----|------|--------|---------|
| L1 | Protocol health dashboard UI | Feature | 2d | /api/feed/health exists but no UI |
| L2 | Newsletter email sending | Feature | 3d | Digest content works, no email path (Postmark/SES) |
| L3 | Mobile PWA install prompt | UX | 1d | AddToHomeScreenToast exists but not optimized |
| L4 | Keyboard shortcuts | UX | 0.5d | Basic shortcuts exist |
| L5 | Cross-posting bridge pairs | Feature | 3d | Only Mastodon→Nostr working |
| L6 | Repost/quote preview in composer | UX | 1d | Not implemented |
| L7 | Dark mode persistence | UX | 0.5d | Basic support exists |
| L8 | dgenfeed-web radicle remote | DevOps | 0.5d | Not on radicle network |

---

## 3. ROADMAP

### WEEK 1-2: Critical Fixes (July 27 - Aug 7)

| Day | Task | Priority | Owner | Verification |
|-----|------|----------|-------|-------------|
| 1 | **Fix 8 package type errors** | 🔴 C1 | Backend | `pnpm typecheck` passes on all 30 packages |
| 1 | **Bump next@16.2.10 → 16.2.11** | 🔴 C2 | Backend | `pnpm audit` shows 0 high |
| 2 | **Run pnpm update for transitive deps** | 🔴 C2 | Backend | postcss ≥8.5.18, sharp ≥0.35.0 |
| 2 | **Restart Nostr Nests on Hydra** | 🔴 C4 | DevOps | spaces.degenfeed.xyz returns 200 |
| 3 | **Add feed cache warmup cron** | 🔴 C5 | Backend | KV warmup every 60s, cold-start <2s |
| 3 | **Fix CI gates (remove || true)** | 🔴 C6 | DevOps | CI fails on lint/typecheck errors |
| 4 | **Rotate Stripe keys → production** | 🔴 C3 | Business | Stripe dashboard → gopass → .env.secrets |
| 4 | **Fix Owncast status API** | 🟠 H4 | DevOps | video.degenfeed.xyz status returns 200 |
| 5-6 | **Split top 10 largest files** | 🟠 H1 | Backend | 10 files >1500 lines split into modules |
| 7 | **Setup coverage thresholds** | 🟠 H5 | Quality | CI enforces ≥50% on new code |
| 8 | **Add mobile bottom nav** | 🟠 H2 | Frontend | Mobile layout with Home/Search/Notify/Profile |
| 9 | **Configure MeiliSearch** | 🟠 H6 | Backend | Search bar returns MeiliSearch results |
| 10 | **Remove 'unsafe-eval' from CSP** | 🟠 H8 | Security | CSP hardened, eval usage eliminated |

**Week 1-2 Exit Criteria:**
- [ ] `pnpm typecheck` passes on all packages
- [ ] `pnpm audit` shows 0 high/7 moderate (transitive only)
- [ ] Spaces.degenfeed.xyz online
- [ ] Owncast status online
- [ ] Feed cold-start < 2s
- [ ] CI fails on real errors
- [ ] Stripe production keys active
- [ ] Mobile bottom nav functional
- [ ] MeiliSearch returns results

### WEEK 3-4: High Priority Improvements (Aug 10 - Aug 21)

| Day | Task | Ref | Effort | Details |
|-----|------|-----|--------|---------|
| 1-2 | **Bridge write paths: GTS_ACCESS_TOKEN** | 🟠 H3 | 2d | FC→AP, Lens→AP auth tokens from gopass |
| 3-4 | **Code split god libraries** | 🟠 M1 | 2d | Split 170 lib files, group into sub-modules |
| 5 | **Structured logging (Pino/Console)** | 🟠 M5 | 2d | Replace console.log with structured logger, correlation IDs |
| 6 | **Add IP reputation/blocklist** | 🟠 M3 | 2d | Cloudflare WAF rules for feed endpoints |
| 7 | **KV → Durable Objects rate limiter** | 🟠 M2 | 1d | Atomic rate limiting, no race conditions |
| 8 | **Fix documentation contradictions** | 🟠 M4 | 1d | Update IPs, service locations, file-size claims |
| 9 | **Setup Renovate with real token** | 🟠 M7 | 0.5d | Forgejo PAT → Renovate env → automated updates |
| 10 | **Add gitleaks to lefthook.yml** | 🟠 M8 | 0.5d | Pre-commit secret detection |

**Week 3-4 Exit Criteria:**
- [ ] Bridge write paths working (FC→AP, Lens→AP)
- [ ] Structured logging across all API routes
- [ ] WAF rate limiting active
- [ ] Documentation updated and consistent
- [ ] Renovate running automated updates
- [ ] gitleaks in pre-commit hooks

### MONTH 2: Medium Priority Polish (Aug 24 - Sep 18)

| Task | Ref | Effort | Details |
|------|-----|--------|---------|
| Protocol health dashboard | L1 | 2d | /status page showing all 25 protocol statuses |
| Performance budget in CI | H7 | 0.5d | Lighthouse thresholds, bundle size monitoring |
| Newsletter email sending | L2 | 3d | Postmark/SES integration, cron trigger |
| Cross-posting bridge expansion | L5 | 3d | 3 more bridge pairs (Nostr→BSky, FC→Mastodon, etc.) |
| PWA install prompt optimization | L3 | 1d | Service worker, offline support |
| Repost/quote preview in composer | L6 | 1d | Preview component with protocol-aware rendering |
| Feed cold-start elimination | C5 | 2d | Pre-warm on deploy, predictive warming |
| Split remaining large files >800 lines | H1 | 3d | Target: no file >800 lines |
| Dark mode persistence | L7 | 0.5d | localStorage + system preference respect |
| Add radicle remote | L8 | 0.5d | degenfeed-web on radicle network |

### MONTH 3+: Features and Expansion (Sep 21 - Oct 31)

| Theme | Tasks | Effort | Impact |
|-------|-------|--------|--------|
| **Enterprise** | SSO/SAML, audit logging, role-based access, dedicated instances | 2w | Revenue tier |
| **Monetization** | Blinks checkout full flow, creator tipping analytics, premium embed widget GA | 1w | Revenue |
| **Mobile App** | React Native / Capacitor app for iOS + Android | 3w | Reach |
| **AI Features** | AI content summary, personalized feed ML model, smart notifications | 2w | Engagement |
| **Protocol Expansion** | Add 10 more bridge providers, Matrix chat integration, Discord bot bridge | 2w | Ecosystem |
| **Performance** | Edge caching strategy, image CDN optimization, code splitting audit | 1w | UX |
| **Observability** | OpenTelemetry traces, custom dashboards, SLO tracking | 1w | Operations |

---

## 4. PRODUCTION READINESS ASSESSMENT

### Overall Readiness Score: **6.5/10**

### What's Needed for Public Beta (target: 7.5/10)

The platform is technically functional but has critical gaps:

| Requirement | Status | Owner |
|------------|--------|-------|
| 🔴 **CI must be authoritative** | ❌ continue-on-error everywhere | DevOps |
| 🔴 **No critical vulnerabilities** | ❌ 7 high vulns | Backend |
| 🔴 **Stripes processes payments** | ❌ Test mode only | Business |
| 🔴 **TypeScript compiles clean** | ❌ 8 packages failing | Backend |
| 🟡 **Core services online** | ❌ Spaces down, Owncast partial | DevOps |
| 🟡 **Feed loads in < 3s** | ❌ Cold-start 8s timeout | Backend |
| 🟡 **Mobile layout** | ❌ No bottom nav | Frontend |
| ✅ **Auth works** | ✅ OIDC + wallet sign-in | — |
| ✅ **Feed aggregation** | ✅ 12 protocol feeds | — |
| ✅ **Cross-protocol posting** | ✅ Partial (bridge pairs blocked) | — |
| ✅ **Security hardening** | ✅ CSP, rate limiting, input validation | — |
| ✅ **Monitoring** | ✅ Uptime Kuma | — |

**To reach public beta, fix: C1, C2, C3, C4, C5, C6, H2 = ~8-10 days of work**

### What's Needed for Production Launch (target: 8.5/10)

| Requirement | Status | Effort |
|------------|--------|--------|
| 🔴 **All above +** | | |
| 🔴 **Structured logging** | ❌ console.log everywhere | 2d |
| 🔴 **Performance budget** | ❌ No thresholds | 0.5d |
| 🟡 **Search works** | ❌ MeiliSearch not wired | 2d |
| 🟡 **Bridge write paths complete** | ❌ Tokens missing | 2d |
| 🟡 **Code quality baseline** | ❌ 30+ files >1000 lines | 3d |
| ✅ **Edge caching** | ✅ KV cache 30-180s | — |
| ✅ **Error boundaries** | ✅ Global + per-page | — |
| ✅ **Security headers** | ✅ All OWASP covered | — |
| ✅ **Dependency management** | ✅ Renovate (needs token) | 0.5d |

**To reach production launch, additionally fix: H1, H3, H5, H7, M5 = ~10-12 days**

### What's Needed for Enterprise Readiness (target: 9.5/10)

| Requirement | Status | Effort |
|------------|--------|--------|
| 🔴 **All above +** | | |
| 🔴 **SSO/SAML/OIDC enterprise** | ❌ Not implemented | 5d |
| 🔴 **Audit logging** | ❌ Not implemented | 3d |
| 🔴 **Role-based access control** | ❌ Admin-only currently | 5d |
| 🔴 **SOC2-type controls** | ❌ Not addressed | Ongoing |
| 🟡 **Dedicated instances** | ❌ Not implemented | 2w |
| 🟡 **SLA monitoring/reporting** | ❌ Not implemented | 1w |
| ✅ **Data export** | ✅ Basic support | — |
| ✅ **Self-hosted option** | ✅ Docker Compose | — |

---

## 5. QUALITY SCORECARD

### Ratings (1-10)

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| **Code Quality** | **6.0** | 30+ files >1000 lines. 8 packages with type errors. 170 lib files with no consistent structure. console.log everywhere. Good: Biome formatting enforced, ESLint-style rules. |
| **Design Quality** | **7.0** | Clean design system with CSS custom properties, 3 font families (Jakarta/Syne/JetBrains Mono). Good branding, dark theme. Needs: mobile responsive, animation polish, accessibility audit (axe-core setup exists but not enforced). |
| **Architecture** | **7.5** | Excellent monorepo structure (Turborepo + pnpm workspaces). Clear package separation (43 packages). Well-organized routes/register pattern. Strong: Hono on CF Workers, modular design, CSP/security layered. Needs: some god files, no ADR consistency for newer decisions. |
| **Security** | **7.5** | Comprehensive audit done: CSP, HSTS, rate limiting, input validation all applied. Good: 3-layer security (CSP+headers+validation). Needs: IP reputation, unsafe-eval removal, gitleaks in pre-commit, KV rate limiter atomicity. |
| **Performance** | **6.0** | Cold-start feed 8s timeout. No performance budget. No bundle analysis. Large component bundles (ComposeModal 1345 lines, VideoCall 1474). Good: KV caching, edge deployment, next/image everywhere. |
| **Testing** | **5.0** | 147 test files for 2,390 source files (~6% ratio, likely <10% coverage). Many packages with 0 tests. CI doesn't enforce coverage. Good: comprehensive e2e/integration test suite (15 e2e, 35 integration). Vitest + Playwright setup ready. |
| **Documentation** | **7.0** | 74 docs files. Architecture, deployment, security, API docs all exist. ADR directory but sparsely populated. Needs: stale IP cleanup, dependency map completion. |
| **DevOps/Infra** | **6.5** | Docker Compose with health checks, resource limits, security_opt. 19 containers. Makefile with 20+ targets. CI pipeline exists but not authoritative. Needs: Renovate token, gitleaks hooks, coverage CI enforcement. |

### Overall Score: **6.6/10**

**Breakdown by area weight:**
- Code Quality (20%): 6.0
- Architecture (20%): 7.5
- Security (20%): 7.5
- Performance (10%): 6.0
- Testing (15%): 5.0
- DevOps (15%): 6.5

**Trend:** Improving — security audit applied, architecture solid, but quality fundamentals (tests, types, large files) need attention.

---

## 6. FINAL RECOMMENDATIONS

### Top 5 Actions This Week

1. **Fix type errors** (C1) — 8 packages fail typecheck. This is the #1 signal that quality gates are not effective. Without this, "make ci" is meaningless.

2. **Bump next + dependencies** (C2) — 7 high vulnerabilities. Next.js 16.2.11 patches 4 SSRF/DoS issues. Run `pnpm update` for transitive fixes.

3. **Authoritative CI** (C6) — Remove `continue-on-error: true`. CI must fail when lint/typecheck/test fails. This is the foundation for everything else.

4. **Stripe production keys** (C3) — Can't launch without real payments. This is a business blocker.

5. **Mobile bottom nav** (H2) — Mobile is the primary growth channel. Without a proper mobile layout, the product looks broken on phones.

### Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Secrets leaked via git history | Medium | Critical | Add gitleaks pre-commit, rotate remaining keys |
| KV rate limiter race condition abused | Low | Medium | Migrate to Durable Objects |
| Feed cold-start user abandonment | High | Medium | KV warmup cron, pre-warm on deploy |
| Dependency vulnerability exploited | Medium | High | pnpm update cycle, Renovate automation |
| Mobile user churn (no bottom nav) | High | Medium | Week 1 sprint priority |

### Quick Wins (Can Be Done in < 2 Hours Each)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | Bump next from 16.2.10 → 16.2.11 | 10min | Closes 4 high vulns |
| 2 | Run pnpm update | 30min | Patches postcss, sharp, brace-expansion |
| 3 | Add gitleaks to lefthook.yml | 15min | Prevents secret leaks |
| 4 | Remove `|| true` from CI file | 15min | Makes CI authoritative |
| 5 | Add coverage flag to vitest config | 30min | Enables coverage tracking |
| 6 | Remove `console.log` in routes/health.ts | 10min | Quick win on structured logging |
| 7 | Set Renovate token | 15min | Enables automated dependency updates |

### Effort Summary

| Phase | Tasks | Person-Days | Target Date |
|-------|-------|-------------|-------------|
| 🔴 Week 1 Critical | 8 | ~10 | Aug 7 |
| 🟠 Week 3-4 High | 10 | ~12 | Aug 21 |
| 🟡 Month 2 Medium | 10 | ~14 | Sep 18 |
| 🔵 Month 3+ Features | 7 | ~65 | Oct 31 |

**Total estimated effort to production launch:** ~22 person-days (5 weeks)
**Total to enterprise readiness:** ~90 person-days beyond that

---

> **Bottom Line:** DegenFeed is a technically impressive platform with solid architecture, comprehensive security, and wide protocol support. The fast-growth pattern (adding features faster than hardening) has created a quality debt that must be addressed before public launch. The core recommendation: **stop adding features for 2 weeks and pay down the quality debt** — fix types, CI, deps, and mobile layout. Everything else is polish.
