#!/usr/bin/env python3
"""Consecutive pages that repeat one layout, and a part that leans on one component.

A deck whose every page puts a full-width figure on top and cards below is one
page printed a hundred times, and a page-by-page review cannot catch it: no
page is wrong on its own. The layout is read from the printed page: where its
figure stands among the blocks on the page.

    full     a figure across the text block (the first block, or between blocks,
             or two stacked); a band of columns under it does not change that
    bottom   a figure across the text block as the last block
    left     a figure beside the text, standing left (a side layout, or the first
    right    column of a column layout); a table beside it does not change that
    pair     two figures side by side
    rail     a rail beside the body
    none     no figure

Near-identical layouts are one layout: a full-width figure with three columns
under it reads as the same page as a full-width figure with cards under it, so
the rules compare these families and not the arrangement under the figure.

Fails, over body pages in printed order:

- the same layout on three pages in a row
- a side figure on the same side on two pages in a row (the spread leans)
- two pages in a row with the same layout and the same dominant component
- `stackRun` pages in a row whose body is full-width blocks stacked one under
  another (no column layout, side figure, figure pair or rail anywhere on the
  page), and a part where such pages are more than `stackShare` of its pages.
  The figure layout cannot see this: a page of three tables and a page of a
  figure over two tables are different layouts and the same stack, and a run of
  them reads as one long scroll however the figures move

The census counts the content components (the kit vocabulary's
`kinds.content`, less `roles.notShapes`) per part: one component above a
third of the part's uses (from `minUses` uses on) fails, and so does a part
using fewer kinds than it has pages (capped at `minKindsCap`). Content
components no page uses are listed, as the vocabulary still to reach for.

Config (`checks.rhythm`, optional): `run` (3), `topShare` (1/3), `minUses` (9),
`minKindsCap` (10), `stackRun` (3), `stackShare` (1/2).
"""
from __future__ import annotations

import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader, Page  # noqa: E402
from pageshape import Kit, _names  # noqa: E402

RUN, TOP_SHARE, MIN_USES, MIN_KINDS_CAP = 3, 1 / 3, 9, 10
STACK_RUN, STACK_SHARE = 3, 1 / 2
LAYOUTS = ("full", "bottom", "left", "right", "pair", "rail", "none")


class Roles:
    def __init__(self, kit: Kit):
        self.figures = _names(kit.role("figures", []))
        side = kit.role("figureSide", {})
        if not isinstance(side, dict):
            raise ConfigError("`roles.figureSide` maps a side layout to `left`, `right` or `arg:<name>`")
        self.side = side
        self.pair = _names(kit.role("figurePair", []))
        self.rails = _names(kit.role("rails", []))
        self.columns = _names(kit.role("columnLayouts", []))
        self.not_shapes = _names(kit.role("notShapes", []))


def _side_of(roles: Roles, use) -> str | None:
    spec = roles.side.get(use.tag)
    if not spec:
        return None
    if spec.startswith("arg:"):
        value = str(use.attrs.get(spec[4:], "")).strip()
        return value if value in ("left", "right") else None
    return spec


def layout(roles: Roles, page: Page) -> str:
    """The family of the page's layout, from where its figures stand."""
    uses = page.uses
    blocks = [i for i, u in enumerate(uses) if u.depth == 0]
    if any(u.tag in roles.pair for u in uses):
        return "pair"
    if any(u.tag in roles.rails for u in uses):
        return "rail"
    figs = [i for i, u in enumerate(uses) if u.tag in roles.figures]
    if not figs:
        return "none"

    def block_of(i: int) -> int:
        return max(b for b in blocks if b <= i) if blocks else i

    for i, u in enumerate(uses):
        side = _side_of(roles, u)
        if side and any(block_of(f) == block_of(i) and f > i for f in figs):
            return side
    for b in sorted({block_of(f) for f in figs}):
        holder = uses[b]
        if holder.tag in roles.columns:
            children = [u for u in uses[b + 1:] if u.depth == holder.depth + 1]
            later = [u for u in uses[b + 1:] if u.depth <= holder.depth]
            if later:
                stop = uses.index(later[0], b + 1)
                children = [u for u in uses[b + 1:stop] if u.depth == holder.depth + 1]
            figure_cols = [k for k, u in enumerate(children) if u.tag in roles.figures]
            if len(figure_cols) >= 2:
                return "pair"
            if figure_cols and len(children) >= 2:
                return "left" if figure_cols[0] == 0 else "right"
    fig_blocks = [block_of(f) for f in figs]
    if len(set(fig_blocks)) == 1 and fig_blocks[0] == blocks[-1] and len(blocks) > 1:
        return "bottom"
    return "full"


def stacked(roles: Roles, page: Page) -> bool:
    """True when nothing on the page stands beside anything else."""
    for u in page.uses:
        if (u.tag in roles.columns or u.tag in roles.rails or u.tag in roles.pair
                or _side_of(roles, u)):
            return False
    return True


