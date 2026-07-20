#!/bin/bash
# =============================================================================
# DegenFeed — Deploy ALL self-hosted infrastructure (single command)
# =============================================================================
# "The ONLY way to be truly deplatform-proof is to run your own infrastructure
#  for every protocol."
#
# This script deploys the complete DegenFeed infrastructure stack:
#   social.degenfeed.xyz   → GoToSocial (ActivityPub)
#   pds.degenfeed.xyz      → AT Protocol PDS (Bluesky)
#   relay.degenfeed.xyz    → Nostr Relay
#   video.degenfeed.xyz    → PeerTube (ActivityPub video)
#   matrix.degenfeed.xyz   → Synapse (Matrix)
#   articles.degenfeed.xyz → Ghost CMS (Blog)
#   live.degenfeed.xyz     → Owncast (Live streaming)
#   blog.degenfeed.xyz     → WriteFreely (ActivityPub blog)
#   events.degenfeed.xyz   → Mobilizon (ActivityPub events)
#
# Prerequisites:
#   - Docker + Docker Compose v2
#   - Domain with DNS A records pointed to this server
#   - .env file with required secrets (see .env.example)
#   - Ports 80/443 open
#
# Usage:
#   ./scripts/infra/deploy-all.sh              # Deploy everything
#   ./scripts/infra/deploy-all.sh --status      # Check deployment status
#   ./scripts/infra/deploy-all.sh --logs        # Tail all logs
#   ./scripts/infra/deploy-all.sh --stop        # Stop everything
#   ./scripts/infra/deploy-all.sh --update      # Pull latest images + restart
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.full.yml"
PROJECT_NAME="degenfeed-infra"

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ─── Helpers ─────────────────────────────────────────────────────────────────
info() { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }
header() {
    echo -e "\n${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $*${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
}

# ─── Pre-flight checks ───────────────────────────────────────────────────────
preflight() {
    header "Pre-flight Checks"

    # Check Docker
    if ! command -v docker &>/dev/null; then
        error "Docker is not installed. Install it first: https://docs.docker.com/engine/install/"
        exit 1
    fi
    ok "Docker: $(docker --version)"

    # Check Docker Compose
    if ! docker compose version &>/dev/null; then
        error "Docker Compose v2 is not installed."
        exit 1
    fi
    ok "Docker Compose: $(docker compose version)"

    # Check .env file
    ENV_FILE="${SCRIPT_DIR}/.env"
    if [ ! -f "${ENV_FILE}" ]; then
        warn "No .env file found at ${ENV_FILE}"
        warn "Creating from .env.example — EDIT IT with real values before deploying."
        if [ -f "${SCRIPT_DIR}/.env.example" ]; then
            cp "${SCRIPT_DIR}/.env.example" "${ENV_FILE}"
            echo "# DegenFeed Infrastructure — Generated $(date)" >>"${ENV_FILE}"
            echo "DOMAIN=degenfeed.xyz" >>"${ENV_FILE}"
            warn "!!! EDIT ${ENV_FILE} WITH REAL SECRETS BEFORE DEPLOYING !!!"
        fi
    fi

    # Check DOMAIN
    if grep -q "DOMAIN=" "${ENV_FILE}" 2>/dev/null; then
        DOMAIN=$(grep "^DOMAIN=" "${ENV_FILE}" | cut -d= -f2)
        if [ -n "${DOMAIN}" ]; then
            ok "Domain: ${DOMAIN}"
        else
            warn "DOMAIN is empty in .env"
        fi
    else
        warn "DOMAIN not set in .env — Caddy will fail without it"
    fi

    # Check compose file
    if [ ! -f "${COMPOSE_FILE}" ]; then
        error "Compose file not found: ${COMPOSE_FILE}"
        exit 1
    fi
    ok "Compose file: ${COMPOSE_FILE}"
}

# ─── Deploy ──────────────────────────────────────────────────────────────────
deploy() {
    header "Deploying DegenFeed Infrastructure Stack"
    echo -e "  ${CYAN}Services:${NC}"
    echo -e "  ${GREEN}✓${NC} GoToSocial    → social.\${DOMAIN}"
    echo -e "  ${GREEN}✓${NC} PDS           → pds.\${DOMAIN}"
    echo -e "  ${GREEN}✓${NC} Nostr Relay   → relay.\${DOMAIN}"
    echo -e "  ${GREEN}✓${NC} PeerTube      → video.\${DOMAIN}"
    echo -e "  ${GREEN}✓${NC} Synapse       → matrix.\${DOMAIN}"
    echo -e "  ${GREEN}✓${NC} Ghost         → articles.\${DOMAIN}"
    echo -e "  ${GREEN}✓${NC} Owncast       → live.\${DOMAIN}"
    echo -e "  ${GREEN}✓${NC} WriteFreely   → blog.\${DOMAIN}"
    echo -e "  ${GREEN}✓${NC} Mobilizon     → events.\${DOMAIN}"
    echo -e "  ${GREEN}✓${NC} PostgreSQL    → shared database"
    echo -e "  ${GREEN}✓${NC} Redis          → caching/queues"
    echo -e "  ${GREEN}✓${NC} MinIO         → S3 storage"
    echo -e "  ${GREEN}✓${NC} Prometheus    → metrics"
    echo -e "  ${GREEN}✓${NC} Grafana       → dashboards"
    echo ""

    docker compose \
        --project-name "${PROJECT_NAME}" \
        --env-file "${ENV_FILE}" \
        -f "${COMPOSE_FILE}" \
        up -d --remove-orphans

    echo ""
    ok "Deploy command issued. Waiting for services to start..."
    echo ""
}

