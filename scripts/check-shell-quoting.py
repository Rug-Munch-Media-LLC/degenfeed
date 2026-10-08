#!/usr/bin/env python3
"""check-shell-quoting.py — shell quoting / zsh-slop gate (fleet, ratchet).

Fails when a repo's shell files contain banned quoting patterns or zsh
remnants. Counts may only go DOWN; lower the bar deliberately:

    python3 check-shell-quoting.py --repo . --update-baseline
    python3 check-shell-quoting.py --sweep ~/bin ~/.config/opencode/scripts

Rules
  zsh-shebang        #!/bin/zsh, #!/usr/bin/env zsh
  zsh-ism            setopt / zmodload / autoload -U (zsh-only syntax)
  nested-ssh-quoting ssh host "cmd with \"escaped\" quotes"   (SC2029 class)
  ssh-cd-command     ssh host "cd <dir> && <cmd>"               (use P1 argv)
  eval-usage         eval — banned; use arrays / "${cmd[@]}"
  unquoted-ssh-var   ssh host cmd $VAR (expands locally, unquoted)

Sanctioned patterns: standards/fleet/SHELL-STANDARD.md
Baseline file (per repo): .fleet-shell-baseline.json
"""

import argparse
import json
import logging
import re
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

BASELINE_NAME = ".fleet-shell-baseline.json"

SKIP_DIRS = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "__pycache__",
    "dist",
    "build",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".tox",
    "target",
    "vendor",
}

SHELL_SUFFIXES = {".sh", ".bash"}

RULES: list[tuple[str, re.Pattern[str]]] = [
    ("zsh-shebang", re.compile(r"^#!.*\bzsh\b", re.MULTILINE)),
    ("zsh-ism", re.compile(r"\b(setopt|zmodload|autoload\s+-U)\b")),
    ("nested-ssh-quoting", re.compile(r"\bssh\b[^\n]*\\[\"']")),
    ("ssh-cd-command", re.compile(r"\bssh\b[^\n]*[\"'][^\n]*\bcd\s")),
    ("eval-usage", re.compile(r"(^\s*|[;&|({]\s*|\bsudo\s+)eval\s", re.MULTILINE)),
    ("unquoted-ssh-var", re.compile(r"\bssh\s+\S+\s+[^\"'\n]*\$[A-Za-z_({]")),
]

# Vendor activation idioms: documented one-liners that REQUIRE eval (the tool
# ships its own shell integration). Sanctioned, so not counted as findings.
VENDOR_ALLOW = re.compile(
    r'eval\s+"\$\((starship|zoxide|direnv|mise|fzf|pyenv|rbenv|nvm|conda|atuin|sheldon|starship)[^)]*\)"'
)

# Embedded-language escapes: a single-quoted payload passed to an interpreter
# or SSH that carries backslash-escaped quotes, e.g.
#     python3 -c 'print(\"x\")'      or      ssh h 'echo \"y\"'
# Inside '...' the backslash is literal, so the inner language sees a stray \".
# This class shipped twice on 2026-09-23 (the sm client, gate fixtures).
# Sanctioned fix: keep payloads escape-free (variables, chr(10), heredocs) or
# put the code in a file; shellcheck cannot see this, we can.
PAYLOAD_CMD = re.compile(
    r"\b(python3?|bash|sh|zsh|node|deno|perl|ruby)\b[^\n]*-c\s|\bssh\b"
)
SINGLE_QUOTED = re.compile(r"'[^'\n]*'")
EMBEDDED_ESCAPE = re.compile(r"\\[\"']")

# Inline escape hatch: `quoting-ok` (or a shellcheck disable naming SC2029) on
# the offending line — or on the line directly above it — exempts that line.
PRAGMA = re.compile(r"quoting-ok|shellcheck\s+disable=")

ENGINE = Path(__file__).name


def is_shell_file(p: Path) -> bool:
    if p.suffix in SHELL_SUFFIXES:
        return True
    if p.suffix:
        return False
    try:
        with p.open("rb") as fh:
            first = fh.readline(200).decode("utf-8", "replace")
    except OSError as exc:
        logger.debug("OSError in is_shell_file: %s", exc)
        return False
    return first.startswith("#!") and ("bash" in first or "/sh" in first)


def iter_shell_files(root: Path):
    for p in root.rglob("*"):
        if not p.is_file() or p.name == ENGINE:
            continue
        # Selftests exist to CONTAIN violations (their fixtures are the whole
        # point) — same rationale as the engine exempting itself.
        if p.name.endswith("-selftest.sh"):
            continue
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        if is_shell_file(p):
            yield p


