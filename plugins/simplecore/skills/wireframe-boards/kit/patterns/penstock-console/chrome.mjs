// penstock-console — the shell factory. A board hands this its own words once, in `src/chrome.mjs`,
// and receives the chrome components bound to them: the title bar with its brand, the navigator
// with its tree, the ask bar with its project chip, the inspector with its sample activity, the
// application shell with its default status bar, the command palette with its query.
//
// The pure primitives live in `components.mjs`; nothing here draws a shape of its own. What lives
// here is exactly the set of components that used to carry one product's name and tree inside the
// pattern — moved out so the second product drawn this way brings its own.
import { bell, appStatus } from './components.mjs';

const cnt = (n) => `<span class="badge cnt">${n}</span>`;

/**
 * makeChrome(options) → the bound chrome.
 *
 * @param brand     the product's mark text in the title bar and the entry-surface mark
 * @param nav       the navigator tree — `[{ group, items: [name, …] }]`; `navPane(active)` names an item
 * @param project   the project chip the ask bar shows when a screen names none
 * @param lang      the language chip
 * @param palette   `{ label, ask, query }` — the palette control's label on the console bar, its
 *                  prompt on the ask bar, and the query the open palette is drawn holding
 * @param ask       `{ back, history }` — the ask bar's two ways out: back to the console, past questions
 * @param status    the status bar a screen gets when it passes none — `{ left: [{ t, alert }], right }`
 * @param activity  the sample events the inspector's activity pane draws when a frame passes none —
 *                  `[{ when, text }]`
 */
