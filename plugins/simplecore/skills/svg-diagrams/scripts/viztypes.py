"""Visual-type builders bound onto svgkit's Canvas.

The layout grammar of each type — proportions, what carries meaning, the
budget past which it stops being readable — follows the diagram-design skill
by Cathryn Lavery (MIT). See NOTICE in the skill root. The code is written
against svgkit's theme and primitives; nothing is copied verbatim.

Each builder is a plain function whose first argument is the canvas, bound as
a Canvas method at the bottom of svgkit. They share three conventions:

* Every coordinate the caller passes is the top-left of the whole figure, so
  a type can be placed like any other block.
* Colour is looked up from the canvas theme by role, never hardcoded, so a
  figure re-themes with the canvas.
* The return value is the geometry a caller needs next — usually the
  bounding box (x, y, w, h) so a legend or a caption can sit under it.
"""
from svgkit import tw, MONO, SANS, _DEF  # noqa: E402  (bound after Canvas)

import math


def _c(canvas, color, role="muted"):
    return canvas.t[role] if color is _DEF or color is None else color


# ── swimlane ────────────────────────────────────────────────────────────────
def swimlane(c, x, y, w, lanes, phases, cards, lane_h=96, header_h=34,
             label_w=140, gap=8):
    """Cross-functional process: who does what, in what order.

    `lanes` are the actors (rows), `phases` the ordered stages (columns), and
    `cards` the work: (lane_index, phase_index, title, sub). A card spanning
    two phases takes (lane, (first, last), title, sub).

    The handoff is the point of this type — a card in one lane followed by a
    card in another says a person handed work over — so lanes stay few. Past
    five rows the reader stops tracking who is who and it becomes a table.
    """
    if len(lanes) > 5:
        raise ValueError("swimlane: %d lanes; past 5 the handoffs stop being "
                         "readable — split the process" % len(lanes))
    body_x = x + label_w
    col_w = (w - label_w - (len(phases) - 1) * gap) / len(phases)
    h = header_h + len(lanes) * lane_h

    # phase headers first, so lane bands and cards paint over their edges
    for i, ph in enumerate(phases):
        px = body_x + i * (col_w + gap)
        c.rrect(px, y, col_w, header_h - 6, rx=6, fill=c.t["box_hi"],
                stroke=c.t["line"], sw=1)
        c.text(px + col_w / 2, y + header_h - 16, ph, size=12.5,
               color=c.t["fg"], family=SANS, weight=600, anchor="middle")

    for j, lane in enumerate(lanes):
        ly = y + header_h + j * lane_h
        c.rrect(x, ly, w, lane_h - gap, rx=8,
                fill=c.t["panel"], stroke=c.t["line"], sw=0.8)
        c.text(x + 16, ly + lane_h / 2 - 2, lane, size=13, color=c.t["fg"],
               family=SANS, weight=600)

    placed = []
    for lane_i, span, title, sub in cards:
        a, b = span if isinstance(span, (tuple, list)) else (span, span)
        cx0 = body_x + a * (col_w + gap)
        cw = (b - a + 1) * col_w + (b - a) * gap
        cy = y + header_h + lane_i * lane_h + 10
        ch = lane_h - gap - 20
        accent = c.t[["blue", "cyan", "teal", "green", "purple"][lane_i % 5]]
        c.rrect(cx0, cy, cw, ch, rx=8, fill=c.t["box"], stroke=accent, sw=1.4)
        c.text(cx0 + cw / 2, cy + (ch / 2 - 4 if sub else ch / 2 + 4), title,
               size=13, color=c.t["fg"], family=SANS, weight=600,
               anchor="middle")
        if sub:
            c.text(cx0 + cw / 2, cy + ch / 2 + 15, sub, size=11.5,
                   color=c.t["muted"], family=SANS, anchor="middle")
        placed.append((cx0, cy, cw, ch))
    return (x, y, w, h), placed


# ── quadrant ────────────────────────────────────────────────────────────────
def quadrant(c, x, y, size, x_axis, y_axis, names=None, items=(),
             focal=()):
    """Two-axis positioning. `x_axis`/`y_axis` are (low, high) label pairs.

    `items` are (label, fx, fy) with fx/fy in 0..1 from the low end of each
    axis. `names` optionally labels the four cells, clockwise from top-left.
    `focal` is the set of item labels drawn in the accent colour — the type
    exists to say which quadrant a thing is in, and accenting everything says
    nothing.
    """
    if len(items) > 12:
        raise ValueError("quadrant: %d items; past 12 the labels collide "
                         "and the position stops being readable" % len(items))
    c.rrect(x, y, size, size, rx=10, fill=c.t["panel"],
            stroke=c.t["line"], sw=1)
    mid = size / 2
    c.line(x, y + mid, x + size, y + mid, color=c.t["line"], sw=1,
           marker=None)
    c.line(x + mid, y, x + mid, y + size, color=c.t["line"], sw=1,
           marker=None)

    if names:
        for i, nm in enumerate(names[:4]):
            qx = x + (0 if i in (0, 3) else mid) + mid / 2
            qy = y + (0 if i < 2 else mid) + 24
            c.text(qx, qy, nm, size=11.5, color=c.t["muted"], family=MONO,
                   anchor="middle", spacing=0.10)

    c.text(x + mid, y + size + 22, x_axis[1], size=12, color=c.t["fg_dim"],
           family=SANS, weight=600, anchor="middle")
    c.text(x, y + size + 22, x_axis[0], size=12, color=c.t["muted"],
           family=SANS)
    c.text(x - 12, y + 12, y_axis[1], size=12, color=c.t["fg_dim"],
           family=SANS, weight=600, anchor="end")
    c.text(x - 12, y + size, y_axis[0], size=12, color=c.t["muted"],
           family=SANS, anchor="end")

    for label, fx, fy in items:
        px = x + fx * size
        py = y + (1 - fy) * size
        hot = label in focal
        c.dot(px, py, 5, c.t["orange"] if hot else c.t["blue"])
        c.text(px + 10, py + 4, label, size=12,
               color=c.t["fg"] if hot else c.t["fg_dim"], family=SANS,
               weight=600 if hot else 400)
    return (x, y, size, size)


# ── pyramid / funnel ────────────────────────────────────────────────────────
def pyramid(c, x, y, w, h, layers, funnel=False, gap=6):
    """Ranked hierarchy (pyramid) or conversion drop-off (funnel).

    `layers` are (title, sub) from the top down. The two differ only in which
    end is wide: a pyramid narrows upward because the top is the few, a
    funnel narrows downward because each stage loses some of the previous.
    Everything else — the trapezoid stack, the labels inside — is shared.
    """
    if len(layers) > 6:
        raise ValueError("pyramid: %d layers; past 6 the top band is too "
                         "narrow to hold its own label" % len(layers))
    n = len(layers)
    band = (h - (n - 1) * gap) / n
    roles = ["orange", "yellow", "green", "teal", "cyan", "blue"]
    for i, (title, sub) in enumerate(layers):
        top_f = i / n if not funnel else 1 - i / n
        bot_f = (i + 1) / n if not funnel else 1 - (i + 1) / n
        ty = y + i * (band + gap)
        by = ty + band
        tw_ = w * top_f
        bw_ = w * bot_f
        cxm = x + w / 2
        c.path(f"M {cxm - tw_ / 2:.1f} {ty:.1f} "
               f"L {cxm + tw_ / 2:.1f} {ty:.1f} "
               f"L {cxm + bw_ / 2:.1f} {by:.1f} "
               f"L {cxm - bw_ / 2:.1f} {by:.1f} Z",
               color=c.t[roles[i % len(roles)]], sw=1.4, marker=None,
               fill=c.t["box"])
        c.text(cxm, ty + band / 2 + (0 if not sub else -3), title, size=13,
               color=c.t["fg"], family=SANS, weight=600, anchor="middle")
        if sub:
            c.text(cxm, ty + band / 2 + 15, sub, size=11.5,
                   color=c.t["muted"], family=SANS, anchor="middle")
    return (x, y, w, h)


