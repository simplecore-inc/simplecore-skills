# Figures that live in a document

Almost every diagram this skill draws ends up inside something — a proposal, a
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

Then pick a drawing width that is a comfortable multiple of that — a set drawn
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
that means an ink span of at least 1120 — about 93%. Lay content out from `x=24`
to `x=1176` and the finished figure lands inside it; drawing from `x=48` on a
1104-wide body does not, however balanced it looks in isolation.

`save()` centres what you drew, so the finished gap is
`max((width − ink span) / 2, margin)` — the `margin` argument only widens a
figure that was already narrow enough. Widening the drawing is the fix, not
raising the margin.

A genuinely symmetric concept — a Venn, a radial — may need more air. Say so in
the figure module rather than inflating the drawing to hit the number.

**Width utilisation is not enlargement.** Keep the principal drawing at the
smallest size that stays legible and spend the remaining width on things that
would otherwise add height: side-by-side stages, branches, a legend, conditions,
an explanation panel.

## One type scale for the whole set

Pick a ladder and use only its rungs. A workable one for a 1200-unit canvas:

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

Snap the emitted sizes at save time rather than trusting every call site — the
scaffold's `save()` does this, so layout code may keep its working numbers while
the artifact carries only scale values.

## Height is the scarce axis

Width is fixed, so height is the only thing that grows, and a tall figure gets
scaled down by the page. Prefer horizontal composition, compact grids and side
annotations over tall stacks. Target 720 units or less on a 1200-unit canvas and
review anything over 840.

These are recommendations. When a figure holds two independently
understandable structures, split it into two. When splitting would break an ER
model, a lineage, a state machine or another inseparable relationship, keep one
figure and let it be tall — **never drop a relationship to hit a number.**

Remove diagram-internal prose that only repeats the surrounding paragraph. The
document says it once already.

## The caption belongs to the document

Put the figure's name and its one-line explanation in the document's caption,
not inside the SVG. A title block inside the picture duplicates the caption and
adds vertical space to every figure in the set. Suppress it centrally — the
scaffold's `canvas()` disables `title()` so no figure module has to remember.

The prose must stand without the picture. A reader whose images failed to load
still has to follow the argument; the figure supplements it.

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

## Redrawing an existing figure

When a set is redrawn, keep only the information, the relationships and the
claims. Every previous coordinate, card size, grouping, orientation and
connector route is reference material, not a constraint. Reconstruct from a
blank canvas of the shared width; do not patch the legacy layout — a locally
repaired figure does not count as redrawn, and it is the one that still looks
different from its neighbours.

A figure is finished only when it independently passes width, height,
typography, overflow, connector and balance review.

## Card headers meet the card

A tinted header drawn as a rounded rectangle rounds its bottom corners too, and
the card's straight body butts against them — the header reads as a chip resting
on the card rather than as its top. Use `Canvas.band(x, y, w, h, rx, color)`,
which rounds only the corners that follow the card's own outline
(`side="left"` for a label band at the start of a row). Pass the card's own
`rx` so the two outlines meet without a step.
