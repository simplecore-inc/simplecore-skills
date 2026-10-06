"""Rules `audit.py` runs beside its own lint: two on the SVG, one on the
rendered picture, one on the generator's source.

- `drop_into_gap(svg)`: a headed vertical connector whose lower end lands
  between two cards of the row under it, not on one (`DROP-INTO-GAP`)
- `line_overlaps(svg)`: two drawn runs that print as one line - a route that
  doubles back on itself (`SELF-DOUBLED`), or two lines of any kind and any
  orientation on top of each other (`COINCIDENT-LINES`)
- `contrast(svg_path, render, text_w, floor, large_floor, px_per_unit)`: a
  label whose colour disappears into the shape painted under it, measured on
  a render with the text removed (`LOW-CONTRAST`)
- `marker_defaults(py_path)`: a `.line()` / `.path()` call that states no
  `marker=`, and so inherits the toolkit's arrowhead (`MARKER-DEFAULT`)
- `edge_pills(py_path)`: a document-figure module's connector label drawn
  with the toolkit's `Canvas.edge_label` pill rather than the figure
  library's `edge_label` (`EDGE-PILL`)

Each returns (kind, message) pairs, the shape `audit.lint()` reports.
"""
import ast
import math
import re
import tempfile
from collections import Counter
from pathlib import Path

ATTR_RE = re.compile(r'([\w:-]+)="([^"]*)"')
TEXT_RE = re.compile(r"<text\b([^>]*)>(.*?)</text>", re.S)


def _attrs(tag):
    return dict(ATTR_RE.findall(tag))


# ── DROP-INTO-GAP ──────────────────────────────────────────────────────────
DROP_REACH = 72.0   # px between a drop's end and the row it points at
DROP_EDGE = 2.0     # a landing this close to a box's edge still counts as on it


def drop_into_gap(svg):
    """A vertical connector whose arrowhead points at the gap in a row.

    A drop drawn from a zone's centre onto an even row of cards lands between
    the middle two, and the reader assigns it to whichever card is nearer. The
    line is well formed, strikes no box, and lints clean otherwise. Only a
    headed line points; a rail or a fork of legs at the drop's lower end
    carries it on to the cards and is the fixed shape, so it is not reported;
    and the nearest row
    below is the one judged, so a drop onto a full-width zone lands on it.
    """
    rows = {}
    for el in re.findall(r"<rect\b[^>]*>", svg):
        d = _attrs(el)
        try:
            y, x, w = float(d["y"]), float(d["x"]), float(d["width"])
        except (KeyError, ValueError):
            continue
        rows.setdefault(round(y, 1), []).append((x, w))
    lines = []
    for el in re.findall(r"<line\b[^>]*>", svg):
        d = _attrs(el)
        try:
            lines.append((float(d["x1"]), float(d["y1"]), float(d["x2"]),
                          float(d["y2"]), "marker-end" in d))
        except (KeyError, ValueError):
            continue
    out = []
    for x1, y1, x2, y2, headed in lines:
        if not headed or abs(x1 - x2) > 1.0 or abs(y2 - y1) < 12.0:
            continue
        x, bottom = x1, max(y1, y2)
        if any(abs(ly1 - ly2) <= 1.0 and abs(ly1 - bottom) <= 1.0
               and min(lx1, lx2) - 1.0 <= x <= max(lx1, lx2) + 1.0
               and abs(lx1 - lx2) > 1.0
               for lx1, ly1, lx2, ly2, _ in lines):
            continue
        near = [(ry, cells) for ry, cells in rows.items()
                if 0 <= ry - bottom <= DROP_REACH]
        if not near:
            continue
        ry, cells = min(near)
        if len(cells) < 2 or any(cx - DROP_EDGE <= x <= cx + cw + DROP_EDGE
                                 for cx, cw in cells):
            continue
        out.append(("DROP-INTO-GAP",
                    f"vertical connector at x={x:.1f} ends in the gap of the "
                    f"{len(cells)}-box row at y={ry:.1f} - land it on a box, or "
                    f"fork it into legs that reach each box"))
    return out


# ── SELF-DOUBLED / COINCIDENT-LINES ────────────────────────────────────────
COINCIDENT = 2.5   # two centrelines this close print as one line
MIN_RUN = 6.0      # overlap shorter than this is a touch, not a run
GLYPH_MAX = 10.0   # a crow's-foot prong; nothing shorter is a routed line


