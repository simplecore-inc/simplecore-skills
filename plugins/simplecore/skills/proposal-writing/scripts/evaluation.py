#!/usr/bin/env python3
"""The lookup table answers every scoring item, and its pages are where the answers print.

A panel member crosses from the scoring sheet into the proposal through its
lookup table: they read an item off the sheet, find its row, and turn to the
pages it names. Four things break that crossing, and each is checked:

- the rows: an item of the scoring table with no row is an answer nobody finds;
  a row naming an item the scoring table does not carry answers a question
  nobody asked; and when every row is present, a row out of the scoring order
  is passed over by a reader scanning in sheet order
- the pages: a cell such as 「8~11(Ⅲ-1 01~04)」 promises that page Ⅲ-1 01 prints
  as folio 8 and Ⅲ-1 04 as 11. Each folio is compared with the one the deck
  reader computes; a page id in a chapter not typeset yet is pending. A cell
  with folios only (「8~11 · 14」) is compared with the folios of the pages
  whose running head names the item
- the heads: a page whose running head names an item the scoring table does
  not carry, or an item whose row does not send the reader to that page
- the requirement lookup, when one is declared: every id issued (with
  `complete`), none twice, its name as the digest heads it, and every page the
  row cites prints the id (a range such as 「PER-001~004」 counts)

Config (`evaluation`):

    "evaluation": {
      "scoring": { "file": "docs/rfp/scoring.md", "section": "## 붙임#5 …",   // required
                   "columns": { "item": "평가항목", "element": "평가요소" },  // element optional
                   "split": "<br>", "itemPattern": "^\\d\\.\\d" },           // optional
      "lookup": { "file": "proposal/00-서식/조견표.md", "section": "## 인쇄 원고",
                  // or "deck": true to read the table as the deck prints it
                  "columns": { "item": "평가항목", "pages": "관련 페이지" } },  // element optional
      "noneLabel": "해당 없음",                    // optional: a head that answers no item
      "requirements": { "file": ..., "section": ..., "complete": true,       // optional
                        "columns": { "id": "ID", "name": "요구사항명", "pages": "쪽" } }
    }

The running head's item argument is the vocabulary's `pages.head.evalItem`.
"""
from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
import reqid  # noqa: E402
from bidkit import cli  # noqa: E402
from bidkit import mdtable  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader, Page  # noqa: E402

LABEL_SPLIT = re.compile(r"\s*[·,]\s*")


def key(s: str) -> str:
    return re.sub(r"\s+", "", s)


@dataclass
class Row:
    item: str
    element: str
    pages: str
    where: str


def read_table(deck: DeckConfig, spec: dict, needed: list[str], what: str,
               reader: DeckReader | None) -> tuple[mdtable.Table, str]:
    if spec.get("deck"):
        if reader is None:
            raise ConfigError(f"`{what}` reads the deck's printed table but no deck was opened")
        for label, index, rows in reader.tables(join_continued=True):
            if rows and all(c in rows[0] for c in needed):
                return mdtable.Table(rows[0], rows[1:], list(range(2, len(rows) + 1))), f"deck {label} table {index}"
        raise ConfigError(f"the deck prints no table with the columns " + ", ".join(f"「{c}」" for c in needed))
    if not spec.get("file"):
        raise ConfigError(f"`{what}` names neither `file` nor `deck`")
    path = deck.resolve(spec["file"])
    if not path.is_file():
        raise ConfigError(f"`{what}.file` {spec['file']} does not exist")
    text = mdtable.section(path.read_text(encoding="utf-8"), spec.get("section"), spec["file"])
    return mdtable.find(text, needed, spec["file"]), spec["file"]


def columns(spec: dict, what: str, required: tuple) -> dict:
    cols = spec.get("columns")
    if not isinstance(cols, dict) or not all(cols.get(k) for k in required):
        raise ConfigError(f"`{what}.columns` must name " + ", ".join(f"`{k}`" for k in required))
    return cols


