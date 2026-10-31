---
name: bid-proposal
description: Use when starting a Korean bid from an issued tender, resuming one from its ledger, asking where a bid stands, running a whole-document pass over a bid (Korean and terms, the evaluator panel, cross-document agreement), or taking up a bid's presentation deck, quantitative volume, expected Q&A or submission package. Not for one sentence or one figure fixed on its own, and not for work on the SlideGlance editor itself. Triggers - 입찰 착수, 새 제안서, 제안서 작성 시작, 제안서 이어서, 제안서 진행, 현재 상태, 원고 작성, 발표본 작성, 계량 제안서, 예상 질의응답, 제출물 패키지, 전체 검토, 전체 교정.
---

# Bid proposal

## Purpose

Take one bid from the issued tender to a submitted package, asking the user once at kickoff
and showing each chapter only after it has passed its own checks.

## When to use

- A tender has been issued and the repository for it is empty or nearly so.
- A session opens on a bid already under way: read the ledger and continue from its next step.
  「현재 상태는?」 is answered from the ledger, never from memory.
- A whole-document pass is wanted: Korean and terms, the evaluator panel, cross-document agreement.
- The presentation deck, the quantitative volume, the expected Q&A or the submission package is next.

Not for one sentence or one figure fixed on its own (load the standard skill for it directly),
and not for work on the SlideGlance editor itself.

## Inputs

| Input | Where |
| --- | --- |
| Tender as issued: 제안요청서, 입찰공고문, 평가항목 및 배점표, 작성요령, forms | `rfp/` in the bid repository, originals untouched, the Markdown transcription beside them |
| User settings: where the company folder is, which bid is the reference bid, which earlier bids may be read | `~/.claude/bid-proposal.json` (`companyDir`, `referenceBid`, `earlierBids`). Never written into this skill: the reference bid moves forward with every bid |
| Company and staff facts: overview, credit rating, founding date, track record, staff careers, owned assets and tools, certificates, logo | the folder `companyDir` names, a private repository, never the public skill repository. Who bids and who is staffed differs per bid and may be undecided until late |
| Facts the user gives in chat | written into the ledger in the same turn |
| Ledger | `.claude/proposal-ledger.md` in the bid repository |
| Check configuration: manuscript, tender, requirement, scoring and budget keys, figure boards and placement scale | `.claude/slide-decks.json` in the bid repository, the one owner of the boards and the scale (`proposal-writing` references/config.md) |
| Term standard | `.claude/GLOSSARY.md` and `.claude/l10n.json` in the bid repository |
| Figure set: output folder, type ladder | `.claude/document-figures.json` in the bid repository, read by the figure library in `svg-diagrams/scripts/docfigures/`, whose `boards` and `placeScale` name the deck's `figures.boards` · `figures.placeScale` in `.claude/slide-decks.json` with `{from, key}` |
| Shared checks | `proposal-writing/scripts/`, each run directly. A bid keeps only its own checks and baselines (`checks.baselines`) |
| Reference bid: the standard for conventions, page ids, figure numbering, manuscript form | the repository `referenceBid` names, written into the ledger at kickoff |
| Earlier bids, reference only; where one differs from the reference bid, the reference bid wins | the repositories `earlierBids` lists |

A path to another skill's files in this skill (`proposal-writing/scripts/`,
`svg-diagrams/scripts/docfigures/`) is relative to the plugin's skills directory,
`${CLAUDE_PLUGIN_ROOT}/skills`.

The ledger is English and holds, in this order: bid facts with the tender clause each came from;
the kickoff answers; assumptions decided by recommendation; the open list (every 「(미정: …)」 in
the documents); rules the user gave during the bid; and one row per step below with its status
and the next action. It is a working file, so it carries state; the documents never do.

Another bid's tender-specific content is never copied. A competitor's proposal is never a source.
When `~/.claude/bid-proposal.json` is missing, ask for `companyDir` and `referenceBid` before
step 1, in one message, and write the file: step 1 follows the reference bid's setup and step 5
reads the company folder, so the step 8 question comes too late for them. Every other kickoff
question waits for step 8. When the company folder does not exist yet, create its folders
(overview, staff, assets, evidence, logo) empty, tell the user what to fill, and carry on with
「(미정: …)」.

## Steps

**Kickoff**

1. Set up the bid folder: tender, manuscript, figures, ledger, glossary, and the two
   settings files the shared checks and the figure drawing library read, started from the
   samples the skills ship. Nothing tender-specific is copied from an earlier bid.
2. Copy the tender into Markdown word for word, split and indexed as `proposal-writing`'s
   references/rfp-transcription.md sets out, with the requirement digest the id checks read.
   Leave nothing out; describe every picture.
3. Read out of the tender, with the clause for each: the scoring table, the page limit, the
   presentation time and slide limit, the blind-evaluation rules, the writing instructions, the
   forms, the file names and size limits for submission. Write them into the ledger.
4. Work out the score: the technical and price weights, the price formula, and which evaluation
   items decide the bid.
