"""A control room: a video wall on the back wall, an operator desk turned to
it, the room's racks, and a handheld that receives the same alarm."""
from common import FULL, MICRO, STROKE, canvas, figure, save

from scenekit import Scene, plant


@figure(plain=True)
def fig_control_room():
    c = canvas(1200, 820)
    sc = Scene(c, 560, 190)
    pal = plant.palette(c)
    ground, data, alarm = c.t["fg_dim"], pal["data"], pal["alarm"]
    room = plant.factory_hall(sc, 0, 0, 720, 580, ground, pal, wall=120, windows=False)
    wx, wy = room["wall_x"], room["wall_y"]

    wall = plant.video_wall(sc, wx, 290, 34, pal, cols=4, rows=2, alarm=(2, 1))
    desk = plant.control_desk(sc, 210, 290, c.t["muted"], pal, monitors=3, facing="-x")
    who = plant.person(sc, 268, 200, c.t["muted"], pal)
    racks = plant.rack_row(sc, 440, wy + 31, 2, c.purple, pal, facing="y")
    phone = plant.handheld(sc, 520, 430, c.purple, pal, facing="y")

    bx, by = desk["back"](0.5)
    rx, ry = racks[0]["port"](0.5)
    sc.cable([(bx, by), (320, by), (320, 160), (rx, 160), (rx, ry)], data, sw=STROKE)

    sc.callout(wall["panel_at"](2, 1), "경보 화면", n=1, accent=alarm, prefer=("left", "right"))
    sc.label(wall, "영상 벽", prefer=("above", "left"))
    sc.label(desk, "관제 데스크", n=2, accent=data, prefer=("below", "right"))
    sc.label(racks[0], "관제 서버", prefer=("above", "right"))
    sc.label(phone, "모바일 경보(확대 표시)", n=3, accent=alarm, prefer=("right", "below"))
    sc.label(who, "운영자", size=MICRO, prefer=("right", "above"))
    sc.label(room["corner"], "관제실", color=ground, prefer=("below", "right"))
    sc.paint()
    save(c, "control-room", board=FULL)


fig_control_room()
