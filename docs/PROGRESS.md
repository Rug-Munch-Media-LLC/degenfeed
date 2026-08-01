# Build Progress

> **Note:** This document is historical. DegenFeed now integrates **44+ protocols and services** with **43+ shared packages**, **48+ Docker services**, and **~500+ API routes**. See [ARCHITECTURE.md](ARCHITECTURE.md) and [PLATFORM_UNIVERSE.md](PLATFORM_UNIVERSE.md) for current state.

## 2026-07-02 — Day 1: Pivot + foundation

### Done
- Pivoted from Akkoma/Soapbox/web3-bridge to aggregator-only architecture.
- Nuked v1: stopped, archived to /path/to/backups/degenfeed-v1-final/, removed nginx vhost.
- Scaffolded monorepo at /path/to/degenfeed-web with pnpm workspaces, Turborepo, Biome.
- Built shared types package @degenfeed/types (UnifiedPost, UnifiedIdentity, etc).
- Built @degenfeed/feed-core (normalization, dedupe, niche detection).
- Built @degenfeed/ranking (transparent scoring with documented weights).
- Landing page shipped (now served by Worker from `workers/api/src/routes/landing.ts`).
- Repointed Cloudflare tunnel from dead Akkoma:4002 to nginx:80.

### In Progress
- Wire SDK clients for Nostr, Farcaster, Lens, Bluesky.

### Next
- Week 1: Next.js app with mixed feed.
- Week 2: Multi-protocol sign-in.
- Week 3: Compose modal + engagement.
- Week 4: Polish + public launch.

### Decisions
- Name: DegenFeed (kept)
- Tagline: "The social feed of web3"
- Domain: degenfeed.xyz (kept)
- Pricing: Free, MIT, self-hostable. No paid SaaS.

### Operating cost
- bash today. Estimated <5/mo at 100k MAU.
