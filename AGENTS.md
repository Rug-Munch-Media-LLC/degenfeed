[//]: # (SPDX-License-Identifier: MIT)
[//]: # (Copyright (c) 2026 Rug Munch Media LLC)
# AGENTS.md — DegenFeed Web

> AI agent contract. Read this before touching anything in this repo.

## Status
canonical · owner=crmuncher · last_updated=2026-07-29

## What This Repo Is
Next.js 15 multi-protocol social aggregator — monorepo with 39 packages. Aggregates Nostr, Farcaster, Lens, Bluesky, Mastodon/ActivityPub, Threads, RSS, PeerTube, Pixelfed, Zora, Telegram, Lemmy, and YouTube into a single feed, composer, and cross-platform bridge.

> **This repo is NOT the deployed DegenFeed social server** — GotoSocial runs separately at `/srv/degenfeed/` behind `social.degenfeed.xyz`. This repo is the web client, API worker, cross-protocol bridge, and tip contract system.

## Monorepo Architecture

```
degenfeed-web/
├── apps/web/               # Next.js 15 App Router web client (app.degenfeed.xyz)
├── workers/api/            # Cloudflare Worker edge API (degenfeed-api)
├── bridge/                 # Local bridge server (crossposter, event-bridge, search-indexer)
├── packages/               # 39 shared packages
│   ├── auth/               # Wallet sign-in (Solana + EVM)
│   ├── types/              # Unified protocol types
│   ├── feed-core/          # Feed normalization + dedup
│   ├── ranking/            # 8-factor transparent feed scoring
│   ├── identity/           # Cross-protocol identity resolution
│   ├── storage/            # Client-side + edge storage
│   ├── ui/                 # Shared UI components
│   ├── utils/              # Shared utilities
│   ├── web3/               # Web3 helpers
│   ├── crypto/             # Crypto utilities
│   ├── realtime/           # Real-time event handling
│   ├── reputation/         # User reputation system
│   ├── monetization/       # Monetization system
│   ├── creator-coin/       # Creator coin economy
│   ├── token-gate/         # Token-gated content
│   ├── chat-super-app/     # Cross-platform chat
│   ├── solana-programs/    # Solana program interactions
│   │
│   ├── nostr-sdk/          # Nostr protocol adapter
│   ├── farcaster-sdk/      # Farcaster adapter (+ Neynar API key rotation)
│   ├── lens-sdk/           # Lens protocol adapter
│   ├── bluesky-sdk/        # Bluesky AT Protocol adapter
│   ├── mastodon-sdk/       # Mastodon/ActivityPub adapter
│   ├── threads-sdk/        # Threads adapter
│   ├── rss-sdk/            # RSS/Atom adapter
│   ├── peertube-provider/  # PeerTube REST client + provider
│   ├── pixelfed-sdk/       # Pixelfed adapter
│   ├── youtube-provider/   # YouTube adapter
│   ├── telegram-sdk/       # Telegram adapter
│   ├── lemmy-sdk/          # Lemmy adapter
│   ├── zora-sdk/           # Zora adapter
│   │
│   ├── cross-protocol-bridge/   # Cross-protocol message relay
│   ├── ghost-bridge/            # Ghost CMS bridge
│   ├── mirror-bridge/           # Mirror.xyz bridge
│   ├── paragraph-bridge/        # Paragraph bridge
│   ├── spaces-bridge/           # Farcaster Spaces bridge
│   ├── crossplatform-register/  # SSO registration (8 services)
│   ├── source-discovery/        # Content source discovery
│   ├── shorts-provider/         # Short-form video provider
│   ├── feed-providers/          # Feed data providers
│   └── peertube-sdk/            # PeerTube SDK
└── infra/                  # Cloudflare Pages/Worker wrangler configs
```

## Type
`frontend` · language=TypeScript 5 + Next.js 15 (App Router) + React 19

## Where It Lives
- Source: `https://git.rugmunch.io/RugMunchMedia/degenfeed-web`
- Landing page: `https://degenfeed.xyz` (Cloudflare Worker, `workers/api/src/routes/landing.ts`)
- Web client: `https://app.degenfeed.xyz` (Cloudflare Pages, `apps/web/`)
- Edge API: `https://degenfeed.xyz/api/*` and `https://app.degenfeed.xyz/api/*` (Cloudflare Worker `degenfeed-api`, `workers/api/`)
- Social server: `https://social.degenfeed.xyz` (GotoSocial, separate deployment)
- Port: n/a (serverless / edge)

## Built With
- Standards: [git.rugmunch.io/RugMunchMedia/standards](https://git.rugmunch.io/RugMunchMedia/standards)
- Toolchain: [TOOLCHAIN.md](https://git.rugmunch.io/RugMunchMedia/standards/raw/branch/main/TOOLCHAIN.md)
- Conventions: [CONVENTIONS.md](https://git.rugmunch.io/RugMunchMedia/standards/raw/branch/main/CONVENTIONS.md)
- Git topology: [GIT-ARCHITECTURE.md](https://git.rugmunch.io/RugMunchMedia/standards/raw/branch/main/GIT-ARCHITECTURE.md)

## Components (Deployment Targets)
| Component | Path | URL |
|-----------|------|-----|
| Landing page | `workers/api/src/routes/landing.ts` | `degenfeed.xyz` |
| Web client | `apps/web/` (Next.js 15) | `app.degenfeed.xyz` |
| Edge API | `workers/api/` (Cloudflare Worker) | `app.degenfeed.xyz/api/*` |
| Bridge server | `bridge/` (local Node process) | Internal |
| Tip contracts | `packages/solana-programs/` | Base, Optimism, Arbitrum |
| Social server | External (GotoSocial) | `social.degenfeed.xyz` |
| PeerTube | External | `video.degenfeed.xyz` |

## Dependencies
- Node ≥ 22
- pnpm 11
- Turborepo 2.10
- Biome 2.5 (format + lint)
- TypeScript 7.0
- Wrangler 4 (Cloudflare Worker deploys)
- Playwright (e2e tests)
- Vitest (unit tests)
- Changesets (versioning)

## Bridge Architecture

The bridge (`bridge/`) is a local Node process that handles cross-protocol operations:

```
bridge/src/
├── server.ts              # Express server entrypoint
├── crossposter.ts         # Cross-protocol content publishing
├── event-bridge.ts        # Real-time event relay between protocols
├── search-indexer.ts      # MeiliSearch indexing bridge
├── rate-limiter.ts        # Per-protocol rate limiting
├── reliability/           # Circuit breakers, retry, dead-letter queues
├── providers/             # Protocol-specific bridge providers
├── lib/                   # Shared bridge utilities
├── server/                # Server middleware, auth, routes
└── __tests__/            # Bridge tests
```

### Bridge SSO (8 Services)
Cross-platform registration via `packages/crossplatform-register/`: Nostr, Farcaster, Lens, Bluesky, Mastodon, PeerTube, Pixelfed, Lemmy — SSO with wallet sign-in.

### Neynar Farcaster API
3-account key rotation for 150K calls/month free tier. Handles Farcaster data ingestion + submission.

### Search
MeiliSearch indexing via `bridge/search-indexer.ts`. Search handlers in `workers/api/src/routes/search/` with protocol field filtering.

## 🚨 CRITICAL RULES

1. **No nested repos.** Don't commit other complete project trees inside this one.
2. **No secrets.** Never commit `.secrets/`, `.env`, `*.pem`, `*.key`, `*.crt`. Use gopass.
3. **No data blobs.** Don't commit `*.zip`, `*.parquet`, model weights, sqlite files.
4. **No duplicate scaffolds.** If a `frontend/` or `backend/` subdir exists at root, it's either THE app or bloat.
5. **No mainnet RPC keys in source.** Use gopass and environment.
6. **Update STATUS.md before committing.** Builders must know where we are.
7. **Read DECISIONS.md before architectural changes.** Don't repeat rejected designs.
8. **Use `make <target>`.** Don't run raw `pnpm` scripts when a Makefile target exists.
9. **Conventional commits.** `feat(scope):`, `fix(scope):`, etc. Use `make commit`.
10. **Never `--no-verify` on pre-commit.** If a hook fails, fix it.

## Commands
```bash
make install     # install deps (frozen lockfile)
make dev         # dev servers via Turbo
make build       # production build via Turbo
make lint        # Biome lint across monorepo
make format      # Biome format --write
make check       # fast check: lint + typecheck
make typecheck   # TypeScript --noEmit across monorepo
make test        # unit tests via vitest
make test-cov    # tests with coverage
make security    # gitleaks detect
make ci          # full local pipeline (lint + typecheck + test + build)
make clean       # remove build artifacts and node_modules
```

## Live Features
- `/news` — news aggregation from RSS and protocol feeds
- Wallet sign-in — Solana + EVM wallet adapter integration
- Cross-protocol posting — compose once, publish to 8+ protocols
- Bridge SSO — single wallet registration across Nostr, Farcaster, Lens, Bluesky, Mastodon, PeerTube, Pixelfed, Lemmy
- Token-gated content — restrict access based on token holdings
- Creator coins — on-chain creator economy with tipping
- Farcaster Spaces — bridge to Farcaster channels
- PeerTube video — upload, livestream, token-gated video via video.degenfeed.xyz
- MeiliSearch — full-text search across all protocol feeds
- 8-factor ranking — transparent feed scoring algorithm

## Architecture
See [ARCHITECTURE.md](ARCHITECTURE.md). Update it when components change.

## Tip Contracts
- Solidity contracts in `packages/solana-programs/` (EVM) and `packages/solana-programs/` (Solana)
- Deployed to Base, Optimism, Arbitrum via `deploy-tip-contract.ts`
- Script: `pnpm deploy:tip-contract:base`, `pnpm deploy:tip-contract:optimism`, `pnpm deploy:tip-contract:arbitrum`
- Forge builds via `pnpm deploy:tip-contract:forge`

## PeerTube
- Instance: `video.degenfeed.xyz` (internal `127.0.0.1:9011`)
- SDK: `packages/peertube-sdk/` — Full REST client (videos, channels, playlists, live, comments, federation)
- Provider: `packages/peertube-provider/` — Circuit breaker, federated discovery, upload/livestream management
- Routes: `/api/peertube/*` (upload, list, rate, channels, live, federation), `/api/token/:address/peertube` (token-gated livestreams)
- Frontend: `/video/peertube` explorer, `PeerTubePlayer.tsx` with theater mode

## Plan
[ROADMAP.md](ROADMAP.md) shows current sprint and upcoming work. Update weekly.

## Status
See [PRODUCT.md](PRODUCT.md) for product state and acceptance criteria.

## Owners
- Primary: crmuncher
- Backup: TBD

## Related Repos
- `degenfeed/` — deployed GotoSocial instance (separate git repo, lives on Talos)
- See [standards/PRODUCTS.md](https://git.rugmunch.io/RugMunchMedia/standards/raw/branch/main/PRODUCTS.md).
