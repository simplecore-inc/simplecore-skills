"""Every test module imports on its own, whatever ran before it.

The checks under test live one directory up, and a module that imports one
without first putting that directory on `sys.path` (through `fixtures`, or the
path lines the other modules carry) passes only when an earlier module in the
discovery order did it for it. Run alone, or first, it fails to import. So each
module is imported in a fresh interpreter from this directory, the way
`unittest discover -s .` starts, with no `PYTHONPATH` lent by the caller.
"""
import os
import subprocess
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent


def import_alone(directory: Path, module: str) -> str | None:
    """The import error of `module` in a fresh interpreter, None when it imports."""
    env = {k: v for k, v in os.environ.items() if k != "PYTHONPATH"}
    result = subprocess.run([sys.executable, "-c", f"import {module}"], cwd=directory, env=env,
                            capture_output=True, text=True, timeout=120)
    if result.returncode == 0:
        return None
    lines = (result.stderr or result.stdout).strip().splitlines()
    return lines[-1] if lines else f"exit {result.returncode}"


def failing_imports(directory: Path) -> dict[str, str]:
    """{module: error} for every test module in `directory` that does not import alone."""
    modules = sorted(p.stem for p in directory.glob("test_*.py"))
    with ThreadPoolExecutor(max_workers=8) as pool:
        errors = dict(zip(modules, pool.map(lambda m: import_alone(directory, m), modules)))
    return {m: e for m, e in errors.items() if e is not None}


class IsolationTests(unittest.TestCase):
    def test_every_module_here_imports_alone(self):
        self.assertEqual(failing_imports(HERE), {})

    def test_a_module_leaning_on_an_earlier_one_is_found(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "checks").mkdir()
            (d / "checks" / "probe.py").write_text("VALUE = 1\n", encoding="utf-8")
            tests = d / "tests"
            tests.mkdir()
            (tests / "fixtures.py").write_text(
                "import sys\nfrom pathlib import Path\n"
                "sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'checks'))\n",
                encoding="utf-8")
            (tests / "test_leaning.py").write_text("import probe\n", encoding="utf-8")
            (tests / "test_standing.py").write_text("import fixtures  # noqa: F401\nimport probe\n",
                                                    encoding="utf-8")
            found = failing_imports(tests)
            self.assertEqual(list(found), ["test_leaning"])
            self.assertIn("probe", found["test_leaning"])


if __name__ == "__main__":
    unittest.main()
