# API Testing Guide

## Quick Start

```bash
# Run all tests
npm test

# Run with coverage
npm run coverage

# Run CI coverage with JUnit output
npm run coverage:ci

# Open HTML coverage report
npm run coverage:open
```

## Test Structure

```
tests/
├── unit/          # Unit tests for individual functions
├── integration/   # Integration tests for multi-component flows
├── e2e/           # End-to-end Playwright tests
├── api/           # API endpoint tests
├── bridge/        # Cross-protocol bridge tests
├── a11y/          # Accessibility tests
├── perf/          # Performance benchmarks
├── fuzz/          # Fuzz/invariant tests
├── hooks/         # Custom React hook tests
├── components/    # Component tests
├── vitest.setup.ts # Shared test setup
└── fuzz/          # Input validation fuzz tests

apps/web/__tests__/
├── smoke.test.ts           # Smoke tests
└── benchmark/              # Performance benchmarks

packages/*/src/__tests__/   # Per-package unit tests
```

## Test Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests via Turbo |
| `npm run coverage` | Run tests with coverage report |
| `npm run coverage:ci` | CI mode with JUnit output |
| `npm run coverage:open` | Open HTML report in browser |

## Writing Tests

### Unit Test Pattern

```typescript
import { describe, it, expect } from 'vitest';

describe('functionName', () => {
  it('should handle normal input', () => {
    expect(functionName('input')).toBe('expected');
  });

  it('should handle edge cases', () => {
    expect(functionName('')).toBe('');
  });
});
```

### Async Test Pattern

```typescript
import { describe, it, expect } from 'vitest';

describe('asyncFunction', () => {
  it('should resolve correctly', async () => {
    const result = await asyncFunction();
    expect(result).toBeDefined();
  });

  it('should handle errors', async () => {
    await expect(asyncFunction('bad-input')).rejects.toThrow();
  });
});
```

### Mocking Pattern

```typescript
import { vi } from 'vitest';

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ data: 'mock' }),
});
```

## Coverage Requirements

| Metric   | Threshold |
|----------|-----------|
| Branches | ≥ 50%     |
| Functions| ≥ 60%     |
| Lines    | ≥ 60%     |
| Statements| ≥ 60%    |

Coverage is measured across `apps/*/src/**`, `packages/*/src/**`, and `workers/*/src/**`.

## Test Naming Conventions

- `*.test.ts` — Unit/integration tests
- `*.spec.ts` — E2E or acceptance tests
- `*.bench.test.ts` — Benchmark tests
- `*.fuzz.test.ts` — Fuzz/invariant tests

## Adding New Tests

1. Place unit tests next to source: `src/feature/__tests__/feature.test.ts`
2. Place integration tests in `tests/integration/`
3. Place E2E tests in `apps/web/e2e/`
4. Register new packages in their own `vitest.config.ts`
