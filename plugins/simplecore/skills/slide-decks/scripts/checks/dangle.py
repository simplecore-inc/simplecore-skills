#!/usr/bin/env python3
"""Deck text that stops on a connective ending.

A card splits one claim over two labelled rows, and the first row often ends on
「~하고」 or 「~하며」 because the second finishes the sentence. That is the
split working. It stops working when the row that dangles is the last one the
reader sees: the sentence never closes, and the page shows a fragment.

This reads the sentence slots of every component (the kit vocabulary's
`sentences`, in reading order) and the printed table cells, and reports a
string whose last clause ends on a connective where no later row of the same
claim finishes it. Each item of a JSON list is a claim of its own.

The endings are Korean connectives. 「~고」 closes many nouns too (재고, 보고,
권고), so a word ending in 고 is a connective only when the clause carries a
particle and the word is not one of those nouns. A project adds its own such
nouns with `checks.dangle.nounGo`.

Config (`checks.dangle`, optional): `minLen` (6), `nounGo` (extra nouns).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.baseline import Baseline, judge  # noqa: E402
from bidkit.config import DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader  # noqa: E402
from period import source_rows, visible  # noqa: E402

# Endings that hand the predicate to the next clause. 「~한다」 · 「~이다」 close
# a sentence and are not here; a noun phrase does not end in any of these.
CONNECTIVE = re.compile(
    r"(하고|되고|하며|되며|않으며|하되|되되|이며|이고|하여|되어|면서|지만|거나|"
    r"으로써|함으로써|한다면|하려면|하도록|되도록|이나|보다|처럼|같이|"
    r"들어|들며|하지만|아니라|더라도|는데|은데)$")

# Nouns whose last syllable is 고. A bare noun here is a family: the language
# compounds it (안전재고 · 현재 재고 · 월간보고), so NOUN_GO_TAIL is the part a
# compound may end in; never 보고, because a verb does too (「검토해 보고」).
NOUN_GO = {
    "재고", "보고", "참고", "창고", "사고", "광고", "신고", "경고", "중고",
    "최고", "원고", "공고", "예고", "출고", "입고", "냉장고", "권고",
    "월간보고", "주간보고", "착수보고", "중간보고", "완료보고", "긴급보고",
    "정기보고", "비정기보고", "후속보고", "서면보고", "완료보고회",
}
NOUN_GO_TAIL = ("재고", "창고", "출고", "입고", "공고", "예고", "경고", "신고", "권고")

# A clause has a subject or an object; a list of nouns has neither, and its
# last word may end in 고 without being a verb.
PARTICLE = re.compile(r"[가-힣](을|를|이|가|은|는|에|와|과|로|의)(\s|$)")
MIN_LEN = 6


def tail(value: str) -> str:
    """The last clause a reader sees, the explicit break honoured."""
    return visible(value).strip("」、,·")


def connective(t: str, nouns: set[str]) -> bool:
    """True when the clause hands its predicate to a clause that is not there."""
    if CONNECTIVE.search(t):
        return True
    words = t.split()
    word = words[-1] if words else ""
    if len(word) < 2 or not word.endswith("고") or word in nouns or word.endswith(NOUN_GO_TAIL):
        return False
    return bool(PARTICLE.search(t))


def find(reader: DeckReader, deck: DeckConfig) -> list[tuple[str, str, str]]:
    """[(where, slot, clause)] for each claim that finishes on a connective."""
    cfg = deck.section("checks.dangle")
    min_len = int(cfg.get("minLen", MIN_LEN))
    nouns = NOUN_GO | set(cfg.get("nounGo", []))
    out = []
    for name, line, template, row in source_rows(reader):
        slot, value = row[-1]
        t = tail(value)
        if len(t) >= min_len and connective(t, nouns):
            out.append((f"{name}:{line}", f"{template}.{slot}", t))
    for page in reader.slides():
        for _, cells in page.rows:
            for cell in cells:
                t = tail(cell)
                if len(t) >= min_len and connective(t, nouns):
                    out.append((page.label, "table cell", t))
    return out


def key(item) -> str:
    where, slot, text = item
    return "\t".join([where.split(":")[0], slot, text[:60]])


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0], bless=True).parse_args(argv)
    deck = cli.deck_config(args)
    baseline = Baseline.for_check(deck, "dangle")
    with cli.open_reader(deck) as reader:
        found = find(reader, deck)
    if args.bless:
        return cli.report_bless(baseline, {key(f): None for f in found}, "dangling clauses")
    live, owed = judge(baseline, found, key)
    print(f"dangle: {len(found)} claims finish on a connective, {len(live)} live, "
          f"{len(owed)} retired without a reason")
    for where, slot, text in live:
        print(f"  ✖ {where} {slot}: {text[:80]}")
    for where, slot, text in owed:
        print(f"  ✖ {where} {slot}: retired with a blank reason; write why · {text[:50]}")
    return 1 if live or owed else 0


if __name__ == "__main__":
    sys.exit(main())
