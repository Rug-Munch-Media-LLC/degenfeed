"""antipattern_wildcard.py — wildcard-import judgement helpers.

One purpose: decide WHEN a `from x import *` counts. A wildcard at our own
hub module is this repo's re-export idiom, not namespace pollution; a wildcard
inside a dead `except ImportError:` fallback is unreachable and always counts.

Split from antipattern_rules.py (2026-10-31) for the structure gate; pair of
antipattern_patterns.py (the regexes) and antipattern_ts.py (the TS scanner).
"""

from __future__ import annotations

import ast
from pathlib import Path

IMPORT_ERRORS = frozenset({"ImportError", "ModuleNotFoundError"})


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
