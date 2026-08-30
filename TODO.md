# degenfeed — Production TODO
**Last audit:** 2026-08-30 · **Status:** Live & serving (systemd standalone), rough edges · **Grade:** C

## ✅ FIXED 2026-08-30 (CI/CD + deploy + nginx + secrets pass)

- [x] **STATUS.md contradiction** — rewritten: app IS live via `degenfeed-web.service` (systemd standalone, :3100); Workers/Pages retired.
- [x] **README vs STATUS contradiction** — README architecture + badges updated to the same truth.
- [x] **ROADMAP "Completed" falsehoods** — Cloudflare Pages/Worker deploy claims corrected to systemd/bridge reality.
- [x] **CI dead on push** — all jobs moved to the runner's real label `docker-x64`; duplicate `.github/workflows/` tree deleted (concurrency-group mutual cancellation).
- [x] **deploy.yml fantasy** — nonexistent `docker/build-and-push-action@v6` + `docker compose pull web` replaced with the systemd deploy path (SSH → git reset → build → `systemctl restart degenfeed-web` → health check).
- [x] **nginx 502s** — `deploy/nginx/` now routes `/api/feed`, `/api/rss`, `=/api/health` (+ `/v1`, `/health`) to the live bridge (:8787) instead of dead GoToSocial (:8082) / retired api container (:3101); live `app.degenfeed.xyz` vhost versioned into the repo.
- [x] **Cosmetic gates** — `pnpm audit` pipefail fixed; duplicate `smoke:` key removed; fake `contract`/`fuzz`/`visual-regression` jobs removed (nonexistent scripts / no baselines); `sign-image` removed; Trivy → filesystem scan; coverage gate = vitest thresholds.
- [x] **Workers build gate** — literal `echo` → real `wrangler deploy --dry-run --outdir dist`; `deploy` script injects `POSTIZ_API_KEY` from env (fails fast if unset).
- [x] **Stoat secrets** — `stoat_changeme` / `stoat_secret_key_change_in_production` defaults removed; compose now requires `STOAT_DB_PASSWORD` + `STOAT_SECRET_KEY` from env (gopass).
- [x] **`ignoreBuildErrors`** — flag already removed from next.config.mjs; `pnpm typecheck` now actually runs as a blocking CI job (runner label was the blocker).

## 🔴 BLOCKING

- [ ] **CRITICAL: Wire creator coin trade/deploy to real contracts** — `apps/web/src/app/api/creator-coin/trade/route.ts:26-29` returns fake `txHash: placeholder_${Date.now()}`. `apps/web/src/app/api/creator-coin/deploy/route.ts:24-32` returns fake mockAddress. Solidity contracts compile (`contracts/out/`), Anchor program builds — connect UI to contracts.
- [ ] **CRITICAL: Replace simulated DAO deployment** — `apps/web/src/app/dao/create/page.tsx:90-107`: `crypto.randomUUID()` as deployed address, `setTimeout` progress, fake Snapshot space. Implement real factory call or gate the UI.
- [ ] **CRITICAL: Replace seeded fake coin charts** — `apps/web/src/app/coins/[symbol]/page.tsx:93`: `generatePriceData(days, seed)` is fabricated. Connect to real price feed.
- [ ] **CRITICAL: Remove `alert()` fake trade** — `coins/[symbol]/page.tsx:887-890`: `executeTrade = alert("✅ Bought/Sold ...")`. Wire to real contract interaction.
- [ ] **CRITICAL: Fix Lens feed broken** — GraphQL schema mismatch `"Unknown field \"id\" on type \"AnyPost\""`. Local indexer (3,977 pubs) unreachable from Worker edge. Fix query or proxy through bridge.
- [ ] **CRITICAL: Fix `ignoreBuildErrors: true`** — ✅ flag removed (2026-08); `tsc --noEmit` is now a blocking CI job (2026-08-30). Remaining: burn down the surfaced TS errors.

