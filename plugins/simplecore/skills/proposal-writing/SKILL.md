---
name: proposal-writing
description: The content standard for a Korean bid proposal, its presentation summary and the technical documents around them - what a page must claim, how a requirement is answered in the panel's own words, controlled language for titles, body, tables, figure labels, captions and speaker notes, enumerations as lists, self-contained references and annex naming, honest reporting of tests and evidence, and the evaluator-persona review that judges the result. Use when writing, revising, translating, reviewing or auditing proposal or technical-document copy, when deciding how much a page or slide answers, when a requirement or evaluation item has to be traced to where it is answered, when transcribing an issued tender into Markdown the authors can cite, or when reviewing a document as its evaluators. Triggers - 제안서, 기술문서, 제안요청서, RFP 정리, RFP 문서화, 요구사항 정리, 요구사항 목록, 요구사항 대응, 평가항목, 평가위원, 발표본, 발표자 노트, 문구 검토, 카피 검수, 용어 통일, 열거, 별첨, 증빙, 페르소나 검토, 제안서 검토.
---

# Proposal and technical-document writing

A proposal is read once, by a panel, against a table of scored items, and it has to
explain itself with nobody standing beside it. A technical document is read by whoever
inherits the system, against what it actually does. Both fail the same way: a sentence
that needs a reader to supply the missing actor, condition or result.

**This skill carries what the document says. How it is set on a page belongs to
`simplecore:slide-decks`**, which invokes this one for every reader-facing string.
Korean sentence-level standard, glossary and audit are `simplecore:korean-docs`; this
skill never restates its register table or its word rules.

**Apply the controlled-language review to every copy task.** Read
[references/controlled-language.md](references/controlled-language.md) before creating,
revising or reviewing Korean titles, title explanations, body copy, tables, diagram
labels, captions or speaker notes. It adapts ASD-STE100's useful controlled-language
discipline to Korean proposal writing without claiming formal ASD-STE100 compliance.

**Judge by what is in context, not by having invoked the skill.** A session that is
summarized re-injects this file and does not re-inject anything it routes to, so the
reference is gone while the invocation still looks done. The same holds for a long session
that has written many documents since. If the five elements, the noun-chain rewrites and
the completion questions cannot be quoted right now, the file has not been read - open it
before the next Korean string, and say in the reply that the pass ran after the writing
rather than before it when that is what happened.
Follow its common rules first, then the separate rules for the submitted document and
for the presentation. It also defines the full-document inspection order and the minimum
context that must survive when a phrase is shortened.

**A working document the submission draws on is a copy task too.** A design document, a
feature study or a strategy note under the project's own folders is not the submitted
document, so its register and its file-specific rules come from `simplecore:korean-docs`;
what still applies is this reference's general part - the five elements a sentence carries,
noun chains, vague pointers, abstract verbs, placeholder nouns, conditions and numbers.
Read the reference before writing one. **Invoking this skill is not reading it**: the
reference is a separate file, it is where the checks live, and a claim that the
controlled-language review was applied is false until that file is in context.

## Transcribing the tender is a quotation, not a rewrite

Before a proposal can answer a tender, the authors need the tender in a form they can cite
and search, and that copy has to carry the tender's own words. **Read
[references/rfp-transcription.md](references/rfp-transcription.md) before converting a
tender - or any issued document the submission answers - into Markdown.** It carries what
is reproduced character for character, how the tender's own outline decides the file
split, how requirement ids and detail numbers are carried, the separate requirement index,
how a figure and its description are kept, and why the transcription is excluded from the
Korean audit while the tender's competing spellings are still registered as decisions.

**The failure is a helpful transcriber.** A transcription that corrects the tender's
spelling, merges two clauses that say the same thing, or adds a line explaining what a
requirement means has destroyed the thing it was made for: the panel's words. Nothing in
the body is the transcriber's sentence.

## A requirement is answered in the panel's own words

**A requirement answered in different words reads as unanswered.** The panel scans for
the words its own table uses, so the document answers with those words and keeps the
requirement's identifiers, numbers, product names and formal terms exactly as issued.
Where the document deliberately writes a term differently, the pair goes into a baseline
with the reason, so a check can tell a decision from a drift.

**Every scored item and every requirement appears where it is answered**, in the panel's
words and not only as an identifier, and a section that answers none of the identifiers
its heading claims does not belong there. A page's identifiers are a subset of the
section's; a block's are a subset of the page's.

**A page's or a slide's title is built from the requirement's own words**, after the
chapter it belongs to. A title carries its own subject: a heading that reads as a
fragment of the sentence under it has handed the subject to the body.

**The order and the budget come from the evaluation table**, not from how much has
already been written. Pages are allocated in proportion to the score, and each page's
content is selected from what that item's criteria ask for. An item that runs over
several pages says so, counting from its first page.

