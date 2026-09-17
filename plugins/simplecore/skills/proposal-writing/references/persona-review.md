# Reviewing a deck as its evaluators

A deck written for a panel is reviewed by a mock panel before it ships: several
independent evaluator personas score it against the panel's own rubric, their findings
are consolidated into an agreed change list, the changes are made at the source and
verified in the render, and the whole review is run again on the new version until two
consecutive full rounds accept it. **The project's review prompt (`review.prompt` in
`.claude/slide-decks.json`) is the canonical text for its deck - its personas, rubric,
reading list, record layout and stopping rules override anything here.** This file is
the shape of the workflow, so a project without a prompt can write one, and so a reviewer
knows what the prompt has to settle.

## What a prompt settles

- **Invocation and scope.** What request starts a review; that authoring or explaining
  the prompt does not; the default scope (the whole deck - cover, contents, dividers,
  body, annexes, figures, captures, speaker notes) and how a narrower scope is reported
  (as partial, never as complete); a review-only mode that scores and agrees but changes
  nothing, rendering from a scratch copy so generated files stay untouched.
- **What to read first.** The project's instruction files, its Korean style guide and
  glossary, this skill and the deck's own instructions, the rubric's source (the RFP or
  the evaluation sheet), the manuscript's page budget and figure list, the requirements
  and their compliance record, the evidence index. Every reviewer reads the same
  version and the same rules.
- **The rubric.** Item names, weights, grade definitions and the conversion, taken from
  the source and quoted with its page; how an unverifiable item is marked (「미확인」 with
  its weight set apart); that the reviewers' scores and the agreed score are kept
  separately and an average is labelled as an internal mock average; that no design
  score is added outside the official sheet, while visual consistency and expressive
  variety are each judged 충족·보완·미확인 with page evidence.
- **The personas.** Five is the working number: a domain evaluator who asks whether the
  rubric is answered, a requirements engineer who asks whether each requirement states
  input, actor, condition, normal and exceptional behaviour, output, verification and
  pass criterion, an architecture and operations engineer who asks whether the technical
  claims are feasible and consistent, a typesetting and Korean-editing expert who reads
  the pages at print size, and an information-design expert who judges the figures and
  the reading rhythm. All five review every item and every page; the specialism sets the
  depth. None is presented as a real external expert.
- **Every reviewer opens the figures at full size, and the brief has to say so.** A
  figure's smallest label prints at a few points; in a rendered page it is a grey shape,
  and a reviewer who reads it there and moves on has not reviewed it while believing they
  have. One round left three real defects inside figures - a count printed nowhere else, a
  role name outside the four the tender defines, and evidence numbers pointing at an index
  that did not exist - and none of the five evaluators found any of them, because the
  brief listed the rendered pages and not the figure sources. Name the source directories
  in the reading list, require each printed string to be checked against the requirement
  text and the slide beside it, and treat a figure nobody opened as unreviewed. This
  matters most where a revision round has moved argument out of prose and into drawings:
  the deck gets better and the review gets blinder at the same time.
- **Independence.** Reviewers get the version, the rubric, the reading list, their role
  and the common instruction; not each other's scores, not the coordinator's expected
  score, not the previous round's consensus. They change nothing. One report each, in
  the record directory. Where independent subagents are unavailable, sequential role
  simulation is recorded as such with its limit named. Invoking the review is the
  request for those subagents.
- **One finding's record**: an identifier (round, reviewer, sequence, and the earlier
  identifier when a defect recurs); the location (source file, page block, title,
  rendered slide, printed page, image path, figure id); the observation and its rubric
  basis; the scoring effect (item, weight, grade, points) or 「정성 의견」; the severity
  (필수 수정 · 개선 권고 · 취향 대안) with its reason; the proposed change, what to keep,
  and how to verify it.

## One round

1. **Same version.** Fix the run id and the round directory; record the commit and the
   uncommitted state; render from the latest source and keep the log; hash the inputs
   before and after the render and re-render if they moved; list every file and image
   reviewed, the page order from the deck's import list, and the figure and item lists,
   in `basis.md`.
2. **One ledger, generated.** Build the slide ledger every persona reads from the deck's
   own import order rather than by hand: one entry per page with its title, template,
   evaluation item, requirement ids, figures, captures, render path, printed claim line
   and speaker note in full, and the script's syllable count and speaking time in the
   head. A round that hand-writes this file starts from a ledger that has already stopped
   matching the deck, and five personas then cite page numbers the panel will not see.
   Keep the generator in the deck's own `tools/`, beside the checks.
3. **Independent review.** Hand each persona the same package and a report path. Each
   reads the manuscript, the figures, the sources and every page PNG, chapter by chapter,
   and writes its report - the rubric table, the findings, what to keep, alternatives,
   the two qualitative verdicts, and what it could not verify. `coverage.md` records
   what each reviewer actually opened; a completion notice is not evidence.
4. **Consolidation.** Group findings by cause, keeping every reviewer's original words
   and identifier; separate majority, minority and conflicting alternatives; never sum a
   duplicate twice. Order by rubric violation, factual error, missing evidence and
   misreading first, then by the points at risk and the pages affected. Settle
   disagreements against the source text, the evidence, the project's settled rules and
   the actual render - never by vote or by title. Where two layouts compete, render both
   and compare reading order, print legibility, information loss and repetition against
   the neighbours. Write `consensus.md`: adopted, adopted with an alternative, rejected or
   held, with reasons, and for every adopted change the final wording and layout, the
   files, the ripple and the verification. Circulate it to all five; unresolved
   disagreement stays unresolved and is never marked unanimous.
