"""Plant, electrical-room, server-room and control-room equipment built from
Scene solids.

Conventions, shared with `power`:

- Every function adds one device and returns a dict holding `solid` (the
  label target) and the points other parts connect to.
- `facing` is the side a device's front looks at: "x" (its front is the +x
  face) or "y" (the +y face). A device against the low-x back wall of a
  cut-away room faces "x", one against the low-y wall faces "y". A device
  facing "-x" or "-y" turns its front away from the viewer and shows its back
  (a desk whose monitors look at a video wall).
- A floor-standing device is placed by the centre of its footprint and
  returns `port(f)`: the foot of its front face at the fraction f from the
  viewer's left (0) to right (1), where a floor cable arrives square to the
  face. A device facing away returns the same on its back as `back(f)`.
- A wall-mounted device is placed by the point on the wall face behind the
  middle of its bottom edge, with `z` its bottom height. It has no foot, so a
  floor cable cannot end on it: `conduit=True` stands a riser under it and
  returns the riser's `port`.
- Parts inside a device are returned as world points for `Scene.callout`.
"""
import math


def palette(canvas):
    """Colours for the catalogue, registered on the figure's canvas."""
    canvas.add_accent("brown", "#8a4f2a")
    t = canvas.t
    return {"steel": t["muted"], "housing": canvas.blue, "screen": t["fg_dim"],
            "ok": canvas.green, "warn": canvas.yellow, "alarm": canvas.red,
            "live": canvas.orange, "copper": canvas.brown, "gas": canvas.yellow,
            "heat": canvas.red, "data": canvas.teal, "wall": t["muted"]}


class Face:
    """The local frame of a device whose front looks at `facing`: `u` runs
    along the front from the viewer's left, `w` from the back (0) towards the
    front (`depth`), z up. (bx, by) is the middle of the back edge."""

    def __init__(self, sc, bx, by, width, depth, facing):
        if facing not in ("x", "y", "-x", "-y"):
            raise ValueError(f"facing must be x, y, -x or -y, not {facing!r}")
        self.sc, self.bx, self.by = sc, bx, by
        self.width, self.depth, self.facing = width, depth, facing
        self.seen = facing in ("x", "y")

    def point(self, u, w, z=0.0):
        bx, by, half = self.bx, self.by, self.width / 2
        return {"x": (bx + w, by + half - u, z), "y": (bx - half + u, by + w, z),
                "-x": (bx - w, by - half + u, z), "-y": (bx + half - u, by - w, z)}[self.facing]

    def box(self, u, w, z, du, dw, dz, color, tone=1.0):
        bx, by, half = self.bx, self.by, self.width / 2
        if self.facing == "x":
            return self.sc.box(bx + w, by + half - u - du, z, dw, du, dz, color, tone)
        if self.facing == "y":
            return self.sc.box(bx - half + u, by + w, z, du, dw, dz, color, tone)
        if self.facing == "-x":
            return self.sc.box(bx - w - dw, by - half + u, z, dw, du, dz, color, tone)
        return self.sc.box(bx + half - u - du, by - w - dw, z, du, dw, dz, color, tone)

    def panel(self, u, z, du, dz, color, opacity, w=None):
        """A flat piece on the front plane (or on the plane at depth `w`),
        with no outline, so it shares no edge with the face it lies on."""
        w = self.depth if w is None else w
        pts = [self.point(u, w, z), self.point(u + du, w, z),
               self.point(u + du, w, z + dz), self.point(u, w, z + dz)]
        return self.sc.quad(pts, color, opacity)

    def port(self, f=0.5):
        return self.point(f * self.width, self.depth)[:2]

    def back(self, f=0.5):
        return self.point(f * self.width, 0)[:2]


def _centred(sc, x, y, width, depth, facing):
    """The frame of a floor-standing device placed by its footprint centre."""
    off = {"x": (-depth / 2, 0), "y": (0, -depth / 2),
           "-x": (depth / 2, 0), "-y": (0, depth / 2)}[facing]
    return Face(sc, x + off[0], y + off[1], width, depth, facing)


def _result(sc, face, **extra):
    out = {"solid": sc.solids[-1], "facing": face.facing, "face": face}
    out["port" if face.seen else "back"] = face.port if face.seen else face.back
    out.update(extra)
    return out


def _lamps(face, u, z, colors, size=5, gap=3):
    """Indicator lamps in a row on the front: small proud squares."""
    for k, color in enumerate(colors):
        face.box(u + k * (size + gap), face.depth, z, size, 1.5, size, color, tone=2.2)


def _screen(face, u, z, du, dz, pal, content=("data",), w=None):
    """A dark screen on the front with a few lines of content."""
    face.panel(u, z, du, dz, pal["screen"], 0.82, w)
    rows = len(content)
    for k, key in enumerate(content):
        h = (dz - 4) / rows
        face.panel(u + 3, z + dz - 2 - h * (k + 1) + h * 0.3, (du - 6) * (0.9 - 0.25 * (k % 2)),
                   h * 0.4, pal[key], 0.95, w)


def conduit(sc, x, y, top, pal, facing="x", size=8):
    """A cable riser standing on the floor against a wall, from the floor to
    `top`: the way a floor cable reaches a wall-mounted device. (x, y) is the
    wall-face point the riser stands at; `port` is the foot of its front."""
    face = Face(sc, x, y, size, size, facing)
    with sc.group():
        face.box(0, 0, 0, size, size, top, pal["steel"], tone=0.9)
    return {"solid": sc.solids[-1], "port": face.port(0.5)}


def _mounted(sc, x, y, z, pal, facing, conduit_top, width, draw):
    """Draw a wall-mounted device and, when asked, the riser under it."""
    out = {}
    if conduit_top:
        riser = conduit(sc, *Face(sc, x, y, width, 0, facing).point(width / 2, 0)[:2],
                        z, pal, facing)
        out["port"] = riser["port"]
    face = draw()
    out.update({"solid": sc.solids[-1], "facing": facing, "face": face})
    return out


# -- buildings ---------------------------------------------------------------

