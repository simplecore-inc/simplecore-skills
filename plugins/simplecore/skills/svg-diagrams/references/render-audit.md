# Render Audit - verify SVG by rendering, not by reading XML

Valid SVG XML does not mean a correct picture. Text overflow, missing or
oblique arrowheads, head-only arrows, occluded labels, and content jammed
against a box edge are **invisible in the source** and only show up once the
SVG is rasterized. Always rasterize and inspect before delivering an SVG.

`scripts/audit.py` provides the operations of the loop: `render` (full),
`crop` (zoom into a region), `hotspots` (a zoomed crop of every arrow
endpoint) and `lint` (static defect scan). `contrast` and `markers` cover what
a static scan of one SVG cannot see: `contrast` renders each figure with its
text removed and measures every label against the ground painted under it, and
`markers` reads a generator's Python source for connector calls that inherit
the default arrowhead. `pills` reads a document-figure module the same way, for
connector labels drawn on the toolkit's pill rather than the figure library's
`edge_label`.

## The loop

```
generate SVG
  → audit.py lint <svg> [more…]      # static scan, must reach "no issues" (exit 1 gates a loop)
  → audit.py render <svg> out.png    # full raster, Read it
  → audit.py hotspots <svg> crops/   # auto-crop EVERY arrow endpoint at high zoom, Read them
  → audit.py crop <svg> x y w h …    # zoom any remaining tight spot
  → audit.py contrast <svg> [more…]  # every label clears the floor (3:1, or --floor) on its own ground
  → audit.py markers <module.py> …   # every .line()/.path() call states marker=
  → audit.py pills <module.py> …     # document figures: every connector label is the library's edge_label
  → fix generator
  → repeat until lint is clean AND the endpoint crops look right
```

`hotspots` exists because a full render viewed downscaled hides sub-10px
defects - an arrowhead landing on a title chip, a label kissing a box. Those
defects live at connector endpoints, so cropping each endpoint at 4x makes the
visual pass systematic instead of an eyeball sweep.

Lint is a *screen*, not the verdict. Every lint hit must be confirmed (or
dismissed as a false positive) by looking at a crop. Conversely, lint passing
does not prove the picture is good - still eyeball the full render and the
arrowheads.

## Rendering (ground truth)

Chrome/Chromium headless renders an SVG exactly the way a browser (and GitHub's
`<img>`) will. It honours the root `width`/`height`, so screenshot at those
dimensions. (`qlmanage` on macOS produces a padded square thumbnail - do not
trust it for layout.)

```bash
python3 <skill>/scripts/audit.py render diagram.svg out.png 2        # 2x for crispness
python3 <skill>/scripts/audit.py crop  diagram.svg 716 200 80 120 head.png 5
```

`crop` rewrites the root `viewBox`+`width`+`height` to the requested region and
renders it large - this is how you see whether an arrowhead actually lands on
an edge, whether a glyph touches a border, etc.

Set the Chrome binary with the `CHROME` env var if auto-detection fails.

### The renderer that ships the figure is not the one you author in

Chrome is ground truth for the picture; it is not ground truth for where the
picture ends up. A figure embedded in a `.pptx`, a `.docx`, an e-reader or a
print pipeline is redrawn by that product's own SVG engine, and those engines
implement a smaller language than a browser does. **Where they differ, the
failure is silent in both directions**: the document validates, the lint is
clean, and the authoring render is correct, so nothing between the generator
and the reader can see it. The one that has actually cost a deck is
`orient="auto-start-reverse"` - a renderer that does not know the SVG 2 value
falls back to the initial `orient` of 0 and draws **every** arrowhead
unrotated, pointing +x, so a downward connector arrives with a triangle stuck
to its side and a right-to-left one points back where it came from.

So keep the emitted SVG inside SVG 1.1 wherever a feature has a 1.1 spelling
that does the same job, and settle any doubt by rendering one page **in the
destination product** and looking at it. What the toolkit holds to:

- `orient="auto"`, never `auto-start-reverse` - put the reversal in the
  geometry by swapping the segment's endpoints.
