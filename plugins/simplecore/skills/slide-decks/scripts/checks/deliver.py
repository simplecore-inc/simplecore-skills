#!/usr/bin/env python3
"""Build the submission: every copy the declaration names, every volume in it, into one folder.

    deliver.py                        # every copy, every volume
    deliver.py --copy 평가본           # one copy
    deliver.py --volume presentation  # one volume, in every copy that carries it
    deliver.py --no-build             # assemble from each deck's output as it stands
    deliver.py --raster               # PDF stitched from the previews (no searchable text)

Everything comes from the top-level `submission` of `.claude/slide-decks.json`:
the folder, the file title, which volumes each copy carries, and how the PDF
is made. For every (copy, volume) the deck is built for that copy, then the
built pptx is copied and its PDF written at

    <dir>/<layout>/<name>.pptx
    <dir>/<layout>/<name>.pdf

`submission.name` is a template over `{title}`, `{copy}`, `{label}` (the deck's
`deliverable.label`) and `{deck}`, `{title}({copy}_{label})` when absent;
`submission.layout` is the folder under `dir`, a template over the same fields
and `{ext}` (`pptx` or `pdf`), `{copy}/{ext}` when absent, and empty for one
flat folder. Two volumes the templates give one path is a configuration error.

A submission that ships one versioned pair declares `submission.versioned`
(`deck`, `name` with `{version}`, `versionFile`, `dir`, `legacy`): the pair is
written as `<dir>/<name>.pdf` and `.pptx`, and every file carrying the same
name with another version, and every legacy file, is removed, so a version
bump leaves exactly one pair. Declared without `copies`, the pair is the whole
submission. Declared beside `copies`, one run writes both: the pair is
assembled from the same build as its deck's volume in `versioned.copy` (the
first declared copy carrying the deck when absent), so the deck is not built
twice, and a run limited by `--copy` or `--volume` writes the pair only when
the limit includes that volume.

The PDF keeps the type as text. `submission.pdf.engine` names what draws it:

- `slideglance` (default): `slideglance convert --text` writes each slide as
  SVG whose type is `<text>`; a figure the converter embedded as an SVG data
  URL is inlined as a nested `<svg>` so it stays vector with its labels as
  text, its font family set to the kit's sans face; `rsvg-convert` binds the
  pages with the deck's faces embedded. The faces are `submission.pdf.fonts`,
  else the deck's `slideglance.json` `build.fonts`, else `<deck dir>/fonts/`.
- `powerpoint`: Microsoft PowerPoint's own PDF export on macOS.

Every embedded picture is then resampled to `submission.pdf.imageDpi` where it
is placed and re-encoded at `jpegQuality`, and the faces are subset (PyMuPDF).
`--raster` (or `engine: "raster"`) stitches the previews instead, at
`deliverable.pdfScale` of their size (Pillow and img2pdf); the script never
falls back to it on its own.

The blind copy (`submission.blindCopy`) is built last, so each deck's output,
which every check and review reads, is left holding the copy the panel sees.
A whole run owns its copy folders: a file the two templates produce for a copy
the run wrote, with any label and any deck, that the run did not write is
removed. The folder's PDFs (every `.pdf` in a folder the layout produces) are
measured against `submission.pdfLimitMB` after every run.

The blind copy names nobody in its document properties, so they are cleared
and then read. Clearing empties the pptx's `dc:creator` and
`cp:lastModifiedBy` before its PDF is made, and the PDF's author and its XMP
`dc:creator` after; the deck's own output keeps what its tool wrote. Reading
covers the pptx's `docProps` parts and the PDF's information and XMP packet:
a proposer name another copy's `identity` declares, found in any of them,
fails the run, and a person or company field that still carries anything
(`dc:creator`, `cp:lastModifiedBy`, `Company`, `Manager`, the PDF's author) is
printed. Without PyMuPDF the PDF is neither cleared nor read, and the run says
so.

The build: a deck's `render` command, or `submission.build`, a command
template over `{render}`, `{copy}` and `{deck}`, which a submission with more
than one copy must declare, since one render command cannot print two copies.
"""
from __future__ import annotations

import base64
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from argparse import ArgumentParser
from dataclasses import dataclass
from html import unescape
from importlib import import_module
from io import BytesIO
from pathlib import Path
from string import Formatter
from typing import Any, Callable

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit.config import ConfigError, DeckConfig, Project, parse_jsonc  # noqa: E402
from bidkit.sgmcp import DeckUnavailable, binary  # noqa: E402
from bidkit.vocab import Vocabulary  # noqa: E402

SLIDE_XML = re.compile(r"ppt/slides/slide(\d+)\.xml")
PT_PER_CSS_PX = 72 / 96          # a deck's page unit is CSS px at 96 dpi; a PDF point is 1/72 in
FACE_SUFFIXES = (".ttf", ".otf", ".ttc")
ENGINES = ("slideglance", "powerpoint", "raster")
# A typeset page is a few colours and anti-aliased type, which a 256-colour
# palette holds without a visible change; more colours than this is a
# gradient, a scan or a photograph, which stays a JPEG (raster route only).
PALETTE_MAX_COLOURS = 8000

