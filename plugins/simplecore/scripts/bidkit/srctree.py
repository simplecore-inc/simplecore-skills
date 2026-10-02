"""A deck source file as a tree of elements, for checks about how a page is written.

The printed model (`DeckReader.slides`) says what a page shows; a check about
how the page was written (a list row outside its container, a stack drawn by
hand in a page file, which slot of a column layout holds what) needs the
source's own nesting. This is a tolerant tag reader, not an XML parser: the
server holds sources that are valid by construction, and a check must not
fail on an entity or a comment a strict parser would refuse.
"""
from __future__ import annotations

import re
from html import unescape

TAG = re.compile(r"<!--[\s\S]*?-->|<(?:\"[^\"]*\"|'[^']*'|[^>\"'])+>")
NAME = re.compile(r"</?\s*([A-Za-z][\w.-]*)")
ATTR = re.compile(r'([\w.:-]+)=(?:"([^"]*)"|\'([^\']*)\')')


class Node:
    __slots__ = ("tag", "attrs", "raw", "line", "kids", "parent")

    def __init__(self, tag: str, attrs: dict, raw: str, line: int, parent: "Node | None") -> None:
        self.tag, self.attrs, self.raw, self.line, self.parent = tag, attrs, raw, line, parent
        self.kids: list["Node"] = []

    @property
    def template(self) -> str | None:
        """The template a `<Use>` draws, None for any other element."""
        return self.attrs.get("template") if self.tag == "Use" else None

    @property
    def slot(self) -> str | None:
        """The slot name of a `<Slot>`, None for any other element."""
        return self.attrs.get("name") if self.tag == "Slot" else None

    def content(self) -> list["Node"]:
        """Children, reading through a `<Slot>`: a template's content sits in one."""
        out: list[Node] = []
        for k in self.kids:
            out.extend(k.content() if k.tag == "Slot" else [k])
        return out

    def walk(self):
        """This node and every node under it, depth first, in source order."""
        yield self
        for k in self.kids:
            yield from k.walk()

    def holder(self) -> "Node | None":
        """The nearest enclosing `<Use>`."""
        p = self.parent
        while p is not None and p.tag != "Use":
            p = p.parent
        return p


def parse(src: str) -> Node:
    """The element tree of one source file; comments are dropped, values unescaped."""
    root = Node("#root", {}, "", 0, None)
    stack = [root]
    for m in TAG.finditer(src):
        tag = m.group(0)
        if tag.startswith("<!--") or tag.startswith("<?"):
            continue
        name = NAME.match(tag)
        if not name:
            continue
        if tag.startswith("</"):
            if len(stack) > 1:
                stack.pop()
            continue
        attrs = {a: unescape(b if b or not c else c) for a, b, c in ATTR.findall(tag)}
        node = Node(name.group(1), attrs, tag, src.count("\n", 0, m.start()) + 1, stack[-1])
        stack[-1].kids.append(node)
        if not tag.rstrip(">").rstrip().endswith("/"):
            stack.append(node)
    return root


def pages(root: Node, components: set[str]) -> list[Node]:
    """The `<Use>` elements that open a page, in source order."""
    return [n for n in root.walk() if n.template in components]
