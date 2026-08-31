# Bridgy Fed Integration — DegenFeed Architecture

**Status:** canonical
**Last updated:** 2026-07-10
**Owner:** crmuncher

## Overview

Bridgy Fed is a self-hosted protocol bridge that translates messages between
ActivityPub, Bluesky (AT Protocol), Nostr, and Farcaster. It runs as a
standalone Docker container on [HOST-1], behind Nginx, on the shared `rmi-net`
network alongside the existing GotoSocial instance and DegenFeed services.

```
                    ┌──────────────────────────────────────────┐
                    │            DegenFeed ([HOST-1])             │
                    │                                          │
  ┌─────────────┐   │   ┌──────────┐     ┌───────────────┐    │
  │ DegenFeed    │       │GotoSocial│────▶│  Bridgy Fed   │    │
  │ Web Client  │◀──┐   │(social.) │     │(bridgy.)      │    │
  │(app.)       │   │   └──────────┘     └───┬───┬───┬───┘    │
  └─────────────┘   │        │               │   │   │        │
                    │        ▼               ▼   ▼   ▼        │
  ┌─────────────┐   │   ActivityPub     Bluesky Nostr Farcaster │
  │ Edge Worker │       (fediverse)        (external)          │
  │(degenfeed.) │◀──┐                                          │
  └─────────────┘   │                                          │
                    └──────────────────────────────────────────┘
```

## Architecture

### Components

| Component | Domain | Role |
|-----------|--------|------|
| **GotoSocial** | `social.degenfeed.xyz` | ActivityPub hub — DegenFeed's public identity in the fediverse |
| **Bridgy Fed** | `bridgy.degenfeed.xyz` | Protocol bridge — translates GtS posts to/from Bluesky, Nostr, Farcaster |
| **DegenFeed Web** | `app.degenfeed.xyz` | Read client — aggregates feeds from all protocols via the edge worker |
| **Edge Worker** | `degenfeed.xyz/api/*` | API proxy — pulls from public Bluesky/Nostr/Farcaster APIs, **does not route through Bridgy Fed** |

### Network Flow

```
Publishing (write path):
  DegenFeed composer ──▶ GotoSocial (ActivityPub post)
                            │
                            ▼
                        Bridgy Fed detects new AP post
                            │
                    ┌───────┼───────────┐
                    ▼       ▼           ▼
                 Bluesky  Nostr     Farcaster
                (bsky.social) (relays) (hubs)

Reading (read path):
  Edge Worker ──▶ public Bluesky API ──▶ bsky.social (direct, not via Bridgy Fed)
  Edge Worker ──▶ Nostr relays ──▶ damus.io / primal.net (direct)
  Edge Worker ──▶ Farcaster Hub ──▶ standardcrypto.vc (direct)
  Edge Worker ──▶ GotoSocial API ──▶ social.degenfeed.xyz (direct)

Bridgy Fed is WRITE-ONLY. All reads go through existing public APIs.
```

## Cross-Posting Flow

1. **User publishes** via DegenFeed composer → targets protocols they've linked.
2. **GotoSocial** receives the post as an ActivityPub `Note` with `as:Public` audience.
3. **Bridgy Fed** monitors the GotoSocial outbox (via WebSub/WebFinger), detects
   the new post, and translates it:
   - **To Bluesky:** AP `Note` → AT Protocol `app.bsky.feed.post` with extracted
     links, mentions, and media.
   - **To Nostr:** AP `Note` → Nostr `kind:1` text note, signed with the linked
     Nostr key.
   - **To Farcaster:** AP `Note` → Farcaster `CastAdd` message, submitted to the
     configured Hub.
4. **Replies and interactions** from external protocols flow back through Bridgy
   Fed to GotoSocial as ActivityPub `Create` activities, visible in the user's
   federated timeline.

## Auth Model

| Layer | Mechanism |
|-------|-----------|
| **GotoSocial** | OAuth 2.0 app credentials (`GTS_CLIENT_ID` / `GTS_CLIENT_SECRET`) |
| **Bluesky** | AT Protocol app password or OAuth session |
| **Nostr** | Local keypair (nsec stored in Bridgy Fed data volume) |
| **Farcaster** | Warpcast OAuth or self-hosted Hub signing key |
| **DegenFeed Web** | Wallet-first sign-in (Solana/EVM) — separate from protocol auth |

