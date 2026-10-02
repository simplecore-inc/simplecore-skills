#!/usr/bin/env python3
"""The same fact written on two pages with two values.

`figures` sees only a sentence that says which part it quotes. Two pages that
each state the same fact without saying so slip past it: one page counted 61
reference figures and another 63, and only a reader holding both pages open
saw it.

Grouping by the number alone gathers mostly legitimate differences (46
functional requirements beside 98 in all, a final 300,000 beside a first
100,000), and then nobody reads the output. So the key is the noun phrase
around the number: 「골든 SVG」 groups, while 「SFR 요구」 and 「전체 요구」 do
not, because their modifiers differ. The key is the last two words before the
number, each without its closing particle, and the unit.

Read per body page, string by string as printed: joining a table's cells
would let one cell's end run into the next row's number and invent a fact.

Config (`checks.samefact`, optional): `units` (the units a fact is counted in,
longest first so 「10개월」 is not read as 「10개」), `sameCount` (units that
count the same thing and are compared as one, default 개 and 장), `unitGuard`
(characters after a unit that turn it into another word, default 월치기),
`maxPrefix` (24 characters of noun phrase read before the number).

Baseline: `<checks.baselines>/samefact.json`, keyed `key<TAB>unit` and measured
by the sorted set of values, so a new value under a judged key fires again.
A bare list of values is a legacy entry and stays retired while unchanged;
`{"values", "why"}` is read as the measure and the reason.
"""
from __future__ import annotations

import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.baseline import Baseline, Entry, judge  # noqa: E402
from bidkit.config import DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader  # noqa: E402
from bidkit.textko import strip_particle  # noqa: E402

UNITS = ["만 건/초", "건/초", "개월", "시간", "개", "장", "건", "종", "대", "쪽", "명", "회", "배",
         "초", "분", "주", "%"]
SAME_COUNT = ["개", "장"]
UNIT_GUARD = "월치기"
MAX_PREFIX = 24
COUNT = "COUNT"
NUMBER = re.compile(r"[\d,.]+")


class Pattern:
    def __init__(self, deck: DeckConfig):
        cfg = deck.section("checks.samefact")
        units = sorted(cfg.get("units", UNITS), key=len, reverse=True)
        self.same_count = set(cfg.get("sameCount", SAME_COUNT))
        guard = cfg.get("unitGuard", UNIT_GUARD)
        width = int(cfg.get("maxPrefix", MAX_PREFIX))
        unit = "|".join(re.escape(u) for u in units)
        tail = f"(?![{re.escape(guard)}])" if guard else ""
        # A particle after the unit is allowed (「화면 21종을」); only a character
        # that makes the unit part of another word stops the match.
        self.rx = re.compile(rf"([가-힣A-Za-z0-9][가-힣A-Za-z0-9\s·\-.]{{1,{width}}}?)\s*"
                             rf"([\d,]+(?:\.\d+)?)\s*({unit}){tail}")

    def facts(self, text: str):
        """(key, unit, value) for every number with a unit in one printed string."""
        for m in self.rx.finditer(text):
            toks = [strip_particle(t) for t in m.group(1).split()]
            toks = [t for t in toks if t and not NUMBER.fullmatch(t)]
            k = " ".join(toks[-2:])
            if k:
                unit = COUNT if m.group(3) in self.same_count else m.group(3)
                yield k, unit, m.group(2)


def find(reader: DeckReader, deck: DeckConfig) -> list[tuple[str, str, dict]]:
    """[(key, unit, {value: [pages]})] for every key printed with more than one value."""
    pattern = Pattern(deck)
    found: dict[tuple[str, str], dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    for page in reader.body_pages():
        for seg in page.texts:
            for k, unit, value in pattern.facts(seg):
                pages = found[(k, unit)][value]
                if page.label not in pages:
                    pages.append(page.label)
    return sorted((k, u, dict(v)) for (k, u), v in found.items() if len(v) > 1)


def key(item: tuple) -> str:
    return f"{item[0]}\t{item[1]}"


def measure(item: tuple) -> list[str]:
    return sorted(item[2])


def migrate(raw_key: str, raw: Any) -> tuple[str, Entry] | None:
    """The `{"values": [...], "why": reason}` form: the values are the measure."""
    if not (isinstance(raw, dict) and ("values" in raw or "why" in raw)):
        return None
    reason = str(raw.get("why") or "")
    return raw_key, Entry(reason, sorted(raw["values"])) if "values" in raw else Entry(reason)


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0], bless=True).parse_args(argv)
    deck = cli.deck_config(args)
    baseline = Baseline.for_check(deck, "samefact", migrate)
    with cli.open_reader(deck) as reader:
        found = find(reader, deck)
    if args.bless:
        return cli.report_bless(baseline, {key(f): measure(f) for f in found}, "divergent facts")
    live, owed = judge(baseline, found, key, measure)
    print(f"samefact: {len(found)} facts printed with more than one value, {len(live)} not judged, "
          f"{len(owed)} retired without a reason ({len(baseline.entries)} baseline entries)")
    for k, unit, values in live:
        changed = " (the values differ from the baseline)" if key((k, unit)) in baseline.entries else ""
        print(f"  ✖ 「{k}」 {unit}{changed}")
        for value, pages in sorted(values.items()):
            print(f"      {value:>9}: {', '.join(pages)}")
    for k, unit, _ in owed:
        print(f"  ✖ 「{k}」 {unit}: retired with a blank reason; write why")
    if live:
        print("  read whether the values mean different things; if they do, --bless and write the reason")
    return 1 if live or owed else 0


if __name__ == "__main__":
    sys.exit(main())
