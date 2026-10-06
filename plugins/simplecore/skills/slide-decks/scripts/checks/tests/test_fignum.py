"""fignum: figure numbers in sequence per series, and citations that find their figure."""
import json
import tempfile
import unittest
from pathlib import Path

from fixtures import page, project, reader, recording, use
from runmain import run

import fignum

PART_SERIES = {"caption": "그림 {part}-{n}", "annex": "그림 별첨{a}-{n}"}


class Base(unittest.TestCase):
    numbering = PART_SERIES
    caption = "^캡션: "

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "ms").mkdir()
        (self.root / "baselines").mkdir()
        self.deck = project(self.root, {
            "checks": {"baselines": "baselines"},
            "figures": {"numbering": self.numbering},
            "manuscript": {"dir": "ms", "caption": self.caption, "declaration": "<!--\\s*md:"}})

    def tearDown(self):
        self.tmp.cleanup()

    def md(self, name: str, text: str) -> None:
        (self.root / "ms" / name).write_text(text, encoding="utf-8")

    def rec(self, numbers: list, src: str = "<Fragment/>") -> dict:
        slides = [page(i + 1, use("figure", {"no": n, "caption": "c"})) for i, n in enumerate(numbers)]
        return recording(slides, files={"pages/a.xml": src})

    def result(self, numbers: list, src: str = "<Fragment/>") -> dict:
        return fignum.check(reader(self.deck, self.rec(numbers, src)), self.deck)

    def sequence(self, numbers: list) -> list:
        return [(w, k, [n for n, _ in items]) for w, k, items, _ in self.result(numbers)["sequence"]]


class FigNumTests(Base):
    def test_the_deck_runs_one_to_n_per_part(self):
        self.md("a.md", "캡션: 그림 Ⅲ-1 가\n")
        self.assertEqual(self.sequence(["그림 Ⅲ-1", "그림 Ⅲ-2", "그림 Ⅳ-1"]), [])
        self.assertEqual(self.sequence(["그림 Ⅲ-1", "그림 Ⅲ-3"]), [("deck", "그림 Ⅲ-", [1, 3])])
        self.assertEqual(self.sequence(["그림 Ⅲ-1", "그림 Ⅲ-1"]), [("deck", "그림 Ⅲ-", [1, 1])])

    def test_a_partial_deck_only_has_to_rise_when_declared(self):
        self.deck.data["checks"]["fignum"] = {"deckOrder": "monotonic"}
        self.assertEqual(self.sequence(["그림 Ⅲ-2", "그림 Ⅲ-5"]), [])
        self.assertEqual(self.sequence(["그림 Ⅲ-2", "그림 Ⅲ-1"]), [("deck", "그림 Ⅲ-", [2, 1])])

    def test_the_manuscript_runs_one_to_n_in_path_order_and_annexes_apart(self):
        self.md("1.md", "캡션: 그림 Ⅲ-1 가\n캡션: 그림 별첨2-1 나\n")
        self.md("2.md", "캡션: 그림 Ⅲ-3 다\n")
        self.assertEqual(self.sequence([]), [("manuscript", "그림 Ⅲ-", [1, 3])])
        self.md("2.md", "캡션: 그림 Ⅲ-2 다\n캡션: 그림 별첨2-2 라\n")
        self.assertEqual(self.sequence(["그림 Ⅲ-1", "그림 별첨2-1"]), [])

    def test_a_citation_resolves_in_its_own_numbering(self):
        self.md("1.md", "캡션: 그림 Ⅲ-1 가\n본문은 그림 Ⅲ-1을 본다.\n```\n그림 Ⅲ-7\n```\n")
        src = '<Use template="figure" no="그림 Ⅲ-1"/><Use template="prose" text="그림 Ⅲ-2와 같다."/>'
        self.assertEqual(self.result(["그림 Ⅲ-1"], src)["dangling"], [("a.xml", "그림 Ⅲ-2")])
        quiet = '<Use template="figure" no="그림 Ⅲ-1"/><!-- 그림 Ⅲ-9 --><Use template="prose" text="그림 Ⅲ-1과 같다."/>'
        self.assertEqual(self.result(["그림 Ⅲ-1"], quiet)["dangling"], [])
        self.md("2.md", "그림 Ⅳ-1에서 보듯이\n")
        self.assertEqual(self.result(["그림 Ⅲ-1"], quiet)["dangling"], [("2.md", "그림 Ⅳ-1")])

    def test_a_deck_number_the_manuscript_lacks_when_declared(self):
        self.md("1.md", "캡션: 그림 Ⅲ-1 가\n")
        self.assertIsNone(self.result(["그림 Ⅲ-1", "그림 Ⅲ-2"])["unknown"])
        self.deck.data["checks"]["fignum"] = {"deckInManuscript": True}
        self.assertEqual(self.result(["그림 Ⅲ-1", "그림 Ⅲ-2"])["unknown"], [("Ⅲ-1 02", "그림 Ⅲ-2")])

    def test_an_idle_figure_in_a_declared_manuscript_when_declared(self):
        self.md("a.md", "캡션: 그림 Ⅲ-1 가\n캡션: 그림 Ⅲ-2 나\n")
        self.md("b.md", "캡션: 그림 Ⅳ-1 다\n")
        src = '<!-- md: a.md --><Use template="page" title="가. 쪽"/>'
        rec = self.rec(["그림 Ⅲ-1"], src)
        self.assertEqual(run(fignum, self.deck, rec)[0], 0)
        self.deck.data["checks"]["fignum"] = {"idle": True}
        self.assertEqual(fignum.check(reader(self.deck, rec), self.deck)["idle"], [("그림 Ⅲ-2", "a.md")])
        self.assertEqual(run(fignum, self.deck, rec)[0], 1)
        path = self.root / "baselines" / "fignum.json"
        path.write_text(json.dumps({"그림 Ⅲ-2": ""}), encoding="utf-8")
        self.assertEqual(run(fignum, self.deck, rec)[0], 1)
        path.write_text(json.dumps({"그림 Ⅲ-2": "본문 표로 대신한다"}, ensure_ascii=False), encoding="utf-8")
        self.assertEqual(run(fignum, self.deck, rec)[0], 0)


class ChapterNumberingTests(Base):
    """A format with a chapter: one series per chapter, captions in bold lines."""
    numbering = {"caption": "그림 {part}-{chapter}-{n}"}
    caption = r"^\*\*"

    def test_one_series_per_chapter(self):
        self.md("1.md", "**그림 Ⅲ-1-1 가**\n**그림 Ⅲ-1-2 나**\n**그림 Ⅲ-2-1 다**\n")
        self.assertEqual(self.sequence(["그림 Ⅲ-1-1", "그림 Ⅲ-1-2", "그림 Ⅲ-2-1"]), [])
        self.assertEqual(self.sequence(["그림 Ⅲ-1-1", "그림 Ⅲ-2-2"]), [("deck", "그림 Ⅲ-2-", [2])])

    def test_a_format_field_the_check_does_not_know_is_refused(self):
        self.deck.data["figures"]["numbering"] = {"caption": "그림 {part}-{x}"}
        with self.assertRaises(fignum.ConfigError):
            self.result([])


if __name__ == "__main__":
    unittest.main()
