#!/usr/bin/env python3
"""Every claim a page prints must trace to the manuscript it declares.

The deck is a layout of sentences that live in the manuscript. Each page file
names its sources in a declaration comment above the page
(`manuscript.declaration`, e.g. `<!-- md: 03-전략/01-사업이해도.md · Ⅲ-1 01 -->`);
every `.md` path in it is a source and the words around them are notes. A path
is read relative to the manuscript directory, else to the project root. Only a
file holding a body page component (vocabulary `pages.components.body`) is
compared: a contents page or a divider lists the deck, not the manuscript.

Every argument of every component is copy, except the vocabulary's
`args.furniture` (titles, explanations, captions: set by the typesetter) and
`args.layout`. Each printed string gets one of three verdicts:

- pass: the same text is in the manuscript.
- shortened: a fragment of a manuscript cell, allowed for a table cell, a head
  and an attribute, where the column forces a short form; the short form
  belongs in the manuscript too.
- missing: nothing in the manuscript says it, a claim with no source.

A prose argument (`args.prose`) is split into sentences and each must be in
the manuscript as written: a shortened claim is a different claim. A head
(`args.heads`) may gather two manuscript headings, so after its numbering
marker (`numbering.ladder`) is set aside every word must be the manuscript's.
A JSON item or cell, or any other argument, must be a loose fragment of the
manuscript (spacing and separators aside). An explicit line break stacks two
values, each compared on its own; a cell that only holds page numbers names
where something is and is not compared.

The manuscript side: fenced code, figure links, quotations (`>`) and
`manuscript.skipLines` are dropped; a table row's cells are read side by side
as the deck lays a row out on one line, and each cell and heading on its own.

Config: `manuscript.dir`, `manuscript.declaration`; optional
`manuscript.skipLines`, `manuscript.furnitureSource` (a file the furniture is
written in; when declared, furniture is compared with it the way an attribute
is), `checks.parity.minLen` (6), `checks.parity.accentLen` (0, off: below this
length a non-prose string passes as shortened when every word is the
manuscript's, in any order).

    parity.py               every compared page file
    parity.py FILE...       only these page files (by name)
    parity.py -v            list the shortened strings too
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader, json_strings, strip_comments, uses  # noqa: E402
from bidkit.manuscript import Manuscript  # noqa: E402
from bidkit.textko import loose, marker_pattern, norm, sentences, strip_marker  # noqa: E402

MIN_LEN = 6
PROSE, CELL, HEAD, ATTR, FURNITURE = "prose", "cell", "head", "attribute", "furniture"
WORD = re.compile(r"[0-9A-Za-z가-힣.]+")
PAGE_NUMBERS = re.compile(r"[\d~\s]+")
FENCE = re.compile(r"```.*?```", re.S)
FIGURE_LINK = re.compile(r"!\[[^\]]*\]\([^)]*\)")


class Haystack:
    """One page file's declared manuscript, normalised for the comparison."""

    def __init__(self, texts: list[str], skip: list[re.Pattern]):
        prose: list[str] = []
        units: dict[str, None] = {}           # document order, so the reading is the same every run
        for md in texts:
            md = FIGURE_LINK.sub(" ", FENCE.sub(" ", md))
            for line in md.split("\n"):
                t = line.lstrip()
                if t.startswith(">") or any(p.match(t) for p in skip):
                    continue
                if line.startswith("|"):
                    row = []
                    for cell in line.strip().strip("|").split("|"):
                        c = norm(cell)
                        if c and not set(c) <= set("-: "):
                            units[c] = None
                            row.append(c)
                    if row:
                        # A row's cells are adjacent only inside the row; 「¶」 keeps the
                        # next row's first cell from reading as this row's continuation.
                        prose.append(" ".join(row) + " ¶")
                elif line.startswith("#"):
                    units[norm(line.lstrip("#"))] = None
                else:
                    prose.append(line)
        self.units = list(units)
        # Units are joined apart: two cells or headings never read as one phrase.
        self.hay = norm(" ".join(prose) + " ¶ " + " ¶ ".join(self.units))
        self.hay_loose = loose(self.hay)
        self.units_loose = [loose(u) for u in self.units]
        # A sentence-final word carries its full stop in the manuscript.
        self.words = {w.strip(".") for w in WORD.findall(self.hay)}

    def has_words(self, text: str) -> bool:
        words = [w.strip(".") for w in WORD.findall(text)]
        return bool(words) and all(w in self.words or w in self.hay for w in words)

    def has_fragment(self, text: str) -> bool:
        lu = loose(text)
        return lu in self.hay_loose or any(lu in u for u in self.units_loose)


