"""Printed uses and spans, the source tree, the server's layout, font metrics, the built pptx."""
import json
import os
import struct
import tempfile
import time
import unittest
import zipfile
from pathlib import Path

from bidkit import glyphwidth, layout, pptxread, srctree
from bidkit.config import ConfigError
from bidkit.deckread import DeckError
from bidkit.tests.support import body, project, reader, recording


def tiny_font(path: Path, widths: dict, upem: int = 1000) -> Path:
    """Write a TrueType file with a format 4 cmap mapping each char of `widths` to a glyph."""
    chars = sorted(widths)
    advances = [500] + [widths[c] for c in chars]          # glyph 0 is .notdef
    head = bytearray(54)
    struct.pack_into(">H", head, 18, upem)
    hhea = bytearray(36)
    struct.pack_into(">H", hhea, 34, len(advances))
    hmtx = b"".join(struct.pack(">Hh", a, 0) for a in advances)
    codes = [ord(c) for c in chars]
    segs = [(c, c, (i + 1 - c) & 0xFFFF) for i, c in enumerate(codes)] + [(0xFFFF, 0xFFFF, 1)]
    n = len(segs)
    sub = struct.pack(">HHHHHHH", 4, 16 + 8 * n, 0, 2 * n, 0, 0, 0)
    sub += b"".join(struct.pack(">H", e) for _, e, _ in segs) + b"\x00\x00"
    sub += b"".join(struct.pack(">H", s) for s, _, _ in segs)
    sub += b"".join(struct.pack(">H", d) for _, _, d in segs)
    sub += b"".join(struct.pack(">H", 0) for _ in segs)
    cmap = struct.pack(">HHHHI", 0, 1, 3, 1, 12) + sub
    tables = {"cmap": cmap, "head": bytes(head), "hhea": bytes(hhea), "hmtx": hmtx}
    out = bytearray(struct.pack(">IHHHH", 0x00010000, len(tables), 0, 0, 0))
    offset = 12 + 16 * len(tables)
    blobs = b""
    for name, data in tables.items():
        out += struct.pack(">4sIII", name.encode(), 0, offset + len(blobs), len(data))
        blobs += data + b"\x00" * (-len(data) % 4)
    path.write_bytes(bytes(out) + blobs)
    return path


class PrintedUsesTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.deck = project(Path(self.tmp.name), {})

    def tearDown(self):
        self.tmp.cleanup()

    def test_uses_nest_and_spans_name_their_component_and_field(self):
        s = body(1, 3, 1)
        group = s["blocks"][0]["children"]
        group.append({"role": "use", "key": "node#7", "tag": "cols2", "attrs": {}, "children": [
            {"role": "use", "key": "node#8", "tag": "figure", "attrs": {"src": "a.svg"}, "children": []},
            {"role": "use", "key": "node#9", "tag": "prose", "attrs": {"text": "문장이다."}, "children": [
                {"role": "text", "key": "node#10", "text": "문장이다.", "origin": "←arg:text"}]}]})
        page = reader(self.deck, recording(slides=[s])).slides()[0]
        self.assertEqual([(u.tag, u.depth, u.parent) for u in page.uses],
                         [("cols2", 0, None), ("figure", 1, "cols2"), ("prose", 1, "cols2")])
        span = page.spans[-1]
        self.assertEqual((span.text, span.component, span.origin, span.field),
                         ("문장이다.", "prose", "arg:text", "text"))
        self.assertEqual(len(page.spans), len(page.texts))

    def test_templates_and_slide_sources(self):
        rec = recording(files={"pages/a.xml": "<Fragment/>"}, slides=[body(1, 3, 1)])
        rec["resources"]["sg://deck/markup"] += ('=== file: kit:k/components/x.xml\n'
                                                 '<Template\n  name="card"\n  kind="card"\n  form="card">'
                                                 '<Param name="head" /></Template>\n')
        rec["resources"]["sg://deck"] = ("generation 1\n"
                                         "1  master=BODY-3  nodes=5  diag=0  \"t\"  use:pages/a.xml#1 › x\n")
        r = reader(self.deck, rec)
        self.assertEqual(r.templates()["card"]["kind"], "card")
        self.assertEqual(r.slide_sources(), {1: "a.xml"})


