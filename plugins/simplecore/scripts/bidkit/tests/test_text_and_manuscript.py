import tempfile
import unittest
from pathlib import Path

from bidkit.config import ConfigError
from bidkit.manuscript import Manuscript
from bidkit.textko import loose, norm, sentences, strip_particle, wrapped_lines

from .support import project


class TextTests(unittest.TestCase):
    def test_norm(self):
        self.assertEqual(norm(r"첫 항목을 검사한다.\n결과를 기록한다."), "첫 항목을 검사한다. 결과를 기록한다.")
        self.assertEqual(norm("[근거](https://www.example.org/a)"), "근거 (example.org/a)")
        self.assertEqual(norm("**법령 근거**는 「규칙」"), "법령 근거는 규칙")
        self.assertEqual(norm("3*4"), "3*4")

    def test_loose_drops_layout_punctuation(self):
        self.assertEqual(loose("수집·저장, 조회 (1~3)."), "수집저장조회13")

    def test_sentences(self):
        self.assertEqual(sentences("수집한다. 저장한다. Then it ends. 끝"),
                         ["수집한다", "저장한다", "Then it ends", "끝"])

    def test_strip_particle(self):
        self.assertEqual(strip_particle("화면을"), "화면")
        self.assertEqual(strip_particle("서버으로"), "서버")

    def test_wrapping_counts_the_line_division_misses(self):
        width = {" ": 1.0}
        w = lambda c: width.get(c, 1.0)  # noqa: E731
        text = "aaaa bbbb cccc"          # 14 units in a 10-unit box
        self.assertEqual(-(-len(text) // 10), 2)          # division says two
        self.assertEqual(wrapped_lines(text, 10, w), 2)
        self.assertEqual(wrapped_lines("aaaaaa bbbbbb cccc", 10, w), 3)  # 18 units: division says two
        self.assertEqual(wrapped_lines("a" * 25, 10, w), 3)               # a word wider than the box


class ManuscriptTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        src = self.root / "proposal"
        (src / "10-별첨").mkdir(parents=True)
        (src / "README.md").write_text("# readme\n")
        (src / "01-a.md").write_text(
            "# 기록\n\n메모\n\n## 인쇄 원고\n\n### Ⅲ-1 01 첫 쪽\n\n본문이다.\n\n캡션: 그림 Ⅲ-1 구성\n\n"
            "### Ⅲ-1 02 둘째 쪽\n\n둘째 본문.\n\n## 작성 기록\n\n제외\n", encoding="utf-8")
        (src / "10-별첨" / "01-b.md").write_text("별첨\n", encoding="utf-8")
        self.deck = project(self.root, {"manuscript": {
            "dir": "proposal", "printed": "## 인쇄 원고", "page": "### ", "caption": "^캡션: ",
            "declaration": "<!--\\s*md:", "exclude": ["README.md"], "annex": ["10-별첨/**"]}})

    def tearDown(self):
        self.tmp.cleanup()

    def test_printed_pages_stop_at_the_next_section(self):
        m = Manuscript.for_deck(self.deck)
        pages = m.printed_pages((m.dir / "01-a.md").read_text(encoding="utf-8"))
        self.assertEqual([t for t, _ in pages], ["Ⅲ-1 01 첫 쪽", "Ⅲ-1 02 둘째 쪽"])
        self.assertNotIn("제외", pages[-1][1])

    def test_captions_and_declarations(self):
        m = Manuscript.for_deck(self.deck)
        self.assertEqual(m.captions((m.dir / "01-a.md").read_text(encoding="utf-8")), ["그림 Ⅲ-1 구성"])
        raw = "<!-- md: 03-전략/01-이해.md · Ⅲ-1 01, docs/표제.md -->"
        self.assertEqual(m.declarations(raw), ["03-전략/01-이해.md", "docs/표제.md"])

    def test_files_exclude_and_annex(self):
        m = Manuscript.for_deck(self.deck)
        names = lambda ps: [p.relative_to(m.dir).as_posix() for p in ps]  # noqa: E731
        self.assertEqual(names(m.files()), ["01-a.md", "10-별첨/01-b.md"])
        self.assertEqual(names(m.files(annex=False)), ["01-a.md"])
        self.assertEqual(names(m.files(annex=True)), ["10-별첨/01-b.md"])
        self.assertIn("README.md", names(m.files(include_excluded=True)))

    def test_string_form_and_undeclared_convention(self):
        m = Manuscript.for_deck(project(self.root, {"manuscript": "proposal"}))
        with self.assertRaises(ConfigError):
            m.printed_pages("## 인쇄 원고\n")


if __name__ == "__main__":
    unittest.main()
