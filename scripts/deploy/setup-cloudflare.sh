#!/usr/bin/env bash
#
# scripts/deploy/setup-cloudflare.sh
#
# First-time Cloudflare setup for DegenFeed. Operator must run this once
# after creating a Cloudflare account, adding the degenfeed.xyz zone,
# and uploading the Global API Key (or a scoped API token) to gopass.
#
# This script:
#   1. Validates that wrangler can authenticate.
#   2. Creates CACHE and SUBSCRIPTIONS KV namespaces (prod + preview IDs).
#   3. Generates AUTH_SECRET and pushes it as a wrangler secret on
#      production and preview environments.
#   4. Patches workers/api/wrangler.toml with the real KV namespace IDs.
#   5. Prints a summary the operator pastes into GitHub repo secrets.
#
# Requirements:
#   - wrangler 4.x installed on the host running this script.
#   - gopass entries (see the user guide in DEPLOYMENT.md):
#       CLOUDFLARE_ACCOUNT_ID_PATH  (32-hex account id)
#       CLOUDFLARE_API_KEY_PATH          (Global API Key)
#       — OR an API token (recommended) that we'll set as
#         CLOUDFLARE_API_TOKEN via environment.
#   - jq (for JSON parsing).
#
# Idempotent: safe to re-run. Existing secrets are not overwritten.
# Does NOT push to GitHub. Operator must set GH secrets manually.
#
# Usage:
#   ./scripts/deploy/setup-cloudflare.sh
# or with an explicit token:
#   CLOUDFLARE_API_TOKEN=cfat_xxxx ./scripts/deploy/setup-cloudflare.sh

set -euo pipefail

WORKER_DIR="$(cd "$(dirname "$0")/../../workers/api" && pwd)"
TOML="$WORKER_DIR/wrangler.toml"

red()   { printf "\033[31m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
blue()  { printf "\033[34m%s\033[0m\n" "$*"; }
bold()  { printf "\033[1m%s\033[0m\n" "$*"; }
hr()    { printf -- "----------------------------------------\n"; }

hr; bold "DegenFeed — Cloudflare first-time setup"; hr

# ── 1. Resolve auth ────────────────────────────────────────────────
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  if command -v gopass >/dev/null 2>&1; then
    if gopass show CLOUDFLARE_API_KEY_PATH >/dev/null 2>&1; then
      # Global API key. wrangler 4.x doesn't accept it via CLOUDFLARE_API_KEY
      # for token operations; only scoped tokens work. So we also ask the
      # operator to set CLOUDFLARE_API_TOKEN manually if they have one.
      if [[ -z "${CLOUDFLARE_API_KEY:-}" ]]; then
        # shellcheck disable=SC2155
        export CLOUDFLARE_API_KEY="$(gopass show -o CLOUDFLARE_API_KEY_PATH)"
      fi
    fi
  fi
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" && -z "${CLOUDFLARE_API_KEY:-}" ]]; then
  red "ERROR: no Cloudflare credentials found."
  red "Set one of:"
  red "  CLOUDFLARE_API_TOKEN=cfat_xxxxx ./scripts/deploy/setup-cloudflare.sh"
  red "  CLOUDFLARE_API_KEY=xxxxx ./scripts/deploy/setup-cloudflare.sh"
  red "  export CLOUDFLARE_API_KEY=\$(gopass show -o CLOUDFLARE_API_KEY_PATH)"
  exit 1
fi

# Resolve account id
if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  if command -v gopass >/dev/null 2>&1 && gopass show CLOUDFLARE_ACCOUNT_ID_PATH >/dev/null 2>&1; then
    # shellcheck disable=SC2155
    export CLOUDFLARE_ACCOUNT_ID="$(gopass show -o CLOUDFLARE_ACCOUNT_ID_PATH)"
  fi
fi
if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  red "ERROR: CLOUDFLARE_ACCOUNT_ID not set and gopass entry CLOUDFLARE_ACCOUNT_ID_PATH not found."
  exit 1
fi

# Validate auth
blue "[1/5] Validating Cloudflare auth..."
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
  red "ERROR: Cloudflare auth failed (HTTP $verify_status). Token is invalid or expired."
  red "Generate a fresh API token at:"
  red "  https://dash.cloudflare.com/profile/api-tokens"
  red "Required scope: Workers Scripts:Edit, Workers KV Storage:Edit, Account Settings:Read"
  exit 1
fi
green "  ✓ auth ok"

# ── 2. Create KV namespaces ─────────────────────────────────────────
blue "[2/5] Creating KV namespaces (CACHE, SUBSCRIPTIONS × prod/preview)..."

create_kv() {
  local binding="$1"
  local id_var="KV_ID_${binding}_PROD"
  local preview_id_var="KV_ID_${binding}_PREVIEW"

  if [[ -n "${!id_var:-}" ]]; then
    green "  ✓ $binding: using provided prod id ${!id_var}"
    eval "$id_var='${!id_var}'"
  else
    eval "$id_var=$(wrangler kv:namespace create "$binding" --config "$TOML" 2>/dev/null \
      | grep -oE 'id = "[^"]+"' | head -1 | sed -E 's/.*"([^"]+)"/\1/')"
    if [[ -z "${!id_var:-}" ]]; then
      red "  ✗ failed to create KV $binding (production)."
      red "    Check wrangler output above."
      exit 1
    fi
    green "  ✓ $binding prod: ${!id_var}"
  fi

  if [[ -n "${!preview_id_var:-}" ]]; then
    green "  ✓ $binding: using provided preview id ${!preview_id_var}"
  else
    eval "$preview_id_var=$(wrangler kv:namespace create "$binding" --preview --config "$TOML" 2>/dev/null \
      | grep -oE 'id = "[^"]+"' | head -1 | sed -E 's/.*"([^"]+)"/\1/')"
    if [[ -z "${!preview_id_var:-}" ]]; then
      red "  ✗ failed to create KV $binding (preview)."
      exit 1
    fi
    green "  ✓ $binding preview: ${!preview_id_var}"
  fi
}

