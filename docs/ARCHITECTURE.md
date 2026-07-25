# DegenFeed Web — Architecture

**Status:** canonical
**Last updated:** 2026-07-25
**Protocol union:** 92 protocols in `@degenfeed/types`
**Packages:** 41 SDK/service packages in monorepo
**Deployable services:** 4 (Worker API, Next.js frontend, Bridge, Docs)

---

## Overview

Turborepo monorepo with a Cloudflare Pages-hosted Next.js 16 client and a Cloudflare Worker edge API. Shared packages provide protocol adapters, feed normalization, identity resolution, creator coins, livestreaming, and wallet auth. Self-hosted infrastructure (GoToSocial, AT Protocol PDS, PeerTube) runs on Talos.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL LAYER                                    │
│  social.degenfeed.xyz  │  pds.degenfeed.xyz  │  video.degenfeed.xyz      │
│  (GoToSocial)          │  (AT Protocol PDS)  │  (PeerTube)               │
│  ────────────────      │  ────────────────   │  ────────────────         │
│  redlib.degenfeed.xyz  │  rss-bridge.xyz      │  chat.degenfeed.xyz      │
│  (Redlib)              │  (RSS-Bridge)        │  (Prosody XMPP)          │
├──────────────────────────────────────────────────────────────────────────┤
│                         EDGE LAYER (Cloudflare)                           │
│  degenfeed.xyz (Worker — landing + API)                                   │
│  app.degenfeed.xyz (Pages — Next.js 16)                                   │
│  KV: CACHE, SUBSCRIPTIONS, IDENTITIES, CONTENT_STORE, FARCASTER_COINS     │
│      LENS_COINS, XCHAIN_REGISTRY, PLATFORM_ACCOUNTS, ... (19 total KV)    │
├──────────────────────────────────────────────────────────────────────────┤
│                         PACKAGES LAYER                                     │
│  Protocol SDKs  │  Feed Pipeline  │  Identity  │  Auth  │  Web3            │
│  Creator Coins  │  Tip Engine     │  Ranking   │  UI    │  Storage         │
│  Reputation     │  Source Discovery│  Realtime  │  Crypto│  Monetization   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Monorepo Structure

