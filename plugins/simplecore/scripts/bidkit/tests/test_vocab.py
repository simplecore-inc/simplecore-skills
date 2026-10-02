import json
import tempfile
import unittest
from pathlib import Path

from bidkit.config import ConfigError
from bidkit.vocab import KITS_DIR, Vocabulary, json_items, read_slots

from .support import project


class VocabularyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.deck = project(self.root, {})

    def tearDown(self):
        self.tmp.cleanup()

    def test_every_kit_file_parses(self):
        files = sorted(KITS_DIR.glob("*.json"))
        self.assertTrue(files)
        for path in files:
            Vocabulary.for_deck(project(self.root, {"vocabulary": path.stem}))

    def test_slot_forms(self):
        v = Vocabulary.for_deck(self.deck)
        self.assertEqual(list(v.values("name", "page", {"title": "가. 제목", "sub": "x"})),
                         [("title", "가. 제목")])
        items = json.dumps([{"label": "처리량", "value": "1"}, {"label": "지연"}], ensure_ascii=False)
        self.assertEqual([x for _, x in v.values("name", "stat-grid", {"items": items})], ["처리량", "지연"])
        rows = json.dumps([["구분", "값"], ["가", "1"]], ensure_ascii=False)
        self.assertEqual([x for _, x in v.values("name", "table", {"rows": rows})], ["구분", "값"])
        self.assertEqual(list(v.values("name", "stat-grid", {"items": "not json"})), [])
        self.assertIn("text", v.args("prose"))
        self.assertEqual(v.pages()["head"]["component"], "sg-master-head")

    def test_any_slot_table_reads_like_slots(self):
        items = json.dumps([{"term": "가", "definition": "뜻이다."}], ensure_ascii=False)
        self.assertEqual(list(read_slots(["items[].definition", "missing"], {"items": items})),
                         [("items.definition", "뜻이다.")])
        self.assertEqual(json_items(items), [{"term": "가", "definition": "뜻이다."}])
        self.assertEqual(json_items('{"a": 1}'), [])

    def test_project_override_replaces_a_component(self):
        (self.root / "vocab.json").write_text(json.dumps(
            {"slots": {"name": {"keyrow": ["value"], "my-card": ["head"]}}, "pages": {"masters": {"body": ["MAIN"]}}}))
        deck = project(self.root, {"vocabulary": {"kit": "simplecore-proposal-01", "override": "vocab.json"}})
        v = Vocabulary.for_deck(deck)
        self.assertEqual(list(v.values("name", "keyrow", {"label": "a", "value": "b"})), [("value", "b")])
        self.assertIn("my-card", v.components("name"))
        self.assertEqual(v.pages()["masters"]["body"], ["MAIN"])
        self.assertEqual(v.pages()["masters"]["annex"], ["ANNEX"])

    def test_bad_slot_and_unknown_kit_are_errors(self):
        (self.root / "bad.json").write_text(json.dumps({"slots": {"name": {"x": ["items[]"]}}}))
        with self.assertRaises(ConfigError):
            Vocabulary.for_deck(project(self.root, {"vocabulary": {"file": "bad.json"}}))
        with self.assertRaises(ConfigError):
            Vocabulary.for_deck(project(self.root, {"vocabulary": "no-such-kit"}))
        with self.assertRaises(ConfigError):
            Vocabulary.for_deck(project(self.root, {"vocabulary": "../escape"}))


if __name__ == "__main__":
    unittest.main()
