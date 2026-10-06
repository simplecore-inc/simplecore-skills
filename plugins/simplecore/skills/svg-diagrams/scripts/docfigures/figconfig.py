"""A project's document-figure settings, read from `.claude/document-figures.json`.

Every value that differs between projects lives in that file: where the SVGs
land, which modules draw them, the boards and their placement, the type
ladder and the names a figure module draws with, the stroke and dash
vocabularies, the theme, the typeface stack, the icon and accent vocabularies,
the verdict hues, and the thresholds the checks apply. The library carries no
project value of its own.

A value another file owns is named rather than copied: `{"from": <file>,
"key": <dotted key>}` in place of `boards`, `placeScale` or `verdict` reads it
from that file, so the boards and the print factor a deck config declares for
the figures it places are declared once, in the deck config.

The file is found in this order:

1. the path in `DOCUMENT_FIGURES_CONFIG`
2. `.claude/document-figures.json` in the working directory or the nearest
   parent that has one

The project root is the directory holding `.claude/`, and every relative path
in the file is resolved against it.

The file may carry `//` and `/* */` comments and trailing commas. Comment
markers inside a string are data: `"http://127.0.0.1:7333/mcp"` survives. It
is read by `bidkit.config`, the plugin's one JSONC reader.
"""
import os
import re
import sys
from glob import glob
from pathlib import Path

# The plugin's one JSONC reader, shared with the deck checks. The plugin keeps
# its scripts in `plugins/<plugin>/scripts/`, four levels above this file.
_PLUGIN_SCRIPTS = Path(__file__).resolve().parents[4] / "scripts"
if str(_PLUGIN_SCRIPTS) not in sys.path:
    sys.path.append(str(_PLUGIN_SCRIPTS))
from bidkit.config import ConfigError as JsoncError  # noqa: E402
from bidkit.config import parse_jsonc, strip_jsonc  # noqa: E402,F401

CONFIG_NAME = Path(".claude") / "document-figures.json"
ENV_CONFIG = "DOCUMENT_FIGURES_CONFIG"

# The names the library's helpers draw with. A project's `names` must define
# every one of them, each on the ladder; a project may add names of its own.
HELPER_NAMES = ("MICRO", "BODY", "LEAD", "CARD", "SECTION", "EMPH", "DISPLAY")
STROKE_NAMES = ("HAIRLINE", "STROKE", "THICK")
DEFAULT_STROKES = {"HAIRLINE": 1.4, "STROKE": 1.9, "THICK": 2.8}
DASH_GLOSS_MODES = ("several", "every")


class ConfigError(Exception):
    """The settings file is missing, unreadable, or lacks a required value."""


def read_jsonc(path):
    """Parse a JSON-with-comments file, or raise ConfigError naming it."""
    try:
        raw = Path(path).read_text(encoding="utf-8")
    except OSError as err:
        raise ConfigError(f"cannot read {path}: {err}") from err
    try:
        return parse_jsonc(raw, str(path))
    except JsoncError as err:
        raise ConfigError(str(err)) from err


def find_config(start=None):
    """The settings file this run reads, or raise ConfigError saying where it looked."""
    env = os.environ.get(ENV_CONFIG)
    if env:
        path = Path(env).expanduser()
        if not path.is_file():
            raise ConfigError(f"{ENV_CONFIG} points at {path}, which is not a file")
        return path.resolve()
    here = Path(start or Path.cwd()).resolve()
    for d in (here, *here.parents):
        candidate = d / CONFIG_NAME
        if candidate.is_file():
            return candidate
    raise ConfigError(
        f"no {CONFIG_NAME} in {here} or any parent; create one (the schema is in "
        f"the svg-diagrams skill's references/document-figures.md) or set "
        f"{ENV_CONFIG}")


def _dig(data, dotted, where="the settings"):
    """The value at a dotted key path, or raise ConfigError."""
    node = data
    for part in dotted.split("."):
        if not isinstance(node, dict) or part not in node:
            raise ConfigError(f"{where}: no key {dotted!r}")
        node = node[part]
    return node


def is_reference(value):
    """Whether a value names where it lives (`{from, key}`) instead of holding it."""
    return isinstance(value, dict) and "from" in value


# A board key is its width in units. A deck config may add `<width>-<variant>`
# for a board's second placement (a pair of column figures); the figures are
# drawn on the board, so the library reads the width and skips the variant.
BOARD_KEY = re.compile(r"\d+")
BOARD_VARIANT = re.compile(r"\d+-[\w-]+")