# ─── Status ──────────────────────────────────────────────────────────────────
status() {
    header "Infrastructure Status"

    echo ""
    docker compose \
        --project-name "${PROJECT_NAME}" \
        -f "${COMPOSE_FILE}" \
        ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

    echo ""
    info "Health check URLs:"
    echo "  social.${DOMAIN:-<domain>}/api/v1/instance"
    echo "  pds.${DOMAIN:-<domain>}/xrpc/_health"
    echo "  relay.${DOMAIN:-<domain>}/"
    echo "  video.${DOMAIN:-<domain>}/api/v1/instance/health"
    echo "  matrix.${DOMAIN:-<domain>}/_matrix/health"
    echo "  articles.${DOMAIN:-<domain>}/ghost/api/admin/ping/"
    echo "  live.${DOMAIN:-<domain>}/api/health"
    echo "  blog.${DOMAIN:-<domain>}/"
    echo "  events.${DOMAIN:-<domain>}/api/health"
}

# ─── Logs ────────────────────────────────────────────────────────────────────
logs() {
    header "Infrastructure Logs (Ctrl+C to exit)"
    docker compose \
        --project-name "${PROJECT_NAME}" \
        -f "${COMPOSE_FILE}" \
        logs -f "$@"
}

# ─── Stop ────────────────────────────────────────────────────────────────────
stop() {
    header "Stopping Infrastructure"
    docker compose \
        --project-name "${PROJECT_NAME}" \
        -f "${COMPOSE_FILE}" \
        down
    ok "All services stopped."
}

# ─── Update ──────────────────────────────────────────────────────────────────
update() {
    header "Updating Infrastructure Images"
    docker compose \
        --project-name "${PROJECT_NAME}" \
        --env-file "${ENV_FILE}" \
        -f "${COMPOSE_FILE}" \
        pull

    echo ""
    info "Recreating services with updated images..."
    docker compose \
        --project-name "${PROJECT_NAME}" \
        --env-file "${ENV_FILE}" \
        -f "${COMPOSE_FILE}" \
        up -d --remove-orphans

    ok "Update complete."
}

