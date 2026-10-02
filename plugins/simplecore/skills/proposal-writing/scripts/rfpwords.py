#!/usr/bin/env python3
"""Words a requirement names that the proposal never writes.

An evaluator reads the requirement, then looks for its own words on the page.
A requirement answered in different words reads as unanswered, so the nouns a
requirement's detail names are looked for across the whole manuscript, and with
`--against-deck` across the deck's printed sources: a word answered only in the
manuscript never reaches the page the evaluator is scoring.

Every requirement's detail is tokenised, inflected forms and ordinary words
are dropped, and what remains is looked for with spacing removed on both sides
(「연계방안」 and 「연계 방안」 are one word). A compound noun often ends in a
syllable that is also a particle (응답속「도」, 평가결「과」), so a token is
peeled one syllable at a time and a hit on any step counts as written.

A word the proposal writes another way on purpose is retired in the baseline
with the reason (`rfpwords.json`, or `rfpwords-deck.json` with `--against-deck`),
keyed 「<id>\\t<word>」.

Config:

    "requirements": { "source": ..., "id": {...},                      // as reqid reads them
                      "quote": { "open": "<!--\\s*l10n:quote.*?-->",   // optional: the verbatim clause
                                 "close": "<!--\\s*l10n:/quote\\s*-->" },
                      "detailStop": "\\*\\*산출물\\*\\*" },               // optional: where the detail ends
    "checks": { "rfpwords": { "stop": [...], "minLen": 3 } }            // optional: more ordinary words

    rfpwords.py [ID ...] [--against-deck] [--bless]
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
import reqid  # noqa: E402
from bidkit import cli  # noqa: E402
from bidkit.baseline import LIVE, UNREASONED, Baseline  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader, printed_source  # noqa: E402
from bidkit.manuscript import Manuscript  # noqa: E402

MIN_LEN = 3

# Korean inflection. A tender writes in the legal register, so most of its
# tokens are one verb in many inflections; only the nouns it names are words a
# reader looks for on the page, so a token carrying a verbal ending is dropped.
VERBAL = re.compile(
    r"(하여야|되어야|하여야함|있어야함|하여야한다|되어야한다"
    r"|하여|되어|하는|되는|하고|되고|한다|된다|하며|되며|해야|해서|하지|되지"
    r"|하기|되기|하도록|되도록|하면|되면|했다|됐다|하거나|되거나|이며|이고|이다"
    r"|시켜야|시켜|시키는|받아야|받는|받은|받|같은|많은|없는|있는|아닌|따른|따라"
    r"|아야|어야|여야|워야|져야|려야|켜야|와야|봐야|아질|어질|여질|도록"
    r"|여줌|어줌|아줌|줌"
    r"|고자|하게|되게|롭게|없게|하려|다고|라고|없이|없는|없다|추어|려울|러울"
    r"|적인|적으로|로운|스러운"
    r"|히"
    r"|한|할|된|될|함|됨|음|임|됨\.)$")
# Only the particles that cannot be the last syllable of a compound noun.
PARTICLE = re.compile(
    r"(으로써|로써|로서|에서|에게|으로|부터|까지"
    r"|을|를|은|는|의|와|과|이|가|도|만|로|에|들|엔|뿐)$")
STEMMY = re.compile(r"(하여서|되어서|토록|으므로|이므로|기로)")

# Words of the tender genre that every requirement uses and no page needs to repeat.
STOP = {
    "세부내용", "산출물", "응락수준", "요구사항", "제안요청서", "시스템", "경우",
    "다음", "이상", "이하", "대하여", "위하여", "통하여", "함께", "모든", "각각",
    "개발방법론", "소스코드", "설계서", "아키텍처", "일체", "정의", "방안", "기능",
    "내용", "제공", "관리", "적용", "수행", "구성", "확인", "제출", "사용", "포함",
    "제시", "구축", "반영", "지원", "고려", "준수", "가능", "필요", "대상", "결과",
    "부득이", "최소한", "대부분", "지속적", "정기적", "주기적", "효율적", "안정적",
    "종합적", "구조적", "상세", "세부", "관련", "해당", "이후", "이전", "동일",
    "반드시", "새로운", "가급적", "다양", "적절", "구체적", "체계적", "우선",
}


def past(word: str) -> bool:
    """True when a syllable closes on ㅆ, the past-tense mark no noun carries."""
    return any(0xAC00 <= ord(c) <= 0xD7A3 and (ord(c) - 0xAC00) % 28 == 20 for c in word)


def forms(word: str, min_len: int = MIN_LEN) -> list[str]:
    """Every spelling worth looking for, or [] when the token is a verb or a fragment."""
    if not re.fullmatch(r"[가-힣]+", word):
        return [word]
    if STEMMY.search(word) or past(word) or VERBAL.search(word):
        return []
    out, stem = [word], word
    while True:
        shorter = PARTICLE.sub("", stem)
        if shorter == stem:
            break
        stem = shorter
        if VERBAL.search(stem):
            return []
        out.append(stem)
    if len(stem) < min_len or stem.endswith(("하", "되", "시키")):
        return []
    return out


def terms(text: str, stop: set[str], min_len: int = MIN_LEN) -> set[tuple[str, tuple[str, ...]]]:
    """(name, spellings) for every noun one requirement's detail names."""
    text = re.sub(r"[「」()·,/]", " ", text)
    out = set()
    for w in re.findall(r"[가-힣]{%d,}|[A-Za-z][A-Za-z0-9./-]{2,}" % min_len, text):
        spellings = forms(w, min_len)
        if spellings and spellings[-1] not in stop:
            out.add((spellings[-1], tuple(spellings)))
    return out


