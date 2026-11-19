"""An electrical room: switchgear feeding an opened distribution board whose
branches carry clamp sensors and whose main feeder passes a leakage sensor,
a sensor module on the board's DIN rail, and a wall gateway and meter."""
from common import FULL, MICRO, STROKE, canvas, figure, save

from scenekit import Scene, plant


@figure(plain=True)
def fig_electrical_room():
    c = canvas(1200, 860)
    sc = Scene(c, 545, 200)
    pal = plant.palette(c)
    ground, power, data = c.t["fg_dim"], pal["live"], pal["data"]
    room = plant.factory_hall(sc, 0, 0, 760, 580, ground, pal, wall=60)
    wx, wy = room["wall_x"], room["wall_y"]

    gear = plant.switchgear(sc, wx + 36, 300, c.blue, pal, cubicles=4)
    board = plant.panel_board(sc, 260, wy + 13, c.blue, pal, opened=True, facing="y",
                              clamps=(1, 2, 3), leakage=True, modules=("sensor",))
    gw = plant.gateway(sc, 440, wy, 84, pal, facing="y", conduit=True)
    mt = plant.meter(sc, 520, wy, 84, pal, facing="y")
    who = plant.person(sc, 420, 330, c.t["muted"], pal)

    # The feeder from the last cubicle to the board, and the board's data
    # line to the gateway's riser.
    gx, gy = gear["cubicle"](3)
    bx, by = board["port"](0.5)
    sc.cable([(gx, gy), (bx, gy), (bx, by)], power)
    dx, dy = board["port"](0.78)
    rx, ry = gw["port"]
    sc.cable([(dx, dy), (dx, 110), (rx, 110), (rx, ry)], data, sw=STROKE, arrow=True)

    sc.callout(board["clamp"](2), "클램프 전류 센서", n=1, accent=data, prefer=("left",))
    sc.callout(board["leak"], "누설 전류 센서", n=2, accent=data, prefer=("right", "left"))
    sc.callout(board["module"]("sensor"), "센서 모듈", n=3, accent=data, prefer=("left",))
    sc.label(gw, "게이트웨이", n=4, accent=data, prefer=("above", "right"))
    sc.label(gear, "수배전반", prefer=("above", "left"))
    sc.label(board, "분전반", prefer=("above", "right"))
    sc.label(mt, "전력량계", size=MICRO, prefer=("above", "right"))
    sc.label(who, "점검자", size=MICRO, prefer=("right", "above"))
    sc.label((200, gy, 0), "간선", color=power, size=MICRO, prefer=("below",))
    sc.label((380, 110, 0), "계측 데이터", color=data, size=MICRO, prefer=("below",))
    sc.label(room["corner"], "전기실", color=ground, prefer=("below", "right"))
    sc.paint()
    save(c, "electrical-room", board=FULL)


fig_electrical_room()
