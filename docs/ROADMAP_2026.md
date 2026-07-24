# DegenFeed — Roadmap 2026

> **Last updated:** 2026-07-24  
> **Status:** 🟢 On track — Q3 2026 goals in progress

---

## Executive Summary

DegenFeed is a **universal feed aggregator** bridging 10+ decentralized social protocols into a single, unified timeline. We self-host the critical infrastructure (GoToSocial, PeerTube, Bluesky PDS, Nostr relay, RSS-Bridge, Redlib) and connect to external networks via their native APIs. The platform supports cross-protocol posting, tipping, token launches, audio spaces, live streaming, and short-form video.

**Phase:** Beta (functional, real data flowing from 8/10 protocols)  
**Launch target:** Q4 2026 public beta  
**Revenue model:** Premium subscriptions + token gate + creator coins + tipping fees

---

## 1. Completed Milestones

### Sprint 1-8: Foundation (2026 Q1–Q2)
| Milestone | Date | Deliverable | Status |
|-----------|------|-------------|--------|
| Monorepo setup | 2026-04 | pnpm workspace, Turbo, Biome, Vitest | ✅ |
| Design system | 2026-04 | Color tokens, typography, spacing, CSS vars | ✅ |
| Next.js 16 app | 2026-04 | App Router, layouts, providers, middleware | ✅ |
| Cloudflare Workers API | 2026-04 | Hono app, 90+ routes, session management | ✅ |
| Auth system | 2026-04 | OAuth (Google/Twitter/GitHub/Discord), JWT, sessions | ✅ |
| Web3 wallet auth | 2026-04 | Solana/EVM wallet sign-in | ✅ |
| Basic feed pipeline | 2026-05 | Fetcher → Scorer → Cache → Enricher → Curator | ✅ |

### Sprint 9-16: Protocol Integration (2026 Q2)
| Milestone | Date | Deliverable | Status |
|-----------|------|-------------|--------|
| GoToSocial (self-hosted) | 2026-05 | Mastodon-compatible API bridge | ✅ |
| Bluesky PDS (self-hosted) | 2026-05 | AT Protocol bridge with PDS | ✅ |
| PeerTube (self-hosted) | 2026-05 | ActivityPub video bridge | ✅ |
| Lemmy (self-hosted) | 2026-05 | ActivityPub community bridge | ✅ |
| RSS-Bridge (self-hosted) | 2026-05 | 1526 bridge definitions | ✅ |
| Redlib (self-hosted) | 2026-05 | Reddit proxy bridge | ✅ |
| Nostr WebSocket relay | 2026-06 | 6-relay WebSocket fetcher | ✅ |
| Lens v2 GraphQL | 2026-06 | Lens Protocol v2 integration | ✅ |
| Pixelfed API + RSS | 2026-06 | Self-hosted + public instance fetcher | ✅ |
| Farcaster (Neynar) | 2026-06 | Neynar API integration | 🟡 Needs key |
| Zora GraphQL | 2026-06 | NFT minting protocol bridge | ✅ |
| YouTube integration | 2026-06 | YouTube API + scrape fetcher | ✅ |
| Cross-poster (GTS→Nostr) | 2026-06 | Cross-protocol publishing | ✅ |

### Sprint 17-20: Feature Blitz (2026 Q2–Q3)
| Milestone | Date | Deliverable | Status |
|-----------|------|-------------|--------|
| Tipping system | 2026-06 | Lightning + EVM + Solana + fiat | ✅ |
| Token launch platform | 2026-06 | Bonding curves, vesting, DegenFeed Coin | ✅ |
| Creator dashboard | 2026-06 | Analytics, video management, scheduling | ✅ |
| Live streaming | 2026-06 | PeerTube streaming + embedded player | ✅ |
| Audio spaces | 2026-06 | LiveKit-based audio rooms | ✅ |
| Short-form video | 2026-06 | TikTok-style shorts player | ✅ |
| Real-time chat | 2026-06 | WebSocket chat (DMs + spaces) | ✅ |
| Design system v2 | 2026-07 | Platform Universe color coding, refined tokens | ✅ |
| God code reduction batch 1-3 | 2026-07 | 9,000+ lines refactored, monotonic patterns | ✅ |
| Protocol standardization | 2026-07 | UnifiedPost type, consistent provider signatures | ✅ |
| Testing expansion | 2026-07 | 60+ test files, Worker unit tests, hook tests | ✅ |

---

## 2. Current State (2026-07-24)

