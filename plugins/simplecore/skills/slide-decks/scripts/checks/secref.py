#!/usr/bin/env python3
"""A page-id citation must land on the page that carries what it cites.

A page id (`pages.id`, 「Ⅴ-1 03」) counts pages inside a chapter, so every
citation of it moves when a page is inserted, split or reordered. Nothing
reports it, and a reviewer who follows one lands on the wrong page. The
manuscript numbers its own files, and the two agree only until one page merges
two sections or one section spills onto two pages: one deck had 105
citations pointing at the wrong page that way.

Two readings of every citation in the deck's sources (comments set aside,
entities and JSON escapes undone, so a citation inside a card's item list
reads like one in plain text):

- A named citation (「Ⅳ-1 15 외부 장치 요청 처리」) proves itself: the name has
  to share a word with the cited page's title, or half its words with the page.
- Any citation is checked by its anchors: the numbers and requirement ids just
  before it, inside the same string (a quoted argument or JSON cell is the
  boundary; the cell to the left does not prove the cell to the right). At
  least one has to be printed on the cited page. A citation with no anchor is
  not judged, and one before it does not lend it its anchors.

A citation of a chapter that has no typeset page yet is pending, never a
failure: counted as one, it would bury every real mismatch until the chapter
is typeset. Ordinal 00 names the whole chapter and is not checked.

Config (`checks.secref`, optional): `lookback` (46 characters read before a
citation), `tails` (the particles and copulas stripped from an anchor, longest
first), `notAName` (the openings that make the words after a citation a
predicate rather than a name). Requirement ids anchor a citation when
`requirements.id` is declared.

Baseline: `<checks.baselines>/secref.json`, keyed `file<TAB>citation<TAB>anchors`;
a legacy list of keys stays retired, a new entry owes its reason.
"""
from __future__ import annotations

import re
import sys
from html import unescape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.baseline import Baseline, judge  # noqa: E402
from bidkit.config import DeckConfig  # noqa: E402
from bidkit.deckread import COMMENT, DeckReader  # noqa: E402

LOOKBACK = 46
# A particle or copula after a number is not part of the anchor: 「3일이다」 is
# found on the page as 「3일」. Longest first.
TAILS = ["이었다", "이며", "이고", "이다", "으로", "에서", "까지", "부터",
         "다", "로", "은", "는", "이", "가", "을", "를", "의", "에", "과", "와"]
# Words after a citation that make it a predicate, not a name: 「Ⅴ-1 06에 있다」.
NOT_A_NAME = ["있", "제시", "에", "와", "과", "및", "같", "참조", "부적", "따", "이후", "의"]
# Only numbers and requirement ids anchor a citation: a prose word is on every
# page, and a number is what sends a reader astray when the citation drifts.
NUMBER = r"\d[\d,.]*\s*(?:만|억)?\s*[가-힣%]{0,3}"
WORDS = re.compile(r"[가-힣A-Za-z]{2,}")


class Rules:
    def __init__(self, deck: DeckConfig, reader: DeckReader):
        cfg = deck.section("checks.secref")
        self.lookback = int(cfg.get("lookback", LOOKBACK))
        self.tails = sorted(cfg.get("tails", TAILS), key=len, reverse=True)
        self.not_a_name = tuple(cfg.get("notAName", NOT_A_NAME))
        ref = reader.pages_config.id_pattern()
        self.ref = re.compile(ref)
        self.named = re.compile(ref + r"[ (](?P<name>[가-힣A-Za-z][^,|)\]<\"·]{2,26})")
        spec = deck.get("requirements.id")
        ids = (f"(?:{spec['prefix']})\\d{{{int(spec['digits'])}}}|"
               if isinstance(spec, dict) and "prefix" in spec and "digits" in spec else "")
        self.token = re.compile(ids + NUMBER)

    def anchors(self, text: str) -> list[str]:
        out = []
        for raw in self.token.findall(text):
            t = raw.strip()
            for tail in self.tails:
                if len(t) > len(tail) + 1 and t.endswith(tail):
                    t = t[:-len(tail)]
                    break
            if len(t) >= 2:
                out.append(t)
        return out


def citing_sources(reader: DeckReader):
    """(file, printed source) for every deck file, with comments, entities and JSON escapes undone."""
    for name, raw in reader.files():
        yield name, unescape(COMMENT.sub(" ", raw)).replace('\\"', '"')


def chapters(reader: DeckReader) -> dict[str, list]:
    """`part-chapter` -> [Page] in printed order."""
    out: dict[str, list] = {}
    for p in reader.body_pages():
        out.setdefault(p.chapter_key, []).append(p)
    return out


