# DegenFeed Protocol Provider Registry

> **Total: 45 providers** — Last updated: 2026-07-25
> **Cleanup: Removed 14 dead providers, implemented 8 real content bridges**

Every protocol is documented with its SDK package, provider file, write bridge, and status.

---

## Legend

| Status | Meaning |
|--------|---------|
| ✅ Live | Fully operational in production |
| 🟡 Degraded | Operational with known issues |
| 🔵 Beta | In testing, not yet production |
| 🔴 Down | Currently unavailable |

---

## Full Protocol Registry

| # | Protocol | SDK Package | Provider File (Bridge) | Write Bridge | Status | Notes |
|---|----------|-------------|------------------------|--------------|--------|-------|
| 1 | Nostr | `nostr-sdk` | `nostr.ts` | `nostr-write.ts` | ✅ Live | NIPs-11, relay aggregation, zap receipts |
| 2 | Farcaster | `farcaster-sdk` | `farcaster.ts` | `farcaster-write.ts` | ✅ Live | Hubble self-hosted |
| 3 | Lens | `lens-sdk` | `lens.ts` | `lens-poster.ts` | ✅ Live | Lens v3 API |
| 4 | Bluesky / ATProto | `bluesky-sdk` | `bluesky.ts` | `bluesky-write.ts` | ✅ Live | PDS + firehose |
| 5 | Mastodon / GoToSocial | `mastodon-sdk` | `gotosocial.ts` | — | ✅ Live | ActivityPub REST |
| 6 | Pixelfed | `pixelfed-sdk` | `pixelfed.ts` | `pixelfed-write.ts` | ✅ Live | Mastodon-compat API + Atom feeds |
| 7 | Threads | `threads-sdk` | `threads.ts` | — | ✅ Live | Meta API (limited) |
| 8 | RSS / Newsletter | `rss-sdk` | `rss.ts` | — | ✅ Live | 100+ RSS + newsletter sources |
| 9 | Reddit / Redlib | — | `redlib.ts` | — | ✅ Live | Redlib public instances |
| 10 | Lemmy | `lemmy-sdk` | `lemmy.ts` | — | ✅ Live | Lemmy instances + communities |
| 11 | PeerTube | `peertube-sdk` | `peertube.ts` | — | ✅ Live | Self-hosted + public |
| 12 | Zora | `zora-sdk` | `zora.ts` | — | ✅ Live | NFT + creator coins |
| 13 | Telegram | `telegram-sdk` | `telegram.ts` | — | ✅ Live | Bot + channel integration |
| 14 | Discord | `discord-sdk` | `discord.ts` | — | ✅ Live | Guild + channel feeds |
| 15 | Matrix | — | `matrix.ts` | — | 🟡 Degraded | Homeserver federation |
| 16 | GitHub | — | `github.ts` | — | ✅ Live | Repo events + issues |
| 17 | Mirror.xyz | `mirror-sdk` | `mirror.ts` | `mirror-bridge/` | ✅ Live | GraphQL + RSS fallback |
| 18 | Paragraph | `paragraph-bridge` | `paragraph.ts` | — | ✅ Live | Newsletter + blog |
| 19 | Ghost / Substack | `ghost-bridge` | `ghost.ts` | — | ✅ Live | Newsletters |
| 20 | **DTube** | `dtube-sdk` (planned) | `dtube.ts` | — | 🔵 Beta | Hive + DTube API |
| 21 | Odysee / LBRY | `lbry-sdk` (planned) | `lbry.ts` | — | 🔵 Beta | LBRY JSON-RPC + claim search |
| 22 | Gab / Dissenter | — | `gab.ts` | — | 🔵 Beta | Mastodon-compat API |
| 23 | Minds | — | `minds.ts` | — | 🔵 Beta | Minds v3 REST API |
| 24 | Aether | — | `aether.ts` | — | 🔵 Beta | P2P communities REST API |
| 25 | Scuttlebutt / SSB | — | `scuttlebutt.ts` | — | 🔵 Beta | SSB pubs + local node |
| 26 | Hive Blog | — | `hive.ts` | — | 🔵 Beta | Hive JSON-RPC |
| 27 | Funkwhale | `funkwhale-sdk` (planned) | `funkwhale.ts` | — | 🔵 Beta | Federated music/audio (ActivityPub) |
| 28 | Castopod | `castopod-sdk` (planned) | `castopod.ts` | — | 🔵 Beta | Federated podcasting (ActivityPub) |
| 29 | RSS-Bridge | — | `rssbridge.ts` | — | ✅ Live | Self-hosted content bridge for walled gardens |
| 30 | WriteFreely | — | `writefreely.ts` | — | 🔵 Beta | Federated writing platform |
| 31 | MediaGoblin | — | `mediagoblin.ts` | — | 🔵 Beta | Federated media sharing |
| 32 | Owncast | — | `owncast.ts` | — | 🔵 Beta | Live streaming |
| 33 | Mobilizon | — | `mobilizon.ts` | — | 🔵 Beta | Federated events |
| 34 | BookWyrm | — | `bookwyrm.ts` | — | ✅ Live | Federated book tracking (Goodreads alt) |
| 35 | **Misskey** (NEW) | — | `misskey.ts` | — | 🔵 Beta | Rich media microblogging via Misskey API |
| 36 | **Pleroma/Akkoma** (NEW) | — | `pleroma.ts` | — | 🔵 Beta | Lightweight fedi via Mastodon API |
| 37 | **Friendica** (NEW) | — | `friendica.ts` | — | 🔵 Beta | Federated social via Mastodon API |
| 38 | **Diaspora\*** (NEW) | — | `diaspora.ts` | — | 🔵 Beta | Federated pods via JSON activity feed |
| 39 | **Kbin** (NEW) | — | `kbin.ts` | — | 🔵 Beta | Fediverse Reddit-like via Kbin API |
| 40 | **Mbin** (NEW) | — | `mbin.ts` | — | 🔵 Beta | Active Kbin fork via Kbin API |
| 41 | **Arweave** (NEW) | — | `arweave.ts` | — | 🔵 Beta | Permaweb content via GraphQL |
| 42 | **Flarum** (NEW) | — | `flarum.ts` | — | 🔵 Beta | Forum discussions via Flarum API |

