# DegenFeed — The Web3 Social Universe

[![CI](https://github.com/RugMunchMedia/degenfeed-web/actions/workflows/ci.yml/badge.svg)](https://github.com/RugMunchMedia/degenfeed-web/actions/workflows/ci.yml)
[![Deploy](https://github.com/RugMunchMedia/degenfeed-web/actions/workflows/deploy.yml/badge.svg)](https://github.com/RugMunchMedia/degenfeed-web/actions/workflows/deploy.yml)
[![Playwright E2E](https://img.shields.io/badge/E2E-Playwright-45ba4b?logo=playwright)](https://playwright.dev)
[![Biome](https://img.shields.io/badge/linted%20with-Biome-60a5fa?logo=biome)](https://biomejs.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript)](https://www.typescriptlang.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://nextjs.org)
[![Cloudflare](https://img.shields.io/badge/edge-Cloudflare-F38020?logo=cloudflare)](https://cloudflare.com)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)

**🌐 Live at [app.degenfeed.xyz](https://app.degenfeed.xyz) — no account required to browse**  
**📖 Docs: [docs.degenfeed.xyz](https://docs.degenfeed.xyz)**  
**🏠 Self-host: `docker compose up -d`**

> *"DegenFeed exists to unify the fragmented decentralized social web. We don't own your content — we give you the tools to own it yourself."*

---

## What is DegenFeed?

**DegenFeed** is the Web3 Social Universe — an open-source, multi-protocol aggregator that unifies **25+ decentralized social protocols** into one app. Nostr, Farcaster, Lens, Bluesky, Mastodon, Reddit, RSS, YouTube, PeerTube, Telegram, Discord, and more — all in a single ranked feed. Cross-post to every protocol simultaneously. Launch your own creator coin on Base or Solana. Tip creators in ETH, SOL, USDC, or Lightning with zero platform fees. Livestream to 7 platforms at once.

| You can | Without |
|---------|---------|
| Browse Nostr, Farcaster, Bluesky, Lens, Mastodon in one feed | Creating an account |
| Cross-post to 15+ protocols simultaneously | Copy-pasting |
| Launch your own ERC-20 / SPL token | Coding or paying audit fees |
| Tip creators in ETH, SOL, USDC, or Lightning | Platform fees |
| Stream live to 7 platforms at once | Multiple streaming setups |
| Self-host the entire stack | Losing your data or identity |

> **Post once. Reach everywhere. Earn from anywhere. No one can deplatform you.**

---

## Features

### 🗞️ Unified Feed
- Ranked, aggregated timeline from every connected protocol
- Per-protocol filters (Nostr, Farcaster, Lens, Bluesky, Mastodon, Reddit, RSS, YouTube)
- Trending, News, For You, Following tabs with smart ranking
- Real-time updates via Server-Sent Events
- 353+ curated RSS news sources with category filtering (DeFi, AI, Bitcoin, Ethereum, Security, Macro)

### ✍️ Cross-Platform Composer
- Write once, publish to Nostr + Farcaster + Bluesky + Mastodon + Lens + Threads simultaneously
- Free tier: 3 protocols per post | Premium: unlimited
- Image/video attachments, rich media, and poll support
- Scheduled posting with timezone-aware composer

### 🪙 Creator Coin System
- Deploy ERC-20 tokens on **Base** and SPL tokens on **Solana** in one click
- Sigmoid bonding curve with 5 eras: Steal Deal → Early Bird → Ramp Up → Fair Launch → Moonshot
- 4 vesting presets with reputation-gated unlocks
- 3-phase anti-exploit: per-wallet caps (2%/5%/10%), bundle detection, cooldowns
- Cross-chain registry for bidirectional token lookups
- Auto-announce on Farcaster via frames
- Liquidity locked via smart contract — no rugging

### 💸 Cross-Platform Tipping
- **Lightning Network** — instant Bitcoin micropayments (Nostr zaps)
- **EVM chains** — Base, Optimism, Arbitrum via audited smart contract
- **Solana** — native SOL and SPL token tips
- **Batch tipping** — send to up to 50 recipients in one transaction
- **Streaming payments** — pay-per-minute during livestreams
- **Unified leaderboard** — top-tipped creators across all protocols
- **Zero platform fees** — tips go directly wallet-to-wallet

### 🎙️ Audio Spaces
- Host live audio conversations with up to 50 participants
- Speaker stage, listener mode, and hand-raising
- Cross-protocol broadcasting — join via Nostr, Farcaster, Bluesky, Lens, Mastodon
- Recording with automatic transcription
- Scheduled spaces with reminders

### 📺 Livestreaming
- Powered by self-hosted **PeerTube** at video.degenfeed.xyz
- Stream types: Solo, Collab, Coin Launch Events, Audio Spaces
- OBS-compatible RTMP keys
- Cross-protocol announcements — ActivityPub, Nostr kind 30311, AT Protocol, Farcaster frames, Telegram
- Real-time chat via **Prosody XMPP** bridge

### 📱 Short-Form Video
- TikTok-style vertical video feed aggregated from federated sources
- Infinite scroll with keyboard navigation
- Remix & duet with attribution and revenue sharing

### 👥 Feddy Communities
- Cross-protocol communities spanning all supported networks
- Token-gated access (EVM + Solana)
- On-chain governance with quadratic voting
- Cross-protocol moderation tools

### 🔍 Cross-Protocol Identity & Search
- Link identities across Nostr, Farcaster, Lens, Bluesky, Mastodon, and more
- Unified profile page showing all connected identities
- Cross-protocol text search powered by MeiliSearch
- `df://` universal resource identifiers for protocol-agnostic linking

### 🏆 Reputation & Gamification
- 7-tier system: Newcomer → Contributor → Active → Trusted → Veteran → Elite → Legend
- Earn reputation by posting, receiving likes, tips, follows, and bridging
- Tier-based benefits: enhanced discovery, custom feeds, badge display, analytics access

### 🔧 Admin & Moderation
- Content moderation dashboard with flagging system
- User management and rate limit configuration
- System health monitoring and deployment management
- Cross-protocol reporting and moderation

---

## Integrated Protocols (25+)

| Protocol | Feed | Post | Tip | Creator Coin | Livestream | Spaces |
|----------|------|------|-----|-------------|------------|--------|
| Nostr | ✅ | ✅ | ✅ (Lightning) | — | — | ✅ |
| Farcaster / Warpcast | ✅ | ✅ | ✅ | ✅ (Base) | — | ✅ |
| Bluesky (AT Protocol) | ✅ | ✅ | ✅ | — | — | ✅ |
| Mastodon / GoToSocial | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| Threads (Instagram) | ✅ | ✅ | — | — | — | — |
| Twitter / X | ✅ | — | — | — | — | — |
| Reddit | ✅ | — | — | — | — | — |
| RSS / Atom | ✅ (353+ sources) | — | — | — | — | — |
| PeerTube | ✅ | ✅ | ✅ | — | ✅ | — |
| Lens Protocol | ✅ | — | ✅ | ✅ (Polygon) | — | ✅ |
| YouTube | ✅ | — | — | — | — | — |
| Lemmy | ✅ | — | ✅ | — | — | — |
| Telegram | ✅ | ✅ | — | — | — | — |
| Discord | ✅ | ✅ | — | — | — | — |
| Matrix | ✅ | ✅ | — | — | — | — |
| GitHub | ✅ | ✅ | — | — | — | — |
| Substack / Ghost | ✅ | ✅ | — | — | — | — |
| Webhooks | ✅ | ✅ | — | — | — | — |
| Zora | — | — | ✅ | ✅ (Wrap) | — | — |
| Solana | — | — | ✅ | ✅ (SPL) | — | — |
| **Pixelfed** | ✅ | ✅ | — | — | — | — |
| **Odysee / LBRY** | ✅ | — | — | — | — | — |
| **Hacker News** | ✅ | — | — | — | — | — |
| **Mirror.xyz** | ✅ | — | — | — | — | — |

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
│                      PACKAGES LAYER (30+)                            │
│  Protocol SDKs   │  Feed Pipeline  │  Identity     │  Auth           │
│  Creator Coins   │  Tip Engine     │  Ranking      │  Web3           │
│  Reputation      │  Storage        │  Realtime     │  UI Components  │
│  Smart Contracts │  Token SDK      │  Video        │  Shorts         │
└─────────────────────────────────────────────────────────────────────┘
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full architecture documentation.

---

## Quick Start

```bash
# Prerequisites: Node.js >=20, pnpm
pnpm install

# Copy environment variables
cp apps/web/.env.example apps/web/.env.local

# Start development (frontend + API worker)
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Full Stack (Docker)

```bash
docker compose -f docker-compose.yml up -d
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment.

---

## Monorepo Structure

```
apps/
  web/                     Next.js 16 aggregator client (87+ SSR pages)
    src/
      app/                 60+ route groups (feed, profile, discover, etc.)
      components/          16+ component directories
      lib/                 Client-side utilities
      middleware.ts        Auth + rate limiting middleware

workers/
  api/                     Cloudflare Worker: edge API (500+ routes)
    src/
      routes/              ~100 route modules
      feed/                Feed pipeline (scorer, curator, freshness)
      lib/                 Shared libraries (bridge engine, community store, etc.)

packages/                  30+ shared packages
  types/                   Unified protocol types
  feed-core/               Feed normalization + deduplication
  ranking/                 Transparent feed scoring algorithms
  ui/                      Shared React components
  identity/ + identity-hub/ Identity resolution
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
  discord-sdk/             Discord Bot API & webhook client
  matrix-sdk/              Matrix homeserver client
  github-sdk/              GitHub API client
  newsletter-bridge-sdk/   Substack/Ghost RSS bridge
  zora-sdk/                Creator coin SDK (bonding curve, anti-exploit)
  shorts-provider/         Short-form video provider
  tip-contract/            Solidity + Anchor (Solana) smart contracts
  spaces-audio/            Audio Spaces engine
  token-gate/              Token-gated content access

infra/
  cloudflare/              Wrangler configs, Pages setup
  monitoring/              GlitchTip, Grafana, Prometheus
  deploy-templates/        Docker Compose templates

mobile/                    Capacitor mobile shell (iOS + Android)
docs/                      VitePress documentation site
scripts/                   Deploy, rollback, migration scripts
```

---

## Smart Contracts

| Contract | Chain | Language | Purpose |
|----------|-------|----------|---------|
| `DegenFeedCoin.sol` | Base | Solidity | ERC-20 creator token with vesting |
| `DegenFeedFactory.sol` | Base | Solidity | Factory-deployed coins per creator |
| `CrossChainRegistry.sol` | Base | Solidity | Protocol→chain→token mapping |
| `DegenFeedTips.sol` | Base / Optimism / Arbitrum | Solidity | 0% fee tipping contract |
| `degenfeed-creator-token` | Solana | Anchor Rust | SPL token program |
| `DegenFeedCreatorToken` | Solana | Anchor Rust | Creator token with vesting |

---

## Standards

This repo follows [Rug Munch Media standards](https://git.rugmunch.io/RugMunchMedia/standards).

---

## License

**GNU Affero General Public License v3.0 (AGPL-3.0)** — see [LICENSE](LICENSE).

DegenFeed is open source. You can inspect, fork, and self-host every line of code. Contributions welcome.

---

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Monorepo structure, protocol integration map, data flows, security model |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | Complete v1 API reference with all endpoints |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | End-user step-by-step guide from account creation to advanced features |
| [docs/CREATOR_GUIDE.md](docs/CREATOR_GUIDE.md) | Creator monetization: coins, tips, livestreaming, and growth strategies |
| [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) | How to add protocols, contribute features, and extend the platform |
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) | Per-protocol integration details and API references |
| [docs/BLOG.md](docs/BLOG.md) | Launch announcement — why we built it, technical deep dive, roadmap |
| [docs/PRESS.md](docs/PRESS.md) | Press kit — logos, metrics, founder info, contact |
| [docs/README.md](docs/README.md) | Full documentation index with links to every doc |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Cloudflare Pages + Workers deployment guide |
| [PRODUCT.md](PRODUCT.md) | Product charter, mission, and goals |
| [ROADMAP.md](ROADMAP.md) | Next 90 days of feature development |
| [CHANGELOG.md](CHANGELOG.md) | Release history and version notes |
| [CLOUDFLARE.md](CLOUDFLARE.md) | Cloudflare-specific configuration and KV setup |
| [TESTING.md](TESTING.md) | Testing strategy: unit, integration, E2E, visual regression |
| [SECURITY.md](SECURITY.md) | Security policy and vulnerability reporting |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute code, docs, and bug reports |

### Docs Site

Full documentation site at **[docs.degenfeed.xyz](https://docs.degenfeed.xyz)** — built with VitePress.

---

## Contact

- **General:** admin@rugmunch.io
- **Legal:** legal@rugmunch.io
- **DMCA:** dmca@degenfeed.xyz
- **Codeberg Mirror:** [codeberg.org/degenfeed/degenfeed-web](https://codeberg.org/degenfeed/degenfeed-web)
- **GitHub Mirror:** [github.com/RugMunchMedia/degenfeed](https://github.com/rugmunchmedia/degenfeed)
