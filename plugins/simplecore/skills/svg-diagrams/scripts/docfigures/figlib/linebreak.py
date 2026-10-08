"""Where a label may break: 「·」 lists and parenthesised groups.

The rule a Korean document sets for its figure labels:

  R1  a line breaks only at a middle-dot separator, never inside an item
  R2  a parenthesised group that would break inside moves whole to the next
      line, the break going right before its opening parenthesis, even where
      the parenthesis touches the word before it (「개발 파트」 / 「(구현 · 강의)」)
  R3  only when R2 adds a line does the break go inside the parentheses, and
      then only at a separator (R1 holds inside as well)
  R4  an item wider than its line on its own may break inside, but only at a
      word space within it (never inside a word, and inside parentheses only
      where its spaces outside them cannot hold it), at the spaces that leave
      its lines most even; it starts a line of its own after the separator
      before it

The separator stays at the end of its line (「결함 수정 ·」 / 「강의」). A run of
items is the text between two run edges: a comma, a colon, a semicolon, a full
stop before a space, a parenthesis, or the text's edge. A dot written tight
(「구성·크기」) binds only the words touching it: a line may break after it,
with no space, and the spaces around the compound are ordinary word breaks.
Outside runs and groups a phrase breaks by word.

This module measures nothing itself. Every layout takes `fits(line)`, the
caller's own measure, so the wrap and the check over a saved figure judge a
line the same way.
"""
import re
from dataclasses import dataclass

DOT = "·"
OPENS = "(（"
CLOSES = ")）"
# A character that ends a run of items; a full stop and a colon only before a
# space or the end, so 「1.5」 and 「12:30」 stay inside their item.
EDGE_ALWAYS = ",，、;；"
EDGE_BEFORE_SPACE = ".:。："

# The rank of a break opportunity: FREE breaks are taken first; TIGHT (after a
# dot written tight, or before a group that cannot break inside, either of
# which splits a compound) only where no FREE break fits;
# INNER (a separator inside parentheses) only where moving the group whole adds
# a line; LAST (a space inside an item, or inside parentheses off a separator)
# only for an item no line holds whole (R4).
FREE, TIGHT, INNER, LAST = 0, 1, 2, 3


@dataclass(frozen=True)
class Opportunity:
    end: int    # the line before the break is text[start:end]
    next: int   # the next line starts here
    rank: int


@dataclass(frozen=True)
class Layout:
    lines: list
    unfixable: bool        # a line overflows: a word wider than the line
    overwide: tuple = ()   # items broken at a space under R4


def groups(text):
    """{open index: close index} of every matched parenthesis pair."""
    match, stack = {}, []
    for i, ch in enumerate(text):
        if ch in OPENS:
            stack.append(i)
        elif ch in CLOSES and stack:
            match[stack.pop()] = i
    return match


def _inside(match, a, b):
    """The outermost group holding both a and b, as (open, close), or None."""
    best = None
    for o, c in match.items():
        if o <= a and b <= c and (best is None or o < best[0]):
            best = (o, c)
    return best


def _is_edge(text, i):
    ch = text[i]
    if ch in EDGE_ALWAYS:
        return True
    return ch in EDGE_BEFORE_SPACE and (i + 1 == len(text) or text[i + 1].isspace())


def _prev_char(text, i):
    """Index of the last non-space character before i, or -1."""
    j = i - 1
    while j >= 0 and text[j] == " ":
        j -= 1
    return j


def _next_char(text, i):
    """Index of the first non-space character at or after i, or len(text)."""
    j = i
    while j < len(text) and text[j] == " ":
        j += 1
    return j


def _depth0(match, i):
    return not any(o <= i <= c for o, c in match.items())


# A spaced separator: a dot with a space on either side. A tight dot binds only
# the words touching it (「하드웨어·소프트웨어」), so a space is never inside one
# of its items; a spaced one separates phrases (「결함 수정 · 강의」), whose items
# run to the run's edges.
SPACED_DOT = re.compile(r"[ \u00a0]·|·[ \u00a0]")
SPACES = " \u00a0"


def _segment_has_list(text, match, i):
    """Whether the run of depth-0 text around i holds a spaced separator."""
    lo = i
    while lo > 0 and _depth0(match, lo - 1) and not _is_edge(text, lo - 1):
        lo -= 1
    hi = i
    while hi < len(text) and _depth0(match, hi) and not _is_edge(text, hi):
        hi += 1
    return SPACED_DOT.search(text[lo:hi]) is not None


