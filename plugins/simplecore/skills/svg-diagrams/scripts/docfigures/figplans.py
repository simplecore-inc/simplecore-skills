"""Check each figure's plan in the manuscript against what the figure prints.

    python3 <skill>/scripts/docfigures/figplans.py [--config path/to/document-figures.json]

A figure is redrawn whenever its chapter changes, and the plan describing it
lives in another file, so the two drift apart silently: the build succeeds,
the lint passes, and the reader is handed a plan that names a symbol the
drawing stopped using. For every figure a manuscript captions:

- the planned strings and the printed ones agree in both directions: every
  string the figure prints is covered by the plan's cell, and every item the
  cell names is printed. Matching is by containment with quotation brackets
  and whitespace removed, because a phrase the figure wraps onto two lines is
  two text elements and one cell item
- the figure hangs right above its caption (one blank line between)
- a line style the page tells the reader to look for is in the drawing
- a drawn dash names its meaning inside the drawing

Each comparison is scoped to one figure: a page carrying two figures judges the
second against its own cell, not the first one's.

The manuscript conventions come from the config's `plans` object; see the
schema in the skill's references/document-figures.md.
"""
import argparse
import re
import sys
from pathlib import Path

LIBRARY = Path(__file__).resolve().parent
sys.path.insert(0, str(LIBRARY))

import figconfig  # noqa: E402
from figlib.svgread import texts  # noqa: E402


def norm(s):
    """A plan cell and a drawing differ in spacing and quotation brackets."""
    return re.sub(r"[「」『』\s]", "", s)


def cell_items(cell):
    """Split a cell on middle dots that are not inside 「」 or 『』."""
    out, depth, cur = [], 0, ""
    for ch in cell:
        if ch in "「『":
            depth += 1
        elif ch in "」』":
            depth = max(0, depth - 1)
        if ch == "·" and depth == 0:
            out.append(cur)
            cur = ""
            continue
        cur += ch
    out.append(cur)
    return [s.strip() for s in out if s.strip()]


def figure_name(spec, page, index):
    """The figure's file stem from the caption's page and index."""
    pad = int(spec.get("pagePad", 0))
    if pad and page.isdigit():
        page = page.zfill(pad)
    return spec["name"].format(page=page, index=index)


def check(cfg):
    """(problems, checked) for every planned figure."""
    spec = cfg.get("plans")
    if not spec:
        raise figconfig.ConfigError(f"{cfg.path}: no 'plans' object to check against")
    block_start = re.compile(spec["blockStart"]) if spec.get("blockStart") else None
    row = re.compile(spec["row"])
    caption = re.compile(spec["caption"])
    embed = spec.get("embed")
    dash_word = cfg.get("dashWord")
    meanings = [w for _p, ws in cfg.dashes.values() for w in ws]
    if dash_word:
        meanings.insert(0, dash_word)
    problems, checked = [], 0
    for pattern in spec["manuscripts"]:
        for md in cfg.glob(pattern):
            rel = cfg.rel(md)
            cell, block = None, []
            for line in md.read_text(encoding="utf-8").split("\n"):
                if block_start and block_start.search(line):
                    block = []
                block.append(line)
                m = row.match(line)
                if m:
                    cell = m.group(1).strip()
                    continue
                cap = caption.match(line)
                if not cap:
                    continue
                page, index = cap.group("page"), cap.group("index")
                label = f"{page}-{index}"
                stem = figure_name(spec, page, index)
                svg = cfg.out / f"{stem}.svg"
                if not svg.exists():
                    problems.append(f"{rel}: figure {label} has no SVG ({svg.name})")
                    cell, block = None, []
                    continue
                if cell is None:
                    problems.append(f"{rel}: figure {label} has no plan cell")
                    block = []
                    continue
                if embed:
                    want = embed.format(caption=cap.group("caption"), name=stem)
                    got = block[-3] if len(block) >= 3 else ""
                    if got != want:
                        problems.append(f"{rel}: figure {label} is not hung one blank line "
                                        f"above its caption; expected: {want}")
                checked += 1
                printed = [t for _a, t in texts(svg) if t]
                cell_text, svg_text = norm(cell), norm("".join(printed))
                missing = [s for s in dict.fromkeys(printed) if norm(s) not in cell_text]
                if missing:
                    problems.append(f"{rel}: figure {label} prints what its plan does not "
                                    "name: " + " · ".join(f"「{s}」" for s in missing))
                extra = [s for s in cell_items(cell) if norm(s) not in svg_text]
                if extra:
                    problems.append(f"{rel}: the plan names what figure {label} does not "
                                    "print: " + " · ".join(f"「{s}」" for s in extra))
                raw = svg.read_text(encoding="utf-8")
                dashed = "stroke-dasharray=" in raw
                if dash_word:
                    says = any((ln.startswith("- ") or ln.startswith("|")) and dash_word in ln
                               for ln in block)
                    if says and not dashed:
                        problems.append(f"{rel}: the page tells the reader to follow "
                                        f"「{dash_word}」 and figure {label} draws none")
                if dashed and meanings and not any(w in " ".join(printed) for w in meanings):
                    problems.append(f"{rel}: figure {label} draws a dash without naming its "
                                    "meaning: one of " + " · ".join(meanings))
                cell, block = None, []
    return problems, checked


def main(argv):
    ap = argparse.ArgumentParser(description="Check figure plans against figures.")
    ap.add_argument("--config", help="path to .claude/document-figures.json")
    args = ap.parse_args(argv)
    try:
        cfg = figconfig.load(args.config)
        problems, checked = check(cfg)
    except figconfig.ConfigError as err:
        raise SystemExit(str(err)) from err
    for p in problems:
        print(p)
    if problems:
        print(f"\n{len(problems)} mismatch(es) over {checked} planned figure(s)")
        return 1
    print(f"{checked} planned figure(s) match their drawings")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
