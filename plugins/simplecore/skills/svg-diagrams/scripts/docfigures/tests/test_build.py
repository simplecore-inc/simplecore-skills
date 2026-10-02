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
    """The wrap keeps list items whole and the author's characters as written."""

    def setUp(self):
        self.p = Project()

    def tearDown(self):
        self.p.close()

    def lines(self, text, width, size=24):
        self.p.write("figs/w.py", f'''import json
from common import wrap
print("LINES" + json.dumps(wrap({text!r}, {width}, {size}), ensure_ascii=False))
''')
        run = self.p.run("build.py")
        line = next(ln for ln in run.stdout.splitlines() if ln.startswith("LINES"))
        return json.loads(line[5:]), run

    def test_tight_dot_is_kept_as_written(self):
        lines, _ = self.lines("기술·교육 지원", 1000)
        self.assertEqual(lines, ["기술·교육 지원"])

    def test_tight_dot_is_not_a_break(self):
        # a compound joined by a tight dot is one word to the wrap
        lines, _ = self.lines("전력계통·배전설비 운영", 220)
        self.assertEqual(lines, ["전력계통·배전설비", "운영"])

    def test_spaced_list_breaks_between_items_not_inside_one(self):
        lines, run = self.lines("본 사업용 개발 · 수정 부분 · 시험", 260)
        for item in ("본 사업용 개발", "수정 부분"):
            self.assertTrue(any(item in ln for ln in lines), (item, lines))
        self.assertNotIn("line broken inside a list item", run.stdout)

    def test_no_break_space_is_kept_in_the_separator(self):
        lines, _ = self.lines("A · B", 1000)
        self.assertEqual(lines, ["A · B"])

    def test_authored_newline_is_a_line_boundary(self):
        lines, _ = self.lines("화면 44 · 프레임 162\n엔터티 112", 1000, 14)
        self.assertEqual(lines, ["화면 44 · 프레임 162", "엔터티 112"])


if __name__ == "__main__":
    unittest.main()
