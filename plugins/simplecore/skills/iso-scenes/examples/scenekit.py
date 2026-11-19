"""Reach the iso-scenes library from a figure module.

The library lives beside the svg-diagrams skill; its place is derived from the
toolkit the build already found, never from a home-directory path.
"""
import sys
from pathlib import Path

from common import toolkit_dir

sys.path.insert(0, str(Path(toolkit_dir()).resolve().parents[1] / "iso-scenes" / "scripts"))
from isoscene import Scene, plant, power  # noqa: E402,F401
