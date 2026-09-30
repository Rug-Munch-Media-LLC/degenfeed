#!/usr/bin/env python3
"""Small dependency-free JSONC reader shared by the Cinnabox sync tools."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

__all__ = ["dump", "load", "loads", "provider_host"]


def _strip_comments(source: str) -> str:
    output: list[str] = []
    index = 0
    in_string = False
    escaped = False
    while index < len(source):
        char = source[index]
        next_char = source[index + 1] if index + 1 < len(source) else ""
        if in_string:
            output.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            index += 1
            continue
        if char == '"':
            in_string = True
            output.append(char)
            index += 1
            continue
        if char == "/" and next_char == "/":
            index += 2
            while index < len(source) and source[index] not in "\r\n":
                index += 1
            continue
        if char == "/" and next_char == "*":
            index += 2
            while index + 1 < len(source) and source[index : index + 2] != "*/":
                index += 1
            index += 2
            continue
        output.append(char)
        index += 1
    return "".join(output)


def _remove_trailing_commas(source: str) -> str:
    output: list[str] = []
    index = 0
    in_string = False
    escaped = False
    while index < len(source):
        char = source[index]
        if in_string:
            output.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            index += 1
            continue
        if char == '"':
            in_string = True
            output.append(char)
            index += 1
            continue
        if char == ",":
            lookahead = index + 1
            while lookahead < len(source) and source[lookahead].isspace():
                lookahead += 1
            if lookahead < len(source) and source[lookahead] in "}]":
                index += 1
                continue
        output.append(char)
        index += 1
    return "".join(output)


def loads(source: str) -> dict[str, Any]:
    """Parse JSONC while preserving URL and escaped-string contents."""
    return json.loads(_remove_trailing_commas(_strip_comments(source)))


def load(path: Path) -> dict[str, Any]:
    return loads(path.read_text(encoding="utf-8"))


def provider_host() -> str:
    configured = os.environ.get("CINNABOX_PROVIDER_HOST")
    if configured:
        return configured
    values = Path("/root/.config/opencode/fleet-values.cinnabox.json")
    try:
        data = json.loads(values.read_text(encoding="utf-8"))
        return str(data.get("INTERNAL_HOST") or "talos")
    except (OSError, ValueError, TypeError):
        return "talos"


def dump(document: dict[str, Any], banner: str = "") -> str:
    prefix = f"{banner.rstrip()}\n" if banner else ""
    return prefix + json.dumps(document, indent=2, ensure_ascii=False) + "\n"
