#!/usr/bin/env python3
"""What every body page still needs, measured, and nothing about what was done.

A deck-wide review keeps re-opening pages somebody already finished, because
"finished" lives in whoever remembers it. This keeps no such record: it
re-reads every page and reports the reasons it still fails. A page with no
reason is done, whoever worked it; a page with a reason is not.

Tier 1 is a defect: the page carries no shape, only a table with a plain list,
a list outruns its shapes, a list has one row, the page stops short of the
bottom of the text block, or one column stops well above its neighbour.
Tier 2 is a page to look at: one content component carries it, a table and a
figure carry it alone, it fills most but not all of the block, or a check
named in `checks.grade.include` reports it. Tier 3 is a judgement somebody
already recorded in the baseline with its reason: it is printed so the
judgement stays visible, and it never enters the queue.

The fill is measured on the server's layout of the page, not on a picture:
the lowest drawn box of the page body against the body's inner box, and for
the row of columns that closes the page, each column against the others.

Config:

    "grade": { "tableOfRecord": ["Ⅲ-5 04", "35-deliverables.xml"] }
        pages (by page id or source file) whose body is a table on purpose;
        they are reported at tier 3 with that named
    "checks": { "grade": { "include": ["rhythm"], "full": 0.93, "nearly": 0.90,
                           "columnGap": 0.15, "monoMin": 4 } }

    grade.py              # the queue, with reasons
    grade.py --queue      # page labels only
    grade.py --page Ⅲ-1 03
    grade.py --bless      # retire today's reasons; each still owes a reason
"""
from __future__ import annotations

import importlib
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.baseline import LIVE, RETIRED, Baseline  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader, Page  # noqa: E402
from bidkit.layout import Layouts  # noqa: E402
from pageshape import LIST_CEILING, ROWS_PER_SHAPE, Composition, Kit, _names, compose, page_findings  # noqa: E402

FULL, NEARLY, COLUMN_GAP, MONO_MIN = 0.93, 0.90, 0.15, 4
COLUMN_SHARE = 0.2          # a column narrower than this share of the body is a margin note


def composition(c: Composition) -> str:
    rows = sum(c.runs)
    if c.content:
        return "components"
    if c.tables and rows and not c.figures:
        return "table and plain list only"
    if c.tables and not rows and not c.figures:
        return "table only"
    if c.tables and c.figures:
        return "table and figure only"
    if c.figures and rows:
        return "figure and list only"
    if c.figures:
        return "figure only"
    return "list only" if rows else "paragraphs only"


def fill(layouts: Layouts, page: Page) -> tuple[float, tuple | None] | None:
    """(share of the body block the page reaches, (short, long) column shares or None)."""
    top = [u for u in page.uses if u.depth == 0]
    if not top:
        return None
    first = layouts.box(page.n, top[0].key)
    if first is None or first.parent is None:
        return None
    body = first.parent
    x, y, w, h = body.inner or (body.x, body.y, body.w, body.h)
    if h <= 0:
        return None
    ink = body.ink_bottom()
    if ink is None:
        return 0.0, None
    whole = (ink - y) / h
    columns = None
    for row in body.walk():
        if row.tag != "HStack" or row.bottom < ink - 2:
            continue
        cols = [k for k in row.kids if k.w >= COLUMN_SHARE * w]
        bottoms = [k.ink_bottom() for k in cols]
        if len(cols) >= 2 and all(b is not None for b in bottoms):
            shares = sorted((b - y) / h for b in bottoms)
            columns = (shares[0], shares[-1])
            break
    return whole, columns


def grade(kit: Kit, c: Composition, measured, exempt: bool, cfg: dict,
          sequences: set[str]) -> list[tuple[int, str]]:
    out: list[tuple[int, str]] = []
    shape = composition(c)
    counts = Counter(u.tag for u in c.content)
    if exempt:
        out.append((3, f"{shape}: a table of record, declared in grade.tableOfRecord"))
    elif shape in ("paragraphs only", "list only"):
        out.append((1, f"no shape: {shape} ({sum(c.runs)} list rows)"))
    elif shape in ("table and plain list only", "table only"):
        out.append((1, f"{shape}: no card, row or band"))
    elif shape in ("table and figure only", "figure and list only"):
        out.append((2, f"{shape}: no card, row or band"))
    elif len(counts) == 1:
        out.append((2, f"one content component ({next(iter(counts))})"))
    if counts:
        name, used = counts.most_common(1)[0]
        if used >= int(cfg.get("monoMin", MONO_MIN)) and used > sum(counts.values()) / 2:
            note = "; a sequence, so repeating it may be right" if name in sequences else ""
            out.append((2, f"{name} {used} times, most of the page{note}"))
    for tier, why in page_findings(kit, c, LIST_CEILING, ROWS_PER_SHAPE):
        if not why.startswith("only paragraphs"):     # the shape finding above says it
            out.append((tier, why))
    if measured is not None:
        whole, columns = measured
        if whole < float(cfg.get("nearly", NEARLY)):
            out.append((1, f"fill {whole * 100:.0f}%"))
        elif whole < float(cfg.get("full", FULL)):
            out.append((2, f"fill {whole * 100:.0f}%"))
        if columns and columns[1] - columns[0] > float(cfg.get("columnGap", COLUMN_GAP)):
            out.append((1, f"a column stops at {columns[0] * 100:.0f}%, its neighbour at "
                           f"{columns[1] * 100:.0f}%"))
    return out


