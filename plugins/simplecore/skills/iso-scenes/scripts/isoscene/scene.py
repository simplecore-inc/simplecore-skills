"""An isometric scene drawn on an svg-diagrams document-figure canvas.

World coordinates: x and y on the ground, z up, one unit about one drawn unit.
The viewer looks from +x, +y, so of a solid's faces the +x face, the +y face
and the top are visible. Two layers are painted:

1. the floor layer in the order it was added - islands, trenches and cables
   laid on the ground. A point on the ground is never in front of a solid's
   visible faces, so the floor is always painted first and a cable has to end
   at the foot of a visible face to be seen arriving.
2. the solids, ordered by comparing their bounding boxes pair by pair. A solid
   that is entirely on the far side of another along x or y, or entirely below
   it, is painted first. Parts of one device are added inside `group()` and
   move through the order as one solid.
"""
import math
from contextlib import contextmanager

C30 = math.cos(math.radians(30))


class Scene:
    def __init__(self, canvas, ox, oy, stroke=1.4, casing=7.8, halo=5):
        # `casing` and `halo` are paper-coloured stroke widths; a project that
        # checks strokes against a ladder declares both beside its three weights.
        self.c, self.ox, self.oy, self.sw = canvas, ox, oy, stroke
        self.casing, self.halo = casing, halo
        self.floor, self.solids, self.cables, self._group = [], [], [], None
        self.labels = []

    # -- projection ---------------------------------------------------------
    def at(self, x, y, z=0.0):
        return self.ox + (x - y) * C30, self.oy + (x + y) * 0.5 - z

    def _d(self, points, close=True):
        return ("M" + " L".join(f"{px:.1f},{py:.1f}" for px, py in points)
                + (" Z" if close else ""))

    def _fill(self, points, color, opacity):
        d = self._d(points)
        paper = self.c.t["bg"]
        return (f'<path d="{d}" fill="{paper}" stroke="none"/>'
                f'<path d="{d}" fill="{color}" fill-opacity="{opacity:.2f}" stroke="none"/>')

    def _line(self, points, color, sw=None, close=False, cap="round"):
        return (f'<path d="{self._d(points, close)}" fill="none" stroke="{color}" '
                f'stroke-width="{sw or self.sw}" stroke-linejoin="round" '
                f'stroke-linecap="{cap}"/>')

    # -- solids -------------------------------------------------------------
    def _add(self, bbox, markup):
        solid = {"bbox": bbox, "markup": markup}
        (self._group["parts"] if self._group is not None else self.solids).append(solid)
        return solid

    @contextmanager
    def group(self):
        """Parts added inside belong to one device: they are painted bottom to
        top, far to near, and the device takes one place in the scene's order."""
        outer, self._group = self._group, {"parts": []}
        try:
            yield
        finally:
            parts, self._group = self._group["parts"], outer
        if not parts:
            return
        parts.sort(key=lambda s: (s["bbox"][2], s["bbox"][0] + s["bbox"][1]))
        boxes = [s["bbox"] for s in parts]
        bbox = tuple(min(b[i] for b in boxes) for i in range(3)) + \
            tuple(max(b[i] for b in boxes) for i in range(3, 6))
        solid = self._add(bbox, "".join(s["markup"] for s in parts))
        # What stands on the ground is the device's footprint; a roof or a
        # tank that overhangs it does not block a cable on the floor.
        feet = [b for b in boxes if b[2] <= 0.5]
        if feet:
            solid["foot"] = (min(b[0] for b in feet), min(b[1] for b in feet), 0,
                             max(b[3] for b in feet), max(b[4] for b in feet), 0)

    def box(self, x, y, z, w, d, h, color, tone=1.0, edge=None):
        """A box with its low corner at (x, y, z)."""
        a, edge = self.at, edge or color
        t0, t1, t2, t3 = a(x, y, z + h), a(x + w, y, z + h), a(x + w, y + d, z + h), a(x, y + d, z + h)
        b1, b2, b3 = a(x + w, y, z), a(x + w, y + d, z), a(x, y + d, z)
        markup = (self._fill([t3, t2, b2, b3], color, 0.36 * tone)
                  + self._fill([t1, t2, b2, b1], color, 0.22 * tone)
                  + self._fill([t0, t1, t2, t3], color, 0.09 * tone)
                  # Every visible edge once: shared edges are not stroked twice.
                  + f'<path d="{self._d([t0, t1, t2, t3])} {self._d([t1, b1, b2, b3, t3], False)} '
                    f'{self._d([t2, b2], False)}" fill="none" stroke="{edge}" '
                    f'stroke-width="{self.sw}" stroke-linejoin="round"/>')
        return self._add((x, y, z, x + w, y + d, z + h), markup)

    def box_at(self, x, y, w, d, h, color, z=0.0, tone=1.0, edge=None):
        """A box whose footprint is centred on (x, y)."""
        return self.box(x - w / 2, y - d / 2, z, w, d, h, color, tone, edge)

    def cyl(self, x, y, r, h, color, z=0.0, tone=1.0, edge=None, rim=True):
        """An upright cylinder centred on (x, y)."""
        edge = edge or color
        cx, bottom = self.at(x, y, z)
        top, rx, ry = bottom - h, r * 1.2247, r * 0.7071
        body = (f"M{cx - rx:.1f},{top:.1f} L{cx - rx:.1f},{bottom:.1f} "
                f"A{rx:.1f},{ry:.1f} 0 0 0 {cx + rx:.1f},{bottom:.1f} L{cx + rx:.1f},{top:.1f}")
        shade = (f"M{cx - rx:.1f},{top:.1f} L{cx - rx:.1f},{bottom:.1f} "
                 f"A{rx:.1f},{ry:.1f} 0 0 0 {cx - rx * 0.2:.1f},{bottom + ry * 0.98:.1f} "
                 f"L{cx - rx * 0.2:.1f},{top + ry * 0.98:.1f}")
        paper = self.c.t["bg"]
        ellipse = f'cx="{cx:.1f}" cy="{top:.1f}" rx="{rx:.1f}" ry="{ry:.1f}"'
        markup = (f'<path d="{body} Z" fill="{paper}" stroke="none"/>'
                  f'<path d="{body} Z" fill="{color}" fill-opacity="{0.20 * tone:.2f}" stroke="none"/>'
                  f'<path d="{shade} Z" fill="{color}" fill-opacity="{0.18 * tone:.2f}" stroke="none"/>'
                  f'<ellipse {ellipse} fill="{paper}" stroke="none"/>'
                  f'<ellipse {ellipse} fill="{color}" fill-opacity="{0.08 * tone:.2f}" stroke="none"/>')
        if rim:
            markup += (f'<path d="{body}" fill="none" stroke="{edge}" stroke-width="{self.sw}" '
                       f'stroke-linejoin="round"/>'
                       f'<ellipse {ellipse} fill="none" stroke="{edge}" stroke-width="{self.sw}"/>')
        return self._add((x - r, y - r, z, x + r, y + r, z + h), markup)

    def disc(self, x, y, r, color, z=0.0, tone=1.0, edge=None, lip=0.0):
        """A thin horizontal disc drawn with one outline: an insulator shed, a
        flange. Stacked discs keep their outlines apart, where thin cylinders
        would print a top and a side line almost on top of each other. `lip`
        gives the disc a thickness as a shaded band under its near rim, with
        no second outline: that is what makes a stack of sheds read as solid."""
        cx, cy = self.at(x, y, z)
        rx, ry = r * 1.2247, r * 0.7071
        ellipse = f'cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="{ry:.1f}"'
        paper = self.c.t["bg"]
        markup = ""
        if lip:
            band = (f"M{cx - rx:.1f},{cy:.1f} A{rx:.1f},{ry:.1f} 0 0 0 {cx + rx:.1f},{cy:.1f} "
                    f"L{cx + rx:.1f},{cy + lip:.1f} A{rx:.1f},{ry:.1f} 0 0 1 {cx - rx:.1f},{cy + lip:.1f} Z")
            markup += (f'<path d="{band}" fill="{paper}" stroke="none"/>'
                       f'<path d="{band}" fill="{color}" fill-opacity="{0.55 * tone:.2f}" stroke="none"/>')
        markup += (f'<ellipse {ellipse} fill="{paper}" stroke="none"/>'
                   f'<ellipse {ellipse} fill="{color}" fill-opacity="{0.16 * tone:.2f}" '
                   f'stroke="{edge or color}" stroke-width="{self.sw}"/>')
        return self._add((x - r, y - r, z - lip, x + r, y + r, z + 0.5), markup)

    def cyl_x(self, x, y, z, r, length, color, tone=1.0, edge=None):
        """A cylinder lying along the world x axis: axis from (x, y, z) to
        (x + length, y, z). The +x end cap faces the viewer."""
        edge = edge or color
        ring = [(r * math.cos(t), r * math.sin(t))
                for t in (2 * math.pi * k / 28 for k in range(28))]
        far = [self.at(x, y + dy, z + dz) for dy, dz in ring]
        near = [self.at(x + length, y + dy, z + dz) for dy, dz in ring]
        hull = _hull(far + near)
        markup = (self._fill(hull, color, 0.30 * tone) + self._fill(near, color, 0.10 * tone)
                  + self._line(hull, edge, close=True) + self._line(near, edge, close=True))
        return self._add((x, y - r, z - r, x + length, y + r, z + r), markup)

    def truss(self, members, color, sw=None):
        """Thin members drawn as one open frame: a lattice column, a bracing.
        `members` is a list of (p, q) world points. The frame has no faces, so
        what stands behind it shows through."""
        markup = "".join(self._line([self.at(*p), self.at(*q)], color, sw) for p, q in members)
        points = [point for member in members for point in member]
        lo = tuple(min(pt[i] for pt in points) for i in range(3))
        hi = tuple(max(pt[i] for pt in points) for i in range(3))
        return self._add(lo + hi, markup)

    def wire(self, p, q, color, sw=2.8):
        """A straight conductor in the air between two world points."""
        # A paper-coloured casing under the stroke: where the conductor passes
        # in front of something farther away, the gap shows it is not touching.
        ends = [self.at(*p), self.at(*q)]
        markup = self._line(ends, self.c.t["bg"], self.casing, cap="butt") + self._line(ends, color, sw)
        lo = tuple(min(a, b) - 1 for a, b in zip(p, q))
        hi = tuple(max(a, b) + 1 for a, b in zip(p, q))
        return self._add(lo + hi, markup)

    # -- floor --------------------------------------------------------------
    def island(self, x0, y0, x1, y1, color, opacity=0.09, thickness=7):
        """A ground area with a visible edge thickness, so it reads as a slab."""
        a = self.at
        top = [a(x0, y0), a(x1, y0), a(x1, y1), a(x0, y1)]
        left = [a(x0, y1), a(x1, y1), a(x1, y1, -thickness), a(x0, y1, -thickness)]
        right = [a(x1, y0), a(x1, y1), a(x1, y1, -thickness), a(x1, y0, -thickness)]
        self.floor.append(self._fill(left, color, opacity * 3.2) + self._fill(right, color, opacity * 2.2)
                          + self._fill(top, color, opacity))

    def strip(self, x0, y0, x1, y1, color, opacity=0.18):
        """A band on the ground: a cable trench or a duct."""
        a = self.at
        self.floor.append(self._fill([a(x0, y0), a(x1, y0), a(x1, y1), a(x0, y1)], color, opacity))

    def cable(self, points, color, sw=2.8, arrow=False, ends=("face", "face"), radius=7):
        """A cable on the ground through world points. Each end is declared:
        "face" (it meets the foot of a device's visible face, square to it and
        clear of the corners), "join" (it meets another cable) or "free".
        `paint()` refuses a cable that breaks its declaration, crosses or
        overlaps another cable, or runs under a device."""
        self.cables.append({"points": [tuple(p) for p in points], "color": color, "sw": sw,
                            "arrow": arrow, "ends": ends, "radius": radius})

    def _cable_markup(self, spec):
        pts = [self.at(x, y) for x, y in spec["points"]]
        color, radius = spec["color"], spec["radius"]
        out = ""
        d = f"M{pts[0][0]:.1f},{pts[0][1]:.1f}"
        for i in range(1, len(pts) - 1):
            (ax, ay), (bx, by), (cx, cy) = pts[i - 1], pts[i], pts[i + 1]
            la, lc = math.hypot(bx - ax, by - ay), math.hypot(cx - bx, cy - by)
            r = min(radius, la / 2, lc / 2)
            sx, sy = bx - (bx - ax) / la * r, by - (by - ay) / la * r
            ex, ey = bx + (cx - bx) / lc * r, by + (cy - by) / lc * r
            d += f" L{sx:.1f},{sy:.1f} Q{bx:.1f},{by:.1f} {ex:.1f},{ey:.1f}"
        end = pts[-1]
        if spec["arrow"]:
            (x1, y1), (x2, y2) = pts[-2], pts[-1]
            length = math.hypot(x2 - x1, y2 - y1)
            ux, uy = (x2 - x1) / length, (y2 - y1) / length
            end = (x2 - ux * 9, y2 - uy * 9)
            bx, by = x2 - ux * 13, y2 - uy * 13
            head = [(x2, y2), (bx - uy * 6, by + ux * 6), (bx + uy * 6, by - ux * 6)]
            out += f'<path d="{self._d(head)}" fill="{color}" stroke="none"/>'
        d += f" L{end[0]:.1f},{end[1]:.1f}"
        out += (f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{spec["sw"]}" '
                f'stroke-linecap="round" stroke-linejoin="round"/>')
        for which, point in ((0, pts[0]), (1, pts[-1])):
            if spec["ends"][which] == "join":
                out += f'<circle cx="{point[0]:.1f}" cy="{point[1]:.1f}" r="4.2" fill="{color}"/>'
        return out

    def _check_cables(self):
        feet = [s.get("foot", s["bbox"]) for s in self.solids if s["bbox"][2] <= 0.5]
        found = []
        segs = []
        for n, spec in enumerate(self.cables):
            pts = spec["points"]
            for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
                if abs(x1 - x2) > 0.01 and abs(y1 - y2) > 0.01:
                    found.append(f"cable {n}: run {(x1, y1)}->{(x2, y2)} follows neither floor direction")
                segs.append((n, (x1, y1), (x2, y2)))
            for which, (point, other) in enumerate(((pts[0], pts[1]), (pts[-1], pts[-2]))):
                if spec["ends"][which] != "face":
                    continue
                if not any(_meets_face(point, other, f) for f in feet):
                    found.append(f"cable {n}: end {point} does not meet a visible face square "
                                 f"and clear of its corners")
        for n, a, b in segs:
            for f in feet:
                if _under(a, b, f):
                    found.append(f"cable {n}: run {a}->{b} passes under the device at "
                                 f"{tuple(round(v) for v in f[:2] + f[3:5])}")
        for i, (n, a, b) in enumerate(segs):
            for m, c, d in segs[i + 1:]:
                if n == m:
                    continue
                hit = _cross(a, b, c, d)
                if hit is None:
                    continue
                joins = [p for k in (n, m) for w, p in ((0, self.cables[k]["points"][0]),
                                                        (1, self.cables[k]["points"][-1]))
                         if self.cables[k]["ends"][w] == "join"]
                if hit != "overlap" and any(math.dist(hit, p) < 0.6 for p in joins):
                    continue
                found.append(f"cables {n} and {m}: {'overlap' if hit == 'overlap' else 'cross'} "
                             f"near {a}->{b} / {c}->{d}")
        if found:
            raise ValueError("cable routing:\n  " + "\n  ".join(found))

    # -- paint --------------------------------------------------------------
    # -- labels -------------------------------------------------------------
    def label(self, target, text, *, n=None, accent=None, color=None, size=None,
              prefer=("above", "right", "left", "below")):
        """A label for a device (the dict a catalogue function returned, or a
        solid) or for a world point (x, y, z). Its place is found at paint
        time: the first position around the target, in the order of `prefer`,
        where it touches no solid, wire, cable, other label or board edge.
        `n` puts a numbered disc in front. The text carries a paper halo."""
        self.labels.append({"target": target, "text": text, "n": n, "accent": accent,
                            "color": color, "size": size, "prefer": prefer})

    def _place_labels(self, hulls, lines):
        from common import BODY, MICRO, num_disc, num_disc_r
        from svgkit import SANS, tw
        placed, failed = [], []
        for spec in self.labels:
            size = spec["size"] or BODY
            text_w = tw(spec["text"], size, mono=False)
            lead = (2 * num_disc_r(spec["n"], MICRO) + 8) if spec["n"] else 0
            w, h = text_w + lead, size * 1.2
            target = spec["target"]
            if isinstance(target, dict):
                solid = target.get("solid", target)
                box = _screen(solid["bbox"], self.at)
            else:
                px, py = self.at(*target)
                box = (px - 6, py - 6, px + 6, py + 6)
            cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
            spot = None
            for gap in (8, 16, 28, 44, 64, 90):
                for side in spec["prefer"]:
                    for shift in (0, -0.25, 0.25, -0.5, 0.5):
                        if side == "above":
                            rect = (cx - w / 2 + shift * w, box[1] - gap - h)
                        elif side == "below":
                            rect = (cx - w / 2 + shift * w, box[3] + gap)
                        elif side == "right":
                            rect = (box[2] + gap, cy - h / 2 + shift * h * 2)
                        else:
                            rect = (box[0] - gap - w, cy - h / 2 + shift * h * 2)
                        r = (rect[0] - 4, rect[1] - 3, rect[0] + w + 4, rect[1] + h + 3)
                        if r[0] < 8 or r[2] > self.c.w - 8 or r[1] < 4:
                            continue
                        if any(_rect_hits_poly(r, poly) for poly in hulls):
                            continue
                        if any(_rect_hits_seg(r, a, b) for a, b in lines):
                            continue
                        if any(r[0] < q[2] and q[0] < r[2] and r[1] < q[3] and q[1] < r[3]
                               for q in placed):
                            continue
                        spot = r
                        break
                    if spot:
                        break
                if spot:
                    break
            if not spot:
                failed.append(spec["text"])
                continue
            placed.append(spot)
            x, base = spot[0] + 4, spot[1] + 3 + size * 0.92
            if spec["n"]:
                r = num_disc(self.c, x + lead / 2 - 4, base - size * 0.34, spec["n"],
                             spec["accent"] or self.c.t["fg"], size=MICRO)
                x += lead
            self.c.text(x, base, spec["text"], size=size, color=spec["color"] or self.c.t["fg"],
                        family=SANS, weight=600, anchor="start", halo=True, halo_width=self.halo)
        if failed:
            raise ValueError("no free place for the label(s): " + ", ".join(failed))

    def _check_footprints(self):
        """Two things standing on the ground cannot share ground: a cabinet
        drawn through a wall reads as a mistake, and the paint order of the
        two is then decided by centre depth, not by what is in front."""
        feet = [(s.get("foot", s["bbox"]), s) for s in self.solids if s["bbox"][2] <= 0.5]
        found = []
        for i, (a, _) in enumerate(feet):
            for b, _ in feet[i + 1:]:
                if (min(a[3], b[3]) - max(a[0], b[0]) > 0.5
                        and min(a[4], b[4]) - max(a[1], b[1]) > 0.5):
                    found.append(f"{tuple(round(v) for v in a[:2] + a[3:5])} and "
                                 f"{tuple(round(v) for v in b[:2] + b[3:5])}")
        if found:
            raise ValueError("footprints overlap on the ground:\n  " + "\n  ".join(found))

    def paint(self):
        self._check_cables()
        self._check_footprints()
        for markup in self.floor:
            self.c.add(markup)
        lines = []
        for spec in self.cables:
            self.c.add(self._cable_markup(spec))
            pts = [self.at(x, y) for x, y in spec["points"]]
            lines += list(zip(pts, pts[1:]))
        ordered = _order(self.solids, self.at)
        for solid in ordered:
            self.c.add(solid["markup"])
        hulls = [_hull([self.at(x, y, z) for x in (s["bbox"][0], s["bbox"][3])
                        for y in (s["bbox"][1], s["bbox"][4])
                        for z in (s["bbox"][2], s["bbox"][5])]) for s in ordered]
        self._place_labels(hulls, lines)
        self.floor, self.solids, self.cables, self.labels = [], [], [], []

    def top(self, solid):
        """Page point above a solid's highest corner, for a label over it."""
        x0, y0, _, x1, y1, z1 = solid["bbox"]
        return self.at((x0 + x1) / 2, (y0 + y1) / 2, z1)[0], self.at(x0, y0, z1)[1]


