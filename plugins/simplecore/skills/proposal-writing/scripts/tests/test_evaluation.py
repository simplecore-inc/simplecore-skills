"""evaluation: scoring table, lookup rows, the pages they cite and the running heads."""
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE.parents[3] / "scripts"))

import evaluation  # noqa: E402
from bidkit.config import ConfigError  # noqa: E402
from bidkit.tests.support import body, project, reader, recording, slide  # noqa: E402

SCORING = """# 붙임

## 붙임#5 비계량 지표 세부 배점표

| 평가항목 | 배점 | 기준 | 평가요소 |
| --- | --- | --- | --- |
| 1.1 사업 이해도 | 10 | 상 | - 배경 이해<br>- 범위 이해 |
| 1.2 추진전략 | 10 | 상 | - 전략 |
| 소계 | 20 | | |
"""

LOOKUP = """# 조견표

## 인쇄 원고

| 평가항목 | 평가요소 | 관련 페이지 |
| --- | --- | --- |
| 1.1 사업 이해도 | 배경 이해 | {a} |
|  | 범위 이해 | {b} |
| 1.2 추진전략 | 전략 | {c} |
"""

DIGEST = "#### PER-001 처리량\n#### PER-002 지연\n#### PER-003 유실\n"


def page(n: int, chapter: int, item: str, texts=()) -> dict:
    s = body(n, 3, chapter, texts=texts)
    s["blocks"][0]["children"][0]["attrs"]["badge"] = item
    return s


def deck_slides() -> list:
    # Folios: PART-3 is 1, Ⅲ-1 01..02 are 2..3, Ⅲ-2 01 is 4.
    return [slide(1, "COVER-ART"), slide(2, "PART-3"),
            page(3, 1, "1.1 사업 이해도", ("PER-001~002 를 충족한다",)), page(4, 1, "1.1 사업 이해도"),
            page(5, 2, "1.2 추진전략", ("PER-003",))]


class Fixture(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "docs").mkdir()
        (self.root / "docs" / "scoring.md").write_text(SCORING, encoding="utf-8")
        (self.root / "docs" / "req.md").write_text(DIGEST, encoding="utf-8")
        self.deck = project(self.root, {
            "requirements": {"source": "docs/req.md", "id": {"prefix": "[A-Z]{3}-", "digits": 3}},
            "evaluation": {
                "scoring": {"file": "docs/scoring.md", "section": "## 붙임#5 비계량 지표 세부 배점표",
                            "columns": {"item": "평가항목", "element": "평가요소"}, "split": "<br>",
                            "itemPattern": r"^\d\.\d"},
                "lookup": {"file": "docs/lookup.md", "section": "## 인쇄 원고",
                           "columns": {"item": "평가항목", "element": "평가요소", "pages": "관련 페이지"}},
                "noneLabel": "해당 없음"}})

    def tearDown(self):
        self.tmp.cleanup()

    def run_on(self, lookup: str, slides=None, deck=True):
        (self.root / "docs" / "lookup.md").write_text(lookup, encoding="utf-8")
        r = reader(self.deck, recording(slides=slides or deck_slides())) if deck else None
        return evaluation.check(self.deck, r)

    def good(self, **kw):
        cells = {"a": "2(Ⅲ-1 01)", "b": "2~3(Ⅲ-1 01~02)", "c": "4(Ⅲ-2 01)"}
        cells.update(kw)
        return LOOKUP.format(**cells)


