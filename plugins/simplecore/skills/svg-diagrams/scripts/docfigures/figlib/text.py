"""Text: the wrap, the glyph model, line steps, headings and listed items.

The glyph model matches the lint's: a line of text at `size` occupies
`size * 0.78` above its baseline and `size * 0.24` below.
"""
import re

from figlib.settings import (BODY, CHIP, CHIP_STEP, CONTENT_W, FIGURE, LIST_BULLETS,
                             NO_BREAK, SANS, SECTION, STEP, WRAP_LIST_ITEMS, tw)

def row(n, gap, width=CONTENT_W, x0=0.0):
    """Evenly spaced column x-positions and the column width."""
    w = (width - (n - 1) * gap) / n
    return [x0 + i * (w + gap) for i in range(n)], w


# `tw()` estimates a glyph run and runs a few percent short on mixed CJK/Latin
# text, so a phrase wrapped exactly to the available width still trips the
# overflow lint. Wrapping to a slightly narrower column absorbs that.
WRAP_SAFETY = 0.93

# A mark that joins what stands on either side of it. Breaking before one
# leaves it alone at the head of the next line, where it reads as the mark that
# opens a list, so every such mark stays at the end of the line it came from.
JOINING = ("·", "↔", "→", "←", "~", "/", "&", "+")

# With `wrapListItems` on, a wrapped 「·」 list is read by its separators, and a
# break inside one item adds a member the author never wrote. Only wrap() holds
# the source phrase and the line boundaries at once, so it collects each such
# break here and `build.py` reports them and fails the run. An item too wide to
# be held whole has to break somewhere and is left alone.
SPLIT_ITEMS = []
_SPLIT_SEEN = set()


def wrap(text, width, size):
    """Break a phrase onto lines that fit `width` at `size`.

    An authored newline is kept as a line boundary and anything else breaks by
    word, each line filled as far as the safety limit allows. With
    `wrapListItems` on, a 「·」 list breaks at its separators while every item
    fits, and a break inside an item is reported.
    """
    if "\n" in text:
        return [line for paragraph in text.split("\n")
                for line in (wrap(paragraph, width, size) or [""])]
    limit = width * WRAP_SAFETY
    lines = _wrap_items(text, limit, size) if WRAP_LIST_ITEMS else None
    if lines is None:
        lines = _wrap_words(text, limit, size)
    lines = _raise_marks(lines, width, size)
    if WRAP_LIST_ITEMS:
        _note_split_item(text, lines, limit, size)
    return lines


# A list separator is a middle dot with space on both sides. A dot set tight
# between two words (「기술·교육」) joins one compound term and is not a break.
LIST_SEP = re.compile(r"\s+·\s+")


def _list_items(text):
    """(items, seps) of a 「·」 list; each separator kept as written."""
    parts = re.split(f"({LIST_SEP.pattern})", text)
    # a run of spaces collapses as it does in the word wrap
    return [re.sub(" {2,}", " ", p.strip()) for p in parts[0::2]], parts[1::2]


def _tail(seps, k):
    """What closes item `k` on its line: its separator without the space after."""
    return seps[k].rstrip() if k < len(seps) else ""


def _holds(line, tail, limit, size):
    """Whether `line` fits with the separator that closes it.

    The one measure for a list item: the wrap that keeps items whole and the
    report of a broken item both ask it, so an item the wrap cannot hold is
    never reported as one it broke.
    """
    return tw(line + tail, size, False) <= limit


def _wrap_items(text, limit, size):
    """Break a 「·」 list at its separators, or None when that cannot hold.

    A line that is followed by another item keeps the separator at its end,
    so the separator is measured with the line it closes.
    """
    items, seps = _list_items(text)
    if len(items) < 2 or not all(items):
        return None
    lines, cur = [], ""
    for k, item in enumerate(items):
        tail = _tail(seps, k)
        trial = f"{cur}{seps[k - 1]}{item}" if cur else item
        if cur and not _holds(trial, tail, limit, size):
            lines.append(cur + seps[k - 1].rstrip())
            cur = item
        else:
            cur = trial
        if not _holds(cur, tail, limit, size):
            return None
    lines.append(cur)
    return lines


