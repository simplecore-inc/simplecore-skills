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
    def __init__(self, canvas, ox, oy, stroke=1.4, casing=7.8, halo=5, *,
                 leaders="first", leader_max=None):
        # `casing` and `halo` are paper-coloured stroke widths; a project that
        # checks strokes against a ladder declares both beside its three weights.
        # `leaders="near"` places every label and callout at the free spot
        # nearest its part (`prefer` breaks ties) and refuses one farther than
        # `leader_max` page units; "first" takes the first free side in `prefer`.
        if leaders not in ("first", "near"):
            raise ValueError(f"leaders must be 'first' or 'near', not {leaders!r}")
        if leaders == "near" and not (leader_max and leader_max > 0):
            raise ValueError("leaders='near' needs a positive leader_max")
        self.c, self.ox, self.oy, self.sw = canvas, ox, oy, stroke
        self.casing, self.halo = casing, halo
        self.leaders, self.leader_max = leaders, leader_max
        self.floor, self.solids, self.cables, self._group = [], [], [], None
        self.labels, self.callouts = [], []

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
    def group(self, pairwise=False):
        """Parts added inside belong to one device: they are painted bottom to
        top, far to near, and the device takes one place in the scene's order.
        `pairwise=True` orders the parts by comparing their boxes pair by pair,
        as the scene orders devices: a figure whose limbs touch its body side
        by side and above one another needs it, because bottom-to-top puts an
        arm on the far side of a body in front of the body."""
        outer, self._group = self._group, {"parts": []}
        try:
            yield
        finally:
            parts, self._group = self._group["parts"], outer
        if not parts:
            return
        if pairwise:
            parts = _order(parts, self.at)
        else:
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

    def ball(self, x, y, z, r, color, tone=1.0, edge=None):
        """A sphere centred on (x, y, z): a head. This projection draws every
        sphere as a circle of radius 1.2247 r, the width of a cylinder of the
        same radius. The lower left, where the +y face of a box is darkest,
        carries a darker crescent with no outline of its own."""
        cx, cy = self.at(x, y, z)
        rr = r * 1.2247
        paper = self.c.t["bg"]
        circle = f'cx="{cx:.1f}" cy="{cy:.1f}" r="{rr:.1f}"'
        # The crescent: the circle's lower-left half, closed by a shallower arc.
        a = (cx - rr * 0.7071, cy - rr * 0.7071)
        b = (cx + rr * 0.7071, cy + rr * 0.7071)
        crescent = (f"M{a[0]:.1f},{a[1]:.1f} A{rr:.1f},{rr:.1f} 0 0 0 {b[0]:.1f},{b[1]:.1f} "
                    f"A{rr * 1.35:.1f},{rr * 1.35:.1f} 0 0 1 {a[0]:.1f},{a[1]:.1f} Z")
        markup = (f'<circle {circle} fill="{paper}" stroke="none"/>'
                  f'<circle {circle} fill="{color}" fill-opacity="{0.16 * tone:.2f}" stroke="none"/>'
                  f'<path d="{crescent}" fill="{color}" fill-opacity="{0.20 * tone:.2f}" stroke="none"/>'
                  f'<circle {circle} fill="none" stroke="{edge or color}" stroke-width="{self.sw}"/>')
        return self._add((x - r, y - r, z - r, x + r, y + r, z + r), markup)

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

    def cyl_y(self, x, y, z, r, length, color, tone=1.0, edge=None):
        """A cylinder lying along the world y axis: axis from (x, y, z) to
        (x, y + length, z). The +y end cap faces the viewer."""
        edge = edge or color
        ring = [(r * math.cos(t), r * math.sin(t))
                for t in (2 * math.pi * k / 28 for k in range(28))]
        far = [self.at(x + dx, y, z + dz) for dx, dz in ring]
        near = [self.at(x + dx, y + length, z + dz) for dx, dz in ring]
        hull = _hull(far + near)
        markup = (self._fill(hull, color, 0.24 * tone) + self._fill(near, color, 0.12 * tone)
                  + self._line(hull, edge, close=True) + self._line(near, edge, close=True))
        return self._add((x - r, y, z - r, x + r, y + length, z + r), markup)

    def prism(self, axis, a0, a1, profile, color, tone=1.0, edge=None):
        """A convex prism lying along the world `axis` ("x" or "y") from a0 to
        a1, its section the convex polygon `profile` of (c, z) points, c being
        the other floor coordinate: a car body seen from its side, a hopper, a
        sloped roof. Only the faces turned to the viewer are filled, each
        shaded by how much it looks along +x, +y and up, as a box's faces are,
        and every visible edge is stroked once."""
        if axis not in ("x", "y"):
            raise ValueError(f"axis must be x or y, not {axis!r}")
        if len(profile) < 3:
            raise ValueError("a prism needs a profile of three points or more")
        pts = [tuple(map(float, p)) for p in profile]
        area = sum(p[0] * q[1] - q[0] * p[1] for p, q in zip(pts, pts[1:] + pts[:1]))
        if area < 0:
            pts.reverse()
        lo, hi = min(a0, a1), max(a0, a1)

        def world(a, c, z):
            return (a, c, z) if axis == "x" else (c, a, z)

        faces = []  # (world points, outward normal)
        for (c0, z0), (c1, z1) in zip(pts, pts[1:] + pts[:1]):
            # Counter-clockwise in (c, z): the outward normal is (dz, -dc).
            nc, nz = z1 - z0, -(c1 - c0)
            normal = (0.0, nc, nz) if axis == "x" else (nc, 0.0, nz)
            faces.append(([world(lo, c0, z0), world(lo, c1, z1), world(hi, c1, z1),
                           world(hi, c0, z0)], normal))
        faces.append(([world(hi, c, z) for c, z in pts], (1.0, 0, 0) if axis == "x" else (0, 1.0, 0)))
        markup, edges = "", {}
        for points, (nx, ny, nz) in faces:
            if nx + ny + nz <= 1e-9:
                continue
            px, py, pz = max(nx, 0), max(ny, 0), max(nz, 0)
            shade = (0.22 * px + 0.36 * py + 0.09 * pz) / (px + py + pz)
            page = [self.at(*p) for p in points]
            markup += self._fill(page, color, shade * tone)
            for p, q in zip(page, page[1:] + page[:1]):
                key = tuple(sorted((tuple(round(v, 1) for v in p), tuple(round(v, 1) for v in q))))
                if key[0] != key[1]:
                    edges[key] = (p, q)
        d = " ".join(self._d([p, q], False) for p, q in edges.values())
        markup += (f'<path d="{d}" fill="none" stroke="{edge or color}" stroke-width="{self.sw}" '
                   f'stroke-linejoin="round" stroke-linecap="round"/>')
        cs, zs = [p[0] for p in pts], [p[1] for p in pts]
        if axis == "x":
            bbox = (lo, min(cs), min(zs), hi, max(cs), max(zs))
        else:
            bbox = (min(cs), lo, min(zs), max(cs), hi, max(zs))
        return self._add(bbox, markup)

    @contextmanager
    def ordered(self):
        """Parts added inside belong to one device and are painted in the order
        they were added. A cut-away needs this: what is seen through the
        opening (the far inside wall, then what stands inside) is painted
        before the near wall, an order no comparison of boxes can find."""
        outer, self._group = self._group, {"parts": []}
        try:
            yield
        finally:
            parts, self._group = self._group["parts"], outer
        if not parts:
            return
        boxes = [s["bbox"] for s in parts]
        bbox = tuple(min(b[i] for b in boxes) for i in range(3)) + \
            tuple(max(b[i] for b in boxes) for i in range(3, 6))
        solid = self._add(bbox, "".join(s["markup"] for s in parts))
        feet = [b for b in boxes if b[2] <= 0.5]
        if feet:
            solid["foot"] = (min(b[0] for b in feet), min(b[1] for b in feet), 0,
                             max(b[3] for b in feet), max(b[4] for b in feet), 0)

    # A point of a section across the x axis: the angle runs from the +y
    # direction (towards the viewer's left) up to +z, in degrees.
    def _ring(self, x, y, z, r, a0, a1, step=4.0):
        n = max(1, int(math.ceil(abs(a1 - a0) / step)))
        return [self.at(x, y + r * math.cos(math.radians(a0 + (a1 - a0) * k / n)),
                        z + r * math.sin(math.radians(a0 + (a1 - a0) * k / n)))
                for k in range(n + 1)]

    @staticmethod
    def _clip(a0, a1, lo, hi):
        """The parts of [a0, a1] whose angle, taken modulo 360, lies in [lo, hi]."""
        out = []
        for turn in range(-2, 3):
            b0, b1 = max(a0, lo + 360 * turn), min(a1, hi + 360 * turn)
            if b1 - b0 > 0.01:
                out.append((b0, b1))
        return out

    def shell_x(self, x, y, z, r_in, r_out, length, color, a0=0.0, a1=360.0, part="all",
                face=None, seams=True, tone=1.0, edge=None):
        """A hollow cylinder lying along x, kept between the angles a0 and a1
        of its section (a full ring when they are 360 apart): the yoke of a
        machine opened to show what turns inside. `part="back"` draws the far
        inside wall, `part="front"` the outside, the two cut faces and the +x
        end face; inside `ordered()`, add the back, then what stands inside,
        then the front. `face=(f0, f1)` limits the end face to those angles, and
        `seams=False` leaves out the two straight edges of that face, for a
        ring whose opened continuation draws them."""
        edge, full = edge or color, a1 - a0 >= 359.9
        x1, markup = x + length, ""
        if part in ("all", "back"):
            for b0, b1 in self._clip(a0, a1, 135, 315):
                patch = self._ring(x, y, z, r_in, b0, b1) + self._ring(x1, y, z, r_in, b1, b0)
                markup += (self._fill(patch, color, 0.42 * tone)
                           + self._line(self._ring(x, y, z, r_in, b0, b1), edge))
        if part in ("all", "front"):
            for b0, b1 in self._clip(a0, a1, -45, 135):
                patch = self._ring(x, y, z, r_out, b0, b1) + self._ring(x1, y, z, r_out, b1, b0)
                markup += self._fill(patch, color, 0.20 * tone)
                for c0, c1 in self._clip(b0, b1, -45, 25):
                    markup += self._fill(self._ring(x, y, z, r_out, c0, c1)
                                         + self._ring(x1, y, z, r_out, c1, c0), color, 0.16 * tone)
                markup += self._line(self._ring(x, y, z, r_out, b0, b1), edge)
                for a in (b0, b1):
                    if abs((a + 45) % 360) < 0.01 or abs((a - 135) % 360) < 0.01:
                        markup += self._line([self.at(x, *self._yz(y, z, r_out, a)),
                                              self.at(x1, *self._yz(y, z, r_out, a))], edge)
            if not full:
                for a, lo, hi in ((a0, 45, 225), (a1, -135, 45)):
                    if self._clip(a, a + 0.02, lo, hi):
                        quad = [self.at(x, *self._yz(y, z, r_in, a)), self.at(x, *self._yz(y, z, r_out, a)),
                                self.at(x1, *self._yz(y, z, r_out, a)), self.at(x1, *self._yz(y, z, r_in, a))]
                        # The edge at the +x end belongs to the end face.
                        markup += (self._fill(quad, color, 0.12 * tone)
                                   + self._line([quad[3], quad[0], quad[1], quad[2]], edge))
            f0, f1 = face or (a0, a1)
            ring = self._ring(x1, y, z, r_out, f0, f1) + self._ring(x1, y, z, r_in, f1, f0)
            markup += self._fill(ring, color, 0.09 * tone)
            if f1 - f0 >= 359.9:
                markup += (self._line(self._ring(x1, y, z, r_out, f0, f1), edge, close=True)
                           + self._line(self._ring(x1, y, z, r_in, f0, f1), edge, close=True))
            elif seams:
                markup += self._line(ring, edge, close=True)
            else:
                markup += (self._line(self._ring(x1, y, z, r_out, f0, f1), edge)
                           + self._line(self._ring(x1, y, z, r_in, f0, f1), edge))
        return self._add((x, y - r_out, z - r_out, x1, y + r_out, z + r_out), markup)

    @staticmethod
    def _yz(y, z, r, a):
        return y + r * math.cos(math.radians(a)), z + r * math.sin(math.radians(a))

    def sector_x(self, x, y, z, r0, r1, a0, a1, color, opacity=0.6, edge=None):
        """A flat piece of a ring on a section across x, facing the viewer: a
        slot and what lies in it, on an end face."""
        ring = self._ring(x, y, z, r1, a0, a1, 2.0) + self._ring(x, y, z, r0, a1, a0, 2.0)
        markup = self._fill(ring, color, opacity)
        if edge:
            markup += self._line(ring, edge, close=True)
        return self._add((x - 0.5, y - r1, z - r1, x, y + r1, z + r1), markup)

    def quad(self, points, color, opacity=0.6, edge=None):
        """A flat four-cornered piece through world points: a bar lying in a
        slot on a cut face."""
        page = [self.at(*p) for p in points]
        markup = self._fill(page, color, opacity)
        if edge:
            markup += self._line(page, edge, close=True)
        lo = tuple(min(p[i] for p in points) for i in range(3))
        hi = tuple(max(p[i] for p in points) for i in range(3))
        return self._add(lo + hi, markup)

    def lines_x(self, x, y, z, r, length, angles, color, sw=None):
        """Lines along x on the outside of a cylinder lying along x, at the
        given angles of its section; an angle on the far side is left out. The
        slots of a rotor body."""
        # Clear of the two silhouette lines, which the cylinder draws itself: a
        # line closer to one than 4 units on the page prints on top of it.
        margin = math.degrees(math.acos(max(-1.0, 1 - 4.0 / r)))
        seen = [a for a in angles if self._clip(a, a + 0.02, -45 + margin, 135 - margin)]
        markup = "".join(self._line([self.at(x, *self._yz(y, z, r, a)),
                                     self.at(x + length, *self._yz(y, z, r, a))], color, sw)
                         for a in seen)
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

    def callout(self, point, text, *, n=None, accent=None, size=None,
                prefer=("left", "right")):
        """A name for a part inside a device, at the world point a catalogue
        function returned for it: a dot on the part, a hairline leader and the
        name in free space beside the scene. `label()` keeps a name off the
        whole device and so cannot name a part inside one. Callouts are placed
        after the labels; a leader may cross solids but never another leader
        or a placed name, and the name itself touches nothing.

        `prefer` lists the sides tried in order: "left" and "right" put the
        name beside the part, "up" and "down" put it above or below the part
        with a vertical leader (a part on a wall whose sides are crowded).
        Any other word is tried as "right"."""
        self.callouts.append({"point": point, "text": text, "n": n, "accent": accent,
                              "size": size, "prefer": prefer})

    def _place_callouts(self, hulls, lines, placed):
        from common import BODY, MICRO, num_disc_r
        from svgkit import tw
        leaders, failed = [], []
        for spec in self.callouts:
            size = spec["size"] or BODY
            lead = (2 * num_disc_r(spec["n"], MICRO) + 8) if spec["n"] else 0
            w, h = tw(spec["text"], size, mono=False) + lead, size * 1.2
            px, py = self.at(*spec["point"])
            if self.leaders == "near":
                found = self._nearest_callout(spec, w, h, px, py, hulls, lines + leaders, placed,
                                              leaders, failed)
                if found is None:
                    continue
                r, end, side = found
                placed.append(r)
                leaders.append(((px, py), end))
                self._draw_callout(spec, size, lead, r, end, px, py)
                continue
            found = None
            cands = [(reach, rise, side)
                     for reach in (40, 70, 100, 140, 190, 250, 320, 400, 500)
                     for rise in (0, -30, 30, -60, 60, -100, 100, -150, 150, -210, 210)
                     for side in spec["prefer"]]
            if all(side in ("up", "down") for side in spec["prefer"]):
                # Above or below a part the shortest leader wins: a name
                # straight over the part before one slid far along the row.
                cands.sort(key=lambda t: math.hypot(t[0], t[1]))
            for reach, rise, side in cands:
                if side in ("up", "down"):
                    # `reach` is the height above or below the part and
                    # `rise` slides the name sideways along the row.
                    x0 = px + rise - w / 2
                    yc = py - reach if side == "up" else py + reach
                    r = (x0 - 4, yc - h / 2 - 3, x0 + w + 4, yc + h / 2 + 3)
                    ex = min(max(px, r[0] + 8), r[2] - 8)
                    end = (ex, r[3] + 3) if side == "up" else (ex, r[1] - 3)
                else:
                    x0 = px - reach - w if side == "left" else px + reach
                    r = (x0 - 4, py + rise - h / 2 - 3, x0 + w + 4, py + rise + h / 2 + 3)
                    end = ((r[2] + 3, py + rise) if side == "left"
                           else (r[0] - 3, py + rise))
                if r[0] < 8 or r[2] > self.c.w - 8 or r[1] < 4 or r[3] > self.c.h - 4:
                    continue
                if any(_rect_hits_poly(r, poly) for poly in hulls):
                    continue
                if any(_rect_hits_seg(r, a, b) for a, b in lines + leaders):
                    continue
                if any(_rects_meet(r, q) for q in placed):
                    continue
                if any(_rect_hits_seg(q, (px, py), end) for q in placed):
                    continue
                if any(_segs_cross((px, py), end, a, b) for a, b in leaders):
                    continue
                found = (r, end, side)
                break
            if not found:
                failed.append(spec["text"])
                continue
            r, end, side = found
            placed.append(r)
            leaders.append(((px, py), end))
            self._draw_callout(spec, size, lead, r, end, px, py)
        if failed:
            raise ValueError("no free place for the callout(s): " + ", ".join(failed))

    def _draw_callout(self, spec, size, lead, r, end, px, py):
        from common import MICRO, num_disc
        from svgkit import SANS
        self.c.add(self._line([(px, py), end], self.c.t["fg_dim"]))
        self.c.add(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="3.2" fill="{self.c.t["fg"]}"/>')
        x, base = r[0] + 4, (r[1] + r[3]) / 2 + size * 0.34
        if spec["n"]:
            num_disc(self.c, x + lead / 2 - 4, base - size * 0.34, spec["n"],
                     spec["accent"] or self.c.t["fg"], size=MICRO)
            x += lead
        self.c.text(x, base, spec["text"], size=size, color=self.c.t["fg"], family=SANS,
                    weight=600, anchor="start", halo=True, halo_width=self.halo)

    def _nearest_callout(self, spec, w, h, px, py, hulls, segs, placed, leaders, failed):
        """Every free place for a callout on all four sides; the shortest
        leader within `leader_max` wins, one crossing no other solid first and
        the side order of `prefer` breaking ties. A callout with no free place
        within the limit is added to `failed` with its nearest distance."""
        sides = [s if s in ("left", "right", "up", "down") else "right" for s in spec["prefer"]]
        sides = list(dict.fromkeys(sides + ["left", "right", "up", "down"]))
        best, nearest = None, None
        for reach in (4, 10, 16, 22, 28, 34, 40, 46, 52, 58, 64, 70, 76, 82, 88, 96, 110, 130,
                      160, 200, 250):
            for rise in (0, -12, 12, -24, 24, -36, 36, -48, 48, -64, 64, -84, 84, -110, 110):
                for rank, side in enumerate(sides):
                    # `reach` is the gap between the part and the name's
                    # near edge on every side, so a short reach never puts
                    # the name over its own part.
                    if side in ("up", "down"):
                        x0 = px + rise - w / 2
                        off = reach + h / 2 + 6
                        yc = py - off if side == "up" else py + off
                        r = (x0 - 4, yc - h / 2 - 3, x0 + w + 4, yc + h / 2 + 3)
                        ex = min(max(px, r[0] + 8), r[2] - 8)
                        end = (ex, r[3] + 3) if side == "up" else (ex, r[1] - 3)
                    else:
                        x0 = px - reach - w - 7 if side == "left" else px + reach + 7
                        r = (x0 - 4, py + rise - h / 2 - 3, x0 + w + 4, py + rise + h / 2 + 3)
                        end = ((r[2] + 3, py + rise) if side == "left"
                               else (r[0] - 3, py + rise))
                    length = math.dist((px, py), end)
                    if nearest is not None and length >= nearest:
                        continue
                    if r[0] < 8 or r[2] > self.c.w - 8 or r[1] < 4 or r[3] > self.c.h - 4:
                        continue
                    if (any(_rect_hits_poly(r, poly) for poly in hulls)
                            or any(_rect_hits_seg(r, a, b) for a, b in segs)
                            or any(_rects_meet(r, q) for q in placed)
                            or any(_rect_hits_seg(q, (px, py), end) for q in placed)
                            or any(_segs_cross((px, py), end, a, b) for a, b in leaders)):
                        continue
                    if length > self.leader_max:
                        nearest = length if nearest is None else min(nearest, length)
                        continue
                    crosses = sum(1 for poly in hulls
                                  if not _point_in_poly((px, py), poly)
                                  and _seg_hits_poly((px, py), end, poly))
                    key = (crosses > 0, round(length, 1), rank)
                    if best is None or key < best[0]:
                        best = (key, (r, end, side))
        if best is None:
            failed.append(f"{spec['text']} (nearest free place {nearest:.0f} from its part, "
                          f"limit {self.leader_max:g})" if nearest is not None
                          else spec["text"])
            return None
        return best[1]

    def _place_labels(self, hulls, lines):
        from common import BODY, MICRO, num_disc_r
        from svgkit import tw
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
            if self.leaders == "near":
                spot = self._nearest_label(spec, w, h, box, hulls, lines, placed, failed)
                if spot is None:
                    continue
                self._draw_label(spec, size, lead, spot)
                placed.append(spot)
                continue
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
            self._draw_label(spec, size, lead, spot)
        if failed:
            raise ValueError("no free place for the label(s): " + ", ".join(failed))
        return placed

    def _draw_label(self, spec, size, lead, spot):
        from common import MICRO, num_disc
        from svgkit import SANS
        x, base = spot[0] + 4, spot[1] + 3 + size * 0.92
        if spec["n"]:
            num_disc(self.c, x + lead / 2 - 4, base - size * 0.34, spec["n"],
                     spec["accent"] or self.c.t["fg"], size=MICRO)
            x += lead
        self.c.text(x, base, spec["text"], size=size, color=spec["color"] or self.c.t["fg"],
                    family=SANS, weight=600, anchor="start", halo=True, halo_width=self.halo)

    def _nearest_label(self, spec, w, h, box, hulls, lines, placed, failed):
        """The free place nearest the target's box on all four sides, `prefer`
        breaking ties; a label whose nearest free place is farther than
        `leader_max` is added to `failed` with that distance."""
        sides = [s for s in spec["prefer"] if s in ("above", "below", "left", "right")]
        sides = list(dict.fromkeys(sides + ["above", "right", "left", "below"]))
        cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
        cands = []
        for gap in (6, 10, 16, 22, 28, 36, 44, 54, 64, 76, 90, 110, 130):
            for rank, side in enumerate(sides):
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
                    cands.append((round(_rect_gap(r, box), 1), rank, abs(shift), r))
        cands.sort(key=lambda t: t[:3])
        for dist, _, _, r in cands:
            if r[0] < 8 or r[2] > self.c.w - 8 or r[1] < 4 or r[3] > self.c.h - 4:
                continue
            if any(_rect_hits_poly(r, poly) for poly in hulls):
                continue
            if any(_rect_hits_seg(r, a, b) for a, b in lines):
                continue
            if any(_rects_meet(r, q) for q in placed):
                continue
            if dist > self.leader_max:
                failed.append(f"{spec['text']} (nearest free place {dist:.0f} from its part, "
                              f"limit {self.leader_max:g})")
                return None
            return r
        failed.append(spec["text"])
        return None

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
        placed = self._place_labels(hulls, lines)
        if self.callouts:
            self._place_callouts(hulls, lines, placed)
        self.floor, self.solids, self.cables, self.labels = [], [], [], []
        self.callouts = []

    def top(self, solid):
        """Page point above a solid's highest corner, for a label over it."""
        x0, y0, _, x1, y1, z1 = solid["bbox"]
        return self.at((x0 + x1) / 2, (y0 + y1) / 2, z1)[0], self.at(x0, y0, z1)[1]


def _meets_face(point, other, foot, corner=0.2, clear=16.0):
    """The cable end is on the +x or +y edge of a footprint, away from the
    corners, and its last run is square to that edge. Away means a fifth of
    the face, or `clear` units on a face long enough that a fifth is more: a
    cable reads as the face's edge continued when it is near the corner, not
    when it is a fraction of a long row away from it."""
    (px, py), (qx, qy) = point, other
    x0, y0, _, x1, y1, _ = foot
    mx, my = min((x1 - x0) * corner, clear), min((y1 - y0) * corner, clear)
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


def _rect_gap(r, q):
    """Distance between two page rectangles, 0 when they meet."""
    dx = max(q[0] - r[2], r[0] - q[2], 0.0)
    dy = max(q[1] - r[3], r[1] - q[3], 0.0)
    return math.hypot(dx, dy)


def _point_in_poly(p, poly):
    """A page point inside a counter-clockwise convex polygon."""
    if len(poly) < 3:
        return False
    return all((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0
               for a, b in zip(poly, poly[1:] + poly[:1]))


def _seg_hits_poly(a, b, poly):
    """A page segment enters a convex polygon."""
    if len(poly) < 3:
        return False
    if _point_in_poly(a, poly) or _point_in_poly(b, poly):
        return True
    return any(_segs_cross(a, b, p, q) for p, q in zip(poly, poly[1:] + poly[:1]))


def _rects_meet(r, q):
    return r[0] < q[2] and q[0] < r[2] and r[1] < q[3] and q[1] < r[3]


def _segs_cross(p, q, a, b):
    """Two page segments cross or touch."""
    def turn(o, s, t):
        v = (s[0] - o[0]) * (t[1] - o[1]) - (s[1] - o[1]) * (t[0] - o[0])
        return 0 if abs(v) < 1e-9 else (1 if v > 0 else -1)
    d1, d2, d3, d4 = turn(a, b, p), turn(a, b, q), turn(p, q, a), turn(p, q, b)
    if d1 != d2 and d3 != d4:
        return True
    return False


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
