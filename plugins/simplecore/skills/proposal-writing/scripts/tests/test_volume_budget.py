"""volume: printed pages against their capacity; budget: numbered pages against the cap."""
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE.parents[3] / "scripts"))

import budget  # noqa: E402
import volume  # noqa: E402
from bidkit.config import ConfigError  # noqa: E402
from bidkit.tests.support import body, project, reader, recording, slide  # noqa: E402

FIG_1200 = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"></svg>'
FIG_528 = '<svg xmlns="http://www.w3.org/2000/svg" width="528" height="300"></svg>'


def manuscript(pages: list[tuple[str, str]]) -> str:
    out = ["# 장", "", "## 작성 기록", "", "이 문단은 인쇄되지 않는다. " * 40, "", "## 인쇄 원고", ""]
    for title, text in pages:
        out += [f"### {title}", "", text, ""]
    out += ["## 검토 메모", "", "인쇄되지 않는다. " * 40]
    return "\n".join(out)


PLAN = "#### 도식 Ⅲ-1 01-1 계획\n\n| 항목 | 내용 |\n| --- | --- |\n| 주장 | " + "계획 문구 " * 80 + "|\n\n"


class VolumeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        src = self.root / "proposal"
        (src / "03-전략" / "figures").mkdir(parents=True)
        (src / "figures").mkdir()
        (src / "figures" / "wide.svg").write_text(FIG_1200, encoding="utf-8")
        (src / "figures" / "narrow.svg").write_text(FIG_528, encoding="utf-8")
        (src / "10-별첨").mkdir()
        (src / "10-별첨" / "a.md").write_text("별첨 본문 " * 500, encoding="utf-8")
        (src / "README.md").write_text("작성 안내 " * 900, encoding="utf-8")
        self.src = src
        self.deck = project(self.root, {
            "manuscript": {"dir": "proposal", "printed": "## 인쇄 원고", "page": "### ",
                           "exclude": ["README.md"], "annex": ["10-별첨/**"],
                           "figurePlan": r"^#### 도식 .*? 계획"},
            "budget": {"charsPerPage": {"figure": 100, "text": 200}, "parts": {"03-전략": 2}},
            "figures": {"sources": ["proposal/figures"], "boards": {"1200": 681, "528": 300}}})

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, pages):
        (self.src / "03-전략" / "01.md").write_text(manuscript(pages), encoding="utf-8")
        s, measured, annex, figs = volume.measure(self.deck)
        return measured, annex, volume.findings(s, measured, figs)

    def test_page_with_a_full_width_figure_is_held_to_the_figure_capacity(self):
        text = "가" * 150 + "\n\n![그림](../figures/wide.svg)\n"
        pages, _, bad = self.write([("가. 쪽", text)])
        self.assertEqual((pages[0].chars, pages[0].capacity), (150, 100))
        self.assertEqual(len(bad), 1)
        self.assertIn("figure page of 100", bad[0])

    def test_same_page_with_a_column_figure_fits_a_text_page(self):
        text = "가" * 150 + "\n\n![그림](../figures/narrow.svg)\n"
        pages, _, bad = self.write([("가. 쪽", text)])
        self.assertEqual((pages[0].capacity, bad), (200, []))

    def test_figure_plan_records_and_annex_are_not_counted(self):
        text = "가" * 150 + "\n\n" + PLAN + "![그림](../figures/narrow.svg)\n캡션: 그림 Ⅲ-1 이름\n"
        pages, annex, bad = self.write([("가. 쪽", text)])
        self.assertEqual(bad, [])
        self.assertEqual(pages[0].chars, 150 + len("캡션:그림Ⅲ-1이름"))
        self.assertGreater(annex, 0)
        # Without the plan rule the plan's own words would put the page over.
        self.deck.data["manuscript"].pop("figurePlan")
        _, _, bad = self.write([("가. 쪽", text)])
        self.assertEqual(len(bad), 1)

    def test_tolerance_lets_a_page_run_a_little_over(self):
        self.deck.data["budget"]["pageTolerance"] = 1.1
        _, _, bad = self.write([("가. 쪽", "가" * 210)])
        self.assertEqual(bad, [])
        _, _, bad = self.write([("가. 쪽", "가" * 230)])
        self.assertEqual(len(bad), 1)

    def test_part_planning_more_pages_than_the_plan_gives(self):
        _, _, bad = self.write([("가. 쪽", "짧다"), ("나. 쪽", "짧다")])
        self.assertEqual(bad, [])
        _, _, bad = self.write([("가. 쪽", "짧다"), ("나. 쪽", "짧다"), ("다. 쪽", "짧다")])
        self.assertEqual(bad, ["03-전략: the manuscript prints 3 pages, the page plan gives it 2"])

    def test_link_to_a_missing_figure_is_a_finding(self):
        _, _, bad = self.write([("가. 쪽", "짧다\n\n![그림](../figures/gone.svg)\n")])
        self.assertEqual(len(bad), 1)
        self.assertIn("gone.svg resolves to no file", bad[0])

    def test_capacity_is_required(self):
        del self.deck.data["budget"]["charsPerPage"]
        with self.assertRaises(ConfigError):
            self.write([("가. 쪽", "짧다")])


def deck_slides(bodies: int) -> list:
    out = [slide(1, "COVER-ART"), slide(2, "TOC"), slide(3, "PART-1")]
    out += [body(4 + i, 1, 1) for i in range(bodies)]
    out += [slide(4 + bodies, "ANNEX-PLAIN")]
    return out


class BudgetTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.deck = project(Path(self.tmp.name), {"budget": {"maxNumbered": 4, "clause": "제안요청서 3"}})

    def tearDown(self):
        self.tmp.cleanup()

    def run_on(self, bodies: int):
        return budget.count(reader(self.deck, recording(slides=deck_slides(bodies))), self.deck)

    def test_numbered_pages_over_the_cap(self):
        counts, bad = self.run_on(4)
        self.assertEqual((counts["front"], counts["annex"], counts["dividers"], counts["numbered"]),
                         (2, 1, 1, 5))
        self.assertEqual(bad, ["5 numbered pages, 1 over the limit of 4 (제안요청서 3)"])

    def test_cover_contents_and_annex_are_outside_the_count(self):
        counts, bad = self.run_on(3)
        self.assertEqual((counts["numbered"], bad), (4, []))

    def test_cap_is_required(self):
        del self.deck.data["budget"]
        with self.assertRaises(ConfigError):
            self.run_on(1)


if __name__ == "__main__":
    unittest.main()
