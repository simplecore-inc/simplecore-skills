"""What every check's command line shares: the deck flag, the connection, the exit codes.

Exit codes: 0 nothing found, 1 findings, 2 the check could not reach its input
(a missing declaration key, no server holding the deck, a deck that contradicts
the declaration). A check that cannot reach its input says so instead of
passing.
"""
from __future__ import annotations

import sys
from argparse import ArgumentParser, Namespace
from typing import Callable

from .baseline import Baseline
from .config import ConfigError, DeckConfig, Project
from .deckread import DeckError, DeckReader
from .sgmcp import DeckUnavailable, Session, announce
from .vocab import Vocabulary


def parser(description: str, bless: bool = False) -> ArgumentParser:
    ap = ArgumentParser(description=description)
    ap.add_argument("--deck", help="the deck's name in .claude/slide-decks.json")
    if bless:
        ap.add_argument("--bless", action="store_true",
                        help="retire today's findings into the baseline; each still owes a reason")
    return ap


def deck_config(args: Namespace) -> DeckConfig:
    return Project.load().deck(args.deck)


def open_reader(deck: DeckConfig, with_vocabulary: bool = True, write: bool = False) -> DeckReader:
    vocab = Vocabulary.for_deck(deck) if with_vocabulary and deck.has("vocabulary") else None
    session = Session(deck, write=write)
    announce(session.source)
    return DeckReader(session, deck, vocab)


def report_bless(baseline: Baseline, findings: dict, what: str) -> int:
    owed = baseline.bless(findings)
    print(f"{len(findings)} {what} written to {baseline.path}; {len(owed)} still owe a reason")
    for key in owed:
        print("  · " + key.replace("\t", " | "))
    return 0


def guarded(main: Callable[[list[str] | None], int]) -> Callable[[list[str] | None], int]:
    """Turn an unreachable input into exit 2 with the reason, never a pass."""
    def run(argv: list[str] | None = None) -> int:
        try:
            return main(argv)
        except (ConfigError, DeckUnavailable, DeckError, OSError) as e:
            print(f"✖ {e}", file=sys.stderr)
            return 2
    return run
