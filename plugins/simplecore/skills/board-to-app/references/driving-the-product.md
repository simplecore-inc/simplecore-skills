# Driving the product, and photographing it

This work is judged on screens, so it has to open them and keep pictures of
them. This is how — and, more importantly, which failures of that machinery look
exactly like defects in the product.

## Choosing what drives the browser

For anything running in a browser, in this order, and **stop at the first one
that works**:

1. **Claude in Chrome** (`mcp__claude-in-chrome__*`) — the default. Call
   `tabs_context_mcp` first to confirm the extension is connected. **Only ever the
   local browser**: the agent drives a development server on this machine, and
   pointing a remote or shared browser at it is neither reproducible nor yours to
   do.
2. **Playwright** — when the extension reports "Browser extension is not
   connected", or when the task genuinely needs scripted determinism (a hundred
   screenshots, a fixed viewport matrix).
3. **A browser-driving agent** — last, for a task the first two cannot express.

**Say which one you fell back to, and why.** A capture taken through a different
driver can differ in device pixel ratio, fonts, and scrollbar width; a reader
comparing two runs needs to know the instrument changed.

## Choosing a device for a mobile product

Both platforms, when the product ships on both. A pass that only ever looks at
one finds one platform's defects.

**iOS — simulator.**

```bash
xcrun simctl list devices              # what exists, and which are booted
xcrun simctl boot <udid>               # or open -a Simulator
xcrun simctl install <udid> <path.app>
xcrun simctl launch <udid> <bundle-id>
xcrun simctl openurl <udid> "<scheme>://<route>"
xcrun simctl io <udid> screenshot out.png
```

**Android — emulator.**

```bash
emulator -list-avds
emulator -avd <name> &                 # or start it from the IDE
adb devices
adb install -r <path.apk>
adb shell am start -a android.intent.action.VIEW -d "<scheme>://<route>"
adb exec-out screencap -p > out.png
```

Three rules that hold on both, each of which has cost a session:

- **Pin the device model and OS version, and make the harness refuse anything
  else.** "A tablet" is not a device: a small tablet can be narrower than the
  product's wide breakpoint, so a capture filed as `tablet` shows the phone
  layout and nobody notices. Name the model, name the OS version, and fail loudly
  when what is booted is not it.
- **Boot exactly one device at a time.** Tools that address "the booted device"
  pick one while a window-driving tool clicks another — you press one device and
  photograph the other, and read the unchanged screen as "the control does not
  work". Name the identifier explicitly or shut the others down.
- **A newer OS may add a confirmation dialog to deep links.** When it does, every
  link needs a human tap inside the device and the whole capture path is blocked —
  while the screen behind the dialog is drawn correctly, so it does not read as an
  error. Pin to a version without it and say so.

## A capture route beats a scripted walkthrough

Do not photograph a screen by navigating to it the way a user would. Give the
product **an address that renders one frame, in one state, from named sample
data** — a route like `/frame/<id>` — and photograph that.

What it buys, all of which the navigation approach loses:

- **A state that no ordinary path reaches** — the empty list, the refusal, the
  half-finished retrieval — becomes as cheap to photograph as the happy one.
- **The clock is pinned**, so "12 seconds ago" is twelve seconds on every run.
  With a live clock every re-capture differs and the diff is meaningless.
- **Locale is a parameter**, so the same frame in each language is one flag apart.
- **A rerun of unchanged code produces byte-identical files.** That property is
  what makes every other check on captures possible; protect it above convenience.

Drive it by throwing a deep link at an already-running app rather than rebuilding
or editing files. The app must already be running; launch it first, then link.

## One picture is one screenful, and what is hidden gets its own picture

**Never stitch.** A screen taller than the viewport is photographed as it stands,
and whatever the viewport does not hold is reached by **scrolling to it and taking
another picture of the same frame**. Several pictures of one frame is the answer; a
tall image assembled from bands is not.

The requirement is **leave nothing unseen**, not "one image holds the whole screen" —
covering a frame is what matters, and several pictures cover it. Say on the inventory
which parts of a long frame owe one, so a scroll nobody took shows up as a missing
file rather than as a screen somebody decided was short.

Stitching earns the ban by what it costs when it goes wrong, which is always the
same thing: **an image with no error in it and no gap in it.** Three defects from
one board, each of which passed review:

- **The seam ate a line.** Every band boundary swallowed one row, and the row that
  vanished was the one a person has to press — in every picture, of every screen.
- **An element pinned to the viewport repeated.** A bar fixed to the bottom was
  drawn once per band, so one control appeared several times down a single image.
- **Fixing those two split the band height**, after which the bands overlapped and
  content appeared twice at different offsets.

None of the three reads as broken, which is the whole problem: a stitched image is
plausible by construction, so its failures have no witness.

Two things follow for anything that measures a picture. **An image's height is a
fact about the viewport, not about the screen** — nothing is derived from it, and
"how many screenfuls" is a property of the device rather than of the design. And
**the scroll position is part of the name**, like any other variant, so the second
picture of one frame is never confused with the first picture of another.

## The capture harness fails in ways that look like the product

Every item here has been read as a design defect at least once.

- **A swallowed deep link leaves the previous frame.** The picture is a perfectly
  good screen, filed under the wrong name, and it passes review. **Wait for the
  screen to actually change** rather than sleeping — know what is leaving and
  block until it is gone — and if it never changes, write no file and say so.
