"""Production-line equipment built from Scene solids, reached through `plant`
(`plant.press`, `plant.production_line`, ...) and following its conventions:
`facing`, footprint-centred placement, `port(f)` on a visible front, and a
`solid` in every result for `label()`.

Each device is sized for a scene printed at about half a pixel a unit: few
large parts and one cue a reader knows (a press's crown and open window, an
arm's elbow and tool, a car's cabin, an injection machine's hopper, a booth's
stack). The devices of one line keep their parts apart on the floor so the
scene's order is decided by the boxes, never by centre depth: an arm reaches
to the side of a car body but never over it, a body stands on a conveyor and
a conveyor stops at a booth's walls.
"""
from .plant import Face, _Body, _centred, _lamp, _result, _screen


def _lie(sc, p, q, r, color, tone=1.0):
    """A cylinder lying between two world points on one floor axis."""
    if abs(p[1] - q[1]) < 1e-6 and abs(p[2] - q[2]) < 1e-6:
        return sc.cyl_x(min(p[0], q[0]), p[1], p[2], r, abs(q[0] - p[0]), color, tone)
    if abs(p[0] - q[0]) < 1e-6 and abs(p[2] - q[2]) < 1e-6:
        return sc.cyl_y(p[0], min(p[1], q[1]), p[2], r, abs(q[1] - p[1]), color, tone)
    raise ValueError(f"a lying cylinder runs along x or y, not {p}->{q}")


def _prism(face, along, a0, a1, profile, color, tone=1.0):
    """A convex prism in a device's frame: `along="u"` runs across the front
    from u = a0 to a1 with a profile of (w, z); `along="w"` runs from the
    back to the front with a profile of (u, z)."""
    if along == "u":
        pts = [face.point(a0, c, z) for c, z in profile]
        far = face.point(a1, profile[0][0], profile[0][1])
    else:
        pts = [face.point(c, a0, z) for c, z in profile]
        far = face.point(profile[0][0], a1, profile[0][1])
    if abs(pts[0][0] - far[0]) > 1e-6:
        return face.sc.prism("x", pts[0][0], far[0], [(p[1], p[2]) for p in pts], color, tone)
    return face.sc.prism("y", pts[0][1], far[1], [(p[0], p[2]) for p in pts], color, tone)


def _seen_side(face):
    """The u of the long side the viewer sees (0 or the width)."""
    return 0.0 if face.facing in ("x", "-y") else face.width


def _extent(face, du0=0.0, du1=0.0, dw0=0.0, dw1=0.0):
    """The floor rectangle (x0, y0, x1, y1) of a frame, grown by the margins."""
    a = face.point(-du0, -dw0)
    b = face.point(face.width + du1, face.depth + dw1)
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1]))


# -- conveyor ------------------------------------------------------------------------

