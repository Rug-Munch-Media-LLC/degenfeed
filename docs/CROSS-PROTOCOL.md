# Cross-Protocol Communication & Interoperability Study

> Status: live snapshot — bridge `v0.4.0`, crossposter v3, composer `CrossPostComposer.tsx`.
> Last updated: 2026-08-31. This document answers: *which protocols do we CONNECT
> to, which can we POST to, and what remains for full interoperability?*

DegenFeed is a **read-mostly aggregator with a write path that grows per protocol**.
The READ surface is large (70+ providers in `bridge/src/providers/*` and
`bridge/src/server/feeds.ts` `PROVIDERS`). The WRITE surface is deliberately
smaller and split across **two different write engines**:

| Write engine | Where | Purpose | Protocols |
|---|---|---|---|
| **Bridge `/api/publish` fan-out** | `bridge/src/server/publish-routes.ts` | User-facing composer POST (`VALID_PROTOCOLS` allow-list) | nostr, mastodon, bluesky, farcaster |
| **Background cross-poster** | `bridge/src/crossposter.ts` | Automated source→target pairs (poll + transform + publish) | POST targets: nostr, bluesky, peertube, farcaster, lens, mastodon, pixelfed, writefreely |

The user-facing composer (`apps/web/src/components/CrossPostComposer.tsx`) marks
platforms with `bridgeProtocol: true` and **only those four** are actually
publishable (`nostr`, `farcaster`, `bluesky`, `mastodon`); everything else in the
picker (lens, reddit, telegram, discord, threads, lemmy, peertube, pixelfed) is
shown but **skipped as "not bridge-supported"** on publish.

---

## Protocol × READ / POST matrix

| Protocol | READ (feed) | POST (composer `/api/publish`) | POST (background crossposter) | What's needed for full interop |
|---|---|---|---|---|
| **Mastodon / GoToSocial** (ActivityPub) | ✅ `mastodon` provider → self-hosted GTS `127.0.0.1:8082` | ✅ | ✅ | OAuth app creds (GTS_CLIENT_ID/SECRET) + `MASTODON_ACCESS_TOKEN`. We own the instance (`social.degenfeed.xyz`) so POST is fully under our control. |
| **Bluesky** (AT Protocol) | ✅ `atproto`/`bluesky` providers → self-hosted PDS `127.0.0.1:3012` | ✅ | ✅ | `BLUESKY_CROSSPOST_JWT` + account DID (or user session token). Own the PDS; the network index is global. |
| **Nostr** | ✅ relays (local `ws://127.0.0.1:32768` / `:8085` + public relays) | ✅ | ✅ | nsec keypair + relay(s) write perms; NIP-05 optional. No network gate — key-pair ownership only; we run a local relay. |
| **Farcaster** | ✅ Hubble `127.0.0.1:8200` + Neynar fallback | ✅ | ✅ | `FARCASTER_BOT_FID` + `FARCASTER_BOT_SIGNER_KEY` (signer registered with the network); submit via Hubble `/v1/submitMessage`. Network is **permissioned** (fid/signer registration). |
| **Lens** | ✅ `lens` provider | ❌ not in composer fan-out | ✅ `publishToLens` (LENS_ACCESS_TOKEN + LENS_PROFILE_ID) | Add `lens` to `VALID_PROTOCOLS` + `bridgeProtocol: true` in composer; wire per-user profile token. API-gated; content posted as data-URI on-chain. |
| **Lemmy** | ✅ `lemmy` provider → self-hosted `127.0.0.1:8536` | ❌ | ❌ (used as **source** only — `lemmy-to-nostr`) | Lemmy JWT + community ID; POST via `/api/v3/post` (CreatePost). Own the instance (`community.degenfeed.xyz`) — federation ownership, not global. |
| **Threads** | ✅ `threads` provider | ❌ | ❌ | Meta Graph/Threads API token (app-review-gated) or Bridgy Fed webmention bridge. Proprietary/closed — no self-hosting. |
| PeerTube | ✅ | ❌ | ✅ `publishToPeerTube` (announce video) | `PEERTUBE_ACCESS_TOKEN`; announce-only, no video upload. Own `video.degenfeed.xyz`. |
| Pixelfed | ✅ | ❌ | ✅ `publishToPixelfed` (photo) | `PIXELFED_ACCESS_TOKEN` + `pixelfed-write` provider. Own `photos.degenfeed.xyz`. |
| WriteFreely | ✅ | ❌ | ✅ `postToWriteFreely` (blog) | `WRITEFREELY_TOKEN` + alias. Own `blog.degenfeed.xyz`. |
| Reddit / Telegram / Discord / Matrix / GitHub / YouTube / RSS etc. | ✅ (many) | ❌ | ❌ | No write path today. Reddit needs OAuth + subreddit perms; Telegram/Discord need bot tokens + channel IDs; RSS/YouTube read-only by nature. |

