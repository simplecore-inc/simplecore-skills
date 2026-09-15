#!/usr/bin/env python3
"""The template catalogue — read from the templates, never kept beside them.

A deck with a hundred templates and a prose table listing twenty of them ends
up using twenty: what is not in the table has no entry point, so the page that
needed a `marker-band` gets another bullet list. This reads the declaration
each template carries and writes the catalogue from it, so the list cannot fall
behind the shapes.

Every `<Template>` carries, immediately above it:

    <!-- @kind card · @box tinted · @emph accent×1
         @content two labelled rows under one head
         @shape   tinted card, accent label then muted
         @with    col2 · col3
         @not     the lightest of the labelled-row cards - no badge, no key -->

`@content` is the entry point and is what the author has in hand when a
manuscript page is open, so it is phrased as the content's shape rather than
as the component's. `@not` names the neighbour a wrong choice lands on.

`@kind reserved` is held back by a rule the deck already has (one dark surface
per page, one of two covers); `@kind deprecated` is superseded and waiting to
be removed. Neither counts as unused vocabulary — mixing the three is what made
the census's 「미사용」 list unreadable.

    python3 tools/deck/catalog.py            # check the declarations
    python3 tools/deck/catalog.py --write    # rewrite templates/CATALOG.md
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

def _deck() -> tuple[Path, Path]:
    """(project root, deck directory) — the deck whose `checks.dir` is this one.

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
SOURCES = sorted(p for p in (DECK / "templates").glob("*.xml")
                 if p.name not in ("parts.xml", "master.xml", "figures.xml", "screens.xml"))
OUT = DECK / "templates" / "CATALOG.md"

KINDS = ["shell", "layout", "bar", "section", "head", "prose", "list", "card",
         "row", "band", "figure", "toc", "annex", "wireframe",
         "reserved", "deprecated"]
HELD = {"reserved", "deprecated"}

# The order the catalogue reads in: what a body page reaches for first.
ORDER = ["prose", "list", "row", "card", "band", "section", "bar", "layout",
         "figure", "head", "toc", "shell", "annex", "wireframe",
         "reserved", "deprecated"]

TITLES = {
    "prose": "Prose", "list": "List rows", "row": "Rows across the block",
    "card": "Cards", "band": "Bands", "section": "Section heads",
    "bar": "Region bars", "layout": "Layouts and containers",
    "figure": "Figures", "head": "Page furniture", "toc": "Contents",
    "shell": "Page shells", "annex": "Annex", "wireframe": "Wireframe annex",
    "reserved": "Reserved — a rule holds these back",
    "deprecated": "Superseded — do not reach for these",
}

DECL = re.compile(
    r"<!--\s*@kind\s+(?P<kind>[\w-]+)\s*·\s*@box\s+(?P<box>[^·\n]+?)\s*·\s*"
    r"@emph\s+(?P<emph>[^\n]+?)\s*\n"
    r"\s*@content\s+(?P<content>[^\n]+?)\s*\n"
    r"\s*@shape\s+(?P<shape>[^\n]+?)\s*\n"
    r"\s*@with\s+(?P<with>[^\n]+?)\s*\n"
    r"\s*@not\s+(?P<not>[\s\S]*?)\s*-->\s*\n\s*<Template\b(?:\s+[\w.:-]+=\"[^\"]*\")*?\s+name=\"(?P<name>[^\"]+)\"[^>]*>")


# The server's `form` word for a template, read as the catalogue's kind.
FORM_KINDS = {"card": "card", "row": "row", "grid": "layout", "strip": "row",
              "chip": "row", "figure": "figure", "page": "shell", "layout": "layout",
              "section": "section", "band": "band", "list": "list", "prose": "prose",
              "bar": "bar"}


def attr_declaration(tag: str) -> dict | None:
    """The declaration a server-written template carries as tag attributes:
    `doc` is the content, `use` the shape and neighbours, `form` the kind,
    `tags` the companions. A template with no `doc` has no declaration."""
    attrs = dict(re.findall(r'\b([a-z]+)="([^"]*)"', tag.split(">", 1)[0]))
    if "doc" not in attrs:
        return None
    form = attrs.get("form", "").split()[0] if attrs.get("form") else ""
    return {
        "kind": FORM_KINDS.get(form, "layout"),
        "box": "none", "emph": "none",
        "content": attrs["doc"], "shape": attrs.get("use", ""),
        "with": attrs.get("tags", "").replace(",", " · "),
        "not": "—",
    }


