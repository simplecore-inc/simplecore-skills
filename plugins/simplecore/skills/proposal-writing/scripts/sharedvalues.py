#!/usr/bin/env python3
"""A value the shared-facts table assigns to some pages is on those pages and no other.

When several chapters state one fact, a table of shared facts says which words
each states it in and on which pages it is printed. A distinctive value in
that wording (one carrying a decimal point with three or more digits after it,
or a thousands comma) must appear on every page the row lists and on no page
it does not: a value that drifted off its page, was copied onto a second page,
or is promised by a row no page carries is a fact the panel reads two ways.

Config (`manuscript.sharedValues`, required):

    "manuscript": { ..., "sharedValues": {
      "file": "docs/proposal/00-README.md",
      "section": "## 5. 장 사이에서 한 문구로 쓰는 사실",            // optional: the heading over the table
      "columns": { "fact": "사실", "wording": "인쇄할 문구", "pages": "적는 쪽" },
      "pages": { "marker": "^> 쪽 (\\d+)\\b" },   // a manuscript line opening a printed page, or "deck"
      "distinctive": "\\d+\\.\\d{3,}|\\d{1,3}(?:,\\d{3})+"   // optional
    } }

With `"pages": {"marker": ...}` a page's text runs from its marker line to the
next one, inside each file's printed part (`manuscript.printed`); a page split
across two files collects both. With `"pages": "deck"` the pages cell lists
page ids and each page's printed text is read from the deck.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit import mdtable  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader  # noqa: E402
from bidkit.manuscript import Manuscript  # noqa: E402

DISTINCTIVE = r"\d+\.\d{3,}|\d{1,3}(?:,\d{3})+"   # a section number such as 2.5 is not distinctive


def settings(deck: DeckConfig) -> dict:
    cfg = deck.require("manuscript.sharedValues", "the table of facts several pages share")
    if not isinstance(cfg, dict) or not cfg.get("file") or not isinstance(cfg.get("columns"), dict):
        raise ConfigError(f"deck `{deck.name}` `manuscript.sharedValues` needs `file` and `columns`")
    for key in ("fact", "wording", "pages"):
        if not cfg["columns"].get(key):
            raise ConfigError(f"`manuscript.sharedValues.columns.{key}` names no column")
    pages = cfg.get("pages")
    if pages != "deck" and not (isinstance(pages, dict) and pages.get("marker")):
        raise ConfigError("`manuscript.sharedValues.pages` must be \"deck\" or {\"marker\": <pattern>}")
    return cfg


def manuscript_pages(deck: DeckConfig, marker: str) -> dict[str, str]:
    ms = Manuscript.for_deck(deck)
    rx = re.compile(marker)
    printed = ms.printed
    out: dict[str, str] = {}
    for path in ms.files():
        inside, page = printed is None, None
        for line in path.read_text(encoding="utf-8").split("\n"):
            if printed and line.startswith(printed):
                inside = True
                continue
            if printed and line.startswith("## ") and not line.startswith(printed):
                inside, page = False, None
                continue
            if not inside:
                continue
            m = rx.match(line)
            if m:
                page = m.group(1)
            if page is not None:
                out[page] = out.get(page, "") + line + "\n"
    return out


def deck_pages(reader: DeckReader) -> dict[str, str]:
    return {p.page_id: p.text for p in reader.body_pages()}


def page_keys(cell: str, deck_mode: bool, known: dict[str, str]) -> list[str]:
    if not deck_mode:
        return re.findall(r"\d+", cell)
    return [k for k in known if k in cell]


def check(deck: DeckConfig, reader: DeckReader | None) -> tuple[int, int, list[str]]:
    """(rows read, pages read, findings)."""
    cfg = settings(deck)
    path = deck.path("manuscript.sharedValues.file", "the file holding the shared-facts table")
    text = mdtable.section(path.read_text(encoding="utf-8"), cfg.get("section"), str(path))
    cols = cfg["columns"]
    table = mdtable.find(text, [cols["fact"], cols["wording"], cols["pages"]], str(path))
    deck_mode = cfg["pages"] == "deck"
    if deck_mode:
        if reader is None:
            raise ConfigError("`manuscript.sharedValues.pages` is \"deck\" but no deck was opened")
        pages = deck_pages(reader)
    else:
        pages = manuscript_pages(deck, cfg["pages"]["marker"])
    if not pages:
        raise ConfigError("no printed page was found to compare the table against")
    distinctive = re.compile(cfg.get("distinctive", DISTINCTIVE))
    fi, wi, pi = (table.column(cols[k]) for k in ("fact", "wording", "pages"))
    bad, rows = [], 0
    for row in table.rows:
        listed = page_keys(table.cell(row, pi), deck_mode, pages)
        if not listed:
            continue
        rows += 1
        fact = table.cell(row, fi)
        for value in dict.fromkeys(distinctive.findall(table.cell(row, wi))):
            for page in listed:
                if value not in pages.get(page, ""):
                    bad.append(f"{fact}: {value} is not on page {page}")
            for page, body in pages.items():
                if page not in listed and value in body:
                    bad.append(f"{fact}: {value} is on page {page}, which the row does not assign")
    return rows, len(pages), bad


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0]).parse_args(argv)
    deck = cli.deck_config(args)
    if settings(deck)["pages"] == "deck":
        with cli.open_reader(deck) as reader:
            rows, pages, bad = check(deck, reader)
    else:
        rows, pages, bad = check(deck, None)
    print(f"sharedvalues: {rows} rows, {pages} printed pages, {len(bad)} values off their pages")
    for line in bad:
        print(f"  ✖ {line}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
