---
name: wireframe-boards
description: >-
  Author low-fidelity PHONE, TABLET, and DESKTOP/WEB wireframes as a single
  self-contained HTML board — fixed-viewport device frames, a CSS-only
  narrow ⇄ wide viewport toggle, greybox content, dashed flow connectors,
  numbered step labels, and annotation callouts, organized into per-flow
  sections that scale to dozens of frames. Use whenever the task asks for
  wireframes, screen mockups, lo-fi screens, UI sketches, a screen inventory or
  flow board derived from a design/spec document, or mentions 와이어프레임 ·
  화면 목업 · 로파이 · 태블릿 화면 · 웹 화면 · PC 화면 · 데스크톱 화면 ·
  관리자 화면 — even when the word "wireframe" is absent but the deliverable is
  screen layouts drawn before any implementation. Also use it as the LIVING
  screen contract during development: whenever you implement a screen from a
  wireframe board, check an implementation against one, or a screen/dialog/state/
  flow is added or changed and the board must stay in sync — build-from,
  reconcile, or update-the-board tasks, not only first authoring. Engage it
  proactively too at the start of a substantial new UI effort that has no board
  yet — to propose wireframe-driven development (draw the screens as a board, then
  build from it) before writing UI code. NOT for high-fidelity visual design or
  production React components.
---

# Wireframe Boards

Produce a wireframe board: a single HTML file laying out an app's screens as
rows of lo-fi device frames — phones, tablets, desktop browsers, or all three
on one board. The point is structure and flow — what is on each screen, in
which state, and how the user moves between screens — never visual polish.
Screens stay clean greyboxes; only connectors and annotations are loose and
informal.

## Output contract

One self-contained `.html` file:

- `<!doctype html>` through `</html>`, all CSS inline in one `<style>` block.
- No external images, fonts, or stylesheets — system font stack only. The file
  must render identically offline, attached to a doc, or as a thumbnail; a single
  missing network resource silently destroys the board. The viewport toggle is
  pure CSS (a checkbox plus sibling selectors) precisely so this rule survives it.
- **JavaScript: none, with one narrow exception.** The board's layout, content,
  and states are pure HTML/CSS and must render fully with scripts off. The only
  script permitted is a small **inline** navigation enhancer — highlighting the
  table-of-contents entry of the frame you clicked or are viewing (a scroll-spy),
  and nothing more. It is inline (no external resource, so the offline rule
  holds) and progressive: with JS off the board still renders and anchor
  navigation still works — the script only adds the active highlight. No script
  may create content, drive interactivity a reviewer acts on, or gate what is
  visible; those belong in HTML/CSS.
- Greyscale palette plus exactly ONE accent color, reserved for connectors,
  annotation pins, stickies, fold lines, and `OPEN:` markers. A second accent
  turns the board into a design and reviewers start critiquing colors instead
  of flows.
- **The `.readme` implementation contract ships on every board and is never
  deleted or trimmed.** A wireframe reaches its reader stripped of the
  conversation that produced it, and both people and LLMs will otherwise
  reproduce the greyboxes as a design. The block states what the board
  specifies (screens, content, states, flow, wording) and what it deliberately
  does not (color, type, spacing, components, motion), how to read
  `AUTH:` / `DATA:` / `OPEN:`, that a narrow/wide pair is one responsive screen,
  and that the project's own frontend conventions outrank anything the board's
  shapes imply. Board-specific caveats are appended as further numbered items,
  never substituted for the standing ones.
- **Horizontal scrollbars are always visible.** Rows scroll sideways, and macOS
  hides overlay scrollbars until something scrolls — a row of 1440px desktop
  frames then looks like it ends at the window edge and the rest of the flow is
  never found. The template pins a permanent scrollbar on `.row` (explicit
  `::-webkit-scrollbar` height plus `scrollbar-color`); any other horizontally
  scrollable region gets the `.scroll-x` class for the same treatment.

## Device classes

| Class | Width | `--vh` | Height |
| --- | --- | --- | --- |
| `.frame` (phone) | 390 | 844 | fixed device viewport |
| `.frame.phone.wide` | 844 | 390 | fixed — author only if the product rotates |
| `.frame.tablet` | 768 | 1024 | fixed device viewport (portrait) |
| `.frame.tablet.wide` | 1024 | 768 | fixed device viewport (landscape) |
| `.frame.desktop` | 1440 | 900 | fluid — grows with the page |
| `.frame.desktop.narrow` | 1024 | 720 | fluid — grows with the page |

`--vh` is the frame's reference viewport height: `.screen` never shrinks below
it and grows when the page is longer. One board may mix phone, tablet, and
desktop sections freely.

