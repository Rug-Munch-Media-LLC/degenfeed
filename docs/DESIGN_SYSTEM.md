# DegenFeed Design System

> **Version:** 1.0.0  
> **Last updated:** 2026-07-24  
> **Status:** ⚠️ Audit in progress — documenting current state + planned improvements

---

## Table of Contents

1. [Color Palette](#1-color-palette)
2. [Typography Scale](#2-typography-scale)
3. [Spacing Scale](#3-spacing-scale)
4. [Component Patterns](#4-component-patterns)
5. [Icon Conventions](#5-icon-conventions)
6. [State Management](#6-state-management)
7. [Animation System](#7-animation-system)
8. [Audit Findings](#8-audit-findings)
9. [Recommended Improvements](#9-recommended-improvements)

---

## 1. Color Palette

### 1.1 Theme Architecture

The app uses a **CSS custom property system** with light/dark theme switching. Current tokens live in `apps/web/src/app/globals.css` with theme scoping via `.dark` class.

#### Core Background & Text

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--background` | `#ffffff` | `#000000` | Page background |
| `--foreground` | `#171717` | `#e7e9ea` | Primary text |
| `--muted` | `#f5f5f5` | `#16181c` | Subtle backgrounds |
| `--muted-foreground` | `#737373` | `#71767b` | Secondary text |
| `--card` | `#ffffff` | `#16181c` | Card backgrounds |
| `--card-foreground` | `#171717` | `#e7e9ea` | Card text |
| `--border` | `#e5e5e5` | `#2f3336` | Borders & dividers |

#### Brand & Semantic Colors

| Token | Light | Dark | Purpose |
|-------|-------|------|---------|
| `--primary` | `#16a34a` | `#00ff41` | Primary buttons, CTAs |
| `--primary-foreground` | `#ffffff` | `#000000` | Text on primary |
| `--destructive` | `#dc2626` | `#f4212e` | Danger, delete |
| `--ring` | `#16a34a` | `#00ff41` | Focus rings |

#### DegenFeed Custom Tokens

| Token | Light | Dark |
|-------|-------|------|
| `--color-bg` | `#ffffff` | `#000000` |
| `--color-fg` | `#171717` | `#e7e9ea` |
| `--color-accent` | `#16a34a` | `#00ff41` |
| `--color-accent-glow` | `rgba(22,163,74,0.12)` | `rgba(0,255,65,0.15)` |
| `--color-muted` | `#737373` | `#71767b` |
| `--color-muted-bg` | `#f5f5f5` | `#1a1a1a` |
| `--color-border` | `#e5e5e5` | `#2f3336` |
| `--color-card` | `#ffffff` | `#16181c` |
| `--color-card-hover` | `#f9fafb` | `#1d1f23` |
| `--color-danger` | `#dc2626` | `#f4212e` |
| `--color-glass-bg` | `rgba(255,255,255,0.7)` | `rgba(22,24,28,0.75)` |
| `--color-glass-border` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.08)` |
| `--color-overlay` | `rgba(0,0,0,0.05)` | `rgba(255,255,255,0.04)` |

#### Tailwind "degen" Green Scale

```
degen-50:  #e6ffec
degen-100: #b3ffcc
degen-200: #80ffad
degen-300: #4dff8d
degen-400: #1aff6e
degen-500: #00ff41  ← primary accent
degen-600: #00cc34
degen-700: #009927
degen-800: #00661a
degen-900: #00330d
```

#### Protocol Colors (CSS Vars)

Each supported protocol has a dedicated color variable:

```css
--color-protocol-nostr:      #8b5cf6;  /* purple */
--color-protocol-farcaster:  #8a63d2;  /* violet */
--color-protocol-lens:       #abfe2c;  /* lime */
--color-protocol-bluesky:    #1185fe;  /* blue */
--color-protocol-mastodon:   #6364ff;  /* indigo */
--color-protocol-threads:    #888888;  /* gray */
--color-protocol-reddit:     #ff4500;  /* orange-red */
--color-protocol-lemmy:      #00b868;  /* green */
--color-protocol-rss:        #ffa500;  /* orange */
```

### 1.2 ⚠️ Audit Findings

**🔴 Hardcoded colors found in components** (`packages/ui/src/`):

| File | Line | Value | Should Be |
|------|------|-------|-----------|
| `SignInModal.tsx` | 42-143 | `#4285f4`, `#1da1f2`, `#6cc644`, etc. | `var(--color-protocol-*)` |
| `ComposeModal.tsx` | 990 | `#666` | `var(--color-muted)` |
| `ContentCalendar.tsx` | 173 | `#666` | `var(--color-muted)` |
| `PostCard.tsx` | 1466 | `#101010` | `var(--color-fg)` |
| `UnifiedTipDashboard.tsx` | 71-73 | `#22c55e`, `#00bc8c`, `#f2690d` | Theme variable |
| `LiveReactionOverlay.tsx` | 796,800 | `rgba(255,255,255,0.1)` | `var(--color-glass-*)` |

**🔴 Tailwind arbitrary colors used** — some components use `text-[var(--color-*)]` (good) but others use Tailwind color classes like `text-green-400`, `text-red-400`, `text-orange-400` which bypass the design system.

---

## 2. Typography Scale

### 2.1 Font Families

| Token | Font Stack | CSS Variable |
|-------|-----------|-------------|
| Heading | `"Sora", "Inter", system-ui, sans-serif` | `--font-heading` |
| Body | `"Inter", "system-ui", sans-serif` | `--font-body` |
| Mono | `"JetBrains Mono", "Fira Code", monospace` | `--font-mono` |

### 2.2 Heading Scale

| Level | Size | Line Height | Weight | Letter Spacing |
|-------|------|-------------|--------|---------------|
| h1 | `2rem` (32px) | 1.2 | 700 | -0.02em |
| h2 | `1.5rem` (24px) | 1.25 | 700 | -0.02em |
| h3 | `1.25rem` (20px) | 1.3 | 700 | -0.02em |
| h4 | `1.125rem` (18px) | 1.3 | 700 | -0.02em |
| h5 | `1rem` (16px) | 1.3 | 700 | -0.02em |
| h6 | `0.875rem` (14px) | 1.3 | 700 | -0.02em |

### 2.3 Body Text

| Style | Size | Line Height | Usage |
|-------|------|-------------|-------|
| Body | `1rem` | 1.6 | Paragraphs, content |
| Small | `0.875rem` | 1.6 | Labels, secondary |
| Compact | `var(--font-size-base)` | 1.4 | Dense layouts |
| Reader-sm | `0.875rem` | — | Reading mode small |
| Reader-md | `1rem` | — | Reading mode default |
| Reader-lg | `1.125rem` | — | Reading mode large |

### 2.4 Reader Settings (Dynamic)

```css
--reader-font-size: var(--font-size-base);    /* adjustable */
--reader-line-height: var(--line-spacing-comfortable); /* adjustable */
```

Reader classes toggle these via `.reader-sm`, `.reader-md`, `.reader-lg` and `.reader-compact`, `.reader-comfortable`, `.reader-relaxed`.

### 2.5 ⚠️ Audit Findings

**✅ Good:** Heading styles are globally enforced via `@layer base` in `globals.css`. Font variables loaded via `next/font/google`.

**✅ Good:** Reader settings use CSS custom properties with class toggles — clean pattern.

**⚠️ Minor:** Font weight always `700` for all headings — consider `600` for h5/h6. No `font-weight` token system.

---

## 3. Spacing Scale

### 3.1 Design Tokens (4px Grid)

| Token | Value | Tailwind Equivalent |
|-------|-------|-------------------|
| `--space-xs` | `0.25rem` (4px) | `p-1` |
| `--space-sm` | `0.5rem` (8px) | `p-2` |
| `--space-md` | `1rem` (16px) | `p-4` |
| `--space-lg` | `1.5rem` (24px) | `p-6` |
| `--space-xl` | `2rem` (32px) | `p-8` |
| `--space-2xl` | `3rem` (48px) | `p-12` |

### 3.2 Gap Tokens

| Token | Value |
|-------|-------|
| `--gap-xs` | `0.25rem` (4px) |
| `--gap-sm` | `0.5rem` (8px) |
| `--gap-md` | `1rem` (16px) |

### 3.3 Border Radius

| Token | Value | Shape |
|-------|-------|-------|
| `--radius-sm` | `0.25rem` (4px) | Subtle |
| `--radius-md` | `0.5rem` (8px) | Default (also `--radius`) |
| `--radius-lg` | `0.75rem` (12px) | Cards |
| `--radius-xl` | `1rem` (16px) | Modals |
| `--radius-2xl` | `1.5rem` (24px) | Large sheets |
| `--radius-full` | `9999px` | Pills, avatars |

### 3.4 ⚠️ Audit Findings

**✅ Good:** CSS variable tokens for spacing exist. `--btn-min-height` enforces 44px touch targets.

**🔴 Issue:** CSS variable tokens (`--space-*`) are **rarely used directly** — most components use Tailwind utility classes (`p-4`, `gap-3`, `px-4`) instead. This means designers can't update spacing globally by changing one token.

**🔴 Issue:** No `--space-3xs` (2px) or `--space-3xl` (4rem+) — the scale is truncated.

---

## 4. Component Patterns

### 4.1 Button System

Defined in `globals.css` `@layer components`:

```css
/* Base button */
.btn  → inline-flex, centered, rounded-lg, min-h-[44px]

/* Variants */
.btn-primary  → bg-degen-500, text-black, glow shadow
.btn-secondary → border + subtle background, hover glow
.btn-ghost    → transparent, muted text, hover overlay
```

**Micro-interactions:** `btn-press` class (scale 0.95 on active), `btn-spring` animation.

### 4.2 Card System

```css
.card       → bordered, rounded-lg, padded, shadow, hover:border-accent
.card-hover → same but interactive (cursor pointer, scale on hover)
.card-glass → glass morphism (blur, transparent bg)
```

### 4.3 Form Inputs

```css
.input → width 100%, rounded-lg, border, focus: accent glow
```

### 4.4 Component Library (`packages/ui/src/`)

73 components, all TypeScript React, exported via `index.ts` with typed props.

**Component categories:**

| Category | Count | Examples |
|----------|-------|---------|
| Post/Feed | 11 | `PostCard`, `FeedList`, `PostCardSkeleton`, `PostCardEmpty` |
| Identity | 9 | `IdentityBadge`, `ProtocolBadge`, `ReputationBadge`, `NostrRelayBadge` |
| Media | 9 | `VideoPlayer`, `MixedVideoGrid`, `TokenChart`, `YouTubeVideoCard` |
| Modals | 10 | `ComposeModal`, `SignInModal`, `PaywallModal`, `EmbedModal` |
| Social | 7 | `QuickTipButton`, `VotingPanel`, `LiveReactionOverlay` |
| Utility | 8 | `Toast`, `LoadingSkeleton`, `EmptyState`, `ErrorBoundary` |
| Protocol-specific | 8 | `BlueskyPostContext`, `LemmyThreadView`, `PeerTubeEmbed` |
| Layout | 11 | `TrendingSidebar`, `ContentCalendar`, `UnifiedProfileHeader` |

### 4.5 ⚠️ Audit Findings

**✅ Good:** All components export typed interfaces. Barrel export via `index.ts`. 

**🔴 Issue:** `PostCard.tsx` is **1,578 lines** — violates Single Responsibility, mixes concerns (engagement, context menus, media rendering, protocol-specific logic).

**🔴 Issue:** Components import directly from `@degenfeed/storage` (IDB mutations like `addBlockedUser`, `muteIdentity`) — these should go through a service/hook layer.

**🔴 Issue:** No Storybook or component preview — visual regressions can't be caught.

**🔴 Issue:** Button styling mixes `@apply` with raw CSS (`.btn-secondary` uses raw CSS while `.btn-primary` uses `@apply`) — inconsistent pattern.

---

## 5. Icon Conventions

### 5.1 Current Approach

- Icons use **emoji/unicode characters** in most components (e.g., `♦`, `◆`, `▶`, `L` for platform icons in `UnifiedTipDashboard`)
- Protocol icons via `getProtocolIcon()` in `ProtocolBadge.tsx` — returns string/emoji
- No icon library (no Lucide, Phosphor, Heroicons)
- SVG icons used sparingly (e.g., scroll-to-top progress ring)

### 5.2 ⚠️ Audit Findings

**🔴 Issue:** No consistent icon system — emoji renders differently across platforms.

**🔴 Issue:** `getProtocolIcon()` returns different icon types (emoji, letters, symbols) — inconsistent rendering.

**🔴 Issue:** No icon sizing conventions — some inline `font-size`, others use `width/height`.

---

## 6. State Management

### 6.1 Current Architecture

```
┌──────────────────────────────────────────────────────┐
│                   DegenFeed State                     │
├──────────────┬──────────────┬────────────────────────┤
│ React Hooks  │  Context     │  External Storage       │
│              │  Providers   │                        │
├──────────────┼──────────────┼────────────────────────┤
│ useState     │ AuthProvider │ localStorage (prefs)    │
│ useCallback  │ SolanaProv.  │ IndexedDB (identities)  │
│ useEffect    │ Web3Prov.    │ KV API (sync)           │
│ useRef       │ ToastProv.   │ Cookie (SSR theme)      │
│              │ RealtimeCl.  │                        │
└──────────────┴──────────────┴────────────────────────┘
```

### 6.2 Current Patterns

| Concern | Pattern | Location |
|---------|---------|----------|
| **Preferences** | `usePreferences` hook (502 lines) | `hooks/usePreferences.ts` |
| **Feed** | Custom `api.ts` + `feed.ts` service | `services/` |
| **Auth** | `AuthProvider` context | `components/AuthProvider.tsx` |
| **Notifications** | `useNotifications` hook | `hooks/useNotifications.ts` |
| **Realtime** | WebSocket + `RealtimeClientProvider` context | `components/` |
| **Theme** | localStorage + cookie + CSS class toggle | `usePreferences.ts` + layout |
| **Tip/Wallet** | `useTip`, `useWalletConnect` hooks | `hooks/` |

### 6.3 ⚠️ Audit Findings

**🔴 No centralized state management.** 55 hooks with no shared store pattern. Each page/component manages its own state.

**🔴 Prop drilling.** `PostCard.tsx` receives 25+ props including callbacks (`onEngage`, `onClick`) — passes through to child components. A 1,578-line component is a symptom of missing state management.

**🔴 Mixed concerns.** `usePreferences` mixes UI state (theme, font size), persistence (localStorage, cookies), and API calls (KV API) in one 502-line hook.

**🔴 Stale closure risk.** Multiple instances of `prefsRef` pattern to work around stale closures — a sign that the hook API needs rethinking.

**🔴 Inline IDB mutations.** Components import `@degenfeed/storage` directly and call `addBlockedUser`, `muteIdentity` inside event handlers — no abstraction layer.

---

## 7. Animation System

### 7.1 Defined in globals.css

| Animation | Duration | Easing | Purpose |
|-----------|----------|--------|---------|
| `slide-up` | 0.3s | ease-out | Card entrance |
| `fade-in` | 0.3s | ease-out | General entrance |
| `shimmer` | 1.5s | ease-in-out | Loading skeletons |
| `heart-pop` | 0.4s | spring | Like interaction |
| `modal-content-in` | 0.3s | cubic-bezier(0.16,1,0.3,1) | Modal open |
| `modal-overlay-in` | 0.2s | ease-out | Modal backdrop |
| `dropdown-in` | 0.2s | spring | Dropdown open |
| `toast-in-right` | 0.35s | spring | Toast slide-in |
| Various page transitions | 0.35-0.4s | spring | Route changes |
| Pull-to-refresh | 0.3-0.4s | spring | Mobile refresh |

### 7.2 Duration Tokens

```css
--duration-fast:   150ms;
--duration-normal: 250ms;
--duration-slow:   400ms;
```

---

## 8. Audit Findings Summary

### 🔴 Critical Issues

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | No foreign keys in any DB model | `rmi-backend/app/models/` | Data integrity risk |
| 2 | `PostCard.tsx` is 1,578 lines | `packages/ui/src/PostCard.tsx` | Maintainability |
| 3 | No centralized state management | All `hooks/` | Scalability |
| 4 | API routes inconsistent across 3 backends | All apps | Developer confusion |
| 5 | No icon system | `packages/ui/` | Visual inconsistency |

### 🟡 Medium Issues

| # | Issue | Location |
|---|-------|----------|
| 6 | Hardcoded colors in 7+ component files | `packages/ui/src/` |
| 7 | Design tokens defined but not used consistently | `globals.css` vs Tailwind |
| 8 | Button variants mix `@apply` and raw CSS | `globals.css` |
| 9 | Components import storage directly | `PostCard.tsx` -> `@degenfeed/storage` |
| 10 | `usePreferences` is 502 lines, mixing concerns | `hooks/usePreferences.ts` |

### 🟢 Minor Issues

| # | Issue | Location |
|---|-------|----------|
| 11 | No CSS module system | All components use global CSS |
| 12 | No component preview tool (Storybook) | Missing |
| 13 | Spacing scale not using CSS vars | Tailwind classes everywhere |
| 14 | No typography `font-weight` tokens | Hardcoded `font-weight: 700` |

---

## 9. Recommended Improvements

### P0 — Immediate (this week)

1. **Add foreign keys to rmi-backend models**
   ```python
   # Add FK from Alert.owner_id -> User.id
   owner_id: Mapped[uuid.UUID | None] = mapped_column(
       ForeignKey("users.id", ondelete="CASCADE"),
       nullable=True,
   )
   # Same for AlertSubscription, Payment, ScanResult
   ```

2. **Create a centralized API convention doc** and enforce across all apps:
   - URL: `/api/v1/{resource}/{id}/{action}`
   - Query: `?limit=N&offset=N&sort=field:asc|desc`
   - Response: `{ data, meta: { total, limit, offset }, errors: [] }`

3. **Audit and fix hardcoded colors** — replace with CSS var references:
   - `SignInModal.tsx`: use `getProtocolColor()` instead of hardcoded hex
   - All component files: replace `#xxx` with `var(--color-*)`

### P1 — Short-term (this sprint)

4. **Add Zustand for shared state**
   ```ts
   // stores/feed.ts
   export const useFeedStore = create<FeedState>()((set) => ({
     posts: [],
     loading: 'idle',
     fetchFeed: async (params) => { ... }
   }))
   ```

5. **Extract PostCard subcomponents** — split into:
   - `PostCardHeader.tsx` (author, protocol, timestamp)
   - `PostCardContent.tsx` (text, embeds, media)
   - `PostCardActions.tsx` (like, repost, reply, menu)
   - `PostCard.tsx` (compose)

6. **Add Lucide Icons** — replace emoji icons with SVG icon components.

### P2 — Medium-term

7. **Design token audit**: ensure all Tailwind spacing/color classes use CSS vars.
8. **Add Storybook** for component preview and visual regression testing.
9. **Create `@degenfeed/theme` package** with design tokens as exportable JS constants.
10. **Refactor `usePreferences`** into smaller hooks: `useTheme`, `useDensity`, `useFontSize`.

---

## 10. Quick Reference

### Component Checklist

When creating a new component:

- [ ] Use CSS variables for colors (`var(--color-*)`)
- [ ] Use spacing tokens (`--space-*`, `--gap-*`) or Tailwind spacing
- [ ] Export typed interface for props
- [ ] Add to `packages/ui/src/index.ts`
- [ ] Include `'use client'` directive if interactive
- [ ] Support `className` prop for customization
- [ ] Include loading/empty/error states
- [ ] Honor `prefers-reduced-motion`
- [ ] Use `focus-visible` for keyboard accessibility
- [ ] Add `displayName` for debugging

### CSS Variable Precedence

```
Tailwind utility class (can override) > component CSS > --color-* tokens > --* shadcn tokens
```

### Theme Switching

```tsx
// Adding a new theme-aware component:
// 1. Define light/dark values in globals.css :root / .dark
// 2. Reference via var(--my-token)
// 3. No media queries for theme (handled by .dark class toggle)
```
