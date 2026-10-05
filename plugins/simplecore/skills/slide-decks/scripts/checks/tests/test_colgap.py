"""colgap: a column that stops early or opens a hole beside its neighbour."""
import unittest

import colgap

HEAD = "slide 7  master=SLIDE-BODY-1  1122×793  gen 1  diag 0\n"


def tree(left: list, right: list, wide: list = ()) -> str:
    """A two-column page; blocks as (top, height) drawn as Text in each column."""
    lines = [HEAD, "node#1  Layer  [0,0 1122×793]\n",
             "└ node#2  VStack  [48,175 1026×554]  fill 554/554 slack 0\n",
             "  ├ node#3  HStack  [48,175 1026×520]  fill 1026/1026 slack 0 gap 22\n",
             "  │ ├ node#4  VStack  [48,175 335×520]  fill 520/520 slack 0\n"]
    n = 10
    for top, h in left:
        lines.append(f"  │ │ ├ node#{n}  Text  [48,{top} 335×{h}]  \"left\"\n")
        n += 1
    lines.append("  │ └ node#5  VStack  [405,175 669×520]  fill 520/520 slack 0\n")
    for top, h in right:
        lines.append(f"  │   ├ node#{n}  VStack  [405,{top} 669×{h}]  fill {h}/{h} slack 0\n")
        lines.append(f"  │   │ └ node#{n + 1}  Image  [405,{top} 669×{h}]\n")
        n += 2
    for top, h in wide:
        lines.append(f"  └ node#{n}  Text  [48,{top} 1026×{h}]  \"wide\"\n")
        n += 1
    return "".join(lines)


def gaps(text):
    _, pw, ph, root = colgap.parse(text)
    return colgap.gaps(root, pw, ph, 0.11, 0.2)


class ColGapTests(unittest.TestCase):
    def test_columns_ending_together_pass(self):
        self.assertEqual(gaps(tree([(175, 200), (395, 300)], [(175, 250), (440, 255)])), [])

    def test_a_column_ending_early_is_reported(self):
        found = gaps(tree([(175, 520)], [(175, 250)]))
        self.assertEqual([(k, x) for k, x, _, _ in found], [("bottom", 405)])
        self.assertAlmostEqual(found[0][2], 270)

    def test_a_hole_inside_a_column_is_reported(self):
        found = gaps(tree([(175, 520)], [(175, 150), (450, 245)]))
        self.assertEqual([(k, x) for k, x, _, _ in found], [("hole", 405)])

    def test_ordinary_section_spacing_is_not_a_hole(self):
        self.assertEqual(gaps(tree([(175, 520)], [(175, 150), (365, 150), (555, 140)])), [])

    def test_a_full_width_block_under_the_columns_does_not_hide_a_short_column(self):
        found = gaps(tree([(175, 480)], [(175, 200)], wide=[(700, 30)]))
        self.assertEqual([k for k, _, _, _ in found], ["bottom"])

    def test_cards_on_two_lines_of_a_wrapping_row_are_not_columns(self):
        text = HEAD + ("node#1  Layer  [0,0 1122×793]\n"
                       "└ node#3  HStack  [48,100 1026×600]  fill 1026/1026 slack 0\n"
                       "  ├ node#4  Text  [48,100 330×300]  \"tall card\"\n"
                       "  ├ node#5  Text  [400,100 330×300]  \"tall card\"\n"
                       "  └ node#6  Text  [48,420 330×80]  \"short card on the next line\"\n")
        self.assertEqual(gaps(text), [])

    def test_a_narrow_lane_is_not_a_column(self):
        text = HEAD + ("node#1  Layer  [0,0 1122×793]\n"
                       "└ node#3  HStack  [48,175 1026×520]  fill 1026/1026 slack 0\n"
                       "  ├ node#4  Text  [48,175 100×20]  \"label\"\n"
                       "  └ node#5  Text  [158,175 916×520]  \"text\"\n")
        self.assertEqual(gaps(text), [])


if __name__ == "__main__":
    unittest.main()
