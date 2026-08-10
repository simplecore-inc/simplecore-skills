# What a frame owes besides working code

Read this when a project's `frameDeliverables` is non-empty, or when deciding what
one should hold. Everything here is about what outlives the walk — captures,
snapshots, a story step — and about the ways they quietly stop describing the
product.

Some projects require something per frame beyond the code — a capture under
realistic data, a story step, a snapshot test, a look taken with somebody's own
eyes. Where that is so, the config names it:

```json
"frameDeliverables": [
  "a capture of this frame id in every locale it ships in, under capturesDir",
  "a snapshot test naming this frame id"
]
```

Each line is a plain sentence a walker can check against what the walk produced.
**A frame that owes a deliverable is not walked until the deliverable exists**, and
so it is not deleted from the list — which is what keeps it from becoming a
separate pass that never happens.

Two rules make that affordable rather than doubling the work:

- **The same walker produces it, in the same cluster.** An artefact written later,
  by somebody who did not drive the screen, describes what the code seems to do
  rather than what it does.
- **Every axis a capture varies along is decided before the first capture, not after.**
  A capture is identified by frame **and** locale **and** device class — and any other
  axis the product actually has. Each one that gets added later means re-capturing
  every frame walked so far and reworking the scripts that produce them, which is the
  most avoidable rework a walk can generate. A board that names a tablet frame has a
  device axis whether or not the first section uses it.
- **What generates it must be deterministic.** A capture that differs on every run
  — a live clock, a random id, an animation caught mid-flight, a status bar showing
  the real time — makes every re-capture a change nobody can read. Where a project
  keeps captures, it owes a way to reach any frame in any state with the moving parts
  pinned; a walker that finds no such mechanism reports it as owed rather than
  hand-driving 150 screens.

  **A frame leaves nothing unseen, and that takes as many pictures as it takes.** A
  phone viewport holds a fraction of most screens, so one screenshot documents a
  screen's opening and drops its actions — silently, looking like a complete image of
  a short screen. The answer is another picture, scrolled to what was hidden, not a
  taller image built out of several: **one picture is one screenful** and stitching is
  banned outright → `references/driving-the-product.md`. What produces them decides
  where the scroll stops, and produces the same stops on every run.

  Two details decide whether pinning actually works. The **data and the display must
  be pinned to the same instant** — a frozen clock over sample timestamps taken from
  the real one gives a number that is stable and wrong. And a **rerun over unchanged
  frames must produce byte-identical files**, because that is the only thing that
  makes a board-wide re-capture reviewable.

- **A stale artefact must be detectable, not remembered.** This is where kept
  captures usually die. A screen changes in month three, and nobody can say which of
  the images taken in month one are now lying — so either everything is retaken (and
  the diff is unreviewable, so nobody reads it) or nothing is (and the artefacts
  quietly stop describing the product). Both outcomes look identical in review.

  The answer is a fingerprint per artefact, over **exactly** what determined it: the
  screen's module and its transitive import closure, the copy values for the keys that
  closure uses *in that locale*, the sample data it reads, and the generated theme.
  Then a check names the stale ones and the command that refreshes them. Two
  properties make or break it:

  - **Granularity.** Fingerprinting whole packages means one shared-component tweak
    invalidates every frame, which is the "retake everything" failure wearing a
    tool's clothes. Follow the import graph.
  - **Per-locale inputs.** A wording change in one language must not invalidate the
    other language's artefacts.

  The same reasoning applies in the other direction: **a board frame edited after it
  was walked puts that frame back on the parity list.** The contract moved, so the
  code is no longer known to match it — and this too is read from history rather than
  from somebody's memory of what they changed.

- **Regeneratable does not mean deferrable when the source moves.** A capture can be
  remade at any time — from the code **as it stands then**, which is a different screen.
  So an artefact whose input keeps changing is captured while the input is in front of
  you, even for an output nobody consumes yet: a wider device with no edition written
  for it, a state no page references. Later that edition becomes substitution rather
  than a second pass over the board.

  This cuts against the previous point rather than restating it, and the line between
  them is whether the *input* is stable. A language is cheap to add later because the
  screens do not change when it arrives. A device is not, because the screen it would
  have photographed is gone.

