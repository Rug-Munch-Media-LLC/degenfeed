"""antipattern_patterns.py — the anti-pattern gate's rule configuration.

One purpose: WHAT to detect and WHAT to skip. Regexes live here (not in the
scanners) so a rule change is a one-file edit and the scanner modules stay
logic-only. SKIP_DIRS are cache/vendored trees; REEXPORT_ALLOWLIST are
deliberate public re-export surfaces (the wildcard rule exempts them).

Split from antipattern_rules.py (2026-10-31): the rules module had grown past
the 200-line structure gate once the TS scanner and wildcard helpers landed
beside the scanner. See also antipattern_wildcard.py, antipattern_ts.py.
"""

from __future__ import annotations

import re

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
