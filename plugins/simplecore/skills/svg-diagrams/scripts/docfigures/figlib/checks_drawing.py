"""Checks on what a figure draws: boards, type, strokes, dashes, legends,
list mode, and the reviews of edge, strip and height."""
import html
import re

import figconfig
from figlib.svgread import _attr, _head, _read, _rects, board_of, text_width, texts

# ── geometry and type ──────────────────────────────────────────────────────
def width_errors(svgs, cfg):
    """Figures whose final canvas is not one of the declared boards."""
    return [svg.name for svg in svgs if board_of(svg, cfg) is None]


def font_size_errors(svgs, cfg):
    """(file, sizes) for sizes off the ladder."""
    allowed = set(cfg.ladder)
    out = []
    for svg in svgs:
        sizes = {float(v) for v in re.findall(r'font-size="([\d.]+)"', _read(svg))}
        if sizes - allowed:
            out.append((svg.name, sorted(sizes - allowed)))
    return out


def sub_body_share(svgs, cfg):
    """(file, share) for figures with too much text below the body rung.

    A figure whose every word sits below BODY has no entry point at print
    size, so that always fails. A rung below the body is for tags, codes and
    looked-up values; with `subBodyShareMax` set, a figure whose characters
    sit there beyond that share fails too, because its running text prints
    below the paragraph beside it while every size is still on the ladder.
    Counted in characters, so many short chips beside a few body lines pass.
    """
    body = cfg.names["BODY"]
    limit = cfg.get("subBodyShareMax")
    out = []
    for svg in svgs:
        small = total = 0
        for attrs, text in texts(svg):
            size = _attr(attrs, "font-size")
            if size is None or not text:
                continue
            total += len(text)
            if float(size) < body - 0.01:
                small += len(text)
        if not total:
            continue
        share = small / total
        if small == total or (limit is not None and share > float(limit)):
            out.append((svg.name, share))
    return out


def max_rung_errors(svgs, cfg):
    """(file, sizes) above the largest rung a figure may print."""
    name = cfg.get("maxRung")
    if not name:
        return None
    top = cfg.names[name]
    out = []
    for svg in svgs:
        sizes = {float(v) for v in re.findall(r'<text\b[^>]*font-size="([\d.]+)"', _read(svg))}
        big = sorted(v for v in sizes if v > top + 0.01)
        if big:
            out.append((svg.name, big))
    return out


def font_family_errors(svgs, cfg):
    """(file, stack) for texts naming a stack other than `fontStack`."""
    stack = cfg.get("fontStack")
    if not stack:
        return None
    out = []
    for svg in svgs:
        fams = set(re.findall(r'<text\b[^>]*font-family="([^"]+)"', _read(svg)))
        bad = sorted(f for f in fams if html.unescape(f) != stack and f != stack)
        if bad:
            out.append((svg.name, bad[0]))
    return out


def stroke_width_errors(svgs, cfg):
    """(file, [(width, count)]) for strokes off the declared ladder.

    An icon is drawn from line segments at the icon stroke and is exempt: it
    is one glyph, not a border.
    """
    strokes = cfg.strokes
    if not strokes:
        return None
    allowed = set(strokes.values())
    icon = cfg.get("icon") or {}
    icon_sw = float(icon["sw"]) if "sw" in icon else max(1.6, cfg.names["BODY"] / 12)
    out = []
    for svg in svgs:
        seen = {}
        for element in re.findall(r"<[a-z]+\b[^>]*>", _read(svg)):
            m = re.search(r'stroke-width="([\d.]+)"', element)
            if not m:
                continue
            width = float(m.group(1))
            if width in allowed:
                continue
            if width == icon_sw and 'stroke-linecap="round"' in element:
                continue
            seen[width] = seen.get(width, 0) + 1
        if seen:
            out.append((svg.name, sorted(seen.items())))
    return out


FILTER_REF = re.compile(r'\bfilter\s*(?:=\s*["\']|:\s*)url\(')


def filter_errors(svgs, cfg):
    """(file, count) for figures with elements that reference an SVG filter.

    PowerPoint's SVG import drops every element that references a `<filter>`:
    the shape vanishes while its labels stay, and the document validates.
    `canvas()` draws svgkit's shadows off for that reason; this catches a
    filter that reaches a figure any other way.
    """
    out = []
    for svg in svgs:
        n = len(FILTER_REF.findall(_read(svg)))
        if n:
            out.append((svg.name, n))
    return out


