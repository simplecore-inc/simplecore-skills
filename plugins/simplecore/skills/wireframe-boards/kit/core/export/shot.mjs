// One PNG per frame of a built board, for looking at the work and for sending it on.
//
//   node wf.mjs shots _shots        every frame
//   node wf.mjs shots _shots p-     only the P cluster
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { launchBrowser } from '../browser.mjs';

/**
 * Capture each frame of a built board.
 *
 * @param boardDir the board folder — `board.html` is read from it
 * @param outDir where the PNGs go
 * @param prefix capture only the frames whose anchor contains this (`p-` for one cluster)
 */
export async function shootFrames(boardDir, outDir, prefix = '') {
  const board = process.env.BOARD ?? join(boardDir, 'board.html');
  if (!existsSync(board)) throw new Error(`board.html이 없습니다: ${board} — 먼저 node wf.mjs build를 실행합니다`);
  await mkdir(outDir, { recursive: true });

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ width: 1900, height: 1200 });
    await page.goto(pathToFileURL(board).href);
    // Frames are captured at true device pixels, and the board chrome is fixed to the viewport
    // where it would sit over a per-frame capture.
    await page.addStyle(
      ':root { --frame-zoom: 1 !important; } ' +
      '.wf-sidebar, .flow-title, .readme, .board-header { display: none !important; }'
    );

    // Rects are read in one pass: measuring between captures re-lays out the whole board.
    const frames = await page.evaluate((pre) => {
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
    }, prefix);

    for (const f of frames) {
      await page.screenshot({
        path: join(outDir, `${f.id}.png`),
        clip: { x: f.x, y: f.y, width: f.width, height: f.height },
      });
    }
    console.log(`${frames.length}개 → ${outDir}`);
    return frames.length;
  } finally {
    await browser.close();
  }
}
