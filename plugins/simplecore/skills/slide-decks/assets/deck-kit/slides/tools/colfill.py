#!/usr/bin/env python3
"""A column layout is measured per column, not per page.

The fill rule says a body page reaches the bottom of its text block. Measured
over the whole page, that number is met by whichever column runs longest — so a
page whose wide column is full and whose narrow column stops half way passes,
and the hole sits there through every review that reads the number instead of
the page. One deck carried eight such pages while its page-level fill read
90 % at worst.

This reads each body slide's chapter file for the column layout it uses, finds
the rendered PNG by the deck's own import order, and measures the ink's lowest
row inside each column's x range. A page fails when the gap between its fullest
and its emptiest column is wider than `checks.colfill.maxGap`, or when any
column ends higher than `checks.colfill.minFill`. The gap alone is not enough:
two columns that both stop half way are equally spaced and equally empty.

The project declares, in `.claude/slide-decks.json` under `checks.colfill`:

  - `maxGap` — the fraction of the text block's height two columns may differ by,
  - `minFill` — the fraction every column reaches on its own,
  - `textBlock` — the block's left edge, top and bottom in page units,
  - `layouts` — each column layout's name and its columns' x ranges, measured
    from the text block's left edge.

A layout the declaration does not name is not measured, and that is reported so
a new layout is not silently exempt.

    python3 tools/colfill.py            # fails on the first page over the gap
    python3 tools/colfill.py --list     # every page, widest gap first
"""
from __future__ import annotations
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import deckconfig  # noqa: E402

_ROOT, _NAME, _DECK, _CONFIG = deckconfig.this_deck()
_C = deckconfig.required(_DECK, "checks.colfill", _NAME)
MAX_GAP: float = float(_C["maxGap"])
MIN_FILL: float = float(_C.get("minFill", 0.0))
BLOCK: dict = _C["textBlock"]
LAYOUTS: dict[str, list[list[int]]] = _C["layouts"]

PAGE = deckconfig.required(_DECK, "page", _NAME)
PAGE_W, PAGE_H = int(PAGE["w"]), int(PAGE["h"])

DECK = Path(__file__).resolve().parent.parent
COMMENT = re.compile(r"<!--.*?-->", re.S)
INK = 235          # a pixel darker than this counts as ink
MIN_RUN = 2        # ignore a row with fewer ink pixels than this (anti-alias dust)


def import_order() -> list[str]:
    """The chapter stems in the order main.sgx imports them."""
    text = (DECK / "main.sgx").read_text(encoding="utf-8")
    return re.findall(r"chapters/([^\"]+)\.xml", text)


def layout_of(text: str) -> str | None:
    for name in LAYOUTS:
        if f'template="{name}"' in text:
            return name
    return None


def column_fills(png: Path, columns: list[list[int]]) -> list[float]:
    image = Image.open(png).convert("L")
    scale_x, scale_y = image.width / PAGE_W, image.height / PAGE_H
    pixels = np.array(image)
    band = pixels[int(BLOCK["top"] * scale_y): int(BLOCK["bottom"] * scale_y)]
    fills: list[float] = []
    for x0, x1 in columns:
        left = int((BLOCK["x"] + x0) * scale_x)
        right = int((BLOCK["x"] + x1) * scale_x)
        ink = (band[:, left:right] < INK).sum(1)
        rows = np.nonzero(ink > MIN_RUN)[0]
        fills.append((rows.max() + 1) / band.shape[0] if len(rows) else 0.0)
    return fills


def main() -> int:
    show_all = "--list" in sys.argv[1:]
    order = import_order()
    measured: list[tuple[int, str, str, list[float], float]] = []
    unknown: list[str] = []
    for folio, stem in enumerate(order):
        path = DECK / "chapters" / f"{stem}.xml"
        if not path.exists():
            continue
        text = COMMENT.sub("", path.read_text(encoding="utf-8"))
        if '<Use template="page"' not in text:
            continue                      # cover, contents and closing are exempt
        name = layout_of(text)
        if name is None:
            if not re.search(r'<Use template="(stack|cols[\w-]*)"', text):
                continue                  # a single-column page has nothing to compare
            unknown.append(stem)
            continue
        png = DECK / "out" / "png" / f"slide-{folio + 1}.png"
        if not png.exists():
            print(f"⚠ {png.name} 이 없다 — 먼저 렌더한다")
            return 1
        fills = column_fills(png, LAYOUTS[name])
        measured.append((folio, stem, name, fills, max(fills) - min(fills)))

    measured.sort(key=lambda row: -row[4])
    bad = [row for row in measured
           if row[4] > MAX_GAP or min(row[3]) < MIN_FILL]
    if show_all:
        for folio, stem, name, fills, gap in measured:
            mark = "✖" if gap > MAX_GAP or min(fills) < MIN_FILL else " "
            columns = " · ".join(f"{v * 100:5.1f}%" for v in fills)
            print(f"{mark} 폴리오 {folio:>2} {name:16} {columns}   차이 {gap * 100:5.1f}%p")
    else:
        for folio, stem, name, fills, gap in bad:
            columns = " · ".join(f"{v * 100:5.1f}%" for v in fills)
            why = []
            if gap > MAX_GAP:
                why.append(f"차이 {gap * 100:.1f}%p (상한 {MAX_GAP * 100:.0f}%p)")
            if min(fills) < MIN_FILL:
                why.append(f"가장 짧은 단 {min(fills) * 100:.1f}% (바닥 {MIN_FILL * 100:.0f}%)")
            print(f"✖ 폴리오 {folio} {stem}: {name} 의 단별 채움 {columns} — {' · '.join(why)}")
    for stem in unknown:
        print(f"⚠ {stem}: 선언되지 않은 단 배치라 재지 못했다 — checks.colfill.layouts 에 더한다")
    print(f"단별 채움 검사: 본문 {len(measured)}쪽 · 상한 초과 {len(bad)}쪽")
    return 1 if bad or unknown else 0


if __name__ == "__main__":
    raise SystemExit(main())
