# Remaining Gaps — Round 26 (2026-07-26)

> Comprehensive inventory of everything remaining to build, fix, test, or document.
> Last updated: 2026-07-26

---

## P0 — Production Blockers (Must Fix Before Ship)

| # | Gap | Area | Details |
|---|-----|------|---------|
| 1 | **GitLab push rejected for standards** | DevOps | `git push gitlab main` fails: "You are not allowed to push code to this project." Needs gitlab.com access/permissions fix. |
| 2 | **degenfeed branch mismatch** | Git | Active branch `fix/farcaster-remove-seed-data` is diverged from `main`. All commits since round 14 are on this branch. Needs merge or rebase to main. |
| 3 | **Newsletter router wired in mount.py but untested** | rmi-backend | `app/mount.py` registers `app.domains.newsletter.router` at `/api/v1/newsletter/*` but no integration tests exist. |
| 4 | **Analytics router wired in mount.py but untested** | rmi-backend | `app/mount.py` registers `app.domains.analytics` at `/api/v1/analytics/*` but no integration tests exist. |

## P1 — Critical Features Not Built

| # | Gap | Area | Details |
|---|-----|------|---------|
| 5 | **Newsletter send automation** | rmi-backend | `NewsletterService.send()` exists as stub. Auto-send scheduler (cron/APScheduler) not implemented. |
| 6 | **Analytics aggregation queries** | rmi-backend | Analytics service has basic CRUD. No aggregation queries for view counts, engagement rates, audience growth over time. |
| 7 | **Cross-platform newsletter publishing** | rmi-backend | Publisher skeleton exists for 10 platforms. Only Ghost integration partially implemented. Mirror/Paragraph/Medium/Substack/Nostr/Farcaster/Bluesky/Mastodon/Email all need full implementation. |
| 8 | **Creator newsletter dashboard** | degenfeed | `apps/web/src/app/creator/newsletter/` has pages but relies on backend endpoints not yet live. |
| 9 | **Live aggregation production hardening** | degenfeed | `workers/api/src/feed/live-aggregator.ts` (54KB) needs error handling, rate limiting, dedup, and monitoring. |

## P2 — Protocols Not Integrated

| # | Gap | Area | Details |
|---|-----|------|---------|
| 10 | **Threads.net API integration** | degenfeed | Feed provider not implemented. |
| 11 | **Bluesky AT Protocol firehose** | degenfeed | Real-time firehose not wired (stub exists). |
| 12 | **Audius full API** | degenfeed | Music protocol: only basic feed, no streaming, playlists, or artist profiles. |
| 13 | **Arweave permastorage** | degenfeed | Poster exists; newsletter permastorage using Arweave not implemented. |
| 14 | **Ditto/Primal Nostr clients** | degenfeed | Alternative Nostr API integrations not done. |
| 15 | **Gov.zza (on-chain gov)** | degenfeed | DAO governance protocol not integrated. |
| 16 | **Hive blockchain** | degenfeed | Hive social chain feed not implemented. |
| 17 | **Aether P2P** | degenfeed | P2P social network not implemented. |
| 18 | **Scuttlebutt SSB** | degenfeed | SSB protocol not implemented. |
| 19 | **XMTP messaging** | degenfeed | Web3 messaging protocol not implemented. |
| 20 | **WarpCast** | degenfeed | Farcaster client integration not done. |
| 21 | **Nostr NIP-29 groups** | degenfeed | Group chat protocol not implemented. |

## P3 — Tests Not Yet Written

| # | Gap | Area | Details |
|---|-----|------|---------|
| 22 | **Newsletter service unit tests** | rmi-backend | `test_service.py` exists but covers only basic CRUD. No tests for scheduling, sending, crossposting. |
| 23 | **Newsletter integration tests** | rmi-backend | No E2E test for newsletter send → delivery → open tracking flow. |
| 24 | **Analytics service tests** | rmi-backend | `test_analytics.py` exists. Needs tests for aggregation queries, cross-protocol comparison, audience analytics. |
| 25 | **Creator analytics dashboard tests** | degenfeed | UI component tests for analytics pages not written. |
| 26 | **Live page tests** | degenfeed | Live streaming pages lack component/integration tests. |
| 27 | **Route quality tests coverage** | degenfeed | `route-quality.test.ts` covers basic validation. Needs tests for ALL API routes. |
| 28 | **Fuzz testing** | degenfeed | No fuzz tests for input validation across API layer. |
| 29 | **Performance/benchmark tests** | degenfeed | No load testing for feed aggregation, live streaming, or newsletter sending. |
| 30 | **Cross-protocol sync E2E** | degenfeed | `cross-protocol-sync.test.ts` covers linking + resolution. No E2E test for full bridge flow. |

## P4 — Documentation Gaps