def _meets_face(point, other, foot, corner=0.2):
    """The cable end is on the +x or +y edge of a footprint, away from the
    corners, and its last run is square to that edge."""
    (px, py), (qx, qy) = point, other
    x0, y0, _, x1, y1, _ = foot
    mx, my = (x1 - x0) * corner, (y1 - y0) * corner
    if abs(px - x1) < 0.6 and y0 + my <= py <= y1 - my:
        return abs(qy - py) < 0.01 and qx > px
    if abs(py - y1) < 0.6 and x0 + mx <= px <= x1 - mx:
        return abs(qx - px) < 0.01 and qy > py
    return False


def _under(a, b, foot, eps=0.6):
    """The run a-b crosses the inside of a footprint."""
    x0, y0, _, x1, y1, _ = foot
    lox, hix = sorted((a[0], b[0]))
    loy, hiy = sorted((a[1], b[1]))
    return (min(hix, x1 - eps) - max(lox, x0 + eps) >= 0
            and min(hiy, y1 - eps) - max(loy, y0 + eps) >= 0
            and (min(hix, x1 - eps) - max(lox, x0 + eps)
                 + min(hiy, y1 - eps) - max(loy, y0 + eps)) > 0.5)


def _cross(a, b, c, d):
    """Where two axis-aligned runs meet: a point, "overlap", or None."""
    ah, ch = abs(a[1] - b[1]) < 0.01, abs(c[1] - d[1]) < 0.01
    if ah == ch:  # parallel
        same = abs(a[1] - c[1]) < 1.5 if ah else abs(a[0] - c[0]) < 1.5
        if not same:
            return None
        i = 0 if ah else 1
        lo, hi = max(min(a[i], b[i]), min(c[i], d[i])), min(max(a[i], b[i]), max(c[i], d[i]))
        return "overlap" if hi - lo > 0.5 else None
    h, v = ((a, b), (c, d)) if ah else ((c, d), (a, b))
    x, y = v[0][0], h[0][1]
    if (min(h[0][0], h[1][0]) - 0.01 <= x <= max(h[0][0], h[1][0]) + 0.01
            and min(v[0][1], v[1][1]) - 0.01 <= y <= max(v[0][1], v[1][1]) + 0.01):
        return (x, y)
    return None


