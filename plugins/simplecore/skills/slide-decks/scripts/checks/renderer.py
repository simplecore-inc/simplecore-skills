#!/usr/bin/env python3
"""The renderer that draws the previews is the version the deck declares.

A builder pinned in a package file and a preview renderer pinned nowhere drift
apart: one deck's previews, the PDF stitched from them and every check that
measures an image ran three minor versions behind for months, and a marker
offset tuned against the old renderer was wrong the moment anyone rendered on
the current one. So the deck declares the command and the lowest version it is
measured against, and this reads it before a render and after one.

Config: `renderer.command` and `renderer.minVersion`. `$SLIDEGLANCE_CLI`
overrides the command for one run. `$SLIDEGLANCE_BIN`, which names the
SlideGlance binary the deck server is started from, overrides it too when the
declared command is that binary (`slideglance`, or the deck's `tool.binary`),
so a session pointed at a locally built binary measures the renderer it renders
with; a renderer that is some other program keeps its declared command.
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
from collections.abc import Mapping
from pathlib import Path
from subprocess import SubprocessError

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.sgmcp import BIN_ENV, BINARY_NAMES  # noqa: E402

CLI_ENV = "SLIDEGLANCE_CLI"

VERSION = re.compile(r"(\d+\.\d+\.\d+)")


def parts(version: str) -> tuple[int, ...]:
    return tuple(int(n) for n in re.findall(r"\d+", version)[:3])


def declaration(deck: DeckConfig) -> tuple[str, str]:
    spec = deck.require("renderer", "the preview renderer's command and lowest version")
    if not isinstance(spec, dict) or not spec.get("command") or not spec.get("minVersion"):
        raise ConfigError(f"deck `{deck.name}` `renderer` must name `command` and `minVersion`")
    return str(spec["command"]), str(spec["minVersion"])


def is_tool_binary(command: str, deck: DeckConfig) -> bool:
    """The declared command is the SlideGlance binary the deck server runs."""
    declared = deck.get("tool.binary")
    return Path(command).name in BINARY_NAMES or bool(declared) and command == str(declared)


def resolve(command: str, deck: DeckConfig, env: Mapping[str, str]) -> tuple[str, str]:
    """(the command to run, where it came from)."""
    if env.get(CLI_ENV):
        return env[CLI_ENV], f"${CLI_ENV}"
    if env.get(BIN_ENV) and is_tool_binary(command, deck):
        return env[BIN_ENV], f"${BIN_ENV}"
    return command, "renderer.command"


def judge(found: str, wanted: str) -> str | None:
    """The reason the reported version fails, None when it passes."""
    m = VERSION.search(found)
    if not m:
        return f"the renderer reports no version (「{found[:60]}」)"
    if parts(m.group(1)) < parts(wanted):
        return f"the renderer is {m.group(1)}, and the deck is measured against {wanted} or later"
    return None


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0]).parse_args(argv)
    deck = cli.deck_config(args)
    declared, wanted = declaration(deck)
    command, source = resolve(declared, deck, os.environ)
    try:
        out = subprocess.run([command, "--version"], capture_output=True, text=True, timeout=30,
                             cwd=deck.root)
    except (OSError, SubprocessError) as e:
        print(f"renderer: ✖ could not run {command} (from {source}): {e}")
        return 1
    found = (out.stdout + out.stderr).strip()
    why = judge(found, wanted)
    if why:
        print(f"renderer: ✖ {why}; previews drawn by it misplace what every image check measures")
        return 1
    print(f"renderer: {Path(command).name} {VERSION.search(found).group(1)} (declared {wanted} or later; "
          f"command from {source})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
