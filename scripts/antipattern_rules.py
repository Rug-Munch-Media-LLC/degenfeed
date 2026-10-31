"""antipattern_rules.py — Python scanner for the anti-pattern ratchet gate.

One purpose: scan one PYTHON file with the house anti-pattern checks. The rule
REGEXES and skip policy live in antipattern_patterns.py, the wildcard-import
judgement in antipattern_wildcard.py, the TS scanner in antipattern_ts.py.
TEXT IS NOT CODE: slop-markers reads real COMMENT tokens and wildcard-import
skips string literals. DELIBERATE RE-EXPORTS: the REEXPORT_ALLOWLIST keepers
star-import siblings as their public API; a wildcard in a dead
`except ImportError:` fallback is unreachable and still counts.

Split from check-antipatterns.py (2026-09-19); trimmed to the Python scanner
(2026-10-31) by the split described above. scan_python / scan_ts are the CLI's
detection entry points.
"""

from __future__ import annotations

import ast
import io
import tokenize
from pathlib import Path

from antipattern_patterns import (  # noqa: F401 — re-exported constants
    EVAL_RE,
    FSTRING_LOG_RE,
    LOGGING_RE,
    MONKEY_RE,
    REEXPORT_ALLOWLIST,
    SECRET_RE,
    SKIP_DIRS,
    SLOP_RE,
    SYNC_IO_RE,
    WILDCARD_RE,
)

# Deliberate re-export: callers keep `from antipattern_rules import scan_ts`.
from antipattern_ts import scan_ts  # noqa: F401 — API compat after split
from antipattern_wildcard import _dead_fallback_lines, _is_own_module


def _token_maps(src: str) -> tuple[list[str], set[int]]:
    """(comment texts, string-literal lines) via one tokenize pass.

    The only exact way to tell a real comment from quoted text: tokenize never
    emits COMMENT inside a string. On tokenize failure both maps stay empty,
    so quoted text is never mistaken for code.
    """
    comments: list[str] = []
    strings: set[int] = set()
    try:
        for tok in tokenize.generate_tokens(io.StringIO(src).readline):
            if tok.type == tokenize.COMMENT:
                comments.append(tok.string)
            elif tok.type == tokenize.STRING:
                strings.update(range(tok.start[0], (tok.end or tok.start)[0] + 1))
    except (tokenize.TokenError, IndentationError, SyntaxError):
        return [], set()
    return comments, strings


def scan_python(path: Path, counts: dict[str, int], root: Path | None = None) -> None:
    """Scan one Python file with the antipattern AST checks."""
    try:
        src = path.read_text(errors="ignore")
        tree = ast.parse(src)
    except (SyntaxError, UnicodeDecodeError, OSError):
        return
    lines = src.splitlines()
    comments, strings = _token_maps(src)
    dead = _dead_fallback_lines(tree, root or path.parent)
    wildcards: list[int] = []
    if len(lines) > 500:
        counts["god-file"] = counts.get("god-file", 0) + 1
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            args = node.args
            total = len(args.args) + len(args.posonlyargs) + len(args.kwonlyargs)
            if (node.end_lineno or node.lineno) - node.lineno > 80:
                counts["long-function"] = counts.get("long-function", 0) + 1
            if total > 5:
                counts["too-many-params"] = counts.get("too-many-params", 0) + 1
            for d in args.defaults + args.kw_defaults:
                if isinstance(d, (ast.List, ast.Dict, ast.Set)):
                    counts["mutable-default"] = counts.get("mutable-default", 0) + 1
            if isinstance(node, ast.AsyncFunctionDef):
                seg = ast.get_source_segment(src, node) or ""
                if SYNC_IO_RE.search(seg):
                    counts["sync-io-async"] = counts.get("sync-io-async", 0) + 1
        if isinstance(node, ast.ExceptHandler):
            seg = ast.get_source_segment(src, node) or ""
            if node.type is None or (not LOGGING_RE.search(seg) and "raise" not in seg):
                counts["bare-except"] = counts.get("bare-except", 0) + 1
    for text in comments:
        if SLOP_RE.search(text):
            counts["slop-markers"] = counts.get("slop-markers", 0) + 1
    for lineno, ln in enumerate(lines, start=1):
        if MONKEY_RE.search(ln):
            counts["monkeypatch"] = counts.get("monkeypatch", 0) + 1
        if FSTRING_LOG_RE.search(ln):
            counts["fstring-logging"] = counts.get("fstring-logging", 0) + 1
        wm = WILDCARD_RE.match(ln)
        if wm and lineno not in strings:
            if not _is_own_module(wm.group(1), root, path.parent):
                counts["wildcard-import"] = counts.get("wildcard-import", 0) + 1
            wildcards.append(lineno)
        if EVAL_RE.search(ln) and "ast.literal_eval" not in ln:
            counts["eval-exec"] = counts.get("eval-exec", 0) + 1
        if SECRET_RE.search(ln) and "os.environ" not in ln and "getenv" not in ln:
            counts["hardcoded-secret"] = counts.get("hardcoded-secret", 0) + 1
    if path.name in REEXPORT_ALLOWLIST and wildcards:
        exempt = sum(1 for ln in wildcards if ln not in dead)
        if exempt:
            counts["wildcard-import"] = max(
                0, counts.get("wildcard-import", 0) - exempt
            )
            counts["_wildcard-import-reexport-exempt"] = (
                counts.get("_wildcard-import-reexport-exempt", 0) + exempt
            )