def scan_file(p: Path) -> list[tuple[str, int, str]]:
    out: list[tuple[str, int, str]] = []
    try:
        text = p.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        logger.debug("OSError reading %s: %s", p, exc)
        return out
    lines = text.splitlines()
    pragma = {i for i, ln in enumerate(lines, 1) if PRAGMA.search(ln)}
    exempt = pragma | {i + 1 for i in pragma}
    for rule, rx in RULES:
        for m in rx.finditer(text):
            line = text.count("\n", 0, m.start()) + 1
            if line in exempt:
                continue
            if rule == "eval-usage":
                src = lines[line - 1] if 0 < line <= len(lines) else ""
                if VENDOR_ALLOW.search(src):
                    continue
            out.append((rule, line, m.group(0).strip()[:100]))
    for i, ln in enumerate(lines, 1):
        if i in exempt or not PAYLOAD_CMD.search(ln):
            continue
        if any(EMBEDDED_ESCAPE.search(seg) for seg in SINGLE_QUOTED.findall(ln)):
            out.append(("embedded-escaped-quote", i, ln.strip()[:100]))
    return out


def scan(root: Path) -> tuple[dict[str, int], list[str]]:
    counts: dict[str, int] = {}
    findings: list[str] = []
    for p in sorted(iter_shell_files(root)):
        for rule, line, text in scan_file(p):
            counts[rule] = counts.get(rule, 0) + 1
            findings.append(f"{p}:{line}: {rule}: {text}")
    return counts, findings


def load_baseline(root: Path) -> dict[str, int]:
    f = root / BASELINE_NAME
    if f.exists():
        try:
            return json.loads(f.read_text())
        except (OSError, json.JSONDecodeError) as exc:
            logger.debug("failed to load baseline: %s", exc)
            return {}
    return {}


def run_sweep(dirs: list[str]) -> int:
    total = 0
    for d in dirs:
        root = Path(d).expanduser()
        if not root.is_dir():
            print(f"skip (not a dir): {root}")
            continue
        counts, findings = scan(root)
        n = sum(counts.values())
        total += n
        print(f"{root}: {n} finding(s)")
        for f in findings[:100]:
            print(f"  {f}")
        if n > 100:
            print(f"  … {n - 100} more")
    return 1 if total else 0


def run_files(paths: list[str]) -> int:
    """Staged-file mode: lint exactly these files (shell files only)."""
    total = 0
    for raw in paths:
        p = Path(raw)
        if not p.is_file() or not is_shell_file(p):
            continue
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        # Same exemption as repo mode: selftests exist to CONTAIN violations.
        if p.name.endswith("-selftest.sh"):
            continue
        for rule, line, text in scan_file(p):
            print(f"{p}:{line}: {rule}: {text}")
            total += 1
    if total:
        print(
            f"check-shell-quoting: FAIL — {total} finding(s) in staged files (see SHELL-STANDARD.md)",
            file=sys.stderr,
        )
        return 1
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--repo", default=".", help="repo root to gate")
    ap.add_argument(
        "--sweep", nargs="*", metavar="DIR", help="report-mode sweep over dirs"
    )
    ap.add_argument(
        "--files",
        nargs="*",
        metavar="FILE",
        help="lint exactly these files (staged-file mode)",
    )
    ap.add_argument(
        "--update-baseline",
        action="store_true",
        help="write current counts as baseline",
    )
    args = ap.parse_args()

    if args.files is not None:
        return run_files(args.files) if args.files else 0

    if args.sweep is not None:
        if not args.sweep:
            print("usage: --sweep DIR [DIR ...]", file=sys.stderr)
            return 2
        return run_sweep(args.sweep)

    root = Path(args.repo)
    if not root.is_dir():
        print(f"check-shell-quoting: no such repo: {root}", file=sys.stderr)
        return 2

    counts, findings = scan(root)
    for f in findings:
        print(f)

    if args.update_baseline:
        (root / BASELINE_NAME).write_text(
            json.dumps(counts, indent=2, sort_keys=True) + "\n"
        )
        print(
            f"baseline updated: {root / BASELINE_NAME} ({sum(counts.values())} findings)"
        )
        return 0

    baseline = load_baseline(root)
    grown = {r: c for r, c in counts.items() if c > baseline.get(r, 0)}
    if grown:
        for r, c in sorted(grown.items()):
            print(f"FAIL {r}: {c} (baseline {baseline.get(r, 0)})", file=sys.stderr)
        print(
            "check-shell-quoting: FAIL — quoting regression (see SHELL-STANDARD.md)",
            file=sys.stderr,
        )
        return 1
    print(
        f"check-shell-quoting: PASS ({sum(counts.values())} findings, baseline {sum(baseline.values())})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
