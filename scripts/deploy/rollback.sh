#!/usr/bin/env bash
#
# scripts/deploy/rollback.sh
#
# Automated rollback for DegenFeed Cloudflare deployments.
# Rolls back both the Cloudflare Worker (degenfeed-api) and
# Cloudflare Pages (degenfeed-web) to their previous deployments,
# then runs a health check against the environment.
#
# Usage:
#   ./scripts/deploy/rollback.sh                          # production
#   ./scripts/deploy/rollback.sh --env preview             # preview env
#   ./scripts/deploy/rollback.sh --dry-run                 # preview only
#   ./scripts/deploy/rollback.sh --help                    # this message
#
# Requirements:
#   - wrangler 4.x installed
#   - CLOUDFLARE_API_TOKEN or CLOUDFLARE_API_KEY
#   - CLOUDFLARE_ACCOUNT_ID
#   - jq

set -euo pipefail

WORKER_DIR="$(cd "$(dirname "$0")/../../workers/api" && pwd)"
TOML="$WORKER_DIR/wrangler.toml"
PAGES_PROJECT="degenfeed-web"

DRY_RUN=false
ENV="production"

red()    { printf "\033[31m%s\033[0m\n" "$*"; }
green()  { printf "\033[32m%s\033[0m\n" "$*"; }
blue()   { printf "\033[34m%s\033[0m\n" "$*"; }
bold()   { printf "\033[1m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
hr()     { printf -- "----------------------------------------\n"; }

# ── arg parse ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --env) ENV="$2"; shift 2 ;;
    --help|-h)
      echo "Usage: $0 [--dry-run] [--env production|preview]"
      echo
      echo "Rolls back the degenfeed-api Worker and degenfeed-web Pages"
      echo "to their previous deployments, then runs a health check."
      echo
      echo "  --dry-run    Preview what would be rolled back without executing."
      echo "  --env        Environment to roll back (production | preview)."
      echo "               Default: production."
      exit 0
      ;;
    *) red "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ "$ENV" != "production" && "$ENV" != "preview" ]]; then
  red "ERROR: --env must be 'production' or 'preview' (got: $ENV)"
  exit 1
fi

hr; bold "DegenFeed — Rollback"; hr
blue "  Environment: $ENV"
$DRY_RUN && yellow "  DRY-RUN — no changes will be made"
echo

# ── 1. Resolve auth ────────────────────────────────────────────────────
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" && -z "${CLOUDFLARE_API_KEY:-}" ]]; then
  if command -v gopass >/dev/null 2>&1; then
    if gopass show rmi/cloudflare/api_key_global >/dev/null 2>&1; then
      export CLOUDFLARE_API_KEY="$(gopass show -o rmi/cloudflare/api_key_global)"
    fi
  fi
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" && -z "${CLOUDFLARE_API_KEY:-}" ]]; then
  red "ERROR: no Cloudflare credentials found."
  red "Set one of:"
  red "  CLOUDFLARE_API_TOKEN=cfat_xxxxx $0"
  red "  CLOUDFLARE_API_KEY=xxxxx $0"
  exit 1
fi

if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  if command -v gopass >/dev/null 2>&1 && gopass show rmi/cloudflare/cloudflare_account_id >/dev/null 2>&1; then
    export CLOUDFLARE_ACCOUNT_ID="$(gopass show -o rmi/cloudflare/cloudflare_account_id)"
  fi
fi

if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  red "ERROR: CLOUDFLARE_ACCOUNT_ID not set."
  exit 1
fi

# Validate auth
blue "[auth] Validating Cloudflare auth..."
if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  verify_status=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    "https://api.cloudflare.com/client/v4/user/tokens/verify")
else
  verify_status=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-Auth-Email: crmuncher@gmail.com" \
    -H "X-Auth-Key: $CLOUDFLARE_API_KEY" \
    "https://api.cloudflare.com/client/v4/user")
fi
if [[ "$verify_status" != "200" ]]; then
  red "ERROR: Cloudflare auth failed (HTTP $verify_status)."
  exit 1
fi
green "  ✓ auth ok"

# ── 2. Environment details ─────────────────────────────────────────────
if [[ "$ENV" == "preview" ]]; then
  HEALTH_URL="https://preview.degenfeed.xyz/api/health"
  WORKER_ENV_FLAG="--env preview"
  PAGES_BRANCH="preview"
else
  HEALTH_URL="https://degenfeed.xyz/api/health"
  WORKER_ENV_FLAG=""
  PAGES_BRANCH="main"
fi

curl_cmd() {
  if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
    curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "$@"
  else
    curl -s -H "X-Auth-Email: crmuncher@gmail.com" -H "X-Auth-Key: $CLOUDFLARE_API_KEY" "$@"
  fi
}

# ── 3. Worker rollback ─────────────────────────────────────────────────
echo
blue "[1/3] Worker rollback (degenfeed-api, $ENV)..."

if $DRY_RUN; then
  yellow "  would run: wrangler rollback $WORKER_ENV_FLAG"
  echo
  if command -v wrangler >/dev/null 2>&1; then
    yellow "  current versions:"
    wrangler versions list --config "$TOML" $WORKER_ENV_FLAG 2>/dev/null | head -8 || true
  fi
