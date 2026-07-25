# DegenFeed — Quality Standards & Gates

> **Status:** canonical
> **Last updated:** 2026-07-25
> **Owner:** Engineering Team
> **Applies to:** All code in `workers/`, `bridge/`, `packages/`, `apps/web/`

---

## 1. Quality Gates

Every change must pass these gates before merging.

### 1.1 File Size Gate

| Size | Action |
|------|--------|
| < 300 lines | Healthy |
| 300–500 lines | Watch — consider proactive split |
| 500+ lines | **Blocking** — must split |

**Enforcement:** Review every PR for files exceeding 500 lines. Run `find . -name "*.ts" -not -path "*/node_modules/*" -exec wc -l {} + | sort -rn | head -10` to check.

### 1.2 No Stub Files Gate

**Stub files are forbidden in merged code.** A stub is any file that:
- Contains only `export {}` or `export default {}` with no members
- Exists as a placeholder for "future work"
- Has TODO/FIXME markers as its only substantive content
- Is an empty directory with only an empty `index.ts`

**Exception:** Test utility files that intentionally export nothing (e.g., test setup side effects).

### 1.3 TypeScript Gate

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

- **`tsc --noEmit` must pass** with zero errors before any PR is merged
- **No `any` types** in production code (use `unknown` with type guards)
- **No non-null assertions** (`data!`) — use `data ?? fallback` or explicit guards
- **No `as` casts** except for well-typed assertion functions
- **Prefer `const` over `let`** — use `let` only when rebinding is required

### 1.4 Biome Lint Gate

```bash
npx biome check .    # Must exit 0
```

Enforced rules include:
- `noUnusedVariables`, `noUnusedImports`
- `useImportType`, `useExportType`
- `noExplicitAny`
- `noNonNullAssertion`
- `noDangerouslySetInnerHtml`, `noGlobalEval`
- Full WCAG 2.1 AA a11y compliance

### 1.5 Test Gate

```bash
pnpm test            # Must exit 0
```

- Every PR must include tests for new functionality
- Bug fixes must include a regression test
- Edge cases and error paths must be covered

### 1.6 Pre-Commit Gate (Lefthook)

```yaml
pre-commit:
  commands:
    biome:
      run: npx biome check --write --staged && git add -u
    typecheck:
      run: tsc --noEmit
```

---

## 2. Required Tests Per Feature

### 2.1 API Route Handler

| Test | Description | Example |
|------|-------------|---------|
| Success path | Valid request returns expected 200/201 | `describe('POST /api/feed')` |
| Validation | Invalid input returns 400 with error message | `describe('POST /api/feed — validation')` |
| Auth required | Unauthenticated request returns 401/403 | `describe('auth guard')` |
| Not found | Non-existent resource returns 404 | `describe('not found')` |
| Rate limit | Exceeded rate limit returns 429 | `describe('rate limit')` |

### 2.2 Feed Pipeline Component

| Test | Description |
|------|-------------|
| Happy path | Component processes valid input correctly |
| Empty input | Component handles empty/no-data gracefully |
| Malformed data | Component handles invalid data without throwing |
| Performance | Component completes within acceptable time |
| Idempotency | Repeated calls produce consistent results |

### 2.3 React Component

| Test | Description |
|------|-------------|
| Render | Component renders with default props |
| Props | Component renders correctly with various prop combinations |
| Interaction | User interactions trigger correct callbacks |
| Loading state | Component shows loading skeleton/indicator |
| Error state | Component shows error state on failure |
| Empty state | Component shows empty state when no data |
| Accessibility | Component passes axe-core checks |

### 2.4 Bridge Provider

| Test | Description |
|------|-------------|
| Fetch success | Provider fetches and normalizes posts correctly |
| Network failure | Provider returns `[]` on network error (never throws) |
| Malformed response | Provider handles bad API response gracefully |
| Rate limiting | Provider respects source rate limits |
| Empty feed | Provider returns `[]` when source has no content |

---

## 3. Required States (UI Components)

Every data-driven UI component must handle these states:

### 3.1 Loading State

```tsx
// ✅ Always show a loading skeleton/indicator
function FeedList() {
  if (loading) return <LoadingSkeleton />;
  // ...
}
```

**Pattern:** Use `<LoadingSkeleton />` from `packages/ui`. Never show a blank screen during loading.

### 3.2 Error State

```tsx
// ✅ Always show a meaningful error state
function FeedList() {
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  // ...
}
```

**Pattern:** Use `<ErrorState />` from `packages/ui`. Include a retry action when applicable.

### 3.3 Empty State

```tsx
// ✅ Always show an informative empty state
function FeedList() {
  if (!loading && posts.length === 0) return <EmptyState type="feed" />;
  // ...
}
```

**Pattern:** Use `<EmptyState />` from `packages/ui`. Different empty states for different contexts (feed, search, bookmarks, etc.).

### 3.4 Offline State

```tsx
// ✅ Show offline indicator when network is unavailable
function FeedList() {
  if (isOffline) return <OfflineState />;
  // ...
}
```

**Pattern:** Use `<OfflineState />` from `packages/ui` for client-side connectivity issues.

---

## 4. Required Auth on Routes

### 4.1 Route Authorization Levels

