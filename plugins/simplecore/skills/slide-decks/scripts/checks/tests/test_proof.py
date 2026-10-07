"""proof: evidence citations against the table that defines them."""
import re
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE.parents[4] / "scripts"))

import proof  # noqa: E402
from bidkit.config import ConfigError  # noqa: E402
from bidkit.tests.support import body, project, reader, recording  # noqa: E402

TABLE = ("| 번호 | 이름 | 인용 쪽 |\n| --- | --- | --- |\n"
         "| 증빙 1 | 시험 결과 | Ⅲ-1 01 |\n| 증빙 2 | 실측 | Ⅲ-1 01 |\n| 증빙 3 | 검증 | Ⅳ-2 03 |\n")
# The bracket-only citation a fork read: it cannot see 「증빙 2·5」 written bare.
BRACKET_ONLY = re.compile(r"증빙\s*([\d·, ]+?)\s*\]")


def page(text: str) -> str:
    return f'<Fragment><Use template="page" tone="3" chapter="1. 장" title="가. 쪽" sub="{text}" /></Fragment>'


class ProofTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "evidence.md").write_text(TABLE, encoding="utf-8")
        self.deck = project(self.root, {"evidence": {"tag": "증빙", "table": "evidence.md", "pagesColumn": -1}})

    def tearDown(self):
        self.tmp.cleanup()

    def run_on(self, text: str, slides=None):
        rec = recording(files={"pages/a.xml": page(text)}, slides=slides or [body(1, 3, 1, texts=(text,))])
        return proof.check(reader(self.deck, rec), self.deck)

    def test_bare_citation_of_an_undefined_item(self):
        text = "결과는 증빙 2·5 로 낸다. [증빙 1]"
        self.assertEqual(BRACKET_ONLY.findall(text), ["1"])     # the bracket-only form misses 5
        _, bad, code = self.run_on(text)
        self.assertEqual(code, 1)
        self.assertIn(("a.xml", "[증빙 5] is not defined in evidence.md"), bad)

    def test_count_and_range_are_not_citations(self):
        for text in ("증빙 3건을 낸다.", "증빙 1~9는 별첨으로 낸다.", "증빙 2·5건"):
            cited, _ = proof.citations([("a.xml", page(text))], proof.patterns("증빙", proof.COUNT_UNITS)[0])
            self.assertEqual(cited, {}, text)

    def test_count_alone_without_table_is_quiet(self):
        (self.root / "evidence.md").unlink()
        lines, bad, code = self.run_on("증빙 3건을 낸다.")
        self.assertEqual((bad, code), ([], 0))
        self.assertIn("not used", lines[0])

    def test_missing_table_with_citations_fails(self):
        (self.root / "evidence.md").unlink()
        _, bad, code = self.run_on("[증빙 1]")
        self.assertEqual(code, 1)
        self.assertEqual(bad[0][0], "config")

    def test_uncited_item_is_pending_until_its_chapter_is_typeset(self):
        lines, bad, code = self.run_on("[증빙 1] · [증빙 2]")
        self.assertEqual((bad, code), ([], 0))
        self.assertIn("not typeset yet: 3", lines[0])
        slides = [body(1, 3, 1, texts=("[증빙 1] · [증빙 2]",)), body(2, 4, 2)]
        _, bad, code = self.run_on("[증빙 1] · [증빙 2]", slides)
        self.assertEqual(bad, [("evidence.md", "증빙 3 is cited by no page")])

    def test_shorthand_number_without_the_tag(self):
        raw = page("[증빙 1] [증빙 2] [증빙 3]").replace(
            "/>", 'rows=\'[["근거", "[2·5]"]]\' />')
        rec = recording(files={"pages/a.xml": raw},
                        slides=[body(1, 3, 1, texts=("[증빙 1] [증빙 2]",)), body(2, 4, 2)])
        _, bad, _ = proof.check(reader(self.deck, rec), self.deck)
        self.assertEqual(bad, [("a.xml", "「[2·5]」 cites by number without 「증빙」")])

    def test_listed_pages_held_to_the_pages_that_print_the_item(self):
        table = ("| 번호 | 이름 | 인용 쪽 |\n| --- | --- | --- |\n"
                 "| 증빙 1 | 시험 결과 | Ⅲ-1 01, Ⅲ-1 02 |\n| 증빙 2 | 실측 | Ⅲ-1 01, Ⅲ-1 01 |\n")
        (self.root / "evidence.md").write_text(table, encoding="utf-8")
        slides = [body(1, 3, 1, texts=("[증빙 1·2]",)), body(2, 3, 1, texts=("본문",)),
                  body(3, 3, 1, texts=("증빙 1로 낸다.",))]
        _, bad, _ = self.run_on("[증빙 1·2]", slides)
        self.assertEqual(bad, [("evidence.md", "증빙 1 lists Ⅲ-1 02, which does not print 증빙 1"),
                               ("evidence.md", "증빙 1 is printed on Ⅲ-1 03, which its row does not list"),
                               ("evidence.md", "증빙 2 lists Ⅲ-1 01 twice")])

    def test_a_part_ordinal_names_the_parts_nth_page(self):
        table = "| 번호 | 이름 | 인용 쪽 |\n| --- | --- | --- |\n| 증빙 1 | 시험 결과 | Ⅲ 02 |\n"
        (self.root / "evidence.md").write_text(table, encoding="utf-8")
        slides = [body(1, 3, 1, texts=("본문",)), body(2, 3, 2, texts=("[증빙 1]",))]
        _, bad, _ = self.run_on("[증빙 1]", slides)
        self.assertEqual(bad, [])
        slides = [body(1, 3, 1, texts=("[증빙 1]",)), body(2, 3, 2, texts=("본문",))]
        _, bad, _ = self.run_on("[증빙 1]", slides)
        self.assertEqual(bad, [("evidence.md", "증빙 1 lists Ⅲ 02, which does not print 증빙 1"),
                               ("evidence.md", "증빙 1 is printed on Ⅲ-1 01, which its row does not list")])

    def test_notation_declared_unused_and_undeclared(self):
        self.deck.data["evidence"] = None
        lines, bad, code = self.run_on("[증빙 1]")
        self.assertEqual((bad, code), ([], 0))
        del self.deck.data["evidence"]
        with self.assertRaises(ConfigError):
            self.run_on("")


if __name__ == "__main__":
    unittest.main()
