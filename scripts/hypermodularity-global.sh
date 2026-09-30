#!/usr/bin/env bash
# Global Talos builder wrapper for the canonical hypermodularity gate.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
GATE="${HYPERMODULARITY_GATE:-$SCRIPT_DIR/check-hypermodularity.py}"
BASELINE_ROOT="${HYPERMODULARITY_BASELINE_ROOT:-$HOME/.config/opencode/hypermodularity-baselines}"
REPO_ROOT="/srv/work/repos"
BOOTSTRAP=0
ALL=0
REPO=""

while (($#)); do
    case "$1" in
    --bootstrap) BOOTSTRAP=1 ;;
    --all) ALL=1 ;;
    --repo)
        REPO="${2:?--repo requires a path}"
        shift
        ;;
    *)
        printf 'unknown argument: %s\n' "$1" >&2
        exit 2
        ;;
    esac
    shift
done

run_repo() {
    local repo="$1" name baseline report
    [[ -d "$repo/.git" ]] || return 0
    name="$(basename "$repo")"
    baseline="$BASELINE_ROOT/$name.json"
    report="$BASELINE_ROOT/$name.report.json"
    mkdir -p "$BASELINE_ROOT"
    if [[ ! -f "$baseline" && "$BOOTSTRAP" -eq 1 ]]; then
        python3 "$GATE" --repo "$repo" --baseline "$baseline" --update-baseline
    fi
    [[ -f "$baseline" ]] || {
        printf 'missing baseline: %s\n' "$baseline" >&2
        return 1
    }
    python3 "$GATE" --repo "$repo" --baseline "$baseline" --report "$report"
}

if [[ "$ALL" -eq 1 ]]; then
    failed=0
    for repo in "$REPO_ROOT"/*; do
        [[ -d "$repo/.git" ]] || continue
        origin="$(git -C "$repo" remote get-url origin 2>/dev/null || true)"
        [[ "$origin" == *RugMunchMedia* || "$origin" == *cryptorugmuncher* ]] || continue
        run_repo "$repo" || failed=1
    done
    exit "$failed"
fi
[[ -n "$REPO" ]] || {
    printf '%s\n' 'usage: hypermodularity-gate --repo PATH | --all [--bootstrap]' >&2
    exit 2
}
run_repo "$REPO"
