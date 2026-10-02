#!/usr/bin/env python3
"""A page must not say the same thing twice.

The running head's explanation, a figure's caption and the prose around them
are written at different times, so the same claim lands in all three and the
reader meets it three times on one page. Two blocks are held to overlap when
most of the content words of the shorter one appear in the longer.

Read per printed page that carries the running head: its explanation
(`pages.head.sub`), every figure caption (vocabulary `slots.caption`) and every
prose block (`slots.prose`). With `cards`, every other sentence slot
(vocabulary `sentences`) is read too: a card that splits its claim over two
rows says what a paragraph says, so a paragraph restated as a card hides
there. Two strings drawn by one component are never compared: a card whose
tail line restates its own body is the component's shape, not a repetition.

Config (`checks.echo`, optional): `threshold` (0.62), `minWords` (5),
`minChars` per kind (`sub` 20, `caption` 12, `prose` 20, `card` 30),
`stopWords` (the verbs and connectives every sentence carries), `cards`
(false), `captionPrefix` (a regex removed from the start of a caption, for a
deck whose caption argument carries its own number; none by default),
`exemptSub` (master prefixes whose explanation summarises the frame below it
by design, such as an annex capture page; none by default).

Baseline: `<checks.baselines>/echo.json`, keyed
`page<TAB>kind<TAB>kind<TAB>first 24 characters`, measured by the overlap, so
a rewrite that makes the repetition worse fires again. A bare overlap is a
legacy entry and stays retired while unchanged; `{"ratio", "why"}` is read as
the measure and the reason.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.baseline import Baseline, Entry, judge  # noqa: E402
from bidkit.config import DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader, Page  # noqa: E402
from bidkit.vocab import read_slots  # noqa: E402

THRESHOLD = 0.62
MIN_WORDS = 5
MIN_CHARS = {"sub": 20, "caption": 12, "prose": 20, "card": 30}
WORD = re.compile(r"[가-힣]{2,}")
# The 하다/되다 forms and the connectives sit in every sentence and inflate the overlap.
STOP_WORDS = ["한다", "된다", "있다", "없다", "하는", "되는", "이다", "위해", "따라", "그리고",
              "또는", "때문", "대해", "통해", "경우", "지점", "구간", "기준", "사항", "관련"]


class Settings:
    def __init__(self, deck: DeckConfig):
        cfg = deck.section("checks.echo")
        self.threshold = float(cfg.get("threshold", THRESHOLD))
        self.min_words = int(cfg.get("minWords", MIN_WORDS))
        self.min_chars = {**MIN_CHARS, **cfg.get("minChars", {})}
        self.stop = set(cfg.get("stopWords", STOP_WORDS))
        prefix = cfg.get("captionPrefix")
        self.caption_prefix = re.compile(prefix) if prefix else None
        self.exempt_sub = tuple(cfg.get("exemptSub", []))
        self.cards = bool(cfg.get("cards", False))


def words(text: str, stop: set) -> set:
    return {w for w in WORD.findall(text) if w not in stop}


def blocks(page: Page, reader: DeckReader, s: Settings) -> list[tuple[str, str, str]]:
    """(kind, text, group) for one slide; `group` names the component that drew it."""
    vocab = reader.vocab
    out = []
    sub_arg = reader.pages_config.head.get("sub")
    sub = str(page.head.get(sub_arg, "")) if sub_arg else ""
    if len(sub) >= s.min_chars["sub"] and not (s.exempt_sub and page.master.startswith(s.exempt_sub)):
        out.append(("sub", sub, "head"))
    sentences = ((vocab.data.get("sentences") if vocab else None) or {}) if s.cards else {}
    for use in page.uses:
        taken = set()
        for cls, kind in (("caption", "caption"), ("prose", "prose")):
            for slot, value in vocab.values(cls, use.tag, use.attrs) if vocab else ():
                taken.add(slot)
                if kind == "caption" and s.caption_prefix:
                    value = s.caption_prefix.sub("", value, count=1)
                if len(value) >= s.min_chars[kind]:
                    out.append((kind, value, use.key))
        for slot, value in read_slots(sentences.get(use.tag, []), use.attrs):
            if slot not in taken and len(value) >= s.min_chars["card"]:
                out.append(("card", value, use.key))
    return out


def find(reader: DeckReader, deck: DeckConfig) -> list[tuple[str, str, str, float, str, str]]:
    """[(page, kind a, kind b, overlap, text a, text b)] for every pair at or over the threshold."""
    s = Settings(deck)
    found = []
    for page in reader.slides():
        if not page.head:
            continue            # a cover, a divider or the contents: no page of the body's form
        items = [(k, t, words(t, s.stop), g) for k, t, g in blocks(page, reader, s)]
        for i, (ka, ta, wa, ga) in enumerate(items):
            for kb, tb, wb, gb in items[i + 1:]:
                if ga == gb:
                    continue
                small, big = (wa, wb) if len(wa) <= len(wb) else (wb, wa)
                if len(small) < s.min_words:
                    continue
                ratio = len(small & big) / len(small)
                if ratio >= s.threshold:
                    found.append((page.label, ka, kb, round(ratio, 2), ta, tb))
    return found


def key(item: tuple) -> str:
    page, ka, kb, _, ta, _ = item
    return f"{page}\t{ka}\t{kb}\t{ta[:24]}"


def migrate(raw_key: str, raw: Any) -> tuple[str, Entry] | None:
    """The `{"ratio": r, "why": reason}` form: the ratio is the measure, `why` the reason."""
    if not (isinstance(raw, dict) and ("ratio" in raw or "why" in raw)):
        return None
    reason = str(raw.get("why") or "")
    return raw_key, Entry(reason, raw["ratio"]) if "ratio" in raw else Entry(reason)


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0], bless=True).parse_args(argv)
    deck = cli.deck_config(args)
    baseline = Baseline.for_check(deck, "echo", migrate)
    with cli.open_reader(deck) as reader:
        found = find(reader, deck)
    if args.bless:
        return cli.report_bless(baseline, {key(f): f[3] for f in found}, "overlapping pairs")
    live, owed = judge(baseline, found, key, lambda f: f[3])
    print(f"echo: {len(live)} overlapping pairs on one page, {len(owed)} retired without a reason "
          f"({len(baseline.entries)} baseline entries)")
    for page, ka, kb, ratio, ta, tb in live:
        print(f"  ✖ {page}: {ka} and {kb} overlap {ratio:.0%}")
        print(f"      {ka} {ta[:74]}")
        print(f"      {kb} {tb[:74]}")
    for page, ka, kb, _, ta, _ in owed:
        print(f"  ✖ {page}: {ka} and {kb} retired with a blank reason; write why ({ta[:40]})")
    return 1 if live or owed else 0


if __name__ == "__main__":
    sys.exit(main())
