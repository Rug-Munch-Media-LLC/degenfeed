[//]: # (SPDX-License-Identifier: MIT)
[//]: # (Copyright (c) 2026 Rug Munch Media LLC)
# AGENTS.md — DegenFeed Web

> AI agent contract. Read this before touching anything in this repo.

## Status
canonical · owner=crmuncher · last_updated=2026-07-06

## What This Repo Is
Next.js multi-protocol social aggregator client. Aggregates Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, and RSS into a single feed and composer.

> **This repo is NOT the deployed DegenFeed social server** — GotoSocial runs separately at `/srv/degenfeed/` behind `social.degenfeed.xyz`. This repo is the web client, landing page, and API worker.

## Type
`frontend` · language=TypeScript 5 + Next.js 15 (App Router) + React 19

## Where It Lives
- Source: `https://git.rugmunch.io/RugMunchMedia/degenfeed-web`
- Landing page: `https://degenfeed.xyz` (Cloudflare Pages, `apps/landing/`)
- Web client: `https://app.degenfeed.xyz` (Cloudflare Pages, `apps/web/`)
- Edge API: `https://degenfeed.xyz/api/*` and `https://app.degenfeed.xyz/api/*` (Cloudflare Worker `degenfeed-api`, `workers/api/`)
- Social server: `https://social.degenfeed.xyz` (GotoSocial, separate deployment)
- Port: n/a (serverless / edge)

## Built With
- Standards: [git.rugmunch.io/RugMunchMedia/standards](https://git.rugmunch.io/RugMunchMedia/standards)
- Toolchain: [TOOLCHAIN.md](https://git.rugmunch.io/RugMunchMedia/standards/raw/branch/main/TOOLCHAIN.md)
- Conventions: [CONVENTIONS.md](https://git.rugmunch.io/RugMunchMedia/standards/raw/branch/main/CONVENTIONS.md)
- Git topology: [GIT-ARCHITECTURE.md](https://git.rugmunch.io/RugMunchMedia/standards/raw/branch/main/GIT-ARCHITECTURE.md)

## Components
- `apps/landing/` — static landing page (live at `degenfeed.xyz`)
- `apps/web/` — Next.js 15 aggregator client (live at `app.degenfeed.xyz`)
- `workers/api/` — Cloudflare Worker edge proxy + aggregator (`degenfeed-api`)
- `packages/types/` — unified protocol types
- `packages/feed-core/` — normalization, deduplication, and feed assembly
- `packages/ranking/` — transparent feed scoring
- `packages/ui/` — shared components
- `packages/identity/` — cross-protocol identity resolution
- `packages/auth/` — wallet sign-in and session logic
- `packages/storage/` — client-side and edge storage helpers
- `packages/nostr-sdk/` — Nostr adapter
- `packages/farcaster-sdk/` — Farcaster adapter
- `packages/lens-sdk/` — Lens adapter
- `packages/bluesky-sdk/` — Bluesky adapter
- `packages/mastodon-sdk/` — Mastodon/ActivityPub adapter
- `packages/threads-sdk/` — Threads adapter
- `packages/rss-sdk/` — RSS adapter
- `infra/` — Cloudflare Pages / Worker infrastructure and wrangler configs

## Dependencies
- Node ≥ 20
- pnpm 11
- Turborepo 2
- Biome (format + lint)
- TypeScript 5.5+
- Wrangler (Cloudflare Worker deploys)

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

## Architecture
See [ARCHITECTURE.md](ARCHITECTURE.md). Update it when components change.

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
