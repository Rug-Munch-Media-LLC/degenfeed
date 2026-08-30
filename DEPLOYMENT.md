# DegenFeed Web — Deployment Guide

**Status:** canonical  
**Last updated:** 2026-08-30

> ## ⚠️ CURRENT TRUTH (2026-08-30) — read this first
>
> **Production is a systemd standalone service, NOT Cloudflare and NOT Docker Compose.**
>
> | Component | Mechanism | Endpoint |
> |---|---|---|
> | Web app (`apps/web`) | `degenfeed-web.service` — Next.js 16 standalone, runs from this repo's checkout (`apps/web/.next/standalone`) | 127.0.0.1:3100 |
> | Feed API (bridge) | `degenfeed-bridge.service` | :8787 |
> | TLS / routing | nginx (`deploy/nginx/*.conf` versioned here) → Cloudflare Tunnel | degenfeed.xyz / app.degenfeed.xyz |
>
> **Cloudflare Workers + Pages are RETIRED (2026-08-04).** The `workers/api`
> Worker and Pages frontend no longer serve production traffic; the app
> proxies bridge-owned `/api/feed*` routes to the bridge itself
> (`API_PROXY_TARGET`, default `http://localhost:8787`).
>
> **Deploy = update checkout → build → restart the unit** (automated by
> `.forgejo/workflows/deploy.yml` on push to main; requires `DEPLOY_HOST`,
> `DEPLOY_USER`, `DEPLOY_SSH_KEY` Forgejo secrets + passwordless sudo for
> `systemctl restart degenfeed-web`):
>
> ```bash
> cd /srv/work/repos/degenfeed-web
> git fetch origin main && git reset --hard origin/main
> pnpm install --frozen-lockfile
> pnpm --filter degenfeed build
> sudo systemctl restart degenfeed-web   # ExecStartPre re-links public/ + .next/static
> curl -sf http://127.0.0.1:3100/api/health
> ```
>
> The Cloudflare Workers/Pages sections below are **historical reference
> only** — kept for the KV/secrets inventory and in case the edge path is
> ever re-activated. Do not follow them for current deploys.

