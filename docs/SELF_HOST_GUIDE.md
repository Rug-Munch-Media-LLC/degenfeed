# Self-Host DegenFeed

Run your own DegenFeed instance on your domain. Own everything — your domain, your
content, your creator coin, your data. We just provide the software.

```shell
curl -sSL https://degenfeed.xyz/install.sh | bash
```

**One command. Full ownership. Zero lock-in.**

---

## Table of Contents

- [Quick Start](#quick-start)
- [What You Get](#what-you-get)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Manual Installation](#manual-installation)
- [Configuration](#configuration)
- [Customization](#customization)
- [DNS Setup](#dns-setup)
- [Updating](#updating)
- [Backups](#backups)
- [Troubleshooting](#troubleshooting)
- [Enterprise White-Label](#enterprise-white-label)
- [FAQ](#faq)

---

## Quick Start

### 1. Buy a domain & point it to your server

| Record | Type | Value |
|--------|------|-------|
| `@` | A | `YOUR_SERVER_IP` |
| `www` | CNAME | `@` |

Wait up to 5 minutes for DNS propagation.

### 2. SSH into your server

```shell
ssh root@your-server-ip
```

### 3. Run the installer

```shell
curl -sSL https://degenfeed.xyz/install.sh | bash
```

You'll be prompted for:

- **Domain** — e.g., `alice.xyz`
- **Wallet address** — for your creator coin
- **Email** — for Let's Encrypt expiry notifications (optional)

### 4. Visit your DegenFeed

```
https://alice.xyz     → Your profile + content hub
https://alice.xyz/articles  → Your Ghost blog
https://alice.xyz/coin      → Creator coin page
https://alice.xyz/live      → Live stream page
```

Done. That's it. Your creator platform is live.

---

## What You Get

| Feature | What's Included |
|---------|----------------|
| **DegenFeed Profile** | Your unified creator hub at your domain |
| **Cross-Platform Posting** | Write once, publish to Nostr + Farcaster + Bluesky + Mastodon + Lens |
| **Creator Coin** | Your own ERC-20/SPL token on Base + Solana |
| **Ghost Blog** | Full-featured blog at `/articles` with admin panel |
| **ActivityPub Handle** | `@you@yourdomain.com` — reachable from Mastodon, etc. |
| **Live Streaming** | PeerTube-powered livestreams at `/live` |
| **Audience Engagement** | Tips across 4 chains, coin-based gating, newsletter |
| **Email Newsletter** | Built-in newsletter from your blog posts |
| **Full Data Ownership** | Everything on your server. We host nothing. |
| **Custom Domain** | Everything under your domain |

---

## Architecture

```
                          ┌─────────────┐
                          │   Internet   │
                          └──────┬──────┘
                                 │ :443
                          ┌──────┴──────┐
                          │   Caddy     │ ← Automatic TLS (Let's Encrypt)
                          │ (Reverse    │
                          │  Proxy)     │
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

**Container breakdown:**

| Service | Image | Purpose |
|---------|-------|---------|
| `caddy` | `caddy:2-alpine` | Reverse proxy with auto TLS |
| `degenfeed` | `degenfeed/self-host` | Main DegenFeed web application |
| `ghost` | `ghost:5-alpine` | Blogging platform (long-form) |
| `gotosocial` | `superseriousbusiness/gotosocial` | ActivityPub server (fediverse) |
| `redis` | `redis:7-alpine` | Caching and background job queues |

**Data directories** (all under `./data/`):

| Directory | Contents | Backup Priority |
|-----------|----------|-----------------|
| `data/degenfeed/` | User data, settings, uploaded media | ⭐⭐⭐ |
| `data/ghost/` | Blog content, images, SQLite DB | ⭐⭐⭐ |
| `data/gotosocial/` | Fediverse posts, media, database | ⭐⭐⭐ |
| `data/redis/` | Cache (can be rebuilt) | ⭐ |
| `data/caddy/` | TLS certs, access logs | ⭐⭐ |

---

## Requirements

### Minimum

| Resource | Requirement |
|----------|-------------|
| **CPU** | 1 vCPU |
| **RAM** | 2 GB |
| **Storage** | 20 GB SSD |
| **OS** | Ubuntu 22.04+, Debian 12+, or any Linux with Docker |
| **Docker** | Docker Engine 24+ with Compose v2 plugin |
| **Domain** | A domain pointed to your server's IP |

### Recommended

| Resource | Recommendation |
|----------|---------------|
| **CPU** | 2 vCPU |
| **RAM** | 4 GB |
| **Storage** | 50 GB SSD |
| **Bandwidth** | 2 TB/month |

### Providers

Any VPS works. Here are popular options (not endorsements):

| Provider | Starting Price | Notes |
|----------|---------------|-------|
| Hetzner Cloud | €4/mo | Best value |
| Digital Ocean | $6/mo | Simple setup |
| Linode | $5/mo | Good docs |
| Vultr | $6/mo | Global locations |
| Oracle Cloud | Free | Always-free tier (4 ARM cores, 24GB RAM) |

---

## Manual Installation

If you prefer not to use the installer script, or want to customize the setup:

### 1. Install Docker

```shell
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
# Log out and back in
```

### 2. Create directory structure

```shell
mkdir -p ~/degenfeed/{data/{caddy,degenfeed,redis,ghost,gotosocial},articles}
cd ~/degenfeed
```

### 3. Download configuration

```shell
curl -O https://degenfeed.xyz/self-host/docker-compose.yml
mkdir -p data/caddy
curl -o data/caddy/Caddyfile https://degenfeed.xyz/self-host/Caddyfile
```

### 4. Create .env

```shell
cat > .env << 'EOF'
DOMAIN=alice.xyz
CREATOR_WALLET=0xYourWalletAddress
CREATOR_USERNAME=alice
EOF
```

### 5. Start everything

```shell
docker compose up -d
```

### 6. Verify

```shell
docker compose ps
docker compose logs degenfeed --tail=20
```

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DOMAIN` | ✅ | — | Your domain (e.g., `alice.xyz`) |
| `CREATOR_WALLET` | ✅ | — | Your wallet address for the creator coin |
| `CREATOR_USERNAME` | | `creator` | Your fediverse handle username |
| `CREATOR_COIN_ADDRESS` | | — | Pre-deployed coin address (auto-deploy if empty) |
| `CREATOR_COIN_CHAIN` | | `base` | Chain for creator coin (`base` or `solana`) |
| `ACME_EMAIL` | | — | Email for Let's Encrypt expiry notices |

### Ghost Admin

Access your blog admin at `https://yourdomain.com/articles/ghost`

On first visit, Ghost will ask you to create an admin account.
Bookmark this — it's how you write and manage articles.

### GoToSocial Setup

Your ActivityPub handle is `@username@yourdomain.com`.
You can follow and be followed by anyone on the fediverse (Mastodon, etc.).

GoToSocial admin credentials are printed to logs on first start:
```shell
docker compose logs gotosocial | grep "Created"
```

---

## Customization

### Custom CSS

1. Go to your admin panel at `https://yourdomain.com/admin`
2. Navigate to **Settings → Appearance**
3. Add your custom CSS

### White-Label Mode

See the [Enterprise White-Label](#enterprise-white-label) section for
removing DegenFeed branding, custom color schemes, and more.

### Blog Theme

Ghost supports custom themes. Upload one via:
`https://yourdomain.com/articles/ghost/#/settings/design`

### Adding Custom Domains

Caddy handles TLS automatically. To add a subdomain:

1. Point the subdomain's DNS A record to your server IP
2. Update `.env` or add a new Caddy route

---

## DNS Setup

For full functionality, configure these DNS records:

```dns
@       A       YOUR_SERVER_IP
www     CNAME   @
```

**Additional records** (if using subdomains for services):

```dns
articles  CNAME   @   (if Ghost on separate subdomain)
live      CNAME   @   (if PeerTube on separate subdomain)
```

### DNS Propagation Check

```shell
dig A yourdomain.com +short
# Should show your server IP
```

---

## Updating

```shell
cd ~/degenfeed

# Pull latest images
docker compose pull

# Recreate containers with new images
docker compose up -d

# Clean up old images
docker image prune -f
```

**To update to a specific version:**

```shell
export IMAGE_TAG=v0.2.0
sed -i "s/image: degenfeed\/self-host:.*/image: degenfeed\/self-host:${IMAGE_TAG}/" docker-compose.yml
docker compose pull && docker compose up -d
```

---

## Backups

All your data lives in `~/degenfeed/data/`. Back it up regularly.

### Quick Backup

```shell
cd ~/degenfeed
tar czf "degenfeed-backup-$(date +%Y%m%d-%H%M%S).tar.gz" \
    data/ \
    .env \
    articles/
```

### Automated Backup (cron)

Add to your crontab (`crontab -e`):

```cron
# Daily backup at 3 AM, keep last 7 days
0 3 * * * cd ~/degenfeed && tar czf "backups/degenfeed-$(date +\%Y\%m\%d).tar.gz" data/ .env articles/ && find backups/ -name '*.tar.gz' -mtime +7 -delete
```

### Restore from Backup

```shell
cd ~/degenfeed
docker compose down
tar xzf degenfeed-backup-20250101-030000.tar.gz
docker compose up -d
```

---

## Troubleshooting

### Services won't start

```shell
# Check all logs
docker compose logs --tail=50

# Check specific service
docker compose logs degenfeed --tail=50
docker compose logs caddy --tail=50
docker compose logs ghost --tail=50
```

### Port 80 or 443 already in use

```shell
# Check what's using the ports
sudo lsof -i :80 -i :443

# If you have Apache/NGINX, stop them:
sudo systemctl stop apache2 nginx
```

### Let's Encrypt rate limit

Caddy handles rate limits automatically. If you hit one:

1. Use the staging CA temporarily by setting `ACME_CA=https://acme-staging-v02.api.letsencrypt.org/directory` in Caddyfile
2. Wait for the rate limit to reset (usually 1 hour)

### Ghost shows a blank page

Ghost's SQLite database may have permission issues:

```shell
docker compose exec ghost chown -R node:node /var/lib/ghost/content
docker compose restart ghost
```

### ActivityPub not working

```shell
# Check if webfinger resolves correctly
curl https://yourdomain.com/.well-known/webfinger?resource=acct:username@yourdomain.com

# Should return a JSON response with links
```

### Slow performance

Reduce memory usage by disabling unused services in `docker-compose.yml`:

```yaml
services:
  gotosocial:
    profiles: ["disabled"]  # Add this to skip GoToSocial
    # ... rest stays the same
```

Then run: `docker compose up -d` (services with profiles are excluded).

---

## Enterprise White-Label

For creators and organizations that need full branding control.

### Tier: Creator Pro ($29/mo)

- Remove "Powered by DegenFeed" footer
- Custom color scheme (set via admin panel)
- Priority email support
- Monthly analytics report

### Tier: Enterprise ($500/mo)

- Complete white-label — zero DegenFeed branding anywhere
- Custom domain for every service
- Custom color scheme + typography
- Dedicated infrastructure (higher resource limits)
- SLA-backed uptime guarantee (99.9%)
- Priority support with 4-hour response
- Custom protocol integrations (add your own)
- On-premise deployment support (air-gapped, SOC2)
- Custom contract deployments
- Dedicated account manager
- Training and onboarding

### What White-Label Includes

| Feature | Free | Creator Pro | Enterprise |
|---------|------|-------------|------------|
| DegenFeed branding | Visible | Removed | Removed |
| Custom CSS | ✅ | ✅ | ✅ |
| Custom domain | ✅ | ✅ | ✅ |
| Color scheme | Default | Custom | Full custom |
| Analytics | Basic | Monthly | Real-time dashboard |
| Support | Community | Priority (24h) | Priority (4h) |
| Custom integrations | — | — | ✅ |
| On-premise | — | — | ✅ |
| SLA | — | — | 99.9% |
| Price | Free | $29/mo | $500/mo |

### Enabling White-Label

Add to your `.env`:

```shell
# Creator Pro
WHITE_LABEL=true
BRAND_COLOR=#ff6b6b

# Enterprise (requires license key)
WHITE_LABEL=true
ENTERPRISE_LICENSE=df_ent_xxxxxxxxxxxx
CUSTOM_FAVICON=https://yourdomain.com/favicon.ico
```

---

## FAQ

### Can I use my own domain?

Yes. That's the entire point. Your DegenFeed runs on your domain.
We provide the software; you own everything.

### Do you host anything?

No. Zero. The self-hosted version runs entirely on your server.
We never see your content, your data, or your users' data.

### Do I need a credit card?

No. The self-hosted version is free software. You pay only for
your VPS (~$5-20/mo) and your domain (~$10/yr).

### Can I migrate from the hosted version?

Yes. Export your data from app.degenfeed.xyz, then import it
into your self-hosted instance via the admin panel.

### What if I break something?

`docker compose down && docker compose up -d` resets the application
containers (your data in `./data/` is preserved).

If all else fails, restore from your backup.

### Can I have multiple creators on one instance?

The self-hosted version is designed for solo creators.
For multi-creator or team plans, see our hosted offering
at [degenfeed.xyz/pricing](https://degenfeed.xyz/pricing).

### Is there a mobile app?

Yes. The DegenFeed mobile app (iOS/Android via Capacitor)
can point to any self-hosted instance. Configure it in Settings.

### Can I remove the crypto/coin features?

Yes. Simply leave `CREATOR_WALLET` and `CREATOR_COIN_ADDRESS`
unset in `.env`, and the coin-related UI will be hidden.

### How do I connect my existing social accounts?

After installation, log into your DegenFeed instance and
navigate to **Settings → Connected Accounts** to authorize
Nostr, Farcaster, Bluesky, Mastodon, Lens, etc.

---

## Support

| Channel | Purpose |
|---------|---------|
| [Discord](https://discord.gg/degenfeed) | Community support, questions |
| [GitHub Issues](https://github.com/RugMunchMedia/degenfeed/issues) | Bug reports, feature requests |
| [Docs](https://docs.degenfeed.xyz) | Full documentation |
| [Email](mailto:selfhost@degenfeed.xyz) | Enterprise inquiries |

---

## License

DegenFeed Self-Hosted is open source under the
[MIT License](https://github.com/RugMunchMedia/degenfeed/blob/main/LICENSE).

---

*Built for creators who own their stack.* 🚀