def ink_styles() -> set[str]:
    """Style names whose ground is the ink tone."""
    out: set[str] = set()
    for path in sorted((DECK / "styles").glob("*.xml")) + [DECK / "templates" / "parts.xml"]:
        if not path.exists():
            continue
        for m in re.finditer(r'<Style name="([^"]+)"([^/]*)/>', path.read_text(encoding="utf-8")):
            if 'backgroundColor="14161C"' in m.group(2):
                out.add(m.group(1))
    return out


def known_styles() -> set[str]:
    out: set[str] = set()
    for path in sorted((DECK / "styles").glob("*.xml")) + [DECK / "templates" / "parts.xml"]:
        if path.exists():
            out |= set(re.findall(r'<Style name="([^"]+)"', path.read_text(encoding="utf-8")))
    return out


def paints_ink(body: str, ink: set[str], known: set[str]) -> bool | None:
    """Whether the template paints the deck's one dark surface, or None if unknowable.

    Only the two things that resolve exactly are read: an inline ink ground, and
    a literal class the styles define. A class the page substitutes into
    (`bar-{p}`) and one no style file carries — the kit's `bar-ink`, whose style
    the build generates — return None, because a check that guesses here would
    call a part-coloured bar dark and teach everyone to ignore it.
    """
    if 'backgroundColor="14161C"' in body:
        return True
    classes = {c for cl in re.findall(r'class="([^"]+)"', body) for c in cl.split()}
    if any("{" in c for c in classes) or any(c not in known for c in classes):
        return None
    return bool(classes & ink)


def params(body: str) -> list[str]:
    return list(dict.fromkeys(re.findall(r"\{(\w+)\}", body)))


def slots(body: str) -> list[str]:
    return list(dict.fromkeys(re.findall(r'<Slot name="(\w+)"', body)))


def read() -> tuple[dict[str, dict], list[str]]:
    """Every template's declaration, and what is wrong with the set."""
    entries: dict[str, dict] = {}
    problems: list[str] = []
    ink, known = ink_styles(), known_styles()
    for path in SOURCES:
        src = path.read_text(encoding="utf-8")
        declared = {m.group("name"): m for m in DECL.finditer(src)}
        for m in re.finditer(r'<Template\b(?:\s+[\w.:-]+="[^"]*")*?\s+name="([^"]+)"[^>]*>([\s\S]*?)</Template>', src):
            name, body = m.group(1), m.group(2)
            if name in declared:
                d = declared[name].groupdict()
            else:
                # A template the SlideGlance server wrote declares itself in the
                # tag's own attributes (doc · use · form · tags) rather than in
                # the comment block; read those as the declaration.
                d = attr_declaration(m.group(0))
                if d is None:
                    problems.append(f"{path.name}: {name} 에 @kind 선언이 없다")
                    continue
            if d["kind"] not in KINDS:
                problems.append(f"{name}: @kind {d['kind']} 는 없는 종류다")
            fact = paints_ink(body, ink, known)
            if fact is not None and fact != ("dark" in d["emph"]):
                problems.append(
                    f"{name}: @emph 가 「{d['emph'].strip()}」인데 실제로는 "
                    f"{'어두운 면을 칠한다' if fact else '어두운 면이 없다'} — "
                    f"한 쪽에 어두운 면 하나라는 규칙이 이 값을 읽는다")
            entries[name] = {
                "file": path.name, "kind": d["kind"], "box": d["box"].strip(),
                "emph": d["emph"].strip(), "content": d["content"].strip(),
                "shape": d["shape"].strip(),
                "with": d["with"].strip(),
                "not": " ".join(d["not"].split()),
                "params": params(body), "slots": slots(body),
            }
    # A neighbour named in @with or @not that no longer exists sends the reader
    # looking for a shape the deck removed. Only hyphenated tokens are read —
    # English prose in these fields is not a name.
    prose = {"labelled-row", "shape-only", "self-contained", "page-by-page"}
    for name, e in entries.items():
        for field in ("with", "not"):
            for token in re.findall(r"\b([a-z][a-z0-9]*(?:-[a-z0-9]+)+)\b", e[field]):
                if token in entries or token in prose or token.endswith("*"):
                    continue
                problems.append(f"{name}: @{field} 가 없는 템플릿 {token} 을 가리킨다")

    live = [(n, e["content"]) for n, e in entries.items() if e["kind"] not in HELD]
    seen: dict[str, str] = {}
    for name, content in live:
        if content in seen:
            problems.append(
                f"@content 가 겹친다 — {seen[content]} 와 {name}: 「{content}」. "
                f"둘 중 하나는 다른 내용을 위한 것이거나, 하나가 없어져야 한다")
        seen[content] = name
    return entries, problems


