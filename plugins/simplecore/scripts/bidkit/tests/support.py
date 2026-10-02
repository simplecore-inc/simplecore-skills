"""Builders for the tests: a temporary project, and recordings of a deck.

A recording has the shape the server answers with: `sg://deck/markup` as
`=== file:` sections, and `sg://deck/content?format=json` as a list of slides
whose blocks carry roles (`use`, `row`, `text`, `master`). The builders write
the smallest such shapes; `fixtures/three-pages.json` is a capture from a live
deck with its wording replaced.
"""
from __future__ import annotations

import json
from pathlib import Path

from bidkit.config import DeckConfig, Project
from bidkit.deckread import DeckReader
from bidkit.sgmcp import RecordedTransport, Session
from bidkit.vocab import Vocabulary

FIXTURES = Path(__file__).resolve().parent / "fixtures"
NUMERALS = ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ", "Ⅷ"]
PAGES = {"numerals": NUMERALS, "id": "{part}-{chapter} {ordinal:02}"}


def project(root: Path, deck: dict, name: str = "proposal") -> DeckConfig:
    """Write `.claude/slide-decks.json` under `root` and return the deck."""
    data = {"decks": {name: {"dir": "deck", "kind": "document", "vocabulary": "simplecore-proposal-01",
                             "pages": PAGES, **deck}}}
    (root / ".claude").mkdir(parents=True, exist_ok=True)
    (root / "deck").mkdir(exist_ok=True)
    (root / ".claude" / "slide-decks.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return Project.load(root).deck(name)


def markup(files: dict[str, str], entry: str = "main.sgx") -> str:
    imports = "".join(f'  <Import src="{p}" />\n' for p in files)
    sections = [f"=== file: {entry}\n<SlideGlance>\n{imports}</SlideGlance>\n"]
    sections += [f"=== file: {p}\n{text}\n" for p, text in files.items()]
    return "".join(sections)


def slide(n: int, master: str, head: dict | None = None, tables: list | None = None,
          texts: tuple = ()) -> dict:
    """One slide: an optional running head, tables as lists of rows, plain texts."""
    children = []
    if head is not None:
        children.append({"role": "use", "key": f"node#{n}00", "tag": "sg-master-head", "attrs": head})
    for t, rows in enumerate(tables or []):
        for i, cells in enumerate(rows):
            children.append({"role": "row", "key": f"node#{n}{t}/row:{i}",
                             "aux": "| " + " | ".join(cells) + " |"})
    children += [{"role": "text", "key": f"node#{n}9{i}", "text": s} for i, s in enumerate(texts)]
    return {"slide": n, "blocks": [{"role": "group", "children": children},
                                   {"role": "master", "key": f"master:{master}"}]}


def body(n: int, part: int, chapter: int, tables: list | None = None, texts: tuple = ()) -> dict:
    return slide(n, f"BODY-{part}", {"tone": str(part), "chapter": f"{chapter}. 장", "title": "가. 쪽"},
                 tables, texts)


def recording(files: dict[str, str] | None = None, slides: list | None = None) -> dict:
    return {"resources": {"sg://deck/markup": markup(files or {}),
                          "sg://deck/content?format=json": json.dumps(slides or [], ensure_ascii=False)}}


def reader(deck: DeckConfig, rec: dict) -> DeckReader:
    vocab = Vocabulary.for_deck(deck) if deck.has("vocabulary") else None
    return DeckReader(Session(deck, RecordedTransport(rec)), deck, vocab)
