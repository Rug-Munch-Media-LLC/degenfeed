# DegenFeed Protocol Integration Audit

**Date:** 2026-07-24  
**Auditor:** Automated infrastructure audit  
**Status:** CRITICAL ISSUES FOUND — 20 protocols architected, 8 services running, 5 with functional issues, 7 not deployed

---

## Executive Summary

DegenFeed architecture defines **20 content protocols** across 8 network categories. Of these, **8 self-hosted protocol services** are deployed as Docker containers, but **5 have critical integration issues** (no federation, URL mismatches, zero real data flow). **7 protocol services** are defined in docker-compose.full.yml but **never deployed**. The bridge server returns **100% fallback/mock data** — no live content flows through the local development bridge.

**Overall health: DEGRADED.** The system architecture is comprehensive, but the implementation has significant gaps between design and reality.

---

## 1. Protocol Inventory

### 1.1 Self-Hosted Infrastructure

| Service | Protocol | URL | Port | Status | Uptime |
|---------|----------|-----|------|--------|--------|
| **GoToSocial** | ActivityPub/Mastodon | social.degenfeed.xyz | 8082 | ✅ Running v0.22.0 | 5h |
| **AT Protocol PDS** | Bluesky/ATProto | pds.degenfeed.xyz | 3012 | ✅ Running v0.4.5009 | 5h |
| **PeerTube** | ActivityPub/Video | video.degenfeed.xyz | 9011 | ✅ Running (5 videos) | 5h |
| **Lemmy** | ActivityPub/Discussion | talk.degenfeed.xyz *(see issue)* | 8536 | ✅ Running v0.19.11 | 5h |
| **RSS-Bridge** | RSS/Atom | rss-bridge.degenfeed.xyz | 8282 | ✅ Running | 4h |
| **Activity Relay** | ActivityPub Relay | relay.degenfeed.xyz | 8084 | ✅ Running v2.0.10 | 4h |
| **Ghost** | Blog/CMS | rmi-ghost (internal) | 2368 | ✅ Running | 5h |
| **Postiz** | Social Scheduler | degenfeed-postiz | 3105 | ✅ Running | 5h |

### 1.2 NOT Deployed (Defined in Infra, Never Started)

| Service | Protocol | Compose Location | Impact |
|---------|----------|-----------------|--------|
| **Nostr Relay** | Nostr | `scripts/infra/docker-compose.full.yml` | 🔴 Core protocol — Nostr feed read-only (no self-hosted relay) |
| **Matrix/Synapse** | Matrix | `scripts/infra/docker-compose.full.yml` | 🔴 Universal chat backbone — planned as highest-priority integration |
| **WriteFreely** | ActivityPub/Blog | `scripts/infra/docker-compose.full.yml` | 🟡 Long-form publishing federation |
| **Mobilizon** | ActivityPub/Events | `scripts/infra/docker-compose.full.yml` | 🟡 Event federation across Fediverse |
| **Owncast** | Live Streaming | `scripts/infra/docker-compose.full.yml` | 🟡 Creator live streaming |
| **Bridgy Fed** | AP↔Bluesky↔Nostr↔Farcaster | `infra/docker/bridgy-fed-compose.yml` | 🔴 **Write-path bridge** — Dockerfile+compose exist but never built |
| **Redlib** | Reddit proxy | *(missing from compose)* | 🔴 Bridge code references `:8281` but no container deployed |

### 1.3 Protocol Support Matrix (Codified vs Reality)