def uses() -> tuple[dict[str, int], dict[str, int]]:
    """(uses on a page, uses from another template or a generator).

    A template a page never names can still be in the deck — `runhead` is
    drawn by `page`, `wf-row` by `wf-note`, `part-item-stat` by the annex
    generator. Counting only the chapters reports those as unused vocabulary
    and buries the ones that really are."""
    direct: dict[str, int] = {}
    indirect: dict[str, int] = {}
    for path in sorted((DECK / "chapters").glob("*.xml")):
        for name in re.findall(r'<Use template="([^"]+)"', path.read_text(encoding="utf-8")):
            direct[name] = direct.get(name, 0) + 1
    tools = Path(__file__).resolve().parent
    others = list(SOURCES) + sorted(tools.glob("*.py")) + sorted(tools.glob("*.mjs")) \
        + [DECK / "main.sgx"]
    for path in others:
        if not path.exists():
            continue
        for name in re.findall(r'template="([^"]+)"', path.read_text(encoding="utf-8")):
            indirect[name] = indirect.get(name, 0) + 1
    return direct, indirect


def markdown(entries: dict[str, dict], counts: dict[str, int],
             indirect: dict[str, int]) -> str:
    out = ["# 컴포넌트 목록",
           "",
           "`tools/deck/catalog.py --write` 가 템플릿의 `@kind` 선언에서 생성한다. "
           "직접 고치지 않는다 — 선언을 고치고 다시 생성한다.",
           "",
           "**고르는 순서.** 원고에서 보이는 모양을 「내용」 칸에서 찾고, 「대신 쓸 것」이 "
           "가리키는 이웃과 견준 뒤, 그 쪽에 이미 있는 강조·어두운 면과 겹치지 않는지 본다. "
           "한 쪽에 어두운 면은 하나, 강조는 블록마다 한 번이다.",
           ""]
    for kind in ORDER:
        rows = [(n, e) for n, e in sorted(entries.items()) if e["kind"] == kind]
        if not rows:
            continue
        out.append(f"## {TITLES[kind]}")
        out.append("")
        out.append("| 컴포넌트 | 내용 | 형태 | 상자 | 강조 | 같이 | 대신 쓸 것 | 인자 | 쓰인 곳 |")
        out.append("| --- | --- | --- | --- | --- | --- | --- | --- | ---: |")
        for name, e in rows:
            p = " ".join(f"`{x}`" for x in e["params"]) or "—"
            if e["slots"]:
                p += " + " + " ".join(f"slot:{s}" for s in e["slots"])
            n = counts.get(name, 0)
            where = str(n) if n else ("템플릿·생성기" if indirect.get(name) else "—")
            out.append(
                f"| `{name}` | {e['content']} | {e['shape']} | {e['box']} | {e['emph']} "
                f"| {e['with']} | {e['not']} | {p} | {where} |")
        out.append("")
    return "\n".join(out) + "\n"


