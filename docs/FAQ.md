# DegenFeed — FAQ

**What is DegenFeed?** An open-source aggregator unifying 44+ decentralized social protocols (Nostr, Farcaster, Lens, Bluesky, Mastodon, PeerTube…) into one ranked feed, with cross-posting, creator coins, and tipping.

**Is it free?** The code is MIT-licensed and self-hostable. The hosted app at app.degenfeed.xyz is free to browse; no account required.

**Which protocols are supported?** Nostr, Farcaster, Lens, Bluesky, Mastodon, PeerTube, Telegram, Discord, Matrix, Reddit, RSS, YouTube, Pixelfed, Zora and more — see docs.degenfeed.xyz for the live list.

**How does feed ranking work?** A quality pipeline scores items by engagement signals, recency decay, and source health. Tuning knobs live in `workers/api` config — see docs/FEED-ALGORITHM-TUNING.md.

**Can I run just the API without the web app?** Yes — `workers/api` is standalone (Cloudflare Workers). `docker compose up -d` runs the full local stack.

**How do I add a new protocol source?** Implement a provider under `bridge/src/providers/`, register it in the provider registry, add tests. See CONTRIBUTING.md.

**Where do secrets go?** Runtime env injection only — never `.env` in git. Copy `.env.example` names into your deployment secret store.

**Creator coins — which chains?** Base and Solana. Tipping supports ETH, SOL, USDC, Lightning.