else
  if ! command -v wrangler >/dev/null 2>&1; then
    red "  ✗ wrangler not found. Install it with: npm install -g wrangler"
    exit 1
  fi
  wrangler rollback $WORKER_ENV_FLAG --config "$TOML"
  green "  ✓ worker rolled back"
fi

# ── 4. Pages rollback ──────────────────────────────────────────────────
echo
blue "[2/3] Pages rollback ($PAGES_PROJECT, $ENV)..."

deployments_json=$(curl_cmd \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PAGES_PROJECT/deployments?per_page=10")

api_ok=$(echo "$deployments_json" | jq -r '.success // false')
if [[ "$api_ok" != "true" ]]; then
  api_err=$(echo "$deployments_json" | jq -r '.errors[0].message // "unknown error"')
  yellow "  ! Pages API error: $api_err"
  yellow "  ! skipping Pages rollback"
else
  branch_filtered=$(echo "$deployments_json" | jq -r \
    "[.result[] | select(.deployment_trigger.metadata.branch == \"$PAGES_BRANCH\")] | .[0:5]")

  count=$(echo "$branch_filtered" | jq 'length')
  if [[ "$count" -lt 2 ]]; then
    yellow "  ! fewer than 2 deployments for branch '$PAGES_BRANCH' — nothing to rollback to"
  else
    current_id=$(echo "$branch_filtered" | jq -r '.[0].id')
    previous_id=$(echo "$branch_filtered" | jq -r '.[1].id')
    current_created=$(echo "$branch_filtered" | jq -r '.[0].created_on[:19]' | tr 'T' ' ')
    previous_created=$(echo "$branch_filtered" | jq -r '.[1].created_on[:19]' | tr 'T' ' ')

    echo
    blue "  Recent $PAGES_BRANCH deployments:"
    printf "  %-5s %-38s %-20s %s\n" "" "ID" "CREATED" "STATUS"
    for i in 0 1 2 3 4; do
      id=$(echo "$branch_filtered" | jq -r ".[$i].id // empty")
      [[ -z "$id" ]] && break
      created=$(echo "$branch_filtered" | jq -r ".[$i].created_on[:19]" | tr 'T' ' ')
      status=$(echo "$branch_filtered" | jq -r ".[$i].latest_stage.status // \"unknown\"")
      if [[ "$id" == "$current_id" ]]; then
        printf "  %-5s %-38s %-20s %s\n" "➜" "$id" "$created" "$status"
      elif [[ "$id" == "$previous_id" ]]; then
        printf "  %-5s %-38s %-20s %s\n" "←" "$id" "$created" "$status"
      else
        printf "  %-5s %-38s %-20s %s\n" "" "$id" "$created" "$status"
      fi
    done

    echo
    if $DRY_RUN; then
      yellow "  would rollback to: $previous_id (deployed $previous_created)"
    else
      blue "  rolling back to: $previous_id (deployed $previous_created)..."
      rollback_result=$(curl_cmd -X POST \
        "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PAGES_PROJECT/deployments/$previous_id/rollback")

      rollback_ok=$(echo "$rollback_result" | jq -r '.success // false')
      if [[ "$rollback_ok" == "true" ]]; then
        green "  ✓ Pages deployment rolled back to $previous_id"
      else
        rollback_err=$(echo "$rollback_result" | jq -r '.errors[0].message // "unknown error"')
        red "  ✗ Pages rollback failed: $rollback_err"
      fi
    fi
  fi
fi

# ── 5. Health check ────────────────────────────────────────────────────
echo
blue "[3/3] Health check — $HEALTH_URL..."

if $DRY_RUN; then
  yellow "  would curl: $HEALTH_URL (expecting HTTP 200)"
else
  sleep 5
  success=false
  for attempt in 1 2 3; do
    blue "  attempt $attempt/3..."
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_URL" 2>/dev/null || true)
    if [[ "$http_code" == "200" ]]; then
      green "  ✓ health check passed (HTTP $http_code)"
      success=true
      break
    fi
    if [[ "$attempt" -lt 3 ]]; then
      yellow "  health check returned HTTP $http_code, retrying in 5s..."
      sleep 5
    else
      yellow "  health check returned HTTP $http_code after 3 attempts"
    fi
  done

  if ! $success; then
    red "  ✗ health check failed — rollback may not have propagated yet"
    red "  URL: $HEALTH_URL"
    echo
    yellow "  Run the health check manually to verify:"
    yellow "    curl -I $HEALTH_URL"
    exit 1
  fi
fi

# ── Summary ────────────────────────────────────────────────────────────
echo
hr; bold "Rollback complete ($ENV)"; hr
$DRY_RUN && yellow "  DRY-RUN — no changes were made"
green "  Worker: degenfeed-api ($ENV)"
green "  Pages: degenfeed-web ($ENV)"
green "  Health: $HEALTH_URL"
echo
blue "If issues persist after rollback, investigate via:"
echo "  wrangler tail --config workers/api/wrangler.toml $WORKER_ENV_FLAG"
echo "  wrangler pages deployment list --project-name degenfeed-web"
hr