### Height: fixed on touch devices, fluid on the web

- **Phone and tablet viewports are fixed in both dimensions.** The frame is the
  device. Bottom-pinned chrome (`.tabbar`, `.cta`) belongs to the viewport, so a
  frame carrying it MUST fit inside `--vh` — when the content needs more room,
  author a second `— scrolled` state frame rather than letting the frame grow
  and drag the tabbar to the bottom of a page-length box.
- **A desktop window has a fixed width and no fixed height.** Desktop frames pin
  the width and let the page run as long as it needs. Every desktop frame
  carries a `.fold` line — drawn automatically at `--vh`, so it lands on the
  viewport bottom however far the content pushes the frame — labelled with the
  reference size (`fold · 1440×900`). The fold marks the *smallest supported
  window*, not a page height: everything the user must act on (primary action,
  the reason to scroll) belongs above it, and content below it is the reader's
  cue that the page scrolls.
- A phone or tablet frame may also carry a `.fold` when the page is a long
  scroll with no pinned chrome — the line then marks exactly where the device
  viewport ends.

### Viewport pairs and the toggle

- A screen that reflows between two viewports is authored **twice** — a
  `.narrow` frame and a `.wide` frame, adjacent in the same row, sharing one
  `.frame-label` suffixed with the human name (`· portrait` / `· landscape`,
  `· 1024 breakpoint` / `· 1440`). The pair counts as ONE inventory item and
  describes ONE responsive screen.
- The board-level toggle (a checkbox as the FIRST element of `<body>` plus the
  `.view-toggle` label in the header — both in the template) shows exactly one
  frame of each pair. Connectors sit between pairs, so the flow reads correctly
  in both views without duplicate arrows.
- **Only frames tagged `.narrow` / `.wide` participate.** A screen authored at a
  single viewport carries no tag and stays visible in both toggle states — that
  is how orientation-locked products (kiosk mounts, vehicle docks) and
  single-width admin consoles are drawn. A board with no pairs at all deletes
  the toggle input and label; a control that does nothing erodes trust in the
  ones that do.
- Narrow is the default view — it is what thumbnails and prints show. Add
  `checked` to the checkbox for a wide-first product.
- **Wide is a reflow, not a stretch.** A single phone-shaped column at 1024px is
  itself a wireframe finding: use `.split` master-detail panes, `.grid-2` /
  `.grid-3` / `.grid-4` card grids, a full `.sidebar` where the narrow view
  showed a `.sidebar.rail`, or extra table columns. If the two viewports
  genuinely share an identical structure, record that as an `OPEN:` note instead
  of silently copying.

## Workflow

1. **Build the frame inventory first.** Before writing any HTML, list every
   frame as `device — route — screen — state`. Every distinct state is its own
   frame: empty, error, expired token, terminal statuses, gated variants (a
   feature hidden by a policy switch), dialog overlays. A screen×state authored
   as a viewport pair is one inventory item. State variants are where wireframe
   reviews catch real defects — a happy-path-only board hides them. If the brief
   carries a checklist, the inventory must cover it item by item.
