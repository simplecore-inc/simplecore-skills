// Render a built board to PDF: one frame per landscape page, a linked table of contents
// in front, and PDF bookmarks so a reader jumps by section and by screen.
//
//   node wf.mjs pdf             → board.html → <pdfName>-<YYYYMMDD-HHmm>.pdf
//   node wf.mjs pdf --in <in.html> --out <out.pdf>
//
// A share copy — the size of the board and how finished it is, without every screen:
//
//   node wf.mjs pdf --mask 40%              → …-share40.pdf
//   node wf.mjs pdf --mask 40% --watermark  → the same, stamped
//
// The build calls renderPdf() at the end of every build, so the PDF is never
// a stale copy of a board that has moved on. A build never masks: a share copy is asked for
// by hand, because the board's own PDF is the one implementation reads from.
//
// The reading contract (`.readme`) is deliberately NOT printed. It is the instruction to
// whoever implements from the board, and implementing is done from the HTML board — the PDF
// is the copy that gets read, sent, and printed.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, basename, isAbsolute } from 'node:path';
import { launchBrowser } from '../browser.mjs';


// ── Naming ────────────────────────────────────────────────────────────────────
// `pdf/<pdfName>-<YYYYMMDD-HHmm>.pdf`, from `board.config.mjs`. The stamp is what tells two
// copies apart once they have left this folder — a PDF sent to somebody else carries no build
// log, so the name has to say when it was made.
//
// **Every build's PDF is kept, in a folder of its own.** Earlier ones are not deleted: a copy
// that has already been sent is the only record of what the reader on the other end is looking
// at, and a build that removes it leaves nobody able to answer «which version did you get».
// The folder is git-ignored, so keeping them costs a diff nothing.
const PDF_DIR = 'pdf';

