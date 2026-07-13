---
title: FRONTEND-TOOLS.md — Best-in-Class Open Source Frontend Toolkit
status: canonical
owner: Rug Munch Media LLC Engineering
last_updated: 2026-07-10
audience: AI agents, engineers
purpose: Single source of truth for which frontend tools to use and when.
---

# FRONTEND-TOOLS.md — AI Agent Frontend Toolkit

## 📐 Design & Prototyping

| Tool | License | Description | In Use | Agent Guidance |
|------|---------|-------------|--------|----------------|
| **Penpot** | MPL 2.0 | Open source design & prototyping platform (Figma alternative). Browser-based, self-hostable. | No | Use for collaborative UI mockups and design handoff. Self-host on Talos if needed. |
| **Excalidraw** | MIT | Virtual whiteboard for sketching diagrams and wireframes. Embeddable as React/Vue component. | No | Use for quick architectural diagrams, flowcharts, and whiteboard-style wireframes during planning. |
| **Draw.io** | Apache 2.0 | Diagram editor, self-hostable via Docker, integrates with VS Code. | No | Use for system architecture diagrams, flow charts, and ERDs. |

## 🎨 Design Systems & Tokens

| Tool | License | Description | In Use | Agent Guidance |
|------|---------|-------------|--------|----------------|
| **Style Dictionary** | Apache 2.0 | Transform design tokens (JSON) into platform-specific outputs (CSS vars, JS, Swift, Kotlin). | No | Use when we need a single source of truth for design tokens across web, mobile, and brand assets. |
| **Radix Colors** | MIT | Accessible, WCAG-compliant color scales with light/dark mode pairs. | No | Use as the color foundation for any new UI. Pairs perfectly with shadcn-vue. |
| **Open Props** | MIT | Design tokens as CSS custom properties — colors, spacing, fonts, animations, etc. | No | Use when you want a design-token system without a full framework. Drop into any project. |
| **UnoCSS** | MIT | Atomic CSS engine with on-demand generation. Faster than Tailwind for large projects. | No | Use when Tailwind's bundle size or build speed becomes a bottleneck. Reuse Tailwind presets. |
| **Tailwind CSS v4** | MIT | Utility-first CSS framework. CSS-first configuration (no JS config). | **Yes** | **Default CSS framework for all frontends.** Use v4's `@theme`, `@layer`, and CSS-first config. |
| **shadcn/ui** | MIT | Component system — copy-paste components built on Radix/Reka. Available for React and Vue. | **Yes** | **Default component system.** Always check shadcn-vue first before building custom components. |

## 🧩 Component Libraries

| Tool | License | Description | In Use | Agent Guidance |
|------|---------|-------------|--------|----------------|
| **shadcn-vue** | MIT | Vue port of shadcn/ui. Built on Reka UI (Radix port) with Tailwind. | **Yes** | **Default Vue component library.** Always check here first. Add components via `npx shadcn-vue add`. |
| **Radix UI / Reka UI** | MIT | Headless, unstyled UI primitives with full WAI-ARIA compliance. Reka UI is the Vue port. | **Yes** | Use when shadcn-vue doesn't have the component. Build custom UI on top of accessible primitives. |
| **Ark UI** | MIT | Headless component library supporting Vue, React, Solid, Svelte. | No | Use for cross-framework component sharing or when Reka UI doesn't have a primitive you need. |
| **Nuxt UI v3** | MIT | Full component suite built for Nuxt 4. Uses Reka UI + Tailwind. | No | Use for rapid Nuxt app development where shadcn-vue feels too low-level. |
| **Vant** | MIT | Mobile-first Vue 3 component library. 70+ components. | No | Use for mobile-only interfaces or when building a mobile-optimized experience. |
| **PrimeVue** | MIT | Rich Vue component library with 90+ components. Supports styled and unstyled modes. | No | Use when you need a data-table, tree, or complex form components that shadcn doesn't cover. |

