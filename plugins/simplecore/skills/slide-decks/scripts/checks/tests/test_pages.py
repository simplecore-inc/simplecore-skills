"""layout, chapter_pages and contents over recorded decks."""
import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE.parents[4] / "scripts"))

import chapter_pages  # noqa: E402
import contents  # noqa: E402
import deliver  # noqa: E402
import layout  # noqa: E402
from bidkit.config import ConfigError  # noqa: E402
from bidkit.sgmcp import DeckUnavailable  # noqa: E402
from bidkit.tests.support import body, project, reader, recording, slide  # noqa: E402

SUMMARY = "checked 3 slides · 40 nodes · overlap {o} · outside 0 · escape 0 · empty 0 · tiny 0 · font {f} · diagnostic 0 · ink 0 · spread 0"


def tool_text(text: str, error: bool = False) -> dict:
    out = {"content": [{"type": "text", "text": text}]}
    if error:
        out["isError"] = True
    return out


class LayoutTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.deck = project(Path(self.tmp.name), {"type": {"floor": 8}})

    def tearDown(self):
        self.tmp.cleanup()

    def run_on(self, text: str, error: bool = False):
        rec = recording()
        rec["tools"] = {"layout_check": tool_text(text, error)}
        r = reader(self.deck, rec)
        return layout.check(r.session, self.deck), r.session.t.calls

    def test_a_finding_of_any_kind_fails(self):
        (_, found, failed), calls = self.run_on(SUMMARY.format(o=2, f=1))
        self.assertEqual((found["overlap"], found["font"], sum(found.values()), failed), (2, 1, 3, False))
        args = [p for m, p in calls if m == "tools/call"][0]["arguments"]
        self.assertEqual(args["minFontSize"], 8)
        self.assertEqual(args["kinds"], layout.KINDS)

    def test_clean_summary_is_zero(self):
        (_, found, _), _ = self.run_on(SUMMARY.format(o=0, f=0))
        self.assertEqual(sum(found.values()), 0)

    def test_summary_without_a_requested_kind_is_unreadable(self):
        # A summary the check cannot parse would otherwise read as no findings.
        with self.assertRaises(DeckUnavailable):
            self.run_on("checked 3 slides · overlap 0")

    def test_tool_error_is_reported(self):
        (_, _, failed), _ = self.run_on("no deck", error=True)
        self.assertTrue(failed)

    def test_kinds_are_configurable(self):
        self.deck.data["checks"] = {"layout": {"kinds": ["overlap"]}}
        (_, found, _), calls = self.run_on("checked 3 slides · overlap 1")
        self.assertEqual(found, {"overlap": 1})


def titled(n: int, part: int, chapter: int, title: str) -> dict:
    s = body(n, part, chapter)
    s["blocks"][0]["children"][0]["attrs"]["title"] = title
    return s


class ChapterPagesTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.deck = project(Path(self.tmp.name), {})

    def tearDown(self):
        self.tmp.cleanup()

    def bad(self, titles):
        slides = [titled(i + 1, 3, c, t) for i, (c, t) in enumerate(titles)]
        return chapter_pages.check(reader(self.deck, recording(slides=slides)), self.deck)[2]

    def test_marked_topic_is_quiet(self):
        self.assertEqual(self.bad([(1, "가. 범위 (1/2)"), (1, "가. 범위 (2/2)"), (1, "나. 방안")]), [])

    def test_marker_gone_stale_after_a_page_was_added(self):
        bad = self.bad([(1, "가. 범위 (1/2)"), (1, "가. 범위 (2/2)"), (1, "가. 범위")])
        self.assertEqual(bad, ["Ⅲ-1 01: 「가. 범위 (1/2)」 should end (1/3)",
                               "Ⅲ-1 02: 「가. 범위 (2/2)」 should end (2/3)",
                               "Ⅲ-1 03: 「가. 범위」 is page 3 of 3 of its topic and carries no (3/3)"])

    def test_lone_page_keeps_a_marker(self):
        self.assertEqual(len(self.bad([(1, "가. 범위 (1/2)"), (1, "나. 방안")])), 1)

    def test_same_title_in_two_chapters_is_two_topics(self):
        # Grouping by the title alone would call these one topic of two pages.
        self.assertEqual(self.bad([(1, "가. 개요"), (2, "가. 개요")]), [])

    def test_slot_is_configurable(self):
        self.deck.data["checks"] = {"chapter_pages": {"slot": "chapter"}}
        self.assertEqual(self.bad([(1, "가. 범위 (1/2)")]), [])


