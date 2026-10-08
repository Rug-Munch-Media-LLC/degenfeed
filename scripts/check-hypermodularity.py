#!/usr/bin/env python3
"""Fleet hypermodularity gate: bounded modules, functions, and clean boundaries."""

from __future__ import annotations

import argparse
import json
import logging
import subprocess
import sys
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

sys.path.insert(0, str(Path(__file__).resolve().parent))
from hypermodularity_metrics import debt_for, empty_debt, metric, total_debt  # noqa: E402

HARD_LINES = 200
SOFT_LINES = 150
MAX_FUNCTION_LINES = 50
MAX_PARAMETERS = 5
CODE_SUFFIXES = {
    ".py",
    ".sh",
    ".bash",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".go",
    ".rs",
    ".java",
    ".rb",
}
SKIP_DIRS = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "__pycache__",
    "dist",
    "build",
    ".mypy_cache",
    ".ruff_cache",
    ".vite",
    ".next",
    "coverage",
    "vendor",
}


def _tracked_files(root: Path) -> set[str] | None:
    """Repo-relative paths of files git tracks, or None outside a git tree.

    Returns None when `root` is not inside a git work tree (or git is missing),
    so the caller falls back to the filesystem walk.
    """
    try:
        result = subprocess.run(
            [
                "git",
                "ls-files",
                "-z",
                "--cached",
                "--",
                "*.py",
                "*.sh",
                "*.bash",
                "*.js",
                "*.jsx",
                "*.ts",
                "*.tsx",
                "*.go",
                "*.rs",
                "*.java",
                "*.rb",
            ],
            cwd=root,
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError as exc:
        logger.debug("OSError in git_ls_files: %s", exc)
        return None
    if result.returncode != 0:
        return None
    entries = {name for name in result.stdout.split("\0") if name}
    # An empty result from a real repo means "no tracked code files", which is
    # still authoritative. A non-repo makes git fail (returncode != 0) instead.
    return entries


def files_under(root: Path, explicit: list[str] | None) -> list[Path]:
    if explicit:
        return [Path(item).resolve() for item in explicit]
    tracked = _tracked_files(root)
    if tracked is not None:
        # Authoritative: only files git tracks. A nested clone is untracked by
        # definition, so it cannot contribute violations or baseline debt.
        return [p for name in sorted(tracked) if (p := root / name).is_file()]
    # Documented fallback for a non-git tree: walk the filesystem and apply
    # SKIP_DIRS. Less precise (it cannot see a nested clone's boundary) but it
    # keeps the gate usable on a plain directory or a tarball extraction.
    return [
        p
        for p in root.rglob("*")
        if p.is_file()
        and p.suffix in CODE_SUFFIXES
        and not any(part in SKIP_DIRS for part in p.parts)
    ]


def failures_for(path: Path, root: Path, old: dict[str, Any]) -> list[str]:
    rel = path.relative_to(root).as_posix()
    current = metric(path)
    previous = old.get(rel, {})
    errors = []
    if current["lines"] > HARD_LINES and current["lines"] > previous.get("lines", 0):
        errors.append(f"{rel}: {current['lines']} lines exceeds hard cap {HARD_LINES}")
    for key, value in current.items():
        if (
            key.startswith("fn:")
            and value > MAX_FUNCTION_LINES
            and value > previous.get(key, 0)
        ):
            errors.append(
                f"{rel}: {key[3:]} has {value} lines (max {MAX_FUNCTION_LINES})"
            )
    if current["parameters"] > MAX_PARAMETERS and current["parameters"] > previous.get(
        "parameters", 0
    ):
        errors.append(
            f"{rel}: {current['parameters']} parameters (max {MAX_PARAMETERS})"
        )
    if current["markers"] > previous.get("markers", 0):
        errors.append(f"{rel}: monkeypatch/HACK/WORKAROUND marker added")
    return errors


def deficit_for(path: Path, root: Path, old: dict[str, Any]) -> dict[str, int]:
    rel = path.relative_to(root).as_posix()
    if rel not in old:
        return empty_debt()
    return debt_for(
        metric(path),
        hard_lines=HARD_LINES,
        max_function_lines=MAX_FUNCTION_LINES,
        max_parameters=MAX_PARAMETERS,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default=".")
    parser.add_argument(
        "--baseline", default="fleet/gates/hypermodularity-baseline.json"
    )
    parser.add_argument("--files", nargs="*")
    parser.add_argument("--update-baseline", action="store_true")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    root = Path(args.repo).resolve()
    baseline_path = root / args.baseline
    old = json.loads(baseline_path.read_text()) if baseline_path.exists() else {}
    targets = files_under(root, args.files)
    if args.update_baseline:
        payload = {p.relative_to(root).as_posix(): metric(p) for p in targets}
        if old and any(
            v > old.get(k, {}).get("lines", 0) for k, v in payload.items() if k in old
        ):
            print("hypermodularity: refusing to grow the baseline", file=sys.stderr)
            return 1
        baseline_path.write_text(json.dumps(payload, indent=1, sort_keys=True) + "\n")
        print(f"hypermodularity baseline updated: {len(payload)} files")
        return 0
    errors = [error for path in targets for error in failures_for(path, root, old)]
    summary = total_debt([deficit_for(path, root, old) for path in targets])
    for error in errors:
        print(f"hypermodularity: FAIL {error}")
    if summary and any(summary.values()):
        print(
            "hypermodularity: DEFICIT "
            + " ".join(f"{key}={value}" for key, value in summary.items())
        )
    else:
        print("hypermodularity: DEFICIT none")
    if args.report:
        args.report.write_text(
            json.dumps({"violations": errors, "deficit": summary}, indent=2) + "\n"
        )
    print(f"hypermodularity: {len(targets)} files checked; {len(errors)} violations")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
