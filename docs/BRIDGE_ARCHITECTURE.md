# Bridge Architecture

The DegenFeed bridge system aggregates content from 15+ social and news protocols
into a unified feed. This document describes the provider architecture, data flow,
and how to add new protocols.

## Architecture Overview

```
External API (Bluesky, Nostr, Farcaster, etc.)
         │
         ▼
    ┌─────────────┐
    │  Provider    │  fetch() — raw HTTP/WebSocket calls with retry + timeout
    │  Class       │  schema  — runtime guard validates API response shape
    │              │  transform() — maps raw data → UnifiedPost[]
    └──────┬──────┘
           │ UnifiedPost[]
           ▼
    ┌─────────────┐
    │  feed-core   │  CircuitBreaker, enrichPostNiches, quality scoring
    └──────┬──────┘
           │ enriched UnifiedPost[]
           ▼
    ┌─────────────┐
    │  FeedEngine  │  Merge, deduplicate, rank, apply preferences
    └──────┬──────┘
           │ ranked feed
           ▼
    ┌─────────────┐
    │  API Layer   │  Next.js API routes, Cloudflare Workers, local bridge
    └─────────────┘
```

## Provider Interface

Every provider implements `FeedProvider` (defined in `packages/feed-providers/src/types.ts`):

```typescript
interface FeedProvider {
  readonly protocol: Protocol;
  readonly schema: SchemaGuard;           // Runtime response validator
  fetch?(opts?: FetchOptions): Promise<unknown>;       // Optional: fetch raw data
  transform?(raw: unknown): UnifiedPost[];             // Optional: convert to posts
  fetchFeed(opts?: FetchOptions): Promise<FeedResult>; // Required: main entry point
  healthCheck?(opts?: FetchOptions): Promise<HealthResult>;
}
```

## Current Providers

| Provider | Protocol | Source | Strategy | Auth |
|----------|----------|--------|----------|------|
| `BlueskyProvider` | `bluesky` | public.api.bsky.app | Search API + curated actors | Optional JWT |
| `FarcasterProvider` | `farcaster` | Hub + public API | Cast-by-FID + search | None |
| `NostrProvider` | `nostr` | WebSocket relays + HTTP | Event subscription + HTTP fallback | None |
| `RedditProvider` | `reddit` | Reddit RSS/JSON + frontends | Multi-strategy with fallback | User-Agent |
| `MastodonProvider` | `mastodon` | Fediverse instances | Trending + hashtag + public timeline | None |
| `LensProvider` | `lens` | api.lens.xyz/graphql | GraphQL explore + curated accounts | None |
| `LemmyProvider` | `lemmy` | Federated Lemmy instances | Community posts API | None |
| `RssProvider` | `rss` | RSS/Atom feeds | 150+ curated crypto/tech/news feeds | None |
| `ThreadsProvider` | `threads` | ActivityPub (via GotoSocial) | Mastodon API proxy | None |
| `TildesProvider` | `tildes` | Tildes.net API | Topic listing | None |
| `KbinProvider` | `kbin` | Kbin instances | Microblog + thread API | None |
| `RedditAlternativesProvider` | `reddit` | Lemmy + Kbin | Federated alternatives | None |
| `RssBridgeProvider` | `rss` | Self-hosted RSS-Bridge | Bridge proxy | None |
| `PonderProvider` | `ponder` | RPC nodes | On-chain event indexing | None |
| `RmiDataBusProvider` | `rmi` | RMI backend | Security intelligence API | None |

## Data Flow per Provider

### Bluesky
```
fetch() → GET /xrpc/app.bsky.feed.searchPosts (crypto queries in parallel)
       → GET /xrpc/app.bsky.feed.getAuthorFeed (curated actors as fallback)
schema  → isBskyPostView / isBskyFeedResponse guards
transform() → UnifiedPost via buildUnifiedPost()
enrich   → enrichPostNiches()
```

### Nostr
```
fetch() → WebSocket SUBSCRIBE to relays (kind 1 notes + kind 30023 long-form)
       → HTTP fallback via nostr.band API
schema  → isNostrEvent guard
transform() → UnifiedPost via buildUnifiedPost() + extractEmbeds()
enrich   → enrichPostNiches() + profile resolution (kind 0)
```

