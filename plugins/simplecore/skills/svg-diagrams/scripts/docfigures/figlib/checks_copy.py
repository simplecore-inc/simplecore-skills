"""Checks on what a figure says: dash glosses, icon names, label form, the
document register, and section numbers."""
import re

from figlib.svgread import _attr, _read, texts

def dash_legend_errors(svgs, cfg):
    """(file, pattern, meaning, gloss, why) where a drawn dash is glossed in the
    figure's own words alone.

    Four gaps mean four things, and a reader holding the four cannot match a
    gloss like 「점선 칸: 월 통계와 따로 저장」 to one of them. A gloss names the
    declared meaning first and adds the figure's own case in parentheses.
    Only clauses that act as a gloss are read - one that names the dash word or
    opens on a declared meaning - so a sentence elsewhere that happens to hold
    the word does not stand in for the gloss. A meaning inside the parentheses
    alone still leaves the reader unable to tell which of the four it is.

    By default (`dashGloss: "several"`) only a figure that draws two or more
    declared meanings needs the gloss: a lone dash cannot be mistaken for
    another one in the same drawing, and the document's key names it.
    `dashGloss: "every"` asks it of every dashed figure.
    """
    dashes = cfg.dashes
    word = cfg.get("dashWord")
    if not dashes or not word or not any(w for _p, w in dashes.values()):
        return None
    meaning_of = {p: w for p, w in dashes.values() if w}
    all_words = [w for ws in meaning_of.values() for w in ws]
    least = 1 if cfg.dash_gloss == "every" else 2
    out = []
    for svg in svgs:
        raw = _read(svg)
        drawn = [p for p in sorted(set(re.findall(r'stroke-dasharray="([^"]+)"', raw)))
                 if p in meaning_of]
        if len(drawn) < least:
            continue
        clauses = [c.strip() for _a, t in texts(svg) for c in t.split("·")]
        notes = [c for c in clauses if word in c or any(c.startswith(w) for w in all_words)]
        for pat in drawn:
            words = meaning_of[pat]
            if any(w in c.split("(")[0] for c in notes for w in words):
                continue
            inverted = any(w in c for c in notes for w in words)
            out.append((svg.name, pat, words[0], notes[0] if notes else "",
                        "the meaning sits only inside parentheses" if inverted
                        else "no gloss names the meaning"))
    return out


# ── vocabularies ───────────────────────────────────────────────────────────
def icon_literals(cfg):
    """(file, line, name, key) where a module writes a Lucide name directly.

    One meaning, one icon holds only while the name is written in one place;
    a call site names the `icons` key.
    """
    icons = cfg.get("icons")
    if not icons:
        return None
    out = []
    for f in cfg.source_files():
        for i, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            for m in re.finditer(r'\bicon\s*=\s*"([a-z0-9-]+)"|\.icon\(\s*"([a-z0-9-]+)"', line):
                nm = m.group(1) or m.group(2)
                key = next((k for k, v in icons.items() if v == nm), None)
                out.append((f.name, i, nm, key))
    return out


# A label is a noun phrase. Korean declaratives close on 「-다」, the polite
# 「-요」 or 「-습니다」 / 「-합니다」; 「-요」 is narrowed to the syllables that
# precede it in a 해요체 ending, so 「불필요」 · 「개요」 · 「주요」 pass. A
# trailing parenthetical or full stop is ignored, so 「확정한다(13절)」 is
# still a sentence.
#   caught: 「값을 확인한다」 · 「보존한다.」 · 「제출합니다」 · 「저장하세요」 · 「확정한다(13절)」
#   passed: 「사업소별 설치 호스트 불필요」 · 「수집 개요」 · 「주요 연혁」 · 「제출」
PROSE_ENDINGS = re.compile(r"(?:[가-힣]다|[세해네지죠어아여에예]요)$")


TRAILING = re.compile(r"(\([^()]*\)|[.\s])+$")


