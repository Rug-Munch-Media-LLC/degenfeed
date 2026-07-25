# DegenFeed Module Structure Standard

> **Status:** canonical
> **Last updated:** 2026-07-25
> **Owner:** Engineering Team
> **Applies to:** All TypeScript source files in `workers/`, `bridge/`, `packages/`, `apps/`

---

## 1. The 500-Line Rule

**No source file may exceed 500 lines.** Files exceeding this limit must be split.

### Thresholds

| Size | Action |
|------|--------|
| < 300 lines | Healthy — no action needed |
| 300–500 lines | Watch — consider proactive split if multiple concerns |
| 500+ lines | **Mandatory split** — extract types, constants, helpers, or sub-modules |

### Why 500 Lines?

- **Cognitive load:** A developer should understand any file in a single reading session
- **Conflict reduction:** Smaller files reduce merge conflict surface area
- **Testability:** Smaller modules have cleaner unit test boundaries
- **Build speed:** Incremental builds skip unchanged modules

---

## 2. Standard Module Layout

Every feature directory follows this standard structure:

```
feature-name/
  index.ts        — Barrel export (public API surface, <50 lines)
  types.ts        — Types and interfaces (<200 lines)
  constants.ts    — Constants, config, KV key helpers (<200 lines)
  utils.ts        — Shared helper functions (<300 lines)
  core.ts         — Main business logic (<400 lines)
  fetchers.ts     — Protocol-specific data fetchers (<400 lines)
  handlers.ts     — HTTP route handlers (<400 lines)
  __tests__/      — Test files
    feature.test.ts
```

### Concrete Examples

#### Worker Routes (flat)

```
routes/telegram/
  index.ts        — Barrel export
  types.ts        — Telegram types
  constants.ts    — KV key patterns, config
  utils.ts        — Message sending, validation helpers
  commands.ts     — Bot command handlers
  handlers.ts     — Webhook and HTTP handlers
```

#### Worker Routes (sub-module)

```
routes/register/
  index.ts        — Barrel export
  core.ts         — Core route registration
  feed.ts         — Feed route registration
  social.ts       — Social route registration
  dao.ts          — DAO route registration
  coins.ts        — Coins route registration
  media.ts        — Media route registration
  messaging.ts    — Messaging route registration
  live.ts         — Live/streaming route registration
```

#### Feed Pipeline

```
feed/
  index.ts                 — Barrel export (all feed layers)
  feed-fetcher.ts          — Fetch content from sources
  feed-enricher.ts         — Enrich posts with metadata
  content-dedup.ts         — Cross-protocol deduplication
  feed-scorer.ts           — Score and rank posts
  feed-cache.ts            — Cache feed results
  feed-curator.ts          — Curate seen/muted posts
  feed-freshness.ts        — Freshness calculation
  feed-feedback.ts         — User feedback integration
  news-aggregator.ts       — News aggregation orchestrator
  news-types.ts            — News pipeline types
  news-source-tiers.ts     — Source tier definitions
  news-helpers.ts          — News helper functions
  news-fetcher.ts          — News content fetcher
  news-processor.ts        — News content processor
```

#### Packages

```
packages/auth/src/
  index.ts                 — Barrel export
  crypto.ts                — Encryption/decryption utilities
  identity-hub.ts          — Identity hub implementation
  persistence.ts           — KV persistence helpers
  session.ts               — Session management
  token.ts                 — Token verification
  providers/               — Auth providers
    bluesky.ts
    farcaster.ts
    lens.ts
    mastodon.ts
    nostr.ts
    reddit.ts
    threads.ts
    wallet.ts
```

#### SDK Package

```
packages/farcaster-sdk/src/
  index.ts                 — Barrel export
  types.ts                 — Farcaster-specific types
  helpers.ts               — Pure helpers
  fetchers.ts              — API fetchers
```

---

## 3. Barrel Export Rules

### Every Directory Must Have an `index.ts`

The `index.ts` barrel is the **only** entry point for consumers. Deep imports are forbidden.

```typescript
// packages/auth/src/index.ts — ✅ Good
export type { ActiveSession, StoredIdentity } from '@degenfeed/types';
export type { EncryptedBlob } from './crypto';
export { decryptSecret, encryptSecret } from './crypto';
export { createIdentityHub, IdentityHub } from './identity-hub';
export { forgetIdentity, lockIdentity, refreshSessionIfNeeded, unlockIdentity } from './session';
export type { TokenPayload } from './token';
export { verifyToken } from './token';
```

```typescript
// ✅ Good: always use export * for simple re-exports
export * from './types';
export * from './constants';
export * from './parsers';
export * from './helpers';
export * from './provider';
```

### Barrel Rules

1. **Always `export *` for re-exports** — type-safety preserved by `isolatedModules`
2. **Never re-export types from a non-barrel file** — always go through `index.ts`
3. **No circular barrel imports** — use `tsc --noEmit` to detect
4. **Barrel files import from all siblings but never from parent directories**
5. **Keep barrels under 50 lines** — if a barrel exceeds 50 lines, the module may be too broad

---

## 4. Import Rules

### ✅ Allowed

```typescript
// Import from package entry point (via package.json "exports")
import { FeedAlgorithm } from '@degenfeed/feed-core';

// Import from local barrel (sibling index.ts)
import { handleBotCommand } from './commands';
import { sendTelegramMessage } from './utils';

// Import from sibling file (same directory, no barrel needed for internal use)
import type { Env } from '../index';
```

