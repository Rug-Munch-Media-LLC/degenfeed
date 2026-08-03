#!/usr/bin/env bash
# ── Register Owncast Webhook → Bridge ─────────────────────────────────────
# Registers the DegenFeed Bridge as a webhook receiver on Owncast so the
# bridge can orchestrate auto-restream (Owncast HLS → Restreamer → PeerTube).
#
# Owncast admin API (0.2.x, confirmed from owncast/owncast source):
#   POST /api/admin/webhooks/create
#     body: { "url": "...", "events": ["STREAM_STARTED", "STREAM_STOPPED"] }
#     auth: HTTP Basic (admin:<OWNCAST_ADMIN_PASSWORD>)
#
# Usage:
#   bash register-owncast-webhook.sh [--force]
#
# Idempotent: skips registration if a webhook to the bridge already exists
# unless --force is passed.
# ─────────────────────────────────────────────────────────────────────────

set -euo pipefail

OWNCAST_URL="${OWNCAST_URL:-http://127.0.0.1:8092}"
BRIDGE_URL="${BRIDGE_WEBHOOK_URL:-http://127.0.0.1:8787/api/webhooks/owncast}"
OWNCAST_ADMIN_PASSWORD="${OWNCAST_ADMIN_PASSWORD:-degenfeed_admin}"
EVENTS='["STREAM_STARTED","STREAM_STOPPED"]'
FORCE="${1:-}"

echo "📡 Owncast Webhook Registration"
echo "==============================="
echo "  Owncast : ${OWNCAST_URL}"
echo "  Bridge  : ${BRIDGE_URL}"
echo "  Events  : ${EVENTS}"
echo

# ── Check prerequisites ──────────────────────────────────────────────────
command -v curl &>/dev/null || {
    echo "❌ curl required"
    exit 1
}

# ── Verify Owncast is reachable ──────────────────────────────────────────
if ! curl -sf "${OWNCAST_URL}/api/status" >/dev/null 2>&1; then
    echo "❌ Owncast not reachable at ${OWNCAST_URL} (is it running?)"
    exit 1
fi
echo "✅ Owncast reachable"

# ── Load password from compose .env if present (non-destructive) ─────────
ENV_FILE="$(dirname "$0")/../.env"
if [[ -f "${ENV_FILE}" ]] && grep -qE '^OWNCAST_ADMIN_PASSWORD=' "${ENV_FILE}"; then
    OWNCAST_ADMIN_PASSWORD="$(grep -E '^OWNCAST_ADMIN_PASSWORD=' "${ENV_FILE}" | head -1 | cut -d= -f2-)"
fi

# ── Idempotency check ────────────────────────────────────────────────────
if [[ "${FORCE}" != "--force" ]]; then
    EXISTING="$(curl -sf -u "admin:${OWNCAST_ADMIN_PASSWORD}" "${OWNCAST_URL}/api/admin/webhooks" || true)"
    if [[ "${EXISTING}" == *"${BRIDGE_URL}"* ]]; then
        echo "ℹ️  Webhook to ${BRIDGE_URL} already registered — nothing to do."
        echo "   (Use --force to re-register.)"
        exit 0
    fi
fi

# ── Register the webhook ─────────────────────────────────────────────────
echo "🔗 Registering webhook..."
RESPONSE="$(curl -sf \
    -u "admin:${OWNCAST_ADMIN_PASSWORD}" \
    -X POST "${OWNCAST_URL}/api/admin/webhooks/create" \
    -H 'Content-Type: application/json' \
    -d "{\"url\":\"${BRIDGE_URL}\",\"events\":${EVENTS}}" || {
    echo "❌ Webhook registration failed (bad admin password or API error)"
    exit 1
})"

echo "✅ Registered: ${RESPONSE}"
echo
echo "👉 Verify: curl -u admin:<password> ${OWNCAST_URL}/api/admin/webhooks"
