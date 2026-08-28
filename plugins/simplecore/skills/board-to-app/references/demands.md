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

## A defect the running product showed, that no frame can draw, is a standing check

**The rule above covers everything a frame can express, and there is a family it cannot.** A name
the screen derived wrongly from what the system reported is not something a board can draw — the
frame draws 「the program's name」, and what the code put there was `2.1.239`, in a product one of
whose screens is about a name not being enough. Neither is 「this demand cannot be answered at the
address it is answered at」. Both were found by a person using the built product, after eight gates
went green and a chapter closed, and neither has a frame to be drawn as: the frames were already
there and already right.

**So the family has a place of its own, and it is `frameDeliverables`** — what a screen owes beyond
working code, one checkable sentence each, declared in the project's config →
`references/frame-artefacts.md`. Two things make it a check rather than a note:

- **The generator emits them per frame.** A sentence in a config is read once, by whoever wrote it;
  the same sentence on every screen section of every chapter is re-asked by every persona run that
  comes after. Declared once, it is a demand on every screen the board draws, and the chapters
  built months later carry it without anybody remembering it exists.
- **The list GROWS as defects are found.** A defect met in the running product is fixed, and then
  its shape is added here — otherwise it is fixed once, on the screen it was found on, and met
  again on every surface built afterwards. A project that ratchets is one whose list is longer
  than it was.

### A standing check was observed; an invented expectation never was

The two are written in the same words, and the wording is not the separator. 「the row is named by
what a person calls the program, never by a version string」 is a standing check when somebody read
`2.1.239` off a screen, and an invention when somebody thought it would be a good property. The
sentence alone does not say which, and read as the second it does exactly what the section above
bans — sends a builder to satisfy something nobody contracted.

**So a standing check carries the pointer to where it was seen**: the screen, the state it was in,
and what was on it. One that cannot name that is an invention wearing the right clothes, and it
goes back to being a frame question — draw it, and the demand follows from the drawing.

> **Read it this way and it is wrong**: 「a deliverable is about the product rather than about one
> frame, so the board cannot rule on it and anything plausible may go in」. The board does not rule
> on it and the sighting does. A frame is the contract for what a screen DRAWS; this list is the
> record of what the product was CAUGHT doing, and a record with nothing behind it is not a record.

**Declaring the list is half of it, and the other half is the one that fails silently.** A project
declared three of these sentences; no generator emitted them, no gate compared them, and no chapter
file contained any of the three — a config key that reads as coverage and holds nothing. That is
`../SKILL.md` § *The third category comes back as a checker that did not run* one level up: not a
checker that did not run, but a declaration nothing ever read.
`everyFrameDeliverableReachesAChapter` holds the join, and it is an error rather than a warning
because what it names is 「asked of nobody」 rather than 「go and re-read this」.

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

**Every row above that asks for a capture also says why a picture is the witness for it**, in the
clause that names the file — the next section is that rule, and a generator that emits the names
off this table without it has written the habit rather than the demand.

## A capture brief states the floor for pictures and the ceiling for what to exercise, and they are different lines

**「One capture per state the `개발` line names」 is a floor for how many pictures to take.** Read as
the scope of the run it becomes a ceiling on what to do, and the persona lines — which is most of
what a chapter has to prove — go unexercised. One brief phrased that way produced four correct
captures of a chapter carrying **46 persona demands against 8 `개발` lines**, with none of the 46 run.

**What makes it expensive is that nothing shows.** A row action nobody pressed and a row action that
works are the same picture; an unexercised demand leaves the mark of one that passed, which is none.
The return reads as complete because every capture the brief asked for is there.

- **Say both lines in the brief.** The captures are the floor; **the persona lines are what to
  exercise**, and a state reached while exercising them that the chapter demands is captured too.
- **A step that cannot be run is a finding in those words** — a control disabled, a state the seed
  will not produce, an action absent under the name the chapter uses. That list does as much work as
  the captures.
