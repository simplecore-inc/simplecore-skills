# Figures that live in a document

Almost every diagram this skill draws ends up inside something - a proposal, a
design document, a manual, a README. A picture that was sized for its own window
looks wrong the moment it is placed beside another one: two figures on facing
pages print their body text at different sizes, and the reader reads that as
carelessness before reading either figure.

**Assume the figure is embedded unless the request says otherwise.** A diagram
asked for on its own is the exception, not the default.

## One width for the whole set

Every figure in a document is placed at the same percentage of the same text
column. So every figure carries the same final canvas width, and only the height
varies with content.

Derive the width once and record it where the project's other figure settings
live:

```
text column = paper width − left margin − right margin
A4 with 25.4mm margins → 210 − 50.8 = 159.2mm ≈ 602px at 96 dpi
```

Then pick a drawing width that is a comfortable multiple of that - a set drawn
at `1200` units and placed at 50% prints at exactly that column. The number
itself is a project decision; **the invariant is that one number governs the
whole set.**

Three rules follow, and each is violated in a way that looks deliberate:

- **Do not compensate.** A figure with less to say does not get smaller type,
  thinner strokes or tighter cards so it can be drawn on a narrower canvas.
  Draw it on the shared canvas and use the extra room.
- **Padding is not the same as drawing wide.** A 900-unit picture centred in a
  1200-unit canvas has 150 units of dead margin a side; the printed result is a
  figure whose type is visibly smaller than its neighbours'. Recompute columns,
  card widths, gaps and annotation regions for the shared width.
- **Never scale the finished drawing.** A `transform="scale(…)"` or a
  non-uniform stretch to hit the width changes stroke weight and type size
  against every other figure. Re-lay out the primitives.

Meaningful ink has to reach close to both edges, and the lint puts a number on
it: a side gap over **40 units** fails as `DEAD-MARGIN`. On a 1200-unit canvas
that means an ink span of at least 1120 - about 93%. Lay content out from `x=24`
to `x=1176` and the finished figure lands inside it; drawing from `x=48` on a
1104-wide body does not, however balanced it looks in isolation.

`save()` centres what you drew, so the finished gap is
`max((width − ink span) / 2, margin)` - the `margin` argument only widens a
figure that was already narrow enough. Widening the drawing is the fix, not
raising the margin.

A genuinely symmetric concept - a Venn, a radial - may need more air. Say so in
the figure module rather than inflating the drawing to hit the number.

**A rail of right-aligned labels puts the figure's left edge at the mercy of its
longest word.** Lane names, row headers and axis labels set flush to the inner
edge of their column all start at `column_right − label_width`, so the leftmost
ink is whatever the longest label happens to be. Across a set drawn from one
generator that is invisible while the labels are long and fires the moment one
figure's labels are short - the same layout passes on four drawings and reports
`DEAD-MARGIN` on the fifth, and lengthening a label to satisfy a lint is not a
fix. Set such a rail flush to the **canvas** edge instead: every figure then
starts its ink at the same x, a long name has the whole column to run into, and
one that still does not fit is folded onto two lines rather than abbreviated.

**Width utilisation is not enlargement.** Keep the principal drawing at the
smallest size that stays legible and spend the remaining width on things that
would otherwise add height: side-by-side stages, branches, a legend, conditions,
an explanation panel.

## One type scale for the whole set

**The ladder is derived from the document's body size, not chosen.** A figure is
placed at a fraction of the page, so a label's drawn size and its printed size
are different numbers, and only the printed one matters. The floor is that
**the figure's smallest label prints at the document's body size**: a reader who
can read the paragraph can read every word in the picture beside it. Work
backwards from the placed width:

```
scale  = placed width in px / board width in units
units  = printed pt x 4/3 / scale          (96 dpi: 1pt = 4/3 px)
```

A 1200-unit board placed on a 642.5px column scales by 0.5354, so a 10pt body
needs 25 units and the familiar 15-unit micro-label would print at 6pt. **That
gap is invisible in the SVG and obvious on paper**, which is why the ladder is
computed once per document rather than carried between projects.