# ── venn ────────────────────────────────────────────────────────────────────
def venn(c, x, y, r, sets, overlaps=()):
    """Overlap between two or three sets.

    `sets` are (name, sub) and `overlaps` are (indices, label) — indices as a
    tuple, so (0, 1) labels the lens between the first two and (0, 1, 2) the
    centre. Circles are outlined and unfilled: a fill makes the reader judge
    area, and these areas mean nothing.
    """
    if not 2 <= len(sets) <= 3:
        raise ValueError("venn: %d sets; two or three, because a fourth "
                         "circle cannot meet the other three at once"
                         % len(sets))
    roles = ["blue", "orange", "teal"]
    d = r * 1.05
    if len(sets) == 2:
        centres = [(x + r, y + r), (x + r + d, y + r)]
        w, h = 2 * r + d, 2 * r
    else:
        centres = [(x + r, y + r), (x + r + d, y + r),
                   (x + r + d / 2, y + r + d * 0.87)]
        w, h = 2 * r + d, 2 * r + d * 0.87
    for (cx, cy), (name, sub), role in zip(centres, sets, roles):
        c.add(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" '
              f'fill="none" stroke="{c.t[role]}" stroke-width="1.6"/>')
    for (cx, cy), (name, sub), role in zip(centres, sets, roles):
        lx = cx + (-r * 0.62 if cx < centres[1][0] else r * 0.62)
        if len(sets) == 3 and (cx, cy) == centres[2]:
            lx, ly = cx, cy + r * 0.62
        else:
            ly = cy - r * 0.34
        # A paper mask under the name. A set label belongs in the lune that
        # belongs to that set, and the lune is bounded by the very stroke the
        # label then sits on — so the two cross by construction, and a name
        # laid straight over a circle's edge is read letter by letter. The
        # mask stops the stroke behind the words and nothing else.
        mw = max(tw(name, 13, False), tw(sub, 11.5, False) if sub else 0) + 14
        mh = 30 if sub else 18
        c.rrect(lx - mw / 2, ly - 13, mw, mh, rx=4, fill=c.t["bg"],
                stroke="none", sw=0)
        c.text(lx, ly, name, size=13, color=c.t[role], family=SANS,
               weight=600, anchor="middle")
        if sub:
            c.text(lx, ly + 16, sub, size=11.5, color=c.t["muted"],
                   family=SANS, anchor="middle")
    for idx, label in overlaps:
        pts = [centres[i] for i in idx]
        ox = sum(q[0] for q in pts) / len(pts)
        oy = sum(q[1] for q in pts) / len(pts)
        # In a three-set diagram the midpoint of any two centres sits close to
        # the middle, so a pairwise label lands on top of the one for all
        # three. Push it away from the circle it does not belong to: that is
        # the direction of the lens it names, and it separates the labels for
        # the same reason.
        if len(sets) == 3 and len(idx) == 2:
            other = centres[({0, 1, 2} - set(idx)).pop()]
            dx, dy = ox - other[0], oy - other[1]
            n = math.hypot(dx, dy) or 1
            ox += dx / n * r * 0.42
            oy += dy / n * r * 0.42
        c.edge_label(ox, oy, label, c.t["fg_dim"])
    return (x, y, w, h)


# ── loop / flywheel ─────────────────────────────────────────────────────────
def loop(c, cx, cy, r, steps, hub=None, bw=168, bh=64):
    """A reinforcing cycle: the last step feeds the first.

    Drawn as boxes on a ring with arcs between them, because the thing that
    distinguishes a loop from a process is that it has no end — a row of
    boxes with an arrow curving back reads as a process with an exception.
    `hub` is the state the cycle accumulates, named in the middle.
    """
    if not 3 <= len(steps) <= 6:
        raise ValueError("loop: %d steps; three to six — fewer is a line, "
                         "more and the ring reads as a pie" % len(steps))
    n = len(steps)
    need = (bw + 24) / (2 * math.sin(math.pi / n))
    if r < need:
        raise ValueError("loop: r=%.0f is too small for %d boxes %.0fpx wide "
                         "— they would touch. Use r >= %.0f, or narrower "
                         "boxes." % (r, n, bw, need))
    boxes = []
    for i, (title, sub) in enumerate(steps):
        a = -math.pi / 2 + i * 2 * math.pi / n
        bx = cx + r * math.cos(a) - bw / 2
        by = cy + r * math.sin(a) - bh / 2
        role = ["blue", "cyan", "teal", "green", "purple", "orange"][i % 6]
        c.rrect(bx, by, bw, bh, rx=8, fill=c.t["box"], stroke=c.t[role],
                sw=1.4)
        c.text(bx + bw / 2, by + (bh / 2 - 3 if sub else bh / 2 + 4), title,
               size=13, color=c.t["fg"], family=SANS, weight=600,
               anchor="middle")
        if sub:
            c.text(bx + bw / 2, by + bh / 2 + 15, sub, size=11.5,
                   color=c.t["muted"], family=SANS, anchor="middle")
        boxes.append((bx, by, bw, bh))

    # The arcs ride a ring INSIDE the boxes. Drawn at the boxes' own radius
    # they have to squeeze through the gap between two boxes, and at four
    # steps that gap is a few degrees — what renders is an arrowhead and no
    # arc. The clearance is angular, not linear: a box of width bw at radius
    # r covers atan(bw/2 / r) either side of its centre, so the arc starts
    # past that and stops short of the next one by the same amount.
    ring = max(r - bh / 2 - 20, r * 0.45)
    half = math.atan2(bw / 2 + 10, r)
    sector = 2 * math.pi / n
    for i in range(n):
        a0 = -math.pi / 2 + i * sector + half
        a1 = -math.pi / 2 + (i + 1) * sector - half
        if a1 - a0 < math.radians(8):
            continue          # no room for an arc: the ring is over-filled
        p0 = (cx + ring * math.cos(a0), cy + ring * math.sin(a0))
        p1 = (cx + ring * math.cos(a1), cy + ring * math.sin(a1))
        c.add(f'<path d="M {p0[0]:.1f} {p0[1]:.1f} A {ring:.1f} {ring:.1f} '
              f'0 0 1 {p1[0]:.1f} {p1[1]:.1f}" fill="none" '
              f'stroke="{c.t["muted"]}" stroke-width="1.6" '
              f'marker-end="url(#arr-muted)"/>')
    if hub:
        title, sub = hub if isinstance(hub, (tuple, list)) else (hub, None)
        c.text(cx, cy - (4 if sub else -4), title, size=14, color=c.t["fg"],
               family=SANS, weight=700, anchor="middle")
        if sub:
            c.text(cx, cy + 16, sub, size=11.5, color=c.t["muted"],
                   family=SANS, anchor="middle")
    return (cx - r - bw / 2, cy - r - bh / 2, 2 * r + bw, 2 * r + bh), boxes


