"""Content-first boxes: every box is sized from the text it holds.

A box is as tall as its wrapped text plus even padding and a row is as tall
as its tallest box, so a row of cards ends where its tallest text ends.
"""
from figlib.marks import BADGE_H, badge_, badge_then_label, badge_top
from figlib.settings import (BODY, CARD, CHIP, HAIRLINE, ICON_SIZE, ICON_SW, MICRO,
                             SANS, SECTION, STROKE, Canvas, tw)
from figlib.text import (BAND_PAD, BULLET_IND, CHIP_RISE, PAD, PAD_Y, TITLE_GAP,
                         _line_spec, baseline_for_top, centered_baseline, draw_bullet,
                         glyph_bottom, item_lines, lines_h, step_for, use_bullets, wrap)

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


def card_h(w, title=None, lines=(), *, title_size=CARD, size=MICRO, step=None,
           pad=PAD, pad_y=PAD_Y, band=False, title_gap=TITLE_GAP,
           bullet="auto", align="start"):
    """The height `card()` will give a box of width `w` with this content."""
    step = step_for(size, step)
    inner = w - 2 * pad
    bl = use_bullets(lines, bullet, bool(title))
    n = len(item_lines([_line_spec(s)[0] for s in lines], inner, size, bl))
    body = lines_h(n, size, step)
    if title and band:
        # a band with nothing under it is the whole card: no empty strip
        h = title_size * 1.02 + 2 * BAND_PAD
        if n:
            h = h + pad_y + body + pad_y
    elif title:
        h = pad_y + title_size * 1.02 + (title_gap + body if n else 0) + pad_y
    else:
        h = pad_y + body + pad_y
    return h


def card(c, x, y, w, accent, title=None, lines=(), *, h=None, icon=None,
         tag=None, badge=None, band=False, title_size=CARD, size=MICRO,
         step=None, pad=PAD, pad_y=PAD_Y, fill=None, rx=10, sw=HAIRLINE,
         dash=None, title_color=None, color=None, align="start",
         title_gap=TITLE_GAP, stripe=None, opacity=None, wash=False,
         valign="top", bullet="auto"):
    """A card sized from its content: an optional title line (with an icon, a
    right-aligned tag, or a badge after it), then body items wrapped to the
    card's inner width. Padding is even above and below by construction.
    `h` overrides the height - `cards_row()` passes the row's tallest - and
    `band=True` draws the title on a tinted header band whose bottom corners
    are square (`Canvas.band`). `stripe` draws a 6px accent band on the left
    edge, `wash=True` (or an opacity) tints the box with its accent under the
    outline. `valign="middle"` centres the content when `h` is taller than the
    content needs. Returns (x, y, w, h)."""
    step = step_for(size, step)
    fill = c.t["box"] if fill is None else fill
    inner = w - 2 * pad
    bl = use_bullets(lines, bullet, bool(title))
    if bl:
        align = "start"
    specs = [_line_spec(s) for s in lines]
    body = [(ln, specs[i][1], specs[i][2], first)
            for ln, i, first in item_lines([sp[0] for sp in specs], inner,
                                           size, bl)]
    need = card_h(w, title, lines, title_size=title_size, size=size, step=step,
                  pad=pad, pad_y=pad_y, band=band, title_gap=title_gap,
                  bullet=bl, align=align)
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
            end = icon_title(c, tx, base, icon, title, accent, size=title_size)
        elif align == "middle":
            c.text(x + w / 2, base, title, size=title_size, color=tcol,
                   family=SANS, weight=700, anchor="middle")
            end = x + w / 2 + tw(title, title_size, False) / 2
        else:
            c.text(tx, base, title, size=title_size, color=tcol, family=SANS,
                   weight=700)
            end = tx + tw(title, title_size, False)
        if badge:
            badge_(c, end + 6, badge_top(base, title_size), badge)
        if tag:
            c.text(x + w - pad, base, tag, size=CHIP, color=accent,
                   family=SANS, weight=600, anchor="end")
        cursor = (y + band_h + pad_y + shift) if band else \
            glyph_bottom(base, title_size) + title_gap
    for k, (ln, lcol, lwt, first) in enumerate(body):
        base = baseline_for_top(cursor, size) + k * step
        if align == "middle":
            c.text(x + w / 2, base, ln, size=size, color=lcol or bcol,
                   family=SANS, weight=lwt, anchor="middle")
        else:
            bx = x + pad + (8 if stripe else 0)
            if bl and first:
                draw_bullet(c, bx, base, size, accent)
            c.text(bx + (BULLET_IND if bl else 0), base, ln, size=size,
                   color=lcol or bcol, family=SANS, weight=lwt)
    return (x, y, w, h)