| # | Protocol | Code Exists | Self-Hosted Instance | Actually Fetching Live Data | Write Support |
|---|----------|-------------|---------------------|---------------------------|---------------|
| 1 | **Nostr** | ✅ SDK, provider, routes | ❌ No relay deployed | 🟡 Uses external relays (damus.io, nos.lol) | ✅ NIP-57 zaps coded |
| 2 | **Farcaster** | ✅ SDK, provider, routes | ❌ No local Hub | 🟡 Uses external hub (standardcrypto.vc) | ✅ Creator coins |
| 3 | **Bluesky/ATProto** | ✅ SDK, PDS client, routes | ✅ PDS running | 🟡 Via external bsky.social + own PDS | ✅ Post + feed gen |
| 4 | **Mastodon/GTS** | ✅ SDK, provider, routes | ✅ GoToSocial running | 🔴 **Zero live data** — no user accounts active | ✅ Coded, untested |
| 5 | **Lens** | ✅ SDK, provider, routes | ❌ No local instance | 🟡 Via api-v2.lens.dev | ✅ Creator coins |
| 6 | **Threads** | ✅ SDK, provider | ❌ No local instance | 🟡 Via public.threads.net | ✅ Coded |
| 7 | **Twitter/X** | ✅ Route code | ❌ API-dependent | 🟡 Via Twitter API v2 | ❌ Read-only |
| 8 | **Reddit** | ✅ Provider, routes | ❌ No Redlib | 🔴 **Redlib not running** — port 8281 unresponsive | ❌ Read-only |
| 9 | **RSS/Atom** | ✅ SDK, provider, routes | ✅ RSS-Bridge running | 🟡 353+ curated sources defined | ❌ N/A |
| 10 | **PeerTube** | ✅ Provider, routes | ✅ PeerTube running | ✅ **5 videos fetched** | ✅ Livestream |
| 11 | **Lemmy** | ✅ SDK, provider, routes | ✅ Lemmy running | 🔴 **0 federated instances** — empty feed | 🟡 Write coded |
| 12 | **YouTube** | ✅ Provider, routes | ❌ API-dependent | 🟡 18 RSS feeds for channels | ❌ Read-only |
| 13 | **Lens** | ✅ SDK, routes | ❌ Momoka/on-chain | 🟡 Via Lens API v2 | ✅ Creator coins |
| 14 | **Telegram** | ✅ SDK | ❌ Bot only | 🟡 Bot notifications | ✅ Bot messages |
| 15 | **Zora** | ✅ SDK | ❌ External | 🟡 Via Base contract | ✅ Creator coins |
| 16 | **Solana** | ✅ SDK, Anchor program | ❌ External | 🟡 Via Solana RPC | ✅ SPL tokens |
| 17 | **Discord** | ✅ SDK | ❌ External | 🟡 Via Discord API | ✅ Webhooks |
| 18 | **Matrix** | ✅ SDK | ❌ Not deployed | ❌ No homeserver | ✅ Coded |
| 19 | **GitHub** | ✅ SDK | ❌ External | 🟡 Via GitHub API | ✅ Events |
| 20 | **Ghost** | ✅ SDK | ✅ Running | 🟡 Connected | ✅ Blog posts |

**Legend:** ✅ = Working | 🟡 = Partial/External | 🔴 = Broken/Not fetching

---

## 2. Federation Health Per Protocol

### 2.1 ActivityPub Federation (GoToSocial + Lemmy + Relay)

```
┌─────────────────────────────────────────────────────────────┐
│                   ACTIVITYPUB FEDERATION                       │
│                                                               │
│  social.degenfeed.xyz ── does not federate yet                │
│       (GoToSocial v0.22.0 — no accounts created,             │
│        no following/followers, peers endpoint blocked)        │
│                                                               │
│  talk.degenfeed.xyz ── 0 linked instances                     │
│       (Lemmy v0.19.11 — has been up 5h, zero federation)      │
│                                                               │
│  relay.degenfeed.xyz ── running but idle                      │
│       (Activity-Relay v2.0.10 — subscribed to no relays)      │
│                                                               │
│  BRIDGY FED ── NOT DEPLOYED                                   │
│       (Write-path bridge needed for cross-protocol posting)   │
└─────────────────────────────────────────────────────────────┘
```

**Critical findings:**
- **Lemmy: 0 federated instances** after 5 hours of uptime. No outbound federation established.
- **GoToSocial: Static peers list, no accounts created.** Cannot query federation status without admin auth.
- **Activity Relay: Running but no relay subscriptions.** The relay has no configured upstream relays to relay from.
- **Bridgy Fed: Not built, not started, not tested.** Dockerfile and compose exist at `infra/docker/bridgy-fed-compose.yml` but `docker compose build` was never run.

### 2.2 Bluesky/AT Protocol

- **PDS is running** — health check passes, version 0.4.5009
- **Handle resolution FAILED** — `degenfeed.xyz` handle did not resolve
- PDS appears functional but has **no configured users** with content

### 2.3 Nostr

- **No self-hosted relay** — Nostr relay service defined in compose but never deployed
- Content flows through **external relays** (damus.io, nos.lol, nostr.band)
- 3 relay connections in Nostr SDK: `wss://relay.damus.io`, `wss://nos.lol`, `wss://relay.nostr.band`
- Bridge references Nostr in FALLBACK_POSTS but has **zero actual Nostr fetch code**

---

## 3. Data Flow Analysis

