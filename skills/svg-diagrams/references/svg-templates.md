# Hand-Crafted SVG Templates

Hand-crafted SVG is a first-class technique for precise architecture/flow diagrams — often the default. Use these XML templates for copy-paste authoring, or import `scripts/svgkit.py` for a programmatic builder (glyph-width box sizing, perpendicular orthogonal connectors, safe markers). All templates use the **Tokyo Night** palette; canonical primary text is `#c0caf5`.

> Pick ONE convention per file: these templates use a single marker `id="ah"`; `svgkit.py` uses per-color `arr-<name>` markers. Do not mix the two in one SVG.

## Contents

- Common SVG Header
- Color Palette (subgroup borders, pipeline-stage fills)
- SVG Elements (subgroup, node, colored node, edges)
- Waveform / Curve Drawing
- Layout Rules

## Common SVG Header

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" width="{WIDTH}" height="{HEIGHT}"
     style="--bg:#1a1b26;--fg:#c0caf5;--line:#3d59a1;--accent:#7aa2f7;--muted:#565f89;background:var(--bg)">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;display=swap');
  text { font-family: 'Inter', system-ui, sans-serif; }
  svg {
    --_text:        var(--fg);
    --_text-sec:    var(--muted);
    --_line:        var(--line);
    --_arrow:       var(--accent);
    --_node-fill:   color-mix(in srgb, var(--fg) 5%, var(--bg));
    --_node-stroke: color-mix(in srgb, var(--fg) 20%, var(--bg));
    --_group-fill:  var(--bg);
    --_group-hdr:   color-mix(in srgb, var(--fg) 6%, var(--bg));
    --_inner-stroke:color-mix(in srgb, var(--fg) 12%, var(--bg));
  }
</style>
<defs>
  <marker id="ah" markerWidth="8" markerHeight="5" refX="7" refY="2.5" orient="auto">
    <polygon points="0 0, 8 2.5, 0 5" fill="var(--_arrow)" stroke="var(--_arrow)" stroke-width="0.75" stroke-linejoin="round"/>
  </marker>
</defs>
```

## Color Palette

### Subgroup (border) colors by domain

| Domain | Color | Hex |
|--------|-------|-----|
| Infrastructure / Network | blue | `#7aa2f7` |
| Orchestration / Gateway | purple | `#bb9af7` |
| Native / Low-level | red | `#f7768e` |
| Application / Logic | green | `#9ece6a` |
| Storage / Database | gold | `#e0af68` |
| External / Client | teal | `#73daca` |
| Security / Auth | magenta | `#ff007c` |
| Monitoring / Observability | cyan | `#7dcfff` |

### Pipeline stage (fill) colors

| Stage | Color | Hex |
|-------|-------|-----|
| Input / Source | red | `#f7768e` |
| Processing / Parse | purple | `#bb9af7` |
| Data Record / DTO | blue | `#7aa2f7` |
| Queue / Buffer | gold | `#e0af68` |
| Mapping / Convert | green | `#9ece6a` |
| Output / Storage | teal | `#73daca` |
| Error / Reject | dark-red | `#db4b4b` |
| Cache / Lookup | cyan | `#7dcfff` |

※ `#e0af68` is named "gold" in these tables; the svgkit accessor for the same
color is `c.yellow` (there is no `c.gold`).

## SVG Elements

### Subgroup (Layer Box)

```xml
<g class="subgraph">
  <rect x="{X}" y="{Y}" width="{W}" height="{H}" rx="4"
        fill="var(--_group-fill)" stroke="{BORDER_COLOR}" stroke-width="1.2"/>
  <rect x="{X}" y="{Y}" width="{W}" height="26" rx="4"
        fill="var(--_group-hdr)" stroke="{BORDER_COLOR}" stroke-width="1.2"/>
  <text x="{X+12}" y="{Y+18}" font-size="11" font-weight="600"
        fill="{BORDER_COLOR}">{LABEL}</text>
</g>
```

### Node (1-2 lines)

```xml
<!-- Single-line -->
<g class="node">
  <rect x="{X}" y="{Y}" width="{W}" height="38" rx="3"
        fill="var(--_node-fill)" stroke="var(--_node-stroke)" stroke-width="0.75"/>
  <text x="{CX}" y="{Y+24}" text-anchor="middle" font-size="13"
        font-weight="500" fill="var(--_text)">{LABEL}</text>
</g>

<!-- Two-line -->
<g class="node">
  <rect x="{X}" y="{Y}" width="{W}" height="54" rx="3"
        fill="var(--_node-fill)" stroke="var(--_node-stroke)" stroke-width="0.75"/>
  <text x="{CX}" y="{Y+22}" text-anchor="middle" font-size="13"
        font-weight="500" fill="var(--_text)">{TITLE}</text>
  <text x="{CX}" y="{Y+40}" text-anchor="middle" font-size="11"
        fill="var(--_text-sec)">{SUBTITLE}</text>
</g>
```

### Colored Node (pipeline stage)

```xml
<g class="node">
  <rect x="{X}" y="{Y}" width="{W}" height="54" rx="3"
        fill="{COLOR}" stroke="{COLOR}" stroke-width="0.75"/>
  <text x="{CX}" y="{Y+22}" text-anchor="middle" font-size="13"
        font-weight="500" fill="#1a1b26">{TITLE}</text>
  <text x="{CX}" y="{Y+40}" text-anchor="middle" font-size="11"
        fill="#1a1b26" opacity="0.7">{SUBTITLE}</text>
</g>
```