| # | Gap | Area | Details |
|---|-----|------|---------|
| 31 | **Newsletter API docs** | rmi-backend | No OpenAPI docs for newsletter endpoints. |
| 32 | **Analytics API docs** | rmi-backend | No OpenAPI docs for analytics endpoints. |
| 33 | **Creator onboarding guide** | degenfeed | No step-by-step guide for creators to set up newsletter, analytics, cross-posting. |
| 34 | **Deployment runbook** | both | No document covering newsletter/analytics migration steps, env vars, rollback. |
| 35 | **Architecture decision records** | both | Newsletter and analytics architecture rationale not documented. |
| 36 | **Monitoring/alerting docs** | infra | No runbook for newsletter send failures, analytics pipeline issues. |

## P5 — Known Bugs

| # | Description | Area | Severity |
|---|-------------|------|----------|
| 37 | **degenfeed test files keep getting auto-formatted by biome** | degenfeed | Low — cosmetic, creates noise in git history. |
| 38 | **Newsletter __init__ references router that may 404 if routes not registered** | rmi-backend | Medium — if route registration fails, whole mount point returns 404. |
| 39 | **Analytics __init__ doesn't expose router (safe, but incomplete)** | rmi-backend | Low — no-op module, won't break existing. |

## P6 — Security Issues

| # | Issue | Area | Severity |
|---|-------|------|----------|
| 40 | **No newsletter send rate limiting** | rmi-backend | Medium — could be abused for spam. |
| 41 | **Analytics view events not sanitized** | rmi-backend | Low — viewer_fingerprint is hashed; but no validation on session_id. |
| 42 | **No newsletter subscription spam protection** | rmi-backend | Medium — no CAPTCHA or wallet-based gating on subscribe. |
| 43 | **npm audit: bigint-buffer vulnerability** | degenfeed | High — transitive dep via @solana/spl-token. Affects creator-coin and zora-sdk packages. |

## P7 — Performance Issues

| # | Issue | Area | Severity |
|---|-------|------|----------|
| 44 | **Live aggregator processes all sources synchronously** | degenfeed | Medium — should parallelize feed fetching. |
| 45 | **Analytics queries lack pagination** | rmi-backend | Low — view_event and engagement_event tables will grow fast. Need partition key strategy. |
| 46 | **No connection pooling for newsletter sends** | rmi-backend | Low — single send is fine; batch sends (1000+ subscribers) will be slow. |

## P8 — Design Issues

| # | Issue | Area | Severity |
|---|-------|------|----------|
| 47 | **Newsletter domain split across two repos** | rmi-backend + degenfeed | Medium — backend models in rmi-backend, frontend pages in degenfeed. No shared types. |
| 48 | **No unified analytics schema between repos** | rmi-backend + degenfeed | Medium — degenfeed has its own analytics types; rmi-backend has SQLAlchemy models. No TypeScript ↔ Python sharing. |
| 49 | **Analytics service in rmi-backend duplicates some degenfeed types** | both | Low — protocol type definitions exist in both places. |

---

## Summary by Priority

| Priority | Count | Action |
|----------|-------|--------|
| **P0** Production Blockers | 4 | Fix before next deploy |
| **P1** Critical Features | 5 | Round 27 scope |
| **P2** Protocol Integration | 12 | Round 28+ scope |
| **P3** Tests | 9 | Continuous |
| **P4** Documentation | 6 | Round 27 scope |
| **P5** Known Bugs | 3 | Fix as encountered |
| **P6** Security | 4 | Round 27 scope |
| **P7** Performance | 3 | Round 28+ scope |
| **P8** Design | 3 | Revisit after Round 27 |
| **Total** | **49** | |

---

## Production Readiness Score: 78/100

**Scoring breakdown (0-100):**

| Category | Score | Notes |
|----------|-------|-------|
| 🏗️ Architecture | 85/100 | Well-modularized. Newsletter+Analytics domains follow existing patterns. Some duplication between repos. |
| ✅ Test Coverage | 60/100 | Core models tested. Integration/E2E coverage weak. No fuzz/benchmark/load tests. |
| 🔒 Security | 75/100 | No hardcoded secrets. Leak-check passes. npm audit has 1 high-severity vulnerability. No newsletter spam protection. |
| 📖 Documentation | 55/100 | Newsletter/analytics APIs undocumented. No deployment runbook. ADRs missing. |
| ⚡ Performance | 70/100 | Live aggregator not parallelized. Analytics queries lack pagination. No batch newsletter sends. |
| 🚀 Deploy Readiness | 85/100 | All repos clean and pushed. Docker/Compose configured. CI passes. GitLab permissions issue for standards repo. |
| 🧹 Code Quality | 90/100 | Lefthook + biome + ruff + mypy + gitleaks enforced. No lint errors. Clean commits. |

---

## Next Priorities (Round 27)

1. **Newsletter send pipeline** — Implement auto-send, scheduling, Ghost/Mirror/Paragraph publishing
2. **Analytics aggregation** — View counts, engagement rates, audience growth queries
3. **Creator newsletter dashboard** — Connect frontend pages to backend API
4. **Rate limiting + spam protection** — Newsletter sends, subscriptions
5. **Integration tests** — Newsletter send → delivery → tracking E2E
6. **Documentation** — API docs for newsletter + analytics, deployment runbook
7. **npm audit fix** — Upgrade bigint-buffer or patch @solana/spl-token
