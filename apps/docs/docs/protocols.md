---
sidebar_position: 2
title: Protocols DegenFeed Connects To
---

# Protocols

DegenFeed is a **read-mostly aggregator with a write path that grows per
protocol**. The READ surface is large (70+ providers in
`bridge/src/providers/*`). The WRITE surface is deliberately smaller and split
across two write engines:

| Write engine | Where | Purpose | Protocols |
|---|---|---|---|
| **Bridge `/api/publish` fan-out** | `bridge/src/server/publish-routes.ts` | User-facing composer POST (`VALID_PROTOCOLS` allow-list) | nostr, mastodon, bluesky, farcaster |
| **Background cross-poster** | `bridge/src/crossposter.ts` | Automated source→target pairs (poll + transform + publish) | POST targets: nostr, bluesky, peertube, farcaster, lens, mastodon, pixelfed, writefreely |

The user-facing composer (`apps/web/src/components/CrossPostComposer.tsx`)
marks platforms with `bridgeProtocol: true` — only those four are actually
publishable today; everything else in the picker is shown but skipped as
"not bridge-supported" on publish.

## Protocol × READ / POST matrix

| Protocol | READ (feed) | POST (composer) | POST (crossposter) | Notes |
|---|---|---|---|---|
| **Mastodon / GoToSocial** (ActivityPub) | ✅ | ✅ | ✅ | Self-hosted GTS at `social.degenfeed.xyz`; OAuth app creds + `MASTODON_ACCESS_TOKEN`. |
| **Bluesky** (AT Protocol) | ✅ | ✅ | ✅ | Self-hosted PDS; `BLUESKY_CROSSPOST_JWT` + account DID. |
| **Nostr** | ✅ | ✅ | ✅ | Local relay + public relays; nsec keypair, signed NIP-01 events. |
| **Farcaster** | ✅ | ✅ | ✅ | Hubble node + Neynar fallback; `FARCASTER_BOT_FID` + registered signer. |
| **Lens** | ✅ | ❌ | ✅ | `LENS_ACCESS_TOKEN` + profile ID; API-gated, content posted as data-URI on-chain. |
| **Lemmy** | ✅ | ❌ | ❌ (source only — `lemmy-to-nostr`) | Self-hosted instance at `community.degenfeed.xyz`; POST needs JWT + community ID. |
| **Threads** | ✅ | ❌ | ❌ | Meta Graph/Threads API token (app-review-gated) or Bridgy Fed webmention bridge. |
| **PeerTube** | ✅ | ❌ | ✅ (announce video) | `PEERTUBE_ACCESS_TOKEN`; announce-only, no video upload. Own `video.degenfeed.xyz`. |
| **Pixelfed** | ✅ | ❌ | ✅ (photo) | `PIXELFED_ACCESS_TOKEN`. Own `photos.degenfeed.xyz`. |
| **WriteFreely** | ✅ | ❌ | ✅ (blog) | `WRITEFREELY_TOKEN` + alias. Own `blog.degenfeed.xyz`. |
| **Reddit** | ✅ | ❌ | ❌ | Needs OAuth + subreddit perms for write. |
| **RSS** | ✅ | ❌ | ❌ | Read-only by nature. |
| **YouTube** | ✅ | ❌ | ❌ | Read-only (channel uploads). |
| **Zora** | ✅ | ❌ | ❌ | On-chain mints/collections surfaced into the feed. |

> "Full interoperability" = read + write (compose + cross-post) with your own
> authenticated identity, and reactions round-trip. We currently achieve
> read + write for **4 of 7 headline protocols** (Mastodon/GTS, Bluesky, Nostr,
> Farcaster), bot-only write for Lens/PeerTube/Pixelfed/WriteFreely, and are
> **read-only for Lemmy and Threads**.

## Per-protocol detail

### Mastodon / GoToSocial (ActivityPub)

- **What it is:** the federated microblogging network. Each server (instance)
  hosts accounts and federates posts to other instances over ActivityPub.
- **How we connect:** READ via the `mastodon` provider against our self-hosted
  GoToSocial instance (`127.0.0.1:8082`, public at `social.degenfeed.xyz`).
  POST via the composer fan-out and the background crossposter.
- **Ownership model:** **instance ownership** — we run the instance, so POST is
  fully under our control. Federation mirrors posts to other instances.

### Bluesky (AT Protocol)

- **What it is:** a protocol where identity is a DID in a shared network and
  user data lives on a Personal Data Server (PDS).
- **How we connect:** READ via the `atproto`/`bluesky` providers against our
  self-hosted PDS (`127.0.0.1:3012`). POST via `com.atproto.repo.createRecord`
  with a session JWT.
- **Ownership model:** **PDS ownership** — we run the PDS, but identity (DID)
  lives in the global AT Protocol network index.

### Nostr

- **What it is:** a simple, relay-based protocol where identity IS a keypair
  and events are signed NIP-01 notes.