> "Full interoperability" for a protocol = user can both read posts AND write
> (compose + cross-post) with their own authenticated identity, and reactions
> (like/repost/reply/follow) round-trip. We currently achieve read + write for
> **4 of 7 headline protocols** (Mastodon/GTS, Bluesky, Nostr, Farcaster), have a
> bot-only write path for Lens/PeerTube/Pixelfed/WriteFreely, and are **read-only
> for Lemmy and Threads**.

---

## Network ownership — what it means per protocol

"Ownership" is the degree to which we control identity, data, and write
authorization on a network. It ranges from **full** (self-hosted + our own
account) to **none** (proprietary API).

| Protocol | Ownership model | Who holds the identity | Write auth | Can we self-host? |
|---|---|---|---|---|
| **Mastodon / GTS** | **Instance ownership** — we run `social.degenfeed.xyz`; federation means posts are also mirrored on other instances. | The instance + account | OAuth app token for the instance | ✅ yes (GoToSocial) |
| **Bluesky** | **PDS ownership** — we run a PDS; identity (DID) lives in the shared AT Protocol network. | User DID + signing key | Session JWT (`com.atproto.repo.createRecord`) | ✅ yes (own PDS) |
| **Nostr** | **Key ownership** — the protocol IS the keys. Nobody owns relays; we run one relay for write persistence. | nsec (private key) | Signed NIP-01 event over WebSocket | ✅ relays are commodity infra |
| **Farcaster** | **Hybrid (permissioned)** — network owns the registry; we own a Hubble node + signer. | fid + signer registered with Farcaster | Signed MessageData to Hubble `submitMessage` | ⚠️ node yes, **registry no** |
| **Lens** | **API-gated** — profiles on-chain, but publishing goes through Lens API (mutation access token). | On-chain profile (wallet) | Lens API `CreatePost` mutation | ❌ no (API required) |
| **Lemmy** | **Instance ownership (federation)** — we run `community.degenfeed.xyz`; communities federate. | Instance account | Instance JWT + community mod perms | ✅ yes |
| **Threads** | **None** — proprietary Meta platform. | Meta account | Meta API token (app review) or Bridgy Fed | ❌ no |

### Readiness summary

- **Fully interoperable (read + write + identity):** Mastodon/GTS, Bluesky, Nostr, Farcaster.
- **Bot-write only (no user-facing composer):** Lens, PeerTube, Pixelfed, WriteFreely.
- **Read-only today:** Lemmy (needs POST publisher), Threads (needs Meta API / Bridgy Fed).
- **Long tail:** 50+ more providers are read-only (Reddit, Telegram, Discord, Matrix,
  RSS, YouTube, GitHub, Hive, Minds, Scuttlebutt, etc.) — write paths are
  prioritized by user demand.

### Recommended next steps (priority order)

1. **Lemmy POST** — we own the instance; add `publishToLemmy` (JWT + community) and extend `VALID_PROTOCOLS`. Low cost, high ownership.
2. **Lens to composer** — publisher exists in the crossposter; promote to the bridge fan-out + `bridgeProtocol: true` (needs per-user LENS_ACCESS_TOKEN).
3. **Threads via Bridgy Fed** — reuse existing `BRIDGY-FED-INTEGRATION.md` webmention path instead of Meta app review.
4. **Reaction round-trip** — likes/reposts/replies/follows are still generated-sample only (`generateCrossProtocolNotifications`); wire real per-protocol notification APIs for full interop.