### Edges

```xml
<!-- Straight vertical -->
<line x1="{X}" y1="{Y1}" x2="{X}" y2="{Y2}"
      stroke="var(--_line)" stroke-width="1" marker-end="url(#ah)"/>

<!-- Straight horizontal -->
<line x1="{X1}" y1="{Y}" x2="{X2}" y2="{Y}"
      stroke="var(--_line)" stroke-width="1" marker-end="url(#ah)"/>

<!-- L-shaped (3 segments) -->
<line x1="{X1}" y1="{Y1}" x2="{X1}" y2="{YM}" stroke="var(--_line)" stroke-width="1"/>
<line x1="{X1}" y1="{YM}" x2="{X2}" y2="{YM}" stroke="var(--_line)" stroke-width="1"/>
<line x1="{X2}" y1="{YM}" x2="{X2}" y2="{Y2}" stroke="var(--_line)" stroke-width="1" marker-end="url(#ah)"/>

<!-- Edge label -->
<rect x="{LX}" y="{LY}" width="{LW}" height="20" rx="2"
      fill="var(--bg)" stroke="var(--_inner-stroke)" stroke-width="0.75"/>
<text x="{LCX}" y="{LY+14}" text-anchor="middle" font-size="10"
      fill="var(--_text-sec)">{LABEL}</text>
```

## Waveform / Curve Drawing

### Sine Wave — Use `<polyline>`, NOT `<path>` Bezier

SVG `<path>` Bezier curves (`C` command) produce **asymmetric, visually wrong** sine waves because control points are extremely difficult to calculate correctly for trigonometric curves. Always use `<polyline>` with mathematically computed points.

**Formula (20 points per cycle for smooth curve):**

```
x = startX + i * stepX          (stepX = periodWidth / 20)
y = centerY - amplitude * sin(i * 18deg)   (18deg = 360deg / 20)
```

**Pre-computed sin values (memorize or copy):**

```
i=0:  sin=0.000   i=5:  sin=1.000   i=10: sin=0.000   i=15: sin=-1.000
i=1:  sin=0.309   i=6:  sin=0.951   i=11: sin=-0.309  i=16: sin=-0.951
i=2:  sin=0.588   i=7:  sin=0.809   i=12: sin=-0.588  i=17: sin=-0.809
i=3:  sin=0.809   i=8:  sin=0.588   i=13: sin=-0.809  i=18: sin=-0.588
i=4:  sin=0.951   i=9:  sin=0.309   i=14: sin=-0.951  i=19: sin=-0.309
i=20: sin=0.000
```

**Example (1 cycle, x=[80,440], centerY=170, amplitude=50):**

```xml
<!-- stepX = (440-80)/20 = 18px -->
<polyline points="80,170 98,155 116,141 134,130 152,122 170,120 188,122 206,130 224,141 242,155 260,170 278,185 296,199 314,210 332,218 350,220 368,218 386,210 404,199 422,185 440,170"
          stroke="#9ece6a" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
```

**Multi-cycle:** Repeat the point calculation for each cycle. Use separate `<polyline>` elements per cycle for clarity.

**Partial highlighting:** Draw the full wave in a dim color, then overlay the highlighted portion with a brighter, thicker stroke:

```xml
<!-- Full wave (dim) -->
<polyline points="..." stroke="#565f89" stroke-width="1.5" fill="none"/>
<!-- Highlighted portion (bright) -->
<polyline points="80,170 98,155 116,141 134,130 152,122"
          stroke="#f7768e" stroke-width="3.5" fill="none"/>
```

**Packet loss gap:** Use a dashed-border rect over the gap region:

```xml
<rect x="220" y="740" width="60" height="50" rx="2"
      fill="color-mix(in srgb, #f7768e 15%, var(--bg))"
      stroke="#f7768e" stroke-width="0.75" stroke-dasharray="3,2"/>
<text x="250" y="770" text-anchor="middle" font-size="9" fill="#f7768e">10 lost</text>
```

### Common Pitfalls

1. **Never use `<path>` Bezier for sine waves** — control points produce asymmetric curves
2. **When iteratively editing SVG, always remove old elements** — overlapping old/new paths create ghost artifacts
3. **20 points per cycle is the minimum** for visually smooth curves at typical SVG sizes (200-400px per cycle)
4. **Axis labels (0V, +Vpk, -Vpk)** should use `text-anchor="end"` and be placed left of the y-axis
5. **Window brackets** (measurement indicators) use 3 lines: left vertical + horizontal + right vertical

## Layout Rules

1. No emojis in labels
2. Inter font via Google Fonts import
3. rx="3" for nodes, rx="4" for subgroups
4. stroke-width: 0.75 (nodes), 1 (inner subgroups), 1.2 (outer subgroups)
5. font-size: 13 (titles), 11 (subtitles/labels), 10 (edge labels)
6. Always `marker-end="url(#ah)"` on the last arrow segment
7. Use `<line>` not `<polyline>` for clean paths
8. Vertically stacked nodes share identical x and width
9. Prefer horizontal layout when subgroup width / node count > 160px
10. Minimum 40px gap between connected nodes for bend visibility
11. Outer subgroup height must include all arrow bend paths (bottom + 30px margin)
12. Emit subgroup/frame rects BEFORE the node rects they enclose — document order is z-order, and a frame written after its nodes paints over them
13. Size boxes for CJK text at ~1 em per Hangul/Kana/CJK glyph (Latin ≈ 0.55 em); a width tuned for a Latin label clips its Korean/Japanese counterpart