Then give each rung a role the document already has - body, a heading level, a
chip - so a label in a figure prints at the same size as the same kind of text
around it. A document that publishes its own type scale hands you the rungs; take
them rather than inventing a parallel set.

A second board for column-width figures uses **the same scale**, not the same
width: `column board = column px / scale`. Two boards at one scale means one
ladder serves both and a figure never has to be shrunk to fit a column - it is
re-laid out on the narrower board.

Stroke weights come from the same arithmetic, and there are **three of them for
the whole set**: a hairline for a rule or a faint separator, a normal weight for
a box border, a thick one for a line the reader is meant to follow. A 1-unit
hairline on a 0.5354 scale prints at 0.54px and drops out on paper, so derive
the three from printed px the way the type is derived from printed pt, declare
them once beside the type ladder (`HAIRLINE, STROKE, THICK` in the scaffold's
`common.py`) and draw with the names.

A fourth weight is a distinction nobody can see at print size, and the weights
below the hairline are worse than invisible: **a grid drawn from them is how a
figure turns grey.** Where a set of rows needs separating, alternate the row
grounds or space them; do not rule them. An icon's own stroke is the one
exception, because an icon is a glyph rather than a border - it keeps `ICON_SW`
and the check exempts it.

**A dashed line means one of four things, and the gap says which.** Declare the
patterns once beside the type and stroke ladders, give each one meaning, and
draw with the names: not yet decided, outside this project, the alternative
path, prohibited. A fifth gap is a meaning no reader can look up - one figure in
a set of 132 drew the only `3 7` in the document, which read as a prohibition to
its author and as nothing at all to anyone matching it against the four. The
scaffold's `verify.py` fails the run on a pattern off the list, and a figure that
draws a dash without naming its meaning in the figure is the unexplained
distinction the audit pass is for.

**One neutral grey, and it is the darker one.** A theme carries two - a
mid grey for secondary type and a pale one for rules and fills - and the pale
one set on type prints at a contrast ratio around 4.0 on white, under the 4.5 a
small size needs. The scaffold's `save()` promotes any pale-grey `<text>` to the
neutral grey rather than leaving it to every call site, so a figure cannot
reintroduce it and a line may still be drawn in the pale grey, where it belongs.

**The smallest rung is for a short marker and a value looked up, not for the
figure's own words.** A figure whose every label sits on it has no entry point:
at print size the reader meets an even field of grey and has nowhere to start.
Every figure carries at least one label at the body rung - normally the thing the
figure is about. The scaffold's `verify.py` fails the run on both of these, so
neither is a matter of judgement at review time.

A workable ladder for a 1200-unit canvas, before the derivation above adjusts it:

| Size | Role |
|---|---|
| 24 | figure title, where the figure carries one |
| 21 | major emphasis |
| 20 | section or principal node |
| 18 | card or node title |
| 17 | body |
| 16 | secondary note |
| 15 | dense micro-label |

A one-off size introduced to make one label fit is the defect this prevents.
**Rewrite the label or change the layout instead of dropping below the scale.**

Snap the emitted sizes at save time rather than trusting every call site - the
scaffold's `save()` does this, so layout code may keep its working numbers while
the artifact carries only scale values.

## Height is the scarce axis - minimise it, every figure, every time

Width is fixed, so height is the only thing that grows, and the page scales a
tall figure down: every extra unit of height shrinks the printed type of that
figure against its neighbours. **Minimising height is not a target to clear
once; it is a pass to make on every figure before saving it**, including a
figure that already fits. 720 units on a 1200-unit canvas is the number to stay
under and 840 is a failure - but a figure that lands at 700 and could have
landed at 520 is still wrong.

Make the pass in this order, and re-measure after each:

1. **Squeeze the repeating unit first.** A row, a card, a station repeats N
   times, so 20 units off it is 20N off the figure. Cut the row height to the
   text plus even padding, close the gap between rows, and tighten line spacing
   to the type size rather than to a round number.
2. **Delete rows that only hold a label.** An axis name, a legend, a closing
   sentence - put each one on a line that already exists (the header row, the
   end of the axis, beside the first card) instead of giving it a band of its
   own. Two label rows removed is often 60 units.
