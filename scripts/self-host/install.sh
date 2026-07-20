#!/bin/bash
# ─────────────────────────────────────────────────────────────
# DegenFeed Self-Hosted — One-command installer
# ─────────────────────────────────────────────────────────────
# Usage:
#   curl -sSL https://degenfeed.xyz/install.sh | bash
#   curl -sSL https://degenfeed.xyz/install.sh | bash -s -- --domain alice.xyz --wallet 0x...
#
# Options:
#   --domain DOMAIN       Your domain (required)
#   --wallet ADDRESS      Your wallet address for creator coin (required)
#   --username HANDLE     Your fediverse handle (default: creator)
#   --email EMAIL         Admin email for Let's Encrypt notifications
#   --version TAG         DegenFeed image tag (default: latest)
#   --branch BRANCH       Install from a specific release branch
#   --dry-run             Print what would happen without executing
#   --help                Show this help
#
# Environment variables (alternative to flags):
#   DOMAIN, CREATOR_WALLET, CREATOR_USERNAME, EMAIL
# ─────────────────────────────────────────────────────────────

set -euo pipefail

VERSION="0.1.0"
INSTALL_DIR="${HOME}/degenfeed"
REPO_URL="https://degenfeed.xyz/self-host"
COMPOSE_FILE="docker-compose.yml"

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✗]${NC} $*" >&2; }
header() { echo -e "\n${BLUE}━━━ $* ━━━${NC}\n"; }

# ── Parse arguments ──
DOMAIN="${DOMAIN:-}"
CREATOR_WALLET="${CREATOR_WALLET:-}"
CREATOR_USERNAME="${CREATOR_USERNAME:-creator}"
EMAIL="${EMAIL:-}"
IMAGE_TAG="latest"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
    --domain)
        DOMAIN="$2"
        shift 2
        ;;
    --wallet)
        CREATOR_WALLET="$2"
        shift 2
        ;;
    --username)
        CREATOR_USERNAME="$2"
        shift 2
        ;;
    --email)
        EMAIL="$2"
        shift 2
        ;;
    --version)
        IMAGE_TAG="$2"
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
        error "Unknown option: $1"
        exit 1
        ;;
    esac
done

# ── Pre-flight checks ──
echo -e "${BLUE}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║       DegenFeed Self-Host Installer      ║"
echo "  ║          v${VERSION}                         ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${NC}"

# Check Docker
if ! command -v docker &>/dev/null; then
    error "Docker is not installed."
    echo "  Install it first:"
    echo "    curl -fsSL https://get.docker.com | sh"
    exit 1
fi

# Check Docker Compose
if ! docker compose version &>/dev/null; then
    error "Docker Compose v2 is not available."
    echo "  Update Docker:"
    echo "    apt install docker-compose-plugin"
    echo "  or download from: https://docs.docker.com/compose/install/"
    exit 1
fi

# Check for required inputs
if [[ -z "${DOMAIN}" ]]; then
    read -rp "  Your domain (e.g., alice.xyz): " DOMAIN
fi
if [[ -z "${DOMAIN}" ]]; then
    error "Domain is required."
    exit 1
fi

if [[ -z "${CREATOR_WALLET}" ]]; then
    read -rp "  Your wallet address (for creator coin): " CREATOR_WALLET
fi
if [[ -z "${CREATOR_WALLET}" ]]; then
    error "Wallet address is required."
    exit 1
fi

if [[ -z "${EMAIL}" ]]; then
    read -rp "  Your email (for Let's Encrypt, optional): " EMAIL
fi

# Confirm
echo ""
echo "  Domain:       ${DOMAIN}"
echo "  Wallet:       ${CREATOR_WALLET}"
echo "  Username:     ${CREATOR_USERNAME}"
echo "  Email:        ${EMAIL:-"(skip)"}"
echo "  Install dir:  ${INSTALL_DIR}"
echo "  Image tag:    ${IMAGE_TAG}"
echo ""

if [[ "${DRY_RUN}" == "true" ]]; then
    info "Dry-run mode — stopping here."
    info "Would install DegenFeed Self-Hosted at: ${INSTALL_DIR}"
    exit 0
fi

read -rp "  Proceed with installation? [Y/n] " confirm
confirm="${confirm:-Y}"
if [[ ! "${confirm}" =~ ^[Yy]$ ]]; then
    warn "Installation cancelled."
    exit 0
fi

# ── Create install directory ──
header "Setting up directories"
mkdir -p "${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}/data/caddy"
mkdir -p "${INSTALL_DIR}/data/degenfeed"
mkdir -p "${INSTALL_DIR}/data/redis"
mkdir -p "${INSTALL_DIR}/data/ghost"
mkdir -p "${INSTALL_DIR}/data/gotosocial"
mkdir -p "${INSTALL_DIR}/articles"
info "Created directory structure at ${INSTALL_DIR}"

# ── Download configuration files ──
header "Downloading configuration"

# Try curl with fallback to wget
download() {
    local url="$1"
    local dest="$2"
    if command -v curl &>/dev/null; then
        curl -sSL -o "${dest}" "${url}"
    elif command -v wget &>/dev/null; then
        wget -qO "${dest}" "${url}"
    else
        error "Neither curl nor wget found. Install one and retry."
        exit 1
    fi
}

