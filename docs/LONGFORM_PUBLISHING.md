# Longform Publishing — Platform Research & Integration Plan

**Status:** research / proposal  
**Last updated:** 2026-07-20  
**Owner:** Product  
**Related docs:** `BRIDGY-FED-INTEGRATION.md`, `TIPPING-ARCHITECTURE.md`, `INTEGRATIONS.md`, `PRODUCT.md`

---

## Table of Contents

1. [The Missing Piece](#1-the-missing-piece)
2. [Platform Evaluation](#2-platform-evaluation)
3. [Primary Recommendation: Ghost CMS](#3-primary-recommendation-ghost-cms)
4. [Fork Architecture: DegenFeed Ghost](#4-fork-architecture-degenfeed-ghost)
5. [Integration with Protocol Bridges](#5-integration-with-protocol-bridges)
6. [Creator Monetization](#6-creator-monetization)
7. [Unified Content Pipeline](#7-unified-content-pipeline)
8. [Implementation Plan](#8-implementation-plan)
9. [Appendices](#9-appendices)

---

## 1. The Missing Piece

### What DegenFeed Has Today

| Content Type | Status | Where |
|---|---|---|
| **Short-form posts** | ✅ Live | Nostr notes, Farcaster casts, Bluesky posts, Mastodon toots, Lens publications |
| **Shorts / Live Shorts** | ✅ Live | `packages/shorts-provider`, `apps/web` |
| **Audio Spaces** | ✅ Live | Cross-protocol space broadcasting |
| **Video** | ✅ Live | PeerTube (`video.degenfeed.xyz`), YouTube integration |
| **Livestreams** | ✅ Live | PeerTube live + XMPP chat |
| **Cross-protocol posting** | ✅ Live | Bridgy Fed on `bridgy.degenfeed.xyz` |
| **Communities** | ✅ Live | `apps/web` community pages |
| **Tipping** | ✅ Live | 7 methods across all protocols |
| **Creator coins** | ✅ Live | Base ERC-20 factory + Solana SPL |
| **Subscriptions** | ✅ Live | Via creator coins and tiers |
| **Longform (blogs, newsletters, articles)** | ❌ **MISSING** | This document |

### Why Longform Matters

Short-form content captures attention. Longform **captures trust, authority, and recurring revenue**. Every major content protocol ecosystem has a longform gap that DegenFeed can fill:

| Protocol | Native Longform | Gap |
|---|---|---|
| **Nostr** | NIP-23 (long-form notes) | Poor UX, no monetization, no email delivery |
| **Farcaster** | No native | Casts are 320 chars max |
| **Bluesky** | No native | Posts limited, no blog support |
| **ActivityPub** | WriteFreely / Plume | No monetization, no cross-protocol |
| **Lens** | Publications (limited) | No native longform editor |
| **Lemmy** | Self posts | Forum-style, not blog-style |

A federated longform engine would be DegenFeed's **moat** — the one capability that no single-protocol client can match.

---

## 2. Platform Evaluation

### 2.1 Evaluation Criteria

| Criteria | Weight | Description |
|---|---|---|
| **Open source license** | Critical | Must allow fork + commercial use |
| **API quality** | Critical | Headless/machine-readable API required |
| **ActivityPub support** | High | Must federate natively or add-on |
| **Monetization built-in** | High | Memberships, subscriptions, payments |
| **Codebase quality** | High | Modern stack, test coverage, active |
| **Self-hostable** | High | Docker compose, no vendor lock-in |
| **Fork-ability** | High | Can we strip frontend, keep API core? |
| **Email delivery** | Medium | Newsletters via email still matter |
| **Community size** | Medium | Stars, contributors, docs |
| **REST/GraphQL API** | Medium | For our pipeline integration |

### 2.2 Detailed Platform Analysis

---

#### 🥇 Ghost CMS — **PRIMARY RECOMMENDATION**

| Attribute | Value |
|---|---|
| **License** | MIT (permits fork, commercial use, no restrictions) |
| **GitHub** | `TryGhost/Ghost` — **48,000+ stars**, 850+ contributors |
| **Language** | Node.js (TypeScript) — matches our stack |
| **Database** | SQLite (dev) / MySQL (prod) |
| **API** | Headless REST API (Content API + Admin API) |
| **ActivityPub** | ✅ **Built-in since v5.0** — `ghost/core/core/server/services/activitypub/` |
| **Monetization** | ✅ Stripe memberships, tiers, paid newsletters |
| **Email** | ✅ Built-in newsletter delivery (Mailgun, etc.) |
| **Docker** | ✅ Official images, `ghost install` CLI |
| **Headless** | ✅ Can strip the frontend entirely, use only API |
| **Webhooks** | ✅ Post published/deleted/updated events |

**Strengths for our fork:**

1. **Headless by design** — the Content API and Admin API are decoupled from the theme layer. We can keep the API and replace the frontend with our own.
2. **ActivityPub server is built-in** — Ghost can act as its own ActivityPub instance (not just bridge to one). Ghost publishes `Article` activities, receives `Follow`/`Like`/`Announce`, and federates with Mastodon, WriteFreely, PeerTube, etc.
3. **Membership system** — Stripe-connected tiers, free/paid subscriptions, offer management. This is the hardest thing to build from scratch and Ghost has it production-hardened.
4. **Newsletter engine** — Ghost has a full email delivery pipeline with Mailgun integration, open tracking, and subscriber management. This is the "Substack advantage" in open source.
5. **MIT license** — No copyleft restrictions. We can fork, modify, and keep our changes proprietary or open.
6. **Code quality** — TypeScript, extensive test suite, monorepo structure with packages. Active daily development.
7. **Webhook system** — `post.published`, `post.deleted` webhooks let us trigger our bridge engine immediately.

**What we'd strip:**
- Ghost Admin UI (React SPA) — we replace with our own DegenFeed composer
- Ghost frontend theme layer — we replace with our apps/web
- Ghost membership portal — we **extend** rather than replace (keep the Stripe integration)

**What we'd keep:**
- Content API + Admin API
- ActivityPub service
- Membership/tier system (Stripe)
- Newsletter delivery pipeline
- Webhook system
- Media storage abstraction

**What we'd add:**
- Cross-protocol bridge hooks (post → Nostr, Farcaster, Bluesky, Lens)
- Creator coin gating (token-gate articles by $COIN balance)
- Cross-platform tipping (extend existing `recordUnifiedTip()`)
- AT Protocol integration (Bluesky feed generator for articles)
- DegenFeed native editor (existing composer, extended for longform)

**Fork potential: HIGH** — Ghost is the clear winner.

---

#### 🥈 WriteFreely

| Attribute | Value |
|---|---|
| **License** | AGPL (strong copyleft) |
| **GitHub** | `writefreely/writefreely` — 4,500+ stars |
| **Language** | Go |
| **Database** | MySQL or SQLite |
| **ActivityPub** | ✅ **Native** — blogs are ActivityPub actors |
| **Monetization** | ❌ None built-in |
| **Docker** | ✅ Available |
| **API** | REST API (basic) |
| **Headless** | Partial — limited API scope |

**Strengths:**
- ActivityPub-native — every blog is `@blog@instance` out of the box
- Minimalist, fast, easy to self-host (256 MB RAM)
- Clean reading experience
- Hashtag organization system

**Weaknesses:**
- **AGPL license** — strong copyleft requires releasing our modifications if we distribute. Could be restrictive for our fork.
- **No monetization** — no Stripe, no memberships, no tipping. We'd build it all from scratch.
- **Go codebase** — doesn't match our TypeScript stack. Harder to integrate.
- **Limited API** — basic CRUD, no webhooks, no extensibility points.
- **Smaller community** — 4.5K stars, fewer contributors.
- **No email/newsletter pipeline** — would need to build from scratch.

**Fork potential: MEDIUM** — Great for ActivityPub-native simplicity, but missing monetization and ecosystem. Best as a supplementary tool, not our primary platform.

---

#### 🥉 WordPress + ActivityPub Plugin

| Attribute | Value |
|---|---|
| **License** | GPL v2 |
| **GitHub** | `WordPress/WordPress` — 19K+ stars |
| **Language** | PHP |
| **Database** | MySQL |
| **ActivityPub** | ✅ Plugin by Matthias Pfefferle |
| **Monetization** | ✅ WooCommerce, Paid Memberships Pro, many plugins |
| **Docker** | ✅ Available |
| **API** | REST API + WPGraphQL |
| **Headless** | ✅ Well-established (wp-json, WPGraphQL) |
| **Ecosystem** | Massive — 50K+ plugins |

**Strengths:**
- Most mature ecosystem of any open source CMS
- REST API + WPGraphQL are production-hardened
- ActivityPub plugin works well
- Massive plugin ecosystem for monetization

**Weaknesses:**
- **PHP** — completely different stack from our TypeScript monorepo
- **Complexity** — WordPress is a battleship. Forks are hard to maintain.
- **Security surface** — huge attack surface. WordPress core + plugins + themes = constant CVEs.
- **Plugin dependency** — ActivityPub is a plugin, not core. It could break on updates.
- **Headless is bolted-on** — WordPress wasn't designed headless from the start. Ghost was.
- **GPL license** — strong copyleft requires derivative works to also be GPL.
- **Performance** — PHP + MySQL requires more resources than Node.js.

**Fork potential: LOW** — Too heavy, wrong stack. The ActivityPub plugin is useful to study but WordPress is not our fork target.

---

#### 📄 Hugo / Jekyll (Static Site Generators)

| Attribute | Value |
|---|---|
| **License** | Apache 2.0 (Hugo), MIT (Jekyll) |
| **GitHub** | `gohugoio/hugo` — 76K+ stars, `jekyll/jekyll` — 49K+ stars |
| **Language** | Go (Hugo), Ruby (Jekyll) |
| **Database** | None (flat files + Git) |
| **ActivityPub** | ❌ Not natively possible (static) |
| **Monetization** | ❌ None |
| **Docker** | ✅ Build-time only |
| **API** | ❌ No API (static output) |
| **Real-time** | ❌ No real-time features |

**Strengths:**
- Fast, secure (no server runtime)
- Git-native workflows
- Huge ecosystem of themes

**Weaknesses:**
- **No real-time federation** — static sites can't do ActivityPub inbox/outbox
- **No API** — can't programmatically create/edit content
- **No monetization** — no memberships, no payments
- **No email delivery** — no newsletter pipeline
- **Build step** — requires rebuild on every content change

**Fork potential: LOW** — fundamentally incompatible with real-time social protocols. Useful only for archival/landing pages.

---

#### 🏢 Substack (Proprietary)

| Attribute | Value |
|---|---|
| **License** | Proprietary |
| **Forkable** | ❌ No |
| **Source** | Closed |
| **Revenue model** | 10% platform fee on subscriptions |
| **Key innovation** | Simplicity + email-first + payments in one |

**What to study (not fork):**
- **Onboarding UX** — "Start writing" as the only CTA. Zero friction.
- **Email-first architecture** — articles are published as emails first, web second.
- **Built-in audience** — recommendations network, import from other platforms.
- **Paywall simplicity** — one click to make a post "for subscribers only."
- **Reading experience** — clean typography, minimal chrome, focus on content.
- **Substack Notes** — their attempt at short-form social. Reveals their strategy to own the full creator relationship.

**Anti-patterns to avoid:**
- 10% platform fee is exploitative. We're 0%.
- Vendor lock-in — no export, no federation.
- No protocol interoperability.

**Fork potential: N/A** — Proprietary. Study UX patterns only.

---

#### 📖 Medium (Proprietary)

| Attribute | Value |
|---|---|
| **License** | Proprietary |
| **Forkable** | ❌ No |
| **Revenue model** | Partner Program (ads + member reading time) |
| **Key innovation** | Reading experience + discovery |

**UX patterns to steal:**
- **Reading time estimates** — "5 min read" badge. Simple but effective.
- **Claps** — multi-value applause (1-50). More expressive than a single like.
- **Clean typography** — serif body, sans-serif headers, generous measure (60-80 chars).
- **Highlighting** — inline text selection with share capability.
- **Responsive embeds** — tweets, YouTube, code blocks all render inline beautifully.
- **In-line footnotes** — smoother than traditional footnotes.
- **Scrolling progress bar** — subtle indicator at top.
- **Curation/tag-based discovery** — topics not users as the organizing principle.

**Anti-patterns to avoid:**
- Aggressive paywall popups
- No export (though they added it eventually)
- Centralized control of distribution
- Algorithmic timelines that reward outrage

**Fork potential: N/A** — Proprietary. Steal UX patterns.

---

#### 🔬 Other Platforms

##### Plume (`plume-org/Plume`)

| Attribute | Value |
|---|---|
| **License** | AGPL |
| **GitHub** | 2K+ stars |
| **Language** | Rust (Rocket framework) |
| **Database** | Diesel (Postgres) |
| **ActivityPub** | ✅ Native — federated blogging engine |
| **Monetization** | ❌ None |

**Assessment:** Interesting technology (Rust + ActivityPub native) but small community, limited features, no monetization. AGPL copyleft is restrictive. **Fork potential: LOW** — not production-ready enough and wrong stack.

##### Publii

| Attribute | Value |
|---|---|
| **License** | GPL v3 |
|---|---|
| **Type** | Desktop static CMS (GUI for Hugo) |
| **ActivityPub** | ❌ No |
| **Monetization** | ❌ No |

**Assessment:** Desktop app, not a server platform. Can't federate. **Fork potential: NONE.**

##### Micro.blog

| Attribute | Value |
|---|---|
| **License** | Proprietary (some OSS components) |
| **ActivityPub** | ✅ Yes |
| **Forkable** | ❌ No |

**Assessment:** Good UX patterns for microblogging + cross-posting. Manton Reece's work on ActivityPub + micropub is worth studying. **Fork potential: NONE** — proprietary.

##### Posthaven

| Attribute | Value |
|---|---|
| **License** | Proprietary |
| **Price** | $5/month |
| **Promise** | "Built to last forever" — simple, reliable |

**Assessment:** Spiritual successor to Posterous. Study their "forever" promise and simplicity. **Fork potential: NONE.**

---

### 2.3 Platform Comparison Matrix

| Platform | License | Stack | API | ActivityPub | Monetization | Fork Score |
|---|---|---|---|---|---|---|
| **Ghost** | MIT | Node.js/TS | ✅ REST | ✅ Built-in | ✅ Stripe/Members | **92/100** |
| WriteFreely | AGPL | Go | ✅ Basic | ✅ Native | ❌ None | 55/100 |
| WordPress | GPL | PHP | ✅ REST+GraphQL | ✅ Plugin | ✅ Many plugins | 40/100 |
| Hugo | Apache | Go | ❌ None | ❌ Static | ❌ None | 15/100 |
| Plume | AGPL | Rust | ⚠️ Basic | ✅ Native | ❌ None | 30/100 |
| Publii | GPL | Electron | ❌ None | ❌ None | ❌ None | 5/100 |
| Substack | Proprietary | — | ❌ | ❌ | ✅ 10% fee | N/A (study) |
| Medium | Proprietary | — | ❌ | ❌ | ✅ Partner Prog | N/A (study) |

---

## 3. Primary Recommendation: Ghost CMS

**Score: 92/100** — The clear winner for every evaluation criterion.

### 3.1 Why Ghost Wins

| Requirement | How Ghost Delivers |
|---|---|
| **Headless API** | Content API (public) + Admin API (authenticated) — full CRUD for posts, pages, tags, authors, members, tiers |
| **ActivityPub** | Native ActivityPub server — publishes `Article` objects, federates with Mastodon/PeerTube/WriteFreely, handles Follow/Like/Announce |
| **Monetization** | Stripe Connect integration, member tiers (free + paid), offer codes, subscription management |
| **Email newsletter** | Built-in email pipeline — Mailgun/Mailjet/SMTP integration, open tracking, subscriber management, post-by-email |
| **Codebase quality** | 48K+ stars, TypeScript, monorepo, comprehensive tests, active daily dev from 850+ contributors |
| **Docker deployment** | Official images, `ghost install` CLI, MySQL backend, easy to containerize |
| **MIT license** | Permissive — no copyleft restrictions on our fork |
| **TypeScript stack** | Matches our existing `degenfeed-web` monorepo — same language, same tooling |
| **Webhook system** | Events for `post.published`, `post.deleted`, `post.edited` — triggers for our bridge engine |

### 3.2 Ghost Architecture (What We Fork)

```
Ghost Monorepo (simplified)
├── ghost/
│   ├── core/                    # Core API server
│   │   ├── core/server/         # Express.js server
│   │   │   ├── api/             # Content API + Admin API endpoints
│   │   │   ├── services/
│   │   │   │   ├── activitypub/ # 🎯 ActivityPub service (v5+)
│   │   │   │   ├── members/     # 🎯 Membership/subscription service
│   │   │   │   ├── mail/        # Newsletter delivery pipeline
│   │   │   │   └── webhooks/   # Event webhook system
│   │   │   └── models/          # Bookshelf ORM models
│   │   └── test/
│   └── core/shared/             # Shared utilities
├── apps/
│   ├── admin-x/                 # React SPA Admin UI (we STRIP)
│   ├── activitypub/             # ActivityPub React UI (we STRIP)
│   └── ...                      # Other apps
├── packages/                    # Shared packages (we EXTEND)
└── test/                        # E2E tests
```

**Our fork keeps:**
- `ghost/core/core/server/api/` — Content API + Admin API
- `ghost/core/core/server/services/activitypub/` — ActivityPub federation
- `ghost/core/core/server/services/members/` — Membership tiers
- `ghost/core/core/server/services/mail/` — Email delivery
- `ghost/core/core/server/services/webhooks/` — Webhook system
- `ghost/core/core/server/models/` — Data models
- `packages/` — Shared packages we need

**Our fork strips:**
- `apps/admin-x/` — Replace with our DegenFeed admin/composer
- `apps/activitypub/` — Replace with our cross-protocol compose UI
- Ghost frontend themes — Replace with `apps/web`

**Our fork adds:**
- `packages/ghost-bridge/` — Bridge from Ghost API → DegenFeed universe
- `packages/article-tipping/` — Extend `recordUnifiedTip()` for articles
- `packages/token-gate/` — Token-gate articles by creator coin balance
- `packages/cross-publish/` — Publish article → short-form posts on all protocols

---

## 4. Fork Architecture: DegenFeed Ghost

### 4.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    DegenFeed Platform                            │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              degenfeed-web (Next.js 15)                    │  │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │  │
│  │  │ Feed    │ │Composer  │ │ Article  │ │ Creator      │   │  │
│  │  │ Reader  │ │(short +  │ │ Reader   │ │ Dashboard    │   │  │
│  │  │         │ │ long)    │ │          │ │              │   │  │
│  │  └─────────┘ └──────────┘ └──────────┘ └──────────────┘   │  │
│  └──────────────────┬───────────────────────────────────────┘  │
│                     │ REST API (Content + Admin)                │
│  ┌──────────────────▼───────────────────────────────────────┐  │
│  │           DegenFeed Ghost (forked Ghost core)            │  │
│  │                                                          │  │
│  │  ┌────────────┐ ┌────────────┐ ┌──────────────────┐     │  │
│  │  │ Content    │ │ Admin      │ │ ActivityPub      │     │  │
│  │  │ API        │ │ API        │ │ Service          │     │  │
│  │  └────────────┘ └────────────┘ └──────────────────┘     │  │
│  │                                                          │  │
│  │  ┌────────────┐ ┌────────────┐ ┌──────────────────┐     │  │
│  │  │ Membership │ │ Newsletter │ │ Webhook System   │     │  │
│  │  │ Service    │ │ Pipeline   │ │ (post.published) │     │  │
│  │  └────────────┘ └────────────┘ └──────────────────┘     │  │
│  │                        │                                 │  │
│  │  ┌─────────────────────▼──────────────────────────────┐  │  │
│  │  │           ghost-bridge package (NEW)               │  │  │
│  │  │  ┌────────────┐ ┌──────────┐ ┌────────────────┐    │  │  │
│  │  │  │Cross-pub   │ │Token-gate│ │Article tipping │    │  │  │
│  │  │  │Engine      │ │Service   │ │Service         │    │  │  │
│  │  │  └────────────┘ └──────────┘ └────────────────┘    │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                        │                                        │
│                        ▼                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Protocol Bridge Layer                       │  │
│  │                                                          │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │  │
│  │  │ Bridgy   │ │ Nostr    │ │ Bluesky  │ │ Farcaster│   │  │
│  │  │ Fed      │ │ Gateway  │ │ PDS      │ │ Hub      │   │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │  │
│  │                                                          │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                 │  │
│  │  │ Lens     │ │ Mastodon │ │ RSS/Atom│                 │  │
│  │  │ Hub      │ │ GtS      │ │ Feeds    │                 │  │
│  │  └──────────┘ └──────────┘ └──────────┘                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 What We Customize in Ghost Core

#### 4.2.1 Strip Packages (Don't Fork)

| Package | Reason to Strip |
|---|---|
| `apps/admin-x` | Full React SPA admin panel — we replace with DegenFeed's own editor/composer |
| `apps/activitypub` | ActivityPub React UI — we replace with cross-protocol compose in `apps/web` |
| `ghost/frontend` | Handlebars theme layer — we serve content through our API |
| `ghost/portal` | Membership portal UI — we embed our own token-gate/tip UI |

#### 4.2.2 Keep Packages (Fork As-Is)

| Package | Purpose |
|---|---|
| `ghost/core/core/server/api/` | Content API + Admin API endpoints |
| `ghost/core/core/server/services/activitypub/` | ActivityPub server (federation) |
| `ghost/core/core/server/services/members/` | Membership tiers + Stripe |
| `ghost/core/core/server/services/mail/` | Email newsletter pipeline |
| `ghost/core/core/server/services/webhooks/` | Webhook event system |
| `ghost/core/core/server/models/` | Bookshelf ORM models |
| `ghost/core/core/server/adapters/storage/` | Media storage (local/S3) |

#### 4.2.3 Extend Packages (Fork + Enhance)

| Package | Enhancement |
|---|---|
| `packages/members-api` | Add token-based gating (check creator coin balance) |
| `packages/webhooks` | Add cross-post webhook events (`article.cross-posted`) |
| `packages/offers` | Add crypto-native offers (pay with ETH/SOL instead of fiat) |
| `ghost/core/core/server/services/activitypub/` | Add AT Protocol output (Bluesky feed generator integration) |

#### 4.2.4 Add New Packages (Our Bridge Layer)

| New Package | Purpose |
|---|---|
| `packages/ghost-bridge/` | Integration layer between Ghost and DegenFeed protocol bridges |
| `packages/article-tipping/` | Extends `recordUnifiedTip()` for Ghost articles |
| `packages/token-gate/` | Token gating middleware for Ghost content API |
| `packages/cross-publish/` | Publish article → short-form posts on Nostr/Farcaster/Bluesky |

### 4.3 Ghost Configuration for Headless Mode

```json
{
  "ghost": {
    "forceAdminRedirect": false,
    "admin": {
      "enabled": false
    },
    "frontend": {
      "enabled": false
    },
    "portal": {
      "enabled": false
    },
    "api": {
      "content": true,
      "admin": true,
      "keys": {
        "content": "read-only-key",
        "admin": "jwt-signing-key"
      }
    },
    "activitypub": {
      "enabled": true,
      "domain": "articles.degenfeed.xyz",
      "handle": "@{username}@articles.degenfeed.xyz"
    },
    "membership": {
      "stripe": {
        "secret_key": "...",
        "webhook_secret": "...",
        "product_prefix": "degenfeed_"
      },
      "currency": "usd"
    },
    "mail": {
      "transport": "SMTP",
      "options": {
        "host": "mail.degenfeed.xyz",
        "port": 587
      }
    },
    "webhooks": [
      {
        "event": "post.published",
        "target_url": "https://api.degenfeed.xyz/webhooks/ghost/article-published"
      },
      {
        "event": "post.edited",
        "target_url": "https://api.degenfeed.xyz/webhooks/ghost/article-edited"
      },
      {
        "event": "post.deleted",
        "target_url": "https://api.degenfeed.xyz/webhooks/ghost/article-deleted"
      }
    ]
  }
}
```

---

## 5. Integration with Protocol Bridges

### 5.1 How Articles Federate

The most powerful feature: **a single Ghost article reaches every protocol simultaneously.**

```
┌─────────────────────────────────────────────────────────────────┐
│  Creator writes article in DegenFeed composer                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  DegenFeed Ghost — Content API receives post                     │
│  • Article saved as Ghost "post" with markdown/Mobiledoc         │
│  • Ghost ActivityPub service publishes Article activity          │
│  • Ghost webhook fires: post.published → bridge engine           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Protocol Bridge Engine (processes in parallel)                  │
└──────┬──────────┬──────────┬──────────┬──────────┬──────────────┘
       │          │          │          │          │
       ▼          ▼          ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ActivityPub│ │Bluesky   │ │Nostr     │ │Farcaster │ │Lens      │
│(Mastodon, │ │(AT Proto)│ │(relays)  │ │(Hub)     │ │(Hub)     │
│ PeerTube, │ │          │ │          │ │          │ │          │
│ WriteFr.) │ │          │ │          │ │          │ │          │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

### 5.2 Per-Protocol Article Representation

| Protocol | Format | How Article Appears |
|---|---|---|
| **ActivityPub** (Mastodon, GoToSocial, PeerTube) | `Article` object (native) | Ghost ActivityPub service publishes `Create/Article` activity. Followers see a link preview + "Read more at articles.degenfeed.xyz" |
| **Bluesky** (AT Protocol) | `app.bsky.feed.post` with embed + card | Article rendered as a post with an embed card (OG image + title + description). Integration via "DegenFeed Articles" feed generator |
| **Nostr** | NIP-23 long-form note (`kind:30023`) | Full article content stored on relays as a replaceable event. NIP-23 supports markdown, title, image, tags |
| **Farcaster** | Cast with embeds | 320-char summary + link to article. Cast embed shows OG preview. Alternatively, use Farcaster Frames for interactive article preview |
| **Lens** | Publication with content URI | Article content stored on Arweave/IPFS, publication points to content URI. Collect modules for monetization |
| **RSS/Atom** | Native RSS feed | Ghost generates RSS natively. DegenFeed's existing `packages/rss-sdk` consumes it into the unified feed |

### 5.3 Bridgy Fed Integration

We already run Bridgy Fed at `bridgy.degenfeed.xyz` to bridge GoToSocial posts to Bluesky, Nostr, and Farcaster. Our Ghost instance becomes **another ActivityPub source** for Bridgy Fed:

```
Current:  GoToSocial ──▶ Bridgy Fed ──▶ Bluesky / Nostr / Farcaster
Future:   Ghost ──▶ ActivityPub Article ──▶ Bridgy Fed ──▶ (all protocols)
```

New Bridgy Fed instance (or Bridgy Fed "channel") dedicated to Ghost articles:
```
bridgy-articles.degenfeed.xyz  (new subdomain)
  - watches Ghost ActivityPub outbox
  - translates Article objects → AT Protocol posts
  - translates Article objects → Nostr kind:30023 events
  - translates Article objects → Farcaster casts with embeds
  - translates Article objects → Lens publications
```

### 5.4 Cross-Posting (Article → Short Posts)

When a creator publishes an article, DegenFeed can optionally auto-generate **short-form posts** announcing the article on each protocol:

| Protocol | Auto-generated Post |
|---|---|
| **Nostr** | "📝 New article: [Title] — [link]  #degenfeed" |
| **Farcaster** | "📝 Just published: [Title] \n\n[2-line summary] \n\n→ [link]" |
| **Bluesky** | "📝 New on DegenFeed: [Title] \n\n[2-line summary] \n\n🔗 [link]" |
| **Mastodon** | "📝 New article: [Title] \n\n[2-line summary] \n\n[link]" |
| **Lens** | Same format via Lens protocol |

This is handled by the `packages/cross-publish/` package in our bridge layer.

---

## 6. Creator Monetization

### 6.1 Revenue Model for Longform

DegenFeed's existing creator economy (0% fees, protocol-agnostic tipping, coins, subscriptions) maps naturally to longform:

| Revenue Stream | How It Works | Existing Infrastructure |
|---|---|---|
| **Article tipping** | Readers tip article authors via any method (ETH, SOL, Lightning, USDC) | ✅ `recordUnifiedTip()` — extend to article entity type |
| **Paid membership** | Monthly/yearly subscription via Ghost Stripe integration | ✅ Ghost members API + Stripe Connect |
| **Token-gated articles** | Only $COIN holders can read full article | ✅ `packages/token-gate` — integrate with Ghost content API |
| **Paid newsletters** | Substack-style paid email subscriptions | ✅ Ghost newsletter pipeline |
| **Creator coin bonuses** | Holding creator coin gives early access / bonus content | ✅ Creator coin contracts on Base |
| **NFT/article collectibles** | Mint article as Zora NFT (Zora Wrap existing) | ✅ Cross-protocol bridge engine Zora Wrap |
| **Cross-platform re-publishing** | Syndicate articles to other platforms for $ | Future feature |
| **Sponsorship/ads** | Optional — not planned for v1 | — |

### 6.2 How It Works End-to-End

```
1. Creator sets up:
   - Free tier (all articles public)
   OR
   - Paid tier ($5/mo via Stripe)
   OR
   - Token gate (requires 1,000 $COIN to read)
   OR
   - Hybrid (some free, some paid, some gated)

2. Creator writes article → hits publish

3. DegenFeed Ghost:
   a. Saves article to MySQL
   b. Generates email newsletter (if enabled)
   c. Fires post.published webhook
   d. ActivityPub announces Article to followers

4. Bridge engine activates:
   a. Cross-posts short-form announcements to Nostr/FC/BSky/Mastodon/Lens
   b. Generates OG previews for all protocols

5. Reader discovers article:
   a. Via their protocol of choice (Nostr note, FC cast, etc.)
   b. Via DegenFeed unified feed (in-app)
   c. Via email newsletter

6. Reader can:
   a. Read full article (public)
   b. Pay to unlock (paid membership/token gate)
   c. Tip the author (any method)
   d. Share on any protocol
   e. Comment (bridged back to Ghost)
```

### 6.3 Comparison: DegenFeed vs Substack vs Ghost(Pro)

| Feature | Substack | Ghost(Pro) | **DegenFeed Ghost** |
|---|---|---|---|
| Email newsletters | ✅ Built-in | ✅ Built-in | ✅ Built-in |
| Paid subscriptions | ✅ 10% fee | ✅ 0% fee (hosting cost) | **✅ 0% fee** |
| Stripe integration | ✅ Built-in | ✅ Built-in | ✅ Built-in |
| ActivityPub | ❌ | ✅ Since v5.0 | **✅ + cross-protocol** |
| Protocol bridges | ❌ | ❌ | **✅ Nostr/FC/BSky/Lens/Masto** |
| Token gating | ❌ | ❌ | **✅ Creator coin gating** |
| Multi-currency tipping | ❌ | ❌ | **✅ 7 methods** |
| Cross-platform audience | ❌ | ❌ | **✅ Federated distribution** |
| Creator coins | ❌ | ❌ | **✅ ERC-20 + SPL** |
| Open source | ❌ | ✅ MIT | **✅ Forkable MIT** |
| Protocol portability | ❌ | ❌ | **✅ Write once, publish everywhere** |

---

## 7. Unified Content Pipeline

### 7.1 Content Type Hierarchy

DegenFeed's unified feed already handles multiple content types. Longform adds a new type:

```
DegenFeed Unified Post
├── short (text, 1-500 chars)              ✅ Existing
│   ├── note (Nostr kind:1)
│   ├── cast (Farcaster)
│   ├── skeet (Bluesky)
│   └── toot (Mastodon)
├── short_video (vertical, <60s)            ✅ Existing
├── video (long-form, YouTube/PeerTube)     ✅ Existing
├── space (audio, live/recorded)            ✅ Existing
├── image (photo/article cover)             ✅ Existing
└── article (longform, >500 chars)          🆕 NEW
    ├── ghost_post (from Ghost)
    ├── nip23_note (from Nostr relays)
    ├── activitypub_article (from ActivityPub)
    ├── rss_entry (from RSS feeds)
    └── bluesky_long (from AT Protocol feed gen)
```

### 7.2 Article Schema in Unified Feed

```typescript
// packages/feed-core/src/types.ts — extended

export interface ArticlePost extends BasePost {
  type: 'article';
  
  // Ghost-native fields
  ghostId?: string;
  ghostUrl?: string;
  mobiledoc?: string;       // Ghost's rich text format
  excerpt?: string;
  
  // Content fields
  title: string;
  body: string;              // Markdown or HTML
  bodyFormat: 'markdown' | 'html' | 'mobiledoc';
  readingTime: number;       // Minutes
  coverImage?: string;
  
  // Monetization
  access: 'free' | 'paid' | 'token-gated';
  tierId?: string;           // Ghost tier ID
  tokenMint?: string;        // Solana token mint for gating
  tokenChain?: string;
  tokenAmount?: string;
  
  // Protocol cross-links
  crossPosts: {
    protocol: string;
    url: string;
    postId: string;
    publishedAt: number;
  }[];
  
  // Bridged interactions
  remoteComments: {
    protocol: string;
    commentId: string;
    author: { name: string; avatar?: string; };
    body: string;
    publishedAt: number;
  }[];
  
  // Tipping (extends existing)
  tipStats: {
    totalUsd: number;
    count: number;
    methods: string[];
  };
}
```

### 7.3 KV Schema (extends existing tipping KV)

```typescript
// Workers KV — new keys for articles

// Article aggregate
Key: article:{ghostId}
Value: {
  ghostId: string,
  title: string,
  slug: string,
  authorId: string,
  tierId?: string,
  access: 'free' | 'paid' | 'token-gated',
  publishedAt: number,
  crossPosts: [{ protocol, url, postId, publishedAt }],
  tipTotalUsd: number,
  tipCount: number,
  viewCount: number
}

// Ghost identity → DegenFeed identity mapping
Key: ghost:author:{ghostAuthorId}
Value: {
  ghostAuthorId: string,
  degenfeedUserId: string,
  nostrPubkey?: string,
  farcasterFid?: number,
  blueskyDid?: string,
  lensProfileId?: string,
  evmAddresses: string[],
  solanaAddresses: string[],
  linkedAt: number
}
```

### 7.4 New API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/articles` | GET | Browse articles (unified feed) |
| `/api/articles/:id` | GET | Single article with protocol cross-links |
| `/api/articles/publish` | POST | Publish via Ghost Admin API + bridge |
| `/api/articles/cross-posts/:id` | GET | Cross-protocol post status for article |
| `/api/articles/token-gate/:id` | GET | Token gate verification |
| `/api/tip/article/:id` | POST | Tip article author (extends existing) |
| `/api/webhooks/ghost/article-published` | POST | Ghost post.published webhook receiver |
| `/api/webhooks/ghost/article-edited` | POST | Ghost post.edited webhook receiver |
| `/api/webhooks/ghost/article-deleted` | POST | Ghost post.deleted webhook receiver |

---

## 8. Implementation Plan

### Phase 1: Fork & Containerize (Week 1-2)

| Task | Description |
|---|---|
| **Fork Ghost repo** | Fork `TryGhost/Ghost` → `git.rugmunch.io/RugMunchMedia/degenfeed-ghost` |
| **Create Docker compose** | `infra/docker/degenfeed-ghost-compose.yml` — Ghost + MySQL + Redis |
| **Disable frontend** | `forceAdminRedirect: false`, disable theme layer, disable portal |
| **Configure headless API** | Enable Content API + Admin API, generate keys |
| **Configure webhooks** | Set up `post.published` → `api.degenfeed.xyz/webhooks/ghost/` |
| **Deploy to Talos** | Docker compose on `articles.degenfeed.xyz` subdomain |
| **Verify ActivityPub** | Ghost ActivityPub service federating with Mastodon |

**Deliverable:** Ghost running headless at `articles.degenfeed.xyz`, API accessible, ActivityPub working.

### Phase 2: Bridge Package (Week 2-3)

| Task | Description |
|---|---|
| **Create `packages/ghost-bridge/`** | Integration between Ghost API and DegenFeed universe |
| **Create `packages/cross-publish/`** | Article → short-form posts bridge engine |
| **Implement webhook handlers** | `article.published` → cross-post to all protocols |
| **Add Ghost content to unified feed** | `packages/feed-core` extended for article type |
| **Create Ghost identity mapping** | `ghost:author:{id}` KV namespace |
| **Update Bridgy Fed** | Second instance for Ghost articles |

**Deliverable:** Publishing an article in Ghost auto-cross-posts to Nostr, Farcaster, Bluesky, Mastodon.

### Phase 3: Monetization (Week 3-4)

| Task | Description |
|---|---|
| **Integrate Stripe** | Ghost Stripe Connect → DegenFeed creator payouts |
| **Add token-gating** | `packages/token-gate` checks creator coin balance before serving full article |
| **Extend tipping** | `recordUnifiedTip()` handles `article:{ghostId}` entity type |
| **Add article tipping UI** | Tip button on article reader page |
| **Creators can set tiers** | Free / Paid ($X/mo) / Token-gated (Y $COIN) |

**Deliverable:** Creators earn from articles via subscriptions, token gates, and tips.

### Phase 4: Article Reader UI (Week 4-6)

| Task | Description |
|---|---|
| **Article reader component** | `apps/web/src/components/ArticleReader.tsx` — clean reading view |
| **Typography system** | Medium-style, reading time, progress bar, highlights |
| **Composer extension** | Existing compose modal extended for longform (title, cover image, markdown) |
| **Author dashboard** | Article stats: views, tips, subscription revenue |
| **Cross-post status** | Per-article view showing "Published on Nostr ✓, FC ✓, BSky ✓" |

**Deliverable:** Full article reading and writing experience in `apps/web`.

### Phase 5: Newsletter & Email (Week 5-6)

| Task | Description |
|---|---|
| **Configure Ghost mail** | Mailgun or SMTP integration for newsletter delivery |
| **Subscriber management** | Import existing subscribers from Ghost, DegenFeed sign-ups |
| **Paid newsletters** | Stripe-tiered newsletters via Ghost members |
| **Email → web archive** | Emails link back to article on DegenFeed |

**Deliverable:** Creators can run paid newsletters from DegenFeed, distributed via email + all protocols.

### Phase 6: Advanced Federation (Week 6-8)

| Task | Description |
|---|---|
| **Nostr NIP-23** | Publish article content directly to relays as kind:30023 |
| **Bluesky Feed Generator** | "DegenFeed Articles" feed on Bluesky |
| **Farcaster Frames** | Interactive article preview Frame |
| **Cross-protocol comments** | Comments from Nostr/FC/BSky bridged back to Ghost |
| **AT Protocol integration** | Ghost ActivityPub → AT Protocol bridge |

**Deliverable:** Full article federation — content and comments flow both ways across all protocols.

---

## 9. Appendices

### A. Ghost Community Stats

| Metric | Value |
|---|---|
| GitHub stars | 48,000+ |
| Contributors | 850+ |
| Commits | 25,000+ |
| Releases | 500+ (weekly releases) |
| Docker pulls | 100M+ |
| Active installs | 100M+ |
| Ghost(Pro) customers | 30,000+ |
| Annual revenue | $10.9M ARR (all reinvested) |
| Founded | 2013 (13 years active) |
| License | MIT |

### B. Ghost ActivityPub Implementation Details

From the Ghost codebase analysis (`ghost/core/core/server/services/activitypub/`):

- **Service:** `ActivityPubService` class manages the ActivityPub lifecycle
- **Webhooks:** Registers webhooks for `post.published` and `post.deleted`
- **Object type:** Publishes `Article` ActivityPub objects (not `Note`)
- **Identity:** Blog is an ActivityPub actor at `@username@articles.degenfeed.xyz`
- **Inbox/Outbox:** Standard ActivityPub inbox/outbox endpoints
- **Following:** Can follow other ActivityPub actors
- **Likes/Boosts:** Handles `Like` and `Announce` activities
- **Frontend:** Ghost ships a React ActivityPub client app (`apps/activitypub/`) which we replace with our own

### C. Token Gate Verification Flow

```
Reader clicks article link
  → DegenFeed checks article.access
  → If 'free': serve full content
  → If 'paid': redirect to Stripe checkout (Ghost handles)
  → If 'token-gated':
      1. Reader connects wallet
      2. `packages/token-gate` checks balance of creator coin mint
      3. If balance >= threshold → serve full content
      4. If balance < threshold → show "Need 1,000 $COIN to unlock" + buy link
      5. (Optional) Allow one-time token payment instead of holding
```

### D. Cross-Protocol Comment Bridging

```
Article on Ghost
  → Reader on Nostr comments via kind:1
  → Bridge engine detects reply to article cross-post
  → Translates to Ghost comment (via Ghost Admin API or webhook)
  → Ghost associates with original article
  → Other readers see the comment in their protocol

Reverse:
  → Reader comments on Ghost article
  → Ghost fires webhook
  → Bridge engine translates to:
    → Nostr: kind:1 reply to the article announcement
    → Bluesky: reply to the article post
    → Farcaster: reply to the article cast
```

### E. Infrastructure Requirements

| Resource | Requirement |
|---|---|
| **Server** | Talos VM (existing) |
| **Subdomain** | `articles.degenfeed.xyz` |
| **Database** | MySQL 8.0 (Docker on Talos or hosted) |
| **Storage** | Ghost media stored in S3-compatible (Minio on Talos) or local volume |
| **Cache** | Redis (existing `rmi-redis`) |
| **Email** | Mailgun or SMTP relay |
| **Stripe** | Stripe Connect account |
| **Docker** | `infra/docker/degenfeed-ghost-compose.yml` |
| **SSL** | Certbot on existing Nginx (add `articles.degenfeed.xyz`) |

### F. Estimated Costs

| Item | Monthly Cost |
|---|---|
| MySQL (Docker on Talos) | $0 (existing hardware) |
| Storage (Minio, 10 GB) | $0 (existing) |
| Email (Mailgun, 10K/mo) | $1 (free tier) |
| Stripe (Connect + processing) | 2.9% + $0.30 per transaction |
| Ghost fork maintenance | ~4 hr/week engineering |
| **Total** | **~$1 + Stripe fees** |

### G. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Ghost upstream changes break our fork | Low | Medium | Track specific packages, minimize diff surface |
| ActivityPub federation complex | Medium | Medium | Ghost has it working; we just wire the bridge |
| Email deliverability | Medium | High | Use Mailgun/SendGrid, configure SPF/DKIM/DMARC |
| Stripe onboarding friction | Medium | Low | Stripe Connect standard onboarding flow |
| Token-gating UX too complex | Medium | Medium | Support one-click "buy with card" override |
| MySQL scaling | Low | Low | Ghost is read-heavy, MySQL handles millions of posts |
| Ghost v6.0 API changes | Low | Medium | Pin Ghost version, monitor changelog |

---

## Quick Summary

| Question | Answer |
|---|---|
| **What are we forking?** | Ghost CMS (MIT license, 48K+ stars) |
| **Why Ghost?** | Best headless API, built-in ActivityPub, Stripe memberships, newsletter delivery, TypeScript stack |
| **What do we customize?** | Strip frontend/theme, add protocol bridge layer, add token gating, add cross-publish engine |
| **How do articles federate?** | Ghost ActivityPub → Bridgy Fed → Bluesky/Nostr/Farcaster/Lens; plus direct NIP-23 for Nostr |
| **How do creators monetize?** | Stripe subscriptions, token-gated content, cross-protocol tipping (7 methods) |
| **What's the first deploy?** | Ghost headless at `articles.degenfeed.xyz` with API + webhooks |
| **When do we start?** | Fork Ghost this week |

---

*Next step: Fork `TryGhost/Ghost` → `git.rugmunch.io/RugMunchMedia/degenfeed-ghost`, create Docker compose, deploy headless to `articles.degenfeed.xyz`.*