def factory_hall(sc, x0, y0, x1, y1, color, pal, wall=40, thick=6, floor=True, windows=True):
    """A production hall drawn cut away: its floor and low walls on the two
    far edges (the -x and -y sides), never a roof, so what stands inside is
    seen. Each wall is its own solid, so a device inside is ordered against
    the wall it stands at. A device against the low-x wall faces "x" and
    stands with its back at `wall_x`; against the low-y wall it faces "y" at
    `wall_y`. Window bands lie on the walls' inside faces."""
    if floor:
        sc.island(x0, y0, x1, y1, color)
    band = wall * 0.3
    pts = lambda xa, ya, xb, yb: [(xa, ya, wall - 6 - band), (xb, yb, wall - 6 - band),  # noqa: E731
                                  (xb, yb, wall - 6), (xa, ya, wall - 6)]
    # The window band lies exactly on the wall's inside face, inside the
    # wall's group: a band standing off the face would interpenetrate the
    # box of a device standing against the wall and be ordered by centre depth.
    with sc.group():
        sc.box(x0, y0, 0, thick, y1 - y0, wall, pal["wall"], tone=0.6)
        if windows and wall >= 30:
            sc.quad(pts(x0 + thick, y1 - 8, x0 + thick, y0 + thick + 8), pal["data"], 0.18)
    wall_a = sc.solids[-1]
    with sc.group():
        sc.box(x0 + thick, y0, 0, x1 - x0 - thick, thick, wall, pal["wall"], tone=0.6)
        if windows and wall >= 30:
            sc.quad(pts(x0 + thick + 8, y0 + thick, x1 - 8, y0 + thick), pal["data"], 0.18)
    return {"solid": wall_a, "wall_x": x0 + thick, "wall_y": y0 + thick,
            "corner": (x1, y1, 0)}


def factory_building(sc, x, y, w, d, h, color, pal, roof="saw", teeth=4, door="x"):
    """A closed factory block for a site scene where several factories stand
    on one board: walls, a saw-tooth roof whose glazed faces look at +x (or a
    flat roof with a parapet, `roof="flat"`), a window band and a roll-up
    door on the face `door` names ("x" or "y"). Returns `door_port`, the foot
    of the door, where a cable or a road arrives."""
    x0, y0 = x - w / 2, y - d / 2
    with sc.ordered():
        sc.box(x0, y0, 0, w, d, h, color)
        if roof == "saw":
            step, rise = w / teeth, min(22.0, h * 0.45)
            for k in range(teeth):
                xa, xb = x0 + k * step, x0 + (k + 1) * step
                # Faces without outlines, then each visible edge once: the
                # teeth share edges with each other and with the block.
                sc.quad([(xa, y0, h), (xb, y0, h + rise), (xb, y0 + d, h + rise), (xa, y0 + d, h)],
                        color, 0.12)
                sc.quad([(xb, y0, h), (xb, y0 + d, h), (xb, y0 + d, h + rise), (xb, y0, h + rise)],
                        pal["data"], 0.30)
                sc.quad([(xa, y0 + d, h), (xb, y0 + d, h), (xb, y0 + d, h + rise)], color, 0.30)
                edges = [((xa, y0, h), (xb, y0, h + rise)), ((xa, y0 + d, h), (xb, y0 + d, h + rise)),
                         ((xb, y0, h + rise), (xb, y0 + d, h + rise)),
                         ((xb, y0, h), (xb, y0, h + rise)), ((xb, y0 + d, h), (xb, y0 + d, h + rise))]
                if k < teeth - 1:
                    edges.append(((xb, y0, h), (xb, y0 + d, h)))
                sc.truss(edges, color)
        else:
            sc.box(x0 + 10, y0 + 10, h, w - 20, d - 20, 6, color)
        band = h * 0.22
        sc.quad([(x0 + w + 0.1, y0 + d - 8, h * 0.58), (x0 + w + 0.1, y0 + 8, h * 0.58),
                 (x0 + w + 0.1, y0 + 8, h * 0.58 + band), (x0 + w + 0.1, y0 + d - 8, h * 0.58 + band)],
                pal["data"], 0.22)
        sc.quad([(x0 + 8, y0 + d + 0.1, h * 0.58), (x0 + w - 8, y0 + d + 0.1, h * 0.58),
                 (x0 + w - 8, y0 + d + 0.1, h * 0.58 + band), (x0 + 8, y0 + d + 0.1, h * 0.58 + band)],
                pal["data"], 0.22)
        dw, dh = min(30.0, (d if door == "x" else w) * 0.35), min(34.0, h * 0.5)
        if door == "x":
            sc.box(x0 + w, y + 6, 0, 4, dw, dh, pal["steel"])
            for k in range(1, 4):
                sc.quad([(x0 + w + 4.1, y + 9, dh * k / 4), (x0 + w + 4.1, y + 3 + dw, dh * k / 4),
                         (x0 + w + 4.1, y + 3 + dw, dh * k / 4 + 1.2), (x0 + w + 4.1, y + 9, dh * k / 4 + 1.2)],
                        pal["steel"], 0.8)
            port = (x0 + w + 4, y + 6 + dw / 2)
        else:
            sc.box(x - 6 - dw, y0 + d, 0, dw, 4, dh, pal["steel"])
            for k in range(1, 4):
                sc.quad([(x - 3 - dw, y0 + d + 4.1, dh * k / 4), (x - 9, y0 + d + 4.1, dh * k / 4),
                         (x - 9, y0 + d + 4.1, dh * k / 4 + 1.2), (x - 3 - dw, y0 + d + 4.1, dh * k / 4 + 1.2)],
                        pal["steel"], 0.8)
            port = (x - 6 - dw / 2, y0 + d + 4)
    return {"solid": sc.solids[-1], "door_port": port}


# -- loads -------------------------------------------------------------------

_MACHINE = {"s": (56, 44, 44), "m": (84, 52, 52), "l": (132, 60, 60)}


def machine(sc, x, y, color, pal, size="m", facing="x"):
    """A production machine that reads as a load: a steel bed, the machine
    housing with a viewing window, an operator panel with a screen standing
    at its right end and a three-colour stack lamp on top. `size` is "s",
    "m" or "l"; "l" is a long machine with two windows. The front
    (window, panel screen) is drawn on the face `facing` names. Returns the
    floor `port` and `panel`, a point on the operator panel."""
    width, depth, height = _MACHINE[size]
    face = _centred(sc, x, y, width, depth, facing)
    # Offsets chosen so that no two edges of the bed, the housing and the
    # panel print within 4 units of each other (w - z and u - z apart, and
    # no two vertical edges in one column on the page).
    house, ctop = width - 27, height - 10
    with sc.ordered():
        face.box(0, 0, 0, width, depth, 8, pal["steel"])
        face.box(5, 5, 8, house, depth - 13, height, color)
        if face.seen:
            windows = 2 if size == "l" else 1
            span = house / windows
            for k in range(windows):
                face.panel(5 + span * k + span * 0.18, 8 + height * 0.35, span * 0.6, height * 0.42,
                           pal["screen"], 0.55, w=depth - 8 + 0.05)
        pu = width - 14
        face.box(pu, depth - 12, 8, 10, 8, ctop - 8, color, tone=1.2)
        if face.seen:
            _screen(face, pu + 1.5, ctop - 16, 7, 12, pal, ("ok",), w=depth - 4 + 0.05)
        lamp = face.point(12, 12, 8 + height)
        sc.cyl(lamp[0], lamp[1], 1.4, 6, pal["steel"], z=lamp[2])
        for k, key in enumerate(("ok", "warn", "alarm")):
            sc.cyl(lamp[0], lamp[1], 4.2, 5, pal[key], z=lamp[2] + 6 + 5 * k, tone=2.0)
    return _result(sc, face, panel=face.point(pu + 5, depth - 4, ctop - 10))