def cards_row(c, xs, y, w, items, accents=None, **kw):
    """A row of cards at one height - the tallest content's. `items` are
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
    hkeys = ("title_size", "size", "step", "pad", "pad_y", "band", "title_gap",
             "bullet")
    need = max(card_h(w, s.get("title"), s.get("lines", ()),
                      **{k: s[k] for k in hkeys if k in s}) for s in specs)
    return [card(c, x, y, w, accent, h=need, **spec)
            for x, accent, spec in zip(xs, accents, specs)]


def pill(c, x, y, w, h, text, accent, *, size=BODY, fill=None, rx=None,
         sw=HAIRLINE, color=None, weight=600, dash=None, opacity=None):
    """A box with one centred line. `rx=None` gives a capsule. Returns the box."""
    fill = c.t["box"] if fill is None else fill
    kw = dict(rx=h / 2 if rx is None else rx, fill=fill, stroke=accent, sw=sw,
              dash=dash)
    if opacity is not None:
        kw["opacity"] = opacity
    c.rrect(x, y, w, h, **kw)
    c.text(x + w / 2, centered_baseline(y, h, size), text, size=size,
           color=color or c.t["fg"], family=SANS, weight=weight, anchor="middle")
    return (x, y, w, h)


def note(c, x, y, w, text, accent, *, size=MICRO, step=None, pad=PAD, pad_y=12,
         weight=600, align="middle", opacity=0.08, color=None, rx=9):
    """A tinted band holding one or two lines, sized to them. Returns the box."""
    step = step_for(size, step)
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
    """A label band on the left edge of a box - round on the outline, square
    against the body - with its text centred in the band."""
    c.band(x, y, band_w, h, rx, accent, opacity=opacity, side="left")
    c.text(x + band_w / 2, centered_baseline(y, h, size), text, size=size,
           color=color or accent, family=SANS, weight=700, anchor="middle")


def joined_cell(c, x, y, w, h, lead_w, accent, *, rx=10, lead_op=0.28,
                body_op=0.10, body_fill=None, sw=HAIRLINE, side="left"):
    """One cell in two halves: a lead that labels and a body that says it.

    An icon tile and its sentence, a row's name and the row, a header and the
    card body. Both halves round only their outer corners and butt at one x,
    so the seam is a straight line; they never overlap, because two
    translucent fills stack where they cross and print darker. The tint and
    the border are separate paths because `band` applies its opacity to the
    whole element. Returns the lead's box and the body's box.
    """
    if side not in ("left", "right"):
        raise ValueError(f"side must be 'left' or 'right', not {side!r}")
    lead = (x, y, lead_w, h) if side == "left" else (x + w - lead_w, y, lead_w, h)
    body = (x + lead_w, y, w - lead_w, h) if side == "left" else (x, y, w - lead_w, h)
    c.band(*lead[:4], rx, accent, opacity=lead_op, side=side)
    other = "right" if side == "left" else "left"
    c.band(*body[:4], rx, body_fill or accent, opacity=body_op, side=other)
    c.band(*body[:4], rx, "none", opacity=1.0, side=other, stroke=accent, sw=sw)
    return lead, body


def stack_behind(c, x, y, w, h, color, *, depth=2, off=7, rx=10, side="right",
                 sw=HAIRLINE):
    """Sheets lying behind a box, to say the box stands for many of a thing.

    Only the edges that would show are drawn, as one open path per sheet, and
    the call goes before the front box so the box covers the rest.
    `side="right"` offsets each sheet up and to the right; `side="up"` insets
    each sheet on both flanks, for a box already flush with the content
    margin. Returns the rectangle the whole stack occupies, so a connector
    arriving from outside lands on the topmost sheet.
    """
    if side not in ("right", "up"):
        raise ValueError(f"side must be 'right' or 'up', not {side!r}")
    for k in range(depth, 0, -1):
        d = off * k
        if side == "right":
            c.path(f"M {x + d:.1f} {y:.1f} V {y - d:.1f} "
                   f"H {x + w + d:.1f} V {y + h - d:.1f} "
                   f"H {x + w:.1f}", color=color, sw=sw, marker=None)
        else:
            x1, x2, yy = x + d, x + w - d, y - d
            c.path(f"M {x1:.1f} {y:.1f} V {yy + rx:.1f} "
                   f"A {rx} {rx} 0 0 1 {x1 + rx:.1f} {yy:.1f} "
                   f"H {x2 - rx:.1f} "
                   f"A {rx} {rx} 0 0 1 {x2:.1f} {yy + rx:.1f} "
                   f"V {y:.1f}", color=color, sw=sw, marker=None)
    d = off * depth
    if side == "right":
        return (x, y - d, w + d, h + d)
    return (x + d, y - d, w - 2 * d, h + d)


def disc(c, cx, cy, r, fill, stroke=None, sw=HAIRLINE):
    """One circle. svgkit has no circle primitive: an arc path lints as a
    diameter line and a fully rounded rect lints as OVERLAP when two discs
    overlap, so the element is emitted directly."""
    c.add(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{fill}" '
          f'stroke="{stroke or fill}" stroke-width="{sw}"/>')


def num_disc_r(n, size=CHIP):
    """The radius num_disc() uses, for laying out around the disc first."""
    return max(size * 0.62 + 3, tw(str(n), size, True) / 2 + 5)


def num_disc(c, cx, cy, n, accent, *, ink="#ffffff", size=CHIP, sw=None):
    """A numbered disc whose radius comes from the label, so the digits stay
    inside the outline at any ladder. Returns the radius."""
    r = num_disc_r(n, size)
    disc(c, cx, cy, r, accent, sw=sw or HAIRLINE)
    c.text(cx, cy + size * 0.36, str(n), size=size, color=ink, family=SANS,
           weight=700, anchor="middle")
    return r


def zone(c, x, y, w, h, accent, label, tag=None, dash=None, fill=None,
         icon=None, badge_kind=None):
    """A boundary panel whose name sits in a chip on its top border and whose
    tag, if any, sits on the same border at the right - both on a paper
    plate, so the border is broken behind the letters. With `badge_kind` the
    chip is a badge-and-label tag (`badge_then_label`). Returns the y where
    content starts: one PAD below the chip's lower edge."""
    fill = c.t["panel"] if fill is None else fill
    c.rrect(x, y, w, h, rx=14, fill=fill, stroke=accent, sw=STROKE, dash=dash)
    # Every dimension below follows BODY, so the chip still holds its label
    # when a document derives a larger ladder.
    chip_h = 2 * CHIP_RISE
    if badge_kind:
        badge_then_label(c, x + 18, y + 5, label, badge_kind, size=BODY)
        chip_bottom = badge_top(y + 5, BODY) + BADGE_H
    else:
        isz = round(BODY * 1.05)
        lw = tw(label, BODY, False) + 26 + (isz + 8 if icon else 0)
        c.rrect(x + 18, y - chip_h / 2, lw, chip_h, rx=7, fill=c.t["bg"],
                stroke=accent, sw=HAIRLINE)
        base = centered_baseline(y - chip_h / 2, chip_h, BODY)
        if icon:
            c.icon(icon, x + 31 + isz / 2, y, size=isz, color=accent,
                   sw=max(1.6, BODY / 12))
            c.text(x + 31 + isz + 8, base, label, size=BODY, color=accent,
                   family=SANS, weight=700)
        else:
            c.text(x + 18 + lw / 2, base, label, size=BODY, color=accent,
                   family=SANS, weight=700, anchor="middle")
        chip_bottom = y + chip_h / 2
    if tag:
        c.text(x + w - 18, centered_baseline(y - chip_h / 2, chip_h, CHIP),
               tag, size=CHIP, color=c.t["fg_dim"], family=SANS,
               anchor="end", mask=True)
    return chip_bottom + PAD


