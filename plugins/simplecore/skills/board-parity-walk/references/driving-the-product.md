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

**The working record.** Every judging capture goes to an ignored directory whose
file names begin with a timestamp, and **the walk never deletes them.** Sorting
the directory is the history; keeping the before is what makes an after legible.
The person who owns the repository clears it when they are done.

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

## One machine, one driver

A device, a simulator, a browser profile: **the coordinator holds the queue and
hands it to one walker at a time.** Two walkers driving one device produce
captures of the wrong screen that look entirely correct. Checking whether a
process is running is not a substitute — two runs can both be between frames at
the same instant. `references/harness.md` carries the detail and the two failure
modes that follow.