**The strategy chapter does not outweigh the technical chapter.** Where a strategy and
methodology chapter and a technical and functional chapter carry comparable scores, the
strategy chapter is the shorter one. Strategy states the risks, the choices and the claims;
the mechanism that makes a claim true is described once, in the technical chapter, and the
strategy page points at that section. The drift runs the other way because a strategy page
reaches for credibility by explaining how the thing works, and five such pages later the
chapter has become a second copy of the technical design: when a strategy page's body is
mostly mechanism, move the mechanism to the technical chapter and keep the claim.

**A score or a weight is never printed.** The document answers the item; it does not
quote the panel's own weighting back at it.

## What the document may claim

**Report completed work as completed work, and pending work as pending.** Describe the
functions that were tested rather than converting them into pass totals or success
percentages; keep contractual targets, acceptance criteria and future test conditions in
their own sections, and never turn pending or failed work into completion.

**A number stays with its source, its meaning and its unit.** An assumption, a
measurement, a requirement, a target and a verified result are never presented as one
another, and an invented round number is worse than no number.

**An implementation-case page describes supported functions and their operational use.**
Numbers that happen to be visible in a sample capture are not test results and not
performance claims.

**A capture in a blind evaluation is masked before it is placed**, and what the mask
removes is the proposer's identity, never the evidence the capture exists to show.

**A screen drawn for the proposal is filled with the tender's own data.** Wireframes,
mock-ups and entity diagrams attached to a submission are read as evidence that the
proposer understood the work, and placeholder rows say the opposite. Collect the values
the tender prints before designing the screens, and read
[references/sample-data.md](references/sample-data.md) for where the collection lives, how
an invented row is derived from a quoted one, the consistency a screen will expose, and how
far a blind evaluation reaches into the attachments.

## One fact, one wording, across every document in the submission

**A milestone is one fact.** When a week, a duration or a completion point appears in the
submitted document, in a generated figure, in the presentation body and in its speaker
notes, every occurrence carries the same value. Distinguish an activity's working span
from its approval or completion milestone instead of changing both mechanically, and
update the manuscript and every generator that owns the repeated value.

**A term introduced in one surface is changed in every surface that carries the same
claim** - body, table, figure label, caption and speaker note in the same pass. Keep the
manuscript, the typesetting source and every generated figure's source wording aligned;
when a generated file carries the copy, the change goes into its generator.

**A presentation's lead and its speaker notes use one vocabulary and one claim.** The
lead at the top of the slide is the visible form of the speaker's core message, so the
notes carry that content with the same terms and expressions. Supporting detail may
remain only in the notes, but the notes must not rename the lead's actors, actions,
conditions, measures or deliverables. Review the lead, the notes and the figure labels as
one copy unit before rendering.

**The printed line is written and the spoken line is spoken.** A script has to stand
without the slide: it says what the slide shows, why it matters and what the proposer
commits to, and it does not read the slide aloud.

## Submitted document copy

**A submitted document explains itself without a presenter.** Write each page's opening
claim with enough business context to identify the problem, the proposer's action and the
evidence or outcome, and do not import spoken transitions such as 「이제」, 「다음은」 or
「말씀드리겠습니다」.

Use polite proposer endings (`합니다` · `하겠습니다` · `확인합니다` · `적용합니다`) only
for part-divider ledes and the explanatory copy directly under a page title. Body
paragraphs, tables, captions and figure labels keep the document's concise declarative or
label form; do not mechanically convert them to polite prose. Compact labels may remain
nominal, but replace broken noun chains and vague pointers such as 「이 업무」, 「이 구현」,
「이 범위」, 「운영 기반」 or 「그 장비」 with the exact actor, object, condition and
decision.

Before closing a full-copy sweep, compare the grammar of every table column across the
manuscript and the typesetting source, so a corrected cell cannot return at the next
regeneration.

**The manuscript of a submitted proposal is short sentences, figures and tables.** A page
opens with a title and one or two sentences of explanatory copy; what follows is a table,
a figure, a list or a sentence short enough to hold one action. A paragraph of four
running sentences is a page the panel skims, and the typesetter then has to guess which
part was the claim. Where a paragraph compares options, crosses two attributes or states
values, it becomes a table in the manuscript; where it states order, dependency or
containment, it becomes a figure plan.

**An enumeration is already a list in the manuscript**, never a sentence left for the
typesetter to split. Steps, stages, priorities and anything whose order changes the result
take an ordered list; peer items (roles, checks, deliverables, conditions) take an
unordered list. 「A, B, C와 D를 확인한다」 with four checks is four list items under a
short lead-in. The same holds inside a table cell that strings three or more independent
items: give the items their own rows or their own column. The test is the manuscript, not
the rendered page - a list written as a sentence in the source returns as a sentence at
every regeneration.