### What's Working 🟢
- **10 protocols integrated** (Nostr, Farcaster, Lens, Pixelfed, GoToSocial, Bluesky, Lemmy, PeerTube, Reddit, RSS-Bridge)
- **8 protocols returning real data** (23 posts per request average)
- **11 providers in local bridge** (all fully imported, no stubs)
- **Full feed pipeline** (fetch → score → cache → enrich → curate → serve)
- **90+ Worker API routes** serving frontend
- **~60 route group pages** in Next.js frontend
- **Tip system** across Lightning, EVM, Solana, fiat
- **Token platform** with bonding curves, vesting, coins
- **Cross-poster** (GoToSocial → Nostr relay)
- **Real-time** WebSocket chat, spaces, live streaming
- **Design system** with CSS custom properties, light/dark modes
- **42 monorepo packages** with clean dependency graph

### Needs Attention 🟡
- **Farcaster API key** — NEYNAR_API_KEY env var not configured; stub still used when key missing
- **Reddit CDN block** — Reddit blocks all requests from our IPs; Redlib proxy fully functional but returns empty
- **Test coverage** — Good unit coverage, E2E tests need expansion (Playwright smoke tests partially failing)
- **Monetization** — Premium tiers exist but backend billing integration needs live testing
- **Documentation** — Excellent internal docs, user-facing docs need expansion

### Blocked 🔴
- **Reddit provider** — CDN blocks all requests; need rotating proxies or paid Reddit API
- **Farcaster Hub** — Self-hosted hub not yet deployed; relying on Neynar for now

---

## 3. Q3 2026 Goals (July–September)

### High Priority
| Goal | Effort | Impact | Target | Dependencies |
|------|--------|--------|--------|-------------|
| **Self-host Farcaster Hub** | 3 weeks | 🔥🔥🔥 | Aug 2026 | Docker, Hub software |
| **Farcaster API key** | 1 day | 🔥🔥🔥 | Jul 2026 | NEYNAR_API_KEY |
| **Reddit CDN bypass** | 2 weeks | 🔥🔥🔥 | Aug 2026 | Rotating proxies / paid API |
| **Mature mobile (Capacitor)** | 4 weeks | 🔥🔥🔥 | Sep 2026 | Push notifications, offline |
| **E2E test completion** | 2 weeks | 🔥🔥 | Aug 2026 | Playwright, CI pipeline |
| **Premium billing live** | 3 weeks | 🔥🔥🔥 | Sep 2026 | Stripe/OpenNode, tier gates |

### Medium Priority
| Goal | Effort | Impact | Target | Dependencies |
|------|--------|--------|--------|-------------|
| **ActivityPub bridge** (write) | 4 weeks | 🔥🔥🔥 | Sep 2026 | AP spec, federation |
| **Meilisearch integration** | 1 week | 🔥🔥 | Aug 2026 | Meilisearch running |
| **WriteFreely/Forem bridge** | 2 weeks | 🔥🔥 | Aug 2026 | API access |
| **Notification system** | 2 weeks | 🔥🔥 | Aug 2026 | Push, email, in-app |
| **Admin panel v2** | 2 weeks | 🔥 | Aug 2026 | Moderation, analytics |
| **Creator monetization rollout** | 3 weeks | 🔥🔥🔥 | Sep 2026 | Token launch, tips, subs |
| **Performance optimization** | Ongoing | 🔥🔥 | Ongoing | Lighthouse, Core Web Vitals |
| **i18n/l10n** | 4 weeks | 🔥🔥 | Sep 2026 | next-intl, translations |

### Low Priority (Nice to Have)
| Goal | Effort | Impact | Target |
|------|--------|--------|--------|
| **Mobile native app** (iOS/Android) | 6 weeks | 🔥🔥 | Q4 2026 |
| **Desktop app** (Tauri) | 4 weeks | 🔥 | Q4 2026 |
| **DAOs / governance** | 4 weeks | 🔥🔥 | Q4 2026 |
| **On-chain reputation** | 3 weeks | 🔥🔥 | Q4 2026 |
| **AI-powered recommendations** | 4 weeks | 🔥🔥🔥 | Q4 2026 |
| **Nostr zap integration** | 1 week | 🔥 | Sep 2026 |
| **Cross-chain tipping** | 3 weeks | 🔥🔥 | Q4 2026 |

---

## 4. Q4 2026 Goals (October–December)

