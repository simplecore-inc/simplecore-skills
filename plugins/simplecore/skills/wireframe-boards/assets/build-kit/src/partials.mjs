// Frame chrome + document assembly — defined ONCE, rendered for every screen. A
// screen file carries only its bespoke body (composed from components.mjs) plus a
// little metadata; frame() wraps it in the right device shell. This is the same
// greybox vocabulary the single-file board-template.html teaches, split into a build.
import { browserbar } from './components.mjs';

// frame(screen, num): wraps one device frame. `device` is 'phone' (default),
// 'tablet', or 'desktop'; `variant` is 'narrow' or 'wide' for a responsive pair.
// The body (composed from components — statusbar/appbar/tabbar for touch,
// shell/sidebar/main for desktop) IS the screen content; frame() only adds the
// device shell, the desktop browser bar + fold, the label, and the notes. `num`
// (e.g. A-02) is the stable screen number the sidebar and author address it by.
export function frame(s, num, file = '') {
  const arrow = s.arrowBefore ? `\n    ${s.arrowBefore}\n` : '';
  const notes = s.notes ? `\n      <div class="frame-notes">\n        ${s.notes}\n      </div>` : '';
  const anchor = `s-${num.toLowerCase()}`;
  const device = s.device || 'phone';
  // phone portrait is the bare `.frame`; every other device/variant needs its class
  const classes = ['frame'];
  if (!(device === 'phone' && !s.variant)) classes.push(device);
  if (s.variant) classes.push(s.variant);
  const isDesktop = device === 'desktop';
  const browser = isDesktop ? `${browserbar(s.url || 'app.example.com')}\n        ` : '';
  const fold = isDesktop ? `\n          <div class="fold"><span>fold · ${s.fold || 'smallest window'}</span></div>` : '';
  // The number comes from the manifest position, the slug from the file name — they drift
  // apart the moment a screen is reordered, so the label carries BOTH. A reader who was given
  // one of them can find the frame by either.
  const slug = file ? `<span class="fslug">${file}</span>` : '';
  const label = `<span class="fnum">${num}</span>${s.route ? s.route + ' — ' : ''}${s.screen}${s.state ? ' — ' + s.state : ''}${slug}`;
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
// screens:[{num, label, anchor, file}]}]. Each entry shows the number AND the source file
// slug, because a reference handed to a reader may be written either way.
export function sidebar(sections) {
  const body = sections.map((sec) =>
    `<div class="sb-sec">${sec.letter}. ${sec.title}</div>\n` +
    sec.screens.map((sc) =>
      `    <a href="#${sc.anchor}"><span class="num">${sc.num}</span><span class="lbl">${sc.label}` +
      (sc.file ? `<span class="slug">${sc.file}</span>` : '') + `</span></a>`
    ).join('\n')
  ).join('\n    ');
  return `<nav class="wf-sidebar">
    <h2>product name</h2>
    <div class="sb-sub">screen index · number and file</div>
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
export function page({ title, sidebarHtml, introHtml, sectionsHtml, styles }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
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
