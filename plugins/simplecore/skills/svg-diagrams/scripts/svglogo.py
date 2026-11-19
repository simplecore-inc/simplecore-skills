"""External SVG logos placed inside a generated figure.

Two halves, both stdlib only:

- `read_logo(path)` parses a logo file, strips what must not travel into a
  figure (scripts, event handlers, editor metadata, animation), refuses what
  cannot be made safe (an embedded raster image, an external reference, a
  filter, a stylesheet rule it cannot resolve), resolves the logo's `<style>`
  rules into each element's own `style` attribute, and returns a `Logo`.
  `Logo.markup(prefix, x, y, w, h)` writes it as a nested `<svg>` carrying its
  own `viewBox`, with every id and every reference to one rewritten under
  `prefix`, so two logos that both name a gradient `a` never collide and one
  logo placed twice still resolves.

- `opaque_view(markup)` turns every placed logo in a saved figure back into
  one rectangle that names it. Every reader that judges figure content (the
  lint, the contrast check, the document-figure checks) reads this view, so a
  logo's own shapes and words are never linted as the figure's, while its box
  still counts for overlap and for staying on the board.

A placed logo is recognised in a saved SVG by `<svg data-logo="<name>" ...>`.
"""
import html
import re
import xml.etree.ElementTree as ET
from pathlib import Path

SVG_NS = "http://www.w3.org/2000/svg"
XLINK_NS = "http://www.w3.org/1999/xlink"
XML_NS = "http://www.w3.org/XML/1998/namespace"

# Elements that are dropped with everything inside them: editor and document
# metadata, and animation, which a printed figure cannot show.
DROP = {"metadata", "title", "desc", "script", "animate", "animateMotion",
        "animateTransform", "animateColor", "set", "filter"}
# Elements that make a logo unusable rather than merely untidy.
REFUSE = {"image": "an embedded or linked raster image",
          "foreignObject": "foreign (HTML) content"}
TEXT_TAGS = {"text", "tspan", "textPath"}
# Root attributes that size or identify the file; every other root attribute
# is a presentation attribute and moves onto the wrapper group.
ROOT_ONLY = {"width", "height", "viewBox", "x", "y", "version", "baseProfile",
             "preserveAspectRatio", "enable-background", "zoomAndPan",
             "contentScriptType", "contentStyleType", "class", "id", "style"}

LOGO_OPEN = re.compile(r'<svg\b[^>]*\bdata-logo="([^"]*)"[^>]*>')
SVG_TAG = re.compile(r"<(/?)svg\b[^>]*?(/?)>")
URL_REF = re.compile(r"""url\(\s*(['"]?)([^)'"]*)\1\s*\)""")
SELECTOR = re.compile(r"^(\*|[A-Za-z][\w-]*)?(#[\w-]+)?((?:\.[\w-]+)*)$")
UNIT_PX = {"": 1.0, "px": 1.0, "pt": 4 / 3, "pc": 16.0, "mm": 96 / 25.4,
           "cm": 96 / 2.54, "in": 96.0}


class LogoError(ValueError):
    """A logo file that is missing, malformed, or unsafe to inline."""


def _local(tag):
    return tag.rsplit("}", 1)[-1] if isinstance(tag, str) else None


def _ns(tag):
    return tag[1:].split("}", 1)[0] if isinstance(tag, str) and tag.startswith("{") else ""


def _decls(text):
    """CSS declarations as an ordered list of (property, value, important)."""
    out = []
    for part in text.split(";"):
        if ":" not in part:
            continue
        prop, value = part.split(":", 1)
        prop, value = prop.strip().lower(), value.strip()
        if not prop or not value:
            continue
        important = bool(re.search(r"!\s*important\s*$", value, re.I))
        value = re.sub(r"\s*!\s*important\s*$", "", value, flags=re.I)
        out.append((prop, value, important))
    return out


def _style_text(decls):
    return "; ".join(f"{p}: {v}{' !important' if imp else ''}" for p, v, imp in decls)


