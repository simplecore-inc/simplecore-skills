"""The svgkit toolkit under the library: builder budgets, builder binding,
and how the lint reads a root element."""
import unittest

import helpers  # noqa: F401  (puts the toolkit on the path)

import audit  # noqa: E402
import svgkit  # noqa: E402
import viztypes  # noqa: E402

BONES = [("Method", ["no checklist", "manual merge", "late review"]),
         ("Machine", ["slow disk"])]


class FishboneBudget(unittest.TestCase):
    def draw(self, bones):
        c = svgkit.Canvas(1200, 600, theme="paper")
        c.fishbone(24, 24, 1100, 520, "load delayed 3s", bones)
        return "".join(c.body)

    def test_a_fourth_cause_raises_naming_its_category(self):
        bones = [("Method", ["a", "b", "c", "d"])] + BONES[1:]
        with self.assertRaisesRegex(ValueError, "4 causes under 'Method'"):
            self.draw(bones)

    def test_three_causes_are_all_drawn(self):
        markup = self.draw(BONES)
        for cause in BONES[0][1]:
            self.assertIn(f">{cause}</text>", markup)


class BuilderNames(unittest.TestCase):
    def test_a_builder_named_like_a_primitive_is_refused(self):
        line = svgkit.Canvas.__dict__["line"]
        saved = dict(viztypes.BUILDERS)
        viztypes.BUILDERS["line"] = viztypes.BUILDERS["bar"]
        try:
            with self.assertRaisesRegex(RuntimeError, "Canvas.line"):
                svgkit._bind_viztypes()
        finally:
            viztypes.BUILDERS.clear()
            viztypes.BUILDERS.update(saved)
            svgkit.Canvas.line = line
        self.assertIs(svgkit.Canvas.__dict__["line"], line)

    def test_binding_the_builders_again_is_quiet(self):
        svgkit._bind_viztypes()
        self.assertIs(svgkit.Canvas.__dict__["fishbone"], viztypes.fishbone)


class RootDimensions(unittest.TestCase):
    def test_root_stroke_width_is_not_the_width(self):
        icon = ('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" '
                'viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M4 12h16"/></svg>')
        self.assertEqual(audit._root_dims(icon), (24.0, 24.0))

    def test_a_child_width_is_not_the_root_width(self):
        board = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 200">'
                 '<rect x="0" y="0" width="10" height="10"/></svg>')
        self.assertEqual(audit._root_dims(board), (1200.0, 900.0))


class InkBoxArcs(unittest.TestCase):
    """A circle drawn as two half arcs reaches above and below its endpoints;
    the trim reads the arc's curve, so the circle is never cut."""

    def box(self, d):
        c = svgkit.Canvas(600, 600, theme="paper")
        c.path(d, color=c.blue, sw=2, marker=None)
        return c.ink_box()

    def test_a_relative_two_arc_circle_is_bounded_by_its_radius(self):
        x0, y0, x1, y1 = self.box("M100,300 a200,200 0 1,0 400,0 a200,200 0 1,0 -400,0 Z")
        self.assertAlmostEqual(y0, 100, delta=2)
        self.assertAlmostEqual(y1, 500, delta=2)
        self.assertAlmostEqual(x0, 100, delta=2)
        self.assertAlmostEqual(x1, 500, delta=2)

    def test_an_absolute_half_arc_reaches_its_bulge(self):
        _, y0, _, y1 = self.box("M100,300 A200,200 0 0,1 500,300")
        self.assertAlmostEqual(y0, 100, delta=2)
        self.assertAlmostEqual(y1, 300, delta=2)

    def test_a_circle_element_counts_its_radius(self):
        c = svgkit.Canvas(600, 600, theme="paper")
        c.add('<circle cx="300" cy="300" r="120" fill="none" stroke="#000"/>')
        x0, y0, x1, y1 = c.ink_box()
        self.assertEqual((x0, y0, x1, y1), (180.0, 180.0, 420.0, 420.0))

    def test_a_straight_path_keeps_its_vertices(self):
        self.assertEqual(self.box("M10,20 L110,20 L110,80"), (10.0, 20.0, 110.0, 80.0))


if __name__ == "__main__":
    unittest.main()
