"""The project's deck declaration, `.claude/slide-decks.json`.

The check scripts beside this file need two things they must not guess: the
manuscript a slide deck is built from (the presentation plan) and the document
deck whose sections the running head cites. Both are the project's own choice,
so both come from the declaration the `slide-decks` skill reads — found by
walking up from this deck's directory to the nearest `.claude/slide-decks.json`.

The file may carry `//` comments; they are stripped before parsing.
"""
from __future__ import annotations
import json
import re
from pathlib import Path

CONFIG_NAME = Path(".claude") / "slide-decks.json"
DECK = Path(__file__).resolve().parents[1]


def _strip_comments(text: str) -> str:
    return re.sub(r"^\s*//.*$", "", text, flags=re.M)


def find_config(start: Path = DECK) -> tuple[Path, dict]:
    """(project root, parsed declaration) for the nearest slide-decks.json."""
    for directory in (start, *start.parents):
        candidate = directory / CONFIG_NAME
        if candidate.exists():
            return directory, json.loads(_strip_comments(candidate.read_text(encoding="utf-8")))
    raise SystemExit(f"{CONFIG_NAME} 이 {start} 위쪽 어디에도 없다 — slide-decks 스킬의 config 참조대로 선언한다")


def this_deck() -> tuple[Path, str, dict, dict]:
    """(root, name, this deck's declaration, the whole file) — the deck whose `dir` is this one."""
    root, config = find_config()
    for name, deck in config.get("decks", {}).items():
        if (root / deck["dir"]).resolve() == DECK:
            return root, name, deck, config
    raise SystemExit(f"{CONFIG_NAME} 의 decks 에 {DECK} 를 dir 로 갖는 덱이 없다")


def required(deck: dict, key: str, name: str) -> str:
    value = deck
    for part in key.split("."):
        if not isinstance(value, dict) or part not in value:
            raise SystemExit(f"{CONFIG_NAME}: 덱 {name} 에 `{key}` 가 선언되지 않았다 — 이 검사는 그 값을 추측하지 않는다")
        value = value[part]
    return value