# ── the contact sheet ───────────────────────────────────────────────────────
# Nobody picks `marker-band` from a name. The sheet stands every live shape on a
# page with placeholder content, so choosing is looking. Placeholders are keyed
# by the parameter's name, which is why the deck keeps one parameter vocabulary.
SAMPLE = {
    "head": "제목이 여기에 선다", "text": "제목이 여기에 선다",
    "title": "제목이 여기에 선다", "titleA": "첫 줄", "titleB": "둘째 줄",
    "subText": "부제 한 줄", "sub": "부제 한 줄", "kicker": "머리말",
    "bodyText": "본문은 두 줄 남짓으로 서고, 컴포넌트의 폭과 줄 간격을 그대로 보여 준다.",
    "bodyA": "왼쪽 본문", "bodyB": "오른쪽 본문",
    "valueText": "값이 여기에 온다", "answer": "대응 내용", "demand": "요구 내용",
    "note": "주석 한 줄", "inNote": "입력 주석", "opNote": "처리 주석", "outNote": "출력 주석",
    "noteA": "주석 A", "noteB": "주석 B", "noteC": "주석 C",
    "aText": "첫째 줄 내용", "bText": "둘째 줄 내용", "cText": "셋째 줄 내용",
    "midText": "가운데 칸 내용", "endText": "닫는 칸 내용", "tailText": "닫는 줄",
    "leftText": "왼쪽 내용", "rightText": "오른쪽 내용",
    "inHead": "입력", "opHead": "처리", "outHead": "출력",
    "headA": "머리 A", "headB": "머리 B", "headC": "머리 C",
    "label": "라벨", "aLabel": "라벨", "bLabel": "라벨", "cLabel": "라벨",
    "midLabel": "가운데", "endLabel": "닫는", "tailLabel": "마무리",
    "leftLabel": "요구", "rightLabel": "구현", "answerLabel": "대응",
    "inLabel": "입력", "opLabel": "처리", "outLabel": "출력",
    "labelA": "라벨 A", "labelB": "라벨 B", "labelC": "라벨 C",
    "inkLabel": "지표", "inkValue": "61건", "inkNote": "짧은 설명",
    "inkNoteA": "첫 줄", "inkNoteB": "둘째 줄",
    "keyLabel": "구분", "keyText": "핵심 문구", "chapterRef": "Ⅳ-2",
    "value": "12", "unit": "종", "count": "4회", "stat": "19종",
    "no": "1", "badge": "1", "mark": "1.", "ids": "SFR-001", "proof": "증빙 1",
    "reqId": "SFR-001", "source": "출처 한 줄", "reference": "근거 1",
    "role": "역할", "form": "형태", "chipText": "핵심", "chapters": "Ⅳ-2",
    "elements": "이 항목이 다루는 내용", "item": "평가항목",
    "period": "2026-09 ~ 2026-12", "duration": "3개월", "method": "현장 확인",
    "when": "착수 1주", "verb": "수집한다", "formula": "A ÷ B × 100",
    "numerator": "성공 건수", "denominator": "전체 건수", "suffix": "%",
    "footLabel": "남기는 것", "footText": "원본과 해석 결과",
    "purpose": "용도", "layout": "구성", "behavior": "동작", "auth": "권한", "data": "자료",
    "icon": "list-checks", "p": "4", "color": "1B4A9C", "tint": "EEF2FA",
    "accent": "1B4A9C", "grow": "1",
    "cellW": "216", "stepW": "210", "labelW": "105", "headW": "96", "w": "216", "h": "24",
    "imageH": "200", "src": "assets/brand/cover.png", "caption": "설명 한 줄",
    "altText": "대체 텍스트", "roman": "Ⅳ", "page": "49", "name": "이름", "id": "C-01",
    "kind": "탭", "screenId": "C-01", "reqs": "SFR-001", "cluster": "묶음",
    "chapter": "1. 장 이름", "evalItem": "평가항목", "folio": "부록 - 1",
    "part": "기술 및 기능", "romanX": "-4", "lede": "간지 리드",
    "master": "PLAIN", "padLeft": "56", "padRight": "56", "gap": "22",
    "notes": "발표자 노트 자리.", "ref": "Ⅳ-2", "refTitle": "기능 요구사항", "refPages": "57~101",
    "aW": "160", "gapTop": "24", "nodeW": "150", "tone": "kw",
    "proposer": "[제안사명]", "keyValue": "값", "line1": "첫 줄", "line2": "둘째 줄",
    "org1": "발주 기관", "org2": "부서", "date": "2026-09-09",
    "aText2": "", "bText2": "",
}
SHEET_KINDS = ["prose", "list", "row", "card", "band", "section", "bar", "figure"]
# A shape that resolves to zero height without a row parent. Which template is
# the row is the deck's own name for it.
NEEDS_ROW = {"badge-panel", "key-panel"}
ROW_LAYOUTS = ("equal-pair", "cols2", "col2")
# A container whose slot the sheet fills with one paragraph.
SLOT_FILL = '<Use template="copy-text" bodyText="슬롯에 들어가는 내용." />'


