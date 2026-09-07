# Render Audit — verify SVG by rendering, not by reading XML

Valid SVG XML does not mean a correct picture. Text overflow, missing or
oblique arrowheads, head-only arrows, occluded labels, and content jammed
against a box edge are **invisible in the source** and only show up once the
SVG is rasterized. Always rasterize and inspect before delivering an SVG.

`scripts/audit.py` provides the three operations of the loop: `render` (full),
`crop` (zoom into a region), and `lint` (static defect scan).

## The loop

```
generate SVG
  → audit.py lint <svg> [more…]      # static scan, must reach "no issues" (exit 1 gates a loop)
  → audit.py render <svg> out.png    # full raster, Read it
  → audit.py hotspots <svg> crops/   # auto-crop EVERY arrow endpoint at high zoom, Read them
  → audit.py crop <svg> x y w h …    # zoom any remaining tight spot
  → fix generator
  → repeat until lint is clean AND the endpoint crops look right
```

`hotspots` exists because a full render viewed downscaled hides sub-10px
defects — an arrowhead landing on a title chip, a label kissing a box. Those
defects live at connector endpoints, so cropping each endpoint at 4x makes the
visual pass systematic instead of an eyeball sweep.

Lint is a *screen*, not the verdict. Every lint hit must be confirmed (or
dismissed as a false positive) by looking at a crop. Conversely, lint passing
does not prove the picture is good — still eyeball the full render and the
arrowheads.

## Rendering (ground truth)

Chrome/Chromium headless renders an SVG exactly the way a browser (and GitHub's
`<img>`) will. It honours the root `width`/`height`, so screenshot at those
dimensions. (`qlmanage` on macOS produces a padded square thumbnail — do not
trust it for layout.)

```bash
python3 scripts/audit.py render diagram.svg out.png 2        # 2x for crispness
python3 scripts/audit.py crop  diagram.svg 716 200 80 120 head.png 5
```

`crop` rewrites the root `viewBox`+`width`+`height` to the requested region and
renders it large — this is how you see whether an arrowhead actually lands on
an edge, whether a glyph touches a border, etc.

Set the Chrome binary with the `CHROME` env var if auto-detection fails.

### Reading the PNGs

When viewing several full renders in one read, keep each image **≤ 2000px on
its longest side** — a wide canvas at 2x exceeds that and the read is rejected.
Render wide canvases at scale 1.5 for the overview, then `crop` at 4–5x for the
details that the downscaled overview hides.

## Defect catalog (what `lint` checks)

