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
| A tree that IS the list | **a table with a header row** — first column carries indent + caret + label, the rest are ordinary columns, row actions trail. A tree drawn as a bare outline can hold neither a status nor a row's verbs, so both get drawn a second time as a table above the region and the same records stand in two places. Beside a panel the further columns take what they hold (`min-width` around 72px, not the 110px an action column reserves at full width) |
| `.pagination` > `.pg` / `.pg.active` | Page controls under a table |
| **Layout** | |
| `.split` > `.pane` / `.pane.list` | Master-detail: fixed list pane + detail pane (replaces `.body`) |
| `.grid-2` / `.grid-3` / `.grid-4` | Multi-column card grid inside `.body` or a `.pane` |
| **Content** | |
| `.img-ph` | Image placeholder — rect with diagonal X |
| `.qr-ph` | QR/barcode placeholder — checker pattern + label |
| A document read as paper | **a viewer, not one page at one size** — toolbar (page step, zoom, fit, find, which language is drawn), a rail of page thumbnails that marks the pages with a problem, a fixed-height stage the paper is cut off by, and a status line naming the paper. See § A preview of a document is a viewer |
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
- **A frame whose language switch is set to a language draws that language.** On a
  multilingual product the switch is drawn set to Tiếng Việt or ភាសាខ្មែរ and then every
  string under it is written in the deployment's own language — because the author writes
  in theirs and the switch looks like it has done the work. It has not: the frame now
  claims a translation that does not exist, and the review it was drawn for passes.
  What has to be in the reader's language is what they must **act** on — the instruction,
  the field labels, the button that signs, the sentence saying what happens if they refuse.
  A title in their language over content in yours is the worst of the three, because it
  reads as translated to everyone who does not speak it.
  The same holds for paper: a sheet drawn under 「함께 실을 언어 = Tiếng Việt」 prints its
  field names in that language too, not just its values.
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

## List-detail: the region is the last thing on the page

A CRUD screen is a list column beside a detail panel, and the panel is a **full-height
column whose footer is pinned to the bottom of the remaining screen**. That one fact
decides where everything else on the page can go.

- **Nothing may sit under the two columns.** A block appended after the list-detail lands
  under a panel that has already reached the floor: the reader sees the record's actions,
  then more page beneath them, and the footer stops meaning "this is the end of this
  record". Make this mechanical — a gate that refuses a build when anything follows the
  list-detail call pays for itself the first time somebody appends a note.
- **The list column is narrow.** With a fixed-width panel beside it the list gets what is
  left — often barely a third of the frame. A five-column table cannot go there. Size the
  list to three columns (title with a mono sub-line, one status, two row actions) and put
  anything wider elsewhere.

Four destinations, and choosing between them is the design decision:

| What it is | Where it goes |
| --- | --- |
| Must stay visible whatever the list is doing — warnings, counts, the page's own note | **above** the list-detail; that region shrinks with the list, so a card over it survives |
| A value of the **selected record** | **inside the panel** — never above, where it reads as a page fact about nothing |
| A reference block about the **whole list** that is narrow enough | tail of the **list column** |
| An always-available cross-link or export | the **page header's action area**, right of the title — not a button row in the flow |

### The tabs, the chip filter and the list stand together

Picking a tab, narrowing it with a chip and reading the rows is ONE act, and **nothing may
sit between the three** — not a tile row, not a warning band, not an explanation card, not
a section title. Wedge something in and the reader chooses a tab, crosses a screenful of
other material, and meets rows with nothing left saying those rows are the answer to what
they chose. The tile row is the wedge that recurs, because it looks like a summary of the
list and is really a summary of the page.

- **The order is tabs → chip filter → list**, and the list begins at the bar that counts
  it. A chip row drawn under that bar narrows a total the reader has not chosen yet.
- **What was in the chain goes ABOVE the tabs** — the first of the four homes above. The
  controls then end up next to what they control, and the figures read as the page's own.
- **A note that depends on WHICH chip is chosen rides the chip row's right end.** A line of
  its own under the chips is the very block this forbids. **The test is one question: does
  this sentence change when the chip changes?** Changes — the chip row's right end. Does not
  — it is a page note and goes above the tabs, beside the help card and the warning band. A
  sentence saying where a field's values come from, or what the tiles counted, reads the same
  whichever chip is picked and is one of those.
- **Which side of that question a sentence falls on needs eyes**, so name whose. A gate can
  see that something stands between the chip row and the list and no further — a regex reads
  the sentence the same either way. The reader is somebody who did not draw the frame, at a
  moment the work cannot pass without; drawing it and judging it in one head produces the
  answer the author already had.
- **A list's tabs and a record's content tabs are different things.** The first splits a
  list into kinds somebody works through separately; the second switches what one record
  shows. Only the first is in this rule.
