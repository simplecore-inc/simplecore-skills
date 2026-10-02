#!/usr/bin/env python3
"""A body page printed out of the manuscript's own order.

Every page names its manuscript source in a declaration comment above it. The
manuscript decides the reading order (its part directories, its chapter
directories and its numbered files), and the deck prints it in that order. This
walks the deck's import order and reports a body page whose declared source
comes before the source of the page in front of it.

The page that lands out of order is a perfectly good page, which is why nothing
else catches it. It happens when a section that needed a page of its own was
appended to a page file already open; figure numbers say so next, and by then
the repair looks like renumbering. It is not: move the page into its own file,
at its own place in the import order.

A page inherits the declaration standing above it; of several sources declared
together, the first decides the place. Only body pages are read (the kit
vocabulary's `pages.components.body`): an annex is ordered by its own letters.

Config: `manuscript.declaration` (how a declaration opens, e.g. `<!--\\s*md:`).
"""
from __future__ import annotations

import re
import sys
from re import Pattern
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader  # noqa: E402
from bidkit.manuscript import MD_PATH, Manuscript  # noqa: E402


def scanner(declaration: str, body: set[str]) -> Pattern:
    names = "|".join(re.escape(b) for b in sorted(body))
    return re.compile(rf"(?:{declaration})\s*(.+?)-->|<Use\s+template=\"(?:{names})\"", re.S)


def scan(text: str, token: Pattern) -> list[str]:
    """The source each body page of one file declares, in printed order."""
    held, out = "", []
    for m in token.finditer(text):
        if m.group(1) is not None:
            paths = MD_PATH.findall(m.group(1))
            held = paths[0] if paths else held
        elif held:
            out.append(held)
    return out


def inversions(seq: list[tuple[str, str]]) -> list[tuple[str, str, str, str]]:
    """(file, source, file before, source before) for a page that goes back in order."""
    return [(seq[i][0], seq[i][1], seq[i - 1][0], seq[i - 1][1])
            for i in range(1, len(seq)) if seq[i][1] < seq[i - 1][1]]


def find(reader: DeckReader, deck: DeckConfig) -> tuple[list[tuple[str, str]], list]:
    declaration = Manuscript.for_deck(deck)._need("declaration")
    vocab = reader.vocab
    body = set(((vocab.pages() if vocab else {}).get("components") or {}).get("body", []))
    body |= set(deck.get("pages.components.body", []) or [])
    if not body:
        raise ConfigError("neither `pages.components.body` nor the kit vocabulary names the "
                          "component a body page opens with")
    token = scanner(declaration, body)
    seq = [(name, md) for name, raw in reader.files() for md in scan(raw, token)]
    return seq, inversions(seq)


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0]).parse_args(argv)
    deck = cli.deck_config(args)
    with cli.open_reader(deck) as reader:
        seq, back = find(reader, deck)
    print(f"mdorder: {len(seq)} body pages with a declared source, {len(back)} out of order")
    for name, md, before, before_md in back:
        print(f"  ✖ {name}: {md} comes before {before_md}, which {before} printed earlier")
    return 1 if back else 0


if __name__ == "__main__":
    sys.exit(main())
