---
name: iso-scenes
description: Use when an explanatory document needs an isometric scene of physical equipment and the path a signal or a cable takes through it - a substation yard, a control room, a rack row, a plant bay - drawn as static SVG with labels and step numbers inside the figure, several ground areas (islands) of different sizes on one board, realistic devices built from solids, and cables whose routing is checked by machine. Use it for training material, manuals and design documents where a flat box-and-arrow diagram cannot show where things are. Not for a single ornamental object, an interactive page or a 3D render. Triggers - isometric scene, equipment layout figure, training figure, 등각 장면, 설비 배치도, 교육용 도식, 아일랜드 배치, 입체 도식, 변전소 그림.
---

# Isometric scenes for explanatory documents

Draws a scene of real equipment on the document-figure canvas of `simplecore:svg-diagrams`, so a
scene shares the document's board width, type ladder, palette and `verify.py` with every flat
figure beside it. Load `simplecore:svg-diagrams` first and follow its document-figure discipline;
this skill adds the scene.

**Paths.** `<skill>` is this skill's directory, ${CLAUDE_SKILL_DIR}. The library is
`<skill>/scripts/isoscene/`. Never hardcode an absolute or home-directory path.

**Outside Claude Code** (Codex and other hosts that read this file from their own skill
directory): the variable above is not substituted and prints literally, so `<skill>` is the
directory holding this `SKILL.md`, with symbolic links resolved. The companion skill is listed
there without the plugin prefix, as `svg-diagrams`; load that one and find its `scripts/` as the
sibling directory of this skill's resolved directory.

## What a scene has to explain

A scene shows **where** things are and **which way** something travels. It does not show what the
signal becomes; pair it with a flat storey under it (one panel per numbered step) or with the
prose. Number the scene's labels with the same step numbers the text uses, and say in the text
that the numbers match.

## Wiring a project

A figure module reaches the library from the toolkit the build already found:

```python
import sys
from pathlib import Path
from common import toolkit_dir
sys.path.insert(0, str(Path(toolkit_dir()).resolve().parents[1] / "iso-scenes" / "scripts"))
from isoscene import Scene, plant, power
```

Keep those lines in one project helper and list it under `helpers` in
`.claude/document-figures.json`. A scene draws two paper-coloured strokes, the casing around a
conductor (7.8) and the halo around a label (5); a project that declares a stroke ladder adds
both to `strokes`.

## The world

x and y lie on the ground, z points up, one unit is about one drawn unit. The viewer looks from
+x, +y: of every solid the **+x face, the +y face and the top** are visible, and the -x and -y
faces never are. Everything below follows from that.

```python
c = canvas(1200, 760)
sc = Scene(c, ox, oy)            # page position of the world origin
pal = power.palette(c)
sc.island(0, 0, 400, 280, c.t["fg_dim"])           # a ground area
ct = power.current_transformer(sc, 70, 0, pal)      # a device: returns its ports
mu = power.kiosk(sc, 300, 160, c.teal, pal)
sc.cable([ct["port"], (70, 215), (300, 215), mu["side"](0.5)], c.yellow, arrow=True)
sc.label(mu, "머징유닛(MU)", n=3, accent=c.teal)
sc.paint()
```

## Rules the engine enforces

`paint()` raises on each of these, with the offending cable or label named. Fix the layout; do
not loosen the rule.

| Rule | Why |
|---|---|
| A cable runs only along the two floor directions | An oblique run reads as a line in the air |
| A cable end declared `"face"` meets the foot of a visible face, square to it, away from the corners (a fifth of the face, at most 16 units) | A cable that leaves along a face's edge reads as that edge continued, and one that ends on a hidden face is never seen arriving |
| No two cables cross or overlap; a cable that meets another ends `"join"` and gets a dot | A crossing reads as a connection |
| No two footprints overlap on the ground | A kiosk drawn through a wall reads as a mistake (a user sent one back), and the paint order of two interpenetrating things is decided by centre depth, not by what is in front |
| No cable runs under a device's footprint | The cable vanishes and reappears with no visible path |
| A label touches no solid, conductor, cable, other label or board edge | The engine tries positions around its target in the order of `prefer` and takes the first free one |

A device's footprint is what stands on the ground: a roof, a tank or a head that overhangs it
does not block a cable.

## Rules the engine cannot see

- **Give each cable its own lane.** Parallel cables in front of a row of cabinets run on
  separate lanes a constant distance apart, and each drops into its cabinet. Assign the lanes so
  no drop crosses a lane that is occupied at that point: write the occupied interval of each
  lane down before choosing.
