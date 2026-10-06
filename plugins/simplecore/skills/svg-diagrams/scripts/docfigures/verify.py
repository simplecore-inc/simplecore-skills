"""Check a project's document figures before they are committed.

    python3 <skill>/scripts/docfigures/verify.py                 every figure
    python3 <skill>/scripts/docfigures/verify.py 4-1- 5-1-       names starting so
    python3 <skill>/scripts/docfigures/verify.py --render /tmp/figs
    python3 <skill>/scripts/docfigures/verify.py --config path/to/document-figures.json

One check per property. A check whose vocabulary the config does not declare
does not run, and the report says so; every other failing check fails the
run. The reviews list what to look at and fail nothing.

  width          every figure on a declared board
  type scale     every size on the ladder
  sub-body share how much text sits below the body rung: all of it never,
                 more than `subBodyShareMax` never
  max rung       nothing above `maxRung`
  font family    every text in `fontStack`
  stroke         every stroke on the declared ladder, icons excepted
  filter         no element references an SVG filter, which PowerPoint's
                 import drops together with the element
  dash           every dash on a declared pattern
  dash legend    where two dash meanings are drawn (every dash with
                 `dashGloss: "every"`), each names its declared meaning
                 before any gloss
  legend         a legend word names a distinction the drawing carries
  foot legend    no key line under the drawing
  icon           no Lucide name written at a call site
  bullets        each figure lists all its items or none, as it declares
  stub-line      no wrapped run ends on a line under `stubLine` of its longest
  label form     no label closes on a predicate
  register       no label carries a clause, particle or working word
  section numbers no document section number in figure text
  markers        every connector call states its marker
  lint           the toolkit's static lint, with DEAD-MARGIN judged per board
  contrast       every label clears the contrast floor on its own ground
  references     every link and placement resolves, captions match, copies
                 are current, nothing is left unplaced
  content edge, legend edge, strip, height    reviews

None of them replaces looking at the rendered figure.
"""
import argparse
import re
import subprocess
import sys
from pathlib import Path

LIBRARY = Path(__file__).resolve().parent
sys.path.insert(0, str(LIBRARY))

import figconfig  # noqa: E402
from figlib.checks_copy import (dash_legend_errors, icon_literals,  # noqa: E402,F401
                                predicate_labels, register_errors, section_number_errors)
from figlib.checks_drawing import (bullet_mode, dash_pattern_errors,  # noqa: E402,F401
                                   filter_errors, font_family_errors, font_size_errors,
                                   foot_legends, height_reviews, legend_mismatches,
                                   legend_past_column, max_rung_errors, past_content_edge,
                                   strip_reviews, stroke_width_errors, stub_lines,
                                   sub_body_share, width_errors)
from figlib.checks_refs import references  # noqa: E402
from figlib.svgread import texts, toolkit_dir  # noqa: E402,F401


# ── toolkit passes ─────────────────────────────────────────────────────────
def _audit(cfg, *args):
    return subprocess.run([sys.executable, str(toolkit_dir(cfg) / "audit.py"), *args],
                          capture_output=True, text=True)


def marker_errors(cfg):
    """Lines of `audit.py markers` over the project's figure sources."""
    files = [str(f) for f in cfg.source_files()]
    if not files:
        return []
    run = _audit(cfg, "markers", *files)
    return [ln.strip() for ln in run.stdout.splitlines() if "✖" in ln]


def lint(svgs, cfg):
    """(failing lint lines, dead-margin findings) from `audit.py lint`.

    Where the config sets `deadMargin` for a board, the lint's own 40-unit
    DEAD-MARGIN gives way to that limit: a set that keeps a fixed board per
    class carries a wider gap on a genuinely narrow figure without being
    wrong, and the gap that does mean the layout was never widened is larger.
    """
    run = _audit(cfg, "lint", *[str(s) for s in svgs])
    failing, dead = [], []
    current, limit = None, None
    for line in run.stdout.splitlines():
        m = re.match(r"=== lint (.+?) \((\d+)x", line)
        if m:
            current = m.group(1)
            limit = cfg.dead_margin(int(m.group(2)))
            failing.append(line)
            continue
        dm = re.search(r"DEAD-MARGIN: ([\d.]+)px of empty board at the (left|right)", line)
        if dm and limit is not None:
            if float(dm.group(1)) > limit:
                dead.append((current, dm.group(2), float(dm.group(1)), limit))
            continue
        if "DEAD-MARGIN" in line and limit is not None:
            continue
        failing.append(line)
    # keep only the files that still carry a failure
    out, block = [], []
    for line in failing + ["=== end"]:
        if line.startswith("=== "):
            if any("✖" in ln for ln in block):
                out += block
            block = [line]
        else:
            block.append(line)
    if run.returncode and not out and not dead and "✖" not in run.stdout:
        out = [run.stderr.strip() or "audit.py lint failed without a report"]
    return out, dead


