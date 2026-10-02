#!/usr/bin/env python3
"""Every reference to annex material points at something the annex carries.

The body cites the annex in several ways: the annex number, a numbered source
in a reference list, a capture, a board frame. None is checked by the build.
A number survives a reordering of the annex and a source number survives its
row being deleted, and the reader is sent to a page that does not answer. Each
reference is read against what the annex actually holds, which is read from
the annex itself, never declared beside the check.

Config (`annex.references`, required): one entry per kind of reference.

    "annex": { "references": {
      "annex":  { "cite": "별첨\\s*(?P<id>\\d{1,2})(?:\\s*~\\s*(?P<to>\\d{1,2}))?(?!\\d)",
                  "notBefore": ["쪽", "장", "건"],
                  "defined": { "deck": "pages/90-annex.xml", "pattern": "별첨\\s*(\\d+)\\s*-\\s*1\\b" } },
      "source": { "cite": "(?P<kind>기술|법령)\\s*근거\\s*(?P<list>[0-9][0-9·~,\\s]*)",
                  "notBefore": ["건"],
                  "defined": { "file": "proposal/00-서식/04-참고문헌.md",
                               "pattern": "^\\|\\s*(?P<kind>기술|법령)\\s*근거\\s*(?P<id>\\d+)\\s*\\|" } }
    } }

`cite` names the value with a group `id` (and `to` for a numeric range) or
`list` (numbers separated by 「·」 or 「,」, with 「a~b」 ranges); an optional
`kind` group keys the value per kind. `defined` reads the values from a file
(`file`, relative to the project) or from a deck source file the server holds
(`deck`, its path in the deck); `pattern` captures `id` (or group 1) and
optionally `kind`, with multiline matching. `notBefore` lists what, written
right after a citation, makes it a count rather than a reference.

The deck's source files and every manuscript file outside the annex are read.
"""
from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader, printed_source  # noqa: E402
from bidkit.manuscript import Manuscript  # noqa: E402
from bidkit.sgmcp import split_markup  # noqa: E402

RANGE = re.compile(r"(\d+)\s*~\s*(\d+)")
NUMS = re.compile(r"\d+")


@dataclass
class Kind:
    name: str
    cite: re.Pattern
    not_before: tuple
    defined: dict


def kinds(deck: DeckConfig) -> list[Kind]:
    table = deck.require("annex.references", "each kind of annex reference and where its values are defined")
    if not isinstance(table, dict) or not table:
        raise ConfigError(f"deck `{deck.name}` `annex.references` must map a kind to its cite and defined")
    out = []
    for name, spec in table.items():
        if not isinstance(spec, dict) or not spec.get("cite") or not isinstance(spec.get("defined"), dict):
            raise ConfigError(f"deck `{deck.name}` `annex.references.{name}` needs `cite` and `defined`")
        try:
            cite = re.compile(spec["cite"])
        except re.error as e:
            raise ConfigError(f"`annex.references.{name}.cite` is not a valid pattern: {e}") from e
        if not ({"id", "list"} & set(cite.groupindex)):
            raise ConfigError(f"`annex.references.{name}.cite` captures neither `id` nor `list`")
        d = spec["defined"]
        if not d.get("pattern") or not (d.get("file") or d.get("deck")):
            raise ConfigError(f"`annex.references.{name}.defined` needs `pattern` and `file` or `deck`")
        out.append(Kind(name, cite, tuple(spec.get("notBefore", [])), d))
    return out


def values_of(m: re.Match) -> list[str]:
    """Every value one citation names, ranges expanded."""
    g = m.groupdict()
    kind = g.get("kind")
    prefix = f"{kind}:" if kind else ""
    if g.get("list") is not None:
        run = g["list"]
        got = [int(n) for n in NUMS.findall(RANGE.sub("", run))]
        for a, b in RANGE.findall(run):
            got.extend(range(int(a), int(b) + 1))
        return [f"{prefix}{n}" for n in got]
    first, to = g.get("id"), g.get("to")
    if to and first and first.isdigit() and to.isdigit():
        return [f"{prefix}{n}" for n in range(int(first), int(to) + 1)]
    return [f"{prefix}{first}"] if first else []


def defined(kind: Kind, deck: DeckConfig, sources: dict[str, str] | None) -> set[str]:
    d = kind.defined
    if d.get("file"):
        path = deck.resolve(d["file"])
        if not path.is_file():
            raise ConfigError(f"`annex.references.{kind.name}.defined.file` {d['file']} does not exist")
        text = path.read_text(encoding="utf-8")
    else:
        if sources is None:
            raise ConfigError(f"`annex.references.{kind.name}` reads the deck, which was not opened")
        if d["deck"] not in sources:
            raise ConfigError(f"the deck holds no source {d['deck']} (annex.references.{kind.name}.defined.deck)")
        text = printed_source(sources[d["deck"]])
    rx = re.compile(d["pattern"], re.M)
    out = set()
    for m in rx.finditer(text):
        g = m.groupdict()
        value = g.get("id") or (m.group(1) if rx.groups else m.group(0))
        out.add(normal(f"{g['kind']}:{value}" if g.get("kind") else value))
    if not out:
        raise ConfigError(f"`annex.references.{kind.name}.defined` finds no value; a check with nothing "
                          "to compare against would fail every reference or none")
    return out


def normal(v: str) -> str:
    head, _, tail = v.rpartition(":")
    tail = str(int(tail)) if tail.isdigit() else tail
    return f"{head}:{tail}" if head else tail


def scan(name: str, text: str, ks: list[Kind], have: dict[str, set[str]]) -> list[str]:
    found = []
    for k in ks:
        for m in k.cite.finditer(text):
            if k.not_before and text[m.end():m.end() + 1] in k.not_before:
                continue
            for v in values_of(m):
                if normal(v) not in have[k.name]:
                    found.append(f"{name}: {k.name} 「{m.group(0).strip()}」 names {v}, which the annex does not carry")
    return found


def check(deck: DeckConfig, reader: DeckReader | None) -> tuple[int, dict, list[str]]:
    """(files read, {kind: defined count}, findings)."""
    ks = kinds(deck)
    sources = None
    texts: list[tuple[str, str]] = []
    if reader is not None:
        sources = split_markup(reader.session.read("sg://deck/markup"))
        texts += [(f"deck:{n}", printed_source(raw)) for n, raw in reader.files()]
    if deck.has("manuscript"):
        ms = Manuscript.for_deck(deck)
        texts += [(p.relative_to(deck.root).as_posix() if p.is_relative_to(deck.root) else str(p),
                   p.read_text(encoding="utf-8")) for p in ms.files(annex=False)]
    have = {k.name: defined(k, deck, sources) for k in ks}
    seen, bad = set(), []
    for name, text in texts:
        for line in scan(name, text, ks, have):
            if line not in seen:
                seen.add(line)
                bad.append(line)
    return len(texts), {k: len(v) for k, v in have.items()}, bad


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    ap = cli.parser(__doc__.splitlines()[0])
    ap.add_argument("--manuscript-only", action="store_true", help="read no deck (a bid with no deck yet)")
    args = ap.parse_args(argv)
    deck = cli.deck_config(args)
    if args.manuscript_only:
        files, have, bad = check(deck, None)
    else:
        with cli.open_reader(deck, with_vocabulary=False) as reader:
            files, have, bad = check(deck, reader)
    print(f"annexref: {files} files read, defined " + ", ".join(f"{k} {n}" for k, n in have.items())
          + f", {len(bad)} references to nothing")
    for line in bad:
        print(f"  ✖ {line}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