def _rect_hits_seg(r, a, b):
    """A segment touches the rectangle (Liang-Barsky clip)."""
    x0, y0, x1, y1 = r
    dx, dy = b[0] - a[0], b[1] - a[1]
    lo, hi = 0.0, 1.0
    for p, q in ((-dx, a[0] - x0), (dx, x1 - a[0]), (-dy, a[1] - y0), (dy, y1 - a[1])):
        if abs(p) < 1e-9:
            if q < 0:
                return False
            continue
        t = q / p
        if p < 0:
            lo = max(lo, t)
        else:
            hi = min(hi, t)
    return lo <= hi


def _rect_hits_poly(r, poly):
    """A rectangle and a convex polygon overlap (separating axes)."""
    x0, y0, x1, y1 = r
    rect = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    if len(poly) < 3:
        return len(poly) == 2 and _rect_hits_seg(r, poly[0], poly[1])
    for shape in (rect, poly):
        for (ax, ay), (bx, by) in zip(shape, shape[1:] + shape[:1]):
            nx, ny = by - ay, ax - bx
            pr = [nx * px + ny * py for px, py in rect]
            pp = [nx * px + ny * py for px, py in poly]
            if max(pr) < min(pp) or max(pp) < min(pr):
                return False
    return True


def _hull(points):
    """Convex hull, counter-clockwise (monotone chain)."""
    pts = sorted(set((round(x, 2), round(y, 2)) for x, y in points))

    def half(seq):
        out = []
        for p in seq:
            while len(out) >= 2 and ((out[-1][0] - out[-2][0]) * (p[1] - out[-2][1])
                                     - (out[-1][1] - out[-2][1]) * (p[0] - out[-2][0])) <= 0:
                out.pop()
            out.append(p)
        return out[:-1]

    return half(pts) + half(reversed(pts))


