"""The manuscript a document deck is typeset from.

Declared in the deck's `manuscript` key, either as the directory alone
(`"manuscript": "proposal"`) or as an object:

    "manuscript": {
      "dir": "proposal",
      "printed": "## 인쇄 원고",          // the heading that opens a file's printed part
      "page": "### ",                     // the heading prefix that opens one printed page
      "declaration": "<!--\\s*md:",        // how a deck page names its manuscript source
      "caption": "^캡션: ",                // the line that carries a figure caption
      "exclude": ["README.md"],           // globs, relative to dir, that are not manuscript
      "annex": ["10-별첨/**"]              // globs of annex files, counted apart
    }

The headings and markers are the manuscript's own conventions, so none has a
default a check could rely on silently: a helper that needs one asks for it.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from fnmatch import fnmatchcase
from pathlib import Path

from .config import ConfigError, DeckConfig

MD_PATH = re.compile(r"[^\s,·「」]+\.md")


@dataclass
class Manuscript:
    dir: Path
    printed: str | None = None
    page: str | None = None
    declaration: str | None = None
    caption: str | None = None
    exclude: list = field(default_factory=list)
    annex: list = field(default_factory=list)

    @classmethod
    def for_deck(cls, deck: DeckConfig) -> "Manuscript":
        decl = deck.require("manuscript", "the manuscript directory the pages are set from")
        if isinstance(decl, str):
            decl = {"dir": decl}
        if not isinstance(decl, dict) or not decl.get("dir"):
            raise ConfigError(f"deck `{deck.name}` `manuscript` must be a directory or an object with `dir`")
        path = deck.resolve(decl["dir"])
        if not path.is_dir():
            raise ConfigError(f"deck `{deck.name}` `manuscript.dir` {decl['dir']} is not a directory")
        return cls(path, decl.get("printed"), decl.get("page"), decl.get("declaration"),
                   decl.get("caption"), list(decl.get("exclude", [])), list(decl.get("annex", [])))

    def _need(self, key: str) -> str:
        value = getattr(self, key)
        if not value:
            raise ConfigError(f"`manuscript.{key}` is not declared; this helper does not guess "
                              "the manuscript's convention")
        return value

    @staticmethod
    def _matches(rel: str, globs: list) -> bool:
        """A glob over the path relative to `dir`; `*` crosses directories."""
        return any(fnmatchcase(rel, g) for g in globs)

    def files(self, include_excluded: bool = False, annex: bool | None = None) -> list[Path]:
        """Every `.md` under the manuscript directory, sorted.

        `annex=True` keeps only annex files, `False` drops them, `None` keeps both.
        """
        out = []
        for p in sorted(self.dir.rglob("*.md")):
            rel = p.relative_to(self.dir).as_posix()
            if not include_excluded and self._matches(rel, self.exclude):
                continue
            is_annex = self._matches(rel, self.annex)
            if annex is True and not is_annex or annex is False and is_annex:
                continue
            out.append(p)
        return out

    def printed_pages(self, md: str) -> list[tuple[str, str]]:
        """(page title, page text) for each printed page of one manuscript file."""
        printed, page = self._need("printed"), self._need("page")
        m = re.search(rf"^{re.escape(printed.strip())}\s*$", md, flags=re.M)
        if not m:
            return []
        level = len(printed) - len(printed.lstrip("#"))
        rest = md[m.end():]
        stop = re.search(rf"^{'#' * level} (?!#)", rest, flags=re.M)
        if stop:
            rest = rest[:stop.start()]
        head = re.escape(page)
        chunks = [c for c in re.split(rf"(?=^{head})", rest, flags=re.M) if re.match(rf"^{head}", c)]
        out = []
        for chunk in chunks:
            first, _, body = chunk.partition("\n")
            out.append((first[len(page):].strip(), body))
        return out

    def captions(self, md: str) -> list[str]:
        """The caption lines of one manuscript file, fenced code excluded."""
        pattern = self._need("caption")
        text = re.sub(r"^```.*?^```", "", md, flags=re.S | re.M)
        rx = re.compile(pattern if pattern.startswith("^") else "^" + pattern, re.M)
        return [line[m.end():].strip() for line in text.splitlines()
                for m in [rx.match(line)] if m]

    def declarations(self, raw: str) -> list[str]:
        """The manuscript paths a deck source names in its declaration comments."""
        start = self._need("declaration")
        out = []
        for decl in re.findall(rf"{start}\s*(.+?)-->", raw, re.S):
            out.extend(MD_PATH.findall(decl))
        return out
