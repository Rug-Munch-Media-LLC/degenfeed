#!/usr/bin/env bash
# shellcheck disable=SC2119,SC2120
# (helpers intentionally take optional args)
# ci-gate-selftest.sh — prove the cost/quality gates ACTUALLY catch violations.
#
# Builds a throwaway fixture repo and injects one violation at a time. Every
# injection MUST make its gate exit 1; a clean fixture MUST exit 0. Any
# mismatch exits non-zero, which fails the CI quality job.
#
# Covered assertions:
#   (i)   501-line file                -> structure gate exits 1
#   (ii)  >200 non-allowlisted file    -> structure gate exits 1
#   (iii) allowlist-growth case        -> structure gate exits 1
#   (iv)  +1 monkeypatch occurrence    -> monkeypatch gate exits 1
#   (0)   clean fixture                -> both gates exit 0
#   (v)   delegates to hook-wrapper-selftest.sh (the wrapper, not just the script)
#         when the ratchet fails, and 0 on a clean tree (2026-09-27: the
#
# Usage: bash scripts/ci-gate-selftest.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# Works both when synced into <repo>/scripts/ and when run from the canonical
# fleet/gates/ directory: the gates always sit next to this script.
STRUCT="$SCRIPT_DIR/check-structure.py"
MONKEY="$SCRIPT_DIR/check-monkeypatch.py"
SHELLQ="$SCRIPT_DIR/check-shell-quoting.py"
CINNABOX="$SCRIPT_DIR/cinnabox-parity-gate.py"
HYPERMOD="$SCRIPT_DIR/test_hypermodularity.py"

PY="${PYTHON:-python3}"
if [ -x "$REPO_ROOT/.venv/bin/python" ]; then
    PY="$REPO_ROOT/.venv/bin/python"
fi

FIXTURE="$(mktemp -d)"
trap 'rm -rf "$FIXTURE"' EXIT

fails=0
pass() { printf '  ok    %s\n' "$1"; }
fail() {
    printf '  FAIL  %s (rc=%s)\n' "$1" "${2:-?}"
    fails=$((fails + 1))
}

reset_fixture() {
    rm -rf "$FIXTURE"
    mkdir -p "$FIXTURE/src/rugbrain" "$FIXTURE/scripts"
    printf 'x = 1\n' >"$FIXTURE/src/rugbrain/small.py"
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

struct_rc() {
    "$PY" "$STRUCT" --repo "$FIXTURE" "$@" >/dev/null 2>&1
    echo $?
}
monkey_rc() {
    "$PY" "$MONKEY" --repo "$FIXTURE" >/dev/null 2>&1
    echo $?
}
shellq_rc() {
    "$PY" "$SHELLQ" --repo "$FIXTURE" >/dev/null 2>&1
    echo $?
}

expect_rc() { # expect_rc <want> <actual> <label>
    if [ "$2" -eq "$1" ]; then
        pass "$3"
    else
        fail "$3" "$2"
    fi
}

echo "gate-selftest: clean fixture must PASS (exit 0)"
reset_fixture
expect_rc 0 "$(struct_rc)" "clean fixture (structure)"
expect_rc 0 "$(monkey_rc)" "clean fixture (monkeypatch)"

echo "gate-selftest: injected violations must FAIL (exit 1)"
reset_fixture
gen 501 "$FIXTURE/src/rugbrain/god.py"
expect_rc 1 "$(struct_rc)" "501-line file -> exit 1"

reset_fixture
gen 201 "$FIXTURE/src/rugbrain/over.py"
expect_rc 1 "$(struct_rc)" "201-line non-allowlisted -> exit 1"

reset_fixture
printf '{"files": {"src/rugbrain/growth.py": 205}}' >"$FIXTURE/scripts/structure-baseline.json"
gen 260 "$FIXTURE/src/rugbrain/growth.py"
expect_rc 1 "$(struct_rc)" "allowlist growth -> exit 1"

reset_fixture
printf '{"total": 0, "files": {}}' >"$FIXTURE/scripts/monkeypatch-baseline.json"
printf "import monkeypatch as monkeypatch\nmonkeypatch.setattr(x, 'y', z)\n" \
    >"$FIXTURE/src/rugbrain/mp.py"
expect_rc 1 "$(monkey_rc)" "+1 monkeypatch -> exit 1"

echo "gate-selftest: shell-quoting gate must catch quoting regressions"
reset_fixture
# quoting-ok (fixture injects the violation on purpose)
# fixture text must stay literal (quoted printf is deliberate)
# shellcheck disable=SC2016
printf '#!/bin/zsh\nsetopt extendedglob\nssh host "cd /srv && eval \\"$cmd\\""\n' \
    >"$FIXTURE/scripts/bad.sh"
expect_rc 1 "$(shellq_rc)" "zsh + nested ssh quoting + eval -> exit 1"

reset_fixture
# fixture text must stay literal (quoted printf is deliberate)
# shellcheck disable=SC2016
printf '#!/usr/bin/env bash\nset -euo pipefail\nrsync -a "$SRC" "host:$DST"\n' \
    >"$FIXTURE/scripts/good.sh"
expect_rc 0 "$(shellq_rc)" "sanctioned quoting -> exit 0"

echo "gate-selftest: embedded-language escapes must be caught"
reset_fixture
cat >"$FIXTURE/scripts/embed.sh" <<'EMBED'
#!/usr/bin/env bash
python3 -c 'print(\"x\")'
EMBED
expect_rc 1 "$(shellq_rc)" "python -c with escaped quotes -> exit 1"

reset_fixture
cat >"$FIXTURE/scripts/embed_ok.sh" <<'EMBED'
#!/usr/bin/env bash
python3 -c 'print(1+1)'
EMBED
expect_rc 0 "$(shellq_rc)" "escape-free payload -> exit 0"

echo "gate-selftest: hypermodularity backtest must pass"
expect_rc 0 "$(
    $PY "$HYPERMOD" >/dev/null 2>&1
    echo $?
)" "hypermodularity fixtures"

echo "gate-selftest: hook WRAPPER must propagate failure (separate script)"
expect_rc 0 "$(bash "$SCRIPT_DIR/hook-wrapper-selftest.sh" >/dev/null 2>&1; echo $?)" \
    "hook-wrapper-selftest (ratchet exit propagation)"

echo "gate-selftest: Cinnabox parity backtest must pass"
expect_rc 0 "$(
    $PY "$CINNABOX" --self-test >/dev/null 2>&1
    echo $?
)" "Cinnabox clean fixture"

if [ "$fails" -ne 0 ]; then
    echo "gate-selftest: FAIL ($fails assertion(s) did not match)"
    exit 1
fi
echo "gate-selftest: PASS — every gate catches its violation class"
exit 0