## 🎬 Animation & Motion

| Tool | License | Description | In Use | Agent Guidance |
|------|---------|-------------|--------|----------------|
| **Motion (prev. Framer Motion)** | MIT | Declarative animation library for React and Vue. Spring, layout, gesture animations. | No | **Default animation library.** Use for Vue transitions, page transitions, and gesture-driven animations. |
| **GSAP** | Standard (free for most uses) | Professional-grade animation engine. Timeline, scroll-triggered, SVG animations. | No | Use for complex timeline animations, scroll-triggered storytelling, or SVG morphing. |
| **AutoAnimate** | MIT | Zero-config animation for Vue/React/Svelte — add `v-auto-animate` and get layout animations. | No | Use for lists, sortable grids, and dynamic content where you want instant polish. |
| **Lottie / dotlottie-web** | MIT | Render After Effects animations exported as Lottie JSON. Player for web. | No | Use for complex designer-crafted animations (loading states, illustrations, splash screens). |
| **Anime.js** | MIT | Lightweight animation engine (~10KB). Keyframes, timelines, SVG, CSS transforms. | No | Use for small, targeted animations where Motion is overkill. |

## 📊 Charts & Data Viz

| Tool | License | Description | In Use | Agent Guidance |
|------|---------|-------------|--------|----------------|
| **ECharts** | Apache 2.0 | Full-featured charting library. 20+ chart types, large datasets, geo maps. | **Yes** | Use for complex charts, dashboards, and geo/spatial visualizations. |
| **lightweight-charts** | Apache 2.0 | TradingView's financial charting library. Candlestick, line, bar, area, volume. | **Yes** | Use for all financial/trading charts (price, OHLC, volume, orderbook). |
| **D3.js** | ISC | Low-level data visualization library. Full control over DOM and SVG. | No | Use when ECharts or LayerChart can't achieve the custom visualization you need. |
| **Observable Plot** | ISC | High-level D3 wrapper for quick, exploratory visualization. | No | Use for rapid data exploration and generating static charts from datasets. |
| **Cytoscape.js** | MIT | Graph theory / network visualization library. Node-edge diagrams, layouts, styling. | **Yes** | Use for entity-relationship graphs, network topology, and graph analysis UIs. |
| **Unovis** | Apache 2.0 | Modular visualization framework. Supports Vue, React, Svelte, Angular. | No | Use when you need consistent, performant charts across multiple frameworks. |
| **LayerChart** | MIT | Composable chart primitives built on D3. Declarative, tree-shakeable. | No | Use for custom chart compositions that are easier than raw D3 but more flexible than ECharts. |

## 🖼️ Image & Media

| Tool | License | Description | In Use | Agent Guidance |
|------|---------|-------------|--------|----------------|
| **Sharp** | Apache 2.0 | High-performance Node.js image processing. Resize, format convert, compress. | No | Use for server-side image processing (thumbnails, WebP/AVIF conversion, responsive images). |
| **PixelMatch** | MIT | Pixel-level image comparison. Used in visual regression testing. | No | Use in Playwright visual tests for pixel-perfect diffing. |
| **Compressor.js** | MIT | Client-side image compression before upload. Configurable quality/size. | No | Use when users upload images — compress on client to reduce bandwidth and storage. |
| **Video.js** | Apache 2.0 | HTML5 video player with plugin ecosystem. HLS/DASH streaming. | No | Use for video playback with advanced controls, streaming, or custom skinning. |
| **Plyr** | MIT | Simple, lightweight HTML5 media player. Video + audio. | No | Use for basic video/audio playback when Video.js is overkill. |

## 🧪 Testing

