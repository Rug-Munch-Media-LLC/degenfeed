<!--
SPDX-License-Identifier: MIT
Copyright (c) 2026 Rug Munch Media LLC
Part of DegenFeed Web — https://git.rugmunch.io/RugMunchMedia/degenfeed
-->

# Contributing to DegenFeed Web

> Next.js multi-protocol social aggregator client. TypeScript + Next.js 16 + React 19.
> Full-stack monorepo (Turborepo + pnpm workspaces) with Cloudflare Workers API, Bridge service, and protocol SDK packages.

## Repositories

| Platform | URL |
|----------|-----|
| **Primary** | https://git.rugmunch.io/RugMunchMedia/degenfeed |
| **GitLab mirror** | https://gitlab.com/rugmunchmedia/degenfeed |
| **Codeberg mirror** | https://codeberg.org/degenfeed/degenfeed |

PRs accepted on all platforms. Issues tracked on the primary Forgejo instance.

## TL;DR

```bash
git checkout main && git pull --rebase origin main
git checkout -b feat/my-change
# …make changes…
pnpm install
pnpm lint && pnpm typecheck && pnpm test     # pre-push gate
git add -A
git commit -m "feat(web): my change"
git push origin feat/my-change
# Open a PR on Forgejo (git.rugmunch.io/RugMunchMedia/degenfeed)
```

## Repository Model

Single-tenant branch-PR pattern. `feat/*` branches merged to `main` after CI passes.

### Branches

| Branch             | Purpose                                          |
|--------------------|--------------------------------------------------|
| `main`             | Production-ready. Protected. Forgejo-mirrored.   |
| `feat/<scope>`     | New feature or capability.                       |
| `fix/<scope>`      | Bug fix.                                         |
| `chore/<scope>`    | Tooling, deps, formatting, non-functional.       |
| `refactor/<scope>` | Code restructure, no behavior change.            |
| `docs/<scope>`     | Documentation only.                              |

### Commit Convention

We use **Conventional Commits**.

```bash
feat(feed): add topic weight encoding
fix(bridge): handle null response from RSS feed
chore(deps): update vitest to v4
docs(architecture): update protocol integration map
refactor(auth): extract wallet persistence to hook
```

Allowed types: `feat`, `fix`, `docs`, `refactor`, `style`, `test`, `chore`,
`ops`, `security`, `ci`, `build`, `perf`, `revert`.

## Remotes

| Remote      | URL                                                              | Role                          |
|-------------|------------------------------------------------------------------|-------------------------------|
| `origin`    | `ssh://git@git.rugmunch.io:2222/RugMunchMedia/degenfeed.git` | Canonical — Forgejo.          |
| `external-*`| codeberg / github / gitlab (read-only mirrors)                   | Optional community mirrors.   |

## Pre-Push Checklist

Before pushing any branch:

```bash
pnpm lint           # biome check (must exit 0)
pnpm typecheck      # tsc --noEmit (must exit 0)
pnpm test           # turbo run test (must exit 0)
pnpm build          # production build sanity (must exit 0)
```

CI is defined in `.forgejo/workflows/ci.yml`.

## Code Style

- **TypeScript 5.5+** with `strict: true`, `noUncheckedIndexedAccess`, `noUnusedLocals`
- **Biome** for format + lint (no ESLint, no Prettier)
- **No file > 500 lines** — mandatory split above this threshold (see [MODULE-STRUCTURE.md](./docs/MODULE-STRUCTURE.md))
- **No stub files** — every file must contain real implementation
- **Functional components** — hooks, no class components
- **One component per file**
- **Barrel exports** — every directory has `index.ts`; no deep imports
- **Response helpers** — use standardized `ok()`, `badRequest()`, etc. from `response-helpers.ts`
- **KV key helpers** — use centralized `KV_KEYS` from `kv-key-patterns.ts`

## Quality Gates

Every PR must pass these gates before merging:

1. **Tests pass** — `pnpm test` exits 0
2. **TypeScript** — `tsc --noEmit` passes with zero errors
3. **Lint** — `biome check` succeeds
4. **No regressions** — new tests for bug fixes and features
5. **No secrets** — review staged files for keys/tokens
6. **No debug code** — no `console.log`, `debugger`, `TODO` without linked issue
7. **File size** — no file exceeds 500 lines
8. **Auth** — protected routes have correct auth middleware
9. **States** — loading, error, and empty states covered on UI components

## Architecture Standards

See the following docs for detailed standards:

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System architecture, package map, data flow |
| [MODULE-STRUCTURE.md](./docs/MODULE-STRUCTURE.md) | File organization, barrel exports, naming |
| [CODE-STRUCTURE.md](./docs/CODE-STRUCTURE.md) | God file refactoring patterns, anti-patterns |
| [QUALITY-STANDARDS.md](./docs/QUALITY-STANDARDS.md) | Quality gates, tests, review checklist |
| [CODE_STANDARDS.md](./docs/CODE_STANDARDS.md) | TypeScript, React, API, testing conventions |
| [PRODUCT.md](./docs/PRODUCT.md) | What this repo is and isn't |

## Package Development

### Adding a New Protocol SDK

1. Create `packages/{name}-sdk/` with `package.json`, `tsconfig.json`
2. Add to `pnpm-workspace.yaml`
3. Follow the SDK pattern: `types.ts → helpers.ts → fetchers.ts → index.ts`
4. Add route handler in `workers/api/src/routes/`
5. Register routes in the appropriate `routes/register/{module}.ts`
6. Add protocol to `@degenfeed/types Protocol` union
7. Add protocol entry to `ARCHITECTURE.md` integration map

### Adding a New Route

1. Create handler file in `workers/api/src/routes/{feature}.ts`
2. Use response helpers from `../../response-helpers`
3. Register route in `workers/api/src/routes/register/{module}.ts`
4. Add to `workers/api/src/app.ts` import
5. Add tests in `workers/api/src/__tests__/`

## License

By contributing, you agree your work is licensed under the MIT License.
See [LICENSE](LICENSE).

## Code of Conduct

Be precise, be kind. Cite `file:line` when reviewing. Prefer surgical commits.

## Further Reading

- `AGENTS.md` — repo contract, owners, commands
- `ARCHITECTURE.md` — module layout, data flow
- `PRODUCT.md` — what this repo is and isn't
- `../standards/CONVENTIONS.md` — fleet-wide conventions
- `../standards/TOOLCHAIN.md` — tool inventory
