# Judging a frame, and why looking is not optional

Parity is the floor. A frame can match the board exactly and still be a screen nobody
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

**Where the project has its own screen-audit skill, that skill is the rubric** — in a
simplix-react repository, `simplix:frontend-e2e` carries four lenses and five censuses
anchored to the frontend handbook's invariants rather than to taste. Load it and judge
with it; the three above are the floor for a project that has none.

**Anchor every finding to a frame number and the action it blocked.** A finding with
neither is an opinion — it goes to the parked section as a proposal, never into the code.

The rest of this file is what judging actually costs — the failures that pass every
gate, the languages that hide them, and the two habits that keep them from coming back.

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

Every gate can pass on a screen nobody could use. The failures that survive a walk
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

The shape repeats: **absence costs nothing to build, trips no check, and reads
clean.** So judgment is looking, and looking means pressing — open the tabs behind
the first one, click the trail, run the real detector over the real data, and delete
the fixture to see what the screen draws without it. A rule that can be written for
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
class of failure that has no witness except the screen. **Treat a walk with no captures
looked at as a walk that did not happen**, however green it was.

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
