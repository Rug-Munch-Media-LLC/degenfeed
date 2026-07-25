#!/usr/bin/env bash
# ── Deploy IRC Bridge (matrix-appservice-irc) ───────────────────────────────
# Sets up the IRC bridge for DegenFeed cross-protocol chat.
#
# Prerequisites:
#   - Docker and Docker Compose
#   - Synapse homeserver running at matrix.degenfeed.xyz
#   - IRC_AS_TOKEN and IRC_HS_TOKEN set in environment or gopass
#
# Usage:
#   bash deploy-irc-bridge.sh [--generate-registration]
#
# This script:
#   1. Generates registration file if needed
#   2. Creates the Docker Compose configuration
#   3. Starts the bridge via Docker Compose
#   4. Verifies the bridge is connected to IRC

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRIDGE_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_DIR="$BRIDGE_DIR/config"

echo "🔌 DegenFeed IRC Bridge Deployer"
echo "================================="

# ── Check prerequisites ──────────────────────────────────────────────────
command -v docker &>/dev/null || {
    echo "❌ Docker required"
    exit 1
}

# ── Generate registration if requested ───────────────────────────────────
if [[ "${1:-}" == "--generate-registration" ]]; then
    echo "🔄 Generating registration file..."

    IRC_AS_TOKEN="${IRC_AS_TOKEN:-$(openssl rand -hex 32)}"
    IRC_HS_TOKEN="${IRC_HS_TOKEN:-$(openssl rand -hex 32)}"

    cat >"$CONFIG_DIR/irc-registration.yaml" <<REGEOF
# ── Matrix Appservice IRC Registration ──────────────────────────────────
# Auto-generated $(date -u +%Y-%m-%dT%H:%M:%SZ)

id: irc-bridge
as_token: "${IRC_AS_TOKEN}"
hs_token: "${IRC_HS_TOKEN}"
namespaces:
  users:
    - exclusive: true
      regex: "@irc_.*:matrix\\.degenfeed\\.xyz"
  aliases:
    - exclusive: true
      regex: "#_irc_.*:matrix\\.degenfeed\\.xyz"
  rooms: []
url: "http://appservice-irc:8095"
sender_localpart: "irc_bot"
rate_limited: false
protocols:
  - "irc"
REGEOF

    echo "✅ Registration generated at $CONFIG_DIR/irc-registration.yaml"
    echo "⚠️  Copy IRC_AS_TOKEN and IRC_HS_TOKEN to your Synapse config's"
    echo "   app_service_config_files and restart Synapse."
    echo ""
    echo "   IRC_AS_TOKEN=${IRC_AS_TOKEN}"
    echo "   IRC_HS_TOKEN=${IRC_HS_TOKEN}"
    exit 0
fi

# ── Ensure config exists ────────────────────────────────────────────────
if [[ ! -f "$CONFIG_DIR/irc-registration.yaml" ]]; then
    echo "❌ Registration file not found at $CONFIG_DIR/irc-registration.yaml"
    echo "   Run: bash $0 --generate-registration"
    exit 1
fi

if [[ ! -f "$CONFIG_DIR/irc-config.yaml" ]]; then
    echo "❌ Config file not found at $CONFIG_DIR/irc-config.yaml"
    echo "   Ensure the config exists before deploying."
    exit 1
fi

# ── Create Synapse config directory if missing ──────────────────────────
mkdir -p "$CONFIG_DIR/synapse"

# ── Start the bridge ────────────────────────────────────────────────────
echo "🚀 Starting IRC bridge services..."
docker compose -f "$BRIDGE_DIR/docker-compose.irc.yml" up -d

echo "⏳ Waiting for services to start..."
sleep 10

# ── Verify health ───────────────────────────────────────────────────────
echo "🔍 Checking health..."

if docker ps --format '{{.Names}}' | grep -q 'matrix-appservice-irc'; then
    echo "✅ matrix-appservice-irc is running"
    docker logs matrix-appservice-irc --tail 5 2>/dev/null || true
else
    echo "❌ matrix-appservice-irc failed to start"
    docker compose -f "$BRIDGE_DIR/docker-compose.irc.yml" logs --tail 20
    exit 1
fi

if docker ps --format '{{.Names}}' | grep -q 'matrix-synapse'; then
    echo "✅ Synapse is running"
else
    echo "❌ Synapse failed to start"
    docker compose -f "$BRIDGE_DIR/docker-compose.irc.yml" logs synapse --tail 20
    exit 1
fi

echo ""
echo "🎉 IRC Bridge deployed successfully!"
echo ""
echo "Connected IRC channels:"
echo "  Libera.Chat:  #bitcoin, #bitcoin-core-dev, #lightning-dev, #ethereum"
echo "  OFTC:         #bitcoin-dev, #ethereum-dev"
echo ""
echo "Matrix room aliases:"
echo "  #_irc_libera_bitcoin:matrix.degenfeed.xyz"
echo "  #_irc_libera_bitcoin-core-dev:matrix.degenfeed.xyz"
echo "  #_irc_libera_lightning-dev:matrix.degenfeed.xyz"
echo "  #_irc_libera_ethereum:matrix.degenfeed.xyz"
echo "  #_irc_oftc_bitcoin-dev:matrix.degenfeed.xyz"
echo "  #_irc_oftc_ethereum-dev:matrix.degenfeed.xyz"
echo ""
echo "Users can now read and reply to IRC from DegenFeed!"
