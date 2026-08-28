# Judging a frame, and why looking is not optional

Matching the board is the floor. A frame can match the board exactly and still be a screen nobody
can work in, because the board contracts structure, content, states and flow — it
cannot say whether the operator has the value they need to decide, or whether the words
mean anything to the person reading them.

## The three lenses that stand on any board

Every frame is judged as well as compared, in character:

| Lens | Asks | Counts as a finding |
| --- | --- | --- |
| **UI/UX reviewer** | Does the eye land where the task starts? Is the same thing in the same place on every screen that shows it? Does every state have an exit? | A buried primary action; two screens solving one problem differently; a state with no way out |
| **The operator** — whose work these screens carry | Can I finish here without asking anyone? Is the value I decide on actually on screen? Could I know what to type in every field? | A decision the screen gives no data for; a lookup that needs another screen; a field whose value the user cannot know |
| **The end user** — the person the service is for | Do I understand these words? Do I know what happens next? Is anything here that should never be shown to me? | Internal vocabulary, codes or identifiers on a subject-facing screen; an action whose consequence is unstated; an error with no way out |

The board names the rest: a flow with an approver, a kiosk walk-up or a first-time
visitor gets that persona too, derived the way the board's `AUTH:` notes already name
who may enter a screen.

**Where the project has its own screen-audit skill, that skill is the rubric.** A stack
that ships one has it anchored to that stack's own invariants rather than to taste, which
is stricter than anything general can be. Load it and judge with it; the three above are
the floor for a project that has none.

**Anchor every finding to a frame number and the action it blocked.** A finding with
neither is an opinion — it goes to the project's parked items as a proposal, never into
the code.

The rest of this file is what judging actually costs — the failures that pass every
gate, the languages that hide them, and the two habits that keep them from coming back.

## A board contracts structure, not the values in its illustration

Which fields appear, in which state, with which wording keys, and how one screen reaches
another — those the code owes. The counts, names and dates drawn beside them are there to
make the picture legible, and asking whether they are contractual is a malformed question:
it is a wireframe, so of course they are illustration. Two failures follow from confusing
the two, and both cost a session:

- **Bending the product to reach a drawn number.** A frame said nine works; the fixture,
  once its own defect was fixed, honestly produced twenty-eight. Chasing the nine would
  have meant rewriting the population to fit a drawing — one drawn by hand, from nothing,
  with a row naming a person the app holds no photograph for.
- **Making the drawing track the fixture.** The mirror error, and the one to guard against
  while fixing the first: derive the illustration from live data and every fixture change
  ripples into the board. A wireframe does not owe that coupling.

**What a board's values do owe is agreement with themselves.** A person drawn as
*photograph replaced* in one frame and *no photograph* in another is the board
contradicting itself, and that is a defect whatever the product holds. Judge illustration
against the rest of the illustration, never against the fixture.

So when the board is synced because the code was right and the board was stale, only the
layer a board contracts moves — screens, content, states, flow, fixed wording. Restyling
and copy-catalogue text never touch it.

## A screen's header holds what that screen does, and no way to another screen

Navigation is the menu's job, and the menu is regenerated from the board. A header that also
offers a way to another screen is **a second entrance to the same place, maintained by hand**,
and it ages the day that screen moves: the menu follows the board, the header does not, and
the header is left pointing at where the screen used to be. Nothing fails; the two entrances
simply disagree, and the one nobody regenerates is the one a reader trusts because it is
right there on the page.

**A control that leads somewhere a later chapter will build is the same thing.** Drawn
disabled it still promises a destination the menu is already promising.

**The component name hides this completely.** A purpose-built link component put nine such
controls on four screens; deleting it left the same nine doing the same job under a different
component's name, on the same four screens. **So judge the header by the label, not by what
renders it** — a header action whose label matches a menu entry is a door, whatever component
drew it.

**Compare a header against its frame whole, never screen by screen.** Unlike a list or a form
there is nothing to weigh up: the frame's header declaration names that screen's controls
exhaustively, so the two sets are simply compared. Pair the two directions and grade them
differently:

- **A control in the code and not in the frame is an error.** It reached the screen without
  passing through the contract, which is exactly how the nine doors arrived.
- **A control in the frame and not in the code is a warning** — often enough it is a later
  chapter's work, and that absence belongs in that chapter's evidence.

Two things stay with eyes. **Tone is invisible to a checker**: a board writes it at the call
site while code puts it inside a shared button, so the calling code has none to read. And **a
control whose label changes with state is one control** — matching the one state the frame
drew is the whole requirement.

## A defect read off a picture is confirmed in the source before it is called one

An image is evidence that something is on the screen; it is not evidence of which
words. Scaled to be looked at, small copy reads as whatever it resembles, and the
resemblance is strongest for exactly the pairs a terminology pass is hunting — the
banned word and the word that replaced it are near-identical shapes at a third size.

