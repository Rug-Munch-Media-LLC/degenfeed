# DegenFeed — Testing Plan

> **Last updated:** 2026-07-24  
> **Owner:** Engineering Team  
> **Status:** Active

---

## 1. Philosophy — Testing Trophy Over Pyramid

```
        ┌─────────────┐
        │   E2E (5%)   │   ← Playwright, critical user journeys
       ┌┴─────────────┴┐
      ┌┴───────────────┴┐
      │ Integration (60%)│   ← Service-level, component + hook + API
     ┌┴─────────────────┴┐
     │   Unit Tests (35%) │   ← Pure functions, utilities, helpers
     └───────────────────┘
```

| Layer | % | Tools | What |
|-------|---|-------|------|
| **Integration** | ~60% | Vitest, MSW, Testing Library | Hooks × services, components × context, API × handlers |
| **Unit** | ~35% | Vitest | Pure functions, data mapping, niche detection, sanitization |
| **E2E** | ~5% | Playwright | Auth flow, feed load, cross-protocol reply, search |

**Key Rule:** Integration tests > Unit tests > E2E tests. Prefer testing real interactions over isolated mocks.

---

## 2. Scope & Priority

### P0 — Must Have (Ship Blockers)

| Area | What | Status |
|------|------|--------|
| **Bridge Providers** | Each provider returns correct `UnifiedPost` shape | ✅ Covered |
| **Feed API** | `/api/feed/for-you`, `/api/feed/home` return correct shape | ✅ Covered |
| **Auth** | AuthProvider context, sign-in/sign-out flows | ✅ Covered |
| **Feed Hooks** | `useFeedData`, `useFeedFilters` state management | ✅ Covered |
| **API Client** | `api.get/post/put/del`, error handling, dedup | ✅ Covered |

### P1 — Should Have

| Area | What | Status |
|------|------|--------|
| **FeedTuner** | Component rendering, interaction, preview generation | ✅ Covered |
| **Debounce/Throttle** | Timing and cleanup correctness | ✅ Covered |
| **Clipboard** | Copy behavior and fallback | ✅ Covered |
| **Sanitize** | HTML sanitization, XSS prevention | ✅ Covered |
| **Search API** | Search endpoint shape and error handling | ✅ Covered |
| **Preferences** | Load/save preference flow | ✅ Covered |

### P2 — Nice to Have

| Area | What | Status |
|------|------|--------|
| **Real-time** | WebSocket/SSE reconnection logic | ⏳ Planned |
| **Offline Queue** | Queued operations and retry | ⏳ Planned |
| **Notifications** | Push notification flows | ⏳ Planned |
| **Premium/Tipping** | Payment gate flow | ⏳ Planned |
| **Cross-platform** | Cross-protocol identity linking | ⏳ Planned |

---

## 3. Test Types & Strategy

### 3.1 Unit Tests

**Where:** Pure functions, utilities, data mappers  
**Pattern:** Function in → expected output out  
**No mocks** (or minimal mocks)

**Test Suite** | **Functions Tested**
`guessNiches()` | Niche detection across all providers (bluesky, gotosocial, lemmy, peertube, redlib, rssbridge)
`stripHtml()` | HTML stripping with entities
`postToUnified()` / `videoToPost()` / `statusToPost()` | Data mapping correctness
`parseRssXml()` | RSS/Atom XML parsing
`parseRedlibJson()` | JSON-to-UnifiedPost mapping
`parseCount()` | Count string parsing (e.g. "1.2K")
`sliderGradient()` | CSS gradient generation
`weightLabel()` | Weight label mapping
`sanitizeHtml()` | HTML sanitization rules
`encodeTopicWeights()` | Topic weight encoding

### 3.2 Integration Tests

**Where:** Hooks × Services, Components × Context, API Handlers  
**Pattern:** Render hook/component → simulate interaction → assert behavior  
**Mocks:** Module-level via `vi.mock()`

**Test Suite** | **What It Tests**
`useFeedData` | SWR caching, graceful degradation, polling for new content
`useFeedFilters` | State management, preference load/save, tab switching
`useDebounce` | Timing, leading/trailing, cleanup on unmount
`useCopyToClipboard` | Copy behavior, fallback, timer cleanup
`AuthProvider` | Identity loading, protocol mapping, sign-out (existing)
`FeedTuner` | Component rendering, tab switching, topic/mix/preset interactions
`api.get/post/put/del` | Fetch with dedup, error parsing, retry behavior
`feed.ts service` | FeedParams serialization, endpoint URL construction
`buildFeed` | Multi-provider aggregation, dedup, error collection

