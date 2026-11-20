"""Checks of the plant catalogue and the engine calls it added.

Run from this directory: python3 -m unittest discover -s .
"""
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parents[2]
EXAMPLES = SKILL / "examples"
TOOLKIT = SKILL.parent / "svg-diagrams" / "scripts"
DOCFIG = TOOLKIT / "docfigures"
os.environ["DOCUMENT_FIGURES_CONFIG"] = str(EXAMPLES / ".claude" / "document-figures.json")
sys.path[:0] = [str(DOCFIG), str(TOOLKIT), str(SKILL / "scripts")]

from common import canvas  # noqa: E402
from isoscene import Scene, plant  # noqa: E402

# Every device variant, as (name, call). Each is drawn alone on a board.
DEVICES = [
    ("machine-s", "plant.machine(sc, 0, 0, c.green, pal, size='s')"),
    ("machine-m-y", "plant.machine(sc, 0, 0, c.green, pal, size='m', facing='y')"),
    ("machine-l", "plant.machine(sc, 0, 0, c.green, pal, size='l')"),
    ("switchgear", "plant.switchgear(sc, 0, 0, c.blue, pal)"),
    ("switchgear-y", "plant.switchgear(sc, 0, 0, c.blue, pal, cubicles=3, facing='y')"),
    ("board-closed", "plant.panel_board(sc, 0, 0, c.blue, pal)"),
    ("board-open", "plant.panel_board(sc, 0, 0, c.blue, pal, opened=True, clamps=(1, 2),"
                   " leakage=True, modules=('sensor', 'gateway'))"),
    ("board-open-y", "plant.panel_board(sc, 0, 0, c.blue, pal, opened=True, facing='y',"
                     " clamps=(0,), leakage=True, modules=('sensor',))"),
    ("gateway", "plant.gateway(sc, 0, 0, 60, pal, conduit=True)"),
    ("sensor", "plant.sensor_box(sc, 0, 0, 60, pal, facing='y')"),
    ("meter", "plant.meter(sc, 0, 0, 60, pal, conduit=True)"),
    ("gas", "plant.gas_meter(sc, 0, 0, 70, pal)"),
    ("gas-y", "plant.gas_meter(sc, 0, 0, 70, pal, axis='y')"),
    ("heat", "plant.heat_meter(sc, 0, 0, 50, pal)"),
    ("heat-y", "plant.heat_meter(sc, 0, 0, 50, pal, axis='y')"),
    ("rack", "plant.server_rack(sc, 0, 0, c.purple, pal)"),
    ("rack-row", "plant.rack_row(sc, 0, 0, 3, c.purple, pal, facing='y')"),
    ("cloud", "plant.cloud_room(sc, 0, -100, c.purple, pal)"),
    ("desk", "plant.control_desk(sc, 0, 0, c.blue, pal, facing='y')"),
    ("desk-back", "plant.control_desk(sc, 0, 0, c.blue, pal, facing='-x')"),
    ("video-wall", "plant.video_wall(sc, 0, 0, 40, pal, alarm=(1, 0))"),
    ("sign", "plant.signage(sc, 0, 0, c.teal, pal)"),
    ("sign-hang", "plant.signage(sc, 0, 0, c.teal, pal, mount='hang', facing='y')"),
    ("phone", "plant.handheld(sc, 0, 0, c.purple, pal)"),
    ("tablet", "plant.handheld(sc, 0, 0, c.purple, pal, kind='tablet', facing='y')"),
    ("person", "plant.person(sc, 0, 0, c.t['muted'], pal)"),
    ("person-stand-y", "plant.person(sc, 0, 0, c.t['muted'], pal, facing='y')"),
    ("person-stand-back", "plant.person(sc, 0, 0, c.t['muted'], pal, facing='-x')"),
    ("person-phone", "plant.person(sc, 0, 0, c.t['muted'], pal, holding='phone')"),
    ("person-phone-y", "plant.person(sc, 0, 0, c.t['muted'], pal, facing='y', holding='phone')"),
    ("person-tablet-back", "plant.person(sc, 0, 0, c.t['muted'], pal, facing='-y', holding='tablet')"),
    ("person-sit", "plant.person(sc, 0, 0, c.t['muted'], pal, pose='sit')"),
    ("person-sit-y", "plant.person(sc, 0, 0, c.t['muted'], pal, pose='sit', facing='y')"),
    ("person-sit-back-x", "plant.person(sc, 0, 0, c.t['muted'], pal, pose='sit', facing='-x')"),
    ("person-sit-back-y", "plant.person(sc, 0, 0, c.t['muted'], pal, pose='sit', facing='-y')"),
    ("chair", "plant.chair(sc, 0, 0, c.t['muted'], pal, facing='y')"),
    ("seated-desk-x", "plant.seat_at(sc, plant.control_desk(sc, 0, 0, c.blue, pal, facing='x'),"
                      " c.t['muted'], pal)"),
    ("seated-desk-y", "plant.seat_at(sc, plant.control_desk(sc, 0, 0, c.blue, pal, monitors=2,"
                      " facing='y'), c.t['muted'], pal)"),
    ("seated-desk-back", "plant.seat_at(sc, plant.control_desk(sc, 0, 0, c.blue, pal, facing='-x'),"
                         " c.t['muted'], pal)"),
    ("building-saw", "plant.factory_building(sc, 0, 0, 160, 120, 60, c.blue, pal)"),
    ("building-flat", "plant.factory_building(sc, 0, 0, 160, 120, 60, c.blue, pal,"
                      " roof='flat', door='y')"),
    ("hall", "plant.factory_hall(sc, -150, -150, 150, 150, c.t['fg_dim'], pal)"),
    ("pipe", "plant.pipe_run(sc, [(-150, 0), (100, 0), (100, 150)], 60, pal)"),
    ("conveyor", "plant.conveyor(sc, 0, 0, 120, c.t['muted'], pal)"),
    ("conveyor-belt-y", "plant.conveyor(sc, 0, 0, 100, c.t['muted'], pal, axis='y', kind='belt')"),
    ("car", "plant.car_body(sc, 0, 0, c.t['muted'], pal)"),
    ("car-skid-y", "plant.car_body(sc, 0, 0, c.t['muted'], pal, facing='y', skid=True)"),
    ("car-wheels", "plant.car_body(sc, 0, 0, c.t['muted'], pal, wheels=True)"),
    ("car-wheels-y", "plant.car_body(sc, 0, 0, c.t['muted'], pal, facing='y', wheels=True)"),
    ("panel-part", "plant.panel_part(sc, 0, 0, c.t['muted'], pal, count=3)"),
    ("press", "plant.press(sc, 0, 0, c.orange, pal)"),
    ("press-coil", "plant.press(sc, 0, 0, c.orange, pal, feed='coil')"),
    ("press-sheet-y", "plant.press(sc, 0, 0, c.orange, pal, facing='y', feed='sheet')"),
    ("robot-weld", "plant.robot_arm(sc, 0, 0, c.orange, pal)"),
    ("robot-weld-y", "plant.robot_arm(sc, 0, 0, c.orange, pal, facing='y')"),
    ("robot-gripper-back", "plant.robot_arm(sc, 0, 0, c.orange, pal, facing='-y', tool='gripper')"),
    ("robot-spray-back", "plant.robot_arm(sc, 0, 0, c.orange, pal, facing='-x', tool='spray')"),
    ("booth", "plant.paint_booth(sc, 0, 0, 84, c.orange, pal)"),
    ("booth-y", "plant.paint_booth(sc, 0, 0, 84, c.orange, pal, axis='y')"),
    ("injection", "plant.injection_machine(sc, 0, 0, c.blue, pal)"),
    ("injection-x", "plant.injection_machine(sc, 0, 0, c.blue, pal, facing='x')"),
    ("bench", "plant.assembly_bench(sc, 0, 0, c.blue, pal)"),
    ("bench-x", "plant.assembly_bench(sc, 0, 0, c.blue, pal, facing='x', trays=4)"),
    ("fence", "plant.cell_fence(sc, -60, -40, 60, 40, pal)"),
    ("line-vehicle", "plant.production_line(sc, 'vehicle', -200, -60, 120, 60, c.orange, pal)"),
    ("line-electronics-y", "plant.production_line(sc, 'electronics', -40, -200, 40, 0, c.blue, pal, axis='y')"),
    ("line-body-parts", "plant.production_line(sc, 'body_parts', -200, -50, 110, 50, c.orange, pal)"),
]