def opportunities(text):
    """Every place `text` may break, ranked."""
    match = groups(text)
    out = []
    i = 0
    while i < len(text):
        ch = text[i]
        if ch == " ":
            j = _next_char(text, i)
            if j == len(text):
                break
            p, n = _prev_char(text, i), text[j]
            if p < 0:
                i = j
                continue
            grp = _inside(match, p, j)
            if n == DOT:
                pass                      # a separator never opens a line
            elif grp:
                rank = INNER if text[p] == DOT else LAST
                out.append(Opportunity(i, j, rank))
            elif text[p] == DOT or (n in OPENS and j in match):
                out.append(Opportunity(i, j, FREE))
            elif _is_edge(text, p) or text[p] in CLOSES:
                out.append(Opportunity(i, j, FREE))
            else:
                rank = LAST if _segment_has_list(text, match, i) else FREE
                out.append(Opportunity(i, j, rank))
            i = j
            continue
        if ch == DOT and i + 1 < len(text) and text[i + 1] not in " \u00a0" and i > 0 \
                and text[i - 1] not in " \u00a0":
            # a tight separator: the break goes after the dot
            out.append(Opportunity(i + 1, i + 1, INNER if _inside(match, i, i + 1) else TIGHT))
        elif ch in OPENS and i in match and i > 0 and text[i - 1] not in " \u00a0":
            # a group touching the word before it moves whole (R2) when it
            # could break inside; one that cannot (「(1회)」) leaves its word only
            # where no space breaks the line, as a tight compound does
            inside = text[i + 1:match[i]]
            if not _inside(match, i - 1, i):
                breakable = " " in inside or DOT in inside
                out.append(Opportunity(i, i, FREE if breakable else TIGHT))
        i += 1
    return out


def _fill(text, opps, fits, tiers, whole=None, measure=len):
    """Greedy lines: each takes the farthest break of the first tier that fits.

    `whole` is the looser measure a word or a tight compound is held to before
    it is split at a TIGHT break: one that passes it keeps its line. An item no
    line holds whole is broken under R4 (`_split_overwide`).
    """
    lines, start, unfixable, overwide = [], 0, False, []
    while True:
        rest = text[start:].strip(" ")
        later = [o for o in opps if o.end > start]
        if not later or fits(rest):
            lines.append(rest)
            return Layout(lines, unfixable or not fits(rest), tuple(overwide))
        chosen = None
        for tier in tiers:
            if whole and FREE not in tier:
                word = min((o for o in later if o.rank == FREE),
                           key=lambda o: o.end, default=None)
                atom = rest if word is None else text[start:word.end].strip(" ")
                if " " not in atom.rstrip(" \u00a0" + DOT) and whole(atom):
                    if word is None:
                        lines.append(rest)
                        return Layout(lines, unfixable)
                    chosen = word
                    break
            if LAST in tier:
                pieces = _split_overwide(text, opps, start, fits, measure)
                if pieces:
                    item, cuts = pieces
                    overwide.append(item)
                    for cut in cuts:
                        lines.append(text[start:cut.end].strip(" "))
                        start = cut.next
                    chosen = False
                    break
            ok = [o for o in later if o.rank in tier and fits(text[start:o.end].strip(" "))]
            if ok:
                chosen = max(ok, key=lambda o: o.end)
                break
        if chosen is False:
            continue
        if chosen is None:
            # nothing fits: the line overflows at the nearest break
            chosen, unfixable = min(later, key=lambda o: o.end), True
        lines.append(text[start:chosen.end].strip(" "))
        start = chosen.next


def _split_overwide(text, opps, start, fits, measure):
    """R4: the item opening at `start` that no line holds, cut at its spaces.

    The item runs to the first break that is not inside an item. It is cut into
    the fewest lines that fit, at the spaces whose lines are most even (the
    widest line the narrowest), using spaces outside parentheses where those
    alone can hold it. Returns (item, cuts) with the last piece left to run
    on, or None when no set of spaces holds it.
    """
    ends = [o.end for o in opps if o.rank != LAST and o.end > start]
    stop = min(ends) if ends else len(text)
    item = text[start:stop].strip(SPACES + DOT)
    match = groups(text)
    inner = [o for o in opps if o.rank == LAST and start < o.end < stop]
    outside = [o for o in inner if _depth0(match, o.end)]
    for spaces in (outside, inner):
        cuts = _even_cuts(text, start, stop, spaces, fits, measure)
        if cuts:
            return item, cuts
    return None


def _even_cuts(text, start, stop, spaces, fits, measure):
    """The fewest cuts at `spaces` whose pieces all fit, most even; or None."""
    for n in range(2, len(spaces) + 2):
        best = None
        for combo in _combinations(range(len(spaces)), n - 1):
            cuts = [spaces[i] for i in combo]
            pieces, at = [], start
            for cut in cuts:
                pieces.append(text[at:cut.end].strip(" "))
                at = cut.next
            pieces.append(text[at:stop].strip(" "))
            if not all(fits(pc) for pc in pieces):
                continue
            widest = max(measure(pc) for pc in pieces)
            if best is None or widest < best[0]:
                best = (widest, cuts)
        if best:
            return best[1]
    return None


