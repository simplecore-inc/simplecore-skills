// Visual sweep of a built board — the checks a build cannot make because they need layout.
// Run after a build, before reporting a step done.
//
//   node wf.mjs check [--frames <id-prefix>]
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { launchBrowser } from '../browser.mjs';

/**
 * Measure a built board and report what a person would have to look for by eye.
 *
 * @param boardDir the board folder — `board.html` is read from it
 * @param framePrefix restrict the per-frame pass to one cluster
 * @returns the number of findings; zero means the geometry is clean, never that the board is
 */
export async function inspectBoard(boardDir, { framePrefix = '' } = {}) {
  const board = process.env.BOARD ?? join(boardDir, 'board.html');
  if (!existsSync(board)) throw new Error(`board.html이 없습니다: ${board} — 먼저 node wf.mjs build를 실행합니다`);
  const url = pathToFileURL(board).href;

  const browser = await launchBrowser();
  const page = await browser.newPage({ width: 1900, height: 1200 });
  await page.goto(url);
  // The zoom step scales frames down on narrow windows; measuring content needs true device
  // pixels. It is forced only for the per-frame pass — the board's own sideways promise is
  // checked below, unforced, because that zoom step is exactly what keeps the promise at a
  // laptop width.
  await page.addStyle(':root { --frame-zoom: 1 !important; }');

  const report = await page.evaluate((pre) => {
    const errors = [];
    const notes = [];
    for (const f of document.querySelectorAll('article.frame')) {
      // Narrowing is for iterating on one cluster. The sideways pass below is never narrowed —
      // the board's promise is about the whole board, and a cluster cannot answer for it.
      if (pre && !f.id.includes(pre)) continue;
      const label = f.querySelector('.frame-label')?.textContent?.trim().slice(0, 34) ?? f.id;
      const screen = f.querySelector('.screen');
      if (!screen) { errors.push(`${label} — .screen 없음`); continue; }
      const sb = screen.getBoundingClientRect();
      const fold = parseFloat(getComputedStyle(f).getPropertyValue('--vh'));
      const issues = [];

      // Nothing may stick out sideways past the screen's own edges.
      for (const el of screen.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        if (r.right > sb.right + 1.5 || r.left < sb.left - 1.5) {
          const cls = (el.className && String(el.className).split(' ')[0]) || el.tagName;
          if (!issues.some((i) => i.startsWith('overflow'))) issues.push(`overflow:${cls}`);
        }
      }

      // A bounded box can overflow ITSELF while sitting well inside the screen — the installer's
      // step rail ran 17px past its card's edge and the screen-level check above saw nothing, because
      // the screen is 1440px and the card is 420. Anything that draws its own border is a promise
      // about where its content ends, so each is measured against what it holds.
      const BOUNDED = '.auth-box, .modal, .sheet-paper, .ld-panel, .man, .card, .sect';
      for (const box of screen.querySelectorAll(BOUNDED)) {
        const bb = box.getBoundingClientRect();
        if (bb.width === 0) continue;
        for (const el of box.querySelectorAll('*')) {
          if (el.closest('.scroll-x')) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0) continue;
          if (r.right > bb.right + 1.5 || r.left < bb.left - 1.5) {
            const cls = (el.className && String(el.className).split(' ')[0]) || el.tagName;
            const bcls = String(box.className).split(' ')[0];
            if (!issues.some((i) => i.startsWith('box-overflow'))) {
              issues.push(`box-overflow:${bcls} ← ${cls} (+${Math.round(Math.max(r.right - bb.right, bb.left - r.left))}px)`);
            }
            break;
          }
        }
      }

      // Sideways scroll is allowed only inside a region that declares itself wider than the screen.
      // `overflow: hidden` is two different things and only one of them is a defect: with
      // `text-overflow: ellipsis` it is a name deliberately cut short, and the 「…」 tells the reader
      // so — a tree's label column is exactly that. Without the ellipsis the same clip drops the end
      // of the text and leaves no mark, which is the silent kind and still fails here.
      for (const el of screen.querySelectorAll('*')) {
        if (el.classList.contains('scroll-x')) continue;
        if (el.scrollWidth <= el.clientWidth + 2) continue;
        const cs = getComputedStyle(el);
        if (cs.overflowX === 'visible') continue;
        if (cs.overflowX === 'hidden' && cs.textOverflow === 'ellipsis') continue;
        issues.push(`${cs.overflowX === 'hidden' ? '잘림' : 'scroll-x'}:${String(el.className).split(' ')[0]}`);
        break;
      }

      // A component called with the wrong option shape renders its wrapper and no content: a
      // calendar with `month`/`marks` at the top level draws the weekday strip over an empty grid,
      // a matrix without `rows` draws its header alone. Nothing upstream can see it — the markup is
      // balanced, no value leaked, the frame is there. Only the emptiness gives it away, so that is
      // what is measured: a container whose whole job is to hold rows, holding none.
      const MUST_HOLD = {
        '.cal-grid': '달력에 날짜가 없다', '.mx': '매트릭스에 행이 없다',
        '.jn': '레일에 노드가 없다', '.att-grid': '첨부 격자가 비었다',
        '.aflow': '승인 흐름에 단계가 없다', '.tree': '트리에 노드가 없다',
        '.ts-track': '시간 선택기에 띠가 없다', '.cvs-stage': '캔버스에 표시가 없다',
      };
      for (const [sel, why] of Object.entries(MUST_HOLD)) {
        for (const el of screen.querySelectorAll(sel)) {
          if (el.children.length === 0) issues.push(`empty:${sel.slice(1)} — ${why}`);
        }
      }

      // Two boxes drawn edge to edge fuse into one shape with a line through it. It is a container
      // that causes it rather than either box — a stack whose parent sets no `gap` and whose blocks
      // set no margin — so one missing rule empties the space under every table on every frame that
      // container draws, and nothing errors. It reached 42 places on this board before a person
      // looked at a screen and said the message under the table was stuck to it.
      //
      // **What counts as a box is what the reader sees as one**: a border all the way round, or a
      // rounded fill. Rows inside a table, a header band above a pane body and a title above its own
      // subtitle all touch on purpose and draw no such box, which keeps this quiet on them without a
      // list of exceptions.
      //
      // **The boxes are compared to each other rather than as siblings, and that is the whole
      // check.** Written as «two adjacent children of one parent» it went quiet on the defect it was
      // built for: the table sits inside a bare flex wrapper and the message beside that wrapper, so
      // the two elements that touch are not siblings and the wrapper draws no box of its own. What a
      // reader sees is two borders meeting, wherever the two live in the tree.
      const boxed = (el) => {
        const cs = getComputedStyle(el);
        const round = ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth']
          .every((side) => parseFloat(cs[side]) > 0);
        const filled = parseFloat(cs.borderTopLeftRadius) > 0
          && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
        return round || filled;
      };
      const drawn = [...screen.querySelectorAll('*')]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ el, r }) => r.height > 0 && r.width > 40 && boxed(el));
      const named = (el) => String(el.className).split(' ')[0] || el.tagName.toLowerCase();
      let fused = null;
      for (const above of drawn) {
        for (const below of drawn) {
          if (above === below) continue;
          // A box inside another shares its edge by construction — a panel's foot sits on the
          // panel's own border — and that is not two boxes meeting.
          if (above.el.contains(below.el) || below.el.contains(above.el)) continue;
          if (Math.abs(below.r.top - above.r.bottom) > 0.6) continue;
          // Same column and same width: two blocks in one stack. A box that merely happens to end
          // where a narrower one begins is beside it, not above it.
          if (Math.abs(below.r.left - above.r.left) > 2 || Math.abs(below.r.width - above.r.width) > 2) continue;
          fused = `${named(above.el)} | ${named(below.el)}`;
          break;
        }
        if (fused) break;
      }
      if (fused) issues.push(`붙음:${fused} — 두 상자가 맞닿아 한 덩어리로 그려진다. 담은 컨테이너에 gap이 없다`);

      // A desktop screen may run past its fold — it scrolls — but its primary action may not.
      // The primary action is the emphasised button in the page header; a screen whose main act is
      // destructive has a `danger` there and no `primary` at all. Only when the header carries
      // neither does an emphasised button elsewhere count.
      //
      // "Elsewhere" excludes three places, because a button there belongs to the thing that holds
      // it rather than to the screen — and each of the three is BELOW THE FOLD BY CONSTRUCTION, so
      // counting it reports a defect that no layout could avoid:
      //   .msg     a message's own action (「12개월로 되돌리기」 on B-04, 「첫 칸으로」 on G-12)
      //   .ld-foot the detail panel's footer, pinned to the floor of a list-detail region that the
      //            board's layout rule puts LAST on the page (J-12 · J-38)
      //   .modal   a dialog's action; a dialog is an overlay with its own reading order (J-29)
      //   .dv-note the viewer's note strip — it acts on what the viewer is drawing, and the viewer
      //            sits wherever the page put it (G-12)
      const desktop = f.classList.contains('desktop') || sb.width >= 1000;
      const NOT_THE_SCREENS = '.msg, .ld-foot, .modal, .dv-note';
      const primary = screen.querySelector('.pagehead .actions .btn.primary, .pagehead .actions .btn.danger')
        ?? [...screen.querySelectorAll('.btn.primary, .btn-primary')].find((b) => !b.closest(NOT_THE_SCREENS));
      if (desktop && primary) {
        const pb = primary.getBoundingClientRect();
        if (pb.bottom - sb.top > fold + 1) {
          issues.push(`primary action fold 아래 (+${Math.round(pb.bottom - sb.top - fold)}px)`);
        }
      }

      // A phone or tablet has no scroll for its fixed chrome: a tab bar or CTA below the fold is gone.
      for (const sel of ['.tabbar', '.cta']) {
        const el = !desktop && screen.querySelector(sel);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.bottom - sb.top > fold + 1) issues.push(`${sel} fold 아래`);
      }

      // The same clip, downwards. Only the sideways version was ever measured, and a dialog capped
      // at a flat 360px cut 90 blocks across the board without a scrollbar or any other mark — a
      // reference table that ends mid-row reads as a table with fewer rows, and no reviewer can tell
      // the difference. A box that scrolls is fine and a box that hides is not, so the test is the
      // same one the sideways check makes: `auto`/`scroll` passes, `hidden` fails.
      for (const el of screen.querySelectorAll('*')) {
        if (el.scrollHeight <= el.clientHeight + 2) continue;
        const cs = getComputedStyle(el);
        if (cs.overflowY !== 'hidden' && cs.overflowY !== 'clip') continue;
        const over = Math.round(el.scrollHeight - el.clientHeight);
        issues.push(`세로 잘림:${String(el.className).split(' ')[0] || el.tagName} (+${over}px)`);
        break;
      }

      // On a list-detail page the list IS the page, so a reader who opens it and sees no row has
      // been handed a dashboard. The region may run past the fold — it scrolls — but the first row
      // may not, and everything above the region is what pushes it there: a card that must stay
      // visible is one thing, a second table and a rule matrix and a fourth message are another.
      // The four homes exist precisely so that pile has somewhere else to go.
      const region = screen.querySelector('.listdetail');
      if (region) {
        const first = region.querySelector('.ld-list .table .trow');
        if (first && first.getBoundingClientRect().bottom - sb.top > fold + 1) {
          const over = Math.round(first.getBoundingClientRect().bottom - sb.top - fold);
          issues.push(`목록의 첫 행이 fold 아래 (+${over}px) — 영역 위를 덜어낸다`);
        }
      }

      // A floating layer (toast stack, flyout) lands on top of whatever is under it. When it covers
      // text, the frame shows two things in one place and neither reads as what it is.
      for (const over of screen.querySelectorAll('.toasts, .flyout')) {
        const ob = over.getBoundingClientRect();
        for (const el of screen.querySelectorAll('*')) {
          if (over.contains(el) || el.contains(over)) continue;
          if (!el.firstChild || el.firstChild.nodeType !== Node.TEXT_NODE) continue;
          if (!el.textContent.trim()) continue;
          const r = el.getBoundingClientRect();
          if (r.right < ob.left || r.left > ob.right || r.bottom < ob.top || r.top > ob.bottom) continue;
          issues.push(`겹침: ${String(over.className).split(' ')[0]} 위에 「${el.textContent.trim().slice(0, 16)}」`);
          break;
        }
      }

      if (issues.length) errors.push(`${label} — ${issues.join(' · ')}`);
      else if (sb.height > fold + 1) notes.push(`${label} — fold +${Math.round(sb.height - fold)}px (스크롤)`);
    }

    return { errors, notes };
  }, framePrefix);
  for (const line of report.errors) console.log(`✖ ${line}`);
  if (!report.errors.length) console.log('✔ 넘침·가로 스크롤·fold 위 주 버튼 — 문제 없음');
  if (report.notes.length) console.log(`ℹ fold 아래로 이어지는 프레임 ${report.notes.length}개 (데스크톱은 스크롤되므로 정상)`);

  // The board never scrolls sideways — at a wide window and at a laptop width, with the zoom
  // step doing its job. A fresh page, because the pass above disabled that step to measure.
  const sideways = [];
  const plain = await browser.newPage();
  for (const width of [1900, 1440, 1280]) {
    await plain.setViewport({ width, height: 900 });
    await plain.goto(url);
    const over = await plain.evaluate(() => {
      const de = document.documentElement;
      return de.scrollWidth > de.clientWidth + 2 ? de.scrollWidth - de.clientWidth : 0;
    });
    if (over) sideways.push(`${width}px에서 보드 가로 스크롤 ${over}px`);
  }
  for (const line of sideways) console.log(`✖ ${line}`);
  if (!sideways.length) console.log('✔ 1900·1440·1280px 어디서도 보드 가로 스크롤 없음');

  await browser.close();
  return report.errors.length + sideways.length;
}
