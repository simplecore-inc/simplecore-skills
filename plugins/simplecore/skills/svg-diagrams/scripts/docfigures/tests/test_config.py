"""The settings file: JSONC that keeps strings intact, and required values."""
import json
import unittest

from helpers import BASE_CONFIG, Project, figconfig


class Jsonc(unittest.TestCase):
    def test_comment_after_a_url_value_keeps_the_url(self):
        text = '{\n  "server": "http://127.0.0.1:7333/mcp", // note\n  "a": [1, 2,],\n}'
        self.assertEqual(json.loads(figconfig.strip_jsonc(text)),
                         {"server": "http://127.0.0.1:7333/mcp", "a": [1, 2]})

    def test_block_comment_and_escaped_quote(self):
        text = '{"q": "a \\" // b", /* gone */ "n": 1}'
        self.assertEqual(json.loads(figconfig.strip_jsonc(text)), {"q": 'a " // b', "n": 1})

    def test_a_line_stripper_would_break_the_url(self):
        # the broken form: cutting every line at its first // loses the value
        line = '  "server": "http://127.0.0.1:7333/mcp", // note'
        self.assertNotIn("7333", line.split("//")[0])
        self.assertIn("7333", figconfig.strip_jsonc(line))

    def test_unterminated_comment_is_a_config_error_naming_the_file(self):
        p = Project()
        p.config_path.write_text('{"out": "figures" /* open', encoding="utf-8")
        with self.assertRaisesRegex(figconfig.ConfigError, "unterminated"):
            p.cfg()
        p.close()


class Required(unittest.TestCase):
    def test_missing_ladder_raises(self):
        p = Project()
        data = dict(BASE_CONFIG)
        del data["ladder"]
        p.config_path.write_text(json.dumps(data), encoding="utf-8")
        with self.assertRaisesRegex(figconfig.ConfigError, "'ladder'"):
            p.cfg()
        p.close()

    def test_helper_name_missing_raises(self):
        names = {k: v for k, v in BASE_CONFIG["names"].items() if k != "BODY"}
        p = Project(names=names)
        with self.assertRaisesRegex(figconfig.ConfigError, "BODY"):
            p.cfg()
        p.close()

    def test_name_off_the_ladder_raises(self):
        p = Project(names=dict(BASE_CONFIG["names"], BODY=19))
        with self.assertRaisesRegex(figconfig.ConfigError, "off the ladder"):
            p.cfg()
        p.close()

    def test_complete_config_loads(self):
        p = Project()
        cfg = p.cfg()
        self.assertEqual(cfg.default_board, 1200)
        self.assertEqual(cfg.names["CHIP"], 21)
        self.assertEqual(cfg.out.resolve(), (p.root / "figures").resolve())
        p.close()


class Verdict(unittest.TestCase):
    def test_hues_read_from_another_config_by_key(self):
        p = Project(verdict={"from": ".claude/slide-decks.json",
                             "key": "decks.talk.checks.verdict"})
        p.write(".claude/slide-decks.json",
                '{"decks": {"talk": {"checks": {"verdict": {"pass": "507C39", '
                '"block": "B6382B"}}}}} // trailing note')
        self.assertEqual(p.cfg().verdict, ("#507C39", "#B6382B"))
        p.close()

    def test_bad_hue_raises(self):
        p = Project(verdict={"pass": "green", "block": "#B6382B"})
        with self.assertRaises(figconfig.ConfigError):
            _ = p.cfg().verdict
        p.close()


if __name__ == "__main__":
    unittest.main()
