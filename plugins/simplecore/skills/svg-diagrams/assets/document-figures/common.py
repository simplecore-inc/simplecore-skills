"""Shared setup for this project's document figures.

Copy this file into the project (conventionally `tools/diagrams/common.py`) and
set the four constants below. Every figure module imports from here, so the
whole set shares one canvas width, one type scale and one output directory —
which is the point: figures placed side by side in a document must print their
body text at the same size.

The second half of the file is the content-first layer: every box is sized from
the text it holds, with even padding, so a row of cards ends where its tallest
text ends and a label never crosses a line it was not drawn on. Draw with these
helpers rather than with fixed heights — the lint (`ROW-PADDING-UNEVEN`,
`WRAP-SLACK`, `ROW-HEIGHT-MISMATCH`, `LABEL-GROUPING`, `TEXT-ON-LINE`) reports
exactly the defects a fixed height produces.

The drawing toolkit lives in the `simplecore:svg-diagrams` skill rather than in
the project. Its location differs per machine, so it is resolved at run time and
can be overridden with `SVG_DIAGRAMS_SCRIPTS` — nothing here hardcodes one
person's home directory.
"""
import os
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent

# ── project settings ───────────────────────────────────────────────────────
# Where the generated SVGs land, relative to this file.
OUT = HERE.parent.parent / "docs" / "assets" / "diagrams"

# One canvas width for every figure in the document. Derive it from the text
# column: A4 with 25.4mm margins is 159.2mm ≈ 602px at 96 dpi, so a set drawn at
# 1200 units and placed at 50% prints at exactly that column.
STANDARD_WIDTH = 1200

# The only type sizes the saved artifacts may contain, smallest first.
FONT_SCALE = (15.0, 16.0, 17.0, 18.0, 20.0, 21.0, 24.0)

# Draw with these names, never with a raw number. `save()` snaps whatever is
# emitted onto the ladder above, so a layout written with off-ladder numbers is
# measured at one size and printed at another.
MICRO, BODY, LEAD, CARD, SECTION, EMPH, DISPLAY = FONT_SCALE

# Themes render on a white page unless the document is dark.
THEME = "paper"

# The side margin `save()` leaves around the ink; the content width follows.
MARGIN = 28
CONTENT_W = STANDARD_WIDTH - 2 * (MARGIN + 10)
# ───────────────────────────────────────────────────────────────────────────


def toolkit_dir():
    """Directory holding svgkit.py and audit.py, or exit saying how to fix it."""
    env = os.environ.get("SVG_DIAGRAMS_SCRIPTS")
    candidates = [pathlib.Path(env)] if env else []
    candidates += [
        pathlib.Path.home() / ".claude/skills/simplecore/skills/svg-diagrams/scripts",
        pathlib.Path.home()
        / "Workspace/simplecore-skills/plugins/simplecore/skills"
        / "svg-diagrams/scripts",
    ]
    for c in candidates:
        if (c / "svgkit.py").exists():
            return c
    sys.exit(
        "svg-diagrams toolkit not found. Install the simplecore skills, or point "
        "SVG_DIAGRAMS_SCRIPTS at the scripts directory.\nLooked in:\n  "
        + "\n  ".join(str(c) for c in candidates))


sys.path.insert(0, str(toolkit_dir()))

from svgkit import Canvas, tw, edge_pt, row_positions, SANS, MONO  # noqa: E402,F401


def canvas(w, h):
    c = Canvas(w, h, theme=THEME)
    # The figure's name and its one-line explanation belong to the document's
    # caption. A title block inside the SVG duplicates that caption and adds
    # vertical space to every figure in the set, so it is suppressed centrally
    # and no figure module has to remember.
    c.title = lambda *_args, **_kwargs: None
    return c


def _snap_font_sizes(c):
    """Force emitted text onto the project's type scale.

    Layout code may keep the working size it measured with, but the saved
    artifact may not introduce a one-off printed size — equal-width figures then
    hold the same visual hierarchy everywhere in the document.
    """
    ladder = sorted(FONT_SCALE)

    def snap(markup):
        def replace(match):
            value = float(match.group(1))
            nearest = min(ladder, key=lambda step: (abs(step - value), step))
            return f'font-size="{nearest:g}"'
        return re.sub(r'font-size="([\d.]+)"', replace, markup)

    c.body = [snap(m) for m in c.body]
    c.under = [(order, snap(m)) for order, m in c.under]