| Goal | Type | Impact | Effort |
|------|------|--------|--------|
| **Public beta launch** | 🚀 Launch | 🔥🔥🔥🔥🔥 | High |
| **Marketing + community** | 📢 Growth | 🔥🔥🔥🔥🔥 | High |
| **SEO optimization** | 📈 Growth | 🔥🔥🔥🔥 | Medium |
| **Mobile app stores** | 📱 Platform | 🔥🔥🔥🔥 | High |
| **10,000 MAU** | 📊 Metric | 🔥🔥🔥🔥 | High |
| **Paid tier revenue** | 💰 Revenue | 🔥🔥🔥🔥🔥 | High |
| **All protocols returning data** | 🔧 Tech | 🔥🔥🔥 | Medium |
| **Self-hosted Farcaster Hub live** | 🔧 Tech | 🔥🔥🔥 | Low |
| **ActivityPub write-back** | 🔧 Tech | 🔥🔥🔥 | High |
| **Open source release (OSS packages)** | 🌍 Community | 🔥🔥🔥 | Medium |
| **Security audit** | 🔒 Security | 🔥🔥🔥🔥 | High |
| **Bug bounty program** | 🔒 Security | 🔥🔥🔥 | Medium |
| **Load testing (10k concurrent)** | 📊 Metric | 🔥🔥🔥 | Medium |

---

## 5. Priority Matrix

```
                     EFFORT
               Low              Medium            High
        ┌─────────────────┬─────────────────┬─────────────────┐
   High  │ Farcaster key   │ E2E tests        │ Self-host FC hub │
   IMPACT│ Meilisearch     │ Premium billing   │ Reddit bypass     │
         │ Nostr zaps      │ ActivityPub write │ Capacitor Mobile  │
         │                 │ Creator monetiz.  │ Public beta launch│
        ├─────────────────┼─────────────────┼─────────────────┤
   Med   │ Notifications   │ Admin panel v2   │ i18n/l10n        │
   IMPACT│ Performance     │ WriteFreely br.  │ Desktop (Tauri)   │
         │ Reputation sys  │ Cross-chain tips  │ AI recommend.    │
        ├─────────────────┼─────────────────┼─────────────────┤
   Low   │ Feature flags   │ DAO governance   │ Mobile native app │
   IMPACT│ Dark mode polish│ On-chain rep     │ Security audit    │
         │                 │                  │ Bug bounty        │
        └─────────────────┴─────────────────┴─────────────────┘

## "Do First" (High Impact, Low Effort)
  1. Farcaster API key (1 day)
  2. Meilisearch integration (1 week)
  3. Notification system (2 weeks)
  4. Performance optimization (ongoing)

## "Major Projects" (High Impact, High Effort)
  1. Self-hosted Farcaster Hub (3 weeks)
  2. Reddit CDN bypass (2 weeks)
  3. Capacitor mobile app (4 weeks)
  4. Public beta launch (Q4)

## "Fill-Ins" (Low Impact, Low Effort)
  1. Nostr zap integration
  2. Feature flags
  3. Dark mode polish

## "Careful Consider" (Low Impact, High Effort)
  1. Native mobile app (vs Capacitor PWA path)
  2. Full security audit (timing with launch)
```

---

## 6. Key Results Tracking

### User & Adoption
| KR | Current | Q3 Target | Q4 Target |
|----|---------|-----------|-----------|
| Monthly Active Users | ~100 (internal) | 500 | 10,000 |
| Protocols returning data | 8/10 | 10/10 | 10/10 |
| Self-hosted services | 10 | 12 | 12 |
| Average feed load time | <2s | <1s | <500ms |

### Technical Quality
| KR | Current | Q3 Target | Q4 Target |
|----|---------|-----------|-----------|
| Test coverage | ~15% | 40% | 60% |
| God code (repeated patterns reduced) | 3 batches | 5 batches | Complete |
| Lighthouse Performance | ~65 | 80+ | 90+ |
| Lighthouse Accessibility | ~70 | 85+ | 95+ |
| Build time (turbo) | ~120s | <60s | <30s |
| Docker image size | ~850MB | <500MB | <300MB |

### Revenue & Business
| KR | Current | Q3 Target | Q4 Target |
|----|---------|-----------|-----------|
| Premium subscribers | 0 | 50 | 500 |
| Monthly tipping volume | $0 | $500 | $10,000 |
| Creator coins launched | 0 | 10 | 100 |
| Monthly revenue | $0 | $500 | $5,000 |

---

## 7. Protocol Expansion Pipeline

