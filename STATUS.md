# DegenFeed Web — Status

> Last updated: 2026-08-30

## One-Paragraph Truth

The DegenFeed Next.js app (`apps/web`) **IS live in production** at
`degenfeed.xyz` / `app.degenfeed.xyz`, served by the systemd unit
`degenfeed-web.service` (Next.js 16 standalone output from this repo's
checkout, 127.0.0.1:3100) behind nginx + Cloudflare Tunnel. The feed API is
the bridge (`degenfeed-bridge.service`, :8787). **Cloudflare Workers/Pages
are RETIRED (2026-08-04)** — `workers/api` remains in the monorepo as code +
the node-server fallback (`src/serve.ts`), but no edge deployment serves
traffic. Docker Compose is a self-hosting option, not the production path.

## Production Topology (verified 2026-08-30)

| Component | Mechanism | Endpoint |
|---|---|---|
| Web app | `degenfeed-web.service` (Next.js standalone) | 127.0.0.1:3100 |
| Feed API | `degenfeed-bridge.service` | :8787 |
| Auth sidecar | better-auth sidecar | 127.0.0.1:3011 |
| TLS/routing | nginx (`deploy/nginx/`) → Cloudflare Tunnel | degenfeed.xyz, app.degenfeed.xyz, social.degenfeed.xyz |
| Aux services | `degenfeed-aux.service` (MeiliSearch, Redlib, RSS-Bridge) | various |

Deploy: `.forgejo/workflows/deploy.yml` (push to main → SSH → git reset →
`pnpm install --frozen-lockfile` → build → `systemctl restart
degenfeed-web` → health check). See DEPLOYMENT.md.

## CI/CD State (fixed 2026-08-30)

- **Runner label fixed**: the Forgejo runner only registers `docker-x64`
  (node:22-bookworm-slim, host network). All jobs previously declared
  `runs-on: ubuntu-latest` → queued forever (54/60 pushes cancelled). All
  `.forgejo/workflows/*` jobs now run on `docker-x64`.
- **Duplicate tree removed**: `.github/workflows/` deleted (Forgejo read both
  trees; identical concurrency groups caused mutual cancellation).
- **Deploy workflow rewritten**: nonexistent `docker/build-and-push-action@v6`
  + `docker compose pull web` (nothing consumed the ghcr image) replaced with
  the systemd deploy path.
- **Gates de-cosmeticized**: `pnpm audit` now runs with `pipefail` (the
  `| tee` previously masked the exit code); duplicate `smoke:` YAML key
  removed; fake gates removed (`contract`/`fuzz` invoked nonexistent scripts;
  `visual-regression` was double-continue-on-error with no baselines);
  `sign-image` removed (docker-push path dead); Trivy converted to filesystem
  scan (no Docker daemon in runner); workers `build` is a real
  `wrangler deploy --dry-run` (was a literal `echo`); coverage gate is
  vitest's own thresholds (redundant `nyc` step removed).
- **Known temporary**: `e2e` + `a11y` jobs are `continue-on-error` until
  `playwright.config.ts` stops hardcoding webServer port 3000 (collides with
  Forgejo on the runner's host network). One-line fix, apps/web owners.

## Known Open Items (owned elsewhere — see TODO.md)

- `apps/web/Dockerfile:22` uses `pnpm install --no-frozen-lockfile` (builds
  can drift from `pnpm-lock.yaml`).
- `workers/api/wrangler.toml:202` still carries the literal
  `POSTIZ_API_KEY = "${POSTIZ_API_KEY}"` var; `pnpm --filter @degenfeed/api-worker
  deploy` now overrides it from the environment, but the toml should move the
  secret out of `[vars]` entirely.
- `playwright.config.ts` webServer port (see above).
- Live nginx re-point for `app.degenfeed.xyz` / `api.degenfeed.xyz` /
  `social.degenfeed.xyz` from `deploy/nginx/` (lead follow-up).

## Historical

Session-by-session round logs (Rounds ≤31, incl. the 2026-07-27 "never
deployed" audit — superseded by this file) live in git history
(`git log -- STATUS.md`) and docs/.
