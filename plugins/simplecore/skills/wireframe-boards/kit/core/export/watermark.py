#!/usr/bin/env python3
"""Stamp a faint greyscale logo onto every page of a PDF.

    python3 watermark.py <logo.png> <in.pdf> <out.pdf> [--opacity 0.08] [--to "<recipient>"]

Called by `wf.mjs pdf --watermark`, and runnable on its own against any PDF.

`--to` writes the moment the copy was made and who it was made for, in one line under the mark.
**A copy that names its recipient is a copy that can be traced back**, which is the reason to
stamp one at all; without `--to` the line is not drawn, because a stamp saying nothing is a
stamp people learn to ignore.

This is the ONE tool here that is not Node and needs something installed
(`pip install pymupdf pillow`). The board, its checks, and the plain PDF all still build on a
machine with nothing on it; the watermark is only reached for when a copy is about to be sent
to somebody, which is a thing a person does by hand.
"""

import argparse
import io
from datetime import datetime
from pathlib import Path

import fitz
from PIL import Image


def build_mark(logo_path: Path, opacity: float) -> bytes:
    """Greyscale the logo and bake the opacity into its alpha channel.

    Baked rather than applied at draw time: a page-level alpha would need a graphics state per
    page, and the whole point of one shared image object is that hundreds of pages cost one.
    """
    src = Image.open(logo_path).convert("RGBA")
    gray = src.convert("L").convert("RGBA")
    gray.putalpha(src.getchannel("A").point(lambda v: int(v * opacity)))
    buf = io.BytesIO()
    gray.save(buf, format="PNG")
    return buf.getvalue()


def stamp(logo: Path, src: Path, out: Path, opacity: float, width_ratio: float,
          line: str = "") -> None:
    mark = build_mark(logo, opacity)
    # Droid Sans Fallback — bundled with PyMuPDF, and the only built-in that has Hangul, Han and
    # Kana. Loaded once and shared, so 777 pages embed one font rather than 777 copies.
    font = fitz.Font("cjk") if line else None
    mark_w, mark_h = Image.open(logo).size
    aspect = mark_h / mark_w

    doc = fitz.open(src)
    xref = 0
    for page in doc:
        pw, ph = page.rect.width, page.rect.height
        w = pw * width_ratio
        h = w * aspect
        box = fitz.Rect((pw - w) / 2, (ph - h) / 2, (pw + w) / 2, (ph + h) / 2)
        # Reuse the first inserted image object, so every page shares one XObject. Inserting the
        # stream again per page puts one copy of the logo in the PDF per page — on a 600-page
        # board that is the difference between a megabyte and a hundred.
        if xref:
            page.insert_image(box, xref=xref, overlay=True)
        else:
            xref = page.insert_image(box, stream=mark, overlay=True)

        # The line rides directly under the mark, in the same grey and at the same faintness, so
        # it reads as part of the stamp rather than as page content somebody could mistake for
        # the board's own. Centred on the mark's own box, so it moves with `--width-ratio`.
        #
        # **The same opacity as the logo, not a multiple of it.** The mark bakes `opacity` into
        # its alpha channel; the text was drawn at 3.2× that and came out visibly darker, so the
        # stamp read as two things — a faint logo with a caption printed over it.
        if line:
            size = max(9.0, min(16.0, w * 0.045))
            # A TextWriter with a CJK font, NOT `insert_textbox(fontname="helv")`. The base-14
            # fonts carry no Hangul, so a Korean recipient drew NOTHING and the call reported
            # nothing either — the stamp came out looking like one that had never been asked for.
            # Centred by measuring the string, since a writer places text at a point.
            tw = fitz.TextWriter(page.rect)
            tw.append(
                fitz.Point(box.x0 + (w - font.text_length(line, size)) / 2, box.y1 + size * 1.6),
                line,
                font=font,
                fontsize=size,
            )
            tw.write_text(page, color=(0, 0, 0), opacity=opacity, overlay=True)

    doc.save(out, garbage=3, deflate=True)
    doc.close()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("logo", type=Path)
    ap.add_argument("src", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--opacity", type=float, default=0.08,
                    help="0-1. Faint enough to read the wireframe through (default 0.08)")
    ap.add_argument("--width-ratio", type=float, default=0.45,
                    help="Logo width as a fraction of the page width (default 0.45)")
    ap.add_argument("--to", default="",
                    help="Who this copy is for. Drawn under the mark with the time it was made; "
                         "omitted entirely when not given")
    ap.add_argument("--stamped-at", default="",
                    help="The time to print. Defaults to now, in local time")
    args = ap.parse_args()

    for p in (args.logo, args.src):
        if not p.exists():
            raise SystemExit(f"no such file: {p}")

    # Only a named recipient produces a line. The time alone would say when a copy was made and
    # nothing about who holds it, which is the half that matters when one turns up somewhere.
    line = ""
    if args.to:
        when = args.stamped_at or datetime.now().strftime("%Y-%m-%d %H:%M")
        line = f"{when}  /  {args.to}"

    stamp(args.logo, args.src, args.out, args.opacity, args.width_ratio, line)
    print(f"watermark: {args.out.name} ({args.out.stat().st_size / 1_048_576:.1f} MB)"
          + (f" · {line}" if line else ""))


if __name__ == "__main__":
    main()
