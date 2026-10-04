"""parity: what a page prints traces to the manuscript it declares."""
import json
import tempfile
import unittest
from pathlib import Path

from fixtures import project, reader, recording
from runmain import run

import parity

MD = """# 사업의 성격

본 사업은 계측 데이터를 수집한다. 수집한 데이터는 IMDG에 저장한다.

**대응 요구사항: SFR-001**

> 작성 안내: 이 줄은 원고가 아니다.

| 지표 | 목표 |
| --- | --- |
| 이벤트 판정 지연 | 필요 데이터 확보 후 1초 이내 |
| 절체 시간 | 3초 |

근거는 [발주 지침](https://www.example.org/guide)과 *운영 규정*을 따른다.
"""


def q(value) -> str:
    s = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
    return s.replace("&", "&amp;").replace('"', "&quot;")


class ParityTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "ms").mkdir()
        (self.root / "ms" / "a.md").write_text(MD, encoding="utf-8")
        self.deck = project(self.root, {"manuscript": {
            "dir": "ms", "declaration": "<!--\\s*md:", "skipLines": ["^\\*\\*대응 요구사항[::]"]}})

    def tearDown(self):
        self.tmp.cleanup()

    def page(self, body: str, decl: str = "<!-- md: a.md · Ⅲ-1 01, 도식 Ⅲ-1 01-1 -->") -> str:
        return f'{decl}<Use template="page" title="가. 사업" sub="설명이다." badge="사업 이해도">{body}</Use>'

    def verdicts(self, body: str, **kw):
        r = reader(self.deck, recording([], files={"pages/p.xml": self.page(body, **kw)}))
        p = parity.Parity(r, self.deck)
        out = []
        for _, raw, _, _, hay in p.page_files(r, set()):
            out += [(v, k, t) for v, k, t in p.verdicts(raw, hay)]
        return out

    def missing(self, body: str, **kw):
        return [(k, t) for v, k, t in self.verdicts(body, **kw) if v == "missing"]

    def test_a_line_break_stacks_values_like_a_paragraph_break(self):
        broken = '<Use template="card" head="지표" body="절체 시간\\v3초" />'
        self.assertEqual(self.missing(broken), [])
        wrong = '<Use template="card" head="지표" body="절체 시간\\v장애 발생 후 구십 분 이내 복구" />'
        self.assertEqual(self.missing(wrong), [("attribute", "장애 발생 후 구십 분 이내 복구")])

    def test_a_prose_sentence_matches_as_written_or_is_missing(self):
        body = '<Use template="prose" text="본 사업은 계측 데이터를 수집한다. 수집한 데이터는 NAS에 저장한다."/>'
        self.assertEqual(self.missing(body), [("prose", "수집한 데이터는 NAS에 저장한다")])

    def test_split_claim_arguments_are_prose_and_furniture_stays_out(self):
        body = ('<Use template="pair-card" head="수집" aLabel="수집" aText="본 사업은 계측 데이터를 수집한다."'
                ' bLabel="보존" bText="데이터를 영구 보존한다."/><Use template="figure" caption="없는 캡션 문구"/>')
        self.assertEqual(self.missing(body), [("prose", "데이터를 영구 보존한다")])

    def test_a_head_without_its_marker_and_a_row_read_side_by_side(self):
        self.assertEqual(self.missing('<Use template="section" head="1) 사업의 성격"/>'), [])
        self.assertEqual(self.missing('<Use template="section" head="가. 사업의 성격"/>'), [])
        self.assertEqual(self.missing('<Use template="section" head="1) 사업의 범위"/>'),
                         [("head", "1) 사업의 범위")])
        # Cells of two rows are not one phrase: the last cell of a row and the next row's first.
        self.assertEqual(self.missing('<Use template="marker-band" key="확보 후 1초 이내 절체 시간"/>'),
                         [("attribute", "확보 후 1초 이내 절체 시간")])
        items = q([{"term": "판정", "definition": "이벤트 판정 지연 · 필요 데이터 확보 후 1초 이내"}])
        self.assertEqual(self.missing(f'<Use template="deflist" items="{items}"/>'), [])

    def test_a_stacked_value_is_compared_line_by_line(self):
        body = r'<Use template="keyrow" label="절체 시간" value="본 사업은 계측 데이터를 수집한다.\n데이터를 영구 보존한다."/>'
        self.assertEqual(self.missing(body), [("prose", "데이터를 영구 보존한다")])
        # Lines with no full stop between them are still two values.
        body = r'<Use template="keyrow" label="저장" value="수집한 데이터는 IMDG에 저장한다\n이벤트 판정 지연"/>'
        self.assertEqual(self.missing(body), [])

    def test_links_emphasis_page_numbers_and_skipped_lines(self):
        self.assertEqual(self.missing('<Use template="prose" text="근거는 발주 지침 (example.org/guide)과 운영 규정을 따른다."/>'), [])
        rows = q([["구분", "쪽"], ["절체 시간", "22~205"]])
        self.assertEqual(self.missing(f'<Use template="table" rows="{rows}"/>'), [])
        self.assertEqual(self.missing('<Use template="prose" text="작성 안내: 이 줄은 원고가 아니다."/>'),
                         [("prose", "작성 안내: 이 줄은 원고가 아니다")])
        self.assertEqual(self.missing('<Use template="notice" label="요구" text="대응 요구사항: SFR-001"/>'),
                         [("prose", "대응 요구사항: SFR-001")])

    def test_a_short_attribute_may_reorder_words_only_when_declared(self):
        body = '<Use template="marker-band" no="1" head="절체" sub="x" keyLabel="k" key="3초 절체 시간"/>'
        self.assertEqual(self.missing(body), [("attribute", "3초 절체 시간")])
        self.deck.data["checks"] = {"parity": {"accentLen": 40}}
        self.assertEqual(self.missing(body), [])

    def test_declarations_resolve_in_the_manuscript_then_the_project(self):
        (self.root / "docs").mkdir()
        (self.root / "docs" / "f.md").write_text("간지 문구를 적는다.\n", encoding="utf-8")
        body = '<Use template="prose" text="간지 문구를 적는다."/>'
        self.assertEqual(self.missing(body, decl="<!-- md: docs/f.md -->"), [])
        rec = recording([], files={"pages/p.xml": self.page(body, decl="<!-- md: gone.md -->")})
        code, out = run(parity, self.deck, rec)
        self.assertEqual(code, 1)
        self.assertIn("does not exist: gone.md", out)

    def test_an_undeclared_page_warns_and_a_file_without_a_body_page_is_not_compared(self):
        rec = recording([], files={"pages/p.xml": self.page('<Use template="prose" text="아무 말이다."/>', decl=""),
                                   "pages/toc.xml": '<Use template="toc" title="차례"/><Use template="prose" text="없는 말이다."/>'})
        code, out = run(parity, self.deck, rec)
        self.assertEqual(code, 0)
        self.assertIn("⚠ p.xml: no manuscript declaration", out)
        self.assertNotIn("toc.xml", out)

    def test_furniture_is_compared_with_its_own_source_when_declared(self):
        (self.root / "f.md").write_text("| 쪽 | 표제 |\n| --- | --- |\n| Ⅲ-1 01 | 사업의 배경 |\n", encoding="utf-8")
        self.deck.data["manuscript"]["furnitureSource"] = "f.md"
        body = '<Use template="figure" caption="사업의 배경"/><Use template="figure" caption="없는 캡션 문구"/>'
        got = self.missing(body)
        self.assertIn(("furniture", "없는 캡션 문구"), got)
        self.assertNotIn(("furniture", "사업의 배경"), got)


if __name__ == "__main__":
    unittest.main()
