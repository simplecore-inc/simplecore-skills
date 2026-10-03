"""figbox: a document figure's box is the size of the picture it prints."""
import tempfile
import unittest
from pathlib import Path

from fixtures import page, project, reader, recording, use

import figbox


class FigboxTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        (root / "deck" / "assets").mkdir(parents=True)
        (root / "deck" / "assets" / "a.svg").write_text('<svg viewBox="0 0 1200 500"></svg>')
        png = b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\rIHDR" + (1440).to_bytes(4, "big") + (944).to_bytes(4, "big")
        (root / "deck" / "assets" / "s.png").write_bytes(png)
        (root / "deck" / "assets" / "c.svg").write_text('<svg viewBox="0 0 528 600"></svg>')
        self.deck = project(root, {"dir": "deck",
                                   "figures": {"boards": {"1200": 681, "528": 300}, "placeScale": 0.9}})

    def tearDown(self):
        self.tmp.cleanup()

    def found(self, *figs):
        slides = [page(1, *[use("figure", {"src": f"assets/{s}", "w": w, "h": h}) for s, w, h in figs])]
        return [(n, f) for _, n, f, _ in figbox.find(reader(self.deck, recording(slides)), self.deck)]

    def test_a_box_kept_at_the_placed_width(self):
        self.assertEqual(self.found(("a.svg", "681", "255"), ("c.svg", "300", "307")),
                         [("a.svg", "681×255"), ("c.svg", "300×307")])

    def test_a_capture_at_the_full_measure_and_at_its_printed_width(self):
        self.assertEqual(self.found(("s.png", "681", "446")), [("s.png", "681×446")])
        self.assertEqual(self.found(("s.png", "613", "402")), [])

    def test_a_box_the_size_of_the_picture(self):
        self.assertEqual(self.found(("a.svg", "613", "255"), ("c.svg", "270", "306")), [])


if __name__ == "__main__":
    unittest.main()
