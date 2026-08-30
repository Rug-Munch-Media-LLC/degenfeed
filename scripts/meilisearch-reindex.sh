#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# meilisearch-reindex.sh — DegenFeed unified-feed search reindex (idempotent)
# ═══════════════════════════════════════════════════════════════════════════
#
# The unified feed depends on MeiliSearch (index `posts`, maintained by the
# bridge's search-indexer). This script triggers a FULL reindex through the
# bridge's own management endpoint — it never talks to MeiliSearch's write
# API directly, so index settings/primaryKey handling stays in one place
# (bridge/src/search-indexer.ts).
#
# What "reindex" does on the bridge side (POST /api/search/indexer/reindex):
#   1. deleteAllDocuments() on the `posts` index
#   2. fetch every protocol's content via the bridge providers
#   3. re-add all documents + re-apply settings
# Running it repeatedly is safe: the result converges to the same index.
#
# Modes:
#   (no args)      Full reindex (default)
#   --status       Print bridge indexer status only (no mutation)
#   --check-only   Health checks only (Meili + bridge reachable); no mutation
#   --help         This text
#
# Environment:
#   MEILI_URL        MeiliSearch base URL      (default: http://127.0.0.1:7700)
#                    Fallback: MEILISEARCH_URL (the bridge's own var name)
#   MEILI_KEY        MeiliSearch API key       (optional; only used for the
#                    post-reindex index-stats verification)
#                    Fallback: MEILI_MASTER_KEY (the bridge's own var name)
#   BRIDGE_URL       Bridge base URL           (default: http://127.0.0.1:8787)
#   BRIDGE_API_KEY   Bridge bearer token       (REQUIRED for reindex/status —
#                    the bridge rejects every non-health route without it)
#   LOCK_FILE        Lockfile path             (default: /tmp/degenfeed-meili-reindex.lock)
#   HEALTH_TIMEOUT   Per-request timeout, s    (default: 15)
#   REINDEX_TIMEOUT  Reindex request timeout,s (default: 1800 — a full crawl
#                                              of all providers can take minutes)
#
# Scheduling (systemd timer preferred — see deploy/systemd/):
#   install -m 755 scripts/meilisearch-reindex.sh /usr/local/bin/
#   cp deploy/systemd/degenfeed-meili-reindex.{service,timer} /etc/systemd/system/
#   systemctl daemon-reload && systemctl enable --now degenfeed-meili-reindex.timer
#
# Exit codes: 0 ok/skip-locked · 1 usage · 2 dependency missing ·
#             3 Meili unreachable · 4 bridge unreachable · 5 reindex failed
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

MODE="reindex"
case "${1:-}" in
"") ;;
--status) MODE="status" ;;
--check-only) MODE="check" ;;
-h | --help)
    sed -n '2,50p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
*)
    echo "Unknown option: $1 (try --help)" >&2
    exit 1
    ;;
esac

for dep in curl jq flock; do
    command -v "$dep" >/dev/null 2>&1 || {
        echo "ERROR: required dependency '$dep' not found" >&2
        exit 2
    }
done

# ── Configuration (bridge-compatible env fallbacks) ────────────────────────
MEILI_URL="${MEILI_URL:-${MEILISEARCH_URL:-http://127.0.0.1:7700}}"
MEILI_KEY="${MEILI_KEY:-${MEILI_MASTER_KEY:-}}"
BRIDGE_URL="${BRIDGE_URL:-http://127.0.0.1:8787}"
LOCK_FILE="${LOCK_FILE:-/tmp/degenfeed-meili-reindex.lock}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-15}"
REINDEX_TIMEOUT="${REINDEX_TIMEOUT:-1800}"

log() { printf '[meili-reindex] %s\n' "$*"; }
die() {
    printf '[meili-reindex] ERROR: %s\n' "$*" >&2
    exit 1
}