```
apps/
  web/                    Next.js 16 aggregator client at app.degenfeed.xyz
                             src/
                               app/           App Router pages (88 route groups)
                               components/    Shared UI components
                               lib/           Client-side utilities
                               services/      API client service layer
                               hooks/         React hooks
                               types/         Client-side types
                               utils/         Utility functions
                               middleware.ts  Auth middleware for /api/*

workers/
  api/                    Cloudflare Worker: edge proxy + aggregator
                             src/
                               index.ts       Env interface, rate limiter, GTS config
                               app.ts         Hono router, middleware, route registration
                               serve.ts       Node.js fallback for local dev
                               session.ts     HMAC-SHA256 session management
                               cors.ts        Origin validation
                               api-key.ts     Scoped API key management
                               premium.ts     Premium subscription gating
                               error-logger.ts KV-backed error tracking
                               kv-key-patterns.ts  Centralized KV key formats
                               kv-helpers.ts      KV operation helpers
                               response-helpers.ts Standardized response builders
                               sanitize.ts    Input sanitization
                               ws-broadcast.ts WebSocket broadcast utilities
                               ws-channels.ts WebSocket channel management
                               feed/          59 files — feed pipeline layers
                               routes/        231 route handler files + 12 subdirectories
                               lib/           143 shared library modules
                               __tests__/     45+ test files

bridge/                   Cross-protocol bridge service
                             src/
                               server.ts      Hono server entry point
                               crossposter.ts Cross-protocol posting
                               rate-limiter.ts Rate limiting
                               search-indexer.ts Search indexing
                               providers/     Bridge provider implementations
                               lib/           Shared bridge utilities
                               server/        Server configuration

packages/                 41 shared packages
  types/                  Unified protocol types (92-protocol union)
  feed-core/              Feed normalization, dedup, scoring, quality
  ranking/                Transparent feed scoring algorithms
  ui/                     104+ React components (PostCard, TokenChart, etc.)
  identity/               Cross-protocol identity resolution
  auth/                   Wallet sign-in, session management, identity hub
  storage/                Client and edge storage helpers
  web3/                   Web3 utilities
  utils/                  Cross-cutting utilities
  crypto/                 Encryption, E2E messaging
  realtime/               WebSocket real-time infrastructure
  reputation/             Reputation scoring
  source-discovery/       Source discovery engine
  token-gate/             Token gating
  monetization/           Monetization services
  creator-coin/           Creator coin smart contracts
  feed-providers/         Feed provider implementations
  cross-protocol-bridge/  Cross-protocol bridging logic
  crossplatform-register/ Multi-platform registration
  solana-programs/        Solana Anchor programs

  Protocol SDKs:
    nostr-sdk/            Nostr protocol adapter
    farcaster-sdk/        Farcaster protocol adapter
    lens-sdk/             Lens protocol adapter
    bluesky-sdk/          Bluesky/AT Protocol adapter
    mastodon-sdk/         Mastodon/ActivityPub adapter
    threads-sdk/          Threads protocol adapter
    rss-sdk/              RSS/Atom feed adapter
    peertube-sdk/         PeerTube API adapter
    peertube-provider/    PeerTube federated provider
    telegram-sdk/         Telegram Bot API client
    discord-sdk/          Discord Bot API & webhook client
    matrix-sdk/           Matrix homeserver client
    github-sdk/           GitHub API client
    lemmy-sdk/            Lemmy protocol adapter
    pixelfed-sdk/         Pixelfed protocol adapter
    youtube-provider/     YouTube data provider
    zora-sdk/             Zora creator coin SDK
    shorts-provider/      Short-form video provider
    livepeer-provider/    Livepeer video provider
    ghost-bridge/         Ghost CMS bridge
    mirror-bridge/        Mirror.xyz bridge
    paragraph-bridge/     Paragraph bridge
    spaces-audio/         Audio Spaces
    spaces-bridge/        Spaces protocol bridge

infra/                    Infrastructure configs
  cloudflare/             wrangler configs, Pages project, KV setup
  monitoring/             GlitchTip, Grafana, Prometheus, Node Exporter
  deploy-templates/       Docker compose templates

mobile/                   Capacitor mobile shell (iOS + Android)
docs/                     VitePress documentation site
scripts/                  Deploy, rollback, migration scripts
design/                   Design system (Style Dictionary tokens)
```

---

## Package Dependency Map

```
apps/web ───────────────────────────────────────────────────────────────┐
  │                                                                      │
  ├── @degenfeed/types (protocol types, shared interfaces)               │
  ├── @degenfeed/ui (React components)                                   │
  ├── @degenfeed/auth (wallet sign-in, sessions)                         │
  ├── @degenfeed/storage (KV storage client)                             │
  └── @degenfeed/utils (shared utilities)                                │
                                                                          │
workers/api ─────────────────────────────────────────────────────────────┤
  │                                                                      │
  ├── @degenfeed/types (protocol types)                                  │
  ├── @degenfeed/feed-core (feed pipeline, algorithm)                    │
  ├── @degenfeed/ranking (scoring)                                       │
  ├── @degenfeed/identity (identity resolution)                          │
  ├── @degenfeed/reputation (reputation scoring)                         │
  ├── @degenfeed/source-discovery (source discovery)                     │
  ├── @degenfeed/cross-protocol-bridge                                   │
  └── @degenfeed/web3 (Web3 utilities)                                   │
                                                                          │
bridge ──────────────────────────────────────────────────────────────────┤
  │                                                                      │
  ├── @degenfeed/types                                                   │
  ├── @degenfeed/feed-core                                               │
  ├── @degenfeed/identity                                                │
  ├── nostr-sdk, farcaster-sdk, mastodon-sdk, etc. (protocol SDKs)      │
  └── @degenfeed/utils                                                   │
                                                                          │
packages (internal only) ────────────────────────────────────────────────┘
  @degenfeed/types ← foundation layer (no internal deps)
  @degenfeed/utils ← depends on types
  @degenfeed/web3 ← depends on types
  @degenfeed/identity ← depends on types, utils
  @degenfeed/feed-core ← depends on types, identity
  @degenfeed/ranking ← depends on types, feed-core
  @degenfeed/auth ← depends on types, storage
  @degenfeed/ui ← depends on types, auth
  Protocol SDKs → depend on types, utils
```

---

## Data Flow Diagrams

### Feed Aggregation Flow

