#!/usr/bin/env python3
"""Every cited evidence item must be defined, and every defined item must be cited.

The evidence items are a separate submission bundle: a table defines them and
the deck's pages point at them. A tag with no definition promises a document
that does not exist, and a defined item nothing points at is a document nobody
will look for. The notation is checked too: a cell carrying a bare 「[2·5]」
beside cells that write the tag reads as a slip.

A citation is the tag followed by numbers, bracketed or not (「[증빙 2·5]」,
「증빙 1·6」). The tag followed by a count unit (「증빙 3건」) counts items and is
not a citation, and a range (「증빙 1~9」) describes the bundle and is not one
either.

Config (`evidence`, required; `null` when the deck uses no such notation):

    "evidence": {
      "tag": "증빙",                       // the word a citation opens with
      "table": "proposal/.../조견표.md",   // the Markdown table that defines the items
      "pagesColumn": -1,                   // optional: the cell listing the pages that will cite it
      "countUnits": ["건", "개"]           // optional: units that make the tag a count
    }

With `pagesColumn`, an uncited item whose listed pages are all in chapters not
yet typeset is reported as pending rather than as a defect.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader, attribute_values, json_strings, printed_source  # noqa: E402

COUNT_UNITS = ["건", "개", "종", "쪽", "항", "장", "부", "매"]
SHORTHAND = re.compile(r"\[\s*\d+(?:\s*[·,]\s*\d+)*\s*\]")


def patterns(tag: str, units: list[str]) -> tuple[re.Pattern, re.Pattern]:
    t = re.escape(tag)
    unit = "|".join(re.escape(u) for u in units)
    # The lookahead also refuses a separator, a digit or a range mark, so a
    # backtracked partial list (「2」 of 「2·5건」) is not taken as a citation.
    cited = re.compile(rf"{t}\s*(\d+(?:\s*[·,]\s*\d+)*)(?!\s*(?:[\d·,~～]|{unit}))")
    defined = re.compile(rf"^\|\s*{t}\s*(\d+)\s*\|", re.M)
    return cited, defined


def citations(sources: list[tuple[str, str]], cited_rx: re.Pattern) -> tuple[dict, list]:
    """({item: [files]}, [(file, shorthand)]) over the deck's source files."""
    cited: dict[int, list[str]] = {}
    shorthand = []
    for name, raw in sources:
        text = printed_source(raw)
        for m in cited_rx.finditer(text):
            for part in re.split(r"[·,]", m.group(1)):
                if part.strip().isdigit():
                    cited.setdefault(int(part.strip()), []).append(name)
        for _, value in attribute_values(raw):
            leaves = json_strings(value) if value.lstrip()[:1] in "[{" else []
            for v in leaves or [value]:
                if SHORTHAND.fullmatch(v.strip()):
                    shorthand.append((name, v.strip()))
    return cited, shorthand


def planned_pages(table: str, tag: str, column: int, numerals: list[str]) -> dict[int, set[str]]:
    """{item: {part or part-chapter}} from the column that lists the citing pages."""
    row = re.compile(rf"^\|\s*{re.escape(tag)}\s*(\d+)\s*\|(.*)\|\s*$", re.M)
    ref = re.compile("(" + "|".join(re.escape(n) for n in numerals) + r")(?:-(\d+))?\s+\d{2}")
    out: dict[int, set[str]] = {}
    for m in row.finditer(table):
        cells = [c.strip() for c in m.group(2).split("|")]
        cell = cells[column] if -len(cells) <= column < len(cells) else ""
        out[int(m.group(1))] = {f"{p}-{c}" if c else p for p, c in ref.findall(cell)}
    return out


def settings(deck: DeckConfig) -> dict | None:
    """The `evidence` declaration, or None when the deck declares the notation unused."""
    if not deck.has("evidence"):
        deck.require("evidence", "the evidence notation, or null when the deck uses none")
    cfg = deck.get("evidence")
    if cfg is None:
        return None
    if not isinstance(cfg, dict):
        raise ConfigError(f"deck `{deck.name}` `evidence` must be an object or null")
    deck.require("evidence.tag", "the word an evidence citation opens with")
    deck.require("evidence.table", "the Markdown table that defines the evidence items")
    if cfg.get("pagesColumn") is not None:
        deck.require("pages.numerals", "the part numerals the citing pages are written with")
    return cfg


UNUSED = "proof: the deck declares no evidence notation (evidence: null)"


def check(reader: DeckReader, deck: DeckConfig) -> tuple[list[str], list[tuple[str, str]], int]:
    """(summary lines, [(where, why)], exit code)."""
    cfg = settings(deck)
    if cfg is None:
        return [UNUSED], [], 0
    tag, table_rel = cfg["tag"], cfg["table"]
    cited_rx, defined_rx = patterns(tag, cfg.get("countUnits", COUNT_UNITS))
    table_path = deck.resolve(table_rel)
    cited, shorthand = citations(reader.files(), cited_rx)
    bad = [(name, f"「{v}」 cites by number without 「{tag}」") for name, v in shorthand] if cited else []
    if not table_path.exists():
        if not cited:
            return [f"proof: no {tag} citation and no definition table; the notation is not used"], [], 0
        bad.append(("config", f"pages cite {tag} items but the table {table_rel} does not exist"))
        return [f"proof: cited {len(cited)}, table missing"], bad, 1
    table = table_path.read_text(encoding="utf-8")
    defined = {int(n) for n in defined_rx.findall(table)}
    for n in sorted(set(cited) - defined):
        bad.append((", ".join(sorted(set(cited[n]))), f"[{tag} {n}] is not defined in {table_rel}"))
    column = cfg.get("pagesColumn")
    planned: dict[int, set[str]] = {}
    typeset: set[str] = set()
    if column is not None:
        planned = planned_pages(table, tag, int(column), deck.require("pages.numerals"))
        for p in reader.body_pages():
            typeset.add(p.part or "")
            if p.chapter_key:
                typeset.add(p.chapter_key)
    pending = []
    for n in sorted(defined - set(cited)):
        if planned.get(n) and not planned[n] & typeset:
            pending.append(n)
            continue
        bad.append((table_rel, f"{tag} {n} is cited by no page"))
    lines = []
    if pending:
        lines.append(f"ℹ {tag} items whose citing pages are not typeset yet: "
                     + ", ".join(str(n) for n in pending))
    lines.append(f"proof: defined {len(defined)}, cited {len(cited)}, pending {len(pending)}, "
                 f"mismatches {len(bad)}")
    return lines, bad, 1 if bad else 0


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0]).parse_args(argv)
    deck = cli.deck_config(args)
    if settings(deck) is None:
        print(UNUSED)
        return 0
    with cli.open_reader(deck) as reader:
        lines, bad, code = check(reader, deck)
    for line in lines:
        print(line)
    for where, why in bad:
        print(f"  ✖ {where}: {why}")
    return code


if __name__ == "__main__":
    sys.exit(main())
