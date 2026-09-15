#!/usr/bin/env python3
"""A run of slides must not lean on one sequence shape.

A numbered strip on every slide is one slide repeated; the project names the
sequence shapes it uses in `.claude/slide-decks.json` — `checks.census.sequences`
for the containers that hold a whole sequence in one `<Use>` (a strip, a row of
cells, a vertical flow) and `checks.census.sequenceRows` for the shapes that
stand once per item (a numbered row, a ladder step) — and this reads every body
slide in import order and fails when

  - more than one container stands on one slide, whether the same one twice or
    two different ones (a row shape stands once per item, so it is not counted
    this way) — one slide carries one sequence, and two sequences read as two
    slides printed on top of each other even when the shapes differ,
  - one sequence shape of either kind stands on two consecutive body slides, or
  - one sequence shape of either kind stands on more than
    `checks.census.maxShare` of the body slides (a fraction; default one third),
  - a shape named in `checks.census.closers` — the rows a slide closes a region
    on — stands on more than `checks.census.maxCloserShare` of the body slides.
    A closing row is not a sequence, so no rule above reaches it, and one deck
    carried the same labelled row on 37 of its 41 body slides: every page ended
    the same way and the run read as one slide mirrored.

It also fails when one slide prints the same labelled row twice — the same
`aText`/`bText` or `head`/`bodyText` pair standing in two `<Use>`s of one slide.
A narrow column filled by repeating a row from the wide column reaches the foot
of the page without saying anything, which is the fill rule met with air.

It also prints, for every template the body slides use, how many slides carry
it, so the author sees which shape is about to become the deck's habit.

    python3 tools/census.py
"""
from __future__ import annotations
import math
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import deckconfig  # noqa: E402
import deckio  # noqa: E402

_ROOT, _NAME, _DECK, _ALL = deckconfig.this_deck()
CONTAINERS: list[str] = deckconfig.required(_DECK, "checks.census.sequences", _NAME)
ROWS: list[str] = _DECK.get("checks", {}).get("census", {}).get("sequenceRows", [])
SEQUENCES = [*CONTAINERS, *ROWS]
MAX_SHARE = float(_DECK.get("checks", {}).get("census", {}).get("maxShare", 1 / 3))
CLOSERS: list[str] = _DECK.get("checks", {}).get("census", {}).get("closers", [])
MAX_CLOSER_SHARE = float(
    _DECK.get("checks", {}).get("census", {}).get("maxCloserShare", 1.0))
USE = re.compile(r'<Use\s+template="([^"]+)"')
USE_TAG = re.compile(r"<Use\s+template=\"[^\"]+\"((?:\s+[a-zA-Z]+=\"[^\"]*\")*)\s*/?>")
# The labelled-row pairs a slide may not print twice. A row is (label, body):
# whichever pair the shape carries is the row's identity.
ROW_PAIRS = (("aText", "bText"), ("head", "bodyText"))


def _attrs(chunk: str) -> dict[str, str]:
    return dict(re.findall(r'([a-zA-Z]+)="([^"]*)"', chunk))


def repeated_rows(text: str) -> list[tuple[str, str, int]]:
    """(label, body, count) for every labelled row a slide prints more than once."""
    rows: Counter = Counter()
    for m in USE_TAG.finditer(text):
        a = _attrs(m.group(1))
        for label, body in ROW_PAIRS:
            if a.get(label) and a.get(body):
                rows[(a[label], a[body])] += 1
                break
    return [(k[0], k[1], n) for k, n in rows.items() if n > 1]


def body_slides() -> list[tuple[str, Counter]]:
    """(file name, template counter) for every slide opened by `page`, in order."""
    out: list[tuple[str, Counter]] = []
    for path in deckio.chapter_files():
        text = path.read_text(encoding="utf-8")
        if not re.search(r'<Use\s+template="page"', text):
            continue
        out.append((path.name, Counter(USE.findall(text))))
    return out


def duplicate_rows() -> list[str]:
    """One line per labelled row a body slide prints more than once."""
    found: list[str] = []
    for path in deckio.chapter_files():
        text = path.read_text(encoding="utf-8")
        if not re.search(r'<Use\s+template="page"', text):
            continue
        for label, body, n in repeated_rows(text):
            found.append(f"{path.name}: 「{label} · {body[:40]}」 이 한 쪽에 {n}번")
    return found


def main() -> int:
    slides = body_slides()
    if not slides:
        print("본문 슬라이드가 없다")
        return 0
    limit = max(1, math.ceil(len(slides) * MAX_SHARE))
    problems: list[str] = []
    for name, counts in slides:
        placed = {shape: counts[shape] for shape in CONTAINERS if counts.get(shape)}
        total = sum(placed.values())
        if total > 1:
            where = " · ".join(f"{shape} {n}번" for shape, n in sorted(placed.items()))
            problems.append(f"{name}: 순서 컨테이너가 한 쪽에 {total}개 ({where}) — 한 쪽에 하나만 둔다")
    for (a, ca), (b, cb) in zip(slides, slides[1:]):
        for shape in SEQUENCES:
            if ca.get(shape) and cb.get(shape):
                problems.append(f"{a} → {b}: {shape} 이 연속 두 쪽")
    per_shape = Counter()
    for _name, counts in slides:
        for shape in counts:
            per_shape[shape] += 1
    for shape in SEQUENCES:
        if per_shape.get(shape, 0) > limit:
            problems.append(f"{shape}: 본문 {len(slides)}쪽 중 {per_shape[shape]}쪽 (상한 {limit}쪽)")
    closer_limit = max(1, math.ceil(len(slides) * MAX_CLOSER_SHARE))
    for shape in CLOSERS:
        if per_shape.get(shape, 0) > closer_limit:
            problems.append(
                f"{shape}: 마감 도형이 본문 {len(slides)}쪽 중 {per_shape[shape]}쪽에 선다 "
                f"(상한 {closer_limit}쪽) — 몇 쪽의 마감을 다른 모양으로 바꾼다")
    problems.extend(duplicate_rows())
    print(f"구성요소 census: 본문 {len(slides)}쪽 · 순서 도형 {', '.join(SEQUENCES)} · 상한 {limit}쪽")
    for shape, n in sorted(per_shape.items(), key=lambda kv: (-kv[1], kv[0])):
        if n >= 2 and shape not in ("page",):
            print(f"  {shape:18} {n}쪽")
    for line in problems:
        print(f"  ✖ {line}")
    print(f"어긋남 {len(problems)}")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
