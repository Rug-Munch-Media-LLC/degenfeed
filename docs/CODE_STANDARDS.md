# DegenFeed — Code Quality Standards

> **Last updated:** 2026-07-24  
> **Owner:** Engineering Team

---

## 1. TypeScript Standards

### 1.1 Strict Mode Required

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": false
  }
}
```

### 1.2 Type Patterns

| Pattern | ✅ Do | ❌ Don't |
|---------|-------|----------|
| Exports | `export interface Foo { ... }` | `interface Foo { ... }; export { Foo }` |
| Imports | `import type { Foo } from './types'` | `import { Foo } from './types'` (when type-only) |
| Nullish | `value ?? defaultValue` | `value || defaultValue` |
| Optionals | `foo?.bar ?? fallback` | `foo && foo.bar || fallback` |
| Generics | Explicit generic on complex types | `as any` casts |
| Enums | `const union = 'a' \| 'b'` literals | `enum` keyword (prefer union types) |

### 1.3 No-Non-Null Assertions

```ts
// ❌ Bad
const x = data!;

// ✅ Good
const x = data ?? fallback;
if (!data) throw new Error('data required');
```

---

## 2. React / Next.js Standards

### 2.1 Component Structure

```tsx
'use client';  // Only when using hooks/browser APIs

// Props interface (named export)
export interface FeedTunerProps {
  weights: Record<string, number>;
  onWeightsChange: (weights: Record<string, number>) => void;
}

// Component (default export preferred)
export function FeedTuner(props: FeedTunerProps) { ... }
```

### 2.2 Hook Conventions

```ts
// File: hooks/useSomething.ts
'use client';

import { useCallback, useState } from 'react';

export interface UseSomethingResult {
  value: string;
  setValue: (v: string) => void;
}

export function useSomething(): UseSomethingResult {
  const [value, setValue] = useState('');
  return { value, setValue };
}
```

### 2.3 Performance Rules

- `useCallback` for function props passed to memoized children
- `useMemo` for expensive computations
- `React.memo` for components that render often with same props
- Debounce scroll/resize/input handlers with `useDebounce`
- Prefer `useIdleCallback` for non-critical work

---

## 3. API Client Standards

### 3.1 Every API call returns `ApiResponse<T>`

```ts
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: string[];
  notices?: string[];
  meta?: Record<string, unknown>;
}
```

### 3.2 Service Function Patterns

```ts
// ✅ Always return ApiResponse
export async function fetchFeedPosts(
  params: FeedParams,
): Promise<ApiResponse<FeedResponse<unknown>>> {
  return api.get<FeedResponse<unknown>>(`/api/feed/home?${query}`);
}

// ❌ Never throw or return raw data
```

### 3.3 Error Handling

```ts
const result = await api.get<Data>('/api/data');
if (!result.success) {
  showToast('error', result.error ?? 'Request failed');
  return;
}
// Use result.data safely
```

---

## 4. Bridge Provider Standards

### 4.1 Provider Interface

```ts
type ProviderFetcher = (limit: number) => Promise<UnifiedPost[]>;

// Every provider exports:
export async function fetchProviderPosts(limit = 20): Promise<UnifiedPost[]> {
  // 1. Fetch from source
  // 2. Map to UnifiedPost
  // 3. Return (never throw — return [] on error)
}
```

### 4.2 UnifiedPost Shape

```ts
export interface UnifiedPost {
  id: string;              // Unique: "{protocol}:{source_id}"
  protocol: string;        // Provider name
  author: UnifiedIdentity; // Full author info
  text: string;            // Plain text content
  html?: string;           // Optional HTML
  embeds: Embed[];         // Links, videos, images
  createdAt: number;       // Unix timestamp ms
  metrics: Metrics;        // Likes, reposts, replies, quotes
  engagement: Engagement;  // Viewer-specific state
  raw: unknown;            // Original source data
  niches: string[];        // Content classification
}
```

### 4.3 No Throwing

Providers must never throw. Always return `[]` on failure:

```ts
try {
  // ... fetch
} catch {
  return [];  // ✅ Silent failure
}
```

---

## 5. Testing Standards

### 5.1 Naming

```ts
describe('useFeedData', () => {
  it('should fetch posts on mount and set loaded state', async () => { ... });
  it('should degrade gracefully on network failure', async () => { ... });
  it('should detect new posts on subsequent polls', async () => { ... });
});
```

### 5.2 Arrange-Act-Assert

```ts
// Arrange
mockStorageIdentities([testIdentity]);

