<!-- Written by /simplecore:board-init. Replace <PRODUCT> and fill the marked region at the end.
     Everything above that marker describes the kit and the pattern, which live in the
     `simplecore:wireframe-boards` skill — a change belongs there, not in this copy, or the next
     board starts from a version of this file that is already wrong. -->

# <PRODUCT> wireframe board — working rules

This folder is the **screen contract** for <PRODUCT>. The design documents decide behavior, this
board renders them as screens / states / flow, and the UI is built to match the board. The
rendered `board.html` is the artifact humans review; **what you edit is the content under `src/`**.

> **Do not open `board.html` to read it.** It is a thousands-of-lines build output; reading it
> whole just floods context. To find a screen, read `src/manifest.mjs` (the table of contents),
> then open the one screen file you need and the components it composes from.
>
> A **person** reading the board in a browser has the other route: the filter above the index
> narrows it to the screens whose id, name or section match what they type — `/` to focus it,
> Enter to open the first match, Esc to clear. Hangul initials find a screen too (`ㅅㅇㅈ` →
> `사업장`), and the filter never touches the board itself: every frame stays where it was.

## The board holds content; the kit holds everything else

There is no build script here. The engine, the gates, the exports, the components, the app shells
and the stylesheet all live in the `simplecore:wireframe-boards` skill, and `wf.mjs` is a
twenty-line bootstrap that finds them. **Nothing under `src/` is a tool** — a change to how boards
are built belongs in the skill, where every board gets it at once.

| Path | Role |
| ---- | ---- |
| `board.html` | Build output, for humans. **Never edit** — the build overwrites it. |
| `pdf/` | Every build's stamped PDF. Kept, not swept; git-ignored. |
| `src/manifest.mjs` | Table of contents, build order, section letters. **Read this first.** |
| `src/screens/<letter>-<nn>-<slug>.mjs` | One screen = a data object + a body composed from components. |
| `src/chrome.mjs` | This product's tabs, menu tree, roles and purchase, handed to the pattern's shell factories. |
| `src/components.mjs` | A one-line re-export of the pattern's kit. Do not add to it. |
| `src/crud.mjs` | The CRUD ledger — where each entity's five verbs live. |
| `src/roles.mjs` | Who reaches which cluster, and the frame-level departures. |
| `src/intro.html` | The reading-contract items that are this product's own. Bare `<li>` only. |
| `board.config.mjs` | What belongs to THIS board: the pattern, the contract, the PDF name, the phases and feature keys, the documents the board must agree with. |
| `board.gates.mjs` | Gates true of this repository only, with their cases. |
| `dev.sh` | The development loop: build, watch, serve. A wrapper around `wf.mjs serve` and nothing else. |
| `.kit` | Machine-local pointer at the skill. Git-ignored; `wf.mjs` re-points it every run. |

```bash
./dev.sh                     # build, then rebuild and reload the browser on every change
./dev.sh --port 5000 --open  # another port, and open the browser too
node wf.mjs build            # board.html + pdf/<name>-<stamp>.pdf
node wf.mjs build --no-pdf   # HTML only, while iterating on a screen
node wf.mjs catalog          # _catalog.html — the component storybook
node wf.mjs check            # visual sweep: overflow, sideways scroll, the fold
node wf.mjs gates            # every gate against the defect it exists to catch
node wf.mjs doctor           # which contract this board is on, and what it owes
node wf.mjs shots _shots     # one PNG per frame
node wf.mjs pdf --mask 40% --watermark   # the share copy
```

**`./dev.sh` is the loop to work in.** It builds once, serves the board at
`http://127.0.0.1:4173/`, and rebuilds whenever a screen file, `board.config.mjs`,
`board.gates.mjs` or the pattern changes — the open page reloads itself and keeps its scroll
position, and a failed build reaches the browser as the build's own error rather than as a stale
frame. **The live-reload client is spliced into the HTTP response and into no file**, so
`board.html` on disk stays the script-free single file the reading contract requires.

