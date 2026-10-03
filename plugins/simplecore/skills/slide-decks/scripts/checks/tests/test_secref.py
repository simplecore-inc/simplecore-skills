"""secref: a page-id citation lands on the page that carries what it cites."""
import json
import tempfile
import unittest
from pathlib import Path

from fixtures import page, project, reader, recording, text
from runmain import run

import secref


def q(value) -> str:
    s = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
    return s.replace("&", "&amp;").replace('"', "&quot;")


class SecRefTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "baselines").mkdir()
        self.deck = project(self.root, {"checks": {"baselines": "baselines"},
                                        "requirements": {"id": {"prefix": "[A-Z]{3}[-_]", "digits": 3}}})
        self.pages = [page(1, text("처리량 30만 건/초를 실측한다."), head={"title": "가. 처리 성능"}),
                      page(2, text("절체는 3초 이내다. PER-002를 판정한다."), head={"title": "나. 절체와 복구"})]

    def tearDown(self):
        self.tmp.cleanup()

    def rec(self, src: str) -> dict:
        return recording(self.pages, files={"pages/a.xml": src})

    def found(self, src: str):
        r = reader(self.deck, self.rec(src))
        rules, order = secref.Rules(self.deck, r), secref.chapters(r)
        bad, pending = secref.anchored_refs(r, rules, order)
        return [(c, why) for _, c, why, _ in bad], pending, [(c, n) for _, c, n, _ in secref.named_refs(r, rules, order)]

    def prose(self, s: str) -> str:
        return f'<Use template="prose" text="{q(s)}"/>'

    def test_an_anchor_the_cited_page_does_not_print(self):
        self.assertEqual(self.found(self.prose("절체 3초(Ⅲ-1 01)를 지킨다."))[0], [("Ⅲ-1 01", "not on page 1")])
        self.assertEqual(self.found(self.prose("절체 3초(Ⅲ-1 02)를 지킨다."))[0], [])
        self.assertEqual(self.found(self.prose("PER-002 판정(Ⅲ-1 02)"))[0], [])
        self.assertEqual(self.found(self.prose("PER-002 판정(Ⅲ-1 01)"))[0], [("Ⅲ-1 01", "not on page 1")])

    def test_a_folio_beside_the_id_is_not_an_anchor(self):
        self.pages = [page(i, text("처리 내용을 적는다."), head={"title": "가. 쪽"}) for i in range(1, 13)]
        self.assertEqual(self.found(self.prose("10~12(Ⅲ-1 10~12)"))[0], [])
        self.assertEqual(self.found(self.prose("12(Ⅲ-1 10)"))[0],
                         [("Ⅲ-1 10", "printed beside folio 12, the page is 10")])
        self.assertEqual(self.found(self.prose("3초 10(Ⅲ-1 10)"))[0], [("Ⅲ-1 10", "not on page 10")])

    def test_the_anchor_window_stops_at_the_string_and_at_the_previous_citation(self):
        # The left cell's 「30만 건」 does not prove the right cell's citation.
        rows = q([["구분", "쪽"], ["처리량 30만 건/초", "상세 Ⅲ-1 02"]])
        self.assertEqual(self.found(f'<Use template="table" rows="{rows}"/>')[0], [])
        self.assertEqual(self.found(self.prose("30만 건/초(Ⅲ-1 01)와 Ⅲ-1 02"))[0], [])
        # Another argument of the same tag is another string.
        self.assertEqual(self.found('<Use template="card" head="30만 건" body="Ⅲ-1 02 참조"/>')[0], [])

    def test_a_chapter_with_no_typeset_page_is_pending(self):
        bad, pending, _ = self.found(self.prose("절체 3초(Ⅴ-1 03)를 지킨다."))
        self.assertEqual((bad, pending), ([], {"Ⅴ-1": {"a.xml"}}))
        code, out = run(secref, self.deck, self.rec(self.prose("절체 3초(Ⅴ-1 03)")))
        self.assertEqual(code, 0)
        self.assertIn("ℹ pending", out)

    def test_no_such_page_and_the_whole_chapter(self):
        self.assertEqual(self.found(self.prose("3초(Ⅲ-1 05)"))[0], [("Ⅲ-1 05", "no such page")])
        self.assertEqual(self.found(self.prose("30만 건(Ⅲ-1 00)"))[0], [])

    def test_a_named_citation_proves_itself(self):
        self.assertEqual(self.found(self.prose("Ⅲ-1 02 절체와 복구"))[2], [])
        self.assertEqual(self.found(self.prose("Ⅲ-1 02 외부 장치 요청 처리"))[2],
                         [("Ⅲ-1 02", "외부 장치 요청 처리")])
        self.assertEqual(self.found(self.prose("Ⅲ-1 02 와 같다"))[2], [])

    def test_a_comment_is_not_a_citation_and_a_legacy_list_stays_retired(self):
        self.assertEqual(self.found("<!-- md: x.md · 3초 Ⅲ-1 01 -->")[0], [])
        src = self.prose("절체 3초(Ⅲ-1 01)를 지킨다.")
        self.assertEqual(run(secref, self.deck, self.rec(src))[0], 1)
        path = self.root / "baselines" / "secref.json"
        path.write_text(json.dumps(["a.xml\tⅢ-1 01\t3초"], ensure_ascii=False), encoding="utf-8")
        self.assertEqual(run(secref, self.deck, self.rec(src))[0], 0)
        path.write_text(json.dumps({"a.xml\tⅢ-1 01\t3초": ""}, ensure_ascii=False), encoding="utf-8")
        self.assertEqual(run(secref, self.deck, self.rec(src))[0], 1)


if __name__ == "__main__":
    unittest.main()
