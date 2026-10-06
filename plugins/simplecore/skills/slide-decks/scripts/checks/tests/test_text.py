"""period, dangle, reqbadge, typefloor, figtext and carry: what the printed words say."""
import json
import tempfile
import unittest
from pathlib import Path

from fixtures import page, project, reader, recording, table, text, use

import carry
import runmain
import dangle
import figtext
import period
import reqbadge
import typefloor


def q(value) -> str:
    """An attribute value as a source writes it."""
    s = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
    return s.replace("&", "&amp;").replace('"', "&quot;")


class Base(unittest.TestCase):
    extra: dict = {}

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "baselines").mkdir()
        self.deck = project(self.root, {"checks": {"baselines": "baselines"}, **self.extra})

    def tearDown(self):
        self.tmp.cleanup()

    def read(self, slides=(), **kw):
        return reader(self.deck, recording(list(slides), **kw))


class PeriodTests(Base):
    def found(self, src, slides=()):
        return [(slot, why) for _, slot, _, why in period.find(self.read(slides, files={"pages/a.xml": src}), self.deck)]

    def test_a_sentence_without_its_stop_and_a_name_with_one(self):
        self.assertEqual(self.found('<Use template="prose" text="값을 확인한다"/>'),
                         [("prose.text", "a sentence without its full stop")])
        self.assertEqual(self.found('<Use template="prose" text="값을 확인한다."/>'), [])
        self.assertEqual(self.found('<Use template="keyrow" label="처리량" value="30만 건/초."/>'),
                         [("keyrow.value", "a full stop on a string that is not a sentence")])

    def test_trailing_references_are_set_aside(self):
        ok = '<Use template="prose" text="인력을 배치한다(Ⅵ-2 01) [증빙 8]."/>'
        self.assertEqual(self.found(ok), [])
        self.assertEqual(len(self.found(ok.replace("한다(", "할 인력(").replace("배치", ""))), 1)

    def test_item_lists_and_names_and_cells(self):
        defs = q([{"term": "용어.", "definition": "뜻을 정한다"}])
        self.assertEqual(self.found(f'<Use template="deflist" items="{defs}"/>'),
                         [("deflist.items.definition", "a sentence without its full stop")])
        slides = [page(1, *table("tb", ["구분", "내용"], ["가", "기록을 남긴다"]))]
        self.assertEqual(self.found("<Fragment/>", slides), [("table cell", "a sentence without its full stop")])


class DangleTests(Base):
    def found(self, src):
        return [text for _, _, text in dangle.find(self.read(files={"pages/a.xml": src}), self.deck)]

    def test_a_first_half_may_hand_the_predicate_to_the_second(self):
        self.assertEqual(self.found('<Use template="pair-card" aText="책임자와 담당자를 지정하고" '
                                    'bText="보안계획과 교육계획을 제출한다"/>'), [])

    def test_the_row_a_reader_finishes_on_may_not_dangle(self):
        self.assertEqual(self.found('<Use template="pair-card" aText="잔량을 표시한다." '
                                    'bText="자동 통보 대상에서 제외하되"/>'), ["자동 통보 대상에서 제외하되"])
        self.assertEqual(len(self.found('<Use template="proof-line" head="h" body="본문." tail="출처를 유지하며"/>')), 1)
        self.assertEqual(self.found('<Use template="proof-line" head="h" body="본문." tail="포함 여부를 명시한다"/>'), [])

    def test_each_item_is_a_claim_of_its_own(self):
        rows = q([{"a": "a", "b": "앞 절을 적고", "c": "뒤 절로 닫는다"},
                  {"a": "b", "b": "기록을 대조하며"}])
        self.assertEqual(self.found(f'<Use template="value-chain" items="{rows}"/>'), ["기록을 대조하며"])

    def test_the_explicit_break_a_short_label_and_a_noun_in_go(self):
        self.assertEqual(self.found('<Use template="keyrow" label="x" value="앞 절을 적고\\n뒤 절로 닫는다"/>'), [])
        self.assertEqual(len(self.found('<Use template="keyrow" label="x" value="뒤 절로 닫는다\\n앞 절을 적고"/>')), 1)
        self.assertEqual(self.found('<Use template="keyrow" label="x" value="적용하고"/>'), [])
        self.assertEqual(self.found('<Use template="keyrow" label="x" value="발주 권고 · 안전재고"/>'), [])