def save(c, name, margin=MARGIN):
    """Write one figure at the shared width."""
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.svg"
    _snap_font_sizes(c)
    c.trim(margin=margin, min_w=STANDARD_WIDTH, max_w=STANDARD_WIDTH)
    c.save(str(path))
    print("wrote", path)
    return path


# ── layout and text ────────────────────────────────────────────────────────
def row(n, gap, width=CONTENT_W, x0=0.0):
    """Evenly spaced column x-positions and the column width."""
    w = (width - (n - 1) * gap) / n
    return [x0 + i * (w + gap) for i in range(n)], w


# `tw()` estimates a glyph run and runs a few percent short on mixed
# CJK/Latin text, so a phrase wrapped exactly to the available width still
# trips the overflow lint. Wrapping to a slightly narrower column absorbs that.
WRAP_SAFETY = 0.93


def wrap(text, width, size):
    """Break a phrase onto lines that fit `width` at `size`."""
    limit = width * WRAP_SAFETY
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


def text_block(c, x, y, text, width, size, color, step=18, anchor="start",
               weight=400):
    """Draw a wrapped phrase from baseline `y`; return the y after the last line."""
    rows = wrap(text, width, size)
    for k, ln in enumerate(rows):
        c.text(x, y + k * step, ln, size=size, color=color, family=SANS,
               anchor=anchor, weight=weight)
    return y + len(rows) * step


ICON_SIZE = 20
ICON_SW = 1.6


def icon_title(c, x, y, name, text, color, size=CARD, gap=12, weight=700):
    """An icon then a title on one baseline; returns the x after the title."""
    c.icon(name, x + ICON_SIZE / 2, y - size * 0.34, size=ICON_SIZE,
           color=color, sw=ICON_SW)
    tx = x + ICON_SIZE + gap
    c.text(tx, y, text, size=size, color=c.t["fg"], family=SANS, weight=weight)
    return tx + tw(text, size, mono=False)


def icon_title_w(text, size=CARD, gap=12):
    """Width of an icon-plus-title run, for centring it in a card."""
    return ICON_SIZE + gap + tw(text, size, mono=False)


