#!/usr/bin/env python3
"""A manuscript a page declares and does not carry.

Every page names its manuscript source in a declaration comment. `parity`
reads that declaration to check that what the page prints comes from the
manuscript; this reads it the other way: how much of the manuscript's prose
the pages that declare it actually print.

The gap is invisible to every other check, because the page it leaves behind is
a good page. One deck declared a section on its first page and typeset none of
its seventeen sentences while the page itself was full, shaped and passing.
A declaration is a promise the deck made; a section carried below the floor is
a promise nobody kept. A deck condenses, so this does not ask for every
sentence: below `floor`, a reader holding the manuscript beside the deck would
say the section is missing.

Counted: the manuscript's prose sentences (its printed part when
`manuscript.printed` is declared), without tables, headings, quotations,
figures, caption lines (`manuscript.caption`) and `manuscript.skipLines`.
Compared, loosely (spacing and separators ignored), with the printed text of
every slide drawn from a source file that declares the manuscript.

Config (`checks.carry`, optional): `floor` (0.25), `minUnits` (4), `minLen` (12).
"""
from __future__ import annotations

import re
import sys
from re import Pattern
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.baseline import Baseline, judge  # noqa: E402
from bidkit.config import DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader  # noqa: E402
from bidkit.manuscript import Manuscript  # noqa: E402
from bidkit.textko import loose, norm, sentences  # noqa: E402

FLOOR, MIN_UNITS, MIN_LEN = 0.25, 4, 12
SKIP_START = ("|", "#", ">", "!")
LIST_ITEM = re.compile(r"^(?:[-*+]|\d{1,2}[.)])\s+")


def prose_units(md: str, manuscript: Manuscript, skip: list[Pattern], end: str, min_len: int) -> list[str]:
    """The manuscript's own sentences, without its tables, headings and figures."""
    if manuscript.printed and manuscript.page:
        # A file with no printed part (an authoring plan) promises nothing printed.
        md = "\n".join(body for _, body in manuscript.printed_pages(md))
    md = re.sub(r"^```.*?^```", " ", md, flags=re.S | re.M)
    caption = re.compile(manuscript.caption) if manuscript.caption else None
    blocks: list[list[str]] = [[]]
    for line in md.split("\n"):
        t = line.strip()
        if not t:
            blocks.append([])
            continue
        if t.startswith(SKIP_START) or (caption and caption.match(t)) or any(p.match(t) for p in skip):
            blocks.append([])
            continue
        item = LIST_ITEM.match(t)
        if item:                       # a list item is a unit of its own
            blocks += [[t[item.end():]], []]
            continue
        blocks[-1].append(t)
    out = []
    for block in blocks:
        text = norm(re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", " ".join(block)))
        out += [u for u in sentences(text, end) if len(u) >= min_len]
    return out


def measure(reader: DeckReader, deck: DeckConfig) -> tuple[int, list[dict]]:
    """(declared manuscripts, [{md, files, carried, total, missing}] below the floor)."""
    cfg = deck.section("checks.carry")
    floor = float(cfg.get("floor", FLOOR))
    min_units = int(cfg.get("minUnits", MIN_UNITS))
    min_len = int(cfg.get("minLen", MIN_LEN))
    manuscript = Manuscript.for_deck(deck)
    skip = [re.compile(p) for p in deck.get("manuscript.skipLines", []) or []]
    end = deck.get("lang.sentenceEnd", "다.")
    owners: dict[str, list[str]] = {}
    for name, raw in reader.files():
        for rel in manuscript.declarations(raw):
            owners.setdefault(rel, [])
            if name not in owners[rel]:
                owners[rel].append(name)
    sources = reader.slide_sources()
    text_of: dict[str, list[str]] = {}
    for page in reader.slides():
        text_of.setdefault(sources.get(page.n, ""), []).extend(page.texts)
    out = []
    for rel, files in sorted(owners.items()):
        path = manuscript.dir / rel
        if not path.is_file():
            continue
        units = prose_units(path.read_text(encoding="utf-8"), manuscript, skip, end, min_len)
        if len(units) < min_units:
            continue
        printed = loose(" ".join(norm(t) for f in files for t in text_of.get(f, [])))
        missing = [u for u in units if loose(u) not in printed]
        carried = len(units) - len(missing)
        if carried / len(units) < floor:
            out.append({"md": rel, "files": files, "carried": carried, "total": len(units),
                        "missing": missing})
    return len(owners), out


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0], bless=True).parse_args(argv)
    deck = cli.deck_config(args)
    baseline = Baseline.for_check(deck, "carry")
    with cli.open_reader(deck) as reader:
        declared, low = measure(reader, deck)
    if args.bless:
        return cli.report_bless(baseline, {r["md"]: None for r in low}, "sections carried below the floor")
    live, owed = judge(baseline, low, lambda r: r["md"])
    print(f"carry: {declared} declared manuscripts, {len(live)} carried below the floor, "
          f"{len(owed)} retired without a reason")
    for r in sorted(live, key=lambda r: r["carried"] / r["total"]):
        mark = "✖" if r["carried"] == 0 else "⚠"
        print(f"  {mark} {r['md']}: {r['carried']} of {r['total']} prose sentences printed "
              f"({r['carried'] / r['total']:.0%}), declared by {', '.join(r['files'])}")
        for m in r["missing"][:4]:
            print(f"       · {m[:96]}")
    for r in owed:
        print(f"  ✖ {r['md']}: retired with a blank reason; write why")
    return 1 if live or owed else 0


if __name__ == "__main__":
    sys.exit(main())
