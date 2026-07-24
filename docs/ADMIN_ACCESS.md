# Admin Access Guide — DegenFeed Ecosystem

> **Last updated:** 2026-07-24
>
> All credentials stored in **gopass** — never commit secrets to git.
> Access gopass: `gopass show degenfeed/<service>/admin`

---

## Table of Contents

1. [GoToSocial (Mastodon-compatible)](#1-gotosocial)
2. [Lemmy (Community/Discussions)](#2-lemmy)
3. [PeerTube (Video)](#3-peertube)
4. [Pixelfed (Photos)](#4-pixelfed)
5. [WriteFreely (Blog)](#5-writefreely)
6. [Bluesky PDS (AT Protocol)](#6-bluesky-pds)
7. [Owncast (Live Streaming)](#7-owncast)
8. [Activity Relay (Fediverse Relay)](#8-activity-relay)
9. [Nostr Relay](#9-nostr-relay)
10. [DegenFeed Web App](#10-degenfeed-web-app)
11. [Emergency Procedures](#11-emergency-procedures)
12. [Gopass Setup](#12-gopass-setup)

---

## 1. GoToSocial

| Field | Value |
|-------|-------|
| **Service** | social.degenfeed.xyz |
| **Admin user** | `cryptorugmunch` |
| **Password** | `gopass show degenfeed/gotosocial/admin` |
| **Container** | `gotosocial` |
| **Local port** | `127.0.0.1:8082` |

### Access
- **Web UI**: https://social.degenfeed.xyz
- **API**: `https://social.degenfeed.xyz/api/v1/` (Mastodon-compatible)

### Password Reset (if needed)
```bash
docker exec gotosocial /gotosocial/gotosocial admin account password \
  --username cryptorugmunch --password NEWPASS
docker restart gotosocial
```

### OAuth Token (for API access)
```bash
# Register app (one-time)
APP=$(curl -s -X POST http://127.0.0.1:8082/api/v1/apps \
  -H "Content-Type: application/json" \
  -d '{"client_name":"Admin","redirect_uris":"urn:ietf:wg:oauth:2.0:oob","scopes":"read write admin"}')
CLIENT_ID=$(echo $APP | python3 -c "import sys,json; print(json.load(sys.stdin)['client_id'])")
CLIENT_SECRET=$(echo $APP | python3 -c "import sys,json; print(json.load(sys.stdin)['client_secret'])")

# Get token (authorization_code flow via web browser)
# GoToSocial does NOT support password grant — use the OAuth web flow
# Open https://social.degenfeed.xyz/oauth/authorize?client_id=$CLIENT_ID&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code&scope=read+write+admin
```

### Verify Admin Status
```bash
curl -s http://127.0.0.1:8082/api/v1/instance | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print('Admin:', d['contact_account']['username'], d['contact_account']['roles'])"
```

---

## 2. Lemmy

| Field | Value |
|-------|-------|
| **Service** | talk.degenfeed.xyz |
| **Admin user** | `degenfeed` |
| **Password** | `gopass show degenfeed/lemmy/admin` |
| **Container** | `degenfeed-lemmy` |
| **Local port** | `127.0.0.1:8536` |

### Access
- **Web UI**: https://talk.degenfeed.xyz
- **API**: `https://talk.degenfeed.xyz/api/v3/`

### Get JWT Token
```bash
JWT=$(curl -s -X POST http://127.0.0.1:8536/api/v3/user/login \
  -H "Content-Type: application/json" \
  -d "{\"username_or_email\":\"degenfeed\",\"password\":\"$(gopass show degenfeed/lemmy/admin)\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['jwt'])")

# Use token
curl -H "Authorization: Bearer $JWT" http://127.0.0.1:8536/api/v3/site
```

### Verify Admin Status
```bash
curl -s http://127.0.0.1:8536/api/v3/site | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print('Admins:', [a['person']['name'] for a in d.get('admins',[])])"
```

Expected output: `['degenfeed']`

---

## 3. PeerTube

| Field | Value |
|-------|-------|
| **Service** | video.degenfeed.xyz |
| **Admin user** | `root` |
| **Password** | `gopass show degenfeed/peertube/admin` |
| **Container** | `peertube-peertube-1` |
| **Local port** | `127.0.0.1:9011` |
| **OAuth Client ID** | `7ur31uojqchjzp6dwb9ld2mkbs2yt9dl` |
| **OAuth Client Secret** | `mZSbfaNh4vShtdhKJLP28PqoayEyBVqI` |

### Access
- **Web UI**: https://video.degenfeed.xyz
- **API**: `https://video.degenfeed.xyz/api/v1/`

### Get API Token
```bash
# From within the container (OAuth is hostname-restricted)
PT_TOKEN=$(docker exec peertube-peertube-1 node -e "
const http = require('http');
const qs = require('querystring');
const data = qs.stringify({
  client_id: '7ur31uojqchjzp6dwb9ld2mkbs2yt9dl',
  client_secret: 'mZSbfaNh4vShtdhKJLP28PqoayEyBVqI',
  grant_type: 'password',
  username: 'root',
  password: 'degenfeed_admin',
  scope: 'admin'
});
const options = {
  hostname: '127.0.0.1', port: 9000,
  path: '/api/v1/users/token', method: 'POST',
  headers: {'Host': 'video.degenfeed.xyz', 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(data)}
};
const req = http.request(options, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => console.log(JSON.parse(body).access_token || 'FAIL'));
});
req.write(data); req.end();
")
echo "Token: $PT_TOKEN"
```

### Password Reset (if needed)
```bash
# Generate new bcrypt hash inside container
HASH=$(docker exec peertube-peertube-1 node -e "
  const bcrypt = require('/app/node_modules/bcrypt');
  console.log(bcrypt.hashSync('NEWPASSWORD', bcrypt.genSaltSync(10)));
")
# Update in PostgreSQL
docker exec peertube-postgres-1 psql -U peertube -d peertube \
  -c "UPDATE \"user\" SET password = '${HASH}' WHERE username = 'root';"
```

---

## 4. Pixelfed

| Field | Value |
|-------|-------|
| **Service** | photos.degenfeed.xyz |
| **Admin user** | `photos_admin` |
| **Password** | Set during initial `artisan` user creation (not stored in gopass) |
| **Container** | `degenfeed-pixelfed` |
| **Local port** | `127.0.0.1:8087` |

### Access
- **Web UI**: https://photos.degenfeed.xyz
- **Admin**: Login as `photos_admin`, then https://photos.degenfeed.xyz/settings/admin

### Verify Admin Status
```bash
# Check via API
curl -s http://127.0.0.1:8087/api/v1/instance | python3 -c \
  "import sys,json; print(json.load(sys.stdin)['contact_account']['username'])"
# Expected: "photos_admin"

# Check via artisan
docker exec degenfeed-pixelfed php artisan tinker --execute="
  echo \App\User::whereUsername('photos_admin')->first()?->is_admin ? 'Admin: YES' : 'Admin: NO';
"
```

### Promote User to Admin
```bash
docker exec degenfeed-pixelfed php artisan user:admin photos_admin
# Select "no" when asked to remove admin privileges
```

### Create New Admin User
```bash
docker exec degenfeed-pixelfed php artisan user:create
# Follow prompts for username, email, password
docker exec degenfeed-pixelfed php artisan user:admin NEWUSERNAME
```

---

## 5. WriteFreely

| Field | Value |
|-------|-------|
| **Service** | blog.degenfeed.xyz |
| **Admin user** | `degenfeed` |
| **Password** | `gopass show degenfeed/writefreely/admin` |
| **Container** | `degenfeed-writefreely` |
| **Local port** | `127.0.0.1:8086` |

### Access
- **Web UI**: https://blog.degenfeed.xyz
- **Login**: POST to `https://blog.degenfeed.xyz/api/auth/login`

### Get API Token
```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8086/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"alias\":\"degenfeed\",\"pass\":\"$(gopass show degenfeed/writefreely/admin)\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")
echo "Token: $TOKEN"
```

### Password Reset
```bash
echo "NEWPASSWORD" | docker exec -i degenfeed-writefreely \
  /go/cmd/writefreely/writefreely user reset-pass degenfeed
# The binary is at /go/cmd/writefreely/writefreely inside the container
```

### Promote User to Admin
```bash
docker exec degenfeed-writefreely /go/cmd/writefreely/writefreely user create \
  --admin --user USERNAME --pass PASSWORD
```

---

## 6. Bluesky PDS

| Field | Value |
|-------|-------|
| **Service** | pds.degenfeed.xyz |
| **Admin password** | `gopass show degenfeed/bluesky/admin` |
| **PDS JWT Secret** | `gopass show degenfeed/bluesky/admin.meta` (JWT_SECRET field) |
| **PLC Rotation Key** | Stored in gopass |
| **Container** | `degenfeed-pds` |
| **Local port** | `127.0.0.1:3012` |

### Access
- **PDS Admin API**: `https://pds.degenfeed.xyz/xrpc/`

### Get Admin Session
```bash
SESSION=$(curl -s -X POST http://127.0.0.1:3012/xrpc/com.atproto.server.createSession \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"admin@degenfeed.xyz\",\"password\":\"$(gopass show degenfeed/bluesky/admin)\"}")
ACCESS_JWT=$(echo $SESSION | python3 -c "import sys,json; print(json.load(sys.stdin)['accessJwt'])")
echo "Access JWT: $ACCESS_JWT"
```

### Health Check
```bash
curl -s http://127.0.0.1:3012/xrpc/_health
# Expected: {"version":"0.4.5009"}
```

### Create Account
```bash
curl -s -X POST http://127.0.0.1:3012/xrpc/com.atproto.server.createAccount \
  -H "Content-Type: application/json" \
  -d '{"handle":"user.degenfeed.xyz","email":"user@example.com","password":"userpassword"}'
```

---

## 7. Owncast

| Field | Value |
|-------|-------|
| **Service** | live.degenfeed.xyz |
| **Admin password** | `gopass show degenfeed/owncast/admin` |
| **Stream key** | `degenfeed_stream` |
| **RTMP endpoint** | `rtmp://live.degenfeed.xyz/live` |
| **Container** | `owncast-owncast-1` |
| **Local port** | `8092` (web), `1935` (RTMP) |

### Access
- **Web UI**: https://live.degenfeed.xyz/admin
- **Admin login**: Password-protected web form at `/admin`

### Password Reset
```bash
# Generate new bcrypt hash
python3 -c "
import bcrypt
hashed = bcrypt.hashpw(b'NEWPASSWORD', bcrypt.gensalt(rounds=10)).decode()
hashed = hashed.replace('\$2b\$', '\$2a\$')
print(hashed)
" > /tmp/owncast_hash.txt

# Write to owncast DB with correct binary format
python3 -c "
import sqlite3
with open('/tmp/owncast_hash.txt') as f:
    hashed = f.read().strip()
hash_bytes = hashed.encode()
prefix = bytes([0x3f, 0x0c, 0x00, len(hash_bytes)]) + hash_bytes
db = sqlite3.connect('/srv/degenfeed/owncast/data/owncast.db')
db.execute(\"DELETE FROM datastore WHERE key='admin_password_key'\")
db.execute(\"INSERT INTO datastore(key, value, timestamp) VALUES ('admin_password_key', ?, datetime('now'))\", (prefix,))
db.commit()
db.close()
"
docker restart owncast-owncast-1
```

---

## 8. Activity Relay

| Field | Value |
|-------|-------|
| **Service** | relay.degenfeed.xyz |
| **Admin key** | `gopass show degenfeed/relay/admin` |
| **Type** | ActivityPub relay admin key |
| **Container** | `degenfeed-relay` |
| **Local port** | `127.0.0.1:8084` |

### Access
- No REST API — the admin key is used for signing ActivityPub federation requests.
- The relay accepts `Follow` activities from the admin key's actor to manage subscriptions.

### Verify Status
```bash
curl -s http://127.0.0.1:8084/.well-known/nodeinfo
# Expected: {"links":[{"rel":"http://nodeinfo.diaspora.software/ns/schema/2.1","href":"https://relay.degenfeed.xyz/nodeinfo/2.1"}]}
```

### Admin Key Usage
The `RELAY_ADMIN_KEY` in `/srv/degenfeed/relay/config.yml` is used by the relay worker
to sign ActivityPub activities. This is set automatically — no manual API calls needed.

---

## 9. Nostr Relay

| Field | Value |
|-------|-------|
| **Service** | nostr.degenfeed.xyz |
| **Admin pubkey** | `gopass show degenfeed/nostr/admin` |
| **Container** | `degenfeed-nostr-relay` |
| **Local port** | `127.0.0.1:8085` |

### Access
- **Relay**: `wss://nostr.degenfeed.xyz`
- The relay uses `nostr-rs-relay` which supports NIP-42 AUTH for moderation.
- Admin pubkey is set in `config.toml`.

### Verify
```bash
# nostr-rs-relay doesn't expose HTTP admin API
# Connect with a Nostr client using the admin pubkey's private key
curl -s http://127.0.0.1:8085/ 2>/dev/null
# Expected: "Please use a Nostr client to connect."
```

---

## 10. DegenFeed Web App

| Field | Value |
|-------|-------|
| **Service** | app.degenfeed.xyz |
| **Admin wallets** | `0x1e3ac01d0fdb976179790bdd02823196a92705c9` |
| **Container** | `degenfeed-web` |
| **Local port** | `127.0.0.1:3100` |

### Access
- **Web**: https://app.degenfeed.xyz
- **Admin Dashboard**: https://app.degenfeed.xyz/admin
- Connect the admin wallet (`0x1e3ac...`) via MetaMask/Phantom to access admin routes.

### Admin Routes
| Route | Description |
|-------|-------------|
| `/admin` | Dashboard overview |
| `/admin/content` | Content feed management |
| `/admin/moderation` | Moderation queue |
| `/admin/sources` | Source discovery |
| `/admin/users` | User management |
| `/admin/protocols` | Protocol configuration |
| `/admin/revenue` | Revenue dashboard |
| `/admin/hosts` | Server management |
| `/admin/system` | System configuration |

### Verify Admin Config
```bash
# Health check
curl -s http://127.0.0.1:3100/api/health
# Expected: {"status":"ok"}

# Admin wallets are set at build time via NEXT_PUBLIC_ADMIN_WALLETS build arg
# Current value: 0x1e3ac01d0fdb976179790bdd02823196a92705c9
```

### Adding Admin Wallets
1. Update `ADMIN_WALLETS` and `NEXT_PUBLIC_ADMIN_WALLETS` in `/srv/degenfeed/.env`
2. Update `docker-compose.yml` build args
3. Rebuild and restart: `docker compose build web && docker compose up -d web`

---

## 11. Emergency Procedures

### Password Lost — Docker Exec Recovery

If you lose admin access to any service, use Docker exec to reset:

```bash
# Emergency access checklist:
# 1. SSH into Talos (internal IP) or run locally
# 2. For each service, use the password reset commands listed above
# 3. Store new passwords in gopass

# Quick-access credential dump (requires gopass)
for entry in gotosocial lemmy peertube writefreely bluesky owncast relay; do
  echo "$entry: $(gopass show degenfeed/$entry/admin 2>/dev/null | head -1)"
done
```

### Service URLs Summary

| Service | URL | Port |
|---------|-----|------|
| GoToSocial | https://social.degenfeed.xyz | 8082 |
| Lemmy | https://talk.degenfeed.xyz | 8536 |
| PeerTube | https://video.degenfeed.xyz | 9011 |
| Pixelfed | https://photos.degenfeed.xyz | 8087 |
| WriteFreely | https://blog.degenfeed.xyz | 8086 |
| Bluesky PDS | https://pds.degenfeed.xyz | 3012 |
| Owncast | https://live.degenfeed.xyz | 8092 |
| Activity Relay | https://relay.degenfeed.xyz | 8084 |
| Nostr Relay | wss://nostr.degenfeed.xyz | 8085 |
| DegenFeed Web | https://app.degenfeed.xyz | 3100 |

### Container Restart Order
```bash
# If restarting everything:
docker start degenfeed-postgres degenfeed-redis degenfeed-pixelfed-db degenfeed-pixelfed-redis
docker start peertube-postgres-1 peertube-redis-1
docker start degenfeed-lemmy-db degenfeed-lemmy-pictrs
docker start gotosocial
docker start degenfeed-pds
docker start degenfeed-writefreely
docker start degenfeed-pixelfed
docker start degenfeed-lemmy
docker start peertube-peertube-1
docker start degenfeed-nostr-relay
docker start degenfeed-redlib
docker start degenfeed-web
docker start degenfeed-hubble
docker start owncast-owncast-1
```

---

## 12. Gopass Setup

### Initialize
```bash
gopass setup  # Interactive setup
```

### Store Admin Credentials
```bash
gopass insert degenfeed/gotosocial/admin
gopass insert degenfeed/lemmy/admin
gopass insert degenfeed/peertube/admin
gopass insert degenfeed/pixelfed/admin
gopass insert degenfeed/writefreely/admin
gopass insert degenfeed/bluesky/admin
gopass insert degenfeed/owncast/admin
gopass insert degenfeed/relay/admin
gopass insert degenfeed/nostr/admin
```

### Retrieve
```bash
gopass show degenfeed/gotosocial/admin
gopass ls degenfeed/
```

### Troubleshooting
- If gopass fails with git push error, disable auto-push:
  ```bash
  # Edit ~/.config/gopass/config and add:
  # autopush = false
  ```
- The gopass store is at `~/.local/share/gopass/stores/root/`
- Remote: `root@<internal-host>:/srv/git/gopass.git` (SSH key required)
