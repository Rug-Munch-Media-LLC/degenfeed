# DegenFeed Web — Architecture

**Status:** canonical  
**Last updated:** 2026-07-25  
**Protocols:** 44+ (11 standardized bridge providers + Matrix bridge hub + ActivityPub federation + API integrations)  
**Docker Services:** 48+ across the fleet ([HOST-1] + [HOST-2])  
**Monorepo Packages:** 43+  
**Worker API Routes:** ~500+ (200+ route modules in 90+ major route groups)  
**TypeScript Source Files:** 1,419+

## Overview

Turborepo monorepo with a Cloudflare Pages-hosted Next.js 16 client and a Cloudflare Worker edge API. Shared packages provide protocol adapters, feed normalization, identity resolution, creator coins, livestreaming, and wallet auth. Self-hosted infrastructure (GoToSocial, AT Protocol PDS, PeerTube, Matrix, Redlib, RSS-Bridge, Prosody XMPP) runs on [HOST-1].

```
┌─────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL LAYER                                  │
│  social.degenfeed.xyz  │  pds.degenfeed.xyz  │  video.degenfeed.xyz  │
│  (GoToSocial)          │  (AT Protocol PDS)  │  (PeerTube)           │
│  redlib.degenfeed.xyz  │  rss-bridge.xyz     │  chat.degenfeed.xyz   │
│  (Redlib)              │  (RSS-Bridge)       │  (Prosody XMPP)       │
├─────────────────────────────────────────────────────────────────────┤
│                      EDGE LAYER (Cloudflare)                         │
│  degenfeed.xyz (Worker — landing + API, ~500+ routes)               │
│  app.degenfeed.xyz (Pages — Next.js 16, 60+ route groups)           │
│  19 KV namespaces for cache, identity, coins, communities, etc.     │
├─────────────────────────────────────────────────────────────────────┤
│                      PACKAGES LAYER (43+)                            │
│  Protocol SDKs   │  Feed Pipeline  │  Identity     │  Auth           │
│  Creator Coins   │  Tip Engine     │  Ranking      │  Web3           │
│  Reputation      │  Storage        │  Realtime     │  UI Components  │
│  Smart Contracts │  Token SDK      │  Video        │  Shorts         │
│  Bridge SDKs     │  Matrix Bridge  │  Spaces       │  Monetization   │
└─────────────────────────────────────────────────────────────────────┘
```

## Monorepo Structure

```
apps/
  web/                    Next.js 16 aggregator client at app.degenfeed.xyz
                            src/
                              app/           App Router pages (feed, profile, discover, etc.)
                              components/    ~160 shared UI components
                              lib/           Client-side utilities
                              middleware.ts  Auth middleware for /api/*

workers/
  api/                    Cloudflare Worker: edge proxy + aggregator (degenfeed-api, ~500 routes)
                            src/
                              index.ts       Env interface, rate limiter, GTS config, cron handler
                              app.ts         Hono router, middleware, CORS
                              serve.ts       Node.js fallback for local dev
                              session.ts     HMAC-SHA256 session management, CSRF tokens
                              cors.ts        Origin validation
                              api-key.ts     Scoped API key management
                              premium.ts     Premium subscription gating
                              error-logger.ts KV-backed error tracking
                              lib/           40+ shared libs (bridge-engine, community-store, crypto-seal, admin-guard)
                              feed/          Feed pipeline (cache, scorer, curator, freshness, feedback, aggregators)
                              routes/        ~100 route modules (see Protocol Integration Map below)
                              __tests__/     Vitest test suite

packages/  
  43+ shared workspaces — see full list below

bridge/
  src/
    server.ts              HTTP server — all 11 provider routes
    crossposter.ts         Cross-platform posting (GTS → Nostr)
    providers/             11 protocol-specific data fetchers

infra/
  cloudflare/              Wrangler configs, Pages project, KV setup
  monitoring/              GlitchTip, Grafana, Prometheus, Node Exporter
  deploy-templates/        Docker compose templates (peertube, pds, etc.)
  docker/                  Docker config helpers
  nginx/                   Nginx reverse proxy configs

mobile/                    Capacitor mobile shell (iOS + Android)
docs/                      VitePress documentation site
design/                    Design tokens and Style Dictionary config
scripts/                   Deploy, rollback, migration scripts
tests/                     Integration and E2E tests
```

## Full Package Map (43+)

