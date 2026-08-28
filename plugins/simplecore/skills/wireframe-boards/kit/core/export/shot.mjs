// One PNG per frame of a built board, for looking at the work and for sending it on.
//
//   node wf.mjs shots _shots            every frame
//   node wf.mjs shots _shots p-         only the P cluster
//   node wf.mjs shots _shots --no-notes without each frame's annotation block
//
// `--no-notes` is for a capture that goes into a document which carries its own write-up. The
// annotations are written for a reader looking at the board, and at a document's placed width
// they are too small to read while still being large enough to look like the description — so
// the page ends up carrying two descriptions, one of them illegible.
//
// **Every file the board writes is opened, and the count is one.** A board that declares an axis
// to split along writes several; stopping at the first would leave three quarters of the frames
// uncaptured and report a number that looks like the whole board.
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { launchBrowser } from '../browser.mjs';
import { loadBoard } from '../context.mjs';
import { outputFiles } from '../split.mjs';

/** The rectangle of every frame on one loaded page, read in one pass. */
const frameRects = (pre) => {
  const out = [];
  for (const f of document.querySelectorAll('article.frame')) {
    if (pre && !f.id.includes(pre)) continue;
    const r = f.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    out.push({
      id: f.id,
      x: r.left + window.scrollX, y: r.top + window.scrollY,
      width: r.width, height: r.height,
    });
  }
  return out;
};

/**
 * Capture each frame of a built board.
 *
 * @param boardDir the board folder — every file its settings say it writes is read from it
 * @param outDir where the PNGs go
 * @param prefix capture only the frames whose anchor contains this (`p-` for one cluster)
 * @param opts `notes: false` drops each frame's annotation block from the capture
 */
export async function shootFrames(boardDir, outDir, prefix = '', { notes = true } = {}) {
  const { config } = await loadBoard(boardDir, { screens: false });
  const files = process.env.BOARD
    ? [process.env.BOARD]
    : outputFiles(config).map((f) => join(boardDir, f));
  for (const f of files) {
    if (!existsSync(f)) throw new Error(`빌드된 보드가 없습니다: ${f} — 먼저 node wf.mjs build를 실행합니다`);
  }
  await mkdir(outDir, { recursive: true });

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ width: 1900, height: 1200 });
    let taken = 0;
    for (const board of files) {
      await page.goto(pathToFileURL(board).href);
      // Frames are captured at true device pixels, and the board chrome is fixed to the viewport
      // where it would sit over a per-frame capture.
      await page.addStyle(
        ':root { --frame-zoom: 1 !important; } ' +
        '.wf-sidebar, .flow-title, .readme, .board-header, .board-nav { display: none !important; }' +
        (notes ? '' : ' .frame-notes { display: none !important; }')
      );

      // Rects are read in one pass: measuring between captures re-lays out the whole page.
      const frames = await page.evaluate(frameRects, prefix);
      for (const f of frames) {
        await page.screenshot({
          path: join(outDir, `${f.id}.png`),
          clip: { x: f.x, y: f.y, width: f.width, height: f.height },
        });
      }
      taken += frames.length;
    }
    console.log(`${taken}개 → ${outDir}${files.length > 1 ? ` (파일 ${files.length}개)` : ''}`);
    return taken;
  } finally {
    await browser.close();
  }
}