def _combinations(pool, k):
    """Index combinations in order; a label holds few enough spaces to try all."""
    pool = list(pool)
    if k == 0:
        yield ()
        return
    for i, first in enumerate(pool):
        for rest in _combinations(pool[i + 1:], k - 1):
            yield (first,) + rest


def layout(text, fits, whole_fits=None, measure=len):
    """Lines of `text` under R1-R4, measured by `fits`.

    Two layouts are made: R2's, which breaks inside a group only when even its
    own line cannot hold it, and R3's, which may break at any separator inside
    a group. R3's is taken only when it has fewer lines. `whole_fits` is the
    measure a word or tight compound is kept whole to on its own line rather
    than split after its dot, and `measure` the width R4 evens lines by.
    """
    opps = opportunities(text)
    whole = _fill(text, opps, fits, ({FREE}, {TIGHT}, {INNER}, {LAST}), whole_fits,
                  measure)
    inner = _fill(text, opps, fits, ({FREE, INNER}, {TIGHT}, {LAST}), whole_fits,
                  measure)
    return inner if len(inner.lines) < len(whole.lines) else whole


# ── the check over lines already set ────────────────────────────────────────
@dataclass(frozen=True)
class Finding:
    rule: str      # "R1", "R2", "R3", "separator", or "R4" (information)
    line: int      # the break falls after lines[line]
    detail: str
    fixable: bool  # whether a layout under the rule exists at this measure

    @property
    def info(self):
        """An over-wide item broken at a space (R4) is reported, not failed."""
        return self.rule == "R4"


def _item_at(text, match, i):
    """The item of a spaced run around index i: from the spaced separator,
    edge or group before it to the one after it."""
    def stops(j):
        if not _depth0(match, j) or _is_edge(text, j):
            return True
        # a spaced separator ends an item; a tight dot is inside one
        return text[j] == DOT and ((j > 0 and text[j - 1] in SPACES)
                                   or (j + 1 < len(text) and text[j + 1] in SPACES))
    lo = i
    while lo > 0 and not stops(lo - 1):
        lo -= 1
    hi = i
    while hi < len(text) and not stops(hi):
        hi += 1
    return text[lo:hi].strip(SPACES)


def _join(lines):
    """The label the lines were cut from, and each break's (a, b) indices:
    the last character before it and the first after it."""
    text, cuts = "", []
    for k, line in enumerate(lines):
        if k:
            prev = lines[k - 1]
            tight = len(prev) >= 2 and prev.endswith(DOT) and prev[-2] != " "
            if not tight:
                text += " "
            cuts.append((len(text) - (1 if tight else 2), len(text)))
        text += line
    return text, cuts


def break_findings(lines, fits):
    """Every break between `lines` that R1-R3 or the separator rule forbids,
    and every break inside an item no line holds whole (R4, `Finding.info`).

    `fits` measures a line as the wrap did; over a saved figure it is the
    widest line of the label, which a moved group may not pass.
    """
    lines = [ln.strip(" ") for ln in lines if ln.strip(" ")]
    if len(lines) < 2:
        return []
    text, cuts = _join(lines)
    if DOT not in text and not any(ch in text for ch in OPENS):
        return []
    match = groups(text)
    fixable = not layout(text, fits).unfixable
    out = []
    for k, (a, b) in enumerate(cuts):
        here = f"「{lines[k]}」 / 「{lines[k + 1]}」"
        if text[b] == DOT:
            out.append(Finding("separator", k, f"{here}: the separator opens a line", True))
            continue
        grp = _inside(match, a, b)
        if grp:
            if text[a] != DOT:
                out.append(Finding("R3", k, f"{here}: inside parentheses, not at a separator",
                                   fixable))
            elif _moved_whole_fits(lines, k, text, grp, fits):
                out.append(Finding("R2", k, f"{here}: the group fits whole on the next "
                                   "line without adding one", True))
            continue
        if text[a] == DOT or text[a] in CLOSES or _is_edge(text, a):
            continue
        if text[b] in OPENS and b in match:
            continue
        if _segment_has_list(text, match, a):
            item = _item_at(text, match, a)
            if item and not fits(item):
                out.append(Finding("R4", k, f"{here}: over-wide item 「{item}」, broken "
                                   "at a space", True))
            else:
                out.append(Finding("R1", k, f"{here}: inside a 「·」 item", fixable))
    return out


def _moved_whole_fits(lines, k, text, grp, fits):
    """Whether moving the group broken after lines[k] whole to a line of its
    own keeps the label at most as many lines as it has."""
    o = grp[0]
    # the line the group opens on, and what stands before the group there
    offset = 0
    for i, line in enumerate(lines):
        start = text.find(line, offset)
        if start <= o < start + len(line):
            before = text[start:o].strip(" ")
            if not before:
                return False
            rest = layout(text[o:].strip(" "), fits).lines
            return i + 1 + len(rest) <= len(lines)
        offset = start + len(line)
    return False
