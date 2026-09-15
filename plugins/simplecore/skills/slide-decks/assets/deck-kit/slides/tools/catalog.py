#!/usr/bin/env python3
"""What the component catalogue's own checks still have to say.

A template declares itself in its own attributes, and the SlideGlance server is
the catalogue: `definition_find` ranks the deck's templates, styles and masters
against a purpose, a shape or a tag, and `render_definition` draws one of them
on its own so a shape is chosen by looking rather than by name. Nothing here
generates an index, because an index kept beside the templates ends up shorter
than the templates.

    <Template name="pair-card" params="head,aLabel,aText"
              form="card" tags="tinted,accent"
              doc="two labelled rows under one head (tinted card, accent label then muted)"
              use="with col2 · col3; not the plain labelled-row card - no badge, no key">

`doc` is the entry point and is what the author has in hand when a manuscript
page is open, so it is phrased as the CONTENT's shape rather than the
component's. `use` names the neighbour a wrong choice lands on, which is the
field that does the work. `tags` carry `reserved` (held back by a rule the deck
already has) and `deprecated` (superseded and waiting to be removed).

What the server does not judge, and this check does:

  - a live template with no `doc` — the server warns, a deck stops
  - a `form` outside the deck's own vocabulary, which is usually a typo
  - two live templates claiming the same `doc`: they are one component and a
    decision nobody made
  - a neighbour named in `use` or `tags` that the deck does not have, which is
    what happens the moment a component set is copied between decks
  - a `dark` tag that disagrees with the template's own ink ground, since the
    「one dark surface per page」 rule reads that claim

    python3 tools/catalog.py

Exit code 1 when anything above fires.

FORMS is this deck's own vocabulary. Edit it when the deck grows a shape the
list does not name; do not widen it to silence a typo.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def _deck() -> tuple[Path, Path]:
    """(project root, deck directory) - the deck whose `checks.dir` is this one.

    The script does not know which deck it belongs to and must not guess: a
    catalogue built against the wrong templates reads as a catalogue.
    """
    here = Path(__file__).resolve().parent
    for root in here.parents:
        config = root / ".claude" / "slide-decks.json"
        if not config.exists():
            continue
        raw = re.sub(r"^\s*//.*$", "", config.read_text(encoding="utf-8"), flags=re.M)
        for deck in json.loads(raw).get("decks", {}).values():
            if (root / deck["checks"]["dir"]).resolve() == here:
                return root, (root / deck["dir"]).resolve()
    raise SystemExit("slide-decks.json 에서 이 검사 디렉터리를 checks.dir 로 갖는 덱을 찾지 못했다")


ROOT, DECK = _deck()
# Generated files declare themselves in their generator; reading them here would
# fail the check on a stale file and let a raise in the generator slip past.
GENERATED = ("parts.xml", "master.xml", "figures.xml", "screens.xml")
SOURCES = sorted(p for p in (DECK / "templates").glob("*.xml") if p.name not in GENERATED)

FORMS = {"page", "shell", "layout", "bar", "section", "head", "prose", "list",
         "card", "row", "grid", "strip", "chip", "band", "figure", "toc",
         "annex", "wireframe", "cover", "divider"}
HELD = {"reserved", "deprecated"}
INK = "14161C"
TEMPLATE = re.compile(
    r'<Template\b((?:\s+[\w.:-]+="[^"]*")*)\s*(?:/>|>([\s\S]*?)</Template>)')
ATTR = re.compile(r'\b([\w.:-]+)="([^"]*)"')
# A token is read as a template name when it is hyphenated or ends in a digit
# (`cols2-top`, `col2`); English prose in `use` is not a name, and a trailing `*`
# marks a family rather than one template. A one-word name without a digit
# cannot be told from prose and is not read.
NAME_TOKEN = re.compile(r"\b([a-z][a-z0-9]*(?:-[a-z0-9]+)+|[a-z]+[0-9]+)\b")
PROSE = {"labelled-row", "shape-only", "self-contained", "page-by-page",
         "reader-facing", "full-width", "two-column", "three-column"}


def styles_with_ink() -> tuple[set[str], set[str]]:
    """(style names whose ground is the ink tone, every style name the deck defines)."""
    dark: set[str] = set()
    known: set[str] = set()
    for path in sorted((DECK / "styles").glob("*.xml")) + [DECK / "templates" / "parts.xml"]:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        known |= set(re.findall(r'<Style name="([^"]+)"', text))
        for m in re.finditer(r'<Style name="([^"]+)"([^/]*)/>', text):
            if f'backgroundColor="{INK}"' in m.group(2):
                dark.add(m.group(1))
    return dark, known


def paints_ink(body: str, dark: set[str], known: set[str]) -> bool | None:
    """Whether the template paints the deck's one dark surface, or None if unknowable.

    Only the two things that resolve exactly are read: an inline ink ground, and
    a literal class the styles define. A class the page substitutes into
    (`bar-{p}`) and one no style file carries - one whose style the build
    generates - return None, because a check that guesses here would call a
    part-coloured bar dark and teach everyone to ignore it.
    """
    if f'backgroundColor="{INK}"' in body:
        return True
    classes = {c for cl in re.findall(r'class="([^"]+)"', body) for c in cl.split()}
    if any("{" in c for c in classes) or any(c not in known for c in classes):
        return None
    return bool(classes & dark)


def read() -> tuple[dict[str, dict], list[str]]:
    """Every template's declaration, and what is wrong with the set."""
    entries: dict[str, dict] = {}
    problems: list[str] = []
    dark, known = styles_with_ink()
    for path in SOURCES:
        for m in TEMPLATE.finditer(path.read_text(encoding="utf-8")):
            attrs = dict(ATTR.findall(m.group(1)))
            body = m.group(2) or ""
            name = attrs.get("name")
            if not name:
                continue
            tags = [t.strip() for t in attrs.get("tags", "").split(",") if t.strip()]
            doc = attrs.get("doc", "").strip()
            form = attrs.get("form", "").strip()
            held = bool(HELD & set(tags))
            if not doc:
                problems.append(
                    f"{path.name}: {name} 에 doc 이 없다 - 서버는 이름과 인수로만 찾는다")
            if form and form not in FORMS:
                problems.append(f"{name}: form {form} 은 이 덱의 어휘가 아니다")
            if not form and not held:
                problems.append(f"{name}: form 이 없다 - 모양으로 찾을 수 없다")
            fact = paints_ink(body, dark, known)
            if fact is not None and fact != ("dark" in tags):
                problems.append(
                    f"{name}: tags 가 「{','.join(tags) or '없음'}」인데 실제로는 "
                    f"{'어두운 면을 칠한다' if fact else '어두운 면이 없다'} - "
                    "한 쪽에 어두운 면 하나라는 규칙이 이 값을 읽는다")
            entries[name] = {"file": path.name, "form": form, "tags": tags,
                             "doc": doc, "use": attrs.get("use", "").strip(),
                             "held": held}

    for name, e in entries.items():
        for field in ("use", "tags"):
            value = e["use"] if field == "use" else " ".join(e["tags"])
            for token in NAME_TOKEN.findall(value):
                if token in entries or token in PROSE or token.endswith("*"):
                    continue
                problems.append(f"{name}: {field} 가 없는 템플릿 {token} 을 가리킨다")

    seen: dict[str, str] = {}
    for name, e in entries.items():
        if e["held"] or not e["doc"]:
            continue
        if e["doc"] in seen:
            problems.append(
                f"doc 이 겹친다 - {seen[e['doc']]} 와 {name}: 「{e['doc']}」. "
                "둘 중 하나는 다른 내용을 위한 것이거나, 하나가 없어져야 한다")
        seen[e["doc"]] = name
    return entries, problems


