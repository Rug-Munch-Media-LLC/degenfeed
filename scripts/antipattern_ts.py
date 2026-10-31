"""antipattern_ts.py — TS/JS slop-marker scanner.

One purpose: scan a TS/JS file for the house anti-patterns (ts-ignore markers,
god-file size). Overlay of antipattern_patterns.py; call from
check-antipatterns.py alongside antipattern_rules.scan_python.

Split from antipattern_rules.py (2026-10-31) for the structure gate.
"""

from __future__ import annotations

from pathlib import Path

from antipattern_patterns import TS_IGNORE_RE


def scan_ts(path: Path, counts: dict[str, int]) -> None:
    """Scan one TS/JS file for slop markers."""
    try:
        src = path.read_text(errors="ignore")
    except OSError:
        return
    if len(src.splitlines()) > 500:
        counts["god-file"] = counts.get("god-file", 0) + 1
    for ln in src.splitlines():
        if TS_IGNORE_RE.search(ln):
            counts["ts-ignore"] = counts.get("ts-ignore", 0) + 1
