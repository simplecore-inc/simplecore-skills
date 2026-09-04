<!-- Split out of SKILL.md so a session loads it only when its subject comes up. The skill's own
     section of this name is a routing stub pointing here. -->

# What the generator writes — the structural line, the journeys, the seed relations

**A chapter is derived from the board, and it holds four things: one structural line per frame,
the journeys that prove the chapter, the relations the seed must make true, and — for a chapter
that places foundation — the verdict lines.** Nothing in it is written by hand, and nothing in it
quotes a value, a count, a sample row or an exact message. What a chapter says is what a journey
test can assert with no number known in advance.

**A journey is something somebody does, not something they see.** 「the tile reads 119」 describes a
screen being looked at; 「the tile counts what the list holds」 is a relation a test asserts on any
data. The first passes for a product that shows nothing of the kind once somebody types 119 into a
fixture; the second cannot be passed that way.

## The structural line names kinds and counts, and labels only as guidance

One line per frame, read off the frame's own drawing:

> `F-01a` 재고 현황 · `/stock` · 목록 (행 동작 3: 보기 · 조정 · 발주 요청) · 필터 · 목록 탭 4 · 타일 4 ·
> 상세 패널 · 빈 상태 · AUTH: 시스템 관리자 · 본사 담당자 · 본부 담당자(담당 사업소)

| It names | Because |
| --- | --- |
| the address | an address a chapter names is one that opens → below |
| each **kind** of control and how many — a list, its row actions, a filter, tabs, tiles, a detail panel and its verbs, an empty state, a dialog and its primary action | that is what the board contracts: a screen missing one of these is wrong, whatever it looks like |
| the labels, in parentheses | as the default wording — a product that words a control differently syncs the board and is not wrong |
| the roles that reach it, with their scope | the personas the journeys are written for, and the ones the negative journey refuses |

**What it does not name is anything the seed decides.** No row contents, no counts, no dates, no
sample names. A structural line that reads 「행 동작 3」 is met by any three row actions of those
kinds on any row; one that reads 「TN-3600M 빨강 행의 보기」 is met only by a database that holds
that row, which is a database written to satisfy a sketch.

**An empty state is structure.** A list either has one or it does not; which words it uses is the
product's. A board that draws one representative empty frame and says the rest follow its rule has
declared every list's structure, and the generator writes 「빈 상태」 on every frame that draws a
list.

## A journey is one persona finishing one piece of work

**One journey per persona the chapter's screens admit, and one negative journey per persona they
refuse.** The generator derives each from three things it already reads:

| From | It writes |
| --- | --- |
| the role map | which persona the journey is for, and the account it signs in with |
| the frames' cross-references — a row action's target, a button's target, a `{{frame}}` in a note | the way between screens, as the controls pressed in order |
| each frame's primary action | the piece of work the journey finishes |

A journey reads as a numbered path — the screen it starts on, what it presses, where that lands,
what it finishes, and what must then be true — and every 「must then be true」 is a relation:

> 1. `/stock`을 연다 — 목록과 타일이 있다
> 2. 한 행의 「조정」을 누른다 — 재고 조정 대화상자가 열리고, 대상은 그 행의 품목이다
> 3. 수량과 사유를 넣고 「저장」을 누른다 — 대화상자가 닫히고, 그 행의 수량이 넣은 값이며, 입출고 이력에
>    같은 식별자의 조정 기록이 하나 늘었다
> 4. 본부 담당자로 다른 사업소의 `/stock?view=…`에 직접 접근한다 — 서버가 거부한다

**Every journey is an automated test.** It lives under `journeyTestsDir`, in the project's own
framework, signs in as its persona, drives `journeyRoute`, and takes one capture per screen-state it
visits. `journeyCommand` runs them all and writes the chapter's run record → `evidence.md`.

**A journey that cannot be finished because a later chapter's screen is missing stops at the
promise.** The chapter's `promises` section already names the destination; the test asserts the
control exists and that pressing it lands on the promised address, and no further.

## What a journey asserts, and what it never asserts

**A wireframe's number is not a specification.** Somebody typed 1,358 into a tile to show what a
tile looks like with a large number in it. A demand that copies that figure out of the frame makes
the seed answer to a sketch — and a seed bent to satisfy a sketch is a seed that has stopped being
a description of the product.

**Assert the relation instead.** These are the ones a generator reads off a frame without knowing
any value, and each is something a journey test asserts with no number known in advance:

| The frame draws | What the journey asserts |
| --- | --- |
| a tile with a `basis` naming its parts | the parts account for the value |
| a tab strip with counts over panes | each tab's count is its own pane's total |
| `pagination(pages, total, rows)` | the page count is the total over the rows, rounded up |
| a filter bar total above a table | the total is the set the table beneath it is showing |
| two panes drawing the same record | they answer the same question the same way |

**Each of these catches what a value comparison cannot: a screen whose own figures contradict each
other.** A value comparison catches only that the screen differs from a drawing.

**A literal value is demanded only where the value is a RULE, and a rule never lives only in a
wireframe.** A limit comes from the entitlement; a threshold from the entity's own default or a
design chapter; a period, a date or a retention span from a statute. So **a demand that needs a
literal figure cites the source that fixes it**, and a figure with no such source outside the board
is an illustration — assert the relation and let the seed say what it says.

