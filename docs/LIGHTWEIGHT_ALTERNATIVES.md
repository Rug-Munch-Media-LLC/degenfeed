# Lightweight Fediverse Protocol Alternatives

> **Mission:** Run the entire fediverse social stack on minimal hardware. Every component under 150MB RAM. Zero bloat. Ship it.

**Last updated:** 2026-07-24
**Status:** ⚡ Research complete — now deploying
**Current stack fleet:** 103 containers across 3 hosts (Talos, Hydra, Cinnabox)

---

## Table of Contents

1. [Current Stack Analysis](#1-current-stack-analysis)
2. [Category Deep Dives](#2-category-deep-dives)
   - [2.1 Microblogging (GoToSocial replacement?)](#21-microblogging)
   - [2.2 Link Aggregator (Lemmy replacement)](#22-link-aggregator)
   - [2.3 Video (PeerTube replacement)](#23-video)
   - [2.4 Photo (Pixelfed replacement)](#24-photo)
   - [2.5 Live Streaming (Owncast)](#25-live-streaming)
   - [2.6 Blogging (WriteFreely)](#26-blogging)
3. [The Holy Grail: Smallhold](#3-the-holy-grail-smallhold)
4. [Memory Comparison Table](#4-memory-comparison-table)
5. [Decision Matrix](#5-decision-matrix)
6. [Implementation Guides](#6-implementation-guides)
   - [6.1 Snac2 Deployment](#61-snac2-deployment)
   - [6.2 PieFed Deployment](#62-piefed-deployment)
   - [6.3 PeerTube Headless](#63-peertube-headless)
   - [6.4 Pixelfed Optimization](#64-pixelfed-optimization)
   - [6.5 Owncast (Already Deployed)](#65-owncast-already-deployed)
7. [Migration Roadmap](#7-migration-roadmap)
8. [Appendix: All Projects Considered](#8-appendix-all-projects-considered)

---

## 1. Current Stack Analysis

### Running Services (measured 2026-07-24)

| Service | Image | RAM (container) | DB | Redis | Total | Verdict |
|---------|-------|-----------------|----|-------|-------|---------|
| **GoToSocial** | v0.22.0 (Go) | **125 MB** | none | none | **125 MB** | ✅ Keep |
| **WriteFreely** | latest (Go) | **18 MB** | SQLite | none | **18 MB** | ✅ Keep |
| **Owncast** | latest (Go) | **88 MB** | SQLite | none | **88 MB** | ✅ Keep |
| **Lemmy** | 0.19.11 (Rust) | 41 MB | Postgres 44 MB | none | **93 MB** | ⚠️ Heavy for what it does |
| **PeerTube** | production (Node) | 174 MB | Postgres 31 MB | Redis 8 MB | **213 MB** | ⚠️ Heavy |
| **Pixelfed** | v0.12.7 (PHP) | 164 MB | MariaDB 126 MB | Redis 5 MB | **295 MB** | ❌ Very heavy |

### Key Insight
The **Go-based** services (GoToSocial, WriteFreely, Owncast) average **77 MB** with no external DB.
The **everything-else** services average **200+ MB** and ALL need Postgres/MySQL + Redis.

**Target:** Get the heavy three (Lemmy, PeerTube, Pixelfed) under 150MB each or replace them.

---

## 2. Category Deep Dives

### 2.1 Microblogging

#### 🟢 GoToSocial (KEEP)
- **Language:** Go
- **Memory:** 125 MB (claimed 50 MB idle, reality depends on federation load)
- **DB:** None (uses gob+JSON files on disk)
- **Binary:** ~30 MB
- **Federation:** Full ActivityPub, Mastodon API compatible
- **Activity:** Very active — stable releases
- **Verdict:** Already deployed, already lightweight. KEEP.
- **Optimization:** Could reduce memory by limiting federation queue depth in config

#### 🟢 Snac2 (Test Candidate)
- **Language:** C (portable, gcc/clang/tcc)
- **Memory:** ~5-15 MB
- **DB:** None (filesystem-based)
- **Binary:** **~200 KB** (not a typo — 200 kilobytes)
- **Dependencies:** Only libcurl + OpenSSL
- **Federation:** Full ActivityPub, Mastodon API (compilable out)
- **Web UI:** JavaScript-free, cookie-free
- **Activity:** Very active — **v2.93** (June 2026), weekly commits
- **Multi-user:** Yes
- **Docker:** Official docker-compose with nginx
- **Verdict:** ⭐ BEST for throwaway/dev instances. Not a GTS replacement (different UX philosophy — minimal web UI), but excellent for:
  - Bot accounts
  - Dev/test instances
  - Private relay nodes
  - Ultra-low-resource environments (Raspberry Pi Zero, $3 VPS)

#### 🟡 Honk
- **Language:** Go
- **Memory:** ~30 MB
- **DB:** SQLite
- **Binary:** ~5 MB
- **Activity:** **DEAD** — last commit 2023 (timkuijsten/honk)
- **Verdict:** ❌ Dead project. Skip.

#### 🟡 microblog.pub
- **Language:** Python 3.10+
- **Memory:** ~50 MB
- **DB:** SQLite
- **Federation:** Full ActivityPub
- **Activity:** Maintained but slow
- **Verdict:** ⚠️ Single-user only. Not suitable for multi-user instance.

#### 🟡 Starling
- **Language:** PHP
- **Memory:** ~40 MB
- **DB:** SQLite
- **Federation:** ActivityPub, Mastodon API
- **Activity:** New project (2025+), maintained
- **Verdict:** Interesting for shared hosting deployments. Not needed here.

#### 🟡 Ktistec
- **Language:** Crystal
- **Memory:** ~35 MB
- **DB:** SQLite
- **Activity:** Active — v3.3.8 (May 2026)
- **Verdict:** Interesting but Crystal is a niche language for operations. Skip.

### 2.2 Link Aggregator

#### 🔴 Lemmy (Current — heavy)
- **Language:** Rust
- **Memory:** 41 MB app + 44 MB Postgres + 8 MB pictrs = **93 MB**
- **DB:** Postgres (mandatory)
- **Storage:** pictrs for image hosting
- **Activity:** Active (0.19.x stable, 0.20 in dev)
- **Verdict:** Heavy for what it does. Needs replacement.

#### 🟢 PieFed (Best Alternative)
- **Language:** **Python** (Flask) — our stack!
- **Version:** **1.4** (Dec 2025)
- **Memory:** ~100-150 MB (app) + Postgres + Redis
- **DB:** Postgres + Redis (still needed)
- **API:** **Lemmy API compatible** — drop-in replacement for clients
- **Federation:** Full ActivityPub, compatible with Lemmy communities
- **Features:**
  - Emoji reactions
  - Federated Stack Overflow-style Q&A (ChooseAnswer activity)
  - AI content filters
  - Auto-archive old posts to S3
  - Push notifications
  - LLDAP support
- **Activity:** Very active — monthly releases
- **Deploy:** Docker compose or bare metal
- **Hardware:** 2 CPU, 4 GB RAM recommended (for 10+ users)
- **Verdict:** ⭐ THE alternative. Python stack = we can hack it. Lemmy API compatible = existing clients work. Deploy alongside Lemmy, migrate users gradually.

#### 🔴 Lotide
- **Language:** Rust
- **Binary:** Single binary
- **Activity:** **DEAD** — last commit 2023
- **Verdict:** ❌ Dead. Skip.

#### 🟡 Mbin
- **Language:** PHP/Symfony
- **Memory:** ~80 MB app + DB
- **Activity:** Active fork of kbin
- **Verdict:** PHP/Symfony = maintenance burden. Skip if we have PieFed.

### 2.3 Video

#### 🔴 PeerTube (Current — heavy but necessary)
- **Language:** Node.js/TypeScript
- **Memory:** 174 MB app + 31 MB Postgres + 8 MB Redis = **213 MB**
- **DB:** Postgres + Redis (mandatory)
- **Features:** Full VOD, live streaming, transcoding, P2P distribution
- **Activity:** Very active — v7.x stable
- **Verdict:** Heavy but irreplaceable for VOD. No ActivityPub video platform comes close.

#### Headless Mode Investigation
PeerTube has **no official headless mode**. The `NOCLIENT=1` env var mentioned in a 2018 issue only skips client build during `yarn install`, but the server still serves the web UI. The API is fully functional regardless, but the server process still consumes the same resources.

**What we CAN do:**
1. **Run without transcoding** — disable local transcoding, push it to a remote runner
2. **Use remote runners** — PeerTube supports remote transcoding runners via WebSocket
3. **Trim nginx caching** — aggressively cache video segments
4. **Object storage** — offload video files to S3/B2 to reduce disk pressure
5. **Limit federation** — reduce remote fetch activity

**Resource savings from optimization:** Maybe 20-30% reduction. PeerTube's weight is inherent to Node.js + Postgres.

#### 🟢 Owncast (Already Deployed)
- **Language:** Go
- **Memory:** 88 MB
- **DB:** SQLite
- **Status:** ✅ Already running at `owncast.degenfeed.xyz` (or similar)
- **Verdict:** Keep for live streaming. Does NOT replace PeerTube for VOD.

#### 🟡 Other Video Options
- **VDO.Ninja** — P2P video streaming, not ActivityPub. Not federated.
- **Streamalot** — Dead project.
- **OvenMediaEngine** — Origin/edge streaming, not ActivityPub.

**Verdict:** PeerTube stays for VOD. Accept the ~213 MB cost. Optimize around the edges.

### 2.4 Photo

#### 🔴 Pixelfed (Current — heaviest service)
- **Language:** PHP/Laravel
- **Memory:** 164 MB app + 126 MB MariaDB + 5 MB Redis = **295 MB**
- **DB:** MySQL/MariaDB + Redis (mandatory)
- **Horizon:** Runs a separate worker container for queues
- **Activity:** Active but slow development
- **Verdict:** The heaviest service in the fleet. Needs replacement or drastic optimization.

#### Headless Mode Investigation
Pixelfed has **no headless mode**. It's a Laravel monolith — the web UI IS the app. However:
- You CAN disable registration and stories
- The API works independently (Mastodon-compatible API)
- You can put nginx in front and serve a different frontend
- But the server still runs the full Laravel stack

**Resource savings from optimization:** Negligible (5-10%). The weight is in the framework.

#### 🟡 SnapSmack
- **Language:** PHP/MySQL
- **Memory:** ~60-80 MB
- **Federation:** ActivityPub, Pixelfed-compatible!
- **Activity:** Alpha v0.7.407 — actively developed
- **Features:** Photoblogging CMS, grid/masonry layouts, ActivityPub federation
- **Verdict:** ⚠️ Promising but still alpha. Monitor for v1.0. Not production-ready yet.

#### 🟢 Buen
- **Language:** PHP (no database! JSON files)
- **Memory:** ~15 MB
- **Federation:** **NONE** (no ActivityPub)
- **Activity:** Maintained
- **Verdict:** Useful for a simple personal photo page, but not federated. Not a Pixelfed replacement.

#### 🟡 microblog.pub (also handles photos)
- As noted above — single-user, Python, SQLite.
- Handles image posts well but NO multi-user.

#### 🟢 Self-Hosted Instagram Alternatives (non-federated)
- **Immich** — Self-hosted Google Photos. Feature-rich, but NOT federated. Not a replacement.
- **Photoprism** — Go, TensorFlow-powered. Not federated.
- **Librephotos** — Python/ML. Not federated.

**Verdict:** Pixelfed stays but we optimize. SnapSmack is the eventual replacement once stable.

### 2.5 Live Streaming

#### 🟢 Owncast (ALREADY DEPLOYED)
- **Status:** Running at ~88 MB ✅
- **Stack:** Go single binary + SQLite
- **Features:** RTMP ingest, HLS delivery, chat, ActivityPub federation
- **Verdict:** Already done. Nothing lighter exists for live streaming with federation.

### 2.6 Blogging

#### 🟢 WriteFreely (ALREADY DEPLOYED)
- **Status:** Running at ~18 MB ✅
- **Stack:** Go + SQLite
- **Verdict:** Already done. Nothing lighter exists that federates.

---

## 3. The Holy Grail: Smallhold

**This deserves special attention.**

**Smallhold** (github.com/MarkAtwood/smallhold) is a **single-binary Rust ActivityPub server** that implements **8 API surfaces**:
- Mastodon (microblogging)
- Pixelfed (photos)
- Lemmy (communities)
- PeerTube (video)
- Misskey
- Funkwhale (audio)
- Bookwyrm (books)
- WriteFreely (articles)

### Specs
- **Language:** Rust
- **DB:** SQLite only
- **Memory:** Under 150 MB
- **Binary:** Single binary
- **Dependencies:** Zero — no Postgres, no Redis, no Node, no PHP
- **Features:** Full ActivityPub S2S, HTTP Signatures, DID support, blurhash, full-text search (tantivy)
- **Web UI:** Profile pages only. No admin UI. BYO client.
- **Activity:** Active development

### Could This Replace... EVERYTHING?

| Replace | Status | Why |
|---------|--------|-----|
| GoToSocial | 🔄 Possible | Mastodon API — but GTS is already 125 MB, not worth switching |
| Lemmy | 🔄 Possible | Lemmy API — but community/threaded view is weak |
| PeerTube | ❌ No | Poor video support, no HLS transcoding |
| Pixelfed | 🔄 Possible | Pixelfed API — photo gallery works |
| WriteFreely | 🔄 Possible | WriteFreely API — but WF is 18 MB, no reason to switch |

**Verdict:** Too early. Smallhold is promising but pre-1.0. Watch for 2027. If it matures, it could consolidate 3-4 services into one binary.

---

## 4. Memory Comparison Table

### Full-Stack Comparison

| Service | Language | App RAM | DB RAM | Total | DB Type | Binary Size |
|---------|----------|---------|--------|-------|---------|-------------|
| **Snac2** | C | **5 MB** | 0 | **5 MB** | None | **200 KB** |
| **WriteFreely** | Go | **18 MB** | 0 | **18 MB** | SQLite | 25 MB |
| **Starling** | PHP | ~40 MB | 0 | ~40 MB | SQLite | N/A (PHP) |
| **Honk** | Go | ~30 MB | 0 | ~30 MB | SQLite | 5 MB |
| **microblog.pub** | Python | ~50 MB | 0 | ~50 MB | SQLite | N/A (Python) |
| **GoToSocial** | Go | 125 MB | 0 | **125 MB** | None | 30 MB |
| **Owncast** | Go | 88 MB | 0 | **88 MB** | SQLite | 30 MB |
| **Ktistec** | Crystal | ~35 MB | 0 | ~35 MB | SQLite | 8 MB |
| **Smallhold** | Rust | ~100 MB | 0 | ~100 MB | SQLite | 15 MB |
| **Mbin** | PHP | ~80 MB | ~50 MB | ~130 MB | Postgres | N/A |
| **Lemmy** | Rust | 41 MB | 44 MB | **93 MB** | Postgres | 15 MB |
| **PieFed** | Python | ~120 MB | ~50 MB | ~170 MB | Postgres | N/A |
| **Pixelfed** | PHP | 164 MB | 126 MB | **295 MB** | MariaDB | N/A |
| **PeerTube** | Node | 174 MB | 39 MB | **213 MB** | Postgres | N/A |

### Winners by Category
- **Lightest overall:** Snac2 (5 MB, 200 KB binary, no DB)
- **Lightest multi-user microblog:** GoToSocial (125 MB, no DB)
- **Lightest link aggregator:** Lemmy (93 MB with DB — surprisingly not bad)
- **Lightest photo:** None exist under 200 MB 😞
- **Lightest live stream:** Owncast (88 MB)

---

## 5. Decision Matrix

| Category | Current | Decision | Alternative | RAM Saved | Priority |
|----------|---------|----------|-------------|-----------|----------|
| Microblogging | GoToSocial (125 MB) | **KEEP** | Snac2 for test/bot instances | 0 | Low |
| Microblogging (bots) | None | **DEPLOY Snac2** | Snac2 (5 MB per instance) | N/A | Medium |
| Link Aggregator | Lemmy (93 MB) | **DEPLOY PieFed alongside** | Lemmy API compatible, Python | Test first | High |
| Link Aggregator | Lemmy (93 MB) | **MIGRATE to PieFed** if stable | ~80 MB more | ~80 MB | Future |
| Video VOD | PeerTube (213 MB) | **KEEP & OPTIMIZE** | Headless config + remote runners | ~40 MB | Medium |
| Live Streaming | Owncast (88 MB) | **KEEP** | Already deployed | 0 | Done |
| Photo | Pixelfed (295 MB) | **OPTIMIZE** | Limit features, disable Horizon | ~50 MB | High |
| Photo (future) | Pixelfed | **MONITOR SnapSmack** | ~60 MB when stable | ~235 MB | Future |
| Blogging | WriteFreely (18 MB) | **KEEP** | Already lightweight | 0 | Done |

### Prioritized Action Items

1. **🔥 NOW — Optimize Pixelfed**
   - Disable stories (`STORIES_ENABLED=false`)
   - Disable video (`VIDEO_ENABLED=false`)
   - Disable portfolios if not used
   - Tune PHP-FPM workers (reduce from dynamic to ondemand)
   - Tune MySQL for the small instance (innodb_buffer_pool_size=128M)
   - Estimated savings: 50-100 MB

2. **🔥 High — Deploy PieFed for test**
   - Deploy alongside Lemmy on a subdomain
   - Test Lemmy API compatibility
   - If stable, announce migration path

3. **🔥 High — Deploy Snac2 for bot accounts**
   - Each Snac2 instance uses ~5 MB vs 125 MB for GTS
   - Perfect for: bridge bots, announcement bots, test accounts
   - Can run 10+ instances on what GTS alone uses

4. **🔥 Medium — PeerTube optimization**
   - Disable live transcoding if not used (`transcoding.enabled: false`)
   - Use remote runners for transcoding
   - Aggressive caching headers

5. **Future — Watch Smallhold**
   - If it reaches v1.0, it could replace: GoToSocial + Lemmy + Pixelfed + WriteFreely
   - Potential savings: 125 + 93 + 295 + 18 = **531 MB → 100 MB**

---

## 6. Implementation Guides

### 6.1 Snac2 Deployment

> **What:** Ultralight ActivityPub instance. 200 KB binary. 5 MB RAM. No DB.

#### Quick Start (Docker)
```yaml
# docker-compose.snac.yml
version: "3.8"

services:
  snac:
    image: codeberg.org/grunfink/snac2  # or build from source
    build:
      context: https://codeberg.org/grunfink/snac2.git
    container_name: degenfeed-snac
    restart: unless-stopped
    volumes:
      - snac-data:/srv/snac
    ports:
      - "127.0.0.1:8001:8001"
    environment:
      - SNAC_BASEDIR=/srv/snac
    deploy:
      resources:
        limits:
          memory: 32M
          cpus: "0.25"

volumes:
  snac-data:
```

#### Quick Start (Bare Metal — 15 minutes)
```bash
# Install deps
apt install build-essential libssl-dev libcurl4-openssl-dev

# Build
cd /tmp
git clone https://codeberg.org/grunfink/snac2.git
cd snac2
make
sudo make install

# Init (answers prompts)
sudo snac init /srv/snac

# Systemd unit
cat > /etc/systemd/system/snac.service << 'EOF'
[Unit]
Description=snac ActivityPub daemon
After=network.target

[Service]
Type=simple
User=snac
ExecStart=/usr/local/bin/snac httpd /srv/snac
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now snac
```

#### Multiple Instances for Bots
```bash
# Each bot gets its own basedir
sudo snac init /srv/snac-bot1   # instance at bot1.degenfeed.xyz
sudo snac init /srv/snac-bot2   # instance at bot2.degenfeed.xyz

# Run with different ports
snac httpd /srv/snac-bot1 -p 8002
snac httpd /srv/snac-bot2 -p 8003
```

**Nginx reverse proxy config:**
```nginx
server {
    listen 443 ssl;
    server_name snac.degenfeed.xyz;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Add User
```bash
sudo snac adduser /srv/snac myusername
# Follow prompts for password, etc.
```

#### Verify
```bash
# Check process
ps aux | grep snac
# Should show ~0.2% CPU, ~5MB RSS

# Test federation
curl https://snac.degenfeed.xyz/.well-known/webfinger?resource=acct:myusername@snac.degenfeed.xyz
```

---

### 6.2 PieFed Deployment

> **What:** Link aggregator in Python. Lemmy API compatible. Deploy alongside existing Lemmy.

#### Docker Compose
```yaml
# docker-compose.piefed.yml
version: "3.8"

services:
  piefed:
    image: dockur/piefed:latest
    container_name: degenfeed-piefed
    restart: unless-stopped
    ports:
      - "127.0.0.1:5000:5000"
    volumes:
      - piefed-data:/app/data
      - piefed-media:/app/media
    env_file: /srv/degenfeed/piefed.env
    depends_on:
      - piefed-db
      - piefed-redis
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: "1"

  piefed-worker:
    image: dockur/piefed:latest
    container_name: degenfeed-piefed-worker
    restart: unless-stopped
    volumes:
      - piefed-media:/app/media
    env_file: /srv/degenfeed/piefed.env
    command: celery -A piefed.tasks worker --loglevel=info
    depends_on:
      - piefed-db
      - piefed-redis
    deploy:
      resources:
        limits:
          memory: 128M
          cpus: "0.5"

  piefed-db:
    image: postgres:16-alpine
    container_name: degenfeed-piefed-db
    restart: unless-stopped
    volumes:
      - piefed-pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: piefed
      POSTGRES_USER: piefed
      POSTGRES_PASSWORD: ${PIEFED_DB_PASSWORD}
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: "0.5"

  piefed-redis:
    image: redis:7-alpine
    container_name: degenfeed-piefed-redis
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 64M
          cpus: "0.25"

volumes:
  piefed-data:
  piefed-media:
  piefed-pgdata:
```

#### Environment (.env)
```bash
# piefed.env
SERVER_NAME=piefed.degenfeed.xyz
SECRET_KEY=<generate with: python3 -c "import secrets; print(secrets.token_hex(32))">
DATABASE_URL=postgresql://piefed:${PIEFED_DB_PASSWORD}@piefed-db:5432/piefed
REDIS_URL=redis://piefed-redis:6379
FLASK_ENV=production
```

#### Setup
```bash
# First run — init DB
docker compose -f docker-compose.piefed.yml exec piefed flask db upgrade

# Create admin user
docker compose -f docker-compose.piefed.yml exec piefed flask user create admin --admin

# Verify
curl https://piefed.degenfeed.xyz/api/v1/instance
```

#### Migration Strategy
1. Deploy PieFed on piefed.degenfeed.xyz side-by-side with Lemmy
2. Let both federate for 2 weeks
3. Survey users: "Which do you prefer?"
4. If PieFed wins: announce migration, export Lemmy communities, redirect
5. Keep Lemmy data for 30 days, then decommission

---

### 6.3 PeerTube Optimization

> **What:** Keep PeerTube but trim the fat.

#### Configuration Optimizations (`production.yaml`)
```yaml
# production.yaml — optimized for low resource
log:
  level: 'warn'                    # reduce logging overhead
  log_http_requests: false          # disable HTTP request logging

transcoding:
  enabled: false                    # DISABLE local transcoding
  remote_runners:
    enabled: true                   # use remote runners instead
    # Deploy a runner on a beefier machine if needed

live:
  enabled: false                    # disable live if not used (use Owncast instead)

import:
  video:
    allow_public: false             # disable public imports

cache:
  previews:
    size: 10                        # reduce preview cache

object_storage:
  enabled: true                     # offload to S3
  # Configure with Backblaze B2 or Cloudflare R2
```

#### Running with Remote Runners
```bash
# On a separate machine (or the same, but limited)
docker run -d \
  --name peertube-runner \
  chocobozzz/peertube-runner:latest \
  --url https://peertube.degenfeed.xyz \
  --runner-name runner1 \
  --jobs vod
```

#### Nginx Caching
```nginx
# Cache video segments aggressively
location ~ ^/static/webseed/ {
    proxy_cache peertube_cache;
    proxy_cache_valid 200 24h;
    proxy_cache_use_stale error timeout updating;
    proxy_pass http://peertube:9000;
}

location ~ ^/static/streaming-playlists/ {
    proxy_cache peertube_cache;
    proxy_cache_valid 200 24h;
    proxy_cache_use_stale error timeout updating;
    proxy_pass http://peertube:9000;
}
```

#### Expected Savings
- From disabling transcoding: ~30-50 MB (ffmpeg processes)
- From remote runner: 0 (moves CPU load, not RAM)
- From log reduction: ~5 MB
- **Total: ~35-55 MB saved** (from 213 MB → ~160 MB)

---

### 6.4 Pixelfed Optimization

> **What:** Pixelfed is the heaviest service. Optimize aggressively.

#### .env Optimizations
```bash
# Disable heavy features
STORIES_ENABLED=false
VIDEO_ENABLED=false
PF_ENABLE_PORTFOLIO=false
ENFORCE_EMAIL_VERIFICATION=false     # skip if no email

# Reduce media processing
MAX_PHOTO_SIZE=5000                  # 5 MB max (down from 15)
IMAGE_QUALITY=70                     # reduce quality for storage
MAX_ALBUM_LENGTH=4                   # keep reasonable

# Caching — reduce Redis usage
CACHE_DRIVER=redis
REDIS_PORT=6379

# Queue — reduce worker count
HORIZON_PROCESSES=1                  # single worker process
QUEUE_DRIVER=redis
```

#### PHP-FPM Tuning
```ini
; /usr/local/etc/php-fpm.d/pixelfed.conf
pm = ondemand                        ; NOT dynamic — only spawn when needed
pm.max_children = 5                  ; max 5 workers
pm.process_idle_timeout = 30s        ; kill idle workers quickly
pm.max_requests = 500                ; prevent memory leaks
```

#### MySQL Tuning
```ini
# my.cnf tweaks
[mysqld]
innodb_buffer_pool_size = 128M       # default is ~128MB+ on most installs
innodb_log_file_size = 32M
innodb_flush_method = O_DIRECT
max_connections = 10                 # we don't need 151
query_cache_type = 0                 # disable (deprecated in MySQL 8)
```

#### Expected Savings
- From feature disable: ~20-30 MB
- From PHP-FPM tuning: ~30-40 MB
- From MySQL tuning: ~30-50 MB
- **Total: ~80-120 MB saved** (from 295 MB → ~175-215 MB)

---

### 6.5 Owncast (Already Deployed)

**Status:** ✅ Running at 88 MB. No changes needed.

```bash
# Verify
curl https://owncast.degenfeed.xyz/api/status
# Should return server status with viewer count
```

**Optimization notes:**
- Owncast uses sqlite — fine for single-user live streaming
- S3 storage for recordings is recommended to save disk
- If not streaming 24/7, it idles at ~30 MB during downtime

---

## 7. Migration Roadmap

### Phase 1: Quick Wins (Week 1)
- [x] Owncast deployed ✅
- [ ] Pixelfed optimization (disable features, tune PHP/MySQL)
- [ ] PeerTube optimization (disable transcoding, enable remote runners)
- [ ] Deploy Snac2 for bot accounts

### Phase 2: Test Deployments (Week 2)
- [ ] Deploy PieFed alongside Lemmy
  - Subdomain: piefed.degenfeed.xyz
  - Same Postgres cluster or separate
  - Test for 2 weeks with power users
- [ ] Deploy test Snac2 instance
  - Subdomain: snac.degenfeed.xyz
  - Create bridge bot account

### Phase 3: Evaluation (Week 3-4)
- [ ] Compare PieFed vs Lemmy: performance, features, user satisfaction
- [ ] Compare Snac2 vs GoToSocial for bot accounts
- [ ] Decide on migration paths

### Phase 4: Migration (Month 2)
- [ ] If PieFed wins: migrate Lemmy communities, decommission Lemmy
- [ ] Move all bots to Snac2
- [ ] Finalize Pixelfed optimization
- [ ] Document final stack

### Phase 5: Future (2027)
- [ ] Monitor Smallhold for v1.0
- [ ] Monitor SnapSmack for production readiness
- [ ] Potential 4-in-1 consolidation: Smallhold

---

## 8. Appendix: All Projects Considered

### Microblogging
| Project | Language | DB | Memory | Status | Decision |
|---------|----------|----|--------|--------|----------|
| GoToSocial | Go | None | 125 MB | ✅ Active | **KEEP** |
| Snac2 | C | None | 5 MB | ✅ Active (v2.93) | **DEPLOY for bots** |
| Honk | Go | SQLite | 30 MB | ❌ Dead (2023) | Skip |
| microblog.pub | Python | SQLite | 50 MB | ⚠️ Slow | Skip (single-user) |
| Starling | PHP | SQLite | 40 MB | ✅ Active | Skip (PHP) |
| Ktistec | Crystal | SQLite | 35 MB | ✅ Active (v3.3.8) | Skip (niche lang) |
| Mastodon | Ruby | Postgres+Redis | 500+ MB | ✅ Active | ❌ Too heavy |

### Link Aggregator
| Project | Language | DB | Memory | Status | Decision |
|---------|----------|----|--------|--------|----------|
| Lemmy | Rust | Postgres | 93 MB | ✅ Active | **Current, replacing** |
| PieFed | Python | Postgres+Redis | ~170 MB | ✅ Active (v1.4) | **DEPLOY** |
| Lotide | Rust | ? | ? | ❌ Dead (2023) | Skip |
| Mbin | PHP | Postgres | ~130 MB | ✅ Active | Skip (PHP) |
| Sublinks | Rust | Postgres | ? | 🆕 New | Watch |

### Video
| Project | Language | DB | Memory | Status | Decision |
|---------|----------|----|--------|--------|----------|
| PeerTube | Node | Postgres+Redis | 213 MB | ✅ Active | **KEEP (optimized)** |
| Owncast | Go | SQLite | 88 MB | ✅ Active | **KEEP (live only)** |
| VDO.Ninja | JS | None | N/A | ✅ Active | Not ActivityPub |

### Photo
| Project | Language | DB | Memory | Status | Decision |
|---------|----------|----|--------|--------|----------|
| Pixelfed | PHP | MariaDB+Redis | 295 MB | ✅ Active | **OPTIMIZE** |
| SnapSmack | PHP | MySQL | ~80 MB | 🆕 Alpha | **WATCH** |
| Buen | PHP | None (JSON) | 15 MB | ✅ Active | No federation |
| Immich | TS | Postgres+Redis | 300+ MB | ✅ Active | Not ActivityPub |
| Photoprism | Go | MySQL | 200+ MB | ✅ Active | Not ActivityPub |

### Blogging
| Project | Language | DB | Memory | Status | Decision |
|---------|----------|----|--------|--------|----------|
| WriteFreely | Go | SQLite | 18 MB | ✅ Active | **KEEP** |
| Plume | Rust | SQLite | ~30 MB | ⚠️ Slow development | Skip |
| WordPress | PHP | MySQL | 100+ MB | ✅ Active | Not ActivityPub |

---

## Quick Reference: Commands Cheatsheet

```bash
# --- Snac2 ---
# Build from source
git clone https://codeberg.org/grunfink/snac2.git && cd snac2 && make && sudo make install

# Init instance
sudo snac init /srv/snac

# Add user
sudo snac adduser /srv/snac myuser

# --- PieFed ---
# Deploy with docker
docker compose -f docker-compose.piefed.yml up -d

# Run database migrations
docker compose -f docker-compose.piefed.yml exec piefed flask db upgrade

# Create admin
docker compose -f docker-compose.piefed.yml exec piefed flask user create admin --admin

# --- PeerTube Optimizations ---
# Edit production.yaml to disable transcoding
# Set NOCLIENT=1 during install to skip web client build

# --- Pixelfed Optimizations ---
# Edit .env to disable stories, video, portfolios
# Tune PHP-FPM to ondemand mode
# Reduce MySQL buffer pool to 128M
```

---

> **Bottom Line:** The lightest Fediverse stack possible today is:
> **Snac2** (5 MB, microblog) + **WriteFreely** (18 MB, blog) + **Owncast** (88 MB, live video) = **111 MB total**
> 
> But for a full-featured social platform requiring communities, photo sharing, and VOD:
> **GoToSocial** (125 MB) + **Lemmy/PieFed** (93-170 MB) + **PeerTube** (213 MB) + **Pixelfed** (295 MB) + **WriteFreely** (18 MB) + **Owncast** (88 MB) = **832 MB → ~650 MB optimized**
> 
> **The biggest win:** Pixelfed optimization (save ~100 MB) and replacing Lemmy with PieFed if it's more efficient for our use case.
>
> **The 2027 dream:** Smallhold replaces 4 services in one 100 MB binary.
