#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# DegenFeed Self-Hosted — Cloudflare Tunnel Setup
# ──────────────────────────────────────────────────────────────────────────────
# Sets up Cloudflare Argo Tunnel (cloudflared) to expose your DegenFeed instance
# without opening ports 80/443 to the internet.
#
# Benefits:
#   - No open ports needed (tunnel connects outbound)
#   - DDoS protection via Cloudflare
#   - Automatic SSL/TLS (no certbot needed)
#   - Access controls (Cloudflare Zero Trust)
#   - Faster initial deployment (no DNS propagation wait)
#
# Prerequisites:
#   - Cloudflare account (free tier works)
#   - Domain on Cloudflare
#   - DegenFeed already running on this server (docker compose up -d)
#
# Usage:
#   ./cloudflared-setup.sh                          # Interactive setup
#   ./cloudflared-setup.sh --domain alice.xyz        # Automated
#   ./cloudflared-setup.sh --domain alice.xyz --dry-run
#   ./cloudflared-setup.sh --help
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
info() { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✗]${NC} $*" >&2; }
header() { echo -e "\n${BLUE}━━━ $* ━━━${NC}\n"; }
step() { echo -e "  ${BLUE}→${NC} $*"; }

DOMAIN="${DOMAIN:-}"
INSTALL_DIR="${HOME}/degenfeed"
DRY_RUN=false

# ── Parse arguments ────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
    --domain)
        DOMAIN="$2"
        shift 2
        ;;
    --dry-run)
        DRY_RUN=true
        shift
        ;;
    --help | -h)
        sed -n '/^# Usage:/,/^$/p' "$0" | sed 's/^#//'
        exit 0
        ;;
    *)
        error "Unknown: $1"
        exit 1
        ;;
    esac
done

echo -e "${BLUE}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║       DegenFeed — Cloudflare Tunnel Setup              ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Check prerequisites ──────────────────────────────────────────────
header "Checking Prerequisites"

if ! command -v cloudflared &>/dev/null; then
    step "Installing cloudflared..."
    case "$(uname -m)" in
    x86_64)
        curl -sSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
            -o /tmp/cloudflared
        ;;
    aarch64)
        curl -sSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 \
            -o /tmp/cloudflared
        ;;
    *)
        error "Unsupported architecture: $(uname -m)"
        exit 1
        ;;
    esac
    chmod +x /tmp/cloudflared
    sudo mv /tmp/cloudflared /usr/local/bin/cloudflared
    info "cloudflared installed: $(cloudflared --version)"
else
    info "cloudflared already installed: $(cloudflared --version)"
fi

# ── Get domain ────────────────────────────────────────────────────────
header "Configuration"

if [[ -z "${DOMAIN}" ]]; then
    if [[ -f "${INSTALL_DIR}/.env" ]]; then
        DOMAIN=$(grep -E '^DOMAIN=' "${INSTALL_DIR}/.env" | cut -d= -f2)
    fi
fi

if [[ -z "${DOMAIN}" ]]; then
    read -rp "  Your domain (e.g., alice.xyz): " DOMAIN
fi

if [[ -z "${DOMAIN}" ]]; then
    error "Domain required."
    exit 1
fi

# Check if DegenFeed is running
if docker compose -f "${INSTALL_DIR}/docker-compose.yml" ps --format json degenfeed 2>/dev/null | grep -q "running"; then
    info "DegenFeed is running on this server"
else
    warn "DegenFeed doesn't appear to be running at ${INSTALL_DIR}"
    warn "Start it first: cd ${INSTALL_DIR} && docker compose up -d"
    read -rp "  Continue anyway? [Y/n] " cont
    cont="${cont:-Y}"
    if [[ ! "${cont}" =~ ^[Yy]$ ]]; then exit 1; fi
fi

# ── Authenticate cloudflared ─────────────────────────────────────────
header "Cloudflare Authentication"

echo "  A browser window will open. Log in to Cloudflare and"
echo "  authorize the tunnel to access your domain."
echo ""
echo "  If running on a headless server, use the URL below."
echo ""

if [[ "${DRY_RUN}" == "true" ]]; then
    step "Would run: cloudflared tunnel login"
    exit 0
fi

cloudflared tunnel login
info "Authentication successful!"

# ── Create tunnel ────────────────────────────────────────────────────
header "Creating Tunnel"

TUNNEL_NAME="degenfeed-${DOMAIN//./-}"

# Check if tunnel already exists
EXISTING=$(cloudflared tunnel list 2>/dev/null | grep "${TUNNEL_NAME}" || true)
if [[ -n "${EXISTING}" ]]; then
    warn "Tunnel '${TUNNEL_NAME}' already exists."
    read -rp "  Create a new one with a different name? [y/N] " new_tunnel
    if [[ "${new_tunnel}" =~ ^[Yy]$ ]]; then
        TUNNEL_NAME="degenfeed-$(date +%s)"
    else
        info "Using existing tunnel: ${TUNNEL_NAME}"
    fi
fi

if ! cloudflared tunnel list 2>/dev/null | grep -q "${TUNNEL_NAME}"; then
    step "Creating tunnel '${TUNNEL_NAME}'..."
    cloudflared tunnel create "${TUNNEL_NAME}"
    info "Tunnel created: ${TUNNEL_NAME}"
