# The proposal checks, and what each one catches

The checks under `proposal-writing/scripts/` hold a bid's manuscript, tender citations,
annex references, scoring coverage, shared facts, page volume and numeric claims to the
content standard. They read through the library in `plugins/simplecore/scripts/bidkit/`:
`config` (the project declaration in `.claude/slide-decks.json`, found by walking up from the
working directory), `manuscript`, `mdtable`, `textko`, `baseline`, and `deckread` with `sgmcp`
for the options that read a built deck.

| Check | Lives in | Reads | Fails when | Declares |
| --- | --- | --- | --- | --- |
| `reqid` | `proposal-writing/scripts/` | the deck's source files (comments stripped) and every manuscript file; with `--manuscript-only` the manuscript alone | an id the digest's headings do not issue is cited, a range included (`PER-001~008` over a never-issued `PER-007`); a sentence matching `requirements.absence` may name a missing id | `requirements`, `manuscript` |
| `rfpwords` | `proposal-writing/scripts/` | each requirement's quoted detail and the manuscript (or the deck with `--against-deck`) | a noun the requirement names is written nowhere, unless retired with a reason | `requirements`, `checks.rfpwords` (optional), `checks.baselines` |
| `rfpcite` | `proposal-writing/scripts/` | the transcribed tender and the manuscript (and `rfp.scan`) | a cited tender chapter or section does not exist, or a cited section name is in another chapter; a name in no chapter is a warning | `rfp.dir` |
| `annexref` | `proposal-writing/scripts/` | the deck's sources, the manuscript outside the annex, and the files that define each kind of annex item; with `--manuscript-only` no deck | a reference names an annex item its definition does not carry | `annex.references` |
| `evaluation` | `proposal-writing/scripts/` | the scoring table, the lookup table (Markdown or as the deck prints it), the deck's folios and heads, and an optional requirement lookup; with `--manuscript-only` the rows alone | a scoring item or element has no row, a row answers nothing scored, rows run out of scoring order, a printed folio differs from the page id beside it, a head names an unscored item or one whose row does not cite the page, a requirement row is unissued, repeated, misnamed, or cites a page that does not print the id | `evaluation.scoring`, `evaluation.lookup` |
| `budget` | `proposal-writing/scripts/` | the deck's folios | more numbered pages than `budget.maxNumbered`; the finding cites `budget.clause` | `budget.maxNumbered`, `pages` |
| `volume` | `proposal-writing/scripts/` | every printed manuscript page, its figure links and their SVG widths | a printed page holds more than its capacity (`budget.charsPerPage.figure` with a full-width figure, else `.text`) times `budget.pageTolerance`; a part prints more pages than `budget.parts` gives it; a figure link resolves to no file | `manuscript`, `budget.charsPerPage` |
| `mdtwice` | `proposal-writing/scripts/` | the printed prose of every manuscript file | two sentences in different files share at least `threshold` of the shorter one's words, unless retired with a reason | `manuscript`, `checks.mdtwice` (optional), `checks.baselines` |
| `sharedvalues` | `proposal-writing/scripts/` | the shared-facts table and the printed pages (manuscript markers or the deck) | a distinctive value is missing from a page its row assigns, or printed on a page it does not | `manuscript.sharedValues` |
| `claims` | `proposal-writing/scripts/` | every manuscript line with a digit (annex and exclusions left out) | never a gate: prints FLAG (both Jev phrasings say measured, no evidence in the line's block) and SPLIT lines and the statistics line; exit 1 only when a question went unanswered. `--dry-run` sends nothing | `jev.claims.evidence` |

**A volume capacity is an estimate.** `volume` reports every printed page over its declared capacity
and every part over its planned pages; a finding is a page to look at before typesetting, not a
number of characters to delete. A project that stops condensing short of 1.0 declares the ratio it
stops at as `budget.pageTolerance`. The page title is not body copy and is not counted.

**A shared-facts table's rule is obeyed to the letter.** One such rule read 「이 문구를 글자 단위로
그대로 인쇄하고, 줄이거나 덧붙이지 않는다」 and a five-line row duly appeared three times in one
chapter, on consecutive pages, each time under the page's own title explanation: the panel reads
that chapter in order and meets the same paragraph three times. The writer was obeying the rule,
which is what makes it the rule's defect rather than theirs. `sharedvalues` holds a value to the
pages its row assigns and cannot see a row repeated across those pages, so only the table's own
rule keeps them from repeating it.

**An annex reference survives the change that breaks it.** One document carried seven such
breaks, two of them numbering gaps and two of them appendix letters three reorderings stale, and
the build reported none of them; `annexref` reads every reference against the item's definition.

**Claims triage reports its own cost.** The statistics line is counted from the answers, never
estimated: questions sent, answers received, errors, seconds, the rate, and the sum of
`providerMetadata.gateway.cost` the gateway returned with each answer
(「질문 828 · 답 828 · 오류 0 · 68초(초당 12건) · $0.02」). `--dry-run` prints how many questions a run
would send and sends none. The client is injected, so the tests make no call.

## Running them

Each check is a script run directly from anywhere inside the project:

```bash
python3 <skills>/proposal-writing/scripts/reqid.py
python3 <skills>/proposal-writing/scripts/evaluation.py --manuscript-only
python3 <skills>/proposal-writing/scripts/claims.py --dry-run
```

`--deck <name>` picks the deck entry of the declaration when it holds more than one. A check's
own options are given the same way: `--bless` on a check that keeps a baseline,
`rfpwords --against-deck`, `mdtwice --same`, `claims --dry-run`, and `--help` on any of them.
While a bid writes its manuscript, `reqid`, `annexref` and `evaluation` run with
`--manuscript-only`, which opens no deck server. Exit codes are 0 clean, 1 findings, 2 a check
that could not reach its input (a missing key, no server holding the deck, a deck that
contradicts the declaration). Every check prints one line saying what it read and what it found.

A check is added with tests that build its broken form and its fixed form
(`scripts/bidkit/tests/`, `proposal-writing/scripts/tests/`, standard-library `unittest`), and
fire on the first and stay quiet on the second. Every suite runs with
`plugins/simplecore/scripts/test.sh`.

## A baseline entry carries the reason, not just the finding

A baseline retires a finding, and a finding retired on the strength of having
been seen is the one thing a baseline must never do: it turns the check into a
record of what somebody once looked at. Every baseline is
`{finding: reason}`, an entry with an empty reason still fails, and retiring a finding
writes the entry blank so the reason has to be typed before the check goes
quiet. Where a baseline predates the rule, its existing entries stay retired and only
a new or changed one demands a reason; a flag day that fails forty entries at
once teaches nobody anything.

Baselines live in the directory `checks.baselines` names, one `<check>.json` per check,
never beside a check's script. An entry is `"finding": "reason"`, or
`{"reason": …, "measure": …}` when the judgement holds only at one measure (an overlap
ratio, a set of values); `""` is retired with the reason still owed and fails.
A legacy file
(a list of findings, a bare measure, an object without a reason) loads as grandfathered entries
that stay retired while their measure is unchanged. The shared loader reads `reason` and
`measure` and no other key names; a check whose legacy file named them otherwise translates it on
load, as `samecol` does for its `page<TAB>table<TAB>head` keys (a bare value, or the reason under
「사유」 and the value under 「값」). `--bless` rewrites the file
with today's findings, keeps the reason of every entry found unchanged, writes the rest
blank, and prints the ones that still owe a reason. The checks that keep a baseline
take `--bless`: `mdtwice` and `rfpwords`.

## A check that cannot reach its input says so instead of passing
## A check that cannot reach its input says so instead of passing

A zero is the same shape whether the deck is clean or the check never looked. One check
read every figure's SVG to compare its labels against the prose beside it, resolved
the figure path against the process's own directory instead of the deck's, found nothing
where it looked, and reported 「0건」 on every run it had ever made. The deck could have
been drawing its own paragraphs on every page and the line would have read the same.

- **A missing input is an error, not an empty result.** Raise on it. Returning an empty
  list when a path does not exist is the shape to look for, and it is always wrong in a
  check.
- **Distinguish 「no such thing」 from 「a thing with nothing in it」.** A layout shell that
  draws no figure and a figure name nothing defines are different, and mapping both to an
  empty list is how the first one hides the second.
- **A generator that copies a string out of a source the check cannot read couples two files
  with nothing watching them.** One deck's annex generator held a divider lede as a
  constant, copied verbatim from a manuscript line, and that line was a `>` blockquote, which
  the parity check drops before comparing. The two could drift apart forever and every check
  stayed green. Where a generator needs a manuscript's words, it reads them; a constant is
  only for what the manuscript does not say.
- **Prove a new check on both sides before believing its zero**: build the broken form,
  watch it fire, build the fixed form, watch it go quiet. A check nobody has seen fire is
  a check nobody has seen.

## A check reports what it is unsure about; it never filters it out
## A check reports what it is unsure about; it never filters it out

The tempting move when a new check fires on something that turns out to be fine is to
exclude that shape in the code: a mark that is an acronym, a component a sequence
repeats on purpose, a page that is a table of record. It reads as making the check
precise. It is the one change that cannot be reviewed: the excluded case never appears
again, so nobody learns that the exclusion also swallowed the case it was not meant to.
One deck dropped a whole check for two findings that turned out to be clean, and with it
the only mechanical way it had to catch a silent overlap.

**Missing a defect costs more than reading a finding that turns out to be fine**, so the
bar for a check is what it catches, not how quiet it is.

**Read the exit code, not the last line.** A check prints a summary and exits non-zero, and
the natural way to sweep a dozen of them, piping each into `tail -1`, reports `tail`'s
status, not the check's. One deck ran that sweep for three review rounds while one of its
checks failed every time: the summary line it printed was a component census that reads
the same whether or not there are findings, and the findings were printed above it.
Capture the output and the exit status separately and print both, or the sweep will tell
you what you hoped rather than what happened.

- **A shape that is usually right is still reported**, with what makes it defensible in
  the message (「순서형이라 되풀이가 옳을 수 있다」), so the reader judges it instead of
  never seeing it.
- **A judged finding is retired in the baseline with its reason**, never in the code.
  Retiring writes today's findings and the reason goes beside each one; an entry with no
  reason still fails. The judgement is then visible to the next reader and dies when the
  page changes.
- **A measurement that disagrees with the builder's is a candidate, not a false
  positive.** Font metrics taken outside the builder differ from it by a couple of
  percent, so a value near a line boundary can go either way; report it and settle it
  against a PDF made from the built deck.
- **An exemption declared in the project's config is printed too**, at a tier of its own,
  so a page nobody has looked at since the exemption was written is not silently counted
  as finished.
