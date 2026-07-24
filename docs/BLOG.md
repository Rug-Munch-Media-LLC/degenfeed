# Introducing DegenFeed: The Web3 Social Universe

**One app. 25 protocols. Your data, never sold.**

*Published: July 25, 2026*

---

We built DegenFeed because we were tired of tab-hopping between Nostr, Farcaster, Lens, Bluesky, Mastodon, and a dozen other places to see what was happening in web3 social. Every protocol has its own community, its own culture, and its own app — but your attention shouldn't have to fragment across all of them.

DegenFeed is the unification layer. One ranked feed that reads from every open protocol. One composer that posts to all of them at once. One wallet that tips across Ethereum, Solana, and Lightning. One click to launch your own creator coin.

## What It Does

### Unified Feed
Browse content from 25+ protocols in a single, ranked timeline. Nostr kind 1 notes, Farcaster casts, Lens publications, Bluesky posts, Mastodon toots, Threads threads, Reddit discussions, RSS feeds, YouTube videos, PeerTube streams — all normalized, deduplicated, and surfaced by a transparent 7-factor ranking algorithm that shows you *why* each post appears.

No account needed. Open [app.degenfeed.xyz](https://app.degenfeed.xyz) and start browsing.

### Cross-Protocol Composer
Write once, publish everywhere. Select which protocols to send your post to — Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Telegram, Discord, Matrix, GitHub, and more. Each post is signed client-side and delivered to each protocol's native API. Engagement aggregates: replies from any network appear in one thread.

### Creator Coins
Every creator can deploy their own ERC-20 token on Base or SPL token on Solana with one click. Sigmond bonding curve with 5 pricing eras. Built-in anti-bot, anti-whale, anti-rug protection: per-wallet caps, cooldowns, bundle detection, locked liquidity. Four vesting presets. Cross-chain registry.

### Cross-Chain Tipping
Tip creators in ETH (Base, Optimism, Arbitrum), SOL (native), USDC, or Lightning (Nostr zaps). Zero platform fees — tips go wallet-to-wallet. Batch tipping for up to 50 recipients. Streaming payments for livestreams. Unified leaderboard. All via audited smart contracts.

### Livestreaming & Audio Spaces
Stream to 7 protocols simultaneously. Solo streams, collaborative broadcasts, audio Spaces with up to 50 participants, or coin launch events with live minting. OBS-compatible RTMP keys. Auto-announced on Nostr (kind 30311), Farcaster (frames), Bluesky, Mastodon, and Telegram.

### Self-Hostable
The entire stack is one `docker compose up` away. Frontend, API, identity resolution, search — all self-contained. No cloud dependency. No vendor lock-in. If you can run a web server, you can run DegenFeed.

## Why We Built It

The decentralized social web has a fragmentation problem. There are amazing protocols — Nostr's relay architecture, Farcaster's hub network, Bluesky's AT Protocol, Lens's on-chain profiles, ActivityPub's federation — but each one lives in its own app. Creators who want to reach *all* of web3 have to manage 5+ accounts, 5+ posting workflows, and 5+ audiences.

This isn't sustainable. And it's not necessary.

DegenFeed exists because we believe in protocol pluralism. The future of social media isn't one protocol to rule them all — it's many protocols, connected by a layer that puts the *user* in control. You should be able to post from Nostr and see replies from Bluesky. You should be able to tip a Farcaster creator with Lightning. You should be able to launch one coin that works on both Base and Solana.

We built the tool we wanted: one that reads everything, posts everywhere, and owns nothing. Your content, your identity, your data — they belong to you.

## Technical Deep Dive

### Architecture

DegenFeed is a **Turborepo monorepo** with three layers:

1. **Edge Layer** — Cloudflare Workers (API + landing) + Cloudflare Pages (Next.js 16 client). 19 KV namespaces for cache, identity, coins, subscriptions, and cross-chain registry.
2. **Package Layer** — 30+ shared TypeScript packages. One SDK per protocol (nostr-sdk, farcaster-sdk, lens-sdk, bluesky-sdk, mastodon-sdk, threads-sdk, rss-sdk, etc.). Shared engines for feed normalization, ranking, identity resolution, tipping, creator coins, and real-time sync.
3. **Self-Hosted Layer** — GoToSocial (ActivityPub), AT Protocol PDS (Bluesky), PeerTube (video/streaming), Prosody XMPP (chat), MeiliSearch (search), all running on dedicated hardware.

### Protocol SDK Architecture

Each protocol gets its own SDK package with a consistent interface:

```typescript
interface ProtocolAdapter {
  readFeed(params: FeedParams): Promise<Post[]>;
  publishPost(content: Content): Promise<PostResult>;
  resolveProfile(identifier: string): Promise<Profile>;
  // + protocol-specific: tip, stream, coin deployment
}
```

This makes adding a new protocol a matter of implementing an interface — no core changes required.

### Feed Ranking

Every post is scored on a transparent model:

- **Recency (24%)** — 12-hour half-life decay. Posts under 15min get 2x freshness boost.
- **Engagement (35%)** — Weighted log-scale. Likes, replies, reposts, zaps all factored.
- **Relevance (18%)** — Keyword/niche/platform matching to user interests.
- **Quality (14%)** — Author reputation score, content length, media presence.
- **Diversity (10%)** — Penalty for seeing too many posts from the same author.
- **Source (8%)** — Protocol weight (Nostr = 1.0, Reddit = 0.8, RSS = 0.6, etc.).
- **Velocity (12%)** — Rate of engagement change (posts gaining traction fast rank higher).

All ranking code is open source and inspectable.

### Smart Contracts

| Contract | Chain | Purpose |
|----------|-------|---------|
| `DegenFeedCoin.sol` | Base | ERC-20 creator token with sigmoid bonding curve and vesting |
| `DegenFeedFactory.sol` | Base | Factory-deployed coins per creator |
| `CrossChainRegistry.sol` | Base | Protocol→chain→token mapping for cross-chain lookup |
| `DegenFeedTips.sol` | Base/Optimism/Arbitrum | 0% fee tipping contract |
| `degenfeed-creator-token` | Solana | SPL token program (Anchor Rust) |
| `DegenFeedCreatorToken` | Solana | Creator token with vesting (Anchor Rust) |

### Security

- **Client-side signing** — Protocol credentials never leave your browser. Posts are signed locally and broadcast directly to each protocol's network.
- **Audited contracts** — Tipping and creator coin contracts are audited. Liquidity is locked. No admin keys to drain.
- **Anti-exploit** — Three-phase protection on creator coins: per-wallet caps (2%/5%/10%), bundle detection, cooldown periods.
- **No backend database** — DegenFeed has no database of user content. We cache at the edge for aggregation; your data lives on the open protocols.

## Roadmap

### Q3 2026 (Now)
- ✅ Unified feed with 25+ protocols
- ✅ Cross-protocol composer (post to 15+ protocols simultaneously)
- ✅ Creator coins on Base and Solana
- ✅ Cross-chain tipping (ETH, SOL, USDC, Lightning)
- ✅ Livestreaming + Audio Spaces
- ✅ Self-hostable deployment
- 🚧 Feddy Communities v2 (token-gated, DAO governance)
- 🚧 Mobile native apps (iOS + Android via Capacitor)

### Q4 2026
- **Feddy Communities** — Cross-protocol communities with token gating and on-chain governance
- **DegenFeed Mobile** — Native iOS and Android apps
- **Protocol Plugin SDK** — Third-party developers can write protocol adapters without forking the repo
- **Reputation System** — 7-tier gamified reputation with tier-based benefits
- **Advanced Analytics** — Creator dashboards with cross-protocol metrics
- **Post Scheduling** — Timezone-aware scheduled posts with recurring schedules

### 2027
- **DegenFeed Protocol** — A native protocol for cross-protocol engagement aggregation
- **Federated Identity** — Self-sovereign identity with cross-protocol verification
- **AI Feed Curation** — Opt-in ML-based feed personalization (privacy-preserving, on-device)

## How to Get Started

1. **Browse** — Open [app.degenfeed.xyz](https://app.degenfeed.xyz). No account needed.
2. **Connect** — Sign in with any EVM or Solana wallet.
3. **Link** — Connect your Nostr, Farcaster, Lens, Bluesky, or Mastodon accounts in Settings.
4. **Post** — Write your first cross-protocol post.
5. **Explore** — Check Trending, News, Discover, and the Live page.
6. **Self-host** — `git clone` + `docker compose up -d` for your own instance.

## The Mission

> "DegenFeed exists to unify the fragmented decentralized social web. We don't own your content — we give you the tools to own it yourself."

We're fighting for:
- **Data independence** — Your data is yours. Never sold. Never tracked. Never monetized.
- **Creator ownership** — Own your audience, your content, your revenue. No platform takes a cut.
- **Network sovereignty** — No one can deplatform you. Your identity lives on open protocols. Self-host if you want.

## Join Us

- **App:** [app.degenfeed.xyz](https://app.degenfeed.xyz)
- **Docs:** [docs.degenfeed.xyz](https://docs.degenfeed.xyz)
- **Source:** [git.rugmunch.io/RugMunchMedia/degenfeed-web](https://git.rugmunch.io/RugMunchMedia/degenfeed-web)
- **Email:** admin@rugmunch.io

DegenFeed is open source (AGPL-3.0), self-funded, and built by Rug Munch Media LLC. Contributions welcome.

---

*"The future of social media is decentralized. DegenFeed is your window into it."*