# ── bar chart ───────────────────────────────────────────────────────────────
def bar(c, x, y, w, h, items, unit="", horizontal=True, focal=(),
        stacked=False, total=None, budget_label=None):
    """Quantitative comparison across categories. `items` are (label, value).

    Horizontal by default: category names are words, and words read along a
    row without turning the page. A value axis is not drawn — each bar
    carries its own number, which is what a reader actually looks up, and the
    axis line would be a second way of saying the same thing.

    `stacked=True` draws one bar split into named segments instead — a budget
    and what spends it, a total and what makes it up. `total` sets the budget
    where it is larger than the parts, so the remainder shows as slack rather
    than being silently absorbed. This mode exists because the alternative is
    a row of rectangles whose widths somebody worked out by hand, and those
    stop being true the moment a number changes.
    """
    if stacked:
        budget = total or sum(v for _, v in items)
        seg_gap = 4
        span = w - seg_gap * (len(items) - 1)
        bh = min(h, 34)
        if budget_label:
            c.text(x, y - 12, budget_label, size=12, color=c.t["muted"],
                   family=SANS)
        roles = ["red", "blue", "green", "orange", "purple", "teal"]
        bx = x
        for i, (label, v) in enumerate(items):
            sw_ = span * v / budget
            col = c.t["orange"] if label in focal else c.t[roles[i % 6]]
            c.rrect(bx, y, sw_, bh, rx=4, fill=col, opacity=0.16, stroke=col,
                    sw=1.5)
            c.text(bx + sw_ / 2, y + bh * 0.66, f"{label} {v:g}{unit}",
                   size=12.5, color=col, anchor="middle", weight=600,
                   family=SANS)
            bx += sw_ + seg_gap
        used = sum(v for _, v in items)
        if total and used < total:
            rest = span * (total - used) / budget
            c.rrect(bx, y, rest, bh, rx=4, fill=c.t["grid"], stroke="none",
                    sw=0)
            c.text(bx + rest / 2, y + bh * 0.66, f"여유 {total - used:g}{unit}",
                   size=12, color=c.t["muted"], anchor="middle", family=SANS)
        return (x, y, w, bh)

    if len(items) > 8:
        raise ValueError("bar: %d bars; past 8 the rows crowd and a table "
                         "reads faster" % len(items))
    top = max(v for _, v in items) or 1
    label_w = max(tw(lab, 12.5, False) for lab, _ in items) + 16
    val_w = max(tw(f"{v:,}{unit}", 12, True) for _, v in items) + 14
    n = len(items)
    if horizontal:
        row = h / n
        bh = min(row - 10, 26)
        track = w - label_w - val_w
        for i, (label, v) in enumerate(items):
            by = y + i * row + (row - bh) / 2
            c.text(x + label_w - 12, by + bh / 2 + 4, label, size=12.5,
                   color=c.t["fg"], family=SANS, anchor="end")
            c.rrect(x + label_w, by, track, bh, rx=4, fill=c.t["grid"],
                    stroke="none", sw=0)
            bw = max(track * v / top, 2)
            role = "orange" if label in focal else "blue"
            c.rrect(x + label_w, by, bw, bh, rx=4, fill=c.t[role],
                    stroke="none", sw=0)
            c.text(x + label_w + track + 10, by + bh / 2 + 4,
                   f"{v:,}{unit}", size=12, color=c.t["fg_dim"], family=MONO)
    else:
        col = w / n
        bw = min(col - 14, 44)
        track = h - 34
        for i, (label, v) in enumerate(items):
            bx = x + i * col + (col - bw) / 2
            bhh = max(track * v / top, 2)
            role = "orange" if label in focal else "blue"
            c.rrect(bx, y + track - bhh, bw, bhh, rx=4, fill=c.t[role],
                    stroke="none", sw=0)
            c.text(bx + bw / 2, y + track - bhh - 8, f"{v:,}{unit}", size=12,
                   color=c.t["fg_dim"], family=MONO, anchor="middle")
            c.text(bx + bw / 2, y + track + 20, label, size=12.5,
                   color=c.t["fg"], family=SANS, anchor="middle")
    return (x, y, w, h)


# ── radar / spider ──────────────────────────────────────────────────────────
def radar(c, cx, cy, r, axes, series, rings=4):
    """Several entities scored on the same 3-5 criteria.

    `axes` are the criterion names, `series` are (name, [scores 0..1], focal).
    The grid is polygonal rather than circular so a reader can follow a ring
    to an axis; the focal series is filled, the rest are outlines, because
    two filled polygons on top of each other are unreadable whatever the
    opacity.
    """
    if not 3 <= len(axes) <= 5:
        raise ValueError("radar: %d axes; three to five — fewer has no area "
                         "and more turns every shape into a circle"
                         % len(axes))
    if len(series) > 5:
        raise ValueError("radar: %d series; past 5 the outlines cannot be "
                         "told apart" % len(series))
    n = len(axes)

    def pt(i, f):
        a = -math.pi / 2 + i * 2 * math.pi / n
        return (cx + r * f * math.cos(a), cy + r * f * math.sin(a))

    for k in range(1, rings + 1):
        f = k / rings
        d = " ".join(f"{'M' if i == 0 else 'L'} {pt(i, f)[0]:.1f} "
                     f"{pt(i, f)[1]:.1f}" for i in range(n)) + " Z"
        c.path(d, color=c.t["grid"], sw=1, marker=None)
    for i in range(n):
        p = pt(i, 1.0)
        c.line(cx, cy, p[0], p[1], color=c.t["grid"], sw=1, marker=None)
        lp = pt(i, 1.16)
        c.text(lp[0], lp[1] + 4, axes[i], size=12, color=c.t["fg_dim"],
               family=SANS, weight=600,
               anchor="middle" if abs(lp[0] - cx) < r * 0.3
               else ("start" if lp[0] > cx else "end"))

    roles = ["green", "purple", "cyan", "teal", "yellow"]
    ri = 0
    for name, scores, *rest in series:
        hot = bool(rest and rest[0])
        col = c.t["orange"] if hot else c.t[roles[ri % len(roles)]]
        if not hot:
            ri += 1
        d = " ".join(f"{'M' if i == 0 else 'L'} {pt(i, s)[0]:.1f} "
                     f"{pt(i, s)[1]:.1f}" for i, s in enumerate(scores)) + " Z"
        c.add(f'<path d="{d}" fill="{col}" fill-opacity="{0.18 if hot else 0}"'
              f' stroke="{col}" stroke-width="{2 if hot else 1.4}"/>')
    return (cx - r, cy - r, 2 * r, 2 * r)


# ── sequence ────────────────────────────────────────────────────────────────
def sequence(c, x, y, actors, messages, lane=150, head_h=44, step=44):
    """Time-ordered messages between actors, time running down.

    `messages` are (from_index, to_index, label, kind) where kind is "call",
    "return" (dashed) or "self". The lifeline is what makes this type worth
    its space — it says an actor is still there between messages — so it runs
    the full height even where nothing happens.
    """
    if len(actors) > 5:
        raise ValueError("sequence: %d lifelines; past 5 the messages cross "
                         "too often to follow" % len(actors))
    h = head_h + (len(messages) + 1) * step
    xs = [x + lane / 2 + i * lane for i in range(len(actors))]
    for ax, name in zip(xs, actors):
        bw = max(tw(name, 12.5, False) + 28, 96)
        c.rrect(ax - bw / 2, y, bw, head_h - 10, rx=8, fill=c.t["box"],
                stroke=c.t["blue"], sw=1.4)
        c.text(ax, y + head_h / 2 + 1, name, size=12.5, color=c.t["fg"],
               family=SANS, weight=600, anchor="middle")
        c.line(ax, y + head_h - 8, ax, y + h, color=c.t["line"], sw=1,
               dash="4 4", marker=None)

    for k, (a, b, label, *rest) in enumerate(messages):
        kind = rest[0] if rest else "call"
        my = y + head_h + (k + 1) * step
        if kind == "self" or a == b:
            ax = xs[a]
            c.path(f"M {ax:.1f} {my - 12:.1f} L {ax + 34:.1f} {my - 12:.1f} "
                   f"L {ax + 34:.1f} {my + 8:.1f} L {ax:.1f} {my + 8:.1f}",
                   color=c.t["muted"], sw=1.4, marker="muted")
            c.text(ax + 44, my - 2, label, size=11.5, color=c.t["fg_dim"],
                   family=SANS)
            continue
        col = c.t["muted"] if kind == "return" else c.t["blue"]
        c.line(xs[a], my, xs[b], my, color=col, sw=1.4,
               dash="5 4" if kind == "return" else None, marker="muted")
        c.edge_label((xs[a] + xs[b]) / 2, my - 14, label, col)
    return (x, y, lane * len(actors), h)


