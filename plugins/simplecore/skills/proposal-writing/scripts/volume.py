#!/usr/bin/env python3
"""Printed manuscript volume against what a page holds, page by printed page.

Only the manuscript's printed part is counted; authoring records and figure
plans are instructions, not copy. Each printed page is held to the capacity of
the page it will be typeset on: a page carrying a full-width figure holds
`budget.charsPerPage.figure` characters, any other page
`budget.charsPerPage.text`. Both are a project's measurement of its own typeset
pages, so they are declared, never assumed.

A capacity is an estimate. A page over it is a page to look at before it is
typeset (condensed, split, or its figure narrowed), not a count of characters
to delete; `budget.pageTolerance` sets how far over a page may run before it
is reported. A part whose manuscript already plans more printed pages than the
page plan gives it (`budget.parts`) is reported too, because the deck cannot
be typeset inside the plan from it.

Annex files are counted apart: the annex is outside the page budget.

Config:

    "manuscript": { "dir", "printed", "page", "exclude", "annex",
                    "figurePlan": "^#### 도식 .*? 계획" },   // optional: a heading whose block is not printed
    "budget": { "charsPerPage": { "figure": 650, "text": 1150 },   // required
                "pageTolerance": 1.0,                          // optional, default 1.0
                "parts": { "<part directory>": <pages> },      // optional: the plan's pages per part
                "plan": "docs/page-plan.md",                   // optional: cited beside a part finding
                "fullWidth": 1000 },                           // optional: figure width counted full width
    "figures": { "sources": [...], "boards": {...} }           // where a linked figure is resolved

A figure is full width when its SVG `width` is at least `budget.fullWidth`,
else at least the widest board declared under `figures.boards`.

    volume.py               # every part, and every page over its capacity
    volume.py <part>        # every page of one part, worst first
"""
from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.manuscript import Manuscript  # noqa: E402

IMAGE = re.compile(r"!\[[^\]]*\]\(([^)\s]+)[^)]*\)")
SVG_WIDTH = re.compile(r'<svg\b[^>]*?\bwidth="([0-9.]+)')


@dataclass
class PrintedPage:
    file: str                  # relative to the manuscript directory
    title: str
    chars: int
    full_width: bool
    capacity: int

    @property
    def ratio(self) -> float:
        return self.chars / self.capacity if self.capacity else 0.0


@dataclass
class Settings:
    figure_chars: int
    text_chars: int
    tolerance: float
    full_width: float | None
    parts: dict
    plan: str | None
    figure_plan: re.Pattern | None
    sources: list


def settings(deck: DeckConfig) -> Settings:
    cpp = deck.require("budget.charsPerPage", "characters a figure page and a text page hold")
    if not isinstance(cpp, dict) or not all(isinstance(cpp.get(k), int) and cpp[k] > 0
                                            for k in ("figure", "text")):
        raise ConfigError(f"deck `{deck.name}` `budget.charsPerPage` must be "
                          '{"figure": <chars>, "text": <chars>}')
    width = deck.get("budget.fullWidth")
    if width is None:
        boards = deck.get("figures.boards", {}) or {}
        sizes = [int(m.group()) for k in boards for m in [re.match(r"\d+", str(k))] if m]
        width = max(sizes) if sizes else None
    plan_rx = deck.get("manuscript.figurePlan") if isinstance(deck.get("manuscript"), dict) else None
    parts = deck.get("budget.parts", {}) or {}
    if not isinstance(parts, dict) or not all(isinstance(v, int) for v in parts.values()):
        raise ConfigError(f"deck `{deck.name}` `budget.parts` must map a part directory to its pages")
    sources = [deck.resolve(s) for s in deck.get("figures.sources", []) or []]
    return Settings(cpp["figure"], cpp["text"], float(deck.get("budget.pageTolerance", 1.0)),
                    float(width) if width else None, parts, deck.get("budget.plan"),
                    re.compile(plan_rx, re.M) if plan_rx else None, sources)


def printable(text: str) -> str:
    """The characters a page prints: no code, no image link, no blockquote, no space."""
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = IMAGE.sub(" ", text)
    text = re.sub(r"^>.*$", " ", text, flags=re.M)
    text = re.sub(r"<!--.*?-->", " ", text, flags=re.S)
    return re.sub(r"\s+", "", text)


def drop_plans(text: str, plan: re.Pattern | None) -> str:
    """Remove each figure-plan block: from its heading to the image link or the next heading."""
    if plan is None:
        return text
    out, pos = [], 0
    for m in plan.finditer(text):
        if m.start() < pos:
            continue
        out.append(text[pos:m.start()])
        rest = text[m.end():]
        stop = re.search(r"^!\[[^\]]*\]\(|^#{1,6} ", rest, flags=re.M)
        pos = m.end() + (stop.start() if stop else len(rest))
    out.append(text[pos:])
    return "".join(out)


