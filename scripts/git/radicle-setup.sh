#!/bin/bash
# radicle-setup — Configure Radicle decentralized git with cryptorugmuncher branding
# Run on the production server where the radicle-node runs.
# This sets up identity, avatar, and per-repo branding for all Rug Munch Media repos.

set -euo pipefail

RADICLE_HOME="${RADICLE_HOME:-$HOME/.radicle}"
AVATAR_URL="https://degenfeed.xyz/icon.svg"
DID="did:key:z6MkiWX1M83h5x3mWdzDNGeX4763SiHDaYKdZ6CPMxqprTmb"

red()   { echo -e "\033[31m$*\033[0m"; }
green() { echo -e "\033[32m$*\033[0m"; }
blue()  { echo -e "\033[34m$*\033[0m"; }

hr() { echo "────────────────────────────────────────"; }

# ─── Check prerequisites ────────────────────────────────────────────────
hr
blue "Radicle Branding Setup"
hr

if ! command -v rad &>/dev/null; then
  red "rad CLI not found. Install: curl -sSf https://radicle.xyz/install | sh"
  exit 1
fi

if ! systemctl is-active --quiet radicle-node 2>/dev/null; then
  red "radicle-node is not running."
  red "Start it: systemctl start radicle-node"
  exit 1
fi

echo "Radicle node: $(rad node status 2>/dev/null | head -1 || echo 'checking...')"
echo "DID: $DID"
echo ""

# ─── Auth identity ──────────────────────────────────────────────────────
hr
blue "Configuring Radicle identity"
hr

rad auth 2>/dev/null || {
  echo "No Radicle auth found."
  echo "Run: rad auth"
  echo "Then re-run this script."
  exit 1
}

# Update profile with crypto branding
rad self update \
  --name "cryptorugmunch" \
  --display-name "Rug Munch Media LLC" \
  --description "Building open-source crypto infrastructure. Products: DegenFeed, RMI Scanner, WalletPress, Pry Scraper." \
  --url "https://degenfeed.xyz" \
  --avatar "$AVATAR_URL" \
  2>/dev/null || echo "  (identity update skipped — may already be set)"

echo "Identity: $(rad self 2>/dev/null | head -3)"
echo ""

# ─── Per-repo branding ──────────────────────────────────────────────────
hr
blue "Configuring per-repo Radicle branding"
hr

declare -A REPOS=(
  ["rmi-backend"]="RMI Backend — FastAPI + SQLAlchemy + Celery + Redis. Telegram bot, scanner, databus."
  ["rmi-frontend"]="RMI Frontend — Nuxt 4 + Vue 3.5 + shadcn-vue + React 19 dual-stack. Dashboard, charts, alerts."
  ["pryscraper"]="Pry (MunchCrawl) — Multi-source crypto intelligence crawler. CLI + API + MCP server."
  ["walletpress"]="WalletPress — Python backend + WordPress plugin. Wallet engine, x402, chain vault."
  ["degenfeed-web"]="DegenFeed — Multi-protocol social aggregator. 10 protocols, one window. Next.js + CF Workers."
  ["fleet-infra"]="Fleet Infra — Infrastructure as code. Nginx, systemd, Docker Compose, scripts."
  ["fleet-template"]="Fleet Template — Scaffold for new Rug Munch Media repos. CI/CD, linting, Makefile."
  ["standards"]="Standards — AGENTS.md, CONVENTIONS.md, TOOLCHAIN.md. Engineering playbook."
  ["rmi-docs"]="RMI Docs — Comprehensive documentation for the RMI platform."
  ["rmi-local-services"]="RMI Local Services — Ghost + n8n + RugFeed Poster. Self-hosted tools."
  ["rugmunchbot"]="RugMunchBot — Telegram bot. /scan, /portfolio, /simulate, /chart, /watch."
  ["rugcharts"]="RugCharts — Crypto charting. TVL, volume, price feeds. (Archived)"
  ["rugmaps"]="RugMaps — Geo visualization for crypto data. (Archived)"
  ["x402-gateway"]="x402 Gateway — x402 payment protocol gateway. Digital content monetization."
  ["rmi-mcp-x402"]="RMI MCP x402 — MCP server for x402 payment verification."
  ["rmi-rag"]="RMI RAG — Retrieval-Augmented Generation for RMI knowledge base."
)

BASE_PATH="/srv/work/repos"

for repo in "${!REPOS[@]}"; do
  repo_path="$BASE_PATH/$repo"
  desc="${REPOS[$repo]}"
  
  if [ ! -d "$repo_path" ]; then
    echo "  ${repo}: SKIP (not found at $repo_path)"
    continue
  fi
  
  cd "$repo_path"
  
  # Check if radicle is initialized
  if [ ! -d ".radicle" ]; then
    echo "  ${repo}: SKIP (not a Radicle repo — run 'rad init')"
    continue
  fi
  
  # Update Radicle project metadata
  rad update \
    --name "$repo" \
    --description "$desc" \
    --default-branch main \
    2>/dev/null && echo "  ${repo}: OK" || echo "  ${repo}: SKIP (already configured or error)"
done

echo ""
green "Radicle branding complete."
echo ""
echo "Repos can be cloned via:"
echo "  rad clone rad:<rid>"
echo ""
echo "See gopass RADICLE_PATH for RIDs and keys."
echo "Sync schedule: weekly cron (Sun 06:00 UTC) via /etc/cron.d/radicle-sync on [HOST-2]."
