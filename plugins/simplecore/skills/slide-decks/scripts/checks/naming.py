#!/usr/bin/env python3
"""A title, a head or a label that holds a question or a sentence.

A title, a head and a label are names, and a name is a noun phrase. A heading
that asks what is measured and what counts as a pass is grammatical and
meaningful, but it is a question, not a title: the contents cannot carry it
and the body cannot cite it. The render is fine and the language audit is
quiet, because the fault is the slot, not the words.

Name slots are the kit vocabulary's `slots.name`: page and section titles,
the heads of cards and items, the labels of rows and the header cells of a
table, inside JSON item lists too. A body cell, an explanation, a note or a
caption's sentence slot takes a sentence and is not read here.

A name fails when it ends as a question, closes on the register's sentence
ending (the closing syllable of `lang.sentenceEnd`, 「다」 for -다체; a few nouns
that end in it are names), or ends on a subordinate clause (「~ 때」, 「~ 경우」).

Config (`checks.naming`, optional):

- `fallback` (false): also read every argument in the vocabulary's `args.heads`
  on a component `slots.name` does not list, so a component added to the kit
  cannot carry a sentence in its head unread.
- `regionEcho` (false): a region's title (vocabulary `roles.regions`) and the
  head of the first component under it (`roles.regionHeads`) must differ, or
  one of the two carries nothing. A head that is one item of a title which
  lists several (「단일 창구 · 결정 반영」 over 「단일 창구」) is the intended
  structure and is printed as a place to read, not a failure. The title's
  numbering marker (`numbering.ladder`) is set aside before comparing.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader, strip_comments, uses  # noqa: E402
from bidkit.textko import marker_pattern, strip_marker  # noqa: E402
from bidkit.vocab import role  # noqa: E402

# Endings that ask without a question mark.
ASK = re.compile(r"(?:는가|은가|을까|ㄹ까|나요|입니까|인가요|인가)$")
# Nouns that end in the sentence ending's syllable and are names.
NOUN_DA = {"바다", "소다", "시다", "가다랑어"}
# A sentence fragment ends on a subordinate clause. The space before it is
# required, so a noun that ends in the same syllable (「커버리지」) is a name.
CLAUSE = re.compile(r"(?<=\s)(?:때|뒤|경우|만큼|채)$")
MIN_LEN = 3


def verdict(name: str, close: str) -> str | None:
    if ASK.search(name):
        return "a question"
    if name.endswith(close) and name not in NOUN_DA:
        return "a sentence"
    if CLAUSE.search(name):
        return "a subordinate clause"
    return None


def closing_syllable(deck: DeckConfig) -> str:
    end = deck.get("lang.sentenceEnd", "다.")
    if not isinstance(end, str) or not end.rstrip("."):
        raise ConfigError("`lang.sentenceEnd` is the closing syllable and the stop, as in 「다.」")
    return end.rstrip(".")[-1]


def names(reader: DeckReader, deck: DeckConfig) -> list[tuple[str, str, str, str, str]]:
    """[(file, template, slot, name, why)] for every name slot holding a sentence."""
    vocab = reader.vocab
    if vocab is None:
        raise ConfigError("naming reads the name slots from the kit vocabulary; declare `vocabulary`")
    close = closing_syllable(deck)
    listed = vocab.components("name")
    fallback = bool(deck.get("checks.naming.fallback", False))
    heads = vocab.args("heads") if fallback else set()
    bad = []
    for file, raw in reader.files():
        for template, attrs, _ in uses(strip_comments(raw)):
            found = list(vocab.values("name", template, attrs))
            if template not in listed:
                found += [(a, v) for a, v in attrs.items()
                          if a in heads and not v.lstrip().startswith(("[", "{"))]
            for slot, value in found:
                name = value.strip()
                if len(name) < MIN_LEN:
                    continue
                why = verdict(name, close)
                if why:
                    bad.append((file, template, slot, name, why))
    return bad


def squash(name: str) -> str:
    return re.sub(r"[·\s]+", "", name)


def region_echoes(reader: DeckReader, deck: DeckConfig) -> tuple[list, list, str | None]:
    """([same], [contained], why not judged) for region titles and the first head under them.

    Uses are read in source order; a page component closes the region, a new
    region replaces it, and the first component head after a region's title
    is compared and closes it.
    """
    regions, _ = role(deck, reader.vocab, "naming", "regions")
    heads, _ = role(deck, reader.vocab, "naming", "regionHeads")
    if not isinstance(regions, dict) or not isinstance(heads, list):
        return [], [], "neither checks.naming nor the vocabulary names `regions` and `regionHeads`"
    page_components = {c for names_ in (reader.vocab.pages().get("components", {}) if reader.vocab else {}).values()
                       for c in names_}
    marker = marker_pattern(deck.get("numbering.ladder"))
    same, part = [], []
    for file, raw in reader.files():
        region = None
        for template, attrs, _ in uses(strip_comments(raw)):
            if template in page_components:
                region = None
                continue
            if template in regions:
                title = attrs.get(regions[template], "").strip()
                region = strip_marker(title, marker) if title else None
                continue
            head = next((attrs[a].strip() for a in heads if attrs.get(a, "").strip()), None)
            if region is None or head is None:
                continue
            a, b = squash(region), squash(head)
            if a == b:
                same.append((file, region, head))
            elif len(b) >= 4 and (b in a or a in b):
                part.append((file, region, head))
            region = None
    return same, part, None


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0]).parse_args(argv)
    deck = cli.deck_config(args)
    echo = bool(deck.get("checks.naming.regionEcho", False))
    with cli.open_reader(deck) as reader:
        bad = names(reader, deck)
        same, part, unjudged = region_echoes(reader, deck) if echo else ([], [], None)
    print(f"naming: {len(bad)} name slots holding a sentence"
          + (f", {len(same)} region titles repeated by the first head under them" if echo else ""))
    for file, template, slot, value, why in bad:
        print(f"  ✖ {file} · {template} {slot}: {why}")
        print(f"      「{value}」")
    if bad:
        print("  a title, head or label is a noun phrase; the explanation belongs in a sentence slot")
    for file, region, _ in same:
        print(f"  ✖ {file}: the region title and the first head under it are the same, 「{region}」")
    for file, region, head in part:
        print(f"  · {file}: under 「{region}」 the first head is 「{head}」; right when the title "
              "lists items and each component takes one")
    if unjudged:
        print(f"  ⚠ region titles not judged: {unjudged}")
    return 1 if bad or same else 0


if __name__ == "__main__":
    sys.exit(main())
