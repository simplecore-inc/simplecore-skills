# The full-sweep procedure

The procedure for reviewing and fixing a whole surface of screen copy or a whole document. What
counts as wrong is decided by [ui-copy.md](ui-copy.md) and
[response-style.md](response-style.md); this file decides the order in which those standards are
applied. The unit is one screen for copy and one document for prose. In a document, read step 8's
screen-context items as their document equivalents (title and opening paragraph, section heading and
body, table header and values, terminology across the whole document).

**This procedure finishes in one turn.** Between step 0 and step 9 there is no going back to the
user. Hundreds of findings, or a new rule to register, do not change that: judge, fix, and write it
in the completion report. The one place to stop is a term decision that could go either way, and
even that goes to the end under a provisional spelling and is asked in a batch.

## 0. Do not start with a search

Search is the follow-up tool for widening a pattern you found by reading. Fixing only what a search
returned leaves the same type of defect in places the search never listed, and it reads as correct
among the sentences around it. Read every file and every sentence in filename order.

## 1. Check the project's rules and terms first

1. Instruction files on the current path and above it (`AGENTS.md` · `CLAUDE.md`).
2. The project glossary (`.claude/GLOSSARY.md`) and rule pack (`.claude/l10n-rules.json`).
3. The build and check commands the project defines.
4. Files already fixed, and changes the user is working on. Do not revert or overwrite them.

When a legal or technical term looks wrong, do not change it on your own: check the glossary and how
the same family of screens uses it first.

## 2. Fix the list of what is under review

Sort the files by name and count them. Confirming at the end that nothing was missed requires
knowing the total before starting.

## 3. Read every displayed string in order

Screen titles and subtitles · menus · tabs · breadcrumbs · section titles · field labels · units ·
option items · buttons and row actions · guidance text · help · tooltips · confirmation dialogs and
warnings · empty states · error states · loading states · table headers · badges · summary cards ·
sample data · accessibility labels · notes exposed as screen descriptions. Code identifiers and CSS
class names are out of scope. Where a screen string doubles as an identifier, fix the references
along with it.

When the volume is large, pull candidates with the lens ([reading-lens.md](reading-lens.md)), read
those in filename order first, then sweep what the lens did not catch. The lens is a stem list, not
a check, so everything gets read in the end.

Judge each sentence on ten questions.

1. Does a first-time reader get the meaning in one pass?
2. Is this what business software actually says?
3. Does understanding it require recalling the English original?
4. Is an object or a screen behaving like a person?
5. Can a metaphorical verb be replaced with a more precise functional verb?
6. Are the actor, the target, the condition, and the result clear?
7. Does it carry the same legal and technical meaning as the source?
8. Do other screens use the same term for the same concept?
9. Do the particles, word order, and predicate agreement read naturally?
10. Do the title and the description state the same fact?

## 4. Rewrite by the sentence

Do not substitute a single word. State in one sentence the fact the original is conveying, confirm
who actually acts and what the action is, delete the metaphors and the abstract nouns, put the
condition or result the user needs to know first, choose the most specific predicate, and match the
screen's register and level of politeness. Making it shorter is not the goal. Put every rewritten
sentence back through `check` and `rules` — the replacement being itself a banned expression is the
most common outcome of this work.

## 5. Widen the repeating pattern and search again

Use a full-text search as a follow-up only after the in-order reading. Search the conjugations of a
stem found in one sentence, broadly (기대다 · 기댄다 · 기대는 · 기대지). Judge each result in
context: a real physical action, a formal technical term, or a metaphor. If you used a bulk
substitution, read every changed sentence again to confirm the particles and the meaning.

## 6. Unify terms across a family of screens

Put the list, detail, registration, help, mobile, and tablet screens of one feature side by side.
Look for: one state with two names · a list column name against the detail field name · a help title
against the screen title · a desktop action name against the tablet one · the name and order of a
legal obligation · verbs with different meanings used interchangeably (적용 · 등록 · 배정 · 지정 ·
선임).

**When one action has two names, counting finds it, not reading.** Fix on one action, count every
candidate name, and unify on the most used one.

```bash
for w in 연결 잇기 붙이기 매핑; do printf '%-8s %s\n' "$w" "$(grep -ro "$w" <target> | wc -l)"; done
```

