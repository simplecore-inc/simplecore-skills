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
whose viewBox width is one of `figures.boards`, or a `.png` capture. A board
with a second placement (`"520-pair"` beside `"520"`) lets the figure stand at
either placed width. A capture
has no board, so it takes the placed width (one of the boards' placed widths,
the text block or a column) nearest its box, × placeScale, and its height
follows the image's own pixel ratio: a screen printed at the full measure reads
heavier than every diagram beside it.

The scale is set per deck. A figure prints at `figures.placeScale` (0.9 on a
document deck, 1.0 on a slide deck). Only a figure that does not fit its slot at
placeScale may print at `figures.oversizeScale` instead. "Does not fit" means: the
box at placeScale is taller than the slot height its board gives
(`figures.slots`, {board units: slot height px}) or wider than the board's
placed width. A board with no slot height has no oversize figures. Any other
scale is reported unless `checks.figbox.exceptions` names the file.

A figure the check cannot measure is reported, never passed: a placed file
that does not exist, an SVG with no viewBox or whose width is on no declared
board, and a `.png` that is not a PNG it can read are findings, and a use with
no `w` and `h` is counted as not measured. The summary says how many figures
were measured, so a deck whose figures all went unread does not print the line
a clean deck prints.

Config: `figures.boards` ({board units: placed px}, required), `kind`,
`figures.placeScale`, `figures.oversizeScale` (none), `figures.slots` ({}),
`checks.figbox.exceptions` ({file name: reason}), `checks.figbox.tolerance` (1.5 px).
"""
from __future__ import annotations

import re
import struct
import sys
from dataclasses import dataclass, field
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


DEFAULT_PLACE = {"document": 0.9, "slides": 1.0}


def viewbox(svg: Path) -> tuple[float, float] | None:
    """(width, height) of an SVG's viewBox, None when it declares none."""
    m = VIEWBOX.search(svg.read_text(encoding="utf-8", errors="replace")[:4000])
    return (float(m.group(1)), float(m.group(2))) if m else None


BOARD_KEY = re.compile(r"^\s*(\d+(?:\.\d+)?)")


def board_units(key) -> float | None:
    """The drawing width a board key names: `520` and its variant `520-pair` both name 520."""
    m = BOARD_KEY.match(str(key))
    return float(m.group(1)) if m else None


def placements(svg: Path, boards: dict) -> list[tuple[str, float, float]]:
    """[(board key, placed width, height at full placement)] for every placement of the SVG's board.

    A board placed in a second slot (`"520-pair"` beside `"520"`) is one board with two
    placements, and a figure may stand at either."""
    box = viewbox(svg)
    if box is None:
        return []
    vw, vh = box
    out = []
    for k, px in boards.items():
        units = board_units(k)
        if units is not None and abs(units - vw) < 0.5:
            out.append((str(k), float(px), vh * float(px) / vw))
    return out