| Lint id | Symptom in the render | How it is detected | Fix |
|---|---|---|---|
| `UNRESOLVED-MARKER` | arrowhead silently absent | `marker-end="url(#id)"` whose `id` is not a defined `<marker>` (e.g. a colour value was passed where a marker name was expected) | reference a defined marker; resolve colour→marker-name centrally |
| `OBLIQUE-ARROW` | head meets the box at a slant | final segment of an arrowed `path`/`line` is not axis-aligned | route orthogonally so the **last segment is perpendicular** to the target edge |
| `SHORT-ARROW` | head-only / cramped arrow | final segment shorter than 18px | lengthen the connector; open up the gap between the boxes |
| `TEXT-OVERFLOW` | label spills past its box | CJK-aware glyph width (Latin ≈ 0.55–0.60·em, Hangul/Kana/CJK ≈ 1.03·em) vs the smallest containing rect | size the box from the text, or shorten the text |
| `TEXT-COLLISION` | two labels overlap each other, unreadable | estimated glyph boxes of two `<text>` elements intersect | move one label; stagger stacked captions vertically |
| `TIGHT-BOTTOM` | text/inner box crammed against the bottom edge | a child's bottom sits within 8px of its container's bottom | increase box height / bottom padding |
| `OVERLAP` | a label is hidden behind another box | two opaque rects partially overlap and neither contains the other (container↔child pairs exempt) | move the label into clear space or widen the gap |
| `LABEL-OCCLUSION` | a free/edge label bleeds onto a neighbouring box | a `<text>` whose anchor is outside a box, or a label background pill, overlaps a box it does not own | move the label to open space (above/below the arrow); do not rely on the pill to "cover" a box |
| `ARROW-THROUGH-BOX` | a connector crosses a box it is not going to | an arrow segment passes through a node interior that is neither its source nor its target (a group-frame **title chip** counts as a box) | reroute the connector around the box; enter a framed group away from its title chip |
| `ARROWHEAD-IN-BOX` | arrowhead/tail buried inside an element | a connector endpoint lies strictly INSIDE a node box — endpoints must land ON an edge (classic: an arrow into a frame top landing on the frame's title chip) | move the endpoint to clear edge; shorten the chip or shift the arrow x past it |
| `LINE-THROUGH-BOX` | a separator line strikes through content | a markerless line PARTIALLY crosses a node box (fully-inside divider/legend lines are fine) | split the line into segments around the box, or move it |
| `FRAME-OVER-NODE` | nodes vanish behind a frame/panel | a frame-sized decorative rect (height > 44px) appears in the document **after** a solid rect it overlaps — document order is z-order in SVG | emit frames before nodes; in svgkit, `group_frame` auto-underlays regardless of call order |
| `OFFCANVAS-TEXT` / `OFFCANVAS-RECT` | element clipped at the picture edge | a coordinate falls outside the root `viewBox` | grow the canvas or reposition |
| `MARKER-NO-ORIENT` | arrowhead points the wrong way | a `<marker>` has no `orient="auto"` | add `orient="auto-start-reverse"` |
| `WIDE-CANVAS` | long single row, shrinks when embedded | aspect ratio > 4.5:1 and width > 1200 | wrap the nodes onto two rows |
| `ROW-PADDING-UNEVEN` | every card in a row has a band of paper under its text | the boxes of one row (same y and height) all leave more air below their content than above, by more than 6px | size the row from its tallest content with even padding (`cards_row`, `card(valign="middle")`) |
| `BOX-PADDING-UNEVEN` | one box has its text pushed up or down | a single box's content sits more than 6px nearer one horizontal edge than the other; a header band counts as chrome, so the inset is measured from under it | `card()` computes the height; for a forced height pass `valign="middle"` |
| `WRAP-SLACK` | a line breaks into two although both halves fit | two consecutive lines of one paragraph (same anchor, x, size, colour and weight) would fit in one at 16px side padding and 93% of the width | wrap to the box's inner width (`w - 2*pad`), not to a narrower guess |
| `ROW-HEIGHT-MISMATCH` | cards in a row end at different heights | boxes at one y with the same fill and container, separated by less than the split gap, differ in height by more than 2px | draw the row with one height — the tallest content's |
| `ROW-WIDTH-MISMATCH` | columns of unequal width | the same peers differ in width; a quantity rect (`data-measure`) and a band-carrying label card are exempt | `row_positions()` / `row()` for the columns; give a different kind of box a different fill or a gap of 60px+ |
| `ROW-GAP-UNEVEN` | irregular gaps between columns | the gaps of one row differ by more than 3px | one gap per row |
| `STACK-GAP-UNEVEN` | irregular gaps between stacked boxes | boxes stacked at one x with one width have gaps that differ, and the wider gaps hold nothing | one gap per stack, or something in the wider gap |
| `FRAME-PADDING-UNEVEN` / `FRAME-PADDING-LOOSE` | a group frame with lopsided or wide insets | a container's content sits at different distances from its four sides (a chip straddling the top border moves the top inset to the chip's bottom), or every inset is over 32px | `frame_around(boxes, pad)`; a zone after a heading starts `CHIP_RISE` below the heading's return value |
| `BAND-CORNERS` | a header band whose bottom corners poke past the card body | a rect sharing a full edge with a rounded box has rounded corners of its own | `Canvas.band(..., side=)` — round on the outline, square against the body |
| `TEXT-ON-LINE` | a line runs through letters | a stroke — a line, a stroked path segment, a visible rect edge — crosses a glyph box with no opaque rect drawn after it under the letters | move the label off the line, or `text(..., mask=True)`; draw the line before the label, never after |
| `LABEL-GROUPING` | a label that could belong to either of two things | a free text sits within 20px of its nearest shape or line and less than twice that distance from another shape or label in its line of sight | put the label inside its box, or keep twice the distance to everything else |
| `EMPTY-STACK-GAP` | a hand's width of blank paper between two stacked boxes | over 96px between vertically stacked boxes with nothing in the band but a plain vertical drop; a heading crossing the band counts as content | close the gap, or put the routing and its labels there |

