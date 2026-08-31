---
sidebar_position: 5
title: Feed API
---

# Feed API

The feed API is served by the **bridge** (`bridge/`, port `8787`, public at
`api.degenfeed.xyz`). All authenticated routes require a Bearer token matching
the bridge's `BRIDGE_API_KEY` environment variable.

## Authentication

```http
Authorization: Bearer <BRIDGE_API_KEY>
```

If `BRIDGE_API_KEY` is not set on the bridge, **all authenticated requests are
denied** (`bridge/src/server/auth-middleware.ts`). A few webhook routes (e.g.
Owncast stream lifecycle) are exempt.

## Unified home feed

```
GET /api/feed/home?sort=new|trending&limit=100
```

(also aliased at `/v1/feed/home`)

| Param | Values | Default | Notes |
|---|---|---|---|
| `sort` | `new`, `trending` | `trending` | Ranking mode (`packages/ranking`) |
| `limit` | 1–200 | `100` | Capped at 200 server-side |
| `page` | ≥1 | `1` | Real offset pagination over the cached pool |
| `protocols` | comma list | all | Restrict to specific protocols |

Example:

```bash
curl -H "Authorization: Bearer $BRIDGE_API_KEY" \
  "https://api.degenfeed.xyz/api/feed/home?sort=trending&limit=100"
```

Response shape:

```json
{
  "data": [
    {
      "id": "…",
      "source": "mastodon",
      "author": { "handle": "@user@instance", "displayName": "…" },
      "content": "…",
      "url": "https://…",
      "timestamp": "2026-08-31T12:00:00Z",
      "score": 42.5
    }
  ],
  "meta": { "total": 100, "sort": "trending", "page": 1, "limit": 100 }
}
```

**Caching:** the bridge builds a feed pool per `(sort, protocols, fetchLimit)`
and caches it — a cached `?sort=new` build is never served for
`?sort=trending` (sort is part of the cache key). Page N slices
`[(N-1)*limit, N*limit)` from the same pool.

## Per-protocol feeds

Every protocol provider is addressable. Filter the home feed with
`protocols=`:

```bash
# Only Nostr + Bluesky
curl -H "Authorization: Bearer $BRIDGE_API_KEY" \
  "https://api.degenfeed.xyz/api/feed/home?protocols=nostr,bluesky&sort=new&limit=50"
```

Provider implementations live in `bridge/src/providers/*` (70+ files) and are
registered in `bridge/src/server/feeds.ts` (`PROVIDERS`). Headline protocols:
`mastodon`, `gotosocial`, `atproto`/`bluesky`, `nostr`, `farcaster`, `lens`,
`lemmy`, `threads`, `peertube`, `pixelfed`, `reddit`, `rss`, `youtube`, `zora`
— plus the long tail (Telegram, Discord, Matrix, GitHub, Hive, Minds, …).

## Other endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/search?q=…&sources=…&type=…&niches=…&page=1&limit=20` | Cross-protocol search (limit ≤ 100) |
| `GET /api/notifications?wallet=0x…&limit=20` | Cross-protocol notifications for a wallet (limit ≤ 50) |
| `POST /api/publish` | Composer fan-out — publish to `nostr`, `mastodon`, `bluesky`, `farcaster` (`VALID_PROTOCOLS` allow-list) |
| Webhooks (Owncast, …) | Unauthenticated lifecycle callbacks |

## Publishing

```bash
curl -X POST -H "Authorization: Bearer $BRIDGE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"protocol":"nostr","content":"hello from DegenFeed"}' \
  "https://api.degenfeed.xyz/api/publish"
```

Only protocols in the `VALID_PROTOCOLS` allow-list are accepted by the
composer fan-out; the background crossposter (`bridge/src/crossposter.ts`)
handles the bot-write targets (lens, peertube, pixelfed, writefreely, …). See
[Protocols](/docs/protocols) for the full READ/POST matrix.
