# DegenFeed Web

[![CI](https://github.com/RugMunchMedia/degenfeed-web/actions/workflows/ci.yml/badge.svg)](https://github.com/RugMunchMedia/degenfeed-web/actions/workflows/ci.yml)
[![Deploy](https://github.com/RugMunchMedia/degenfeed-web/actions/workflows/deploy.yml/badge.svg)](https://github.com/RugMunchMedia/degenfeed-web/actions/workflows/deploy.yml)
[![Playwright E2E](https://img.shields.io/badge/E2E-Playwright-45ba4b?logo=playwright)](https://playwright.dev)
[![Biome](https://img.shields.io/badge/linted%20with-Biome-60a5fa?logo=biome)](https://biomejs.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript)](https://www.typescriptlang.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://nextjs.org)
[![Cloudflare](https://img.shields.io/badge/deployed%20on-Cloudflare-F38020?logo=cloudflare)](https://cloudflare.com)

**Status:** 🟢 Live at [app.degenfeed.xyz](https://app.degenfeed.xyz)
**Docs:** [docs.degenfeed.xyz](https://docs.degenfeed.xyz)
**Repo:** `git.rugmunch.io/RugMunchMedia/degenfeed-web`

---

## What is DegenFeed?

A multi-protocol social aggregator that unifies 15+ decentralized and federated social networks into a single timeline with cross-platform posting, creator coins, livestreaming, audio spaces, and cross-chain tipping.

Built with **Next.js 16** (App Router), **Hono** on Cloudflare Workers, and deployed at [app.degenfeed.xyz](https://app.degenfeed.xyz).

### Why DegenFeed?

- **One feed to rule them all** — Nostr, Farcaster, Bluesky, Lens, Mastodon, Threads, YouTube, RSS, Reddit, and more in a single ranked timeline
- **Creator-first economy** — Launch your own ERC-20 / SPL creator coin, earn tips across 4 chains, monetize streams
- **Cross-platform posting** — Write once, publish to Nostr + Farcaster + Bluesky + Mastodon + Lens simultaneously
- **Audio Spaces** — Host live, multi-participant audio conversations with protocol bridging
- **Livestreaming** — Go live via PeerTube with cross-protocol announcements and real-time chat
- **Visual Feed** — Rich media grid of images and video from all protocols
- **Short Form Video** — TikTok-style short video feed aggregated from federated sources
- **Open protocol, open data** — No lock-in. Your identity, your content, your audience.

### Integrated Protocols (21+)

| Protocol | Feed | Post | Tip | Creator Coin | Livestream | Spaces | Bridge |
|----------|------|------|-----|-------------|------------|--------|--------|
| Nostr | ✅ | ✅ | ✅ (Lightning) | — | — | ✅ | — |
| Farcaster / Warpcast | ✅ | ✅ | ✅ | ✅ (Base) | — | ✅ | — |
| Bluesky (AT Protocol) | ✅ | ✅ | ✅ | — | — | ✅ | — |
| Mastodon / GoToSocial | ✅ | ✅ | ✅ | — | ✅ | ✅ | — |
| Threads (Instagram) | ✅ | ✅ | — | — | — | — | — |
| Twitter / X | ✅ | — | — | — | — | — | — |
| Reddit | ✅ | — | — | — | — | — | — |
| RSS / Atom | ✅ (353+ sources) | — | — | — | — | — | — |
| **PeerTube** | ✅ | ✅ | ✅ | — | ✅ | — | — |
| **Lemmy** | ✅ | — | ✅ | — | — | — | — |
| **YouTube** | ✅ | — | — | — | — | — | — |
| **Lens Protocol** | ✅ | — | ✅ | ✅ (Polygon) | — | ✅ | — |
| Telegram | ✅ | ✅ | — | — | — | — | — |
| Zora | — | — | ✅ | ✅ (Wrap) | — | — | — |
| Solana | — | — | ✅ | ✅ (SPL) | — | — | — |
| **Discord** | ✅ | ✅ | — | — | — | — | ✅ |
| **Matrix** | ✅ | ✅ | — | — | — | — | ✅ |
| **Webhooks** | ✅ | ✅ | — | — | — | — | ✅ |
| **Email Newsletter** | ✅ | — | — | — | — | — | ✅ |
| **GitHub** | ✅ | ✅ | — | — | — | — | ✅ |
| **Substack / Ghost** | ✅ | ✅ | — | — | — | — | ✅ |

---

## Features

### 🗞️ Unified Feed
- Ranked, aggregated feed from every connected protocol
- Per-protocol filters (Nostr, Farcaster, Lens, Bluesky, Mastodon, Reddit, RSS, YouTube)
- Trending, News, For You, Following tabs
- Category filtering (DeFi, AI, Bitcoin, Ethereum, Solana, Security, Macro)
- Smart ranking with engagement scoring and curation
- Real-time updates via Server-Sent Events
- 353+ curated RSS news sources

### ✍️ Cross-Platform Composer
- Write once, publish to Nostr + Farcaster + Bluesky + Mastodon + Lens + Threads
- Free tier: 3 protocols per post
- Premium tier: unlimited protocols
- Image and media attachments
- Scheduled posting

### 🪙 Creator Coin System
- Deploy ERC-20 tokens on **Base** (via DegenFeedFactory) and **Solana** (via Anchor program)
- Also deploy on **Lens** (Polygon native) and wrap to **Zora**
- Sigmoid bonding curve with 5 eras: Steal Deal → Early Bird → Ramp Up → Fair Launch → Moonshot
- 4 vesting presets: Trustless (0% unlock, 30d cliff, 90d), Balanced (5%, 7d, 60d), Community (10%, 0d, 30d), Fast (20%, 0d, 7d)
- Reputation-gated vesting unlocks
- 3-phase anti-exploit (2%/5%/10% limits, bundle detection, cooldowns)
- Cross-chain registry for bidirectional lookups
- Unified profile — all creator tokens in one view
- Gamified trading with badges, milestones, referral boosts, and flash sales
- Auto-announce on Farcaster via frames

### 💸 Cross-Platform Tipping
- **Lightning Network** — Instant Bitcoin micropayments (Nostr zaps)
- **EVM chains** — Base, Optimism, Arbitrum via DegenFeedTips contract
- **Solana** — Native SOL and SPL tokens
- **Collect to Tip** — Lens collects with revenue share
- **Cross-Chain bridging** — Wormhole bridge for SOL ↔ ETH routing
- **Creator Coins** — Tip via creator coin per FID or profile ID
- **Split tips** — 90/10 split with community treasuries
- **Batch tipping** — Tip up to 50 recipients in one transaction
- **Unified ledger** — Cross-platform tip history with leaderboards

### 🎙️ Audio Spaces
- Host live audio conversations with up to 50 participants
- Speaker stage with listener mode and hand-raising
- Cross-protocol broadcasting — join via Nostr, Farcaster, Bluesky, Lens, Mastodon
- Real-time reactions (hearts, emojis, claps)
- Recording with automatic transcription
- Scheduled spaces with reminders
- Co-host and moderator controls

### 📺 Livestreaming
- Powered by self-hosted **PeerTube** at video.degenfeed.xyz
- Stream types: Solo, Collab, Coin Launch Events, Spaces
- OBS-compatible RTMP keys
- Real-time chat via **Prosody XMPP** bridge
- Cross-protocol announcements — ActivityPub, Nostr kind 30311, AT Protocol, Farcaster frames, Telegram
- Featured streams carousel
- Category browsing (Tech, Talk, Crypto, Gaming, Music)

### 📊 Visual Feed
- Rich media grid showing images and video from all protocols
- Auto-detection and extraction of inline media
- Lightbox viewer

### 📱 Short-Form Video
- TikTok-style vertical video feed
- Aggregated from PeerTube federated instances
- Infinite scroll with keyboard navigation

### 👥 Feddy Communities
- Create and join cross-protocol communities
- Community feeds, member lists, and moderation
- Protocol-agnostic community membership
- Feddy community creation page with discoverability

### 🔍 Cross-Protocol Identity
- Link identities across Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, and more
- Wallet-based identity hub
- Unified profile page
- **Identity Hub** — wallet → protocol mapping with credential encryption

### 🔎 Search
- Cross-protocol text search powered by MeiliSearch
- Identity search (find users across protocols)
- Category and protocol filters

### 🏆 Reputation & Gamification
- 7-tier reputation system: Newcomer → Contributor → Active → Trusted → Veteran → Elite → Legend
- Earn reputation by posting, receiving likes, tips, follows, and bridging
- Stake reputation on posts to boost visibility
- Tier-based benefits: enhanced discovery, custom feeds, badge display, analytics access
- Daily caps to prevent gaming

### 🎯 Recommendations
- Personalized "For You" feed based on engagement signals
- Related posts by niche overlap and time proximity
- People to follow suggestions
- Smart refresh algorithm

### 📬 Direct Messages
- Cross-protocol messaging
- Conversation threads
- Push notification support

### 💎 Premium Subscriptions
- Free tier: 3 protocols per cross-post, standard rate limits
- Premium tier: unlimited protocols, higher rate limits, analytics, custom feeds

### 🔧 Admin Panel
- Content moderation and flagging
- User management
- Source/platform management
- Rate limit configuration
- System health monitoring
- Deployment management

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL LAYER                                  │
│  social.degenfeed.xyz  │  pds.degenfeed.xyz  │  video.degenfeed.xyz  │
│  (GoToSocial)          │  (AT Protocol PDS)  │  (PeerTube)           │
│  redlib.degenfeed.xyz  │  rss-bridge.xyz     │  chat.degenfeed.xyz   │
│  (Redlib)              │  (RSS-Bridge)       │  (Prosody XMPP)       │
├─────────────────────────────────────────────────────────────────────┤
│                      EDGE LAYER (Cloudflare)                         │
│  degenfeed.xyz (Worker — landing + API)                              │
│  app.degenfeed.xyz (Pages — Next.js 16)                              │
│  19 KV namespaces for cache, identity, coins, communities, etc.     │
├─────────────────────────────────────────────────────────────────────┤
│                      PACKAGES LAYER (25+)                            │
│  Protocol SDKs   │  Feed Pipeline  │  Identity     │  Auth           │
│  Creator Coins   │  Tip Engine     │  Ranking      │  Web3           │
│  Reputation      │  Storage        │  Realtime     │  UI Components  │
│  Smart Contracts │  Token SDK      │  Video        │  Shorts         │
└─────────────────────────────────────────────────────────────────────┘
```

### Self-Hosted Infrastructure

| Service | URL | Purpose |
|---------|-----|---------|
| **GoToSocial** | social.degenfeed.xyz | ActivityPub / Mastodon-compatible server |
| **AT Protocol PDS** | pds.degenfeed.xyz | Bluesky personal data server |
| **PeerTube** | video.degenfeed.xyz | Video hosting + livestreaming |
| **Redlib** | redlib.degenfeed.xyz | Privacy-respecting Reddit frontend |
| **RSS-Bridge** | rss-bridge.degenfeed.xyz | RSS feed generation for sites without RSS |
| **Prosody XMPP** | chat.degenfeed.xyz | Real-time chat for PeerTube streams |

### KV Namespaces (19)

| Namespace | Purpose |
|-----------|---------|
| `CACHE` | General cache, rate limiter, feed cache, sessions, user prefs |
| `SUBSCRIPTIONS` | Premium subscriptions, newsletter subscribers |
| `IDENTITIES` | Cross-protocol identity links |
| `API_KEYS` | Scoped API key storage |
| `CONTENT_STORE` | Token community content, livestreams, chat |
| `FARCASTER_COINS` | Farcaster creator coin records |
| `LENS_COINS` | Lens Protocol creator coin records |
| `XCHAIN_REGISTRY` | Cross-chain token registration |
| `PLATFORM_ACCOUNTS` | Platform account records for registration |
| `BLUESKY_INVITE_POOL` | Bluesky invite code pool |
| `COMMUNITIES` | Cross-protocol community records |
| `SPACES` | Audio Spaces data |
| `REPUTATION` | Reputation scores and leaderboard |
| `BOOKMARKS` | User bookmark storage |
| `DEPLOYMENTS` | Deployment request tracking |
| `PERMANENCE` | Content permanence proofs |
| `GOVERNANCE` | DAO governance (proposals, votes) |
| `REPORTS` | Reports and moderation state |
| `CUSTOM_FEEDS` | Custom feed configurations |

---

## What's Inside

- **87+ SSR pages** across the Next.js app (feed, profiles, threads, discover, settings, admin, launch, spaces, live, shorts, video, etc.)
- **500+ API routes** (Hono on Cloudflare Workers) serving `/api/*` and `/v1/*`
- **30+ packages** — Protocol SDKs (nostr, farcaster, bluesky, mastodon, threads, lens, rss, peertube, telegram, zora, discord, matrix, github, newsletter-bridge), feed-core, ranking, identity, web3, reputation, storage, realtime, tip-contract (Solidity), identity-hub
- **4 on-chain contracts** — DegenFeedCoin (ERC-20), DegenFeedFactory, CrossChainRegistry (Solidity/Bases), DegenFeedCreatorToken (Anchor/Solana)
- **19 KV namespaces** on Cloudflare Workers

### Monorepo Structure

```
apps/
  web/                     Next.js 16 aggregator client
    src/
      app/                 60+ route groups (feed, profile, discover, etc.)
      components/          16+ component directories
      lib/                 Client-side utilities
      middleware.ts        Auth + rate limiting middleware

workers/
  api/                     Cloudflare Worker: edge API
    src/
      routes/              ~100 route modules
      feed/                Feed pipeline (scorer, curator, freshness)
      lib/                 Shared libraries (bridge engine, community store, etc.)

packages/
  types/                   Unified protocol types
  feed-core/               Feed normalization + deduplication
  ranking/                 Feed scoring algorithms
  ui/                      Shared React components
  identity/                Identity resolution
  identity-hub/            Wallet→protocol mapping
  auth/                    Wallet sign-in + sessions
  web3/                    Web3 utilities
  storage/                 Client + edge storage helpers
  realtime/                WebSocket + SSE real-time sync
  reputation/              Reputation scoring + tiers
  nostr-sdk/               Nostr protocol adapter
  farcaster-sdk/           Farcaster protocol adapter
  lens-sdk/                Lens protocol adapter
  bluesky-sdk/             Bluesky/AT Protocol adapter
  mastodon-sdk/            Mastodon/ActivityPub adapter
  threads-sdk/             Threads protocol adapter
  rss-sdk/                 RSS/Atom feed adapter
  peertube-provider/       PeerTube video + stream adapter
  telegram-sdk/            Telegram Bot API client
  zora-sdk/                Creator token SDK (bonding curve, anti-exploit, vesting)
  shorts-provider/         Short-form video provider
  video/                   Video hub utilities
  tip-contract/            Solidity + Anchor smart contracts
  crossplatform-register/  Multi-protocol account registration
  token-gate/              Token-gated content access
  spaces-audio/            Audio Spaces engine
  solana-programs/         Solana on-chain programs

infra/
  cloudflare/              Wrangler configs, Pages setup
  monitoring/              GlitchTip, Grafana, Prometheus
  deploy-templates/        Docker Compose templates

mobile/                    Capacitor mobile shell (iOS + Android)
docs/                      VitePress documentation site
scripts/                   Deploy, rollback, migration scripts
design/                    Design assets and mockups
```

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy and fill in environment variables
cp apps/web/.env.example apps/web/.env.local

# Start development (frontend + API worker)
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Full Stack (Docker)

For the full stack including GoToSocial, PeerTube, and database:

```bash
docker compose -f docker-compose.yml up -d
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment.

---

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Monorepo structure, protocol integration map, data flows |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | Complete v1 API reference |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | End-user step-by-step guide |
| [docs/CREATOR_GUIDE.md](docs/CREATOR_GUIDE.md) | Creator monetization and growth guide |
| [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) | How to add protocols and features |
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) | Per-protocol integration details |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Cloudflare deployment guide |
| [PRODUCT.md](PRODUCT.md) | Product charter and goals |
| [ROADMAP.md](ROADMAP.md) | Next 90 days |
| [CHANGELOG.md](CHANGELOG.md) | Release history |
| [CLOUDFLARE.md](CLOUDFLARE.md) | Cloudflare-specific configuration |
| [TESTING.md](TESTING.md) | Testing strategy and guidelines |

### Docs Site

Full documentation site at **[docs.degenfeed.xyz](https://docs.degenfeed.xyz)** — built with VitePress.

---

## Smart Contracts

| Contract | Chain | Language | Address |
|----------|-------|----------|---------|
| `DegenFeedCoin.sol` | Base | Solidity | Factory-deployed per creator |
| `DegenFeedFactory.sol` | Base | Solidity | Factory |
| `CrossChainRegistry.sol` | Base | Solidity | On-chain protocol→chain→token mapping |
| `DegenFeedTips.sol` | Base / Optimism / Arbitrum | Solidity | 0% fee tipping contract |
| `degenfeed-creator-token` | Solana | Anchor Rust | SPL token program |

---

## Standards

This repo follows [Rug Munch Media standards](https://git.rugmunch.io/RugMunchMedia/standards).
