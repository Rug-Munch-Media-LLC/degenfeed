# Hubble Farcaster Hub — Maintenance Guide

## Overview

Hubble is a self-hosted Farcaster Hub running on [HOST-1]. It syncs the full Farcaster network (Optimism L2 contracts) and provides a local HTTP API for the DegenFeed bridge instead of relying on external Farcaster APIs.

- **Container**: `degenfeed-hubble` (image: `degenfeed-hubble:patched`)
- **API**: `http://127.0.0.1:2281/v1/info`
- **Data Dir**: `/path/to/degenfeed/hubble-data/` (bind mount)
- **Network**: host mode (uses host networking, not Docker bridge)

## Current Sync Status

- **Version**: 1.19.3
- **Network**: Mainnet (Optimism L2 contracts — ~45M+ contracts)
- **Initial Sync ETA**: ~48 hours (full sync from genesis)
- **Current State**: Syncing (check with `curl -s http://127.0.0.1:2281/v1/info`)
- **Data Size**: ~244K initially, grows significantly as sync progresses

### Quick Status Check

```bash
# Container status
docker ps --filter name=hubble --format "table {{.Names}}\t{{.Status}}\t{{.Size}}"

# API status
curl -s http://127.0.0.1:2281/v1/info | python3 -m json.tool

# Data growth
du -sh /path/to/degenfeed/hubble-data/
```

## Resource Limits Configured

| Resource | Limit | Notes |
|----------|-------|-------|
| CPU | 4 cores (limit) / 2 cores (reserved) | Deploy config |
| Memory | 2 GB (mem_limit) | Hard limit, container OOM-killed if exceeded |
| Swap | 4 GB total (2 GB RAM + 2 GB swap) | memswap_limit |
| Storage (container) | 10 GB | storage_opt — caps container writable layer only |
| Storage (bind mount) | **Unlimited** | RocksDB data lives on `/path/to/degenfeed/hubble-data/` bind mount |

### Important Note on Storage Limits

The `storage_opt` setting only caps the Docker container's writable layer (ephemeral files inside the container). The RocksDB data directory is a **bind mount** (`/path/to/degenfeed/hubble-data/`) and is **not limited** by this setting. The host filesystem (`[DISK]`, 2TB total, currently 24% used) is the effective limit.

**Monitor bind mount growth** separately:
```bash
du -sh /path/to/degenfeed/hubble-data/
```

### Adjusting Limits

Edit `/path/to/degenfeed/docker-compose.yml` in the `hubble:` service section, then:
```bash
docker compose -f /path/to/degenfeed/docker-compose.yml up -d hubble
```

## Backup Schedule

| Schedule | What | Where |
|----------|------|-------|
| 00:00 / 06:00 / 12:00 / 18:00 UTC | Full Hubble backup | `/backups/hubble/` (local) |
| Daily off-site sync | All backup dirs → R2 + B2 | Via offsite-backup.sh pipeline |

Backups include:
1. **JSON snapshot**: Hubble info + casts (readable/importable)
2. **Raw RocksDB copy**: Full data directory snapshot
3. **Identity files**: `*.protobuf` peer identity files (critical for recovery)

### Manual Backup

```bash
# Run immediately
bash /path/to/scripts/backup-hubble.sh

# Check backup status
ls -lh /backups/hubble/
bash /path/to/scripts/backup-status.sh | grep hubble
```

### Backup Retention

- **Local**: Last 7 backups (min 2)
- **R2 + B2**: Synced daily, retained per off-site policy

## Restore from Backup

### Full Data Restore

```bash
# Stop Hubble
docker compose -f /path/to/degenfeed/docker-compose.yml stop hubble

# Find latest backup
ls -lt /backups/hubble/*.tar.gz* | head -5

# Decompress
BACKUP_FILE="/backups/hubble/YYYYMMDD-HHMMSS.tar.gz"
DECRYPTED="/tmp/hubble-restore"
mkdir -p "$DECRYPTED"

# If encrypted with age:
age -d -i ~/.age/key.txt -o "$DECRYPTED/backup.tar.gz" "$BACKUP_FILE.age"
# If plaintext:
cp "$BACKUP_FILE" "$DECRYPTED/backup.tar.gz"

# Extract
tar -xzf "$DECRYPTED/backup.tar.gz" -C "$DECRYPTED"

# Restore data
sudo rm -rf /path/to/degenfeed/hubble-data/*
sudo cp -r "$DECRYPTED"/YYYYMMDD-HHMMSS/rocksdb_backup/* /path/to/degenfeed/hubble-data/ 2>/dev/null || true
sudo cp -r "$DECRYPTED"/YYYYMMDD-HHMMSS/*.protobuf /path/to/degenfeed/hubble-data/ 2>/dev/null || true

# Fix ownership
sudo chown -R 1000:1000 /path/to/degenfeed/hubble-data/ 2>/dev/null || sudo chown -R ops:ops /path/to/degenfeed/hubble-data/

# Start Hubble
docker compose -f /path/to/degenfeed/docker-compose.yml start hubble

# Verify
sleep 30
curl -s http://127.0.0.1:2281/v1/info | python3 -m json.tool

# Cleanup
rm -rf "$DECRYPTED"
```

