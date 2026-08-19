// Frame chrome + document assembly — defined ONCE, rendered for every screen. A
// screen file carries only its bespoke body (composed from the pattern's components)
// plus a little metadata; frame() wraps it in the right device shell. This is the same
// greybox vocabulary the single-file board-template.html teaches, split into a build.
//
// **Nothing here knows the product.** The browser bar comes from whichever pattern the
// board declares, and the role matrix from the board's own `src/roles.mjs`; both are
// handed in by `makePartials`, so this file builds any board rather than one board.
// A board that declares no roles passes `roles: null` and the strip is simply not drawn.

// The board contract this kit writes. Stamped into every built board so a later session can
// tell what a board was built against without inferring it from the markup, and migrate it when
// the skill has moved on. Bump it ONLY when the contract changes in a way that needs a
// migration — a new class, a new note prefix, a restyle do not.
//
//   1  original: frame numbers derived from manifest position; rows scrolled sideways
//   2  permanent ids from the file name + bracketed board position; rows wrap, no sideways scroll
//   3  the kit lives in the skill and the board holds only its own content: a declared pattern
//      supplies the components, the shells and the styles, and the board's `tools/` is gone
import { textFor } from './text.mjs';

export const BOARD_CONTRACT = 4;

/**
 * Bind the frame renderers to one board's pattern and role matrix.
 *
 * @param components the pattern's component module — `browserbar` is the one primitive
 *   the device shell itself draws, so it is the only thing read out of it here
 * @param roles the board's `src/roles.mjs`, or null where the board settles no roles
 * @returns `{ frame, sidebar, page }`
 */
