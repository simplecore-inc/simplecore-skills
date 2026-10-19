"""The rules audit.py gained: contrast, drop into a gap, overlapping lines,
and connector calls that inherit the default arrowhead."""
import tempfile
import unittest
from pathlib import Path

from helpers import svg, text

import audit  # noqa: E402  (helpers puts the toolkit on the path)
import lintrules  # noqa: E402

ROW = ('<rect x="100" y="200" width="400" height="80" fill="#fff" stroke="#000" stroke-width="1.4"/>'
       '<rect x="700" y="200" width="400" height="80" fill="#fff" stroke="#000" stroke-width="1.4"/>')


def drop(x, y2=192):
    return (f'<line x1="{x}" y1="100" x2="{x}" y2="{y2}" stroke="#000" stroke-width="1.4" '
            f'marker-end="url(#arr-muted)"/>')


class DropIntoGap(unittest.TestCase):
    def test_drop_between_two_cards_fails(self):
        found = lintrules.drop_into_gap(svg(ROW + drop(600)))
        self.assertEqual([k for k, _m in found], ["DROP-INTO-GAP"])

    def test_drop_onto_a_card_passes(self):
        self.assertEqual(lintrules.drop_into_gap(svg(ROW + drop(300))), [])

    def test_drop_that_forks_into_legs_passes(self):
        fork = ('<line x1="600" y1="100" x2="600" y2="160" stroke="#000" stroke-width="1.4" '
                'marker-end="url(#arr-muted)"/>'
                '<line x1="300" y1="160" x2="900" y2="160" stroke="#000" stroke-width="1.4"/>')
        self.assertEqual(lintrules.drop_into_gap(svg(ROW + fork)), [])


class LineOverlaps(unittest.TestCase):
    def test_two_lines_on_top_of_each_other_fail(self):
        body = ('<line x1="40" y1="100" x2="400" y2="100" stroke="#000" stroke-width="1.4"/>'
                '<line x1="200" y1="101" x2="600" y2="101" stroke="#0a0" stroke-width="1.4"/>')
        self.assertEqual([k for k, _m in lintrules.line_overlaps(svg(body))],
                         ["COINCIDENT-LINES"])

    def test_route_doubling_back_fails(self):
        body = ('<path d="M 40 100 H 400 H 200" fill="none" stroke="#000" '
                'stroke-width="1.4" marker-end="url(#arr-muted)"/>')
        self.assertEqual([k for k, _m in lintrules.line_overlaps(svg(body))],
                         ["SELF-DOUBLED"])

    def test_separated_lines_and_fill_only_bands_pass(self):
        body = ('<line x1="40" y1="100" x2="400" y2="100" stroke="#000" stroke-width="1.4"/>'
                '<line x1="200" y1="112" x2="600" y2="112" stroke="#0a0" stroke-width="1.4"/>'
                '<path d="M 270 52 H 40 V 122 H 270 Z" fill="#1b4a9c" opacity="0.12"/>'
                '<path d="M 270 122 H 40 V 192 H 270 Z" fill="#1b4a9c" opacity="0.12"/>')
        self.assertEqual(lintrules.line_overlaps(svg(body)), [])


class Contrast(unittest.TestCase):
    BAND = '<rect x="40" y="40" width="600" height="80" fill="#507c39" stroke="none"/>'

    def found(self, label_fill):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "c.svg"
            path.write_text(svg(self.BAND + text(60, 90, "판정 통과", fill=label_fill),
                                w=700, h=160), encoding="utf-8")
            return lintrules.contrast(str(path), audit._render_quiet, audit._text_w)

    def test_label_lost_on_its_band_fails(self):
        self.assertEqual([k for k, _m in self.found("#5f8a4a")], ["LOW-CONTRAST"])

    def test_label_that_clears_its_band_passes(self):
        self.assertEqual(self.found("#ffffff"), [])


