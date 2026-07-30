---
name: svg-diagrams
description: Create diagrams as SVG (also ASCII) — flowcharts, sequence/state/class/ER, system and architecture diagrams, pipelines, network and infrastructure layouts. Use when asked to draw, render, or diagram a system, flow, or structure. Covers hand-crafted SVG and JSON-spec auto-layout for precise architecture pictures, Mermaid auto-layout for structured diagrams from text, and SVG checks that catch missing or oblique arrowheads, text overflow, and clipped content before delivery. Triggers on "draw diagram", "create flowchart", "show architecture", "system diagram", "visualize flow", "SVG diagram", "ASCII diagram", "mermaid", "다이어그램", "아키텍처 그림", "도식화", "구성도", "그림 그려".
---

# SVG Diagrams

Produce a diagram as SVG (or ASCII). Pick the technique by what you are drawing, then verify any SVG before delivering. (For screen layouts — wireframes, mockups, a screen inventory — defer to the `simplecore:wireframe-boards` skill; this skill is architecture/flow/system pictures.)

**Paths.** All files live under this skill's base directory — the `Base directory for this skill: …` path shown when the skill loads. Below, `<skill>` stands for that directory; substitute the real path at use time. Never hardcode an absolute or `~/…` path (it differs per user and platform).

## Pick the technique

| What you're drawing | Technique | Open |
|---|---|---|
| Architecture, protocol stack, pipeline, network/infra — precise & spatial | **Hand-crafted SVG** (default) | `scripts/svgkit.py` (import) or `references/svg-templates.md` (XML) |
| Layered box diagram (explicit stacked bands), want auto-placement | **JSON-spec layered layout** | `scripts/layout.js` |
| Branching graph / arbitrary topology, want auto-placement — themed, CJK-safe, zero install | **JSON-spec graph layout (dagre)** | `scripts/graph.js` |
| Flowchart / sequence / state / class / ER from text | **Mermaid auto-layout** | `scripts/convert.js` |
| Terminal / markdown / quick text output | **ASCII** (Mermaid-fed only) | `scripts/convert.js` |

Default for spatially demanding pictures is hand-crafted SVG. **Mermaid is one technique, not a prerequisite** — most architecture diagrams never touch it.

Execution model: `scripts/audit.py`, `scripts/convert.js`, `scripts/layout.js`, `scripts/graph.js` are CLIs you **run**; `scripts/svgkit.py` is a library you **import**.

## Hand-crafted SVG (default for precise/architecture)

`scripts/svgkit.py` is a stdlib Python library — import it, build, save, then audit. It bakes in defect resistance: glyph-width box sizing (no text overflow), orthogonal connectors whose final segment is perpendicular to the target edge, and safe arrowhead markers.

```python
import sys
sys.path.insert(0, "<skill>/scripts")          # <skill> = base dir shown at load
from svgkit import Canvas

c = Canvas(900, 320, theme="tokyo-night")       # nord · catppuccin · gruvbox · one-dark
c.card(48, 90, 200, 96, c.blue, badge="01", title="Ingest",
       lines=["Connector", (c.t["muted"], "byte[] · ts")])
c.card(320, 90, 200, 96, c.cyan, badge="02", title="Dispatch", lines=["Parser"])
c.ortho(248, 138, 320, 138, exit="R", entry="L", color=c.blue, marker="blue")
c.save("pipeline.svg")
# verify:  python3 <skill>/scripts/audit.py lint pipeline.svg
```

**Theme** with `Canvas(w, h, theme=…)`: `tokyo-night` (default), `nord`, `catppuccin`, `gruvbox`, `one-dark`. Reference accents as `c.blue c.cyan c.teal c.green c.purple c.red c.orange c.yellow` and chrome as `c.t["muted"|"line"|"bg"|…]` — passing these (not literal hex) lets a diagram re-theme by changing one arg. Chrome (bg/box/line/muted/fg) resolves from the theme automatically. (Module constants `BLUE`, `MUTED`, … remain for Tokyo-Night-only code.)

Helpers: `rrect · text · line · path · ortho · elbow · bez · dot · chip · card · spec_card · node · edge_label · group_frame · title · legend · matrix · row_positions · tw · edge_pt`.

Composite patterns (reusable across diagrams):
- `title(text, sub)` — diagram heading (bold title + muted subtitle).
- `row_positions(left, right, n, gap)` → `(xs, w)` — evenly-spaced columns for a row of cards joined by arrows.
- `node(x,y,w,h, accent, label, sub=)` — flow/state node: centered mono label + muted subtitle, returns `(x,y,w,h)`. Use for state machines and flow steps; `card` reads as a component/spec box instead.
- `edge_pt(box, side, f=0.5)` — module-level: point on a node's edge (`'L' 'R' 'T' 'B'`, `f` slides along it) to feed `ortho()` so arrows enter perpendicular.
- `edge_label(x,y, text, color=)` — connector label centered on the edge with a CJK-aware background pill. The pill hides crossing *lines* only — park it in open space, not on a box.
- `spec_card(x,y,w,h, accent, title, attrs, footer=)` — attribute/spec card: title + divider + `● key (emphasized) + detail (muted)` rows; `attrs` is `[(key, detail), …]`, `footer` an accent chip. Prefer over `card(lines=…)` for spec lists.
- `group_frame(x,y,w,h, label, accent, sub=)` — dashed boundary panel with a legend chip (e.g. Edge/Center zones). Draws on the **underlay layer**, so it stays behind nodes regardless of call order (`underlay=False` to force on top).
- `legend(x,y, [(color, dash, label), …])` — line-style key (dash=None for solid).
- `matrix(x,y, rows, cols, marks, …)` — dependency/coverage/RACI grid: `rows` are `name` or `(id, name)`, `cols` are `(label, color)` header chips, `marks` are `(r, c[, color])` filled cells. An empty column reads as "no dependency". Returns `(w, h)` to size the canvas. See domain-templates.md §9.

