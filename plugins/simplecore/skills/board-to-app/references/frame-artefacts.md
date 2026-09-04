# What a frame owes besides working code

Read this when a project's `frameDeliverables` is non-empty, or when deciding what one should
hold, or when deciding what to do with the captures a journey run leaves behind.

## A standing check is held by code, and the list names what holds it

Some projects require something of every screen beyond working code — a rendered check nothing
can assert from source, a snapshot test, a rule about how a value is derived. Where that is so,
the config names it, **and every sentence names the mechanism that holds it**:

```json
"frameDeliverables": [
  "every list total states the rows its column draws — auditScript: rendered/list-total",
  "a control's destination resolves — journeys: helper assertDestination()"
]
```

A sentence a person would have to re-read per screen is a note and is not declared. The point of
the family is that a defect met once in the running product is caught on every screen built
afterwards without anybody remembering the sentence: a rule in `auditScript` runs across the tree,
a helper the journey tests call runs on every journey.

**The list is also where a defect the running product showed lands when no frame can draw it.** A
name the screen derived wrongly from what the system reported, a control whose destination is
nowhere: neither is something a board can draw, and both were found by a person using the built
product. So the list **grows** as such defects are found, each entry with the check that catches
it, and the sentence carries the pointer to where it was seen — an entry that cannot name a
sighting is an invented expectation → `references/demands.md` § *A defect the running product
showed, that no frame can draw, is a standing check*.

## A capture is the run's by-product, taken every run and kept only as the record's picture

A journey test takes one capture per screen-state it visits, into the chapter's folder under
`evidenceDir`, and the next run takes them again. Nothing has to detect a stale picture, because
no picture outlives the run that took it; nothing has to decide what a change reaches, because
the run reaches everything the journeys reach. What a capture owes is only this:

- **One picture is one screenful.** A viewport holds a fraction of most screens, so a screen whose
  actions sit below the fold gets a second picture scrolled to them, never a taller image stitched
  out of several → `references/driving-the-product.md`.
- **The data and the display are pinned to the same instant** where the screen draws a time — a
  frozen clock over timestamps taken from the real one gives a number that is stable and wrong.
- **It is taken through the window the project declared**, at the width and in the scheme the
  capture gates read → `references/config.md`.

A project that declares no `frameDeliverables` owes nothing beyond the code and its journeys — and
a defect no frame can draw then has nowhere to land, so it is fixed once on the screen it was found
on and met again on every screen built afterwards.

### Three reasons to photograph a screen, and none of them substitutes for another

Pictures get taken for three different purposes. They are confused constantly, because
all three are files ending in `.png`, and each confusion drops a different rule on the
floor.

| Picture | Why it is taken | What happens to it |
| --- | --- | --- |
| **Looking** — the visual pass | the only gate that catches what no test can fail on: a class the styling engine dropped, a font with no glyph, a label cut at an edge | every frame, in every locale and on every device that frame owes; thrown away when the work is over, never during it |
| **Showing** — what a change did | prose about a screen is unfalsifiable to the person reading it | the coordinator forwards the path the moment it appears, unopened, in the language a person reads |
| **Keeping** — figures a document holds onto | kept figures have to be true of **one** version of the product, not of eight months of it | its own naming scheme, outside `capturesDir`, in one run at the end from a finished product |

- **Looking is unconditional.** Not a project's to opt out of, not deferrable, not
  satisfied by a green gate → `references/judging-frames.md`.
- **Showing is owed whenever the work moves what a screen draws** — or moves the frame
  it is drawn against. It costs the coordinator a path, which is exactly why agents
  return paths and never images.
- **Keeping is nothing this work asks for.** No frame owes a picture that outlives it.
  A project that keeps figures for a document of its own runs that as its own scheme,
  on its own schedule, and nothing here waits for it or counts a screen unfinished
  without it.

### Looking and keeping are different jobs, and only one is expensive

The visual pass catches what nothing else can — a styling engine that dropped a class,
a font with no glyph for a script, a label cut off at an edge. That has to happen on
every frame, always. **Keeping** the images is the part that costs: a change to a shared
component invalidates every frame that renders it, so re-shooting is a fixed price that
grows with the board — four and a half minutes across thirteen frames, an hour across a
hundred and fifty, paid every time anybody touches a common primitive. They will, for as
long as the product is being built.

The journey run pays that price every time it runs, by machine, which is what makes keeping
nothing the right default: the pictures in a chapter's folder are the last run's, they are looked
at once at the close, and a document that wants a figure to keep takes it from a finished product
in a known state → *Three reasons to photograph a screen*.

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
