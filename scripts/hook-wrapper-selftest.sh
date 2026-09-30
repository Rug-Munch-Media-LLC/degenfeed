#!/usr/bin/env bash
# shellcheck disable=SC2119,SC2120
# (helpers intentionally take optional args)
# hook-wrapper-selftest.sh — assert the lefthook HOOK WRAPPER propagates failure.
#
# WHY THIS IS A SEPARATE SCRIPT: testing a gate script is NOT testing its hook.
# On 2026-09-27 `structure-gate` reported success while its ratchet failed, in
# all 33 repos that symlink standards/lefthook.yml — a bare shell block exits
# with its LAST command, and the ratchet ran before the always-green
# check-baseline-freshness.py. Every script-level assertion in
# ci-gate-selftest.sh passed the whole time, which is why the bug survived.
# These assertions extract the `run: |` block from the canonical lefthook.yml
# and execute it, so the WRAPPER's exit status is what gets measured.
#
# Assertions:
#   (1) failing ratchet      -> structure-gate hook exits 1
#   (2) growing allowlist    -> structure-gate hook exits 1
#   (3) clean tree           -> structure-gate hook exits 0
#   (4) stale baseline       -> structure-gate hook exits 1 (freshness still blocks)
#
# Usage: bash scripts/hook-wrapper-selftest.sh
#        LEFTHOOK_YML=/path/to/lefthook.yml bash scripts/hook-wrapper-selftest.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY="${PYTHON:-python3}"

STRUCT="$SCRIPT_DIR/check-structure.py"
HOOKEXTRACT="$SCRIPT_DIR/extract-hook-body.py"

# The canonical wrapper every repo symlinks to. This script is synced into
# <repo>/scripts/ AND runs from fleet/gates/, so search UPWARD for the wrapper
# rather than assuming a fixed depth. Repos carry it as `.lefthook.yml` (what
# lefthook actually reads) and `lefthook.yml` (the canonical filename).
find_lefthook() {
    local d="$SCRIPT_DIR" i=0
    while [ "$i" -lt 6 ]; do
        if [ -f "$d/lefthook.yml" ]; then
            printf '%s\n' "$d/lefthook.yml"
            return 0
        fi
        if [ -f "$d/.lefthook.yml" ]; then
            printf '%s\n' "$d/.lefthook.yml"
            return 0
        fi
        d="$(dirname "$d")"
        i=$((i + 1))
    done
    return 1
}
if [ -z "${LEFTHOOK_YML:-}" ]; then
    LEFTHOOK_YML="$(find_lefthook)" || {
        echo "hook-selftest: no lefthook.yml above $SCRIPT_DIR — set LEFTHOOK_YML" >&2
        exit 1
    }
fi
[ -f "$HOOKEXTRACT" ] || {
    echo "hook-selftest: missing $HOOKEXTRACT" >&2
    exit 1
}

FIXTURE="$(mktemp -d)"
trap 'rm -rf "$FIXTURE"' EXIT

fails=0
pass() { printf '  ok    %s\n' "$1"; }
fail() {
    printf '  FAIL  %s (rc=%s)\n' "$1" "${2:-?}"
    fails=$((fails + 1))
}

# gen <n> <file> — write exactly n lines.
gen() {
    local n="$1" f="$2" i=0
    : >"$f"
    while [ "$i" -lt "$n" ]; do
        printf '# line\n' >>"$f"
        i=$((i + 1))
    done
}

# fixture [freshness-rc] — wire the fixture for hook_rc: the structure gate
# symlinked in under the path the HOOK expects, plus a baseline-freshness stub
# whose exit status is the argument (default 0 = the "always green" case that
# hid the original bug).
fixture() {
    rm -rf "$FIXTURE"
    mkdir -p "$FIXTURE/src/rugbrain" "$FIXTURE/scripts"
    printf 'x = 1\n' >"$FIXTURE/src/rugbrain/small.py"
    ln -s "$STRUCT" "$FIXTURE/scripts/check-code-structure.py"
    printf 'import sys\nsys.exit(%s)\n' "${1:-0}" \
        >"$FIXTURE/scripts/check-baseline-freshness.py"
}

# hook_rc <hook> — exit status of that hook's real `run: |` block.
hook_rc() {
    local body
    body="$("$PY" "$HOOKEXTRACT" "$LEFTHOOK_YML" "$1")" || return 2
    (cd "$FIXTURE" && bash -c "$body" >/dev/null 2>&1)
    echo $?
}

expect_rc() { # expect_rc <want> <actual> <label>
    if [ "$2" -eq "$1" ]; then
        pass "$3"
    else
        fail "$3" "$2"
    fi
}

echo "hook-selftest: wrapper against $LEFTHOOK_YML"
fixture
gen 501 "$FIXTURE/src/rugbrain/god.py"
expect_rc 1 "$(hook_rc structure-gate)" "failing ratchet -> hook exits 1"

fixture
printf '{"files": {"src/rugbrain/growth.py": 205}}' >"$FIXTURE/scripts/structure-baseline.json"
gen 260 "$FIXTURE/src/rugbrain/growth.py"
expect_rc 1 "$(hook_rc structure-gate)" "allowlist growth -> hook exits 1"

fixture
expect_rc 0 "$(hook_rc structure-gate)" "clean tree -> hook exits 0"

fixture 1 # freshness stub FAILS
expect_rc 1 "$(hook_rc structure-gate)" "stale baseline -> hook exits 1"

if [ "$fails" -ne 0 ]; then
    echo "hook-selftest: FAIL ($fails assertion(s) did not match)"
    exit 1
fi
echo "hook-selftest: PASS — the wrapper propagates the ratchet's exit status"
exit 0
