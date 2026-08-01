# GlitchTip — Self-Hosted Sentry-Compatible Error Tracking

[GlitchTip](https://glitchtip.com/) is an MIT-licensed, self-hosted error
tracking platform that speaks the Sentry protocol. The same `@sentry/*` npm
packages work with GlitchTip as the backend — just point the DSN at your
GlitchTip instance.

## Deploy

```bash
# From any [HOST-1] host that can reach the monitoring docker network:
docker compose -f infra/monitoring/glitchtip.yml up -d

# Check health:
curl http://localhost:8000/api/0/projects/
```

GlitchTip listens on port `8000`. Put it behind your nginx reverse proxy at
`https://glitchtip.rugmunch.io` to enable TLS.

### Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GLITCHTIP_SECRET_KEY` | Yes | `change-me-in-production` | Django secret key. Generate with `openssl rand -hex 32`. |
| `GLITCHTIP_DB_PASSWORD` | Yes | `change-me-in-production` | Postgres password for the `glitchtip` user. |
| `GLITCHTIP_DOMAIN` | Yes | — | Public URL for your GlitchTip instance (e.g. `https://glitchtip.rugmunch.io`). |
| `GMAIL_APP_PASSWORD` | Yes | — | Gmail app password for sending error alerts from `glitchtip@degenfeed.xyz`. |
| `ENABLE_USER_REGISTRATION` | No | `true` | Allow anyone to create an account. Disable after initial setup. |
| `DEFAULT_FROM_EMAIL` | No | `glitchtip@degenfeed.xyz` | From-address for notification emails. |

## Create a project and get your DSN

1. Open `https://glitchtip.rugmunch.io` in your browser.
2. Create an account (first user becomes admin).
3. Go to **Projects → Create Project**.
4. Choose **Cloudflare Worker** or **JavaScript** as the platform.
5. Copy the DSN — it looks like:
   ```
   https://<public-key>@glitchtip.rugmunch.io/<project-id>
   ```

## Set the DSN on the Cloudflare Worker

```bash
# From workers/api/
wrangler secret put GLITCHTIP_DSN
# Paste the DSN from GlitchTip when prompted.
```

The worker reads `env.GLITCHTIP_DSN` at runtime and passes it to the
`@sentry/cloudflare` SDK (or the included lightweight reporter at
`packages/utils/src/sentry.ts`).

### Update wrangler.toml

After setting the secret, update the `[vars]` section in
`workers/api/wrangler.toml`:

```toml
# Error tracking via GlitchTip (MIT, self-hosted Sentry-compatible)
SENTRY_DSN = ""
```

The `SENTRY_DSN` var must remain **empty** in the committed config — the
real DSN lives only as a Cloudflare secret. The `SENTRY_DSN` var is the
config key the existing code reads (see `workers/api/src/index.ts` and
`packages/utils/src/sentry.ts`). If you prefer a different secret name,
update the code accordingly.

## How GlitchTip is Sentry-compatible

- Same **DSN format**: `https://<key>@glitchtip.rugmunch.io/<id>`
- Same **Envelope API** (`POST /api/<id>/envelope/`)
- Same **`@sentry/*` npm packages** — just change the DSN host
- Existing code in `packages/utils/src/sentry.ts` uses the Sentry Envelope
  API directly and works with GlitchTip unchanged
- For Cloudflare Workers, `@sentry/cloudflare` points at GlitchTip with no
  code changes — only the DSN changes

**No code changes needed.** GlitchTip is a drop-in replacement. Deploy it,
create a project, paste the DSN as a secret, and error events route to your
own instance instead of sentry.io.
