#!/usr/bin/env python3
"""Type-size floor: no text in the deck prints below 8pt.

The deck's units are CSS pixels on a 1123x794 A4-landscape page and the builder
writes points as units x 0.75, so 8pt is 10.67 units. Everything a reader reads
sits at or above that floor; the sizes above it carry the hierarchy.

    python3 tools/typefloor.py            # styles, templates and chapters
"""
from __future__ import annotations
import re
import sys
from pathlib import Path

DECK = Path(__file__).resolve().parents[1]
FLOOR = 10.67                      # 8.0pt
SIZE = re.compile(r'fontSize="([0-9.]+)"')
TARGETS = ["styles/*.xml", "templates/*.xml", "chapters/*.xml", "main.sgx", "build.ts"]
# Generated files are read from their generator (build.ts) instead.
GENERATED = {"figures.xml", "screens.xml", "master.xml", "parts.xml"}
# The one exception, and it is not prose: a code value standing as a label —
# a requirement id in a badge or a bar's stub, an evidence number, a frame id.
CODE_LABEL = ("reqbadge", "bar-key", "bar-key-req", "frame-id")


def main() -> int:
    bad: list[tuple[str, int, float, str]] = []
    for pattern in TARGETS:
        for path in sorted(DECK.glob(pattern)):
            if path.name in GENERATED:
                continue
            for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                if any(name in line for name in CODE_LABEL):
                    continue
                for m in SIZE.finditer(line):
                    size = float(m.group(1))
                    if size < FLOOR:
                        bad.append((str(path.relative_to(DECK)), n, size, line.strip()[:80]))
    for rel, n, size, text in bad:
        print(f"  ✖ {rel}:{n} — fontSize {size} = {size * 0.75:.2f}pt (바닥 8pt = {FLOOR} 단위)\n      {text}")
    print(f"글자 크기 바닥 대조: 8pt 미만 {len(bad)}건")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
