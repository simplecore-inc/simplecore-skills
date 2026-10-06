#!/usr/bin/env python3
"""A body page whose content stops well above the folio.

A page that ends early reads as a page the author had nothing more to say on,
and the fill rules catch only part of it: a page measured at 86% passes a 85%
target while a 120 px band of paper sits above its folio, and a judged `grade`
item stays retired after the page moved. Review rounds kept finding these by
eye; this check reads them from the rendered pages.

For every body page, the page PNG in the deck's `previews` folder is scanned
for the lowest row of ink above the foot band (`footBand`, a share of the page
height where the folio and the footer start). The empty band between that row
and the foot band is the hole; a hole taller than `max` (a share of the page
height) is a finding, and so is a page with no ink above the foot band at all.
A judged page is retired in `<checks.baselines>/foothole.json` with its reason;
the measure is the hole rounded to 10 px, so a retired page comes back when its
hole grows.

A body page is one whose master the deck reader counts as a body or an annex
page (the `body` and `annex` prefixes of `pages.masters`, over the kit
vocabulary's), or, where the deck declares `masters`, one whose master matches
that regex. The summary says how many pages were measured, and a deck on which
no page is measured exits 2: the check read nothing, which is not a pass.

Read the PNGs of a full render: a partial render leaves stale pages.

Config (`checks.foothole`, optional): `masters` (regex; default: the reader's
body and annex masters), `footBand` (0.955), `footBands` (a map from a master
regex to its own foot band, for a master whose footer starts higher than the
default band: a footer inside the band is read as content and hides every
hole on that master), `max` (0.08), `ink` (luminance below which a pixel is
ink, 235), `pattern` (PNG name with `{n}` for the slide number, default
`<entry stem>-{n}.png`). Pillow reads the PNGs; without it the check exits 2.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any, Callable

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.baseline import Baseline, judge  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader  # noqa: E402


def _image() -> Any:
    """Pillow's Image module, or an error naming it: a missing module is an input the check cannot read."""
    try:
        from PIL import Image
    except ImportError as e:
        raise ConfigError("foothole reads the rendered pages with Pillow; install it (python3 -m pip "
                          "install Pillow)") from e
    return Image


def hole(png: Path, foot: float, ink: int) -> int | None:
    """Pixels of empty paper between the lowest content ink and the foot band, None with no ink."""
    with _image().open(png) as source:
        im = source.convert("L")
    w, h = im.size
    px = im.load()
    top = int(h * foot)
    for y in range(top - 1, -1, -1):
        if any(px[x, y] < ink for x in range(0, w, 2)):
            return top - 1 - y
    return None


def is_body(reader: DeckReader, cfg: dict) -> Callable[[str], bool]:
    """Whether a master is a page this check measures: the declared regex, else the reader's body and annex."""
    if "masters" in cfg:
        rx = re.compile(str(cfg["masters"]))
        return lambda master: bool(rx.search(master))
    pages = reader.pages_config
    return lambda master: pages.is_("body", master) or pages.is_("annex", master)


def measure_pages(reader: DeckReader, deck: DeckConfig) -> tuple[int, list[tuple[str, int, int, bool]]]:
    """(pages measured, [(page label, hole px, limit px, no ink at all)] for each page over the limit)."""
    cfg = deck.section("checks.foothole")
    body = is_body(reader, cfg)
    foot = float(cfg.get("footBand", 0.955))
    bands = [(re.compile(k), float(v)) for k, v in dict(cfg.get("footBands", {})).items()]
    share = float(cfg.get("max", 0.08))
    ink = int(cfg.get("ink", 235))
    folder = deck.resolve(deck.require("previews", "the folder the render writes page PNGs into"))
    stem = Path(str(deck.get("tool.entry", "main.sgx"))).stem
    pattern = str(cfg.get("pattern", f"{stem}-{{n}}.png"))
    image = _image()
    measured, out = 0, []
    for page in reader.slides():
        if not body(page.master or ""):
            continue
        png = folder / pattern.format(n=page.n)
        if not png.is_file():
            raise FileNotFoundError(f"{png} is missing: render the whole deck before foothole")
        measured += 1
        band = next((v for rx, v in bands if rx.search(page.master or "")), foot)
        gap = hole(png, band, ink)
        with image.open(png) as im:
            height = im.size[1]
        limit = int(height * share)
        if gap is None:
            out.append((page.label, int(height * band), limit, True))
        elif gap > limit:
            out.append((page.label, gap, limit, False))
    return measured, out


def find(reader: DeckReader, deck: DeckConfig) -> list[tuple[str, int, int, bool]]:
    """[(page label, hole px, limit px, no ink at all)] for each body page over the limit."""
    return measure_pages(reader, deck)[1]


def key(item: tuple) -> str:
    return item[0]


def measure(item: tuple) -> int:
    return round(item[1], -1)


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0], bless=True).parse_args(argv)
    deck = cli.deck_config(args)
    baseline = Baseline.for_check(deck, "foothole")
    with cli.open_reader(deck) as reader:
        measured, found = measure_pages(reader, deck)
    if measured == 0:
        print("foothole: ✖ no page measured: no slide's master is a body or annex master "
              "(`pages.masters`, or `checks.foothole.masters`); the check read nothing")
        return 2
    if args.bless:
        return cli.report_bless(baseline, {key(f): measure(f) for f in found}, "short pages")
    live, owed = judge(baseline, found, key, measure)
    print(f"foothole: {measured} body pages measured, {len(live)} end too far above the folio, "
          f"{len(owed)} retired without a reason ({len(baseline.entries)} baseline entries)")
    for label, gap, limit, blank in live:
        if blank:
            print(f"  ✖ {label}: no ink above the foot band; an empty page or a failed render")
        else:
            print(f"  ✖ {label}: {gap} px of paper above the foot (limit {limit} px)")
    for label, gap, _, _ in owed:
        print(f"  ✖ {label}: retired with a blank reason; write why ({gap} px)")
    return 1 if live or owed else 0


if __name__ == "__main__":
    sys.exit(main())
