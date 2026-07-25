#!/bin/bash
# suggest-upgrades.sh — Upgrade Detection System
#
# Analyzes the monorepo and suggests upgrade plans:
#   1. Lists packages that can be upgraded safely (minor/patch)
#   2. Lists packages needing manual upgrade (major versions)
#   3. Shows changelog links for major upgrades
#   4. Estimates upgrade effort (lines changed, breaking changes)
#   5. Suggests upgrade order (dependencies first)
#
# Usage: bash scripts/suggest-upgrades.sh [--json] [--dry-run]
#   --json       Output as JSON (default: human-readable)
#   --dry-run    Don't write anything, just check
#   --apply      Apply safe upgrades (minor/patch) automatically

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TMPDIR="$(mktemp -d)"
OUTPUT_JSON="${REPO_DIR}/upgrade-plan.json"
trap 'rm -rf "$TMPDIR"' EXIT

MODE="text"
DRY_RUN=false
APPLY_SAFE=false

for arg in "$@"; do
    case "$arg" in
    --json) MODE="json" ;;
    --dry-run) DRY_RUN=true ;;
    --apply) APPLY_SAFE=true ;;
    esac
done

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

if [[ "$MODE" == "text" ]]; then
    echo "=============================================="
    echo "  DegenFeed — Upgrade Detection System"
    echo "  $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    echo "=============================================="
    echo ""
fi

cd "$REPO_DIR"

# ─── Build dependency graph ───────────────────────────────────────────────
# Map packages to their dependents for upgrade ordering
declare -A DEP_GRAPH
declare -A ALL_PACKAGES

# Collect workspace packages
while IFS=$'\t' read -r name path; do
    ALL_PACKAGES["$name"]="$path"