def toc_slide(n: int, rows: list) -> dict:
    """A contents slide: rows of (part numeral, page, [(chapter no, page)])."""
    children, k = [], 0
    for i, (numeral, page, items) in enumerate(rows):
        for field, text in (("ch.no", numeral), ("ch.name", "부"), ("ch.page", page)):
            k += 1
            children.append({"role": "text", "key": f"node#{n}{k:03d}", "text": text,
                             "origin": f"←row[{i}].{field}"})
        for j, (no, ipage) in enumerate(items):
            for field, text in (("it.no", no), ("it.name", "장"), ("it.page", ipage)):
                k += 1
                children.append({"role": "text", "key": f"node#{n}{k:03d}", "text": text,
                                 "origin": f"←row[{j}].{field}"})
    return {"slide": n, "blocks": [{"role": "group", "children": children},
                                   {"role": "master", "key": "master:TOC"}]}


SET_OK = {"content": [{"type": "text", "text": '{"ok": true}'}]}


class ContentsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.deck = project(Path(self.tmp.name), {})

    def tearDown(self):
        self.tmp.cleanup()

    def deck_with(self, rows):
        slides = [slide(1, "COVER-ART"), toc_slide(2, rows), slide(3, "PART-1"),
                  body(4, 1, 1), body(5, 1, 1), body(6, 1, 2), slide(7, "PART-2")]
        rec = recording(slides=slides)
        rec["resources"]["sg://deck"] = "generation 4  revision 9  root main.sgx"
        rec["tools"] = {"set_texts": SET_OK}
        return reader(self.deck, rec)

    def test_numbers_match_the_folios(self):
        r = self.deck_with([("Ⅰ", "1", [("1.", "2"), ("2.", "4")]), ("Ⅱ", "5", [])])
        wrong, pending = contents.judge(contents.entries(r, self.deck))
        self.assertEqual((wrong, pending), ([], []))

    def test_moved_page_and_untypeset_chapter(self):
        r = self.deck_with([("Ⅰ", "1", [("1.", "2"), ("2.", "3")]), ("Ⅱ", "5", [("1.", "6")])])
        wrong, pending = contents.judge(contents.entries(r, self.deck))
        self.assertEqual([(e.part, e.chapter, e.printed, e.expected) for e in wrong], [("Ⅰ", "2", "3", "4")])
        self.assertEqual([(e.part, e.chapter) for e in pending], [("Ⅱ", "1")])

    def test_write_goes_through_set_texts_with_the_read_generation(self):
        r = self.deck_with([("Ⅰ", "9", [("1.", "2"), ("2.", "3")])])
        wrong, _ = contents.judge(contents.entries(r, self.deck))
        contents.write(r, wrong)
        calls = [p for m, p in r.session.t.calls if m == "tools/call"]
        self.assertEqual(len(calls), 1)
        args = calls[0]["arguments"]
        self.assertEqual(calls[0]["name"], "set_texts")
        self.assertEqual((args["generation"], args["readAt"]), (4, 9))
        self.assertEqual([i["text"] for i in args["items"]], ["1", "4"])
        self.assertTrue(all(i["key"].startswith("node#2") for i in args["items"]))

    def test_a_contents_page_inside_an_annex_is_not_the_body_s(self):
        slides = [slide(1, "COVER-ART"), toc_slide(2, [("Ⅰ", "1", [("1.", "2")])]), slide(3, "PART-1"),
                  body(4, 1, 1), slide(5, "ANNEX-PLAIN"), toc_slide(6, [("Ⅰ", "2", [("1.", "7")])])]
        rec = recording(slides=slides)
        rec["resources"]["sg://deck"] = "generation 4  revision 9  root main.sgx"
        wrong, pending = contents.judge(contents.entries(reader(self.deck, rec), self.deck))
        self.assertEqual(([e.slide for e in wrong], [e.slide for e in pending]), ([], []))

    def test_refused_write_is_an_error(self):
        r = self.deck_with([("Ⅰ", "9", [])])
        r.session.t.tools["set_texts"] = {"content": [{"type": "text", "text": "stale"}], "isError": True}
        wrong, _ = contents.judge(contents.entries(r, self.deck))
        with self.assertRaises(DeckUnavailable):
            contents.write(r, wrong)

    def test_vocabulary_without_contents_fields_is_an_error(self):
        r = self.deck_with([("Ⅰ", "1", [])])
        r.vocab.data.pop("contents")
        with self.assertRaises(ConfigError):
            contents.entries(r, self.deck)


class CommandLineTests(unittest.TestCase):
    """Every check's parser builds: a flag that collides with a shared one fails only at run time."""

    def test_help_of_every_check(self):
        for module in MODULES:
            with self.subTest(module.__name__), redirect_stdout(io.StringIO()):
                with self.assertRaises(SystemExit) as caught:
                    module.main(["--help"])
                self.assertEqual(caught.exception.code, 0)


MODULES = [chapter_pages, contents, deliver, layout]


if __name__ == "__main__":
    unittest.main()
