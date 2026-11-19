"""Product logos placed in a figure, from the project's logo directory.

A logo names a product the document uses (a database, an orchestrator, a
library). It is never decoration: a line icon (`icon_title`) marks a kind of
thing, a logo names one particular product.

The config's `logos` object names the directory (`{"dir": ..., "height": ...,
"minHeightPx": ..., "gap": ...}`); a logo is called by its file stem, so
`logo(c, x, y, "postgresql")` reads `<dir>/postgresql.svg`. A stem with no file
raises `LogoError` naming the path it looked for, at the call.

While a figure is drawn, a logo is one unfilled placeholder rectangle in the
canvas body, so the board fit, the ink box and the type snapping treat it as
one box and never reach inside it. `save()` swaps each placeholder for the
sanitized logo as a nested `<svg data-logo="<stem>">` with its ids under a
prefix unique to that figure and placement (`svglogo.py`).
"""
import math
import re
import sys

from figlib.boxes import card
from figlib.settings import CARD, CFG, LIBRARY, SANS, SCALE, tw
from figlib.text import PAD, PAD_Y, TITLE_GAP, baseline_for_top

if str(LIBRARY.parent) not in sys.path:
    sys.path.append(str(LIBRARY.parent))
from svglogo import LogoError, read_logo  # noqa: E402

import figconfig  # noqa: E402

__all__ = ["LOGO_H", "LOGO_GAP", "LOGO_FLOOR_PX", "LogoError", "logo_path", "logo_size",
           "logo", "logo_title", "logo_title_w", "logo_row", "logo_row_h", "logo_row_w", "logo_card",
           "logo_card_h"]

_SPEC = CFG.logos or {}
# The least printed height of a placed logo; verify.py fails one placed lower.
LOGO_FLOOR_PX = _SPEC.get("minHeightPx", figconfig.DEFAULT_LOGO_FLOOR_PX)
# The height a logo is drawn at when a call names none: the config's, or a
# quarter above the floor on the default board, so a default placement clears
# it with room to spare.
LOGO_H = _SPEC.get("height") or math.ceil(1.25 * LOGO_FLOOR_PX / SCALE)
# Space between two logos in a row, across and down.
LOGO_GAP = _SPEC.get("gap") or round(LOGO_H * 0.6)

_CACHE = {}
_SLOT = re.compile(r'<rect\b[^>]*\bdata-logo-slot="(\d+)"[^>]*/>')


def logo_path(name):
    """The file a logo stem resolves to."""
    if not CFG.logos:
        raise LogoError(f"logo {name!r}: the config declares no 'logos' directory; add "
                        '"logos": {"dir": "<folder of logo SVGs>"} to '
                        ".claude/document-figures.json")
    return CFG.logos["dir"] / f"{name}.svg"


def _load(name):
    if name not in _CACHE:
        path = logo_path(name)
        if not path.is_file():
            near = sorted(p.stem for p in path.parent.glob("*.svg")
                          if name.lower() in p.stem.lower() or p.stem.lower() in name.lower())
            raise LogoError(f"logo {name!r}: no file {path}"
                            + (f" (near: {', '.join(near[:5])})" if near else ""))
        found = read_logo(path, name)
        if found.has_text:
            print(f"  ℹ logo {name!r} ({path.name}) carries live text; it is pinned to "
                  "its own face, which prints only where that face is installed - "
                  "an outlined logo prints the same everywhere", file=sys.stderr)
        _CACHE[name] = found
    return _CACHE[name]


def logo_size(name, h=None):
    """(width, height) a logo takes at height `h` (default LOGO_H)."""
    h = LOGO_H if h is None else h
    return _load(name).width_at(h), h


def logo(c, x, y, name, h=None):
    """Place a logo with its top-left at (x, y), `h` tall and as wide as its
    viewBox makes it. Returns the box it occupies, (x, y, w, h)."""
    found = _load(name)
    h = LOGO_H if h is None else h
    w = found.width_at(h)
    slots = c.__dict__.setdefault("_logo_slots", [])
    slots.append(found)
    c.add(f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" fill="none" '
          f'stroke="none" data-logo-slot="{len(slots) - 1}"/>')
    return (x, y, w, h)


def logo_title_w(name, text, *, h=None, size=CARD, gap=10):
    """Width of a logo-plus-name run, for centring it or flowing after it."""
    return logo_size(name, h)[0] + gap + tw(text, size, mono=False)


def logo_title(c, x, y, name, text, *, h=None, size=CARD, gap=10, weight=700,
               color=None):
    """A logo then its name on one baseline `y`, the counterpart of
    `icon_title`: the logo is centred where an icon would be, on the middle of
    the name's lower-case letters. Returns the box of the whole run."""
    lw, lh = logo_size(name, h)
    cy = y - size * 0.34
    top = cy - lh / 2
    logo(c, x, top, name, lh)
    tx = x + lw + gap
    c.text(tx, y, text, size=size, color=color or c.t["fg"], family=SANS, weight=weight)
    y0 = min(top, y - size * 0.78)
    y1 = max(top + lh, y + size * 0.24)
    return (x, y0, tx + tw(text, size, mono=False) - x, y1 - y0)


