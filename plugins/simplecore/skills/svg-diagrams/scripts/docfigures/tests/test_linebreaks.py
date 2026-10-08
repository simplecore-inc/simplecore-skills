"""R1-R4: the rule over set lines, and the `[line break]` check over a saved
figure, each red on its broken form and quiet on the fixed one."""
import contextlib
import io
import unittest

from helpers import TOOLKIT, Project, svg, text  # noqa: F401

from figlib.linebreak import break_findings, layout  # noqa: E402
from svgkit import tw  # noqa: E402

import verify  # noqa: E402


def at(width, size=24):
    return lambda line: tw(line, size, False) <= width


def rules(lines, width=400):
    return [f.rule for f in break_findings(lines, at(width))]


class Rule(unittest.TestCase):
    def test_r1_break_inside_an_item_fails(self):
        self.assertEqual(rules(["성능 실측 · 장애", "시나리오 시험"]), ["R1"])

    def test_r1_break_at_the_separator_passes(self):
        self.assertEqual(rules(["성능 실측 ·", "장애 시나리오 시험"]), [])

    def test_separator_opening_a_line_fails(self):
        self.assertEqual(rules(["성능 실측", "· 장애 시나리오 시험"]), ["separator"])

    def test_tight_compound_breaks_as_a_word(self):
        # a tight dot binds only the words touching it: its items stop at the
        # nearest space, so the spaces around the compound are word breaks
        self.assertEqual(rules(["제2장 1-바", "하드웨어·소프트웨어"]), [])
        self.assertEqual(rules(["C37.118", "SOC·FRACSEC"]), [])
        self.assertEqual(rules(["운영 레코드 구성·", "크기·주기 승인"]), [])

    def test_spaced_run_item_split_at_an_inner_space_fails(self):
        # a spaced run's item runs to the edge: 「소프트웨어 구성」 is one item
        self.assertEqual(rules(["하드웨어 · 소프트웨어", "구성"]), ["R1"])

    def test_plain_phrase_breaks_by_word(self):
        self.assertEqual(rules(["수신 버퍼 폐기", "0건(제안 기준)"]), [])

    def test_r2_group_broken_where_it_fits_whole_on_the_next_line_fails(self):
        self.assertEqual(rules(["개발 파트 (구현 ·", "결함 수정 · 강의)"], 320), ["R2"])

    def test_r2_group_moved_whole_passes(self):
        self.assertEqual(rules(["개발 파트", "(구현 · 결함 수정 · 강의)"], 320), [])

    def test_r3_break_inside_the_group_off_a_separator_fails(self):
        self.assertEqual(rules(["개발 파트 (구현 · 결함", "수정 · 강의)"], 230), ["R3"])

    def test_r3_break_at_a_separator_passes_when_moving_adds_a_line(self):
        # at 230 the group moved whole needs two lines of its own, three in all
        self.assertEqual(rules(["개발 파트 (구현 ·", "결함 수정 · 강의)"], 230), [])

    def test_layout_breaks_at_a_space_before_splitting_a_tight_compound(self):
        width = tw("재전송 데이터 보존·", 24, False)
        self.assertEqual(layout("재전송 데이터 보존·인수", at(width)).lines,
                         ["재전송 데이터", "보존·인수"])

    def test_layout_keeps_an_unbreakable_group_with_its_word(self):
        # 「(1회)」 cannot break inside, so R2 has nothing to move
        width = tw("착수 보고 회의", 24, False)
        self.assertEqual(layout("착수 보고 회의(1회)", at(width)).lines,
                         ["착수 보고", "회의(1회)"])

    def test_layout_meets_its_own_check(self):
        for text_, width in (("개발 파트 (구현 · 결함 수정 · 강의)", 300),
                             ("개발 파트 (구현 · 결함 수정 · 강의)", 230),
                             ("본 사업용 개발 · 수정 부분 · 시험", 242),
                             ("3만 건/초 · 99백분위 지연 100ms 이내(단계 제안 기준)", 300)):
            laid = layout(text_, at(width))
            self.assertFalse(laid.unfixable, laid)
            self.assertEqual(break_findings(laid.lines, at(width)), [], laid)


