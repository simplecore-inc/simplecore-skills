"""Substation equipment built from Scene solids.

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


def _insulator(sc, x, y, z, height, pal, sheds=8):
    """A porcelain insulator: a core with alternating wide and narrow sheds."""
    sc.cyl(x, y, 4.5, height, pal["porcelain"], z=z, rim=False)
    step = (height - 6) / sheds
    for k in range(sheds):
        sc.disc(x, y, 10 if k % 2 == 0 else 7.5, pal["porcelain"], z=z + 4 + step * k)


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
                sc.disc(x, y, 6.5, pal["porcelain"], z=line_z + 5 + 7 * k)


def bus_support(sc, x, y, pal, line_z=118):
    """A post insulator on a pedestal: the conductor ends on its cap."""
    with sc.group():
        sc.box_at(x, y, 18, 18, 3, pal["steel"])
        sc.box_at(x, y, 9, 9, 45, pal["steel"], z=3)
        _insulator(sc, x, y, 48, line_z - 6 - 48, pal, sheds=7)
        sc.cyl(x, y, 5.5, 6, pal["steel"], z=line_z - 6)
    return {"solid": sc.solids[-1], "line": (x - 5.5, y, line_z)}


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
