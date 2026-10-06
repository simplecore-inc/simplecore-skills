#!/usr/bin/env python3
"""Speaker notes are written the way the speaker reads them aloud.

A script is heard, and a voice or a reader takes the written form literally: 「11대」 is read
십일 대 where the speaker says 열한 대, and 「Apache Ignite 3」 comes out letter by letter or not at
all. So a counter read with a native Korean numeral is written in words (「열한 대」, 「여섯 명」,
「네 시간」), a counter read with a Sino-Korean numeral keeps its digits (「10만 건」, 「15개월 차」,
「3초」, the ratio 「1 대 3」), and every English term is written in Hangul as it is pronounced
(「아파치 이그나이트 쓰리」, 「아이엠디지」). This check lists, per slide, every digit joined to a
native-numeral counter and every Latin letter left in a note.

Reads the notes from the deck's server (`sg://deck/content?format=json`).

Config (`checks.notespeech`, optional): `counters` (the native-numeral counters, default
대 · 명 · 번 · 시간 · 가지 · 곳 · 벌 · 군데 · 차례 · 줄 · 칸 · 개 · 살 · 마리 · 척), `latin` (true).

    notespeech.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.config import DeckConfig  # noqa: E402

COUNTERS = ["대", "명", "번", "시간", "가지", "곳", "벌", "군데", "차례", "줄", "칸", "개", "살", "마리", "척"]
LATIN = re.compile(r"[A-Za-z][A-Za-z0-9.\-/ ]*[A-Za-z0-9]|[A-Za-z]")


def native_pattern(counters: list[str]) -> re.Pattern:
    """A digit run joined to a native-numeral counter. 대 counts only when it is joined to the
    digit and no number follows (「1 대 3」 is a ratio, read 일 대 삼); 개 never takes 개월."""
    rest = "|".join(re.escape(c) if c != "개" else "개(?!월)" for c in counters if c != "대")
    machine = r"대(?!\s?\d)|" if "대" in counters else ""
    return re.compile(rf"(?<![\d.,])\d{{1,3}}(?:,\d{{3}})*(?:{machine}\s?(?:{rest}))")


def findings(note: str, native: re.Pattern, latin: bool = True) -> list[str]:
    out = [m.group(0) for m in native.finditer(note)]
    if latin:
        out += [m.group(0) for m in LATIN.finditer(note)]
    return out


def notes_of(content: list) -> dict[int, str]:
    """{slide: notes} from `sg://deck/content?format=json`."""
    def walk(node, acc):
        if isinstance(node, dict):
            if node.get("role") == "notes":
                acc.append(node.get("text", ""))
                return
            for v in node.values():
                walk(v, acc)
        elif isinstance(node, list):
            for v in node:
                walk(v, acc)
    out = {}
    for item in content:
        acc: list[str] = []
        walk(item.get("blocks", []), acc)
        out[item["slide"]] = " ".join(acc)
    return out


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0]).parse_args(argv)
    deck = cli.deck_config(args)
    cfg = deck.section("checks.notespeech")
    native = native_pattern(list(cfg.get("counters", COUNTERS)))
    latin = bool(cfg.get("latin", True))
    with cli.open_reader(deck, with_vocabulary=False) as reader:
        content = json.loads(reader.session.read("sg://deck/content?format=json"))
    found = [(n, f) for n, note in sorted(notes_of(content).items()) for f in findings(note, native, latin)]
    print(f"notespeech: {len(found)} phrases a voice would misread in the speaker notes")
    for n, phrase in found:
        print(f"  ✖ slide {n}: 「{phrase}」")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
