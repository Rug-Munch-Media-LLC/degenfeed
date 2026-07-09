# @degenfeed/types

Shared types for the open social graph. All UI components and protocol clients consume these shapes.

- `UnifiedPost` — every post from any protocol normalizes here
- `UnifiedIdentity` — every profile from any protocol normalizes here
- `EngagementMetrics` / `EngagementVector` — like/repost/reply counts and viewer state
- `Protocol` — `'nostr' | 'farcaster' | 'lens' | 'bluesky'`

Pure types only. No runtime. Importable from any package.