```
User opens app.degenfeed.xyz/feed
        │
        ▼
Next.js /feed page → fetches /api/feed/unified via services/feed.ts
        │
        ▼
Worker: routes/feed-unified.ts
        │
        ├── Check CACHE KV (feed:unified:{wallet})
        │   ├── HIT → return cached feed
        │   └── MISS → continue
        │
        ├── Fetch from each enabled protocol in parallel:
        │   ├── Nostr          (nos.lol, damus.io)
        │   ├── Farcaster      (Hub gRPC)
        │   ├── Bluesky        (public.api.bsky.app)
        │   ├── Mastodon/GtS   (social.degenfeed.xyz)
        │   ├── Threads        (public.threads.net)
        │   ├── PeerTube       (video.degenfeed.xyz)
        │   ├── Lens           (api-v2.lens.dev)
        │   ├── Reddit         (redlib.degenfeed.xyz)
        │   ├── YouTube        (yt data API)
        │   └── RSS            (rss-bridge.degenfeed.xyz)
        │
        ├── Normalize + deduplicate (feed-core: algorithm.ts, cross-protocol.ts)
        ├── Score + rank (ranking: scorer.ts, unified-scorer.ts)
        ├── Curate (seen posts, muted authors, quality filter)
        ├── Cache result in CACHE KV (feed-cache.ts)
        └── Return JSON response (response-helpers: ok())
                │
                ▼
Next.js renders feed timeline (components/feed/)
```

### Authentication Flow

```
User clicks "Sign in with Wallet"
        │
        ▼
Next.js: middleware.ts → checks session cookie
        │
        ├── Valid session → proceed to page
        └── No session → redirect to /auth
                │
                ▼
/auth page: SignInModal.tsx
        │
        ├── Wallet sign-in: EIP-4361 / Solana message
        ├── Verify signature (workers/api: auth.ts)
        ├── Create session (HMAC-SHA256 cookie + CSRF token)
        ├── Resolve identity (identity-hub.ts)
        └── Store in IDENTITIES KV
                │
                ▼
User authenticated → feed, profile, tips available
```

### Creator Coin Flow

```
Creator clicks "Launch Coin"
        │
        ▼
POST /api/farcaster/coin/deploy (session required)
        │
        ▼
Worker: routes/farcaster-coin.ts
        │
        ├── Validate session, FID, identity (admin-guard.ts)
        ├── Check reputation threshold (coin-reputation.ts)
        ├── Deploy DegenFeedCoin via Factory (Base chain)
        │   └── forge create via cast/viem
        ├── Store record in FARCASTER_COINS KV (kv-helpers.ts)
        ├── Register in XCHAIN_REGISTRY KV
        ├── Announce on Farcaster (frame)
        └── Return coin address + metadata
                │
                ▼
Creator coin appears in profile, tippable by fans
```

### Cross-Chain Tipping Flow

```
User sends tip to creator on different chain
        │
        ▼
POST /api/tip/cross-chain (response-helpers: ok/errorResponse)
        │
        ▼
Worker: routes/unified-tip-crosschain.ts
        │
        ├── Source chain: deduct token (EVM / Solana / Lightning)
        ├── Bridge step:
        │   ├── EVM → Solana: Wormhole bridge
        │   ├── Solana → EVM: Wormhole bridge
        │   └── Lightning → EVM: Swap via DEX
        ├── Destination chain: mint/transfer creator coin
        ├── Record in UNIFIED_TIP ledger (CACHE KV)
        ├── Notify creator (cross-protocol)
        └── Return receipt
```

### Livestream Flow

```
Creator starts stream from token community page
        │
        ▼
POST /api/token/:address/peertube/start
        │
        ▼
Worker: routes/peertube-streams.ts
        │
        ├── Authenticate with PeerTube API (OAuth2)
        ├── Create live video on PeerTube
        ├── Store stream metadata in CONTENT_STORE KV
        ├── Generate RTMP key for OBS
        ├── Broadcast to viewers:
        │   ├── WebSocket (realtime/)
        │   ├── ActivityPub (GoToSocial)
        │   ├── Nostr (kind 30311)
        │   ├── AT Protocol (Bluesky)
        │   ├── Farcaster (frame)
        │   └── Telegram (bot notification)
        └── Return stream URL + RTMP key
                │
                ▼
Viewers watch via LiveStreamPlayer component
Chat via Prosody XMPP bridge
```