- **The wording that causes this is the coordinator's**, not the taker's. 「Per state that line
  names」 reads as a complete instruction and is half of one.

## A capture is owed where a picture is the only witness

**Read this before trimming anything, because it is not 「ask for less」.** The two largest findings
of one week's building both came out of pictures, and a judge with nothing to hold a transcription
against cannot work at all — it spends every finding on 「no capture covers this」. What comes off
the list is a demand nobody can give a reason for, and the census the second half of this rule adds
is a check sampling never had. **A rule read as a licence to skip produces exactly the screens this
whole arrangement exists to catch**: a route answering 200 with the shell painted and nothing
inside it.

**A picture is the only witness in three cases, and one of these is what a demand names:**

| The case | What only a picture answers |
| --- | --- |
| **the first sight of a screen** | a route that answers 200, raises no console error and paints the chrome with nothing inside it is a pass to every other check there is |
| **presence, placement or wording no response body carries** | a filter-chip row nobody declared, row actions the board draws as text and the screen renders as icons, a column that is not there |
| **a state that exists only while something is open** | a dialog, a confirmation, a panel form — gone the moment anything else is asked of the screen |

**And it is not the witness in four others:**

| The case | What proves it instead |
| --- | --- |
| **an unbuilt placeholder** | one capture per chapter proves the component; the rest are the same component, and the demand is **discharged** rather than skipped → `references/evidence.md` |
| **a claim the server's response settles** | counts, statuses, permission refusals — a fenced `METHOD /path → status` block, which the role-scoped persona lines already use exclusively |
| **a screen no commit has touched since its last capture** | the capture already in the folder |
| **a companion frame — one the board draws to show panes the base frame does not open** | the base frame's own per-pane captures. **The application has no such screen**, so this picture cannot be taken at all rather than being merely redundant |

**That fourth row is here because a generator author reads this table and not the other one.** It was documented only in `references/evidence.md`, which is the file somebody opens while writing a result document — a different moment and often a different agent. One generator, written carefully against this table alone, was about to emit **208 demands for pictures nobody can take**, and every one of them would have read as a chapter owing something. A counter-case named in the wrong file is a counter-case nobody applies.

### The reason goes in the demand line, and the generator writes it

**A demand that names a capture says, in the same clause, why a picture is the witness for that
one.** A capture name with no reason is the habit rather than a judgment, and the habit is emitted
by the thousand — a generator writing one file name per pane per frame produces a chapter demanding
1040 pictures and saying of not one of them why it is owed. Two things follow from that and both
have been seen: a frame whose three panes were unbuilt placeholders demanded three captures **none
of which could be produced**, and a taker that correctly shot one and left the other two was right
while the chapter went on reading as though it owed three.

**In the demand line, not on the board and not in a table somewhere else.** The reason follows from
*what on the board produced the demand* — a pane's content is not on the base picture, on every
board, for every pane — so it is a property of the clause that emitted the name rather than of the
frame. Put on the board it becomes one of three sentences hand-written hundreds of times, drifting
from what actually emitted the demand; put in a lookup table it is a reason nobody reads, because
the reader meets the demand in the line. **In the line it also travels**: the quoted demand is what
a result document copies whole, so the judge holding a capture against the demand has the reason in
hand and can say that this picture does not answer it.

**`captureReasons` is what a machine reads it by** — three lists of phrases in the project's own
language, one per case, and `everyCaptureDemandGivesItsReason` requires one of them inside the
clause that names the capture. Per clause rather than per line, because a line whose empty-list
clause gives a reason and whose pane clause does not is precisely the habit. **Whether the reason
is TRUE stays with eyes**, and `../SKILL.md`'s second table names whose and when.

**Adding a reason to a clause that already exists is a rewording, not an append.** It therefore
does what *A demand that grows is appended, never substituted* below says it does: it invalidates
every evidence section that quoted that clause. So it is done in **one pass over the whole chapter
set, at a moment no verification round is running**, with the quotes in the documents already
written refreshed in the same change — and the earlier the set is in its build, the smaller that
is. Adding the reason one chapter at a time is the same cost paid once per chapter, plus a set
where two chapters mean different things by the same demand.