Runner = Callable[..., subprocess.CompletedProcess]


class DeliveryError(RuntimeError):
    """A step of the delivery could not be completed; nothing is reported as delivered."""


def need(module: str) -> Any:
    """A third-party module the PDF step needs, or a DeliveryError naming it."""
    try:
        return import_module(module)
    except ImportError as e:
        raise DeliveryError(f"the PDF step needs the Python module `{module}`; install it "
                            "(PyMuPDF provides `fitz`, Pillow `PIL`)") from e


def slide_count(pptx: Path) -> int:
    with zipfile.ZipFile(pptx) as z:
        return len([n for n in z.namelist() if SLIDE_XML.fullmatch(n)])


def numbered(directory: Path, suffix: str) -> dict[int, Path]:
    """{n: file} for files whose stem ends in a number (slide-3.png, 3.png)."""
    out = {}
    for p in directory.glob(f"*{suffix}"):
        m = re.search(r"(\d+)$", p.stem)
        if m:
            out[int(m.group(1))] = p
    return out


@dataclass
class Settings:
    engine: str
    dpi: int | None
    quality: int | None
    fonts: list | None
    figure_font: str | None


@dataclass
class Volume:
    copy: str
    name: str              # the deck's name in the declaration
    deck: DeckConfig
    pptx: Path
    pdf: Path
    blind: bool = False    # the copy the panel reads, whose properties are cleared
    versioned: bool = False  # the versioned pair rather than a volume of a copy


NAME = "{title}({copy}_{label})"
LAYOUT = "{copy}/{ext}"
NAME_FIELDS = ("title", "copy", "label", "deck")
LAYOUT_FIELDS = ("title", "copy", "label", "deck", "ext")
EXTENSIONS = ("pptx", "pdf")


def template_fields(template: Any, key: str, allowed: tuple[str, ...]) -> list[str]:
    """The fields a `submission` naming template uses, refused when it uses any other."""
    if not isinstance(template, str):
        raise ConfigError(f"`submission.{key}` must be a template string")
    try:
        parsed = list(Formatter().parse(template))
    except ValueError as e:
        raise ConfigError(f"`submission.{key}` {template!r} is not a template: {e}") from e
    fields = []
    for _, field, spec, conversion in parsed:
        if field is None:
            continue
        if field not in allowed or spec or conversion:
            raise ConfigError(f"`submission.{key}` uses {{{field}}}; it takes "
                              + ", ".join(f"{{{f}}}" for f in allowed))
        fields.append(field)
    return fields


@dataclass
class Naming:
    """Where a submission's files go: `<dir>/<layout>/<name>.<ext>`, from one pair of templates."""
    root: Path
    title: str
    name: str = NAME
    layout: str = LAYOUT

    @classmethod
    def of(cls, project: Project) -> "Naming":
        sub = project.data["submission"]
        name, layout = sub.get("name", NAME), sub.get("layout", LAYOUT)
        template_fields(name, "name", NAME_FIELDS)
        template_fields(layout, "layout", LAYOUT_FIELDS)
        if layout.startswith("/") or ".." in layout.split("/"):
            raise ConfigError(f"`submission.layout` {layout!r} must stay inside `submission.dir`")
        return cls(project.root / sub["dir"], sub["title"], name, layout)

    def path(self, copy: str, deck: str, label: str, ext: str) -> Path:
        values = {"title": self.title, "copy": copy, "label": label, "deck": deck, "ext": ext}
        folder = self.layout.format(**values).strip("/")
        file = f"{self.name.format(**values)}.{ext}"
        return self.root / folder / file if folder else self.root / file

    def _regex(self, template: str, copy: str) -> str:
        out = []
        for literal, field, _, _ in Formatter().parse(template):
            out.append(re.escape(literal))
            if field == "title":
                out.append(re.escape(self.title))
            elif field == "copy":
                out.append(re.escape(copy))
            elif field == "ext":
                out.append("(?:" + "|".join(EXTENSIONS) + ")")
            elif field is not None:
                out.append("[^/]+?")
        return "".join(out)

    def written_by(self, copy: str) -> re.Pattern:
        """The paths, relative to `dir`, the templates produce for one copy with any label and deck."""
        folder = self._regex(self.layout, copy).strip("/")
        file = self._regex(self.name, copy) + r"\.(?:" + "|".join(EXTENSIONS) + ")"
        return re.compile("^" + (folder + "/" if folder else "") + file + "$")

    def pdf_glob(self) -> str:
        """A glob, relative to `dir`, over every PDF in a folder the layout produces."""
        out = []
        for literal, field, _, _ in Formatter().parse(self.layout):
            out.append(glob_escape(literal))
            if field == "title":
                out.append(glob_escape(self.title))
            elif field == "ext":
                out.append("pdf")
            elif field is not None:
                out.append("*")
        folder = "".join(out).strip("/")
        return f"{folder}/*.pdf" if folder else "*.pdf"