Three more things only counting reveals: a card title against the title of the dialog it opens · a
count in the body against a count in a metric (「다섯 부처」 against a tile's 「6개 부처」) · one
predicate covering two subjects (ui-copy.md, the subject-agreement section).

## 7. Re-check the grammar across the whole scope

Sweep the entire review scope again, not only the files you changed: particles · adnominal clauses ·
subject-predicate disagreement · duplicated words · unnecessary passives and double negatives · two
or more consecutive spaces · inconsistent sentence endings · a title disagreeing with the body ·
sentence fragments left by a substitution · honorific and plain forms mixed · `할 수 있습니다`
duplicated with `가능합니다` · spacing around parentheses, numbers, and units. Particle disagreement
and a word repeated twice are caught by the audit script; a person reads the rest.

## 8. The second pass, in screen context

After the sentence-level pass, read each screen's copy again in display order and by functional
relation. Compare the title, description, states, warnings, fields, buttons, panels, and help as
they are declared in the source, in order. The first time this is applied, try it on representative
screens that differ in role, device, and structure (a list with a detail panel · a form · an
approval screen · a warning or blocked state · mobile · tablet field entry · administrator settings
· a legal obligation with its evidence).

- **Read from the title through to the action button as one flow.** Does the screen name say the
  same feature as the description · do the state names and summary figures count this screen's main
  subject · does the warning describe a problem that actually exists on this screen · is there a
  button or a path for the action the warning demands · does the button name match the action name
  in the guidance text. The warning 「교육 과정을 개설하세요」 and the button 「회차 열기」 are both
  「교육 과정 개설」.
- **The information structure of warnings and confirmations.** A warning is written problem → cause
  → impact → action, without repeating what the screen already makes obvious. Do not state the
  restriction and omit the remedy, and do not state the action while hiding the cause. A
  confirmation dialog states the name of the action, the affected objects and how many, what is kept
  and what changes, whether it can be undone, and at what granularity.
- **The list and the detail panel must be about the same thing.** The selected object against the
  panel's subject · column names against field names · the list's state against the panel's
  description · whether the panel's button acts on the selected object · whether an empty state
  still carries a sentence pointing at a specific record.
- **Procedure and terminology across screens.** The previous screen's button name against this
  screen's title · the action name on a request screen against the event name in the history screen
  · state names in the policy screen against the judgement screen · desktop against mobile action
  names. Do not describe a screen transition as movement: `여기서 연다` → 상세 화면으로 이동한다. A
  button says what it actually does once pressed: `검사 일정 잡기` → 검사 신청 · `증빙 올리기` →
  증빙 등록. A navigation button takes the destination's name; an action button takes the action.
- **Information priority by role.** A field worker needs what to do now, the deadline, and why they
  are blocked; an administrator needs the basis for a judgement, the unmet requirements, and who is
  affected; an approver needs the approval conditions and what is unverified; a system administrator
  needs the setting, its scope, and how to recover; an external-organization user needs what they
  can do themselves and what they must request. Do not write an imperative for an action the current
  role cannot perform (`교육 회차를 개설하세요` → 상위 조직에 교육 과정 개설을 요청하세요).
- **One key relation per sentence.** Split where the actor changes, where the time condition
  changes, and where a description of state turns into an instruction.
- **Non-visual length and duplication checks.** Whether one button carries both a cause and a result
  · whether a tab or a badge has grown into a sentence · whether the same warning repeats three
  times across the title, the body, and the help. Actual truncation and density are not settled
  without looking at the rendered result.

**Done for the context pass**: the description alone tells the reader what the screen is for · the
current state is distinguishable from the reason for a restriction · the next possible action is
clear · the guidance and the button use the same action name · the list, detail, confirmation, and
history use the same object name · no instruction demands a permission the current role lacks · the
result of the fixes did not become verbose.

### A random sample confirms nothing was missed

After the full read and the repeat-pattern search, pick 15 to 20 files at random from the whole set
and read them as if for the first time. Make sure the sample includes short wrapper files that
define only a dialog or a help text, files that import a base screen and override only the name,
state, and note, tablet and mobile screens, error, empty, and permission-restricted states, and
screens where legal and technical terms sit together. Do not exclude a wrapper file for being short.

When the sample turns up something new, fix that sentence, search the whole scope again for the same
stem and structure, add the judgement test and the rule to the rule pack when no existing rule
explains it, apply it to the files already reviewed, and draw a new sample. **Repeat until a sample
comes back with nothing new.** Draw each round without overlapping the previous one, and record the
count per round.

**Stop drawing samples when new problems keep appearing past the third round.** One new metaphor
type per round does not mean the sample is too small; it means that type was never swept across the
whole scope. Collect every metaphor the samples found into one list, sweep the whole repository once
with it (writing each word's legitimate use as an exclusion pattern beside it), judge the candidates
in context and fix them, then sample again. Add the types you found to the rule pack and the
judgement standard.

## 9. Checks and build

1. Syntax checks on the changed files (module parsing, type checking, whatever the project uses).
2. The project's gate checks.
3. Regenerating the artifacts (boards, bundles).
4. Whitespace and conflict-marker checks on the diff.
5. All four audit commands (`check` · `rules` · `audit` · `suspects`). Stage new files before
   auditing. `check` alone at zero is not a pass.

If you were asked to skip the visual review, do not launch a browser and say so in the final report.

## A new pattern becomes a rule the moment it is found

When a sentence structure appears that no existing entry explains, add an entry to ui-copy.md in the
same change that fixes the sentence. It carries the problematic structure and its conjugations, why
it is wrong, its type (metaphor · literal translation · personification · ambiguity), the question
to ask when confirming what the feature actually does, a before-and-after example, the exception
that protects legitimate use, and the search angle for finding it again. What a machine can judge
goes into the rule pack with hit/miss examples, a banned word goes into the glossary, and after
adding the rule the already-reviewed files are swept again with that pattern.

## Done

1. Every file in scope was read in filename order.
2. Every user-facing string was reviewed.
3. English metaphors, personification, inanimate subjects, and literal translation were removed in
   favour of expressions that name the actual function and relation.
4. Legal and technical terms kept their meaning.
5. One concept has one name across every related screen.
6. Particles, word order, agreement, and spacing were re-checked.
7. Every remaining candidate from the repeat-pattern search was judged in context.
8. A random sample came back at zero.
9. Syntax checks and the project's gate checks pass, and the artifacts were regenerated.
10. Screen names, states, warnings, buttons, and detail panels were verified screen by screen for
    terminology and action flow.

## The completion report

Files and screens reviewed · the types of problems fixed · representative before-and-after examples
· how legal and technical terms were preserved · checks run and their results · checks not run and
why · the main paths changed · the term-decision section (what was registered, what is waiting on
the user). Do not end with 「자연스럽게 수정했습니다」.
