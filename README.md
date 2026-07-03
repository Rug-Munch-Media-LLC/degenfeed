# DegenFeed Web

**Repo:** git.rugmunch.io/RugMunchMedia/degenfeed-web
**Status:** Active development
**Note:** This repo is the Next.js social-aggregator client for Nostr, Farcaster, Lens, and Bluesky. It is NOT the deployed Mastodon instance at degenfeed.xyz.

## What this repo is
A web client that aggregates open social protocols into a single feed and composer.
Planned stack: Next.js 14 App Router, React 19, Tailwind, Radix, Zustand, TanStack Query.

## What this repo is NOT
- The deployed DegenFeed Mastodon server runs at /srv/degenfeed/ container degenfeed-web on port 4002
- A backend API. Protocol adapters live in packages/.

## Status
- apps/landing is a static landing page live at degenfeed.xyz
- apps/web is scaffolding; not deployed
- This repo currently has no health endpoint because apps/web is not running

## Quick start when apps/web exists
npm install
npm run dev

## Deployed Mastodon separate
ssh netcup
cd /srv/degenfeed/
docker compose ps

## Current issues
- No PRODUCT/ARCHITECTURE/ROADMAP/TODO docs now added
- No pre-commit config
- No Makefile
- No CI
- Repo README conflated this client with the Mastodon deployment

## Standards
This repo follows Rug Munch Media standards:
https://git.rugmunch.io/RugMunchMedia/standards

## Docs
- PRODUCT.md — charter
- ARCHITECTURE.md — packages and protocol adapters
- ROADMAP.md — next 90 days
- TODO.md — current tasks
