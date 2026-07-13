# Supported Protocols

| Protocol | Browse | Publish | Tips | Identity |
|----------|--------|---------|------|----------|
| Nostr | ✅ | ✅ | ✅ | npub / nsec |
| Farcaster | ✅ | ✅ | ✅ | FID + Signed Key |
| Lens | ✅ | ✅ | ✅ | Profile ID |
| Bluesky | ✅ | ✅ | ❌ | DID / Handle |
| Mastodon | ✅ | ✅ | ❌ | Handle + OAuth |
| Threads | ✅ | ✅ | ❌ | OAuth |
| Reddit | ✅ | ❌ | ❌ | OAuth |
| RSS / Atom | ✅ | ❌ | ❌ | — |
| Lemmy | ✅ | ❌ | ❌ | — |
| ActivityPub | ✅ | ❌ | ❌ | — |

## Protocol SDKs

Each protocol is wrapped in a typed TypeScript SDK under `packages/<name>-sdk/`. SDKs handle authentication, post serialization, normalization to the unified `DegenFeedPost` type, and rate-limit awareness.
