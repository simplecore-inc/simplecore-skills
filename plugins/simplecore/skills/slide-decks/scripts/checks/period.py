#!/usr/bin/env python3
"""A sentence closes with a full stop; a name does not.

A card row, a table cell and a paragraph carry two kinds of string. One is a
sentence: it closes on the register's predicate and takes a full stop. The
other is a name (a column head, a card head, a label) and never takes one.
A deck split on this reads as finished on one page and unfinished on the next.

The test is the ending, not a judgement: after a trailing reference such as
「(별첨3)」 or 「[증빙 8]」 is set aside, a string is a sentence when it ends
in the closing syllable of `lang.sentenceEnd` (「다.」 for -다체, so 「다」).
Only the slots that carry a sentence are read (the kit vocabulary's
`sentences`), and the printed table cells; a name's sentence is `naming`'s
finding, not this one.

Findings: a sentence slot whose sentence has no full stop, a sentence slot
whose string ends in a full stop and is not a sentence, and the same two for
a table cell. Retire a judged one with `--bless` and write its reason.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli, srctree  # noqa: E402
from bidkit.baseline import Baseline, judge  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader  # noqa: E402

# A reference that rides after the predicate, with the stop outside it.
REFERENCE = re.compile(r"\s*(?:\([^()]*\)|\[[^\[\]]*\])$")
HANGUL = re.compile(r"[가-힣]")
ITEM = re.compile(r"^(\w+)\[\]\.(\w+)$")


def sentence_slots(reader: DeckReader) -> dict[str, list[str]]:
    vocab = reader.vocab
    table = (vocab.data.get("sentences") if vocab else None) or {}
    if not table:
        raise ConfigError("the kit vocabulary declares no `sentences`: the slots that carry a "
                          "sentence are the kit's to name")
    return table


def groups(template: str, attrs: dict, specs: list[str]) -> list[list[tuple[str, str]]]:
    """The rows one `<Use>` prints, each [(slot, value)] in reading order.

    Plain arguments listed together are one claim split over rows; each item
    of a JSON list is a row of its own, its fields in the listed order.
    """
    plain = [(s, attrs[s]) for s in specs if not ITEM.match(s) and attrs.get(s, "").strip()]
    out = [plain] if plain else []
    by_arg: dict[str, list[str]] = {}
    for s in specs:
        m = ITEM.match(s)
        if m:
            by_arg.setdefault(m.group(1), []).append(m.group(2))
    for arg, keys in by_arg.items():
        try:
            items = json.loads(attrs.get(arg) or "[]")
        except (ValueError, TypeError):
            continue
        for item in items if isinstance(items, list) else []:
            if not isinstance(item, dict):
                continue
            row = [(f"{arg}.{k}", item[k]) for k in keys
                   if isinstance(item.get(k), str) and item[k].strip()]
            if row:
                out.append(row)
    return out


def source_rows(reader: DeckReader) -> list[tuple[str, int, str, list]]:
    """(file, line, template, rows) for every component with sentence slots."""
    table = sentence_slots(reader)
    out = []
    for name, raw in reader.files():
        for node in srctree.parse(raw).walk():
            specs = table.get(node.template or "")
            if specs:
                for row in groups(node.template, node.attrs, specs):
                    out.append((name, node.line, node.template, row))
    return out


def visible(value: str) -> str:
    """The last line a reader sees, the explicit break honoured, inline spans dropped."""
    part = value.replace("\\n", "\n").split("\n")[-1]
    return re.sub(r"<[^>]+>", "", part).strip()


class Ending:
    def __init__(self, deck: DeckConfig):
        end = deck.get("lang.sentenceEnd", "다.")
        if not isinstance(end, str) or len(end) < 2:
            raise ConfigError("`lang.sentenceEnd` is the closing syllable and the stop, as in 「다.」")
        self.stop = end[-1]
        self.closes = re.compile(re.escape(end[:-1]) + "$")

    def is_sentence(self, text: str) -> bool:
        text = text.strip()
        while True:                       # 「~한다(Ⅵ-2 01) [증빙 8]」 carries two references
            bare = REFERENCE.sub("", text).strip()
            if bare == text:
                break
            text = bare
        return bool(self.closes.search(text))

    def judge(self, value: str) -> str | None:
        text = visible(value)
        if not text or not HANGUL.search(text):
            return None
        if text.endswith(self.stop):
            return None if self.is_sentence(text[:-1]) else "a full stop on a string that is not a sentence"
        return "a sentence without its full stop" if self.is_sentence(text) else None


def find(reader: DeckReader, deck: DeckConfig) -> list[tuple[str, str, str, str]]:
    """[(where, slot, value, why)]; where is `file:line` or a page label for a cell."""
    ending = Ending(deck)
    out = []
    for name, line, template, row in source_rows(reader):
        for slot, value in row:
            why = ending.judge(value)
            if why:
                out.append((f"{name}:{line}", f"{template}.{slot}", visible(value), why))
    for page in reader.slides():
        for _, cells in page.rows:
            for cell in cells:
                why = ending.judge(cell)
                if why:
                    out.append((page.label, "table cell", visible(cell), why))
    return out


def key(item) -> str:
    where, slot, text, why = item
    return "\t".join([where.split(":")[0], slot, text[:60]])


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0], bless=True).parse_args(argv)
    deck = cli.deck_config(args)
    baseline = Baseline.for_check(deck, "period")
    with cli.open_reader(deck) as reader:
        found = find(reader, deck)
    if args.bless:
        return cli.report_bless(baseline, {key(f): None for f in found}, "stops")
    live, owed = judge(baseline, found, key)
    print(f"period: {len(found)} strings disagree with their ending, {len(live)} live, "
          f"{len(owed)} retired without a reason")
    for where, slot, text, why in live:
        print(f"  ✖ {where} {slot}: {why} · {text[:70]}")
    for where, slot, text, _ in owed:
        print(f"  ✖ {where} {slot}: retired with a blank reason; write why · {text[:50]}")
    return 1 if live or owed else 0


if __name__ == "__main__":
    sys.exit(main())
