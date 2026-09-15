#!/usr/bin/env python3
"""Every list row sits in the deck's list container, and no bullet is typed.

A run of `dot-row` / `num-row` / `prose-item` dropped straight into a section's
slot takes that section's gap, so the same list stands at 2px on one page and
13px on the next and no page-by-page review catches it — each page looks fine
on its own. `prose-list` is the one place the row gap is set, so every row
belongs inside one, and a chapter file must not set that gap by hand.

The second rule is the bullet. The deck's unordered list is `dot-row`, whose
dot is a drawn shape; `prose-item` carries a mark the page supplies — a number,
a letter, a code. A typed 「•」 in that slot is a second bullet system, and it
was one: 749 rows carried it, indented by nothing and parted from their text by
a 24px column.

Usage:
    python3 tools/deck/listrow.py            # every chapter
    python3 tools/deck/listrow.py <file.xml> # only these
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import catalog  # noqa: E402

DECK = catalog.DECK / "chapters"

ROWS = ("dot-row", "num-row", "prose-item")
CONTAINER = "prose-list"

# A mark that is a bullet rather than an index. The middle dot and the hyphen
# are here for the same reason as the bullet: they stand in for a shape.
TYPED_BULLET = re.compile(r"^[•·∙●○▪–—*\-]+$")

TAG = re.compile(r"<!--[\s\S]*?-->|<[^>]+>")
HAND_GAP = re.compile(r'<VStack(?:\s+(?:gap="\d+"|w="100%"))+\s*>')


class Node:
    __slots__ = ("tag", "tpl", "raw", "line", "kids")

    def __init__(self, tag: str, tpl: str | None, raw: str, line: int) -> None:
        self.tag, self.tpl, self.raw, self.line = tag, tpl, raw, line
        self.kids: list["Node"] = []

    def content(self) -> list["Node"]:
        """Children, reading through a <Slot> — a template's content sits in one."""
        out: list[Node] = []
        for k in self.kids:
            out.extend(k.content() if k.tag == "Slot" else [k])
        return out


def parse(src: str) -> Node:
    root = Node("#root", None, "", 0)
    stack = [root]
    for m in TAG.finditer(src):
        tag = m.group(0)
        if tag.startswith("<!--"):
            continue
        name = re.match(r"</?\s*([A-Za-z][\w-]*)", tag)
        if not name:
            continue
        if tag.startswith("</"):
            if len(stack) > 1:
                stack.pop()
            continue
        tplm = re.search(r'template="([^"]+)"', tag)
        node = Node(name.group(1), tplm.group(1) if tplm else None, tag,
                    src.count("\n", 0, m.start()) + 1)
        stack[-1].kids.append(node)
        if not tag.endswith("/>"):
            stack.append(node)
    return root


def walk(node: Node, holder: str | None, name: str, found: list[str]) -> None:
    own = node.tpl if node.tag == "Use" else holder

    if node.tag == "Use" and node.tpl in ROWS:
        if holder != CONTAINER:
            found.append(f"{name}:{node.line} — {node.tpl} outside {CONTAINER} "
                         f"(in {holder or 'the page'})")
        mark = re.search(r'\bmark="([^"]*)"', node.raw)
        if node.tpl == "prose-item" and mark and TYPED_BULLET.match(mark.group(1)):
            found.append(f"{name}:{node.line} — prose-item carries a typed bullet "
                         f"「{mark.group(1)}」; the deck's bullet is dot-row")

    content = node.content()
    if node.tpl == CONTAINER and any(k.tpl == CONTAINER for k in content):
        found.append(f"{name}:{node.line} — {CONTAINER} inside {CONTAINER}")
    if (node.tag == "VStack" and HAND_GAP.fullmatch(node.raw)
            and len(content) == 1 and content[0].tpl == CONTAINER):
        found.append(f"{name}:{node.line} — the list's row gap is set on a "
                     f"<VStack>; it belongs to {CONTAINER}")

    for k in node.kids:
        walk(k, own, name, found)


def scan(path: Path) -> list[str]:
    found: list[str] = []
    walk(parse(path.read_text(encoding="utf-8")), None, path.name, found)
    return found


def main(argv: list[str]) -> int:
    paths = [Path(a) for a in argv[1:]] or sorted(DECK.glob("*.xml"))
    problems: list[str] = []
    for p in paths:
        problems.extend(scan(p))
    for line in problems:
        print(line)
    print(f"목록 행 대조: {len(paths)}개 파일 · {len(problems)}건")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