## A permanent id, and a position that moves

- **Screens are addressed by their permanent id** (`B-04`), which lives in the file name and
  NEVER changes — not on insertion above it, not on a reorder, not when a neighbour is deleted.
  Name screens by id in anything that outlives a build: plans, specs, notes, a message to a person.
- **The bracketed number beside it is only the position** (`[02]B-04`), recomputed every build.
  Reorder the manifest freely; the brackets move and nothing else does.
- **Never renumber to close a gap.** Gaps are free. A renumber invalidates every reference anyone
  has written down, which is the one failure this scheme exists to prevent.
- **A narrow/wide pair is ONE screen**: both halves take the same id and position, and differ only
  by `variant`.
- **A new screen = one file in `src/screens/` + one line in `manifest.mjs`.**
- **A body writes no raw HTML tags.** Compose from the pattern's components and shells; when a
  primitive is missing, add it **to the pattern** and register it in `CATALOG`.

## Pointing at another screen

Point with the **file name** and let the build print that screen's id, so the note keeps working
even if the screen is renamed later:

```js
notes: '작업허가({{e-24-permit-issue}})와 다르다 — 이쪽은 반납 확인이다'
```

A slug that matches nothing is left in place as `{{slug?}}` rather than dropped.

## The reading contract has three layers, and only the last is yours

The rendered `.readme` at the foot of the board is assembled from three places, and each may only
**append**: the kit's standing items (what a wireframe is and is not), then the pattern's, then
`src/intro.html`. Nothing here can drop the standing contract — that is structural, not a promise.

The PDF does not carry the contract at all: implementing is done from the HTML board.

## A defect found twice becomes a gate

The build refuses rather than warns. Gates come from three places, and **which place a gate
belongs in is the design decision**: the kit's (true of any board), the pattern's (true of any
board drawn this way), and `board.gates.mjs` (true of this repository only). Ask whether it would
still be right on somebody else's board — that is the whole test.

- **Every finding refuses the build.** There is no warn level and no lenient mode.
- **A new gate gets its two cases in the same change**: one board that must trip it, one that must
  not. `node wf.mjs gates` runs them and names any gate that has none.
- **What is true of THIS board and not of the tool goes in `board.config.mjs`.**

## Finishing a step — in this order, every time

A step is a cluster drawn, a pattern added, or a frame changed. It is not finished until these
three have run, **in this order**:

1. **Korean audit first.** Fixing the words changes the frames, so auditing them after the visual
   sweep means sweeping twice — and the second sweep is the one that gets skipped.
2. **Visual sweep second**, over every frame: `node wf.mjs check`. It exits non-zero on sideways
   overflow, a primary action below the fold, or the board scrolling sideways at 1900 / 1440 /
   1280px. Then **open some of the captures and look** — the script measures geometry and cannot
   see a wrong word.
3. **Send the captures.** `node wf.mjs shots _shots [idPrefix]`. A step reported without pictures
   is a step nobody can check.

**Stage new screen files before auditing.** The resource sweep enumerates through `git ls-files`,
so a cluster written and not yet staged is skipped in silence and the audit reports zero.

## A responsive pair brings the toggle back

A new board ships **no viewport toggle**, because it draws no `.narrow`/`.wide` pair yet and a
control that changes nothing reads as a broken one. Nothing has to be restored by hand: the build
draws the toggle the moment a frame declares `variant: 'narrow'` or `'wide'`.

A pair is one screen at two widths, sharing one id. A separate phone frame is a different thing —
the console at phone width is another layout rather than a reflow of the desktop one, so it is a
frame of its own with an id of its own.

## A frame that spreads another frame's module inherits whatever was mis-read out of it

**A checker that reads a frame's source by pattern is a reader the frame cannot see**, and a frame
built from `...base` inherits that reader's mistake along with the body. So a finding can name a
file whose source does not contain the thing the finding is about.

