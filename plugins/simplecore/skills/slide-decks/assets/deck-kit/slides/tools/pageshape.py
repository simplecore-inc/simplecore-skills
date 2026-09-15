#!/usr/bin/env python3
"""A page needs a shape, and a list has to be a list.

Two things a page-by-page review cannot see. A page whose body is prose and
bullets under every heading looks fine on its own; sixty-seven of them in a row
is the deck reading as one page repeated, and the census per 부 does not reach
it because it counts kinds, not pages. And a run of bullets is the shape an
author reaches for when no other shape has an entry point — so this reads every
run and says what the content's own form asks for, using the catalogue's
vocabulary.

    python3 tools/deck/pageshape.py             # the two failures
    python3 tools/deck/pageshape.py --simulate  # every page, every run, and the
                                                # component the rules would pick

The simulation changes nothing. It is meant to be read before a page is
rewritten, so the choice is made against the whole deck rather than one page.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import catalog  # noqa: E402

ROOT, DECK = catalog.ROOT, catalog.DECK
SGX = DECK / "main.sgx"

# A page's body is more than prose when it carries one of these kinds.
SHAPE_KINDS = {"card", "row", "band", "figure"}

OPENER = re.compile(r'<Use template="(page|toc|part|cover|cover-art|annex-page|'
                    r'annex-part|annex-index|annex-last-page|wf-page|wf-last-page|annex-end)"')
ROW = re.compile(r'<Use template="(dot-row|num-row|prose-item)"[^>]*?bodyText="([^"]*)"')
RUN = re.compile(r'<Use template="prose-list">([\s\S]*?)</Use>\s*(?=<|$)')
HEADING = re.compile(r'<Use template="(?:section|section-req|section-compact|copy-block|'
                     r'copy-panel|section-bar[a-z-]*)"[^>]*?text="([^"]*)"')

# What a region's own heading says the block under it is. The heading is the
# one piece of the author's intent a bullet run keeps, and it outranks counting
# sentences: 「단계별 점검」 over three rows is a sequence whatever the rows look
# like. It covers about one run in seven, so it is a priority signal, not the
# classifier.
HEAD_CUE = [
    (("순서", "절차", "단계", "흐름"), "step-row"),
    (("기준", "조건", "판정", "예외"), "branch-detail"),
    (("효과", "지표", "성과", "실적"), "stat-cell"),
    (("역할", "책임", "담당"), "node-card"),
    (("구성", "범위", "경계"), "card-split"),
    (("방법", "방안", "대책"), "item"),
    (("대상", "항목", "목록", "일람"), None),      # a list that is a list
]

COLON = re.compile(r"[:：]")
ORDINAL = re.compile(r"(먼저|이어|그다음|다음으로|마지막으로|우선|첫째|둘째|셋째|\d단계|\d차)")
CONDITION = re.compile(r"(하면|되면|경우|→|미만이면|이상이면|아니면)")
MEASURE = re.compile(r"\d+(?:개|건|%|초|일|주|개월|종|대|회|MB|TB)")
SHORT = 30

# A page may run a list, but not instead of having a shape. The floor is read
# off the deck: its median body page carries 5 list rows against 2 shaped
# blocks, so one shape per six rows is the loose end of what it already does,
# and a page under it is a page whose body is a list with decoration.
LIST_CEILING = 12
ROWS_PER_SHAPE = 6


def from_heading(heading: str) -> tuple[str | None, str] | None:
    """The shape the region's own heading asks for, if it says."""
    for words, comp in HEAD_CUE:
        if any(w in heading for w in words):
            return comp, f"제목 「{heading[:18]}」이 그 모양을 가리킨다"
    return None


