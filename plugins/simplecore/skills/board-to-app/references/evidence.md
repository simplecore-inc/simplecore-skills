# The run record a chapter closes on

**The grounds a chapter closed on live in `evidenceDir`, and `journeyCommand` writes them.** One
record per chapter, and the captures the record shows sit in a folder of the same name beside it.
The record is the residue of running the chapter's journeys - one row per journey with its
persona, its test and its result, one capture per screen-state a journey visited - and **nothing
in it is written by hand.** A record written first and then made true inverts the whole
arrangement; a record edited afterwards records a run that did not happen.

**A chapter closes because its journeys pass, and the record lets somebody who was not there open
one file and read which persona finished which piece of work, and look at the screens as they
were.** The reading that stays with a person is the look - one per screen-state, at the close →
below.

This file is the specification. A project keeps its own worked examples and its own tooling
commands in the index of its own evidence folder.

## Why not one of the other three folders

| Not here | Why |
| --- | --- |
| `chapterDir` | the generator owns it - a result written there disappears at the next generation |
| the tracking folder | progress lives there. A result is not progress; it is the grounds for a chapter being in the state it is in, and which chapter is open is written in the state ledger alone |
| `capturesDir` | untracked. It holds what one session swept and threw away, so nobody can open it once that session ends |

## The file name

The chapter file's own name. The run record for `<chapterDir>/<chapter-file>.md` is
`<evidenceDir>/<chapter-file>.md`, and the captures that record shows sit in
`<evidenceDir>/<chapter-file>/`. This holds as chapters are added, so a project's document index
carries one row for the folder rather than one per chapter.

**A capture is named after the frame it shows, lower-cased**: `<frame id>.webp`, where the id is one
letter, a hyphen, two or more digits and the state letter where the frame has one (`f-01a.webp`). A
pane of the frame's tab strip adds `-t<n>` (`a-17-t3.webp`), and the two states navigation cannot
reach add `-empty` or `-error` (`a-17-empty.webp`). `.webp` is the only format; a name outside this
grammar is no capture to any check here. The record shows each capture as a markdown image whose
path starts with the record's folder - `![F-01a](<chapter-file>/f-01a.webp)` - and that image is
what `everyPlacedFrameIsCaptured` counts.


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
past; `evidenceSaysWhereItCameFrom` holds the provenance line. The capture-shape gates - width,
scheme, density - read the pictures themselves → *What the checks judge*, below.

**The result words are `pass`, `fail` and `skipped`, written by the command.** A `fail` row is a
chapter that is not closed; a `skipped` row names, after the word, the parked line that releases
it, and a skip naming nothing is a fail.

## One look per screen-state, and one round

**The record proves the journeys; it cannot prove the screen holds up.** So the coordinator opens
every capture once at the close, as the persona whose work the screen carries, and asks three
questions of each picture - and the third is the one that fails:

- **Is this the frame it is named after?** A swallowed deep link leaves the previous screen, and
  `noTwoCapturesAreTheSamePicture` reports a state frame that came back as its base.
- **Is the screen in it built, or is it the shell?** Rows, values, content - look for what should
  be there and is not.
- **Does it hold up as a screen?** A label cut at an edge, a control nobody can see, a font with no
  glyph, the longest language overflowing.

**Then the captures are read once more, together**, for one thing named two ways across the
chapter's screens - the language reader's reading, which no single capture can show →
`judging-frames.md` § *The lenses every screen is judged through*.

**What the look finds is fixed in one round**: fix, run `journeyCommand` again, look again at the
screens the fixes reached and one screen they did not. What is still open after that round is
written to the open items with the frame id and what it needs; a third round is a new chapter's
work or the owner's decision to end this one → `../SKILL.md` § *The product's owner can end a
chapter*.

**Data is never a reason to look again.** A seed that changed, a count that moved, a name that is
different - the journeys assert relations, so a re-run answers all of that, and the capture it
leaves is the one to look at. A structural change is a reason: a state added, a control moved, a
way between screens redrawn - and the journey that reaches it is what changed, so the run reaches
it too.

## Captures that are not tracked

A journey test writes its captures straight into the chapter's folder under `evidenceDir`, and the
record shows them. Everything else - a sweep for the visual pass, a picture shown to a person -
goes to `capturesDir`, which is untracked and named one way → `driving-the-product.md` § *What to
keep, and what to show a person*.

## What is not written here