This doc covers deploying the full DegenFeed stack: Cloudflare Workers + Pages frontend, self-hosted infrastructure (GoToSocial, AT Protocol PDS, PeerTube, Prosody XMPP, Redlib, RSS-Bridge, Matrix), and smart contracts (Base + Solana). 44+ protocols, 48+ Docker services, ~500+ API routes.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Cloudflare Account Setup](#1-cloudflare-account--zone)
3. [KV Namespaces](#2-create-kv-namespaces)
4. [Secrets & Variables](#3-set-secrets)
5. [GitHub Actions Secrets](#4-set-github-repository-secrets)
6. [Deploy Workflow](#deploy-workflow)
7. [Frontend Deployment](#frontend-deployment)
8. [Smart Contract Deployment](#smart-contract-deployment)
9. [Self-Hosted Infrastructure](#self-hosted-infrastructure)
10. [Monitoring](#monitoring-stack)
11. [Health Checks](#health-checks)
12. [Rollback](#rollback)
13. [Environment Variables Reference](#environment-variables-reference)

---

## Architecture Overview

```
Internet
   │
   ├── app.degenfeed.xyz ───── Next.js 16 (Cloudflare Pages)
   ├── degenfeed.xyz ────────── Landing page (Cloudflare Worker)
   ├── degenfeed.xyz/api/* ──── Hono API (Cloudflare Worker)
   │
   ├── social.degenfeed.xyz ─── GoToSocial (Docker, [HOST-1])
   ├── pds.degenfeed.xyz ────── AT Protocol PDS (Docker, [HOST-1])
   ├── video.degenfeed.xyz ──── PeerTube (Docker, [HOST-1])
   ├── redlib.degenfeed.xyz ─── Redlib (Docker, [HOST-1])
   ├── rss-bridge.degenfeed.xyz RSS-Bridge (Docker, [HOST-1])
   └── chat.degenfeed.xyz ───── Prosody XMPP (Docker, [HOST-1])
```

| Component | Target | URL |
|-----------|--------|-----|
| Landing page | Cloudflare Worker | `https://degenfeed.xyz` |
| Web client | Cloudflare Pages | `https://app.degenfeed.xyz` |
| Edge API | Cloudflare Worker `degenfeed-api` | `https://degenfeed.xyz/api/*` |
| Social server | GoToSocial (Docker, [HOST-1]) | `https://social.degenfeed.xyz` |
| Video + Livestreams | PeerTube (Docker, [HOST-1]) | `https://video.degenfeed.xyz` |
| AT Protocol PDS | Bluesky PDS (Docker, [HOST-1]) | `https://pds.degenfeed.xyz` |
| XMPP Chat | Prosody (Docker, [HOST-1]) | `chat.degenfeed.xyz` |
| Feed Proxy | Redlib (Docker, [HOST-1]) | `https://redlib.degenfeed.xyz` |
| RSS Proxy | RSS-Bridge (Docker, [HOST-1]) | `https://rss-bridge.degenfeed.xyz` |

---

## 1. Cloudflare Account + Zone

1. Create a Cloudflare account.
2. Add the `degenfeed.xyz` zone.
3. Note the **Account ID** and **Zone ID** (from the Cloudflare dashboard right rail).
4. Update `zone_id` in `workers/api/wrangler.toml` routes:

```toml
routes = [
  { pattern = "degenfeed.xyz/api/*", zone_id = "116a9676c3358def6796910ccb96f1fc" },
  { pattern = "app.degenfeed.xyz/api/*", zone_id = "116a9676c3358def6796910ccb96f1fc" },
]
```

---

## 2. Create KV Namespaces

The worker uses KV for caching, subscriptions, identities, API keys, content store, creator coins, and more.

### Production

```bash
cd workers/api

wrangler kv:namespace create CACHE
wrangler kv:namespace create SUBSCRIPTIONS
wrangler kv:namespace create DEPLOYMENTS
wrangler kv:namespace create BOOKMARKS
wrangler kv:namespace create API_KEYS
wrangler kv:namespace create PERMANENCE
wrangler kv:namespace create GOVERNANCE
wrangler kv:namespace create IDENTITIES
wrangler kv:namespace create COMMUNITIES
wrangler kv:namespace create REPORTS
wrangler kv:namespace create SPACES
wrangler kv:namespace create REPUTATION
wrangler kv:namespace create CUSTOM_FEEDS
wrangler kv:namespace create CONTENT_STORE
wrangler kv:namespace create FARCASTER_COINS
wrangler kv:namespace create LENS_COINS
wrangler kv:namespace create XCHAIN_REGISTRY
wrangler kv:namespace create PLATFORM_ACCOUNTS
wrangler kv:namespace create BLUESKY_INVITE_POOL
```

### Preview

```bash
wrangler kv:namespace create CACHE --preview
wrangler kv:namespace create SUBSCRIPTIONS --preview
# ... repeat for all namespaces with --preview
```

Copy the returned IDs into `workers/api/wrangler.toml` under each `[[kv_namespaces]]` block. The placeholder empty strings must be replaced before deploying.

---

## 3. Set Secrets

Secrets are set via `wrangler secret put` and never committed to git.

### Required

```bash
# Session signing (32 bytes hex)
openssl rand -hex 32
wrangler secret put AUTH_SECRET

# GoToSocial OAuth client secret
wrangler secret put GTS_CLIENT_SECRET

# Comma-separated admin wallet addresses
wrangler secret put ADMIN_WALLETS
```

### Push Notifications

```bash
# VAPID keys (generate once)
npx web-push generate-vapid-keys
# → Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY as vars (not secrets)
# → Set VAPID_SUBJECT as var

# Scoped API keys
wrangler secret put PUSH_API_KEY
wrangler secret put NEWSLETTER_API_KEY
```

### OAuth Providers

```bash
wrangler secret put PEERTUBE_CLIENT_SECRET
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put THREADS_APP_SECRET
wrangler secret put REDDIT_CLIENT_SECRET
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put DISCORD_CLIENT_SECRET
wrangler secret put TWITTER_CLIENT_SECRET
```

### Creator Coins & Cross-Chain

```bash
wrangler secret put PREMIUM_WALLET_KEY
wrangler secret put FARCASTER_BOT_FID
wrangler secret put FARCASTER_BOT_SIGNER_KEY
wrangler secret put NOSTR_PRIVATE_KEY
wrangler secret put PINATA_API_KEY
wrangler secret put PINATA_SECRET_KEY
```

### Email & Search

```bash
wrangler secret put POSTMARK_SERVER_TOKEN
wrangler secret put MEILI_SEARCH_KEY
```

### Infrastructure

```bash
wrangler secret put SENTRY_DSN         # GlitchTip DSN
wrangler secret put RMI_API_KEY        # rmi-backend auth
wrangler secret put POSTIZ_API_KEY     # Postiz cross-posting
```

---

## 4. Set GitHub Repository Secrets

`Settings → Secrets and variables → Actions → New repository secret`:

| Name | Purpose |
|------|---------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with `Workers Scripts:Edit` and `Workers KV Storage:Edit` scopes. |
| `CLOUDFLARE_ACCOUNT_ID` | 32-hex Cloudflare account ID. |

Create the API token at `dash.cloudflare.com → My Profile → API Tokens → Create Token → Edit Cloudflare Workers template`.

---

## Deploy Workflow

Three GitHub Actions workflows manage deployments:

| File | Triggers on | What it does |
|------|-------------|--------------|
| `.github/workflows/ci.yml` | Every push, every PR | Lint + typecheck + test + build + gitleaks |
| `.github/workflows/release.yml` | Push to `main` | Creates/updates release PRs via release-please |
| `.github/workflows/deploy.yml` | PRs, main push, tag push | Deploys worker (preview/production) + Pages |

- **PRs** → preview environment (`--env preview`) with separate KV IDs and relaxed rate limits
- **`main`** → production worker deploy
- **`v*` tags** → production worker + Pages deploy

### Semantic Releases

1. Conventional commits on `main` trigger release-please.
   - `feat:` → minor bump
   - `fix:` → patch bump
   - `feat!:` or `fix!:` → major bump
2. Merge the Release PR → creates GitHub Release + `v*` tag.
3. Tag push triggers production deploy.

---

## Frontend Deployment

The Next.js app deploys to Cloudflare Pages via `@cloudflare/next-on-pages`.

### Pages project setup

```bash
# Create the Pages project (one-time)
npx wrangler pages project create degenfeed --production-branch main
```

### Build output

The app is built at `apps/web/.vercel/output/static` and deployed by `.github/workflows/deploy.yml`.

### Environment variables for the frontend

Set these in the Cloudflare Pages dashboard or via `wrangler pages secret put`:

| Variable | Source | Description |
|----------|--------|-------------|
| `NEXT_PUBLIC_API_URL` | Pages var | Worker API base URL |
| `NEXT_PUBLIC_APP_VERSION` | Build arg | Displayed in footer |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Pages var | Web Push public key |
| `AUTH_SECRET` | Pages secret | Session signing (same as worker) |
| `ADMIN_WALLETS` | Pages secret | Admin wallet addresses |

---

## Smart Contract Deployment

### Base (Farcaster Creator Coins)

Contracts in `packages/tip-contract/src/`:

```bash
cd packages/tip-contract

# Deploy DegenFeedCoin implementation
forge create --rpc-url "$BASE_RPC_URL" --private-key "$DEPLOYER_KEY" src/DegenFeedCoin.sol:DegenFeedCoin

# Deploy DegenFeedFactory
forge create --rpc-url "$BASE_RPC_URL" --private-key "$DEPLOYER_KEY" src/DegenFeedFactory.sol:DegenFeedFactory \
  --constructor-args "$IMPLEMENTATION_ADDRESS" "$ZORA_WRAPPER_FACTORY" "$WORMHOLE_BRIDGE"

# Deploy CrossChainRegistry
forge create --rpc-url "$BASE_RPC_URL" --private-key "$DEPLOYER_KEY" src/CrossChainRegistry.sol:CrossChainRegistry
```

### Solana (Creator Token Program)

Using Anchor:

```bash
cd packages/tip-contract/anchor

anchor build
anchor deploy --provider.cluster mainnet

# Set SOLANA_PROGRAM_ID env var to the deployed program ID
```

### Environment for Contract Deployments

```bash
export BASE_RPC_URL="https://mainnet.base.org"
export BASE_SEPOLIA_RPC="https://sepolia.base.org"
export DEPLOYER_KEY="0x..."  # Private key with ETH for gas
export ZORA_WRAPPER_FACTORY="0x..."  # See: https://docs.zora.co/docs/smart-wallet/wrapper-factory
export WORMHOLE_BRIDGE="0x..."  # See: https://wormhole.com/docs/reference/contract-addresses/
export SOLANA_RPC_URL="https://api.mainnet-beta.solana.com"
```

### Verification

```bash
# Verify on BaseScan
forge verify-contract --chain-id 8453 --etherscan-api-key "$BASESCAN_KEY" \
  --compiler-version v0.8.28 $FACTORY_ADDRESS src/DegenFeedFactory.sol:DegenFeedFactory

# Verify on Solana (Anchor)
anchor verify $PROGRAM_ID --provider.cluster mainnet
```

---

## Self-Hosted Infrastructure

All services run as Docker containers on [HOST-1] (netcup). See `infra/` for compose files.

### GoToSocial (ActivityPub)

```yaml
# docker-compose.gotosocial.yml — see infra/
services:
  gotosocial:
    image: superseriousbusiness/gotosocial:latest
    ports:
      - "8080:8080"
    volumes:
      - /path/to/degenfeed/gotosocial:/gotosocial/storage
    environment:
      GTS_HOST: social.degenfeed.xyz
      GTS_PORT: 8080
      GTS_PROTOCOL: https
      GTS_DB_TYPE: sqlite
```

Configuration: Create OAuth app at `social.degenfeed.xyz/admin/oauth-apps` → set `GTS_CLIENT_ID` and `GTS_CLIENT_SECRET`.

### AT Protocol PDS (Bluesky)

```yaml
# infra/pds/docker-compose.yml
services:
  pds:
    image: ghcr.io/bluesky-social/pds:latest
    ports:
      - "2583:2583"
    environment:
      PDS_HOST: pds.degenfeed.xyz
      PDS_JWT_SECRET: "<generate: openssl rand -hex 32>"
      PDS_ADMIN_PASSWORD: "<generate strong password>"
      PDS_PLC_ROTATION_KEY: "<generate: openssl ecparam -name secp256k1 -genkey -noout>"
      PDS_DATA_DIRECTORY: /pds/data
      PDS_BLOBSTORE: disk
      PDS_DID_PLC_URL: https://plc.directory
      PDS_BSKY_APP_VIEW_URL: https://api.bsky.app
      PDS_REPORT_VIEW_URL: https://mod.bsky.app
    volumes:
      - /path/to/degenfeed/pds:/pds/data
```

### PeerTube (Video + Livestreaming)

```yaml
# infra/peertube/docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: peertube_prod
      POSTGRES_USER: peertube
      POSTGRES_PASSWORD: "<secure password>"
  redis:
    image: redis:7
  peertube:
    image: chocobozzz/peertube:production-bullseye
    ports:
      - "9000:9000"
    environment:
      PEERTUBE_WEBSERVER_HOSTNAME: video.degenfeed.xyz
      PEERTUBE_DB_HOSTNAME: postgres
      PEERTUBE_DB_USER: peertube
      PEERTUBE_DB_PASSWORD: "<secure password>"
      PEERTUBE_DB_SUFFIX: _prod
      PEERTUBE_REDIS_HOSTNAME: redis
      PEERTUBE_ADMIN_EMAIL: admin@degenfeed.xyz
      PEERTUBE_SIGNUP_ENABLED: "true"
      PEERTUBE_SIGNUP_LIMIT: 100
    volumes:
      - /path/to/degenfeed/peertube/data:/data
      - /path/to/degenfeed/peertube/config:/config
```

After deployment:
1. Create OAuth2 client at `video.degenfeed.xyz/account/settings/applications`
2. Set `PEERTUBE_CLIENT_ID` and `PEERTUBE_CLIENT_SECRET` as worker vars/secrets

### Prosody XMPP (PeerTube Chat)

```bash
docker run -d --name prosody \
  -p 5280:5280 \
  -e DOMAIN=chat.degenfeed.xyz \
  -e ADMIN_EMAIL=admin@degenfeed.xyz \
  prosody/prosody
```

### Redlib (Reddit Proxy)

```bash
docker run -d --name redlib \
  -p 8080:8080 \
  -e REDLIB_DEFAULT_THEME=dark \
  -e REDLIB_DEFAULT_WIDE=true \
  quay.io/redlib/redlib
```

### RSS-Bridge

```bash
docker run -d --name rss-bridge \
  -p 8080:8080 \
  -e ENABLE_CACHE=true \
  -e CACHE_TYPE=sqlite \
  nixshell/rss-bridge:latest
```

---

## Monitoring Stack

Error tracking and infrastructure monitoring is deployed on [HOST-1] and [HOST-2]. See `infra/monitoring/` for compose files.

| Service | Where | Purpose |
|---------|-------|---------|
| **GlitchTip** | [HOST-1] (glitchtip.rugmunch.io) | Sentry-compatible error tracking |
| **Grafana** | [HOST-2] | Dashboards for fleet health |
| **Prometheus** | [HOST-2] | Metrics storage |
| **Node Exporter** | [HOST-2] + [HOST-1] | Host metrics (CPU, memory, disk) |

### GlitchTip Setup

```bash
docker compose -f infra/monitoring/glitchtip.yml up -d
```

Configure projects: create a project for `degenfeed-api` and `degenfeed`, then set the DSN:

```bash
wrangler secret put SENTRY_DSN
# DSN format: https://<public_key>@glitchtip.rugmunch.io/<project_id>
```

---

## Health Checks

### Worker Health

```bash
# Basic health
curl https://degenfeed.xyz/api/health

# Worker info
curl https://degenfeed.xyz/api/health/worker

# If you need to look at a route:
curl -v https://degenfeed.xyz/api/feed/health
```

### Infrastructure Health

```bash
# GoToSocial
curl -I https://social.degenfeed.xyz/api/v1/instance

# PeerTube
curl -I https://video.degenfeed.xyz/api/v1/overviews/videos

# AT Protocol PDS
curl -I https://pds.degenfeed.xyz/xrpc/_health

# Redlib
curl -I https://redlib.degenfeed.xyz

# RSS-Bridge
curl -I https://rss-bridge.degenfeed.xyz
```

### Smart Contract Health

```bash
# Check if factory is live
cast call $FACTORY_ADDRESS "totalSupply()(uint256)" --rpc-url "$BASE_RPC_URL"

# Check CrossChainRegistry
cast call $REGISTRY_ADDRESS "getRegisteredChains()(bytes32[])" --rpc-url "$BASE_RPC_URL"
```

---

## Rollback

```bash
# Automated rollback (worker + pages)
./scripts/deploy/rollback.sh

# Rollback preview
./scripts/deploy/rollback.sh --env preview

# Dry run
./scripts/deploy/rollback.sh --dry-run

# Via Makefile
make rollback
make rollback ARGS="--env preview"
```

### Manual Rollback

```bash
# Worker
wrangler rollback --env production

# Pages (via Cloudflare API)
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$CF_ACCT_ID/pages/projects/degenfeed/deployments/$DEPLOY_ID/rollback" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

---

## Environment Variables Reference

### Worker `[vars]` (Non-Secret Config)

Set in `workers/api/wrangler.toml` under `[vars]`:

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLOWED_ORIGINS` | `"https://degenfeed.xyz,https://app.degenfeed.xyz,..."` | CORS origins |
| `GTS_CLIENT_ID` | — | GoToSocial OAuth client ID |
| `GTS_INSTANCE_URL` | `"https://social.degenfeed.xyz"` | GoToSocial instance URL |
| `GTS_API_BASE` | `"https://social.degenfeed.xyz"` | GoToSocial API base |
| `GTS_REDIRECT_URI` | `"https://app.degenfeed.xyz/auth/callback"` | OAuth redirect |
| `RELAY_URLS` | — | Comma-separated Nostr relays |
| `FARCASTER_HUB_URL` | `"https://hub.farcaster.standardcrypto.vc:2281"` | Farcaster Hub |
| `LENS_API_URL` | `"https://api-v2.lens.dev/graphql"` | Lens GraphQL API |
| `BSKY_PUBLIC_URL` | `"https://public.api.bsky.app"` | Bluesky public API |
| `BSKY_SOCIAL_URL` | `"https://bsky.social"` | Bluesky social API |
| `THREADS_PDS_URL` | `"https://public.threads.net"` | Threads PDS |
| `THREADS_APP_ID` | — | Meta app ID |
| `FARCASTER_CLIENT_ID` | — | Warpcast OAuth client ID |
| `REDDIT_CLIENT_ID` | — | Reddit OAuth client ID |
| `GOOGLE_CLIENT_ID` | — | Google OAuth client ID |
| `GITHUB_CLIENT_ID` | — | GitHub OAuth client ID |
| `DISCORD_CLIENT_ID` | — | Discord OAuth client ID |
| `TWITTER_CLIENT_ID` | — | Twitter/X OAuth client ID |
| `TELEGRAM_BOT_NAME` | — | Telegram bot username |
| `PEERTUBE_INSTANCE_URL` | `"https://video.degenfeed.xyz"` | PeerTube base URL |
| `PEERTUBE_CLIENT_ID` | — | PeerTube OAuth client ID |
| `BASE_RPC_URL` | `"https://mainnet.base.org"` | Base chain RPC |
| `POLYGON_RPC_URL` | `"https://polygon-rpc.com"` | Polygon chain RPC |
| `ZORA_WRAPPER_FACTORY` | `"0x0000...0000"` | Zora wrapper factory address |
| `WORMHOLE_BRIDGE` | — | Wormhole bridge address |
| `MASTODON_INSTANCE_URL` | `"https://social.degenfeed.xyz"` | Mastodon instance for signup |
| `REDLIB_URL` | `"https://redlib.degenfeed.xyz"` | Redlib proxy |
| `RSS_BRIDGE_URL` | `"https://rss-bridge.degenfeed.xyz"` | RSS-Bridge proxy |
| `FLARESOLVERR_URL` | `"http://<internal-ip>:<port>"` | FlareSolverr endpoint |
| `RMI_BACKEND_URL` | `"http://<internal-ip>:8000"` | RMI backend for token risk data |
| `POSTIZ_BASE_URL` | `"http://127.0.0.1:3105"` | Postiz API base |
| `POSTIZ_INTEGRATIONS` | — | JSON-encoded platform→integration ID map |
| `ALLOW_DEV_OAUTH` | `"false"` | Allow all OAuth in dev |
| `FEATURE_FLAGS_DEFAULT` | `"reply-composer,..."` | Default-enabled feature flags |
| `RATE_WINDOW_MS` | `"5000"` | Rate limit window (ms) |
| `RATE_MAX_REQ` | `"60"` | Rate limit max requests |
| `RATE_LIMIT_DISABLED` | `"false"` | Disable rate limiting (dev only) |
| `VAPID_SUBJECT` | — | Web Push subject |
| `VAPID_PUBLIC_KEY` | — | Web Push public key |
| `BSKY_DID` | — | Bluesky DID for posting |
| `YOUTUBE_API_KEY` | — | YouTube Data API key |
| `NOSTR_PRIVATE_KEY` | — | Nostr private key for publishing |

### Worker Secrets (Set via `wrangler secret put`)

| Variable | Description |
|----------|-------------|
| `AUTH_SECRET` | HMAC-SHA256 session signing key (32 bytes hex) |
| `GTS_CLIENT_SECRET` | GoToSocial OAuth client secret |
| `ADMIN_WALLETS` | Comma-separated admin wallet addresses |
| `PEERTUBE_CLIENT_SECRET` | PeerTube OAuth client secret |
| `TELEGRAM_BOT_TOKEN` | Telegram bot API token |
| `NOSTR_PRIVATE_KEY` | Nostr private key hex |
| `FARCASTER_BOT_FID` | Farcaster bot FID for Hubble |
| `PINATA_API_KEY` | Pinata IPFS API key |
| `PINATA_SECRET_KEY` | Pinata IPFS secret key |
| `PREMIUM_WALLET_KEY` | Private key for registration fee payments |
| `POSTMARK_SERVER_TOKEN` | Postmark transactional email token |
| `MEILI_SEARCH_KEY` | MeiliSearch API key |
| `RMI_API_KEY` | rmi-backend bearer token |
| `SENTRY_DSN` | GlitchTip/Sentry DSN |
| `THREADS_APP_SECRET` | Meta Threads app secret |
| `REDDIT_CLIENT_SECRET` | Reddit OAuth client secret |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret |
| `DISCORD_CLIENT_SECRET` | Discord OAuth client secret |
| `TWITTER_CLIENT_SECRET` | Twitter/X OAuth client secret |
| `VAPID_PRIVATE_KEY` | Web Push VAPID private key |
| `POSTIZ_API_KEY` | Postiz API key |
| `PUSH_API_KEY` | Scoped API key for push notification sending |
| `NEWSLETTER_API_KEY` | Scoped API key for newsletter admin |

### Frontend `NEXT_PUBLIC_*` Variables

Set in Cloudflare Pages dashboard or `.env.local` for dev:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Worker API base URL |
| `NEXT_PUBLIC_WORKER_API_URL` | Alternative worker URL |
| `NEXT_PUBLIC_WORKER_URL` | Worker base URL |
| `NEXT_PUBLIC_API_BASE` | API base for proxied routes |
| `NEXT_PUBLIC_APP_VERSION` | Displayed in footer |
| `NEXT_PUBLIC_ADMIN_WALLETS` | Comma-separated admin wallets (browser) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push VAPID public key |

---

## Local Development Verification

```bash
cd workers/api
wrangler dev --local
```

The dev server starts on `http://localhost:8787`. KV calls work against local SQLite.

```bash
curl http://localhost:8787/api/feed/health
```

For authenticated routes, create `.dev.vars`:

```bash
echo 'AUTH_SECRET=local-dev-secret-not-for-production-32-bytes' > workers/api/.dev.vars
echo 'GTS_CLIENT_SECRET=unused-locally' >> workers/api/.dev.vars
```
