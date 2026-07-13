# CLOUDFLARE.md — DegenFeed Cloudflare Infrastructure

> **Status:** canonical · last_updated: 2026-07-10 (credentials verified expired on both Cinnabox + Talos)
> **Audience:** AI agents, engineers, operators
> **Purpose:** Single source of truth for Cloudflare configuration. Every agent reads this before touching CF.
> **TL;DR:** ALL API tokens expired. Tunnel push-config only has 3 hostnames. Need human to regenerate tokens in dashboard. See "What Needs Human Action" below.

---

## Quick Facts

| Item | Value |
|------|-------|
| Account ID | `8f9bd9165c1250b426c66dc1967deefd` |
| Account Email | `cryptorugmuncher@gmail.com` |
| Tunnel ID | `9f428b88-5a57-4b28-a7dc-1368f4f32811` |
| Tunnel Type | Named Tunnel (cloudflared, not Docker) |
| Tunnel Service | `systemd: cloudflared.service` |
| Zone | `degenfeed.xyz` (Cloudflare DNS, orange-cloud proxied) |

---

## Current Tunnel Configuration (API-pushed, NOT local config.yml)

The tunnel is managed via Cloudflare Dashboard API push, NOT by local `config.yml`. The local file at `/root/.cloudflared/config.yml` is **completely ignored** for ingress routing.

**Currently authorized hostnames (API-pushed config):**
```
cryptorugmunch.com → http://172.20.0.1:80
www.cryptorugmunch.com → http://172.20.0.1:80
blog.cryptorugmunch.com → http://172.20.0.1:80
fallback → http_status:404
```

**Hostnames in local config.yml but NOT API-authorized (return 404):**
```
social.degenfeed.xyz → http://127.0.0.1:8082   ← BLOCKING: GotoSocial unreachable
www.degenfeed.xyz    → http://localhost:80      ← BLOCKING: www redirect broken
degenfeed.xyz        → http://localhost:80      ← WORKING? (seems served by CF Pages by routing)
app.degenfeed.xyz    → http://localhost:80      ← WORKING? (proxied to Next.js :3100 via nginx)
docs.degenfeed.xyz   → http://localhost:80      ← 404 (VitePress not built)
w3social.xyz         → http://localhost:80
www.w3social.xyz     → http://localhost:80
```

---

## Credential Status

### ❌ EXPIRED / INVALID

**All stored Cloudflare API credentials are dead.** Every token and the global API key return `Invalid API Token` (HTTP 401) or `Invalid request headers` (HTTP 400). These must have been rotated/revoked.

| Gopass Path | Type | Prefix | Status |
|-------------|------|--------|--------|
| `rmi/cloudflare/api_key_global` | Global API Key | (hex64) | ❌ Invalid |
| `rmi/cloudflare/api_token_active` | API Token | `cfut_` | ❌ Invalid |
| `rmi/cloudflare/archive/cf_api_token_super` | API Token | `cfat_` | ❌ Invalid |
| All other `rmi/cloudflare/archive/*` tokens | Various | various | ❌ Invalid |
| `rmi/backend/cloudflare_api_token` | API Token | `cfat_` | ❌ Invalid |

### ⚠️ MISSING

| File | Path | Needed For |
|------|------|------------|
| `cert.pem` | `~/.cloudflared/cert.pem` | `cloudflared tunnel route dns`, `cloudflared tunnel info`, any CLI API operation |

Without `cert.pem`, `cloudflared tunnel` CLI cannot authenticate to the Cloudflare API. The tunnel process itself runs fine without it (uses `credentials.json` + `TunnelSecret` for connection only).

### ✅ VALID (non-API credentials)

| Gopass Path | Purpose |
|-------------|---------|
| `rmi/cloudflare/r2_degenfeed_access_key_id` | R2 S3 access key (GotoSocial media) |
| `rmi/cloudflare/r2_degenfeed_secret_access_key` | R2 S3 secret key |
| `rmi/cloudflare/tunnel_token_talos_rmi_active` | Tunnel connection token (base64 JSON) |
| `rmi/cloudflare/cloudflare_account_id` | Account ID |

