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

Two GitHub Actions workflows exist:

| File                              | Triggers on              | What it does                          |
|-----------------------------------|--------------------------|---------------------------------------|
| `.github/workflows/ci.yml`        | Every push, every PR     | Lint + typecheck + test + build + gitleaks. |
| `.github/workflows/deploy.yml`    | PRs (preview) + main push (production) | Deploys the worker to a Cloudflare environment. |

PRs get a `preview` environment with `--env preview`, which uses the
preview KV IDs and a relaxed rate limit. `main` deploys to production
with the routes defined in `wrangler.toml` (currently
`degenfeed.xyz/api/*`, `app.degenfeed.xyz/api/*`, `degenfeed.xyz/*`).

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

## Rollback

Cloudflare keeps the previous 100 versions of every Worker. To roll
back:

```sh
wrangler rollback --env production
```

Or via the Cloudflare dashboard: `Workers & Pages → degenfeed-api →
Deployments → Rollback`.