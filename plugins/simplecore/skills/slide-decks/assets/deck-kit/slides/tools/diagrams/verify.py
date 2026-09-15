"""Check every presentation figure before it is committed.

The proposal's verify.py, run over this deck's own figures and boards — see
tools/diagrams/common.py for the boards a landscape slide places.

Eight passes. All but the height review fail the run:

1. the board width — either of the two the deck places (1200 across the text
   block, 520 in a column), because any other width prints at a different type
   size from its neighbours
2. the type scale — a one-off size is invisible in the source and obvious on
   the page
3. the arrowhead on every connector call — `line()` and `path()` draw one
   unless it is refused, so a route built from several calls grows a head on
   every corner unless each segment states what it draws
4. document section numbers in figure text — a section number moves whenever a
   page is inserted, so a figure that names one goes stale silently
5. the toolkit's static lint — arrowheads, overflow, occlusion, connectors
6. layout width and the line-overlap scan in `overlap_scan.py`, which sees
   coincident connectors the lint's own check does not
7. text contrast — a label drawn over a filled band it has no contrast against
   is invisible on the page and reads as a missing label, and neither the
   static lint nor a downscaled look at the render catches it
8. height review — a recommendation, not a failure

None of them replaces looking at the rendered figure. Use `--render <dir>` to
write PNGs to read.
"""
import ast
import collections
import pathlib
import re
import subprocess
import sys
import tempfile

from common import (BOARDS, COLUMN_WIDTH, FONT_SCALE, HALF_WIDTH, OUT, SLIDE_WIDTH,
                    STANDARD_WIDTH, toolkit_dir)

HERE = pathlib.Path(__file__).resolve().parent
AUDIT = toolkit_dir() / "audit.py"
# Height review, per board. The full board's figure sits above or below body
# text and has one page to share; the column board's runs down beside it and
# may use almost the whole text block.
# A slide figure shares the slide with its text, so the full slide board is
# reviewed at 600 units (342px) and the proposal board at 700 (600px in the
# wide column); the half board at 700 (397px); the column board keeps 1400.
HEIGHT_REVIEW = {SLIDE_WIDTH: 600, STANDARD_WIDTH: 700, HALF_WIDTH: 700, COLUMN_WIDTH: 1400}

# The lint assumes every SVG is cropped to its own ink and fails a side gap over
# 40 units. This set deliberately keeps a fixed board per class, so a figure
# whose content is genuinely narrower carries a wider gap without being wrong.
# The gap that does mean the layout was never widened for its board is larger
# than that, and `tools/diagrams/AGENTS.md` puts the number at 90 on the full
# board; the column board takes the same fraction of its own width.
DEAD_MARGIN_LIMIT = 90
DEAD_MARGIN_LIMITS = {b: round(90 * b / STANDARD_WIDTH) for b in BOARDS}

# WCAG contrast floor for figure text. Every label here is at least 15 units
# on a 1200-unit board, which prints larger than body copy, so the large-text
# threshold is the right one; below it the label stops being readable rather
# than merely looking quiet.
CONTRAST_FLOOR = 3.0
TEXT_RE = re.compile(r"<text\b([^>]*)>(.*?)</text>", re.S)
ATTR_RE = re.compile(r'([\w-]+)="([^"]*)"')


