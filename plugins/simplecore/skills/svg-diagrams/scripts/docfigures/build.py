"""Regenerate a project's document figures.

    python3 <skill>/scripts/docfigures/build.py               every module
    python3 <skill>/scripts/docfigures/build.py ch03 ch08     named modules only
    python3 <skill>/scripts/docfigures/build.py --config path/to/document-figures.json

Run from the project (or name its config with `--config`). The figure modules
are the files the config's `modules` globs match. These files are never run
even when a glob matches them: a test file (`test_*.py`,
`*_test.py`), a helper the config lists under `helpers`, and a file named
after one of this library's own modules, which would shadow it. Each module
draws its figures at import time and calls `save()` for each.

With `wrapListItems` on, the run fails when a wrap fell inside one item of a
「·」 list that fits whole.
"""
import argparse
import os
import runpy
import sys
from pathlib import Path

LIBRARY = Path(__file__).resolve().parent


def library_names():
    """Stems of this library's own modules; a project file with one is skipped."""
    return {p.stem for p in LIBRARY.glob("*.py")}


def is_test_file(path):
    stem = Path(path).stem
    return stem.startswith("test_") or stem.endswith("_test")


def select_modules(cfg, wanted=()):
    """The figure modules this run executes, in glob order.

    Returns (modules, skipped) where skipped holds (path, reason) pairs, so a
    caller can show why a matched file did not run.
    """
    helpers = {p.resolve() for p in cfg.helper_files()}
    own = library_names()
    modules, skipped = [], []
    for path in cfg.module_files():
        if is_test_file(path):
            skipped.append((path, "test file"))
        elif path.resolve() in helpers:
            skipped.append((path, "helper"))
        elif path.stem in own:
            skipped.append((path, "shadows a library module"))
        else:
            modules.append(path)
    if wanted:
        wanted = set(wanted)
        missing = wanted - {m.stem for m in modules}
        if missing:
            raise SystemExit(f"no such figure module: {', '.join(sorted(missing))}")
        modules = [m for m in modules if m.stem in wanted]
    return modules, skipped


def report_split_items(split_items):
    """Print every wrap that fell inside one item of a 「·」 list; 1 if any."""
    for text, lines in split_items:
        print(f"  ✖ line broken inside a list item: 「{text}」 -> 「{' / '.join(lines)}」")
    if split_items:
        print(f"split list items: {len(split_items)} - shorten the string or "
              "widen the box")
    return 1 if split_items else 0


def main(argv):
    parser = argparse.ArgumentParser(description="Regenerate document figures.")
    parser.add_argument("--config", help="path to .claude/document-figures.json")
    parser.add_argument("modules", nargs="*", help="module stems to run")
    args = parser.parse_args(argv)
    if args.config:
        os.environ["DOCUMENT_FIGURES_CONFIG"] = str(Path(args.config).resolve())
    # The library first, so `from common import ...` always reaches it; then
    # each module's own directory, so modules can import their helpers.
    sys.path.insert(0, str(LIBRARY))
    import figconfig
    try:
        cfg = figconfig.load()
    except figconfig.ConfigError as err:
        raise SystemExit(str(err)) from err
    modules, _skipped = select_modules(cfg, args.modules)
    if not modules:
        raise SystemExit("nothing to generate: no figure module matches 'modules'")
    for d in dict.fromkeys(str(m.parent) for m in modules):
        if d not in sys.path:
            sys.path.insert(1, d)
    for m in modules:
        print(f"--- {m.stem} ---")
        runpy.run_path(str(m), run_name="__main__")
    import common
    return report_split_items(common.SPLIT_ITEMS)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
