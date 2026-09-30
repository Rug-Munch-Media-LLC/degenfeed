#!/usr/bin/env python3
# pyright: reportMissingImports=false
"""Backtest Cinnabox OpenCode invariants before a sync is allowed to land."""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))
from cinnabox_parity_checks import EXPECTED_MODEL, EXPECTED_SUBAGENT_MODEL, validate


def _selftest() -> int:
    clean = {
        "model": EXPECTED_MODEL,
        "small_model": EXPECTED_MODEL,
        "enabled_providers": ["kilocode"],
        "provider": {"remote": {"options": {"baseURL": "https://api.example.test/v1"}}},
        "mcp": {"remote": {"type": "remote", "url": "https://mcp.example.test/mcp"}},
    }
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        config = root / "opencode.jsonc"
        agents = root / "agents"
        launcher = root / "oc-session-router.sh"
        agents.mkdir()
        config.write_text(json.dumps(clean), encoding="utf-8")
        (agents / "probe.md").write_text(
            f"---\nmode: subagent\nmodel: {EXPECTED_SUBAGENT_MODEL}\n---\n",
            encoding="utf-8",
        )
        launcher.write_text(
            "#!/usr/bin/env bash\nset -euo pipefail\n", encoding="utf-8"
        )
        (root / "oc-exec.sh").write_text(
            "systemd-run --nice=10 -p MemoryMax=2500M\n", encoding="utf-8"
        )
        if validate(config, agents, launcher):
            print(
                "cinnabox-parity-gate: clean self-test unexpectedly failed",
                file=sys.stderr,
            )
            return 1
        broken = dict(clean)
        broken["mcp"] = {"bad": {"type": "local", "command": ["python3", "server.py"]}}
        config.write_text(json.dumps(broken), encoding="utf-8")
        if not validate(config, agents, launcher):
            print(
                "cinnabox-parity-gate: violation self-test unexpectedly passed",
                file=sys.stderr,
            )
            return 1
    print("cinnabox-parity-gate: self-test PASS")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path)
    parser.add_argument("--agents", type=Path)
    parser.add_argument("--launcher", type=Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        return _selftest()
    if not args.config or not args.agents or not args.launcher:
        parser.error("--config, --agents, and --launcher are required")
    errors = validate(args.config, args.agents, args.launcher)
    if errors:
        for error in errors:
            print(f"cinnabox-parity-gate: ERROR: {error}", file=sys.stderr)
        return 1
    print("cinnabox-parity-gate: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