def _parse_css(css, path):
    """[(specificity, order, matcher, decls)] for a logo's stylesheet.

    Only compound selectors of a tag, an id and classes are resolved, which is
    what drawing programs write (`.cls-1`, `path.st0`, `#a`). Anything else
    would need a browser's cascade, so it is refused rather than guessed.
    """
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    css = re.sub(r"<!\[CDATA\[|\]\]>", "", css)
    if "@" in css:
        at = re.search(r"@[\w-]+", css).group(0)
        raise LogoError(f"{path}: its <style> carries an {at} rule; outline the "
                        "logo or flatten its styles into attributes")
    rules = []
    for order, m in enumerate(re.finditer(r"([^{}]+)\{([^{}]*)\}", css)):
        decls = _decls(m.group(2))
        for sel in m.group(1).split(","):
            sel = sel.strip()
            sm = SELECTOR.match(sel)
            if not sel or not sm or not any(sm.groups()):
                raise LogoError(f"{path}: cannot resolve the selector {sel!r} in its "
                                "<style>; only a tag, an #id and .classes are resolved")
            tag, ident, classes = sm.groups()
            classes = [c for c in (classes or "").split(".") if c]
            spec = (1 if ident else 0, len(classes), 1 if tag and tag != "*" else 0)
            rules.append((spec, order, (tag, ident[1:] if ident else None, classes), decls))
    leftover = re.sub(r"([^{}]+)\{([^{}]*)\}", "", css).strip()
    if leftover:
        raise LogoError(f"{path}: cannot read its <style> near {leftover[:40]!r}")
    return rules


def _matches(matcher, el):
    tag, ident, classes = matcher
    if tag and tag != "*" and _local(el.tag) != tag:
        return False
    if ident and el.get("id") != ident:
        return False
    have = set((el.get("class") or "").split())
    return all(c in have for c in classes)


def _length(value, path, what):
    m = re.fullmatch(r"\s*([\d.]+(?:e[-+]?\d+)?)\s*([a-z%]*)\s*", value or "", re.I)
    if not m or m.group(2).lower() not in UNIT_PX:
        raise LogoError(f"{path}: has no viewBox and its {what} {value!r} is not an "
                        "absolute length; give the file a viewBox")
    return float(m.group(1)) * UNIT_PX[m.group(2).lower()]


class Logo:
    """One sanitized logo, ready to be written at any size under any prefix."""

    def __init__(self, name, path, viewbox, root_attrs, children, ids, has_text):
        self.name = name
        self.path = path
        self.viewbox = viewbox              # (x, y, w, h) in the logo's own units
        self._root = root_attrs             # presentation attributes of its root
        self._children = children           # sanitized elements under the root
        self.ids = ids                      # every id the logo defines
        self.has_text = has_text            # whether it carries live <text>

    @property
    def aspect(self):
        """Width over height of the logo's own viewBox."""
        return self.viewbox[2] / self.viewbox[3]

    def width_at(self, h):
        return h * self.aspect

    def markup(self, prefix, x, y, w, h):
        """The logo as a nested <svg> at (x, y, w, h), ids under `prefix`."""
        vb = " ".join(f"{v:g}" for v in self.viewbox)
        head = (f'<svg data-logo="{html.escape(self.name, quote=True)}" id="{prefix}" '
                f'x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}" viewBox="{vb}" '
                f'preserveAspectRatio="xMidYMid meet" overflow="hidden">')
        group = "<g" + "".join(
            f' {k}="{html.escape(self._rewrite(v, prefix), quote=True)}"'
            for k, v in self._root) + ">"
        body = "".join(self._write(el, prefix) for el in self._children)
        return head + group + body + "</g></svg>"

    def _rewrite(self, value, prefix):
        def url(m):
            target = m.group(2)
            return f"url(#{prefix}-{target[1:]})"
        return URL_REF.sub(url, value)

    def _write(self, el, prefix):
        tag = _local(el.tag)
        parts = [f"<{tag}"]
        for k, v in el.attrib.items():
            if k == "id":
                v = f"{prefix}-{v}"
            elif k == "href":
                v = f"#{prefix}-{v[1:]}"
            else:
                v = self._rewrite(v, prefix)
            parts.append(f' {k}="{html.escape(v, quote=True)}"')
        keep_space = tag in TEXT_TAGS
        inner = html.escape(el.text, quote=False) if el.text and (
            keep_space or el.text.strip()) else ""
        for child in el:
            inner += self._write(child, prefix)
            if child.tail and (keep_space or child.tail.strip()):
                inner += html.escape(child.tail, quote=False)
        if not inner:
            return "".join(parts) + "/>"
        return "".join(parts) + ">" + inner + f"</{tag}>"


