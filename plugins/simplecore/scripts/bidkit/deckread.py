"""Reading a deck's words and pages from the server that holds it.

Two readings, both through `sgmcp`:

- `files()`: the deck's own source files in import order, as the server holds
  them (`sg://deck/markup`). Checks about what a source slot carries read these.
- `slides()`: every slide as printed (`sg://deck/content?format=json`), the kit
  components expanded into the text they draw. Most of a page's words live in
  component arguments and JSON item lists, so a check that strips tags from the
  source reads an almost empty page; the printed text is what a reader sees.

Page ids and folios are computed here and nowhere else, from the deck's
`pages` declaration over the kit vocabulary's defaults:

    "pages": {
      "numerals": ["Ⅰ", "Ⅱ", ...],                 // part number 1 is the first entry
      "id": "{part}-{chapter} {ordinal:02}",       // fields: part, chapter, ordinal
      "head": {"component": ..., "part": ..., "chapter": ..., "title": ...},
      "masters": {"body": [...], "folioless": [...], "annex": [...], ...}
    }

The part comes from the running head's part argument, the chapter from the
number at the start of its chapter argument, and the ordinal by counting that
chapter's body pages in printed order. Two pages computing one id is an error:
the id format has dropped a field that tells them apart.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from html import unescape
from typing import Any, Iterator

from .config import ConfigError, DeckConfig
from .sgmcp import Session, split_markup
from .vocab import Vocabulary

MASTER_KINDS = ("body", "divider", "folioless", "annex", "fullBleed")


class DeckError(ValueError):
    """The deck as read contradicts the declaration (a duplicate page id)."""


@dataclass
class Use:
    """One component drawn on a slide, as the printed model nests it."""
    tag: str                       # the template's name
    attrs: dict                    # its arguments as the model holds them
    key: str                       # the model's node key
    depth: int                     # 0 for a block standing on the page, +1 per enclosing use
    parent: str | None = None      # the tag of the enclosing use, None on the page


@dataclass
class Span:
    """One printed string and where it came from."""
    text: str
    component: str | None          # the nearest enclosing use's tag
    origin: str                    # the model's origin without its arrow: `arg:title`,
                                   # `row[0].entry.definition`, `mixed`, `template:...`
    key: str = ""

    @property
    def field(self) -> str:
        """The argument or item field the string was drawn from (`title`, `definition`)."""
        if self.origin.startswith("arg:"):
            return self.origin[4:]
        if self.origin.startswith("row["):
            return self.origin.rsplit(".", 1)[-1]
        return ""


@dataclass
class Page:
    n: int                         # slide number in the built deck
    master: str
    head: dict                     # the running head's arguments ({} without one)
    texts: list                    # printed strings in reading order (master chrome excluded)
    rows: list = field(default_factory=list)   # [(table key, [cells])] per table row
    notes: str = ""
    uses: list = field(default_factory=list)   # [Use] in reading order, running head excluded
    spans: list = field(default_factory=list)  # [Span], one per printed string of `texts`
    folio: int | None = None       # body folio, None for folioless and annex pages
    page_id: str | None = None     # computed from `pages.id` for a body page
    part: str | None = None        # the part numeral of a body page
    chapter: str | None = None     # the chapter number of a body page
    ordinal: int | None = None

    @property
    def text(self) -> str:
        return " ".join(self.texts)

    @property
    def label(self) -> str:
        return self.page_id or f"slide {self.n}"

    @property
    def chapter_key(self) -> str | None:
        """`<part>-<chapter>`, the page id without its ordinal."""
        if self.part is None or self.chapter is None:
            return None
        return f"{self.part}-{self.chapter}"


@dataclass
class PagesConfig:
    numerals: list
    id_format: str
    head: dict
    masters: dict

    @classmethod
    def from_deck(cls, deck: DeckConfig, vocab: Vocabulary | None) -> "PagesConfig":
        declared = deck.section("pages")
        kit = vocab.pages() if vocab else {}
        numerals = declared.get("numerals")
        if not isinstance(numerals, list) or not numerals:
            raise ConfigError(f"deck `{deck.name}` declares no `pages.numerals` "
                              "(the part numerals, first part first); page ids cannot be computed")
        id_format = declared.get("id")
        if not isinstance(id_format, str) or not id_format:
            raise ConfigError(f"deck `{deck.name}` declares no `pages.id` "
                              "(a format over part, chapter and ordinal)")
        head = {**kit.get("head", {}), **declared.get("head", {})}
        masters = {**kit.get("masters", {}), **declared.get("masters", {})}
        for key in ("component", "part", "chapter"):
            if not head.get(key):
                raise ConfigError(f"deck `{deck.name}`: neither `pages.head.{key}` nor the kit "
                                  "vocabulary names the running head's "
                                  + {"component": "component", "part": "part argument",
                                     "chapter": "chapter argument"}[key])
        for key in ("body", "folioless", "annex"):
            if not isinstance(masters.get(key), list):
                raise ConfigError(f"deck `{deck.name}`: neither `pages.masters.{key}` nor the kit "
                                  "vocabulary lists those master name prefixes")
        try:
            id_format.format(part="Ⅰ", chapter="1", ordinal=1)
        except (KeyError, IndexError, ValueError) as e:
            raise ConfigError(f"deck `{deck.name}` `pages.id` {id_format!r} is not a format over "
                              f"part, chapter and ordinal: {e}") from e
        return cls(numerals, id_format, head, masters)

    def is_(self, kind: str, master: str) -> bool:
        return master.startswith(tuple(self.masters.get(kind, [])))


USE = re.compile(r'<Use\s+template="([\w-]+)"((?:"[^"]*"|\'[^\']*\'|[^>"\'])*?)/?>', re.S)
ATTR = re.compile(r'(\w+)=(?:"([^"]*)"|\'([^\']*)\')')
ANY_ATTR = re.compile(r'(?<![\w-])([\w.-]+)=(?:"([^"]*)"|\'([^\']*)\')')
COMMENT = re.compile(r"<!--.*?-->", re.S)
TEMPLATE = re.compile(r'<Template\b((?:"[^"]*"|[^>"])*)>', re.S)
TEMPLATE_ATTR = re.compile(r'([\w.-]+)="([^"]*)"')
# A slide line of `sg://deck`: `6  master=BODY-1  ...  use:pages/11-overview.xml#1 › ...`
SLIDE_LINE = re.compile(r"^\s*(\d+)\s+master=\S+.*?\buse:([^\s#›]+)#")


def uses(raw: str) -> Iterator[tuple[str, dict, int]]:
    """(template, {attr: unescaped value}, offset) for every `<Use>` in a source file."""
    for m in USE.finditer(raw):
        attrs = {a: unescape(b if b or not c else c) for a, b, c in ATTR.findall(m.group(2))}
        yield m.group(1), attrs, m.start()


def attribute_values(raw: str) -> Iterator[tuple[str, str]]:
    """(name, unescaped value) for every attribute of every element in a source file."""
    for name, b, c in ANY_ATTR.findall(COMMENT.sub("", raw)):
        yield name, unescape(b if b or not c else c)


def json_strings(value: str) -> list[str]:
    """Every string leaf of an argument holding JSON, or [] when it is not JSON."""
    try:
        data = json.loads(value)
    except (ValueError, TypeError):
        return []
    out: list[str] = []

    def walk(v: Any) -> None:
        if isinstance(v, str):
            out.append(v)
        elif isinstance(v, list):
            for x in v:
                walk(x)
        elif isinstance(v, dict):
            for x in v.values():
                walk(x)
    walk(data)
    return out


def strip_comments(raw: str) -> str:
    return COMMENT.sub("", raw)


def printed_source(raw: str) -> str:
    """A source file with comments removed and entities unescaped."""
    return unescape(strip_comments(raw))


class DeckReader:
    """The deck as one server holds it, read once and cached."""

    def __init__(self, session: Session, deck: DeckConfig, vocab: Vocabulary | None = None):
        self.session = session
        self.deck = deck
        self.vocab = vocab
        self._pages: PagesConfig | None = None
        self._files: list | None = None
        self._slides: list | None = None
        self._markup: dict | None = None
        self._templates: dict | None = None
        self._sources: dict | None = None

    def close(self) -> None:
        self.session.close()

    def __enter__(self) -> "DeckReader":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    @property
    def pages_config(self) -> PagesConfig:
        if self._pages is None:
            self._pages = PagesConfig.from_deck(self.deck, self.vocab)
        return self._pages

    def files(self) -> list[tuple[str, str]]:
        """[(file name, source)] for the deck's imported files, in import order."""
        if self._files is None:
            sources = split_markup(self.session.read("sg://deck/markup"))
            entry = self.deck.get("tool.entry", "main.sgx")
            if entry not in sources:
                raise DeckError(f"sg://deck/markup holds no {entry}; declare tool.entry")
            order = re.findall(r'<Import\s+src="([^"]+)"', strip_comments(sources[entry]))
            missing = [p for p in order if p not in sources]
            if missing:
                raise DeckError(f"{entry} imports files the server does not hold: {', '.join(missing)}")
            self._files = [(p.rsplit("/", 1)[-1], sources[p]) for p in order]
        return self._files

    def markup(self) -> dict[str, str]:
        """Every source the server holds for the deck, the kit's included: {path: text}."""
        if self._markup is None:
            self._markup = split_markup(self.session.read("sg://deck/markup"))
        return self._markup

    def templates(self) -> dict[str, dict]:
        """{name: declaration attributes} for every `<Template>` the deck can use.

        The kit's components and the deck's own both declare themselves on the
        opening tag (`kind`, `form`, `doc`, `use`, `tags`), so a check groups
        components by what they declare rather than by a list of names.
        """
        if self._templates is None:
            out: dict[str, dict] = {}
            for path, text in self.markup().items():
                for m in TEMPLATE.finditer(strip_comments(text)):
                    attrs = {a: unescape(b) for a, b in TEMPLATE_ATTR.findall(m.group(1))}
                    if attrs.get("name"):
                        attrs["file"] = path
                        out.setdefault(attrs["name"], attrs)
            self._templates = out
        return self._templates

    def slide_sources(self) -> dict[int, str]:
        """{slide number: the source file whose page component drew it} from `sg://deck`."""
        if self._sources is None:
            out: dict[int, str] = {}
            for line in self.session.read("sg://deck").splitlines():
                m = SLIDE_LINE.match(line)
                if m:
                    out[int(m.group(1))] = m.group(2).rsplit("/", 1)[-1]
            self._sources = out
        return self._sources

    def slides(self) -> list[Page]:
        """Every slide as printed, with folio and page id where it has one."""
        if self._slides is not None:
            return self._slides
        cfg = self.pages_config
        try:
            data = json.loads(self.session.read("sg://deck/content?format=json"))
        except json.JSONDecodeError as e:
            raise DeckError("sg://deck/content?format=json is not JSON") from e
        out = []
        for item in data:
            s = Page(n=item["slide"], master="", head={}, texts=[])
            for block in item.get("blocks", []):
                if block.get("role") == "master":
                    s.master = block.get("key", "").removeprefix("master:")
                _walk(block, s, cfg.head["component"])
            out.append(s)
        folio, ordinal, seen = 0, {}, {}
        for s in out:
            if cfg.is_("annex", s.master) or (folio == 0 and cfg.is_("folioless", s.master)):
                continue
            folio += 1
            s.folio = folio
            if not cfg.is_("body", s.master):
                continue
            tone = str(s.head.get(cfg.head["part"], "")).strip()
            num = str(s.head.get(cfg.head["chapter"], "")).split(".")[0].strip()
            if not (tone.isdigit() and num.isdigit()):
                continue
            index = int(tone)
            if not 1 <= index <= len(cfg.numerals):
                raise DeckError(f"slide {s.n}: part {tone} has no numeral in pages.numerals")
            key = (cfg.numerals[index - 1], num)
            ordinal[key] = ordinal.get(key, 0) + 1
            s.part, s.chapter, s.ordinal = key[0], key[1], ordinal[key]
            s.page_id = cfg.id_format.format(part=key[0], chapter=key[1], ordinal=ordinal[key])
            if s.page_id in seen:
                raise DeckError(f"page id {s.page_id} is computed for slides {seen[s.page_id]} and "
                                f"{s.n}; pages.id drops a field that tells them apart")
            seen[s.page_id] = s.n
        self._slides = out
        return out

    def body_pages(self) -> list[Page]:
        return [s for s in self.slides() if s.page_id]

    def tables(self, join_continued: bool = False) -> Iterator[tuple[str, int, list]]:
        """(page label, table index on that page, rows) for every printed table.

        The rows are the cells as printed, header row first, read from the
        rendered table rather than a component's argument, so a table drawn by
        any component is read the same way.

        With `join_continued`, a table that runs onto the next page is read as
        one: the last table of a slide and the first table of the next slide
        with the same header row are the same table, broken at the page with
        its header repeated. A column that varies over the whole table is then
        judged over the whole of it, not over the rows that landed on one page.
        The label and index are those of the first piece.
        """
        pieces = []                       # (slide position, label, index, is_last, is_first, grid)
        for pos, s in enumerate(self.slides()):
            order, grid = [], {}
            for key, cells in s.rows:
                if key not in grid:
                    order.append(key)
                    grid[key] = []
                grid[key].append(cells)
            for index, key in enumerate(order, 1):
                pieces.append((pos, s.label, index, index == len(order), index == 1, grid[key]))
        if not join_continued:
            for _, label, index, _, _, rows in pieces:
                yield label, index, rows
            return
        joined: list[list] = []           # [last pos, label, index, last piece is_last, rows]
        for pos, label, index, is_last, is_first, rows in pieces:
            prev = joined[-1] if joined else None
            if (prev and rows and prev[4] and prev[3] and is_first and pos == prev[0] + 1
                    and prev[4][0] == rows[0]):
                prev[4].extend(rows[1:])
                prev[0], prev[3] = pos, is_last
                continue
            joined.append([pos, label, index, is_last, [list(r) for r in rows]])
        for _, label, index, _, rows in joined:
            yield label, index, rows


