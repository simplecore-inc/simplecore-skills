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
- `build.mjs` numbers the frames, renders the sidebar, and writes the
  deliverable; `catalog.mjs` renders `CATALOG` into a storybook.
- Keep the CSS in one `src/styles.css` the build inlines — **the same greybox
  vocabulary as `board-template.html`**, so the single-file and built paths speak
  one language.

## Screen numbers are the address

The build numbers each frame `<letter>-<nn>` by its position in the manifest
(A-01, A-02). That number is how a human and an LLM refer to a screen — "fix
A-01", not "the sign-in frame near the middle" — and the sidebar entry anchors to
it so a click scrolls both axes to the frame. Adding a screen is one file under
`src/screens/` plus one line in the manifest.

That number is a *position*, so it changes whenever a screen is inserted or
reordered while the file name keeps whatever number it was created with — after a
few passes most frames disagree with their own file. The sidebar and each frame
label therefore print **both**, so a reference written either way can be found,
and a note points at another screen by FILE NAME (`{{a-01-sign-in}}`) which the
build resolves to the current number. Prose that outlives a build — plans, specs,
review notes — names screens by file for the same reason.

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