# If we're running from a local checkout, copy files instead
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ -f "${SCRIPT_DIR}/${COMPOSE_FILE}" ]]; then
    cp "${SCRIPT_DIR}/${COMPOSE_FILE}" "${INSTALL_DIR}/"
    cp "${SCRIPT_DIR}/Caddyfile" "${INSTALL_DIR}/data/caddy/"
    info "Copied docker-compose.yml from local checkout"
    info "Copied Caddyfile from local checkout"
else
    download "${REPO_URL}/${COMPOSE_FILE}" "${INSTALL_DIR}/${COMPOSE_FILE}"
    download "${REPO_URL}/Caddyfile" "${INSTALL_DIR}/data/caddy/Caddyfile"
    info "Downloaded docker-compose.yml"
    info "Downloaded Caddyfile"
fi

# ── Create .env ──
header "Creating environment configuration"

cat >"${INSTALL_DIR}/.env" <<EOF
# DegenFeed Self-Hosted — Environment Configuration
# Generated by install.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# ============================================================

# ── Required ──
DOMAIN=${DOMAIN}
CREATOR_WALLET=${CREATOR_WALLET}

# ── Optional ──
CREATOR_USERNAME=${CREATOR_USERNAME}
CREATOR_COIN_CHAIN=base
CREATOR_COIN_ADDRESS=

# ── Email (for Let's Encrypt expiry notices) ──
ACME_EMAIL=${EMAIL}

# ── Ghost Blog ──
GHOST_URL=https://${DOMAIN}/articles

# ── GoToSocial ──
GO_TO_SOCIAL_URL=https://${DOMAIN}
EOF

info "Created .env file at ${INSTALL_DIR}/.env"
chmod 600 "${INSTALL_DIR}/.env"

# ── Pull images ──
header "Pulling Docker images"
echo "  (This may take a few minutes on first run)"
docker compose -f "${INSTALL_DIR}/${COMPOSE_FILE}" pull --quiet 2>/dev/null ||
    docker compose -f "${INSTALL_DIR}/${COMPOSE_FILE}" pull
info "Docker images pulled"

# ── Start services ──
header "Starting services"
docker compose -f "${INSTALL_DIR}/${COMPOSE_FILE}" up -d
info "All services started"

# ── Wait for health ──
echo ""
echo "  Waiting for services to become healthy..."
sleep 5

# Check each service
for i in $(seq 1 12); do
    sleep 5
    HEALTHY=true
    for service in degenfeed ghost gotosocial; do
        status=$(docker compose -f "${INSTALL_DIR}/${COMPOSE_FILE}" ps --format json "${service}" 2>/dev/null | grep -c "running" || true)
        if [[ "${status}" -eq 0 ]]; then
            HEALTHY=false
            break
        fi
    done
    if [[ "${HEALTHY}" == "true" ]]; then
        info "All services are running!"
        break
    fi
    echo "  Waiting for services... ($((i * 5))s)"
done

# ── Success ──
echo ""
echo -e "${GREEN}  ╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}  ║   DegenFeed Self-Hosted is LIVE! 🚀     ║${NC}"
echo -e "${GREEN}  ╚══════════════════════════════════════════╝${NC}"
echo ""
echo "  ┌──────────────────────────────────────────────┐"
echo "  │  Your DegenFeed:  https://${DOMAIN}/             │"
echo "  │  Blog:            https://${DOMAIN}/articles     │"
echo "  │  Blog Admin:      https://${DOMAIN}/articles/ghost │"
echo "  │  Creator Coin:    https://${DOMAIN}/coin         │"
echo "  │  Live Streams:    https://${DOMAIN}/live         │"
echo "  │  ActivityPub:     @${CREATOR_USERNAME}@${DOMAIN}   │"
echo "  └──────────────────────────────────────────────┘"
echo ""
echo "  ⚙️  Commands:"
echo "    Logs:    docker compose -f ${INSTALL_DIR}/docker-compose.yml logs -f"
echo "    Stop:    docker compose -f ${INSTALL_DIR}/docker-compose.yml down"
echo "    Update:  docker compose -f ${INSTALL_DIR}/docker-compose.yml pull && docker compose -f ${INSTALL_DIR}/docker-compose.yml up -d"
echo "    Backup:  tar czf degenfeed-backup-\$(date +%Y%m%d).tar.gz -C ${INSTALL_DIR} data .env"
echo ""
echo "  📖 Full guide: https://docs.degenfeed.xyz/self-host"
echo "  💬 Support:    https://discord.gg/degenfeed"
echo ""

# ── Post-install hint ──
echo -e "${YELLOW}  👋 Next steps:${NC}"
echo "   1. Make sure your DNS A/AAAA records point to this server's IP"
echo "   2. Configure your creator coin at the admin panel:"
echo "      https://${DOMAIN}/admin/coin"
echo "   3. Set up cross-platform posting in Settings"
echo "   4. Write your first blog post at:"
echo "      https://${DOMAIN}/articles/ghost"
echo ""

info "Installation complete!"
