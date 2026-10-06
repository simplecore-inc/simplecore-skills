"""Every declaration key a shared check reads is named in references/config.md.

config.md is the key schema a project configures its deck from. A key that
lives only in a check's docstring, or only in checks.md, is a key nobody sets:
the project copies the schema and the check keeps its default without anyone
having decided it. The shared checks' sources are read for the keys they take
from the deck (`deck.get("a.b")`, `deck.require`, `deck.has`, `deck.path`,
`deck.section`) and for the options read off a section (`cfg = deck.section(
"checks.x")`, then `cfg.get("y")`), and each key's last segment has to stand
in config.md as a segment of a code span (`checks.foothole.footBands`,
`footBands`) or as a key of the Shape block (`"footBands":`).
"""
import re
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
PLUGIN = HERE.parents[4]
CONFIG_MD = PLUGIN / "skills" / "slide-decks" / "references" / "config.md"
SOURCES = [PLUGIN / "skills" / "slide-decks" / "scripts" / "checks",
           PLUGIN / "skills" / "proposal-writing" / "scripts",
           PLUGIN / "scripts" / "bidkit"]

DIRECT = re.compile(r'\bdeck\.(?:get|require|has|path|section)\(\s*"([A-Za-z][\w.]*)"')
SECTION = re.compile(r'(\w+)\s*=\s*deck\.section\(\s*"([\w.]+)"\s*\)')


def keys_read(source: str) -> set[str]:
    """Every declaration key a check's source reads, sections' options included."""
    keys = set(DIRECT.findall(source))
    for var, section in SECTION.findall(source):
        keys |= {f"{section}.{opt}" for opt in re.findall(rf'\b{var}\.get\(\s*"(\w+)"', source)}
    return keys


FENCE = re.compile(r"```.*?```", re.S)


def names(doc: str) -> set[str]:
    """Every segment of every code span in the prose, and every key of a fenced jsonc block."""
    out: set[str] = set()
    for span in re.findall(r"`([^`]+)`", FENCE.sub(" ", doc)):
        out |= set(re.split(r"[^\w<>*-]+", span))
    for block in FENCE.findall(doc):
        out |= set(re.findall(r'"(\w+)"\s*:', block))
    return out


def documented(key: str, doc_names: set[str]) -> bool:
    return key.split(".")[-1] in doc_names


def undocumented(doc: str, files: list[Path]) -> dict[str, list[str]]:
    known = names(doc)
    out: dict[str, list[str]] = {}
    for f in files:
        missing = sorted(k for k in keys_read(f.read_text(encoding="utf-8")) if not documented(k, known))
        if missing:
            out[f.name] = missing
    return out


class ConfigDocTests(unittest.TestCase):
    def test_every_key_the_shared_checks_read_is_in_config_md(self):
        files = [f for d in SOURCES for f in sorted(d.glob("*.py"))]
        self.assertGreater(len(files), 40)
        self.assertEqual(undocumented(CONFIG_MD.read_text(encoding="utf-8"), files), {})

    def test_an_option_read_off_a_section_and_never_named_is_found(self):
        source = ('cfg = deck.section("checks.probe")\n'
                  'a = cfg.get("named")\nb = cfg.get("hidden")\nc = deck.get("figures.wide")\n')
        known = names("`checks.probe.named` and `wide`")
        self.assertEqual(sorted(k for k in keys_read(source) if not documented(k, known)),
                         ["checks.probe.hidden"])


if __name__ == "__main__":
    unittest.main()