def _scene():
    c = canvas(1200, 600)
    return c, Scene(c, 600, 200), plant.palette(c)


def _ports(result):
    """Every floor port a catalogue result offers, at a few fractions."""
    out = []
    for key in ("port", "back"):
        value = result.get(key)
        if callable(value):
            out += [value(f) for f in (0.3, 0.5, 0.7)]
        elif value:
            out.append(value)
    for key in ("cubicle",):
        if callable(result.get(key)):
            out += [result[key](k) for k in range(3)]
    if "door_port" in result:
        out.append(result["door_port"])
    return out


class PortsMeetFaces(unittest.TestCase):
    """A cable leaving any returned port square to its face passes the engine."""

    def test_every_port(self):
        for name, call in DEVICES:
            with self.subTest(device=name):
                c, sc, pal = _scene()
                result = eval(call, {"plant": plant, "sc": sc, "c": c, "pal": pal})
                ports = _ports(result if isinstance(result, dict) else {})
                for px, py in ports:
                    c2, sc2, pal2 = _scene()
                    res2 = eval(call, {"plant": plant, "sc": sc2, "c": c2, "pal": pal2})
                    foot = [s.get("foot", s["bbox"]) for s in sc2.solids if s["bbox"][2] <= 0.5]
                    # The face the port is on decides the way out.
                    on_x = any(abs(px - f[3]) < 0.6 for f in foot)
                    out = (px + 30, py) if on_x else (px, py + 30)
                    sc2.cable([(px, py), out], c2.teal, ends=("face", "free"))
                    sc2._check_cables()
                    self.assertTrue(res2)