Bridgy Fed stores per-user OAuth tokens and protocol keys in its `/data` volume.
Users link protocols through Bridgy Fed's own onboarding UI (accessible at
`https://bridgy.degenfeed.xyz`). DegenFeed Web is a **read client** and does not
handle protocol-level auth for writing — it delegates to GotoSocial, which
Bridgy Fed then bridges.

## Deployment

All deployment files live in `infra/`:

| File | Purpose |
|------|---------|
| `infra/docker/bridgy-fed.Dockerfile` | Docker image build (Python 3.12, git clone, uv install) |
| `infra/docker/bridgy-fed-compose.yml` | Compose service definition (port 8085, rmi-net, volume) |
| `infra/nginx/bridgy-fed.conf` | Nginx reverse proxy + SSL + rate limiting |

### Bring Up

```bash
# Build and start
docker compose -f infra/docker/bridgy-fed-compose.yml up -d --build

# Verify
curl -s https://bridgy.degenfeed.xyz/health

# SSL (first time)
certbot --nginx -d bridgy.degenfeed.xyz
```

### Dependencies

- **degenfeed-bridgy-redis** (Redis `redis:7-alpine`, owned by DegenFeed, on `degenfeed_default`) — rate limiting store (DB 0)
- **degenfeed_default** Docker network — degenfeed-owned; must exist before compose up
- **GotoSocial** at `social.degenfeed.xyz` — must be running and federating
- **Nginx** — must have the config symlinked in `/etc/nginx/sites-enabled/`

### DegenFeed owned data layer (no rmi dependency)

DegenFeed owns all of its own data stores and does not share any rmi store:
- **Postgres** — degenfeed's own instances (stoat / peertube / pixelfed / writefreely / glitchtip / lemmy), each on degenfeed networks. No `rmi-postgres`.
- **Redis** — degenfeed-owned. The prod/self-host compose defines `redis`; Bridgy Fed now uses its own `degenfeed-bridgy-redis` (DB 0) instead of the retired shared Dragonfly.
- **Meilisearch** — `degenfeed-meilisearch` (search index), on `degenfeed_default`.
- **Qdrant / ClickHouse** — not used; DegenFeed's intelligence surfaces via rmi-backend HTTP (DataBus/`/api/rmi`), never a direct store connection.
- **Network** — everything joins the degenfeed-owned `degenfeed_default` network, not rmi's.

## Design Decisions

### Why Bridgy Fed over manual SDK bridging?

Building per-protocol write adapters in the edge worker duplicates what Bridgy
Fed already does well: translating ActivityPub objects to native protocol
formats, handling reply threading across protocols, and maintaining user-to-user
mapping tables. Bridgy Fed has 6+ years of edge-case hardening for
cross-protocol message delivery. Wrapping it as a Docker service on [HOST-1] gives
us self-hosted bridging without reinventing the protocol translation layer.

### Why write-only through Bridgy Fed?

Bridgy Fed is an ActivityPub → external-protocol bridge. The read path (fetching
posts from Bluesky, Nostr, Farcaster) already works through public APIs and
doesn't benefit from translation — the edge worker normalizes protocol-native
responses directly. Routing reads through Bridgy Fed would add latency with no
benefit. Writes are the hard part (message translation, protocol auth, reply
threading), and that's where Bridgy Fed adds value.

### Why `bridgy.degenfeed.xyz` as the domain?

Bridgy Fed needs a public domain for WebFinger discovery, OAuth redirects, and
ActivityPub inbox delivery. Using a subdomain of `degenfeed.xyz` keeps it under
our TLS certificate umbrella and avoids the need for a separate domain. The
domain is internal-only in practice (only GotoSocial talks to it), but must be
public for protocol compliance.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Bridgy Fed not detecting GtS posts | Verify GotoSocial is federating (`curl -H 'Accept: application/activity+json' https://social.degenfeed.xyz/@user`) |
| Bluesky cross-posts failing | Check Bluesky app password in Bridgy Fed `/data` config |
| Nostr cross-posts failing | Verify Nostr relays are reachable from [HOST-1] |
| Rate limit errors | Check Redis connection (`docker exec degenfeed-bridgy-redis redis-cli -n 0 DBSIZE`) |
| Container doesn't start | `docker logs bridgy-fed` — check for missing env vars or volume permissions |

## References

- Bridgy Fed repo: https://github.com/snarfed/bridgy-fed
- GotoSocial docs: https://docs.gotosocial.org
- AT Protocol: https://atproto.com
- Nostr NIPs: https://github.com/nostr-protocol/nips
- Farcaster protocol: https://docs.farcaster.xyz
