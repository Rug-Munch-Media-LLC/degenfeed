# Feed Pipeline

The feed pipeline transforms raw protocol data into a unified, ranked timeline.

## Stages

1. **Fetch** — each protocol SDK pulls posts from its source (relay, hub, API, RSS feed)
2. **Normalize** — `packages/feed-core` converts each post into the unified `DegenFeedPost` type
3. **Deduplicate** — cross-protocol identity resolution merges posts by the same author/content
4. **Rank** — `packages/ranking` scores each post using the transparent ranking algorithm
5. **Serve** — paginated results returned via the worker API

## Edge Cache

Fetched posts are cached in Cloudflare KV with a configurable TTL (default 60s for active protocols, 300s for RSS).