def boundary(c, x, y, w, h, accent, label, tag=None, rx=14, dash=None):
    """A containment boundary drawn as a path, with its name on the top edge.

    A boundary that holds a chain of connected cards cannot be a `rect`: the
    lint reads every rect as a node, so each connector inside it would be
    reported as an arrow crossing a box.
    """
    d = (f"M {x + rx:.1f} {y:.1f} H {x + w - rx:.1f} "
         f"A {rx} {rx} 0 0 1 {x + w:.1f} {y + rx:.1f} "
         f"V {y + h - rx:.1f} A {rx} {rx} 0 0 1 {x + w - rx:.1f} {y + h:.1f} "
         f"H {x + rx:.1f} A {rx} {rx} 0 0 1 {x:.1f} {y + h - rx:.1f} "
         f"V {y + rx:.1f} A {rx} {rx} 0 0 1 {x + rx:.1f} {y:.1f} Z")
    c.path(d, color=accent, sw=STROKE, marker=None, dash=dash)
    c.text(x + 20, y - 8, label, size=BODY, color=accent, family=SANS,
           weight=700)
    if tag:
        c.text(x + w - 4, y - 8, tag, size=CHIP, color=c.t["muted"],
               family=SANS, anchor="end")


def segment_bar(c, x, y, w, h, items, *, size=CHIP, min_label_pad=10, rx=0):
    """A proportional strip: one segment per (label, value, role), width in
    proportion to value. `rx` is the radius of the outline the strip sits in,
    so the end segments round with it. A segment wide enough carries its
    label; the narrow ones are named together under one bracket that spans
    them, in strip order. Returns the y where the strip and its labels end."""
    total = sum(v for _l, v, _r in items)
    cx = x
    below = []
    for i, (label, v, role) in enumerate(items):
        sw_ = w * v / total
        accent = c.t[role]
        if i == 0 and rx:
            c.band(cx, y, sw_, h, rx, accent, opacity=0.22, side="left",
                   stroke=c.t["bg"], sw=HAIRLINE, measure="width")
        elif i == len(items) - 1 and rx and abs(cx + sw_ - (x + w)) < 0.5:
            c.band(cx, y, sw_, h, rx, accent, opacity=0.22, side="right",
                   stroke=c.t["bg"], sw=HAIRLINE, measure="width")
        else:
            c.rrect(cx, y, sw_, h, rx=0, fill=accent, stroke=c.t["bg"],
                    sw=HAIRLINE, opacity=0.22, measure="width")
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
    c.line(x0 + 2, by, x1 - 2, by, color=c.t["muted"], sw=HAIRLINE, marker=None)
    mid = (x0 + x1) / 2
    c.line(mid, by, mid, by + 6, color=c.t["muted"], sw=HAIRLINE, marker=None)
    ly = baseline_for_top(by + 10, size)
    c.text(mid, ly, " · ".join(t for _x, _w, t, _a in below), size=size,
           color=c.t["fg_dim"], family=SANS, weight=700, anchor="middle")
    return glyph_bottom(ly, size)


