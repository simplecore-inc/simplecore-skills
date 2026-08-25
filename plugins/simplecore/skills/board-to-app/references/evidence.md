# The result document a chapter closes on

**The grounds a chapter closed on live in `evidenceDir`.** One document per chapter, and the
captures a document shows sit in a folder of the same name beside it.

**A result document is the residue of running the verification, never a deliverable made
separately.** Writing the document first and then making the screens match it inverts the whole
arrangement — that document proves nothing, and every sentence in it is true of nothing. Run the
persona line, look at what is there, write that.

**Where the result is not properly written, a chapter's completion verdict cannot be deferred.** A
chapter closes because the agent holding it reports that its persona lines passed, and the grounds
of that report die with the session. The documents in this folder let somebody who was not there
open one file and read, line by line, what was checked and what was on the screen.

This file is the specification. A project keeps its own worked examples, its own tooling commands,
and the table naming whose eyes take each reading, in the index of its own evidence folder.

## Why not one of the other three folders

| Not here | Why |
| --- | --- |
| `chapterDir` | the generator owns it — a result written there disappears at the next generation |
| the tracking folder | progress lives there. A result is not progress; it is the grounds for a chapter being in the state it is in, and which chapter is open is written in the state ledger alone |
| `capturesDir` | untracked. It holds what one session swept and threw away, so nobody can open it once that session ends |

## The file name

The chapter file's own name. The result for `<chapterDir>/<chapter-file>.md` is
`<evidenceDir>/<chapter-file>.md`, and the captures that document shows sit in
`<evidenceDir>/<chapter-file>/`. This holds as chapters are added, so a project's document index
carries one row for the folder rather than one per chapter.

## The shape of the document

**One section per line the chapter demands somebody prove.** In a chapter that places screens that
is the persona line; in one that places foundation it is the verdict line. The section title is the
chapter's section number, that section's title, and — after a separator — the role: the persona's
name, or the project's word for a machine verdict.

Each section carries three labelled lines and the evidence under them.

| Line | What it holds | Shape |
| --- | --- | --- |
| the `did` label | what the persona operated. For a machine verdict, the command that was run | **a list** |
| the `demanded` label | the sentence copied out of the chapter file, unchanged | **one line** |
| the `saw` label | what was in the capture when it was opened. For a command, what came back | **a list** |
| the evidence | the frame's capture, or a fenced block holding what was run and what came back | |

**`did` and `saw` are lists.** What one section demands has grown to tabs, an empty state, row
actions and the buttons in the header, and running those checks together in one paragraph leaves
**the reader unable to count what was checked and what was skipped.** One item is one check — one
pane, one condition, one control pressed.

**Only `demanded` stays a single line.** That line is not written; it is **copied out of the
chapter file**, and `evidenceQuotesTheChapter` compares it as a contiguous fragment once whitespace
is removed from both. Split into a list, the bullet markers land inside the quote, the quote stops
being a fragment of the original, and the check reads the whole section as drifted. **The way to
make a quote readable is not to break it up but to fix the chapter so the line is shorter.**

````markdown
# <chapter> — <the project's word for a verification result>

## 1. <frame> <screen name> · <role>

**<did>** — <what was operated>
**<demanded>** — <the sentence copied out of the chapter>
**<saw>** — <what the capture showed>

![<frame>](<chapter-file>/<frame>.webp)

## 1. <frame> <screen name> · <another role>

**<did>** — <the address called directly>
**<demanded>** — <the sentence copied out of the chapter>
**<saw>** — <the answer the server gave>

```
GET /api/<entity>/9 → 403 SCOPE_DENIED
```
````

**A foundation chapter has no captures.** A chapter that places no screen writes, per section, the
command it ran and what came back. Nothing is photographed that does not exist.

## Taking a capture and judging one can be two agents

**The taker and the reader are already different roles; they may also be different runs.** A
`capture-taker` opens the addresses, presses what the line names, writes down every value that was
on the screen, and returns without a verdict. The coordinator reads the captures and the
transcription and decides what any of it means.

