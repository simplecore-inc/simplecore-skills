"""The line-break check over saved figures: R1-R3 (figlib/linebreak.py).

A saved figure carries one <text> per line, so a label is read back as a
wrapped run (`placed_runs`: the same x, anchor, size, weight and fill, one
constant line step apart, a bullet opening a new item). Each break between
the run's lines is judged as the wrap judges it. The SVG does not record the
measure the wrap used, so the rules are judged at the box drawn round the run
(the smallest rect holding it, less the library's padding, at the wrap's
fill), or at the run's widest line where no box holds it or the box is
narrower.

Two labels stacked one step apart read back as one run, so an R1 break is
reported only where the wrap was forced: the line before it could not take
the next line's first word at that measure. An authored newline inside an item is
not forced and is left to the build, which reads it in the source string
(`build.py`, through `wrap()`).
"""
from figlib.checks_drawing import FILL, placed_runs
from figlib.linebreak import DOT, OPENS, break_findings
from figlib.svgread import _read, _rects, text_width

# A line within this many units of the widest still fits; `tw` rounds.
SLACK = 0.5
# The side padding a box gives its text (figlib/text.py PAD).
PAD = 16


def _box_measure(rects, x, anchor, run, widths):
    """The wrap measure of the smallest rect holding the run, or None."""
    left = {"start": x, "middle": x - max(widths) / 2, "end": x - max(widths)}[anchor]
    right = left + max(widths)
    top = run[0][0] - run[0][2] * 0.78
    bottom = run[-1][0] + run[-1][2] * 0.24
    holding = [(w * h, w) for rx, ry, w, h in rects
               if rx <= left + 0.5 and right <= rx + w + 0.5
               and ry <= top + 0.5 and bottom <= ry + h + 0.5]
    if not holding:
        return None
    _area, w = min(holding)
    return (w - 2 * PAD) * FILL


def run_findings(lines, size, width, measure=None):
    """Findings over one run's lines at one size.

    `measure` is the box's wrap measure where one holds the run.
    """
    joined = " ".join(lines)
    if DOT not in joined and not any(ch in joined for ch in OPENS):
        return []
    widest = max(width(text, size) for text in lines)
    room = max(widest, measure or 0)

    def fits(s):
        return width(s, size) <= room + SLACK

    def forced(k):
        head = lines[k + 1].strip().split(" ")[0]
        return not fits(f"{lines[k].strip()} {head}")

    return [f for f in break_findings(lines, fits)
            if f.rule != "R1" or forced(f.line)]


def line_break_errors(svgs, cfg):
    """(file, rule, lines, detail, fixable) for every break against R1-R3.

    `lineBreaks: false` turns the check off. `lineBreaks.allow` lists runs
    that are separate labels stacked one step apart, each written as its lines
    joined by 「 / 」 (「이벤트 판정 · 알람 / 전용 실행 자원」), which pass.
    """
    spec = cfg.get("lineBreaks", True)
    if spec is False:
        return None
    allow = set((spec or {}).get("allow", ())) if isinstance(spec, dict) else set()

    def width(text, size):
        return text_width(cfg, text, size)

    out = []
    for svg in svgs:
        rects = _rects(_read(svg))
        for x, anchor, run in placed_runs(svg):
            lines = [text for _y, text, _s in run]
            if " / ".join(lines) in allow:
                continue
            size = run[0][2]
            widths = [width(t, size) for t in lines]
            measure = _box_measure(rects, x, anchor, run, widths)
            for f in run_findings(lines, size, width, measure):
                out.append((svg.name, f.rule, lines, f.detail, f.fixable))
    return out