### News Pipeline Flow

```
Cron trigger (every 30 min)
        │
        ▼
Worker: feed/news-aggregator.ts — thin orchestrator
        │
        ├── Fetchers: feed/news-fetcher.ts
        │   ├── Tier 1 (primary RSS feeds) → news-source-tier-1.ts
        │   ├── Tier 2 (secondary feeds)  → news-source-tier-2.ts
        │   ├── Tier 3 (blog feeds)       → news-source-tier-3.ts
        │   └── Tier 4 (newsletter feeds) → news-source-tier-4.ts
        │
        ├── Processing: feed/news-processor.ts
        │   ├── Parse → normalize → classify
        │   └── Category assignment (defi, security, research, etc.)
        │
        ├── Dedup: feed/content-dedup.ts
        │   └── Cross-source URL and content similarity dedup
        │
        ├── Score: feed/news-helpers.ts + ranking/scorer.ts
        │   ├── Freshness weighting
        │   ├── Source authority scoring
        │   └── Content quality filtering
        │
        ├── Cache: feed/news-cache.ts
        │   └── Store in CACHE KV with per-category indices
        │
        └── Serve via routes/news.ts → response-helpers: ok()
```

---

## Recent Architectural Improvements

### 1. Hono Router Migration (2026-07)

The Worker API was migrated from raw `fetch` event handlers to **Hono** for structured routing, middleware, and error handling. All route registration is delegated to `routes/register/` sub-modules:

```typescript
// app.ts — thin orchestrator
const app = new Hono<{ Bindings: Env }>();

import { registerCoreRoutes } from './routes/register/core';
import { registerFeedRoutes } from './routes/register/feed';
import { registerSocialRoutes } from './routes/register/social';
// ...8 register modules total

registerCoreRoutes(app);
registerFeedRoutes(app);
registerSocialRoutes(app);
// ...

export default app;
```

### 2. God File Elimination

Refactored 5 major god files (>1000 lines each) into structured directories:
- `workers/api/src/feed/news-aggregator.ts` (was >1000 lines → ~300)
- `workers/api/src/feed/live-aggregator.ts` (was >1500 lines → split into 6 files)
- `bridge/src/providers/rss.ts` (was >1800 lines → 11 files)
- `routes/register/social.ts` (was >1900 lines → 8 register modules)
- `packages/feed-core/src/index.ts` (was >1400 lines → 12 files)

