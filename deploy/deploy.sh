#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# DegenFeed Self-Hosted — Interactive Deployment Script
# ──────────────────────────────────────────────────────────────────────────────
# Deploys a complete DegenFeed instance on any Linux server with Docker.
#
# Usage:
#   Interactive:     ./deploy.sh
#   Automated:       ./deploy.sh --domain alice.xyz --wallet 0x...
#   Dry run:         ./deploy.sh --domain alice.xyz --wallet 0x... --dry-run
#   Help:            ./deploy.sh --help
#
# One-liner (from GitHub):
#   bash <(curl -sSL https://raw.githubusercontent.com/RugMunchMedia/degenfeed/main/deploy/deploy.sh)
#
# Options:
#   --domain DOMAIN       Your domain (required)
#   --wallet ADDRESS      Your wallet address for creator coin (required)
#   --username HANDLE     Your fediverse handle (default: creator)
#   --email EMAIL         Admin email for Let's Encrypt notifications
#   --version TAG         DegenFeed image tag (default: latest)
#   --dry-run             Print what would happen without executing
#   --help                Show this help
#
# Environment variables (alternative to flags):
#   DOMAIN, CREATOR_WALLET, CREATOR_USERNAME, EMAIL
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

VERSION="0.1.0"
INSTALL_DIR="${HOME}/degenfeed"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="docker-compose.prod.yml"

# ── Colors ──────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

info() { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✗]${NC} $*" >&2; }
header() { echo -e "\n${BLUE}━━━ $* ━━━${NC}\n"; }
step() { echo -e "${CYAN}→${NC} $*"; }

# ── Parse arguments ────────────────────────────────────────────────────
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

# ── Banner ─────────────────────────────────────────────────────────────
clear
echo -e "${BLUE}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║                                                         ║"
echo "  ║            DegenFeed Self-Hosted Installer              ║"
echo "  ║            v${VERSION}                                       ║"
echo "  ║                                                         ║"
echo "  ║  Deploy your own creator platform. Own your data.       ║"
echo "  ║  Own your domain. Own your audience.                    ║"
echo "  ║                                                         ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Pre-flight Checks ─────────────────────────────────────────────────
header "Pre-flight Checks"

# Check root/sudo
if [[ "$(id -u)" -eq 0 ]]; then
    warn "Running as root. This is fine, but non-root is recommended."
    warn "Create a non-root user: adduser degenfeed && usermod -aG docker degenfeed"
    echo ""
fi

# Check Docker
step "Checking Docker..."
if ! command -v docker &>/dev/null; then
    error "Docker is not installed."
    echo ""
    echo "  Install Docker with:"
    echo "    curl -fsSL https://get.docker.com | sh"
    echo "    sudo usermod -aG docker \$USER"
    echo "    # Then log out and back in"
    echo ""
    exit 1
fi
info "Docker $(docker --version | sed 's/Docker version //' | cut -d, -f1)"

# Check Docker Compose v2
step "Checking Docker Compose..."
if ! docker compose version &>/dev/null; then
    error "Docker Compose v2 is not available."
    echo "  Install the compose plugin:"
    echo "    sudo apt install docker-compose-plugin    # Debian/Ubuntu"
    echo "    sudo dnf install docker-compose-plugin    # Fedora/RHEL"
    exit 1
fi
info "Compose: $(docker compose version | sed 's/Docker Compose version //')"

# Check OS
step "Checking system..."
OS="$(uname -s)"
ARCH="$(uname -m)"
if [[ "${OS}" != "Linux" ]]; then
    error "DegenFeed Self-Hosted requires Linux (detected: ${OS})"
    exit 1
fi
info "OS: ${OS} ${ARCH}"

# Check available disk space
AVAIL_GB=$(df --output=avail / 2>/dev/null | tail -1 | awk '{print int($1/1024/1024)}' || echo "unknown")
if [[ "${AVAIL_GB}" != "unknown" ]] && [[ "${AVAIL_GB}" -lt 10 ]]; then
    warn "Low disk space: ~${AVAIL_GB}GB available. 10GB+ recommended."