### 3.3 E2E Tests (Playwright)

**Where:** `apps/web/e2e/`  
**Pattern:** Page → user action → assert DOM/URL changes

| Suite | Flow |
|-------|------|
| `auth.spec.ts` | Sign-in modal, wallet connect, sign-out |
| `feed.spec.ts` | Feed load, tab switch, infinite scroll |
| `cross-protocol.spec.ts` | Cross-protocol reply flow |
| `search.spec.ts` | Search query, results display |
| `visual.spec.ts` | Visual regression snapshots |
| `smoke.spec.ts` | Basic page load, 200 status |

---

## 4. Coverage Targets

| Metric | Current | Target | Stretch |
|--------|---------|--------|---------|
| **Unit (app/web)** | ~15% | **60%** | 80% |
| **Integration (app/web)** | ~10% | **40%** | 60% |
| **Bridge (providers)** | 0% | **70%** | 85% |
| **E2E** | ~5 paths | **8 paths** | 12 paths |
| **API (workers)** | ~40% | **60%** | 75% |

**Enforcement:** CI gates on coverage → `vitest run --coverage` with thresholds:
```json
{
  "branches": 50,
  "functions": 60,
  "lines": 60,
  "statements": 60
}
```

---

## 5. Mocking Strategy

| Layer | Tool | Notes |
|-------|------|-------|
| **API (HTTP)** | `vi.fn()` + global fetch mock | For bridge providers, mock `globalThis.fetch` |
| **Modules** | `vi.mock()` | Mock `@degenfeed/storage`, `@degenfeed/auth`, etc. |
| **Browser APIs** | `happy-dom` | For component/hook tests needing DOM |
| **Timers** | `vi.useFakeTimers()` | For debounce, polling, throttle tests |
| **localStorage** | Direct | Set/clear in `beforeEach`/`afterEach` |

### Global fetch mock pattern (bridge tests):

```ts
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;
```

### Module mock pattern (hook/component tests):

```ts
vi.mock('@degenfeed/storage', () => ({
  getAllIdentities: vi.fn(),
  getPrimaryIdentity: vi.fn(),
}));
```

---

## 6. Test Directory Layout

```
tests/
├── bridge/           # Provider unit/integration tests
│   ├── bluesky.test.ts
│   ├── gotosocial.test.ts
│   ├── lemmy.test.ts
│   ├── peertube.test.ts
│   ├── redlib.test.ts
│   ├── rssbridge.test.ts
│   └── server.test.ts
├── hooks/            # Hook integration tests
│   ├── useFeedData.test.ts
│   ├── useFeedFilters.test.ts
│   ├── useDebounce.test.ts
│   └── useCopyToClipboard.test.ts
├── components/       # Component integration tests
│   └── FeedTuner.test.tsx
├── api/              # API service tests
│   ├── api.test.ts
│   └── feed.test.ts
└── vitest.setup.ts   # Global test setup
```

---

## 7. Running Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# With coverage
npx vitest run --coverage

# Bridge tests only
npx vitest run tests/bridge/

# E2E tests
pnpm --filter degenfeed-web test:e2e

# Visual regression
pnpm --filter degenfeed-web test:visual
```

---

## 8. CI Integration

Tests run in `.forgejo/workflows/ci.yml`:

```yaml
- name: Test
  run: pnpm test

- name: Coverage
  run: npx vitest run --coverage
```

**Quality gates:**
- ✅ All tests pass
- ✅ Coverage thresholds met
- ✅ Lint: `biome check` passes
- ✅ TypeScript: `tsc --noEmit` passes
- ✅ No new TODO/FIXME without associated issue

---

## 9. Writing Tests — Checklist

- [ ] Does the test assert **real behavior** (no `assert(response is not None)`)?
- [ ] Is this an **integration test** first, unit second, E2E last?
- [ ] Are mocks **minimal** — only mock what you don't own?
- [ ] Is the test **isolated** — no shared mutable state?
- [ ] Is the test **readable** — descriptive names, Arrange-Act-Assert?
- [ ] Does cleanup restore global state (timers, fetch, DOM)?
- [ ] Is there a **regression test** for every bug fix?
- [ ] Are **property-based tests** used for serialization/validation?
