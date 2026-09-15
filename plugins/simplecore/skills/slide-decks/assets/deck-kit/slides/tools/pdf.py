#!/usr/bin/env python3
"""Assemble the deliverables under artifacts/ from the rendered previews.

The PNGs under out/png are the verified previews — build.ts hands the
slideglance CLI the same font files the deck is designed with — so the PDF
shows exactly what the build was checked against. Run `npm run render` first;
this script only assembles and copies.

Outputs, named from tools/version.txt (e.g. "0.1"):

    artifacts/<발주자> <사업명> 제안발표 v{ver}.pdf
    artifacts/<발주자> <사업명> 제안발표 v{ver}.pptx

Any same-named deliverable carrying a different version is removed, so a
version bump leaves exactly one pdf/pptx pair.
"""
import argparse
import glob
import re
import shutil
import sys
import zipfile
from pathlib import Path

from PIL import Image

DECK = Path(__file__).resolve().parents[1]
PNG = DECK / "out" / "png"
PPTX_SRC = DECK / "out" / "제안발표.pptx"
ARTIFACTS = DECK / "artifacts"
VERSION = (Path(__file__).parent / "version.txt").read_text().strip()
TITLE = "<발주자> <사업명> 제안발표"
BASE = f"{TITLE} v{VERSION}"

A4_LANDSCAPE_WIDTH_INCH = 11.693  # 297mm
# The review PNGs are rendered at 144 dpi. The PDF carries each page at this
# share of that width (about 122 dpi), crisp in print and small on disk;
# `--full` writes the 144 dpi original.
PAGE_SCALE = 0.85
SLIDE_XML = re.compile(r"ppt/slides/slide(\d+)\.xml")


def slide_count() -> int:
    with zipfile.ZipFile(PPTX_SRC) as z:
        return len([n for n in z.namelist() if SLIDE_XML.fullmatch(n)])


def page_files(count: int) -> list[Path]:
    files = [PNG / f"slide-{i}.png" for i in range(1, count + 1)]
    missing = [f.name for f in files if not f.exists()]
    if missing:
        raise FileNotFoundError(
            f"렌더된 쪽이 pptx와 어긋난다(없는 PNG: {', '.join(missing[:5])}) — `npm run render`를 다시 실행한다"
        )
    return files


def remove_stale_pngs(count: int) -> list[Path]:
    stale = [p for p in PNG.glob("slide-*.png") if int(re.search(r"(\d+)", p.stem).group(1)) > count]
    for p in stale:
        p.unlink()
    return stale


def scaled(page: Image.Image, scale: float) -> Image.Image:
    if scale == 1:
        return page
    size = (round(page.width * scale), round(page.height * scale))
    return page.resize(size, Image.Resampling.LANCZOS)


def write_pdf(files: list[Path], out: Path, scale: float) -> int:
    pages = [scaled(Image.open(f).convert("RGB"), scale) for f in files]
    for page in pages:
        page.encoderinfo = {}
    dpi = round(pages[0].width / A4_LANDSCAPE_WIDTH_INCH)
    pages[0].save(out, save_all=True, append_images=pages[1:], resolution=dpi)
    return len(pages)


def remove_other_versions(prefix: str, keep: tuple[Path, ...]) -> list[Path]:
    stale = [
        p for p in ARTIFACTS.glob(f"{glob.escape(prefix)}v*.*")
        if p.suffix in (".pdf", ".pptx") and p not in keep
    ]
    for p in stale:
        p.unlink()
    return stale


def main() -> int:
    parser = argparse.ArgumentParser(description="Assemble the presentation PDF and copy the pptx from the render.")
    parser.add_argument("--full", action="store_const", const=1.0, dest="scale",
                        help="write the pages at the rendered 144 dpi instead of PAGE_SCALE")
    parser.add_argument("--scale", type=float, dest="scale", metavar="RATIO")
    parser.set_defaults(scale=PAGE_SCALE)
    args = parser.parse_args()
    if not 0.2 <= args.scale <= 1.0:
        parser.error("--scale 은 0.2~1.0 사이다")
    if not PPTX_SRC.exists():
        print("out/제안발표.pptx 가 없다 — 먼저 `npm run render`를 실행한다", file=sys.stderr)
        return 1
    count = slide_count()
    try:
        files = page_files(count)
    except FileNotFoundError as e:
        print(e, file=sys.stderr)
        return 1
    stale_png = remove_stale_pngs(count)
    ARTIFACTS.mkdir(exist_ok=True)
    pdf_out = ARTIFACTS / f"{BASE}.pdf"
    pptx_out = ARTIFACTS / f"{BASE}.pptx"
    pages = write_pdf(files, pdf_out, args.scale)
    shutil.copyfile(PPTX_SRC, pptx_out)
    stale = remove_other_versions(f"{TITLE} ", (pdf_out, pptx_out))
    for p in stale_png:
        print(f"잔재 PNG 삭제: {p.name}")
    print(f"pdf:  {pdf_out.relative_to(DECK)} — {pages}쪽")
    print(f"pptx: {pptx_out.relative_to(DECK)}")
    for p in stale:
        print(f"삭제: {p.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