# ── content-first boxes ────────────────────────────────────────────────────
# A box is sized from what goes inside it, never the other way round. Fixed
# heights are how a row ends up with 30px of paper under its text and how the
# one card with three lines of body text spills past its bottom edge. The
# glyph model matches the lint's: a line of text at `size` occupies
# `size * 0.78` above its baseline and `size * 0.24` below.
PAD = 16          # air between a box's side and its text
PAD_Y = 12        # air above the first line and below the last
STEP = 18         # baseline step for MICRO body text
TITLE_GAP = 8     # air between a title and the body under it
BAND_PAD = 8      # air above and below a title inside a header band
SECTION_GAP = 30  # air between a block and the heading of the next section
HEAD_GAP = 12     # air between a heading and the first box of its section
CHIP_RISE = 13    # a zone's name chip rises this far above the zone's top border;
                  # a zone under a heading starts at heading() + CHIP_RISE so the
                  # chip, not the border, keeps HEAD_GAP from the heading


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
    section's first box starts — HEAD_GAP below the heading — so a heading is
    always nearer to what it names than to the block above it. `mask=True`
    puts a paper plate under the letters for a heading a leader has to pass
    behind; draw the leader first, the heading last."""
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


def _line_spec(spec):
    """A body line is a string, or (text, colour) or (text, colour, weight)."""
    if isinstance(spec, str):
        return spec, None, 400
    if len(spec) == 2:
        return spec[0], spec[1], 400
    return spec[0], spec[1], spec[2]


def card_h(w, title=None, lines=(), *, title_size=CARD, size=MICRO, step=STEP,
           pad=PAD, pad_y=PAD_Y, band=False, title_gap=TITLE_GAP):
    """The height `card()` will give a box of width `w` with this content."""
    inner = w - 2 * pad
    n = sum(len(wrap(_line_spec(s)[0], inner, size)) for s in lines)
    body = lines_h(n, size, step)
    if band:
        h = title_size * 1.02 + 2 * BAND_PAD + pad_y + body + pad_y
    elif title:
        h = pad_y + title_size * 1.02 + (title_gap + body if n else 0) + pad_y
    else:
        h = pad_y + body + pad_y
    return h


def card(c, x, y, w, accent, title=None, lines=(), *, h=None, icon=None,
         tag=None, band=False, title_size=CARD, size=MICRO, step=STEP, pad=PAD,
         pad_y=PAD_Y, fill=None, rx=10, sw=1.4, dash=None, title_color=None,
         color=None, align="start", title_gap=TITLE_GAP, stripe=None,
         opacity=None, wash=False, valign="top"):
    """A card sized from its content: an optional title line (with an icon or a
    right-aligned tag), then body text wrapped to the card's inner width.
    Padding is even above and below by construction. `h` overrides the height —
    `cards_row()` passes the row's tallest — and `band=True` draws the title on
    a tinted header band whose bottom corners are square (`Canvas.band`).
    `stripe` draws a 6px accent band on the left edge, `wash=True` (or an
    opacity) tints the box with its accent under the outline. `valign="middle"`
    centres the content when `h` is taller than the content needs, so the air
    above and below stays equal. Returns (x, y, w, h)."""
    fill = c.t["box"] if fill is None else fill
    inner = w - 2 * pad
    body = []
    for spec in lines:
        text, lcol, lwt = _line_spec(spec)
        body += [(ln, lcol, lwt) for ln in wrap(text, inner, size)]
    need = card_h(w, title, lines, title_size=title_size, size=size, step=step,
                  pad=pad, pad_y=pad_y, band=band, title_gap=title_gap)
    h = need if h is None else max(h, need)
    kw = dict(rx=rx, fill=fill, stroke=accent, sw=sw, dash=dash)
    if opacity is not None:
        kw["opacity"] = opacity
    if wash:
        # a tint under an outline: two rects, because one translucent rect
        # would fade its own stroke
        c.rrect(x, y, w, h, rx=rx, fill=accent, stroke=None,
                opacity=0.10 if wash is True else wash)
        kw["fill"] = "none"
    c.rrect(x, y, w, h, **kw)
    if stripe:
        c.band(x, y, 6, h, rx, stripe if stripe is not True else accent,
               opacity=0.9, side="left")
    tcol = title_color or c.t["fg"]
    bcol = color or c.t["fg_dim"]
    # with a band the title stays in the band and only the body is centred
    shift = (h - need) / 2 if valign == "middle" else 0
    cursor = y + pad_y + shift
    if title:
        if band:
            band_h = title_size * 1.02 + 2 * BAND_PAD
            c.band(x, y, w, band_h, rx, accent, opacity=0.13)
            base = baseline_for_top(y + BAND_PAD, title_size)
        else:
            base = baseline_for_top(cursor, title_size)
        tx = x + pad + (8 if stripe else 0)
        if icon:
            icon_title(c, tx, base, icon, title, accent, size=title_size)
        elif align == "middle":
            c.text(x + w / 2, base, title, size=title_size, color=tcol,
                   family=SANS, weight=700, anchor="middle")
        else:
            c.text(tx, base, title, size=title_size, color=tcol, family=SANS,
                   weight=700)
        if tag:
            c.text(x + w - pad, base, tag, size=MICRO, color=accent,
                   family=SANS, weight=600, anchor="end")
        cursor = (y + band_h + pad_y + shift) if band else \
            glyph_bottom(base, title_size) + title_gap
    for k, (ln, lcol, lwt) in enumerate(body):
        base = baseline_for_top(cursor, size) + k * step
        if align == "middle":
            c.text(x + w / 2, base, ln, size=size, color=lcol or bcol,
                   family=SANS, weight=lwt, anchor="middle")
        else:
            c.text(x + pad + (8 if stripe else 0), base, ln, size=size,
                   color=lcol or bcol, family=SANS, weight=lwt)
    return (x, y, w, h)


def cards_row(c, xs, y, w, items, accents=None, **kw):
    """A row of cards at one height — the tallest content's. `items` are
    (title, lines) pairs or dicts of card() keywords; `accents` one colour per
    card or a single colour. Returns the boxes."""
    if accents is None:
        accents = [c.t["line"]] * len(items)
    elif not isinstance(accents, (list, tuple)):
        accents = [accents] * len(items)
    specs = []
    for it in items:
        spec = dict(kw)
        if isinstance(it, dict):
            spec.update(it)
        else:
            title, lines = it
            spec.update(title=title, lines=lines)
        specs.append(spec)
    hkeys = ("title_size", "size", "step", "pad", "pad_y", "band", "title_gap")
    need = max(card_h(w, s.get("title"), s.get("lines", ()),
                      **{k: s[k] for k in hkeys if k in s}) for s in specs)
    boxes = []
    for x, accent, spec in zip(xs, accents, specs):
        boxes.append(card(c, x, y, w, accent, h=need, **spec))
    return boxes


def pill(c, x, y, w, h, text, accent, *, size=BODY, fill=None, rx=None, sw=1.4,
         color=None, weight=600, dash=None, opacity=None):
    """A box with one centred line. `rx=None` gives a capsule."""
    fill = c.t["box"] if fill is None else fill
    kw = dict(rx=h / 2 if rx is None else rx, fill=fill, stroke=accent, sw=sw,
              dash=dash)
    if opacity is not None:
        kw["opacity"] = opacity
    c.rrect(x, y, w, h, **kw)
    c.text(x + w / 2, centered_baseline(y, h, size), text, size=size,
           color=color or c.t["fg"], family=SANS, weight=weight, anchor="middle")


def pill_h(size=BODY, pad_y=10):
    """The height of a one-line pill at `size` with `pad_y` above and below."""
    return size * 1.02 + 2 * pad_y


def note(c, x, y, w, text, accent, *, size=MICRO, step=STEP, pad=PAD, pad_y=12,
         weight=600, align="middle", opacity=0.08, color=None, rx=9):
    """A tinted band holding one or two lines, sized to them. Returns the box."""
    body = [ln for t in ([text] if isinstance(text, str) else text)
            for ln in wrap(t, w - 2 * pad, size)]
    h = pad_y * 2 + lines_h(len(body), size, step)
    c.rrect(x, y, w, h, rx=rx, fill=accent, stroke=None, opacity=opacity)
    for k, ln in enumerate(body):
        base = baseline_for_top(y + pad_y, size) + k * step
        if align == "middle":
            c.text(x + w / 2, base, ln, size=size, color=color or accent,
                   family=SANS, weight=weight, anchor="middle")
        else:
            c.text(x + pad, base, ln, size=size, color=color or accent,
                   family=SANS, weight=weight)
    return (x, y, w, h)


def frame_around(boxes, pad=PAD, pad_top=None):
    """(x, y, w, h) of a boundary holding every box with one inset."""
    return Canvas.frame_around(boxes, pad=pad, pad_top=pad_top)


def label_band(c, x, y, w, h, band_w, text, accent, *, size=CARD, rx=10,
               opacity=0.13, color=None):
    """A label band on the left edge of a box — round on the outline, square
    against the body — with its text centred in the band."""
    c.band(x, y, band_w, h, rx, accent, opacity=opacity, side="left")
    c.text(x + band_w / 2, centered_baseline(y, h, size), text, size=size,
           color=color or accent, family=SANS, weight=700, anchor="middle")


def zone(c, x, y, w, h, accent, label, tag=None, dash=None, fill=None,
         icon=None):
    """A boundary panel whose name sits in a chip on its top border and whose
    tag, if any, sits on the same border at the right — both on a paper plate,
    so the border is broken behind the letters rather than running through
    them. Returns the y where content starts: one PAD below the chip's lower
    edge, so the inset under the chip equals the side insets."""
    fill = c.t["panel"] if fill is None else fill
    c.rrect(x, y, w, h, rx=14, fill=fill, stroke=accent, sw=1.6, dash=dash)
    chip_h = 2 * CHIP_RISE
    lw = tw(label, BODY, False) + 26 + (26 if icon else 0)
    c.rrect(x + 18, y - chip_h / 2, lw, chip_h, rx=7, fill=c.t["bg"],
            stroke=accent, sw=1.2)
    if icon:
        c.icon(icon, x + 34, y, size=17, color=accent, sw=1.6)
        c.text(x + 48, y + 5, label, size=BODY, color=accent, family=SANS,
               weight=700)
    else:
        c.text(x + 18 + lw / 2, y + 5, label, size=BODY, color=accent,
               family=SANS, weight=700, anchor="middle")
    if tag:
        c.text(x + w - 18, y + 5, tag, size=MICRO, color=c.t["muted"],
               family=SANS, anchor="end", mask=True)
    return y + chip_h / 2 + PAD


def segment_bar(c, x, y, w, h, items, *, size=MICRO, min_label_pad=10, rx=0):
    """A proportional strip: one segment per (label, value, role), width in
    proportion to value. `rx` is the radius of the outline the strip sits in,
    so the end segments round with it instead of poking square corners past
    it. A segment wide enough carries its label; the narrow ones are named
    together under one bracket that spans them, in strip order. Returns the y
    where the strip and its labels end."""
    total = sum(v for _l, v, _r in items)
    cx = x
    below = []
    for i, (label, v, role) in enumerate(items):
        sw_ = w * v / total
        accent = c.t[role]
        if i == 0 and rx:
            c.band(cx, y, sw_, h, rx, accent, opacity=0.22, side="left",
                   stroke=c.t["bg"], sw=1.2, measure="width")
        elif i == len(items) - 1 and rx and abs(cx + sw_ - (x + w)) < 0.5:
            c.band(cx, y, sw_, h, rx, accent, opacity=0.22, side="right",
                   stroke=c.t["bg"], sw=1.2, measure="width")
        else:
            c.rrect(cx, y, sw_, h, rx=0, fill=accent, stroke=c.t["bg"], sw=1.2,
                    opacity=0.22, measure="width")
        text = f"{label} {v}"
        if tw(text, size, mono=False) + min_label_pad <= sw_:
            c.text(cx + sw_ / 2, centered_baseline(y, h, size), text, size=size,
                   color=accent, family=SANS, weight=700, anchor="middle")
        else:
            below.append((cx, sw_, text, accent))
        cx += sw_
    if not below:
        return y + h
    x0 = below[0][0]
    x1 = below[-1][0] + below[-1][1]
    by = y + h + 4
    c.line(x0 + 2, by, x1 - 2, by, color=c.t["muted"], sw=1, marker=None)
    mid = (x0 + x1) / 2
    c.line(mid, by, mid, by + 6, color=c.t["muted"], sw=1, marker=None)
    ly = baseline_for_top(by + 10, size)
    c.text(mid, ly, " · ".join(t for _x, _w, t, _a in below), size=size,
           color=c.t["fg_dim"], family=SANS, weight=700, anchor="middle")
    return glyph_bottom(ly, size)


def step_row(c, xs, cw, y, items, accent, numbered=True, fill=None, dash=None,
             sep="arrow", size=BODY, sub_size=MICRO):
    """A row of step cards at one height — an optional number, the name, one
    sub-line — joined by arrows (`sep="arrow"`), chevrons (`"chevron"`) or
    nothing (`None`). `items` are (name, sub) pairs; `sub` may be None.
    Returns the row height."""
    inner = cw - 16
    names = [wrap(n, inner, size) for n, _s in items]
    subs = [wrap(s, inner, sub_size) if s else [] for _n, s in items]
    name_h = lines_h(max(len(n) for n in names), size, 17)
    sub_h = lines_h(max(len(s) for s in subs), sub_size, 15)
    h = (12 + (sub_size * 1.02 + 6 if numbered else 0) + name_h
         + (6 + sub_h if sub_h else 0) + 12)
    for i, (x, name, sub) in enumerate(zip(xs, names, subs)):
        c.rrect(x, y, cw, h, rx=10, fill=fill or c.t["box"], stroke=accent,
                sw=1.4, dash=dash)
        yy = y + 12
        if numbered:
            c.text(x + cw / 2, baseline_for_top(yy, sub_size), f"{i + 1}",
                   size=sub_size, color=accent, family=SANS, weight=700,
                   anchor="middle")
            yy += sub_size * 1.02 + 6
        for k, ln in enumerate(name):
            c.text(x + cw / 2, baseline_for_top(yy, size) + k * 17, ln, size=size,
                   color=c.t["fg"], family=SANS, weight=700, anchor="middle")
        yy += name_h + 6
        for k, ln in enumerate(sub):
            c.text(x + cw / 2, baseline_for_top(yy, sub_size) + k * 15, ln,
                   size=sub_size, color=c.t["muted"], family=SANS,
                   anchor="middle")
        if i:
            gap = x - (xs[i - 1] + cw)
            if sep == "arrow":
                c.line(x - gap, y + h / 2, x, y + h / 2, color=accent, sw=1.4,
                       marker=accent)
            elif sep == "chevron":
                c.text(x - gap / 2, centered_baseline(y, h, SECTION), "›",
                       size=SECTION, color=accent, family=SANS, weight=700,
                       anchor="middle")
    return h
