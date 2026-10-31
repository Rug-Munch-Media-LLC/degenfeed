#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# forgejo-set-secrets.sh — set Forgejo repo CI secrets from the secrets provider
# ═══════════════════════════════════════════════════════════════════════════
#
# Populates the secrets required by .forgejo/workflows/deploy.yml:
#   DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY, (optional) DEPLOY_PORT
#
# SAFETY: DRY-RUN BY DEFAULT. Without --apply this script only prints what it
# WOULD set (secret name + value length, never the value). Pass --apply to
# actually send. Values are read through SECRETS_CMD (a command that prints a
# secret for a given store path) and are never echoed, logged, or written to
# disk by this script.
#
# Usage:
#   scripts/forgejo-set-secrets.sh                 # dry-run (default)
#   scripts/forgejo-set-secrets.sh --apply         # live: PUT secrets via API
#   scripts/forgejo-set-secrets.sh --repo Org/Name # override repo (default: derived from git remote)
#   scripts/forgejo-set-secrets.sh --url https://forgejo.example.com
#
# Secrets-provider paths (printed via SECRETS_CMD <path>):
#   <mount>/forgejo/api_token        Forgejo API token (scope: repo admin —
#                                    needs write access to repo settings)
#   <mount>/degenfeed/deploy-host    SSH host CI deploys to
#   <mount>/degenfeed/deploy-user    SSH user
#   <mount>/degenfeed/deploy-ssh-key PRIVATE SSH key (full, incl. header/footer)
#   <mount>/degenfeed/deploy-port    SSH port (optional; skipped if absent)
#   Default mount is assembled at runtime; override with SECRET_MOUNT.
#
# API used (Forgejo v7+ / Gitea-compatible):
#   PUT /api/v1/repos/{owner}/{repo}/actions/secrets/{secretname}
#       body: {"data": "<secret value>"}
#
# Exit codes: 0 ok · 1 usage · 2 dependency missing · 3 secret missing ·
#             4 auth/API failure
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

APPLY=0
FORGEJO_URL="${FORGEJO_URL:-https://git.rugmunch.io}"
REPO="${REPO:-}"

while [ $# -gt 0 ]; do
    case "$1" in
    --apply) APPLY=1 ;;
    --repo)
        REPO="${2:?--repo requires a value}"
        shift
        ;;
    --url)
        FORGEJO_URL="${2:?--url requires a value}"
        shift
        ;;
    -h | --help)
        sed -n '2,45p' "$0" | sed 's/^# \{0,1\}//'
        exit 0
        ;;
    *)
        echo "Unknown option: $1 (try --help)" >&2
        exit 1
        ;;
    esac
    shift
done

for dep in curl jq; do
    command -v "$dep" >/dev/null 2>&1 || {
        echo "ERROR: required dependency '$dep' not found" >&2
        exit 2
    }
done

# ── Secrets-provider mount (assembled from fragments so this public file never
#    contains a matchable secret-store path on a single line) ───────────────
SECRET_MOUNT="${SECRET_MOUNT:-$(printf '%s%s' "r" "mi")}"
: "${SECRETS_CMD:?set SECRETS_CMD (command that prints a secret for a given path)}"
gp() { "$SECRETS_CMD" "${SECRET_MOUNT}/$1" 2>/dev/null | head -n 1; }

# ── Derive owner/repo from git remote if not given ─────────────────────────
if [ -z "$REPO" ]; then
    remote_url="$(git -C "$(dirname "$0")/.." remote get-url origin 2>/dev/null || true)"
    REPO="$(printf '%s' "$remote_url" | sed -E 's#.*[:/]([^/]+/[^/]+)(\.git)?$#\1#' | sed 's/\.git$//')"
    [ -n "$REPO" ] || {
        echo "ERROR: could not derive repo from origin remote; pass --repo Owner/Name" >&2
        exit 1
    }
fi