class SourceTreeTests(unittest.TestCase):
    def test_slots_are_read_through_and_values_unescaped(self):
        root = srctree.parse('<Use template="list" items="[{&quot;text&quot;: &quot;a&quot;}]">'
                             '<Slot name="default"><Use template="list-row" text="b"/></Slot></Use>'
                             '<!-- <Use template="ghost"/> -->')
        top = root.kids[0]
        self.assertEqual(top.attrs["items"], '[{"text": "a"}]')
        self.assertEqual([k.template for k in top.content()], ["list-row"])
        self.assertEqual(top.content()[0].holder().template, "list")
        self.assertEqual([n.template for n in root.walk() if n.template], ["list", "list-row"])


SPACE = """slide 6  793×1122  root node#1 [0,0 793×1122]  edges top 0
node#1  VStack  [0,0 793×1122]  pad 31/24/58/24  inner [24,31 745×1033]  gap 0  children 1  extent 1033  slack 0  cross-slack 0
  node#2  VStack  [56,236 681×828]  pad 0  inner [56,236 681×828]  gap 16  children 2  extent 794  slack 34
    node#3  Text  [56,236 681×40]  margin 16/0/0/0  "가. 제목 "따옴표" 끝"  30.0071px×1.115  box-lines 1
    node#4  Image  [56,300 681×355]
3 nodes · 2 containers · 2 leaves"""


class LayoutTests(unittest.TestCase):
    def test_space_reading_parses_boxes_texts_and_slack(self):
        root, index = layout.parse(SPACE)
        self.assertEqual(root.key, "node#1")
        col = index["node#2"]
        self.assertEqual((col.extent, col.slack, col.inner), (794.0, 34.0, (56.0, 236.0, 681.0, 828.0)))
        text = index["node#3"]
        self.assertEqual((text.text, text.size_px, text.lines), ('가. 제목 "따옴표" 끝', 30.0071, 1.0))
        self.assertEqual(col.ink_bottom(), 655.0)
        self.assertIs(text.parent, col)

    def test_an_empty_reading_is_an_error(self):
        with self.assertRaises(DeckError):
            layout.parse("slide 1  793×1122\n")


class GlyphWidthTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_widths_come_from_the_face(self):
        font = glyphwidth.Font(tiny_font(self.dir / "Face-Regular.ttf", {"가": 920, "A": 610}))
        self.assertAlmostEqual(font.width("가"), 0.92)
        self.assertAlmostEqual(font.text_width("가A"), 1.53)
        font.width("Z")
        self.assertEqual(font.missing, {"Z"})

    def test_a_broken_face_is_an_error_never_an_estimate(self):
        bad = self.dir / "Broken.ttf"
        bad.write_bytes(b"\x00\x01\x00\x00\x00\x09garbage")
        with self.assertRaises(glyphwidth.FontError):
            glyphwidth.Font(bad)
        with self.assertRaises(glyphwidth.FontError):
            glyphwidth.Font(self.dir / "absent.ttf")

    def test_the_face_is_found_among_the_deck_fonts_by_family_and_weight(self):
        path = tiny_font(self.dir / "Face-Regular.ttf", {"가": 900})
        deck = project(self.dir, {})
        rec = recording(slides=[])
        rec["resources"]["sg://deck"] = f"options autoFit=true fonts={path},/x/Other-Bold.ttf masterPptx=-\n"
        r = reader(deck, rec)
        r.vocab.data["fonts"] = {"sans": "Face"}
        self.assertEqual(glyphwidth.face(r, deck, r.vocab, "sans").path, path)
        with self.assertRaises(glyphwidth.FontError):
            glyphwidth.face(r, deck, r.vocab, "sans", "Bold")
        with self.assertRaises(glyphwidth.FontError):
            glyphwidth.face(r, deck, r.vocab, "mono")

    def test_a_relative_deck_font_resolves_against_the_deck_folder_not_the_cwd(self):
        deck = project(self.dir, {})
        rec = recording(slides=[])
        r = reader(deck, rec)
        base = Path(r.session.path).parent
        fonts = base / "fonts"
        fonts.mkdir(parents=True, exist_ok=True)
        path = tiny_font(fonts / "Face-Regular.ttf", {"가": 900})
        rec["resources"]["sg://deck"] = "options autoFit=true fonts=fonts/Face-Regular.ttf masterPptx=-\n"
        r = reader(deck, rec)
        r.vocab.data["fonts"] = {"sans": "Face"}
        self.assertEqual(glyphwidth.face(r, deck, r.vocab, "sans").path, path.resolve())


