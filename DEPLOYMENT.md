# Deployment

DegenFeed Web deploys to Cloudflare: a single Worker (`degenfeed-api`)
serves the API and the main `degenfeed.xyz` HTML routes, with the
Next.js app running on Cloudflare Pages (`degenfeed-web`). This doc
covers first-time setup and ongoing deploy workflow.

## First-time setup

### 1. Cloudflare account + zone

- Create a Cloudflare account.
- Add the `degenfeed.xyz` zone (if not already added).
- Note the **Account ID** and **Zone ID**.

### 2. Create KV namespaces

The worker uses two KV namespaces (`CACHE`, `SUBSCRIPTIONS`).
Create them once with the `preview` ID variant for PR previews:

```sh
cd workers/api
wrangler kv namespace create CACHE
wrangler kv namespace create CACHE --preview
wrangler kv namespace create SUBSCRIPTIONS
wrangler kv namespace create SUBSCRIPTIONS --preview
```

Copy the returned IDs into `workers/api/wrangler.toml`. The placeholders
`cache-namespace` / `subs-namespace` must be replaced before deploying,
otherwise the worker will fail to bind KV at startup.

### 3. Set secrets

Two secrets must exist on each environment (production + preview):

```sh
# Production
wrangler secret put AUTH_SECRET --env production
wrangler secret put GTS_CLIENT_SECRET --env production

# Preview
wrangler secret put AUTH_SECRET --env preview
wrangler secret put GTS_CLIENT_SECRET --env preview
```

`AUTH_SECRET` is a random 32-byte hex string used to HMAC-sign session
cookies. Generate one with:

```sh
openssl rand -hex 32
```

`GTS_CLIENT_SECRET` comes from the GotoSocial OAuth app configured at
`social.degenfeed.xyz/admin/oauth-apps`. It is used to exchange
authorization codes for access tokens.

Both secrets live only on the Cloudflare side — they are never
committed to git or printed in CI logs.

### 4. Set GitHub repository secrets

`Settings → Secrets and variables → Actions → New repository secret`:

| Name                     | Purpose                                     |
|--------------------------|---------------------------------------------|
| `CLOUDFLARE_API_TOKEN`   | Cloudflare API token with `Workers Scripts:Edit` and `Workers KV Storage:Edit` scopes. |
| `CLOUDFLARE_ACCOUNT_ID`  | 32-hex Cloudflare account id.               |

Create the API token at `dash.cloudflare.com → My Profile → API Tokens
→ Create Token → Edit Cloudflare Workers template`.

## Deploy workflow

Three GitHub Actions workflows exist:

| File                              | Triggers on              | What it does                          |
|-----------------------------------|--------------------------|---------------------------------------|
| `.github/workflows/ci.yml`        | Every push, every PR     | Lint + typecheck + test + build + gitleaks. |
| `.github/workflows/release.yml`   | Push to `main`           | Creates/updates release PRs via release-please. Merging a release PR creates a GitHub Release + git tag. |
| `.github/workflows/deploy.yml`    | PRs (preview), main push (production), tag push `v*` (production) | Deploys the worker to a Cloudflare environment. |

PRs get a `preview` environment with `--env preview`, which uses the
preview KV IDs and a relaxed rate limit. `main` and `v*` tag deploys to production
with the routes defined in `wrangler.toml` (currently
`degenfeed.xyz/api/*`, `app.degenfeed.xyz/api/*`, `degenfeed.xyz/*`).

### Semantic releases

