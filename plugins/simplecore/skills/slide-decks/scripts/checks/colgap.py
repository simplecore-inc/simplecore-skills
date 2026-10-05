#!/usr/bin/env python3
"""A column that stops early or opens a hole while its neighbour goes on.

On a page set in columns, a column ending a hand's breadth above its neighbour
reads as a column the author ran out of words for, and a band of paper inside
a column reads as a block that went missing. `foothole` sees only the page's
lowest ink, so a page whose other column reaches the foot passes it however
short the first one is, and a section stretched to the height left opens the
hole inside itself where no fill measure looks. Panel reviews found these by
eye three rounds running; this check reads them from the layout.

Every slide's layout tree (`slide_tree`) is read. A row whose children include
two or more boxes at least a fifth of the page wide, standing on one line (the
same top; a wrapping row has several), is a set of columns. In
each column the boxes that draw something (text, a picture, a table, an icon,
a shape; not the stacks around them) are projected onto the vertical axis.
A column whose drawn content ends more than `max` (a share of the page
height) above the lowest column's is reported as `bottom`; an uncovered run
taller than `max` between a column's first and last drawn box is reported as
`hole`. When every column of the row stops more than `max` above the box the
row was given (a row stretched to the page's body), the band is reported as
`foot`. A judged slide is retired in `<checks.baselines>/colgap.json` with its
reason; the measure is the largest gap rounded to 10 px.

Config (`checks.colgap`, optional): `masters` (regex, default `.`), `max`
(0.08), `minColumn` (0.2, a share of the page width).

    colgap.py           # every matching slide
"""
from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.baseline import Baseline, judge  # noqa: E402
from bidkit.config import DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader  # noqa: E402

NODE = re.compile(r"node#(\d+)\s+(\w+)\s+\[(-?[\d.]+),(-?[\d.]+) ([\d.]+)×([\d.]+)\]")
SLIDE = re.compile(r"^\s*(\d+)\s+master=(\S+)")
HEAD = re.compile(r"^slide \d+\s+master=(\S+)\s+(\d+)×(\d+)")
CONTAINERS = {"VStack", "HStack", "Layer", "Group"}


@dataclass
class Node:
    kind: str
    x: float
    y: float
    w: float
    h: float
    depth: int
    children: list["Node"] = field(default_factory=list)

    def leaves(self) -> list["Node"]:
        if self.kind not in CONTAINERS:
            return [self] if self.h > 0 else []
        return [leaf for c in self.children for leaf in c.leaves()]


def parse(tree: str) -> tuple[str, float, float, Node | None]:
    """(master, page width, page height, root) of one `slide_tree` answer."""
    lines = tree.splitlines()
    head = HEAD.match(lines[0]) if lines else None
    master, pw, ph = (head.group(1), float(head.group(2)), float(head.group(3))) if head else ("", 0.0, 0.0)
    root, stack = None, []
    for line in lines[1:]:
        m = NODE.search(line)
        if not m:
            continue
        node = Node(m.group(2), *(float(m.group(i)) for i in range(3, 7)), depth=m.start())
        while stack and stack[-1].depth >= node.depth:
            stack.pop()
        if stack:
            stack[-1].children.append(node)
        elif root is None:
            root = node
        stack.append(node)
    return master, pw, ph, root


def covered(leaves: list[Node]) -> list[tuple[float, float]]:
    """The vertical runs the drawn boxes cover, merged."""
    out: list[list[float]] = []
    for top, bottom in sorted((n.y, n.y + n.h) for n in leaves):
        if out and top <= out[-1][1]:
            out[-1][1] = max(out[-1][1], bottom)
        else:
            out.append([top, bottom])
    return [(a, b) for a, b in out]


def gaps(root: Node, pw: float, ph: float, share: float, min_column: float) -> list[tuple[str, float, float, float]]:
    """[(kind, column x, gap px, gap top y)] for every `bottom` and `hole` over the limit."""
    limit = ph * share
    out = []

    def visit(node: Node) -> None:
        wide = [c for c in node.children if c.w >= pw * min_column]
        # a wrapping row sets its boxes on several lines; only boxes on one
        # line stand beside each other
        lines: dict[float, list[Node]] = {}
        for c in wide:
            top = next((t for t in lines if abs(t - c.y) <= 2), c.y)
            lines.setdefault(top, []).append(c)
        for line in lines.values() if node.kind == "HStack" else ():
            if len(line) < 2:
                continue
            ends = []
            for col in line:
                runs = covered(col.leaves())
                if not runs:
                    continue
                ends.append((col, runs[-1][1]))
                for (_, b), (a, _) in zip(runs, runs[1:]):
                    if a - b > limit:
                        out.append(("hole", col.x, a - b, b))
            if len(ends) >= 2:
                lowest = max(e for _, e in ends)
                for col, end in ends:
                    if lowest - end > limit:
                        out.append(("bottom", col.x, lowest - end, end))
                # every column stopping well above the box the row was given
                floor = max(c.y + c.h for c in line)
                if floor - lowest > limit:
                    out.append(("foot", line[0].x, floor - lowest, lowest))
        for c in node.children:
            visit(c)

    visit(root)
    return sorted(out, key=lambda f: (f[1], f[3]))


def find(reader: DeckReader, deck: DeckConfig) -> list[tuple[str, float, str]]:
    """[(slide label, largest gap px, what)] for each slide with a gap over the limit."""
    cfg = deck.section("checks.colgap")
    masters = re.compile(str(cfg.get("masters", ".")))
    share = float(cfg.get("max", 0.08))
    min_column = float(cfg.get("minColumn", 0.2))
    out = []
    # slides and masters straight from `sg://deck`, so a deck with no page-id scheme is read too
    for line in reader.session.read("sg://deck").splitlines():
        m = SLIDE.match(line)
        if not m or not masters.search(m.group(2)):
            continue
        n = int(m.group(1))
        answer = reader.session.call("slide_tree", {"slide": n})
        tree = "".join(c.get("text", "") for c in answer.get("content", []))
        _, pw, ph, root = parse(tree)
        if root is None:
            continue
        found = gaps(root, pw, ph, share, min_column)
        if found:
            what = "; ".join(f"{k} {g:.0f} px in the column at x {x:.0f} from y {y:.0f}" for k, x, g, y in found)
            out.append((f"slide {n}", max(f[2] for f in found), what))
    return out


def key(item: tuple) -> str:
    return item[0]


def measure(item: tuple) -> int:
    return int(round(item[1], -1))


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0], bless=True).parse_args(argv)
    deck = cli.deck_config(args)
    baseline = Baseline.for_check(deck, "colgap")
    with cli.open_reader(deck) as reader:
        found = find(reader, deck)
    if args.bless:
        return cli.report_bless(baseline, {key(f): measure(f) for f in found}, "column gaps")
    live, owed = judge(baseline, found, key, measure)
    print(f"colgap: {len(live)} slides with a column ending early or a hole in a column, "
          f"{len(owed)} retired without a reason ({len(baseline.entries)} baseline entries)")
    for label, _, what in live:
        print(f"  ✖ {label}: {what}")
    for label, gap, _ in owed:
        print(f"  ✖ {label}: retired with a blank reason; write why ({gap:.0f} px)")
    return 1 if live or owed else 0


if __name__ == "__main__":
    sys.exit(main())
