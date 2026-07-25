# DegenFeed — Code Structure & Architecture Standards

> **Status:** canonical
> **Last updated:** 2026-07-25
> **Owner:** Engineering Team
> **Applies to:** All TypeScript source files in `workers/`, `bridge/`, `packages/`, `apps/`

---

## 1. God Files Eliminated

The following large files were identified as "god files" (single files handling multiple concerns) and split into structured module directories. These refactors serve as reference examples for future work.

### 1.1 `news-aggregator.ts` (was >1000 lines)

**Original:** A single file handling news source configuration, fetching, parsing, deduplication, scoring, and caching.

**Split into** (`workers/api/src/feed/`):

| File | Purpose | Size |
|------|---------|------|
| `news-types.ts` | News types, source interfaces, category enums | ~150 lines |
| `news-source-tiers.ts` | Source tier definitions and category assignments | ~200 lines |
| `news-source-tier-1.ts` through `news-source-tier-4.ts` | Per-tier source configuration | ~100–150 lines each |
| `news-helpers.ts` | Pure helper functions (dedup, normalization) | ~250 lines |
| `news-fetcher.ts` | Protocol-specific data fetching | ~350 lines |
| `news-processor.ts` | Content processing and enrichment | ~300 lines |
| `news-cache.ts` | Caching layer for news pipeline | ~100 lines |
| `news-aggregator.ts` | Thin orchestrator (imports all of the above) | **Now ~300 lines** |

### 1.2 `live-aggregator/` (was >1500 lines)

**Original:** Monolithic live aggregation file with streaming, scheduling, lifecycle, and helper logic.

**Split into** directory at `workers/api/src/feed/live-aggregator/`:

| File | Purpose |
|------|---------|
| `live-aggregator-types.ts` | Types and interfaces |
| `live-aggregator-streams.ts` | Stream management |
| `live-aggregator-schedule.ts` | Scheduling logic |
| `live-aggregator-lifecycle.ts` | Lifecycle management |
| `live-aggregator-helpers.ts` | Pure helper functions |
| `index.ts` | Barrel export |

### 1.3 `bridge/src/providers/rss.ts` (was >1800 lines)

**Original:** A monolithic RSS provider handling parsing, dedup, feed configs, and quality scoring.

**Split into** (`bridge/src/providers/rss/`):

| File | Purpose |
|------|---------|
| `rss-types.ts` | RSS provider types |
| `rss-helpers.ts` | Parsing and normalization helpers |
| `rss-parser.ts` | XML-to-UnifiedPost parser |
| `rss-dedup.ts` | Cross-feed deduplication |
| `feeds/index.ts` | Feed configuration barrel |
| `feeds/crypto-news.ts` | Crypto news feed configs |
| `feeds/research.ts` | Research feed configs |
| `feeds/dev.ts` | Developer feed configs |
| `feeds/security.ts` | Security feed configs |
| `feeds/newsletter.ts` | Newsletter feed configs |
| `index.ts` | Barrel export |

### 1.4 `routes/register/social.ts` (was >1900 lines)

**Original:** A single file registering all social protocol routes (Nostr, Farcaster, Bluesky, Mastodon, etc.).

**Refactored into** (`routes/register/`):

| File | Purpose |
|------|---------|
| `social.ts` | Social protocol routes (now ~300 lines) |
| `feed.ts` | Feed-related routes |
| `core.ts` | Core utility routes |
| `dao.ts` | DAO governance routes |
| `coins.ts` | Creator coin routes |
| `media.ts` | Media routes |
| `messaging.ts` | Messaging routes |
| `live.ts` | Live streaming routes |
| `index.ts` | Barrel export |

### 1.5 `feed-core/src/index.ts` (was >1400 lines)

**Original:** A single file containing algorithm logic, scoring, moderation, quality checks, and niche classification.

**Split into** (`packages/feed-core/src/`):

| File | Purpose |
|------|---------|
| `algorithm.ts` | Feed algorithm and scoring |
| `moderation.ts` | Content moderation |
| `quality.ts` | Quality scoring |
| `spam.ts` | Spam detection |
| `niches.ts` | Niche classification |
| `preferences.ts` | User preferences |
| `identity-resolver.ts` | Cross-protocol identity |
| `cross-protocol.ts` | Cross-protocol helpers |
| `circuit-breaker.ts` | Resilience pattern |
| `index.ts` | Barrel export |

---

## 2. Component Duplication Fixed

### 2.1 PostCard Duplication

