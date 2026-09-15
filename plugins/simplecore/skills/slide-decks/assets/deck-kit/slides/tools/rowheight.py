#!/usr/bin/env python3
"""Boxes standing side by side must be the same height.

    python3 tools/rowheight.py            # every slide of out/제안발표.pptx
    python3 tools/rowheight.py 9 12       # only these slides

A row of cards — `col2` · `col3` · `equal-pair` — reads as one row only when
its boxes share a bottom edge; a card that ends early beside a taller one
reads as a mistake, however the content divides. The builder lays each card
out from its own text, so the defect appears whenever one column carries a
line more than its neighbours and nothing stretches it. This reads the
rendered pptx: every grouped object (`group="true"`, which every card is)
and every filled or bordered rectangle standing on the same top edge as
another, overlapping it in neither axis, is a row, and a row whose heights
differ by more than the tolerance is reported with the slide, the top edge
and the first words of each box.
"""
from __future__ import annotations

import re
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

DECK = Path(__file__).resolve().parents[1]
PPTX = DECK / "out" / "제안발표.pptx"
EMU_PER_PT = 12700
TOP_TOLERANCE = 1.0      # pt: same row
HEIGHT_TOLERANCE = 1.5   # pt: same height

SLIDE = re.compile(r"ppt/slides/slide(\d+)\.xml")
OFF = re.compile(r'<a:off x="(-?\d+)" y="(-?\d+)"')
EXT = re.compile(r'<a:ext cx="(\d+)" cy="(\d+)"')
TEXT = re.compile(r"<a:t>([^<]*)</a:t>")


def boxes(xml: str) -> list[tuple[float, float, float, float, str]]:
    """(x, y, w, h, words) of every card group and visible rectangle."""
    out = []
    # Groups: a card is `group="true"`, so its outer frame is the box — when
    # the group draws one: a rectangle with a visible fill or an outline that
    # spans the whole group. A grouped text row (a heading with its icon, a
    # label beside its value) has no such rectangle and is not a box.
    for m in re.finditer(r"<p:grpSp>(.*?)</p:grpSp>", xml, re.S):
        body = m.group(1)
        off, ext = OFF.search(body), EXT.search(body)
        if off and ext and _draws_frame(body, ext):
            out.append(_box(off, ext, body))
    # Plain rectangles with a fill or an outline, outside any group.
    flat = re.sub(r"<p:grpSp>.*?</p:grpSp>", "", xml, flags=re.S)
    for m in re.finditer(r"<p:sp>(.*?)</p:sp>", flat, re.S):
        body = m.group(1)
        sppr = re.search(r"<p:spPr>(.*?)</p:spPr>", body, re.S)
        if not sppr:
            continue
        pr = sppr.group(1)
        off, ext = OFF.search(pr), EXT.search(pr)
        if _visible(pr) and off and ext:
            out.append(_box(off, ext, body))
    return out


def _visible(pr: str) -> bool:
    return ("<a:solidFill>" in pr and "<a:alpha" not in pr) or bool(re.search(r"<a:ln\b[^/>]*>", pr))


def _draws_frame(body: str, ext) -> bool:
    """Does one visible rectangle in the group span the group's own extent?"""
    for m in re.finditer(r"<p:spPr>(.*?)</p:spPr>", body, re.S):
        pr = m.group(1)
        e = EXT.search(pr)
        if e and _visible(pr) and abs(int(e.group(1)) - int(ext.group(1))) <= EMU_PER_PT \
                and abs(int(e.group(2)) - int(ext.group(2))) <= EMU_PER_PT:
            return True
    return False


def _box(off, ext, body) -> tuple[float, float, float, float, str]:
    x, y = int(off.group(1)) / EMU_PER_PT, int(off.group(2)) / EMU_PER_PT
    w, h = int(ext.group(1)) / EMU_PER_PT, int(ext.group(2)) / EMU_PER_PT
    words = " ".join(TEXT.findall(body)).strip()[:18]
    return x, y, w, h, words


def rows(items):
    """Boxes sharing a top edge and standing beside each other."""
    by_top = defaultdict(list)
    for b in sorted(items, key=lambda b: (b[1], b[0])):
        key = next((k for k in by_top if abs(k - b[1]) <= TOP_TOLERANCE), None)
        by_top[b[1] if key is None else key].append(b)
    for top, group in by_top.items():
        # A box that spans other boxes on the same top edge is their wrapper,
        # not their neighbour; the row is made of the innermost boxes.
        inner = [
            b for b in group
            if not any(o is not b and o[2] < b[2] - TOP_TOLERANCE
                       and o[0] >= b[0] - TOP_TOLERANCE and o[0] + o[2] <= b[0] + b[2] + TOP_TOLERANCE
                       for o in group)
        ]
        beside = []
        for b in sorted(inner, key=lambda b: b[0]):
            if beside and b[0] < beside[-1][0] + beside[-1][2] - TOP_TOLERANCE:
                continue        # still overlapping: not a neighbour
            beside.append(b)
        if len(beside) > 1:
            yield top, beside


def check(only: set[int] | None = None) -> list[str]:
    found = []
    with zipfile.ZipFile(PPTX) as z:
        names = sorted(
            ((int(SLIDE.fullmatch(n).group(1)), n) for n in z.namelist() if SLIDE.fullmatch(n)),
        )
        for index, name in names:
            if only and index not in only:
                continue
            xml = z.read(name).decode("utf-8")
            for top, beside in rows(boxes(xml)):
                heights = [b[3] for b in beside]
                if max(heights) - min(heights) > HEIGHT_TOLERANCE:
                    cells = " · ".join(f"{b[3]:.0f}pt 「{b[4]}」" for b in beside)
                    found.append(f"slide {index} · y={top:.0f}pt: {cells}")
    return found


def main() -> int:
    only = {int(a) for a in sys.argv[1:]} or None
    if not PPTX.exists():
        print("out/제안발표.pptx 가 없다 — 먼저 `npm run render`를 실행한다", file=sys.stderr)
        return 1
    found = check(only)
    for line in found:
        print(line)
    print(f"나란한 상자 높이 검사: 어긋난 줄 {len(found)}")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
