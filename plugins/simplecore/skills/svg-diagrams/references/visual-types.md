# Visual types

Pick the type from what the reader has to take away, not from what the data
looks like. The table is ordered by that question. Vocabulary and budgets
derive from the diagram-design skill (MIT) — see `NOTICE`.

**Three rules hold for every type.** A budget is a readability ceiling, not a
suggestion: past it the drawing still renders and stops being read, so a
builder raises rather than draw a figure nobody can use. A figure earns its
place only against the alternative — if a three-column table says the same
thing, use the table. And `focal` is one or two elements: accenting four says
nothing, and if which one is focal cannot be decided, the figure has no point
yet.

## Choosing

| The reader has to take away | Type | How to draw it |
|---|---|---|
| What the parts are and what talks to what | Architecture | `box` + `arrow`/`route` + `frame` |
| What the landscape looks like *before* a modernisation | **IT current-state** | `itstate()` |
| Which branch a decision takes | Flowchart | `box` + `arrow` |
| Who sent what to whom, in order | **Sequence** | `sequence()` |
| Which states exist and what moves between them | **State machine** | `state()` |
| Which entities exist and how they relate | **ER / data model** | `entity()` + `relate()` |
| Physical tables, their columns and their keys | **Database schema** | `entity()` + `relate()` |
| Classes with attributes and operations | **UML class** | `entity()` (two compartments) |
| When things happened | Timeline | `line` + `dot` + `text` |
| Who does what, in what order, across teams | **Swimlane** | `swimlane()` |
| Where things sit on two axes | **Quadrant** | `quadrant()` |
| How several entities score on the same criteria | **Radar** | `radar()` |
| One series around a cycle of categories | **Polar** | `polar()` |
| A cycle whose last step feeds the first | **Loop / flywheel** | `loop()` |
| That one thing is inside another | Nested | `frame` inside `frame` |
| Parent → children | Tree · Org chart | `box` + `arrow`, or `graph.js` |
| Stacked levels of abstraction | Layer stack | stacked `box` / `frame` |
| What two or three sets share | **Venn** | `venn()` |
| A ranked few over a broad many, or a drop-off | **Pyramid / funnel** | `pyramid(funnel=)` |
| How much, across categories | **Bar** | `bar()` |
| Part of a whole, where the sizes are the story | **Treemap** | `treemap()` |
| A trend, or a change between two states | **Line · slopegraph** | `linechart()` |
| What runs when, over months | Gantt | `gantt()` |
| How two measures relate, or three with area | **Scatter · bubble** | `scatter()` |
| The whole data stack on one cluster | High-level | `frame` + `box` |
| A multi-actor process with data handoffs | Process | `flow()` |
| Storage tiers and their quality levels | Medallion | `frame` per tier |
| Who does what at each pipeline step | Data flow | `box` + `arrow` |
| Sources → core → consumers | DP integration | `frame` + `box` + `arrow` |
| Who may reach what | DP security matrix | `matrix()` |
| A quantity splitting and merging | **Sankey** | `sankey()` |
| What causes one observed effect | **Fishbone** | `fishbone()` |
| What to build, what to buy, what is moving | **Wardley map** | `wardley()` |
| Work in progress by state | Kanban | columns of `box` |
| What a person does across an experience | **User journey** | `journey()` |
| Where software runs | Deployment | `frame` + `box` |
| What depends on what, with cycles | Dependency graph | `graph.js` (dagre) |
| A narrative sliced into releases | Story map | rows of `flow` |

Bold names have a dedicated builder. The rest are assembled from primitives
that already carry the grammar — `frame` for a boundary, `flow` for an ordered
row, `matrix` for a grid, `gantt` for a schedule — so nothing on the list has
to be improvised from rectangles.

## The builders

Every one is a `Canvas` method, so `c.swimlane(...)` works on any board. Each
takes the figure's top-left, looks colour up by theme role, returns the
bounding box so a caption or legend can sit under it, and raises `ValueError`
past its budget with the reason in the message.

