"""echo, twice and samefact: the same words, or the same fact, said twice."""
import json
import tempfile
import unittest
from pathlib import Path

from fixtures import page, project, reader, recording, table, text, use
from runmain import run

import echo
import samefact
import twice

SUB = "제안사는 수집 계층과 저장 계층을 분리해 장애가 한 계층에 머물도록 설계하고 절체 시간을 실측으로 확인합니다."
SAME = "수집 계층과 저장 계층을 분리해 장애가 한 계층에 머물도록 설계하고 절체 시간을 실측으로 확인한다."
OTHER = "운영자는 대시보드에서 노드별 처리율과 지연 분포를 조회하고 임계치 초과 이력을 내려받는다."


class Base(unittest.TestCase):
    extra: dict = {}

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "baselines").mkdir()
        self.deck = project(self.root, {"checks": {"baselines": "baselines", **self.extra}})

    def tearDown(self):
        self.tmp.cleanup()

    def read(self, *slides):
        return reader(self.deck, recording(list(slides)))

    def baseline(self, name: str, data) -> None:
        (self.root / "baselines" / f"{name}.json").write_text(json.dumps(data, ensure_ascii=False),
                                                             encoding="utf-8")

    def code(self, module, *slides) -> int:
        return run(module, self.deck, recording(list(slides)))[0]


class EchoTests(Base):
    def found(self, *slides):
        return [(p, a, b) for p, a, b, *_ in echo.find(self.read(*slides), self.deck)]

    def test_explanation_restated_by_a_paragraph(self):
        self.assertEqual(self.found(page(1, use("prose", {"text": SAME}), head={"sub": SUB})),
                         [("Ⅲ-1 01", "sub", "prose")])
        self.assertEqual(self.found(page(1, use("prose", {"text": OTHER}), head={"sub": SUB})), [])

    def test_card_rows_are_read_only_when_declared(self):
        card = use("pair-card", {"head": "분리", "aLabel": "구조", "aText": SAME, "bLabel": "검증",
                                 "bText": "시험으로 확인한다"})
        slide = page(1, card, head={"sub": SUB})
        self.assertEqual(self.found(slide), [])
        self.deck.data["checks"]["echo"] = {"cards": True}
        self.assertEqual(self.found(slide), [("Ⅲ-1 01", "sub", "card")])

    def test_two_rows_of_one_component_are_its_shape(self):
        self.deck.data["checks"]["echo"] = {"cards": True}
        self.assertEqual(self.found(page(1, use("proof-line", {"head": "절체", "body": SAME, "tail": SAME}))), [])
        apart = [use("proof-line", {"head": "절체", "body": SAME}), use("prose", {"text": SAME})]
        self.assertEqual(self.found(page(1, *apart)), [("Ⅲ-1 01", "card", "prose")])

    def test_pages_are_compared_apart_and_a_page_without_the_head_is_not_read(self):
        self.assertEqual(self.found(page(1, head={"sub": SUB}), page(2, use("prose", {"text": SAME}))), [])
        divider = {"slide": 1, "blocks": [{"role": "group", "key": "g", "children": [
            use("figure", {"caption": SAME}), use("prose", {"text": SAME})]},
            {"role": "master", "key": "master:PART-3"}]}
        self.assertEqual(self.found(divider), [])

    def test_a_judged_pair_needs_its_reason_and_its_measure(self):
        slide = page(1, use("prose", {"text": SAME}), head={"sub": SUB})
        item = echo.find(self.read(slide), self.deck)[0]
        k = echo.key(item)
        self.assertEqual(self.code(echo, slide), 1)
        self.baseline("echo", {k: item[3]})                         # legacy: a bare overlap
        self.assertEqual(self.code(echo, slide), 0)
        self.baseline("echo", {k: {"ratio": item[3], "why": ""}})   # retired, reason owed
        self.assertEqual(self.code(echo, slide), 1)
        self.baseline("echo", {k: {"ratio": 0.5, "why": "다른 대상이다"}})   # judged at another overlap
        self.assertEqual(self.code(echo, slide), 1)
        self.baseline("echo", {k: {"ratio": item[3], "why": "다른 대상이다"}})
        self.assertEqual(self.code(echo, slide), 0)


class EchoConfigTests(Base):
    extra = {"echo": {"exemptSub": ["ANNEX"], "captionPrefix": r"^그림 \S+ "}}

    def test_an_exempt_master_keeps_its_summary_and_a_caption_loses_its_number(self):
        on_annex = page(1, use("prose", {"text": SAME}), head={"sub": SUB}, master="ANNEX-1")
        self.assertEqual(echo.find(self.read(on_annex), self.deck), [])
        fig = page(1, use("figure", {"caption": "그림 Ⅲ-1 수집 계층과 저장 계층의 분리", "no": "그림 Ⅲ-1"}))
        r = self.read(fig)
        blocks = echo.blocks(r.slides()[0], r, echo.Settings(self.deck))
        self.assertEqual([t for _, t, _ in blocks], ["수집 계층과 저장 계층의 분리"])


