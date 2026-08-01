# Headless ActivityPub Alternatives — Research Report

**Date:** 2026-07-24
**Author:** AI Research Agent
**Status:** Complete
**Context:** DegenFeed currently runs GoToSocial (microblogging), Lemmy (link aggregator),
PeerTube (video), Pixelfed (photo), and Owncast (livestreaming). We need to evaluate
whether lighter, more headless-friendly alternatives exist for each category.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Stack Assessment](#2-current-stack-assessment)
3. [Microblogging (GoToSocial Alternatives)](#3-microblogging-gotosocial-alternatives)
4. [Link Aggregator (Lemmy Alternatives)](#4-link-aggregator-lemmy-alternatives)
5. [Video (PeerTube Alternatives)](#5-video-peertube-alternatives)
6. [Photo (Pixelfed Alternatives)](#6-photo-pixelfed-alternatives)
7. [Livestreaming (Owncast)](#7-livestreaming-owncast)
8. [Headless-Specific Options](#8-headless-specific-options)
9. [Recommendations](#9-recommendations)
10. [Migration Paths](#10-migration-paths)

---

## 1. Executive Summary

### Key Finding: GoToSocial is ALREADY headless

The biggest misconception in our current setup is that GoToSocial has a web UI
we're not using. **It doesn't.** Per GTS docs:

> "GoToSocial is just a bare server for the most part and is designed to be
> used through external applications. Unlike other federated server projects,
> GoToSocial doesn't include an integrated client front-end (i.e., a web app)."

What we see at `social.degenfeed.xyz` is **not a client UI** — it's static
profile pages and a settings panel. All actual interaction goes through
Mastodon-compatible client apps (Pinafore, Tusky, Feditext) or the Mastodon API.

### Action Required: Fix, don't replace

| Service | Verdict | Action |
|---------|---------|--------|
| **GoToSocial** | ✅ Keep — already headless | Fix config issues, upgrade to v0.22.1 |
| **Lemmy** | ⚠️ Replace candidate | Consider PieFed (Python, lighter) or Mbin (PHP, full-featured) |
| **PeerTube** | ✅ Keep — has `--no-client` flag | Already good, consider headless mode |
| **Pixelfed** | ✅ Keep for now | Not designed headless, but functional |
| **Owncast** | ✅ Keep — growing AP support | Already deployed, federation improving |

---

## 2. Current Stack Assessment

### GoToSocial (social.degenfeed.xyz)

| Property | Current | Status |
|----------|---------|--------|
| Version | `0.22.0` (Docker) | ✅ Running |
| Latest | `0.22.1` (Jul 2026) | ⬆️ Minor update available |
| Headless? | **YES — by design** | ✅ Already correct |
| DB | SQLite | ✅ Fine for single-user |
| Storage | S3 (R2) | ✅ Working |
| Registration | Closed, approval required | ⚠️ Intentional |
| OAuth | Standard Mastodon API OAuth | ⚠️ Painful but standard |
| Peers | Empty list | ❌ Need investigation |
| Docker | `superseriousbusiness/gotosocial:0.22.0` | ✅ Pinned |

**Issues to fix (not reasons to replace):**
1. **Peers list empty** — Check `instance-expose-peers: true` is set (it is).
   May need federation to propagate. Try following known instances manually.
2. **OAuth token pain** — This is inherent to the Mastodon API. Our worker
   API at `workers/api/` handles this with the `mastodon-sdk` package.
3. **Signup approval** — `accounts-approval-required: true` is intentional for
   our invite-only model. Can toggle to `false` if needed.

### Lemmy (talk.degenfeed.xyz)

| Property | Current | Status |
|----------|---------|--------|
| Version | `0.19.11` (Docker) | ⚠️ Old |
| Latest stable | `0.19.17` (Mar 2026) | ⬆️ Behind |
| Latest pre-release | `1.0.0-alpha.20` (May 2026) | 🚧 Major rewrite |
| Headless? | **No** — full web UI | ❌ But has API |
| DB | PostgreSQL + pictrs | ⚠️ Heavy (3 containers) |
| Registration | Application required | ⚠️ Can configure |

**Pain points:**
- 3 containers (lemmy + postgres + pictrs)
- Rust backend + InfernoJS frontend = heavy build
- Signup requires application by default
- API is Lemmy-specific, not Mastodon-compatible

### PeerTube (video.degenfeed.xyz)

| Property | Current | Status |
|----------|---------|--------|
| Version | `production` tag (docker) | ✅ Running |
| Headless? | **`--no-client` flag available** | ✅ Can disable web UI |
| DB | PostgreSQL | Standard |
| Transcoding | FFmpeg | Standard |

### Pixelfed (photos.degenfeed.xyz)

| Property | Current | Status |
|----------|---------|--------|
| Version | `v0.12.7` (Docker) | ✅ Running |
| Headless? | **No** — full Laravel web app | ❌ But has API |
| API | Mastodon-compatible API available | ✅ Can enable |

### Owncast (chat/streaming)

Already deployed. ActivityPub federation is active and improving
(shared inbox support added Jan 2026).

---

## 3. Microblogging (GoToSocial Alternatives)

### 3.1 GoToSocial (CURRENT) — ✅ KEEP

**Verdict: Already the right choice.** Headless by design, actively maintained,
Mastodon API compatible, SQLite backend, Docker support, small footprint.

**What to fix:**
1. Upgrade from `0.22.0` → `0.22.1` (bugfix release, no DB migration)
2. Investigate empty peers list — try `instance-expose-peers: true` is already
   set, may need to manually follow instances to populate
3. If peers remain empty after manual follows, check firewall/federation config

### 3.2 Takahē (Python/Django)

| Property | Rating | Notes |
|----------|--------|-------|
| Headless? | ⚠️ **No** — has web UI (PWA) | But also Mastodon API compatible |
| Version | `0.11.0` (beta) | Pre-1.0, active development |
| Language | Python/Django | ✅ Easy to maintain |
| DB | PostgreSQL | Standard |
| Storage | S3 or local | ✅ Flexible |
| Docker | `jointakahe/takahe` | ✅ Available |
| Multi-domain | ✅ Yes (unique feature) | Host multiple domains on one instance |
| Mastodon API | ✅ Beta support | Good for our SDK |
| OAuth2 | ✅ Via Django | Standard |
| Complexity | Medium (2 processes: web + stator worker) | Higher than GTS |
| Maintenance | Medium | Django project |

**Pros:** Multi-domain support is unique. Python stack matches our expertise.
Active development with regular releases.

**Cons:** Beta software (pre-1.0). Needs PostgreSQL + S3. Two processes to run.
Has a web UI we wouldn't use.

**Verdict:** Interesting but not ready to replace GTS. Monitor for 1.0.

### 3.3 Snac2 (C)

| Property | Rating | Notes |
|----------|--------|-------|
| Headless? | ⚠️ Partial — has simple web UI | But usable via Mastodon API |
| Version | `2.78+` (stable) | ✅ In Debian repos |
| Language | C | ⚠️ Memory safety concerns |
| DB | **None** (filesystem-based) | ✅ Simplest possible |
| Docker | Community docker-compose | ⚠️ Not official |
| Mastodon API | ✅ Yes | Works with Tusky, Phanpy, etc. |
| OAuth2 | ⚠️ Basic API tokens | Not full OAuth2 |
| Resource usage | **Extremely low** | Runs on Raspberry Pi Zero |
| Complexity | **Very low** | Single binary, no deps |

**Pros:** Unbelievably lightweight. No database. No JS. Single binary.
Debian package available (`apt install snac2`).

**Cons:** Written in C (memory safety). Simple file-based storage doesn't scale.
Limited moderation tools. Community Docker setup, not official.

**Verdict:** Too minimal for DegenFeed's needs. Great for personal use.

### 3.4 Honk (Go)

| Property | Rating | Notes |
|----------|--------|-------|
| Headless? | ⚠️ Has web UI | But minimal |
| Version | `1.0.0` (stable-ish) | By Ted Unangst (OpenBSD) |
| Language | Go | ✅ |
| DB | SQLite | ✅ Simple |
| Mastodon API | ❌ **No** | Custom API only |
| Users | **Single-user** primary | Multi-user possible but limited |

**Pros:** Extremely simple. Single binary. Go (memory safe).

**Cons:** Single-user focused. No Mastodon API. No Docker. Very niche.
Minimal federation debugging. From OpenBSD community — may lack features.

**Verdict:** Rejected — single-user, no Mastodon API, no Docker.

### 3.5 Microblog.pub (Python/FastAPI)

| Property | Rating | Notes |
|----------|--------|-------|
| Headless? | ⚠️ Has minimalist web UI | But also Micropub/API |
| Version | Last commit Oct 2023 | ❌ **Inactive** |
| Language | Python/FastAPI | ✅ |
| DB | SQLite | ✅ |
| Users | **Single-user** | ❌ |

**Verdict: Rejected** — project is inactive (2+ years), single-user only.

### 3.6 FedBOX (Go)

| Property | Rating | Notes |
|----------|--------|-------|
| Headless? | ✅ Yes — API only | Reference implementation |
| Version | Pre-1.0 | Reference/experimental |
| Language | Go | ✅ |
| DB | BoltDB/Badger/SQLite | ✅ Flexible |
| OAuth2 | ⚠️ **Separate server required** | Needs go-ap/authorize |
| WebFinger | ⚠️ **Separate server required** | Needs go-ap/webfinger |
| Docker | `quay.io/go-ap/fedbox` | ✅ Available |

**Verdict: Rejected** — not production-ready. Requires THREE separate servers
(fedbox + authorize + webfinger). Reference implementation, not end-user software.

### 3.7 Kitsune (Rust/Svelte)

| Property | Rating | Notes |
|----------|--------|-------|
| Headless? | ⚠️ Has Svelte UI | Job runner can be headless |
| Version | `0.0.1-pre.4` | ❌ **Pre-alpha** |
| Language | Rust | ✅ Performant |
| DB | PostgreSQL | Standard |
| Docker | Official releases | ✅ Binaries available |

**Verdict: Too early.** Pre-alpha software. Interesting project, check back
in 2027.

### 3.8 Appy (Python/FastAPI)

| Property | Rating | Notes |
|----------|--------|-------|
| Headless? | ✅ **Yes — API only** | "Accessible via API only" |
| Version | Active (2025) | Still early |
| Language | Python/FastAPI | ✅ Matches our stack |
| DB | PostgreSQL | Standard |
| Redis | Required | ⚠️ Extra dependency |
| Mastodon API | ✅ Compatible with IceCubes, Tusky, etc. | Good |
| OAuth2 | ✅ IndieAuth/OAuth2 support | ✅ |
| Admin UI | ✅ Built-in web admin | For management only |
| Docker | Not official | ❌ Manual setup |

**Verdict: Worth watching.** Actively developed, headless by design, FastAPI
matches our expertise. But still early, no official Docker image, needs both
Postgres AND Redis. Consider as future replacement.

### 3.9 Microblogging Comparison Matrix

| Server | Headless | Lang | DB | Docker | OAuth2 | Mastodon API | Production |
|--------|----------|------|----|--------|--------|-------------|------------|
| **GoToSocial** (current) | ✅ Yes | Go | SQLite/PG | ✅ | ✅ | ✅ Full | ✅ Yes |
| Takahē | ⚠️ Has UI | Python | PG | ✅ | ✅ | ✅ Beta | ⚠️ Beta |
| Snac2 | ⚠️ Has UI | C | None | ⚠️ Community | ⚠️ Basic | ✅ | ✅ Stable |
| Honk | ❌ Has UI | Go | SQLite | ❌ | ❌ | ❌ | ⚠️ Niche |
| Microblog.pub | ⚠️ Minimal UI | Python | SQLite | ✅ | ✅ IndieAuth | ❌ | ❌ Dead |
| FedBOX | ✅ API only | Go | Bolt/Badger | ✅ | ⚠️ Separate | ❌ | ❌ Ref |
| Kitsune | ⚠️ Has UI | Rust | PG | ✅ | ? | ? | ❌ Pre-alpha |
| Appy | ✅ API only | Python | PG+Redis | ❌ | ✅ | ✅ | ⚠️ Early |

---

## 4. Link Aggregator (Lemmy Alternatives)

### 4.1 Lemmy (CURRENT) — ⚠️ Replace Candidate

**Problems:**
- 3-container stack (lemmy + postgres + pictrs)
- Rust backend (hard to debug/maintain)
- InfernoJS frontend (unfamiliar tech)
- Signup requires application by default
- API is Lemmy-specific (not Mastodon-compatible)
- Heavy for what it does

### 4.2 PieFed (Python/Flask) — 🏆 RECOMMENDED REPLACEMENT

| Property | Rating | Notes |
|----------|--------|-------|
| Headless? | ✅ **API-first** | Lemmy-compatible API! |
| Version | `1.4.x` (stable) | ✅ Active, regular releases |
| Language | **Python/Flask** | ✅ Our stack |
| DB | PostgreSQL | Standard |
| Docker | ✅ Official | Available |
| Lemmy API | ✅ **Compatible** | Works with Interstellar app |
| ActivityPub | ✅ Full Group/Person support | Federates with Lemmy, Mbin, Mastodon |
| Moderation | ✅ Built-in trust levels, content warnings | Better than Lemmy |
| Complexity | Medium (Python) | ✅ Lower than Rust Lemmy |
| Maintenance | ✅ Active community | Codeberg: `rimu/pyfedi` |

**Pros:**
- Python! We can actually contribute and debug
- Lemmy API compatible — existing clients may work
- Built-in trust levels and content warnings (unique)
- Active development (v1.4 released, regular updates)
- Docker deployment available
- Good federation with Lemmy, Mbin, Mastodon

**Cons:**
- Smaller community than Lemmy
- Relatively new (but production-ready at v1.4)
- Still needs PostgreSQL (same as Lemmy)
- Some missing features vs Lemmy (e.g., certain moderation tools)

**Verdict: 🏆 Best replacement for Lemmy.** Python stack matches our
expertise. Lemmy API compatible. Active development. Docker support.

### 4.3 Mbin (PHP/Symfony)

| Property | Rating | Notes |
|----------|--------|-------|
| Headless? | ✅ **API + OAuth2** | Full REST API, Swagger docs |
| Version | `v1.10` (stable) | ✅ Very active |
| Language | PHP/Symfony | ⚠️ Not our stack |
| DB | PostgreSQL | Standard |
| Docker | ✅ Official guide | Available |
| OAuth2 | ✅ Full OAuth2 | Well-documented scopes |
| ActivityPub | ✅ Full support | Includes Service actors for bots |
| Features | ✅ Both microblog + link aggregator | Like Kbin but better |
| Complexity | Medium (3+ containers) | Similar to Lemmy |

**Pros:**
- Very active development (multiple releases per month)
- Full API with OAuth2 and Swagger docs
- Supports BOTH microblogging AND link aggregation
- Better ActivityPub support than Lemmy (all actor types)
- Community-focused, no single maintainer

**Cons:**
- PHP — not in our core stack
- Requires RabbitMQ + Redis + PostgreSQL
- 3+ containers (similar complexity to Lemmy)
- UI is server-rendered with some JS
- PHP security vulnerabilities require watching

**Verdict:** Good alternative, but PHP is a maintenance burden for our
Python/TypeScript team. Use if Lemmy becomes untenable.

### 4.4 Lotide (Rust) — ❌ DEAD

Federation forum / link aggregator in Rust.
**Ceased development September 2024.** No longer maintained.

### 4.5 Ludwig (C++)

| Property | Rating | Notes |
|----------|--------|-------|
| Headless? | ⚠️ Has minimal web UI | JS-free by design |
| Version | Pre-1.0 | Early |
| Language | C++ | ⚠️ |
| Lemmy API | ✅ Compatible | Good for clients |
| Federation | ❌ **Not implemented** | TODO — no ActivityPub yet |

**Verdict: Rejected.** Federation is marked as TODO. Without ActivityPub,
it's just a local Reddit clone.

### 4.6 Brutalinks (Go)

Minimal link aggregator. Hard to find instances or documentation.
Requires FedBOX as backend. Not practical.

### 4.7 Link Aggregator Comparison Matrix

| Server | Headless/API | Lang | DB | Docker | OAuth2 | Lemmy API | ActivityPub |
|--------|-------------|------|----|--------|--------|-----------|-------------|
| **Lemmy** (current) | ⚠️ Has UI | Rust | PG | ✅ | ✅ | Native | ✅ Full |
| **PieFed** 🏆 | ✅ API-first | **Python** | PG | ✅ | ✅ | ✅ Compatible | ✅ Full |
| Mbin | ✅ Full API | PHP | PG | ✅ | ✅ Full | ⚠️ Partial | ✅ Full |
| Lotide | ✅ API-only | Rust | PG | ✅ | ? | ❌ | ✅ (dead) |
| Ludwig | ⚠️ Minimal UI | C++ | ? | ❌ | ❌ | ✅ Compatible | ❌ Not yet |

---

## 5. Video (PeerTube Alternatives)

### 5.1 PeerTube (CURRENT) — ✅ KEEP

| Property | Rating | Notes |
|----------|--------|-------|
| Headless? | ✅ **`--no-client` flag** | Can start without web UI |
| API | ✅ Full REST API + OpenAPI spec | Excellent documentation |
| OAuth2 | ✅ Standard | |
| ActivityPub | ✅ Native | Full video federation |

PeerTube supports `--no-client` flag since at least v6.0:

```
peertube start --no-client
```

This starts the server without serving the Angular web UI, making it
API-only. All federation, transcoding, and storage features remain active.

**Recommendation:** Keep PeerTube. Consider running with `--no-client` if
we want to reduce resource usage. The API is excellent and well-documented.

### 5.2 Owncast (CURRENT) — ✅ KEEP

Already deployed. ActivityPub federation is actively improving:
- Shared inbox support (Jan 2026)
- Cross-instance federation / mini directories (WIP, PR #4577)
- Go-live notifications fed to followers
- Likes, shares, follows surface in chat

**Recommendation:** Keep Owncast. It complements PeerTube (live vs VOD).

### 5.3 Other Video Options

**No viable alternatives** for PeerTube's niche (federated YouTube-like platform).
Owncast covers live streaming. No other ActivityPub video platform exists
at production quality.

---

## 6. Photo (Pixelfed Alternatives)

### 6.1 Pixelfed (CURRENT) — ✅ KEEP

| Property | Rating | Notes |
|----------|--------|-------|
| Headless? | ❌ **Full Laravel web app** | But has API |
| API | ✅ Mastodon-compatible API | Can enable via `.env` |
| Headless workaround | ✅ Run behind nginx, only expose API routes | Possible |

**Headless possibility:** Pixelfed is a full Laravel application with a web UI,
but it has a Mastodon-compatible API. We could theoretically run it behind
nginx and only proxy API routes. However, this isn't a supported configuration.

**Recommendation:** Keep Pixelfed as-is. It works. No production-quality
ActivityPub photo-sharing alternative exists. Monitor for API-only mode features.

### 6.2 Photo-specific Alternatives

**None viable.** No other ActivityPub photo-sharing platform is production-ready.
Pixelfed is the only mature option in this space.

---

## 7. Livestreaming (Owncast)

### Already Deployed — ✅ KEEP

Owncast's ActivityPub federation is improving rapidly:
- Shared inbox support merged (Jan 2026)
- Cross-instance federation (mini directories) in active development
- Go-live notification via ActivityPub
- Follow/like/share handling in ActivityPub inbox

**No alternative needed.** Owncast is the only self-hosted, ActivityPub-enabled
livestreaming platform.

---

## 8. Headless-Specific Options

### What "Headless" Really Means

For DegenFeed's architecture, "headless" means:

1. **API-only operation** — No web UI served by the backend
2. **Mastodon API compatibility** — Our `mastodon-sdk` package already speaks it
3. **OAuth2 support** — For our unified auth layer
4. **Docker deployment** — Must fit our Docker Compose infrastructure
5. **Reasonable resource usage** — <512MB RAM, <1 CPU

### Truly Headless Options (API-only, no web UI at all)

| Server | API-only? | Masto API | OAuth2 | Docker | Production? |
|--------|-----------|-----------|--------|--------|-------------|
| **GoToSocial** | ✅ Yes (profiles only) | ✅ Full | ✅ | ✅ | ✅ Yes |
| FedBOX | ✅ Yes | ❌ | ⚠️ Separate | ✅ | ❌ Ref impl |
| Appy | ✅ Yes | ✅ Compatible | ✅ | ❌ | ⚠️ Early |

### Conditionally Headless (can disable web UI)

| Server | How | Status |
|--------|-----|--------|
| **PeerTube** | `--no-client` flag | ✅ Works |
| Takahē | Don't deploy web UI code | ⚠️ Not tested |
| PieFed | API-first, web UI optional | ⚠️ Has web UI but API is primary |

### Not Headless (full web app, API secondary)

| Server | Why |
|--------|-----|
| Lemmy | Web UI is primary, API secondary |
| Pixelfed | Full Laravel app, API is add-on |
| Mbin | Full Symfony app, API is secondary |
| Mastodon | Full Rails app, though API-first design |

---

## 9. Recommendations

### Tier 1: Immediate Actions (This Week)

#### ✅ KEEP GoToSocial — Fix Configuration

1. **Upgrade to v0.22.1:**
   ```bash
   docker pull superseriousbusiness/gotosocial:0.22.1
   # Update docker-compose.yml tag
   docker compose up -d gotosocial
   ```
   No DB migration needed from 0.22.0 → 0.22.1.

2. **Fix empty peers list:**
   - Our config has `instance-expose-peers: true` ✅
   - We may just not have any peers because no one follows us
   - **Action:** Manually follow some known instances from our account:
     ```
     # Use Mastodon API to follow instance relays
     curl -X POST https://social.degenfeed.xyz/api/v1/follows \
       -H "Authorization: Bearer $TOKEN" \
       -d '{"uri": "https://mastodon.social"}'
     ```
   - Or set up a relay subscription

3. **OAuth token flow:**
   - Document the exact OAuth flow for our `workers/api/` to use
   - Check `mastodon-sdk` package for proper token handling

#### ⚠️ REPLACE Lemmy with PieFed — Evaluate

**Why PieFed over Lemmy:**
- **Python** (our core language) vs Rust
- **Lighter** resource usage (2 containers vs 3)
- **Active development** (v1.4, regular releases)
- **Lemmy API compatible** — existing clients may work
- **Better moderation** — built-in trust levels, content warnings
- **Docker support** available

**Migration steps (if approved):**
1. Deploy PieFed on a test subdomain
2. Configure federation
3. Test with our worker API
4. Migrate communities
5. Cut over DNS from `talk.degenfeed.xyz`

### Tier 2: Medium-Term (Next Month)

#### Consider PeerTube `--no-client`

If we're not using the PeerTube web UI directly (users browse via our
aggregator), we can save resources:

```yaml
# In docker-compose.yml
peertube:
  command: ["--no-client"]
```

#### Add Takahē as Secondary Microblogging Server

Takahē's multi-domain support is unique. Could host additional domains
(hacker.degenfeed.xyz, dev.degenfeed.xyz, etc.) on the same instance.

**Wait for 1.0 release** before considering production use.

### Tier 3: Long-Term Watchlist

| Project | Why Watch | When to Act |
|---------|-----------|-------------|
| **Takahē** | Python, multi-domain, Mastodon API | 1.0 release (~late 2026?) |
| **Kitsune** | Rust, performant, WASM MRF | Alpha/beta (2027+) |
| **Appy** | Headless by design, FastAPI | Stable release + Docker |
| **PieFed** | Python link aggregator | **Now** — ready for evaluation |

### Current Stack Recommendation

```
KEEP:  GoToSocial (fix config, upgrade)
       PeerTube (consider --no-client)
       Pixelfed (as-is)
       Owncast (as-is)

REPLACE WATCH:  Lemmy → PieFed (strong candidate)
                GoToSocial → Takahē (wait for 1.0)

REMOVE:  None (all provide value)
ADD:     None needed
```

---

## 10. Migration Paths

### GoToSocial 0.22.0 → 0.22.1

```bash
# 1. Stop
docker compose -f /path/to/degenfeed/gotosocial/docker-compose.yml down

# 2. Backup
cp /path/to/degenfeed/gotosocial/data/gotosocial.sqlite \
   /path/to/degenfeed/backups/gotosocial-pre-upgrade.sqlite

# 3. Update tag
sed -i 's/gotosocial:0.22.0/gotosocial:0.22.1/' \
   /path/to/degenfeed/gotosocial/docker-compose.yml

# 4. Pull and start
docker compose -f /path/to/degenfeed/gotosocial/docker-compose.yml pull
docker compose -f /path/to/degenfeed/gotosocial/docker-compose.yml up -d

# 5. Verify
curl https://social.degenfeed.xyz/api/v1/instance
```

### Lemmy → PieFed (If Approved)

```bash
# 1. Deploy PieFed test instance
git clone https://codeberg.org/rimu/pyfedi.git
cd pyfedi
# Follow Docker install guide

# 2. Configure federation
# Edit config to mirror Lemmy's communities

# 3. Test API compatibility
curl http://piefest.local/api/v3/site

# 4. Cut over DNS from talk.degenfeed.xyz
```

### PeerTube Headless Mode

```yaml
# Add to docker-compose.yml service definition:
peertube:
  image: chocobozzz/peertube:production
  command: ["--no-client"]
  # ... rest of config
```

---

## Appendix A: Research Sources

- GoToSocial docs: https://docs.gotosocial.org/en/latest/
- GoToSocial FAQ: https://docs.gotosocial.org/en/v0.21.1/faq/
- Takahē GitHub: https://github.com/jointakahe/takahe
- Snac2 Codeberg: https://codeberg.org/grunfink/snac2
- Honk hg: https://humungus.tedunangst.com/r/honk
- Microblog.pub: https://github.com/tsileo/microblog.pub
- FedBOX: https://github.com/go-ap/fedbox
- Kitsune: https://github.com/kitsune-soc/kitsune
- Appy: https://codeberg.org/spla/appy
- PieFed: https://codeberg.org/rimu/pyfedi
- Mbin: https://github.com/MbinOrg/mbin
- Lotide: https://sr.ht/~vpzom/lotide/ (dead)
- Ludwig: https://github.com/ar-nelson/ludwig
- Owncast: https://github.com/owncast/owncast
- PeerTube docs: https://docs.joinpeertube.org/
- Pixelfed docs: https://docs.pixelfed.org/
- Lemmy: https://github.com/LemmyNet/lemmy

## Appendix B: Key URLs for Our Infrastructure

```
social.degenfeed.xyz   → GoToSocial (Mastodon API)  → 127.0.0.1:8082
talk.degenfeed.xyz     → Lemmy (Lemmy API v3)        → 127.0.0.1:8536
video.degenfeed.xyz    → PeerTube (REST API)         → 127.0.0.1:9000
chat.degenfeed.xyz     → Owncast (API + web)         → 127.0.0.1:8080
photos.degenfeed.xyz   → Pixelfed                    → (check port)
pds.degenfeed.xyz      → AT Protocol PDS             → (check port)
```

## Appendix C: ActivityPub Software Ecosystem Map

```
                    ┌─────────────────────────────────────────┐
                    │           ACTIVITYPUB/FEDIVERSE          │
                    └─────────────────────────────────────────┘
                                    │
         ┌────────────┬────────────┬┴───────────┬─────────────┬──────────────┐
         │            │            │            │             │              │
    Microblogging  Link Agg.    Video       Photo       Livestream     Other
         │            │            │            │             │              │
    ┌───┴───┐    ┌───┴───┐    ┌───┴───┐    ┌───┴───┐    ┌───┴───┐    ┌───┴───┐
    │ GTS   │    │Lemmy  │    │PeerT. │    │Pixelfd│    │Owncast│    │Write.│
    │Takahē │    │PieFed │    │       │    │       │    │       │    │Micro.│
    │Snac2  │    │Mbin   │    │       │    │       │    │       │    │Hubz. │
    │Honk   │    │Lotide │    │       │    │       │    │       │    │  etc  │
    │Appy   │    │Ludwig │    │       │    │       │    │       │    │       │
    └───────┘    └───────┘    └───────┘    └───────┘    └───────┘    └───────┘

    Bold = Currently deployed at DegenFeed
```

---

*End of report. For questions, contact the infrastructure team.*
