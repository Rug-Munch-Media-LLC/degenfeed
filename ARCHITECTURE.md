# DegenFeed Web — Architecture

**Status:** canonical
**Last updated:** 2026-07-03

## Overview
Monorepo-style Next.js application with shared packages for protocol adapters and UI.

## Structure
apps/landing   static landing page at degenfeed.xyz
apps/web       Next.js aggregator client not yet deployed
packages/types     unified protocol types
packages/feed-core normalization and dedupe
packages/ranking   transparent feed scoring
packages/ui        shared components
packages/identity  cross-protocol identity resolution
packages/nostr-sdk/
packages/farcaster-sdk/
packages/lens-sdk/
packages/bluesky-sdk/
workers/api        Cloudflare Worker proxy planned
infra/cloudflare   wrangler and KV setup

## Deployment note
The deployed DegenFeed social server is Mastodon v4.3.7 at /srv/degenfeed/.
It is NOT this repo. This repo is a planned future client.

## Current issues
- apps/web not built
- No CI
- No pre-commit
- Package structure is aspirational
