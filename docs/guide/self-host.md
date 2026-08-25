# Self-Hosted Community Guide

DegenFeed lets creators spin up their own federated community instances — Lemmy, PeerTube, or Mastodon — under their own domain. DegenFeed handles the federation and discovery layer.

## Quick Start

1. **Choose your platform** — Community (Lemmy), Video (PeerTube), or Social (Mastodon)
2. **Submit a deploy request** at [app.degenfeed.xyz/deploy](https://app.degenfeed.xyz/deploy)
3. **Get your docker-compose.yml** — generated with your domain and admin email
4. **Deploy on your server** — `docker compose up -d`
5. **Configure DNS** — point your domain to your server IP
6. **Connect to DegenFeed** — your instance is automatically discoverable

## Submit a Deploy Request

Visit [app.degenfeed.xyz/deploy/request](https://app.degenfeed.xyz/deploy/request) and fill in:

- **Domain** — your own domain (e.g., `community.example.com`)
- **Community type** — Lemmy, PeerTube, or Mastodon
- **Community name + description**
- **Admin email** — we'll send setup instructions

## Platform Overview

### Community (Lemmy)

A Reddit-like discussion platform. Features:
- Threaded discussions with voting
- Sub-communities (sublemmy)
- Moderation tools
- Full ActivityPub federation
- Markdown content

**Requirements:**
- 2 GB RAM (4 GB recommended)
- 10 GB storage
- Docker + Docker Compose v2

**Estimated setup time:** ~15 minutes

**After deploy:** Create your admin account and start creating communities.

### Video (PeerTube)

A decentralized video hosting platform. Features:
- Video upload and transcoding
- Live streaming via WebSocket
- Playlists and channels
- Full ActivityPub federation
- P2P streaming via WebTorrent

**Requirements:**
- 4 GB RAM (8 GB recommended)
- 100 GB+ SSD storage
- Docker + Docker Compose v2

**Estimated setup time:** ~30 minutes

**After deploy:** Create your admin account, configure storage, start uploading.

### Social (Mastodon)

A Twitter/X-like microblogging platform. Features:
- Short-form posts with media
- Full ActivityPub federation
- Hashtags and trends
- Direct messaging
- Streaming API for real-time updates

**Requirements:**
- 4 GB RAM (8 GB recommended)
- 20 GB+ storage
- Docker + Docker Compose v2
- SMTP server for email delivery

**Estimated setup time:** ~20 minutes

**After deploy:** Create your admin account, configure SMTP, invite users.

## Deployment Guide

### Prerequisites

1. **A Linux server** (Ubuntu 22.04+ or Debian 12+ recommended)
2. **Docker and Docker Compose v2** installed
3. **A domain name** with DNS pointing to your server IP
4. **Ports 80 and 443** open in your firewall
5. **SSL certificate** (Let's Encrypt via Certbot)

### Step 1: Install Docker

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in, or run: newgrp docker
```

### Step 2: Deploy

```bash
# Create a directory for your instance
mkdir my-instance && cd my-instance

# Save your generated docker-compose.yml (from the deploy request)
# or download it:
curl -O https://app.degenfeed.xyz/api/deploy/compose/YOUR_DEPLOY_ID

# Start everything
docker compose up -d

# Check status
docker compose ps
```

### Step 3: Set Up SSL

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com

# Certbot auto-renews; verify with:
sudo certbot renew --dry-run
```

### Step 4: Configure Reverse Proxy

Each template includes an nginx snippet at the bottom of the docker-compose file. Copy it to `/etc/nginx/sites-available/your-domain` and enable it:

```bash
sudo ln -s /etc/nginx/sites-available/your-domain /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 5: Create Admin Account

**Lemmy:**
```bash
docker compose exec lemmy lemmy create_admin
```

**PeerTube:**
```bash
docker compose exec peertube npm run create-admin -- --email admin@example.com
```

**Mastodon:**
```bash
docker compose exec mastodon-web bin/tootctl accounts create admin --email admin@example.com --confirmed --role Owner
```

### Step 6: Join the Fediverse

Your instance will automatically federate with other ActivityPub services once it's up and running. DegenFeed will discover your instance and include it in the aggregated feed.

## Maintenance

### Backups

Back up your docker volumes regularly:

```bash
# Backup Postgres
docker compose exec postgres pg_dump -U lemmy lemmy > backup.sql

# Or use volume snapshots
docker run --rm -v my-instance_postgres:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz -C /data .
```

### Updates

```bash
# Pull latest images
docker compose pull

# Recreate containers
docker compose up -d

# Clean up old images
docker image prune -a
```

### Monitoring

```bash
# View logs
docker compose logs -f

# Check resource usage
docker stats
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Container keeps restarting | Check logs: `docker compose logs [service]` |
| Can't send emails | Verify SMTP settings in environment variables |
| Federation not working | Ensure port 443 is reachable from the internet |
| Upload fails | Check `client_max_body_size` in nginx config |
| Out of disk space | Remove old Docker images: `docker system prune -a` |

## Getting Help

- Open an issue on [Forgejo](https://git.rugmunch.io/RugMunchMedia/degenfeed)
- Join our community chat
- Check the [DegenFeed docs](https://app.degenfeed.xyz/docs)