def scoring(deck: DeckConfig, reader: DeckReader | None) -> list[tuple[str, str]]:
    """[(item, element)] in the scoring table's order; element is '' without that column."""
    spec = deck.require("evaluation.scoring", "the tender's scoring table")
    cols = columns(spec, "evaluation.scoring", ("item",))
    needed = [cols["item"]] + ([cols["element"]] if cols.get("element") else [])
    table, where = read_table(deck, spec, needed, "evaluation.scoring", reader)
    items = mdtable.filled_down(table, table.column(cols["item"], where))
    pattern = re.compile(spec["itemPattern"]) if spec.get("itemPattern") else None
    split = spec.get("split")
    out = []
    for row, item in zip(table.rows, items):
        item = item.replace("<br>", "").strip()
        if not item or (pattern and not pattern.search(item)):
            continue
        if not cols.get("element"):
            if (item, "") not in out:
                out.append((item, ""))
            continue
        cell = table.cell(row, table.column(cols["element"], where))
        for el in (cell.split(split) if split else [cell]):
            el = re.sub(r"^[-\s]+", "", el).strip()
            if el:
                out.append((item, el))
    if not out:
        raise ConfigError(f"{where}: the scoring table yields no item")
    return out


def lookup(deck: DeckConfig, reader: DeckReader | None) -> list[Row]:
    spec = deck.require("evaluation.lookup", "the proposal's lookup table")
    cols = columns(spec, "evaluation.lookup", ("item", "pages"))
    needed = [cols["item"], cols["pages"]] + ([cols["element"]] if cols.get("element") else [])
    table, where = read_table(deck, spec, needed, "evaluation.lookup", reader)
    items = mdtable.filled_down(table, table.column(cols["item"], where))
    pi = table.column(cols["pages"], where)
    ei = table.column(cols["element"], where) if cols.get("element") else None
    out = []
    for row, item, line in zip(table.rows, items, table.lines):
        if not item:
            continue
        out.append(Row(item, table.cell(row, ei) if ei is not None else "", table.cell(row, pi),
                       f"{where}:{line}"))
    return out


def rows_against_scoring(want: list[tuple[str, str]], rows: list[Row]) -> list[str]:
    """Missing and extra rows, and the first row out of order when the sets agree."""
    have = [(r.item, r.element) for r in rows]
    pool: dict = {}
    for h in have:
        pool[(key(h[0]), key(h[1]))] = pool.get((key(h[0]), key(h[1])), 0) + 1
    missing = []
    for w in want:
        k = (key(w[0]), key(w[1]))
        if pool.get(k):
            pool[k] -= 1
        else:
            missing.append(w)
    extra = []
    for h in have:
        k = (key(h[0]), key(h[1]))
        if pool.get(k):
            pool[k] -= 1
            extra.append(h)
    bad = [f"no row for 「{' · '.join(filter(None, w))}」" for w in missing]
    bad += [f"a row for 「{' · '.join(filter(None, h))}」, which the scoring table does not carry" for h in extra]
    if not missing and not extra:
        for i, (w, h) in enumerate(zip(want, have), 1):
            if (key(w[0]), key(w[1])) != (key(h[0]), key(h[1])):
                bad.append(f"row {i} is out of the scoring order: the table has 「{' · '.join(filter(None, w))}」, "
                           f"the lookup 「{' · '.join(filter(None, h))}」")
                break
    return bad


def id_pattern(reader: DeckReader) -> str:
    cfg = reader.pages_config
    numerals = "|".join(re.escape(n) for n in cfg.numerals)
    parts = re.split(r"(\{part\}|\{chapter\}|\{ordinal(?::[^}]*)?\})", cfg.id_format)
    out = []
    for p in parts:
        if p == "{part}":
            out.append(f"(?:{numerals})")
        elif p == "{chapter}":
            out.append(r"\d+")
        elif p.startswith("{ordinal"):
            out.append(r"\d+")
        else:
            out.append(re.escape(p).replace(r"\ ", r"\s*"))
    return "".join(out)


@dataclass
class Pages:
    by_id: dict          # page id -> Page
    chapters: set        # chapter keys typeset


def deck_pages(reader: DeckReader) -> Pages:
    pages = reader.body_pages()
    return Pages({p.page_id: p for p in pages}, {p.chapter_key for p in pages})


