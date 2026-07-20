# DegenFeed Web — Architecture

**Status:** canonical  
**Last updated:** 2026-07-20

## Overview

Turborepo monorepo with a Cloudflare Pages-hosted Next.js 16 client and a Cloudflare Worker edge API. Shared packages provide protocol adapters, feed normalization, identity resolution, creator coins, livestreaming, and wallet auth. Self-hosted infrastructure (GoToSocial, AT Protocol PDS, PeerTube) runs on Talos.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL LAYER                                  │
│  social.degenfeed.xyz  │  pds.degenfeed.xyz  │  video.degenfeed.xyz  │
│  (GoToSocial)          │  (AT Protocol PDS)  │  (PeerTube)           │
│  ────────────────      │  ────────────────   │  ────────────────     │
│  redlib.degenfeed.xyz  │  rss-bridge.xyz     │  chat.degenfeed.xyz   │
│  (Redlib)              │  (RSS-Bridge)       │  (Prosody XMPP)       │
├─────────────────────────────────────────────────────────────────────┤
│                      EDGE LAYER (Cloudflare)                         │
│  degenfeed.xyz (Worker — landing + API)                              │
│  app.degenfeed.xyz (Pages — Next.js 16)                              │
│  KV: CACHE, SUBSCRIPTIONS, IDENTITIES, CONTENT_STORE, FARCASTER_COINS│
│      LENS_COINS, XCHAIN_REGISTRY, PLATFORM_ACCOUNTS, ... (19 total)  │
├─────────────────────────────────────────────────────────────────────┤
│                      PACKAGES LAYER                                   │
│  Protocol SDKs   │  Feed Pipeline  │  Identity  │  Auth  │  Web3     │
│  Creator Coins   │  Tip Engine     │  Ranking   │  UI    │  Storage  │
└─────────────────────────────────────────────────────────────────────┘
```

## Monorepo Structure

```
apps/
  web/                    Next.js 16 aggregator client at app.degenfeed.xyz
                            src/
                              app/           App Router pages (feed, profile, discover, etc.)
                              components/    Shared UI components
                              lib/           Client-side utilities
                              middleware.ts  Auth middleware for /api/*

workers/
  api/                    Cloudflare Worker: edge proxy + aggregator (degenfeed-api)
                            src/
                              index.ts       Env interface, rate limiter, GTS config, cron handler
                              app.ts         Hono router, middleware, CORS
                              serve.ts       Node.js fallback for local dev
                              session.ts     HMAC-SHA256 session management, CSRF tokens
                              cors.ts        Origin validation
                              api-key.ts     Scoped API key management
                              premium.ts     Premium subscription gating
                              error-logger.ts KV-backed error tracking
                              lib/           Shared libs (community-store, crypto-seal, admin-guard)
                              feed/          Feed pipeline (cache, scorer, curator, freshness, feedback)
                              routes/        ~100 route modules (see Protocol Integration Map below)
                              __tests__/     Vitest test suite

packages/
  types/                  Unified protocol types and interfaces (Protocol union extended)
  feed-core/              Feed normalization, deduplication, and assembly
  ranking/                Transparent feed scoring algorithms
  ui/                     Shared React components (Card, Shell, PostCard, etc.)
  identity/               Cross-protocol identity resolution
  identity-hub/           Wallet→protocol mapping, auto-creation stubs, credential encryption
  auth/                   Wallet sign-in and session management
  storage/                Client and edge storage helpers
  web3/                   Web3 utilities
  nostr-sdk/              Nostr protocol adapter
  farcaster-sdk/          Farcaster protocol adapter
  lens-sdk/               Lens protocol adapter
  bluesky-sdk/            Bluesky/AT Protocol adapter (includes PdsClient)
  mastodon-sdk/           Mastodon/ActivityPub adapter
  threads-sdk/            Threads protocol adapter
  rss-sdk/                RSS/Atom feed adapter
  peertube-provider/      PeerTube video API adapter + federated instance discovery
  telegram-sdk/           Telegram Bot API client (Workers-compatible, fetch()-only)
  zora-sdk/               Zora creator coin SDK (sigmoid bonding curve, anti-exploit)
  shorts-provider/        Short-form video provider (integrates PeerTube federated)
  utils/                  Cross-protocol identity utils, video detection, Sentry wrapper
  tip-contract/           Solidity + Anchor (Solana) smart contracts for creator coins
  reputation/             Reputation scoring and leaderboard

infra/
  cloudflare/             wrangler configs, Pages project, KV setup
  monitoring/             GlitchTip, Grafana, Prometheus, Node Exporter
  deploy-templates/       Docker compose templates (peertube, pds, etc.)

mobile/                   Capacitor mobile shell (iOS + Android)

docs/                     VitePress documentation site

scripts/                  Deploy, rollback, migration scripts
```

## Protocol Integration Map

Each protocol has a corresponding SDK package and worker route handler(s).

| Protocol | SDK Package | Worker Routes | Feed | Post | Tip | Coin | Stream |
|----------|-------------|---------------|------|------|-----|------|--------|
| Nostr | `nostr-sdk` | `routes/feed.ts`, `routes/post.ts`, `routes/tip.ts` | ✅ | ✅ | ✅ | — | — |
| Farcaster | `farcaster-sdk` | `routes/farcaster-feed.ts`, `routes/farcaster-coin.ts` | ✅ | ✅ | ✅ | ✅ | — |
| Bluesky | `bluesky-sdk` | `routes/feed.ts`, `routes/post.ts`, `routes/bluesky-tip.ts` | ✅ | ✅ | ✅ | — | — |
| Mastodon | `mastodon-sdk` | `routes/feed.ts`, `routes/mastodon-tip.ts` | ✅ | ✅ | ✅ | — | — |
| Threads | `threads-sdk` | `routes/feed.ts`, `routes/post.ts` | ✅ | ✅ | — | — | — |
| Twitter/X | `workers/api/src/...` | `routes/feed.ts` | ✅ | — | — | — | — |
| Reddit | `workers/api/src/...` | `routes/feed.ts` | ✅ | — | — | — | — |
| RSS/Atom | `rss-sdk` | `routes/rss.ts`, `routes/news.ts` | ✅ | — | — | — | — |
| PeerTube | `peertube-provider` | `routes/peertube-streams.ts`, `routes/peertube-tip.ts` | ✅ | ✅ | ✅ | — | ✅ |
| Lemmy | `workers/api/src/...` | `routes/lemmy-discover.ts`, `routes/lemmy-tip.ts` | ✅ | — | ✅ | — | — |
| YouTube | `workers/api/src/...` | `routes/feed.ts` | ✅ | — | — | — | — |
| Lens | `lens-sdk` | `routes/lens.ts`, `routes/lens-coin.ts` | ✅ | — | ✅ | ✅ | — |

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
        │   ├── Nostr (nos.lol, damus.io, ...)
        │   ├── Farcaster (Hub gRPC)
        │   ├── Bluesky (public.api.bsky.app)
        │   ├── Mastodon/GoToSocial (social.degenfeed.xyz)
        │   ├── Threads (public.threads.net)
        │   ├── PeerTube (video.degenfeed.xyz)
        │   ├── Lens (api-v2.lens.dev)
        │   └── RSS (rss-bridge.degenfeed.xyz)
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

### Creator Coin Flow (Farcaster)

```
Creator clicks "Launch Coin"
        │
        ▼
POST /api/farcaster/coin/deploy (session required)
        │
        ▼
Worker: routes/farcaster-coin.ts
        │
        ├── Validate session, FID, identity
        ├── Deploy DegenFeedCoin via Factory (Base chain)
        │   └── forge create via cast/viem
        ├── Auto-wrap for Zora visibility
        ├── Store record in FARCASTER_COINS KV
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
POST /api/tip/cross-chain
        │
        ▼
Worker: routes/tip.ts + unified-tip.ts
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

### Livestream Flow (PeerTube)

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
        │   ├── WebSocket (real-time)
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
