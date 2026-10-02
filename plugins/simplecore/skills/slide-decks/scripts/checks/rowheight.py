#!/usr/bin/env python3
"""Boxes standing side by side must be the same height.

A row of cards reads as one row only when its boxes share a bottom edge; a card
that ends early beside a taller one reads as a mistake, however the content
divides. A builder lays each card out from its own text, so the defect appears
whenever one column carries a line more than its neighbours and nothing
stretches it.

This reads the built `.pptx`: every group whose own frame is drawn (a visible
fill or outline spanning the group) and every visible rectangle outside a
group is a box; boxes on the same top edge that overlap in neither axis are a
row, and a row whose heights differ by more than the tolerance is reported
with the page, the top edge and the first words of each box. A box that spans
others on its top edge is their wrapper, not their neighbour. A small square
whose text is a bare number is a marker plate laid over a picture, not a box
in a row, and is left out.

Reads the deck's built `.pptx` (`output`); refuses one older than the deck.

Config (`checks.rowheight`, optional): `topTolerance` (1 pt), `heightTolerance`
(1.5 pt), `markerSide` (16 pt).

    rowheight.py          # every slide
    rowheight.py 9 12     # only these slides
"""
from __future__ import annotations

import re
import sys
from re import Match
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.config import DeckConfig  # noqa: E402
from bidkit.pptxread import EXT, OFF, TEXT, Built  # noqa: E402

PT_PER_PX = 0.75
TOP_TOLERANCE, HEIGHT_TOLERANCE, MARKER_SIDE = 1.0, 1.5, 16.0
GROUP = re.compile(r"<p:grpSp>(.*?)</p:grpSp>", re.S)
SHAPE = re.compile(r"<p:sp>(.*?)</p:sp>", re.S)
SPPR = re.compile(r"<p:spPr>(.*?)</p:spPr>", re.S)


def visible(pr: str) -> bool:
    return ("<a:solidFill>" in pr and "<a:alpha" not in pr) or bool(re.search(r"<a:ln\b[^/>]*>", pr))


def draws_frame(body: str, ext: Match, slack_emu: float) -> bool:
    """Does one visible rectangle in the group span the group's own extent?"""
    for m in SPPR.finditer(body):
        pr = m.group(1)
        e = EXT.search(pr)
        if (e and visible(pr) and abs(int(e.group(1)) - int(ext.group(1))) <= slack_emu
                and abs(int(e.group(2)) - int(ext.group(2))) <= slack_emu):
            return True
    return False


def boxes(xml: str, built: Built) -> list[tuple[float, float, float, float, str]]:
    """(x, y, w, h, words) in pt of every framed group and visible rectangle."""
    pt = built.emu_per_px / PT_PER_PX      # EMU per pt

    def box(off, ext, body):
        x, y = int(off.group(1)) / pt, int(off.group(2)) / pt
        w, h = int(ext.group(1)) / pt, int(ext.group(2)) / pt
        return x, y, w, h, " ".join(TEXT.findall(body)).strip()[:18]

    out = []
    for m in GROUP.finditer(xml):
        body = m.group(1)
        off, ext = OFF.search(body), EXT.search(body)
        if off and ext and draws_frame(body, ext, pt):
            out.append(box(off, ext, body))
    flat = GROUP.sub("", xml)
    for m in SHAPE.finditer(flat):
        sppr = SPPR.search(m.group(1))
        if not sppr:
            continue
        off, ext = OFF.search(sppr.group(1)), EXT.search(sppr.group(1))
        if visible(sppr.group(1)) and off and ext:
            out.append(box(off, ext, m.group(1)))
    return out


def is_marker(b, side: float) -> bool:
    _, _, w, h, words = b
    return w <= side and abs(w - h) <= 1.0 and words.isdigit()


def rows(items, top_tol: float = TOP_TOLERANCE):
    """(top, [boxes]) for boxes sharing a top edge and standing beside each other."""
    by_top: dict[float, list] = defaultdict(list)
    for b in sorted(items, key=lambda b: (b[1], b[0])):
        k = next((t for t in by_top if abs(t - b[1]) <= top_tol), None)
        by_top[b[1] if k is None else k].append(b)
    for top, group in by_top.items():
        inner = [b for b in group
                 if not any(o is not b and o[2] < b[2] - top_tol and o[0] >= b[0] - top_tol
                            and o[0] + o[2] <= b[0] + b[2] + top_tol for o in group)]
        beside: list = []
        for b in sorted(inner, key=lambda b: b[0]):
            if beside and b[0] < beside[-1][0] + beside[-1][2] - top_tol:
                continue
            beside.append(b)
        if len(beside) > 1:
            yield top, beside


def check(built: Built, deck: DeckConfig, only: set[int] | None = None) -> list[str]:
    cfg = deck.section("checks.rowheight")
    top_tol = float(cfg.get("topTolerance", TOP_TOLERANCE))
    h_tol = float(cfg.get("heightTolerance", HEIGHT_TOLERANCE))
    side = float(cfg.get("markerSide", MARKER_SIDE))
    found = []
    for n in sorted(built.slides):
        if only and n not in only:
            continue
        items = [b for b in boxes(built.slides[n], built) if not is_marker(b, side)]
        for top, beside in rows(items, top_tol):
            heights = [b[3] for b in beside]
            if max(heights) - min(heights) > h_tol:
                cells = " · ".join(f"{b[3]:.0f}pt 「{b[4]}」" for b in beside)
                found.append(f"slide {n} at y={top:.0f}pt: {cells}")
    return found


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    ap = cli.parser(__doc__.splitlines()[0])
    ap.add_argument("slides", nargs="*", type=int, help="only these slide numbers")
    args = ap.parse_args(argv)
    deck = cli.deck_config(args)
    built = Built.for_deck(deck)
    found = check(built, deck, set(args.slides) or None)
    print(f"rowheight: {len(built.slides)} slides of {built.path.name}, {len(found)} rows of unequal boxes")
    for line in found:
        print(f"  ✖ {line}")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