- **A regeneratable artefact is cheap to add later; a hand-made one is not.** This is
  worth stating because it changes product decisions well outside the walk. When
  captures are genuinely one command over the whole board, adding a language or a
  device class later costs a command — so there is no reason to add languages early
  "while we are capturing", and every reason not to: copy churns hardest while the
  screens are still being built, and each extra language multiplies that churn.
  When captures are hand-made, the same decision inverts and everything has to be
  decided up front. A walk should know which of the two it is in, and say so.

A project that declares no `frameDeliverables` owes nothing beyond the code.

### Looking and keeping are different jobs, and only one is expensive

The visual pass catches what nothing else can — a styling engine that dropped a class,
a font with no glyph for a script, a label cut off at an edge. That has to happen on
every frame, always. **Keeping** the images is the part that costs: a change to a shared
component invalidates every frame that renders it, so re-shooting is a fixed price that
grows with the board — four and a half minutes across thirteen frames, an hour across a
hundred and fifty, paid every time anybody touches a common primitive. They will, for as
long as the product is being built.

So a project part-way through its screens can reasonably **look on every frame and keep
nothing**: judge with throwaway captures, and take the kept ones once, at the end, from
a finished product in a known state. That also removes a defect nobody names — a set of
figures taken across eight months of versions, each true when it was shot and none of
them true together.

### Re-shoot what the change reaches, and one frame either side of it

After a fix, "re-shoot everything" is not thoroughness — it is **not having decided what
the change reaches.** The set is derivable: a fix to one screen reaches that screen, a fix
to a shared primitive reaches every frame that renders it, and a fix to the capture
pipeline reaches every frame the broken part applied to. A bar drawn only on a tab's first
screen cannot have mis-measured a screen that never had it.

So before re-shooting, name the set and say what puts a frame in it. Then shoot that set,
plus **one frame known to be outside it** — the regression check that proves the fix did
not move something it had no business moving. Two frames of evidence beat a hundred
frames of hope, and the difference is where the simulator hours go.

Where the set is genuinely the whole board — a token, a font, a layout primitive every
screen sits on — say so, and shoot it all. The rule is not "shoot less". It is that the
scope is a judgment somebody made, rather than a question nobody asked.

### One story, kept consistent — not a pile of per-screen fixtures

Sample data invented beside each screen disagrees with itself. The reader on the list
becomes a different reader on the detail page, and no test can see it because each screen
is internally fine. The fix is a single document holding the product's sample data **as a
narrative**, each step naming the frames it feeds, and **the step is written before the
screen** — written afterwards, the story is reverse-engineered from whatever the screens
happened to show, which is the disagreement it exists to prevent. The rest of it →
`references/scenario.md`.

### Sample data is in every capture, in every language

Copy is translated; the data on top of it is not. A reader named `정문`, a customer
called `홍길동`, a note written in Korean — each appears **verbatim in every locale's
capture**, so sample data is the one thing on a screen that cannot be right in all of
them at once.

Write it in the language that is least wrong everywhere. In practice that is English:
English names in a Korean document read as a foreign example, while Korean names in an
English one read as a defect. Whatever a project picks, it picks once and writes
the reason down, because every fixture anybody adds afterwards inherits it.

### A wider device is cheap to answer early and expensive to answer late

Where the board draws no layout for a wider screen, the screens still render there, so
a primitive that holds content to a readable column makes every unbuilt frame
acceptable on the wider device at once. Fixing that per screen later is the whole
board's worth of work. The rule about judging a frame in its longest language runs on
the same footing: **every language the interface ships in**, whether or not anything
else in the product has been written for it.

### Data in a catalogue is worse than a literal

The checkers push people into this one: a screen may not state a literal, so a value
with nowhere else to go gets added to the translation catalogue and the checker goes
quiet. It then reaches a translator as though it were copy, it makes a count or a
name untranslatable-but-translated, and it hides the fact that the screen has no data
source. Data belongs in the project's fixtures; a sentence with a value in it stays a
key, and the value is passed in.
