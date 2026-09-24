"""Check every figure before it is committed.

Seven passes, and the first six fail the run:

1. the shared canvas width - a figure of any other width prints at a different
   type size from its neighbours
2. the type scale - a one-off size is invisible in the source and obvious on
   the page
3. the type hierarchy - a figure set entirely on the smallest rung prints as
   a block of grey with no entry point
4. the stroke ladder - three weights for the whole set, icons excepted
5. the dash vocabulary - four gaps, one meaning each
6. the toolkit's static lint - arrowheads, overflow, occlusion, margins
7. height review - a recommendation, not a failure

None of them replaces looking at the rendered figure. Use `--render <dir>` to
write PNGs to read.
"""
import pathlib
import re
import subprocess
import sys

from common import (BODY, FONT_STACK, SUB_BODY, DASH_ALT, DASH_BLOCK, DASH_OUTSIDE, DASH_PENDING,
                    FONT_SCALE, HAIRLINE, ICON_SW, OUT, PLACEMENT, STROKE,
                    THICK, toolkit_dir)

AUDIT = toolkit_dir() / "audit.py"
HEIGHT_REVIEW = 840


def _head(svg):
    return svg.read_text(encoding="utf-8")[:600]


def width_errors(svgs):
    """Figures whose final canvas is not one of the declared boards."""
    out = []
    boards = sorted(PLACEMENT)
    for svg in svgs:
        m = re.search(r'<svg\b[^>]*\bwidth="([\d.]+)"[^>]*\bviewBox="0 0 ([\d.]+)',
                      _head(svg))
        if not m:
            out.append(svg.name)
            continue
        w, vb = float(m.group(1)), float(m.group(2))
        if not any(abs(w - b) <= 0.01 and abs(vb - b) <= 0.01 for b in boards):
            out.append(svg.name)
    return out


def height_reviews(svgs, maximum=HEIGHT_REVIEW):
    out = []
    for svg in svgs:
        m = re.search(r'<svg\b[^>]*\bheight="([\d.]+)"', _head(svg))
        if not m or float(m.group(1)) > maximum:
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


def smallest_rung_only(svgs):
    """Figures whose every word prints at the ladder's smallest rung.

    A figure whose every word sits on MICRO has no hierarchy at print size:
    the reader has no entry point and reads it as a block of grey. The
    smallest rung is for a short marker and a value looked up, not for the
    figure's own words.
    """
    return [svg.name for svg in svgs
            if not [v for v in re.findall(r'font-size="([\d.]+)"',
                                          svg.read_text(encoding="utf-8"))
                    if float(v) >= BODY]]


def sub_body_heavy(svgs, limit=0.5):
    """Figures with most of their characters on a rung below the body size.

    Every size can be on the ladder while the figure's sentences print below
    the paragraph beside it. Counted in characters, so many short chips beside
    a few body-size lines pass and card bodies left on a tag rung do not.
    """
    if not SUB_BODY:
        return []
    out = []
    for svg in svgs:
        small = total = 0
        for size, body in re.findall(
                r'<text\b[^>]*font-size="([\d.]+)"[^>]*>([^<]*)</text>',
                svg.read_text(encoding="utf-8")):
            n = len(body.strip())
            total += n
            if any(abs(float(size) - r) < 0.01 for r in SUB_BODY):
                small += n
        if total and small / total > limit:
            out.append((svg.name, small / total))
    return out


def font_family_errors(svgs):
    """Texts naming a stack other than the document's declared one."""
    if not FONT_STACK:
        return []
    out = []
    for svg in svgs:
        fams = set(re.findall(r'<text\b[^>]*font-family="([^"]+)"',
                              svg.read_text(encoding="utf-8")))
        bad = sorted(f for f in fams if f != FONT_STACK)
        if bad:
            out.append((svg.name, bad[0]))
    return out


def stroke_width_errors(svgs):
    """Strokes off the three declared weights.

    An icon is drawn from line segments at ICON_SW and is exempt: it is one
    glyph, not a border. Every other stroke is a border, a rail or a
    connector, and takes one of the three declared weights.
    """
    allowed = {HAIRLINE, STROKE, THICK}
    out = []
    for svg in svgs:
        text = svg.read_text(encoding="utf-8")
        seen = {}
        for element in re.findall(r'<[a-z]+\b[^>]*>', text):
            m = re.search(r'stroke-width="([\d.]+)"', element)
            if not m:
                continue
            width = float(m.group(1))
            if width in allowed:
                continue
            if width == ICON_SW and 'stroke-linecap="round"' in element:
                continue
            seen[width] = seen.get(width, 0) + 1
        if seen:
            out.append((svg.name, sorted(seen.items())))
    return out