**What makes the split safe is that the taker transcribes rather than checks.** 「the tiles match
the chapter」 and 「287 valid · 6 dated · 2 expiring · 0 unscoped」 are not two ways of saying one
thing: the first is a verdict nobody can check afterwards and the second is what a reader needs in
order to reach one. Transcription is reliable work; a judgement made by whoever took the picture is
what the rest of this file exists to prevent.

**So the taker can run on a cheaper model than the reader, and usually should.** Driving a
browser to named addresses and reading values out is procedure. Deciding whether a value is a
defect is not. Splitting them puts the cost where the work is mechanical and leaves the judgement
whole and in one head.

**Which model each half runs on is the project's answer**, in `captureTakerModel` and
`captureJudgeModel`, and the coordinator passes it at dispatch — the value on an agent's own
definition is only what it falls back to. **Declare both or neither.** Half a split named is a
project that thought about one side of it: the taker gets the cheap model, the judge inherits
whatever the harness gives, and the arrangement ends up paying more on exactly the half that was
supposed to cost less.

**What is not a choice is the split itself.** It exists because whoever shot a picture reads it for
confirmation of what they expected, not for what is missing — so it holds whatever either half
costs, and a project that declares neither key runs both halves on the harness's default and gives
up only the saving.

**And what does not change is who judges.** Whoever took the pictures, the reading stays with the
coordinator, and what the taker hands back is a record of what was on the screen rather than a
section of the result document.

**A taker's return opens with the window it shot through**, before any screen: the size and colour
scheme it read back off the page, against the `captureStandard` it read them from, once before the
first capture and once before the last. **Read that line before reading anything under it** — a set
shot through the wrong window has to be taken again whatever it shows, so judging its contents is a
round spent twice. Six captures came back at 1280 wide in dark mode against a board measured at
1440 in light, with a tree's first data row, four of nine table rows and a whole panel form below
the fold; the run reported nothing, the files were a plausible size, and the judging that followed
spent every finding it had on 「no capture covers this」.

## The tree is not the screen, which is why the judge is not optional

**Reading the accessibility tree is the cheap way to write down a screen and it is a different
account from the picture.** The tree carries names nobody sees — a resize handle's value, a pager's
spoken label, a cell's whole text where the screen breaks it over two lines — and it is silent
where nothing has a name, which is every icon-only control.

**Measured on the first run of this arrangement: nine of a screen's written-down facts disagreed
with its captures**, and every one came from that gap rather than from carelessness. A column
header written as the name plus a slider's number. A pager written in words it does not draw. Three
row actions written as labels where the screen draws an eye, a pencil and a bin. A panel's three
footer buttons absent from the account entirely, because the reader's eye had gone to the open tab.

**So the split is not a saving that happens to be safe — the second reading is what makes the first
usable.** A transcription alone would have put nine wrong sentences into a result document with a
correct-looking capture beside each one, and nothing in the run would have disagreed with itself.

## The unit of a check is one screen, and each gets a fresh agent

**Building a chapter is one agent's work; checking it is not.** A builder carries a chapter because
what it makes in section three is what section nine stands on. A check has no such thread — one
screen's captures tell you nothing about the next — so an agent that checks five screens in one
context is carrying four screens' worth of pictures and dead ends into the fifth and paying for them
on every turn.

**A fresh agent per screen costs less, not more.** What each one loads before starting is a fixed
prefix that every sibling loads identically, which is the cheapest kind of token there is; what a
long-lived agent accumulates is the other kind. Runs that walked half a chapter in one context have
cost hundreds of thousands of tokens and dried out before the section was done.

**So: one `capture-taker` per screen, one `capture-judge` per screen, both ending when that screen
is done.** The coordinator holds the thread between them, which is the one thing that genuinely
spans screens.

## Fixing while a cluster is still being shot ages the pictures behind you

