#!/usr/bin/env bash
#
# scripts/metrics/dora-track.sh
#
# DORA Metrics Tracker — Deployment Frequency, Lead Time for Changes,
# Mean Time to Recovery, and Change Failure Rate.
#
# Supports both:
#   - Forgejo/Gitea Actions (via curl + Forgejo API, primary)
#   - GitHub Actions (via gh CLI, fallback)
#
# Authentication (checked in order):
#   FORGEJO_TOKEN — Forgejo personal access token
#   GITHUB_TOKEN  — GitHub/Gitea personal access token (fallback)
#
# For Forgejo, set FORGEJO_API_URL (default: https://git.rugmunch.io/api/v1)
# For GitHub, ensure `gh` is authenticated and available.
#
# Outputs a metrics JSON file to metrics/dora-YYYY-MM-DD.json and
# prints a markdown summary for use in $GITHUB_STEP_SUMMARY.
#
# Usage:
#   ./scripts/metrics/dora-track.sh                          # defaults
#   ./scripts/metrics/dora-track.sh --days 14                # custom window
#   ./scripts/metrics/dora-track.sh --output-dir tmp/metrics
#   ./scripts/metrics/dora-track.sh --workflow deploy.yml    # different workflow
#   ./scripts/metrics/dora-track.sh --repo owner/repo
#
# Requirements:
#   - jq
#   - bc
#   - GNU date
#   - curl
#   - gh 2.x (optional, fallback for GitHub-only environments)

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────
REPO="${GITHUB_REPOSITORY:-}"
WORKFLOW="${DORA_WORKFLOW:-deploy.yml}"
DAYS="${DORA_DAYS:-30}"
DATE_TAG=$(date -u +%Y-%m-%d)
OUTPUT_DIR="${DORA_OUTPUT_DIR:-metrics}"
OUTPUT_FILE="${OUTPUT_DIR}/dora-${DATE_TAG}.json"
NOW_EPOCH=$(date -u +%s)

# Forgejo API — falls back to GITHUB_TOKEN for GitHub API compatibility
FORGEJO_API_URL="${FORGEJO_API_URL:-https://git.rugmunch.io/api/v1}"
FORGEJO_TOKEN="${FORGEJO_TOKEN:-${GITHUB_TOKEN:-}}"

red()    { printf "\033[31m%s\033[0m\n" "$*"; }
green()  { printf "\033[32m%s\033[0m\n" "$*"; }
blue()   { printf "\033[34m%s\033[0m\n" "$*"; }
bold()   { printf "\033[1m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
hr()     { printf -- "----------------------------------------\n"; }

# ── Argument parse ─────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --days) DAYS="$2"; shift 2 ;;
    --output-dir) OUTPUT_DIR="$2"; shift 2 ;;
    --workflow) WORKFLOW="$2"; shift 2 ;;
    --repo) REPO="$2"; shift 2 ;;
    --help|-h)
      echo "Usage: $0 [--days N] [--output-dir DIR] [--workflow FILE] [--repo OWNER/REPO]"
      exit 0
      ;;
    *) red "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$REPO" ]]; then
  # Primary: infer from git remote (works for Forgejo, GitHub, Gitea)
  REMOTE_URL=$(git remote get-url origin 2>/dev/null || true)
  if [[ -n "$REMOTE_URL" ]]; then
    # SSH:   git@host:owner/repo.git
    # HTTPS: https://host/owner/repo.git
    REPO=$(echo "$REMOTE_URL" | sed -n 's#.*[:/]\([^/]*/[^/]*\)\.git#\1#p')
  fi

  # Fallback: gh CLI (GitHub-only environments)
  if [[ -z "$REPO" ]] && command -v gh &>/dev/null; then
    REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)
  fi

  if [[ -z "$REPO" ]]; then
    red "ERROR: Set GITHUB_REPOSITORY, FORGEJO_REPOSITORY, or pass --repo OWNER/REPO"
    exit 1
  fi
fi

mkdir -p "$OUTPUT_DIR"

# ── Helper functions ───────────────────────────────────────────────────────

