# Self-Hosting DegenFeed

Run your own DegenFeed instance on any Linux server. Own your domain, your content,
your creator coin, your data. We provide the software — you own everything.

## Quick Start (5 minutes)

```bash
# One-line deploy
bash <(curl -sSL https://raw.githubusercontent.com/RugMunchMedia/degenfeed/main/deploy/deploy.sh)
```

Or if you already have the repo:

```bash
cd deploy
chmod +x deploy.sh
./deploy.sh
```

That's it. You'll be prompted for your domain, wallet address, and email.
Everything else is automatic.

### What you get after deployment

| URL | What |
|-----|------|
| `https://yourdomain.com` | DegenFeed profile + content hub |
| `https://yourdomain.com/articles` | Ghost blog |
| `https://yourdomain.com/articles/ghost` | Blog admin |
| `https://yourdomain.com/coin` | Creator coin page |
| `https://yourdomain.com/live` | Live streams |
| `@you@yourdomain.com` | ActivityPub handle |

---

## Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Deployment Methods](#deployment-methods)
  - [Docker (Recommended)](#1-docker-recommended)
  - [Railway](#2-railway)
  - [Vercel](#3-vercel)
  - [Coolify](#4-coolify)
- [Configuration Guide](#configuration-guide)
- [SSL Setup](#ssl-setup)
- [Backup Guide](#backup-guide)
- [Update Guide](#update-guide)
- [White-Label & Branding](#white-label--branding)
- [Troubleshooting](#troubleshooting)

---

## Architecture

```
                           ┌─────────────┐
                           │   Internet   │
                           └──────┬──────┘
                                  │ :443
                            ┌─────┴─────┐
                            │   nginx    │  ← TLS termination
                            │ (Reverse   │     (Let's Encrypt or Cloudflare)
                            │  Proxy)    │
                            └──┬───┬───┬──┘
                               │   │   │
                      ┌────────┘   │   └────────┐
                      │            │            │
               ┌──────┴─────┐ ┌───┴────┐ ┌─────┴──────┐
               │  DegenFeed │ │  Ghost │ │ GoToSocial │
               │  (Next.js) │ │ (Blog) │ │ (Activity- │
               │  :3000     │ │ :2368  │ │  Pub) :8080│
               └──────┬─────┘ └────────┘ └────────────┘
                      │
               ┌──────┴─────┐
               │   Redis    │
               │  (Cache)   │
               └────────────┘
```

### Service breakdown

| Service | Image | Purpose | Port |
|---------|-------|---------|------|
| `nginx` | `nginx:1.27-alpine` | Reverse proxy, TLS, routing | 80/443 |
| `degenfeed` | `ghcr.io/rugmunchmedia/degenfeed` | Main Next.js app | 3000 |
| `ghost` | `ghost:5-alpine` | Blogging platform | 2368 |
| `gotosocial` | `superseriousbusiness/gotosocial` | ActivityPub/fediverse | 8080 |
| `redis` | `redis:7-alpine` | Caching + job queues | 6379 |

### Data directories

| Directory | Contents | Backup Priority |
|-----------|----------|-----------------|
| `data/degenfeed/` | User data, settings, uploaded media | ⭐⭐⭐ |
| `data/ghost/` | Blog content, images, SQLite DB | ⭐⭐⭐ |
| `data/gotosocial/` | Fediverse data, media, database | ⭐⭐⭐ |
| `data/redis/` | Cache (rebuildable) | ⭐ |
| `data/nginx/` | TLS certs, logs | ⭐⭐ |
| `articles/` | Published articles (static) | ⭐⭐ |

---

## Prerequisites

### Minimum requirements

| Resource | Requirement |
|----------|-------------|
| **CPU** | 1 vCPU |
| **RAM** | 2 GB |
| **Storage** | 20 GB SSD |
| **OS** | Ubuntu 22.04+, Debian 12+, or any Linux with Docker |
| **Docker** | Docker Engine 24+ with Compose v2 |
| **Domain** | DNS A record pointing to your server IP |

### Recommended specs

| Resource | Recommendation |
|----------|---------------|
| **CPU** | 2 vCPU |
| **RAM** | 4 GB |
| **Storage** | 50 GB SSD |
| **Bandwidth** | 2 TB/month |

### VPS providers

| Provider | Starting Price | Notes |
|----------|---------------|-------|
| [Hetzner Cloud](https://hetzner.cloud) | €4/mo | Best value |
| [Digital Ocean](https://digitalocean.com) | $6/mo | Simple setup |
| [Vultr](https://vultr.com) | $6/mo | Global locations |
| [Oracle Cloud](https://oracle.com/cloud/free) | Free | Always-free tier (4 ARM cores, 24GB) |

---

## Deployment Methods

### 1. Docker (Recommended)

#### Interactive installer

```bash
bash <(curl -sSL https://raw.githubusercontent.com/RugMunchMedia/degenfeed/main/deploy/deploy.sh)
```

#### Automated (non-interactive)

```bash
bash <(curl -sSL https://raw.githubusercontent.com/RugMunchMedia/degenfeed/main/deploy/deploy.sh) \
  --domain alice.xyz \
  --wallet 0xYourWalletAddress \
  --email admin@alice.xyz
```

#### Manual

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
# Log out and back in

# 2. Create directories
mkdir -p ~/degenfeed/{data/{nginx,degenfeed,redis,ghost,gotosocial},articles}
cd ~/degenfeed

# 3. Get compose files
curl -O https://raw.githubusercontent.com/RugMunchMedia/degenfeed/main/deploy/docker-compose.prod.yml
curl -o nginx.conf https://raw.githubusercontent.com/RugMunchMedia/degenfeed/main/deploy/nginx.conf

# 4. Create .env
cat > .env << 'EOF'
DOMAIN=alice.xyz
CREATOR_WALLET=0xYourWalletAddress
CREATOR_USERNAME=alice
EOF

# 5. Create self-signed cert (replace with Let's Encrypt for production)
mkdir -p data/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout data/nginx/ssl/privkey.pem \
  -out data/nginx/ssl/fullchain.pem \
  -subj "/CN=${DOMAIN}"

# 6. Start
docker compose up -d

# 7. Verify
docker compose ps
curl http://localhost:3000/api/health
```

#### Docker Compose reference

The production compose file (`deploy/docker-compose.prod.yml`) includes:

- **nginx** — reverse proxy with HTTP/2, TLS, WebSocket support
- **DegenFeed** — main app with health checks, resource limits, read-only fs
- **Redis** — persistent cache with AOF
- **Ghost** — blog with SQLite storage
- **GoToSocial** — ActivityPub server
- **Cloudflared** — optional tunnel (profile: `tunnel`)

Start with Cloudflare tunnel instead of open ports:

```bash
docker compose --profile tunnel up -d
```

---

### 2. Railway

Railway supports one-click deploy from a GitHub repo.

**Button:**

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/degenfeed)

**Manual setup:**

1. Fork the repo: `https://github.com/RugMunchMedia/degenfeed`
2. Go to [Railway Dashboard](https://railway.app/dashboard) → New Project
3. Select "Deploy from GitHub repo" → choose your fork
4. Add environment variables:

   | Variable | Value |
   |----------|-------|
   | `DOMAIN` | `your-app.railway.app` (or custom domain) |
   | `CREATOR_WALLET` | `0x...` |
   | `NODE_ENV` | `production` |
   | `SELF_HOSTED` | `true` |

5. Set build command: `cd apps/web && pnpm install && pnpm build`
6. Set start command: `cd apps/web && pnpm start`
7. Deploy

**Custom domain:** Railway Dashboard → Settings → Custom Domain.

**Limitations:** Railway doesn't support Ghost or GoToSocial. You only get
the DegenFeed web app and Redis. Blog and ActivityPub require the full
Docker deployment.

---

### 3. Vercel

Vercel deploys the Next.js frontend only (no Ghost, no GoToSocial).

**One-click:**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/RugMunchMedia/degenfeed)

**Manual setup:**

1. Fork the repo
2. Go to [Vercel Dashboard](https://vercel.com/dashboard) → Add New → Project
3. Import your fork
4. Configure:

   | Setting | Value |
   |---------|-------|
   | Framework | Next.js |
   | Root Directory | `apps/web` |
   | Build Command | `cd ../.. && pnpm install --no-frozen-lockfile && pnpm build` |
   | Output Directory | `.next` |

5. Add environment variables:

   | Variable | Value |
   |----------|-------|
   | `NEXT_PUBLIC_APP_URL` | `https://your-domain.vercel.app` |
   | `NEXT_PUBLIC_API_URL` | `https://your-domain.vercel.app` |
   | `NEXT_PUBLIC_SELF_HOSTED` | `true` |
   | `SELF_HOSTED` | `true` |

6. Deploy

**Limitations:** Vercel deploys the web UI only. No Redis, Ghost, or GoToSocial.
Best for testing the frontend or paired with Docker backend.

---

### 4. Coolify

[Coolify](https://coolify.io) is an open-source PaaS that manages Docker deployments
via a web UI. Perfect for non-technical users.

**One-click template:**

1. In Coolify dashboard → Resources → Instant Deploy
2. Search for "DegenFeed" or paste the template URL:
   `https://raw.githubusercontent.com/RugMunchMedia/degenfeed/main/deploy/coolify-template.json`

**Manual setup:**

1. Coolify Dashboard → Resources → New Resource → Docker Compose
2. Paste the contents of `deploy/docker-compose.prod.yml`
3. Set environment variables in the Coolify UI
4. Add a proxy (Coolify will detect nginx and auto-configure it)
5. Deploy

---

## Configuration Guide

### Environment Variables

All configuration is done through the `.env` file in the install directory.

#### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DOMAIN` | Your domain (DNS A record must point to server) | `alice.xyz` |
| `CREATOR_WALLET` | Your wallet address for creator coin | `0x...` or `4x...` |

#### Identity

| Variable | Default | Description |
|----------|---------|-------------|
| `CREATOR_USERNAME` | `creator` | Your fediverse handle username |
| `ACME_EMAIL` | — | Email for Let's Encrypt notifications |

#### Creator Coin

| Variable | Default | Description |
|----------|---------|-------------|
| `CREATOR_COIN_ADDRESS` | — | Pre-deployed coin address (auto-deploy if empty) |
| `CREATOR_COIN_CHAIN` | `base` | Chain: `base` or `solana` |

#### Branding

| Variable | Default | Description |
|----------|---------|-------------|
| `WHITE_LABEL` | `false` | Set `true` to remove DegenFeed branding |
| `BRAND_COLOR` | — | Primary brand color (e.g., `#ff6b6b`) |
| `CUSTOM_FAVICON` | — | URL to custom favicon |

#### Cross-Protocol Credentials

Set these in `.env` to enable cross-posting.

| Variable | Service |
|----------|---------|
| `NOSTR_PRIVATE_KEY` | Nostr (hex private key) |
| `FARCASTER_BOT_FID` | Farcaster bot FID for Hubble publishing |
| `BSKY_DID` | Bluesky AT Protocol (e.g., `did:plc:abc123`) |
| `GTS_CLIENT_ID` | GoToSocial OAuth client ID |
| `GTS_CLIENT_SECRET` | GoToSocial OAuth client secret |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key |
| `TELEGRAM_BOT_TOKEN` | Telegram bot API token |
| `TELEGRAM_BOT_NAME` | Telegram bot username |

#### Web3 / RPC

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_RPC_URL` | `https://mainnet.base.org` | Base chain RPC |
| `SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` | Solana RPC |
| `ZORA_WRAPPER_FACTORY` | — | Zora wrapper contract address |

---

## SSL Setup

### Option A: Cloudflare (Recommended — free)

1. Add your domain to Cloudflare
2. Set SSL/TLS mode to **Full (strict)**
3. Run the deploy script — it detects Cloudflare and configures automatically
4. No local certificates needed — Cloudflare handles all TLS

**For origin pull certificates (strongest security):**

```bash
# Download Cloudflare origin CA
mkdir -p data/nginx/ssl
curl -o data/nginx/ssl/cloudflare-origin.pem \
  https://developers.cloudflare.com/ssl/static/authenticated_origin_pull_ca.pem

# In Cloudflare dashboard: SSL/TLS → Origin Server → Create Certificate
# Save the cert and key to:
#   data/nginx/ssl/fullchain.pem
#   data/nginx/ssl/privkey.pem
```

### Option B: Let's Encrypt (Free)

The deploy script offers to set up Certbot automatically. For manual setup:

```bash
# Install certbot
sudo apt install -y certbot  # Debian/Ubuntu
sudo dnf install -y certbot  # Fedora

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com \
  --non-interactive --agree-tos --email admin@yourdomain.com

# Copy to nginx ssl directory
sudo cp /etc/letsencrypt/live/yourdomain.com/{fullchain.pem,privkey.pem} \
  data/nginx/ssl/
sudo chown -R $(id -u):$(id -g) data/nginx/ssl/
```

**Auto-renewal:** Certbot installs a systemd timer automatically.

```bash
# Verify renewal is set up
sudo systemctl status certbot.timer
```

### Option C: Self-Signed (Testing Only)

The deploy script generates a self-signed cert if no other option is chosen.
Browsers will show a security warning — only use for testing.

---

## Backup Guide

### Quick Backup

```bash
cd ~/degenfeed
tar czf "degenfeed-backup-$(date +%Y%m%d-%H%M%S).tar.gz" \
  data/ .env articles/
```

### Automated Daily Backup via Cron

```bash
# Edit crontab
crontab -e

# Add this line (backup at 3 AM daily, keep 7 days)
0 3 * * * cd ~/degenfeed && \
  mkdir -p backups && \
  tar czf "backups/degenfeed-$(date +\%Y\%m\%d).tar.gz" \
    data/ .env articles/ && \
  find backups/ -name '*.tar.gz' -mtime +7 -delete
```

### Backup to Cloud Storage (rclone)

```bash
# Install rclone
sudo apt install -y rclone

# Configure rclone (choose Backblaze B2, S3, etc.)
rclone config

# Backup script
cat > ~/degenfeed/backup-to-cloud.sh << 'SCRIPT'
#!/bin/bash
DATE=$(date +%Y%m%d-%H%M%S)
cd ~/degenfeed
tar czf "backups/degenfeed-${DATE}.tar.gz" data/ .env articles/
rclone copy "backups/degenfeed-${DATE}.tar.gz" myremote:degenfeed-backups/
rm "backups/degenfeed-${DATE}.tar.gz"
echo "Backup uploaded: degenfeed-${DATE}.tar.gz"
SCRIPT
chmod +x ~/degenfeed/backup-to-cloud.sh

# Add to crontab
# 0 4 * * * ~/degenfeed/backup-to-cloud.sh
```

### What to Back Up

| Path | Critical? | Notes |
|------|-----------|-------|
| `data/ghost/` | ✅ | Blog content, SQLite database |
| `data/gotosocial/` | ✅ | Fediverse data |
| `data/degenfeed/` | ✅ | User data, settings |
| `data/redis/` | ⚠️ | Cache (rebuildable) |
| `data/nginx/ssl/` | ⚠️ | TLS certs (can be regenerated) |
| `.env` | ✅ | Configuration |
| `articles/` | ✅ | Published static content |

### Restore from Backup

```bash
cd ~/degenfeed

# Stop services
docker compose down

# Restore backup
tar xzf degenfeed-backup-20260101-030000.tar.gz

# Restart
docker compose up -d
```

---

## Update Guide

### Standard Update

```bash
cd ~/degenfeed

# Pull latest images
docker compose pull

# Recreate containers
docker compose up -d

# Clean up old images
docker image prune -f
```

### Update to Specific Version

```bash
cd ~/degenfeed

# Edit .env to set image tag
echo 'IMAGE_TAG=v0.2.0' >> .env

# Or update compose file directly
sed -i 's/image: ghcr.io\/rugmunchmedia\/degenfeed:.*/image: ghcr.io\/rugmunchmedia\/degenfeed:v0.2.0/' docker-compose.yml

# Pull and restart
docker compose pull && docker compose up -d
```

### Breaking Changes

Before updating, check the [changelog](https://github.com/RugMunchMedia/degenfeed/blob/main/CHANGELOG.md)
for breaking changes. Major versions may require migration steps.

### Rollback

```bash
# Revert to previous version
docker compose down
sed -i 's/image: ghcr.io\/rugmunchmedia\/degenfeed:.*/image: ghcr.io\/rugmunchmedia\/degenfeed:v0.1.0/' docker-compose.yml
docker compose up -d
```

Or restore from backup and restore the previous `.env` and `docker-compose.yml`.

---

## White-Label & Branding

### Remove DegenFeed Branding

Set in `.env`:

```bash
WHITE_LABEL=true
BRAND_COLOR=#yourColor
CUSTOM_FAVICON=https://yourdomain.com/favicon.ico
```

### CSS Customization

DegenFeed uses CSS custom properties (variables) for theming.
Override them in your admin panel at **Settings → Appearance → Custom CSS**.

```css
:root {
  /* Brand colors */
  --color-primary: #ff6b6b;
  --color-primary-hover: #ff5252;
  --color-secondary: #4ecdc4;

  /* Background */
  --bg-primary: #0a0a0a;
  --bg-secondary: #1a1a1a;
  --bg-card: #242424;

  /* Text */
  --text-primary: #ffffff;
  --text-secondary: #a0a0a0;
  --text-muted: #666666;

  /* Accent */
  --color-accent: #ff6b6b;
  --color-success: #4caf50;
  --color-warning: #ff9800;
  --color-error: #f44336;

  /* Borders */
  --border-color: #333333;
  --border-radius: 8px;
  --border-radius-lg: 12px;

  /* Typography */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Sizing */
  --header-height: 64px;
  --max-width: 1200px;
  --sidebar-width: 280px;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.5);
}
```

### Logo Replacement

Replace the default logo by overriding the CSS:

```css
/* Replace with your own logo */
.header-logo {
  content: url('https://yourdomain.com/logo.svg');
  width: 150px;  /* Adjust as needed */
  height: auto;
}

/* Or hide the DegenFeed logo entirely */
.header-logo {
  display: none;
}
```

### Custom Domain

Your instance is already on your domain. To use a different domain:

1. Point the new domain's DNS A record to your server
2. Update `DOMAIN` in `.env`
3. Rebuild nginx config: `docker compose up -d`
4. Regenerate TLS cert for the new domain

---

## Troubleshooting

### Services won't start

```bash
# Check all logs
docker compose logs --tail=50

# Check specific service
docker compose logs degenfeed --tail=50
docker compose logs nginx --tail=50
docker compose logs ghost --tail=50
```

### Port 80/443 in use

```bash
sudo lsof -i :80 -i :443
sudo systemctl stop apache2 nginx
```

### Ghost blank page

Ghost's SQLite database may have permission issues:

```bash
docker compose exec ghost chown -R node:node /var/lib/ghost/content
docker compose restart ghost
```

### ActivityPub not working

```bash
# Verify webfinger resolves
curl https://yourdomain.com/.well-known/webfinger?resource=acct:username@yourdomain.com

# Check GoToSocial health
curl https://yourdomain.com/api/v1/instance
```

### Redis connection issues

```bash
docker compose exec redis redis-cli ping
# Should return: PONG
```

### Reset everything (keep data)

```bash
cd ~/degenfeed
docker compose down
docker compose up -d
```

### Full reset (destroy data)

```bash
cd ~/degenfeed
docker compose down -v
rm -rf data/
# Then run deploy.sh again
```

### Get support

| Channel | Purpose |
|---------|---------|
| [Discord](https://discord.gg/degenfeed) | Community support |
| [GitHub Issues](https://github.com/RugMunchMedia/degenfeed/issues) | Bug reports |
| [Email](mailto:selfhost@degenfeed.xyz) | Enterprise support |

---

## Security Checklist

- [ ] Firewall: only ports 22, 80, 443 open (or use Cloudflare Tunnel for zero open ports)
- [ ] SSH: key-based auth only (disable password auth)
- [ ] Automatic security updates enabled (`unattended-upgrades` on Ubuntu)
- [ ] Regular backups configured
- [ ] `.env` file permissions: `chmod 600 .env`
- [ ] Docker containers run as non-root (default in our compose)
- [ ] Read-only filesystem for app containers (default in our compose)
- [ ] Cloudflare proxied (orange cloud) for DDoS protection
- [ ] HTTPS enforced (HSTS header)
- [ ] Regular updates: `docker compose pull && docker compose up -d`

---

## Performance Tuning

### Resource limits

Adjust in `docker-compose.prod.yml`:

```yaml
x-deploy: &default-deploy
  resources:
    limits:
      cpus: "2"          # Increase to 2 CPUs
      memory: 1G          # Increase to 1GB per service
    reservations:
      cpus: "0.5"
      memory: 512M
```

### Disable unused services

Add a profile to services you don't need:

```yaml
gotosocial:
  profiles: ["disabled"]   # Skip GoToSocial
  # ... rest stays same
```

Start without disabled services:

```bash
docker compose up -d
```

### Redis tuning

Redis is configured with AOF persistence and conservative memory use.
For high-traffic instances, increase maxmemory in the command:

```yaml
command: redis-server --appendonly yes --save 60 1 --maxmemory 512mb --maxmemory-policy allkeys-lru
```

---

## Monitoring

### Health endpoints

```bash
# DegenFeed health
curl http://localhost:3000/api/health

# Nginx health
curl http://localhost:80/nginx-health

# Ghost health
curl -I http://localhost:2368/ghost/api/admin/ping/

# GoToSocial health
curl http://localhost:8080/api/v1/instance

# Redis health
docker compose exec redis redis-cli ping
```

### Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f degenfeed
docker compose logs -f nginx

# Nginx access log (from container)
docker compose exec nginx tail -f /var/log/nginx/degenfeed-access.log
```

### Uptime monitoring with Uptime Kuma

Deploy Uptime Kuma alongside DegenFeed:

```yaml
services:
  uptime-kuma:
    image: louislam/uptime-kuma:latest
    restart: unless-stopped
    ports:
      - "3001:3001"
    volumes:
      - ./data/uptime-kuma:/app/data
```

---

## Migration from Cloudflare Workers/Pages

If you're migrating from the hosted version (app.degenfeed.xyz):

1. Deploy your self-hosted instance
2. Export data from `app.degenfeed.xyz/settings/export`
3. Import via your self-hosted admin panel at `/admin/import`
4. Update DNS to point to your server
5. Configure cross-protocol credentials
6. Set up your creator coin

---

## License

DegenFeed Self-Hosted is open source under the MIT License.

---

*Built for creators who own their stack.*
