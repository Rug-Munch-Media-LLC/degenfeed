# DegenFeed v2

The social feed of web3.

DegenFeed is a single window onto the open social graph —
Nostr, Farcaster, Lens, and Bluesky — with one composer that
publishes to all of them at once.

## Status

- **Day 1 (2026-07-02):** v1 (Akkoma/Soapbox) nuked. v2 scaffolding begun.
- **Landing:** https://degenfeed.xyz (live, email capture only)
- **App:** building — see docs/PROGRESS.md

## Stack

- Frontend: Next.js 14 App Router, React 19, Tailwind, Radix
- State: Zustand (client), TanStack Query (server cache)
- Protocols: nostr-tools, @farcaster/hub-web, @lens-protocol/client, @atproto/api
- Crypto: viem
- Hosting: Cloudflare Pages + Workers
- Cache: Cloudflare KV
- Analytics: Plausible (self-hosted on Talos)
- Search: MeiliSearch (self-hosted on Talos)

## Repo layout

```
apps/
  landing/   static HTML/CSS/JS landing page (live)
  web/       Next.js app (week 1)
packages/
  types/     Unified types across protocols
  feed-core/ normalization, dedupe, niche detection
  ranking/   transparent feed scoring
  ui/        shared components (week 1)
  identity/  cross-protocol identity resolution (week 2)
  nostr-sdk/ nostr client (week 1)
  farcaster-sdk/ (week 1)
  lens-sdk/  (week 1)
  bluesky-sdk/ (week 1)
workers/
  api/       Cloudflare Worker for feed proxy (week 1)
infra/
  cloudflare/  wrangler, KV setup (week 1)
docs/
  PROGRESS.md  build log
  design.md    full design doc
```

## Operating principle

Tool-pull, not model-push. Every capability is a deterministic fetch from the source protocol. The LLM is a summarizer, not a brain.

## License

MIT