**The same pass almost always does a second thing, and it costs the opposite.** It emits capture
demands where none existed — and appended at the end of the line those cost **no quotation at
all**: every quote already written stays a contiguous prefix and no document needs touching. So one
pass produces two sets of sections, and they are counted apart:

| What happened to the section | What it costs |
| --- | --- |
| its quoted clause was **reworded** to carry the reason | the quotation is refreshed and the section stays true — the demand asks for the same act, only the sentence moved |
| its demand **grew** a capture it did not ask for before | the quotation is left exactly as it was. Refreshing it hands the section a demand it never answered |

**One total hides the row that matters.** And the second row is a debt to be *measured* rather than
assumed: the pictures a newly-emitted demand names are often already on disk, because a capture
rule was demanding them before any chapter line said so. On a real set, 67 sections grew and **every
capture they now named was already there** — a growth of 67 and a debt of none. Assumed, that would
have been filed as 67 sections owing pictures nobody needed to take.

## A chapter owns tables, and the per-screen half does not reach all of them

**Everything above is about screens, and a chapter owns more than screens.** Its `entities`
section names the tables its migrations create, and the demand list is derived from its FRAMES —
so a table this chapter owns that none of its screens is about ends up demanded by nobody. Nobody
is asked to open it, the result document has no section to record it in, and every gate over the
chapter is green: the screens all have their lines, the lines all have their sections, and the
table is simply not part of the arrangement.

**It is not a rare shape.** A value that decides what a LATER chapter's screen draws is owned here
because the code that reads it is here — a sign-in policy read on every sign-in whose editing
screen belongs twenty chapters on, a policy row created as a side effect of creating a project
whose screen belongs to the chapter that detects what it governs. In one repository `sign_in_policy`
sat that way with four tests holding it and not one line demanding any of them.

**So the generator emits a section per owned table nothing reaches**, closed by the verdict line
rather than by a persona — what proves a table is a command and what came back, not somebody in a
browser. Three things decide whether it works:

| | |
| --- | --- |
| **which tables** | a project cannot derive 「this screen is about that table」 from a board, so it is DECLARED — per table, the frame of this chapter whose screen writes or shows it. **A table left out of the declaration gets a section**, so forgetting produces a demand somebody must answer and only a written claim takes one away |
| **what the section demands** | the half a generator can derive is the table itself — that it stands as its migration declares it, and that the code reading and writing it runs. **What the value DECIDES is the half only a person can write**, so the section carries a hand-authored region the generator preserves exactly as it preserves the chapter's other hand-authored sections |
| **where the section goes** | at the END, after every screen section. Section numbers are the chapter file's running count and result documents carry them in their headings → *A demand that grows is appended, never substituted* |

**A seeded section is a demand nobody can fail until somebody writes into it**, which is the shape
this whole file warns about — so the seed is held by a gate: a chapter the ledger calls closed may
not still carry it. And the rule the gate reads is about DEMAND LINES rather than about what the
generator emitted, because a foundation chapter written by hand has no generated section and never
will. Keyed on the seed, such a chapter's tables are outside the rule by construction, and an
unwritten table there and a written one produce the same silence.

## An address a demand names is an address that opens

**Write the whole address, never the fragment.** A demand that says 「open it with `<parameter>`」
leaves the reader to decide what to hang it on, and the natural guess is the screen they are
already on. Where that screen does not read the parameter, nothing errors: the page answers with
exactly what it always answers, and the reader records the ordinary screen as the state they were
asked for. **The failure is silent, and silent is the whole problem** — a fragment written into
hundreds of lines is a demand nobody can tell they failed.

Where a project has a route that renders one frame in one state, that route's address is the whole
answer and the generator has the frame in hand: build the address, do not describe it.

## A demand that presses a way BETWEEN screens is not answered at a per-frame address