def placement_raster(path: Path, w: float, boards: dict, scales: list[float]) -> tuple[str, float, float] | None:
    """A capture has no board: it takes the placed width nearest its box at any allowed scale."""
    head = path.read_bytes()[:24]
    if path.suffix.lower() != ".png" or len(head) < 24 or head[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    pw, ph = struct.unpack(">II", head[16:24])
    key, placed = min(((k, float(px)) for k, px in boards.items()),
                      key=lambda kp: min(abs(w - kp[1] * s) for s in scales))
    return key, placed, placed * ph / pw


def fits(box: tuple[float, float], placed: float, slot_h: float | None, tol: float) -> bool:
    """A box fits its slot when it is no wider than the placed width and no taller than the slot."""
    return box[0] <= placed + tol and (slot_h is None or box[1] <= slot_h + tol)


def allowed(place: tuple[str, float, float], slots: dict, scale: float, over: float | None,
            tol: float) -> list[tuple[float, float]]:
    """The boxes a figure may print at: placeScale, or oversizeScale when placeScale does not fit."""
    key, placed, full_h = place
    at = lambda s: (placed * s, full_h * s)  # noqa: E731
    slot_h = slots.get(key)
    if slot_h is None and board_units(key) is not None:
        slot_h = slots.get(f"{board_units(key):g}")
    slot_h = float(slot_h) if slot_h is not None else None
    if over is None or fits(at(scale), placed, slot_h, tol):
        return [at(scale)]
    return [at(over)]


@dataclass
class Survey:
    """What the check read: the figures it measured and the ones it could not."""
    measured: int = 0
    bad: list = field(default_factory=list)        # [(page, file, box found, box wanted)]
    missing: list = field(default_factory=list)    # [(page, src)] placed and absent
    unplaced: list = field(default_factory=list)   # [(page, file, why)] on no declared board
    unsized: list = field(default_factory=list)    # [(page, file)] a use with no w and h
    excepted: int = 0


def survey(reader: DeckReader, deck: DeckConfig) -> Survey:
    """Every figure use on every page, measured where it can be and reported where it cannot."""
    boards = deck.require("figures.boards", "the placed width of each board")
    kind = str(deck.get("kind", "document"))
    scale = float(deck.get("figures.placeScale", DEFAULT_PLACE.get(kind, 0.9)))
    over = deck.get("figures.oversizeScale", None)
    over = float(over) if over is not None else None
    slots = deck.get("figures.slots", {}) or {}
    exceptions = deck.get("checks.figbox.exceptions", {}) or {}
    tol = float(deck.get("checks.figbox.tolerance", 1.5))
    roles = set()
    if reader.vocab is not None:
        roles = set(reader.vocab.data.get("roles", {}).get("figures", []) or [])
    roles = roles or {"figure"}
    base = deck.resolve(deck.require("dir", "the deck folder"))
    out = Survey()
    for page in reader.slides():
        for u in page.uses:
            src = str(u.attrs.get("src", ""))
            if u.tag not in roles or not src.lower().endswith((".svg", ".png")):
                continue
            path = Path(src) if Path(src).is_absolute() else base / src
            if not path.is_file():
                out.missing.append((page.label, src))
                continue
            w, h = _px(u.attrs.get("w", "")), _px(u.attrs.get("h", ""))
            if w is None or h is None:
                out.unsized.append((page.label, path.name))
                continue
            if path.name in exceptions:
                out.excepted += 1
                continue
            if path.suffix.lower() == ".svg":
                places = placements(path, boards)
                if not places:
                    box = viewbox(path)
                    why = ("no viewBox" if box is None else
                           f"its viewBox is {box[0]:g} wide, on none of the boards "
                           + " · ".join(str(k) for k in boards))
                    out.unplaced.append((page.label, path.name, why))
                    continue
            else:
                place = placement_raster(path, w, boards, [s for s in (scale, over) if s is not None])
                if place is None:
                    out.unplaced.append((page.label, path.name, "not a PNG this check can read"))
                    continue
                places = [place]
            out.measured += 1
            boxes = [b for place in places for b in allowed(place, slots, scale, over, tol)]
            if not any(abs(w - bw) <= tol and abs(h - bh) <= tol for bw, bh in boxes):
                want = boxes[0]
                out.bad.append((page.label, path.name, f"{w:g}×{h:g}", f"{want[0]:.0f}×{want[1]:.0f}"))
    return out


def find(reader: DeckReader, deck: DeckConfig) -> list[tuple[str, str, str, str]]:
    """[(page, src, found, wanted)] for each figure whose box differs from its picture."""
    return survey(reader, deck).bad


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0]).parse_args(argv)
    deck = cli.deck_config(args)
    with cli.open_reader(deck) as reader:
        s = survey(reader, deck)
    print(f"figbox: {s.measured} figures measured, {len(s.bad)} whose box is not the printed picture, "
          f"{len(s.missing)} placed files missing, {len(s.unplaced)} on no declared board"
          + (f", {s.excepted} excepted" if s.excepted else ""))
    for page, name, found, want in s.bad:
        print(f"  ✖ {page}: {name} box {found}, prints {want}")
    for page, src in s.missing:
        print(f"  ✖ {page}: {src} is placed and does not exist")
    for page, name, why in s.unplaced:
        print(f"  ✖ {page}: {name} cannot be measured: {why}")
    if s.unsized:
        print(f"  ⚠ {len(s.unsized)} figure uses carry no `w` and `h` and were not measured: "
              + ", ".join(f"{p} {n}" for p, n in s.unsized[:6]) + (" …" if len(s.unsized) > 6 else ""))
    return 1 if s.bad or s.missing or s.unplaced else 0


if __name__ == "__main__":
    sys.exit(main())
