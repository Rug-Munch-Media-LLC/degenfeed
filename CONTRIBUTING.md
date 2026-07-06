<!--
SPDX-License-Identifier: MIT
Copyright (c) 2026 Rug Munch Media LLC
Part of DegenFeed Web — https://git.rugmunch.io/RugMunchMedia/degenfeed-web
-->

# Contributing to DegenFeed Web

> Next.js multi-protocol social aggregator client. TypeScript + Next.js 14 + React 19.

## TL;DR

```bash
git checkout main && git pull --rebase origin main
git checkout -b feat/my-change
# …make changes…
pnpm install
pnpm lint typecheck test     # pre-push gate
git add -A
git commit -m "feat(web): my change"
git push origin feat/my-change
# Open a PR on Forgejo (git.rugmunch.io/RugMunchMedia/degenfeed-web)
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
| `refactor/<scope>` | Code restructure, no behavior change.           |
| `docs/<scope>`     | Documentation only.                              |

### Commit Convention

We use **Conventional Commits**.

```bash
feat(web): add composer modal
fix(adapter-nostr): handle malformed event
docs: update ARCHITECTURE.md
chore(deps): bump wagmi to 3.7
```

Allowed types: `feat`, `fix`, `docs`, `refactor`, `style`, `test`, `chore`,
`ops`, `security`, `ci`, `build`, `perf`, `revert`.

## Remotes

| Remote      | URL                                                              | Role                          |
|-------------|------------------------------------------------------------------|-------------------------------|
| `origin`    | `ssh://git@git.rugmunch.io:2222/RugMunchMedia/degenfeed-web.git` | Canonical — Forgejo.          |
| `external-*`| codeberg / github / gitlab (read-only mirrors)                   | Optional community mirrors.   |

## Pre-Push Checklist

Before pushing any branch:

```bash
pnpm lint           # biome check
pnpm typecheck      # tsc --noEmit
pnpm test           # turbo run test
pnpm build          # production build sanity
```

CI is defined in `.forgejo/workflows/ci.yml`.

## Code Style

- TypeScript 5.5+ with `strict: true`
- Biome for format + lint (no ESLint, no Prettier)
- Functional components, hooks, no class components
- One component per file
- No file > 500 lines (see `STANDARDS.md`)

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