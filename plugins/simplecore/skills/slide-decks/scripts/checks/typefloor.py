#!/usr/bin/env python3
"""Type-size floor: no text in the deck prints below the size the deck declares.

Everything a reader reads (body, caption, footnote, label, running head) sits
at or above `type.floor`; the sizes above it carry the hierarchy. The one
exception is a code value standing as a label, a requirement id on a chip,
which is looked up rather than read: it is held to `type.codeLabel`, and not
measured at all when that is `null`.

The size is the printed one: the server's layout reading gives every text
box's font size as the builder sets it, after styles, variables and page-
relative units are resolved, so a size written in a style the page never
names, or one a kit scales with the page, is read the same way. A table is one
box in that reading and its cells are not measured here.

A page-relative size resolves to within a few hundredths of a point of the
size it was set for (8pt on a 1122px page prints at 7.97pt), so a size within
`checks.typefloor.tolerance` (0.05pt) of the floor is at the floor.

The code-label components are the kit vocabulary's `roles.codeLabels`; a deck
overrides them with `checks.typefloor.codeLabels`.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader  # noqa: E402
from bidkit.layout import Layouts  # noqa: E402
from bidkit.vocab import role  # noqa: E402

PX_PER_PT = 4 / 3
TOLERANCE = 0.05


def floors(deck: DeckConfig) -> tuple[float, float | None]:
    sizes = deck.require("type", "the sizes the deck is set at, in points")
    if not isinstance(sizes, dict) or not isinstance(sizes.get("floor"), (int, float)):
        raise ConfigError(f"deck `{deck.name}` `type.floor` must be a size in points")
    code = sizes.get("codeLabel")
    return float(sizes["floor"]), None if code is None else float(code)


def find(reader: DeckReader, deck: DeckConfig) -> tuple[int, list, str | None]:
    """(texts measured, [(page, key, component, pt, floor, text)], unset role or None)."""
    floor, code_floor = floors(deck)
    codes, _ = role(deck, reader.vocab, "typefloor", "codeLabels")
    unset = None
    if codes is None and code_floor is not None:
        unset = "codeLabels"
    codes = set(codes or [])
    tolerance = float(deck.section("checks.typefloor").get("tolerance", TOLERANCE))
    layouts = Layouts(reader)
    measured, bad = 0, []
    for page in reader.slides():
        component = {s.key: s.component for s in page.spans if s.key}
        _, index = layouts.slide(page.n)
        for box in index.values():
            if box.size_px is None:
                continue
            comp = component.get(box.key)
            is_code = comp in codes
            if is_code and code_floor is None:
                continue
            limit = code_floor if is_code else floor
            measured += 1
            pt = box.size_px / PX_PER_PT
            if pt < limit - tolerance:
                bad.append((page.label, box.key, comp or "-", pt, limit, box.text))
    return measured, bad, unset


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0]).parse_args(argv)
    deck = cli.deck_config(args)
    with cli.open_reader(deck) as reader:
        measured, bad, unset = find(reader, deck)
    floor, _ = floors(deck)
    print(f"typefloor: {measured} printed texts measured, {len(bad)} below the floor ({floor:g}pt)")
    if unset:
        print("  ⚠ `type.codeLabel` is declared but no `roles.codeLabels` names the components it "
              "applies to; every code label was held to the body floor")
    for page, key, comp, pt, limit, text in bad:
        print(f"  ✖ {page} {key} ({comp}): {pt:.2f}pt, floor {limit:g}pt · {text[:50]}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
