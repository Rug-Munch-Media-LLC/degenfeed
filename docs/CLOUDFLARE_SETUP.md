# CLOUDFLARE_SETUP.md — DegenFeed DNS & Infrastructure

> **Status:** canonical · last_updated: 2026-07-24
> **Audience:** AI agents, engineers, operators
> **Purpose:** Single source of truth for all DegenFeed Cloudflare DNS records, nginx configs, and tunnel setup.

---

## 1. DNS Records — degenfeed.xyz

### Zone ID: `116a9676c3358def6796910ccb96f1fc`
### Tunnel ID: `9f428b88-5a57-4b28-a7dc-1368f4f32811`
### Server IP: `152.53.80.39` (Talos, Netcup)
### Tunnel CNAME target: `9f428b88-5a57-4b28-a7dc-1368f4f32811.cfargotunnel.com`

| Subdomain | Type | Target | Proxy | Backend Port | Service |
|-----------|------|--------|-------|-------------|---------|
| `degenfeed.xyz` | CNAME | tunnel | ☁️ proxied | nginx :80 → static | Main landing page |
| `www.degenfeed.xyz` | A | 152.53.80.39 | ☁️ proxied | nginx :80 → redirect to apex | WWW redirect |
| `app.degenfeed.xyz` | CNAME | tunnel | ☁️ proxied | :3100 | Next.js web app |
| `social.degenfeed.xyz` | A | 152.53.80.39 | ☁️ proxied | :8082 | GoToSocial / Mastodon |
| `talk.degenfeed.xyz` | A | 152.53.80.39 | ☁️ proxied | :8536 | Lemmy |
| `community.degenfeed.xyz` | CNAME | tunnel | ☁️ proxied | :8536 | Lemmy (alt) |
| `video.degenfeed.xyz` | A | 152.53.80.39 | ❌ DNS only | :9010 (nginx :443) | PeerTube |
| `photos.degenfeed.xyz` | A | 152.53.80.39 | ☁️ proxied | :8087 | Pixelfed (planned) |
| `blog.degenfeed.xyz` | A | 152.53.80.39 | ☁️ proxied | :8086 | WriteFreely |
| `post.degenfeed.xyz` | CNAME | tunnel | ☁️ proxied | :3105 | Postiz (scheduling) |
| `relay.degenfeed.xyz` | CNAME | tunnel | ☁️ proxied | :8084 | ActivityPub Relay |
| `search.degenfeed.xyz` | A | 152.53.80.39 | ☁️ proxied | :7700 | Meilisearch (planned) |
| `nostr.degenfeed.xyz` | A | 152.53.80.39 | ☁️ proxied | :8085 | Nostr Relay (planned) |
| `pds.degenfeed.xyz` | A | 152.53.80.39 | ☁️ proxied | :3012 | Bluesky PDS |
| `zora.degenfeed.xyz` | A | 152.53.80.39 | ☁️ proxied | :8091 | Zora API Indexer |
| `lens.degenfeed.xyz` | A | 152.53.80.39 | ☁️ proxied | :8099 | Lens Indexer (planned) |
| `docs.degenfeed.xyz` | CNAME | tunnel | ☁️ proxied | nginx :80 → static | Documentation |
| `api.degenfeed.xyz` | A | 152.53.80.39 | ☁️ proxied | nginx :80 → :3100 | API proxy to Next.js |
| `spaces.degenfeed.xyz` | CNAME | tunnel | ☁️ proxied | nginx :80 → static | Community Spaces |
| `redlib.degenfeed.xyz` | A | 152.53.80.39 | ❌ DNS only | :8281 | Redlib (Reddit proxy) |
| `rss-bridge.degenfeed.xyz` | A | 152.53.80.39 | ❌ DNS only | :8282 | RSS-Bridge |

### DNS Record Types Explained

