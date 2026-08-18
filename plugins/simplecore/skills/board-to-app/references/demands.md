# What a chapter demands of a screen

A chapter's per-screen half is the demand list a screen is built against and verified against. This
file is what belongs on that list and why. **The generator that writes it is the project's** —
`chapterGenerator` is a config key because a board's components, frame shapes and role names are
one product's — but what it has to produce is not, and a generator written without this produces
a chapter that reads complete and demands almost nothing.

## A demand is something somebody can do, not something they can see

「the strip has four tabs」 is an observation. Nobody fails it: the screen renders, the tabs are
there, and the reader moves on. **「press each of the four, write down what is in each, leave a
capture of each」** is a demand — it can be met, half-met, or skipped, and which of the three
happened is visible afterwards.

Every line on the list is written in that shape. The test is whether a person could come back
tomorrow and say **which parts were done**. A list of observations has no answer to that question,
which is why a screen can pass one while being a shell.

## Everything on the list comes off the board, and nothing else

**A demand nobody can satisfy is worse than a missing one.** An invented expectation — a field the
frame does not draw, a state the board never gave — sends a builder looking for something that was
never contracted, and the honest outcome is that they build it, which is a screen the board no
longer describes.

**So a function the product needs and the screen does not draw is a FRAME first.** Draw it, then
the demand follows from the drawing. That order is the whole reason the board exists: the contract
is decided in one place, in a form a person can look at, rather than accumulating inside a chapter
file nobody reads as design.

**A generator that reads the board and drops what it cannot express is the quiet version of the
same defect.** A truncated list reads exactly like a short one — the chapter looks complete, the
checks pass, and the rule that fell off the end is the rule nobody misses. Whatever a reader
deliberately does not take is named in the run's own report, not left to be discovered by reading
the regex.

## What a frame has on it, and what each thing owes

A frame's own drawing answers all of this. **The list below is what a demand list is short of when
it only says what is on the screen** — every row of it is a control somebody presses, and every one
was invisible to a chapter set that quoted tabs, counts and messages alone.

| On the frame | What the chapter demands |
| --- | --- |
| the screen itself | open it, at the address the board gives it |
| a tab strip that narrows one list | name the tabs; one capture covers them, because every tab shows the same list |
| a tab strip whose panes hold **different content** | press each pane but the open one, write what is in each, capture each — `<frame>-t<n>` |
| a tile row | say what each tile counts, and check the count against what the list holds |
| a message the frame draws (a warning, an error, a legal note) | that it is on the screen, quoted by its own words |
| a primary action | the thing the screen exists to finish, done |
| a state the board drew as its own frame | reached, and captured as that frame |
| a list | the empty state, opened at an address that reaches it and captured |
| a search box, and the filters standing on it | type in it and watch the list narrow; check each applied filter shows as a badge; clear it and watch the original count come back |
| row actions | press each one in a single row and write what opens |
| header buttons beyond the primary | press each and write what opens |
| a detail panel's upper verbs | open a record and press each |
| a detail panel's footer verbs | one row below, because what they do to a record is not one rule |

**Quote the labels.** 「press the row action」 sends a reader hunting; 「press 「<label>」」 does not,
and a label that has since changed shows up as a demand that cannot be met rather than as silence.

**Both kinds of tab are on that list under different rows on purpose.** A frame can carry both, and
one word covering both hands the reader two different things under one name — one is the same
records filtered, the other is a pane that may be an empty shell behind a screen that otherwise
looks finished.

## An address a demand names is an address that opens

**Write the whole address, never the fragment.** A demand that says 「open it with `<parameter>`」
leaves the reader to decide what to hang it on, and the natural guess is the screen they are
already on. Where that screen does not read the parameter, nothing errors: the page answers with
exactly what it always answers, and the reader records the ordinary screen as the state they were
asked for. **The failure is silent, and silent is the whole problem** — a fragment written into
hundreds of lines is a demand nobody can tell they failed.

Where a project has a route that renders one frame in one state, that route's address is the whole
answer and the generator has the frame in hand: build the address, do not describe it.

## An irreversible action is walked up to, never skipped

A demand list that says 「do it」 of everything will, sooner or later, say it of something that
cannot be undone — and a shared database makes that everybody's problem: the value stays changed
and the next chapter finds a figure it did not expect.

**The board answers which of the three a verb is**, so the demand is split rather than softened:

| The verb | The demand |
| --- | --- |
| it has an inverse the frame also draws | do it, then undo it with that inverse — both named |
| it creates something | create one, then delete the one this test created |
| neither | **go as far as the confirmation, write down what it asks, and do not confirm** |

**The third is 「go that far」 rather than 「leave it alone」, and that is the point.** The route is
exercised, the confirmation is read, and the record saying it was not executed is a record of the
rule being kept rather than of work being skipped. A demand that said 「skip it」 would be
indistinguishable, afterwards, from a test nobody ran.

**A verb that only reads — open, view, print, download, export — is pressed like any other.**
Nothing is left behind by pressing one, and sending a reader to a confirmation screen that does not
exist is a demand they cannot satisfy.

## A demand that grows is appended, never substituted

**A new demand goes at the END of the line.** A verification quotes the chapter, so a quote already
written stays a contiguous part of a line that grew at its end and stops being one the moment
anything inside the line changes.

That is a rule about the LINE, not about the file. Appending a section is a different rule
elsewhere; here the point is that **replacing a phrase inside a demand invalidates every evidence
section that quoted that demand**, wherever in the line the phrase sat. A generator that reorders
its own clauses, or rewords one, does this to every closed chapter at once.

**And demands do not move at all while a verification round is running** →
`references/evidence.md` § *The demands do not move while the verification is running*.

## Written in the project's own words

Every label in a chapter file — what a persona line opens with, what a machine verdict is called,
how a state list reads — is declared as `chapterLines` and `verdictRole` and is not this file's to
choose. Write the generator against those, so that a project working in another language gets
demands rather than a template it has to translate.
