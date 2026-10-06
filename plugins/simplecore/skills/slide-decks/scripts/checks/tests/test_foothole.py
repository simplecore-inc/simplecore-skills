"""foothole: a body page whose content stops well above the folio."""
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

from fixtures import page, project, reader, recording
from runmain import run

import foothole


def page_png(path: Path, content_bottom: int) -> None:
    im = Image.new("L", (793, 1122), 255)
    d = ImageDraw.Draw(im)
    d.rectangle([60, 200, 730, content_bottom], fill=40)
    d.rectangle([370, 1082, 420, 1095], fill=90)
    im.save(path)


class FootholeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_a_full_page_and_a_short_one(self):
        full, short = self.dir / "full.png", self.dir / "short.png"
        page_png(full, 1050)
        page_png(short, 880)
        self.assertLess(foothole.hole(full, 0.955, 235), int(1122 * 0.08))
        self.assertGreater(foothole.hole(short, 0.955, 235), int(1122 * 0.08))

    def test_the_folio_is_not_content(self):
        empty = self.dir / "empty.png"
        page_png(empty, 210)
        self.assertGreater(foothole.hole(empty, 0.955, 235), 800)


def blank_png(path: Path) -> None:
    im = Image.new("L", (793, 1122), 255)
    ImageDraw.Draw(im).rectangle([370, 1082, 420, 1095], fill=90)
    im.save(path)


class FootholeDeckTests(unittest.TestCase):
    """Which pages are measured, what is reported, and a deck on which nothing is measured."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.png = self.root / "out"
        self.png.mkdir()
        (self.root / "baselines").mkdir()
        page_png(self.png / "main-1.png", 1050)      # a full body page
        page_png(self.png / "main-2.png", 880)       # a short one
        blank_png(self.png / "main-3.png")           # nothing above the folio
        page_png(self.png / "main-4.png", 300)       # a cover, not measured
        self.slides = [page(1), page(2), page(3, master="ANNEX-1"), page(4, master="COVER")]

    def tearDown(self):
        self.tmp.cleanup()

    def deck(self, extra: dict | None = None):
        return project(self.root, {"previews": "out", "checks": {"baselines": "baselines", **(extra or {})}})

    def test_the_reader_s_body_and_annex_masters_are_measured(self):
        deck = self.deck()
        measured, found = foothole.measure_pages(reader(deck, recording(self.slides)), deck)
        self.assertEqual(measured, 3)
        self.assertEqual([(label, blank) for label, _, _, blank in found], [("Ⅲ-1 02", False), ("slide 3", True)])

    def test_a_declared_regex_replaces_the_reader_s_masters(self):
        deck = self.deck({"foothole": {"masters": "^ANNEX"}})
        measured, found = foothole.measure_pages(reader(deck, recording(self.slides)), deck)
        self.assertEqual((measured, [label for label, *_ in found]), (1, ["slide 3"]))

    def test_the_summary_counts_the_pages_and_a_deck_with_none_exits_2(self):
        deck = self.deck()
        code, out = run(foothole, deck, recording(self.slides))
        self.assertEqual(code, 1)
        self.assertIn("foothole: 3 body pages measured, 2 end too far above the folio", out)
        self.assertIn("slide 3: no ink above the foot band", out)
        code, out = run(foothole, deck, recording([page(4, master="COVER")]))
        self.assertEqual(code, 2)
        self.assertIn("no page measured", out)


if __name__ == "__main__":
    unittest.main()
