"""Three factories, each drawn as a cut-away hall with its production line so
the reader can tell what it makes: a finished-vehicle plant (body shop, paint
booth, final assembly), an electronic-parts plant (injection moulding, bench
assembly) and a body-parts plant (press line, welding cell)."""
from common import FULL, canvas, figure, save

from scenekit import Scene, plant


@figure(plain=True)
def fig_production_lines():
    c = canvas(1200, 900)
    sc = Scene(c, 720, 96)
    pal = plant.palette(c)
    ground = c.t["fg_dim"]
    names = {"body": "차체", "paint": "도장", "assembly": "조립", "moulding": "사출",
             "press": "프레스", "welding": "용접"}
    halls = (("vehicle", 0, "완성차 공장"), ("electronics", 225, "전장부품 공장"),
             ("body_parts", 410, "차체부품 공장"))
    depths = {"vehicle": 170, "electronics": 130, "body_parts": 180}
    for kind, y0, title in halls:
        y1 = y0 + depths[kind]
        hall = plant.factory_hall(sc, 0, y0, 716, y1, ground, pal, wall=40)
        line = plant.production_line(sc, kind, hall["wall_x"] + 6, hall["wall_y"] + 6,
                                     708, y1 - 8, c.orange if kind != "electronics" else c.blue,
                                     pal)
        for name, station in line["stations"].items():
            sc.callout(station["point"], names[name], accent=c.orange, prefer=("up", "left", "right"))
        sc.label(hall["corner"], title, color=ground, prefer=("below", "left", "right"))
    sc.paint()
    save(c, "production-lines", board=FULL)


fig_production_lines()
