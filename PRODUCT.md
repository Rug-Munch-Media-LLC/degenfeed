# DegenFeed Web — Product Charter

**Product:** DegenFeed Web Client
**Repo:** git.rugmunch.io/RugMunchMedia/degenfeed-web
**Status:** Active development

## Problem
Crypto-native users consume content across Nostr, Farcaster, Lens, and Bluesky. A single client reduces friction and keeps the community in one place.

## User
- Crypto users who want one feed
- DegenFeed community members
- Content creators cross-posting

## Scope
- Next.js web client
- Protocol adapters: Nostr, Farcaster, Lens, Bluesky
- Unified feed normalization and composer
- Identity resolution across protocols

## Anti-scope
- This repo does NOT run the DegenFeed Mastodon server
- No backend database uses protocol-native storage
- No token scanning lives in rmi-backend
- No wallet generation lives in walletpress

## Success criteria
- apps/web deploys and renders a feed
- Composer publishes to all configured protocols
- CI green
- No source file greater than 500 lines

## Current reality
- apps/landing is live
- apps/web is scaffolding
- No CI or pre-commit
- No health endpoint

## Fleet dependencies
- DegenFeed Mastodon at http://127.0.0.1:4002 separate deployment
- Plausible analytics self-hosted on Talos
- MeiliSearch self-hosted on Talos