- **A chip row that is not a list filter declares itself** — a dashboard's period, the
  method the screen IS, the paper a preview is drawn on. One sentence naming what the chips
  pick instead, the same bargain the page-form and page-calendar declarations strike.
  Writing the sentence is the check, and an empty reason is not one.

**Entity explanation and lifecycle material is a card, not a block.** A legend of the
states a record moves through, a table of what each grade requires, a "how to read this
screen" walkthrough — inline, these push the actual work below the fold and are read once
in the reviewer's life. Put a compact card where it belongs (list bottom, above the
list-detail, or at the top inside a detail tab) and let pressing it open a dialog. The
explanation stays reachable and stops competing with the list.

### The test is whether the sentence is the same tomorrow

That one question sorts everything above the region, and it is worth applying to a screen's
whole page slot rather than to the obvious candidates only:

| Reads the same on any day | Only true today |
| --- | --- |
| The statute a duty comes from, its article, the retention period | This site has 4 records past their deadline |
| A table of what each grade / kind / type requires | This month's revision landed on 2026-07-01 |
| "Why this screen refuses X" · "what the three marks mean" | 6 templates are blocked from publishing right now |
| A comparison of the methods, channels, sources available | 2 of them have no owner |

**The left column goes behind the card; the right column stays on the page.** A page that
opens on today's numbers tells a reader what to do; a page that opens on a statute makes
them scroll past it every visit to reach the same six rows. A legal ground is not exempt —
it is the most reliable member of the left column, since an article number never changes
with the data.

**Each such dialog is a state frame of that screen**, drawn from the same `screenBody` as
the closed page. Give the card the question the explanation answers (「조건은 어디서 오고
무엇을 끌 수 있는가」), and give its hint the three or four things inside, separated by `·`.

### A record's own material never sits above the region

The components that carry one record — a progress rail, an approval flow, an attachment
grid, a retention lock, a field list — belong in the panel even when the page has room.
Above the region they read as page facts about nothing: the reader picks a different row
and the picture stays where it was, describing the row they left.

Move them into the panel under a `sectHead` naming what they are (「이 계획서의 진행」), and
where the panel already carries a tab for that material, add a summary field beside it
rather than repeating the whole block.

### A drawing, a calendar and a map are views of the list

When a page carries both a list and a plan/calendar of **the same records**, they are one
screen's two views, not two regions stacked on one page. Stacked, the reader crosses a
full screenful of plan to reach the first row, and the same records are drawn twice.

- **The view switch rides the bar above the list** — the total and the committed filters are
  there, and those are exactly what has to survive a switch.
- **The bar is drawn by whichever view is showing.** Leaving it inside the list means the
  drawing view has no switch at all, and a reader who pressed 「도면」 has no way back. Pull
  it into a `bar_(view)` helper both branches call.
- **A view with no room for a panel opens the record as a dialog** (P-07). A plan fills the
  frame, so pressing a mark opens that record where the question was asked and closes back
  onto the same plan. **Carry the panel's tabs into that dialog** — it is the same record
  read in a different place, so it offers the same way in to its sub-collections.
- Share one drawing of the record between panel and dialog (`const detailBody = …`), the
  same way the closed and open states share one drawing of the page.

### Every tab is drawn, and one companion frame carries the ones the base does not

A tab strip names its panes and draws only the open one. **The names are not a contract** — a
pane's columns, its actions and its empty state are unspecified, so the screen built from that
frame is invented by whoever builds it. Boards accumulate this quietly: count the panes a board
declares against the panes it draws and the gap is usually most of them.

Drawing each pane as its own frame is the obvious fix and the wrong one. The pane is a strip
inside a page, so a frame for it has to redraw the page — the header, the list beside it, the
footer — and now **the same list exists in two frames and only one of them gets corrected.** The
divergence the board exists to prevent is the divergence the fix introduces, multiplied by the
number of panes.

**Draw one companion frame per tabbed screen instead, placed immediately after its base.**

- **The title area is drawn the same** as the base, and nothing else is. It is there so a reader
  knows which screen's tabs these are.
- **Everything the base already draws is a placeholder** — the list, the panel, the region. Draw
  it once, in the base. A companion frame that redraws the list has reintroduced the problem.
- **The open pane is not repeated.** The base drew it.
- **The remaining panes stack vertically inside that one frame, in the strip's order**, each
  labelled with its tab.
- **The frame says it is tab panes.** Without that sentence, stacked panes read as one long page
  and get built as one — a scrolling screen where a tab strip belongs. This annotation is half of
  what the frame is for.

One frame per tabbed screen rather than one per pane. The base keeps its own drawing: the pane it
opens stays where it is, and the alternative — rewriting every tabbed screen to take its open pane
as a parameter — is what this avoids.

**`simplix-basic` carries the two pieces**, so a board on that pattern composes the frame rather
than inventing it: `regionPh({ label, ref })` for the region the base draws, and
`tabPanes({ open, ref, panes })` for the stack. `tabPanes` writes the「these are tab panes」note
itself, out of `open` and `ref` — an author's note goes missing and the drawing that lost it still
looks finished, so the primitive holds the half of the frame that matters most.