**Shoot the cluster, judge it, collect the fixes, and only then fix — then re-shoot only what the
fixes touched.** A fix that lands after a capture makes that capture a picture of a product nobody
built, and **nothing in the system can see it**: the picture cannot say it is stale, the gates read
the file rather than its date, and the document's sentences go on citing it. Only somebody holding
both facts — this fix, that capture — ever knows, and there is one moment when anybody holds both.

**The reason it has to be written down is that fixing as you go feels like the diligent choice.**
You have just found something, the fix is small, and photographing more of a screen you know is
broken feels like negligence. It is the opposite. Leaving a defect standing for another twenty
minutes costs nothing that is not already lost; taking a picture that will be false in four minutes
costs the grounds the chapter closes on, and costs them invisibly.

**One chapter paid this three times in a single round** — an emergency-contact fix three minutes
after its seven captures, a preview fix an hour after two, and a seed rebuild that changed every
dispatch identifier and cost four screens at once. Each time the answer was the same: re-shoot. A
sentence in the document explaining why a picture looks wrong is not a substitute for taking it
again, because the reader who needs that sentence is the one who did not read it.

**The seed rebuild is the case worth keeping separate.** Re-seeding is not a fix to a screen and it
ages every capture in the chapter at once, including screens nobody touched. So it happens before
the shooting starts, or it costs the whole round.

## Opening the capture before writing what was seen

**A sweep is a script.** It opens an address, waits, shoots, and writes a file — and no step of it
reads a capture. So a chapter can finish with twenty-eight pictures on disk and not one of them
opened, and the `saw` line written in that state comes from somewhere else: the DOM that was
queried, the response that was read, the code the writer wrote. **That is a sentence about the
data, not a sentence about the screen.**

**How a sentence is written from a picture is one rule and it lives in one place** →
`references/judging-frames.md` § *Taking a capture is not reading one*: open the file first, write
only what is in it, say what is absent as readily as what is present, and run the two checks only a
script reading the rendered page can settle. It is written there rather than here because the same
discipline governs every sentence anybody writes about a screen, not only the `saw` line — and a
second copy of it here is the copy that would drift.

**One rule belongs to the result document alone**, because it is about a sentence that has to stay
true months later rather than about reading a picture accurately today.

**Never quote a figure that the act of measuring changes.** Some figures in a capture read
differently the next time the screen is opened, and quoting one dates the sentence the moment it
is written. Two families: **a figure that counts the observer** — the session opened to take the
capture joins the count of active sessions, so it rises with every shot — and **a figure a clock
moves the window of** — a "today" count restarts at zero at midnight, so a value the seed
planted becomes yesterday's after a day. **Write what the figure is made of instead of the
figure**: "the active sessions are the 47 the seed planted plus the session that opened this
screen". The relation is still true at the next capture.

**A tile the board draws is not this.** A tile shows the value of the moment, and the number the
board drew is the specification of what the seed plants. That is different from a tab badge,
which reads as a set somebody counted.

## A content tab is one capture per pane

**There are two kinds of tab, and a board separates them by component.** One kind narrows a single
list — all 14 · in use 11 · unused 3 — and every tab shows the same list, so one capture of the
frame covers it. The other kind puts **different content** in one screen — profile · security ·
notifications · devices — and the frame draws only one of those panes open.

**So one frame capture is a capture of one pane, and the rest were opened by nobody.** A pane can
be a provider configuration form of its own, or a component list of its own; neither is the open
pane narrowed. **Whether such a pane was built cannot be read off the frame's capture.** Empty, it
answers every request 200 and raises no console error — which is the defect this whole document
exists for, repeated one layer under the tabs.

**So there is one capture per pane.**

**And every capture carries its own sentence, directly above it.** A section holding several
pictures with nothing between them hands the reader a strip of screenshots and the job of working
out which is which — the alt text is not that sentence, because a reader looking at the page never
sees it. **The sentence says what to look at in that picture**: which pane it is, what it draws,
what is present or absent in it. It is written the way 「본 것」 is written — out of the picture,
after opening it — and a second picture with no sentence of its own is a picture nobody accounted
for.