3. **Turn a tall stack on its side.** Five items stacked cost five row heights;
   the same five across the width cost one. Where the labels then overflow the
   narrower columns, that is the trade to weigh - not a reason to abandon the
   move.
4. **Cut the prose inside the picture.** Any sentence that repeats the
   surrounding paragraph is height the document already spent.

**What may never be traded for height**: legibility (the type scale is fixed),
a relationship the figure exists to show, and the padding that keeps text off
its own box - the lint's TIGHT-BOTTOM and TEXT-OVERFLOW mark the floor, and a
figure that trips them was compressed past the point of being readable.

When a figure holds two independently understandable structures, split it in
two. When splitting would break an ER model, a lineage, a state machine or
another inseparable relationship, keep one figure and let it be tall -
**never drop a relationship to hit a number.**

## The caption belongs to the document

Put the figure's name and its one-line explanation in the document's caption,
not inside the SVG. A title block inside the picture duplicates the caption and
adds vertical space to every figure in the set. Suppress it centrally - the
scaffold's `canvas()` disables `title()` so no figure module has to remember.

The prose must stand without the picture. A reader whose images failed to load
still has to follow the argument; the figure supplements it.

**And whatever the document says about a figure has to be checked by machine.**
A document that plans its figures - a caption, a list of the strings a figure
prints, a paragraph telling the reader how to read it - keeps that text in one
file and the drawing in another, and a figure is redrawn every time its chapter
changes. Nothing reports the drift: the build succeeds, the lint passes, and the
reader is told to follow a dashed line that went solid three revisions ago, or
handed a list of labels that names a symbol the figure stopped using. Every
instance of this found in one 132-figure set had survived a careful human pass
over the same pages.

Two comparisons catch nearly all of it, and both are a short script over the
`.svg` and the source file:

- **The planned strings against the printed ones, in both directions.** A string
  the figure prints that the plan does not name, and an item the plan names that
  the figure does not print. One direction alone misses half: a plan that glues
  two printed labels into one line reads as complete until something checks the
  plan's own items back against the drawing. Compare with the quotation brackets
  and the whitespace removed, and by containment rather than equality, since a
  label the figure wraps is two text elements and one planned item.
- **A line style the prose tells the reader to look for against the styles the
  drawing has.** A page that says 「점선」 with no dashed stroke in its figure is
  a stale instruction, and it lives in prose where no string comparison reaches
  it.

Scope each comparison to one figure. A page carrying two figures will otherwise
judge the second against the first one's text, and the false positive teaches
people to edit true sentences to silence the check - worse than not checking.

## The composition comes from the claim, not from the list

**Before laying anything out, write down the one sentence the surrounding prose
is making.** Not the topic - the claim. 「여섯 성과가 있다」 is a topic; 「1~4를
개발·검증해서 5·6을 남긴다」 is a claim, and only the second one can be drawn.

A figure built from the topic reproduces the list that is already on the page:
six items become six equal cards, and the reader learns nothing the paragraph
above did not already say. A figure built from the claim shows the **relation**
between the items - which ones are inputs, which are results, what has to
happen first, what converges, what is excluded - and that relation is the part
prose is worst at carrying.

Work in this order, every time:

1. **State the claim in one sentence.** If you cannot, read the section again;
   a figure drawn before the claim is known will be a row of boxes.
2. **Name what the reader must see that a list cannot say** - order, dependency,
   convergence, containment, exclusion, scale, a loop.
3. **Choose the form that carries exactly that**, then build it out of the
   primitives already here - `band` tabs, numbered badges, `group_frame`
   panels, a junction `dot`, `ortho` fan-in, a matrix, an axis. **Invent the
   composition, not the visual language**; a new kind of connector or a new
   label style makes the figure look unlike its neighbours for no gain.
4. **Tie the figure back to the prose.** If the paragraph numbers its items,
   the cards carry the same numbers; if it names the stages, the tabs use the
   same words. A reader moving between the two must never have to translate.

