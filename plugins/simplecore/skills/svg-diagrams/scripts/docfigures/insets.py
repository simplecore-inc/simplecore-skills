"""Measure every text of an SVG in headless Chrome and report the ones that touch or
leave the shape around them.

For each <text>, the browser's own bounding box (real fonts, real weight) is compared
with the smallest filled rect or path whose box contains the text's middle point. A
text whose left or right inset inside that shape is under MIN_INSET units is
reported: OVER when the inset is negative, TOUCH when it is smaller than the margin.
A paper plate under a label (text(..., mask=True)) is tight by design and skipped.

The lint's TEXT-OVERFLOW estimates widths, ignores the weight and allows a 4-unit
pad, so a bold title can sit on its border and pass; this reads what the browser
draws. Run it on the saved figures before they are placed.

    python3 insets.py file.svg [more.svg ...]
"""
import html
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from audit import CHROME  # noqa: E402

MIN_INSET = 8

SCRIPT = """
<script>
const svg = document.querySelector('svg');
const shapes = [];
for (const el of svg.querySelectorAll('rect, path')) {
  const fill = el.getAttribute('fill');
  if (!fill || fill === 'none') continue;
  // a paper plate under a label (text(..., mask=True)) is tight by design
  const stroke = el.getAttribute('stroke');
  if ((!stroke || stroke === 'none') && /^#fff(fff)?$/i.test(fill)) continue;
  if (el.closest('marker') || el.closest('defs')) continue;
  const b = el.getBBox();
  if (b.width < 30 || b.height < 18) continue;
  shapes.push({x: b.x, y: b.y, w: b.width, h: b.height});
}
const out = [];
for (const t of svg.querySelectorAll('text')) {
  if (t.closest('defs')) continue;
  const b = t.getBBox();
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  let best = null;
  for (const s of shapes) {
    if (s.x <= cx && cx <= s.x + s.w && s.y <= cy && cy <= s.y + s.h) {
      if (!best || s.w * s.h < best.w * best.h) best = s;
    }
  }
  out.push({text: t.textContent.trim(), x: b.x, w: b.width, y: b.y, h: b.height, box: best});
}
document.body.setAttribute('data-out', JSON.stringify(out));
</script>
"""


def measure(svg_path):
    svg = Path(svg_path).read_text(encoding="utf-8")
    page = f"<!doctype html><html><body>{svg}{SCRIPT}</body></html>"
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(page)
        tmp = f.name
    dom = subprocess.run([CHROME, "--headless", "--disable-gpu", "--virtual-time-budget=3000",
                          "--dump-dom", f"file://{tmp}"], capture_output=True, text=True).stdout
    m = re.search(r'data-out="([^"]*)"', dom)
    if not m:
        raise SystemExit(f"{svg_path}: no measurement came back")
    return json.loads(html.unescape(m.group(1)))


def main(paths):
    total = 0
    for p in paths:
        found = []
        for t in measure(p):
            b = t["box"]
            if not b:
                continue
            left = t["x"] - b["x"]
            right = b["x"] + b["w"] - (t["x"] + t["w"])
            worst = min(left, right)
            if worst < MIN_INSET:
                kind = "OVER" if worst < 0 else "TOUCH"
                side = "right" if right <= left else "left"
                found.append(f"  {kind} {side} {worst:5.1f}  \"{t['text'][:40]}\" box x={b['x']:.0f} w={b['w']:.0f}")
        total += len(found)
        print(f"{Path(p).name}: {len(found)}")
        for line in found:
            print(line)
    print(f"total {total}")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