# ── timeline ───────────────────────────────────────────────────────────────
def timeline(c, x, y, w, span, marks, bands=(), unit="", rail_h=18):
    """Events positioned in time, on one axis that is actually to scale.

    `span` is the length of the axis in whatever unit the marks use, `marks`
    are (at, title, sub), and `bands` are (label, from, to) drawn as segments
    of the rail. Marks alternate above and below so their labels never share
    a column.

    The axis being to scale is the whole point. A row of boxes with months
    written inside them puts equal space between 4 and 9 as between 15 and
    22, which is the one thing a schedule figure must not do — the reader
    takes the spacing as the claim and the numbers as its caption.
    """
    if len(marks) > 9:
        raise ValueError("timeline: %d marks; past 9 the labels collide even "
                         "alternating above and below" % len(marks))
    def at(v):
        return x + w * v / span

    mid = y + 64
    roles = ["blue", "purple", "teal", "green"]
    if bands:
        for i, (label, a, b) in enumerate(bands):
            col = c.t[roles[i % len(roles)]]
            c.rrect(at(a), mid - rail_h / 2, at(b) - at(a), rail_h,
                    rx=rail_h / 2, fill=c.t["panel"], stroke=col, sw=1.4)
            c.text((at(a) + at(b)) / 2, mid + 5, label, size=12.5, color=col,
                   family=SANS, anchor="middle", weight=600)
    else:
        c.line(x, mid, x + w, mid, color=c.t["line"], sw=1.4, marker=None)

    for i, (v, title, sub) in enumerate(marks):
        up = i % 2 == 1
        px = at(v)
        ly = mid - 46 if up else mid + 46
        # The dot sits on the rail edge its label leaves from, not on the
        # centre line. A band carries its own name down the middle of the
        # rail, and a dot placed there lands on those letters — which is a
        # collision no amount of spacing prevents, because both belong to
        # the rail.
        dy = mid - rail_h / 2 if up else mid + rail_h / 2
        c.line(px, dy, px, ly + (14 if up else -14), color=c.t["line"],
               sw=1.2, marker=None)
        c.dot(px, dy, 4.5, c.t[roles[0]] if v <= span / 2
              else c.t[roles[1]])
        ty = ly - 8 if up else ly + 6
        c.text(px, ty, f"{v:g}{unit}", size=12, color=c.t["fg_dim"],
               family=SANS, anchor="middle", weight=700)
        c.text(px, ty + 17, title, size=13, color=c.t["fg"], family=SANS,
               anchor="middle", weight=600)
        if sub:
            c.text(px, ty + 33, sub, size=11.5, color=c.t["muted"],
                   family=SANS, anchor="middle")
    return (x, y, w, 128)


BUILDERS = {
    "swimlane": swimlane,
    "timeline": timeline,
    "quadrant": quadrant,
    "pyramid": pyramid,
    "venn": venn,
    "loop": loop,
    "bar": bar,
    "radar": radar,
    "sequence": sequence,
}


# ── entity / table / class — the compartment node ───────────────────────────
def entity(c, x, y, w, name, sections, sub=None, accent=None, row_h=22,
           head_h=38):
    """One box divided into compartments. ER entity, SQL table, UML class.

    `sections` is a list of compartments, each a list of rows; a row is a
    string, or a (left, right) pair drawn as a label and its type. The three
    types differ in what goes in the compartments, not in the shape, so one
    builder serves all three and the caller decides:

    * ER — one compartment of attributes, the key first
    * database schema — one compartment of column/type pairs
    * UML class — attributes then operations, two compartments

    Returns (box, row_y) where `row_y` maps each row's index to the y of its
    centre, so a column-level foreign key can leave the exact row it lives on
    rather than the middle of the box.
    """
    col = accent or c.t["blue"]
    rows = [r for sec in sections for r in sec]
    h = head_h + sum(len(sec) * row_h for sec in sections) + 10 * len(sections)
    c.rrect(x, y, w, h, rx=8, fill=c.t["box"], stroke=col, sw=1.4)
    c.rrect(x, y, w, head_h, rx=8, fill=col, stroke="none", sw=0, opacity=0.10)
    # 이름과 부제는 머리 칸의 같은 줄에 좌우로 놓인다. 기준선을 다르게 잡으면
    # 이름만 위로 밀려 머리 칸이 위쪽으로 치우쳐 보인다.
    c.text(x + 14, y + head_h / 2 + 5, name, size=13.5, color=c.t["fg"],
           family=SANS, weight=700)
    if sub:
        c.text(x + w - 14, y + head_h / 2 + 4, sub, size=11,
               color=c.t["muted"], family=SANS, anchor="end")

    row_y = []
    cy = y + head_h
    for si, sec in enumerate(sections):
        if si:
            c.line(x, cy + 5, x + w, cy + 5, color=c.t["line"], sw=0.8,
                   marker=None)
            cy += 10
        for row in sec:
            left, right = row if isinstance(row, (tuple, list)) else (row, None)
            base = cy + row_h / 2 + 4
            c.text(x + 14, base, left, size=11.5, color=c.t["fg_dim"],
                   family=SANS)
            if right:
                c.text(x + w - 14, base, right, size=11, color=c.t["muted"],
                       family=MONO, anchor="end")
            row_y.append(cy + row_h / 2)
            cy += row_h
    return (x, y, w, h), row_y


def relate(c, a, b, kind="1-n", label=None, ay=None, by=None):
    """A relationship between two compartment nodes, with its cardinality.

    `kind` is two ends joined by a hyphen, each one of `1`, `n` or `0` —
    `1-n` is one-to-many, `0-n` optional-to-many. The notation is drawn as a
    glyph at each end rather than as an arrowhead: a relationship has no
    direction, and an arrow claims one.

    `ay`/`by` take a y from the `row_y` a compartment node returned, which is
    how a foreign key leaves the column it actually lives on.
    """
    ends = kind.split("-")
    left_first = a[0] < b[0]
    ax = a[0] + a[2] if left_first else a[0]
    bx = b[0] if left_first else b[0] + b[2]
    ay = ay if ay is not None else a[1] + a[3] / 2
    by = by if by is not None else b[1] + b[3] / 2
    mid = (ax + bx) / 2
    d = (f"M {ax:.1f} {ay:.1f} L {mid:.1f} {ay:.1f} "
         f"L {mid:.1f} {by:.1f} L {bx:.1f} {by:.1f}") if abs(ay - by) > 2 \
        else f"M {ax:.1f} {ay:.1f} L {bx:.1f} {by:.1f}"
    c.path(d, color=c.t["muted"], sw=1.2, marker=None)

    def foot(px, py, mark, inward):
        s = 8 * (1 if inward > 0 else -1)
        if mark == "n":
            for dy in (-6, 0, 6):
                c.line(px, py, px + s, py + dy, color=c.t["muted"], sw=1.1,
                       marker=None)
        elif mark == "1":
            c.line(px + s * 0.6, py - 6, px + s * 0.6, py + 6,
                   color=c.t["muted"], sw=1.4, marker=None)
        else:
            c.add(f'<circle cx="{px + s * 0.7:.1f}" cy="{py:.1f}" r="4" '
                  f'fill="{c.t["bg"]}" stroke="{c.t["muted"]}" '
                  f'stroke-width="1.2"/>')

    foot(ax, ay, ends[0], 1 if left_first else -1)
    foot(bx, by, ends[1], -1 if left_first else 1)
    if label:
        c.edge_label(mid, (ay + by) / 2, label, c.t["fg_dim"])
    return mid


def _nice(v):
    """Round an axis maximum up to a number a reader can divide by four.

    An axis whose top is the largest data point puts its gridlines on values
    like 22.5 and 7.5, and the reader then does arithmetic to place a point.
    Rounding to 1, 2, 2.5 or 5 times a power of ten puts every tick on a
    number they already know.
    """
    if v <= 0:
        return 1
    mag = 10 ** math.floor(math.log10(v))
    for f in (1, 2, 2.5, 5, 10):
        if v <= f * mag:
            return f * mag
    return 10 * mag

