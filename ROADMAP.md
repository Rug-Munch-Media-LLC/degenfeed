# DegenFeed Web — Roadmap

**Next 90 days.**

## Completed
- Upgrade to Next.js 15 + React 19 (now Next.js 16)
- Turborepo + pnpm workspace structure (`apps/*`, `packages/*`, `workers/*`)
- Landing page live at `degenfeed.xyz` (served by the Next.js app via nginx)
- **`apps/web` LIVE at `app.degenfeed.xyz`** — systemd standalone service (`degenfeed-web.service`, 127.0.0.1:3100) behind nginx + Cloudflare Tunnel
- Feed API live via the self-hosted bridge (`degenfeed-bridge.service`, :8787) — Cloudflare Worker `degenfeed-api` RETIRED 2026-08-04
- CI pipeline on Forgejo (`docker-x64` runner), pre-commit hooks, and Makefile
- Protocol SDK packages: Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, RSS
- Core packages: types, feed-core, ranking, ui, identity, auth, storage
- `/news` news aggregation
- Wallet sign-in (Solana + EVM)
- **Twitter/X-style timeline at `/twitter`** with inline composer and For You / Following tabs
- New DegenFeed icon/logo wired across app and home page

## Week 1 — Polish and observability
- Add `/health` route to `workers/api` and `apps/web`
- Wire Plausible analytics
- Add error boundaries and loading states in `apps/web`

## Week 2 — Composer and identity
- Cross-protocol composer UI
- Identity resolution UI (link profiles across protocols)
- Publish flow through edge worker

## Week 3 — Feed quality
- Ranking v2 with user signals
- Feed filters and search
- Infinite scroll and virtualization

## Week 4 — Integrations
- MeiliSearch-backed global search
- Notifications via GotoSocial
- RSS ingest improvements

## Acceptance
- `app.degenfeed.xyz` renders a unified, ranked feed ✅ (live via systemd)
- Composer publishes to at least Nostr + Farcaster + Lens + Bluesky
- CI green on every PR (runner-label + gate fixes landed 2026-08-30)
- `/health` returns 200 on both the app (:3100) and the bridge (:8787) ✅
