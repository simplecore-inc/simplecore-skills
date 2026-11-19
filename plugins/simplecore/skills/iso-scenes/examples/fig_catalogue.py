"""A sheet of the plant catalogue: every device once, on one floor, named."""
from common import FULL, MICRO, canvas, figure, save

from scenekit import Scene, plant


@figure(plain=True)
def fig_catalogue():
    c = canvas(1200, 980)
    sc = Scene(c, 600, 150)
    pal = plant.palette(c)
    ground = c.t["fg_dim"]
    sc.island(-40, -40, 620, 620, ground)
    hall = plant.factory_hall(sc, -40, -40, 620, 620, ground, pal, wall=60, floor=False)
    wx, wy = hall["wall_x"], hall["wall_y"]

    # Along the low-x wall, fronts facing +x.
    sw = plant.switchgear(sc, wx + 36, 500, c.blue, pal, cubicles=3)
    pb = plant.panel_board(sc, wx + 14, 360, c.blue, pal, opened=True, clamps=(1, 4),
                           leakage=True, modules=("sensor", "gateway"))
    closed = plant.panel_board(sc, wx + 14, 235, c.blue, pal, width=70, height=140)
    gw = plant.gateway(sc, wx, 185, 70, pal, conduit=True)
    mt = plant.meter(sc, wx, 140, 70, pal)
    sb = plant.sensor_box(sc, wx, 95, 80, pal)
    vw = plant.video_wall(sc, wx, 20, 40, pal, cols=2, rows=2, alarm=(1, 1))

    # Along the low-y wall, fronts facing +y.
    racks = plant.rack_row(sc, 120, wy + 31, 3, c.purple, pal, facing="y")
    sg = plant.signage(sc, 300, wy + 4, c.teal, pal, facing="y", mount="hang", z=60)
    desk = plant.control_desk(sc, 450, wy + 30, ground, pal,
                              facing="y")

    # On the floor.
    m_s = plant.machine(sc, 160, 200, c.green, pal, size="s")
    m_m = plant.machine(sc, 160, 320, c.green, pal, size="m")
    m_l = plant.machine(sc, 330, 430, c.green, pal, size="l", facing="y")
    stand = plant.signage(sc, 360, 250, c.teal, pal, mount="stand")
    phone = plant.handheld(sc, 470, 200, c.purple, pal)
    tablet = plant.handheld(sc, 470, 320, c.purple, pal, kind="tablet")
    who = plant.person(sc, 590, 520, c.t["muted"], pal)
    holder = plant.person(sc, 560, 300, c.t["muted"], pal, facing="y", holding="phone")
    seated = plant.seat_at(sc, desk, c.t["muted"], pal)
    empty = plant.chair(sc, 570, 190, c.t["muted"], pal, facing="y")

    gm = plant.gas_meter(sc, 180, 560, 70, pal)
    plant.pipe_run(sc, [(60, 560), gm["pipe_in"]], 70, pal)
    plant.pipe_run(sc, [gm["pipe_out"], (280, 560), (280, 500)], 70, pal)
    hm = plant.heat_meter(sc, 450, 560, 50, pal)
    plant.pipe_run(sc, [(360, 560), hm["pipe_in"]], 50, pal, color=pal["heat"])
    plant.pipe_run(sc, [hm["pipe_out"], (580, 560)], 50, pal, color=pal["heat"])

    gx, gy = gw["port"]
    sc.cable([(gx, gy), (gx + 40, gy), (gx + 40, gy + 50)], c.teal, ends=("face", "free"))

    sc.label(pb, "분전반(열림)", prefer=("above", "left"))
    sc.label(sw, "수배전반", prefer=("above", "left"))
    sc.label(gw, "게이트웨이", size=MICRO, prefer=("left", "above"))
    sc.label(mt, "전력량계", size=MICRO, prefer=("left", "above"))
    sc.label(vw, "영상 벽", prefer=("below", "right", "left", "above"))
    sc.label(racks[0], "서버 랙", prefer=("above", "right"))
    sc.label(sg, "현황판", prefer=("above", "right"))
    sc.label(desk, "관제 데스크", prefer=("above", "right"))
    sc.label(m_s, "설비 S", prefer=("above", "right"))
    sc.label(m_m, "설비 M", prefer=("above", "right"))
    sc.label(m_l, "설비 L", prefer=("below", "right"))
    sc.label(stand, "현황판(스탠드)", prefer=("right", "above"))
    sc.label(phone, "스마트폰", prefer=("right", "above"))
    sc.label(tablet, "태블릿", prefer=("right", "below"))
    sc.label(who, "작업자", prefer=("right", "above"))
    sc.label(holder, "작업자(휴대폰)", prefer=("right", "above"))
    sc.label(seated, "운영자(착석)", prefer=("right", "below"))
    sc.label(empty, "의자", prefer=("right", "above"))
    sc.label(gm, "가스 계량기", prefer=("below", "left"))
    sc.label(hm, "열량계", prefer=("below", "right"))
    sc.paint()
    save(c, "catalogue", board=FULL)


fig_catalogue()