**A figure plan in the manuscript is a design, not a placeholder.** It names the one claim
the figure proves, the visual type chosen for that claim (state machine, swimlane, funnel,
matrix, ladder, loop, layer stack, tree, timeline and so on), the orientation (vertical or
horizontal) and why, the structure (lanes, layers, nodes, branches and their order), and
every label the figure prints, in the tender's words. One generic sentence copied onto
every row of a figure table - 「관계 · 구조 · 흐름을 한 그림에 표시」 under forty
different titles - is the same plan forty times, and forty identical plans produce forty
box-and-arrow rows. Across a chapter the plans rotate type and orientation: a portrait page
reads a top-to-bottom flow, a ladder of gates, a funnel or a lane column beside the text
as naturally as a horizontal row, and a run of horizontal rows reads as one page repeated.

## Presentation copy

Write every reader-facing string as a short sentence or an explicit action-result pair
whenever the slot permits it. Replace noun chains and symbol-only separators with a clear
subject, action, object and result: say who checks, records, submits, approves or
retries, and under what condition. Use the proposer voice for commitments (`수행합니다`,
`확인합니다`, `기록합니다`, `제출합니다`, `확정합니다`).

Expand an abbreviation or a compressed phrase at its first meaningful use, so a
first-time listener can infer the workflow without reading the submitted document beside
the slide. Use `·`, `/` and arrows only for true alternatives, field lists or fixed
identifiers, never as a substitute for a sentence. A table cell or key row may stay
compact when it is an intentional label, but its accompanying value states the action or
the decision in plain Korean. Keep the original text slot and shorten by removing
repetition before removing the actor, the condition, the evidence or the outcome.

**A claim is a claim, not a summary of the contents**, and it names things rather than
likening them: 「범위·일정·산출물을 승인 항목으로 정하고 승인 없이 바꾸지 않는다」, not
「관리의 큰 줄기를 세운다」. A metaphor or a personified system reads as decoration exactly
where the panel is looking for a commitment.

**Do not write a placeholder noun where a measured or approved object belongs.**
An unqualified 「기준선」 makes an evaluator infer whether the sentence means a
current-state measurement, an approved requirement, a fixed test condition or a target;
name the object instead.

## Enumerations as simple lists

When a paragraph changes subject or object to enumerate roles, functions, conditions,
checks or deliverables, split it into distinct list items. A short lead-in may introduce
the list. Use one column for longer items or a sequence, and two columns for short,
parallel items when the reading order remains clear. Each item states one point with the
actor, the action and the necessary condition or result preserved. Keep the layout
simple; do not turn each item into a separate decorated card. Do not omit exceptions,
values, requirement identifiers or acceptance criteria merely to shorten the list.

Review inline comma-separated series as well as several enumerative sentences joined in
one text block. A short fixed term or status sequence may remain inline when it is read as
one unit; record the reason for retaining a flagged paragraph. Candidate scans do not
replace reading the page. After conversion, inspect the rendered page for list alignment,
column order, wrapping and page completeness, and check the adjacent pages' rhythm.

**A card's two rows split one claim, and the row the reader finishes on closes on a
predicate.** A row ending in 「~하고」 · 「~하며」 hands the predicate to a clause that never
comes. The same holds for a lone accent line, a key row's value, a paragraph and a table
cell.

**A sentence closes with a full stop and a name never takes one.** A card row, a table
cell, a note and a paragraph carry both kinds of string, and one document has to write
them the same way on every page. The test is the ending, not a judgement: a string that
closes on a predicate is a sentence and takes the stop, with the stop outside a trailing
reference (「~확인한다(부록 C).」); a head, a label, a bar's key and a column head are names
whatever they end in.

## Every external basis is named where the claim is made

A claim that rests on something outside the document names that source in the printed copy,
at the claim, close enough that the panel can check it without turning to another page.
External means the tender and its parts (chapter and clause, requirement id and name, annex
and form names, the reference screen and the row or column a value came from), a statute or
administrative rule (law, enforcement decree, article and paragraph, notice number and
effective date), a public standard or guide (exact title, issuing body, version or date) and
any vendor or portal document (title, site, confirmation date). A number, screen name,
combo value, count rule, organisation name, date, cycle or threshold taken from one of those
carries its source the same way.

**The citation is exact or it is not a citation.** 「제안요청서에 따라」, 「관련 법령에 따라」
and 「원문 기준」 name nothing a panel can open: write the clause, the article, the requirement
id and its issued name. Where the document cites the same source on many pages, the form of
the citation is one form, decided once and used everywhere - a column in the table, a clause
in the sentence, a line under the page title - rather than each page inventing its own.

**Open the source before citing it.** A wrong article, a stale notice number or a value
attributed to the wrong screen is worse than no citation, because it invites the panel to
check and find the document wrong. Where a source cannot be verified, the sentence stands on
what the proposer can show and the unverifiable reference is left out.