# ── line chart · slopegraph ────────────────────────────────────────────────
def linechart(c, x, y, w, h, series, x_labels, unit="", focal=(), y_max=None):
    """A trend over an ordered axis. Two points per series is a slopegraph.

    `series` are (name, [values]) with one value per x label. Each line is
    labelled at its right end rather than in a legend: a legend makes the
    reader carry a colour across the figure, and the end of the line is where
    they are already looking.

    The y axis starts at zero unless `y_max` says otherwise. A truncated axis
    turns a 3% difference into a cliff, and a figure in a bid document is
    read by somebody looking for exactly that.
    """
    if len(series) > 5:
        raise ValueError("linechart: %d series; past 5 the lines cannot be "
                         "told apart without a legend" % len(series))
    raw = y_max or max(v for _, vs in series for v in vs) or 1
    top = raw if y_max else _nice(raw)
    name_w = max(tw(n, 11.5, False) for n, _ in series) + 16
    plot_w = w - name_w
    n = len(x_labels)
    step = plot_w / max(n - 1, 1)
    base = y + h - 26

    for k in range(5):
        gy = y + (h - 26) * k / 4
        c.line(x, gy, x + plot_w, gy, color=c.t["grid"], sw=1, marker=None)
        c.text(x - 8, gy + 4, f"{top * (4 - k) / 4:,.0f}", size=10,
               color=c.t["muted"], family=MONO, anchor="end")
    for i, lab in enumerate(x_labels):
        c.text(x + i * step, base + 20, lab, size=11.5, color=c.t["fg_dim"],
               family=SANS, anchor="middle")

    roles = ["blue", "teal", "purple", "cyan", "green"]
    ri = 0
    ends = []
    for name, vs in series:
        hot = name in focal
        colr = c.t["orange"] if hot else c.t[roles[ri % len(roles)]]
        if not hot:
            ri += 1
        pts = [(x + i * step, base - (h - 26) * v / top)
               for i, v in enumerate(vs)]
        d = " ".join(f"{'M' if i == 0 else 'L'} {px:.1f} {py:.1f}"
                     for i, (px, py) in enumerate(pts))
        c.path(d, color=colr, sw=2.2 if hot else 1.6, marker=None)
        for px, py in pts:
            c.dot(px, py, 3.5, colr)
        ends.append([pts[-1][1], pts[-1][0], name, colr, hot])

    # Two series that finish at the same value finish at the same pixel, and
    # their names then print on top of each other. Naming the line at its end
    # is what lets this chart do without a legend, so the collision is the
    # builder's to resolve: order the labels by where the lines actually end
    # and push them apart, keeping that order so no label points past another.
    ends.sort(key=lambda e: e[0])
    for i in range(1, len(ends)):
        if ends[i][0] - ends[i - 1][0] < 15:
            ends[i][0] = ends[i - 1][0] + 15
    for ly, lx, name, colr, hot in ends:
        c.text(lx + 10, ly + 4, name, size=11.5, color=colr,
               family=SANS, weight=700 if hot else 500)
    if unit:
        c.text(x - 8, y - 8, unit, size=10, color=c.t["muted"], family=MONO,
               anchor="end")
    return (x, y, w, h)


# ── scatter · bubble ───────────────────────────────────────────────────────
def scatter(c, x, y, w, h, points, x_axis, y_axis, focal=(), max_r=18):
    """Two measures against each other; a third as area if a point carries it.

    `points` are (label, px, py) or (label, px, py, weight) with px/py in
    0..1. `x_axis`/`y_axis` are (name, low_label, high_label). A weighted
    point is drawn as a disc whose AREA is proportional to the weight —
    scaling the radius instead triples the apparent difference, which is the
    one mistake this chart is famous for.
    """
    if len(points) > 30:
        raise ValueError("scatter: %d points; past 30 the labels have to go, "
                         "and a scatter without labels is a texture"
                         % len(points))
    plot_h = h - 30
    # Inset by the largest disc's radius. A point at 1.0 on either axis is a
    # real data position, and without the inset its disc is cut by the plot
    # edge — which reads as a smaller value than the one it stands for.
    weights0 = [p[3] for p in points if len(p) > 3]
    pad = max_r if weights0 else 6
    px0, py0 = x + pad, y + pad
    pw, ph = w - 2 * pad, plot_h - 2 * pad
    for k in range(5):
        gy = y + plot_h * k / 4
        c.line(x, gy, x + w, gy, color=c.t["grid"], sw=1, marker=None)
    c.line(x, y + plot_h, x + w, y + plot_h, color=c.t["rule"]
           if "rule" in c.t else c.t["line"], sw=1.2, marker=None)
    c.line(x, y, x, y + plot_h, color=c.t["line"], sw=1.2, marker=None)

    c.text(x + w / 2, y + h + 4, x_axis[0], size=11.5, color=c.t["fg_dim"],
           family=SANS, weight=600, anchor="middle")
    c.text(x, y + plot_h + 18, x_axis[1], size=10.5, color=c.t["muted"],
           family=SANS)
    c.text(x + w, y + plot_h + 18, x_axis[2], size=10.5, color=c.t["muted"],
           family=SANS, anchor="end")
    c.text(x - 10, y - 10, y_axis[0], size=11.5, color=c.t["fg_dim"],
           family=SANS, weight=600)

    weights = [p[3] for p in points if len(p) > 3]
    wmax = max(weights) if weights else 0
    for p in points:
        label, px, py = p[0], p[1], p[2]
        cx = px0 + px * pw
        cy = py0 + (1 - py) * ph
        hot = label in focal
        colr = c.t["orange"] if hot else c.t["blue"]
        if len(p) > 3 and wmax:
            r = max_r * math.sqrt(p[3] / wmax)          # area, not radius
            c.add(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" '
                  f'fill="{colr}" fill-opacity="0.20" stroke="{colr}" '
                  f'stroke-width="1.4"/>')
        else:
            c.dot(cx, cy, 5, colr)
            r = 5
        c.text(cx + r + 6, cy + 4, label, size=11,
               color=c.t["fg"] if hot else c.t["fg_dim"], family=SANS,
               weight=700 if hot else 400)
    return (x, y, w, h)


# ── polar / radial lollipop ────────────────────────────────────────────────
def polar(c, cx, cy, r, categories, values, focal=(), unit=""):
    """One measure around a cycle of categories — hours, months, weekdays.

    Drawn as radial lollipops rather than filled wedges. A wedge's area grows
    with the square of its value, so a doubled value looks quadrupled; a
    stick's length is the value. Reach for this only when the categories are
    genuinely cyclic — otherwise a bar chart says the same thing and is
    easier to read.
    """
    if len(categories) > 8:
        raise ValueError("polar: %d categories; past 8 the labels overlap "
                         "around the ring" % len(categories))
    n = len(categories)
    top = max(values) or 1
    for k in (0.33, 0.66, 1.0):
        c.add(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r * k:.1f}" '
              f'fill="none" stroke="{c.t["grid"]}" stroke-width="1"/>')
    for i, (cat, v) in enumerate(zip(categories, values)):
        a = -math.pi / 2 + i * 2 * math.pi / n
        f = v / top
        ex, ey = cx + r * f * math.cos(a), cy + r * f * math.sin(a)
        hot = cat in focal
        colr = c.t["orange"] if hot else c.t["blue"]
        c.line(cx, cy, ex, ey, color=colr, sw=3 if hot else 2, marker=None)
        c.dot(ex, ey, 5 if hot else 4, colr)
        lx, ly = cx + (r + 22) * math.cos(a), cy + (r + 22) * math.sin(a)
        c.text(lx, ly + 4, cat, size=11.5,
               color=c.t["fg"] if hot else c.t["fg_dim"], family=SANS,
               weight=700 if hot else 400,
               anchor="middle" if abs(lx - cx) < r * 0.35
               else ("start" if lx > cx else "end"))
        c.text(lx, ly + 18, f"{v:,}{unit}", size=10, color=c.t["muted"],
               family=MONO,
               anchor="middle" if abs(lx - cx) < r * 0.35
               else ("start" if lx > cx else "end"))
    return (cx - r, cy - r, 2 * r, 2 * r)


BUILDERS.update({
    "entity": entity,
    "relate": relate,
    "linechart": linechart,
    "scatter": scatter,
    "polar": polar,
})


def _dogleg(x0, y0, x1, y1, lane, r=8):
    """Down, across, down — with the two corners rounded.

    A square corner is a different drawing convention from the rest of this
    kit, and mixing the two inside one document reads as two authors. The
    radius stays small enough that the corner is still a corner.
    """
    sx = 1 if x1 > x0 else -1
    sy = 1 if lane > y0 else -1
    ey = 1 if y1 > lane else -1
    return (f"M {x0:.1f} {y0:.1f} "
            f"L {x0:.1f} {lane - sy * r:.1f} "
            f"Q {x0:.1f} {lane:.1f} {x0 + sx * r:.1f} {lane:.1f} "
            f"L {x1 - sx * r:.1f} {lane:.1f} "
            f"Q {x1:.1f} {lane:.1f} {x1:.1f} {lane + ey * r:.1f} "
            f"L {x1:.1f} {y1:.1f}")

