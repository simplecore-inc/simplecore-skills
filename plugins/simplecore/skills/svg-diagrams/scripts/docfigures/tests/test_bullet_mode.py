"""`[bullets]`: a figure lists its items or is declared plain, each case red on
its broken form and quiet on the fixed one."""
import unittest

from helpers import Project, svg, text

import verify  # noqa: E402

PLAIN = ' data-list-mode="plain"'


def box(x, y, w=300, h=120):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="none" stroke="#000"/>'


class BulletMode(unittest.TestCase):
    def setUp(self):
        self.p = Project()
        self.cfg = self.p.cfg()

    def tearDown(self):
        self.p.close()

    def found(self, body, attrs=""):
        f = self.p.write("figures/a.svg", svg(body, attrs=attrs))
        return [why for _n, why in verify.bullet_mode([f], self.cfg)]

    def test_box_listing_two_items_passes(self):
        body = box(20, 20) + text(40, 60, "•") + text(40, 90, "•")
        self.assertEqual(self.found(body), [])

    def test_single_bullets_in_boxes_fail(self):
        body = (box(20, 20) + text(40, 60, "•")
                + box(400, 20) + text(420, 60, "•"))
        self.assertEqual(len(self.found(body)), 1)

    def test_list_outside_every_box_counts_by_its_x(self):
        # a lane's two items under its name, beside boxes holding one each
        body = (text(40, 60, "•") + text(40, 90, "•")
                + box(400, 20) + text(420, 60, "•"))
        self.assertEqual(self.found(body), [])

    def test_single_bullets_outside_boxes_at_different_x_fail(self):
        body = text(40, 60, "•") + text(240, 60, "•")
        self.assertEqual(len(self.found(body)), 1)

    def test_plain_figure_drawing_bullets_outside_boxes_fails(self):
        body = text(40, 60, "•") + text(40, 90, "•")
        self.assertEqual(self.found(body, PLAIN), ["declared plain but draws bullets"])
        self.assertEqual(self.found(text(40, 60, "가"), PLAIN), [])


if __name__ == "__main__":
    unittest.main()