**Problem:** Three separate PostCard implementations existed across different UI modules — one for the main feed, one for profiles, and one for search results. Each had slightly different features and inconsistent prop interfaces.

**Fix:** Consolidated into `packages/ui/src/post-card/` with sub-modules:

```
packages/ui/src/post-card/
  PostCard.tsx                  — Main component
  PostCardTypes.ts              — Shared type interfaces
  PostCardHelpers.ts            — Pure helper functions
  PostCardMedia.tsx             — Media rendering
  PostCardEngagement.tsx        — Engagement metrics display
  PostCardSkeleton.tsx          — Loading skeleton
  PostCardEmpty.tsx             — Empty state
  PostCardTranslationOverlay.tsx — i18n overlay
  PostCard.test.tsx             — Test suite
```

All consumers now import `PostCard` from the UI package barrel.

### 2.2 Response Helper Consolidation

**Problem:** 16+ different rate limit response patterns and ad-hoc `new Response(JSON.stringify(...))` patterns duplicated across route handlers.

**Fix:** Standard `response-helpers.ts` in `workers/api/src/`:

```typescript
// Workers response helpers — single source of truth
export function ok(data: unknown): Response       // 200
export function created(data: unknown): Response  // 201
export function badRequest(msg?: string): Response // 400
export function notFound(msg?: string): Response  // 404
export function serverError(msg?: string): Response // 500
export function forbidden(msg?: string): Response // 403
export function methodNotAllowed(methods: string[]): Response // 405 + Allow header
export function conflict(msg?: string): Response  // 409
export function rateLimitResponse(ms: number): Response // 429
export function upgradeRequired(msg?: string): Response // 426
export function paymentRequired(msg?: string, headers?): Response // 402
export function badGateway(msg?: string): Response // 502
export function errorResponse(err, env, opts): Response // Catch-all
```

### 2.3 KV Key Pattern Deduplication

**Problem:** KV key format strings duplicated across every route handler (e.g., `farcaster:coin:${fid}`, `xchain:token:${address}`).

**Fix:** Centralized `kv-key-patterns.ts` and `kv-helpers.ts` in `workers/api/src/`:

```typescript
// kv-key-patterns.ts — Single source for all KV key formats
export const KV_KEYS = {
  farcasterCoin: (fid: string) => `farcaster:coin:${fid}`,
  farcasterLink: (fid: string) => `farcaster:link:${fid}`,
  lensCoin: (profileId: string) => `lens:coin:${profileId}`,
  xchainToken: (address: string) => `xchain:token:${address}`,
  // ... all KV key patterns in one place
} as const;
```

### 2.4 Auth Provider Patterns

**Problem:** Redundant wallet/session/CSRF validation logic scattered across routes.

**Fix:** Consolidated into standardized middleware in `workers/api/src/lib/`:
- `admin-guard.ts` — `requireAdminFromSession()`
- `premium-gate.ts` — `requirePremium()`
- `tier-gate.ts` — `requireTier()`
- `input-validator.ts` — `validateRequest()`

---

## 3. Patterns to Follow for New Code

### 3.1 Directory-First Module Pattern

For any new feature that requires more than one function:

```
feature-name/
  index.ts          — Barrel export (always)
  types.ts          — Types and interfaces (extract first)
  constants.ts      — Constants (extract second)
  utils.ts          — Pure helpers (extract third)
  core.ts           — Business logic (when logic exceeds 200 lines)
  handlers.ts       — HTTP handlers (when handlers exceed 200 lines)
  __tests__/        — Test directory
```

### 3.2 Route Registration Pattern

New route handlers follow the Hono app pattern via `routes/register/`:

```typescript
// 1. Define handler in routes/{feature}.ts
// 2. Register in app.ts via register module
// 3. Export type-safe handlers

// routes/register/my-feature.ts
import { Hono } from 'hono';
import type { Env } from '../../index';
import { myHandler } from '../my-feature';

export function registerMyFeatureRoutes(app: Hono<{ Bindings: Env }>) {
  app.get('/api/my-feature', myHandler);
}
```

### 3.3 SDK Package Pattern

```
packages/my-sdk/
  src/
    index.ts          — Barrel export
    types.ts          — Protocol-specific types
    helpers.ts        — Pure helper functions (no side effects)
    fetchers.ts       — API fetchers (external calls)
    __tests__/        — Test files
  package.json        — With "exports" field
  tsconfig.json
```

### 3.4 Query in `app.ts`, Mutate in Route Handler