def dash_pattern_errors(svgs):
    """Dash patterns off the four the set declares.

    A dashed line carries one of four meanings and the gap is what tells them
    apart, so a fifth gap is a meaning the reader cannot look up. One figure in a
    set of 132 drew the only `3 7` in the document, and nothing reported it: it
    read as a prohibition to its author and as nothing at all to a reader
    matching it against the four.
    """
    allowed = {DASH_PENDING, DASH_OUTSIDE, DASH_ALT, DASH_BLOCK}
    out = []
    for svg in svgs:
        found = set(re.findall(r'stroke-dasharray="([^"]+)"',
                               svg.read_text(encoding="utf-8")))
        unexpected = sorted(found - allowed)
        if unexpected:
            out.append((svg.name, unexpected))
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
        print(f"\n[width] {len(widths)} off every declared board")
        for name in widths:
            print(" ", name)
    else:
        print(f"[width] all on a declared board {sorted(PLACEMENT)}")

    fonts = font_size_errors(svgs)
    if fonts:
        failed = True
        print(f"\n[type scale] {len(fonts)} with off-ladder sizes")
        for name, sizes in fonts:
            print(f"  {name}: {', '.join(f'{s:g}' for s in sizes)}")
    else:
        print("[type scale] all on the ladder")

    flat = smallest_rung_only(svgs)
    if flat:
        failed = True
        print(f"\n[type hierarchy] {len(flat)} with nothing above the smallest rung")
        for name in flat:
            print(" ", name)
    else:
        print("[type hierarchy] every figure carries a larger rung")

    heavy = sub_body_heavy(svgs)
    if heavy:
        failed = True
        print(f"\n[sub-body share] {len(heavy)} with most characters below "
              "the body size - set running text at the body rung")
        for name, share in heavy:
            print(f"  {name}: {share:.0%}")
    elif SUB_BODY:
        print("[sub-body share] running text sits at the body rung or above")

    fams = font_family_errors(svgs)
    if fams:
        failed = True
        print(f"\n[font family] {len(fams)} not set in FONT_STACK")
        for name, fam in fams:
            print(f"  {name}: {fam[:60]}")
    elif FONT_STACK:
        print("[font family] every text in FONT_STACK")

    strokes = stroke_width_errors(svgs)
    if strokes:
        failed = True
        print(f"\n[stroke] {len(strokes)} with widths off "
              f"{HAIRLINE} / {STROKE} / {THICK}")
        for name, widths in strokes:
            print(f"  {name}: "
                  + ", ".join(f"{w:g}x{n}" for w, n in widths))
    else:
        print(f"[stroke] all on {HAIRLINE} / {STROKE} / {THICK}")

    dashes = dash_pattern_errors(svgs)
    if dashes:
        failed = True
        print(f"\n[dash] {len(dashes)} with patterns off the declared four")
        for name, patterns in dashes:
            print(f"  {name}: " + ", ".join(patterns))
    else:
        print("[dash] every dash on one of the four declared patterns")

    lint = subprocess.run(
        [sys.executable, str(AUDIT), "lint", *[str(s) for s in svgs]],
        capture_output=True, text=True)
    if lint.returncode:
        failed = True
        print("\n[lint]")
        print(lint.stdout.strip() or lint.stderr.strip())
    else:
        print("[lint] clean")

    tall = height_reviews(svgs)
    if tall:
        print(f"\n[height review] {len(tall)} over {HEIGHT_REVIEW} - split or keep, "
              "but decide")
        for name, height in tall:
            print(f"  {name}: {height:g}" if height else f"  {name}: no height")

    if "--render" in argv:
        outdir = pathlib.Path(argv[argv.index("--render") + 1])
        outdir.mkdir(parents=True, exist_ok=True)
        for svg in svgs:
            subprocess.run([sys.executable, str(AUDIT), "render", str(svg),
                            str(outdir / f"{svg.stem}.png"), "2"], check=False)
        print(f"\nrendered to {outdir} - read them")

    print("\nverdict:", "needs work" if failed else "pass")
    return 1 if failed else 0


raise SystemExit(main(sys.argv[1:]))
