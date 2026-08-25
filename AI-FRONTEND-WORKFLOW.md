# AI Frontend Workflow — Agent Contract

## The Pipeline (EVERY frontend task follows this)

### Phase 1: Understand
1. Read `AGENTS.md` — know the project
2. Read `docs/FRONTEND-TOOLS.md` — know available tools
3. Read `docs/DESIGN-VISION.md` — know design tokens
4. Read the files you're modifying
5. Read neighboring files for patterns

### Phase 2: Design
1. Check if shadcn/ui has the component → use it
2. If not, check Radix UI primitives
3. Use design tokens for colors (never hardcode hex)
4. Use Tailwind v3 for layout and spacing
5. Use VueUse... wait. This is React. Use existing hooks/libs

### Phase 3: Build
1. Create the component in the right package:
   - Shared UI → `packages/ui/src/`
   - App-specific → `apps/web/src/components/`
   - Page layout → `apps/web/src/app/[route]/`
2. Follow existing patterns:
   - Use `'use client'` for client components that use hooks/browser APIs
   - Use function components with hooks, not classes
   - Export types/interfaces at top of file
3. Add TypeScript types/interfaces at top of file
4. Use Tailwind classes, not inline styles
5. Use `next/image` for images (with `unoptimized` for CF Pages)

### Phase 4: Verify
1. Run `pnpm biome check --write <file>` for linting
2. Check a11y: buttons have type, images have alt, modals trap focus
3. Check mobile: responsive at 390px width
4. Check dark theme: all surfaces visible on black background
5. Check loading/error/empty states are handled
6. Run `pnpm typecheck` (or `pnpm --filter degenfeed typecheck` or `make typecheck`)

### Phase 5: Test
1. Write vitest unit test for logic
2. Write Playwright component test for rendering
3. Add to smoke.spec.ts if it's a critical path
4. Update visual snapshots if UI changed

## The Checklist (before marking ANY frontend task complete)

- [ ] Follows existing code patterns (looked at 2+ similar components)
- [ ] Uses design tokens, not hardcoded values
- [ ] Uses existing shared components (don't rebuild FeedList/PostCard/etc)
- [ ] Handles loading state (skeleton or spinner)
- [ ] Handles error state (error message with retry)
- [ ] Handles empty state (empty message with CTA)
- [ ] Responsive at 390px (mobile) and 1280px (desktop)
- [ ] Accessible: buttons typed, images alt'd, modals trapped
- [ ] Dark theme compatible (app is dark-first)
- [ ] TypeScript strict — no `any`, no `as` casts unless necessary
- [ ] No console.log left in production code
- [ ] Biome lint passes
- [ ] Tests written and passing

## Package Decision Tree

```
Where should I put this component?
├── Used across multiple apps? → packages/ui/src/
├── Used only in web app? → apps/web/src/components/
├── A full page? → apps/web/src/app/[route]/page.tsx
├── A layout? → apps/web/src/app/[route]/layout.tsx
├── A custom hook? → apps/web/src/hooks/ or packages/identity/src/
├── An API client? → packages/*-sdk/src/
├── A utility function? → packages/feed-core/src/ or apps/web/src/lib/
└── A Cloudflare Worker? → workers/api/src/
```

## Styling Decision Tree

```
How should I style this?
├── Layout & spacing → Tailwind classes (grid, flex, gap, p, m)
├── Colors → design tokens or Tailwind color classes (text-degen-500, bg-degen-500)
├── Typography → Tailwind font classes (text-sm, font-bold, font-sans, font-mono)
├── Glass morphism → use the .card, .glass, .card-glass classes from globals.css
├── Buttons → use .btn, .btn-primary, .btn-secondary, .btn-ghost from globals.css
├── Glow effect → use .logo-glow or shadow-[0_0_20px_rgba(34,197,94,0.35)]
├── Animations → CSS transitions for simple (duration-200, ease-out), CSS keyframes for feed-enter
└── Background → use .aurora-bg, .mesh-bg, or .noise-overlay for atmosphere
```

## Import Convention

```typescript
// External libraries (alphabetical)
import { useQuery } from '@tanstack/react-query';
import { create } from 'zustand';
import DOMPurify from 'dompurify';
import { useMemo, useState } from 'react';

// Our packages (alphabetical)
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import {
  ErrorBoundary,
  FeedList,
  PostCard,
  ProtocolBadge,
  SignInModal,
} from '@degenfeed/ui';
import { useAuthStore } from '~/stores/auth';
```

Use `~` path alias for `src/` in `apps/web/`.

## Anti-Patterns (NEVER do these)

- ❌ Hardcoded hex colors (`#00ff41`) → use Tailwind classes or CSS vars
- ❌ Inline styles (`style={{ color: 'red' }}`) → use Tailwind classes
- ❌ Rebuilding existing components (FeedList, PostCard, ProtocolBadge, etc.)
- ❌ Using `any` type — always define interfaces
- ❌ Skipping error/loading/empty states
- ❌ Adding npm dependencies without checking if they exist in the monorepo first
- ❌ Using raw `fetch()` for API calls → use `@tanstack/react-query` or the API client
- ❌ console.log in production code
- ❌ Emoji as UI icons without aria-label
- ❌ Using `require()` in ESM modules
- ❌ Committing `.env`, secrets, or large binary files