- **Queries** (read operations) use the feed pipeline: `feed/` modules
- **Mutations** (write operations) happen in route handlers: `routes/` files
- **Cross-cutting logic** lives in `lib/` modules

### 3.5 Response Helper Pattern

Always use response helpers instead of ad-hoc responses:

```typescript
// ✅ Good
import { ok, badRequest, notFound } from '../../response-helpers';
return ok(data);
return badRequest('Invalid input');

// ❌ Bad
return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
return new Response(JSON.stringify({ error: 'Invalid input' }), { status: 400, headers: { 'content-type': 'application/json' } });
```

### 3.6 Service Layer Pattern (Frontend)

```
apps/web/src/services/
  feed.ts             — Feed API client functions
  auth.ts             — Authentication API client
  profile.ts          — Profile API client
  tip.ts              — Tipping API client
  notify.ts           — Notification API client

apps/web/src/hooks/
  useFeedData.ts      — Feed data hook
  useAuth.ts          — Auth hook
  useNotifications.ts — Notification hook
```

---

## 4. Anti-Patterns to Avoid

### ❌ God Files

Files handling multiple concerns (types, config, helpers, business logic, I/O) in one file.

```typescript
// ❌ Bad — one file doing everything
export interface FeedPost { ... }
export const FEED_CONFIG = { ... };
export function parseFeedPost(raw: unknown) { ... }
export async function fetchFeed() { ... }
export async function cacheFeed(posts: FeedPost[]) { ... }
```

### ❌ Deep Imports

```typescript
// ❌ Bad — reaching into package internals
import { algo } from '@degenfeed/feed-core/src/algorithm';

// ✅ Good — import from barrel
import { FeedAlgorithm } from '@degenfeed/feed-core';
```

### ❌ Ad-hoc Response Construction

```typescript
// ❌ Bad
return new Response(JSON.stringify(data), {
  status: 200,
  headers: { 'content-type': 'application/json' },
});

// ✅ Good
import { ok } from './response-helpers';
return ok(data);
```

### ❌ Duplicate KV Key Strings

```typescript
// ❌ Bad — raw string scattered across files
const key = `farcaster:coin:${fid}`;

// ✅ Good — use central key helpers
import { KV_KEYS } from './kv-key-patterns';
const key = KV_KEYS.farcasterCoin(fid);
```

### ❌ Circular Dependencies

```typescript
// ❌ Bad: types importing from logic
// types.ts → import { helper } from './utils'

// ✅ Good: types import nothing from logic
// types.ts → (no local imports)
// utils.ts → import type { Foo } from './types'
```

### ❌ Non-Null Assertions

```typescript
// ❌ Bad
const x = data!;

// ✅ Good
const x = data ?? fallback;
if (!data) throw new Error('data required');
```

### ❌ Throwing in Bridge Providers

```typescript
// ❌ Bad — bridge providers must never throw
export async function fetchPosts(): Promise<UnifiedPost[]> {
  const resp = await fetch(url);  // may throw
  return parse(resp);
}

// ✅ Good — always catch and return []
export async function fetchPosts(): Promise<UnifiedPost[]> {
  try {
    const resp = await fetch(url);
    return parse(resp);
  } catch {
    return [];
  }
}
```

### ❌ Mixed Concerns in Route Files

```typescript
// ❌ Bad — route file doing fetch + parse + cache + respond
app.get('/api/feed', async (c) => {
  const raw = await fetch('...');
  const parsed = parse(raw);
  await cache(parsed);
  return c.json(parsed);
});

// ✅ Good — route delegates to pipeline
app.get('/api/feed', async (c) => {
  const posts = await feedPipeline.fetch(c.env, params);
  return ok(posts);
});
```

### ❌ Orphan Empty Directories

Directories with no files (empty `types/`, `utils/`, `constants/` subdirectories) should not be committed. Only create subdirectories when they contain actual files.

---

## 5. Decision Tree for Code Organization

```
New code needed?
├── Single function < 100 lines?
│   └── Add to appropriate existing file
├── Multiple related functions?
│   ├── Has types + logic + config?
│   │   └── Create feature-name/ directory
│   └── Has only one concern?
│       └── Create single file
├── New protocol integration?
│   ├── Create SDK package (packages/{name}-sdk/)
│   └── Add wrapper in platform-wrappers/
└── New API route group?
    ├── Create routes/{name}.ts handler
    └── Register in routes/register/{module}.ts
```
