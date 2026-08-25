# DegenFeed Web — Product Charter

**Product:** DegenFeed Web Client  
**Repo:** git.rugmunch.io/RugMunchMedia/degenfeed  
**Status:** Live in production

## Problem
Crypto-native users consume content across Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, RSS, and 44+ other protocols and services. A single client reduces friction and keeps the community in one place — while giving creators ownership of their content, identity, and revenue.

## User
- Crypto users who want one aggregated feed
- DegenFeed community members
- Content creators cross-posting across protocols

## Scope
- Next.js 16 web client deployed to Cloudflare Pages
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

## Current reality
- Landing page is the Next.js app served at `https://app.degenfeed.xyz` (hero section with orbiting protocols, live ticker, feed preview, featured creators)
- `apps/web` is live at `https://app.degenfeed.xyz` — fully operational with unified feed, composer, tipping, and profile pages
- `workers/api` is deployed as Cloudflare Worker `degenfeed-api`
- Cross-protocol posting is live for signed-in users (15+ protocols, 44+ read sources)
- Creator coins are live on Base and Solana
- Cross-chain tipping is live (ETH, SOL, USDC, Lightning)
- Livestreaming and Audio Spaces are live
- Feddy Communities are in development (Q3 2026)
- Self-hosted infrastructure: GoToSocial, AT Protocol PDS, PeerTube, Prosody XMPP, MeiliSearch
- CI and pre-commit are configured
- Makefile is the entry point for local development

## Fleet dependencies
- DegenFeed GotoSocial at `https://social.degenfeed.xyz` (separate deployment)
- Cloudflare Pages + Workers for hosting and edge API
- Plausible analytics self-hosted on [HOST-1]
- MeiliSearch self-hosted on [HOST-1]