def chevron(c, x1, x2, y, h, accent, size=CHIP):
    """A 「›」 centred in the gap between a box ending at `x1` and the next one
    starting at `x2`, on the centre line of a row of height `h` at `y`."""
    c.text((x1 + x2) / 2, centered_baseline(y, h, size), "›", size=size,
           color=accent, family=SANS, weight=700, anchor="middle")


def step_row(c, xs, cw, y, items, accent, numbered=True, fill=None, dash=None,
             sep="arrow", size=BODY, sub_size=CHIP, start=1, name_step=None,
             sub_step=None):
    """A row of step cards at one height - an optional number, the name, one
    sub-line - joined by arrows (`sep="arrow"`), chevrons (`"chevron"`) or
    nothing (`None`). `items` are (name, sub) pairs; `sub` may be None.
    `start` is the number the first card carries, so a sequence folded onto
    two rows keeps counting. Lines inside a step are set one em apart unless
    `name_step` / `sub_step` say otherwise. Returns the row height."""
    name_step = size if name_step is None else name_step
    sub_step = sub_size if sub_step is None else sub_step
    inner = cw - 16
    names = [wrap(n, inner, size) for n, _s in items]
    subs = [wrap(s, inner, sub_size) if s else [] for _n, s in items]
    name_h = lines_h(max(len(n) for n in names), size, name_step)
    sub_h = lines_h(max(len(s) for s in subs), sub_size, sub_step)
    h = (12 + (sub_size * 1.02 + 6 if numbered else 0) + name_h
         + (6 + sub_h if sub_h else 0) + 12)
    for i, (x, name, sub) in enumerate(zip(xs, names, subs)):
        c.rrect(x, y, cw, h, rx=10, fill=fill or c.t["box"], stroke=accent,
                sw=HAIRLINE, dash=dash)
        yy = y + 12
        if numbered:
            c.text(x + cw / 2, baseline_for_top(yy, sub_size), f"{i + start}",
                   size=sub_size, color=accent, family=SANS, weight=700,
                   anchor="middle")
            yy += sub_size * 1.02 + 6
        for k, ln in enumerate(name):
            c.text(x + cw / 2, baseline_for_top(yy, size) + k * name_step, ln,
                   size=size, color=c.t["fg"], family=SANS, weight=700,
                   anchor="middle")
        yy += name_h + 6
        for k, ln in enumerate(sub):
            c.text(x + cw / 2, baseline_for_top(yy, sub_size) + k * sub_step, ln,
                   size=sub_size, color=c.t["muted"], family=SANS,
                   anchor="middle")
        if i:
            gap = x - (xs[i - 1] + cw)
            if sep == "arrow":
                c.line(x - gap, y + h / 2, x, y + h / 2, color=accent,
                       sw=HAIRLINE, marker=accent)
            elif sep == "chevron":
                chevron(c, x - gap, x, y, h, accent, size=SECTION)
    return h


