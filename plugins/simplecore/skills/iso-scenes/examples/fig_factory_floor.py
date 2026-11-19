"""A factory floor: machines fed from an opened distribution board whose branch
circuits carry clamp sensors, a sensor module and a gateway on the board's DIN
rail, a gas and a heat meter on their pipes, and an aisle display."""
from common import FULL, MICRO, STROKE, canvas, figure, save

from scenekit import Scene, plant


@figure(plain=True)
def fig_factory_floor():
    c = canvas(1200, 900)
    sc = Scene(c, 560, 190)
    pal = plant.palette(c)
    ground, power, gas, heat = c.t["fg_dim"], pal["live"], pal["gas"], pal["heat"]
    hall = plant.factory_hall(sc, 0, 0, 760, 560, ground, pal, wall=60)
    wx, wy = hall["wall_x"], hall["wall_y"]

    # Pipes along the low-x wall, each meter on its own pipe.
    gm = plant.gas_meter(sc, wx + 54, 250, 76, pal, axis="y")
    plant.pipe_run(sc, [(wx + 54, wy + 30), gm["pipe_in"]], 76, pal)
    plant.pipe_run(sc, [gm["pipe_out"], (wx + 54, 520)], 76, pal)
    hm = plant.heat_meter(sc, wx + 104, 380, 50, pal, axis="y")
    plant.pipe_run(sc, [(wx + 104, wy + 30), hm["pipe_in"]], 50, pal, color=heat)
    plant.pipe_run(sc, [hm["pipe_out"], (wx + 104, 520)], 50, pal, color=heat)

    # The board against the low-y wall, its inside facing +y.
    board = plant.panel_board(sc, 250, wy + 13, c.blue, pal, opened=True, facing="y",
                              clamps=(0, 1, 2), modules=("sensor", "gateway"))
    machines = [plant.machine(sc, x, 330, c.green, pal, size=s, facing="y")
                for x, s in ((330, "m"), (490, "m"), (660, "l"))]
    sign = plant.signage(sc, 700, 500, c.teal, pal, facing="y", mount="stand")

    # One feeder per machine, each on its own lane in front of the row.
    for f, m, lane in ((0.7, machines[0], 420), (0.5, machines[1], 440), (0.3, machines[2], 460)):
        bx, by = board["port"](f)
        mx, my = m["port"](0.3)
        sc.cable([(bx, by), (bx, lane), (mx, lane), (mx, my)], power, sw=STROKE)

    sc.callout(board["clamp"](1), "클램프 전류 센서", n=1, accent=pal["data"], prefer=("left",))
    sc.callout(board["module"]("sensor"), "센서 모듈", n=2, accent=pal["data"], prefer=("left",))
    sc.callout(board["module"]("gateway"), "게이트웨이", n=3, accent=pal["data"],
               prefer=("left",))
    sc.label(board, "분전반", prefer=("above", "right"))
    sc.label(machines[0], "설비 1", prefer=("above", "right"))
    sc.label(machines[1], "설비 2", prefer=("above", "right"))
    sc.label(machines[2], "설비 3", prefer=("above", "right"))
    sc.label(gm, "가스 계량기", n=4, accent=gas, prefer=("left", "below"))
    sc.label(hm, "열량계", n=4, accent=heat, prefer=("left", "below"))
    sc.label(sign, "현황판", prefer=("right", "below"))
    sc.label((500, 460, 0), "전력 간선", color=power, size=MICRO, prefer=("below",))
    sc.label(hall["corner"], "생산동", color=ground, prefer=("below", "right"))
    sc.paint()
    save(c, "factory-floor", board=FULL)


fig_factory_floor()