Sub-route: programmatic / most diagrams → import `svgkit.py`; quick copy-paste one-off → `references/svg-templates.md` XML. **Pick ONE convention per file** — do not mix svgkit markers (`arr-<name>`) and template markers (`ah`) in the same SVG; lint checks markers per file and will not catch a mixed file.

Canvas sizes and domain wireframes: `references/domain-templates.md`.

## JSON-spec layered layout (Mermaid NOT required)

Auto-places layered architecture / sublayers / edges from a hand-written JSON spec — use when the diagram is a stack of explicit bands and you want less hand-coding than svgkit.

```bash
node <skill>/scripts/layout.js spec.json -o out.svg     # then audit out.svg
```

Spec shape: `{ theme, canvas:{width,padding}, layers:[{label,color,nodes:[{id,title,subtitle}],sublayers:[…],direction}], edges:[{from,to,label}] }`. `theme` here accepts `tokyo-night · dracula · nord` only (unknown themes error out); the canvas auto-widens when a node label cannot fit at the requested width. This engine stacks the layers you declare; it does **not** re-rank by edges — for a branching graph, use the dagre engine below.

## JSON-spec graph layout (dagre backend, zero install)

Ranks an arbitrary directed graph by its edges (branches, joins, back-references) instead of stacking declared layers — use when topology, not banding, drives the picture. Positions come from a vendored dagre bundle (`scripts/vendor/`, MIT, no npm install); node sizes are measured CJK-aware and the result renders through the same themes and passes the same audit as the other engines.

```bash
node <skill>/scripts/graph.js spec.json -o out.svg      # then audit out.svg
```

Spec shape: `{ theme, direction, canvas:{padding}, nodesep, ranksep, nodes:[{id,title,subtitle?,color?,fill?,group?}], groups:[{id,label,color?}], edges:[{from,to,label?}] }`. `theme` is `tokyo-night · dracula · nord`; `direction` is `TB · BT · LR · RL` (`TD` == `TB`, unknown values error out). `groups` are single-level clusters (a node joins one via `group`); the cluster label renders as a left tab so edges dropping into member nodes never strike through it. The final segment of every edge is snapped perpendicular to the target so arrowheads land square on the border.

Compared with `layout.js`: same spec vocabulary (theme/nodes/edges/groups) but edge-driven ranking and obstacle-aware routing, so branching diagrams avoid the arrow-through-node and single-column-flattening that the layered engine hits on non-layered graphs.

## Mermaid auto-layout (structured diagrams from text)

```bash
node <skill>/scripts/convert.js diagram.mmd --svg --theme tokyo-night  # faithful layout (beautiful-mermaid)
node <skill>/scripts/convert.js diagram.mmd --dagre --theme tokyo-night # topology layout, zero install (dagre)
node <skill>/scripts/convert.js diagram.mmd --to-graph > graph.json    # export an editable dagre graph spec
node <skill>/scripts/convert.js diagram.mmd --to-json > spec.json      # export an editable layered spec
node <skill>/scripts/convert.js diagram.mmd --layout                   # render that spec via layout.js
```

For a branching graph, prefer **`--dagre`** (edge-ranked topology through our themes/CJK sizing/audit, no npm install) or **`--svg`** (beautiful-mermaid; needs the global install and sizes its own boxes, so lint for CJK clipping). `--to-json`/`--layout` route through `layout.js`, which stacks nodes into layered boxes: great for explicitly layered structure, but it flattens arbitrary graphs into a single column and can place edge labels on borders, so always render-and-check `--layout` output. `--to-graph` emits the flat node+edge+cluster spec that `graph.js` consumes.

Types: flowchart (`graph TD|LR|BT|RL`), `sequenceDiagram`, `stateDiagram-v2`, `classDiagram`, `erDiagram` — for `--svg`/ASCII. **`--to-json`/`--layout` parse flowchart/graph syntax only** (other types error out; render them with `--svg`).
Syntax: shapes `[rect] (rounded) {diamond} [[sub]] [(db)] ((circle))`; edges `-->` `---` `-.->` `==>` `-->|label|`.
Prerequisite for `--svg`/ASCII only: `npm install -g beautiful-mermaid` (`--to-json`/`--layout` run without it).

## ASCII / text output

