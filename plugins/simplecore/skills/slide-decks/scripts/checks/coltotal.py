#!/usr/bin/env python3
"""A total row must equal the column above it.

A reviewer adds a column with a finger. Where a total is right for a reason
the column does not show (the same devices counted twice, once as raw channels
and once as derived values), the arithmetic still has to close on the page, so
the cell that is not a fresh count says so in words rather than repeating the
number.

Only rows whose label is a total word are checked, and only columns whose
other cells are all numeric. A table that runs onto the next page with its
header repeated is read as one table, so a total on the last piece is checked
against every piece.

Config (`checks.coltotal`, optional): `totalLabels` (the words a total row's
first cell carries), `tolerance` (default 0.5).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.config import DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader  # noqa: E402

TOTAL_LABELS = ["합계", "소계", "계", "총계", "누계"]
NUMBER = re.compile(r"^-?[\d,]+(?:\.\d+)?$")


def value(cell: str) -> float | None:
    cell = cell.strip()
    return float(cell.replace(",", "")) if NUMBER.match(cell) else None


def mismatches(grid: list, labels: set, tolerance: float) -> list | None:
    """[(head, sum, claimed)] for one table, or None when it has no total row."""
    if len(grid) < 3:
        return None
    width = max(len(r) for r in grid)
    if any(len(r) != width for r in grid):
        return None
    head, last = grid[0], grid[-1]
    if not last or last[0].strip() not in labels:
        return None
    body = grid[1:-1]
    out = []
    for col in range(1, width):
        claimed = value(last[col])
        if claimed is None:
            continue
        parts = [value(r[col]) for r in body]
        if any(p is None for p in parts):
            continue      # a cell that is words, not a fresh count
        got = sum(p for p in parts if p is not None)
        if abs(got - claimed) > tolerance:
            out.append((head[col].strip(), got, claimed))
    return out


def find(reader: DeckReader, deck: DeckConfig) -> tuple[int, list]:
    """(tables with a total row, [(page, table, head, sum, claimed)])."""
    cfg = deck.section("checks.coltotal")
    labels = set(cfg.get("totalLabels", TOTAL_LABELS))
    tolerance = float(cfg.get("tolerance", 0.5))
    totals, bad = 0, []
    for page, index, grid in reader.tables(join_continued=True):
        found = mismatches(grid, labels, tolerance)
        if found is None:
            continue
        totals += 1
        bad += [(page, index, head, got, claimed) for head, got, claimed in found]
    return totals, bad


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0]).parse_args(argv)
    deck = cli.deck_config(args)
    with cli.open_reader(deck) as reader:
        totals, bad = find(reader, deck)
    print(f"coltotal: {totals} tables with a total row, {len(bad)} sums that disagree")
    for page, index, head, got, claimed in bad:
        print(f"  ✖ {page} table {index} 「{head}」: the column adds to {got:g}, "
              f"the total row says {claimed:g}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