def settings(project: Project, raster: bool) -> Settings:
    sub = project.data.get("submission") or {}
    pdf = sub.get("pdf") or {}
    engine = "raster" if raster else pdf.get("engine", "slideglance")
    if engine not in ENGINES:
        raise ConfigError(f"`submission.pdf.engine` is {engine!r}; it is one of {', '.join(ENGINES)}")
    if engine != "raster" and not (isinstance(pdf.get("imageDpi"), int) and isinstance(pdf.get("jpegQuality"), int)):
        raise ConfigError("`submission.pdf.imageDpi` and `submission.pdf.jpegQuality` must be declared: "
                          "the pictures are resampled and re-encoded, the type stays vector")
    fonts = pdf.get("fonts")
    if fonts is not None and not (isinstance(fonts, list) and all(isinstance(f, str) for f in fonts)):
        raise ConfigError("`submission.pdf.fonts` must list face files")
    return Settings(engine, pdf.get("imageDpi"), pdf.get("jpegQuality"),
                    [str(project.root / Path(f).expanduser()) for f in fonts] if fonts else None,
                    pdf.get("figureFont"))


def version(project: Project, spec: dict) -> str:
    rel = spec.get("versionFile")
    if not rel:
        raise ConfigError("`submission.versioned.versionFile` names no file")
    path = project.root / rel
    if not path.is_file():
        raise ConfigError(f"`submission.versioned.versionFile` {rel} does not exist")
    value = path.read_text(encoding="utf-8").strip()
    if not re.fullmatch(r"[\w.+-]+", value):
        raise ConfigError(f"{rel} holds {value!r}, not a version")
    return value


def plan(project: Project, only_copy: str | None, only_volume: str | None) -> list[Volume]:
    """Every (copy, volume) this run writes, the blind copy last."""
    sub = project.data.get("submission")
    if not isinstance(sub, dict):
        raise ConfigError(f"{project.path} declares no top-level `submission`")
    versioned = sub.get("versioned")
    pair = None
    if versioned:
        if not isinstance(versioned, dict) or not versioned.get("deck") or "{version}" not in versioned.get("name", ""):
            raise ConfigError("`submission.versioned` needs `deck` and a `name` carrying {version}")
        deck = project.deck(versioned["deck"])
        stem = versioned["name"].replace("{version}", version(project, versioned))
        out_dir = project.root / versioned.get("dir", ".")
        pair = Volume("", versioned["deck"], deck, out_dir / f"{stem}.pptx", out_dir / f"{stem}.pdf",
                      versioned=True)
        if not sub.get("copies"):
            if only_volume and only_volume != versioned["deck"]:
                raise ConfigError(f"--volume {only_volume}: the versioned submission carries {versioned['deck']} only")
            return [pair]
    for key in ("dir", "title", "copies"):
        if not sub.get(key):
            raise ConfigError(f"`submission.{key}` is not declared")
    copies = sub["copies"]
    if only_copy and only_copy not in copies:
        raise ConfigError(f"--copy {only_copy}: not a declared copy ({' · '.join(copies)})")
    if only_volume and only_volume not in project.deck_names():
        raise ConfigError(f"--volume {only_volume}: not a declared deck ({' · '.join(project.deck_names())})")
    blind = sub.get("blindCopy")
    if blind is not None and blind not in copies:
        raise ConfigError(f"`submission.blindCopy` {blind} is not a declared copy")
    order = sorted((c for c in copies if not only_copy or c == only_copy), key=lambda c: c == blind)
    naming = Naming.of(project)
    out = []
    for copy in order:
        for name in copies[copy].get("volumes", []):
            if only_volume and name != only_volume:
                continue
            deck = project.deck(name)
            label = deck.require("deliverable.label", "what the volume is called in the submission's file names")
            out.append(Volume(copy, name, deck, naming.path(copy, name, label, "pptx"),
                              naming.path(copy, name, label, "pdf"), blind is not None and copy == blind))
    every = [(copy, name) for copy in copies for name in copies[copy].get("volumes", [])]
    seen: dict[Path, tuple[str, str]] = {}
    for copy, name in every:
        label = project.deck(name).require("deliverable.label", "what the volume is called in the submission's file names")
        path = naming.path(copy, name, label, "pdf")
        if path in seen:
            raise ConfigError(f"`submission.name` and `submission.layout` write {seen[path][0]} · {seen[path][1]} "
                              f"and {copy} · {name} to the same file {path.relative_to(project.root)}")
        seen[path] = (copy, name)
    if pair is not None:
        carrying = [c for c in copies if pair.name in copies[c].get("volumes", [])]
        source = versioned.get("copy") or (carrying[0] if carrying else None)
        if source not in carrying:
            raise ConfigError(f"`submission.versioned` is assembled from {pair.name} in "
                              f"{source or 'a declared copy'}, and no such copy carries it "
                              f"(copies carrying it: {' · '.join(carrying) or 'none'})")
        pair.copy, pair.blind = source, blind is not None and source == blind
        at = next((i for i, v in enumerate(out) if v.copy == source and v.name == pair.name), None)
        if at is not None:
            out.insert(at + 1, pair)
    return out


