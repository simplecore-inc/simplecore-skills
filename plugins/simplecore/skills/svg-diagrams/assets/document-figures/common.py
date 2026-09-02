"""Shared setup for this project's document figures.

Copy this file into the project (conventionally `tools/diagrams/common.py`) and
set the four constants below. Every figure module imports from here, so the
whole set shares one canvas width, one type scale and one output directory —
which is the point: figures placed side by side in a document must print their
body text at the same size.

The drawing toolkit lives in the `simplecore:svg-diagrams` skill rather than in
the project. Its location differs per machine, so it is resolved at run time and
can be overridden with `SVG_DIAGRAMS_SCRIPTS` — nothing here hardcodes one
person's home directory.
"""
import os
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent

# ── project settings ───────────────────────────────────────────────────────
# Where the generated SVGs land, relative to this file.
OUT = HERE.parent.parent / "docs" / "assets" / "diagrams"

# One canvas width for every figure in the document. Derive it from the text
# column: A4 with 25.4mm margins is 159.2mm ≈ 602px at 96 dpi, so a set drawn at
# 1200 units and placed at 50% prints at exactly that column.
STANDARD_WIDTH = 1200

# The only type sizes the saved artifacts may contain. Layout code may keep its
# own working numbers; `save()` snaps them onto this ladder.
FONT_SCALE = (15.0, 16.0, 17.0, 18.0, 20.0, 21.0, 24.0)

# Themes render on a white page unless the document is dark.
THEME = "paper"
# ───────────────────────────────────────────────────────────────────────────


def toolkit_dir():
    """Directory holding svgkit.py and audit.py, or exit saying how to fix it."""
    env = os.environ.get("SVG_DIAGRAMS_SCRIPTS")
    candidates = [pathlib.Path(env)] if env else []
    candidates += [
        pathlib.Path.home() / ".claude/skills/simplecore/skills/svg-diagrams/scripts",
        pathlib.Path.home()
        / "Workspace/simplecore-skills/plugins/simplecore/skills"
        / "svg-diagrams/scripts",
    ]
    for c in candidates:
        if (c / "svgkit.py").exists():
            return c
    sys.exit(
        "svg-diagrams toolkit not found. Install the simplecore skills, or point "
        "SVG_DIAGRAMS_SCRIPTS at the scripts directory.\nLooked in:\n  "
        + "\n  ".join(str(c) for c in candidates))


sys.path.insert(0, str(toolkit_dir()))

from svgkit import Canvas, tw, edge_pt, row_positions, SANS, MONO  # noqa: E402,F401


def canvas(w, h):
    c = Canvas(w, h, theme=THEME)
    # The figure's name and its one-line explanation belong to the document's
    # caption. A title block inside the SVG duplicates that caption and adds
    # vertical space to every figure in the set, so it is suppressed centrally
    # and no figure module has to remember.
    c.title = lambda *_args, **_kwargs: None
    return c


def _snap_font_sizes(c):
    """Force emitted text onto the project's type scale.

    Layout code may keep the working size it measured with, but the saved
    artifact may not introduce a one-off printed size — equal-width figures then
    hold the same visual hierarchy everywhere in the document.
    """
    ladder = sorted(FONT_SCALE)

    def snap(markup):
        def replace(match):
            value = float(match.group(1))
            nearest = min(ladder, key=lambda step: (abs(step - value), step))
            return f'font-size="{nearest:g}"'
        return re.sub(r'font-size="([\d.]+)"', replace, markup)

    c.body = [snap(m) for m in c.body]
    c.under = [(order, snap(m)) for order, m in c.under]


def save(c, name, margin=28):
    """Write one figure at the shared width."""
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.svg"
    _snap_font_sizes(c)
    c.trim(margin=margin, min_w=STANDARD_WIDTH, max_w=STANDARD_WIDTH)
    c.save(str(path))
    print("wrote", path)
    return path