def named_refs(reader: DeckReader, rules: Rules, order: dict) -> list[tuple[str, str, str, str]]:
    """[(file, citation, name, the page's title or why)] for names the cited page does not carry."""
    title_arg = reader.pages_config.head.get("title", "title")
    bad = []
    for name, text in citing_sources(reader):
        for m in rules.named.finditer(text):
            label = m.group("name").strip()
            if label.startswith(rules.not_a_name):
                continue
            key, n = f"{m.group('part')}-{m.group('chapter')}", int(m.group("ordinal"))
            pages = order.get(key, [])
            if not pages:
                continue              # the chapter is not typeset yet; main counts it as pending
            cited = m.group(0)[:m.start("name") - m.start()].strip()
            if not 0 < n <= len(pages):
                bad.append((name, cited, label, "no such page"))
                continue
            page = pages[n - 1]
            title = str(page.head.get(title_arg, ""))
            words = set(WORDS.findall(label))
            if words & set(WORDS.findall(title)):
                continue
            if words and len(words & set(WORDS.findall(page.text))) * 2 >= len(words):
                continue
            bad.append((name, cited, label, f"the page is 「{title}」"))
    return bad


def anchored_refs(reader: DeckReader, rules: Rules, order: dict) -> tuple[list, dict]:
    """([(file, citation, why, anchors)], {chapter: {files}} pending)."""
    bad, pending = [], {}
    for name, text in citing_sources(reader):
        for m in rules.ref.finditer(text):
            key, n = f"{m.group('part')}-{m.group('chapter')}", int(m.group("ordinal"))
            if n == 0:
                continue              # 00 names the whole chapter
            pages = order.get(key, [])
            if not pages:
                pending.setdefault(key, set()).add(name)
                continue
            if not 0 < n <= len(pages):
                bad.append((name, m.group(0), "no such page", ""))
                continue
            page = pages[n - 1]
            window = text[max(0, m.start() - rules.lookback):m.start()]
            prev = list(rules.ref.finditer(window))
            if prev:
                window = window[prev[-1].end():]      # never inherit the previous citation's anchors
            # The anchors are read inside the string that holds the citation: a
            # quote bounds an argument and a JSON cell. Without one, the window's
            # head may sit inside a tag, so everything before the first tag goes.
            cut = window.rfind('"')
            window = window[cut + 1:] if cut >= 0 else re.sub(r"^[^<]*", " ", window)
            keys = rules.anchors(re.sub(r"<[^>]+>", " ", window))
            # A folio of the cited chapter printed beside the id (a lookup table's
            # 「14~17(Ⅲ-1 01~04)」) is the citation's own page number, not an anchor;
            # the contents check proves those numbers. One of them must be the cited
            # page's own folio, or the id and the number have drifted apart.
            folios = {str(p.folio) for p in pages if p.folio}
            beside = [k for k in keys if k in folios]
            keys = [k for k in keys if k not in folios]
            if beside and page.folio and str(page.folio) not in beside:
                bad.append((name, m.group(0), f"printed beside folio {beside[0]}, the page is {page.folio}",
                            " · ".join(beside)))
                continue
            if not keys:
                continue              # nothing identifies what is cited
            if not any(k in page.text for k in keys):
                where = f"page {page.folio}" if page.folio else page.label
                bad.append((name, m.group(0), f"not on {where}", " · ".join(keys[-3:])))
    return bad, pending


def key(item: tuple) -> str:
    return f"{item[0]}\t{item[1]}\t{item[3]}"


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0], bless=True).parse_args(argv)
    deck = cli.deck_config(args)
    baseline = Baseline.for_check(deck, "secref")
    with cli.open_reader(deck) as reader:
        rules = Rules(deck, reader)
        order = chapters(reader)
        named = named_refs(reader, rules, order)
        bad, pending = anchored_refs(reader, rules, order)
    if args.bless:
        return cli.report_bless(baseline, {key(b): None for b in bad}, "citations whose anchors cannot judge them")
    live, owed = judge(baseline, bad, key)
    print(f"secref: {len(named)} named citations whose page carries another name, {len(live)} citations "
          f"whose anchors are not on the cited page, {len(owed)} retired without a reason "
          f"({len(baseline.entries)} baseline entries)")
    for name, ref, label, why in named:
        print(f"  ✖ {name} 「{ref} {label}」: {why}")
    if pending:
        print("  ℹ pending, the cited chapter has no typeset page: "
              + ", ".join(f"{k} ({len(v)} files)" for k, v in sorted(pending.items())))
    for name, ref, why, keys in live:
        print(f"  ✖ {name} 「{ref}」: {why}" + (f" (anchors: {keys})" if keys else ""))
    for name, ref, _, keys in owed:
        print(f"  ✖ {name} 「{ref}」: retired with a blank reason; write why ({keys})")
    return 1 if named or live or owed else 0


if __name__ == "__main__":
    sys.exit(main())
