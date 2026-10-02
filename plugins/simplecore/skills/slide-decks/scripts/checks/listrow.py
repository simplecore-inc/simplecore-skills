#!/usr/bin/env python3
"""Every list row sits in the deck's list container, and no bullet is typed.

A list row dropped straight into a section's slot takes that section's gap, so
the same list stands at one spacing on one page and another on the next, and
no page-by-page review catches it: each page looks fine on its own. The list
container is the one place the row gap is set, so every row belongs in one,
and a container inside a container doubles it.

A mark typed into a row or an item (「•」, 「·」, 「-」) is a second bullet
system beside the container's drawn marker; a supplied mark is for an index,
a letter or a code.

A page file that draws its own `<VStack>` or `<HStack>` is a component nobody
named, holding a gap nobody can change from the styles. Every shape a page
needs comes from the kit.

A label and value row whose label is an index (「1」, 「가.」) spends the fixed
label column on one glyph and prints a gap between the number and its
sentence; an index belongs in a list row, whose mark column is as wide as the
mark.

The rows, the container, the mark argument and the label rows are kit
vocabulary roles (`roles.listRows`, `listContainers`, `listItems`, `markArg`,
`labelRows`); a deck overrides one with `checks.listrow.<role>`.

Config (`checks.listrow`, optional): `composed` (globs of page files whose
layout is a composition and may lay its own stacks).
"""
from __future__ import annotations

import json
import re
import sys
from fnmatch import fnmatchcase
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli, srctree  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader  # noqa: E402
from bidkit.vocab import role  # noqa: E402

# A mark that is a bullet rather than an index. The middle dot, the hyphen and
# the dashes stand in for a drawn shape; the dash characters here are data.
TYPED_BULLET = re.compile(r"^[•·∙●○▪–—*\-]+$")
# A bare one-glyph label is not necessarily an index (「표」 and 「값」 are
# labels), so a non-numeric mark has to carry its separator to be caught.
INDEX_LABEL = re.compile(r"^\s*(?:\d{1,2}\s*[.)]?|[가-힣A-Za-z]\s*[.)])\s*$")
STACKS = ("VStack", "HStack")


class Roles:
    def __init__(self, deck: DeckConfig, vocab):
        self.unset: list[str] = []

        def get(name, default):
            value, _ = role(deck, vocab, "listrow", name)
            if value is None:
                self.unset.append(name)
                return default
            return value

        self.rows = set(get("listRows", []))
        self.containers = set(get("listContainers", []))
        self.items = get("listItems", None)
        self.mark = get("markArg", None)
        labels = get("labelRows", {})
        if not isinstance(labels, dict):
            raise ConfigError("`roles.labelRows` maps a label row component to its label argument")
        self.labels = labels


def walk(node: srctree.Node, roles: Roles, name: str, composed: bool, found: list[str]) -> None:
    for n in node.walk():
        where = f"{name}:{n.line}"
        tpl = n.template
        if tpl in roles.rows:
            holder = n.holder()
            if roles.containers and (holder is None or holder.template not in roles.containers):
                found.append(f"{where} {tpl} outside {'/'.join(sorted(roles.containers))} "
                             f"(in {holder.template if holder else 'the page'})")
        if roles.mark and tpl in roles.rows | roles.containers:
            marks = [n.attrs.get(roles.mark, "")]
            if tpl in roles.containers and roles.items:
                marks += _item_marks(n.attrs.get(roles.items), roles.mark)
            for mark in marks:
                if mark and TYPED_BULLET.match(mark.strip()):
                    found.append(f"{where} {tpl} carries a typed bullet 「{mark}」; the container draws "
                                 "the bullet")
        if tpl in roles.labels:
            label = n.attrs.get(roles.labels[tpl], "")
            if INDEX_LABEL.match(label):
                found.append(f"{where} {tpl} numbers its rows 「{label.strip()}」 in its fixed label "
                             "column; an index goes in a list row")
        if tpl in roles.containers:
            inner = [k for k in n.walk() if k is not n and k.template in roles.containers]
            if inner:
                found.append(f"{where} {tpl} inside {tpl} (line {inner[0].line})")
        if n.tag in STACKS and not composed:
            found.append(f"{where} a page file draws its own <{n.tag}>; the shape and its gap belong "
                         "to a component")


def _item_marks(value: str | None, key: str) -> list[str]:
    try:
        data = json.loads(value or "[]")
    except (ValueError, TypeError):
        return []
    out: list[str] = []

    def take(items):
        for item in items if isinstance(items, list) else []:
            if isinstance(item, dict):
                if isinstance(item.get(key), str):
                    out.append(item[key])
                take(item.get("children"))
    take(data)
    return out


def scan(raw: str, roles: Roles, name: str, composed: bool = False) -> list[str]:
    found: list[str] = []
    walk(srctree.parse(raw), roles, name, composed, found)
    return found


def find(reader: DeckReader, deck: DeckConfig) -> tuple[int, list[str], Roles]:
    roles = Roles(deck, reader.vocab)
    globs = deck.section("checks.listrow").get("composed", [])
    files = reader.files()
    found: list[str] = []
    for name, raw in files:
        found += scan(raw, roles, name, any(fnmatchcase(name, g) for g in globs))
    return len(files), found, roles


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0]).parse_args(argv)
    deck = cli.deck_config(args)
    with cli.open_reader(deck) as reader:
        files, found, roles = find(reader, deck)
    print(f"listrow: {files} page files, {len(found)} findings")
    for name in roles.unset:
        print(f"  ⚠ no `roles.{name}` in the kit vocabulary and no `checks.listrow.{name}`: "
              "the rule that needs it was not judged")
    for line in found:
        print(f"  ✖ {line}")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