**Check the figure against the text before calling it done** - the caption, the
numbering and the terms in the picture all have to match the section it sits
in. A figure that was right for an earlier draft and now illustrates a claim
the text no longer makes is the most expensive defect in a document set,
because it reads as authoritative.

**The test is to cover the labels.** With every word hidden, the shape alone
should still say the claim: four things feeding one point that opens into two.
If the covered figure says nothing, the labels were doing all the work and the
composition is decoration.

## Vary the composition across a set

Preserve each figure's semantic grammar. Use boundaries or strata for zones, a
branching tree for taxonomies, fan-in/fan-out for lineage, an ER-style graph for
object relations, a state machine for guarded transitions, a matrix for
crossings, an axis for relative position, a closed path for a feedback loop.
Supporting notes may share a card style, but the principal form has to make the
concept recognisable before its labels are read.

**Reject a sequence in which most figures could be mistaken for the same
box-and-arrow template.** That is the failure mode of a large set: every
structure gets flattened into a row of rounded cards because that never looks
wrong.

**Orientation is part of the composition, and a portrait document has room for
vertical figures.** A set planned as horizontal rows by default reads as one
figure repeated even when the types differ. Decide the orientation per figure
from the claim: descent, a sequence of gates, a lifecycle read top to bottom, a
funnel that narrows, a hierarchy or a lane column of one actor's steps run
vertically; a comparison of peers, a timeline across months or a crossing of two
attributes run horizontally. A vertical figure is placed in a column beside the
prose it proves and drawn on the column board the layout defines, so its type
stays on the ladder instead of being placed at full width and shrunk. Within a
chapter, no three consecutive figures share both type and orientation.

## Redrawing an existing figure

When a set is redrawn, keep only the information, the relationships and the
claims. Every previous coordinate, card size, grouping, orientation and
connector route is reference material, not a constraint. Reconstruct from a
blank canvas of the shared width; do not patch the legacy layout - a locally
repaired figure does not count as redrawn, and it is the one that still looks
different from its neighbours.

A figure is finished only when it independently passes width, height,
typography, overflow, connector and balance review.

## Size every box from its content

A box is as tall as the text inside it plus even padding, and a row is as tall
as its tallest box. Nothing else decides a height. A fixed height is how a row
of cards ends with a band of paper under every label, how the one card with
three lines spills past its edge, how a note sits high in its band - and each
of those is a defect the lint now reports (`ROW-PADDING-UNEVEN`,
`BOX-PADDING-UNEVEN`, `WRAP-SLACK`, `TIGHT-BOTTOM`).

The scaffold's `common.py` carries the layer that makes the rule automatic:

| Helper | What it sizes |
|---|---|
| `card(c, x, y, w, accent, title, lines, …)` | a titled card from its wrapped lines; `h=` forces a taller box and `valign="middle"` keeps the padding even; `band=True` for a header band, `icon=` / `tag=` for the title line, `wash=` for a tint under the outline |
| `cards_row(c, xs, y, w, items, accents)` | a row of cards at one height, the tallest content's |
| `pill(…)` / `pill_h(size, pad_y)` | a one-line box and the height it needs |
| `note(c, x, y, w, text, accent)` | a tinted band sized to its one or two lines |
| `zone(c, x, y, w, h, accent, label, tag)` | a boundary panel with its name in a chip on the top border; returns where content starts so the inset under the chip equals the sides |
| `step_row(c, xs, cw, y, items, accent, sep=)` | numbered step cards at one height joined by arrows or chevrons |
| `segment_bar(…)` | a proportional strip whose narrow segments are named together under one bracket |
| `heading(c, x, y, text)` → first box top | a section heading that keeps `HEAD_GAP` to its section and `SECTION_GAP` (`next_section`) from the block above |

The glyph model behind them matches the lint's: a line of text at `size`
occupies `0.78·size` above its baseline and `0.24·size` below;
`baseline_for_top`, `centered_baseline`, `glyph_bottom` and `lines_h` do the
arithmetic. `tw()` measures a run with a calibrated per-class table - Hangul
0.92 em, lowercase 0.52, capitals 0.66, digits 0.58 - so a wrap computed with
it lands where the browser breaks the line.

