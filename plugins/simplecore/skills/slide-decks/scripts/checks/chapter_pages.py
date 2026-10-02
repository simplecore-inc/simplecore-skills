#!/usr/bin/env python3
"""A topic set on several pages carries (n/total) on each of them, and only then.

A page that continues the previous page's topic repeats its title with
「(1/2)」 and 「(2/2)」 after it, so a reader who opens the second page knows a
first exists. The marker is written by hand, and it goes stale the moment a
page is added to the topic or one is taken out: 「(2/2)」 on the second of
three pages, or a lone page still marked 「(1/2)」 after its sibling moved.

Pages are grouped by part, chapter and the marked argument with its marker
removed, in printed order, never by the chapter number alone: two topics of
one chapter are two groups.

Config (optional):

    "checks": { "chapter_pages": { "slot": "title" } }   // the running-head argument that carries
                                                         // the marker; default pages.head.title
"""
from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader  # noqa: E402

MARKER = re.compile(r"\s*\((\d+)\s*/\s*(\d+)\)\s*$")


def slot(reader: DeckReader, deck: DeckConfig) -> str:
    name = deck.get("checks.chapter_pages.slot") or reader.pages_config.head.get("title")
    if not name:
        raise ConfigError(f"deck `{deck.name}`: neither `checks.chapter_pages.slot` nor "
                          "`pages.head.title` names the argument that carries the (n/total) marker")
    return name


def check(reader: DeckReader, deck: DeckConfig) -> tuple[int, int, list[str]]:
    """(body pages, topics on more than one page, findings)."""
    arg = slot(reader, deck)
    pages = reader.body_pages()
    values = [str(p.head.get(arg, "")).strip() for p in pages]
    keys = [(p.part, p.chapter, MARKER.sub("", v)) for p, v in zip(pages, values)]
    totals = Counter(keys)
    seen: Counter = Counter()
    bad = []
    for page, value, key in zip(pages, values, keys):
        seen[key] += 1
        m = MARKER.search(value)
        n, total = seen[key], totals[key]
        if total == 1:
            if m:
                bad.append(f"{page.label}: 「{value}」 is the only page of its topic and carries a marker")
            continue
        want = f"({n}/{total})"
        if not m:
            bad.append(f"{page.label}: 「{value}」 is page {n} of {total} of its topic and carries no {want}")
        elif (int(m.group(1)), int(m.group(2))) != (n, total):
            bad.append(f"{page.label}: 「{value}」 should end {want}")
    multi = sum(1 for n in totals.values() if n > 1)
    return len(pages), multi, bad


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0]).parse_args(argv)
    deck = cli.deck_config(args)
    with cli.open_reader(deck) as reader:
        pages, multi, bad = check(reader, deck)
    print(f"chapter_pages: {pages} body pages, {multi} topics set on more than one page, "
          f"{len(bad)} markers wrong")
    for line in bad:
        print(f"  ✖ {line}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
