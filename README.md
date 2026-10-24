# degenfeed-web

A decentralised social client: one feed across Farcaster, Bluesky, Lens and Lemmy,
with creator coins and a chat layer, built as a pnpm monorepo.

**Status:** beta — the web app is live, the protocol bridges are still gaining
edge cases. **Licence:** MIT, see [LICENSE](LICENSE).

Canonical: https://git.rugmunch.io/RugMunchMedia/degenfeed-web

## Quickstart

Node 20+ (`.node-version` pins the CI version), pnpm 9+, Postgres and Redis.

```bash
git clone https://git.rugmunch.io/RugMunchMedia/degenfeed-web.git
cd degenfeed-web
corepack enable && pnpm install
cp .env.example .env      # DATABASE_URL, REDIS_URL, NEXT_PUBLIC_API_URL
pnpm --filter degenfeed dev
```

The web app is on `http://localhost:3000`. Compose needs Meilisearch's key
exported or it stops at startup:

```bash
export MEILI_MASTER_KEY='...'
docker compose up -d
```

Workspace-wide checks:

```bash
pnpm lint        # turbo run lint
pnpm typecheck
pnpm test
pnpm health      # scripts/health-check.sh — service reachability
```

## What it does

- **One timeline, several protocols.** Farcaster, Bluesky/ATProto, Lens and Lemmy
  are normalised into a single feed model in `packages/feed-core`, so the UI does
  not branch per network.
- **Creator coins.** `packages/creator-coin` handles issuance and balances for
  per-creator tokens.
- **Chat.** `packages/degenchat` plus `chat-super-app` — a separate surface with
  its own auth, not a widget.
- **Cross-posting.** `packages/cross-protocol-bridge` and
  `crossplatform-register` publish one post to more than one network.
- **Search.** Meilisearch for feed and profile search; Postgres remains the
  source of truth.

## How it is put together

```
apps/web            Next.js app (App Router) — the product
apps/docs           VitePress documentation site
packages/
  feed-core         normalised post/feed model
  feed-providers    per-protocol adapters
  farcaster-sdk  bluesky-sdk  lens-sdk  lemmy-sdk
  creator-coin  degenchat  chat-super-app
  auth  identity  cross-protocol-bridge  crossplatform-register
```

Turbo orchestrates builds; each package builds independently.

## Configuration

`.env.example` is the list. The ones the app cannot start without:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres — accounts, posts, coins |
| `REDIS_URL` | queues and rate limiting |
| `NEXT_PUBLIC_API_URL` | API base the browser calls |
| `RMI_BACKEND_URL` | server-side calls to the intelligence backend |
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | session handling |
| `MEILI_MASTER_KEY` | Meilisearch; compose refuses to start without it |
| `FARCASTER_HUB_URL` | hub used for Farcaster reads/writes |
| `POSTIZ_URL` | optional scheduling integration |
| `NEXT_PUBLIC_ENABLE_PREMIUM`, `NEXT_PUBLIC_ENABLE_CREATOR_COINS` | feature switches |

## Known limits

- Writes need real protocol credentials. Read-only browsing works with public
  endpoints; posting to Farcaster or Bluesky does not.
- The protocol SDKs in `packages/` track upstream specs that still change. Pin
  before deploying.
- Mobile builds exist (Capacitor deps are present) but the web app is the tested
  target.
- One Postgres holds everything. There is no sharding story here, and at scale
  the feed queries are the first thing to hurt.

## Licence

MIT.