class EvaluationTests(Fixture):
    def test_complete_lookup_is_quiet(self):
        counts, bad, pending = self.run_on(self.good())
        self.assertEqual((counts["scoring"], counts["rows"], bad, pending), (3, 3, [], []))

    def test_missing_and_extra_rows(self):
        text = self.good().replace("|  | 범위 이해 |", "|  | 위험 이해 |")
        _, bad, _ = self.run_on(text, deck=False)
        self.assertEqual(bad, ["no row for 「1.1 사업 이해도 · 범위 이해」",
                               "a row for 「1.1 사업 이해도 · 위험 이해」, which the scoring table does not carry"])

    def test_rows_out_of_scoring_order(self):
        lines = self.good().splitlines()
        a, b = lines.index(next(l for l in lines if "배경 이해" in l)), lines.index(next(l for l in lines if "범위 이해" in l))
        lines[a], lines[b] = "| 1.1 사업 이해도 | 범위 이해 | 2~3(Ⅲ-1 01~02) |", "|  | 배경 이해 | 2(Ⅲ-1 01) |"
        _, bad, _ = self.run_on("\n".join(lines), deck=False)
        self.assertEqual(len(bad), 1)
        self.assertIn("row 1 is out of the scoring order", bad[0])

    def test_folio_that_moved_and_page_pending_and_page_that_does_not_exist(self):
        _, bad, pending = self.run_on(self.good(b="2~4(Ⅲ-1 01~02)", c="4(Ⅲ-2 01), 9(Ⅲ-3 01), 5(Ⅲ-2 02)"))
        self.assertEqual(pending, ["Ⅲ-3 01"])
        self.assertEqual(len(bad), 2)
        self.assertIn("Ⅲ-1 02 prints as 3, the cell says 4", bad[0])
        self.assertIn("Ⅲ-2 02 is not a page of the deck", bad[1])

    def test_head_naming_an_unknown_item_or_a_page_its_row_does_not_cite(self):
        slides = deck_slides()
        slides[3] = page(4, 1, "1.9 없는 항목")
        _, bad, _ = self.run_on(self.good(), slides)
        self.assertEqual(bad, ["Ⅲ-1 02: the head names 「1.9 없는 항목」, which the scoring table does not carry"])
        slides[3] = page(4, 1, "1.2 추진전략")
        _, bad, _ = self.run_on(self.good(), slides)
        self.assertEqual(bad, ["Ⅲ-1 02: the head names 「1.2 추진전략」, and that item's row does not cite the page"])

    def test_folio_only_cell_is_compared_with_the_heads(self):
        _, bad, _ = self.run_on(self.good(a="2~3", b="2~3", c="4"))
        self.assertEqual(bad, [])
        _, bad, _ = self.run_on(self.good(a="2~3", b="2", c="4"))
        self.assertEqual(len(bad), 1)
        self.assertIn("names folios [2], the pages whose head names the item print as [2, 3]", bad[0])

    def test_deck_printed_lookup_table(self):
        self.deck.data["evaluation"]["lookup"] = {"deck": True, "columns": {
            "item": "평가항목", "element": "평가요소", "pages": "관련 페이지"}}
        rows = [["평가항목", "평가요소", "관련 페이지"], ["1.1 사업 이해도", "배경 이해", "2(Ⅲ-1 01)"],
                ["", "범위 이해", "2~3(Ⅲ-1 01~02)"], ["1.2 추진전략", "전략", "5(Ⅲ-2 01)"]]
        slides = deck_slides()
        slides.insert(1, slide(9, "PLAIN", tables=[rows]))
        _, bad, _ = self.run_on("", slides)
        self.assertEqual(len(bad), 1)
        self.assertIn("Ⅲ-2 01 prints as 4, the cell says 5", bad[0])


REQS = """| ID | 요구사항명 | 쪽 |
| --- | --- | --- |
| PER-001 | 처리량 | Ⅲ-1 01 |
| PER-002 | {name} | Ⅲ-1 01 |
| PER-003 | 유실 | {page} |
"""


class RequirementLookupTests(Fixture):
    def req(self, name="지연", page="Ⅲ-2 01", extra=""):
        (self.root / "docs" / "reqs.md").write_text(REQS.format(name=name, page=page) + extra, encoding="utf-8")
        self.deck.data["evaluation"]["requirements"] = {
            "file": "docs/reqs.md", "complete": True,
            "columns": {"id": "ID", "name": "요구사항명", "pages": "쪽"}}
        return self.run_on(self.good())

    def test_requirement_rows_quiet_with_a_range_on_the_page(self):
        counts, bad, _ = self.req()
        self.assertEqual((counts["requirements"], bad), (3, []))

    def test_requirement_rows_defects(self):
        _, bad, _ = self.req(name="지연시간", page="Ⅲ-1 02", extra="| PER-001 | 처리량 | Ⅲ-1 01 |\n| PER-009 | 없음 | Ⅲ-1 01 |\n")
        self.assertEqual(len(bad), 4)
        self.assertIn("PER-002 is named 「지연시간」, the digest heads it 「지연」", bad[0])
        self.assertIn("PER-003 cites Ⅲ-1 02, which does not print the id", bad[1])
        self.assertIn("PER-001 has a second row", bad[2])
        self.assertIn("PER-009 is not an issued id", bad[3])

    def test_incomplete_requirement_lookup(self):
        (self.root / "docs" / "reqs.md").write_text("| ID | 쪽 |\n| --- | --- |\n| PER-001 | Ⅲ-1 01 |\n",
                                                   encoding="utf-8")
        self.deck.data["evaluation"]["requirements"] = {"file": "docs/reqs.md", "complete": True,
                                                        "columns": {"id": "ID", "pages": "쪽"}}
        _, bad, _ = self.run_on(self.good())
        self.assertEqual(bad, ["docs/reqs.md: PER-002 is issued and has no row",
                               "docs/reqs.md: PER-003 is issued and has no row"])

    def test_scoring_table_is_required(self):
        del self.deck.data["evaluation"]["scoring"]
        with self.assertRaises(ConfigError):
            self.run_on(self.good())


if __name__ == "__main__":
    unittest.main()
