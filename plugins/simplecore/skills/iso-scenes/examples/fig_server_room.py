"""A site and its server room: two closed factory buildings on one island send
their data along a duct to a row of racks in a server room on its own island."""
from common import FULL, MICRO, STROKE, canvas, figure, save

from scenekit import Scene, plant


@figure(plain=True)
def fig_server_room():
    c = canvas(1200, 760)
    sc = Scene(c, 480, 110)
    pal = plant.palette(c)
    ground, data = c.t["fg_dim"], pal["data"]

    room = plant.cloud_room(sc, 0, 120, c.purple, pal, racks=5, ground=ground)
    sc.island(300, -40, 840, 330, ground)
    plants = [plant.factory_building(sc, x, 120, 150, 110, 56, c.blue, pal, door="y")
              for x in (420, 680)]
    for lane in (250, 290):
        sc.strip(150, lane - 9, 300, lane + 9, ground, opacity=0.12)

    # Each factory's line leaves its door, runs along its own duct between the
    # islands and reaches its own rack from the front.
    for fac, rack, lane, drop in ((plants[0], 1, 250, 94), (plants[1], 0, 290, 110)):
        px, py = fac["door_port"]
        rx, ry = room["rack_port"](rack)
        sc.cable([(px, py), (px, lane), (drop, lane), (drop, ry), (rx, ry)], data, sw=STROKE,
                 arrow=True)

    sc.label(room["racks"][0], "서버 랙", n=2, accent=data, prefer=("above", "right"))
    sc.label(room["cooler"], "항온항습기", size=MICRO, prefer=("above", "left"))
    sc.label(plants[0], "공장 A", n=1, accent=data, prefer=("above", "right"))
    sc.label(plants[1], "공장 B", n=1, accent=data, prefer=("above", "right"))
    sc.label(room["corner"], "서버실", color=ground, prefer=("below", "left"))
    sc.label((225, 290, 0), "통신 관로", color=data, size=MICRO, prefer=("below",))
    sc.paint()
    save(c, "server-room", board=FULL)


fig_server_room()
