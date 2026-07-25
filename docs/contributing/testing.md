# Testing Contribution Guide

## Conventions

### File Naming

- Unit tests: `*.test.ts` or `*.test.tsx`
- E2E tests: `*.spec.ts`
- Benchmarks: `*.bench.test.ts`
- Fuzz tests: `*.fuzz.test.ts`
- Integration tests: place in `tests/integration/` or alongside source

### Test Structure

```
feature/
├── __tests__/
│   └── feature.test.ts   # Unit tests
├── feature.ts            # Implementation
└── index.ts              # Barrel export
```

## Fixture Patterns

Use inline data for simple tests. For complex test data, use factory functions:

```typescript
function createMockPost(overrides = {}) {
  return {
    id: 'post-1',
    content: 'Test content',
    author: 'user-1',
    timestamp: Date.now(),
    protocol: 'nostr',
    ...overrides,
  };
}
```

## Mocking Patterns

### Mock fetch for API tests

```typescript
import { vi } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
});
```

### Mock modules

```typescript
vi.mock('@/lib/rate-limit', () => ({
  globalLimiter: { check: () => ({ allowed: true, remaining: 99, resetTime: 0 }) },
}));
```

## CI Pipeline

Tests run in CI on every push and PR:

1. `lefthook pre-commit` — lint, format, gitleaks
2. `lefthook pre-push` — typecheck, test, security scan
3. Coverage reports generated as JUnit XML and lcov

### CI Environment

- Node.js 22+
- pnpm 11+
- Vitest with v8 coverage provider
- Playwright for E2E tests (Chromium only)

## Adding New Packages

1. Create `vitest.config.ts` in the new package directory
2. Register the package in the root vitest config (if needed)
3. Create `src/__tests__/` directory
4. Write tests following the conventions above
5. Run `npm test` to verify

## Coverage Tracking

Coverage thresholds:

| Metric | Minimum |
|--------|---------|
| Branches | 50% |
| Functions | 60% |
| Lines | 60% |
| Statements | 60% |

Coverage reports are generated via `npm run coverage` and stored in `coverage/`.