### Protocol SDKs
| Package | Protocol | Feed | Post | Tip | Coin | Stream | Bridge |
|---------|----------|------|------|-----|------|--------|--------|
| `nostr-sdk` | Nostr | ✅ | ✅ | ✅ | — | — | ✅ |
| `farcaster-sdk` | Farcaster | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| `bluesky-sdk` | Bluesky/AT Protocol | ✅ | ✅ | ✅ | — | — | ✅ |
| `mastodon-sdk` | Mastodon/ActivityPub | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| `lens-sdk` | Lens Protocol | ✅ | — | ✅ | ✅ | — | ✅ |
| `threads-sdk` | Threads/Instagram | ✅ | ✅ | — | — | — | ✅ |
| `rss-sdk` | RSS/Atom | ✅ | — | — | — | — | — |
| `peertube-sdk` | PeerTube API | ✅ | ✅ | — | — | ✅ | ✅ |
| `peertube-provider` | PeerTube provider | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| `telegram-sdk` | Telegram Bot API | ✅ | ✅ | — | — | — | ✅ |
| `discord-sdk` | Discord Bot API | ✅ | ✅ | — | — | — | ✅ |
| `matrix-sdk` | Matrix homeserver | ✅ | ✅ | — | — | — | ✅ |
| `github-sdk` | GitHub API | ✅ | ✅ | — | — | — | ✅ |
| `pixelfed-sdk` | Pixelfed | ✅ | ✅ | — | — | — | ✅ |
| `lemmy-sdk` | Lemmy | ✅ | — | ✅ | — | — | ✅ |
| `youtube-provider` | YouTube API | ✅ | — | — | — | — | — |
| `zora-sdk` | Zora Protocol | ✅ | — | ✅ | ✅ | — | ✅ |
| `ghost-bridge` | Ghost CMS | ✅ | ✅ | — | — | — | ✅ |
| `mirror-bridge` | Mirror.xyz | ✅ | — | — | — | — | ✅ |
| `paragraph-bridge` | Paragraph.xyz | ✅ | ✅ | — | — | — | ✅ |
| `newsletter-bridge-sdk` | Substack/Ghost RSS | ✅ | ✅ | — | — | — | ✅ |
| `livepeer-provider` | Livepeer | ✅ | — | — | — | ✅ | — |
| `solana-programs` | Solana | — | — | ✅ | ✅ | — | ✅ |

### Core Engine Packages
| Package | Purpose |
|---------|---------|
| `types` | Unified protocol types and interfaces |
| `feed-core` | Feed normalization, deduplication, and assembly |
| `feed-providers` | Feed data provider adapters |
| `ranking` | Transparent feed scoring algorithms |
| `ui` | Shared React components (Card, Shell, PostCard, etc.) |
| `identity` | Cross-protocol identity resolution |
| `auth` | Wallet sign-in and session management |
| `web3` | Web3 utilities |
| `crypto` | Cryptographic helpers |
| `storage` | Client and edge storage helpers |
| `realtime` | WebSocket and SSE real-time sync |
| `reputation` | Reputation scoring and leaderboard |
| `cross-protocol-bridge` | Cross-protocol content bridge engine |
| `crossplatform-register` | Cross-platform registration |
| `creator-coin` | Creator coin management |
| `creator-rewards` | Creator rewards engine |
| `monetization` | Monetization and subscription logic |
| `shorts-provider` | Short-form video provider |
| `spaces-audio` | Audio Spaces engine (LiveKit) |
| `spaces-bridge` | Cross-protocol spaces bridge |
| `token-gate` | Token-gated content access |
| `source-discovery` | Content source discovery |
| `utils` | Shared utility functions |
| `tip-contract` | Solidity + Anchor smart contracts |
| `solana-programs` | Solana on-chain programs (Rust) |

## Protocol Integration Map

Each protocol has a corresponding SDK package and worker route handler(s).

### Standardized Bridge Providers (11)
These follow the Provider Interface with `schema`, `fetch`, and `contentType`:

| Protocol | SDK Package | Bridge Route | Status |
|----------|-------------|-------------|--------|
| Nostr | `nostr-sdk` | `/api/feed/nostr` | 🟢 |
| Farcaster | `farcaster-sdk` | `/api/feed/farcaster` | 🟢 |
| Bluesky | `bluesky-sdk` | `/api/feed/bluesky` | 🟢 |
| Mastodon/GoToSocial | `mastodon-sdk` | `/api/feed/mastodon` | 🟢 |
| Lens | `lens-sdk` | `/api/feed/lens` | 🟢 |
| Pixelfed | `pixelfed-sdk` | `/api/feed/pixelfed` | 🟢 |
| PeerTube | `peertube-provider` | `/api/feed/peertube` | 🟢 |
| Lemmy | `lemmy-sdk` | `/api/feed/lemmy` | 🟢 |
| Reddit | Redlib proxy | `/api/feed/reddit` | 🟢 |
| RSS/Atom | `rss-sdk` | `/api/feed/news` | 🟢 |
| Zora | `zora-sdk` | `/api/feed/zora` | 🟢 |

### Worker API Route Categories (90+ route modules, ~500+ routes)

| Category | Routes | Description |
|----------|--------|-------------|
| Feed | 15+ | Unified, trending, news, per-protocol, for-you, category |
| Auth | 10+ | Login, logout, session, OAuth providers, email, wallet |
| Posts | 8+ | Publish, cross-post, schedule, drafts |
| Identity | 6+ | Resolve, profile, link, unlink, search |
| Tipping | 8+ | Create, resolve, settings, lightning, batch, stream |
| Creator Coins | 15+ | Deploy, trade, curve, holders, cross-chain, bridge |
| Communities | 8+ | Create, join, discover, feed, governance |
| Livestreaming | 10+ | Start, stop, status, RTMP, announce |
| Audio Spaces | 6+ | Create, join, live, upcoming, record |
| Video | 6+ | Hub, categories, shorts, visual feed |
| Admin | 12+ | Stats, users, content, flags, config, rate-limits |
| Notifications | 4+ | List, push register, preferences |
| Search | 4+ | Cross-protocol, identity, content |
| Analytics | 6+ | Overview, stream views, creator stats |
| Moderation | 6+ | Report, ban, stats, queue |
| Preferences | 6+ | Get, update, replace |
| Health | 8+ | Worker, feed pipeline, bridge, protocol status |
| Bridge | 6+ | Wrap, sync, status, cross-chain |
| Discovery | 4+ | Trending, people, related |
| Other | 20+ | Embed, frame, prices, features, translate, OG, funding |

### Additional Protocol Access (via Matrix Bridge Hub)
The Matrix bridge hub provides access to 20+ additional messaging platforms:

| Platform | Bridge Type | Feed | Post |
|----------|-------------|------|------|
| WhatsApp | mautrix-whatsapp | ✅ | ✅ |
| Signal | mautrix-signal | ✅ | ✅ |
| Slack | mautrix-slack | ✅ | ✅ |
| IRC | matrix-appservice-irc | ✅ | ✅ |
| WeChat | mautrix-wechat | ✅ | ✅ |
| Google Chat | mautrix-googlechat | ✅ | ✅ |
| Facebook Messenger | mautrix-messenger | ✅ | ✅ |
| Instagram DM | mautrix-instagram | ✅ | ✅ |
| +15 more | various mautrix bridges | ✅ | ✅ |

### Additional Protocol Access (via API/Scraping)

| Protocol | Method | Feed | Notes |
|----------|--------|------|-------|
| Twitter/X | Twitter API v2 | ✅ | Read-only, API restrictions |
| Threads | Threads API | ✅ | Experimental |
| YouTube | YouTube Data API v3 | ✅ | Read-only, quota limits |
| Odysee/LBRY | LBRY SDK JSON-RPC | ✅ | Read-only |
| Hacker News | Firebase API | ✅ | Read-only |
| Mirror.xyz | GraphQL API | ✅ | Read-only |
| Paragraph.xyz | REST API | ✅ | Read/write |
| Ghost | Ghost API + RSS | ✅ | Read/write |
| GitHub | GitHub API | ✅ | Read/write |

## Data Flow Diagrams

### Feed Aggregation Flow