def predicate_labels(svgs, cfg):
    """(file, text) for labels that close on a predicate."""
    spec = cfg.get("labelForm", {})
    if spec is False:
        return None
    allow = set((spec or {}).get("allow", ()))
    out = []
    for svg in svgs:
        for _a, text in texts(svg):
            if not text:
                continue
            for clause in (c.strip() for c in re.split(r"(?<=\.)\s+", text)):
                if not clause or clause in allow:
                    continue
                if PROSE_ENDINGS.search(TRAILING.sub("", clause)):
                    out.append((svg.name, text))
                    break
    return out


# A figure prints 개조식 noun phrases. A relative clause, a particle, or a
# connective ending reads as a working note pasted into the document; the fix
# is the noun form (「착수 첫 주에 확보하는 기준선」 -> 「착수 첫 주 기준선 확보」).
#   caught: 「보드로 앞당기는 설계 확정」 · 「원인과 수정 버전을 결함 기록에」
#   passed: 「요청 시작에서 완료까지」 · 「사업 조건과 제안 방향」 · 「위젯 대시보드」
REGISTER_RULES = [
    # 「또는」 is a conjunction, 「관할 · 역할 · 분할」 nouns ending in 할, 「오른」 a direction
    ("relative clause or topic particle", re.compile(
        r"[가-힣](?:(?<!또)는|(?<![좁넓밝])은|된|될|(?<![관역분])할|(?<!어두)운|(?<!오)른) [가-힣「]")),
    ("object or dative particle", re.compile(r"[가-힣](?:을|를|에게) [가-힣「]")),
    ("locative 「에」", re.compile(r"[가-힣]에 [가-힣「]")),
    # 경로 · 도로 · 통로 · 진로 · 회로 · 선로 are nouns, not the particle
    ("adverbial 「로」", re.compile(r"[가-힣](?:으로|(?<![경도통진회선으])로) [가-힣「]")),
    ("connective ending or 「뒤」", re.compile(
        r"[가-힣](?:하고|되고|이고|하며|되며|해서|하면|되면|이면|이라|하되|(?<!이)해도|않고) [가-힣]"
        r"|[가-힣] 뒤(?: |$)")),
]


def register_errors(svgs, cfg):
    """(file, rule, text) for labels outside the document register.

    `register.words` is the project's pattern of working words its authors
    use among themselves; `register.allow` lists strings that pass as they are.
    A range (「A에서 B까지」) and a quotation in 「」 are removed before the
    rules read the label.
    """
    spec = cfg.get("register")
    if not spec:
        return None
    rules = list(REGISTER_RULES)
    if spec.get("words"):
        rules.append(("working word", re.compile(spec["words"])))
    allow = set(spec.get("allow", ()))
    out = []
    for svg in svgs:
        for _a, text in texts(svg):
            if not text or text in allow:
                continue
            probe = re.sub(r"[가-힣]+(?:에서|부터) [^·]*?까지", "", text)
            probe = re.sub(r"「[^」]*」", "", probe)
            for name, rule in rules:
                if rule.search(probe):
                    out.append((svg.name, name, text))
                    break
    return out


SECTION_NUMBER = re.compile(r"^([0-9]+(?:\.[0-9]+)+(?:[·~][0-9]+(?:\.[0-9]+)+)*)(?:\s|$)")


PLAIN_NUMBER = re.compile(r"^-?[0-9]+(?:[.,][0-9]+)*%?$")


def section_number_errors(svgs, cfg):
    """(file, numbers) for labels that open on a document section number.

    A section number moves whenever a page is inserted, so a figure that
    names one goes stale silently. A bare decimal on a baseline it shares
    with two or more other plain numbers is a tick on an axis (-3 · 0 · 1.5 ·
    3), a value rather than a reference, and passes.
    """
    if cfg.get("sectionNumbers", True) is False:
        return None
    out = []
    for svg in svgs:
        rows = {}
        items = []
        for attrs, t in texts(svg):
            y = _attr(attrs, "y")
            items.append((y, t))
            if y is not None and PLAIN_NUMBER.match(t):
                rows[y] = rows.get(y, 0) + 1
        found = set()
        for y, t in items:
            m = SECTION_NUMBER.match(t)
            if not m:
                continue
            if PLAIN_NUMBER.match(t) and rows.get(y, 0) >= 3:
                continue
            found.add(m.group(1))
        if found:
            out.append((svg.name, sorted(found)))
    return out