def build_command(project: Project, volume: Volume) -> str:
    template = (project.data.get("submission") or {}).get("build")
    render = volume.deck.require("render", "the command that builds the deck")
    copies = (project.data.get("submission") or {}).get("copies") or {}
    if not template:
        if len(copies) > 1:
            raise ConfigError("several copies are declared and `submission.build` is not: one render "
                              "command cannot print two copies; declare a template over {render} and {copy}")
        return render
    return template.format(render=render, copy=volume.copy, deck=volume.name)


def faces(volume: Volume, s: Settings) -> list[Path]:
    if s.fonts:
        paths = [Path(f) for f in s.fonts]
    else:
        tool = volume.deck.dir / "slideglance.json"
        declared = []
        if tool.is_file():
            declared = (parse_jsonc(tool.read_text(encoding="utf-8"), str(tool)).get("build") or {}).get("fonts") or []
        if declared:
            paths = [volume.deck.dir / Path(f).expanduser() for f in declared]
        else:
            fonts_dir = volume.deck.dir / "fonts"
            paths = sorted(p for p in fonts_dir.glob("*") if p.suffix.lower() in FACE_SUFFIXES)
    missing = [str(p) for p in paths if not p.is_file()]
    if missing or not paths:
        raise DeliveryError("the deck's faces cannot be found: " + (", ".join(missing) if missing else
                            "declare submission.pdf.fonts, build.fonts in slideglance.json, or a fonts/ directory"))
    return paths


NESTED_SVG = re.compile(r'<image\b([^>]*?)href="data:image/svg\+xml;base64,([A-Za-z0-9+/=]+)"([^>]*?)/>')
PLACEMENT = re.compile(r'(x|y|width|height|preserveAspectRatio|transform|opacity|clip-path)="([^"]*)"')
FONT_FAMILY = re.compile(r'font-family="[^"]*"')


def inline_nested_svgs(svg: str, figure_font: str | None) -> str:
    """Every `<image>` carrying an SVG data URL replaced by that SVG nested at the same placement.

    rsvg rasterises an SVG data URL at its placed size, which is 96 dpi on
    paper; nested, the figure stays vector and its labels stay text. A figure
    names a chain of faces the PDF host resolves to a system face, so the
    family is set to the kit's sans face the figure was checked in.
    """
    def inline(m: re.Match) -> str:
        placement = dict(PLACEMENT.findall(m.group(1) + m.group(3)))
        inner = base64.b64decode(m.group(2)).decode("utf-8")
        inner = re.sub(r"<\?xml[^>]*\?>\s*", "", inner)
        inner = re.sub(r"<!DOCTYPE[^>]*>\s*", "", inner)
        root = re.match(r"<svg\b([^>]*)>", inner)
        if root is None:
            return m.group(0)
        attrs = root.group(1)
        for k in ("x", "y", "width", "height", "preserveAspectRatio"):
            attrs = re.sub(rf'\s{k}="[^"]*"', "", attrs)
        geo = " ".join(f'{k}="{v}"' for k, v in placement.items())
        body = f"<svg {geo}{attrs}>" + inner[root.end():]
        return FONT_FAMILY.sub(f'font-family="{figure_font}"', body) if figure_font else body
    return NESTED_SVG.sub(inline, svg)


def figure_font(volume: Volume, s: Settings) -> str | None:
    if s.figure_font:
        return s.figure_font
    if volume.deck.has("vocabulary"):
        return (Vocabulary.for_deck(volume.deck).data.get("fonts") or {}).get("sans")
    return None


