# The run record a chapter closes on

**The grounds a chapter closed on live in `evidenceDir`, and `journeyCommand` writes them.** One
record per chapter, and the captures the record shows sit in a folder of the same name beside it.
The record is the residue of running the chapter's journeys — one row per journey with its
persona, its test and its result, one capture per screen-state a journey visited — and **nothing
in it is written by hand.** A record written first and then made true inverts the whole
arrangement; a record edited afterwards records a run that did not happen.

**A chapter closes because its journeys pass, and the record lets somebody who was not there open
one file and read which persona finished which piece of work, and look at the screens as they
were.** The reading that stays with a person is the look — one per screen-state, at the close →
below.

This file is the specification. A project keeps its own worked examples and its own tooling
commands in the index of its own evidence folder.

## Why not one of the other three folders

| Not here | Why |
| --- | --- |
| `chapterDir` | the generator owns it — a result written there disappears at the next generation |
| the tracking folder | progress lives there. A result is not progress; it is the grounds for a chapter being in the state it is in, and which chapter is open is written in the state ledger alone |
| `capturesDir` | untracked. It holds what one session swept and threw away, so nobody can open it once that session ends |

## The file name

The chapter file's own name. The run record for `<chapterDir>/<chapter-file>.md` is
`<evidenceDir>/<chapter-file>.md`, and the captures that record shows sit in
`<evidenceDir>/<chapter-file>/`. This holds as chapters are added, so a project's document index
carries one row for the folder rather than one per chapter.


## The shape of the record

````markdown
# <chapter> — <the project's word for a run record>

<the provenance line the project declares: which build, which boot, which data>

| journey | persona | test | result |
| --- | --- | --- | --- |
| 1 | 본사 담당자 | journeys/13-inventory-base.spec.ts › 재고 조정 | pass |
| 2 | 본부 담당자 | journeys/13-inventory-base.spec.ts › 담당 사업소 밖 거부 | pass |

![F-01a](13-inventory-base/f-01a.webp)
![F-01c](13-inventory-base/f-01c.webp)
````

**The table is what the checks read.** `closedChapterHasAJourneyRun` holds a closed chapter to a
record whose rows cover every journey the chapter names, each reading `pass`; `everyPlacedFrameIsCaptured`
holds it to a capture for every frame the chapter placed; `noTwoCapturesAreTheSamePicture` holds
two captures apart, so a state frame that came back as its base is reported rather than looked
past; `evidenceSaysWhereItCameFrom` holds the provenance line. The capture-shape gates — width,
scheme, density — read the pictures as they always have.

**The result words are `pass`, `fail` and `skipped`, written by the command.** A `fail` row is a
chapter that is not closed; a `skipped` row names, after the word, the parked line that releases
it, and a skip naming nothing is a fail.

## One look per screen-state, and one round

**The record proves the journeys; it cannot prove the screen holds up.** So the coordinator opens
every capture once at the close, as the persona whose work the screen carries, and asks three
questions — is this the frame it is named after, is the screen in it built or the shell, does it
hold up as a screen a person works in → `../SKILL.md` § *Closing a chapter*. Its findings are
fixed in one round: fix, run `journeyCommand` again, look again at the screens the fixes reached
and one they did not. What is still open after that round is written to the open items with the
frame id and what it needs; a third round is a new chapter's work or the owner's decision to end
this one.

**Data is never a reason to look again.** A seed that changed, a count that moved, a name that is
different — the journeys assert relations, so a re-run answers all of that, and the capture it
leaves is the one to look at. A structural change is a reason: a state added, a control moved, a
way between screens redrawn — and the journey that reaches it is what changed, so the run reaches
it too.

## Captures that are not tracked

Everything else a sweep shot stays in `capturesDir` and is untracked. Only what a document shows
moves into `evidenceDir` — a capture left in the folder that no section cites is reported by
`closedChapterHasAJourneyRun`.

## What is not written here

| Not this | Where it goes |
| --- | --- |
| which chapter is open and what is left | the state ledger |
| what a person has to decide before it can proceed | the open-items file |
| the date a chapter closed | the ledger's own column |
| how many attempts it took, what was different at first | the commit body |
| an assessment of the quality of the work | nowhere — it is reported in conversation |

**Present tense, and only what was checked and what was on the screen.** A sentence opening with
"this time", "running it again" or "originally", and a status column, are not the shape of this
document.

## When a closed chapter gains a screen

**A frame the board gains later, belonging to a closed chapter, adds lines to that chapter.** The
record is short a journey and short a capture. `closedChapterHasAJourneyRun` reports the journey and
`everyPlacedFrameIsCaptured` reports the capture.