So a section reads: the three labelled lines, then the frame's own capture under the sentence that
describes it, then for each further pane its sentence and its picture, in that order. **Never two
images with nothing but a blank line between them.**


| Which pane | Name |
| --- | --- |
| the one the board draws open | `<frame>.webp` — the frame's own name |
| every other pane | `<frame>-t<n>.webp` |

`<n>` is the pane's position in the board's tab strip, counting from 1. A frame whose second pane
is the open one holds `<frame>.webp` · `<frame>-t1.webp` · `<frame>-t3.webp` · `<frame>-t4.webp`.

**No natural-language characters in a file name.** macOS decomposes them, so git reads one name as
two. The name carries the number; which pane it was goes in that section's `saw` line, in words.

**One section, several pictures.** That frame's first persona section shows the pane captures
together, and its `saw` line says what was in each, naming the pane. The section is not split per
pane because a pane does not vary by role — what one person presses through in one sitting is one
section.

**The ceiling is still the board's pane count.** A picture of a pane the board does not draw on
that frame cannot be named, so a frame holds no more pictures than the board draws panes for it.
Across the repository the ceiling is the board's frame count plus the panes it leaves unopened.

**A state frame drawn over a base owes one capture of itself and no panes.** A frame that opens a
dialog reuses the base frame's drawing, tab strip included, and the panes belong to the base. The
machine test is whether that screen file writes a tab strip of its own.

**A strip that declares no open pane is read as having its first pane open.** Where a frame
computes the open pane from a parameter, no `active: true` appears in its source. A project that
has such a frame writes the reason down beside the rule, or the next reader deletes the line as
useless.

### The companion frame that draws the panes, and why it is photographed by the base

**A board draws the unopened panes on a companion frame.** For each screen with a content strip,
one frame stands directly behind the base: it draws the title area as the base does, leaves the
list and the panel as placeholders, and stacks every pane but the open one down the page. **The
alternative — a frame per pane — makes the page get drawn again**, so one list lives in two frames,
one of them gets fixed, and the divergence the board exists to prevent comes back through the fix.

**A companion frame has no capture of its own**, because the application has no such screen. It is
a composition that stands only on the board; in the product those panes are tabs on the base
screen. **The pictures that prove what a companion frame holds are the base's `-t<n>` files**, and
they are the whole of it. `<frame>-t3.webp` is the running application with that frame open and its
third pane pressed, and which frame the board drew that pane on has nothing to do with it.

**So a check that counts frames leaves companion frames out of what must be captured.** Included,
it would demand a picture nobody can take, and the only way to satisfy the demand would be to put
the base's picture in the folder a second time under another name.

**Verification does not wait for the companion frame.** The pane names are already on the board,
which is all it takes to demand that somebody open the screen of that name and write down what is
there.

### A demand a picture cannot answer is discharged, never skipped

**Three panes of unbuilt placeholder are one component photographed three times.** The tab triggers
are disabled, no content is registered behind them, and the second and third pictures are the first
picture with a different file name. `references/demands.md` § *A capture is owed where a picture is
the only witness* is why: an unbuilt placeholder is one of the three cases a picture does not
witness, because **one capture per chapter proves the component and the rest are the same
component**.

**The generator could not have known that.** Whether a pane is built is a fact about the running
application, and a chapter is written from the board — so the demand is correct when it is emitted
and stops being answerable when somebody opens the screen. **That is not a demand to withhold; it
is a demand the run discharges.**

**A discharge is a line, not a silence.** The section carries `placeholderLine` in place of the
picture, and its `{text}` is the capture in this document that does prove that component:

