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
    """The wrap: by word, with the glue binding what must stay together, and
    R1-R3 (figlib/linebreak.py) for 「·」 lists and parenthesised groups."""

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

    def test_tight_compound_breaks_as_a_word(self):
        # a tight dot binds the words touching it; the space after the
        # compound is an ordinary word break
        lines, run = self.lines("전력계통·배전설비 운영", 220)
        self.assertEqual(lines, ["전력계통·배전설비", "운영"])
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)

    def test_tight_dot_is_a_break_when_the_compound_does_not_fit(self):
        # 「전력계통·배전설비」 is wider than 0.93 x 150: the break goes after
        # the dot, never inside a word
        lines, _ = self.lines("전력계통·배전설비", 150)
        self.assertEqual(lines, ["전력계통·", "배전설비"])

    def test_tight_compound_within_the_full_width_keeps_its_line(self):
        # wider than the 93% limit, inside the full width: kept whole, as a
        # word that long is
        lines, run = self.value(
            'wrap("하드웨어·소프트웨어", __import__("common").tw("하드웨어·소프트웨어", 24, False)'
            ' / 0.96, 24)')
        self.assertEqual(lines, ["하드웨어·소프트웨어"])
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)

    def test_r1_list_breaks_at_a_separator_never_inside_an_item(self):
        # the word wrap would give 「본 사업용 개발 · 수정」 / 「부분 · 시험」
        lines, run = self.lines("본 사업용 개발 · 수정 부분 · 시험", 260)
        self.assertEqual(lines, ["본 사업용 개발 ·", "수정 부분 · 시험"])
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)

    def test_r2_group_moves_whole_to_the_next_line(self):
        lines, run = self.lines("개발 파트 (구현 · 결함 수정 · 강의)", 320)
        self.assertEqual(lines, ["개발 파트", "(구현 · 결함 수정 · 강의)"])
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)

    def test_r2_moves_a_group_touching_the_word_before_it(self):
        lines, _ = self.lines("개발 파트(구현 · 결함 수정 · 강의)", 320)
        self.assertEqual(lines, ["개발 파트", "(구현 · 결함 수정 · 강의)"])

    def test_r3_breaks_inside_the_group_at_a_separator_when_moving_adds_a_line(self):
        # moved whole the group needs two lines of its own, three in all
        lines, run = self.lines("개발 파트 (구현 · 결함 수정 · 강의)", 250)
        self.assertEqual(lines, ["개발 파트 (구현 ·", "결함 수정 · 강의)"])
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)

    def test_r4_over_wide_item_breaks_at_a_space_and_is_listed(self):
        # 「데이터 수집 경로 설계」 cannot be held whole at 0.93 x 175: it breaks
        # at its space, the other items stay whole, and the build lists it
        # without failing
        lines, run = self.lines("데이터 수집 경로 설계 · 시험 운영 · 가", 175)
        self.assertEqual(lines, ["데이터 수집", "경로 설계 ·", "시험 운영 · 가"])
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
        self.assertIn("R4: over-wide item 「데이터 수집 경로 설계」", run.stdout)

    def test_r4_picks_the_most_even_space(self):
        # 「설계 산출물 확정」 at 0.93 x 158: one cut holds it, and of the two
        # spaces the one whose longer line is shorter is taken
        lines, _ = self.lines("설계 산출물 확정", 158)
        self.assertEqual(lines, ["설계 산출물", "확정"])

    def test_r4_leaves_a_group_that_can_break_to_r2(self):
        # the item ends at the parenthesis, so the group moves whole (R2)
        # rather than R4 cutting the item before it
        lines, _ = self.lines("가 · 사용자 정의 수신기(Data Streamer)", 290)
        self.assertEqual(lines, ["가 · 사용자 정의 수신기", "(Data Streamer)"])

    def test_authored_newline_inside_an_item_is_reported(self):
        lines, run = self.lines("성능 실측 · 장애\n시나리오 시험", 1000)
        self.assertEqual(lines, ["성능 실측 · 장애", "시나리오 시험"])
        self.assertNotEqual(run.returncode, 0)
        self.assertIn("R1: 「성능 실측 · 장애」 / 「시나리오 시험」", run.stdout)

    def test_authored_newline_at_a_separator_passes(self):
        lines, run = self.lines("성능 실측 ·\n장애 시나리오 시험", 1000)
        self.assertEqual(lines, ["성능 실측 ·", "장애 시나리오 시험"])
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)

    def test_no_break_space_is_kept_in_the_separator(self):
        lines, _ = self.lines("A\u00a0· B", 1000)
        self.assertEqual(lines, ["A\u00a0· B"])

    def test_authored_newline_is_a_line_boundary(self):
        lines, _ = self.lines("화면 44 · 프레임 162\n엔터티 112", 1000, 14)
        self.assertEqual(lines, ["화면 44 · 프레임 162", "엔터티 112"])

    def test_closing_separator_is_held_to_the_full_width(self):
        # 「본 사업용 개발」 (145.9) fits the 148.8 limit and 「본 사업용 개발 ·」
        # (159.4) the full 160: the item stays whole with its separator
        rows, _ = self.value('[r[0] for r in item_lines(["본 사업용 개발 · 시험"], 160, 24, False)]')
        self.assertEqual(rows, ["본 사업용 개발 ·", "시험"])

    def test_closing_separator_past_the_full_width_moves_the_break(self):
        # at 158 「본 사업용 개발 ·」 passes the full width: the item cannot be
        # held whole, so it breaks by word and no line opens on the dot
        rows, run = self.value(
            '[r[0] for r in item_lines(["본 사업용 개발 · 시험"], 158, 24, False)]')
        self.assertEqual(rows, ["본 사업용", "개발 · 시험"])
        self.assertIn("R4: over-wide item 「본 사업용 개발」", run.stdout)

    def test_item_glue_keeps_a_number_with_its_unit(self):
        plain, _ = self.value('wrap("처리 목표 30만 건/초 유지", 200, 24)')
        self.assertEqual(plain, ["처리 목표 30만", "건/초 유지"])
        rows, _ = self.value(
            '[r[0] for r in item_lines(["처리 목표 30만 건/초 유지"], 200, 24, False)]')
        self.assertEqual(rows, ["처리 목표", "30만 건/초 유지"])

    def test_lone_trailing_mark_rides_up(self):
        # 「공동 검증 1:3 ·」 is 149.8 wide, inside 158
        lines, _ = self.value('_raise_marks(["공동 검증 1:3", "·"], 158, 24)')
        self.assertEqual(lines, ["공동 검증 1:3 ·"])

    def test_lone_mark_too_wide_to_ride_up_stays(self):
        lines, _ = self.value('_raise_marks(["공동 검증 1:3", "·"], 140, 24)')
        self.assertEqual(lines, ["공동 검증 1:3", "·"])


if __name__ == "__main__":
    unittest.main()
