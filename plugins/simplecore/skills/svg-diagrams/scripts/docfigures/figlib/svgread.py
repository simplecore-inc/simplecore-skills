"""Reading a saved figure: its text, its attributes, its board."""
import html
import os
import re
import sys
from pathlib import Path

import figconfig

LIBRARY = Path(__file__).resolve().parent.parent

TEXT_RE = re.compile(r"<text\b([^>]*)>(.*?)</text>", re.S)


def toolkit_dir(cfg):
    env = os.environ.get("SVG_DIAGRAMS_SCRIPTS")
    for c in ([Path(env)] if env else []) + ([cfg.toolkit] if cfg.toolkit else []) \
            + [LIBRARY.parent]:
        if (c / "audit.py").exists():
            return c
    raise figconfig.ConfigError("svg-diagrams toolkit (audit.py) not found")


def _toolkit(cfg):
    path = str(toolkit_dir(cfg))
    if path not in sys.path:
        sys.path.insert(0, path)


def text_width(cfg, text, size):
    _toolkit(cfg)
    from svgkit import tw
    return tw(text, size, False)


def _read(svg):
    return svg.read_text(encoding="utf-8")


def _head(svg):
    return _read(svg)[:800]


def texts(svg):
    """(attrs, plain text) for every <text>, entities decoded."""
    out = []
    for attrs, body in TEXT_RE.findall(_read(svg)):
        out.append((attrs, html.unescape(re.sub(r"<[^>]+>", "", body)).strip()))
    return out


def _attr(attrs, name):
    m = re.search(rf'\b{name}="([^"]*)"', attrs)
    return m.group(1) if m else None


def board_of(svg, cfg):
    """The board a figure was saved on, or None when it is on none."""
    m = re.search(r'<svg\b[^>]*\bwidth="([\d.]+)"[^>]*\bviewBox="0 0 ([\d.]+)', _head(svg))
    if not m:
        return None
    w, vb = float(m.group(1)), float(m.group(2))
    for board in cfg.boards:
        if abs(w - board) <= 0.01 and abs(vb - board) <= 0.01:
            return board
    return None


def _rects(raw):
    out = []
    for m in re.finditer(r"<rect\b([^>]*)>", raw):
        v = [_attr(m.group(1), k) for k in ("x", "y", "width", "height")]
        if all(v):
            try:
                out.append(tuple(float(x) for x in v))
            except ValueError:
                continue
    return out
