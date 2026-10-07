"""deliver: copies, versioned pairs, the PDF route and the folder rules, on fixtures only."""
import base64
import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile
from argparse import Namespace
from io import BytesIO
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE.parents[4] / "scripts"))

import deliver  # noqa: E402
from bidkit.config import ConfigError, Project  # noqa: E402

FIGURE = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600"><text font-family="Inter, system-ui">라벨</text></svg>'
PAGE = ('<svg xmlns="http://www.w3.org/2000/svg"><text>본문</text><image x="10" y="20" width="300" height="150" '
        f'href="data:image/svg+xml;base64,{base64.b64encode(FIGURE.encode()).decode()}"/></svg>')


def pptx(path: Path, slides: int, creator: str = "", company: str = "", saver: str = "",
         title: str = "사업 제안서") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("docProps/", b"")
        for i in range(1, slides + 1):
            z.writestr(f"ppt/slides/slide{i}.xml", "<p:sld/>")
        z.writestr("ppt/presentation.xml", "<p:presentation/>")
        z.writestr("docProps/core.xml", f"<cp:coreProperties><dc:title>{title}</dc:title>"
                                        f"<dc:creator>{creator}</dc:creator>"
                                        f"<cp:lastModifiedBy>{saver}</cp:lastModifiedBy></cp:coreProperties>")
        z.writestr("docProps/app.xml", f"<Properties><Company>{company}</Company></Properties>")


def real_pdf(path: Path, author: str) -> Path:
    """A PDF whose information and XMP packet both name `author` (PyMuPDF)."""
    import fitz
    doc = fitz.open()
    doc.new_page()
    doc.set_metadata({"author": author, "title": "제안서"})
    doc.set_xml_metadata('<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF '
                         'xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description '
                         'xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator><rdf:Seq><rdf:li>'
                         f'{author}</rdf:li></rdf:Seq></dc:creator><dc:title>제안서</dc:title>'
                         '</rdf:Description></rdf:RDF></x:xmpmeta>')
    doc.save(path)
    doc.close()
    return path


class FakeRunner:
    """Plays the build, the converter and rsvg-convert; records every call."""

    def __init__(self, text_mode: bool = True):
        self.calls, self.text_mode, self.svgs, self.fontconf = [], text_mode, [], ""

    def __call__(self, argv, check=False, capture_output=False, text=False, **kw):
        self.calls.append(argv)
        if isinstance(argv, str):                       # a build command
            return subprocess.CompletedProcess(argv, 0, "", "")
        if argv[1:3] == ["convert", "--help"]:
            return subprocess.CompletedProcess(argv, 0, "--text  keep text" if self.text_mode else "", "")
        if argv[1] == "convert":
            out = Path(argv[argv.index("--output") + 1])
            for i in (1, 2):
                (out / f"slide-{i}.svg").write_text(PAGE, encoding="utf-8")
            return subprocess.CompletedProcess(argv, 0, "", "")
        if argv[0] == "rsvg-convert":
            self.svgs = [Path(p).read_text(encoding="utf-8") for p in argv[5:]]
            self.fontconf = Path(kw["env"]["FONTCONFIG_FILE"]).read_text(encoding="utf-8")
            Path(argv[argv.index("-o") + 1]).write_bytes(b"%PDF-1.7 fake")
            return subprocess.CompletedProcess(argv, 0, "", "")
        raise AssertionError(f"unexpected call {argv}")


def args(**kw):
    base = {"copy": None, "volume": None, "no_build": False, "scale": None}
    base.update(kw)
    return Namespace(**base)


class DeliverTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        for name in ("proposal", "presentation"):
            d = self.root / name
            (d / "fonts").mkdir(parents=True)
            (d / "fonts" / "Sans-Regular.ttf").write_bytes(b"face")
            pptx(d / "out" / "main.pptx", 2)
        self.config = {
            "decks": {
                "proposal": {"dir": "proposal", "kind": "document", "vocabulary": "simplecore-proposal-01",
                             "render": "render proposal", "output": "proposal/out/main.pptx",
                             "previews": "proposal/out", "page": {"w": 794},
                             "deliverable": {"label": "비계량", "pdfScale": 1.0},
                             "tool": {"binary": "slideglance"}},
                "presentation": {"dir": "presentation", "kind": "slides", "render": "render slides",
                                 "output": "presentation/out/main.pptx", "deliverable": {"label": "발표"},
                                 "tool": {"binary": "slideglance"}}},
            "submission": {"dir": "제출물", "title": "사업_제안서", "blindCopy": "평가본",
                           "build": "{render} --copy {copy}", "pdfLimitMB": {"file": 50, "total": 180},
                           "pdf": {"engine": "slideglance", "imageDpi": 150, "jpegQuality": 88},
                           "copies": {"평가본": {"volumes": ["proposal"]},
                                      "원본": {"volumes": ["proposal", "presentation"]}},
                           "identity": {"원본": {"name": "(주)가나다정보"}, "평가본": {"name": "\u00a0"}}}}
        self.write()

    def tearDown(self):
        self.tmp.cleanup()

    def write(self):
        (self.root / ".claude").mkdir(exist_ok=True)
        (self.root / ".claude" / "slide-decks.json").write_text(json.dumps(self.config, ensure_ascii=False),
                                                                encoding="utf-8")
        self.project = Project.load(self.root)

    def run_delivery(self, runner=None, pages=2, raster=False, pdf_props=None, pdf_clear=None, **kw):
        runner = runner or FakeRunner()
        log = []
        self.cleared_pdfs = []

        def clear(pdf):
            self.cleared_pdfs.append(pdf.name)
            return []
        d = deliver.Deliverer(self.project, deliver.settings(self.project, raster), runner,
                              shrink=lambda pdf, dpi, q: pages, log=log.append,
                              properties=pdf_props or (lambda pdf: {"producer": "rsvg"}),
                              clear_pdf=pdf_clear or clear)
        code = deliver.deliver(self.project, args(**kw), d)
        return code, runner, log

    def core(self, rel: str) -> str:
        with zipfile.ZipFile(self.root / rel) as z:
            return z.read("docProps/core.xml").decode("utf-8")

    def test_the_proposer_s_name_left_in_a_field_nothing_clears_fails(self):
        pptx(self.root / "proposal" / "out" / "main.pptx", 2, title="(주)가나다정보 제안서")
        code, _, log = self.run_delivery()
        self.assertEqual(code, 1)
        self.assertTrue(any("✖ blind copy: 사업_제안서(평가본_비계량).pptx docProps/core.xml carries 「(주)가나다정보」"
                            in line for line in log), log)

    def test_the_blind_copy_s_creator_and_last_saver_are_cleared_and_then_pass(self):
        pptx(self.root / "proposal" / "out" / "main.pptx", 2, creator="(주)가나다정보", saver="SlideGlance")
        code, _, log = self.run_delivery()
        self.assertEqual(code, 0, log)
        blind = self.core("제출물/평가본/pptx/사업_제안서(평가본_비계량).pptx")
        self.assertIn("<dc:creator></dc:creator>", blind)
        self.assertIn("<cp:lastModifiedBy></cp:lastModifiedBy>", blind)
        self.assertIn("(주)가나다정보", self.core("제출물/원본/pptx/사업_제안서(원본_비계량).pptx"))
        self.assertIn("(주)가나다정보", self.core("proposal/out/main.pptx"))   # the deck's own output is untouched
        self.assertTrue(any("cleared 사업_제안서(평가본_비계량).pptx dc:creator 「(주)가나다정보」" in line for line in log), log)
        self.assertEqual(self.cleared_pdfs, ["사업_제안서(평가본_비계량).pdf"])     # the blind PDF only

    def test_clearing_keeps_every_other_part_of_the_package(self):
        path = self.root / "a.pptx"
        pptx(path, 3, creator="(주)가나다정보", saver="SlideGlance")
        with zipfile.ZipFile(path) as z:
            before = [(i.filename, i.compress_type, z.read(i.filename)) for i in z.infolist()]
        held = deliver.clear_pptx_people(path)
        self.assertEqual(held, ["dc:creator 「(주)가나다정보」", "cp:lastModifiedBy 「SlideGlance」"])
        with zipfile.ZipFile(path) as z:
            after = [(i.filename, i.compress_type, z.read(i.filename)) for i in z.infolist()]
        self.assertEqual([a[:2] for a in after], [b[:2] for b in before])
        self.assertEqual([a for a in after if a[0] != "docProps/core.xml"],
                         [b for b in before if b[0] != "docProps/core.xml"])
        self.assertEqual(deliver.clear_pptx_people(path), [])

    def test_the_proposer_s_name_in_the_blind_pdf_fails_and_the_original_is_not_read(self):
        def props(pdf):
            return {"title": "(주)가나다정보 제안서"} if "평가본" in pdf.name else {"author": "anyone"}
        code, _, log = self.run_delivery(pdf_props=props)
        self.assertEqual(code, 1)
        self.assertTrue(any("(평가본_비계량).pdf title carries 「(주)가나다정보」" in line for line in log), log)
        self.assertFalse(any("원본" in line and "blind copy" in line for line in log), log)

    def test_a_person_field_that_names_no_proposer_is_printed_and_passes(self):
        pptx(self.root / "proposal" / "out" / "main.pptx", 2, company="편집 회사")
        code, _, log = self.run_delivery()
        self.assertEqual(code, 0)
        self.assertTrue(any("⚠ blind copy:" in line and "Company 「편집 회사」" in line for line in log), log)

    def test_an_uncleared_pdf_is_said_so(self):
        code, _, log = self.run_delivery(pdf_clear=lambda pdf: None)
        self.assertEqual(code, 0)
        self.assertTrue(any("the PDF's author was not cleared" in line for line in log), log)

    def test_a_cleared_blind_copy_passes_the_property_check(self):
        if importlib.util.find_spec("fitz") is None:
            self.skipTest("PyMuPDF is not installed")
        out = self.root / "제출물" / "평가본"
        out.mkdir(parents=True)
        v = deliver.Volume("평가본", "proposal", self.project.deck("proposal"), out / "a.pptx",
                           real_pdf(out / "a.pdf", "(주)가나다정보"), True)
        pptx(v.pptx, 2, creator="(주)가나다정보", saver="(주)가나다정보")
        names = deliver.proposer_names(self.project)
        found, _ = deliver.blind_properties(v, names, deliver.pdf_properties)
        self.assertEqual(found, ["a.pptx docProps/core.xml carries 「(주)가나다정보」",
                                 "a.pdf author carries 「(주)가나다정보」", "a.pdf xmp carries 「(주)가나다정보」"])
        self.assertEqual(deliver.clear_pptx_people(v.pptx), ["dc:creator 「(주)가나다정보」",
                                                            "cp:lastModifiedBy 「(주)가나다정보」"])
        self.assertEqual(deliver.clear_pdf_author(v.pdf), ["author 「(주)가나다정보」", "XMP dc:creator"])
        found, notes = deliver.blind_properties(v, names, deliver.pdf_properties)
        self.assertEqual((found, notes), ([], []))
        self.assertNotIn("가나다".encode("utf-8"), v.pdf.read_bytes())

    def test_unread_pdf_properties_are_said_so(self):
        code, _, log = self.run_delivery(pdf_props=lambda pdf: None)
        self.assertEqual(code, 0)
        self.assertTrue(any("PDF's properties were not read" in line for line in log), log)

    def test_the_real_reader_reads_a_pdf_s_author(self):
        if importlib.util.find_spec("fitz") is None:
            self.skipTest("PyMuPDF is not installed")
        import fitz
        pdf = self.root / "a.pdf"
        doc = fitz.open()
        doc.new_page()
        doc.set_metadata({"author": "(주)가나다정보", "title": "제안서"})
        doc.save(pdf)
        doc.close()
        self.assertEqual(deliver.pdf_properties(pdf).get("author"), "(주)가나다정보")

    def test_every_copy_is_written_and_the_blind_copy_is_built_last(self):
        code, runner, _ = self.run_delivery()
        self.assertEqual(code, 0)
        builds = [c for c in runner.calls if isinstance(c, str)]
        self.assertEqual(builds, ["render proposal --copy 원본", "render slides --copy 원본",
                                  "render proposal --copy 평가본"])
        for rel in ("제출물/원본/pdf/사업_제안서(원본_비계량).pdf", "제출물/원본/pptx/사업_제안서(원본_발표).pptx",
                    "제출물/평가본/pdf/사업_제안서(평가본_비계량).pdf"):
            self.assertTrue((self.root / rel).is_file(), rel)
        self.assertFalse((self.root / "제출물" / "평가본" / "pdf" / "사업_제안서(평가본_발표).pdf").exists())

    def test_figures_are_inlined_as_vector_in_the_kit_sans_face(self):
        _, runner, _ = self.run_delivery()
        page = runner.svgs[0]
        self.assertNotIn("data:image/svg+xml", page)
        self.assertIn('<svg x="10" y="20" width="300" height="150"', page)
        self.assertIn('font-family="Pretendard"', page)
        self.assertNotIn("Inter", page)
        self.assertIn(f"<dir>{(self.root / 'proposal' / 'fonts').resolve()}</dir>", runner.fontconf)
        convert = next(c for c in runner.calls if isinstance(c, list) and c[1] == "convert" and "--text" in c)
        self.assertIn(str((self.root / "proposal" / "fonts" / "Sans-Regular.ttf").resolve()), convert)

    def test_a_file_the_run_did_not_write_is_removed_and_others_kept(self):
        stale = self.root / "제출물" / "원본" / "pdf" / "사업_제안서(원본_옛이름).pdf"
        other = self.root / "제출물" / "원본" / "pdf" / "메모.txt"
        stale.parent.mkdir(parents=True)
        stale.write_bytes(b"old")
        other.write_text("keep", encoding="utf-8")
        self.run_delivery()
        self.assertFalse(stale.exists())
        self.assertTrue(other.exists())

    def test_a_declared_name_and_layout_place_the_files_and_decide_what_is_stale(self):
        self.config["submission"]["name"] = "{title}_{copy}_{label}"
        self.config["submission"]["layout"] = "{copy}"
        self.write()
        folder = self.root / "제출물" / "원본"
        stale = folder / "사업_제안서_원본_옛이름.pdf"
        default_shape = folder / "pdf" / "사업_제안서(원본_비계량).pdf"
        other = folder / "메모.txt"
        default_shape.parent.mkdir(parents=True)
        for p in (stale, default_shape):
            p.write_bytes(b"old")
        other.write_text("keep", encoding="utf-8")
        code, _, log = self.run_delivery()
        self.assertEqual(code, 0, log)
        for rel in ("제출물/원본/사업_제안서_원본_비계량.pdf", "제출물/원본/사업_제안서_원본_발표.pptx",
                    "제출물/평가본/사업_제안서_평가본_비계량.pdf"):
            self.assertTrue((self.root / rel).is_file(), rel)
        self.assertFalse(stale.exists())
        self.assertTrue(default_shape.exists())        # a shape the templates do not produce is not this run's
        self.assertTrue(other.exists())
        self.assertTrue(any("PDF size: 3 files" in line for line in log), log)

    def test_neither_template_declared_keeps_the_default_names(self):
        n = deliver.Naming.of(self.project)
        self.assertEqual(n.path("원본", "proposal", "비계량", "pdf").relative_to(self.project.root).as_posix(),
                         "제출물/원본/pdf/사업_제안서(원본_비계량).pdf")
        self.assertEqual(n.pdf_glob(), "*/pdf/*.pdf")
        self.assertTrue(n.written_by("원본").match("원본/pptx/사업_제안서(원본_옛이름).pptx"))
        self.assertFalse(n.written_by("원본").match("평가본/pptx/사업_제안서(평가본_비계량).pptx"))

    def test_templates_that_give_two_volumes_one_file_are_refused(self):
        self.config["submission"]["name"] = "{title}_{label}"
        self.config["submission"]["layout"] = "{ext}"
        self.write()
        with self.assertRaises(ConfigError):
            deliver.plan(self.project, None, None)

    def test_a_template_field_the_delivery_does_not_know_is_refused(self):
        for key, value in (("name", "{title}_{date}"), ("layout", "{copy}/{ext!r}"), ("layout", "../{copy}")):
            self.config["submission"][key] = value
            self.write()
            with self.assertRaises(ConfigError, msg=value):
                deliver.plan(self.project, None, None)
            del self.config["submission"][key]

    def test_one_volume_run_removes_nothing_else(self):
        stale = self.root / "제출물" / "원본" / "pdf" / "사업_제안서(원본_옛이름).pdf"
        stale.parent.mkdir(parents=True)
        stale.write_bytes(b"old")
        self.run_delivery(volume="presentation")
        self.assertTrue(stale.exists())

    def test_pdf_page_count_must_match_the_pptx(self):
        with self.assertRaises(deliver.DeliveryError):
            self.run_delivery(pages=3)

    def test_converter_without_text_mode_is_refused_not_rasterised(self):
        with self.assertRaises(deliver.DeliveryError):
            self.run_delivery(FakeRunner(text_mode=False))

    def test_several_copies_need_a_build_template(self):
        del self.config["submission"]["build"]
        self.write()
        with self.assertRaises(ConfigError):
            self.run_delivery()

    def test_no_build_needs_a_copy_when_several_are_declared(self):
        with self.assertRaises(ConfigError):
            self.run_delivery(no_build=True)
        code, runner, _ = self.run_delivery(no_build=True, copy="평가본")
        self.assertEqual([c for c in runner.calls if isinstance(c, str)], [])

    def test_resampling_settings_are_required_for_the_vector_route(self):
        del self.config["submission"]["pdf"]["imageDpi"]
        self.write()
        with self.assertRaises(ConfigError):
            deliver.settings(self.project, raster=False)
        self.assertEqual(deliver.settings(self.project, raster=True).engine, "raster")

    def test_folder_over_its_limit_fails(self):
        self.config["submission"]["pdfLimitMB"] = {"file": 0.000001, "total": 180}
        self.write()
        code, _, log = self.run_delivery()
        self.assertEqual(code, 1)
        self.assertTrue(any("over the" in line for line in log))


class VersionedTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        d = self.root / "deck"
        (d / "fonts").mkdir(parents=True)
        (d / "fonts" / "Sans.ttf").write_bytes(b"face")
        pptx(d / "out" / "main.pptx", 2)
        (self.root / "tools").mkdir()
        (self.root / "tools" / "version.txt").write_text("0.2\n", encoding="utf-8")
        for old in ("[발주기관] 제안서 v0.1.pdf", "[발주기관] 제안서 v0.1.pptx", "제안서.pdf", "[발주기관] 다른 문서 v0.1.pdf"):
            (self.root / old).write_bytes(b"old")
        config = {"decks": {"proposal": {"dir": "deck", "kind": "document", "render": "render deck",
                                         "output": "deck/out/main.pptx", "previews": "deck/out",
                                         "page": {"w": 794}, "tool": {"binary": "slideglance"}}},
                  "submission": {"versioned": {"deck": "proposal", "name": "[발주기관] 제안서 v{version}",
                                               "versionFile": "tools/version.txt", "dir": ".",
                                               "legacy": ["제안서.pdf"]},
                                 "pdf": {"imageDpi": 150, "jpegQuality": 88}}}
        (self.root / ".claude").mkdir()
        (self.root / ".claude" / "slide-decks.json").write_text(json.dumps(config, ensure_ascii=False),
                                                                encoding="utf-8")
        self.project = Project.load(self.root)

    def tearDown(self):
        self.tmp.cleanup()

    def test_version_bump_leaves_one_pair(self):
        d = deliver.Deliverer(self.project, deliver.settings(self.project, False), FakeRunner(),
                              shrink=lambda pdf, dpi, q: 2, log=lambda s: None)
        self.assertEqual(deliver.deliver(self.project, args(), d), 0)
        names = sorted(p.name for p in self.root.iterdir() if p.is_file())
        self.assertEqual(names, ["[발주기관] 다른 문서 v0.1.pdf", "[발주기관] 제안서 v0.2.pdf", "[발주기관] 제안서 v0.2.pptx"])

    def test_version_file_must_hold_a_version(self):
        (self.root / "tools" / "version.txt").write_text("next one\n", encoding="utf-8")
        with self.assertRaises(ConfigError):
            deliver.plan(self.project, None, None)