**`captureRoute` renders one frame, in one state, from named sample data — and that is exactly why
it cannot answer a journey.** No navigation to arrange, no seed to walk through, the state is the
address: everything that makes the route worth having is the absence of the thing a journey demand
is about. Each screen opens at its own address there, so 「press the way back and say which screen
it lands on」 is answered without anything being navigated. Nothing errors — the control is
pressed, the page does what a frame route does, and the name written down is the frame that was
already open. A demand of that shape was answered that way while the way back it asked about was
not drawn on the screen at all.

**So a demand with a journey in it is taken in the running application, at the application's own
address** — the real shell, the real navigation stack, opened at the screen the journey starts from
and walked to the one under test. The frame route stays what it is: the address a picture of one
state is taken at. Where a project declares both, the demand says which of the two it is asked at,
because the two render the same screen and only one of them has a journey in it.

**And where a control leads is a different question from whether anybody can find it.** A detail
screen with no visible way back to its list, whose one control was a chevron nobody sees, passed a
build in which the route-level destinations had just been unified and tested — the destination was
right, and the way to it was invisible to the person the screen is for. So the demand is split:

| The question | Where it is answered |
| --- | --- |
| where the control lands | the running application, walked — a journey has two screens in it and a frame route has one |
| whether a person can see the control at all | a picture of the screen as it opens, with the demand naming the control by its label and where on the screen it sits |

**A tested destination is why this survives rather than a reason it cannot happen.** A run proving
every route resolves has proved the half a machine can see, and it reads as the whole of
navigation — which is what leaves the other half asked by nobody.

> **Read it this way and it is wrong**: 「the frame route renders the real screen, so pressing a
> control on it is pressing it in the product」. It renders one frame; a control whose destination
> is another frame has nowhere to go, and a run that presses it records the screen it was already
> on as the screen it landed on.

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

### The table above sorts by what a verb does to a RECORD, and misses what it does to a COUNT

**A verb can leave every record where it was and still move a figure another demand is asked to
read.** A test send creates a dispatch nobody wants to delete — that is the point of it — and the
day's total goes up by one. Marking everything read consumes the unread state and nothing puts it
back. Neither is irreversible in the table's sense: no record was destroyed, nothing needs undoing,
and the third row's confirmation walk does not apply because the verb is not dangerous. **Both are
still writes, and the demands that count are downstream of them.**

**This is invisible inside one section and invisible inside one screen.** The write is demand 10 of
one screen and the count is demand 2 of another, often built by different agents on different days,
and each line is correct on its own. What fails is the pair. Measured on one chapter: 「시험 발송」
on the rules screen put the history screen's five tab figures two above what its own chapter
demanded, and 「모두 읽음」 on the notification centre consumed the only unread row the phone screen
was asked to show a reader — so two screens reported failures that were the verification's own
doing, and one of them had to be shot again.

**So a chapter's demands are ordered by what they touch, not only by screen.** Two rules, and the
second is the one a generator can hold:

- **Within a chapter, every demand that COUNTS is read before any demand that WRITES to the same
  set.** The figures come off the seed, and the seed is the specification — so they are read while
  the data is still the data the seed made.
- **A demand that writes says what it moves.** 「시험 발송」 moves the day's total and the history's
  tabs; 「모두 읽음」 moves the unread census. The generator knows this the moment it knows which
  aggregate a screen's tiles and tabs are computed from, which it already reads off the frame to
  write the count demands in the first place.

**Where the order cannot be arranged — the write is on screen three and the count on screen one —
the count demand carries the value it expects AND the reading is taken first.** What is never
right is the shape this was found in: a run that presses everything in section order, then reads a
tally, then reports the tally as a defect.

> **Read it this way and it is wrong**: 「the seed is insert-only, so a persona run cannot damage
> it」. Insert-only protects what the seed WROTE; it says nothing about what a run ADDS beside it,
> and a seed that will not converge a figure back down is exactly the one that cannot repair this.
> The two dispatches a run created had to be deleted by hand, out of the database, before the
> screen's own chapter figures were true again.

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
