# Protocol Integration Checklist

> **Purpose:** Standardize how every protocol is integrated into DegenFeed.
> **Applies to:** All protocol additions and compliance audits.
> **Owner:** Engineering Team

---

## Standard Protocol Integration Pattern

Every protocol MUST follow this 5-step integration pattern:

```
┌────────────────────────────────────────────────────────────────────┐
│  1. Bridge Provider                                                 │
│     bridge/src/providers/<protocol>.ts                             │
│     - fetch(limit): Promise<UnifiedPost[]>                         │
│     - schema: SchemaGuard (id, name, description)                  │
│     - Rate limit config                                            │
│     - Error handling (try/catch, timeout, empty array on failure)  │
├────────────────────────────────────────────────────────────────────┤
│  2. Type Registration                                              │
│     packages/types/src/constants.ts  — Protocol union type         │
│     packages/types/src/index.ts      — Protocol re-export          │
│     Add protocol name to the | union                               │
├────────────────────────────────────────────────────────────────────┤
│  3. Platform Tier                                                   │
│     packages/types/src/constants.ts — PLATFORM_TIER_WEIGHTS        │
│     packages/feed-core/src/index.ts — PLATFORM_TIER_WEIGHTS (sync) │
│     Assign weight 0.4–1.0 based on content quality/relevance       │
├────────────────────────────────────────────────────────────────────┤
│  4. Provider Registration                                          │
│     bridge/src/server/feets.ts — PROVIDERS record                  │
│     Add import + entry with name, fetch function, rate limit       │
├────────────────────────────────────────────────────────────────────┤
│  5. Feed Page                                                       │
│     apps/web/src/app/feed/<protocol>/                              │
│     ├── page.tsx    — SEO metadata + breadcrumb + ProtocolFeed     │
│     ├── loading.tsx — PageSkeleton import                          │
│     └── error.tsx   — ErrorFallback import                         │
└────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Overview

```
apps/web/ (Next.js Frontend)
├── app/feed/[protocol]/    ← Dynamic route for all protocols
│   ├── page.tsx            ← Client component with ProtocolFeed
│   ├── loading.tsx         ← Skeleton loading state
│   └── error.tsx           ← Error boundary
├── app/feed/<protocol>/    ← Static SEO page per protocol
│   ├── page.tsx            ← Metadata + breadcrumb + ProtocolFeed
│   ├── loading.tsx
│   └── error.tsx
└── components/feed/
    └── ProtocolFeed.tsx    ← Reusable feed UI component

bridge/ (Content Ingestion Layer)
├── src/providers/<protocol>.ts   ← Individual provider implementations
├── src/server/feeds.ts           ← PROVIDERS registry + buildFeed()
└── src/rate-limiter.ts           ← Rate limit enforcement

packages/ (Shared Types & Logic)
├── types/src/constants.ts       ← Protocol union type + PLATFORM_TIER_WEIGHTS
├── types/src/index.ts           ← Protocol re-export + UnifiedPost types
└── feed-core/src/index.ts       ← Feed algorithm + PLATFORM_TIER_WEIGHTS (mirrored)
```

---

## Current Protocol Inventory

### Status Summary

| Component | Count | Status |
|-----------|-------|--------|
| Protocol types (constants.ts) | 100 | ✅ Complete |
| Protocol types (index.ts) | 100 | ✅ Complete |
| Bridge providers | 84 | ✅ Active |
| Registered in feeds.ts | 89 | ✅ Active |
| Feed pages | 72 | ✅ Static pages |
| PLATFORM_TIER_WEIGHTS (types) | 100 | ✅ Complete |
| PLATFORM_TIER_WEIGHTS (feed-core) | 100 | ✅ Synced |

### Bridged Protocols by Category

#### Core Social (8)
`nostr` · `farcaster` · `lens` · `bluesky` · `mastodon` · `threads` · `pixelfed` · `rss`

#### Federated / ActivityPub (22)
`mastodon` · `pleroma` · `akkoma` · `misskey` · `firefish` · `iceshrimp` · `sharkey` ·
`diaspora` · `friendica` · `mbin` · `kbin` · `sublinks` · `hubzilla` · `streams` · `guppe` ·
`epicyon` · `bookwyrm` · `mobilizon` · `bonfire` · `mitra` · `takahe` · `writefreely`

#### Social Feeds / Forums (6)
`lemmy` · `kbin` · `mbin` · `reddit` · `sublinks` · `discourse`

#### Crypto / Web3 (12)
`mirror` · `zora` · `hive` · `steem` · `subsocial` · `deso` · `rarible` · `audius` ·
`cyberconnect` · `arena` · `orbis` · `ceramic`

#### Video / Audio (8)
`peertube` · `dtube` · `lbry` · `funkwhale` · `castopod` · `owncast` · `audius` · `live`

#### Blockchain Social (4)
`orbis` · `xmtp` · `push` · `huddle01`

#### Data / Storage (12)
`ceramic` · `tableland` · `ipfs-cluster` · `arweave` ·  `publii` · `known` · `plume` ·
`strfry` · `rssbridge` · `lens-poster` · `pixelfed-write` · `writefreely-write`

#### Messaging (3)
`telegram` · `discord` · `matrix`

#### Developer (2)
`github` · `forgejo`

#### Infrastructure / Network (3)
`headscale` · `yggdrasil` · `immich`

#### Content / CMS (3)
`ghost` · `immich` · `discourse`

#### AT Protocol (2)
`atproto` · `bluesky`

---

## Adding a New Protocol — Step-by-Step

### Step 1: Create Bridge Provider

```ts
// bridge/src/providers/myprotocol.ts
import type { SchemaGuard, UnifiedPost } from '../server/types';