create_kv CACHE
create_kv SUBSCRIPTIONS

# ── 3. Generate AUTH_SECRET and push to both environments ──────────
blue "[3/5] Generating AUTH_SECRET and setting it as a wrangler secret..."

if [[ -z "${AUTH_SECRET:-}" ]]; then
  AUTH_SECRET=$(openssl rand -hex 32)
  green "  ✓ generated fresh AUTH_SECRET (64 hex chars)"
fi

push_secret() {
  local env_flag="$1"
  if [[ -z "$env_flag" ]]; then
    wrangler secret put AUTH_SECRET --config "$TOML" <<< "$AUTH_SECRET" >/dev/null
  else
    wrangler secret put AUTH_SECRET --config "$TOML" "$env_flag" <<< "$AUTH_SECRET" >/dev/null
  fi
}

push_secret ""
push_secret "--env preview"
green "  ✓ AUTH_SECRET set on production and preview"

# ── 4. GTS_CLIENT_SECRET (only if operator provides it) ───────────
blue "[4/5] GTS_CLIENT_SECRET (skip if not set)..."
if [[ -n "${GTS_CLIENT_SECRET:-}" ]]; then
  wrangler secret put GTS_CLIENT_SECRET --config "$TOML" <<< "$GTS_CLIENT_SECRET" >/dev/null
  wrangler secret put GTS_CLIENT_SECRET --config "$TOML" --env preview <<< "$GTS_CLIENT_SECRET" >/dev/null
  green "  ✓ GTS_CLIENT_SECRET set on production and preview"
else
  yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
  yellow "  ! GTS_CLIENT_SECRET not provided. To set it later:"
  yellow "    CLOUDFLARE_API_TOKEN=... ./scripts/deploy/setup-cloudflare.sh"
  yellow "    GTS_CLIENT_SECRET=xxx wrangler secret put GTS_CLIENT_SECRET --config workers/api/wrangler.toml"
  yellow "    Get the secret from your GotoSocial admin: social.degenfeed.xyz/admin/oauth-apps"
fi

# ── 5. Patch wrangler.toml with real KV IDs ───────────────────────
blue "[5/5] Patching workers/api/wrangler.toml with real KV IDs..."

sed -i.bak \
  -e "s|^id = \"cache-namespace\"$|id = \"$KV_ID_CACHE_PROD\"|" \
  -e "s|^preview_id = \"cache-namespace-preview\"$|preview_id = \"$KV_ID_CACHE_PREVIEW\"|" \
  -e "s|^id = \"subs-namespace\"$|id = \"$KV_ID_SUBSCRIPTIONS_PROD\"|" \
  -e "s|^preview_id = \"subs-namespace-preview\"$|preview_id = \"$KV_ID_SUBSCRIPTIONS_PREVIEW\"|" \
  "$TOML"
rm -f "$TOML.bak"
green "  ✓ wrangler.toml updated"

# ── Summary ──────────────────────────────────────────────────────
hr; bold "Setup complete"; hr
green "Worker: degenfeed-api"
green "Account: $CLOUDFLARE_ACCOUNT_ID"
echo
blue "Next steps for the operator:"
echo "  1. Set GitHub repo secrets at"
echo "       https://github.com/RugMunchMedia/degenfeed/settings/secrets/actions"
echo "     Required secrets:"
echo "       CLOUDFLARE_API_TOKEN   = ${CLOUDFLARE_API_TOKEN:-<your token>}"
echo "       CLOUDFLARE_ACCOUNT_ID  = $CLOUDFLARE_ACCOUNT_ID"
echo
echo "  2. Run the dry-run to verify bindings:"
echo "       cd workers/api && wrangler deploy --dry-run"
echo
echo "  3. Deploy the preview environment:"
echo "       cd workers/api && wrangler deploy --env preview"
echo
echo "  4. Cut a release tag and push to main — CI will deploy production."
hr