@unittest.skipUnless(importlib.util.find_spec("fitz") and importlib.util.find_spec("PIL")
                     and shutil.which("rsvg-convert"), "needs PyMuPDF, Pillow and rsvg-convert")
class ShrinkTests(unittest.TestCase):
    """The image rewrite on a PDF rsvg-convert drew: gradient text beside a picture to resample."""

    def setUp(self):
        from PIL import Image
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        buf = BytesIO()
        Image.new("RGB", (1200, 1200), (200, 30, 30)).save(buf, "PNG")
        svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><defs>'
               '<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="40" '
               'spreadMethod="repeat"><stop offset="0" stop-color="#123"/><stop offset="1" stop-color="#48c"/>'
               '</linearGradient></defs><text x="10" y="40" font-size="32" fill="url(#g)">제목</text>'
               '<image x="10" y="60" width="100" height="100" href="data:image/png;base64,'
               f'{base64.b64encode(buf.getvalue()).decode()}"/></svg>')
        (root / "page.svg").write_text(svg, encoding="utf-8")
        self.pdf = root / "page.pdf"
        subprocess.run(["rsvg-convert", "-f", "pdf", "-o", str(self.pdf), str(root / "page.svg")], check=True)

    def tearDown(self):
        self.tmp.cleanup()

    def test_gradient_text_keeps_its_pattern_through_the_image_rewrite(self):
        import fitz
        self.assertEqual(deliver.shrink_images(self.pdf, 150, 88), 1)
        doc = fitz.open(self.pdf)
        self.assertEqual(deliver.undefined_resources(doc), [])
        self.assertNotEqual(doc.xref_get_key(doc[0].xref, "Resources/Pattern")[0], "null")

    def test_a_pattern_the_page_names_and_lacks_is_reported(self):
        import fitz
        doc = fitz.open(self.pdf)
        self.assertEqual(deliver.undefined_resources(doc), [])
        doc.xref_set_key(doc[0].xref, "Resources/Pattern", "null")
        lost = deliver.undefined_resources(doc)
        self.assertEqual(len(lost), 1)
        self.assertTrue(lost[0].startswith("page 1: Pattern /"), lost)