const stampNow = (at = new Date()) => {
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${at.getFullYear()}${p(at.getMonth() + 1)}${p(at.getDate())}-${p(at.getHours())}${p(at.getMinutes())}`;
};

export const pdfPathFor = (cfg, dir, at = new Date()) =>
  join(dir, PDF_DIR, `${cfg.pdfName}-${stampNow(at)}.pdf`);

// ── Page geometry ─────────────────────────────────────────────────────────────
// A4 landscape. The frames are laid out at true device pixels (a desktop frame is 1440px
// wide), so the page is the thing that adapts: every frame is scaled to fit its page, and a
// wide desktop frame therefore prints smaller than a phone one.
const PAGE = {
  widthIn: 11.69,
  heightIn: 8.27,
  marginIn: { top: 0.28, right: 0.3, bottom: 0.42, left: 0.3 },
};
const PX_PER_IN = 96;
const availW = Math.floor((PAGE.widthIn - PAGE.marginIn.left - PAGE.marginIn.right) * PX_PER_IN);
const availH = Math.floor((PAGE.heightIn - PAGE.marginIn.top - PAGE.marginIn.bottom) * PX_PER_IN);

// A frame page is two columns: the drawing, and a fixed column on the right holding the frame's
// label and notes. Fixed, because the frame is scaled to fit its page and the notes must not be
// — text that shrinks with a 1440px desktop frame becomes unreadable exactly where there is most
// to read. It also gives the tall phone frames the full page height instead of sharing it.
const SIDE_W = 250;
const SIDE_GAP = 18;
const stageW = availW - SIDE_W - SIDE_GAP;

// ── The page-side rebuild ─────────────────────────────────────────────────────
// Runs inside the loaded board. Turns a scrolling board into a paginated document:
// a cover, a table of contents, then one page per frame with the section's own cover
// page ahead of it. Headings (h1/h2/h3) are what Chrome reads to build the PDF outline,
// so each of those pages carries one.
function paginate(opt) {
  const { availW, availH, stageW, sideW, sideGap, hideReadme, maskRatio, maskSeed } = opt;
  const d = document;
  const q = (sel, root = d) => root.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

  const boardTitle = q('.board-header h1')?.textContent.trim() ?? d.title;
  const boardTag = q('.board-header .tag')?.textContent.trim() ?? '';
  if (hideReadme) q('.readme')?.remove();

  // The table of contents is read off the sidebar: it already carries every screen's
  // position, permanent id, label and anchor, one entry per screen (a responsive pair
  // is one entry, as it is one screen).
  //
  // Walk it by SELECTOR in document order, never by child position — the sidebar wraps its
  // head and each section in containers so the index filter can hide them, and a `.children`
  // walk sees those wrappers instead of the entries and prints a table of contents with
  // nothing in it.
  const sections = [];
  const sidebar = q('.wf-sidebar');
  if (sidebar) {
    let cur = null;
    for (const node of Array.from(sidebar.querySelectorAll('.sb-sec, a[href^="#"]'))) {
      if (node.classList.contains('sb-sec')) {
        const nEl = q('.sb-n', node);
        const count = nEl ? nEl.textContent.trim() : '';
        if (nEl) nEl.remove();
        cur = { title: node.textContent.trim(), count, items: [] };
        sections.push(cur);
      } else if (node.tagName === 'A' && cur) {
        const seq = q('.seq', node)?.textContent.trim() ?? '';
        const num = q('.num', node)?.textContent.trim() ?? '';
        cur.items.push({
          anchor: (node.getAttribute('href') ?? '#').slice(1),
          seq,
          id: num.startsWith(seq) ? num.slice(seq.length).trim() : num,
          label: q('.lbl', node)?.textContent.trim() ?? '',
        });
      }
    }
  }

  const style = d.createElement('style');
  style.textContent = `
    :root { --frame-zoom: 1 !important; }
    html, body { background: #fff !important; background-image: none !important; }
    body { padding: 0 !important; margin: 0 !important; }
    .wf-sidebar, .board-header, .board-nav, .view-input, .toc { display: none !important; }
    .wf-board { margin-left: 0 !important; }
    /* On paper there is no viewport toggle, so both halves of a responsive pair print. */
    .view-input ~ * .frame.narrow, .view-input ~ * .frame.wide,
    .view-input:checked ~ * .frame.narrow, .view-input:checked ~ * .frame.wide { display: block !important; }
    .pdf-page {
      width: ${availW}px; height: ${availH}px; overflow: hidden;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      break-after: page; page-break-after: always; break-inside: avoid;
    }
    .pdf-page:last-child { break-after: auto; page-break-after: auto; }
    /* Print rasterises what it cannot express as vectors: a repeating conic/linear-gradient
       tile and a translucent overlay each become a bitmap the size of the box holding it, and
       one QR placeholder was costing 300KB of PDF a page. Flat fills read the same at this
       fidelity — these are placeholders, not artwork. */
    .qr-ph, .cvs-stage, .img-ph { background-image: none !important; }
    .dim { background: #cdd2d9 !important; }
    * { box-shadow: none !important; }
    .pdf-page .frame { margin: 0; flex: 0 0 auto; }
    .pdf-frame { flex-direction: column; align-items: stretch; justify-content: flex-start; }
    .pdf-body {
      flex: 1 1 auto; min-height: 0; width: 100%;
      display: flex; flex-direction: row; align-items: stretch; justify-content: flex-start; gap: ${sideGap}px;
    }
    .pdf-stage {
      width: ${stageW}px; flex: 0 0 auto; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
    }
    /* A running header on every frame page. A page of this PDF arrives on its own — printed,
       forwarded, quoted back in a mail — and twenty pages past its section cover there is
       nothing on it saying which board or which cluster it came from. Chrome's own
       headerTemplate cannot do this job: it is ONE template for the whole document and knows
       only the page number, so the header is drawn into the page instead. */
    .pdf-head {
      flex: 0 0 auto; width: 100%; height: 21px; display: flex; align-items: center; gap: 12px;
      border-bottom: 1px solid var(--line); margin-bottom: 8px;
      font: 8.5px var(--mono); color: var(--muted); white-space: nowrap;
    }
    .pdf-head .h-proj { flex: 0 0 auto; font-weight: 700; color: var(--ink); }
    .pdf-head .h-sec { flex: 1 1 auto; min-width: 0; text-align: center; overflow: hidden; text-overflow: ellipsis; }
    .pdf-head .h-scr { flex: 0 1 auto; min-width: 0; max-width: 44%; overflow: hidden; text-overflow: ellipsis; }
    .pdf-head .h-scr .h-id { font-weight: 700; color: var(--accent); }
    .pdf-side {
      width: ${sideW}px; flex: 0 0 auto; overflow: hidden;
      border-left: 1px solid var(--line); padding: 2px 0 2px 14px;
      display: flex; flex-direction: column; gap: 8px;
    }
    /* em, not px: a column whose notes do not fit is shrunk as a whole, below. */
    .pdf-side { font-size: 10px; }
    .pdf-side .frame-label { font: 600 1.1em var(--mono); margin: 0; line-height: 1.5; }
    .pdf-side .frame-notes { font: 1em var(--mono); color: var(--muted); margin: 0; line-height: 1.65; }
    .pdf-cover { justify-content: center; gap: 18px; }
    .pdf-cover h1 { font-size: 34px; font-weight: 800; letter-spacing: -0.01em; text-align: center; }
    .pdf-cover .pdf-cover-tag {
      border: 1.5px dashed var(--accent); color: var(--accent);
      font: 600 13px var(--mono); padding: 5px 12px; background: var(--screen);
    }
    .pdf-cover .pdf-cover-sub { font: 12px var(--mono); color: var(--muted); }
    .pdf-section { justify-content: center; gap: 10px; }
    .pdf-section h2 { font-size: 26px; font-weight: 800; letter-spacing: 0.01em; text-align: center; }
    .pdf-section .pdf-section-sub { font: 12px var(--mono); color: var(--muted); }
    /* An overview card owns its whole page: it was authored at this ratio, and stretches so a
       card shorter than the page still fills the width it was measured for. */
    .pdf-overview { justify-content: flex-start; align-items: stretch; padding: 0; }
    .pdf-overview .ov-frame { max-width: none; width: 100%; margin: 0; }
    /* No clipping: what does not fit is scaled by the pass above, so this stays visible or the
       scale would have nothing left to show. */
    .pdf-overview .ov-stage { aspect-ratio: auto; overflow: visible; }
    .pdf-toc { justify-content: flex-start; align-items: stretch; padding-top: 4px; }
    .pdf-toc h2 { font-size: 17px; font-weight: 800; margin-bottom: 10px; border-bottom: 2px solid var(--ink); padding-bottom: 5px; }
    .pdf-toc-cols { display: flex; gap: 22px; align-items: flex-start; flex: 1; min-height: 0; }
    .pdf-toc-col { flex: 1 1 0; min-width: 0; }
    .pdf-toc-sec {
      font: 700 10px var(--mono); color: var(--ink); letter-spacing: 0.03em;
      border-bottom: 1px solid var(--line); padding: 4px 0 2px; margin-bottom: 2px;
    }
    .pdf-toc-item {
      display: flex; gap: 6px; align-items: baseline; text-decoration: none; color: var(--ink);
      font-size: 10px; line-height: 1.5; padding: 0.5px 0;
    }
    .pdf-toc-item .t-id { font: 700 9px var(--mono); color: var(--accent); flex: 0 0 auto; }
    .pdf-toc-item .t-seq { font: 9px var(--mono); color: var(--muted); flex: 0 0 auto; }
    .pdf-toc-item .t-lbl { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); }
    .pdf-toc-item .t-pg { font: 9px var(--mono); color: var(--muted); flex: 0 0 auto; }
    /* A covered frame. Flat fills and a plain border, no repeating gradient: print turns a
       tile into a bitmap the size of the box, and on a share copy that box is a whole 1440px
       frame on hundreds of pages. The device outline stays, so the reader still sees which
       device class the screen belongs to and how tall it is. */
    .pdf-mask-box {
      width: 100%; height: 100%; box-sizing: border-box; padding: 24px;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
      background: #eceef1; text-align: center;
    }
    .pdf-mask-box .m-tag {
      font: 700 40px var(--mono); letter-spacing: 0.08em; color: #6b7480;
      border: 2px dashed #a6adb8; padding: 8px 22px;
    }
    .pdf-mask-box .m-sub { font: 17px var(--mono); color: #79818d; }
    .pdf-mask-box .m-meta { font: 15px var(--mono); color: #949ba5; }
    .pdf-cover .pdf-cover-mask {
      font: 600 12px var(--mono); color: var(--ink);
      border-top: 1px solid var(--line); padding-top: 12px; margin-top: 2px;
    }
  `;
  d.head.appendChild(style);

  const pages = d.createElement('div');
  pages.className = 'pdf-doc';
  // Attached before anything is measured: a detached element reports every size as zero,
  // and a zero line height silently lays the whole table of contents into one column that
  // then runs off the bottom of page one — a build that looks like it worked.
  d.body.appendChild(pages);
  const addPage = (cls) => {
    const p = d.createElement('div');
    p.className = `pdf-page${cls ? ` ${cls}` : ''}`;
    pages.appendChild(p);
    return p;
  };

  const flows = Array.from(d.querySelectorAll('section.flow'));
  const frameTotal = d.querySelectorAll('section.flow article.frame').length;

  // 1. Cover.
  const cover = addPage('pdf-cover');
  cover.innerHTML =
    `<h1>${esc(boardTitle)}</h1>` +
    (boardTag ? `<div class="pdf-cover-tag">${esc(boardTag)}</div>` : '') +
    `<div class="pdf-cover-sub">${flows.length} sections · ${frameTotal} frames</div>`;

  // 2. The opening overview — one landscape page per card, before the table of contents.
  //
  // It goes into the PDF while the reading contract does not, and the two are different kinds of
  // thing: the contract instructs whoever implements, and implementing is done from the HTML
  // board; this is what a reader needs before a wall of screens means anything, and most readers
  // meet the board as the PDF. Each card is authored at the printable area's own ratio, so it
  // lands on a page without being reshaped — and a card that outgrew it is scaled down with the
  // same transform the frames use rather than being cut.
  const overview = d.querySelector('.board-overview');
  const overviewPages = [];
  if (overview) {
    for (const card of Array.from(overview.querySelectorAll('.ov-frame'))) {
      const page = addPage('pdf-overview');
      page.appendChild(card);
      overviewPages.push({ page, card });
    }
    overview.remove();
    // A card taller than the page is SCALED, never clipped. Clipping removes rows from the
    // middle of a table with nothing on the page saying so — the reader counts twelve feature
    // keys and believes that is all there are. Scaled, the page is harder to read and honest.
    for (const { page, card } of overviewPages) {
      const room = page.clientHeight;
      const need = card.getBoundingClientRect().height;
      if (need > room && room > 0) {
        const k = Math.max(0.45, room / need);
        card.style.transform = `scale(${Math.round(k * 1000) / 1000})`;
        card.style.transformOrigin = 'top left';
        card.style.width = `${Math.round(100 / k)}%`;
      }
    }
  }

  // 3. Table of contents — how many pages it takes is decided from a measured line
  // height, because the page numbers it prints depend on that count.
  const lines = [];
  for (const sec of sections) {
    lines.push({ kind: 'sec', sec });
    for (const item of sec.items) lines.push({ kind: 'item', item });
  }
  const probe = addPage('pdf-toc');
  probe.innerHTML =
    '<h2>목차</h2><div class="pdf-toc-cols"><div class="pdf-toc-col">' +
    '<div class="pdf-toc-sec">A</div><a class="pdf-toc-item"><span class="t-seq">[01]</span>' +
    '<span class="t-id">A-01</span><span class="t-lbl">측정용</span><span class="t-pg">1</span></a>' +
    '</div></div>';
  const colH = q('.pdf-toc-cols', probe).getBoundingClientRect().height;
  const lineH = q('.pdf-toc-item', probe).getBoundingClientRect().height;
  const secH = q('.pdf-toc-sec', probe).getBoundingClientRect().height;
  probe.remove();

  const COLS = 3;
  if (!(colH > 0) || !(lineH > 0) || !(secH > 0)) {
    throw new Error(`table of contents: nothing to measure (col ${colH}, line ${lineH}, sec ${secH})`);
  }
  const perCol = Math.max(1, Math.floor(colH / lineH));
  // A section header is taller than an item, so its cost is counted in item-heights.
  const cost = (line) => (line.kind === 'sec' ? Math.ceil(secH / lineH) : 1);
  const columns = [[]];
  let used = 0;
  for (const line of lines) {
    const c = cost(line);
    if (used + c > perCol && columns[columns.length - 1].length) {
      columns.push([]);
      used = 0;
    }
    columns[columns.length - 1].push(line);
    used += c;
  }
  const tocPages = [];
  for (let i = 0; i < columns.length; i += COLS) {
    const page = addPage('pdf-toc');
    const head = tocPages.length === 0 ? '<h2>목차</h2>' : '';
    const cols = columns.slice(i, i + COLS).map((col) =>
      '<div class="pdf-toc-col">' + col.map((line) =>
        line.kind === 'sec'
          ? `<div class="pdf-toc-sec">${esc(line.sec.title)}${line.sec.count ? ` · ${esc(line.sec.count)}` : ''}</div>`
          : `<a class="pdf-toc-item" href="#${esc(line.item.anchor)}" data-anchor="${esc(line.item.anchor)}">` +
            `<span class="t-seq">${esc(line.item.seq)}</span><span class="t-id">${esc(line.item.id)}</span>` +
            `<span class="t-lbl">${esc(line.item.label)}</span><span class="t-pg"></span></a>`
      ).join('') + '</div>'
    ).join('');
    page.innerHTML = `${head}<div class="pdf-toc-cols">${cols}</div>`;
    tocPages.push(page);
  }

  // 3. One page per frame, behind its section's cover page.
  //
  // The running header names the board, the section, and the screen. The board's own title
  // carries the three apps after an em dash — too long to repeat on 532 pages, and the cover
  // already states it in full — so the header takes what stands before that dash.
  const headProject = boardTitle.split(/\s+—\s+/)[0].trim() || boardTitle;
  const framePages = [];
  for (const flow of flows) {
    const secCover = addPage('pdf-section');
    const titleEl = q('.flow-title', flow);
    const countEl = titleEl ? q('.count', titleEl) : null;
    const count = countEl ? countEl.textContent.trim() : '';
    if (countEl) countEl.remove();
    const secTitle = titleEl ? titleEl.textContent.trim() : '';
    const h2 = d.createElement('h2');
    h2.textContent = secTitle;
    secCover.appendChild(h2);
    if (count) {
      const sub = d.createElement('div');
      sub.className = 'pdf-section-sub';
      sub.textContent = count;
      secCover.appendChild(sub);
    }
    for (const art of Array.from(flow.querySelectorAll('article.frame'))) {
      const page = addPage('pdf-frame');
      const stage = d.createElement('div');
      stage.className = 'pdf-stage';
      const side = d.createElement('div');
      side.className = 'pdf-side';
      // The label becomes the page's heading, which is what Chrome turns into a
      // PDF bookmark — the frame keeps printing exactly the label it printed before.
      const label = q('.frame-label', art);
      // Read for the header BEFORE the label is moved into the heading below.
      const headSeq = label ? q('.fseq', label)?.textContent.trim() ?? '' : '';
      const headId = label ? q('.fnum', label)?.textContent.trim() ?? '' : '';
      const headRest = label
        ? label.textContent.replace(headSeq, '').replace(headId, '').trim()
        : '';
      const head = d.createElement('div');
      head.className = 'pdf-head';
      head.innerHTML =
        `<span class="h-proj">${esc(headProject)}</span>` +
        `<span class="h-sec">${esc(secTitle)}</span>` +
        `<span class="h-scr">${esc(headSeq)} <span class="h-id">${esc(headId)}</span>` +
        `${headRest ? ` ${esc(headRest)}` : ''}</span>`;
      const bodyRow = d.createElement('div');
      bodyRow.className = 'pdf-body';
      if (label) {
        const h3 = d.createElement('h3');
        h3.className = label.className;
        h3.innerHTML = label.innerHTML;
        // On screen the id is a padded badge and the route reads as a separate word. A
        // bookmark is plain text, where the two run together as `A-01/login`.
        const num = q('.fnum', h3);
        if (num && num.nextSibling) num.after(d.createTextNode(' '));
        label.remove();
        side.appendChild(h3);
      }
      const notes = q('.frame-notes', art);
      if (notes) side.appendChild(notes);
      stage.appendChild(art);
      bodyRow.append(stage, side);
      page.append(head, bodyRow);
      // The PERMANENT id, not the anchor: the anchor of a responsive pair's second half
      // carries a `-b` suffix, and masking must treat the pair as the one screen it is.
      framePages.push({ page, art, side, stage, id: headId || art.id, section: secTitle });
    }
  }

  // Everything the frames were lifted out of goes now — the board's own scrolling layout,
  // its sidebar, and the viewport checkbox.
  for (const node of Array.from(d.body.children)) if (node !== pages) node.remove();

  // 3b. The share copy's cover. A reader gets to see how big the board is and how finished it
  // is without being given every screen, so the drawing of a share of the frames is NOT DRAWN
  // AT ALL — it never reaches the PDF, and no text extraction or vector-editing tool recovers
  // what was never written. Everything else about the page stays: the running header, the id,
  // the label, the notes, the table of contents, the page count.
  //
  // WHICH frames go is decided by hashing the screen's permanent id and covering it when that
  // score falls under the ratio. Every screen's fate is therefore settled by its own id alone —
  // not by how many neighbours it has, not by where it sits in a list — and three things follow:
  // the same ratio always covers the same screens, a larger ratio only ever ADDS to what a
  // smaller one covered, and **a screen once covered stays covered however far the board
  // grows**. That last one is why this is a threshold and not a per-section quota. A quota has
  // to count the section, so inserting frames raises the target, and a screen sitting on the
  // boundary gets pushed out and revealed — a copy sent in June would hand over screens that
  // April's copy withheld.
  //
  // The price is that a section's own share is approximate rather than exact: it lands near the
  // ratio on a large cluster and wanders on a small one. The whole board still comes out at the
  // ratio, and a cluster that vanishes entirely is reported below rather than shipped quietly.
  const masked = [];
  const bySection = new Map();
  if (maskRatio > 0) {
    // FNV-1a, then an avalanche step — and the second half is not optional. FNV's final
    // multiply dominates the high bits, so ids that differ in their last character score in a
    // straight line: `A-01` 0.8556, `A-02` 0.8517, `A-03` 0.8478, each exactly 0.0039 lower.
    // Sorting by that is sorting by screen number, so "a random 40%" silently becomes "the
    // tail of every section" — a pattern the reader of a share copy can see and extrapolate.
    // The three shift-multiply rounds below are murmur3's finalizer, and they cost nothing.
    const hash32 = (s) => {
      let h = 0x811c9dc5;
      for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      h ^= h >>> 16;
      h = Math.imul(h, 0x85ebca6b) >>> 0;
      h ^= h >>> 13;
      h = Math.imul(h, 0xc2b2ae35) >>> 0;
      h ^= h >>> 16;
      return h >>> 0;
    };
    const score = new Map();
    const scoreOf = (id) => {
      if (!score.has(id)) score.set(id, hash32(`${maskSeed} ${id}`) / 2 ** 32);
      return score.get(id);
    };

    // Judged by SCREEN, so a responsive pair — one screen, one id, two frames — is covered or
    // left alone as a whole and never cut in half.
    const chosen = framePages.filter((fp) => scoreOf(fp.id) < maskRatio);
    const chosenSet = new Set(chosen);

    // Counted per section and reported, because this is exactly what the threshold gives up:
    // a cluster that went entirely, or stayed entirely, is where the copy stops telling the
    // truth about the shape of the board, and it must not be found by the person receiving it.
    for (const fp of framePages) {
      const s = bySection.get(fp.section) ?? { total: 0, hidden: 0 };
      s.total += 1;
      if (chosenSet.has(fp)) s.hidden += 1;
      bySection.set(fp.section, s);
    }

    for (const fp of chosen) {
      const dev = q('.device', fp.art);
      if (!dev) continue;
      // Measured before it is emptied, then pinned: the covered frame keeps the exact size the
      // real one had, so the reader sees a phone where a phone was and the page scales alike.
      const w = dev.offsetWidth;
      const h = dev.offsetHeight;
      const vh = parseInt(getComputedStyle(fp.art).getPropertyValue('--vh'), 10);
      const kind = fp.art.classList.contains('desktop') ? 'desktop'
        : fp.art.classList.contains('tablet') ? 'tablet' : 'phone';
      dev.replaceChildren();
      dev.style.boxSizing = 'border-box';
      dev.style.width = `${w}px`;
      dev.style.height = `${h}px`;
      const box = d.createElement('div');
      box.className = 'pdf-mask-box';
      box.innerHTML =
        '<div class="m-tag">비공개</div>' +
        '<div class="m-sub">부분공개본에서 가린 화면입니다</div>' +
        `<div class="m-meta">${esc(fp.id)} · ${kind} · ${w}×${Number.isFinite(vh) ? vh : h}</div>`;
      dev.appendChild(box);
      masked.push(fp.id);
    }

    // Said on the cover, because a reader who meets a covered page first reads it as a hole in
    // the board rather than as a decision somebody made.
    const line = d.createElement('div');
    line.className = 'pdf-cover-mask';
    line.textContent = `부분공개본 · 전체 ${framePages.length}장 가운데 ${masked.length}장은 그림을 가렸습니다`;
    cover.appendChild(line);
  }

  // 4. Scale each frame to its page. Measured in one pass and applied in another, so
  // the document lays out twice rather than once per frame.
  //
  // The scale is a `transform`, NOT `zoom`. The board itself scales with `zoom` and that is
  // right on screen, but a few hundred separately-zoomed frames kill the print renderer: it
  // dies mid-print and the protocol answers "Printing failed", which reads like a bad option
  // rather than a crash. A transform prints identically and survives.
  //
  // Measured off the STAGE, not off the page: the running header takes a strip of the page
  // height, and a scale computed from the full page would push every frame that much past the
  // bottom edge — cropping the frames silently, which is how a page of a wireframe loses its
  // tab bar without anything reporting it.
  const zooms = framePages.map(({ art, stage }) => {
    const r = art.getBoundingClientRect();
    const box = stage.getBoundingClientRect();
    return r.width && r.height ? Math.min(box.width / r.width, box.height / r.height) : 1;
  });
  framePages.forEach(({ art }, i) => {
    art.style.transform = `scale(${Math.round(zooms[i] * 1000) / 1000})`;
    art.style.transformOrigin = 'center center';
  });

  // 5. Notes that do not fit their column are shrunk until they do. Five frames carry close to
  // a thousand characters, and a note cut off at the page edge takes the reader's answer with it
  // — silently, because a clipped column looks exactly like a short one.
  const tight = [];
  const overflow = framePages
    .map(({ side, art }) => ({ side, art, over: side.scrollHeight > side.clientHeight + 1 }))
    .filter((f) => f.over);
  for (const { side, art } of overflow) {
    let size = 10;
    while (size > 6.5 && side.scrollHeight > side.clientHeight + 1) {
      size = Math.round((size - 0.5) * 10) / 10;
      side.style.fontSize = `${size}px`;
    }
    if (side.scrollHeight > side.clientHeight + 1) tight.push(art.id);
  }

  // 6. Page numbers. Every page is one printed page, so a page's number is its position.
  const pageNo = new Map();
  Array.from(pages.children).forEach((p, i) => pageNo.set(p, i + 1));
  const anchorPage = new Map();
  for (const { page, art } of framePages) {
    if (art.id && !anchorPage.has(art.id)) anchorPage.set(art.id, pageNo.get(page));
  }
  for (const a of pages.querySelectorAll('.pdf-toc-item[data-anchor]')) {
    const n = anchorPage.get(a.dataset.anchor);
    if (n) a.querySelector('.t-pg').textContent = String(n);
  }

  return {
    clipped: tight,
    pages: pages.children.length,
    frames: framePages.length,
    masked: masked.sort(),
    maskBySection: Array.from(bySection, ([title, s]) => ({ title, ...s })),
    sections: flows.length,
    tocPages: tocPages.length,
    unresolved: Array.from(pages.querySelectorAll('.pdf-toc-item[data-anchor]'))
      .filter((a) => !a.querySelector('.t-pg').textContent).length,
  };
}

// ── Driving it ────────────────────────────────────────────────────────────────
const FOOTER = (title) => `<div style="width:100%;box-sizing:border-box;padding:0 0.3in;
  font:8px -apple-system,system-ui,sans-serif;color:#5a6270;display:flex;justify-content:space-between;">
  <span>${title}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;

export async function renderPdf({
  htmlPath, pdfPath, config = null, hideReadme = true, quiet = false,
  maskRatio = 0, maskSeed = '',
} = {}) {
  if (!existsSync(htmlPath)) throw new Error(`no board to render: ${htmlPath}`);
  const browser = await launchBrowser();
  try {
    // The viewport IS the printable area, so what the page measures is what it prints.
    const page = await browser.newPage({ width: availW, height: availH });
    await page.goto(pathToFileURL(htmlPath).href);

    const stats = await page.evaluate(paginate, {
      availW, availH, stageW, sideW: SIDE_W, sideGap: SIDE_GAP, hideReadme, maskRatio, maskSeed,
    });
    await page.evaluate('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))).then(() => 1)');

    const title = await page.evaluate('document.title');
    const pdf = await page.pdf({
      // NOT `landscape: true` — that flag swaps paperWidth and paperHeight, so asking for a
      // landscape page with landscape dimensions gets a portrait one. The dimensions below
      // ARE the landscape page.
      printBackground: true,
      paperWidth: PAGE.widthIn,
      paperHeight: PAGE.heightIn,
      marginTop: PAGE.marginIn.top,
      marginBottom: PAGE.marginIn.bottom,
      marginLeft: PAGE.marginIn.left,
      marginRight: PAGE.marginIn.right,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: FOOTER(title),
      // A tagged PDF is what carries the outline; without it the bookmarks are dropped.
      generateTaggedPDF: true,
      generateDocumentOutline: true,
    });
    mkdirSync(dirname(pdfPath), { recursive: true });
    writeFileSync(pdfPath, pdf);

    if (stats?.clipped?.length) {
      console.error(`warning: 설명이 열을 넘쳐 잘렸다 — ${stats.clipped.join(', ')}`);
    }
    if (stats?.unresolved) {
      console.error(`warning: ${stats.unresolved} table-of-contents entries found no frame page`);
    }
    // A cluster that went entirely, or stayed entirely, is the threshold's one failure mode —
    // said out loud so it is a decision to accept rather than something the recipient finds.
    for (const s of stats?.maskBySection ?? []) {
      if (s.total && s.hidden === s.total) console.error(`warning: 「${s.title}」 구역이 통째로 가려졌다 (${s.total}장)`);
      if (s.total && s.hidden === 0) console.error(`warning: 「${s.title}」 구역은 한 장도 가려지지 않았다 (${s.total}장)`);
    }
    if (!quiet) {
      console.log(
        `pdf: ${stats.pages} pages (${stats.frames} frames · ${stats.sections} sections · ` +
        `${stats.tocPages}p 목차) · ${(pdf.length / 1024 / 1024).toFixed(1)} MB → ${basename(pdfPath)}`
      );
      if (stats.masked?.length) {
        const pct = ((stats.masked.length / stats.frames) * 100).toFixed(1);
        const shares = (stats.maskBySection ?? []).map((s) => (s.hidden / s.total) * 100);
        const spread = shares.length
          ? ` · 섹션별 ${Math.min(...shares).toFixed(1)}~${Math.max(...shares).toFixed(1)}%`
          : '';
        console.log(`      가린 화면: ${stats.masked.length}장 (${pct}%)${spread} · 시드 ${maskSeed || '(없음)'}`);
      }
    }
    return { ...stats, bytes: pdf.length };
  } finally {
    await browser.close();
  }
}

// ── The share copy's ratio ────────────────────────────────────────────────────
// `40%` or `0.4`, and nothing in between: a bare `40` is refused rather than guessed at,
// because the two readings differ by a factor of a hundred and the wrong one silently ships
// a board with four screens covered where four hundred were meant.
export function parseMaskRatio(raw) {
  const t = String(raw).trim();
  const pct = t.endsWith('%');
  const n = Number(pct ? t.slice(0, -1) : t);
  if (!Number.isFinite(n) || n < 0) throw new Error(`--mask: 숫자가 아니다 — ${raw}`);
  if (pct) {
    if (n > 100) throw new Error(`--mask: 100%를 넘는다 — ${raw}`);
    return n / 100;
  }
  if (n > 1) throw new Error(`--mask: 0~1 비율이거나 \`${n}%\` 처럼 백분율로 적는다 — ${raw}`);
  return n;
}

// ── Watermark ─────────────────────────────────────────────────────────────────
// Handed to Python because stamping an image onto every page of a finished PDF needs a PDF
// library, and this folder's rule is that the BOARD builds with nothing installed. The board,
// its checks, and the plain PDF all still run on Node alone; only the share copy — asked for
// by hand, when a PDF is about to leave — reaches for the script beside this file.
/**
 * Stamp the mark, and the line naming who the copy is for, onto every page.
 *
 * @param to who this copy is for. Drawn under the mark with the time it was made; omitted
 *   entirely when not given, because a stamp that says nothing is one people learn to ignore
 * @param out written beside `src` rather than over it — the plain PDF stays, so a stamped copy
 *   for one recipient never becomes the only copy anybody has
 */
export function stampWatermark({ logo, src, out, opacity, widthRatio, to = '' }) {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'watermark.py');
  if (!existsSync(logo)) throw new Error(`no watermark logo at ${logo}`);
  const args = [script, logo, src, out];
  if (opacity != null) args.push('--opacity', String(opacity));
  if (widthRatio != null) args.push('--width-ratio', String(widthRatio));
  if (to) args.push('--to', to);
  const r = spawnSync('python3', args, { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.error?.code === 'ENOENT') throw new Error('python3 not found — the watermark needs it');
  if (r.status !== 0) throw new Error(`watermark failed (exit ${r.status})`);
}

// ── CLI ───────────────────────────────────────────────────────────────────────
// The command line lives in `bin/wfb.mjs` — one entry point, so a flag means the same thing
// whichever artifact it is asked for.