def dash_pattern_errors(svgs, cfg):
    """(file, patterns) for dashes off the declared patterns.

    A dashed line carries one declared meaning and the gap is what tells the
    meanings apart, so another gap is a meaning the reader cannot look up.
    """
    dashes = cfg.dashes
    if not dashes:
        return None
    allowed = {p for p, _w in dashes.values()}
    out = []
    for svg in svgs:
        found = set(re.findall(r'stroke-dasharray="([^"]+)"', _read(svg)))
        if found - allowed:
            out.append((svg.name, sorted(found - allowed)))
    return out


# ── legends ────────────────────────────────────────────────────────────────
def _distinct_rect_strokes(raw):
    return len({float(m) for m in re.findall(r'<rect\b[^>]*stroke-width="([\d.]+)"', raw)}) >= 2


LEGEND_TESTS = {
    # a legend word for heavier outlines needs two outline weights in the drawing
    "heavyBorder": ("every outline has one weight", _distinct_rect_strokes),
    # a legend word for dashes needs a dashed stroke in the drawing
    "dashed": ("nothing is dashed", lambda raw: "stroke-dasharray=" in raw),
}


def legend_mismatches(svgs, cfg):
    """(file, word, why) for a legend naming a distinction the drawing lacks."""
    words = cfg.get("legendWords")
    if not words:
        return None
    out = []
    for svg in svgs:
        raw = _read(svg)
        joined = " ".join(t for _a, t in texts(svg))
        for prop, ws in words.items():
            if prop not in LEGEND_TESTS:
                raise figconfig.ConfigError(
                    f"legendWords.{prop}: unknown property; one of {sorted(LEGEND_TESTS)}")
            why, present = LEGEND_TESTS[prop]
            for w in ws:
                if w in joined and not present(raw):
                    out.append((svg.name, w, why))
    return out


def foot_legends(svgs, cfg):
    """(file, text) for key lines set under the whole drawing.

    A line below every box, in the lower half of the canvas, whose clause
    glosses a mark with a colon (「점선: 범위 밖」, 「파랑: 상시 투입」) is a key
    the reader has to carry back up. A finding in 「대상: 결과」 form names no
    mark and passes. `footLegend.marks` is the pattern of words that name a
    visual mark rather than a subject.
    """
    spec = cfg.get("footLegend")
    if not spec:
        return None
    marks = re.compile(spec["marks"])
    out = []
    for svg in svgs:
        raw = _read(svg)
        hm = re.search(r'<svg\b[^>]*\bheight="([\d.]+)"', raw)
        if not hm:
            continue
        canvas_h = float(hm.group(1))
        bottom = 0.0
        for m in re.finditer(r"<rect\b([^>]*)>", raw):
            y, h = _attr(m.group(1), "y"), _attr(m.group(1), "height")
            if y and h and float(h) < canvas_h - 5:
                bottom = max(bottom, float(y) + float(h))
        for attrs, text in texts(svg):
            y = _attr(attrs, "y")
            if y and float(y) > max(bottom + 4, canvas_h / 2) and any(
                    marks.search(cl.split(":")[0]) for cl in text.split("·") if ":" in cl):
                out.append((svg.name, text))
    return out


def legend_past_column(svgs, cfg, margin=6.0):
    """(file, overshoot, text) for foot lines that reach past the box column.

    A foot line is recognised by shape: the tag rung, start-aligned, set at
    the content's left edge. Advice, not a failure: real ink runs about 10%
    narrower than the estimate.
    """
    chip = cfg.names["CHIP"]
    out = []
    for svg in svgs:
        board = board_of(svg, cfg)
        if board is None:
            continue
        x0 = cfg.side_margin(board) + 10
        edge = board - x0
        for attrs, text in texts(svg):
            anchor = _attr(attrs, "text-anchor")
            if not text or (anchor and anchor != "start"):
                continue
            fs, x = _attr(attrs, "font-size"), _attr(attrs, "x")
            if not fs or not x or abs(float(fs) - chip) > 0.5 or abs(float(x) - x0) > 1.0:
                continue
            end = float(x) + text_width(cfg, text, float(fs))
            if end > edge - margin:
                out.append((svg.name, end - edge, text))
    return out