```
## 7. N-33 구성 관리 · 시스템 관리자

**한 일** — 내용 탭 네 칸을 차례로 누른다.
**챕터가 정한 것** — …칸마다 캡처를 남긴다 — `n-33-t2.webp`(구성 요소) · `n-33-t3.webp`(연동) …
**본 것** — 「구성 요소」는 자리표시자다. 「연동」·「이력」도 같은 자리표시자 컴포넌트다.

![N-33 구성 요소](w14-config/n-33-t2.webp)

**같은 컴포넌트** — `n-33-t2.webp`
```

**The taker that shot one and left two was right, and with nothing to write it left two sections
showing nothing** — which afterwards is indistinguishable from two panes nobody opened. The line is
the whole difference, and it is what makes the discharge auditable: it names a picture, and the
picture is on disk and is one the document shows. `dischargedDemandNamesItsProof` holds all three.

**A discharge is a claim that expires.** The day the component is built the line is false and the
bytes have not changed, so nothing mechanical can see it — the reader and the moment are in
`../SKILL.md`'s second table.

**The first sight of a screen is never discharged.** A frame's own capture is the one picture no
other picture stands in for, and `everyPlacedFrameIsCaptured` goes on demanding it whatever the
panes behind it hold.

## The ceiling on captures

| | |
| --- | --- |
| Format | WebP (`.webp`) |
| Name | the frame id it shows, lowercased — `<frame>.webp`. A further content pane is `<frame>-t<n>.webp`; a list holding nothing is `<frame>-empty.webp` |
| Per chapter | the frames the chapter places, plus the panes the board draws on those frames beyond the open one, plus the frames that draw a list |
| Per repository | the board's frame count + the unopened panes + the frames that draw a list. Companion frames are not in this sum — the application has no such screen |
| Per file | 150KB or under, and above 2,800 bytes per megapixel of its own canvas — an empty canvas costs about 1,900 at any quality, the sparsest real screen 3,900 |
| Width | the device width the board gave that frame, up to 1440px |
| Theme | light |

**Captures are shot in light.** Most people using the product are in light, so the screen in
evidence should be the screen they see. Where the browser or the operating system is in dark, it is
switched before the capture — the same screen is never kept in two themes, because one pane is one
picture. Captures already taken are left as they are and change theme when their section is next
run.

**The file name is what holds the ceiling.** Because a name is a frame id and a pane number, the
same pane cannot appear twice, a frame the chapter does not place cannot appear at all, and neither
can a pane the board does not draw. However many chapters a build has, the tracked captures never
exceed the board's frames plus its unopened panes.

**Several roles seeing one screen does not add captures.** What a scope-limited role's line proves
is the list it is filtered down to and the server refusing an address — and the grounds for that
are the address called and the code that came back, not a picture. Those sections carry a fenced
block. A picture is needed where the screen that role sees genuinely differs, and where it does,
the board has usually drawn it as a frame of its own.

## Two kinds of capture, and this file is about one of them

**A capture cited by a result document is not a frame artefact.** This file's naming, ceiling and
format govern the pictures a chapter's evidence SHOWS — one per frame the chapter placed, one per
further pane, named for the frame, tracked in the repository. A project may also require a capture
per frame as a standing deliverable, in every locale and device class it ships; that set has its
own axes and its own folder → `references/frame-artefacts.md`. Neither ceiling applies to the
other, and a project that keeps both keeps them apart.

## Captures that are not tracked

Everything else a sweep shot stays in `capturesDir` and is untracked. Only what a document shows
moves into `evidenceDir` — a capture left in the folder that no section cites is reported by
`closedChapterHasEvidence`.

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

## Withdrawing a finding takes its citations with it

**A judgement in one section becomes ground the other sections stand on.** A finding written up as
「these two notations split one fact」 does not stay in its own section: the next section that meets
a similar screen writes 「this is not the same case as that one」, and now that sentence's meaning
depends on the first being right. Four sections were resting on one judgement in a chapter where
nobody had gone looking.

**So a retraction that edits only the section it was written in leaves the retracted judgement
alive everywhere it was cited**, and the surviving sentences are worse than the original — they
carry a claim no longer stated anywhere, so a reader cannot even find what they are leaning on.

