"""Power-system equipment built from Scene solids.

Every function adds one device as a group and returns a dict with the solid
(`solid`, for labels) and the points other parts connect to: conductor
terminals in the air and cable ports on the ground, each port on the foot of a
visible face.
"""


def palette(canvas):
    """Colours for the catalogue, registered on the figure's canvas."""
    canvas.add_accent("brown", "#8a4f2a")
    return {"steel": canvas.t["muted"], "gear": canvas.blue, "porcelain": canvas.brown,
            "live": canvas.orange}


def _insulator(sc, x, y, z, height, pal, sheds=8, r=10):
    """A porcelain insulator: a core with alternating wide and narrow sheds."""
    sc.cyl(x, y, r * 0.45, height, pal["porcelain"], z=z, rim=False)
    step = (height - 6) / sheds
    for k in range(sheds):
        sc.disc(x, y, r if k % 2 == 0 else r * 0.75, pal["porcelain"], z=z + 4 + step * k,
                lip=min(3.0, step * 0.45))


def current_transformer(sc, x, y, pal, line_z=118):
    """A free-standing current transformer. The conductor ends on its two
    primary terminals, one each side of the head, never across it."""
    with sc.group():
        sc.box_at(x, y, 20, 20, 3, pal["steel"])
        sc.box_at(x, y, 10, 10, 27, pal["steel"], z=3)
        sc.box_at(x, y, 30, 30, 18, pal["gear"], z=30)
        sc.box_at(x, y + 16.5, 12, 3, 9, pal["steel"], z=35)
        _insulator(sc, x, y, 48, line_z - 12 - 48, pal)
        sc.cyl_x(x - 17, y, line_z, 12, 34, pal["gear"])
        sc.box(x - 27, y - 3, line_z - 3, 10, 6, 6, pal["steel"])
        sc.box(x + 17, y - 3, line_z - 3, 10, 6, 6, pal["steel"])
        sc.cyl(x, y, 4.5, 6, pal["gear"], z=line_z + 12)
    solid = sc.solids[-1]
    return {"solid": solid, "line_in": (x - 28.5, y, line_z), "line_out": (x + 28.5, y, line_z),
            "port": (x, y + 10)}


def voltage_transformer(sc, x, y, pal, line_z=118):
    """A voltage transformer tapped from the conductor above it by a dropper."""
    with sc.group():
        sc.box_at(x, y, 22, 22, 3, pal["steel"])
        sc.box_at(x, y, 12, 12, 22, pal["steel"], z=3)
        sc.box_at(x, y, 30, 30, 26, pal["gear"], z=25)
        sc.box_at(x, y + 16.5, 12, 3, 9, pal["steel"], z=32)
        _insulator(sc, x, y, 51, 44, pal, sheds=6)
        sc.cyl(x, y, 6, 5, pal["gear"], z=95)
    solid = sc.solids[-1]
    sc.wire((x, y, 101), (x, y, line_z), pal["live"], sw=1.9)
    return {"solid": solid, "tap": (x, y, line_z), "port": (x, y + 11)}


def gantry(sc, x, y0, y1, pal, height=158, phases=(), line_z=118):
    """A line gantry: two columns and a beam, with a suspension insulator
    holding each phase conductor."""
    for y in (y0, y1):
        with sc.group():
            sc.box_at(x, y, 16, 16, 3, pal["steel"])
            sc.box_at(x, y, 9, 9, height - 3, pal["steel"], z=3)
    sc.box(x - 4, y0 - 6, height - 9, 8, y1 - y0 + 12, 8, pal["steel"])
    for y in phases:
        with sc.group():
            for k in range(4):
                sc.disc(x, y, 6.5, pal["porcelain"], z=line_z + 5 + 7 * k, lip=3.0)


def bus_support(sc, x, y, pal, line_z=118):
    """A post insulator on a pedestal: the conductor ends on its cap."""
    with sc.group():
        sc.box_at(x, y, 18, 18, 3, pal["steel"])
        sc.box_at(x, y, 9, 9, 45, pal["steel"], z=3)
        _insulator(sc, x, y, 48, line_z - 6 - 48, pal, sheds=7)
        sc.cyl(x, y, 5.5, 6, pal["steel"], z=line_z - 6)
    return {"solid": sc.solids[-1], "line": (x - 5.5, y, line_z)}


