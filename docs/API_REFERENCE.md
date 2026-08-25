# DegenFeed API Reference

**Base URL:** `https://degenfeed.xyz/v1/`  
**Status:** Stable  
**API Routes:** ~500+ across 90+ route modules and 31 major endpoint categories  
**Protocols Covered:** 44+  
**Packages:** 43+ shared TypeScript packages  
**Legacy `/api/` routes deprecated — sunset November 1, 2026**  
**Authentication:** All v1 endpoints require an API key in the `Authorization` header

Access the full power of DegenFeed programmatically: feed aggregation across 44+ protocols, cross-protocol posting, identity resolution, tipping, creator coins (Base + Solana), livestreaming, audio spaces, community management, short-form video, analytics, and more.

All endpoints return JSON. Timestamps are in milliseconds since Unix epoch unless noted.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Rate Limiting](#rate-limiting)
3. [Feed Endpoints](#feed-endpoints)
4. [Search Endpoints](#search-endpoints)
5. [Identity & Profiles](#identity--profiles)
6. [Tipping](#tipping)
7. [Publishing](#publishing)
8. [Engagement](#engagement)
9. [Communities](#communities)
10. [Spaces (Audio)](#spaces-audio)
11. [Creator Coins](#creator-coins)
12. [Livestreaming](#livestreaming)
13. [Video Hub](#video-hub)
14. [Short-Form Video](#short-form-video)
15. [Visual Feed](#visual-feed)
16. [Leaderboards](#leaderboards)
17. [Notifications](#notifications)
18. [Content Resolution](#content-resolution)
19. [Health & Status](#health--status)
20. [Cross-Protocol Bridge](#cross-protocol-bridge)
21. [Analytics](#analytics)
22. [Admin](#admin)
23. [Preferences](#preferences)
24. [Messaging](#messaging)
25. [Recommendations](#recommendations)
26. [Moderation](#moderation)
27. [Reputation](#reputation)
28. [Account & Auth](#account--auth)
29. [YouTube](#youtube)
30. [Prices](#prices)
31. [Other Endpoints](#other-endpoints)
32. [WebSocket / Real-Time](#websocket--real-time)
33. [Matrix Bridge Hub](#matrix-bridge-hub)

---

## Authentication

### API Keys

All v1 endpoints require an API key in the `Authorization` header:

```
Authorization: Bearer df_key_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Generate an API key from your [profile settings](https://app.degenfeed.xyz/profile/settings/api).

### Scopes

| Scope | Permission | Endpoints |
|-------|-----------|-----------|
| `read:feed` | Read feeds and search posts | Feed, search, discover, prices |
| `write:posts` | Publish and engage | Publish, engage (session required) |
| `read:identity` | Resolve identities | Identity resolution, profiles |
| `write:tip` | Send tips | Tip creation, invoices |
| `read:analytics` | Read analytics | Analytics endpoints |

### Error Responses

```json
// 401 — Invalid key
{ "error": "Invalid or revoked API key" }

// 403 — Insufficient scope
{ "error": "Missing required scopes: write:tip" }
```

### Session Authentication (Browser)

Browser clients use cookie-based session auth via `__Host-dfid` (HMAC-SHA256 signed). Sessions are created via wallet sign-in.

### Admin Authentication

Admin routes additionally check wallet address against `ADMIN_WALLETS`. Returns 403 if the authenticated wallet is not an admin.

---

## Rate Limiting

| Tier | Rate Limit | Window |
|------|-----------|--------|
| Free | 1,000 req | 1 hour |
| Premium | 10,000 req | 1 hour |

Per-endpoint rate limits (Next.js middleware):

| Path | Method | Limit | Window |
|------|--------|-------|--------|
| `/api/auth/*` | POST | 5 req | 60s |
| `/api/tip/create` | POST | 10 req | 60s |
| `/api/publish` | POST | 20 req | 60s |
| `/api/admin/*` | POST | 20 req | 60s |
| All others POST/PUT/DELETE | — | 30 req | 60s |
| All other `/api/*` | GET | 100 req | 60s |

When exceeded, returns 429 with Retry-After header:

```json
{
  "error": "Rate limit exceeded",
  "retryAfterMs": 1800000,
  "tier": "free",
  "limit": 1000,
  "window": "1h"
}
```

---

## Feed Endpoints

All feed endpoints require scope `read:feed`.

### GET /v1/feed/home

Aggregated and ranked feed from 44+ connected protocols and services (11 standardized bridge providers + Matrix bridge hub + ActivityPub federation + API integrations).

**Query Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `protocols` | string | Comma-separated: `nostr,farcaster,lens,bluesky,mastodon,lemmy,reddit,rss` |
| `sort` | string | `scored` \| `hot` \| `new` \| `top` |
| `limit` | number | 1–200 posts per page (default 50) |
| `category` | string | Filter: `defi`, `ai`, `bitcoin`, `ethereum`, `solana`, `security`, `macro` |
| `cursor` | string | Pagination cursor timestamp |

**Request:**
```
GET /v1/feed/home?protocols=nostr,farcaster&sort=hot&limit=10
```

**Response:**
```json
{
  "posts": [
    {
      "id": "nostr:note1...",
      "protocol": "nostr",
      "author": { "handle": "alice", "protocol": "nostr" },
      "content": "Bitcoin is the future of money.",
      "score": 89.4,
      "engagement": { "likes": 42, "replies": 7, "reposts": 12 },
      "timestamp": 1720000000000
    }
  ],
  "cursor": "1720000100000"
}
```

### GET /v1/feed/trending

Trending posts by engagement velocity.

**Query Parameters:**
- `protocols` — Comma-separated protocol filter
- `category` — Niche category filter
- `limit` — 1–200 (default 50)
- `cursor` — Pagination cursor

### GET /v1/feed/news

Curated news feed from 353+ RSS sources.

**Query Parameters:**
- `limit` — 1–200 (default 50)
- `cursor` — Pagination cursor
- `category` — News category filter

### GET /v1/feed/stream

Server-Sent Events real-time feed stream.

### GET /v1/feed/post/:postId

Single post by canonical ID.

### GET /v1/feed/post/:postId/replies

Thread / reply context for a post.

### GET /v1/feed/related

Related posts by niche overlap + time proximity.

**Query Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | ✅ | Post ID |
| `limit` | number | — | Max results (default 10) |

### GET /v1/feed/:protocol

Per-protocol feed.

Supported protocols: `nostr`, `farcaster`, `lens`, `bluesky`, `mastodon`, `lemmy`, `reddit`, `rss`.

### GET /v1/feed/category/:category

Filter by niche category.

Supported categories: `defi`, `ai`, `bitcoin`, `ethereum`, `solana`, `security`, `macro`.

### GET /v1/feed/presets

Available feed presets.

### GET /v1/feed/for-you

Personalized recommendation feed based on user engagement signals.

### GET /v1/feed/home (Next.js API)

**Route:** `/api/feed/home`

Proxied to worker. Returns unified home feed.

### GET /v1/api/feed/health

Feed pipeline health check.

### GET /v1/api/feed/news

News feed from RSS sources.

---

## Search Endpoints

Require scope `read:feed`.

### GET /v1/search

Cross-protocol text search.

**Query Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `q` | string | ✅ | Search query |
| `protocols` | string | — | Comma-separated protocol filter |
| `limit` | number | — | Max results (default 25) |

**Request:**
```
GET /v1/search?q=bitcoin&protocols=nostr,farcaster&limit=10
```

**Response:**
```json
{
  "results": [
    {
      "id": "farcaster:0x...",
      "protocol": "farcaster",
      "content": "...",
      "author": { "handle": "bob" },
      "score": 0.95
    }
  ],
  "total": 42
}
```

### GET /v1/search/identity

Search for identities across protocols. Requires scope `read:identity`.

### POST /api/search

**Route:** `/api/search` (Next.js proxy)

---

## Identity & Profiles

Require scope `read:identity`.

### GET /v1/identity/resolve

Resolve a handle across protocols.

**Query Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `handle` | string | ✅ | Handle to resolve (e.g. `vitalik.eth`) |

**Request:**
```
GET /v1/identity/resolve?handle=vitalik.eth
```

**Response:**
```json
{
  "handle": "vitalik.eth",
  "resolved": [
    { "protocol": "farcaster", "fid": 123, "username": "vitalik.eth" },
    { "protocol": "lens", "handle": "vitalik.lens" },
    { "protocol": "nostr", "npub": "npub1..." }
  ]
}
```

### GET /v1/identity/profile

Cross-platform identity profile with linked accounts.

**Query Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `wallet` | string | Wallet address for cross-protocol lookup |
| `handle` | string | Handle to look up (legacy) |

### POST /v1/identity/link

Link an identity from another protocol.

### DELETE /v1/identity/link

Unlink a previously linked identity.

### POST /api/identity/link

**Route:** `/api/identity/link` (Next.js proxy to worker)

### GET /api/identity/profile

**Route:** `/api/identity/profile` (Next.js proxy to worker)

---

## Tipping

Require scope `write:tip` for mutations, `read:feed` for reads.

### POST /v1/tip/create

Send a crypto tip (ETH, SOL, Lightning, Lens Collect, Creator Coin).

**Request Body:**
```json
{
  "protocol": "farcaster",
  "recipient": "0x1234...",
  "amount": "0.01",
  "currency": "ETH",
  "message": "Great content!",
  "split": { "recipient": 90, "community": "0x..." }
}
```

### GET /v1/tip/resolve

Resolve available tipping methods for a post or user.

**Query Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `postId` | string | — | Post ID to check tipping methods |
| `userId` | string | — | User ID to check tipping methods |

### GET /v1/tip/settings

Get tipping preferences for a user.

### GET /v1/tip/lightning/invoice

Generate a Lightning invoice for a Nostr zap.

**Query Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `amount` | number | ✅ | Amount in satoshis |
| `pubkey` | string | ✅ | Recipient Nostr pubkey |
| `note` | string | — | Optional zap note |

### GET /v1/tip/unified/stats

Cross-platform tip statistics.

### GET /v1/tip/unified/leaderboard

Top tippers across all platforms.

### POST /api/tip/create

**Route:** `/api/tip/create` (Next.js proxy to worker)

### GET /api/tip/resolve

**Route:** `/api/tip/resolve` (Next.js proxy to worker)

### GET /api/tip/settings

**Route:** `/api/tip/settings` (Next.js proxy to worker)

---

## Publishing

Require scope `write:posts`. Session required.

### POST /v1/publish

Cross-post to connected protocols.

**Request Body:**
```json
{
  "text": "Hello from DegenFeed!",
  "targets": ["nostr", "farcaster", "bluesky", "mastodon"],
  "auth": {
    "nostr_pubkey": "npub...",
    "farcaster_message": "0x...",
    "bluesky_jwt": "...",
    "mastodon": "..."
  },
  "media": [
    { "url": "https://...", "alt": "Description" }
  ]
}
```

**Response:**
```json
{
  "results": {
    "nostr": { "ok": true, "hash": "nostr:note1..." },
    "farcaster": { "ok": true, "hash": "0x..." },
    "bluesky": { "ok": true, "hash": "at://..." },
    "mastodon": { "ok": true, "hash": "12345" }
  },
  "meta": {
    "protocols_used": 4,
    "tier": "premium",
    "remaining_free_slots": "unlimited"
  }
}
```

**Limits:**
- Free tier: max 3 protocols per post
- Premium: unlimited protocols

### POST /api/publish

**Route:** `/api/publish` (Next.js proxy to worker)

---

## Engagement

Require scope `write:posts`.

### POST /v1/engage

Like, repost, reply, bookmark across protocols.

**Request Body:**
```json
{
  "action": "like",
  "postId": "farcaster:0x...",
  "protocol": "farcaster"
}
```

Supported actions: `like`, `repost`, `reply`, `bookmark`, `follow`.

---

## Communities

### GET /v1/communities

List all communities across protocols. Scope: `read:feed`.

### GET /v1/community/:name

Get community details by name.

### GET /v1/community/:name/feed

Get community feed.

### POST /v1/community

Create a new community (session required).

**Request Body:**
```json
{
  "name": "bitcoin-degens",
  "displayName": "Bitcoin Degens",
  "description": "A community for Bitcoin enthusiasts",
  "protocols": ["nostr", "farcaster"]
}
```

### POST /v1/community/:name/join

Join a community (session required).

### POST /api/communities

**Route:** `/api/communities`

### GET /api/communities

List communities.

### GET /api/community/[name]

Get community details.

### POST /api/community

Create community.

### GET /api/communities/discover

Discover trending communities.

---

## Spaces (Audio)

### POST /api/spaces/create

Create an audio space.

**Request Body:**
```json
{
  "title": "Crypto Talk Tuesday",
  "description": "Weekly crypto discussion",
  "scheduledFor": 1720000000000,
  "maxParticipants": 50,
  "protocols": ["nostr", "farcaster", "bluesky"]
}
```

### GET /api/spaces/live

Get currently live audio spaces.

### GET /api/spaces/upcoming

Get upcoming scheduled spaces.

---

## Creator Coins

### POST /api/coin/launch

Launch a new creator coin.

**Request Body:**
```json
{
  "symbol": "DEGEN",
  "name": "Degen Coin",
  "chain": "base",
  "vestingPreset": "balanced",
  "feeRecipient": "0x..."
}
```

### GET /api/coin/:symbol

Get coin details by symbol.

### GET /api/coin/:symbol/curve

Get bonding curve state and price data.

### POST /api/coin/:symbol/trade

Buy or sell creator coins.

**Request Body:**
```json
{
  "action": "buy",
  "amount": "1000000000000000000",
  "slippage": 5
}
```

### POST /api/coin/:symbol/transfer

Transfer creator coins.

### Farcaster Coin Routes

All prefixed with `/v1/farcaster/`:

| Route | Description |
|-------|-------------|
| `POST /v1/farcaster/coin/deploy` | Deploy a new Farcaster creator coin |
| `GET /v1/farcaster/coin/:fid` | Get coin for FID |
| `POST /v1/farcaster/coin/:fid/trade` | Trade Farcaster coin |
| `GET /v1/farcaster/coin/:fid/curve` | Bonding curve state |
| `GET /v1/farcaster/coin/:fid/holders` | Top holders |
| `GET /v1/farcaster/coin/:fid/history` | Trade history |

### Lens Coin Routes

All prefixed with `/v1/lens/`:

| Route | Description |
|-------|-------------|
| `POST /v1/lens/coin/deploy` | Deploy new Lens creator coin |
| `GET /v1/lens/coin/:profileId` | Get coin for profile |
| `POST /v1/lens/coin/:profileId/trade` | Trade Lens coin |
| `GET /v1/lens/coin/:profileId/curve` | Bonding curve state |

### Cross-Protocol Coin Routes

| Route | Description |
|-------|-------------|
| `POST /v1/cross-protocol-coin/deploy` | Deploy coin linked across protocols |
| `GET /v1/cross-protocol-coin/:address` | Get cross-chain coin mapping |
| `POST /v1/cross-protocol-coin/:address/bridge` | Bridge coin to another chain |

### Token Community Routes

| Route | Description |
|-------|-------------|
| `GET /v1/token/:address/community` | Get token community page |
| `POST /v1/token/:address/community/comment` | Post a community comment |
| `POST /v1/token/:address/peertube/start` | Start livestream from token community |
| `POST /v1/token/:address/peertube/stop` | End livestream |
| `GET /v1/token/:address/peertube/status` | Get stream status |

---

## Livestreaming

### POST /api/streams/solo/start

Start a solo stream.

### POST /api/streams/spaces/start

Start a space as a stream.

### POST /api/streams/collab/start

Start a collaborative stream.

### GET /api/streams/live

Get all current live streams.

### GET /api/streams/upcoming

Get upcoming scheduled streams.

### POST /api/streams/:id/end

End a stream.

### PeerTube Stream Routes

| Route | Description |
|-------|-------------|
| `POST /v1/peertube/stream/create` | Create a new PeerTube livestream |
| `GET /v1/peertube/stream/:id` | Get stream details |
| `POST /v1/peertube/stream/:id/start` | Start stream |
| `POST /v1/peertube/stream/:id/stop` | Stop stream |
| `GET /v1/peertube/stream/:id/rtmp-key` | Get RTMP key for OBS |
| `GET /v1/peertube/streams/live` | List live streams |
| `GET /v1/peertube/streams/featured` | Featured streams |

---

## Video Hub

### GET /api/video/hub

Video hub main page data.

### GET /api/video/categories

List available video categories.

### GET /v1/video/hub

Aggregated video feed from PeerTube and YouTube.

### GET /v1/video/categories

Video categories: `tech`, `talk`, `crypto`, `gaming`, `music`, `education`, `entertainment`.

---

## Short-Form Video

### GET /v1/shorts

Get a batch of short-form videos.

**Query Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `cursor` | string | Pagination cursor |
| `limit` | number | 1–50 (default 20) |

### GET /api/shorts

**Route:** `/api/shorts` (Next.js proxy to worker)

---

## Visual Feed

### GET /v1/visual/feed

Rich media grid: images and video from all protocols.

**Query Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `protocols` | string | Comma-separated protocol filter |
| `limit` | number | 1–100 (default 50) |
| `cursor` | string | Pagination cursor |

---

## Leaderboards

Require scope `read:feed`.

### GET /v1/leaderboard/creators

Top creators by engagement across protocols.

### GET /v1/leaderboard/tippers

Top tippers by volume.

### GET /v1/leaderboard/trending

Trending authors right now.

### GET /v1/leaderboard/communities

Most active communities.

### GET /api/leaderboard/creators

**Route:** `/api/leaderboard/creators`

### GET /api/leaderboard/tippers

**Route:** `/api/leaderboard/tippers`

### GET /api/leaderboard/trending

**Route:** `/api/leaderboard/trending`

### GET /api/leaderboard/communities

**Route:** `/api/leaderboard/communities`

---

## Notifications

### GET /v1/notifications

Unified notification inbox. Scope: `read:feed`.

### GET /api/notifications

**Route:** `/api/notifications`

### POST /api/notifications/push

Register push notification token.

---

## Content Resolution

### GET /v1/content/*

Resolve `df://` content URIs to canonical posts. Scope: `read:feed`.

### GET /api/feeds/public

List public feeds.

### GET /api/feeds/:id

Get specific feed configuration.

### POST /api/feeds

Create custom feed.

### POST /api/cross-reply

Cross-protocol reply — reply to a post from a different protocol.

---

## Cross-Protocol Bridge

### POST /v1/cross-protocol-bridge/wrap

Bridge content from protocol A → protocol B.

**Request Body:**
```json
{
  "sourceUri": "df://farcaster/0x...",
  "sourceProtocol": "farcaster",
  "targetProtocol": "nostr",
  "text": "Optional custom text"
}
```

### POST /v1/cross-protocol-bridge/zora

Wrap source content into a Zora creator coin.

**Request Body:**
```json
{
  "sourceUri": "df://nostr/note1...",
  "sourceProtocol": "nostr",
  "text": "Content text",
  "chain": "base",
  "creatorAddress": "0x..."
}
```

### POST /v1/cross-protocol-bridge/sync

Sync an edit from one protocol to all siblings.

### GET /v1/cross-protocol-bridge/status

Get bridge health and status for a post.

### POST /api/cross-reply

Cross-protocol reply (Next.js proxy).

---

## Analytics

### GET /v1/analytics

General analytics data. Scope: `read:analytics`.

### GET /v1/analytics/creator/:wallet/overview

Creator analytics overview.

### GET /v1/analytics/stream-view/:streamId

Stream view analytics.

### POST /api/analytics/stream-view

Record stream view event.

---

## Admin

All admin routes require admin-level authentication (wallet must be in `ADMIN_WALLETS`).

| Route | Method | Description |
|-------|--------|-------------|
| `/api/admin/stats` | GET | Platform statistics |
| `/api/admin/users` | GET | User management |
| `/api/admin/content` | GET | Content moderation queue |
| `/api/admin/flags` | POST | Flag content for review |
| `/api/admin/hosts` | GET | Host/server management |
| `/api/admin/config` | GET/PUT | Platform configuration |
| `/api/admin/rate-limits` | GET | Rate limit status |
| `/api/admin/content` | DELETE | Remove flagged content |

### Worker Admin Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/v1/admin/stats` | GET | Full platform stats |
| `/v1/admin/health` | GET | Worker health details |

---

## Preferences

### GET /api/preferences

Get user preferences.

### POST /api/preferences

Update user preferences. Sets theme cookie.

**Request Body:**
```json
{
  "theme": "dark",
  "notifications": true,
  "defaultProtocols": ["nostr", "farcaster"]
}
```

### PUT /api/preferences

Replace all user preferences.

### GET /v1/preferences

Get preferences (worker route).

### POST /v1/preferences

Update preferences (worker route).

---

## Messaging

### GET /api/messages/conversations

List conversations.

### POST /api/messages/send

Send a direct message.

### GET /api/messages/:id

Get conversation by ID.

---

## Recommendations

### GET /v1/recommendations/for-you

Personalized "For You" feed.

### GET /v1/recommendations/people

People to follow suggestions.

### GET /v1/recommendations/related/:postId

Related posts.

---

## Moderation

### POST /v1/moderation/report

Report content.

**Request Body:**
```json
{
  "postId": "farcaster:0x...",
  "reason": "spam",
  "description": "This is spam content"
}
```

### GET /v1/moderation/reports

List moderation reports (admin).

### GET /v1/moderation/stats

Moderation statistics (admin).

### POST /v1/moderation/ban

Ban a user (admin).

---

## Reputation

### GET /v1/reputation/:userId

Get reputation score and tier for a user.

### POST /v1/reputation/event

Record a reputation event (internal).

### GET /v1/reputation/leaderboard

Reputation leaderboard.

---

## Account & Auth

### GET /v1/auth/session

Get current session info.

**Response:**
```json
{
  "authenticated": true,
  "address": "0x...",
  "chain": "ethereum",
  "exp": 1720000000000
}
```

### POST /v1/auth/login

Browser wallet sign-in (EIP-4361 / Solana wallet adapter).

### POST /v1/auth/logout

Destroy session.

### POST /v1/register

Register a new account (cross-platform).

### POST /v1/auth/email

Email-based auth (magic link or code).

### GET /v1/auth/oauth/:provider

OAuth provider authorization (Google, GitHub, Twitter).

| Provider | Description |
|----------|-------------|
| `github` | GitHub OAuth |
| `twitter` | Twitter/X OAuth |

### Account Routes (Worker)

| Route | Method | Description |
|-------|--------|-------------|
| `/v1/account` | GET | Get account info |
| `/v1/account` | PATCH | Update account info |

---

## YouTube

### GET /api/youtube/trending

Trending YouTube videos in the feed.

### GET /api/youtube/recommended

Recommended YouTube videos.

---

## Prices

### GET /v1/prices

Crypto prices via CoinGecko. No auth required.

**Query Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ids` | string | ✅ | Comma-separated coin IDs: `bitcoin,ethereum,solana` |

**Request:**
```
GET /v1/prices?ids=bitcoin,ethereum
```

**Response:**
```json
{
  "bitcoin": { "usd": 60000 },
  "ethereum": { "usd": 3400 }
}
```

---

## Other Endpoints

### GET /v1/discover

Discover trending content.

### GET /v1/discover/people

Who to follow.

### GET /v1/embed/resolve

Fetch OpenGraph metadata for a URL.

**Query Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | string | ✅ | URL to resolve |

### GET /v1/frame/resolve

Parse Farcaster Frame meta tags from a URL.

### POST /v1/frame/action

Submit a Farcaster Frame button action.

### GET /v1/features

Feature flags status. No auth required.

### GET /v1/status

API service status. No auth required.

**Response:**
```json
{ "status": "ok", "service": "degenfeed-api", "version": "1.0.0" }
```

### GET /v1/translate

Translate text (Nostr content, etc.).

### GET /v1/og

OpenGraph card generation.

### GET /v1/links

Link preview metadata.

### GET /v1/funding

Funding/goal statistics.

---

## WebSocket / Real-Time

DegenFeed provides real-time updates via WebSocket and Server-Sent Events.

### GET /v1/ws

WebSocket endpoint for real-time feed updates, notifications, and chat.

**Connection:**
```
wss://degenfeed.xyz/v1/ws?token=<session_token>
```

**Events:**
| Event | Direction | Description |
|-------|-----------|-------------|
| `feed:update` | Server→Client | New posts available in feed |
| `notification` | Server→Client | New notification |
| `tip:received` | Server→Client | Tip received notification |
| `stream:live` | Server→Client | Followed creator went live |
| `chat:message` | Bidirectional | Real-time chat message |
| `space:update` | Server→Client | Audio space status change |

### GET /v1/feed/stream

Server-Sent Events real-time feed stream.

**Request:**
```
GET /v1/feed/stream
Authorization: Bearer df_key_...
```

**Response:** SSE event stream with `data: { post: UnifiedPost }` events.

### POST /v1/ws/chat/send

Send a chat message via WebSocket bridge.

### Rate Limits

- WebSocket: max 5 connections per session, 5 min idle timeout
- SSE: max 3 connections per session

---

## Matrix Bridge Hub

DegenFeed's Matrix bridge hub provides access to 20+ additional messaging platforms through the Matrix federation protocol.

### Available Bridges

| Platform | Bridge | Feed | Post |
|----------|--------|------|------|
| WhatsApp | mautrix-whatsapp | ✅ | ✅ |
| Signal | mautrix-signal | ✅ | ✅ |
| Telegram | mautrix-telegram | ✅ | ✅ |
| Discord | mautrix-discord | ✅ | ✅ |
| Slack | mautrix-slack | ✅ | ✅ |
| IRC | matrix-appservice-irc | ✅ | ✅ |
| WeChat | mautrix-wechat | ✅ | ✅ |
| Google Chat | mautrix-googlechat | ✅ | ✅ |
| +15 more | various mautrix bridges | ✅ | ✅ |

### Matrix Endpoints

### GET /v1/matrix/rooms

List Matrix rooms available to the authenticated user.

### POST /v1/matrix/room/:id/join

Join a Matrix room.

### POST /v1/matrix/room/:id/send

Send a message to a Matrix room (bridges to connected platforms).

### GET /v1/matrix/room/:id/feed

Get recent messages from a Matrix room as feed items.

### POST /v1/matrix/bridge/link

Link an external platform (WhatsApp, Signal, etc.) to DegenFeed via Matrix.

---

## SDK Examples

### JavaScript / TypeScript

```typescript
// Install: npm install @degenfeed/api-client
import { DegenFeedClient } from '@degenfeed/api-client';

const client = new DegenFeedClient({
  apiKey: 'df_key_...',
});

// Get the trending feed
const feed = await client.feed.home({
  protocols: ['nostr', 'farcaster'],
  sort: 'hot',
  limit: 20,
});

// Search
const results = await client.search.query('bitcoin');

// Resolve identity
const identity = await client.identity.resolve('vitalik.eth');
```

### Python

```python
# Install: pip install degenfeed-client
from degenfeed import DegenFeedClient

client = DegenFeedClient(api_key="df_key_...")

# Get the trending feed
feed = client.feed.home(protocols=["nostr", "farcaster"], sort="hot", limit=20)

# Search
results = client.search.query("bitcoin")

# Resolve identity
identity = client.identity.resolve("vitalik.eth")
```

### curl

```bash
# Get the trending feed
curl -H "Authorization: Bearer df_key_..." \
  "https://degenfeed.xyz/v1/feed/home?sort=hot&limit=10"

# Search for Bitcoin posts
curl -H "Authorization: Bearer df_key_..." \
  "https://degenfeed.xyz/v1/search?q=bitcoin&limit=5"

# Resolve an identity
curl -H "Authorization: Bearer df_key_..." \
  "https://degenfeed.xyz/v1/identity/resolve?handle=vitalik.eth"
```

---

## Migration from v0 (legacy /api/)

The legacy `/api/*` routes are deprecated and will be removed on **November 1, 2026**.

To migrate:
1. Replace `/api/` with `/v1/` in all request paths
2. Generate an API key from your profile settings
3. Add the `Authorization: Bearer df_key_...` header to all requests
4. Check the `Deprecation` and `Sunset` response headers on legacy routes for the migration deadline

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Invalid request body or parameters |
| 401 | Missing or invalid API key |
| 403 | Insufficient scope permissions |
| 402 | Payment required (free tier protocol limit) |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

*Questions? Join our [Developer Community](https://app.degenfeed.xyz/c/developers). Report issues on [Forgejo](https://git.rugmunch.io/RugMunchMedia/degenfeed).*