### 3.1 Local Bridge (`bridge/src/server.ts`)

The local bridge server (port 8787) is the **development entry point** for feed data. Its data flow:

```
Request → /api/feed/for-you
    ↓
buildFeed(protocols, limit)
    ↓
    ├── fetchGtsPosts() → GoToSocial → client_credentials OAuth
    │       ↓
    │       ⚠️ client_credentials grant CANNOT read user timelines
    │       ⚠️ GTS_CLIENT_ID/CLIENT_SECRET from .env — may be unset
    │       Result: ❌ Always returns []
    │
    ├── fetchRedlibPosts() → http://127.0.0.1:8281/r/all/hot
    │       ↓
    │       ⚠️ Redlib container NOT RUNNING (port 8281 unresponsive)
    │       Result: ❌ Always returns []
    │
    └── RSS-Bridge port ref → http://127.0.0.1:8282 (WRONG PORT IN CODE)
            ↓
            ⚠️ Code references port 8282 for RSS-Bridge (already the RSS-Bridge port)
            ⚠️ But bridge NEVER CALLS RSS-Bridge — no fetchRssPosts() function exists
            Result: ❌ Never called

    ↓
live.length >= 3? → NO (0 live posts)
    ↓
RETURN FALLBACK_POSTS ← ALWAYS (100% mock data)
```

**Result: The local bridge returns mock data 100% of the time.** The 8 hardcoded `FALLBACK_POSTS` simulate posts from Farcaster, Nostr, Bluesky, Mastodon, Lemmy, RSS, and Reddit — but none of these are actual live data.

**FALLBACK_POSTS protocols represented:**
- Farcaster: 2 posts (crypto analyst, DeFi degen)
- Nostr: 1 post (L2 researcher)
- Bluesky: 1 post (macro degen)
- Mastodon: 1 post (DCA bot)
- Lemmy: 1 post (stablecoin maxi)
- RSS: 1 post (CoinDesk)
- Reddit: 1 post (crypto maxi)

### 3.2 Edge Worker (Cloudflare Workers)

The production worker at `workers/api/src/` has a **proper protocol provider architecture**:

```
ContentPipeline.buildFeed()
    ↓
    ├── activitypub → MastodonProvider → social.degenfeed.xyz → ⚠️ No data
    ├── atproto     → BlueskyProvider  → public.api.bsky.app  → 🟡 External
    ├── nostr       → NostrProvider    → damus.io, nos.lol    → 🟡 External
    ├── farcaster   → FarcasterProvider → standardcrypto.vc    → 🟡 External
    ├── lens        → LensProvider     → api-v2.lens.dev      → 🟡 External
    ├── rss         → RssProvider      → 353+ feeds           → 🟡 External
    ├── reddit      → RedditProvider   → reddit.com           → 🟡 External
    ├── lemmy       → LemmyProvider    → community.degenfeed.xyz → 🔴 URL mismatch!
    ├── peertube    → fetchPeerTubeVideos → video.degenfeed.xyz → ✅ Works (5 videos)
    └── youtube     → fetchYouTubeVideos → RSS feeds          → 🟡 18 channels
```

**⚠️ CRITICAL: Lemmy instance URL mismatch**
- Actual Lemmy instance Actor ID: `https://talk.degenfeed.xyz`
- Code references in `lemmy.ts` route and `feed-providers/src/providers/lemmy.ts`: `https://community.degenfeed.xyz`
- These will never resolve — the worker cannot fetch from the local Lemmy instance

---

## 4. Integration Gaps

### 4.1 Critical Gaps (Blocking Functionality)

| # | Gap | Location | Impact | Fix |
|---|-----|----------|--------|-----|
| **C1** | **Bridgy Fed not deployed** | `infra/docker/bridgy-fed-compose.yml` exists, `bridgy-fed.Dockerfile` exists — never built | Write-path bridging from ActivityPub → Bluesky/Nostr/Farcaster is completely non-functional | Build and deploy: `docker compose -f infra/docker/bridgy-fed-compose.yml up -d --build` |
| **C2** | **Lemmy instance URL mismatch** | `packages/feed-providers/src/providers/lemmy.ts:39` uses `community.degenfeed.xyz`, actual server is `talk.degenfeed.xyz` | All Lemmy feed requests from worker/API fail | Update `LEMMY_INSTANCES` to `https://talk.degenfeed.xyz` |
| **C3** | **Lemmy zero federation** | Lemmy container running 5h, 0 linked instances | Empty Lemmy feed, no cross-instance content | Debug federation config — check `LEMMY_FEDERATION` env, check DNS/port accessibility |
| **C4** | **Bridge returns 100% mock data** | `bridge/src/server.ts` — all 3 data sources fail | Local development shows fake data, no live content flows | Fix GTS auth, deploy Redlib, add RSS-Bridge fetch, or implement proper provider calls |
| **C5** | **Redlib container not deployed** | Port 8281 unresponsive, no container in docker ps | Reddit read path broken in bridge and potentially in worker | Deploy Redlib or fall back to direct Reddit JSON API |

