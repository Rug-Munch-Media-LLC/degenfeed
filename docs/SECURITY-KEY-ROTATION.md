# Security Key Rotation Guide — DegenFeed Web

> **Date:** 2026-07-28
> **Audit Context:** Post-security-audit key rotation for all authentication credentials, API keys, and secrets used by the DegenFeed Web application.

---

## How to Use This Document

Each key below lists:
1. **What it is** — purpose and scope
2. **Where it's used** — source files and configs
3. **How to rotate** — generation/creation steps
4. **Where to place the new key** — environments and services
5. **Verification** — how to confirm rotation succeeded

---

## 1. NOSTR_PRIVATE_KEY — Nostr Bot Identity

### What
Hex-encoded Nostr private key used by the application to sign events, publish notes, and interact with Nostr relays as the DegenFeed bot identity.

### Where Used (Source Files)
| File | Usage |
|------|-------|
| `apps/web/.env.example` (line 34) | Config template |
| `packages/cross-protocol-bridge/src/shorts-publisher.ts:278` | Read via `env.NOSTR_PRIVATE_KEY` |
| `packages/cross-protocol-bridge/src/engagement-sync.ts:273` | Nostr event signing |
| `packages/cross-protocol-bridge/src/live-publisher.ts:240` | Live stream announcements |
| `packages/spaces-bridge/src/nostr.ts:30` | Nostr adapter init |
| `packages/spaces-bridge/src/livephotos.ts:35` | Nostr photo publishing |
| `packages/realtime/src/cross-protocol-group-chat.ts:458` | Group chat Nostr signing |
| `workers/api/src/routes/loops-live.ts:397` | Loops live bridge |
| `workers/api/src/routes/live-gifts-handlers.ts:340,733` | Gift/tip Nostr events |
| `workers/api/src/routes/data-migrate.ts:762` | Data migration Nostr auth |

### How to Rotate
```bash
# Generate a new Nostr keypair (nsec + npub)
openssl rand -hex 32

# OR use nostr-tool
nostr-tool generate-keypair

# The hex private key goes in NOSTR_PRIVATE_KEY
# The nsec bech32 encoding: use same hex but encoded
```
Alternatively, generate via `nak`:
```bash
nak key generate
```

### Where to Place
| Target | Location |
|--------|----------|
| Cloudflare Workers | `workers/api` → `wrangler.toml` or Cloudflare Dashboard → `degenfeed-api` → Variables |
| Local development | `apps/web/.env` (NOT committed — gopass: `rmi/degenfeed/nostr-private-key`) |
| CI/CD | `.forgejo/workflows/deploy.yml` — add as Actions secret |

### Verification
1. Run `gitleaks detect --no-git` — must not flag the new key
2. Start dev server and check Nostr publishing works:
```bash
curl -s https://api.degenfeed.xyz/api/feed/nostr | head -5
```
3. Verify events signed by the new key are accepted by relays

---

## 2. GTS_ACCESS_TOKEN — GoToSocial/Mastodon OAuth Token

### What
OAuth 2.0 Bearer token for the DegenFeed bridging bot account on the GoToSocial instance (`social.degenfeed.xyz`). Used to cross-post and synchronize content between ActivityPub services.

### Where Used (Source Files)
| File | Usage |
|------|-------|
| `packages/cross-protocol-bridge/src/transforms/farcaster-to-mastodon.ts:20` | Cross-post FC→ActivityPub |
| `packages/realtime/src/protocol-transports.ts:588` | ActivityPub transport auth |
| `workers/api/src/routes/loops-live.ts:401` | Loops→GTS bridge check |

### How to Rotate

**Step 1 — Generate token on GoToSocial:**
```bash
# SSH to GTS host and create a token for the bot account
GTS_BOT_USER="degenfeed-bot"
GTS_INSTANCE="social.degenfeed.xyz"

# Create app registration (CLI on GoToSocial server)
gotosocial admin account create \
  --username "$GTS_BOT_USER" \
  --email "bot@degenfeed.xyz" \
  --password "<generated-password>"

# Generate OAuth2 token
gotosocial admin account token create \
  --username "$GTS_BOT_USER" \
  --client-name "DegenFeed Bridge"
```

**Step 2 — OR use OAuth2 flow (if GTS UI available):**
```
1. Navigate to https://social.degenfeed.xyz/oauth/authorize
2. Client ID: <GTS_CLIENT_ID>  (see .env.example line 64)
3. Redirect URI: https://app.degenfeed.xyz/auth/callback
4. Approve and copy the code → exchange for token
```

### Where to Place
| Target | Location |
|--------|----------|
| Production env | gopass: `rmi/degenfeed/gts-access-token` |
| Dev env | `apps/web/.env` — set `GTS_ACCESS_TOKEN=<new_token>` |
| Cloudflare Workers | Dashboard → `degenfeed-api` → `GTS_ACCESS_TOKEN` secret |