5. **The brief that dispatches an applier is copied out of the decision file.** It
   carries the adopted set and nothing else. A list assembled from the reviewers' own
   reports instead carries whatever each reviewer proposed, rejections included, because
   a reviewer's report does not say which of its proposals lost; a list assembled from
   memory of the agenda does the same. Open `consensus.md`, copy the adopted ids, and
   check every id in the brief against the rejected list as well, because an id whose
   wording sounds right is exactly the one that gets through. One dispatch of five briefs
   named two rejected items as adopted, and the coordinator had already written one of
   them into the project's format rules before any applier saw it. That last part is the
   half nobody downstream catches: an applier reading a rules file takes the rule as
   settled, so a rule added from the same list is checked before it is written, not after.
6. **A ruling is written into the rules file, and the message points at it.** A decision
   sent as a message is a decision several agents hold different versions of: they are
   mid-edit when it arrives, their reports cross it, and a coordinator who changes its
   mind sends a second message that overtakes the first in some inboxes and not others.
   One review settled an annotation-label set three times in an hour and four chapters
   ended the hour in three different states, each obeying the last message it happened to
   receive. Write the ruling into the file every applier reads, say in the message that
   the file is what changed, and tell them the file wins over any message that disagrees
   with it - including a later one. And **a reversal is the coordinator's to justify, not
   to distribute**: when an applier's own pages argue against a ruling, weigh it before
   sending, because the applier who was right has already paid for the first change.
7. **Apply and verify.** Edit the source of truth first (the manuscript, then the design
   and requirement records, then the figure modules, then the chapter files), never a
   generated file. **That order is a sequence, not a list - and when the work is split
   across people or agents, only one stage runs at a time.** A figure's height is the
   chapter's input and the chapter is the render's input, so a figure pass running beside
   a layout pass makes the layout pass fit columns to drawings that are about to change
   size; the fitter's work is thrown away and the render's error count says nothing about
   either. Two rounds of one project lost an hour each to exactly this - once with two
   agents editing the same chapter files, once with a figure pass and a chapter pass in
   parallel - and both times the diagnosis came from whoever read the render first rather
   than from the coordinator who dispatched them. Before dispatching, name what each piece
   of work consumes and what it produces; where one consumes the other's output, they are
   sequential. The string layer is the exception worth knowing: wording, terminology and
   register changes move no figure, so they can run while the figures are being redrawn -
   and content the panel scores goes in before the layout is fitted around it, never
   after. A change to a design decision or the contracted scope goes to the
   design owner with the evidence before it is made; routine wording and layout changes
   agreed in consensus are made without a second permission. Re-render; check the changed
   pages, their neighbours and every page that shares a changed template; record
   `changes.md` (consensus id → files → new page mapping → evidence) and `validation.md`
   (every command, exit code, scope, and which images were read). Run every check the
   deck declares; never relax a check or a baseline to make a failure disappear.
8. **Full re-review.** A new round directory, new reviewer agents with no history, the
   same rubric; the previous findings are handed over only after the new verdicts are
   in, to check recurrence, omission and side effects.

## Completion and stopping

Two consecutive full rounds with no adopted change close the review, and only when
every reviewer covered every page, figure and item; no adopted change and no essential
evidence is outstanding; every reviewer marks content, visual consistency and
expressive variety 충족; the render and every declared check pass; and the agreed text,
the manuscript, the figures and the deck agree. A full score is not completion.

Stop with 「미완료·판단 필요」 when two consecutive change rounds make no progress on the
same defect, when the user stops it, when a limit is reached, or when material or the
render tool is missing - and write `resume.md`: the last verified version, what was not
reviewed, what was agreed and not applied, and where to start next, with concrete
options and a recommendation for anything that needs the user's decision.

Records live under `review.records/<run id>/round-NN/`; a later run reads earlier
records as prior decisions and open questions, never as current verdicts.

## What the rounds keep finding, and what to check before starting one

Four rounds on one deck produced the same five shapes of defect, in this order of
frequency. A round that starts by checking them costs a fraction of a round that
discovers them.

- **A number that disagrees with itself.** The same count printed one way and spoken
  another (61 requirements printed, 60 spoken), a table's total that does not add up,
  a week in the gantt that the table contradicts. Grep every figure and note for each
  headline number before dispatching the personas; the reviewers will find the rest.
- **A title or a claim line that promises what the script never says.** The panel reads
  「백업 · 복원」 in the title and hears nothing about it. Read each note against its own
  title and sub-line as a pair.
- **A requirement id on the wrong region.** The badge names a card the region does not
  answer, and the requirement's real answer sits on another page with no badge. Check
  the id against the RFP's own text, not against the region's subject.
- **A figure that outlives its slide.** The drawing keeps a structure the prose has
  since corrected - a zone that collects where the proposal says it receives, a colour
  that means a verdict on a word that is not one. Figures are reviewed at source.
- **Time.** Speech plus page turns, at the slow end of the reading range. Two seconds a
  turn is the number that made a 19.6-minute deck read as 21.2.

**Merging pages is a legitimate answer to a timing failure**, and the reviewers will
propose it: two pages that repeat the same six approvals, or an extra-proposal page whose
content already sits in the requirement page beside it, cost a page turn each and buy
nothing. Merge them, and re-derive the contents ranges, the chapter counts (「(1/3)」
becomes 「(1/2)」) and the progress band in the same change.
