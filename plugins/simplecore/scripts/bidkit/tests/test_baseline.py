import json
import tempfile
import unittest
from pathlib import Path

from bidkit.baseline import LIVE, RETIRED, UNREASONED, Baseline
from bidkit.config import ConfigError

from .support import project


class BaselineTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, data) -> Path:
        path = self.dir / "check.json"
        path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        return path

    def test_blank_reason_fails(self):
        b = Baseline.load(self.write({"finding": "", "spaces": "   "}))
        self.assertEqual(b.verdict("finding"), UNREASONED)
        self.assertEqual(b.verdict("spaces"), UNREASONED)
        self.assertEqual(b.unreasoned(), ["finding", "spaces"])

    def test_entry_with_reason_is_retired(self):
        b = Baseline.load(self.write({"finding": "the sameness is the claim"}))
        self.assertEqual(b.verdict("finding"), RETIRED)
        self.assertEqual(b.verdict("other"), LIVE)

    def test_legacy_bare_ratio_is_grandfathered_while_unchanged(self):
        b = Baseline.load(self.write({"pair": 0.71}))
        self.assertEqual(b.verdict("pair", 0.71), RETIRED)
        self.assertEqual(b.verdict("pair", 0.8), LIVE)

    def test_legacy_list_is_grandfathered(self):
        b = Baseline.load(self.write(["a\tb", "c\td"]))
        self.assertEqual(b.verdict("a\tb"), RETIRED)
        self.assertEqual(b.verdict("e"), LIVE)

    def test_legacy_value_set_compares_as_stored(self):
        b = Baseline.load(self.write({"fact": ["1", "8"]}))
        self.assertEqual(b.verdict("fact", ["1", "8"]), RETIRED)
        self.assertEqual(b.verdict("fact", ("1", "8")), RETIRED)
        self.assertEqual(b.verdict("fact", ["1", "9"]), LIVE)

    def test_reason_with_measure(self):
        b = Baseline.load(self.write({"pair": {"reason": "judged", "measure": 0.7}}))
        self.assertEqual(b.verdict("pair", 0.7), RETIRED)
        self.assertEqual(b.verdict("pair", 0.9), LIVE)

    def test_the_shared_loader_reads_no_check_s_own_key_names(self):
        # Other names for the reason and the measure are one check's legacy, translated by its migrate.
        b = Baseline.load(self.write({"old": {"값": "●", "사유": "위와 같다."}}))
        self.assertIsNone(b.entries["old"].reason)
        self.assertFalse(b.entries["old"].has_measure)

    def test_bless_keeps_reasons_and_writes_new_findings_blank(self):
        path = self.write({"kept": "a reason", "legacy": None, "moved": {"reason": "r", "measure": 1},
                           "gone": "no longer found"})
        b = Baseline.load(path)
        owed = b.bless({"kept": None, "legacy": None, "moved": 2, "new": None})
        self.assertEqual(owed, ["moved", "new"])
        written = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(written, {"kept": "a reason", "legacy": None,
                                   "moved": {"reason": "", "measure": 2}, "new": ""})
        self.assertEqual(Baseline.load(path).verdict("new"), UNREASONED)

    def test_directory_comes_from_the_declaration(self):
        deck = project(self.dir, {})
        with self.assertRaises(ConfigError):
            Baseline.for_check(deck, "samecol")
        deck.data["checks"] = {"baselines": "baselines"}
        with self.assertRaises(ConfigError):
            Baseline.for_check(deck, "samecol")            # declared but absent
        (self.dir / "baselines").mkdir()
        b = Baseline.for_check(deck, "samecol")
        self.assertEqual(b.path, self.dir.resolve() / "baselines" / "samecol.json")
        self.assertEqual(b.entries, {})


if __name__ == "__main__":
    unittest.main()
