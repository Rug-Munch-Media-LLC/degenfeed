# Modularization Standards

> **Owner:** DegenFeed Engineering
> **Last updated:** 2026-07-25
> **Canonical location:** `docs/MODULARIZATION.md`

## Why Modularize?

We split files that exceed **500 lines** to:

1. **Maintain cognitive load** — No file should require a developer to hold >500 lines in working memory.
2. **Enable parallel work** — Multiple developers can edit separate modules without merge conflicts.
3. **Improve testability** — Smaller modules have cleaner unit test boundaries.
4. **Speed up CI** — TypeScript/ESBuild only rebuilds changed modules.
5. **Reduce merge conflicts** — Smaller files mean fewer conflicts on concurrent branches.

---

## 1. Component Extraction Pattern

### When to Split

A component or module should be split when it exceeds **500 lines**. Warning signs before reaching the limit:

- **300+ lines**: Single section/module exceeds 200 lines → extract that section.
- **400+ lines**: More than 3 distinct concerns → split into sub-modules.
- **500+ lines**: **Mandatory** split — no exceptions.

### How to Name Extracted Files

```
Original:   VideoCall.tsx (1330 lines)
→           calls/types.ts           — All type definitions
→           calls/peer-connection.ts — WebRTC peer connection management
→           calls/hooks.ts           — Custom hooks (useUserMedia, useSignaling, etc.)
→           calls/call-ui.tsx        — UI sub-components (ControlsBar, VideoGrid, etc.)
→           calls/VideoCall.tsx      — Thin orchestrator (< 200 lines)
```

**Rules:**

| Concept | File Name | Contains |
|---------|-----------|----------|
| Types & interfaces | `types.ts` | Interfaces, type aliases, enums, constants |
| Custom hooks | `hooks.ts` | React hooks, state management, side effects |
| Utilities | `utils.ts` or `{domain}-utils.ts` | Pure functions, helpers, formatters |
| Sub-components | `{component-name}.tsx` | Individual UI sub-components |
| Main component | `{OriginalName}.tsx` | Thin orchestrator, imports sub-components |

### Directory Structure

```
components/calls/
├── types.ts
├── peer-connection.ts
├── hooks.ts
├── call-ui.tsx
├── call-banner.tsx
├── call-history.tsx
├── call-buttons.tsx
└── VideoCall.tsx          # Thin orchestrator
```

### Import Rules for Extracted Components

```tsx
// Good: Thin orchestrator imports sub-components
import { VideoGrid } from './call-ui';
import { IncomingCallBanner } from './call-banner';
import { useVideoCall } from './hooks';
import type { CallInfo } from './types';

// Good: Sub-components import types
import type { CallInfo } from '../calls/types';

// AVOID: Deep import chains
import { something } from '../../components/calls/call-ui'; // OK, not too deep
```

---

## 2. Route Handler Organization

### Pattern: One File Per Domain

```
routes/
├── feed.ts
├── social.ts
├── dao.ts
├── creator.ts
├── content.ts
├── admin.ts
├── rmi.ts
├── search.ts
├── tip.ts
├── sync.ts
└── other.ts
```

### Pattern: Domain-Based Route Registration

```typescript
// routes/feed.ts — Exports a registration function
import { Hono } from 'hono';
import { handleShortsFeed } from './shorts';
import { handleUnifiedFeed } from './unified-feed';

export function registerFeedRoutes(app: Hono): void {
  app.get('/api/shorts/feed', (c) => handleShortsFeed(c.req.raw, c.env));
  app.get('/api/feed/unified', (c) => handleUnifiedFeed(c.req.raw, c.env));
  // ...
}
```

```typescript
// app.ts — Thin orchestrator
import { Hono } from 'hono';
import { registerFeedRoutes } from './routes/feed';
import { registerSocialRoutes } from './routes/social';

const app = new Hono();
registerFeedRoutes(app);
registerSocialRoutes(app);
// ...

export default app;
```

### Route File Size Limits

| File Type | Max Lines | Max Exports |
|-----------|-----------|-------------|
| Route registration file | 500 lines | Unlimited |
| Handler module | 500 lines | 5-10 exports |
| Utility library | 300 lines | 10-20 exports |
| Types file | 200 lines | Unlimited |

---

## 3. Package Boundaries

### What Belongs in a Package

Create a dedicated `packages/{name}` when:

1. **Shared across apps** — Used by both `apps/web` and `workers/api`
2. **Independent lifecycle** — Can be versioned and tested independently
3. **Non-trivial logic** — > 300 lines of core domain logic
4. **External API wrapper** — Client libraries for external services