def _pads(sc, x, y, reach, pal, line_z):
    """A terminal pad each side of a device's head, reaching past its box, and
    the two points a conductor along x ends on."""
    sc.box(x - reach - 9, y - 3, line_z - 3, 9, 6, 6, pal["steel"])
    sc.box(x + reach, y - 3, line_z - 3, 9, 6, 6, pal["steel"])
    return (x - reach - 10.5, y, line_z), (x + reach + 10.5, y, line_z)


def disconnector(sc, x, y, pal, line_z=118):
    """A disconnector, closed: two post insulators on a base frame with the
    blade lying between their caps."""
    with sc.group():
        sc.box(x - 24, y - 7, 0, 48, 14, 3, pal["steel"])
        for dx in (-16, 16):
            sc.box_at(x + dx, y, 8, 8, 42, pal["steel"], z=3)
            _insulator(sc, x + dx, y, 45, line_z - 6 - 45, pal, sheds=7, r=8)
            sc.cyl(x + dx, y, 5, 4, pal["steel"], z=line_z - 6)
        sc.box(x - 18, y - 1.5, line_z - 1.5, 36, 3, 3, pal["steel"])
        ends = _pads(sc, x, y, 21, pal, line_z)
    return {"solid": sc.solids[-1], "line_in": ends[0], "line_out": ends[1]}


def circuit_breaker(sc, x, y, pal, line_z=118):
    """A live-tank circuit breaker pole: operating mechanism at the foot, a
    support insulator and the interrupter lying along the conductor. The
    control cable leaves from `port`, on the +y face of the mechanism."""
    with sc.group():
        sc.box_at(x, y, 24, 24, 3, pal["steel"])
        sc.box_at(x, y, 18, 18, 26, pal["gear"], z=3)
        sc.box(x + 9, y - 5, 12, 2, 10, 10, pal["steel"])
        _insulator(sc, x, y, 29, line_z - 9 - 29, pal, sheds=8, r=9)
        sc.cyl_x(x - 22, y, line_z, 9, 44, pal["porcelain"])
        ends = _pads(sc, x, y, 22, pal, line_z)
    return {"solid": sc.solids[-1], "line_in": ends[0], "line_out": ends[1],
            "port": (x, y + 12)}


def busbar(sc, xs, y0, y1, pal, bus_z=150):
    """A rigid busbar across the bays: one tube per phase at the x positions
    `xs`, running along y on a post insulator at each end. `tap(k, y)` is the
    point under tube k where a riser from a bay conductor ends."""
    for x in xs:
        for y in (y0, y1):
            with sc.group():
                sc.box_at(x, y, 16, 16, 4, pal["steel"])
                sc.box_at(x, y, 9, 9, 59, pal["steel"], z=4)
                _insulator(sc, x, y, 63, bus_z - 4 - 63, pal, sheds=8, r=9)
                sc.cyl(x, y, 5, 4, pal["steel"], z=bus_z - 4)
        sc.box(x - 4, y0 - 10, bus_z, 8, y1 - y0 + 20, 7, pal["live"])
    return {"solid": sc.solids[-1], "tap": lambda k, y: (xs[k], y, bus_z - 1.1)}


def kiosk(sc, x, y, color, pal, size=64, height=112):
    """An outdoor kiosk: plinth, body, overhanging roof, door handle, nameplate."""
    half = size / 2
    with sc.group():
        sc.box_at(x, y, size + 6, size + 6, 8, pal["steel"])
        sc.box_at(x, y, size, size, height - 18, color, z=8)
        sc.box_at(x, y, size + 14, size + 14, 10, color, z=height - 10)
        sc.box(x + half, y + 16, 46, 2, 3, 18, pal["steel"])
        sc.box(x + half, y - 22, 70, 2, 30, 12, pal["steel"])
    foot = half + 3
    return {"solid": sc.solids[-1], "foot": foot,
            "front": lambda f=0.5: (x + foot, y - foot + 2 * foot * f),
            "side": lambda f=0.5: (x - foot + 2 * foot * f, y + foot)}


