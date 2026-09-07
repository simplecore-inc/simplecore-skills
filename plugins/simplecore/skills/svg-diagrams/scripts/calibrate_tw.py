#!/usr/bin/env python3
"""Measure how wide the SANS stack really sets each glyph class, in em.

    python3 calibrate_tw.py            # prints one line per glyph class

The width estimator in svgkit.tw and audit._text_w is a table of per-class
em widths. It is measured rather than guessed: this script renders a sample
run of each class through Chrome (the same renderer audit.py uses) and reads
the ink extent back, so the table can be checked on any machine whose fonts
differ from the one it was tuned on. Move both tables together — a generator
that sizes a box with one table and a lint that measures it with another
report defects that are not there, or miss the ones that are.

The table sits a few percent above what is printed here, on purpose: a box
sized from the estimate must never clip, and the cost of the margin is a
little air, not a cut-off label.
"""
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from svgkit import SANS  # noqa: E402

SAMPLES = {
    "hangul": "가나다라마바사아자차카타파하거너더러머버",
    "lower": "abcdefghijklmnopqrst",
    "caps": "ABCDEFGHJKLMNOPQRSTU",
    "digits": "01234567890123456789",
}
# Separators are measured as the difference against the bare Hangul run.
SEPARATED = {
    "space": "가 나 다 라 마 바 사 아 자 차 카 타 파 하 거 너 더 러 머 버",
    "middle dot": "가·나·다·라·마·바·사·아·자·차·카·타·파·하·거·너·더·러·머·버",
    "colon": "가:나:다:라:마:바:사:아:자:차:카:타:파:하:거:너:더:러:머:버",
}
SIZE = 20


def main():
    try:
        from PIL import Image
    except ImportError:
        sys.exit("Pillow is needed to read the render back: pip install pillow")
    rows = list(SAMPLES.items()) + list(SEPARATED.items())
    height = 40 * len(rows) + 40
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="1600" '
           f'height="{height}" viewBox="0 0 1600 {height}">'
           f'<rect width="1600" height="{height}" fill="#fff"/>']
    for i, (_k, s) in enumerate(rows):
        svg.append(f'<text x="20" y="{40 + i * 40}" font-family="{SANS}" '
                   f'font-size="{SIZE}" fill="#000">{s}</text>')
    svg.append("</svg>")
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "cal.svg")
        png = os.path.join(tmp, "cal.png")
        with open(src, "w") as f:
            f.write("".join(svg))
        subprocess.run([sys.executable, os.path.join(HERE, "audit.py"),
                        "render", src, png, "2"], check=True,
                       capture_output=True)
        img = Image.open(png).convert("L")
    px = img.load()
    width = img.size[0]

    def ink(i):
        y0, y1 = int((40 + i * 40 - 18) * 2), int((40 + i * 40 + 6) * 2)
        xs = [x for x in range(width) for y in range(y0, y1) if px[x, y] < 128]
        return (max(xs) - min(xs)) / 2 if xs else 0.0

    em = {}
    for i, (k, s) in enumerate(rows):
        em[k] = ink(i) / len(s) / SIZE if k in SAMPLES else ink(i)
    hangul_run = em["hangul"] * len(SAMPLES["hangul"]) * SIZE
    print(f"{'class':12s} {'em':>6s}   (SANS stack as this machine resolves it)")
    for k in SAMPLES:
        print(f"{k:12s} {em[k]:6.3f}")
    for k, s in SEPARATED.items():
        seps = (len(s) - len(SAMPLES['hangul']))
        print(f"{k:12s} {(em[k] - hangul_run) / seps / SIZE:6.3f}")
    print("\nsvgkit.tw / audit._text_w carry: hangul 0.92 · lower 0.52 · caps 0.66 "
          "· digits 0.58 · narrow 0.28 — keep them a few percent above these.")


if __name__ == "__main__":
    main()