def read_logo(path, name=None):
    """Parse and sanitize one logo file; raise LogoError when it cannot be used."""
    path = Path(path)
    if not path.is_file():
        raise LogoError(f"logo {name or path.stem!r}: no file at {path}")
    try:
        root = ET.fromstring(path.read_bytes())
    except ET.ParseError as err:
        raise LogoError(f"{path}: not well-formed XML ({err})") from err
    if _local(root.tag) != "svg" or _ns(root.tag) not in (SVG_NS, ""):
        raise LogoError(f"{path}: the root element is not <svg>")

    vb = root.get("viewBox")
    if vb:
        try:
            viewbox = tuple(float(v) for v in re.split(r"[\s,]+", vb.strip()))
        except ValueError as err:
            raise LogoError(f"{path}: cannot read viewBox {vb!r}") from err
        if len(viewbox) != 4:
            raise LogoError(f"{path}: viewBox {vb!r} does not have four numbers")
    else:
        viewbox = (0.0, 0.0, _length(root.get("width"), path, "width"),
                   _length(root.get("height"), path, "height"))
    if viewbox[2] <= 0 or viewbox[3] <= 0:
        raise LogoError(f"{path}: viewBox {viewbox} has no area")

    # the stylesheet, every <style> in document order
    css = "".join((el.text or "") for el in root.iter() if _local(el.tag) == "style")
    rules = _parse_css(css, path) if css.strip() else []

    ids = {el.get("id") for el in root.iter() if el.get("id")}
    has_text = False

    def check_refs(value, where):
        for m in URL_REF.finditer(value):
            target = m.group(2).strip()
            if not target.startswith("#") or target[1:] not in ids:
                raise LogoError(f"{path}: {where} refers to {target!r}, which is not "
                                "an element of the logo; an external reference "
                                "cannot be inlined")

    def clean(el, family):
        """Sanitized copy of `el`, or None when it is dropped."""
        nonlocal has_text
        ns, tag = _ns(el.tag), _local(el.tag)
        if tag is None or ns not in (SVG_NS, ""):
            return None                     # comments, editor elements
        if tag in REFUSE:
            raise LogoError(f"{path}: carries {REFUSE[tag]} (<{tag}>); use a logo "
                            "drawn entirely in vector shapes")
        if tag in DROP or tag == "style":
            return None
        out = ET.Element(tag)
        # cascade: matching rules by specificity and order, then its own style
        decls = []
        for spec, order, matcher, rule_decls in sorted(rules, key=lambda r: (r[0], r[1])):
            if _matches(matcher, el):
                decls += rule_decls
        decls += _decls(el.get("style") or "")
        merged = {}
        for prop, value, imp in decls:
            if prop in merged and merged[prop][1] and not imp:
                continue
            merged[prop] = (value, imp)
        for k, v in el.attrib.items():
            kns, kl = _ns(k), _local(k)
            if kns == XLINK_NS and kl == "href" or (not kns and kl == "href"):
                if not v.startswith("#") or v[1:] not in ids:
                    raise LogoError(f"{path}: <{tag}> links to {v[:60]!r}; an external "
                                    "or dangling reference cannot be inlined")
                out.set("href", v)
            elif kns or kl.startswith("on") or kl.startswith("data-") or kl in ("class", "style"):
                continue                    # editor attributes, handlers, classes
            elif kl == "filter" and v.strip() != "none":
                raise LogoError(f"{path}: <{tag}> uses a filter, which PowerPoint's "
                                "import drops with the element; use a logo without one")
            else:
                check_refs(v, f"<{tag} {kl}>")
                out.set(kl, v)
        if "filter" in merged and merged["filter"][0].strip() != "none":
            raise LogoError(f"{path}: <{tag}> uses a filter in its style, which "
                            "PowerPoint's import drops with the element")
        for prop, (value, _imp) in merged.items():
            check_refs(value, f"<{tag}> style {prop}")
        own = merged["font-family"][0] if "font-family" in merged else out.get("font-family")
        family = own or family
        if tag in TEXT_TAGS:
            has_text = True
            # A document page that forces one face on every element would
            # re-face the logo's words; an inline !important outranks it.
            if family:
                merged["font-family"] = (family, True)
                out.attrib.pop("font-family", None)
        if merged:
            out.set("style", _style_text([(p, v, i) for p, (v, i) in merged.items()]))
        out.text, out.tail = el.text, el.tail
        for child in el:
            kept = clean(child, family)
            if kept is not None:
                out.append(kept)
            elif child.tail and len(out):
                out[-1].tail = (out[-1].tail or "") + child.tail
            elif child.tail:
                out.text = (out.text or "") + child.tail
        return out

    base = clean(root, None)
    root_attrs = [(k, v) for k, v in base.attrib.items() if k not in ROOT_ONLY]
    if base.get("style"):
        root_attrs.append(("style", base.get("style")))
    children = list(base)
    if not children:
        raise LogoError(f"{path}: draws nothing once sanitized")
    return Logo(name or path.stem, path, viewbox, root_attrs, children,
                frozenset(ids), has_text)