5. Read the company folder and list what this bid needs that it does not hold.
6. Draft the page plan: pages per chapter from the points and the amount of requirements, and
   every requirement placed on a page.
7. Draft the main claims, the strengths, and several candidate extra proposals.
8. Ask the user once, in one message: the main claims and strengths, which extra proposals to
   keep, the pages per chapter, and what from step 5 only they can supply. After this, do not
   ask again until the end.

**Manuscript**

9. Make one file per page: page id, title, the requirement numbers and points it answers, and
   where its content comes from.
10. Write every page in full at about one and a half times its page share, with a plan for each
    figure it needs and a source for each number.
11. Draw the figures.
12. When screens are asked for or scored, draw them as wireframes and attach them as an annex,
    each frame placed as its own cropped image.
13. Write the evidence annex: the tests done before the bid, their conditions, measured results
    and limits.
14. Cut the manuscript to about 1.1 times the page budget. Compare every cut with the text before
    it, so nothing that answers a requirement is lost.
15. Review the manuscript: Korean and terms, the evaluator panel, and sentences that claim a
    result with no evidence. Fix and review again until the panel has no serious or moderate finding.

**Presentation, quantitative volume, Q&A**

16. Build the presentation from the finished proposal, in the order of the scoring table,
    with a script for every slide.
17. Put the quantitative volume together: cover, contents, and the supplied PDF pages unchanged.
18. Write the expected questions with short answers.

**Submission**

19. Fill what the ledger still lists as undecided, or show the user that list.
20. Build the original and evaluation copies as PowerPoint and PDF with the names and folders the
    tender asks for, under its size limits, and open each PowerPoint file to see that it opens without a repair prompt.
21. Commit and push.
22. Make this bid the reference bid for the next one: set `referenceBid` in
    `~/.claude/bid-proposal.json` to this repository and move the previous one into `earlierBids`.

## Decisions

**Asking and reporting**

- If a decision concerns the main claims, the extra proposals or the pages per chapter, it goes
  into the step 8 question. Every other decision is made by the recommendation, written into the
  ledger as an assumption, and reported at the end.
- If a fact about the bidder or the staff is not decided, write 「(미정: <what>)」 where it belongs,
  add it to the open list, and keep writing. Never invent a name, a career or a number to fill it.
- If the user asks a question mid-task, answer it and carry on with the work in the same turn.
- If the user takes a design over (「내가 진행할께」, 「여기에서 멈춰」), stop touching it.
- Open every step with one line naming what is being settled and what it is for; send short
  progress notes while it runs; close a chapter or a pass with what was checked and what changed,
  quoting the counts the checks printed.

**Source and agreement**

- If the proposal document changes, the manuscript changes in the same commit.
- If the presentation needs content, take it from the proposal document, never from the manuscript.
- If a fact appears in several places (proposal, presentation, annex, figure, wireframe screen,
  script, Q&A), change every one together, and search each tree, figure generators and board
  screen files included, for the old and the new wording.
- If a scope item is dropped, remove every reference to it.
- If a page or figure is cited, cite it by id and name (「Ⅳ-1 15 외부 장치 요청 처리」,
  「그림 Ⅳ-2-1 …」); the presentation cites the proposal by chapter and section name, never by
  page number.

**Content**

- The tender's terms come before ours, and requirement names are copied verbatim (`proposal-writing`).
  「원문」 alone is never written: a citation names the clause, the article, or the requirement id
  and its issued name (`proposal-writing`, 「Every external basis is named where the claim is made」).
- If pages or a manuscript are asked for, write the full pages, never a summary or a plan of them.
- If a claim cannot be proven (track record, a certificate), leave it out; state the field of work only.
- If the tender is blind-evaluated, the evaluation copy carries no company name, staff name, logo
  or wording that identifies the bidder, and staff experience is given without full project names.
- If something is mandatory or customary, it is not an extra proposal.
- If a capability depends on a condition, write it as prepared and ready, never as a promise, and
  drop columns that read as one (「본 사업 적용」).
- If a past problem of the client (an audit) motivates a requirement, frame the work as carrying out
  the client's own requirement, never as blame, and never cite press reports.
- If something already built answers a requirement, show the real screen labelled 「제안사 구현
  사례」 with the relevant area marked, rather than a description.
- Screens and features carry only what the tender or the user asked for, and a draft requirement the
  user wrote is the user's, never the client's.
- The register is `proposal-writing`'s: 합니다체 in the page-head description (`sub`) and the
  part-divider lede and nowhere else, -다체 in the body and the judgment cells, noun phrases in
  titles, labels and captions. The description and the lede state the proposer's claim and what
  the client gains, never how the page is organised.
- Copy never counts items, never sets a bare abbreviation list, and
  never contains an em dash; a count reported anywhere else is computed, never typed.

**Presentation script**

