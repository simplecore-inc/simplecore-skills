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
//
// The sidebar is a fixed HEAD (title, legend, filter) over a scrolling LIST, so the filter
// stays reachable from anywhere in a table of contents hundreds of entries long — a search
// box that scrolls away with the results is a search box nobody uses twice.
//
// Each section is wrapped in `.sb-group` so the filter can hide a whole section, header and
// all, when nothing in it matches. Anything reading this markup walks it by SELECTOR
// (`.sb-sec`, `a[href^="#"]`), never by child position.
export function sidebar(sections) {
  const body = sections.map((sec) =>
    `<div class="sb-group">\n` +
    `      <div class="sb-sec">${sec.letter}. ${sec.title}</div>\n` +
    sec.screens.map((sc) =>
      `      <a href="#${sc.anchor}" title="${sc.id} · ${sc.label}">` +
      `<span class="num"><span class="seq">[${sc.seq}]</span>${sc.id}</span>` +
      `<span class="lbl">${sc.label}</span></a>`
    ).join('\n') +
    `\n    </div>`
  ).join('\n    ');
  // The filter row ships `hidden` and the script unhides it: with scripts off the index is
  // still complete and every anchor still works, and there is no dead control promising a
  // search that cannot happen.
  return `<nav class="wf-sidebar">
    <div class="sb-head">
      <h2>product name</h2>
      <div class="sb-sub">[position] permanent id</div>
      <div class="sb-find" hidden>
        <input type="search" class="sb-input" autocomplete="off" spellcheck="false"
               placeholder="filter — id or name" aria-label="Filter the table of contents"
               title="Press / to focus · Enter opens the first match · Esc clears">
        <button type="button" class="sb-clear" aria-label="Clear the filter">&times;</button>
      </div>
      <div class="sb-count" hidden></div>
    </div>
    <div class="sb-list">
    ${body}
    </div>
  </nav>`;
}

// page({title, sidebarHtml, introHtml, sectionsHtml, styles}): the whole document.
// The viewport-toggle checkbox is the FIRST body element so board-template's CSS-only
// narrow⇄wide toggle keeps working (its rules reach frames via the sibling combinator);
// pair a `.view-toggle` label in your intro/header to flip it. The only script is a
// progressive-enhancement navigation aid over the TOC (no external resources): it
// highlights the entry of the frame you click or view, and filters the index as you
// type. Both act on the SIDEBAR only — every frame stays on the board, no content is
// created, and with JS off the board renders whole, the index lists everything and every
// anchor still works.
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
(function () {
  // Index filter. Hides TOC entries that do not match; the board itself is untouched, so
  // nothing a reviewer must see can be filtered out of existence.
  var box = document.querySelector('.wf-sidebar .sb-find');
  var list = document.querySelector('.wf-sidebar .sb-list');
  var count = document.querySelector('.wf-sidebar .sb-count');
  if (!box || !list || !count) return;
  var input = box.querySelector('.sb-input');
  var clear = box.querySelector('.sb-clear');
  if (!input || !clear) return;

  // 사업장 → ㅅㅇㅈ. Lets \`ㅅㅇㅈ\` find it, and lets the half-composed \`사업ㅈ\` an IME shows
  // between keystrokes find it too — without that the list empties on the way to every word.
  var CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  function initials(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      out += (c >= 0xac00 && c <= 0xd7a3) ? CHO.charAt(Math.floor((c - 0xac00) / 588)) : s.charAt(i);
    }
    return out;
  }
  function norm(s) { return String(s).toLowerCase().replace(/\s+/g, ' ').trim(); }

  // One haystack per entry: the section it sits in, its position, its permanent id, its label.
  // The section is in there so a section's own name or letter pulls up that whole cluster,
  // which is how somebody who knows the area but not the screen name looks for it.
  var groups = [], total = 0;
  Array.prototype.forEach.call(list.querySelectorAll('.sb-group'), function (g) {
    var sec = g.querySelector('.sb-sec');
    // firstChild, not textContent: the trailing \`.sb-n\` count would make every entry in a
    // 14-screen section a match for \`14\`.
    var secText = sec && sec.firstChild ? sec.firstChild.nodeValue || '' : '';
    var items = Array.prototype.map.call(g.querySelectorAll('a[href^="#"]'), function (a) {
      var num = a.querySelector('.num'), lbl = a.querySelector('.lbl');
      var hay = norm(secText + ' ' + (num ? num.textContent : '') + ' ' + (lbl ? lbl.textContent : ''));
      return { el: a, hay: hay, cho: initials(hay), hit: true };
    });
    total += items.length;
    // The section's screen count has to follow the filter. Left at 57 above five visible
    // entries it reads as "57 matches here", which is the one number on the screen a reader
    // has no way to check.
    var n = g.querySelector('.sb-sec .sb-n');
    groups.push({ el: g, items: items, hit: true, n: n, full: n ? n.textContent : '' });
  });
  if (!total) return;

  // Every token must be found, in any order, so \`사업장 목록\` narrows instead of failing.
  function mark(tokens, useCho) {
    var n = 0;
    var needles = useCho ? tokens.map(initials) : tokens;
    groups.forEach(function (g) {
      var any = false;
      var shown = 0;
      g.items.forEach(function (it) {
        var hay = useCho ? it.cho : it.hay, ok = true;
        for (var i = 0; i < needles.length; i++) {
          if (hay.indexOf(needles[i]) < 0) { ok = false; break; }
        }
        it.hit = ok;
        if (ok) { any = true; n++; shown++; }
      });
      g.hit = any;
      g.shown = shown;
    });
    return n;
  }
  function paint(filtering) {
    groups.forEach(function (g) {
      g.el.classList.toggle('is-off', !g.hit);
      g.items.forEach(function (it) { it.el.classList.toggle('is-off', !it.hit); });
      if (g.n) g.n.textContent = filtering ? String(g.shown) : g.full;
    });
  }

  function run() {
    var tokens = norm(input.value).split(' ').filter(Boolean);
    box.classList.toggle('has-q', tokens.length > 0);
    if (!tokens.length) {
      groups.forEach(function (g) { g.hit = true; g.items.forEach(function (it) { it.hit = true; }); });
      paint(false);
      count.hidden = true;
      return;
    }
    // Initials are the FALLBACK, never the first pass: matching them eagerly would let
    // \`점검\` drag in 정기 · 증거 · 직급, and a filter that answers with noise is not one.
    var n = mark(tokens, false), mode = '';
    if (n === 0 && tokens.join('').length >= 2) {
      n = mark(tokens, true);
      if (n) mode = ' · ㄱㄴㄷ';
    }
    paint(true);
    count.hidden = false;
    count.className = 'sb-count' + (n ? '' : ' none');
    count.textContent = n ? n + ' / ' + total + mode : 'no match';
    list.scrollTop = 0;
  }

  box.hidden = false;
  input.addEventListener('input', run);
  input.addEventListener('keydown', function (e) {
    if (e.isComposing || e.keyCode === 229) return;   // the IME owns Enter while composing
    if (e.key === 'Enter') {
      var first = list.querySelector('a[href^="#"]:not(.is-off)');
      if (first) first.click();
    } else if (e.key === 'Escape') {
      input.value = '';
      run();
    }
  });
  clear.addEventListener('click', function () { input.value = ''; run(); input.focus(); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    var el = document.activeElement;
    if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    e.preventDefault();
    input.focus();
    input.select();
  });
})();
</script>
</body>
</html>`;
}