- **How we connect:** READ from local relays (`ws://127.0.0.1:32768`,
  `:8085`) plus public relays. POST by signing events with an nsec keypair.
- **Ownership model:** **key ownership** — the protocol IS the keys. Nobody
  owns relays; we run one local relay for write persistence.

### Farcaster

- **What it is:** a sufficiently-decentralized social network with casts,
  frames, and an on-chain identity registry (fid).
- **How we connect:** READ from our Hubble node (`127.0.0.1:8200`) with a
  Neynar fallback. POST via Hubble `/v1/submitMessage` with a registered
  signer.
- **Ownership model:** **hybrid (permissioned)** — we own a Hubble node and a
  signer, but the network owns the fid/signer registry.

### Lens

- **What it is:** a composable, on-chain social graph (profiles are NFTs).
- **How we connect:** READ via the `lens` provider. POST via the background
  crossposter (`publishToLens`) using `LENS_ACCESS_TOKEN` +
  `LENS_PROFILE_ID`.
- **Ownership model:** **API-gated** — profiles are on-chain, but publishing
  goes through the Lens API (mutation access token). Not self-hostable.

### Lemmy

- **What it is:** federated link aggregator / discussion forums (ActivityPub).
- **How we connect:** READ via the `lemmy` provider against our self-hosted
  instance (`127.0.0.1:8536`, public at `community.degenfeed.xyz`). Used as a
  **source** for cross-posting (`lemmy-to-nostr`).
- **Ownership model:** **instance ownership (federation)** — we run the
  instance; communities federate. POST (JWT + community ID) is on the roadmap.

### Threads

- **What it is:** Meta's proprietary text app with ActivityPub federation.
- **How we connect:** READ via the `threads` provider. No write path today.
- **Ownership model:** **none** — proprietary platform. Write would require a
  Meta API token (app-review-gated) or the Bridgy Fed webmention bridge.

### Reddit

- **What it is:** centralized link/discussion platform with a large API.
- **How we connect:** READ via the `reddit` provider. No write path.
- **Ownership model:** **none** — write requires OAuth + subreddit permissions.

### RSS

- **What it is:** the open web feed standard — blogs, podcasts, anything.
- **How we connect:** READ via the `rss` provider (plus the `rss-sdk` package)
  polling arbitrary feeds. Read-only by nature.
- **Ownership model:** **publisher ownership** — whoever controls the feed URL.

### YouTube

- **What it is:** centralized video platform.
- **How we connect:** READ via the `youtube` provider / `youtube-provider`
  package (channel uploads surfaced into the feed). Read-only.
- **Ownership model:** **none** — Google account + API quota.

### PeerTube

- **What it is:** federated, self-hostable video platform (ActivityPub).
- **How we connect:** READ via the `peertube` provider. POST via the
  crossposter (`publishToPeerTube`) — announce-only, no video upload.
- **Ownership model:** **instance ownership** — we run `video.degenfeed.xyz`.

### Pixelfed

- **What it is:** federated, self-hostable photo sharing (ActivityPub).
- **How we connect:** READ via the `pixelfed` provider. POST via the
  crossposter (`publishToPixelfed`) using `PIXELFED_ACCESS_TOKEN`.
- **Ownership model:** **instance ownership** — we run `photos.degenfeed.xyz`.

### Zora

- **What it is:** on-chain media/minting protocol (ERC-721 mints on Ethereum
  L2s).
- **How we connect:** READ via the `zora-sdk` package — mints and collections
  surfaced into the feed. No write path.
- **Ownership model:** **on-chain** — content is contracts; we only index.

## Readiness summary

- **Fully interoperable (read + write + identity):** Mastodon/GTS, Bluesky,
  Nostr, Farcaster.
- **Bot-write only (no user-facing composer):** Lens, PeerTube, Pixelfed,
  WriteFreely.
- **Read-only today:** Lemmy (needs POST publisher), Threads (needs Meta API /
  Bridgy Fed).
- **Long tail:** 50+ more providers are read-only (Reddit, Telegram, Discord,
  Matrix, RSS, YouTube, GitHub, Hive, Minds, Scuttlebutt, etc.) — write paths
  are prioritized by user demand.

## Source

This page is generated from the live snapshot in
[`docs/CROSS-PROTOCOL.md`](https://git.rugmunch.io/RugMunchMedia/degenfeed-web/-/blob/main/docs/CROSS-PROTOCOL.md)
(bridge `v0.4.0`, crossposter v3). See also
[PROTOCOL-DEEP-DIVE.md](https://git.rugmunch.io/RugMunchMedia/degenfeed-web/-/blob/main/docs/PROTOCOL-DEEP-DIVE.md)
and
[PROTOCOL_STATUS.md](https://git.rugmunch.io/RugMunchMedia/degenfeed-web/-/blob/main/docs/PROTOCOL_STATUS.md).
