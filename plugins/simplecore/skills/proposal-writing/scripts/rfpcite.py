#!/usr/bin/env python3
"""Every citation of a tender chapter must land on that chapter of the tender.

The proposal and the tender both number their chapters with roman numerals,
so a citation can name the proposal's own chapter while pointing at the
tender. Each citation (「제안요청서 Ⅲ. 2. 사업 범위」) is resolved against the
transcribed tender: a numeral the tender does not carry and a section number
that chapter does not carry are errors, and a section name that the cited
chapter does not print but another chapter does is an error naming where it
is. A name no chapter prints is a warning: it may be a paraphrase.

A single word such as 「개요」 sits in every chapter, so the comparison takes
the longest prefix of the name (up to three words) that the tender prints
anywhere. A name that opens with a particle (「Ⅴ. 1.의」) is not a name.

Config (`rfp`, required):

    "rfp": {
      "dir": "docs/rfp/md",                     // the transcription, one file per chapter or more
      "chapter": "^# ([Ⅰ-Ⅻ])\\. ",              // optional: the line that opens a chapter
      "section": "^## (\\d+)\\. (.+)$",          // optional: a section heading, number and name
      "skipLines": ["^> 원본:"],                 // optional: lines that are not the tender's text
      "word": "제안요청서",                       // optional: the word a citation opens with
      "scan": ["docs/tech"],                     // optional: directories read besides the manuscript
      "skipDirs": ["review"]                     // optional: directory names not read
    }
"""
from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.manuscript import Manuscript  # noqa: E402

NUMERALS = "ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ"
CHAPTER = rf"^# ([{NUMERALS}])\. "
SECTION = r"^## (\d+)\. (.+)$"
PARTICLE = re.compile(r"^(이|가|은|는|을|를|의|에|와|과|도|만|으로|로|부터|까지|에서|이고|이다|이며|이자|인|하고)(\s|$)")
JOSA = re.compile(r"(이|가|은|는|을|를|의|에|와|과|도|만|으로|로|에서|이고|이며|이라고|라고)$")


@dataclass
class Chapter:
    text: str = ""
    sections: dict = field(default_factory=dict)


def chapters(deck: DeckConfig) -> dict[str, Chapter]:
    d = deck.path("rfp.dir", "the transcribed tender")
    head = re.compile(deck.get("rfp.chapter", CHAPTER), re.M)
    sec = re.compile(deck.get("rfp.section", SECTION), re.M)
    skip = [re.compile(p) for p in deck.get("rfp.skipLines", [])]
    out: dict[str, Chapter] = {}
    for path in sorted(d.rglob("*.md")):
        body = path.read_text(encoding="utf-8")
        m = head.search(body)
        if not m:
            continue
        ch = out.setdefault(m.group(1), Chapter())
        ch.text += "\n".join(l for l in body.split("\n") if not any(r.match(l) for r in skip)) + "\n"
        for s in sec.finditer(body):
            ch.sections[int(s.group(1))] = s.group(2).strip()
    if not out:
        raise ConfigError(f"no chapter heading matching rfp.chapter in {d}; nothing to resolve citations against")
    return out


def citation(word: str) -> re.Pattern:
    return re.compile(rf"{re.escape(word)}\s*([{NUMERALS}])\s*(?:장)?\s*\.?\s*(?:(\d+)\s*\.)?"
                      r"\s*([가-힣A-Za-z][가-힣A-Za-z0-9 ]{0,24})?")


def judge(roman: str, number: str | None, tail: str | None, chs: dict[str, Chapter]) -> tuple[str, str] | None:
    """(level, message) for one citation, or None when it resolves."""
    ch = chs.get(roman)
    if ch is None:
        return "error", f"the tender has no chapter {roman}"
    if number is not None and int(number) not in ch.sections:
        has = " · ".join(str(n) for n in sorted(ch.sections))
        return "error", f"chapter {roman} has no section {number}; its sections are {has}"
    if not tail or PARTICLE.match(tail):
        return None
    words = tail.strip().split()
    phrase, elsewhere = None, []
    for n in range(min(3, len(words)), 0, -1):
        candidate = " ".join(words[:n - 1] + [JOSA.sub("", words[n - 1])])
        if len(candidate.replace(" ", "")) < 2:
            phrase = None
            break
        if candidate in ch.text:
            phrase = None
            break
        others = [r for r, c in chs.items() if r != roman and candidate in c.text]
        phrase = candidate
        if others:
            elsewhere = others
            break
    if phrase is None:
        return None
    if elsewhere:
        return "error", f"「{phrase}」 is not in chapter {roman}; it is in {' · '.join(elsewhere)}"
    return "warn", f"「{phrase}」 is in no chapter of the tender"


def files(deck: DeckConfig) -> list[Path]:
    skip = set(deck.get("rfp.skipDirs", []))
    out: list[Path] = []
    if deck.has("manuscript"):
        ms = Manuscript.for_deck(deck)
        out += [p for p in ms.files() if not skip & set(p.relative_to(ms.dir).parts[:-1])]
    for rel in deck.get("rfp.scan", []):
        d = deck.resolve(rel)
        if not d.is_dir():
            raise ConfigError(f"`rfp.scan` names {rel}, which is not a directory")
        out += [p for p in sorted(d.rglob("*.md")) if not skip & set(p.relative_to(d).parts[:-1])]
    if not out:
        raise ConfigError(f"deck `{deck.name}` declares neither `manuscript` nor `rfp.scan`; nothing to read")
    return out


def check(deck: DeckConfig) -> tuple[int, int, list[tuple[str, str, str]]]:
    """(chapters, files, [(where, level, message)])."""
    chs = chapters(deck)
    rx = citation(deck.get("rfp.word", "제안요청서"))
    paths = files(deck)
    found = []
    for path in paths:
        rel = path.relative_to(deck.root).as_posix() if path.is_relative_to(deck.root) else str(path)
        for i, line in enumerate(path.read_text(encoding="utf-8").split("\n"), 1):
            for m in rx.finditer(line):
                verdict = judge(m.group(1), m.group(2), m.group(3), chs)
                if verdict:
                    found.append((f"{rel}:{i}", *verdict))
    return len(chs), len(paths), found


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0]).parse_args(argv)
    deck = cli.deck_config(args)
    chs, n, found = check(deck)
    errors = [f for f in found if f[1] == "error"]
    print(f"rfpcite: {chs} tender chapters, {n} files, {len(errors)} citations that miss, "
          f"{len(found) - len(errors)} names to read")
    for where, level, message in found:
        print(f"  {'✖' if level == 'error' else '⚠'} {where}: {message}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