It happened: a component option named `role` collided with a frame's own `role:`, and three of the
eight frames reported had no `role` in their source at all — they spread the module of a frame that
did. **The three were only found because the check is an error rather than a warning**; scrolled
past, they would have stayed.

**So when a pattern-reading check fires, look past the named files to what spreads them**, and when
naming a component option, check it against the keys a frame declares — the collision is invisible
from inside the kit.

## A frame id in prose is a citation, whatever the sentence around it says

This applies wherever `documents.scan` is declared, and it is a property of the check rather than a
preference about wording — a reader who takes it for style works around it and the build stops
again.

**The document scan reads an id and cannot read the sentence's polarity.** It has no way to tell
「X-NN draws the roster」 from 「X-NN is not on the board」, so both come back as a document calling a
frame the board does not draw, and the build refuses.

**So absence is written as the numbers on either side.** 「N-24와 N-26 사이의 번호는 보드에 없다」
carries the same point — a skipped number is not a typo — and gives the scan nothing to catch on.

**A range is the same mistake with more surface, and it hides things.** A frame id is a permanent
number; it carries no relation to any ordering a document happens to be arguing about. So
`N-22~N-29` in prose asserts something nobody checked, and it quietly covers a number that is not
there at all — a range like that is exactly where the missing number hides. Write the ids the
sentence means, or name the set some other way.

## Korean is audited at every step, not at the end

Run all four commands, because they check different things and three of them stay silent when the
resource declaration is missing:

```bash
T="$HOME/.claude/skills/simplecore/skills/korean-docs/scripts/l10n.mjs"
node "$T" check && node "$T" rules && node "$T" audit && node "$T" suspects
```

Declare the board's sources as a resource kind in `.claude/l10n.json` and in the project
glossary's `audit.localeResources`, so a frame's fixed wording is held to the same standard as
screen copy — which it is, since that wording ships to the screen unchanged.

**The script finds only what a regex can see.** On top of it, READ what was written: a frame's
`notes` are prose a person will read, and the labels, buttons, empty states and messages are the
product's own words. What the script cannot judge — a sentence whose subject and verb disagree, a
term this domain uses differently, a statutory phrase paraphrased into something that no longer
names the same duty — is found by reading, and reading is not optional because the frames are
where those words are decided.

**A correction the user makes goes into the glossary in the same change**
(`.claude/GLOSSARY.md`), never only into the frame — otherwise the same correction is needed again
in the next cluster.

**After drawing or changing a screen, ask the user whether to run a persona review.** Ask; do not
run it unasked and do not skip it.

## Living contract — build from it, reconcile, sync

- **Build from it:** implement every state / flow / fixed string a frame draws; match content,
  states and flow, never appearance.
- **Reconcile:** audit board ⇄ code both ways.
- **Sync:** a screen, dialog, state or flow **added** during development is back-filled as a frame
  in the same change. A design decision that **changes** updates the board only with the design
  owner's sign-off, and the document it derives from in the same breath.

This board is maintained with the `simplecore:wireframe-boards` skill; its rules are the
authority. When it is not in the `Skill` tool list, install it
(`claude plugin install simplecore@simplecore-skills`) rather than working from memory.

<!-- ═══════════════════════════════════════════════════════════════════════════════════════════
     BOARD-SPECIFIC RULES — everything below this line is yours

     Write what is true of THIS product and nowhere else: the apps and their widths, the domain's
     vocabulary, the conventions review settled, the traps a frame keeps falling into. This region
     survives every skill update — `/simplecore:board-migrate` reads this marker and carries the
     text below it across unchanged.

     Two things do NOT belong here:
       · a rule true of any board drawn in this pattern — that goes in the pattern, so the next
         product gets it too
       · a rule a regex could enforce — that goes in `board.gates.mjs` with its two cases, because
         a rule a person has to remember is a rule that comes back next month

     Keep the marker line exactly as it is.
     ═══════════════════════════════════════════════════════════════════════════════════════════ -->

## This board's own rules

_(Nothing yet. Write the first one the day a review settles something.)_