- **CNAME to tunnel** (`*.cfargotunnel.com`): Traffic goes through Cloudflare Tunnel. The cloudflared service on the server proxies to the backend. Tunnel must have the hostname in its ingress config.
- **A record (proxied)**: Traffic goes to Cloudflare edge → origin server IP. Cloudflare terminates TLS, re-encrypts to origin. Nginx on :443 handles the request with Cloudflare Origin CA cert.
- **A record (DNS only)**: Traffic goes directly to server IP (no Cloudflare proxy). Nginx on :443 handles with Let's Encrypt or other cert.

### ⚠️ Known Issue: Tunnel Config

The tunnel (`talos-rmi-remote`) uses **cloudflare-managed remote config**. The local `/root/.cloudflared/config.yml` is **NOT authoritative** — the Cloudflare API pushes the ingress rules on tunnel startup. To update, use:

1. **Cloudflare Dashboard** → Zero Trust → Networks → Tunnels → `talos-rmi-remote` → Configure → Public Hostnames
2. Or update via API (requires valid token with Tunnel:Edit permission)

**Current API token status:** ✅ ACTIVE as of 2026-07-24
```
Token stored in: gopass path rmi/cloudflare/api_token_active
```

---

## 2. Nginx Configuration

### SSL Certificates

| Certificate | Path | Used By |
|-------------|------|---------|
| Cloudflare Origin CA | `/etc/ssl/certs/degenfeed-origin-ca.pem` | Most *.degenfeed.xyz vhosts |
| Cloudflare Origin Key | `/etc/ssl/private/degenfeed-origin.key` | Most *.degenfeed.xyz vhosts |
| Let's Encrypt (spaces) | `/etc/letsencrypt/live/spaces.degenfeed.xyz/` | spaces.degenfeed.xyz |
| Let's Encrypt (video) | `/etc/letsencrypt/live/video.degenfeed.xyz/` | video.degenfeed.xyz |
| Lacework (community) | `/etc/nginx/ssl/degenfeed.xyz.pem` | community.degenfeed.xyz |

### Active Configs (sites-enabled)

All configs live in `/etc/nginx/sites-available/` with symlinks in `/etc/nginx/sites-enabled/`.

| Config File | Server Name | Backend | Notes |
|------------|-------------|---------|-------|
| `degenfeed.xyz` | degenfeed.xyz, www.degenfeed.xyz | Static files + /api/ → :3100 | Landing page |
| `app.degenfeed.xyz` | app.degenfeed.xyz | :3100 | Next.js app |
| `social.degenfeed.xyz` | social.degenfeed.xyz | :8082 | GoToSocial |
| `talk.degenfeed.xyz` | talk.degenfeed.xyz | :8536 | Lemmy |
| `community.degenfeed.xyz` | community.degenfeed.xyz | :8536 | Lemmy (alt domain) |
| `post.degenfeed.xyz` | post.degenfeed.xyz | :3105 | Postiz |
| `blog.degenfeed.xyz` | blog.degenfeed.xyz | :8086 | WriteFreely |
| `video.degenfeed.xyz` | video.degenfeed.xyz | nginx → :9010 | PeerTube |
| `pds.degenfeed.xyz` | pds.degenfeed.xyz | :3012 | Bluesky PDS |
| `search.degenfeed.xyz` | search.degenfeed.xyz | :7700 | Meilisearch |
| `relay.degenfeed.xyz` | relay.degenfeed.xyz | :8084 | ActivityPub Relay |
| `nostr.degenfeed.xyz` | nostr.degenfeed.xyz | :8085 | Nostr Relay |
| `photos.degenfeed.xyz` | photos.degenfeed.xyz | :8087 | Pixelfed |
| `zora.degenfeed.xyz` | zora.degenfeed.xyz | :8091 | Zora API |
| `lens.degenfeed.xyz` | lens.degenfeed.xyz | :8099 | Lens Indexer |
| `docs.degenfeed.xyz` | docs.degenfeed.xyz | Static files | VitePress docs |
| `spaces.degenfeed.xyz` | spaces.degenfeed.xyz | Static | Spaces frontend |
| `redlib.degenfeed.xyz` | redlib.degenfeed.xyz | :8281 | Redlib |
| `rss-bridge.degenfeed.xyz` | rss-bridge.degenfeed.xyz | :8282 | RSS-Bridge |
| `api.degenfeed.xyz` | api.degenfeed.xyz | nginx :80 → :3100 | API routing |

