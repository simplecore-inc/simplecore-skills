"""The bundled Lucide set and the licence it ships under travel together:
NOTICE carries the release's LICENSE, and fetch_icons.py rewrites it."""
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from helpers import TOOLKIT

import lucide  # noqa: E402

NOTICE = TOOLKIT.parent / "NOTICE"
BLOCK = re.compile(r"^-------- lucide-static (\S+) LICENSE --------\n(.*?)\n"
                   r"-------- end of lucide-static LICENSE --------$", re.S | re.M)


class BundledNotice(unittest.TestCase):
    def test_notice_carries_the_license_of_the_bundled_release(self):
        found = BLOCK.findall(NOTICE.read_text(encoding="utf-8"))
        self.assertEqual(len(found), 1, "one lucide-static LICENSE block")
        version, text = found[0]
        self.assertEqual(version, lucide.VERSION)
        # Lucide's own licence, and the one its Feather-derived icons keep
        self.assertIn("ISC License", text)
        self.assertIn("The MIT License (MIT) (for the icons listed above)", text)


class Regeneration(unittest.TestCase):
    LICENSE = "ISC License\n\nCopyright (c) 2099 Test Icons\n\nPermission granted.\n"

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        root = Path(self._tmp.name)
        self.skill = root / "skill"
        (self.skill / "scripts").mkdir(parents=True)
        shutil.copy(TOOLKIT / "fetch_icons.py", self.skill / "scripts")
        stale = BLOCK.sub("-------- lucide-static 0.1.0 LICENSE --------\nold text\n"
                          "-------- end of lucide-static LICENSE --------",
                          NOTICE.read_text(encoding="utf-8"))
        (self.skill / "NOTICE").write_text(stale, encoding="utf-8")
        self.package = root / "package"
        (self.package / "icons").mkdir(parents=True)
        (self.package / "icons" / "check.svg").write_text(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">'
            '<path d="M20 6 9 17l-5-5"/></svg>', encoding="utf-8")
        (self.package / "package.json").write_text(json.dumps({"version": "9.9.9"}))

    def tearDown(self):
        self._tmp.cleanup()

    def fetch(self):
        return subprocess.run(
            [sys.executable, "-I", str(self.skill / "scripts" / "fetch_icons.py"),
             "--from", str(self.package / "icons")], capture_output=True, text=True)

    def test_the_package_license_replaces_the_one_in_notice(self):
        (self.package / "LICENSE").write_text(self.LICENSE, encoding="utf-8")
        run = self.fetch()
        self.assertEqual(run.returncode, 0, run.stderr)
        notice = (self.skill / "NOTICE").read_text(encoding="utf-8")
        self.assertEqual(BLOCK.findall(notice), [("9.9.9", self.LICENSE.strip("\n"))])
        self.assertIn("diagram-design", notice)   # the rest of NOTICE is kept
        self.assertIn("VERSION = '9.9.9'",
                      (self.skill / "scripts" / "lucide.py").read_text(encoding="utf-8"))

    def test_no_license_writes_nothing(self):
        run = self.fetch()
        self.assertNotEqual(run.returncode, 0)
        self.assertIn("no LICENSE", run.stderr)
        self.assertFalse((self.skill / "scripts" / "lucide.py").exists())


if __name__ == "__main__":
    unittest.main()