# ── Lockfile: never let two reindexes overlap (timer + manual run) ─────────
# flock on a fd keeps this POSIX-safe; a second invocation exits 0 so a cron
# overlap is a no-op, not a failure.
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
    log "Another reindex is already running (lock: $LOCK_FILE) — skipping."
    exit 0
fi
printf '%s %s\n' "$$" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >&9

# ── Health checks ──────────────────────────────────────────────────────────
check_meili() {
    log "Checking MeiliSearch at ${MEILI_URL} ..."
    local body
    body="$(curl -sSf --max-time "$HEALTH_TIMEOUT" "${MEILI_URL}/health" 2>/dev/null)" || return 3
    echo "$body" | jq -e '.status == "available"' >/dev/null || return 3
    log "MeiliSearch: available"
    return 0
}

check_bridge() {
    log "Checking bridge at ${BRIDGE_URL} ..."
    # /api/health is the one route family the bridge serves without auth.
    curl -sSf --max-time "$HEALTH_TIMEOUT" "${BRIDGE_URL}/api/health" >/dev/null 2>&1 || return 4
    log "Bridge: reachable"
    return 0
}

# Meili reachability is FATAL for reindex/check modes (a reindex into a dead
# Meili is impossible) but only a WARNING for --status (the bridge reports
# indexer state regardless of Meili's current health).
if ! check_meili; then
    if [ "$MODE" = "status" ]; then
        log "WARN: MeiliSearch unreachable at ${MEILI_URL} — continuing (status mode)."
    else
        printf '[meili-reindex] ERROR: MeiliSearch unreachable or unhealthy at %s\n' "$MEILI_URL" >&2
        exit 3
    fi
fi
check_bridge || die "Bridge unreachable at ${BRIDGE_URL} (exit 4)"

if [ "$MODE" = "check" ]; then
    log "Check-only mode: all healthy, no mutation performed."
    exit 0
fi

[ -n "${BRIDGE_API_KEY}" ] || die "BRIDGE_API_KEY is required for ${MODE} mode (the bridge requires a bearer token on all non-health routes)"

auth_header="Authorization: Bearer ${BRIDGE_API_KEY}"

if [ "$MODE" = "status" ]; then
    curl -sSf --max-time "$HEALTH_TIMEOUT" -H "$auth_header" \
        "${BRIDGE_URL}/api/search/indexer/status" | jq .
    exit 0
fi

# ── Full reindex via the bridge (the only writer of the index) ─────────────
log "Triggering full reindex via POST ${BRIDGE_URL}/api/search/indexer/reindex (timeout ${REINDEX_TIMEOUT}s) ..."
result="$(curl -sSf --max-time "$REINDEX_TIMEOUT" -X POST -H "$auth_header" \
    "${BRIDGE_URL}/api/search/indexer/reindex" 2>/dev/null)" ||
    die "Reindex request failed (bridge error or timeout after ${REINDEX_TIMEOUT}s) (exit 5)"

echo "$result" | jq .
count="$(echo "$result" | jq -r '.count // empty')"
errors="$(echo "$result" | jq -r '.errors // empty')"
[ -n "$count" ] || die "Bridge returned an unexpected reindex payload (exit 5)"
log "Reindex complete: ${count} document(s), ${errors:-0} error(s)."

# ── Post-reindex verification (needs MEILI_KEY; skip silently otherwise) ───
if [ -n "$MEILI_KEY" ]; then
    stats="$(curl -sSf --max-time "$HEALTH_TIMEOUT" -H "Authorization: Bearer ${MEILI_KEY}" \
        "${MEILI_URL}/indexes/posts/stats" 2>/dev/null)" ||
        log "WARN: could not fetch index stats for verification (non-fatal)"
    if [ -n "${stats:-}" ]; then
        docs="$(echo "$stats" | jq -r '.numberOfDocuments // empty')"
        log "Verification: index 'posts' now holds ${docs:-?} document(s)."
    fi
else
    log "MEILI_KEY not set — skipping index-stats verification."
fi

log "Done."