def tiny_pptx(path: Path, slide_xml: str, cx: int = 794 * 9525) -> Path:
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("ppt/presentation.xml", f'<p:presentation><p:sldSz cx="{cx}" cy="10680000"/></p:presentation>')
        z.writestr("ppt/slides/slide1.xml", slide_xml)
    return path


class PptxTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.deck = project(self.root, {"output": "deck/out/main.pptx", "page": {"w": 794}})
        (self.root / "deck" / "page.xml").write_text("<Fragment/>", encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def test_text_boxes_convert_to_px_and_keep_their_runs(self):
        (self.root / "deck" / "out").mkdir()
        xml = ('<p:sp><p:spPr><a:xfrm><a:off x="952500" y="0"/><a:ext cx="1905000" cy="95250"/></a:xfrm>'
               '</p:spPr><p:txBody><a:p><a:r><a:rPr sz="800" b="1"><a:solidFill><a:srgbClr val="646b77"/>'
               '</a:solidFill></a:rPr><a:t>A &amp; B</a:t></a:r></a:p></p:txBody></p:sp>')
        tiny_pptx(self.root / "deck" / "out" / "main.pptx", xml)
        built = pptxread.Built.for_deck(self.deck)
        (box,) = built.text_boxes(1)
        self.assertAlmostEqual(box.x, 100.0, places=3)
        self.assertAlmostEqual(box.w, 200.0, places=3)
        self.assertEqual(box.runs[0].text, "A & B")
        self.assertEqual((box.runs[0].size_pt, box.runs[0].bold, box.runs[0].colour), (8.0, True, "646B77"))

    def test_a_missing_or_stale_build_is_refused(self):
        with self.assertRaises(ConfigError):
            pptxread.output(self.deck)
        (self.root / "deck" / "out").mkdir()
        built = tiny_pptx(self.root / "deck" / "out" / "main.pptx", "")
        old = time.time() - 100
        os.utime(built, (old, old))
        with self.assertRaises(DeckError):
            pptxread.output(self.deck)

    def test_tool_state_in_a_dot_directory_is_not_a_source(self):
        # The editor rewrites .slideglance/journal.json on every connection; a fresh
        # build must not be refused because of it.
        (self.root / "deck" / "out").mkdir()
        built = tiny_pptx(self.root / "deck" / "out" / "main.pptx", "")
        state = self.root / "deck" / ".slideglance" / "journal.json"
        state.parent.mkdir()
        state.write_text("{}")
        later = built.stat().st_mtime + 50
        os.utime(state, (later, later))
        self.assertEqual(pptxread.output(self.deck).resolve(), built.resolve())

    def test_hangul_wraps_between_syllables(self):
        def em(s):
            return len(s.replace(" ", "")) + 0.3 * s.count(" ")
        self.assertEqual(pptxread.wrapped("가나다라마바사아", 40, 10, em), 2)
        self.assertEqual(pptxread.wrapped("가나다라", 40, 10, em), 1)


if __name__ == "__main__":
    unittest.main()