class ReqBadgeTests(Base):
    extra = {"requirements": {"source": "req.md", "id": {"prefix": "[A-Z]{3}[-_]", "digits": 3}}}

    def setUp(self):
        super().setUp()
        (self.root / "req.md").write_text("".join(f"#### {i} 이름\n" for i in
                                                   ("SFR-004", "SFR-005", "SER-001", "SER-002", "PSR-001", "PSR-002")),
                                          encoding="utf-8")

    def found(self, reqs, *blocks):
        r = self.read([page(1, *blocks, head={"refTitle": reqs})])
        return [w for _, w in reqbadge.find(r, self.deck)[1]]

    def test_shorthand_and_ranges_expand(self):
        expand = reqbadge.Expander(self.deck)
        self.assertEqual(expand("SFR-004 · 005"), ["SFR-004", "SFR-005"])
        self.assertEqual(expand("SER-001~002 · PSR-001"), ["SER-001", "SER-002", "PSR-001"])
        self.assertEqual(expand("제안요청서 요구사항 61건 전건"), [])
        self.assertEqual(expand("AES-256 · SFR-004"), ["SFR-004"])

    def test_ids_nest_in_the_head_and_the_head_in_the_tender(self):
        self.assertEqual(self.found("SFR-004 · 005", use("section", {"head": "h", "code": "SFR-005"})), [])
        self.assertEqual(len(self.found("SFR-004", use("section", {"head": "h", "code": "SER-001"}))), 1)
        self.assertEqual(len(self.found("SFR-004 · SFR-009")), 1)
        chips = use("req-chips", {"items": json.dumps([{"ids": "PSR-002"}])})
        self.assertEqual(len(self.found("SFR-004", chips)), 1)

    def test_region_and_bare_id_rules_run_only_when_declared(self):
        bare = use("section", {"head": "h"})
        self.assertEqual(self.found("SFR-004", bare), [])
        self.deck.data["checks"]["reqbadge"] = {"regions": True}
        self.assertEqual(len(self.found("SFR-004", bare)), 1)
        self.assertEqual(self.found("SFR-004", use("card")), [])       # no region: the head badges it
        self.deck.data["checks"]["reqbadge"] = {"bareIds": True}
        r = self.read([page(1, head={"refTitle": "SFR-004"})],
                      files={"pages/a.xml": '<Use template="prose" text="SFR-004 를 맨 글자로 든다."/>'})
        self.assertEqual(len([w for _, w in reqbadge.find(r, self.deck)[1] if "bare" in w]), 1)

    def test_manuscript_notation(self):
        line = reqbadge.re.compile(r"^>\s*대응 요구사항[::]\s*(.*)$")
        expand = reqbadge.Expander(self.deck)
        md = ("# 절\n\n## 본문\n\n> 대응 요구사항: SER-001~002\n\n본문.\n\n### 인증과 권한\n\n> 대응 요구사항: SER-001\n\n"
              "### 암호화\n\n> 대응 요구사항: PSR-001\n\n## 증빙\n")
        file_ids, subs = reqbadge.manuscript_ids(md, line, expand)
        self.assertEqual(file_ids, {"SER-001", "SER-002"})
        self.assertEqual(subs, [("인증과 권한", {"SER-001"}), ("암호화", {"PSR-001"})])
        found = reqbadge.manuscript_findings("x.md", md, {"SER-002"}, line, expand)
        self.assertEqual(len(found), 2)
        self.assertIn("no page drawn from this file badges SER-001", found[0])
        self.assertIn("PSR-001 is not on the file's requirement line", found[1])
        self.assertEqual(len(reqbadge.manuscript_findings("x.md", md, {"SER-001", "SER-002"}, line, expand)), 1)