def chapter_of(page_id: str, reader: DeckReader) -> str | None:
    for numeral in sorted(reader.pages_config.numerals, key=len, reverse=True):
        m = re.match(rf"{re.escape(numeral)}-(\d+)", page_id)
        if m:
            return f"{numeral}-{m.group(1)}"
    return None


def cited_ids(cell: str, reader: DeckReader) -> list[tuple[int | None, int | None, str, str]]:
    """[(first folio, last folio, first id, last id)] for every page reference in a cell."""
    pid = id_pattern(reader)
    rx = re.compile(rf"(?:(\d+)(?:\s*~\s*(\d+))?\s*)?\(?\s*({pid})(?:\s*~\s*(\d+))?\s*\)?")
    out = []
    for m in rx.finditer(cell):
        first_id = re.sub(r"\s+", " ", m.group(3)).strip()
        last_id = first_id
        if m.group(4):
            head = re.match(r"(.*?)(\d+)$", first_id)
            if head:
                last_id = head.group(1) + m.group(4).zfill(len(head.group(2)))
        lo = int(m.group(1)) if m.group(1) else None
        hi = int(m.group(2)) if m.group(2) else lo
        out.append((lo, hi, first_id, last_id))
    return out


def folio_set(cell: str) -> set[int]:
    got: set[int] = set()
    for a, b in re.findall(r"(\d+)\s*~\s*(\d+)", cell):
        got.update(range(int(a), int(b) + 1))
    for n in re.findall(r"\d+", re.sub(r"\d+\s*~\s*\d+", " ", cell)):
        got.add(int(n))
    return got


def expand(first: str, last: str) -> list[str]:
    a, b = re.match(r"(.*?)(\d+)$", first), re.match(r"(.*?)(\d+)$", last)
    if not a or not b or a.group(1) != b.group(1):
        return [first]
    width = len(a.group(2))
    return [f"{a.group(1)}{n:0{width}d}" for n in range(int(a.group(2)), int(b.group(2)) + 1)]


def head_items(page: Page, slot: str | None) -> list[str]:
    if not slot:
        return []
    return [v for v in LABEL_SPLIT.split(str(page.head.get(slot, "")).strip()) if v]


def pages_against_deck(rows: list[Row], reader: DeckReader, items: set[str], none_label: str | None,
                       ) -> tuple[list[str], list[str]]:
    """(findings, pending ids) for the pages column and the running heads."""
    pages = deck_pages(reader)
    slot = reader.pages_config.head.get("evalItem")
    bad, pending = [], []
    sent: dict[str, set[str]] = {}            # page id -> items whose row cites it
    for r in rows:
        refs = cited_ids(r.pages, reader)
        if not refs:
            if not slot:
                continue
            want = {p.folio for p in pages.by_id.values() if key(r.item) in map(key, head_items(p, slot))}
            got = folio_set(r.pages)
            if got != want:
                bad.append(f"{r.where} 「{r.item}」: the cell names folios {sorted(got)}, the pages whose head "
                           f"names the item print as {sorted(want)}")
            continue
        for lo, hi, first, last in refs:
            for pid in expand(first, last):
                sent.setdefault(pid, set()).add(key(r.item))
            for folio, pid in dict.fromkeys(((lo, first), (hi, last))):
                page = pages.by_id.get(pid)
                if page is None:
                    if chapter_of(pid, reader) in pages.chapters:
                        bad.append(f"{r.where} 「{r.item}」: {pid} is not a page of the deck")
                    else:
                        pending.append(pid)
                    continue
                if folio is not None and folio != page.folio:
                    bad.append(f"{r.where} 「{r.item}」: {pid} prints as {page.folio}, the cell says {folio}")
    known = {key(i) for i in items}
    for pid, page in pages.by_id.items():
        for label in head_items(page, slot):
            if none_label and key(label) == key(none_label):
                continue
            if key(label) not in known:
                bad.append(f"{pid}: the head names 「{label}」, which the scoring table does not carry")
            elif sent and key(label) not in sent.get(pid, set()):
                bad.append(f"{pid}: the head names 「{label}」, and that item's row does not cite the page")
    return bad, sorted(set(pending))


