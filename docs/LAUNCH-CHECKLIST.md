# DegenFeed — Launch Readiness Checklist

> Final QA pass executed 2026-07-18 (Talos + Hydra + live endpoints).
> Legend: ✅ pass · ⚠️ partial/degraded · ❌ fail
> **Readiness score: 30/50 checks passing** (10 ⚠️ partial, 10 ❌ failing)
> **Verdict: NOT READY — 5 launch blockers (B1–B5 below)**

---

## DNS & Domains — 6/6 ✅

- [x] app.degenfeed.xyz → Cloudflare (104.21.11.201 / 172.67.167.66), HTTP 200 ✅
- [x] community.degenfeed.xyz → Cloudflare → Lemmy (API `/api/v3/site` responds) ✅
- [x] video.degenfeed.xyz → [TALOS_PUBLIC_IP] direct → PeerTube (root 200) ✅
- [x] social.degenfeed.xyz → Cloudflare → GotoSocial (instance API responds) ✅
- [x] n8n.rugmunch.io → Cloudflare, HTTP 200 ✅
- [x] All domains have valid SSL ✅
  - app: exp 2026-10-04 · community/social: 2026-09-30 · video: 2026-10-15 · n8n: **2026-09-14 (renews first — verify auto-renew)**

## Infrastructure — 0/4 (2 ⚠️, 2 ❌)

- [ ] All Docker containers healthy ⚠️
  - 75 containers up. `degenfeed-lemmy` + `peertube-peertube-1` report **unhealthy**, but the cause is broken healthchecks (`wget` missing inside containers) — both services respond over HTTPS. Fix the healthcheck commands.
- [ ] Disk usage <85% ❌ **CRITICAL**
  - Talos `/`: **94–95%** (937G/1007G, 61G free)
  - Hydra `/`: **100% FULL** (193G/193G, 0 free) — next backup run will fail
- [ ] Memory within limits ⚠️
  - Talos RAM OK (17/31 GiB) but **swap 100% used (8/8 GiB)** — memory pressure. Hydra fine (7.9/23 GiB).
- [ ] All services restart automatically ❌
  - `rmi-backend` and `rmi-anvil` have restart policy **`no`**. Everything else is `always`/`unless-stopped`.

## Backups — 1/5 (2 ⚠️, 2 ❌)

- [ ] All 4 DBs backing up ❌
  - Postgres ✅ (today, encrypted .age) · ClickHouse ✅ (today) · Redis ✅ (today) · Qdrant ✅ (20 collections → R2 `rag-backup`, today)
  - **Neo4j ❌ — latest dump is 2026-07-17 17:23; today's 00:00 run logged `--- Neo4j ---` then produced nothing (silent hang/failure)**
- [ ] Off-site R2 sync ❌ **CRITICAL**
  - `offsite-backup.sh` logs `Off-site backup replication FAILED (multi-dest)` — R2 destination not confirmed.
  - Root cause verified: **`r2-crypt:backups` contains 0 files / 0 bytes.** A plaintext `backups/` dir sits inside `r2:fleet-backup`, which the crypt remote (directory_name_encryption=true) cannot decrypt → "Skipping undecryptable dir name". Nothing is actually replicated off-site.
- [ ] Hydra backups working ⚠️
  - `hydra-backup.sh` completed 2026-07-18 01:17 (5.8G in /backups/hydra) — but **disk is now 100% full**, so tonight's run will fail.
- [ ] Backup alerting active ⚠️
  - `backup-monitor.sh` (hourly) + dead-man's-switch (30 min) running; email alert path only. Healthchecks.io/Kuma push not wired (see Monitoring).
- [x] Sentinel file recent (<24h) ✅ — `/backups/.last-successful-backup` at 2026-07-17 18:49 (~17h)

## Monitoring — 2/5 (3 ❌)

- [ ] Prometheus scraping all targets ❌
  - fleet-prometheus (:9091): **7 up / 3 down** — `degenfeed-http` (/metrics timeout), `hydra-node` (9100 → 404), `talos-node` (timeout via Tailscale IP)
- [x] Grafana dashboards showing data ✅ — 5 dashboards (DegenFeed Fleet Health, DegenFeed Metrics, Agent Fleet, CI/CD, LLM Costs); datasource query verified live
- [ ] Alert rules configured ❌
  - **fleet-prometheus has 0 rule groups / 0 rules.**
  - rmi-prometheus has 22 rules but 5 firing: `BackendDown, RedisDown, PostgresDown, AlertManagerDown, PrometheusConfigReloadFailed` — mostly stale target configs, and **no Alertmanager container exists** → alerts route nowhere.
