#!/usr/bin/env python3
"""A line that wraps inside a word, or strands a scrap of a short label.

A narrow table column, or any narrow text box, wraps its text where the width
runs out. The renderer keeps a word whole (a Korean run sets every
space-delimited word whole, a Latin word is whole in any run) until the word
alone is wider than its column; then the word opens a line and is cut at the
character the width reaches, so 「학력」 prints as 「학 / 력」, 「RHEL」 as
「R / HEL」, 「C37.118」 as 「C3 / 7.118」. A short label broken at its space
strands one scrap on a line (「전 / 구간」, 「IV-2 / 03」). No layout check
reports either: every line fits its box. A person finds them by reading the
page.

The wrap is replayed, not guessed. Each table cell and text box is read from
the built `.pptx` (its column width less its insets, each run's size, weight
and language, its explicit `<a:br/>`), and every line is fitted with the
server's own measurer (`text_measure`, the layout's measurer and the deck's
fonts). The units a line may break between are the renderer's: a run of
non-space characters, except that a CJK character in a run whose language is
not Korean is a unit of its own (such a run breaks between any two
syllables). A unit wider than the column opens a line and is cut at the
longest prefix that fits, as the renderer cuts it; a cut that would leave only
closing marks keeps them on the line, where the renderer hangs them past the
column. Kinsoku, which can move a break one character earlier, is not
replayed. Font sizes are the file's points as the deck's CSS px (pt × 4/3),
the unit `text_measure` takes. A line is fitted in its column plus `slack`: the
column comes from EMU rounded in the file and the renderer works on its own
grid, so a word short of its column by a fraction of a pixel prints whole.

Two findings:

- **inside**: a break inside a unit, unless the character before the break is
  in `breakAfter` (「·」, 「/」, a comma, a closing bracket) or the one after it
  is in `breakBefore` (an opening bracket). Between two units of a non-Korean
  run with no space between them, a break between two Hangul syllables or two
  word characters counts as inside too.
- **scrap**: a label of at most `labelWords` space-separated words, with no
  inside break, that wraps and leaves a line of at most `scrapChars`
  characters or a line matching `scrapToken` (an id or number fragment of up to
  three Latin letters, digits or brackets: 「03」, 「3)」, 「E」). A word of two
  syllables wrapping at its space is ordinary wrapping and is not reported.

Reads the deck's built `.pptx` (`output`), refusing one older than the deck,
and the page labels and the measurer from the running app.

Config (`checks.wordbreak`, optional): `breakAfter` (「·/,)]}」』>-–~:;!?.%」),
`breakBefore` (「([{「『<」), `scrapChars` (1), `scrapToken`
(`^[0-9A-Za-z().\\-]{1,3}$`), `labelWords` (3), `slack` (0.5 px).

Baseline: `<checks.baselines>/wordbreak.json`, keyed
`page<TAB>text<TAB>finding`.

    wordbreak.py          # every slide
    wordbreak.py 9 12     # only these slide numbers
"""
from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from html import unescape
from pathlib import Path
from typing import Callable

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.baseline import Baseline, judge  # noqa: E402
from bidkit.config import DeckConfig  # noqa: E402
from bidkit.pptxread import Built  # noqa: E402

BREAK_AFTER = "·/,)]}」』>-–~:;!?.%"
BREAK_BEFORE = "([{「『<"
SCRAP_CHARS, LABEL_WORDS = 1, 3
SLACK_PX = 0.5
SCRAP_TOKEN = r"^[0-9A-Za-z().\-]{1,3}$"
HANG = ")]}」』,.、。:;!?"
DEFAULT_INSET_EMU = 91440          # OOXML's default left/right inset and cell margin
DEFAULT_SIZE_PT = 18.0
PX_PER_PT = 4 / 3                  # the deck writes type in CSS px; the file in pt