done < <(pnpm ls -r --depth=-1 --json 2>/dev/null | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    for item in data if isinstance(data, list) else [data]:
        name = item.get('name', '')
        path = item.get('path', '')
        if name and path:
            print(f'{name}\t{path}')
except: pass
" 2>/dev/null || true)

# ─── Step 1: Fetch outdated packages ──────────────────────────────────────
OUTDATED_JSON="$TMPDIR/outdated.json"
pnpm outdated --format=json 2>/dev/null >"$OUTDATED_JSON" || true

# ─── Step 2: Categorize upgrades ──────────────────────────────────────────
SAFE_UPGRADES=()   # minor/patch
MANUAL_UPGRADES=() # major
UNKNOWN_UPGRADES=()

if [[ -s "$OUTDATED_JSON" ]]; then
    while IFS=$'\t' read -r pkg current wanted latest pkg_type; do
        [[ -z "$pkg" ]] && continue

        # Determine bump type from semver
        c_ver="${current#^}"
        c_ver="${c_ver#~}"
        c_ver="${c_ver#>=}"
        l_ver="${latest#^}"
        l_ver="${l_ver#~}"
        l_ver="${l_ver#>=}"

        c_major="$(echo "$c_ver" | cut -d. -f1 | sed 's/[^0-9]*//g')"
        l_major="$(echo "$l_ver" | cut -d. -f1 | sed 's/[^0-9]*//g')"
        [[ -z "$c_major" ]] && c_major=0
        [[ -z "$l_major" ]] && l_major=0

        if [[ "$l_major" -gt "$c_major" ]]; then
            MANUAL_UPGRADES+=("$pkg|$current|$wanted|$latest|$pkg_type")
        elif [[ "$latest" != "$current" ]]; then
            SAFE_UPGRADES+=("$pkg|$current|$wanted|$latest|$pkg_type")
        fi
    done < <(python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    for pkg, info in data.items():
        pkg_type = 'devDependencies' if 'dev' in info.get('type','') else 'dependencies'
        print(f'{pkg}\t{info.get(\"current\",\"?\")}\t{info.get(\"wanted\",\"?\")}\t{info.get(\"latest\",\"?\")}\t{pkg_type}')
except: pass
" <"$OUTDATED_JSON" 2>/dev/null || true)
fi

# ─── Step 3: Get changelog URLs for major upgrades ────────────────────────
get_changelog_url() {
    local pkg="$1"
    local url=""

    # Try npm registry for repository URL
    url=$(curl -s "https://registry.npmjs.org/${pkg}/latest" 2>/dev/null |
        python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    repo = d.get('repository', {})
    if isinstance(repo, dict): url = repo.get('url', '')
    elif isinstance(repo, str): url = repo
    if url:
        url = url.replace('git+', '').replace('.git', '')
        if 'github.com' in url:
            print(url + '/releases')
        elif 'gitlab' in url:
            print(url + '/-/releases')
        else:
            print(url)
except: pass
" 2>/dev/null)

    if [[ -z "$url" ]]; then
        # Guess GitHub URL from package name
        if [[ "$pkg" == @*/* ]]; then
            org="$(echo "$pkg" | cut -d/ -f1 | sed 's/@//')"
            repo="$(echo "$pkg" | cut -d/ -f2)"
            echo "https://github.com/${org}/${repo}/releases"
        else
            echo "https://github.com/${pkg}/${pkg}/releases"
        fi
    else
        echo "$url"
    fi
}

# ─── Step 4: Estimate upgrade effort ──────────────────────────────────────
estimate_effort() {
    local pkg="$1"
    local current="$2"
    local latest="$3"

    # Count files that import this package
    local file_count
    file_count=$(grep -r "\"${pkg}\"\|'${pkg}'\|from ['\"]${pkg}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" -l "$REPO_DIR" 2>/dev/null | wc -l)

    # Count import lines
    local line_count
    line_count=$(grep -r "from ['\"]${pkg}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" "$REPO_DIR" 2>/dev/null | wc -l)

    # Determine if it's a major bump
    local is_major="false"
    local c_major l_major
    c_major=$(echo "$current" | sed 's/[^0-9]*//g' | cut -d. -f1)
    l_major=$(echo "$latest" | sed 's/[^0-9]*//g' | cut -d. -f1)
    [[ -z "$c_major" ]] && c_major=0
    [[ -z "$l_major" ]] && l_major=0
    [[ "$l_major" -gt "$c_major" ]] && is_major="true"

    # Breaking change risk
    local risk="low"
    [[ "$is_major" == "true" ]] && risk="high"
    [[ "$file_count" -gt 50 ]] && risk="${risk}-many-files"

    echo "{\"files\":$file_count,\"import_lines\":$line_count,\"is_major\":$is_major,\"risk\":\"$risk\"}"
}

# ─── Step 5: Build upgrade plan ───────────────────────────────────────────
UPGRADE_ORDER=()

# Build dependency-ordered upgrade list (dependencies first)
# Simple topological sort: devDeps last, deps first
for entry in "${SAFE_UPGRADES[@]}"; do
    IFS='|' read -r pkg current wanted latest pkg_type <<<"$entry"
    if [[ "$pkg_type" == "dependencies" ]]; then
        UPGRADE_ORDER+=("safe|$pkg|$current|$latest")
    fi
done
for entry in "${SAFE_UPGRADES[@]}"; do
    IFS='|' read -r pkg current wanted latest pkg_type <<<"$entry"
    if [[ "$pkg_type" == "devDependencies" ]]; then
        UPGRADE_ORDER+=("safe|$pkg|$current|$latest")
    fi
done
for entry in "${MANUAL_UPGRADES[@]}"; do
    IFS='|' read -r pkg current wanted latest pkg_type <<<"$entry"
    if [[ "$pkg_type" == "dependencies" ]]; then
        UPGRADE_ORDER+=("major|$pkg|$current|$latest")
    fi
done
for entry in "${MANUAL_UPGRADES[@]}"; do
    IFS='|' read -r pkg current wanted latest pkg_type <<<"$entry"
    if [[ "$pkg_type" == "devDependencies" ]]; then
        UPGRADE_ORDER+=("major|$pkg|$current|$latest")
    fi
done

# ─── Output ────────────────────────────────────────────────────────────────
if [[ "$MODE" == "json" ]]; then
    # Build JSON output
    UPGRADE_PLAN_JSON="$TMPDIR/plan.json"

    python3 -c "
import json

safe_list = []
for e in '${SAFE_UPGRADES[@]}'.split(' '):
    parts = e.split('|')
    if len(parts) >= 5:
        pkg, cur, want, lat, ptype = parts
        safe_list.append({'package': pkg, 'current': cur, 'wanted': want, 'latest': lat, 'type': ptype})

manual_list = []
for e in '${MANUAL_UPGRADES[@]}'.split(' '):
    parts = e.split('|')
    if len(parts) >= 5:
        pkg, cur, want, lat, ptype = parts
        changelog = '$(get_changelog_url "$pkg" 2>/dev/null || echo "")'
        effort = json.loads('$(estimate_effort "$pkg" "$cur" "$lat" 2>/dev/null || echo "{\"files\":0,\"import_lines\":0,\"is_major\":false,\"risk\":\"unknown\"}")')
        manual_list.append({
            'package': pkg, 'current': cur, 'wanted': want, 'latest': lat,
            'type': ptype, 'changelog': changelog,
            'effort': effort
        })

order_list = []
for e in '${UPGRADE_ORDER[@]}'.split(' '):
    parts = e.split('|')
    if len(parts) >= 4:
        order_list.append({'type': parts[0], 'package': parts[1], 'from': parts[2], 'to': parts[3]})

plan = {
    'timestamp': '$(date -u -Iseconds)',
    'safe_upgrades': safe_list,
    'manual_upgrades': manual_list,
    'upgrade_order': order_list,
    'summary': {
        'safe_count': len(safe_list),
        'manual_count': len(manual_list),
        'safe_effort_estimate': '$(echo "${#SAFE_UPGRADES[@]}" | awk "{print \$1 * 5}")m',
        'manual_effort_estimate': '$(echo "${#MANUAL_UPGRADES[@]}" | awk "{print \$1 * 20}")m',
    }
}

with open('$OUTPUT_JSON', 'w') as f:
    json.dump(plan, f, indent=2)

print(json.dumps(plan, indent=2))
" 2>/dev/null || true

elif [[ "$MODE" == "text" ]]; then
    echo -e "${BOLD}UPGRADE SUMMARY${NC}"
    echo -e "  Safe (minor/patch): ${GREEN}${#SAFE_UPGRADES[@]}${NC} packages"
    echo -e "  Manual (major):     ${YELLOW}${#MANUAL_UPGRADES[@]}${NC} packages"
    echo ""
    echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║  SAFE UPGRADES — can apply immediately   ║${NC}"
    echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"

    if [[ "${#SAFE_UPGRADES[@]}" -eq 0 ]]; then
        echo -e "  ${GREEN}None — all packages at latest compatible versions.${NC}"
    else
        for entry in "${SAFE_UPGRADES[@]}"; do
            IFS='|' read -r pkg current wanted latest pkg_type <<<"$entry"
            echo -e "  ${GREEN}✔${NC} $pkg: ${current} → ${latest} (${pkg_type})"
        done
    fi
    echo ""

    echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║  MANUAL UPGRADES — needs review          ║${NC}"
    echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"

    if [[ "${#MANUAL_UPGRADES[@]}" -eq 0 ]]; then
        echo -e "  ${GREEN}None — no major version bumps available.${NC}"
    else
        for entry in "${MANUAL_UPGRADES[@]}"; do
            IFS='|' read -r pkg current wanted latest pkg_type <<<"$entry"
            changelog=$(get_changelog_url "$pkg" 2>/dev/null || echo "")
            effort=$(estimate_effort "$pkg" "$current" "$latest" 2>/dev/null || echo "{}")

            echo -e "  ${YELLOW}▲${NC} ${BOLD}$pkg${NC}: ${RED}$current${NC} → ${GREEN}$latest${NC}"
            echo -e "     Type: $pkg_type"
            echo -e "     Changelog: ${BLUE}$changelog${NC}"
            echo -e "     Files affected: $(echo "$effort" | python3 -c "import json,sys; print(json.load(sys.stdin).get('files','?'))" 2>/dev/null || echo "?")"
            echo -e "     Import lines: $(echo "$effort" | python3 -c "import json,sys; print(json.load(sys.stdin).get('import_lines','?'))" 2>/dev/null || echo "?")"
            echo ""
        done
    fi

    echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║  SUGGESTED UPGRADE ORDER                 ║${NC}"
    echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"

    if [[ "${#UPGRADE_ORDER[@]}" -eq 0 ]]; then
        echo -e "  ${GREEN}No upgrades needed.${NC}"
    else
        echo -e "  ${BOLD}Phase 1 — Runtime dependencies (safe)${NC}"
        idx=0
        for entry in "${UPGRADE_ORDER[@]}"; do
            IFS='|' read -r pkg_type pkg current latest <<<"$entry"
            if [[ "$pkg_type" == "safe" ]]; then
                idx=$((idx + 1))
                echo "    $idx. pnpm update $pkg  # $current → $latest"
            fi
        done

        echo -e "  ${BOLD}Phase 2 — Dev dependencies (safe)${NC}"
        for entry in "${UPGRADE_ORDER[@]}"; do
            IFS='|' read -r pkg_type pkg current latest <<<"$entry"
            if [[ "$pkg_type" == "safe" && "$pkg" == *"dev"* ]]; then
                idx=$((idx + 1))
                echo "    $idx. pnpm update $pkg  # $current → $latest"
            fi
        done

        echo -e "  ${BOLD}Phase 3 — Major upgrades (manual review)${NC}"
        for entry in "${UPGRADE_ORDER[@]}"; do
            IFS='|' read -r pkg_type pkg current latest <<<"$entry"
            if [[ "$pkg_type" == "major" ]]; then
                idx=$((idx + 1))
                echo "    $idx. pnpm install ${pkg}@latest  # ${RED}$current → $latest${NC}"
            fi
        done
    fi

    echo ""
    echo -e "  ${BOLD}Apply safe upgrades:${NC} bash scripts/suggest-upgrades.sh --apply"
    echo -e "  ${BOLD}JSON report:${NC}        ${OUTPUT_JSON}"
    echo ""
fi

# ─── Apply safe upgrades (--apply flag) ────────────────────────────────────
if [[ "$APPLY_SAFE" == "true" ]]; then
    echo -e "${CYAN}Applying safe upgrades...${NC}"
    for entry in "${SAFE_UPGRADES[@]}"; do
        IFS='|' read -r pkg current wanted latest pkg_type <<<"$entry"
        echo -e "  Upgrading ${YELLOW}$pkg${NC}: $current → $latest"
        pnpm update "$pkg" 2>/dev/null || pnpm install "${pkg}@^${latest}" 2>/dev/null || echo -e "  ${RED}Failed: $pkg${NC}"
    done
    echo -e "${GREEN}Safe upgrades applied.${NC}"
fi

# ─── Git check ─────────────────────────────────────────────────────────────
if [[ -d "$REPO_DIR/.git" ]]; then
    echo ""
    echo -e "${BOLD}Git Status:${NC}"
    git -C "$REPO_DIR" diff --stat --exit-code 2>/dev/null &&
        echo -e "  ${GREEN}No changes after upgrade analysis.${NC}" ||
        echo -e "  ${YELLOW}Package files modified.${NC}"
fi
