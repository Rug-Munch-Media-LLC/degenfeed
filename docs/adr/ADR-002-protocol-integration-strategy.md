# ADR-002: Protocol Integration Strategy — Tiered Approach

**Status:** Accepted
**Date:** 2026-07-25
**Author:** Protocol Engineering
**Deciders:** @crmuncher, Protocol Team

---

## Context

DegenFeed aggregates 18+ protocols (Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, RSS, etc.) with a target of 40+ by end of year. Each protocol has distinct transports, auth models, data formats, identity systems, and rate limits. Without a disciplined strategy, the codebase devolves into protocol-specific spaghetti.

## Decision

We adopt a **four-tier architecture** for protocol integration:

### Tier 1: SDK Tier — Protocol-Native Clients
Each protocol has a dedicated SDK package under `packages/<protocol>-sdk/` wrapping its transport, auth, and data primitives into a clean TypeScript interface. These packages know nothing about DegenFeed's internal types.

**Examples:** `@degenfeed/nostr-sdk`, `@degenfeed/farcaster-sdk`, `@degenfeed/bluesky-sdk`, `@degenfeed/lens-sdk`, `@degenfeed/mastodon-sdk`, `@degenfeed/rss-sdk`

**Contracts:** Export `createClient(config)`, return protocol-native data shapes, encapsulate auth.

### Tier 2: Provider Tier — Abstract FeedProvider Interface
Package `@degenfeed/feed-providers` wraps each SDK with a `FeedProvider` implementation that adapts to `UnifiedPost`.

```typescript
interface FeedProvider {
  readonly protocol: Protocol;
  healthCheck(): Promise<HealthStatus>;
  fetchFeed(ctx: FeedContext, opts?: FeedOptions): Promise<PaginatedResult<UnifiedPost>>;
  fetchPost(id: string, ctx: FeedContext): Promise<UnifiedPost | null>;
  fetchProfile(identifier: string): Promise<UnifiedProfile | null>;
  publish?(input: PublishInput): Promise<PublishResult>;
}
```

**Rules:**
- Every provider returns `UnifiedPost` — never protocol-native types
- Providers are stateless singletons; mutable state lives in `FeedContext`
- Worker routes call providers through this interface only

### Tier 3: Bridge Tier — Cross-Protocol Interactions
Package `@degenfeed/cross-protocol-bridge` and `bridge/` for:
- Cross-reply (reply on Nostr → Farcaster)
- Cross-post (share Bluesky → Mastodon)
- Cross-tip (Solana → Lens profile)
- Wormhole bridge (EVM ↔ Solana value transfer)

### Tier 4: Frontend Tier — Protocol-Agnostic UI
No protocol SDK imports in frontend code. All components consume `UnifiedPost` type.

### Architecture Decision Log (ADL)
Every new protocol requires an ADL entry documenting: name/version, SDK package, FeedProvider, capabilities matrix, auth model, rate limits, escape hatches, testing strategy.

## Consequences

### Positive
1. **New protocols in 2-3 days** (~500-1000 lines: SDK 200-500, Provider 200-400, routes 50-100)
2. **Testability at every tier** — SDKs tested with recordings, Providers by mocking SDK, routes by mocking registry
3. **No frontend changes for new protocols** — automatically render in unified feed
4. **Bridges are explicit and auditable** — each handler has clear inputs/outputs

### Negative
1. **Abstraction overhead** — 4-tier stack adds ~0.1-0.5ms per layer
2. **Protocol-specific features need escape hatches** — `extensions` map governed by quarterly audits
3. **Stale provider code** — mitigated by weekly health-check cron jobs
4. **Cross-protocol bridges are partial** — not every protocol pair supports every action