### Hub Identity Recovery

The `*.protobuf` files contain your Hubble's peer identity. If lost, the hub will generate a new identity on restart, which means it will be a "new" peer on the Farcaster network. **Always back up these files:**

- `12D3KooW..._id.protobuf` — Peer ID
- `default_id.protobuf` — Default identity

## Growth Rate Expectations

| Phase | Data Size | Timeframe |
|-------|-----------|-----------|
| Initial (pre-sync) | ~244 KB | Before sync starts |
| Early sync | ~100 MB — 1 GB | First few hours |
| Mid sync | ~5 — 20 GB | First 24 hours |
| Full sync | ~50 — 200 GB | ~48 hours |
| Steady state | ~200 — 500 GB | Long-term (depends on Farcaster growth) |

> **Note**: Hubble syncs from Optimism L2 (Farcaster contracts), not L1. There are ~45M+ contracts to process. Data requirements grow with network usage.

## What to Do If Disk Fills Up

### 1. Alert Response

If disk usage exceeds 90%, the backup pipeline will alert automatically. You'll receive:
- Journal alert via alert-webhook + n8n
- Healthchecks.io failure ping

### 2. Check Disk Usage

```bash
# Overall disk
df -h /

# Hubble data
du -sh /path/to/degenfeed/hubble-data/
du -sh /path/to/degenfeed/hubble-data/* | sort -rh | head -10

# Backup directory
du -sh /backups/hubble/
```

### 3. Emergency Actions (in order of preference)

**Option A: Prune old backups** (safest, no data loss)
```bash
# Manually clean old Hubble backups (keep last 2)
ls -t /backups/hubble/*.tar.gz* | tail -n +3 | xargs rm -f
```

**Option B: Run RocksDB compaction** (reduces DB size without data loss)
```bash
# Hubble may have a compaction endpoint or you can restart it
# Restarting Hubble triggers automatic RocksDB compaction on startup
docker compose -f /path/to/degenfeed/docker-compose.yml restart hubble
```

**Option C: Adjust resource limits** (if container OOM is causing issues)
```bash
# Edit /path/to/degenfeed/docker-compose.yml and increase mem_limit
# Then recreate:
docker compose -f /path/to/degenfeed/docker-compose.yml up -d hubble
```

**Option D: Increase host disk** (if running out of space)
```bash
# [HOST-1] runs on [DISK] with 2TB — extend if needed
# Check with: lsblk && df -h
```

### 4. Prevent Recurrence

- Monitor growth weekly: add to cron or monitoring dashboard
- Adjust backup retention if backups consume too much space
- Consider moving RocksDB to a dedicated volume/filesystem with its own quota

## Systemd Timer Management

```bash
# View timer status
systemctl status hubble-backup.timer

# View next run times
systemctl list-timers hubble-backup.timer

# View backup logs
journalctl -u hubble-backup.service -n 50 --no-pager

# View backup script logs
tail -f /var/log/hubble-backup.log

# Run backup manually
systemctl start hubble-backup.service

# Disable timer (if needed)
systemctl disable --now hubble-backup.timer
```

## docker-compose Health Check

The healthcheck hits `http://127.0.0.1:2281/v1/info` every 60 seconds using `curl`. If it fails 6 times in a row, Docker marks the container as unhealthy.

```bash
# Check health
docker inspect degenfeed-hubble --format '{{.State.Health.Status}}'

# View health log
docker inspect degenfeed-hubble --format '{{json .State.Health.Log}}' | python3 -m json.tool
```

## Related

- [Backup Architecture](/backups/BACKUP-ARCHITECTURE.md)
- [Fleet Infrastructure](https://git.rugmunch.io/RugMunchMedia/fleet-infra)
- [Hubble Monorepo](https://github.com/farcasterxyz/hub-monorepo)
