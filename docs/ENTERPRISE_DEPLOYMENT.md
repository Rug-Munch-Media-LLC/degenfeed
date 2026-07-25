# Enterprise Tier — Self-Hosted Creator Page

> **Documentation for Enterprise ($20/mo) subscribers.**
> Deploy your own DegenFeed creator page on a custom domain with full branding control.

---

## Overview

Enterprise tier unlocks:
- **Self-hosted creator page** on your custom domain
- **White-label analytics reports** with your branding
- **API access** for programmatic content publishing
- **Team accounts** (up to 5 members) with role-based access
- **External platform posting** to LinkedIn, Facebook, X (Twitter), YouTube, Reddit
- **Priority support** with 4-hour response time
- **Early access** to new features before public release

---

## 1. Quick Deploy

### Prerequisites
- Linux server (Ubuntu 22.04+ or Debian 12+ recommended)
- Docker and Docker Compose v2.24+
- Domain name with DNS pointing to your server
- Cloudflare account (for SSL and CDN — optional but recommended)
- Enterprise tier membership on DegenFeed

### One-line Deploy
```bash
bash <(curl -sSL https://raw.githubusercontent.com/RugMunchMedia/degenfeed-web/main/deploy/deploy.sh) \
  --domain yourdomain.com \
  --enterprise \
  --wallet YOUR_WALLET_ADDRESS
```

### Manual Deploy
```bash
git clone https://github.com/RugMunchMedia/degenfeed-web.git
cd degenfeed-web

# Configure environment
cp .env.example .env
# Edit .env with your details:
# - DOMAIN=yourdomain.com
# - ENTERPRISE_WALLET=your_wallet_address
# - API_KEY=your_enterprise_api_key

# Start with Docker Compose
docker compose -f docker-compose.yml -f docker-compose.enterprise.yml up -d
```

---

## 2. Custom Domain Setup

### DNS Configuration
```
yourdomain.com    A     → YOUR_SERVER_IP
www.yourdomain.com CNAME → yourdomain.com
```

### Cloudflare Pages (Recommended)
1. Fork the repo: `github.com/RugMunchMedia/degenfeed-web`
2. Connect to Cloudflare Pages
3. Build command: `npm run build`
4. Output directory: `apps/web/.next`
5. Environment variables:
   - `NEXT_PUBLIC_API_URL` → `https://api.degenfeed.xyz` (or your own API)
   - `NEXT_PUBLIC_SELF_HOSTED` → `true`
   - `NEXT_PUBLIC_CUSTOM_DOMAIN` → `yourdomain.com`

### Nginx Reverse Proxy
```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 3. Custom Branding

### Theme Configuration
Edit `apps/web/src/app/globals.css` or set environment variables:

```bash
# Custom brand colors
NEXT_PUBLIC_BRAND_PRIMARY=#00ff41    # Your brand color
NEXT_PUBLIC_BRAND_SECONDARY=#ff6b35
NEXT_PUBLIC_BRAND_LOGO=/logo.svg     # Custom logo path

# Custom branding text
NEXT_PUBLIC_SITE_NAME="Your Creator Hub"
NEXT_PUBLIC_TAGLINE="Your tagline here"
```

### White-Label Mode
Enable full white-label to remove all DegenFeed branding:

```bash
WHITE_LABEL=true
WHITE_LABEL_COMPANY="Your Company Name"
WHITE_LABEL_LOGO=/custom-logo.svg
WHITE_LABEL_FAVICON=/custom-favicon.ico
```

---

## 4. Analytics Integration

### Self-Hosted Analytics (Plausible)
```yaml
# docker-compose.enterprise.yml
services:
  plausible:
    image: ghcr.io/plausible/community-edition
    ports:
      - "8000:8000"
    environment:
      BASE_URL: https://analytics.yourdomain.com
      SECRET_KEY_BASE: your-secret-key
    volumes:
      - plausible-data:/var/lib/clickhouse
```

### White-Label Analytics Reports
```bash
# Generate branded report
curl -X POST https://api.yourdomain.com/api/enterprise/report \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "period": "monthly",
    "branding": {
      "logo_url": "https://yourdomain.com/logo.png",
      "company_name": "Your Company",
      "primary_color": "#00ff41"
    },
    "include_sections": ["engagement", "audience", "revenue"]
  }'
```

---

## 5. API Access

Enterprise tier includes full API access with higher rate limits.

### Authentication
```bash
# Generate API key
curl -X POST https://api.degenfeed.xyz/api/api-key \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-app", "scope": "enterprise"}'