class EngineChecks(unittest.TestCase):
    def test_pipe_refuses_an_oblique_run(self):
        c, sc, pal = _scene()
        with self.assertRaises(ValueError):
            plant.pipe_run(sc, [(0, 0), (50, 40)], 60, pal)

    def test_opened_board_needs_a_front_facing_the_viewer(self):
        c, sc, pal = _scene()
        with self.assertRaises(ValueError):
            plant.panel_board(sc, 0, 0, c.blue, pal, opened=True, facing="-x")

    def test_corner_clearance_is_absolute_on_a_long_face(self):
        c, sc, pal = _scene()
        gear = plant.switchgear(sc, 0, 0, c.blue, pal, cubicles=4)
        px, py = gear["cubicle"](0)
        sc.cable([(px, py), (px + 30, py)], c.teal, ends=("face", "free"))
        sc._check_cables()
        c, sc, pal = _scene()
        gear = plant.switchgear(sc, 0, 0, c.blue, pal, cubicles=4)
        fx, fy = gear["port"](0.02)
        sc.cable([(fx, fy), (fx + 30, fy)], c.teal, ends=("face", "free"))
        with self.assertRaises(ValueError):
            sc._check_cables()

    def test_default_person_keeps_its_result_and_footprint(self):
        c, sc, pal = _scene()
        who = plant.person(sc, 10, 20, c.t["muted"], pal)
        self.assertEqual(who["head"], (10, 20, 81))
        foot = who["solid"]["foot"]
        # Within the ground the figure of cylinders stood on, so a scene
        # laid out around it still clears its neighbours.
        self.assertTrue(10 - 3.6 <= foot[0] and foot[3] <= 10 + 3.6, foot)
        self.assertTrue(20 - 10.6 <= foot[1] and foot[4] <= 20 + 10.6, foot)

    def test_seated_person_touches_the_desk_and_does_not_overlap_it(self):
        for facing in ("x", "y", "-x", "-y"):
            with self.subTest(facing=facing):
                c, sc, pal = _scene()
                desk = plant.control_desk(sc, 0, 0, c.blue, pal, facing=facing)
                who = plant.seat_at(sc, desk, c.t["muted"], pal)
                self.assertIn("seat", who)
                self.assertIn("hand", who)
                sc._check_footprints()

    def test_person_refuses_an_unknown_pose_or_a_handheld_when_seated(self):
        c, sc, pal = _scene()
        with self.assertRaises(ValueError):
            plant.person(sc, 0, 0, c.t["muted"], pal, pose="kneel")
        with self.assertRaises(ValueError):
            plant.person(sc, 0, 0, c.t["muted"], pal, pose="sit", holding="phone")
        with self.assertRaises(ValueError):
            plant.person(sc, 0, 0, c.t["muted"], pal, holding="radio")

    def test_cyl_y_box(self):
        c, sc, pal = _scene()
        solid = sc.cyl_y(10, 20, 30, 5, 40, c.blue)
        self.assertEqual(solid["bbox"], (5, 20, 25, 15, 60, 35))

    def test_prism_box_and_refusals(self):
        c, sc, pal = _scene()
        solid = sc.prism("y", 10, 40, [(0, 0), (20, 0), (15, 8), (5, 8)], c.blue)
        self.assertEqual(solid["bbox"], (0, 10, 0, 20, 40, 8))
        # A profile given clockwise draws the same faces.
        again = sc.prism("y", 10, 40, [(5, 8), (15, 8), (20, 0), (0, 0)], c.blue)
        self.assertEqual(solid["markup"], again["markup"])
        with self.assertRaises(ValueError):
            sc.prism("z", 0, 1, [(0, 0), (1, 0), (1, 1)], c.blue)
        with self.assertRaises(ValueError):
            sc.prism("x", 0, 1, [(0, 0), (1, 0)], c.blue)

    def test_callout_leaders_never_cross(self):
        from isoscene.scene import _segs_cross
        c, sc, pal = _scene()
        board = plant.panel_board(sc, 0, 0, c.blue, pal, opened=True, clamps=(1, 3),
                                  leakage=True, modules=("sensor",))
        for point, text in ((board["clamp"](1), "가"), (board["clamp"](3), "나"),
                            (board["leak"], "다"), (board["module"]("sensor"), "라")):
            sc.callout(point, text)
        sc.paint()
        self.assertFalse(_segs_cross((0, 0), (10, 10), (0, 10), (10, 20)))
        self.assertTrue(_segs_cross((0, 0), (10, 10), (0, 10), (10, 0)))


