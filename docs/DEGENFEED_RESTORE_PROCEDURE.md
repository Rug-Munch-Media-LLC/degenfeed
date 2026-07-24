# DegenFeed — Disaster Recovery & Restore Procedure

> **Last updated:** 2026-07-24  
> **Audience:** DevOps SRE, on-call engineers  
> **Prerequisites:** `age` decryption key, `gopass` access, Docker access on Talos  

---

## Quick Reference

| Service | Data Type | Backup Location | Restore Time | Criticality |
|---------|-----------|-----------------|--------------|-------------|
| GotoSocial DB | SQLite | `/backups/degenfeed/` | 5 min | HIGH |
| GlitchTip errors | Postgres | `/backups/app-postgres/` | 10 min | MEDIUM |
| Lemmy | Postgres | `/backups/app-postgres/` | 15 min | MEDIUM |
| PeerTube | Postgres | `/backups/app-postgres/` | 15 min | LOW |
| Cloudflare Worker | KV (ephemeral) | **No backup** | N/A | HIGH — design gap |
| Cloudflare Pages | Static files | In git | 5 min | MEDIUM |
| Postiz | Postgres | `/backups/app-postgres/` | 10 min | LOW |
| Web app | Next.js (git) | In git | 15 min | HIGH |

---

## 1. GotoSocial Restore (SQLite)

GotoSocial stores everything in a single SQLite file. This is the most critical restore path.

### Find the latest backup

```bash
ls -lt /backups/degenfeed/gotosocial-db-*.sqlite.gz.age | head -3
```

### Decrypt and decompress

```bash
# Get the age decryption key
AGE_KEY=$(gopass show deploy/age/key 2>/dev/null || echo "$HOME/.age/key.txt")

age -d -i "$AGE_KEY" /backups/degenfeed/gotosocial-db-20260724-020001.sqlite.gz.age > /tmp/gotosocial-restore.sqlite.gz
gunzip /tmp/gotosocial-restore.sqlite.gz
```

### Verify integrity

```bash
sqlite3 /tmp/gotosocial-restore.sqlite "PRAGMA integrity_check;"
# Expected: "ok"
```

### Stop GotoSocial and restore

```bash
docker stop degenfeed-gotosocial
mv /srv/degenfeed/gotosocial/data/gotosocial.sqlite /srv/degenfeed/gotosocial/data/gotosocial.sqlite.bak
cp /tmp/gotosocial-restore.sqlite /srv/degenfeed/gotosocial/data/gotosocial.sqlite
chown -R 1000:1000 /srv/degenfeed/gotosocial/data/  # Match GotoSocial UID
docker start degenfeed-gotosocial
```

### Verify

```bash
curl -s https://social.degenfeed.xyz/api/v1/instance | jq .uri
# Expected: "social.degenfeed.xyz"
```

### Rollback if restore fails

```bash
docker stop degenfeed-gotosocial
mv /srv/degenfeed/gotosocial/data/gotosocial.sqlite.bak /srv/degenfeed/gotosocial/data/gotosocial.sqlite
docker start degenfeed-gotosocial
```

---

## 2. Postgres App Database Restore

### List available backups

```bash
ls -lt /backups/app-postgres/postgres/ | head -10
```

### Restore GlitchTip (example)

```bash
# Find the latest backup
LATEST=$(ls -t /backups/app-postgres/postgres/degenfeed-glitchtip-db_*.sql.gz | head -1)

# Stop the app, drop and recreate the DB
docker exec -i degenfeed-glitchtip-db psql -U glitchtip -c "DROP DATABASE IF EXISTS glitchtip;"
docker exec -i degenfeed-glitchtip-db psql -U glitchtip -c "CREATE DATABASE glitchtip;"

# Restore
gunzip -c "$LATEST" | docker exec -i degenfeed-glitchtip-db psql -U glitchtip -d glitchtip

# Restart GlitchTip
docker restart degenfeed-glitchtip
```

### Restore Lemmy (example)

```bash
LATEST=$(ls -t /backups/app-postgres/postgres/degenfeed-lemmy-db_*.sql.gz | head -1)
gunzip -c "$LATEST" | docker exec -i degenfeed-lemmy-db psql -U lemmy -d lemmy
docker restart degenfeed-lemmy
```