def conveyor(sc, x, y, length, color, pal, axis="x", width=26, height=16, kind="roller"):
    """A straight conveyor centred on (x, y), running `length` along `axis`:
    legs, two side rails and a bed of rollers (`kind="roller"`) or a dark belt
    (`kind="belt"`). Things placed on it stand on `top` (the bed height).
    Returns `top`, `at(f)` (the world point on the bed's centre line at the
    fraction f from the low end) and `extent`."""
    if axis not in ("x", "y"):
        raise ValueError(f"axis must be x or y, not {axis!r}")
    if kind not in ("roller", "belt"):
        raise ValueError(f"kind must be roller or belt, not {kind!r}")
    facing = "y" if axis == "x" else "x"
    face = _centred(sc, x, y, length, width, facing)
    rail = 8
    legs = max(2, int((length - 30) // 44) + 1)
    with sc.ordered():
        for k in range(legs):
            # 15 in from each end: a leg's hidden top edge then keeps clear of
            # the rail's end edges.
            u = 15 + (length - 35) * k / (legs - 1)
            face.box(u, 5, 0, 5, width - 10, height - rail, pal["steel"], tone=0.8)
        face.box(0, 0, height - rail, length, width, rail, color)
        bed = height + 0.05
        if kind == "belt":
            pts = [face.point(2, 4, bed), face.point(length - 2, 4, bed),
                   face.point(length - 2, width - 4, bed), face.point(2, width - 4, bed)]
            sc.quad(pts, pal["screen"], 0.55)
        else:
            for u in range(6, int(length) - 3, 9):
                pts = [face.point(u, 3, bed), face.point(u + 3.5, 3, bed),
                       face.point(u + 3.5, width - 3, bed), face.point(u, width - 3, bed)]
                sc.quad(pts, pal["steel"], 0.55)

    def at(f):
        # u runs from high y to low y along an x-facing frame.
        u = (1 - f) * length if facing == "x" else f * length
        return face.point(u, width / 2, height)

    out = _result(sc, face, top=height, at=at, extent=_extent(face), axis=axis)
    # Its legs stand in from the rail, so the rail's foot is not a face a
    # cable can meet: a conveyor offers no floor port.
    out.pop("port", None)
    out.pop("back", None)
    return out


# -- products ------------------------------------------------------------------------

def car_body(sc, x, y, color, pal, facing="x", z=0.0, skid=False, wheels=False,
             length=60, width=26):
    """A car body centred on (x, y) with its nose towards `facing`, standing
    at height z (a conveyor's `top`): a lower body with a sloped bonnet, a
    cabin with a windscreen and side windows. `skid=True` stands it on a
    steel skid (a body in white in the body shop); `wheels=True` puts wheels on
    the side the viewer sees (final assembly). Returns `roof` (the top of the
    cabin) and `side`, a point on the side the viewer sees."""
    face = _centred(sc, x, y, width, length, facing)
    side = _seen_side(face)
    zb = z
    with sc.ordered():
        if skid:
            # Two cross bars standing out each side: their edges across the
            # body keep clear of the body's and the cabin's.
            for w0, w1 in ((16, 21), (37, 42)):
                face.box(-3, w0, z, width + 6, w1 - w0, 4, pal["steel"], tone=0.9)
            zb = z + 4
        if wheels:
            zb = max(zb, z + 5)
        # Every edge across the body keeps its w - z 4 apart from the others
        # (the cabin's from the lower body's, the skid's from both).
        low = [(1.5, zb), (length - 1.5, zb), (length, zb + 6), (length, zb + 10),
               (length - 13, zb + 13), (7, zb + 13), (0, zb + 10), (0, zb + 6)]
        _prism(face, "u", 0, width, low, color)
        cab = [(14, zb + 13), (42, zb + 13), (34, zb + 22), (21, zb + 22)]
        _prism(face, "u", 5, width - 5, cab, color, tone=0.9)
        # Windows: a flat piece a hair proud of the cabin's seen side, inset
        # so it shares no edge with the cabin.
        s = side - 5 if side else 5
        off = 0.06 if side else -0.06
        pts = [face.point(s + off, w, zz) for w, zz in
               ((18, zb + 14.5), (40, zb + 14.5), (34, zb + 20.5), (22.5, zb + 20.5))]
        sc.quad(pts, pal["screen"], 0.6)
        if face.seen:
            sc.quad([face.point(7, 40.62, zb + 14.6), face.point(width - 7, 40.62, zb + 14.6),
                     face.point(width - 7, 35.47, zb + 20.4), face.point(7, 35.47, zb + 20.4)],
                    pal["screen"], 0.55)
        if wheels:
            inner = side - 4 if side else 4
            for w in (12, length - 12):
                _lie(sc, face.point(inner, w, z + 6), face.point(side, w, z + 6), 6,
                     pal["screen"], tone=1.6)
    out = _result(sc, face, roof=face.point(width / 2, 27, zb + 22),
                  side=face.point(side, length / 2, zb + 8), extent=_extent(face))
    # A body stands on a conveyor or a skid, not on the floor: no floor port.
    out.pop("port", None)
    out.pop("back", None)
    return out


def panel_part(sc, x, y, color, pal, facing="x", z=0.0, length=40, width=30, count=1):
    """A stamped body panel (a door's outer skin) centred on (x, y) at height
    z: a shallow drawn tray with a window opening. `count` stacks that many on
    each other, as panels leave a press line. Returns `top`."""
    face = _centred(sc, x, y, width, length, facing)
    # Plates 3 thick, 10 apart, a rim of 3: every edge of a plate keeps 4
    # units (in w - z and in z) from the plates above and below.
    gap = 10.0
    with sc.ordered():
        for k in range(count):
            zk = z + k * gap
            prof = [(0, zk), (length, zk), (length - 3, zk + 3), (3, zk + 3)]
            _prism(face, "u", 0, width, prof, color)
            top = zk + 3.06
            pts = [face.point(u, w, top) for u, w in
                   ((6, length * 0.5), (width - 6, length * 0.5),
                    (width - 6, length - 7), (6, length - 7))]
            sc.quad(pts, pal["screen"], 0.5)
    return _result(sc, face, top=face.point(width / 2, length / 2, z + count * gap),
                   extent=_extent(face))


# -- press ---------------------------------------------------------------------------

_PRESS = (44, 34, 80)  # across the window, along the feed, tall


def press(sc, x, y, color, pal, facing="x", feed=None, die=None):
    """A straight-side stamping press centred on (x, y) whose open window looks
    at `facing` (the way the sheet travels): a bed, a bolster with the lower
    die, two uprights, the ram with the upper die, a crown wider than the
    uprights and a flywheel on the crown's seen side. `feed="coil"` stands an
    uncoiler with its coil behind the press, the strip running into the
    window; `feed="sheet"` stands a stack of blanks there. The feed is a
    device of its own, so it has its own footprint. Returns `port(f)`, `ram`,
    `bolster`, `feed` (its result or None) and `extent` (press and feed)."""
    width, depth, height = _PRESS
    face = _centred(sc, x, y, width, depth, facing)
    near = _seen_side(face)
    far_u, near_u = (width - 9, 0) if near == 0 else (0, width - 9)
    die = die or pal["copper"]
    # Heights and insets chosen by machine so that no two edges of the
    # press print within the lint's distance of each other in any facing.
    with sc.ordered():
        face.box(0, 0, 0, width, depth, 12, pal["steel"])
        face.box(4, 4, 12, width - 8, depth - 8, 7, pal["steel"], tone=1.3)
        face.box(far_u, 2, 19, 9, depth - 4, 43, color)
        face.box(10, 10, 19, width - 20, depth - 20, 6, die, tone=1.2)
        face.box(10, 7, 44, width - 20, depth - 14, 14, color, tone=1.2)
        face.box(13, 10, 39, width - 26, depth - 20, 5, die, tone=1.2)
        face.box(near_u, 2, 19, 9, depth - 4, 43, color)
        face.box(-3, 0, 62, width + 6, depth, 20, color, tone=0.9)
        fly = -7 if near == 0 else width + 3
        _lie(sc, face.point(fly, depth / 2, 72), face.point(fly + 4, depth / 2, 72), 8,
             pal["steel"], tone=1.2)
    res = _result(sc, face, ram=face.point(width / 2, depth - 7, 51),
                  bolster=face.point(width / 2, depth - 4, 16))
    fed = None
    if feed == "coil":
        fed = _coil_feed(sc, face, pal, die)
    elif feed == "sheet":
        fed = _sheet_feed(sc, face, pal, die)
    elif feed is not None:
        raise ValueError(f"feed must be coil, sheet or None, not {feed!r}")
    res["feed"] = fed
    res["extent"] = _extent(face, 7, 7, 40 if fed else 0, 0)
    return res


def _coil_feed(sc, face, pal, strip):
    """An uncoiler behind a press: a cradle, the coil lying across the feed
    and the strip running level into the press window."""
    width = face.width
    with sc.ordered():
        face.box(8, -34, 0, width - 16, 30, 3, pal["steel"])
        a = face.point(12, -21, 16)
        b = face.point(width - 12, -21, 16)
        _lie(sc, a, b, 13, strip, tone=1.1)
        pts = [face.point(14, -8, 19), face.point(width - 14, -8, 19),
               face.point(width - 14, 0, 19), face.point(14, 0, 19)]
        sc.quad(pts, strip, 0.45)
    return {"solid": sc.solids[-1]}


def _sheet_feed(sc, face, pal, color):
    """A stack of blanks on a pallet behind a press."""
    width = face.width
    with sc.ordered():
        face.box(6, -34, 0, width - 12, 32, 5, pal["steel"], tone=0.9)
        face.box(8, -32, 5, width - 16, 18, 10, color, tone=1.1)
    return {"solid": sc.solids[-1]}


# -- robot ---------------------------------------------------------------------------

def _lie_b(body, a, b0, b1, z, r, color, tone=1.0):
    p, q = body.point(a, b0, z), body.point(a, b1, z)
    return _lie(body.sc, p, q, r, color, tone)


ROBOT_REACH = 40  # from the base centre to the tip of the tool, along facing


def robot_arm(sc, x, y, color, pal, facing="x", tool="weld", height=52):
    """A six-axis industrial robot standing on (x, y), its forearm reaching
    towards `facing`: a base plate, a turntable, the shoulder, an upright
    lower arm, the elbow joint lying across, a level forearm and the wrist
    with a tool hanging from it. `tool` is "weld" (a spot-weld gun with a
    spark at its tip), "gripper" (two fingers) or "spray" (a nozzle and its
    mist). The tool's tip is `ROBOT_REACH` units ahead of the base centre:
    stand the arm so that what it works on starts beyond that, never under
    the forearm, and the scene orders them by their boxes. Returns `tool`
    (the tip), `elbow`, and `extent`."""
    if tool not in ("weld", "gripper", "spray"):
        raise ValueError(f"tool must be weld, gripper or spray, not {tool!r}")
    body = _Body(sc, x, y, facing)
    top = height
    with sc.group(pairwise=True):
        body.box(-8, 8, -8, 8, 0, 5, pal["steel"], tone=0.9)
        body.cyl(0, 0, 7, 5, 14, color, tone=0.9)
        body.box(-6, 6, -6, 6, 14, 22, color, tone=0.8)
        body.box(-3.5, 3.5, -3.5, 3.5, 22, top - 10.5, color, tone=1.1)
        _lie_b(body, 0, -5.5, 5.5, top - 5, 5.5, color, tone=1.2)
        body.box(5.5, 28, -3, 3, top - 9, top - 1, color, tone=1.1)
        body.box(28, 36, -4, 4, top - 12, top - 1, color, tone=0.9)
        if tool == "weld":
            body.box(29, 35, -2.5, 2.5, top - 24, top - 12, pal["steel"], tone=1.3)
            body.box(35, 40, -2, 2, top - 26, top - 20, pal["steel"], tone=1.3)
            tip = body.point(40, 0, top - 26)
            rays = [((0, 0, 0), (5, 0, 4)), ((0, 0, 0), (0, 5, 4)), ((0, 0, 0), (4, -3, -3)),
                    ((0, 0, 0), (-3, 4, -2))]
            sc.truss([(tuple(t + d for t, d in zip(tip, p)), tuple(t + d for t, d in zip(tip, q)))
                      for p, q in rays], pal["warn"])
        elif tool == "gripper":
            body.box(29, 35, -5, 5, top - 18, top - 12, pal["steel"], tone=1.3)
            for b0, b1 in ((-5, -2), (2, 5)):
                body.box(30, 34, b0, b1, top - 27, top - 18, pal["steel"], tone=1.3)
            tip = body.point(32, 0, top - 27)
        else:
            body.cyl(32, 0, 2.5, top - 22, top - 12, pal["steel"], tone=1.3)
            tip = body.point(32, 0, top - 22)
            fan = [(-6, -6, -12), (6, 6, -12), (2, 2, 0), (-2, -2, 0)]
            sc.quad([tuple(t + d for t, d in zip(tip, p)) for p in fan], pal["data"], 0.3)
    xs = [body.point(-8, -8), body.point(ROBOT_REACH, 8)]
    ext = (min(p[0] for p in xs), min(p[1] for p in xs), max(p[0] for p in xs),
           max(p[1] for p in xs))
    return {"solid": sc.solids[-1], "facing": facing, "tool": tip,
            "elbow": body.point(0, 0, top), "extent": ext}


# -- paint booth ---------------------------------------------------------------------

def paint_booth(sc, x, y, length, color, pal, axis="x", width=44, height=46):
    """A closed spray booth centred on (x, y), `length` along `axis`, which a
    conveyor enters at the low end and leaves at the high end: the enclosure
    with a window band on the long side the viewer sees, the dark opening at
    the high end, an air supply plenum on the roof and an exhaust stack.
    Conveyors stop at its two ends. Returns `stack` (the stack's top),
    `opening`, `port(f)` on the seen side and `extent`."""
    if axis not in ("x", "y"):
        raise ValueError(f"axis must be x or y, not {axis!r}")
    face = _centred(sc, x, y, length, width, "y" if axis == "x" else "x")
    with sc.ordered():
        face.box(0, 0, 0, length, width, height, color)
        face.panel(8, height * 0.45, length - 16, height * 0.3, pal["screen"], 0.45,
                   w=width + 0.05)
        # The exit opening on the end the viewer sees.
        hi_u = length if axis == "x" else 0
        ends = [face.point(hi_u, w, z) for w, z in ((10, 4), (width - 10, 4),
                                                    (width - 10, 30), (10, 30))]
        nudge = 0.05
        sc.quad([(p[0] + (nudge if axis == "x" else 0), p[1] + (nudge if axis == "y" else 0), p[2])
                 for p in ends], pal["screen"], 0.7)
        face.box(14, 14, height, length - 28, width - 22, 8, color, tone=0.8)
        stack = face.point(length - 18 if axis == "y" else 18, 22, height + 8)
        sc.cyl(stack[0], stack[1], 5, 26, pal["steel"], z=height + 8, tone=1.1)
        sc.cyl(stack[0], stack[1], 7, 4, pal["steel"], z=height + 34, tone=1.3)
    return _result(sc, face, stack=(stack[0], stack[1], height + 38),
                   opening=face.point(hi_u, width / 2, 20), extent=_extent(face))


# -- small parts ---------------------------------------------------------------------

def injection_machine(sc, x, y, color, pal, facing="y", length=76, depth=24):
    """A horizontal injection moulding machine centred on (x, y), its long
    front facing `facing`: a machine base, the clamp unit at the viewer's left
    (two platens with the mould between them), the injection barrel
    running into the fixed platen with a hopper over it, the drive box at
    the right end with an operator screen. Returns `port(f)`, `mould`,
    `hopper` and `extent`."""
    face = _centred(sc, x, y, length, depth, facing)

    def along(u0, u1, w, z, r, col, tone=1.0):
        p, q = face.point(u0, w, z), face.point(u1, w, z)
        return _lie(sc, p, q, r, col, tone)

    # Heights and insets chosen by machine so that no two edges print
    # within the lint's distance of each other in any facing; the hopper
    # stands a little above the barrel for the same reason.
    with sc.ordered():
        face.box(0, 0, 0, length, depth, 12, pal["steel"])
        face.box(56, 6, 12, 18, depth - 12, 14, color)
        if face.seen:
            _screen(face, 59, 15, 11, 8, pal, ("ok",), w=depth - 6 + 0.05)
        face.box(38, 4, 12, 16, depth - 8, 7, pal["steel"], tone=1.2)
        face.box(3, 5, 12, 7, depth - 10, 30, color, tone=1.2)
        face.box(14, 7, 17, 9, depth - 14, 16, pal["warn"], tone=1.3)
        face.box(25, 5, 12, 7, depth - 10, 30, color, tone=1.2)
        along(32, 56, depth / 2, 26, 4, pal["steel"], tone=1.1)
        _prism(face, "u", 44, 52, [(6, 33), (depth - 6, 33), (depth - 2, 46), (2, 46)],
               color, tone=1.1)
    return _result(sc, face, mould=face.point(18.5, depth - 7, 25),
                   hopper=face.point(48, depth / 2, 46), extent=_extent(face))


def assembly_bench(sc, x, y, color, pal, facing="y", length=72, depth=26, trays=3):
    """A workbench for small-part assembly centred on (x, y), its working side
    facing `facing`: two pedestals, the bench top at desk height (34), `trays` parts
    trays on it and a back board with a work-instruction screen. Stand a person at
    `port(0.5)` facing the bench. Returns `port(f)`, `tray(k)` and `extent`."""
    face = _centred(sc, x, y, length, depth, facing)
    # Two pedestals at the ends carry the top, as a control desk's do; the
    # trays stand clear of the edges so no tray edge prints on an edge of
    # the top, a pedestal or the back board.
    span = length - 36
    pitch = span / max(1, trays)
    with sc.ordered():
        for u in (0, length - 7):
            face.box(u, 0, 0, 7, depth, 30, color, tone=0.8)
        face.box(0, 0, 30, length, depth, 4, color, tone=1.2)
        face.box(6, 0, 34, length - 12, 4, 22, color, tone=0.8)
        if face.seen:
            face.panel(length / 2 - 9, 40, 18, 11, pal["screen"], 0.85, w=4.05)
            face.panel(length / 2 - 6, 46, 10, 2.5, pal["ok"], 0.95, w=4.1)
        for k in range(trays):
            face.box(18 + k * pitch, 11, 34, pitch - 4, depth - 17, 4, pal["warn"], tone=1.5)
    return _result(sc, face, extent=_extent(face),
                   tray=lambda k: face.point(18 + k * pitch + (pitch - 4) / 2, depth - 6, 38))


# -- fence ---------------------------------------------------------------------------

def cell_fence(sc, x0, y0, x1, y1, pal, height=46, low=24, color=None, tall=("x", "y"),
               open=()):
    """A safety fence round a robot cell, x0..x1 by y0..y1: posts and a top
    rail, at `height` on the far sides `tall` names ("x" for the low-x side,
    "y" for the low-y side) and at `low` elsewhere, so the cell's inside is
    seen. `open` names sides left without fence ("x0", "y0", "x1", "y1"),
    the side work is loaded from. Each side is its own see-through solid, so
    what stands inside is ordered between the far and the near sides."""
    color = color or pal["warn"]
    sides = []
    hx, hy = (height if "x" in tall else low), (height if "y" in tall else low)
    for name, (ax, ay), (bx, by), h in (("x0", (x0, y1), (x0, y0), hx), ("y0", (x0, y0), (x1, y0), hy),
                                        ("x1", (x1, y0), (x1, y1), low),
                                        ("y1", (x0, y1), (x1, y1), low)):
        if name in open:
            continue
        length = abs(bx - ax) + abs(by - ay)
        n = max(1, int(length // 30))
        members = []
        for k in range(n + 1):
            px, py = ax + (bx - ax) * k / n, ay + (by - ay) * k / n
            members.append(((px, py, 0), (px, py, h)))
        members.append(((ax, ay, h), (bx, by, h)))
        sides.append(sc.truss(members, color))
    return {"solid": sides[0], "sides": sides}


# -- lines ---------------------------------------------------------------------------

LINE_KINDS = {
    "vehicle": ("body", "paint", "assembly"),
    "electronics": ("moulding", "assembly"),
    "body_parts": ("press", "welding"),
}

# The least floor a line needs, (along the flow, across it), before a
# station is repeated.
LINE_MIN = {"vehicle": (270, 100), "electronics": (190, 72), "body_parts": (290, 80)}


class _Line:
    """Local frame of a line in the floor rectangle: s runs along the flow
    (low to high, towards the viewer), t across it towards the viewer."""

    def __init__(self, x0, y0, x1, y1, axis):
        if axis not in ("x", "y"):
            raise ValueError(f"axis must be x or y, not {axis!r}")
        self.axis = axis
        self.x0, self.y0 = x0, y0
        self.length = (x1 - x0) if axis == "x" else (y1 - y0)
        self.depth = (y1 - y0) if axis == "x" else (x1 - x0)
        self.flow = axis
        self.side = "y" if axis == "x" else "x"
        self.back_side = "-" + self.side

    def at(self, s, t):
        return (self.x0 + s, self.y0 + t) if self.axis == "x" else (self.x0 + t, self.y0 + s)

    def point(self, s, t, z):
        return self.at(s, t) + (z,)

    def rect(self, s0, t0, s1, t1):
        (ax, ay), (bx, by) = self.at(s0, t0), self.at(s1, t1)
        return (min(ax, bx), min(ay, by), max(ax, bx), max(ay, by))


def _station(sc, solids, point, ln, s0, t0, s1, t1):
    boxes = [s["bbox"] for s in solids]
    bbox = tuple(min(b[i] for b in boxes) for i in range(3)) + \
        tuple(max(b[i] for b in boxes) for i in range(3, 6))
    return {"solid": {"bbox": bbox}, "point": point, "extent": ln.rect(s0, t0, s1, t1)}


def production_line(sc, kind, x0, y0, x1, y1, color, pal, axis="x", people=True,
                    product=None, worker=None):
    """A short production line laid along `axis` inside the floor rectangle
    x0..x1 by y0..y1, the work flowing from the low end to the high end
    (towards the viewer). `kind` is one of:

    - "vehicle": body shop (car bodies on skids on a conveyor, welding arms
      beside them), paint booth (the conveyor passes through it), final
      assembly (bodies on wheels on a conveyor, workers along it);
    - "electronics": injection moulding machines, then assembly benches with
      parts trays and a worker at each;
    - "body_parts": a press line fed from a coil with a stack of stamped
      panels at its end, then a fenced welding cell where an arm welds a panel
      on a fixture.

    Stations repeat (more bodies, machines, presses or benches) to use the
    length given; the line raises ValueError naming the size it needs when
    the rectangle is too small. `color` is the machines' colour, `product`
    the work's (default the palette's steel), `worker` the people's.

    Returns `stations` ({name: {"solid", "point", "extent"}}, one per process
    in the order of `LINE_KINDS[kind]`; pass a station to `label()` or its
    `point` to `callout()`), `devices` (every result drawn), `flow` (the
    start and end points of the work on the floor) and `extent`. The library
    prints no text: the caller labels each station."""
    if kind not in LINE_KINDS:
        raise ValueError(f"kind must be one of {', '.join(LINE_KINDS)}, not {kind!r}")
    ln = _Line(x0, y0, x1, y1, axis)
    need_l, need_d = LINE_MIN[kind]
    if ln.length < need_l or ln.depth < need_d:
        raise ValueError(f"a {kind} line needs at least {need_l} along {axis} and {need_d} "
                         f"across, got {ln.length:g} by {ln.depth:g}")
    product = product or pal["steel"]
    worker = worker or pal["steel"]
    build = {"vehicle": _vehicle, "electronics": _electronics, "body_parts": _body_parts}[kind]
    stations, devices, flow = build(sc, ln, color, pal, people, product, worker)
    return {"solid": devices[0]["solid"], "stations": stations, "devices": devices,
            "flow": flow, "extent": ln.rect(0, 0, ln.length, ln.depth), "kind": kind}


def _share(extra, step, caps):
    """Repeat counts for stations: hand out `extra` floor in units of `step`
    to each station in turn, up to its cap."""
    counts = [1] * len(caps)
    k = 0
    while extra >= step and any(c < cap for c, cap in zip(counts, caps)):
        if counts[k] < caps[k]:
            counts[k] += 1
            extra -= step
        k = (k + 1) % len(caps)
    return counts


def _vehicle(sc, ln, color, pal, people, product, worker):
    pitch, booth_len, gap = 72, 84, 14
    # The welding arms stand on the far side only: on the near side an arm
    # hides the body it welds. The conveyor runs 24 in from the near edge.
    tc = max(13 + 6 + ROBOT_REACH + 8 + 8, ln.depth - 24)
    margin = 6
    base = margin * 2 + 2 * pitch + booth_len + 2 * gap
    n_body, n_asm = _share(ln.length - base, pitch, (3, 3))
    s = margin
    body0, body1 = s, s + n_body * pitch
    booth0 = body1 + gap
    booth1 = booth0 + booth_len
    asm0 = booth1 + gap
    asm1 = asm0 + n_asm * pitch
    devices = []
    cx, cy = ln.at((body0 + booth0) / 2, tc)
    conv_a = conveyor(sc, cx, cy, booth0 - body0, pal["steel"], pal, axis=ln.axis)
    cx, cy = ln.at((booth1 + asm1) / 2, tc)
    conv_b = conveyor(sc, cx, cy, asm1 - booth1, pal["steel"], pal, axis=ln.axis)
    devices += [conv_a, conv_b]
    top = conv_a["top"]
    body_parts, arms = [], []
    for k in range(n_body):
        sk = body0 + pitch * (k + 0.5)
        bx, by = ln.at(sk, tc)
        car = car_body(sc, bx, by, product, pal, facing=ln.flow, z=top, skid=True)
        body_parts.append(car)
        reach = 13 + 6 + ROBOT_REACH
        rx, ry = ln.at(sk - 6, tc - reach)
        arms.append(robot_arm(sc, rx, ry, color, pal, facing=ln.side, tool="weld"))
    cx, cy = ln.at((booth0 + booth1) / 2, tc)
    booth = paint_booth(sc, cx, cy, booth_len, color, pal, axis=ln.axis)
    asm_cars, staff = [], []
    for k in range(n_asm):
        sk = asm0 + pitch * (k + 0.5)
        bx, by = ln.at(sk, tc)
        asm_cars.append(car_body(sc, bx, by, product, pal, facing=ln.flow, z=top, wheels=True))
        # Workers stand on the far side, looking across the line at the
        # viewer: on the near side a figure would hide the body it works on.
        if people and tc - 13 - 6 - 15 >= 0:
            from .plant import person
            px, py = ln.at(sk + 10, tc - 13 - 6 - 9)
            staff.append(person(sc, px, py, worker, pal, facing=ln.side))
    devices += body_parts + arms + [booth] + asm_cars + staff
    stations = {
        "body": _station(sc, [d["solid"] for d in body_parts + arms], arms[0]["elbow"],
                         ln, body0, 0, booth0, ln.depth),
        "paint": _station(sc, [booth["solid"]], booth["stack"], ln, booth0, 0, booth1, ln.depth),
        "assembly": _station(sc, [d["solid"] for d in asm_cars + staff], asm_cars[0]["roof"],
                             ln, booth1, 0, asm1, ln.depth),
    }
    flow = (ln.at(body0, tc), ln.at(asm1, tc))
    return stations, devices, flow


def _electronics(sc, ln, color, pal, people, product, worker):
    from .plant import person
    mach_len, bench_len, gap, margin = 76, 72, 14, 6
    base = 2 * margin + mach_len + gap + bench_len + gap
    n_m, n_b = _share(ln.length - base, mach_len + gap, (3, 3))
    devices, mach, benches, staff = [], [], [], []
    # The machines and benches stand 12 to 16 in from the far edge, so their
    # back edges keep clear of a hall wall standing there.
    tm = 12 + 12
    s = margin
    for k in range(n_m):
        cx, cy = ln.at(s + mach_len / 2, tm)
        mach.append(injection_machine(sc, cx, cy, color, pal, facing=ln.side))
        s += mach_len + gap
    m1 = s
    tb = 16 + 13
    for k in range(n_b):
        cx, cy = ln.at(s + bench_len / 2, tb)
        bench = assembly_bench(sc, cx, cy, color, pal, facing=ln.side, length=bench_len)
        benches.append(bench)
        if people and tb + 13 + 2 + 22 <= ln.depth:
            px, py = ln.at(s + bench_len / 2 + 6, tb + 13 + 2 + 14)
            staff.append(person(sc, px, py, worker, pal, facing=ln.back_side))
        s += bench_len + gap
    devices = mach + benches + staff
    stations = {
        "moulding": _station(sc, [d["solid"] for d in mach], mach[0]["hopper"], ln,
                             0, 0, m1, ln.depth),
        "assembly": _station(sc, [d["solid"] for d in benches + staff], benches[0]["tray"](0), ln,
                             m1, 0, s, ln.depth),
    }
    return stations, devices, (ln.at(margin, tm), ln.at(s - gap, tb))


def _body_parts(sc, ln, color, pal, people, product, worker):
    width, depth, _ = _PRESS
    margin, pgap = 6, 16
    tc = max(width / 2 + 10, min(ln.depth / 2, ln.depth - 40))
    tc = min(tc, ln.depth - width / 2 - 8)
    cell_len = 16 + 8 + ROBOT_REACH + 1 + 40 + 12
    feed_len = 40
    base = 2 * margin + feed_len + depth + pgap + 52 + pgap + 6 + cell_len
    (n_p,) = _share(ln.length - base, depth + pgap, (3,))
    devices, presses = [], []
    s = margin + feed_len
    for k in range(n_p):
        cx, cy = ln.at(s + depth / 2, tc)
        presses.append(press(sc, cx, cy, color, pal, facing=ln.flow,
                             feed="coil" if k == 0 else None, die=product))
        s += depth + pgap
    stack_s = s + 2
    cx, cy = ln.at(stack_s + 26, tc)
    with sc.group():
        f = _centred(sc, cx, cy, 44, 52, ln.flow)
        f.box(0, 0, 0, 44, 52, 5, pal["steel"], tone=0.9)
    pallet = {"solid": sc.solids[-1]}
    stack = panel_part(sc, cx, cy, product, pal, facing=ln.flow, z=5.1, count=3)
    s = stack_s + 52 + pgap + 6
    c0, c1 = s, s + cell_len
    t0, t1 = max(2, tc - 34), min(ln.depth - 2, tc + 34)
    # The cell is open on the side the panels come from, and only the side
    # behind it stands tall: a rail there would print on the plates' edges.
    fence = cell_fence(sc, *ln.rect(c0, t0, c1, t1), pal, tall=(ln.side,),
                       open=(ln.flow + "0",))
    rs = c0 + 16
    rx, ry = ln.at(rs, tc)
    arm = robot_arm(sc, rx, ry, color, pal, facing=ln.flow, tool="weld")
    table_s = rs + ROBOT_REACH + 1
    cx, cy = ln.at(table_s + 20, tc)
    with sc.group():
        f = _centred(sc, cx, cy, 34, 40, ln.flow)
        f.box(0, 0, 0, 34, 40, 26, pal["steel"], tone=1.0)
    table = {"solid": sc.solids[-1]}
    part = panel_part(sc, cx, cy, product, pal, facing=ln.flow, z=26.1, length=28, width=18)
    devices = presses + [p["feed"] for p in presses if p["feed"]] + [pallet, stack, fence, arm,
                                                                    table, part]
    stations = {
        "press": _station(sc, [p["solid"] for p in presses], presses[-1]["ram"], ln,
                          0, 0, c0, ln.depth),
        "welding": _station(sc, [arm["solid"], table["solid"], part["solid"]], arm["elbow"], ln,
                            c0, t0, c1, t1),
    }
    return stations, devices, (ln.at(margin, tc), ln.at(c1, tc))
