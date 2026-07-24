# DegenFeed Network Ownership Verification

**Verification Date:** 2026-07-24  
**Verifier:** DevOps SRE (Network Ownership Audit)  
**Status:** 🟢 10/13 protocols self-hosted, 7 fully verified as owned

---

## Verification Matrix

| # | Protocol | Service | Port | Self-Hosted | Ownership Verified | Can Create Content | Federating | DNS Resolves |
|---|----------|---------|------|-------------|-------------------|-------------------|------------|-------------|
| 1 | **ActivityPub** | GoToSocial | 8082 | 🟢 Yes | 🟢 Yes | 🟢 Yes (via admin CLI) | 🟡 No users following remote | 🟢 social.degenfeed.xyz |
| 2 | **ActivityPub** | Lemmy | 8536 | 🟢 Yes | 🟢 Yes | 🟢 Yes (post #12 created) | 🟢 Federation enabled, 3 communities | 🟢 talk.degenfeed.xyz |
| 3 | **ActivityPub** | PeerTube | 9011 | 🟢 Yes | 🟢 Yes | 🟡 Root password mismatch | 🟢 Federation enabled | 🟢 video.degenfeed.xyz |
| 4 | **ActivityPub** | WriteFreely | 8086 | 🟢 Yes | 🟢 Yes | 🟢 Yes (user created) | 🟢 ActivityPub enabled | 🔴 blog.degenfeed.xyz NXDOMAIN |
| 5 | **ActivityPub** | Activity Relay | 8084 | 🟢 Yes | 🟢 Yes | 🟡 Running, no subscriptions | 🟡 Configured, idle | 🟢 relay.degenfeed.xyz |
| 6 | **ActivityPub** | Pixelfed | 8087 | 🔴 Not deployed | ❌ N/A | ❌ N/A | ❌ N/A | 🔴 N/A |
| 7 | **AT Protocol** | Bluesky PDS | 3012 | 🟢 Yes | 🟢 Yes | 🟢 Yes (skeet created) | 🟢 Connected to bsky.network | 🟢 pds.degenfeed.xyz |
| 8 | **Nostr** | Nostr Relay | 8085 | 🟢 Yes | 🟢 Yes | 🟢 Yes (ownership note published) | 🟡 External relays as fallback (damus.io, nos.lol) | ❌ N/A (local only) |
| 9 | **Farcaster** | Hubble | 2281 | 🔴 Not deployed | ❌ N/A | 🟡 External API only | 🟡 External (pinata.cloud) | ❌ N/A |
| 10 | **Lens** | Lens Indexer | 8099 | 🔴 Not deployed | ❌ N/A | 🟡 External API only | 🟡 External (api.lens.xyz) | ❌ N/A |
| 11 | **Zora** | Zora Node | 8546 | 🟢 Yes (local test) | 🟡 Testnet only | 🟡 Local dev chain | ❌ Local only (chain ID 31337) | ❌ N/A |
| 12 | **Zora** | Zora Indexer | 8091 | 🟢 Yes | 🟡 Empty DB | 🟡 Connected to external RPC | 🟡 External (rpc.zora.energy) | ❌ N/A |
| 13 | **Reddit** | Redlib | 8281 | 🟢 Yes | 🟢 Yes | 🟢 Proxy running | 🟢 Proxies reddit.com | ❌ N/A |

---

## 1. ACTIVITYPUB PROTOCOLS

### 1.1 GoToSocial — `social.degenfeed.xyz` (port 8082)

**Status:** 🟢 OWNED — Full administrative control

**Verified:**
- ✅ Instance: "DegenFeed — The web3 social feed" (v0.22.0)
- ✅ Admin users in SQLite: `cryptorugmunch`, `feed_bot`, `degenfeed` (all admin)
- ✅ Admin CLI access: password reset executed successfully
- ✅ OAuth app token obtained (`read write admin` scope)
- ✅ S3 storage: `degenfeed-media` bucket on Cloudflare R2
- ✅ DNS: `social.degenfeed.xyz` → Cloudflare (188.114.x.x)
- ✅ Email: `admin@degenfeed.xyz`, SMTP configured via `noreply@degenfeed.xyz`
- ✅ Custom dark theme applied (X/Twitter aesthetic)

**Cannot Do:**
- ⚠️ No user-level OAuth token for posting via API (requires browser auth_code flow)
- ⚠️ Peers list empty — instance not yet federating with other instances
- ⚠️ Registrations disabled, approval required

**How to Manage:**
```bash
# Docker
cd /srv/degenfeed/gotosocial && docker compose up -d

# Admin CLI (password reset, user management)
docker exec gotosocial /gotosocial/gotosocial admin account list
docker exec gotosocial /gotosocial/gotosocial admin account password --username cryptorugmunch --password NEWPASSWORD

# Config
vim /srv/degenfeed/gotosocial/config.yaml       # restart after changes
vim /srv/degenfeed/gotosocial/.env               # secrets
```

**Admin Credentials:**
| User | Role | Password Location |
|------|------|-------------------|
| `cryptorugmunch` | Admin/Moderator | Set via CLI (`b775d23e...` may be old) |
| `degenfeed` | Admin | Set via CLI |
| `feed_bot` | Admin | Set via CLI |

**Adding Users:**
```bash
# Via CLI (preferred — registrations are disabled)
docker exec gotosocial /gotosocial/gotosocial admin account create --username NEWUSER --email user@example.com --password SECUREPASS
docker exec gotosocial /gotosocial/gotosocial admin account promote --username NEWUSER
```

**OAuth API Access (for bots):**
1. Register an app: `POST /api/v1/apps` with scopes `read write admin`
2. Do authorization_code flow via browser to get user token
3. Use token for `Authorization: Bearer` headers

---

### 1.2 Lemmy — `talk.degenfeed.xyz` (port 8536)

**Status:** 🟢 OWNED — Full admin access, content creation verified

**Verified:**
- ✅ Instance: "DegenFeed Social" (actor_id: `https://talk.degenfeed.xyz/`)
- ✅ Admin user `degenfeed` authenticated (JWT obtained)
- ✅ Post #12 created: "Network Ownership Verified - DegenFeed"
  - URL: `https://talk.degenfeed.xyz/post/12`
- ✅ Communities:
  - `!degenfeed@talk.degenfeed.xyz` — DegenFeed Web3 Social Feed (1 subscriber)
  - `!main@talk.degenfeed.xyz` — main (432 subscribers)
  - `!crypto@talk.degenfeed.xyz` — crypto (32 subscribers)
- ✅ Federation enabled
- ✅ Site setup complete
- ✅ DNS: `talk.degenfeed.xyz` → Cloudflare

**Admin Credentials:**
| User | Password | Notes |
|------|----------|-------|
| `degenfeed` | `b775d23e7fbc25734f89c601f28332b7` | Full admin access |
| (DB) | JWT secret: `5e90dc2ffb47f8233fef33403e1cd9d94f0cda538492aa81f07e09e41a6305f5` | In `/srv/degenfeed/lemmy/.env` |

**How to Manage:**
```bash
# Docker
cd /srv/degenfeed/lemmy && docker compose up -d

# API (authenticated with JWT)
curl -X POST 'http://127.0.0.1:8536/api/v3/user/login' \
  -H "Content-Type: application/json" \
  -d '{"username_or_email":"degenfeed","password":"b775d23e7fbc25734f89c601f28332b7"}'

# Env
cat /srv/degenfeed/lemmy/.env
```

**Adding Users:**
Currently registration is disabled (private instance). To add users:
1. Temporarily enable registration in Lemmy config
2. Or create via DB directly
3. Or use the admin panel at `https://talk.degenfeed.xyz`

---

### 1.3 PeerTube — `video.degenfeed.xyz` (port 9011)

**Status:** 🟢 OWNED — Instance running, 5 videos, root user exists

**Verified:**
- ✅ Instance: "DegenFeed Video" (videos: 5)
- ✅ Root account exists (username: `root`, id: 1)
- ✅ OAuth client obtained: `client_id=7ur31uojqchjzp6dwb9ld2mkbs2yt9dl`
- ✅ 5 videos uploaded by root user
- ✅ Federation enabled
- ✅ Live streaming enabled
- ✅ DNS: `video.degenfeed.xyz` → Talos (152.53.80.39) — direct IP
- ✅ S3-compatible storage configured

**Known Issue:** Root password from env (`PT_INITIAL_ROOT_USER_PASSWORD`) may not match the bcrypt hash in the database. The hash in the DB is `$2b$10$.rWoFCooCCB0yO3TwpuNuuW1ZzfM0YWGX0SHgS7wZdCHsuAL/7sZa` which may correspond to a different password.

**Videos Currently Hosted:**
1. "Welcome to DegenFeed - Decentralized Social Media"
2. "What is ActivityPub? The Fediverse Protocol Explained"
3. "Web3 Is The Future - Decentralize Everything"
4. "Building on Nostr - The Simple Decentralized Protocol"
5. "Crypto Security Tips - Not Your Keys, Not Your Crypto"

**How to Manage:**
```bash
# Docker
cd /srv/degenfeed/peertube && docker compose up -d

# Reset root password via DB:
docker exec peertube-postgres-1 psql -U peertube -d peertube \
  -c "UPDATE public.\"user\" SET password = '\$2b\$10\$NEWHASH' WHERE username = 'root';"

# Or use the OAuth client to get a token:
curl -X POST http://127.0.0.1:9011/api/v1/users/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'client_id=7ur31uojqchjzp6dwb9ld2mkbs2yt9dl&client_secret=mZSbfaNh4vShtdhKJLP28PqoayEyBVqI&grant_type=password&username=root&password=RESETPASSWORD&scope=admin'
```

**Adding Users:**
Signup is disabled. Enable via env: `PEERTUBE_SIGNUP_ENABLED=true`
Or create via admin API with OAuth token.

---

### 1.4 WriteFreely — `blog.degenfeed.xyz` (port 8086)

**Status:** 🟢 OWNED — Blog instance running, admin user created

**Verified:**
- ✅ Instance: "DegenFeed Blog" (site_name in config)
- ✅ User `dfadmin` created successfully
- ✅ Login API works (token obtained)
- ✅ ActivityPub federation enabled
- ✅ Remote follow enabled
- ✅ WebFinger enabled
- ✅ Config: `/srv/degenfeed/writefreely/config.ini`
- ✅ Docker volume mount: persistent data at `/srv/degenfeed/writefreely/data`

**Note:** The user `dfadmin` is NOT marked as admin in the response (`isAdmin: None`). The `--admin` flag during user creation may not have taken effect.

**Known Issue:** Domain `blog.degenfeed.xyz` does NOT resolve in DNS (NXDOMAIN). The blog is configured as `hidden_host = blog.degenfeed.xyz` but the DNS record needs to be added.

**Admin Credentials:**
| User | Password | Role |
|------|----------|------|
| `dfadmin` | `Verif1ed!` | User (not admin — needs promotion) |
| `degenfeed` | (needs reset) | Admin (listed in config `admin_users`) |

**How to Manage:**
```bash
# Docker
cd /srv/degenfeed/writefreely && docker compose up -d

# Create user
docker exec degenfeed-writefreely /go/cmd/writefreely/writefreely -c /go/config.ini user create USERNAME:PASSWORD

# Reset password (interactive)
docker exec -it degenfeed-writefreely /go/cmd/writefreely/writefreely -c /go/config.ini user reset-pass USERNAME

# Make admin — edit config.ini and add to admin_users list
vim /srv/degenfeed/writefreely/config.ini
# Restart: docker compose restart degenfeed-writefreely
```

**Adding Users:**
```bash
# Via CLI
docker exec degenfeed-writefreely /go/cmd/writefreely/writefreely -c /go/config.ini user create newuser:password
```

---

### 1.5 Activity Relay — `relay.degenfeed.xyz` (port 8084)

**Status:** 🟡 DEPLOYED but IDLE — No subscriptions, 0 users

**Verified:**
- ✅ Software: `activity-relay` v2.0.10 (yukimochi/Activity-Relay)
- ✅ Domain: `relay.degenfeed.xyz` → Cloudflare
- ✅ Config: `/srv/degenfeed/relay/config.yml`
- ✅ Redis connected
- ✅ NodeInfo available at `/nodeinfo/2.1`
- ✅ Open registrations: true

**Issues:**
- ⚠️ 0 users, 0 active
- ⚠️ No inbound/outbound services
- ⚠️ No relay subscriptions configured
- ⚠️ No subscriptions at `/api/subscription/list`

**How to Manage:**
```bash
# Config
cat /srv/degenfeed/relay/config.yml

# Add subscription (to start relaying)
curl -X POST http://127.0.0.1:8084/api/subscribe \
  -H "Content-Type: application/json" \
  -d '{"domain": "relay.degenfeed.xyz"}'

# View subscriptions
curl http://127.0.0.1:8084/api/subscription/list

# Docker
docker compose -f /srv/degenfeed/relay/docker-compose.yml up -d
```

---

### 1.6 Pixelfed — `pixelfed.degenfeed.xyz` (port 8087)

**Status:** 🔴 NOT DEPLOYED

**Verified:**
- ❌ No container running on port 8087
- ❌ No container image exists
- 🟡 Env file exists: `/srv/degenfeed/pixelfed.env` (config but not deployed)
- 🟡 App key is empty: `APP_KEY=` (needs `php artisan key:generate`)

To deploy, Pixelfed requires MySQL, Redis, and a worker queue. See `scripts/infra/docker-compose.full.yml`.

---

## 2. AT PROTOCOL — Bluesky PDS

### Bluesky PDS — `pds.degenfeed.xyz` (port 3012)

**Status:** 🟢 OWNED — Full account creation and posting verified

**Verified:**
- ✅ PDS version: 0.4.5009
- ✅ Server DID: `did:web:pds.degenfeed.xyz`
- ✅ Available user domains: `.degenfeed.xyz`
- ✅ Invite codes: NOT required (`inviteCodeRequired: false`)
- ✅ **Account created:** `df-admin.degenfeed.xyz` (DID: `did:plc:2kunfxxjckvzvrmeiqon5pc6`)
- ✅ **Skeet posted:** URI `at://did:plc:2kunfxxjckvzvrmeiqon5pc6/app.bsky.feed.post/3mrfnwn6u5k2b`
- ✅ Session authentication works
- ✅ DNS: `pds.degenfeed.xyz` → Cloudflare
- ✅ Connected to bsky.network for crawling (`PDS_CRAWLERS=https://bsky.network`)

**Admin Credentials:**
| Field | Value |
|-------|-------|
| Admin Password | `PV2fBHuwu3zdKpT6+QbtW2uD80Hk5eeB` (in `/srv/degenfeed/pds/.env`) |
| JWT Secret | `67e1e9638a4c48fdcf8397b97435cab597740a32b82ece13251d566278e12252` |
| PLC Rotation Key | `dbb35a9990acdb2a1baf6d4002b6a987b9f8e886ec04002d0c016fe48142805e` |
| Service Handle Domains | `.degenfeed.xyz` |

**How to Manage:**
```bash
# Docker
cd /srv/degenfeed/pds && docker compose up -d

# Create account
curl -s -X POST http://127.0.0.1:3012/xrpc/com.atproto.server.createAccount \
  -H "Content-Type: application/json" \
  -d '{"handle":"user.degenfeed.xyz","email":"user@example.com","password":"SECURE_PASS"}'

# Create session
curl -s -X POST http://127.0.0.1:3012/xrpc/com.atproto.server.createSession \
  -H "Content-Type: application/json" \
  -d '{"identifier":"handle.degenfeed.xyz","password":"SECURE_PASS"}'

# Post a skeet (authenticated)
curl -s -X POST http://127.0.0.1:3012/xrpc/com.atproto.repo.createRecord \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_JWT" \
  -d '{"repo":"$DID","collection":"app.bsky.feed.post","record":{"$type":"app.bsky.feed.post","text":"Hello from DegenFeed!","createdAt":"2026-07-24T00:00:00.000Z"}}'
```

**Adding Users:**
```bash
# No invite codes needed — just create account via API
curl -X POST http://127.0.0.1:3012/xrpc/com.atproto.server.createAccount \
  -H "Content-Type: application/json" \
  -d '{"handle":"newuser.degenfeed.xyz","email":"user@degenfeed.xyz","password":"SECURE"}'
```

---

## 3. NOSTR

### Nostr Relay — `ws://127.0.0.1:8085` (port 8085)

**Status:** 🟢 OWNED — Self-hosted relay, verified ownership note published

**Verified:**
- ✅ **Image:** `scsibug/nostr-rs-relay:latest` from Docker Hub (no GHCR auth needed)
- ✅ **Container:** `degenfeed-nostr-relay` running via docker-compose
- ✅ **Port:** `127.0.0.1:8085` (host) → `8080` (container)
- ✅ **Name:** "DegenFeed Nostr"
- ✅ **NIP-11 info:** Returns relay metadata with name, description, pubkey
- ✅ **NIPs supported:** 1, 2, 9, 11, 12, 15, 16, 20, 22, 33, 40
- ✅ **NIP-05 verification:** Enabled for `degenfeed.xyz` domain
- ✅ **Admin pubkey:** `0307fc061381e9a4d66111a67fd863e2e7d3ceb70bf011b46192015a80df6bbf`
- ✅ **Ownership note:** Published to relay and verified via WebSocket query
- ✅ **Event persistence:** SQLite database on `nostr_data` volume (Docker volume)
- ✅ **Persistence verified after restart:** Events survive container restart
- ✅ **Bridge:** `bridge/src/providers/nostr.ts` reads from local relay as primary
- ✅ **External fallback:** damus.io, nos.lol, relay.primal.net, etc. still configured for federation
- ✅ **Config:** `/srv/degenfeed/nostr-relay/config.toml`
- ✅ **Resource limits:** CPU 0.5, RAM 256M, no-new-privileges, read-only rootfs
- ✅ **Admin private key:** Stored in gopass (`degenfeed/nostr/admin-privkey`)

**NIP-05 Verification:**

The relay is configured to verify NIP-05 identities against `degenfeed.xyz`.
When exposed publicly, users can claim `user@degenfeed.xyz` by adding their
pubkey to `https://degenfeed.xyz/.well-known/nostr.json`.

**Admin Keys:**
| Key | Value |
|-----|-------|
| Admin Pubkey (hex) | `0307fc061381e9a4d66111a67fd863e2e7d3ceb70bf011b46192015a80df6bbf` |
| Admin npub | `npub1nqf6mxwx9u9hltg4dhcevj5ltvcn3rx4ml2ktha9z5848p9u80kse0sujf` |
| Admin nsec | Stored in gopass (`degenfeed/nostr/admin-privkey`) |

**Configuration:**
| Setting | Value |
|---------|-------|
| Event retention | 30 days |
| Max event size | 100KB |
| Max subscriptions | 64 |
| Database | SQLite (Docker volume: `degenfeed_nostr_data`) |
| Log level | info |
| Payment required | No (open relay) |

**How to Manage:**
```bash
# View logs
docker logs degenfeed-nostr-relay

# Restart
docker compose -f /srv/degenfeed/docker-compose.yml restart nostr-relay

# Publish event (via Python)
/tmp/nostr-venv/bin/python3 -c "
from websocket import create_connection
import json
ws = create_connection('ws://127.0.0.1:8085', timeout=5)
ws.send(json.dumps(['REQ', 'mgmt', {'kinds': [1], 'limit': 5}]))
for i in range(10):
    try:
        ws.settimeout(3)
        msg = json.loads(ws.recv())
        if msg[0] == 'EVENT': print('Event:', msg[2]['content'][:50])
        elif msg[0] == 'EOSE': break
    except: break
ws.close()
"

# Query relay info
curl -s http://127.0.0.1:8085/ -H "Accept: application/nostr+json" | python3 -m json.tool
```

**Roadmap:**
- [ ] Expose via `wss://nostr-relay.degenfeed.xyz` (Cloudflare tunnel or direct)
- [ ] Register on nostr.watch, relay.directory, nostr.info
- [ ] Set up NIP-05 `.well-known/nostr.json` for `degenfeed.xyz`
- [ ] Enable LNURL zaps (requires Lightning node)
- [ ] Upgrade to `strfry` for higher throughput if needed

---

## 4. FARCASTER

### Farcaster Hubble (intended port: 2281)

**Status:** 🟡 NOT SELF-HOSTED — Using external API

**Verified:**
- ❌ No self-hosted Farcaster Hub
- 🟡 External hubs configured in `farcaster.ts`:
  - `https://hub.pinata.cloud` (primary)
  - `https://hoyt.farcaster.standardcrypto.vc:2281`
  - `https://nemes.farcaster.xyz`
- 🟡 Public API fallback: `https://api.farcaster.xyz`

Self-hosting a Farcaster Hub requires significant infrastructure (SSD, RAM, syncing the entire network). Consider using Pinata's hosted hub or `@standardcrypto`'s hub.

---

## 5. LENS

### Lens Indexer (intended port: 8099)

**Status:** 🟡 NOT SELF-HOSTED — Using external API

**Verified:**
- ❌ No self-hosted Lens indexer
- 🟡 External API configured in `lens.ts`:
  - `https://api.lens.xyz/graphql` (primary)
  - Handles: `stani.lens`, `lensprotocol.lens`, `jessepollak.lens`, etc.

Lens is an on-chain protocol on Polygon — self-hosting requires running a Polygon node + subgraph. The external API is the standard approach.

---

## 6. ZORA

### 6.1 Zora Node — `degenfeed-zora-anvil` (port 8546)

**Status:** 🟡 LOCAL TESTNET ONLY — Not connected to Zora mainnet

**Verified:**
- ✅ Container running (Anvil/Erigon fork)
- ✅ RPC responding to JSON-RPC calls
- ❌ Chain ID: 31337 (Anvil default) — NOT Zora mainnet (7777777)
- ❌ Block: 0 (just initialized, no blocks produced)
- ❌ Balance: 0 wei at zero address

**Note:** This is a local test node for development. For production:
```bash
# Use external Zora RPC
export ZORA_RPC_URL=https://rpc.zora.energy
```

### 6.2 Zora Indexer — `degenfeed-zora-indexer` (port 8091)

**Status:** 🟡 RUNNING but EMPTY — Connected to external Zora APIs

**Verified:**
- ✅ Service: `zora-indexer` v1.0.0
- ✅ Health: ok
- ✅ Connected to: `https://rpc.zora.energy` and `https://api.zora.co/graphql`
- ✅ Poll interval: 30 seconds
- ⚠️ Collections: 0, Tokens: 0, Mints: 0, Sales: 0
- ⚠️ DB size: 4KB (empty)

**How to Manage:**
```bash
# API endpoints
curl http://127.0.0.1:8091/health         # Health check
curl http://127.0.0.1:8091/api/stats       # Indexer statistics
curl http://127.0.0.1:8091/api/collections  # List collections
```

The indexer is polling Zora RPC every 30s but needs data to index. It may need a specific contract address to start tracking.

---

## 7. REDDIT PROXY — Redlib (port 8281)

**Status:** 🟢 RUNNING — Reddit proxy operational

**Verified:**
- ✅ Redlib settings page loads
- ✅ Proxies reddit.com content
- ✅ Port 8281 accessible
- ✅ Deployed from `quay.io/redlib/redlib:latest`

**How to Manage:**
```bash
# Docker container already running
docker ps --filter name=degenfeed-redlib
```

---

## 8. MISSING PROTOCOLS SUMMARY

| Protocol | Self-Hosted | Action Required | Priority |
|----------|-------------|-----------------|----------|
| **Pixelfed** | ❌ | Deploy from full compose, generate APP_KEY | Medium |
| **Nostr Relay** | ✅ | Deployed — Docker Hub image, fully self-hosted | High |
| **Farcaster Hubble** | ❌ | Evaluate Pinata hosted hub | Low |
| **Lens Indexer** | ❌ | External API sufficient | Low |
| **Zora Mainnet Node** | ❌ | Replace Anvil with real Zora RPC | Medium |

---

## 9. CREDENTIALS MANAGEMENT

All sensitive credentials are stored in:
- `/srv/degenfeed/.env` — Shared DegenFeed env
- `/srv/degenfeed/<service>/.env` — Per-service env files
- `/srv/degenfeed/<service>/config.yaml` — Per-service config

**CRITICAL:** Many credentials are stored in plaintext `.env` files. These should be migrated to:
- `gopass` for personal credentials
- Docker secrets for production
- Vault (planned)

TODO in `/srv/degenfeed/lemmy/.env`: `# TODO: move ALL secrets to gopass`

---

## 10. NETWORK ADMIN CONTACT

| Field | Value |
|-------|-------|
| Admin Email | `admin@degenfeed.xyz` |
| Admin Wallet | `0x1e3ac01d0fdb976179790bdd02823196a92705c9` |
| Domain | `degenfeed.xyz` (Cloudflare) |
| Infrastructure | Talos (Netcup) + Cloudflare |

---

## 11. VERIFICATION COMMANDS CHEAT SHEET

```bash
# GoToSocial
curl -s http://127.0.0.1:8082/api/v1/instance | python3 -m json.tool

# Lemmy
curl -s 'http://127.0.0.1:8536/api/v3/site' | python3 -m json.tool

# PeerTube
curl -s 'http://127.0.0.1:9011/api/v1/videos?count=5' | python3 -m json.tool

# WriteFreely
curl -s http://127.0.0.1:8086/ | grep -o '<title>[^<]*</title>'

# Bluesky PDS
curl -s http://127.0.0.1:3012/xrpc/com.atproto.server.describeServer

# Activity Relay
curl -s http://127.0.0.1:8084/nodeinfo/2.1

# Zora RPC
curl -s -X POST http://127.0.0.1:8546 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'

# Zora Indexer
curl -s http://127.0.0.1:8091/health

# Redlib
curl -s http://127.0.0.1:8281/settings | grep '<title>'

# Nostr Relay (NIP-11 info)
curl -s http://127.0.0.1:8085/ -H "Accept: application/nostr+json" | python3 -m json.tool

# Nostr Relay (WebSocket query)
python3 -c "
from websocket import create_connection
import json
ws = create_connection('ws://127.0.0.1:8085', timeout=5)
ws.send(json.dumps(['REQ', 'test', {'kinds': [1], 'limit': 3}]))
for i in range(10):
    try:
        ws.settimeout(3)
        msg = json.loads(ws.recv())
        if msg[0] == 'EVENT': print(f'Event: {msg[2][\"content\"][:30]}')
        elif msg[0] == 'EOSE': break
    except: break
ws.close()
"

# DNS verification
for d in social talk video relay pds blog; do
  host "$d.degenfeed.xyz" 2>/dev/null || echo "$d.degenfeed.xyz: NO DNS"
done
```

---

*Generated by Network Ownership Verification Audit. Last updated: 2026-07-24.*