Releases are managed by [release-please](https://github.com/googleapis/release-please-action):

1. **Conventional commits** on `main` trigger release-please to create or update a Release PR.
   - `feat:` bumps the minor version (or major if ≥ 1.0).
   - `fix:` bumps the patch version.
   - `feat!:` or `fix!:` (breaking) bumps the major version.
2. **Merge the Release PR** — this creates a GitHub Release and pushes a `v*` git tag.
3. **Tag push triggers production deploy** — `.github/workflows/deploy.yml` fires on `v*` tags,
   deploying the worker and web app to production.
4. **Version is displayed** in the web app footer (`v{version}`) via `NEXT_PUBLIC_APP_VERSION`
   environment variable, set during the build step.

The release config lives in `release-please-config.json` and `.release-please-manifest.json`.
The manifest starts at `0.1.0` (matching `package.json`).

## Local verification

Before pushing, verify locally with `wrangler dev`:

```sh
cd workers/api
# Local KV emulation requires --local (uses miniflare SQLite under .wrangler/)
wrangler dev --local
```

The dev server starts on `http://localhost:8787`. KV calls work against
the local SQLite-backed store. Hit a few endpoints:

```sh
curl http://localhost:8787/api/feed/health
curl -X POST http://localhost:8787/api/preferences \
  -H 'content-type: application/json' \
  -H 'origin: http://localhost:3000' \
  -d '{"hideLowQuality":true}'
```

Note: `AUTH_SECRET` is not set locally — session-protected routes will
return 401. To test them locally, set the secret via `.dev.vars`:

```sh
echo 'AUTH_SECRET=local-dev-secret-not-for-production-32-bytes' > workers/api/.dev.vars
echo 'GTS_CLIENT_SECRET=unused-locally' >> workers/api/.dev.vars
```

`wrangler dev` reads `.dev.vars` automatically.

## Adding the Next.js Pages deploy

`apps/web/wrangler.toml` is a stub. The full Cloudflare Pages deploy is
out of scope for this iteration (the landing HTML at `apps/landing/`
covers the `degenfeed.xyz` root today). When the Next.js app is ready
to ship, add a Pages job to `.github/workflows/deploy.yml`:

```yaml
pages:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with: { node-version: 22, cache: pnpm }
    - run: pnpm install --frozen-lockfile
    - run: pnpm --filter degenfeed-web build
    - uses: cloudflare/pages-action@v1
      with:
        apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        projectName: degenfeed-web
        directory: apps/web/.vercel/output/static
        gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

## Monitoring stack

Error tracking and infrastructure monitoring is deployed on Talos (netcup)
and Hydra (Contabo). See `infra/monitoring/` for compose files.

| Service | Where | Purpose |
|---------|-------|---------|
| **GlitchTip** | Talos `:8000` (glitchtip.rugmunch.io) | Sentry-compatible error tracking — catches Worker and client-side errors |
| **Grafana** | Hydra `:3001` | Dashboards for fleet health |
| **Prometheus** | Hydra `:9090` | Metrics storage (worker health, node resources) |
| **Node Exporter** | Hydra + Talos `:9100` | Host metrics (CPU, memory, disk) |

### GlitchTip (error tracking)

GlitchTip is an MIT-licensed Sentry-compatible backend. The same
`@sentry/*` packages work against it — just point the DSN at
`glitchtip.rugmunch.io`.

Deploy:
```bash
docker compose -f infra/monitoring/glitchtip.yml up -d
```

See `infra/monitoring/glitchtip-setup.md` for project setup and DSN
configuration.

The worker reads `env.SENTRY_DSN` at runtime (set via
`wrangler secret put SENTRY_DSN`). The lightweight reporter at
`packages/utils/src/sentry.ts` uses the standard Sentry Envelope API,
which GlitchTip handles natively — no code changes needed.

## Rollback

An automated rollback script is available at `scripts/deploy/rollback.sh`.
It rolls back both the Worker and Pages deployments, then runs a health
check.

```sh
# Rollback production (default)
./scripts/deploy/rollback.sh

# Rollback preview environment
./scripts/deploy/rollback.sh --env preview

# Dry-run — preview what would be rolled back without executing
./scripts/deploy/rollback.sh --dry-run

# Via Makefile
make rollback           # production
make rollback ARGS="--dry-run"
make rollback ARGS="--env preview"
```

The script performs three steps:

1. **Worker rollback** — runs `wrangler rollback` to revert `degenfeed-api`
   to the previous deployment.
2. **Pages rollback** — lists recent `degenfeed-web` Pages deployments via
   the Cloudflare API and rolls back to the second-most-recent deployment
   for the target branch.
3. **Health check** — curls the environment's `/api/health` endpoint with
   retries (3 attempts, 5s apart) and verifies HTTP 200.

### Manual rollback

Cloudflare keeps the previous 100 versions of every Worker. To roll back
manually:

```sh
# Worker
wrangler rollback --env production

# Pages (via API)
curl -X POST "https://api.cloudflare.com/client/v4/accounts/CF_ACCT_ID/pages/projects/degenfeed-web/deployments/DEPLOY_ID/rollback" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

Or via the Cloudflare dashboard: `Workers & Pages → degenfeed-api →
Deployments → Rollback`.