**Put the journeys the chapter names beside the rows the record holds, and the difference says
which case it is.**

| The difference | What changed | What to do |
| --- | --- | --- |
| a row only the record has | a journey went | the next run drops it |
| a journey only the chapter has | a journey was added | below |
| both | a journey changed | the next run answers the new one |

**Where a journey was added there is one answer — that chapter is not closed.** Put its state back to
open in the ledger and name the newly placed frame among what is left. There is no path where the
screen is absent and the document is filled in, and it is not an open-items entry either: that file
holds what waits on a person, and here nothing is waiting — the screen has simply not been built.

**Every other journey stays green.** What grew is the new frame's journey, so that test is written
and the command runs — and running it runs the others too, which costs nothing and proves nothing
moved under them.


## What the checks judge

`closedChapterHasAJourneyRun` judges: that a chapter the ledger marks closed has a record; that
the record carries a row for every journey the chapter names — matched by number and persona —
and that every row reads `pass`, or `skipped` with the parked line that releases it. **Every
finding of it is a defect.**

`everyPlacedFrameIsCaptured` judges that the record shows a capture for every frame the chapter
placed; a frame drawn on top of another is covered by its base's picture. A frame no journey
visited is a screen nobody opened, and the answer is a journey that reaches it, never a picture
taken outside one.

`journeyTestsDriveTheApplication` judges the tests rather than the record: a journey test that
names the frame route is driving pictures, not the product → `demands.md` § *A journey is walked
in the running application*.

**What stays with eyes** is whether the screen in the capture holds up, and whether the seed the
journeys ran on came into being by the product's own path → `../SKILL.md`'s second table.

## Measuring what a generator change moves on another board

**What a generator change will move on another board is measured before it lands, in a copy.** A change to the
generator, a placement file or the build config is read against every board it reaches by
generating into a throwaway `git worktree` at the commit the chapters were last generated from:
copy the changed files in, link the board's `.kit`, generate, `git diff --stat` that board's
chapters against the commit, remove the worktree. No tree anybody is working in is touched, and
the diff is what the other board's next regeneration will change, journey by journey. Generate twice to
separate the fix's share from board drift — once with the committed generator, which shows the
lines the board moved on its own since the chapters were written, and once with the changed one;
what differs between the two runs is the fix. A line that moved on its own is the board's
change whichever fix lands, and it is found here rather than after regenerating, when the first
minutes go to blaming the fix for it.

## When what a chapter demands of a screen grows

**Re-run the demand that was added, not the section that carried it.** A chapter whose lines gain a
new requirement — a capture per content tab, an empty list, the row actions pressed — does not
thereby invalidate what its sections already recorded. The tiles counted are still the tiles
counted; the dialog's wording is still its wording. What is missing is an answer to the new
sentence, and that is what the run produces.

**So the unit of a re-run is a demand, not a section and never a chapter.** Read the section
against the line, list the sentences the line asks for that the section does not answer, and go get
those. A section that answers every line as it now stands is finished and is not opened.

**The exception is a picture that can no longer be trusted**, which is the row the eyes table
carries: where the code behind that screen moved after the capture was taken, the capture is
evidence of a build that is gone, and the sentences resting on it go with it. That is a different
question from the demand growing, and it is asked separately.

**Say which sections were re-run and which were read and left.** A round that reports 「the chapter
was walked again」 tells nobody whether the untouched sections were judged sufficient or never
looked at, and those two states are what the next reader most needs told apart.

## When a closed chapter gains a screen

**A frame the board gains later, belonging to a closed chapter, adds lines to that chapter.** The
document is short a section and short a capture. `closedChapterHasAJourneyRun` reports the section and
`everyPlacedFrameIsCaptured` reports the capture.

**Put the sections the chapter demands beside the sections the document holds, and the difference
says which case it is.**

| The difference | What changed | What to do |
| --- | --- | --- |
| a section only the document has | the demand shrank | delete the section the chapter does not demand |
| a section only the chapter has | the demand grew | below |
| both | the demand changed | delete what is gone, and treat what is new as below |

**Where the demand grew there is one answer — that chapter is not closed.** Put its state back to
open in the ledger and name the newly placed frame among what is left. There is no path where the
screen is absent and the document is filled in, and it is not an open-items entry either: that file
holds what waits on a person, and here nothing is waiting — the screen has simply not been built.

**Every other section stays closed.** What grew is the new frame's lines, so those lines are run
and that section is written. A section already verified is not run again; the screen it verified
has not moved.

## What the checks judge

