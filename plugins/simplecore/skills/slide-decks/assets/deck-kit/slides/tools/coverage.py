#!/usr/bin/env python3
"""Every evaluation item and every requirement has to appear on a slide.

The presentation plan — the file `.claude/slide-decks.json` names under
`plan` — carries the evaluation items (§4) and the detailed requirements (§5). Every `page` slide names the
items it answers in `evalItem` and the ids in `reqs`; this reads both lists
from the plan, rejects a name or an id the plan does not know, and reports how
much of each list the deck covers.

A requirement also counts when a slide prints its id in the body — a badge, a
bar's stub, a note's mark — because that is what the panel reads. So the ids
are collected from the head's `reqs` and from the chapter file's own text with
comments stripped, and a cover or a closing slide counts the same way. Only
`page` slides are counted as body slides.

    python3 tools/coverage.py             # unknown names fail; coverage is printed
    python3 tools/coverage.py --complete  # also fails while anything is uncovered
"""
from __future__ import annotations
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import deckconfig  # noqa: E402
import deckio  # noqa: E402

_ROOT, _NAME, _DECK, _ALL = deckconfig.this_deck()
PLAN = _ROOT / deckconfig.required(_DECK, "plan", _NAME)
NOT_SCORED = "해당 없음"
ID = re.compile(r"^[A-Z]{3}-\d{3}$")


def plan_tables() -> tuple[list[str], dict[str, str]]:
    """(evaluation item names, requirement id -> name) from the plan's §4 and §5."""
    text = PLAN.read_text(encoding="utf-8")
    sec4 = text.split("## 4. ")[1].split("\n## ")[0]
    sec5 = text.split("## 5. ")[1].split("\n## ")[0]
    items: list[str] = []
    for line in sec4.splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) == 4 and cells[1].isdigit() and cells[0] != "합계":
            items.append(cells[0])
    reqs: dict[str, str] = {}
    for line in sec5.splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) == 4 and ID.match(cells[0]):
            reqs[cells[0]] = cells[1]
    if len(items) != 21 or len(reqs) != 61:
        raise SystemExit(f"발표 계획에서 평가항목 {len(items)}개 · 요구사항 {len(reqs)}건을 읽었다 (21 · 61이어야 한다)")
    return items, reqs


def ids(text: str) -> set[str]:
    """Requirement ids, 「COR-001~003 · 009」 read as the ones it names."""
    found: set[str] = set()
    prefix = None
    token = re.compile(r"([A-Z]{3})-(\d{3})(?:\s*~\s*(?:[A-Z]{3}-)?(\d{3}))?|[·,]\s*(\d{3})(?:\s*~\s*(\d{3}))?")
    for m in token.finditer(text or ""):
        if m.group(1):
            prefix, lo, hi = m.group(1), m.group(2), m.group(3)
        else:
            lo, hi = m.group(4), m.group(5)
        if prefix:
            found.update(f"{prefix}-{n:03d}" for n in range(int(lo), int(hi or lo) + 1))
    return found


def main() -> int:
    complete = "--complete" in sys.argv
    items, reqs = plan_tables()
    known = set(items) | {NOT_SCORED}
    seen_items: set[str] = set()
    seen_reqs: set[str] = set()
    problems: list[str] = []
    pages = 0
    # An id printed anywhere on a slide counts: the chapter files' own text,
    # with XML comments (the plan notes) stripped so a note about a slide is
    # not read as the slide answering it.
    for path in deckio.chapter_files():
        body = re.sub(r"<!--.*?-->", " ", path.read_text(encoding="utf-8"), flags=re.S)
        for rid in ids(body):
            if rid in reqs:
                seen_reqs.add(rid)
    for s in deckio.slides():
        if s["template"] != "page":
            continue
        pages += 1
        a = s["attrs"]
        for name in re.split(r"[,·]", a.get("evalItem", "")):
            name = name.strip()
            if not name:
                continue
            if name not in known:
                problems.append(f"  {s['file']} — 평가항목 「{name}」은 계획의 21개에 없다")
            elif name != NOT_SCORED:
                seen_items.add(name)
        for rid in ids(a.get("reqs", "")):
            if rid not in reqs:
                problems.append(f"  {s['file']} — 요구사항 {rid}은 계획의 61건에 없다")
            else:
                seen_reqs.add(rid)
    for p in problems:
        print(p)
    missing_items = [i for i in items if i not in seen_items]
    missing_reqs = [r for r in reqs if r not in seen_reqs]
    print(f"평가항목 {len(seen_items)}/21 · 요구사항 {len(seen_reqs)}/61 · 본문 슬라이드 {pages}쪽")
    if missing_items:
        print("  아직 없는 평가항목: " + ", ".join(missing_items))
    if missing_reqs:
        print("  아직 없는 요구사항: " + " ".join(missing_reqs))
    if problems:
        return 1
    if complete and (missing_items or missing_reqs):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
