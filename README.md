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
**Repo:** git.rugmunch.io/RugMunchMedia/degenfeed-web

## What is DegenFeed?

A multi-protocol social aggregator that unifies open social feeds into a single timeline with cross-platform posting, creator coins, livestreaming, and cross-chain tipping. Built with **Next.js 16** (App Router), **Hono** on Cloudflare Workers, and deployed at [app.degenfeed.xyz](https://app.degenfeed.xyz).

### Integrated Protocols (12)

| Protocol | Feed | Post | Tip | Creator Coin | Livestream |
|----------|------|------|-----|-------------|------------|
| Nostr | ✅ | ✅ | ✅ | — | — |
| Farcaster / Warpcast | ✅ | ✅ | ✅ | ✅ | — |
| Bluesky (AT Protocol) | ✅ | ✅ | ✅ | — | — |
| Mastodon / GotoSocial | ✅ | ✅ | ✅ | — | ✅ |
| Threads (Instagram) | ✅ | ✅ | — | — | — |
| Twitter / X | ✅ | — | — | — | — |
| Reddit | ✅ | — | — | — | — |
| RSS / Atom | ✅ | — | — | — | — |
| **PeerTube** | ✅ | ✅ | ✅ | — | ✅ |
| **Lemmy** | ✅ | — | ✅ | — | — |
| **YouTube** | ✅ | — | — | — | — |
| **Lens Protocol** | ✅ | — | ✅ | ✅ | — |

### Creator Coin System

Each creator can deploy their own ERC-20 token that powers their economy:

- **Farcaster Coins** — Deploy on Base via factory contract, auto-wrapped for Zora visibility, announced via Farcaster frames
- **Lens Coins** — Deploy on Polygon (Lens native), Zora-wrapped, bridged to Base and Solana
- **Customizable Vesting** — 4 presets (Trustless, Balanced, Community, Fast) with reputation-gated unlocks
- **Cross-Chain Registry** — On-chain mapping of protocol → chain → token with bidirectional lookups
- **Bonding Curve** — Sigmoid curve with 3-phase anti-exploit (2%/5%/10% limits, bundle detection, cooldowns)
- **Unified Profile** — All creator tokens across Base, Solana, Farcaster, and Lens in one view

### Cross-Platform Tipping

Send value across protocols and chains:

- **Lightning Network** — Instant Bitcoin micropayments
- **EVM** — Base, Optimism, Arbitrum
- **Solana** — Native SOL and SPL tokens
- **Cross-Chain** — Wormhole bridge for SOL → ETH routing
- **Farcaster Coins** — Tip via creator coin per FID
- **Lens Coins** — Tip via creator coin per profile ID
- **Unified Ledger** — All tips recorded in a single cross-platform tip history

### What's Inside

- **87 SSR pages** across the Next.js app (feed, profiles, threads, discover, settings, admin, launch)
- **500+ API routes** (Hono on Cloudflare Workers) serving `/api/*` and `/v1/*` — feeds, auth, tipping, moderation, search, notifications, billing, spaces, gamification, creator coins, and more
- **25+ packages** — Protocol SDKs (nostr-sdk, farcaster-sdk, bluesky-sdk, mastodon-sdk, threads-sdk, lens-sdk, rss-sdk, peertube-provider, telegram-sdk, zora-sdk), feed-core, ranking, identity, web3, reputation, storage, realtime, tip-contract (Solidity), identity-hub
- **Creator Economy** — Bonding curves, vesting schedules, fee config, recipient splits, Zora wrapping
- **PeerTube Livestreams** — Create, manage, and end livestreams from token community pages with real-time chat, RTMP keys, and cross-announcement
- **Self-hosted Infrastructure** — GoToSocial (ActivityPub), AT Protocol PDS (Bluesky), PeerTube (video), Prosody XMPP (chat), Redlib, RSS-Bridge
- **Cross-platform tipping** — Lightning Network, EVM (Base/Optimism/Arbitrum), Solana
- **Self-hostable** — [Docker Compose](docker-compose.yml) for the full stack

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   app.degenfeed.xyz                          │
│              Next.js 16 (Cloudflare Pages)                   │
├─────────────────────────────────────────────────────────────┤
│                     degenfeed.xyz/api/*                      │
│              Hono API Server (Cloudflare Worker)             │
├─────────┬──────────┬──────────┬──────────┬──────────────────┤
│ Nostr   │Farcaster │ Bluesky  │ Mastodon │   PeerTube       │
│ SDK     │  SDK     │  SDK     │  SDK     │   Provider       │
├─────────┴──────────┴──────────┴──────────┴──────────────────┤
│  Lens SDK  │  Threads SDK  │  RSS SDK  │  Telegram SDK      │
├────────────┴──────────────┴───────────┴─────────────────────┤
│  feed-core  │  ranking  │  identity-hub  │  auth  │  web3   │
├────────────┬──────────────┬───────────┬─────────────────────┤
│  zora-sdk  │ tip-contract │ storage   │  reputation         │
├────────────┴──────────────┴───────────┴─────────────────────┤
│                       25+ packages                          │
├─────────────────────────────────────────────────────────────┤
│  social.    │  video.     │  pds.        │ redlib.          │
│  degenfeed  │  degenfeed  │  degenfeed   │ degenfeed        │
│  .xyz       │  .xyz       │  .xyz        │ .xyz             │
│ (GoToSocial)│ (PeerTube)  │ (AT PDS)     │ (Redlib)         │
└─────────────┴─────────────┴──────────────┴──────────────────┘
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

## Quick Start

```bash
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

## Documentation

- [docs.degenfeed.xyz](https://docs.degenfeed.xyz) — full reference
- [ARCHITECTURE.md](ARCHITECTURE.md) — packages, protocol adapters, data flows
- [DEPLOYMENT.md](DEPLOYMENT.md) — Cloudflare Pages + Workers deploy guide + infrastructure
- [PRODUCT.md](PRODUCT.md) — charter and goals
- [ROADMAP.md](ROADMAP.md) — next 90 days
- [CHANGELOG.md](CHANGELOG.md) — release history

## Standards

This repo follows [Rug Munch Media standards](https://git.rugmunch.io/RugMunchMedia/standards).