---

## Infrastructure Providers (status-only, excluded from main feed)

| # | Protocol | Provider File | Notes |
|---|----------|---------------|-------|
| 1 | XMTP | `xmtp.ts` | Web3 messaging — gateway status only |
| 2 | Ceramic / ComposeDB | `ceramic.ts` | Decentralized data network — node status |
| 3 | Tableland | `tableland.ts` | Decentralized SQLite — node health queries |
| 4 | CyberConnect | `cyberconnect.ts` | Web3 social graph — profile lookups |
| 5 | Push Protocol | `push.ts` | Web3 notifications — channel updates |
| 6 | Huddle01 | `huddle01.ts` | Decentralized video — room status |

---

## Removed Providers (dead shells — files kept on disk)

The following 14 providers had no real content source. Their files remain on disk but are not registered in routing:

Known, Plume, Publii, Hubzilla, Streams, Guppe, Epicyon, Sublinks, IPFS Cluster, Headscale, Yggdrasil, Firefish, Iceshrimp, Sharkey

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    DegenFeed Bridge                  │
│  bridge/src/providers/                              │
│  ├── nostr.ts         ├── pixelfed.ts                │
│  ├── farcaster.ts     ├── threads.ts                 │
│  ├── lens.ts          ├── rss.ts                     │
│  ├── bluesky.ts       ├── redlib.ts                  │
│  ├── gotosocial.ts    ├── lemmy.ts                   │
│  ├── peertube.ts      ├── zora.ts                    │
│  ├── dtube.ts         ├── lbry.ts                    │
│  ├── gab.ts           ├── minds.ts                   │
│  ├── aether.ts        ├── scuttlebutt.ts             │
│  ├── hive.ts          ├── mirror.ts                  │
│  ├── funkwhale.ts     ├── castopod.ts                │
│  ├── rssbridge.ts     ├── bookwyrm.ts                │
│  │                                                    │
│  ├── N E W  2 0 2 6 - 0 7 - 2 5                      │
│  ├── misskey.ts       ├── pleroma.ts                 │
│  ├── friendica.ts     ├── diaspora.ts                │
│  ├── arweave.ts       ├── kbin.ts                    │
│  ├── mbin.ts          ├── flarum.ts                  │
│  │                                                    │
│  ├── Infrastructure (status-only)                    │
│  ├── xmtp.ts          ├── ceramic.ts                 │
│  ├── tableland.ts     ├── cyberconnect.ts            │
│  ├── push.ts          ├── huddle01.ts                │
└─────────────────────────────────────────────────────┘
```

## API Reference

| Endpoint | Description |
|----------|-------------|
| `GET /api/protocols/status` | Health status of ALL protocols |
| `GET /api/protocols/status/:name` | Single protocol health |
| `GET /api/feed/:name?limit=N` | Fetch feed from specific protocol |
| `GET /api/bridge/health` | Bridge health overview (legacy) |