fi

# ── Collect Inputs ────────────────────────────────────────────────────
header "Configuration"

if [[ -z "${DOMAIN}" ]]; then
    echo "  Enter your domain name (e.g., alice.xyz)"
    echo "  DNS A record must point to this server's IP."
    echo ""
    read -rp "  Domain: " DOMAIN
    echo ""
fi

if [[ -z "${DOMAIN}" ]]; then
    error "Domain is required."
    exit 1
fi

# Validate domain format
if [[ ! "${DOMAIN}" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$ ]]; then
    warn "Domain '${DOMAIN}' doesn't look like a valid domain. Continue anyway? [Y/n]"
    read -rp "  " confirm
    confirm="${confirm:-Y}"
    if [[ ! "${confirm}" =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

if [[ -z "${CREATOR_WALLET}" ]]; then
    echo "  Enter your wallet address for the creator coin."
    echo "  EVM (Base):   0x..."
    echo "  Solana:       4x..."
    echo ""
    read -rp "  Wallet: " CREATOR_WALLET
    echo ""
fi

if [[ -z "${CREATOR_WALLET}" ]]; then
    error "Wallet address is required."
    exit 1
fi

if [[ -z "${EMAIL}" ]]; then
    read -rp "  Email (for Let's Encrypt, optional): " EMAIL
    echo ""
fi

# ── Display Summary ───────────────────────────────────────────────────
echo ""
echo "  ┌─────────────────────────────────────────────────────┐"
echo "  │                  Deployment Summary                 │"
echo "  ├─────────────────────────────────────────────────────┤"
printf "  │  %-20s  %-30s  │\n" "Domain" "${DOMAIN}"
printf "  │  %-20s  %-30s  │\n" "Wallet" "${CREATOR_WALLET:0:20}..."
printf "  │  %-20s  %-30s  │\n" "Username" "${CREATOR_USERNAME}"
printf "  │  %-20s  %-30s  │\n" "Email" "${EMAIL:-(skip)}"
printf "  │  %-20s  %-30s  │\n" "Install Dir" "${INSTALL_DIR}"
printf "  │  %-20s  %-30s  │\n" "Image Tag" "${IMAGE_TAG}"
echo "  └─────────────────────────────────────────────────────┘"
echo ""

if [[ "${DRY_RUN}" == "true" ]]; then
    info "Dry-run mode — stopping here. Would install at: ${INSTALL_DIR}"
    exit 0
fi

read -rp "  Proceed with installation? [Y/n] " confirm
confirm="${confirm:-Y}"
if [[ ! "${confirm}" =~ ^[Yy]$ ]]; then
    warn "Installation cancelled."
    exit 0
fi

# ── Create Directory Structure ────────────────────────────────────────
header "Setting up Directories"

step "Creating directory structure at ${INSTALL_DIR}..."
mkdir -p "${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}/data/nginx/ssl"
mkdir -p "${INSTALL_DIR}/data/nginx/logs"
mkdir -p "${INSTALL_DIR}/data/degenfeed"
mkdir -p "${INSTALL_DIR}/data/redis"
mkdir -p "${INSTALL_DIR}/data/ghost"
mkdir -p "${INSTALL_DIR}/data/gotosocial"
mkdir -p "${INSTALL_DIR}/articles"
info "Directory structure created"

# ── Copy Configuration Files ──────────────────────────────────────────
header "Installing Configuration Files"

# Copy docker-compose.prod.yml
if [[ -f "${SCRIPT_DIR}/${COMPOSE_FILE}" ]]; then
    cp "${SCRIPT_DIR}/${COMPOSE_FILE}" "${INSTALL_DIR}/docker-compose.yml"
    info "Copied docker-compose.yml"
else
    warn "docker-compose.prod.yml not found alongside this script."
    step "Downloading from GitHub..."
    curl -sSL -o "${INSTALL_DIR}/docker-compose.yml" \
        "https://raw.githubusercontent.com/RugMunchMedia/degenfeed/main/deploy/docker-compose.prod.yml"
    info "Downloaded docker-compose.yml"
fi

# Copy nginx.conf
if [[ -f "${SCRIPT_DIR}/nginx.conf" ]]; then
    cp "${SCRIPT_DIR}/nginx.conf" "${INSTALL_DIR}/nginx.conf"
    info "Copied nginx.conf"
else
    step "Downloading nginx.conf from GitHub..."
    curl -sSL -o "${INSTALL_DIR}/nginx.conf" \
        "https://raw.githubusercontent.com/RugMunchMedia/degenfeed/main/deploy/nginx.conf"
    info "Downloaded nginx.conf"
fi

# ── Create .env ───────────────────────────────────────────────────────
header "Creating Environment Configuration"

if [[ -f "${INSTALL_DIR}/.env" ]]; then
    warn ".env already exists at ${INSTALL_DIR}/.env"
    warn "Overwriting will replace your existing configuration."
    read -rp "  Overwrite .env? [y/N] " overwrite
    overwrite="${overwrite:-N}"
    if [[ ! "${overwrite}" =~ ^[Yy]$ ]]; then
        info "Keeping existing .env"
    else
        create_env=true
    fi
else
    create_env=true
fi

if [[ "${create_env:-false}" == "true" ]]; then
    cat >"${INSTALL_DIR}/.env" <<EOF
# ── DegenFeed Self-Hosted — Environment Configuration ──
# Generated by deploy.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# ────────────────────────────────────────────────────────

# ── Required ──
DOMAIN=${DOMAIN}
CREATOR_WALLET=${CREATOR_WALLET}

# ── Identity ──
CREATOR_USERNAME=${CREATOR_USERNAME}

# ── Creator Coin ──
CREATOR_COIN_CHAIN=base
CREATOR_COIN_ADDRESS=

# ── Email (for Let's Encrypt expiry notices) ──
ACME_EMAIL=${EMAIL}

# ── Branding ──
WHITE_LABEL=false
BRAND_COLOR=
CUSTOM_FAVICON=

# ── Image Tag ──
IMAGE_TAG=${IMAGE_TAG}

# ── Cross-Protocol Credentials (set these later) ──
NOSTR_PRIVATE_KEY=
NEYNAR_API_KEY=
BSKY_DID=
GTS_CLIENT_ID=
GTS_CLIENT_SECRET=
YOUTUBE_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_NAME=

# ── Web3 ──
BASE_RPC_URL=https://mainnet.base.org
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
ZORA_WRAPPER_FACTORY=
PREMIUM_WALLET_KEY=

# ── Cloudflare Tunnel (optional) ──
CLOUDFLARE_TUNNEL_TOKEN=
EOF
    chmod 600 "${INSTALL_DIR}/.env"
    info "Created .env file at ${INSTALL_DIR}/.env"
fi

# ── Generate SSL (self-signed fallback) ───────────────────────────────
header "SSL Certificate Setup"

if [[ ! -f "${INSTALL_DIR}/data/nginx/ssl/fullchain.pem" ]]; then
    step "No SSL certificate found."
    echo "  TLS options:"
    echo "    1) Let's Encrypt (auto, via Certbot) — recommended"
    echo "    2) Cloudflare (origin pull cert)"
    echo "    3) Self-signed (for testing only)"
    echo "    4) Skip — I'll set up TLS myself"
    echo ""
    read -rp "  Choose [1-4] (default: 1): " ssl_choice
    ssl_choice="${ssl_choice:-1}"

    case "${ssl_choice}" in
    1)
        step "Installing Certbot..."
        if command -v apt &>/dev/null; then
            sudo apt update -qq && sudo apt install -y -qq certbot
        elif command -v dnf &>/dev/null; then
            sudo dnf install -y certbot
        else
            warn "Unknown package manager. Install certbot manually."
        fi
        if command -v certbot &>/dev/null; then
            step "Obtaining Let's Encrypt certificate for ${DOMAIN}..."
            sudo certbot certonly --standalone -d "${DOMAIN}" --non-interactive \
                --agree-tos --email "${EMAIL:-admin@${DOMAIN}}" || true
            # Copy certs to nginx ssl directory
            if [[ -d "/etc/letsencrypt/live/${DOMAIN}" ]]; then
                sudo cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" \
                    "${INSTALL_DIR}/data/nginx/ssl/"
                sudo cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" \
                    "${INSTALL_DIR}/data/nginx/ssl/"
                sudo chown -R "$(id -u):$(id -g)" "${INSTALL_DIR}/data/nginx/ssl/"
                info "Let's Encrypt certificate installed"
            fi
        else
            warn "Certbot installation failed. Will use self-signed."
            ssl_choice=3
        fi
        ;;
    2)
        step "Cloudflare origin pull certificate setup..."
        echo "  1. Go to Cloudflare Dashboard → SSL/TLS → Origin Server"
        echo "  2. Create an origin pull certificate for ${DOMAIN}"
        echo "  3. Save the cert (.pem) and key (.pem) files"
        echo "  4. Place them in: ${INSTALL_DIR}/data/nginx/ssl/"
        echo ""
        read -rp "  Press Enter after you've placed the cert files... "
        if [[ -f "${INSTALL_DIR}/data/nginx/ssl/fullchain.pem" ]] &&
            [[ -f "${INSTALL_DIR}/data/nginx/ssl/privkey.pem" ]]; then
            info "Cloudflare certificate found"
        else
            warn "Certificate files not found. Using self-signed fallback."
            ssl_choice=3
        fi
        ;;
    *) # Skip or self-signed
        ;;
    esac

    # Self-signed fallback
    if [[ "${ssl_choice}" == "3" ]] ||
        [[ ! -f "${INSTALL_DIR}/data/nginx/ssl/fullchain.pem" ]]; then
        step "Generating self-signed certificate (for testing)..."
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout "${INSTALL_DIR}/data/nginx/ssl/privkey.pem" \
            -out "${INSTALL_DIR}/data/nginx/ssl/fullchain.pem" \
            -subj "/CN=${DOMAIN}" 2>/dev/null
        info "Self-signed certificate generated"
    fi