```bash
node <skill>/scripts/convert.js diagram.mmd            # Unicode box-drawing
node <skill>/scripts/convert.js diagram.mmd --ascii    # pure ASCII (+-|)
```

ASCII is reachable **only via the Mermaid path** — there is no ASCII route for hand-crafted SVG or JSON specs. If you need ASCII, express the diagram in Mermaid.

## Verify before delivering (REQUIRED for any SVG)

Valid SVG XML is not a correct picture. Missing/oblique arrowheads, text overflow, head-only arrows, occluded labels, and content jammed against an edge are invisible in the source — render and inspect first. Applies to SVG from **any** technique above.

**The lint runs itself on every SVG written or edited in a session** — a write-time hook ships with this plugin and reports the same findings as the command below, so a defect surfaces at the moment it is introduced rather than at delivery. That covers the static half only: `render` and `hotspots` are still yours to run, because a static scan cannot see an arrowhead landing on a chip or a label kissing a box. A project turns the hook off with `{"svgLint": false}` in `.claude/simplecore.json` — and a diagram whose lint was silenced still needs the pass below.

```bash
python3 <skill>/scripts/audit.py lint     one.svg [more.svg …]   # static defect scan (multi-file; exit 1 on any issue)
python3 <skill>/scripts/audit.py render   diagram.svg out.png 2  # full raster — Read it
python3 <skill>/scripts/audit.py hotspots diagram.svg crops/ 4   # zoom-crop EVERY arrow endpoint — Read them
python3 <skill>/scripts/audit.py crop     diagram.svg X Y W H z.png 5   # zoom one spot
```

Loop: **lint → render → hotspots → fix → repeat** until lint is clean *and* the endpoint crops look right. A full render viewed downscaled hides sub-10px defects (an arrowhead landing on a chip, a label kissing a box) — `hotspots` turns "eyeball the overview" into a systematic pass over exactly the places those defects live. Lint is a screen, not the verdict. Checks: `UNRESOLVED-MARKER`, `OBLIQUE-ARROW`, `SHORT-ARROW`, `TEXT-OVERFLOW`, `TEXT-COLLISION`, `TIGHT-BOTTOM`, `OVERLAP`, `LABEL-OCCLUSION`, `ARROW-THROUGH-BOX`, `ARROWHEAD-IN-BOX`, `LINE-THROUGH-BOX`, `FRAME-OVER-NODE`, `OFFCANVAS-TEXT`, `OFFCANVAS-RECT`, `MARKER-NO-ORIENT`, `WIDE-CANVAS`. Full catalog, fixes, prevention rules: `references/render-audit.md`.

**CJK / non-Latin text:** width estimation is CJK-aware across the toolchain (`svgkit.tw`, `layout.js`, and the lint all count Hangul/Kana/CJK glyphs at ~1 em, Latin at ~0.55 em). A box or chip auto-sized for Latin will overflow Korean/Japanese if you hardcode a width — size boxes from `tw()`, not by eye. The Mermaid `--svg` path (beautiful-mermaid) sizes its own boxes and can clip CJK labels; lint its output and prefer svgkit/layout.js when labels are CJK-heavy.

**Read it as somebody who has never seen the system (the pass no lint replaces).** A clean lint means the picture is well-formed, not that it explains anything. Once the crops look right, look at the full render once more as a first-time reader and answer four questions: what is this a picture *of* (is there a title saying so); where does the eye start, and is that where the flow starts; is every label a word the reader knows rather than an internal identifier or an abbreviation only the author expands; and does every line style, colour, and shape difference mean something a legend states. A diagram that fails one of these is redrawn, not re-linted — and an unexplained visual distinction is the most common failure, because the author knows what it meant.

**Placement checks that XML review cannot catch:** `LABEL-OCCLUSION` — a free/edge label (or its pill) sitting on a box it does not belong to; `TEXT-COLLISION` — two labels overlapping each other; `ARROW-THROUGH-BOX` — a connector routed across a box that is neither its source nor target; `ARROWHEAD-IN-BOX` — a connector endpoint buried inside a box instead of landing on its edge (the classic case: an arrow into a frame top landing on the frame's title chip — enter frames away from the chip); `LINE-THROUGH-BOX` — a plain separator/boundary line striking through a box (split the line around it); `FRAME-OVER-NODE` — a frame/panel emitted after the nodes it encloses, hiding them (document order is z-order; svgkit's `group_frame` avoids this by drawing on the underlay layer). Place edge labels in open space above/below the arrow rather than in a narrow gap, and route connectors around intervening boxes.

## References (read on demand)

| File | Contents | When to Read |
|------|----------|--------------|
| `references/render-audit.md` | Render/crop/lint workflow, defect catalog with fixes, generation-time prevention rules | Before delivering ANY SVG; debugging arrowheads, overflow, spacing |
| `references/svg-templates.md` | SVG header, node/edge/subgroup XML templates, palette, layout rules | Hand-crafting SVG by XML, or fixing layout |
| `references/domain-templates.md` | 8 domain layouts (architecture, pipeline, microservice, CI/CD, network, state machine, infra, sequence) with canvas sizes and color assignments | Choosing a layout pattern / canvas size |