# -- electrical room -------------------------------------------------------------

def switchgear(sc, x, y, color, pal, cubicles=4, facing="x", height=112, cubicle=44, depth=52):
    """A row of metal-clad switchgear cubicles: plinth, one body, a door per
    cubicle with a meter, indicator lamps and a handle, and a cable tray on
    top with an entry box at the far end. `port(f)` is the foot of the front,
    `cubicle(k)` the foot of cubicle k's door, `entry` the top of the cable
    entry box (a riser from above ends there), `meter(k)` the meter of
    cubicle k for a callout."""
    width = cubicles * cubicle
    face = _centred(sc, x, y, width, depth, facing)
    with sc.ordered():
        face.box(0, 0, 0, width, depth, 8, pal["steel"])
        face.box(2, 2, 8, width - 4, depth - 4, height - 8, color)
        face.box(10, 10, height, width - 20, 18, 8, pal["steel"])
        face.box(width - 34, 6, height + 8, 24, 26, 10, pal["steel"], tone=1.2)
        if face.seen:
            for k in range(cubicles):
                u = k * cubicle
                face.panel(u + 5, 14, cubicle - 10, height - 22, color, 0.30, w=depth - 1.95)
                face.box(u + 10, depth - 0.5, height - 36, 18, 4, 14, pal["steel"], tone=1.2)
                face.panel(u + 12, height - 33, 14, 8, pal["screen"], 0.85, w=depth + 3.55)
                _lamps(face, u + 10, height - 48, (pal["ok"], pal["alarm"]))
                face.box(u + cubicle - 12, depth - 0.5, 50, 3, 2, 16, pal["steel"])
    top = face.point(width - 22, 19, height + 18)
    return _result(sc, face, entry=top,
                   cubicle=lambda k: face.port((k + 0.5) / cubicles),
                   meter=lambda k: face.point(k * cubicle + 19, depth + 3.5, height - 29))


def panel_board(sc, x, y, color, pal, opened=False, facing="x", width=110, height=170,
                depth=26, branches=6, clamps=(), leakage=False, modules=(), plinth=10):
    """A distribution board standing on the floor against a wall.

    Closed: the cabinet with its door, a handle and a nameplate. Opened: the
    door stands open on the far side and the inside is seen - the main
    breaker at the top, a busbar, a row of `branches` branch breakers with a
    conductor dropping from each into the wiring duct below, and a DIN rail
    near the bottom. `clamps` lists the branches that carry a clamp-on
    current sensor; `leakage=True` puts a zero-phase current sensor round the
    main feeder, which passes every conductor of the circuit through one
    ring. `modules` names what sits on the DIN rail, left to right: "sensor"
    (a multi-sensor unit) and "gateway" (a data unit with its antenna on the
    cabinet top). The inside needs a front that faces the viewer.

    Returns `port`, and for callouts `main`, `branch(k)`, `clamp(k)`,
    `leak`, `module(name)` and `duct`."""
    face = _centred(sc, x, y, width, depth, facing)
    if opened and not face.seen:
        raise ValueError("an opened panel board needs facing x or y")
    out_pts = {}
    steel, body = pal["steel"], color
    top_z = plinth + height
    sx = (width - 30) / max(1, branches - 1)
    branch_u = [15 + sx * k for k in range(branches)]
    bz = top_z - 82
    with sc.ordered():
        face.box(0, 0, 0, width, depth, plinth, steel)
        if not opened:
            face.box(0, 0, plinth, width, depth - 2, height, body)
            if face.seen:
                face.panel(5, plinth + 5, width - 10, height - 10, body, 0.30, w=depth - 1.95)
                face.box(width - 16, depth - 0.5, plinth + height * 0.45, 4, 2, 20, steel)
                face.panel(width * 0.3, top_z - 30, width * 0.4, 12, steel, 0.5, w=depth - 0.45)
        else:
            far_u = width - 4 if facing == "x" else 0
            near_u = 0 if facing == "x" else width - 4
            # The door swings open on the far side: on the near side it would
            # stand between the viewer and the inside.
            face.box(width if facing == "x" else -5, depth, plinth + 4, 5, width * 0.8,
                     height - 14, body, tone=0.8)
            inner = depth - 8
            face.box(0, 0, plinth, width, 4, height - 5, body, tone=0.7)
            face.box(far_u, 4, plinth, 4, inner, height - 5, body)
            face.box(4, 4, plinth, width - 8, inner, 8, body)
            # The back plate's parts, top to bottom.
            face.box(8, 4, top_z - 21, width - 16, 6, 13, steel, tone=0.8)
            face.box(width / 2 - 13, 4, top_z - 50, 26, 11, 28, steel, tone=1.3)
            face.box(width / 2 - 3, 15, top_z - 40, 6, 2, 9, pal["alarm"], tone=1.6)
            out_pts["main"] = face.point(width / 2 + 9, 15, top_z - 30)
            for du in (-6, 0, 6):
                sc.wire(face.point(width / 2 + du, 15, top_z - 50), face.point(width / 2 + du, 15, top_z - 58),
                        pal["copper"], sw=1.9)
            face.box(10, 4, top_z - 63, width - 20, 14, 5, pal["copper"], tone=1.4)
            if leakage:
                leak = face.point(width / 2, 15, 0)
                sc.cyl(leak[0], leak[1], 10, 3.5, pal["data"], z=top_z - 56, tone=1.8)
                out_pts["leak"] = face.point(width / 2 + 10, 15, top_z - 54)
            for k, u in enumerate(branch_u):
                face.box(u - 4.5, 4, bz, 9, 9, 18, steel, tone=1.3)
                face.box(u - 1.5, 13, bz + 9, 3, 1.5, 5, pal["ok"], tone=1.6)
                out_pts[("branch", k)] = face.point(u, 13, bz + 14)
                sc.wire(face.point(u, 8.5, bz - 1), face.point(u, 8.5, plinth + 46), pal["copper"], sw=1.9)
                if k in clamps:
                    c = face.point(u, 8.5, bz - 34)
                    sc.cyl(c[0], c[1], 5, 9, pal["data"], z=bz - 38, tone=1.8)
                    out_pts[("clamp", k)] = face.point(u, 8.5 + 5, bz - 30)
            face.box(8, 4, plinth + 34, width - 16, 9, 11, steel, tone=0.8)
            out_pts["duct"] = face.point(14, 13, plinth + 40)
            face.box(8, 4, plinth + 14, width - 16, 3, 4, steel)
            mu = 12
            for name in modules:
                if name == "sensor":
                    _sensor_body(face, mu, 7, plinth + 12, pal)
                    out_pts[("module", name)] = face.point(mu + 9, 15, plinth + 24)
                    mu += 26
                elif name == "gateway":
                    _gateway_body(face, mu, 7, plinth + 12, pal, antenna=False)
                    out_pts[("module", name)] = face.point(mu + 14, 17, plinth + 26)
                    mu += 38
                else:
                    raise ValueError(f"unknown module {name!r}: sensor or gateway")
            face.box(near_u, 4, plinth, 4, inner, height - 5, body)
            face.box(-8, 0, top_z - 5, width + 16, depth - 4, 5, body)
            if "gateway" in modules:
                a = face.point(width - 14, 10, top_z)
                sc.cyl(a[0], a[1], 1.6, 26, steel, z=top_z)
                sc.cyl(a[0], a[1], 3.2, 6, pal["data"], z=top_z + 26)
    return _result(sc, face, main=out_pts.get("main"), leak=out_pts.get("leak"),
                   duct=out_pts.get("duct"),
                   branch=lambda k: out_pts[("branch", k)],
                   clamp=lambda k: out_pts[("clamp", k)],
                   module=lambda name: out_pts[("module", name)])


