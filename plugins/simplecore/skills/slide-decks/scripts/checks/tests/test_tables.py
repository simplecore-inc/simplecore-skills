"""coltotal and samecol over printed tables, a continued table included."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE.parents[4] / "scripts"))

import coltotal  # noqa: E402
import samecol  # noqa: E402
from bidkit.baseline import Baseline  # noqa: E402
from bidkit.tests.support import body, project, reader, recording  # noqa: E402

LABELS = set(coltotal.TOTAL_LABELS)
HEAD = ["구분", "건수", "비고"]


class ColTotalTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.deck = project(Path(self.tmp.name), {})

    def tearDown(self):
        self.tmp.cleanup()

    def test_wrong_total_is_reported(self):
        rows = [HEAD, ["가", "10", "a"], ["나", "20", "b"], ["합계", "40", ""]]
        totals, bad = coltotal.find(reader(self.deck, recording(slides=[body(1, 3, 1, [rows])])), self.deck)
        self.assertEqual(totals, 1)
        self.assertEqual(bad, [("Ⅲ-1 01", 1, "건수", 30.0, 40.0)])

    def test_right_total_and_worded_cell_are_quiet(self):
        right = [HEAD, ["가", "1,000", "a"], ["나", "2,000", "b"], ["합계", "3,000", ""]]
        worded = [HEAD, ["가", "10", "a"], ["나", "위와 같음", "b"], ["합계", "99", ""]]
        totals, bad = coltotal.find(reader(self.deck, recording(slides=[body(1, 3, 1, [right, worded])])),
                                    self.deck)
        self.assertEqual((totals, bad), (2, []))

    def test_continued_table_total_checks_every_piece(self):
        first = [HEAD, ["가", "10", "a"], ["나", "20", "b"]]
        second = [HEAD, ["다", "5", "c"], ["합계", "35", ""]]
        r = reader(self.deck, recording(slides=[body(1, 3, 1, [first]), body(2, 3, 1, [second])]))
        # Read piece by piece, the last piece's total disagrees with its own rows.
        unjoined = [coltotal.mismatches(g, LABELS, 0.5) for _, _, g in r.tables()]
        self.assertEqual(unjoined, [None, [("건수", 5.0, 35.0)]])
        self.assertEqual(coltotal.find(r, self.deck), (1, []))

    def test_configured_total_labels(self):
        self.deck.data["checks"] = {"coltotal": {"totalLabels": ["Total"]}}
        rows = [HEAD, ["a", "1", ""], ["b", "1", ""], ["Total", "3", ""]]
        _, bad = coltotal.find(reader(self.deck, recording(slides=[body(1, 3, 1, [rows])])), self.deck)
        self.assertEqual(len(bad), 1)


class SameColTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "baselines").mkdir()
        self.deck = project(self.root, {"checks": {"baselines": "baselines"}})

    def tearDown(self):
        self.tmp.cleanup()

    def found(self, slides):
        return samecol.uniform_columns(reader(self.deck, recording(slides=slides)), self.deck)[1]

    def test_uniform_column_is_reported_and_blank_is_not(self):
        rows = [["역할", "조회", "비고"], ["가", "전체", "-"], ["나", "전체", "-"], ["다", "전체", "-"]]
        self.assertEqual(self.found([body(1, 3, 1, [rows])]), [("Ⅲ-1 01", 1, "조회", "전체", 3)])

    def test_continued_table_varying_only_on_its_first_piece(self):
        first = [["단계", "담당"], ["분석", "발주사"], ["설계", "제안사"], ["구현", "제안사"]]
        second = [["단계", "담당"], ["시험", "제안사"], ["인계", "제안사"], ["운영", "제안사"]]
        r = reader(self.deck, recording(slides=[body(1, 3, 1, [first]), body(2, 3, 1, [second])]))
        # Read per page, the second piece alone holds one value in 담당.
        per_page = [samecol.uniform_in(g) for _, _, g in r.tables()]
        self.assertEqual(per_page, [[], [("담당", "제안사", 3)]])
        self.assertEqual(samecol.uniform_columns(r, self.deck), (1, []))

    def write_baseline(self, data):
        (self.root / "baselines" / "samecol.json").write_text(json.dumps(data, ensure_ascii=False),
                                                              encoding="utf-8")
        return Baseline.for_check(self.deck, "samecol", samecol.migrate)

    def test_baseline_reason_rules(self):
        found = [("Ⅲ-1 01", 1, "조회", "전체", 3), ("Ⅲ-1 01", 1, "출력", "허용", 3),
                 ("Ⅲ-1 02", 1, "성명", "***", 4), ("Ⅲ-1 03", 2, "M", "●", 3)]
        b = self.write_baseline({
            "Ⅲ-1 01\t1\t조회\t전체": "reading is unrestricted for every role",
            "Ⅲ-1 01\t1\t출력\t허용": "",
            "Ⅲ-1 02\t1\t성명": "***",                         # legacy bare value
            "Ⅲ-1 03\t2\tM": {"값": "○", "사유": "since changed"},  # legacy, value changed
        })
        live, owed = samecol.judge(found, b)
        self.assertEqual(live, [("Ⅲ-1 03", 2, "M", "●", 3)])
        self.assertEqual(owed, [("Ⅲ-1 01", 1, "출력", "허용", 3)])

    def test_a_legacy_baseline_is_read_by_migrate_and_blessed_into_the_current_keys(self):
        found = [("Ⅲ-1 01", 1, "조회", "전체", 3), ("Ⅲ-1 02", 1, "성명", "***", 4),
                 ("Ⅲ-1 03", 2, "M", "●", 3), ("Ⅲ-1 04", 1, "등급", "A", 3)]
        b = self.write_baseline({
            "Ⅲ-1 01\t1\t조회": {"값": "전체", "사유": "reading is unrestricted for every role"},
            "Ⅲ-1 02\t1\t성명": {"값": "***", "사유": ""},              # reason still owed
            "Ⅲ-1 03\t2\tM": "●",                                      # bare legacy value
            "Ⅲ-1 04\t1\t등급\tA": {"사유": "one grade is the claim"},  # current key, legacy reason name
        })
        live, owed = samecol.judge(found, b)
        self.assertEqual(live, [])
        self.assertEqual(owed, [("Ⅲ-1 02", 1, "성명", "***", 4)])
        b.bless({samecol.key(*f[:4]): None for f in found})
        written = json.loads((self.root / "baselines" / "samecol.json").read_text(encoding="utf-8"))
        self.assertEqual(written, {"Ⅲ-1 01\t1\t조회\t전체": "reading is unrestricted for every role",
                                   "Ⅲ-1 02\t1\t성명\t***": "",
                                   "Ⅲ-1 03\t2\tM\t●": None,
                                   "Ⅲ-1 04\t1\t등급\tA": "one grade is the claim"})
        self.assertNotIn("사유", json.dumps(written, ensure_ascii=False))
        self.assertNotIn("값", json.dumps(written, ensure_ascii=False))


if __name__ == "__main__":
    unittest.main()