**And the proposer's own work is marked as the proposer's.** An assumption, a plan value, a
design decision and a target are not external bases; presented without a marking they read as
tender facts, and a panel that discovers otherwise reads every other number with suspicion.
Mark them (전제 · 대안 · 제안사 계획값) as consistently as the citations.

## Self-contained references

Reader-facing copy must not refer to internal Markdown files or design-document sections
absent from the submitted document. Review body text, diagrams, notes and appendices
together. Remove unavailable paths and reading instructions; retain verified facts and
requirement identifiers.

**Call the annex what the tender calls it, and check every reference against what the
annex holds.** The panel reads the tender's words, so an annex the tender calls 「별첨」 is
not 「부록」 in the proposal answering it, and its parts are numbered the way the tender
numbers attachments. Whatever the naming, the references need a check of their own: a
letter or a number survives a reordering of the annex, a source number survives the row
being deleted, a board frame id survives the board it named being left out, and the build
reports none of it. Read each reference against the annex's own inventory (the import
order, the bibliography's rows, the capture numbers, the frame index) over the body, the
manuscripts and the slides. One document carried seven such breaks, two of them numbering
gaps and two of them appendix letters three reorderings stale.

**An evidence number that indexes files outside the document is a reference to nothing.**
A document that carries 「[증빙 3]」 through its body and an index page resolving 증빙 3 to
a JUnit XML has given the panel a number, a name and no way to open either. Point each
claim at the material the document itself carries - the board annex, the capture annex,
the section that holds the table - and where nothing in it answers the reference, drop the
reference and keep the sentence: the claim stands on its own, and the file is submitted
separately if it is submitted at all. The index page goes with the numbers; any rule it
carried alone moves to a page that remains.

**A capture's provenance is a record for the authors, not a line on the page.** A 「출처」
that names the capture run, the board frame id and the capture file points at nothing the
panel can open, and the run name is already on the claim's badge. Keep the citation in the
manuscript, where it is the traceability record, and give the page the claim with the run
as its label. A sentence inside such a line that is not provenance - how a representative
device was chosen, what the capture does not show - moves into the body it belongs to
rather than disappearing with it. A delivered artifact may be named without making it a
prerequisite for understanding the document.

**A cross-reference into another document names its chapter and section, never its page.**
The other document is still being written, and a page added anywhere before the target
moves every reference after it; a chapter number and a section name survive a
repagination and go stale only when the section is renamed or dropped, which is exactly
when a check should fail. Carry the section name, not the chapter number alone: a chapter
number on its own can point seven references at one long span.

## A wording-only pass changes wording and nothing else

When the user excludes diagrams and layout, review and edit only the existing text and
speaker notes, in their full context. Do not edit or regenerate diagrams, including their
labels; do not alter template structure, styles, geometry, image placement, order or
count. Literal text stored in a template remains in copy scope. Explain necessary
qualifications in the existing prose or notes. Verify text fit by rendering, and resolve
any new overflow by rewording within the existing text slots. Record pre-existing
diagnostics separately; they do not authorize layout work. This scope takes precedence
over every layout checklist.

Before closing such a pass, compare the source changes against the starting version: only
text and notes changed.

## Reviewing the document as its evaluators

A document written for a panel is reviewed by a mock panel - independent evaluator
personas, the panel's own rubric, consensus, source revisions, rendered verification,
repeated full rounds. [references/persona-review.md](references/persona-review.md) is the
workflow's shape; a project that has written its own review prompt is canonical for its
own document, and authoring or explaining that prompt does not start a review.

If the user explicitly asks to stop after applying the current consensus, finish that
round's independent reviews, reconcile the findings, apply its agreed changes, and run the
required render and verification. Then stop without starting another full round. Record
the user's limit in the run's basis and report completion of the requested round only; do
not claim the default consecutive-round completion criterion was met. Keep missing
evidence and unresolved decisions visible in the result.

## Before the copy is done

1. Every scored item and every requirement appears where it is answered, in the panel's
   own words, and no page carries an identifier it does not answer.
2. No claim reports pending work as complete, and no number appears without its source,
   meaning and unit.
3. One term, one value and one milestone across the manuscript, the typesetting source,
   every generated figure and the speaker notes.
4. Every reference resolves inside the submission, and the annex is called what the
   tender calls it.
5. Enumerations are checked in the manuscript, the typesetting source and the rendered
   page; independent items are not buried in a long paragraph.
6. The controlled-language questions in
   [references/controlled-language.md](references/controlled-language.md) are answered.
7. The Korean audit of `simplecore:korean-docs` reports zero errors over the document's
   own sources.
8. For a wording-only pass, the diff carries text and notes and nothing else.
