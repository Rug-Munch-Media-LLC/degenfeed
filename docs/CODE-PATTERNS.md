# DegenFeed — Code Patterns & Conventions

> **Status:** canonical  
> **Last updated:** 2026-07-26  
> **Owner:** Engineering Team  
> **Applies to:** All TypeScript source files in `workers/`, `bridge/`, `packages/`, `apps/`

---

## 1. File Structure Conventions

### Route Handlers (`workers/api/src/routes/`)

```
routes/
  feature-name.ts              — Single file for simple routes (<300 lines)
  feature-name/
    index.ts                   — Barrel: imports + registers routes
    handler-name.ts            — Logic implementation
    types.ts                   — Feature-specific types
    utils.ts                   — Feature-specific helpers
  register/                    — Route registrations (Hono app wiring)
    feed.ts                    — One file per route group
    live.ts
```

**Rules:**
- Files >500 lines MUST be split into a directory module
- Route handler files export `handle*` functions, NOT `app.router()` calls
- Route registration goes in `register/` directory files
- Shared types go in `types.ts` at the nearest scope (feature → route → api)

### Provider Packages (`packages/*/`)

```
packages/provider-name/
  src/
    index.ts                   — Barrel: public API
    types.ts                   — Shared types (extracted to break cycles)
    client.ts                  — API client class/functions
    helpers.ts                 — Pure utility functions
```

**Rules:**
- Always create `types.ts` for shared interfaces to avoid barrel re-export cycles
- `index.ts` should import from `./types` directly, not define types inline
- Never re-export from another package's barrel in your barrel file

---

## 2. Naming Conventions

| Category | Convention | Example |
|----------|-----------|---------|
| Route handlers | `handle<Feature><Action>` | `handleFeedCreate`, `handleUserLogin` |
| Async handlers | `handle<Feature><Action>` | Same as above (prefix `async`) |
| Route registration | `register<Feature>Routes` | `registerFeedRoutes(app)` |
| Types & interfaces | `PascalCase` | `ShortVideoItem`, `ShortsFeedResult` |
| Functions | `camelCase` | `scoreQualityV2`, `deduplicatePosts` |
| Constants | `UPPER_SNAKE_CASE` | `DEFAULT_RATE_WINDOW`, `BOOST_TERMS` |
| File names | `kebab-case` | `cross-protocol-coin.ts`, `feed-quality-monitor.ts` |
| Directory names | `kebab-case` | `premium-publish/`, `unified-profile/` |
| Exported types | `PascalCase` matching concept | Always prefix with domain context |
| Private helpers | `_camelCase` prefix | `_validateOrigin`, `_formatTime` |

### File Type Suffixes

| Suffix | Purpose |
|--------|---------|
| `types.ts` | Type definitions and interfaces |
| `utils.ts` | Utility/helper functions |
| `constants.ts` | Constants and enums |
| `handlers.ts` | Request handlers (for sub-routers) |
| `core.ts` | Core business logic |
| `index.ts` | Barrel/re-export file |

---

## 3. Import Conventions

### Ordering (MUST follow this exact order)

```typescript
// 1. External packages (3rd-party)
import { Hono } from 'hono';
import type { Protocol, UnifiedPost } from '@degenfeed/types';

// 2. Internal workspace packages
import { scoreQualityV2 } from '@degenfeed/ranking';

// 3. Relative imports (sibling modules)
import { handleError } from '../../lib/errors';
import { type Env } from '../../types';

// 4. Relative imports (same directory)
import { buildRichDigestHtml } from './templates';
import type { DigestResponse } from './types';
```

### Rules

- **External first, then internal/@ scope, then relative** — always
- Type-only imports use `import type { ... }` syntax
- Prefer named imports over default imports (except for Hono/Hono patterns)
- Never import from barrel files that would create circular dependencies
- Import `Env` from `types.ts`, NOT from `index.ts`
- Import response helpers from `response-helpers.ts`, NOT from `index.ts`

### Anti-patterns

```typescript
// ❌ BAD — creates circular deps
import { Env, jsonResponse } from '../index';

// ✅ GOOD — breaks circular deps
import type { Env } from '../types';
import { ok, serverError } from '../response-helpers';
```

---

## 4. Error Handling Conventions

### Standard Error Classes

Use the error classes from `lib/errors.ts`:

```typescript
import { 
  ValidationError,     // 400
  AuthError,           // 401
  PaymentRequiredError,// 402
  ForbiddenError,      // 403
  NotFoundError,       // 404
  ConflictError,       // 409
  RateLimitError,      // 429
  InternalError,       // 500
  BadGatewayError,     // 502
} from '../lib/errors';
```

### Pattern: Throw in handlers, catch in middleware

```typescript
// In route handler:
export async function handleGetPost(request: Request, env: Env): Promise<Response> {
  const post = await getPost(id);
  if (!post) throw new NotFoundError('Post not found');
  return ok(post);
}

// In catch blocks:
try {
  return await handler(request, env);
} catch (err) {
  return handleError(err, env, { route: '/api/post', method: 'GET' });
}
```

