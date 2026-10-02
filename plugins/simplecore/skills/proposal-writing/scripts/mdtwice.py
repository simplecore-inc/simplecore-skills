#!/usr/bin/env python3
"""The same explanation written twice in the manuscript.

The deck-repeat checks stop the deck repeating itself. Nothing stops the
manuscript: two sections written weeks apart, in different parts, explain the
same thing in almost the same words, and every deck check passes because the
two pages are faithful to two different manuscript files. The panel reads it
twice, and the deck pays for it in pages. Condensing the second copy shortens
the manuscript and the pages carrying it at once, the only cut that loses
neither an answer nor a figure.

Matching is by word overlap, not by string equality, because the second copy
is almost never the same string: 「성과목표로 운영하지 않는다」 and 「성과목표로는
운영하지 않는다」 are one sentence written twice.

Not every repeat is a second copy. A chapter overview summarises the body it
opens, an evidence block names the same annex wherever a section leans on it,
and two chapters answering two requirements about one mechanism each state it
in their own words. Those are retired in the baseline with their reason
(`<checks.baselines>/mdtwice.json`, keyed by the two files and the shorter
sentence, so rewording either side brings the pair back).

Only a file's printed part is read where the manuscript declares one
(`manuscript.printed`); excluded and annex files are not read.

Config (optional): `checks.mdtwice` { "threshold": 0.75, "minWords": 6,
"minChars": 20 }, `lang.sentenceEnd` (default 「다.」), and
`budget.charsPerPage.text` to print the repeats' volume in pages.

    mdtwice.py            # every repeat across files, worst first
    mdtwice.py --same     # within one file too
    mdtwice.py --bless    # retire today's pairs; each still owes a reason
"""
from __future__ import annotations

import re
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.baseline import LIVE, UNREASONED, Baseline  # noqa: E402
from bidkit.config import DeckConfig  # noqa: E402
from bidkit.manuscript import Manuscript  # noqa: E402
from bidkit.textko import norm, sentences  # noqa: E402

# Separators between words. The dash characters are data: prose may carry any of them.
WORD_SPLIT = re.compile(r"[\s·,、/+()\[\]\u2014\u2013\-~:;.]+")
NOT_PROSE = ("|", "#", ">", "!", "<!--")


@dataclass
class Pair:
    ratio: float
    chars: int
    a_file: str
    a_text: str
    b_file: str
    b_text: str

    @property
    def key(self) -> str:
        short = min(self.a_text, self.b_text, key=len)
        return "\t".join(sorted((self.a_file, self.b_file)) + [short])


def prose(md: str, ms: Manuscript, caption: re.Pattern | None) -> str:
    if ms.printed and ms.page:
        pages = ms.printed_pages(md)
        if pages:
            md = "\n".join(body for _, body in pages)
    md = re.sub(r"```.*?```", " ", md, flags=re.S)
    md = re.sub(r"<!--.*?-->", " ", md, flags=re.S)
    keep = []
    for line in md.split("\n"):
        t = line.lstrip()
        if t.startswith(NOT_PROSE) or (caption and caption.match(t)):
            continue
        keep.append(line)
    return norm(" ".join(keep))


def words(s: str) -> set[str]:
    return {w for w in WORD_SPLIT.split(s) if len(w) > 1}


def collect(deck: DeckConfig) -> list[tuple[str, str, set[str]]]:
    ms = Manuscript.for_deck(deck)
    cfg = deck.section("checks.mdtwice")
    min_words, min_chars = int(cfg.get("minWords", 6)), int(cfg.get("minChars", 20))
    end = deck.get("lang.sentenceEnd", "다.")
    caption = re.compile(ms.caption if ms.caption.startswith("^") else "^" + ms.caption) if ms.caption else None
    items = []
    for md in ms.files(annex=False):
        rel = md.relative_to(ms.dir).as_posix()
        for s in sentences(prose(md.read_text(encoding="utf-8"), ms, caption), end):
            w = words(s)
            if len(s) >= min_chars and len(w) >= min_words:
                items.append((rel, s, w))
    return items


def pairs(items: list[tuple[str, str, set[str]]], threshold: float, same_file: bool) -> list[Pair]:
    out = []
    for i, (fa, sa, wa) in enumerate(items):
        for fb, sb, wb in items[i + 1:]:
            if fa == fb and not same_file:
                continue
            small, big = (wa, wb) if len(wa) <= len(wb) else (wb, wa)
            ratio = len(small & big) / len(small)
            if ratio >= threshold:
                out.append(Pair(round(ratio, 2), min(len(sa), len(sb)), fa, sa, fb, sb))
    out.sort(key=lambda p: (-p.ratio, -p.chars))
    return out


def judge(found: list[Pair], baseline: Baseline) -> tuple[list[Pair], list[Pair], int]:
    """(live, retired with a blank reason, retired with a reason)."""
    live, owed, held = [], [], 0
    for p in found:
        v = baseline.verdict(p.key)
        if v == LIVE:
            live.append(p)
        elif v == UNREASONED:
            owed.append(p)
        else:
            held += 1
    return live, owed, held


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    ap = cli.parser(__doc__.splitlines()[0], bless=True)
    ap.add_argument("--same", action="store_true", help="compare sentences within one file too")
    args = ap.parse_args(argv)
    deck = cli.deck_config(args)
    threshold = float(deck.section("checks.mdtwice").get("threshold", 0.75))
    items = collect(deck)
    found = pairs(items, threshold, args.same)
    baseline = Baseline.for_check(deck, "mdtwice")
    if args.bless:
        return cli.report_bless(baseline, {p.key: None for p in found}, "pairs")
    live, owed, held = judge(found, baseline)
    chars = sum(p.chars for p in live)
    per_page = deck.get("budget.charsPerPage.text")
    pages = f" ≈ {chars / per_page:.1f} pages" if per_page else ""
    print(f"mdtwice: {len(items)} sentences, {len(live)} written twice ({chars:,} chars in the "
          f"second copies{pages}), {held} judged in the baseline, {len(owed)} owe a reason")
    for p in live[:60]:
        print(f"  ✖ {p.ratio:.0%} · {p.chars} chars")
        print(f"       {p.a_file}\n         {p.a_text[:88]}")
        print(f"       {p.b_file}\n         {p.b_text[:88]}")
    if len(live) > 60:
        print(f"  … {len(live) - 60} more pairs")
    for p in owed:
        print(f"  ✖ retired without a reason: {p.key.replace(chr(9), ' | ')[:150]}")
    if live:
        volume: Counter = Counter()
        for p in live:
            volume[tuple(sorted((p.a_file, p.b_file)))] += p.chars
        print("\n  overlap by pair of files")
        for (a, b), n in volume.most_common(12):
            print(f"    {n:>5,} chars  {a}\n                 {b}")
    return 1 if live or owed else 0


if __name__ == "__main__":
    sys.exit(main())
