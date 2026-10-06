"""What the drawing helpers emit when a module leaves their defaults alone.

Each case builds a figure the way a module would and reads the saved SVG back:
body text on the body rung, connectors and icons on the declared ladders, a
coloured line in either tuple order, and no filter for PowerPoint to drop.
"""
import re
import unittest

from helpers import Project, svg

import verify  # noqa: E402

TEXT = re.compile(r"<text\b([^>]*)>(.*?)</text>", re.S)


def sizes_of(markup, content):
    """font-size of every text element whose content is `content`."""
    return [float(re.search(r'font-size="([\d.]+)"', a).group(1))
            for a, t in TEXT.findall(markup) if t == content]


class Built(unittest.TestCase):
    """A throwaway project whose one module is the case's source."""

    CONFIG = {}

    def setUp(self):
        self.p = Project(**self.CONFIG)
        self.cfg = self.p.cfg()

    def tearDown(self):
        self.p.close()

    def build(self, source, name):
        self.p.write("figs/case.py", source)
        run = self.p.run("build.py")
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
        path = self.p.root / "figures" / f"{name}.svg"
        return path, path.read_text(encoding="utf-8")


class BodyOnTheBodyRung(Built):
    # In the fixtures MICRO (21) sits below BODY (24); a helper whose running
    # text defaulted to MICRO prints these lines at 21.
    def test_card_and_note_bodies_print_at_body(self):
        _path, markup = self.build('''from common import canvas, card, note, save
c = canvas(1200, 300)
card(c, 24, 24, 560, c.blue, "Title", ["card body line"])
note(c, 620, 24, 556, "note body line", c.teal)
save(c, "bodies")
''', "bodies")
        self.assertEqual(sizes_of(markup, "card body line"), [24.0])
        self.assertEqual(sizes_of(markup, "note body line"), [24.0])

    def test_card_height_is_measured_at_body(self):
        # card_h() and card() agree only when both default to the same rung
        _path, markup = self.build('''from common import BODY, canvas, card, card_h, save
c = canvas(1200, 300)
box = card(c, 24, 24, 560, c.blue, "Title", ["one", "two"])
assert abs(box[3] - card_h(560, "Title", ["one", "two"], size=BODY)) < 0.01, box
save(c, "heights")
''', "heights")
        self.assertEqual(sizes_of(markup, "one"), [24.0])


class ColumnBoard(Built):
    # The icon stroke is set apart from every rung, so a connector at svgkit's
    # default 2 is not mistaken for an icon segment and exempted.
    CONFIG = {"icon": {"size": 22, "sw": 1.6}}

    SOURCE = '''from column import down, finish, panel
from common import canvas
c = canvas(528, 400)
a = panel(c, 24, "First", ["what happens first"])
b = panel(c, a[1] + a[3] + 48, "Second", ["what follows"])
down(c, a, b)
d = panel(c, b[1] + b[3] + 48, "Third", ["off centre"], x=40, w=300)
down(c, b, d)
finish(c, "column")
'''

    def test_arrows_are_on_the_stroke_ladder(self):
        path, _markup = self.build(self.SOURCE, "column")
        self.assertEqual(verify.stroke_width_errors([path], self.cfg), [])

    def test_panel_lines_print_at_body(self):
        _path, markup = self.build(self.SOURCE, "column")
        self.assertEqual(sizes_of(markup, "what happens first"), [24.0])


class ZoneIcon(Built):
    CONFIG = {"icon": {"size": 22, "sw": 1.8}}

    def test_zone_icon_takes_the_set_size_and_stroke(self):
        path, markup = self.build('''from common import canvas, save, zone
c = canvas(1200, 300)
zone(c, 24, 40, 1152, 200, c.blue, "Zone", icon="circle")
save(c, "zone")
''', "zone")
        self.assertEqual(verify.stroke_width_errors([path], self.cfg), [])
        # Lucide's circle has r=10 on its 24-unit grid
        radii = [float(r) for r in re.findall(r'<circle\b[^>]*\br="([\d.]+)"', markup)]
        self.assertIn(round(10 * 22 / 24, 2), radii)


class LineOrder(Built):
    def test_svgkit_order_prints_the_text_in_the_colour(self):
        _path, markup = self.build('''from common import canvas, card, save
c = canvas(1200, 200)
card(c, 24, 24, 1152, c.blue, "Title", [(c.t["fg"], "colour first"),
                                         ("text first", c.t["fg"])])
save(c, "order")
''', "order")
        texts = [t for _a, t in TEXT.findall(markup)]
        self.assertIn("colour first", texts)
        self.assertIn("text first", texts)
        self.assertFalse([t for t in texts if re.fullmatch(r"#[0-9a-fA-F]{6}", t)], texts)


class NoFilter(Built):
    def test_canvas_draws_svgkit_nodes_without_a_shadow(self):
        path, markup = self.build('''from common import canvas, save
c = canvas(1200, 200)
c.node(24, 24, 300, 80, c.blue, "node")
c.card(400, 24, 300, 80, c.green, title="card")
save(c, "nodes")
''', "nodes")
        self.assertNotIn("filter", markup)
        self.assertEqual(verify.filter_errors([path], self.cfg), [])

    def test_a_figure_that_references_a_filter_fails(self):
        f = self.p.write("figures/shadowed.svg", svg(
            '<defs><filter id="soft"><feDropShadow dx="0" dy="3"/></filter></defs>'
            '<rect x="40" y="40" width="300" height="80" filter="url(#soft)"/>'
            '<rect x="400" y="40" width="300" height="80" style="filter: url(#soft)"/>'))
        self.assertEqual(verify.filter_errors([f], self.cfg), [("shadowed.svg", 2)])


if __name__ == "__main__":
    unittest.main()
