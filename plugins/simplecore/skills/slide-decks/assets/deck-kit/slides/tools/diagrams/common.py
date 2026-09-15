"""Shared setup for the presentation's figures.

The presentation reuses the proposal's figure toolkit (`tools/diagrams/common.py`
at the repository root) — the same canvas, type ladder, helpers and badges —
and adds the boards a landscape slide places:

    SLIDE_WIDTH   1800  across the whole slide text block (1027px, scale 0.57)
    STANDARD      1200  the proposal's full board — placed at 1027px (0.86) or
                        in the wide column of an asymmetric layout (660px, 0.55)
    HALF_WIDTH     880  one column of a two-column slide (499px, 0.57)
    COLUMN         520  the proposal's column board — the narrow column (326px,
                        0.63) or, as `-half`, a two-column slide (499px, 0.96)

`build.ts` reads the width out of each saved SVG and picks the placement from
it, so a drawing cannot be put in a slot it was not laid out for. The scales
are chosen so the smallest step of the shared ladder prints at 6.5pt or more
on every board — the same floor the proposal's figures hold.

Generated figures land in `pptx-presentation/diagrams/`; the proposal's own
figures are read from `proposal/diagrams/` untouched. Drawing rules are in the
`simplecore:slide-decks` skill (figures reference) and the root
`tools/diagrams/AGENTS.md`.
"""
import importlib.util
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PROPOSAL_TOOLS = ROOT / "tools" / "diagrams"

# The proposal's toolkit is loaded under its own module name: this file is
# also called `common`, so a plain `import common` from here would find itself.
_spec = importlib.util.spec_from_file_location("proposal_common", PROPOSAL_TOOLS / "common.py")
_base = importlib.util.module_from_spec(_spec)
sys.modules["proposal_common"] = _base
_spec.loader.exec_module(_base)
# Everything the proposal's modules draw with, except the three names that say
# where THIS deck's figures live.
globals().update({k: v for k, v in vars(_base).items()
                  if not k.startswith("__") and k not in ("HERE", "ROOT", "OUT")})
_snap_font_sizes = _base._snap_font_sizes
COLUMN_WIDTH, STANDARD_WIDTH = _base.COLUMN_WIDTH, _base.STANDARD_WIDTH
CONTENT_W, COLUMN_CONTENT_W = _base.CONTENT_W, _base.COLUMN_CONTENT_W

OUT = HERE.parents[1] / "diagrams"

SLIDE_WIDTH = 1800
HALF_WIDTH = 880
# Every board this deck places, and the side margin `save()` trims to on it —
# the proposal's 28 on 1200 and 12 on 520, scaled by the board.
BOARDS = {
    SLIDE_WIDTH: 42,
    STANDARD_WIDTH: 28,
    HALF_WIDTH: 20,
    COLUMN_WIDTH: 12,
}
# The content width of each board: what is left after `save()` centres the
# ink and leaves the lint's margin on both sides (1124 on the 1200 board).
SLIDE_CONTENT_W = SLIDE_WIDTH - (STANDARD_WIDTH - CONTENT_W) * SLIDE_WIDTH // STANDARD_WIDTH
HALF_CONTENT_W = HALF_WIDTH - (STANDARD_WIDTH - CONTENT_W) * HALF_WIDTH // STANDARD_WIDTH


def save(c, name, margin=None, width=STANDARD_WIDTH):
    """Write one figure at one of this deck's board widths."""
    if width not in BOARDS:
        raise ValueError(
            f"{name}: board width {width} is none of {sorted(BOARDS)} — "
            "the slide deck has no placement for it")
    if margin is None:
        margin = BOARDS[width]
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.svg"
    _snap_font_sizes(c)
    c.trim(margin=margin, min_w=width, max_w=width)
    c.save(str(path))
    print("wrote", path)
    return path