def requirement_rows(deck: DeckConfig, reader: DeckReader | None) -> tuple[int, list[str], list[str]]:
    """(rows, findings, pending) for the requirement lookup, when one is declared."""
    spec = deck.get("evaluation.requirements")
    if not spec:
        return 0, [], []
    cols = columns(spec, "evaluation.requirements", ("id",))
    needed = [cols["id"]] + [cols[k] for k in ("name", "pages") if cols.get(k)]
    table, where = read_table(deck, spec, needed, "evaluation.requirements", reader)
    source, ids, issued = reqid.prepare(deck)
    names = heading_names(source.read_text(encoding="utf-8"), ids)
    ii = table.column(cols["id"], where)
    bad, pending, seen = [], [], {}
    pages = deck_pages(reader) if reader is not None and cols.get("pages") else None
    for row, line in zip(table.rows, table.lines):
        rid = table.cell(row, ii).strip()
        if not ids.id.fullmatch(rid):
            continue
        at = f"{where}:{line}"
        if rid in seen:
            bad.append(f"{at}: {rid} has a second row (first at line {seen[rid]})")
            continue
        seen[rid] = line
        if rid not in issued:
            bad.append(f"{at}: {rid} is not an issued id")
            continue
        if cols.get("name"):
            name = table.cell(row, table.column(cols["name"], where)).strip()
            if key(name) != key(names.get(rid, "")):
                bad.append(f"{at}: {rid} is named 「{name}」, the digest heads it 「{names.get(rid, '')}」")
        if pages is not None and reader is not None:
            for _, _, first, last in cited_ids(table.cell(row, table.column(cols["pages"], where)), reader):
                for pid in expand(first, last):
                    page = pages.by_id.get(pid)
                    if page is None:
                        if chapter_of(pid, reader) in pages.chapters:
                            bad.append(f"{at}: {rid} cites {pid}, which is not a page of the deck")
                        else:
                            pending.append(pid)
                        continue
                    printed = {n for n, _ in ids.cited(page.text + " " + str(page.head))}
                    if rid not in printed:
                        bad.append(f"{at}: {rid} cites {pid}, which does not print the id")
    if spec.get("complete"):
        for rid in sorted(issued - set(seen)):
            bad.append(f"{where}: {rid} is issued and has no row")
    return len(seen), bad, sorted(set(pending))


def heading_names(text: str, ids: reqid.Ids) -> dict[str, str]:
    """{id: the name its digest heading gives it}."""
    out = {}
    for m in ids.definition.finditer(text):
        end = text.find("\n", m.end())
        rest = text[m.end():end if end >= 0 else len(text)]
        out.setdefault(m.group(1) + m.group(2), re.sub(r"^\s*[·:\-]?\s*", "", rest).strip())
    return out


def check(deck: DeckConfig, reader: DeckReader | None) -> tuple[dict, list[str], list[str]]:
    want = scoring(deck, reader)
    rows = lookup(deck, reader)
    bad = rows_against_scoring(want, rows)
    pending: list[str] = []
    if reader is not None:
        more, pend = pages_against_deck(rows, reader, {w[0] for w in want}, deck.get("evaluation.noneLabel"))
        bad += more
        pending += pend
    n_req, req_bad, req_pending = requirement_rows(deck, reader)
    bad += req_bad
    pending += req_pending
    return {"scoring": len(want), "rows": len(rows), "requirements": n_req}, bad, sorted(set(pending))


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    ap = cli.parser(__doc__.splitlines()[0])
    ap.add_argument("--manuscript-only", action="store_true", help="read no deck: rows only")
    args = ap.parse_args(argv)
    deck = cli.deck_config(args)
    if args.manuscript_only:
        counts, bad, pending = check(deck, None)
    else:
        with cli.open_reader(deck) as reader:
            counts, bad, pending = check(deck, reader)
    print(f"evaluation: {counts['scoring']} scoring entries, {counts['rows']} lookup rows, "
          f"{counts['requirements']} requirement rows, {len(bad)} findings, {len(pending)} pages pending")
    if pending:
        print("  ℹ pending (chapter not typeset yet): " + ", ".join(pending))
    for line in bad:
        print(f"  ✖ {line}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
