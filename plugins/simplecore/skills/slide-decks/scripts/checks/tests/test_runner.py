"""check.py: names resolve local first, both declaration forms run, holes fail."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
RUNNER = HERE.parents[1] / "check.py"

PASS = 'print("local pass: 1 item read, 0 found")\n'
FAIL = 'import sys\nprint("local fail: 1 found")\nsys.exit(1)\n'
QUIET = ''


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / ".claude").mkdir()
        (self.root / "deck").mkdir()
        local = self.root / "tools" / "deck"
        local.mkdir(parents=True)
        (local / "ok.py").write_text(PASS)
        (local / "bad.py").write_text(FAIL)
        (local / "quiet.py").write_text(QUIET)
        (local / "loose.py").write_text(PASS)
        # A local script named like a shared check takes precedence over it.
        (local / "coltotal.py").write_text('print("local coltotal")\n')

    def tearDown(self):
        self.tmp.cleanup()

    def declare(self, checks: dict) -> None:
        data = {"decks": {"proposal": {"dir": "deck", "kind": "document",
                                       "checks": {"local": "tools/deck", **checks}}}}
        (self.root / ".claude" / "slide-decks.json").write_text(json.dumps(data))

    def run_cmd(self, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run([sys.executable, str(RUNNER), *args], cwd=self.root,
                              capture_output=True, text=True)

    def test_list_form_passes_and_local_wins(self):
        self.declare({"preflight": ["ok", "coltotal"], "after": []})
        r = self.run_cmd("preflight")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("local pass", r.stdout)
        self.assertIn("local coltotal", r.stdout)
        self.assertIn("preflight: 2 checks · failed 0", r.stdout)

    def test_failure_unresolved_name_and_silence(self):
        self.declare({"preflight": [], "after": ["bad", "quiet", "nowhere"]})
        r = self.run_cmd("after")
        self.assertEqual(r.returncode, 1)
        self.assertIn("✖ nowhere", r.stdout)
        self.assertIn("⚠ quiet printed nothing", r.stdout)
        self.assertIn("failed 2 (bad, nowhere)", r.stdout)

    def test_map_form_runs_the_command_or_resolves_the_name(self):
        self.declare({"preflight": {}, "after": {"ok": None, "echoed": "python3 -c \"print('by command')\""}})
        r = self.run_cmd("after")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("by command", r.stdout)
        self.assertIn("local pass", r.stdout)

    def test_shared_check_resolves_and_reports_its_missing_input(self):
        self.declare({"preflight": [], "after": ["reqid"]})
        r = self.run_cmd("after")
        self.assertEqual(r.returncode, 1)
        self.assertIn("reqid (shared", r.stdout)
        self.assertIn("exit 2", r.stdout)

    def test_undeclared_local_scripts_and_dead_exclusions(self):
        self.declare({"preflight": ["ok"], "after": ["bad", "quiet", "coltotal"],
                      "excluded": {"gone": "a script that was removed"}})
        r = self.run_cmd("undeclared")
        self.assertEqual(r.returncode, 1)
        self.assertIn("loose", r.stdout)
        self.assertIn("gone", r.stdout)
        self.declare({"preflight": ["ok"], "after": ["bad", "quiet", "coltotal"],
                      "excluded": {"loose": "a generator, not a judgement"}})
        r = self.run_cmd("undeclared")
        self.assertEqual(r.returncode, 0, r.stdout)

    def test_missing_phase_is_a_config_error(self):
        self.declare({"preflight": []})
        r = self.run_cmd("after")
        self.assertEqual(r.returncode, 2)
        self.assertIn("checks.after", r.stderr)


if __name__ == "__main__":
    unittest.main()
