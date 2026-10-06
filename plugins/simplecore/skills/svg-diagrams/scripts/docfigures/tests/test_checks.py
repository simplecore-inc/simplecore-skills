"""verify.py's checks, each red on its broken form and quiet on the fixed one."""
import unittest

from helpers import Project, figconfig, svg, text

import verify  # noqa: E402


class Case(unittest.TestCase):
    def setUp(self):
        self.p = Project()
        self.cfg = self.p.cfg()

    def tearDown(self):
        self.p.close()

    def fig(self, name, body, **kw):
        return self.p.write(f"figures/{name}.svg", svg(body, **kw))


class TypeScale(Case):
    def test_off_ladder_size_fails(self):
        f = self.fig("a", text(40, 60, "label", size=19))
        self.assertEqual(verify.font_size_errors([f], self.cfg), [("a.svg", [19.0])])

    def test_ladder_size_passes(self):
        f = self.fig("a", text(40, 60, "label", size=21) + text(40, 90, "body", size=24))
        self.assertEqual(verify.font_size_errors([f], self.cfg), [])


class SubBodyShare(Case):
    def test_every_word_below_body_fails(self):
        f = self.fig("a", text(40, 60, "tag tag tag", size=21))
        self.assertEqual([n for n, _s in verify.sub_body_share([f], self.cfg)], ["a.svg"])

    def test_share_over_the_limit_fails(self):
        f = self.fig("a", text(40, 60, "x" * 60, size=21) + text(40, 90, "y" * 40))
        self.assertEqual([n for n, _s in verify.sub_body_share([f], self.cfg)], ["a.svg"])

    def test_share_under_the_limit_passes(self):
        f = self.fig("a", text(40, 60, "x" * 30, size=21) + text(40, 90, "y" * 70))
        self.assertEqual(verify.sub_body_share([f], self.cfg), [])


class LabelForm(Case):
    def labels(self, *strings):
        f = self.fig("a", "".join(text(40, 40 + 30 * i, s) for i, s in enumerate(strings)))
        return [t for _n, t in verify.predicate_labels([f], self.cfg)]

    def test_polite_and_plain_predicates_fail(self):
        caught = ["제출합니다", "값을 확인한다", "저장하세요", "보존한다.", "기록이 남았다",
                  "결과가 있다"]
        self.assertEqual(self.labels(*caught), caught)

    def test_trailing_parenthetical_does_not_hide_a_predicate(self):
        self.assertEqual(self.labels("확정한다(13절)"), ["확정한다(13절)"])

    def test_noun_forms_pass(self):
        self.assertEqual(self.labels("제출", "사업소별 설치 호스트 불필요", "수집 개요",
                                     "주요 연혁", "승인 시 반영"), [])

    def test_kdn_form_alone_misses_the_polite_ending(self):
        # the broken form this replaces: a 「~X다」 list without 「니다」
        import re
        kdn = re.compile(r"(?:[한된이있없했였였겠는않본진른난준낸간온친킨운렸었았]다)$")
        self.assertIsNone(kdn.search("제출합니다"))
        self.assertEqual(self.labels("제출합니다"), ["제출합니다"])


class SectionNumbers(Case):
    def test_section_number_in_figure_text_fails(self):
        f = self.fig("a", text(40, 60, "3.2"))
        self.assertEqual(verify.section_number_errors([f], self.cfg), [("a.svg", ["3.2"])])

    def test_section_reference_with_words_fails(self):
        f = self.fig("a", text(40, 60, "4.1.2 절 참조"))
        self.assertEqual(verify.section_number_errors([f], self.cfg), [("a.svg", ["4.1.2"])])

    def test_counts_and_tick_rows_pass(self):
        ticks = "".join(text(100 + 60 * i, 300, t) for i, t in enumerate(["-3", "0", "1.5", "3"]))
        f = self.fig("a", text(40, 60, "32건") + text(40, 90, "MPL-2.0") + ticks)
        self.assertEqual(verify.section_number_errors([f], self.cfg), [])


class Dashes(Case):
    def test_dash_off_the_declared_patterns_fails(self):
        f = self.fig("a", '<line x1="40" y1="60" x2="300" y2="60" stroke="#000" '
                          'stroke-width="1.4" stroke-dasharray="3 7"/>')
        self.assertEqual(verify.dash_pattern_errors([f], self.cfg), [("a.svg", ["3 7"])])

    OUTSIDE = ('<line x1="40" y1="60" x2="300" y2="60" stroke="#000" '
               'stroke-width="1.4" stroke-dasharray="5 4"/>')
    PENDING = ('<line x1="40" y1="90" x2="300" y2="90" stroke="#000" '
               'stroke-width="1.4" stroke-dasharray="6 5"/>')
    TWO = {"DASH_OUTSIDE": {"pattern": "5 4", "words": ["범위 밖"]},
           "DASH_PENDING": {"pattern": "6 5", "words": ["미확정"]}}

    def legend_errors(self, *figures, **config):
        p = Project(**config)
        try:
            files = [p.write(f"figures/{name}.svg", svg(body)) for name, body in figures]
            return [r[0] for r in verify.dash_legend_errors(files, p.cfg())]
        finally:
            p.close()

    def test_one_dash_meaning_needs_no_gloss_by_default(self):
        # one dash in the figure cannot be confused with another
        self.assertEqual(self.legend_errors(("bare", self.OUTSIDE),
                                            ("own", self.OUTSIDE + text(40, 120, "점선 칸: 따로 저장"))),
                         [])

    def test_two_dash_meanings_need_a_gloss_by_default(self):
        bare = self.OUTSIDE + self.PENDING
        half = bare + text(40, 120, "점선: 범위 밖")
        named = bare + text(40, 120, "점선: 범위 밖 · 미확정")
        self.assertEqual(self.legend_errors(("bare", bare), ("half", half), ("named", named),
                                            dashes=self.TWO),
                         ["bare.svg", "bare.svg", "half.svg"])

    def test_every_dash_glossed_when_configured(self):
        bad = ("bad", self.OUTSIDE + text(40, 120, "점선 칸: 따로 저장"))
        good = ("good", self.OUTSIDE + text(40, 120, "점선 칸: 범위 밖(따로 저장)"))
        self.assertEqual(self.legend_errors(bad, good, dashGloss="every"), ["bad.svg"])

    def test_unknown_gloss_mode_is_refused(self):
        p = Project(dashGloss="some")
        try:
            with self.assertRaisesRegex(figconfig.ConfigError, "dashGloss"):
                p.cfg()
        finally:
            p.close()