- [x] Dead man's switch active ✅ — runs every 30 min, writes `/backups/.dead-mans-switch`, "All checks passed" at 10:00Z
- [ ] Healthchecks.io integrated ❌
  - `dead-mans-switch.sh` supports `HEALTHCHECKS_URL` but **never sources `fleet-infra/.env`** (where the URLs live) and cron provides no env → zero "Pinged healthchecks.io" entries in the log.

## Security — 6/6 ✅

- [x] Secrets in gopass ✅ — `degenfeed/` tree populated (auth, email, SMTP); hardcoded-secret grep over apps/workers/packages: clean. (Note: REMAINING.md lists 4 legacy external keys pending rotation — track separately.)
- [x] npm audit clean ✅ — `pnpm audit --prod`: **0 critical, 0 high**, 2 moderate
- [x] API endpoints authenticated ✅ — `apiKeyMiddleware` on `/v1/*`, OAuth flows for auth routes
- [x] Rate limiting active ✅ — `rateLimit(c.env, ip, path, maxReq, windowMs)` in worker
- [x] CORS configured ✅ — env-driven allowlist (`ALLOWED_ORIGINS`), origin-parsing + cache, tests present
- [x] .env not in git ✅ — only `apps/web/.env.example` tracked in both repos

## Performance — 4/5 (1 ❌)

- [ ] Lighthouse 90+ ❌ NOT VERIFIED
  - `lighthouse` binary not installed on Talos; `scripts/lighthouse.sh` + `.lighthouserc.json` exist but no recent results. **Blocking concern: `/api/feed/home` takes 23s cold / 10s warm — any perf score will crater if the feed blocks render.**
- [x] Images optimized ✅ — `next.config.mjs` formats: `['image/avif','image/webp']` + cache TTL
- [x] CSS minimized ✅ — production CSS verified minified (43KB)
- [x] Bundle splitting ✅ — Next.js 16 chunked output on Cloudflare Pages
- [x] Lazy loading ✅ — `dynamic()`/`lazy()` in feed, post, creator, settings pages

## SEO — 5/5 ✅

- [x] Sitemap accessible ✅ — /sitemap.xml → 200
- [x] Robots.txt ✅ — /robots.txt → 200
- [x] OpenGraph tags ✅ — og:title/description/url/site_name/image (1200px, generated) on landing
- [x] Structured data ✅ — 1 `application/ld+json` block present
- [x] Meta descriptions ✅ — verified on landing; spot-check remaining routes post-fix

## Content — 2/5 (1 ⚠️, 2 ❌)

- [x] Landing page live ✅ — app.degenfeed.xyz → 200 with full meta
- [ ] Content sources populating ⚠️
  - Feed health: **7/9 providers healthy** — rss ❌ (HTTP 403 upstream), ponder ❌; reddit/nostr/farcaster/lens/bluesky/mastodon/threads ✅
- [ ] Lemmy communities have content ❌ — **0 communities exist** (`/api/v3/community/list` empty, site created 2026-07-17)
- [ ] PeerTube videos available ❌ — **0 videos** (`/api/v1/videos` → total: 0)
- [x] Feed returning data ✅ — nostr/farcaster/mastodon return items (but see latency blocker B4)

## User Experience — 1/5 (3 ⚠️, 1 ❌)

- [ ] Onboarding works end-to-end ❌ NOT VERIFIED
  - e2e specs exist (auth, feed, communities, post, search, smoke, visual) but **workers/api unit suite: 38 FAILED / 121 passed** (cors, engage, session, preferences, identity, billing suites failing) and root vitest is broken (jsdom dep resolution, 69 errors). Cannot claim green.
- [x] No broken links ✅ — all 10 internal landing links → 200
- [ ] All modals closeable ⚠️ — covered by e2e specs; not verifiable until suite runs
- [ ] Error states handled ⚠️ — handlers present in code; failing tests reduce confidence
- [ ] Mobile responsive ⚠️ — Tailwind + viewport meta present; no visual verification this pass

## Legal — 3/4 (1 ⚠️)

- [x] Privacy policy ✅ — /privacy → 200
- [x] Terms of service ✅ — /terms → 200
- [x] Community guidelines ✅ — /guidelines → 200
- [ ] Cookie consent ⚠️ — no consent banner component found; auth cookies are set via Shell.tsx. If only strictly-necessary cookies are used, document that in /privacy; if any analytics land, a banner is required (GDPR/ePrivacy).

---

# Fix Plans for Failures

