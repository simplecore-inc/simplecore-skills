"""The built `.pptx`, read for a check that measures what the builder drew.

Some properties exist only in the built file: which boxes the builder framed
and how tall it made them, what colour and size each run prints in. The file
is the deck's declared `output`; one older than the deck's sources is refused,
because a measurement of a stale build reads exactly like a measurement of the
deck.

Lengths are converted to the deck's px through the slide width the file
declares (`ppt/presentation.xml`) and the deck's `page.w`.
"""
from __future__ import annotations

import re
import zipfile
from dataclasses import dataclass
from html import unescape
from pathlib import Path

from .config import ConfigError, DeckConfig
from .deckread import DeckError

SLIDE = re.compile(r"ppt/slides/slide(\d+)\.xml")
SLD_SZ = re.compile(r'<p:sldSz\b[^>]*\bcx="(\d+)"')
SP = re.compile(r"<p:sp>(.*?)</p:sp>", re.S)
XFRM = re.compile(r'<a:off x="(-?\d+)" y="(-?\d+)"/>\s*<a:ext cx="(\d+)" cy="(\d+)"/>')
OFF = re.compile(r'<a:off x="(-?\d+)" y="(-?\d+)"')
EXT = re.compile(r'<a:ext cx="(\d+)" cy="(\d+)"')
LNSPC = re.compile(r'<a:lnSpc><a:spcPct val="(\d+)"/></a:lnSpc>')
RUN = re.compile(r"<a:r>(.*?)</a:r>", re.S)
SZ = re.compile(r'\bsz="(\d+)"')
BOLD = re.compile(r'\bb="1"')
TEXT = re.compile(r"<a:t>(.*?)</a:t>", re.S)
SRGB = re.compile(r'<a:srgbClr val="([0-9A-Fa-f]{6})"')
SOURCE_SUFFIXES = (".xml", ".sgx", ".json", ".svg", ".png", ".jpg", ".jpeg")


@dataclass
class Run:
    text: str
    size_pt: float | None     # None: the run does not set a size
    bold: bool
    colour: str               # "" when the run does not set one


@dataclass
class TextBox:
    x: float                  # px
    y: float
    w: float
    h: float
    line_ratio: float
    runs: list

    @property
    def text(self) -> str:
        return "".join(r.text for r in self.runs)


def output(deck: DeckConfig) -> Path:
    """The deck's built `.pptx`; an error when it is missing or older than the deck."""
    path = deck.path("output", "the built .pptx", must_exist=False)
    if not path.is_file():
        raise ConfigError(f"no built deck at {path}; render the deck first (its `render` command)")
    ddir = deck.dir
    newest = max((p.stat().st_mtime for p in ddir.rglob("*")
                  if p.is_file() and p.suffix.lower() in SOURCE_SUFFIXES
                  and path.parent not in p.parents), default=0.0)
    if newest > path.stat().st_mtime:
        raise DeckError(f"{path} is older than the deck's sources under {ddir}; render it again "
                        "before measuring it")
    return path


class Built:
    """One built deck: its slides' XML and the px per EMU of its page."""

    def __init__(self, path: Path, page_w: float):
        self.path = path
        try:
            with zipfile.ZipFile(path) as z:
                pres = z.read("ppt/presentation.xml").decode("utf-8")
                self.slides = {int(m.group(1)): z.read(n).decode("utf-8")
                               for n in z.namelist() for m in [SLIDE.fullmatch(n)] if m}
        except (zipfile.BadZipFile, KeyError) as e:
            raise DeckError(f"{path} is not a readable .pptx: {e}") from e
        size = SLD_SZ.search(pres)
        if not size:
            raise DeckError(f"{path}: ppt/presentation.xml declares no slide size")
        self.emu_per_px = int(size.group(1)) / float(page_w)

    @classmethod
    def for_deck(cls, deck: DeckConfig) -> "Built":
        page_w = deck.require("page.w", "the page width in px the deck is set at")
        return cls(output(deck), float(page_w))

    def px(self, emu: str | int) -> float:
        return int(emu) / self.emu_per_px

    def text_boxes(self, n: int) -> list[TextBox]:
        """Every text box on slide `n`: its rect in px, its line spacing, its runs."""
        out = []
        for body in SP.findall(self.slides.get(n, "")):
            if "<p:txBody>" not in body:
                continue
            box = XFRM.search(body)
            if not box:
                continue
            x, y, w, h = (self.px(v) for v in box.groups())
            spc = LNSPC.search(body)
            runs = []
            for run in RUN.findall(body):
                t = TEXT.search(run)
                if not t:
                    continue
                size, colour = SZ.search(run), SRGB.search(run)
                runs.append(Run(unescape(t.group(1)),
                                int(size.group(1)) / 100.0 if size else None,
                                bool(BOLD.search(run)),
                                colour.group(1).upper() if colour else ""))
            out.append(TextBox(x, y, w, h, int(spc.group(1)) / 100000.0 if spc else 1.0, runs))
        return out


# Hangul breaks between syllables, not only at spaces: a space-only splitter
# reads a sentence of Hangul with two spaces as three unbreakable words and
# reports a full line where the builder had room.
TOKEN = re.compile(r"[가-힣]\s*|\S+?(?=[가-힣])|\S+\s*|\s+")


def wrapped(text: str, width_px: float, size_px: float, text_width) -> int:
    """Lines `text` takes in a box `width_px` wide at `size_px`.

    `text_width` gives a string's advance in ems (a `glyphwidth.Font`'s).
    """
    lines, current = 1, ""
    for token in TOKEN.findall(text):
        candidate = current + token
        if text_width(candidate.rstrip()) * size_px > width_px and current.strip():
            lines += 1
            current = token.lstrip()
        else:
            current = candidate
    return lines
