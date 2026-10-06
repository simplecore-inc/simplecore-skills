"""The build: which files run, and what save() and @figure write."""
import json
import unittest

from helpers import Project

MODULE = '''from common import canvas, card, save
c = canvas(1200, 200)
card(c, 24, 24, 1152, c.blue, "Title", ["one item"])
save(c, "one")
'''

MARKER = '''from pathlib import Path
Path("RAN_{name}").write_text("ran")
raise SystemExit(0)
'''


class ModuleSelection(unittest.TestCase):
    def setUp(self):
        self.p = Project(helpers=["figs/helper.py"])
        self.p.write("figs/one.py", MODULE)
        self.p.write("figs/test_x.py", MARKER.format(name="test"))
        self.p.write("figs/helper.py", MARKER.format(name="helper"))
        self.p.write("figs/common.py", MARKER.format(name="shadow"))

    def tearDown(self):
        self.p.close()

    def test_glob_matches_the_files_the_build_must_skip(self):
        # without the filter these would run: the glob reaches all four
        stems = {f.stem for f in self.p.cfg().module_files()}
        self.assertEqual(stems, {"one", "test_x", "helper", "common"})

    def test_build_runs_figure_modules_only(self):
        run = self.p.run("build.py")
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
        self.assertTrue((self.p.root / "figures" / "one.svg").exists())
        for name in ("test", "helper", "shadow"):
            self.assertFalse((self.p.root / f"RAN_{name}").exists(), name)

    def test_named_module_that_is_a_test_file_is_refused(self):
        run = self.p.run("build.py", "test_x")
        self.assertNotEqual(run.returncode, 0)
        self.assertFalse((self.p.root / "RAN_test").exists())


class Save(unittest.TestCase):
    def setUp(self):
        self.p = Project()

    def tearDown(self):
        self.p.close()

    def test_width_alias_saves_on_that_board_and_warns(self):
        self.p.write("figs/a.py", '''from common import canvas, card, save
c = canvas(528, 200)
card(c, 24, 24, 480, c.blue, "Title", ["item"])
save(c, "by-width", width=528)
c = canvas(528, 200)
card(c, 24, 24, 480, c.blue, "Title", ["item"])
save(c, "by-board", board=528)
''')
        run = self.p.run("build.py")
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn("DeprecationWarning", run.stderr)
        a = (self.p.root / "figures" / "by-width.svg").read_text(encoding="utf-8")
        b = (self.p.root / "figures" / "by-board.svg").read_text(encoding="utf-8")
        self.assertIn('width="528', a)
        self.assertEqual(a, b)

    def test_boards_and_scale_the_deck_config_owns_reach_the_drawing_layer(self):
        deck = ".claude/slide-decks.json"
        p = Project(boards={"from": deck, "key": "decks.d.figures.boards"},
                    placeScale={"from": deck, "key": "decks.d.figures.placeScale"})
        try:
            p.write(deck, '{"decks": {"d": {"figures": {"boards": '
                          '{"1200": 600, "528": 264, "528-pair": 290}, "placeScale": 0.9}}}}')
            p.write("figs/a.py", '''from pathlib import Path
from common import PLACEMENT, SCALE, canvas, card, save
Path("scale.txt").write_text(f"{sorted(PLACEMENT.items())} {SCALE:.4f}")
c = canvas(528, 200)
card(c, 24, 24, 480, c.blue, "Title", ["item"])
save(c, "column", board=528)
''')
            run = p.run("build.py")
            self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
            self.assertEqual((p.root / "scale.txt").read_text(),
                             "[(528, 264.0), (1200, 600.0)] 0.4500")
            self.assertIn('width="528', (p.root / "figures" / "column.svg").read_text())
        finally:
            p.close()

    def test_board_not_declared_raises(self):
        self.p.write("figs/a.py", '''from common import canvas, save
save(canvas(700, 100), "x", board=700)
''')
        run = self.p.run("build.py")
        self.assertNotEqual(run.returncode, 0)
        self.assertIn("board must be one of", run.stderr)

    def test_plain_figure_declares_itself_and_sets_single_items_plain(self):
        self.p.write("figs/a.py", '''from common import canvas, card, card_h, figure, save

@figure(plain=True)
def fig_plain():
    h = card_h(400, "Title", ["one item"])   # measured before the canvas exists
    c = canvas(1200, 200)
    card(c, 24, 24, 400, c.blue, "Title", ["one item"])
    save(c, "plain")
    return h

def fig_listing():
    h = card_h(400, "Title", ["one item"])
    c = canvas(1200, 200)
    card(c, 24, 24, 400, c.blue, "Title", ["one item"])
    save(c, "listing")
    return h

assert fig_plain() <= fig_listing()
fig_plain()
fig_listing()
''')
        run = self.p.run("build.py")
        self.assertEqual(run.returncode, 0, run.stderr)
        plain = (self.p.root / "figures" / "plain.svg").read_text(encoding="utf-8")
        listing = (self.p.root / "figures" / "listing.svg").read_text(encoding="utf-8")
        self.assertIn('data-list-mode="plain"', plain)
        self.assertNotIn("•", plain)
        self.assertNotIn("data-list-mode", listing)
        self.assertIn("•", listing)


