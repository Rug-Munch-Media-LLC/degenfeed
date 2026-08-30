#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# DegenFeed — Next.js standalone build + static asset copy (production reality)
# ──────────────────────────────────────────────────────────────────────────────
# The systemd unit `degenfeed-web.service` runs from
#   <repo>/apps/web/.next/standalone/apps/web/server.js  (127.0.0.1:3100)
#
# Next.js `output: "standalone"` does NOT copy `public/` or `.next/static/`
# into the standalone dir — the live app serves no images/logos without them.
# This script builds the app and copies BOTH asset trees into the standalone
# output before the service is restarted.
#
# Usage:
#   bash deploy/build-standalone.sh                 # build + copy (no restart)
#   bash deploy/build-standalone.sh --restart       # build + copy + restart unit
#   APP_DIR=/path/to/checkout bash deploy/build-standalone.sh
#
# Manual one-liner equivalent (after `pnpm install --frozen-lockfile`):
#   pnpm --filter degenfeed build \
#     && rm -rf apps/web/.next/standalone/apps/web/public \
#     && cp -r apps/web/public apps/web/.next/standalone/apps/web/public \
#     && mkdir -p apps/web/.next/standalone/apps/web/.next \
#     && rm -rf apps/web/.next/standalone/apps/web/.next/static \
#     && cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

APP_DIR="${APP_DIR:-$(pwd)}"
SERVICE="${SERVICE:-degenfeed-web}"
RESTART=false
for arg in "$@"; do
    case "$arg" in
    --restart) RESTART=true ;;
    *)
        echo "Unknown option: $arg" >&2
        exit 1
        ;;
    esac
done

cd "$APP_DIR"

echo "=== Building web app (standalone) ==="
pnpm --filter degenfeed build

STANDALONE_WEB="apps/web/.next/standalone/apps/web"

echo "=== Copying public/ into standalone ==="
rm -rf "$STANDALONE_WEB/public"
cp -r apps/web/public "$STANDALONE_WEB/public"

echo "=== Copying .next/static into standalone ==="
mkdir -p "$STANDALONE_WEB/.next"
rm -rf "$STANDALONE_WEB/.next/static"
cp -r apps/web/.next/static "$STANDALONE_WEB/.next/static"

echo "=== Standalone asset tree ==="
find "$STANDALONE_WEB/public" -maxdepth 1 | head -5
find "$STANDALONE_WEB/.next/static" -maxdepth 1 | head -5

if [ "$RESTART" = true ]; then
    echo "=== Restarting $SERVICE ==="
    sudo systemctl restart "$SERVICE"
    for _ in $(seq 1 12); do
        if curl -sf --max-time 5 http://127.0.0.1:3100/api/health >/dev/null 2>&1; then
            echo "Health check PASSED"
            exit 0
        fi
        sleep 5
    done
    echo "Health check FAILED after 60s" >&2
    journalctl -u "$SERVICE" --no-pager -n 30 >&2 || true
    exit 1
fi

echo "Done. Restart the unit: sudo systemctl restart $SERVICE"
