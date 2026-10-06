#!/usr/bin/env python3
"""The deck's measured geometry, read from the deck tool's own layout check.

Overlap (a table drawn over the shape below it), a block spilling past its
parent or the page (a line run past the text block into the margin), an empty
or collapsed container, type below the deck's floor and what the renderer
actually drew are the tool's readings over the open deck. This check asks for
them and fails on any finding. It measures nothing itself: two measurements of
one thing is how a deck ships the bug one of them fixed.

Config (all optional):

    "type": { "floor": 8 },                       // passed as the smallest allowed font size
    "checks": { "layout": { "kinds": [...],       // default: every kind below
                            "tolerance": 2 } }    // pixels that count, the tool's default when absent

    layout.py [--slides 3-7]
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.sgmcp import DeckUnavailable, Session  # noqa: E402

KINDS = ["overlap", "outside", "escape", "empty", "tiny", "font", "diagnostic", "ink", "spread"]


def arguments(deck: DeckConfig, slides: str | None) -> dict:
    cfg = deck.section("checks.layout")
    kinds = cfg.get("kinds", KINDS)
    if not isinstance(kinds, list) or not kinds or not all(isinstance(k, str) for k in kinds):
        raise ConfigError(f"deck `{deck.name}` `checks.layout.kinds` must list layout_check kinds")
    args: dict = {"kinds": kinds}
    floor = deck.get("type.floor")
    if floor:
        args["minFontSize"] = floor
    if cfg.get("tolerance") is not None:
        args["tolerance"] = cfg["tolerance"]
    if slides:
        args["slides"] = slides
    return args


def counts(text: str, kinds: list[str]) -> dict[str, int]:
    """{kind: count} from the tool's summary line; every requested kind must be there."""
    got = {k: int(n) for k, n in re.findall(r"\b(%s) (\d+)\b" % "|".join(map(re.escape, kinds)), text)}
    missing = [k for k in kinds if k not in got]
    if missing:
        raise DeckUnavailable("layout_check printed no count for " + ", ".join(missing)
                              + "; the tool's summary format changed, so nothing can be read as a pass")
    return got


def check(session: Session, deck: DeckConfig, slides: str | None = None) -> tuple[str, dict[str, int], bool]:
    """(the tool's report, {kind: count}, the tool flagged an error)."""
    args = arguments(deck, slides)
    result = session.call("layout_check", args)
    content = result.get("content") or []
    text = "\n".join(c.get("text", "") for c in content if isinstance(c, dict))
    if result.get("isError"):
        return text, {}, True
    return text, counts(text, args["kinds"]), False


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    ap = cli.parser(__doc__.splitlines()[0])
    ap.add_argument("--slides", help="a range the tool accepts (3-7 or 1,4)")
    args = ap.parse_args(argv)
    deck = cli.deck_config(args)
    with cli.open_reader(deck, with_vocabulary=False) as reader:
        text, found, failed = check(reader.session, deck, args.slides)
    print(text)
    if failed:
        print("  ✖ layout_check answered with an error", file=sys.stderr)
        return 1
    total = sum(found.values())
    print(f"layout: {total} findings across {len(found)} kinds")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
