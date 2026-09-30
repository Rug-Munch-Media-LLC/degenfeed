#!/usr/bin/env python3
"""check-antipatterns.py — per-repo anti-pattern ratchet gate (thin CLI).

Scans THIS repo for the house anti-pattern list and fails CI when any rule's
count exceeds the committed baseline. Ratchet semantics: counts may only go
DOWN; lower them deliberately with --update-baseline.

Rule detection — the AST checks plus the TEXT/re-export safeguards — lives in
scripts/antipattern_rules.py so this CLI stays small (and survives the fleet
gate sync as a pair). Two rules must not fire on TEXT or on deliberate
re-export surfaces:

  * slop-markers matches real COMMENT tokens only — a "# HACK" inside a
    string literal is fixture data, not a marker;
  * wildcard-import skips string literals, exempts this repo's deliberate hub
    re-exports + the REEXPORT_ALLOWLIST keepers, and does NOT exempt a
    wildcard in a dead `except ImportError:` fallback (unreachable code).

Rules: monkeypatch, bare-except, fstring-logging, sync-io-async, eval-exec,
god-file (>500 — MODULARITY.md), long-function (>80), too-many-params (>5),
wildcard-import, mutable-default, slop-markers, ts-ignore.

Usage:
  python3 check-antipatterns.py --repo .                     # gate
  python3 check-antipatterns.py --repo . --update-baseline   # lower the bar
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from antipattern_rules import (
    REEXPORT_ALLOWLIST,
    SKIP_DIRS,
    scan_python,
    scan_ts,
)

# The gate engine itself (and its rules module) is never scanned: it contains
# the rule PATTERNS as literals, which would otherwise count as violations.
_ENGINE_FILES = {
    "check-antipatterns.py",
    "check_antipatterns.py",
    "antipattern_rules.py",
}


def scan(root: Path) -> dict[str, int]:
    """Scan the repo tree and return per-rule finding counts."""
    counts: dict[str, int] = {}
    for p in root.rglob("*.py"):
        if p.name in _ENGINE_FILES:
            continue
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        scan_python(p, counts, root)
    for ext in ("*.ts", "*.tsx"):
        for p in root.rglob(ext):
            if any(part in SKIP_DIRS for part in p.parts):
                continue
            scan_ts(p, counts)
    return counts


def main() -> int:
    """CLI entry: scan, compare to the shrink-only baseline, fail on growth."""
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=".")
    ap.add_argument("--baseline", default="scripts/antipattern-baseline.json")
    ap.add_argument("--update-baseline", action="store_true")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    root = Path(args.repo).resolve()
    counts = scan(root)
    # `_`-prefixed keys are informational counters, never ratchet rules.
    exempt = counts.pop("_wildcard-import-reexport-exempt", 0)
    total = sum(counts.values())
    baseline_path = root / args.baseline
    baseline: dict[str, int] = {}
    if baseline_path.exists():
        try:
            baseline = json.loads(baseline_path.read_text()).get("rules", {})
        except Exception:  # noqa: BLE001
            baseline = {}

    if args.update_baseline:
        grown = {
            r: (baseline.get(r, 0), n)
            for r, n in counts.items()
            if n > baseline.get(r, 0)
        }
        if grown and baseline_path.exists():
            print("REFUSING to raise the baseline (ratchet is shrink-only):")
            for r, (o, n) in grown.items():
                print(f"  {r}: {o} -> {n}")
            return 1
        baseline_path.write_text(
            json.dumps({"rules": counts, "total": total}, indent=1) + "\n"
        )
        print(f"baseline updated: {baseline_path} (total {total})")
        return 0

    failures = [
        f"{r}: {baseline.get(r, 0)} -> {n} (ratchet: fix, don't add)"
        for r, n in sorted(counts.items())
        if n > baseline.get(r, 0)
    ]
    if not args.quiet:
        print(f"antipattern gate: {total} findings across {len(counts)} rules")
        for rule, n in sorted(counts.items(), key=lambda x: -x[1]):
            mark = "  " if n <= baseline.get(rule, 0) else "!!"
            print(f"  {mark} {rule:<18} {n:>5} (baseline {baseline.get(rule, 0)})")
        if exempt:
            print(
                f"  note: {exempt} deliberate re-export wildcard(s) exempt in: "
                f"{', '.join(sorted(REEXPORT_ALLOWLIST))}"
            )
            print(
                "        (dead `except ImportError` fallbacks are NOT exempt and still count)"
            )
    if failures:
        print("\nFAIL (antipattern ratchet):")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("antipattern gate: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
