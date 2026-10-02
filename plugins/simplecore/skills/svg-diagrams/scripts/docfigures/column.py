"""Shape-only primitives for figures drawn on the column board.

The column board is the one the config names in `columnBoard`. No document
text lives here: each figure module chooses its topology and supplies its
labels. Heights follow wrapped content, never a page-fill target: every panel
is a `card` sized from its lines, so a column figure is exactly as tall as
what it says.
"""
from common import (CARD, COLUMN_BOARD, HAIRLINE, MICRO, SANS, card, content_w,
                    save)

if COLUMN_BOARD is None:
    raise ImportError(
        "column.py draws on the column board, and the config declares none: "
        "set 'columnBoard' in .claude/document-figures.json")

W = content_w(COLUMN_BOARD)
GAP = 24          # air between two stacked panels joined by an arrow
PANEL_STEP = round(MICRO * 1.4)   # a panel's lines sit looser than a card's


def panel(c, y, head, lines=(), role="blue", *, x=0, w=W, capsule=False,
          fill=None, sw=HAIRLINE):
    """A titled panel sized from its lines; returns (x, y, w, h)."""
    return card(c, x, y, w, c.t[role], head, list(lines), title_size=CARD,
                title_color=c.t[role], size=MICRO, step=PANEL_STEP, fill=fill,
                rx=24 if capsule else 9, sw=sw)


def down(c, a, b, role="muted", label=None):
    """An arrow from the bottom of panel `a` to the top of panel `b`."""
    x = a[0] + a[2] / 2
    end = b[0] + b[2] / 2
    if abs(x - end) < 0.01:
        c.line(x, a[1] + a[3], end, b[1], color=c.t[role], marker=role)
    else:
        c.ortho(x, a[1] + a[3], end, b[1], exit="B", entry="T",
                color=c.t[role], marker=role)
    if label:
        c.text(x + 12, (a[1] + a[3] + b[1]) / 2 + 5, label,
               size=MICRO, color=c.t[role], family=SANS)


def foot(c, y, head, lines, role="green"):
    return panel(c, y, head, lines, role)


def finish(c, name):
    return save(c, name, board=COLUMN_BOARD)