### Response Helpers

Use `response-helpers.ts` instead of `jsonResponse` from `index.ts`:

```typescript
import { ok, created, badRequest, notFound, serverError } from '../response-helpers';

return ok(data);       // 200
return created(data);  // 201
return badRequest('Invalid input');  // 400
return notFound();     // 404
```

### Error Logging

```typescript
import { logError } from '../error-logger';

await logError(env, error, {
  route: '/api/feature',
  method: 'POST',
  statusCode: 500,
});
```

---

## 5. State Management Patterns

### Cloudflare Workers (KV-based)

```typescript
// Read
const raw = await env.CACHE?.get(key);
const data = raw ? JSON.parse(raw) : null;

// Write with TTL
await env.CACHE?.put(key, JSON.stringify(data), { expirationTtl: 3600 });

// Atomic update
const raw = await env.CACHE?.get(key);
const list = raw ? JSON.parse(raw) : [];
list.push(newItem);
await env.CACHE?.put(key, JSON.stringify(list));
```

### KV Key Patterns

```
rl:{ip}:{path}:{seconds}     — Rate limit buckets
bf:fail:{ip}                 — Brute force failure counters
error-log:v2:{serverId}:{hourBucket}  — Error logs
identity:{wallet}            — Identity records
feed:{userId}:{name}         — Feed caches
```

### Rate Limiting

```typescript
import { tieredRateLimit, recordBruteForceFailure } from '../index';

const rl = await tieredRateLimit(env, ip, path, isAuthenticated);
if (!rl.allowed) return rateLimitResponse(rl.retryAfter);
```

---

## 6. Component Patterns (Frontend)

### Vue 3 Composition API

```vue
<script setup lang="ts">
// 1. Props and emits
const props = defineProps<{ post: UnifiedPost }>();
const emit = defineEmits<{ like: [id: string] }>();

// 2. State
const loading = ref(false);

// 3. Computed
const formattedDate = computed(() => formatTimeAgo(props.post.createdAt));

// 4. Methods
async function handleLike() {
  loading.value = true;
  try {
    await likePost(props.post.id);
    emit('like', props.post.id);
  } finally {
    loading.value = false;
  }
}
</script>
```

### Nuxt 4 Directory-Based Routing

```
pages/
  feed/
    index.vue              — /feed
    [id].vue               — /feed/:id
  profile/
    [handle].vue           — /profile/:handle
```

---

## 7. Testing Patterns

### Vitest with Cloudflare Workers

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('feed scoring', () => {
  it('should return higher scores for fresh content', () => {
    const result = scorePost(freshPost, ctx);
    expect(result.total).toBeGreaterThan(0);
    expect(result.reasons).toContain('fresh');
  });
});
```

### Mocking KV

```typescript
const mockEnv = {
  CACHE: {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ keys: [], cursor: undefined }),
  },
} as unknown as Env;
```

### Test File Placement

```
__tests__/
  unit/
    handlers/
      feed.test.ts
  integration/
    api/
      feed.test.ts
```

---

## 8. Dependency Injection Pattern

To avoid circular dependencies and improve testability:

```typescript
// ❌ BAD — imports concrete implementation
import { someService } from './some-service';
export async function handler() {
  return someService.doWork();
}

// ✅ GOOD — accepts dependencies
export async function handler(
  request: Request, 
  env: Env,
  deps?: { someService?: SomeService }
) {
  const service = deps?.someService ?? someService;
  return service.doWork();
}
```

---

## 9. Circular Dependency Prevention

### Do's
- Extract shared types to `types.ts` at the nearest scope
- Import `Env` from `types.ts`, not from `index.ts`
- Use `import type` for type-only imports (allows TypeScript to resolve safely)
- Keep barrel files (index.ts) as pure re-exports of leaf modules
- Extract shared constants to `constants.ts`

### Don'ts
- Don't re-export from Package A's index.ts if Package A imports from Package A's index.ts
- Don't import `jsonResponse` from `index.ts` in route files
- Don't define types inline in `index.ts` barrel files
- Don't create deep import chains that loop back to the entry point

---

## 10. Package Dependency Rules

```
@degenfeed/types     ← dependency-free (can be imported everywhere)
    ↓
@degenfeed/utils     ← depends only on @degenfeed/types
    ↓
@degenfeed/identity  ← depends on @degenfeed/utils (but NOT re-exported from utils)
    ↓
@degenfeed/feed-core ← depends on @degenfeed/types, @degenfeed/identity
    ↓
@degenfeed/ranking   ← depends on @degenfeed/types, @degenfeed/feed-core
```

**⚠️ Rule:** No package should re-export from another package that depends on it. If Package A re-exports from Package B, Package B must NOT import from Package A.
