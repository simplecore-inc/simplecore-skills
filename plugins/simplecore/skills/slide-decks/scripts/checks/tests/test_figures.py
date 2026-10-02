"""figures: a value quoted from another part is printed in that part."""
import tempfile
import unittest
from pathlib import Path

from fixtures import page, project, reader, recording, table, text

import figures


class FiguresTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.deck = project(Path(self.tmp.name), {})
        self.first = page(1, text("시험 593건을 수행했다."), part=1)

    def tearDown(self):
        self.tmp.cleanup()

    def found(self, *slides):
        return [(w, p, v, u) for w, p, v, u, _ in figures.find(reader(self.deck, recording(list(slides))), self.deck)]

    def test_a_quoted_value_the_part_no_longer_prints(self):
        self.assertEqual(self.found(self.first, page(2, text("Ⅰ에서 인용한 시험 462건이다."))),
                         [("page 2", "Ⅰ", "462", "건")])
        self.assertEqual(self.found(self.first, page(2, text("Ⅰ부에서 인용한 시험 593 건이다."))), [])

    def test_a_quotation_in_a_table_cell_and_an_untypeset_part(self):
        cell = page(2, *table("tb", ["구분", "근거"], ["시험", "Ⅰ-2장에서 인용한 462건"]))
        self.assertEqual(self.found(self.first, cell), [("page 2", "Ⅰ", "462", "건")])
        self.assertEqual(self.found(self.first, page(2, text("Ⅴ에서 인용한 시험 12건"))), [])

    def test_the_claim_words_and_units_are_declared(self):
        self.deck.data["checks"] = {"figures": {"cite": "에서 옮긴", "units": ["회"]}}
        self.assertEqual(self.found(self.first, page(2, text("Ⅰ에서 옮긴 시험 4회"))), [("page 2", "Ⅰ", "4", "회")])
        self.assertEqual(self.found(self.first, page(2, text("Ⅰ에서 인용한 시험 462건"))), [])


if __name__ == "__main__":
    unittest.main()
