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
built pptx is copied and its PDF written:

    <dir>/<copy>/pptx/<title>(<copy>_<label>).pptx
    <dir>/<copy>/pdf/<title>(<copy>_<label>).pdf

A submission that ships one versioned pair instead declares
`submission.versioned` (`deck`, `name` with `{version}`, `versionFile`, `dir`,
`legacy`): the pair is written as `<dir>/<name>.pdf` and `.pptx`, and every
file carrying the same name with another version, and every legacy file, is
removed, so a version bump leaves exactly one pair.

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
A whole run owns its copy folders: a file carrying the title that the run did
not write is removed. The folder is measured against `submission.pdfLimitMB`
after every run.

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
from importlib import import_module
from io import BytesIO
from pathlib import Path
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
    if versioned:
        if not isinstance(versioned, dict) or not versioned.get("deck") or "{version}" not in versioned.get("name", ""):
            raise ConfigError("`submission.versioned` needs `deck` and a `name` carrying {version}")
        deck = project.deck(versioned["deck"])
        if only_volume and only_volume != versioned["deck"]:
            raise ConfigError(f"--volume {only_volume}: the versioned submission carries {versioned['deck']} only")
        stem = versioned["name"].replace("{version}", version(project, versioned))
        out_dir = project.root / versioned.get("dir", ".")
        return [Volume("", versioned["deck"], deck, out_dir / f"{stem}.pptx", out_dir / f"{stem}.pdf")]
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
    root = project.root / sub["dir"]
    out = []
    for copy in order:
        for name in copies[copy].get("volumes", []):
            if only_volume and name != only_volume:
                continue
            deck = project.deck(name)
            label = deck.require("deliverable.label", "what the volume is called in the submission's file names")
            stem = f"{sub['title']}({copy}_{label})"
            out.append(Volume(copy, name, deck, root / copy / "pptx" / f"{stem}.pptx",
                              root / copy / "pdf" / f"{stem}.pdf"))
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
    """The steps, with the process runner and the PDF post-processing injectable."""

    def __init__(self, project: Project, s: Settings, run: Runner = subprocess.run,
                 shrink: Callable[[Path, int, int], int] | None = None, log: Callable[[str], None] = print):
        self.project, self.s, self.run, self.log = project, s, run, log
        self.shrink = shrink or shrink_images

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
        if self.s.engine == "raster":
            previews = volume.deck.resolve(volume.deck.require("previews", "the rendered page images"))
            files = preview_files(previews, count)
            for p in remove_stale_previews(previews, count):
                self.log(f"removed stale preview {p.name}")
            width = volume.deck.require("page.w", "the paper width in CSS px")
            ratio = scale if scale is not None else float(volume.deck.get("deliverable.pdfScale", 1.0))
            return write_raster(files, volume.pdf, width, ratio)
        if self.s.engine == "powerpoint":
            self.export_powerpoint(volume.pptx, volume.pdf)
        else:
            self.export_slideglance(volume.pptx, volume.pdf, volume)
        pages = self.shrink(volume.pdf, int(self.s.dpi or 0), int(self.s.quality or 0))
        if pages != count:
            raise DeliveryError(f"{volume.pdf.name}: the PDF has {pages} pages, the pptx {count} slides")
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


def shrink_images(pdf: Path, dpi: int, quality: int) -> int:
    """Resample every picture to `dpi` where it is placed, re-encode at `quality`, subset
    the faces; the text and the vector drawing are untouched. Returns the page count."""
    fitz = need("fitz")
    doc = fitz.open(pdf)
    doc.rewrite_images(dpi_threshold=dpi + 1, dpi_target=dpi, quality=quality, lossy=True, lossless=True)
    doc.subset_fonts()
    tmp = pdf.with_suffix(".tmp.pdf")
    doc.save(tmp, garbage=4, deflate=True)
    pages = doc.page_count
    doc.close()
    tmp.replace(pdf)
    return pages


def stale_files(project: Project, written: list[Volume], whole: bool) -> list[Path]:
    """Deliverables this run supersedes."""
    sub = project.data["submission"]
    keep = {v.pptx for v in written} | {v.pdf for v in written}
    versioned = sub.get("versioned")
    if versioned:
        out_dir = project.root / versioned.get("dir", ".")
        pattern = re.compile("^" + re.escape(versioned["name"]).replace(re.escape("{version}"), r"[\w.+-]+")
                             + r"\.(pdf|pptx)$")
        stale = [p for p in out_dir.iterdir() if p.is_file() and pattern.match(p.name) and p not in keep]
        stale += [out_dir / n for n in versioned.get("legacy", []) if (out_dir / n).is_file()]
        return stale
    if not whole:
        return []
    root = project.root / sub["dir"]
    out = []
    for copy in dict.fromkeys(v.copy for v in written):
        for p in (root / copy).glob(f"*/{glob_escape(sub['title'])}*"):
            if p.is_file() and p not in keep:
                out.append(p)
    return out


def glob_escape(s: str) -> str:
    return re.sub(r"([\[\]*?])", r"[\1]", s)


def within_limits(project: Project, log: Callable[[str], None] = print) -> bool:
    sub = project.data["submission"]
    limit = sub.get("pdfLimitMB")
    if sub.get("versioned"):
        pdfs = [v for v in (project.root / sub["versioned"].get("dir", ".")).glob("*.pdf")]
    else:
        pdfs = sorted((project.root / sub["dir"]).glob("*/pdf/*.pdf"))
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
    if args.no_build and len(sub.get("copies") or {}) > 1 and not args.copy and not sub.get("versioned"):
        raise ConfigError("--no-build cannot tell which copy each deck's output holds; give --copy")
    for v in volumes:
        if not args.no_build:
            d.log(f"build {v.copy or v.name} · {v.name}")
            d.build(v)
        pages = d.assemble(v, args.scale)
        d.log(f"pdf:  {v.pdf.relative_to(project.root)}, {pages} pages")
        d.log(f"pptx: {v.pptx.relative_to(project.root)}")
    for p in stale_files(project, volumes, whole=not args.volume):
        p.unlink()
        d.log(f"removed {p.relative_to(project.root)}")
    return 0 if within_limits(project, d.log) else 1


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