def _wrap_words(text, limit, size):
    lines, cur = [], ""
    for word in text.split(" "):
        trial = f"{cur} {word}".strip()
        if cur and tw(trial, size, False) > limit:
            lines.append(cur)
            cur = word
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines


def _raise_marks(lines, width, size):
    """Move a joining mark that opens a line to the end of the line before.

    The mark is one glyph, so it is measured against the full width rather than
    the safety limit. A line that held only the mark is dropped once the mark
    has moved.
    """
    lines = list(lines)
    for i in range(1, len(lines)):
        if lines[i] in JOINING or lines[i].startswith(tuple(m + " " for m in JOINING)):
            mark, _, rest = lines[i].partition(" ")
            moved = f"{lines[i - 1]} {mark}"
            if lines[i - 1] and tw(moved, size, False) <= width:
                lines[i - 1], lines[i] = moved, rest
    return [ln for ln in lines if ln]


def _note_split_item(text, lines, limit, size):
    if len(lines) < 2:
        return
    items, seps = _list_items(text)
    items = [(it, _tail(seps, k)) for k, it in enumerate(items) if it]
    if len(items) < 2:
        return
    for item, tail in items:
        if any(item in ln for ln in lines):
            continue
        if not _holds(item, tail, limit, size):
            continue
        hit = (text, tuple(lines))
        if hit not in _SPLIT_SEEN:
            _SPLIT_SEEN.add(hit)
            SPLIT_ITEMS.append((text, list(lines)))
        return


def step_for(size, step=None):
    """The baseline step for `size` unless the caller named one."""
    if step is not None:
        return step
    return CHIP_STEP if size <= CHIP else STEP


def text_block(c, x, y, text, width, size, color, step=None, anchor="start",
               weight=400):
    """Draw a wrapped phrase from baseline `y`; return the y after the last line."""
    step = step_for(size, step)
    rows = wrap(text, width, size)
    for k, ln in enumerate(rows):
        c.text(x, y + k * step, ln, size=size, color=color, family=SANS,
               anchor=anchor, weight=weight)
    return y + len(rows) * step


# ── content-first boxes ────────────────────────────────────────────────────
# A box is sized from what goes inside it, never the other way round. The
# glyph model matches the lint's: a line of text at `size` occupies
# `size * 0.78` above its baseline and `size * 0.24` below.


PAD = 16          # air between a box's side and its text
PAD_Y = 12        # air above the first line and below the last


TITLE_GAP = 8     # air between a title and the body under it
BAND_PAD = 8      # air above and below a title inside a header band
SECTION_GAP = 30  # air between a block and the heading of the next section
HEAD_GAP = 12     # air between a heading and the first box of its section
# A zone's name chip rises this far above the zone's top border; a zone under
# a heading starts at heading() + CHIP_RISE so the chip keeps HEAD_GAP.
CHIP_RISE = round(BODY * 0.72)
BULLET_IND = 14   # indent of a bulleted item's text after its bullet


def glyph_top(baseline, size):
    return baseline - size * 0.78


def glyph_bottom(baseline, size):
    return baseline + size * 0.24


def baseline_for_top(top, size):
    """The baseline that puts a line's glyph top at `top`."""
    return top + size * 0.78


def centered_baseline(y, h, size):
    """The baseline that centres one line of `size` in a box of height `h`."""
    return y + h / 2 + size * 0.27