class Check(unittest.TestCase):
    def setUp(self):
        self.p = Project()
        self.cfg = self.p.cfg()

    def tearDown(self):
        self.p.close()

    def fig(self, lines, box_w):
        body = f'<rect x="20" y="20" width="{box_w}" height="120" fill="none" stroke="#000"/>'
        body += "".join(text(36, 60 + 30 * k, ln) for k, ln in enumerate(lines))
        return self.p.write("figures/a.svg", svg(body))

    def found(self, lines, box_w):
        f = self.fig(lines, box_w)
        return [(i[0], i[1]) for i in verify.line_break_errors([f], self.cfg)]

    def test_wrapped_break_inside_an_item_fails(self):
        # the box (212 at the fill) cannot take 「시나리오」 after 「성능 실측 ·
        # 장애」 (254), and holds the item 「장애 시나리오 시험」 (190) whole
        self.assertEqual(self.found(["성능 실측 · 장애", "시나리오 시험"], 260),
                         [("a.svg", "R1")])

    def test_wrapped_break_at_the_separator_passes(self):
        self.assertEqual(self.found(["성능 실측 ·", "장애 시나리오 시험"], 260), [])

    def test_over_wide_item_broken_at_a_space_is_r4(self):
        # at 200 (156 at the fill) 「장애 시나리오 시험」 fits no line: information
        self.assertEqual(self.found(["성능 실측 ·", "장애 시나리오", "시험"], 200),
                         [("a.svg", "R4")])

    def test_r4_alone_passes_the_cli_and_is_counted_apart(self):
        self.fig(["성능 실측 ·", "장애 시나리오", "시험"], 200)
        run = self.p.run("linebreaks.py", "--counts")
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
        self.assertIn("0  a.svg  (R4 1)", run.stdout)
        self.assertIn("0 break(s) against R1-R3", run.stdout)
        self.assertIn("1 over-wide item(s) broken at a space (R4)", run.stdout)

    def test_r1_fails_the_cli(self):
        self.fig(["성능 실측 · 장애", "시나리오 시험"], 260)
        run = self.p.run("linebreaks.py", "--counts")
        self.assertEqual(run.returncode, 1, run.stdout + run.stderr)
        self.assertIn("1  a.svg", run.stdout)

    def verify_out(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            verify.run(self.cfg)
        return out.getvalue()

    def test_r4_alone_is_a_review_in_verify_not_a_failure(self):
        self.fig(["성능 실측 ·", "장애 시나리오", "시험"], 200)
        out = self.verify_out()
        self.assertIn("[line break] no break inside", out)
        self.assertIn("[over-wide item] 1 ", out)
        self.assertIn("a.svg: 「장애 시나리오」 / 「시험」: over-wide item", out)

    def test_r1_fails_verify(self):
        self.fig(["성능 실측 · 장애", "시나리오 시험"], 260)
        out = self.verify_out()
        self.assertIn("[line break] 1", out)
        self.assertNotIn("[over-wide item]", out)

    def test_two_labels_stacked_in_a_wide_box_pass(self):
        # 「시나리오」 would fit after the first line: two strings, not a wrap
        self.assertEqual(self.found(["성능 실측 · 장애", "시나리오 시험"], 600), [])

    def test_group_broken_where_it_fits_whole_fails_and_moved_passes(self):
        self.assertEqual(self.found(["개발 파트 (구현 ·", "결함 수정 · 강의)"], 600),
                         [("a.svg", "R2")])
        self.assertEqual(self.found(["개발 파트", "(구현 · 결함 수정 · 강의)"], 600), [])

    def test_allowed_run_passes(self):
        p = Project(lineBreaks={"allow": ["성능 실측 · 장애 / 시나리오 시험"]})
        try:
            body = '<rect x="20" y="20" width="200" height="120" fill="none" stroke="#000"/>'
            body += text(36, 60, "성능 실측 · 장애") + text(36, 90, "시나리오 시험")
            f = p.write("figures/a.svg", svg(body))
            self.assertEqual(verify.line_break_errors([f], p.cfg()), [])
        finally:
            p.close()

    def test_line_breaks_false_turns_it_off(self):
        p = Project(lineBreaks=False)
        try:
            f = p.write("figures/a.svg", svg(text(36, 60, "a · b") + text(36, 90, "c")))
            self.assertIsNone(verify.line_break_errors([f], p.cfg()))
        finally:
            p.close()


if __name__ == "__main__":
    unittest.main()