# ─── Caddyfile generation ────────────────────────────────────────────────────
generate-caddyfile() {
    header "Generating Caddyfile for all subdomains"
    local DOMAIN
    DOMAIN=$(grep "^DOMAIN=" "${ENV_FILE}" 2>/dev/null | cut -d= -f2)
    DOMAIN="${DOMAIN:-degenfeed.xyz}"

    mkdir -p "${SCRIPT_DIR}/data/caddy"

    cat >"${SCRIPT_DIR}/data/caddy/Caddyfile" <<CADDYEOF
# DegenFeed — Deplatform-Proof Infrastructure Caddyfile
# Auto-generated by deploy-all.sh
# Domain: ${DOMAIN}
# Date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

{
  # Let's Encrypt email for certificate notifications
  email ${ACME_EMAIL:-admin@${DOMAIN}}
  # Use production CA by default
  acme_ca https://acme-v02.api.letsencrypt.org/directory
  # Enable HTTP/3
  servers {
    protocol {
      experimental_http3
    }
  }
}

# ── Global common security headers ──────────────────────────────────────
(security-headers) {
  header {
    X-Frame-Options "DENY"
    X-Content-Type-Options "nosniff"
    Referrer-Policy "strict-origin-when-cross-origin"
    Permissions-Policy "camera=(), microphone=(), geolocation=()"
    -Server
  }
}

# ── GoToSocial — social.${DOMAIN} ───────────────────────────────────────
social.${DOMAIN} {
  import security-headers

  # ActivityPub endpoints
  handle_path /.well-known/* {
    reverse_proxy gotosocial:8080
  }
  handle_path /api/* {
    reverse_proxy gotosocial:8080
  }
  handle_path /auth/* {
    reverse_proxy gotosocial:8080
  }
  handle_path /oauth/* {
    reverse_proxy gotosocial:8080
  }
  handle_path /users/* {
    reverse_proxy gotosocial:8080
  }
  handle_path /fileserver/* {
    reverse_proxy gotosocial:8080
  }
  handle {
    reverse_proxy gotosocial:8080
  }

  log {
    output file /data/access-social.log
  }
}

# ── AT Protocol PDS — pds.${DOMAIN} ─────────────────────────────────────
pds.${DOMAIN} {
  import security-headers

  handle {
    reverse_proxy pds:2583
  }

  log {
    output file /data/access-pds.log
  }
}

# ── Nostr Relay — relay.${DOMAIN} ───────────────────────────────────────
relay.${DOMAIN} {
  import security-headers

  handle {
    reverse_proxy nostr-relay:8080
  }

  log {
    output file /data/access-relay.log
  }
}

# ── PeerTube — video.${DOMAIN} ──────────────────────────────────────────
video.${DOMAIN} {
  import security-headers

  # Large upload support for PeerTube videos
  request_body {
    max_size 2GB
  }

  handle {
    reverse_proxy peertube:9000
  }

  log {
    output file /data/access-video.log
  }
}

# ── Matrix Synapse — matrix.${DOMAIN} ───────────────────────────────────
matrix.${DOMAIN} {
  import security-headers

  handle {
    reverse_proxy synapse:8008
  }

  log {
    output file /data/access-matrix.log
  }
}

# ── Ghost CMS — articles.${DOMAIN} ──────────────────────────────────────
articles.${DOMAIN} {
  import security-headers

  handle {
    reverse_proxy ghost:2368
  }

  log {
    output file /data/access-articles.log
  }
}

# ── Owncast — live.${DOMAIN} ────────────────────────────────────────────
live.${DOMAIN} {
  import security-headers

  handle {
    reverse_proxy owncast:8080
  }

  log {
    output file /data/access-live.log
  }
}

# ── WriteFreely — blog.${DOMAIN} ────────────────────────────────────────
blog.${DOMAIN} {
  import security-headers

  handle {
    reverse_proxy writefreely:8080
  }

  log {
    output file /data/access-blog.log
  }
}

# ── Mobilizon — events.${DOMAIN} ─────────────────────────────────────────
events.${DOMAIN} {
  import security-headers

  handle {
    reverse_proxy mobilizon:4000
  }

  log {
    output file /data/access-events.log
  }
}
CADDYEOF
    ok "Caddyfile generated at ${SCRIPT_DIR}/data/caddy/Caddyfile"
}

# ─── Main ────────────────────────────────────────────────────────────────────
main() {
    cd "${SCRIPT_DIR}"

    case "${1:-deploy}" in
    --status | -s)
        preflight
        status
        ;;
    --logs | -l)
        shift
        logs "$@"
        ;;
    --stop | -S)
        stop
        ;;
    --update | -u)
        preflight
        generate-caddyfile
        update
        status
        ;;
    --caddyfile | -c)
        generate-caddyfile
        ;;
    --help | -h)
        echo "Usage: $0 [OPTION]"
        echo ""
        echo "Deploy and manage DegenFeed's deplatform-proof infrastructure."
        echo ""
        echo "Options:"
        echo "  (none)        Deploy ALL services (default)"
        echo "  --status,-s   Show service status"
        echo "  --logs,-l     Tail logs from all services"
        echo "  --stop,-S     Stop all services"
        echo "  --update,-u   Pull latest images and restart"
        echo "  --caddyfile,-c  Regenerate Caddyfile"
        echo "  --help,-h     Show this help"
        ;;
    *)
        preflight
        generate-caddyfile
        deploy
        status
        echo ""
        ok "DegenFeed infrastructure is deploying in the background."
        echo ""
        info "Run '$0 --status' to check deployment progress."
        info "Run '$0 --logs' to watch startup logs."
        echo ""
        info "Once all services are healthy, configure DNS:"
        echo "  social.${DOMAIN:-<domain>}   → A record pointing to this server"
        echo "  pds.${DOMAIN:-<domain>}      → A record pointing to this server"
        echo "  relay.${DOMAIN:-<domain>}    → A record pointing to this server"
        echo "  video.${DOMAIN:-<domain>}    → A record pointing to this server"
        echo "  matrix.${DOMAIN:-<domain>}   → A record pointing to this server"
        echo "  articles.${DOMAIN:-<domain>} → A record pointing to this server"
        echo "  live.${DOMAIN:-<domain>}     → A record pointing to this server"
        echo "  blog.${DOMAIN:-<domain>}     → A record pointing to this server"
        echo "  events.${DOMAIN:-<domain>}   → A record pointing to this server"
        ;;
    esac
}

main "$@"