### ✅ VALID (bypassed)

| Component | Path | Notes |
|-----------|------|-------|
| wrangler (CF Workers/Pages) | N/A | Uses `wrangler login` OAuth, likely still valid on user's local machine |
| CF Pages deploys | `.github/workflows/deploy.yml` | Uses `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` GitHub secrets — may still be valid |

---

## What Agents CAN Do Programmatically

| Operation | Feasible | How |
|-----------|----------|-----|
| **List tunnels** | ❌ No | Needs valid API token or cert.pem |
| **Get/Update tunnel config** | ❌ No | Needs valid API token with Tunnel:Edit |
| **Add tunnel hostnames** | ❌ No | Needs Cloudflare Dashboard or valid API token |
| **Manage DNS records** | ❌ No | Needs valid API token with DNS:Edit |
| **Deploy CF Workers/Pages** | ⚠️ Maybe | If `wrangler` is logged in on the machine |
| **Check R2 media** | ✅ Yes | `r2_degenfeed_access_key_id` + secret are valid |
| **Restart tunnel** | ✅ Yes | `systemctl restart cloudflared` (doesn't change config) |
| **Check tunnel status** | ✅ Yes | `systemctl status cloudflared`, `journalctl -u cloudflared` |

---

## What Needs Human Action

### FIX #1: Generate new API token (60 seconds)

1. Log in to Cloudflare Dashboard: `https://dash.cloudflare.com`
2. Go to **My Profile** → **API Tokens**
3. Create a new token with these permissions:
   - **Account** → **Cloudflare Tunnel** → **Edit**
   - **Zone** → **DNS** → **Edit** (for degenfeed.xyz)
   - **Account** → **Account Settings** → **Read**
4. Set TTL to something long (e.g., 1 year or no expiry)
5. Save the token in gopass:
   ```bash
   gopass insert rmi/cloudflare/api_token_active
   ```
6. Update this file's credential status section.

### FIX #2: Generate cert.pem for cloudflared CLI (30 seconds)

Once a valid API token exists, generate cert.pem:
```bash
# On Talos
export CLOUDFLARE_API_TOKEN="<new token>"
cloudflared tunnel login --token "${CLOUDFLARE_API_TOKEN}"
# This creates ~/.cloudflared/cert.pem
```

Then cloudflared CLI commands will work.

### FIX #3: Add degenfeed hostnames to tunnel (60 seconds)

**Option A — Cloudflare Dashboard (recommended):**
1. Cloudflare Dashboard → **Zero Trust** → **Networks** → **Tunnels**
2. Click tunnel `9f428b88-5a57-4b28-a7dc-1368f4f32811`
3. Click **Configure** → **Public Hostnames**
4. Add:
   - `social.degenfeed.xyz` → `http://127.0.0.1:8082` (GotoSocial)
   - `www.degenfeed.xyz` → `http://localhost:80` (redirect to apex)
   - `docs.degenfeed.xyz` → `http://localhost:80` (VitePress, after building)

**Option B — API (if new token + cert.pem exist):**
```bash
cloudflared tunnel route dns 9f428b88-5a57-4b28-a7dc-1368f4f32811 social.degenfeed.xyz
cloudflared tunnel route dns 9f428b88-5a57-4b28-a7dc-1368f4f32811 www.degenfeed.xyz
```

Then update the tunnel config via API to include these in the ingress (the DNS route alone creates the CNAME but the ingress needs the service mapping).

**Option C — Full local config push (if API token exists):**
```bash
# Push the local config.yml to Cloudflare
export CLOUDFLARE_API_TOKEN="<new token>"
cloudflared tunnel --config /root/.cloudflared/config.yml route dns 9f428b88-5a57-4b28-a7dc-1368f4f32811 social.degenfeed.xyz
# Then restart tunnel
systemctl restart cloudflared
# The local config.yml ingress will now be used
```

---

## Verification Checklist (after fix)

```bash
# 1. Tunnel is running and connected
systemctl status cloudflared
journalctl -u cloudflared -n 5 | grep "Registered tunnel connection"

# 2. social.degenfeed.xyz resolves to GotoSocial
curl -sI https://social.degenfeed.xyz/api/v1/instance
# Should return 200 with JSON instance info

# 3. www.degenfeed.xyz redirects to apex
curl -sI https://www.degenfeed.xyz
# Should return 301 → https://degenfeed.xyz

# 4. WebFinger works (federation ready)
curl -s https://social.degenfeed.xyz/.well-known/webfinger?resource=acct:cryptorugmunch@degenfeed.xyz
# Should return 200 with actor JSON

# 5. Post #1 can be created
# Visit https://app.degenfeed.xyz/auth/callback?code=... (OAuth flow)

# 6. CF API tokens verified
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer <NEW_TOKEN>" \
  "https://api.cloudflare.com/client/v4/user/tokens/verify"
# Should return 200
```

---

## Architecture Notes

### Why local config.yml is ignored

When a tunnel was created via the Cloudflare Dashboard (Zero Trust UI), the ingress configuration is stored server-side and pushed to the tunnel process on startup. The `cloudflared` process receives this config from the API and uses it, ignoring the local `config.yml` ingress section.

**Evidence from journalctl:**
```
"Updated to new configuration config={
  "ingress":[
    {"hostname":"cryptorugmunch.com",...},
    {"hostname":"www.cryptorugmunch.com",...},
    {"hostname":"blog.cryptorugmunch.com",...},
    {"service":"http_status:404"}
  ]
}"
```

The local `config.yml` has 30+ hostnames. The API-pushed config has only 3.

### What changed to cause this

The tunnel was initially configured when the server was set up for `rugmunch.io` domains. DegenFeed domains were added later to the local config but never pushed to Cloudflare. The API tokens expired, making it impossible to update via API/CLI.

### DNS records

All DNS is managed via Cloudflare with orange-cloud (proxied) mode. A and AAAA records exist for:
- `degenfeed.xyz`
- `app.degenfeed.xyz`
- `social.degenfeed.xyz` ← resolves but tunnel doesn't handle it → 404
- `www.degenfeed.xyz` ← resolves but tunnel doesn't handle it → 404
- `docs.degenfeed.xyz` ← resolves but no content → 404

---

## Related Files

| File | Purpose |
|------|---------|
| `/root/.cloudflared/config.yml` | Local tunnel config (30+ hostnames, IGNORED by running tunnel) |
| `/root/.cloudflared/credentials.json` | Tunnel credentials (AccountTag, TunnelSecret, TunnelID) |
| `/etc/systemd/system/cloudflared.service` | Tunnel systemd unit |
| `/srv/work/repos/degenfeed-web/scripts/deploy/setup-cloudflare.sh` | CF Pages/Worker setup script |
| `/srv/work/repos/degenfeed-web/workers/api/wrangler.toml` | CF Worker config (routes, KV, vars) |
| `/srv/work/repos/degenfeed-web/apps/web/wrangler.toml` | CF Pages config for Next.js |
| `/srv/work/repos/degenfeed-web/.github/workflows/deploy.yml` | CI/CD deploy pipeline |

---

## Gopass Reference

```
rmi/cloudflare/
├── api_key_global            ← Global API key (EXPIRED)
├── api_token_active          ← Active API token (EXPIRED)
├── cloudflare_account_id     ← Account ID (VALID)
├── r2_degenfeed_access_key_id    ← R2 S3 key (VALID)
├── r2_degenfeed_secret_access_key ← R2 S3 secret (VALID)
├── tunnel_token_talos_rmi_active ← Tunnel connection token (VALID)
├── cf_worker_cron_secret     ← Worker cron trigger secret
└── archive/                  ← Old tokens (ALL EXPIRED)
```

---

*Last updated: 2026-07-10*
*Next update: when new API tokens are generated*