def heading(c, x, y, text, size=SECTION, color=None, anchor="start",
            mask=False):
    """A section heading with its glyph top at `y`. Returns the y where the
    section's first box starts - HEAD_GAP below the heading. `mask=True` puts
    a paper plate under the letters for a heading a leader has to pass behind;
    draw the leader first, the heading last."""
    base = baseline_for_top(y, size)
    c.text(x, base, text, size=size, color=color or c.t["fg"], family=SANS,
           weight=700, anchor=anchor, mask=mask)
    return glyph_bottom(base, size) + HEAD_GAP


def section_top(y, size=SECTION):
    """The y heading() would return for a heading at `y`, without drawing it."""
    return glyph_bottom(baseline_for_top(y, size), size) + HEAD_GAP


def next_section(bottom):
    """The glyph-top y for a heading placed under a block ending at `bottom`."""
    return bottom + SECTION_GAP


def lines_h(n, size, step):
    """Height of `n` lines of `size` set at `step`, glyph top to glyph bottom."""
    return 0.0 if n <= 0 else (n - 1) * step + size * 1.02


_HEX_COLOUR = re.compile(r"#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})")


def _is_colour(value):
    return isinstance(value, str) and _HEX_COLOUR.fullmatch(value) is not None


def _line_spec(spec):
    """A body line is a string, or (text, colour) or (text, colour, weight).

    svgkit's `Canvas.card` takes a coloured line as (colour, text). Read in
    this library's order that pair prints the colour as the line and paints
    with the text, so a pair whose first item is a `#rrggbb` colour and whose
    second is not is read as (colour, text).
    """
    if isinstance(spec, str):
        return spec, None, 400
    text, colour, *rest = spec
    if _is_colour(text) and not _is_colour(colour):
        text, colour = colour, text
    return text, colour, (rest[0] if rest else 400)


def use_bullets(items, bullet="auto", titled=False):
    """Whether a box lists its items with bullets.

    With bullets on, the items under a box's title are always bulleted, one
    item included, unless the figure was declared plain; a cell with no title
    is a list only when it holds two or more items. A bulleted box is set
    left-aligned so the bullets line up.
    """
    if bullet == "auto":
        return LIST_BULLETS and (
            len(items) >= 2 or (titled and not FIGURE["plain"] and len(items) >= 1))
    return bool(bullet)


def _glue(text):
    """Bind what must not break apart with no-break spaces."""
    for pattern in NO_BREAK:
        text = pattern.sub("\\1\u00a0\\2", text)
    # a middle dot stays with the word before it, so no line opens on a dot
    return text.replace(" · ", "\u00a0· ")


def item_lines(texts, inner, size, bullet, wrapper=None):
    """Wrap each item to `inner`, less the bullet indent when bulleted.

    Returns (line, item index, first line of the item) triples, so a
    continuation line hangs under the text rather than under the bullet.
    `wrapper` is a module's own wrap function (text, width, size).
    """
    width = inner - (BULLET_IND if bullet else 0)
    wrapper = wrapper or wrap
    # the glue only steers the wrap; the drawn line carries plain spaces
    return [(ln.replace("\u00a0", " "), i, k == 0) for i, t in enumerate(texts)
            for k, ln in enumerate(wrapper(_glue(t), width, size))]


def draw_bullet(c, x, base, size, color):
    """The bullet glyph set on a text baseline."""
    c.text(x, base, "•", size=size, color=color, family=SANS, weight=700)


def draw_items(c, x, top, rows, size, step, color, accent, bullet,
               anchor="start"):
    """Draw `item_lines` rows from glyph top `top`, bullets on first lines."""
    base = baseline_for_top(top, size)
    for k, (ln, _i, first) in enumerate(rows):
        if bullet and first:
            draw_bullet(c, x, base + k * step, size, accent)
        c.text(x + (BULLET_IND if bullet else 0), base + k * step, ln,
               size=size, color=color, family=SANS, anchor=anchor)


def pill_h(size=BODY, pad_y=10):
    """The height of a one-line pill at `size` with `pad_y` above and below."""
    return size * 1.02 + 2 * pad_y