So the order is: see it in the picture, then **find the string in the source**. If
the source does not contain it, the reading was wrong — not the app. Three findings
were reported off one over-long capture, each naming a word that turned out to exist
nowhere in the repository, while the same screen's other frames drew the correct
word. The grep that would have caught all three took one command.

The rule cuts the other way too, and that half is what makes it worth keeping: a
defect the source **does** confirm is real whether or not the picture was legible,
which is what lets a mid-run or low-quality image still be useful.

## Green is not the same as seen

Every gate can pass on a screen nobody could use. The failures that survive such a pass
cost nothing to build, break no type, fail no test and read correctly in review —
and each of these was found by somebody looking, after everything was green:

- a screen's second and third **tabs** each drew "could not load"; the capture had
  only ever photographed the first one, because a capture shoots a screen and never
  presses anything
- **breadcrumb segments** were drawn and were not links. A trail that cannot be
  clicked looks exactly like one that can
- every capture ran in one **browser locale**, so the Korean pictures carried
  `mm/dd/yyyy` — and put English server sentences in front of a Korean reader
- the search term on a "**matched nothing**" frame was a substring of a project in
  the sample data, so every run photographed a screen with one row on it and filed
  it under the empty state's name
- **detections pointed at the wrong span**: the sample data computed positions by
  arithmetic, so masking covered text that was not sensitive while the value it was
  meant to hide stayed in plain sight
- a **fixture** answered where the server had since started answering differently,
  so two contracts on one address disagreed and nothing failed
- a frame that **declares what data it needs** rendered nothing at all on an
  installation where that data was still empty: the query it waited on was disabled
  rather than answered, a disabled query never resolves, and the wait therefore never
  ended. The route answered 200, raised no console error and painted the chrome —
  which is what every other check in the arrangement reads as a pass. **The frame it
  hit hardest was the one about an empty project**, because that frame is the only one
  whose whole subject is the state that triggers it, and 125 frames declared the same
  dependency

The shape repeats: **absence costs nothing to build, trips no check, and reads
clean.** So judgment is looking, and looking means pressing — open the tabs behind
the first one, click the trail, run the real detector over the real data, and delete
the fixture to see what the screen draws without it.

**And open the frame on the state it is about, not only on a full installation.** An
empty-state frame photographed against seeded data is the one case where the sample
that makes every other frame legible is the sample that hides the defect: the screen
works because the data it was waiting for happens to be there. Whatever a frame's
subject is — nothing uploaded yet, nobody invited yet, the first run — the
installation has to actually be in that state while somebody looks. A rule that can be written for
any of these is worth more than the fix, because the next instance is already being
built.

## A frame is not judged until it has been seen in its longest language

Text length is not a property of a screen; it is a property of a language, and the
language a product is designed in is almost always one of its most compact. Korean,
Chinese and Japanese run short; English runs roughly half again as long; German and
Finnish longer still. So the source locale is precisely the one that hides every
overflow — a tile that wraps, a segmented control that breaks into two ragged rows, a
label clipped at the edge, a button whose text no longer fits its box. All of it looks
perfect in the language it was written in, and all of it reaches whoever reads the
product in the other one.

Three rules follow, and the last is the one that lasts:

1. **Look at the frame in every locale it ships in**, longest first. A capture in one
   language is not evidence about the others.
2. **Fix it in the component, never in the screen.** A screen that works around a long
   label has fixed one screen; the next screen with a long label breaks identically.
   The component is where "this must survive any string" belongs.
3. **Judge against a generated pseudo-locale, not against the translations you happen
   to have.** Fixing a layout until the current English fits passes one language and
   defers the problem: Russian, German and Finnish would break the same component
   again, and nobody finds out until that language ships. A pseudo-locale — the `en-XA`
   idea, each string mechanically expanded by half, rendered in accented forms and
   bracketed so truncation is visible — is generated from the source and therefore
   covers **every key, forever, at no translation cost and with no file anybody
   maintains.** It also catches an unrelated defect for free: any text that comes out
   unaccented was never a key.

   Adding a real long language instead (Russian is the usual suggestion) buys the same
   coverage for a permanent translation bill and a file that silently falls behind the
   source. Prefer the generated one, and keep it out of the mirroring check and out of
   the documented languages — it is an instrument, not a language the product speaks.

### Not overflowing is not the same as being aligned

A row of repeating units — stat tiles, cards, list rows — exists so the eye can compare
one value against the next, and that comparison dies the moment a wrapped label pushes
one value onto a different line from its neighbours. Nothing is clipped, nothing is cut
off, and the row has still stopped doing its job. In the source language every label is
one line, so the defect does not exist there at all.

The fix is to decide, per repeating unit, **which element is anchored and which absorbs
the variation** — anchor the value and let the label take whatever height it needs, so a
one-line and a three-line label leave their values on the same baseline. Reserving a
fixed height for the label instead is a guess about the longest string, and the
pseudo-locale breaks it on the first run.