See [CODE-STRUCTURE.md](./CODE-STRUCTURE.md#1-god-files-eliminated) for full details.

### 3. Response Helpers Standardization

16+ ad-hoc rate limit response patterns consolidated into `response-helpers.ts`. All new route handlers must use these helpers.

### 4. KV Key Pattern Centralization

Scattered KV key format strings centralized into `kv-key-patterns.ts` and `kv-helpers.ts` for consistency and maintainability.

### 5. Module Structure Enforcement

500-line maximum file size enforced. New features follow the `feature-name/{index.ts, types.ts, constants.ts, utils.ts, core.ts, handlers.ts}` pattern. See [MODULE-STRUCTURE.md](./MODULE-STRUCTURE.md).

### 6. Component Consolidation

PostCard component consolidated from 3 separate implementations into `packages/ui/src/post-card/` with 8 sub-modules and shared type interfaces.

---

## Identity System

```
wallet (0x...) ───── identity-hub ─────┬── nostr pubkey (npub...)
                                        ├── farcaster fid (12345)
                                        ├── bluesky did (did:plc:...)
                                        ├── mastodon account (@user@social.degenfeed.xyz)
                                        ├── lens profile (lens/12345)
                                        ├── threads id
                                        ├── telegram id
                                        └── reddit username (u/user)

ID resolution flows:
  wallet → all protocols    (identity-hub)
  did → wallet              (DID resolution)
  npub → wallet             (Nostr profile metadata)
  fid → wallet              (Farcaster verified address)
```

---

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

---

## Cron Schedule

| Cron | Handler | Purpose |
|------|---------|---------|
| `* * * * *` | `scheduled-executor.ts` | Execute scheduled posts |
| `*/30 * * * *` | `trending-scraper.ts` | Scrape trending content |
| `0 */6 * * *` | `news-aggregator.ts` | News pipeline refresh |
| `0 14 * * *` | `handleCron()` | Daily digest + trending refresh |
| `0 12 * * 0` | `source-discovery.ts`, `source-health.ts` | Weekly source discovery + health |

---

## Protocol Integration Map

| Protocol | SDK Package | Worker Routes | Feed | Post | Tip | Coin | Stream | Bridge |
|----------|-------------|---------------|------|------|-----|------|--------|--------|
| Nostr | `nostr-sdk` | `routes/feed.ts`, `routes/post.ts`, `routes/tip.ts` | ✅ | ✅ | ✅ | — | — | — |
| Farcaster | `farcaster-sdk` | `routes/farcaster-feed.ts`, `routes/farcaster-coin.ts` | ✅ | ✅ | ✅ | ✅ | — | — |
| Bluesky | `bluesky-sdk` | `routes/feed.ts`, `routes/post.ts`, `routes/bluesky-tip.ts` | ✅ | ✅ | ✅ | — | — | — |
| Mastodon | `mastodon-sdk` | `routes/feed.ts`, `routes/mastodon-tip.ts` | ✅ | ✅ | ✅ | — | — | — |
| Threads | `threads-sdk` | `routes/feed.ts`, `routes/post.ts` | ✅ | ✅ | — | — | — | — |
| Twitter/X | in-worker | `routes/feed.ts` | ✅ | — | — | — | — | — |
| Reddit | in-worker | `routes/feed.ts` | ✅ | — | — | — | — | — |
| RSS/Atom | `rss-sdk` | `routes/rss.ts`, `routes/news.ts` | ✅ | — | — | — | — | — |
| PeerTube | `peertube-provider` | `routes/peertube-streams.ts`, `routes/peertube-tip.ts` | ✅ | ✅ | ✅ | — | ✅ | — |
| Lemmy | `lemmy-sdk` | `routes/lemmy-discover.ts`, `routes/lemmy-tip.ts` | ✅ | — | ✅ | — | — | — |
| YouTube | `youtube-provider` | `routes/feed.ts` | ✅ | — | — | — | — | — |
| Lens | `lens-sdk` | `routes/lens.ts`, `routes/lens-coin.ts` | ✅ | — | ✅ | ✅ | — | — |
| Discord | `discord-sdk` | `routes/discord.ts` | ✅ | ✅ | — | — | — | ✅ |
| Matrix | `matrix-sdk` | `routes/matrix.ts` | ✅ | ✅ | — | — | — | ✅ |
| Telegram | `telegram-sdk` | `routes/telegram.ts` | ✅ | ✅ | — | — | — | ✅ |
| Webhooks | in-worker | `routes/webhooks.ts` | ✅ | — | — | — | — | ✅ |
| Email News | in-worker | `routes/newsletter.ts`, `routes/newsletter-send.ts` | ✅ | — | — | — | — | ✅ |
| GitHub | `github-sdk` | `routes/github-connect.ts` | ✅ | ✅ | — | — | — | ✅ |
| Substack/Ghost | `ghost-bridge` | `routes/newsletter-bridge.ts` | ✅ | ✅ | — | — | — | ✅ |
| Mirror | `mirror-bridge` | `routes/mirror.ts` | ✅ | — | — | — | — | ✅ |
| Paragraph | `paragraph-bridge` | `routes/paragraph.ts` | ✅ | — | — | — | — | ✅ |
| Zora | `zora-sdk` | `routes/zora-compat.ts`, `routes/zora-video.ts` | ✅ | — | — | — | — | ✅ |
| Pixelfed | `pixelfed-sdk` | `routes/pixelfed.ts` | ✅ | — | — | — | — | ✅ |

---

## Tooling

- **Build orchestration:** Turborepo + pnpm workspaces
- **Lint / format:** Biome (no ESLint, no Prettier)
- **Type checking:** TypeScript `--noEmit` with `strict: true`
- **Tests:** Vitest (unit), Playwright (E2E)
- **Smart Contracts:** Foundry (Solidity), Anchor (Rust/Solana)
- **CI:** Forgejo Actions (`.forgejo/workflows/ci.yml`)
- **Pre-commit:** Lefthook (biome, tsc)
- **Docker:** Multi-service Compose for full stack
- **Local entry point:** `Makefile`
- **Edge deployment:** Wrangler (Cloudflare Workers + Pages)
