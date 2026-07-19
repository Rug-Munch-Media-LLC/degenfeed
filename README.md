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

A multi-protocol social aggregator that unifies open social feeds into a single timeline with cross-platform posting and tipping. Built with **Next.js 16** (App Router), **Hono** on Cloudflare Workers, and deployed at [app.degenfeed.xyz](https://app.degenfeed.xyz).

### Integrated Protocols (10+)

| Protocol | Feed | Post | Tip |
|----------|------|------|-----|
| Nostr | ✅ | ✅ | ✅ |
| Farcaster / Warpcast | ✅ | ✅ | ✅ |
| Bluesky (AT Protocol) | ✅ | ✅ | ✅ |
| Mastodon / GotoSocial | ✅ | ✅ | ✅ |
| Threads (Instagram) | ✅ | ✅ | — |
| Twitter / X | ✅ | — | — |
| Reddit | ✅ | — | — |
| RSS / Atom | ✅ | — | — |
| PeerTube | ✅ | ✅ | ✅ |
| Lemmy | ✅ | — | ✅ |
| YouTube | ✅ | — | — |

### What's Inside

- **87 SSR pages** across the Next.js app (feed, profiles, threads, discover, settings, admin)
- **500+ API routes** (Hono on Cloudflare Workers) serving `/api/*` and `/v1/*` — feeds, auth, tipping, moderation, search, notifications, billing, spaces, gamification, and more
- **25+ packages** — protocol SDKs (nostr-sdk, farcaster-sdk, bluesky-sdk, mastodon-sdk, threads-sdk, lens-sdk, rss-sdk, peertube-provider), feed-core, ranking, identity, web3, reputation, storage, realtime, tip-contract (Solidity)
- **Cross-platform tipping** — Lightning Network, EVM (Base/Optimism/Arbitrum), Solana
- **Self-hostable** — [Docker Compose](docker-compose.yml) for the full stack

### Architecture

```
apps/web         — Next.js 16 frontend (Cloudflare Pages)
workers/api      — Hono API server (Cloudflare Workers) + Node.js fallback
packages/        — 25+ shared packages (SDKs, feed pipeline, ranking, identity, web3, storage)
docs/            — VitePress documentation site
mobile/          — Capacitor mobile shell (iOS + Android)
```

## Quick Start

```bash
pnpm install

# Copy and fill in environment variables
cp apps/web/.env.example apps/web/.env.local

# Start development
pnpm dev
```

For the full stack (API + database), see [docker-compose.yml](docker-compose.yml).

## Documentation

- [docs.degenfeed.xyz](https://docs.degenfeed.xyz) — full reference
- [ARCHITECTURE.md](ARCHITECTURE.md) — packages and protocol adapters
- [DEPLOYMENT.md](DEPLOYMENT.md) — Cloudflare Pages + Workers deploy guide
- [PRODUCT.md](PRODUCT.md) — charter and goals
- [ROADMAP.md](ROADMAP.md) — next 90 days

## Standards

This repo follows [Rug Munch Media standards](https://git.rugmunch.io/RugMunchMedia/standards).