### Farcaster
```
fetch() → GET /v1/castsByFid for each curated FID
       → GET /v1/reactionsByCast for engagement
       → Parallel: public API search for trending
schema  → isFarcasterCast guard
transform() → UnifiedPost via buildUnifiedPost()
enrich   → enrichPostNiches()
```

### Reddit
```
fetch() → Multi-strategy (RSS → JSON API → libreddit frontends)
       → First non-empty result wins
schema  → isRedditListing guard
transform() → UnifiedPost via manual construction
quality  → enrichPost() filters score<5, controversy, stickies, low-effort
```

### Mastodon / Fediverse
```
fetch() → GET /api/v1/trends/statuses (45+ instances)
       → GET /api/v1/timelines/tag/{tag} (hashtag search)
       → GET /api/v1/timelines/public (public timelines)
       → Misskey API for Misskey/Firefish instances
schema  → isGtSStatus guard
transform() → UnifiedPost via buildUnifiedPost()
filter   → scoreFediverseRelevance() ≥ 0.25 threshold
```

## Adding a New Provider

### 1. Create schema guard
```typescript
// packages/feed-providers/src/schemas.ts
export function isMyProtocolPost(obj: unknown): obj is MyProtocolPost {
  if (!obj || typeof obj !== 'object') return false;
  const p = obj as Record<string, unknown>;
  return typeof p.id === 'string' && typeof p.text === 'string';
}
```

### 2. Create provider class
```typescript
// packages/feed-providers/src/providers/myprotocol.ts
export class MyProtocolProvider implements FeedProvider {
  readonly protocol: Protocol = 'myprotocol';
  readonly schema: SchemaGuard = isMyProtocolPost;

  async fetch(opts?: FetchOptions): Promise<unknown> {
    // HTTP/WS calls to external API
  }

  transform(raw: unknown): UnifiedPost[] {
    // Map raw data to UnifiedPost
  }

  async fetchFeed(opts?: FetchOptions): Promise<FeedResult> {
    // Usually: fetch() → transform() → enrichPostNiches()
    try {
      return await this.breaker.execute(async () => {
        const posts = this.transform(await this.fetch(opts)).map(enrichPostNiches);
        return posts.length ? { posts } : { posts: [], notice: 'MyProtocol unavailable' };
      });
    } catch (err) {
      if (err instanceof CircuitBreakerError) {
        return { posts: [], notice: 'MyProtocol: circuit breaker open' };
      }
      return { posts: [], notice: 'MyProtocol feed unavailable' };
    }
  }
}
```

### 3. Export from index
```typescript
// packages/feed-providers/src/index.ts
export { MyProtocolProvider } from './providers/myprotocol';
```

### 4. Register in feed engine
Add your provider to the feed engine's provider registry so it's included in feed assembly.

## Error Handling Patterns

All providers follow consistent error handling:

1. **Circuit Breaker**: Every provider wraps `fetchFeed()` in a circuit breaker
   (`@degenfeed/feed-core`). After N consecutive failures, the breaker opens
   and the provider returns empty results for a cool-down period.

2. **Timeout**: All external calls use `withTimeout()` from utils. Default: 5s.

3. **Retry**: `withRetry()` with exponential backoff (250ms × attempt).

4. **Schema Guards**: `fetchJsonWithGuard()` validates API responses at runtime.
   A guard failure throws a descriptive error, preventing silent feed outages.

5. **Graceful Degradation**: Every `fetchFeed()` returns `{ posts: [], notice }`
   on failure — never throws to the caller.

## SDK Separation

Protocol-specific SDK packages (`bluesky-sdk`, `farcaster-sdk`, etc.) provide
low-level API clients for authenticated operations (publishing, engaging, profiles).
Feed providers use these SDKs internally but add feed-specific logic:

- **SDK package** (e.g. `@degenfeed/bluesky-sdk`): Raw XRPC calls, auth,
  profile management, content publishing.
- **Feed provider** (e.g. `BlueskyProvider`): Feed fetching, content filtering,
  niche detection, transformer logic.

## Local Bridge

For local development, a lightweight bridge server at `bridge/` proxies feeds
without requiring Cloudflare Workers or real social accounts. It provides:

- `/api/feed/for-you` — feed endpoint
- `/api/feed/trending` — trending topics
- `/api/preferences` — user preference store (in-memory)
- `/api/health` — service health

The bridge uses the `@degenfeed/feed-providers` package when available and
falls back to mock data when live services are unreachable.
