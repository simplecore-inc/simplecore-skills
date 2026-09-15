#!/usr/bin/env python3
"""The running head's 「본 제안서 … n~m쪽」, computed from the proposal deck.

The presentation plan (proposal/11-요약서) says the proposal's final page
numbers are derived from the proposal deck's import order and never fixed by
hand. So every `page` slide names the proposal section it answers (`ref`, such
as 「Ⅳ-2」 · 「Ⅲ-4 / Ⅲ-5」 · 「Ⅰ-1~2」) and this script reads that deck's
main.sgx — the deck `.claude/slide-decks.json` names under `references.deck` —
works out each chapter's folio range the way a document deck's own contents
check does, and writes the `refPages` attribute.

    python3 tools/refpages.py           # fails when a refPages value is stale
    python3 tools/refpages.py --write   # writes the values into chapters/*.xml
"""
from __future__ import annotations
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import deckconfig  # noqa: E402
import deckio  # noqa: E402

_ROOT, _NAME, _DECK, _ALL = deckconfig.this_deck()
_REF = deckconfig.required(_DECK, "references.deck", _NAME)
if _REF not in _ALL["decks"]:
    raise SystemExit(f"references.deck 가 가리키는 덱 {_REF} 가 decks 에 없다")
PROPOSAL = _ROOT / _ALL["decks"][_REF]["dir"]
PROPOSAL_MAIN = PROPOSAL / "main.sgx"
NO_FOLIO = {"cover-art", "cover", "toc"}
NUMERAL = "ⅠⅡⅢⅣⅤⅥⅦⅧⅨ"
CHAPTER_NO = re.compile(r"^(\d+)\.")
TOKEN = re.compile(r"([ⅠⅡⅢⅣⅤⅥⅦⅧⅨ])-(\d+)(?:~(\d+))?")


def proposal_ranges() -> dict[tuple[int, int], tuple[int, int]]:
    """(part, chapter) -> (first folio, last folio) in the proposal deck."""
    ranges: dict[tuple[int, int], list[int]] = {}
    folio = 0
    main = PROPOSAL_MAIN.read_text(encoding="utf-8")
    for rel in re.findall(r'<Import src="(chapters/[^"]+)"', main):
        root = ET.parse(PROPOSAL / rel).getroot()
        for use in root:
            if use.tag != "Use":
                continue
            tpl = use.get("template")
            if tpl not in NO_FOLIO:
                folio += 1
            if tpl != "page":
                continue
            no = CHAPTER_NO.match(use.get("chapter", "") or "")
            if not no:
                continue
            key = (int(use.get("p")), int(no.group(1)))
            ranges.setdefault(key, []).append(folio)
    return {k: (min(v), max(v)) for k, v in ranges.items()}


def pages_for(ref: str, ranges: dict[tuple[int, int], tuple[int, int]]) -> str:
    """「Ⅲ-4 / Ⅲ-5」 -> 「41~42 · 43~48쪽」; 「Ⅰ-1~2」 -> 「2~7쪽」."""
    parts: list[str] = []
    for piece in ref.split("/"):
        m = TOKEN.search(piece.strip())
        if not m:
            raise ValueError(f"ref 「{ref}」의 「{piece.strip()}」를 읽지 못했다")
        part = NUMERAL.index(m.group(1)) + 1
        lo, hi = int(m.group(2)), int(m.group(3) or m.group(2))
        folios = [ranges[(part, c)] for c in range(lo, hi + 1) if (part, c) in ranges]
        if not folios:
            raise ValueError(f"본 제안서에 {m.group(1)}-{lo}~{hi} 장이 없다")
        first, last = min(f[0] for f in folios), max(f[1] for f in folios)
        parts.append(f"{first}" if first == last else f"{first}~{last}")
    return " · ".join(parts) + "쪽"


def main() -> int:
    write = "--write" in sys.argv
    ranges = proposal_ranges()
    stale: list[str] = []
    touched = 0
    for path in deckio.chapter_files():
        text = path.read_text(encoding="utf-8")
        edits: list[tuple[int, int, str]] = []
        for m in deckio.USE_BLOCK.finditer(text):
            if m.group(1) != "page":
                continue
            attrs = dict(deckio.ATTR.findall(m.group(2)))
            ref = attrs.get("ref", "")
            if not ref or ref == "—":
                continue
            want = pages_for(ref, ranges)
            have = attrs.get("refPages")
            if have == want:
                continue
            stale.append(f"  {path.name} · {attrs.get('title', '')} — {have!r} → {want!r}")
            if write and have is not None:
                block = m.group(0)
                new = re.sub(r'refPages="[^"]*"', f'refPages="{want}"', block, count=1)
                edits.append((m.start(), m.end(), new))
        if edits:
            for start, end, new in sorted(edits, reverse=True):
                text = text[:start] + new + text[end:]
            path.write_text(text, encoding="utf-8")
            touched += len(edits)
    if stale and not write:
        print("본 제안서 쪽 참조가 조판과 어긋난다 — `python3 tools/refpages.py --write` 로 갱신한다")
        print("\n".join(stale))
        return 1
    if write:
        print(f"본 제안서 쪽 참조: {touched}쪽 갱신")
    else:
        print("본 제안서 쪽 참조: 어긋남 0")
    return 0


if __name__ == "__main__":
    sys.exit(main())
