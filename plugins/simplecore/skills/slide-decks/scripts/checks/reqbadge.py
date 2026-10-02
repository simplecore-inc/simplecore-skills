#!/usr/bin/env python3
"""Requirement ids nest: a badge's ids are the page's, and the page's are the tender's.

The running head says which requirements a page answers. A region head or a
chip that names an id the head does not leaves the evaluator to guess which
requirement the block serves, and a head naming an id the tender never issued
claims coverage of nothing. So, on every body page whose head names ids:

- every id the head names is one the tender issued (`requirements`)
- every id a region head or a badge names is one the page's head names
- with `requirements.manuscriptLine` declared, every id the head names is on
  that line of a manuscript file the page declares, and the manuscript's own
  sub-section lines nest in the file's line and are each badged on a page

Two rules are a deck's policy, not a fact, and run only when declared:

- `checks.reqbadge.regions`: every region head on such a page carries its ids
  (a page with no region head is badged by its running head)
- `checks.reqbadge.bareIds`: an issued id written in a sentence slot (the kit
  vocabulary's `sentences`) is reported as bare text; a table cell is a record
  and is not read

The head argument is the kit vocabulary's `pages.head.reqs`; region heads and
badges are `roles.regionIds` and `roles.badgeIds` (component -> argument, or
`arg[].key` for an item list). `SFR-004 · 005` carries the prefix forward and
`SER-001~008` is a range; both are expanded.

    "requirements": { "source": ..., "id": {"prefix": "[A-Z]{3}[-_]", "digits": 3},
                      "manuscriptLine": "^>\\s*대응 요구사항[::]\\s*(.*)$" }
"""
from __future__ import annotations

import importlib.util
import json
import re
import sys
from re import Pattern
from pathlib import Path

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE.parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader, Page  # noqa: E402
from bidkit.manuscript import Manuscript  # noqa: E402
from bidkit.vocab import role  # noqa: E402
from period import source_rows  # noqa: E402