**The evidence, because this reverses what a project will have written down.** One chapter's
judging round produced about a hundred disagreements across six screens. Every genuine defect among
the figures was a relation: a tile's basis that summed to less than its tile, a tile counting what
its own column drew as absent, a record registered after the delivery it describes was sent, a mean
that included the timeouts it claimed to exclude. **Exactly one was a pure value mismatch** — a
tile reading 4시간 전 where the frame drew 32분 전 — and satisfying it meant rewriting four hundred
rows on every boot so that a figure a wireframe author had typed would appear.

> **Read it this way and it is wrong**: 「then the figures do not matter and a screen may draw
> anything」. The relations are stricter than the values, not looser: a screen may draw any total
> it likes and must still make its parts sum to it, its tabs agree with their panes, and its pager
> agree with both. What is given up is only the claim that a sketch fixes the data.


## The seed relations say what the story must make true

The generator lists, per chapter, what the journeys need to exist before they can run: the
entities the chapter creates or reads, connected as the entity model says, in the states the frames
draw — a printer in each state the status tile counts, a request awaiting the approver the journey
signs in as, a site outside the scoped persona's reach so the negative journey has something to be
refused. **It lists relations and states, never quantities or names.** How many and called what is
the story's → `scenario.md`, and a value comes into existence only by the path the product uses →
`scenario.md` § *A value a capture shows is produced by the path the product uses*.

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

- **Each entry names the mechanism that holds it** — a rule in `auditScript`, or a helper every
  journey test calls. A sentence a person would have to re-read per screen is a note, not a check,
  and it is not declared: the whole point of the family is that the defect is caught on every
  screen built afterwards without anybody remembering the sentence exists.
- **The list GROWS as defects are found.** A defect met in the running product is fixed, and then
  its shape is added here with the check that catches it — otherwise it is fixed once, on the
  screen it was found on, and met again on every surface built afterwards. A project that ratchets
  is one whose list is longer than it was.

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

## An address a journey names is an address that opens

**Write the whole address, never the fragment.** A journey that says 「open it with `<parameter>`」
leaves the reader to decide what to hang it on, and the natural guess is the screen they are
already on. Where that screen does not read the parameter, nothing errors: the page answers with
exactly what it always answers, and the reader records the ordinary screen as the state they were
asked for. **The failure is silent, and silent is the whole problem** — a fragment written into
hundreds of lines is a demand nobody can tell they failed.

Where a project has a route that renders one frame in one state, that route's address is the whole
answer and the generator has the frame in hand: build the address, do not describe it.

## A journey is walked in the running application, never at a frame address

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

**So a journey test drives `journeyRoute` and never `captureRoute`.** The frame route is the address
a picture of one state is taken at, and a test that navigates by it presses controls that have
nowhere to go; `journeyTestsDriveTheApplication` reads the journey tests for the frame route and
reports one that uses it. **And where a control leads is a different question from whether anybody
can find it**: a way back whose one control was a chevron nobody sees passed a build in which every
destination resolved. The destination is the journey's to prove; whether a person can see the
control is the look's → `../SKILL.md` § *Matching the structure is the floor*.

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

## A fixture that answers a shape the server never answers photographs nothing

**A capture route's empty-data fixture is a claim about the product, and a wrong one is invisible.**
It exists to reach the states navigation cannot — a list with nothing in it, a screen answering a
failure — and a round photographs whatever it produces. So a fixture that answers in a shape the
server has no way to answer in **files a picture of a state the product cannot be in**, and every
finding read off that picture is about the fixture.

**The failure has no error in it.** One found here classified an intercepted read as either a page
or a record, and answered a record with `null`. An aggregate address — a count endpoint, a census,
a figures read — is neither: no `page`, no `size`, no `/search`, so it fell to "record" and came
back `{ body: null }` at status 200. Nothing threw, nothing was logged, the query reported success,
and six tiles drew an em-dash because the unwrapped body was `undefined`. **On a real empty
installation every one of those counts is a `count()` that cannot be null and every tile would have
drawn `0`.** Three screens' empty states were judged against that, across two rounds, before
anybody read the fixture.

**So the fixture is written from what the server actually answers, not from what is convenient to
return.** Read the service: a count is never null, an average over nothing is, a name of the next
expiring record is. The em-dash belongs to the values that answer 「which one」 and the zero to the
values that answer 「how many」, and a fixture that gives every value the same answer has decided
that question wrongly for half of them.

**And check the fixture before believing an empty-state finding.** The tell is that EVERY figure on
the screen is absent at once. A real empty installation draws zeros and keeps the lines that are
rules; a fixture that has stopped answering draws nothing anywhere, which reads as a screen doing
something deliberate.

## Written in the project's own words

Every label in a chapter file — what a persona line opens with, what a machine verdict is called,
how a state list reads — is declared as `chapterLines` and `verdictRole` and is not this file's to
choose. Write the generator against those, so that a project working in another language gets
demands rather than a template it has to translate.