export function makeChrome({
  brand = 'PRODUCT',
  nav = [],
  project = '',
  lang = '한국어',
  palette = {},
  ask = {},
  status = {},
  activity = [],
} = {}) {
  const paletteLabel = palette.label ?? '명령 팔레트';
  const paletteAsk = palette.ask ?? '무엇이든 물어보세요';
  const paletteQuery = palette.query ?? '명령';
  const askBack = ask.back ?? '콘솔';
  const askHistory = ask.history ?? '지난 질문';
  const statusDefault = {
    left: status.left ?? [{ t: '<span class="dot"></span>연결됨' }],
    right: status.right ?? '갱신 방금',
  };

  /**
   * navPane(active, badges): the left navigator. `badges` maps an item name to a count.
   *
   * **A group heading opens and shuts, and its mark sits at the trailing edge.** A tree nobody has
   * touched opens with every group shut, so those headings are the whole navigator until somebody
   * presses one — a heading drawn as a caption with no mark would be a word where every row beneath
   * it has a picture. The mark goes at the trailing edge rather than in front: the rows below start
   * with an icon, and a caret ahead of the heading's own icon puts two glyphs where the eye looks
   * for one, so the heading stops reading as a word.
   *
   * **The board draws them all open anyway**, and that is not a disagreement with the product: what
   * a frame's navigator is FOR here is saying where the screen lives, and a board of shut trees says
   * it nowhere. The shut state belongs to the product's first minute, not to the contract.
   *
   * The rows of a group sit in a block of their own, and a guide runs down it from under the
   * heading's mark. A shut group has no block and therefore no guide — a line under a heading with
   * nothing beneath it claims rows that are not on screen.
   */
  function navPane(active, badges = {}) {
    const rows = nav
      .map(
        ({ group, items }) =>
          `<div class="nav-group"><span class="ic"></span><span>${group}</span><span class="grow"></span><span class="tw">⌄</span></div>` +
          `<div class="nav-rows">` +
          items
            .map(
              (it) =>
                `<div class="nav-item${it === active ? ' active' : ''}"><span class="ic"></span>${it}${badges[it] != null ? cnt(badges[it]) : ''}</div>`
            )
            .join('') +
          `</div>`
      )
      .join('');
    return `<div class="pane nav"><div class="pane-head">탐색<span class="grow"></span><span class="tb-btn">◧</span></div>
      <div class="pane-body tight scrolls"><div class="nav-search">검색</div>${rows}</div></div>`;
  }

  /**
   * titlebar(crumbs, tb): brand, breadcrumb, command palette, pane toggles, account.
   *
   * **Whether there is a way out is decided here; where it is drawn is not.** The control itself
   * goes against the screen's own title, at the head of the work pane's control strip — see
   * `appShell`, which is the one place holding both this bar and that strip. In the trail it read as
   * one more piece of navigation furniture: the eye files the whole strip as "where am I" and skips
   * it, which is how a control on every screen can still leave people with no way out they notice.
   *
   * It applies BY DEFAULT on any screen sitting under something more than its project — one press
   * back to the layer it came out of, which the trail beside it can only give by being read first.
   *
   * **The default draws it, and that direction is deliberate.** A frame drawn later and saying
   * nothing gets a way out. Forgetting then costs a control somebody did not need, which is on the
   * frame for anyone to see and delete; the other way round, forgetting costs a screen nobody can
   * leave, and an absence draws nothing and reviews clean. Tilt a default towards the failure that
   * makes a noise.
   *
   * `back: false` is for a screen that never left anything: a list down one side and what a chosen
   * row holds down the other, where the rows are still there and picking another is one press.
   */
  function titlebar(crumbs, tb = {}) {
    const l = tb.left === false ? '' : ' on';
    const r = tb.right === false ? '' : ' on';
    // Everything before the bold piece is a layer above. Counted that way round because a folder
    // path is one place written with slashes — `기술기준 / 08 작업안전` is where the screen IS, not two
    // layers it came through, and splitting on the separator first makes every folder look deep.
    const layers = crumbs.split('<b>')[0].split('/').filter((piece) => piece.trim() !== '').length;
    // Carried as a mark rather than as a control, because the bar is composed before the panes are
    // and `appShell` is where the two meet. Stripped again there, so it never reaches the board.
    const back = (tb.back ?? layers > 1) ? ' data-back' : '';
    return `<div class="titlebar"${back}>
      <div class="tb-l"><span class="mark"></span><span class="brand">${brand}</span><span class="vsep"></span><span class="crumbs">${crumbs}</span></div>
      <div class="cmdk"><span>${paletteLabel}</span><span>⌘K</span></div>
      <div class="tb-r"><span class="tb-btn${l}">◧</span><span class="tb-btn${r}">◨</span>${bell(tb.unread)}<span class="tb-chip">${lang} ▾</span><span class="avatar"></span></div>
    </div>`;
  }

  /**
   * The ask surface uses the same bar with the navigator stripped — asking needs no tree.
   * Stripped is not the same as trapped: the project chip goes back to the project list and the
   * back chip goes to the console, so the two ways out are always on screen. `console: false`
   * draws the bar a reader sees who has no console to go to.
   */
  function askTitlebar(projectName = project, { console: toConsole = true, unread = 0 } = {}) {
    const back = toConsole ? `<span class="tb-chip">${askBack}</span>` : '';
    return `<div class="titlebar">
      <div class="tb-l"><span class="mark"></span><span class="brand">${brand}</span><span class="vsep"></span><span class="tb-chip">${projectName} ▾</span></div>
      <div class="cmdk"><span>${paletteAsk}</span><span>⌘K</span></div>
      <div class="tb-r">${back}<span class="tb-chip">${askHistory}</span>${bell(unread)}<span class="tb-chip">${lang} ▾</span><span class="avatar"></span></div>
    </div>`;
  }

  function activityPane({ events, collapsed = false, scoped = false } = {}) {
    const sc = scoped ? '<span class="chip">선택 항목만</span>' : '';
    const head =
      `<div class="activity-head"><span class="activity-title">활동</span>${sc}<span class="grow"></span>` +
      (collapsed ? '<span class="tb-btn">▸</span>' : '<span class="tb-btn">▾</span>') +
      '</div>';
    if (collapsed) return `<div class="activity collapsed">${head}</div>`;
    const rows =
      events ||
      activity
        .map(({ when, text }) => `<div class="ev"><span class="when">${when}</span><span class="txt">${text}</span></div>`)
        .join('');
    return `<div class="activity">${head}<div class="activity-body">${rows}</div></div>`;
  }

  /**
   * The inspector: a tab row for how the selected record is shown, and an activity pane below
   * for what has happened. The two are different axes, so activity is never a tab.
   */
  const inspPane = ({ tabs: tabRow, body, activity: events, collapsed = false, lg = false }) =>
    `<div class="pane insp${lg ? ' lg' : ''}">${tabRow ? `<div class="pane-head tabbed">${tabRow}</div>` : ''}` +
    `<div class="pane-body scrolls">${body}</div>${activityPane({ events, collapsed })}</div>`;

  /** appShell: titlebar + work area + status bar. `panes` is already-composed pane HTML.
   *  `bar` is optional — setup and activation windows carry no application chrome above the
   *  work area, so they pass panes alone.
   *
   *  It is also where the way out of the screen lands. `titlebar` decides whether there is one and
   *  marks the bar; this is the only place that holds the bar and the panes at once, so this is where
   *  the mark becomes a control at the head of the work pane's strip, against the title.
   *
   *  A screen that wants one and has no strip to put it in stops the build rather than losing it.
   *  A frame drawn with no way out looks finished — that is the entire failure, and it may not be
   *  reachable by forgetting a toolbar. */
  const appShell = ({ bar = '', panes, status: s }) => {
    const wantsBack = bar.includes('<div class="titlebar" data-back>');
    const strip = bar.replace('<div class="titlebar" data-back>', '<div class="titlebar">');
    let work = panes;
    if (wantsBack) {
      const at = panes.indexOf('<div class="pane work"><div class="toolbar">');
      if (at === -1) {
        throw new Error(
          'appShell: this screen sits under something and owes a way out of it, and its work pane ' +
            'has no control strip to draw one in — give workPane a `toolbar`, or say `back: false` ' +
            'on the titlebar if the layer above never left the screen'
        );
      }
      work =
        panes.slice(0, at) +
        '<div class="pane work"><div class="toolbar"><span class="tb-back">‹</span>' +
        panes.slice(at + '<div class="pane work"><div class="toolbar">'.length);
    }
    return strip + `<div class="ws">${work}</div>` + appStatus(s || statusDefault);
  };

  const cmdPalette = (rows) =>
    `<div class="dim"></div><div class="palette"><div class="pq">${paletteQuery}</div>` +
    rows
      .map((r, i) => `<div class="pr${i === 0 ? ' on' : ''}">${r.t}<span class="pk">${r.k || ''}</span></div>`)
      .join('') +
    `</div>`;

  // Entry surfaces (signing in, choosing a project, activating) happen outside the shell: one
  // centred column carrying the product's mark.
  const cmark = () => `<div class="cmark"><span class="mark"></span><span class="brand">${brand}</span></div>`;

  return { navPane, titlebar, askTitlebar, activityPane, inspPane, appShell, cmdPalette, cmark };
}