else
    info "SSL certificate already exists"
fi

# ── Pull Docker Images ────────────────────────────────────────────────
header "Pulling Docker Images"

step "This may take a few minutes on first run..."
echo ""

# Pull all service images
docker compose -f "${INSTALL_DIR}/docker-compose.yml" pull --quiet 2>/dev/null ||
    docker compose -f "${INSTALL_DIR}/docker-compose.yml" pull

info "All Docker images pulled successfully"

# ── Start Services ────────────────────────────────────────────────────
header "Starting Services"

step "Starting DegenFeed and all services..."
docker compose -f "${INSTALL_DIR}/docker-compose.yml" up -d
info "All services started"

# ── Wait for Health ───────────────────────────────────────────────────
header "Checking Health"

echo "  Waiting for services to become healthy..."
echo ""

# Poll health endpoint
MAX_RETRIES=24 # 2 minutes total
for i in $(seq 1 "${MAX_RETRIES}"); do
    sleep 5

    # Check if all services are running
    HEALTHY=true
    for service in degenfeed ghost gotosocial redis; do
        status=$(docker compose -f "${INSTALL_DIR}/docker-compose.yml" ps --format json "${service}" 2>/dev/null | grep -c "running" || true)
        if [[ "${status}" -eq 0 ]]; then
            HEALTHY=false
            echo -e "  ${YELLOW}⏳${NC} ${service} — not ready yet"
            break
        fi
    done

    if [[ "${HEALTHY}" == "true" ]]; then
        echo ""
        info "All services are running!"
        break
    fi

    dots=""
    [[ $((i % 2)) -eq 0 ]] && dots="."
    [[ $((i % 3)) -eq 0 ]] && dots=".."
    [[ $((i % 4)) -eq 0 ]] && dots="..."
    echo -e "  ${CYAN}⏳${NC} Waiting... ${dots} ($((i * 5))s)"
