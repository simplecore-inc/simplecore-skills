"""foothole: a body page whose content stops well above the folio."""
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

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


if __name__ == "__main__":
    unittest.main()