def sheet(entries: dict[str, dict]) -> str:
    """A deck that stands every live shape on a page, one section per kind."""
    def call(name: str, e: dict) -> str:
        attrs = " ".join(f'{k}="{SAMPLE.get(k, k)}"' for k in e["params"])
        tag = f'<Use template="{name}" {attrs}'.rstrip()
        if not e["slots"]:
            return tag + " />"
        inner = "".join(f'<Slot name="{s}">{SLOT_FILL}</Slot>' for s in e["slots"])
        return tag + ">" + inner + "</Use>"

    shell = entries.get("page", {}).get("params", [])
    label = "section" if "section" in entries else None
    row_layout = next((r for r in ROW_LAYOUTS if r in entries), None)
    # A placeholder that falls through prints the parameter's own name into the
    # sheet, where it reads as content. Refuse instead.
    unknown = sorted({p for n, e in entries.items() if e["kind"] in SHEET_KINDS
                      for p in e["params"] if p not in SAMPLE})
    if unknown:
        raise SystemExit("자리표시가 없는 인자: " + " · ".join(unknown)
                         + " — catalog.py 의 SAMPLE 에 넣는다")

    def open_page(kind: str, i: int) -> str:
        fixed = {"chapter": f"{kind} · {i + 1}", "title": TITLES[kind], "part": "컴포넌트 목록",
                 "sub": "자리표시 내용으로 세운 모양이다. 글이 아니라 형태를 본다.",
                 "evalItem": "해당 없음", "reqs": "해당 없음"}
        attrs = " ".join(f'{k}="{fixed.get(k, SAMPLE.get(k, k))}"' for k in shell)
        return f'  <Use template="page" {attrs}>'

    pages: list[str] = []
    for kind in SHEET_KINDS:
        rows = [(n, e) for n, e in sorted(entries.items())
                if e["kind"] == kind and n not in ("prose-list",)]
        for i in range(0, len(rows), 4):
            chunk = rows[i:i + 4]
            body = []
            for name, e in chunk:
                one = call(name, e)
                if name in NEEDS_ROW and row_layout:
                    gap = ' gap="22"' if row_layout == "equal-pair" else ""
                    one = (f'<Use template="{row_layout}"{gap}><Slot name="left">'
                           + one + '</Slot><Slot name="right">' + one + "</Slot></Use>")
                body.append(
                    f'<Use template="{label}" icon="square-dashed" text="{name} — {e["content"]}">'
                    f'<Slot name="default">{one}</Slot></Use>' if label else one)
            pages.append(open_page(kind, i // 4)
                         + f'\n    <Slot name="default">{"".join(body)}</Slot>\n  </Use>')

    head = (DECK / "main.sgx").read_text(encoding="utf-8")
    head = head.split("<Import src=\"chapters/")[0]
    return head + "\n".join(pages) + "\n</SlideGlance>\n"


def main() -> int:
    ap = argparse.ArgumentParser(description="템플릿 선언을 읽어 목록을 만든다")
    ap.add_argument("--write", action="store_true", help="templates/CATALOG.md 를 다시 쓴다")
    ap.add_argument("--sheet", action="store_true",
                    help="out/catalog.sgx 를 만든다 — `npx tsx catalog.ts` 가 그린다")
    args = ap.parse_args()

    if args.sheet:
        entries, _ = read()
        out = DECK / "out" / "catalog.sgx"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(sheet(entries), encoding="utf-8")
        live = sum(1 for e in entries.values() if e["kind"] in SHEET_KINDS)
        print(f"{out.relative_to(ROOT)} — 컴포넌트 {live}종")
        return 0

    entries, problems = read()
    counts, indirect = uses()

    body = markdown(entries, counts, indirect)
    if args.write:
        OUT.write_text(body, encoding="utf-8")
        print(f"{OUT.relative_to(ROOT)} — 컴포넌트 {len(entries)}종")
    elif OUT.exists() and OUT.read_text(encoding="utf-8") != body:
        problems.append(f"{OUT.name} 가 선언과 다르다 — --write 로 다시 만든다")
    elif not OUT.exists():
        problems.append(f"{OUT.name} 가 없다 — --write 로 만든다")

    unused = sorted(n for n, e in entries.items()
                    if e["kind"] not in HELD and not counts.get(n)
                    and not indirect.get(n))
    held = sorted(n for n, e in entries.items() if e["kind"] in HELD)
    for line in problems:
        print(f"✖ {line}")
    print(f"컴포넌트 선언 대조: {len(entries)}종 · 어긋남 {len(problems)}건 "
          f"· 아직 아무도 꺼내지 않은 것 {len(unused)}종 · 보류·폐기 {len(held)}종")
    if unused:
        print("  꺼내지 않은 것: " + " · ".join(unused))
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
