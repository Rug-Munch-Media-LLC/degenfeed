# Cross-Package Dependency Map

> Last updated: 2026-07-25
> Generated from package.json and import analysis

## Package Dependency Graph

```
apps/web (Next.js 16)
  │
  ├── @degenfeed/ui
  │     │
  │     ├── @degenfeed/types
  │     ├── @degenfeed/realtime
  │     ├── @degenfeed/utils
  │     └── @degenfeed/auth
  │
  ├── @degenfeed/auth
  │     ├── @degenfeed/types
  │     └── @degenfeed/storage
  │
  ├── @degenfeed/storage
  │     └── @degenfeed/types
  │
  └── @degenfeed/utils
        └── @degenfeed/types

workers/api (Hono / CF Workers)
  │
  ├── @degenfeed/feed-core
  │     ├── @degenfeed/types
  │     └── @degenfeed/feed-providers
  │
  ├── @degenfeed/feed-providers
  │     ├── @degenfeed/types
  │     ├── @degenfeed/utils
  │     ├── @degenfeed/source-discovery
  │     │     └── @degenfeed/types
  │     ├── @degenfeed/nostr-sdk
  │     ├── @degenfeed/farcaster-sdk
  │     ├── @degenfeed/bluesky-sdk
  │     ├── @degenfeed/lens-sdk
  │     ├── @degenfeed/mastodon-sdk
  │     ├── @degenfeed/rss-sdk
  │     ├── @degenfeed/threads-sdk
  │     └── @degenfeed/reddit-sdk
  │
  ├── @degenfeed/ranking
  │     ├── @degenfeed/types
  │     └── @degenfeed/feed-core
  │
  ├── @degenfeed/realtime
  │     └── @degenfeed/types
  │
  ├── @degenfeed/creator-coin
  │     ├── @degenfeed/types
  │     ├── @degenfeed/auth
  │     ├── @degenfeed/web3
  │     └── @degenfeed/storage
  │
  ├── @degenfeed/cross-protocol-bridge
  │     ├── @degenfeed/types
  │     ├── @degenfeed/feed-providers
  │     └── @degenfeed/identity
  │
  ├── @degenfeed/auth
  │     ├── @degenfeed/types
  │     └── @degenfeed/storage
  │
  ├── @degenfeed/web3
  │     ├── @degenfeed/types
  │     └── @degenfeed/utils
  │
  ├── @degenfeed/utils
  │     └── @degenfeed/types
  │
  └── @degenfeed/types (leaf — no internal deps)
```

## Dependency Legend

```
A ──→ B   means "A depends on B"
A │─→ B   means "A depends on B via an intermediate package"
leaf      means "no internal package dependencies"
```

## Layer Architecture

```
Layer 0: @degenfeed/types (foundation — no deps, all packages depend on it)
Layer 1: @degenfeed/utils, @degenfeed/identity, @degenfeed/web3
Layer 2: @degenfeed/storage, @degenfeed/auth
Layer 3: @degenfeed/feed-core, @degenfeed/feed-providers, @degenfeed/source-discovery
Layer 4: @degenfeed/ranking, @degenfeed/realtime
Layer 5: @degenfeed/cross-protocol-bridge, @degenfeed/creator-coin
Layer 6: @degenfeed/ui, @degenfeed/monetization, @degenfeed/reputation
Layer 7: workers/api, apps/web
```

**Rule:** Packages in layer N may only depend on packages in layers 0 through N-1.
Violation: `@degenfeed/ranking` (layer 4) depends on `@degenfeed/feed-core` (layer 3) ✅

## Circular Dependency Analysis

| Cycle | Path | Severity | Status |
|-------|------|----------|--------|
| None detected | — | — | ✅ Clean |

All dependencies flow downward from foundation to application. No circular dependencies exist.

## Package Inventory (42 packages)

### Foundation (Layer 0-1)
| Package | Path | Dependencies | Consumers |
|---------|------|-------------|-----------|
| `@degenfeed/types` | `packages/types/` | None | 38 packages |
| `@degenfeed/utils` | `packages/utils/` | types | 8 packages |
| `@degenfeed/identity` | `packages/identity/` | types | 3 packages |
| `@degenfeed/web3` | `packages/web3/` | types, utils | 2 packages |

### Storage & Auth (Layer 2)
| Package | Path | Dependencies | Consumers |
|---------|------|-------------|-----------|
| `@degenfeed/storage` | `packages/storage/` | types | 4 packages |
| `@degenfeed/auth` | `packages/auth/` | types, storage | 3 packages |
| `@degenfeed/token-gate` | `packages/token-gate/` | types, web3 | 1 package |

### Feed & Content (Layer 3)
| Package | Path | Dependencies | Consumers |
|---------|------|-------------|-----------|
| `@degenfeed/feed-core` | `packages/feed-core/` | types, feed-providers | 3 packages |
| `@degenfeed/feed-providers` | `packages/feed-providers/` | types, utils, source-discovery, protocol SDKs | 2 packages |
| `@degenfeed/source-discovery` | `packages/source-discovery/` | types | 1 package |
| `@degenfeed/cross-platform-register` | `packages/crossplatform-register/` | types, auth | 1 package |

### Ranking & Realtime (Layer 4)
| Package | Path | Dependencies | Consumers |
|---------|------|-------------|-----------|
| `@degenfeed/ranking` | `packages/ranking/` | types, feed-core | 2 packages |
| `@degenfeed/realtime` | `packages/realtime/` | types | 2 packages |

