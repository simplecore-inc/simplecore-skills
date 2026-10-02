"""Glyph advance widths read from the font files the deck is built with.

A check that counts the lines a string takes has to measure it with the face
the builder sets it in; an estimate per script reports a line too few or too
many exactly where the finding matters. The widths come from the font's own
`cmap` and `hmtx` tables, read with the standard library (TrueType and
OpenType, `cmap` formats 4 and 12).

Which file: the face a check asks for by role (`body`, `bold`) is named by the
deck's `type.faces.<role>` or the kit vocabulary's `fonts.<role>`, as a font
file stem (`Pretendard-Regular`), and found among the fonts the server builds
the deck with (the `fonts=` option of `sg://deck`). A face that cannot be
found or read is an error: a check that measures with a guess instead reads
like one that measured.
"""
from __future__ import annotations

import re
import struct
from pathlib import Path

from .config import ConfigError, DeckConfig
from .deckread import DeckReader
from .textko import fallback_width
from .vocab import Vocabulary


class FontError(ConfigError):
    """A face is not declared, not among the deck's fonts, or not readable."""


class Font:
    """One face's advance widths, as a fraction of the em."""

    def __init__(self, path: Path):
        self.path = Path(path)
        try:
            data = self.path.read_bytes()
        except OSError as e:
            raise FontError(f"cannot read the font {self.path}: {e}") from e
        try:
            self._load(data)
        except (struct.error, KeyError, ValueError, IndexError) as e:
            raise FontError(f"{self.path} is not a readable TrueType or OpenType font: {e}") from e
        self.missing: set[str] = set()
        self._cache: dict[str, float] = {}

    def _load(self, data: bytes) -> None:
        tag = data[:4]
        if tag == b"ttcf":
            raise ValueError("a font collection; name one face's file")
        if tag not in (b"\x00\x01\x00\x00", b"OTTO", b"true"):
            raise ValueError(f"unknown sfnt version {tag!r}")
        count = struct.unpack(">H", data[4:6])[0]
        tables = {}
        for i in range(count):
            rec = data[12 + 16 * i:28 + 16 * i]
            name, _, offset, length = struct.unpack(">4sIII", rec)
            tables[name.decode("latin-1")] = (offset, length)
        head, hhea, hmtx = tables["head"], tables["hhea"], tables["hmtx"]
        self.upem = struct.unpack(">H", data[head[0] + 18:head[0] + 20])[0]
        if not self.upem:
            raise ValueError("unitsPerEm is 0")
        metrics = struct.unpack(">H", data[hhea[0] + 34:hhea[0] + 36])[0]
        advances = struct.unpack(f">{'Hh' * metrics}", data[hmtx[0]:hmtx[0] + 4 * metrics])[0::2]
        self.advances = list(advances)
        self.cmap = self._cmap(data, tables["cmap"][0])
        if not self.cmap:
            raise ValueError("no Unicode cmap subtable of format 4 or 12")

    @staticmethod
    def _cmap(data: bytes, base: int) -> dict[int, int]:
        count = struct.unpack(">H", data[base + 2:base + 4])[0]
        subtables = []
        for i in range(count):
            pid, eid, off = struct.unpack(">HHI", data[base + 4 + 8 * i:base + 12 + 8 * i])
            fmt = struct.unpack(">H", data[base + off:base + off + 2])[0]
            rank = {(3, 10): 0, (0, 4): 1, (0, 6): 1, (3, 1): 2, (0, 3): 3}.get((pid, eid), 9)
            if fmt in (4, 12):
                subtables.append((rank, fmt, base + off))
        if not subtables:
            return {}
        out: dict[int, int] = {}
        # Read every Unicode subtable, best first, so a BMP-only one fills what a
        # full one lacks and never overrides it.
        for _, fmt, at in sorted(subtables):
            table = Font._format12(data, at) if fmt == 12 else Font._format4(data, at)
            for code, glyph in table.items():
                out.setdefault(code, glyph)
        return out

    @staticmethod
    def _format4(data: bytes, at: int) -> dict[int, int]:
        segs = struct.unpack(">H", data[at + 6:at + 8])[0] // 2
        ends = struct.unpack(f">{segs}H", data[at + 14:at + 14 + 2 * segs])
        p = at + 16 + 2 * segs
        starts = struct.unpack(f">{segs}H", data[p:p + 2 * segs])
        deltas = struct.unpack(f">{segs}h", data[p + 2 * segs:p + 4 * segs])
        range_at = p + 4 * segs
        offsets = struct.unpack(f">{segs}H", data[range_at:range_at + 2 * segs])
        out: dict[int, int] = {}
        for i in range(segs):
            start, end, delta, ro = starts[i], ends[i], deltas[i], offsets[i]
            if start == 0xFFFF:
                continue
            for code in range(start, end + 1):
                if ro == 0:
                    glyph = (code + delta) & 0xFFFF
                else:
                    g_at = range_at + 2 * i + ro + 2 * (code - start)
                    glyph = struct.unpack(">H", data[g_at:g_at + 2])[0]
                    if glyph:
                        glyph = (glyph + delta) & 0xFFFF
                if glyph:
                    out[code] = glyph
        return out

    @staticmethod
    def _format12(data: bytes, at: int) -> dict[int, int]:
        groups = struct.unpack(">I", data[at + 12:at + 16])[0]
        out: dict[int, int] = {}
        for i in range(groups):
            start, end, glyph = struct.unpack(">III", data[at + 16 + 12 * i:at + 28 + 12 * i])
            for k, code in enumerate(range(start, end + 1)):
                out[code] = glyph + k
        return out

    def width(self, ch: str) -> float:
        """The advance of one character as a share of the em.

        A character the face has no glyph for is set by the builder in a
        fallback face this module does not know, so it is estimated and named
        in `missing` for the check to report.
        """
        hit = self._cache.get(ch)
        if hit is not None:
            return hit
        glyph = self.cmap.get(ord(ch))
        if glyph is None:
            self.missing.add(ch)
            w = fallback_width(ch)
        else:
            w = self.advances[min(glyph, len(self.advances) - 1)] / self.upem
        self._cache[ch] = w
        return w

    def text_width(self, text: str) -> float:
        """The advance of a string as a share of the em."""
        return sum(self.width(c) for c in text)


