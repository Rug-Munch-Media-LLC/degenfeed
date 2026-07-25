# Route Patterns — API Worker Standards & Audit

> Last updated: 2026-07-25  
> Total route files: 171  
> Total exported handler functions: ~130  

## Standard Pattern (MUST FOLLOW)

Every route handler in `workers/api/src/routes/*.ts` MUST follow these rules:

### 1. Named Function Exports
```typescript
// ✅ CORRECT
export async function handleXxx(req: Request, env: Env): Promise<Response> { }

// ❌ WRONG — no default exports for route handlers
export default async function handleXxx(req, env) { }
```

### 2. Use Response Helpers
```typescript
// ✅ CORRECT — uses response-helpers.ts
import { ok, created, badRequest, notFound, serverError } from '../response-helpers';
return ok({ items: [...] });
return badRequest('Invalid input');

// ❌ WRONG — raw jsonResponse or new Response()
import { jsonResponse } from '../index';
return jsonResponse({ data: items });
return new Response(JSON.stringify({ error: 'fail' }), { status: 400 });
```

### 3. Use KV Key Patterns
```typescript
// ✅ CORRECT — uses kv-key-patterns.ts
import { cachedPostKey, feedCacheKey } from '../kv-key-patterns';
const key = cachedPostKey(postId);
await env.CACHE.get(key);

// ❌ WRONG — inline key construction
await env.CACHE.get(`post:v1:${postId}`);
```

### 4. Session Enforcement
```typescript
// ✅ CORRECT — uses requireSession()
import { requireSession } from '../session';
const session = await requireSession(request, env);
if (session instanceof Response) return session; // unauthorized

// ❌ WRONG — manual cookie parsing or no session check on protected routes
```

### 5. CSRF Verification on Writes
```typescript
// ✅ CORRECT — middleware handles CSRF for POST/PUT/DELETE
// (CSRF middleware is applied globally in app.ts)

// ❌ WRONG — routes that are exempt without documentation
```

### 6. Error Handling
```typescript
// ✅ CORRECT — use standardized error classes
import { NotFoundError, ValidationError } from '../lib/errors';
throw new NotFoundError('Post not found');

// ❌ WRONG — ad-hoc error responses
return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
```

---

## Deviation Audit

### Routes Using `jsonResponse()` Instead of Response Helpers
These ~50 route files still use the legacy `jsonResponse()` from `index.ts` instead of `ok()`, `badRequest()`, etc. from `response-helpers.ts`:

| File | Issue |
|------|-------|
| `routes/post.ts` | Uses `jsonResponse()` throughout — no `ok()`/`notFound()` |
| `routes/wallet.ts` | Uses `jsonResponse()` for nonce/verify responses |
| `routes/auth.ts` | Uses `jsonResponse()` for OAuth responses |
| `routes/follow.ts` | Uses `jsonResponse()` |
| `routes/bookmarks.ts` | Uses `jsonResponse()` |
| `routes/governance.ts` | Uses `jsonResponse()` |
| `routes/dao.ts` | Uses `jsonResponse()` |
| `routes/dao-treasury.ts` | Uses `jsonResponse()` |
| `routes/search.ts` | Uses `jsonResponse()` |
| `routes/notifications.ts` | Uses `jsonResponse()` |
| `routes/subscription.ts` | Uses `jsonResponse()` |
| `routes/feed.ts` | Uses `jsonResponse()` in some places |
| `routes/messages.ts` | Uses `jsonResponse()` |
| `routes/publish.ts` | Uses `jsonResponse()` |
| `routes/curated-feed.ts` | Uses `jsonResponse()` |
| `routes/cross-reply.ts` | Uses `jsonResponse()` |
| `routes/digest.ts` | Uses `jsonResponse()` |
| `routes/for-you.ts` | Mixed — some `ok()`, some `jsonResponse()` |
| `routes/feed-category.ts` | Uses `jsonResponse()` |
| `routes/identity-extensions.ts` | Uses `jsonResponse()` |
| `routes/hw-wallet-2fa.ts` | Uses `jsonResponse()` |
| `routes/moderation.ts` | Uses `jsonResponse()` |
| `routes/permanence.ts` | Uses `jsonResponse()` |
| `routes/telegram.ts` | Uses `jsonResponse()` |
| `routes/farcaster-frames.ts` | Uses `jsonResponse()` |
| `routes/cross-protocol-bridge.ts` | Uses `jsonResponse()` |
| `routes/reputation.ts` | Uses `jsonResponse()` |

