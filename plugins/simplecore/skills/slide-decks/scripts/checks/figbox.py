#!/usr/bin/env python3
"""A document figure whose box is not the size of the picture it prints.

A figure prints at its board placement × `figures.placeScale`, centred. When
the box keeps the placed width and the picture is letterboxed inside it, the
box selects, frames and measures wider than anything the reader sees, and in a
column layout the column holds paper the text beside it could use. So the box
is the printed picture: `w` = the board's placed width × placeScale, and `h` =
the SVG's viewBox height × (placed width ÷ board width) × placeScale.

Read from the printed model: every use of a figure component (the kit
vocabulary's `roles.figures`, default `figure`) with an `src` naming an `.svg`
whose viewBox width is one of `figures.boards`.

Config: `figures.boards` ({board units: placed px}, required), `figures.placeScale`
(0.9), `checks.figbox.tolerance` (1.5 px).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.config import DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader  # noqa: E402

VIEWBOX = re.compile(r'viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"')
PX = re.compile(r"^\s*([\d.]+)\s*(px)?\s*$")


def _px(value) -> float | None:
    m = PX.match(str(value))
    return float(m.group(1)) if m else None


def expected(svg: Path, boards: dict, scale: float) -> tuple[float, float] | None:
    m = VIEWBOX.search(svg.read_text(encoding="utf-8", errors="replace")[:4000])
    if not m:
        return None
    vw, vh = float(m.group(1)), float(m.group(2))
    placed = next((float(px) for units, px in boards.items() if abs(float(units) - vw) < 0.5), None)
    if placed is None:
        return None
    return placed * scale, vh * placed / vw * scale


def find(reader: DeckReader, deck: DeckConfig) -> list[tuple[str, str, str, str]]:
    """[(page, src, found, wanted)] for each figure whose box differs from its picture."""
    boards = deck.require("figures.boards", "the placed width of each board")
    scale = float(deck.get("figures.placeScale", 0.9))
    tol = float(deck.get("checks.figbox.tolerance", 1.5))
    roles = set()
    if reader.vocab is not None:
        roles = set(reader.vocab.data.get("roles", {}).get("figures", []) or [])
    roles = roles or {"figure"}
    base = deck.resolve(deck.require("dir", "the deck folder"))
    bad = []
    for page in reader.slides():
        for u in page.uses:
            src = str(u.attrs.get("src", ""))
            if u.tag not in roles or not src.endswith(".svg"):
                continue
            path = Path(src) if Path(src).is_absolute() else base / src
            if not path.is_file():
                continue
            want = expected(path, boards, scale)
            w, h = _px(u.attrs.get("w", "")), _px(u.attrs.get("h", ""))
            if want is None or w is None or h is None:
                continue
            if abs(w - want[0]) > tol or abs(h - want[1]) > tol:
                bad.append((page.label, path.name, f"{w:g}×{h:g}", f"{want[0]:.0f}×{want[1]:.0f}"))
    return bad


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0]).parse_args(argv)
    deck = cli.deck_config(args)
    with cli.open_reader(deck) as reader:
        bad = find(reader, deck)
    print(f"figbox: {len(bad)} figures whose box is not the printed picture")
    for page, name, found, want in bad:
        print(f"  ✖ {page}: {name} box {found}, prints {want}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