def _stroked(attrs):
    """Whether an element draws a line: a fill-only shape is not ink on a line."""
    m = re.search(r'\bstroke="([^"]*)"', attrs)
    return bool(m) and m.group(1) not in ("none", "transparent", "")


def _segments(svg):
    """(id, p, q, headed) for every straight run of ink in lines and paths."""
    out, cid = [], 0
    for tag in re.finditer(r"<line\b([^>]*)/?>", svg):
        if not _stroked(tag.group(1)):
            continue
        d = _attrs(tag.group(1))
        try:
            p = (float(d.get("x1", 0)), float(d.get("y1", 0)))
            q = (float(d.get("x2", 0)), float(d.get("y2", 0)))
        except ValueError:
            continue
        out.append((cid, p, q, "marker-end" in d or "marker-start" in d))
        cid += 1
    for tag in re.finditer(r"<path\b([^>]*)/?>", svg):
        a = tag.group(1)
        dm = re.search(r'\bd="([^"]+)"', a)
        if not dm or not _stroked(a):
            continue
        headed = "marker" in a
        toks = re.findall(r"[MLHVQCSTAZ]|-?[\d.]+", dm.group(1))
        i, cur, started = 0, (0.0, 0.0), False
        while i < len(toks):
            c = toks[i]
            i += 1
            try:
                if c == "M":
                    cur = (float(toks[i]), float(toks[i + 1]))
                    i += 2
                    if started:
                        cid += 1
                    started = True
                    continue
                if c == "L":
                    nxt = (float(toks[i]), float(toks[i + 1]))
                    i += 2
                elif c == "H":
                    nxt = (float(toks[i]), cur[1])
                    i += 1
                elif c == "V":
                    nxt = (cur[0], float(toks[i]))
                    i += 1
                elif c == "Q":
                    cur = (float(toks[i + 2]), float(toks[i + 3]))
                    i += 4
                    continue
                elif c == "C":
                    cur = (float(toks[i + 4]), float(toks[i + 5]))
                    i += 6
                    continue
                elif c == "A":
                    cur = (float(toks[i + 5]), float(toks[i + 6]))
                    i += 7
                    continue
                else:
                    break
            except (IndexError, ValueError):
                break
            out.append((cid, cur, nxt, headed))
            cur = nxt
        cid += 1
    return out


def _len(p, q):
    return math.hypot(q[0] - p[0], q[1] - p[1])


def _overlap(p1, q1, p2, q2):
    """(perpendicular gap, overlapping length) for two near-parallel runs."""
    l1, l2 = _len(p1, q1), _len(p2, q2)
    if l1 < 1 or l2 < 1:
        return None, 0.0
    u = ((q1[0] - p1[0]) / l1, (q1[1] - p1[1]) / l1)
    v = ((q2[0] - p2[0]) / l2, (q2[1] - p2[1]) / l2)
    if abs(u[0] * v[0] + u[1] * v[1]) < 0.985:      # over ~10 degrees apart
        return None, 0.0
    n = (-u[1], u[0])
    gap = sum(abs((pt[0] - p1[0]) * n[0] + (pt[1] - p1[1]) * n[1])
              for pt in (p2, q2)) / 2

    def proj(pt):
        return (pt[0] - p1[0]) * u[0] + (pt[1] - p1[1]) * u[1]

    b0, b1 = sorted((proj(p2), proj(q2)))
    return gap, max(min(l1, b1) - max(0.0, b0), 0.0)


def _axis(p, q):
    return abs(p[0] - q[0]) <= 1.5 or abs(p[1] - q[1]) <= 1.5


