#!/usr/bin/env python3
"""A slide that is full must not be crammed.

Fill is measured on the preview PNGs; density is measured here on the source:
the characters a reader sees on a body slide and the shapes that carry them.
`checks.density.maxChars` and `checks.density.maxShapes` in
`.claude/slide-decks.json` are the ceilings the project set when its author
called a slide too dense; a slide over either is trimmed, never re-spaced.

Visible characters are every attribute value of a `<Use>` or a `<Td>` except
the geometry and reference parameters listed in SKIP (widths, colours, ids,
the running-head fields and the speaker notes); a shape is a `<Use>` of any
template except the page opener, the layout wrappers listed in LAYOUT and the
items of a container listed in ITEMS — a strip, a flow or a row of chips is one
shape however many cells it holds. The three lists can be extended with
`checks.density.skipAttrs`, `checks.density.layoutPrefixes` and
`checks.density.itemTemplates`.

    python3 tools/density.py
"""
from __future__ import annotations
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import deckconfig  # noqa: E402
import deckio  # noqa: E402

_ROOT, _NAME, _DECK, _ALL = deckconfig.this_deck()
CFG = _DECK.get("checks", {}).get("density", {})
MAX_CHARS = int(deckconfig.required(_DECK, "checks.density.maxChars", _NAME))
MAX_SHAPES = int(deckconfig.required(_DECK, "checks.density.maxShapes", _NAME))
SKIP = {
    "template", "p", "w", "h", "aW", "nodeW", "cellW", "labelW", "headW", "stepW", "icon", "tone",
    "tint", "color", "accent", "grow", "gap", "gapTop", "count", "startAt", "class",
    "notes", "ref", "refTitle", "refPages", "part", "evalItem", "reqs", "ids", "proof", "no",
    *CFG.get("skipAttrs", []),
}
LAYOUT = (
    "cols", "stack", "section", "col-section", "col-panel", "frame", "process-link", "flow-link",
    "arrow-down", "gantt-",
    *CFG.get("layoutPrefixes", []),
)
ITEMS = {
    "process-node", "flow-cell", "stage-cell", "tag-chip", "phrase-box", "phrase-note", "copy-text",
    *CFG.get("itemTemplates", []),
}
TAG = re.compile(r"<(Use|Td)\b((?:\"[^\"]*\"|[^>\"])*?)/?>", re.S)
ATTR = re.compile(r'([A-Za-z][\w.-]*)="([^"]*)"')


def measure(text: str) -> tuple[int, int]:
    chars = 0
    shapes = 0
    for m in TAG.finditer(text):
        attrs = dict(ATTR.findall(m.group(2)))
        chars += sum(len(v) for k, v in attrs.items() if k not in SKIP)
        if m.group(1) == "Use":
            name = attrs.get("template", "")
            if name != "page" and name not in ITEMS and not name.startswith(LAYOUT):
                shapes += 1
    return chars, shapes


def main() -> int:
    over: list[str] = []
    rows: list[str] = []
    for path in deckio.chapter_files():
        text = path.read_text(encoding="utf-8")
        if not re.search(r'<Use\s+template="page"', text):
            continue
        chars, shapes = measure(text)
        mark = ""
        if chars > MAX_CHARS or shapes > MAX_SHAPES:
            mark = " ✖"
            over.append(f"{path.name}: 글자 {chars} · 도형 {shapes}")
        rows.append(f"  {path.name:40} 글자 {chars:5d} · 도형 {shapes:3d}{mark}")
    print(f"밀도: 글자 상한 {MAX_CHARS} · 도형 상한 {MAX_SHAPES}")
    print("\n".join(rows))
    print(f"초과 {len(over)}")
    return 1 if over else 0


if __name__ == "__main__":
    raise SystemExit(main())