| Level | Check | Middleware | Routes |
|-------|-------|-----------|--------|
| **Public** | No auth required | None | Landing, feed (read), blog, docs |
| **Session** | Valid session cookie | `parseSessionCookie()` | Post, tip, profile, preferences |
| **Premium** | Session + subscription | `requirePremium()` | Premium features, advanced analytics |
| **Admin** | Session + admin wallet | `requireAdminFromSession()` | Admin panel, moderation, deployments |
| **API Key** | Valid API key header | `apiKeyMiddleware()` | External API access, integrations |
| **CSRF** | Session + CSRF token | `validateCsrfToken()` | All state-changing mutations |

### 4.2 Implementation Pattern

```typescript
// routes/my-feature.ts
import { parseSessionCookie } from '../session';
import { badRequest, unauthorized, ok } from '../response-helpers';

export async function handleMyFeature(request: Request, env: Env) {
  // 1. Parse session
  const session = await parseSessionCookie(request, env);
  if (!session) return unauthorized('Session required');

  // 2. Validate input
  const body = await validateBody(request);
  if (!body) return badRequest('Invalid body');

  // 3. Execute handler logic
  const result = await doSomething(body, session);

  // 4. Return standardized response
  return ok(result);
}
```

### 4.3 Route Registration with Auth

```typescript
// app.ts — middleware applied at route level
app.post('/api/feature', async (c) => {
  const session = await parseSessionCookie(c.req.raw, c.env);
  if (!session) return unauthorized('Session required');
  return handleMyFeature(c.req.raw, c.env);
});
```

---

## 5. Response Helper Pattern

### 5.1 Standard Response Builders

All route handlers must use the standardized response helpers from `workers/api/src/response-helpers.ts`:

```typescript
import {
  ok,               // 200 — Successful response
  created,          // 201 — Resource created
  badRequest,       // 400 — Invalid input
  unauthorized,     // 401 — Authentication required
  forbidden,        // 403 — Authorization failure
  notFound,         // 404 — Resource not found
  methodNotAllowed, // 405 — Wrong HTTP method (+ Allow header)
  conflict,         // 409 — Resource conflict
  rateLimitResponse,// 429 — Rate limit exceeded
  serverError,      // 500 — Internal error
  badGateway,       // 502 — Upstream failure
  upgradeRequired,  // 426 — Payment/premium required
  paymentRequired,  // 402 — Payment required (x402)
  errorResponse,    // Catch-all for error boundaries
} from '../../response-helpers';
```

### 5.2 Error Response Pattern

```typescript
// ✅ Use errorResponse in catch blocks
try {
  // handler logic
} catch (err) {
  return errorResponse(err, env, { route: 'my-feature' });
}
```

### 5.3 API Response Shape

All API responses follow this JSON shape:

```typescript
// Success
{ "data": T }

// Error
{ "error": string }

// Rate limited
{ "error": "Rate limit exceeded", "retryAfterMs": number }
```

---

## 6. Review Checklist

### 6.1 Pre-Review (Author)

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes (`biome check`)
- [ ] `pnpm test` passes
- [ ] No file exceeds 500 lines
- [ ] No stub files or empty directories
- [ ] No `console.log`, `debugger`, or `TODO` without linked issue
- [ ] No secrets in code (review staged files for keys/tokens)
- [ ] Conventional commit message

### 6.2 Code Review

- [ ] Logic is correct and handles edge cases
- [ ] Types are correct and no `any` or unchecked casts
- [ ] Error paths are handled (not just happy path)
- [ ] Loading/error/empty states are covered
- [ ] Auth is correctly applied per route sensitivity
- [ ] Response helpers are used (not ad-hoc `new Response(...)`)
- [ ] KV key patterns use centralized helpers (not raw strings)
- [ ] Imports use barrel files, not deep paths
- [ ] No circular dependencies introduced
- [ ] Tests cover the change adequately

### 6.3 Architecture Review

- [ ] Code follows directory pattern (`feature-name/{index,types,utils,core,handlers}`)
- [ ] New packages follow SDK pattern (types → helpers → fetchers → barrel)
- [ ] God files are proactively split before they hit 500 lines
- [ ] Cross-cutting logic lives in `lib/`, not duplicated in routes
- [ ] Bridge providers never throw (return `[]` on error)
- [ ] No duplicate implementations (check for existing similar code)

### 6.4 Post-Merge

- [ ] Branch deleted
- [ ] Deployment triggered (CI auto-deploys on main)
- [ ] Smoke test on production (verify basic flow works)

---

## 7. Code Quality Metrics

### Test Coverage Thresholds

| Metric | Minimum | Target |
|--------|---------|--------|
| Statements | 60% | 75% |
| Branches | 50% | 65% |
| Functions | 60% | 75% |
| Lines | 60% | 75% |

### File Size Dashboard

Check current file size outliers:

```bash
find . -name "*.ts" -not -path "*/node_modules/*" \
  -not -path "*/.turbo/*" -not -path "*/dist/*" \
  -exec wc -l {} + | sort -rn | head -20
```

### Dependency Health

```bash
pnpm outdated              # Check for outdated deps
npx deptry .               # Detect unused/missing deps
```

---

## 8. Enforcement

| Gate | Enforced By | How to Bypass |
|------|------------|---------------|
| File size (500 lines) | Code review | Documented exception + issue |
| TypeScript strict | `tsc --noEmit` | Never |
| Biome lint | Lefthook + CI | Never |
| Tests passing | CI | Documented test gap + issue |
| No stubs | Code review | Never (delete before merge) |
| Auth on protected routes | Security review | Documented risk assessment |
| Response helpers | Code review | Documented need for custom response |
