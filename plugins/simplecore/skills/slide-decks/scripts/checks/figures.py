#!/usr/bin/env python3
"""A figure quoted from another part must be printed in that part.

A number corrected in one part and quoted in another leaves a mismatch that
only a reader holding both parts open sees: one deck corrected a test count
from 462 to 593 on its first page, and a later page's 「Ⅰ에서 인용한 … 462건」
pointed at nothing until a person read the two side by side.

Gathering numbers with the same label across parts finds mostly legitimate
differences (46 requirements beside 98, a final 300,000 beside a first
100,000), and then nobody reads the output. So only a sentence that says
which part it quotes is read: that claim is true or false, with no room for
interpretation. The quoted value with its unit has to be printed on a body
page of the named part.

Read from the printed pages, so a quotation inside a table cell or a
component's item list is read too.

Config (`checks.figures`, optional): `cite` (the words that say a value is
quoted, default 「에서 인용한」 with any spacing), `units` (the units a quoted
value is counted in), `reach` (40 characters between the claim and the value).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.config import DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader  # noqa: E402

CITE = r"에서\s*인용한"
UNITS = ["건", "대", "종", "쪽", "개"]
REACH = 40
# A part may be named with its chapter and the word for part or chapter: 「Ⅰ-2장에서」.
PART_SUFFIX = r"(?:-\d+)?\s*(?:부|장)?\s*"


def pattern(deck: DeckConfig, numerals: str) -> re.Pattern:
    cfg = deck.section("checks.figures")
    units = "|".join(re.escape(u) for u in sorted(cfg.get("units", UNITS), key=len, reverse=True))
    reach = int(cfg.get("reach", REACH))
    return re.compile(rf"({numerals}){PART_SUFFIX}(?:{cfg.get('cite', CITE)})"
                      rf"[^.。]{{0,{reach}}}?([\d,]+)\s*({units})")


def find(reader: DeckReader, deck: DeckConfig) -> list[tuple[str, str, str, str, list]]:
    """[(citing page, part, value, unit, [pages of that part])] for each quoted value the part lacks."""
    pages = reader.slides()
    rx = pattern(deck, reader.pages_config.numeral_pattern())
    bad = []
    for page in pages:
        for m in rx.finditer(page.text):
            part, value, unit = m.group(1), m.group(2), m.group(3)
            target = [p for p in pages if p.part == part and p.page_id]
            if not target:
                continue              # the part is not typeset yet
            needle = re.compile(re.escape(value) + r"\s*" + re.escape(unit))
            if not any(needle.search(t.text) for t in target):
                where = f"page {page.folio}" if page.folio else page.label
                bad.append((where, part, value, unit, [t.page_id for t in target]))
    return bad


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0]).parse_args(argv)
    deck = cli.deck_config(args)
    with cli.open_reader(deck) as reader:
        bad = find(reader, deck)
    print(f"figures: {len(bad)} values quoted from a part that does not print them")
    for where, part, value, unit, target in bad:
        print(f"  ✖ {where}: quotes {value}{unit} from {part}, and none of its {len(target)} pages prints it")
    if bad:
        print("  correct the part that changed the value and every page that quotes it together")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