### Verification
```bash
# Test the token
curl -H "Authorization: Bearer $GTS_ACCESS_TOKEN" \
  https://social.degenfeed.xyz/api/v1/accounts/verify_credentials
# Should return the bot account info

# Test posting
curl -X POST -H "Authorization: Bearer $GTS_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"Key rotation test — delete me"}' \
  https://social.degenfeed.xyz/api/v1/statuses
```

---

## 3. GTS_CLIENT_ID & GTS_CLIENT_SECRET — GoToSocial OAuth App

### What
OAuth 2.0 application credentials for the DegenFeed web app to authenticate users via GoToSocial.

### Where Used
`apps/web/.env.example` (lines 64-65)

### How to Rotate
```bash
# On the GoToSocial server CLI
gotosocial admin oauth create \
  --application-name "DegenFeed Web" \
  --redirect-uris "https://app.degenfeed.xyz/auth/callback,http://localhost:3000/auth/callback" \
  --scopes "read write follow push"
```
Alternatively, register via the Mastodon-compatible API:
```bash
curl -X POST https://social.degenfeed.xyz/api/v1/apps \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "DegenFeed Web",
    "redirect_uris": "https://app.degenfeed.xyz/auth/callback",
    "scopes": "read write follow push"
  }'
```

### Where to Place
gopass: `rmi/degenfeed/gts-oauth`

---

## 4. AUTH_SECRET — Session/JWT Signing Key

### What
Secret used for signing user sessions, JWT tokens, and encrypted cookies. Must be a strong random string (min 32 bytes).

### Where Used
`apps/web/.env.example` (line 12)

### How to Rotate
```bash
# Generate a strong secret
openssl rand -base64 32

# OR
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Where to Place
| Target | Location |
|--------|----------|
| Production | gopass: `rmi/degenfeed/auth-secret` |
| Cloudflare Pages | Environment → `AUTH_SECRET` |

> **⚠️ Note:** Rotating AUTH_SECRET invalidates all existing sessions. Plan for a maintenance window.

---

## 5. Postiz API Keys (POSTIZ_API_KEY, ADMIN_API_KEY, PUSH_API_KEY, NEWSLETTER_API_KEY)

### What
Keys for the Postiz social scheduling service and internal scoped API keys.

### Where Used
`apps/web/.env.example` (lines 186, 203-205)

### How to Rotate

**POSTIZ_API_KEY:** Generate in Postiz admin UI at `https://postiz.degenfeed.xyz/admin/settings`

**ADMIN_API_KEY (deprecated):** Replace with scoped keys (PUSH_API_KEY, NEWSLETTER_API_KEY):
```bash
openssl rand -base64 32
```

### Where to Place
gopass: `rmi/degenfeed/postiz-api-key`

---

## 6. OAuth Client Credentials (Google, GitHub, Discord, Twitter, Reddit, PeerTube, Threads)

### What
OAuth application credentials for social login and protocol integration.

### Where Used
`apps/web/.env.example` (lines 86-100)

### How to Rotate

For each service:
1. **Google** — https://console.cloud.google.com → APIs & Services → Credentials
2. **GitHub** — https://github.com/settings/developers → OAuth Apps
3. **Discord** — https://discord.com/developers/applications
4. **Twitter/X** — https://developer.twitter.com → Projects & Apps
5. **Reddit** — https://www.reddit.com/prefs/apps
6. **PeerTube** — Managed in the PeerTube instance dashboard
7. **Threads** — Meta Developer Portal

**Standard rotation steps:**
1. Log into developer console for each service
2. Find the OAuth app for DegenFeed
3. Generate new client secret
4. Update redirect URIs if needed (must include `https://app.degenfeed.xyz/auth/callback`)
5. Copy new client ID and secret

### Where to Place
gopass: `rmi/degenfeed/oauth-<provider>`

---

## 7. PINATA_API_KEY & PINATA_SECRET_KEY — IPFS Pinata

### What
Credentials for Pinata IPFS pinning service, used to upload and pin NFT metadata and content.

### Where Used
`apps/web/.env.example` (lines 140-141)

### How to Rotate
1. Log in to https://app.pinata.cloud
2. Navigate to API Keys
3. Generate new key with appropriate scopes (pinFile, pinJSONToIPFS, etc.)
4. Copy API Key and Secret Key

### Where to Place
gopass: `rmi/degenfeed/pinata`

---

## 8. VAPID_PRIVATE_KEY — Web Push Notifications

### What
Voluntary Application Server Identification (VAPID) key for Web Push API. Used to send push notifications to user browsers.

### Where Used
`apps/web/.env.example` (line 148)

### How to Rotate
```bash
# Generate VAPID keypair
npx web-push generate-vapid-keys

# Output:
# ============================================================
# Public Key:
# BBI...
# Private Key:
# ...
```

### Where to Place
gopass: `rmi/degenfeed/vapid-private`

