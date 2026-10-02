#!/usr/bin/env python3
"""Figure numbers run from 1 without a gap or a repeat, and every citation finds its figure.

A figure's number is typed by hand when the figure is placed. A number used
twice, or one skipped, renders cleanly and lints quietly: the reader looking
for a figure finds two, or notices that it does not exist. One deck printed two
figures under each of two numbers, skipped two more, ran one part's figures
out of order and opened another part at its second figure.

The number's format is declared (`figures.numbering.caption`, fields `part`,
optional `chapter`, `n`; `figures.numbering.annex`, fields `a`, `n`, a
series of its own per annex: two series in one count make each other's gaps).
A series is everything before the number: one per part, or per chapter when
the format carries one.

- The deck: the number argument of each figure component (vocabulary
  `roles.figureNumber`), in printed order, runs 1..n per series.
- The manuscript: the caption lines (`manuscript.caption`) of the manuscript
  files in path order run 1..n per series.
- A citation of a figure in the deck's sources (comments set aside) resolves
  against the deck's numbers; one in the manuscript (fenced code set aside)
  against the manuscript's captions. The two number separately until the
  deck is typeset from the manuscript.

Config (`checks.fignum`, optional):

- `deckOrder`: `strict` (default) or `monotonic`, for a deck typeset a part of
  a chapter at a time, where the numbers only have to rise.
- `deckInManuscript` (false): a number the deck prints must be a manuscript
  caption's, so the deck carries no figure the manuscript does not know.
- `idle` (false): a figure captioned in a manuscript file that a page declares
  (`manuscript.declaration`) and placed on no page fails, unless retired in
  `<checks.baselines>/fignum.json` with its reason: a drawn figure is the
  cheapest material for a short page. A manuscript no page declares is not
  typeset yet and is not judged.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.baseline import Baseline, judge  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader, format_pattern, strip_comments  # noqa: E402
from bidkit.manuscript import Manuscript  # noqa: E402
from bidkit.vocab import role  # noqa: E402

FENCE = re.compile(r"^```.*?^```", re.S | re.M)


class Numbering:
    """The declared number formats, read forwards (a series and a number) and in text."""

    def __init__(self, deck: DeckConfig, numerals: str):
        caption = deck.require("figures.numbering.caption", "the figure number format, e.g. 「그림 {part}-{n}」")
        formats = [format_pattern(caption, {"part": f"(?:{numerals})", "chapter": r"\d+", "n": r"\d+"})]
        annex = deck.get("figures.numbering.annex")
        if annex:
            formats.append(format_pattern(annex, {"a": r"\d+", "n": r"\d+"}))
        for f in formats:
            if "(?P<n>" not in f:
                raise ConfigError("a figure number format must carry the field {n}")
        self.rx = [re.compile(f) for f in formats]

    def parse(self, s: str) -> tuple[str, int] | None:
        """(series, number) for a string that opens with a figure number."""
        for rx in self.rx:
            m = rx.match(s.strip())
            if m:
                return m.group(0)[:m.start("n") - m.start()], int(m.group("n"))
        return None

    def find(self, text: str):
        """(offset, label) for every figure number written in a text."""
        for rx in self.rx:
            for m in rx.finditer(text):
                yield m.start(), m.group(0)


Series = dict[str, list[tuple[int, str]]]


def deck_numbers(reader: DeckReader, numbering: Numbering, args: dict) -> Series:
    """series -> [(number, page)] in printed order."""
    out: Series = {}
    for page in reader.slides():
        for use in page.uses:
            arg = args.get(use.tag)
            parsed = numbering.parse(use.attrs.get(arg, "")) if arg else None
            if parsed:
                out.setdefault(parsed[0], []).append((parsed[1], page.label))
    return out


def manuscript_numbers(ms: Manuscript, numbering: Numbering) -> tuple[Series, dict[str, str]]:
    """(series -> [(number, file)] in path order, {label: file})."""
    out: Series = {}
    where: dict[str, str] = {}
    for path in ms.files():
        rel = path.relative_to(ms.dir).as_posix()
        for line in ms.captions(path.read_text(encoding="utf-8")):
            parsed = numbering.parse(line)
            if parsed:
                out.setdefault(parsed[0], []).append((parsed[1], rel))
                where.setdefault(f"{parsed[0]}{parsed[1]}", rel)
    return out, where


def strict_errors(series: Series) -> list[tuple[str, list, list]]:
    bad = []
    for key, items in sorted(series.items()):
        nums = [n for n, _ in items]
        want = list(range(1, len(nums) + 1))
        if nums != want:
            bad.append((key, items, want))
    return bad


def monotonic_errors(series: Series) -> list[tuple[str, list, list]]:
    bad = []
    for key, items in sorted(series.items()):
        nums = [n for n, _ in items]
        if any(b <= a for a, b in zip(nums, nums[1:])):
            bad.append((key, items, sorted(set(nums))))
    return bad


def labels(series: Series) -> set[str]:
    return {f"{k}{n}" for k, items in series.items() for n, _ in items}


def check(reader: DeckReader, deck: DeckConfig) -> dict:
    cfg = deck.section("checks.fignum")
    order = cfg.get("deckOrder", "strict")
    if order not in ("strict", "monotonic"):
        raise ConfigError("`checks.fignum.deckOrder` is `strict` or `monotonic`")
    numbering = Numbering(deck, reader.pages_config.numeral_pattern())
    args, _ = role(deck, reader.vocab, "fignum", "figureNumber")
    if not isinstance(args, dict) or not args:
        raise ConfigError("neither checks.fignum nor the vocabulary names `figureNumber`, "
                          "the argument a figure prints its number in")
    ms = Manuscript.for_deck(deck)
    deck_series = deck_numbers(reader, numbering, args)
    ms_series, ms_where = manuscript_numbers(ms, numbering)
    out = {"deck": deck_series, "manuscript": ms_series,
           "sequence": [("deck",) + b for b in (strict_errors if order == "strict" else monotonic_errors)(deck_series)]
           + [("manuscript",) + b for b in strict_errors(ms_series)]}
    in_deck, in_ms = labels(deck_series), labels(ms_series)

    number_args = {re.escape(a) for a in args.values()}
    own = re.compile(r"(?<![\w-])(?:" + "|".join(number_args) + r")=[\"']$")
    dangling = []
    for name, raw in reader.files():
        text = strip_comments(raw)
        for pos, label in numbering.find(text):
            if not own.search(text[max(0, pos - 40):pos]) and label not in in_deck:
                dangling.append((name, label))
    for path in ms.files(include_excluded=False):
        text = FENCE.sub("", path.read_text(encoding="utf-8"))
        for _, label in numbering.find(text):
            if label not in in_ms:
                dangling.append((path.relative_to(ms.dir).as_posix(), label))
    out["dangling"] = dangling

    out["unknown"] = ([(page, f"{k}{n}") for k, items in deck_series.items() for n, page in items
                       if f"{k}{n}" not in in_ms] if cfg.get("deckInManuscript", False) else None)
    if cfg.get("idle", False):
        declared = {p for _, raw in reader.files() for p in ms.declarations(raw)}
        out["idle"] = sorted((label, rel) for label, rel in ms_where.items()
                             if rel in declared and label not in in_deck)
    else:
        out["idle"] = None
    return out


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0], bless=True).parse_args(argv)
    deck = cli.deck_config(args)
    with cli.open_reader(deck) as reader:
        r = check(reader, deck)
    idle_owed: list = []
    if r["idle"] is not None:
        baseline = Baseline.for_check(deck, "fignum")
        if args.bless:
            return cli.report_bless(baseline, {label: None for label, _ in r["idle"]}, "unplaced figures")
        r["idle"], idle_owed = judge(baseline, r["idle"], lambda x: x[0])
    elif args.bless:
        print("fignum: nothing to retire; only checks.fignum.idle findings take a baseline")
        return 0
    deck_total = sum(len(v) for v in r["deck"].values())
    ms_total = sum(len(v) for v in r["manuscript"].values())
    print(f"fignum: deck {len(r['deck'])} series, {deck_total} figures; manuscript {len(r['manuscript'])} "
          f"series, {ms_total} figures; {len(r['sequence'])} series out of sequence, "
          f"{len(r['dangling'])} citations of no figure")
    for where, key, items, want in r["sequence"]:
        print(f"  ✖ {where} {key}: printed {[n for n, _ in items]}, expected {want}")
        for (num, at), w in zip(items, want):
            mark = "" if num == w else f"  -> {key}{w}"
            print(f"      {key}{num:<3} {at}{mark}")
    for name, label in r["dangling"]:
        print(f"  ✖ {name}: 「{label}」 cites a figure that does not exist")
    if r["dangling"]:
        print("  a figure renumbered takes its citations with it")
    for page, label in r["unknown"] or []:
        print(f"  ✖ {page}: the deck prints 「{label}」, which no manuscript caption carries")
    for label, rel in r["idle"] or []:
        print(f"  ✖ 「{label}」 is drawn in {rel}, which a page declares, and placed on no page")
    for label, rel in idle_owed:
        print(f"  ✖ 「{label}」 ({rel}): retired with a blank reason; write why")
    failed = r["sequence"] or r["dangling"] or r["unknown"] or r["idle"] or idle_owed
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