def bullet_mode(svgs, cfg):
    """(file, why) for figures whose drawn bullets disagree with their mode.

    A figure either lists (its titled boxes bullet every item) or is declared
    plain with `@figure(plain=True)`, which `save()` records on the root
    element. A plain figure with a bullet, or a listing figure in which no box
    holds two bullets, is declared in the wrong mode.
    """
    if not cfg.get("bullets", True):
        return None
    out = []
    for svg in svgs:
        raw = _read(svg)
        plain = 'data-list-mode="plain"' in _head(svg)
        rects = _rects(raw)
        per = {}
        for attrs, text in texts(svg):
            if text != "•":
                continue
            bx, by = float(_attr(attrs, "x") or 0), float(_attr(attrs, "y") or 0)
            inside = [r for r in rects if r[0] <= bx <= r[0] + r[2] and r[1] <= by <= r[1] + r[3]]
            if inside:
                r = min(inside, key=lambda r: r[2] * r[3])
                per[r] = per.get(r, 0) + 1
        if plain and per:
            out.append((svg.name, "declared plain but draws bullets"))
        elif not plain and per and max(per.values()) <= 1:
            out.append((svg.name, "no box lists two items - declare it @figure(plain=True)"))
    return out


# ── wrapped runs ───────────────────────────────────────────────────────────
STUB_SHARE = 0.42      # a last line under this share of the run's longest is a stub
STEP_RANGE = (0.95, 1.5)  # a line step, as a multiple of the type size
SAME = 0.6             # coordinates this close are the same x, baseline or step


def _wrapped_runs(svg):
    """Lists of (text, size) lines that read as one wrapped string."""
    return [[(text, size) for _y, text, size in run] for _x, _a, run in placed_runs(svg)]


def placed_runs(svg):
    """(x, anchor, [(y, text, size)]) for each run of lines read as one string.

    A run is a column of texts with the same x, anchor, size, weight and fill,
    each one line step below the last, and the step the same down the run. A
    bullet glyph (「•」) on a line's baseline, to its left, opens a new item,
    so a list's items are never read as one string's lines.
    """
    lines, bullets = [], []
    for attrs, text in texts(svg):
        try:
            x, y = float(_attr(attrs, "x") or "nan"), float(_attr(attrs, "y") or "nan")
            size = float(_attr(attrs, "font-size") or 0)
        except ValueError:
            continue
        if not text or not size or x != x or y != y:
            continue
        if text == "•":
            bullets.append((x, y))
            continue
        key = (round(x / SAME), _attr(attrs, "text-anchor") or "start", size,
               _attr(attrs, "font-weight") or "400", _attr(attrs, "fill") or "")
        lines.append((key, x, y, text, size))

    def opens_item(x, y, size):
        return any(abs(by - y) <= SAME and x - 2 * size <= bx < x for bx, by in bullets)

    columns = {}
    for key, x, y, text, size in lines:
        columns.setdefault(key, []).append((y, x, text, size, key[1]))
    runs = []
    for column in columns.values():
        column.sort()
        run, step = [], None
        for y, x, text, size, anchor in column:
            gap = y - run[-1][0] if run else None
            joins = (gap is not None
                     and STEP_RANGE[0] * size <= gap <= STEP_RANGE[1] * size
                     and (step is None or abs(gap - step) <= SAME)
                     and not opens_item(x, y, size))
            if joins:
                step = gap if step is None else step
                run.append((y, text, size, x, anchor))
                continue
            if len(run) >= 2:
                runs.append((run[0][3], run[0][4], [r[:3] for r in run]))
            run, step = [(y, text, size, x, anchor)], None
        if len(run) >= 2:
            runs.append((run[0][3], run[0][4], [r[:3] for r in run]))
    return runs


FILL = 0.93            # the share of its width the wrap fills a line to
WORD = re.compile(r"[ \t\n]+")