# Response:
# { "key": "df_xxxxxxxxxxxx", "name": "my-app", "scope": "enterprise" }
```

### Rate Limits
| Endpoint Type | Standard | Enterprise |
|--------------|----------|------------|
| REST API     | 100/min  | 10,000/min |
| WebSocket    | 10 msg/s | 100 msg/s  |
| GraphQL      | 50/min   | 5,000/min  |

### Example: Cross-Platform Publish via API
```bash
curl -X POST https://api.degenfeed.xyz/api/publish \
  -H "Authorization: Bearer df_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello from my enterprise self-hosted instance!",
    "protocols": ["farcaster", "lens", "bluesky", "nostr", "twitter", "linkedin"],
    "scheduled_at": "2026-08-01T15:00:00Z"
  }'
```

---

## 6. Team Accounts

Add team members to manage your creator page collaboratively.

```bash
# Invite a team member
curl -X POST https://api.degenfeed.xyz/api/enterprise/team/invite \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teammate@example.com",
    "role": "editor",
    "wallet": "0x..."
  }'

# Response:
# { "invite_id": "inv_xxx", "status": "pending" }
```

### Roles
| Role     | Permissions |
|----------|-------------|
| Admin    | Full access, billing, team management |
| Editor   | Create/edit posts, view analytics |
| Analyst  | View analytics and reports only |
| Contributor | Create draft posts only |

### Team Limits by Tier
| Tier      | Team Members |
|-----------|-------------|
| Creator   | 1 (solo)    |
| Enterprise| 5           |

---

## 7. External Platform Integration

Enterprise tier enables cross-posting to external (non-crypto) platforms.

### Supported Platforms
- **X (Twitter)** — OAuth 2.0 with v2 API
- **LinkedIn** — OAuth 2.0 for Company Pages + Personal Profiles
- **Facebook** — Facebook Graph API for Pages
- **YouTube** — YouTube Data API v3
- **Reddit** — OAuth 2.0 with Reddit API
- **Instagram** — Instagram Basic Display API (business accounts)

### Setup
```bash
# Connect external platform
curl -X POST https://api.degenfeed.xyz/api/connected-accounts/connect \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "twitter",
    "oauth_token": "...",
    "oauth_verifier": "..."
  }'
```

---

## 8. Docker Compose (Full Stack)

```yaml
# docker-compose.enterprise.yml
version: '3.8'

services:
  # DegenFeed Web App
  web:
    image: ghcr.io/rugmunchmedia/degenfeed-web:latest
    ports:
      - "3000:3000"
    env_file: .env
    environment:
      - ENTERPRISE=true
      - WHITE_LABEL=${WHITE_LABEL:-false}
      - CUSTOM_DOMAIN=${DOMAIN}
    depends_on:
      - api
    restart: unless-stopped

  # API Worker
  api:
    image: ghcr.io/rugmunchmedia/degenfeed-api:latest
    ports:
      - "8787:8787"
    env_file: .env
    environment:
      - ENTERPRISE_MODE=true
      - ENTERPRISE_WALLET=${ENTERPRISE_WALLET}
    restart: unless-stopped

  # PostgreSQL (for team accounts and analytics)
  postgres:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: degenfeed
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    restart: unless-stopped

  # Redis (for caching and queues)
  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  pgdata:
  redis-data:
```

---

## 9. Monitoring & Maintenance

### Health Check
```bash
# Check all services
curl https://yourdomain.com/api/health
# Expected: { "status": "ok", "service": "degenfeed-api", ... }

# Check enterprise-specific endpoints
curl https://yourdomain.com/api/enterprise/health \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Logs
```bash
docker compose -f docker-compose.enterprise.yml logs -f web api
```

### Updates
```bash
# Pull latest images and restart
docker compose -f docker-compose.enterprise.yml pull
docker compose -f docker-compose.enterprise.yml up -d --force-recreate
```

### Backups
```bash
# Backup PostgreSQL
docker exec -t degenfeed-postgres pg_dump -U degenfeed degenfeed > backup_$(date +%Y%m%d).sql

# Backup Redis
docker exec -t degenfeed-redis redis-cli SAVE
```

---

## 10. Priority Support

Enterprise subscribers get:
- **4-hour response time** (business hours)
- **Dedicated Slack/Discord channel**
- **Direct line to engineering**
- ** SLA guarantee**: 99.9% uptime for hosted API

Contact: `enterprise@degenfeed.xyz`

---

## 11. Upgrading from Creator to Enterprise

```bash
# Already on Creator ($10/mo)? Upgrade to Enterprise ($20/mo):
curl -X POST https://api.degenfeed.xyz/api/membership/upgrade \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier": "enterprise"}'
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| SSL certificate error | Run `certbot --nginx -d yourdomain.com` |
| API rate limits | Enterprise tier: 10,000 req/min. Check headers with `curl -I` |
| DMARC/SPF for newsletter | Add SPF record: `v=spf1 include:degenfeed.xyz ~all` |
| Custom domain not resolving | Ensure DNS A record points to your server IP |
| Docker permission denied | Add user to docker group: `sudo usermod -aG docker $USER` |
| White-label not applying | Set `WHITE_LABEL=true` and restart containers |
