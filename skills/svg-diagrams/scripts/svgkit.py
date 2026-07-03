"""Themed SVG toolkit for architecture diagrams (default theme: Tokyo Night).

Pure stdlib. Coordinate math + glyph-width-based box sizing so text never
overflows. Pick a theme per canvas: Canvas(w, h, theme="nord"). Chrome colors
(bg/panel/box/line/muted/fg) resolve from the theme automatically; pass accent
colors via c.blue / c.green / ... so a diagram re-themes by changing one arg.
"""
import math

# --- Themes: each is role -> hex (18 roles) --------------------------------
THEMES = {
    "tokyo-night": {
        "bg": "#1a1b26", "bg_deep": "#16161e", "panel": "#1f2335",
        "box": "#24283b", "box_hi": "#292e42", "line": "#3b4261",
        "grid": "#2a2e3f", "muted": "#565f89", "fg": "#c0caf5",
        "fg_dim": "#a9b1d6", "blue": "#7aa2f7", "cyan": "#7dcfff",
        "teal": "#73daca", "green": "#9ece6a", "purple": "#bb9af7",
        "red": "#f7768e", "orange": "#ff9e64", "yellow": "#e0af68",
    },
    "nord": {
        "bg": "#2e3440", "bg_deep": "#272c36", "panel": "#2f3645",
        "box": "#3b4252", "box_hi": "#434c5e", "line": "#4c566a",
        "grid": "#353c4a", "muted": "#7b88a1", "fg": "#eceff4",
        "fg_dim": "#d8dee9", "blue": "#81a1c1", "cyan": "#88c0d0",
        "teal": "#8fbcbb", "green": "#a3be8c", "purple": "#b48ead",
        "red": "#bf616a", "orange": "#d08770", "yellow": "#ebcb8b",
    },
    "catppuccin": {
        "bg": "#1e1e2e", "bg_deep": "#181825", "panel": "#232634",
        "box": "#313244", "box_hi": "#45475a", "line": "#585b70",
        "grid": "#2a2b3c", "muted": "#7f849c", "fg": "#cdd6f4",
        "fg_dim": "#bac2de", "blue": "#89b4fa", "cyan": "#89dceb",
        "teal": "#94e2d5", "green": "#a6e3a1", "purple": "#cba6f7",
        "red": "#f38ba8", "orange": "#fab387", "yellow": "#f9e2af",
    },
    "gruvbox": {
        "bg": "#282828", "bg_deep": "#1d2021", "panel": "#32302f",
        "box": "#3c3836", "box_hi": "#504945", "line": "#665c54",
        "grid": "#353231", "muted": "#928374", "fg": "#ebdbb2",
        "fg_dim": "#d5c4a1", "blue": "#83a598", "cyan": "#8ec07c",
        "teal": "#689d6a", "green": "#b8bb26", "purple": "#d3869b",
        "red": "#fb4934", "orange": "#fe8019", "yellow": "#fabd2f",
    },
    "one-dark": {
        "bg": "#282c34", "bg_deep": "#21252b", "panel": "#2c313a",
        "box": "#333842", "box_hi": "#3e4451", "line": "#4b5263",
        "grid": "#2d323b", "muted": "#5c6370", "fg": "#abb2bf",
        "fg_dim": "#9da5b4", "blue": "#61afef", "cyan": "#56b6c2",
        "teal": "#48b0a0", "green": "#98c379", "purple": "#c678dd",
        "red": "#e06c75", "orange": "#d19a66", "yellow": "#e5c07b",
    },
}
DEFAULT_THEME = "tokyo-night"

# Accent roles (caller-facing) and arrowhead marker order (do not reorder —
# keeps marker output stable). The "fg" marker uses the fg_dim color.
_ACCENTS = ("blue", "cyan", "teal", "green", "purple", "red", "orange", "yellow")
_ARROW_ROLES = ["blue", "green", "orange", "purple", "cyan", "teal", "red",
                "muted", "fg", "yellow"]
_ARROW_NAMES = set(_ARROW_ROLES)

