#!/usr/bin/env python3
"""Requirement ids cited by the deck and the manuscript must exist in the tender.

A tender's numbering is rarely contiguous: a series jumps, and some numbers
were never issued. A range written as `PER-001~008` therefore claims a
requirement the tender does not contain, which reads to a reviewer as a
fabricated coverage count. Ranges are expanded and every member checked.

Only a heading (`#### PER-002 ...`) in the requirement digest defines an id.
The digest also names the ids the tender never issued in order to say so, and
reading its prose would take that sentence as a definition. A sentence on a
page may likewise name a missing id to say it is missing; only that sentence
is exempt, when `requirements.absence` declares how such a sentence reads.

Config (`requirements`):

    "requirements": {
      "source": "docs/requirements.md",           // required: the digest whose headings define ids
      "id": {"prefix": "[A-Z]{3}[-_]", "digits": 3},  // required: an id is prefix then digits
      "notAnId": ["TTP"],                          // optional: prefixes that are model or standard names
      "absence": "제안요청서에 (?:없다|없음|없습니다)"   // optional: how a sentence says an id is missing
    }

The separator is part of the prefix, so a tender that writes `QUR_001` beside
`PER-001` is read as issued. The deck's source files (comments stripped) and
every manuscript file are read; with `--manuscript-only` the manuscript alone,
so a bid that has no deck yet checks its manuscript before the deck exists.

    reqid.py                     # the deck and the manuscript
    reqid.py --manuscript-only   # the manuscript, no deck server opened
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader, printed_source  # noqa: E402
from bidkit.manuscript import Manuscript  # noqa: E402

# Cipher, standard and encoding names that share the id shape in any tender.
STANDARD_NAMES = ["AES", "SHA", "RSA", "DES", "ISO", "IEC", "RFC", "UTF"]


class Ids:
    def __init__(self, deck: DeckConfig):
        spec = deck.require("requirements.id", "the id shape: a prefix pattern and a digit count")
        if not isinstance(spec, dict) or "prefix" not in spec or "digits" not in spec:
            raise ConfigError(f"deck `{deck.name}` `requirements.id` must be "
                              '{"prefix": <pattern>, "digits": <n>}')
        prefix, digits = f"(?:{spec['prefix']})", int(spec["digits"])
        self.digits = digits
        self.id = re.compile(rf"(?<![A-Za-z0-9])({prefix})(\d{{{digits}}})(?![0-9])")
        self.definition = re.compile(rf"^#{{2,6}}\s+({prefix})(\d{{{digits}}})\b", re.M)
        self.range = re.compile(rf"(?<![A-Za-z0-9])({prefix})(\d{{{digits}}})\s*[~\-]\s*"
                                rf"(\d{{{digits}}})(?![0-9])")
        names = STANDARD_NAMES + list(deck.get("requirements.notAnId", []))
        self.not_an_id = re.compile("^(?:" + "|".join(re.escape(n) for n in names) + r")[-_]")
        absence = deck.get("requirements.absence")
        self.absence = re.compile(rf"[^.。\n]*(?:{absence})") if absence else None

    def issued(self, text: str) -> set[str]:
        return {f"{p}{n}" for p, n in self.definition.findall(text)}

    def cited(self, text: str):
        """Every id a text claims, ranges expanded. Yields (id, is_from_range)."""
        spans = [(m.start(), m.end()) for m in self.absence.finditer(text)] if self.absence else []
        for m in self.range.finditer(text):
            prefix, lo, hi = m.group(1), int(m.group(2)), int(m.group(3))
            if any(a <= m.start() < b for a, b in spans):
                continue
            spans.append((m.start(), m.end()))
            if lo <= hi:
                for n in range(lo, hi + 1):
                    yield f"{prefix}{n:0{self.digits}d}", True
        for m in self.id.finditer(text):
            if any(a <= m.start() < b for a, b in spans):
                continue
            name = f"{m.group(1)}{m.group(2)}"
            if not self.not_an_id.match(name):
                yield name, False


def _label(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return str(path)          # a manuscript declared outside the project root


def targets(reader: DeckReader | None, deck: DeckConfig, source: Path) -> list[tuple[str, str]]:
    out = []
    if reader is not None:
        out += [(f"deck:{name}", printed_source(raw)) for name, raw in reader.files()]
    if deck.has("manuscript"):
        for path in Manuscript.for_deck(deck).files(include_excluded=True):
            if path.resolve() != source:
                out.append((_label(path, deck.root), path.read_text(encoding="utf-8")))
    return out


def prepare(deck: DeckConfig) -> tuple[Path, Ids, set[str]]:
    """Read the declaration and the digest before any connection is opened."""
    source = deck.path("requirements.source", "the requirement digest whose headings define ids")
    ids = Ids(deck)
    have = ids.issued(source.read_text(encoding="utf-8"))
    if not have:
        raise ConfigError(f"{source} defines no requirement id under requirements.id; "
                          "a check with nothing to compare against would pass every citation")
    return source, ids, have


def check(reader: DeckReader | None, deck: DeckConfig,
          prepared: tuple[Path, Ids, set[str]] | None = None) -> tuple[int, list, list]:
    """(issued count, targets, [(where, id, from_range)])."""
    source, ids, have = prepared or prepare(deck)
    texts = targets(reader, deck, source)
    bad = []
    for where, text in texts:
        for name, ranged in sorted(set(ids.cited(text))):
            if name not in have:
                bad.append((where, name, ranged))
    return len(have), texts, bad


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    ap = cli.parser(__doc__.splitlines()[0])
    ap.add_argument("--manuscript-only", action="store_true", help="read no deck (a bid with no deck yet)")
    args = ap.parse_args(argv)
    deck = cli.deck_config(args)
    prepared = prepare(deck)
    if args.manuscript_only:
        issued, texts, bad = check(None, deck, prepared)
    else:
        with cli.open_reader(deck) as reader:
            issued, texts, bad = check(reader, deck, prepared)
    print(f"reqid: {issued} ids issued, {len(texts)} files read, {len(bad)} ids the tender does not have")
    for where, name, ranged in bad:
        how = "a range claims it" if ranged else "written directly"
        print(f"  ✖ {where}: {name} is not an issued id ({how})")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
