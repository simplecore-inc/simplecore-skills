import re
import tempfile
import unittest
from pathlib import Path

from bidkit.config import ConfigError
from bidkit.deckread import DeckError, DeckReader, attribute_values, format_pattern, json_strings, uses
from bidkit.sgmcp import RecordedTransport, Session

from .support import FIXTURES, body, project, reader, recording, slide


class CapturedDeckTests(unittest.TestCase):
    """The recording captured from a live deck: a cover and two pages of one file."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.deck = project(Path(self.tmp.name), {})
        self.rec = RecordedTransport.from_file(FIXTURES / "three-pages.json")

    def tearDown(self):
        self.tmp.cleanup()

    def read(self) -> DeckReader:
        from bidkit.vocab import Vocabulary
        return DeckReader(Session(self.deck, self.rec), self.deck, Vocabulary.for_deck(self.deck))

    def test_page_ids_of_two_pages_in_one_file(self):
        r = self.read()
        self.assertEqual([p.page_id for p in r.body_pages()], ["Ⅲ-1 01", "Ⅲ-1 02"])
        self.assertEqual([p.chapter_key for p in r.body_pages()], ["Ⅲ-1", "Ⅲ-1"])

    def test_cover_carries_no_folio(self):
        self.assertEqual([p.folio for p in self.read().slides()], [None, 1, 2])

    def test_folio_counted_on_cover_when_the_masters_omit_it(self):
        # The broken declaration: the cover's master is not folioless, so it
        # takes folio 1 and every body folio moves by one.
        self.deck.data["pages"]["masters"] = {"body": ["BODY"], "folioless": ["TOC"], "annex": ["ANNEX"]}
        self.assertEqual([p.folio for p in self.read().slides()], [1, 2, 3])

    def test_unnumbered_master_takes_no_folio(self):
        # A master declared unnumbered (a closing page after the annexes) never
        # takes a folio, so it is not counted against the page limit.
        self.deck.data["pages"]["masters"] = {"body": ["BODY"], "folioless": ["TOC"],
                                             "unnumbered": ["COVER"], "annex": ["ANNEX"]}
        self.assertEqual([p.folio for p in self.read().slides()], [None, 1, 2])

    def test_duplicate_page_id_is_an_error(self):
        self.deck.data["pages"]["id"] = "{part}-{chapter}"
        with self.assertRaises(DeckError):
            self.read().slides()

    def test_files_in_import_order_and_commented_import_skipped(self):
        self.assertEqual([n for n, _ in self.read().files()], ["00-cover.xml", "31-understanding.xml"])

    def test_running_head_read_from_the_head_component(self):
        heads = [p.head.get("tone") for p in self.read().slides()]
        self.assertEqual(heads, [None, "3", "3"])

    def test_missing_numerals_is_a_config_error(self):
        del self.deck.data["pages"]["numerals"]
        with self.assertRaises(ConfigError):
            self.read().slides()


class SyntheticTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.deck = project(Path(self.tmp.name), {})

    def tearDown(self):
        self.tmp.cleanup()

    def test_ordinal_restarts_per_chapter_and_part_out_of_range_fails(self):
        r = reader(self.deck, recording(slides=[body(1, 3, 1), body(2, 3, 2), body(3, 3, 1)]))
        self.assertEqual([p.page_id for p in r.slides()], ["Ⅲ-1 01", "Ⅲ-2 01", "Ⅲ-1 02"])
        r = reader(self.deck, recording(slides=[body(1, 9, 1)]))
        with self.assertRaises(DeckError):
            r.slides()

    def test_annex_pages_are_outside_the_body_count(self):
        slides = [slide(1, "COVER"), slide(2, "PART-1"), body(3, 1, 1), slide(4, "ANNEX-PLAIN"), body(5, 1, 1)]
        self.assertEqual([p.folio for p in reader(self.deck, recording(slides=slides)).slides()],
                         [None, 1, 2, None, 3])

    def test_continued_table_joined_only_across_consecutive_pages(self):
        head = ["구분", "값"]
        a = body(1, 3, 1, tables=[[head, ["가", "1"], ["나", "2"]]])
        b = body(2, 3, 1, tables=[[head, ["다", "3"]]])
        c = body(4, 3, 1, tables=[[head, ["라", "4"]]])
        gap = body(3, 3, 1, texts=("본문",))
        r = reader(self.deck, recording(slides=[a, b, gap, c]))
        joined = list(r.tables(join_continued=True))
        self.assertEqual([(lbl, i, len(rows)) for lbl, i, rows in joined],
                         [("Ⅲ-1 01", 1, 4), ("Ⅲ-1 04", 1, 2)])
        self.assertEqual(len(list(r.tables())), 3)

    def test_different_header_is_not_a_continuation(self):
        a = body(1, 3, 1, tables=[[["구분", "값"], ["가", "1"]]])
        b = body(2, 3, 1, tables=[[["항목", "값"], ["나", "2"]]])
        r = reader(self.deck, recording(slides=[a, b]))
        self.assertEqual(len(list(r.tables(join_continued=True))), 2)

    def test_entry_importing_a_file_the_server_lacks_is_an_error(self):
        rec = recording(files={"pages/a.xml": "<Fragment/>"})
        rec["resources"]["sg://deck/markup"] = rec["resources"]["sg://deck/markup"].replace(
            "=== file: pages/a.xml\n<Fragment/>\n", "")
        with self.assertRaises(DeckError):
            reader(self.deck, rec).files()


class SourceHelpersTests(unittest.TestCase):
    def test_uses_unescape_single_and_double_quotes(self):
        raw = '<Use template="table" rows=\'[["a &amp; b"]]\' title="x &quot;y&quot;" />'
        (template, attrs, _), = list(uses(raw))
        self.assertEqual(template, "table")
        self.assertEqual(attrs["rows"], '[["a & b"]]')
        self.assertEqual(attrs["title"], 'x "y"')

    def test_json_strings_and_attribute_values(self):
        self.assertEqual(json_strings('[{"a": "x", "b": ["y"]}]'), ["x", "y"])
        self.assertEqual(json_strings("not json"), [])
        cell = '[["a", {"text": "printed", "tone": "accent", "align": "right"}]]'
        self.assertEqual(json_strings(cell), ["a", "printed", "accent", "right"])
        self.assertEqual(json_strings(cell, {"tone", "align"}), ["a", "printed"])
        raw = '<!-- c="skip" --><Td text="[2]" /><Use template="t" head="h" />'
        self.assertEqual(list(attribute_values(raw)), [("text", "[2]"), ("template", "t"), ("head", "h")])


class FormatPatternTests(unittest.TestCase):
    def test_page_id_format_reads_back_its_fields(self):
        rx = format_pattern("{part}-{chapter} {ordinal:02}", {"part": "Ⅲ|Ⅳ", "chapter": r"\d+", "ordinal": r"\d+"})
        m = re.search(rx, "see Ⅳ-1\n 03 for it")
        self.assertEqual((m.group("part"), m.group("chapter"), m.group("ordinal")), ("Ⅳ", "1", "03"))
        # The width holds the ordinal to two digits, so a year is not read as one.
        self.assertIsNone(re.fullmatch(rx, "Ⅲ-1 2026"))

    def test_a_field_the_caller_does_not_know_is_refused(self):
        with self.assertRaises(ConfigError):
            format_pattern("그림 {part}-{x}", {"part": "Ⅰ"})


if __name__ == "__main__":
    unittest.main()