SP = re.compile(r"<p:sp>(.*?)</p:sp>", re.S)
FRAME = re.compile(r"<p:graphicFrame>(.*?)</p:graphicFrame>", re.S)
NAME = re.compile(r'<p:cNvPr\b[^>]*\bname="([^"]*)"')
SP_EXT = re.compile(r"<p:spPr>.*?<a:ext cx=\"(\d+)\"", re.S)
BODY_PR = re.compile(r"<a:bodyPr\b([^>]*)/?>")
FONT_SCALE = re.compile(r'<a:normAutofit\b[^>]*\bfontScale="(\d+)"')
GRID_COL = re.compile(r'<a:gridCol w="(\d+)"')
ROW = re.compile(r"<a:tr\b.*?</a:tr>", re.S)
CELL = re.compile(r"<a:tc\b([^>]*)>(.*?)</a:tc>", re.S)
TC_PR = re.compile(r"<a:tcPr\b([^>]*)")
PARA = re.compile(r"<a:p>(.*?)</a:p>", re.S)
PIECE = re.compile(r"<a:r>(.*?)</a:r>|<a:br\b[^>]*/?>(?:.*?</a:br>)?", re.S)
PPR_MARL = re.compile(r'<a:pPr\b[^>]*\bmarL="(\d+)"')
RPR = re.compile(r"<a:rPr\b([^>]*)")
TEXT = re.compile(r"<a:t>(.*?)</a:t>", re.S)
SPACE = re.compile(r"\s")
WORDISH = re.compile(r"[0-9A-Za-z가-힣]")


def attr(attrs: str, name: str, default: str | None = None) -> str | None:
    m = re.search(rf'\b{name}="([^"]*)"', attrs)
    return m.group(1) if m else default


def is_cjk(ch: str) -> bool:
    cp = ord(ch)
    return (0xAC00 <= cp <= 0xD7A3 or 0x1100 <= cp <= 0x11FF or 0x3130 <= cp <= 0x318F
            or 0x4E00 <= cp <= 0x9FFF or 0x3400 <= cp <= 0x4DBF or 0x3040 <= cp <= 0x30FF)


@dataclass
class Run:
    text: str
    size_px: float
    bold: bool
    korean: bool                   # the run's language keeps a word whole


@dataclass
class Segment:
    """One stretch of text between paragraph ends and explicit breaks, in one column."""
    where: str                     # the box's name, and the cell for a table
    width: float                   # px the lines may fill
    runs: list = field(default_factory=list)

    @property
    def text(self) -> str:
        return "".join(r.text for r in self.runs)


@dataclass
class Unit:
    """What the wrap may not break inside, and whether a space precedes it."""
    text: str
    spaced: bool
    size_px: float
    bold: bool
    korean: bool


def units(runs: list[Run]) -> list[Unit]:
    out: list[Unit] = []
    spaced, cur = False, None
    for run in runs:
        for ch in run.text:
            if SPACE.match(ch):
                cur, spaced = None, True
                continue
            alone = is_cjk(ch) and not run.korean
            if cur is None or alone or not cur.korean and is_cjk(cur.text[-1]):
                cur = Unit(ch, spaced, run.size_px, run.bold, run.korean)
                out.append(cur)
            else:
                cur.text += ch
                cur.size_px = max(cur.size_px, run.size_px)
                cur.bold = cur.bold or run.bold
            spaced = False
    return out


Fits = Callable[[str, float, bool, float], bool]


def join(line: list[Unit]) -> str:
    return "".join((" " if u.spaced and i else "") + u.text for i, u in enumerate(line))


def style(line: list[Unit]) -> tuple[float, bool]:
    chars = sum(len(u.text) for u in line) or 1
    return max(u.size_px for u in line), sum(len(u.text) for u in line if u.bold) * 2 > chars


def wrap(seg: Segment, fits: Fits) -> list[tuple[str, str]]:
    """The segment's lines as (line text, how it ended: 'space' | 'unit' | 'inside' | 'end')."""
    lines: list[tuple[str, str]] = []
    cur: list[Unit] = []

    def ok(line: list[Unit]) -> bool:
        size, bold = style(line)
        return fits(join(line), size, bold, seg.width)

    def place(u: Unit) -> None:
        nonlocal cur
        # On an empty line: a unit wider than the column is cut by character.
        while not ok([u]) and len(u.text) > 1:
            lo, hi = 1, len(u.text) - 1
            while lo < hi:
                mid = (lo + hi + 1) // 2
                if ok([Unit(u.text[:mid], False, u.size_px, u.bold, u.korean)]):
                    lo = mid
                else:
                    hi = mid - 1
            if all(ch in HANG for ch in u.text[lo:]):
                break              # closing marks hang past the column, as the renderer sets them
            lines.append((u.text[:lo], "inside"))
            u = Unit(u.text[lo:], False, u.size_px, u.bold, u.korean)
        cur = [u]

    for u in units(seg.runs):
        if cur and ok(cur + [u]):
            cur.append(u)
            continue
        if cur:
            lines.append((join(cur), "space" if u.spaced else "unit"))
        place(u)
    if cur:
        lines.append((join(cur), "end"))
    return lines


