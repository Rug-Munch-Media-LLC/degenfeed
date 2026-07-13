# DegenFeed Web — Architecture

**Status:** canonical  
**Last updated:** 2026-07-06

## Overview
Turborepo monorepo with a Cloudflare Pages-hosted Next.js 15 client and a Cloudflare Worker edge API (which also serves the landing page). Shared packages provide protocol adapters, feed normalization, identity resolution, UI primitives, and wallet auth.

## Structure
```
apps/
  web/              Next.js 15 aggregator client at app.degenfeed.xyz
packages/
  types/            unified protocol types and interfaces
  feed-core/        feed normalization, deduplication, and assembly
  ranking/          transparent feed scoring algorithms
  ui/               shared React components
  identity/         cross-protocol identity resolution
  auth/             wallet sign-in and session management
  storage/          client and edge storage helpers
  nostr-sdk/        Nostr protocol adapter
  farcaster-sdk/    Farcaster protocol adapter
  lens-sdk/         Lens protocol adapter
  bluesky-sdk/      Bluesky protocol adapter
  mastodon-sdk/     Mastodon/ActivityPub adapter
  threads-sdk/      Threads protocol adapter
  rss-sdk/          RSS/Atom feed adapter
workers/
  api/              Cloudflare Worker: edge proxy + aggregator (degenfeed-api)
infra/
  cloudflare/       wrangler configs, Pages project, KV setup
```

## Deployment
| Component | Target | URL |
|-----------|--------|-----|
| Landing page | Cloudflare Worker | `https://degenfeed.xyz` (`workers/api/src/routes/landing.ts`) |
| Web client | Cloudflare Pages | `https://app.degenfeed.xyz` |
| Edge API | Cloudflare Worker `degenfeed-api` | `https://degenfeed.xyz/api/*` and `https://app.degenfeed.xyz/api/*` |
| Social server | GotoSocial (separate repo/deploy) | `https://social.degenfeed.xyz` |

The deployed DegenFeed social server is **GotoSocial**, not Mastodon. It runs from `/srv/degenfeed/` on Talos and is independent of this repo.

## Key flows
1. **Feed aggregation** — `workers/api` fetches and normalizes posts from configured protocols via the shared SDK packages, then serves them to `apps/web`.
2. **News aggregation** — `/news` in `apps/web` sources headlines from RSS and protocol feeds using `packages/rss-sdk` and `packages/feed-core`.
3. **Wallet sign-in** — `packages/auth` integrates Solana and EVM wallet adapters; sessions are managed client-side and verified at the edge worker.
4. **Composer** — posts drafted in `apps/web` are routed through the relevant protocol SDK and published either directly or via the edge worker proxy.

## Tooling
- **Build orchestration:** Turborepo + pnpm workspaces
- **Lint / format:** Biome
- **Type checking:** TypeScript `--noEmit`
- **Tests:** vitest
- **CI:** GitHub Actions (`.github/workflows/ci.yml`)
- **Pre-commit:** `.pre-commit-config.yaml`
- **Local entry point:** `Makefile`
