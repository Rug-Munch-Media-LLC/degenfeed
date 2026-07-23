#!/usr/bin/env bash
# ── DegenFeed Local API Bridge — start script ────────────────────
# Starts the bridge server on port 8787, replacing the Cloudflare Worker
# for local development. The bridge proxies feed data from local services
# (GoToSocial, Redlib, etc.) and provides fallback mock content.
#
# Usage:
#   ./scripts/start-bridge.sh              # Start in foreground
#   ./scripts/start-bridge.sh --daemon     # Start as background process
#   ./scripts/start-bridge.sh --stop       # Stop the daemon
#   ./scripts/start-bridge.sh --restart    # Restart

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PIDFILE="${SCRIPT_DIR}/bridge/bridge.pid"
LOGFILE="${SCRIPT_DIR}/bridge/bridge.log"
PORT="${BRIDGE_PORT:-8787}"

start_daemon() {
    cd "$SCRIPT_DIR"
    nohup npx tsx bridge/src/server.ts >"$LOGFILE" 2>&1 &
    echo $! >"$PIDFILE"
    sleep 2
    if kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
        echo "🌉 DegenFeed Bridge started on port $PORT (pid $(cat "$PIDFILE"))"
    else
        echo "❌ Bridge failed to start. Check $LOGFILE"
        exit 1
    fi
}

stop_daemon() {
    if [ -f "$PIDFILE" ]; then
        PID=$(cat "$PIDFILE")
        kill "$PID" 2>/dev/null || true
        rm -f "$PIDFILE"
        echo "🛑 Bridge stopped"
    else
        echo "ℹ️  Bridge not running"
    fi
}

case "${1:-}" in
--daemon)
    start_daemon
    ;;
--stop)
    stop_daemon
    ;;
--restart)
    stop_daemon
    sleep 1
    start_daemon
    ;;
*)
    cd "$SCRIPT_DIR"
    exec npx tsx bridge/src/server.ts
    ;;
esac