def uses() -> tuple[dict[str, int], dict[str, int]]:
    """(uses on a page, uses from another template or a generator).

    A template a page never names can still be in the deck - a running head is
    drawn by the page template, a row by the card that holds it, a stat row by
    the annex generator. Counting only the chapters reports those as unused
    vocabulary and buries the ones that really are.
    """
    direct: dict[str, int] = {}
    indirect: dict[str, int] = {}
    for path in sorted((DECK / "chapters").glob("*.xml")):
        for name in re.findall(r'<Use template="([^"]+)"', path.read_text(encoding="utf-8")):
            direct[name] = direct.get(name, 0) + 1
    tools = Path(__file__).resolve().parent
    others = list(SOURCES) + sorted(tools.glob("*.py")) + sorted(tools.glob("*.mjs")) \
        + sorted(DECK.glob("*.ts"))
    for path in others:
        if not path.exists():
            continue
        for name in re.findall(r'template="([^"]+)"', path.read_text(encoding="utf-8")):
            indirect[name] = indirect.get(name, 0) + 1
    return direct, indirect


def main() -> int:
    entries, problems = read()
    direct, indirect = uses()

    unused = sorted(n for n, e in entries.items()
                    if not e["held"] and not direct.get(n) and not indirect.get(n))
    held = sorted(n for n, e in entries.items() if e["held"])
    for line in problems:
        print(f"✖ {line}")
    print(f"컴포넌트 선언 대조: {len(entries)}종 · 어긋남 {len(problems)}건 "
          f"· 아직 아무도 꺼내지 않은 것 {len(unused)}종 · 보류·폐기 {len(held)}종")
    if unused:
        print("  꺼내지 않은 것: " + " · ".join(unused))
    print("  목록은 서버가 쥔다 - definition_find 로 찾고 render_definition 으로 본다")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