def _rows(names, width, h, gap):
    rows, cur, used = [], [], 0.0
    for name in names:
        w = logo_size(name, h)[0]
        if w > width:
            raise LogoError(f"logo {name!r} is {w:.0f} units wide at height {h:g}, wider "
                            f"than the {width:.0f} units it was given")
        need = w if not cur else used + gap + w
        if cur and need > width:
            rows.append(cur)
            cur, used = [(name, w)], w
        else:
            cur.append((name, w))
            used = need
    if cur:
        rows.append(cur)
    return rows


def logo_row_w(names, *, h=None, gap=None):
    """Width of these logos on one line, for sizing the box that holds them:
    the lint reads a box whose row stops short of its right side as unevenly
    inset (FRAME-PADDING-UNEVEN)."""
    h = LOGO_H if h is None else h
    gap = LOGO_GAP if gap is None else gap
    return sum(logo_size(n, h)[0] for n in names) + gap * max(len(names) - 1, 0)


def logo_row_h(names, width, *, h=None, gap=None, row_gap=None):
    """Height `logo_row()` takes for these logos within `width`."""
    h = LOGO_H if h is None else h
    gap = LOGO_GAP if gap is None else gap
    row_gap = gap if row_gap is None else row_gap
    n = len(_rows(names, width, h, gap))
    return n * h + max(n - 1, 0) * row_gap


def logo_row(c, x, y, names, width, *, h=None, gap=None, row_gap=None, align="start"):
    """Logos on one line from (x, y) at one height, `gap` apart, wrapping to
    the next line within `width`. `align` is "start" or "middle" per line.
    Returns the height used."""
    h = LOGO_H if h is None else h
    gap = LOGO_GAP if gap is None else gap
    row_gap = gap if row_gap is None else row_gap
    rows = _rows(names, width, h, gap)
    for r, row in enumerate(rows):
        span = sum(w for _n, w in row) + gap * (len(row) - 1)
        lx = x + ((width - span) / 2 if align == "middle" else 0)
        ly = y + r * (h + row_gap)
        for name, w in row:
            logo(c, lx, ly, name, h)
            lx += w + gap
    return len(rows) * h + max(len(rows) - 1, 0) * row_gap


def logo_card_h(w, title, names, *, logo_h=None, gap=None, title_size=CARD, pad=PAD,
                pad_y=PAD_Y, title_gap=TITLE_GAP):
    """The height `logo_card()` gives a card of width `w`."""
    row = logo_row_h(names, w - 2 * pad, h=logo_h, gap=gap)
    head = title_size * 1.02 + title_gap if title else 0
    return pad_y + head + row + pad_y


def logo_card(c, x, y, w, accent, title, names, *, h=None, logo_h=None, gap=None,
              title_size=CARD, pad=PAD, pad_y=PAD_Y, title_gap=TITLE_GAP,
              align="start", **card_kw):
    """A card holding a title and a row of logos, sized from both like
    `card()`; `h` forces a taller box (`cards_row` passes the row's tallest)
    and the extra room falls below the logos. Other keywords go to `card()`.
    Returns (x, y, w, h)."""
    need = logo_card_h(w, title, names, logo_h=logo_h, gap=gap, title_size=title_size,
                       pad=pad, pad_y=pad_y, title_gap=title_gap)
    h = need if h is None else max(h, need)
    box = card(c, x, y, w, accent, title, (), h=h, title_size=title_size, pad=pad,
               pad_y=pad_y, title_gap=title_gap, **card_kw)
    top = (baseline_for_top(y + pad_y, title_size) + title_size * 0.24 + title_gap
           if title else y + pad_y)
    logo_row(c, x + pad, top, names, w - 2 * pad, h=logo_h, gap=gap, align=align)
    return box


def resolve_slots(c, markup, figure_name):
    """Swap every placeholder in a saved figure for its logo, ids prefixed by
    the figure's name and the placement's ordinal on the canvas, so ids stay
    unique when several figures are inlined into one page."""
    slots = c.__dict__.get("_logo_slots") or []
    stem = re.sub(r"[^\w-]", "_", figure_name)

    def swap(m):
        k = int(m.group(1))
        if k >= len(slots):
            raise LogoError(f"{figure_name}: a logo placeholder ({k}) has no logo on "
                            "this canvas")
        tag = m.group(0)
        x, y, w, h = (float(re.search(rf'(?<![\w-]){a}="([\-\d.]+)"', tag).group(1))
                      for a in ("x", "y", "width", "height"))
        return slots[k].markup(f"lg-{stem}-{k}", x, y, w, h)

    return _SLOT.sub(swap, markup)
