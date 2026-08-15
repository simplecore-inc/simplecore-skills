<!-- Written by /simplecore:board-init. Replace PRODUCT and fill the marked region at the end.
     Everything above that marker describes the kit and the pattern, which live in the
     `simplecore:wireframe-boards` skill — a change belongs there, not in this copy, or the next
     board starts from a version of this file that is already wrong. -->

# PRODUCT wireframe board — working rules

This folder is the **screen contract** for PRODUCT. The design documents decide behavior, this
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
| `.kit` | Machine-local pointer at the skill. Git-ignored; `wf.mjs` re-points it every run. |

```bash
node wf.mjs build            # board.html + pdf/<name>-<stamp>.pdf
node wf.mjs build --no-pdf   # HTML only, while iterating on a screen
node wf.mjs catalog          # _catalog.html — the component storybook
node wf.mjs check            # visual sweep: overflow, sideways scroll, the fold
node wf.mjs gates            # every gate against the defect it exists to catch
node wf.mjs doctor           # which contract this board is on, and what it owes
node wf.mjs shots _shots     # one PNG per frame
node wf.mjs pdf --mask 40% --watermark   # the share copy
```

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