**Grep before editing, and fix the citations in the same change.** The distinctive phrase of the
withdrawn finding is what to search for, not the frame id: a citation names the judgement, not the
screen. Each one is then rewritten to what it was actually trying to say, which is usually a
narrower and truer sentence than the one that borrowed the false judgement.

**Whoever withdraws the finding does the sweep** — most often the coordinator, since a finding that
survived one review and fell at the next is a call they made. Handing the sweep to the agent
holding the chapter splits the retraction across two heads, and the half that knows what was wrong
is not the half doing the searching.

## When a later chapter changes the same screen

**The earlier chapter's document is not edited.** It records what was checked when that chapter
closed. Where a later chapter changed the screen, that chapter's own lines are run and written into
that chapter's document. Where the later chapter has no line that opens the screen, the earlier
document stands as the grounds.

**Three things are exceptions, and they are the whole list.** Each is named where it arises and
each edits the quoted line and nothing else — what was DONE and what was SEEN are never rewritten,
because those are the record and the record did not change:

| | What may be edited |
| --- | --- |
| a demand shrank to a subset of itself | the quoted line, down to the chapter's sentence of today |
| a frame or a screen was renamed | the quoted line, to the new name |
| a check deferred to a later chapter was settled by that chapter | the deferred line comes out, and what was finally seen goes in its place |

Anything not on that list means the section is run again rather than edited.

## A capture older than the code it shows is a candidate, not a verdict

**Comparing when each capture was taken against when the surfaces it draws last changed is the
coordinator's own check, and it is worth running** — it found six captures in one chapter that
predated a fix to the very control they photograph, one of them showing a defect that had been
gone for twenty-three minutes.

**It reports candidates.** A screen changes in one state and not in another: a fix to a detail
panel and its locale leaves the empty list untouched, so the picture of the empty state is the same
today as it was before the change. Re-shot, it came back **byte for byte identical** — same
encoder, same window, same pixels, no diff at all.

**So the check ends at the picture rather than at the timestamp.** Re-take the candidate and
compare; where the bytes are unchanged, nothing was stale and the finding closes there. What it
must never become is a rule that every capture older than its code is re-shot on sight — the
chapters carry hundreds, most states are untouched by most changes, and a re-shoot that produces a
different picture of an unchanged screen is a new risk rather than a repair.

**And a candidate that comes back identical is worth saying out loud.** 「Re-shot and unchanged」 is
a fact about the screen; silence afterwards reads as a re-shoot nobody did.

## When a board fix moves what a closed chapter quotes

**The `demanded` line is copied out of the chapter file, and the chapter file is generated from the
board.** So fixing one rule on the board leaves a closed chapter's section quoting a sentence the
chapter no longer carries. **That section then reads as a record of somebody verifying a rule that
is gone, and nothing about it looks wrong to a reader.**

**Where they have drifted, there are two things to do.** Run that section's line again and write
the section again, or write in the open-items file why it cannot be run. It is never left alone —
a document and a board saying different things with no mark on either is worse than no document.

**`evidenceQuotesTheChapter` finds the drift.** A section's `demanded` line that is no part of any
line of the chapter section its title names is an error. Whitespace and line breaks are removed
from both before comparing, so either file may wrap anywhere; a quote with the head or the tail cut
off passes, and so does one taken from the board rules the section lists as bullets.

**This is not the same as a later chapter changing the screen.** There, the screen moved and the
earlier document is still correct as the grounds of its moment. Here **the contract moved**, so a
rule the earlier chapter recorded as verified has ceased to exist.

**A demand that shrank is a third path.** Where fixing a generator defect drops a demand nobody
should have had, the new demand is a subset of the old one and **what that section saw already
covers what is left.** Running it again would check the same thing more narrowly. Bring only the
`demanded` line down to the chapter's sentence of today and leave `did` and `saw` untouched —
matching a quote to its source is not editing what was seen. Say in the commit what shrank.

**Only when it is a subset.** A demand that changed into something else has not shrunk, so that
section's line is run again.

