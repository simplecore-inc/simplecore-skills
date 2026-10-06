#!/usr/bin/env python3
"""A table column whose every body cell holds the same value carries no information.

It is ink that repeats what one sentence already says, and it takes width from
the columns that do differentiate. Say the fact once, in the head or a note,
and give the width back.

A column is exempt when the sameness is itself the claim: a permission matrix
whose read column holds one value for every role says reading is unrestricted,
and that is only legible next to the columns that differ. Such a column is
retired in the baseline with its reason; the value is part of the finding, so
a changed value fires again.

A table that runs onto the next page with its header repeated is read as one
table, so a column that varies over the whole table is not reported for the
rows that landed on one page.

Config (`checks.samecol`, optional): `minRows` (default 3). Baseline:
`<checks.baselines>/samecol.json`, keyed `page<TAB>table<TAB>head<TAB>value`.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.baseline import LIVE, UNREASONED, Baseline, Entry, parse_entry  # noqa: E402
from bidkit.config import DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader  # noqa: E402

# Cells that say "nothing here"; a column of them is empty, not uniform. The
# dashes are data: a cell may carry any of them.
BLANK = {"", "　", "\u2014", "-", "\u2013"}
MIN_ROWS = 3


def uniform_in(grid: list, min_rows: int = MIN_ROWS) -> list:
    """[(head, value, body rows)] for each column of one table holding one value."""
    if len(grid) < min_rows + 1:
        return []
    width = max(len(r) for r in grid)
    if any(len(r) != width for r in grid):
        return []         # a merged or ragged table is not read here
    head, body = grid[0], grid[1:]
    out = []
    for col in range(width):
        values = {r[col].strip() for r in body}
        if len(values) == 1:
            only = values.pop()
            if only not in BLANK:
                out.append((head[col].strip(), only, len(body)))
    return out


def uniform_columns(reader: DeckReader, deck: DeckConfig) -> tuple[int, list]:
    """(tables read, [(page, table, head, value, rows)] per uniform column)."""
    min_rows = int(deck.section("checks.samecol").get("minRows", MIN_ROWS))
    read, out = 0, []
    for page, index, grid in reader.tables(join_continued=True):
        read += 1
        out += [(page, index, h, v, n) for h, v, n in uniform_in(grid, min_rows)]
    return read, out


def key(page: str, index: int, head: str, value: str) -> str:
    return "\t".join([page, str(index), head, value])


# The names a legacy samecol baseline gave the entry's reason and its value.
LEGACY_REASON, LEGACY_VALUE = "사유", "값"


def migrate(raw_key: str, raw: Any) -> tuple[str, Entry] | None:
    """A legacy samecol entry, translated into the current key and entry; None for a current one.

    Two legacy forms. The key `page<TAB>table<TAB>head` carried the column's
    value as its entry: a bare value, which predates the reason rule and is
    grandfathered, or an object with the reason under 「사유」 and the value
    under 「값」. And an object under the current four-field key may still name
    its reason 「사유」. `--bless` writes each of them in the current keys.
    """
    legacy_object = isinstance(raw, dict) and (LEGACY_REASON in raw or LEGACY_VALUE in raw)
    if raw_key.count("\t") == 2:
        if isinstance(raw, str):
            return raw_key + "\t" + raw, Entry(None)
        if legacy_object and LEGACY_VALUE in raw:
            entry = parse_entry({"reason": raw.get("reason", raw.get(LEGACY_REASON))})
            return raw_key + "\t" + str(raw[LEGACY_VALUE]), Entry(entry.reason)
        return None
    if legacy_object:
        current = {"reason": raw.get("reason", raw.get(LEGACY_REASON))}
        if "measure" in raw or LEGACY_VALUE in raw:
            current["measure"] = raw.get("measure", raw.get(LEGACY_VALUE))
        return raw_key, parse_entry(current)
    return None


def judge(found: list, baseline: Baseline) -> tuple[list, list]:
    """(live findings, findings retired with a blank reason)."""
    live, owed = [], []
    for item in found:
        verdict = baseline.verdict(key(*item[:4]))
        if verdict == LIVE:
            live.append(item)
        elif verdict == UNREASONED:
            owed.append(item)
    return live, owed


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0], bless=True).parse_args(argv)
    deck = cli.deck_config(args)
    baseline = Baseline.for_check(deck, "samecol", migrate)
    with cli.open_reader(deck) as reader:
        read, found = uniform_columns(reader, deck)
    if args.bless:
        return cli.report_bless(baseline, {key(p, i, h, v): None for p, i, h, v, _ in found},
                                "uniform columns")
    live, owed = judge(found, baseline)
    print(f"samecol: {read} tables, {len(live)} columns holding one value, "
          f"{len(owed)} retired without a reason ({len(baseline.entries)} baseline entries)")
    for page, index, head, value, rows in live:
        print(f"  ✖ {page} table {index} 「{head}」: all {rows} cells hold 「{value}」")
    for page, index, head, value, _ in owed:
        print(f"  ✖ {page} table {index} 「{head}」: retired with a blank reason; write why")
    return 1 if live or owed else 0


if __name__ == "__main__":
    sys.exit(main())