class LargeTextFloor(unittest.TestCase):
    # #888888 on white is 3.5:1: under the 4.5 small text needs, over the 3.0
    # large text needs
    def found(self, px_per_unit, weight=None, **floors):
        label = text(60, 90, "판정 통과", fill="#888888")
        if weight:
            label = label.replace("<text ", f'<text font-weight="{weight}" ', 1)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "c.svg"
            path.write_text(svg(label, w=700, h=160), encoding="utf-8")
            return [k for k, _m in lintrules.contrast(
                str(path), audit._render_quiet, audit._text_w,
                px_per_unit=px_per_unit, **floors)]

    def test_label_printed_small_takes_the_text_floor(self):
        self.assertEqual(self.found(0.5, floor=4.5, large_floor=3.0), ["LOW-CONTRAST"])
        self.assertEqual(self.found(0.8, floor=4.5, large_floor=3.0), ["LOW-CONTRAST"])

    def test_label_printed_large_or_bold_and_large_enough_takes_the_large_floor(self):
        self.assertEqual(self.found(1.0, floor=4.5, large_floor=3.0), [])
        self.assertEqual(self.found(0.8, weight="700", floor=4.5, large_floor=3.0), [])

    def test_one_floor_holds_every_label_whatever_its_size(self):
        self.assertEqual(self.found(1.0, floor=4.5), ["LOW-CONTRAST"])
        self.assertEqual(self.found(0.5, floor=3.0), [])


class MarkerDefaults(unittest.TestCase):
    def found(self, source):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "m.py"
            path.write_text(source, encoding="utf-8")
            return lintrules.marker_defaults(path)

    def test_call_with_no_marker_fails(self):
        found = self.found('c.line(0, 0, 10, 0, color="#000")\n')
        self.assertEqual([k for k, _m in found], ["MARKER-DEFAULT"])

    def test_call_that_states_its_marker_or_forwards_keywords_passes(self):
        self.assertEqual(self.found('c.line(0, 0, 10, 0, marker=None)\n'
                                    'c.path("M 0 0 H 9", marker=c.blue)\n'
                                    'c.line(0, 0, 1, 1, **kw)\n'), [])



class EdgePills(unittest.TestCase):
    def found(self, source):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "m.py"
            path.write_text(source, encoding="utf-8")
            return [k for k, _m in lintrules.edge_pills(path)]

    def test_label_on_the_toolkit_pill_fails(self):
        self.assertEqual(self.found('c.edge_label(600, 120, "요청", color=c.blue)\n'
                                    'c.edge_label(600, 160, "응답", pill=True)\n'
                                    'c.edge_label(1, 2, "a", "#000", 12, False, True)\n'),
                         ["EDGE-PILL"] * 3)

    def test_library_label_bare_label_and_unjudged_calls_pass(self):
        self.assertEqual(self.found('import common\n'
                                    'edge_label(c, 600, 120, "요청", BLUE)\n'
                                    'common.edge_label(c, 1, 2, "a", BLUE)\n'
                                    'c.edge_label(1, 2, "a", pill=False)\n'
                                    'c.edge_label(1, 2, "a", "#000", 12, False, False)\n'
                                    'c.edge_label(1, 2, "a", pill=draw)\n'
                                    'c.edge_label(1, 2, "a", **kw)\n'), [])


if __name__ == "__main__":
    unittest.main()


class EndpointOnDisc(unittest.TestCase):
    """A connector ending on a numbered disc's outline is attached to it."""

    def lint(self, body):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "a.svg"
            p.write_text(svg(body), encoding="utf-8")
            return [kind for kind, _msg in audit.lint(str(p))]

    DISCS = ('<circle cx="100" cy="100" r="17" fill="#1b4a9c"/>'
             '<circle cx="100" cy="200" r="17" fill="#1b4a9c"/>')

    def test_arrow_between_discs_passes(self):
        arrow = ('<line x1="100" y1="117" x2="100" y2="183" stroke="#000" '
                 'stroke-width="1.9" marker-end="url(#arr-muted)"/>')
        self.assertNotIn("FLOATING-ENDPOINT", self.lint(self.DISCS + arrow))

    def test_arrow_stopping_short_of_a_disc_fails(self):
        arrow = ('<line x1="100" y1="117" x2="100" y2="160" stroke="#000" '
                 'stroke-width="1.9" marker-end="url(#arr-muted)"/>')
        self.assertIn("FLOATING-ENDPOINT", self.lint(self.DISCS + arrow))


