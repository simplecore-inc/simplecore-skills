#!/usr/bin/env python3
"""SVG render-audit helpers: full render, region crop (zoom), and static lints.

Usage:
  audit.py render   <svg> <out.png> [scale]
  audit.py crop     <svg> <x> <y> <w> <h> <out.png> [scale]
  audit.py lint     <svg> [more.svg ...]     # exit 1 when any issue is found
  audit.py hotspots <svg> <outdir> [scale]   # zoom-crop every arrow endpoint
"""
import math
import re
import shutil
import subprocess
import sys
import tempfile
import os


def _find_chrome():
    """Locate a headless-capable Chrome/Chromium across platforms.

    Override with the CHROME env var. Chrome renders SVG at the root
    width/height, which is the ground-truth a browser (and GitHub) will show.
    """
    env = os.environ.get("CHROME")
    if env and os.path.exists(env):
        return env
    candidates = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        shutil.which("google-chrome"), shutil.which("google-chrome-stable"),
        shutil.which("chromium"), shutil.which("chromium-browser"),
        shutil.which("chrome"), shutil.which("microsoft-edge"),
        "/usr/bin/google-chrome", "/usr/bin/chromium",
    ]
    for c in candidates:
        if c and os.path.exists(c):
            return c
    return "google-chrome"


CHROME = _find_chrome()


def _is_wide(ch):
    """CJK / fullwidth glyph → ~1 em wide. Keep in sync with svgkit._is_wide
    and layout.js isWide — generator and linter must measure identically."""
    o = ord(ch)
    return (0x1100 <= o <= 0x11FF or 0x3000 <= o <= 0x303F
            or 0x3040 <= o <= 0x30FF or 0x3130 <= o <= 0x318F
            or 0x31F0 <= o <= 0x31FF or 0x3200 <= o <= 0x33FF
            or 0x3400 <= o <= 0x4DBF or 0x4E00 <= o <= 0x9FFF
            or 0xA960 <= o <= 0xA97F or 0xAC00 <= o <= 0xD7A3
            or 0xD7B0 <= o <= 0xD7FF or 0xF900 <= o <= 0xFAFF
            or 0xFF00 <= o <= 0xFFEF or 0x20000 <= o <= 0x3FFFD)


_NARROW = set(" \u00b7.,:;|'`!\u2019\u2018\u02c8")
_CAPS = set("ABCDEFGHJKLMNOPQRSTUVWXYZ")


def _text_w(txt, size, mono):
    """CJK-aware estimated text width (mirrors svgkit.tw — keep the two
    tables identical, or the generator sizes a box the lint then measures
    differently). The proportional numbers come from `calibrate_tw.py`:
    Hangul 0.92 em, lowercase 0.52, capitals 0.66, digits 0.58, the space
    and thin punctuation 0.28; a mono face sets everything at 0.6."""
    if mono:
        wide = sum(1 for ch in txt if _is_wide(ch))
        return ((len(txt) - wide) * 0.60 + wide * 1.03) * size
    w = 0.0
    for ch in txt:
        if _is_wide(ch):
            w += 0.92
        elif ch in _NARROW:
            w += 0.28
        elif ch in _CAPS:
            w += 0.66
        elif ch.isdigit():
            w += 0.58
        else:
            w += 0.52
    return w * size


def _iter_texts(svg):
    """Yield (attrs, measured_text) for every <text>.

    Handles tspan children (mermaid/d3 output): the widest tspan run is
    measured, approximating the longest rendered line. Texts positioned via
    transform are skipped — their x/y are not literal canvas coordinates, so
    every geometric judgment about them would be wrong.
    """
    for m in re.finditer(r'<text\b([^>]*)>(.*?)</text>', svg, re.S):
        a, inner = m.group(1), m.group(2)
        if 'transform=' in a:
            continue
        spans = re.findall(r'<tspan[^>]*>([^<]*)</tspan>', inner)
        if spans:
            txt = max(spans, key=lambda s: _text_w(s, 10, False))
        else:
            txt = re.sub(r'<[^>]+>', '', inner)
        if txt.strip():
            yield a, txt


def _path_points(d):
    """Real (x, y) points of an absolute path. Mirrors svgkit.path_points.

    The two scripts do not import each other — audit.py has to run against an
    SVG produced by anything, not only by this kit — so the parser is stated
    twice on purpose. Keep them in step: an arc read as coordinate pairs puts
    the bounding box at the origin and disables the margin checks silently.
    """
    arity = {"M": 2, "L": 2, "T": 2, "Q": 4, "S": 4, "C": 6,
             "H": 1, "V": 1, "A": 7, "Z": 0}
    toks = re.findall(r'[MLHVQCSTAZmlhvqcstaz]|-?[\d.]+', d)
    pts, i, cmd, cur = [], 0, "M", (0.0, 0.0)
    while i < len(toks):
        if re.match(r'[A-Za-z]', toks[i]):
            cmd = toks[i]
            i += 1
            if cmd.upper() == "Z":
                continue
        n = arity.get(cmd.upper(), 2)
        if n == 0 or i + n > len(toks):
            break
        try:
            args = [float(v) for v in toks[i:i + n]]
        except ValueError:
            break
        i += n
        if cmd.islower():
            continue
        if cmd == "H":
            cur = (args[0], cur[1])
        elif cmd == "V":
            cur = (cur[0], args[0])
        elif cmd == "A":
            cur = (args[5], args[6])
        else:
            for k in range(0, n, 2):
                pts.append((args[k], args[k + 1]))
            cur = (args[n - 2], args[n - 1])
        pts.append(cur)
    return pts


def _clip_len(p, q, r, inset=5):
    """Length of segment p→q that lies inside rect r=(x, y, w, h), shrunk by
    `inset` on every side. Zero when the segment misses the rect."""
    rx0, ry0 = r[0] + inset, r[1] + inset
    rx1, ry1 = r[0] + r[2] - inset, r[1] + r[3] - inset
    if rx1 <= rx0 or ry1 <= ry0:
        return 0.0
    dx, dy = q[0] - p[0], q[1] - p[1]
    t0, t1 = 0.0, 1.0
    for pp, qq in ((-dx, p[0] - rx0), (dx, rx1 - p[0]),
                   (-dy, p[1] - ry0), (dy, ry1 - p[1])):
        if pp == 0:
            if qq < 0:
                return 0.0
        else:
            t = qq / pp
            if pp < 0:
                if t > t1:
                    return 0.0
                t0 = max(t0, t)
            else:
                if t < t0:
                    return 0.0
                t1 = min(t1, t)
    return math.hypot(dx, dy) * (t1 - t0) if t1 > t0 else 0.0


def _root_dims(svg):
    w = re.search(r'<svg[^>]*\bwidth="([\d.]+)"', svg)
    h = re.search(r'<svg[^>]*\bheight="([\d.]+)"', svg)
    return (float(w.group(1)) if w else 1200.0,
            float(h.group(1)) if h else 900.0)


def _chrome(svg_path, out, w, h, scale):
    # Chrome needs an absolute file:// URL; a relative path yields ERR_INVALID_URL
    url = "file://" + os.path.abspath(svg_path)
    subprocess.run([CHROME, "--headless", "--disable-gpu",
                    f"--screenshot={os.path.abspath(out)}",
                    f"--window-size={int(round(w))},{int(round(h))}",
                    f"--force-device-scale-factor={scale}",
                    "--hide-scrollbars", "--default-background-color=00000000",
                    url],
                   stderr=subprocess.DEVNULL, check=False)


def render(svg_path, out, scale=2):
    with open(svg_path) as f:
        svg = f.read()
    w, h = _root_dims(svg)
    _chrome(svg_path, out, w, h, scale)
    print(f"render {out} ({w:.0f}x{h:.0f} @{scale}x)")


def crop(svg_path, x, y, w, h, out, scale=4):
    """Zoom into a sub-region by rewriting the root viewBox + width/height."""
    with open(svg_path) as f:
        svg = f.read()
    # rewrite first <svg ...> tag attrs
    def repl(m):
        tag = m.group(0)
        tag = re.sub(r'\bwidth="[\d.]+"', f'width="{w}"', tag)
        tag = re.sub(r'\bheight="[\d.]+"', f'height="{h}"', tag)
        tag = re.sub(r'\bviewBox="[^"]+"', f'viewBox="{x} {y} {w} {h}"', tag)
        return tag
    svg2 = re.sub(r'<svg[^>]*>', repl, svg, count=1)
    fd, tmp = tempfile.mkstemp(suffix=".svg")
    with os.fdopen(fd, "w") as f:
        f.write(svg2)
    _chrome(tmp, out, w, h, scale)
    os.unlink(tmp)
    print(f"crop {out} region=({x},{y},{w},{h}) @{scale}x")


