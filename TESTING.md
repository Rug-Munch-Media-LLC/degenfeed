# DegenFeed Testing Guide

> Testing Trophy methodology: **Integration tests > Unit tests > E2E tests**

## Quick Start

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @degenfeed/ui test
pnpm --filter @degenfeed/utils test
pnpm --filter @degenfeed/feed-core test
pnpm --filter @degenfeed/storage test
pnpm --filter @degenfeed/api test

# Run tests with coverage
pnpm vitest run --coverage

# Run tests in watch mode (development)
pnpm vitest

# Run E2E tests (Playwright)
cd apps/web && npx playwright test
```

## Test File Conventions

| Type | Location | Pattern | Environment | Framework |
|------|----------|---------|-------------|-----------|
| Unit | `packages/*/src/**/*.test.ts` | `*.test.ts` | `node` (or jsdom for UI) | Vitest |
| Component | `packages/ui/src/**/*.test.tsx` | `*.test.tsx` | `jsdom` + Testing Library | Vitest + RTL |
| API Route | `workers/api/src/__tests__/*.test.ts` | `*.test.ts` | `node` | Vitest + `vi.mock` |
| Integration | `workers/api/src/__tests__/integration-*.test.ts` | `integration-*.test.ts` | `node` | Vitest + `vi.mock` |
| E2E | `apps/web/e2e/*.spec.ts` | `*.spec.ts` | Playwright browser | Playwright |

### Naming Rules

- **Unit tests**: One `describe` block per function/export, one `it` per behavior
- **Component tests**: File name matches component name: `PostCard.test.tsx`
- **Mock files**: `test-utils.ts` for shared mocks, placed alongside source
- **Snapshots**: Auto-generated in `__snapshots__/` directory (avoid when possible)

## Mock Data Patterns

### Shared Test Utilities

Located at `packages/utils/src/test-utils.ts`:

```typescript
import {
  makeMockIdentity,
  makeMockPost,
  makeMockEmbed,
  mockFetch,
  clearMockFetch,
  mockFetchHandler,
  makeMockWallet,
  makeMockProtocolData,
} from '@degenfeed/utils/test-utils';

// Mock fetch globally
beforeEach(() => {
  mockFetch('https://api.dexscreener.com', {
    status: 200,
    body: { pairs: [{ priceUsd: '50000', priceChange: { h24: 2.5 } }] },
  });
  globalThis.fetch = vi.fn().mockImplementation(mockFetchHandler);
});
afterEach(() => {
  clearMockFetch();
});
```

### Mock Identity

```typescript
import { makeMockIdentity } from '@degenfeed/utils/test-utils';

const identity = makeMockIdentity({
  displayName: 'Alice',
  followerCount: 500,
});
```

### Mock Post

```typescript
import { makeMockPost } from '@degenfeed/utils/test-utils';

const post = makeMockPost('nostr:test123', {
  text: 'A post about Bitcoin',
  niches: ['crypto', 'bitcoin'],
});
```

### Mock Wallet

```typescript
import { makeMockWallet } from '@degenfeed/utils/test-utils';

const wallet = makeMockWallet({
  address: '0xabc...',
  chain: 'solana',
  isConnected: true,
});
```

### Mock Protocol Data

```typescript
import { makeMockProtocolData } from '@degenfeed/utils/test-utils';

const data = makeMockProtocolData({
  protocol: 'farcaster',
  handle: '@vitalik',
});
```

## Testing Patterns

### Unit Tests (Pure Functions)

```typescript
import { describe, expect, it } from 'vitest';
import { myFunction } from './myModule';

describe('myFunction', () => {
  it('should return expected output for given input', () => {
    expect(myFunction('input')).toBe('output');
  });

  it('should handle edge case', () => {
    expect(myFunction('')).toBe('default');
  });
});
```

### Component Tests (React + Testing Library)

```typescript
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MyComponent } from './MyComponent';

afterEach(() => { cleanup(); });

describe('MyComponent', () => {
  it('should render with props', () => {
    render(<MyComponent title="Hello" />);
    expect(screen.getByText('Hello')).toBeDefined();
  });

  it('should handle click events', () => {
    const onClick = vi.fn();
    render(<MyComponent onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

### API Route Tests (Mocked Providers)

```typescript
import { describe, expect, it, vi } from 'vitest';

vi.mock('@degenfeed/feed-providers', () => ({
  NostrProvider: vi.fn(() => ({ fetchFeed: vi.fn(), healthCheck: vi.fn() })),
}));

describe('handleHomeFeed', () => {
  it('should return 200 with posts', async () => {
    const { handleHomeFeed } = await import('../routes/feed');
    const req = new Request('http://localhost/api/feed/home?limit=5');
    const env = {} as any;
    const res = await handleHomeFeed(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });
});
```

### Integration Tests (Full Flow)

Integration tests verify end-to-end behavior through mocked providers.
They test the full pipeline (fetch → enrich → score → respond) with
controlled inputs and assertions on the final output.

```typescript
describe('Full feed flow', () => {
  it('should fetch, deduplicate, score, and return posts', async () => {
    // Setup mocked providers
    // Call handler
    // Assert on response shape and content
  });
});
```

## Mocking Guidelines

1. **Mock at the module boundary**, not inside functions. Use `vi.mock()` at the top level.
2. **Use dynamic imports** (`await import(...)`) in tests to pick up mocks.
3. **Never mock what you don't own** — mock providers and external deps, not your own logic.
4. **Reset mocks** with `vi.restoreAllMocks()` or `vi.clearAllMocks()` in `afterEach`.
5. **Use `vi.hoisted()`** for mock factories that need to reference variables:

```typescript
const { mockFn } = vi.hoisted(() => ({
  mockFn: vi.fn(),
}));
vi.mock('./module', () => ({ exportedFn: mockFn }));
```

## Coverage Targets

| Metric | Target |
|--------|--------|
| Statements | 70% |
| Branches | 70% |
| Functions | 70% |
| Lines | 70% |

Coverage is enforced via vitest config (`vitest.config.ts`).
Run `pnpm vitest run --coverage` to check current coverage.

## CI/CD Integration

Tests run automatically on every PR via the GitHub Actions workflow:

1. **Unit + Integration tests** (`pnpm test`) — runs on every push
2. **E2E tests** (`playwright`) — runs on PRs to main
3. **Coverage check** — fails if below configured thresholds
4. **Visual regression** — Playwright screenshot diffs on UI changes

See `.github/workflows/` for specific workflow configurations.

## Debugging Tests

```bash
# Run a single test file
pnpm vitest run packages/utils/src/community.test.ts

# Run tests matching a pattern
pnpm vitest run --testNamePattern="should detect"

# Enable debug logging
DEBUG=1 pnpm vitest

# Use the Vitest UI
pnpm vitest --ui
```

## Adding New Tests

1. Identify what you're testing (unit, component, API, integration)
2. Create the test file following the naming convention
3. Import mock utilities from `@degenfeed/utils/test-utils`
4. For API tests, mock provider modules with `vi.mock()`
5. Write focused assertions that test ONE behavior per `it()` block
6. Run `pnpm test` to verify all tests pass
7. Run `pnpm vitest run --coverage` to verify coverage