def _reqid():
    path = HERE.parents[3] / "proposal-writing" / "scripts" / "reqid.py"
    spec = importlib.util.spec_from_file_location("reqid", path)
    if spec is None or spec.loader is None:
        raise ConfigError(f"cannot load the requirement id reader at {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class Expander:
    """Every id a string names, ranges and carried prefixes expanded."""

    def __init__(self, deck: DeckConfig):
        self.ids = _reqid().Ids(deck)
        spec = deck.require("requirements.id")
        prefix, d = f"(?:{spec['prefix']})", int(spec["digits"])
        self.digits = d
        self.token = re.compile(
            rf"(?<![A-Za-z0-9])({prefix})(\d{{{d}}})(?:\s*~\s*(\d{{{d}}}))?(?![0-9])"
            rf"|(?<![A-Za-z0-9\-_])(\d{{{d}}})(?:\s*~\s*(\d{{{d}}}))?(?![0-9])")

    def __call__(self, text: str) -> list[str]:
        out: list[str] = []
        prefix = None
        for m in self.token.finditer(text or ""):
            if m.group(1):
                prefix, lo, hi = m.group(1), int(m.group(2)), int(m.group(3) or m.group(2))
            elif prefix:
                lo, hi = int(m.group(4)), int(m.group(5) or m.group(4))
            else:
                continue
            for n in range(lo, hi + 1):
                name = f"{prefix}{n:0{self.digits}d}"
                if not self.ids.not_an_id.match(name):
                    out.append(name)
        return out


def _arg_values(attrs: dict, spec: str) -> list[str]:
    m = re.match(r"^(\w+)\[\]\.(\w+)$", spec)
    if not m:
        return [attrs.get(spec, "")]
    try:
        items = json.loads(attrs.get(m.group(1)) or "[]")
    except (ValueError, TypeError):
        return []
    return [str(i.get(m.group(2), "")) for i in items if isinstance(i, dict)] if isinstance(items, list) else []


class Rules:
    def __init__(self, reader: DeckReader, deck: DeckConfig):
        self.expand = Expander(deck)
        vocab = reader.vocab
        head = (vocab.pages().get("head", {}) if vocab else {}) | deck.section("pages").get("head", {})
        self.head_arg = head.get("reqs")
        if not self.head_arg:
            raise ConfigError("neither `pages.head.reqs` nor the kit vocabulary names the running head's "
                              "requirement argument")
        regions, _ = role(deck, vocab, "reqbadge", "regionIds")
        badges, _ = role(deck, vocab, "reqbadge", "badgeIds")
        self.unset = [n for n, v in (("regionIds", regions), ("badgeIds", badges)) if v is None]
        self.regions, self.badges = dict(regions or {}), dict(badges or {})
        cfg = deck.section("checks.reqbadge")
        self.require_regions = bool(cfg.get("regions", False))
        self.bare = bool(cfg.get("bareIds", False))


def page_findings(rules: Rules, page: Page, issued: set[str], file_ids: set[str] | None) -> list[str]:
    page_ids = set(rules.expand(page.head.get(rules.head_arg, "")))
    if not page_ids:
        return []
    out = [f"the head names {i}, which the tender never issued" for i in sorted(page_ids - issued)]
    if file_ids is not None and page_ids - file_ids:
        out.append(f"the head names {' · '.join(sorted(page_ids - file_ids))}, which the manuscript's "
                   "requirement line does not")
    regions = 0
    for u in page.uses:
        spec = rules.regions.get(u.tag) or rules.badges.get(u.tag)
        if not spec:
            continue
        ids = {i for v in _arg_values(u.attrs, spec) for i in rules.expand(v)}
        if u.tag in rules.regions:
            regions += 1
            label = u.attrs.get("head") or u.attrs.get("text") or u.tag
            if not ids and rules.require_regions:
                out.append(f"region head 「{label}」 ({u.tag}) carries no requirement ids")
        else:
            label = u.tag
        if ids - page_ids:
            out.append(f"「{label}」 ({u.tag}) names {' · '.join(sorted(ids - page_ids))}, "
                       "which the page's head does not")
    return out


def bare_ids(reader: DeckReader, rules: Rules, issued: set[str]) -> list[tuple[str, str]]:
    """Issued ids printed in a sentence slot (the kit vocabulary's `sentences`)."""
    out = []
    for name, line, template, row in source_rows(reader):
        for slot, value in row:
            for i in dict.fromkeys(rules.expand(value)):
                if i in issued:
                    out.append((f"{name}:{line}", f"{i} stands as bare text in {template}.{slot}"))
    return out


def manuscript_ids(md: str, line: Pattern, expand) -> tuple[set[str], list[tuple[str, set[str]]]]:
    """(the file line's ids, [(sub-section heading, its line's ids)]) of one manuscript file."""
    file_ids: set[str] = set()
    subs: list[tuple[str, set[str]]] = []
    heading, seen = None, False
    for raw in md.split("\n"):
        if raw.startswith("### "):
            heading = raw[4:].strip()
            continue
        if raw.startswith("## "):
            heading = None
            continue
        m = line.match(raw.strip())
        if not m:
            continue
        ids = set(expand(m.group(1)))
        if not seen:
            file_ids, seen = ids, True
        else:
            subs.append((heading or "", ids))
    return file_ids, subs


def manuscript_findings(rel: str, md: str, badged: set[str], line: Pattern, expand) -> list[str]:
    file_ids, subs = manuscript_ids(md, line, expand)
    out = []
    for heading, ids in subs:
        if not heading:
            out.append(f"{rel}: a requirement line outside any sub-section")
            continue
        extra = sorted(ids - file_ids)
        if extra:
            out.append(f"{rel} 「{heading}」: {' · '.join(extra)} is not on the file's requirement line")
        elif ids - badged:
            out.append(f"{rel} 「{heading}」: no page drawn from this file badges "
                       f"{' · '.join(sorted(ids - badged))}")
    return out


def find(reader: DeckReader, deck: DeckConfig) -> tuple[int, list[tuple[str, str]], Rules, bool]:
    rules = Rules(reader, deck)
    _, _, issued = _reqid().prepare(deck)
    pattern = deck.get("requirements.manuscriptLine")
    line = re.compile(pattern) if pattern else None
    manuscript = Manuscript.for_deck(deck) if line else None
    declared: dict[str, list[str]] = {}
    if manuscript:
        for name, raw in reader.files():
            declared[name] = manuscript.declarations(raw)
    sources = reader.slide_sources() if manuscript else {}
    md_text: dict[str, str] = {}
    badged: dict[str, set[str]] = {}
    problems = []
    pages = reader.body_pages()
    for page in pages:
        file_ids = None
        mds = declared.get(sources.get(page.n, ""), [])
        if manuscript and mds:
            file_ids = set()
            for rel in mds:
                path = manuscript.dir / rel
                if rel not in md_text and path.is_file():
                    md_text[rel] = path.read_text(encoding="utf-8")
                if rel in md_text:
                    file_ids |= manuscript_ids(md_text[rel], line, rules.expand)[0]
        problems += [(page.label, f) for f in page_findings(rules, page, issued, file_ids)]
        page_ids = set(rules.expand(page.head.get(rules.head_arg, "")))
        on_page = set()
        has_region = False
        for u in page.uses:
            spec = rules.regions.get(u.tag) or rules.badges.get(u.tag)
            if spec:
                has_region |= u.tag in rules.regions
                on_page |= {i for v in _arg_values(u.attrs, spec) for i in rules.expand(v)}
        if not has_region:
            on_page |= page_ids
        for rel in mds:
            badged.setdefault(rel, set()).update(on_page)
    if rules.bare:
        problems += bare_ids(reader, rules, issued)
    for rel, md in sorted(md_text.items()):
        problems += [("manuscript", f) for f in manuscript_findings(rel, md, badged.get(rel, set()),
                                                                     line, rules.expand)]
    return len(pages), problems, rules, line is not None


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0]).parse_args(argv)
    deck = cli.deck_config(args)
    with cli.open_reader(deck) as reader:
        pages, problems, rules, with_manuscript = find(reader, deck)
    print(f"reqbadge: {pages} body pages, {len(problems)} findings")
    for name in rules.unset:
        print(f"  ⚠ no `roles.{name}` in the kit vocabulary and no `checks.reqbadge.{name}`: "
              "those components were not read")
    if not with_manuscript:
        print("  ℹ no `requirements.manuscriptLine`: the head was not traced to the manuscript")
    policies = [n for n, on in (("regions", rules.require_regions), ("bareIds", rules.bare)) if on]
    print(f"  ℹ policy rules on: {', '.join(policies) or 'none'}")
    for where, what in problems:
        print(f"  ✖ {where}: {what}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