| Tool | License | Description | In Use | Agent Guidance |
|------|---------|-------------|--------|----------------|
| **Vitest** | MIT | Vite-native test runner. Jest-compatible API, instant HMR, ESM-first. | **Yes** | **Default test runner.** Use for all unit and integration tests. |
| **Playwright** | Apache 2.0 | E2E testing across Chromium, Firefox, WebKit. Supports visual, component, and API testing. | **Yes** | **Default E2E + visual testing.** Write tests as Playwright traces with `await page.screenshot()`. |
| **Axe-core** | MPL 2.0 | Automated accessibility testing engine. Finds WCAG violations. | **Yes** | Run on every page/component after render. Integrate into Playwright tests via `@axe-core/playwright`. |
| **Testing Library** | MIT | User-centric testing utilities (DOM, Vue, React). Tests interact with DOM, not implementation. | No | Use with Vitest for component-level behavioral tests. Prefer `@testing-library/vue`. |
| **Storybook** | MIT | Component development environment. Visual testing, accessibility addon, interaction testing. | No | Use for component libraries, visual regression catalogs, and component documentation. |
| **MSW** | MIT | Mock Service Worker — intercept network requests at the Service Worker level. | No | Use for API mocking in tests and Storybook. Works with Vitest and Playwright. |

## 🚀 Performance

| Tool | License | Description | In Use | Agent Guidance |
|------|---------|-------------|--------|----------------|
| **Lighthouse CI** | Apache 2.0 | Performance, accessibility, SEO, and best-practice auditing as CI. | **Yes** | Run in CI on every PR. Enforce performance budgets. Block regressions. |
| **Vite** | MIT | Build tool and dev server. Instant HMR, optimized builds, plugin ecosystem. | **Yes** | **Default build tool.** Use for all frontend projects (Nuxt uses Vite under the hood). |
| **Turborepo** | MIT | Monorepo orchestrator. Parallel task execution, caching, dependency graph. | **Yes** | Use for monorepo management. Cache builds, lint, and test outputs. |
| **Web Vitals** | Apache 2.0 | Library for tracking Core Web Vitals (LCP, CLS, INP, FID). | No | Add to production apps to track real-user performance metrics. Send to analytics. |
| **Partytown** | MIT | Run third-party scripts (analytics, ads, tracking) in Web Workers. | No | Use to offload heavy third-party scripts from the main thread. |

## ♿ Accessibility

| Tool | License | Description | In Use | Agent Guidance |
|------|---------|-------------|--------|----------------|
| **Axe-core** | MPL 2.0 | Automated accessibility testing engine. | **Yes** | Run on every PR. Integrate with Playwright. Never ship a11y regressions. |
| **Radix UI / Reka UI** | MIT | All primitives built with WAI-ARIA compliance. Keyboard navigation, focus management, screen reader support. | **Yes** | Use these primitives to get a11y correct by default. |
| **Focus-trap** | MIT | Trap keyboard focus inside a DOM element (modals, dialogs, sidebars). | No | Use for any focus-trapping UI (modals, mobile nav, drawers). |
| **tabbable** | MIT | Find all tabbable elements in a DOM tree. | No | Use when managing focus order in complex UIs or testing keyboard navigation. |

## 🔧 Utility Libraries

| Tool | License | Description | In Use | Agent Guidance |
|------|---------|-------------|--------|----------------|
| **VueUse** | MIT | 200+ Vue 3 composition utilities. `useMouse`, `useDebounce`, `useStorage`, etc. | **Yes** | **Default utility library.** Always check VueUse before writing a custom composable. |
| **TanStack Query (Vue Query)** | MIT | Async state management — caching, deduplication, background refetching. | **Yes** | **Default data fetching.** Use for all API calls. Handles loading/error states. |
| **Zod** | MIT | Schema declaration and validation with TypeScript type inference. | No | Use for runtime API validation, form validation, and config schemas. |
| **Valibot** | MIT | Smaller, faster alternative to Zod. Modular — import only what you need. | No | Use when bundle size matters more than ecosystem maturity. |
| **Dexie.js** | Apache 2.0 | Minimal wrapper around IndexedDB. Promise-based, queryable, reactive. | **Yes** | Use for client-side persistent storage (cache, offline data, drafts). |
| **immer** | MIT | Immutable state updates through mutable syntax. | No | Use with Pinia or Vue reactivity for complex nested state updates. |
| **nanoid** | MIT | URL-safe unique ID generator. Smaller than UUID. | No | Use for generating IDs for DOM elements, keys, or database records. |

