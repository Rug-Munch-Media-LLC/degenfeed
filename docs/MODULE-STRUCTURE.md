# DegenFeed Module Structure Standard

> **Rule:** Every module directory follows this standard structure.
> **Target:** No file exceeds 500 lines. Most are under 300 lines.

## Standard Module Layout

```
src/
  feature-name/
    index.ts        — Barrel export (public API surface, <50 lines)
    types.ts        — Types and interfaces (<200 lines)
    constants.ts    — Constants, config, KV key helpers (<200 lines)
    utils.ts        — Shared helper functions (<300 lines)
    core.ts         — Main business logic (<400 lines)
    fetchers.ts     — Protocol-specific data fetchers (<400 lines)
    reply-handlers.ts — Protocol-specific reply/mutation functions (<400 lines)
    commands.ts     — Bot command handlers (telegram, etc.) (<400 lines)
    handlers.ts     — HTTP route handlers (<400 lines)
    __tests__/      — Test files
      feature.test.ts
```

## Core Principles

1. **One concern per file.** Types never live in the same file as route logic.
2. **Barrel exports only.** Consumers import from `./feature-name`, never deep imports.
3. **Re-export wrappers.** Original god files become thin re-export wrappers for backward compat.
4. **Under 500 lines.** Every `.ts` file stays under 500 lines.

## Barrel Export Pattern

```typescript
// index.ts
export type { Foo, Bar } from './types';
export { CONST_VAL } from './constants';
export { helperFn } from './utils';
export { coreLogic } from './core';
```

## Refactoring Pattern

When splitting a god file (e.g., `giant-file.ts` > 500 lines):

1. `mkdir giant-file/`
2. Extract types → `giant-file/types.ts`
3. Extract constants → `giant-file/constants.ts`
4. Extract helpers → `giant-file/utils.ts`
5. Extract main logic → `giant-file/core.ts`
6. Extract fetchers/handlers → separate files
7. Create `giant-file/index.ts` barrel
8. Replace `giant-file.ts` with re-export wrapper

**Verification:** After splitting, run `tsc --noEmit` to check imports still resolve.
