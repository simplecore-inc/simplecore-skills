// One PDF per volume, on a board whose output is split.
//
// **A volume is not a file on disk.** The split writes one HTML per part; a volume gathers
// several parts into one document, and a PDF is one document — so the pages come from the board
// assembled again rather than from anything a reader could open. That assembly is the build's
// (`assembleBoard`), and what is left here is where it goes: a scratch file the renderer can load,
// and the name the PDF is given so two volumes are never mistaken for two builds of one.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderPdf, pdfPathFor } from './pdf.mjs';

/**
 * The name a volume's PDF is filed under.
 *
 * <p>`pdf/<pdfName>-<volume>-<stamp>.pdf`. The volume marker sits inside the board's own name and
 * before the stamp so the folder sorts by board, then by volume, then by build — and so a copy
 * that has left the folder still says which volume it is.
 */
export const volumePdfPath = (config, boardDir, volume) =>
  pdfPathFor({ ...config, pdfName: `${config.pdfName}-${volume.name}` }, boardDir);

/**
 * Render every volume of an assembled board.
 *
 * <p>The scratch file lives in the system's temporary folder rather than beside the board: it is
 * not an artifact, and a half-written volume left in the board folder is a file that looks like
 * one of the five and is not. It is removed whether the render succeeds or throws.
 *
 * @param volumeDocs `{ volume, html }`, from `assembleBoard`
 * @param suffix appended to each volume's name — how a share copy is told from the full one
 * @param pdfOptions passed through to the renderer (`maskRatio`, `maskSeed`, `hideReadme`)
 * @returns the paths written
 */
export async function renderVolumes({ config, boardDir, volumeDocs, suffix = '', pdfOptions = {}, outDir = null }) {
  const scratch = mkdtempSync(join(tmpdir(), 'wf-volume-'));
  const written = [];
  try {
    for (const doc of volumeDocs) {
      const htmlPath = join(scratch, `${doc.volume.name}.html`);
      writeFileSync(htmlPath, doc.html);
      const named = { ...doc.volume, name: `${doc.volume.name}${suffix}` };
      const pdfPath = outDir
        ? join(outDir, `${config.pdfName}-${named.name}.pdf`)
        : volumePdfPath(config, boardDir, named);
      await renderPdf({ htmlPath, pdfPath, config, ...pdfOptions });
      written.push(pdfPath);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  return written;
}