- **Arriving where you already are looks identical to a link that failed.** Send
  the app somewhere else first, then to the frame you want.
- **A stale bundle redraws the screen wrong.** After several hot reloads a screen
  photographs with its header repeated further down, or a trailing element
  stretched to fill. **Relaunch the app before every frame** and accept the
  seconds; without it, anything read off an image is a fact about the bundle. See
  `references/harness.md`.
- **A scrolled picture taken too early shows the scroll mid-flight.** Wait for the
  offset to settle, not for a duration.
- **Two frames that render identically on one device can never both be
  photographed there.** That is not a failure to fix; it means one of them owes no
  picture on that device. Say which devices each frame owes, in the inventory,
  and check it before shooting twice.
- **Status bars belong to the device, not the product.** Hide them: the clock
  moves, and on some devices the date is rendered in the simulator's system
  language, which puts one language's date into another language's picture.
- **A file read while the run is still going is not the artefact.** A capture that
  paginates writes a tall intermediate first and replaces it with the per-screenful
  files a moment later, so a frame opened mid-run comes back as one very long image
  — which then has to be scaled to be looked at, and small copy in a scaled image
  reads as whatever it resembles. Three "defects" were reported off one such image
  and all three were misreadings of correct text. **Wait for the run to report its
  own completion before opening anything it wrote**, and if an image arrives far
  taller than a screenful, that is the signal it is an intermediate rather than a
  long screen.

## What to keep, and what to show a person

Two different jobs, and conflating them costs either context or trust.

**The working record.** Every judging capture goes to the ignored directory the
config names (`capturesDir`), under one name:

```text
<language>/<YYYYMMDD-HHMM>-<frame-id>[-<variant>].png
```

**The language is the only folder.** Judging a frame is looking at it in each
language side by side, and a pile divided by width, by frame or by run scatters
the three pictures that have to be compared into three places. Everything else
that tells two pictures of one frame apart — the width, the state it was driven
into, how far down the frame it was taken — is a variant on the end of the name,
because none of it changes where the picture is looked for. Keep the variant to
lower case, digits and hyphens.

**The moment is in the name, and the pass never deletes anything.** A frame shot
again otherwise lands on top of the picture it is being compared with, and then
nothing on disk says which picture is of when. Sorting the directory is the
history; keeping the before is what makes an after legible. The person who owns
the repository clears it when they are done.

**The directory holds frame captures and nothing else.** A picture of something
the board does not draw — a palette, an index page, a harness screen — has no
frame to be judged against and no place in the record; it belongs in the
session's scratch space. Whatever produces a project's **kept** figures is a
separate scheme with separate names, and the two must not be mixed — which of the
three jobs a picture is doing is settled in the main document.

Both the directory name and the languages come from the project; the shape does
not. **Put the name in one function that every capture site calls, and a check
over the directory** — a rule passed along in prose is got wrong differently by
each agent that receives it. Told the rule and left to build the name themselves,
two of them produced a whole `new Date()` inside a file name, and a `w${width}`
on a run that had no width, which wrote `wundefined` on nine pictures. The
function stamps the moment and leaves an absent variant off entirely, so neither
is expressible.

**Let the checker parse with the same module the writer builds with.** Two copies
of the pattern both go green while the pile goes wrong, and the test that matters
is the round trip: every name the writer can produce is one the checker accepts.
Six silent ways to get it wrong otherwise — a folder that is not a language, a
folder inside a folder, no moment, no frame id, an id the board does not draw, a
folder left empty by a rename — each ends with a picture nobody can place, or a
place with no picture, months after the agent who took it has gone.

**A checker's fixtures never live inside what it guards.** Give the check a
directory argument and build the deliberately-wrong names somewhere else — the
session's scratch space. Fixtures written into the real pile survive the run that
made them, and from then on nobody can tell a fixture left by a dead agent from a
capture of a screen: both are files, both look shot. It also puts fake pictures
in front of whoever is watching the run.

**The pictures a person judges.** The coordinator forwards each new capture to
the user **as it appears**, without opening it. The path is all that passes
through the coordinating context; the image renders for the reader and costs
nothing. Forwarding at the end of a unit of work is a record, not a review — by then
the decisions are made.

**Send the user's own language first.** A pseudo-locale is an instrument: it
measures whether a layout survives long strings, and it is for the agent. A
person reading a screen to judge whether it says the right thing learns nothing
from accented filler. Shoot the source language first, keep it, and send that;
forward a pseudo-locale only when the point being made *is* the overflow. This
has to be said explicitly to agents — several will otherwise shoot only the
instrument and report success.

Pair each send with one line naming the frame and what to look at. "Here is
H-13" is a file; "here is where the person tells the model no — check both
answers carry the same weight" is a review.

## One machine, one driver

A device, a simulator, a browser profile: two runs driving one produce **captures
of the wrong screen that look entirely correct.** So **the capture script takes its
own lock** — atomically on start, released on exit and on signal, cleared when the
holder's process is gone, and refusing loudly with who holds it and what they are
shooting. Checking whether a process is running is not a substitute; two runs can
both be between frames at the same instant. Why the lock never lives in the
coordinator's messages, and how to prove it actually refuses →
`references/harness.md`.
