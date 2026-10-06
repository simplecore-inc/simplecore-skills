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

A manuscript file no page declares is read by no other check either, so the
deck's chapter list is the only place its absence shows. With
`checks.carry.undeclared` set, every manuscript file (`manuscript.files()`,
the excluded globs left out) that carries a printed prose sentence and that no
page declares is reported too, and is retired in the same baseline under
`<file><TAB>undeclared`.

Config (`checks.carry`, optional): `floor` (0.25), `minUnits` (4), `minLen` (12),
`undeclared` (false).
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
UNDECLARED = "undeclared"
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


def owners_of(reader: DeckReader, manuscript: Manuscript) -> dict[str, list[str]]:
    """{declared manuscript path: the source files whose declarations name it}."""
    owners: dict[str, list[str]] = {}
    for name, raw in reader.files():
        for rel in manuscript.declarations(raw):
            owners.setdefault(rel, [])
            if name not in owners[rel]:
                owners[rel].append(name)
    return owners


def measure(reader: DeckReader, deck: DeckConfig) -> tuple[int, list[dict]]:
    """(declared manuscripts, [{md, files, carried, total, missing}] below the floor)."""
    cfg = deck.section("checks.carry")
    floor = float(cfg.get("floor", FLOOR))
    min_units = int(cfg.get("minUnits", MIN_UNITS))
    min_len = int(cfg.get("minLen", MIN_LEN))
    manuscript = Manuscript.for_deck(deck)
    skip = [re.compile(p) for p in deck.get("manuscript.skipLines", []) or []]
    end = deck.get("lang.sentenceEnd", "다.")
    owners = owners_of(reader, manuscript)
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


def undeclared(reader: DeckReader, deck: DeckConfig) -> list[dict]:
    """[{md, total}] for each manuscript file with printed prose that no page declares.

    Empty unless `checks.carry.undeclared` is set.
    """
    if not deck.section("checks.carry").get("undeclared", False):
        return []
    min_len = int(deck.section("checks.carry").get("minLen", MIN_LEN))
    manuscript = Manuscript.for_deck(deck)
    skip = [re.compile(p) for p in deck.get("manuscript.skipLines", []) or []]
    end = deck.get("lang.sentenceEnd", "다.")
    declared = {(manuscript.dir / rel).resolve() for rel in owners_of(reader, manuscript)}
    out = []
    for path in manuscript.files():
        if path.resolve() in declared:
            continue
        units = prose_units(path.read_text(encoding="utf-8"), manuscript, skip, end, min_len)
        if units:
            out.append({"md": path.relative_to(manuscript.dir).as_posix(), "total": len(units)})
    return out


def undeclared_key(row: dict) -> str:
    return f"{row['md']}\t{UNDECLARED}"


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0], bless=True).parse_args(argv)
    deck = cli.deck_config(args)
    baseline = Baseline.for_check(deck, "carry")
    opted = bool(deck.section("checks.carry").get("undeclared", False))
    with cli.open_reader(deck) as reader:
        declared, low = measure(reader, deck)
        unclaimed = undeclared(reader, deck)
    if args.bless:
        findings = {r["md"]: None for r in low} | {undeclared_key(r): None for r in unclaimed}
        return cli.report_bless(baseline, findings, "sections carried below the floor or declared by no page")
    live, owed = judge(baseline, low, lambda r: r["md"])
    orphans, orphans_owed = judge(baseline, unclaimed, undeclared_key)
    tail = f", {len(orphans)} declared by no page" if opted else ""
    print(f"carry: {declared} declared manuscripts, {len(live)} carried below the floor{tail}, "
          f"{len(owed) + len(orphans_owed)} retired without a reason")
    for r in sorted(live, key=lambda r: r["carried"] / r["total"]):
        mark = "✖" if r["carried"] == 0 else "⚠"
        print(f"  {mark} {r['md']}: {r['carried']} of {r['total']} prose sentences printed "
              f"({r['carried'] / r['total']:.0%}), declared by {', '.join(r['files'])}")
        for m in r["missing"][:4]:
            print(f"       · {m[:96]}")
    for r in orphans:
        print(f"  ✖ {r['md']}: {r['total']} prose sentences, and no page declares the file")
    for r in owed:
        print(f"  ✖ {r['md']}: retired with a blank reason; write why")
    for r in orphans_owed:
        print(f"  ✖ {r['md']} (declared by no page): retired with a blank reason; write why")
    return 1 if live or owed or orphans or orphans_owed else 0


if __name__ == "__main__":
    sys.exit(main())
