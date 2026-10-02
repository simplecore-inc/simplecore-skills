"""Every project value the drawing layer uses, read from the project's config.

Constants a figure module draws with come from `.claude/document-figures.json`
(see `figconfig.py`): the output directory, the boards and their placement,
the type ladder and its names, the strokes, the dashes, the theme, the
typeface stack, the icon, badge and accent vocabularies, the verdict hues and
the list mode. Names the config adds (a board name, a rung name, a dash name)
are set here as module globals, so `from common import FULL` works for a
project that declares `FULL`.
"""
import os
import re
import sys
from pathlib import Path

import figconfig

LIBRARY = Path(__file__).resolve().parent.parent
CFG = figconfig.load()


def toolkit_dir():
    """Directory holding svgkit.py and audit.py.

    `SVG_DIAGRAMS_SCRIPTS` wins, then the config's `toolkit`, then the
    skill's own `scripts/` directory, which is this library's parent. No
    location is assumed beyond those three.
    """
    env = os.environ.get("SVG_DIAGRAMS_SCRIPTS")
    candidates = [Path(env)] if env else []
    if CFG.toolkit:
        candidates.append(CFG.toolkit)
    candidates.append(LIBRARY.parent)
    for c in candidates:
        if (c / "svgkit.py").exists():
            return c
    raise figconfig.ConfigError(
        "svg-diagrams toolkit not found; looked in "
        + ", ".join(str(c) for c in candidates))


sys.path.insert(0, str(toolkit_dir()))

from svgkit import Canvas, tw, edge_pt, row_positions, SANS, MONO  # noqa: E402,F401

# ── project settings, all from the config ─────────────────────────────────
OUT = CFG.out
THEME = CFG.get("theme", "paper")

# The boards this document draws on and where each one is placed, in px. One
# placement ratio across every board means one type ladder serves them all,
# and a landscape drawing is re-laid out on a narrow board rather than shrunk.
PLACEMENT = dict(CFG.boards)
STANDARD_WIDTH = CFG.default_board
COLUMN_BOARD = CFG.column_board
for _name, _width in CFG.board_names.items():
    globals()[_name] = _width

# What one unit prints at on the page: the board's placement, times the
# factor the document prints every figure at.
SCALE = PLACEMENT[STANDARD_WIDTH] / STANDARD_WIDTH * CFG.place_scale

# The only type sizes the saved artifacts may contain, smallest first, and the
# names a figure module draws with. `save()` snaps whatever is emitted onto the
# ladder, so a layout written with an off-ladder number is measured at one size
# and printed at another.
FONT_SCALE = CFG.ladder
NAMES = dict(CFG.names)
MICRO, BODY, LEAD, CARD = NAMES["MICRO"], NAMES["BODY"], NAMES["LEAD"], NAMES["CARD"]
SECTION, EMPH, DISPLAY = NAMES["SECTION"], NAMES["EMPH"], NAMES["DISPLAY"]
# The tag rung: short tags, codes and looked-up values. It is never a helper's
# default for running text.
CHIP = NAMES["CHIP"]
globals().update(NAMES)

# The stroke ladder: a hairline for a rule, a normal weight for a box border, a
# thick one for a line the reader follows. Draw with the names.
_STROKES = CFG.strokes or figconfig.DEFAULT_STROKES
HAIRLINE, STROKE, THICK = _STROKES["HAIRLINE"], _STROKES["STROKE"], _STROKES["THICK"]

# One dash pattern per meaning, for the whole set.
DASHES = CFG.dashes
for _name, (_pattern, _words) in DASHES.items():
    globals()[_name] = _pattern

# The document's own typeface stack, body face first, or None to keep the
# toolkit's. `save()` writes it in place of the toolkit's stack.
FONT_STACK = CFG.get("fontStack")

# Air `save()` leaves above and below the ink, and the side margin the content
# width is computed from, for the default board.
MARGIN = CFG.side_margin(STANDARD_WIDTH)
V_MARGIN = CFG.margin(STANDARD_WIDTH)


def content_w(board=None):
    """Drawable width inside `board` once the side margin is taken."""
    board = STANDARD_WIDTH if board is None else board
    return board - 2 * (CFG.side_margin(board) + 10)


CONTENT_W = content_w(STANDARD_WIDTH)
for _name, _width in CFG.content_names.items():
    globals()[_name] = content_w(_width)


def printed_pt(units):
    """What `units` of type prints at on the page, in points."""
    return units * SCALE * 0.75


# One icon size and stroke for the whole set, sized to sit beside BODY type.
_ICON = CFG.get("icon") or {}
ICON = ICON_SIZE = _ICON.get("size", round(BODY * 1.2))
ICON_SW = _ICON.get("sw", max(1.6, BODY / 12))

# One meaning, one icon: a call site names the key, never the Lucide name.
ICON_OF = dict(CFG.get("icons") or {})

# A label the figures print, mapped to the one accent it owns in every figure.
ROLE_ACCENT = dict(CFG.get("accents") or {})

# Marks that must be read before their label: {kind: (icon, text, accent)}.
BADGE_KINDS = {k: (v["icon"], v["text"], v["accent"])
               for k, v in (CFG.get("badges") or {}).items()}

# The two hues a deck reads as a verdict, replacing the theme's own pair.
_VERDICT = CFG.verdict
VERDICT_PASS, VERDICT_BLOCK = _VERDICT if _VERDICT else (None, None)

# Whether a titled box bullets its items (the documented rule) or sets every
# item as a plain line.
LIST_BULLETS = bool(CFG.get("bullets", True))

# Spaces that must not break a line, as patterns with two groups: the space
# between them becomes a no-break space while a box's items are wrapped.
NO_BREAK = [re.compile(p) for p in CFG.get("noBreak") or []]
# The figure being drawn: `figure(plain=True)` sets it for one function's run.
FIGURE = {"plain": False}

# Baseline steps: one for body text, one for lines on the tag rung.
STEP = CFG.steps["STEP"]
CHIP_STEP = CFG.steps["CHIP_STEP"]