days_ago() {
  date -u -d "@$(( NOW_EPOCH - $1 * 86400 ))" +%Y-%m-%dT%H:%M:%SZ
}

secs_to_human() {
  local s=$1 d h m out=""
  d=$(( s / 86400 ))
  h=$(( (s % 86400) / 3600 ))
  m=$(( (s % 3600) / 60 ))
  [[ $d -gt 0 ]] && out+="${d}d "
  [[ $h -gt 0 ]] && out+="${h}h "
  out+="${m}m"
  [[ -z "$out" ]] && echo "0m" || echo "$out"
}

fmt_float() {
  printf "%.${2:-2}f" "$1"
}

# ── forgejo_api_get: curl wrapper for Forgejo/Gitea API ───────────────────
# Falls back to gh CLI if no token is available.
forgejo_api_get() {
  local path="$1"

  if [[ -n "$FORGEJO_TOKEN" ]]; then
    curl -s -H "Authorization: token ${FORGEJO_TOKEN}" "${FORGEJO_API_URL}${path}"
  elif command -v gh &>/dev/null; then
    gh api "$path" 2>/dev/null || echo "{}"
  else
    echo "{}"
  fi
}

# ── API: Fetch workflow runs (paginated) ──────────────────────────────────
fetch_runs() {
  local since="$1" conclusion="$2"
  local filter
  local page=1
  local result="[]"

  # Build jq filter — include date guard as fallback if server doesn't filter
  if [[ "$conclusion" == "all" ]]; then
    filter=".created_at >= \"${since}\" and .head_branch == \"main\" and .event == \"push\""
  else
    filter=".created_at >= \"${since}\" and .conclusion == \"${conclusion}\" and .head_branch == \"main\" and .event == \"push\""
  fi

  while true; do
    local url_path="/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?page=${page}&limit=100"
    # URL-encode >= as %3E%3D to pass server-side date filter
    local response
    response=$(forgejo_api_get "${url_path}&created=%3E%3D${since}") || response='{"workflow_runs":[]}'

    local page_runs
    page_runs=$(echo "$response" | jq "[.workflow_runs[] | select(${filter}) | {id, run_number, created_at, updated_at, conclusion, html_url, head_commit: {id: .head_commit.id, message: .head_commit.message, timestamp: .head_commit.timestamp}}]" 2>/dev/null || echo "[]")

    # Merge page into accumulated result
    result=$(echo "$result" "$page_runs" | jq -s 'add' 2>/dev/null || echo "$result")

    local count
    count=$(echo "$page_runs" | jq 'length' 2>/dev/null || echo "0")
    if [[ "$count" -lt 100 ]]; then
      break
    fi
    page=$((page + 1))
  done

  echo "$result"
}

# ── Main ──────────────────────────────────────────────────────────────────
hr; bold "DORA Metrics Tracker — ${DATE_TAG}"; hr
blue "  Repo: ${REPO}"
blue "  Workflow: ${WORKFLOW}"
blue "  Window: ${DAYS}d"
echo

# ── 1. Deployment Frequency ────────────────────────────────────────────────
blue "[1/4] Deployment Frequency..."

runs_7d=$(fetch_runs "$(days_ago 7)" "success")
runs_30d=$(fetch_runs "$(days_ago 30)" "success")
fails_30d=$(fetch_runs "$(days_ago 30)" "failure")

count_7d=$(echo "$runs_7d" | jq 'length // 0' 2>/dev/null || echo "0")
count_30d=$(echo "$runs_30d" | jq 'length // 0' 2>/dev/null || echo "0")
fail_count_30d=$(echo "$fails_30d" | jq 'length // 0' 2>/dev/null || echo "0")
total_30d=$(( count_30d + fail_count_30d ))

deploys_per_day=$(echo "scale=4; $count_30d / 30" | bc 2>/dev/null || echo "0")
deploys_per_week=$(echo "scale=2; $count_30d / 4.2857" | bc 2>/dev/null || echo "0")

deploy_freq_rating="Low"
if (( $(echo "$deploys_per_day >= 1" | bc -l) )); then
  deploy_freq_rating="Elite"