@dataclass
class Rules:
    break_after: str = BREAK_AFTER
    break_before: str = BREAK_BEFORE
    scrap_chars: int = SCRAP_CHARS
    label_words: int = LABEL_WORDS
    scrap_token: str = SCRAP_TOKEN

    @classmethod
    def from_deck(cls, deck: DeckConfig) -> "Rules":
        cfg = deck.section("checks.wordbreak")
        return cls(str(cfg.get("breakAfter", BREAK_AFTER)), str(cfg.get("breakBefore", BREAK_BEFORE)),
                   int(cfg.get("scrapChars", SCRAP_CHARS)), int(cfg.get("labelWords", LABEL_WORDS)),
                   str(cfg.get("scrapToken", SCRAP_TOKEN)))


def judge_lines(text: str, lines: list[tuple[str, str]], rules: Rules) -> list[str]:
    """The breaks worth a reader's look, each as 「left / right」 with its kind."""
    out = []
    for (left, how), (right, _) in zip(lines, lines[1:]):
        a, b = left[-1:], right[:1]
        if how == "inside" or how == "unit" and WORDISH.match(a) and WORDISH.match(b):
            if a not in rules.break_after and b not in rules.break_before:
                out.append(f"inside a word: 「{left} / {right}」")
    if out or len(lines) < 2 or len(text.split()) > rules.label_words:
        return out
    for line, _ in lines:
        bare = line.replace(" ", "")
        if len(bare) <= rules.scrap_chars or re.match(rules.scrap_token, bare):
            out.append(f"scrap line 「{line}」 of 「{' / '.join(t for t, _ in lines)}」")
            break
    return out


def runs_of(paragraph: str, scale: float) -> list[list[Run]]:
    """A paragraph's runs, split at each explicit line break."""
    pieces: list[list[Run]] = [[]]
    for m in PIECE.finditer(paragraph):
        if m.group(1) is None:
            pieces.append([])
            continue
        body = m.group(1)
        rpr = RPR.search(body)
        attrs = rpr.group(1) if rpr else ""
        sz = attr(attrs, "sz")
        size_pt = int(sz) / 100.0 if sz else DEFAULT_SIZE_PT
        lang = (attr(attrs, "lang", "") or "") + " " + (attr(attrs, "altLang", "") or "")
        text = unescape("".join(TEXT.findall(body)))
        pieces[-1].append(Run(text, size_pt * PX_PER_PT * scale,
                              attr(attrs, "b") == "1", "ko" in lang.lower()))
    return pieces


def body_segments(where: str, body: str, width: float, built: Built, scale: float) -> list[Segment]:
    out = []
    for para in PARA.findall(body):
        marl = PPR_MARL.search(para)
        w = width - (built.px(marl.group(1)) if marl else 0.0)
        for runs in runs_of(para, scale):
            seg = Segment(where, w, runs)
            if seg.text.strip():
                out.append(seg)
    return out


