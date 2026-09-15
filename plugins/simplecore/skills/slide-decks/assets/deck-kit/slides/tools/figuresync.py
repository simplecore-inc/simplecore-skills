#!/usr/bin/env python3
"""The reused figures are a snapshot this deck owns, not a live read.

A slide deck that summarises a document deck reuses that document's figures. The
obvious arrangement is to read them where the document keeps them, so a
correction there reaches the slide on the next build. That arrangement has a
cost nobody sees until it fires: the document's authors redraw a figure for the
document's own reasons, the figure grows, and a column of the slide deck
overflows — in a build the document's authors never run, with nothing in the
document's checks to report it. One revision here grew two diagrams by twenty
pixels and broke a slide that way.

So the reused figures live under `assets/figures/` as a snapshot, and this tool
is the only thing that writes it:

    python3 tools/figuresync.py            # report the drift, exit 1 if any
    python3 tools/figuresync.py --update   # take the upstream version

`--update` is followed by a render and the deck's checks in the same change,
because taking a new figure is a layout change. Without it the tool reports

  - a snapshot figure whose upstream copy differs (the deck is behind),
  - a figure a chapter places that the snapshot does not hold (the deck cannot
    build), and
  - a snapshot figure no chapter places (the snapshot has grown stale).

The upstream directory and the snapshot come from `.claude/slide-decks.json`
(`figures.upstream` and the deck-local `figures.sources`); neither is guessed.
"""
from __future__ import annotations

import filecmp
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import deckconfig  # noqa: E402

_ROOT, _NAME, _DECK, _CONFIG = deckconfig.this_deck()
UPSTREAM = _ROOT / deckconfig.required(_DECK, "figures.upstream", _NAME)

DECK = Path(__file__).resolve().parent.parent
SNAPSHOT = DECK / "assets" / "figures"
CHAPTERS = DECK / "chapters"
COMMENT = re.compile(r"<!--.*?-->", re.S)
# a reused figure's template id is the proposal's 부-장-순번; the deck's own is sNN
REUSED = re.compile(r'template="fig-(\d+-\d+-\d+)"')


def placed_ids() -> set[str]:
    ids: set[str] = set()
    for path in sorted(CHAPTERS.glob("*.xml")):
        ids |= set(REUSED.findall(COMMENT.sub("", path.read_text(encoding="utf-8"))))
    return ids


def upstream_file(figure_id: str) -> Path | None:
    for path in sorted(UPSTREAM.glob("*.svg")):
        if path.name.startswith(f"{figure_id}-"):
            return path
    return None


def main() -> int:
    update = "--update" in sys.argv[1:]
    SNAPSHOT.mkdir(parents=True, exist_ok=True)
    placed = placed_ids()
    held = {p.name: p for p in SNAPSHOT.glob("*.svg")}

    behind: list[str] = []
    missing: list[str] = []
    taken: list[str] = []
    for figure_id in sorted(placed):
        src = upstream_file(figure_id)
        if src is None:
            missing.append(f"{figure_id} — 원본 디렉터리에 없다")
            continue
        dst = SNAPSHOT / src.name
        if not dst.exists():
            if update:
                shutil.copy2(src, dst)
                taken.append(f"{src.name} — 새로 받았다")
            else:
                missing.append(f"{src.name} — 사본이 없다")
        elif not filecmp.cmp(src, dst, shallow=False):
            if update:
                shutil.copy2(src, dst)
                taken.append(f"{src.name} — 원본이 바뀌어 다시 받았다")
            else:
                behind.append(src.name)

    stale = [name for name in sorted(held)
             if not any(name.startswith(f"{i}-") for i in placed)]
    if update:
        for name in stale:
            (SNAPSHOT / name).unlink()
            taken.append(f"{name} — 어느 쪽도 놓지 않아 지웠다")

    if update:
        for line in taken:
            print(f"  · {line}")
        print(f"도식 사본 갱신: 놓는 도식 {len(placed)}종 · 바뀐 파일 {len(taken)}개")
        print("  갱신은 배치 변경이다 — 렌더와 검사를 같은 변경에서 함께 돌린다.")
        return 0

    for line in missing:
        print(f"✖ {line}")
    for name in behind:
        print(f"✖ {name} — 원본이 사본과 다르다 (--update 로 받는다)")
    for name in stale:
        print(f"⚠ {name} — 어느 쪽도 놓지 않는다 (--update 가 지운다)")
    bad = len(missing) + len(behind) + len(stale)
    print(f"도식 사본 대조: 놓는 도식 {len(placed)}종 · 사본 {len(held)}개 · 어긋남 {bad}건")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
