"""The shared drawing layer for a project's document figures.

A project does not copy this library. Its figure modules import it by name
(`from common import card, save, BODY`) and the build puts this directory on
the import path ahead of the project's own, so every project draws with one
library and keeps only its figure modules and `.claude/document-figures.json`.

Every value that differs between projects comes from that file
(`figconfig.py` describes how it is found). What a figure set shares - one
canvas width per board, one type scale, one grey, one stroke ladder - is
enforced here and checked by `verify.py`, so figures placed side by side in a
document print their body text at the same size.

The content-first layer sizes every box from the text it holds, with even
padding. Draw with these helpers rather than with fixed heights - the lint
(`ROW-PADDING-UNEVEN`, `WRAP-SLACK`, `ROW-HEIGHT-MISMATCH`, `LABEL-GROUPING`,
`TEXT-ON-LINE`) reports exactly the defects a fixed height produces.

The code lives in `figlib/`: `settings` (the config's values), `text` (the
wrap and the glyph model), `save` (canvas, `@figure`, `save`), `boxes` and
`marks`. This module re-exports all of it, including the names the config
declares.
"""
from figlib.settings import *  # noqa: F401,F403
from figlib.settings import CFG, LIBRARY, toolkit_dir  # noqa: F401
from figlib.text import *  # noqa: F401,F403
from figlib.text import BREAK_FINDINGS  # noqa: F401
from figlib.save import *  # noqa: F401,F403
from figlib.boxes import *  # noqa: F401,F403
from figlib.marks import *  # noqa: F401,F403
from figlib.marks import badge_  # noqa: F401
