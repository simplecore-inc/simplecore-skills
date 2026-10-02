#!/usr/bin/env python3
"""A block of text must not appear on two pages.

`echo` compares blocks inside one page. A repeat on the next page slips past
it: a table with its footnote printed on two facing pages, the same three
principle cards on two pages in a row. A reader turning the page meets the
same paragraph twice and cannot tell which one is authoritative.

Every printed string of every slide is compared, page by page as printed,
never file by file: one source file holds several pages. Short strings repeat
legitimately (a column head, a unit, a requirement id), so only strings of at
least `checks.twice.minLen` characters are compared (default 42).

With `checks.twice.sentences`, each string is first split into sentences (on
`lang.sentenceEnd`): the same sentence standing alone in a card on one page and
buried in a paragraph on another is then one repeat, where a whole-string
comparison sees two different blocks. A deck that turns it on lowers the floor
with it: one deck found six repeated instructions of 31 to 35 characters on two
pages only at a floor of 28.

Baseline: `<checks.baselines>/twice.json`, keyed by the string's first 60
characters. A legacy list of keys stays retired; a new entry owes a reason.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.baseline import Baseline, judge  # noqa: E402
from bidkit.config import DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader  # noqa: E402
from bidkit.textko import sentences  # noqa: E402

MIN_LEN = 42
KEY_LEN = 60


def find(reader: DeckReader, deck: DeckConfig) -> list[tuple[str, list[str]]]:
    """[(string, [pages])] for every string printed on more than one page."""
    min_len = int(deck.get("checks.twice.minLen", MIN_LEN))
    split = bool(deck.get("checks.twice.sentences", False))
    end = deck.get("lang.sentenceEnd", "다.")
    where: dict[str, list[str]] = {}
    for page in reader.slides():
        for text in page.texts:
            text = text.strip()
            for s in sentences(text, end) if split else [text]:
                if len(s) >= min_len:
                    pages = where.setdefault(s, [])
                    if page.label not in pages:
                        pages.append(page.label)
    return sorted((s, pages) for s, pages in where.items() if len(pages) > 1)


def key(item: tuple) -> str:
    return item[0][:KEY_LEN]


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0], bless=True).parse_args(argv)
    deck = cli.deck_config(args)
    baseline = Baseline.for_check(deck, "twice")
    with cli.open_reader(deck) as reader:
        found = find(reader, deck)
    if args.bless:
        return cli.report_bless(baseline, {key(f): None for f in found}, "repeated strings")
    live, owed = judge(baseline, found, key)
    print(f"twice: {len(live)} strings printed on two pages or more, {len(owed)} retired without "
          f"a reason ({len(baseline.entries)} baseline entries)")
    for text, pages in live:
        print(f"  ✖ {' · '.join(pages)}")
        print(f"      {text[:78]}")
    for text, pages in owed:
        print(f"  ✖ {' · '.join(pages)}: retired with a blank reason; write why ({text[:40]})")
    return 1 if live or owed else 0


if __name__ == "__main__":
    sys.exit(main())