def line_overlaps(svg):
    """Two runs of ink that print as one line where two were drawn.

    Wider than PARALLEL-CONNECTORS on every axis it narrows on: every drawn
    segment (a divider, a rule, a grid line), any orientation, and segments of
    one route, which that check skips by construction. A pair it already
    reports - two headed axis-aligned connectors overlapping by more than 24px
    - is left to it. Two kinds of contact are the drawing grammar and pass: a
    crow's-foot prong along its relationship line (never longer than the
    glyph), and two unheaded lines that meet end to end where routes merge.
    """
    body = re.sub(r"<defs\b.*?</defs>", "", svg, flags=re.S)
    segs = [s for s in _segments(body) if _len(s[1], s[2]) >= 3]
    out, seen = [], set()
    for i in range(len(segs)):
        ci, p1, q1, h1 = segs[i]
        for j in range(i + 1, len(segs)):
            cj, p2, q2, h2 = segs[j]
            gap, run = _overlap(p1, q1, p2, q2)
            if gap is None or gap > COINCIDENT or run < MIN_RUN:
                continue
            if ci == cj:
                kind = "SELF-DOUBLED"
            elif min(_len(p1, q1), _len(p2, q2)) <= GLYPH_MAX:
                continue
            elif (not h1 and not h2 and (_len(q1, q2) < 0.1 or _len(p1, p2) < 0.1)):
                continue
            elif h1 and h2 and _axis(p1, q1) and _axis(p2, q2) and run > 24:
                continue
            else:
                kind = "COINCIDENT-LINES"
            key = (kind, round(p1[0]), round(p1[1]), round(q1[0]), round(q1[1]))
            if key in seen:
                continue
            seen.add(key)
            what = ("one route runs back over itself" if kind == "SELF-DOUBLED"
                    else "two lines lie on top of each other")
            out.append((kind,
                        f"{what} {gap:.1f}px apart for {run:.0f}px near "
                        f"({p1[0]:.0f},{p1[1]:.0f})->({q1[0]:.0f},{q1[1]:.0f}) "
                        f"- they print as one line; move one off, or draw the "
                        f"shared run once"))
    return out


# ── LOW-CONTRAST ───────────────────────────────────────────────────────────
# WCAG's floor for large text, the CLI's default for every label. Text under
# the large-text size needs 4.5: `--floor 4.5 --large-floor 3.0` holds a label
# to the ratio its printed size needs, read at `--px-per-unit` (verify.py
# passes each board's placement).
CONTRAST_FLOOR = 3.0
# WCAG's large text: 18pt, or 14pt in bold, in CSS px (1pt = 4/3 px).
LARGE_PX = 24.0
LARGE_BOLD_PX = 18.67


def is_large(size, weight, px_per_unit=1.0):
    """Whether a label at `size` units and `weight` prints as WCAG large text."""
    px = size * px_per_unit
    bold = weight in ("bold", "bolder") or (weight.isdigit() and int(weight) >= 700)
    return px >= LARGE_PX or (bold and px >= LARGE_BOLD_PX)


