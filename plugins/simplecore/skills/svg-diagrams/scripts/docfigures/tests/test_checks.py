"""verify.py's checks, each red on its broken form and quiet on the fixed one."""
import unittest

from helpers import Project, svg, text

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

    def test_dash_glossed_in_its_own_words_fails_and_named_passes(self):
        line = ('<line x1="40" y1="60" x2="300" y2="60" stroke="#000" '
                'stroke-width="1.4" stroke-dasharray="5 4"/>')
        bad = self.fig("bad", line + text(40, 120, "점선 칸: 따로 저장"))
        good = self.fig("good", line + text(40, 120, "점선 칸: 범위 밖(따로 저장)"))
        self.assertEqual([r[0] for r in verify.dash_legend_errors([bad, good], self.cfg)],
                         ["bad.svg"])


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
