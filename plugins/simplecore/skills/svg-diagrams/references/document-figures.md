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

## Height is the scarce axis — minimise it, every figure, every time

Width is fixed, so height is the only thing that grows, and the page scales a
tall figure down: every extra unit of height shrinks the printed type of that
figure against its neighbours. **Minimising height is not a target to clear
once; it is a pass to make on every figure before saving it**, including a
figure that already fits. 720 units on a 1200-unit canvas is the number to stay
under and 840 is a failure — but a figure that lands at 700 and could have
landed at 520 is still wrong.

Make the pass in this order, and re-measure after each:

1. **Squeeze the repeating unit first.** A row, a card, a station repeats N
   times, so 20 units off it is 20N off the figure. Cut the row height to the
   text plus even padding, close the gap between rows, and tighten line spacing
   to the type size rather than to a round number.
2. **Delete rows that only hold a label.** An axis name, a legend, a closing
   sentence — put each one on a line that already exists (the header row, the
   end of the axis, beside the first card) instead of giving it a band of its
   own. Two label rows removed is often 60 units.
3. **Turn a tall stack on its side.** Five items stacked cost five row heights;
   the same five across the width cost one. Where the labels then overflow the
   narrower columns, that is the trade to weigh — not a reason to abandon the
   move.
4. **Cut the prose inside the picture.** Any sentence that repeats the
   surrounding paragraph is height the document already spent.

**What may never be traded for height**: legibility (the type scale is fixed),
a relationship the figure exists to show, and the padding that keeps text off
its own box — the lint's TIGHT-BOTTOM and TEXT-OVERFLOW mark the floor, and a
figure that trips them was compressed past the point of being readable.

When a figure holds two independently understandable structures, split it in
two. When splitting would break an ER model, a lineage, a state machine or
another inseparable relationship, keep one figure and let it be tall —
**never drop a relationship to hit a number.**

## The caption belongs to the document

Put the figure's name and its one-line explanation in the document's caption,
not inside the SVG. A title block inside the picture duplicates the caption and
adds vertical space to every figure in the set. Suppress it centrally — the
scaffold's `canvas()` disables `title()` so no figure module has to remember.

The prose must stand without the picture. A reader whose images failed to load
still has to follow the argument; the figure supplements it.

## The composition comes from the claim, not from the list

**Before laying anything out, write down the one sentence the surrounding prose
is making.** Not the topic — the claim. 「여섯 성과가 있다」 is a topic; 「1~4를
개발·검증해서 5·6을 남긴다」 is a claim, and only the second one can be drawn.

A figure built from the topic reproduces the list that is already on the page:
six items become six equal cards, and the reader learns nothing the paragraph
above did not already say. A figure built from the claim shows the **relation**
between the items — which ones are inputs, which are results, what has to
happen first, what converges, what is excluded — and that relation is the part
prose is worst at carrying.

Work in this order, every time:

1. **State the claim in one sentence.** If you cannot, read the section again;
   a figure drawn before the claim is known will be a row of boxes.
2. **Name what the reader must see that a list cannot say** — order, dependency,
   convergence, containment, exclusion, scale, a loop.
3. **Choose the form that carries exactly that**, then build it out of the
   primitives already here — `band` tabs, numbered badges, `group_frame`
   panels, a junction `dot`, `ortho` fan-in, a matrix, an axis. **Invent the
   composition, not the visual language**; a new kind of connector or a new
   label style makes the figure look unlike its neighbours for no gain.
4. **Tie the figure back to the prose.** If the paragraph numbers its items,
   the cards carry the same numbers; if it names the stages, the tabs use the
   same words. A reader moving between the two must never have to translate.

**Check the figure against the text before calling it done** — the caption, the
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

## Icons carry meaning or they are noise

`Canvas.icon(name, x, y, size, color, sw)` draws one Lucide glyph, and every
Lucide icon is bundled — `Canvas.icons("shield")` searches the names without a
network. Icons repay themselves when they let a label go away or let a reader
sort card kinds without reading; they cost when every card gets one and the row
turns into decoration.

- **One icon per card at most**, and only where the card's kind is worth marking.
  A set where every card carries an icon says nothing, because nothing stands out.
- **A diagram whose subject includes an AI component marks that component with an
  icon** — `brain-circuit`, `cpu`, `sparkles`, `bot`. Which part of a pipeline a
  model drives is the first thing a reader wants to know and the hardest thing to
  read out of a box label.
- **Decide it by what the component does, never by whether its label says "AI".**
  Go through the figure's items one at a time and ask *does a model do this work*.
  Classification, ranking, retrieval and re-ranking, extraction, clustering,
  generation, evaluation of any of those, and the registry and deployment of the
  models themselves are all yes — whatever the box is called. Storage, access
  control, forms, routing, scheduling and human decisions are no.
- **`if "AI" in label` is the trap, and it fails silently.** It marks only the
  boxes that happened to be named after the technology and leaves every other
  model-driven box unmarked, and the figure then looks finished: nothing
  overflows, nothing overlaps, the lint passes, and the reader is told that three
  of the six areas are not AI when four of them are. It fails in the safe-looking
  direction, so nobody catches it but the person who knows the content. Put the
  decision in the data — an explicit flag beside each item — so it is made once,
  by hand, and can be read back.
- **When every item is model work, or none is, the mark distinguishes nothing.**
  Mark the one element that names the AI subject so the reader still sees what
  the figure is about, or leave the figure unmarked and say why in the module.
  A set where the mark is on most items has stopped carrying information.
- **One size and one stroke across the set.** `size=20, sw=1.6` sits with 17-unit
  body text on a 1200-unit canvas; a header icon beside 18-unit type takes
  `size=22`. Changing either per figure reproduces the mismatch that the shared
  width and type ladder exist to prevent.
- **Take the icon's colour from what it marks** — the card's accent, or
  `t["fg_dim"]` for a neutral mark. An icon in its own colour reads as a third
  signal the figure never defined.
- **An icon is ink.** It is emitted as plain shapes rather than a `<g transform>`
  so `trim` and `ink_box` see it, which means an icon placed outside its card
  widens the figure and an icon crowding a label fails the overflow lint. Leave
  the icon's half-size plus 8 units between it and the text it precedes.

Icon names change between Lucide releases. `scripts/fetch_icons.py` regenerates
`scripts/lucide.py` from `lucide-static`; a name that disappears upstream raises
at draw time with the near-matches listed, so a stale name never renders blank.