// Act
render(<AuthProvider><TestConsumer /></AuthProvider>);

// Assert
await waitFor(() => {
  expect(screen.getByTestId('protocols').textContent).toContain('nostr');
});
```

### 5.3 Mock Patterns

```ts
// Module mock (top-level)
vi.mock('@degenfeed/storage', () => ({
  getAllIdentities: vi.fn(),
}));

// Function mock (inline)
const fetchFn = vi.fn().mockResolvedValue([createItem('a')]);

// Global fetch (bridge tests)
globalThis.fetch = vi.fn().mockResolvedValue(
  new Response(JSON.stringify({ data: [] }), { status: 200 }),
);
```

### 5.4 Coverage Thresholds

| Metric | Minimum |
|--------|---------|
| Statements | 60% |
| Branches | 50% |
| Functions | 60% |
| Lines | 60% |

---

## 6. Linting & Formatting

### 6.1 Biome

```bash
# Check all files
npx biome check .

# Format and fix
npx biome check --write .

# CI check (no write)
npx biome check .
```

### 6.2 Rules Enforced

| Category | Key Rules |
|----------|-----------|
| **Correctness** | `noUnusedVariables`, `noUnusedImports`, `noUnusedPrivateClassMembers` |
| **Style** | `useImportType`, `useExportType`, `useConst`, `noNonNullAssertion` |
| **Suspicious** | `noExplicitAny`, `noArrayIndexKey`, `noDoubleEquals` |
| **Complexity** | `useOptionalChain` |
| **Security** | `noDangerouslySetInnerHtml`, `noGlobalEval` |
| **A11y** | Full WCAG 2.1 AA compliance ruleset |

### 6.3 Pre-commit (lefthook)

```yaml
pre-commit:
  commands:
    biome:
      run: npx biome check --write --staged && git add -u
    typecheck:
      run: tsc --noEmit
```

---

## 7. Git & Commit Standards

### 7.1 Conventional Commits

```
type(scope): description

feat(feed): add topic weight encoding
fix(bridge): handle null response from RSS feed
chore(deps): update vitest to v4
docs(testing): add testing plan document
refactor(auth): extract wallet persistence to hook
```

### 7.2 Branch Naming

```
feature/feed-tuner
fix/bridge-timeout
chore/update-deps
docs/testing-plan
```

### 7.3 Commit Checklist

- [ ] `biome check --write` passes
- [ ] `tsc --noEmit` passes
- [ ] Tests pass (`pnpm test`)
- [ ] No secrets in code (gitleaks check)
- [ ] Conventional commit message

---

## 8. Dependency Rules

### 8.1 What to Avoid

- `any` types (use `unknown` with type guards)
- `lodash` (native Array/Map/Set methods preferred)
- `moment.js` (use native `Date` or `date-fns`)
- `axios` (use native `fetch` with `retryFetch` wrapper)

### 8.2 What to Prefer

- `swr` for data fetching/caching
- `dompurify` for HTML sanitization
- `zod` for runtime validation (planned)
- `biome` for formatting/linting

---

## 9. Review Gate

Before merging any PR:

1. **Tests pass** — `pnpm test` exits 0
2. **TypeScript** — `tsc --noEmit` passes
3. **Lint** — `biome check` succeeds
4. **No regressions** — new tests for bug fixes
5. **Coverage** — meets threshold (or justified exception)
6. **No secrets** — gitleaks scan clean
7. **No debug code** — no `console.log`, `debugger`, `TODO` without issue
