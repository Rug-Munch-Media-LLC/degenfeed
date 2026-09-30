#!/usr/bin/env bash
# Deny committing on top of an unacknowledged destructive reset.
#
# 2026-09-27: an agent ran `git reset --hard origin/main` in this checkout while
# 34 files of uncommitted work and two local commits were present. The reset
# succeeded silently; the only trace was one reflog line. This check makes the
# loss visible at the next commit, and prints the recovery command.
#
# Version-controlled and wired through lefthook.yml rather than dropped into
# .git/hooks — a raw hook file is untracked, unportable, and (measured here)
# collides with lefthook's own hook management.
#
# Bypass once, deliberately:  AGENT_LANE_ACK_RESET=1 git commit ...
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 0
lost="$(git reflog -40 2>/dev/null | grep -E 'reset: moving to' \
        | grep -vE 'reset: moving to HEAD(\$|@|$)' | head -1 || true)"
[ -n "$lost" ] || exit 0
[ "${AGENT_LANE_ACK_RESET:-0}" = "1" ] && exit 0
printf '\nBLOCKED a destructive reset is in the recent reflog:\n  %s\n' "$lost"
printf '  Uncommitted work may have been discarded. Inspect before continuing:\n'
printf '    git reflog | head -20\n    git cherry-pick <lost-sha>\n'
printf '  Nothing to recover? re-run with AGENT_LANE_ACK_RESET=1 to acknowledge once.\n\n'
exit 1