---

## 9. NEYNAR_API_KEY — Farcaster Neynar API

### What
API key for the Neynar Farcaster API, used for hub queries and Farcaster data access.

### Where Used
`apps/web/.env.example` (line 42)

### How to Rotate
1. Log in to https://dev.neynar.com/
2. Navigate to API Keys → Generate new key
3. Replace the existing key

### Where to Place
gopass: `rmi/degenfeed/neynar-api-key`

---

## 10. Cloudflare API Tokens

### What
Tokens used for Cloudflare Pages deployment, Workers management, and DNS management.

### Where Used
- `.forgejo/workflows/deploy.yml` — CI/CD deployment
- Local dev scripts — `wrangler.toml` references

### How to Rotate
1. Log in to https://dash.cloudflare.com/profile/api-tokens
2. Find the `DegenFeed Deploy` token (or create new):
   - Permissions: Workers:Edit, Pages:Edit, DNS:Edit
   - Resources: zone `degenfeed.xyz`, account `rugmunch`
3. Generate new token and copy immediately

### Where to Place
| Target | Location |
|--------|----------|
| CI/CD | Forgejo → Settings → Actions Secrets → `CLOUDFLARE_API_TOKEN` |
| Local | gopass: `rmi/degenfeed/cloudflare-api-token` |

### Verification
```bash
# Test new token
curl -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  https://api.cloudflare.com/client/v4/user/tokens/verify
# Should return {"success":true,"result":{"id":"...","status":"active"}}

# Verify deployment
npx wrangler whoami
```

---

## 11. MASTODON_ACCESS_TOKEN — Fallback ActivityPub Auth

### What
Fallback token used when `GTS_ACCESS_TOKEN` is not set. Used by some bridge modules for ActivityPub authentication.

### Where Used
`packages/realtime/src/protocol-transports.ts:588` — `env.GTS_ACCESS_TOKEN || env.MASTODON_ACCESS_TOKEN`

### Rotation
Same procedure as GTS_ACCESS_TOKEN (#2 above), but generated against the GoToSocial instance directly.

---

## Rotation Summary

| # | Key | Priority | Rotation Frequency | Rotation Method |
|---|-----|----------|-------------------|-----------------|
| 1 | NOSTR_PRIVATE_KEY | **Critical** | Every 90 days or on compromise | CLI key generation |
| 2 | GTS_ACCESS_TOKEN | **High** | Every 90 days | OAuth flow or GTS CLI |
| 3 | GTS_CLIENT_ID/SECRET | **High** | Every 180 days | OAuth app registration |
| 4 | AUTH_SECRET | **Critical** | Every 180 days (plan for session invalidation) | `openssl rand -base64 32` |
| 5 | POSTIZ_API_KEY | Medium | Every 180 days | Postiz admin UI |
| 6 | OAuth client secrets | Medium | Every 180 days or on breach | Each provider's dev console |
| 7 | PINATA_API_KEY/SECRET | Medium | Every 180 days | Pinata dashboard |
| 8 | VAPID_PRIVATE_KEY | Low | Every 365 days | `npx web-push generate-vapid-keys` |
| 9 | NEYNAR_API_KEY | Medium | Every 90 days | Neynar dashboard |
| 10 | Cloudflare API Token | **High** | Every 90 days | Cloudflare dashboard |
| 11 | MASTODON_ACCESS_TOKEN | Low | Every 180 days | GTS OAuth |

---

## Secret Storage

All production secrets **MUST** be stored in gopass:

```bash
# Set up gopass store
gopass setup

# Store each rotated key
gopass insert rmi/degenfeed/nostr-private-key
gopass insert rmi/degenfeed/gts-access-token
gopass insert rmi/degenfeed/gts-oauth
gopass insert rmi/degenfeed/auth-secret
gopass insert rmi/degenfeed/postiz-api-key
gopass insert rmi/degenfeed/pinata
gopass insert rmi/degenfeed/vapid-private
gopass insert rmi/degenfeed/neynar-api-key
gopass insert rmi/degenfeed/cloudflare-api-token

# Verify
gopass list rmi/degenfeed/
```

After rotation, **DO NOT** commit `.env` files with real values. The `.lefthook.yml` pre-commit hook blocks `.env` files automatically.

---

## Post-Rotation Verification Checklist

After rotating any key, run:

```bash
# 1. Full gitleaks scan
cd /srv/work/repos/degenfeed-web && gitleaks detect --no-git --config .gitleaks.toml -v

# 2. Full gitleaks scan on Elk app (if applicable)
cd /root/degenfeed && gitleaks detect --no-git -v

# 3. Verify the affected service works
# (Specific verification commands listed per key above)

# 4. Check that dev env works
cd /srv/work/repos/degenfeed-web && lefthook run pre-commit

# 5. Commit and push
git add -A && git commit -m "chore(security): rotate <key-name>" && git push
