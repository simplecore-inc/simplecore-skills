import json
import os
import re
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from bidkit.config import ConfigError, Project, find_config, parse_jsonc, strip_jsonc

SAMPLE = """{
  // a comment line
  "decks": {
    "proposal": {
      "dir": "pptx",            // a value line that ends in a note
      "kind": "document",
      "tool": { "server": "http://127.0.0.1:7333/mcp" },
      /* a block
         comment */
      "label": "a \\"quoted // not a comment\\" value"
    }
  }
}"""


def line_only_strip(text: str) -> str:
    """The line-based stripper a fork used: it strips whole comment lines only."""
    return re.sub(r"^\s*//.*$", "", text, flags=re.M)


class StripTests(unittest.TestCase):
    def test_line_only_stripper_breaks_on_a_trailing_note(self):
        with self.assertRaises(json.JSONDecodeError):
            json.loads(line_only_strip(SAMPLE))

    def test_string_aware_strip_parses_and_keeps_urls_intact(self):
        data = parse_jsonc(SAMPLE, "sample")
        deck = data["decks"]["proposal"]
        self.assertEqual(deck["tool"]["server"], "http://127.0.0.1:7333/mcp")
        self.assertEqual(deck["label"], 'a "quoted // not a comment" value')
        self.assertEqual(deck["dir"], "pptx")

    def test_block_comment_keeps_line_count(self):
        self.assertEqual(strip_jsonc("a/*x\ny*/b").count("\n"), 1)

    def test_unterminated_block_comment_is_an_error(self):
        with self.assertRaises(ConfigError):
            strip_jsonc('{"a": 1 /* open')

    def test_trailing_commas_outside_strings_are_dropped(self):
        text = '{\n  "a": [1, 2, // last\n  ],\n  "s": "x, ]",\n}'
        self.assertEqual(parse_jsonc(text, "sample"), {"a": [1, 2], "s": "x, ]"})


class ProjectTests(unittest.TestCase):
    def setUp(self):
        self.env = mock.patch.dict(os.environ)
        self.env.start()
        os.environ.pop("SLIDE_DECK", None)
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()
        (self.root / ".claude").mkdir()
        (self.root / "pptx" / "pages").mkdir(parents=True)
        (self.root / "slides").mkdir()
        decks = {"decks": {"proposal": {"dir": "pptx", "kind": "document",
                                        "checks": {"after": ["coltotal"]}},
                           "summary": {"dir": "slides", "kind": "slides"}}}
        (self.root / ".claude" / "slide-decks.json").write_text(json.dumps(decks), encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()
        self.env.stop()

    def test_found_by_walking_up(self):
        self.assertEqual(find_config(self.root / "pptx" / "pages"),
                         self.root / ".claude" / "slide-decks.json")

    def test_absent_declaration_is_an_error(self):
        with tempfile.TemporaryDirectory() as other:
            with self.assertRaises(ConfigError):
                find_config(Path(other))

    def test_required_key_absent_raises_and_names_it(self):
        deck = Project.load(self.root).deck("proposal")
        with self.assertRaises(ConfigError) as caught:
            deck.require("requirements.source", "the digest")
        self.assertIn("requirements.source", str(caught.exception))
        self.assertIn("proposal", str(caught.exception))

    def test_declared_path_that_does_not_exist_is_an_error(self):
        deck = Project.load(self.root).deck("proposal")
        deck.data["manuscript"] = "nowhere"
        with self.assertRaises(ConfigError):
            deck.path("manuscript")

    def test_present_key_is_returned(self):
        deck = Project.load(self.root).deck("proposal")
        self.assertEqual(deck.require("checks.after"), ["coltotal"])
        self.assertEqual(deck.dir, self.root / "pptx")
        self.assertEqual(deck.entry, self.root / "pptx" / "main.sgx")

    def test_resolution_by_name_cwd_and_kind(self):
        project = Project.load(self.root)
        self.assertEqual(project.deck("summary").name, "summary")
        self.assertEqual(project.deck(cwd=self.root / "slides").name, "summary")
        self.assertEqual(project.deck(cwd=self.root / "pptx" / "pages").name, "proposal")
        # Outside both decks: the only document deck.
        self.assertEqual(project.deck(cwd=self.root).name, "proposal")

    def test_environment_names_the_deck(self):
        with mock.patch.dict(os.environ, {"SLIDE_DECK": "summary"}):
            self.assertEqual(Project.load(self.root).deck(cwd=self.root).name, "summary")

    def test_unknown_name_and_ambiguity_are_refused(self):
        project = Project.load(self.root)
        with self.assertRaises(ConfigError):
            project.deck("missing")
        project.data["decks"]["annex"] = {"dir": "slides", "kind": "document"}
        with self.assertRaises(ConfigError):
            project.deck(cwd=self.root)


if __name__ == "__main__":
    unittest.main()
