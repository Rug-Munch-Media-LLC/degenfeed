# DegenFeed — Code Structure & File Splitting Conventions

> **Last updated:** 2026-07-25  
> **Owner:** Engineering Team  
> **Applies to:** All TypeScript source files in `workers/`, `bridge/`, `packages/`

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

## 2. File Splitting Pattern

### Standard Extraction Order

When splitting a file exceeding 500 lines, extract in this priority order:

```
Original file (e.g., news-aggregator.ts)
  ├── types.ts                        # Interfaces, types, enums, type aliases
  ├── {domain}-constants.ts           # Data arrays, config objects, lookup tables
  ├── {domain}-helpers.ts             # Pure helper functions, utilities
  ├── {domain}-handlers.ts            # Request handlers, route callbacks
  ├── {domain}-sub-module.ts          # Additional domain-specific modules
  └── index.ts / {original}.ts        # Thin orchestrator (< 300 lines)
```

### Naming Conventions

| Concept | Convention | Example |
|---------|-----------|---------|
| Types & interfaces | `{domain}-types.ts` | `news-types.ts`, `sso-types.ts` |
| Constants & data | `{domain}-constants.ts` or `{domain}-tiers.ts` | `news-source-tiers.ts`, `config-tiers.ts` |
| Pure helpers | `{domain}-helpers.ts` | `news-helpers.ts`, `inbox-helpers.ts` |
| Business logic | `{domain}-{concern}.ts` | `inbox-aggregator.ts`, `sso-session.ts` |
| Request handlers | `{domain}-handlers.ts` | `telegram-handlers.ts`, `news-handlers.ts` |
| Platform wrappers | `platform-wrappers/{name}.ts` | `platform-wrappers/farcaster.ts` |
| Orchestrator | Original name (< 300 lines) | `news-aggregator.ts` |

### Barrell Exports

Every directory must have an `index.ts` barrel file:

```typescript
// packages/feed-providers/src/providers/rss/index.ts
export * from './types';
export * from './config';
export * from './parsers';
export * from './helpers';
export * from './provider';
```

**Rules:**
- Always use `export *` for re-exports (type-safety preserved by `isolatedModules`)
- Never re-export types from a non-barrel file — always go through `index.ts`
- No circular barrel imports (use `tsc --noEmit` to detect)

---

## 3. Directory Structure Conventions

### Workers API (`workers/api/src/`)

```
feed/                     # Feed pipeline engine
  index.ts                # Barrel exports
  news-aggregator.ts      # Orchestrator (< 300 lines)
  news-types.ts           # News types/interfaces
  news-source-tiers.ts    # Source data arrays split by tier
  news-helpers.ts         # Helper functions
  live-aggregator/        # Subdirectory for complex module
    index.ts
    live-aggregator-types.ts
    live-aggregator-streams.ts
    live-aggregator-schedule.ts
    live-aggregator-lifecycle.ts
    live-aggregator-helpers.ts

lib/                      # Shared libraries
  sso/                    # Subdirectory for SSO module
    index.ts
    sso-types.ts
    sso-keys.ts
    sso-crypto.ts
    sso-session.ts
    sso-provision.ts
    sso-recovery.ts
  video-platform/         # Video platform wrappers
    index.ts
    video-platform-types.ts
    platform-wrappers/    # Per-platform implementations
    video-platform-aggregator.ts
  universal-inbox/        # Universal inbox
    index.ts
    universal-inbox-types.ts
    universal-inbox-aggregator.ts
    universal-inbox-handlers.ts
    universal-inbox-helpers.ts

routes/                   # API route handlers
  telegram/               # Subdirectory for complex route
    index.ts
    telegram-types.ts
    telegram-handlers.ts
  podcast/
    index.ts
    podcast-types.ts
    podcast-handlers.ts
    podcast-helpers.ts
```

### Bridge (`bridge/src/`)

```
providers/
  rss/                    # RSS provider (was rss.ts)
    index.ts
    rss-types.ts
    rss-helpers.ts
    rss-parser.ts
    rss-dedup.ts
    feeds/                # Feed configuration arrays split by category
      index.ts
      crypto-news.ts
      research.ts
      dev.ts
      security.ts
      newsletter.ts
```

### Packages (`packages/`)

```
feed-providers/src/providers/rss/
  index.ts
  types.ts
  config.ts               # Thin (< 300 lines) — imports sub-configs
  config-tiers.ts         # Config split by tier
  config-news.ts          # News feeds
  config-defi.ts          # DeFi feeds
  config-niches.ts        # Niche feeds
  config-dev.ts           # Dev feeds
  config-research.ts      # Research feeds
  parsers.ts
  helpers.ts
  quality.ts
  dedup.ts
  provider.ts
```

---

## 4. When to Split — Decision Tree

```
Does the file exceed 500 lines?
├── No → No action needed
└── Yes → Identify concerns:
    ├── Has types/interfaces? → Extract to {domain}-types.ts
    ├── Has data arrays/configs? → Extract to {domain}-constants.ts
    ├── Has pure helpers? → Extract to {domain}-helpers.ts
    └── Has multiple business functions?
        ├── 2-3 functions → Keep in single {domain}-logic.ts
        └── 4+ functions → Split by concern (e.g., -session, -provision, -crypto)
```

### Extraction priority (Pareto rule):
1. **Types** — always extract first (lowest risk, most reusability)
2. **Data/constants** — always extract (the bulk of large files is often config)
3. **Helpers** — extract pure functions (testable independently)
4. **Handlers** — extract last (may depend on types + helpers)

---

## 5. Circular Dependency Prevention

### Rules
- Types files must **never** import from logic files
- Helper files should only import from types files
- Handler files import from types + helpers
- Barrel files (`index.ts`) import from all siblings but never from parent directories

### Detection
```bash
# TypeScript will catch circular imports via --noEmit
npx tsc --noEmit
```

### Common Pitfall
```
❌ BAD: types.ts imports from helpers.ts → helpers.ts imports from types.ts

✅ GOOD: types.ts has no local imports
         helpers.ts imports only from types.ts
         handlers.ts imports from types.ts + helpers.ts
```

---

## 6. Dead Code Removal

During splitting, remove:

1. **Unused imports** — TypeScript `noUnusedLocals` will flag these
2. **Commented-out code** — If it was important, it's in git history
3. **Duplicate functions** — Same logic in multiple files? Extract to shared
4. **Unused types/interfaces** — If nothing imports it, delete it
5. **Empty exports** — `export {}` or `export default {}` with no members

---

## 7. Verification Checklist

After every file split:

- [ ] `npx tsc --noEmit` passes (no type errors)
- [ ] `npx vitest run` passes (no test regressions)
- [ ] No file exceeds 500 lines
- [ ] Barrel `index.ts` exists in every directory
- [ ] No circular dependencies
- [ ] All imports point to barrel files (not deep imports)
- [ ] `git diff` shows only expected moves + imports