- **A conductor in the air stops at a terminal.** A line that passes through a device's head
  leaves the reader unable to tell whether it touches. End it on the device's terminal and start
  a new one on the far side, as `current_transformer` returns `line_in` and `line_out`.
- **A nearer conductor must not lie along a farther edge.** With phases spaced `s` apart and
  conductors at height `h`, a nearer conductor coincides on the page with any farther edge along
  the same direction at height `z` and depth offset `dy` when `z - dy = h - s`. The casing hides
  the edge and the lint reports `COINCIDENT-LINES`; move the edge's height or the phase spacing.
- **The same test for any two edges.** Two edges along x print on one line when their `y - z`
  is equal, two along y when their `x - z` is equal, whatever their distance apart; under about
  3 units of difference the lint reports them. A slab 3 units high already prints its own top and
  bottom edge 2.6 px apart, so a base is 4 units or more.
- **A dense yard is drawn as one phase.** Five devices in a row on three phases put fifteen
  devices and their terminals where every edge finds a partner on another phase, and no label
  finds a place beside its device. When the phases are not the subject, draw one phase, say so in
  the label of the line, and show the three-phase arrangement in a scene of its own.
- **A label's place depends on the labels before it.** Labels are placed in the order they are
  declared; declare first the ones with the fewest free places (a device in a row of cabinets),
  last the ones that can go anywhere (a point in the air).
- **Two devices with the same `x - y` stand in one column on the page.** The nearer hides the
  farther. Give every device its own `x - y`, or accept the overlap on purpose.
- **A conductor ends clear of the box of the device it ends on.** The paint order compares
  boxes, and a conductor whose box runs into a device's box is ordered by centre depth, which
  puts it behind the device or in front of it by accident. End it beside the device (a terminal
  that sticks out) or above it (the top of a bushing that is its own solid, not part of the
  tank's group), so one axis separates the two boxes.
- **A raised conductor covers whatever stands behind it.** A conductor at height `h` is drawn
  `h` higher on the page, where an object `2h` farther back in `-x` or `-y` stands. Put low
  objects (buildings, cabinets) on the near side of an overhead line, and let a service
  conductor run from the pole towards the viewer to a mast on the roof.
- **A lattice is see-through.** `truss` draws members only; a conductor behind a lattice column
  shows between its members, which is correct, and a label must not rely on the column to hide
  anything.
- **Moving one device moves the check to the next thing it now touches.** A scene copied from
  another keeps the other's coordinates: a kiosk that stood clear of the room wall in one figure
  was moved 60 units for a busbar in the next and went through the wall. After moving anything,
  compare its footprint with every wall, island edge and device around it; the engine now refuses
  an overlap, and what it cannot see is a device hanging over the edge of its island.
- **A part made of flat outlines needs a shaded thickness.** An insulator drawn as a stack of
  bare ellipses on a thin post was sent back as having no depth. `disc(..., lip=)` puts a darker
  band under the near rim of each shed with no second outline, so the stack reads as solid and
  the lint finds no coincident lines; the catalogue's insulators and suspension strings use it. A
  slender part (a post, a tube) is drawn at least 8 units across, or it prints as a line.
- **Put what is outdoors outdoors.** A wall-mounted or rooftop part (an antenna) stands on the
  wall, not on the indoor unit it serves.
- **An indoor area is drawn cut away**: low back walls on the two far edges, never a roof.
- **A cut-away is one `ordered()` device, and its order is checked on the render.** No comparison
  of boxes finds that the far inside wall is painted before the rotor and the near wall after it.
  Leave whole the length that carries something on top (terminals), open the rest, and draw what
  stands inside only over the opened length: a part painted after a closed ring covers the ring.
- **A gap that is the subject is drawn wide enough to print.** An air gap at true scale is a
  hairline between two edges that the lint reports as one line; draw it several units wide and
  say in the figure that it is not to scale.
- **A line on a lying cylinder stays clear of the cylinder's two silhouette lines.** A slot line
  within a few degrees of the silhouette prints on top of it; `lines_x` leaves those out.
- **A flat piece laid on a face shares no edge with the face.** A coloured bar drawn with its
  own outline along a cut face's edge prints two lines 0.5 px apart; inset the piece and give it
  no outline, or draw the shared edge once.
- **An end face is seen mirrored.** The section's angle runs from +y, the viewer's left, so
  anything laid out by angle (phases in slots) is mirrored against a flat section of the same
  machine drawn beside it; lay it out by the mirrored angle so both show one order (a reviewer
  read two figures as having B and C swapped).
- **A device that has a pair of something shows both.** A bearing hidden behind the stator left
  a generator standing on one bearing; lengthen the shaft until the far one is seen.
- **Parts inside one device are named by leaders, not by `label()`.** The label engine keeps a
  label off the whole device, so it cannot name a part inside it: draw a dot on the part (the
  device returns the world point), a hairline leader to the margin that stops short of the name,
  and a numbered disc dark enough for a white digit. Order the names so no two leaders cross.
- **A detail on a face is a flat panel, not a thin box.** A box standing less than 4 units
  proud of a face prints its two outlines 1.7 px apart and the lint reports `SELF-DOUBLED`;
  `Face.panel` lays a piece without an outline on the face. Keep boxes for parts that stand
  out (a meter, a handle, a lamp) and give them 4 units of depth.
- **A device against a cut-away wall can print an edge on the wall's top edge.** An edge along
  the wall at height `z` and distance `w` from the wall's face coincides with the wall's top
  when `w - z` equals the wall's `-height` (or `-height - thickness` for the far top edge).
  Choose the wall height for the room (`factory_hall(wall=)`): 60 clears an opened panel board,
  40 does not; or stand the device a few units off the wall.
- **A pipe along a wall keeps its silhouette off the wall's top edge.** A pipe of radius `r`
  at height `z` and distance `x` from the wall prints its two outlines at `x - z ± 1.4 r`;
  keep both 4 units from the wall's top edge values.
- **An opened door stands on the far side of its cabinet.** On the near side it stands between
  the viewer and the inside; `panel_board(opened=True)` swings it to the far side.
- **What lies on a wall's face belongs to the wall's group.** A window band drawn as its own
  solid a fraction off the face interpenetrates the box of a device standing against the wall
  and is ordered by centre depth, which paints the band over the device.
- **A wall-mounted device has no foot.** A floor cable reaches it through a riser
  (`conduit=True`), which stands on the floor under it and offers the port.
- **Parts of one device are spaced on paper before they are drawn.** Within a device, write
  each box's edge values (`w - z` along the front, `u - z` along the side, `u - w` for vertical
  edges) and keep every pair 4 units apart; two rounds of moving a part by a unit to clear one
  lint finding only move the finding. The catalogue's machine is laid out that way.