class TwiceTests(Base):
    def found(self, *slides):
        return twice.find(self.read(*slides), self.deck)

    def test_a_block_on_two_pages(self):
        got = self.found(page(1, use("prose", {"text": SAME}, text(SAME))),
                         page(2, use("card", {"body": SAME}, text(SAME, "arg:body"))))
        self.assertEqual(got, [(SAME, ["Ⅲ-1 01", "Ⅲ-1 02"])])

    def test_short_strings_and_one_page_are_not_repeats(self):
        s = "노드별 처리율을 기록하고 이상 구간은 별도로 표시한다."
        self.assertLess(len(s), twice.MIN_LEN)
        self.assertEqual(self.found(page(1, text(s)), page(2, text(s))), [])
        self.assertEqual(self.found(page(1, text(SAME), text(SAME))), [])

    def test_sentences_inside_a_paragraph_when_declared(self):
        para = f"{OTHER} {SAME}"
        slides = (page(1, use("prose", {"text": para}, text(para))),
                  page(2, use("card", {"body": SAME}, text(SAME, "arg:body"))))
        self.assertEqual(self.found(*slides), [])
        self.deck.data["checks"]["twice"] = {"sentences": True, "minLen": 28}
        self.assertEqual(self.found(*slides), [(SAME.rstrip("."), ["Ⅲ-1 01", "Ⅲ-1 02"])])
        s = "노드별 처리율을 기록하고 이상 구간은 별도로 표시한다."
        self.assertEqual(len(self.found(page(1, text(s)), page(2, text(s)))), 1)

    def test_a_legacy_list_stays_retired_and_a_blank_reason_fails(self):
        slides = (page(1, text(SAME)), page(2, text(SAME)))
        self.assertEqual(self.code(twice, *slides), 1)
        self.baseline("twice", [SAME[:60]])
        self.assertEqual(self.code(twice, *slides), 0)
        self.baseline("twice", {SAME[:60]: ""})
        self.assertEqual(self.code(twice, *slides), 1)
        self.baseline("twice", {SAME[:60]: "같은 원칙을 두 장에서 인용한다"})
        self.assertEqual(self.code(twice, *slides), 0)


class SameFactTests(Base):
    def found(self, *slides):
        return [(k, u, sorted(v)) for k, u, v in samefact.find(self.read(*slides), self.deck)]

    def test_the_same_noun_phrase_with_two_values(self):
        got = self.found(page(1, text("골든 SVG 61개를 대조한다.")), page(2, text("골든 SVG 63개로 늘었다.")))
        self.assertEqual(got, [("골든 SVG", "COUNT", ["61", "63"])])

    def test_different_modifiers_and_longer_units_are_apart(self):
        self.assertEqual(self.found(page(1, text("SFR 요구 46건")), page(2, text("전체 요구 98건"))), [])
        self.assertEqual(self.found(page(1, text("시험 기간 10개월")), page(2, text("시험 기간 10개"))), [])
        # A rate and a count are two facts: 「건/초」 is tried before 「건」.
        self.assertEqual(self.found(page(1, text("처리 목표 100건/초")), page(2, text("처리 목표 120건"))), [])

    def test_a_particle_after_the_unit_still_counts(self):
        got = self.found(page(1, text("설계 화면 21종을 그린다.")), page(2, text("설계 화면 23종")))
        self.assertEqual(got, [("설계 화면", "종", ["21", "23"])])
        got = self.found(page(1, text("설계 화면은 21종")), page(2, text("설계 화면 23종")))
        self.assertEqual(got, [("설계 화면", "종", ["21", "23"])])

    def test_cells_are_read_apart(self):
        # Joined, the first cell's end and the next cell's number invent 「동작 시연 10개월」.
        one = page(1, *table("tb", ["단계", "기간"], ["동작 시연", "10개월"]))
        two = page(2, text("동작 시연 12개월"))
        self.assertEqual(self.found(one, two), [])

    def test_a_judged_value_set_fires_again_when_it_grows(self):
        slides = [page(1, text("골든 SVG 61개")), page(2, text("골든 SVG 63개"))]
        self.baseline("samefact", {"골든 SVG\tCOUNT": ["61", "63"]})
        self.assertEqual(self.code(samefact, *slides), 0)
        slides.append(page(3, text("골든 SVG 64개")))
        self.assertEqual(self.code(samefact, *slides), 1)
        self.baseline("samefact", {"골든 SVG\tCOUNT": {"values": ["61", "63", "64"], "why": ""}})
        self.assertEqual(self.code(samefact, *slides), 1)
        self.baseline("samefact", {"골든 SVG\tCOUNT": {"values": ["61", "63", "64"], "why": "범위가 다르다"}})
        self.assertEqual(self.code(samefact, *slides), 0)


if __name__ == "__main__":
    unittest.main()