# ── state machine ──────────────────────────────────────────────────────────
def state(c, x, y, states, transitions, w=176, h=64, gap=64,
          row_gap=None, per_row=4, initial=0, terminal=(),
          cells=None):
    """States and what moves between them, with the guard on each arrow.

    `states` are (name, sub); `transitions` are (from, to, guard) and a
    transition whose two ends are the same state draws as a self-loop above
    it. The guard is not decoration — a transition without one says the
    machine changes state for no stated reason, which is the defect this type
    exists to expose.

    `initial` marks the entry state with a filled lead-in dot; `terminal`
    lists the states drawn with a double edge.

    `cells` places states by hand as (row, column) instead of filling rows
    left to right. Use it to put a terminal state directly under the state
    that reaches it: the transition is then a straight drop, and a straight
    drop is read as one step where an elbow is read as a detour.

    `gap` and `row_gap` are separate on purpose: the horizontal gap only has
    to hold an arrow, while the channel between two rows has to hold one lane
    per cross-row transition and each lane carries a guard. Sharing one value
    either crowds the guards or pushes the row off the board.
    """
    row_gap = gap + 16 if row_gap is None else row_gap
    if len(states) > 8:
        raise ValueError("state: %d states; past 8 the transitions cross "
                         "faster than a reader can follow — split the machine"
                         % len(states))
    boxes = []
    for i, (name, sub) in enumerate(states):
        if cells and i < len(cells) and cells[i] is not None:
            row_i, col_i = cells[i]
        else:
            row_i, col_i = i // per_row, i % per_row
        bx = x + col_i * (w + gap)
        by = y + row_i * (h + row_gap)
        term = i in terminal or name in terminal
        col = c.t["green"] if term else c.t["blue"]
        c.rrect(bx, by, w, h, rx=h / 2, fill=c.t["box"], stroke=col, sw=1.4)
        if term:
            c.rrect(bx + 4, by + 4, w - 8, h - 8, rx=(h - 8) / 2,
                    fill="none", stroke=col, sw=1)
        c.text(bx + w / 2, by + (h / 2 - 3 if sub else h / 2 + 4), name,
               size=13, color=c.t["fg"], family=SANS, weight=600,
               anchor="middle")
        if sub:
            c.text(bx + w / 2, by + h / 2 + 14, sub, size=11,
                   color=c.t["muted"], family=SANS, anchor="middle")
        boxes.append((bx, by, w, h))

    ib = boxes[initial]
    c.dot(ib[0] - 26, ib[1] + h / 2, 6, c.t["fg_dim"])
    c.line(ib[0] - 20, ib[1] + h / 2, ib[0], ib[1] + h / 2,
           color=c.t["fg_dim"], sw=1.4)

    # A state with two outgoing transitions has to send them from two points.
    # Leaving both from the centre of the bottom edge stacks the strokes for
    # their whole first leg, and only the last colour drawn survives there —
    # which is how a machine with two exits reads as a machine with one.
    down = {}
    for a, b, _g in transitions:
        if a != b and abs(boxes[a][1] - boxes[b][1]) >= 2:
            down.setdefault(a, []).append(b)
    into = {}
    for a, b, _g in transitions:
        if a != b and abs(boxes[a][1] - boxes[b][1]) >= 2:
            into.setdefault(b, []).append(a)
    exit_f, exit_lane, land_f = {}, {}, {}
    for a, targets in down.items():
        order = sorted(range(len(targets)), key=lambda k: boxes[targets[k]][0])
        for rank, k in enumerate(order):
            # 0.32 rather than 0.5 for a lone exit: the centre of one box's
            # bottom edge is also the centre of the box below it, so a drop
            # from one and an arrival at the other land on the same vertical
            # and print as a single line. Off-centre, they cannot collide by
            # coincidence.
            exit_f[(a, targets[k])] = 0.32 if len(targets) == 1 else \
                0.28 + 0.44 * rank / max(len(targets) - 1, 1)
            # 26px between lanes, not 16: each lane carries a guard, and a
            # guard's mask is 20px tall — lanes closer than that print the
            # two guards on top of each other.
            exit_lane[(a, targets[k])] = 26 + 26 * (len(targets) - 1 - rank)
    for b, sources in into.items():
        order = sorted(range(len(sources)), key=lambda k: boxes[sources[k]][0])
        for rank, k in enumerate(order):
            land_f[(sources[k], b)] = 0.62 if len(sources) == 1 else \
                0.34 + 0.32 * rank / max(len(sources) - 1, 1)
    # Where the two states share a column the drop is made straight: both ends
    # take the exit's fraction. Fanning them apart there throws away the one
    # thing a shared column buys — a plumb line the reader follows in a single
    # move, where an elbow reads as a detour.
    for key in list(land_f):
        if abs(boxes[key[0]][0] - boxes[key[1]][0]) < 2:
            land_f[key] = exit_f.get(key, 0.5)

    for a, b, guard in transitions:
        A, B = boxes[a], boxes[b]
        if a == b:
            cx0 = A[0] + A[2] / 2
            top = A[1]
            c.path(f"M {cx0 - 26:.1f} {top:.1f} "
                   f"C {cx0 - 26:.1f} {top - 40:.1f} "
                   f"{cx0 + 26:.1f} {top - 40:.1f} {cx0 + 26:.1f} {top:.1f}",
                   color=c.t["muted"], sw=1.4, marker="muted")
            c.edge_label(cx0, top - 34, guard, c.t["fg_dim"])
            continue
        same_row = abs(A[1] - B[1]) < 2
        if same_row and B[0] > A[0]:
            c.line(A[0] + A[2], A[1] + h / 2, B[0], B[1] + h / 2,
                   color=c.t["muted"], sw=1.4)
            # Above the row, not beside the arrow: the gap between two
            # states is narrower than a guard, so a label centred on the
            # arrow lands on the states either side of it.
            c.edge_label((A[0] + A[2] + B[0]) / 2, A[1] - 14, guard,
                         c.t["fg_dim"])
        elif same_row:
            lane = A[1] + h + 26
            c.path(_dogleg(A[0] + A[2] / 2, A[1] + h, B[0] + B[2] / 2,
                           B[1] + h, lane),
                   color=c.t["muted"], sw=1.2, dash="5 4", marker="muted")
            c.edge_label((A[0] + A[2] / 2 + B[0] + B[2] / 2) / 2, lane - 12,
                         guard, c.t["fg_dim"])
        else:
            f = exit_f.get((a, b), 0.32)
            lane = exit_lane.get((a, b), 26)
            ax = A[0] + A[2] * f
            bx = B[0] + B[2] * land_f.get((a, b), 0.62)
            if abs(ax - bx) < 2:
                # Straight down: no corner to round, and no lane needed.
                c.path(f"M {ax:.1f} {A[1] + h:.1f} L {ax:.1f} {B[1]:.1f}",
                       color=c.t["muted"], sw=1.4, marker="muted")
                c.edge_label(ax + 8 + tw(guard, 12, False) / 2 + 6,
                             (A[1] + h + B[1]) / 2, guard, c.t["fg_dim"])
            else:
                c.path(_dogleg(ax, A[1] + h, bx, B[1], B[1] - lane),
                       color=c.t["muted"], sw=1.4, marker="muted")
                c.edge_label((ax + bx) / 2, B[1] - lane - 12, guard,
                             c.t["fg_dim"])
    return boxes


