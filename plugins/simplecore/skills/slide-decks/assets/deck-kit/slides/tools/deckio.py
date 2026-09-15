"""Reading the presentation's chapter files.

Every slide is opened by one of the templates in PAGE_TEMPLATES, in the import
order of main.sgx; that order is the only way back from a slide number to its
source. Most of a slide's content sits in attributes, so the text of a page is
the element bodies and the attribute values together.
"""
from __future__ import annotations
import re
from pathlib import Path

DECK = Path(__file__).resolve().parents[1]
SGX = DECK / "main.sgx"
CHAPTERS = DECK / "chapters"

# The templates that open a slide. `toc` carries no folio.
PAGE_TEMPLATES = ("cover", "toc", "page", "closing")
FOLIOLESS = ("toc",)
OPENER = re.compile(r'<Use\s+template="(' + "|".join(PAGE_TEMPLATES) + r')"')
USE_BLOCK = re.compile(
    r'<Use\s+template="(' + "|".join(PAGE_TEMPLATES) + r')"((?:"[^"]*"|\'[^\']*\'|[^>"\'])*?)/?>',
    re.S,
)
ATTR = re.compile(r'([A-Za-z][\w.-]*)="([^"]*)"')


def chapter_files() -> list[Path]:
    """The chapter files in main.sgx import order."""
    main = SGX.read_text(encoding="utf-8")
    return [DECK / rel for rel in re.findall(r'<Import src="(chapters/[^"]+)"', main)]


def slides() -> list[dict]:
    """Every slide in printed order: template, attributes, file, folio (0 when none)."""
    out: list[dict] = []
    folio = 0
    for path in chapter_files():
        text = path.read_text(encoding="utf-8")
        for m in USE_BLOCK.finditer(text):
            template = m.group(1)
            attrs = dict(ATTR.findall(m.group(2)))
            if template not in FOLIOLESS:
                folio += 1
            out.append({
                "template": template,
                "attrs": attrs,
                "file": path.name,
                "folio": folio if template not in FOLIOLESS else 0,
                "span": (m.start(), m.end()),
            })
    return out


def page_text(raw: str) -> str:
    """Everything a reader sees: element bodies and attribute values."""
    bodies = re.sub(r"<[^>]+>", " ", raw)
    attrs = re.compile(r'(?:text|caption|sub|note|keyText|bodyText|head|title|label|valueText|aText|bText|cText)="([^"]*)"')
    return bodies + " " + " ".join(m.group(1) for m in attrs.finditer(raw))
