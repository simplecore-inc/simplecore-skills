#!/usr/bin/env python3
"""Regenerate `lucide.py` - the bundled Lucide icon set - and its licence.

Lucide (https://lucide.dev) draws every icon on a 24×24 grid with a round
stroke, which is exactly the shape `Canvas.icon()` renders, so its markup is
kept as-is rather than redrawn. The whole set is bundled - an author should not have to
regenerate the data to reach for an icon mid-drawing.

The package's LICENSE (ISC for Lucide, MIT for the icons derived from Feather)
travels with the icons: every run writes it into the skill's NOTICE between
the lucide-static marker lines, and a run that finds no LICENSE writes nothing.

    python3 fetch_icons.py                      # npm pack lucide-static
    python3 fetch_icons.py --from <icons dir>   # an already-extracted package
    python3 fetch_icons.py --only cpu,database  # a narrower bundle

The generated file holds the elements verbatim (tag plus numeric attributes);
`svgkit` applies the translate-and-scale at draw time. Nothing here runs when a
diagram is drawn - this is a maintenance script.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "lucide.py"
NOTICE = HERE.parent / "NOTICE"

# The NOTICE block that holds the bundled release's LICENSE, verbatim.
LICENSE_BLOCK = re.compile(
    r"^-------- lucide-static \S+ LICENSE --------\n.*?\n"
    r"-------- end of lucide-static LICENSE --------$", re.S | re.M)

NUMERIC = {"x", "y", "width", "height", "rx", "ry", "cx", "cy", "r",
           "x1", "y1", "x2", "y2"}
KEEP_TAGS = {"path", "circle", "rect", "line", "ellipse", "polyline",
             "polygon"}


def icons_dir(argv_from: str | None) -> tuple[pathlib.Path, str, pathlib.Path | None]:
    """The directory of Lucide .svg files, its version, and a temp dir to clean."""
    if argv_from:
        d = pathlib.Path(argv_from)
        if not d.is_dir():
            sys.exit(f"not a directory: {d}")
        pkg = d.parent / "package.json"
        version = json.loads(pkg.read_text(encoding="utf-8")).get("version", "(local)") \
            if pkg.is_file() else "(local)"
        return d, version, None

    tmp = pathlib.Path(tempfile.mkdtemp(prefix="lucide-"))
    try:
        name = subprocess.run(["npm", "pack", "lucide-static", "--silent"],
                              cwd=tmp, check=True, capture_output=True,
                              text=True).stdout.strip().splitlines()[-1]
    except (subprocess.CalledProcessError, FileNotFoundError) as err:
        shutil.rmtree(tmp, ignore_errors=True)
        sys.exit(f"could not fetch lucide-static ({err}). Pass --from <dir> "
                 "with an already-extracted package.")
    with tarfile.open(tmp / name) as tar:
        tar.extractall(tmp, filter="data")
    version = re.search(r"lucide-static-(.+)\.tgz", name)
    return tmp / "package" / "icons", version.group(1) if version else "?", tmp


def notice_with_license(notice: str, version: str, license_text: str) -> str:
    """`notice` with its lucide-static block holding `license_text` verbatim."""
    block = (f"-------- lucide-static {version} LICENSE --------\n"
             f"{license_text.strip(chr(10))}\n"
             "-------- end of lucide-static LICENSE --------")
    new, n = LICENSE_BLOCK.subn(lambda _m: block, notice)
    if n != 1:
        raise ValueError(f"{NOTICE.name} holds {n} lucide-static LICENSE blocks, not one")
    return new


def parse(svg_text: str) -> list[tuple[str, dict]]:
    """One icon's drawable elements, as (tag, attributes)."""
    out = []
    for m in re.finditer(r"<(\w+)\b([^>]*?)/?>", svg_text):
        tag = m.group(1)
        if tag not in KEEP_TAGS:
            continue
        attrs = dict(re.findall(r'([\w-]+)="([^"]*)"', m.group(2)))
        clean = {}
        for key, value in attrs.items():
            if key in NUMERIC:
                clean[key] = float(value)
            elif key in ("d", "points"):
                clean[key] = " ".join(value.split())
        if clean:
            out.append((tag, clean))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--from", dest="src", help="an extracted lucide-static icons dir")
    ap.add_argument("--only", help="comma-separated names, instead of every icon")
    args = ap.parse_args()
    src, version, tmp = icons_dir(args.src)
    try:
        # npm's package keeps LICENSE beside the icons directory
        license_file = src.parent / "LICENSE"
        if not license_file.is_file():
            sys.exit(f"no LICENSE beside {src}: the icons are not written without "
                     "the licence they ship under")
        try:
            notice = notice_with_license(NOTICE.read_text(encoding="utf-8"), version,
                                         license_file.read_text(encoding="utf-8"))
        except ValueError as err:
            sys.exit(str(err))
        if args.only:
            wanted = [n.strip() for n in args.only.split(",") if n.strip()]
        else:
            wanted = sorted(f.stem for f in src.glob("*.svg"))
        icons, missing = {}, []
        for name in wanted:
            f = src / f"{name}.svg"
            if not f.exists():
                missing.append(name)
                continue
            icons[name] = parse(f.read_text(encoding="utf-8"))
        if missing:
            print("not in this Lucide release:", ", ".join(missing), file=sys.stderr)

        body = [
            '"""Bundled Lucide icons - GENERATED by fetch_icons.py, do not edit.',
            "",
            f"Lucide {version} - ISC licence, and MIT for the icons derived from Feather;",
            "both texts are in the skill's NOTICE.",
            "Each entry is the icon's drawable elements on Lucide's 24x24 grid;",
            "`svgkit.Canvas.icon()` translates and scales them at draw time.",
            '"""',
            "",
            f"VERSION = {version!r}",
            "",
            "ICONS = {",
        ]
        for name in sorted(icons):
            body.append(f"    {name!r}: [")
            for tag, attrs in icons[name]:
                body.append(f"        ({tag!r}, {attrs!r}),")
            body.append("    ],")
        body.append("}")
        OUT.write_text("\n".join(body) + "\n", encoding="utf-8")
        NOTICE.write_text(notice, encoding="utf-8")
        print(f"wrote {OUT}: {len(icons)} icons from Lucide {version}")
        print(f"wrote {NOTICE}: the lucide-static {version} LICENSE")
    finally:
        if tmp:
            shutil.rmtree(tmp, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