### Restore PeerTube (example)

```bash
LATEST=$(ls -t /backups/app-postgres/postgres/peertube-postgres-1_*.sql.gz | head -1)
gunzip -c "$LATEST" | docker exec -i peertube-postgres-1 psql -U peertube -d peertube
docker restart peertube-peertube-1
```

---

## 3. Cloudflare Worker Rollback

The API worker has its own rollback mechanism:

### Via CI (recommended)

```bash
# From the repo root
./scripts/deploy/rollback.sh        # Production
./scripts/deploy/rollback.sh --env preview  # Preview
./scripts/deploy/rollback.sh --dry-run      # Preview only
```

### Manual rollback via wrangler

```bash
cd workers/api

# List available versions
wrangler versions list

# Rollback to a specific version
wrangler rollback --version-id <version-id>

# Verify health
curl -s https://degenfeed.xyz/api/health | jq .
```

---

## 4. Cloudflare Pages (Web App) Rollback

### Via CI (recommended)

The `rollback.sh` script handles both Worker and Pages rollback automatically.

### Manual rollback via wrangler

```bash
# List Pages deployments
wrangler pages deployment list --project-name degenfeed-web

# Rollback to a specific deployment
wrangler pages deployment rollback --project-name degenfeed-web <deployment-id>
```

### Alternative: Rebuild and redeploy from git

```bash
git checkout <last-known-good-tag-or-commit>
pnpm install --frozen-lockfile
pnpm --filter degenfeed-web pages:build
wrangler pages deploy .vercel/output/static --project-name degenfeed-web
```

---

## 5. Full Disaster Recovery (Complete Outage)

If Talos is completely destroyed and needs rebuilding:

### Phase 1 — Recover secrets

```bash
# gopass is synced off-device — restore from backup or another machine
gopass setup
gopass sync

# Verify critical paths exist
gopass show degenfeed/auth_secret
gopass show degenfeed/gotosocial_db_password
gopass show deploy/age/key
```

### Phase 2 — Restore databases on new Talos

```bash
# Restore from R2 off-site backup
rclone sync r2-crypt:backups/app-postgres/ /backups/app-postgres/
rclone sync r2-crypt:archives/ /backups/degenfeed/

# Follow restore procedures above for each service
```

### Phase 3 — Rebuild Docker services

```bash
# Clone repos
cd /srv/work/repos
git clone https://git.rugmunch.io/degenfeed-web

# Start monitoring stack
docker compose -f infra/monitoring/docker-compose.yml up -d

# Start app stack
docker compose -f docker-compose.yml build
docker compose -f docker-compose.yml up -d
```

### Phase 4 — Redeploy Workers + Pages

```bash
# Deploy worker
cd /srv/work/repos/degenfeed-web/workers/api
wrangler deploy

# Deploy pages
cd /srv/work/repos/degenfeed-web/apps/web
pnpm pages:build
wrangler pages deploy .vercel/output/static --project-name degenfeed-web
```

---

## 6. Backup Verification Schedule

| Frequency | Action | Automated? | Who |
|-----------|--------|------------|-----|
| Hourly | Monitor: backup age < 26h | ✅ `backup-monitor.sh` | System |
| Daily | Verify: backup files exist for ALL services | ⚠️ Partial | Manual check |
| Weekly | Restore drill: restore GotoSocial DB to temp location | ❌ | DevOps SRE |
| Monthly | Full DR: rebuild all services from backup | ❌ | DevOps SRE |

---

## 7. Critical Gaps

1. **Cloudflare KV is not backed up** — Subscriptions, bookmarks, feed caches, session data stored in KV are lost if Cloudflare has an incident. Consider periodic `wrangler kv:key list` → R2 exports for critical namespaces.
2. **Restore drill has never been performed** — Until `gotosocial-db-*.sqlite.gz.age` is actually restored end-to-end, the backup is untested.
3. **Age key location not documented** — The decryption key must be accessible in an outage. Ensure it's in gopass under `deploy/age/key`.

---

*Generated 2026-07-24 · Review quarterly or after infrastructure changes.*
