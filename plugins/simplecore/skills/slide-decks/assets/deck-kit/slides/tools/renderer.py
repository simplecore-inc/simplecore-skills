#!/usr/bin/env python3
"""The renderer that draws the previews is the one the project declares.

The builder is pinned in `package.json`; the CLI that turns the built deck into
the PNGs was not pinned anywhere. It sat three minor versions behind for months
— and every preview, the deliverable PDF stitched from those previews, and every
check that measures an image ran through it. A marker offset was tuned against
it and was wrong the moment anyone rendered on the current one.

So the version is declared beside the deck (`renderer.minVersion` in
`.claude/slide-decks.json`) and read here, before a render and after one.

    python3 tools/deck/renderer.py

Exit code 1 when the CLI is missing or older than the deck declares.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import catalog  # noqa: E402

ROOT, DECK = catalog.ROOT, catalog.DECK
CONFIG = ROOT / ".claude" / "slide-decks.json"


def declaration() -> tuple[str, str]:
    raw = re.sub(r"^\s*//.*$", "", CONFIG.read_text(encoding="utf-8"), flags=re.M)
    for name, deck in json.loads(raw).get("decks", {}).items():
        if (ROOT / deck["dir"]).resolve() == DECK:
            spec = deck.get("renderer")
            if not spec:
                raise SystemExit(
                    f"slide-decks.json: 덱 {name} 에 `renderer` 가 선언되지 않았다 — "
                    f"미리보기를 그리는 도구의 버전을 적지 않으면 어느 판으로 그렸는지 알 수 없다")
            return spec["command"], spec["minVersion"]
    raise SystemExit(f"slide-decks.json 의 decks 에 {DECK} 를 dir 로 갖는 덱이 없다")


def parts(version: str) -> tuple[int, ...]:
    return tuple(int(n) for n in re.findall(r"\d+", version)[:3])


def main() -> int:
    command, wanted = declaration()
    cli = os.environ.get("SLIDEGLANCE_CLI", command)
    try:
        out = subprocess.run([cli, "--version"], capture_output=True, text=True, timeout=30)
    except (OSError, subprocess.SubprocessError) as err:
        print(f"✖ {cli} 를 실행하지 못했다 — {err}")
        print(f"  SlideGlance 저장소에서 `cargo install --path crates/slideglance --force` 로 "
              f"{wanted} 이상을 설치하거나 SLIDEGLANCE_CLI 로 경로를 지정한다.")
        return 1
    found = (out.stdout + out.stderr).strip()
    m = re.search(r"(\d+\.\d+\.\d+)", found)
    if not m:
        print(f"✖ {cli} 가 버전을 알려 주지 않는다 — 「{found[:60]}」")
        return 1
    if parts(m.group(1)) < parts(wanted):
        print(f"✖ 미리보기 도구가 {m.group(1)} 인데 이 덱은 {wanted} 이상을 쓴다")
        print(f"  낡은 판으로 그린 그림은 조판을 재는 모든 검사와 인도할 PDF를 함께 어긋나게 한다.")
        print(f"  `cargo install --path crates/slideglance --force` 로 올린다.")
        return 1
    print(f"미리보기 도구: {cli.split('/')[-1]} {m.group(1)} (선언 {wanted} 이상)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
