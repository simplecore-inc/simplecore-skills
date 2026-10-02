#!/usr/bin/env python3
"""A label that names the word its own prose opens with.

A label stands in front of the prose it names: 「출입」 before 「통제 출입은 승인
인원과 시간으로 제한한다.」 names what the line is about. When it repeats the
prose's opening word the reader gets 「출입 출입은」 and the label carries
nothing.

The pairs are the kit vocabulary's `marks` (component -> [label slot, prose
slot]; a pair of `arg[].key` slots on one list is read item by item), and the
first two cells of every printed table row below the header: a row's first
cell names the cells beside it the same way. A check that never opens a shape
reports the same zero as one that opened it and found nothing, so a deck whose
vocabulary declares no `marks` is an error, not a pass.

A repetition: the label is the prose's first words (as many as the label has,
with up to two characters of particle after them), or its second word onward,
or the closing word of two or more of the prose's 「·」 items. A one-character
label that is not a Hangul syllable is an index, not a word, and is skipped.

**Every repetition is reported, including the right ones.** A row about 「SSO」
cannot open its sentence with anything else, and a formula label is repeated
by the line that defines it, but excluding those in code hides the ones that
were not a proper noun after all. A judged one is retired in
`<checks.baselines>/markecho.json` with its reason, keyed by where it is
(`page<TAB>component<TAB>label slot<TAB>n`), not by its words, so rewording the
prose does not undo the judgement. An entry whose place no longer holds a
repetition excuses nothing and fails until the baseline is written again.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.baseline import UNREASONED, LIVE, Baseline, Entry  # noqa: E402
from bidkit.config import ConfigError  # noqa: E402
from bidkit.deckread import DeckReader, Page  # noqa: E402
from bidkit.vocab import json_items  # noqa: E402

ITEM = re.compile(r"^(\w+)\[\]\.(\w+)$")
ROW_LABEL = ("row", "first cell", "next cell")


def label_pairs(page: Page, marks: dict):
    """(component, label slot, prose slot, label, prose) for every pair one slide prints."""
    for use in page.uses:
        for label_spec, body_spec in marks.get(use.tag, []):
            li, bi = ITEM.match(label_spec), ITEM.match(body_spec)
            if li and bi and li.group(1) == bi.group(1):
                for item in json_items(use.attrs.get(li.group(1))):
                    if isinstance(item, dict):
                        yield (use.tag, label_spec, body_spec,
                               str(item.get(li.group(2), "")).strip(), str(item.get(bi.group(2), "")).strip())
            elif not li and not bi:
                yield (use.tag, label_spec, body_spec,
                       str(use.attrs.get(label_spec, "")).strip(), str(use.attrs.get(body_spec, "")).strip())
            else:
                raise ConfigError(f"vocabulary marks of {use.tag}: {label_spec} and {body_spec} must be "
                                  "two plain arguments or two fields of one item list")
    order, grid = [], {}
    for table, cells in page.rows:
        if table not in grid:
            order.append(table)
            grid[table] = []
        grid[table].append(cells)
    for table in order:
        for cells in grid[table][1:]:            # the header row names columns, not a row
            if len(cells) > 1:
                yield ROW_LABEL[0], ROW_LABEL[1], ROW_LABEL[2], cells[0].strip(), cells[1].strip()


def repeats(mark: str, text: str) -> str | None:
    """Why the label repeats its prose, or None."""
    if not mark or not text:
        return None
    if len(mark) < 2 and not ("가" <= mark <= "힣"):
        return None
    words = text.split(" ")
    n = len(mark.split(" "))
    for start in (0, 1):
        first = " ".join(words[start:start + n])
        if first and (first == mark or (first.startswith(mark) and len(first) - len(mark) <= 2)):
            return f"repeats 「{first}」"
    tails = [part.strip().split(" ")[-1] for part in text.split("·")]
    if len(tails) > 1 and sum(1 for tail in tails if tail == mark) > 1:
        return "is the closing word of the items"
    return None


def find(reader: DeckReader) -> list[tuple[str, str, str, str]]:
    """[(key, page, quote)] for every repetition, keyed by its place."""
    marks = (reader.vocab.data.get("marks") if reader.vocab else None) or {}
    if not marks:
        raise ConfigError("the kit vocabulary declares no `marks`: which label names which prose is the kit's to say")
    out = []
    for page in reader.slides():
        nth: dict[tuple[str, str], int] = {}
        for tpl, label, body, mark, text in label_pairs(page, marks):
            why = repeats(mark, text)
            if not why:
                continue
            nth[(tpl, label)] = nth.get((tpl, label), 0) + 1
            key = f"{page.label}\t{tpl}\t{label}\t{nth[(tpl, label)]}"
            out.append((key, page.label, f"{tpl} {label}=「{mark}」: {body} {why}"))
    return out


def migrate(raw_key: str, raw: Any) -> tuple[str, Entry] | None:
    """The `{"quote", "why"}` form: `why` is the reason; a blank one is still owed."""
    if isinstance(raw, dict) and "why" in raw:
        return raw_key, Entry(str(raw.get("why") or ""))
    return None


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0], bless=True).parse_args(argv)
    deck = cli.deck_config(args)
    baseline = Baseline.for_check(deck, "markecho", migrate)
    with cli.open_reader(deck) as reader:
        found = find(reader)
    if args.bless:
        return cli.report_bless(baseline, {k: None for k, _, _ in found}, "label repetitions")
    seen = {k for k, _, _ in found}
    live = [f for f in found if baseline.verdict(f[0]) == LIVE]
    owed = [f for f in found if baseline.verdict(f[0]) == UNREASONED]
    dead = sorted(k for k in baseline.entries if k not in seen)
    print(f"markecho: {len(live)} labels repeating their own prose, {len(owed)} retired without a reason, "
          f"{len(dead)} retired places that no longer repeat ({len(baseline.entries)} baseline entries)")
    for _, page, quote in live:
        print(f"  ✖ {page}: {quote}")
    if live:
        print("  a label says what the prose does not; where the repetition is right (a proper noun, "
              "an abbreviation, a formula), --bless and write the reason")
    for _, page, quote in owed:
        print(f"  ✖ {page}: {quote}; retired with a blank reason, write why")
    for key in dead:
        where = key.replace("\t", " · ")
        print(f"  ⚠ retired, and the place no longer repeats: {where}; --bless again")
    return 1 if live or owed or dead else 0


if __name__ == "__main__":
    sys.exit(main())