class ProductionLines(unittest.TestCase):
    """The production-line devices return their anchors and stay on their
    ground; a line fits the rectangle it was given or says what it needs."""

    def test_devices_return_their_anchors(self):
        c, sc, pal = _scene()
        conv = plant.conveyor(sc, 0, 0, 120, c.t["muted"], pal)
        self.assertEqual(conv["top"], 16)
        x0, y0, z0 = conv["at"](0.0)
        x1, y1, z1 = conv["at"](1.0)
        self.assertAlmostEqual(x1 - x0, 120)
        self.assertEqual((y0, z0), (y1, z1))
        cases = (("car", plant.car_body(sc, 0, 120, c.t["muted"], pal, z=16, wheels=True),
                  ("roof", "side")),
                 ("press", plant.press(sc, 200, 0, c.orange, pal, feed="coil"),
                  ("ram", "bolster", "feed", "extent")),
                 ("robot", plant.robot_arm(sc, 300, 0, c.orange, pal), ("tool", "elbow", "extent")),
                 ("booth", plant.paint_booth(sc, 0, 250, 84, c.orange, pal), ("stack", "opening")),
                 ("injection", plant.injection_machine(sc, 200, 250, c.blue, pal),
                  ("mould", "hopper")),
                 ("bench", plant.assembly_bench(sc, 400, 250, c.blue, pal), ("tray",)))
        for name, result, keys in cases:
            with self.subTest(device=name):
                self.assertIn("solid", result)
                for key in keys:
                    self.assertIsNotNone(result[key], key)
        sc._check_footprints()

    def test_robot_tool_reaches_its_stated_distance(self):
        for facing, axis, sign in (("x", 0, 1), ("y", 1, 1), ("-x", 0, -1), ("-y", 1, -1)):
            with self.subTest(facing=facing):
                c, sc, pal = _scene()
                arm = plant.robot_arm(sc, 0, 0, c.orange, pal, facing=facing)
                self.assertAlmostEqual(arm["tool"][axis] * sign, plant.ROBOT_REACH)

    def test_unknown_options_are_refused(self):
        c, sc, pal = _scene()
        with self.assertRaises(ValueError):
            plant.robot_arm(sc, 0, 0, c.orange, pal, tool="laser")
        with self.assertRaises(ValueError):
            plant.press(sc, 0, 0, c.orange, pal, feed="robot")
        with self.assertRaises(ValueError):
            plant.conveyor(sc, 0, 0, 100, c.t["muted"], pal, axis="z")
        with self.assertRaises(ValueError):
            plant.production_line(sc, "bakery", 0, 0, 400, 200, c.orange, pal)

    def _fits(self, kind, x0, y0, x1, y1, axis):
        c, sc, pal = _scene()
        line = plant.production_line(sc, kind, x0, y0, x1, y1, c.orange, pal, axis=axis)
        self.assertEqual(list(line["stations"]), list(plant.LINE_KINDS[kind]))
        for station in line["stations"].values():
            self.assertEqual(len(station["point"]), 3)
        for solid in sc.solids:
            bx0, by0, _, bx1, by1, _ = solid["bbox"]
            self.assertGreaterEqual(bx0, x0 - 0.01, solid["bbox"])
            self.assertGreaterEqual(by0, y0 - 0.01, solid["bbox"])
            self.assertLessEqual(bx1, x1 + 0.01, solid["bbox"])
            self.assertLessEqual(by1, y1 + 0.01, solid["bbox"])
        sc._check_footprints()
        return line

    def test_each_line_fits_its_rectangle_at_several_sizes_on_both_axes(self):
        for kind, (need_l, need_d) in plant.LINE_MIN.items():
            for extra_l, extra_d in ((0, 0), (90, 20), (260, 60)):
                for axis in ("x", "y"):
                    with self.subTest(kind=kind, axis=axis, extra=(extra_l, extra_d)):
                        length, depth = need_l + extra_l, need_d + extra_d
                        if axis == "x":
                            self._fits(kind, 10, 20, 10 + length, 20 + depth, axis)
                        else:
                            self._fits(kind, 10, 20, 10 + depth, 20 + length, axis)

    def test_more_floor_repeats_stations(self):
        small = self._fits("vehicle", 0, 0, 270, 100, "x")
        large = self._fits("vehicle", 0, 0, 560, 100, "x")
        self.assertGreater(len(large["devices"]), len(small["devices"]))

    def test_a_rectangle_too_small_fails_naming_the_size_needed(self):
        for kind, (need_l, need_d) in plant.LINE_MIN.items():
            with self.subTest(kind=kind):
                c, sc, pal = _scene()
                with self.assertRaisesRegex(ValueError, f"at least {need_l} along x and {need_d}"):
                    plant.production_line(sc, kind, 0, 0, need_l - 1, need_d + 10, c.orange, pal)
                with self.assertRaises(ValueError):
                    plant.production_line(sc, kind, 0, 0, need_l + 10, need_d - 1, c.orange, pal)