## 📱 Mobile & PWA

| Tool | License | Description | In Use | Agent Guidance |
|------|---------|-------------|--------|----------------|
| **Capacitor** | MIT | Cross-platform native runtime — turn web apps into iOS/Android apps. | No | Use when we need to ship our Vue/Nuxt app as a native mobile app. |
| **Vite PWA** | MIT | Vite plugin for PWA support. Service worker, manifest, precaching. | No | Use to add PWA capabilities (offline, install prompt, push notifications). |
| **Workbox** | MIT | Service worker toolkit. Precaching, runtime caching, strategies. | No | Use for advanced service worker logic (offline fallbacks, background sync). |

## 🔒 Security

| Tool | License | Description | In Use | Agent Guidance |
|------|---------|-------------|--------|----------------|
| **DOMPurify** | Apache 2.0 / MPL 2.0 | HTML sanitization. Remove XSS vectors from user-generated HTML. | **Yes** | Use before rendering any user-provided HTML (rich text, markdown output, comments). |
| **CSP Evaluator** | — | Google tool for evaluating Content Security Policy headers. | No | Use during security review to validate CSP rules. |
| **SRI Hash Generator** | — | Generate Subresource Integrity hashes for CDN resources. | No | Use when loading external scripts/styles via CDN. |

---

## 🧭 Agent Decision Tree

```
When building a new UI component:
  → Check if shadcn-vue has it
    → YES: use shadcn-vue component
    → NO: check Radix UI / Reka UI primitives
      → EXISTS: build custom component on top of primitive
      → DOESN'T EXIST: check Ark UI or Nuxt UI v3
  → Always:
    → Use VueUse composables for common logic
    → Use Tailwind CSS v4 for styling
    → Use Motion (framer-motion) for animations
    → Use DOMPurify for any user-rendered HTML
    → Run axe-core a11y check
    → Write Vitest unit tests
    → Write Playwright E2E tests
    → Run Lighthouse CI audit

When adding data fetching:
  → Use TanStack Query (Vue Query)
  → Validate API responses with Zod or Valibot
  → Cache responses with Dexie.js for offline support

When adding a chart:
  → Financial/trading data → lightweight-charts
  → Complex dashboards / geo maps → ECharts
  → Entity graphs / networks → Cytoscape.js
  → Custom or simple static charts → LayerChart or Observable Plot

When adding animations:
  → Page transitions, gesture animations → Motion
  → Layout animations for lists → AutoAnimate
  → Designer-crafted animations → Lottie
  → Complex timelines / scroll triggers → GSAP

When building for production:
  1. Vite (build) + Turborepo (monorepo)
  2. Playwright (E2E) + Vitest (unit) + axe-core (a11y)
  3. Lighthouse CI (perf budget)
  4. Partytown (third-party scripts off main thread)
  5. Web Vitals (real-user monitoring)
  6. DOMPurify (XSS protection)
  7. SRI hashes + CSP (security)
```

---

## 📋 Quick Reference — Build by Priority

| Priority | Tier | Tools |
|----------|------|-------|
| P0 — Must have | Core | Tailwind v4, shadcn-vue, VueUse, TanStack Query, Vitest, Playwright, axe-core, Vite |
| P1 — Should have | Enhancement | Motion, ECharts, lightweight-charts, Focus-trap, Zod/Valibot |
| P2 — Nice to have | Specialized | GSAP, Cytoscape.js, D3, Storybook, MSW, Dexie.js, DOMPurify |
| P3 — When needed | Platform | Capacitor, Vite PWA, Workbox, Partytown |