### 4.2 High Priority Gaps

| # | Gap | Location | Impact | Fix |
|---|-----|----------|--------|-----|
| **H1** | **No Nostr relay deployed** | `docker-compose.full.yml` has `nostr-relay` service defined but commented out / not started | Nostr content depends entirely on external relays with no fallback nostr.degenfeed.xyz | Start the nostr-relay service from full compose |
| **H2** | **No Meilisearch** | Planned in ROADMAP Week 4 | Search is client-side text matching over fetched posts — no proper indexing | Deploy Meilisearch container, wire into search route |
| **H3** | **PDS handle resolution fails** | `degenfeed.xyz` handle doesn't resolve via PDS | Self-hosted PDS users can't be found by handle | Register handle/DID document for the domain |
| **H4** | **Activity Relay idle** | `degenfeed-relay` running but subscribed to nothing | No inbound/outbound relay traffic | Configure relay subscriptions via API |
| **H5** | **GTS client_credentials can't read timelines** | Bridge uses OAuth client_credentials for GTS | GTS feed always empty because app tokens can't read user timelines | Use user-level OAuth token or publicly readable timelines |

### 4.3 Medium Priority Gaps (Defined But Not Implemented)

| # | Gap | Config Location | Status |
|---|-----|----------------|--------|
| M1 | Matrix/Synapse | `docker-compose.full.yml` lines 209-236 | **Not deployed** — requires Postgres setup |
| M2 | WriteFreely | `docker-compose.full.yml` lines 274-303 | **Not deployed** |
| M3 | Mobilizon | `docker-compose.full.yml` lines 335-366 | **Not deployed** |
| M4 | Owncast | `docker-compose.full.yml` lines 310-329 | **Not deployed** |
| M5 | Ghost CMS | `docker-compose.full.yml` lines 243-267 | **Runs as rmi-ghost** outside this compose |
| M6 | Local Farcaster Hub | Not in any compose | **No self-hosted Hub** — uses external |

### 4.4 Missing Protocol Integrations (Not Yet Architected)

These are protocols DegenFeed **should** consider but are not in any architecture doc:

| Protocol | Why It Matters | Integration Difficulty |
|----------|---------------|----------------------|
| **Farcaster (self-hosted Hub)** | Currently relies on `standardcrypto.vc` — single point of failure | Medium — Hub is complex |
| **Nostr (self-hosted relay)** | Already defined in compose but not deployed | Low — just `docker compose up` |
| **Signal** | High user base, private | High — no official bot API |
| **WhatsApp** | Largest messaging platform | High — Business API only, costly |
| **Discourse** | 100k+ communities, AP plugin | Medium — deploy + configure |
| **Funkwhale** | Federated music streaming | Medium — deploy |
| **Castopod** | Fediverse podcasting with monetization | Medium — deploy |

---

## 5. Service Health Checklist

| Service | Container | Health Check | API Responding | Data Available |
|---------|-----------|-------------|----------------|----------------|
| GoToSocial | `gotosocial` | ✅ Healthy | ✅ Instance info | 🔴 No user accounts/content |
| AT Protocol PDS | `degenfeed-pds` | ✅ Healthy | ✅ Health OK | 🔴 No handle resolution |
| PeerTube | `peertube-peertube-1` | ✅ Healthy | ✅ API OK | 🟡 5 videos (minimal) |
| Lemmy | `degenfeed-lemmy` | ✅ Healthy | ✅ API OK | 🔴 0 federated instances |
| RSS-Bridge | `degenfeed-rss-bridge` | ✅ Healthy | ✅ HTML OK | 🟡 353+ feed templates |
| Activity Relay | `degenfeed-relay` | ✅ Healthy | ✅ Running | 🔴 No relay subscriptions |
| Ghost | `rmi-ghost` | ✅ Healthy | ✅ API OK | 🟡 Blog content |
| Postiz | `degenfeed-postiz` | ✅ Healthy | ✅ Running | 🟡 Social scheduling |
| Nostr Relay | *(not running)* | ❌ N/A | ❌ N/A | 🔴 Missing entirely |
| Redlib | *(not running)* | ❌ N/A | ❌ N/A | 🔴 Missing entirely |
| Bridgy Fed | *(not running)* | ❌ N/A | ❌ N/A | 🔴 Missing entirely |