**Total**: ~27 files with mixed or full `jsonResponse()` usage.  
**Migration progress**: 1 of ~130+ handler files fully migrated (health.ts).

### Routes Using Default Exports
These files use `export default` instead of named exports, which is non-standard:

| File | Export Style |
|------|-------------|
| `routes/feddy-index.ts` | `export default feddyCommunities` (a router object) |
| `routes/feddy-admin.ts` | `export default` |
| `routes/feddy-community.ts` | `export default` |
| `routes/feddy-core.ts` | `export default` |
| `routes/feddy-features.ts` | `export default` |
| `routes/feddy-members.ts` | `export default` |
| `routes/feddy-moderation.ts` | `export default` |
| `routes/feddy-treasury.ts` | `export default` |
| `routes/bluesky-feed-generator.ts` | `export default` |
| `routes/farcaster-frames.ts` | `export default` |
| `routes/peertube.ts` | Uses `router` object pattern |
| `routes/peertube-streams.ts` | Uses `router` object pattern |
| `routes/streams.ts` | Uses `router` object pattern |
| `routes/youtube.ts` | Uses `router` object pattern |
| `routes/zora-compat.ts` | Uses `router` object pattern |
| `routes/zora-video.ts` | Uses `router` object pattern |
| `routes/video-hub.ts` | Uses `router` object pattern |
| `routes/totp.ts` | Uses `router` object pattern |
| `routes/token-community.ts` | Uses `router` object pattern |
| `routes/register-all.ts` | Uses `router` object pattern |

**Note**: Some default exports are legitimate Hono router (RPC) objects rather than simple handlers. These are acceptable as they follow Hono's `.route()` pattern.

### Routes Bypassing KV Key Patterns
These files construct KV keys inline instead of using `kv-key-patterns.ts`:

| File | Inline Key Construction |
|------|------------------------|
| `routes/post.ts` | `post:v1:${decoded}`, `post:${decoded}` |
| `routes/feed.ts` | `rl:${ip}:${path}:${bucketSec}` |
| `routes/feed-misc.ts` | Various inline feed keys |
| `routes/trending-scraper.ts` | `TRENDING_CACHE_KEY` |
| `routes/scheduled.ts` | `scheduled:${id}` |
| `routes/health.ts` | `health:protocols:v1` |
| `routes/cron.ts` | Various inline keys |
| `routes/for-you.ts` | User context cache keys |
| Various route files | Pattern: `env.CACHE.get(\`namespace:${id}\`)` |

### Routes Not Using `requireSession()`
These routes handle their own session verification instead of using the standard `requireSession()`:

| File | Alternative Pattern |
|------|-------------------|
| `routes/feed.ts` | Uses `resolveUserId()` helper (manual cookie parse + verifySessionCookie) |
| `routes/post.ts` | No session check at all |
| `routes/feed-misc.ts` | Manual session check |
| `routes/curated-feed.ts` | Manual session check |
| Various feed routes | No session check (read-only endpoints) |

---

## Enforcement Rules (for Code Review)

1. ❌ No `export default` for route handlers (exception: Hono router objects)
2. ❌ No direct `new Response(...)` in route handlers — use response-helpers
3. ❌ No inline KV keys — use kv-key-patterns helpers
4. ❌ No manual session cookie parsing — use `requireSession()`
5. ❌ No ad-hoc error responses — use error classes from `lib/errors.ts`
6. ✅ `import { ok, badRequest, notFound } from '../response-helpers'`
7. ✅ `import { cachedPostKey } from '../kv-key-patterns'`
8. ✅ `import { requireSession } from '../session'`
