"""Korean text helpers the checks share: normalising, sentences, particles, wrapping.

Two checks that measure the same thing must share the code that measures it,
or one ships the bug the other fixed; these are the measurements more than one
check needs.
"""
from __future__ import annotations

import re
from typing import Callable

# Particles a noun phrase sheds before it is used as a key. Longer forms first,
# so 「으로」 is stripped whole rather than leaving 「으」.
PARTICLES = ("으로", "까지", "부터", "은", "는", "이", "가", "을", "를", "의", "에", "로",
             "와", "과", "도", "만")
_PARTICLE = re.compile("(?:" + "|".join(PARTICLES) + ")$")


def norm(s: str) -> str:
    """Collapse whitespace and unify the punctuation that differs by layout.

    SlideGlance writes an explicit line break as the two characters `\\n`; a
    manuscript writes a link as `[text](url)` where the page prints the text
    and the address without its scheme; emphasis marks do not print. All of
    these read as the same sentence.
    """
    s = s.replace(r"\n", " ").replace("\v", " ")
    s = re.sub(r"<[^>]+>", "", s)          # inline spans
    s = s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    s = s.replace("“", '"').replace("”", '"')
    s = s.replace("‘", "'").replace("’", "'")
    s = s.replace("「", "").replace("」", "").replace("`", "")
    s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1 (\2)", s)
    s = re.sub(r"https?://(?:www\.)?", "", s)
    # An emphasis mark may be followed by a particle (「**근거**는」); only a mark
    # followed by a digit or a Latin letter is kept, which is multiplication.
    s = re.sub(r"(?<![^\s(\[])\*{1,3}(?=\S)|(?<=\S)\*{1,3}(?![0-9A-Za-z])", "", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


# The separators, brackets, dashes and full stop a layout changes. The dash
# characters in this class are data: a cell may carry any of them.
_LOOSE = re.compile(r"[\s·,、/+()\[\]\u2014\u2013\-~:;.]")


def loose(s: str) -> str:
    """Drop the punctuation layout changes, to tell "shortened to fit" from
    "says something else". The full stop goes too: a deck closes a sentence in
    a cell with one and a manuscript's table cell carries none."""
    return _LOOSE.sub("", s)


def sentences(text: str, end: str = "다.") -> list[str]:
    """Split on sentence ends, keeping the terminator off the result.

    `end` is the sentence ending of the document's register (「다.」 for -다체).
    A full stop followed by a space and a capital or Hangul also ends one.
    """
    e = re.escape(end)
    parts = re.split(rf"(?<={e})\s+|(?<={e})$|\.\s+(?=[가-힣A-Z])", text)
    return [p.strip(" .") for p in parts if p and p.strip(" .")]


def strip_particle(word: str) -> str:
    """A token without the particle that closes it (「화면을」 -> 「화면」)."""
    return _PARTICLE.sub("", word)


# Fallback advance widths as a share of the em, for when no font metrics are
# handed in. They are an estimate: a full-width script at 0.95 em, Latin at 0.5.
FALLBACK_WIDE = 0.95
FALLBACK_LATIN = 0.5
FALLBACK_SPACE = 0.3
_WIDE = ((0xAC00, 0xD7A3), (0x1100, 0x11FF), (0x3130, 0x318F), (0x4E00, 0x9FFF),
         (0x3000, 0x303F), (0xFF00, 0xFF60), (0x2160, 0x217F))


def fallback_width(ch: str) -> float:
    if ch.isspace():
        return FALLBACK_SPACE
    code = ord(ch)
    if any(a <= code <= b for a, b in _WIDE):
        return FALLBACK_WIDE
    return FALLBACK_LATIN


def wrapped_lines(text: str, box: float, width_of: Callable[[str], float] = fallback_width) -> int:
    """Lines a string takes in a box, wrapping at spaces the way a renderer does.

    `box` and `width_of` share one unit (ems by default). Dividing the total
    width by the line width assumes the text packs with no gaps, which
    under-counts every line whose last word does not fit; this wraps greedily
    and breaks a word wider than the box inside itself.
    """
    if box <= 0:
        return 1
    space = width_of(" ")
    lines, cur = 1, 0.0
    for word in text.split(" "):
        w = sum(width_of(c) for c in word)
        add = w if cur == 0 else space + w
        if cur + add > box and cur > 0:
            lines += 1
            cur = 0.0
            add = w
        if add > box:
            run = 0.0
            for ch in word:
                cw = width_of(ch)
                if run + cw > box and run > 0:
                    lines += 1
                    run = 0.0
                run += cw
            cur = run
            continue
        cur += add
    return lines
