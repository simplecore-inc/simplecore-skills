"""R1-R4: the rule over set lines, read from the case table beside
linebreak.py, and the `[line break]` check over a saved figure, each red on its
broken form and quiet on the fixed one."""
import contextlib
import io
import json
import unicodedata
import unittest
from pathlib import Path

from helpers import LIBRARY, TOOLKIT, Project, svg, text  # noqa: F401

from figlib.checks_breaks import run_findings  # noqa: E402
from figlib.linebreak import break_findings, layout  # noqa: E402

import verify  # noqa: E402

CASES = json.loads((LIBRARY / "figlib" / "linebreak_cases.json").read_text(encoding="utf-8"))


def cells(line, _size=None):
    """The table's width rule: a wide East Asian character counts 2, others 1."""
    return sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in line)


def at(width):
    return lambda line: cells(line) <= width


class Table(unittest.TestCase):
    def test_layout(self):
        for case in CASES["layout"]:
            with self.subTest(case["id"]):
                laid = layout(case["text"], at(case["width"]), measure=cells)
                self.assertEqual(laid.lines, case["lines"])
                self.assertEqual(list(laid.overwide), case["overwide"])

    def test_layout_meets_its_own_check(self):
        for case in CASES["layout"]:
            with self.subTest(case["id"]):
                found = break_findings(case["lines"], at(case["width"]))
                self.assertEqual([f.rule for f in found if not f.info], [])

    def test_check(self):
        for case in CASES["check"]:
            with self.subTest(case["id"]):
                found = break_findings(case["lines"], at(case["width"]))
                self.assertEqual([f.rule for f in found], case["findings"])

    def test_forced(self):
        for case in CASES["forced"]:
            with self.subTest(case["id"]):
                found = run_findings(case["lines"], 1, cells, case["box"])
                self.assertEqual([f.rule for f in found], case["findings"])


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
