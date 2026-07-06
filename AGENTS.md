[//]: # (SPDX-License-Identifier: MIT)
[//]: # (Copyright (c) 2026 Rug Munch Media LLC)
# AGENTS.md — DegenFeed Web

> AI agent contract. Read this before touching anything in this repo.

## Status
canonical · owner=crmuncher · last_updated=2026-07-06

## What This Repo Is
Next.js multi-protocol social aggregator client. Aggregates Nostr, Farcaster, Lens, and Bluesky into a single feed and composer.

> **This repo is NOT the deployed DegenFeed Mastodon instance** — that runs at `/srv/degenfeed/` as the `gotosocial` container behind `social.degenfeed.xyz`. This repo is the web client only.

## Type
`frontend` · language=TypeScript 5 + Next.js 14 (App Router) + React 19

## Where It Lives
- Source: `https://git.rugmunch.io/RugMunchMedia/degenfeed-web`
- Deployed: static build → nginx (target TBD)
- Monorepo: Turborepo + pnpm workspaces

## Built With
- Standards: [git.rugmunch.io/RugMunchMedia/standards](https://git.rugmunch.io/RugMunchMedia/standards)
- Toolchain: [TOOLCHAIN.md](https://git.rugmunch.io/RugMunchMedia/standards/raw/branch/main/TOOLCHAIN.md)
- Conventions: [CONVENTIONS.md](https://git.rugmunch.io/RugMunchMedia/standards/raw/branch/main/CONVENTIONS.md)

## Components
- `apps/landing/` — static landing page (live at `degenfeed.xyz`)
- `apps/web/` — Next.js client (scaffolding, not yet deployed)
- `workers/` — edge workers (e.g. news aggregation)
- `packages/` — shared protocol adapters (Nostr, Farcaster, Lens, Bluesky)
- `infra/` — infra as code

## Dependencies
- Node ≥ 20
- pnpm 11
- Turborepo 2
- Biome (format + lint)
- TypeScript 5.5+

## 🚨 CRITICAL RULES

1. **No nested repos.** Don't commit other complete project trees inside this one.
2. **No secrets.** Never commit `.secrets/`, `.env`, `*.pem`, `*.key`, `*.crt`. Use gopass.
3. **No data blobs.** Don't commit `*.zip`, `*.parquet`, model weights, sqlite files.
4. **No duplicate scaffolds.** If a `frontend/` or `backend/` subdir exists at root, it's either THE app or bloat.
5. **No mainnet RPC keys in source.** Use gopass and environment.
6. **Update STATUS.md before committing.** Builders must know where we are.
7. **Read DECISIONS.md before architectural changes.** Don't repeat rejected designs.

## Commands
```bash
pnpm install                # install deps
pnpm dev                    # dev server (turbo)
pnpm build                  # production build
pnpm lint                   # biome check
pnpm typecheck              # tsc --noEmit
pnpm test                   # run tests
pnpm format                 # biome format --write
```

## Architecture
See [ARCHITECTURE.md](ARCHITECTURE.md). Update it when components change.

## Status
See [PRODUCT.md](PRODUCT.md) and [ROADMAP.md](ROADMAP.md) for current state.

## Owners
- Primary: crmuncher
- Backup: TBD

## Related Repos
- `degenfeed/` — deployed GotoSocial instance (separate git repo, lives on Talos)
- See [standards/PRODUCTS.md](https://git.rugmunch.io/RugMunchMedia/standards/raw/branch/main/PRODUCTS.md).