| # | Failure | Fix | Effort |
|---|---------|-----|--------|
| B1 | **Hydra disk 100% full** | Prune old /backups/hydra archives + docker system prune; add retention cap; add disk alert at 85% | 1–2h |
| B2 | **Off-site R2 sync broken (0 bytes replicated)** | Remove plaintext `backups/` dir from `r2:fleet-backup`, re-run `offsite-backup.sh`, verify `rclone lsf r2-crypt:backups` non-empty; add file-count check to multi-dest confirm | 2–4h |
| B3 | **Neo4j backup silently failing** | Debug `db-backup.sh` Neo4j section (likely `neo4j-admin dump` hang or disk pressure); add per-DB timeout + failure exit code | 2–3h |
| B4 | **/api/feed/home 10–23s latency** | Profile aggregator: parallelize provider fetches, cap per-provider timeout (~2s), serve stale-while-revalidate from KV/cache | 1–2d |
| B5 | **Talos disk 94–95%** | Prune docker images/volumes, rotate ClickHouse/Loki retention, move cold backups off-box (after B2) | 2–4h |
| F6 | Restart policy `no` on rmi-backend/rmi-anvil | `docker update --restart unless-stopped rmi-backend rmi-anvil` + fix compose | 15m |
| F7 | Prometheus: 3 targets down | Fix hydra-node port (404 → node-exporter path), talos-node Tailscale route, decide degenfeed /metrics exposure (or drop job) | 1–2h |
| F8 | fleet-prometheus 0 alert rules | Add rule pack (disk >85%, target down, backup age >26h, cert expiry <14d, swap >90%); deploy Alertmanager or route via Kuma/n8n | 3–5h |
| F9 | Healthchecks.io not pinged | Source `/srv/work/repos/fleet-infra/.env` at top of `dead-mans-switch.sh` (or set vars in crontab); confirm "Pinged healthchecks.io" in log | 30m |
| F10 | Lemmy 0 communities | Create 5–8 seed communities (memecoins, defi, nfts, security, general) + seed 3–5 posts each; fix container healthcheck (`wget` → `curl`) | 2–3h |
| F11 | PeerTube 0 videos | Upload 3–5 launch videos or import via yt-dlp federation; fix container healthcheck | 2–4h |
| F12 | RSS provider 403 | Upstream blocks default UA — set custom User-Agent in rss-bridge/fetcher or proxy via FlareSolverr | 1–2h |
| F13 | API worker tests 38 failing | Triage: most failures cluster in cors/session/preferences/identity — likely missing test env bindings after env-driven CORS refactor; fix fixtures | 0.5–1d |
| F14 | Root vitest broken | pnpm dedupe/reinstall to fix jsdom → @asamuzakjp/css-color resolution | 1h |
| F15 | Lighthouse unverified | `npm i -g lighthouse` or run `scripts/lighthouse.sh --ci` in CI against prod; needs B4 first to score well | 1h + B4 |
| F16 | Cookie consent decision | Audit cookies set; if strictly necessary only → add statement to /privacy; else add consent banner | 2–4h |
| F17 | Swap 100% used (Talos) | Identify top swap consumers, restart leakers, consider raising RAM limits or trimming container count | 1–2h |

---

# Pre-Launch Action Items (prioritized)

## P0 — Launch blockers (do first, ~2 days)
1. **B1 Hydra disk 100%** — backups die tonight without this. (1–2h)
2. **B2 Off-site R2 replication** — currently zero off-site copies of DB backups; single-server data-loss risk. (2–4h)
3. **B5 Talos disk 94%** — at 100% every DB and container on the box degrades. (2–4h)
4. **B3 Neo4j backup** — restore untested data = data at risk. (2–3h)
5. **B4 Home feed latency 10–23s** — first-run UX is the product; unshippable as-is. (1–2d)

## P1 — Must-do before announcing (1–2 days)
6. **F6 restart policies** (15m) — rmi-backend won't survive a reboot.
7. **F9 Healthchecks.io wiring** (30m) — external alerting for backup failures.
8. **F8 alert rules + Alertmanager/Kuma routing** (3–5h) — right now nothing pages you.
9. **F7 Prometheus targets** (1–2h) — blind spots on both hosts.
10. **F10 + F11 seed content** (4–7h) — empty Lemmy/PeerTube kills first impressions.
11. **F13 + F14 test suite green** (1–1.5d) — then run e2e onboarding + modal/error specs to close UX checks.

## P2 — Should-do launch week
12. **F12 RSS provider 403** — restores 8th content source.
13. **F15 Lighthouse CI run** — verify 90+ after B4 lands.
14. **F16 cookie consent decision** — legal exposure is low but nonzero.
15. **F17 swap pressure** — stability under launch traffic.
16. Fix Lemmy/PeerTube container healthchecks (cosmetic but hides real regressions).
17. Verify n8n cert auto-renewal (expires 2026-09-14, first of the fleet).

---

*Generated by final QA sweep 2026-07-18. Re-run each command in this doc after fixes; flip ❌→✅ only with fresh evidence.*