def candidates(rows: list[str], heading: str = "") -> tuple[list[str], str]:
    """The components the run's own form allows, best first, and why.

    More than one, on purpose. A classifier that returns a single answer turns
    a deck of bullets into a deck of that one card — the table monotony reborn
    — so the placement pass below picks from this list under the rhythm rules.
    Conservative: a run that is genuinely a list comes back empty.
    """
    n = len(rows)
    cue = from_heading(heading) if heading else None
    if cue and cue[0] is None and n >= 4:
        return [], ""                      # the heading says it is a list, and it is
    colon = sum(1 for t in rows if COLON.search(t))
    short = sum(1 for t in rows if len(t) <= SHORT)
    cond = sum(1 for t in rows if CONDITION.search(t))
    order = sum(1 for t in rows if ORDINAL.search(t))
    measure = sum(1 for t in rows if MEASURE.search(t))
    half = max(2, n // 2)

    if n == 1:
        return (["delta-row", "ruled-note", "copy-text"], "한 줄짜리 목록 — 「라벨: 값」이다") \
            if colon else (["copy-text", "item"], "한 줄짜리 목록 — 문단이다")
    if cue and cue[0]:
        return [cue[0], "pair-card", "trio-card", "detail-card"], cue[1]
    if colon == n:
        if n == 2:
            return ["pair-card", "keyrow", "delta-row", "paired-note"], "「라벨: 값」 두 줄"
        if n == 3:
            return ["trio-card", "keyrow", "pair-card", "axis-card"], "「라벨: 값」 세 줄"
        return ["keyrow", "Table", "col2 + prose-list"], "「라벨: 값」이 넷 이상"
    if order >= half:
        return ["step-row", "num-step", "stage-detail", "num-card"], "순서를 가리키는 말이 절반 이상"
    if cond >= half:
        return ["branch-detail", "panel-row", "choice-card", "ledger-row"], "조건과 결과가 짝을 이룬다"
    if measure >= half and n <= 3:
        return ["stat-cell", "fact-band", "anchor-row"], "값과 단위가 있다"
    if short == n and n >= 6:
        return ["col2 + prose-list", "Table", "num-card"], "짧은 항목이 여섯 개 이상"
    if n == 2 and colon == 0 and short < n:
        return ["pair-card", "item", "detail-card", "card-split"], "한 머리 아래 두 줄이 서술한다"
    if n == 3 and colon == 0 and short < n:
        return ["trio-card", "detail-card", "num-card", "proof-line"], "한 머리 아래 세 줄이 서술한다"
    return [], ""


def dark_set(entries: dict[str, dict]) -> set[str]:
    """The shapes that spend the page's one dark surface, from the declarations.

    A hardcoded list here would go stale the first time a component gained or
    lost its ink ground, which is the whole reason the declaration exists.
    """
    return {n for n, e in entries.items() if "dark" in e["tags"]}


def place(body: list[dict], kind_of: dict[str, str],
          dark: set[str] | None = None) -> list[dict]:
    """Assign one component per run, reading the deck in printed order.

    Three constraints, the same ones rhythm.py judges the result by: a page
    does not repeat what the page before it leaned on, a 부 does not let one
    component past a third of its picks, and a page carries one dark surface.
    """
    dark = dark or set()
    part_picks: dict[str, list[str]] = {}
    previous: list[str] = []
    out: list[dict] = []
    for p in body:
        part = p["file"][:1]
        picks = part_picks.setdefault(part, [])
        on_page = {u for u in p["uses"] if kind_of.get(u) in SHAPE_KINDS}
        chosen: list[tuple[int, str, str, str]] = []
        for run, heading in p["runs"]:
            allowed, why = candidates(run, heading)
            if not allowed:
                continue
            share = len(picks) / 3.0 + 1
            pick, note = None, ""
            for c in allowed:
                if c in dark and (on_page & dark):
                    continue
                if c in previous:
                    note = note or f"앞 쪽이 {c} 를 썼다"
                    continue
                if picks.count(c) >= share:
                    note = note or f"이 부에서 {c} 가 이미 {picks.count(c)}번"
                    continue
                if c in on_page:
                    note = note or f"이 쪽에 {c} 가 이미 있다"
                    continue
                pick = c
                break
            if pick is None:
                pick = allowed[0]
                note = (note + " · 대안이 모두 막혀 첫 후보로 둔다").strip(" ·")
            chosen.append((len(run), pick, why, note))
            picks.append(pick)
            on_page.add(pick)
        out.append({**p, "picks": chosen})
        previous = [c for _, c, _, _ in chosen]
    return out


def pages() -> list[dict]:
    """Every page of the imported deck, in printed order."""
    order = re.findall(r'<Import src="(chapters/[^"]+)"', SGX.read_text(encoding="utf-8"))
    out: list[dict] = []
    n = 0
    for rel in order:
        src = (DECK / rel).read_text(encoding="utf-8")
        starts = [m.start() for m in OPENER.finditer(src)]
        for i, start in enumerate(starts):
            end = starts[i + 1] if i + 1 < len(starts) else len(src)
            block = src[start:end]
            n += 1
            title = re.search(r'title="([^"]*)"', block)
            out.append({
                "no": n, "file": Path(rel).name,
                "kind": OPENER.match(src[start:]).group(1),
                "title": title.group(1) if title else "",
                "uses": re.findall(r'<Use template="([^"]+)"', block),
                "tables": block.count("<Table"),
                "runs": [([t for _, t in ROW.findall(m.group(1))],
                          (HEADING.findall(block[:m.start()]) or [""])[-1])
                         for m in RUN.finditer(block)],
            })
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="쪽의 모양과 목록의 형태를 본다")
    ap.add_argument("--simulate", action="store_true",
                    help="쪽마다 어떤 컴포넌트가 뽑히는지 적는다 — 아무것도 바꾸지 않는다")
    args = ap.parse_args()

    entries, _ = catalog.read()
    kind_of = {n: e["form"] for n, e in entries.items()}

    flat: list[str] = []
    dense: list[str] = []
    thin: list[str] = []
    body = [p for p in pages() if p["kind"] == "page"]
    for p in body:
        shapes = [u for u in p["uses"]
                  if kind_of.get(u) in SHAPE_KINDS or u.startswith(("fig-", "cap-"))]
        rows = sum(len(r) for r, _ in p["runs"])
        if not shapes and not p["tables"]:
            flat.append(f"{p['no']:3d}쪽 {p['file']} — 「{p['title']}」 "
                        f"· 문단과 목록뿐이다 (목록 {rows}행)")
        elif rows >= LIST_CEILING and (len(shapes) + p["tables"]) * ROWS_PER_SHAPE < rows:
            dense.append(f"{p['no']:3d}쪽 {p['file']} — 「{p['title']}」 · 목록 {rows}행에 "
                         f"모양 {len(shapes) + p['tables']}개 (여섯 행마다 하나는 있어야 한다)")
        for run, _ in p["runs"]:
            if len(run) == 1:
                thin.append(f"{p['no']:3d}쪽 {p['file']} — 한 줄짜리 목록: "
                            f"「{run[0][:34]}…」")

    if args.simulate:
        placed = place(body, kind_of, dark_set(entries))
        print("쪽별 시뮬레이션 — 지금의 모양과, 읽기 리듬까지 본 뒤 뽑히는 컴포넌트")
        print("아무것도 바꾸지 않는다. 「후보」는 그 묶음의 형태가 허락하는 것들이고,")
        print("「뽑음」은 앞 쪽·부의 사용량·그 쪽에 이미 있는 것을 본 결과다.\n")
        picked: dict[str, int] = {}
        for p in placed:
            shapes = sorted({u for u in p["uses"] if kind_of.get(u) in SHAPE_KINDS})
            if not p["picks"] and shapes:
                continue
            print(f"{p['no']:3d}쪽 {p['file'][:36]:36s} "
                  f"지금: {' · '.join(shapes) if shapes else '문단과 목록뿐'}")
            for n, pick, why, note in p["picks"]:
                picked[pick] = picked.get(pick, 0) + 1
                tail = f"   ({note})" if note else ""
                print(f"       {n}행 → {pick:20s} {why}{tail}")
        print(f"\n뽑힌 컴포넌트: " + " · ".join(
            f"{k} {v}" for k, v in sorted(picked.items(), key=lambda kv: -kv[1])))
        print(f"바꿀 후보 목록 묶음 {sum(picked.values())}개 · 본문 {len(body)}쪽")
        return 0

    for line in flat + dense:
        print(f"✖ {line}")
    for line in thin:
        print(f"✖ {line}")
    print(f"쪽 모양 대조: 본문 {len(body)}쪽 · 문단과 목록뿐인 쪽 {len(flat)} "
          f"· 목록이 모양을 압도하는 쪽 {len(dense)} · 한 줄짜리 목록 {len(thin)}건")
    if flat or dense or thin:
        print("  --simulate 가 쪽마다 어떤 컴포넌트를 뽑는지 적는다.")
    return 1 if (flat or dense or thin) else 0


if __name__ == "__main__":
    raise SystemExit(main())
