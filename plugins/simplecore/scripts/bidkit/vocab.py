"""The component vocabulary a deck's kit defines.

Which components carry a name, a prose block or a caption, which arguments are
furniture, and which master names mark a body page are facts about the kit a
deck binds, not about the check reading it. They live in
`skills/slide-decks/assets/kits/<kit>.json`, and a project that adds its own
components overrides a class with a file of the same shape.

Declaration, in the deck's entry of `.claude/slide-decks.json`:

    "vocabulary": "simplecore-proposal-01"
    "vocabulary": { "kit": "simplecore-proposal-01", "override": ".claude/deck-vocabulary.json" }
    "vocabulary": { "file": ".claude/deck-vocabulary.json" }

Slot syntax: `arg` is an argument's value, `arg[].key` the `key` of every item
of the JSON list in `arg`, and `arg[0][]` every cell of the first row of the
JSON grid in `arg`.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Iterator

from .config import ConfigError, DeckConfig, parse_jsonc

KITS_DIR = Path(__file__).resolve().parents[2] / "skills" / "slide-decks" / "assets" / "kits"

_ITEM = re.compile(r"^(\w+)\[\]\.(\w+)$")
_ROW0 = re.compile(r"^(\w+)\[0\]\[\]$")
_PLAIN = re.compile(r"^\w+$")


def _read(path: Path) -> dict:
    if not path.is_file():
        raise ConfigError(f"vocabulary file {path} does not exist")
    data = parse_jsonc(path.read_text(encoding="utf-8"), str(path))
    if not isinstance(data, dict):
        raise ConfigError(f"{path}: a vocabulary file must hold an object")
    return data


def _merge(base: dict, over: dict) -> dict:
    """Override per component and per class: a listed component replaces the kit's."""
    out = json.loads(json.dumps(base))
    for key in ("slots",):
        for cls, table in over.get(key, {}).items():
            out.setdefault(key, {}).setdefault(cls, {}).update(table)
    for cls, names in over.get("args", {}).items():
        out.setdefault("args", {})[cls] = names
    for key, value in over.get("pages", {}).items():
        if isinstance(value, dict):
            out.setdefault("pages", {}).setdefault(key, {}).update(value)
        else:
            out.setdefault("pages", {})[key] = value
    for key, value in over.items():
        if key not in ("slots", "args", "pages"):
            out[key] = value
    return out


def kit_file(kit: str) -> Path:
    if not re.fullmatch(r"[\w.-]+", kit):
        raise ConfigError(f"vocabulary kit name `{kit}` is not a plain name")
    return KITS_DIR / f"{kit}.json"


class Vocabulary:
    def __init__(self, data: dict, origin: str = ""):
        self.data = data
        self.origin = origin
        for cls, table in data.get("slots", {}).items():
            for template, specs in table.items():
                for spec in specs:
                    if not (_PLAIN.match(spec) or _ITEM.match(spec) or _ROW0.match(spec)):
                        raise ConfigError(f"{origin}: slot `{spec}` of {template} ({cls}) "
                                          "is not `arg`, `arg[].key` or `arg[0][]`")

    @classmethod
    def for_deck(cls, deck: DeckConfig) -> "Vocabulary":
        decl = deck.require("vocabulary", "the kit whose component vocabulary the checks read")
        if isinstance(decl, str):
            return cls(_read(kit_file(decl)), decl)
        if not isinstance(decl, dict):
            raise ConfigError(f"deck `{deck.name}` `vocabulary` must be a kit name or an object")
        if "file" in decl:
            path = deck.resolve(decl["file"])
            return cls(_read(path), str(path))
        if "kit" not in decl:
            raise ConfigError(f"deck `{deck.name}` `vocabulary` names neither `kit` nor `file`")
        data = _read(kit_file(decl["kit"]))
        origin = decl["kit"]
        if decl.get("override"):
            path = deck.resolve(decl["override"])
            data = _merge(data, _read(path))
            origin += f" + {path}"
        return cls(data, origin)

    def pages(self) -> dict:
        return self.data.get("pages", {})

    def components(self, cls: str) -> set[str]:
        """Templates that fill at least one slot of class `cls`."""
        return set(self.data.get("slots", {}).get(cls, {}))

    def args(self, cls: str) -> set[str]:
        return set(self.data.get("args", {}).get(cls, []))

    def kinds(self, group: str) -> set[str]:
        """The contract kinds (`<Template kind=...>`) the kit counts in `group`."""
        return set(self.data.get("kinds", {}).get(group, []))

    def values(self, cls: str, template: str, attrs: dict) -> Iterator[tuple[str, str]]:
        """(slot, printed value) for every slot of class `cls` a `<Use>` fills."""
        for spec in self.data.get("slots", {}).get(cls, {}).get(template, []):
            m = _ITEM.match(spec)
            if m:
                arg, key = m.groups()
                for item in _json_list(attrs.get(arg)):
                    if isinstance(item, dict) and isinstance(item.get(key), str):
                        yield f"{arg}.{key}", item[key]
                continue
            m = _ROW0.match(spec)
            if m:
                rows = _json_list(attrs.get(m.group(1)))
                if rows and isinstance(rows[0], list):
                    for cell in rows[0]:
                        if isinstance(cell, str):
                            yield f"{m.group(1)}[0]", cell
                continue
            if spec in attrs:
                yield spec, attrs[spec]


def role(deck: DeckConfig, vocab: Vocabulary | None, check: str, name: str) -> tuple:
    """(value, where it came from) for a component role a check needs.

    The deck's `checks.<check>.<name>` wins over the kit vocabulary's
    `roles.<name>`; `(None, None)` when neither declares it, which the check
    reports as a rule it did not judge rather than passing it.
    """
    key = f"checks.{check}.{name}"
    if deck.has(key):
        return deck.get(key), key
    if vocab is not None and name in vocab.data.get("roles", {}):
        return vocab.data["roles"][name], f"vocabulary {vocab.origin} roles.{name}"
    return None, None


def _json_list(value: str | None) -> list:
    if not value:
        return []
    try:
        data = json.loads(value)
    except (ValueError, TypeError):
        return []
    return data if isinstance(data, list) else []