def cabinet(sc, x, y, color, pal, kind, size=58, height=120):
    """A floor-standing indoor cabinet. `kind` draws what shows on its front:
    "switch" (a network switch with its ports), "relay" (a relay unit with a
    display), "server" (rack units) or "clock" (a time server)."""
    half = size / 2
    with sc.group():
        sc.box_at(x, y, size + 4, size + 4, 6, pal["steel"])
        sc.box_at(x, y, size, size, height - 6, color, z=6)
        sc.box(x + half, y + 20, height * 0.42, 2, 3, 16, pal["steel"])
        if kind == "server":
            for k in range(5):
                sc.box(x + half, y - 24, 20 + 17 * k, 2, 38, 10, color)
        elif kind == "relay":
            sc.box(x + half, y - 24, 56, 2, 38, 46, color)
            sc.box(x + half + 2, y - 18, 80, 2, 20, 14, pal["steel"])
        elif kind == "switch":
            sc.box(x + half, y - 24, 70, 2, 38, 12, color)
            for k in range(5):
                sc.box(x + half + 2, y - 21 + 7 * k, 73, 2, 5, 5, pal["steel"])
            sc.box(x + half, y - 24, 46, 2, 38, 8, color)
        elif kind == "clock":
            sc.box(x + half, y - 24, 64, 2, 38, 14, color)
            sc.box(x + half + 2, y - 16, 67, 2, 18, 8, pal["steel"])
    foot = half + 2
    return {"solid": sc.solids[-1], "foot": foot,
            "front": lambda f=0.5: (x + foot, y - foot + 2 * foot * f)}


def antenna(sc, x, y, z, color, pal, mast=40):
    """A GPS antenna on a mast, standing on the surface at height z."""
    with sc.group():
        sc.cyl(x, y, 2.2, mast, pal["steel"], z=z)
        sc.cyl(x, y, 8, 6, color, z=z + mast)
    return {"solid": sc.solids[-1]}


# -- the grid outside the substation fence --------------------------------------

def power_plant(sc, x, y, color, pal, phases=(-20, 0, 20), out_z=58.1):
    """A generating station: the turbine hall with a roof monitor and one wall
    bushing per phase on its +x face, and a stack beside it. `out` holds the
    points the generator leads leave from."""
    with sc.group():
        sc.box_at(x, y, 84, 100, 52, color)
        sc.box_at(x, y, 40, 70, 8, color, z=52)
        for k in range(4):
            sc.box(x + 42, y - 44 + 24 * k, 12, 2, 14, 20, pal["steel"])
        for dy in phases:
            sc.box(x + 42, y + dy - 3, out_z - 3, 5, 6, 6, pal["steel"])
        for k in range(3):
            sc.cyl(x - 10 + 10 * k, y - 22 + 22 * k, 3.5, 5, pal["steel"], z=60)
    hall = sc.solids[-1]
    # Behind the hall: the boiler house, the stack on its base and the flue between them.
    with sc.group():
        sc.box(x + 4, y - 104, 0, 38, 48, 84, color, tone=0.8)
        sc.box(x + 10, y - 98, 84, 26, 36, 12, pal["steel"])
    with sc.group():
        sc.box(x - 8, y - 86, 36, 12, 16, 12, pal["steel"])
    with sc.group():
        sc.box_at(x - 20, y - 78, 26, 26, 6, pal["steel"])
        sc.cyl(x - 20, y - 78, 9, 150, color, z=6)
        for z in (62, 112):
            sc.disc(x - 20, y - 78, 11.5, pal["steel"], z=z, lip=3)
    return {"solid": hall, "out": [(x + 47.1, y + dy, out_z) for dy in phases]}


