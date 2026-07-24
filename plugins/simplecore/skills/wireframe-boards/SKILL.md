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
  screen layouts drawn before any implementation. NOT for high-fidelity visual
  design or production React components.
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
- No JavaScript, no external images, fonts, or stylesheets — system font stack
  only. The file must render identically offline, attached to a doc, or as a
  thumbnail; a single missing network resource silently destroys the board.
  The viewport toggle is pure CSS (a checkbox plus sibling selectors) precisely
  so this rule survives it.
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
2. **Copy `assets/board-template.html`** (relative to this skill's base
   directory) as the document skeleton. It defines the full CSS vocabulary —
   board, `.readme` contract, sections, frames, greybox primitives, phone /
   tablet / desktop chrome, the viewport toggle, connectors, annotations. Keep
   the class names, variables, and the `.readme` block; delete the example
   sections (and the toggle, when no pairs remain). Extend the CSS only when a
   screen genuinely needs a primitive that does not exist yet.
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