SPACE = """slide 1  793×1122
node#1  VStack  [0,0 793×1122]  pad 0  inner [0,0 793×1122]  gap 0  children 3  extent 0  slack 0
  node#2  Text  [56,100 681×20]  "본문"  13.3462px×1.3  box-lines 1
  node#3  Text  [56,130 681×20]  "작은 글"  10px×1.3  box-lines 1
  node#4  Text  [56,160 681×20]  "SFR-004"  9px×1  box-lines 1
  node#5  Text  [56,190 681×20]  "쪽 끝"  10.63px×1  box-lines 1
"""


class TypeFloorTests(Base):
    extra = {"type": {"floor": 8, "codeLabel": None}}

    def found(self, code_label=None):
        self.deck.data["type"]["codeLabel"] = code_label
        slide = page(1, use("prose", {}, text("본문", key="node#2")), use("prose", {}, text("작은 글", key="node#3")),
                     use("chip", {}, text("SFR-004", key="node#4")), use("prose", {}, text("쪽 끝", key="node#5")))
        return [(k, round(pt, 2)) for _, k, _, pt, _, _ in
                typefloor.find(self.read([slide], spaces={1: SPACE}), self.deck)[1]]

    def test_the_floor_the_code_label_floor_and_the_rounding_tolerance(self):
        self.assertEqual(self.found(), [("node#3", 7.5)])            # the chip is not measured
        self.assertEqual(self.found(7), [("node#3", 7.5), ("node#4", 6.75)])
        self.assertEqual(self.found(6), [("node#3", 7.5)])
        # 10.63px is 7.97pt, within the rounding tolerance of 8pt; without it, it fails.
        self.deck.data["checks"]["typefloor"] = {"tolerance": 0}
        self.assertEqual(self.found(), [("node#3", 7.5), ("node#5", 7.97)])


class FigTextTests(Base):
    ROWS = ["기준시각까지 조회하고 검증한다", "마지막 정상 기준일을 표시한다", "원천 키와 변경 기준시각을 남긴다"]

    def svg(self, labels):
        (self.root / "deck" / "f.svg").write_text(
            "<svg>" + "".join(f"<text x='0'>{lab}</text>" for lab in labels) + "</svg>", encoding="utf-8")

    def found(self, labels, cells, figure=True):
        self.svg(labels)
        blocks = [use("figure", {"src": "f.svg"})] if figure else []
        slides = [page(1, *blocks), page(2, *table("tb", *[[c] for c in cells]))]
        r = self.read(slides, sources={1: "pages/a.xml", 2: "pages/a.xml"})
        return figtext.find(r, self.deck)

    def test_three_restated_rows_are_a_redrawn_block_and_two_are_not(self):
        self.assertEqual(len(self.found(self.ROWS, self.ROWS)[1]), 1)       # the next page restates it
        self.assertEqual(self.found(self.ROWS[:2], self.ROWS[:2])[1], [])

    def test_short_names_separators_and_pages_without_a_figure(self):
        names = ["Workbench", "시뮬레이터", "수집 에이전트", "중앙 수신"]
        self.assertEqual(self.found(names, names)[1], [])
        spaced = [r.replace(" ", " · ") for r in self.ROWS]
        self.assertEqual(len(self.found(self.ROWS, spaced)[1]), 1)
        self.assertEqual(self.found(self.ROWS, self.ROWS, figure=False)[1], [])

    def test_a_placed_figure_that_does_not_exist_is_reported(self):
        r = self.read([page(1, use("figure", {"src": "gone.svg"}))])
        self.assertEqual(len(figtext.find(r, self.deck)[2]), 1)