class Deliverer:
    """The steps, with the process runner, the PDF post-processing and the PDF property reader injectable."""

    def __init__(self, project: Project, s: Settings, run: Runner = subprocess.run,
                 shrink: Callable[[Path, int, int], int] | None = None, log: Callable[[str], None] = print,
                 properties: Callable[[Path], dict | None] | None = None,
                 clear_pdf: Callable[[Path], list[str] | None] | None = None):
        self.project, self.s, self.run, self.log = project, s, run, log
        self.shrink = shrink or shrink_images
        self.properties = properties or pdf_properties
        self.clear_pdf = clear_pdf or clear_pdf_author

    def _run(self, argv: list[str] | str, **kw: Any) -> subprocess.CompletedProcess:
        try:
            return self.run(argv, check=True, capture_output=True, text=True, **kw)
        except subprocess.CalledProcessError as e:
            cmd = argv if isinstance(argv, str) else " ".join(map(str, argv))
            raise DeliveryError(f"`{cmd}` failed (exit {e.returncode}): {(e.stderr or '').strip()[:400]}") from e
        except OSError as e:
            raise DeliveryError(f"could not run {argv if isinstance(argv, str) else argv[0]}: {e}") from e

    def build(self, volume: Volume) -> None:
        self._run(build_command(self.project, volume), shell=True, cwd=self.project.root)

    def export_slideglance(self, pptx: Path, out: Path, volume: Volume) -> None:
        tool = binary(volume.deck)
        try:
            probe = self.run([tool, "convert", "--help"], capture_output=True, text=True)
        except OSError as e:
            raise DeliveryError(f"could not run {tool}: {e}") from e
        if "--text" not in (probe.stdout or "") + (probe.stderr or ""):
            raise DeliveryError(f"{tool} does not know `convert --text`; install a version that writes text-mode SVG")
        fonts = faces(volume, self.s)
        family = figure_font(volume, self.s)
        with tempfile.TemporaryDirectory(prefix="deliver-svg-") as tmp:
            work = Path(tmp)
            cmd = [tool, "convert", str(pptx), "--output", str(work), "--format", "svg", "--text"]
            for face in fonts:
                cmd += ["--font", str(face)]
            self._run(cmd)
            pages = [p for _, p in sorted(numbered(work, ".svg").items())]
            if not pages:
                raise DeliveryError(f"{tool} convert wrote no SVG")
            for page in pages:
                page.write_text(inline_nested_svgs(page.read_text(encoding="utf-8"), family), encoding="utf-8")
            dirs = "".join(f"<dir>{d}</dir>" for d in dict.fromkeys(str(f.resolve().parent) for f in fonts))
            conf = work / "fonts.conf"
            conf.write_text('<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n'
                            f"<fontconfig>{dirs}<cachedir>{work / 'fc-cache'}</cachedir></fontconfig>\n",
                            encoding="utf-8")
            out.parent.mkdir(parents=True, exist_ok=True)
            self._run(["rsvg-convert", "-f", "pdf", "-o", str(out), *map(str, pages)],
                      env={**os.environ, "FONTCONFIG_FILE": str(conf)})

    def export_powerpoint(self, pptx: Path, out: Path) -> None:
        if platform.system() != "Darwin" or not Path("/Applications/Microsoft PowerPoint.app").exists():
            raise DeliveryError("the powerpoint engine needs Microsoft PowerPoint on macOS")
        out.parent.mkdir(parents=True, exist_ok=True)
        if out.exists():
            out.unlink()
        self._run(["osascript", "-", str(pptx.resolve()), str(out.resolve())], input=EXPORT_SCRIPT)
        if not out.exists():
            raise DeliveryError(f"PowerPoint did not write {out.name}")

    def assemble(self, volume: Volume, scale: float | None) -> int:
        """The deck's built pptx into the two deliverables; returns the page count."""
        src = volume.deck.resolve(volume.deck.require("output", "the built pptx"))
        if not src.is_file():
            raise DeliveryError(f"{src} does not exist; build the deck first")
        count = slide_count(src)
        volume.pptx.parent.mkdir(parents=True, exist_ok=True)
        volume.pdf.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, volume.pptx)
        if volume.blind:
            for held in clear_pptx_people(volume.pptx):
                self.log(f"  blind copy: cleared {volume.pptx.name} {held}")
        if self.s.engine == "raster":
            previews = volume.deck.resolve(volume.deck.require("previews", "the rendered page images"))
            files = preview_files(previews, count)
            for p in remove_stale_previews(previews, count):
                self.log(f"removed stale preview {p.name}")
            width = volume.deck.require("page.w", "the paper width in CSS px")
            ratio = scale if scale is not None else float(volume.deck.get("deliverable.pdfScale", 1.0))
            pages = write_raster(files, volume.pdf, width, ratio)
        else:
            if self.s.engine == "powerpoint":
                self.export_powerpoint(volume.pptx, volume.pdf)
            else:
                self.export_slideglance(volume.pptx, volume.pdf, volume)
            pages = self.shrink(volume.pdf, int(self.s.dpi or 0), int(self.s.quality or 0))
            if pages != count:
                raise DeliveryError(f"{volume.pdf.name}: the PDF has {pages} pages, the pptx {count} slides")
        if volume.blind:
            held = self.clear_pdf(volume.pdf)
            if held is None:
                self.log(f"  ⚠ blind copy: {volume.pdf.name}: the PDF's author was not cleared (PyMuPDF is missing)")
            for field in held or []:
                self.log(f"  blind copy: cleared {volume.pdf.name} {field}")
        return pages


EXPORT_SCRIPT = """
on run argv
  tell application "Microsoft PowerPoint"
    open (POSIX file (item 1 of argv))
    set pres to active presentation
    save pres in (POSIX file (item 2 of argv)) as save as PDF
    close pres saving no
  end tell
end run
"""


def preview_files(directory: Path, count: int) -> list[Path]:
    have = numbered(directory, ".png")
    missing = [str(i) for i in range(1, count + 1) if i not in have]
    if missing:
        raise DeliveryError(f"the previews do not match the pptx (no image for slide {', '.join(missing[:5])}); render again")
    return [have[i] for i in range(1, count + 1)]