- The script is heard, not read: it is understood
  without the screen, in the screen's order and its printed words, numbers and English terms
  written as they are read, compounds unpacked, and timed at the rate measured by reading it
  aloud. Mark the script as spoken so the transliteration bans stand down there
  ([`korean-docs`, 「A speaker script - `l10n:spoken`」](../korean-docs/references/audit-tooling.md#a-speaker-script---l10nspoken)).

**Numbers and evidence**

- The proposer's own test figures follow `proposal-writing` (「What the document may claim」): printed
  only in the annex, with their conditions and limits, and spoken in the script only where the user
  has allowed it.
- If a number has no source, cite one or remove it.
- Figures from the tender and the client are used as given.

**Figures**

- If the claim is a structure, a flow, a sequence of steps, a relationship or a comparison, draw
  it. If prose, a list or a table proves it more directly, do not. A figure that only re-lists
  requirements is never drawn.
- Before writing text onto a page, check whether a figure already says it.
- Edit the generator, never the picture. No legend along the bottom; every arrow has a target;
  labels are noun phrases.
- Place every figure at the `figures.placeScale` declared in `.claude/slide-decks.json`; a page
  that cannot hold it is split or condensed, never given a smaller figure.
- A figure or an annex part the task did not name is never changed.
- One generator and one output folder hold every figure.

**Copy passes**

These are the bid's copy pass when the user names no exclusion. When the user excludes diagrams or
layout, the pass runs under `proposal-writing`'s wording-only scope instead, which takes
precedence over these.

- Allowed: lengthening where meaning was lost, as long as nothing overflows; enlarging boxes and
  margins; changing figure text in the generator; changing a figure's shape when the new wording no
  longer fits it, reporting each such figure.
- Not allowed: reordering or merging pages, redesigning a figure whose wording fits.
- Figure text and wireframe screen copy are in scope.
- Read the whole page with its figures before changing a sentence; judge by meaning, not by pattern.
- If an awkward word is replaced, search every tree for it and its family in the same pass.

**Review**

- The bid's review prompt (`review.prompt` in `.claude/slide-decks.json`) carries the panel, the
  grades, the stop rule and the record rules below; `proposal-writing`'s
  references/persona-review.md carries the rest of the workflow, and a prompt overrides its
  defaults by its own rule.
- Panel: three client evaluators, two external evaluators, a typesetting expert and a requirements
  engineer; the presentation adds a speech coach and an announcer. One agent per persona, in parallel.
- Findings go to a file, graded 상·중·하. Fix every 상 and 중, apply the 하 once, and review again.
  Stop when no 상 or 중 is left; delete a round's files once the next round has read them (the next round checks each finding against them), and the last round's once it is applied.
- If the same finding returns in two rounds, write a check that finds it and fix everything it finds.
- Every check names the trees it reads (a summary folder, the chapter files, the manuscript) and is
  proven on a known defect before it is trusted.
- Before reporting a pass complete, run the check that proves it covered everything (every page
  id, every figure, every board screen) and quote its count.

**Running long**

- Update the ledger at every step: status, next action, open list, assumptions, the user's rules.
- Chapters that do not depend on each other go to separate agents, one fresh agent per chapter.
  Without subagents (Codex), run them one after another in the same order.
- A rule the user gives is written into the skill that owns its subject or the bid repository's
  instruction file in the same change.
**Which standard to load**

| Work | Skill |
| --- | --- |
| Tender transcription, claims, enumerations, evaluator review | `proposal-writing` |
| Korean copy and terms | `korean-docs` in Claude Code; in Codex, the Korean standard Codex has installed, never Claude Code's audit hook |
| Figures | `svg-diagrams` |
| Typesetting | the bid repository's own typesetting skill |
| Many judgments by meaning (claims without evidence, figure text) | Jev first pass, each flagged item confirmed by reading it |

## Definition of done

A chapter is done when:

- every page has been written in full against its requirements and points;
- the `proposal-writing` checks that apply pass, and the figure checks of
  `svg-diagrams/scripts/docfigures/` pass;
- the manuscript matches the proposal document.

The bid is done when, in addition:

- every scoring item and every requirement number is on a page of the proposal, and every scoring
  item is on a slide of the presentation, shown by a check's count;
- the figure checks pass, and the Korean audit (`sweep` of `korean-docs`) reports zero errors over
  the bid's sources;
- the panel's last round has no 상 or 중;
- schedules, figures, requirement numbers and page citations agree across proposal, presentation,
  annexes, figures, script and Q&A;
- no own-test figure is printed outside the annex or spoken in the script without the user's leave,
  and every number has a source;
- the evaluation copy meets the blind-evaluation rules, its document properties included
  (the creator, last-saver and author fields are cleared and read back);
- the open list is empty, or the user has seen what remains on it;
- the package has the tender's names and folders, stays under its size limits, exports to PDF, and
  every PowerPoint file opens without a repair prompt;
- everything is committed and pushed.

## Exceptions

What happened in the earlier bids behind the rules above is in
[references/earlier-bids.md](references/earlier-bids.md), grouped as the Decisions are. Read it at
kickoff and before a whole-document pass.