def clamp_sensor(sc, point, pal, axis="z", r=6, length=9, color=None):
    """A clamp-on current sensor round a conductor running along `axis`
    ("x", "y" or "z") through the world point `point`. A leakage sensor of
    the zero-phase kind is the same ring made large enough to take every
    conductor of the circuit; draw it with a radius that encloses them all.
    Returns the solid and `point`, a spot on the ring for a callout."""
    color = color or pal["data"]
    x, y, z = point
    with sc.group():
        if axis == "z":
            sc.cyl(x, y, r, length, color, z=z - length / 2, tone=1.8)
        elif axis == "x":
            sc.cyl_x(x - length / 2, y, z, r, length, color, tone=1.8)
        else:
            sc.cyl_y(x, y - length / 2, z, r, length, color, tone=1.8)
    spot = {"z": (x + r, y, z), "x": (x + length / 2, y, z + r), "y": (x, y + length / 2, z + r)}
    return {"solid": sc.solids[-1], "point": spot[axis]}


def _sensor_body(face, u, w, z, pal, width=18, depth=9, height=24):
    """A small multi-sensor unit: a body with a terminal strip at its foot, a
    round-cornered window and one lamp, no antenna."""
    face.box(u, w, z, width, depth, height, pal["steel"], tone=1.5)
    face.panel(u + 2, z + 2, width - 4, 5, pal["steel"], 0.8, w=w + depth + 0.05)
    face.panel(u + 4, z + height - 11, width - 8, 7, pal["data"], 0.75, w=w + depth + 0.05)
    _lamp(face, u + width / 2 - 2, w + depth, z + 9, pal["ok"])


def _lamp(face, u, w, z, color):
    face.box(u, w, z, 4, 1.5, 4, color, tone=2.2)


def _gateway_body(face, u, w, z, pal, width=28, depth=12, height=30, antenna=True):
    """A data unit (gateway, RTU, edge device): a wider body with a row of
    three status lamps, a port block at its foot and, outdoors or on a wall,
    an antenna on top. The antenna is what tells it from a sensor unit at
    print size."""
    face.box(u, w, z, width, depth, height, pal["housing"])
    face.panel(u + 4, z + 3, width - 8, 6, pal["steel"], 0.8, w=w + depth + 0.05)
    for k, key in enumerate(("ok", "data", "warn")):
        _lamp(face, u + 5 + 7 * k, w + depth, z + height - 10, pal[key])
    if antenna:
        a = face.point(u + width - 5, w + depth / 2, z + height)
        face.sc.cyl(a[0], a[1], 1.6, 28, pal["steel"], z=a[2])
        face.sc.cyl(a[0], a[1], 3.4, 6, pal["data"], z=a[2] + 28)


def sensor_box(sc, x, y, z, pal, facing="x", conduit=False):
    """A multi-sensor unit mounted on a wall at height z (see the module's
    wall-mount convention). For one inside a board, pass "sensor" to
    `panel_board(modules=...)`."""
    def draw():
        face = Face(sc, x, y, 18, 9, facing)
        with sc.group():
            _sensor_body(face, 0, 0, z, pal)
        return face
    return _mounted(sc, x, y, z, pal, facing, conduit, 18, draw)


def gateway(sc, x, y, z, pal, facing="x", conduit=False, antenna=True):
    """A gateway, RTU or edge data unit mounted on a wall at height z, with
    status lamps and an antenna. For one inside a board, pass "gateway" to
    `panel_board(modules=...)`, which puts the antenna on the cabinet top."""
    def draw():
        face = Face(sc, x, y, 28, 12, facing)
        with sc.group():
            _gateway_body(face, 0, 0, z, pal, antenna=antenna)
        return face
    out = _mounted(sc, x, y, z, pal, facing, conduit, 28, draw)
    out["top"] = out["face"].point(14, 12, z + 30)
    return out


def meter(sc, x, y, z, pal, facing="x", conduit=False, color=None):
    """A power meter on a wall at height z: a body with a display window, a
    pulse lamp and a terminal cover at its foot."""
    color = color or pal["housing"]

    def draw():
        face = Face(sc, x, y, 26, 12, facing)
        with sc.group():
            face.box(0, 0, z, 26, 12, 36, color, tone=0.9)
            face.panel(3, z + 2, 20, 9, pal["steel"], 0.6, w=12.05)
            if face.seen:
                face.panel(4, z + 20, 18, 10, pal["screen"], 0.85, w=12.05)
                face.panel(6, z + 23, 12, 4, pal["ok"], 0.95, w=12.1)
                _lamp(face, 11, 12, z + 13, pal["alarm"])
        return face
    out = _mounted(sc, x, y, z, pal, facing, conduit, 26, draw)
    out["display"] = out["face"].point(13, 12, z + 25)
    return out