elif (( $(echo "$deploys_per_week >= 1" | bc -l) )); then
  deploy_freq_rating="High"
elif (( $(echo "$deploys_per_week >= 0.25" | bc -l) )); then
  deploy_freq_rating="Medium"
fi

green "  Deploys: ${count_30d} (30d) | ${count_7d} (7d)"
green "  Rate: $(fmt_float "$deploys_per_day")/day → ${deploy_freq_rating}"
echo

# ── 2. Lead Time for Changes ──────────────────────────────────────────────
blue "[2/4] Lead Time for Changes..."

total_lead_secs=0
lead_count=0
lead_times=()

while IFS=$'\t' read -r created_at commit_ts commit_msg; do
  [[ -z "$created_at" || -z "$commit_ts" ]] && continue
  created_e=$(date -u -d "$created_at" +%s 2>/dev/null || echo "0")
  commit_e=$(date -u -d "$commit_ts" +%s 2>/dev/null || echo "0")
  [[ "$created_e" -eq 0 || "$commit_e" -eq 0 ]] && continue
  lead=$(( created_e - commit_e ))
  [[ $lead -lt 0 ]] && lead=0
  total_lead_secs=$(( total_lead_secs + lead ))
  lead_count=$(( lead_count + 1 ))
  lead_times+=("$lead")
done < <(echo "$runs_30d" | jq -r '.[] | [.created_at, .head_commit.timestamp, .head_commit.message] | @tsv' 2>/dev/null || true)

avg_lead=0
if [[ $lead_count -gt 0 ]]; then
  avg_lead=$(( total_lead_secs / lead_count ))
fi

avg_lead_human=$(secs_to_human "$avg_lead")
avg_lead_hours=$(echo "scale=2; $avg_lead / 3600" | bc 2>/dev/null || echo "0")

lead_rating="N/A"
if [[ $lead_count -gt 0 ]]; then
  lead_rating="Low"
  if (( $(echo "$avg_lead_hours < 1" | bc -l) )); then
    lead_rating="Elite"
  elif (( $(echo "$avg_lead_hours < 24" | bc -l) )); then
    lead_rating="High"
  elif (( $(echo "$avg_lead_hours < 168" | bc -l) )); then
    lead_rating="Medium"
  fi
fi

green "  Avg: ${avg_lead_human} → ${lead_rating} (${lead_count} samples)"
echo

# ── 3. MTTR (Mean Time to Recovery) ───────────────────────────────────────
blue "[3/4] Mean Time to Recovery..."

all_runs=$(fetch_runs "$(days_ago 30)" "all")

recovery_times=()
prev_fail_epoch=0
recovery_count=0

while IFS=$'\t' read -r created_at conclusion; do
  [[ -z "$created_at" ]] && continue
  created_e=$(date -u -d "$created_at" +%s 2>/dev/null || echo "0")
  [[ "$created_e" -eq 0 ]] && continue
  if [[ "$conclusion" == "failure" ]]; then
    prev_fail_epoch=$created_e
  elif [[ "$conclusion" == "success" && $prev_fail_epoch -gt 0 ]]; then
    recovery=$(( created_e - prev_fail_epoch ))
    recovery_times+=("$recovery")
    recovery_count=$(( recovery_count + 1 ))
    prev_fail_epoch=0
  fi
done < <(echo "$all_runs" | jq -r 'sort_by(.created_at)[] | [.created_at, .conclusion] | @tsv' 2>/dev/null || true)

# Detect rollback/hotfix commits as additional failure signals
rollback_msg_count=0
if echo "$runs_30d" | jq -r '.[].head_commit.message' 2>/dev/null | grep -ciE '^(Revert|rollback|hotfix)' >/dev/null 2>&1; then
  rollback_msg_count=$(echo "$runs_30d" | jq -r '.[].head_commit.message' 2>/dev/null | grep -ciE '^(Revert|rollback|hotfix)' || true)
fi

FAILURES_FOR_CFR=$(( fail_count_30d + rollback_msg_count ))

