"""Regenerate the presentation's own figures.

    python3 tools/diagrams/build.py              every module
    python3 tools/diagrams/build.py s02          named modules only

A figure module is any `*.py` beside this file other than the shared ones.
Each one draws its figures at import time and calls `save()` for each. The
proposal's figures are not built here — they come from the root
`tools/diagrams/build.py` and are read from `proposal/diagrams/` as they are.
"""
import pathlib
import runpy
import sys

HERE = pathlib.Path(__file__).resolve().parent
SHARED = {"common", "build", "verify", "overlap_scan"}
sys.path.insert(0, str(HERE))


def main(argv):
    wanted = set(argv)
    modules = sorted(p for p in HERE.glob("*.py") if p.stem not in SHARED)
    if wanted:
        modules = [m for m in modules if m.stem in wanted]
        missing = wanted - {m.stem for m in modules}
        if missing:
            sys.exit(f"no such figure module: {', '.join(sorted(missing))}")
    if not modules:
        sys.exit("nothing to generate")
    for m in modules:
        print(f"--- {m.stem} ---")
        runpy.run_path(str(m), run_name="__main__")


main(sys.argv[1:])