class StubLine(Case):
    def column(self, *lines, x=40, top=60, gap=30, bullets=False):
        body = ""
        for i, s in enumerate(lines):
            y = top + i * gap
            if bullets:
                body += text(x - 14, y, "•")
            body += text(x, y, s)
        return body

    def stubs(self, body):
        return [(n, last) for n, last, _s, _l in verify.stub_lines([self.fig("a", body)], self.cfg)]

    def test_wrapped_run_ending_on_a_stub_fails(self):
        self.assertEqual(self.stubs(self.column("시험 운영 · 기술이전 시스템 테스트", "후")),
                         [("a.svg", "후")])

    def test_rebalanced_run_passes(self):
        self.assertEqual(self.stubs(self.column("시험 운영 · 기술이전", "시스템 테스트 후")), [])

    def test_bullets_keep_a_short_item_out_of_the_run_before_it(self):
        lines = ("관리 모듈 개발 및 통합 시험 준비", "인수")
        self.assertEqual(self.stubs(self.column(*lines)), [("a.svg", "인수")])
        self.assertEqual(self.stubs(self.column(*lines, bullets=True)), [])

    def test_list_whose_breaks_the_column_did_not_force_passes(self):
        # a timeline's task names: the short last item follows an item it
        # would have fitted beside, so no wrap put it on its own line
        tasks = ("Proxy Gateway 클러스터 환경 구축", "클러스터 관리 모듈 개발",
                 "프로토콜 수집 및 처리 기능 개발", "포인트 매핑 기능 개발", "단위 테스트")
        self.assertEqual(self.stubs(self.column(*tasks)), [])

    def test_lines_of_another_weight_or_further_apart_are_not_one_run(self):
        title = text(40, 60, "시험 운영 · 기술이전 시스템 테스트").replace(
            "<text ", '<text font-weight="700" ', 1)
        self.assertEqual(self.stubs(title + text(40, 90, "후")), [])
        self.assertEqual(self.stubs(self.column("시험 운영 · 기술이전 시스템 테스트", "후",
                                                gap=60)), [])

    def test_null_turns_the_check_off(self):
        p = Project(stubLine=None)
        try:
            f = p.write("figures/a.svg", svg(self.column("시험 운영 · 기술이전 시스템 테스트", "후")))
            self.assertIsNone(verify.stub_lines([f], p.cfg()))
        finally:
            p.close()


class SourceChecks(Case):
    def test_toolkit_pill_in_a_module_fails_and_the_library_label_passes(self):
        self.p.write("figs/ch1.py", 'c.edge_label(600, 120, "요청")\n')
        found = verify.edge_pill_errors(self.cfg)
        self.assertEqual(len(found), 1)
        self.assertIn("EDGE-PILL: ch1.py:1", found[0])
        self.p.write("figs/ch1.py", 'edge_label(c, 600, 120, "요청", "#1b4a9c")\n')
        self.assertEqual(verify.edge_pill_errors(self.cfg), [])

    def test_source_the_check_cannot_read_is_not_a_pass(self):
        self.p.write("figs/ch1.py", "def broken(:\n")
        for found in (verify.marker_errors(self.cfg), verify.edge_pill_errors(self.cfg)):
            self.assertEqual(len(found), 1)
            self.assertIn("did not run", found[0])


class ContrastDefault(unittest.TestCase):
    # a body label at 3.5:1 on white, on a 1200 board placed at 600 px, so it
    # prints at 12 px: text, not large text
    BODY = text(60, 90, "판정 통과", fill="#888888")

    def found(self, **config):
        p = Project(**config)
        try:
            f = p.write("figures/a.svg", svg(self.BODY, w=1200, h=160))
            return verify.contrast_errors([f], p.cfg())
        finally:
            p.close()

    def test_default_holds_a_body_size_label_to_the_text_floor(self):
        found = self.found()
        self.assertEqual(len(found), 1)
        self.assertIn("under 4.5:1", found[0])

    def test_a_number_holds_every_label_to_it_and_null_turns_it_off(self):
        self.assertEqual(self.found(contrastFloor=3.0), [])
        self.assertIsNone(self.found(contrastFloor=None))


class Strokes(Case):
    def test_stroke_off_the_ladder_fails_and_icon_stroke_passes(self):
        bad = self.fig("bad", '<rect x="40" y="40" width="200" height="60" fill="#fff" '
                              'stroke="#000" stroke-width="1.2"/>')
        icon = self.fig("icon", '<line x1="1" y1="1" x2="9" y2="9" stroke="#000" '
                                'stroke-width="2.0" stroke-linecap="round"/>')
        self.assertEqual(verify.stroke_width_errors([bad, icon], self.cfg),
                         [("bad.svg", [(1.2, 1)])])


if __name__ == "__main__":
    unittest.main()