def remove_stale_previews(directory: Path, count: int) -> list[Path]:
    """Previews past the last slide: the renderer overwrites but never removes, so a
    deck that lost a page leaves its old last image, which a glob would stitch in."""
    stale = [p for n, p in numbered(directory, ".png").items() if n > count]
    for p in stale:
        p.unlink()
    return stale


def write_raster(files: list[Path], out: Path, page_w: float, scale: float) -> int:
    image = need("PIL.Image")
    img2pdf = need("img2pdf")
    pages = [image.open(f).convert("RGB") for f in files]

    def sized(p: Any) -> Any:
        if scale == 1:
            return p
        return p.resize((round(p.width * scale), round(p.height * scale)), image.Resampling.LANCZOS)

    def encoded(p: Any) -> bytes:
        buf = BytesIO()
        if p.getcolors(maxcolors=PALETTE_MAX_COLOURS) is None:
            p.save(buf, format="JPEG", quality=94, subsampling=0, optimize=True)
        else:
            p.quantize(colors=256, method=image.Quantize.MEDIANCUT,
                       dither=image.Dither.NONE).save(buf, format="PNG", optimize=True)
        return buf.getvalue()

    first = sized(pages[0])
    w_pt = page_w * PT_PER_CSS_PX
    layout = img2pdf.get_layout_fun(pagesize=(w_pt, w_pt * first.height / first.width))
    out.write_bytes(img2pdf.convert([encoded(sized(p)) for p in pages], layout_fun=layout))
    return len(pages)


# Resource categories a page's content names by key and the image rewrite has no reason to
# change. MuPDF's rewrite rebuilds a page's resource dictionary and can drop one (a pattern
# that fills gradient text is lost while the content still names it, so the text vanishes
# from the page without an error), so each is put back when the rewrite leaves it out.
KEPT_RESOURCES = ("Pattern", "Shading", "ExtGState", "ColorSpace", "Font", "Properties")
# Content operators naming a pattern or a shading, checked against the page's resources.
RESOURCE_USES = {"Pattern": re.compile(rb"/([^\s/\[\]<>(){}%]+)\s+(?:scn|SCN)\b"),
                 "Shading": re.compile(rb"/([^\s/\[\]<>(){}%]+)\s+sh\b")}


def undefined_resources(doc: Any) -> list[str]:
    """`page n: Category /name` for every pattern or shading a page's content names and its resources lack."""
    out = []
    for page in doc:
        content = b"".join(doc.xref_stream(x) or b"" for x in page.get_contents())
        for category, use in RESOURCE_USES.items():
            named = {m.decode("latin-1") for m in use.findall(content)}
            kind, value = doc.xref_get_key(page.xref, f"Resources/{category}")
            if kind == "xref":
                value = doc.xref_object(int(value.split()[0]))
            have = (set(re.findall(r"/([^\s/\[\]<>(){}%]+)(?=[\s<\[/(])", value))
                    if kind in ("dict", "xref") else set())
            out += [f"page {page.number + 1}: {category} /{n}" for n in sorted(named - have)]
    return out


def shrink_images(pdf: Path, dpi: int, quality: int) -> int:
    """Resample every picture to `dpi` where it is placed, re-encode at `quality`, subset
    the faces; the text and the vector drawing are untouched. Returns the page count."""
    fitz = need("fitz")
    doc = fitz.open(pdf)
    kept = [{c: doc.xref_get_key(page.xref, f"Resources/{c}") for c in KEPT_RESOURCES} for page in doc]
    doc.rewrite_images(dpi_threshold=dpi + 1, dpi_target=dpi, quality=quality, lossy=True, lossless=True)
    for page, before in zip(doc, kept):
        for category, (kind, value) in before.items():
            if kind != "null" and doc.xref_get_key(page.xref, f"Resources/{category}")[0] == "null":
                doc.xref_set_key(page.xref, f"Resources/{category}", value)
    lost = undefined_resources(doc)
    if lost:
        doc.close()
        raise DeliveryError(f"{pdf.name}: the image rewrite left names the pages use undefined, so what "
                            f"they draw would vanish: {', '.join(lost[:8])}{' …' if len(lost) > 8 else ''}")
    doc.subset_fonts()
    tmp = pdf.with_suffix(".tmp.pdf")
    doc.save(tmp, garbage=4, deflate=True)
    pages = doc.page_count
    doc.close()
    tmp.replace(pdf)
    return pages


# The fields of a pptx's document properties that name a person or a company.
PERSON_FIELDS = re.compile(r"<(dc:creator|cp:lastModifiedBy|Company|Manager)>([^<]*)</\1>")
# The ones a blind copy is written with empty: who made the file and who saved it last.
CLEARED_FIELDS = re.compile(r"<(dc:creator|cp:lastModifiedBy)(\s[^>]*)?>([^<]*)</\1>")
CORE_PART = "docProps/core.xml"
XMP_CREATOR = re.compile(r"<dc:creator\b[^>]*/>|<dc:creator\b.*?</dc:creator>", re.S)


