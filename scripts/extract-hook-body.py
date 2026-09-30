#!/usr/bin/env python3
"""Print the `run: |` block of one lefthook hook, verbatim, to stdout.

ci-gate-selftest.sh feeds the result to `bash -c` so the HOOK WRAPPER is
tested, not just the gate script it calls. Testing the script is not the same
as testing the wrapper — the 2026-09-27 structure-gate bug was invisible to
every script-level assertion and only existed in the wrapper's exit status.

Usage:  extract-hook-body.py <lefthook.yml> <hook-name>
Exit:   0 + script on stdout | 1 + reason on stderr
"""

from __future__ import annotations

import sys

HOOK_INDENT = 4  # pre-push hooks are indented 4 spaces under `pre-push:`
RUN_INDENT = HOOK_INDENT + 2  # `run: |` and its body sit 2 deeper


def find_hook(lines: list[str], hook: str) -> int:
    """Index of the `hook:` key, or -1. Matches only a top-level hook key."""
    key = f"{hook}:"
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped != key:
            continue
        indent = len(line) - len(line.lstrip())
        if indent == HOOK_INDENT:
            return i
    return -1


def extract(lines: list[str], start: int) -> str | None:
    """The hook's first `run: |` block, de-indented to column 0."""
    body: list[str] = []
    seen_run = False
    for line in lines[start + 1 :]:
        if line.strip() and (len(line) - len(line.lstrip())) <= HOOK_INDENT:
            break  # dedented out of the hook
        if not seen_run:
            # Keys before `run: |` (glob:, tags:) are not part of the body.
            if line.strip() == "run: |":
                seen_run = True
            continue
        body.append(line[RUN_INDENT:])
    return "\n".join(body) if seen_run else None


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("usage: extract-hook-body.py <lefthook.yml> <hook-name>", file=sys.stderr)
        return 1
    path, hook = argv[1], argv[2]
    try:
        with open(path, encoding="utf-8") as fh:
            lines = fh.read().splitlines()
    except OSError as exc:
        print(f"cannot read {path}: {exc}", file=sys.stderr)
        return 1

    start = find_hook(lines, hook)
    if start < 0:
        print(f"hook {hook!r} not found in {path}", file=sys.stderr)
        return 1
    script = extract(lines, start)
    if script is None:
        print(f"hook {hook!r} has no literal `run: |` block", file=sys.stderr)
        return 1
    sys.stdout.write(script)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
