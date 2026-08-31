---
sidebar_position: 4
title: Architecture
---

# Architecture

DegenFeed is a **pnpm + Turborepo monorepo**. Everything is in one repo:
the web app, the protocol bridge, background workers, and 40+ shared packages.

## Monorepo layout

```
degenfeed-web/
├── apps/
│   └── web/                 Next.js 16 app (the product) — production runs
│                            as a standalone server on 127.0.0.1:3100
├── bridge/                  Local HTTP bridge server (port 8787) — the feed
│                            API + protocol providers + publish fan-out
├── workers/
│   └── api/                 Background API workers
├── packages/                40+ shared packages:
│   ├── Protocol SDKs        nostr-sdk, mastodon-sdk, bluesky-sdk,
│   │                        farcaster-sdk, lens-sdk, lemmy-sdk,
│   │                        threads-sdk, telegram-sdk, rss-sdk, zora-sdk
│   ├── Feed pipeline        feed-core, feed-providers, ranking,
│   │                        source-discovery, shorts-provider
│   ├── Identity & auth      identity, auth, crossplatform-register
│   ├── Money                creator-coin, monetization, token-gate,
│   │                        web3, crypto, solana-programs
│   ├── Infra                storage, realtime, reputation, ui, utils, types
│   └── Bridges              cross-protocol-bridge, ghost-bridge,
│                            mirror-bridge, paragraph-bridge, spaces-bridge
├── bridge/                  (see above — the feed API lives here)
├── deploy/                  build-standalone.sh and deploy scripts
├── infra/                   nginx configs, Docker templates, monitoring
├── docs/                    internal engineering docs (source for this site)
└── tests/                   integration and E2E tests
```

## Production topology

```
┌─────────────────────────────────────────────────────────────────────┐
│                      PUBLIC DOMAINS (nginx → Cloudflare Tunnel)      │
│  degenfeed.xyz        → landing page (app `/`)                       │
│  app.degenfeed.xyz    → the app                                      │
│  social.degenfeed.xyz → Mastodon: Elk + GoToSocial (Docker)          │
│  api.degenfeed.xyz    → feed API bridge (:8787)                      │
├─────────────────────────────────────────────────────────────────────┤
│                APP LAYER (self-hosted, systemd — LIVE)               │
│  degenfeed-web.service   (Next.js 16 standalone, 127.0.0.1:3100)     │
│  degenfeed-bridge.service (feed API, :8787 — 70+ providers)          │
├─────────────────────────────────────────────────────────────────────┤
│                      PACKAGES LAYER (43+)                            │
│  Protocol SDKs │ Feed Pipeline │ Identity │ Auth │ Money │ Realtime  │
└─────────────────────────────────────────────────────────────────────┘
```

## Data flow

```
Browser
   │
   ▼
nginx (TLS termination, public domains)
   │
   ├── degenfeed.xyz / app.degenfeed.xyz ──► Next.js standalone app :3100
   │                                            │  server-side fetch
   │                                            ▼
   └── api.degenfeed.xyz ────────────────► bridge :8787
                                                │  /api/feed/home, /api/publish, …
                                                ├── providers/*  → Mastodon, Bluesky,
                                                │                   Nostr, Farcaster,
                                                │                   Lens, Lemmy, RSS, …
                                                └── crossposter  → background
                                                                    source→target posts
```

1. **The app (`:3100`)** renders pages and calls the bridge for feed data.
2. **The bridge (`:8787`)** fans out to protocol providers, merges and ranks
   results (`packages/ranking`), caches per sort/protocol pool, and serves the
   unified feed (see [API](/docs/api)).
3. **The crossposter** (`bridge/src/crossposter.ts`) polls configured
   source→target pairs and publishes transformed posts in the background.
4. **nginx** terminates TLS and routes public domains to the loopback
   services; Cloudflare Tunnel fronts the whole thing.

## Build & deploy

```bash
pnpm install
pnpm --filter degenfeed build          # the web app (repo package name: degenfeed)
bash deploy/build-standalone.sh        # assemble the standalone server
sudo systemctl restart degenfeed-web degenfeed-bridge
```

> **Repo naming:** the production checkout directory is `degenfeed-web` but the
> git repo / pnpm package is `degenfeed` — same repo, don't create a second
> checkout.