FONTS_OPTION = re.compile(r"\bfonts=(\S+)")


def deck_fonts(reader: DeckReader) -> list[Path]:
    """The font files the server builds the deck with (`sg://deck` options)."""
    m = FONTS_OPTION.search(reader.session.read("sg://deck"))
    if not m or m.group(1) == "-":
        return []
    return [Path(p) for p in m.group(1).split(",") if p]


def face(reader: DeckReader, deck: DeckConfig, vocab: Vocabulary | None, role: str,
         weight: str = "Regular") -> Font:
    """The face the deck sets `role` text in at `weight`, loaded; an error when it cannot be.

    `role` names a family in the deck's `type.faces.<role>` or the kit
    vocabulary's `fonts.<role>` (`sans`: `Pretendard`). The file is the deck
    font whose stem is `<family>-<weight>` with spaces dropped, or the family
    itself when it names a file stem or a font path.
    """
    name = deck.get(f"type.faces.{role}")
    if not name and vocab is not None:
        name = (vocab.data.get("fonts") or {}).get(role)
    if not name or not isinstance(name, str):
        raise FontError(f"neither `type.faces.{role}` nor the kit vocabulary's `fonts.{role}` "
                        "names the face this check measures with")
    direct = deck.resolve(name)
    if direct.suffix.lower() in (".ttf", ".otf") and direct.is_file():
        return Font(direct)
    available = deck_fonts(reader)
    family = name.replace(" ", "")
    for stem in (f"{family}-{weight}", family):
        for path in available:
            if path.stem == stem:
                return Font(path)
    listed = ", ".join(p.stem for p in available) or "none"
    raise FontError(f"the face `{name}` {weight} ({role}) is not among the fonts the server builds "
                    f"the deck with ({listed}); a check that measured with an estimate would read "
                    "as measured")
