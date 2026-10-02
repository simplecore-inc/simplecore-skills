#!/usr/bin/env python3
"""A paragraph set in the deck's fine print.

A deck that sets its body near the type floor marks its fine print by the grey
it prints in, not by size. That grey exists for the line that closes a region:
a source, a legend, a caveat. `typefloor` guards the floor; nothing guards what
is written in the fine print, so the floor becomes the place a page puts what
would not fit anywhere else. Three sentences of the page's own argument set at
the floor in grey at the foot of a column read to a panel as fine print while
every other check passes.

The measurement is the built box: the same string is two lines at the full
measure and five in a column. A text box is fine print when every colour it
prints is one of the fine-print inks (the kit vocabulary's `palette.fine`, or
`checks.finetype.inks`) and no run is above `type.floor` (within
`checks.typefloor.tolerance`, 0.05pt, as a page-relative size resolves). It is a paragraph when
it wraps to more than `lines` lines in its box, measured with the deck's own
face. A box with a bold label plate immediately to its left on its line is a
card's value row, not an aside, and divider and cover pages compose their own
grey text, so neither is read.

Reads the deck's built `.pptx` (`output`); refuses one older than the deck.

Config (`checks.finetype`, optional): `lines` (2), `labelGap` (14 px), `inks`.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.baseline import Baseline, judge  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader  # noqa: E402
from bidkit.glyphwidth import face  # noqa: E402
from bidkit.pptxread import Built, TextBox, wrapped  # noqa: E402

LINES, LABEL_GAP = 2, 14.0
PX_PER_PT = 4 / 3


def labelled(box: TextBox, bold: list[TextBox], gap: float) -> bool:
    """True when a bold plate sits immediately to this box's left, on its line."""
    for b in bold:
        if b.x >= box.x:
            continue
        if 0 <= box.x - (b.x + b.w) <= gap and b.y < box.y + box.h and box.y < b.y + b.h:
            return True
    return False


def fine(box: TextBox, inks: set[str], floor_pt: float, tolerance: float = 0.05) -> bool:
    colours = {r.colour for r in box.runs if r.colour}
    if not colours or not colours <= inks:
        return False
    sizes = [r.size_pt for r in box.runs if r.size_pt is not None]
    return bool(sizes) and max(sizes) <= floor_pt + tolerance


def find(reader: DeckReader, deck: DeckConfig, built: Built) -> tuple[list, set[str]]:
    """([(page label, lines, text)], characters the face lacks)."""
    cfg = deck.section("checks.finetype")
    inks = cfg.get("inks") or ((reader.vocab.data.get("palette") or {}).get("fine") if reader.vocab else None)
    if not inks:
        raise ConfigError("neither `checks.finetype.inks` nor the kit vocabulary's `palette.fine` names "
                          "the inks fine print is set in")
    inks = {str(i).upper().lstrip("#") for i in inks}
    floor_pt = float(deck.require("type.floor", "the type floor in points"))
    max_lines, gap = int(cfg.get("lines", LINES)), float(cfg.get("labelGap", LABEL_GAP))
    tolerance = float(deck.section("checks.typefloor").get("tolerance", 0.05))
    regular = face(reader, deck, reader.vocab, "sans", "Regular")
    bold_face = face(reader, deck, reader.vocab, "sans", "Bold")
    cfgp = reader.pages_config
    out = []
    for page in reader.slides():
        if any(cfgp.is_(k, page.master) for k in ("divider", "fullBleed")):
            continue
        boxes = [b for b in built.text_boxes(page.n) if b.runs and b.w > 1]
        bold = [b for b in boxes if all(r.bold for r in b.runs)]
        for box in boxes:
            if not fine(box, inks, floor_pt, tolerance) or labelled(box, bold, gap):
                continue
            font = bold_face if box.runs[0].bold else regular
            size_px = max(r.size_pt for r in box.runs if r.size_pt is not None) * PX_PER_PT
            lines = wrapped(box.text, box.w, size_px, font.text_width)
            if lines > max_lines:
                out.append((page.label, lines, box.text.strip()))
    return out, regular.missing | bold_face.missing


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0], bless=True).parse_args(argv)
    deck = cli.deck_config(args)
    baseline = Baseline.for_check(deck, "finetype")
    built = Built.for_deck(deck)
    with cli.open_reader(deck) as reader:
        found, missing = find(reader, deck, built)
    key = lambda f: f"{f[0]}\t{f[2][:40]}"  # noqa: E731
    if args.bless:
        return cli.report_bless(baseline, {key(f): None for f in found}, "fine-print paragraphs")
    live, owed = judge(baseline, found, key)
    print(f"finetype: {len(found)} fine-print boxes over their line limit, {len(live)} live, "
          f"{len(owed)} retired without a reason")
    if missing:
        print(f"  ⚠ {len(missing)} characters are not in the face and were estimated: "
              + "".join(sorted(missing))[:40])
    for label, lines, text in live:
        print(f"  ✖ {label}: {lines} lines of fine print · {text[:72]}")
    for label, _, text in owed:
        print(f"  ✖ {label}: retired with a blank reason; write why · {text[:50]}")
    return 1 if live or owed else 0


if __name__ == "__main__":
    sys.exit(main())