### Bridge & Economy (Layer 5)
| Package | Path | Dependencies | Consumers |
|---------|------|-------------|-----------|
| `@degenfeed/cross-protocol-bridge` | `packages/cross-protocol-bridge/` | types, feed-providers, identity | 1 package |
| `@degenfeed/creator-coin` | `packages/creator-coin/` | types, auth, web3, storage | 2 packages |
| `@degenfeed/monetization` | `packages/monetization/` | types, storage | 1 package |

### Platform SDKs (Layer 1, parallel)
| Package | Path | Dependencies |
|---------|------|-------------|
| `@degenfeed/nostr-sdk` | `packages/nostr-sdk/` | types |
| `@degenfeed/farcaster-sdk` | `packages/farcaster-sdk/` | types |
| `@degenfeed/bluesky-sdk` | `packages/bluesky-sdk/` | types |
| `@degenfeed/lens-sdk` | `packages/lens-sdk/` | types |
| `@degenfeed/mastodon-sdk` | `packages/mastodon-sdk/` | types |
| `@degenfeed/rss-sdk` | `packages/rss-sdk/` | types |
| `@degenfeed/threads-sdk` | `packages/threads-sdk/` | types |
| `@degenfeed/lemmy-sdk` | `packages/lemmy-sdk/` | types |
| `@degenfeed/reddit-sdk` | `packages/reddit-sdk/` | types |
| `@degenfeed/discord-sdk` | `packages/discord-sdk/` | types |
| `@degenfeed/telegram-sdk` | `packages/telegram-sdk/` | types |
| `@degenfeed/zora-sdk` | `packages/zora-sdk/` | types |
| `@degenfeed/peertube-sdk` | `packages/peertube-sdk/` | types |
| `@degenfeed/matrix-sdk` | `packages/matrix-sdk/` | types |
| `@degenfeed/pixelfed-sdk` | `packages/pixelfed-sdk/` | types |
| `@degenfeed/mirror-sdk` | `packages/mirror-sdk/` | types |
| `@degenfeed/paragraph-sdk` | `packages/paragraph-sdk/` | types |
| `@degenfeed/youtube-provider` | `packages/youtube-provider/` | types |
| `@degenfeed/livepeer-provider` | `packages/livepeer-provider/` | types |
| `@degenfeed/shorts-provider` | `packages/shorts-provider/` | types |

### Frontend & UX (Layer 6)
| Package | Path | Dependencies | Consumers |
|---------|------|-------------|-----------|
| `@degenfeed/ui` | `packages/ui/` | types, realtime, utils, auth | apps/web |
| `@degenfeed/spaces-audio` | `packages/spaces-audio/` | types, realtime | apps/web |
| `@degenfeed/reputation` | `packages/reputation/` | types, storage, feed-core | apps/web |
| `@degenfeed/creator-rewards` | `packages/creator-rewards/` | types, storage | apps/web |

### Worker (Layer 7)
| Package | Path | Dependencies |
|---------|------|-------------|
| `@degenfeed/api-worker` | `workers/api/` | All layer 0-6 packages |

### Bridges (Layer 5, parallel)
| Package | Path | Dependencies |
|---------|------|-------------|
| `ghost-bridge` | `packages/ghost-bridge/` | types, storage |
| `mirror-bridge` | `packages/mirror-bridge/` | types |
| `paragraph-bridge` | `packages/paragraph-bridge/` | types |
| `spaces-bridge` | `packages/spaces-bridge/` | types, realtime |

## Decoupling Recommendations

### 1. Extract `@degenfeed/feed-core` dependencies on `@degenfeed/feed-providers`
`feed-core` imports from `feed-providers` for ranking types. Consider moving ranking types to `@degenfeed/types` to break the dependency.

**Status:** Minor — no cycle, but creates layer violation. `feed-core` (layer 3) depends on `feed-providers` (also layer 3). These should be same-layer.

### 2. Reduce `@degenfeed/creator-coin` dependencies
`creator-coin` depends on `@degenfeed/auth`, `@degenfeed/web3`, and `@degenfeed/storage`. The auth dependency is only for session validation. Consider extracting a lighter `@degenfeed/creator-coin-core` without auth.

**Status:** Low priority — these are legitimate dependencies.

### 3. Protocol SDK consolidation
22 protocol-specific SDK packages under `packages/` share the same pattern. Consider consolidating into a single `@degenfeed/protocol-sdks` package with tree-shaking to reduce monorepo bloat.

**Status:** Medium priority — reduces 22 package.json files to 1.

### 4. Workers shouldn't depend on UI packages
`workers/api/` should not depend on `@degenfeed/spaces-audio` or `@degenfeed/ui`. If it does, extract shared types to `@degenfeed/types`.

**Status:** Verify during CI — currently no references found.

### 5. Prevent layer 0 packages from depending on higher layers
`@degenfeed/types` is clean (no deps) ✅. Enforcement via `scripts/check-layer-deps.sh` recommended.

## Enforcement

Add to CI pipeline:
```bash
# Check that @degenfeed/types has no internal dependencies
test "$(node -e "const p = require('./packages/types/package.json'); console.log(Object.keys(p.dependencies || {}).filter(d => d.startsWith('@degenfeed/')).length)")" = "0"

# Check no circular deps
npx dpdm --circular packages/*/src/index.ts
```
