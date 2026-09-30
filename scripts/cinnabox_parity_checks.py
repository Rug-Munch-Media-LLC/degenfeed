#!/usr/bin/env python3
# pyright: reportMissingImports=false
"""Pure validation checks for the Cinnabox parity gate."""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

SYNC_DIR = Path(__file__).resolve().parent.parent / "sync"
if str(SYNC_DIR) not in sys.path:
    sys.path.insert(0, str(SYNC_DIR))
from cinnabox_jsonc import load

SSH_HOSTS = {"talos", "mcp-bridge"}
LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1"}
LOCAL_COMMANDS = {
    "docker",
    "ollama",
    "litellm",
    "npx",
    "node",
    "python",
    "python3",
    "uv",
    "uvx",
}
EXPECTED_MODEL = "kilocode/space-bunny-alpha"
EXPECTED_SUBAGENT_MODEL = os.environ.get(
    "CINNABOX_SUBAGENT_MODEL", "kilocode/nemotron-3.5-lightning:free"
)
STALE_MODEL_PREFIXES = ("kilo/", "hf-zerogpu/", "litellm/fleet-")
FILE_REFERENCE = re.compile(r"^\{file:([^}]+)\}$")


def url_host(value: str) -> str:
    return (urlsplit(value).hostname or "").lower()


def mcp_errors(document: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    for name, entry in (document.get("mcp") or {}).items():
        if not isinstance(entry, dict):
            errors.append(f"mcp {name}: entry is not an object")
            continue
        if entry.get("type") == "remote":
            host = url_host(str(entry.get("url", "")))
            if host in LOCAL_HOSTS:
                errors.append(f"mcp {name}: loopback URL {host}")
            continue
        command = entry.get("command") or []
        if not command or str(command[0]) != "ssh":
            errors.append(f"mcp {name}: local command is not SSH-wrapped")
            continue
        if (
            "-T" not in command
            or "BatchMode=yes" not in command
            or "ConnectTimeout=10" not in command
        ):
            errors.append(f"mcp {name}: SSH safety options incomplete")
        host_index = next(
            (i for i, item in enumerate(command) if str(item) in SSH_HOSTS), None
        )
        if host_index is None:
            errors.append(f"mcp {name}: SSH host is not an approved Talos route")
        else:
            for item in command[1:host_index]:
                if str(item) in LOCAL_COMMANDS:
                    errors.append(
                        f"mcp {name}: local executable would run on Cinnabox: {item}"
                    )
        environment = entry.get("environment") or {}
        if isinstance(environment, dict) and environment:
            errors.append(f"mcp {name}: local environment overrides are not allowed")
    return errors


def provider_errors(document: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    for name, provider in (document.get("provider") or {}).items():
        options = provider.get("options") if isinstance(provider, dict) else None
        url = options.get("baseURL") if isinstance(options, dict) else None
        if isinstance(url, str) and url_host(url) in LOCAL_HOSTS:
            errors.append(f"provider {name}: loopback baseURL is local-only")
    return errors


def file_reference_errors(node: object) -> list[str]:
    errors: list[str] = []
    if isinstance(node, dict):
        for value in node.values():
            errors.extend(file_reference_errors(value))
    elif isinstance(node, list):
        for value in node:
            errors.extend(file_reference_errors(value))
    elif isinstance(node, str):
        match = FILE_REFERENCE.fullmatch(node)
        if match and not Path(match.group(1)).exists():
            errors.append(f"file reference does not exist: {match.group(1)}")
    return errors


def model_errors(document: dict[str, Any]) -> list[str]:
    errors = [
        f"{key} must be {EXPECTED_MODEL}"
        for key in ("model", "small_model")
        if document.get(key) != EXPECTED_MODEL
    ]
    if document.get("enabled_providers") != ["kilocode"]:
        errors.append("enabled_providers must be [kilocode]")
    return errors


def agent_errors(agent_dir: Path) -> list[str]:
    errors: list[str] = []
    if not agent_dir.is_dir():
        return [f"agent directory missing: {agent_dir}"]
    for path in sorted(agent_dir.glob("*.md")):
        text = path.read_text(encoding="utf-8", errors="replace")
        mode = re.search(r"^mode:\s*(\S+)", text, re.MULTILINE)
        model = re.search(r"^model:\s*(\S+)", text, re.MULTILINE)
        if mode and mode.group(1) == "subagent" and not model:
            errors.append(f"agent {path.name}: subagent has no model")
        if (
            mode
            and mode.group(1) == "subagent"
            and model
            and model.group(1) != EXPECTED_SUBAGENT_MODEL
        ):
            errors.append(
                f"agent {path.name}: expected {EXPECTED_SUBAGENT_MODEL}, got {model.group(1)}"
            )
        if model and any(
            model.group(1).startswith(prefix) for prefix in STALE_MODEL_PREFIXES
        ):
            errors.append(
                f"agent {path.name}: stale/unavailable model {model.group(1)}"
            )
    return errors


def launcher_errors(path: Path) -> list[str]:
    if not path.is_file():
        return [f"launcher missing: {path}"]
    text = path.read_text(encoding="utf-8", errors="replace")
    exec_path = path.parent / "oc-exec.sh"
    if not exec_path.is_file():
        return [f"execution module missing: {exec_path}"]
    exec_text = exec_path.read_text(encoding="utf-8", errors="replace")
    errors: list[str] = []
    if "set -euo pipefail" not in text:
        errors.append("launcher missing set -euo pipefail")
    errors.extend(
        f"execution module missing {item}"
        for item in ("systemd-run", "MemoryMax=", "--nice=10")
        if item not in exec_text
    )
    if "-p Nice=10" in exec_text:
        errors.append("execution module uses unsupported systemd property Nice=10")
    return errors


def validate(config: Path, agents: Path, launcher: Path) -> list[str]:
    document = load(config)

    return (
        model_errors(document)
        + file_reference_errors(document)
        + mcp_errors(document)
        + provider_errors(document)
        + agent_errors(agents)
        + launcher_errors(launcher)
    )
