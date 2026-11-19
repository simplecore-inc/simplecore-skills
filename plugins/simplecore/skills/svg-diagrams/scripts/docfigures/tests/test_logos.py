"""Logos placed from the project's logo directory.

The fixtures under `fixtures/logos/` are synthetic, each drawn for one case
the inliner must handle (gradients and clip paths with ids, class-coloured
styles, a viewBox off the origin, no viewBox, live text, editor output) or
refuse (a raster image, an external reference, an unresolvable selector, a
filter).
"""
import re
import unittest
from pathlib import Path

from helpers import Project

import svglogo
import verify
from figlib.checks_logos import logo_errors

FIX = Path(__file__).resolve().parent / "fixtures" / "logos"


class Inliner(unittest.TestCase):
    def test_ids_and_references_take_the_placement_prefix(self):
        m = svglogo.read_logo(FIX / "gradient-clip.svg").markup("lg-f-0", 0, 0, 80, 30)
        ids = set(re.findall(r'\bid="([^"]+)"', m))
        self.assertEqual(ids, {"lg-f-0", "lg-f-0-a", "lg-f-0-c", "lg-f-0-mark"})
        refs = set(re.findall(r'url\(#([^)]+)\)', m)) | set(re.findall(r'href="#([^"]+)"', m))
        self.assertEqual(refs, {"lg-f-0-a", "lg-f-0-c", "lg-f-0-mark"})
        self.assertIn('viewBox="20 10 160 60"', m)

    def test_one_logo_twice_resolves_under_two_prefixes(self):
        logo = svglogo.read_logo(FIX / "gradient-clip.svg")
        both = logo.markup("lg-f-0", 0, 0, 80, 30) + logo.markup("lg-f-1", 90, 0, 80, 30)
        ids = re.findall(r'\bid="([^"]+)"', both)
        self.assertEqual(len(ids), len(set(ids)))

    def test_class_styles_are_resolved_onto_each_element(self):
        a = svglogo.read_logo(FIX / "gradient-clip.svg").markup("p", 0, 0, 80, 30)
        b = svglogo.read_logo(FIX / "style-twin.svg").markup("q", 0, 0, 80, 40)
        for m in (a, b):
            self.assertNotIn("<style", m)
            self.assertNotIn("class=", m)
        self.assertIn("fill: #e63946", a)
        self.assertIn("fill: #1d3557; stroke: #a8dadc; stroke-width: 3", b)
        self.assertIn("fill: url(#q-a)", b)

    def test_missing_viewbox_comes_from_width_and_height(self):
        self.assertEqual(svglogo.read_logo(FIX / "no-viewbox.svg").viewbox, (0, 0, 120, 40))

    def test_editor_output_scripts_and_handlers_are_stripped(self):
        m = svglogo.read_logo(FIX / "editor-junk.svg").markup("p", 0, 0, 40, 40)
        for gone in ("script", "onload", "onclick", "metadata", "inkscape", "sodipodi",
                     "animate", "<title", "<desc", "data-name"):
            self.assertNotIn(gone, m)
        self.assertIn('fill="#ff006e"', m)       # the root's colour is kept

    def test_live_text_is_pinned_to_its_face(self):
        logo = svglogo.read_logo(FIX / "live-text.svg")
        self.assertTrue(logo.has_text)
        self.assertIn("font-family: Georgia, serif !important", logo.markup("p", 0, 0, 1, 1))

    def test_unsafe_logos_are_refused_with_the_reason(self):
        for name, says in (("raster", "raster"), ("external-ref", "external"),
                           ("external-url", "external"), ("complex-selector", "selector"),
                           ("filtered", "filter")):
            with self.subTest(name), self.assertRaisesRegex(svglogo.LogoError, says):
                svglogo.read_logo(FIX / f"{name}.svg")

    def test_opaque_view_is_one_named_box(self):
        m = svglogo.read_logo(FIX / "live-text.svg").markup("p", 10, 20, 80, 20)
        view = svglogo.opaque_view(f"<svg>{m}<text>x</text></svg>")
        self.assertEqual(view, '<svg><rect x="10" y="20" width="80" height="20" fill="none" '
                               'stroke="none" data-logo="live-text" data-measure="width"/>'
                               '<text>x</text></svg>')


