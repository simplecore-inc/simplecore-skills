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
