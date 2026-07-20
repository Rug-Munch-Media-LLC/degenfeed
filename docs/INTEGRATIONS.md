# DegenFeed Protocol Integration Guide

Detailed integration documentation for every protocol supported by DegenFeed. Each section covers supported features, connection methods, API endpoints, limitations, and bridge directions.

---

## Table of Contents

1. [Nostr](#1-nostr)
2. [Farcaster / Warpcast](#2-farcaster--warpcast)
3. [Bluesky (AT Protocol)](#3-bluesky-at-protocol)
4. [Mastodon / GoToSocial](#4-mastodon--gotosocial)
5. [Lens Protocol](#5-lens-protocol)
6. [Threads (Instagram)](#6-threads-instagram)
7. [Twitter / X](#7-twitter--x)
8. [Reddit](#8-reddit)
9. [RSS / Atom](#9-rss--atom)
10. [PeerTube](#10-peertube)
11. [YouTube](#11-youtube)
12. [Lemmy](#12-lemmy)
13. [Telegram](#13-telegram)
14. [Zora](#14-zora)
15. [Solana](#15-solana)

---

## 1. Nostr

**Package:** `packages/nostr-sdk`
**Worker Routes:** `routes/feed.ts`, `routes/post.ts`, `routes/tip.ts`, `routes/stream.ts`

### Supported Features

| Feature | Status | Details |
|---------|--------|---------|
| Feed Reading | ✅ | Reads from relay pool (nos.lol, damus.io, etc.) |
| Posting | ✅ | Client signs event, server relays |
| Tipping | ✅ | Lightning Network via NIP-57 zaps |
| Identity | ✅ | npub → wallet resolution via profile metadata |
| Livestream | ✅ | Announces via kind 30311 events |
| Audio Spaces | ✅ | Cross-protocol space broadcasting |
| Replying | ✅ | Cross-protocol reply bridging |

### Connection Methods

| Method | How It Works |
|--------|-------------|
| **Extension** (nos2x, Alby) | Browser extension signs events locally |
| **nsec** | Direct key entry (stored encrypted in KV) |
| **Read-only (npub)** | Feed reading only, no posting |

### API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `wss://relay.damus.io` | Primary relay |
| `wss://nos.lol` | Secondary relay |
| `wss://relay.nostr.band` | Search support |
| Additional relays | Configurable via relay pool |

### SDK Methods

```typescript
import { RelayPool, NostrEvent } from '@degenfeed/nostr-sdk';

// Connect to relay pool
const pool = new RelayPool(['wss://relay.damus.io', 'wss://nos.lol'], {
  eoseTimeout: 4000,
});

// Fetch feed
const events = await pool.query({ kinds: [1], limit: 50 });

// Publish event
await pool.publish(event);

// Disconnect
pool.disconnectAll();
```

### NIP Support

| NIP | Description | Supported |
|-----|-------------|-----------|
| NIP-01 | Basic protocol | ✅ Feed, metadata |
| NIP-05 | DNS identifiers | ✅ Identity resolution |
| NIP-19 | bech32 encoding | ✅ npub, nsec, note |
| NIP-57 | Lightning zaps | ✅ Tipping |
| NIP-65 | Relay lists | ✅ Read/write relay discovery |
| NIP-30311 | Live events | ✅ Livestream announcements |

### Known Issues / Limitations

- Client must sign events locally for posting
- Relays may have different retention policies
- Search depends on relay support (nostr.band recommended)
- Zaps require Lightning wallet configuration
- No native content moderation at protocol level

### Bridge Directions

| From | To | Method |
|------|----|--------|
| Nostr | Farcaster | Cross-protocol bridge engine |
| Nostr | Bluesky | Cross-protocol bridge engine |
| Nostr | Mastodon | Cross-protocol bridge engine |
| Nostr | Lens | Cross-protocol bridge engine |
| Farcaster | Nostr | Cross-protocol bridge engine |
| Mastodon | Nostr | ActivityPub → Nostr bridge |

---

## 2. Farcaster / Warpcast

**Package:** `packages/farcaster-sdk`
**Worker Routes:** `routes/farcaster-feed.ts`, `routes/farcaster-coin.ts`, `routes/farcaster-frames.ts`

### Supported Features

| Feature | Status | Details |
|---------|--------|---------|
| Feed Reading | ✅ | Reads from Hub gRPC API |
| Posting | ✅ | Signed messages submitted to Hub |
| Tipping | ✅ | Via creator coins on Base |
| Creator Coin | ✅ | Deploy ERC-20 on Base via factory |
| Livestream | ✅ | Announces via Farcaster frames |
| Audio Spaces | ✅ | Cross-protocol space broadcasting |
| Frames | ✅ | Parse and submit frame actions |

### Connection Methods

| Method | How It Works |
|--------|-------------|
| **Warpcast login** | OAuth-style sign-in with Warpcast |
| **Signer** | App key generated via Warpcast |
| **Read-only (FID)** | Feed reading only |

### API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `https://hub.farcaster.standardcrypto.vc:2281` | Primary Hub (gRPC + REST) |
| `https://api.warpcast.com` | Warpcast API for auth |

### Creator Coins on Farcaster

Farcaster creators can deploy coins directly from DegenFeed:

1. Coin contract deployed on **Base** via `DegenFeedFactory`
2. Auto-wrapped for Zora visibility
3. Announced via Farcaster frame
4. Registered in `FARCASTER_COINS` KV
5. Linked in `XCHAIN_REGISTRY` KV

**KV Schema:**
```
farcaster:coin:{fid}   → { coinAddress, tokenId, symbol, name, deployedAt, chainId }
farcaster:link:{fid}   → { linkedAddresses[] }
```

### Frames Support

- **Parse frames** — Extract `<meta>` tags from URLs
- **Submit actions** — POST frame button interactions
- **Frame validation** — Verify frame signatures

### Known Issues / Limitations

- Requires active Warpcast account with FID
- Hub connectivity may degrade; multiple hub fallbacks recommended
- Frame actions limited to what Farcaster protocol supports
- Coin deployment requires ETH on Base for gas
- Rate limits apply per FID for Hub requests

### Bridge Directions

| From | To | Method |
|------|----|--------|
| Farcaster | Nostr | Cross-protocol bridge engine |
| Farcaster | Bluesky | Cross-protocol bridge engine |
| Farcaster | Mastodon | Cross-protocol bridge engine |
| Farcaster | Lens | Cross-protocol bridge engine |
| Farcaster | Base (Coin) | Auto-wrap to ERC-20 |
| Farcaster | Zora (NFT) | Creator coin auto-wrap |

---

## 3. Bluesky (AT Protocol)

**Package:** `packages/bluesky-sdk`
**Worker Routes:** `routes/feed.ts`, `routes/post.ts`, `routes/bluesky-tip.ts`, `routes/bluesky-feed-generator.ts`

### Supported Features

| Feature | Status | Details |
|---------|--------|---------|
| Feed Reading | ✅ | Via public.api.bsky.app + own PDS |
| Posting | ✅ | Via com.atproto.repo.createRecord |
| Tipping | ✅ | Via Lightning address in profile |
| Identity | ✅ | Handle → DID resolution |
| Livestream | ✅ | Announces via Bluesky posts |
| Audio Spaces | ✅ | Cross-protocol space broadcasting |
| Feed Generator | ✅ | Custom Bluesky feed generation |

### Connection Methods

| Method | How It Works |
|--------|-------------|
| **Handle + App Password** | Creates session via PDS |
| **Read-only (handle/DID)** | Public data access |

### API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `https://public.api.bsky.app` | Public API for feed |
| `https://bsky.social` | PDS for authenticated actions |
| `pds.degenfeed.xyz` | Self-hosted PDS for DegenFeed users |
| `https://plc.directory` | DID resolution |

### Self-Hosted PDS

DegenFeed runs a Bluesky PDS at `pds.degenfeed.xyz`. This provides:

- Faster feed access for DegenFeed users
- Higher rate limits than public endpoints
- Invite code pool management

### Known Issues / Limitations

- App password required for posting (not main password)
- Public API rate limited without authentication
- Federation delays may affect feed freshness
- Tip resolution requires profile `labels` field
- Feed generator requires separate Bluesky feed configuration

### Bridge Directions

| From | To | Method |
|------|----|--------|
| Bluesky | Nostr | Cross-protocol bridge engine |
| Bluesky | Farcaster | Cross-protocol bridge engine |
| Bluesky | Mastodon | Cross-protocol bridge engine |

---

## 4. Mastodon / GoToSocial

**Package:** `packages/mastodon-sdk`
**Worker Routes:** `routes/feed.ts`, `routes/mastodon-tip.ts`

### Supported Features

| Feature | Status | Details |
|---------|--------|---------|
| Feed Reading | ✅ | ActivityPub via Mastodon API |
| Posting | ✅ | POST /api/v1/statuses |
| Tipping | ✅ | Via Lightning address in profile |
| Livestream | ✅ | PeerTube streams federated via ActivityPub |
| Audio Spaces | ✅ | Cross-protocol space broadcasting |
| Identity | ✅ | @user@instance resolution |

### Connection Methods

| Method | How It Works |
|--------|-------------|
| **Instance + Token** | OAuth2 or access token |
| **DegenFeed GoToSocial** | Built-in instance at social.degenfeed.xyz |

### Self-Hosted GoToSocial

DegenFeed runs GoToSocial at **social.degenfeed.xyz**. Users can create accounts directly or use their own Mastodon instance.

### API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `social.degenfeed.xyz/api/v1/timelines/home` | Home feed |
| `social.degenfeed.xyz/api/v1/timelines/public` | Public timeline |
| `social.degenfeed.xyz/api/v1/statuses` | Posting |
| `social.degenfeed.xyz/api/v1/notifications` | Notifications |
| `social.degenfeed.xyz/api/v1/follows` | Following management |

### Known Issues / Limitations

- Different Mastodon instances may have different API versions
- Media upload size limits vary by instance
- GoToSocial has a subset of Mastodon API endpoints
- Tip resolution requires parsing profile metadata
- ActivityPub federation can have propagation delays

### Bridge Directions

| From | To | Method |
|------|----|--------|
| Mastodon | Nostr | ActivityPub → Nostr |
| Mastodon | Farcaster | Cross-protocol bridge |
| Mastodon | Bluesky | Cross-protocol bridge |
| Mastodon | PeerTube | ActivityPub federation (native) |

---

## 5. Lens Protocol

**Package:** `packages/lens-sdk`
**Worker Routes:** `routes/lens.ts`, `routes/lens-coin.ts`

### Supported Features

| Feature | Status | Details |
|---------|--------|---------|
| Feed Reading | ✅ | Lens API v2 (GraphQL) |
| Posting | ✅ | Create publication on Lens |
| Tipping | ✅ | Lens Collect with revenue split |
| Creator Coin | ✅ | Deploy on Polygon, bridge to Base + Solana |
| Audio Spaces | ✅ | Cross-protocol space broadcasting |
| Identity | ✅ | Lens handle → profile ID resolution |

### Connection Methods

| Method | How It Works |
|--------|-------------|
| **Wallet signature** | Sign with wallet for Lens Hub API |

### API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `https://api-v2.lens.dev/graphql` | Lens Hub GraphQL API |
| `https://api-v2-mumbai.lens.dev/graphql` | Testnet |

### Creator Coins on Lens

Lens creators can deploy coins directly from DegenFeed:

1. Coin contract deployed on **Polygon** (Lens native)
2. Optionally bridged to **Base** and **Solana**
3. Wrapped for Zora visibility
4. Registered in `LENS_COINS` KV

**KV Schema:**
```
lens:coin:{profileId}   → { coinAddress, tokenId, symbol, name, deployedAt, chainId }
lens:link:{profileId}   → { linkedAddresses[] }
```

### Known Issues / Limitations

- Requires active Lens profile
- Lens V2 API is GraphQL-only
- Posting requires momoka or on-chain transaction
- Collect actions require wallet signatures
- Lens API v2 may have breaking changes

### Bridge Directions

| From | To | Method |
|------|----|--------|
| Lens | Nostr | Cross-protocol bridge |
| Lens | Farcaster | Cross-protocol bridge |
| Lens | Base (Coin) | Wormhole bridge |
| Lens | Solana (Coin) | Wormhole bridge |
| Lens | Zora (NFT) | Wrapping |

---

## 6. Threads (Instagram)

**Package:** `packages/threads-sdk`
**Worker Routes:** `routes/feed.ts`, `routes/post.ts`

### Supported Features

| Feature | Status | Details |
|---------|--------|---------|
| Feed Reading | ✅ | Via public Threads API |
| Posting | ✅ | OAuth-based posting |
| Identity | ✅ | Handle resolution |

### Connection Methods

| Method | How It Works |
|--------|-------------|
| **OAuth** | Instagram/Threads OAuth flow |

### API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `https://public.threads.net` | Public API |

### Known Issues / Limitations

- Experimental: requires explicit opt-in
- Limited API compared to other protocols
- Threads API is relatively new and may change
- Rate limiting from Meta's API
- No tipping support
- No real-time feed updates

### Bridge Directions

| From | To | Method |
|------|----|--------|
| Threads | Nostr | Cross-protocol bridge |
| Threads | Farcaster | Cross-protocol bridge |

---

## 7. Twitter / X

**SDK:** Inline in `workers/api/src/routes/feed.ts`
**Status:** Read-only

### Supported Features

| Feature | Status | Details |
|---------|--------|---------|
| Feed Reading | ✅ | Via Twitter API v2 |
| Posting | ❌ | Not supported (API restrictions) |
| Tipping | ❌ | Not supported |

### Connection Methods

| Method | How It Works |
|--------|-------------|
| **OAuth 2.0** | Twitter API v2 OAuth |

### Known Issues / Limitations

- Read-only due to Twitter API restrictions
- Free API tier has very limited access
- Posting, liking, and replying not available
- No identity linking on Twitter side

---

## 8. Reddit

**SDK:** Inline in `workers/api/src/routes/feed.ts`
**Status:** Read-only

### Supported Features

| Feature | Status | Details |
|---------|--------|---------|
| Feed Reading | ✅ | Via Redlib or Reddit API |
| Posting | ❌ | Not supported |
| Tipping | ❌ | Not supported |

### Connection Methods

| Method | How It Works |
|--------|-------------|
| **Public API** | Via Redlib proxy or Reddit JSON |

### Self-Hosted Redlib

DegenFeed runs Redlib at **redlib.degenfeed.xyz** for privacy-respecting Reddit access.

### Known Issues / Limitations

- Read-only
- Redlib may have rendering differences from Reddit
- No cross-protocol identity linking

---

## 9. RSS / Atom

**Package:** `packages/rss-sdk`
**Worker Routes:** `routes/rss.ts`, `routes/news.ts`

### Supported Features

| Feature | Status | Details |
|---------|--------|---------|
| Feed Reading | ✅ | 353+ curated RSS sources |
| Posting | ❌ | N/A |
| Tipping | ❌ | N/A |
| News Curation | ✅ | Category-based news aggregation |

### Source Categories

| Category | # Sources | Examples |
|----------|-----------|----------|
| DeFi | 45+ | DefiLlama, Uniswap Blog, Curve |
| AI | 30+ | OpenAI Blog, Hugging Face |
| Bitcoin | 40+ | Bitcoin Magazine, Mempool |
| Ethereum | 50+ | Ethereum Blog, ETHResearch |
| Solana | 25+ | Solana Blog, SolanaFM |
| Security | 20+ | Trail of Bits, OpenZeppelin |
| Macro | 15+ | Federal Reserve, IMF |
| General Crypto | 80+ | CoinDesk, The Block |
| Technology | 30+ | Hacker News, Ars Technica |

### RSS-Bridge

DegenFeed runs **RSS-Bridge** at `rss-bridge.degenfeed.xyz` to generate RSS feeds for sites that don't natively support them.

### Known Issues / Limitations

- RSS feeds vary in quality and reliability
- Some feeds may have inconsistent update schedules
- No authentication or private feeds
- Content is text-only (no embedded media)

---

## 10. PeerTube

**Package:** `packages/peertube-provider`
**Worker Routes:** `routes/peertube-streams.ts`, `routes/peertube-tip.ts`

### Supported Features

| Feature | Status | Details |
|---------|--------|---------|
| Feed Reading | ✅ | Via PeerTube API |
| Posting | ✅ | OAuth2-based |
| Tipping | ✅ | Via Lightning |
| Livestream | ✅ | Native PeerTube live streaming |
| Video Hosting | ✅ | Self-hosted at video.degenfeed.xyz |

### Connection Methods

| Method | How It Works |
|--------|-------------|
| **OAuth2** | PeerTube OAuth |

### Self-Hosted PeerTube

DegenFeed runs **PeerTube** at **video.degenfeed.xyz** for video hosting and livestreaming.

### Livestream Integration

```typescript
// Start a livestream
POST /api/token/:address/peertube/start
{
  "title": "My Stream",
  "description": "Stream description",
  "category": "crypto"
}

// Response
{
  "rtmpUrl": "rtmp://video.degenfeed.xyz/live",
  "rtmpKey": "abc-123-def",
  "streamUrl": "https://video.degenfeed.xyz/w/xyz",
  "streamId": "uuid"
}
```

### Cross-Protocol Announcements

When a PeerTube stream starts, DegenFeed announces across:
1. **ActivityPub** — GoToSocial auto-federates PeerTube content
2. **Nostr** — kind 30311 event
3. **AT Protocol** — Bluesky post with link
4. **Farcaster** — Embeddable frame
5. **Telegram** — Bot notification to subscribers

### Chat System

Chat is powered by **Prosody XMPP** at `chat.degenfeed.xyz`:

- Real-time WebSocket-based chat
- Integrated into the stream player
- Cross-protocol chat bridging via bridged rooms

### Known Issues / Limitations

- Requires OBS or compatible encoder for streaming
- RTMP key must be kept private
- Stream recording saved after stream ends
- Video transcoding can introduce delay
- Self-hosted PeerTube requires adequate bandwidth

### Bridge Directions

| From | To | Method |
|------|----|--------|
| PeerTube | Mastodon | ActivityPub federation (native) |
| PeerTube | Nostr | kind 30311 bridge |
| PeerTube | Bluesky | AT Protocol bridge |
| PeerTube | Farcaster | Frame bridge |
| PeerTube | Telegram | Bot notification |

---

## 11. YouTube

**SDK:** Inline in `workers/api/src/routes/youtube.ts`
**Worker Routes:** `routes/youtube.ts`, `routes/feed.ts`

### Supported Features

| Feature | Status | Details |
|---------|--------|---------|
| Feed Reading | ✅ | Via YouTube Data API v3 |
| Posting | ❌ | Not supported |
| Tipping | ❌ | Not supported |
| Trending | ✅ | YouTube trending integration |

### Connection Methods

| Method | How It Works |
|--------|-------------|
| **YouTube Data API v3** | With API key |

### API Endpoints Used

The YouTube fetcher (in `workers/api/src/feed/youtube-fetcher.ts`) aggregates:
- Trending videos
- Recommended videos
- Channel-specific feeds

### Known Issues / Limitations

- YouTube Data API has daily quota limits
- Read-only: no posting, commenting, or interaction
- Video playback is external (links to YouTube)
- No real-time updates

---

## 12. Lemmy

**Worker Routes:** `routes/lemmy-discover.ts`, `routes/lemmy-tip.ts`

### Supported Features

| Feature | Status | Details |
|---------|--------|---------|
| Feed Reading | ✅ | Via Lemmy API |
| Posting | ❌ | Coming soon |
| Tipping | ✅ | Via Lightning in profile |

### Connection Methods

| Method | How It Works |
|--------|-------------|
| **Public API** | Read from public Lemmy instances |

### Known Issues / Limitations

- Read-only (posting not yet implemented)
- Different Lemmy instances have different communities
- Identity resolution requires instance-specific accounts

---

## 13. Telegram

**Package:** `packages/telegram-sdk`
**Worker Routes:** Integrated via bot

### Supported Features

| Feature | Status | Details |
|---------|--------|---------|
| Feed Reading | ✅ | Via @DegenFeedBot |
| Posting | ✅ | Via bot in connected chats |
| Notifications | ✅ | Cross-protocol notification delivery |
| Livestream Alerts | ✅ | Live stream start notifications |

### Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Initialize bot connection |
| `/feed` | Get latest posts from feed |
| `/subscribe` | Subscribe to creator alerts |
| `/notifications` | Configure notification types |

### SDK Features

```typescript
import { TelegramClient } from '@degenfeed/telegram-sdk';

// Send a message (Markdown support)
await client.sendMessage(chatId, text, { parse_mode: 'Markdown' });

// Send media
await client.sendPhoto(chatId, photoUrl, { caption: 'Photo caption' });
```

### Known Issues / Limitations

- Bot-initiated messages only (user must start the bot)
- Media size limits apply (50MB max)
- Rate limited by Telegram Bot API
- No tipping support

---

## 14. Zora

**SDK:** `packages/zora-sdk` (Creator Token SDK)

### Supported Features

| Feature | Status | Details |
|--------|--------|---------|
| Creator Coins | ✅ | Deploy, trade, wrap |
| NFT Wrapping | ✅ | Token → NFT conversion |
| Cross-Chain Registration | ✅ | Protocol-to-chain mapping |

### Zora SDK Methods

The full Creator Token SDK is documented in the package at `packages/zora-sdk/src/index.ts`:

```typescript
import { CreatorTokenSDK, getDynamicPrice, getEraName } from '@degenfeed/zora-sdk';

// Bonding curve pricing
const price = getDynamicPrice(currentSupply);
const era = getEraName(currentSupply); // "Steal Deal" | "Early Bird" | ...

// Trade calculations
const tokensOut = calculateTokensOut(amountEth, currentSupply);
const ethOut = calculateEthOut(tokensIn, currentSupply);

// Anti-exploit
const limits = getPhaseLimits(elapsedSeconds);
const canBuy = checkBuyLimit(elapsedSeconds, attemptedAmount);

// Gamification
const badges = computeBadges(transactions);
const milestones = getReachedMilestones(totalSupply);
const discount = applyFlashSaleDiscount(price, currentSupply);
```

### Vesting Configurations

| Preset | Initial Unlock | Cliff | Duration | Min Reputation |
|--------|---------------|-------|----------|----------------|
| Trustless | 0% | 30 days | 90 days | 0 |
| Balanced | 5% | 7 days | 60 days | 25 |
| Community | 10% | 0 days | 30 days | 50 |
| Fast | 20% | 0 days | 7 days | 75 |

### Cross-Chain Registry

```typescript
import { CrossChainRegistry } from '@degenfeed/zora-sdk';

const registry = new CrossChainRegistry(kvStore);

// Register a mapping
await registry.register({
  protocol: 'farcaster',
  chain: 'base',
  tokenAddress: '0x...',
  creatorAddress: '0x...',
});

// Resolve
const mapping = await registry.resolve('farcaster', 'base', '0x...');
```

### Known Issues / Limitations

- ERC-20 on Base is the primary deployment target
- Solana support via Anchor program (Solana deployment requires SOL for rent)
- Zora wrapping incurs additional gas costs
- Cross-chain bridging uses Wormhole (bridge fees apply)

---

## 15. Solana

**SDK:** `packages/zora-sdk/src/solana.ts`, `packages/solana-programs/`

### Supported Features

| Feature | Status | Details |
|---------|--------|---------|
| Creator Coins | ✅ | SPL Token via Anchor program |
| Tipping | ✅ | Native SOL tips |
| Identity | ✅ | Solana wallet as primary identity |
| Cross-Chain | ✅ | Wormhole bridge to EVM |

### Program Addresses

| Program | Address | Description |
|---------|---------|-------------|
| `degenfeed-creator-token` | TBD | SPL token program with bonding curve |

### SDK Methods

```typescript
import { SolanaCreatorTokenSDK, deriveTokenState } from '@degenfeed/zora-sdk';

const sdk = new SolanaCreatorTokenSDK(connection);

// Derive PDAs
const tokenState = deriveTokenState(mint);
const tokenMint = deriveTokenMint(authority);
const vault = deriveTokenVault(mint);

// Deploy token
await sdk.initializeToken(name, symbol, uri, feeRecipient);

// Trade
await sdk.buy(tokenAddress, amount, maxPrice);
await sdk.sell(tokenAddress, amount, minPrice);
```

### Known Issues / Limitations

- Solana deployment requires SOL for rent exemption
- Token accounts must be created before receiving tokens
- Current Solana support is in development (TBD program addresses)
- Cross-chain bridging via Wormhole requires bridge fees
- Anchor program version must match deployment target

---

## Cross-Protocol Tipping Matrix

| Tippee ╲ Tipper | Nostr | Farcaster | Bluesky | Mastodon | Lens | PeerTube | Lemmy |
|-----------------|-------|-----------|---------|----------|------|----------|-------|
| **Nostr** | ⚡ LN | ⚡ LN | ⚡ LN | ⚡ LN | ⚡ LN | ⚡ LN | ⚡ LN |
| **Farcaster** | 💰 ETH | 💰 ETH | 💰 ETH | 💰 ETH | 💰 ETH | 💰 ETH | 💰 ETH |
| **Bluesky** | ⚡ LN | ⚡ LN | ⚡ LN | ⚡ LN | ⚡ LN | ⚡ LN | ⚡ LN |
| **Mastodon** | ⚡ LN | ⚡ LN | ⚡ LN | ⚡ LN | ⚡ LN | ⚡ LN | ⚡ LN |
| **Lens** | 📼 Collect | 📼 Collect | 📼 Collect | 📼 Collect | 📼 Collect | 📼 Collect | 📼 Collect |
| **Any (Coin)** | 🪙 Coin | 🪙 Coin | 🪙 Coin | 🪙 Coin | 🪙 Coin | 🪙 Coin | 🪙 Coin |

**Key:**
- ⚡ LN — Lightning Network (instant, low fee)
- 💰 ETH — EVM chain (Base/Optimism/Arbitrum via DegenFeedTips)
- 📼 Collect — Lens Collect action
- 🪙 Coin — Creator coin transfer (any chain)

---

## Cross-Protocol Bridge Engine

Located at `workers/api/src/lib/cross-protocol-bridge-engine.ts`, the bridge engine handles content movement between protocols:

### Wrap (Content Bridging)

Takes content from one protocol and posts it to another:

```
Source (Nostr note) → Bridge Engine → Target (Farcaster cast)
```

### Zora Wrap

Converts protocol content into a Zora creator coin:

```
Source (Farcaster cast) → Bridge Engine → Zora Creator Coin NFT
```

### Sync

Propagates edits from one protocol to all bridged copies:

```
Edit on Nostr → Bridge Engine → Update Farcaster + Bluesky copies
```

### Reliability

Bridge reliability is managed by `workers/api/src/lib/bridge-reliability.ts`:

- Retry with exponential backoff
- Dead-letter queue for failed bridges
- Health monitoring per bridge direction

---

## Self-Hosted Infrastructure Summary

| Service | URL | Purpose | Running On |
|---------|-----|---------|------------|
| **GoToSocial** | social.degenfeed.xyz | ActivityPub server | Docker |
| **AT Protocol PDS** | pds.degenfeed.xyz | Bluesky PDS | Docker |
| **PeerTube** | video.degenfeed.xyz | Video + livestreams | Docker |
| **Redlib** | redlib.degenfeed.xyz | Privacy Reddit proxy | Docker |
| **RSS-Bridge** | rss-bridge.degenfeed.xyz | RSS generation | Docker |
| **Prosody XMPP** | chat.degenfeed.xyz | Stream chat | Docker |

---

*Questions? Join our [Developer Community](https://app.degenfeed.xyz/c/developers). Report issues on [Forgejo](https://git.rugmunch.io/RugMunchMedia/degenfeed-web).*