### Common Nginx Pattern

All *.degenfeed.xyz configs follow this pattern:

```nginx
server {
    listen 80;
    server_name subdomain.degenfeed.xyz;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name subdomain.degenfeed.xyz;

    ssl_certificate /etc/ssl/certs/degenfeed-origin-ca.pem;
    ssl_certificate_key /etc/ssl/private/degenfeed-origin.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    location / {
        proxy_pass http://127.0.0.1:SERVICEPORT;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 3. Backend Services

### Docker Containers (Running)

| Container Name | Image | Port | Service For |
|---------------|-------|------|-------------|
| `gotosocial` | superseriousbusiness/gotosocial:0.22.0 | 8082 | social.degenfeed.xyz |
| `degenfeed-lemmy` | dessalines/lemmy:0.19.11 | 8536 | talk.degenfeed.xyz, community.degenfeed.xyz |
| `degenfeed-writefreely` | writeas/writefreely:latest | 8086 | blog.degenfeed.xyz |
| `degenfeed-postiz` | ghcr.io/gitroomhq/postiz-app:latest | 3105 | post.degenfeed.xyz |
| `degenfeed-pds` | ghcr.io/bluesky-social/pds:latest | 3012 | pds.degenfeed.xyz |
| `degenfeed-relay` | yukimochi/activity-relay:v2.0.10 | 8084 | relay.degenfeed.xyz |
| `degenfeed-relay-worker` | yukimochi/activity-relay:v2.0.10 | — | Relay background worker |
| `degenfeed-zora-indexer` | degenfeed-zora-indexer | 8091 | zora.degenfeed.xyz |
| `degenfeed-zora-anvil` | ghcr.io/foundry-rs/foundry:latest | 8546 | Zora testnet |
| `degenfeed-redlib` | quay.io/redlib/redlib:latest | 8281 | redlib.degenfeed.xyz |
| `peertube-peertube-1` | chocobozzz/peertube:production | 9011 | video.degenfeed.xyz |

### Services NOT Yet Running (planned)

| Subdomain | Port | Service | Status |
|-----------|------|---------|--------|
| photos.degenfeed.xyz | 8087 | Pixelfed | 🟡 Docker image not deployed |
| nostr.degenfeed.xyz | 8085 | Nostr Relay | 🟡 Docker image not deployed |
| search.degenfeed.xyz | 7700 | Meilisearch | 🟡 Docker image not deployed |
| lens.degenfeed.xyz | 8099 | Lens Indexer | 🟡 Docker image not deployed |

When these services are deployed, nginx and DNS are already configured — they just need the container to start.

---

## 4. SSL Certificate Management

### Cloudflare Origin CA (Most Services)

Used for proxied DNS records where Cloudflare terminates SSL and re-encrypts to origin.

```bash
# Generate new origin cert via Cloudflare Dashboard:
# SSL/TLS → Origin Server → Create Certificate
# Save to:
/etc/ssl/certs/degenfeed-origin-ca.pem
/etc/ssl/private/degenfeed-origin.key
```

### Let's Encrypt (Direct Access Services)

Used for DNS-only records or services that don't go through Cloudflare proxy.

```bash
certbot certonly --webroot -w /var/www/letsencrypt \
  -d spaces.degenfeed.xyz \
  --non-interactive --agree-tos -m admin@degenfeed.xyz
