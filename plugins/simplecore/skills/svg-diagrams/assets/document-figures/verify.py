"""Check every figure before it is committed.

Four passes, and the first three fail the run:

1. the shared canvas width — a figure of any other width prints at a different
   type size from its neighbours
2. the type scale — a one-off size is invisible in the source and obvious on
   the page
3. the toolkit's static lint — arrowheads, overflow, occlusion, margins
4. height review — a recommendation, not a failure

None of them replaces looking at the rendered figure. Use `--render <dir>` to
write PNGs to read.
"""
import pathlib
import re
import subprocess
import sys

from common import FONT_SCALE, OUT, STANDARD_WIDTH, toolkit_dir

AUDIT = toolkit_dir() / "audit.py"
HEIGHT_REVIEW = 840


def _head(svg):
    return svg.read_text(encoding="utf-8")[:600]


def width_errors(svgs):
    """Figures whose final canvas is not the shared width."""
    out = []
    for svg in svgs:
        m = re.search(r'<svg\b[^>]*\bwidth="([\d.]+)"[^>]*\bviewBox="0 0 ([\d.]+)',
                      _head(svg))
        if not m or abs(float(m.group(1)) - STANDARD_WIDTH) > 0.01 \
                or abs(float(m.group(2)) - STANDARD_WIDTH) > 0.01:
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


def main(argv):
    svgs = sorted(OUT.glob("*.svg"))
    if not svgs:
        sys.exit(f"no figures in {OUT}")
    print(f"checked {len(svgs)} file(s)")
    failed = False

    widths = width_errors(svgs)
    if widths:
        failed = True
        print(f"\n[width] {len(widths)} not {STANDARD_WIDTH}")
        for name in widths:
            print(" ", name)
    else:
        print(f"[width] all {STANDARD_WIDTH}")

    fonts = font_size_errors(svgs)
    if fonts:
        failed = True
        print(f"\n[type scale] {len(fonts)} with off-ladder sizes")
        for name, sizes in fonts:
            print(f"  {name}: {', '.join(f'{s:g}' for s in sizes)}")
    else:
        print("[type scale] all on the ladder")

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
        print(f"\n[height review] {len(tall)} over {HEIGHT_REVIEW} — split or keep, "
              "but decide")
        for name, height in tall:
            print(f"  {name}: {height:g}" if height else f"  {name}: no height")

    if "--render" in argv:
        outdir = pathlib.Path(argv[argv.index("--render") + 1])
        outdir.mkdir(parents=True, exist_ok=True)
        for svg in svgs:
            subprocess.run([sys.executable, str(AUDIT), "render", str(svg),
                            str(outdir / f"{svg.stem}.png"), "2"], check=False)
        print(f"\nrendered to {outdir} — read them")

    print("\nverdict:", "needs work" if failed else "pass")
    return 1 if failed else 0


raise SystemExit(main(sys.argv[1:]))