class DevicesPassTheLint(unittest.TestCase):
    """Each device alone, and every example scene, passes the document-figure
    lint: no coincident or self-doubled lines, labels clear."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp())
        shutil.copytree(EXAMPLES / ".claude", cls.tmp / ".claude")
        shutil.copy(EXAMPLES / "scenekit.py", cls.tmp / "scenekit.py")
        (cls.tmp / "figures").mkdir()
        body = ["from common import FULL, canvas, figure, save",
                "from scenekit import Scene, plant", ""]
        for name, call in DEVICES:
            fn = "fig_" + name.replace("-", "_")
            body += ["@figure(plain=True)", f"def {fn}():",
                     "    c = canvas(1200, 520)", "    sc = Scene(c, 600, 200)",
                     "    pal = plant.palette(c)", f"    {call}", "    sc.paint()",
                     f"    save(c, 'dev-{name}', board=FULL)", f"{fn}()", ""]
        (cls.tmp / "fig_devices.py").write_text("\n".join(body), encoding="utf-8")
        env = dict(os.environ, DOCUMENT_FIGURES_CONFIG=str(cls.tmp / ".claude" / "document-figures.json"))
        cls.env = env
        subprocess.run([sys.executable, str(DOCFIG / "build.py")], cwd=cls.tmp, env=env,
                       check=True, capture_output=True)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp)

    def _lint(self, cwd, env, name):
        out = subprocess.run([sys.executable, str(DOCFIG / "verify.py"), name], cwd=cwd,
                             env=env, capture_output=True, text=True).stdout
        # A device alone does not fill its board; the side gap is not its defect.
        return [line.strip() for line in out.splitlines()
                if "✖" in line and "DEAD-MARGIN" not in line]

    def test_each_device(self):
        for name, _ in DEVICES:
            with self.subTest(device=name):
                self.assertEqual(self._lint(self.tmp, self.env, "dev-" + name), [])

    def test_example_scenes(self):
        env = dict(os.environ, DOCUMENT_FIGURES_CONFIG=str(EXAMPLES / ".claude" / "document-figures.json"))
        tmp = Path(tempfile.mkdtemp())
        try:
            shutil.copytree(EXAMPLES, tmp / "ex", ignore=shutil.ignore_patterns("figures", "__pycache__"))
            (tmp / "ex" / "figures").mkdir()
            env["DOCUMENT_FIGURES_CONFIG"] = str(tmp / "ex" / ".claude" / "document-figures.json")
            subprocess.run([sys.executable, str(DOCFIG / "build.py")], cwd=tmp / "ex", env=env,
                           check=True, capture_output=True)
            out = subprocess.run([sys.executable, str(DOCFIG / "verify.py")], cwd=tmp / "ex",
                                 env=env, capture_output=True, text=True).stdout
            self.assertIn("verdict: pass", out, out[-2000:])
        finally:
            shutil.rmtree(tmp)


if __name__ == "__main__":
    unittest.main()
