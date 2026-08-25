<!--
SPDX-License-Identifier: MIT
Copyright (c) 2026 Rug Munch Media LLC
Part of DegenFeed Web — https://git.rugmunch.io/RugMunchMedia/degenfeed
-->

# Contributing to DegenFeed Web

> Next.js multi-protocol social aggregator client. TypeScript + Next.js 16 + React 19.
> Full-stack monorepo (Turborepo + pnpm workspaces) with Cloudflare Workers API, Bridge service, and protocol SDK packages.

See the [root CONTRIBUTING.md](../CONTRIBUTING.md) for the canonical contributing guide.

This page exists as a symlink target for the VitePress documentation site.

## Quick Start

```bash
git clone https://git.rugmunch.io/RugMunchMedia/degenfeed
cd degenfeed
pnpm install
pnpm dev              # Run all workspaces in dev mode
pnpm lint typecheck   # Verify code quality
pnpm test             # Run all tests
```

## Documentation Index

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, package map, data flow |
| [MODULE-STRUCTURE.md](./MODULE-STRUCTURE.md) | File organization, barrel exports, naming |
| [CODE-STRUCTURE.md](./CODE-STRUCTURE.md) | God file refactoring patterns, anti-patterns |
| [QUALITY-STANDARDS.md](./QUALITY-STANDARDS.md) | Quality gates, tests, review checklist |
| [CODE_STANDARDS.md](./CODE_STANDARDS.md) | TypeScript, React, API, testing conventions |
| [API_REFERENCE.md](./API_REFERENCE.md) | API endpoint reference |
| [TESTING_PLAN.md](./TESTING_PLAN.md) | Testing strategy and patterns |

## Key Rules

1. **No file > 500 lines** — mandatory split
2. **No stub files** — every file must contain real implementation
3. **Barrel exports** — every directory has `index.ts`
4. **Response helpers** — use `ok()`, `badRequest()`, etc.
5. **Bridge providers never throw** — return `[]` on error
6. **TypeScript strict mode** — no `any`, no non-null assertions
