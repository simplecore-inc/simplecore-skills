"""Builders for the page-composition and text checks: printed slides, sources, layouts.

A slide is the shape `sg://deck/content?format=json` answers with: blocks with
roles, where a component is a `use` node whose children are what it draws. The
kit's `<Template kind=...>` declarations come with the markup, as the server
serves the kit's sources beside the deck's.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE.parents[4] / "scripts"))

from bidkit.tests.support import markup, project, reader  # noqa: E402,F401

KINDS = {
    "figure": "figure", "screenshot": "figure", "card": "card", "pair-card": "card",
    "proof-line": "card", "axis-card": "card", "prose": "prose", "list": "list", "deflist": "list",
    "list-row": "list-row", "keyrow": "list-row", "step-row": "list-row", "section": "section",
    "cols2": "layout", "cols3": "layout", "fig-left": "layout", "fig-pair": "layout", "rail": "layout",
    "table": "table", "chip": "chip", "stat-grid": "kpi", "notice": "note",
    "body-x": "internal", "sg-master-head": "internal", "page": "master-page",
}
KIT = "".join(f'<Template\n  name="{n}"\n  kind="{k}"\n  form="x"></Template>\n' for n, k in KINDS.items())


def text(s: str, origin: str = "arg:text", key: str = "") -> dict:
    return {"role": "text", "key": key or f"t{abs(hash((s, origin))) % 10**8}", "text": s,
            "origin": "←" + origin}


def use(tag: str, attrs: dict | None = None, *children: dict, key: str = "") -> dict:
    return {"role": "use", "key": key or f"u{abs(hash((tag, json.dumps(attrs or {}, sort_keys=True), len(children)))) % 10**8}",
            "tag": tag, "attrs": attrs or {}, "children": list(children)}


def table(key: str, *rows: list) -> list:
    return [{"role": "row", "key": f"{key}/row:{i}", "aux": "| " + " | ".join(r) + " |"}
            for i, r in enumerate(rows)]


def page(n: int, *blocks: dict, part: int = 3, chapter: int = 1, master: str | None = None,
         head: dict | None = None) -> dict:
    h = {"tone": str(part), "chapter": f"{chapter}. 장", "title": "가. 쪽", **(head or {})}
    children = [use("sg-master-head", h, key=f"head{n}")] + list(blocks)
    return {"slide": n, "blocks": [{"role": "group", "key": f"g{n}", "children": children},
                                   {"role": "master", "key": f"master:{master or f'BODY-{part}'}"}]}


def recording(slides: list, files: dict | None = None, sources: dict | None = None,
              spaces: dict | None = None, extra: dict | None = None) -> dict:
    """`sources` maps a slide number to the source file that drew it."""
    files = files or {}
    m = markup(files) + "=== file: kit:k/components/all.xml\n" + KIT
    lines = ["generation 1  slides " + str(len(slides))]
    for s in slides:
        src = (sources or {}).get(s["slide"], "pages/a.xml")
        lines.append(f'{s["slide"]}  master=X  nodes=1  diag=0  "t"  use:{src}#1 › x')
    res = {"sg://deck/markup": m, "sg://deck/content?format=json": json.dumps(slides, ensure_ascii=False),
           "sg://deck": "\n".join(lines) + "\n"}
    for n, space in (spaces or {}).items():
        res[f"sg://slide/{n}/space"] = space
    res.update(extra or {})
    return {"resources": res}
