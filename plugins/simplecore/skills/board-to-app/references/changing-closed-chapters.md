# Changing what a closed chapter built

Read this before the open chapter changes anything an earlier chapter built, when the board gains
a frame a closed chapter owns, and before verifying a change that reaches many screens.

## Touching a chapter that already closed

Work sometimes has to change something an earlier chapter built - an entity gains a
column, a screen gains a state, a rule turns out to be wrong. **Do not reopen that
chapter and do not edit its file.** A closed chapter is a record of what was true
when it closed; editing it destroys the history this build exists to leave behind.

Instead, in the chapter you are in now:

1. **Write it under the `touchedEarlier` section** - that section is hand-authored and
   the generator preserves it. Name what changed, in which chapter it was built, and
   why.
2. **Find who else uses it, in both directions.** Backwards: which closed chapters
   read this entity or screen - their persona tests must still pass, so re-run the
   ones that touch it. Forwards: **which chapters not yet built already depend on it** -
   the chapter files say so, and a change made without reading them is a change the
   later chapter will have to undo. Adjust once, now, for what is coming.
3. **Say it in the commit**, so the history can be read as a tree: a trailer naming
   this chapter and every chapter the change reaches.

**A change to a closed chapter's code that is not written down is the one thing this
arrangement cannot survive** - the next agent reads a chapter file that no longer
describes the code, believes it, and builds on a fiction.

## A frame the board gains later goes at the END of the closed chapter's list

The one thing that cannot follow the rule above. A new frame belongs to whichever chapter
owns its subject, and that chapter's `creates` section is the only placement declaration
there is - so a frame added after that chapter closed has to be written into a closed
chapter's file after all. **Append it; never insert it in subject order.**

`chapterGenerator` numbers the per-frame sections from that list's order, so a frame
slipped into the middle shifts every section after it by one. Nothing warns, because each
renumbered section is individually correct - what breaks is everything OUTSIDE the file
that cites a section number: a note saying 「§9 is the one that failed」, a review comment, a
plan. One insertion moved twenty-nine
headings at once and turned a clean tree red in a way that read as twenty-nine separate
defects.

Appended, the frame takes the next free number and every earlier section keeps its own.
**Write the reason on the line as a forward rule** - 「a screen added to a closed chapter is
written at the end so the earlier sections keep their numbers」 - so the next person does not
tidy it back into subject order.

**Expect the chapter to stay red on that frame, and say so.** It is placed but not built,
not verified and not captured, and `closedChapterHasAJourneyRun` and `everyPlacedFrameIsCaptured`
say exactly that - what to do about it is `references/evidence.md` § *When a closed chapter gains
a screen*, and the answer there is that the chapter is not closed. That finding is true and is not the placement's fault: clearing it means
building the screen, running its lines and capturing it. **An agent that cannot do those -
no server, no browser, no ledger of its own - reports the finding with its cause rather
than placing the frame somewhere it does not belong to make a gate quiet.**

## A change that reaches many screens is verified by a sample and a census

A shared component gains a prop, a dialog's close button gets a label, a date is formatted one way
everywhere. **Walking forty-five screens in a browser to watch one mechanism work forty-five times
is not verification, it is the same measurement repeated** - and it costs so much that the honest
outcome is that nobody takes it. So the change is verified in two halves, and the second half is
the one that is new:

1. **The sample.** Every screen the change is directly about, in full - and **one** of the rest.
   Then the remaining affected screens are done.
2. **The census.** Count the sites that reach the mechanism and the sites that do not, **by name**.

**The sample half holds because a global change has one mechanism.** If it works on one instance it
works on all of them; they are the same code path. What varies per screen is context, and the
screens the change is directly about are where the context differences live - which is why they are
the ones walked in full and the further one is drawn from the rest.

**What a sample cannot prove is that every site goes through the mechanism.** A dialog that
hand-rolls its own close button is untouched by a fix to the shared dialog component: the mechanism
is sound, that site still says the wrong thing, and no amount of sampling finds it reliably -
sampling looks at instances of the mechanism and this is a site that has none.

**The census is a search, not a browser, and it is cheap.** Run on a real change it read 26 files
through the framework component, zero hand-rolled and zero bypassing, after which one browser check
settled 45 call sites. **How it is searched is the project's** - the import graph, the component
name, the helper - so it is written wherever the project keeps `auditScript`, not here.

**What is here is that a census reports both sides.** 「26 reach it」 and 「26 reach it, 0 do not」
are two different sentences, and only the second says the search looked for the negative - the same
thing `references/checks-and-eyes.md` § *The third category comes back as a checker that did not
run* says of every count in this skill. And where the second number is not zero, **the names are the finding**: 「3 do not reach it」
gives nobody anything to do.

So it goes in the commit, beside the two trailers that are already there, in that order - the count
that reaches the mechanism first, the count that does not second, and its names after them:

```
Chapter: W22
Touches: W11 W12 W17
Census: the shared confirm dialog - 26 through, 2 outside: DocumentPurgeDialog PermitRevokeDialog
```

**The whole line is one line, and the cost of wrapping it is not the census.** The census gate reads the trailer line by line and takes the names after the colon from the same line as the second count, so a list wrapped onto the next line reads as no names at all and the commit is refused for a census that is in fact complete. Two agents met this from different directions on one afternoon: the fix each reached for was to shorten the census, and what was wrong was the wrapping. Write the names on the count's line however long it runs.

Why a wrapped line costs the `Chapter:` trailer too → `references/commits.md` § *The trailer
block is the message's last paragraph*.

`censusCountsBothSides` reads that line wherever one appears. Whether a change owed a census at
all, and whether the sample was drawn from the right place, are readings - the *Held by eyes*
table of `references/checks-and-eyes.md` names whose and when.