def clear_pptx_people(pptx: Path) -> list[str]:
    """Empty `dc:creator` and `cp:lastModifiedBy` in a pptx's core properties; return what they held.

    Every other part is written back byte for byte, in the order and with the
    compression it had, so the package opens as it did.
    """
    with zipfile.ZipFile(pptx) as z:
        infos = z.infolist()
        if CORE_PART not in z.namelist():
            return []
        parts = {info.filename: z.read(info.filename) for info in infos}
    held: list[str] = []

    def blank(m: re.Match) -> str:
        if m.group(3).strip():
            held.append(f"{m.group(1)} 「{unescape(m.group(3).strip())}」")
        return f"<{m.group(1)}{m.group(2) or ''}></{m.group(1)}>"

    core = CLEARED_FIELDS.sub(blank, parts[CORE_PART].decode("utf-8"))
    if not held:
        return []
    tmp = pptx.with_name(pptx.name + ".tmp")
    with zipfile.ZipFile(tmp, "w") as out:
        for info in infos:
            out.writestr(info, core.encode("utf-8") if info.filename == CORE_PART else parts[info.filename])
    tmp.replace(pptx)
    return held


def clear_pdf_author(pdf: Path) -> list[str] | None:
    """Empty a PDF's author and its XMP `dc:creator`; return what was cleared, None without PyMuPDF.

    The file is saved whole, not incrementally, so the old values do not stay
    behind in an earlier revision of it.
    """
    try:
        fitz = import_module("fitz")
    except ImportError:
        return None
    try:
        doc = fitz.open(pdf)
    except fitz.FileDataError as e:
        raise DeliveryError(f"{pdf.name} cannot be read to clear its author: {e}") from e
    held: list[str] = []
    tmp = pdf.with_name(pdf.name + ".tmp")
    try:
        meta = dict(doc.metadata or {})
        author = str(meta.get("author") or "").strip()
        if author:
            held.append(f"author 「{author}」")
            meta["author"] = ""
            doc.set_metadata(meta)
        xmp = doc.get_xml_metadata()
        if xmp and XMP_CREATOR.search(xmp):
            held.append("XMP dc:creator")
            doc.set_xml_metadata(XMP_CREATOR.sub("", xmp))
        if held:
            doc.save(tmp, garbage=3, deflate=True)
    finally:
        doc.close()
    if held:
        tmp.replace(pdf)
    return held


def pptx_properties(pptx: Path) -> dict[str, str]:
    """{part: xml} for the document-property parts of a pptx (`docProps/*.xml`)."""
    with zipfile.ZipFile(pptx) as z:
        return {n: z.read(n).decode("utf-8", "replace") for n in z.namelist()
                if n.startswith("docProps/") and n.endswith(".xml")}


def pdf_properties(pdf: Path) -> dict[str, str] | None:
    """{field: value} of a PDF's information and its XMP packet, None when PyMuPDF is missing."""
    try:
        fitz = import_module("fitz")
    except ImportError:
        return None
    try:
        doc = fitz.open(pdf)
    except fitz.FileDataError as e:
        raise DeliveryError(f"{pdf.name} cannot be read to check its properties: {e}") from e
    try:
        out = {k: v for k, v in (doc.metadata or {}).items() if isinstance(v, str) and v}
        xmp = doc.get_xml_metadata()
        if xmp:
            out["xmp"] = xmp
    finally:
        doc.close()
    return out


def proposer_names(project: Project) -> list[str]:
    """The proposer names the copies other than the blind one print (`identity.<copy>.name`)."""
    sub = project.data.get("submission") or {}
    blind = sub.get("blindCopy")
    out: list[str] = []
    for copy, fields in (sub.get("identity") or {}).items():
        name = str(fields.get("name") or "").strip() if isinstance(fields, dict) else ""
        if copy != blind and name and name not in out:
            out.append(name)
    return out


def blind_properties(volume: Volume, names: list[str],
                     read_pdf: Callable[[Path], dict | None]) -> tuple[list[str], list[str]]:
    """(a proposer name the blind copy's properties carry, a person or company field carrying anything)."""
    found, notes = [], []
    for part, xml in pptx_properties(volume.pptx).items():
        text = unescape(xml)
        found += [f"{volume.pptx.name} {part} carries 「{name}」" for name in names if name in text]
        notes += [f"{volume.pptx.name} {part} {field} 「{unescape(value.strip())}」"
                  for field, value in PERSON_FIELDS.findall(xml) if value.strip()]
    props = read_pdf(volume.pdf)
    if props is None:
        notes.append(f"{volume.pdf.name}: the PDF's properties were not read (PyMuPDF is missing)")
        return found, notes
    for key, value in props.items():
        found += [f"{volume.pdf.name} {key} carries 「{name}」" for name in names if name in value]
    author = str(props.get("author", "")).strip()
    if author:
        notes.append(f"{volume.pdf.name} author 「{author}」")
    return found, notes


