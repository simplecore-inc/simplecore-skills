# Scaling: a component kit, screen data, and a build

Read past roughly twenty frames, or once the same nav / titlebar / status bar
would be hand-copied into every article.

One file becomes a wall of grey that neither a person nor an LLM can navigate,
and every chrome edit is a find-replace across the whole board. At that size,
author the board as a small **source tree that builds into the same
deliverable** — the output invariant never changes: the build still emits one
self-contained, offline, no-JS (bar the one scroll-spy exception) HTML file.
Splitting is a *source* concern, not a *deliverable* one.

A working, copy-ready version of this whole system ships in `assets/build-kit/`
(relative to this skill): `build.mjs`, `catalog.mjs`, and `src/` with
`partials.mjs`, `components.mjs`, `styles.css`, `manifest.mjs`, a sample screen,
plus `AGENTS.md` / `CLAUDE.md` folder templates and a `README.md` on adopting it.
Copy that folder as the starting point instead of writing the build from scratch;
`assets/build-kit/README.md` is the adoption checklist.

## The source shape

- `src/partials.mjs` — `frame()` (the per-screen device shell), `sidebar()` (the
  table-of-contents), and `page()` (the document).
- `src/components.mjs` — content and chrome primitives as functions (card, table,
  field, chip, badge, and the device chrome: appbar, tabbar, shell, sidebarNav,
  topbar, browserbar) plus a `CATALOG` array every primitive self-registers into.
- `src/screens/<letter>-<nn>-<slug>.mjs` — one screen each: a data object
  (`device`, route, screen, state, notes) plus a body **composed from component
  calls, never raw tags**.
- `src/intro.html` — the board header and the `.readme` reading contract, so
  every built board ships it.
- `src/manifest.mjs` — the table of contents and build order.
- `build.mjs` reads each screen's permanent id from its file name, stamps the
  board position beside it, renders the sidebar, and writes the deliverable;
  `catalog.mjs` renders `CATALOG` into a storybook.
- Keep the CSS in one `src/styles.css` the build inlines — **the same greybox
  vocabulary as `board-template.html`**, so the single-file and built paths speak
  one language.

## A permanent id, and a position that moves

A frame carries two numbers, and keeping them apart is what makes a board
possible to talk about:

| | Where it comes from | When it changes |
| --- | --- | --- |
| **Id** — `A-20` | the file name (`a-20-contract-detail.mjs`) | never |
| **Position** — `[02]` | the manifest order, recomputed every build | on any reorder |

The label prints them together as `[02]A-20`: the position so a reader scanning
the board can see where they are, the id because that is what they were given.
The sidebar and the anchor use the id, so a link into the board survives a
reorder.

**The id is permanent, and that is the whole point.** It is assigned once, when
the screen is born, and survives insertion above it, reordering, and the deletion
of neighbours. Everything that outlives a build — a plan, a parity list, a review
note, a message to a person — names screens by id and stays correct. Never
renumber to close a gap: gaps cost nothing, and a renumber invalidates every
reference anyone wrote down.

Because the id lives in the file name, there is exactly one source for it and no
way for the two to disagree. The build enforces that: it refuses to build when a
file name carries no id, when an id does not belong to its section, or when two
screens claim one id. **A narrow/wide pair is one screen** — both halves share
the id and the position, and differ only by `variant`.

Adding a screen is one file under `src/screens/` plus one line in the manifest.
A note points at another screen by FILE NAME (`{{a-01-sign-in}}`), which the
build resolves to that screen's id.

## The release gate checks what a frame draws, not just that it exists

A section can be present while a frame has quietly lost what it promises — a
refactor or a bad merge leaves the label intact and the drawing gone, and a gate
that counts sections passes it. The manifest label is the frame's contract, so
hold each frame to it: a screen the label calls a dialog has to draw one. Check
against the screen module rather than the built HTML so the failure names the
source file, and warn on a preview build while refusing only a release — a gate
that blocks the build you iterate with gets switched off. *Why:* the gap this
closes is silent by construction, since a frame that draws nothing still renders,
still counts, and still reads as covered.

## The LLM reads the manifest plus one screen, never the whole board

*Why:* that is exactly what keeps a large board tractable. To touch a screen it
opens `src/manifest.mjs` to find the file, then that one screen file and the
component kit it composes from. The built HTML is for humans to review; the
source is what the model edits.

## Wire the folder so the next agent reads the source, not the artifact

*When the board uses the build.* Drop an `AGENTS.md` in the board folder holding
the board-reading contract (the same rules the rendered `.readme` block states)
plus the source layout and build commands, and a folder `CLAUDE.md` that points
to it. Make both say, in the imperative: *do not open the built HTML — it is a
thousands-of-lines artifact; read `src/manifest.mjs` then the one target screen.*
*Why:* the model's default reflex on "show me screen X" is to open the big HTML,
which floods context and bypasses the contract the `.readme` block carries; the
auto-loaded folder `CLAUDE.md` is what redirects it to the source.

## Onboarding builds the kit first, product screens second

*When starting a board that will use the build.* Stand up the chrome partials,
the content components with their `CATALOG` registration, the storybook, and
**one sample screen composed entirely from components** before authoring any
product screen. Present that kit + sample for sign-off first. *Why:* the kit and
the sample are the contract every later screen composes against; screens written
before the kit exists reinvent primitives and drift, and the storybook is what
lets the next author (or model) pick a ready primitive instead of hand-rolling
markup.