- no `marker-start`; every connector carries its head on `marker-end`.
- markers sized in `strokeWidth` units, which every engine implements.
- no `filter=` in a figure bound for a .pptx or a .docx. PowerPoint's SVG
  import drops every element that references a `<filter>`: the shape vanishes
  while its labels stay. svgkit draws the shadow under `card()` and `node()`
  with one, so such a figure is drawn on `Canvas(w, h, shadow=False)`; the
  document-figure library's `canvas()` does that, and its `verify.py` fails a
  figure that references a filter.

Adding a feature past that list means rendering it in the destination before it
goes into the toolkit, and writing the verdict here.

### Reading the PNGs

When viewing several full renders in one read, keep each image **≤ 2000px on
its longest side** - a wide canvas at 2x exceeds that and the read is rejected.
Render wide canvases at scale 1.5 for the overview, then `crop` at 4–5x for the
details that the downscaled overview hides.

## Defect catalog (what `lint` checks)

| Lint id | Symptom in the render | How it is detected | Fix |
|---|---|---|---|
| `UNRESOLVED-MARKER` | arrowhead silently absent | `marker-end="url(#id)"` whose `id` is not a defined `<marker>` (e.g. a colour value was passed where a marker name was expected) | reference a defined marker; resolve colour→marker-name centrally |
| `OBLIQUE-ARROW` | head meets the box at a slant | final segment of an arrowed `path`/`line` is not axis-aligned | route orthogonally so the **last segment is perpendicular** to the target edge |
| `DIAGONAL-SEGMENT` | a connector runs at a slant between two boxes | a straight segment of an arrowed connector is neither horizontal nor vertical | route orthogonally (`ortho()`) and turn the corner with a quarter-arc |
| `SWEEPING-CURVE` | a connector bends in a freehand curve instead of a corner | a curved segment of an arrowed connector spans more than 28px, where a corner arc spans r=6~12; a self-transition, whose ends sit under 90px apart, is exempt | route orthogonally with quarter-arc corners (`ortho()`, `elbow()`) |
| `SHORT-ARROW` | head-only / cramped arrow | final segment shorter than 18px | lengthen the connector; open up the gap between the boxes |
| `ARROWHEAD-OVER-SHAFT` | an arrow reads as a triangle stuck to a corner | the final segment of an arrowed connector leaves less line than its arrowhead is long; the head's printed length comes from its marker and the stroke width | lengthen the final segment, or thin the stroke |
| `TEXT-OVERFLOW` | label spills past its box | the label's width, estimated with the CJK-aware per-class table `svgkit.tw` and the lint share, against the smallest rect containing its anchor | size the box from the text, or shorten the text |
| `TEXT-COLLISION` | two labels overlap each other, unreadable | estimated glyph boxes of two `<text>` elements intersect | move one label; stagger stacked captions vertically |
| `COLLAPSED-SPACE` | two fields printed as one run (「128 GB 변수:」) | a `<text>` holds a run of two or more spaces between words and whitespace is not preserved; SVG prints the run as one space | set each field as its own text at its own x (a column), or join the fields with a visible separator ( · ); never space fields apart inside one string |
| `TIGHT-BOTTOM` | text/inner box crammed against the bottom edge | a child's bottom sits within 8px of its container's bottom | increase box height / bottom padding |
| `OVERLAP` | a label is hidden behind another box | two opaque rects partially overlap and neither contains the other (container↔child pairs exempt) | move the label into clear space or widen the gap |
| `HAIRLINE-GAP` | two boxes neither joined nor apart | boxes overlap on one axis and sit 0 to 3px apart on the other - the strokes on either side are thicker than the space between them, so it prints as one heavy line with a sliver in it | butt the halves at one x with square facing corners (`Canvas.band(..., side=)`, or `joined_cell`), or open the gap |
| `SLIVER-RECT` | a sheet behind a box written as a rectangle | an unfilled rect under 12px tall and at least 40px wide sits on or just above a box at least three times its height and reaches more than 2px past that box's left or right edge | draw the sheet as the sliver that shows - one open path per sheet, called before the front box - with `stack_behind(c, x, y, w, h, color, side=…)`; `side="up"` for a box already flush with the content margin |
| `NEAR-OVERLAP` | two boxes meant to sit edge to edge print a doubled border | rects overlap by more than 1.5px but less than `OVERLAP`'s 4px gate, neither containing the other - the band between stroke bleed and occlusion | step the stack by the box's own height, or set the height to the pitch |
| `LABEL-OCCLUSION` | a free/edge label bleeds onto a neighbouring box | a `<text>` whose anchor is outside a box, or a label background pill, overlaps a box it does not own | move the label to open space (above/below the arrow); do not rely on the pill to "cover" a box |
| `LABEL-ON-STROKE` | a stroke cuts through the letters of a label | a `<text>` lies across the outline of a stroked circle of r 12 or more, and no opaque rect drawn after the circle covers its glyph box - a Venn's set name, a ring label | put a paper mask under the label (`text(..., mask=True)`), or move it off the outline |
| `LABEL-HIDES-CONNECTOR` | a label and an arrowhead float in a gutter with nothing joining them | a label mask covers more than half of the one connector it touches, or leaves under 24px of it | move the label off the line into the open band beside it |
| `LABEL-HIDES-ARROWHEAD` | an arrowhead renders clipped or not at all | a label mask covers the body of a connector's head, 10px back from the tip, while sparing the tip | slide the label 10px or more along the run, away from the endpoint |
| `LABEL-MASKS-CORNER` | a route's bend or its arrival disappears under a label | a label mask covers a point where the connector turns, or its endpoint | move the label onto a straight run |
| `MASK-OVER-OTHER-CONNECTOR` | a label erases a line it does not belong to | a label mask covers runs of two or more different connectors | place the label where only its own connector passes |
| `ARROW-THROUGH-BOX` | a connector crosses a box it is not going to | an arrow segment passes through a node interior that is neither its source nor its target (a group-frame **title chip** counts as a box) | reroute the connector around the box; enter a framed group away from its title chip |
| `CONNECTOR-ON-EDGE` | a box looks thick-edged on one side and the route it carries vanishes there | a horizontal or vertical run of an arrowed connector lies within 2px of a box edge for more than 24px | move the lane into the channel between the boxes |
| `ARROWHEAD-IN-BOX` | arrowhead/tail buried inside an element | a connector endpoint lies strictly INSIDE a node box - endpoints must land ON an edge (classic: an arrow into a frame top landing on the frame's title chip) | move the endpoint to clear edge; shorten the chip or shift the arrow x past it |
| `FLOATING-ENDPOINT` | a line that comes from, or points at, empty canvas | a connector endpoint lies within 3px of no box edge, no closed outline path and no drawn line that carries no arrowhead (a lifeline, an axis, a bracket); a ring of arcs around one centre is exempt | snap the endpoint to the edge it leaves or arrives at; draw a destination that is missing and land on it |
| `ARROWHEAD-AT-BEND` | a route arrives two or three times before it gets anywhere - heads sitting on its own corners | an arrowhead whose tip is the endpoint of another `<line>` that carries on in a different direction, and which touches no box edge | draw the head on the final segment only and pass `marker=None` on every segment before it |
| `CROWDED-ARRIVAL` | two routes arrive at one box a head apart and print as one doubled head | two arrowheads land on the same rect's edge 2 to 24px apart, pointing within about 20° of each other - an arrowhead is about 13px across at the usual stroke, so the reader counts one route where the drawing has two | space the arrivals down the edge by at least a head's width each side, or join the two routes into one before they reach the box |
| `SHARED-ATTACH-POINT` | two connections read as one | the ends of two different connectors meet one side of a box under 12px apart, 8px on an edge shorter than 60px | fan the attach points along the edge |
| `LINE-THROUGH-BOX` | a separator line strikes through content | a markerless line PARTIALLY crosses a node box (fully-inside divider/legend lines are fine) | split the line into segments around the box, or move it |
| `FRAME-OVER-NODE` | nodes vanish behind a frame/panel | a frame-sized decorative rect (height > 44px) appears in the document **after** a solid rect it overlaps - document order is z-order in SVG | emit frames before nodes; in svgkit, `group_frame` auto-underlays regardless of call order |
| `OFFCANVAS-TEXT` / `OFFCANVAS-RECT` | element clipped at the picture edge | a coordinate falls outside the root `viewBox` | grow the canvas or reposition |
| `MARKER-NO-ORIENT` | arrowhead points the wrong way | a `<marker>` has no `orient` at all, so it never rotates | add `orient="auto"` |
| `MARKER-ORIENT-UNSUPPORTED` | **every** arrowhead in the picture points right, whatever direction its connector runs | a `<marker>` declares `orient="auto-start-reverse"` (SVG 2) or any value that is neither `auto` nor an angle | write `orient="auto"`; put a reversal in the geometry, never in the marker |
| `WIDE-CANVAS` | long single row, shrinks when embedded | aspect ratio > 4.5:1 and width > 1200 | wrap the nodes onto two rows |
| `DEAD-MARGIN` | a band of empty board down one side of the figure | the ink stops more than 40px short of an edge of the board; `verify.py` judges a document figure against the `deadMargin` set for its board | spread the content over the width it was given, or shrink the board |
| `TIGHT-MARGIN` | a stroke clipped at the picture edge | the ink comes within 8px of an edge of the board | leave a margin round the ink; `trim()` fits the board with one |
| `ROW-PADDING-UNEVEN` | every card in a row has a band of paper under its text | the boxes of one row (same y and height) all leave more air below their content than above, by more than 6px | size the row from its tallest content with even padding (`cards_row`, `card(valign="middle")`) |
| `BOX-PADDING-UNEVEN` | one box has its text pushed up or down | a single box's content sits more than 6px nearer one horizontal edge than the other; a header band counts as chrome, so the inset is measured from under it | `card()` computes the height; for a forced height pass `valign="middle"` |
| `WRAP-SLACK` | a line breaks into two although both halves fit | two consecutive lines of one paragraph (same anchor, x, size, colour and weight) would fit in one at 16px side padding and 93% of the width | wrap to the box's inner width (`w - 2*pad`), not to a narrower guess |
| `ROW-HEIGHT-MISMATCH` | cards in a row end at different heights | boxes at one y with the same fill and container, separated by less than the split gap, differ in height by more than 2px | draw the row with one height - the tallest content's |
| `ROW-WIDTH-MISMATCH` | columns of unequal width | the same peers differ in width; a quantity rect (`data-measure`) and a band-carrying label card are exempt | `row_positions()` / `row()` for the columns; give a different kind of box a different fill or a gap of 60px+ |
| `ROW-GAP-UNEVEN` | irregular gaps between columns | the gaps of one row differ by more than 3px | one gap per row |
| `STACK-GAP-UNEVEN` | irregular gaps between stacked boxes | boxes stacked at one x with one width have gaps that differ, and the wider gaps hold nothing | one gap per stack, or something in the wider gap |
| `FRAME-PADDING-UNEVEN` / `FRAME-PADDING-LOOSE` | a group frame with lopsided or wide insets | a container's content sits at different distances from its four sides (a chip straddling the top border moves the top inset to the chip's bottom, and the chip's own ink, an icon drawn with rects included, is not content), or every inset is over 32px | `frame_around(boxes, pad)`; a zone after a heading starts `CHIP_RISE` below the heading's return value |
| `BAND-CORNERS` | a header band whose bottom corners poke past the card body | a rect sharing a full edge with a rounded box has rounded corners of its own | `Canvas.band(..., side=)` - round on the outline, square against the body |
| `TEXT-ON-LINE` | a line runs through letters | a stroke - a line, a stroked path segment, a visible rect edge - crosses a glyph box with no opaque rect drawn after it under the letters | move the label off the line, or `text(..., mask=True)`; draw the line before the label, never after |
| `LABEL-GROUPING` | a label that could belong to either of two things | a free text sits within 20px of its nearest shape or line and less than twice that distance from another shape or label in its line of sight | put the label inside its box, or keep twice the distance to everything else |
| `EMPTY-STACK-GAP` | a hand's width of blank paper between two stacked boxes | over 96px between vertically stacked boxes with nothing in the band but a plain vertical drop; a heading crossing the band counts as content | close the gap, or put the routing and its labels there |
| `PARALLEL-CONNECTORS` | two connectors read as one thick line | two arrowed runs on the same axis under 12px apart that overlap by more than 24px along it | offset one of them by 12px or more |
| `COLLINEAR-CONNECTORS` | one trunk with branches where several connectors were drawn | two arrowed runs on one line (under 2.5px apart) that overlap by less than 24px or leave under 16px - two bend radii - between them, so their corners flow into each other | give each connector its own bend coordinate (`ortho(..., lane=)`); order the lanes so none crosses |
| `COINCIDENT-LINES` | two lines print as one where two were drawn | two stroked runs of any kind and orientation (a divider, a rule, a connector) lie under 2.5px apart for 6px or more; a crow's-foot prong along its relationship line and two unheaded lines meeting end to end where routes merge are the notation and pass, and a pair `PARALLEL-CONNECTORS` already reports is left to it | move one line off, or draw the shared run once |
| `SELF-DOUBLED` | a route runs back over itself | two segments of one path lie on top of each other - a check that compares different connectors never sees it | draw the route once, without the return leg |
| `DROP-INTO-GAP` | a vertical arrow points at the paper between two cards | a headed vertical line's lower end lands within 72px above a row of two or more boxes and on none of them - the drop was drawn from a zone's centre onto an even row | land it on one box, or end it on a rail (or fork it into legs) that reaches each box |
| `LOW-CONTRAST` (`audit.py contrast`) | a label disappears into the band under it | the most common colour inside the label's own box, on a render with every `<text>` removed, gives the label's fill a contrast ratio under the floor: 3:1 by default, `--floor` sets another (`verify.py` passes `contrastFloor`) | take the band's own dark tone for the label, or move the label off the band |
| `MARKER-DEFAULT` (`audit.py markers`) | a route grows an arrowhead on every corner while its source reads as correct | a `.line()` or `.path()` call in a generator states no `marker=` (a call forwarding `**kwargs` is not judged) | pass `marker=None` on every segment but the last, and the head's colour on the one that arrives |
| `EDGE-PILL` (`audit.py pills`) | a connector label's plate prints over the boxes either side of a tight gap | a document-figure module calls `Canvas.edge_label` with its pill on (the default, or `pill=True`), whose plate spreads 8 units a side and a third of an em above and below the letters (a call on a module bound by `import`, a computed `pill` and a call forwarding `**kwargs` are not judged) | call the figure library's `edge_label(c, x, y, text, accent)`, which fits the plate to the glyph box (6 a side, 3 above and below), or `pill=False` for a bare label in open paper |
| `SEPARATOR-OFF-CENTRE` | a 「›」 between two boxes leans toward one of them | a separator glyph (`›` `→` `»` `▶` `▸` `‣`) whose centre is more than 1.5px from the midpoint of the gap between the box on its left and the box on its right | anchor the glyph on the gap's midpoint - `(x1 + x2) / 2` from the two boxes' edges, never a fixed offset from one of them |

Decorative rects (a `stroke-dasharray` frame, or a low-`opacity` wash) are
excluded from the spacing/overlap checks, so a legend chip that intentionally
straddles a dashed group border is not flagged. Solid rects are classified as
**containers** (subgroup/layer boxes, canvas backgrounds) when they cover
nearly the whole canvas or fully contain a node-sized solid rect (height
≥ 34px and ≥ 5% of the parent's area): arrows legitimately run inside them
and labels may straddle their borders, so they are exempt from
`ARROW-THROUGH-BOX`, `ARROWHEAD-IN-BOX`, `LABEL-OCCLUSION`, and
container↔child `OVERLAP` pairing - while a card that merely contains its own
badge/footer chips still counts as a node. XML comments are stripped before
scanning, `<text>` with `transform` positioning is skipped (its x/y are not
canvas coordinates), and tspan-based text (mermaid output) is measured by its
widest tspan run. A **label mask** is a rect no taller than 28px, with corners
under 8, that holds a label and no other rect; the four mask rows judge where
one sits.

## Prevent at generation time

Detection catches mistakes; these habits stop them being made. `scripts/svgkit.py`
bakes them in:

- **Perpendicular entry.** Use orthogonal (Manhattan) connectors whose final
  segment is horizontal into a left/right edge or vertical into a top/bottom
  edge. `svgkit.ortho(x1,y1,x2,y2, exit, entry, lane=…)` guarantees this and
  gives each connector its own lane so parallel arrows never overlap. Reserve
  curves for edge-to-edge links that already arrive axis-aligned.
- **A route drawn as several calls says `marker` on every one of them.**
  `line()` and `path()` draw an arrowhead by default, so a collector built the
  usual way - a drop from each box, a rail joining them, a branch off the rail -
  grows a head on every corner, and the source looks right because the word
  `marker` never appears in it. Pass `marker=None` on each segment and the
  accent on the one that arrives. `ortho()` and `elbow()` emit the whole route
  as one path and are the better answer whenever the shape is a single
  connector rather than a comb.
- **Glyph-width box sizing.** Compute box width from the text
  (`svgkit.tw(text, size, mono)`), never eyeball it - this makes overflow
  structurally impossible even though you cannot see the render while coding.
  `tw` is CJK-aware: its per-class table, calibrated against Chrome and shared
  with the lint, gives a Korean, Japanese or Chinese glyph the width it renders
  at, and a width hardcoded for Latin will clip CJK.
- **Edge labels go in open space, not narrow gaps.** A background pill hides
  crossing *lines*, not boxes. Placing a label centred on a short arrow between
  two close boxes makes it bleed onto them (`LABEL-OCCLUSION`). Put edge labels
  in the clear band above/below the arrow, or widen the gap.
- **Route around intervening boxes.** A straight or lazily-routed connector can
  cross a box between its endpoints (`ARROW-THROUGH-BOX`). Give the connector a
  lane that detours around obstacles, and remember a group-frame's title chip is
  an opaque box - enter the frame at an x clear of the chip (chips sit top-left).
- **Frames go behind nodes.** Document order is z-order in SVG: a panel emitted
  after its nodes hides them (`FRAME-OVER-NODE`). In raw XML, write group/frame
  rects first; svgkit's `group_frame` draws on a dedicated underlay layer, so
  call order cannot break stacking.
- **Anchor connectors on edge points.** Compute endpoints with
  `edge_pt(box, side, f)` from the box tuples that `node()` returns, instead of
  retyping coordinates - retyped endpoints drift when a box moves, which is how
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
  padding - the document-figure library's `card()`, `cards_row()`, `pill()`, `note()`,
  `zone()` and `step_row()` do - and give a whole row the tallest content's
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
  space. A mask drawn before the line does nothing - document order is paint
  order.
- **Bands round with the outline.** A header or side band inside a rounded box
  is `Canvas.band(..., side=)`: round on the box's edge, square against its
  body. A rounded rect on the edge reads as a chip resting on the card.
- **Declare quantities.** A rect whose width or height is the value - a bar, a
  strip segment, a treemap cell - carries `measure="width"|"height"|"both"`
  (`data-measure`), so the row and frame checks measure nothing against it.

## Tokyo Night palette (svgkit values)

`#1a1b26` bg · `#24283b` card · `#292e42` inner · `#3b4261` border ·
`#565f89` muted · `#c0caf5` text · `#7aa2f7` blue · `#7dcfff` cyan ·
`#73daca` teal · `#9ece6a` green · `#bb9af7` purple · `#f7768e` red ·
`#ff9e64` orange · `#e0af68` yellow (svgkit accessor `c.yellow`).

Note: the raw-XML templates and `layout.js` use `--line:#3d59a1` for edges
(brighter, reads as a connector color) while svgkit's `line` chrome is
`#3b4261` (box borders) - don't mix the two conventions in one SVG.
