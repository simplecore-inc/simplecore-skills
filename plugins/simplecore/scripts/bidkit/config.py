"""The project's deck declaration, `.claude/slide-decks.json`.

The file is JSON with comments (JSONC). It is found by walking up from the
working directory, so a check run anywhere inside the project reads the same
declaration. A key a check needs and the file does not declare is an error
that names the key; a check never guesses a path.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

CONFIG_NAME = Path(".claude") / "slide-decks.json"
DECK_ENV = "SLIDE_DECK"

_MISSING = object()


class ConfigError(Exception):
    """The declaration is absent, malformed, or lacks a key a check needs."""


def strip_jsonc(text: str) -> str:
    """Remove `//` and `/* */` comments and trailing commas outside strings.

    A line-based strip breaks on a value such as "http://127.0.0.1:7333/mcp"
    and on a value line that ends in a comment, so the text is walked
    character by character with string state. This is the one JSONC reader
    the plugin's scripts share, the deck declaration and the figure settings
    alike.
    """
    out: list[str] = []
    i, n = 0, len(text)
    in_str = False
    while i < n:
        c = text[i]
        if in_str:
            out.append(c)
            if c == "\\" and i + 1 < n:
                out.append(text[i + 1])
                i += 2
                continue
            if c == '"':
                in_str = False
            i += 1
            continue
        if c == '"':
            in_str = True
            out.append(c)
            i += 1
            continue
        if text.startswith("//", i):
            while i < n and text[i] != "\n":
                i += 1
            continue
        if text.startswith("/*", i):
            end = text.find("*/", i + 2)
            if end < 0:
                raise ConfigError("unterminated /* comment in the declaration")
            # Keep line breaks so a JSON error still points at the right line.
            out.append("\n" * text.count("\n", i, end))
            i = end + 2
            continue
        out.append(c)
        i += 1
    return _drop_trailing_commas("".join(out))


def _drop_trailing_commas(text: str) -> str:
    """Remove a comma that closes an object or array, outside strings."""
    out: list[str] = []
    i, n = 0, len(text)
    in_str = False
    while i < n:
        c = text[i]
        if in_str:
            out.append(c)
            if c == "\\" and i + 1 < n:
                out.append(text[i + 1])
                i += 2
                continue
            if c == '"':
                in_str = False
            i += 1
            continue
        if c == '"':
            in_str = True
        elif c == ",":
            j = i + 1
            while j < n and text[j] in " \t\r\n":
                j += 1
            if j < n and text[j] in "}]":
                i += 1
                continue
        out.append(c)
        i += 1
    return "".join(out)


def parse_jsonc(text: str, where: str) -> Any:
    try:
        return json.loads(strip_jsonc(text))
    except json.JSONDecodeError as e:
        raise ConfigError(f"{where}: not valid JSON after comments are stripped: {e}") from e


def find_config(start: Path | None = None) -> Path:
    """The nearest `.claude/slide-decks.json` at or above `start` (default: cwd)."""
    here = (start or Path.cwd()).resolve()
    for directory in (here, *here.parents):
        candidate = directory / CONFIG_NAME
        if candidate.is_file():
            return candidate
    raise ConfigError(f"no {CONFIG_NAME} at or above {here}; declare the deck as the "
                      "slide-decks skill's references/config.md describes")


def _dig(data: Any, key: str) -> Any:
    value = data
    for part in key.split("."):
        if not isinstance(value, dict) or part not in value:
            return _MISSING
        value = value[part]
    return value


class Project:
    """The parsed declaration and the repository root it sits in."""

    def __init__(self, root: Path, data: dict, path: Path | None = None):
        if not isinstance(data, dict) or not isinstance(data.get("decks"), dict):
            raise ConfigError(f"{path or CONFIG_NAME}: the top level must hold a `decks` object")
        self.root = Path(root)
        self.data = data
        self.path = path or self.root / CONFIG_NAME

    @classmethod
    def load(cls, start: Path | None = None) -> "Project":
        path = find_config(start)
        data = parse_jsonc(path.read_text(encoding="utf-8"), str(path))
        return cls(path.parent.parent, data, path)

    def deck_names(self) -> list[str]:
        return list(self.data["decks"])

    def deck(self, name: str | None = None, cwd: Path | None = None) -> "DeckConfig":
        """Resolve one deck.

        Order: the name given (or `$SLIDE_DECK`), then the deck whose directory
        holds the working directory, then the only deck, then the only deck of
        kind `document`. Anything else is ambiguous and is refused.
        """
        decks = self.data["decks"]
        name = name or os.environ.get(DECK_ENV) or None
        if name:
            if name not in decks:
                raise ConfigError(f"{self.path}: no deck named `{name}`; declared: "
                                  + ", ".join(decks))
            return DeckConfig(self, name, decks[name])
        here = (cwd or Path.cwd()).resolve()
        holding = []
        for key, deck in decks.items():
            d = deck.get("dir") if isinstance(deck, dict) else None
            if not d:
                continue
            ddir = (self.root / d).resolve()
            if here == ddir or ddir in here.parents:
                holding.append((len(ddir.parts), key))
        if holding:
            key = max(holding)[1]
            return DeckConfig(self, key, decks[key])
        if len(decks) == 1:
            key = next(iter(decks))
            return DeckConfig(self, key, decks[key])
        documents = [k for k, d in decks.items() if isinstance(d, dict) and d.get("kind") == "document"]
        if len(documents) == 1:
            return DeckConfig(self, documents[0], decks[documents[0]])
        raise ConfigError(f"{self.path}: several decks are declared ({', '.join(decks)}); "
                          f"name one with --deck or ${DECK_ENV}")


class DeckConfig:
    """One deck's entry, with dotted lookups that refuse rather than guess."""

    def __init__(self, project: Project, name: str, data: dict):
        if not isinstance(data, dict):
            raise ConfigError(f"{project.path}: deck `{name}` must be an object")
        self.project = project
        self.name = name
        self.data = data

    @property
    def root(self) -> Path:
        return self.project.root

    def has(self, key: str) -> bool:
        return _dig(self.data, key) is not _MISSING

    def get(self, key: str, default: Any = None) -> Any:
        value = _dig(self.data, key)
        return default if value is _MISSING else value

    def require(self, key: str, what: str = "") -> Any:
        value = _dig(self.data, key)
        if value is _MISSING:
            hint = f" ({what})" if what else ""
            raise ConfigError(f"{self.project.path}: deck `{self.name}` declares no "
                              f"`{key}`{hint}; this check does not guess it")
        return value

    def resolve(self, rel: str) -> Path:
        """A path from the declaration, relative to the project root."""
        return (self.root / Path(rel).expanduser()).resolve()

    def path(self, key: str, what: str = "", must_exist: bool = True) -> Path:
        value = self.require(key, what)
        if not isinstance(value, str) or not value:
            raise ConfigError(f"{self.project.path}: deck `{self.name}` `{key}` must be a path string")
        p = self.resolve(value)
        if must_exist and not p.exists():
            raise ConfigError(f"{self.project.path}: deck `{self.name}` `{key}` names {value}, "
                              "which does not exist")
        return p

    @property
    def dir(self) -> Path:
        return self.path("dir", "the deck directory")

    @property
    def entry(self) -> Path:
        """The deck's entry file: `tool.entry`, `main.sgx` when absent."""
        return self.dir / self.get("tool.entry", "main.sgx")

    def section(self, key: str) -> dict:
        """An optional object-valued key, `{}` when absent; refuses a non-object."""
        value = self.get(key, {})
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise ConfigError(f"{self.project.path}: deck `{self.name}` `{key}` must be an object")
        return value