def stack_findings(pages: list[Page], flags: list[bool], cfg: dict) -> list[tuple[str, str]]:
    run = int(cfg.get("stackRun", STACK_RUN))
    share = float(cfg.get("stackShare", STACK_SHARE))
    bad = []
    streak = 0
    for p, flat in zip(pages, flags):
        streak = streak + 1 if flat else 0
        if streak >= run:
            bad.append((p.label, f"a plain stack of full-width blocks, {streak} consecutive body pages"))
    by_part: dict[str, list[bool]] = defaultdict(list)
    for p, flat in zip(pages, flags):
        by_part[p.part or "?"].append(flat)
    for part, fl in by_part.items():
        if len(fl) >= run and sum(fl) > len(fl) * share:
            bad.append((f"part {part}", f"a plain stack on {sum(fl)} of {len(fl)} body pages, "
                                         f"above a {share:.0%} share"))
    return bad


def dominant(kit: Kit, roles: Roles, page: Page) -> str | None:
    counts = Counter(u.tag for u in page.uses
                     if kit.kind.get(u.tag, "") in kit.content_kinds and u.tag not in roles.not_shapes)
    if not counts:
        return None
    tag, n = counts.most_common(1)[0]
    return tag if n > 1 else None


def sequence(rows: list[tuple[str, str, str | None]], run: int) -> list[tuple[str, str]]:
    """[(page, why)] over (page, layout, dominant) in printed order."""
    bad = []
    for i, (label, lay, dom) in enumerate(rows):
        if i >= run - 1 and all(rows[i - k][1] == lay for k in range(1, run)):
            bad.append((label, f"the layout `{lay}` is on {run} pages in a row"))
        if i >= 1 and lay in ("left", "right") and rows[i - 1][1] == lay:
            bad.append((label, f"a side figure stands {lay} on this page and the one before"))
        if i >= 1 and rows[i - 1][1] == lay and dom and rows[i - 1][2] == dom:
            bad.append((label, f"the same layout (`{lay}`) and the same dominant component "
                               f"({dom}) as the page before"))
    return bad


def census(kit: Kit, roles: Roles, pages: list[Page], cfg: dict) -> tuple[list, list[str]]:
    """([(part, pages, total, counts, [why])], unused content components)."""
    top_share = float(cfg.get("topShare", TOP_SHARE))
    min_uses = int(cfg.get("minUses", MIN_USES))
    cap = int(cfg.get("minKindsCap", MIN_KINDS_CAP))
    vocabulary = sorted(n for n, k in kit.kind.items()
                        if k in kit.content_kinds and n not in roles.not_shapes)
    by_part: dict[str, list[Page]] = defaultdict(list)
    for p in pages:
        by_part[p.part or "?"].append(p)
    out, seen = [], Counter()
    for part, members in by_part.items():
        counts = Counter(u.tag for p in members for u in p.uses if u.tag in vocabulary)
        seen.update(counts)
        total = sum(counts.values())
        why = []
        if counts and total >= min_uses:
            tag, n = counts.most_common(1)[0]
            if n > total * top_share:
                why.append(f"{tag} is {n} of {total} uses, above a {top_share:.0%} share")
        need = min(len(members), cap)
        if len(counts) < need:
            why.append(f"{len(counts)} content components over {len(members)} pages; {need} are needed")
        out.append((part, len(members), total, counts, why))
    return out, [n for n in vocabulary if n not in seen]


def find(reader: DeckReader, deck: DeckConfig):
    cfg = deck.section("checks.rhythm")
    kit = Kit(reader, deck, "rhythm")
    roles = Roles(kit)
    pages = reader.body_pages()
    rows = [(p.label, layout(roles, p), dominant(kit, roles, p)) for p in pages]
    bad = sequence(rows, int(cfg.get("run", RUN)))
    flags = [stacked(roles, p) for p in pages]
    bad += stack_findings(pages, flags, cfg)
    parts, unused = census(kit, roles, pages, cfg)
    return kit, rows, bad, parts, unused


def by_page(reader: DeckReader, deck: DeckConfig) -> dict[str, list[tuple[int, str]]]:
    """Findings keyed by page label, for a check that grades pages."""
    _, _, bad, _, _ = find(reader, deck)
    out: dict[str, list] = defaultdict(list)
    for label, why in bad:
        out[label].append((2, why))
    return dict(out)


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0]).parse_args(argv)
    deck = cli.deck_config(args)
    with cli.open_reader(deck) as reader:
        kit, rows, bad, parts, unused = find(reader, deck)
    used = Counter(lay for _, lay, _ in rows)
    print(f"rhythm: {len(rows)} body pages, {len(used)} layouts, {len(bad)} repeats")
    kit.report_unset()
    print("  " + " · ".join(f"{lay} {used[lay]}" for lay in LAYOUTS if used[lay]))
    for label, why in bad:
        print(f"  ✖ {label}: {why}")
    census_bad = sum(len(w) for *_, w in parts)
    print(f"census: {len(parts)} parts, {census_bad} findings, {len(unused)} content components unused")
    for part, n, total, counts, why in sorted(parts, key=lambda r: r[0]):
        top = " · ".join(f"{t} {c}" for t, c in counts.most_common(4))
        print(f"  part {part}: {n} pages, {total} uses, {len(counts)} components ({top})")
        for w in why:
            print(f"    ✖ {w}")
    if unused:
        print("  unused: " + " · ".join(unused))
    return 1 if bad or census_bad else 0


if __name__ == "__main__":
    sys.exit(main())
