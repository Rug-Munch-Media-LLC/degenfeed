# Supported Protocols (44+)

| Protocol | Browse | Publish | Tips | Identity |
|----------|--------|---------|------|----------|
| Nostr | ✅ | ✅ | ✅ | npub / nsec |
| Farcaster | ✅ | ✅ | ✅ | FID + Signed Key |
| Lens | ✅ | ✅ | ✅ | Profile ID |
| Bluesky | ✅ | ✅ | ✅ | DID / Handle |
| Mastodon | ✅ | ✅ | ✅ | Handle + OAuth |
| Threads | ✅ | ✅ | ❌ | OAuth |
| Reddit | ✅ | ❌ | ❌ | OAuth |
| RSS / Atom | ✅ | ❌ | ❌ | — |
| PeerTube | ✅ | ✅ | ✅ | OAuth2 |
| YouTube | ✅ | ❌ | ❌ | API Key |
| Lemmy | ✅ | ❌ | ✅ | Instance |
| Telegram | ✅ | ✅ | ❌ | Bot API |
| Discord | ✅ | ✅ | ❌ | Bot / Webhook |
| Matrix | ✅ | ✅ | ❌ | Homeserver |
| GitHub | ✅ | ✅ | ❌ | OAuth |
| Pixelfed | ✅ | ✅ | ❌ | Handle |
| Zora | ✅ | ❌ | ✅ | Wallet |
| Substack / Ghost | ✅ | ✅ | ❌ | RSS / API |
| Mirror.xyz | ✅ | ❌ | ❌ | — |
| Paragraph.xyz | ✅ | ✅ | ❌ | API |
| Solana | ❌ | ❌ | ✅ | Wallet |
| ActivityPub | ✅ | ❌ | ❌ | — |
| **+22 more via Matrix bridge hub, API, and scraping integrations** | ✅ | ✅ | varies | varies |

## Protocol SDKs

Each protocol is wrapped in a typed TypeScript SDK under `packages/<name>-sdk/`. SDKs handle authentication, post serialization, normalization to the unified `DegenFeedPost` type, and rate-limit awareness. There are 43+ packages total in the monorepo, with 20+ protocol-specific SDKs and providers.
