# Protocol SDKs

Each protocol has a dedicated TypeScript SDK under `packages/<name>-sdk/`. All SDKs share a common interface defined in `packages/types/`.

## Common Interface

```typescript
interface ProtocolSDK {
  name: string;
  authenticate(params: AuthParams): Promise<Session>;
  fetchFeed(params: FeedParams): Promise<NormalizedPost[]>;
  publish(post: OutgoingPost): Promise<PublishResult>;
  engage(action: EngageAction): Promise<EngageResult>;
}
```

## Included SDKs

- **nostr-sdk** — relays, nip-07, nip-46, event signing
- **farcaster-sdk** — Hub APIs, signed keys, casts
- **lens-sdk** — Lens API v2, profiles, publications
- **bluesky-sdk** — AT Protocol, lexicons, PDS interaction
- **mastodon-sdk** — ActivityPub, Mastodon REST API
- **threads-sdk** — Threads API (limited)
- **rss-sdk** — RSS/Atom parser, OPML support
