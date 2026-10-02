#!/usr/bin/env python3
"""A figure that draws the words already typeset beside it.

A figure earns its place by drawing the relation between rows, never the rows
again. The other text checks read the deck's strings, so a duplication that
moves out of the prose and into the picture passes every one of them: the
picture's words live in an SVG the page attaches by path.

This reads that SVG. For each figure it takes the labels, takes the printed
strings of every page drawn from the same source file (a figure on one page and
the paragraph restating it on the next are the same duplication), and reports a
figure where `limit` or more labels of `minLen` letters or longer stand in that
text. A label repeated once is a caption doing its job.

`--condense` lists instead every prose block on a figure's page whose words the
figure already carries for the most part: what a deck over its page budget
cuts first.

The figure components and their path argument are the kit vocabulary's
`roles.figures` and `roles.figureSrc` (`src` when unset); paths are relative
to the deck directory.

Config (`checks.figtext`, optional): `minLen` (10), `limit` (3),
`condenseMin` (40), `condenseShare` (0.5).
"""
from __future__ import annotations

import re
import sys
from html import unescape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.baseline import Baseline, judge  # noqa: E402
from bidkit.config import DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader  # noqa: E402
from bidkit.vocab import role  # noqa: E402

MIN_LEN, LIMIT, CONDENSE_MIN, CONDENSE_SHARE = 10, 3, 40, 0.5
SVG_TEXT = re.compile(r"<text\b[^>]*>(.*?)</text>", re.S)
TAG = re.compile(r"<[^>]+>")
# Separators, brackets and dashes vary with layout; the dash characters are data.
SEPARATORS = re.compile(r"[\s·,.()\[\]{}/:;\u2014\u2013\-]")
WORDS = re.compile(r"[\s·,、/+()\[\]\u2014\u2013\-~:;.]+")


def strip(s: str) -> str:
    """Compare by the letters alone."""
    return SEPARATORS.sub("", TAG.sub("", s))


def labels(svg: Path) -> list[str]:
    raw = svg.read_text(encoding="utf-8")
    return [unescape(TAG.sub("", t)).strip() for t in SVG_TEXT.findall(raw)]


def block_words(s: str) -> set[str]:
    return {w for w in WORDS.split(TAG.sub("", s)) if len(w) > 1}


def figures_by_page(reader: DeckReader, deck: DeckConfig):
    """[(page, source file, figure path)] for every figure printed on a slide."""
    figs, _ = role(deck, reader.vocab, "figtext", "figures")
    src_arg, _ = role(deck, reader.vocab, "figtext", "figureSrc")
    figs, src_arg = set(figs or []), src_arg or "src"
    sources = reader.slide_sources()
    out = []
    for page in reader.slides():
        for u in page.uses:
            if u.tag in figs and u.attrs.get(src_arg, "").lower().endswith(".svg"):
                out.append((page, sources.get(page.n, ""), deck.dir / u.attrs[src_arg]))
    return out, bool(figs)


def find(reader: DeckReader, deck: DeckConfig) -> tuple[int, list, list[str], bool]:
    """(figures read, [(page, figure, shared labels)], missing figure files, roles declared)."""
    cfg = deck.section("checks.figtext")
    min_len, limit = int(cfg.get("minLen", MIN_LEN)), int(cfg.get("limit", LIMIT))
    placed, declared = figures_by_page(reader, deck)
    sources = reader.slide_sources()
    flat: dict[str, str] = {}
    for page in reader.slides():
        f = sources.get(page.n, "")
        flat[f] = flat.get(f, "") + strip(" ".join(page.texts))
    found, missing = [], []
    for page, source, svg in placed:
        if not svg.is_file():
            missing.append(f"{page.label}: {svg} is placed and does not exist")
            continue
        hits = sorted({lab for lab in labels(svg) if len(strip(lab)) >= min_len and strip(lab) in flat[source]})
        if len(hits) >= limit:
            found.append((page.label, svg.name, hits))
    return len(placed), found, missing, declared


def condense(reader: DeckReader, deck: DeckConfig) -> list[tuple[float, int, str, str]]:
    """(share, characters, page, block), worst first."""
    cfg = deck.section("checks.figtext")
    least, share_min = int(cfg.get("condenseMin", CONDENSE_MIN)), float(cfg.get("condenseShare", CONDENSE_SHARE))
    placed, _ = figures_by_page(reader, deck)
    drawn: dict[int, set[str]] = {}
    for page, _, svg in placed:
        if svg.is_file():
            for lab in labels(svg):
                drawn.setdefault(page.n, set()).update(block_words(lab))
    out = []
    for page in reader.slides():
        words = drawn.get(page.n)
        if not words:
            continue
        for text in page.texts:
            text = text.strip()
            w = block_words(text)
            if len(text) >= least and w:
                share = len(w & words) / len(w)
                if share >= share_min:
                    out.append((share, len(text), page.label, text))
    return sorted(out, reverse=True)


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    ap = cli.parser(__doc__.splitlines()[0], bless=True)
    ap.add_argument("--condense", action="store_true", help="list prose the figures already carry")
    args = ap.parse_args(argv)
    deck = cli.deck_config(args)
    baseline = Baseline.for_check(deck, "figtext")
    with cli.open_reader(deck) as reader:
        if args.condense:
            rows = condense(reader, deck)
            print(f"figtext --condense: {len(rows)} blocks, {sum(r[1] for r in rows):,} characters "
                  "the figures beside them already carry")
            for share, n, label, text in rows:
                print(f"  {share:.0%} · {n} chars · {label}: {text[:96]}")
            return 0
        placed, found, missing, declared = find(reader, deck)
    key = lambda f: f"{f[0]}\t{f[1]}"  # noqa: E731
    if args.bless:
        return cli.report_bless(baseline, {key(f): None for f in found}, "redrawn blocks")
    live, owed = judge(baseline, found, key)
    print(f"figtext: {placed} figures, {len(live)} redraw the text beside them, "
          f"{len(owed)} retired without a reason, {len(missing)} figure files missing")
    if not declared:
        print("  ⚠ no `roles.figures` in the kit vocabulary and no `checks.figtext.figures`: no figure was read")
    for line in missing:
        print(f"  ✖ {line}")
    for label, name, hits in live:
        print(f"  ✖ {label} {name}: {len(hits)} labels stand in the text · "
              + " / ".join(h[:24] for h in hits[:5]))
    for label, name, _ in owed:
        print(f"  ✖ {label} {name}: retired with a blank reason; write why")
    return 1 if live or owed or missing or not declared else 0


if __name__ == "__main__":
    sys.exit(main())