def _luminance(rgb):
    def channel(v):
        v /= 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (channel(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def _contrast(fg, bg):
    a, b = _luminance(fg), _luminance(bg)
    lo, hi = sorted((a, b))
    return (hi + 0.05) / (lo + 0.05)


def _rgb(value):
    """`#rrggbb` or `rrggbb` to a tuple, or None for anything else."""
    v = value.strip().lstrip("#")
    if len(v) != 6:
        return None
    try:
        return tuple(int(v[i:i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return None


def contrast_errors(svgs):
    """Text whose colour disappears into the shape drawn under it.

    The background is measured rather than inferred: the same figure is
    rendered once with every `<text>` removed, and each label's own box is
    sampled on that image. The most common colour in the box is the ground the
    reader sees the glyphs against.
    """
    sys.path.insert(0, str(toolkit_dir()))
    from PIL import Image                      # noqa: E402  (toolkit dep)
    from svgkit import tw                      # noqa: E402

    scale = 2
    out = []
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        for svg in svgs:
            raw = svg.read_text(encoding="utf-8")
            bare = tmp / f"{svg.stem}-bare.svg"
            bare.write_text(TEXT_RE.sub("", raw), encoding="utf-8")
            png = tmp / f"{svg.stem}.png"
            subprocess.run([sys.executable, str(AUDIT), "render", str(bare),
                            str(png), str(scale)],
                           check=False, capture_output=True)
            if not png.exists():
                continue
            img = Image.open(png).convert("RGB")
            for attrs, body in TEXT_RE.findall(raw):
                a = dict(ATTR_RE.findall(attrs))
                fg = _rgb(a.get("fill", ""))
                text = re.sub(r"<[^>]+>", "", body).strip()
                if not fg or not text:
                    continue
                size = float(a.get("font-size", 0) or 0)
                if not size:
                    continue
                width = tw(text, size)
                anchor = a.get("text-anchor", "start")
                x = float(a.get("x", 0))
                x0 = x - width / 2 if anchor == "middle" else \
                    x - width if anchor == "end" else x
                y = float(a.get("y", 0))
                box = (max(0, int(x0 * scale)), max(0, int((y - size * 0.78) * scale)),
                       min(img.width, int((x0 + width) * scale)),
                       min(img.height, int((y + size * 0.14) * scale)))
                if box[2] <= box[0] or box[3] <= box[1]:
                    continue
                pixels = list(img.crop(box).getdata())
                bg = collections.Counter(pixels).most_common(1)[0][0]
                ratio = _contrast(fg, bg)
                if ratio < CONTRAST_FLOOR:
                    out.append((svg.name, text[:34], a["fill"],
                                "#%02x%02x%02x" % bg, ratio))
    return out


def _head(svg):
    return svg.read_text(encoding="utf-8")[:600]


def board_width(svg):
    """The board a figure was drawn on, or None when it is on neither."""
    m = re.search(r'<svg\b[^>]*\bwidth="([\d.]+)"[^>]*\bviewBox="0 0 ([\d.]+)',
                  _head(svg))
    if not m:
        return None
    for board in BOARDS:
        if abs(float(m.group(1)) - board) <= 0.01 \
                and abs(float(m.group(2)) - board) <= 0.01:
            return board
    return None


def width_errors(svgs):
    """Figures whose final canvas is neither board."""
    return [svg.name for svg in svgs if board_width(svg) is None]


def height_reviews(svgs):
    out = []
    for svg in svgs:
        board = board_width(svg)
        if board is None:
            continue
        m = re.search(r'<svg\b[^>]*\bheight="([\d.]+)"', _head(svg))
        if not m or float(m.group(1)) > HEIGHT_REVIEW[board]:
            out.append((svg.name, float(m.group(1)) if m else None))
    return out


def font_size_errors(svgs):
    allowed = set(FONT_SCALE)
    out = []
    for svg in svgs:
        sizes = {float(v) for v in re.findall(
            r'font-size="([\d.]+)"', svg.read_text(encoding="utf-8"))}
        unexpected = sorted(sizes - allowed)
        if unexpected:
            out.append((svg.name, unexpected))
    return out


def section_number_errors(svgs):
    """Document section references embedded in figure text."""
    pattern = re.compile(
        r'>([0-9]+(?:\.[0-9]+)+(?:[·~][0-9]+(?:\.[0-9]+)+)*)(?:\s|<)')
    out = []
    for svg in svgs:
        found = sorted(set(pattern.findall(svg.read_text(encoding="utf-8"))))
        if found:
            out.append((svg.name, found))
    return out


def marker_default_errors():
    """Route segments that inherit the toolkit's arrowhead.

    `Canvas.line()` and `Canvas.path()` draw an arrowhead unless one is
    refused, so a route built from several calls — a drop onto a rail, the
    rail itself, the branch off it — grows a head on every corner. The
    picture then shows a connector that arrives three times before it gets
    anywhere, and the source reads as correct because the word `marker`
    never appears in it. Every call states what it draws: `marker=None` on
    each segment before the last, the accent on the one that arrives.
    """
    out = []
    for path in sorted(HERE.glob("*.py")):
        if path.name in ("verify.py", "build.py", "common.py", "overlap_scan.py"):
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            func = getattr(node, "func", None)
            if not isinstance(node, ast.Call) or not isinstance(func, ast.Attribute):
                continue
            if func.attr not in ("line", "path"):
                continue
            if any(k.arg == "marker" for k in node.keywords):
                continue
            out.append((path.name, node.lineno, func.attr))
    return out


def layout_width_errors(lint_output):
    """Figures whose meaningful ink was never widened to their own board."""
    out = []
    current, limit = None, DEAD_MARGIN_LIMIT
    for line in lint_output.splitlines():
        m = re.match(r"=== lint (.+?) \((\d+)x", line)
        if m:
            current = m.group(1)
            limit = next((lim for b, lim in DEAD_MARGIN_LIMITS.items()
                          if abs(int(m.group(2)) - b) <= 1), DEAD_MARGIN_LIMIT)
            continue
        m = re.search(
            r"DEAD-MARGIN: ([\d.]+)px of empty board at the (left|right)", line)
        if m and float(m.group(1)) > limit:
            out.append((current, m.group(2), float(m.group(1))))
    return out


def main(argv):
    svgs = sorted(OUT.glob("*.svg"))
    if not svgs:
        sys.exit(f"no figures in {OUT}")
    print(f"checked {len(svgs)} file(s)")
    failed = False

    widths = width_errors(svgs)
    if widths:
        failed = True
        print(f"\n[width] {len(widths)} on none of the boards "
              f"({' · '.join(str(b) for b in sorted(BOARDS))})")
        for name in widths:
            print(" ", name)
    else:
        counts = {}
        for svg in svgs:
            counts[board_width(svg)] = counts.get(board_width(svg), 0) + 1
        print("[width] " + " · ".join(
            f"{n} at {b}" for b, n in sorted(counts.items(), reverse=True)))

    fonts = font_size_errors(svgs)
    if fonts:
        failed = True
        print(f"\n[type scale] {len(fonts)} with off-ladder sizes")
        for name, sizes in fonts:
            print(f"  {name}: {', '.join(f'{s:g}' for s in sizes)}")
    else:
        print("[type scale] all on the ladder")

    markers = marker_default_errors()
    if markers:
        failed = True
        print(f"\n[arrowheads] {len(markers)} connector calls take the "
              f"toolkit's default head")
        for name, lineno, attr in markers:
            print(f"  {name}:{lineno}: c.{attr}() states no marker")
    else:
        print("[arrowheads] every connector call states its marker")

    sections = section_number_errors(svgs)
    if sections:
        failed = True
        print(f"\n[section numbers] {len(sections)} figures name a section number")
        for name, numbers in sections:
            print(f"  {name}: {', '.join(numbers)}")
    else:
        print("[section numbers] none")

    lint = subprocess.run(
        [sys.executable, str(AUDIT), "lint", *[str(s) for s in svgs]],
        capture_output=True, text=True)
    layout_widths = layout_width_errors(lint.stdout)
    lint_lines = [ln for ln in lint.stdout.splitlines() if "DEAD-MARGIN" not in ln]
    lint_failed = any("✖" in ln for ln in lint_lines)
    if lint_failed:
        failed = True
        print("\n[lint]")
        print("\n".join(ln for ln in lint_lines if ln.strip()))
    else:
        print("[lint] clean (DEAD-MARGIN judged below instead)")
    if lint.stderr.strip():
        print(lint.stderr, file=sys.stderr)

    if layout_widths:
        failed = True
        print(f"\n[layout width] {len(layout_widths)} over {DEAD_MARGIN_LIMIT} units "
              "of empty board on one side")
        for name, side, amount in layout_widths:
            print(f"  {name}: {side} {amount:g}")
    else:
        print("[layout width] every figure uses the shared canvas")

    scan = subprocess.run(
        [sys.executable, str(HERE / "overlap_scan.py")],
        capture_output=True, text=True)
    if scan.returncode:
        failed = True
        print("\n[line overlap]")
        print(scan.stdout.strip())
    else:
        print("[line overlap] no coincident connectors")

    faint = contrast_errors(svgs)
    if faint:
        failed = True
        print(f"\n[text contrast] {len(faint)} labels under {CONTRAST_FLOOR:g}:1 "
              "against what is drawn under them")
        for name, text, fg, bg, ratio in faint:
            print(f"  {name}: 「{text}」 {fg} on {bg} — {ratio:.1f}:1")
    else:
        print(f"[text contrast] every label clears {CONTRAST_FLOOR:g}:1")

    tall = height_reviews(svgs)
    if tall:
        print(f"\n[height review] {len(tall)} over the board's limit "
              f"({' · '.join(f'{b}→{h}' for b, h in HEIGHT_REVIEW.items())}) — "
              "split or keep, but decide")
        for name, height in tall:
            print(f"  {name}: {height:g}" if height else f"  {name}: no height")

    if "--render" in argv:
        outdir = pathlib.Path(argv[argv.index("--render") + 1])
        outdir.mkdir(parents=True, exist_ok=True)
        for svg in svgs:
            subprocess.run([sys.executable, str(AUDIT), "render", str(svg),
                            str(outdir / f"{svg.stem}.png"), "2"],
                           check=False, capture_output=True)
        print(f"\nrendered to {outdir} — read them")

    print("\nverdict:", "needs work" if failed else "pass")
    return 1 if failed else 0


raise SystemExit(main(sys.argv[1:]))