def _screen(bbox, at):
    x0, y0, z0, x1, y1, z1 = bbox
    xs = [at(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
    return (min(p[0] for p in xs), min(p[1] for p in xs),
            max(p[0] for p in xs), max(p[1] for p in xs))


def _before(a, b, eps=0.01):
    """True when solid a has to be painted before solid b, False for the
    opposite, None when their boxes interpenetrate."""
    if a[3] <= b[0] + eps:
        return True
    if b[3] <= a[0] + eps:
        return False
    if a[4] <= b[1] + eps:
        return True
    if b[4] <= a[1] + eps:
        return False
    if a[5] <= b[2] + eps:
        return True
    if b[5] <= a[2] + eps:
        return False
    return None


def _order(solids, at):
    """Far-to-near order from pairwise comparison of the solids that overlap on
    the page; ties and interpenetrating pairs fall back to the centre depth."""
    n = len(solids)
    rects = [_screen(s["bbox"], at) for s in solids]
    depth = [(s["bbox"][0] + s["bbox"][3] + s["bbox"][1] + s["bbox"][4]) / 2 for s in solids]
    after = [set() for _ in range(n)]
    count = [0] * n
    for i in range(n):
        for j in range(i + 1, n):
            ri, rj = rects[i], rects[j]
            if ri[2] < rj[0] or rj[2] < ri[0] or ri[3] < rj[1] or rj[3] < ri[1]:
                continue
            first = _before(solids[i]["bbox"], solids[j]["bbox"])
            if first is None:
                first = (depth[i], solids[i]["bbox"][2]) <= (depth[j], solids[j]["bbox"][2])
            lo, hi = (i, j) if first else (j, i)
            after[lo].add(hi)
            count[hi] += 1
    ready = sorted((k for k in range(n) if count[k] == 0), key=lambda k: depth[k])
    out = []
    while ready:
        k = ready.pop(0)
        out.append(solids[k])
        for m in after[k]:
            count[m] -= 1
            if count[m] == 0:
                ready.append(m)
        ready.sort(key=lambda k: depth[k])
    if len(out) < n:  # a cycle: paint what is left by centre depth
        seen = {id(s) for s in out}
        out += sorted((s for s in solids if id(s) not in seen),
                      key=lambda s: s["bbox"][0] + s["bbox"][1])
    return out
