#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# health-check.sh — HTTP health check for DegenFeed services
# Usage: ./scripts/health-check.sh [url]
#   Default: http://localhost:3000/api/feed/health
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

URL="${1:-http://localhost:3000/api/feed/health}"
TIMEOUT=10

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Health Check: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "  URL:          $URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Perform health check with timeout
response=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$URL" 2>/dev/null || echo "000")
body=$(curl -s --max-time "$TIMEOUT" "$URL" 2>/dev/null || echo "{}")

echo ""
echo "  HTTP Status: $response"

if [ "$response" = "200" ]; then
    echo "  Status:      OK"
    echo "  Response:    $body" | head -c 500
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ✓ Service is healthy"
    exit 0
elif [ "$response" = "000" ]; then
    echo "  Status:      DOWN (connection failed)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ✕ Service is unreachable"
    exit 2
else
    echo "  Status:      DEGRADED (HTTP $response)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ✕ Service returned non-200 status"
    exit 1
fi
