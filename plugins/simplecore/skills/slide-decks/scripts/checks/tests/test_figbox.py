"""figbox: a document figure's box is the size of the picture it prints."""
import tempfile
import unittest
from pathlib import Path

from fixtures import page, project, reader, recording, use
from runmain import run

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


class FigboxUnreadTests(unittest.TestCase):
    """A figure the check cannot measure is reported, and the summary counts what it measured."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        assets = root / "deck" / "assets"
        assets.mkdir(parents=True)
        (assets / "a.svg").write_text('<svg viewBox="0 0 1200 500"></svg>')
        (assets / "c.svg").write_text('<svg viewBox="0 0 520 600"></svg>')
        (assets / "wide.svg").write_text('<svg viewBox="0 0 880 400"></svg>')
        (assets / "bare.svg").write_text('<svg width="10" height="10"></svg>')
        self.deck = project(root, {"dir": "deck", "figures": {
            "boards": {"1200": 682, "520": 300, "520-pair": 327}, "placeScale": 0.9}})

    def tearDown(self):
        self.tmp.cleanup()

    def survey(self, *figs):
        uses = [use("figure", {"src": f"assets/{s}", **({"w": w, "h": h} if w else {})}) for s, w, h in figs]
        return figbox.survey(reader(self.deck, recording([page(1, *uses)])), self.deck)

    def test_a_missing_file_and_a_figure_on_no_board_are_findings(self):
        s = self.survey(("a.svg", "614", "256"), ("gone.svg", "614", "256"),
                        ("wide.svg", "614", "279"), ("bare.svg", "614", "256"))
        self.assertEqual(s.measured, 1)
        self.assertEqual(s.bad, [])
        self.assertEqual(s.missing, [("Ⅲ-1 01", "assets/gone.svg")])
        self.assertEqual([(n, why.split(",")[0]) for _, n, why in s.unplaced],
                         [("wide.svg", "its viewBox is 880 wide"), ("bare.svg", "no viewBox")])

    def test_a_clean_deck_and_an_unread_one_print_different_lines(self):
        code, out = run(figbox, self.deck, recording([page(1, use("figure", {"src": "assets/a.svg",
                                                                              "w": "614", "h": "256"}))]))
        self.assertEqual(code, 0)
        self.assertIn("1 figures measured, 0 whose box", out)
        code, out = run(figbox, self.deck, recording([page(1, use("figure", {"src": "assets/gone.svg",
                                                                              "w": "614", "h": "256"}))]))
        self.assertEqual(code, 1)
        self.assertIn("0 figures measured", out)
        self.assertIn("assets/gone.svg is placed and does not exist", out)

    def test_a_use_with_no_box_is_counted_as_not_measured(self):
        s = self.survey(("a.svg", None, None))
        self.assertEqual((s.measured, s.unsized, s.bad), (0, [("Ⅲ-1 01", "a.svg")], []))

    def test_a_board_variant_is_a_second_placement_of_the_same_board(self):
        # 520 units at 300 px or, beside a partner, at 327 px; 0.9 of either is the box
        s = self.survey(("c.svg", "270", "311"), ("c.svg", "294.3", "339.6"), ("c.svg", "300", "346"))
        self.assertEqual(s.measured, 3)
        self.assertEqual([found for _, _, found, _ in s.bad], ["300×346"])


class FigboxPerDeckScaleTests(unittest.TestCase):
    """A slide deck at 1.0, with 0.95 only for a figure taller than its slot at 1.0."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        (root / "deck" / "assets").mkdir(parents=True)
        # 1200 units on a 681 px board: 500 tall prints 284 at 1.0, over the 275 slot
        (root / "deck" / "assets" / "tall.svg").write_text('<svg viewBox="0 0 1200 500"></svg>')
        # 400 tall prints 227 at 1.0, inside the slot
        (root / "deck" / "assets" / "low.svg").write_text('<svg viewBox="0 0 1200 400"></svg>')
        self.root = root

    def tearDown(self):
        self.tmp.cleanup()

    def found(self, cfg, *figs):
        deck = project(self.root, {"dir": "deck", **cfg})
        slides = [page(1, *[use("figure", {"src": f"assets/{s}", "w": w, "h": h}) for s, w, h in figs])]
        return [(n, f) for _, n, f, _ in figbox.find(reader(deck, recording(slides)), deck)]

    SLIDES = {"kind": "slides",
              "figures": {"boards": {"1200": 681}, "oversizeScale": 0.95, "slots": {"1200": 275}}}

    def test_a_slide_deck_places_at_full_size_by_default(self):
        self.assertEqual(self.found(self.SLIDES, ("low.svg", "681", "227")), [])
        self.assertEqual(self.found(self.SLIDES, ("low.svg", "613", "204")), [("low.svg", "613×204")])

    def test_the_oversize_scale_only_where_the_figure_does_not_fit(self):
        self.assertEqual(self.found(self.SLIDES, ("tall.svg", "647", "270")), [])
        self.assertEqual(self.found(self.SLIDES, ("low.svg", "647", "216")), [("low.svg", "647×216")])

    def test_a_figure_that_does_not_fit_is_not_kept_at_full_size_or_shrunk_further(self):
        self.assertEqual(self.found(self.SLIDES, ("tall.svg", "681", "284"), ("tall.svg", "613", "255")),
                         [("tall.svg", "681×284"), ("tall.svg", "613×255")])

    def test_no_oversize_scale_means_no_oversize_figure(self):
        cfg = {"kind": "slides", "figures": {"boards": {"1200": 681}, "slots": {"1200": 275}}}
        self.assertEqual(self.found(cfg, ("tall.svg", "647", "270")), [("tall.svg", "647×270")])

    def test_a_document_deck_defaults_to_0_9(self):
        cfg = {"kind": "document", "figures": {"boards": {"1200": 681}}}
        self.assertEqual(self.found(cfg, ("low.svg", "613", "204")), [])
        self.assertEqual(self.found(cfg, ("low.svg", "681", "227")), [("low.svg", "681×227")])

    def test_an_exception_names_the_file(self):
        cfg = {**self.SLIDES, "checks": {"figbox": {"exceptions": {"low.svg": "cover band"}}}}
        self.assertEqual(self.found(cfg, ("low.svg", "500", "167")), [])


if __name__ == "__main__":
    unittest.main()