export function makePartials({ components, roles = null, lang = 'en' }) {
  const { browserbar } = components;
  const ROLES = roles?.ROLES ?? {};
  const VERDICTS = roles?.VERDICTS ?? {};
  const rolesOf = roles?.rolesOf ?? (() => null);

  // frame(screen, id, seq, file): wraps one device frame. `device` is 'phone' (default),
  // 'tablet', or 'desktop'; `variant` is 'narrow' or 'wide' for a responsive pair.
  // The body (composed from components — statusbar/appbar/tabbar for touch,
  // shell/sidebar/main for desktop) IS the screen content; frame() only adds the
  // device shell, the desktop browser bar + fold, the label, and the notes.
  //
  // `id` (A-20) is the screen's PERMANENT number, from its file name — what everyone
  // addresses it by. `seq` (02) is its position in the board's visual order this build.
  // `anchor` is supplied by the build, which owns uniqueness across a responsive pair.
  function frame(s, id, seq, file = '', anchor = `s-${id.toLowerCase()}`) {
    const arrow = s.arrowBefore ? `\n    ${s.arrowBefore}\n` : '';
    // A frame that is not being built now says so THREE times — a band over the drawing, a chip
    // in the label, a chip opening the notes — because each of the three is the only one a given
    // reader gets. The section title says it once, at the top of thirty-five frames, and a PNG or
    // a PDF page or a link into the board arrives without it.
    const ph = s.phase && s.phase.tag ? s.phase : null;
    const band = ph
      ? `\n      <div class="phase-band"><b>${ph.tag}</b>${ph.why ? ` · ${ph.why}` : ''}</div>`
      : '';
    // What has to be BOUGHT before this frame is reachable. It is drawn as one chip beside the id
    // and NOT as a band: the screen exists and is drawn: what is conditional is reaching it. A band
    // would say the same thing `phase` says — that the drawing is not there — and the two states
    // are different. Nothing goes inside the device either; the locked state is P-11's frame, and a
    // badge inside a normal frame leaves the implementer guessing whether it is screen content.
    // The chip's WORD is not its meaning. 「Connected」 beside an id tells a reader who already
    // knows the catalogue and nobody else, and a frame reaches most of its readers alone — a PNG,
    // one PDF page, a link — where a `title` attribute does not exist. So the notes open with the
    // chip, the exact key an implementer needs, and the sentence saying what buying it opens. The
    // phase band does the same job for its own axis, above the device.
    const ft = s.feature && s.feature.tag ? s.feature : null;
    const noteBody = s.notes
      ? (ph ? `<span class="ph-tag">${ph.tag}</span>` : '')
        + (ft ? `<span class="ft-tag">${ft.tag}</span><em class="ft-why">${ft.key}` +
          `${ft.why ? ` — ${ft.why}` : ''}</em>` : '') + s.notes
      : s.notes;
    const notes = noteBody ? `\n      <div class="frame-notes">\n        ${noteBody}\n      </div>` : '';
    // Who reaches this frame. The cluster decides it and the frame overrides only where it
    // departs — an override is drawn emphasised, because a departure is the thing worth reading.
    const verdicts = rolesOf(id.split('-')[0], s.roles);
    const roleStrip = verdicts
      ? `\n      <div class="frame-roles">${Object.entries(ROLES)
        .filter(([k]) => verdicts[k])
        .map(([k, label]) => `<span class="fr${s.roles && s.roles[k] ? ' own' : ''}">${label}`
          + `<b>${VERDICTS[verdicts[k]]}</b></span>`).join('')}</div>`
      : '';
    const device = s.device || 'phone';
    // phone portrait is the bare `.frame`; every other device/variant needs its class
    const classes = ['frame'];
    if (!(device === 'phone' && !s.variant)) classes.push(device);
    if (s.variant) classes.push(s.variant);
    if (ph) classes.push('deferred');
    const isDesktop = device === 'desktop';
    // What kind of window a desktop frame sits in. Three answers and the kit only rules out the
    // third: `browser` (the default — a page loaded at a URL), `app` (an installed program's own
    // window, which has a title and no address), `none` (no window at all — a bare desktop, an
    // installer, a screen that IS the machine). The pattern draws the first two, because a
    // titlebar is a drawing and the kit does not draw.
    //
    // **It is an axis rather than a prefix on the URL.** A board that had to say `app:설치본` in
    // the address field got its three frames drawn correctly and made every reader of that file
    // parse a string to find out what kind of window it was — and no gate could see it, because
    // a URL is free text.
    const chrome = s.chrome ?? 'browser';
    if (!['browser', 'app', 'none'].includes(chrome)) {
      throw new Error(`${id}: chrome은 browser · app · none 중 하나입니다 (받은 값: ${chrome})`);
    }
    const browser = isDesktop && chrome !== 'none'
      ? `${browserbar(s.url || 'app.example.com', { chrome, title: s.appTitle })}\n        `
      : '';
    const fold = isDesktop ? `\n          <div class="fold"><span>fold · ${s.fold || 'smallest window'}</span></div>` : '';
    // `[02]A-20` — the visual position first, so a reader scanning the board can see where they
    // are, then the permanent id, which is what they were actually given. The file name is NOT
    // shown: the id IS the number in the file name, so `A-20` already locates `a-20-*.mjs`.
    const label =
      `<span class="fseq">[${seq}]</span><span class="fnum">${id}</span>` +
      `${ph ? `<span class="fph">${ph.tag}</span>` : ''}` +
      `${ft ? `<span class="fft" title="${ft.key} — ${ft.why}">${ft.tag}</span>` : ''}` +
      `${s.route ? s.route + ' — ' : ''}${s.screen}${s.state ? ' — ' + s.state : ''}`;
    return `${arrow}    <article class="${classes.join(' ')}" id="${anchor}">${band}
      <div class="device">
        ${browser}<div class="screen">
          ${s.body}${fold}
        </div>
      </div>
      <div class="frame-label">${label}</div>${roleStrip}${notes}
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
  /**
   * @param jumps the places outside the frame list a reader goes to — the opening overview and
   *   the reading contract. They ride the fixed HEAD rather than the scrolling list so they are
   *   reachable from anywhere in a table of contents hundreds of entries long, and so the filter
   *   never hides them: they are not screens and nothing a reader types should make them vanish.
   */
  function sidebar(sections, { boardName = 'board', jumps = [] } = {}) {
    const text = textFor(lang);
    // Each section carries its screen count and the top carries the board's, because a reader
    // scrolling a table of contents this long has no other way to tell whether the section they
    // are in is four screens or forty — and "how big is this board" is the first question anyone
    // asks of it.
    const total = sections.reduce((n, sec) => n + sec.screens.length, 0);
    const body = sections.map((sec) =>
      `<div class="sb-group">\n` +
      `      <div class="sb-sec">${sec.letter}. ${sec.title}` +
      `${sec.phaseTag ? `<span class="sb-ph">${sec.phaseTag}</span>` : ''}` +
      `${sec.featureTag ? `<span class="sb-ft">${sec.featureTag}</span>` : ''}` +
      `<span class="sb-n">${sec.screens.length}</span></div>\n` +
      sec.screens.map((sc) =>
        `      <a href="#${sc.anchor}" title="${sc.id} · ${sc.label}">` +
        `<span class="num"><span class="seq">[${sc.seq}]</span>${sc.id}</span>` +
        `<span class="lbl">${sc.phaseTag ? `<span class="sb-ph">${sc.phaseTag}</span>` : ''}`
        + `${sc.featureTag ? `<span class="sb-ft">${sc.featureTag}</span>` : ''}${sc.label}</span></a>`
      ).join('\n') +
      `\n    </div>`
    ).join('\n    ');
    // The filter row ships `hidden` and the scroll-spy script unhides it: with scripts off the
    // index is still complete and every anchor still works, and there is no dead control
    // promising a search that cannot happen.
    return `<nav class="wf-sidebar">
    <div class="sb-head">
      <h2>${boardName}<span class="sb-total">${total}</span></h2>
      <div class="sb-sub">${text.indexLegend}</div>
      <div class="sb-find" hidden>
        <input type="search" class="sb-input" autocomplete="off" spellcheck="false"
               placeholder="${text.filterPlaceholder}" aria-label="${text.filterLabel}"
               title="${text.filterHint}">
        <button type="button" class="sb-clear" aria-label="${text.filterClear}">&times;</button>
      </div>
      <div class="sb-count" hidden></div>
    </div>
    <div class="sb-list">
${jumps.length ? `    <div class="sb-group sb-fixed">
${jumps.map((j) => `      <a href="#${j.href}"><span class="num">${j.tag}</span>` +
      `<span class="lbl">${j.label}</span></a>`).join('\n')}
    </div>
` : ''}    ${body}
    </div>
  </nav>`;
  }

  // page({title, sidebarHtml, headerHtml, sectionsHtml, readmeHtml, styles}): the whole document.
  // The viewport-toggle checkbox is the FIRST body element so board-template's CSS-only
  // narrow⇄wide toggle keeps working (its rules reach frames via the sibling combinator);
  // pair a `.view-toggle` label in your intro/header to flip it. The only script is a
  // progressive-enhancement navigation aid over the TOC (no external resources): it
  // highlights the entry of the frame you click or view, and filters the index as you
  // type. Both act on the SIDEBAR only — every frame stays on the board, no content is
  // created, and with JS off the board renders whole, the index lists everything and every
  // anchor still works.
  // `readmeHtml` is the last thing in the board, after every frame. It is read once, before
  // implementing, and at the top it would stand between every later reader and the frames they
  // came for — on a board hundreds of frames long that is a toll paid on every visit. The header
  // links to it, so «reachable» does not depend on scrolling to the end.
  function page({ title, sidebarHtml, headerHtml, overviewHtml = '', sectionsHtml, readmeHtml, styles }) {
    return `<!doctype html>
<html lang="${textFor(lang).htmlLang}">
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
<input type="checkbox" id="viewport" class="view-input" aria-label="${textFor(lang).viewportLabel}">
${sidebarHtml}
<div class="wf-board">
${headerHtml}
${overviewHtml}
${sectionsHtml}
${readmeHtml}
</div>
<script>
(function () {
  var links = document.querySelectorAll('.wf-sidebar .sb-list .sb-group:not(.sb-fixed) a[href^="#"]');
  var frames = document.querySelectorAll('.frame[id]');
  var byId = {};
  links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });

  // Marking the index entry. The scroll argument is false while the reader is scrolling the
  // the index under them as they read is the one thing this aid must not do — and true when they
  // and true when they picked something, where that entry has to be visible to have been picked.
  function setOn(id, scroll) {
    links.forEach(function (a) { a.classList.remove('on'); });
    var a = byId[id];
    if (!a) return;
    a.classList.add('on');
    if (scroll && a.scrollIntoView) a.scrollIntoView({ block: 'nearest' });
  }

  // The outline on the picked frame. It used to be the :target selector alone, which only ever
  // fires from the address bar — so the board answered a click in the index and stayed silent on
  // a click on the frame itself, and the reader could not tell which of two adjacent states.
  function pick(id) {
    frames.forEach(function (f) { f.classList.remove('is-picked'); });
    var f = document.getElementById(id);
    if (f && f.classList.contains('frame')) f.classList.add('is-picked');
    setOn(id, true);
  }

  var io = new IntersectionObserver(function (entries) {
    var best = null, r = 0;
    entries.forEach(function (e) { if (e.intersectionRatio > r) { r = e.intersectionRatio; best = e.target; } });
    if (best && r > 0) setOn(best.id, false);
  }, { threshold: [0.2, 0.5, 0.8], rootMargin: '-8% 0px -55% 0px' });
  frames.forEach(function (f) { io.observe(f); });

  links.forEach(function (a) { a.addEventListener('click', function () { pick(a.getAttribute('href').slice(1)); }); });

  // A click anywhere on a frame picks it. Anchors inside a frame are left alone — a board draws
  // none today, and a frame that gains one must keep it working.
  frames.forEach(function (f) {
    f.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a')) return;
      pick(f.id);
    });
  });

  // A link into the board picks its frame too, so arriving by URL and arriving by click leave
  // the board in the same state.
  if (location.hash.length > 1) pick(decodeURIComponent(location.hash.slice(1)));
  window.addEventListener('hashchange', function () {
    if (location.hash.length > 1) pick(decodeURIComponent(location.hash.slice(1)));
  });
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
  Array.prototype.forEach.call(list.querySelectorAll('.sb-group:not(.sb-fixed)'), function (g) {
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

  return { frame, sidebar, page };
}
