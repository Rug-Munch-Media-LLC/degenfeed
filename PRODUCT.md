# DegenFeed Web — Product Charter

**Product:** DegenFeed Web Client  
**Repo:** git.rugmunch.io/RugMunchMedia/degenfeed-web  
**Status:** Pre-launch — invite-only beta target  
**Last Updated:** 2026-07-27

## Problem
Crypto-native users consume content across Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, RSS, and 44+ other protocols and services. A single client reduces friction and keeps the community in one place — while giving creators ownership of their content, identity, and revenue.

## User
- Crypto users who want one aggregated feed
- DegenFeed community members
- Content creators cross-posting across protocols

## Scope
- Next.js 16 web client (deploys to Cloudflare Pages)
- Protocol adapters: Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, RSS, YouTube, PeerTube, Telegram, Discord, Matrix, GitHub, Substack/Ghost, Lemmy, Webhooks, and more
- Unified feed normalization, deduplication, and ranking
- Cross-protocol identity resolution
- Wallet sign-in (Solana + EVM)
- Creator coins (Base ERC-20 + Solana SPL)
- Cross-chain tipping (ETH, SOL, USDC, Lightning)
- Livestreaming + Audio Spaces (PeerTube)
- News aggregation (`/news`)
- Feddy Communities (token-gated, cross-protocol)
- Cloudflare Worker edge API (`workers/api/`)

## Anti-scope
- This repo does NOT run the DegenFeed GotoSocial server
- No backend database; protocol-native storage and edge KV only
- No token scanning; that lives in rmi-backend
- No wallet generation; that lives in walletpress

## Success criteria
- `apps/web` deploys and renders a unified feed at `https://app.degenfeed.xyz`
- Composer publishes to all configured protocols
- Wallet sign-in works for Solana and EVM wallets
- `/news` aggregates and renders protocol + RSS news
- CI green
- No source file greater than 500 lines

## Current reality (honest assessment)

### What IS deployed
- **social.degenfeed.xyz** — GoToSocial instance + Elk Mastodon client, live and operational
- **25+ Docker services** — self-hosted infrastructure (MeiliSearch, Plausible, AT Protocol PDS, PeerTube, Prosody XMPP, bridge services, etc.) running on internal fleet
- **Bridge infrastructure** — Ghost bridge operating, Nostr relay connectivity, RSS pipeline active
- **Cloudflare Workers** — `workers/api` deployed as `degenfeed-api` edge worker

### What IS built but NOT yet deployed as primary frontend
- **degenfeed-web monorepo** — 38 packages, 190+ API routes, spanning protocol SDKs, feed-core, ranking, identity, bridge, and UI
- **`apps/web`** — Next.js 16 application with full protocol integration, unified feed, composer, tipping, profile pages, coin discovery, news aggregation, notifications, and settings
- **`workers/api`** — 190+ edge API routes for feeds, publishing, search, auth, bridge, administration, and health
- **Build verification** — monorepo builds successfully with `turbo build`; 58 Playwright E2E tests pass
- **Security middleware** — CSP nonce-based headers, rate limiting (5 tiers), token-bucket auth, session verification, URL scam scanning against rmi-backend

### Current state
- **Pre-launch** — the custom degenfeed-web frontend is not deployed as the primary user-facing application
- **Routing fixes in progress** — cold-start issues with Cloudflare Pages + Next.js on-demand routing; `/home/[section]` per-protocol pages need stable routing before launch
- **Cold-start latency** — worker cold starts take 3-8s on first request after idle, affecting UX
- **Typecheck not green** — 8 package typecheck failures across the monorepo
- **Target: invite-only beta** — deploy `apps/web` to `app.degenfeed.xyz` behind invite gate; fix routing and cold-start before opening to public
- **What works now** — CSP security headers, theme (dark mode default, SSR-safe), rate limiting, URL scam scanning, wallet auth flow, ghost-bridge cross-publish (nostr + RSS), demo-data warning banners on coin detail, 58 E2E tests

## Fleet dependencies
- DegenFeed GotoSocial at `https://social.degenfeed.xyz` (separate deployment)
- Cloudflare Pages + Workers for hosting and edge API
- Plausible analytics self-hosted on [HOST-1]
- MeiliSearch self-hosted on [HOST-1]
