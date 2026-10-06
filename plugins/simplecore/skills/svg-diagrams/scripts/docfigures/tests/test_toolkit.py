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


if __name__ == "__main__":
    unittest.main()