def _forced_pieces(run, width):
    """`run` split wherever the column did not force the break.

    The wrap fills a line until the next word does not fit, so at every break
    it made, the line plus the next line's first word is wider than `FILL` of
    the longest line. A break where it would have fitted was written by the
    author (a newline, or the next item of a list set without bullets), and
    the lines either side of it are not one string's lines.
    """
    widths = [width(text, size) for text, size in run]
    longest = max(widths)
    cuts = [i + 1 for i in range(len(run) - 1)
            if width(run[i][0] + " " + WORD.split(run[i + 1][0].strip())[0], run[i][1])
            <= FILL * longest]
    if not cuts:
        return [run]
    pieces, start = [], 0
    for cut in cuts + [len(run)]:
        if cut - start >= 2:
            pieces += _forced_pieces(run[start:cut], width)
        start = cut
    return pieces


def stub_lines(svgs, cfg):
    """(file, last line, share, longest line) for wrapped runs ending on a stub.

    A module writes a sentence and the column decides where it breaks, so a
    word can end up alone on the last line, where the eye reading the card
    never looks. A run whose last line is under `stubLine` (0.42) of its
    longest is one. Only breaks the column forced are read, so an authored
    newline and a list's items are not. `stubLine: null` turns the check off.
    """
    share = cfg.get("stubLine", STUB_SHARE)
    if share is None:
        return None

    def width(text, size):
        return text_width(cfg, text, size)

    out = []
    for svg in svgs:
        for candidate in _wrapped_runs(svg):
            for run in _forced_pieces(candidate, width):
                widths = [width(text, size) for text, size in run]
                longest = max(widths)
                if longest and widths[-1] / longest < float(share):
                    out.append((svg.name, run[-1][0], widths[-1] / longest,
                                run[widths.index(longest)][0]))
    return out


# ── reviews ────────────────────────────────────────────────────────────────
def past_content_edge(svgs, cfg, shared_by=3, floor=0.6, tolerance=2.0):
    """(file, edge, overshoot, share of right margin) for boxes past the line
    the rest of the figure lines up on.

    The column is inferred: the furthest right edge that at least `shared_by`
    boxes share, past `floor` of the canvas. A frame is skipped while its
    inset is ordinary padding. Inferred rather than declared, so a list to read.
    """
    pad = 16
    out = []
    for svg in svgs:
        raw = _read(svg)
        head = re.search(r'<svg\b[^>]*\bwidth="([\d.]+)"', raw)
        if not head:
            continue
        canvas = float(head.group(1))
        rects = [(r[0], r[2]) for r in _rects(raw)]
        if not rects:
            continue
        counts = {}
        for x, w in rects:
            counts[round(x + w, 1)] = counts.get(round(x + w, 1), 0) + 1
        shared = [e for e, n in counts.items() if n >= shared_by and e >= canvas * floor]
        if not shared:
            continue
        edge = max(shared)
        inside = min((x for x, w in rects if abs(x + w - edge) <= tolerance), default=canvas)
        beyond = [(x, w) for x, w in rects if x + w > edge + tolerance
                  and (x > inside - tolerance or x + w - edge > pad * 2)]
        if not beyond:
            continue
        over = max(x + w for x, w in beyond)
        margin = canvas - edge
        out.append((svg.name, edge, over - edge, (over - edge) / margin if margin else 1.0))
    out.sort(key=lambda r: -r[3])
    return out


def strip_reviews(svgs, cfg):
    """(file, ratio) for full-width figures flatter than `stripRatio`."""
    ratio = float(cfg.get("stripRatio", 0.28))
    out = []
    for svg in svgs:
        m = re.search(r'width="([\d.]+)" height="([\d.]+)"', _head(svg))
        if m and float(m.group(1)) >= cfg.default_board - 0.01 \
                and float(m.group(2)) / float(m.group(1)) < ratio:
            out.append((svg.name, float(m.group(2)) / float(m.group(1))))
    return out


def height_reviews(svgs, cfg):
    """(file, height, limit) for figures over their board's height review."""
    out = []
    for svg in svgs:
        board = board_of(svg, cfg)
        if board is None:
            continue
        limit = cfg.height_review(board)
        m = re.search(r'<svg\b[^>]*\bheight="([\d.]+)"', _head(svg))
        if limit is not None and (not m or float(m.group(1)) > limit):
            out.append((svg.name, float(m.group(1)) if m else None, limit))
    return out
