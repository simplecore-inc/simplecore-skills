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


def _text_w(txt, size, mono):
    """CJK-aware estimated text width (mirrors svgkit.tw)."""
    k = 0.60 if mono else 0.55
    wide = sum(1 for ch in txt if _is_wide(ch))
    return ((len(txt) - wide) * k + wide * 1.03) * size


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
        if t and abs(t[0]) > 1.5 and abs(t[1]) > 1.5:
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
        ra = r[2] * r[3]
        return any(o is not r and contains(r, o)
                   and o[3] >= 34 and o[2] * o[3] >= 0.05 * ra
                   for o in solids)
    containers = {id(r) for r in solids
                  if (r[2] >= 0.88 * W and r[3] >= 0.88 * H)
                  or _has_substantial_child(r)}
    for (x, y, w, h, _) in solids:
        if w < 90 or h < 50:
            continue
        if w >= 0.88 * W and h >= 0.88 * H:
            continue  # canvas background, not a content box
        bottom = y + h
        maxcb = None
        for (cx, cy, cw, ch, _) in solids:
            if (cx, cy, cw, ch) == (x, y, w, h):
                continue
            if cw >= w - 2 and ch >= h - 2:
                continue  # same-ish size / not a child
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
    node_rects = [r for r in solids if id(r) not in containers]

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

    print(f"=== lint {os.path.basename(svg_path)} ({W:.0f}x{H:.0f}) ===")
    if not issues:
        print("  ✔ no static issues")
    for kind, msg in issues:
        print(f"  ✖ {kind}: {msg}")
    return issues


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