class Wrap(unittest.TestCase):
    """The default wrap: by word, with the glue binding what must stay together."""

    CONFIG = {"noBreak": ["([0-9][0-9,.]*만?) (건|행|ms|초)"]}

    def setUp(self):
        self.p = Project(**self.CONFIG)

    def tearDown(self):
        self.p.close()

    def value(self, expr):
        """Evaluate `expr` inside a build run; returns (value, run)."""
        self.p.write("figs/w.py", f'''import json
from common import item_lines, wrap
from figlib.text import _raise_marks
print("VALUE" + json.dumps({expr}, ensure_ascii=False))
''')
        run = self.p.run("build.py")
        line = next((ln for ln in run.stdout.splitlines() if ln.startswith("VALUE")), None)
        self.assertIsNotNone(line, run.stdout + run.stderr)
        return json.loads(line[5:]), run

    def lines(self, text, width, size=24):
        return self.value(f"wrap({text!r}, {width}, {size})")

    def test_tight_dot_is_kept_as_written(self):
        lines, _ = self.lines("기술·교육 지원", 1000)
        self.assertEqual(lines, ["기술·교육 지원"])

    def test_tight_dot_is_not_a_break(self):
        # a compound joined by a tight dot is one word to the wrap
        lines, _ = self.lines("전력계통·배전설비 운영", 220)
        self.assertEqual(lines, ["전력계통·배전설비", "운영"])

    def test_spaced_list_breaks_by_word_and_passes(self):
        # the word wrap fills each line; a list item may break, and that is
        # not a build failure unless the project asks for list-item wraps
        lines, run = self.lines("본 사업용 개발 · 수정 부분 · 시험", 260)
        self.assertEqual(lines, ["본 사업용 개발 · 수정", "부분 · 시험"])
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
        self.assertNotIn("line broken inside a list item", run.stdout)

    def test_no_break_space_is_kept_in_the_separator(self):
        lines, _ = self.lines("A\u00a0· B", 1000)
        self.assertEqual(lines, ["A\u00a0· B"])

    def test_authored_newline_is_a_line_boundary(self):
        lines, _ = self.lines("화면 44 · 프레임 162\n엔터티 112", 1000, 14)
        self.assertEqual(lines, ["화면 44 · 프레임 162", "엔터티 112"])

    def test_item_glue_keeps_a_dot_with_the_word_before_it(self):
        # 「본 사업용 개발」 fits the 148.8 limit and 「본 사업용 개발 ·」 does not,
        # so without the glue the second line would open on the dot
        rows, _ = self.value('[r[0] for r in item_lines(["본 사업용 개발 · 시험"], 160, 24, False)]')
        self.assertEqual(rows, ["본 사업용", "개발 · 시험"])

    def test_item_glue_keeps_a_number_with_its_unit(self):
        plain, _ = self.value('wrap("처리 목표 30만 건/초 유지", 200, 24)')
        self.assertEqual(plain, ["처리 목표 30만", "건/초 유지"])
        rows, _ = self.value(
            '[r[0] for r in item_lines(["처리 목표 30만 건/초 유지"], 200, 24, False)]')
        self.assertEqual(rows, ["처리 목표", "30만 건/초 유지"])


class ListItemWrap(Wrap):
    """`wrapListItems`: a 「·」 list breaks between items, and a break inside
    one fails the build."""

    CONFIG = dict(Wrap.CONFIG, wrapListItems=True)

    def test_spaced_list_breaks_by_word_and_passes(self):
        lines, run = self.lines("본 사업용 개발 · 수정 부분 · 시험", 260)
        for item in ("본 사업용 개발", "수정 부분"):
            self.assertTrue(any(item in ln for ln in lines), (item, lines))
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
        self.assertNotIn("line broken inside a list item", run.stdout)

    def test_lone_trailing_mark_rides_up(self):
        # 「공동 검증 1:3 ·」 is 149.8 wide, inside 158
        lines, _ = self.value('_raise_marks(["공동 검증 1:3", "·"], 158, 24)')
        self.assertEqual(lines, ["공동 검증 1:3 ·"])

    def test_lone_mark_too_wide_to_ride_up_stays(self):
        lines, _ = self.value('_raise_marks(["공동 검증 1:3", "·"], 140, 24)')
        self.assertEqual(lines, ["공동 검증 1:3", "·"])

    def test_item_too_wide_with_its_separator_is_not_reported(self):
        # 「본 사업용 개발」 is 145.9 wide, 159.4 with 「 ·」: inside the 153.5
        # limit alone and over it with the separator, so the list wrap cannot
        # hold it and the word wrap breaks it. One measure for both: it is an
        # item too wide to keep whole, not a split to report.
        lines, run = self.lines("가 · 본 사업용 개발 · 시험", 165)
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
        self.assertNotIn("line broken inside a list item", run.stdout)

    def test_short_item_broken_by_the_word_fallback_is_reported(self):
        # the first item cannot be held whole, so the word wrap runs and breaks
        # 「시험 운영」, which fits with its separator: that break is reported
        lines, run = self.lines("데이터 수집 경로 설계 · 시험 운영 · 가", 175)
        self.assertEqual(lines, ["데이터 수집", "경로 설계 · 시험", "운영 · 가"])
        self.assertNotEqual(run.returncode, 0)
        self.assertIn("line broken inside a list item: 「데이터 수집 경로 설계 · 시험 운영 · 가」",
                      run.stdout)


if __name__ == "__main__":
    unittest.main()
