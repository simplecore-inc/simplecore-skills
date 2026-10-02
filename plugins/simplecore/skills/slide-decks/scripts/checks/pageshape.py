#!/usr/bin/env python3
"""A page needs a shape, and a list has to be a list.

Things a page-by-page review cannot see. A page whose body is prose and
bullets under every heading looks fine on its own; a run of such pages is the
deck reading as one page repeated. A run of bullets is the shape an author
reaches for when no other shape has an entry point. And a numbered sequence
dealt evenly into the columns of a column layout is read row by row, so 1 2
beside 3 4 arrives as 1 3 / 2 4 although every card is right and the numbers
are in order in the source.

Findings, per body page:

- the page carries no shape and no table: only paragraphs and lists
- a list outruns the shapes on the page (`listCeiling` rows or more, and fewer
  than one shape per `rowsPerShape` rows)
- a list of one row, which is a sentence, not a list
- a numbered sequence split evenly across the columns of a column layout

What counts as a shape is read from the kind each component declares on its
`<Template>` (the kit vocabulary's `kinds.shape`, less `roles.notShapes`), so
a component the kit adds is judged without a list of names. The list
container, its rows, figures, column layouts and numbered components are kit
vocabulary roles (`roles.*`); a deck overrides one with `checks.pageshape.<role>`.

Config (`checks.pageshape`, optional): `listCeiling` (12), `rowsPerShape` (6).
"""
from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli, srctree  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader, Page  # noqa: E402
from bidkit.vocab import role  # noqa: E402

LIST_CEILING = 12
ROWS_PER_SHAPE = 6


def _names(value) -> set[str]:
    if value is None:
        return set()
    if isinstance(value, dict):
        return set(value)
    if isinstance(value, (list, tuple, set)):
        return set(value)
    return {value}


class Kit:
    """The kit's component groups and roles, as one check needs them."""

    def __init__(self, reader: DeckReader, deck: DeckConfig, check: str):
        vocab = reader.vocab
        if vocab is None:
            raise ConfigError(f"deck `{deck.name}` declares no `vocabulary`; {check} groups components "
                              "by the kinds the kit vocabulary names")
        self.check, self.deck, self.vocab = check, deck, vocab
        self.kind = {name: a.get("kind", "") for name, a in reader.templates().items()}
        self.shape_kinds = vocab.kinds("shape")
        self.content_kinds = vocab.kinds("content")
        self.held_kinds = vocab.kinds("held")
        if not self.shape_kinds:
            raise ConfigError(f"the kit vocabulary {vocab.origin} declares no `kinds.shape`; "
                              f"{check} cannot tell a shaped block from prose")
        self.unset: list[str] = []

    def role(self, name: str, default=None):
        value, _ = role(self.deck, self.vocab, self.check, name)
        if value is None:
            self.unset.append(name)
            return default
        return value

    def report_unset(self) -> None:
        for name in dict.fromkeys(self.unset):
            print(f"  ⚠ no `roles.{name}` in the kit vocabulary and no `checks.{self.check}.{name}`: "
                  "the rule that needs it was not judged")


@dataclass
class Composition:
    page: Page
    shapes: list = field(default_factory=list)     # shaped blocks (figures included)
    content: list = field(default_factory=list)    # content components (cards, rows, bands)
    figures: list = field(default_factory=list)
    tables: int = 0
    runs: list = field(default_factory=list)       # rows per list run


def item_count(value: str | None) -> int:
    try:
        data = json.loads(value or "[]")
    except (ValueError, TypeError):
        return 0
    return len(data) if isinstance(data, list) else 0


def compose(kit: Kit, page: Page) -> Composition:
    """What one printed page is made of."""
    not_shapes = _names(kit.role("notShapes", []))
    figures = _names(kit.role("figures", []))
    containers = _names(kit.role("listContainers", []))
    rows = _names(kit.role("listRows", []))
    items_arg = kit.role("listItems", "items")
    c = Composition(page)
    c.tables = len({key for key, _ in page.rows})
    container_run: int | None = None     # index in c.runs of the latest container's run
    bare_run: tuple | None = None        # (index, parent) of a run of rows outside a container
    for u in page.uses:
        kind = kit.kind.get(u.tag, "")
        if kind in kit.held_kinds:
            continue
        if u.tag in figures:
            c.figures.append(u)
        if u.tag in figures or (kind in kit.shape_kinds and u.tag not in not_shapes):
            c.shapes.append(u)
        if kind in kit.content_kinds and u.tag not in not_shapes:
            c.content.append(u)
        if u.tag in containers:
            c.runs.append(item_count(u.attrs.get(items_arg)))
            container_run, bare_run = len(c.runs) - 1, None
        elif u.tag in rows and u.parent in containers and container_run is not None:
            c.runs[container_run] += 1
        elif u.tag in rows:
            if bare_run is not None and bare_run[1] == u.parent:
                c.runs[bare_run[0]] += 1
            else:
                c.runs.append(1)
                bare_run = (len(c.runs) - 1, u.parent)
        else:
            bare_run = None
    c.runs = [n for n in c.runs if n > 0]
    return c


