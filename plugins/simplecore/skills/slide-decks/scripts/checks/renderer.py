#!/usr/bin/env python3
"""The renderer that draws the previews is the version the deck declares.

A builder pinned in a package file and a preview renderer pinned nowhere drift
apart: one deck's previews, the PDF stitched from them and every check that
measures an image ran three minor versions behind for months, and a marker
offset tuned against the old renderer was wrong the moment anyone rendered on
the current one. So the deck declares the command and the lowest version it is
measured against, and this reads it before a render and after one.

Config: `renderer.command` and `renderer.minVersion`. `$SLIDEGLANCE_CLI`
overrides the command for one run.
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
from subprocess import SubprocessError
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402

VERSION = re.compile(r"(\d+\.\d+\.\d+)")


def parts(version: str) -> tuple[int, ...]:
    return tuple(int(n) for n in re.findall(r"\d+", version)[:3])


def declaration(deck: DeckConfig) -> tuple[str, str]:
    spec = deck.require("renderer", "the preview renderer's command and lowest version")
    if not isinstance(spec, dict) or not spec.get("command") or not spec.get("minVersion"):
        raise ConfigError(f"deck `{deck.name}` `renderer` must name `command` and `minVersion`")
    return str(spec["command"]), str(spec["minVersion"])


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
    command, wanted = declaration(deck)
    command = os.environ.get("SLIDEGLANCE_CLI", command)
    try:
        out = subprocess.run([command, "--version"], capture_output=True, text=True, timeout=30,
                             cwd=deck.root)
    except (OSError, SubprocessError) as e:
        print(f"renderer: ✖ could not run {command}: {e}")
        return 1
    found = (out.stdout + out.stderr).strip()
    why = judge(found, wanted)
    if why:
        print(f"renderer: ✖ {why}; previews drawn by it misplace what every image check measures")
        return 1
    print(f"renderer: {Path(command).name} {VERSION.search(found).group(1)} (declared {wanted} or later)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