| Not this | Where it goes |
| --- | --- |
| which chapter is open and what is left | the state ledger |
| what a person has to decide before it can proceed | the open-items file |
| the date a chapter closed | the ledger's own column |
| how many attempts it took, what was different at first | the commit body |
| an assessment of the quality of the work | nowhere - it is reported in conversation |

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

**Where a journey was added there is one answer - that chapter is not closed.** Put its state back to
open in the ledger and name the newly placed frame among what is left. There is no path where the
screen is absent and the record is filled in, and it is not an open-items entry either: that file
holds what waits on a person, and here nothing is waiting - the screen has simply not been built.

**Every other journey stays green.** What grew is the new frame's journey, so that test is written
and the command runs - and running it runs the others too, which costs nothing and proves nothing
moved under them.


## What the checks judge

`closedChapterHasAJourneyRun` judges: that a chapter the ledger marks closed has a record; that
the record carries a row for every journey the chapter names - matched by number and persona, the
journeys read off their `### <n>. <persona> - <title>` headings (`demands.md` § *The headings the
checks read*) - and that every row reads `pass`, or `skipped` with the parked line that releases
it. **Every finding of it is a defect.**

`everyPlacedFrameIsCaptured` judges that the record shows a capture of every frame the chapter
places, the frames read off the chapter's `## <n>. <frame id>` headings. A frame drawn on top of
another is covered by its base's picture, and a shared pattern - drawn inside other screens, with
no address of its own - owes none. A frame no journey visited is a screen nobody opened, and the
answer is a journey that reaches it, never a picture taken outside one.

`evidenceKeepsPaceWithItsCaptures` judges an open chapter too: captures in its folder with no
record beside them are a run `journeyCommand` did not finish. It is **a warning**, because a run in
progress holds the same state until it ends, and its answer is the command, never a record
written by hand.

`journeyTestsDriveTheApplication` judges the tests rather than the record: a journey test that
names the frame route is driving pictures, not the product → `demands.md` § *A journey is walked
in the running application*.

**The capture-shape gates judge the picture rather than the record.** `everyCaptureIsAtADeclaredWidth`
opens every capture in the folder as bytes, reads the canvas out of its header, and reports a width
the project did not declare in `captureStandard` - and a file whose header will not open at all,
because a driver's own screenshot filed under the capture suffix without being encoded passes
every check that reads only a name. **The width is all a file remembers.**
`everyCaptureIsInTheDeclaredScheme` decodes each capture small and reads its luma against the
declared scheme, as a warning while a backlog stands. `everyCaptureIsDenserThanAnEmptyCanvas` holds
a capture's bytes against the canvas its header states, and it is **a warning**: a shot taken before
the page painted is a white rectangle whose name parses and whose width is right, and density -
bytes per megapixel - does not move with quality or pixel ratio where an absolute count does. Its
answer is 「open this one」, never re-encoding the picture larger, which clears the floor for this
capture and hides the next one that really is blank.

**A project's own check can repeat the frame judgment one layer under the tabs**, reading the
board's tab strips and asking, for each frame a closed chapter opens, whether every pane but the
open one was photographed - and the other direction too: a picture named for a pane the board does
not draw, a second name for the pane already open, a pane picture on a frame with no strip.

**What stays with eyes** is whether the screen in the capture holds up, and whether the seed the
journeys ran on came into being by the product's own path → `checks-and-eyes.md`, the *Held by
eyes* table. **The project names whose eyes and at which moment** in the index of its own evidence
folder, because that is a staffing decision. The reader is never the party that produced what is
read: the agent whose journey took a capture knows what the screen was supposed to hold, so it
reads the picture for confirmation rather than for what is missing.

## Measuring what a generator change moves on another board

**What a generator change will move on another board is measured before it lands, in a copy.** A change to the
generator, a placement file or the build config is read against every board it reaches by
generating into a throwaway `git worktree` at the commit the chapters were last generated from:
copy the changed files in, link the board's `.kit`, generate, `git diff --stat` that board's
chapters against the commit, remove the worktree. No tree anybody is working in is touched, and
the diff is what the other board's next regeneration will change, journey by journey. Generate twice to
separate the fix's share from board drift - once with the committed generator, which shows the
lines the board moved on its own since the chapters were written, and once with the changed one;
what differs between the two runs is the fix. A line that moved on its own is the board's
change whichever fix lands, and it is found here rather than after regenerating, when the first
minutes go to blaming the fix for it.