def _hex(value, where):
    if not isinstance(value, str) or not re.fullmatch(r"#?[0-9A-Fa-f]{6}", value):
        raise ConfigError(f"{where}: {value!r} is not a #rrggbb colour")
    return "#" + value.lstrip("#")


class FigureConfig:
    """Validated settings with every relative path resolved against the root."""

    def __init__(self, data, path):
        self.data = data
        self.path = Path(path).resolve()
        # `.claude/document-figures.json` lives one level below the root.
        self.root = (self.path.parent.parent if self.path.parent.name == ".claude"
                     else self.path.parent)
        self._validate()

    # ── required values ────────────────────────────────────────────────────
    def _require(self, key):
        if key not in self.data:
            raise ConfigError(f"{self.path}: required key {key!r} is missing")
        return self.data[key]

    def _validate(self):
        self.out = self.resolve(self._require("out"))
        modules = self._require("modules")
        if not isinstance(modules, list) or not modules:
            raise ConfigError(f"{self.path}: 'modules' must be a non-empty list of globs")
        if "boards" not in self.data:
            raise ConfigError(
                f"{self.path}: required key 'boards' is missing; declare each board "
                f"width and its placed px, or name the deck config that owns them: "
                f'{{"from": ".claude/slide-decks.json", "key": "decks.<deck>.figures.boards"}}')
        boards = self.referenced("boards")
        if not isinstance(boards, dict) or not boards:
            raise ConfigError(f"{self.path}: 'boards' must map a board width to its placed px")
        try:
            self.boards = {int(w): float(px) for w, px in boards.items()
                           if BOARD_KEY.fullmatch(str(w))}
        except (TypeError, ValueError) as err:
            raise ConfigError(f"{self.path}: 'boards' values are placed px: {err}") from err
        odd = [str(w) for w in boards if not BOARD_KEY.fullmatch(str(w))
               and not BOARD_VARIANT.fullmatch(str(w))]
        if odd or not self.boards:
            raise ConfigError(f"{self.path}: 'boards' keys are board widths in units, "
                              f"not {', '.join(odd) or 'variants only'}")
        self.default_board = int(self.data.get("defaultBoard", next(iter(self.boards))))
        if self.default_board not in self.boards:
            raise ConfigError(f"{self.path}: defaultBoard {self.default_board} is not a board")
        ladder = self._require("ladder")
        if not isinstance(ladder, list) or not ladder:
            raise ConfigError(f"{self.path}: 'ladder' must be a non-empty list of sizes")
        self.ladder = tuple(sorted(float(v) for v in ladder))
        names = self._require("names")
        missing = [n for n in HELPER_NAMES if n not in names]
        if missing:
            raise ConfigError(
                f"{self.path}: 'names' must define {', '.join(missing)} - the "
                f"library's helpers draw with them")
        self.names = {k: float(v) for k, v in names.items()}
        self.names.setdefault("CHIP", self.ladder[0])
        off = sorted(k for k, v in self.names.items() if v not in self.ladder)
        if off:
            raise ConfigError(f"{self.path}: names off the ladder: {', '.join(off)}")
        for name, width in self.board_names.items():
            if width not in self.boards:
                raise ConfigError(f"{self.path}: boardNames.{name} = {width} is not a board")
        if self.column_board is not None and self.column_board not in self.boards:
            raise ConfigError(f"{self.path}: columnBoard {self.column_board} is not a board")
        if self.dash_gloss not in DASH_GLOSS_MODES:
            raise ConfigError(
                f"{self.path}: dashGloss must be one of {', '.join(DASH_GLOSS_MODES)}, "
                f"not {self.dash_gloss!r}")
        strokes = self.data.get("strokes")
        if strokes is not None:
            absent = [n for n in STROKE_NAMES if n not in strokes]
            if absent:
                raise ConfigError(f"{self.path}: 'strokes' lacks {', '.join(absent)}")

    def referenced(self, key, default=None, default_key=None):
        """The value of `key`, read from the file it names when it is `{from, key}`."""
        value = self.data.get(key, default)
        if not is_reference(value):
            return value
        source = self.resolve(value["from"])
        dotted = value.get("key", default_key)
        if not dotted:
            raise ConfigError(f"{self.path}: '{key}' names {value['from']} but no 'key' in it")
        return _dig(read_jsonc(source), dotted, f"{self.path}: '{key}' reads {source}")

    # ── paths ──────────────────────────────────────────────────────────────
    def resolve(self, rel):
        p = Path(rel).expanduser()
        return p if p.is_absolute() else (self.root / p)

    def rel(self, path):
        """`path` relative to the root when it is inside it, else as given."""
        try:
            return Path(path).resolve().relative_to(self.root.resolve())
        except ValueError:
            return Path(path)

    def glob(self, pattern):
        """Files a pattern matches, relative to the root unless absolute."""
        return sorted(Path(p) for p in glob(str(self.root / pattern), recursive=True))

    def _globs(self, key):
        found = []
        for pattern in self.data.get(key) or []:
            found += self.glob(pattern)
        seen, out = set(), []
        for p in found:
            if p.resolve() not in seen and p.is_file():
                seen.add(p.resolve())
                out.append(p)
        return out

    def module_files(self):
        """Files the `modules` globs match, in order, without duplicates."""
        return self._globs("modules")

    def helper_files(self):
        """Project helper modules: imported by figure modules, never run."""
        return self._globs("helpers")

    def source_files(self):
        """Every project file a source check reads: modules and helpers."""
        seen = {p.resolve() for p in self.module_files()}
        return self.module_files() + [p for p in self.helper_files()
                                      if p.resolve() not in seen]

    @property
    def toolkit(self):
        value = self.data.get("toolkit")
        return self.resolve(value) if value else None

    # ── boards ─────────────────────────────────────────────────────────────
    @property
    def board_names(self):
        return {k: int(v) for k, v in (self.data.get("boardNames") or {}).items()}

    @property
    def content_names(self):
        return {k: int(v) for k, v in (self.data.get("contentNames") or {}).items()}

    @property
    def column_board(self):
        value = self.data.get("columnBoard")
        return None if value is None else int(value)

    @property
    def place_scale(self):
        """The factor the document prints every figure at, after the board's placement."""
        value = self.referenced("placeScale", 1.0)
        try:
            return float(value)
        except (TypeError, ValueError) as err:
            raise ConfigError(f"{self.path}: 'placeScale' must be a number, not {value!r}") from err

    def per_board(self, key, board, default):
        """A value that is one number for every board or a {width: value} map."""
        value = self.data.get(key, default)
        if isinstance(value, dict):
            return value.get(str(int(board)), value.get(int(board), default))
        return value

    def margin(self, board):
        """The margin save() passes to trim(): it sets the air above and below."""
        return float(self.per_board("margin", board, 28))

    def side_margin(self, board):
        """The side margin the content width is computed from."""
        return float(self.per_board("sideMargin", board, 28))

    def height_review(self, board):
        value = self.per_board("heightReview", board, 840)
        return None if value is None else float(value)

    def dead_margin(self, board):
        """The side gap the verify run fails, or None to leave it to the lint."""
        value = self.per_board("deadMargin", board, None)
        return None if value is None else float(value)

    # ── vocabularies ───────────────────────────────────────────────────────
    @property
    def steps(self):
        steps = dict(self.data.get("steps") or {})
        step = float(steps.get("STEP", 18))
        return {"STEP": step, "CHIP_STEP": float(steps.get("CHIP_STEP", step))}

    @property
    def strokes(self):
        """The declared stroke ladder, or None when the project declares none."""
        value = self.data.get("strokes")
        return None if value is None else {k: float(v) for k, v in value.items()}

    @property
    def dashes(self):
        """{NAME: (pattern, words)} for every declared dash meaning."""
        out = {}
        for name, spec in (self.data.get("dashes") or {}).items():
            if isinstance(spec, str):
                out[name] = (spec, ())
            else:
                out[name] = (spec["pattern"], tuple(spec.get("words") or ()))
        return out

    @property
    def dash_gloss(self):
        """`several`: a gloss only where two meanings are drawn; `every`: always."""
        return self.data.get("dashGloss", "several")

    @property
    def verdict(self):
        """(pass, block) hues, or None when the project declares none.

        Either the two hues inline, or `{"from": <file>, "key": <dotted key>}`
        naming the object that holds them, so a deck and its figures read one
        declaration.
        """
        spec = self.referenced("verdict", default_key="verdict")
        if spec is None:
            return None
        return (_hex(spec.get("pass"), "verdict.pass"),
                _hex(spec.get("block"), "verdict.block"))

    def get(self, key, default=None):
        return self.data.get(key, default)


def load(path=None):
    """Read and validate the settings this run uses."""
    path = Path(path) if path else find_config()
    data = read_jsonc(path)
    if not isinstance(data, dict):
        raise ConfigError(f"{path}: the top level must be an object")
    return FigureConfig(data, path)
