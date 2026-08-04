# Driving the product, and photographing it

A walk is judged on screens, so the walk has to open them and keep pictures of
them. This is how — and, more importantly, which failures of that machinery look
exactly like defects in the product.

## Choosing what drives the browser

For anything running in a browser, in this order, and **stop at the first one
that works**:

1. **Claude in Chrome** (`mcp__claude-in-chrome__*`) — the default. Call
   `tabs_context_mcp` first to confirm the extension is connected. **Only ever the
   local browser**: a walk drives a development server on this machine, and
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

Both platforms, when the product ships on both. A walk that only ever looks at
one is a walk that finds one platform's defects.

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

## The capture harness fails in ways that look like the product

Every item here has been read as a design defect at least once.

- **A swallowed deep link leaves the previous frame.** The picture is a perfectly
  good screen, filed under the wrong name, and it passes review. **Wait for the
  screen to actually change** rather than sleeping — know what is leaving and
  block until it is gone — and if it never changes, write no file and say so.
- **Arriving where you already are looks identical to a link that failed.** Send
  the app somewhere else first, then to the frame you want.
- **A stale bundle inflates the picture.** After several hot reloads a screen
  photographs taller than it is, often with the header redrawn in a lower band or
  a trailing element stretched to fill. **Relaunch the app before every frame**
  and accept the seconds; without it, any measurement taken from an image is a
  measurement of the bundle. See `references/harness.md`.
- **A screen taller than the viewport is stitched from bands**, and the seam eats
  a line — a button appears to cover the hint under it, a heading appears to be
  missing. Both are plausible layout defects. **Before writing up anything near a
  seam, take one unstitched screenshot of that spot.**
- **Two frames that render identically on one device can never both be
  photographed there.** That is not a failure to fix; it means one of them owes no
  picture on that device. Say which devices each frame owes, in the inventory,
  and check it before shooting twice.
- **Status bars belong to the device, not the product.** Hide them: the clock
  moves, and on some devices the date is rendered in the simulator's system
  language, which puts one language's date into another language's manual.

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
into — is a variant on the end of the name, because none of it changes where the
picture is looked for. Keep the variant to lower case, digits and hyphens.

**The moment is in the name, and the walk never deletes anything.** A frame shot
again otherwise lands on top of the picture it is being compared with, and then
nothing on disk says which picture is of when. Sorting the directory is the
history; keeping the before is what makes an after legible. The person who owns
the repository clears it when they are done.

**The directory holds frame captures and nothing else.** A picture of something
the board does not draw — a palette, an index page, a harness screen — has no
frame to be judged against and no place in the record; it belongs in the
session's scratch space. Whatever produces the kept figures of a manual is a
separate scheme with separate names, and the two must not be mixed.

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
place with no picture, months after the walker who took it has gone.

**A checker's fixtures never live inside what it guards.** Give the check a
directory argument and build the deliberately-wrong names somewhere else — the
session's scratch space. Fixtures written into the real pile survive the run that
made them, and from then on nobody can tell a fixture left by a dead agent from a
capture of a screen: both are files, both look shot. It also puts fake pictures
in front of whoever is watching the walk.

**The pictures a person judges.** The coordinator forwards each new capture to
the user **as it appears**, without opening it. The path is all that passes
through the coordinating context; the image renders for the reader and costs
nothing. Forwarding at the end of a cluster is a record, not a review — by then
the decisions are made.

**Send the user's own language first.** A pseudo-locale is an instrument: it
measures whether a layout survives long strings, and it is for the walker. A
person reading a screen to judge whether it says the right thing learns nothing
from accented filler. Shoot the source language first, keep it, and send that;
forward a pseudo-locale only when the point being made *is* the overflow. This
has to be said explicitly to walkers — several will otherwise shoot only the
instrument and report success.

Pair each send with one line naming the frame and what to look at. "Here is
H-13" is a file; "here is where the person tells the model no — check both
answers carry the same weight" is a review.

## One machine, one driver — and the machine decides which

A device, a simulator, a browser profile: two walkers driving one produce
**captures of the wrong screen that look entirely correct.** So one at a time is
real. But **do not make the coordinator the queue** — that was tried and it stalls
walkers on permissions they already hold, because every run becomes a message that
can cross or drop.

**Take a lock in the capture script itself.** Atomically on start, released on exit
and on signal, cleared when the holder's process is gone so a killed run cannot
deadlock the next one, and refusing loudly with who holds it and what they are
shooting. Nobody asks, so nobody waits.

Checking whether a process is running is not a substitute — two runs can both be
between frames at the same instant. `references/harness.md` carries the full
account, including how to prove the lock actually refuses.
