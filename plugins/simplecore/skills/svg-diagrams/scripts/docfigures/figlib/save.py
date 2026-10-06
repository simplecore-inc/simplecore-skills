"""The canvas, the per-figure declaration, and save().

`save()` snaps every emitted size onto the ladder and every pale-grey label
onto the one neutral grey, writes the document's typeface stack, fits the
board, and records a figure's declared list mode on its root element.
"""
import re
import sys
import warnings
from functools import wraps

from figlib.settings import (CFG, FIGURE, FONT_SCALE, FONT_STACK, OUT, PLACEMENT,
                             SANS, STANDARD_WIDTH, THEME, VERDICT_BLOCK, VERDICT_PASS,
                             Canvas)

def figure(*, plain=False):
    """Declare one figure function's settings, for the whole of its run.

    `plain=True` declares a figure with no list anywhere: every box holds at
    most one line under its title, so those lines stay plain. Every other
    figure bullets the items of all its titled boxes, so one figure never
    mixes the two. The setting holds from the function's first line, so a box
    measured before the canvas exists is measured in the figure's own mode;
    `save()` records it in the SVG and `verify.py` checks it against the drawn
    bullets.

        @figure(plain=True)
        def fig_3_1_04_1():
            ...
    """
    def decorate(fn):
        @wraps(fn)
        def run(*args, **kwargs):
            outer = FIGURE["plain"]
            FIGURE["plain"] = bool(plain)
            try:
                return fn(*args, **kwargs)
            finally:
                FIGURE["plain"] = outer
        run.plain = bool(plain)
        return run
    return decorate


def canvas(w, h):
    """A canvas for one figure, with the project's theme and verdict hues.

    svgkit draws a drop shadow under `node()` and `card()` with an SVG
    `<filter>`, and PowerPoint's SVG import drops every element that
    references one: the shape vanishes while its labels stay. A document
    figure may be placed in such a file, so its canvas draws no shadow, and
    `verify.py` fails a figure that references a filter all the same.
    """
    c = Canvas(w, h, theme=THEME, shadow=False)
    if VERDICT_PASS:
        # The theme's own green and red land close enough to a deck's declared
        # verdict hues to be indistinguishable at projection distance, so a
        # figure painted with them puts a second green and a second red into
        # a deck that declares one of each.
        c.add_accent("green", VERDICT_PASS)
        c.add_accent("red", VERDICT_BLOCK)
    # The figure's name and its one-line explanation belong to the document's
    # caption. A title block inside the SVG duplicates that caption and adds
    # vertical space to every figure in the set, so it is suppressed centrally.
    c.title = lambda *_args, **_kwargs: None
    return c


def _snap_font_sizes(c):
    """Force emitted text onto the project's type scale and its one grey.

    Layout code may keep the working size it measured with, but the saved
    artifact may not introduce a one-off printed size. The same holds for the
    neutral grey: the theme carries two (`fg_dim` and the paler `muted`), and
    the pale one set on type prints at a contrast ratio of 4.0 on white, under
    the 4.5 a small size needs. A line may still be drawn in `muted`.
    """
    ladder = sorted(FONT_SCALE)
    pale, neutral = c.t["muted"], c.t["fg_dim"]

    def snap(markup):
        def replace(match):
            value = float(match.group(1))
            nearest = min(ladder, key=lambda step: (abs(step - value), step))
            return f'font-size="{nearest:g}"'
        markup = re.sub(r'font-size="([\d.]+)"', replace, markup)
        if markup.startswith("<text") and f'fill="{pale}"' in markup:
            markup = markup.replace(f'fill="{pale}"', f'fill="{neutral}"')
        return markup

    c.body = [snap(m) for m in c.body]
    c.under = [(order, snap(m)) for order, m in c.under]
    if FONT_STACK:
        c.body = [m.replace(SANS, FONT_STACK) for m in c.body]
        c.under = [(order, m.replace(SANS, FONT_STACK)) for order, m in c.under]


def save(c, name, board=None, margin=None, *, width=None):
    """Write one figure at its board's width.

    `board` decides the slot the document puts the figure in, so it is
    declared here rather than inferred: a landscape drawing saved on a column
    board would print its labels at a fraction of the intended size, and no
    check further down the pipeline can see that. `width=` is a deprecated
    alias for `board=` and warns.
    """
    if width is not None:
        warnings.warn("save(width=) is deprecated; pass board=", DeprecationWarning,
                      stacklevel=2)
        if board is not None and board != width:
            raise ValueError(f"{name}: board={board} and width={width} disagree")
        board = width
    board = STANDARD_WIDTH if board is None else board
    if board not in PLACEMENT:
        raise ValueError(
            f"{name}: board must be one of {sorted(PLACEMENT)}, not {board}")
    margin = CFG.margin(board) if margin is None else margin
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.svg"
    _snap_font_sizes(c)
    c.trim(margin=margin, min_w=board, max_w=board)
    # `trim()` keeps a floor under the side margin, so a drawing too wide to
    # fit inside it widens the board instead of being squeezed, and prints its
    # labels smaller than the rest of the set. Say how many units to take out,
    # here, where the drawing is; verify.py's width check fails the set.
    if c.w > board + 0.01:
        print(f"  ! {name}: {c.w - board:.0f} units wider than its {board} "
              "board. Take that much out of the widest row: a gap, a column "
              "width, or the label that sets the row's width.",
              file=sys.stderr)
    c.save(str(path))
    markup = path.read_text(encoding="utf-8")
    changed = markup
    if FONT_STACK:
        # The toolkit also writes its stack on the root element.
        changed = changed.replace(SANS, FONT_STACK)
    if FIGURE["plain"]:
        changed = changed.replace("<svg ", '<svg data-list-mode="plain" ', 1)
    if changed != markup:
        path.write_text(changed, encoding="utf-8")
    print("wrote", path)
    return path