# ── reading a saved figure ────────────────────────────────────────────────
def _spans(markup):
    """(start, end, open tag, name) of every placed logo, outermost only."""
    out = []
    pos = 0
    while True:
        m = LOGO_OPEN.search(markup, pos)
        if not m:
            return out
        if m.group(0).endswith("/>"):
            out.append((m.start(), m.end(), m.group(0), html.unescape(m.group(1))))
            pos = m.end()
            continue
        depth, scan = 1, m.end()
        while depth:
            t = SVG_TAG.search(markup, scan)
            if not t:
                raise LogoError(f"placed logo {m.group(1)!r} is never closed")
            if t.group(1):
                depth -= 1
            elif not t.group(2):
                depth += 1
            scan = t.end()
        out.append((m.start(), scan, m.group(0), html.unescape(m.group(1))))
        pos = scan


def _num(tag, key):
    m = re.search(rf'(?<![\w-]){key}="([\-\d.e]+)"', tag)
    return float(m.group(1)) if m else 0.0


def logo_boxes(markup):
    """(name, x, y, w, h) of every logo placed in a saved figure."""
    return [(name, _num(tag, "x"), _num(tag, "y"), _num(tag, "width"), _num(tag, "height"))
            for _s, _e, tag, name in _spans(markup)]


def opaque_view(markup):
    """The figure with each placed logo replaced by one named, unfilled box.

    The box carries `data-measure="width"` because a row of logos is uneven in
    width by nature, as a row of badges is; it is still a solid for overlap,
    containment and the board edge.
    """
    spans = _spans(markup)
    if not spans:
        return markup
    out, pos = [], 0
    for start, end, tag, name in spans:
        x, y, w, h = (_num(tag, k) for k in ("x", "y", "width", "height"))
        out.append(markup[pos:start])
        out.append(f'<rect x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}" fill="none" '
                   f'stroke="none" data-logo="{html.escape(name, quote=True)}" '
                   f'data-measure="width"/>')
        pos = end
    out.append(markup[pos:])
    return "".join(out)


def outside_logos(markup, fn):
    """Apply `fn` to the figure's own markup, leaving every placed logo as it is."""
    spans = _spans(markup)
    if not spans:
        return fn(markup)
    kept, pieces, pos = [], [], 0
    for k, (start, end, _tag, _name) in enumerate(spans):
        pieces.append(markup[pos:start])
        pieces.append(f"\x00logo{k}\x00")
        kept.append(markup[start:end])
        pos = end
    pieces.append(markup[pos:])
    done = fn("".join(pieces))
    return re.sub(r"\x00logo(\d+)\x00", lambda m: kept[int(m.group(1))], done)
