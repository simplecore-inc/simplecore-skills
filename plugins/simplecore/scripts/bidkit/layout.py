"""Where a slide's space goes, as the server lays it out (`sg://slide/{n}/space`).

The server lays a slide out with the builder's own measurer and fonts, so the
boxes it reports are the boxes the built deck draws: every container's rect,
padding, inner box, the extent its children fill and the slack left, and every
text's printed size and the lines its box holds. A check that measures a page
(how far its body reaches, what size a string prints at) reads this rather
than a rendered picture, which is stale the moment the deck changes and needs
an image library to read.

One line per node, indented two spaces per level:

    node#524  VStack  [56,236 681×828]  pad 0  inner [56,236 681×828]  gap 16  ...  extent 794  slack 34
    node#553  Text  [234,722 493×62]  "계통 모델…"  13.3462px×1.3  box-lines 3.4

A table is one leaf: its cells are not laid out as nodes.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from .deckread import DeckError, DeckReader

LINE = re.compile(r"^( *)(node#\d+)\s+(\w+)\s+\[(-?[\d.]+),(-?[\d.]+) ([\d.]+)×([\d.]+)\](.*)$")
INNER = re.compile(r"\binner \[(-?[\d.]+),(-?[\d.]+) ([\d.]+)×([\d.]+)\]")
EXTENT = re.compile(r"\bextent (-?[\d.]+)")
SLACK = re.compile(r"(?<!cross-)\bslack (-?[\d.]+)")
QUOTED = re.compile(r'\s"(.*)"\s')
SIZE = re.compile(r"\s([\d.]+)px×([\d.]+)")
BOX_LINES = re.compile(r"\bbox-lines ([\d.]+)")


@dataclass
class Box:
    key: str
    tag: str
    x: float
    y: float
    w: float
    h: float
    inner: tuple | None = None          # (x, y, w, h) inside the padding
    extent: float | None = None         # the length the children fill along the main axis
    slack: float | None = None          # what is left of the inner box along the main axis
    text: str = ""                      # a text's printed string, shortened by the server
    size_px: float | None = None        # a text's font size in px
    lines: float | None = None          # the lines a text's box holds
    kids: list = field(default_factory=list)
    parent: "Box | None" = None

    @property
    def bottom(self) -> float:
        return self.y + self.h

    @property
    def right(self) -> float:
        return self.x + self.w

    def walk(self):
        yield self
        for k in self.kids:
            yield from k.walk()

    def leaves(self):
        """The drawn leaves under this box: texts, images, icons, tables."""
        for b in self.walk():
            if not b.kids and b.tag not in ("VStack", "HStack", "Layer", "Box"):
                yield b

    def ink_bottom(self) -> float | None:
        """The lowest edge of anything drawn under this box, None when nothing is."""
        bottoms = [b.bottom for b in self.leaves()]
        return max(bottoms) if bottoms else None


def parse(text: str) -> tuple[Box, dict[str, Box]]:
    """(root box, {key: box}) of one slide's space reading."""
    roots: list[Box] = []
    stack: list[tuple[int, Box]] = []
    index: dict[str, Box] = {}
    for line in text.splitlines():
        m = LINE.match(line)
        if not m:
            continue
        indent, key, tag = len(m.group(1)), m.group(2), m.group(3)
        rest = m.group(8)
        box = Box(key, tag, *(float(m.group(i)) for i in range(4, 8)))
        inner = INNER.search(rest)
        if inner:
            box.inner = tuple(float(v) for v in inner.groups())
        ext, slack = EXTENT.search(rest), SLACK.search(rest)
        box.extent = float(ext.group(1)) if ext else None
        box.slack = float(slack.group(1)) if slack else None
        quoted = QUOTED.search(rest + " ")
        if quoted:
            box.text = quoted.group(1)
            tail = rest[quoted.end() - 1:]
        else:
            tail = rest
        size = SIZE.search(tail)
        if size:
            box.size_px = float(size.group(1))
        lines = BOX_LINES.search(tail)
        box.lines = float(lines.group(1)) if lines else None
        while stack and stack[-1][0] >= indent:
            stack.pop()
        if stack:
            box.parent = stack[-1][1]
            stack[-1][1].kids.append(box)
        else:
            roots.append(box)
        stack.append((indent, box))
        index[key] = box
    if not roots:
        raise DeckError("the server's space reading holds no node")
    return roots[0], index


class Layouts:
    """Each slide's space reading, read from the server once."""

    def __init__(self, reader: DeckReader):
        self.reader = reader
        self._cache: dict[int, tuple[Box, dict[str, Box]]] = {}

    def slide(self, n: int) -> tuple[Box, dict[str, Box]]:
        if n not in self._cache:
            self._cache[n] = parse(self.reader.session.read(f"sg://slide/{n}/space"))
        return self._cache[n]

    def box(self, n: int, key: str) -> Box | None:
        return self.slide(n)[1].get(key)