**The base does have to export its title area** — one line, `export const head = pageHeader({…})`,
used by the base's own body and imported by the companion. Copying the title instead is the one
shortcut that fails silently: two drawings of one title diverge the first time either is edited,
and nothing reports it.

**A companion frame must not draw a `tabs([…])` strip.** Wherever capture demands are counted off
the board one per pane, a strip on the companion demands every pane twice — once against the base
and once against the companion. The stacked pane headings carry the names, which is what a reader
needs; the strip belongs to the base alone.

**A pane whose content a pattern frame already fixes cites the pattern instead of being drawn.**
The line is whether the pattern settles the *content* or only the *shape*: a pattern that says a
sub-collection tab is a real list with row actions and pagination has not said which columns
stand, so that pane is still drawn; a pattern that names the columns has, so that pane is a
citation. The same tab label can fall on either side — a record's field-change log is settled by
the change-history pattern, while a domain event log carries different columns per screen.

**Judge every undrawn pane citation-or-drawing BEFORE drawing any of them, and a screen whose
undrawn panes are all citations gets no companion frame at all** — the citations belong in the
base's notes, and a companion holding nothing but a title and a placeholder is a blank page with a
frame id. Counting the tabbed screens gives an upper bound on the companions, never the number of
them. Taking the panes in the order the strip names them and drawing as you go inverts this: the
work is done before the screen turns out not to have needed a frame.

## A preview of a document is a viewer

Wherever a screen's job is to read or print a document — a print preview, a kept render, a
certificate, a statutory form — **one page drawn at one size is not a preview.** The reader
cannot reach page 7, cannot see that page 7 is the one whose table breaks, and cannot enlarge
the print far enough to check a figure before it goes to an office. Those three are exactly
what somebody opened the preview to do.

- **The toolbar carries page step, zoom, fit and find**, plus which language is being drawn when
  the document is multilingual.
- **The rail carries every page as a thumbnail and marks the ones with a problem.** It is the
  only place a reader learns *which* page is broken before printing; a warning that only says
  "something is cut" sends them through the whole document to find it.
- **The stage has a fixed height and cuts the paper off.** A page whose box ends where the text
  ran out is not a page, and seeing where the paper ends is the whole point.
- **A status line names the paper** — size, page count, margin — and states in one sentence what
  is wrong with this render, or that nothing is.

**The viewer owns how a document is read, never what it is made of.** Page, zoom, fit, find and
which language is drawn belong in the toolbar. Paper, margins, copies and which languages are
printed at all stay on the page or in the print form — put those in the toolbar and a reader who
only wanted a closer look has changed the document.

**What is cut is said inside the viewer, beside the ways out of it.** A warning under the viewer
reaches somebody who has already got to the print button, so the strip under the toolbar carries
both the sentence and its two branches (「A3로 바꾸기」·「그대로 2장 인쇄」).

**A fit segment must draw three different pictures.** Fit-to-width is a page wide enough to read
and cut off at the floor; one-page is a whole page at its true proportion; two-page is that page
and the one after it. A viewer that draws one picture under all three labels tells a reviewer
nothing about what pressing the segment does.

**Inside a detail panel the paper is a thumbnail, and needs a way out to the viewer.** A panel is
about a third of the frame, so a three-page document lands there as the top of page 1 — no page
step, no legible text. Give the panel a 「크게 보기」 verb that opens the same render in a viewer
dialog, and make that dialog a state frame.

## Connectors and annotations

- **Connectors join adjacent frames in the same row.** Each `.arrow` carries a
  numbered, verb-first `.step` label describing the action that advances the flow
  ("① tap Sign in", "② submit form"). Between rows or sections, continue the
  numbering inside step labels instead of drawing long arrows — arrows that cross
  rows turn the board into spaghetti. On rows with viewport pairs, arrows sit
  between pairs (never inside one), so numbering holds in both toggle states.
- **A row wraps, so the step numbers carry the flow, not the arrows.** Frames flow
  left to right and continue on the next line, which means an arrow can land at the
  end of a line with its target below rather than beside it. The numbered `.step`
  labels are what make the order unambiguous wherever the line breaks — so number
  every step, and never rely on a frame's left-right neighbour to imply sequence.
- **`.frame-notes` carry machine-checkable context** as short mono lines with
  fixed prefixes: `AUTH:` (entry/token precondition), `DATA:` (endpoint or
  source), `OPEN:` (unresolved question — accent-colored). When the source
  document does not settle a decision, write an `OPEN:` note instead of inventing
  an answer; a wireframe that silently invents scope pollutes the spec it was
  drawn from.
- **Stickies are rare.** One or two per section, for intent-level notes only
  ("this screen must answer 'where do I go' in 3s"). More than that and none of
  them get read.