def _walk(node: dict, slide: Page, head_component: str, use: str | None = None,
          depth: int = 0) -> None:
    """Collect one slide's head, rows, strings and component uses.

    `use` is the tag of the nearest enclosing component and `depth` the number
    of components enclosing this node, the running head not counted.
    """
    role = node.get("role")
    if role == "master":
        return                       # the master's chrome is the same on every page
    if role == "notes":
        slide.notes = node.get("text", "")
        return
    if role == "use":
        tag = node.get("tag", "")
        attrs = node.get("attrs", {}) or {}
        if tag == head_component:
            if not slide.head:
                slide.head = attrs
            for child in node.get("children", []):
                _walk(child, slide, head_component, tag, depth)
            return
        slide.uses.append(Use(tag, attrs, node.get("key", ""), depth, use))
        for child in node.get("children", []):
            _walk(child, slide, head_component, tag, depth + 1)
        return
    if role == "row":
        cells = [c.strip() for c in node.get("aux", "").strip().strip("|").split(" | ")]
        table = node.get("key", "").split("/row:")[0]
        slide.rows.append((table, cells))
        slide.texts.extend(cells)
        slide.spans.extend(Span(c, use, "cell", table) for c in cells)
    elif role in ("text", "title"):
        runs = node.get("runs")
        text = "".join(r.get("text", "") for r in runs) if runs else node.get("text", "")
        if text.strip():
            slide.texts.append(text)
            origin = str(node.get("origin", "")).lstrip("←").strip()
            slide.spans.append(Span(text, use, origin, node.get("key", "")))
    for child in node.get("children", []):
        _walk(child, slide, head_component, use, depth)
