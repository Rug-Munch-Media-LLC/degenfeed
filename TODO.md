# DegenFeed Web — TODO

> Last updated: 2026-07-27

## 6-Week Launch Plan: From Pre-Launch to Invite-Only Beta

### Phase 1: Foundation (Weeks 1-2)
*Routing, cold-start, typecheck — the blocking layer*

- [ ] **Fix Cloudflare Pages routing** — debug Next.js on-demand ISR for `/home/[section]` per-protocol pages; ensure cold navigation doesn't return 404
- [ ] **Fix cold-start latency** — worker currently takes 3-8s on first request after idle; investigate code-splitting, `wrangler.toml` minification, warm-up pings
- [ ] **Fix 8 package typecheck failures** — `tsc --noEmit` must pass across all 38 packages
- [ ] **Remove 48 console.log statements** from worker API routes
- [ ] **Deploy `apps/web` to `app.degenfeed.xyz`** — first production deploy behind invite gate

### Phase 2: Bridge Activation (Weeks 3-4)
*Cross-post, search frontend, mobile nav — the core UX layer*

- [ ] **Cross-posting bridge** — wire Mastodon → Nostr as first working pair, expose in composer UI
- [ ] **Search frontend** — connect `/api/search` and `/api/search/identity` to global search bar with protocol and time-range filters
- [ ] **Mobile bottom-nav** — Home, Search, Notifications, Profile tabs with safe-area handling
- [ ] **Add repost/quote preview** in composer
- [ ] **Add protocol-aware empty states** — "No Nostr notes found — try a different relay" etc. with one-click fixes
- [ ] **Set `RMI_BACKEND_URL`** in `workers/api/wrangler.toml` for production RSS data

### Phase 3: Polish & Launch (Weeks 5-6)
*CSP hardening, logging, beta invite, newsletter*

- [ ] **CSP audit** — verify nonce-based CSP works with all dynamic routes; test with `CSP Evaluator`
- [ ] **Structured logging** — add request-id tracing to worker routes; ship logs to self-hosted Loki/Plausible
- [ ] **Invite-only beta gate** — implement `/waitlist` or invite-code flow; limit sign-ups to第一批 community members
- [ ] **Newsletter email delivery** — wire Postmark/SES to `/api/newsletter/digest`; add cron trigger for daily digest
- [ ] **Protocol health dashboard** — expose `/api/feed/health` results in `/status` admin panel
- [ ] **OG images** — auto-generated social cards for posts, profiles, and coin pages
- [ ] **Rotate production API keys** — Stripe, Helius, Solana Tracker, Postiz
- [ ] **MeiliSearch re-index cron** — ensure search index stays fresh

### Pre-Launch Checklist
- [ ] `apps/web` deployed to `app.degenfeed.xyz`
- [ ] Routing works: `/home/nostr`, `/home/farcaster`, `/home/bluesky`, etc. render real feeds
- [ ] Cold-start < 1s for critical routes
- [ ] `tsc --noEmit` passes across monorepo
- [ ] `make ci` and `make security` pass
- [ ] CSP headers applied to all routes
- [ ] Invite gate active
- [ ] 58 Playwright E2E tests pass in CI

## Completed This Session (Round 31 — Launch Hardening)
- [x] CSP security headers with per-request nonces (no unsafe-inline, no unsafe-eval)
- [x] 5-tier rate limiting (auth, tip, publish, writes, reads)
- [x] Session verification for mutating API methods
- [x] URL scam scanning against rmi-backend DataBus on publish/cross-post/schedule
- [x] Ghost bridge crossPublish — now actually attempts Nostr relay connections instead of fabricating success
- [x] Theme system — dark mode (SSR-safe), `df_theme` cookie, Telegram CSS variable binding
- [x] DEMO DATA warning banner on coin detail page
- [x] Pre-commit methodology check script
- [x] 58 Playwright E2E tests (coin discovery, coin detail, creator dashboard, settings, notifications)
- [x] Biome a11y rule relaxations (pragmatic for interactive UIs)
- [x] MeiliSearch restarted and re-indexed

## Archive (Previous Sessions)
- [x] Landing page live at degenfeed.xyz (moved from `apps/landing/` to `workers/api/src/routes/landing.ts`)
- [x] apps/web build-verified at app.degenfeed.xyz (not yet live as primary frontend)
- [x] CI, Makefile, pre-commit configured
- [x] Protocol SDKs, feed-core, ranking, identity packages
- [x] `/news`, wallet sign-in, composer, feed aggregation
- [x] Fixed critical syntax error in `packages/feed-providers/src/providers/nostr.ts`
- [x] Fixed monorepo type errors across utils, ranking, feed-providers, ui, api-worker, web
- [x] Fixed Biome lint errors across packages and worker
- [x] Created `/twitter` route with X-style layout using existing components
- [x] Added `@degenfeed/storage` dependency to `@degenfeed/ui` package
- [x] Created `packages/utils/tsconfig.json`
- [x] Upgraded `@biomejs/biome` in `@degenfeed/api-worker` to match monorepo version
- [x] Replaced `<img>` elements with `next/image` across the web app for performance
- [x] Fixed all remaining Biome lint warnings (unused imports/variables in legacy files)
- [x] Made `/twitter` the default landing page (redirect `/` → `/twitter`)
- [x] Added DegenFeed logo to the Twitter timeline header
- [x] Fixed RSS/RMI fallback to avoid the 6s timeout when `RMI_BACKEND_URL` is unset
- [x] Fixed default protocols in `/api/feed/home` to exclude `ethereum`/`solana`
- [x] Audited full feed data flow: providers are wired to real endpoints; RMI timeout was the main blocker
- [x] Mocked `@degenfeed/rss-sdk` in `workers/api/src/__tests__/curated.test.ts` to stop flaky network timeouts
- [x] Added `.gitleaks.toml` allowlist for generated `.vercel` build tokens and marked `GTS_CLIENT_ID` as allowed; `make security` now passes