def details(deck: DeckConfig) -> list[tuple[str, str]]:
    """(id, detail text) for every requirement the digest issues, in digest order."""
    source, ids, _ = reqid.prepare(deck)
    text = source.read_text(encoding="utf-8")
    quote = deck.section("requirements.quote")
    if quote and not (quote.get("open") and quote.get("close")):
        raise ConfigError(f"deck `{deck.name}` `requirements.quote` must name `open` and `close`")
    stop = deck.get("requirements.detailStop")
    heads = list(ids.definition.finditer(text))
    out, seen = [], set()
    for i, m in enumerate(heads):
        rid = m.group(1) + m.group(2)
        end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
        body = text[m.end():end]
        nxt = re.search(r"^#{1,4} ", body, flags=re.M)
        if nxt:
            body = body[:nxt.start()]
        if quote:
            q = re.search(rf"{quote['open']}(.*?){quote['close']}", body, flags=re.S)
            body = q.group(1) if q else body
        if stop:
            body = re.split(stop, body, maxsplit=1)[0]
        if rid not in seen:
            seen.add(rid)
            out.append((rid, body))
    return out


def corpus(deck: DeckConfig, reader: DeckReader | None) -> tuple[str, int]:
    """(the text searched, spacing removed; files read)."""
    if reader is not None:
        texts = [printed_source(raw) for _, raw in reader.files()]
    else:
        ms = Manuscript.for_deck(deck)
        texts = [p.read_text(encoding="utf-8") for p in ms.files()]
    return re.sub(r"\s+", "", " ".join(texts)), len(texts)


def missing(deck: DeckConfig, hay: str, only: list[str]) -> dict[str, list[str]]:
    cfg = deck.section("checks.rfpwords")
    stop = STOP | set(cfg.get("stop", []))
    min_len = int(cfg.get("minLen", MIN_LEN))
    out = {}
    for rid, detail in details(deck):
        if only and rid not in only:
            continue
        miss = sorted(name for name, spellings in terms(detail, stop, min_len)
                      if not any(s in hay for s in spellings))
        if miss:
            out[rid] = miss
    return out


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    ap = cli.parser(__doc__.splitlines()[0], bless=True)
    ap.add_argument("ids", nargs="*", help="only these requirement ids")
    ap.add_argument("--against-deck", action="store_true",
                    help="look for the words in the deck's sources instead of the manuscript")
    args = ap.parse_args(argv)
    deck = cli.deck_config(args)
    name = "rfpwords-deck" if args.against_deck else "rfpwords"
    baseline = Baseline.for_check(deck, name)
    if args.against_deck:
        with cli.open_reader(deck, with_vocabulary=False) as reader:
            hay, files = corpus(deck, reader)
    else:
        hay, files = corpus(deck, None)
    found = missing(deck, hay, args.ids)
    keys = {f"{rid}\t{w}": None for rid, ws in found.items() for w in ws}
    if args.bless:
        return cli.report_bless(baseline, keys, "words")
    live: dict[str, list[str]] = {}
    owed = []
    for key in keys:
        v = baseline.verdict(key)
        rid, word = key.split("\t", 1)
        if v == LIVE:
            live.setdefault(rid, []).append(word)
        elif v == UNREASONED:
            owed.append(key)
    where = "the deck" if args.against_deck else "the manuscript"
    print(f"rfpwords: {len(details(deck))} requirements, {files} files of {where}, "
          f"{sum(len(w) for w in live.values())} words it never writes, "
          f"{len(keys) - sum(len(w) for w in live.values()) - len(owed)} judged in the baseline, "
          f"{len(owed)} owe a reason")
    for rid, ws in live.items():
        print(f"  ✖ {rid}: {' · '.join(ws)}")
    for key in owed:
        print(f"  ✖ retired without a reason: {key.replace(chr(9), ' | ')}")
    return 1 if live or owed else 0


if __name__ == "__main__":
    sys.exit(main())
