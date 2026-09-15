#!/usr/bin/env python3
"""The judgement colours follow the meaning, never the slot.

A deck may sanction one third colour system beside the part colour and the
inline accent. Where that system is a judgement pair — one colour for blocked,
one for allowed — it is carried by a named handful of templates, and each of
those templates paints one label with the block colour and one with the pass
colour at a fixed position. That fixed position is the trap: a page reaching
for the card's *shape* gets the colours whether or not its two rows are a
judgement, and then a neutral word is printed in the colour the deck taught the
panel to read as a verdict. One deck printed 「차단」 in green on the page beside
a card printing the same word in red.

The project declares, in `.claude/slide-decks.json` under `checks.verdict`:

  - `block` and `pass` — the two hexes,
  - `templates` — the shapes that may carry them, and which attribute of each
    holds the block label and which the pass label,
  - `blockWords` and `passWords` — the vocabulary each side may print.

This reads every body chapter and fails when

  - a declared template's block attribute holds none of the block words, or its
    pass attribute holds none of the pass words (the colour is on a word that
    does not mean what the colour says), or
  - either hex appears in a template file outside the declared templates, or in
    a chapter file at all (a chapter writes no hex).

    python3 tools/verdict.py
"""
from __future__ import annotations
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import deckconfig  # noqa: E402

_ROOT, _NAME, _DECK, _CONFIG = deckconfig.this_deck()
_V = deckconfig.required(_DECK, "checks.verdict", _NAME)
BLOCK: str = _V["block"]
PASS: str = _V["pass"]
TEMPLATES: dict[str, dict[str, str]] = _V["templates"]
BLOCK_WORDS: list[str] = _V["blockWords"]
PASS_WORDS: list[str] = _V["passWords"]

ROOT = Path(__file__).resolve().parent.parent
COMMENT = re.compile(r"<!--.*?-->", re.S)


def uses(text: str, template: str) -> list[str]:
    """Every `<Use template="...">` tag for one template, attributes included."""
    pat = re.compile(r'<Use\s+template="' + re.escape(template) + r'"((?:\s+[a-zA-Z]+="[^"]*")*)\s*/?>')
    return [m.group(1) for m in pat.finditer(text)]


def attr(tag: str, name: str) -> str | None:
    m = re.search(r'\s' + re.escape(name) + r'="([^"]*)"', tag)
    return m.group(1) if m else None


def main() -> int:
    bad: list[str] = []
    for path in sorted((ROOT / "chapters").glob("*.xml")):
        text = COMMENT.sub("", path.read_text(encoding="utf-8"))
        for template, slots in TEMPLATES.items():
            for tag in uses(text, template):
                for side, words in (("blockAttr", BLOCK_WORDS), ("passAttr", PASS_WORDS)):
                    name = slots[side]
                    value = attr(tag, name)
                    if value is None:
                        continue
                    if not any(w in value for w in words):
                        colour = "차단색" if side == "blockAttr" else "통과색"
                        bad.append(
                            f"{path.name}: {template} 의 {name}=「{value}」 에 {colour}이 실린다 "
                            f"— 판정 낱말이 아니면 판정색을 쓰지 않는 컴포넌트로 옮긴다"
                        )
        for hexv in (BLOCK, PASS):
            if hexv in text:
                bad.append(f"{path.name}: 판정색 {hexv} 를 챕터 파일이 직접 쓴다")

    allowed_blocks: list[str] = []
    for path in sorted((ROOT / "templates").glob("*.xml")):
        text = path.read_text(encoding="utf-8")
        for template in TEMPLATES:
            m = re.search(r'<Template\b(?:\s+[\w.:-]+="[^"]*")*?\s+name="' + re.escape(template) + r'"[^>]*>.*?</Template>', text, re.S)
            if m:
                allowed_blocks.append(m.group(0))
        rest = text
        for block in allowed_blocks:
            rest = rest.replace(block, "")
        for hexv in (BLOCK, PASS):
            if hexv in rest:
                bad.append(
                    f"{path.name}: 판정색 {hexv} 가 선언된 판정 컴포넌트 밖에 있다 "
                    f"— {' · '.join(TEMPLATES)} 만 이 색을 싣는다"
                )

    for line in bad:
        print(f"✖ {line}")
    print(f"verdict: 어긋남 {len(bad)}건")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
