"""Checks on the logos placed in saved figures.

Every other check reads the opaque view, where a logo is one named box. These
read that box: it prints at least the floor height, it carries no label over
it, it does not overlap another logo, and no placeholder was left unresolved
by a figure saved without the library's `save()`.
"""
import re

import figconfig
from figlib.svgread import _raw, _read, board_of, text_width
from svglogo import logo_boxes

TEXT_RE = re.compile(r"<text\b([^>]*)>(.*?)</text>", re.S)
SLOT_RE = re.compile(r"\bdata-logo-slot=")


def _num(attrs, key, default=None):
    m = re.search(rf'(?<![\w-]){key}="([\-\d.]+)"', attrs)
    return float(m.group(1)) if m else default


def _glyph_boxes(cfg, markup):
    """(text, x0, y0, x1, y1) of every label in the opaque view."""
    out = []
    for attrs, body in TEXT_RE.findall(markup):
        if "data-halo" in attrs:
            continue
        text = re.sub(r"<[^>]+>", "", body).strip()
        x, y, size = _num(attrs, "x"), _num(attrs, "y"), _num(attrs, "font-size", 13)
        if not text or x is None or y is None:
            continue
        w = text_width(cfg, text, size)
        anchor = (re.search(r'text-anchor="(\w+)"', attrs) or [None, "start"])[1]
        x0 = x - w / 2 if anchor == "middle" else x - w if anchor == "end" else x
        out.append((text, x0, y - size * 0.78, x0 + w, y + size * 0.24))
    return out


def _cross(a, b, slack=0.5):
    """Whether two (x0, y0, x1, y1) boxes share more than a hairline."""
    return (min(a[2], b[2]) - max(a[0], b[0]) > slack
            and min(a[3], b[3]) - max(a[1], b[1]) > slack)


def logo_errors(svgs, cfg):
    """[(figure, finding)] over every figure, or None when no figure places a
    logo and the config declares no `logos`."""
    spec = cfg.logos
    floor = spec["minHeightPx"] if spec else figconfig.DEFAULT_LOGO_FLOOR_PX
    found, any_logo = [], False
    for svg in svgs:
        raw = _raw(svg)
        if SLOT_RE.search(raw):
            found.append((svg.name, "a logo placeholder was never swapped for its logo - "
                                    "save the figure with the library's save()"))
        boxes = logo_boxes(raw)
        if not boxes:
            continue
        any_logo = True
        board = board_of(svg, cfg) or cfg.default_board
        ppu = cfg.boards[board] / board * cfg.place_scale
        for name, _x, _y, _w, h in boxes:
            if h * ppu < floor - 1e-6:
                found.append((svg.name, f"logo 「{name}」 prints {h * ppu:.1f}px tall, under "
                                        f"the {floor:g}px floor - draw it at "
                                        f"{floor / ppu:.1f} units or more"))
        rects = [(n, x, y, x + w, y + h) for n, x, y, w, h in boxes]
        for i, a in enumerate(rects):
            for b in rects[i + 1:]:
                if _cross(a[1:], b[1:]):
                    found.append((svg.name, f"logos 「{a[0]}」 and 「{b[0]}」 overlap"))
        for text, *g in _glyph_boxes(cfg, _read(svg)):
            for n, *r in rects:
                if _cross(g, r):
                    found.append((svg.name, f"「{text[:30]}」 is set over logo 「{n}」"))
    if not any_logo and not spec and not found:
        return None
    return found
