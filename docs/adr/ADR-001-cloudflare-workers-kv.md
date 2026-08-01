# ADR-001: Cloudflare Workers + KV for Edge Compute

**Status:** Accepted
**Date:** 2026-07-25
**Author:** Platform Engineering
**Deciders:** @crmuncher, Platform Team

---

## Context

DegenFeed aggregates content from 40+ decentralized protocols (Nostr, Farcaster, Lens, Bluesky, Mastodon, RSS, etc.) and serves a global audience of crypto-native users. The platform needs to deliver a unified feed with sub-100ms latency regardless of user geography, handle burst traffic from viral content and protocol events, and operate within a lean team that cannot manage regional server clusters.

Traditional server architectures (Node.js/Express or Python/FastAPI on VPS/ECS) present several problems:

1. **Geographic latency** — A single-region server adds 100-300ms of latency to users in Asia, Africa, or Oceania.
2. **Connection scaling** — Maintaining persistent WebSocket connections from thousands of users to a single-origin server requires significant connection management infrastructure.
3. **Protocol fan-out** — The worker fetches from 40+ upstream APIs per feed request. Parallelizing at the edge avoids a central bottleneck.
4. **Cold start tax** — Traditional serverless (AWS Lambda) has cold starts of 500ms-2s for Node.js runtimes.

## Decision

We use **Cloudflare Workers** as our primary compute platform with the following choices:

### 1. Hono Framework for Routing
Hono (~12KB gzipped) for route modularity and portability. ~100 route modules under `workers/api/src/routes/`.

### 2. Workers KV for Cache, Sessions, and Rate Limiting

| KV Namespace | Purpose | TTL |
|---|---|---|
| `CACHE` | Unified feed cache, sessions, rate limiting | Variable |
| `SUBSCRIPTIONS` | Protocol subscription preferences | ∞ |
| `IDENTITIES` | Cross-protocol identity mappings | 300s |
| `BOOKMARKS` | User bookmarks | ∞ |
| `FARCASTER_COINS` | Farcaster creator coin state | 120s |
| `COMMUNITIES` | Cross-protocol community records | ∞ |

**Key KV design decisions:**
- **Cache-aside pattern** — Check KV first, fetch upstream on miss, write to KV
- **Fail-closed sessions** — KV hiccup = deny session rather than allow revoked sessions
- **Soft rate limiting** — KV eventual consistency means rate counters are approximate

### 3. Durable Objects for Real-Time Features
WebSocket rooms (spaces, chat, live feed updates) use Durable Objects for strong consistency.

### 4. What We Are NOT Using Workers For
- Raw TCP connections (Nostr relays needing TCP use [HOST-1] sidecar)
- Long-running compute >30s (dispatched to [HOST-1] background workers)
- Relational database (PostgreSQL on [HOST-1])
- File/blob storage (R2 available but not part of Worker request path)

## Consequences

### Positive
1. **Global latency sub-50ms p95** — 300+ Cloudflare PoPs
2. **Eliminated cold starts** — V8 Isolates maintain state between requests
3. **Operational simplicity** — No servers, no regions, no load balancers
4. **Cost efficiency** — ~$5-15/month vs $200+/month for multi-region VPS
5. **TypeScript ecosystem alignment** — Whole monorepo is TypeScript

### Negative
1. **KV eventual consistency** — 60s propagation window, mitigated by fail-closed sessions and cache-aside with TTL
2. **No raw TCP** — Protocol SDKs use HTTPS/WebSocket variants; [HOST-1] sidecar for TCP-heavy relays
3. **10ms CPU per-call limit on Bundled plan** — Mitigated by concurrency limiting and KV caching
4. **Durable Objects bottleneck at scale** — Room sharding at 500 concurrent users per DO
5. **Vendor lock-in** — Mitigated by abstraction layers, Hono portability, and Vitest for non-CF tests