**A rename is a fourth path, handled like the third.** Renaming a frame or a screen removes the
sentence carrying that name from the chapter, so the check reports a drifted quote while **not one
pixel of the screen has moved.** Nothing shrank and nothing changed into anything else, so there is
nothing to run: bring the `demanded` line to the new name, leave `did` and `saw` alone, and leave
the section's captures where they are. **What separates the paths is whether the screen changed,
not whether the sentence did.**

**All four are one section whose sentences changed.** Where the SET of sections changed, the next
rule takes it — there the quotes are all fine and a section nobody wrote is being demanded.

### A check that ran, and this installation cannot decide

**A verification line is run rather than reasoned about, and sometimes running it answers 「not
here」.** The boundary the line proves is not enforced by THIS installation and no amount of
running it again will change that: a database whose application connects as a superuser cannot
demonstrate row ownership, a deployment with no second factor cannot demonstrate a challenge, a
single-tenant install cannot demonstrate a tenant boundary.

**It is not 「did not happen」 and it is not 「passed」.** Written as the first, it reads as work
somebody skipped and the chapter cannot close over it. Written as the second, the product carries
a boundary nobody has ever seen hold — which is the class of defect this whole arrangement exists
to prevent.

**It is a debt, and a debt names its creditor.** The section is written exactly as any other: the
command that was run, the demand, and what came back — including the reason it cannot be decided.
Under them goes one more line, naming **the chapter that will be able to decide it**: the one that
installs the role, turns on the second factor, brings the second tenant into existence.

**The chapter that met the wall closes.** Its work was done and the answer it got is the honest
one. **The chapter it named is the one that cannot close** while that line stands, and settling it
is part of that chapter's own run.

**Then, and only then, the earlier document is edited.** An earlier chapter's result document is
otherwise not touched — it records what was true when that chapter closed — and this is the third
of the three exceptions listed under *When a later chapter changes the same screen*. It is barely
one: the document recorded a debt against itself, and paying it is what the document asked for.
Take the line out, write what was finally seen in its place, in the same change that settles it.

**Declare `deferredLine` the first time this comes up** — the line's shape, with the chapter as
its `{text}`. Written in prose instead, nothing connects whoever hit the wall to whoever closes
that chapter three weeks later, and the two checks that hold the debt see nothing:
`deferredCheckNamesAChapter` refuses a chapter that does not exist and one that names itself, and
`chapterOwedACheckDoesNotClose` refuses the named chapter's closure while the line stands.

### The demands do not move while the verification is running

**A round of verification quotes the chapter, so a chapter that changes mid-round unfinishes the
sections already written.** Somebody works through a chapter section by section; a fix lands in the
generator; the sentences those sections quoted are no longer the sentences the chapter carries, and
`evidenceQuotesTheChapter` reddens work that was correct when it was done. Do it twice and the
round stops converging — five more sections get written while the next fix invalidates the five
before them.

**Appending does not prevent this.** The rule that a new demand goes at the END of a line exists so
that a quote already written stays a contiguous prefix of it (`references/demands.md` § *A demand
that grows is appended, never substituted*); it holds against INSERTING and says nothing about
SUBSTITUTING. Replacing a phrase inside a line invalidates every section that quoted
that line, wherever the phrase sat.

**So a fix to what a chapter demands is collected and released between rounds, never during one.**
Whoever is running the verification says when the round ends; until then, fixes to the generator's
wording are held. A fix that does not change the sentences a chapter writes — a check, a document,
the build's own wiring — is not this and runs whenever it is ready.

**The one exception is a demand that cannot be executed at all**, which is worse than a stale
quote: a section written against it records a check nobody could have made. Release that one
immediately, say which sections it invalidates, and hand the list to whoever is running the round.

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
document is short a section and short a capture. `closedChapterHasEvidence` reports the section and
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

`closedChapterHasEvidence` judges: that a chapter the ledger marks closed has a document; that
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
