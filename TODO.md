# degenfeed-web — Production TODO
**Last audit:** 2026-07-31 · **Status:** Live & serving, rough edges · **Grade:** C

## 🔴 BLOCKING

- [ ] **CRITICAL: Wire creator coin trade/deploy to real contracts** — `apps/web/src/app/api/creator-coin/trade/route.ts:26-29` returns fake `txHash: placeholder_${Date.now()}`. `apps/web/src/app/api/creator-coin/deploy/route.ts:24-32` returns fake mockAddress. Solidity contracts compile (`contracts/out/`), Anchor program builds — connect UI to contracts.
- [ ] **CRITICAL: Replace simulated DAO deployment** — `apps/web/src/app/dao/create/page.tsx:90-107`: `crypto.randomUUID()` as deployed address, `setTimeout` progress, fake Snapshot space. Implement real factory call or gate the UI.
- [ ] **CRITICAL: Replace seeded fake coin charts** — `apps/web/src/app/coins/[symbol]/page.tsx:93`: `generatePriceData(days, seed)` is fabricated. Connect to real price feed.
- [ ] **CRITICAL: Remove `alert()` fake trade** — `coins/[symbol]/page.tsx:887-890`: `executeTrade = alert("✅ Bought/Sold ...")`. Wire to real contract interaction.
- [ ] **CRITICAL: Fix Lens feed broken** — GraphQL schema mismatch `"Unknown field \"id\" on type \"AnyPost\""`. Local indexer (3,977 pubs) unreachable from Worker edge. Fix query or proxy through bridge.
- [ ] **CRITICAL: Fix `ignoreBuildErrors: true`** — `apps/web/next.config.mjs:119` hides 628 TS errors. Remove flag, fix errors (start with `packages/realtime` imports).

## 🟠 HIGH

- [ ] **Implement `/api/news/*` in deployed bridge** — worker has full news implementation (202 sources, aggregator), but deployed bridge serves stubs. Either deploy worker to Cloudflare or implement news routes in bridge.
- [ ] **Fix 14/38 worker test suites** — `workers/api` missing `@degenfeed/realtime` dep in `package.json`. One-line fix unblocks 88 tests.
- [ ] **Fix feed-core diversity regression** — 3 tests fail: interleaving, creator-rotation, category-limit contracts broken in `diversity.ts`.
- [ ] **Fix apps/web hook tests** — `useFeedPoller` 16 failures (React 19 act issues), `AuthProvider` parse error.
- [ ] **Fix stale root `tests/` harness** — 29 failing files: deps resolution, playwright/vitest split, live-network tests.
- [ ] **Fix Farcaster latency** — 3.5s degraded health. Consider switching fully to Hubble when ≥90% synced.
- [ ] **Fix Nostr feed intermittency** — first probe empty, second populated. Relay pool has flaky local relay.
- [ ] **Fix hardcoded MeiliSearch key** — `feed-worker/server.ts`: `dev-key-change-in-production` default.
- [ ] **Fix hardcoded STOAT_DB_PASSWORD/SECRET_KEY defaults** — docker-compose defaults.

## 🟡 MEDIUM

- [ ] **Fix STATUS.md** — says "never deployed" / "apps/web never deployed to app.degenfeed.xyz". App IS deployed and live.
- [ ] **Fix README vs STATUS contradiction** — README says "Live at app.degenfeed.xyz", STATUS says "never deployed". Also ROADMAP marks deploy as "Completed" while STATUS says "Not started".
- [ ] **Remove demo/seed content** — `feed/seed-content.ts`, `unified-feed.ts` seedFallback with `_demo: true` marker, coin page DEMO DATA banner.
- [ ] **Fix 510 console.log statements** (55 in workers/api alone).
- [ ] **Fix notification bell** — wired to empty arrays `notifications={[]} onFetch={() => {}}`.
- [ ] **Fix Biome a11y rules** — downgraded from error→warn for interactive components. Restore error severity.
- [ ] **Fix bundle size** — 7.7MB static, 6.4MB JS, 515 chunks, 379KB single chunk near limit.
- [ ] **Audit x402 — zero usage** in app despite being a stated payment rail.
- [ ] **Fix docs/PROTOCOL_AUDIT.md** — says "100% fallback/mock data" but live data is real. Update.
- [ ] **Fix ghost-bridge crossPublish** — marked deprecated in changelog but still referenced.

## 🟢 LOW

- [ ] Add per-package coverage enforcement (thresholds set in vitest config, not enforced in CI)
- [ ] Add tests for unified-feed orchestrator
- [ ] Add tests for crossposter
- [ ] Fix `middleware.ts` → `proxy.ts` rename in docs
- [ ] Run knip dead-code analysis
- [ ] Remove duplicate degenfeed-web.service (failed systemd unit)
- [ ] Fix RSS health 403s from tier-1 sources
- [ ] Consider CDN image optimization

## Tests
- [ ] Fix 118 vitest failures in apps/web
- [ ] Fix 14/38 worker test suites (missing dep)
- [ ] Fix 3 feed-core diversity tests
- [ ] Fix 29 root tests/ harness issues
- [ ] Make tsc blocking (currently hidden by ignoreBuildErrors)
