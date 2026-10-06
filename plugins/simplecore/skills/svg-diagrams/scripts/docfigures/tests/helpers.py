"""Shared fixtures: a throwaway project with a config, and small SVG builders."""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

LIBRARY = Path(__file__).resolve().parent.parent
TOOLKIT = LIBRARY.parent
sys.path.insert(0, str(LIBRARY))
sys.path.insert(0, str(TOOLKIT))

import figconfig  # noqa: E402

BASE_CONFIG = {
    "out": "figures",
    "modules": ["figs/*.py"],
    "boards": {"1200": 600, "528": 264},
    "boardNames": {"FULL": 1200, "COLUMN": 528},
    "columnBoard": 528,
    "ladder": [21, 24, 26, 28],
    # MICRO is the smallest rung, below BODY, as in the sample config and the
    # reference's ladder table: a helper that set running text there would
    # print below the body rung, and these fixtures can tell the two apart.
    "names": {"CHIP": 21, "MICRO": 21, "BODY": 24, "LEAD": 24, "CARD": 24,
              "SECTION": 26, "EMPH": 26, "DISPLAY": 28},
    "strokes": {"HAIRLINE": 1.4, "STROKE": 1.9, "THICK": 2.8},
    "dashes": {"DASH_OUTSIDE": {"pattern": "5 4", "words": ["범위 밖"]}},
    "dashWord": "점선",
    "subBodyShareMax": 0.5,
}


class Project:
    """A temporary project root holding `.claude/document-figures.json`."""

    def __init__(self, **overrides):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.config = dict(BASE_CONFIG, **overrides)
        (self.root / ".claude").mkdir()
        self.config_path = self.root / ".claude" / "document-figures.json"
        self.config_path.write_text(json.dumps(self.config, ensure_ascii=False),
                                    encoding="utf-8")
        (self.root / "figs").mkdir()
        (self.root / "figures").mkdir()

    def cfg(self):
        return figconfig.load(self.config_path)

    def write(self, rel, text):
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        return path

    def run(self, script, *args):
        env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
        env.pop("DOCUMENT_FIGURES_CONFIG", None)
        return subprocess.run([sys.executable, str(LIBRARY / script), *args],
                              cwd=self.root, env=env, capture_output=True, text=True)

    def close(self):
        self._tmp.cleanup()


def svg(body, w=1200, h=400, attrs=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg"{attrs} width="{w}" height="{h}" '
            f'viewBox="0 0 {w} {h}" font-family="sans-serif">'
            f'<rect width="{w}" height="{h}" fill="#ffffff"/>{body}</svg>')


def text(x, y, s, size=24, fill="#1f2430", anchor=None):
    a = f' text-anchor="{anchor}"' if anchor else ""
    return (f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}" '
            f'fill="{fill}"{a}>{s}</text>')