## Rows and stacks are uniform

One gap per row and per stack, one width per row, one height per row.
`row_positions()` gives the columns; the lint (`ROW-WIDTH-MISMATCH`,
`ROW-GAP-UNEVEN`, `STACK-GAP-UNEVEN`, `ROW-HEIGHT-MISMATCH`) reads any box at the
same y with the same fill and container as a peer. A box of another kind that
legitimately differs - a lead label beside a ladder of steps, a summary card
beside a row of terms - takes another fill (a tint), or a gap of 60px or more,
so it is read as its own group. A rect whose width or height *is* a quantity -
a bar, a strip segment - declares it with `measure=` and is never a peer.

A vertical figure in a column obeys the same rule the other way: its panels
are as tall as their lines and the gaps between them are one number. Height
there is what the column trades width for, never a page-fill target.

## Every arrow arrives somewhere

An arrowhead says a route arrives here, so it ends on the edge of the thing it
arrives at. An arrow that stops in open canvas - an exit drawn off the side of a
box, a descent drawn beside a stack and ending beside it, a sample arrow in a
legend - has no destination, and the reader looks for one that is not there.
Draw the destination (an outside system as a dashed box, the bottom layer the
descent reaches) and land the arrow on it; route a descent with `ortho()` from
the first box's edge to the last box's edge rather than as a free line beside
them. `FLOATING-ENDPOINT` reports the miss.

`Canvas.line()` and `Canvas.path()` draw a head by default. A rail, a bracket or
a containment line is not a route: pass `marker=None`, or the rail reads as a
flow that arrives at nothing.

## A label belongs to one thing

A reader cannot tell which box a label names when it sits nearly as close to
another. Put the label inside the box, or keep it twice as far from everything
else as from its owner (`LABEL-GROUPING`). A zone whose chip straddles its top
border rises `CHIP_RISE` above the border, so a zone under a heading starts
`heading() + CHIP_RISE`: the chip, not the border, keeps the heading gap.

## Text never crosses a line unmasked

A label a line runs through is unreadable at print size. Either move the label
into open space or draw it last on a paper plate - `text(..., mask=True)` -
after the line it has to pass behind (`TEXT-ON-LINE`). Document order is paint
order: a plate drawn before the line hides nothing. `heading(..., mask=True)`
does the same for a section heading that a leader drops past; compute the
section's top with `section_top()` first, draw the leaders, then the heading.

## Two halves of one cell are joined, not set near each other

**The commonest two-part shape in a document set is a label joined to its
content**: an icon tile and the sentence it marks, a row's name and the row, a
header and the card body, a 「추가 전」 badge and the chips it labels, a lane's
title and its lane. It is one cell that happens to have two fills, and the
reader has to see one cell.

Drawn as two rounded boxes side by side it is not one cell. The two outlines
meet at four arcs with a sliver of paper between them, and at print size the
pair reads as two things touching - which is the wrong claim, because the label
means nothing without the content beside it. One set of 132 figures carried 45
such pairs before this was named.

**Draw it as two halves whose facing corners are square.** `Canvas.band(x, y,
w, h, rx, color, side=)` rounds only the corners that follow the cell's own
outline: `side="left"` for the label at the start of a row, `"right"` for the
content after it, `"top"` for a header above a body, `"bottom"` for its mirror.
Pass the cell's own `rx` so the two outlines meet without a step. The lint
reports a rounded rect on a box edge as `BAND-CORNERS`.

**They butt at exactly one x, and never overlap.** Running one half under the
other fills the corners and looks right for a moment, but two translucent fills
stack where they cross and the overlap prints darker than the rest - a band
down the content's leading edge, which is a second artefact in place of the
first. Squaring both facing corners gets the join with nothing stacked.

**Give the halves separate fill and outline paths when either is tinted.**
`band` applies its opacity to the whole element, so a translucent fill takes
the outline with it and the cell loses its border. Draw the tint as one path
and the border as another.