def segments(xml: str, built: Built) -> list[Segment]:
    """Every wrapping stretch of text on one built slide, with the width it wraps in."""
    out: list[Segment] = []
    for frame in FRAME.findall(xml):
        if "<a:tbl>" not in frame:
            continue
        name = NAME.search(frame)
        cols = [int(c) for c in GRID_COL.findall(frame)]
        for r, row in enumerate(ROW.findall(frame), 1):
            c = 0
            for attrs, cell in CELL.findall(row):
                span = int(attr(attrs, "gridSpan", "1") or 1)
                col, c = c, c + span
                if attr(attrs, "hMerge") == "1" or attr(attrs, "vMerge") == "1":
                    continue
                tcpr = TC_PR.search(cell)
                pr = tcpr.group(1) if tcpr else ""
                inset = int(attr(pr, "marL", str(DEFAULT_INSET_EMU))) + int(attr(pr, "marR", str(DEFAULT_INSET_EMU)))
                width = built.px(sum(cols[col:col + span]) - inset)
                where = f"{name.group(1) if name else 'table'} r{r}c{col + 1}"
                out += body_segments(where, cell, width, built, 1.0)
    for sp in SP.findall(xml):
        if "<p:txBody>" not in sp:
            continue
        bp = BODY_PR.search(sp)
        battrs = bp.group(1) if bp else ""
        ext = SP_EXT.search(sp)
        if attr(battrs, "wrap") == "none" or not ext:
            continue
        inset = int(attr(battrs, "lIns", str(DEFAULT_INSET_EMU))) + int(attr(battrs, "rIns", str(DEFAULT_INSET_EMU)))
        scale_m = FONT_SCALE.search(sp)
        scale = int(scale_m.group(1)) / 100000.0 if scale_m else 1.0
        name = NAME.search(sp)
        out += body_segments(name.group(1) if name else "text", sp, built.px(int(ext.group(1)) - inset),
                             built, scale)
    return out


class ServerFits:
    """Does a string set on one line at a width? Asked of the server's measurer, cached."""

    def __init__(self, session, slack: float = SLACK_PX):
        self.session = session
        self.slack = slack
        self.cache: dict = {}

    def __call__(self, text: str, size_px: float, bold: bool, width: float) -> bool:
        key = (text, round(size_px, 3), bold, round(width, 3))
        if key not in self.cache:
            answer = self.session.call("text_measure", {"text": text, "fontSize": size_px,
                                                        "bold": bold, "width": width + self.slack})
            self.cache[key] = int(answer["structuredContent"]["lines"]) <= 1
        return self.cache[key]


def find(xml_by_slide: dict[int, str], labels: dict[int, str], built: Built, fits: Fits,
         rules: Rules, only: set[int] | None = None) -> list[tuple[int, str, str, str, str]]:
    """[(slide, page label, where, text, finding)]."""
    out = []
    for n in sorted(xml_by_slide):
        if only and n not in only:
            continue
        for seg in segments(xml_by_slide[n], built):
            if seg.width <= 0 or fits(seg.text.strip(), max(r.size_px for r in seg.runs),
                                      all(r.bold for r in seg.runs if r.text.strip()), seg.width):
                continue
            for finding in judge_lines(seg.text, wrap(seg, fits), rules):
                out.append((n, labels.get(n, f"slide {n}"), seg.where, seg.text.strip(), finding))
    return out


def key(f) -> str:
    return f"{f[1]}\t{f[3][:60]}\t{f[4]}"


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    ap = cli.parser(__doc__.splitlines()[0], bless=True)
    ap.add_argument("slides", nargs="*", type=int, help="only these slide numbers")
    args = ap.parse_args(argv)
    deck = cli.deck_config(args)
    baseline = Baseline.for_check(deck, "wordbreak")
    built = Built.for_deck(deck)
    with cli.open_reader(deck) as reader:
        labels = {p.n: p.label for p in reader.slides()}
        slack = float(deck.section("checks.wordbreak").get("slack", SLACK_PX))
        found = find(built.slides, labels, built, ServerFits(reader.session, slack), Rules.from_deck(deck),
                     set(args.slides) or None)
    if args.bless:
        return cli.report_bless(baseline, {key(f): None for f in found}, "word breaks")
    live, owed = judge(baseline, found, key)
    print(f"wordbreak: {len(built.slides)} slides of {built.path.name}, {len(found)} breaks, "
          f"{len(live)} live, {len(owed)} retired without a reason")
    for n, label, where, text, finding in live:
        page = f"slide {n}" if label == f"slide {n}" else f"slide {n} {label}"
        print(f"  ✖ {page} · {where} · {finding}")
    for n, label, _, text, finding in owed:
        print(f"  ✖ slide {n} {label}: retired with a blank reason; write why · {finding}")
    return 1 if live or owed else 0


if __name__ == "__main__":
    sys.exit(main())