```
User opens app.degenfeed.xyz/feed
        │
        ▼
Next.js /feed page → fetches /api/feed/unified
        │
        ▼
Worker: routes/feed-unified.ts
        │
        ├── Check CACHE KV (feed:unified:{wallet})
        │   ├── HIT → return cached feed
        │   └── MISS → continue
        │
        ├── Fetch from each enabled protocol in parallel:
        │   ├── Nostr (relay pool)
        │   ├── Farcaster (Hub gRPC)
        │   ├── Bluesky (public.api.bsky.app)
        │   ├── Mastodon/GoToSocial (social.degenfeed.xyz)
        │   ├── Threads (public.threads.net)
        │   ├── PeerTube (video.degenfeed.xyz)
        │   ├── Lens (api-v2.lens.dev)
        │   ├── Pixelfed (RSS + API)
        │   ├── Reddit (redlib.degenfeed.xyz)
        │   ├── RSS (rss-bridge.degenfeed.xyz)
        │   ├── Zora (GraphQL)
        │   ├── YouTube (Data API)
        │   ├── Telegram (bot channels)
        │   ├── Discord (webhooks/bot)
        │   ├── Matrix (rooms)
        │   └── Additional bridge sources...
        │
        ├── Normalize + deduplicate (packages/feed-core)
        ├── Score + rank (packages/ranking)
        ├── Curate (seen posts, muted authors, quality filter)
        ├── Cache result in CACHE KV
        └── Return JSON
                │
                ▼
Next.js renders feed timeline
```

### Cross-Protocol Content Flow

```
                 ┌──────────────────────────────────────┐
                 │         DegenFeed Content Hub         │
                 │    (composer + bridge engine)          │
                 └──────────┬───────────┬────────────────┘
                            │           │
              ┌─────────────┘           └─────────────┐
              ▼                                       ▼
    ┌──────────────────┐                  ┌──────────────────────┐
    │   Write Path       │                  │   Read Path           │
    │                    │                  │                       │
    │ 1. User composes  │                  │ 1. User opens feed    │
    │ 2. Select targets │                  │ 2. Worker fetches     │
    │ 3. Auth check     │                  │    from 44+ sources   │
    │ 4. Publish to each│                  │ 3. Normalize + rank   │
    │    protocol SDK   │                  │ 4. Cache + return     │
    │ 5. Store refs     │                  │                       │
    └──────────────────┘                  └──────────────────────┘
```

### Matrix Bridge Hub Architecture

```
                      ┌─────────────────────────────────────┐
                      │   DegenFeed Matrix (chat.degenfeed)  │
                      │                                      │
                      │   ┌──────────┐  ┌──────────┐       │
                      │   │ mautrix   │  │ mautrix  │       │
                      │   │ -whatsapp │  │ -signal  │       │
                      │   └──────────┘  └──────────┘       │
                      │   ┌──────────┐  ┌──────────┐       │
                      │   │ mautrix   │  │ mautrix  │       │
                      │   │ -telegram │  │ -discord │       │
                      │   └──────────┘  └──────────┘       │
                      │   ┌──────────┐  ┌──────────┐       │
                      │   │ mautrix   │  │ appsvc   │       │
                      │   │ -slack    │  │ -irc     │       │
                      │   └──────────┘  └──────────┘       │
                      │                                      │
                      │   DegenFeed feed ← Matrix → GtS     │
                      │              ↕                       │
                      │         DegenFeed Web Client        │
                      └─────────────────────────────────────┘
```

## Service Architecture (48+ Docker Services)

### Self-Hosted Infrastructure ([HOST-1])

| Service | URL | Purpose | Container |
|---------|-----|---------|-----------|
| **GoToSocial** | social.degenfeed.xyz | ActivityPub server | Docker |
| **AT Protocol PDS** | pds.degenfeed.xyz | Bluesky Personal Data Server | Docker |
| **PeerTube** | video.degenfeed.xyz | Video hosting + livestreaming | Docker (3 containers: app, postgres, redis) |
| **Prosody XMPP** | chat.degenfeed.xyz | Stream chat server | Docker |
| **Redlib** | redlib.degenfeed.xyz | Privacy Reddit proxy | Docker |
| **RSS-Bridge** | rss-bridge.degenfeed.xyz | RSS feed generation | Docker |

### Matrix Bridge Hub ([HOST-1]/[HOST-2] — Planned)

| Service | Purpose |
|---------|---------|
| **Dendrite** | Matrix homeserver (lightweight Go impl.) |
| **mautrix-whatsapp** | WhatsApp bridge |
| **mautrix-signal** | Signal bridge |
| **mautrix-telegram** | Telegram bridge |
| **mautrix-discord** | Discord bridge |
| **mautrix-slack** | Slack bridge |
| **matrix-appservice-irc** | IRC bridge |
| **matrix-bifrost** | XMPP bridge |

### Monitoring Stack ([HOST-2] + [HOST-1])

