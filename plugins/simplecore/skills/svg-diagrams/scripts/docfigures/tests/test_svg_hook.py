"""The write-time hook this skill ships: plugins/simplecore/hooks/check-svg-render.mjs.

Each case writes an SVG into a throwaway project and hands the hook the
PostToolUse payload Claude Code would send for it.
"""
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from helpers import TOOLKIT

import svgkit  # noqa: E402

HOOK = TOOLKIT.parents[2] / "hooks" / "check-svg-render.mjs"
NODE = shutil.which("node")

ICON = ('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" '
        'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
        'stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>')

BROKEN = ('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="160" '
          'viewBox="0 0 600 160"><rect x="24" y="24" width="250" height="67" fill="#fff" '
          'stroke="#000"/><text x="40" y="62" font-size="16">Box</text>'
          '<line x1="274" y1="57" x2="560" y2="57" stroke="#000" '
          'marker-end="url(#nowhere)"/></svg>')


def clean_diagram():
    c = svgkit.Canvas(600, 200, theme="paper")
    c.card(24, 24, 250, 67, c.blue, title="Ingest", lines=["Connector"])
    c.card(326, 24, 250, 67, c.green, title="Store", lines=["Table"])
    c.ortho(274, 57, 326, 57, exit="R", entry="L", color=c.blue, marker="blue")
    c.trim()
    return c.render()


@unittest.skipUnless(NODE, "node is not installed")
class SvgHook(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        (self.root / ".git").mkdir()   # the project boundary the config search stops at
        self.env = dict(os.environ)

    def tearDown(self):
        self._tmp.cleanup()

    def run_hook(self, name, markup):
        path = self.root / name
        path.write_text(markup, encoding="utf-8")
        payload = {"tool_name": "Write", "tool_input": {"file_path": str(path)},
                   "cwd": str(self.root)}
        return subprocess.run([NODE, str(HOOK)], input=json.dumps(payload), text=True,
                              capture_output=True, env=self.env, timeout=60)

    def test_a_diagram_with_a_defect_is_reported(self):
        run = self.run_hook("broken.svg", BROKEN)
        self.assertEqual(run.returncode, 2, run.stderr)
        self.assertIn("SVG render defects", run.stderr)
        self.assertIn("UNRESOLVED-MARKER", run.stderr)

    def test_a_clean_diagram_passes_in_silence(self):
        run = self.run_hook("clean.svg", clean_diagram())
        self.assertEqual((run.returncode, run.stderr), (0, ""))

    def test_an_icon_is_not_linted_as_a_diagram(self):
        run = self.run_hook("check.svg", ICON)
        self.assertEqual((run.returncode, run.stderr), (0, ""))

    def test_a_crashed_lint_is_not_reported_as_defects(self):
        fake = self.root / "bin"
        fake.mkdir()
        python = fake / "python3"
        python.write_text("#!/bin/sh\necho 'Traceback (most recent call last):' >&2\n"
                          "echo 'ZeroDivisionError: division by zero' >&2\nexit 1\n")
        python.chmod(0o755)
        self.env["PATH"] = f"{fake}{os.pathsep}{self.env.get('PATH', '')}"
        run = self.run_hook("broken.svg", BROKEN)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertNotIn("SVG render defects", run.stderr)
        self.assertIn("svg lint could not run", run.stderr)
        self.assertIn("ZeroDivisionError", run.stderr)

    def test_a_project_that_turns_the_lint_off_is_skipped(self):
        (self.root / ".claude").mkdir()
        (self.root / ".claude" / "simplecore.json").write_text('{"svgLint": false}')
        run = self.run_hook("broken.svg", BROKEN)
        self.assertEqual((run.returncode, run.stderr), (0, ""))


if __name__ == "__main__":
    unittest.main()
