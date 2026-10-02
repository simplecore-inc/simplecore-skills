"""Run a check's command line against a recording, inside a temporary project."""
from __future__ import annotations

from contextlib import redirect_stdout
from io import StringIO
from unittest import mock

from fixtures import reader

from bidkit import cli
from bidkit.config import DeckConfig


def run(module, deck: DeckConfig, rec: dict, argv: list[str] | None = None) -> tuple[int, str]:
    """(exit code, printed output) of `module.main(argv)` reading `rec` as the deck."""
    out = StringIO()
    with mock.patch.object(cli, "open_reader", lambda d, with_vocabulary=True: reader(d, rec)), \
            mock.patch.object(cli, "deck_config", lambda args: deck), redirect_stdout(out):
        code = module.main(argv or [])
    return code, out.getvalue()
