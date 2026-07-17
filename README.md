# DegenFeed Web

[![CI](https://github.com/RugMunchMedia/degenfeed-web/actions/workflows/ci.yml/badge.svg)](https://github.com/RugMunchMedia/degenfeed-web/actions/workflows/ci.yml)
[![Deploy](https://github.com/RugMunchMedia/degenfeed-web/actions/workflows/deploy.yml/badge.svg)](https://github.com/RugMunchMedia/degenfeed-web/actions/workflows/deploy.yml)
[![Playwright E2E](https://img.shields.io/badge/E2E-Playwright-45ba4b?logo=playwright)](https://playwright.dev)
[![Biome](https://img.shields.io/badge/linted%20with-Biome-60a5fa?logo=biome)](https://biomejs.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript)](https://www.typescriptlang.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://nextjs.org)
[![Cloudflare](https://img.shields.io/badge/deployed%20on-Cloudflare-F38020?logo=cloudflare)](https://cloudflare.com)

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
- Landing page is served by the Cloudflare Worker from `workers/api/src/routes/landing.ts` at degenfeed.xyz
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
- Repo README conflated this client with the Mastodon deployment

## Standards
This repo follows Rug Munch Media standards:
https://git.rugmunch.io/RugMunchMedia/standards

## Docs
- PRODUCT.md — charter
- ARCHITECTURE.md — packages and protocol adapters
- ROADMAP.md — next 90 days
- TODO.md — current tasks