def numbers_across(kit: Kit, raw: str, name: str) -> list[str]:
    """A numbered sequence dealt evenly into the columns of a column layout.

    Columns that each hold the same number of numbered items pair them into
    rows, and a reader takes a row before a column. An uneven split does not
    pair up and reads down the columns as written, so only the even one is
    reported.
    """
    layouts = _names(kit.role("columnLayouts", []))
    numbered = kit.role("numbered", {})
    if not isinstance(numbered, dict):
        raise ConfigError("`roles.numbered` maps a component to the argument holding its number")
    out = []
    for node in srctree.parse(raw).walk():
        if node.template not in layouts:
            continue
        columns = []
        for slot in (k for k in node.kids if k.tag == "Slot"):
            nums = []
            for n in slot.walk():
                value = str(n.attrs.get(numbered.get(n.template, ""), "")).strip().rstrip(".")
                if n.template in numbered and value.isdigit():
                    nums.append(int(value))
            if nums:
                columns.append(nums)
        if len(columns) < 2 or len({len(col) for col in columns}) != 1 or len(columns[0]) < 2:
            continue
        flat = [n for col in columns for n in col]
        if sorted(flat) == list(range(min(flat), min(flat) + len(flat))):
            out.append(f"{name}:{node.line} {node.template} deals {'·'.join(map(str, flat))} "
                       f"into its columns {len(columns[0])} at a time; read across, the order is lost")
    return out


def page_findings(kit: Kit, c: Composition, ceiling: int, per_shape: int) -> list[tuple[int, str]]:
    """(tier, reason) for one page; tier 1 is a defect."""
    out = []
    rows = sum(c.runs)
    shapes = len(c.shapes) + c.tables
    if not c.shapes and not c.tables:
        out.append((1, f"only paragraphs and lists ({rows} list rows)"))
    elif rows >= ceiling and shapes * per_shape < rows:
        out.append((1, f"{rows} list rows against {shapes} shapes (one per {per_shape} rows at least)"))
    if any(n == 1 for n in c.runs):
        out.append((1, "a list of one row"))
    return out


def find(reader: DeckReader, deck: DeckConfig) -> tuple[int, list, Kit]:
    """(body pages, [(page label, reason)], kit)."""
    cfg = deck.section("checks.pageshape")
    ceiling = int(cfg.get("listCeiling", LIST_CEILING))
    per_shape = int(cfg.get("rowsPerShape", ROWS_PER_SHAPE))
    kit = Kit(reader, deck, "pageshape")
    body = reader.body_pages()
    found = []
    for page in body:
        for _, why in page_findings(kit, compose(kit, page), ceiling, per_shape):
            found.append((page.label, why))
    for name, raw in reader.files():
        found += [(name, why) for why in numbers_across(kit, raw, name)]
    return len(body), found, kit


def by_page(reader: DeckReader, deck: DeckConfig) -> dict[str, list[tuple[int, str]]]:
    """Findings keyed by page label, for a check that grades pages."""
    cfg = deck.section("checks.pageshape")
    kit = Kit(reader, deck, "pageshape")
    out: dict[str, list] = {}
    for page in reader.body_pages():
        found = page_findings(kit, compose(kit, page), int(cfg.get("listCeiling", LIST_CEILING)),
                              int(cfg.get("rowsPerShape", ROWS_PER_SHAPE)))
        if found:
            out[page.label] = found
    return out


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0]).parse_args(argv)
    deck = cli.deck_config(args)
    with cli.open_reader(deck) as reader:
        pages, found, kit = find(reader, deck)
    print(f"pageshape: {pages} body pages, {len(found)} findings")
    kit.report_unset()
    for where, why in found:
        print(f"  ✖ {where}: {why}")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