---

## 6. Critical Fixes Needed (Priority Order)

### Fix #1: Deploy Bridgy Fed 🔴
```bash
cd /path/to/degenfeed-web
docker compose -f infra/docker/bridgy-fed-compose.yml up -d --build
# Verify: curl -s https://bridgy.degenfeed.xyz/health
```
**Why:** Write-path bridging from GoToSocial to Bluesky, Nostr, and Farcaster is the core cross-protocol value proposition. Without Bridgy Fed, posts made on DegenFeed never leave ActivityPub.

### Fix #2: Fix Lemmy instance URL 🔴
In `packages/feed-providers/src/providers/lemmy.ts` and `workers/api/src/routes/lemmy.ts`:
```diff
- const LEMMY_INSTANCES = ['https://community.degenfeed.xyz', ...];
+ const LEMMY_INSTANCES = ['https://talk.degenfeed.xyz', ...];
```
**Why:** The instance URL mismatch means all Lemmy feed requests fail silently.

### Fix #3: Deploy Nostr Relay 🟡
```bash
# Add to running compose or start from full compose
docker compose -f scripts/infra/docker-compose.full.yml up -d nostr-relay
```
**Why:** Nostr is a Tier-1 protocol but has no self-hosted infrastructure.

### Fix #4: Deploy Redlib 🟡
```bash
# Deploy Redlib container on port 8281
docker run -d --name degenfeed-redlib -p 127.0.0.1:8281:80 quay.io/redlib/redlib:latest
```
**Why:** Reddit read path is completely broken without it.

### Fix #5: Configure Activity Relay 🟡
```bash
# Subscribe relay to upstream relays
curl -X POST http://127.0.0.1:8084/api/subscribe \
  -H "Content-Type: application/json" \
  -d '{"domain": "relay.degenfeed.xyz"}'
```
**Why:** The relay is running but idle — not providing any value.

---

## 7. Data Flow Diagram (Current Reality)

```
                    ┌──────────────────────────────────────┐
                    │         DEGENFEED DATA FLOW           │
                    │         (2026-07-24 ACTUAL)           │
                    └──────────────────────────────────────┘

  ┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐
  │ Edge Worker  │    │  Local Bridge    │    │   apps/web      │
  │ (CF Worker)  │    │  (dev only)      │    │   (Next.js)     │
  │              │    │                  │    │                 │
  │ Fetches from │    │ Returns 100%     │    │ Shows feed      │
  │ providers ───┤    │ mock data ───────┤◄───│ from worker     │
  │ via public   │    │ (FALLBACK_POSTS) │    │ or bridge       │
  │ APIs         │    │                  │    │                 │
  └──────┬───────┘    └──────────────────┘    └─────────────────┘
         │
         │ ┌──────────────────────────────────────────────┐
         ├─▶ NostrRelayProvider → ext relays (damus.io)   │ 🟡 Works
         ├─▶ FarcasterProvider → ext hub (stdcrypto.vc)   │ 🟡 Works
         ├─▶ BlueskyProvider → bsky.social + PDS          │ 🟡 Partial
         ├─▶ MastodonProvider → GTS (social.df.xyz)       │ 🔴 No data
         ├─▶ LensProvider → ext API (api-v2.lens.dev)     │ 🟡 Works
         ├─▶ RssProvider → 353+ feeds                     │ 🟡 Works
         ├─▶ RedditProvider → reddit.com                   │ 🟡 Works
         ├─▶ LemmyProvider → talk.df.xyz (URL MISMATCH!)  │ 🔴 Broken
         ├─▶ PeerTube fetcher → video.df.xyz              │ ✅ 5 videos
         └─▶ YouTube fetcher → 18 RSS feeds               │ 🟡 Works

  ┌────────────────────────────────────────────────────────────┐
  │                    WRITE PATH (PUBLISHING)                   │
  │                                                              │
  │  User posts → GotoSocial (AP)                               │
  │       ↓                                                     │
  │  Bridgy Fed should bridge to Bluesky, Nostr, Farcaster      │
  │       ↓                                                     │
  │  ⚠️ BRIDGY FED NOT DEPLOYED — write path broken             │
  └──────────────────────────────────────────────────────────────┘
```