| Protocol | Type | Status | Q3 | Q4 |
|----------|------|--------|----|----|
| Nostr | Read+Write | ✅ Real | Zaps | NIP-05 |
| Farcaster | Read | 🟡 Needs key | Hub self-host | Frames |
| Lens | Read+Write | ✅ Real | Comments | Mirrors |
| Pixelfed | Read | ✅ Real | Write-back | - |
| GoToSocial | Read+Write | ✅ Real | Full ActivityPub | - |
| Bluesky | Read+Write | ✅ Real | Feed generator | Custom feeds |
| Lemmy | Read+Write | ✅ Real | Cross-post | Mod tools |
| PeerTube | Read+Write | ✅ Real | Live streaming | P2P |
| Reddit | Read | 🔴 Blocked | Proxy bypass | API upgrade |
| RSS-Bridge | Read | ✅ Real | Custom bridges | - |
| Zora | Read | ✅ Real | Mint via DegenFeed | Auctions |
| YouTube | Read | ✅ Real | Comments | Upload |
| Threads | Read | 🆕 Planned | MVP | - |
| Telegram | Read+Write | 🆕 Planned | Channels | - |
| Discord | Read+Write | 🆕 Planned | Bot bridge | - |
| Matrix | Read+Write | 🆕 Planned | E2EE chat | - |
| GitHub | Read | 🆕 Planned | Dev feed | - |
| WriteFreely | Write | 🆕 Planned | Publishing | - |
| Forem | Write | 🆕 Planned | Blog bridge | - |
| Hive/Steemit | Write | 🆕 Planned | Blockchain pub | - |

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Reddit permanently blocks all proxy IPs | High | Medium | Use paid Reddit API |
| Farcaster Hub sync is expensive | Medium | High | Use public hub fallback |
| Cloudflare Workers cost overrun | Medium | High | Move to local bridge for heavy lifting |
| ActivityPub federation complexity | Medium | Medium | Incremental, test with own instances |
| Web3 wallet UX barrier for mainstream | High | Medium | Email + passkey as primary, wallet optional |
| API rate limits from external providers | High | Low | Multi-source rotation, caching |
| Smart contract audit finding | Low | Critical | Foundry tests, professional audit before launch |

---

## 9. Resource Plan

### Infrastructure (Self-Hosted on Talos)
| Service | Status | RAM | Storage | Port |
|---------|--------|-----|---------|------|
| Bridge server | 🟢 Running | 512MB | 1GB | 8787 |
| GoToSocial | 🟢 Running | 1GB | 10GB | 8082 |
| PeerTube | 🟢 Running | 2GB | 50GB | 9011 |
| Lemmy | 🟢 Running | 1GB | 10GB | 8536 |
| Bluesky PDS | 🟢 Running | 1GB | 20GB | 3012 |
| Nostr relay | 🟢 Running | 512MB | 5GB | 8085 |
| RSS-Bridge | 🟢 Running | 256MB | 1GB | 8282 |
| Redlib | 🟢 Running | 256MB | 1GB | 8281 |
| Meilisearch | 🟢 Running | 1GB | 5GB | 7700 |
| WriteFreely | 🟢 Running | 256MB | 2GB | 8080 |
| ActivityPub Relay | 🟢 Running | 256MB | 1GB | 8083 |
| Farcaster Hub | 🆕 Planned | 4GB | 100GB | 8755 |
| Monitoring (Prometheus+Grafana) | 🟢 Running | 1GB | 10GB | 9090/3000 |

### Development (This Repo)
| Area | Files | Lines | Maintainer |
|------|-------|-------|------------|
| Frontend (apps/web) | 817 | ~200K | Frontend |
| Worker API | 286 | ~80K | Backend |
| Bridge server | 15 | ~10K | Backend |
| Packages (42) | 297 | ~60K | Shared |
| Tests | ~60 | 16,646 | QA |
| Docs | 35+ | ~200K | Docs |
| **Total** | **1,419** | **350,127** | **Team** |

---

## 10. Launch Readiness Scorecard

| Category | Score | Notes |
|----------|-------|-------|
| **Protocol Coverage** | 8/10 ✅ | 8/10 returning real data |
| **Self-Hosted Infra** | 10/12 🟡 | Farcaster Hub + more needed |
| **Frontend Completeness** | 7/10 🟡 | Mobile polish, E2E tests |
| **Backend Completeness** | 9/10 ✅ | 90+ routes, robust pipeline |
| **Monetization** | 4/10 🟡 | Framework exists, needs live billing |
| **Testing** | 5/10 🟡 | Good unit coverage, E2E WIP |
| **Security** | 6/10 🟡 | Auth solid, needs audit |
| **Documentation** | 9/10 ✅ | 35+ docs, excellent internal |
| **Performance** | 5/10 🟡 | Needs optimization pass |
| **Mobile Readiness** | 4/10 🟡 | Capacitor integrated, not polished |
| **Overall** | **67/100 🟡** | **On track for Q4 2026 beta** |

---

*This roadmap is a living document. Priorities shift based on user feedback, market conditions, and operational needs. Last updated 2026-07-24.*