# ── treemap ────────────────────────────────────────────────────────────────
def treemap(c, x, y, w, h, items, focal=(), unit=""):
    """Part of a whole where the relative sizes are the story.

    `items` are (label, value). Laid out by squarified slicing so the cells
    stay close to square: a long thin cell of the same area reads as smaller,
    which defeats the one thing this chart is for. Values are printed inside,
    because area alone is not readable to two significant figures and a
    reader who needs the number should not have to estimate it.
    """
    if len(items) > 8:
        raise ValueError("treemap: %d cells; past 8 the small ones cannot "
                         "hold their own labels" % len(items))
    items = sorted(items, key=lambda it: -it[1])
    total = sum(v for _, v in items) or 1
    # A treemap shows a part of a whole by area, so a part that rounds to
    # nothing has no area to be shown in. Below about 2% the cell is a sliver
    # that cannot hold its own name, and the figure then says only that the
    # largest item is large — which a bar chart says without pretending the
    # others were drawn.
    smallest = min(v for _, v in items)
    if smallest / total < 0.02:
        raise ValueError(
            "treemap: the smallest share is %.2f%% of the whole; below 2%% "
            "its cell cannot hold a label, so the figure shows one big "
            "rectangle and four slivers. Use bar() with a log-free scale, "
            "or group the tail into one 'others' cell first."
            % (smallest / total * 100))
    roles = ["blue", "teal", "purple", "cyan", "green", "yellow", "red",
             "orange"]
    # Squarified layout. The naive alternative — slice off one cell at a
    # time along the same axis — gives every cell the full height of the
    # rectangle, and a tall thin cell of a given area reads as smaller than a
    # square one of the same area. That defeats the only thing this chart is
    # for, so the row is grown only while the worst aspect ratio in it keeps
    # improving, and laid down the moment it stops.
    def _worst(row, side, scale):
        s2 = sum(row)
        if s2 <= 0 or side <= 0:
            return float("inf")
        thick = s2 * scale / side
        if thick <= 0:
            return float("inf")
        out = 0.0
        for v in row:
            length = v * scale / thick
            if length <= 0:
                return float("inf")
            out = max(out, side / length if side > length else length / side)
        return out

    cells = []
    rx, ry, rw, rh = x, y, w, h
    rest = list(items)
    while rest:
        left_val = sum(v for _, v in rest)
        if left_val <= 0 or rw <= 0 or rh <= 0:
            break
        scale = (rw * rh) / left_val
        side = min(rw, rh)
        row, row_vals = [], []
        for label, v in rest:
            trial = row_vals + [v]
            if row_vals and _worst(trial, side, scale) > _worst(row_vals, side,
                                                                scale):
                break
            row.append((label, v))
            row_vals.append(v)
        thick = sum(row_vals) * scale / side
        off = 0.0
        for label, v in row:
            part = (v * scale / thick) if thick else side
            if rw >= rh:                      # row runs down the left edge
                cells.append((rx, ry + off, thick, part, label, v))
            else:                             # row runs across the top edge
                cells.append((rx + off, ry, part, thick, label, v))
            off += part
        if rw >= rh:
            rx += thick
            rw -= thick
        else:
            ry += thick
            rh -= thick
        rest = rest[len(row):]

    for i, (cx0, cy0, cw, ch, label, v) in enumerate(cells):
        hot = label in focal
        col = c.t["orange"] if hot else c.t[roles[i % len(roles)]]
        c.rrect(cx0 + 1, cy0 + 1, cw - 2, ch - 2, rx=6, fill=col,
                stroke="none", sw=0, opacity=0.16)
        c.rrect(cx0 + 1, cy0 + 1, cw - 2, ch - 2, rx=6, fill="none",
                stroke=col, sw=1.4)
        if cw > 70 and ch > 46:
            c.text(cx0 + 12, cy0 + 24, label, size=12.5, color=c.t["fg"],
                   family=SANS, weight=700 if hot else 600)
            share = "" if unit.strip() == "%" else \
                f" · {v / total * 100:.0f}%"
            c.text(cx0 + 12, cy0 + 42, f"{v:,}{unit}{share}", size=11,
                   color=c.t["muted"], family=MONO)
        elif cw > tw(label, 11, False) + 20 and ch > 22:
            # Too short for both lines: the name alone still identifies the
            # cell, and the share is readable from the area beside its
            # neighbours. Dropping the name instead leaves a coloured blank.
            c.text(cx0 + 10, cy0 + ch / 2 + 4, label, size=11,
                   color=c.t["fg"], family=SANS, weight=600)
    return (x, y, w, h), cells


# ── sankey ─────────────────────────────────────────────────────────────────
def sankey(c, x, y, w, h, stages, flows, node_w=18, gap=14, unit=""):
    """A quantity splitting and merging across stages; band width = amount.

    `stages` is a list of stage node-name lists, left to right. `flows` are
    (from_name, to_name, value). The band is the whole point: it has to be
    drawn in proportion or the figure lies, so the node's height is the sum
    of what passes through it rather than anything chosen by hand.
    """
    n_nodes = sum(len(s) for s in stages)
    if len(stages) > 4 or n_nodes > 10 or len(flows) > 14:
        raise ValueError("sankey: %d stages / %d nodes / %d flows; past "
                         "4 / 10 / 14 the bands overlap into a braid"
                         % (len(stages), n_nodes, len(flows)))
    thru = {}
    for a, b, v in flows:
        thru[a] = thru.get(a, 0) + v
        thru[b] = thru.get(b, 0) + v
    for s in stages:
        for nm in s:
            thru.setdefault(nm, 0)
    scale = min((h - gap * (len(s) - 1)) / max(sum(thru[nm] for nm in s), 1)
                for s in stages)
    col_x = [x + i * (w - node_w) / max(len(stages) - 1, 1)
             for i in range(len(stages))]

    box, roles = {}, ["blue", "teal", "purple", "cyan", "green", "orange"]
    labels = []
    ri = 0
    for si, s in enumerate(stages):
        used = sum(thru[nm] * scale for nm in s) + gap * (len(s) - 1)
        cy = y + (h - used) / 2
        for nm in s:
            bh = max(thru[nm] * scale, 6)
            col = c.t[roles[ri % len(roles)]]
            ri += 1
            c.rrect(col_x[si], cy, node_w, bh, rx=4, fill=col, stroke="none",
                    sw=0)
            box[nm] = [col_x[si], cy, node_w, bh, cy, cy, col]
            labels.append([si, cy + bh / 2, nm, thru[nm]])
            cy += bh + gap

    # Names are placed after every node is sized. A node's height is its
    # throughput, so a small one is a thin band and two of them side by side
    # print their names on top of each other — the band already carries the
    # quantity, and the name is what tells the reader which band it is.
    for si in range(len(stages)):
        col = sorted((l for l in labels if l[0] == si), key=lambda l: l[1])
        for i in range(1, len(col)):
            if col[i][1] - col[i - 1][1] < 34:
                col[i][1] = col[i - 1][1] + 34
    for si, ly, nm, val in labels:
        side = "start" if si < len(stages) - 1 else "end"
        lx = col_x[si] + node_w + 8 if side == "start" else col_x[si] - 8
        c.text(lx, ly - 2, nm, size=12, color=c.t["fg"], family=SANS,
               weight=600, anchor=side)
        c.text(lx, ly + 14, f"{val:,}{unit}", size=10.5, color=c.t["muted"],
               family=MONO, anchor=side)

    for a, b, v in flows:
        A, B = box[a], box[b]
        t = v * scale
        ay0, by0 = A[5], B[4]
        A[5] += t
        B[4] += t
        x0, x1 = A[0] + A[2], B[0]
        cxm = (x0 + x1) / 2
        c.add(f'<path d="M {x0:.1f} {ay0:.1f} C {cxm:.1f} {ay0:.1f} '
              f'{cxm:.1f} {by0:.1f} {x1:.1f} {by0:.1f} '
              f'L {x1:.1f} {by0 + t:.1f} C {cxm:.1f} {by0 + t:.1f} '
              f'{cxm:.1f} {ay0 + t:.1f} {x0:.1f} {ay0 + t:.1f} Z" '
              f'fill="{A[6]}" fill-opacity="0.22" stroke="none"/>')
    return (x, y, w, h)


# ── fishbone ───────────────────────────────────────────────────────────────
def fishbone(c, x, y, w, h, effect, bones):
    """Causes of one observed effect, grouped by category.

    `bones` are (category, [causes]) placed alternately above and below the
    spine. The effect goes in the box at the head and is stated as something
    observed — 「적재 지연 3초」, not 「성능」 — because a category as the
    effect makes every cause fit and the analysis stops discriminating.
    """
    if len(bones) > 6:
        raise ValueError("fishbone: %d categories; past 6 the bones cross "
                         "the spine's labels" % len(bones))
    spine_y = y + h / 2
    head_w = max(tw(effect, 13.5, False) + 40, 180)
    c.line(x, spine_y, x + w - head_w - 10, spine_y, color=c.t["fg_dim"],
           sw=2)
    c.rrect(x + w - head_w, spine_y - 30, head_w, 60, rx=8, fill=c.t["box"],
            stroke=c.t["red"], sw=1.6)
    c.text(x + w - head_w / 2, spine_y + 5, effect, size=13.5,
           color=c.t["fg"], family=SANS, weight=700, anchor="middle")

    span = w - head_w - 60
    roles = ["blue", "teal", "purple", "cyan", "green", "orange"]
    for i, (cat, causes) in enumerate(bones):
        up = i % 2 == 0
        bx = x + 40 + (i + 0.5) * span / len(bones)
        tipy = spine_y - (h / 2 - 22) if up else spine_y + (h / 2 - 22)
        tipx = bx + (50 if up else -50)
        col = c.t[roles[i % len(roles)]]
        c.line(bx, spine_y, tipx, tipy, color=col, sw=1.6, marker=None)
        c.text(tipx, tipy + (-8 if up else 18), cat, size=12.5, color=col,
               family=SANS, weight=700, anchor="middle")
        for k, cause in enumerate(causes[:3]):
            f = 0.30 + k * 0.24
            px = bx + (tipx - bx) * f
            py = spine_y + (tipy - spine_y) * f
            c.line(px, py, px + 18, py, color=col, sw=1, marker=None)
            c.text(px + 24, py + 4, cause, size=11, color=c.t["fg_dim"],
                   family=SANS)
    return (x, y, w, h)


