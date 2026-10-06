"""deliver: copies, versioned pairs, the PDF route and the folder rules, on fixtures only."""
import base64
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
import zipfile
from argparse import Namespace
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE.parents[4] / "scripts"))

import deliver  # noqa: E402
from bidkit.config import ConfigError, Project  # noqa: E402

FIGURE = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600"><text font-family="Inter, system-ui">라벨</text></svg>'
PAGE = ('<svg xmlns="http://www.w3.org/2000/svg"><text>본문</text><image x="10" y="20" width="300" height="150" '
        f'href="data:image/svg+xml;base64,{base64.b64encode(FIGURE.encode()).decode()}"/></svg>')


def pptx(path: Path, slides: int, creator: str = "", company: str = "") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w") as z:
        for i in range(1, slides + 1):
            z.writestr(f"ppt/slides/slide{i}.xml", "<p:sld/>")
        z.writestr("ppt/presentation.xml", "<p:presentation/>")
        z.writestr("docProps/core.xml", f"<cp:coreProperties><dc:title>사업 제안서</dc:title>"
                                        f"<dc:creator>{creator}</dc:creator></cp:coreProperties>")
        z.writestr("docProps/app.xml", f"<Properties><Company>{company}</Company></Properties>")


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

    def run_delivery(self, runner=None, pages=2, raster=False, pdf_props=None, **kw):
        runner = runner or FakeRunner()
        log = []
        d = deliver.Deliverer(self.project, deliver.settings(self.project, raster), runner,
                              shrink=lambda pdf, dpi, q: pages, log=log.append,
                              properties=pdf_props or (lambda pdf: {"producer": "rsvg"}))
        code = deliver.deliver(self.project, args(**kw), d)
        return code, runner, log

    def test_the_proposer_s_name_in_the_blind_copy_s_properties_fails(self):
        pptx(self.root / "proposal" / "out" / "main.pptx", 2, creator="(주)가나다정보")
        code, _, log = self.run_delivery()
        self.assertEqual(code, 1)
        self.assertTrue(any("✖ blind copy: 사업_제안서(평가본_비계량).pptx docProps/core.xml carries 「(주)가나다정보」"
                            in line for line in log), log)

    def test_the_proposer_s_name_in_the_blind_pdf_fails_and_the_original_is_not_read(self):
        def props(pdf):
            return {"author": "(주)가나다정보"} if "평가본" in pdf.name else {"author": "anyone"}
        code, _, log = self.run_delivery(pdf_props=props)
        self.assertEqual(code, 1)
        self.assertTrue(any("(평가본_비계량).pdf author carries 「(주)가나다정보」" in line for line in log), log)
        self.assertFalse(any("원본" in line and "blind copy" in line for line in log), log)

    def test_a_person_field_that_names_no_proposer_is_printed_and_passes(self):
        pptx(self.root / "proposal" / "out" / "main.pptx", 2, creator="편집자", company="")
        code, _, log = self.run_delivery()
        self.assertEqual(code, 0)
        self.assertTrue(any("⚠ blind copy:" in line and "dc:creator 「편집자」" in line for line in log), log)

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