- **Check a domain fact before drawing it.** Where a device stands, what connects to what and in
  which order are claims a reader will take from the picture; draw only what a source supports.

## Solids

`box` · `box_at` · `cyl` (upright) · `cyl_x` (lying along x) · `cyl_y` (lying along y, a
pipe run in the other floor direction) · `truss` (thin members as one open
frame: a lattice column) · `disc` (one outline: insulator
sheds, flanges) · `wire` (a conductor in the air, with a paper casing). Parts of one device go
inside `with sc.group():` so the device moves through the depth order as one solid. Solids are
ordered by comparing bounding boxes pair by pair; a part that interpenetrates another falls back
to centre depth, so keep parts of different devices apart.

A machine opened to show what turns inside it: `ordered()` (a group painted in the order its
parts are added, where `group()` sorts them), `shell_x` (a hollow cylinder along x kept between
two angles of its section, drawn as `part="back"` and `part="front"`), `sector_x` and `quad`
(flat coloured pieces on an end face or a cut face: a slot and the bar in it), `lines_x` (lines
along a lying cylinder: the slots of a rotor). Inside `ordered()` the order is: what stands
behind, the shell's back, what stands inside, the shell's front, what stands in front.

A part inside a device is named with `callout(point, text, n=, accent=, prefer=)`: a dot on
the world point the device returned, a hairline leader and the name in free space. Callouts
are placed after the labels; a leader never crosses another leader or a placed name.

Floor layer, painted first: `island` (a ground area with an edge thickness), `strip` (a trench
or duct band), `cable`.

## Catalogue

`power` holds substation equipment: `current_transformer`, `voltage_transformer`, `bus_support`,
`gantry`, `disconnector`, `circuit_breaker`, `busbar`, `kiosk`, `cabinet` (kinds `switch`,
`relay`, `server`, `clock`), `antenna`; and the
grid outside the fence: `power_plant`, `power_transformer`, `line_tower`, `distribution_pole`,
`building`; and the machine inside the plant: `synchronous_generator` (a two-pole machine with
a cylindrical rotor, its stator opened over the near part of its length; it returns a world point
on each part for labels). Each
returns the device's solid and its connection points. A new device belongs in the catalogue of
its field, with its ports on visible faces; a layout or a wording true of one project stays in
that project's figure module.

