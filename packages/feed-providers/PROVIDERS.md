# DegenFeed Protocol Provider Registry

> **Total: 26+ protocols** — Last updated: 2026-07-25

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
| 13 | YouTube | — | — | — | 🟡 Degraded | API quota limited |
| 14 | Telegram | `telegram-sdk` | — | — | ✅ Live | Bot + channel integration |
| 15 | Discord | `discord-sdk` | — | — | ✅ Live | Guild + channel feeds |
| 16 | Matrix | — | — | — | 🟡 Degraded | Homeserver federation |
| 17 | GitHub | — | — | — | ✅ Live | Repo events + issues |
| 18 | Mirror.xyz | `mirror-sdk` | `mirror.ts` | `mirror-bridge/` | ✅ Live | GraphQL + RSS fallback |
| 19 | Paragraph | `paragraph-bridge` | — | — | ✅ Live | Newsletter + blog |
| 20 | Ghost / Substack | `ghost-bridge` | — | — | ✅ Live | Newsletters |
| 21 | **DTube** (NEW) | `dtube-sdk` (planned) | `dtube.ts` | — | 🔵 Beta | Hive + DTube API |
| 22 | **Odysee / LBRY** (NEW) | `lbry-sdk` (planned) | `lbry.ts` | — | 🔵 Beta | LBRY JSON-RPC + claim search |
| 23 | **Gab / Dissenter** (NEW) | — | `gab.ts` | — | 🔵 Beta | Mastodon-compat API |
| 24 | **Minds** (NEW) | — | `minds.ts` | — | 🔵 Beta | Minds v3 REST API |
| 25 | **Aether** (NEW) | — | `aether.ts` | — | 🔵 Beta | P2P communities REST API |
| 26 | **Scuttlebutt / SSB** (NEW) | — | `scuttlebutt.ts` | — | 🔵 Beta | SSB pubs + local node |
| 27 | **Hive Blog** (NEW) | — | `hive.ts` | — | 🔵 Beta | Hive JSON-RPC |
| 28 | ether | — | — | — | 🟡 Degraded | On-chain events |
| 29 | Solana | — | — | — | 🟡 Degraded | On-chain events |
| 30 | kbin | — | — | — | ✅ Live | Fediverse Reddit-like |
| 31 | Tildes | — | — | — | ✅ Live | Non-profit community |

---

## Lightweight Adapters

These are minimal (≤100 lines) adapters for protocols that don't need full SDKs:

| Adapter | Protocol | API Type | Location |
|---------|----------|----------|----------|
| Diaspora* | diaspora | RSS from pods | `adapters/diaspora.ts` |
| Friendica | friendica | ActivityPub + RSS | `adapters/friendica.ts` |
| Pleroma | pleroma | Mastodon-compatible API | `adapters/pleroma.ts` |
| Misskey | misskey | Custom REST API | `adapters/misskey.ts` |
| WriteFreely | writefreely | ActivityPub + RSS | `adapters/writefreely.ts` |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    DegenFeed Bridge                  │
│  bridge/src/providers/                              │
│  ├── nostr.ts        ├── pixelfed.ts                 │
│  ├── farcaster.ts    ├── threads.ts                  │
│  ├── lens.ts         ├── rss.ts                      │
│  ├── bluesky.ts      ├── redlib.ts                   │
│  ├── gotosocial.ts   ├── lemmy.ts                    │
│  ├── peertube.ts     ├── zora.ts                     │
│  ├── dtube.ts     ←── NEW                           │
│  ├── lbry.ts      ←── NEW                           │
│  ├── gab.ts       ←── NEW                           │
│  ├── minds.ts     ←── NEW                           │
│  ├── aether.ts    ←── NEW                           │
│  ├── scuttlebutt.ts←── NEW                          │
│  ├── hive.ts      ←── NEW                           │
│  └── mirror.ts    ←── NEW                           │
├─────────────────────────────────────────────────────┤
│              packages/feed-providers/src/            │
│  providers/ (SDK provider classes)                  │
│  adapters/ (lightweight ~100 line adapters)         │
└─────────────────────────────────────────────────────┘
```

## Adding a New Protocol

1. Create bridge provider at `bridge/src/providers/{name}.ts`
2. Export `schema: SchemaGuard` + `fetch{Name}Posts(limit)`
3. Register in `bridge/src/server/feeds.ts` PROVIDERS registry
4. Add to `packages/types/src/index.ts` Protocol union
5. Add platform tier weight in `packages/feed-core/src/index.ts`
6. Add PLATFORM_TIER entry in `packages/ranking/src/unified-scorer.ts`
7. Add emptyIdentity handle in `packages/feed-core/src/index.ts`
8. Create SDK package if needed at `packages/{name}-sdk/`
9. Update this PROVIDERS.md
10. Test with `GET /api/feed/{name}`

---

## API Reference

| Endpoint | Description |
|----------|-------------|
| `GET /api/protocols/status` | Health status of ALL protocols |
| `GET /api/protocols/status/:name` | Single protocol health |
| `GET /api/feed/:name?limit=N` | Fetch feed from specific protocol |
| `GET /api/bridge/health` | Bridge health overview (legacy) |