def included(deck: DeckConfig, reader: DeckReader) -> dict[str, list[tuple[int, str]]]:
    """Findings of the checks `checks.grade.include` names, by page label."""
    out: dict[str, list] = {}
    for name in deck.section("checks.grade").get("include", ["rhythm"]):
        try:
            module = importlib.import_module(name)
        except ImportError as e:
            raise ConfigError(f"`checks.grade.include` names `{name}`, which is not a shared check: {e}") from e
        if not hasattr(module, "by_page"):
            raise ConfigError(f"`checks.grade.include` names `{name}`, which reports no findings by page")
        for label, found in module.by_page(reader, deck).items():
            out.setdefault(label, []).extend((tier, f"{name}: {why}") for tier, why in found)
    return out


def records(reader: DeckReader, deck: DeckConfig, baseline: Baseline) -> dict[str, dict]:
    cfg = deck.section("checks.grade")
    kit = Kit(reader, deck, "grade")
    sequences = _names(kit.role("sequences", []))
    exempt = set(deck.get("grade.tableOfRecord", []) or [])
    sources = reader.slide_sources() if exempt else {}
    layouts = Layouts(reader)
    others = included(deck, reader)
    out = {}
    for page in reader.body_pages():
        c = compose(kit, page)
        measured = fill(layouts, page)
        is_exempt = page.label in exempt or sources.get(page.n) in exempt
        reasons = grade(kit, c, measured, is_exempt, cfg, sequences) + others.get(page.label, [])
        kept = []
        for tier, why in reasons:
            key = f"{page.label}\t{why}"
            verdict = baseline.verdict(key)
            if verdict == RETIRED and baseline.entries[key].reason:
                kept.append((3, f"{why}; judged: {baseline.entries[key].reason}", key))
            elif verdict == LIVE:
                kept.append((tier, why, key))
            else:
                kept.append((tier, f"{why}; retired with a blank reason", key))
        out[page.label] = {"slide": page.n, "shape": composition(c),
                           "fill": None if measured is None else round(measured[0] * 100),
                           "reasons": kept}
    kit.report_unset()
    return out


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    ap = cli.parser(__doc__.splitlines()[0], bless=True)
    ap.add_argument("--queue", action="store_true", help="print the labels of pages still owing work")
    ap.add_argument("--page", help="print one page's record")
    ap.add_argument("--json", help="write the records to this file")
    args = ap.parse_args(argv)
    deck = cli.deck_config(args)
    baseline = Baseline.for_check(deck, "grade")
    with cli.open_reader(deck) as reader:
        record = records(reader, deck, baseline)
    if args.bless:
        return cli.report_bless(baseline, {k: None for r in record.values() for _, _, k in r["reasons"]},
                                "page reasons")
    if args.json:
        Path(args.json).write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    work = [label for label, r in record.items() if any(t < 3 for t, _, _ in r["reasons"])]
    if args.queue:
        print(",".join(work))
        return 1 if work else 0
    if args.page:
        r = record.get(args.page)
        if r is None:
            print(f"grade: {args.page} is not a body page")
            return 2
        print(f"{args.page} (slide {r['slide']}): {r['shape']}, fill {r['fill']}%")
        for tier, why, _ in r["reasons"]:
            print(f"  tier {tier}: {why}")
        return 1 if any(t < 3 for t, _, _ in r["reasons"]) else 0
    tier1 = [label for label in work if any(t == 1 for t, _, _ in record[label]["reasons"])]
    noted = [label for label, r in record.items() if r["reasons"] and label not in work]
    print(f"grade: {len(record)} body pages, {len(work)} still owe work "
          f"({len(tier1)} at tier 1), {len(noted)} carry only recorded judgements, "
          f"{len(record) - len(work) - len(noted)} pass")
    for label in work:
        r = record[label]
        print(f"  ✖ {label} (fill {r['fill']}%): " + " / ".join(f"{t}: {w}" for t, w, _ in r["reasons"]))
    for label in noted:
        print(f"  ℹ {label}: " + " / ".join(w for _, w, _ in record[label]["reasons"]))
    return 1 if work else 0


if __name__ == "__main__":
    sys.exit(main())