### Current Package Structure

```
packages/
├── feed-core/          # Feed ranking, scoring algorithms
├── types/              # Shared TypeScript types
├── utils/              # Shared utilities
├── ranking/            # Ranking algorithms
├── reputation/         # Reputation scoring
├── identity/           # Identity resolution
├── source-discovery/   # Content source discovery
├── token-gate/         # Token gating logic
├── …
```

### Anti-Patterns

| ❌ Don't | ✅ Do |
|----------|-------|
| Import from `../../packages/foo/src/bar` | Import from `@degenfeed/foo` |
| Put app-specific routes in packages | Keep routes in `workers/api/src/routes/` |
| Mix server and client code in one package | Separate by environment |
| Package with > 20 exports | Split into multiple packages |

---

## 4. Import Rules

### Barrel Exports

Every module directory MUST have an `index.ts` barrel export:

```typescript
// calls/index.ts
export { VideoCall } from './VideoCall';
export type { CallInfo, CallHistoryEntry, IncomingCall } from './types';
```

**Importers MUST only import from the barrel:**

```typescript
// ✅ Good: Import from barrel
import { VideoCall } from '@/components/calls';

// ❌ Bad: Deep import into sub-modules
import { VideoCall } from '@/components/calls/VideoCall';
```

### Import Order

1. External packages (`react`, `hono`, `@degenfeed/types`)
2. Internal packages (`@degenfeed/feed-core`)
3. Relative imports (`./sub-module`, `../utils`)
4. Type-only imports (grouped with a blank line)

```typescript
import { useEffect, useState } from 'react';
import { Hono } from 'hono';

import { FeedItem } from '@degenfeed/types';

import { useAuth } from '../AuthProvider';
import { VideoGrid } from './call-ui';

import type { CallInfo } from './types';
```

### Forbidden Imports

- ❌ No dynamic `require()` — Use static `import`
- ❌ No imports from `node_modules` subpaths unless necessary
- ❌ No circular imports
- ❌ No importing from sibling files in `lib/` from `routes/` — Use shared packages instead
- ❌ No importing `.tsx` from `.ts` files (except shared types)

---

## 5. Code Review Checklist

### Modularization Gate

Before approving any PR that adds or modifies modules:

- [ ] **No file exceeds 500 lines** (except generated code, JSON, test fixtures)
- [ ] **Barrel exports exist** — Every directory with >1 module has `index.ts`
- [ ] **No deep imports** — Importers use barrels, not direct file paths
- [ ] **No circular dependencies** — Run `npx madge --circular src/`
- [ ] **Every exported function has a doc comment** — Purpose, params, return value
- [ ] **Sub-directories are properly named** — Plural nouns for domains (`calls/`, `types/`, `routes/`)
- [ ] **No `any` types on public API** — All exports have explicit TypeScript types
- [ ] **Dependency direction is correct** — `routes/` → `lib/` → `packages/`, never reverse

### File Size Enforcement

```bash
# CI gate: fail if any source file exceeds 500 lines
find src/ -name "*.ts" -o -name "*.tsx" | \
  xargs awk 'FNR==1{close(f)} {f=FILENAME} ENDFILE{if(NR>500) print FILENAME" has "NR" lines"}' | \
  grep . && exit 1 || exit 0
```

### Import Health Check

```bash
# CI gate: detect barrel bypasses
grep -r "from '.*\/[a-z][a-zA-Z]*\/[a-z][a-zA-Z]*\.\(ts\|tsx\)" --include="*.ts" --include="*.tsx" \
  --exclude="*/index.ts" --exclude="*.test.*" src/ || echo "No deep imports found"
```

### Dependency Check

- [ ] `pnpm outdated` output reviewed
- [ ] `pnpm audit` vulnerabilities actioned (critical/high)
- [ ] No new EOL or deprecated packages added
- [ ] New packages evaluated against existing alternatives first

---

## Adoption Guide

### For New Code

1. Start with a thin file (< 100 lines)
2. Extract types immediately into `types.ts`
3. Extract utilities into `utils.ts`
4. Split when a file hits 300 lines

### For Existing Code (Refactoring)

1. Read the file completely to understand exports
2. Identify logical section boundaries (look for comment blocks)
3. Create sub-module files
4. Import from sub-modules in the original file
5. Update all importers if the barrel API changed
6. Run `pnpm typecheck` and fix any issues
7. Run tests: `pnpm test`

### Priority for Splitting

1. Files over **1000 lines** — Immediate split (blocking)
2. Files between 500-1000 lines — Split within the sprint
3. Files approaching 500 lines — Plan split in next sprint
