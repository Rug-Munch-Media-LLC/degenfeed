# DegenFeed Design Vision

## Brand

**DegenFeed** is the multi-protocol social aggregator — one window into Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, and RSS. Our brand is: **dark, technical, premium, open-source-first, privacy-respecting.**

### Visual Identity
- **Primary color**: Degen Green `#22c55e` (degen-500) — electric, cyberpunk, crypto-native
- **Background**: Deep black `#000000` (OLED-optimized, high contrast)
- **Surface**: `#030712` (gray-950) with glass morphism
- **Surface raised**: `#11111b` with `backdrop-blur-md`
- **Text primary**: `#e5e7eb` (gray-200)
- **Text secondary**: `#6b7280` (gray-500)
- **Border**: `#1f2937` (gray-800) or `rgba(255,255,255,0.06)`
- **Accent glow**: `rgba(34,197,94,0.35)` box-shadow on hover
- **Typography**: Inter (sans), JetBrains Mono / Fira Code (mono)
- **Aesthetic**: Glass morphism + cyberpunk + minimal

### Design Principles
1. **Dark first** — We are a dark-themed app. Light mode is secondary.
2. **Information density** — Power users want to scan. Don't waste space.
3. **Protocol transparency** — Every post shows its protocol visually (color badge).
4. **Zero friction browsing** — No account needed to browse. Sign in to engage.
5. **Open source pride** — The footer says "MIT Licensed. Open Source." Always.
6. **No ads, no tracking, no algorithm jail** — Ranking is explainable and user-configurable.

### Layout Philosophy
- **Desktop**: 3-column (nav left, feed center, sidebar right)
- **Tablet**: 2-column (feed + collapsed sidebar)
- **Mobile**: Single column with bottom nav
- **Max width**: 1280px for content area
- **Sticky header**: Glass morphism (`backdrop-blur-xl`, border white/10)
- **Content z-index**: content above `.aurora-bg`/`.mesh-bg`/`.noise-overlay`

### Component Architecture

#### Cards
- `rounded-2xl`, `border border-white/10`, `bg-gray-950/50`, `backdrop-blur-md`, `shadow-xl`
- Hover: `border-degen-500/30`, `bg-gray-900/60`, glow shadow
- Class: `.card` / `.card-hover` / `.card-glass`

#### Buttons
- **Primary** (`.btn-primary`): `bg-degen-500` `text-black` `hover:shadow-[0_0_20px_rgba(34,197,94,0.35)]`
- **Secondary** (`.btn-secondary`): `border border-white/10 bg-white/5` hover: `border-degen-500/30`
- **Ghost** (`.btn-ghost`): `text-gray-300 hover:bg-gray-800 hover:text-white`
- Base (`.btn`): `rounded-lg px-4 py-2 text-sm font-medium` focus ring `ring-2 ring-degen-500`

#### Inputs
- `.input`: `rounded-xl border border-white/10 bg-gray-950/50` focus: `border-degen-500 ring-1 ring-degen-500`
- Placeholder: `text-gray-500`

#### Modals
- Center screen, `.glass` backdrop, focus trap
- Close button top-right

#### Skeleton / Loading
- `.skeleton`: `animate-pulse rounded-xl bg-gray-800/80`
- Prefer skeleton pulses over spinners for content areas

### Protocol Color System
Every protocol has a distinct color. Posts, badges, and tabs use protocol colors.
Defined in `packages/ui/src/ProtocolBadge.tsx`:

| Protocol   | Color       | Hex       |
|------------|-------------|-----------|
| Nostr      | Purple      | `#8e30eb` |
| Farcaster  | Lavender    | `#8a63d2` |
| Lens       | Lime        | `#abfe2c` |
| Bluesky    | Blue        | `#1185fe` |
| Mastodon   | Indigo      | `#6364ff` |
| Threads    | Gray        | `#888888` |
| Lemmy      | Green       | `#00b868` |
| RSS        | Amber       | `#ffa500` |

### Animation Philosophy
- Purposeful, not decorative
- Page transitions: `fade-in` animation (0.3s ease-out, translateY 8px)
- Hover states: subtle color shift on cards, glow on buttons
- New content: `.feed-enter` animation (fade in from top)
- Loading: `.skeleton` pulse (not spinner, except for action buttons)
- Logo glow: `.logo-glow` keyframe (box-shadow pulse, 3s infinite)
- Aurora background: `.aurora-bg` (18s slow drift) + `.mesh-bg` (24s)
- Prefer CSS transitions and keyframes over JS animation libraries

### Accessibility Baseline
- WCAG 2.1 AA minimum
- Lighthouse a11y score ≥ 95
- All interactive elements keyboard accessible
- Focus indicators visible on all elements (`focus:ring-2 focus:ring-degen-500 focus:ring-offset-2 focus:ring-offset-black`)
- `.skip-link` on every page (visible on focus, skip to main content)
- Screen reader labels on all icon-only buttons (`aria-label`)
- `color-scheme: dark` set on `<html>`
- `prefers-reduced-motion` respected (consider `@media (prefers-reduced-motion: reduce)`)

### Performance Budget
| Metric          | Target   |
|-----------------|----------|
| LCP             | < 2.5s   |
| FID             | < 100ms  |
| CLS             | < 0.1    |
| TTI             | < 3s     |
| Bundle (gzip)   | < 200KB per route |
| Lighthouse      | ≥ 95 all categories |

### Environment Assets
- `.aurora-bg` — radial gradient animation (3-color: green, purple, pink)
- `.mesh-bg` — mesh gradient (4-corner radial, 24s cycle)
- `.noise-overlay` — SVG fractal noise at 3% opacity
- `.gradient-text` — green-to-fuchsia gradient on text (use sparingly)
- `.top-of-hour-card` — gold-tinged gradient for featured/promoted content

### Copy Standards
- App name: "DegenFeed" (capital D, capital F)
- Tagline: "The open social graph"
- Footer: "MIT Licensed. Open Source."
- Protocol names: Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, RSS
- No emoji in UI without `aria-label`
- All user-facing error messages are human-readable, not raw error codes