| Service | URL | Purpose |
|---------|-----|---------|
| **GlitchTip** | glitchtip.rugmunch.io | Sentry-compatible error tracking |
| **Grafana** | [HOST-2] | Dashboards for fleet health |
| **Prometheus** | [HOST-2] | Metrics storage |
| **Node Exporter** | All hosts | Host metrics |

### Additional Platform Services (Planned)

| Service | URL | Purpose |
|---------|-----|---------|
| **Mobilizon** | events.degenfeed.xyz | Federated events |
| **Funkwhale** | music.degenfeed.xyz | Federated music/audio |
| **Castopod** | podcast.degenfeed.xyz | Podcast hosting + Podcasting 2.0 |
| **WriteFreely** | blog.degenfeed.xyz | Long-form publishing |
| **Discourse** | forum.degenfeed.xyz | Community forums + ActivityPub |

### DegenFeed Application Services

| Service | URL | Purpose | Container |
|---------|-----|---------|-----------|
| **Web (Next.js 16)** | app.degenfeed.xyz | Frontend application | Docker |
| **API Worker** | degenfeed.xyz/api/* | Edge API | Cloudflare Worker |
| **Bridge Server** | port 8787 | Protocol bridge | Docker |
| **MeiliSearch** | internal | Full-text search | Docker |

## Identity System

```
wallet (0x...) ───── identity-hub ─────┬── nostr pubkey (npub...)
                                        ├── farcaster fid (12345)
                                        ├── bluesky did (did:plc:...)
                                        ├── mastodon account (@user@social.degenfeed.xyz)
                                        ├── lens profile (lens/12345)
                                        ├── threads id
                                        ├── telegram id
                                        ├── discord id
                                        ├── matrix id
                                        ├── github id
                                        ├── pixelfed account
                                        └── reddit username (u/user)

ID resolution flows:
  wallet → all protocols    (identity-hub)
  did → wallet              (DID resolution)
  npub → wallet             (Nostr profile metadata)
  fid → wallet              (Farcaster verified address)
```

## Creator Coin System

### On-Chain Contracts

| Contract | Chain | Language | Purpose |
|----------|-------|----------|---------|
| `DegenFeedCoin.sol` | Base | Solidity | ERC-20 creator token with vesting (4 configs) |
| `DegenFeedFactory.sol` | Base | Solidity | Factory for deploying new creator coins |
| `CrossChainRegistry.sol` | Base | Solidity | On-chain protocol→chain→token mapping |
| `degenfeed-creator-token` | Solana | Anchor Rust | SPL token with matching vesting config |

### Vesting Configurations

| Preset | Initial Unlock | Cliff | Duration | Min Reputation |
|--------|---------------|-------|----------|----------------|
| Trustless | 0% | 30 days | 90 days | 0 |
| Balanced | 5% | 7 days | 60 days | 25 |
| Community | 10% | 0 days | 30 days | 50 |
| Fast | 20% | 0 days | 7 days | 75 |

### KV Schema

```
FARCASTER_COINS KV:
  farcaster:coin:{fid}        → { coinAddress, tokenId, symbol, name, deployedAt, chainId }
  farcaster:link:{fid}        → { linkedAddresses[] }

LENS_COINS KV:
  lens:coin:{profileId}       → { coinAddress, tokenId, symbol, name, deployedAt, chainId }
  lens:link:{profileId}       → { linkedAddresses[] }

XCHAIN_REGISTRY KV:
  xchain:token:{address}      → { fabricCoinAddress, baseCoinAddress, solanaMint }
  xchain:protocol:{protocol}  → { tokens: [] }

CONTENT_STORE KV:
  peertube:stream:{addr}:active   → { stream metadata, RTMP key }
  peertube:stream:{addr}:{uuid}   → { archived recording }
  peertube:stream:creator:{addr}  → { creator's stream list }
  peertube:chat:{addr}:{cursor}   → { chat messages }
  token:community:{addr}    → { comments, badges, milestones }
```

## Cross-Chain Bridging

```
      ┌──────────┐         ┌──────────┐         ┌──────────┐
      │  Base    │         │  Solana  │         │  Polygon │
      │ (EVM)    │◄────────│ (SPL)    │────────►│ (Lens)   │
      │          │  Wormhole│          │  Wormhole│          │
      │ Factory  │────────►│  Token   │◄────────│  Coins   │
      │ Coins    │  Bridge │  Program │  Bridge  │          │
      └──────────┘         └──────────┘         └──────────┘
           │                                           │
           │              ┌──────────┐                 │
           └──────────────│  Zora    │─────────────────┘
                          │ (NFT)    │
                          └──────────┘
```

## Security Model

### Authentication Layers

1. **Wallet Sign-In** — EIP-4361 (Sign in with Ethereum) + Solana wallet adapter
2. **Session Tokens** — HMAC-SHA256 signed cookies with CSRF token binding
3. **Session Revocation** — KV-backed revocation list for instant invalidation
4. **Scoped API Keys** — Per-service keys with granular permissions

### Authorization

- **Admin Guard** — `requireAdmin()` checks wallet address against `ADMIN_WALLETS`
- **Premium Gating** — `requirePremium()` checks SUBSCRIPTIONS KV
- **Owner Checks** — Route-level verification for content ownership
- **Rate Limiting** — KV-backed fixed-window: 6 tiers (5/10/20/20/30/100 req/min)

### Request Security

- **CORS** — Strict origin validation for state-changing requests
- **CSRF** — Double-submit cookie pattern with X-CSRF-Token header
- **Input Sanitization** — HTML stripping, length limits, XSS pattern detection
- **Suspicious Payload Detection** — CSS expression, vbscript, data URIs, eval, onerror

### Smart Contract Security

- **ReentrancyGuard** — OpenZeppelin's reentrancy protection
- **Anti-Exploit** — 3-phase bonding curve limits (2%/5%/10%), bundle detection, cooldowns
- **Dust Protection** — `MIN_BUY_AMOUNT` prevents micro-transaction attacks
- **Fee Validation** — Max total fee enforced at factory level

### Infrastructure Security

- **WebSocket** — Origin validation, IP rate limiting, max 5 connections, 5 min idle timeout
- **Encrypted KV Storage** — AES-256-GCM for sensitive credential storage
- **CSP Headers** — Content-Security-Policy enforced at edge
- **No Secrets in Git** — .env, .dev.vars, wrangler secrets only

## KV Namespace Reference

| Namespace | Purpose | TTL |
|-----------|---------|-----|
| `CACHE` | General cache, rate limiter, feed cache, sessions, user prefs | Varies (5s–90d) |
| `SUBSCRIPTIONS` | Premium subscriptions, newsletter subscribers | Permanent |
| `IDENTITIES` | Cross-protocol identity links | Permanent |
| `API_KEYS` | Scoped API key storage | Permanent |
| `CONTENT_STORE` | Token community content, livestreams, chat | Varies |
| `FARCASTER_COINS` | Farcaster creator coin records | Permanent |
| `LENS_COINS` | Lens Protocol creator coin records | Permanent |
| `XCHAIN_REGISTRY` | Cross-chain token registration | Permanent |
| `PLATFORM_ACCOUNTS` | Platform account records for registration | Permanent |
| `BLUESKY_INVITE_POOL` | Bluesky invite code pool | Permanent |
| `COMMUNITIES` | Cross-protocol community records | Permanent |
| `SPACES` | Audio Spaces data | Varies |
| `REPUTATION` | Reputation scores and leaderboard | Permanent |
| `BOOKMARKS` | User bookmark storage | Permanent |
| `DEPLOYMENTS` | Deployment request tracking | Varies |
| `PERMANENCE` | Content permanence proofs | Permanent |
| `GOVERNANCE` | DAO governance (proposals, votes) | Permanent |
| `REPORTS` | Reports and moderation state | Permanent |
| `CUSTOM_FEEDS` | Custom feed configurations | Permanent |

## Cron Schedule

| Cron | Handler | Purpose |
|------|---------|---------|
| `* * * * *` | `scheduled-executor.ts` | Execute scheduled posts |
| `*/30 * * * *` | `trending-scraper.ts` | Scrape trending content |
| `0 14 * * *` | `handleCron()` | Daily digest + trending refresh |
| `0 12 * * 0` | `source-discovery.ts`, `source-health.ts` | Weekly source discovery + health maintenance |

## Tooling

- **Build orchestration:** Turborepo + pnpm workspaces
- **Lint / format:** Biome
- **Type checking:** TypeScript `--noEmit`
- **Tests:** Vitest (unit), Playwright (E2E)
- **Smart Contracts:** Foundry (Solidity), Anchor (Rust/Solana)
- **CI:** GitHub Actions (`.github/workflows/ci.yml`)
- **Pre-commit:** Lefthook
- **Docker:** Multi-service Compose for full stack
- **Local entry point:** `Makefile`
