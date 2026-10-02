"""Marks: capsule badges, kind badges and connector labels."""
from figlib.settings import (BADGE_KINDS, CARD, CHIP, HAIRLINE, ICON_SW, MICRO, SANS,
                             tw)
from figlib.text import centered_baseline, pill_h

# ── badges ─────────────────────────────────────────────────────────────────
# Two families. `badges()` sets a run of short peer names as capsules flowing
# within a width, BADGE_GAP apart. `badge()` marks a kind of thing the reader
# must recognise before reading its label - an icon and a word in one tinted
# tag, from the config's `badges` vocabulary. Each kind keeps one colour across
# the set, so the reader learns the mark once. Its dimensions follow MICRO.
BADGE_GAP = 8                         # space between two badges, across and down
BADGE_H = round(MICRO * 22 / 15)      # height of a kind badge
BADGE_RX = round(MICRO * 6 / 15)
BADGE_PAD = round(MICRO * 7 / 15)     # air inside the badge at each end
BADGE_ICON = round(MICRO * 17 / 15)   # the badge's icon size
BADGE_ICON_GAP = round(MICRO / 3)     # space between a badge's icon and its word
BADGE_SEP = round(MICRO * 8 / 15)     # air either side of the hairline in badge_then_label
_BADGE_BASE = round(MICRO / 3)        # the badge word's baseline below the middle


def badge_rows(texts, width, size, pad_x=12):
    """Lay badges left to right, wrapping to `width`.

    Returns (rows, badge width list), each row a list of item indexes.
    """
    ws = [tw(t, size, False) + 2 * pad_x for t in texts]
    rows, cur, used = [], [], 0.0
    for i, w in enumerate(ws):
        need = w if not cur else used + BADGE_GAP + w
        if cur and need > width:
            rows.append(cur)
            cur, used = [i], w
        else:
            cur.append(i)
            used = need
    if cur:
        rows.append(cur)
    return rows, ws


def badges_h(texts, width, size, pad_y=5):
    """Height `badges()` takes for these items at this width."""
    rows, _ws = badge_rows(texts, width, size)
    bh = pill_h(size, pad_y)
    return len(rows) * bh + (len(rows) - 1) * BADGE_GAP


def badges(c, x, y, texts, width, accent, size, *, pad_y=5, fill=None,
           color=None):
    """Draw items as capsule badges flowing within `width` from (x, y).
    Returns the height used."""
    rows, ws = badge_rows(texts, width, size)
    bh = pill_h(size, pad_y)
    for r, idx in enumerate(rows):
        bx = x
        for i in idx:
            by = y + r * (bh + BADGE_GAP)
            # a badge is as wide as its word, so rows of badges are uneven by
            # nature: the width is marked as a measure, not a column
            c.rrect(bx, by, ws[i], bh, rx=bh / 2,
                    fill=c.t["box"] if fill is None else fill, stroke=accent,
                    sw=HAIRLINE, measure="width")
            c.text(bx + ws[i] / 2, centered_baseline(by, bh, size), texts[i],
                   size=size, color=color or c.t["fg"], family=SANS,
                   anchor="middle")
            bx += ws[i] + BADGE_GAP
    return len(rows) * bh + (len(rows) - 1) * BADGE_GAP


def _badge_kind(kind):
    if kind not in BADGE_KINDS:
        raise KeyError(f"badge kind {kind!r} is not declared in the config's "
                       f"'badges' ({', '.join(sorted(BADGE_KINDS)) or 'none'})")
    return BADGE_KINDS[kind]


def badge_color(c, kind):
    return c.t[_badge_kind(kind)[2]]


def badge_w(kind):
    """The badge's width. Work out placement with this before drawing."""
    _, text, _ = _badge_kind(kind)
    return BADGE_PAD * 2 + BADGE_ICON + BADGE_ICON_GAP + tw(text, MICRO, mono=False)


def badge_top(y, size=MICRO):
    """The top y that centres a badge on text sitting at baseline `y`."""
    return y - size * 0.36 - BADGE_H / 2