---

## 8. Recommendations

### Immediate (Today)
1. **Deploy Bridgy Fed** — builds the cross-protocol write bridge
2. **Fix Lemmy instance URL** — s/community/talk/ in both route and provider files
3. **Deploy Redlib** — restores Reddit read path
4. **Deploy Nostr relay** — self-hosted Nostr infrastructure

### This Week
5. **Configure Activity Relay subscriptions** — so relay.degenfeed.xyz actually relays
6. **Create GTS user accounts** — populate the ActivityPub instance so there's content
7. **Fix Bridge data sources** — at minimum add RSS-Bridge fetching so bridge isn't 100% mock
8. **Register PDS handle** — fix DID resolution for the domain

### This Sprint
9. **Deploy Meilisearch** — proper search indexing
10. **Deploy Matrix/Synapse** — universal messaging backbone (highest priority per PLATFORM_UNIVERSE.md)
11. **Fix Lemmy federation** — debug why 0 instances connected after 5h
12. **Run Bridgy Fed end-to-end test** — verify AP→Bluesky→Nostr→Farcaster write path

### Within 30 Days
13. **Deploy WriteFreely** — long-form publishing federation
14. **Deploy Mobilizon** — event federation
15. **Deploy Funkwhale or Castopod** — audio monetization
16. **Evaluate self-hosted Farcaster Hub** — reduce external dependency

---

*Generated by automated infrastructure audit. Last updated: 2026-07-24.*

### Post-Audit Update: Bridgy Fed Deployment Attempt

Bridgy Fed was built from source but **failed to start** due to Google App Engine dependencies:

1. `ModuleNotFoundError: No module named 'arroba'` — `pip install .` doesn't install `[app]` extras
2. `pyproject.toml` has `[project.optional-dependencies] app = [...]` — needs `pip install '.[app]'`
3. Even with extras, Bridgy Fed is GAE-native: depends on `webutil.appengine_info`, memcache, datastore
4. **Recommendation:** Fix Dockerfile to install `.[app]` extras, or use Bridgy Fed's hosted version instead of self-hosting

**Fix applied:** Dockerfile updated with correct shell syntax for conditional install.  
**Remaining issue:** GAE dependency chain needs resolution. Flagged for follow-up.

---

## 9. Post-Audit Fixes Applied (2026-07-24)

### ✅ Fix 1: Redlib Deployed
- Pulled `quay.io/redlib/redlib:latest` and started on port **8281**
- Container: `degenfeed-redlib` — Restart unless-stopped
- Restores Reddit read path for the local bridge

### ✅ Fix 2: Lemmy Instance URLs Updated
- Added `https://talk.degenfeed.xyz` to both:
  - `packages/feed-providers/src/providers/lemmy.ts` (LEMMY_INSTANCES array)
  - `workers/api/src/routes/lemmy.ts` (INSTANCES array)
- Both `community.degenfeed.xyz` and `talk.degenfeed.xyz` now served as valid endpoints

### ⚠️ Fix 3: Bridgy Fed Built, but GAE Dependency Issue
- Dockerfile syntax error fixed (conditional install)
- Image built successfully: `bridgy-fed:latest`
- **Failed at runtime** — `ModuleNotFoundError: No module named 'arroba'`
- Root cause: Bridgy Fed is designed for Google App Engine; `pip install .` doesn't install `[app]` extras
- GAE-specific deps (memcache, datastore, webutil) need resolution

### ❌ Fix 4: Nostr Relay — GHCR Authentication Required
- `ghcr.io/scsibug/nostr-rs-relay:latest` requires GitHub Container Registry login
- No GHCR token available in environment
- **Blocked** until GHCR credentials are configured

### 🔴 Fix 5: Lemmy Federation — Zero Instances (Unresolved)
- Lemmy has `federation.enabled: true` with 18 allowed instances
- `hostname: talk.degenfeed.xyz` configured correctly
- **0 linked instances** after 5+ hours — possible DNS/network isolation issue

### 🔴 Fix 6: Bridge Server Still 100% Mock Data
- Redlib port now works (8281), but bridge also needs:
  - GTS OAuth token with user-level access
  - RSS-Bridge fetch function (currently no `fetchRssPosts()` exists)
  - Env var check: `GTS_CLIENT_ID` / `GTS_CLIENT_SECRET`

