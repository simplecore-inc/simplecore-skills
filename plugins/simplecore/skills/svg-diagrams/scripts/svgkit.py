"""Themed SVG toolkit for architecture diagrams (default theme: Tokyo Night).

Pure stdlib. Coordinate math + glyph-width-based box sizing so text never
overflows. Pick a theme per canvas: Canvas(w, h, theme="nord"). Chrome colors
(bg/panel/box/line/muted/fg) resolve from the theme automatically; pass accent
colors via c.blue / c.green / ... so a diagram re-themes by changing one arg.
"""
import math
import re

# --- Themes: each is role -> hex (18 roles) --------------------------------
THEMES = {
    "tokyo-night": {
        "bg": "#1a1b26", "bg_deep": "#16161e", "panel": "#1f2335",
        "box": "#24283b", "box_hi": "#292e42", "line": "#3b4261",
        "grid": "#2a2e3f", "muted": "#565f89", "fg": "#c0caf5",
        "fg_dim": "#a9b1d6", "blue": "#7aa2f7", "cyan": "#7dcfff",
        "teal": "#73daca", "green": "#9ece6a", "purple": "#bb9af7",
        "red": "#f7768e", "orange": "#ff9e64", "yellow": "#e0af68",
        "shadow": "#0c0c14", "shadow_op": "0.55",
    },
    "nord": {
        "bg": "#2e3440", "bg_deep": "#272c36", "panel": "#2f3645",
        "box": "#3b4252", "box_hi": "#434c5e", "line": "#4c566a",
        "grid": "#353c4a", "muted": "#7b88a1", "fg": "#eceff4",
        "fg_dim": "#d8dee9", "blue": "#81a1c1", "cyan": "#88c0d0",
        "teal": "#8fbcbb", "green": "#a3be8c", "purple": "#b48ead",
        "red": "#bf616a", "orange": "#d08770", "yellow": "#ebcb8b",
        "shadow": "#0c0c14", "shadow_op": "0.55",
    },
    "catppuccin": {
        "bg": "#1e1e2e", "bg_deep": "#181825", "panel": "#232634",
        "box": "#313244", "box_hi": "#45475a", "line": "#585b70",
        "grid": "#2a2b3c", "muted": "#7f849c", "fg": "#cdd6f4",
        "fg_dim": "#bac2de", "blue": "#89b4fa", "cyan": "#89dceb",
        "teal": "#94e2d5", "green": "#a6e3a1", "purple": "#cba6f7",
        "red": "#f38ba8", "orange": "#fab387", "yellow": "#f9e2af",
        "shadow": "#0c0c14", "shadow_op": "0.55",
    },
    "gruvbox": {
        "bg": "#282828", "bg_deep": "#1d2021", "panel": "#32302f",
        "box": "#3c3836", "box_hi": "#504945", "line": "#665c54",
        "grid": "#353231", "muted": "#928374", "fg": "#ebdbb2",
        "fg_dim": "#d5c4a1", "blue": "#83a598", "cyan": "#8ec07c",
        "teal": "#689d6a", "green": "#b8bb26", "purple": "#d3869b",
        "red": "#fb4934", "orange": "#fe8019", "yellow": "#fabd2f",
        "shadow": "#0c0c14", "shadow_op": "0.55",
    },
    "one-dark": {
        "bg": "#282c34", "bg_deep": "#21252b", "panel": "#2c313a",
        "box": "#333842", "box_hi": "#3e4451", "line": "#4b5263",
        "grid": "#2d323b", "muted": "#5c6370", "fg": "#abb2bf",
        "fg_dim": "#9da5b4", "blue": "#61afef", "cyan": "#56b6c2",
        "teal": "#48b0a0", "green": "#98c379", "purple": "#c678dd",
        "red": "#e06c75", "orange": "#d19a66", "yellow": "#e5c07b",
        "shadow": "#0c0c14", "shadow_op": "0.55",
    },
    "paper": {
        # For figures placed on a white page. Backgrounds are the paper
        # itself, so a figure has no panel edge to fight the page; the
        # accents are deepened to keep 4.5:1 against white, which the
        # pastel accents of the dark themes do not reach.
        "bg": "#ffffff", "bg_deep": "#ffffff", "panel": "#f6f7f9",
        "box": "#ffffff", "box_hi": "#f2f4f7", "line": "#c7cdd7",
        "grid": "#e8ebf0", "muted": "#79808f", "fg": "#14161c",
        "fg_dim": "#454b59", "blue": "#1b4a9c", "cyan": "#0f6f96",
        "teal": "#0b6a5a", "green": "#3f7a2e", "purple": "#5b46a8",
        "red": "#a8382a", "orange": "#a8560c", "yellow": "#856310",
        "shadow": "#25304a", "shadow_op": "0.10",
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

# Korean families follow the Latin ones so Latin glyphs still come from Inter
# where it is installed, while Hangul resolves to a real Korean face instead of
# whatever the viewer's default happens to be. This matters wherever the SVG is
# handed to a renderer that does its own font resolution — a browser, or an
# <asvg:svgBlip> embedded in a .pptx — because none of the Latin families above
# carry Hangul, and the fallback then differs per machine.
SANS = ("'Inter','SF Pro Display',system-ui,-apple-system,'Segoe UI',Roboto,"
        "'Pretendard','Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',"
        "sans-serif")
MONO = ("'JetBrains Mono','SF Mono',ui-monospace,Menlo,'DejaVu Sans Mono',"
        "'D2Coding','Noto Sans Mono CJK KR',monospace")

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



# Which parameters of each path command are x, which are y, and which are
# neither. An arc's radii scale with the drawing; its rotation does not, and
# its two flags are single digits that may be written with no separator at all
# — `a2 2 0 0022 17` is rx=2 ry=2 rot=0 large-arc=0 sweep=0 x=22 y=17. Reading
# those flags with a number scanner swallows `0022` as one value, drops a
# parameter, and turns a rounded corner into a stray loop.
_PATH_ARGS = {
    "M": ("xy",), "L": ("xy",), "T": ("xy",),
    "H": ("x",), "V": ("y",),
    "C": ("xy", "xy", "xy"), "S": ("xy", "xy"), "Q": ("xy", "xy"),
    "A": ("r", "r", "n", "f", "f", "x", "y"),
    "Z": (),
}
_NUMBER = re.compile(r"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?")
_SEP = " ,\t\r\n"


def _scale_path(d, ox, oy, k):
    """Translate and uniformly scale a path, absolute and relative alike.

    A relative segment carries a displacement, so it scales but is not
    translated; an absolute one is both. Getting that backwards moves every
    curve after the first relative command.
    """
    out, i, n, cmd = [], 0, len(d), None
    first = True

    def skip():
        nonlocal i
        while i < n and d[i] in _SEP:
            i += 1

    def number():
        nonlocal i
        skip()
        m = _NUMBER.match(d, i)
        if not m:
            raise ValueError(f"expected a number at {i} in {d[:48]!r}")
        i = m.end()
        return float(m.group())

    def flag():
        nonlocal i
        skip()
        if i >= n or d[i] not in "01":
            raise ValueError(f"expected an arc flag at {i} in {d[:48]!r}")
        i += 1
        return d[i - 1]

    while True:
        skip()
        if i >= n:
            break
        if d[i].isalpha():
            cmd = d[i]
            i += 1
        elif cmd is None:
            raise ValueError(f"path starts with a number: {d[:48]!r}")
        upper = cmd.upper()
        absolute = cmd.isupper()
        # A path whose first command is a relative moveto starts from (0,0),
        # so SVG reads that one moveto as absolute — but only the moveto. The
        # pairs that follow it are still relative linetos, and promoting them
        # too scatters the rest of the icon across the canvas.
        was_relative = cmd.islower()
        if first and upper == "M":
            cmd, absolute = "M", True
        first = False
        if upper == "Z":
            out.append(cmd)
            continue
        out.append(cmd)
        for kind in _PATH_ARGS[upper]:
            if kind == "xy":
                px, py = number(), number()
                out.append(f"{ox + px * k if absolute else px * k:.2f}")
                out.append(f"{oy + py * k if absolute else py * k:.2f}")
            elif kind == "x":
                v = number()
                out.append(f"{ox + v * k if absolute else v * k:.2f}")
            elif kind == "y":
                v = number()
                out.append(f"{oy + v * k if absolute else v * k:.2f}")
            elif kind == "r":
                out.append(f"{number() * k:.2f}")
            elif kind == "f":
                out.append(flag())
            else:
                out.append(f"{number():g}")
        # An implicit repeat after a moveto continues as a lineto, keeping the
        # case the author wrote rather than the one this function forced.
        if upper == "M":
            cmd = "l" if was_relative else "L"

    return " ".join(out)


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



def path_points(d):
    """The real (x, y) points of an absolute path, command by command.

    A flat scan for number pairs is wrong the moment a path holds an arc:
    `A rx ry rot large sweep x y` has seven arguments and only the last two
    are a position, so the radii and the two flags get read as coordinates
    near the origin — which silently drags any bounding box computed that way
    to (0, 0). Relative commands are skipped rather than guessed at; nothing
    in this kit emits them.
    """
    arity = {"M": 2, "L": 2, "T": 2, "Q": 4, "S": 4, "C": 6,
             "H": 1, "V": 1, "A": 7, "Z": 0}
    toks = re.findall(r'[MLHVQCSTAZmlhvqcstaz]|-?[\d.]+', d)
    pts, i, cmd, cur = [], 0, "M", (0.0, 0.0)
    while i < len(toks):
        if re.match(r'[A-Za-z]', toks[i]):
            cmd = toks[i]
            i += 1
            if cmd.upper() == "Z":
                continue
        n = arity.get(cmd.upper(), 2)
        if n == 0 or i + n > len(toks):
            break
        try:
            args = [float(v) for v in toks[i:i + n]]
        except ValueError:
            break
        i += n
        if cmd.islower():
            continue
        if cmd == "H":
            cur = (args[0], cur[1])
        elif cmd == "V":
            cur = (cur[0], args[0])
        elif cmd == "A":
            cur = (args[5], args[6])
        else:
            for k in range(0, n, 2):
                pts.append((args[k], args[k + 1]))
            cur = (args[n - 2], args[n - 1])
        pts.append(cur)
    return pts


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
    # Drop shadows are drawn with an SVG `<filter>`, and PowerPoint's SVG
    # import drops every element that references one — the shape vanishes
    # while its labels stay, so a diagram embedded in a .pptx loses all its
    # cards and nothing reports it. A board destined for Office sets this to
    # False; the picture reads the same on paper without it.
    SHADOW = True

    def __init__(self, w, h, theme=DEFAULT_THEME, bg=None, shadow=None):
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
        self.shadow = self.SHADOW if shadow is None else shadow
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
        if shadow and self.shadow:
            a.append('filter="url(#soft)"')
        self.add(" ".join(a) + "/>")

    def icon(self, name, x, y, size=20, color=_DEF, sw=1.6):
        """A Lucide line icon centred at (x, y).

        Lucide draws on a 24x24 grid with a round stroke, so an icon takes the
        accent colour of whatever it marks and prints at the weight of the rest
        of the drawing. The elements are emitted as plain rect/circle/line/path
        rather than wrapped in a `<g transform>`, because `trim` and `ink_box`
        read coordinates off the markup and a transform would be invisible to
        both — the figure would then trim to the wrong box.

        Every Lucide icon is bundled; `Canvas.icons("keyword")` searches the
        names, and https://lucide.dev browses them.
        """
        from lucide import ICONS as _LUCIDE
        if name not in _LUCIDE:
            near = [n for n in sorted(_LUCIDE) if name.split("-")[0] in n][:8]
            raise KeyError(
                f"no Lucide icon {name!r}"
                + (f" — did you mean {', '.join(near)}?" if near else "")
                + " Search with Canvas.icons(<keyword>).")
        color = self.t["fg_dim"] if color is _DEF else color
        k = size / 24.0
        ox, oy = x - size / 2, y - size / 2
        fx = lambda u: ox + u * k          # noqa: E731
        fy = lambda v: oy + v * k          # noqa: E731
        common = (f'fill="none" stroke="{color}" stroke-width="{sw}" '
                  'stroke-linecap="round" stroke-linejoin="round"')

        for tag, a in _LUCIDE[name]:
            if tag == "path":
                self.add(f'<path d="{_scale_path(a["d"], ox, oy, k)}" {common}/>')
            elif tag == "circle":
                self.add(f'<circle cx="{fx(a["cx"]):.2f}" cy="{fy(a["cy"]):.2f}" '
                         f'r="{a["r"] * k:.2f}" {common}/>')
            elif tag == "ellipse":
                self.add(f'<ellipse cx="{fx(a["cx"]):.2f}" cy="{fy(a["cy"]):.2f}" '
                         f'rx="{a["rx"] * k:.2f}" ry="{a["ry"] * k:.2f}" '
                         f'{common}/>')
            elif tag == "rect":
                r = a.get("rx", 0) * k
                self.add(f'<rect x="{fx(a["x"]):.2f}" y="{fy(a["y"]):.2f}" '
                         f'width="{a["width"] * k:.2f}" '
                         f'height="{a["height"] * k:.2f}" rx="{r:.2f}" '
                         f'{common}/>')
            elif tag == "line":
                self.add(f'<line x1="{fx(a["x1"]):.2f}" y1="{fy(a["y1"]):.2f}" '
                         f'x2="{fx(a["x2"]):.2f}" y2="{fy(a["y2"]):.2f}" '
                         f'{common}/>')
            else:  # polyline / polygon
                nums = [float(t) for t in a["points"].replace(",", " ").split()]
                pts = " ".join(f"{fx(nums[i]):.2f},{fy(nums[i + 1]):.2f}"
                               for i in range(0, len(nums) - 1, 2))
                self.add(f'<{tag} points="{pts}" {common}/>')

    @staticmethod
    def icons(keyword=""):
        """Bundled icon names containing `keyword` — 2,000+ of them, so search."""
        from lucide import ICONS as _LUCIDE
        return sorted(n for n in _LUCIDE if keyword in n)

    def band(self, x, y, w, h, rx, color, opacity=0.14, side="top"):
        """A tinted band on the edge of a card: outer corners round, inner square.

        Drawing a card's header as a rounded rectangle rounds its bottom corners
        too, and the card's straight body butts against them — the header then
        reads as a separate chip resting on the card rather than as its top.
        Only the corners that follow the card's own outline are rounded.

        `side` names the edge the band sits on: "top" for a header above a card
        body, "left" for a label band at the start of a row. `rx` is the card's
        own corner radius, so the two outlines meet without a step.
        """
        if side == "top":
            d = (f"M {x:.1f} {y + rx:.1f} A {rx} {rx} 0 0 1 {x + rx:.1f} {y:.1f} "
                 f"H {x + w - rx:.1f} A {rx} {rx} 0 0 1 {x + w:.1f} {y + rx:.1f} "
                 f"V {y + h:.1f} H {x:.1f} Z")
        elif side == "left":
            d = (f"M {x + w:.1f} {y:.1f} H {x + rx:.1f} "
                 f"A {rx} {rx} 0 0 0 {x:.1f} {y + rx:.1f} "
                 f"V {y + h - rx:.1f} A {rx} {rx} 0 0 0 {x + rx:.1f} {y + h:.1f} "
                 f"H {x + w:.1f} Z")
        else:
            raise ValueError(f"side must be 'top' or 'left', not {side!r}")
        self.add(f'<path d="{d}" fill="{color}" opacity="{opacity}"/>')

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

    def matrix(self, x, y, rows, cols, marks, label_w=260, col_w=116,
               row_h=36, header_h=30):
        """Labeled dependency / coverage matrix — a grid of rows x columns
        with filled cells. Good for dependency, coverage, RACI, or feature
        comparison tables where each cell is present/absent.

        rows:  list — each item is a name str, or an (id, name) tuple (id
               renders as a leading chip, colored by the row's first mark).
        cols:  list of (label, color) — column headers (solid accent chips).
        marks: iterable of (row_idx, col_idx) or (row_idx, col_idx, color) —
               filled cells; color defaults to the column's color. An empty
               column stays blank (reads as 'no dependency in that column').

        Draws column separators, header chips, per-row id chip + name, and a
        tinted pill + dot in each marked cell. Returns (total_w, total_h) so
        the caller can size the canvas (add the title band + margins).
        """
        ncol, nrow = len(cols), len(rows)
        grid_left = x + label_w
        cxs = [grid_left + i * col_w + col_w / 2 for i in range(ncol)]
        body_top = y + header_h + 8
        body_bottom = body_top + nrow * row_h
        row_cy = [body_top + row_h / 2 + i * row_h for i in range(nrow)]

        # normalize marks -> {(r, c): color}
        cell = {}
        for m in marks:
            r, c = m[0], m[1]
            cell[(r, c)] = m[2] if len(m) > 2 else cols[c][1]

        # column separators
        for i in range(ncol + 1):
            gx = grid_left + i * col_w
            self.line(gx, body_top, gx, body_bottom, color=self.t["line"],
                      sw=1, marker=None)
        # row separators (between rows)
        for i in range(1, nrow):
            ry = body_top + i * row_h
            self.line(x, ry, grid_left + ncol * col_w, ry,
                      color=self.t["line"], sw=1, marker=None)

        # header chips (solid accent, dark centered label)
        hcy = y + header_h / 2
        for (label, color), cx in zip(cols, cxs):
            hw = min(col_w - 24, tw(label, 15, False) + 34)
            self.rrect(cx - hw / 2, hcy - header_h / 2, hw, header_h, rx=8,
                       fill=color, stroke=None)
            self.text(cx, hcy + 5.5, label, size=15, color=self.t["bg_deep"],
                      family=SANS, weight=700, anchor="middle")

        # rows: id chip + name, then marked cells
        for i, item in enumerate(rows):
            cy = row_cy[i]
            rid, name = item if isinstance(item, (tuple, list)) else (None, item)
            rcol = next((cell[(i, c)] for c in range(ncol)
                         if (i, c) in cell), self.t["muted"])
            lx = x
            if rid is not None:
                lx += self.chip(x, cy - 12, rid, color=rcol, dot=rcol) + 12
            self.text(lx, cy + 5, name, size=14, color=self.t["fg"],
                      family=SANS, weight=500)
            for c in range(ncol):
                if (i, c) in cell:
                    col = cell[(i, c)]
                    cw = col_w - 12
                    self.rrect(cxs[c] - cw / 2, cy - 15, cw, 30, rx=8,
                               fill=col, stroke=col, sw=1.2, opacity=0.16)
                    self.dot(cxs[c], cy, 5, col)

        return (label_w + ncol * col_w, header_h + 8 + nrow * row_h)

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
        soft = ''
        if self.shadow:
            soft = (
                '<filter id="soft" x="-30%" y="-30%" width="160%" height="160%">'
                '<feDropShadow dx="0" dy="3" stdDeviation="5" '
                f'flood-color="{self.t["shadow"]}" '
                f'flood-opacity="{self.t["shadow_op"]}"/></filter>')
        return (
            '<defs>' + soft +
            '<linearGradient id="bgwash" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{self.t["bg"]}"/>'
            f'<stop offset="1" stop-color="{self.t["bg_deep"]}"/></linearGradient>'
            + "".join(markers) + '</defs>')

    def ink_box(self):
        """Bounding box of everything drawn, as (x0, y0, x1, y1).

        Reads the emitted markup rather than tracking geometry as it is
        drawn, so it also sees whatever a caller added with raw add(). The
        <defs> block is not part of the body, so marker artwork — whose
        coordinates sit a few pixels from the origin and mean nothing on the
        canvas — cannot drag the box to (0, 0).
        """
        body = "".join(s for _, s in self.under) + "".join(self.body)
        xs, ys = [], []
        for m in re.finditer(r'<rect\b([^>]*)/?>', body):
            a = m.group(1)
            g = lambda k: (lambda mm: float(mm.group(1)) if mm else None)(
                re.search(rf'\b{k}="([\-\d.]+)"', a))
            x, y, w, h = g("x"), g("y"), g("width"), g("height")
            if None in (x, y, w, h):
                continue
            xs += [x, x + w]
            ys += [y, y + h]
        for m in re.finditer(r'<text\b([^>]*)>(.*?)</text>', body, re.S):
            a, inner = m.group(1), m.group(2)
            g = lambda k, d=None: (lambda mm: float(mm.group(1)) if mm else d)(
                re.search(rf'\b{k}="([\-\d.]+)"', a))
            x, y, size = g("x"), g("y"), g("font-size", 13)
            if x is None or y is None:
                continue
            txt = re.sub(r'<[^>]+>', '', inner)
            anchor = (re.search(r'text-anchor="(\w+)"', a) or [None, "start"])[1]
            w = tw(txt, size)
            xs += ([x - w / 2, x + w / 2] if anchor == "middle"
                   else [x - w, x] if anchor == "end" else [x, x + w])
            ys += [y - size * 0.78, y + size * 0.24]
        for m in re.finditer(r'<(?:line|path|circle|polygon)\b([^>]*)/?>', body):
            a = m.group(1)
            for k in ("x1", "x2", "cx"):
                mm = re.search(rf'\b{k}="([\-\d.]+)"', a)
                if mm:
                    xs.append(float(mm.group(1)))
            for k in ("y1", "y2", "cy"):
                mm = re.search(rf'\b{k}="([\-\d.]+)"', a)
                if mm:
                    ys.append(float(mm.group(1)))
            dm = re.search(r'\bd="([^"]+)"', a)
            if dm:
                for px, py in path_points(dm.group(1)):
                    xs.append(px)
                    ys.append(py)
            pm = re.search(r'\bpoints="([^"]+)"', a)
            if pm:
                for px, py in re.findall(r'(-?[\d.]+)[ ,](-?[\d.]+)', pm.group(1)):
                    xs.append(float(px))
                    ys.append(float(py))
        if not xs or not ys:
            return (0.0, 0.0, self.w, self.h)
        return (min(xs), min(ys), max(xs), max(ys))

    _SHIFT_X = ("x", "x1", "x2", "cx")
    _SHIFT_Y = ("y", "y1", "y2", "cy")

    # Which numbers in a path command are coordinates. -1 marks "the last
    # two are the point"; everything before them (radii, rotation, the two
    # arc flags) is not a position and must not move.
    _PATH_ARITY = {"M": 2, "L": 2, "T": 2, "Q": 4, "S": 4, "C": 6,
                   "H": 1, "V": 1, "A": 7, "Z": 0}

    def _shift_path(self, d, dx, dy):
        """Shift a path's coordinates, respecting each command's argument shape.

        Treating a `d` as a flat run of (x, y) pairs works only while the
        generator emits M, L and Q. The first arc turns the radii and the two
        flags of an `A` into coordinates, and the path silently stops drawing
        — the arrowhead still lands, so the damage reads as a missing line
        rather than as corruption.
        """
        toks = re.findall(r'[MLHVQCSTAZmlhvqcstaz]|-?[\d.]+', d)
        out = []
        i = 0
        cmd = "M"
        while i < len(toks):
            t = toks[i]
            if re.match(r'[A-Za-z]', t):
                cmd = t
                out.append(t)
                i += 1
                if cmd.upper() == "Z":
                    continue
            n = self._PATH_ARITY.get(cmd.upper(), 2)
            if n == 0 or i + n > len(toks):
                out.extend(toks[i:])
                break
            args = [float(v) for v in toks[i:i + n]]
            i += n
            if cmd.islower():                 # relative: shift nothing
                pass
            elif cmd == "H":
                args[0] += dx
            elif cmd == "V":
                args[0] += dy
            elif cmd == "A":
                args[5] += dx
                args[6] += dy
            else:
                for k in range(0, n, 2):
                    args[k] += dx
                    args[k + 1] += dy
            # The two arc flags are single characters in the grammar, not
            # numbers: a strict parser rejects `1.0` where it wants `1`, and
            # the path stops drawing. Emitting integers whole keeps every
            # renderer happy and the file shorter.
            def _fmt(v):
                r = round(v, 2)
                return str(int(r)) if r == int(r) else str(r)
            out.extend(_fmt(v) for v in args)
        return " ".join(out)

    def _shift_markup(self, s, dx, dy):
        """Move every canvas coordinate in one emitted element by (dx, dy).

        Only the attributes that name a position are touched — width, height,
        r, rx, stroke-width, font-size and stroke-dasharray are lengths and
        must not move.
        """
        def attr(m):
            k, v = m.group(1), float(m.group(2))
            d = dx if k in self._SHIFT_X else dy
            return f'{k}="{round(v + d, 2)}"'
        keys = "|".join(self._SHIFT_X + self._SHIFT_Y)
        s = re.sub(rf'\b({keys})="([\-\d.]+)"', attr, s)
        s = re.sub(r'\b(d)="([^"]+)"',
                   lambda m: f'd="{self._shift_path(m.group(2), dx, dy)}"', s)
        # A polyline/polygon carries its coordinates in `points`, which none of
        # the attribute names above matches. `ink_box` already reads them, so
        # leaving them here moved the board out from under those shapes: an
        # icon whose glyph includes a polyline (package, git-branch, and ~200
        # more) had that part stay behind while the rest of the figure shifted.
        return re.sub(r'\bpoints="([^"]+)"',
                      lambda m: f'points="{self._shift_points(m.group(1), dx, dy)}"',
                      s)

    @staticmethod
    def _shift_points(pts, dx, dy):
        nums = [float(t) for t in pts.replace(",", " ").split()]
        return " ".join(f"{nums[i] + dx:.2f},{nums[i + 1] + dy:.2f}"
                        for i in range(0, len(nums) - 1, 2))

    def trim(self, margin=24, min_w=None, max_w=None):
        """Fit the board to what was actually drawn, leaving `margin` around it.

        A board is declared before its content is laid out, so its size is a
        guess, and both ways of being wrong cost something. Too large reserves
        a band of page the figure never draws on — the figure is placed at a
        fixed width, so nothing in the drawing grows to fill it. Too tight has
        the viewBox halve a stroke, and what survives lands in the page margin.

        The content is moved rather than the viewBox origin, so the board
        still reads `viewBox="0 0 W H"` — several checks and build steps match
        that exact form and an offset origin would defeat them silently.
        Idempotent: trimming an already-fitted board moves nothing.

        `min_w` / `max_w` clamp the finished width. Some destinations decide
        the on-page type size from the board width — a figure placed at a
        fixed column width is scaled by column/board, so the board width sets
        how small the labels print. Where that band exists, the horizontal
        margin gives way to it and pads or tightens symmetrically; a drawing
        too wide to fit even at an 8px margin keeps its size and is left for
        the linter to report, because the fix there is fewer boxes.
        """
        x0, y0, x1, y1 = self.ink_box()
        mx = margin
        if min_w or max_w:
            span = x1 - x0
            if max_w and span + margin * 2 > max_w:
                mx = max((max_w - span) / 2, 8)
            elif min_w and span + margin * 2 < min_w:
                mx = (min_w - span) / 2
        dx, dy = mx - x0, margin - y0
        if abs(dx) > 0.01 or abs(dy) > 0.01:
            self.body = [self._shift_markup(s, dx, dy) for s in self.body]
            self.under = [(a, self._shift_markup(s, dx, dy))
                          for a, s in self.under]
        self.w = round(x1 - x0 + mx * 2, 2)
        self.h = round(y1 - y0 + margin * 2, 2)
        return self

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


# Visual-type builders live in viztypes so this file stays about primitives.
# They are bound here rather than imported there-and-back so that anyone who
# imports svgkit gets the full vocabulary: `import viztypes` on its own would
# leave a caller with a Canvas that silently lacks half its methods. The
# import sits at the bottom on purpose — svgkit is already in sys.modules by
# then, so viztypes can import the helpers it needs from it.
def _bind_viztypes():
    try:
        from viztypes import BUILDERS
    except ImportError:                      # pragma: no cover
        return                               # primitives still work alone
    for _name, _fn in BUILDERS.items():
        setattr(Canvas, _name, _fn)


_bind_viztypes()
