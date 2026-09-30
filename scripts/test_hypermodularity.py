#!/usr/bin/env python3
"""Tests for the hypermodularity gate."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

GATE = Path(__file__).with_name("check-hypermodularity.py")


class HypermodularityGateTests(unittest.TestCase):
    def run_gate(self, root: Path, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(GATE), "--repo", str(root), *args],
            text=True,
            capture_output=True,
            check=False,
        )

    def test_new_file_over_hard_cap_fails(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "big.py").write_text("x = 1\n" * 201)
            result = self.run_gate(root, "--baseline", "baseline.json")
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("hard cap", result.stdout)

    def test_file_at_hard_cap_passes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "ok.py").write_text("x = 1\n" * 200)
            result = self.run_gate(root, "--baseline", "baseline.json")
            self.assertEqual(result.returncode, 0, result.stdout)

    def test_long_function_and_marker_fail(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "bad.py").write_text("def f():\n" + "    x = 1\n" * 50 + "# HACK\n")
            result = self.run_gate(root, "--baseline", "baseline.json")
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("max 50", result.stdout)
            self.assertIn("marker", result.stdout)

    def test_grandfathered_deficit_is_reported_without_failing(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "legacy.py").write_text("x = 1\n" * 250)
            created = self.run_gate(
                root, "--baseline", "baseline.json", "--update-baseline"
            )
            self.assertEqual(created.returncode, 0, created.stdout)
            result = self.run_gate(root, "--baseline", "baseline.json")
            self.assertEqual(result.returncode, 0, result.stdout)
            self.assertIn("DEFICIT", result.stdout)
            self.assertIn("excess_lines=50", result.stdout)

    def test_baseline_only_allows_shrinking(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            baseline = root / "baseline.json"
            (root / "file.py").write_text("x = 1\n" * 201)
            first = self.run_gate(
                root, "--baseline", "baseline.json", "--update-baseline"
            )
            self.assertEqual(first.returncode, 0, first.stdout)
            (root / "file.py").write_text("x = 1\n" * 202)
            second = self.run_gate(
                root, "--baseline", "baseline.json", "--update-baseline"
            )
            self.assertNotEqual(second.returncode, 0)
            self.assertEqual(json.loads(baseline.read_text())["file.py"]["lines"], 201)

    def test_nested_clone_does_not_gate_the_parent(self) -> None:
        """A nested git clone is untracked by definition and must be ignored.

        Regression: the gate walked `root.rglob("*")`, which descends into a
        nested clone's WORKING TREE (SKIP_DIRS excludes ".git" but not the
        checked-out sources beside it). One untracked nested worktree added 385
        violations / 24,963 excess lines and failed a repo that had not changed.
        """
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            subprocess.run(["git", "init", "-q", str(root)], check=True)
            (root / "fine.py").write_text("x = 1\n" * 10)
            subprocess.run(["git", "-C", str(root), "add", "fine.py"], check=True)
            created = self.run_gate(
                root, "--baseline", "baseline.json", "--update-baseline"
            )
            self.assertEqual(created.returncode, 0, created.stdout)

            # A nested clone whose files are ALL violations.
            nested = root / "vendor" / "subproject"
            nested.mkdir(parents=True)
            subprocess.run(["git", "init", "-q", str(nested)], check=True)
            for index in range(5):
                (nested / f"god{index}.py").write_text("x = 1\n" * 400)
            subprocess.run(["git", "-C", str(nested), "add", "-A"], check=True)

            result = self.run_gate(root, "--baseline", "baseline.json")
            self.assertEqual(result.returncode, 0, result.stdout)
            self.assertIn("1 files checked", result.stdout)
            self.assertNotIn("god", result.stdout)
            self.assertIn("DEFICIT none", result.stdout)

    def test_untracked_scratch_is_not_gated(self) -> None:
        """Untracked files are not part of the commit, so they must not gate it."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            subprocess.run(["git", "init", "-q", str(root)], check=True)
            (root / "kept.py").write_text("x = 1\n" * 10)
            subprocess.run(["git", "-C", str(root), "add", "kept.py"], check=True)
            (root / "scratch.py").write_text("x = 1\n" * 500)
            result = self.run_gate(root, "--baseline", "baseline.json")
            self.assertEqual(result.returncode, 0, result.stdout)
            self.assertIn("1 files checked", result.stdout)

    def test_non_git_tree_falls_back_to_the_filesystem_walk(self) -> None:
        """The documented fallback must still gate a plain, non-git directory."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "big.py").write_text("x = 1\n" * 201)
            result = self.run_gate(root, "--baseline", "baseline.json")
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("hard cap", result.stdout)


if __name__ == "__main__":
    unittest.main()
