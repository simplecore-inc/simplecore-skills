"""Markdown tables and the section of a document that holds one.

A check that reads a table a person keeps (a lookup table, a scoring table, a
list of shared facts) names its columns by header, never by position: a column
inserted for a reader's convenience must not move what the check compares.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from .config import ConfigError

_RULE = re.compile(r"^\s*:?-{3,}:?\s*$")


def section(md: str, heading: str | None, where: str = "") -> str:
    """The text under `heading` up to the next heading of the same or a higher level.

    `heading` is the whole heading line as written (「## 인쇄 원고」); None
    returns the document. A heading the document does not carry is an error:
    a table that cannot be found is not an empty table.
    """
    if not heading:
        return md
    head = heading.strip()
    level = len(head) - len(head.lstrip("#"))
    m = re.search(rf"^{re.escape(head)}\s*$", md, flags=re.M)
    if not m:
        raise ConfigError(f"{where or 'the document'} has no heading 「{head}」")
    rest = md[m.end():]
    if level:
        stop = re.search(rf"^#{{1,{level}}} (?!#)", rest, flags=re.M)
        if stop:
            rest = rest[:stop.start()]
    return rest


def split_row(line: str) -> list[str] | None:
    """The cells of one table line, or None when the line is not a table row."""
    t = line.strip()
    if not t.startswith("|"):
        return None
    t = t[1:]
    if t.endswith("|"):
        t = t[:-1]
    # A pipe escaped as `\|` stays inside its cell.
    cells = re.split(r"(?<!\\)\|", t)
    return [c.strip().replace("\\|", "|") for c in cells]


@dataclass
class Table:
    header: list[str]
    rows: list[list[str]] = field(default_factory=list)
    lines: list[int] = field(default_factory=list)     # 1-based line of each row in the text

    def column(self, name: str, where: str = "") -> int:
        if name not in self.header:
            raise ConfigError(f"{where or 'the table'} has no column 「{name}」; its header is "
                              + " | ".join(self.header))
        return self.header.index(name)

    def cell(self, row: list[str], index: int) -> str:
        return row[index] if 0 <= index < len(row) else ""


def tables(text: str) -> list[Table]:
    """Every table in `text`, header row first, the rule row dropped."""
    out: list[Table] = []
    current: Table | None = None
    expect_rule = False
    for n, line in enumerate(text.splitlines(), 1):
        cells = split_row(line)
        if cells is None:
            current, expect_rule = None, False
            continue
        if current is None:
            current = Table(cells)
            expect_rule = True
            continue
        if expect_rule:
            expect_rule = False
            if all(_RULE.match(c) for c in cells if c) and any(cells):
                out.append(current)
                continue
            current = None              # a pipe line without a rule row is not a table
            continue
        current.rows.append(cells)
        current.lines.append(n)
    return out


def find(text: str, columns: list[str], where: str = "") -> Table:
    """The first table whose header carries every one of `columns`."""
    for t in tables(text):
        if all(c in t.header for c in columns):
            return t
    raise ConfigError(f"{where or 'the document'} holds no table with the columns "
                      + ", ".join(f"「{c}」" for c in columns))


def filled_down(table: Table, index: int) -> list[str]:
    """A column whose blank cells repeat the value above them (a merged group cell)."""
    out, last = [], ""
    for row in table.rows:
        value = table.cell(row, index)
        if value:
            last = value
        out.append(last)
    return out