class EscapedText(unittest.TestCase):
    def test_an_entity_is_measured_as_the_glyph_it_prints(self):
        body = '<text x="10" y="20" font-size="15">&lt;P&gt;&lt;R&gt;Q3&lt;/R&gt;&lt;/P&gt;</text>'
        found = [t for _a, t in audit._iter_texts(svg(body))]
        self.assertEqual(found, ["<P><R>Q3</R></P>"])


def _lint(body):
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "a.svg"
        p.write_text(svg(body), encoding="utf-8")
        return [kind for kind, _msg in audit.lint(str(p))]


class NumberOnDisc(unittest.TestCase):
    """A filled disc drawn over a line backs the number set in it."""

    LINE = '<line x1="40" y1="100" x2="400" y2="100" stroke="#333" stroke-width="2"/>'
    DISC = ('<circle cx="200" cy="100" r="16" fill="#1b4a9c"/>'
            '<text x="200" y="107" font-size="21" fill="#fff" text-anchor="middle">4</text>')

    def test_disc_drawn_after_the_line_passes(self):
        self.assertNotIn("TEXT-ON-LINE", _lint(self.LINE + self.DISC))

    def test_line_drawn_after_the_disc_fails(self):
        self.assertIn("TEXT-ON-LINE", _lint(self.DISC + self.LINE))


class StackInsideFrame(unittest.TestCase):
    """The sheets of stack_behind() are ink inside the frame that holds the box."""

    FRAME = '<path d="M 100 100 H 500 V 320 H 100 Z" fill="none" stroke="#1b4a9c" stroke-width="1.9"/>'
    BOX = ('<rect x="120" y="134" width="360" height="166" fill="#fff" stroke="#1b4a9c" '
           'stroke-width="1.9"/><text x="140" y="170" font-size="21">Proxy G/W</text>')

    def sheet(self, tagged):
        tag = 'data-stack="1" ' if tagged else ''
        return (f'<path {tag}d="M 134 134 V 120 H 466 V 134" fill="none" stroke="#1b4a9c" '
                f'stroke-width="1.4"/>')

    def test_frame_measured_to_the_tagged_sheets_passes(self):
        self.assertNotIn("FRAME-PADDING-UNEVEN", _lint(self.FRAME + self.sheet(True) + self.BOX))

    def test_frame_measured_to_the_box_alone_fails(self):
        self.assertIn("FRAME-PADDING-UNEVEN", _lint(self.FRAME + self.sheet(False) + self.BOX))


class DeclaredUnderline(unittest.TestCase):
    """An underline drawn as a line is part of its words, once it says so."""

    HEAD = '<text x="28" y="40" font-size="26" font-weight="700">단계 완료 기준 · 판정</text>'
    BOX = '<rect x="28" y="56" width="400" height="80" rx="8" fill="#eef2fa" stroke="#1b4a9c" stroke-width="1.9"/>'

    def test_undeclared_underline_reads_as_what_the_label_sits_on(self):
        line = '<line x1="90" y1="44.4" x2="190" y2="44.4" stroke="#14161c" stroke-width="1.9"/>'
        self.assertIn("LABEL-GROUPING", _lint(self.HEAD + line + self.BOX))

    def test_declared_underline_is_part_of_the_words(self):
        line = ('<line x1="90" y1="44.4" x2="190" y2="44.4" stroke="#14161c" stroke-width="1.9" '
                'data-underline="1"/>')
        self.assertNotIn("LABEL-GROUPING", _lint(self.HEAD + line + self.BOX))