class CarryTests(Base):
    extra = {"manuscript": {"dir": "ms", "declaration": "<!--\\s*md:", "printed": "## 인쇄 원고",
                            "page": "### ", "caption": "^캡션: "}}

    MD = ("# 절\n\n## 작성 기록\n\n기록은 인쇄하지 않는 문장이다.\n\n## 인쇄 원고\n\n### Ⅲ-1 01 쪽\n\n"
          "첫째 문장은 계측 자료를 수집한다. 둘째 문장은 자료를 정규화한다.\n\n"
          "- 셋째 항목은 저장 경로를 분리한다\n- 넷째 항목은 재전송을 처리한다\n\n"
          "| 표 | 칸 |\n| --- | --- |\n| 표의 문장은 세지 않는다 | x |\n\n캡션: 그림의 설명은 세지 않는다\n")

    def setUp(self):
        super().setUp()
        (self.root / "ms").mkdir()
        (self.root / "ms" / "a.md").write_text(self.MD, encoding="utf-8")

    def measure(self, printed):
        files = {"pages/a.xml": "<!-- md: a.md --><Use template=\"page\"/>"}
        slides = [page(1, use("prose", {}, *[text(t) for t in printed]))]
        r = self.read(slides, files=files, sources={1: "pages/a.xml"})
        return carry.measure(r, self.deck)

    def test_a_section_printed_below_the_floor_and_one_printed_in_full(self):
        declared, low = self.measure([])
        self.assertEqual(declared, 1)
        self.assertEqual([(x["carried"], x["total"]) for x in low], [(0, 4)])
        _, low = self.measure(["첫째 문장은 계측 자료를 수집한다. 둘째 문장은 자료를 정규화한다.",
                               "셋째 항목은 저장 경로를 분리한다"])
        self.assertEqual(low, [])

    def test_a_file_without_a_printed_part_promises_nothing(self):
        (self.root / "ms" / "a.md").write_text("# 계획\n\n이 파일은 작성 계획이며 인쇄하지 않는다. " * 5,
                                               encoding="utf-8")
        self.assertEqual(self.measure([])[1], [])


class CarryUndeclaredTests(Base):
    extra = CarryTests.extra
    FULL = ["첫째 문장은 계측 자료를 수집한다. 둘째 문장은 자료를 정규화한다.", "셋째 항목은 저장 경로를 분리한다"]

    def setUp(self):
        super().setUp()
        (self.root / "ms").mkdir()
        (self.root / "ms" / "a.md").write_text(CarryTests.MD, encoding="utf-8")
        (self.root / "ms" / "b.md").write_text(CarryTests.MD, encoding="utf-8")   # no page declares it
        (self.root / "ms" / "c.md").write_text("# 계획\n\n작성 계획이며 인쇄하지 않는다.\n", encoding="utf-8")

    def opt(self, on: bool):
        carry_cfg = {"undeclared": True} if on else {}
        self.deck = project(self.root, {"checks": {"baselines": "baselines", "carry": carry_cfg}, **self.extra})

    def run_main(self):
        files = {"pages/a.xml": "<!-- md: a.md --><Use template=\"page\"/>"}
        slides = [page(1, use("prose", {}, *[text(t) for t in self.FULL]))]
        return runmain.run(carry, self.deck, recording(slides, files=files, sources={1: "pages/a.xml"}))

    def test_off_by_default_no_undeclared_file_is_read(self):
        self.opt(False)
        code, out = self.run_main()
        self.assertEqual(code, 0, out)
        self.assertNotIn("b.md", out)

    def test_a_file_no_page_declares_is_reported_and_a_plan_is_not(self):
        self.opt(True)
        code, out = self.run_main()
        self.assertEqual(code, 1, out)
        self.assertIn("b.md: 4 prose sentences, and no page declares the file", out)
        self.assertIn("1 declared by no page", out)
        self.assertNotIn("c.md", out)
        self.assertNotIn("a.md:", out)

    def test_an_undeclared_file_retires_with_a_reason_and_a_blank_one_still_fails(self):
        self.opt(True)
        path = self.root / "baselines" / "carry.json"
        path.write_text(json.dumps({"b.md\tundeclared": ""}, ensure_ascii=False), encoding="utf-8")
        code, out = self.run_main()
        self.assertEqual(code, 1, out)
        self.assertIn("b.md (declared by no page): retired with a blank reason", out)
        path.write_text(json.dumps({"b.md\tundeclared": "typeset in the second volume"}, ensure_ascii=False),
                        encoding="utf-8")
        code, out = self.run_main()
        self.assertEqual(code, 0, out)


if __name__ == "__main__":
    unittest.main()