Decorative rects (a `stroke-dasharray` frame, or a low-`opacity` wash) are
excluded from the spacing/overlap checks, so a legend chip that intentionally
straddles a dashed group border is not flagged. Solid rects are classified as
**containers** (subgroup/layer boxes, canvas backgrounds) when they cover
nearly the whole canvas or fully contain a node-sized solid rect (height
≥ 34px and ≥ 5% of the parent's area): arrows legitimately run inside them
and labels may straddle their borders, so they are exempt from
`ARROW-THROUGH-BOX`, `ARROWHEAD-IN-BOX`, `LABEL-OCCLUSION`, and
container↔child `OVERLAP` pairing — while a card that merely contains its own
badge/footer chips still counts as a node. XML comments are stripped before
scanning, `<text>` with `transform` positioning is skipped (its x/y are not
canvas coordinates), and tspan-based text (mermaid output) is measured by its
widest tspan run.

## Prevent at generation time

Detection catches mistakes; these habits stop them being made. `scripts/svgkit.py`
bakes them in:

- **Perpendicular entry.** Use orthogonal (Manhattan) connectors whose final
  segment is horizontal into a left/right edge or vertical into a top/bottom
  edge. `svgkit.ortho(x1,y1,x2,y2, exit, entry, lane=…)` guarantees this and
  gives each connector its own lane so parallel arrows never overlap. Reserve
  curves for edge-to-edge links that already arrive axis-aligned.
- **Glyph-width box sizing.** Compute box width from the text
  (`svgkit.tw(text, size, mono)`), never eyeball it — this makes overflow
  structurally impossible even though you cannot see the render while coding.
  `tw` is CJK-aware, so Korean/Japanese/Chinese labels get the ~1 em width they
  actually render at; a width hardcoded for Latin will clip CJK.
- **Edge labels go in open space, not narrow gaps.** A background pill hides
  crossing *lines*, not boxes. Placing a label centred on a short arrow between
  two close boxes makes it bleed onto them (`LABEL-OCCLUSION`). Put edge labels
  in the clear band above/below the arrow, or widen the gap.
- **Route around intervening boxes.** A straight or lazily-routed connector can
  cross a box between its endpoints (`ARROW-THROUGH-BOX`). Give the connector a
  lane that detours around obstacles, and remember a group-frame's title chip is
  an opaque box — enter the frame at an x clear of the chip (chips sit top-left).
- **Frames go behind nodes.** Document order is z-order in SVG: a panel emitted
  after its nodes hides them (`FRAME-OVER-NODE`). In raw XML, write group/frame
  rects first; svgkit's `group_frame` draws on a dedicated underlay layer, so
  call order cannot break stacking.
- **Anchor connectors on edge points.** Compute endpoints with
  `edge_pt(box, side, f)` from the box tuples that `node()` returns, instead of
  retyping coordinates — retyped endpoints drift when a box moves, which is how
  oblique and short arrows creep in.
- **Marker-name safety.** Pass a marker *name*, or let the helper map a palette
  colour to its marker so a stray colour value can never produce a dead
  `url(#arr-#hex)` reference.
- **Breathing room.** Keep ≥ ~24px between connected boxes (so arrows have a
  visible shaft) and ≥ 8px between a box's content and its edges.
- **Split, don't sprawl.** If a row of nodes makes the canvas too wide, wrap
  onto two rows with a connector from the end of row 1 into the top of row 2.
- **Size every box from its content.** A fixed height is how a row ends up
  with a band of paper under its text and how the one card with three lines
  spills past its edge. Compute the height from the wrapped lines with even
  padding — the scaffold's `card()`, `cards_row()`, `pill()`, `note()`,
  `zone()` and `step_row()` do — and give a whole row the tallest content's
  height. The glyph model the lint uses is `0.78·size` above the baseline and
  `0.24·size` below.
- **One gap per row and per stack; one width per row.** Columns come from
  `row_positions()`; a box of another kind in the same row (a lead label
  beside a ladder of steps) takes another fill or a gap of 60px+, so the lint
  reads it as a separate group rather than an uneven column.
- **A label belongs to one thing.** Put it inside the box it names, or keep
  it twice as far from everything else as from its owner. A heading followed
  by a zone starts the zone `CHIP_RISE` lower, so the chip on the border, not
  the border, keeps the heading gap.
- **Text never crosses a line unmasked.** Draw the line first and the label
  last on a paper plate (`text(..., mask=True)`), or move the label into open
  space. A mask drawn before the line does nothing — document order is paint
  order.
- **Bands round with the outline.** A header or side band inside a rounded box
  is `Canvas.band(..., side=)`: round on the box's edge, square against its
  body. A rounded rect on the edge reads as a chip resting on the card.
- **Declare quantities.** A rect whose width or height is the value — a bar, a
  strip segment, a treemap cell — carries `measure="width"|"height"|"both"`
  (`data-measure`), so the row and frame checks measure nothing against it.

## Tokyo Night palette (svgkit values)

`#1a1b26` bg · `#24283b` card · `#292e42` inner · `#3b4261` border ·
`#565f89` muted · `#c0caf5` text · `#7aa2f7` blue · `#7dcfff` cyan ·
`#73daca` teal · `#9ece6a` green · `#bb9af7` purple · `#f7768e` red ·
`#ff9e64` orange · `#e0af68` yellow (svgkit accessor `c.yellow`).

Note: the raw-XML templates and `layout.js` use `--line:#3d59a1` for edges
(brighter, reads as a connector color) while svgkit's `line` chrome is
`#3b4261` (box borders) — don't mix the two conventions in one SVG.