def contrast_errors(svgs, cfg):
    """Lines of `audit.py contrast`, or None when the config turns it off."""
    floor = cfg.get("contrastFloor", 3.0)
    if floor is None:
        return None
    run = _audit(cfg, "contrast", "--floor", str(floor), *[str(s) for s in svgs])
    found, current = [], None
    for ln in run.stdout.splitlines():
        m = re.match(r"=== contrast (.+?) ===", ln)
        if m:
            current = m.group(1)
        elif "✖" in ln:
            found.append(f"{current}: {ln.strip().removeprefix('✖ ')}")
    if run.returncode and not found:
        # it could not look, which is not a pass
        found = [f"contrast check did not run: {run.stderr.strip()[-300:]}"]
    return found


# ── report ─────────────────────────────────────────────────────────────────
class Report:
    def __init__(self):
        self.failed = False

    def check(self, name, found, ok, fmt, head=None):
        """Print one check: `found` None means not configured, [] means clean."""
        if found is None:
            print(f"[{name}] not configured")
            return
        if not found:
            print(f"[{name}] {ok}")
            return
        self.failed = True
        print(f"\n[{name}] {head or len(found)}")
        for item in found:
            print("  " + fmt(item))

    def review(self, name, found, head, fmt):
        if found:
            print(f"\n[{name}] {len(found)} {head}")
            for item in found:
                print("  " + fmt(item))