fi

# Get tunnel ID
TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep "${TUNNEL_NAME}" | awk '{print $1}')
if [[ -z "${TUNNEL_ID}" ]]; then
    error "Could not find tunnel ID for '${TUNNEL_NAME}'"
    exit 1
fi
info "Tunnel ID: ${TUNNEL_ID}"

# ── Create config file ───────────────────────────────────────────────
header "Creating Tunnel Configuration"

mkdir -p "${INSTALL_DIR}/data/cloudflared"

cat >"${INSTALL_DIR}/data/cloudflared/config.yml" <<CONFIGEOF
# DegenFeed — Cloudflare Tunnel Configuration
# Generated by cloudflared-setup.sh
# Tunnel: ${TUNNEL_NAME}

tunnel: ${TUNNEL_ID}
credentials-file: /home/$(whoami)/.cloudflared/${TUNNEL_ID}.json

# Logging
logfile: /var/log/cloudflared.log
loglevel: info

# Ingress rules — route traffic to internal Docker services
ingress:
  # ── DegenFeed Web ──
  - hostname: ${DOMAIN}
    service: http://localhost:3000
    originRequest:
      noTLSVerify: true

  # ── Ghost Blog (via nginx) ──
  - hostname: articles.${DOMAIN}
    service: http://localhost:2368
    originRequest:
      noTLSVerify: true

  # ── Catch-all ──
  - service: http_status:404
CONFIGEOF
info "Tunnel config created at ${INSTALL_DIR}/data/cloudflared/config.yml"

# ── DNS configuration ───────────────────────────────────────────────
header "Configuring DNS"

step "Routing ${DOMAIN} to tunnel..."
cloudflared tunnel route dns "${TUNNEL_NAME}" "${DOMAIN}" || true
info "${DOMAIN} → tunnel"

read -rp "  Route articles.${DOMAIN} to tunnel as well? [Y/n] " route_articles
route_articles="${route_articles:-Y}"
if [[ "${route_articles}" =~ ^[Yy]$ ]]; then
    step "Routing articles.${DOMAIN} to tunnel..."
    cloudflared tunnel route dns "${TUNNEL_NAME}" "articles.${DOMAIN}" || true
    info "articles.${DOMAIN} → tunnel"
fi

# ── Install as system service ────────────────────────────────────────
header "Installing as System Service"

step "Installing cloudflared as systemd service..."
sudo cloudflared service install
info "Service installed"

step "Starting service..."
sudo systemctl enable cloudflared
sudo systemctl restart cloudflared
info "cloudflared service started"

# Wait for tunnel to establish
step "Waiting for tunnel connection..."
sleep 5
if systemctl is-active --quiet cloudflared; then
    info "Tunnel is active!"
else
    warn "Tunnel may not be ready yet. Check: sudo systemctl status cloudflared"
fi

# ── Update .env ──────────────────────────────────────────────────────
header "Updating Environment"

if [[ -f "${INSTALL_DIR}/.env" ]]; then
    # Add tunnel token to .env so Docker compose can use it
    if grep -q "CLOUDFLARE_TUNNEL_TOKEN" "${INSTALL_DIR}/.env" 2>/dev/null; then
        sed -i "s/CLOUDFLARE_TUNNEL_TOKEN=.*/CLOUDFLARE_TUNNEL_TOKEN=${TUNNEL_ID}/" "${INSTALL_DIR}/.env"
    else
        {
            echo ""
            echo "# Cloudflare Tunnel (added by cloudflared-setup.sh)"
            echo "CLOUDFLARE_TUNNEL_TOKEN=${TUNNEL_ID}"
        } >>"${INSTALL_DIR}/.env"
    fi
    info "Updated .env with tunnel reference"
fi

# ── Success ──────────────────────────────────────────────────────────
echo -e "${GREEN}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║      Cloudflare Tunnel Setup Complete! 🚀              ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo "  Your DegenFeed is now accessible via Cloudflare Tunnel."
echo "  No ports 80/443 need to be open on your server."
echo ""
echo "  ┌─────────────────────────────────────────────────────────┐"
echo "  │  Your DegenFeed:   https://${DOMAIN}/                      │"
echo "  │  Blog:             https://${DOMAIN}/articles               │"
echo "  └─────────────────────────────────────────────────────────┘"
echo ""
echo "  ⚙️  Tunnel management:"
echo "    Status:  sudo systemctl status cloudflared"
echo "    Logs:    sudo journalctl -u cloudflared -f"
echo "    Stop:    sudo systemctl stop cloudflared"
echo "    Restart: sudo systemctl restart cloudflared"
echo "    Delete:  cloudflared tunnel delete ${TUNNEL_NAME}"
echo ""
echo "  📖  Cloudflare docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/"
echo ""

# ── Security note ────────────────────────────────────────────────────
echo -e "${YELLOW}  🔒 Security Note:${NC}"
echo "  Since you're using Cloudflare Tunnel, you don't need ports"
echo "  80/443 open. Restrict them in your firewall:"
echo ""
echo "    sudo ufw allow ssh"
echo "    sudo ufw default deny incoming"
echo "    sudo ufw enable"
echo ""
echo "  If you already had iptables rules, update them."
echo ""

info "Cloudflare Tunnel setup complete!"