def stale_files(project: Project, written: list[Volume], whole: bool) -> list[Path]:
    """Deliverables this run supersedes."""
    sub = project.data["submission"]
    keep = {v.pptx for v in written} | {v.pdf for v in written}
    versioned = sub.get("versioned")
    out = []
    if versioned and any(v.versioned for v in written):
        out_dir = project.root / versioned.get("dir", ".")
        pattern = re.compile("^" + re.escape(versioned["name"]).replace(re.escape("{version}"), r"[\w.+-]+")
                             + r"\.(pdf|pptx)$")
        out += [p for p in out_dir.iterdir() if p.is_file() and pattern.match(p.name) and p not in keep]
        out += [out_dir / n for n in versioned.get("legacy", []) if (out_dir / n).is_file()]
    if not whole or not sub.get("copies"):
        return out
    naming = Naming.of(project)
    if not naming.root.is_dir():
        return out
    patterns = [naming.written_by(copy) for copy in dict.fromkeys(v.copy for v in written if not v.versioned)]
    for p in sorted(naming.root.rglob("*")):
        rel = p.relative_to(naming.root).as_posix()
        if p.is_file() and p not in keep and any(rx.match(rel) for rx in patterns):
            out.append(p)
    return out


def glob_escape(s: str) -> str:
    return re.sub(r"([\[\]*?])", r"[\1]", s)


def within_limits(project: Project, log: Callable[[str], None] = print) -> bool:
    sub = project.data["submission"]
    limit = sub.get("pdfLimitMB")
    if sub.get("copies"):
        naming = Naming.of(project)
        pdfs = sorted(naming.root.glob(naming.pdf_glob()))
    else:
        pdfs = [v for v in (project.root / sub["versioned"].get("dir", ".")).glob("*.pdf")]
    total = sum(p.stat().st_size for p in pdfs) / 1e6
    log(f"PDF size: {len(pdfs)} files, {total:.1f} MB together")
    if not limit:
        return True
    ok = True
    for p in pdfs:
        size = p.stat().st_size / 1e6
        if size > limit.get("file", float("inf")):
            log(f"  ✖ {p.name}: {size:.1f} MB, over the {limit['file']} MB file limit")
            ok = False
    if total > limit.get("total", float("inf")):
        log(f"  ✖ together {total:.1f} MB, over the {limit['total']} MB limit")
        ok = False
    return ok


def deliver(project: Project, args: Any, d: Deliverer) -> int:
    volumes = plan(project, args.copy, args.volume)
    sub = project.data["submission"]
    if args.no_build and len(sub.get("copies") or {}) > 1 and not args.copy:
        raise ConfigError("--no-build cannot tell which copy each deck's output holds; give --copy")
    for v in volumes:
        # the versioned pair follows its source volume and is assembled from the same build
        if not args.no_build and not (v.versioned and sub.get("copies")):
            d.log(f"build {v.copy or v.name} · {v.name}")
            d.build(v)
        pages = d.assemble(v, args.scale)
        d.log(f"pdf:  {v.pdf.relative_to(project.root)}, {pages} pages")
        d.log(f"pptx: {v.pptx.relative_to(project.root)}")
    for p in stale_files(project, volumes, whole=not args.volume):
        p.unlink()
        d.log(f"removed {p.relative_to(project.root)}")
    names, leaks = proposer_names(project), []
    for v in volumes:
        if v.blind:
            found, notes = blind_properties(v, names, d.properties)
            leaks += found
            for note in notes:
                d.log(f"  ⚠ blind copy: {note}; a blind copy names nobody in its properties")
    for line in leaks:
        d.log(f"  ✖ blind copy: {line}, the proposer the blind evaluation must not see")
    return 0 if within_limits(project, d.log) and not leaks else 1


def main(argv: list[str] | None = None) -> int:
    ap = ArgumentParser(description="Build the submission's copies into one folder.")
    ap.add_argument("--copy", help="this copy only")
    ap.add_argument("--volume", help="this deck only, in every copy that carries it")
    ap.add_argument("--no-build", action="store_true", help="assemble from each deck's output as it stands")
    ap.add_argument("--raster", action="store_true", help="stitch the previews (no searchable text)")
    ap.add_argument("--scale", type=float, help="raster only: share of the preview size to write")
    ap.add_argument("--deck", help="accepted from the runner; a submission spans every deck it names")
    args = ap.parse_args(argv)
    if args.scale is not None and not 0.2 <= args.scale <= 1.0:
        ap.error("--scale is between 0.2 and 1.0")
    try:
        project = Project.load()
        return deliver(project, args, Deliverer(project, settings(project, args.raster)))
    except (ConfigError, DeliveryError, DeckUnavailable, OSError, json.JSONDecodeError) as e:
        print(f"✖ {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