```

### Auto-renewal

Let's Encrypt certs auto-renew via systemd timer. Origin CA certs must be renewed manually (every 15 years by default).

---

## 5. Cloudflare Tunnel

### Service Status

```bash
systemctl status cloudflared
# Active: active (running)
```

### Restart After Config Change

```bash
systemctl restart cloudflared
```

### Config File

Located at `/root/.cloudflared/config.yml`
⚠️ Local config is IGNORED — tunnel uses Cloudflare-managed config.
To update: Cloudflare Dashboard → Zero Trust → Networks → Tunnels → talos-rmi-remote

### Credentials

| Credential | Location | Status |
|-----------|----------|--------|
| API Token | gopass: rmi/cloudflare/api_token_active | ✅ Active |
| Account ID | gopass: rmi/cloudflare/cloudflare_account_id | ✅ `8f9bd9165c1250b426c66dc1967deefd` |
| Tunnel Token | gopass: rmi/cloudflare/tunnel_token_talos_rmi_active | ✅ Valid |
| R2 Access Key | gopass: rmi/cloudflare/r2_degenfeed_access_key_id | ✅ Valid |
| cert.pem | `~/.cloudflared/cert.pem` | ❌ Missing (needed for `cloudflared tunnel route` CLI) |

### DNS API Token Usage

```bash
# Retrieve token from secure store
TOKEN=$(gopass show rmi/cloudflare/api_token_active)
ZONE_ID="116a9676c3358def6796910ccb96f1fc"

# List all DNS records
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records"

# Create A record
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"A","name":"subdomain.degenfeed.xyz","content":"152.53.80.39","ttl":120,"proxied":true}' \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records"

# Create CNAME to tunnel
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"CNAME","name":"subdomain.degenfeed.xyz","content":"9f428b88-5a57-4b28-a7dc-1368f4f32811.cfargotunnel.com","ttl":120,"proxied":true}' \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records"
```

---

## 6. Verification Checklist

```bash
# Test all subdomains locally (via nginx on port 443)
for site in degenfeed www app social talk community video \
            blog post relay pds docs api spaces zora \
            nostr photos lens search redlib rss-bridge; do
  code=$(curl -sk -o /dev/null -w '%{http_code}' \
    --resolve "${site}.degenfeed.xyz:443:127.0.0.1" \
    "https://${site}.degenfeed.xyz/" 2>/dev/null)
  echo "${site}.degenfeed.xyz: ${code}"
done

# Test tunnel ingress
curl -sk https://blog.degenfeed.xyz/
curl -sk https://zora.degenfeed.xyz/

# Check nginx
nginx -t
nginx -s reload

# Check tunnel
systemctl status cloudflared
journalctl -u cloudflared -n 10 | grep "Updated to new configuration"
```

### Expected HTTP Codes

| Code | Meaning |
|------|---------|
| 200 | Service is UP and returning content |
| 301/302 | Redirect (expected for social, www) |
| 307 | Temporary redirect (post.degenfeed.xyz) |
| 404 | Valid response (relay root page, API endpoints) |
| 502 | Backend not running (nostr, photos, search, lens) |
| 000 | SSL/cert issue (use `-k` flag) |

---

## 7. Service Port Map

```
Port  Service
───   ───────
80    nginx (HTTP)
443   nginx (HTTPS/SSL)
3012  Bluesky PDS
3100  Next.js (app)
3105  Postiz (scheduling)
7700  Meilisearch (search)
8082  GoToSocial (social)
8084  ActivityPub Relay
8085  Nostr Relay
8086  WriteFreely (blog)
8087  Pixelfed (photos)
8091  Zora API Indexer
8099  Lens Indexer
8281  Redlib
8282  RSS-Bridge
8536  Lemmy (talk/community)
9010  PeerTube backend
9011  PeerTube frontend
```

---

*Last updated: 2026-07-24 by devops-sre-ds*
*Next review: when new subdomains are added or tunnel config is changed*