done

# ── Final Status ───────────────────────────────────────────────────────
header "Deployment Complete"

# Print running containers
echo ""
docker compose -f "${INSTALL_DIR}/docker-compose.yml" ps
echo ""

echo -e "${GREEN}"
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║                                                         ║"
echo "  ║          DegenFeed Self-Hosted is LIVE! 🚀             ║"
echo "  ║                                                         ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo "  ┌─────────────────────────────────────────────────────────┐"
echo "  │                                                         │"
printf '  │  Your DegenFeed:    https://%s/  │\n' "${DOMAIN}"
printf '  │  Blog:              https://%s/articles      │\n' "${DOMAIN}"
printf '  │  Blog Admin:        https://%s/articles/ghost │\n' "${DOMAIN}"
printf '  │  Creator Coin:      https://%s/coin          │\n' "${DOMAIN}"
printf '  │  Live Streams:      https://%s/live          │\n' "${DOMAIN}"
printf '  │  ActivityPub:       @%s@%s  │\n' "${CREATOR_USERNAME}" "${DOMAIN}"
echo "  │                                                         │"
echo "  └─────────────────────────────────────────────────────────┘"
echo ""
echo "  ┌─────────────────────────────────────────────────────────┐"
echo "  │  Useful Commands                                        │"
echo "  ├─────────────────────────────────────────────────────────┤"
echo "  │  Logs:     docker compose -f ${INSTALL_DIR}/docker-compose.yml logs -f  │"
echo "  │  Stop:     docker compose -f ${INSTALL_DIR}/docker-compose.yml down     │"
echo "  │  Update:   docker compose -f ${INSTALL_DIR}/docker-compose.yml pull &&  │"
echo "  │            docker compose -f ${INSTALL_DIR}/docker-compose.yml up -d    │"
echo "  │  Backup:   cd ${INSTALL_DIR} && tar czf                           │"
echo "  │            degenfeed-backup-\$(date +%Y%m%d).tar.gz data/ .env articles/  │"
echo "  └─────────────────────────────────────────────────────────┘"
echo ""