# --- static lints ----------------------------------------------------------
def lint(svg_path):
    with open(svg_path) as f:
        svg = f.read()
    # strip XML comments first: commented-out draft markup must not be linted
    # as real elements (phantom flags / crashes on partial fragments)
    svg = re.sub(r'<!--.*?-->', '', svg, flags=re.S)
    W, H = _root_dims(svg)
    issues = []

    # 0) excessively wide canvas: a long single row reads poorly and shrinks
    #    when embedded — wrap the nodes onto two rows instead
    if W > 1200 and W / H > 4.5:
        issues.append(("WIDE-CANVAS",
                       f'aspect {W / H:.1f}:1 (w={W:.0f}) — wrap nodes onto '
                       f'2 rows'))

    # collect rects as candidate containers: (x,y,w,h)
    rects = []
    for m in re.finditer(r'<rect\b([^>]*)/?>', svg):
        a = m.group(1)
        def gv(k):
            mm = re.search(rf'\b{k}="([\-\d.]+)"', a)
            return float(mm.group(1)) if mm else None
        x, y, w, h = gv("x"), gv("y"), gv("width"), gv("height")
        if None not in (x, y, w, h):
            rects.append((x, y, w, h))

    # 1) text overflow: estimate text width; find smallest rect containing the
    #    text anchor and check the text stays inside it.
    for a, txt in _iter_texts(svg):
        def gv(k, d=None):
            mm = re.search(rf'\b{k}="([\-\d.]+)"', a)
            return float(mm.group(1)) if mm else d
        x = gv("x"); y = gv("y"); size = gv("font-size", 13)
        if x is None or y is None:
            continue  # positioned by ancestor/transform — not judgeable
        anchor = (re.search(r'text-anchor="(\w+)"', a) or [None, "start"])[1]
        fam = a
        mono = ("mono" in fam.lower() or "Menlo" in fam or "JetBrains" in fam
                or "SF Mono" in fam)
        tw = _text_w(txt, size, mono)
        if anchor == "middle":
            x0, x1 = x - tw / 2, x + tw / 2
        elif anchor == "end":
            x0, x1 = x - tw, x
        else:
            x0, x1 = x, x + tw
        # off-canvas
        if x0 < 0 or x1 > W or y < 0 or y > H:
            issues.append(("OFFCANVAS-TEXT",
                           f'"{txt[:28]}" x=[{x0:.0f},{x1:.0f}] y={y:.0f}'))
        # containment: rects whose vertical span includes the text baseline and
        # that horizontally surround the anchor; smallest by width = container
        conts = [(rx, ry, rw2, rh) for (rx, ry, rw2, rh) in rects
                 if ry - 2 <= y <= ry + rh + 2 and rx <= x <= rx + rw2]
        if conts:
            conts.sort(key=lambda c: c[2])  # by width, smallest first
            rx, ry, rw2, rh = conts[0]
            pad = 4
            over = max(rx - x0, x1 - (rx + rw2))
            # a low pill whose center matches the anchor was machine-sized
            # for exactly this text; tolerate estimator drift (external
            # generators use tighter real font metrics than our heuristic)
            centered_pill = (anchor == "middle" and rh <= size * 2.3
                             and abs((rx + rw2 / 2) - x) <= 3)
            limit = pad + (size * 1.2 if centered_pill else 0)
            if over > limit:
                issues.append(("TEXT-OVERFLOW",
                               f'"{txt[:24]}" by {over:.0f}px '
                               f'(text=[{x0:.0f},{x1:.0f}] box=[{rx:.0f},'
                               f'{rx + rw2:.0f}])'))

    # 2) unresolved markers: every marker-end/start url(#id) must point at a
    #    defined <marker id="...">. Catches passing a color value or wrong name
    #    where a marker id is expected (arrowhead silently disappears).
    defined = set(re.findall(r'<marker\b[^>]*\bid="([^"]+)"', svg))
    for m in re.finditer(r'marker-(?:end|start)="url\(#([^)]+)\)"', svg):
        if m.group(1) not in defined:
            issues.append(("UNRESOLVED-MARKER",
                           f'url(#{m.group(1)}) not defined → arrowhead '
                           f'will not render'))

    # 2b) oblique arrow entry: an arrowed connector's FINAL segment must be
    #     axis-aligned (horizontal/vertical) so the head meets the box edge at
    #     90 degrees. Diagonal approaches read as sloppy.
    def last_tangent(d):
        toks = re.findall(r'[MLHVQCSTAZ]|-?[\d.]+', d)
        i = 0
        cur = (0.0, 0.0)
        ref = end = None
        while i < len(toks):
            cmd = toks[i]; i += 1
            if cmd == "M":
                cur = (float(toks[i]), float(toks[i + 1])); i += 2
            elif cmd == "L":
                ref, cur = cur, (float(toks[i]), float(toks[i + 1])); i += 2
                end = cur
            elif cmd == "H":
                ref, cur = cur, (float(toks[i]), cur[1]); i += 1; end = cur
            elif cmd == "V":
                ref, cur = cur, (cur[0], float(toks[i])); i += 1; end = cur
            elif cmd == "Q":
                ref = (float(toks[i]), float(toks[i + 1]))
                cur = (float(toks[i + 2]), float(toks[i + 3])); i += 4
                end = cur
            elif cmd == "C":
                ref = (float(toks[i + 2]), float(toks[i + 3]))
                cur = (float(toks[i + 4]), float(toks[i + 5])); i += 6
                end = cur
            elif cmd == "A":
                ref = cur
                cur = (float(toks[i + 5]), float(toks[i + 6])); i += 7
                end = cur
            else:
                break
        if ref is None or end is None:
            return None
        return (end[0] - ref[0], end[1] - ref[1])

    for tag in re.finditer(r'<path\b([^>]*)/?>', svg):
        a = tag.group(1)
        if "marker-end" not in a:
            continue
        dm = re.search(r'\bd="([^"]+)"', a)
        if not dm:
            continue
        t = last_tangent(dm.group(1))
        d_ = dm.group(1)
        # An arc-only connector ends tangentially by construction — a ring's
        # arrowhead follows the circle and meets no box edge to be square to.
        # Demanding a right angle there asks for something the shape cannot do.
        arc_only = ("A" in re.findall(r'[A-Z]', d_)
                    and not set("LHV") & set(re.findall(r'[A-Z]', d_)))
        if t and not arc_only and abs(t[0]) > 1.5 and abs(t[1]) > 1.5:
            issues.append(("OBLIQUE-ARROW",
                           f'final segment not axis-aligned '
                           f'(dx={t[0]:.0f}, dy={t[1]:.0f}) → head not '
                           f'perpendicular to edge'))
        if t and math.hypot(*t) < 18:
            issues.append(("SHORT-ARROW",
                           f'final segment {math.hypot(*t):.0f}px < 18px → '
                           f'cramped / head-only arrow'))
    for tag in re.finditer(r'<line\b([^>]*)/?>', svg):
        a = tag.group(1)
        if "marker-end" not in a:
            continue
        def gv(k):
            mm = re.search(rf'\b{k}="([\-\d.]+)"', a)
            return float(mm.group(1)) if mm else 0.0
        dx, dy = gv("x2") - gv("x1"), gv("y2") - gv("y1")
        if abs(dx) > 1.5 and abs(dy) > 1.5:
            issues.append(("OBLIQUE-ARROW", "diagonal <line> with arrowhead"))
        if math.hypot(dx, dy) < 18:
            issues.append(("SHORT-ARROW",
                           f'<line> {math.hypot(dx, dy):.0f}px < 18px → '
                           f'head-only arrow'))

    # 3) markers must declare orient for direction correctness
    for m in re.finditer(r'<marker\b([^>]*)>', svg):
        if "orient=" not in m.group(1):
            mid = re.search(r'id="([^"]+)"', m.group(1))
            issues.append(("MARKER-NO-ORIENT",
                           f'marker {mid.group(1) if mid else "?"} '
                           f'missing orient="auto"'))

    # 4) off-canvas rects
    for (x, y, w, h) in rects:
        if x < -1 or y < -1 or x + w > W + 1 or y + h > H + 1:
            issues.append(("OFFCANVAS-RECT",
                           f'rect [{x:.0f},{y:.0f},{w:.0f},{h:.0f}] vs '
                           f'canvas {W:.0f}x{H:.0f}'))

    # rich rect list (document order, with dash flag) for spacing/overlap
    rmeta = []
    for m in re.finditer(r'<rect\b([^>]*)/?>', svg):
        a = m.group(1)
        def gv(k):
            mm = re.search(rf'\b{k}="([\-\d.]+)"', a)
            return float(mm.group(1)) if mm else None
        x, y, w, h = gv("x"), gv("y"), gv("width"), gv("height")
        if None in (x, y, w, h):
            continue
        om = re.search(r'\bopacity="([\d.]+)"', a)
        decorative = ("stroke-dasharray" in a
                      or (om and float(om.group(1)) < 0.99))
        rmeta.append((x, y, w, h, decorative))

    texts_xy = []
    for a, txt in _iter_texts(svg):
        xm = re.search(r'\bx="([\-\d.]+)"', a)
        ym = re.search(r'\by="([\-\d.]+)"', a)
        if xm and ym:
            texts_xy.append((float(xm.group(1)), float(ym.group(1)), txt))

    def contains(o, i, tol=2):
        return (i[0] >= o[0] - tol and i[1] >= o[1] - tol
                and i[0] + i[2] <= o[0] + o[2] + tol
                and i[1] + i[3] <= o[1] + o[3] + tol)

    def same_rect(a, b, tol=3):
        """Two rects occupying the same place — one is the other's paper mask.

        A node is commonly drawn twice: an opaque rect that stops arrows
        bleeding through a translucent fill, then the styled rect on top. The
        pair is one node, so any test that asks "does this rect enclose
        another" has to reject its own mask or every node looks like a frame.
        """
        return all(abs(a[k] - b[k]) <= tol for k in range(4))

    # 5) tight bottom padding: a container's lowest child sits too close to its
    #    bottom edge (content crammed against the border)
    solids = [r for r in rmeta if not r[4]]

    # container rects = layout chrome (subgroup/layer boxes, canvas
    # backgrounds), not nodes — arrows legitimately run inside them and
    # labels may straddle their borders. Two signals:
    #   - covers nearly the whole canvas (background), or
    #   - fully contains at least one SUBSTANTIAL solid rect. Substantial =
    #     node-sized (height >= 34px, badges/chips are <= ~30px tall) and not
    #     negligible relative to the parent (>= 5% of its area) — this keeps
    #     a card that contains only its own badge/footer chips classified as
    #     a node, while a frame around even a single node is a container.
    def _has_substantial_child(r):
        # a rect on the same footprint is the node's own mask or outline,
        # not something it contains — two rects drawn for one box must not
        # turn that box into a frame
        ra = r[2] * r[3]
        inner = [o for o in solids if o is not r and not same_rect(r, o)
                 and contains(r, o) and o[3] >= 26]
        # one node-sized child, or a row of small ones that together fill
        # the box — a wide zone over five short pills is a container too
        return (any(o[2] * o[3] >= 0.05 * ra for o in inner)
                or sum(o[2] * o[3] for o in inner) >= 0.15 * ra)
    # A plot area is a container too, though it holds no rects: a quadrant's
    # panel, a Wardley map's field, a chart's frame. Its marks are dots, lines
    # and labels, so the substantial-child test cannot see it — but it covers
    # most of the canvas and carries several labels, and nothing that is
    # really a node does both.
    def _is_plot_area(r):
        if r[2] * r[3] < 0.35 * W * H:
            return False
        inside = sum(1 for (tx, ty, _t) in texts_xy
                     if r[0] <= tx <= r[0] + r[2] and r[1] <= ty <= r[1] + r[3])
        return inside >= 4 and not any(
            o is not r and contains(r, o) for o in solids)

    containers = {id(r) for r in solids
                  if (r[2] >= 0.88 * W and r[3] >= 0.88 * H)
                  or _has_substantial_child(r) or _is_plot_area(r)}

    # label masks: the small rect that sits behind an arrow label so the line
    # does not bleed through the glyphs. Two shapes are in use — a translucent
    # stroked pill and a flat opaque rect — so the test is geometric rather
    # than stylistic: short, carries a text baseline, encloses no other rect.
    # Without this a mask reads as a node, and every check that asks "does a
    # connector cross a box" answers wrongly about the label of that very
    # connector.
    # corner radius per rect: svgkit pills are rx=6, nodes rx>=10 — height
    # alone cannot separate a one-line node (h 24) from a pill, and a node
    # misread as a mask silently leaves node_rects, so arrows pass through
    # it unreported.
    _rect_rx = {}
    for _m in re.finditer(r'<rect\b([^>]*)/?>', svg):
        _a = _m.group(1)
        _vals = {}
        for _k in ("x", "y", "width", "height", "rx"):
            _mm = re.search(_k + r'="([\-\d.]+)"', _a)
            _vals[_k] = float(_mm.group(1)) if _mm else None
        if None not in (_vals["x"], _vals["y"], _vals["width"], _vals["height"]):
            _key = (round(_vals["x"]), round(_vals["y"]),
                    round(_vals["width"]), round(_vals["height"]))
            _rect_rx[_key] = _vals["rx"] or 0.0

    label_masks = []
    for _r in rmeta:
        _x, _y, _w, _h, _ = _r
        if _h > 28 or _w < 12:
            continue
        if _rect_rx.get((round(_x), round(_y), round(_w), round(_h)), 0.0) >= 8:
            continue                      # node-round corners: a box, not a pill
        if not any(_x <= tx <= _x + _w and _y - 2 <= ty <= _y + _h + 2
                   for (tx, ty, _t) in texts_xy):
            continue
        if any(o is not _r and not same_rect(_r, o)
               and contains(_r, (o[0], o[1], o[2], o[3])) for o in rmeta):
            continue
        label_masks.append((_x, _y, _w, _h))
    mask_keys = {(round(m[0]), round(m[1]), round(m[2]), round(m[3]))
                 for m in label_masks}
    def _inner_ring(x, y, w, h):
        """True when (x, y, w, h) is itself the second, inset edge of a
        larger box — judged as part of that box, never on its own."""
        for (ox, oy, ow, oh, _) in solids:
            if (ox, oy, ow, oh) == (x, y, w, h) or ow < w or oh < h:
                continue
            insets = (x - ox, y - oy, ox + ow - x - w, oy + oh - y - h)
            if min(insets) >= 1.5 and max(insets) - min(insets) <= 1.5 \
                    and max(insets) <= 10:
                return True
        return False

    for (x, y, w, h, _) in solids:
        if w < 90 or h < 50:
            continue
        if w >= 0.88 * W and h >= 0.88 * H:
            continue  # canvas background, not a content box
        if _inner_ring(x, y, w, h):
            continue
        bottom = y + h
        maxcb = None
        for (cx, cy, cw, ch, _) in solids:
            if (cx, cy, cw, ch) == (x, y, w, h):
                continue
            if cw >= w - 2 and ch >= h - 2:
                continue  # same-ish size / not a child
            # A rect inset evenly on all four sides is a second edge on the
            # same shape — a state machine's terminal state, a pressed
            # control — not content sitting inside a box. Reading it as
            # content reports every double edge as cramped.
            insets = (cx - x, cy - y, x + w - cx - cw, y + h - cy - ch)
            if max(insets) - min(insets) <= 1.5 and max(insets) <= 10:
                continue
            if cx >= x - 2 and cx + cw <= x + w + 2 and cy >= y - 2 \
                    and cy + ch <= bottom + 2:
                maxcb = max(maxcb or 0, cy + ch)
        for (tx, ty, ttxt) in texts_xy:
            if x <= tx <= x + w and y <= ty <= bottom + 2:
                maxcb = max(maxcb or 0, ty + 4)
        if maxcb is not None and 0 <= bottom - maxcb < 8:
            issues.append(("TIGHT-BOTTOM",
                           f'box [{x:.0f},{y:.0f},{w:.0f},{h:.0f}] only '
                           f'{bottom - maxcb:.0f}px below its content'))

    # 6) overlap / occlusion: two solid rects partially overlap and neither
    #    contains the other (a later one likely hides the earlier). Pairs of
    #    one container + one non-container are skipped: a label/chip straddling
    #    its subgroup border is normal layout, not occlusion.
    for i in range(len(solids)):
        for j in range(i + 1, len(solids)):
            a, b = solids[i], solids[j]
            if (id(a) in containers) != (id(b) in containers):
                continue
            ox = min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0])
            oy = min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1])
            if ox > 4 and oy > 4 and not contains(a, b) and not contains(b, a):
                issues.append(("OVERLAP",
                               f'rects [{a[0]:.0f},{a[1]:.0f}] and '
                               f'[{b[0]:.0f},{b[1]:.0f}] overlap '
                               f'{ox:.0f}x{oy:.0f}px (occlusion)'))

    # rich text list (x, y, bbox, txt) for occlusion checks
    texts_full = []
    for a, txt in _iter_texts(svg):
        def gv(k, d=None):
            mm = re.search(rf'\b{k}="([\-\d.]+)"', a)
            return float(mm.group(1)) if mm else d
        x = gv("x"); y = gv("y"); size = gv("font-size", 13)
        if x is None or y is None:
            continue
        anchor = (re.search(r'text-anchor="(\w+)"', a) or [None, "start"])[1]
        mono = ("mono" in a.lower() or "Menlo" in a or "JetBrains" in a
                or "SF Mono" in a)
        tw2 = _text_w(txt, size, mono)
        if anchor == "middle":
            x0, x1 = x - tw2 / 2, x + tw2 / 2
        elif anchor == "end":
            x0, x1 = x - tw2, x
        else:
            x0, x1 = x, x + tw2
        y0, y1 = y - size * 0.78, y + size * 0.24
        texts_full.append((x, y, x0, y0, x1, y1, txt))

    # node-like boxes = solid content rects; dashed/translucent decorations
    # and container (subgroup/layer) rects are excluded — arrows and labels
    # inside a container are normal, arrows through a NODE are not
    node_rects = [r for r in solids if id(r) not in containers
                  and (round(r[0]), round(r[1]), round(r[2]), round(r[3]))
                  not in mask_keys]

    # 7) label occlusion: a text whose anchor is NOT inside a node box, but whose
    #    glyph box overlaps one — a free/edge label bleeding onto a neighbor box.
    for (tx, ty, x0, y0, x1, y1, txt) in texts_full:
        for nb in node_rects:
            if (nb[0] - 2 <= tx <= nb[0] + nb[2] + 2
                    and nb[1] - 2 <= ty <= nb[1] + nb[3] + 2):
                continue  # anchor inside → this box owns the text
            ox = min(x1, nb[0] + nb[2]) - max(x0, nb[0])
            oy = min(y1, nb[1] + nb[3]) - max(y0, nb[1])
            if ox > 6 and oy > 4:
                issues.append(("LABEL-OCCLUSION",
                               f'"{txt[:22]}" overlaps box '
                               f'[{nb[0]:.0f},{nb[1]:.0f}] {ox:.0f}x{oy:.0f}px'))
                break

    # 7a-2) a label sitting on a circle's outline with nothing behind it.
    #     LABEL-OCCLUSION only knows rects, so a Venn's set name, a ring
    #     label or a dial's tick could lie straight across a stroke and the
    #     lint stayed quiet. The name is unreadable there — the stroke cuts
    #     the letters — and the fix is a paper mask, which is also what makes
    #     the defect machine-visible: the mask has to cover the glyph box and
    #     be drawn after the circle.
    _circles = []
    for m in re.finditer(r'<circle\b([^>]*)/?>', svg):
        a = m.group(1)
        def _cv(k):
            mm = re.search(rf'\b{k}="([\-\d.]+)"', a)
            return float(mm.group(1)) if mm else None
        ccx, ccy, cr = _cv("cx"), _cv("cy"), _cv("r")
        stroke = re.search(r'stroke="([^"]+)"', a)
        if None in (ccx, ccy, cr) or cr < 12:
            continue
        if not stroke or stroke.group(1) == "none":
            continue           # a filled dot has no outline to sit on
        _circles.append((m.start(), ccx, ccy, cr))

    if _circles:
        _masks = []
        for m in re.finditer(r'<rect\b([^>]*)/?>', svg):
            a = m.group(1)
            fill = re.search(r'fill="([^"]+)"', a)
            if not fill or fill.group(1) in ("none", "transparent"):
                continue
            def _rv(k):
                mm = re.search(rf'\b{k}="([\-\d.]+)"', a)
                return float(mm.group(1)) if mm else None
            rx_, ry_, rw_, rh_ = _rv("x"), _rv("y"), _rv("width"), _rv("height")
            if None in (rx_, ry_, rw_, rh_):
                continue
            _masks.append((m.start(), rx_, ry_, rw_, rh_))

        def _ring_crosses(cc, box):
            _, ccx, ccy, cr = cc
            bx0, by0, bx1, by1 = box
            near_x = min(max(ccx, bx0), bx1)
            near_y = min(max(ccy, by0), by1)
            near = math.hypot(ccx - near_x, ccy - near_y)
            far = max(math.hypot(ccx - x_, ccy - y_)
                      for x_ in (bx0, bx1) for y_ in (by0, by1))
            return near <= cr <= far

        _seen_stroke_lbl = set()
        for tm in re.finditer(r'<text\b([^>]*)>(.*?)</text>', svg, re.S):
            a, inner = tm.group(1), tm.group(2)
            if 'transform=' in a:
                continue
            txt = re.sub(r'<[^>]+>', '', inner).strip()
            if not txt:
                continue
            def _tv(k, d=None):
                mm = re.search(rf'\b{k}="([\-\d.]+)"', a)
                return float(mm.group(1)) if mm else d
            tx_, ty_, ts_ = _tv("x"), _tv("y"), _tv("font-size", 13)
            if tx_ is None or ty_ is None:
                continue
            anch = (re.search(r'text-anchor="(\w+)"', a) or [None, "start"])[1]
            tw_ = _text_w(txt, ts_, False)
            gx0 = tx_ - tw_ / 2 if anch == "middle" else \
                (tx_ - tw_ if anch == "end" else tx_)
            box = (gx0, ty_ - ts_ * 0.78, gx0 + tw_, ty_ + ts_ * 0.24)
            for cc in _circles:
                if not _ring_crosses(cc, box):
                    continue
                covered = any(mo > cc[0]
                              and mx <= box[0] + 2 and my <= box[1] + 2
                              and mx + mw >= box[2] - 2
                              and my + mh >= box[3] - 2
                              for mo, mx, my, mw, mh in _masks)
                if covered:
                    continue
                key = (round(box[0]), round(box[1]))
                if key in _seen_stroke_lbl:
                    break
                _seen_stroke_lbl.add(key)
                issues.append(("LABEL-ON-STROKE",
                               f'"{txt[:22]}" lies across the outline of the '
                               f'circle at ({cc[1]:.0f},{cc[2]:.0f}) r='
                               f'{cc[3]:.0f} with nothing behind it — the '
                               f'stroke cuts the letters; put a paper mask '
                               f'under the label'))
                break

    # 7b) label pill (semi-transparent bg rect) overlapping a node box.
    #     Pills are LOW (height-gated) — width varies with the label text.
    label_pills = [r for r in rmeta if r[4] and r[3] <= 44]
    for (px, py, pw, ph, _) in label_pills:
        for nb in node_rects:
            if contains(nb, (px, py, pw, ph)) or contains((px, py, pw, ph), nb):
                continue
            ox = min(px + pw, nb[0] + nb[2]) - max(px, nb[0])
            oy = min(py + ph, nb[1] + nb[3]) - max(py, nb[1])
            if ox > 5 and oy > 4:
                issues.append(("LABEL-OCCLUSION",
                               f'label pill [{px:.0f},{py:.0f}] overlaps box '
                               f'[{nb[0]:.0f},{nb[1]:.0f}] {ox:.0f}x{oy:.0f}px'))
                break

    # 7c) text-text collision: two labels overlapping each other — unreadable
    #     regardless of what sits underneath. Capped so a systemic layout
    #     error doesn't flood the report.
    _pair_hits = 0
    for i in range(len(texts_full)):
        if _pair_hits >= 8:
            break
        for j in range(i + 1, len(texts_full)):
            a, b = texts_full[i], texts_full[j]
            ox = min(a[4], b[4]) - max(a[2], b[2])
            oy = min(a[5], b[5]) - max(a[3], b[3])
            if ox > 6 and oy > 4:
                issues.append(("TEXT-COLLISION",
                               f'"{a[6][:18]}" x "{b[6][:18]}" overlap '
                               f'{ox:.0f}x{oy:.0f}px'))
                _pair_hits += 1
                break

    # 7d) frame drawn over nodes: a frame-sized decorative rect (dashed panel
    #     or wash) that appears AFTER a solid rect it overlaps paints over
    #     that node. Document order is z-order in SVG — frames must be
    #     emitted before the nodes they enclose.
    _framed = set()
    for idx in range(len(rmeta)):
        fx, fy, fw, fh, fdec = rmeta[idx]
        if not fdec or fh <= 44:
            continue  # low decorations are label pills (7b), not frames
        # A dashed border is not proof of a frame. Editorial grammars use it
        # on a NODE to mark something outside the system's own boundary — an
        # external consumer, an optional step — and such a node encloses only
        # its own paper mask. A frame is what encloses somebody else: require
        # a strictly smaller solid rect inside before judging z-order.
        if not any(not same_rect((fx, fy, fw, fh), o)
                   and contains((fx, fy, fw, fh), (o[0], o[1], o[2], o[3]))
                   for o in solids):
            continue
        for nb in rmeta[:idx]:
            nx, ny, nw, nh, ndec = nb
            if ndec:
                continue
            key = (round(nx), round(ny), round(nw), round(nh))
            if key in _framed:
                continue
            ox = min(fx + fw, nx + nw) - max(fx, nx)
            oy = min(fy + fh, ny + nh) - max(fy, ny)
            if ox > 20 and oy > 20:
                _framed.add(key)
                issues.append(("FRAME-OVER-NODE",
                               f'frame [{fx:.0f},{fy:.0f},{fw:.0f},{fh:.0f}] '
                               f'drawn after node [{nx:.0f},{ny:.0f}] — '
                               f'emit frames before nodes'))

    # 8) arrow through box: an arrow segment crosses a node interior (routing
    #    passes over a box that is neither its source nor its target)
    def _arrow_polys():
        polys = []
        for tag in re.finditer(r'<line\b([^>]*)/?>', svg):
            a = tag.group(1)
            if "marker" not in a:
                continue
            def gv(k):
                mm = re.search(rf'\b{k}="([\-\d.]+)"', a)
                return float(mm.group(1)) if mm else 0.0
            polys.append([(gv("x1"), gv("y1")), (gv("x2"), gv("y2"))])
        for tag in re.finditer(r'<path\b([^>]*)/?>', svg):
            a = tag.group(1)
            if "marker" not in a:
                continue
            dm = re.search(r'\bd="([^"]+)"', a)
            if not dm:
                continue
            toks = re.findall(r'[MLHVQCSTAZ]|-?[\d.]+', dm.group(1))
            i = 0; cur = (0.0, 0.0); pts = []
            while i < len(toks):
                c = toks[i]; i += 1
                try:
                    if c == "M":
                        # M starts a new subpath: flush the previous polyline
                        # so no phantom segment joins disjoint subpaths
                        if len(pts) >= 2:
                            polys.append(pts)
                        cur = (float(toks[i]), float(toks[i + 1])); i += 2
                        pts = [cur]
                        continue
                    elif c == "L":
                        cur = (float(toks[i]), float(toks[i + 1])); i += 2
                    elif c == "H":
                        cur = (float(toks[i]), cur[1]); i += 1
                    elif c == "V":
                        cur = (cur[0], float(toks[i])); i += 1
                    elif c == "Q":
                        cur = (float(toks[i + 2]), float(toks[i + 3])); i += 4
                    elif c == "C":
                        cur = (float(toks[i + 4]), float(toks[i + 5])); i += 6
                    elif c == "A":
                        cur = (float(toks[i + 5]), float(toks[i + 6])); i += 7
                    else:
                        break
                except (IndexError, ValueError):
                    break
                pts.append(cur)
            if len(pts) >= 2:
                polys.append(pts)
        return polys

    def _seg_in_rect(p, q, r, inset=5):
        rx0, ry0 = r[0] + inset, r[1] + inset
        rx1, ry1 = r[0] + r[2] - inset, r[1] + r[3] - inset
        if rx1 <= rx0 or ry1 <= ry0:
            return 0.0
        dx, dy = q[0] - p[0], q[1] - p[1]
        t0, t1 = 0.0, 1.0
        for pp, qq in ((-dx, p[0] - rx0), (dx, rx1 - p[0]),
                       (-dy, p[1] - ry0), (dy, ry1 - p[1])):
            if pp == 0:
                if qq < 0:
                    return 0.0
            else:
                t = qq / pp
                if pp < 0:
                    if t > t1:
                        return 0.0
                    t0 = max(t0, t)
                else:
                    if t < t0:
                        return 0.0
                    t1 = min(t1, t)
        return math.hypot(dx, dy) * (t1 - t0) if t1 > t0 else 0.0

    arrow_polys = _arrow_polys()
    seen_through = set()
    for poly in arrow_polys:
        for kk in range(len(poly) - 1):
            for nb in node_rects:
                if _seg_in_rect(poly[kk], poly[kk + 1], nb) > 10:
                    key = (round(nb[0]), round(nb[1]))
                    if key not in seen_through:
                        seen_through.add(key)
                        issues.append(("ARROW-THROUGH-BOX",
                                       f'arrow segment crosses box '
                                       f'[{nb[0]:.0f},{nb[1]:.0f},'
                                       f'{nb[2]:.0f},{nb[3]:.0f}]'))

    # 8b) arrow endpoint buried in a box: a connector must START and END on a
    #     box edge. An endpoint strictly INSIDE some box means the head (or
    #     tail) lands on a foreign element — e.g. an arrow into a frame top
    #     landing on the frame's title chip.
    def _strictly_inside(pt, r, inset=3.0):
        return (r[0] + inset < pt[0] < r[0] + r[2] - inset
                and r[1] + inset < pt[1] < r[1] + r[3] - inset)

    seen_buried = set()
    for poly in arrow_polys:
        for pt, which in ((poly[0], "start"), (poly[-1], "end")):
            for nb in node_rects:
                if _strictly_inside(pt, nb):
                    key = (which, round(pt[0]), round(pt[1]))
                    if key not in seen_buried:
                        seen_buried.add(key)
                        issues.append(("ARROWHEAD-IN-BOX",
                                       f'arrow {which}point ({pt[0]:.0f},'
                                       f'{pt[1]:.0f}) buried in box '
                                       f'[{nb[0]:.0f},{nb[1]:.0f},'
                                       f'{nb[2]:.0f},{nb[3]:.0f}] — land on '
                                       f'the edge, not inside'))
                    break

    # 8c) plain separator/divider line crossing a box: markerless lines are
    #     not arrows, but one that PARTIALLY crosses a node (enters and
    #     exits) strikes through its content — e.g. a dashed boundary line
    #     running through a frame's title chip. Lines fully inside a box
    #     (card dividers, legend samples) are intentional and skipped.
    seen_strike = set()
    for tag in re.finditer(r'<line\b([^>]*)/?>', svg):
        a = tag.group(1)
        if "marker" in a:
            continue
        def gv(k):
            mm = re.search(rf'\b{k}="([\-\d.]+)"', a)
            return float(mm.group(1)) if mm else 0.0
        p, q = (gv("x1"), gv("y1")), (gv("x2"), gv("y2"))
        seg_len = math.hypot(q[0] - p[0], q[1] - p[1])
        if seg_len < 20:
            continue
        for nb in node_rects:
            # A line whose two ends sit on the outline divides that box —
            # a quadrant's axes, a card's rule, a chart's baseline. It is
            # only a strike when the line arrives from outside and leaves
            # again, which is what the length test below asks.
            def _on_outline(pt, r, tol=3.0):
                return (r[0] - tol <= pt[0] <= r[0] + r[2] + tol
                        and r[1] - tol <= pt[1] <= r[1] + r[3] + tol
                        and min(abs(pt[0] - r[0]), abs(pt[0] - r[0] - r[2]),
                                abs(pt[1] - r[1]),
                                abs(pt[1] - r[1] - r[3])) <= tol)
            if _on_outline(p, nb) and _on_outline(q, nb):
                continue
            inside = _seg_in_rect(p, q, nb, inset=4)
            if inside > 12 and inside < seg_len - 2:
                key = (round(nb[0]), round(nb[1]))
                if key not in seen_strike:
                    seen_strike.add(key)
                    issues.append(("LINE-THROUGH-BOX",
                                   f'plain line strikes through box '
                                   f'[{nb[0]:.0f},{nb[1]:.0f},{nb[2]:.0f},'
                                   f'{nb[3]:.0f}] — split the line around '
                                   f'it or move it'))
                break

    # 9) connector grammar — the six mandatory rules of the diagram-design
    #    skill, ported. Two were already here under other names: transit
    #    behind a non-endpoint box is ARROW-THROUGH-BOX (8) and a label mask
    #    landing on a later node is LABEL-OCCLUSION (7b). That rule's
    #    dashed-transit exemption is deliberately NOT ported — it exists for
    #    the case where rerouting is geometrically impossible, and as a
    #    blanket exemption it would wave through ordinary routing errors.
    #
    #    The remaining four are below. Each is invisible to the checks above
    #    and each is a defect the reader meets before they read a single
    #    label: a slanted elbow, two lines a reader cannot tell apart, two
    #    arrows entering a box at one point, a mask erasing somebody else's
    #    line.
    def _arrow_segments():
        """Per-segment view of every arrowed connector.

        Yields (cid, kind, p, q). `kind` is "line" for L/H/V and "arc" for
        the chord of a Q/C corner. Keeping them apart is the whole point: a
        quarter-arc's chord is diagonal by construction, so a diagonal test
        that cannot see the difference reports every rounded corner in the
        drawing and is switched off within a day.
        """
        out = []
        cid = 0
        for tag in re.finditer(r'<line\b([^>]*)/?>', svg):
            a = tag.group(1)
            if "marker" not in a:
                continue
            def gv(k):
                mm = re.search(rf'\b{k}="([\-\d.]+)"', a)
                return float(mm.group(1)) if mm else 0.0
            out.append((cid, "line", (gv("x1"), gv("y1")),
                        (gv("x2"), gv("y2"))))
            cid += 1
        for tag in re.finditer(r'<path\b([^>]*)/?>', svg):
            a = tag.group(1)
            if "marker" not in a:
                continue
            dm = re.search(r'\bd="([^"]+)"', a)
            if not dm:
                continue
            toks = re.findall(r'[MLHVQCSTAZ]|-?[\d.]+', dm.group(1))
            i = 0
            cur = (0.0, 0.0)
            started = False
            while i < len(toks):
                c = toks[i]; i += 1
                try:
                    if c == "M":
                        cur = (float(toks[i]), float(toks[i + 1])); i += 2
                        if started:
                            cid += 1          # a new subpath is a new line
                        started = True
                        continue
                    if c == "L":
                        nxt = (float(toks[i]), float(toks[i + 1])); i += 2
                        kind = "line"
                    elif c == "H":
                        nxt = (float(toks[i]), cur[1]); i += 1
                        kind = "line"
                    elif c == "V":
                        nxt = (cur[0], float(toks[i])); i += 1
                        kind = "line"
                    elif c == "Q":
                        nxt = (float(toks[i + 2]), float(toks[i + 3])); i += 4
                        kind = "arc"
                    elif c == "C":
                        nxt = (float(toks[i + 4]), float(toks[i + 5])); i += 6
                        kind = "arc"
                    elif c == "A":
                        # Seven arguments, and only the last two are a point.
                        # Omitting this case did not mis-read an arc — it made
                        # the parser stop at the first one, so every check
                        # built on these segments went blind to a ring, a
                        # self-loop and everything drawn after them.
                        nxt = (float(toks[i + 5]), float(toks[i + 6])); i += 7
                        kind = "arc"
                    else:
                        break
                except (IndexError, ValueError):
                    break
                out.append((cid, kind, cur, nxt))
                cur = nxt
            cid += 1
        return out

    segs = _arrow_segments()
    _conn_ends = {}
    for _cid, _k, _p, _q in segs:
        e = _conn_ends.setdefault(_cid, [_p, _q])
        e[1] = _q

    # 9a) rule 1 — orthogonal routing. A connector between two boxes that
    #     share neither x nor y turns with a right angle; a slanted run
    #     between them reads as a sketch. The final segment is already
    #     OBLIQUE-ARROW above; this covers every segment before it.
    _diag = set()
    for cid, kind, p, q in segs:
        dx, dy = q[0] - p[0], q[1] - p[1]
        if kind == "line" and abs(dx) > 1.5 and abs(dy) > 1.5:
            if cid not in _diag:
                _diag.add(cid)
                issues.append(("DIAGONAL-SEGMENT",
                               f'segment ({p[0]:.0f},{p[1]:.0f})→'
                               f'({q[0]:.0f},{q[1]:.0f}) is neither '
                               f'horizontal nor vertical — turn the corner '
                               f'with a quarter-arc instead'))
        elif kind == "arc" and math.hypot(dx, dy) > 28:
            # A self-transition leaves a state and returns to it; the only
            # shape that can do that is a curve, so the rule against freehand
            # curves does not apply to one. Its two ends sit close together,
            # which is what identifies it.
            _ends = _conn_ends.get(cid)
            if _ends and math.hypot(_ends[1][0] - _ends[0][0],
                                    _ends[1][1] - _ends[0][1]) < 90:
                continue
            if cid not in _diag:
                _diag.add(cid)
                issues.append(("SWEEPING-CURVE",
                               f'curve chord {math.hypot(dx, dy):.0f}px — a '
                               f'corner arc is r=6~12; this is a freehand '
                               f'curve, not an elbow'))

    # 9b) rule 4 — two connectors may not enter or leave a box at one point.
    #     Overlapping heads read as a single connection and hide how many
    #     things actually reach the box. Spread the attach points along the
    #     edge; the crowding limit relaxes on a short edge that cannot hold
    #     the full spread.
    ends = []
    for cid, _kind, p, q in segs:
        ends.append((cid, p))
        ends.append((cid, q))
    _shared = set()
    for nb in node_rects:
        nx, ny, nw, nh, _ = nb
        for side, coord, span, lo, hi in (
                ("L", nx, "y", ny, ny + nh), ("R", nx + nw, "y", ny, ny + nh),
                ("T", ny, "x", nx, nx + nw), ("B", ny + nh, "x", nx, nx + nw)):
            on = []
            for cid, pt in ends:
                v = pt[0] if span == "x" else pt[1]
                fixed = pt[0] if span == "y" else pt[1]
                if abs(fixed - coord) <= 3 and lo - 3 <= v <= hi + 3:
                    on.append((v, cid))
            on.sort()
            limit = 8 if (hi - lo) < 60 else 12
            for k in range(len(on) - 1):
                if on[k][1] == on[k + 1][1]:
                    continue          # both ends of one connector
                gap = on[k + 1][0] - on[k][0]
                if gap < limit:
                    key = (round(nx), round(ny), side)
                    if key in _shared:
                        continue
                    _shared.add(key)
                    issues.append(("SHARED-ATTACH-POINT",
                                   f'2 connectors meet box '
                                   f'[{nx:.0f},{ny:.0f}] side {side} '
                                   f'{gap:.0f}px apart (< {limit}px) — fan '
                                   f'the attach points along the edge'))

    # 9a-2) a connector running ALONG a box edge rather than across it.
    #     ARROW-THROUGH-BOX measures the length inside a box and insets by
    #     5px, so a lane laid exactly on the boundary is inside nothing and
    #     the check stays quiet. On the page the stroke and the border are one
    #     line: the box looks like it has a thick edge on one side, and the
    #     route it belongs to disappears for the whole length of that box.
    _along = set()
    for _cid, _kind, p_, q_ in segs:
        if _kind != "line":
            continue
        horiz = abs(q_[1] - p_[1]) <= 1.5
        vert = abs(q_[0] - p_[0]) <= 1.5
        if not (horiz or vert):
            continue
        for nb in node_rects:
            nx, ny, nw, nh, _d = nb
            if horiz:
                ov = (min(max(p_[0], q_[0]), nx + nw)
                      - max(min(p_[0], q_[0]), nx))
                near = min(abs(p_[1] - ny), abs(p_[1] - (ny + nh)))
            else:
                ov = (min(max(p_[1], q_[1]), ny + nh)
                      - max(min(p_[1], q_[1]), ny))
                near = min(abs(p_[0] - nx), abs(p_[0] - (nx + nw)))
            if near <= 2 and ov > 24:
                key = (round(nx), round(ny))
                if key in _along:
                    break
                _along.add(key)
                issues.append(("CONNECTOR-ON-EDGE",
                               f'a connector runs along the edge of box '
                               f'[{nx:.0f},{ny:.0f},{nw:.0f},{nh:.0f}] for '
                               f'{ov:.0f}px — the stroke and the border draw '
                               f'as one line; move the lane into the channel '
                               f'between the rows'))
                break

    # 9b-2) a connector must begin and end ON an edge. ARROWHEAD-IN-BOX (8b)
    #     catches an endpoint buried inside a box; this catches the other
    #     half — an endpoint hanging in open canvas a few pixels off the box
    #     it was meant to touch. Hand-written waypoints produce it constantly
    #     and it is invisible at page scale: the stroke simply starts a
    #     little late, and the reader reads a line that comes from nowhere.
    def _on_edge(pt, r, tol=3.0):
        x0, y0, x1, y1 = r[0], r[1], r[0] + r[2], r[1] + r[3]
        within = (x0 - tol <= pt[0] <= x1 + tol
                  and y0 - tol <= pt[1] <= y1 + tol)
        return within and min(abs(pt[0] - x0), abs(pt[0] - x1),
                              abs(pt[1] - y0), abs(pt[1] - y1)) <= tol

    _all_rects = [(r[0], r[1], r[2], r[3]) for r in rmeta]

    # A ring of arcs — a flywheel's cycle — rides a circle inside the nodes
    # and touches none of them, and that is the grammar rather than a mistake:
    # arcs drawn between the boxes say the cycle has no end, where arrows
    # touching each box say four separate steps. The test is narrow so it
    # cannot excuse an ordinary stray line — every segment of the connector
    # must be an arc, and its two ends the same distance from the centre the
    # nodes are arranged around.
    # The centre is taken from the arcs' own endpoints, not from the nodes: a
    # figure that carries a caption band or a note box has its node centroid
    # dragged well off the ring, and the equal-radius test then rejects the
    # very ring it was written for.
    _arc_only = {cid for cid in {c2 for c2, _k, _a, _b in segs}
                 if {k for c2b, k, _a2, _b2 in segs if c2b == cid} == {"arc"}}
    _ring_pts = [pt for cid, _k, a_, b_ in segs if cid in _arc_only
                 for pt in (a_, b_)]
    _hub = (sum(q[0] for q in _ring_pts) / len(_ring_pts),
            sum(q[1] for q in _ring_pts) / len(_ring_pts)) \
        if len(_ring_pts) >= 4 else None

    def _is_ring(cid, p, q):
        if _hub is None:
            return False
        if cid not in _arc_only:
            return False
        r0 = math.hypot(p[0] - _hub[0], p[1] - _hub[1])
        r1 = math.hypot(q[0] - _hub[0], q[1] - _hub[1])
        return r0 > 20 and abs(r0 - r1) <= 4

    # A box edge is the usual anchor but not the only legitimate one: a
    # sequence diagram's messages land on a lifeline, an annotation lands on
    # an axis, a bracket lands on a baseline. Those are drawn lines, so an
    # endpoint sitting on one is attached to something the reader can see.
    _anchor_lines = []
    for tag in re.finditer(r'<line\b([^>]*)/?>', svg):
        a = tag.group(1)
        def _lv(k):
            mm = re.search(rf'\b{k}="([\-\d.]+)"', a)
            return float(mm.group(1)) if mm else None
        p1, p2 = (_lv("x1"), _lv("y1")), (_lv("x2"), _lv("y2"))
        if None not in p1 + p2:
            _anchor_lines.append((p1, p2))

    def _on_line(pt, tol=3.0):
        for (ax, ay), (bx, by) in _anchor_lines:
            vx, vy = bx - ax, by - ay
            L2 = vx * vx + vy * vy
            if L2 < 1:
                continue
            t = max(0.0, min(1.0, ((pt[0] - ax) * vx + (pt[1] - ay) * vy) / L2))
            if math.hypot(pt[0] - (ax + t * vx), pt[1] - (ay + t * vy)) <= tol:
                return True
        return False

    _float = set()
    _ends_by_conn = {}
    for cid, _kind, p, q in segs:
        e = _ends_by_conn.setdefault(cid, [p, q])
        e[1] = q
    for cid, (p, q) in _ends_by_conn.items():
        if _is_ring(cid, p, q):
            continue
        for pt, which in ((p, "start"), (q, "end")):
            if any(_on_edge(pt, r) for r in _all_rects) or _on_line(pt):
                continue
            key = (round(pt[0]), round(pt[1]))
            if key in _float:
                continue
            _float.add(key)
            issues.append(("FLOATING-ENDPOINT",
                           f'connector {which}point ({pt[0]:.0f},{pt[1]:.0f}) '
                           f'touches no box edge — snap it to the edge it '
                           f'leaves from or arrives at'))

    # 9b-3) an arrowhead says a route ARRIVES here. A route drawn as several
    #     elements — a drop, a rail, a branch — puts a head on every one of
    #     them unless each segment is told not to draw one, and `line()` and
    #     `path()` draw one by default. The reader then follows a connector
    #     that arrives three times before it gets anywhere, and the source
    #     looks right because nobody wrote the word "marker" at all. The tell
    #     is geometric: a head whose tip is the endpoint of another connector
    #     that carries on from it in a different direction. Only <line>
    #     endpoints count as the continuation, so an arrow landing on a
    #     lifeline, an axis or a rail — which it crosses rather than ends at —
    #     is not this defect.
    def _path_end(d):
        """The point a path finishes at, tracking H and V properly."""
        toks = re.findall(r'[MLHVQCSTAZ]|-?[\d.]+', d)
        cur, i = None, 0
        while i < len(toks):
            c = toks[i]; i += 1
            try:
                if c in "ML":
                    cur = (float(toks[i]), float(toks[i + 1])); i += 2
                elif c == "H":
                    cur = (float(toks[i]), cur[1] if cur else 0.0); i += 1
                elif c == "V":
                    cur = (cur[0] if cur else 0.0, float(toks[i])); i += 1
                elif c == "Q":
                    cur = (float(toks[i + 2]), float(toks[i + 3])); i += 4
                elif c == "C":
                    cur = (float(toks[i + 4]), float(toks[i + 5])); i += 6
                elif c == "A":
                    cur = (float(toks[i + 5]), float(toks[i + 6])); i += 7
                else:
                    break
            except (IndexError, ValueError, TypeError):
                return None
        return cur

    _heads = []
    for tag in re.finditer(r'<path\b([^>]*)/?>', svg):
        a = tag.group(1)
        if "marker-end" not in a:
            continue
        dm = re.search(r'\bd="([^"]+)"', a)
        if not dm:
            continue
        end_, t_ = _path_end(dm.group(1)), last_tangent(dm.group(1))
        if end_ and t_:
            _heads.append((end_, t_))

    _seg_ends = []
    for tag in re.finditer(r'<line\b([^>]*)/?>', svg):
        a = tag.group(1)

        def _lp(k, a=a):
            mm = re.search(rf'\b{k}="([\-\d.]+)"', a)
            return float(mm.group(1)) if mm else None
        p_, q_ = (_lp("x1"), _lp("y1")), (_lp("x2"), _lp("y2"))
        if None in p_ + q_:
            continue
        _seg_ends.append((p_, (q_[0] - p_[0], q_[1] - p_[1])))
        _seg_ends.append((q_, (p_[0] - q_[0], p_[1] - q_[1])))
        if "marker-end" in a:
            _heads.append((q_, (q_[0] - p_[0], q_[1] - p_[1])))

    _bend = set()
    for tip, d in _heads:
        dn = math.hypot(*d)
        if dn < 1 or any(_on_edge(tip, r) for r in _all_rects):
            continue
        for end, u in _seg_ends:
            if math.hypot(end[0] - tip[0], end[1] - tip[1]) > 2.5:
                continue
            un = math.hypot(*u)
            # The arrowed line's own far end doubles straight back along
            # itself; anything else leaving this point carries the route on.
            if un < 1 or (d[0] * u[0] + d[1] * u[1]) / (dn * un) < -0.9:
                continue
            key = (round(tip[0]), round(tip[1]))
            if key in _bend:
                break
            _bend.add(key)
            issues.append(("ARROWHEAD-AT-BEND",
                           f'arrowhead at ({tip[0]:.0f},{tip[1]:.0f}) sits on '
                           f'a corner the route carries on from — draw the '
                           f'head on the final segment only and pass '
                           f'marker=None on the rest'))
            break

    # 9c) rule 3 — no two connectors run on top of each other. Parallel and
    #     close reads as one thick line, and the reader cannot follow either
    #     to its end. Only runs that actually overlap along their shared axis
    #     count; two lines that merely share a coordinate while sitting in
    #     different halves of the drawing are not a defect.
    _pairs = 0
    for i in range(len(segs)):
        if _pairs >= 6:
            break
        ci, ki, pi, qi = segs[i]
        if ki != "line":
            continue
        hi_, vi = abs(qi[1] - pi[1]) <= 1.5, abs(qi[0] - pi[0]) <= 1.5
        if not (hi_ or vi):
            continue
        for j in range(i + 1, len(segs)):
            cj, kj, pj, qj = segs[j]
            if kj != "line" or cj == ci:
                continue
            hj, vj = abs(qj[1] - pj[1]) <= 1.5, abs(qj[0] - pj[0]) <= 1.5
            if hi_ and hj:
                sep = abs(pi[1] - pj[1])
                ov = (min(max(pi[0], qi[0]), max(pj[0], qj[0]))
                      - max(min(pi[0], qi[0]), min(pj[0], qj[0])))
            elif vi and vj:
                sep = abs(pi[0] - pj[0])
                ov = (min(max(pi[1], qi[1]), max(pj[1], qj[1]))
                      - max(min(pi[1], qi[1]), min(pj[1], qj[1])))
            else:
                continue
            if sep < 12 and ov > 24:
                issues.append(("PARALLEL-CONNECTORS",
                               f'two connectors run {sep:.0f}px apart for '
                               f'{ov:.0f}px near ({pi[0]:.0f},{pi[1]:.0f}) '
                               f'— offset one by 12px or more'))
                _pairs += 1
                break

    # 9d) rule 2 — a label mask erases the line behind its glyphs, which is
    #     what it is for. Two placements break that bargain. A mask over a
    #     bend or an endpoint deletes the information the reader needs to
    #     follow the route, and a mask covering runs of two different
    #     connectors erases somebody else's line while labelling its own.
    def _pt_in(m, pt, inset=1.0):
        return (m[0] + inset <= pt[0] <= m[0] + m[2] - inset
                and m[1] + inset <= pt[1] <= m[1] + m[3] - inset)

    def _turns(k):
        """Does the connector actually change direction at segs[k]'s end?

        A router that emits a fixed corner template writes a vertex even
        where the path runs straight through — `V 170 Q 628,160 628,150`
        bends by nothing. Counting those as corners reports a label sitting
        in the middle of a long straight run, which is exactly where a label
        belongs, so the test is the direction change and not the vertex.
        """
        _c, _k, p, q = segs[k]
        if k + 1 >= len(segs) or segs[k + 1][0] != _c:
            return True                      # end of the connector: the head
        _, _, p2, q2 = segs[k + 1]
        ax, ay = q[0] - p[0], q[1] - p[1]
        bx, by = q2[0] - p2[0], q2[1] - p2[1]
        return abs(ax * by - ay * bx) > 1.0

    for m in label_masks:
        vert_hit = None
        head_hit = None
        touching = set()
        for k, (cid, kind, p, q) in enumerate(segs):
            if _seg_in_rect(p, q, (m[0], m[1], m[2], m[3]), inset=0) > 1:
                touching.add(cid)
            if kind == "line" and _pt_in(m, q) and _turns(k):
                # q is a bend when the route turns there and the arrowhead
                # when nothing follows; both are load-bearing.
                vert_hit = vert_hit or q
            # The arrowhead is not the endpoint alone: the marker triangle
            # runs ~10px back along the final segment, so a pill that spares
            # the tip can still swallow the body — the head then reads as a
            # bare line ending under the label. Probe the marker body's
            # midpoint; the tip-covered case is already the corner check's.
            if (kind == "line" and not _pt_in(m, q)
                    and (k + 1 >= len(segs) or segs[k + 1][0] != cid)):
                seg_len = math.hypot(q[0] - p[0], q[1] - p[1])
                if seg_len > 0.5:
                    body = (q[0] - (q[0] - p[0]) / seg_len * 10.0,
                            q[1] - (q[1] - p[1]) / seg_len * 10.0)
                    if _pt_in(m, body):
                        head_hit = head_hit or q
        # A mask may erase the run of stroke behind its own glyphs — that is
        # what it is for. It may not erase the connector. Where the gap
        # between two boxes is narrower than the label, the mask swallows the
        # whole line and what survives is an arrowhead floating in a gutter:
        # the reader sees a label and a head and has to guess what they join.
        if len(touching) == 1:
            cid = next(iter(touching))
            total = sum(math.hypot(q_[0] - p_[0], q_[1] - p_[1])
                        for c2, _k, p_, q_ in segs if c2 == cid)
            hidden = sum(_seg_in_rect(p_, q_, (m[0], m[1], m[2], m[3]),
                                      inset=0)
                         for c2, _k, p_, q_ in segs if c2 == cid)
            if total > 0 and (hidden > 0.5 * total or total - hidden < 24):
                issues.append(("LABEL-HIDES-CONNECTOR",
                               f'label mask [{m[0]:.0f},{m[1]:.0f}] covers '
                               f'{hidden:.0f}px of a {total:.0f}px connector '
                               f'— only {total - hidden:.0f}px of stroke is '
                               f'left; move the label off the line into the '
                               f'open band beside it'))
                continue
        if not vert_hit and head_hit:
            issues.append(("LABEL-HIDES-ARROWHEAD",
                           f'label mask [{m[0]:.0f},{m[1]:.0f}] covers the '
                           f'arrowhead body at ({head_hit[0]:.0f},'
                           f'{head_hit[1]:.0f}) — the head renders clipped '
                           f'or vanishes; slide the label 10px+ away from '
                           f'the endpoint along the run'))
            continue
        if vert_hit:
            issues.append(("LABEL-MASKS-CORNER",
                           f'label mask [{m[0]:.0f},{m[1]:.0f}] covers a '
                           f'connector corner/endpoint '
                           f'({vert_hit[0]:.0f},{vert_hit[1]:.0f}) — move '
                           f'the label onto a straight run'))
        elif len(touching) > 1:
            issues.append(("MASK-OVER-OTHER-CONNECTOR",
                           f'label mask [{m[0]:.0f},{m[1]:.0f}] erases '
                           f'{len(touching)} different connectors — it may '
                           f'only cover the one it labels'))

    # 9e) an empty band between two stacked boxes. Distance between boxes is
    #     not itself a defect — a routing channel, a lane of edge labels or a
    #     zone border all need room. What is a defect is distance with
    #     nothing in it: the reader crosses a hand's width of blank paper and
    #     arrives at the next box having learned nothing, and every figure on
    #     the page is shrunk to make space for it.
    #
    #     So the test is occupancy, not size. A vertical connector passing
    #     straight through does not count as an occupant — that is exactly
    #     the shape the defect takes — but a horizontal run, a label or
    #     another box does.
    # h >= 48 excludes the legend strip and any key or caption bar. Those
    # are not nodes: a legend sits wherever there is room, so the space
    # above it is the figure's bottom margin rather than a gap in a
    # stack, and counting it reported the two figures whose last row
    # happens to be narrower than their legend.
    _stack = [r for r in node_rects if r[3] >= 48 and r[2] >= 60]
    _seen_gap = set()
    for a in _stack:
        below = []
        for b in _stack:
            if b is a:
                continue
            ov = min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0])
            if ov < 0.5 * min(a[2], b[2]) or b[1] <= a[1] + a[3]:
                continue
            below.append(b)
        if not below:
            continue
        b = min(below, key=lambda r: r[1])
        gap = b[1] - (a[1] + a[3])
        # The band that counts as empty scales with the board: 96px on a
        # 1200-unit canvas, 48 on a 520-unit column figure, where the same
        # 96px is a fifth of the width.
        if gap <= max(48.0, 0.08 * W):
            continue
        bx0, bx1 = max(a[0], b[0]), min(a[0] + a[2], b[0] + b[2])
        by0, by1 = a[1] + a[3], b[1]

        def _in_band(x, y, pad=0):
            return bx0 - pad <= x <= bx1 + pad and by0 <= y <= by1

        busy = any(_in_band(tx, ty) for (tx, ty, _t) in texts_xy)
        if not busy:
            # a section heading crossing the band is a row of the figure,
            # not blank paper, wherever its letters start
            busy = any(by0 <= ty <= by1 and (y1 - y0) / 1.02 >= 19
                       for (_tx, ty, _x0, y0, _x1, y1, _t) in texts_full)
        if not busy:
            # a box of the same size that ends inside the band is the same
            # row set at another height — a stair, a ladder — so the air
            # under the higher step is the stair's shape, not a gap
            busy = any(o is not a and abs(o[2] - a[2]) <= 2
                       and abs(o[3] - a[3]) <= 2
                       and by0 < o[1] + o[3] <= by1 for o in _stack)
        if not busy:
            for r in rmeta:
                if (min(r[0] + r[2], bx1) - max(r[0], bx0) > 8
                        and min(r[1] + r[3], by1) - max(r[1], by0) > 8):
                    busy = True
                    break
        if not busy:
            band = (bx0, by0, bx1 - bx0, by1 - by0)
            for _cid, _kind, p_, q_ in segs:
                # Measure the length actually inside the band rather than the
                # span of its x-range: a ring's arc clips a corner of the
                # band, and an x-range test reads that as barely touching.
                #
                # Anything but a plain vertical drop is using the band — a
                # horizontal lane, an elbow's leg, an arc. The drop is the one
                # shape that crosses without occupying, which is exactly the
                # shape this check is looking for.
                if (abs(q_[0] - p_[0]) > 12
                        and _seg_in_rect(p_, q_, band, inset=0) > 12):
                    busy = True
                    break
        if busy:
            continue
        key = (round(a[0]), round(a[1] + a[3]))
        if key in _seen_gap:
            continue
        _seen_gap.add(key)
        issues.append(("EMPTY-STACK-GAP",
                       f'{gap:.0f}px of empty band between box '
                       f'[{a[0]:.0f},{a[1]:.0f}] and [{b[0]:.0f},{b[1]:.0f}] '
                       f'— nothing is drawn in it; close the gap or put the '
                       f'routing and its labels there'))

    # 11) interior geometry — the checks above ask whether the picture is
    #     well-formed; these ask whether it is tight and whether its parts
    #     group the way the reader will group them. Every one names something
    #     a reader takes as carelessness before reading a single label: a row
    #     of cards leaving a hand's width of paper under their text, a header
    #     drawn as a chip resting on its card, a label sitting on a line, two
    #     labels that read as one heading.
    issues.extend(_interior_checks(svg, W, H, rmeta, solids, containers,
                                   node_rects, mask_keys, texts_full,
                                   texts_xy, contains, same_rect))

    # 10) margins on all four sides. The board's dimensions decide how much
    #     page the figure reserves once it is placed at a fixed width, so a
    #     band of empty board is a band of empty page and nothing in the
    #     drawing grows to fill it. The opposite fails differently: ink that
    #     runs to the board edge has its stroke halved by the viewBox, and
    #     once the figure is scaled down onto the page that half-pixel lands
    #     in the text margin. The intended margin here is 24px.
    #
    #     Measure ink from the body only — <defs> holds marker artwork whose
    #     coordinates are a few pixels from the origin and have nothing to do
    #     with the canvas. Reading them puts the top-left of every drawing at
    #     (0,1) and quietly disables both halves of this check.
    _body = re.sub(r'<defs\b.*?</defs>', '', svg, flags=re.S)
    _ink_x, _ink_y = [], []
    for m in re.finditer(r'<rect\b([^>]*)/?>', _body):
        a = m.group(1)
        def _g(k):
            mm = re.search(rf'\b{k}="([\-\d.]+)"', a)
            return float(mm.group(1)) if mm else None
        rx, ry, rw, rh = _g("x"), _g("y"), _g("width"), _g("height")
        if None in (rx, ry, rw, rh):
            continue
        if rw >= 0.95 * W and rh >= 0.95 * H:
            continue                      # canvas wash, not content
        _ink_x += [rx, rx + rw]
        _ink_y += [ry, ry + rh]
    for a, txt in _iter_texts(_body):
        def _g(k, d=None):
            mm = re.search(rf'\b{k}="([\-\d.]+)"', a)
            return float(mm.group(1)) if mm else d
        tx, ty, tsize = _g("x"), _g("y"), _g("font-size", 13)
        if tx is None or ty is None:
            continue
        anch = (re.search(r'text-anchor="(\w+)"', a) or [None, "start"])[1]
        tw3 = _text_w(txt, tsize, False)
        _ink_x += ([tx - tw3 / 2, tx + tw3 / 2] if anch == "middle"
                   else [tx - tw3, tx] if anch == "end" else [tx, tx + tw3])
        _ink_y += [ty - tsize * 0.78, ty + tsize * 0.24]
    for tag in re.finditer(r'<(?:line|path)\b([^>]*)/?>', _body):
        a = tag.group(1)
        for k in ("x1", "x2", "y1", "y2"):
            mm = re.search(rf'\b{k}="([\-\d.]+)"', a)
            if mm:
                (_ink_x if k[0] == "x" else _ink_y).append(float(mm.group(1)))
        dm = re.search(r'\bd="([^"]+)"', a)
        if dm:
            # Command-aware, for the same reason svgkit.path_points is: an
            # arc's radii and flags are not positions, and reading them as
            # coordinates puts every drawing's corner at the origin.
            for _px, _py in _path_points(dm.group(1)):
                _ink_x.append(_px)
                _ink_y.append(_py)
    if _ink_x and _ink_y:
        # 8, not 12: a frame's title chip legitimately rides its top
        # border, which puts 9px of the chip above a frame drawn at the
        # standard y=24. The floor is about a stroke surviving the
        # viewBox, and 8px clears that.
        MARGIN_MIN, MARGIN_MAX = 8, 40
        for gap, side, size in ((min(_ink_y), "top", H),
                                (H - max(_ink_y), "bottom", H),
                                (min(_ink_x), "left", W),
                                (W - max(_ink_x), "right", W)):
            if gap > MARGIN_MAX:
                issues.append(("DEAD-MARGIN",
                               f'{gap:.0f}px of empty board at the {side} '
                               f'(the margin is 24px) — shrink the board to '
                               f'{size - gap + 24:.0f}, or spread the content '
                               f'so it fills the width it was given'))
            elif gap < MARGIN_MIN:
                issues.append(("TIGHT-MARGIN",
                               f'only {gap:.0f}px between the ink and the '
                               f'{side} edge (the margin is 24px) — the '
                               f'stroke is clipped by the viewBox and what '
                               f'survives lands in the page margin'))

    print(f"=== lint {os.path.basename(svg_path)} ({W:.0f}x{H:.0f}) ===")
    if not issues:
        print("  ✔ no static issues")
    for kind, msg in issues:
        print(f"  ✖ {kind}: {msg}")
    return issues