# --- Module-level Tokyo Night constants (backward compatible imports) -------
_T = THEMES[DEFAULT_THEME]
BG, BG_DEEP, PANEL = _T["bg"], _T["bg_deep"], _T["panel"]
BOX, BOX_HI, LINE = _T["box"], _T["box_hi"], _T["line"]
GRID, MUTED, FG, FG_DIM = _T["grid"], _T["muted"], _T["fg"], _T["fg_dim"]
BLUE, CYAN, TEAL = _T["blue"], _T["cyan"], _T["teal"]
GREEN, PURPLE, RED = _T["green"], _T["purple"], _T["red"]
ORANGE, YELLOW = _T["orange"], _T["yellow"]

SANS = "'Inter','SF Pro Display',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"
MONO = "'JetBrains Mono','SF Mono',ui-monospace,Menlo,'DejaVu Sans Mono',monospace"

_DEF = object()  # sentinel: "resolve from the canvas theme"


def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def _is_wide(ch):
    """True for CJK / fullwidth glyphs that render ~1 em wide (Hangul, Kana,
    CJK ideographs, fullwidth forms). Latin/Arabic-digit glyphs are ~half-em."""
    o = ord(ch)
    return (0x1100 <= o <= 0x11FF      # Hangul Jamo
            or 0x3000 <= o <= 0x303F   # CJK symbols/punctuation
            or 0x3040 <= o <= 0x30FF   # Hiragana + Katakana
            or 0x3130 <= o <= 0x318F   # Hangul compatibility Jamo
            or 0x31F0 <= o <= 0x31FF   # Katakana phonetic extensions
            or 0x3200 <= o <= 0x33FF   # enclosed CJK + CJK compatibility
            or 0x3400 <= o <= 0x4DBF   # CJK ext A
            or 0x4E00 <= o <= 0x9FFF   # CJK unified ideographs
            or 0xA960 <= o <= 0xA97F   # Hangul Jamo extended-A
            or 0xAC00 <= o <= 0xD7A3   # Hangul syllables
            or 0xD7B0 <= o <= 0xD7FF   # Hangul Jamo extended-B
            or 0xF900 <= o <= 0xFAFF   # CJK compatibility ideographs
            or 0xFF00 <= o <= 0xFFEF   # fullwidth / halfwidth forms
            or 0x20000 <= o <= 0x3FFFD)  # CJK ext B+ (astral ideographs)


def tw(s, size, mono=True):
    """Estimated text width in px, CJK-aware.

    Latin glyphs are ~0.55-0.60 em; CJK/fullwidth glyphs render ~1 em wide.
    Undercounting CJK is the classic cause of Korean/Japanese text overflowing
    its box or chip, so wide glyphs are measured at ~1.03 em regardless of the
    mono flag.
    """
    k = 0.60 if mono else 0.535
    wide = sum(1 for ch in s if _is_wide(ch))
    return ((len(s) - wide) * k + wide * 1.03) * size


def row_positions(left, right, n, gap):
    """Evenly spaced column x-positions across [left, right] for n boxes.

    Returns (xs, width). Use for a row of cards/nodes joined by arrows.
    """
    w = (right - left - (n - 1) * gap) / n
    return [left + i * (w + gap) for i in range(n)], w


def edge_pt(box, side, f=0.5):
    """Point on a box edge for connector endpoints.

    box is the (x, y, w, h) tuple returned by node()/card-placement code;
    side is 'L' 'R' 'T' 'B' ('U'/'D' accepted as aliases so ortho()'s
    direction vocabulary also works); f slides along the edge (0..1, default
    middle). Feeding these into ortho() keeps arrows perpendicular to the
    edge they enter, which is what the lint's OBLIQUE-ARROW check demands.
    """
    x, y, w, h = box[:4]
    side = {"U": "T", "D": "B"}.get(side, side)
    if side == "L":
        return (x, y + h * f)
    if side == "R":
        return (x + w, y + h * f)
    if side == "T":
        return (x + w * f, y)
    if side == "B":
        return (x + w * f, y + h)
    raise ValueError(f"edge_pt side must be L/R/T/B (or U/D), got {side!r}")