The test to apply is not "does the longest string I have fit". It is **"can any string
break this"** — a component that reflows gracefully at any length is done; one that
happens to fit at twelve characters is not. When a component cannot be made
length-proof by compressing, change its shape rather than its type size: let a row of
four tiles become two rows of two, or move an icon off the label's line so the label
gets the full width. Squeezing is what runs out; rearranging does not.

## Some defects no test can fail on, and those are the reason for looking

A styling engine that drops a class it could not see, an asset that falls back to
another face, a value that formats in the wrong language — each produces a screen that
is calmly, plausibly wrong while types, lint, tests and every custom checker stay
green. There is nothing to assert against, because the code says what it should and the
toolchain silently did something else with it.

That is not an argument against checkers; a defect seen twice still becomes a rule, and
some of these become one the moment you understand them. It is an argument about what
the visual pass is **for**: not confirming what the tests already know, but catching the
class of failure that has no witness except the screen. **Treat a pass with no captures
looked at as one that did not happen**, however green it was.

### Taking a capture is not reading one

The sweep is a script. It navigates, waits, shoots, and writes a file — and none of that
is looking, because nothing in it decodes the image. So an agent can finish a chapter
having produced twenty-eight pictures and seen none of them, and the sentence it then
writes about what was on the screen comes from somewhere else: the DOM it queried, the
responses it read, and its own memory of what it built. **Every one of those sentences is
true of the data and says nothing about the picture.**

That is how a screen states 「적용 법령 14개」 in a tile, 「적용 14」 in a tab and
「전체 14건」 in its toolbar, draws not one row, and is written up as 「법령 열넷」. Fourteen
statutes are not there; a number reading fourteen is. Nothing in the report is a lie and
nothing in it was seen.

So wherever the arrangement asks for a sentence about what was on the screen:

1. **Open the image file itself, first.** Before the sentence is written, not after it as a
   confirmation — a sentence already written is what the eye then goes looking to confirm.
2. **Write the sentence from the picture, and from the picture only.** A count read off a
   response, a row known to exist because the query returned it, a state inferred from the
   code — none of those belong in it. Where the picture cannot settle something the
   sentence needs, that is a second sentence with its own evidence, not a blend.
3. **Say what is absent as readily as what is present.** The failure this catches is always
   an absence — a list with no rows, a panel with no content, a shell with nothing in it —
   and an absence is the one thing a reader scanning for content does not register.
4. **Two defects can only be settled by a script reading the RENDERED page, and it runs
   while the screen is open.** They are worth naming because a project that has not met
   them does not know to look: **a list total stating N rows over a column that draws
   none**, and **two pieces of text painted into one rectangle**. Both are invisible to a
   source audit and to a request probe — the markup is right, every request answers 200 —
   and the second is what 「the tables are drawn on top of each other」 looks like to a
   machine. The command that runs them belongs to the project (`auditScript`, or the entry
   in `gates` that reaches it) and never to the `gates` list alone: that list runs with no
   server up, so a rendered check wired into it reports a pass having looked at nothing.

> **Read it this way and it is wrong**: 「the capture exists, so the screen was seen」. The
> capture proves a browser was opened and a file was written. Whether anything in it was
> read leaves no trace at all, which is why it needs a named reader and a moment rather
> than a habit → `../SKILL.md` § Closing a chapter.

### Looking settles the picture, never the button

A picture proves what a screen says. It cannot prove that the thing it offers to do
happens. So a screen whose only action is dead photographs perfectly — the layout is
right, the wording is right, and the defect lives entirely on the far side of the
control. Types and checkers are just as quiet: the route exists, the handler is wired,
the destination renders.

**Press the actions a frame draws, and follow where they land.** Weight it by how much
of the screen depends on it:

- **A screen offering exactly one action is a dead end if that action goes nowhere.**
  This is the case worth hunting first — a refusal state, an empty state, a blocked
  state. Its whole purpose is to hand somebody a way out, and it is the state nobody
  reaches while building, so the way out is the least-travelled path in the product.
- **A promise in the copy is part of the action.** Where the screen says what pressing
  will do, the press must do that. Text promising a request will be sent, above a row
  that only navigates, is one defect and not two.
- **A round trip has to change what sent you.** A screen that sends somebody away to fix
  a value and shows the same refusal when they return has offered a remedy that cannot
  be taken. Returning is the moment to re-ask, and that is not the same as a retry
  control — some refusals must never carry one.

Two habits keep this from recurring once it has bitten:

- **The test runner is not the target.** Where tests run on one engine and the product
  runs on another, every capability the code reads — an API's presence, an option's
  effect, a font's coverage — is a fact about the target that the test environment will
  answer differently and confidently. Measure it **on the target**, once, and write the
  answer where the next person will look before assuming their own runtime's behaviour.
- **A probe that could not observe has told you nothing, and nothing is not an answer.**
  Reading an absent result as a value is how a correction gets applied to the case it was
  never meant for. Where a derived rule cannot be established, the underived default is
  what ships — it was already right, or it would have been reported long ago.