def badge(c, x, y, kind, color=None, gap=8):
    """Draw a badge with (x, y) as its top-left; return the x where text resumes."""
    icon, text, _ = _badge_kind(kind)
    color = badge_color(c, kind) if color is None else color
    w = badge_w(kind)
    c.rrect(x, y, w, BADGE_H, rx=BADGE_RX, fill=c.t["bg"], stroke=None)
    c.rrect(x, y, w, BADGE_H, rx=BADGE_RX, fill=color, stroke=None, opacity=.16)
    c.icon(icon, x + BADGE_PAD + BADGE_ICON / 2, y + BADGE_H / 2,
           size=BADGE_ICON, color=color, sw=ICON_SW)
    c.text(x + BADGE_PAD + BADGE_ICON + BADGE_ICON_GAP,
           y + BADGE_H / 2 + _BADGE_BASE, text, size=MICRO, color=color,
           family=SANS, weight=700)
    return x + w + gap


# `badge` is both a helper and a keyword of card(); card() reaches the helper
# under this name.
badge_ = badge


def label_badge_w(text, size, kind, gap=6):
    """Width of a label and the badge that follows it."""
    return tw(text, size, mono=False) + gap + badge_w(kind)


def label_with_badge(c, x, y, text, kind, color=None, size=CARD, weight=700,
                     gap=6):
    """Write a label, then the badge after it. Returns the badge's right edge."""
    c.text(x, y, text, size=size, color=c.t["fg"], family=SANS, weight=weight)
    end = x + tw(text, size, mono=False) + gap
    badge(c, end, badge_top(y, size), kind, color)
    return end + badge_w(kind)


def box_badge(c, x, y, w, h, kind, color=None, corner="tr", inset=10):
    """Put the badge in a box's corner, for a box whose label is centred."""
    bx = x + w - badge_w(kind) - inset
    by = y + inset if corner == "tr" else y + h - BADGE_H - inset
    badge(c, bx, by, kind, color)


def badge_then_label(c, x, y, text, kind, color=None, size=CARD, weight=700):
    """Badge and label inside one tag, separated by a hairline, for an element
    that is the marked thing rather than a thing that has the property."""
    icon, badge_text, _ = _badge_kind(kind)
    color = badge_color(c, kind) if color is None else color
    w = (BADGE_PAD + BADGE_ICON + BADGE_ICON_GAP + tw(badge_text, MICRO, mono=False)
         + BADGE_SEP + 1 + BADGE_SEP + tw(text, size, mono=False) + BADGE_PAD)
    top = badge_top(y, size)
    c.rrect(x, top, w, BADGE_H, rx=BADGE_RX, fill=c.t["bg"], stroke=None)
    c.rrect(x, top, w, BADGE_H, rx=BADGE_RX, fill=color, stroke=None,
            opacity=.16)
    c.icon(icon, x + BADGE_PAD + BADGE_ICON / 2, top + BADGE_H / 2,
           size=BADGE_ICON, color=color, sw=ICON_SW)
    ax = x + BADGE_PAD + BADGE_ICON + BADGE_ICON_GAP
    c.text(ax, y, badge_text, size=MICRO, color=color, family=SANS, weight=700)
    sep = ax + tw(badge_text, MICRO, mono=False) + BADGE_SEP
    c.rrect(sep, top + 5, 1, BADGE_H - 10, rx=0, fill=color, stroke=None,
            opacity=.45)
    c.text(sep + BADGE_SEP, y, text, size=size, color=color, family=SANS,
           weight=weight)
    return x + w


# ── connector labels ───────────────────────────────────────────────────────
# A connector label sits on a tight paper pill so the line breaks behind the
# letters and the plate stays inside what the lint reads as a mask.
LABEL_PAD = 6
LABEL_PAD_Y = 3


def edge_label(c, x, y, text, accent, *, size=CHIP, weight=600, pill=True):
    """A connector label centred on (x, y) - on a tight paper pill, or bare
    (`pill=False`) in open paper beside its line. Returns the pill's box."""
    w = tw(text, size) + 2 * LABEL_PAD
    h = size * 1.02 + 2 * LABEL_PAD_Y
    if pill:
        c.rrect(x - w / 2, y - h / 2, w, h, rx=5, fill=c.t["bg_deep"],
                stroke=c.t["line"], sw=HAIRLINE, opacity=0.96)
    c.text(x, centered_baseline(y - h / 2, h, size), text, size=size,
           color=accent, family=SANS, weight=weight, anchor="middle")
    return (x - w / 2, y - h / 2, w, h)