# ── Post-Install Steps ────────────────────────────────────────────────
echo -e "${YELLOW}  👋 Next Steps:${NC}"
echo ""
echo "  1. DNS: Make sure your DNS A record points to this server's IP:"
echo "     ${DOMAIN}  A  <your-server-ip>"
echo ""
echo "  2. Blog Setup: Visit https://${DOMAIN}/articles/ghost"
echo "     to create your admin account and set up your blog."
echo ""
echo "  3. GetSocial Setup: Check GoToSocial admin credentials:"
echo "     docker compose -f ${INSTALL_DIR}/docker-compose.yml logs gotosocial | grep \"Created\""
echo ""
echo "  4. Connect Accounts: Go to Settings → Connected Accounts"
echo "     to link Nostr, Farcaster, Bluesky, etc."
echo ""
echo "  5. Creator Coin: Configure at https://${DOMAIN}/admin/coin"
echo ""
echo "  6. Security: Consider setting up Cloudflare Tunnel (see cloudflared-setup.sh)"
echo "     or configure a firewall: sudo ufw allow 22,80,443/tcp"
echo ""
echo "  7. Backups: Set up automated backups (see docs/SELF_HOSTING.md)"
echo ""
echo -e "${GREEN}  🎉 Your creator platform is live. Own it.${NC}"
echo ""

# ── Write install receipt ─────────────────────────────────────────────
cat >"${INSTALL_DIR}/.install-receipt" <<EOF
DegenFeed Self-Hosted v${VERSION}
Installed: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
Domain: ${DOMAIN}
Wallet: ${CREATOR_WALLET}
Username: ${CREATOR_USERNAME}
Image Tag: ${IMAGE_TAG}
EOF

info "Installation complete! 🚀"