**What reports a cell that was approached rather than joined**: `HAIRLINE-GAP`
for halves left 0 to 3 units apart - a gap narrower than the stroke on either
side of it prints as one heavy line with a sliver in it - and `NEAR-OVERLAP`
for halves that cross by less than `OVERLAP`'s gate. A join made with `band`
trips neither, because both read rects and a band is a path: the drawing
itself is what says the overlap was meant.

The same rule holds for the end segments of a proportional strip inside a
rounded outline.

## Icons carry meaning or they are noise

`Canvas.icon(name, x, y, size, color, sw)` draws one Lucide glyph, and every
Lucide icon is bundled - `Canvas.icons("shield")` searches the names without a
network. Icons repay themselves when they let a label go away or let a reader
sort card kinds without reading; they cost when every card gets one and the row
turns into decoration.

- **One icon per card at most**, and only where the card's kind is worth marking.
  A set where every card carries an icon says nothing, because nothing stands out.
### The AI pass - run it on every figure

**Before saving any figure, go through its elements and ask which of them a
model does.** This is a pass, like the height pass: it runs on every figure,
not only on the ones whose subject is obviously AI. A figure about data zones, a
figure about a roadmap, a figure about who decides what - each of them usually
contains model work somewhere, and a reader cannot tell which part unless the
figure says so.

**Then make that part prominent and mark it with an icon** - `brain-circuit`,
`cpu`, `sparkles`, `bot`. Which part of a picture a model drives is the first
thing a reader wants to know and the hardest thing to read out of a box label,
so the mark carries an accent with it: an icon beside the label for a card, a
tinted pill behind the label for a step. An icon alone in the body colour is
easy to miss; the point is that the reader sees it before reading.

**The AI is sometimes the transition, not the box.** In a lineage figure the
boxes are the data - original text, extracted statements, a candidate agenda -
and what the model does is the arrow between them: the decomposition, the
clustering. Marking the boxes there says the *data* is AI, which is wrong and
reads as careless. Ask what the element **is** before marking it: a thing a
model produced, or the act of producing it. Mark the act.
- **Decide it by what the component does, never by whether its label says "AI".**
  Go through the figure's items one at a time and ask *does a model do this work*.
  Classification, ranking, retrieval and re-ranking, extraction, clustering,
  generation, evaluation of any of those, and the registry and deployment of the
  models themselves are all yes - whatever the box is called. Storage, access
  control, forms, routing, scheduling and human decisions are no.
- **`if "AI" in label` is the trap, and it fails silently.** It marks only the
  boxes that happened to be named after the technology and leaves every other
  model-driven box unmarked, and the figure then looks finished: nothing
  overflows, nothing overlaps, the lint passes, and the reader is told that three
  of the six areas are not AI when four of them are. It fails in the safe-looking
  direction, so nobody catches it but the person who knows the content. Put the
  decision in the data - an explicit flag beside each item - so it is made once,
  by hand, and can be read back.
- **When every item is model work, or none is, the mark distinguishes nothing.**
  Mark the one element that names the AI subject so the reader still sees what
  the figure is about, or leave the figure unmarked and say why in the module.
  A set where the mark is on most items has stopped carrying information.
- **One size and one stroke across the set.** `size=20, sw=1.6` sits with 17-unit
  body text on a 1200-unit canvas; a header icon beside 18-unit type takes
  `size=22`. Changing either per figure reproduces the mismatch that the shared
  width and type ladder exist to prevent.
- **Take the icon's colour from what it marks** - the card's accent, or
  `t["fg_dim"]` for a neutral mark. An icon in its own colour reads as a third
  signal the figure never defined.
- **An icon is ink.** It is emitted as plain shapes rather than a `<g transform>`
  so `trim` and `ink_box` see it, which means an icon placed outside its card
  widens the figure and an icon crowding a label fails the overflow lint. Leave
  the icon's half-size plus 8 units between it and the text it precedes.

Icon names change between Lucide releases. `scripts/fetch_icons.py` regenerates
`scripts/lucide.py` from `lucide-static`; a name that disappears upstream raises
at draw time with the near-matches listed, so a stale name never renders blank.
