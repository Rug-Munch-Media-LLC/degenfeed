"""Per-file metrics for the hypermodularity gate: size, functions, params, markers.

Split out of check-hypermodularity.py so both files stay under the 200-line
hard cap the gate enforces. This is a pure measurement module — the cap values
are passed in as arguments, so no gate policy lives here.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path


def marker_hits(text: str) -> int:
    """Count the banned-marker classes: live patch-library usage in the text
    body, plus HACK/WORKAROUND/temp-fix phrases in comment lines.
    """
    hits = 0
    for line in text.splitlines():
        if PATCH_LIBRARY.search(line) or line.lstrip().startswith(("#", "//", "/*", "*")) and FIX_MARKER.search(line):
            hits += 1
    return hits


def metric(path: Path) -> dict[str, int]:
    """Size/function/parameter/marker counts for one file.

    Keys: lines, functions, parameters, markers, plus one `fn:<name>` entry per
    function holding its longest line span (the gate compares those against
    MAX_FUNCTION_LINES and against the per-file baseline).
    """
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    body = "\n".join(lines)
    result = {
        "lines": len(lines),
        "functions": 0,
        "parameters": 0,
        "markers": marker_hits(body),
    }
    if path.suffix != ".py":
        return result
    try:
        tree = ast.parse(body, filename=str(path))
    except SyntaxError:
        return result
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        result["functions"] += 1
        span = (node.end_lineno or node.lineno) - node.lineno + 1
        result["parameters"] = max(result["parameters"], len(node.args.args) + len(node.args.kwonlyargs))
        result[f"fn:{node.name}"] = max(result.get(f"fn:{node.name}", 0), span)
    return result


DEBT_KEYS = (
    "files",
    "excess_lines",
    "function_debt",
    "parameter_debt",
    "marker_debt",
)


def debt_for(
    current: dict[str, int],
    *,
    hard_lines: int,
    max_function_lines: int,
    max_parameters: int,
) -> dict[str, int]:
    """Grandfathered-deficit contribution of one file against the given caps.

    Zero for a file with no baseline entry: debt is only ever reported against
    something that was previously measured.
    """
    return {
        "files": int(current["lines"] > hard_lines),
        "excess_lines": max(0, current["lines"] - hard_lines),
        "function_debt": sum(
            max(0, value - max_function_lines) for key, value in current.items() if key.startswith("fn:")
        ),
        "parameter_debt": max(0, current["parameters"] - max_parameters),
        "marker_debt": current["markers"],
    }


def empty_debt() -> dict[str, int]:
    return dict.fromkeys(DEBT_KEYS, 0)


# The first class is a PATCH-LIBRARY name matched in the text body; kept as a
# whole word so a fragment such as "monkey"-anything cannot trip it. The two
# patterns are deliberately left unnamed in prose here: a comment naming the
# library verbatim (or a filename containing it) would match its own pattern
# and mark this file. The operational rule lives in the sibling gate.
PATCH_LIBRARY = re.compile(r"(?i)\bmonkeypatch\b")

# The second class only counts inside a comment, so prose elsewhere is free.
FIX_MARKER = re.compile(r"(?i)\b(?:hack|workaround|temp fix)\b")


def total_debt(debts: list[dict[str, int]]) -> dict[str, int]:
    return {key: sum(item[key] for item in debts) for key in DEBT_KEYS} if debts else {}