class Placed(unittest.TestCase):
    def setUp(self):
        self.p = Project(logos={"dir": str(FIX), "height": 48})

    def tearDown(self):
        self.p.close()

    def build(self, body, ok=True):
        self.p.write("figs/case.py", "from common import *\nc = canvas(1200, 300)\n"
                     + body + "\nsave(c, 'case')\n")
        run = self.p.run("build.py")
        if ok:
            self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
        return run

    def svg(self):
        return self.p.root / "figures" / "case.svg"

    def test_missing_file_names_the_path(self):
        run = self.build("logo(c, 24, 24, 'no-such-logo')", ok=False)
        self.assertNotEqual(run.returncode, 0)
        self.assertIn(str(FIX / "no-such-logo.svg"), run.stderr)

    def test_saved_figure_carries_named_nested_svgs(self):
        self.build("logo_row(c, 24, 24, ['gradient-clip', 'style-twin', 'gradient-clip'], 1152)\n"
                   "c.rrect(24, 100, 1152, 60, fill='none', stroke=c.blue)")
        raw = self.svg().read_text()
        self.assertEqual(re.findall(r'data-logo="([^"]+)"', raw),
                         ["gradient-clip", "style-twin", "gradient-clip"])
        self.assertNotIn("data-logo-slot", raw)
        self.assertIn('id="lg-case-2-a"', raw)
        ids = re.findall(r'\bid="(lg-[^"]+)"', raw)
        self.assertEqual(len(ids), len(set(ids)))

    def test_no_check_reads_a_logos_insides(self):
        # live-text carries a Georgia label on no ladder rung and gradient-clip
        # carries strokes off the ladder: as figure content both would fail
        body = ("logo_row(c, 24, 24, ['live-text', 'gradient-clip', 'editor-junk'], 1152)\n"
                "card(c, 24, 100, 1152, c.blue, '제목', ['본문 한 줄'])")
        self.build(body)
        cfg = self.p.cfg()
        svgs = [self.svg()]
        self.assertEqual(verify.font_size_errors(svgs, cfg), [])
        self.assertEqual(verify.stroke_width_errors(svgs, cfg), [])
        self.assertNotIn("Lorem", [t for _a, t in verify.texts(self.svg())])
        self.assertEqual(verify.predicate_labels(svgs, cfg) or [], [])
        lint, _dead = verify.lint(svgs, cfg)
        self.assertFalse([ln for ln in lint if "✖" in ln], lint)
        # broken form: the same markup with the logo marks taken off
        raw = self.svg().read_text()
        self.svg().write_text(raw.replace("data-logo=", "data-x="))
        self.assertIn("Lorem", [t for _a, t in verify.texts(self.svg())])

    def test_floor_height(self):
        # at 0.5 px per unit a 12px floor needs 24 units
        self.build("logo(c, 24, 24, 'style-twin', h=20)\nlogo(c, 300, 24, 'style-twin', h=48)")
        found = logo_errors([self.svg()], self.p.cfg())
        self.assertEqual(len(found), 1)
        self.assertIn("10.0px", found[0][1])
        self.build("logo(c, 24, 24, 'style-twin', h=24)\nlogo(c, 300, 24, 'style-twin', h=48)")
        self.assertEqual(logo_errors([self.svg()], self.p.cfg()), [])

    def test_label_over_a_logo_and_logos_overlapping(self):
        self.build("logo(c, 24, 24, 'style-twin')\nc.text(40, 60, '겹친 글자', size=BODY)\n"
                   "logo(c, 60, 30, 'style-twin')")
        found = [f for _n, f in logo_errors([self.svg()], self.p.cfg())]
        self.assertTrue(any("set over logo" in f for f in found), found)
        self.assertTrue(any("overlap" in f for f in found), found)
        self.build("logo(c, 24, 24, 'style-twin')\nlogo_title(c, 300, 60, 'style-twin', '이름')")
        self.assertEqual(logo_errors([self.svg()], self.p.cfg()), [])

    def test_unresolved_placeholder_fails(self):
        self.build("logo(c, 24, 24, 'style-twin')")
        raw = self.svg().read_text()
        self.svg().write_text(raw.replace("</svg>", '<rect x="1" y="1" width="2" height="2" '
                                          'data-logo-slot="9"/></svg>', 1)[::1])
        self.assertTrue(any("placeholder" in f for _n, f in
                            logo_errors([self.svg()], self.p.cfg())))

    def test_logo_card_holds_its_logos(self):
        self.build("names = ['gradient-clip', 'style-twin']\n"
                   "logo_card(c, 24, 24, logo_row_w(names) + 32, c.blue, '플랫폼', names)")
        cfg = self.p.cfg()
        self.assertEqual(logo_errors([self.svg()], cfg), [])
        lint, _ = verify.lint([self.svg()], cfg)
        self.assertFalse([ln for ln in lint if "✖" in ln and "DEAD-MARGIN" not in ln], lint)

    def test_no_logos_key_is_not_configured(self):
        q = Project()
        try:
            q.write("figures/x.svg", '<svg width="1200" height="10" viewBox="0 0 1200 10"/>')
            self.assertIsNone(logo_errors([q.root / "figures" / "x.svg"], q.cfg()))
        finally:
            q.close()


if __name__ == "__main__":
    unittest.main()