def _interior_checks(svg, W, H, rmeta, solids, containers, node_rects,
                     mask_keys, texts_full, texts_xy, contains, same_rect):
    """Padding, row and stack uniformity, frame padding, band corners, labels
    lying on lines, and label grouping — the defects of a picture that is
    well-formed but loose. Returns (kind, message) pairs.

    Everything here reads geometry the generator already emitted, so a
    finding is a measurement and its message carries the number to cut.
    Tolerances are in canvas units on a 1200-unit board; a reader cannot see
    a 3px difference in row height but sees 10px of extra air at once.
    """
    out = []
    TOL = 1.5                        # "coincides with" for edges
    PAD_UNEVEN = 12                  # air above vs below content
    FRAME_UNEVEN = 10                # a frame's four insets
    FRAME_LOOSE = 28                 # smallest inset a frame may have
    SIDE_PAD = 16                    # the standard inner side padding
    WRAP_ALLOW = 0.93                # estimator allowance a wrap width keeps

    # -- every rect with its style, in document order -----------------------
    rinfo = []
    for m in re.finditer(r'<rect\b([^>]*)/?>', svg):
        a = m.group(1)

        def _v(k, a=a):
            mm = re.search(rf'\b{k}="([\-\d.]+)"', a)
            return float(mm.group(1)) if mm else None
        x, y, w, h = _v("x"), _v("y"), _v("width"), _v("height")
        if None in (x, y, w, h) or w <= 0 or h <= 0:
            continue
        fill = (re.search(r'\bfill="([^"]+)"', a) or [None, "none"])[1]
        stroke = (re.search(r'\bstroke="([^"]+)"', a) or [None, "none"])[1]
        op = _v("opacity")
        rinfo.append({"pos": m.start(), "x": x, "y": y, "w": w, "h": h,
                      "rx": _v("rx") or 0.0, "fill": fill.lower(),
                      "stroke": stroke.lower(),
                      "op": 1.0 if op is None else op,
                      "dashed": "stroke-dasharray" in a,
                      "canvas": w >= 0.95 * W and h >= 0.95 * H})
    bg_m = re.search(r'<stop\b[^>]*offset="0"[^>]*stop-color="([^"]+)"', svg)
    bg_colors = {bg_m.group(1).lower()} if bg_m else set()
    for r in rinfo:
        if r["canvas"] and not r["fill"].startswith("url("):
            bg_colors.add(r["fill"])

    def _key(r):
        return (round(r["x"]), round(r["y"]), round(r["w"]), round(r["h"]))

    container_keys = {(round(r[0]), round(r[1]), round(r[2]), round(r[3]))
                      for r in solids if id(r) in containers}

    def _box(r):
        return (r["x"], r["y"], r["w"], r["h"])

    def _visible(r):
        return (r["stroke"] != "none"
                or (r["fill"] not in ("none", "transparent")
                    and not r["fill"].startswith("url(")
                    and r["fill"] not in bg_colors))

    # -- closed paths that trace an axis-aligned rectangle ------------------
    #    A boundary drawn as a path (so the connectors inside it are not read
    #    as crossing a box) and a header band are both rectangles to the
    #    reader, so the frame and band checks have to see them.
    rpaths = []
    for m in re.finditer(r'<path\b([^>]*)/?>', svg):
        a = m.group(1)
        dm = re.search(r'\bd="([^"]+)"', a)
        if not dm or "marker" in a:
            continue
        d = dm.group(1)
        letters = set(re.findall(r'[A-Za-z]', d))
        if "Z" not in letters or not letters <= set("MLHVAZ"):
            continue
        pts = _path_points(d)
        if len(pts) < 4:
            continue
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        if x1 - x0 < 4 or y1 - y0 < 4:
            continue                      # a 6px stripe is still a band
        if not all(min(abs(px - x0), abs(px - x1)) <= 0.5
                   or min(abs(py - y0), abs(py - y1)) <= 0.5
                   for px, py in pts):
            continue
        fill = (re.search(r'\bfill="([^"]+)"', a) or [None, "none"])[1]
        stroke = (re.search(r'\bstroke="([^"]+)"', a) or [None, "none"])[1]
        op = re.search(r'\bopacity="([\d.]+)"', a)
        rpaths.append({"pos": m.start(), "x": x0, "y": y0, "w": x1 - x0,
                       "h": y1 - y0, "rx": 0.0, "fill": fill.lower(),
                       "stroke": stroke.lower(),
                       "op": float(op.group(1)) if op else 1.0,
                       "dashed": "stroke-dasharray" in a, "canvas": False,
                       "measured": "data-measure=" in a})

    # -- texts as records ---------------------------------------------------
    T = []
    texts_style = []                      # (fill, weight), one per texts_full
    for a, _txt in _iter_texts(svg):
        if not (re.search(r'\bx="([\-\d.]+)"', a)
                and re.search(r'\by="([\-\d.]+)"', a)):
            continue                      # texts_full skipped it too
        texts_style.append((
            (re.search(r'\bfill="([^"]+)"', a) or [None, ""])[1].lower(),
            (re.search(r'font-weight="(\w+)"', a) or [None, "400"])[1]))
    for (tx, ty, x0, y0, x1, y1, txt), (fill, weight) in zip(texts_full,
                                                            texts_style):
        size = (y1 - y0) / 1.02
        anchor = ("middle" if abs((x0 + x1) / 2 - tx) < 0.6
                  else "end" if abs(x1 - tx) < 0.6 else "start")
        T.append({"x": tx, "y": ty, "x0": x0, "y0": y0, "x1": x1, "y1": y1,
                  "txt": txt, "size": size, "anchor": anchor, "fill": fill,
                  "weight": weight})

    # -- small ink: dots, icons, polylines --------------------------------
    small = []
    for m in re.finditer(r'<circle\b([^>]*)/?>', svg):
        a = m.group(1)

        def _cv(k, a=a):
            mm = re.search(rf'\b{k}="([\-\d.]+)"', a)
            return float(mm.group(1)) if mm else None
        cx, cy, cr = _cv("cx"), _cv("cy"), _cv("r")
        if None in (cx, cy, cr) or cr > 14:
            continue
        small.append((cx - cr, cy - cr, cx + cr, cy + cr))
    for m in re.finditer(r'<(?:path|polyline|polygon)\b([^>]*)/?>', svg):
        a = m.group(1)
        if "marker" in a or 'stroke="none"' in a or "stroke=" not in a:
            continue
        pts = []
        dm = re.search(r'\bd="([^"]+)"', a)
        if dm:
            if set(re.findall(r'[A-Za-z]', dm.group(1))) & set(
                    "mlhvqcsta"):
                continue                  # relative commands: not measurable
            pts = _path_points(dm.group(1))
        pm = re.search(r'\bpoints="([^"]+)"', a)
        if pm:
            pts = [(float(px), float(py)) for px, py in
                   re.findall(r'(-?[\d.]+)[ ,](-?[\d.]+)', pm.group(1))]
        if len(pts) < 2:
            continue
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        if max(xs) - min(xs) <= 34 and max(ys) - min(ys) <= 34:
            small.append((min(xs), min(ys), max(xs), max(ys)))

    def _inside(bb, box, tol=1.0):
        x, y, w, h = box
        return (bb[0] >= x - tol and bb[1] >= y - tol
                and bb[2] <= x + w + tol and bb[3] <= y + h + tol)

    def _touches_edge(r, box, tol=TOL):
        x, y, w, h = box
        return (abs(r["x"] - x) <= tol or abs(r["y"] - y) <= tol
                or abs(r["x"] + r["w"] - x - w) <= tol
                or abs(r["y"] + r["h"] - y - h) <= tol)

    def _contents(box, own_pos=None):
        """Bounding boxes of what sits inside `box`: texts anchored in it,
        rects fully inside that are content rather than a band or a second
        edge, dots and icons. Connectors are not content — they start and
        end on the edges."""
        x, y, w, h = box
        cont = []
        for t in T:
            if x <= t["x"] <= x + w and y <= t["y"] <= y + h \
                    and _inside((t["x0"], t["y0"], t["x1"], t["y1"]), box, 3):
                cont.append((t["x0"], t["y0"], t["x1"], t["y1"]))
        for r in rinfo + rpaths:
            if r["canvas"] or r["pos"] == own_pos:
                continue
            rb = (r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"])
            if not _inside(rb, box, TOL):
                continue
            if all(abs(v) <= 3 for v in (r["x"] - x, r["y"] - y,
                                         r["w"] - w, r["h"] - h)):
                continue                  # the box's own mask or wash
            if _touches_edge(r, box):
                continue                  # a band, a tab, a stripe
            cont.append(rb)
        for bb in small:
            if _inside(bb, box, 0.5):
                cont.append(bb)
        return cont

    def _band_bottom(box, own_pos=None):
        """The lower edge of a header band on the box's top edge, if any: a
        rect or rect-like path that starts on the top edge, spans the box's
        width and stops well above its bottom. The title inside a band is
        the band's content, so the box's own top inset is measured from
        under the band."""
        x, y, w, h = box
        best = None
        for r in rinfo + rpaths:
            if r["canvas"] or r["pos"] == own_pos:
                continue
            if (abs(r["y"] - y) <= 1.5 and abs(r["x"] - x) <= 1.5
                    and abs(r["w"] - w) <= 3 and 8 < r["h"] < h * 0.6):
                best = max(best or 0, r["y"] + r["h"])
        return best

    def _pads(box, cont, own_pos=None):
        x, y, w, h = box
        band = _band_bottom(box, own_pos)
        top = y
        below = [c for c in cont if band is None or c[1] >= band - 1]
        if band is not None and below:
            top, cont_top = band, below
        else:
            cont_top = cont
        return (min(c[0] for c in cont) - x,
                x + w - max(c[2] for c in cont),
                min(c[1] for c in cont_top) - top,
                y + h - max(c[3] for c in cont))

    # -- the boxes whose interior is judged --------------------------------
    node_keys = {(round(r[0]), round(r[1]), round(r[2]), round(r[3]))
                 for r in node_rects}

    def _is_ring(r):
        """A rect inset by one even margin inside another rect is that box's
        second outline — a terminal state, an emphasised card — and is judged
        as part of it, never as a box of its own."""
        for o in rinfo:
            if o is r or o["canvas"]:
                continue
            d = r["x"] - o["x"]
            if 1.5 <= d <= 10 and abs((r["y"] - o["y"]) - d) <= 1 \
                    and abs((o["w"] - r["w"]) - 2 * d) <= 1.5 \
                    and abs((o["h"] - r["h"]) - 2 * d) <= 1.5:
                return True
        return False

    ring_keys = {_key(r) for r in rinfo if not r["canvas"] and _is_ring(r)}
    pad_boxes, seen_fp = [], set()
    for r in rinfo:
        if r["canvas"] or r["dashed"] or r["h"] < 30 or r["w"] < 60:
            continue
        k = _key(r)
        if k in mask_keys or k in container_keys or k in seen_fp \
                or k in ring_keys:
            continue
        if k not in node_keys:
            # a tinted band or wash: judged only when it carries text of its
            # own and is not the paper under an outlined box
            if not any(r["x"] <= t["x"] <= r["x"] + r["w"]
                       and r["y"] <= t["y"] <= r["y"] + r["h"] for t in T):
                continue
            if any(_key(o) == k and o is not r for o in rinfo):
                continue
        seen_fp.add(k)
        pad_boxes.append(r)

    # 11a) air above versus below the content. A box is sized once and its
    #      text ends where it ends; when every card in a row ends 30px above
    #      its bottom edge the row is 30px too tall, and the page below it
    #      is 30px shorter for nothing.
    rows = []
    for r in pad_boxes:
        for grp in rows:
            g = grp[0]
            if (abs(g["y"] - r["y"]) <= 2 and abs(g["h"] - r["h"]) <= 2
                    and all(r["x"] >= o["x"] + o["w"] - 1
                            or r["x"] + r["w"] <= o["x"] + 1 for o in grp)):
                grp.append(r)
                break
        else:
            rows.append([r])
    for grp in rows:
        measured = []
        for r in grp:
            cont = _contents(_box(r), r["pos"])
            if cont:
                measured.append((r, _pads(_box(r), cont, r["pos"])))
        if not measured:
            continue
        if len(measured) >= 2:
            excess = [b - t for _r, (_l, _rr, t, b) in measured]
            lo, hi = min(excess), max(excess)
            r0 = measured[0][0]
            if lo > PAD_UNEVEN:
                out.append(("ROW-PADDING-UNEVEN",
                            f'every box in the row at y={r0["y"]:.0f} '
                            f'(h={r0["h"]:.0f}, {len(measured)} boxes) has '
                            f'{lo:.0f}px+ more air below its content than '
                            f'above — cut {lo:.0f}px from the row height'))
            elif hi < -PAD_UNEVEN:
                out.append(("ROW-PADDING-UNEVEN",
                            f'every box in the row at y={r0["y"]:.0f} has '
                            f'{-hi:.0f}px+ more air above its content than '
                            f'below — move the content up or cut the height'))
            continue
        r, (_l, _rr, t, b) = measured[0]
        if abs(b - t) > PAD_UNEVEN:
            side = "below" if b > t else "above"
            out.append(("BOX-PADDING-UNEVEN",
                        f'box [{r["x"]:.0f},{r["y"]:.0f},{r["w"]:.0f},'
                        f'{r["h"]:.0f}] leaves {max(t, b):.0f}px {side} its '
                        f'content and {min(t, b):.0f}px on the other side — '
                        f'size the box from the content with even padding'))

    # 11b) a wrap forced by side padding. Two consecutive lines of one text
    #      block that would fit on one line at the standard 16px side
    #      padding were wrapped by a narrower wrap width — the box is one
    #      line taller than its text needs.
    for r in pad_boxes:
        box = _box(r)
        inside = [t for t in T if box[0] <= t["x"] <= box[0] + box[2]
                  and box[1] <= t["y"] <= box[1] + box[3]]
        # two lines are one paragraph only in the same ink: a bold line
        # over a muted line is a title and its detail, not a wrap
        groups = {}
        for t in inside:
            groups.setdefault((t["anchor"], round(t["x"]), round(t["size"]),
                               t["fill"], t["weight"]), []).append(t)
        hit = None
        for g in groups.values():
            g.sort(key=lambda t: t["y"])
            for a, b in zip(g, g[1:]):
                if b["y"] - a["y"] > a["size"] * 1.3:
                    continue              # separate items, not a wrap
                avail = box[2] - 2 * SIDE_PAD
                wa, wb = a["x1"] - a["x0"], b["x1"] - b["x0"]
                if wa < 0.55 * avail:
                    continue              # a short first line is a list
                if wa + 0.3 * a["size"] + wb <= WRAP_ALLOW * avail:
                    hit = (a, b, wa + 0.3 * a["size"] + wb, avail)
                    break
            if hit:
                break
        if hit:
            a, b, joined, avail = hit
            out.append(("WRAP-SLACK",
                        f'"{a["txt"][:16]}" / "{b["txt"][:16]}" in box '
                        f'[{r["x"]:.0f},{r["y"]:.0f}] would fit one line '
                        f'({joined:.0f}px ≤ {WRAP_ALLOW * avail:.0f}px at '
                        f'{SIDE_PAD}px side padding) — the wrap width is '
                        f'narrower than the box allows; widen it'))

    # 11c) peers in a row. Boxes drawn at one y with one corner radius and
    #      one fill are read as a row of equals; a height or width that
    #      differs by a few pixels, or an uneven gap between them, reads as a
    #      slip rather than a distinction. A real distinction is larger than
    #      the tolerances here — a 2:1 span, a label column beside a value
    #      column — and is not reported.
    # A rect whose width or height carries a quantity — a bar, a treemap
    # cell, a proportional strip — declares it with data-measure, and is
    # not a peer of anything: its size is the content.
    measured = {}
    for m in re.finditer(r'<rect\b([^>]*)/?>', svg):
        a = m.group(1)
        dm = re.search(r'\bdata-measure="([^"]+)"', a)
        if dm:
            measured[m.start()] = dm.group(1)

    def _has_stripe(r):
        """A box carrying a band on one of its edges is a label card, and
        its width is a design choice rather than a slip."""
        return any(o is not r and not o["canvas"] and _key(o) != _key(r)
                   and contains(_box(r), _box(o), TOL)
                   and _touches_edge(o, _box(r)) for o in rinfo + rpaths)

    peers = []
    for r in rinfo:
        if r["canvas"] or r["w"] < 40 or r["h"] < 22:
            continue
        k = _key(r)
        if k in mask_keys or k in container_keys or r["pos"] in measured \
                or k in ring_keys:
            continue
        if any(o is not r and not o["canvas"]
               and contains(_box(o), _box(r), TOL) and _key(o) != k
               and _touches_edge(r, _box(o)) for o in rinfo):
            continue                      # a band on somebody's edge
        peers.append(r)

    def _components(items, related):
        comps = []
        for r in items:
            joined = [c for c in comps if any(related(r, o) for o in c)]
            merged = [r]
            for c in joined:
                merged.extend(c)
                comps.remove(c)
            comps.append(merged)
        return comps

    def _split_groups(sorted_items, gap_of):
        """Cut a run of peers where a gap is a separator — at least 1.8× the
        smallest gap and 8px wider, or 60px and more outright. The wider gap
        is the distance between two groups, and sizes need agree only within
        a group."""
        gaps = [gap_of(a, b) for a, b in zip(sorted_items, sorted_items[1:])]
        if not gaps:
            return [sorted_items]
        floor = min(gaps)
        groups, cur = [], [sorted_items[0]]
        for g, item in zip(gaps, sorted_items[1:]):
            if (g >= 1.8 * floor and g >= floor + 8) or g >= 60:
                groups.append(cur)
                cur = [item]
            else:
                cur.append(item)
        groups.append(cur)
        return groups

    # A row lives inside one container: cards in two different frames are
    # two rows that happen to share a y, not one row with a slip in it.
    frame_boxes = [_box(r) for r in rinfo if _key(r) in container_keys
                   or (r["dashed"] and r["h"] > 44)] + \
        [_box(p) for p in rpaths if p["stroke"] != "none"]

    def _parent(r):
        holders = [f for f in frame_boxes
                   if contains(f, _box(r), TOL) and not same_rect(f, _box(r))]
        if not holders:
            return None
        f = min(holders, key=lambda f: f[2] * f[3])
        return (round(f[0]), round(f[1]), round(f[2]), round(f[3]))

    parent_of = {id(r): _parent(r) for r in peers}

    def _row_peer(a, b):
        return (abs(a["y"] - b["y"]) <= 2 and abs(a["rx"] - b["rx"]) <= 1
                and a["fill"] == b["fill"] and abs(a["op"] - b["op"]) <= .02
                and parent_of[id(a)] == parent_of[id(b)]
                and (a["x"] >= b["x"] + b["w"] - 1
                     or a["x"] + a["w"] <= b["x"] + 1))

    for comp in _components(peers, _row_peer):
        if len(comp) < 2:
            continue
        comp.sort(key=lambda r: r["x"])
        y0 = comp[0]["y"]
        for grp in _split_groups(comp, lambda a, b: b["x"] - (a["x"] + a["w"])):
            if len(grp) < 2:
                continue
            hs = [r["h"] for r in grp]
            if max(hs) - min(hs) > 3 and max(hs) <= 1.7 * min(hs):
                out.append(("ROW-HEIGHT-MISMATCH",
                            f'{len(grp)} boxes in the row at y={y0:.0f} have '
                            f'heights {", ".join(f"{h:.0f}" for h in hs)} — '
                            f'size the row from its tallest content and give '
                            f'every box that height'))
            plain = [r for r in grp if not _has_stripe(r)]
            ws = [r["w"] for r in plain]
            ghs = [r["h"] for r in plain]
            if (len(plain) >= 2 and max(ghs) - min(ghs) <= 3 and min(ghs) >= 34
                    and max(ws) - min(ws) > 3 and max(ws) <= 1.5 * min(ws)):
                out.append(("ROW-WIDTH-MISMATCH",
                            f'{len(plain)} boxes in the row at y={y0:.0f} '
                            f'have widths {", ".join(f"{w:.0f}" for w in ws)} '
                            f'— lay the row out with row_positions() so the '
                            f'columns are equal'))
            if len(grp) >= 3:
                gaps = [b["x"] - (a["x"] + a["w"]) for a, b in zip(grp, grp[1:])]
                if max(gaps) - min(gaps) > 4:
                    out.append(("ROW-GAP-UNEVEN",
                                f'gaps between the {len(grp)} boxes in the '
                                f'row at y={y0:.0f} are '
                                f'{", ".join(f"{g:.0f}" for g in gaps)}px — '
                                f'space the columns evenly'))

    # 11d) peers in a stack. Same test down the page: boxes of one width at
    #      one x with gaps that differ, where the larger gap holds nothing.
    def _stack_peer(a, b):
        return (abs(a["x"] - b["x"]) <= 2 and abs(a["w"] - b["w"]) <= 2
                and abs(a["rx"] - b["rx"]) <= 1 and a["fill"] == b["fill"]
                and (a["y"] >= b["y"] + b["h"] - 1
                     or a["y"] + a["h"] <= b["y"] + 1))

    def _band_busy(x0, x1, y0, y1):
        if any(x0 <= t["x"] <= x1 and y0 <= t["y"] <= y1 for t in T):
            return True
        return any(min(r["x"] + r["w"], x1) - max(r["x"], x0) > 8
                   and min(r["y"] + r["h"], y1) - max(r["y"], y0) > 8
                   for r in rinfo if not r["canvas"])

    for comp in _components(peers, _stack_peer):
        comp.sort(key=lambda r: r["y"])
        for grp in _split_groups(comp, lambda a, b: b["y"] - (a["y"] + a["h"])):
            if len(grp) < 3:
                continue
            gaps = [(b["y"] - (a["y"] + a["h"]), a, b)
                    for a, b in zip(grp, grp[1:])]
            sizes = [g for g, _a, _b in gaps]
            if max(sizes) - min(sizes) <= 4:
                continue
            odd = [(g, a, b) for g, a, b in gaps if g > min(sizes) + 4]
            if all(not _band_busy(a["x"], a["x"] + a["w"], a["y"] + a["h"],
                                  b["y"]) for _g, a, b in odd):
                out.append(("STACK-GAP-UNEVEN",
                            f'{len(grp)} boxes stacked at x={grp[0]["x"]:.0f} '
                            f'are {", ".join(f"{s:.0f}" for s in sizes)}px '
                            f'apart and the wider gaps hold nothing — space '
                            f'them evenly'))

    # 11e) a frame's inset. A boundary drawn around a group is read as the
    #      group's edge; when its content sits 40px below the top and 16px
    #      above the bottom the group looks like it slid down, and when
    #      every inset is 40px the frame is a border around blank paper.
    frames = []
    for r in rinfo:
        if r["canvas"]:
            continue
        k = _key(r)
        if k in container_keys:
            frames.append(r)
        elif r["dashed"] and r["h"] > 44 and any(
                not same_rect(_box(r), o) and contains(_box(r), o)
                and o[2] >= 40 and o[3] >= 30      # a box, not an icon or a badge
                for o in solids):
            frames.append(r)
    # a strip's end segment is a quantity, not a frame around its label
    frames += [p for p in rpaths if p["stroke"] != "none" and not p["measured"]]
    seen_frame = set()
    for f in frames:
        k = _key(f)
        if k in seen_frame or f["rx"] >= min(f["w"], f["h"]) / 2 - 1:
            continue                      # a circle has no inset to measure
        seen_frame.add(k)
        cont = _contents(_box(f), f["pos"])
        if not cont:
            continue
        left, right, top, bottom = _pads(_box(f), cont)
        # A title chip that straddles the top border is the frame's own
        # heading: the inset above the content is measured from the chip's
        # lower edge, not from the border it sits on.
        fx, fy, fw, fh = _box(f)
        chip_bottom = fy
        for r in rinfo + rpaths:
            if r["canvas"] or r["pos"] == f["pos"]:
                continue
            if (r["y"] < fy - 2 and fy < r["y"] + r["h"] < fy + 40
                    and fx - 2 <= r["x"] and r["x"] + r["w"] <= fx + fw + 2):
                chip_bottom = max(chip_bottom, r["y"] + r["h"])
        for t in T:
            if (t["y0"] < fy - 2 and fy < t["y1"] < fy + 40
                    and fx <= t["x"] <= fx + fw):
                chip_bottom = max(chip_bottom, t["y1"])
        top -= chip_bottom - fy
        pads = (left, right, top, bottom)
        if (left <= 3 and right <= 3) or (top <= 3 and bottom <= 3):
            continue                      # a table row or column, not a frame
        where = (f'[{f["x"]:.0f},{f["y"]:.0f},{f["w"]:.0f},{f["h"]:.0f}]')
        if max(pads) - min(pads) > FRAME_UNEVEN:
            out.append(("FRAME-PADDING-UNEVEN",
                        f'frame {where} insets its content by left {left:.0f} '
                        f'· right {right:.0f} · top {top:.0f} · bottom '
                        f'{bottom:.0f} — give the four sides one inset'))
        elif min(pads) > FRAME_LOOSE:
            out.append(("FRAME-PADDING-LOOSE",
                        f'frame {where} keeps {min(pads):.0f}px of blank '
                        f'paper on every side of its content — draw it '
                        f'{min(pads) - 16:.0f}px closer'))

    # 11f) a band drawn as a rounded rect. A header or a side label that
    #      shares a whole edge with its box follows the box's outline on
    #      that edge and meets the box's body square on the other; a rect
    #      rounds all four corners, so the band reads as a chip resting on
    #      the box. The mirror case — a square band on a rounded box — pokes
    #      its corners past the outline.
    for A in rinfo:
        if A["canvas"] or _key(A) in mask_keys:
            continue
        for B in rinfo:
            if B is A or B["canvas"] or not _visible(B):
                continue
            if not contains(_box(B), _box(A), TOL) or _key(B) == _key(A):
                continue
            if A["w"] >= B["w"] - 4 and A["h"] >= B["h"] - 4:
                continue
            if A["pos"] < B["pos"] and B["fill"] not in ("none",) \
                    and B["op"] >= 0.99:
                continue                  # hidden under the box's fill
            ax1, ay1 = A["x"] + A["w"], A["y"] + A["h"]
            bx1, by1 = B["x"] + B["w"], B["y"] + B["h"]
            spans_h = abs(A["y"] - B["y"]) <= TOL and abs(ay1 - by1) <= TOL
            spans_w = abs(A["x"] - B["x"]) <= TOL and abs(ax1 - bx1) <= TOL
            edge = None
            if spans_h and abs(A["x"] - B["x"]) <= TOL:
                edge = "left"
            elif spans_h and abs(ax1 - bx1) <= TOL:
                edge = "right"
            elif spans_w and abs(A["y"] - B["y"]) <= TOL:
                edge = "top"
            elif spans_w and abs(ay1 - by1) <= TOL:
                edge = "bottom"
            if edge is None:
                continue
            if A["rx"] > 1:
                out.append(("BAND-CORNERS",
                            f'rect [{A["x"]:.0f},{A["y"]:.0f},{A["w"]:.0f},'
                            f'{A["h"]:.0f}] is a band on the {edge} edge of '
                            f'box [{B["x"]:.0f},{B["y"]:.0f}] drawn with all '
                            f'four corners rounded — the corners facing the '
                            f'box body must be square; draw it with '
                            f'band(side="{edge}")'))
            elif B["rx"] > 1:
                out.append(("BAND-CORNERS",
                            f'square band [{A["x"]:.0f},{A["y"]:.0f},'
                            f'{A["w"]:.0f},{A["h"]:.0f}] sits on the {edge} '
                            f'edge of rounded box [{B["x"]:.0f},{B["y"]:.0f}] '
                            f'— its corners poke past the outline; draw it '
                            f'with band(side="{edge}")'))
            break

    # 11g) a label with a line through it. Every stroke in the drawing —
    #      connectors, dividers, a box outline, a boundary — cuts the
    #      letters it passes under unless a paper mask sits between them.
    #      The lint sees the mask as an opaque rect drawn after the stroke
    #      that covers the glyph box; without one the label is unreadable.
    strokes = []                          # (pos, p, q, owner_rect_or_None)
    for m in re.finditer(r'<line\b([^>]*)/?>', svg):
        a = m.group(1)

        def _lv(k, a=a):
            mm = re.search(rf'\b{k}="([\-\d.]+)"', a)
            return float(mm.group(1)) if mm else None
        p, q = (_lv("x1"), _lv("y1")), (_lv("x2"), _lv("y2"))
        if None not in p + q:
            strokes.append((m.start(), p, q, None))
    for m in re.finditer(r'<path\b([^>]*)/?>', svg):
        a = m.group(1)
        if 'stroke="none"' in a or "stroke=" not in a:
            continue
        dm = re.search(r'\bd="([^"]+)"', a)
        if not dm:
            continue
        toks = re.findall(r'[MLHVQCSTAZ]|-?[\d.]+', dm.group(1))
        i, cur = 0, (0.0, 0.0)
        while i < len(toks):
            c = toks[i]
            i += 1
            try:
                if c == "M":
                    cur = (float(toks[i]), float(toks[i + 1]))
                    i += 2
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
                    nxt = (float(toks[i + 2]), float(toks[i + 3]))
                    i += 4
                elif c == "C":
                    nxt = (float(toks[i + 4]), float(toks[i + 5]))
                    i += 6
                elif c == "A":
                    nxt = (float(toks[i + 5]), float(toks[i + 6]))
                    i += 7
                elif c == "Z":
                    continue
                else:
                    break
            except (IndexError, ValueError):
                break
            strokes.append((m.start(), cur, nxt, None))
            cur = nxt
    for r in rinfo:
        if r["canvas"] or _key(r) in mask_keys or not _visible(r):
            continue
        rx = min(r["rx"], r["w"] / 2, r["h"] / 2)
        x, y, w, h = _box(r)
        strokes.append((r["pos"], (x + rx, y), (x + w - rx, y), r))
        strokes.append((r["pos"], (x + rx, y + h), (x + w - rx, y + h), r))
        strokes.append((r["pos"], (x, y + rx), (x, y + h - rx), r))
        strokes.append((r["pos"], (x + w, y + rx), (x + w, y + h - rx), r))

    opaque = [r for r in rinfo + rpaths
              if r["fill"] not in ("none", "transparent")
              and not r["fill"].startswith("url(") and r["op"] >= 0.9
              and not r["canvas"]]

    def _seg_len_in(p, q, box):
        """Length of segment p→q inside box=(x0,y0,x1,y1)."""
        return _clip_len(p, q, (box[0], box[1], box[2] - box[0],
                                box[3] - box[1]), inset=0)

    hits = 0
    for t in T:
        if hits >= 12:
            break
        gb = (t["x0"] + 2, t["y0"] + 2, t["x1"] - 2, t["y1"] - 2)
        if gb[2] - gb[0] < 4 or gb[3] - gb[1] < 4:
            continue
        for pos, p, q, owner in strokes:
            if owner is not None:
                ox, oy, ow, oh = _box(owner)
                if ox - 1 <= t["x"] <= ox + ow + 1 and oy - 1 <= t["y"] <= oy + oh + 1:
                    # the label's own box: a left/right crossing is
                    # TEXT-OVERFLOW's finding, a top/bottom one is a label
                    # that has slid onto the edge — report the latter only
                    if abs(p[0] - q[0]) <= 0.01:
                        continue
            if _seg_len_in(p, q, gb) <= 1.0:
                continue
            masked = any(o["pos"] > pos
                         and _inside((t["x0"], t["y0"], t["x1"], t["y1"]),
                                     _box(o), 2)
                         for o in opaque)
            if masked:
                continue
            hits += 1
            what = ("the outline of box "
                    f'[{owner["x"]:.0f},{owner["y"]:.0f}]' if owner
                    else f'a line ({p[0]:.0f},{p[1]:.0f})→({q[0]:.0f},{q[1]:.0f})')
            out.append(("TEXT-ON-LINE",
                        f'"{t["txt"][:22]}" has {what} running through its '
                        f'letters with nothing behind them — move the label '
                        f'off the line, or draw a paper-coloured mask under '
                        f'it (text(..., mask=True))'))
            break

    # 11h) which box a label belongs to. A label outside every box is read
    #      as belonging to the nearest thing; when a neighbouring box or a
    #      foreign label sits about as close as its own box, the reader
    #      groups it wrongly or not at all. The label keeps at least twice
    #      the distance to anything else that it keeps to its own element.
    shapes = [r for r in rinfo + rpaths if not r["canvas"]
              and _key(r) not in ring_keys
              and _key(r) not in mask_keys]

    def _dist_box(bb, box):
        x, y, w, h = box
        dx = max(x - bb[2], bb[0] - (x + w), 0)
        dy = max(y - bb[3], bb[1] - (y + h), 0)
        return math.hypot(dx, dy)

    def _dist_seg(bb, p, q):
        # distance from a glyph box to a segment: sample the segment
        best = None
        for k in range(0, 11):
            sx = p[0] + (q[0] - p[0]) * k / 10
            sy = p[1] + (q[1] - p[1]) * k / 10
            dx = max(bb[0] - sx, sx - bb[2], 0)
            dy = max(bb[1] - sy, sy - bb[3], 0)
            d = math.hypot(dx, dy)
            best = d if best is None or d < best else best
        return best

    # a text inside any rect — a box, a pill, a badge plate — is that
    # shape's label, and so is a text level with a rect just beside it (a
    # row's name left of its bar, a value right of it); only a text on bare
    # paper is free
    all_shapes = [r for r in rinfo + rpaths if not r["canvas"]]

    def _attached(t):
        for r in all_shapes:
            if r["x"] - 1 <= t["x"] <= r["x"] + r["w"] + 1 \
                    and r["y"] - 1 <= t["y"] <= r["y"] + r["h"] + 1:
                return True
            if r["y"] <= t["y"] <= r["y"] + r["h"] and (
                    0 <= r["x"] - t["x1"] <= 24
                    or 0 <= t["x0"] - (r["x"] + r["w"]) <= 24):
                return True
        return False

    free = [t for t in T if not _attached(t)]
    # a label and its sub-line are one block
    free.sort(key=lambda t: (t["anchor"], round(t["x"]), t["y"]))
    blocks = []
    for t in free:
        for b in blocks:
            last = b[-1]
            # a label and its sub-line share an anchor and an x; a heading
            # over a list does too, so a line of another size is a new block
            # unless it sits tight under the last one
            same_size = abs(last["size"] - t["size"]) < 0.5
            reach = last["size"] * (2.0 if same_size else 1.4)
            if (last["anchor"] == t["anchor"] and abs(last["x"] - t["x"]) <= 1
                    and 0 < t["y"] - last["y"] <= reach):
                b.append(t)
                break
        else:
            blocks.append([t])
    def _in_small(pt):
        return any(s[0] - 1 <= pt[0] <= s[2] + 1 and s[1] - 1 <= pt[1] <= s[3] + 1
                   for s in small)

    lines_only = [(p, q) for _pos, p, q, owner in strokes
                  if owner is None and not (_in_small(p) and _in_small(q))]

    def _bbox_of(block):
        return (min(t["x0"] for t in block), min(t["y0"] for t in block),
                max(t["x1"] for t in block), max(t["y1"] for t in block))

    def _overlap_x(bb, ob):
        return min(bb[2], ob[2]) - max(bb[0], ob[0]) > 0

    def _overlap_y(bb, ob):
        return min(bb[3], ob[3]) - max(bb[1], ob[1]) > 0

    grouped = 0
    for b in blocks:
        if grouped >= 6:
            break
        bb = _bbox_of(b)
        cands = [(_dist_box(bb, _box(r)), r) for r in shapes]
        cands += [(_dist_seg(bb, p, q), (p, q)) for p, q in lines_only]
        if not cands:
            continue
        d_own, owner = min(cands, key=lambda c: c[0])
        if d_own > 20:
            continue                      # a heading, not a box label
        own_bb = (_box(owner)[0], _box(owner)[1],
                  _box(owner)[0] + _box(owner)[2],
                  _box(owner)[1] + _box(owner)[3]) if isinstance(owner, dict) \
            else (min(owner[0][0], owner[1][0]), min(owner[0][1], owner[1][1]),
                  max(owner[0][0], owner[1][0]), max(owner[0][1], owner[1][1]))
        # A label beside its element competes with what is beside it; a
        # label above or below competes with what is above or below. What
        # sits diagonally is not in the reader's line of sight.
        beside = _overlap_y(bb, own_bb) and not _overlap_x(bb, own_bb)
        same_line = _overlap_y if beside else _overlap_x
        foreign = []
        for d, r in cands:
            if not isinstance(r, dict) or r is owner:
                continue
            if abs(d - d_own) <= 3:
                continue                  # a heading over a row owns the row
            rb = (r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"])
            if isinstance(owner, dict):
                ob = _box(owner)
                if contains(ob, _box(r), TOL) or contains(_box(r), ob, TOL):
                    continue              # the owner's own parts, or its frame
                if (min(ob[0] + ob[2], rb[2]) - max(ob[0], rb[0]) > -1
                        and min(ob[1] + ob[3], rb[3]) - max(ob[1], rb[1]) > -1):
                    continue              # a marker on the owner's track
            if not same_line(bb, rb):
                continue
            foreign.append((d, f'box [{r["x"]:.0f},{r["y"]:.0f}]'))
        for ob in blocks:
            if ob is b:
                continue
            obb = _bbox_of(ob)
            if not same_line(bb, obb):
                continue
            dx = max(bb[0] - obb[2], obb[0] - bb[2], 0)
            dy = max(bb[1] - obb[3], obb[1] - bb[3], 0)
            foreign.append((math.hypot(dx, dy),
                            f'label "{ob[0]["txt"][:14]}" at '
                            f'({obb[0]:.0f},{obb[1]:.0f})'))
        if not foreign:
            continue
        d_for, what = min(foreign, key=lambda f: f[0])
        if d_for < max(12.0, 2.0 * d_own):
            grouped += 1
            out.append(("LABEL-GROUPING",
                        f'"{b[0]["txt"][:22]}" sits {d_own:.0f}px from the '
                        f'element it labels and {d_for:.0f}px from {what} — '
                        f'the reader cannot tell which it belongs to; put it '
                        f'inside its box, or keep twice the distance to '
                        f'everything else'))
    return out


def hotspots(svg_path, outdir, scale=4):
    """Zoom-crop a PNG around every arrow endpoint.

    A full render downscaled for viewing hides sub-10px defects (an
    arrowhead landing on a chip, a label kissing a box). Endpoints are where
    those defects live — cropping each one at high scale turns "eyeball the
    overview" into a systematic pass. Read the produced PNGs after render.
    """
    with open(svg_path) as f:
        svg = re.sub(r'<!--.*?-->', '', f.read(), flags=re.S)
    pts = []
    for tag in re.finditer(r'<line\b([^>]*)/?>', svg):
        a = tag.group(1)
        if "marker" not in a:
            continue
        def gv(k):
            mm = re.search(rf'\b{k}="([\-\d.]+)"', a)
            return float(mm.group(1)) if mm else 0.0
        pts.append((gv("x1"), gv("y1")))
        pts.append((gv("x2"), gv("y2")))
    for tag in re.finditer(r'<path\b([^>]*)/?>', svg):
        a = tag.group(1)
        if "marker" not in a:
            continue
        dm = re.search(r'\bd="([^"]+)"', a)
        if not dm:
            continue
        nums = re.findall(r'-?[\d.]+', dm.group(1))
        if len(nums) >= 4:
            pts.append((float(nums[0]), float(nums[1])))
            pts.append((float(nums[-2]), float(nums[-1])))
    # dedupe near-identical endpoints
    kept = []
    for p in pts:
        if all(math.hypot(p[0] - q[0], p[1] - q[1]) > 24 for q in kept):
            kept.append(p)
    os.makedirs(outdir, exist_ok=True)
    for n, (x, y) in enumerate(kept, 1):
        crop(svg_path, max(0, x - 80), max(0, y - 55), 160, 110,
             os.path.join(outdir, f"hs-{n:02d}.png"), scale)
    print(f"hotspots: {len(kept)} endpoint crops in {outdir}")


def _usage_exit():
    print(__doc__.strip())
    sys.exit(2)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        _usage_exit()
    cmd = sys.argv[1]
    if cmd == "render":
        render(sys.argv[2], sys.argv[3],
               float(sys.argv[4]) if len(sys.argv) > 4 else 2)
    elif cmd == "crop":
        crop(sys.argv[2], *(float(v) for v in sys.argv[3:7]), sys.argv[7],
             float(sys.argv[8]) if len(sys.argv) > 8 else 4)
    elif cmd == "lint":
        # accept multiple SVGs; exit nonzero when any issue is found so the
        # lint can gate a build/verify loop
        total = 0
        for p in sys.argv[2:]:
            total += len(lint(p))
        sys.exit(1 if total else 0)
    elif cmd == "hotspots":
        hotspots(sys.argv[2], sys.argv[3],
                 float(sys.argv[4]) if len(sys.argv) > 4 else 4)
    else:
        _usage_exit()
