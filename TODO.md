# DegenFeed Web — TODO

## Rebuild Sprint: Make DegenFeed a Real Web3 Aggregator

> The current app is functionally broken for users. The backend exists and is mostly wired, but feeds feel empty, cache is stale, the frontend does not look or behave like a modern web3 social app, and the newsletter does not actually pull from the protocols it advertises. This sprint is the hard reset.

### Critical fixes (this session)

- [x] Fix `/api/newsletter/digest` so it fetches from each selected protocol (Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads) instead of only RMI + RSS
- [x] Fix `GTS_AUTH_CONFIG.apiBase` default (`http://127.0.0.1:8082` → `https://social.degenfeed.xyz`)
- [x] Add `noCacheJsonResponse` helper and disable stale caching for `/api/feed/news` and `/api/newsletter/digest`
- [x] Add `cache: 'no-store'` to client-side fetches in `/news`, `/newsletter`, and `/home/[section]`
- [ ] Run `make ci` and `make security` and fix regressions
- [ ] Smoke-test `/newsletter`, `/news`, and `/home/nostr` in local dev / wrangler dev

### 15 Next Moves (ranked by impact)

1. **Make `/home` per-protocol sections actually work**  
   Ensure `/home/nostr`, `/home/farcaster`, `/home/bluesky`, `/home/lens`, `/home/mastodon`, `/home/threads`, and `/home/reddit` each call the correct provider endpoint and render a real feed with loading, error, and empty states. Fix `/home/mastodon` to use `/api/feed/home?protocols=mastodon` (or keep `/api/feed/activitypub` but wire it to the deployed GotoSocial instance).

2. **Rebuild the landing experience**  
   The current app looks like a generic dashboard. Design a web3-first `/twitter` timeline with: compact PostCards, hover actions, quote/repost counts, protocol badges, embedded link previews, and image lightbox. Copy the best parts of Warpcast / Bluesky / X, not a Bootstrap card layout.

3. **Fix the empty-state problem everywhere**  
   Every feed currently shows an empty card with no personality. Add protocol-specific empty states: "No Nostr notes found — try a different relay", "Mastodon timeline is quiet — create the first post @social.degenfeed.xyz", etc., with one-click fixes (switch relay, create account, sign in).

4. **Add real-time / polling updates**  
   The news page polls every 60s for new stories but other timelines do not. Add a global `useFeedPoller` hook that shows a "New posts" banner and lets users pull-to-refresh on mobile and click-to-refresh on desktop.

5. **Replace the RMI hard dependency with a resilient pipeline**  
   RMI is unreachable from Cloudflare edge. The feed should always fall back to public sources without the user noticing. Remove all user-facing "RMI DataBus" copy until the backend is actually deployed and reachable from the edge.

6. **Harden the Mastodon/GotoSocial integration**  
   Our own instance is the most important protocol. Add a dedicated GotoSocial provider path that reads the public timeline from `https://social.degenfeed.xyz/api/v1/timelines/public`, supports hashtag timelines, and lets signed-in users see their home timeline.

7. **Add protocol-aware composer**  
   The composer now shows all protocols. Signed-in protocols are selectable; unsigned protocols show a lock icon and open sign-in when clicked. Added live publish preview (`ComposePreview`) and per-protocol character-limit warnings that disable the Post button when exceeded. Updated both the inline `TwitterComposer` and the `ComposeModal`.

8. **Implement wallet-first authentication**  
   Wallet sign-in is now the primary path in the `SignInModal` (Ethereum + Solana buttons at the top). Added `/api/auth/signout` to clear the `__Host-dfid` cookie, added `signOut` to `AuthProvider`, and exposed it in the `/twitter` header and sidebar. `/api/bridge/rss-to-nostr` now requires the session cookie too.

9. **Add a unified notifications stream**  
   Added `useNotifications` hook that builds auth from all linked identities, polls `POST /api/notifications` every 60s, and persists read state in localStorage. Extended the backend to aggregate notifications from Nostr, Mastodon, and Bluesky. Added the `NotificationBell` to the `/twitter` header and kept it in `/home/[section]`.

10. **Fix ranking and deduplication**  
    Backend now computes and attaches a per-post score breakdown (recency, engagement, relevance, quality, diversity, source, velocity, reasons). `PostCard` shows a `★` badge with hover tooltip exposing each component. Added a "hide low-quality" toggle in `/twitter` (persisted in localStorage) that filters posts with `score.total < 1.0`. The toggle respects the session-bound `hideLowQuality` preference so it can later be moved to a profile page.