export const schema: SchemaGuard = {
  id: 'myprotocol',
  name: 'My Protocol',
  description: 'Description of what this protocol provides',
  endpoint: '/api/feed/myprotocol',
  requiresAuth: false,
  contentType: 'social',
};

export async function fetchMyProtocolPosts(limit = 20): Promise<UnifiedPost[]> {
  // Implementation with try/catch, timeout, empty array on failures
}

export const fetch = fetchMyProtocolPosts;
```

**Requirements:**
- Export a `fetch(limit)` function returning `Promise<UnifiedPost[]>`
- Must never throw — return `[]` on any error
- Must abort/timeout after 10 seconds max
- Log errors with `console.warn('[bridge] <protocol>: ...')`
- Deduplicate posts before returning

### Step 2: Register Type

In `packages/types/src/constants.ts`:
```ts
export type Protocol =
  | 'nostr'
  // ... existing protocols ...
  | 'myprotocol';
```

Also add to the `PROTOCOLS` const array.

In `packages/types/src/index.ts`, mirror the same union type entry.

### Step 3: Add Platform Tier Weight

In `packages/types/src/constants.ts`:
```ts
export const PLATFORM_TIER_WEIGHTS: Record<string, number> = {
  // ... existing weights ...
  myprotocol: 0.7,
};
```

Also sync to `packages/feed-core/src/index.ts`:
```ts
export const PLATFORM_TIER_WEIGHTS: Record<string, number> = {
  // ... must match constants.ts exactly ...
};
```

**Weight Guidelines:**
| Weight | Tier | Examples |
|--------|------|----------|
| 1.0 | Core | nostr, farcaster, lens, bluesky |
| 0.9 | Major | peertube, youtube |
| 0.7–0.8 | Established | reddit, mirror, zora, hive |
| 0.5–0.6 | Niche | diaspora, friendica, misskey |
| 0.4 | Experimental | xmtp, push, huddle01 |

### Step 4: Register in feeds.ts

```ts
// Add import at top of bridge/src/server/feeds.ts
import { fetchMyProtocolPosts } from '../providers/myprotocol';

// Add to PROVIDERS record
export const PROVIDERS: Record<string, ProviderEntry> = {
  // ... existing providers ...
  myprotocol: {
    name: 'My Protocol (Description)',
    fetch: fetchMyProtocolPosts,
    rateLimit: { maxRequests: 60, windowMs: 60_000 },
  },
};
```

**Rate Limit Guide:**
| API Type | Rate Limit |
|----------|------------|
| Self-hosted | 300 req / 5 min |
| Public API (free) | 60 req / 1 min |
| WebSocket/relay | 30 req / 1 min |
| GitHub/GitLab | 60 req / 1 hour |

### Step 5: Create Feed Page

```tsx
// apps/web/src/app/feed/myprotocol/page.tsx
import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

export const metadata: Metadata = {
  title: 'My Protocol Feed — Decentralized Content | DegenFeed',
  description: 'Browse My Protocol content aggregated in your DegenFeed timeline.',
  keywords: ['myprotocol feed', 'myprotocol content'],
  openGraph: {
    title: 'My Protocol Feed — DegenFeed',
    description: 'My Protocol content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/myprotocol',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/myprotocol' },
};

export default function MyProtocolFeedPage() {
  return (
    <>
      <Script id="breadcrumb-myprotocol-feed" type="application/ld+json">
        {JSON.stringify({/* breadcrumb */})}
      </Script>
      <ProtocolFeed source="myprotocol" />
    </>
  );
}
```

Also create `loading.tsx` and `error.tsx`:
```tsx
// loading.tsx
import { PageSkeleton } from '@/components/PageSkeleton';
export default function Loading() { return <PageSkeleton />; }

// error.tsx
'use client';
import { ErrorFallback } from '@/components/ErrorFallback';
export default function FeedError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} />;
}
```

---

## Compliance Checklist

Use this checklist when adding or auditing a protocol:

- [ ] **Bridge provider created** — `bridge/src/providers/<protocol>.ts` exists
- [ ] **Type registered** — Protocol name added to `Protocol` union in both `constants.ts` and `index.ts`
- [ ] **Platform tier added** — Weight in `PLATFORM_TIER_WEIGHTS` in `constants.ts` (sync to `feed-core`)
- [ ] **Health check working** — Provider handles errors gracefully, returns `[]` on failure
- [ ] **Feed page created** — `apps/web/src/app/feed/<protocol>/` with `page.tsx`, `loading.tsx`, `error.tsx`
- [ ] **Rate limit configured** — `rateLimit` field in `PROVIDERS` entry
- [ ] **Provider registered in feeds.ts** — Import + entry in `PROVIDERS` record
- [ ] **No stub/stale code** — Provider has real fetch logic, not placeholder

---

## Auditing Compliance

To audit, run:

```bash
# Count exported fetch functions in providers
grep -l "export async function fetch" bridge/src/providers/*.ts | wc -l

# Count registered providers
grep -c "^\s\+\w\+: { name:" bridge/src/server/feeds.ts

# Count protocols in type
grep -c "^  | '" packages/types/src/constants.ts

# Count feed pages
ls -d apps/web/src/app/feed/*/page.tsx 2>/dev/null | wc -l

# Count tier weights
grep -c "^\s\+\w\+:" packages/types/src/constants.ts
```

---

## History

| Date | Change |
|------|--------|
| 2026-07-25 | Initial checklist created. Audit completed: 100 types ✅, 84 providers ✅, 89 registered ✅, 72 pages ✅, 100 weights ✅ |
