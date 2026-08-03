#!/bin/sh
# DegenFeed Web — startup entrypoint
#
# Starts the Next.js standalone server and pre-warms the feed caches so the
# first user request after a container restart is fast. Without this, the
# first hit to /api/feed/home takes ~20s because the bridge aggregates 30+
# providers on its first request.
#
# Pre-warming /api/feed/home populates BOTH the web proxy cache and (via the
# proxy) the bridge feed cache, so the first user hit is served from cache.

set -e

# Start the Next.js standalone server in the background
node apps/web/server.js &
SERVER_PID=$!

# Forward shutdown signals to the server so `docker stop` is graceful
trap 'kill -TERM "$SERVER_PID" 2>/dev/null' TERM INT

# Wait for the app to become healthy (up to 60s)
ready=0
i=0
while [ "$i" -lt 60 ]; do
    if wget -qO- -T 2 http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
        ready=1
        break
    fi
    i=$((i + 1))
    sleep 1
done

if [ "$ready" -eq 1 ]; then
    echo "[entrypoint] App healthy — pre-warming feed caches..."
    # Allow up to 60s for the first (cold) feed build on the bridge side.
    wget -qO- -T 60 "http://127.0.0.1:3000/api/feed/home?limit=1" >/dev/null 2>&1 || true
    echo "[entrypoint] Feed pre-warm complete"
else
    echo "[entrypoint] App did not become healthy within 60s — skipping pre-warm"
fi

# Keep the server as the foreground process
wait "$SERVER_PID"