11. **Add cross-posting to the bridge**
    Wire `/api/bridge/rss-to-nostr` and a general `/api/publish` to cross-post from Mastodon to Nostr, Farcaster to Bluesky, etc. Start with one working pair (Mastodon → Nostr) and expose it in the composer.

12. **Build a mobile-first responsive layout**  
    The current layout is desktop-only with a hidden right sidebar. Implement a bottom nav (Home, Search, Notifications, Profile) for mobile, collapsible sidebars, and proper safe-area handling.

13. **Add protocol health dashboard**  
    `/api/feed/health` exists but is not exposed in the UI. Add a `/status` page (or admin panel) showing each protocol's latency, success rate, and last fetched time so users know when a feed is degraded.

14. **Add search that actually searches**  
    `/api/search` and `/api/search/identity` are wired. Add a global search bar in the shell that searches posts, identities, and niches across protocols, with filters for protocol and time range.

15. **Ship the newsletter as a real product**  
    After the digest works, add an actual email-sending path (Postmark / SES) and a cron trigger that builds the daily digest from live data and sends it to subscribers. Add a `/newsletter/manage` page with preferences and unsubscribe.

## Active
- [x] Add lightweight Twitter/X-style timeline (`/twitter`)
- [x] Inline composer with per-protocol toggles, lock icons, and preview
- [x] Wallet-first authentication with sign-out UI
- [x] Unified notifications stream with real bell and unread counts
- [x] Ranking transparency: score badge, hover breakdown, hide-low-quality toggle
- [x] "For You" and "Following" tabs
- [x] Wire logo into Shell and home page
- [x] Backend fixes: Nostr NIP-23 long-form support + HTTP fallback
- [x] Fix newsletter digest to fetch from all selected protocols
- [x] Fix GotoSocial default API base URL
- [x] Add no-cache helpers for dynamic feed endpoints
- [x] Add no-store fetches to client feed pages
- [x] Rebuild PostCard and protocol-aware composer

## Next
- [ ] Cross-posting bridge (#11): Mastodon → Nostr working pair exposed in composer
- [ ] Set `RMI_BACKEND_URL` in `workers/api/wrangler.toml` for production RSS data
- [ ] Harden Reddit fetching against CF Worker blocks (prefer `old.reddit.com` RSS)
- [ ] Harden Threads scraper or reduce curated handle set
- [ ] Cache provider results in `CACHE` KV for 60–180s to reduce latency
- [ ] Server-side filter for Following tab instead of client-side filtering
- [ ] Add real-time updates to timeline
- [ ] Add repost/quote preview in composer
- [ ] Improve mobile layout (currently hides right sidebar)
- [ ] Add notification bell to Twitter timeline
- [ ] Fix GotoSocial `trusted-proxies` warning on deployed instance (`social.degenfeed.xyz`)

## Blocked
- None

## Done
- apps/landing live at degenfeed.xyz
- apps/web live at app.degenfeed.xyz
- CI, Makefile, pre-commit configured
- Protocol SDKs, feed-core, ranking, identity packages
- `/news`, wallet sign-in, composer, feed aggregation
- Fixed critical syntax error in `packages/feed-providers/src/providers/nostr.ts`
- Fixed monorepo type errors across utils, ranking, feed-providers, ui, api-worker, web
- Fixed Biome lint errors across packages and worker
- Created `/twitter` route with X-style layout using existing components
- Added `@degenfeed/storage` dependency to `@degenfeed/ui` package
- Created `packages/utils/tsconfig.json`
- Upgraded `@biomejs/biome` in `@degenfeed/api-worker` to match monorepo version
- Replaced `<img>` elements with `next/image` across the web app for performance
- Fixed all remaining Biome lint warnings (unused imports/variables in legacy files)
- Made `/twitter` the default landing page (redirect `/` → `/twitter`)
- Added DegenFeed logo to the Twitter timeline header
- Fixed RSS/RMI fallback to avoid the 6s timeout when `RMI_BACKEND_URL` is unset
- Fixed default protocols in `/api/feed/home` to exclude `ethereum`/`solana`
- Audited full feed data flow: providers are wired to real endpoints; RMI timeout was the main blocker
- Mocked `@degenfeed/rss-sdk` in `workers/api/src/__tests__/curated.test.ts` to stop flaky network timeouts
- Added `.gitleaks.toml` allowlist for generated `.vercel` build tokens and marked `GTS_CLIENT_ID` as allowed; `make security` now passes