# ── wardley map ────────────────────────────────────────────────────────────
def wardley(c, x, y, w, h, components, links=(), moves=()):
    """Value chain against evolution — what to build, buy, and what is moving.

    `components` are (name, visibility 0..1, evolution 0..1); visibility is
    how close to the user it sits, evolution how settled the thing is. The
    two axes are the whole content: a component's position is a claim about
    build-versus-buy, so the four evolution bands are labelled and the reader
    can check the claim.
    """
    if len(components) > 9:
        raise ValueError("wardley: %d components; past 9 the value chain "
                         "stops being legible as a chain" % len(components))
    c.rrect(x, y, w, h, rx=8, fill=c.t["panel"], stroke=c.t["line"], sw=1)
    bands = ["창시", "맞춤 제작", "제품·임대", "상품·설비"]
    for i in range(1, 4):
        gx = x + w * i / 4
        c.line(gx, y, gx, y + h, color=c.t["grid"], sw=1, marker=None)
    for i, b in enumerate(bands):
        c.text(x + w * (i + 0.5) / 4, y + h + 20, b, size=11,
               color=c.t["muted"], family=SANS, anchor="middle")
    c.text(x + w / 2, y + h + 38, "진화 →", size=11.5, color=c.t["fg_dim"],
           family=SANS, weight=600, anchor="middle")
    c.text(x - 12, y + 12, "이용자에게 가까움", size=11.5,
           color=c.t["fg_dim"], family=SANS, weight=600, anchor="end")
    c.text(x - 12, y + h, "보이지 않음", size=11.5, color=c.t["muted"],
           family=SANS, anchor="end")

    pos = {}
    for name, vis, evo in components:
        px, py = x + evo * w, y + (1 - vis) * h
        pos[name] = (px, py)
    for a, b in links:
        c.line(pos[a][0], pos[a][1], pos[b][0], pos[b][1],
               color=c.t["line"], sw=1.2, marker=None)
    for name, (px, py) in pos.items():
        c.dot(px, py, 6, c.t["blue"])
        c.text(px + 12, py + 4, name, size=11.5, color=c.t["fg"],
               family=SANS)
    for name, to_evo in moves:
        px, py = pos[name]
        # Start past the component's own name. A movement arrow that begins
        # at the dot runs straight through the label, and the reader loses
        # both the name and where the thing is moving from.
        start = px + 12 + tw(name, 11.5, False) + 10
        end = x + to_evo * w
        if end - start < 24:
            start = px + 10
        c.line(start, py, end, py, color=c.t["orange"], sw=1.6, dash="5 4")
    return (x, y, w, h)


# ── user journey ───────────────────────────────────────────────────────────
def journey(c, x, y, w, h, stages, rows, pains=()):
    """What a person does across an experience, and how it feels.

    `stages` are the ordered stage names. `rows` are (row_name, [cell per
    stage]) — 행위, 접점, 생각 — and the last row is the feeling, given as
    numbers from -1 to 1, drawn as a line. `pains` names the stages to mark:
    the low points are what the work is for, so they are called out rather
    than left for the reader to find on the curve.
    """
    if len(stages) > 6 or len(rows) > 4:
        raise ValueError("journey: %d stages / %d rows; past 6 / 4 the cells "
                         "are too narrow to hold a sentence"
                         % (len(stages), len(rows)))
    label_w = 96
    col_w = (w - label_w) / len(stages)
    head_h = 34
    text_rows = [r for r in rows if not isinstance(r[1][0], (int, float))]
    feel = next((r for r in rows if isinstance(r[1][0], (int, float))), None)
    row_h = (h - head_h - (70 if feel else 0)) / max(len(text_rows), 1)

    for i, st in enumerate(stages):
        sx = x + label_w + i * col_w
        c.rrect(sx + 3, y, col_w - 6, head_h - 6, rx=6, fill=c.t["box_hi"],
                stroke=c.t["line"], sw=1)
        c.text(sx + col_w / 2, y + head_h - 16, st, size=12.5,
               color=c.t["fg"], family=SANS, weight=600, anchor="middle")
    for j, (name, cells) in enumerate(text_rows):
        ry = y + head_h + j * row_h
        c.text(x, ry + row_h / 2 + 4, name, size=12, color=c.t["fg_dim"],
               family=SANS, weight=600)
        for i, cell in enumerate(cells):
            sx = x + label_w + i * col_w
            c.text(sx + col_w / 2, ry + row_h / 2 + 4, cell, size=11.5,
                   color=c.t["muted"], family=SANS, anchor="middle")
        c.line(x, ry + row_h, x + w, ry + row_h, color=c.t["grid"], sw=0.8,
               marker=None)
    if feel:
        fy = y + head_h + len(text_rows) * row_h + 12
        c.text(x, fy + 28, feel[0], size=12, color=c.t["fg_dim"],
               family=SANS, weight=600)
        pts = [(x + label_w + (i + 0.5) * col_w, fy + 28 - v * 22)
               for i, v in enumerate(feel[1])]
        c.path(" ".join(f"{'M' if i == 0 else 'L'} {px:.1f} {py:.1f}"
                        for i, (px, py) in enumerate(pts)),
               color=c.t["purple"], sw=2, marker=None)
        for i, (px, py) in enumerate(pts):
            hot = stages[i] in pains
            c.dot(px, py, 6 if hot else 4,
                  c.t["red"] if hot else c.t["purple"])
    return (x, y, w, h)


# ── IT current-state ───────────────────────────────────────────────────────
def itstate(c, x, y, w, groups, box_h=64, gap=16, head_h=30, group_gap=20):
    """The landscape as it stands today, grouped by owner or phase.

    `groups` are (group_name, note, [(system, note, status)]) where status is
    `keep`, `replace` or `retire`. This is the *before* picture in a
    modernisation proposal, so status is the content: a landscape drawn
    without it says only that the systems exist, which the reader knew.
    """
    style = {"keep": ("green", None), "replace": ("orange", None),
             "retire": ("red", "4 4")}
    cy = y
    for name, note, systems in groups:
        cols = max(len(systems), 1)
        gh = head_h + box_h + 16
        c.rrect(x, cy, w, gh, rx=8, fill=c.t["panel"], stroke=c.t["line"],
                sw=0.8)
        c.text(x + 14, cy + 20, name, size=12.5, color=c.t["fg"],
               family=SANS, weight=700)
        if note:
            c.text(x + w - 14, cy + 20, note, size=11, color=c.t["muted"],
                   family=SANS, anchor="end")
        bw = (w - 28 - (cols - 1) * gap) / cols
        for i, (sysname, sysnote, status) in enumerate(systems):
            role, dash = style.get(status, ("blue", None))
            bx = x + 14 + i * (bw + gap)
            by = cy + head_h
            c.rrect(bx, by, bw, box_h, rx=6, fill=c.t["box"],
                    stroke=c.t[role], sw=1.4, dash=dash)
            c.text(bx + bw / 2, by + (box_h / 2 - 3 if sysnote
                                      else box_h / 2 + 4), sysname, size=12.5,
                   color=c.t["fg"], family=SANS, weight=600, anchor="middle")
            if sysnote:
                c.text(bx + bw / 2, by + box_h / 2 + 14, sysnote, size=11,
                       color=c.t["muted"], family=SANS, anchor="middle")
        cy += gh + group_gap
    return (x, y, w, cy - group_gap - y)


BUILDERS.update({
    "state": state,
    "treemap": treemap,
    "sankey": sankey,
    "fishbone": fishbone,
    "wardley": wardley,
    "journey": journey,
    "itstate": itstate,
})
