#!/usr/bin/env python3
"""The pages the tender counts must stay inside its page limit.

A tender caps the numbered pages and names what it leaves out (a cover, the
contents, an annex). The deck's own folio is that count: the deck reader gives
a folio to every page but the annex and the folioless pages before the first
folio, which is how the printed copy is numbered. A deck over the cap is a
proposal the panel may refuse to read past the limit, so the finding prints
the clause the cap comes from.

Config:

    "budget": { "maxNumbered": 100,                            // required
                "clause": "제안요청서 「나. 서류 제출방법 3)」" }   // optional: cited beside a finding
    "pages": { ... }                                           // how folios are computed
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader  # noqa: E402


def count(reader: DeckReader, deck: DeckConfig) -> tuple[dict, list[str]]:
    """({front, annex, dividers, body, numbered, cap}, [findings])."""
    cap = deck.require("budget.maxNumbered", "the numbered-page ceiling the tender sets")
    if not isinstance(cap, int) or cap <= 0:
        raise ConfigError(f"deck `{deck.name}` `budget.maxNumbered` must be a positive integer")
    cfg = reader.pages_config
    slides = reader.slides()
    numbered = [s for s in slides if s.folio]
    annex = [s for s in slides if cfg.is_("annex", s.master)]
    front = [s for s in slides if not s.folio and not cfg.is_("annex", s.master)]
    dividers = [s for s in numbered if cfg.is_("divider", s.master)]
    counts = {"front": len(front), "annex": len(annex), "dividers": len(dividers),
              "body": len(numbered) - len(dividers), "numbered": len(numbered), "cap": cap}
    bad = []
    if len(numbered) > cap:
        clause = deck.get("budget.clause")
        source = f" ({clause})" if clause else ""
        bad.append(f"{len(numbered)} numbered pages, {len(numbered) - cap} over the limit of {cap}{source}")
    return counts, bad


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0]).parse_args(argv)
    deck = cli.deck_config(args)
    with cli.open_reader(deck) as reader:
        c, bad = count(reader, deck)
    print(f"budget: front {c['front']} · annex {c['annex']} (not numbered) · dividers {c['dividers']} · "
          f"body {c['body']} -> numbered {c['numbered']} of {c['cap']}, "
          f"{max(c['cap'] - c['numbered'], 0)} left")
    for line in bad:
        print(f"  ✖ {line}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
