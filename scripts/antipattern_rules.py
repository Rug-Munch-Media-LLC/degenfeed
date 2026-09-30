"""antipattern_rules.py — rule detection for the anti-pattern ratchet gate.

Extracted from check-antipatterns.py (2026-09-19) to keep the CLI under the
200-line structure gate. TEXT IS NOT CODE: slop-markers reads real COMMENT
tokens and wildcard-import skips string literals. DELIBERATE RE-EXPORTS: the
REEXPORT_ALLOWLIST keepers star-import siblings as their public API; a wildcard
in a dead `except ImportError:` fallback is unreachable and still counts.
"""

from __future__ import annotations

import ast
import io
import re
import tokenize
from pathlib import Path

# Directories never scanned (vendored/generated/cache trees).
SKIP_DIRS = {
    ".git",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    "dist",
    "build",
    ".next",
    ".nuxt",
    "coverage",
    ".mypy_cache",
    ".ruff_cache",
    ".pytest_cache",
    "site-packages",
    "mutants",
    ".tox",
    ".nox",
    "htmlcov",
    ".output",
    "crypto-skills",
}

# Deliberate public re-export surfaces: holders that merge split siblings into one
# namespace so callers keep the historical `from <keeper> import Name` API. Narrow
# and reviewable; dead `except ImportError` fallbacks are NOT exempt (below).
REEXPORT_ALLOWLIST = frozenset(
    [
        "server.py",
        "chunker.py",
        "ingest_keeper.py",
        "ingest_runner.py",
        "ingest_scan.py",
        "server_tools_a.py",
        "server_tools_b.py",
    ]
)

MONKEY_RE = re.compile(
    r"monkeypatch\.|mock\.patch|@patch\(|patch\.object|del sys\.modules"
)
SLOP_RE = re.compile(
    r"#\s*(HACK|WORKAROUND|TEMP|XXX|!!!|FIX ME|DO NOT SHIP)\b", re.IGNORECASE
)
FSTRING_LOG_RE = re.compile(
    r"log(?:ger)?\.(?:debug|info|warning|error|critical)\(\s*f[\"']"
)
WILDCARD_RE = re.compile(r"^\s*from\s+([\w.]+)\s+import\s+\*")
EVAL_RE = re.compile(r"(?<![\w.])eval\(|(?<![\w.])exec\(")
TS_IGNORE_RE = re.compile(r"@ts-ignore|@ts-nocheck|:\s*any\b|as any\b")
SECRET_RE = re.compile(
    r"(?i)\b(api[_-]?key|secret|password|private[_-]?key)\b\s*[:=]\s*[\"'][A-Za-z0-9_\-]{16,}[\"']"
)
SYNC_IO_RE = re.compile(
    r"\b(requests\.(get|post|put|delete)|urllib\.request|time\.sleep)\("
)
LOGGING_RE = re.compile(
    r"log(?:ger)?\.(debug|info|warning|error|critical|exception)\(|raise\b|logging\."
)
IMPORT_ERRORS = frozenset({"ImportError", "ModuleNotFoundError"})


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


def _is_own_module(dotted: str, root: Path | None, src_dir: Path | None = None) -> bool:
    """True when a star-import targets OUR code that exists on disk.

    `from <our_module> import *` is this repo's hub idiom, not the namespace
    pollution this rule exists for (third-party: `from os import *`). A module
    that does not resolve (a dead `scripts.does_not_exist` fallback) keeps
    counting.
    """
    if dotted.startswith("."):
        return True  # relative import — by definition our code
    parts = dotted.split(".")
    if root is None:
        return len(parts) == 1
    cands = [root.joinpath(*parts).with_suffix(".py"), root / f"{parts[-1]}.py"]
    if src_dir is not None:
        cands.append(src_dir / f"{parts[-1]}.py")
    return any(c.exists() for c in cands) or root.joinpath(*parts).is_dir()


def _dead_fallback_lines(tree: ast.AST, root: Path) -> set[int]:
    """Wildcard imports in an `except ImportError:` whose module is absent.

    The branch can never run, so the wildcard stays counted against the
    ratchet even inside an allowlisted keeper.
    """
    dead: set[int] = set()
    for handler in ast.walk(tree):
        if not isinstance(handler, ast.ExceptHandler):
            continue
        exc = handler.type
        elts = exc.elts if isinstance(exc, ast.Tuple) else [exc]
        if not {e.id for e in elts if isinstance(e, ast.Name)} & IMPORT_ERRORS:
            continue
        for node in ast.walk(handler):
            if not isinstance(node, ast.ImportFrom) or not node.module:
                continue
            if not any(a.name == "*" for a in node.names):
                continue
            rel, tail = node.module.replace(".", "/"), node.module.rsplit(".", 1)[-1]
            cands = (
                root / f"{rel}.py",
                root / rel / "__init__.py",
                root / f"{tail}.py",
            )
            if not any(c.exists() for c in cands):
                dead.add(node.lineno)
    return dead


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
