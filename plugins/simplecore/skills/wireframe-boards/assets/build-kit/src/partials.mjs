// Frame chrome + document assembly — defined ONCE, rendered for every screen. A
// screen file carries only its bespoke body (composed from components.mjs) plus a
// little metadata; frame() wraps it in the right device shell. This is the same
// greybox vocabulary the single-file board-template.html teaches, split into a build.
import { browserbar } from './components.mjs';

// frame(screen, id, seq, file): wraps one device frame. `device` is 'phone' (default),
// 'tablet', or 'desktop'; `variant` is 'narrow' or 'wide' for a responsive pair.
// The body (composed from components — statusbar/appbar/tabbar for touch,
// shell/sidebar/main for desktop) IS the screen content; frame() only adds the
// device shell, the desktop browser bar + fold, the label, and the notes.
//
// `id` (A-20) is the screen's PERMANENT number, from its file name — what everyone
// addresses it by. `seq` (02) is its position in the board's visual order this build.
// `anchor` is supplied by the build, which owns uniqueness across a responsive pair.
export function frame(s, id, seq, file = '', anchor = `s-${id.toLowerCase()}`) {
  const arrow = s.arrowBefore ? `\n    ${s.arrowBefore}\n` : '';
  const notes = s.notes ? `\n      <div class="frame-notes">\n        ${s.notes}\n      </div>` : '';
  const device = s.device || 'phone';
  // phone portrait is the bare `.frame`; every other device/variant needs its class
  const classes = ['frame'];
  if (!(device === 'phone' && !s.variant)) classes.push(device);
  if (s.variant) classes.push(s.variant);
  const isDesktop = device === 'desktop';
  const browser = isDesktop ? `${browserbar(s.url || 'app.example.com')}\n        ` : '';
  const fold = isDesktop ? `\n          <div class="fold"><span>fold · ${s.fold || 'smallest window'}</span></div>` : '';
  // `[02]A-20` — the visual position first, so a reader scanning the board can see where they
  // are, then the permanent id, which is what they were actually given. The file name is NOT
  // shown: the id IS the number in the file name, so `A-20` already locates `a-20-*.mjs`.
  const label =
    `<span class="fseq">[${seq}]</span><span class="fnum">${id}</span>` +
    `${s.route ? s.route + ' — ' : ''}${s.screen}${s.state ? ' — ' + s.state : ''}`;
  return `${arrow}    <article class="${classes.join(' ')}" id="${anchor}">
      <div class="device">
        ${browser}<div class="screen">
          ${s.body}${fold}
        </div>
      </div>
      <div class="frame-label">${label}</div>${notes}
    </article>`;
}

// sidebar(sections): the fixed table of contents. sections = [{letter, title,
// screens:[{id, seq, label, anchor}]}]. Two lines per entry — position + permanent id, then
// the label. The file name is not listed: the id is the number the file is named for.
export function sidebar(sections) {
  const body = sections.map((sec) =>
    `<div class="sb-sec">${sec.letter}. ${sec.title}</div>\n` +
    sec.screens.map((sc) =>
      `    <a href="#${sc.anchor}" title="${sc.id} · ${sc.label}">` +
      `<span class="num"><span class="seq">[${sc.seq}]</span>${sc.id}</span>` +
      `<span class="lbl">${sc.label}</span></a>`
    ).join('\n')
  ).join('\n    ');
  return `<nav class="wf-sidebar">
    <h2>product name</h2>
    <div class="sb-sub">[position] permanent id</div>
    ${body}
  </nav>`;
}

// page({title, sidebarHtml, introHtml, sectionsHtml, styles}): the whole document.
// The viewport-toggle checkbox is the FIRST body element so board-template's CSS-only
// narrow⇄wide toggle keeps working (its rules reach frames via the sibling combinator);
// pair a `.view-toggle` label in your intro/header to flip it. The only script is a
// progressive-enhancement scroll-spy: the board renders and anchor navigation work
// with JS off; this inline script (no external resources) merely highlights the TOC
// entry of the frame you click or view.
// The board contract this kit writes. Stamped into every built board so a later session can
// tell what a board was built against without inferring it from the markup, and migrate it when
// the skill has moved on. Bump it ONLY when the contract changes in a way that needs a
// migration — a new class, a new note prefix, a restyle do not.
//
//   1  original: frame numbers derived from manifest position; rows scrolled sideways
//   2  permanent ids from the file name + bracketed board position; rows wrap, no sideways scroll
export const BOARD_CONTRACT = 2;

export function page({ title, sidebarHtml, introHtml, sectionsHtml, styles }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="wireframe-board-contract" content="${BOARD_CONTRACT}">
<title>${title}</title>
<style>
${styles}
</style>
</head>
<body>
<input type="checkbox" id="viewport" class="view-input" aria-label="Viewport width">
${sidebarHtml}
<div class="wf-board">
${introHtml}
${sectionsHtml}
</div>
<script>
(function () {
  var links = document.querySelectorAll('.wf-sidebar a[href^="#"]');
  var byId = {};
  links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
  function setOn(id) { links.forEach(function (a) { a.classList.remove('on'); }); if (byId[id]) byId[id].classList.add('on'); }
  var io = new IntersectionObserver(function (entries) {
    var best = null, r = 0;
    entries.forEach(function (e) { if (e.intersectionRatio > r) { r = e.intersectionRatio; best = e.target; } });
    if (best && r > 0) setOn(best.id);
  }, { threshold: [0.2, 0.5, 0.8], rootMargin: '-8% 0px -55% 0px' });
  document.querySelectorAll('.frame[id]').forEach(function (f) { io.observe(f); });
  links.forEach(function (a) { a.addEventListener('click', function () { setOn(a.getAttribute('href').slice(1)); }); });
})();
</script>
</body>
</html>`;
}
