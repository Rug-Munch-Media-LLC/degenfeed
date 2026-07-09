# DegenFeed Web — Product Charter

**Product:** DegenFeed Web Client  
**Repo:** git.rugmunch.io/RugMunchMedia/degenfeed-web  
**Status:** Live in production

## Problem
Crypto-native users consume content across Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, and RSS. A single client reduces friction and keeps the community in one place.

## User
- Crypto users who want one aggregated feed
- DegenFeed community members
- Content creators cross-posting across protocols

## Scope
- Next.js 15 web client deployed to Cloudflare Pages
- Protocol adapters: Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, RSS
- Unified feed normalization, deduplication, and ranking
- Cross-protocol identity resolution
- Wallet sign-in (Solana + EVM)
- News aggregation (`/news`)
- Cloudflare Worker edge API (`workers/api/`)
- Static landing page at `degenfeed.xyz`

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

## Current reality
- `apps/landing` is live at `https://degenfeed.xyz`
- `apps/web` is live at `https://app.degenfeed.xyz`
- `workers/api` is deployed as Cloudflare Worker `degenfeed-api`
- CI and pre-commit are configured
- Makefile is the entry point for local development
- `/news` and wallet sign-in are live features
- GotoSocial remains the canonical ActivityPub server at `https://social.degenfeed.xyz`

## Fleet dependencies
- DegenFeed GotoSocial at `https://social.degenfeed.xyz` (separate deployment)
- Cloudflare Pages + Workers for hosting and edge API
- Plausible analytics self-hosted on Talos
- MeiliSearch self-hosted on Talos
