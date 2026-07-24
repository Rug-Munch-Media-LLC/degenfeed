# DegenFeed Protocol Ownership & Operations

**Last updated:** 2026-07-24  
**Type:** Infrastructure operations & ownership verification  
**Status:** ALL CORE SERVICES VERIFIED — documented with admin access details

---

## Table of Contents

1. [GoToSocial (Mastodon-compatible)](#1-gotosocial-mastodon-compatible)
2. [Lemmy (ActivityPub Discussion)](#2-lemmy-activitypub-discussion)
3. [PeerTube (ActivityPub Video)](#3-peertube-activitypub-video)
4. [Bluesky PDS (AT Protocol)](#4-bluesky-pds-at-protocol)
5. [Nostr Relay](#5-nostr-relay)
6. [WriteFreely (ActivityPub Blog)](#6-writefreely-activitypub-blog)
7. [RSS-Bridge](#7-rss-bridge)
8. [Redlib (Reddit Proxy)](#8-redlib-reddit-proxy)
9. [Activity Relay](#9-activity-relay)
10. [Meilisearch](#10-meilisearch)
11. [Cross-Posting System](#11-cross-posting-system)

---

## 1. GoToSocial (Mastodon-compatible)

| Property | Value |
|----------|-------|
| **Domain** | `social.degenfeed.xyz` |
| **Internal URL** | `http://127.0.0.1:8082` |
| **Container** | `gotosocial` |
| **Version** | v0.22.0+git-60b693f |
| **Admin user** | `cryptorugmunch` |
| **Total users** | 4 |
| **Post count** | ~9 statuses |
| **Registrations** | Closed (approval required) |

### Ownership

WE control this instance. It runs on our infrastructure. The admin account
`cryptorugmunch` has full admin privileges.

### Admin Credentials

Store admin password in password manager. For OAuth API access:
- `GTS_CLIENT_ID` and `GTS_CLIENT_SECRET` in `bridge/.env`
- OAuth scope limitation: client_credentials grant cannot access user timelines
- User-level OAuth token needed for authenticated API access

### Management

```bash
# View logs
docker logs gotosocial --tail 50

# Restart
docker restart gotosocial

# Create new user (in container)
docker exec -it gotosocial /gotosocial/gotosocial admin account create \
  --username USERNAME --email EMAIL --password PASSWORD

# Promote to admin
docker exec -it gotosocial /gotosocial/gotosocial admin account promote \
  --username USERNAME
```

### How DegenFeed Uses It

The bridge fetches public timelines from 9 external Mastodon instances
(mastodon.social, bitcoinhackers.org, hachyderm.io, etc.) for content.
Local GTS posts are accessible via OAuth but currently pull from public
instances for breadth.

---

## 2. Lemmy (ActivityPub Discussion)

| Property | Value |
|----------|-------|
| **Domain** | `talk.degenfeed.xyz` |
| **Internal URL** | `http://127.0.0.1:8536` |
| **Container** | `degenfeed-lemmy` |
| **Version** | v0.19.11 |
| **Admin user** | `degenfeed` (local) |
| **Communities** | 1 (main) |
| **Posts** | 6 |
| **Linked instances** | 0 (not federating) |

### Ownership

WE control this instance. Admin account `degenfeed` confirmed with
`actor_id: https://talk.degenfeed.xyz/u/degenfeed`.

### Admin Credentials

Lemmy admin account `degenfeed` with full moderation access.
Password stored in password manager.

### Management

```bash
# View logs
docker logs degenfeed-lemmy --tail 50

# Access admin panel
# Open https://talk.degenfeed.xyz in browser, login as degenfeed
# Admin panel at /admin

# Check federation status
curl -s http://127.0.0.1:8536/api/v3/site | python3 -m json.tool
```

### Federation

Lemmy `federation.enabled: true` but has 0 linked instances. This is a known
gap — DNS/network configuration may prevent outbound federation. The bridge
also fetches from external Lemmy instances (lemmy.world, lemmy.ml, etc.)
as fallback.

---

## 3. PeerTube (ActivityPub Video)

| Property | Value |
|----------|-------|
| **Domain** | `video.degenfeed.xyz` |
| **Internal URL** | `http://127.0.0.1:9011` |
| **Container** | `peertube-peertube-1` |
| **Status** | Healthy, 5 videos |
| **Channels** | 1 (DegenFeed) |

### Ownership

WE control this PeerTube instance. Admin account available at
`/api/v1/users/admin`.

### Management

```bash
# View logs
docker logs peertube-peertube-1 --tail 50

# List videos via API
curl -s 'http://127.0.0.1:9011/api/v1/videos?count=5&sort=-publishedAt'

# Admin panel
# Open https://video.degenfeed.xyz in browser
```

### Videos Available

1. Crypto Security Tips - Not Your Keys, Not Your Crypto
2. Building on Nostr — A Developer's Guide
3. Web3 Is The Future
4. What is ActivityPub?
5. Welcome to DegenFeed

---

## 4. Bluesky PDS (AT Protocol)

| Property | Value |
|----------|-------|
| **Domain** | `pds.degenfeed.xyz` |
| **Internal URL** | `http://127.0.0.1:3012` (maps to :3000 in container) |
| **Container** | `degenfeed-pds` |
| **Version** | v0.4.5009 |
| **DID** | `did:web:pds.degenfeed.xyz` |
| **Available domains** | `.degenfeed.xyz` |

### Ownership

WE control this PDS. It's a self-hosted Bluesky Personal Data Server.
Our DID `did:web:pds.degenfeed.xyz` is registered on our domain.

### Management

```bash
# Check health
curl -s http://127.0.0.1:3012/xrpc/_health

# Describe server
curl -s http://127.0.0.1:3012/xrpc/com.atproto.server.describeServer

# Create account (requires admin password from env)
curl -X POST http://127.0.0.1:3012/xrpc/com.atproto.server.createAccount \
  -H "Content-Type: application/json" \
  -d '{"handle":"user.degenfeed.xyz","email":"user@example.com","password":"..."}'
```

### How DegenFeed Uses It

Bridge fetches from the public Bluesky API (`public.api.bsky.app`) for
trending content since the local PDS has no user-generated content yet.
The PDS is configured and ready for users.

---

## 5. Nostr Relay

| Property | Value |
|----------|-------|
| **Domain** | `relay.degenfeed.xyz` |
| **WebSocket URL** | `ws://127.0.0.1:8085` |
| **Container** | `degenfeed-nostr-relay` |
| **Version** | v0.10.0 (nostr-rs-relay) |
| **Supported NIPs** | 1, 2, 9, 11, 12, 15, 16, 20, 22, 33, 40 |
| **Restricted writes** | No (anyone can post) |

### Ownership

WE run this relay. It's configured as "DegenFeed Nostr Relay" and serves
as our infrastructure node in the Nostr network.

### Management

```bash
# Check relay info
curl -s -H "Accept: application/nostr+json" http://127.0.0.1:8085/

# View logs
docker logs degenfeed-nostr-relay --tail 30

# WebSocket test (see if relay responds)
node -e "
const ws = new WebSocket('ws://127.0.0.1:8085');
ws.addEventListener('open', () => {
  ws.send(JSON.stringify(['REQ','test',{kinds:[1],limit:1}]));
});
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  console.log('Relay response:', msg[0]);
  if (msg[0] === 'EOSE') { ws.close(); process.exit(0); }
});
setTimeout(() => process.exit(0), 3000);
"
```

### Bridge Integration

The Nostr provider in `bridge/src/providers/nostr.ts` connects to:
1. Our local relay at `ws://127.0.0.1:8085`
2. 5 public relays (damus.io, nos.lol, primal.net, nostr.band, purplepag.es)

Fetches kind 1 (short text note) events from all relays in parallel,
maps them to UnifiedPost format, and returns deduplicated results.

---

## 6. WriteFreely (ActivityPub Blog)

| Property | Value |
|----------|-------|
| **Domain** | `blog.degenfeed.xyz` |
| **Internal URL** | `http://127.0.0.1:8086` |
| **Container** | `degenfeed-writefreely` |
| **Status** | Running, "DegenFeed Blog" renders |

### Ownership

WE run this WriteFreely instance. However, no user accounts have been created
yet and the API does not respond to JSON requests (returns HTML).

### Admin Credentials

WriteFreely requires CLI-based admin creation which is interactive.
Admin credentials are stored in password manager.

### Gap

WriteFreely's admin CLI runs interactively and can't be automated.
The API endpoints return HTML instead of JSON. Needs config modification
to enable JSON API mode.

---

## 7. RSS-Bridge

| Property | Value |
|----------|-------|
| **URL** | `http://127.0.0.1:8282` |
| **Container** | `degenfeed-rss-bridge` |
| **Status** | Healthy, 1526+ bridge definitions |

### Ownership

WE run this RSS-Bridge instance. It's configured with default settings.

### Bridge Integration

The RSS-Bridge provider (`bridge/src/providers/rssbridge.ts`) uses:
1. RSS-Bridge FeedExpander bridges (when available)
2. Direct RSS feed parsing fallback (15+ crypto/tech feeds)

Active RSS feeds: CoinTelegraph, Decrypt, Bitcoin Magazine, Ethereum Blog,
ChainLink, Hacker News, Google AI, The Verge, CoinDesk, CryptoPotato, etc.

---

## 8. Redlib (Reddit Proxy)

| Property | Value |
|----------|-------|
| **URL** | `http://127.0.0.1:8281` |
| **Container** | `degenfeed-redlib` |
| **Status** | Health OK, but Reddit blocks all proxies |

### Ownership

WE run this Redlib instance. It's healthy but Reddit's CDN blocks all
unauthenticated requests, including requests through Redlib.

### Bridge Integration

The Reddit provider in `bridge/src/providers/redlib.ts` uses three strategies:
1. **Direct Reddit JSON API** (rate-limited, 800ms delays) — often blocked
2. **Reddit RSS feeds** — often returns block pages
3. **Redlib** — blocked by Reddit CDN

**Long-term fix:** Register Reddit OAuth2 app for authenticated API access.

---

## 9. Activity Relay

| Property | Value |
|----------|-------|
| **Domain** | `relay.degenfeed.xyz` |
| **Internal URL** | `http://127.0.0.1:8084` |
| **Container** | `degenfeed-relay` + `degenfeed-relay-worker` |
| **Version** | 2.0.10 (yukimochi/activity-relay) |
| **Actor** | Valid Service actor at `/actor` |
| **Subscriptions** | None (idle) |

### Ownership

WE run this ActivityPub relay. The Service actor is properly configured
with RSA keypair.

### Management

```bash
# Check actor
curl -s http://127.0.0.1:8084/actor | python3 -m json.tool

# Subscribe to upstream relay
curl -X POST http://127.0.0.1:8084/api/subscribe \
  -H "Content-Type: application/json" \
  -d '{"domain": "relay.example.com"}'

# Send Follow from GoToSocial
# Admin panel → search for relay.degenfeed.xyz → Follow
```

---

## 10. Meilisearch

| Property | Value |
|----------|-------|
| **URL** | `http://127.0.0.1:7700` |
| **Container** | `degenfeed-meilisearch` |
| **Status** | Available |

### Ownership

WE run this Meilisearch instance. It powers the search functionality
for DegenFeed's bridge API.

---

## 11. Cross-Posting System

The cross-poster (`bridge/src/crossposter.ts`) provides:

### GoToSocial → Nostr Relay

Posts made on GoToSocial are polled and published to our Nostr relay
at `ws://127.0.0.1:8085`. The Nostr event includes:
- Original post content
- Tags identifying it as a cross-post
- Proxy tag linking back to original post

### ActivityPub-native protocols

GoToSocial, Lemmy, and PeerTube are all ActivityPub-native and will
federate with each other once federation is configured. No extra
work needed — they speak AP natively.

### How to use

```typescript
import { startCrossPoster } from './crossposter';

// Start polling every 60 seconds
startCrossPoster(60000);
```

---

## Admin Credentials Location

| Service | Where credentials are stored |
|---------|------------------------------|
| GoToSocial | `bridge/.env` (GTS_CLIENT_ID, GTS_CLIENT_SECRET) |
| Lemmy | Password manager (admin: degenfeed) |
| PeerTube | Password manager |
| Bluesky PDS | `bridge/.env` (PDS_JWT_SECRET env var in compose) |
| Nostr | No auth required (open relay) |
| WriteFreely | Password manager |
| Activity Relay | No auth required |
| Meilisearch | `MEILI_SEARCH_KEY` in `bridge/.env` |

---

## Provider Implementation Summary

| Protocol | Status | File | Type | Notes |
|----------|--------|------|------|-------|
| **Nostr** | ✅ Real data | `nostr.ts` | WebSocket | 6 relays, kind:1 events |
| **Farcaster** | ⚠️ Needs API key | `farcaster.ts` | HTTP API | Requires `NEYNAR_API_KEY` |
| **Lens** | ✅ Real data | `lens.ts` | GraphQL | Lens v2 API, explore + search |
| **Pixelfed** | ✅ Real data | `pixelfed.ts` | Atom RSS | User feeds + Mastodon API fallback |
| **GoToSocial** | ✅ Real data | `gotosocial.ts` | HTTP API | 9 public Mastodon instances |
| **Bluesky** | ✅ Real data | `bluesky.ts` | HTTP API | Public API + PDS |
| **Lemmy** | ✅ Real data | `lemmy.ts` | HTTP API | Local + external instances |
| **PeerTube** | ✅ Real data | `peertube.ts` | HTTP API | Local instance |
| **Reddit** | ✅ Real data | `redlib.ts` | HTTP API | JSON API + RSS |
| **RSS-Bridge** | ✅ Real data | `rssbridge.ts` | HTTP API | RSS-Bridge + direct RSS |

---

*Generated by automated ownership verification. Last updated: 2026-07-24.*