def phase_belt(angle):
    """Which phase (0, 1, 2) lies in the stator slot at this angle of the
    section of a two-pole machine whose phase axes stand at 90, 210 and 330
    degrees: each phase fills two opposite belts of 60 degrees, a quarter turn
    from its axis."""
    return (0, 2, 1)[int(((angle + 30) % 360) // 60) % 3]


def _belt_seen(angle):
    """The phase in a slot of the device's section. The section's angle runs
    from +y, which is the viewer's left, so the end face is seen mirrored
    against a drawing whose angle runs anticlockwise from the right; the slot
    takes the phase of the mirrored angle, and the end face then shows the
    same order of phases as that drawing."""
    return phase_belt(180 - angle)


def synchronous_generator(sc, x, y, pal, phase_colors, scale=1.0, cut=(120.0, 340.0),
                          slots=24, pole=40.0):
    """A two-pole synchronous generator with a cylindrical rotor, its shaft
    along x, opened over the near part of its length: the stator core is kept
    between the angles `cut` of its section, so the rotor, the air gap, the
    slots of the core and the windings in them are seen. (x, y) is the centre
    of the turbine-side end of the stator on the ground. The air gap is drawn
    several times wider than it is, so that it prints as a gap. `pole` is the
    angle the visible pole face of the rotor points at. Returns the solid and
    world points on each part, for labels."""
    u = scale
    steel, body, field = pal["steel"], pal["gear"], pal["gear"]
    base, r_out, r_slot, r_in, r_rotor, r_shaft = 8 * u, 90 * u, 70 * u, 55 * u, 45 * u, 13 * u
    zc = base + r_out + 14 * u
    full, opened = 62 * u, 180 * u
    xa, xb, xe = x, x + full, x + full + opened
    a0, a1 = cut
    step = 360.0 / slots

    def slot_face(xf, f0, f1):
        for k in range(slots):
            a = (k + 0.5) * step
            if sc._clip(a - step * 0.3, a + step * 0.3, f0, f1) and \
                    sc._clip(a + step * 0.29, a + step * 0.3, f0, f1):
                sc.sector_x(xf, y, zc, r_in + 2 * u, r_slot, a - step * 0.3, a + step * 0.3,
                            phase_colors[_belt_seen(a)], 0.75)

    def pedestal(x0):
        sc.box(x0, y - 26 * u, base, 30 * u, 52 * u, zc - 12 * u - base, steel)
        sc.cyl_x(x0 + 2 * u, y, zc, 23 * u, 26 * u, steel)

    with sc.ordered():
        sc.box(xa - 190 * u, y - 78 * u, 0, full + opened + 268 * u, 156 * u, base, steel, tone=0.6)
        # Turbine side: the coupling, the shaft and its bearing.
        sc.cyl_x(xa - 176 * u, y, zc, 26 * u, 10 * u, steel)
        sc.cyl_x(xa - 166 * u, y, zc, r_shaft, 34 * u, steel)
        pedestal(xa - 132 * u)
        sc.cyl_x(xa - 104 * u, y, zc, r_shaft, 104 * u, steel)
        for x0 in (xa + 8 * u, xe - 52 * u):
            sc.box(x0, y - 66 * u, base, 44 * u, 132 * u, zc - r_out * 0.62 - base, steel)
        # The part of the stator that is left whole, with the terminals on it.
        sc.shell_x(xa, y, zc, r_in, r_out, full, steel, face=(a1 - 360, a0), seams=False)
        slot_face(xb, a1 - 360, a0)
        sc.box(xa + 10 * u, y - 30 * u, zc + r_out - 12 * u, 42 * u, 60 * u, 25 * u, steel)
        for k, dy in enumerate((-18, 0, 18)):
            sc.cyl(xa + 31 * u, y + dy * u, 5.5 * u, 30 * u, phase_colors[k], z=zc + r_out + 13 * u)
        # The opened part: far inside wall, rotor, then the near wall and faces.
        sc.shell_x(xb, y, zc, r_in, r_out, opened, steel, a0, a1, part="back")
        sc.cyl_x(xb, y, zc, r_rotor, opened - 14 * u, body)
        sc.lines_x(xb, y, zc, r_rotor, opened - 14 * u,
                   [pole + side * (32 + 9 * k) for side in (-1, 1) for k in range(12)], field,
                   sw=sc.sw)
        sc.shell_x(xb, y, zc, r_in, r_out, opened, steel, a0, a1, part="front")
        # Core packs on the two cut faces, and one bar of winding in the slot beside each.
        for a in (a0, a1):
            bar = phase_colors[_belt_seen(a)]
            sc.quad([(xb, *sc._yz(y, zc, r_in + 2 * u, a)), (xb, *sc._yz(y, zc, r_slot, a)),
                     (xe, *sc._yz(y, zc, r_slot, a)), (xe, *sc._yz(y, zc, r_in + 2 * u, a))], bar, 0.75)
            sc.truss([((xb, *sc._yz(y, zc, r_slot, a)), (xe, *sc._yz(y, zc, r_slot, a)))], steel)
            for k in range(1, int(opened / (15 * u))):
                xk = xb + k * 15 * u
                sc.truss([((xk, *sc._yz(y, zc, r_slot, a)), (xk, *sc._yz(y, zc, r_out, a)))], steel)
        slot_face(xe, a0, a1)
        # Far side of the turbine: the shaft, its bearing and the shaft end.
        sc.cyl_x(xe - 14 * u, y, zc, r_shaft, 52 * u, steel)
        pedestal(xe + 38 * u)
        sc.cyl_x(xe + 68 * u, y, zc, r_shaft, 10 * u, steel)
    solid = sc.solids[-1]
    mid = xb + opened * 0.5
    return {"solid": solid, "axis": zc,
            "rotor": (mid, *sc._yz(y, zc, r_rotor, pole)),
            "field": (xb + opened * 0.3, *sc._yz(y, zc, r_rotor, pole + 50)),
            "core_ring": (xa + full * 0.5, *sc._yz(y, zc, r_out, 60)),
            "gap": (xe - 14 * u, *sc._yz(y, zc, (r_rotor + r_in) / 2, 150)),
            "core": (mid, *sc._yz(y, zc, (r_slot + r_out) / 2, a1)),
            "winding": (xe, *sc._yz(y, zc, (r_in + r_slot) / 2 + u, 360 - step * 2.5)),
            "terminals": (xa + 31 * u, y, zc + r_out + 43 * u),
            "shaft": (xe + 12 * u, y, zc + r_shaft),
            "bearing": (xe + 53 * u, y + 16 * u, zc + 16 * u),
            "coupling": (xa - 171 * u, y, zc + 26 * u),
            "bearing_far": (xa - 117 * u, y + 16 * u, zc + 16 * u)}


def power_transformer(sc, x, y, pal, phases=(-20, 0, 20), hv_side=1, lv="bushing"):
    """A three-phase power transformer: plinth, tank, a radiator bank on its
    +y side, and one bushing per phase in two rows, the tall high-voltage row
    on the side `hv_side` points to (+1: +x, -1: -x). With `lv="cable"` the
    low-voltage side leaves through a cable box on the opposite face instead.
    Returns the terminals above the bushings (`hv`, `lv`) and the cable port."""
    with sc.group():
        sc.box_at(x, y, 68, 84, 4, pal["steel"])
        sc.box_at(x, y, 54, 64, 34, pal["gear"], z=4)
        for k in range(5):
            sc.box(x - 23 + 10 * k, y + 32, 8, 6, 8, 26, pal["gear"])
        if lv == "cable":
            sc.box(x - hv_side * 27 - (0 if hv_side < 0 else 8), y - 14, 8, 8, 28, 22, pal["steel"])
    tank = sc.solids[-1]
    rows = {"hv": (x + hv_side * 17, 34)}
    if lv == "bushing":
        rows["lv"] = (x - hv_side * 17, 16)
    ends = {}
    for name, (bx, height) in rows.items():
        ends[name] = []
        for dy in phases:
            with sc.group():
                _insulator(sc, bx, y + dy, 38, height, pal, sheds=6 if height > 20 else 3, r=7)
                sc.cyl(bx, y + dy, 3.5, 3, pal["steel"], z=38 + height)
            ends[name].append((bx, y + dy, 38 + height + 4.1))
    return {"solid": tank, "hv": ends["hv"], "lv": ends.get("lv", []),
            "port": (x - hv_side * 34, y)}


def _lattice(sc, x, y, height, color, base=8, top=4, panels=4):
    """A tapering lattice column: the three legs a viewer sees, the ring of
    each panel on the two visible faces and one diagonal per panel face."""
    def corner(sx, sy, k):
        half = base + (top - base) * k / panels
        return (x + sx * half, y + sy * half, height * k / panels)
    members = [(corner(sx, sy, 0), corner(sx, sy, panels)) for sx, sy in ((1, -1), (1, 1), (-1, 1))]
    for k in range(panels):
        members += [(corner(1, -1, k + 1), corner(1, 1, k + 1)),
                    (corner(1, 1, k + 1), corner(-1, 1, k + 1)),
                    (corner(1, -1, k), corner(1, 1, k + 1)),
                    (corner(1, 1, k), corner(-1, 1, k + 1))]
    return sc.truss(members, color)


def line_tower(sc, x, y, pal, phases=(-20, 0, 20), line_z=130, span=46):
    """A transmission-line support in portal form: two lattice columns, a beam
    and one suspension insulator string per phase. The conductors pass at
    `line_z` under the beam, clear of both columns."""
    height = line_z + 42
    columns = [_lattice(sc, x, y + side * span, height - 8, pal["steel"]) for side in (-1, 1)]
    sc.box(x - 4, y - span - 6, height - 8, 8, 2 * span + 12, 8, pal["steel"])
    for dy in phases:
        with sc.group():
            for k in range(4):
                sc.disc(x, y + dy, 6.5, pal["porcelain"], z=line_z + 5 + 7 * k)
    return {"solid": columns[1], "line": [(x, y + dy, line_z) for dy in phases]}


def distribution_pole(sc, x, y, pal, phases=(-20, 0, 20), transformer=False, side=1):
    """A distribution pole: base, mast, crossarm and one pin insulator per
    phase, the conductors resting on top. `transformer=True` hangs a
    pole-mounted transformer on the side `side` points to (+1: +y), with
    `drop` the point its low-voltage service conductor leaves from. A cable reaches the pole at
    `port`, on the +y face of its base."""
    with sc.group():
        sc.box_at(x, y, 10, 10, 3, pal["steel"])
        sc.cyl(x, y, 3, 95, pal["steel"], z=3)
        sc.box(x - 2.5, y - 26, 98, 5, 52, 5, pal["steel"])
        for dy in phases:
            sc.cyl(x, y + dy, 3, 5, pal["porcelain"], z=103)
        if transformer:
            sc.box(x - 2, y + (3 if side > 0 else -13), 58, 4, 10, 4, pal["steel"])
            sc.cyl(x, y + side * 20, 8, 20, pal["gear"], z=50)
    return {"solid": sc.solids[-1], "line": [(x, y + dy, 109.1) for dy in phases],
            "port": (x, y + 5), "drop": (x, y + side * 29.1, 62)}


def building(sc, x, y, w, d, h, color, pal, floors=3, mast_z=62):
    """A customer's building: a block with a roof parapet, window bands on its
    +x face and a service mast on the roof at its -y edge. `service` is the
    top of the mast, where an overhead service conductor arriving along +y
    ends."""
    with sc.group():
        sc.box_at(x, y, w, d, h, color)
        sc.box_at(x, y, w - 8, d - 8, 4, color, z=h)
        step = h / (floors + 0.5)
        for k in range(floors):
            sc.box(x + w / 2, y - d / 2 + 8, 8 + step * k, 2, d - 16, step * 0.42, pal["steel"])
        sc.cyl(x, y - d / 2 + 4, 2.2, mast_z - h, pal["steel"], z=h)
    return {"solid": sc.solids[-1], "service": (x, y - d / 2 + 4, mast_z)}