class VersionedWithCopiesTests(unittest.TestCase):
    """`versioned` beside `copies`: one run writes the submission folder and the pair."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        for name in ("proposal", "quant"):
            d = self.root / name
            (d / "fonts").mkdir(parents=True)
            (d / "fonts" / "Sans.ttf").write_bytes(b"face")
            pptx(d / "out" / "main.pptx", 2)
        (self.root / "tools").mkdir()
        (self.root / "tools" / "version.txt").write_text("0.3\n", encoding="utf-8")
        for old in ("[발주기관] 제안서 v0.2.pdf", "[발주기관] 제안서 v0.2.pptx"):
            (self.root / old).write_bytes(b"old")
        self.config = {
            "decks": {name: {"dir": name, "kind": "document", "render": f"render {name}",
                             "output": f"{name}/out/main.pptx", "previews": f"{name}/out", "page": {"w": 794},
                             "deliverable": {"label": label}, "tool": {"binary": "slideglance"}}
                      for name, label in (("proposal", "비계량"), ("quant", "계량"))},
            "submission": {"dir": "제출물", "title": "사업_제안서", "name": "{title}({label})", "layout": "{ext}",
                           "pdf": {"imageDpi": 150, "jpegQuality": 88},
                           "copies": {"제출본": {"volumes": ["quant", "proposal"]}},
                           "versioned": {"deck": "proposal", "name": "[발주기관] 제안서 v{version}",
                                         "versionFile": "tools/version.txt", "dir": "."}}}
        self.write()

    def tearDown(self):
        self.tmp.cleanup()

    def write(self):
        (self.root / ".claude").mkdir(exist_ok=True)
        (self.root / ".claude" / "slide-decks.json").write_text(json.dumps(self.config, ensure_ascii=False),
                                                                encoding="utf-8")
        self.project = Project.load(self.root)

    def run_delivery(self, **kw):
        runner = FakeRunner()
        d = deliver.Deliverer(self.project, deliver.settings(self.project, False), runner,
                              shrink=lambda pdf, dpi, q: 2, log=lambda s: None)
        return deliver.deliver(self.project, args(**kw), d), runner

    def test_one_run_writes_the_folder_and_the_pair_building_each_deck_once(self):
        code, runner = self.run_delivery()
        self.assertEqual(code, 0)
        self.assertEqual([c for c in runner.calls if isinstance(c, str)], ["render quant", "render proposal"])
        for rel in ("제출물/pdf/사업_제안서(계량).pdf", "제출물/pptx/사업_제안서(비계량).pptx",
                    "[발주기관] 제안서 v0.3.pdf", "[발주기관] 제안서 v0.3.pptx"):
            self.assertTrue((self.root / rel).is_file(), rel)
        self.assertFalse((self.root / "[발주기관] 제안서 v0.2.pdf").exists())

    def test_a_volume_limit_excluding_the_pair_s_deck_leaves_the_pair_alone(self):
        code, runner = self.run_delivery(volume="quant")
        self.assertEqual(code, 0)
        self.assertEqual([c for c in runner.calls if isinstance(c, str)], ["render quant"])
        self.assertTrue((self.root / "[발주기관] 제안서 v0.2.pdf").exists())
        self.assertFalse((self.root / "[발주기관] 제안서 v0.3.pdf").exists())

    def test_the_pair_s_source_copy_must_carry_its_deck(self):
        self.config["submission"]["versioned"]["copy"] = "평가본"
        self.write()
        with self.assertRaises(ConfigError):
            deliver.plan(self.project, None, None)


@unittest.skipUnless(importlib.util.find_spec("PIL") and importlib.util.find_spec("img2pdf"),
                     "the raster route needs Pillow and img2pdf")
class RasterTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        from PIL import Image
        out = self.root / "deck" / "out"
        pptx(out / "main.pptx", 2)
        for i in (1, 2, 3):              # slide-3 is left over from a longer render
            Image.new("RGB", (794, 1123), (255, 255, 255)).save(out / f"slide-{i}.png")
        config = {"decks": {"proposal": {"dir": "deck", "kind": "document", "output": "deck/out/main.pptx",
                                         "previews": "deck/out", "page": {"w": 794}, "render": "r",
                                         "deliverable": {"label": "본문", "pdfScale": 0.5}}},
                  "submission": {"dir": "제출물", "title": "t", "copies": {"원본": {"volumes": ["proposal"]}}}}
        (self.root / ".claude").mkdir()
        (self.root / ".claude" / "slide-decks.json").write_text(json.dumps(config, ensure_ascii=False),
                                                                encoding="utf-8")
        self.project = Project.load(self.root)

    def tearDown(self):
        self.tmp.cleanup()

    def test_raster_stitches_one_page_per_slide_and_drops_the_leftover(self):
        d = deliver.Deliverer(self.project, deliver.settings(self.project, True), FakeRunner(), log=lambda s: None)
        self.assertEqual(deliver.deliver(self.project, args(no_build=True), d), 0)
        pdf = self.root / "제출물" / "원본" / "pdf" / "t(원본_본문).pdf"
        self.assertEqual(pdf.read_bytes().count(b"/Type /Page\n") + pdf.read_bytes().count(b"/Type /Page "), 2)
        self.assertFalse((self.root / "deck" / "out" / "slide-3.png").exists())

    def test_missing_preview_is_an_error(self):
        (self.root / "deck" / "out" / "slide-2.png").unlink()
        d = deliver.Deliverer(self.project, deliver.settings(self.project, True), FakeRunner(), log=lambda s: None)
        with self.assertRaises(deliver.DeliveryError):
            deliver.deliver(self.project, args(no_build=True), d)


if __name__ == "__main__":
    unittest.main()