def arrow_line(c, x1, y1, x2, y2, color, sw=STROKE):
    """A straight connector with an arrowhead in the line's own colour."""
    c.line(x1, y1, x2, y2, color=color, sw=sw, marker=color)


def col_head(c, x, y, text, color, anchor="start", size=BODY):
    """A column or lane heading whose glyph top sits at `y`."""
    c.text(x, baseline_for_top(y, size), text, size=size, color=color,
           family=SANS, weight=700, anchor=anchor)


# Air an arrow crosses between two cards stacked in a column figure.
STACK_GAP = 26


def v_stack(c, x, y, w, items, gap=STACK_GAP, arrow=True, **kw):
    """Cards stacked top to bottom and joined by down arrows - the spine of a
    portrait (column-board) figure. `items` are (accent, title, lines, extra
    card() keywords). Returns the boxes."""
    boxes = []
    arrow_color = kw.pop("arrow_color", None)
    kw.setdefault("valign", "middle")
    for acc, title, lines_, extra in items:
        spec = dict(kw)
        spec.update(extra)
        b = card(c, x, y, w, acc, title, lines_, sw=spec.pop("sw", STROKE),
                 **spec)
        if boxes and arrow:
            p = boxes[-1]
            arrow_line(c, x + w / 2, p[1] + p[3], x + w / 2, y,
                       arrow_color or c.t["fg_dim"])
        boxes.append(b)
        y = b[1] + b[3] + gap
    return boxes