avg_mttr=0
if [[ $recovery_count -gt 0 ]]; then
  total_recovery=0
  for r in "${recovery_times[@]}"; do
    total_recovery=$(( total_recovery + r ))
  done
  avg_mttr=$(( total_recovery / recovery_count ))
fi

mttr_human=$(secs_to_human "$avg_mttr")
mttr_hours=$(echo "scale=2; $avg_mttr / 3600" | bc 2>/dev/null || echo "0")

mttr_rating="Elite"
if [[ $avg_mttr -gt 0 ]]; then
  mttr_rating="Low"
  if (( $(echo "$mttr_hours < 1" | bc -l) )); then
    mttr_rating="Elite"
  elif (( $(echo "$mttr_hours < 24" | bc -l) )); then
    mttr_rating="High"
  elif (( $(echo "$mttr_hours < 168" | bc -l) )); then
    mttr_rating="Medium"
  fi
fi

green "  Avg: ${mttr_human} → ${mttr_rating} (${recovery_count} recoveries)"
green "  Rollback/hotfix commits: ${rollback_msg_count}"
echo

# ── 4. Change Failure Rate ────────────────────────────────────────────────
blue "[4/4] Change Failure Rate..."

cfr=0
if [[ $total_30d -gt 0 ]]; then
  cfr=$(echo "scale=2; $FAILURES_FOR_CFR * 100 / $total_30d" | bc 2>/dev/null || echo "0")
fi

cfr_rating="Elite"
if (( $(echo "$cfr > 5" | bc -l) )); then
  cfr_rating="High"
fi
if (( $(echo "$cfr > 10" | bc -l) )); then
  cfr_rating="Medium"
fi
if (( $(echo "$cfr > 15" | bc -l) )); then
  cfr_rating="Low"
fi

green "  CFR: $(fmt_float "$cfr")% (${FAILURES_FOR_CFR} failures / ${total_30d} total) → ${cfr_rating}"
echo

# ── Build output JSON ─────────────────────────────────────────────────────
hr

metrics_json=$(cat <<JSON
{
  "date": "${DATE_TAG}",
  "repo": "${REPO}",
  "workflow": "${WORKFLOW}",
  "window_days": ${DAYS},
  "metrics": {
    "deployment_frequency": {
      "value": "$(fmt_float "$deploys_per_day")/day",
      "count_7d": ${count_7d},
      "count_30d": ${count_30d},
      "rating": "${deploy_freq_rating}"
    },
    "lead_time_for_changes": {
      "value": "${avg_lead_human}",
      "avg_seconds": ${avg_lead},
      "samples": ${lead_count},
      "rating": "${lead_rating}"
    },
    "mean_time_to_recovery": {
      "value": "${mttr_human}",
      "avg_seconds": ${avg_mttr},
      "recoveries": ${recovery_count},
      "rating": "${mttr_rating}"
    },
    "change_failure_rate": {
      "value": "$(fmt_float "$cfr")%",
      "percent": $(fmt_float "$cfr"),
      "failures": ${FAILURES_FOR_CFR},
      "total_deploys": ${total_30d},
      "rating": "${cfr_rating}"
    }
  }
}
JSON
)

echo "$metrics_json" > "$OUTPUT_FILE"
green "Wrote metrics to ${OUTPUT_FILE}"

# ── Markdown summary (for $GITHUB_STEP_SUMMARY) ───────────────────────────
cat <<MD

## DORA Metrics — ${DATE_TAG}

| Metric | Value | Target | Rating |
|--------|-------|--------|--------|
| Deployment Frequency | $(fmt_float "$deploys_per_day")/day | Daily | ${deploy_freq_rating} |
| Lead Time for Changes | ${avg_lead_human} | <1h | ${lead_rating} |
| Mean Time to Recovery | ${mttr_human} | <1h | ${mttr_rating} |
| Change Failure Rate | $(fmt_float "$cfr")% | <5% | ${cfr_rating} |

_Last updated: ${DATE_TAG} | Window: ${DAYS}d | Repo: ${REPO}_
MD