## 🟠 HIGH

- [ ] **Implement `/api/news/*` in deployed bridge** — worker has full news implementation (202 sources, aggregator), but deployed bridge serves stubs. Either deploy worker to Cloudflare or implement news routes in bridge.
- [ ] **Fix 14/38 worker test suites** — `workers/api` missing `@degenfeed/realtime` dep in `package.json`. One-line fix unblocks 88 tests.
- [ ] **Fix feed-core diversity regression** — 3 tests fail: interleaving, creator-rotation, category-limit contracts broken in `diversity.ts`.
- [ ] **Fix apps/web hook tests** — `useFeedPoller` 16 failures (React 19 act issues), `AuthProvider` parse error.
- [ ] **Fix stale root `tests/` harness** — 29 failing files: deps resolution, playwright/vitest split, live-network tests.
- [ ] **Fix Farcaster latency** — 3.5s degraded health. Consider switching fully to Hubble when ≥90% synced.
- [ ] **Fix Nostr feed intermittency** — first probe empty, second populated. Relay pool has flaky local relay.
- [ ] **Fix hardcoded MeiliSearch key** — `feed-worker/server.ts`: `dev-key-change-in-production` default.
- [x] **Fix hardcoded STOAT_DB_PASSWORD/SECRET_KEY defaults** — docker-compose.stoat.yml now requires both via `${VAR:?}` (2026-08-30).

## 🆕 NEW (2026-08-30 CI/deploy/nginx pass — follow-ups)

- [ ] **Fix `playwright.config.ts` webServer port** — hardcodes 3000; the Forgejo runner uses host networking where 127.0.0.1:3000 is Forgejo → EADDRINUSE. Change to `process.env.CI ? 3456 : 3000` (+ baseURL), then remove `continue-on-error` from the CI `e2e`/`a11y` jobs. *(apps/web owners)*
- [ ] **Freeze Dockerfile lockfile** — `apps/web/Dockerfile:22` runs `pnpm install --no-frozen-lockfile`; change to `--frozen-lockfile`. *(apps/web owners)*
- [ ] **Move `POSTIZ_API_KEY` out of `workers/api/wrangler.toml:202` `[vars]`** — still carries the literal `"${POSTIZ_API_KEY}"` placeholder; `wrangler secret put POSTIZ_API_KEY` + delete the var line. *(workers owners)*
- [ ] **LIVE nginx re-point (lead)** — copy `deploy/nginx/{app,api,social}.degenfeed.xyz` → `/srv/degenfeed/nginx/`, symlink into `/etc/nginx/sites-enabled/`, `nginx -t && systemctl reload nginx`.
- [ ] **Validate deploy pipeline (lead)** — set `DEPLOY_HOST`/`DEPLOY_USER`/`DEPLOY_SSH_KEY` Forgejo secrets + passwordless sudo for `systemctl restart degenfeed-web`, then run `.forgejo/workflows/deploy.yml` once via `workflow_dispatch`.
- [ ] **Optional (lead)** — add an `ubuntu-latest` alias label to `/etc/forgejo-runner/config.yaml` (not required while jobs target `docker-x64`).

## 🟡 MEDIUM

- [x] **Fix STATUS.md** — ✅ rewritten 2026-08-30 (app IS deployed and live via systemd).
- [x] **Fix README vs STATUS contradiction** — ✅ reconciled 2026-08-30 (see FIXED section).
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
- [ ] Remove duplicate degenfeed.service (failed systemd unit)
- [ ] Fix RSS health 403s from tier-1 sources
- [ ] Consider CDN image optimization

## Tests
- [ ] Fix 118 vitest failures in apps/web
- [ ] Fix 14/38 worker test suites (missing dep)
- [ ] Fix 3 feed-core diversity tests
- [ ] Fix 29 root tests/ harness issues
- [ ] Make tsc blocking (currently hidden by ignoreBuildErrors)