class Canvas:
    def __init__(self, w, h, theme=DEFAULT_THEME, bg=None):
        if theme not in THEMES:
            raise ValueError(
                f"unknown theme '{theme}'; choose from {sorted(THEMES)}")
        self.w, self.h = w, h
        self.theme_name = theme
        self.t = dict(THEMES[theme])           # full palette dict
        # accent colors as attributes: c.blue, c.green, ... (chrome via c.t[*])
        for role in _ACCENTS:
            setattr(self, role, self.t[role])
        self.bg = bg or self.t["bg"]
        self.body = []
        # underlay layer: (area, markup) entries rendered BEFORE body and
        # sorted by area descending, so group frames land behind nodes and
        # outer frames land behind inner ones — z-order never depends on
        # call order (a frame drawn after its content used to paint over it)
        self.under = []
        # theme-specific color -> marker-name map (so marker=c.blue resolves)
        self._c2m = {self.t[a]: a for a in _ACCENTS}
        self._c2m[self.t["muted"]] = "muted"
        self._c2m[self.t["fg_dim"]] = "fg"

    def add(self, s):
        self.body.append(s)

    def _mk(self, marker):
        """Resolve a marker arg to a defined marker name. Accepts a role name
        ('blue') or a theme color value (c.blue) — never a dead url(#arr-<hex>).
        """
        if marker in _ARROW_NAMES:
            return marker
        return self._c2m.get(marker, "muted")

    # -- primitives ---------------------------------------------------------
    def rrect(self, x, y, w, h, rx=10, fill=_DEF, stroke=_DEF, sw=1.5,
              shadow=False, dash=None, opacity=None):
        fill = self.t["box"] if fill is _DEF else fill
        stroke = self.t["line"] if stroke is _DEF else stroke
        a = [f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}"',
             f'rx="{rx}" fill="{fill}"']
        if stroke:
            a.append(f'stroke="{stroke}" stroke-width="{sw}"')
        if dash:
            a.append(f'stroke-dasharray="{dash}"')
        if opacity is not None:
            a.append(f'opacity="{opacity}"')
        if shadow:
            a.append('filter="url(#soft)"')
        self.add(" ".join(a) + "/>")

    def text(self, x, y, s, size=14, color=_DEF, family=MONO, weight=400,
             anchor="start", spacing=None, opacity=None):
        color = self.t["fg"] if color is _DEF else color
        a = [f'<text x="{x:.1f}" y="{y:.1f}" font-family="{family}"',
             f'font-size="{size}" fill="{color}" font-weight="{weight}"',
             f'text-anchor="{anchor}"']
        if spacing:
            a.append(f'letter-spacing="{spacing}"')
        if opacity is not None:
            a.append(f'opacity="{opacity}"')
        self.add(" ".join(a) + f'>{esc(s)}</text>')

    def line(self, x1, y1, x2, y2, color=_DEF, sw=2, dash=None, marker="muted"):
        color = self.t["muted"] if color is _DEF else color
        a = [f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}"',
             f'stroke="{color}" stroke-width="{sw}" stroke-linecap="round"']
        if dash:
            a.append(f'stroke-dasharray="{dash}"')
        if marker:
            a.append(f'marker-end="url(#arr-{self._mk(marker)})"')
        self.add(" ".join(a) + "/>")

    def path(self, d, color=_DEF, sw=2, dash=None, marker="muted", fill="none"):
        color = self.t["muted"] if color is _DEF else color
        a = [f'<path d="{d}" fill="{fill}" stroke="{color}" stroke-width="{sw}"',
             'stroke-linecap="round" stroke-linejoin="round"']
        if dash:
            a.append(f'stroke-dasharray="{dash}"')
        if marker:
            a.append(f'marker-end="url(#arr-{self._mk(marker)})"')
        self.add(" ".join(a) + "/>")

    def elbow(self, x1, y1, x2, y2, color=_DEF, sw=2, marker="muted",
              r=10, via="hv", dash=None):
        """Rounded elbow. via='hv' (horiz then vert) or 'vh'."""
        if via == "vh":
            midy = y2
            d = (f"M {x1:.1f} {y1:.1f} V {midy - (r if y2 > y1 else -r):.1f} "
                 f"Q {x1:.1f} {midy:.1f} {x1 + (r if x2 > x1 else -r):.1f} {midy:.1f} "
                 f"H {x2:.1f}")
        else:
            midx = x2
            d = (f"M {x1:.1f} {y1:.1f} H {midx - (r if x2 > x1 else -r):.1f} "
                 f"Q {midx:.1f} {y1:.1f} {midx:.1f} {y1 + (r if y2 > y1 else -r):.1f} "
                 f"V {y2:.1f}")
        self.path(d, color=color, sw=sw, marker=marker, dash=dash)

    def bez(self, x1, y1, x2, y2, color=_DEF, sw=2, marker="muted",
            bow=0.45, dash=None):
        """Horizontal-ish cubic bezier between two points.

        Both control points sit at the endpoints' y, so the curve arrives
        horizontally — only valid when entering a vertical (left/right) edge.
        For top/bottom entry use ortho(); for any box edge ortho() is safest.
        """
        dx = (x2 - x1) * bow
        d = (f"M {x1:.1f} {y1:.1f} "
             f"C {x1 + dx:.1f} {y1:.1f} {x2 - dx:.1f} {y2:.1f} {x2:.1f} {y2:.1f}")
        self.path(d, color=color, sw=sw, marker=marker, dash=dash)

    @staticmethod
    def _rounded_poly(pts, r):
        """Path through orthogonal waypoints with rounded corners."""
        if len(pts) < 2:
            return ""
        d = f"M {pts[0][0]:.1f} {pts[0][1]:.1f}"
        for i in range(1, len(pts) - 1):
            x0, y0 = pts[i - 1]
            x1, y1 = pts[i]
            x2, y2 = pts[i + 1]
            l1 = math.hypot(x1 - x0, y1 - y0) or 1
            l2 = math.hypot(x2 - x1, y2 - y1) or 1
            rr = min(r, l1 / 2, l2 / 2)
            ax = x1 - (x1 - x0) / l1 * rr
            ay = y1 - (y1 - y0) / l1 * rr
            bx = x1 + (x2 - x1) / l2 * rr
            by = y1 + (y2 - y1) / l2 * rr
            d += (f" L {ax:.1f} {ay:.1f} Q {x1:.1f} {y1:.1f} "
                  f"{bx:.1f} {by:.1f}")
        d += f" L {pts[-1][0]:.1f} {pts[-1][1]:.1f}"
        return d

    def ortho(self, x1, y1, x2, y2, exit="R", entry="L", color=_DEF, sw=2,
              marker="muted", dash=None, lane=None, r=10):
        """Manhattan connector whose FINAL segment is perpendicular to the
        target edge (axis-aligned), so the arrowhead meets the box at 90deg.

        exit/entry are sides: 'R' 'L' 'U' 'D'. lane overrides the bend
        coordinate (x for side-to-side, y for vertical-to-vertical).
        """
        pts = [(x1, y1)]
        if exit in "RL" and entry in "RL":          # side -> side
            lx = lane if lane is not None else (x1 + x2) / 2
            pts += [(lx, y1), (lx, y2), (x2, y2)]
        elif exit in "UD" and entry in "UD":        # vert -> vert
            ly = lane if lane is not None else (y1 + y2) / 2
            pts += [(x1, ly), (x2, ly), (x2, y2)]
        elif exit in "RL" and entry in "UD":        # side then into top/bottom
            pts += [(x2, y1), (x2, y2)]
        else:                                       # vert then into side
            pts += [(x1, y2), (x2, y2)]
        self.path(self._rounded_poly(pts, r), color=color, sw=sw,
                  marker=marker, dash=dash)

    def dot(self, x, y, r, color):
        self.add(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{color}"/>')

    # -- composites ---------------------------------------------------------
    def chip(self, x, y, label, color=_DEF, fill=_DEF, size=12.5,
             mono=True, pad=11, h=24, dot=None, weight=500):
        color = self.t["fg_dim"] if color is _DEF else color
        fill = self.t["box_hi"] if fill is _DEF else fill
        fam = MONO if mono else SANS
        w = tw(label, size, mono) + pad * 2 + (14 if dot else 0)
        self.rrect(x, y, w, h, rx=h / 2, fill=fill, stroke=self.t["line"], sw=1)
        tx = x + pad
        if dot:
            self.dot(x + pad + 3, y + h / 2, 3.5, dot)
            tx = x + pad + 14
        self.text(tx, y + h / 2 + size * 0.35, label, size=size, color=color,
                  family=fam, weight=weight)
        return w

    def group_frame(self, x, y, w, h, label, accent, sub=None, dashed=True,
                    underlay=True):
        """Dashed boundary panel with a legend chip.

        Drawn on the underlay layer by default, so it renders BEHIND nodes
        and behind any smaller (nested) frame, whatever the call order —
        underlay entries are sorted by area at render time. Pass
        underlay=False only when the frame must sit on top of everything.
        """
        sink = [] if underlay else self.body
        saved, self.body = self.body, sink
        try:
            # panel
            self.rrect(x, y, w, h, rx=16, fill=self.t["panel"], stroke=accent,
                       sw=1.6, dash="2 7" if dashed else None, opacity=1)
            # faint inner wash
            self.rrect(x, y, w, h, rx=16, fill=accent, stroke=None,
                       opacity=0.035)
            # legend chip straddling the top border; label + optional sub both
            # sit INSIDE the chip background (never on the dashed border line)
            size = 14
            lab_w = tw(label, size, mono=False)
            sub_w = (tw(sub, 12, mono=True) + 16) if sub else 0
            chip_w = 26 + lab_w + sub_w + 16
            self.rrect(x + 22, y - 15, chip_w, 30, rx=8, fill=self.t["bg"],
                       stroke=accent, sw=1.5)
            self.dot(x + 22 + 15, y, 4, accent)
            self.text(x + 22 + 26, y + 5, label, size=size,
                      color=self.t["fg"], family=SANS, weight=600)
            if sub:
                self.text(x + 22 + 26 + lab_w + 14, y + 5, sub, size=12,
                          color=self.t["muted"], family=MONO)
        finally:
            self.body = saved
        if underlay:
            # committed as one atomic entry: an exception above leaves no
            # half-drawn frame behind, and render() can sort whole frames
            self.under.append((w * h, "".join(sink)))

    def node(self, x, y, w, h, accent, label, sub=None, size=15.5,
             fill=_DEF, shadow=True):
        """Flow/state node: role-colored border, centered mono label,
        optional muted subtitle. Returns (x, y, w, h) for edge_pt().

        Prefer this over card() for state machines and flow diagrams —
        centered labels read as states/steps, while card() (top-left title,
        badge, body lines) reads as a component/spec box.
        """
        fill = self.t["box"] if fill is _DEF else fill
        self.rrect(x, y, w, h, rx=10, fill=fill, stroke=accent, sw=1.8,
                   shadow=shadow)
        cx = x + w / 2
        if sub:
            self.text(cx, y + h / 2 - 6, label, size=size, color=self.t["fg"],
                      family=MONO, weight=700, anchor="middle")
            self.text(cx, y + h / 2 + 12, sub, size=11, color=self.t["muted"],
                      family=SANS, anchor="middle")
        else:
            self.text(cx, y + h / 2 + size * 0.35, label, size=size,
                      color=self.t["fg"], family=MONO, weight=700,
                      anchor="middle")
        return (x, y, w, h)

    def edge_label(self, x, y, s, color=_DEF, size=12, mono=False, pill=True,
                   weight=600):
        """Free-floating connector label, centered on (x, y), with a subtle
        background pill sized from CJK-aware tw().

        The pill hides crossing LINES only — it does not license parking the
        label on a box (the lint flags that as LABEL-OCCLUSION). Place at an
        edge midpoint in open space, or move to the clear band above/below
        the arrow when the gap between boxes is narrow.
        """
        color = self.t["fg_dim"] if color is _DEF else color
        fam = MONO if mono else SANS
        w = tw(s, size, mono) + 16
        if pill:
            self.rrect(x - w / 2, y - size * 0.9, w, size * 1.7, rx=6,
                       fill=self.t["bg_deep"], stroke=self.t["line"], sw=1,
                       opacity=0.96)
        self.text(x, y + size * 0.34, s, size=size, color=color, family=fam,
                  weight=weight, anchor="middle")

    def card(self, x, y, w, h, accent, badge=None, title=None, lines=None,
             title_size=17, fill=_DEF, body_color=_DEF, shadow=True,
             dash=None):
        fill = self.t["box"] if fill is _DEF else fill
        body_color = self.t["fg_dim"] if body_color is _DEF else body_color
        self.rrect(x, y, w, h, rx=11, fill=fill, stroke=accent, sw=1.6,
                   shadow=shadow, dash=dash)
        cy = y + 26
        if badge:
            bw = tw(badge, 11.5, True) + 16
            self.rrect(x + 14, y + 13, bw, 21, rx=6, fill=accent, stroke=None)
            self.text(x + 14 + bw / 2, y + 13 + 14.5, badge, size=11.5,
                      color=self.t["bg_deep"], family=MONO, weight=700,
                      anchor="middle")
        if title:
            tx = x + (14 + tw(badge, 11.5, True) + 16 + 12 if badge else 16)
            self.text(tx, y + 13 + 16, title, size=title_size,
                      color=self.t["fg"], family=SANS, weight=600)
            cy = y + 48
        if lines:
            for i, ln in enumerate(lines):
                col, txt = (ln if isinstance(ln, tuple) else (body_color, ln))
                self.text(x + 16, cy + i * 19, txt, size=13, color=col,
                          family=MONO)

    def spec_card(self, x, y, w, h, accent, title, attrs, footer=None,
                  badge=None, title_size=19, row_start=96, row_step=34):
        """A "spec card": title + divider + accent-dot two-tone attribute rows.

        attrs: list of (key, detail) pairs — key is emphasized (FG), detail is
        muted mono; pass a bare string or ('key', '') for a key-only row.
        footer: optional accent chip pinned bottom-left (e.g. 'Edge · On-site').
        Prefer this over card(lines=...) for attribute/spec lists.
        """
        self.card(x, y, w, h, accent, badge=badge, title=title,
                  title_size=title_size, lines=None)
        self.line(x + 20, y + 56, x + w - 20, y + 56, color=self.t["line"],
                  sw=1, marker=None)
        if footer:
            self.chip(x + 16, y + h - 44, footer, color=accent, dot=accent)
        for i, attr in enumerate(attrs):
            key, detail = attr if isinstance(attr, (tuple, list)) else (attr, "")
            ry = y + row_start + i * row_step
            self.dot(x + 30, ry - 4, 3.5, accent)
            self.text(x + 46, ry, key, size=14.5, color=self.t["fg"],
                      family=SANS, weight=600)
            if detail:
                self.text(x + 46 + tw(key, 14.5, False) + 14, ry, detail,
                          size=12.5, color=self.t["muted"], family=MONO)

    def title(self, text, sub=None):
        """Diagram heading (bold title + optional muted mono subtitle)."""
        self.text(40, 46, text, size=21, color=self.t["fg"], family=SANS,
                  weight=700)
        if sub:
            self.text(40, 68, sub, size=13, color=self.t["muted"], family=MONO)

    def legend(self, x, y, items):
        """Line-style key. items: list of (color, dash, label); dash=None for
        a solid sample. Auto-widths to fit; returns the box width."""
        item_ws = [26 + 8 + tw(lab, 11, True) + 24 for _, _, lab in items]
        w = 16 + sum(item_ws)
        self.rrect(x, y, w, 38, rx=9, fill=self.t["panel"], stroke=self.t["line"],
                   sw=1)
        sx = x + 16
        for (col, dash, lab), iw in zip(items, item_ws):
            self.line(sx, y + 22, sx + 26, y + 22, color=col, sw=2, dash=dash,
                      marker=None)
            self.text(sx + 34, y + 26, lab, size=11, color=self.t["fg_dim"],
                      family=MONO)
            sx += iw
        return w

    # -- assembly -----------------------------------------------------------
    def _arrow_color(self, role):
        return self.t["fg_dim"] if role == "fg" else self.t[role]

    def defs(self):
        markers = []
        for name in _ARROW_ROLES:
            col = self._arrow_color(name)
            markers.append(
                f'<marker id="arr-{name}" viewBox="0 0 10 10" refX="8.5" refY="5" '
                f'markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
                f'<path d="M0.5 1 L9 5 L0.5 9 z" fill="{col}"/></marker>')
        return (
            '<defs>'
            '<filter id="soft" x="-30%" y="-30%" width="160%" height="160%">'
            '<feDropShadow dx="0" dy="3" stdDeviation="5" '
            f'flood-color="#0c0c14" flood-opacity="0.55"/></filter>'
            '<linearGradient id="bgwash" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{self.t["bg"]}"/>'
            f'<stop offset="1" stop-color="{self.t["bg_deep"]}"/></linearGradient>'
            + "".join(markers) + '</defs>')

    def render(self):
        head = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" '
                f'height="{self.h}" viewBox="0 0 {self.w} {self.h}" '
                f'font-family="{SANS}">')
        bg = f'<rect width="{self.w}" height="{self.h}" fill="url(#bgwash)"/>'
        under = "".join(s for _, s in
                        sorted(self.under, key=lambda e: -e[0]))
        return (head + self.defs() + bg + under
                + "".join(self.body) + "</svg>")

    def save(self, path):
        with open(path, "w") as f:
            f.write(self.render())