class Parity:
    def __init__(self, reader: DeckReader, deck: DeckConfig):
        vocab = reader.vocab
        if vocab is None:
            raise ConfigError("parity reads the argument classes from the kit vocabulary; declare `vocabulary`")
        self.vocab = vocab
        self.deck = deck
        self.ms = Manuscript.for_deck(deck)
        if not self.ms.declaration:
            raise ConfigError("parity reads each page's sources from its declaration comment; "
                              "declare `manuscript.declaration`")
        cfg = deck.section("checks.parity")
        self.min_len = int(cfg.get("minLen", MIN_LEN))
        self.accent_len = int(cfg.get("accentLen", 0))
        self.skip = [re.compile(p) for p in deck.get("manuscript.skipLines", []) or []]
        self.marker = marker_pattern(deck.get("numbering.ladder"))
        self.body = set(vocab.pages().get("components", {}).get("body", ["page"]))
        furniture = deck.get("manuscript.furnitureSource")
        self.furniture = (Haystack([deck.path("manuscript.furnitureSource").read_text(encoding="utf-8")], self.skip)
                          if furniture else None)

    def source(self, rel: str) -> Path | None:
        for base in (self.ms.dir, self.deck.root):
            p = (base / rel).resolve()
            if p.is_file():
                return p
        return None

    def strings(self, raw: str) -> list[tuple[str, str]]:
        """(kind, normalised text) for every printed string of a page file's components."""
        out: list[tuple[str, str]] = []
        furniture, layout = self.vocab.args("furniture"), self.vocab.args("layout")
        prose, heads = self.vocab.args("prose"), self.vocab.args("heads")
        for _, attrs, _ in uses(strip_comments(raw)):
            for key, value in attrs.items():
                if key in layout or (value[:1] == "{" and "doc." in value):
                    continue
                if key in furniture:
                    if self.furniture is not None:
                        out += [(FURNITURE, v) for v in json_strings(value) or [value]]
                    continue
                leaves = json_strings(value, layout) if value.lstrip()[:1] in "[{" else []
                if leaves:
                    out += [(CELL, v) for v in leaves]
                elif key in prose:
                    out.append((PROSE, value))
                elif key in heads:
                    out.append((HEAD, value))
                else:
                    out.append((ATTR, value))
        split = []
        for kind, value in out:
            # An explicit break (a paragraph \n or a line break \v) stacks two values;
            # each traces to its own manuscript line.
            split += [(kind, norm(part)) for part in re.split(r"\\[nv]", value) if norm(part)]
        return split

    def verdicts(self, raw: str, hay: Haystack) -> list[tuple[str, str, str]]:
        """(verdict, kind, text) per compared string: `pass`, `short` or `missing`."""
        end = self.deck.get("lang.sentenceEnd", "다.")
        out = []
        for kind, text in self.strings(raw):
            if len(text) < self.min_len:
                continue
            if kind == CELL and PAGE_NUMBERS.fullmatch(text):
                continue
            against = self.furniture if kind == FURNITURE else hay
            for unit in sentences(text, end) if kind == PROSE else [text]:
                if len(unit) < self.min_len:
                    continue
                if unit in against.hay:
                    out.append(("pass", kind, unit))
                elif kind == PROSE:
                    out.append(("missing", kind, unit))
                elif kind == HEAD:
                    ok = against.has_words(strip_marker(unit, self.marker))
                    out.append(("short" if ok else "missing", kind, unit))
                elif against.has_fragment(unit) or (len(unit) < self.accent_len and against.has_words(unit)):
                    out.append(("short", kind, unit))
                else:
                    out.append(("missing", kind, unit))
        return out

    def page_files(self, reader: DeckReader, wanted: set[str]):
        """(file, raw, declared paths, missing paths, haystack) for every compared page file."""
        for name, raw in reader.files():
            if wanted and name not in wanted:
                continue
            if not any(t in self.body for t, _, _ in uses(strip_comments(raw))):
                continue
            decls = list(dict.fromkeys(self.ms.declarations(raw)))
            texts, missing = [], []
            for rel in decls:
                p = self.source(rel)
                if p is None:
                    missing.append(rel)
                else:
                    texts.append(p.read_text(encoding="utf-8"))
            yield name, raw, decls, missing, Haystack(texts, self.skip)


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    ap = cli.parser(__doc__.splitlines()[0])
    ap.add_argument("files", nargs="*", help="page files to compare, by name")
    ap.add_argument("-v", "--verbose", action="store_true", help="list the shortened strings too")
    args = ap.parse_args(argv)
    deck = cli.deck_config(args)
    totals = {"pass": 0, "short": 0, "missing": 0}
    undeclared, unresolved = [], []
    with cli.open_reader(deck) as reader:
        parity = Parity(reader, deck)
        for name, raw, decls, missing, hay in parity.page_files(reader, {Path(f).name for f in args.files}):
            print(f"── {name}")
            if not decls:
                print(f"  ⚠ {name}: no manuscript declaration; put one above the page")
                undeclared.append(name)
                continue
            for rel in missing:
                print(f"  ✖ {name}: the declared manuscript does not exist: {rel}")
                unresolved.append((name, rel))
            for verdict, kind, text in parity.verdicts(raw, hay):
                totals[verdict] += 1
                if verdict == "missing":
                    print(f"  ✖ missing [{kind}] {text[:110]}")
                elif verdict == "short" and args.verbose:
                    print(f"  △ shortened [{kind}] {text[:90]}")
    print("─" * 60)
    print(f"parity: {totals['pass']} pass, {totals['short']} shortened, {totals['missing']} missing, "
          f"{len(unresolved)} declared manuscripts that do not exist, {len(undeclared)} undeclared page files"
          + ("" if parity.furniture is not None else "; furniture not compared (no manuscript.furnitureSource)"))
    if totals["short"]:
        print("  a shortened string is the column's short form; writing it in the manuscript too makes it pass")
    return 1 if totals["missing"] or unresolved else 0


if __name__ == "__main__":
    sys.exit(main())