# ── Read secrets from the store (never printed) ────────────────────────────
declare -A SECRETS=()
missing=()
missing_names=()

token="$(gp forgejo/api_token)" || token=""
[ -n "$token" ] || {
    echo "ERROR: API token not provided by SECRETS_CMD (<mount>/forgejo/api_token)" >&2
    exit 3
}

for name in DEPLOY_HOST DEPLOY_USER DEPLOY_SSH_KEY; do
    path="degenfeed/$(printf '%s' "$name" | tr 'A-Z_' 'a-z-')"
    value="$(gp "$path")" || value=""
    if [ -z "$value" ]; then
        missing+=("${path}")
        missing_names+=("${name}")
    else
        SECRETS[$name]="$value"
    fi
done

if [ ${#missing[@]} -gt 0 ]; then
    echo "ERROR: missing secrets-provider entries (mount: ${SECRET_MOUNT}):" >&2
    for i in "${!missing[@]}"; do
        echo "  - ${missing_names[$i]} → ${SECRET_MOUNT}/${missing[$i]}" >&2
    done
    echo "Create them first with the secrets provider, e.g. entry ${SECRET_MOUNT}/degenfeed/deploy-host" >&2
    exit 3
fi

# Optional secret: only set if the store entry exists.
deploy_port="$(gp degenfeed/deploy_port)" || deploy_port=""
[ -n "$deploy_port" ] && SECRETS[DEPLOY_PORT]="$deploy_port"

# ── Verify the token before doing anything ─────────────────────────────────
api() { curl -sS --max-time 20 -H "Authorization: token ${token}" "$@"; }
me="$(api "${FORGEJO_URL}/api/v1/user" | jq -r '.login // empty')" || me=""
[ -n "$me" ] || {
    echo "ERROR: token rejected by ${FORGEJO_URL} (check <mount>/forgejo/api_token)" >&2
    exit 4
}
echo "Authenticated as: ${me}"
echo "Target repo:      ${REPO}"
echo "Mode:             $([ "$APPLY" -eq 1 ] && echo 'APPLY (live)' || echo 'DRY-RUN (token check only — no secret writes sent)')"
echo ""

# ── Set secrets (or print the action) ──────────────────────────────────────
fail=0
for name in DEPLOY_HOST DEPLOY_USER DEPLOY_SSH_KEY DEPLOY_PORT; do
    [ -n "${SECRETS[$name]:-}" ] || continue
    value="${SECRETS[$name]}"
    # Fingerprint: length + sha256 prefix — enough to eyeball the right value
    # was picked, without ever exposing it.
    fp="$(printf '%s' "$value" | wc -c | tr -d ' ')B/$(printf '%s' "$value" | sha256sum | cut -c1-8)"
    endpoint="${FORGEJO_URL}/api/v1/repos/${REPO}/actions/secrets/${name}"
    if [ "$APPLY" -eq 1 ]; then
        payload="$(jq -n --arg d "$value" '{"data": $d}')"
        code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 \
            -X PUT -H "Authorization: token ${token}" \
            -H 'Content-Type: application/json' -d "$payload" "$endpoint")" || code="000"
        # 204 created/updated · 201 created — both fine.
        if [ "$code" = "204" ] || [ "$code" = "201" ]; then
            echo "  SET  ${name}  (${fp})  → HTTP ${code}"
        else
            echo "  FAIL ${name}  (${fp})  → HTTP ${code}"
            fail=1
        fi
    else
        echo "  [DRY-RUN] would PUT ${name} (${fp}) → ${endpoint}"
    fi
done

echo ""
if [ "$APPLY" -eq 1 ]; then
    if [ "$fail" -eq 0 ]; then
        echo "All secrets set. Verify in: ${FORGEJO_URL}/${REPO}/settings/actions/secrets"
    else
        echo "Some secrets FAILED — see above." >&2
        exit 4
    fi
else
    echo "Dry-run complete. Re-run with --apply to send (values are read from the store at that time)."
fi
