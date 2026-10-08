"""Report line breaks against R1-R4 in saved figures, with a count per file.

    python3 <skill>/scripts/docfigures/linebreaks.py                  the config's out
    python3 <skill>/scripts/docfigures/linebreaks.py a.svg b.svg      these files
    python3 <skill>/scripts/docfigures/linebreaks.py --counts ...     counts only

R1: a line breaks only at a 「·」 separator, never inside an item. R2: a
parenthesised group that would break inside moves whole to the next line.
R3: only when that adds a line does it break inside, and then at a separator.
R4: an item wider than its line breaks at a space inside it, listed, not failed.
A separator never opens a line. `verify.py` runs the same check as
`[line break]`; this command reads any SVG, a deck's copies included.
"""
import argparse
import sys
from pathlib import Path

LIBRARY = Path(__file__).resolve().parent
sys.path.insert(0, str(LIBRARY))

import figconfig  # noqa: E402
from figlib.checks_breaks import line_break_errors  # noqa: E402


def main(argv):
    ap = argparse.ArgumentParser(description="Report line breaks against R1-R4 (R4 as information).")
    ap.add_argument("--config", help="path to .claude/document-figures.json")
    ap.add_argument("--counts", action="store_true", help="print the count per file only")
    ap.add_argument("svgs", nargs="*", type=Path, help="SVG files; default the config's out")
    args = ap.parse_args(argv)
    try:
        cfg = figconfig.load(args.config)
    except figconfig.ConfigError as err:
        raise SystemExit(str(err)) from err
    svgs = args.svgs or sorted(cfg.out.glob("*.svg"))
    found = line_break_errors(svgs, cfg) or []
    counts = {svg.name: [0, 0] for svg in svgs}
    for name, rule, lines, detail, fixable in found:
        info = rule == "R4"
        counts[name][1 if info else 0] += 1
        if not args.counts:
            mark = "ℹ" if info else "✖"
            print(f"{mark} {name} {rule}{'' if fixable else ' (unfixable)'}: {detail}")
            print(f"    {' / '.join(lines)}")
    for name, (n, info) in counts.items():
        if n or info or not args.counts:
            print(f"{n:3d}  {name}" + (f"  (R4 {info})" if info else ""))
    failed = sum(n for n, _i in counts.values())
    print(f"{failed} break(s) against R1-R3 in "
          f"{sum(1 for n, _i in counts.values() if n)} of {len(svgs)} file(s); "
          f"{sum(i for _n, i in counts.values())} over-wide item(s) broken at a space (R4)")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