`plant` holds the factory, the electrical room, the server room and the control room.
Conventions: `facing` names the side a front looks at (`"x"`, `"y"`, or `"-x"`/`"-y"` for a
front turned away, which shows the back); a floor device is placed by its footprint centre
and returns `port(f)`, the foot of its front at the fraction `f` from the viewer's left (keep
`f` within the clear zone, about 0.2 to 0.8), or `back(f)` when it faces away; a wall device
is placed by the wall-face point behind the middle of its bottom edge and its height `z`;
every result carries `solid` for `label()`. `examples/` holds a scene per setting
(`fig_factory_floor`, `fig_electrical_room`, `fig_server_room`, `fig_control_room`) and a sheet
of every device (`fig_catalogue`), built with the same config a printed proposal uses.

| Device | Ports and points | Variants |
|---|---|---|
| `factory_hall(sc, x0, y0, x1, y1, color, pal, wall=40)` | `wall_x`, `wall_y` (where devices stand), `corner` | cut-away floor and two back walls, window bands |
| `factory_building(sc, x, y, w, d, h, color, pal, roof, door)` | `door_port` | `roof="saw"` or `"flat"`, door on `"x"` or `"y"` |
| `machine(sc, x, y, color, pal, size, facing)` | `port(f)`, `panel` | `size` `"s"`, `"m"`, `"l"` |
| `switchgear(sc, x, y, color, pal, cubicles, facing)` | `port(f)`, `cubicle(k)`, `meter(k)`, `entry` | any number of cubicles |
| `panel_board(sc, x, y, color, pal, opened, facing, branches, clamps, leakage, modules)` | `port(f)`, `main`, `branch(k)`, `clamp(k)`, `leak`, `module(name)`, `duct` | closed, opened; `modules` `"sensor"`, `"gateway"` on the DIN rail |
| `clamp_sensor(sc, point, pal, axis, r)` | `point` | current clamp; a ring large enough for every conductor is a leakage sensor |
| `sensor_box(sc, x, y, z, pal, facing, conduit)` | `port` with `conduit=True` | wall unit, no antenna |
| `gateway(sc, x, y, z, pal, facing, conduit, antenna)` | `port`, `top` | wall unit with lamps and an antenna |
| `meter(sc, x, y, z, pal, facing, conduit)` | `port`, `display` | wall power meter |
| `pipe_run(sc, points, z, pal, color, r, supports)` | | floor-direction runs, fittings, stands |
| `gas_meter(sc, x, y, z, pal, axis)` | `pipe_in`, `pipe_out`, `index` | pipe along `"x"` or `"y"` |
| `heat_meter(sc, x, y, z, pal, axis)` | `pipe_in`, `pipe_out`, `head` | pipe along `"x"` or `"y"` |
| `server_rack(sc, x, y, color, pal, facing, units)` | `port(f)`, `top`, `unit(k)` | |
| `rack_row(sc, x, y, count, color, pal, facing)` | the racks' results | racks a gap apart |
| `cloud_room(sc, x0, y0, color, pal, racks)` | `racks`, `cooler`, `rack_port(k)`, `corner` | server room on its own island |
| `control_desk(sc, x, y, color, pal, monitors, facing)` | `port(f)` or `back(f)`, `screen(k)` | screens seen, or turned to a video wall |
| `video_wall(sc, x, y, z, pal, cols, rows, facing, alarm)` | `panel_at(col, row)` | any grid, one alarm panel |
| `signage(sc, x, y, color, pal, facing, mount)` | `screen`, `port` when standing | `mount="stand"` or `"hang"` |
| `handheld(sc, x, y, color, pal, kind, facing)` | `port(f)`, `screen` | `"phone"`, `"tablet"`; drawn oversize, say so in the label |
| `person(sc, x, y, color, pal)` | `head` | a standing figure of cylinders, no face or arms |

## Verify

1. Build and run `verify.py` as for any document figure. Lint has to be clean.
   `python3 -m unittest discover -s <skill>/scripts/tests` draws every catalogue device alone
   and every example scene and runs the same lint over them; a new device or variant is added
   to its `DEVICES` list.
2. Render and read the picture at full size, then crop and enlarge every place a conductor
   passes a device and every cable end.
3. Read it as somebody who has never seen the equipment: where does the eye start, which way
   does the signal go, what is each object. A scene that needs its caption to be followed is
   redrawn.
