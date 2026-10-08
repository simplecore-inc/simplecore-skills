"""Report line breaks against R1-R3 in saved figures, with a count per file.

    python3 <skill>/scripts/docfigures/linebreaks.py                  the config's out
    python3 <skill>/scripts/docfigures/linebreaks.py a.svg b.svg      these files
    python3 <skill>/scripts/docfigures/linebreaks.py --counts ...     counts only

R1: a line breaks only at a 「·」 separator, never inside an item. R2: a
parenthesised group that would break inside moves whole to the next line.
R3: only when that adds a line does it break inside, and then at a separator.
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
    ap = argparse.ArgumentParser(description="Report line breaks against R1-R3.")
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
    counts = {svg.name: 0 for svg in svgs}
    for name, rule, lines, detail, fixable in found:
        counts[name] += 1
        if not args.counts:
            print(f"✖ {name} {rule}{'' if fixable else ' (unfixable)'}: {detail}")
            print(f"    {' / '.join(lines)}")
    for name, n in counts.items():
        if n or not args.counts:
            print(f"{n:3d}  {name}")
    print(f"{len(found)} break(s) against R1-R3 in "
          f"{sum(1 for n in counts.values() if n)} of {len(svgs)} file(s)")
    return 1 if found else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