def _luminance(rgb):
    def channel(v):
        v /= 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (channel(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(fg, bg):
    a, b = _luminance(fg), _luminance(bg)
    lo, hi = sorted((a, b))
    return (hi + 0.05) / (lo + 0.05)


def _rgb(value):
    """`#rrggbb` to a tuple, or None for anything else."""
    v = value.strip().lstrip("#")
    if len(v) != 6 or not re.fullmatch(r"[0-9A-Fa-f]{6}", v):
        return None
    return tuple(int(v[i:i + 2], 16) for i in (0, 2, 4))


def contrast(svg_path, render, text_w, floor=CONTRAST_FLOOR, scale=2,
             large_floor=None, px_per_unit=1.0):
    """Labels under their floor against what is painted under them.

    The ground is measured, not inferred: the figure is rendered once with
    every `<text>` removed (`render(svg, png, scale)`), and the most common
    colour inside each label's own box on that image is the ground the reader
    sees the glyphs against. `text_w(text, size, mono)` is the toolkit's width
    estimate. Every label is held to `floor`:1, except that with `large_floor`
    given, a label that prints as large text (`is_large` at `px_per_unit`) is
    held to that instead. Raises RuntimeError when the render produced nothing,
    because a contrast check that could not look has not passed.
    """
    from PIL import Image

    raw = Path(svg_path).read_text(encoding="utf-8")
    out = []
    with tempfile.TemporaryDirectory() as tmp:
        bare = Path(tmp) / "bare.svg"
        bare.write_text(TEXT_RE.sub("", raw), encoding="utf-8")
        png = Path(tmp) / "bare.png"
        render(str(bare), str(png), scale)
        if not png.exists():
            raise RuntimeError(f"{svg_path}: the contrast render produced no image")
        with Image.open(png) as im:
            img = im.convert("RGB")
        for attrs, body in TEXT_RE.findall(raw):
            a = _attrs(attrs)
            fg = _rgb(a.get("fill", ""))
            text = re.sub(r"<[^>]+>", "", body).strip()
            try:
                size = float(a.get("font-size", 0) or 0)
                x, y = float(a.get("x", 0)), float(a.get("y", 0))
            except ValueError:
                continue
            if not fg or not text or not size:
                continue
            width = text_w(text, size, False)
            anchor = a.get("text-anchor", "start")
            x0 = x - width / 2 if anchor == "middle" else x - width if anchor == "end" else x
            box = (max(0, int(x0 * scale)), max(0, int((y - size * 0.78) * scale)),
                   min(img.width, int((x0 + width) * scale)),
                   min(img.height, int((y + size * 0.14) * scale)))
            if box[2] <= box[0] or box[3] <= box[1]:
                continue
            bg = Counter(img.crop(box).getdata()).most_common(1)[0][0]
            ratio = contrast_ratio(fg, bg)
            limit = floor
            if large_floor is not None and is_large(size, a.get("font-weight", "400"),
                                                    px_per_unit):
                limit = large_floor
            if ratio < limit:
                out.append(("LOW-CONTRAST",
                            f'"{text[:34]}" {a["fill"]} on '
                            f'#{bg[0]:02x}{bg[1]:02x}{bg[2]:02x} is {ratio:.2f}:1, '
                            f'under {limit:g}:1 - take the band\'s own dark tone '
                            f'or move the label off the band'))
    return out


# ── MARKER-DEFAULT ─────────────────────────────────────────────────────────
def marker_defaults(py_path):
    """Connector calls that inherit the toolkit's arrowhead.

    `Canvas.line()` and `Canvas.path()` draw a head unless one is refused, so a
    route built from several calls grows a head on every corner while the
    source reads as correct, because the word `marker` never appears in it.
    Every call states what it draws: `marker=None` on each segment before the
    last, the accent on the one that arrives. A call that forwards `**kwargs`
    cannot be judged from the source and is left alone.
    """
    src = Path(py_path).read_text(encoding="utf-8")
    out = []
    for node in ast.walk(ast.parse(src, filename=str(py_path))):
        func = getattr(node, "func", None)
        if not isinstance(node, ast.Call) or not isinstance(func, ast.Attribute):
            continue
        if func.attr not in ("line", "path"):
            continue
        if any(k.arg == "marker" or k.arg is None for k in node.keywords):
            continue
        out.append(("MARKER-DEFAULT",
                    f"{Path(py_path).name}:{node.lineno}: .{func.attr}() states no "
                    f"marker= and draws the toolkit's default arrowhead - pass "
                    f"marker=None, or the colour of the head it arrives with"))
    return out


# ── EDGE-PILL ──────────────────────────────────────────────────────────────
# `Canvas.edge_label(x, y, s, color, size, mono, pill, weight)`: `pill` is the
# seventh argument after `self`.
PILL_ARG = 6


def _module_names(tree):
    """Names a plain `import` binds: a call on one of them is a module function."""
    names = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                names.add(alias.asname or alias.name.split(".")[0])
    return names


def edge_pills(py_path):
    """Connector labels a document figure draws on the toolkit's pill.

    `Canvas.edge_label` spreads its plate 8 units a side and a third of an em
    above and below the letters; at a document's type size that plate is taller
    than the gap an arrow runs in, and it prints over the boxes either side.
    The figure library's `edge_label(c, x, y, text, accent)` fits the plate to
    the glyph box, so a figure module calls that. A method call that draws no
    pill (`pill=False`) passes; one whose `pill` is computed, or that forwards
    `**kwargs`, cannot be judged from the source and is left alone; a call on
    a module bound by `import` is a module function, not the method.
    """
    src = Path(py_path).read_text(encoding="utf-8")
    tree = ast.parse(src, filename=str(py_path))
    modules = _module_names(tree)
    out = []
    for node in ast.walk(tree):
        func = getattr(node, "func", None)
        if not isinstance(node, ast.Call) or not isinstance(func, ast.Attribute):
            continue
        if func.attr != "edge_label":
            continue
        if isinstance(func.value, ast.Name) and func.value.id in modules:
            continue
        if any(k.arg is None for k in node.keywords):
            continue
        pill = next((k.value for k in node.keywords if k.arg == "pill"), None)
        if pill is None and len(node.args) > PILL_ARG:
            pill = node.args[PILL_ARG]
        if pill is not None and not (isinstance(pill, ast.Constant) and pill.value is True):
            continue
        out.append(("EDGE-PILL",
                    f"{Path(py_path).name}:{node.lineno}: .edge_label() draws the "
                    f"toolkit's pill, which spreads past a tight gap onto the boxes "
                    f"beside it - call the figure library's edge_label(c, x, y, text, "
                    f"accent), which fits the plate to the glyph box"))
    return out