class Figures:
    """Resolves a figure link and reads its width once."""

    def __init__(self, s: Settings):
        self.s = s
        self.cache: dict[Path, float | None] = {}
        self.unresolved: list[tuple[str, str]] = []

    def path(self, md: Path, link: str) -> Path | None:
        here = (md.parent / link).resolve()
        if here.is_file():
            return here
        for d in self.s.sources:
            p = d / Path(link).name
            if p.is_file():
                return p
        return None

    def is_full_width(self, md: Path, rel: str, link: str) -> bool:
        if not link.lower().endswith(".svg"):
            return False
        p = self.path(md, link)
        if p is None:
            self.unresolved.append((rel, link))
            return False
        if p not in self.cache:
            m = SVG_WIDTH.search(p.read_text(encoding="utf-8")[:2000])
            self.cache[p] = float(m.group(1)) if m else None
        width = self.cache[p]
        return bool(self.s.full_width and width and width >= self.s.full_width)


def pages_of(ms: Manuscript, md: Path, s: Settings, figs: Figures) -> list[PrintedPage]:
    rel = md.relative_to(ms.dir).as_posix()
    out = []
    for title, body in ms.printed_pages(md.read_text(encoding="utf-8")):
        body = drop_plans(body, s.figure_plan)
        full = any(figs.is_full_width(md, rel, link) for link in IMAGE.findall(body))
        out.append(PrintedPage(rel, title, len(printable(body)), full,
                               s.figure_chars if full else s.text_chars))
    return out


def annex_chars(ms: Manuscript, md: Path) -> int:
    text = md.read_text(encoding="utf-8")
    pages = ms.printed_pages(text)
    if pages:
        return sum(len(printable(b)) for _, b in pages)
    return len(printable(text))


def measure(deck: DeckConfig) -> tuple[Settings, list[PrintedPage], int, Figures]:
    s = settings(deck)
    ms = Manuscript.for_deck(deck)
    figs = Figures(s)
    pages: list[PrintedPage] = []
    for md in ms.files(annex=False):
        pages += pages_of(ms, md, s, figs)
    annex = sum(annex_chars(ms, md) for md in ms.files(annex=True))
    return s, pages, annex, figs


def part_of(page: PrintedPage) -> str:
    return page.file.split("/", 1)[0] if "/" in page.file else "."


def findings(s: Settings, pages: list[PrintedPage], figs: Figures) -> list[str]:
    bad = []
    for p in sorted(pages, key=lambda p: -p.ratio):
        if p.ratio > s.tolerance:
            kind = "figure page" if p.full_width else "text page"
            bad.append(f"{p.file} · {p.title}: {p.chars:,} chars on a {kind} of {p.capacity:,} "
                       f"({p.ratio:.2f}, over {s.tolerance:.2f})")
    counts: dict[str, int] = {}
    for p in pages:
        counts[part_of(p)] = counts.get(part_of(p), 0) + 1
    where = f" in {s.plan}" if s.plan else ""
    for part, planned in sorted(s.parts.items()):
        have = counts.get(part, 0)
        if have > planned:
            bad.append(f"{part}: the manuscript prints {have} pages, the page plan{where} gives it {planned}")
    unknown = sorted(set(counts) - set(s.parts)) if s.parts else []
    for part in unknown:
        bad.append(f"{part}: {counts[part]} printed pages in a part budget.parts does not plan")
    for rel, link in figs.unresolved:
        bad.append(f"{rel}: the figure {link} resolves to no file (beside the page or in figures.sources)")
    return bad


def report_parts(s: Settings, pages: list[PrintedPage], annex: int) -> None:
    parts = sorted({part_of(p) for p in pages} | set(s.parts))
    w = max([len(p) for p in parts] + [10])
    print(f"{'part':<{w}} {'chars':>9} {'pages':>5} {'plan':>5} {'capacity':>9} {'over':>9}  ratio")
    tot = cap = 0
    for part in parts:
        mine = [p for p in pages if part_of(p) == part]
        c, k = sum(p.chars for p in mine), sum(p.capacity for p in mine)
        tot, cap = tot + c, cap + k
        plan = s.parts.get(part)
        ratio = f"{c / k:.2f}" if k else "-"
        print(f"{part:<{w}} {c:>9,} {len(mine):>5} {plan if plan is not None else '-':>5} "
              f"{k:>9,} {c - k:>+9,}  {ratio}")
    ratio = f"{tot / cap:.2f}" if cap else "-"
    print(f"{'body':<{w}} {tot:>9,} {len(pages):>5} {sum(s.parts.values()) or '-':>5} "
          f"{cap:>9,} {tot - cap:>+9,}  {ratio}")
    print(f"{'annex':<{w}} {annex:>9,}  (outside the page budget)")


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    ap = cli.parser(__doc__.splitlines()[0])
    ap.add_argument("part", nargs="?", help="list one part's pages, worst first")
    args = ap.parse_args(argv)
    deck = cli.deck_config(args)
    s, pages, annex, figs = measure(deck)
    if args.part:
        mine = [p for p in pages if part_of(p) == args.part]
        if not mine:
            raise ConfigError(f"no printed page in a part named {args.part}")
        for p in sorted(mine, key=lambda p: -p.ratio):
            print(f"  {p.ratio:4.2f}  {p.chars:>6,} / {p.capacity:>5,}  {p.file} · {p.title}")
    else:
        report_parts(s, pages, annex)
    bad = findings(s, pages, figs)
    print(f"volume: {len(pages)} printed pages, {len(bad)} findings "
          f"(capacity is an estimate; a finding is a page to look at, not characters to delete)")
    for line in bad:
        print(f"  ✖ {line}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
