# Primitives, fidelity, connectors, annotations

Read when composing a frame's content — which class to reach for, what text is
real, and how frames are joined and annotated.

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
  and nav labels, field labels, table headers, and status/guidance messages carry
  their actual wording in the product's UI language — reviewers must be able to
  validate flow and wording. Names, descriptions, prices, and other record data
  are `.bar` placeholders; rendering them real drags the review into content.
  Never use lorem ipsum: it is noise pretending to be signal.
- CJK text runs wider than Latin at the same character count; keep labels on one
  line at the frame's width or shorten them — a wrapped button label is a
  finding, not a styling problem. On viewport pairs, check both: a label that fits
  at 1440px can still wrap inside a 280px `.pane.list` or a 60px `.sidebar.rail`.
- Every block needs a visible grey fill or border. A region that renders
  white-on-white disappears in thumbnails and reads as "nothing here".
- Desktop screens use desktop patterns. A list on the web is a `.table` with
  headers and `.pagination`, not a stack of `.list-card`s; navigation is a
  `.sidebar` or `.topbar`, never a `.tabbar`; a dialog is a centered `.modal`, not
  a bottom `.sheet`. Copying phone shapes into a 1440px frame is the same defect
  as stretching a phone column into landscape.

## Connectors and annotations

- **Connectors join adjacent frames in the same row.** Each `.arrow` carries a
  numbered, verb-first `.step` label describing the action that advances the flow
  ("① tap Sign in", "② submit form"). Between rows or sections, continue the
  numbering inside step labels instead of drawing long arrows — arrows that cross
  rows turn the board into spaghetti. On rows with viewport pairs, arrows sit
  between pairs (never inside one), so numbering holds in both toggle states.
- **`.frame-notes` carry machine-checkable context** as short mono lines with
  fixed prefixes: `AUTH:` (entry/token precondition), `DATA:` (endpoint or
  source), `OPEN:` (unresolved question — accent-colored). When the source
  document does not settle a decision, write an `OPEN:` note instead of inventing
  an answer; a wireframe that silently invents scope pollutes the spec it was
  drawn from.
- **Stickies are rare.** One or two per section, for intent-level notes only
  ("this screen must answer 'where do I go' in 3s"). More than that and none of
  them get read.
