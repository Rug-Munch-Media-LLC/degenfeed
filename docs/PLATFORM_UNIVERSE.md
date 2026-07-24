# DegenFeed Platform Universe

> Complete map of every decentralized platform, how we connect to it, and what content flows in both directions.
>
> **Last updated:** 2026-07-20
> **Owner:** crmuncher
> **Status:** living document — update as new integrations land

---

## Table of Contents

1. [How to Read This Document](#how-to-read-this-document)
2. [Existing Integrations (Already Done)](#1-existing-integrations-already-done)
3. [Social Media (Text + Image)](#2-social-media-text--image)
4. [Discussion / Reddit Alternatives](#3-discussion--reddit-alternatives)
5. [Video Platforms](#4-video-platforms)
6. [Publishing / Blogging](#5-publishing--blogging)
7. [Events](#6-events)
8. [Music / Audio](#7-music--audio)
9. [File Sharing / Storage](#8-file-sharing--storage)
10. [Messaging](#9-messaging)
11. [Priority Integration Roadmap](#10-priority-integration-roadmap)
12. [Integration Patterns](#11-integration-patterns)

---

## How to Read This Document

Each platform has a standardized entry:

- **Protocol** — The wire protocol used (ActivityPub, Matrix, custom, etc.)
- **License** — Open-source license; determines fork legality
- **Reach** — Active users, instances, GitHub stars
- **API** — Available API surface for integration
- **Bridge Directions** — Can we push content TO it? Pull content FROM it?
- **Fork Potential** — Can we run our own instance? Fork the codebase?
- **Content Types** — What kind of content does the platform support?
- **Integration Priority** — 1 (immediate) to 10 (nice-to-have)
- **Notes** — Context, risks, maintenance status

### Bridge Direction Legend

| Icon | Meaning |
|------|---------|
| ✅ | Natively supported / working |
| 🟡 | Partial / in development |
| 🔶 | Possible but needs work |
| ❌ | Not supported / blocked |
| 🔲 | No native path |

---

## 1. Existing Integrations (Already Done)

These platforms are already integrated into DegenFeed. Listed for completeness.

| Platform | Protocol | What We Do |
|----------|----------|------------|
| **Nostr** | Nostr (kind events) | Read/write feed, tips (LN zaps), livestream announces, audio spaces |
| **Farcaster** | Farcaster Hub gRPC | Read/write feed, creator coins (Base), frames, tips |
| **Bluesky (AT Protocol)** | AT Protocol | Read/write via public API + self-hosted PDS, feed generator |
| **Mastodon** | ActivityPub | Read/write via Mastodon API, tip via LN |
| **GoToSocial** | ActivityPub | Self-hosted at `social.degenfeed.xyz` — DegenFeed's AP identity |
| **Lens Protocol** | Lens Hub GraphQL | Read/write feed, creator coins (Polygon→Base→Solana) |
| **Threads** | Threads API | Read/write (experimental, Meta-controlled) |
| **Twitter/X** | Twitter API v2 | Read-only (API restrictions) |
| **Reddit** | Reddit REST API | Read-only via self-hosted Redlib at `redlib.degenfeed.xyz` |
| **RSS/Atom** | RSS 2.0 / Atom | 353+ curated sources, self-hosted RSS-Bridge |
| **PeerTube** | ActivityPub | Self-hosted at `video.degenfeed.xyz`, livestream + video hosting |
| **Lemmy** | ActivityPub | Read feed (write coming), tip via LN |
| **Telegram** | Telegram Bot API | Bot notifications, feed subscription, livestream alerts |
| **Zora** | EVM contracts | Creator coins, NFT wrapping, cross-chain registry |
| **Solana** | Solana RPC | Creator tokens (SPL), tipping, identity |

**Integration note:** All existing feeds are aggregated at the edge worker (`workers/api/`) and normalized via packages in `packages/*-sdk/`. Bridgy Fed handles write-path bridging from GoToSocial to Bluesky/Nostr/Farcaster.

---

## 2. Social Media (Text + Image)

### 2.1 Pleroma / Akkoma

| Field | Value |
|-------|--------|
| **Protocol** | ActivityPub |
| **License** | AGPL-3.0 (both) |
| **Reach** | Pleroma: ~66k total users (declining). Akkoma: ~9.5k total (growing). Akkoma v3.17.0 (Dec 2025) |
| **API** | Mastodon-compatible REST API (v1/v2) + WebSocket streaming |
| **Bridge TO** | ✅ ActivityPub S2S — post to any AP inbox |
| **Bridge FROM** | ✅ ActivityPub S2S + Mastodon client API |
| **Fork Potential** | ✅ AGPL. Akkoma runs on Raspberry Pi (Elixir/OTP). Pleroma development stalled (last release early 2024). |
| **Content Types** | Text, images, video, audio, polls, custom emoji reactions |
| **Priority** | 6 — Minimal new value over existing Mastodon/GtS integration. Akkoma's Mastodon API compatibility means our Mastodon SDK already works. |
| **Notes** | Akkoma is the active fork of Pleroma. Elixir/PostgreSQL. Lightweight (200-400MB RAM for single user). "Bubble" concept for instance groups. |

**Bridge plan:** Already supported via existing `packages/mastodon-sdk` — Akkoma speaks Mastodon API natively. No additional work needed.

---

### 2.2 Misskey / Firefish / Iceshrimp / Sharkey

| Field | Value |
|-------|--------|
| **Protocol** | ActivityPub |
| **License** | AGPL-3.0 (all variants) |
| **Reach** | Misskey: ~1.16M total users (dominant in Japan, 11.2k GitHub ⭐). Firefish: EOL (~4k users). Iceshrimp: ~3.5k. Sharkey: growing |
| **API** | Misskey-native API + partial Mastodon API (Iceshrimp has best Mastodon compat) |
| **Bridge TO** | ✅ ActivityPub S2S |
| **Bridge FROM** | ✅ ActivityPub S2S + client APIs |
| **Fork Potential** | ✅ AGPL. Fork ecosystem already exists (Sharkey, CherryPick, Catodon). Misskey is Node.js (TypeScript). Iceshrimp.NET is C# rewrite. |
| **Content Types** | Text, images, video, audio, polls, widgets, custom emoji reactions, "Misskey-flavored markdown", rich UI with widgets/gadgets |
| **Priority** | 5 — Worth integrating for Japanese market access. Misskey has ~1M+ users largely unreachable by current DegenFeed integrations. |
| **Notes** | Misskey is the #2 Fediverse platform after Mastodon. Massive in Japan. Misskey.io flagship instance has 450k+ users. Unique feature set: widgets, reaction emoji, customizable UI. Firefish is dead. Iceshrimp has best Mastodon API compat. Sharkey is the most actively maintained fork. CherryPick (a Sharkey fork) may be the best overall. |

**Bridge plan:** Given Mastodon API compatibility in Iceshrimp/Sharkey, our existing `packages/mastodon-sdk` may work partially. For full Misskey integration, a `packages/misskey-sdk` would be needed for Misskey-native features (widgets, reactions, Drive). Priority: medium — large user base but geographically concentrated.

---

### 2.3 Friendica

| Field | Value |
|-------|--------|
| **Protocol** | ActivityPub, Diaspora, OStatus, DFRN, RSS/Atom import |
| **License** | AGPL-3.0 |
| **Reach** | ~30k total users, ~1.7k MAU, ~800 instances. 14 years of continuous development. |
| **API** | Mastodon-compatible REST API, custom PHP APIs |
| **Bridge TO** | ✅ Multi-protocol — AP + Diaspora + RSS |
| **Bridge FROM** | ✅ Multi-protocol import + RSS/Atom feed import |
| **Fork Potential** | ✅ AGPL. PHP/MySQL — runs on shared hosting. |
| **Content Types** | Text (unlimited length), images, video, audio, events, polls, photo albums, groups |
| **Priority** | 7 |
| **Notes** | Oldest active Fediverse project (2010). Facebook-like multi-profile UX. Strong multi-protocol bridge itself — Friendica can pull from and push to almost anything. Interesting as an intermediate bridge hub. |

**Bridge plan:** Friendica's Mastodon API compatibility means our existing SDK works for basic feed read/write. Friendica could serve as a bridge relay for Diaspora content (which DegenFeed does not natively support).

---

### 2.4 Hubzilla

| Field | Value |
|-------|--------|
| **Protocol** | Zot6 (nomadic identity), ActivityPub, Diaspora |
| **License** | MIT (most permissive) |
| **Reach** | ~5k total users, ~300 instances |
| **API** | Mastodon-compatible REST API + Zot6 API |
| **Bridge TO** | ✅ AP + Zot6 + Diaspora |
| **Bridge FROM** | ✅ AP + Zot6 |
| **Fork Potential** | ✅ MIT license — most permissive of all platforms. Can fork and modify freely. |
| **Content Types** | Text, images, video, audio, events/calendar (CalDAV), wiki, CMS/web pages, file storage (WebDAV), forums |
| **Priority** | 8 |
| **Notes** | Most feature-rich Fediverse platform. Pioneered nomadic identity (clone accounts across instances), granular per-item permissions, built-in CMS. MIT license is unique. However, small user base. |

**Bridge plan:** Low priority given small user base. Hubzilla's Mastodon API compatibility provides basic integration. The nomadic identity concept is architecturally interesting but wouldn't directly benefit DegenFeed users.

---

### 2.5 Bonfire

| Field | Value |
|-------|--------|
| **Protocol** | ActivityPub |
| **License** | AGPL-3.0 |
| **Reach** | ~921 GitHub ⭐. Pre-release (Social 1.0 RC). ~185 repos in org. |
| **API** | ActivityPub S2S, GraphQL (planned) |
| **Bridge TO** | ✅ ActivityPub S2S |
| **Bridge FROM** | ✅ ActivityPub S2S |
| **Fork Potential** | ✅ AGPL. Elixir/Phoenix/LiveView. Modular extension architecture. |
| **Content Types** | Modular — varies by "flavour": Social (microblog), Community (forums), Open Science, Coordination, Cooperation |
| **Priority** | 9 — Too early. Pre-release. Not enough users to justify integration effort. |
| **Notes** | Bonfire is a framework for building Fediverse apps, not a single platform. Extensions architecture is interesting — could build a DegenFeed flavour. But the project is pre-1.0 and the user base is tiny. Monitor for 1.0 release. |

**Bridge plan:** Wait for 1.0 stable. ActivityPub means basic integration would work via existing Mastodon SDK infrastructure once they have users. The framework approach could be leveraged to build a DegenFeed-branded Fediverse instance.

---

## 3. Discussion / Reddit Alternatives

### 3.1 Kbin / Mbin

| Field | Value |
|-------|--------|
| **Protocol** | ActivityPub |
| **License** | AGPL-3.0 |
| **Reach** | Mbin: ~10.2k total users. Active fork of Kbin (original stalled). |
| **API** | REST API (Symfony), ActivityPub S2S, Mercure real-time |
| **Bridge TO** | ✅ ActivityPub S2S (threads, posts, comments) |
| **Bridge FROM** | ✅ ActivityPub S2S |
| **Fork Potential** | ✅ AGPL. PHP/Symfony. Mbin v1.10.0, active releases. |
| **Content Types** | Text, images, video, link aggregation, threaded comments, microblog posts |
| **Priority** | 4 — Similar to Lemmy (already integrated) but has microblog features too. Good addition for Reddit-like content. |
| **Notes** | Mbin is what Kbin was supposed to be. Combines Reddit-like magazine/thread model with microblogging in one platform. Bidirectional AP federation. Active development. |

**Bridge plan:** Similar to Lemmy integration. Mbin exposes ActivityPub endpoints for magazines, threads, and comments. Can use similar patterns to `packages/lemmy-provider` (currently inline in worker routes). Would make `packages/mbin-sdk`. Content flow: pull threads+comments, push DegenFeed posts as threads.

---

### 3.2 Discourse (ActivityPub Plugin)

| Field | Value |
|-------|--------|
| **Protocol** | ActivityPub (via official plugin) |
| **License** | Discourse core: MIT. Plugin: MIT. |
| **Reach** | Discourse: 100k+ communities, 10k+ instances. Plugin: growing adoption, 82 GitHub ⭐, active development by Discourse team (30 contributors). |
| **API** | ActivityPub S2S + Discourse REST API |
| **Bridge TO** | ✅ Categories/tags as AP actors. Full Topic or First Post federation modes. |
| **Bridge FROM** | 🟡 Limited — receives replies/comments. Discourse→Discourse federation works. |
| **Fork Potential** | ✅ MIT. Plugin installs easily. Discourse core is well-maintained. |
| **Content Types** | Text (forum posts), images, video, link embeds |
| **Priority** | 3 — **Top priority forum integration.** Official plugin from Discourse team itself. Huge potential reach. |
| **Notes** | Bidirectional federation between Discourse communities. Categories become AP actors that Mastodon/Lemmy users can follow. Two federation modes: Full Topic (all posts in a thread) or First Post only. Currently no public posting (followers-only), but Phase 2 planned. Editing support also planned for Phase 2. |

**Bridge plan:** Deploy DegenFeed Discourse instance at `forum.degenfeed.xyz`. Enable ActivityPub plugin on key categories (announcements, developer discussions, creator communities). Content flows:
- **DegenFeed → Discourse:** Cross-post DegenFeed hot topics as forum threads
- **Discourse → DegenFeed:** Forum posts appear in DegenFeed feed as long-form content
- **Discourse ↔ Fediverse:** Already bidirectional via plugin

**Top-priority action:** Deploy Discourse + install plugin. This is the single highest-value new integration.

---

### 3.3 Flarum

| Field | Value |
|-------|--------|
| **Protocol** | Custom (JSON:API). No native ActivityPub. |
| **License** | MIT |
| **Reach** | ~16.3k GitHub ⭐. 316k+ Composer installs. Thousands of active forums. Flarum 2.0 RC. |
| **API** | JSON:API REST, extension API (1,200+ extensions) |
| **Bridge TO** | 🔶 No native federation. Would need: (a) Flarum extension for ActivityPub, or (b) bridge via RSS feed. |
| **Bridge FROM** | 🔶 Via RSS/Atom or JSON:API |
| **Fork Potential** | ✅ MIT. PHP/Laravel/Mithril.js. Clean extensible architecture. |
| **Content Types** | Text (forum discussions), images, file attachments |
| **Priority** | 5 — High fork potential as lightweight built-in community platform. Lower urgency than Discourse since no AP native. |
| **Notes** | Beautiful, lightweight, extension-driven. 2.0 is production-ready. No ActivityPub support yet but an extension could add it. Significantly lighter than Discourse (PHP+DB vs Ruby+Postgres+Redis+Sidekiq). Perfect for built-in DegenFeed communities. |

**Bridge plan:** Two paths:
1. **Fork path:** Run Flarum as `forum.degenfeed.xyz` (lighthouse) with a custom ActivityPub extension for federation. This gives us a lightweight built-in community platform.
2. **Bridge path:** Use Flarum's RSS/JSON:API to bridge content into DegenFeed feed. No bidirectional federation but simpler.

**Recommendation:** Option 1 — build a lightweight Flarum AP extension. Flarum's extension API is clean and well-documented. This would give DegenFeed a native forum experience that federates with the rest of the Fediverse.

---

### 3.4 Lobsters

| Field | Value |
|-------|--------|
| **Protocol** | Custom. No ActivityPub. |
| **License** | 3-Clause BSD (permissive) |
| **Reach** | ~4.7k GitHub ⭐. ~5k registered users on lobste.rs. Invite-only submission. |
| **API** | Public REST JSON API (no key) — hottest, newest, tags, user profiles |
| **Bridge TO** | ❌ No native push API (invite-only submission) |
| **Bridge FROM** | ✅ Public JSON feed API |
| **Fork Potential** | ✅ BSD. Rails/Ruby. Sister site model (separate communities allowed). |
| **Content Types** | Text link aggregation, threaded comments, tags |
| **Priority** | 7 |
| **Notes** | Computing/tech-focused. No federation. Sister sites are encouraged (e.g., `lobste.rs`, `pipelined.co`). Small but high-quality community. |

**Bridge plan:** Read-only RSS-style integration. Pull top stories from Lobsters JSON API into DegenFeed news feed. No bidirectional bridge possible.

---

### 3.5 Tildes

| Field | Value |
|-------|--------|
| **Protocol** | Custom. No ActivityPub planned. |
| **License** | AGPL-3.0 |
| **Reach** | ~15k+ registered users (invite-only). Single instance (tildes.net). |
| **API** | Experimental mobile API (in development) |
| **Bridge TO** | ❌ Invite-only, no write API |
| **Bridge FROM** | 🔶 Limited public read via experimental API |
| **Fork Potential** | ✅ AGPL. Python/PostgreSQL. Community fork exists but tiny. |
| **Content Types** | Text link aggregation, threaded comments, tagging, groups |
| **Priority** | 10 — Single instance, no write access, no federation, small user base. Not worth integration. |
| **Notes** | Non-profit, invite-only. Heavy moderation philosophy. Single-instance focus. Deimos is solo maintainer. |

**Bridge plan:** None.

---

### 3.6 Postmill

| Field | Value |
|-------|--------|
| **Protocol** | Custom. RSS/Atom only. |
| **License** | GPL-3.0 |
| **Reach** | Tiny — very niche. |
| **API** | RSS/Atom feeds |
| **Bridge TO** | ❌ |
| **Bridge FROM** | 🔶 Via RSS/Atom |
| **Fork Potential** | ✅ GPLv3. PHP. Minimal active development. |
| **Content Types** | Text link aggregation, threaded comments, voting |
| **Priority** | 10 — Tiny community, no federation, minimal development activity. |
| **Notes** | Old.reddit clone. Very small. |

**Bridge plan:** None.

---

## 4. Video Platforms

### 4.1 Owncast

| Field | Value |
|-------|--------|
| **Protocol** | ActivityPub (FEP-67ff), RTMP ingest, HLS output |
| **License** | MIT |
| **Reach** | ~11.3k GitHub ⭐. Thousands of instances. v0.2.5 (Apr 2026). |
| **API** | REST + Admin API (OpenAPI), WebSocket chat, WebFinger, NodeInfo |
| **Bridge TO** | ✅ ActivityPub S2S — go-live notifications as `Note`, server profile as `Service` actor |
| **Bridge FROM** | 🟡 Followers, likes, announces received. Broadcast-only — doesn't follow other actors. |
| **Fork Potential** | ✅ MIT. Go/TypeScript. Single binary deploy. |
| **Content Types** | Live video (HLS), chat, text posts (go-live announcements) |
| **Priority** | 5 — Already have PeerTube for video. Owncast fills live-streaming niche. Interesting for creator monetization. |
| **Notes** | Single-user live streaming server. ActivityPub for notifications only (doesn't follow). Has FEP-044f quote support. v0.3.0 roadmap: ActivityPub-powered directories + inter-instance follows. Chat system is built-in. |

**Bridge plan:** DegenFeed could offer Owncast as an add-on for creators who want their own live stream server. The ActivityPub go-live notifications would federate through GoToSocial. Integration would be similar to PeerTube but for live content. Cross-protocol bridge: Owncast go-live → announce on Nostr (kind 30311) → announce on Farcaster → Telegram notification.

---

### 4.2 DTube

| Field | Value |
|-------|--------|
| **Protocol** | Was: Steem + IPFS. Now: proprietary (centralized). |
| **License** | Legacy: GPL-3.0 (abandoned). New: closed source. |
| **Reach** | Minimal — relaunched Dec 2025 as centralized ad-supported platform. |
| **API** | Proprietary |
| **Bridge TO** | ❌ |
| **Bridge FROM** | ❌ (legacy Avalon chain may have stale data) |
| **Fork Potential** | ❌ No (new codebase closed source) |
| **Content Types** | Video |
| **Priority** | 10 — Abandoned decentralized model. Now centralized. No integration path. |
| **Notes** | Originally a decentralized YouTube alternative. Abandoned blockchain/IPFS in Dec 2025. Now conventional platform. |

**Bridge plan:** None. Skip entirely.

---

### 4.3 Odysee / LBRY

| Field | Value |
|-------|--------|
| **Protocol** | LBRY protocol (blockchain + distributed network) |
| **License** | MIT (LBRY protocol, Odysee frontend/API) |
| **Reach** | ~10.65M monthly visits (Odysee.com). LBRY SDK: 261 GitHub ⭐. |
| **API** | LBRY SDK JSON-RPC, Odysee REST API |
| **Bridge TO** | ✅ LBRY publish API |
| **Bridge FROM** | ✅ Resolve via LBRY SDK |
| **Fork Potential** | ✅ MIT. LBRY protocol is open. Odysee frontend/API are MIT. Acquired by Forward Research (2024). |
| **Content Types** | Video (primary), audio, images, text, live streams, comments |
| **Priority** | 6 — Decent reach (10M monthly visits) but protocol complexity is high. Hybrid centralized/decentralized model. |
| **Notes** | SEC action against LBRY Inc. created uncertainty. Forward Research acquisition (2024) provides stability. Content is on LBRY network but discovery is through Odysee.com. Blockchain-based content registry. |

**Bridge plan:** Pull trending Odysee content into DegenFeed video feed. Cross-post DegenFeed videos to LBRY for additional distribution. LBRY SDK publish API is straightforward JSON-RPC. Content flow:
- **Odysee → DegenFeed:** Trending Odysee videos in feed
- **DegenFeed → LBRY:** Publish creator content for decentralized storage + distribution

---

### 4.4 Funkwhale (See Section 7.1 — Music/Audio)

Funkwhale is primarily an audio platform but also supports video/visual content. Detailed in [Section 7.1](#71-funkwhale).

---

## 5. Publishing / Blogging

### 5.1 WriteFreely

| Field | Value |
|-------|--------|
| **Protocol** | ActivityPub |
| **License** | AGPL-3.0 |
| **Reach** | ~5.1k GitHub ⭐. ~50.8k total users on fediverse instances. Write.as hosts additional 550k+ blogs. |
| **API** | REST API, ActivityPub S2S, OAuth 2.0 |
| **Bridge TO** | ✅ ActivityPub S2S (blog posts as `Article`) |
| **Bridge FROM** | ✅ ActivityPub S2S |
| **Fork Potential** | ✅ AGPL. Go static binary, SQLite/MySQL. Minimal resource usage. |
| **Content Types** | Text (blog posts, articles), images (attachments) |
| **Priority** | 4 — High value for long-form content. Go binary means easy deployment. |
| **Notes** | Minimalist, distraction-free writing. WriteFreely powers Write.as (the hosted platform). Federation means Mastodon users can follow blogs. Multiple blogs per account. 20+ languages. RTL support. |

**Bridge plan:** Deploy WriteFreely at `blog.degenfeed.xyz`. Enable federation so blog posts appear in Fediverse feeds. Content flows:
- **DegenFeed → WriteFreely:** Cross-post long-form content as blog articles
- **WriteFreely → DegenFeed:** Blog posts appear in feed as long-form content
- **WriteFreely ↔ Mastodon/Fediverse:** Native AP federation (already works)

This creates a long-form publishing layer alongside DegenFeed's short-form aggregation.

---

### 5.2 Plume

| Field | Value |
|-------|--------|
| **Protocol** | ActivityPub |
| **License** | AGPL-3.0 |
| **Reach** | ~2k GitHub ⭐. ~4k total users. ~30+ known instances. |
| **API** | REST API, ActivityPub S2S |
| **Bridge TO** | ✅ ActivityPub S2S |
| **Bridge FROM** | ✅ ActivityPub S2S |
| **Fork Potential** | ✅ AGPL. Rust/Rocket/Diesel. |
| **Content Types** | Text (articles, blog posts), media management |
| **Priority** | 7 |
| **Notes** | Written in Rust. Multi-blog per account. Collaborative writing planned. Development pace is moderate. WriteFreely is more mature and has the same feature set. |

**Bridge plan:** Lower priority than WriteFreely given smaller user base and similar capabilities. If we want a Rust-based alternative to WriteFreely, this could be worth revisiting.

---

### 5.3 Publii

| Field | Value |
|-------|--------|
| **Protocol** | None (static site generator) |
| **License** | GPL-3.0 |
| **Reach** | ~6.5k GitHub ⭐. Thousands of users. |
| **API** | No server API (desktop app outputs static HTML) |
| **Bridge TO** | ❌ |
| **Bridge FROM** | ❌ |
| **Fork Potential** | ✅ GPLv3. Electron desktop app. |
| **Content Types** | Text, images, video (blog posts, pages) |
| **Priority** | 10 — Desktop CMS with no server component. No federation. No integration point. |
| **Notes** | Desktop app generates static sites. Not suitable for DegenFeed integration. |

**Bridge plan:** None.

---

### 5.4 Haven

| Field | Value |
|-------|--------|
| **Protocol** | None (private blog). RSS/Atom. |
| **License** | MIT |
| **Reach** | ~795 GitHub ⭐. Niche/personal use. |
| **API** | No public API (invite-only). RSS reader. |
| **Bridge TO** | ❌ |
| **Bridge FROM** | 🔶 Via private RSS |
| **Fork Potential** | ✅ MIT. Ruby on Rails. AWS/RPi deployable. |
| **Content Types** | Text, images, video, audio (private/password-protected) |
| **Priority** | 10 — Private blogging has no public content to bridge. |
| **Notes** | Private blog for friends and family. No self-signup, no federation. |

**Bridge plan:** None.

---

## 6. Events

### 6.1 Mobilizon

| Field | Value |
|-------|--------|
| **Protocol** | ActivityPub |
| **License** | AGPL-3.0+ |
| **Reach** | ~155 GitHub ⭐. ~89.6k total users (fediDB). ~79 instances. 376k+ events created. |
| **API** | ActivityPub S2S (events as `Event` type, groups as `Group`), GraphQL |
| **Bridge TO** | ✅ ActivityPub S2S |
| **Bridge FROM** | ✅ ActivityPub S2S |
| **Fork Potential** | ✅ AGPL. Elixir/Vue.js. |
| **Content Types** | Events, groups, comments, RSVPs |
| **Priority** | 2 — **Top priority events platform.** Largest Fediverse events ecosystem. Existing user base. |
| **Notes** | Originally by Framasoft (French non-profit). Maintenance handed to Kaihuri (2024) with NLnet funding. Events federate as ActivityPub `Event` type. Mastodon and Friendica can display these. Supports anonymous participation, groups, instance-level following. |

**Bridge plan:** Deploy Mobilizon instance at `events.degenfeed.xyz`. Content flows:
- **Mobilizon → DegenFeed:** Pull events from federated Mobilizon instances → display in DegenFeed event feed
- **DegenFeed → Mobilizon:** Create DegenFeed events (livestreams, meetups, token-gated events) → federate to Fediverse
- **Mobilizon ↔ Mastodon/Gancio/WordPress:** Native AP federation

**Top-priority action:** Deploy Mobilizon. This unlocks event federation for the entire DegenFeed ecosystem. Token-gated events could be a unique feature (RSVP requires holding a creator coin or NFT).

---

### 6.2 Gancio

| Field | Value |
|-------|--------|
| **Protocol** | ActivityPub |
| **License** | AGPL-3.0 |
| **Reach** | ~48 GitHub ⭐. ~3.3k total users. Tiny project, solo maintainer territory. |
| **API** | ActivityPub S2S, RSS/ICS exports, embeddable iframe/web components |
| **Bridge TO** | ✅ ActivityPub S2S (Event type sent on creation) |
| **Bridge FROM** | ✅ Receives Notes, follows Actors, receives Events |
| **Fork Potential** | ✅ AGPL. Node.js/Nuxt/Vue.js. |
| **Content Types** | Events, comments/notes |
| **Priority** | 6 — Small but fills a niche (anonymous event calendars). Good for local communities. |
| **Notes** | Shared agenda for local communities. Anonymous submission by default. No accounts needed to browse. V2.0 alpha (rewrite). Embeds via iframe/web components. |

**Bridge plan:** Gancio and Mobilizon federate natively via ActivityPub (both implement FEP-2677). If we deploy Mobilizon, Gancio content will flow through automatically. No separate Gancio deployment needed unless we want anonymous event submissions for specific communities.

---

### 6.3 Framadate (Pollaris)

| Field | Value |
|-------|--------|
| **Protocol** | None (standalone). No federation. |
| **License** | Pollaris: AGPL-3.0. Old Framadate: CeCILL-B (archived). |
| **Reach** | Framasoft: 6.5M visits/mo across all services. Framadate/Pollaris is one tool. |
| **API** | None public |
| **Bridge TO** | ❌ |
| **Bridge FROM** | ❌ |
| **Fork Potential** | ✅ AGPL (Pollaris). PHP. |
| **Content Types** | Polls (date selection, yes/no) |
| **Priority** | 10 — No federation, no API, no integration path. |
| **Notes** | Doodle alternative. Replaced by Pollaris (AGPLv3 rewrite). No ActivityPub. |

**Bridge plan:** None.

---

## 7. Music / Audio

### 7.1 Funkwhale

| Field | Value |
|-------|--------|
| **Protocol** | ActivityPub |
| **License** | AGPL-3.0 / BSD (dual) |
| **Reach** | ~950+ GitHub ⭐. ~5.4k total users (fediDB). ~50+ instances. |
| **API** | REST API (DRF), ActivityPub S2S, Subsonic API |
| **Bridge TO** | ✅ ActivityPub S2S (audio tracks, playlists as `Audio` objects) |
| **Bridge FROM** | ✅ ActivityPub S2S |
| **Fork Potential** | ✅ AGPL. Python/Django/Vue.js. |
| **Content Types** | Audio (music tracks, albums, playlists), podcast episodes |
| **Priority** | 3 — **Top priority audio platform.** Unique niche: federated music streaming with creator monetization potential. |
| **Notes** | Federated music sharing. Channels feature is most federation-aware — can follow a Funkwhale channel from Mastodon. Funkwhale 2.0 (alpha) brings major improvements: user follows, playlist federation, ListenBrainz integration, better APIs. Break: v2 won't federate with v1 pods. |

**Bridge plan:** Deploy Funkwhale v2 at `music.degenfeed.xyz`. Content flows:
- **Funkwhale → DegenFeed:** Audio tracks appear in feed as playable embeds. Federated playlists from other pods.
- **DegenFeed → Funkwhale:** DegenFeed creators upload music/podcasts → federate to Fediverse.
- **Funkwhale ↔ Mastodon/Fediverse:** Native AP — channels appear in Mastodon timelines.
- **Monetization:** Integrate with DegenFeed tipping (LN + creator coins). ListenBrainz for scrobbling.

**Top-priority action:** Deploy Funkwhale v2. This is the clearest creator monetization opportunity in the audio space.

---

### 7.2 Castopod

| Field | Value |
|-------|--------|
| **Protocol** | ActivityPub |
| **License** | AGPL-3.0 |
| **Reach** | ~855 GitHub ⭐. 1,000+ active podcasts. 43k+ episodes published. |
| **API** | REST API, ActivityPub S2S, Podcasting 2.0 features |
| **Bridge TO** | ✅ ActivityPub S2S (episodes as audio content + posts) |
| **Bridge FROM** | ✅ ActivityPub S2S (comments, likes, shares) |
| **Fork Potential** | ✅ AGPL. PHP/CodeIgniter. |
| **Content Types** | Audio (podcast episodes, video clips, soundbites), transcripts, chapters, location metadata |
| **Priority** | 4 — **Top priority podcast platform.** Fediverse-native podcasting with industry-standard analytics. |
| **Notes** | Only platform that combines ActivityPub with Podcasting 2.0 features (chapters, transcripts, value time, podcasts:funding, location, etc.). IABv2 analytics for ad monetization. Built-in monetization: premium subscriptions, micropayments, tips. Small French company (ad-aures). Self-hostable. |

**Bridge plan:** Deploy Castopod at `podcast.degenfeed.xyz`. Content flows:
- **Castopod → DegenFeed:** Podcast episodes appear in feed as playable audio. New episode announcements flow via AP.
- **DegenFeed → Castopod:** DegenFeed creators publish podcasts → federate episodes to Fediverse.
- **Monetization:** Podcasting 2.0 value time + DegenFeed creator coin integration. Premium episodes behind token gate.
- **Cross-protocol:** New episode → announce on Nostr (kind 1 with link) → Farcaster → Bluesky.

**Top-priority action:** Deploy Castopod. Podcasting 2.0 monetization aligns perfectly with DegenFeed's creator economy vision.

---

### 7.3 Reel2Reel

| Field | Value |
|-------|--------|
| **Protocol** | ActivityPub |
| **License** | AGPL-3.0 (assumed) |
| **Reach** | Minimal — very niche |
| **Content Types** | Audio sharing |
| **Priority** | 10 — Too small to justify integration effort. |
| **Notes** | Very small project. Limited data available. Not widely adopted. |

**Bridge plan:** None.

---

## 8. File Sharing / Storage

### 8.1 Nextcloud (Social / ActivityPub)

| Field | Value |
|-------|--------|
| **Protocol** | ActivityPub (via Nextcloud Social app) |
| **License** | AGPL-3.0 |
| **Reach** | Nextcloud core: 35k+ GitHub ⭐. Nextcloud Social app: ~499 ⭐. Niche adoption within Nextcloud ecosystem. |
| **API** | ActivityPub S2S, REST (Mastodon-compatible v1), WebFinger |
| **Bridge TO** | ✅ ActivityPub S2S (posts, likes, boosts) |
| **Bridge FROM** | ✅ ActivityPub S2S |
| **Fork Potential** | ✅ AGPL. PHP. Nextcloud ecosystem with 400k+ deployments. |
| **Content Types** | Text (social posts), shared files (via Nextcloud), comments, federated file sharing |
| **Priority** | 6 — App is in beta (v0.10.0). Core Nextcloud has massive reach but Social app is niche. |
| **Notes** | Social app allows Nextcloud users to participate in Fediverse. Beta quality but recently revived. Nextcloud core has 400k+ deployments — huge potential reach if Social app adoption grows. Files can be shared and referenced in Fediverse posts. |

**Bridge plan:** Run Nextcloud at `files.degenfeed.xyz` for file storage, with Social app enabled for federation. Content flows:
- **Nextcloud → DegenFeed:** Federated posts from Nextcloud users
- **DegenFeed → Nextcloud:** Files stored in Nextcloud, shared via federated links
- **File sharing:** Nextcloud as backend for DegenFeed file attachments (images, video, audio)

---

### 8.2 IPFS

| Field | Value |
|-------|--------|
| **Protocol** | IPFS (content-addressed P2P) + libp2p |
| **License** | Permissive (Apache/MIT dual) |
| **Reach** | Kubo: 17k+ GitHub ⭐. Thousands of nodes globally. |
| **API** | HTTP RPC API, Kubo API, HTTP Gateways, Routing V1 API. SDKs in Go, TS, Rust, Python, Java. |
| **Bridge TO** | ✅ `ipfs add` + pin to public gateway |
| **Bridge FROM** | ✅ `ipfs cat`/`get` via HTTP gateway or RPC |
| **Fork Potential** | ✅ Open protocol, multiple implementations (Kubo/Go, Helia/JS, iroh/Rust) |
| **Content Types** | Any file type |
| **Priority** | 5 — Infrastructure protocol, not an application. Useful as content-addressed storage layer. |
| **Notes** | Foundation for decentralized storage. 3,000+ contributors. DegenFeed could use IPFS for content-addressed media storage, reducing dependency on centralized S3/file hosting. CIDs provide immutable content references. |

**Bridge plan:** Use IPFS as storage backend for DegenFeed media files:
- Upload images/video to IPFS instead of S3
- Pin content via Pinata or self-hosted IPFS cluster
- Return CIDs for use in ActivityPub content (attachments)
- Already supported by several Fediverse platforms (PeerTube, Pixelfed use it)

---

## 9. Messaging

### 9.1 Matrix

| Field | Value |
|-------|--------|
| **Protocol** | Matrix (open standard, custom federation protocol) |
| **License** | Spec: Apache 2.0. Synapse: AGPL-3.0 (+ commercial). |
| **Reach** | **115M+ total accounts.** 1.2M MAU. 100k+ active homeservers. 18.3M rooms. 8.5M messages/day on matrix.org alone. Adopted by French government (Tchap), German Bundeswehr, German healthcare (gematik). |
| **API** | Client-Server REST API, Server-Server API, Application Service API. Rich SDK ecosystem. |
| **Bridge TO** | ✅ Extensive — official bridges to IRC, Slack, Discord, Telegram, WhatsApp, XMPP, WeChat, Signal, and more. |
| **Bridge FROM** | ✅ Same bridges work bidirectionally. |
| **Fork Potential** | ✅ AGPL (Synapse) / Apache 2.0 (spec). Multiple implementations: Synapse (Python), Dendrite (Go), Conduit (Rust). |
| **Content Types** | Text, images, video, audio, files, voice/video calls (WebRTC), E2EE, bots, widgets, spaces |
| **Priority** | **1 — Highest priority integration of all platforms.** Matrix is the universal bridge layer for all messaging. |
| **Notes** | Matrix is not just a chat platform — it's a federation protocol for real-time communication with the richest bridging ecosystem in existence. The `mautrix` bridge ecosystem (by Tulir Asokan) provides production-quality bridges to WhatsApp, Signal, Telegram, Discord, Slack, Instagram, Google Chat, and more. Matterbridge (7.5k ⭐) provides 30+ protocol bridging. |

**Bridge plan:** Deploy Matrix homeserver (Synapse or Dendrite) at `chat.degenfeed.xyz`. This becomes the **universal chat backbone** for DegenFeed.

```
┌─────────────────────────────────────────────────────┐
│              DegenFeed Matrix (chat.degenfeed.xyz)    │
│                                                       │
│   ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│   │ mautrix   │  │ mautrix  │  │ matrix-appservice │   │
│   │ -whatsapp │  │ -signal  │  │ -irc              │   │
│   └──────────┘  └──────────┘  └──────────────────┘   │
│   ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│   │ mautrix   │  │ mautrix  │  │ matterbridge     │   │
│   │ -telegram │  │ -discord │  │ (30+ protocols)   │   │
│   └──────────┘  └──────────┘  └──────────────────┘   │
│                                                       │
│   DegenFeed feed ← Matrix → GoToSocial (ActivityPub) │
│              ↕                                        │
│         DegenFeed Web Client                          │
└─────────────────────────────────────────────────────┘
```

**Content flows:**
- **Matrix → DegenFeed feed:** Chat messages from bridged platforms appear as social feed items (opt-in)
- **DegenFeed feed → Matrix:** Feed items bridged into Matrix rooms per creator/per community
- **Matrix ↔ ActivityPub:** Matrix → GoToSocial bridge for bidirectional feed<->chat
- **Matrix → Bridged platforms:** Telegram, Discord, WhatsApp, Signal, IRC all connected
- **DegenFeed notifications:** Livestream alerts, creator coin events, security alerts → Matrix → bridged chat platforms

**Top-priority action:** Deploy Matrix (Synapse or Dendrite). This is the single most impactful integration because it unlocks bridging to **every** major messaging platform simultaneously. Matrix IS the bridge hub.

**Implementation notes:**
- Use Dendrite (Go) for lower resource usage over Synapse (Python)
- Deploy `mautrix-whatsapp`, `mautrix-telegram`, `mautrix-signal`, `mautrix-discord` bridges
- Use Matterbridge for additional protocol coverage
- Bridge Matrix rooms to GoToSocial for ActivityPub ↔ Matrix chat

---

### 9.2 XMPP (Jabber)

| Field | Value |
|-------|--------|
| **Protocol** | XMPP (IETF standard — RFC 6120/6121) |
| **License** | Open standard. Servers/clients: various (GPL, Apache, MIT). |
| **Reach** | ~13-20M estimated global users. Powers WhatsApp, Fortnite, Zoom internally. Smaller public federation. |
| **API** | XMPP XML streams, XEP extensions, REST gateways. Libraries in all major languages. |
| **Bridge TO** | ✅ XMPP S2S federation, gateways |
| **Bridge FROM** | ✅ XMPP S2S + public server access |
| **Fork Potential** | ✅ Multiple server implementations: ejabberd (Erlang), Prosody (Lua), Openfire (Java), Tigase. |
| **Content Types** | Text, images, files (via XEP), voice/video (Jingle), group chat (MUC), pubsub |
| **Priority** | 5 — DegenFeed already runs Prosody XMPP at `chat.degenfeed.xyz` for PeerTube stream chat. Matrix + Matterbridge covers most XMPP use cases but XMPP remains valuable as a lightweight chat protocol. |
| **Notes** | Oldest federated chat protocol (1999). Still widely deployed internally (enterprises, governments). Matrix has bridges to XMPP (matrix-bifrost). DegenFeed's existing Prosody instance handles PeerTube chat. XMPP could be deprecated in favor of Matrix longer-term. |

**Bridge plan:** DegenFeed already runs Prosody at `chat.degenfeed.xyz` for PeerTube stream chat. Two paths:
1. **Keep XMPP** for PeerTube chat only — dedicate Prosody to this use case
2. **Migrate to Matrix** for all chat, bridge PeerTube chat via Matrix → XMPP bridge

**Recommendation:** Path 2 longer-term. Matrix provides more features (E2EE, file sharing, spaces) and the bridge ecosystem is richer.

---

### 9.3 Delta Chat

| Field | Value |
|-------|--------|
| **Protocol** | Email (IMAP/SMTP) + OpenPGP E2EE |
| **License** | GPL-3.0 (clients). Chatmail: Rust (dual). |
| **Reach** | ~100k+ estimated users. 40+ chatmail relays. |
| **API** | JSON-RPC API (deltachat-rpc-server), C FFI |
| **Bridge TO** | ✅ Send messages via email (IMAP/SMTP) |
| **Bridge FROM** | ✅ Receive via IMAP |
| **Fork Potential** | ✅ GPLv3. Chatmail relays independently deployable. |
| **Content Types** | Text, images, video, audio, files, webxdc apps (mini-apps), bots |
| **Priority** | 8 — Interesting concept (email-based messenger) but small user base and limited integration upside. |
| **Notes** | Turns email into a modern messenger. No centralized server required — just an email account. Chatmail relays provide metadata-minimizing email onboarding. Webxdc apps are mini apps that run inside Delta Chat — DegenFeed could build a webxdc for feed browsing. |

**Bridge plan:** Delta Chat's JSON-RPC API could be used to bridge DegenFeed notifications into email (which Delta Chat users see as chat). Low priority. The webxdc app concept is interesting — a mini DegenFeed feed browser that runs inside Delta Chat — but would be a novelty.

---

## 10. Priority Integration Roadmap

### Tier 1: Deploy Now (Weeks 1-4)

| # | Platform | Action | Value |
|---|----------|--------|-------|
| 1 | **Matrix** | Deploy Dendrite + mautrix bridges | Universal chat backbone. Bridges to WhatsApp, Signal, Telegram, Discord, IRC simultaneously. |
| 2 | **Mobilizon** | Deploy at events.degenfeed.xyz | Event federation across entire Fediverse. Creator meetups, token-gated events. |
| 3 | **Discourse** | Deploy at forum.degenfeed.xyz + install AP plugin | Forum discussions federated with Fediverse. Full bidirectional content flow. |
| 4 | **Funkwhale** | Deploy v2 at music.degenfeed.xyz | Music/audio creator monetization. Federated music sharing. |

### Tier 2: Deploy Soon (Weeks 5-8)

| # | Platform | Action | Value |
|---|----------|--------|-------|
| 5 | **Castopod** | Deploy at podcast.degenfeed.xyz | Podcast hosting + Fediverse federation + Podcasting 2.0 monetization. |
| 6 | **WriteFreely** | Deploy at blog.degenfeed.xyz | Long-form publishing federated with Fediverse. |
| 7 | **Misskey** | Create packages/misskey-sdk | Access to 1M+ Japanese Fediverse users. |
| 8 | **Owncast** | Offer as add-on for creators | Self-hosted live streaming for DegenFeed creators. |

### Tier 3: Within 3 Months

| # | Platform | Action | Value |
|---|----------|--------|-------|
| 9 | **Flarum** | Deploy custom + build AP extension | Lightweight built-in community platform. |
| 10 | **IPFS** | Use as storage backend | Decentralized content-addressed storage for media. |
| 11 | **Mbin** | Create packages/mbin-sdk | Additional Reddit-like content source. |
| 12 | **Odysee/LBRY** | Cross-publish DegenFeed videos | Additional distribution for creator video content. |

### Tier 4: Monitor (No Immediate Action)

| Platform | Why Wait |
|----------|----------|
| **Bonfire** | Pre-1.0. Monitor for stable release. |
| **Pleroma/Akkoma** | Our Mastodon SDK already covers this. Akkoma growth is slow. |
| **Friendica** | Small user base. Mastodon API covered. |
| **Hubzilla** | Tiny user base despite rich features. |
| **Lobsters** | Read-only RSS bridge. Low value. |
| **Tildes** | Single instance, no write access, invite-only. |
| **Postmill** | Tiny, no federation, no development. |
| **Gancio** | Mobilizon already covers events. Let native federation bridge Gancio. |
| **XMPP** | Already running Prosody for PeerTube chat. Eventually replace with Matrix. |
| **Delta Chat** | Too small. Interesting webxdc concept for later. |
| **Reel2Reel** | Too niche. |
| **Publii/Haven** | No integration path. |
| **DTube** | Abandoned decentralized model. |

---

## 11. Integration Patterns

### Pattern A: ActivityPub Native Federation (Easiest)

For any platform that speaks ActivityPub, DegenFeed can bridge content via:
1. **Existing GoToSocial instance** — Follow the platform's actor from `social.degenfeed.xyz`
2. **ActivityPub S2S** — Send/receive activities directly
3. **Bridgy Fed** — For platforms where Bridgy Fed has a bridge

**Platforms:** Mastodon, Pleroma/Akkoma, Misskey family, Friendica, Hubzilla, Bonfire, Kbin/Mbin, Discourse (with plugin), PeerTube, Owncast, Funkwhale, WriteFreely, Plume, Mobilizon, Gancio, Castopod, Nextcloud Social, Lemmy

### Pattern B: API Integration (Medium)

For platforms without ActivityPub but with REST APIs:
1. **Pull** via their public API (RSS, JSON, GraphQL)
2. **Push** via their write API (if available)
3. **Normalize** in DegenFeed feed-core packages

**Platforms:** Flarum (JSON:API), Lobsters (REST), Odysee/LBRY (JSON-RPC), Reddit (REST, already done)

### Pattern C: Matrix Bridge Hub (Most Powerful)

Matrix acts as a universal bridge for messaging platforms:
1. Deploy Matrix homeserver
2. Deploy mautrix bridges for each target platform
3. Bridge conversations into Matrix rooms
4. Matrix content flows into DegenFeed via Matrix SDK

**Platforms (via Matrix):** WhatsApp, Signal, Telegram, Discord, Slack, IRC, XMPP, WeChat, Google Chat, and 20+ more

### Pattern D: IPFS Storage Layer

For decentralized content-addressed storage:
1. Upload media (images, video, audio) to IPFS
2. Pin via Pinata or self-hosted cluster
3. Reference content by CID in ActivityPub objects
4. Gateways provide HTTP access

### Pattern E: Fork / Self-Hosted Instance

For platforms we want to run ourselves:
1. Deploy our own instance of the platform
2. Enable federation
3. Integrate with DegenFeed auth (wallet sign-in)
4. The instance becomes part of DegenFeed's infrastructure

**Current self-hosted:** GoToSocial, PeerTube, PDS (Bluesky), Redlib, RSS-Bridge, Prosody (XMPP)
**Planned:** Matrix (Dendrite), Mobilizon, Discourse, Funkwhale, Castopod, WriteFreely, Owncast

---

## 12. Content Flow Map

```
                     DegenFeed Content Universe
                     ┌──────────────────────────────────┐
                     │          DegenFeed Feed          │
                     │     (aggregated + ranked)         │
                     └──────────┬───────┬───────────────┘
                                │       │
          ┌─────────────────────┘       └─────────────────────┐
          ▼                                                    ▼
┌─────────────────────┐                          ┌──────────────────────┐
│    SHORT-FORM        │                          │    LONG-FORM          │
│                      │                          │                       │
│ Nostr                │                          │ WriteFreely (blog)    │
│ Farcaster            │                          │ Plume (articles)      │
│ Bluesky              │                          │ Ghost (coming)        │
│ Mastodon / GtS       │                          │ Discourse (forums)    │
│ Threads              │                          │ Flarum (forums)       │
│ Twitter (read-only)  │                          │ RSS/Atom (news)       │
│ Misskey family       │                          │ Lemmy (discussions)   │
│                      │                          │ Mbin (discussions)    │
└─────────────────────┘                          └──────────────────────┘

┌─────────────────────┐                          ┌──────────────────────┐
│    MEDIA              │                          │    EVENTS             │
│                       │                          │                       │
│ PeerTube (video)      │                          │ Mobilizon (events)    │
│ Owncast (live)        │                          │ Gancio (calendars)    │
│ Odysee/LBRY (video)   │                          │                       │
│ Funkwhale (music)     │                          │                       │
│ Castopod (podcasts)   │                          │                       │
│ IPFS (storage)        │                          │                       │
└─────────────────────┘                          └──────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                    CHAT / MESSAGING                        │
│                                                            │
│    Matrix Hub ──▶ mautrix-whatsapp ──▶ WhatsApp            │
│                  ├─ mautrix-telegram ──▶ Telegram           │
│                  ├─ mautrix-signal ────▶ Signal             │
│                  ├─ mautrix-discord ────▶ Discord           │
│                  ├─ mautrix-slack ──────▶ Slack             │
│                  ├─ matrix-appservice-irc ──▶ IRC           │
│                  ├─ matrix-bifrost ──────▶ XMPP             │
│                  └─ GoToSocial bridge ──▶ ActivityPub       │
│                                                            │
│    XMPP (Prosody) ──▶ PeerTube chat (dedicated)             │
│    Telegram Bot ──▶ DegenFeed notifications                 │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                    IDENTITY / MONETIZATION                 │
│                                                            │
│    Cross-Protocol Identity Resolution (packages/identity)  │
│    Creator Coins ──▶ Base (ERC-20) ──▶ Solana (SPL)        │
│    Tips ──▶ Lightning ──▶ EVM ──▶ Creator Coin              │
│    Tipping Matrix: any protocol → any other protocol        │
│    Token-Gated Content ──▶ Mobilizon events ──▶ Forums      │
└──────────────────────────────────────────────────────────┘
```

---

## Appendix A: Fediverse-Wide Stats Reference

| Software | Servers | Total Users | MAU | GitHub Stars |
|----------|---------|-------------|-----|--------------|
| **Mastodon** | 8,602 | ~10M | ~1.5M | 48k+ |
| **Misskey** | 1,086 | ~1.16M | ~150k | 11.2k |
| **PeerTube** | 1,704 | ~600k | ~80k | 13k+ |
| **Pixelfed** | 640 | ~300k | ~40k | 6.5k |
| **Lemmy** | 413 | ~200k | ~25k | 11k+ |
| **Friendica** | 304 | ~30k | ~1.7k | 1.6k |
| **WriteFreely** | ~200 | ~51k | ~3k | 5.1k |
| **Mobilizon** | 79 | ~90k | ~5k | 155 |
| **Funkwhale** | ~50 | ~5.4k | ~1.7k | 950 |
| **Owncast** | 231+ | N/A (per-server) | N/A | 11.3k |
| **Hubzilla** | 99 | ~9k | ~1.1k | ~500 |
| **Bonfire** | <10 | <100 | N/A | 921 |
| **Plume** | ~30 | ~4k | ~500 | 2k |
| **Gancio** | <50 | ~3.3k | ~500 | 48 |
| **Castopod** | ~50 | ~1k podcasts | N/A | 855 |
| **Akkoma** | ~50 | ~9.5k | ~1k | ~115 |

*Sources: fediDB, the-federation.info, Fediverse Observer, individual project data. Numbers are approximate and change frequently. Updated July 2026.*

---

## Appendix B: License Compatibility for Forking

| License | Can Fork? | Can Modify? | Must Open Source? | Commercial Use? |
|---------|-----------|-------------|-------------------|-----------------|
| **MIT** | ✅ | ✅ | ❌ | ✅ |
| **BSD 3-Clause** | ✅ | ✅ | ❌ | ✅ |
| **Apache 2.0** | ✅ | ✅ | ❌ | ✅ |
| **AGPL-3.0** | ✅ | ✅ | ✅ | ✅ |
| **GPL-3.0** | ✅ | ✅ | ✅ | ✅ |

**Key insight:** Platforms under MIT/BSD licenses (Hubzilla, Owncast, Flarum, Lobsters, LBRY/Odysee) give us maximum freedom to fork, modify, and embed without needing to open-source our changes. AGPL platforms require that we open-source modifications if we distribute them (but internal/deployment use is fine).

---

## Appendix C: Recommended Deployment Architecture

```
                    ┌─────────────────────────────────────────┐
                    │         DegenFeed Infrastructure         │
                    │                                          │
                    │  Core (already deployed):                 │
                    │    social.degenfeed.xyz   (GoToSocial)    │
                    │    pds.degenfeed.xyz      (Bluesky PDS)   │
                    │    video.degenfeed.xyz    (PeerTube)      │
                    │    redlib.degenfeed.xyz   (Redlib proxy)  │
                    │    rss-bridge.degenfeed.xyz (RSS-Bridge)  │
                    │    chat.degenfeed.xyz     (Prosody XMPP)  │
                    │    bridgy.degenfeed.xyz  (Bridgy Fed)     │
                    │                                          │
                    │  Tier 1 (deploy now):                    │
                    │    chat.degenfeed.xyz   → Matrix/Dendrite │
                    │    events.degenfeed.xyz → Mobilizon       │
                    │    forum.degenfeed.xyz  → Discourse       │
                    │    music.degenfeed.xyz  → Funkwhale v2    │
                    │                                          │
                    │  Tier 2 (deploy soon):                   │
                    │    podcast.degenfeed.xyz → Castopod       │
                    │    blog.degenfeed.xyz    → WriteFreely    │
                    │    owncast.degenfeed.xyz → Owncast (opt)  │
                    │                                          │
                    │  Tier 3 (within 3 months):               │
                    │    forum-alt.degenfeed.xyz → Flarum       │
                    │    files.degenfeed.xyz    → Nextcloud     │
                    │    ipfs.degenfeed.xyz     → IPFS Kubo     │
                    └─────────────────────────────────────────┘
```

---

## Appendix D: Quick Reference — All Platforms Summary

| # | Platform | Protocol | License | Reach | Bridge TO | Bridge FROM | Fork? | Priority |
|---|----------|----------|---------|-------|-----------|-------------|-------|----------|
| 1 | **Matrix** | Matrix | Apache/AGPL | 115M+ | ✅ | ✅ | ✅ | **1** |
| 2 | **Mobilizon** | AP | AGPL | 90k | ✅ | ✅ | ✅ | **2** |
| 3 | **Discourse** | AP (plugin) | MIT | 100k+ commun. | ✅ | 🟡 | ✅ | **3** |
| 4 | **Funkwhale** | AP | AGPL | 5.4k | ✅ | ✅ | ✅ | **3** |
| 5 | **Castopod** | AP | AGPL | 1k podcasts | ✅ | ✅ | ✅ | **4** |
| 6 | **Misskey** | AP | AGPL | 1.16M | ✅ | ✅ | ✅ | **5** |
| 7 | **WriteFreely** | AP | AGPL | 51k | ✅ | ✅ | ✅ | **4** |
| 8 | **Owncast** | AP | MIT | 11.3k⭐ | ✅ | 🟡 | ✅ | **5** |
| 9 | **Flarum** | JSON:API | MIT | 16.3k⭐ | 🔶 | 🔶 | ✅ | **5** |
| 10 | **Mbin** | AP | AGPL | 10.2k | ✅ | ✅ | ✅ | **6** |
| 11 | **Odysee/LBRY** | LBRY | MIT | 10.6M/mo | ✅ | ✅ | ✅ | **6** |
| 12 | **IPFS** | IPFS | Apache/MIT | 17k⭐ | ✅ | ✅ | ✅ | **5** |
| 13 | **Friendica** | AP+ | AGPL | 30k | ✅ | ✅ | ✅ | **7** |
| 14 | **Nextcloud** | AP (plugin) | AGPL | 400k deploys | ✅ | ✅ | ✅ | **6** |
| 15 | **Akkoma** | AP | AGPL | 9.5k | ✅ | ✅ | ✅ | **6** |
| 16 | **Lobsters** | Custom | BSD | 5k | ❌ | ✅ | ✅ | **7** |
| 17 | **Bonfire** | AP | AGPL | Pre-release | ✅ | ✅ | ✅ | **9** |
| 18 | **XMPP** | XMPP | Various | 13-20M | ✅ | ✅ | ✅ | **5** |
| 19 | **Hubzilla** | Zot6/AP | **MIT** | 9k | ✅ | ✅ | ✅ | **8** |
| 20 | **Plume** | AP | AGPL | 4k | ✅ | ✅ | ✅ | **7** |
| 21 | **Gancio** | AP | AGPL | 3.3k | ✅ | ✅ | ✅ | **6** |
| 22 | **Delta Chat** | Email/IMAP | GPL | 100k | ✅ | ✅ | ✅ | **8** |
| 23 | **Iceshrimp** | AP | AGPL | 3.5k | ✅ | ✅ | ✅ | **8** |
| 24 | **Tildes** | Custom | AGPL | 15k | ❌ | 🔶 | ✅ | **10** |
| 25 | **Postmill** | RSS | GPL | Tiny | ❌ | 🔶 | ✅ | **10** |
| 26 | **DTube** | Proprietary | Closed | Minimal | ❌ | ❌ | ❌ | **10** |
| 27 | **Publii** | None | GPL | 6.5k⭐ | ❌ | ❌ | ✅ | **10** |
| 28 | **Haven** | None | MIT | 795⭐ | ❌ | ❌ | ✅ | **10** |
| 29 | **Reel2Reel** | AP | AGPL | Niche | ✅ | ✅ | ✅ | **10** |
| 30 | **Framadate/** | None | AGPL | Service | ❌ | ❌ | ✅ | **10** |

**Key:**
- **AP** = ActivityPub
- **Priority** = 1 (immediate) to 10 (skip)
- **Bridge TO** = Can DegenFeed content appear on this platform?
- **Bridge FROM** = Can this platform's content appear in DegenFeed?

---

*This is a living document. Update as new platforms emerge, integration status changes, or user data becomes available.*

---

## 13. Newly Integrated: Audius

| Field | Value |
|-------|--------|
| **Protocol** | Open Audio Protocol (custom) |
| **License** | Apache-2.0 |
| **Reach** | ~400M streams, open music catalog |
| **API** | REST API + JS SDK (`@audius/sdk`) + gRPC |
| **Bridge TO** | 🔶 API write (requires auth) |
| **Bridge FROM** | ✅ Trending tracks, artist updates, playlists |
| **Self-Host** | ✅ Docker validator (go-openaudio) |
| **Content Types** | Music tracks, albums, playlists, artist profiles |
| **Priority** | 1 — Integrated. See docs/MISSED_PLATFORMS.md |
| **Notes** | Free tier: 500K requests/month. First decentralized music integration. |

## 14. Newly Integrated: Rarible Protocol

| Field | Value |
|-------|--------|
| **Protocol** | Rarible Protocol (EVM + custom) |
| **License** | MIT |
| **Reach** | 5,000+ marketplaces, billions of NFTs indexed |
| **API** | REST API + TS SDK (`@rarible/sdk`) + MCP server |
| **Bridge TO** | ✅ NFT minting, listing, buying (via SDK) |
| **Bridge FROM** | ✅ NFT sales, mints, listings across 7+ chains |
| **Self-Host** | ✅ Docker validator + MCP server |
| **Content Types** | NFT sales, mints, listings, collection data |
| **Priority** | 1 — Integrated. See docs/MISSED_PLATFORMS.md |
| **Notes** | Aggregated orderbook includes OpenSea data. 99.99% uptime. |