# -- pipes and the meters on them ----------------------------------------------------

def pipe_run(sc, points, z, pal, color=None, r=6, supports=True, spacing=90):
    """A pipe through floor points (x, y) at height z, every run along one of
    the two floor directions, with a fitting at each turn and, when it runs
    along the ground, a stand under it at each turn and every `spacing`
    units. A pipe stops at a meter's `pipe_in` and starts again at its
    `pipe_out`, as a conductor stops at a terminal. Each stand is its own
    solid, so a run claims no ground but its stands."""
    color = color or pal["gas"]
    pts = [tuple(p[:2]) for p in points]
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        if abs(x1 - x2) > 0.01 and abs(y1 - y2) > 0.01:
            raise ValueError(f"pipe run {(x1, y1)}->{(x2, y2)} follows neither floor direction")
    with sc.ordered():
        # Far runs first: a nearer run passes in front of a farther one.
        for (x1, y1), (x2, y2) in sorted(zip(pts, pts[1:]),
                                         key=lambda s: min(s[0][0] + s[0][1], s[1][0] + s[1][1])):
            if abs(y1 - y2) < 0.01:
                sc.cyl_x(min(x1, x2), y1, z, r, abs(x2 - x1), color)
            else:
                sc.cyl_y(x1, min(y1, y2), z, r, abs(y2 - y1), color)
        for px, py in pts[1:-1]:
            sc.cyl(px, py, r * 1.3, 2 * r + 3, color, z=z - r - 1.5, tone=1.2)
    run = sc.solids[-1]
    if supports and z - r > 4:
        spots = list(pts[1:-1])
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            length = math.hypot(x2 - x1, y2 - y1)
            for k in range(1, int(length // spacing) + 1):
                f = k * spacing / length
                # Clear of both ends, where a meter or a fitting stands.
                if 30 / length < f < 1 - 30 / length:
                    spots.append((x1 + (x2 - x1) * f, y1 + (y2 - y1) * f))
        for px, py in spots:
            with sc.group():
                sc.box_at(px, py, 10, 10, 2, pal["steel"])
                sc.box_at(px, py, 4, 4, z - r * (1.3 if (px, py) in pts else 1) - 2, pal["steel"], z=2)
    return {"solid": run}


def _inline(sc, x, y, z, axis, half):
    """The two points a pipe along `axis` ends on, `half` each side of (x, y, z)."""
    if axis == "x":
        return (x - half, y, z), (x + half, y, z)
    if axis == "y":
        return (x, y - half, z), (x, y + half, z)
    raise ValueError(f"axis must be x or y, not {axis!r}")


def gas_meter(sc, x, y, z, pal, axis="x", color=None):
    """A diaphragm gas meter under a pipe running along `axis` at height z:
    the body with an index window on its visible side, standing on a stand,
    and an inlet and an outlet stub rising from its top to the pipe. The pipe
    ends at `pipe_in` and starts again at `pipe_out`."""
    color = color or pal["gas"]
    top = z - 14
    along, across, tall = 40, 26, min(40.0, top - 8)
    with sc.ordered():
        if axis == "x":
            sc.box_at(x, y, 16, 16, top - tall, pal["steel"])
            sc.box(x - along / 2, y - across / 2, top - tall, along, across, tall, color, tone=0.9)
            sc.quad([(x - 10, y + across / 2 + 0.05, top - 16), (x + 10, y + across / 2 + 0.05, top - 16),
                     (x + 10, y + across / 2 + 0.05, top - 6), (x - 10, y + across / 2 + 0.05, top - 6)],
                    pal["screen"], 0.85)
            for dx in (-12, 12):
                sc.cyl(x + dx, y, 4.5, z - top + 4, color, z=top, tone=1.3)
        else:
            sc.box_at(x, y, 16, 16, top - tall, pal["steel"])
            sc.box(x - across / 2, y - along / 2, top - tall, across, along, tall, color, tone=0.9)
            sc.quad([(x + across / 2 + 0.05, y + 10, top - 16), (x + across / 2 + 0.05, y - 10, top - 16),
                     (x + across / 2 + 0.05, y - 10, top - 6), (x + across / 2 + 0.05, y + 10, top - 6)],
                    pal["screen"], 0.85)
            for dy in (-12, 12):
                sc.cyl(x, y + dy, 4.5, z - top + 4, color, z=top, tone=1.3)
    pin, pout = _inline(sc, x, y, z, axis, 16.5)
    side = (x, y + across / 2, top - 11) if axis == "x" else (x + across / 2, y, top - 11)
    return {"solid": sc.solids[-1], "pipe_in": pin, "pipe_out": pout, "index": side}


def heat_meter(sc, x, y, z, pal, axis="x", r=6, color=None):
    """A heat meter on a pipe along `axis` at height z: the flow section
    between two flanges, a neck and the calculator head with its display on
    the visible side. The pipe ends at `pipe_in` and starts at `pipe_out`.
    Pair it with a supply and a return pipe when both are shown."""
    color = color or pal["heat"]
    length, fr = 30, r + 6
    with sc.ordered():
        if axis == "x":
            sc.cyl_x(x - length / 2, y, z, fr, 4, pal["steel"])
            sc.cyl_x(x - length / 2 + 4, y, z, r + 3, length - 8, color)
            sc.cyl_x(x + length / 2 - 4, y, z, fr, 4, pal["steel"])
            sc.cyl(x, y, 2.5, 10, pal["steel"], z=z + r + 3)
            sc.box(x - 13, y - 7, z + r + 13, 26, 14, 20, pal["housing"])
            sc.quad([(x - 9, y + 7.05, z + r + 19), (x + 9, y + 7.05, z + r + 19),
                     (x + 9, y + 7.05, z + r + 29), (x - 9, y + 7.05, z + r + 29)], pal["screen"], 0.85)
        else:
            sc.cyl_y(x, y - length / 2, z, fr, 4, pal["steel"])
            sc.cyl_y(x, y - length / 2 + 4, z, r + 3, length - 8, color)
            sc.cyl_y(x, y + length / 2 - 4, z, fr, 4, pal["steel"])
            sc.cyl(x, y, 2.5, 10, pal["steel"], z=z + r + 3)
            sc.box(x - 7, y - 13, z + r + 13, 14, 26, 20, pal["housing"])
            sc.quad([(x + 7.05, y + 9, z + r + 19), (x + 7.05, y - 9, z + r + 19),
                     (x + 7.05, y - 9, z + r + 29), (x + 7.05, y + 9, z + r + 29)], pal["screen"], 0.85)
    pin, pout = _inline(sc, x, y, z, axis, length / 2)
    return {"solid": sc.solids[-1], "pipe_in": pin, "pipe_out": pout,
            "head": (x, y, z + r + 33)}


# -- server room -------------------------------------------------------------------

def server_rack(sc, x, y, color, pal, facing="x", units=8, height=132, width=40, depth=60):
    """One rack: plinth, cabinet, and `units` equipment units on its front,
    each with a lamp, apart by a gap that prints. Racks in a row stand a few
    units apart (`rack_row`), so neighbouring sides do not print as one line.
    Returns `port`, `top` (the top of the cabinet, for a cable from above)
    and `unit(k)`, a point on unit k counted from the bottom."""
    face = _centred(sc, x, y, width, depth, facing)
    pitch = (height - 26) / units
    with sc.ordered():
        face.box(0, 0, 0, width, depth, 6, pal["steel"])
        face.box(1, 1, 6, width - 2, depth - 2, height - 6, color, tone=1.1)
        if face.seen:
            for k in range(units):
                zk = 14 + k * pitch
                face.panel(5, zk, width - 10, pitch - 4, color, 0.45, w=depth - 0.95)
                _lamp(face, width - 13, depth - 1, zk + (pitch - 4) / 2 - 2,
                      pal["ok"] if k % 3 else pal["data"])
    return _result(sc, face, top=face.point(width / 2, depth / 2, height),
                   unit=lambda k: face.point(width / 2 - 4, depth - 1, 14 + k * pitch + pitch / 2))


def rack_row(sc, x, y, count, color, pal, facing="x", gap=4, **rack):
    """`count` racks side by side along the front, the first at (x, y) and
    the rest to the viewer's right. Returns the racks' results in order."""
    width = rack.get("width", 40)
    step = width + gap
    racks = []
    for k in range(count):
        dx, dy = {"x": (0, -step * k), "y": (step * k, 0), "-x": (0, step * k),
                  "-y": (-step * k, 0)}[facing]
        racks.append(server_rack(sc, x + dx, y + dy, color, pal, facing=facing, **rack))
    return racks


def cloud_room(sc, x0, y0, color, pal, racks=4, ground=None, wall=30):
    """A server room on its own island: the floor, low walls on the two far
    edges, a row of racks facing +x against the low-x wall and a cooling
    unit at the end of the row. The island is sized to the row. Returns the
    racks, the cooling unit, `corner` (the near corner of the island, for a
    label) and `rack_port(k)`, the middle of rack k's front foot."""
    width, gap, depth = 40, 4, 60
    length = racks * (width + gap) + 70
    x1, y1 = x0 + depth + 90, y0 + length + 20
    sc.island(x0, y0, x1, y1, ground or pal["wall"])
    with sc.group():
        sc.box(x0, y0, 0, 6, y1 - y0, wall, pal["wall"], tone=0.6)
    with sc.group():
        sc.box(x0 + 6, y0, 0, x1 - x0 - 6, 6, wall, pal["wall"], tone=0.6)
    rx = x0 + 6 + 4 + depth / 2
    row = rack_row(sc, rx, y1 - 10 - width / 2, racks, color, pal, facing="x", gap=gap)
    cool = _centred(sc, rx, y0 + 6 + 4 + 25, 50, depth, "x")
    with sc.ordered():
        cool.box(0, 0, 0, 50, depth, 6, pal["steel"])
        cool.box(1, 1, 6, 48, depth - 2, 110, pal["steel"], tone=0.9)
        for k in range(4):
            cool.panel(8, 20 + 20 * k, 34, 3, pal["steel"], 0.9, w=depth - 1 + 0.05)
    cooler = {"solid": sc.solids[-1], "port": cool.port}
    return {"solid": row[0]["solid"], "racks": row, "cooler": cooler, "corner": (x1, y1, 0),
            "rack_port": lambda k: row[k]["port"](0.5)}


# -- control room ------------------------------------------------------------------

def control_desk(sc, x, y, color, pal, monitors=3, facing="-x", depth=40):
    """An operator desk with a row of monitors. Facing "x" or "y" shows the
    screens; facing "-x" or "-y" turns them away from the viewer towards a
    video wall behind the desk, so the viewer sees their backs and the
    operator's side of the desk. Returns `port` (or `back`) and `screen(k)`."""
    width = monitors * 36 + 16
    face = _centred(sc, x, y, width, depth, facing)
    with sc.ordered():
        for u in (0, width - 18):
            face.box(u, 0, 0, 18, depth, 30, color, tone=0.8)
        face.box(18, 4, 12, width - 36, 6, 12, color, tone=0.6)
        face.box(0, 0, 30, width, depth, 4, color, tone=1.2)
        for k in range(monitors):
            u = 8 + k * 36
            neck = face.point(u + 16, 8, 34)
            sc.cyl(neck[0], neck[1], 2.2, 8, pal["steel"], z=34)
            face.box(u, 6, 42, 32, 3, 22, pal["screen"], tone=0.9)
            if face.seen:
                face.panel(u + 2, 44, 28, 18, pal["screen"], 0.85, w=9.05)
                face.panel(u + 5, 52, 18 - 4 * (k % 2), 4, pal["data" if k % 2 else "ok"], 0.95, w=9.1)
    return _result(sc, face, screen=lambda k: face.point(8 + k * 36 + 16, 9, 54))


def video_wall(sc, x, y, z, pal, cols=4, rows=2, facing="x", panel=(46, 28), gap=3,
               alarm=None):
    """A large display made of `cols` x `rows` panels on a wall at height z
    (wall-mount convention). Every panel shows a few lines of content;
    `alarm=(col, row)` marks one panel with an alarm bar. Returns
    `panel_at(col, row)`, a point on that panel."""
    pw, ph = panel
    width = cols * pw + (cols - 1) * gap + 8
    height = rows * ph + (rows - 1) * gap + 8
    face = Face(sc, x, y, width, 3, facing)
    with sc.ordered():
        face.box(0, 0, z, width, 3, height, pal["screen"], tone=0.8)
        for c in range(cols):
            for r in range(rows):
                u, zr = 4 + c * (pw + gap), z + 4 + r * (ph + gap)
                if face.seen:
                    face.panel(u, zr, pw, ph, pal["screen"], 0.86, w=3.05)
                    key = "alarm" if alarm == (c, r) else ("data", "ok", "live")[(c + r) % 3]
                    face.panel(u + 6, zr + ph - 10, (pw - 12) * (0.85 - 0.2 * (r % 2)), 4, pal[key],
                               0.95, w=3.1)
                    face.panel(u + 6, zr + 6, (pw - 12) * 0.5, 4, pal["steel"], 0.9, w=3.1)
    return {"solid": sc.solids[-1], "facing": facing, "face": face,
            "panel_at": lambda c, r: face.point(4 + c * (pw + gap) + pw / 2, 3,
                                                z + 4 + r * (ph + gap) + ph / 2)}


def signage(sc, x, y, color, pal, facing="x", mount="stand", width=64, height=38, z=None):
    """A display board for a factory aisle. `mount="stand"`: on a post and a
    base, footprint centred on (x, y). `mount="hang"`: hung on two rods from
    above at height z (default 90), with no foot. The board shows a title bar
    and three value bars. Returns `screen` (and `port` when it stands)."""
    stand = mount == "stand"
    zb = 54 if stand else (z or 90)
    face = _centred(sc, x, y, width, 8, facing)
    with sc.ordered():
        if stand:
            face.box(width / 2 - 14, -4, 0, 28, 16, 4, pal["steel"])
            p = face.point(width / 2, 4, 4)
            sc.cyl(p[0], p[1], 3, zb - 4, pal["steel"], z=4)
        else:
            for u in (8, width - 8):
                p = face.point(u, 4, zb + height)
                sc.cyl(p[0], p[1], 1.2, 40, pal["steel"], z=zb + height)
        face.box(0, 0, zb, width, 8, height, color)
        if face.seen:
            face.panel(3, zb + 3, width - 6, height - 6, pal["screen"], 0.86, w=8.05)
            face.panel(6, zb + height - 11, width - 12, 5, color, 0.95, w=8.1)
            for k, (key, f) in enumerate((("ok", 0.8), ("warn", 0.55), ("data", 0.7))):
                face.panel(6, zb + 6 + 6 * k, (width - 12) * f, 3.2, pal[key], 0.95, w=8.1)
    out = {"solid": sc.solids[-1], "facing": facing, "face": face,
           "screen": face.point(width / 2, 8, zb + height / 2)}
    if stand:
        stand_face = _centred(sc, x, y, 28, 16, facing)
        out["port"] = stand_face.port
    return out


def handheld(sc, x, y, color, pal, kind="phone", facing="x", alert=True):
    """A smartphone or tablet standing upright on a small stand, drawn
    several times larger than the room around it so its screen can carry a
    label (say so in the figure). The screen shows an alert card with a red
    bar when `alert`. Returns `screen`, a point on the alert card."""
    width, height = (34, 66) if kind == "phone" else (70, 50)
    face = _centred(sc, x, y, width + 12, 22, facing)
    with sc.ordered():
        face.box(0, 0, 0, width + 12, 22, 5, pal["steel"])
        face.box(6, 6, 5, width, 4, height, color, tone=1.3)
        if face.seen:
            face.panel(9, 9, width - 6, height - 8, pal["screen"], 0.88, w=10.05)
            if alert:
                top = 5 + height - 4
                face.panel(11, top - 26, width - 10, 18, pal["steel"], 0.95, w=10.1)
                face.panel(11, top - 12, width - 10, 4, pal["alarm"], 0.98, w=10.15)
                face.panel(14, top - 22, (width - 16) * 0.7, 2.5, pal["screen"], 0.9, w=10.15)
            face.panel(width / 2 + 2, 7, 8, 1.6, pal["steel"], 0.9, w=10.1)
    return _result(sc, face, screen=face.point(6 + width / 2, 10, 5 + height - 16))


class _Body:
    """The local frame of a figure standing at (x, y) and looking at
    `facing`: `a` runs forward, `b` to the figure's right, z up. Every part is
    an axis-aligned box, an upright cylinder or a ball, so a part keeps its
    shape in all four facings."""

    _FORWARD = {"x": (1, 0), "y": (0, 1), "-x": (-1, 0), "-y": (0, -1)}

    def __init__(self, sc, x, y, facing):
        if facing not in self._FORWARD:
            raise ValueError(f"facing must be x, y, -x or -y, not {facing!r}")
        self.sc, self.x, self.y, self.facing = sc, x, y, facing
        self.fx, self.fy = self._FORWARD[facing]
        self.rx, self.ry = self.fy, -self.fx
        # The side nearer the viewer (larger x + y): a hand that holds
        # something shows it there.
        self.near = 1 if self.rx + self.ry > 0 else -1

    def point(self, a, b, z=0.0):
        return (self.x + a * self.fx + b * self.rx, self.y + a * self.fy + b * self.ry, z)

    def box(self, a0, a1, b0, b1, z0, z1, color, tone=1.0):
        (xa, ya, _), (xb, yb, _) = self.point(a0, b0), self.point(a1, b1)
        return self.sc.box(min(xa, xb), min(ya, yb), z0, abs(xb - xa), abs(yb - ya), z1 - z0,
                           color, tone)

    def cyl(self, a, b, r, z0, z1, color, tone=1.0):
        px, py, _ = self.point(a, b)
        return self.sc.cyl(px, py, r, z1 - z0, color, z=z0, tone=tone)

    def ball(self, a, b, z, r, color, tone=1.0):
        px, py, _ = self.point(a, b)
        return self.sc.ball(px, py, z, r, color, tone)


# A figure is about 80 units tall standing, so it stands at the scale of the
# desks and cabinets (a desk top at 34 is a 75 cm desk to a 170 cm person).
# Every measure below was chosen so that, at 0.53 px a unit, the head, the
# neck, the shoulders, the arms and the two legs still print apart, and so
# that no two edges of different parts print within 3 units of one line.
_HEAD_R = 6.5


def _upper_body(body, z, color, pal, arms="down", holding=None, torso=20):
    """Torso, neck, head and arms above height z, the torso `torso` tall.
    `arms` is "down" (hanging at the sides), "desk" (forearms forward at the
    height of a desk top, 34, for a seated figure) or "hold" (one or both
    forearms raised in front with a handheld). Returns (head, hand)."""
    top = z + torso
    body.box(-4, 4, -8.5, 8.5, z, top, color)
    body.cyl(0, 0, 2.6, top, top + 4, color, tone=0.8)
    head_z = top + 4 + _HEAD_R - 0.5
    body.ball(0, 0, head_z, _HEAD_R, color, tone=1.1)
    arm_b, r = 12.4, 2.4
    hand = None
    for side in (-1, 1):
        b = side * arm_b
        raised = arms == "desk" or (arms == "hold" and (holding == "tablet" or side == body.near))
        if not raised:
            body.cyl(0, b, r, z - 2, top - 1, color, tone=1.1)
            continue
        elbow = top - 11 if arms == "hold" else 38
        body.cyl(-0.5, b, r, elbow, top - 1, color, tone=1.1)
        reach = 10 if arms == "hold" else 16
        inner = 3.5 if arms == "hold" else 0
        lo, hi = sorted((b + side * 2.2, b - side * (2.2 + inner)))
        body.box(-2.5, reach, lo, hi, elbow - 4, elbow, color, tone=1.1)
        if hand is None or side == body.near:
            hand = body.point(reach, b, elbow)
    if arms == "hold":
        elbow = top - 11
        if holding == "tablet":
            body.box(9, 13, -9, 9, elbow - 2, elbow + 9, pal["screen"], tone=1.6)
            hand = body.point(11, 0, elbow + 4)
        else:
            b0 = body.near * (arm_b - 6)
            lo, hi = sorted((b0, b0 + body.near * 6))
            body.box(9, 13, lo, hi, elbow - 2, elbow + 9, pal["screen"], tone=1.6)
            hand = body.point(11, b0 + body.near * 3, elbow + 4)
    return body.point(0, 0, head_z + _HEAD_R + 0.5), hand


def _chair(body, color, back=True):
    """A swivel chair in the figure's frame: a round base, a post, the seat
    (top at 12) and the back behind it. Returns the seat point."""
    body.cyl(-4, 0, 8, 0, 4, color, tone=0.9)
    body.cyl(-4, 0, 1.8, 4, 7, color)
    # A round seat: a square one puts its front edge on one line with the
    # back edge of the torso of a person seen from behind, and no depth of
    # the seat clears that and the edges of the lap at once.
    body.cyl(-3, 0, 9, 7, 12, color, tone=1.1)
    if back:
        # Narrower than the shoulders and 10 below them: from behind, the
        # shoulders and the upper arms show above and beside the back.
        body.box(-14, -10, -5, 5, 7, 38, color, tone=0.9)
        body.cyl(-12, 0, 1.6, 4, 7, color)
    return body.point(-3, 0, 12)


def person(sc, x, y, color, pal, pose="stand", facing="x", holding=None, chair=None):
    """A person: head, neck, a torso whose shoulders are wider than the
    hips, two arms apart from the torso and two legs with feet, about 80
    units tall standing. No face and no clothing detail; it marks where
    somebody stands or sits and what they hold, not who.

    `facing` is the way the person looks ("x", "y", or "-x"/"-y" for a back
    turned to the viewer). `pose="stand"` stands on (x, y); `holding="phone"`
    or `"tablet"` raises the forearm nearer the viewer (both for a tablet)
    and puts the handheld in front of the chest. `pose="sit"` seats the
    person on a swivel chair centred on (x, y), drawn in `chair` colour
    (default the palette's steel) as part of the same device, so the chair
    and the figure share one footprint and are ordered part by part; the
    thighs lie along the seat, the shins stand down to the floor and the
    forearms reach 16 units forward, 2 onto a desk the feet stop at.
    Use `seat_at` to place a seated person at a `control_desk`.

    Returns `head` (the top of the head), `hand` (the hand, or the handheld
    when one is held) and, seated, `seat`."""
    body = _Body(sc, x, y, facing)
    if pose not in ("stand", "sit"):
        raise ValueError(f"pose must be stand or sit, not {pose!r}")
    if holding not in (None, "phone", "tablet"):
        raise ValueError(f"holding must be phone, tablet or None, not {holding!r}")
    if pose == "sit" and holding:
        raise ValueError("a seated person rests the forearms on the desk; hold only standing")
    out = {}
    with sc.group(pairwise=True):
        if pose == "stand":
            for side in (-1, 1):
                b0 = side * 5.2
                lo, hi = sorted((b0 - side * 2.2, b0 + side * 2.2))
                body.box(-3.4, 3.4, lo, hi, 0, 4, color, tone=0.9)
                body.cyl(-0.8, b0, 2.3, 4, 36, color, tone=1.1)
            body.box(-3.5, 3.5, -7, 7, 36, 43, color, tone=0.9)
            head, hand = _upper_body(body, 43, color, pal, "hold" if holding else "down", holding)
        else:
            out["seat"] = _chair(body, chair or pal["steel"])
            # The lap's top stays at 19: higher, its two top edges print on
            # one line with edges of the forearms resting at desk height.
            body.box(-6, 13, -5.5, 5.5, 12, 19, color, tone=0.9)
            for side in (-1, 1):
                b0 = side * 4.6
                lo, hi = sorted((b0 - side * 2.2, b0 + side * 2.2))
                body.cyl(10.5, b0, 2.2, 4, 12, color, tone=1.1)
                body.box(8, 14, lo, hi, 0, 4, color, tone=0.9)
            head, hand = _upper_body(body, 19, color, pal, "desk", torso=29.5)
    out.update({"solid": sc.solids[-1], "facing": facing, "head": head, "hand": hand})
    if pose == "stand" and facing == "x" and not holding:
        # The point every caller of the standing figure has used.
        out["head"] = (x, y, 81)
    return out


def chair(sc, x, y, color, pal=None, facing="x"):
    """An empty swivel chair whose seat looks at `facing`, centred on (x, y):
    round base, post, seat and back. A chair somebody sits on is drawn by
    `person(pose="sit")`, never as a second device on the same ground."""
    body = _Body(sc, x, y, facing)
    with sc.group(pairwise=True):
        seat = _chair(body, color)
    return {"solid": sc.solids[-1], "facing": facing, "seat": seat}


def seat_at(sc, desk, color, pal, f=0.5, chair=None):
    """A seated person at a `control_desk`, on the side its screens look at,
    facing the screens: the chair stands so that the feet stop at the desk's
    front edge, the footprints touch and do not overlap, and the forearms
    rest on the desk's edge. `f` is the place along the front from the
    viewer's left. A desk facing "x" or "y" shows the person's back with the
    screens beyond; one facing "-x" or "-y" puts the desk and the monitors'
    backs in front of the person, who is then mostly hidden."""
    face = desk["face"]
    fx, fy = _Body._FORWARD[face.facing]
    px, py, _ = face.point(f * face.width, face.depth)
    # The feet reach a = 14 from the figure's centre: stand the centre that
    # far out from the front, so the feet end on the desk's front edge. At
    # 16 or more the far top edge of the torso prints on one line with the
    # near edge of the desk top.
    turned = {"x": "-x", "-x": "x", "y": "-y", "-y": "y"}[face.facing]
    return person(sc, px + fx * 14, py + fy * 14, color, pal, pose="sit", facing=turned,
                  chair=chair)