| Call | Budget | The rule the budget protects |
|---|---|---|
| `swimlane(x, y, w, lanes, phases, cards)` | 5 lanes | The handoff is the content. Past five rows a reader stops tracking who is who. |
| `quadrant(x, y, size, x_axis, y_axis, names, items, focal)` | 12 items | Position is the content, and crowded labels destroy position. |
| `pyramid(x, y, w, h, layers, funnel=False)` | 6 layers | The narrow end has to hold its own label. |
| `venn(x, y, r, sets, overlaps)` | 2–3 sets | A fourth circle cannot meet the other three at once. |
| `loop(cx, cy, r, steps, hub)` | 3–6 steps | Fewer is a line; more reads as a pie. |
| `bar(x, y, w, h, items, unit, horizontal, focal)` | 8 bars | Past eight rows a table reads faster. |
| `radar(cx, cy, r, axes, series)` | 3–5 axes · 5 series | Fewer axes have no area; more turn every shape into a circle. |
| `sequence(x, y, actors, messages)` | 5 lifelines | Past five the messages cross too often to follow. |
| `entity(x, y, w, name, sections, sub, accent)` | — | Returns `(box, row_y)`; `row_y` lets a foreign key leave the row it lives on. |
| `relate(a, b, kind, label, ay, by)` | — | `kind` is `1-n`, `0-n`, `1-1`. Cardinality is a glyph at each end, not an arrowhead: a relationship has no direction. |
| `linechart(x, y, w, h, series, x_labels, unit, focal)` | 5 series | The axis starts at zero: a truncated axis turns 3% into a cliff. |
| `scatter(x, y, w, h, points, x_axis, y_axis, focal)` | 30 points | A weight is drawn as **area**; scaling the radius triples the apparent difference. |
| `polar(cx, cy, r, categories, values, focal)` | 8 categories | Lollipops, not wedges — a wedge's area grows with the square of its value. |
| `state(x, y, states, transitions, …)` | 8 states | Every transition carries its guard; one without says the machine moves for no stated reason. |
| `treemap(x, y, w, h, items, focal, unit)` | 8 cells · ≥2% each | Squarified. A share under 2% has no area to be shown in — group the tail or use `bar`. |
| `sankey(x, y, w, h, stages, flows, unit)` | 4 stages · 10 nodes · 14 flows | Band width is the quantity, so node height is computed and never chosen. |
| `fishbone(x, y, w, h, effect, bones)` | 6 categories · 3 causes | The effect is something observed. A category as the effect makes every cause fit. |
| `wardley(x, y, w, h, components, links, moves)` | 9 components | Position is a build-versus-buy claim, so the four evolution bands are labelled and checkable. |
| `journey(x, y, w, h, stages, rows, pains)` | 6 stages · 4 rows | The last row may be numbers from −1 to 1 and draws as the feeling line. |
| `itstate(x, y, w, groups)` | — | Status (`keep` · `replace` · `retire`) is the content; a landscape without it says only that the systems exist. |

## What the lint knows about these

`audit.py lint` reads the finished SVG, so it judges a built type the same way
it judges a hand-drawn one. Six checks carry exceptions these types need.

- **`FLOATING-ENDPOINT`** accepts an endpoint on a box edge *or* on a drawn
  line — a sequence message lands on a lifeline.
- **`LINE-THROUGH-BOX`** exempts a line whose two ends sit on the same box's
  outline — a quadrant's axes divide their panel.
- **`SWEEPING-CURVE`** exempts a connector whose ends are within 90px of each
  other — a self-transition can only be a curve.
- **`TIGHT-BOTTOM`** ignores a rect inset evenly on all four sides — that is a
  double edge, not content.
- **Plot areas are containers.** A rect covering over a third of the canvas
  that holds no other rect but carries four or more labels is a chart field,
  so arrows inside it are normal.
- **`DEAD-MARGIN` / `TIGHT-MARGIN`** measure all four sides, and `save()` fits
  the board with `trim()`, so no generator keeps a board number in step with
  its layout by hand.

## Adding a builder

Put it in `scripts/viztypes.py` and add it to `BUILDERS`; svgkit binds the
dict onto `Canvas` at import. Five things make it fit:

1. **Take the figure's top-left**, so the type places like any other block.
2. **Look colour up by theme role** (`c.t["blue"]`), never a literal.
3. **Raise past the budget**, with the reason — a caller who is over it needs
   to know which rule they are about to break, not that a number was exceeded.
4. **Name it so it does not shadow a primitive.** `Canvas` already has `line`,
   `text`, `path`, `dot`, `card`, `node`, `matrix`, `frame`, `box` and `flow`;
   that is why the line chart is `linechart`.
5. **Emit only absolute path commands.** `trim()` and `ink_box()` parse a path
   by command arity, and both know M, L, H, V, Q, S, C, A and Z. A relative
   command is skipped rather than guessed, so a path built from them will not
   move with the rest of the drawing.