2. **Let that inventory pick the authoring path, then copy its starting point.**
   The frame count and the amount of repeated chrome decide this, so it is
   settled here rather than discovered halfway through a board.
   - *Under roughly twenty frames, with chrome that varies screen to screen:*
     copy `assets/board-template.html` (relative to this skill's base directory)
     as the document skeleton. It defines the full CSS vocabulary — board,
     `.readme` contract, sections, frames, greybox primitives, phone / tablet /
     desktop chrome, the viewport toggle, connectors, annotations. Keep the class
     names, variables, and the `.readme` block; delete the example sections (and
     the toggle, when no pairs remain). Extend the CSS only when a screen
     genuinely needs a primitive that does not exist yet.
   - *At or past that size, or once the same nav / titlebar / status bar would be
     hand-copied into every frame:* copy `assets/build-kit/` instead and follow
     *Scaling: a component kit, screen data, and a build* below. The deliverable
     is identical — steps 3–6 all still apply — but each frame is authored as a
     `src/screens/` file composed from components, not as inline markup.
3. **Organize into flow sections.** One `<section class="flow">` per user flow
   or feature area, each with a lettered title (`A. Sign-in`, `B. Checkout`) and
   a frame count. Add a `<nav class="toc">` linking to every section when the
   board has more than two — on a 40-frame board, navigation is the difference
   between a review tool and a wall of grey.
4. **Compose each frame from the primitives** (table below). Frames render at
   their device-class dimensions so proportions read truthfully — if a label or
   button row overflows at that width, the real screen will too, and surfacing
   that is part of the wireframe's job.
5. **Connect and annotate** (rules below).
6. **Self-check** (checklist below), then write the file to the requested path.
   If browser tooling is available in the session, open the file and visually
   verify at least one wide section, one overlay frame, one desktop fold, and —
   on boards with pairs — both toggle states.

### The board is a living contract — build from it, reconcile, sync

A board is not drawn once and abandoned. It is the screen contract the UI is
built against, downstream of the spec: the spec decides behavior, the board
renders it as screens/states/flow, the code matches the board. Use this skill for
these steps too, not only first authoring — and each carries its own trigger
(*when*) and reason (*why*), so an update is never a reflex:

- **Propose it when it is missing** — *when a substantial new UI effort (several
  screens, a feature, a flow) is about to be built and no board exists yet.* Before
  writing UI code, propose wireframe-driven development to the user: draw the
  screens/states/flow of that feature as a board (or, for a small addition, a few
  frames) and drive the implementation from it. *Why:* the board is cheapest to get
  right before code exists, and it becomes the contract the rest of the work
  reconciles against. Propose, do not assume — ask before creating, and skip it for
  a trivial change, a single-component tweak, or when the user explicitly asked for
  code only.
- **Build from it** — *when about to implement a screen.* Read its frame by
  `route — screen — state` and build every state it draws (empty, error, loading,
  gated, dialogs), the flow its connectors describe, and its fixed wording. Match
  content/states/flow, never appearance — *why:* the `.readme` contract reserves
  color, type, spacing, components, and motion to the design system. Navigate a
  large board by its `<nav class="toc">` and `.frame-label` search, not by
  reading the whole file.
- **Reconcile** — *when a screen is done, or when picking up unfamiliar code.*
  Audit board ⇄ code both ways: every frame's state/dialog exists in the code,
  and every implemented screen, dialog, and state variant has a frame. *Why:* a
  silent mismatch is the drift that later makes every change guess which side is
  right.
- **Sync — back-fill vs design change.** *When a screen, dialog, state, or flow
  is added during development* → back-fill a frame for it in the same change
  (inventory rule: one frame per screen×state, adjacent to its base, with
  `.frame-label` / `.frame-notes`) — *why:* it documents a decision already made,
  keeping the board complete. *When a design decision itself changes* → update
  the board only with the design owner's sign-off, and update the spec it derives
  from in the same breath — *why:* the board is a contract, not a scratchpad.
  Sync the contract layer only: screens, content, states, flow, and fixed wording
  trigger an update; restyling, component swaps, and copy that lives in the app's
  i18n catalog do not — *why:* a board updated for every pixel is abandoned, and
  a stale board is worse than none because it lies with authority. Extend the one
  board with new lettered `<section class="flow">` blocks and TOC entries; never
  spawn a second board.
- **Wire yourself into the project so the next session doesn't rely on memory** —
  *when you use this skill against a project that has (or just got) a board.*
  Judge whether that project already points future sessions here: a line in its
  `CLAUDE.md` / `AGENTS.md` naming the board's path and this build-from/reconcile/
  sync discipline. If a board exists but no such pointer does, say so and offer to
  add a one-line pointer — ask first, since `CLAUDE.md` is durable — then add it
  on approval. *Why:* the description trigger alone is not perfectly reliable, and
  a durable project pointer is what keeps the board alive without the user
  hand-writing guidance for every project.

### Scaling: a component kit, screen data, and a build

The single template file is right up to a point. Past roughly twenty frames, or
once the same nav / titlebar / status bar is hand-copied into every article, one
file becomes a wall of grey that neither a person nor an LLM can navigate, and
every chrome edit is a find-replace across the whole board. At that size, author
the board as a small **source tree that builds into the same deliverable** — the
output invariant never changes: the build still emits one self-contained,
offline, no-JS (bar the one scroll-spy exception) HTML file. Splitting is a
*source* concern, not a *deliverable* one.

A working, copy-ready version of this whole system ships in
`assets/build-kit/` (relative to this skill): `build.mjs`, `catalog.mjs`, and
`src/` with `partials.mjs`, `components.mjs`, `styles.css`, `manifest.mjs`, a
sample screen, plus `AGENTS.md` / `CLAUDE.md` folder templates and a `README.md`
on adopting it. Copy that folder as the starting point instead of writing the
build from scratch; `assets/build-kit/README.md` is the adoption checklist.

- **The source shape.** `src/partials.mjs` holds `frame()` (the per-screen device
  shell), `sidebar()` (the table-of-contents), and `page()` (the document). `src/components.mjs`
  holds the content and chrome primitives as functions (card, table, field, chip,
  badge, and the device chrome — appbar, tabbar, shell, sidebarNav, topbar,
  browserbar) plus a `CATALOG` array every primitive self-registers into.
  `src/screens/<letter>-<nn>-<slug>.mjs` is one screen each — a data object
  (`device`, route, screen, state, notes) plus a body **composed from component
  calls, never raw tags**. `src/intro.html` carries the board header and the
  `.readme` reading contract so every built board ships it. `src/manifest.mjs` is
  the table of contents and build order. `build.mjs` numbers the frames, renders
  the sidebar, and writes the deliverable; `catalog.mjs` renders `CATALOG` into a
  storybook. Keep the CSS in one `src/styles.css` the build inlines — **the same
  greybox vocabulary as `board-template.html`**, so the single-file and built
  paths speak one language. A working copy of all of this ships in
  `assets/build-kit/`.
- **Screen numbers are the address.** The build numbers each frame `<letter>-<nn>`
  by its position in the manifest (A-01, A-02). That number is how a human and
  an LLM refer to a screen — "fix A-01", not "the sign-in frame near the middle"
  — and the sidebar entry anchors to it so a click scrolls both axes to the
  frame. Adding a screen is one file under `src/screens/` plus one line in the
  manifest.
- **The LLM reads the manifest plus one screen, never the whole board** — *why:*
  that is exactly what keeps a large board tractable. To touch a screen it opens
  `src/manifest.mjs` to find the file, then that one screen file and the
  component kit it composes from. The built HTML is for humans to review; the
  source is what the model edits.
- **Wire the folder so the next agent reads the source, not the artifact** —
  *when the board uses the build.* Drop an `AGENTS.md` in the board folder holding
  the board-reading contract (the same rules the rendered `.readme` block states)
  plus the source layout and build commands, and a folder `CLAUDE.md` that points
  to it. Make both say, in the imperative: *do not open the built HTML — it is a
  thousands-of-lines artifact; read `src/manifest.mjs` then the one target
  screen.* *Why:* the model's default reflex on "show me screen X" is to open the
  big HTML, which floods context and bypasses the contract the `.readme` block
  carries; the auto-loaded folder `CLAUDE.md` is what redirects it to the source.
- **Onboarding builds the kit first, product screens second** — *when starting a
  board that will use the build.* Stand up the chrome partials, the content
  components with their `CATALOG` registration, the storybook, and **one sample
  screen composed entirely from components** before authoring any product screen.
  Present that kit + sample for sign-off first. *Why:* the kit and the sample are
  the contract every later screen composes against; screens written before the
  kit exists reinvent primitives and drift, and the storybook is what lets the
  next author (or model) pick a ready primitive instead of hand-rolling markup.

## Primitive vocabulary

| Class | Use |
| --- | --- |
| `.frame` > `.device` > `.screen` | One device frame; `.frame-label` (mono, `route — screen — state`) and `.frame-notes` sit below the device |
| `.fold` | Viewport-bottom marker drawn at `--vh`; mandatory on desktop frames |
| `.view-input` + `.view-toggle` | Board-level narrow ⇄ wide switch: checkbox first in `<body>`, segmented label in the header |
| `.readme` | Implementation contract rendered above the board — ships on every board |
| **Touch chrome** | |
| `.statusbar` | Phone status bar with notch (notch auto-hidden on tablets) |
| `.appbar` | Screen header: back arrow slot, title, trailing chip (e.g. language switch) |
| `.body` | Content column (12px padding, 10px gap; roomier inside desktop frames) |
| `.tabbar` > `.tab` / `.tab.active` | Bottom tab navigation, pinned via `margin-top:auto` |
| `.cta` | Bottom-pinned action area (dashed top border) |
| **Desktop chrome** | |
| `.browserbar` > `.dots` + `.url` | Browser window bar; sits OUTSIDE `.screen` so the fold measures the page viewport |
| `.shell` > `.sidebar` + `.main` | App shell: left navigation + content column |
| `.sidebar` > `.brand` / `.nav-group` / `.nav-item` | Navigation tree; `.sidebar.rail` is the collapsed icon-only variant |
| `.topbar` | Global header: search, spacer, user chip / `.avatar` |
| `.crumb` / `.toolbar` > `.actions` | Breadcrumb line; page title row with right-aligned actions |
| `.table` > `.trow` / `.trow.thead` / `.td` | Data table; `.td.w2` / `.td.fix` / `.td.right` size and align cells |
| `.pagination` > `.pg` / `.pg.active` | Page controls under a table |
| **Layout** | |
| `.split` > `.pane` / `.pane.list` | Master-detail: fixed list pane + detail pane (replaces `.body`) |
| `.grid-2` / `.grid-3` / `.grid-4` | Multi-column card grid inside `.body` or a `.pane` |
| **Content** | |
| `.img-ph` | Image placeholder — rect with diagonal X |
| `.qr-ph` | QR/barcode placeholder — checker pattern + label |
| `.bar` + `.w25/.w40/.w60/.w80/.w100` | Placeholder text lines of varying width |
| `.t-title` / `.t-sub` / `.t-body` | Real text: screen titles, guidance copy |
| `.btn` / `.btn.primary` / `.btn.ghost` | Buttons — primary is a filled greybox, ghost is dashed |
| `.field` > `.label` + `.input` | Form field with label; append `▾` inside `.input` for selects |
| `.chip` / `.badge` / `.badge.outline` | Filter chips and status badges |
| `.card` / `.list-card` + `.thumb` | Content card; list row with thumbnail |
| `.divider` | Horizontal rule between groups |
| **Overlays & notation** | |
| `.dim` + `.sheet` | Bottom-sheet overlay state on a touch screen |
| `.dim` + `.modal` | Centered dialog overlay on a desktop screen |
| `.arrow` + `.step` | Dashed connector between adjacent frames with a step label |
| `.sticky` | Rotated sticky note for intent-level annotations |

## Fidelity rules

- **Structural text is real; data content is bars.** Buttons, screen titles, tab
  and nav labels, field labels, table headers, and status/guidance messages
  carry their actual wording in the product's UI language — reviewers must be
  able to validate flow and wording. Names, descriptions, prices, and other
  record data are `.bar` placeholders — rendering them real drags the review
  into content. Never use lorem ipsum: it is noise pretending to be signal.
- CJK text runs wider than Latin at the same character count; keep labels on one
  line at the frame's width or shorten them — a wrapped button label is a
  finding, not a styling problem. On viewport pairs, check both: a label that
  fits at 1440px can still wrap inside a 280px `.pane.list` or a 60px
  `.sidebar.rail`.
- Every block needs a visible grey fill or border. A region that renders
  white-on-white disappears in thumbnails and reads as "nothing here".
- Desktop screens use desktop patterns. A list on the web is a `.table` with
  headers and `.pagination`, not a stack of `.list-card`s; navigation is a
  `.sidebar` or `.topbar`, never a `.tabbar`; a dialog is a centered `.modal`,
  not a bottom `.sheet`. Copying phone shapes into a 1440px frame is the same
  defect as stretching a phone column into landscape.

## Connectors and annotations

- **Connectors join adjacent frames in the same row.** Each `.arrow` carries a
  numbered, verb-first `.step` label describing the action that advances the
  flow ("① tap Sign in", "② submit form"). Between rows or sections, continue
  the numbering inside step labels instead of drawing long arrows — arrows that
  cross rows turn the board into spaghetti. On rows with viewport pairs, arrows
  sit between pairs (never inside one), so numbering holds in both toggle
  states.
- **`.frame-notes` carry machine-checkable context** as short mono lines with
  fixed prefixes: `AUTH:` (entry/token precondition), `DATA:` (endpoint or
  source), `OPEN:` (unresolved question — accent-colored). When the source
  document does not settle a decision, write an `OPEN:` note instead of
  inventing an answer; a wireframe that silently invents scope pollutes the spec
  it was drawn from.
- **Stickies are rare.** One or two per section, for intent-level notes only
  ("this screen must answer 'where do I go' in 3s"). More than that and none of
  them get read.

## Self-check (before delivering)

- The `.readme` implementation contract is present, complete, and above the
  first flow section.
- Frame inventory ⇄ board: every inventory item (and every brief checklist item)
  has exactly one frame — one pair, for paired items; report the final frame
  count per section.
- Every frame has a `.frame-label`; every state variant is adjacent to its base
  screen; every `.narrow` frame has its `.wide` twin adjacent, and neither tag
  appears on a single-viewport screen.
- Toggling the viewport switch shows exactly one frame of each pair and flips
  the highlighted segment in the header; the toggle is absent on boards with no
  pairs.
- Every desktop frame has a `.fold` with its reference size, and the screen's
  primary action sits above it. No phone or tablet frame with `.tabbar` / `.cta`
  runs past its fold.
- Each row's horizontal scrollbar is visible without scrolling — verify at a
  window narrower than the row's content.
- No label overflow at any frame's width in either viewport; no
  near-white-on-white regions.
- Flow reads left-to-right within each row; step numbering is continuous and
  holds in both toggle states.
- The single accent appears only on connectors, pins, stickies, folds, `OPEN:`
  notes, and the `.readme` rule.