### ❌ Forbidden

```typescript
// Deep import into package internals
import { algo } from '@degenfeed/feed-core/src/algorithm';  // ❌

// Import from parent barrel (creates circular risk)
import { algo } from '..';  // ❌

// Import from another package's internals
import { type } from '@degenfeed/types/src/protocols';  // ❌
```

### Package Resolution

Package consumers import only from the package entry point configured in `package.json`:

```jsonc
// packages/feed-core/package.json
{
  "exports": {
    ".": {
      "import": "./src/index.ts",
      "types": "./src/index.ts"
    }
  }
}
```

```typescript
// ✅ Correct import
import { FeedAlgorithm } from '@degenfeed/feed-core';
```

---

## 5. File Naming Conventions

| Concept | Convention | Example |
|---------|-----------|---------|
| Types & interfaces | `{domain}-types.ts` | `news-types.ts`, `sso-types.ts` |
| Constants & config | `{domain}-constants.ts` | `news-source-tiers.ts`, `config-tiers.ts` |
| Pure helpers | `{domain}-utils.ts` or `{domain}-helpers.ts` | `news-helpers.ts`, `inbox-helpers.ts` |
| Business logic | `{domain}-{concern}.ts` | `inbox-aggregator.ts`, `sso-session.ts` |
| Request handlers | `{domain}-handlers.ts` | `telegram-handlers.ts`, `news-handlers.ts` |
| Data fetchers | `{domain}-fetchers.ts` | `news-fetcher.ts`, `unified-fetchers.ts` |
| Platform wrappers | `platform-wrappers/{name}.ts` | `platform-wrappers/farcaster.ts` |
| Orchestrator | Original name (< 300 lines) | `news-aggregator.ts`, `feed-curator.ts` |
| Barrel export | `index.ts` | `index.ts` (every directory) |
| Test files | `{name}.test.ts` | `feed-curation-rules.test.ts` |
| Test utilities | `test-utils.ts` | `test-setup.ts` |

### Formatting Rules

- **kebab-case** for directory names: `live-aggregator/`, `platform-wrappers/`
- **kebab-case** for file names: `news-source-tiers.ts`, `feed-curation-rules.ts`
- **PascalCase** for types, classes, and React components: `UnifiedPost`, `FeedAlgorithm`, `PostCard`
- **camelCase** for functions, variables, and hooks: `fetchFeedPosts`, `useFeedData`
- **UPPER_SNAKE_CASE** for constants: `DEFAULT_WEIGHTS`, `SCAM_KEYWORDS`

---

## 6. Refactoring Pattern: Splitting a God File

When splitting a file exceeding 500 lines:

```
Original file (e.g., giant-file.ts > 500 lines)
  │
  ├── Step 1: mkdir giant-file/
  ├── Step 2: Extract types → giant-file/types.ts
  ├── Step 3: Extract constants → giant-file/constants.ts
  ├── Step 4: Extract helpers → giant-file/utils.ts
  ├── Step 5: Extract main logic → giant-file/core.ts
  ├── Step 6: Extract fetchers/handlers → separate files
  ├── Step 7: Create giant-file/index.ts barrel
  └── Step 8: Replace giant-file.ts with thin re-export wrapper
```

### Extraction Priority (Pareto Rule)

1. **Types** — always extract first (lowest risk, most reusability)
2. **Data/constants** — always extract (bulk of large files is often config)
3. **Helpers** — extract pure functions (testable independently)
4. **Handlers** — extract last (may depend on types + helpers)

### Wrapper for Backward Compatibility

```typescript
// giant-file.ts — after refactor, becomes re-export wrapper
export * from './giant-file/types';
export * from './giant-file/constants';
export * from './giant-file/utils';
export { mainLogic } from './giant-file/core';
```

**Verification:** After splitting, run `tsc --noEmit` to verify imports still resolve.

---

## 7. Circular Dependency Prevention

### Rules

- Types files must **never** import from logic files
- Helper files should only import from types files
- Handler files import from types + helpers
- Barrel files (`index.ts`) import from all siblings but never from parent directories

### Detection

```bash
# TypeScript will catch circular imports
pnpm typecheck
```

### Common Pitfall

```
❌ BAD: types.ts imports from helpers.ts → helpers.ts imports from types.ts

✅ GOOD: types.ts has no local imports
         helpers.ts imports only from types.ts
         handlers.ts imports from types.ts + helpers.ts
```

---

## 8. Dead Code Removal

During splitting or any refactoring, remove:

1. **Unused imports** — `noUnusedLocals` in `tsconfig.json` flags these
2. **Commented-out code** — If it was important, it's in git history
3. **Duplicate functions** — Same logic in multiple files? Extract to shared
4. **Unused types/interfaces** — If nothing imports it, delete it
5. **Empty exports** — `export {}` or `export default {}` with no members

---

## 9. Verification Checklist

After every file split or module restructure:

- [ ] `pnpm typecheck` passes (no type errors)
- [ ] `pnpm test` passes (no test regressions)
- [ ] No file exceeds 500 lines
- [ ] Barrel `index.ts` exists in every directory
- [ ] No circular dependencies
- [ ] All imports point to barrel files (not deep imports)
- [ ] `git diff` shows only expected moves + import updates
- [ ] `biome check` passes
