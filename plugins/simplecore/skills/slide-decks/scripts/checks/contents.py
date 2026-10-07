#!/usr/bin/env python3
"""The contents page's numbers must be the folios the parts and chapters print on.

A contents page typed by hand is right the day it is typed and wrong the first
time a page moves; a panel member who turns to 「Ⅳ-2 … 50」 and lands on
another chapter stops trusting the volume. This reads the contents page as
printed and compares each number with the folio the deck reader computes: a
part's number with its divider's folio, a chapter's with the folio of its first
body page.

A part or chapter the deck does not typeset yet has no folio to compare, so
its number is reported as pending, not as a defect, and `--write` leaves it as
it stands.

`--write` sets the computed numbers through the deck server's `set_texts`
tool, keyed by the printed nodes it read, so the open deck takes the change as
an edit (with its history line) rather than a file being overwritten behind
the application's back. Nothing is written to disk by this script.

Vocabulary (the kit's `contents` entry, or a project override):

    "contents": { "part":    { "number": "ch.no", "page": "ch.page" },
                  "chapter": { "number": "it.no", "page": "it.page" } }

A contents page that stands after the first annex page is an annex's own and is
not read: its numbers are on the annex series, which a project check holds.

Each name is the data field a printed contents node is bound to: the content
reading marks a node drawn from a JSON item list as `←row[i].<field>`. A
divider's part is the number its master name ends with (`PART-3`).
"""
from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.deckread import DeckError, DeckReader  # noqa: E402
from bidkit.sgmcp import DeckUnavailable  # noqa: E402

ORIGIN = re.compile(r"←row\[\d+\]\.([\w.]+)$")
GENERATION = re.compile(r"\bgeneration (\d+)\s+revision (\d+)")


@dataclass
class Entry:
    slide: int
    key: str               # the printed node, as set_texts addresses it
    level: str             # "part" or "chapter"
    part: str              # the part numeral the row belongs to
    chapter: str | None
    printed: str
    expected: str | None   # None: not typeset yet


def fields(reader: DeckReader, deck: DeckConfig) -> dict:
    vocab = reader.vocab.data if reader.vocab else {}
    spec = vocab.get("contents")
    if not isinstance(spec, dict):
        raise ConfigError(f"deck `{deck.name}`: the vocabulary has no `contents` entry naming the "
                          "fields a contents row's number and page are bound to")
    for level in ("part", "chapter"):
        entry = spec.get(level)
        if not isinstance(entry, dict) or not entry.get("number") or not entry.get("page"):
            raise ConfigError(f"deck `{deck.name}`: vocabulary `contents.{level}` must name "
                              "`number` and `page`")
    return spec


def _texts(node: dict, out: list) -> None:
    if node.get("role") == "master":
        return
    if node.get("role") in ("text", "title"):
        m = ORIGIN.search(node.get("origin", "") or "")
        if m:
            out.append((m.group(1), node.get("key", ""), node.get("text", "").strip()))
    for child in node.get("children", []):
        _texts(child, out)


def folios(reader: DeckReader) -> tuple[dict, dict]:
    """({part numeral: divider folio}, {(numeral, chapter): first body folio})."""
    cfg = reader.pages_config
    parts, chapters = {}, {}
    for s in reader.slides():
        if s.folio and cfg.is_("divider", s.master):
            m = re.search(r"(\d+)$", s.master)
            if m and 1 <= int(m.group(1)) <= len(cfg.numerals):
                parts.setdefault(cfg.numerals[int(m.group(1)) - 1], str(s.folio))
        if s.page_id and s.folio:
            chapters.setdefault((s.part, s.chapter), str(s.folio))
    return parts, chapters


def entries(reader: DeckReader, deck: DeckConfig) -> list[Entry]:
    spec = fields(reader, deck)
    parts, chapters = folios(reader)
    try:
        data = json.loads(reader.session.read("sg://deck/content?format=json"))
    except json.JSONDecodeError as e:
        raise DeckError("sg://deck/content?format=json is not JSON") from e
    numerals = set(reader.pages_config.numerals)
    # A contents page standing among the annexes lists an annex's own documents on the
    # annex series, not the body's parts; the body's contents come before any annex page.
    annex_from = next((s.n for s in reader.slides() if reader.pages_config.is_("annex", s.master)), None)
    out: list[Entry] = []
    for item in data:
        if annex_from is not None and item["slide"] > annex_from:
            continue
        nodes: list = []
        for block in item.get("blocks", []):
            _texts(block, nodes)
        part = chapter = None
        for field, key, text in nodes:
            if field == spec["part"]["number"]:
                part, chapter = text, None
                if part not in numerals:
                    raise DeckError(f"slide {item['slide']}: contents part 「{text}」 is not in pages.numerals")
            elif field == spec["chapter"]["number"]:
                chapter = re.sub(r"\D", "", text) or None
            elif field == spec["part"]["page"] and part:
                out.append(Entry(item["slide"], key, "part", part, None, text, parts.get(part)))
            elif field == spec["chapter"]["page"] and part and chapter:
                out.append(Entry(item["slide"], key, "chapter", part, chapter, text,
                                 chapters.get((part, chapter))))
    return out


def judge(found: list[Entry]) -> tuple[list[Entry], list[Entry]]:
    """(wrong numbers, pending rows)."""
    wrong = [e for e in found if e.expected is not None and e.printed != e.expected]
    pending = [e for e in found if e.expected is None]
    return wrong, pending


def write(reader: DeckReader, wrong: list[Entry]) -> str:
    """Set the computed numbers in the open deck; returns the server's answer."""
    head = reader.session.read("sg://deck")
    m = GENERATION.search(head)
    if not m:
        raise DeckUnavailable("sg://deck states no generation and revision; set_texts cannot be addressed")
    result = reader.session.call("set_texts", {
        "generation": int(m.group(1)), "readAt": int(m.group(2)),
        "label": "contents page numbers",
        "why": "contents numbers set to the folios the parts and chapters print on",
        "items": [{"key": e.key, "text": e.expected} for e in wrong]})
    text = "\n".join(c.get("text", "") for c in result.get("content", []) if isinstance(c, dict))
    if result.get("isError"):
        raise DeckUnavailable(f"set_texts refused the change: {text}")
    return text


def name(e: Entry) -> str:
    return e.part if e.level == "part" else f"{e.part}-{e.chapter}"


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    ap = cli.parser(__doc__.splitlines()[0])
    ap.add_argument("--write", action="store_true",
                    help="set the computed numbers in the open deck through set_texts")
    args = ap.parse_args(argv)
    deck = cli.deck_config(args)
    with cli.open_reader(deck, write=args.write) as reader:
        found = entries(reader, deck)
        wrong, pending = judge(found)
        if not found:
            raise DeckError("the deck prints no contents row the vocabulary's `contents` fields name")
        answer = write(reader, wrong) if args.write and wrong else ""
    print(f"contents: {len(found)} numbers, {len(wrong)} differ from the folio, "
          f"{len(pending)} pending (not typeset yet)")
    if pending:
        print("  ℹ pending: " + ", ".join(f"{name(e)} {e.printed}" for e in pending))
    for e in wrong:
        mark = "→ set" if args.write else "✖"
        print(f"  {mark} slide {e.slide} {name(e)}: printed {e.printed}, the {e.level} begins on {e.expected}")
    if answer:
        print(answer)
    return 0 if args.write or not wrong else 1


if __name__ == "__main__":
    sys.exit(main())