`closedChapterHasAJourneyRun` judges: that a chapter the ledger marks closed has a document; that
there is a section per line the chapter demands; that each section carries the three labels and
evidence; that each capture a document shows is on disk with a name, format and size the table
above allows; and that no capture is left in the folder that no section shows. **Every finding of
it is a defect**, which is why the floor under a capture's density is not one of them — that
question is answered 「go and look」 rather than 「this is wrong」, and a gate answers one question.

**It does not tell a capture from a code block.** One capture, one fenced block **or** one
discharge satisfies a section: a fenced block is the right evidence for a line that only proves a
boundary, and a discharge is the right evidence for a pane that is the component the section above
already photographed. So nothing here separates a section written by looking at a screen from one
written out of a run log, and that reading is assigned to eyes.

**`dischargedDemandNamesItsProof` judges the discharge itself.** The line names a capture, that
capture is on disk in this chapter's folder, and this document shows it — a discharge leaning on a
picture nobody can open is a skip wearing a rule's clothes, and it reads in the file exactly like
one that holds. Whether the component is still unbuilt is not in the bytes and stays with eyes.

**`everyCaptureDemandGivesItsReason` judges the chapter rather than the document**, one layer
earlier than everything else here: a clause of a demand line that names a capture and gives no
reason why a picture is the witness for it. It reads `captureReasons` for the words → the reason
itself, and why it belongs in the line, are `references/demands.md` § *A capture is owed where a
picture is the only witness*.

**`everyPlacedFrameIsCaptured` judges the other direction.** Among the frames a closed chapter
places and tells somebody to open, it names by frame id the ones with no capture. **A frame nothing
photographed is a screen nobody opened** — a build has shipped nine screens drawing the shell and
nothing else with a green build and every request answering 200, and the only party who would have
seen it was the party that opened a browser. The ceiling above stops a frame having more than its
panes; this check makes sure it has at least one.

**A shared pattern is not counted.** A frame drawn inside other screens, with no address of its
own, is one nobody is told to open and there is no screen to shoot.

**`everyCaptureIsAtADeclaredWidth` judges the picture rather than the document.** Every capture in
the folder is opened as bytes, its stated canvas is read out of the header, and a width the project
did not declare in `captureStandard` is a finding — as is a file whose header will not open at all.
**Two of the checks here read a byte of a capture and the rest read around it**: the name check
reads a name and the ceiling reads a length, so a driver's own screenshot filed under the capture
suffix without ever being encoded passes both. Nine such files sat in one project's evidence
folder, and the same run's real defect — every capture shot through a window 160 pixels too narrow,
with a tree's first row and an entire panel form below the fold — was invisible in exactly the same
way. **The width is all a file remembers**; the colour scheme and whether the fold ate anything stay
with eyes, and `../SKILL.md`'s second table names whose.

**`everyCaptureIsDenserThanAnEmptyCanvas` is the second, and it is a warning.** It holds a capture's
bytes against the canvas the same header states, because a shot taken before the page painted is
the one defect in an evidence folder that agrees with every other artifact in the run — the name
parses, the width is right, the taker's sentence describes what was on the screen, and the file is
a white rectangle. **Bytes alone cannot ask that question**: encoding quality moves one screen by a
third and a device pixel ratio of two moves it by four, so an absolute count reads a blank 2×-ratio
capture as a fuller screen than a real 1× one. Density does not move — an empty canvas costs about
1,900 bytes per megapixel at any quality and any size, where the sparsest real screen a board draws
costs 3,900 — and the floor sits in the middle of that gap.

**It raises 「open this one」 and claims nothing more.** A capture of a built shell with nothing
inside it passes it and always will; so does a long full-page capture whose lower half is
legitimately empty, and both are answered by a person saying so rather than by widening the number.
**The one answer that is never right is re-encoding the picture larger** — quality moves a real
screen and leaves a blank one where it is, so a bigger file clears the floor for this capture and
hides the next one that really is blank. That is also why the grade is a warning: an error would
leave that as the only route to green.

**A project's own check repeats that judgment one layer under the tabs**, reading the board's tab
strips and asking, for each frame a closed chapter opens, whether every pane but the open one was
photographed — and the other direction too: a picture named for a pane the board does not draw, a
second name for the pane already open, a pane picture on a frame with no strip.

**What stays with eyes over a result document is in `../SKILL.md` § *Closing a chapter*,** which is
the one register of every rule this skill hands to a person — whether the capture shows the frame
it is named after, whether the `saw` line is what was actually there, whether the document was
written out of the verification rather than before it. **The project names whose eyes and at which
moment**, in the index of its own evidence folder, because that is a staffing decision. What
belongs here rather than in either is the reason the reader is never the party that produced what
is read: the agent that took a capture knows what the screen was supposed to hold, so it reads the
picture for confirmation rather than for what is missing.
