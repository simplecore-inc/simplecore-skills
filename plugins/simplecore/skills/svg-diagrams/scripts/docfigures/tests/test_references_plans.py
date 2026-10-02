"""The figure reference check and the figure-plan check."""
import unittest

from helpers import Project, svg, text

import figplans  # noqa: E402
import verify  # noqa: E402

REFS = {
    "manuscripts": ["doc/*.md"],
    "caption": r"\s*\n\s*캡션:\s*([^\n]+)",
    "placements": [{"glob": "deck/pages/*.xml",
                    "pattern": r'src="assets/figures/([^"]+)\.svg"',
                    "copies": "deck/assets/figures"}],
}


class References(unittest.TestCase):
    def setUp(self):
        self.p = Project(references=REFS)
        self.p.write("figures/a.svg", svg(text(40, 60, "a")))
        self.p.write("doc/one.md", "![그림 1 흐름](../figures/a.svg)\n\n캡션: 그림 1 흐름\n")
        self.p.write("deck/pages/p.xml", '<Use template="figure" src="assets/figures/a.svg"/>')
        self.p.write("deck/assets/figures/a.svg", svg(text(40, 60, "a")))

    def tearDown(self):
        self.p.close()

    def problems(self):
        return verify.references(self.p.cfg())[0]

    def test_consistent_set_passes(self):
        self.assertEqual(self.problems(), [])

    def test_placement_with_no_svg_fails(self):
        self.p.write("deck/pages/q.xml", '<Use template="figure" src="assets/figures/b.svg"/>')
        self.assertEqual(self.problems(), ["no figure for deck/pages/q.xml -> b"])

    def test_stale_copy_fails(self):
        self.p.write("deck/assets/figures/a.svg", svg(text(40, 60, "old")))
        self.assertEqual(len(self.problems()), 1)
        self.assertIn("stale copy deck/assets/figures/a.svg", self.problems()[0])

    def test_caption_drift_and_unplaced_file_fail(self):
        self.p.write("doc/one.md", "![그림 1 흐름](../figures/a.svg)\n\n캡션: 그림 1 구성\n")
        self.p.write("figures/z.svg", svg(text(40, 60, "z")))
        problems = self.problems()
        self.assertTrue(any(p.startswith("caption differs") for p in problems), problems)
        self.assertIn("placed nowhere: figures/z.svg", problems)


PLANS = {
    "manuscripts": ["doc/*.md"],
    "blockStart": r"^>\s*쪽\s*\d+\b",
    "row": r"^\|\s*표시 문구\s*\|(.*)\|\s*$",
    "caption": r"^캡션:\s*(?P<caption>도식\s*(?P<page>\d+|별첨\d+)-(?P<index>\d+)\b.*)$",
    "name": "도식-{page}-{index}",
    "pagePad": 3,
    "embed": "![{caption}](../figures/{name}.svg)",
}

PAGE = """> 쪽 12

| 항목 | 내용 |
| 표시 문구 | {cell} |

![도식 12-1 수집 흐름](../figures/도식-012-1.svg)

캡션: 도식 12-1 수집 흐름
"""


class Plans(unittest.TestCase):
    def setUp(self):
        self.p = Project(plans=PLANS)

    def tearDown(self):
        self.p.close()

    def run_with(self, cell, printed):
        self.p.write("doc/p.md", PAGE.format(cell=cell))
        self.p.write("figures/도식-012-1.svg",
                     svg("".join(text(40, 40 + 30 * i, s) for i, s in enumerate(printed))))
        return figplans.check(self.p.cfg())

    def test_plan_matching_the_drawing_passes(self):
        self.assertEqual(self.run_with("수집 · 「저장 · 보관」", ["수집", "저장 · 보관"]), ([], 1))

    def test_drift_in_either_direction_fails(self):
        problems, _n = self.run_with("수집 · 검증", ["수집", "삭제"])
        self.assertEqual(len(problems), 2, problems)
        self.assertIn("「삭제」", problems[0])
        self.assertIn("「검증」", problems[1])

    def test_dash_without_a_named_meaning_fails(self):
        self.p.write("doc/p.md", PAGE.format(cell="수집"))
        self.p.write("figures/도식-012-1.svg", svg(
            text(40, 40, "수집") + '<line x1="40" y1="60" x2="300" y2="60" stroke="#000" '
            'stroke-width="1.4" stroke-dasharray="5 4"/>'))
        problems, _n = figplans.check(self.p.cfg())
        self.assertEqual(len(problems), 1, problems)
        self.assertIn("without naming its meaning", problems[0])


if __name__ == "__main__":
    unittest.main()