def run(cfg, prefixes=(), render_dir=None):
    svgs = sorted(cfg.out.glob("*.svg"))
    if prefixes:
        svgs = [s for s in svgs if s.name.startswith(tuple(prefixes))]
    if not svgs:
        raise SystemExit(f"no figures in {cfg.out}")
    print(f"checked {len(svgs)} file(s)")
    r = Report()
    widths = width_errors(svgs, cfg)
    r.check("width", widths, f"all on a declared board {sorted(cfg.boards)}",
            lambda n: n, f"{len(widths)} off every declared board")
    r.check("type scale", font_size_errors(svgs, cfg), "all on the ladder",
            lambda i: f"{i[0]}: {', '.join(f'{s:g}' for s in i[1])}")
    r.check("sub-body share", sub_body_share(svgs, cfg),
            "every figure carries body-rung text, within the share",
            lambda i: f"{i[0]}: {i[1]:.0%} of characters below BODY")
    r.check("max rung", max_rung_errors(svgs, cfg), "nothing above the largest rung",
            lambda i: f"{i[0]}: {', '.join(f'{v:g}' for v in i[1])}")
    r.check("font family", font_family_errors(svgs, cfg), "every text in fontStack",
            lambda i: f"{i[0]}: {i[1][:60]}")
    r.check("stroke", stroke_width_errors(svgs, cfg), "all on the stroke ladder",
            lambda i: f"{i[0]}: " + ", ".join(f"{w:g}x{n}" for w, n in i[1]))
    r.check("filter", filter_errors(svgs, cfg), "no element references a filter",
            lambda i: f"{i[0]}: {i[1]} element(s) reference a filter, which "
                      "PowerPoint drops with the element - draw on canvas()")
    r.check("dash", dash_pattern_errors(svgs, cfg), "every dash on a declared pattern",
            lambda i: f"{i[0]}: {', '.join(i[1])}")
    r.check("dash legend", dash_legend_errors(svgs, cfg),
            "every dash a gloss is owed names its declared meaning",
            lambda i: f"{i[0]}: {i[4]} - 「{i[1]}」 means 「{i[2]}」"
                      + (f", glossed as 「{i[3]}」" if i[3] else ""))
    r.check("legend", legend_mismatches(svgs, cfg), "every named distinction is drawn",
            lambda i: f"{i[0]}: the legend says 「{i[1]}」 but {i[2]}")
    r.check("foot legend", foot_legends(svgs, cfg), "no key line under any drawing",
            lambda i: f"{i[0]}: 「{i[1]}」 - name the mark where it is used")
    r.check("icon", icon_literals(cfg), "every icon name comes from 'icons'",
            lambda i: f"{i[0]}:{i[1]} \"{i[2]}\" -> "
                      + (f"ICON_OF[\"{i[3]}\"]" if i[3] else "register its meaning in 'icons' first"))
    r.check("bullets", bullet_mode(svgs, cfg), "every figure lists all its items or none",
            lambda i: f"{i[0]}: {i[1]}")
    r.check("stub-line", stub_lines(svgs, cfg), "no wrapped run ends on a stub",
            lambda i: f"{i[0]}: 「{i[1][:30]}」 is {i[2]:.0%} of 「{i[3][:30]}」 - "
                      "shorten the string or widen the column")
    r.check("label form", predicate_labels(svgs, cfg), "every label in noun form",
            lambda i: f"{i[0]}: {i[1][:60]}")
    r.check("register", register_errors(svgs, cfg), "every label a 개조식 noun phrase",
            lambda i: f"{i[0]} · {i[1]}: {i[2]}")
    r.check("section numbers", section_number_errors(svgs, cfg), "none",
            lambda i: f"{i[0]}: {', '.join(i[1])}")
    r.check("markers", marker_errors(cfg), "every connector call states its marker",
            lambda line: line)
    lint_lines, dead = lint(svgs, cfg)
    r.check("lint", [ln for ln in lint_lines if ln.strip()], "clean", lambda ln: ln,
            "toolkit lint")
    r.check("layout width", dead, "no side gap over the board's dead-margin limit",
            lambda i: f"{i[0]}: {i[1]} {i[2]:g} (limit {i[3]:g})")
    r.check("contrast", contrast_errors(svgs, cfg), "every label clears the floor",
            lambda line: line)
    ref = references(cfg)
    if ref is None:
        print("[references] not configured")
    else:
        problems, links, placed, nfiles = ref
        r.check("references", problems,
                f"{links} manuscript links · {placed} placed only in a deck · "
                f"{nfiles} files, none broken or unplaced", lambda p: p,
                f"{len(problems)} problem(s) over {nfiles} files")
    r.review("content edge", past_content_edge(svgs, cfg),
             "with a box past the line the rest line up on - look, then keep or pull it in",
             lambda i: f"{i[0]}: {i[2]:g} units past the edge at {i[1]:g}, "
                       f"{i[3] * 100:.0f}% of the right margin")
    r.review("legend edge", legend_past_column(svgs, cfg),
             "foot lines reach the box column - advice; ink runs ~10% narrower",
             lambda i: f"{i[0]}: {i[1]:+.1f} units 「{i[2][:46]}」")
    r.review("strip", strip_reviews(svgs, cfg),
             "full-width figures flatter than the strip ratio - if the claim reads top "
             "to bottom and the page has text to set beside it, draw it on the column board",
             lambda i: f"{i[0]}: {i[1]:.2f}")
    r.review("height", height_reviews(svgs, cfg), "over the board's height review - split or keep, but decide",
             lambda i: f"{i[0]}: {i[1]:g} (review at {i[2]:g})" if i[1] else f"{i[0]}: no height")
    if render_dir:
        render_dir.mkdir(parents=True, exist_ok=True)
        for svg in svgs:
            _audit(cfg, "render", str(svg), str(render_dir / f"{svg.stem}.png"), "2")
        print(f"\nrendered to {render_dir} - read them")
    print("\nverdict:", "needs work" if r.failed else "pass")
    return 1 if r.failed else 0


def main(argv):
    ap = argparse.ArgumentParser(description="Check document figures.")
    ap.add_argument("--config", help="path to .claude/document-figures.json")
    ap.add_argument("--render", type=Path, help="write PNGs to read into this directory")
    ap.add_argument("prefixes", nargs="*", help="check only figures whose name starts so")
    args = ap.parse_args(argv)
    try:
        cfg = figconfig.load(args.config)
    except figconfig.ConfigError as err:
        raise SystemExit(str(err)) from err
    return run(cfg, args.prefixes, args.render)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
