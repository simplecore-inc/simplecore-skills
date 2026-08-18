// Content and chrome components — the reusable primitives a screen body is composed
// FROM. Each maps to a class in styles.css (the same greybox vocabulary the single-
// file board-template.html teaches), so a screen file calls these instead of hand-
// writing HTML and the vocabulary stays consistent. Every component registers an
// example in CATALOG (bottom); catalog.mjs renders it into a storybook. Add a
// component here → it appears in the catalog.

const cls = (base, variant) => (variant ? `${base} ${variant}` : base);

// ── content primitives ─────────────────────────────────────────────────────
export const tTitle = (t) => `<div class="t-title">${t}</div>`;
export const tSub = (t) => `<div class="t-sub">${t}</div>`;
export const tBody = (t) => `<div class="t-body">${t}</div>`;
export const divider = () => `<hr class="divider">`;
export const bar = (w = 'w60', light = false) => `<div class="bar${light ? ' light' : ''} ${w}"></div>`;
export const imgPh = (extra = '') => `<div class="img-ph${extra ? ' ' + extra : ''}"></div>`;
/**
 * A picture the screen actually shows, with the name of what it is.
 *
 * <p>`imgPh` is an unlabelled grey box and takes a CSS class, not a caption — right for a row
 * thumbnail, wrong wherever the picture IS the content. A pictogram named in text and never drawn
 * cannot be judged: the reader cannot tell whether the asset exists, what it depicts, or whether
 * the one they are looking for is the one on the screen.
 *
 * @param size sm (a thumbnail beside a row) · md (a preview in a panel) · lg (the picture is the
 *   screen — a literacy-support screen leads with it)
 */
export const mediaPh = ({ label, size = 'md', note = '' }) =>
  `<div class="media-ph s-${size}"><div class="mp-box"></div>` +
  `<div class="mp-label">${label}</div>` +
  `${note ? `<div class="mp-note">${note}</div>` : ''}</div>`;

export const qrPh = (label = 'QR') => `<div class="qr-ph"><span>${label}</span></div>`;
export const btn = (text, variant = '') => `<div class="${cls('btn', variant)}">${text}</div>`; // ''·primary·ghost·danger·off(권한 없음)
export const chip = (text, active = false) => `<span class="chip${active ? ' active' : ''}">${text}</span>`;
export const badge = (text, variant = '') => `<span class="${cls('badge', variant)}">${text}</span>`; // ''·outline
/**
 * The chip filter over a list. It sits between the list tabs and the list, and NOTHING may come
 * between the three: a tile row, an explanation card or a message band pushed in there separates
 * the control from what it controls, and the reader stops reading the three as one act.
 *
 * `note` is the one sentence that depends on WHICH chip is chosen — 「연동 방식에 따라 준비 사항이
 * 다릅니다」. It rides the right end of the same row, because a line of its own below the chips is
 * the very block this arrangement forbids. Keep it to a clause.
 *
 * <p>**The test is one question: does this sentence change when the chip changes?** If it does not
 * — a note on where a field's values come from, on what the tiles counted — it is a page fact and
 * belongs above the tabs, beside the help card and the warning band. That question is answered by
 * reading the sentence, so it is not one the gate can take: it sees a block standing between the
 * chip row and the list, and stops there.
 */
export const chips = (items, { note = '' } = {}) =>
  `<div class="chips">${items.join('')}` +
  `${note ? `<span class="chips-note">${note}</span>` : ''}</div>`;
/** A row of buttons. A btn is a block, so two of them stack unless a row holds them. */
export const btnRow = (children) => `<div class="btn-row">${children}</div>`;
export const badges = (items) => `<div class="badges">${items.join('')}</div>`;

export function field({ label, value, hint, select = false }) {
  const input = value != null ? `<span class="input">${value}${select ? ' <span>▾</span>' : ''}</span>` : `<span class="input">입력</span>`;
  return `<div class="field"><span class="label">${label}</span>${input}${hint ? `<span class="t-sub">${hint}</span>` : ''}</div>`;
}
/**
 * A QR and what it is for, in the one arrangement they take.
 *
 * <p>A QR is a square, and a square dropped into a column of prose leaves the width beside it
 * empty — 150px of code and 400px of nothing, with the sentence that says what to scan pushed
 * under it where it reads as a caption for the whole page. So the code takes the left, the line
 * naming it sits **under the code** where the two are read as one object, and everything else —
 * what the scan opens, who it identifies, what expires — fills the region to its right.
 *
 * <p>On paper this is the difference between a credential that fits its card and one that runs off
 * the page: the right-hand region is where the fields go, not below the code.
 *
 * @param caption the one line saying what scanning does, drawn under the code
 * @param children what the code is about, in the region beside it
 * @param size `sm` where the paper is narrow — a poster column, a card
 */
export const qrBlock = ({ label = 'QR', caption = '', children = '', size = '' }) =>
  `<div class="qrblock${size ? ' ' + size : ''}">` +
  `<div class="qb-code">${qrPh(label)}` +
  `${caption ? `<div class="qb-cap">${caption}</div>` : ''}</div>` +
  `${children ? `<div class="qb-body">${children}</div>` : ''}</div>`;

/**
 * A bordered box that stacks what is put in it.
 *
 * <p><b>`pad: 'lg'` is for a box that is the page's whole content rather than one card among
 * several</b> — an empty state, a lock notice, a read-only banner. Frames used to reach for
 * `<div class="table" style="padding:26px">` to get one, which borrows a table's border, leaves the
 * blocks inside it touching, and puts a measurement in a frame where the stylesheet cannot move it.
 */
export function card({ sub, body, pad = '' }) {
  return `<div class="card${pad ? ` p-${pad}` : ''}">${sub ? tSub(sub) : ''}${body}</div>`;
}
export function listCard({ thumb = true, lines, trail }) {
  return `<div class="list-card">${thumb ? imgPh('thumb') : ''}<div class="lines">${lines}</div>${trail || ''}</div>`;
}
/**
 * A row of things side by side, and a block with space above it.
 *
 * <p>**These exist so a screen never writes a raw `<div>`.** A classless block inherits the
 * BOARD's base size rather than its neighbours', so it draws larger than everything around it
 * and nothing in the source says why — that is how one card's value line ended up at 16px inside
 * a panel written at 12.5px. `classlessGate` refuses them now, and these two are what a screen
 * reaches for instead.
 *
 * <p>The options are a CLOSED vocabulary on purpose. Taking a pixel value would make these an
 * escape hatch for arbitrary styling, which is the thing the greybox rules exist to prevent.
 *
 * @param gap sm · md · lg
 * @param align center · top · baseline
 */
export const inlineRow = (children, { gap = 'md', align = 'center', wrap = false } = {}) =>
  `<div class="lrow g-${gap} a-${align}${wrap ? ' wrap' : ''}">${children}</div>`;

/** @param top sm · md · lg — how much air sits above the block. */
export const stack = (children, { top = 'md' } = {}) =>
  `<div class="lstack t-${top}">${children}</div>`;

export const grid = (n, children) => `<div class="grid-${n}">${children.join('')}</div>`;

// table({head:['작업','담당'], rows:[[...], ...]}). Cells are raw HTML; size with
// classes on the cell string (w2/fix/right) by wrapping: `<span class="td fix">…</span>`
// is produced for you when a cell is a plain string; pass pre-classed cells as-is.
/**
 * The column template, read out of the header's own width classes.
 *
 * <p>**A table is ONE grid, not a stack of independent rows.** Laid out row by row — which is
 * what flexbox does — a column sizes itself to whatever that row happens to hold, so a narrow
 * badge in the last cell of one row widens every cell before it and that row alone slides out of
 * line. It is invisible until two rows are compared, and it was true of 53 tables on this board.
 *
 * <p>`fix` keeps its 110px floor and grows to the widest cell IN THAT COLUMN, across every row.
 */
const columnTemplate = (head) => head.map((h) => {
  const cls = /class="([^"]*)"/.exec(h)?.[1] ?? '';
  if (/\bw2\b/.test(cls)) return '2fr';
  if (/\bfix\b/.test(cls)) return 'minmax(110px, max-content)';
  if (/\btight\b/.test(cls)) return 'max-content';
  return '1fr';
}).join(' ');

export function table({ head, rows }) {
  const th = `<div class="trow thead">${head.map((h) => (h.startsWith('<span') ? h : `<span class="td">${h}</span>`)).join('')}</div>`;
  // A row given as a string is emitted verbatim, which is how groupRow() puts a heading between
  // bands of rows without the table having to know what it groups by.
  const body = rows.map((r) => (typeof r === 'string' ? r
    : `<div class="trow">${r.map((c) => (c.startsWith('<span') ? c : `<span class="td">${c}</span>`)).join('')}</div>`)).join('');
  return `<div class="table" style="--tc:${columnTemplate(head)}">${th}${body}</div>`;
}
/** A heading band inside a table: the thing the rows beneath it all belong to. */
export const groupRow = (label) => `<div class="trow tgroup"><span class="td">${label}</span></div>`;
export const pagination = (pages, of, rows = 0) =>
  `<div class="pagination">` +
  (rows ? `<span class="rows">행 <span class="input sel">${rows}<span class="car">▼</span></span></span>` : '') +
  `${pages.map((p, i) => `<span class="pg${i === 0 ? ' active' : ''}">${p}</span>`).join('')}` +
  `${of ? `<span>/ ${of}</span>` : ''}</div>`;

// ── touch chrome (phone / tablet) ───────────────────────────────────────────
export const statusbar = () => `<div class="statusbar"><span>9:41</span><span>▮▮ ⏻</span></div>`;
export const appbar = ({ back = false, title, trail }) => `<div class="appbar">${back ? '<span class="back">←</span> ' : ''}${title}${trail ? `<span class="trail">${trail}</span>` : ''}</div>`;
export const bodyCol = (children) => `<div class="body">${children}</div>`;
export const cta = (children) => `<div class="cta">${children}</div>`;
// A tab may carry an unread count. It is said in one place per width — the phone's tab bar,
// the wide screen's navigation column — so two badges cannot disagree about the same set.
export const tabbar = (tabs) => `<div class="tabbar">${tabs.map((t) => `<div class="tab${t.active ? ' active' : ''}"><div class="ic"></div>${t.label}${t.unread ? `<span class="dot">${t.unread}</span>` : ''}</div>`).join('')}</div>`;

/**
 * Where a worker's work is being kept, and how much of it the server has not seen yet.
 *
 * <p>A field app signs and submits while offline, and the record it made looks finished either
 * way — so the screen has to say which it is at all times rather than only when something fails.
 * A worker who cannot tell the two apart has no reason to stay in range long enough to sync,
 * and a legally required signature sits on one handset until the battery dies.
 *
 * @param queued how many records are waiting to reach the server
 * @param offline whether the handset currently has no connection
 */
// The strip a worker reads to tell a signature the server has from one only their phone has —
// which is the whole reason it is always there. It is also the one line on the screen that
// nobody translated: a frame whose body is entirely Tiếng Việt drew a Korean bar above it and
// a Korean tab row below, so the two states this bar distinguishes were unreadable to the person
// they exist for. `lang` carries the app's language, and the shell passes its own down.
const OFFBAR_TEXT = {
  ko: { on: '온라인 · 서버 저장', off: '오프라인 · 이 기기에 저장', q: (n) => `동기화 대기 ${n}건` },
  vi: { on: 'Trực tuyến · đã lưu máy chủ', off: 'Ngoại tuyến · lưu trong máy', q: (n) => `Chờ gửi ${n}` },
  en: { on: 'Online · saved on server', off: 'Offline · saved on device', q: (n) => `${n} waiting to send` },
  km: { on: 'អនឡាញ · រក្សាទុកលើម៉ាស៊ីនមេ', off: 'ក្រៅបណ្ដាញ · រក្សាទុកក្នុងឧបករណ៍', q: (n) => `រង់ចាំផ្ញើ ${n}` },
};

export const offlineBar = ({ queued = 0, offline = false, lang = 'ko' }) => {
  const t = OFFBAR_TEXT[lang] ?? OFFBAR_TEXT.ko;
  return `<div class="offbar${offline ? ' off' : ''}">` +
    `<span class="dot${offline ? ' warn' : ''}"></span>` +
    `<span>${offline ? t.off : t.on}</span>` +
    `<span class="spacer"></span>` +
    `<span class="qn">${t.q(queued)}</span></div>`;
};

// ── desktop chrome ──────────────────────────────────────────────────────────
//
// The console window is three layers: the bar across the top picks an AREA, the column on the
// left holds that area's own menu, and the strip along the bottom carries what keeps running
// while the reader works. Nothing else is window-level chrome — there is no breadcrumb and no
// global search, because a screen is named by its tab, its menu entry, and its page header.
/**
 * The window a desktop frame sits in.
 *
 * <p>`chrome: 'browser'` is a page loaded at an address, and the bar shows it. `chrome: 'app'` is
 * an installed program's own window: it has a title where the address would be, because a program
 * that was installed is not reached by typing a URL — and drawing an address bar over one tells
 * every reader it is a web page.
 *
 * @param url the address, for a browser window
 * @param chrome `browser` (default) or `app`. `none` never reaches here — the kit draws no bar
 * @param title the program's window title, for `app`
 */
export const browserbar = (url, { chrome = 'browser', title = '' } = {}) => (chrome === 'app'
  ? `<div class="browserbar is-app"><span class="dots"><i></i><i></i><i></i></span><span class="wtitle">${title || url}</span></div>`
  : `<div class="browserbar"><span class="dots"><i></i><i></i><i></i></span><span class="url">${url}</span></div>`);

/**
 * The bar across the top of the console.
 *
 * <p>The tabs pick an area and nothing else — what is inside that area is the column on the
 * left. They cluster by the kind of work they carry (preparing, doing, recording, gated), and a
 * rule separates one cluster from the next.
 *
 * <p>The tail belongs to the reader rather than to the page: the site being worked in, unread
 * notifications, theme, language, the account, and the `⋮` that opens administration. **The site
 * selector is here and not on a page** because its value governs every figure on every screen —
 * dates, deadlines and 「오늘」 are read in that site's time zone and against its shift calendar,
 * so a reader who cannot see which site they are in reads every number wrong.
 *
 * @param groups tab clusters, each `[{label, active, locked}]`; a rule is drawn between clusters
 * @param wrapped the row of tabs did not fit and moved down into {@link menuBar}, so the bar
 *   itself carries only the mark and the reader's own controls
 * @param sitePick the reader may move between sites. An account granted one site draws the name
 *   without the caret — a caret is an offer, and one that opens onto a list of one is a boundary
 *   the account only discovers by pressing it
 */
export const topNav = ({
  brand = 'SMART SAFETY', groups = [], site = '전체 사업장',
  unread = 0, admin = true, adminActive = false, wrapped = false, search = '', sitePick = true,
}) =>
  `<div class="topnav">` +
  `<span class="tn-mark">◧</span><span class="tn-rule"></span>` +
  `<span class="tn-brand">${brand}</span>` +
  (wrapped ? '' : `<div class="tn-tabs">${tabRow(groups)}</div>`) +
  `<span class="spacer"></span>` +
  // A console with a hundred destinations needs a way in that is not the tree. What a reader
  // arrives holding is a name, an article number or a record id — none of which the menu knows.
  (search ? `<span class="tn-find"><span class="ic">⌕</span><span class="ph">${search}</span></span>` : '') +
  `<span class="chip site">${site}${sitePick ? ' ▼' : ''}</span>` +
  `<span class="tn-rule"></span>` +
  `<span class="tn-act bell">알림${unread ? `<span class="dot">${unread}</span>` : ''}</span>` +
  `<span class="tn-act">테마</span><span class="tn-act">언어</span>` +
  `<span class="tn-act avatar"></span>` +
  // Administration has no tab, so when the reader is inside it the `⋮` is the only thing that
  // can say where they are — without this the tab row reads as "nowhere".
  (admin ? `<span class="tn-act more${adminActive ? ' active' : ''}">⋮</span>` : '') +
  `</div>`;

const tabRow = (groups) => groups.map((group, i) =>
  (i > 0 ? `<span class="tn-div"></span>` : '') +
  group.map((t) => `<span class="tn-tab${t.active ? ' active' : ''}${t.locked ? ' locked' : ''}">` +
    `<span class="ic"></span>${t.label}` +
    `${t.locked ? `<span class="lk">${t.locked}</span>` : ''}</span>`).join('')
).join('');

/**
 * The row the tabs move into when the top bar is too narrow to hold them.
 *
 * <p>All of them move, or none — a row that keeps some tabs and drops the rest makes the missing
 * ones look unavailable rather than merely elsewhere. This row is the one place on the console
 * that may scroll sideways, and it says so by keeping its scrollbar.
 */
export const menuBar = (groups) => `<div class="menubar scroll-x">${tabRow(groups)}</div>`;

/**
 * The column on the left: the menu of whichever area the top bar's tab picked.
 *
 * <p>Two levels, and the first one folds. A group is the cluster the entries under it belong to
 * and is a toggle rather than a destination — pressing it opens or shuts the branch, it never
 * navigates. Only the branch holding the current screen stands open, so a column carrying five
 * clusters still shows one screenful.
 *
 * <p>Two different numbers can ride an entry and they must not be confused: `count` is how many
 * records are there, drawn plain, and `badge` is how many wait for this reader to act, drawn in
 * the accent. A reader who reads the first as the second goes looking for work that does not
 * exist.
 *
 * <p>`rail` collapses the column to icons — one icon per group, its entries reached through the
 * flyout, and any waiting work rolled up into a mark. A number cannot be read at that width, and
 * a mark that says only "something is here" beats a number nobody can see.
 *
 * @param title the area's name, from the tab that opened it
 * @param groups `[{label, open, locked, items}]`
 * @param items `[{label, active, count, badge, locked}]`
 * @param flyout the group opened beside the rail: `{label, items}`
 */
export const sectionNav = ({ title, groups = [], rail = false, flyout = null }) => {
  // Up to three levels: the group, its entries, and — where a cluster carries more entries than
  // one column can show — a level under those. The third level is for splitting a long list into
  // the things it is actually made of, never for burying a screen one press deeper than it needs
  // to be: an entry that would be alone under a parent belongs at the parent's level.
  // The caret keeps its place whether or not this entry has one. Without that the label of an
  // entry that folds and the label of one that does not start at different x, and a reader
  // scanning the column cannot tell a level from a level — the indent stops meaning anything.
  const entry = (it, sub = false) =>
    `<div class="sn-item${sub ? ' sub' : ''}${it.active ? ' active' : ''}${it.locked ? ' locked' : ''}">` +
    (sub ? '' : `<span class="car">${it.children ? (it.open ? '⌄' : '›') : ''}</span>`) +
    `<span class="ic"></span><span class="sn-label">${it.label}</span>` +
    `${it.locked ? `<span class="lk">${it.locked}</span>`
      : it.badge ? `<span class="dot">${it.badge}</span>`
        : it.count != null ? `<span class="sn-count">${it.count}</span>` : ''}</div>` +
    (it.open && it.children
      ? `<div class="sn-sub2">${it.children.map((c) => entry(c, true)).join('')}</div>` : '');
  const group = (g) => {
    const holdsCurrent = g.items.some((it) => it.active || (it.children ?? []).some((c) => c.active));
    if (rail) {
      // Collapsed, the group's own icon is all there is, so work waiting anywhere inside it has
      // to surface here or it is invisible until somebody expands the column.
      const waiting = g.items.some((it) => it.badge || (it.children ?? []).some((c) => c.badge));
      return `<div class="sn-group${holdsCurrent ? ' here' : ''}${g.locked ? ' locked' : ''}" title="${g.label}">` +
        `<span class="ic"></span>${waiting ? '<span class="pip"></span>' : ''}</div>`;
    }
    return `<div class="sn-group${g.open ? ' open' : ''}${g.locked ? ' locked' : ''}">` +
      `<span class="car">${g.open ? '⌄' : '›'}</span><span class="ic"></span>` +
      `<span class="sn-label">${g.label}</span>` +
      `${g.locked ? `<span class="lk">${g.locked}</span>` : ''}</div>` +
      // Called with an arrow rather than passed straight to map: map hands the callback an
      // index as its second argument, which would land in `sub` and draw every entry after the
      // first at the third level.
      (g.open ? `<div class="sn-sub">${g.items.map((it) => entry(it)).join('')}</div>` : '');
  };
  // A collapsed column names nothing, so the flyout is both how an entry is reached and how the
  // icon above it says what it was.
  const fly = rail && flyout
    ? `<div class="sn-flyout"><div class="fly-head">${flyout.label}</div>` +
      flyout.items.map((it) => `<div class="fly-item${it.active ? ' active' : ''}">${it.label}</div>`).join('') +
      `</div>`
    : '';
  return `<div class="secnav${rail ? ' rail' : ''}">` +
    `<div class="sn-head">${rail ? '' : `<span class="sn-title">${title}</span>`}` +
    `<span class="sn-toggle" title="${rail ? '사이드바 펴기' : '사이드바 접기'}">${rail ? '»' : '«'}</span></div>` +
    `<div class="sn-list">${groups.map(group).join('')}${fly}</div></div>`;
};

/**
 * The strip along the bottom: what keeps running while the reader works on something else.
 *
 * <p>Everything here belongs to no single screen and has to be watched anyway, and every segment
 * is a way into the screen that owns it. What flows on the left is only what needs acting on —
 * everything else piles up in the bell, and merging the two would make the strip a feed nobody
 * reads.
 *
 * @param ticker the event currently passing, or the words standing in for an empty run
 * @param segments `[{label, tone}]` — `tone` is `''` · `warn` · `ok`
 * @param health the product's own standing, opened for the detail behind it
 */
export const statusBar = ({ powered = '', ticker = '', segments = [], health = null, agent = null }) =>
  `<div class="statbar">` +
  (powered ? `<span class="sb-brand">${powered}</span><span class="sb-rule"></span>` : '') +
  (agent ? `<span class="sb-agent${agent.blocked ? ' warn' : ''}"><span class="ai-mark">◈</span>` +
    `지금 할 일 ${agent.todo}${agent.blocked ? ` · 막는 일 ${agent.blocked}` : ''}</span>` +
    `<span class="sb-rule"></span>` : '') +
  (ticker ? `<span class="sb-ticker"><span class="ic"></span>${ticker}</span>` : '') +
  `<span class="spacer"></span>` +
  segments.map((s) => `<span class="sb-seg${s.tone ? ' ' + s.tone : ''}">${s.label}</span>`).join('<span class="sb-rule"></span>') +
  (health ? `<span class="sb-rule"></span><span class="sb-health">${health.label}` +
    `<span class="pip${health.tone ? ' ' + health.tone : ''}"></span></span>` : '') +
  `</div>`;

/**
 * The panel the status bar sits on. A shared terminal or an installed console can open a pane
 * above the strip — the processing queue, a live log — and drag it taller.
 */
export const bottomPanel = (statusBarHtml, pane = '') =>
  (pane ? `<div class="bp-grip"></div><div class="bp-pane">${pane}</div>` : '') + statusBarHtml;


/**
 * The page header inside the content column: the screen's name, the line under it, and the
 * screen's own actions. There is no breadcrumb and no global search — the tree is the only
 * place a screen is named.
 *
 * <p>`back` is the exception, and it is not a breadcrumb: one control naming the list this page
 * was opened from. The tree cannot do this job — it says where you ARE, and pressing the menu
 * entry opens that list fresh, losing the filter, the page and the scroll position the reader
 * left behind. A reader who came from 「기한 지남 4건」 wants those four back, not all 214. So a
 * full page reached from a list carries one, above the title where a return is looked for, and
 * the pattern is settled rather than improvised as a 「목록으로」 button at the bottom of a page
 * long enough that nobody scrolls back to it.
 *
 * <p>It names the list — 「사업장 목록」, not 「뒤로」. Back-in-history is the browser's control and
 * says nothing about where it lands; a named list is a promise the page can keep.
 */
export const pageHeader = ({ title, description = '', actions = '', center = '', back = '' }) =>
  `<div class="pagehead">` +
  `${back ? `<a class="ph-back">← ${back}</a>` : ''}` +
  `<div class="ph-text"><div class="ph-title">${title}</div>` +
  `${description ? `<div class="ph-desc">${description}</div>` : ''}</div>` +
  `${center ? `<div class="ph-center">${center}</div>` : ''}` +
  `${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;

/**
 * The actions a list row offers. Icons rather than words — a row is read by its data, not by
 * its buttons.
 *
 * <p>**Every row draws every action, always, in the same place, and every row has the same
 * number of them.** One that cannot be used on this row right now is drawn disabled, never
 * removed. Which actions exist is a property of the screen, not of the row: a column whose
 * buttons shift from line to line cannot be run down with the eye, and a control that appears
 * and vanishes leaves a reader doubting what they saw a moment ago — then hunting for it on
 * the row where it matters.
 *
 * <p>One button may stand for more than one thing by **changing its own icon or label in
 * place** — a toggle, a state that flips. What it must not do is move, or leave a gap.
 *
 * @param actions `[{label, disabled}]`, or a bare label for one always available
 * @param more collapses the rest behind 더보기; it too is drawn on every row
 */
export const rowActions = (actions, more = false) =>
  `<span class="rowact">` +
  actions.map((a) => {
    const it = typeof a === 'string' ? { label: a } : a;
    return `<span class="ract${it.disabled ? ' off' : ''}" data-a="${it.label}" title="${it.label}">` +
      `<span class="ic"></span></span>`;
  }).join('') +
  (more ? `<span class="ract more">더보기</span>` : '') + `</span>`;

/**
 * Tabs over a list. A list gets these when its rows split into kinds somebody works through
 * separately — a status, a decision, a record type. Everything else is a filter: a tab that
 * only narrows by one value is a filter wearing a costume.
 */
export const listTabs = (items) =>
  `<div class="ltabs">${items.map((t) => `<span class="ltab${t.active ? ' active' : ''}">${t.label}` +
    `${t.count != null ? `<span class="n">${t.count}</span>` : ''}</span>`).join('')}</div>`;

/**
 * The language switch that rides a field kept per language. It goes on what a worker reads in
 * their own tongue — the safety knowledge, the forms, the notices — and not on the ledger the
 * office keeps in the deployment's own language.
 */
export const langTabs = (langs, active = 0) =>
  `<div class="ltabs lang">${langs.map((l, i) => `<span class="ltab${i === active ? ' active' : ''}">${l}</span>`).join('')}</div>`;

/** A form laid out two fields to a row. Long and multi-value fields opt out with `wide`. */
export const formGrid = (children) => `<div class="fgrid">${children}</div>`;

/** A titled group inside a form or a panel. Multi-line input gets a group of its own. */
export const formSection = (title, children, { one = false } = {}) =>
  `<div class="sect"><div class="sect-t">${title}</div>` +
  `<div class="${one ? 'fone' : 'fgrid'}">${children}</div></div>`;

/** Text in, one line. */
/**
 * The mark that says a field cannot be left blank, in the reader's language.
 *
 * <p>A worker accepting an invitation reads the whole form in Tiếng Việt and met this one word in
 * Korean — and it is the word that decides whether they may press the button, so it is exactly
 * the kind that has to be readable.
 */
const REQ_MARK = { ko: '필수', vi: 'Bắt buộc', en: 'Required', km: 'ចាំបាច់' };
const req = (required, lang) => (required ? `<i>${REQ_MARK[lang] ?? REQ_MARK.ko}</i>` : '');

export const fText = ({ label, value = '', hint = '', wide = false, required = false, lang = 'ko' }) =>
  `<div class="ffield${wide ? ' wide' : ''}"><span class="label">${label}${req(required, lang)}</span>` +
  `<span class="input">${value}</span>${hint ? `<span class="fhint">${hint}</span>` : ''}</div>`;

/**
 * Text kept per language, with the language selector the field carries.
 *
 * <p>The value the reader sees is the entry for their own language; a language left blank falls
 * back to the first one filled, and the field shows that fallback as its placeholder so the
 * writer can tell what an empty language will actually print. One selector serves the whole
 * screen — every multilingual field on a screen moves to the same language together.
 */
export const fI18n = ({ label, value = '', lang = '한국어', hint = '', wide = false, required = false, reqLang = 'ko' }) =>
  `<div class="ffield${wide ? ' wide' : ''}"><span class="label">${label}${req(required, reqLang)}` +
  `<span class="lang">‹ ${lang} ›</span></span>` +
  `<span class="input">${value}</span>${hint ? `<span class="fhint">${hint}</span>` : ''}</div>`;

/** The same, for text that runs long. */
export const fI18nArea = ({ label, value = '', lang = '한국어', hint = '', rows = 3 }) =>
  `<div class="ffield wide"><span class="label">${label}<span class="lang">‹ ${lang} ›</span></span>` +
  `<span class="area" style="height:${18 + rows * 17}px">${value}</span>` +
  `${hint ? `<span class="fhint">${hint}</span>` : ''}</div>`;

/** One of a fixed set. */
export const fSelect = ({ label, value = '', hint = '', wide = false, required = false, lang = 'ko' }) =>
  `<div class="ffield${wide ? ' wide' : ''}"><span class="label">${label}${req(required, lang)}</span>` +
  `<span class="input sel">${value}<span class="car">▼</span></span>${hint ? `<span class="fhint">${hint}</span>` : ''}</div>`;

/** A number, with the stepper a number input carries. */
export const fNum = ({ label, value = '', hint = '', unit = '', wide = false, required = false, lang = 'ko' }) =>
  `<div class="ffield${wide ? ' wide' : ''}"><span class="label">${label}${req(required, lang)}</span>` +
  `<span class="input num">${value}${unit ? `<span class="unit">${unit}</span>` : ''}` +
  `<span class="spin"><i>↑</i><i>↓</i></span></span>${hint ? `<span class="fhint">${hint}</span>` : ''}</div>`;

/** Text that runs long. Always the full width, and normally a section of its own. */
export const fArea = ({ label, value = '', hint = '', rows = 3, required = false, lang = 'ko' }) =>
  `<div class="ffield wide"><span class="label">${label}${req(required, lang)}</span>` +
  `<span class="area" style="height:${18 + rows * 17}px">${value}</span>` +
  `${hint ? `<span class="fhint">${hint}</span>` : ''}</div>`;

/** Many values at once — chips, a picker, a small table. Full width. */
export const fMulti = ({ label, value, hint = '' }) =>
  `<div class="ffield wide"><span class="label">${label}</span>` +
  `<span class="multi">${value}</span>${hint ? `<span class="fhint">${hint}</span>` : ''}</div>`;

/**
 * The controls a document editor puts above the page it is editing.
 *
 * <p>A page of editable prose with no toolbar says the text can be read, not that it can be
 * written — and the reviewer has no way to tell which of the editor's abilities the product is
 * committing to. The board fixes WHICH controls exist and how they cluster; the design system
 * decides what each one looks like.
 *
 * <p>**The clusters are the point.** Undo, the paragraph level, the character run, the lists, what
 * gets inserted, and the search — a reader finds a control by the group it belongs to, so a flat
 * run of twenty icons is a toolbar nobody learns. A rule separates one cluster from the next, the
 * way the console's tab row separates its own.
 *
 * @param groups `[[label, …], …]` — one array per cluster
 * @param trail what rides the right end: the save state, the word count, the reader's own controls
 */
export const editorBar = (groups = [], trail = '') =>
  `<div class="edbar">` +
  groups.map((g) => g.map((t) => {
    const it = typeof t === 'string' ? { label: t } : t;
    return `<span class="ed-tool${it.active ? ' active' : ''}${it.disabled ? ' off' : ''}">${it.label}</span>`;
  }).join('')).join('<span class="ed-div"></span>') +
  `<span class="spacer"></span>` +
  (trail ? `<span class="ed-trail">${trail}</span>` : '') +
  `</div>`;

/** The body of a tab that holds a list rather than fields. */
export const tabList = (children) => `<div class="tabbody">${children}</div>`;

/**
 * One row of a tab that holds records, with the lines that belong under it.
 *
 * <p>A parent line carrying its own badges and one action, and beneath it the rows that only
 * mean something in its company — a work type and the tasks under it, an inspection and its
 * findings. `sub` empty is drawn as a sentence rather than as nothing, because "none yet" is
 * a state somebody comes here to read.
 *
 * @param title the record's own name
 * @param trail badges and the action that opens it, right-aligned
 * @param sub `[left, right]` pairs, or a single string when there are none
 */
export const nestedRow = ({ title, trail = '', sub = [] }) =>
  `<div class="nrow"><div class="nr-main"><span class="nr-title">${title}</span>` +
  `<span class="nr-trail">${trail}</span></div>` +
  (Array.isArray(sub)
    ? sub.map(([left, right]) => `<div class="nr-sub"><span>${left}</span><span>${right}</span></div>`).join('')
    : `<div class="nr-sub"><span>${sub}</span></div>`) +
  `</div>`;

/** One entry in the live feed. */
export const notice = ({ when, body, unread = false }) =>
  `<div class="notice${unread ? ' unread' : ''}"><span class="when">${when}</span>${body}</div>`;

/** The right-hand notification drawer, opened from the bell. */
export const drawer = ({ title, children }) =>
  `<div class="drawer"><div class="dhead"><span class="t-title">${title}</span>` +
  `<span class="spacer"></span><span class="chip">모두 읽음</span><span class="chip">닫기</span></div>` +
  `<div class="dbody">${children}</div></div>`;

/**
 * A mail as it lands in somebody's inbox.
 *
 * <p>Outgoing messages are screens too — a work-stop notice read on a phone at 22:40 is the
 * product's most consequential surface and the one nobody wireframes. The chrome here is the mail
 * client's, drawn so the reviewer sees what the recipient sees: who it claims to be from, what the
 * subject line says before it is opened, and how much of it survives a preview pane.
 */
const MAIL_META = {
  ko: { from: '보낸사람', to: '받는사람' },
  vi: { from: 'Từ', to: 'Đến' },
  en: { from: 'From', to: 'To' },
  km: { from: 'ពី', to: 'ជូន' },
};

export const mailFrame = ({ subject, from, to, children, foot = '', lang = 'ko' }) => {
  const t = MAIL_META[lang] ?? MAIL_META.ko;
  return `<div class="msgwrap"><div class="mailbox">` +
  `<div class="mb-head"><div class="mb-subject">${subject}</div>` +
  `<div class="mb-meta">${t.from} ${from} · ${t.to} ${to}</div></div>` +
  `<div class="mb-body">${children}</div>` +
  (foot ? `<div class="mb-foot">${foot}</div>` : '') +
  `</div></div>`;
};

/**
 * A message as it lands in a messenger — 알림톡 · LINE · SMS.
 *
 * <p>Drawn at phone width because that is the only width it is ever read at, and with the app's
 * own name on it because the recipient's trust in the message comes from the channel before it
 * comes from the words. A worker who cannot read Korean identifies the sender by the channel.
 */
export const chatFrame = ({ app, sender, children, buttons = '', note = '' }) =>
  `<div class="msgwrap"><div class="chat">` +
  `<div class="ch-head"><span class="ch-app">${app}</span><span class="ch-sender">${sender}</span></div>` +
  `<div class="ch-bubble">${children}` +
  (buttons ? `<div class="ch-btns">${buttons}</div>` : '') + `</div>` +
  (note ? `<div class="ch-note">${note}</div>` : '') +
  `</div></div>`;

/** Toasts a push actually renders over a working screen. */
export const toasts = (items) =>
  `<div class="toasts">${items.map((i) => `<div class="toast">${i}</div>`).join('')}</div>`;

export const shell = (sidebarHtml, mainHtml) => `<div class="shell">${sidebarHtml}<div class="main">${mainHtml}</div></div>`;

// ── master-detail & overlays ────────────────────────────────────────────────
export const split = (listHtml, detailHtml) => `<div class="split"><div class="pane list">${listHtml}</div><div class="pane">${detailHtml}</div></div>`;

/**
 * The console's default page layout. The list fills the page on its own; opening a row puts
 * the record in a panel on the right, with a divider the reader can drag between the two.
 * Pass no detail for the closed state.
 */
export const listDetail = (listHtml, detailHtml = '') =>
  `<div class="listdetail"><div class="ld-list">${listHtml}</div>` +
  (detailHtml ? `<div class="ld-divider"></div><aside class="ld-detail">${detailHtml}</aside>` : '') +
  `</div>`;

/** The panel's header — the record's own name, and the control that closes the panel. */
export const panelHead = (title) =>
  `<div class="ld-head"><span class="ph-title sm">${title}</span><span class="ld-close">✖</span></div>`;

/** The panel's footer — the record's own actions. Delete keeps one fixed place. */
export const panelFoot = (actions) => `<div class="ld-foot">${actions}</div>`;

/**
 * The verbs the open tab asks for, on the row above {@link panelFoot}. They divide the row
 * between them, so what the tab offers is read without opening a menu. Switching tabs changes
 * this row and leaves the one below it alone — what is done to the record does not depend on
 * which of its tabs is open.
 */
export const panelVerbs = (actions) => `<div class="ld-verbs">${actions}</div>`;

/**
 * The panel in its form state — creating a record, or editing the one the list has open.
 *
 * <p>**An entity's own form opens here and not in a dialog.** license-studio settles this and
 * every entity screen there follows it: the list stays on the left and the detail region switches
 * between 상세 · 새로 만들기 · 편집. The reader keeps the list, the filter and the scroll position
 * they arrived with, and the form is as wide as the panel rather than as wide as a modal — which
 * is what lets a form of a dozen fields sit two to a row instead of stacking.
 *
 * <p>A dialog is still right for four things and only these: a sub-entity inside a parent's tab,
 * a confirm for something irreversible, a peek at a record another field refers to, and an output.
 * The test is the subject — if 저장 writes the row the list is showing, it belongs in this panel.
 *
 * @param mode 새로 만들기 · 편집 — drawn beside the title, because an empty form and a loaded one
 *   are otherwise told apart only by whether the fields happen to have values
 */
export const panelForm = ({ title, mode = '새로 만들기', children, foot }) =>
  `<div class="ld-head"><span class="ph-title sm">${title}</span>` +
  `<span class="badge outline">${mode}</span><span class="ld-close">✖</span></div>` +
  `<div class="ld-formbody">${children}</div>` +
  `<div class="ld-foot">${foot}</div>`;

/** Tabs across the top of a panel. Counts ride the label, as the implementation writes them. */
export const tabs = (items) =>
  `<div class="tabs">${items.map((t) => `<span class="tab${t.active ? ' active' : ''}">${t.label}` +
    `${t.count != null ? `<span class="n">${t.count}</span>` : ''}</span>`).join('')}</div>`;

/**
 * A record page's phases as a rail down the left, with that phase's content beside it.
 *
 * <p>{@link tabs} is for the detail panel, where three to five phases fit across one line. A
 * record that earned its own page carries more — six phases put across the top truncate their
 * own names, and the reader cannot tell how many there are. Standing them down the left keeps
 * every name whole and turns the count into something read at a glance.
 *
 * @param items same shape as {@link tabs} — { label, active, count }
 * @param children what the active phase shows
 */
export const recordTabs = (items, children) =>
  `<div class="rec"><div class="stabs">${items.map((t) => `<span class="stab${t.active ? ' active' : ''}">${t.label}` +
    `${t.count != null ? `<span class="n">${t.count}</span>` : ''}</span>`).join('')}</div>` +
  `<div class="rec-b">${children}</div></div>`;

/**
 * The list column of a companion frame, standing in for what the base already draws there.
 *
 * <p>A companion keeps the base's two-column shape — list on the left, detail on the right — so a
 * reader arriving from the base sees the same structure and reads the stacked panes as that
 * panel's tabs. This fills the list column; the moment it draws rows instead, the same records
 * live in two frames and only one of them gets corrected.
 *
 * @param label what stands here on the real screen
 * @param ref the NAME of the screen that draws it — never its frame id. This renders inside the
 *   device frame, and a frame number that reaches a reader is the one thing a board never puts
 *   in a drawing; a screen's name is also what somebody building from the board can act on.
 */
export const regionPh = ({ label, ref }) =>
  `<div class="region-ph"><span class="rp-l">${label}</span><span class="rp-r">${ref}</span></div>`;

/**
 * The panes a tabbed screen declares and its base frame does not draw, stacked down the DETAIL
 * column with the base's own tab strip repeated above each one.
 *
 * <p>A tab strip names its panes and draws only the open one, so every other pane's columns, its
 * actions and its empty state are unspecified and get invented by whoever builds the screen. One
 * companion frame per tabbed screen carries all of them; one frame per PANE would have to redraw
 * the page around each.
 *
 * <p>**The strip is the base's, drawn again per pane with that pane open.** Passing the base's
 * exported `tabStrip` rather than re-declaring the tabs is what keeps one drawing: a tab added or
 * relabelled moves in both places at once. It is also what keeps a capture census honest — a
 * demand counted off literal `tabs([…])` declarations sees one strip, in the base, rather than two.
 *
 * <p>**The note it writes at the top is half of what the frame is for.** Without it, stacked panes
 * read as one long page and get built as one — a scrolling screen where a tab strip belongs.
 *
 * @param strip the base's `tabStrip(open)`, which draws the real strip with `open` active
 * @param open the pane the base frame draws, named so a reader knows why it is absent here
 * @param ref the base screen's NAME, never its frame id — see {@link regionPh}
 * @param of how many tabs the strip names, when that is more than these panes plus the open one.
 *   Sibling frames sometimes open panes of their own — a designer whose preview has a frame — so
 *   the companion carries only what is left, and the note must not shrink the strip to fit it.
 * @param rail true where the base draws its phases with {@link recordTabs} rather than a top
 *   strip — that primitive takes the pane's body as its second argument and draws it beside the
 *   rail, so the pane is handed over whole instead of being stacked under the strip
 * @param region where the strip sits — 「상세 패널」 for a strip inside a list-detail's panel,
 *   「화면」 for a page's own strip on a screen that draws neither a list column nor a panel
 * @param panes `{ label, verbs, body }` in the strip's order, the open one omitted
 */
export const tabPanes = ({
  strip, open, ref, panes, rail = false, of = panes.length + 1, region = '상세 패널',
}) =>
  `<div class="tpanes"><div class="tp-note">` +
  `<strong>탭 칸입니다 — 이어지는 한 페이지가 아닙니다.</strong> ${ref} ${region}의 탭 ${of}개 가운데 ` +
  `${of > panes.length + 1 ? `${panes.length}개를` : `「${open}」을 뺀 나머지를`} ` +
  `탭 차례대로 쌓았습니다. 제품에서는 한 번에 한 칸만 표시하고, 칸을 바꾸면 ` +
  `${region === '상세 패널' ? '패널 윗단 동사도' : '제목 옆 동사도'} 함께 바뀝니다.</div>` +
  panes.map((p) => `<div class="tp-pane">` +
    (rail ? strip(p.label, p.body) : `${strip(p.label)}<div class="tp-b">${p.body}</div>`) +
    `${p.verbs ? panelVerbs(p.verbs) : ''}</div>`).join('') +
  `</div>`;

/** A titled group of fields inside a panel. Fields sit two to a row. */
export const section = (title, children) =>
  `<div class="sect">${title ? `<div class="sect-t">${title}</div>` : ''}<div class="fields">${children}</div></div>`;

/**
 * A section heading for a block that is not fields — a lifecycle rail, an attachment grid, a
 * chart inside a panel.
 *
 * <p>{@link section} carries its own heading, but only around a grid of fields. A rail dropped
 * straight after one reads as the last field of it: the reader sees 「도달 · 승격 2회 뒤 응답」 and
 * then three dots, with nothing saying the dots are a different subject. The heading is what
 * separates them.
 */
export const sectHead = (title) => `<div class="sect-t sect-head">${title}</div>`;

/**
 * One read-only field: its label, its value, and — when the value names another record —
 * the external-link control that peeks at it.
 */
export const dField = ({ label, value, peek = false, wide = false, top = false }) =>
  `<div class="dfield${wide ? ' wide' : ''}${top ? ' top' : ''}"><span class="dlabel">${label}</span>` +
  `<span class="dvalue">${value}${peek ? '<span class="peek">보기</span>' : ''}</span></div>`;

/** The strip under a panel's body: the record's id, and when it was written. */
/**
 * The strip under a panel body: what the record is, and when it was written.
 *
 * <p>**The id is whole and copyable.** An outsider reading this to write a report needs the
 * identifier in their notes, and `sub_48112…` truncated with an ellipsis cannot be transcribed
 * — an inspector who cannot name the record cannot cite it.
 *
 * <p>**A record that cannot change says so instead of showing a modified time.** On an immutable
 * record — a signature certificate, an evidence package, an export — 「수정」 beside 「생성」 says
 * the thing changed after it was fixed, which is exactly what the screen elsewhere promises never
 * happens. Pass `updated` as `null` and the strip prints 「고칠 수 없음」 in its place.
 */
export const auditFoot = (created, updated) =>
  `<div class="audit"><span class="mono">ID ${created.id}</span>` +
  `<span class="au-copy">복사</span><span class="spacer"></span>` +
  `<span>생성 ${created.at}</span>` +
  `<span>${updated == null ? '고칠 수 없음' : `수정 ${updated}`}</span></div>`;

/**
 * A dialog, in the one shape every dialog takes: a titled head, the body, and the actions.
 *
 * <p>The head and the foot are separated by rules that run the **full width** — no inset. What
 * they divide is not decoration: the head says what record this is about, the foot says what
 * will be done to it, and a reader must be able to find both without reading the middle. A rule
 * that stops short of the edge reads as a divider inside the content instead.
 *
 * @param foot the action row; a leading control belongs on the left, the rest trail
 */
/**
 * A centered dialog on a desktop screen.
 *
 * @param wide `true` widens it for a reference table; `'viewer'` widens it further and lets its
 *   body run the dialog's own height, for a {@link docViewer} that has to draw a page of paper
 */
export const dialog = ({ title, children, foot, wide = false }) =>
  `<div class="dim"></div><div class="modal peek${wide ? ' wide' : ''}` +
  `${wide === 'viewer' ? ' viewer' : ''}">` +
  `<div class="pk-head"><span class="ph-title sm">${title}</span><span class="ld-close">✖</span></div>` +
  `<div class="pk-body">${children}</div>` +
  `<div class="pk-foot">${foot}</div></div>`;

/**
 * The dialog a peek control opens: the referenced record's own detail, read where the
 * question was asked, with one explicit way out to that record's page.
 */
export const peekDialog = ({ title, children }) =>
  dialog({ title, children, foot: `<span class="spacer"></span>${btn('닫기', 'ghost')}${btn('페이지로 이동', 'primary')}` });

/**
 * The window a history list is read over, as a track rather than a set of choices.
 *
 * <p>Three things sit in one control because they are one question. The **range** says exactly
 * which window is on screen, down to the minute. The **grain** row picks how wide that window is
 * — five minutes to a month — so the same control serves "what happened in the last five
 * minutes" and "what happened this month". The **track** shows where the events actually are,
 * as density, before anything is filtered.
 *
 * <p>**The density is what makes this better than two date fields.** An operator looking for an
 * incident does not know when it happened; they know it was busy. The blocks say where to look,
 * and the arrows step the window by its own width so scanning backwards is one repeated press.
 *
 * <p>The now line stays drawn even when the window does not contain it — otherwise a reader
 * scrolled back three days cannot tell which direction the present is in.
 *
 * @param blocks density bands as `[left%, width%]`, in track coordinates
 * @param sel the selected window as `[left%, width%]`
 * @param now where the present sits, or null when it is outside the track
 */
export const timeScrubber = ({
  from, to, grains = ['5분', '10분', '30분', '1시간', '3시간', '6시간', '12시간', '1일', '3일', '7일', '1개월'],
  grain = '1일', ticks = [], blocks = [], sel = [0, 30], now = null,
}) =>
  `<div class="scrub">` +
  `<div class="sc-top">` +
  `<span class="sc-range">${from} — ${to}</span>` +
  `<span class="chip">현재</span>` +
  `<span class="spacer"></span>` +
  `<span class="sc-grains">${grains.map((g) =>
    `<span class="sg${g === grain ? ' active' : ''}">${g}</span>`).join('')}</span>` +
  `</div>` +
  `<div class="sc-band">` +
  `<span class="sc-nav">‹</span>` +
  `<div class="sc-track">` +
  blocks.map(([l, w]) => `<i class="blk" style="left:${l}%;width:${w}%"></i>`).join('') +
  `<span class="sc-sel" style="left:${sel[0]}%;width:${sel[1]}%"></span>` +
  (now == null ? '' : `<span class="sc-now" style="left:${now}%"></span>`) +
  `</div>` +
  `<span class="sc-nav">›</span>` +
  `</div>` +
  `<div class="sc-ticks">${ticks.map((k) => `<span>${k}</span>`).join('')}</div>` +
  `</div>`;

/**
 * The bar above a list: the total, the view switch, the committed filters as removable
 * badges, the filter popover, and the column picker.
 *
 * <p>**The view switch is where a calendar belongs.** Records that fall on dates can be read as
 * rows or as the month they land on, and drawing BOTH on one page costs the reader the whole
 * first screenful before the first row while saying the same thing twice. So the page draws one
 * of them and this segment says which — from here rather than from the page header, because the
 * bar carries the total and the committed filters and those survive the switch. Somebody who
 * narrowed to 「허가 없음」 and then pressed 「달력」 gets those six on the month, not all 84.
 *
 * @param views the segment's labels — `['목록', '격자']` where nothing falls on a date
 * @param view which of them is showing
 */
export const filterBar = ({ total, applied = [], hidden = 0, columns = true,
  views = ['목록', '격자'], view = '목록', search = '' }) =>
  `<div class="filterbar"><span class="total">${total}</span>` +
  // A list somebody arrives at holding a query — an article number, a record id — needs the box
  // in its own bar. Sending them to the global search loses the filters they came in with.
  (search ? `<span class="fb-find"><span class="ph">${search}</span></span>` : '') +
  `<span class="seg">${views.map((v) => `<span${v === view ? ' class="active"' : ''}>${v}</span>`).join('')}</span>` +
  applied.map((f) => `<span class="fbadge"><span class="k">${f.k}</span><span class="op">${f.op || '='}</span>${f.v}<span class="x">✖</span></span>`).join('') +
  (hidden ? `<span class="fbadge more">외 ${hidden}개</span>` : '') +
  `<span class="spacer"></span><span class="seg"><span>필터${applied.length ? `<span class="n">${applied.length}</span>` : ''}</span>` +
  (columns ? `<span>열</span>` : '') + `</span></div>`;

/**
 * A column heading. Every column of a searchable list can be sorted, so the wireframe marks
 * only the one the list is actually ordered by — the affordance on the rest appears on hover
 * and is not a wireframe concern.
 */
export const th = (label, { w = '', dir = '' } = {}) =>
  `<span class="td${w ? ' ' + w : ''}${dir ? ' sorted' : ''}">${label}` +
  `${dir ? `<span class="ar">${dir === 'asc' ? '↑' : '↓'}</span>` : ''}</span>`;

/**
 * A tree that IS the list — the shape the framework gives a hierarchy somebody works through: a
 * header row, ordinary columns, and a first column carrying the indent, the caret and the label.
 * Everything a flat list has, it has — a sorted header, a status column, the row's own verbs.
 *
 * <p>**A tree without a header is a navigation aid; a tree with one is a list.** Drawn as a bare
 * outline beside the panel it can carry none of those, so the status and the actions get drawn a
 * second time as a table above the region — and then the same records stand in two places on one
 * page and neither reads as the list.
 *
 * <p>What the hierarchy costs is width, because the first column spends it on indentation. Beside
 * a 760px panel that leaves room for two further columns, so everything else about the selected
 * node goes into the panel where it belongs.
 *
 * <p>The further columns and the action column are `.td.tight` — they take what they hold and no
 * more. `.fix` reserves 110px so a full-width list's action column cannot fold a button onto a
 * second line; beside a panel that reservation is spent on padding, and the name column pays it.
 *
 * @param rows `[{label, depth, open, leaf, active, badge, count, cells, actions}]` — `cells` are
 *   pre-classed `.td` strings for the further columns, `actions` becomes the trailing column
 */
// A tree that IS the list is still a table, and its columns still have to line up across rows —
// the same grid, from the same header. Without it the four boards that draw one had their second
// column start at a different x on every row, because the first column sized to each label.
export const treeTable = ({ head, rows, wrap = false }) =>
  `<div class="table${wrap ? ' tt-wrap' : ''}" style="--tc:${columnTemplate(head)}">` +
  `<div class="trow thead">${head.join('')}</div>` +
  rows.map((n) =>
    `<div class="trow${n.active ? ' tsel' : ''}">` +
    `<span class="td w2 tt-first">` +
    `<span class="tt-in" style="width:${n.depth * 16}px"></span>` +
    `<span class="tr-car">${n.leaf ? '·' : n.open ? '⌄' : '›'}</span>` +
    `<span class="tr-label">${n.label}</span>` +
    `${n.badge ? `<span class="badge outline">${n.badge}</span>` : ''}` +
    `${n.count != null ? `<span class="sn-count">${n.count}</span>` : ''}</span>` +
    (n.cells || []).join('') +
    `${n.actions ? `<span class="td tight">${rowActions(n.actions)}</span>` : ''}</div>`).join('') +
  `</div>`;

/**
 * The tree list's own bar. A flat list's bar carries the total and the committed filters; a tree
 * carries those and one thing more — whether the whole hierarchy is open. Without it somebody
 * looking for a node three levels down opens every branch by hand.
 */
export const treeBar = ({ total, expanded = true, applied = [], hidden = 0, search = '' }) =>
  `<div class="filterbar"><span class="total">${total}</span>` +
  (search ? `<span class="fb-find"><span class="ph">${search}</span></span>` : '') +
  `<span class="seg"><span${expanded ? ' class="active"' : ''}>모두 펼치기</span>` +
  `<span${expanded ? '' : ' class="active"'}>모두 접기</span></span>` +
  applied.map((f) => `<span class="fbadge"><span class="k">${f.k}</span><span class="op">${f.op || '='}</span>${f.v}<span class="x">✖</span></span>`).join('') +
  (hidden ? `<span class="fbadge more">외 ${hidden}개</span>` : '') +
  `<span class="spacer"></span><span class="seg"><span>필터${applied.length ? `<span class="n">${applied.length}</span>` : ''}</span>` +
  `<span>열</span></span></div>`;

/**
 * One value a reader types straight into the table.
 *
 * <p>Drawn as a box rather than as text so a column that can be edited says so before anyone
 * clicks it. An empty box is a value nobody has entered yet — different from a zero, which is
 * an entered value — so it is dashed rather than blank.
 *
 * @param value the value, or null when the row has none
 * @param unit the unit shown beside it, omitted when the column header already carries it
 * @param bad marks a value the server refused
 */
export const cellInput = ({ value = null, unit = '', bad = false } = {}) =>
  `<span class="cin${value == null ? ' empty' : ''}${bad ? ' bad' : ''}">` +
  `${value == null ? '값 없음' : value}${unit ? `<span class="unit">${unit}</span>` : ''}</span>`;

/**
 * A line the page says before its content — where the rest of this record's work is done, most
 * often. Aligned with the page header rather than with whatever follows, because it is the
 * page speaking and not the list.
 */
export const pageNote = (text) => `<div class="pagenote">${text}</div>`;

export const sheet = (children) => `<div class="dim"></div><div class="sheet">${children}</div>`;
export const modal = (children) => `<div class="dim"></div><div class="modal">${children}</div>`;

// ── the common states, drawn the same way on every screen ───────────────────

/**
 * Where an applied period, deadline, count or retention term came from.
 *
 * <p>Three layers can set one of these — what the statute fixes, what the industry pack
 * proposes, what the site configured — and the number alone says nothing about which won. An
 * operator asked to defend a schedule to an inspector needs the article it rests on, so the
 * badge rides every such value and opens the reading of all three.
 *
 * @param source what set the value in force
 * @param basis the article or pack version behind it, shown when the badge is opened
 */
export const sourceBadge = (source, basis = '') =>
  `<span class="srcbadge${source === '법정 기본' ? ' law' : ''}">${source}` +
  `${basis ? `<span class="basis">${basis}</span>` : ''}</span>`;

/**
 * A message the page says in place, as opposed to a toast that passes or a dialog that blocks.
 *
 * <p>**The kind is drawn, never left to colour alone.** This board is greyscale with one accent,
 * and the product will be read by people in the field on cheap screens in daylight — a message
 * whose only difference from the next one is a hue is a message nobody sorts. Each kind carries
 * its word.
 *
 * <p>The six are not decoration; they are different promises to the reader:
 * `help` how this screen is used (always true, never urgent) · `info` something to know now, no
 * action · `warn` leaving it as it is will cost something later · `error` blocked right now ·
 * `example` what a valid value looks like · `legal` the article this rests on.
 *
 * <p>`error` and `warn` are the only kinds that may carry an action, and an `error` states what
 * to do rather than only what went wrong. Two lock-shaped messages have their own components
 * because their reason is fixed: {@link lockNote} for a retention hold, {@link envBadge} for a
 * capability the environment cannot reach.
 *
 * @param kind help · info · warn · error · example · legal
 */
/**
 * The card an entity's explanation lives behind.
 *
 * A legend of the states a record moves through, a table of what each grade requires, a
 * walkthrough of how to read the screen — drawn inline, that material pushes the actual work
 * below the fold and is read once in a reviewer's life. It is reference, not the page's job.
 * So the page keeps a one-line card that says what the explanation answers, and pressing it
 * opens the explanation as a dialog. The card goes where reference belongs — under the list,
 * over the list-detail, or at the top of a detail tab — and the work stays where it was.
 */
export const helpCard = ({ title, hint = '', open = '펼쳐 보기' }) =>
  `<div class="helpcard"><span class="hc-mark">?</span>` +
  `<div class="hc-body"><div class="hc-title">${title}</div>` +
  `${hint ? `<div class="hc-hint">${hint}</div>` : ''}</div>` +
  `<span class="hc-open">${btn(open, 'ghost')}</span></div>`;

/**
 * The six kind words, in the four languages a site runs.
 *
 * <p>**The kind word is the first thing read in a message and the last thing translated.** It is
 * the grade — whether this is a notice, a caution or a refusal — and on a worker's phone it sat in
 * Korean above a body written in Tiếng Việt, so the reader met the sentence without knowing how
 * bad it was. The shell already follows `lang` for the tab row and the offline strip; a message
 * head is the third thing always on that screen.
 */
const MSG_KIND = {
  ko: { help: '지침', info: '알림', warn: '주의', error: '오류', example: '예시', legal: '근거' },
  vi: { help: 'Hướng dẫn', info: 'Thông báo', warn: 'Chú ý', error: 'Lỗi', example: 'Ví dụ', legal: 'Căn cứ' },
  en: { help: 'Guide', info: 'Notice', warn: 'Caution', error: 'Error', example: 'Example', legal: 'Basis' },
  km: { help: 'ការណែនាំ', info: 'ការជូនដំណឹង', warn: 'ប្រយ័ត្ន', error: 'កំហុស', example: 'ឧទាហរណ៍', legal: 'មូលដ្ឋាន' },
};

/**
 * What a list draws when it holds nothing.
 *
 * <p>**An empty state names the next action.** A box that says 「없습니다」 and stops leaves the
 * reader to work out for themselves whether the list is broken, filtered, or simply new — three
 * different situations that look identical when only the absence is drawn.
 *
 * <p>Filtered-to-zero and never-had-anything are DIFFERENT screens and each is its own frame:
 * the first offers 「필터 지우기」 and the second offers the create verb. Drawing one for both is
 * how a reader ends up clearing a filter that was never applied.
 *
 * @param action the button that resolves it — the create verb, or clearing the filter
 */
export const emptyState = ({ title, body = '', action = '' }) =>
  `<div class="empty"><div class="empty-t">${title}</div>` +
  `${body ? `<div class="empty-b t-body">${body}</div>` : ''}` +
  `${action ? `<div class="empty-a">${action}</div>` : ''}</div>`;

export const msg = ({ kind = 'info', title = '', body = '', actions = '', lang = 'ko' }) => {
  const label = (MSG_KIND[lang] ?? MSG_KIND.ko)[kind];
  return `<div class="msg ${kind}"><span class="mkind">${label}</span>` +
    `<div class="mbody">${title ? `<div class="mtitle">${title}</div>` : ''}` +
    `${body ? `<div class="mtext">${body}</div>` : ''}</div>` +
    `${actions ? `<div class="mact">${actions}</div>` : ''}</div>`;
};

/**
 * A capability the installation cannot reach, and why.
 *
 * <p>An air-gapped site loses AI translation, AI drafting, external timestamping and outside
 * certificate checks — and none of that is an edition it failed to buy. The two look identical
 * once a control is merely greyed, so an operator raises a support ticket for something no
 * purchase can fix, or waits for a network that is deliberately absent. This badge is what
 * keeps them apart from the 「라이선스」 lock the navigation column draws (설계서 5.5절).
 *
 * @param what the capability that is off
 */
/**
 * A value a calculation or a model produced, rather than a person or a rule.
 *
 * <p>The reader's question at every value is the same — can I sign this as it stands. A number a
 * person typed, a number a statute fixed and a number a model guessed all render as digits, so
 * the screen has to say which. `sourceBadge` answers a different question (what DECIDED this
 * value: a statute, the site's setting, an industry pack); this one answers how it was MADE.
 *
 * <p>**The words are five and closed** — 추정 (a calculation's forecast) · 자동 분류 (a model's
 * label) · 자동번역 · 초안 (generated prose) · 사진 판독 (vision). A sixth word would be a sixth
 * thing the reader has to learn, and `aiWordGate` refuses one.
 *
 * <p>**A reviewed value carries no badge.** The badge marks what has not been through a person
 * yet, exactly as machine translation does today — so it disappears on review rather than turning
 * into 「검수함」, which would leave the screen with a badge on every value and none of them
 * meaning anything.
 */
/**
 * The five words in the four languages a site runs. The Korean word stays the API key — it is what
 * `aiWordGate` reads and what keeps the set closed at five — and the spelling follows the reader.
 * A worker signing a TBM has to know the text was machine-translated, which is the one thing the
 * badge exists to say, and it said it in Korean over a Vietnamese sentence.
 */
const AI_WORD_TEXT = {
  추정: { vi: 'Ước tính', en: 'Estimate', km: 'ការប៉ាន់ស្មាន' },
  '자동 분류': { vi: 'Tự phân loại', en: 'Auto-classified', km: 'ចាត់ថ្នាក់ស្វ័យប្រវត្តិ' },
  자동번역: { vi: 'Dịch tự động', en: 'Machine translation', km: 'បកប្រែស្វ័យប្រវត្តិ' },
  초안: { vi: 'Bản nháp', en: 'Draft', km: 'សេចក្ដីព្រាង' },
  '사진 판독': { vi: 'Đọc từ ảnh', en: 'Read from photo', km: 'អានពីរូបថត' },
};

export const aiBadge = (kind, basis = '', lang = 'ko') =>
  `<span class="aibadge"><span class="ai-mark">◈</span>${AI_WORD_TEXT[kind]?.[lang] ?? kind}` +
  `${basis ? `<span class="basis">${basis}</span>` : ''}</span>`;

/**
 * What on this screen a model made, and what happens on an installation where it is off.
 *
 * <p>Placed where the screen's work depends on a feature that can be absent — the form generator,
 * the incident classifier, the photo reader. It is not put on a screen that merely shows one
 * estimated number, because the badge already says that and a card there would cost the list a
 * row for nothing.
 *
 * <p>The tier is on the card because it is the reader's answer to 「왜 내 화면에는 없지」: tier 1
 * is always there, tier 2 needs a model pack, tier 3 needs a GPU or an LLM endpoint and is off by
 * default on an air-gapped install.
 */
export const aiCard = ({ title, hint = '', tier = 2, open = '무엇이 만든 값인가' }) =>
  `<div class="aicard"><span class="ac-mark">◈</span>` +
  `<div class="ac-body"><div class="ac-title">${title}` +
  `<span class="ac-tier">${tier}등급</span></div>` +
  `${hint ? `<div class="ac-hint">${hint}</div>` : ''}</div>` +
  `<span class="ac-open">${btn(open, 'ghost')}</span></div>`;

export const envBadge = (what) =>
  `<span class="envbadge"><span class="ic"></span>환경 제약 · ${what}</span>`;

/**
 * Why a record cannot be edited, and until when.
 *
 * <p>A record under a retention term or a legal hold refuses every edit, and a screen that only
 * greys the controls leaves the reader to guess whether it is a permission problem, a defect,
 * or the law. The ground and the date are what stops that guess.
 *
 * @param basis the statutory ground for the lock
 * @param until the date the lock lifts, or the words standing in for one that does not
 */
export const lockNote = (basis, until) =>
  `<div class="locknote"><span class="lk">보존 잠금</span>` +
  `<span>${basis}</span><span class="spacer"></span><span class="mono">${until}</span></div>`;

/**
 * A page as it will be printed or exported — the paper, not the screen.
 *
 * <p>**The paper keeps its real proportion, and it ends where the page ends.** A box that grows to
 * whatever was put in it is not a preview of anything: content ran past the bottom of the page and
 * kept drawing, which reads as a broken frame rather than as 「this is page 2's worth」. So the
 * sheet takes its aspect ratio from the paper it claims to be, and clips — the viewer's `marks`
 * and `status` are what say a page was cut, and `inspect.mjs` reports a sheet whose content does
 * not fit, which is the signal that the page needs less on it or more pages.
 *
 * @param ratio the paper's shape, normally read off `size` — `port` A4/A5 upright · `land`
 *   sideways · `card` a credential 86×54mm, which has no page after it
 */
export const printSheet = ({ title, children, size = 'A4 세로', ratio = '' }) => {
  const kind = ratio || (/카드|명함|86 ?×|86x/.test(size) ? 'card' : /가로/.test(size) ? 'land' : 'port');
  return `<div class="sheet-wrap"><div class="sheet-meta">${size}</div>` +
    `<div class="sheet-paper pp-${kind}"><div class="sheet-h">${title}</div>${children}</div></div>`;
};

/**
 * Both faces of one printed thing, side by side.
 *
 * <p>A credential is not a document with pages to step through, but it does have two sides, and a
 * sheet that draws one while its caption promises the other 「뒷면에 QR이 인쇄됩니다」 is a preview
 * of half the artefact — the side carrying the QR, the emergency number and the terms is the side
 * nobody checked. Two faces of a card are read at once rather than paged, so they are drawn at
 * once; a viewer's rail would be the wrong control for something that has no page 3.
 */
export const sheetRow = (sheets) => `<div class="sheet-row">${sheets.join('')}</div>`;

/**
 * The window of pages the rail shows.
 *
 * <p>The rail is short, so it holds the pages around the one being read rather than the first
 * six — a reader on page 9 of 11 needs 8, 9 and 10 beside them, and a rail that always starts
 * at 1 shows none of those.
 */
// The three fits draw three different pictures, and a viewer that draws one of them under all
// three labels tells a reviewer nothing about what pressing the segment does: 「폭 맞춤」 is a page
// wide enough to read and cut off at the stage floor, 「한 쪽」 is one whole page at its true
// proportion, 「두 쪽」 is that page and the one after it.
const FITS = { '폭 맞춤': 'fit-width', '한 쪽': 'fit-page', '두 쪽': 'fit-two' };

const railWindow = (pages, page, max = 6) => {
  if (pages <= max) return Array.from({ length: pages }, (_, i) => i + 1);
  const start = Math.max(1, Math.min(page - Math.floor((max - 1) / 2), pages - max + 1));
  return Array.from({ length: max }, (_, i) => start + i);
};

/**
 * A document read as paper, with the controls that decide which page and how large.
 *
 * <p>**One page drawn at one size is not a viewer.** The reader cannot reach page 7, cannot see
 * that page 7 is where the table breaks, and cannot enlarge the print far enough to check a
 * figure before it goes to an office — and those are the three things somebody opens a preview
 * to do. So the toolbar carries the page step, the zoom, the fit and the find; the rail carries
 * every page as a thumbnail and marks the ones with a problem; and the status line states the
 * paper the document is on.
 *
 * <p>**The viewer owns how a document is read, never what it is made of.** Page, zoom, fit,
 * find and which language is drawn belong here. Paper, margins, copies and which languages are
 * printed at all stay on the page or in the print form, because those change the output rather
 * than the view — put them in the toolbar and a reader who only wanted a closer look has
 * changed the document.
 *
 * @param sheet  the paper — {@link printSheet}
 * @param marks  page numbers the rail flags, for what will be cut or is missing
 * @param note   the strip under the toolbar: the one thing wrong with this render
 * @param noteActions the ways out of what the note names — they belong beside it, not in a
 *   separate message under the viewer, where a reader has already sent the job to the printer
 */
export const docViewer = ({
  sheet, size = 'A4 세로', margin = '', pages = 1, page = 1, zoom = '100%',
  fit = '폭 맞춤', langs = null, lang = 0, find = null, marks = [], note = '',
  noteActions = '', status = '잘리는 것이 없습니다',
}) =>
  `<div class="dv"><div class="dv-bar">` +
  `<span class="dv-step"><span class="dv-b">‹</span>` +
  // The parts are separate elements because `.dv-pg` is a flex container, and a flex container
  // strips the whitespace around a bare text run — 「3 / 4」 came out as 「3/ 4」.
  `<span class="dv-pg"><b>${page}</b><span>/</span><span>${pages}</span></span>` +
  `<span class="dv-b">›</span></span>` +
  `<span class="dv-step"><span class="dv-b">−</span><span class="dv-pg">${zoom}</span>` +
  `<span class="dv-b">+</span></span>` +
  // 「두 쪽」 is not offered on a one-page document: pressing it would draw a second sheet that
  // does not exist, and a control that produces a lie is worse than a missing one.
  `<span class="seg">${(pages > 1 ? ['폭 맞춤', '한 쪽', '두 쪽'] : ['폭 맞춤', '한 쪽']).map((f) =>
    `<span${f === fit ? ' class="active"' : ''}>${f}</span>`).join('')}</span>` +
  (langs ? `<span class="seg">${langs.map((l, i) =>
    `<span${i === lang ? ' class="active"' : ''}>${l}</span>`).join('')}</span>` : '') +
  `<span class="spacer"></span>` +
  `<span class="dv-find">${find
    ? `<span>${find.q}</span><span class="hit">${find.at} / ${find.of}</span>`
    : '<span class="ph">문서에서 찾기</span>'}</span>` +
  `</div>` +
  (note ? `<div class="dv-note"><span>${note}</span>` +
    (noteActions ? `<span class="spacer"></span><span class="dv-na">${noteActions}</span>` : '') +
    `</div>` : '') +
  `<div class="dv-main"><div class="dv-rail">` +
  railWindow(pages, page).map((n) =>
    `<span class="dv-th${n === page ? ' active' : ''}${marks.includes(n) ? ' warn' : ''}">` +
    `<span class="dv-thp"></span><span class="dv-thn">${n}</span></span>`).join('') +
  `</div><div class="dv-stage ${FITS[fit] ?? 'fit-width'}">${sheet}` +
  (fit === '두 쪽' ? `<div class="dv-next"></div>` : '') + `</div></div>` +
  `<div class="dv-foot"><span class="mono">${size} · ${pages}쪽${margin ? ` · 여백 ${margin}` : ''}</span>` +
  `<span class="spacer"></span><span>${status}</span></div></div>`;

/**
 * The dialog a 「출력 미리 보기」 control opens: the whole document in a {@link docViewer},
 * over the screen it was reached from.
 *
 * <p>The foot carries what leaves the screen — the file and the printer — while the toolbar
 * carries what only changes the view, so a reader who zoomed in has not altered what prints.
 */
// The viewer's keys are repeated here rather than gathered with a rest element: a rest hides the
// option names from the build's option-key gate, and a viewer called with a misspelt `pages` would
// then draw a one-page document with nothing to say it had been asked for eleven.
export const viewerDialog = ({
  title = '출력 미리 보기', foot = null,
  sheet, size, margin, pages, page, zoom, fit, langs, lang, find, marks, note, noteActions, status,
}) =>
  dialog({
    title, wide: 'viewer',
    children: docViewer({
      sheet, size, margin, pages, page, zoom, fit, langs, lang, find, marks, note, noteActions, status,
    }),
    foot: foot ?? `${btn('닫기', 'ghost')}<span class="spacer"></span>` +
      `${btn('PDF 내려받기', 'ghost')}${btn('인쇄', 'primary')}`,
  });

// ── component catalog (self-registering storybook) ──────────────────────────
export const CATALOG = [
  { cat: 'text & placeholder', name: 't-title · t-sub · t-body', note: '실제 문구: 제목, 안내, 본문', ex: `${tTitle('작업허가 신청')}${tSub('작업 시작 전에 발급받습니다.')}` },
  { cat: 'text & placeholder', name: 'bar(width, light)', note: '자료가 들어갈 폭을 그린 회색 막대 — w25/w40/w60/w80/w100', ex: `${bar('w80')}${bar('w40', true)}` },
  { cat: 'text & placeholder', name: 'imgPh() · qrPh(label)', note: '사진 자리 · QR·바코드 자리', ex: `<div style="display:flex;gap:10px">${imgPh('thumb')}${qrPh('QR')}</div>` },
  { cat: 'container', name: 'qrBlock({label, caption, children, size})', note: 'QR은 왼쪽, 무엇을 스캔하는지는 코드 바로 아래, 나머지는 오른쪽 영역. 네모를 글줄 사이에 두면 옆 폭이 통째로 비고, 안내 문장이 코드 아래로 밀려 페이지 전체의 설명처럼 읽힌다', ex: qrBlock({ label: '식별 QR', caption: '현장 단말에 대면 본인이 확인됩니다', children: `${dField({ label: '이름', value: '쿠마르' })}${dField({ label: '배정', value: '남부현장 · A동 배관' })}${dField({ label: '유효', value: '배정이 끝나면 함께 정지' })}` }) },
  { cat: 'text & placeholder', name: 'mediaPh({label, size, note})', note: '화면이 실제로 보여 주는 그림과 그것이 무엇인지. imgPh는 라벨 없는 회색 상자이고 인자도 캡션이 아니라 CSS 클래스라, 그림 자체가 내용인 자리에는 맞지 않는다 — 이름으로만 있는 픽토그램은 읽는 사람이 판단할 수 없다. sm 행 옆 섬네일 · md 패널 미리 보기 · lg 그림이 곧 화면', ex: mediaPh({ label: '밀폐공간 산소결핍', note: '픽토그램 · 언어 없음' }) },
  { cat: 'container', name: 'inlineRow(children, {gap, align, wrap}) · stack(children, {top})', note: '화면이 raw <div>를 쓰지 않게 하는 자리. 클래스 없는 블록은 보드의 기본 크기를 물려받아 둘레보다 크게 그려지고 그 이유가 소스 어디에도 없다. 값은 sm·md·lg로 닫혀 있다 — 픽셀을 받으면 임의 스타일의 뒷문이 된다', ex: inlineRow(`${imgPh('thumb')}${tBody('박근로 · 대한기계')}`, { gap: 'lg' }) + stack(tSub('위에 여백이 붙은 블록'), { top: 'sm' }) },
  { cat: 'container', name: 'emptyState({title, body, action})', note: '목록이 비었을 때. 다음에 무엇을 할지 말한다 — 「없습니다」로 끝나면 읽는 사람이 할 일을 스스로 찾는다. 필터로 0건인 것과 아직 하나도 없는 것은 다른 화면이고 각각 프레임이다', ex: emptyState({ title: '아직 기록이 없습니다', body: '첫 기록을 만들면 여기에 표시합니다.', action: btn('추가', 'primary') }) },
  { cat: 'input', name: 'btn(text, variant)', note: "'' · primary · ghost · danger", ex: `${btn('발급 요청', 'primary')}${btn('임시 저장', 'ghost')}${btn('작업중지 발령', 'danger')}` },
  { cat: 'input', name: 'field({label, value, hint, select})', note: '라벨 + 입력칸. select는 ▾를 보인다', ex: field({ label: '작업 구역', value: 'A동 3층 배관실', select: true }) },
  { cat: 'input', name: 'fI18n({label, value, lang}) · fI18nArea({…})', note: '언어별로 값을 갖는 칸. 라벨 오른쪽이 화면 전체가 함께 움직이는 언어 선택기', ex: fI18n({ label: '위험요인 이름', value: '밀폐공간 산소결핍', lang: '한국어', required: true }) },
  { cat: 'input', name: 'cellInput({value, unit, bad})', note: '표 안에서 바로 고치는 칸. 빈 칸은 점선, 거절된 값은 강조색', ex: `<div class="table"><div class="trow"><span class="td">산소</span><span class="td">${cellInput({ value: '20.9', unit: '%' })}</span><span class="td">${cellInput({})}</span><span class="td">${cellInput({ value: '-1', bad: true })}</span></div></div>` },
  { cat: 'input', name: 'chip(text, active) · badge(text, variant)', note: '필터 칩 · 상태 배지(outline)', ex: `${chips([chip('전체', true), chip('진행'), chip('완료')])}${badges([badge('발급', 'outline'), badge('반납')])}` },
  { cat: 'input', name: 'chips(items, {note})', note: '칩 줄의 오른쪽 끝에 붙는 한 마디 — 어느 칩을 골랐느냐에 따라 달라지는 안내만 여기 놓는다. 칩 아래 한 줄을 더 쓰면 탭·칩·목록 사이에 블록이 끼는 것이라 그 자리는 없다', ex: `${chips([chip('전체'), chip('내보내기 DB', true), chip('API')], { note: '내보내기 DB는 방화벽을 이쪽에서 엽니다' })}` },
  { cat: 'container', name: 'helpCard({title, hint, open})', note: '엔티티 설명·생애주기가 사는 카드 — 누르면 다이얼로그로 펼친다. 목록 아래·목록·상세 위·상세 탭 머리 가운데 한 곳', ex: helpCard({ title: '위임과 대결은 어떻게 다른가', hint: '넘기는 사람 · 넘어가는 시점 · 기록에 남는 이름' }) },
  { cat: 'container', name: 'card({sub, body, pad})', note: "내용 카드. `pad: 'lg'`는 카드 여럿 가운데 하나가 아니라 그 자리의 내용 전체를 담는 상자 — 빈 상태·잠금 안내·읽기 전용 띠. 테두리 있는 상자가 필요할 때 표를 빌려 쓰지 않는다", ex: card({ sub: '오늘 작업', body: bar('w25') }) + card({ pad: 'lg', body: tTitle('아직 등록된 항목이 없습니다') + tSub('시작하는 방법이 셋입니다.') }) },
  { cat: 'container', name: 'listCard({thumb, lines, trail})', note: '섬네일이 붙는 목록 행', ex: listCard({ lines: `${bar('w60')}${bar('w40', true)}`, trail: badge('서명 대기', 'outline') }) },
  { cat: 'container', name: 'grid(n, children)', note: '카드 격자 — 2 · 3 · 4단', ex: grid(2, [card({ sub: '위험성평가', body: bar('w25') }), card({ sub: 'TBM', body: bar('w25') })]) },
  { cat: 'data', name: 'table({head, rows})', note: '자료 표. 열 폭은 w2/fix/right로 준다', ex: table({ head: ['<span class="td w2">작업</span>', '<span class="td">담당</span>', '<span class="td fix">상태</span>'], rows: [['<span class="td w2">' + bar('w80') + '</span>', '<span class="td">' + bar('w60', true) + '</span>', '<span class="td fix">' + badge('진행', 'outline') + '</span>']] }) },
  { cat: 'data', name: 'groupRow(label)', note: '표 안의 묶음 머리 — 아래 행들이 무엇에 속하는지 나타낸다', ex: table({ head: ['<span class="td w2">점검 항목</span>', '<span class="td right">주기</span>'], rows: [groupRow('화학물질관리법 제26조'), ['<span class="td w2">' + bar('w80') + '</span>', '<span class="td right">주 1회</span>']] }) },
  { cat: 'data', name: 'treeBar({total, expanded}) · treeTable({head, rows})', note: '계층이 곧 목록일 때 — 머리글이 있는 표이고 첫 열에 들여쓰기·캐럿·이름을 표시한다. 머리글 없는 트리는 이동 수단일 뿐이라 상태도 액션도 표시할 곳이 없고, 그러면 같은 레코드를 위에 표로 한 번 더 그리게 된다. 뒤의 열은 tight — 패널 옆에서 fix의 110px는 이름이 쓸 폭을 여백으로 쓴다', ex: `${treeBar({ total: '12개' })}${treeTable({ head: [th('구역', { w: 'w2' }), th('종류', { w: 'tight' }), th('', { w: 'tight' })], rows: [{ label: 'A동', depth: 0, open: true, count: 5, cells: [`<span class="td tight">${badge('Area', 'outline')}</span>`], actions: ['보기', '편집'] }, { label: 'A동 3층', depth: 1, open: true, count: 2, cells: [`<span class="td tight">${badge('Area', 'outline')}</span>`], actions: ['보기', '편집'] }, { label: '배관 밀폐공간', depth: 2, leaf: true, active: true, cells: [`<span class="td tight">${badge('SafetyZone')}</span>`], actions: ['보기', '편집'] }] })}` },
  { cat: 'data', name: 'pagination(pages, of)', note: '표 아래 쪽 넘김', ex: pagination(['1', '2', '3'], '12') },
  { cat: 'touch chrome', name: 'statusbar() · appbar() · tabbar()', note: '폰·태블릿: 상태 표시줄, 앱 바, 하단 탭', ex: `<div class="device" style="width:230px;border-radius:16px"><div class="screen">${statusbar()}${appbar({ title: '오늘', trail: badge('3') })}<div class="body">${bar('w60')}</div>${tabbar([{ label: '오늘', active: true }, { label: '서명', unread: 2 }, { label: '내 자격' }])}</div></div>` },
  { cat: 'touch chrome', name: 'offlineBar({queued, offline})', note: '근로자 앱 상시 표시 — 지금 어디에 저장되는지와 서버가 아직 못 받은 건수', ex: `${offlineBar({ queued: 0 })}${offlineBar({ queued: 4, offline: true })}` },
  { cat: 'desktop chrome', name: 'topNav({groups, site, unread})', note: '탭 다섯이 영역을 고른다. 사업장 선택기가 여기 있는 이유는 그 값이 화면 하나가 아니라 모든 숫자를 좌우하기 때문이다', ex: topNav({ site: '남부현장', unread: 3, groups: [[{ label: '대시보드' }], [{ label: '기준·서식', active: true }], [{ label: '안전 운영' }, { label: '인력·사고' }], [{ label: '증빙·분석' }]] }) },
  { cat: 'desktop chrome', name: 'sectionNav({title, groups, rail, flyout})', note: '접히는 2단 트리. 지금 화면이 든 가지만 펼친다. 회색 수는 몇 건인지, 강조 배지는 내가 처리할 게 몇 건인지 — 둘을 섞으면 없는 일을 찾아다닌다', ex: `<div style="display:flex;gap:10px;height:250px">${sectionNav({ title: '안전 운영', groups: [{ label: '안전 운영', open: true, items: [{ label: '작업일정', count: 128 }, { label: '작업허가', active: true, count: 31 }, { label: 'TBM', badge: 4 }, { label: '점검', count: 62 }] }, { label: '반복 의무·비상', items: [{ label: '의무 스케줄' }] }, { label: '건설 규제', locked: '라이선스', items: [{ label: '안전관리계획', locked: '라이선스' }] }] })}${sectionNav({ title: '안전 운영', rail: true, flyout: { label: '안전 운영', items: [{ label: '작업일정' }, { label: '작업허가', active: true }, { label: 'TBM' }] }, groups: [{ label: '안전 운영', items: [{ label: '작업허가', active: true }, { label: 'TBM', badge: 4 }] }, { label: '반복 의무·비상', items: [{ label: '의무 스케줄' }] }] })}</div>` },
  { cat: 'desktop chrome', name: 'statusBar({powered, ticker, segments, health}) · menuBar(groups)', note: '어느 화면에도 속하지 않는 정보 · 탭이 폭에 안 맞을 때 통째로 내려가는 줄', ex: `${statusBar({ powered: 'Powered by SimpleCORE Inc.', ticker: '작업중지 발령 · A동 3층 배관', segments: [{ label: '사업장 시간 KST · 주간조' }, { label: '제출 동기화 4건 대기', tone: 'warn' }, { label: '단말 3/4' }], health: { label: 'Smart Safety', tone: 'ok' } })}${menuBar([[{ label: '대시보드', active: true }], [{ label: '기준·서식' }, { label: '안전 운영' }]])}` },
  { cat: 'data', name: 'filterBar({total, applied, hidden, views, view}) · th(label, {dir})', note: '목록 위의 바 · 정렬 중인 열 머리글. 날짜에 놓이는 기록은 세그먼트가 목록·달력을 가르고, 걸린 필터는 보기를 바꿔도 그대로 남는다 — 그래서 전환이 페이지 머리가 아니라 이 바에 있다', ex: `${filterBar({ total: '31', applied: [{ k: '공종', op: '=', v: '배관' }], hidden: 2 })}${filterBar({ total: '84건', views: ['목록', '달력'], view: '달력', applied: [{ k: '월', op: '=', v: '2026-08' }] })}${table({ head: [th('작업', { w: 'w2' }), th('상태', { dir: 'desc' })], rows: [['<span class="td w2">' + bar('w80') + '</span>', '<span class="td">' + badge('진행', 'outline') + '</span>']] })}` },
  { cat: 'data', name: 'rowActions(actions, more)', note: '모든 줄에 전부·같은 자리·같은 개수. 못 쓰는 버튼은 지우지 않고 비활성으로 둔다 — 줄마다 달라지면 열을 눈으로 훑을 수 없다', ex: table({ head: [th('작업허가', { w: 'w2' }), th('상태', { w: 'fix' }), th('', { w: 'fix' })], rows: [['<span class="td w2">배관 용접</span>', `<span class="td fix">${badge('발급', 'outline')}</span>`, `<span class="td fix">${rowActions(['보기', '연장', '반납'], true)}</span>`], ['<span class="td w2">밀폐공간 청소</span>', `<span class="td fix">${badge('반납')}</span>`, `<span class="td fix">${rowActions(['보기', { label: '연장', disabled: true }, { label: '반납', disabled: true }], true)}</span>`]] }) },
  { cat: 'detail panel', name: 'tabs · section · dField · auditFoot · panelFoot', note: '패널의 탭 줄, 2단 필드 묶음, 필드 하나(peek는 다른 기록을 가리킨다), 감사줄, 동작 행', ex: `${tabs([{ label: '개요', active: true }, { label: '구역', count: 3 }])}${section('사업장', dField({ label: '상태', value: badge('운영 중', 'outline') }) + dField({ label: '사업장 코드', value: 'SITE-01' }) + dField({ label: '업종', value: '건설업', peek: true }) + dField({ label: '주소', value: bar('w80'), wide: true, top: true }))}${auditFoot({ id: 'a1b2…9z', at: '2026-01-04' }, '2026-07-12')}` },
  { cat: 'detail panel', name: 'sectHead(title)', note: '필드가 아닌 블록의 절 제목 — 레일·첨부·차트가 앞 절의 마지막 줄로 읽히지 않게 구분한다', ex: `${section('알림', dField({ label: '도달', value: '승격 2회 뒤 응답' }))}${sectHead('승격 내역')}${bar('w80')}${bar('w60', true)}` },
  { cat: 'detail panel', name: 'panelVerbs(actions) · panelFoot(actions)', note: '두 단 동작 행 — 윗단은 열린 탭이 요구하는 것, 아랫단은 레코드에 하는 것. 파괴적인 것은 위치가 아니라 색(danger)으로 구분한다', ex: `${panelVerbs(btn('구역 추가') + btn('가져오기') + btn('내보내기'))}${panelFoot(btn('닫기', 'ghost') + '<span class="spacer"></span>' + btn('삭제', 'danger') + btn('편집', 'primary'))}` },
  { cat: 'detail panel', name: 'panelForm({title, mode, children, foot})', note: '패널이 폼이 된 상태 — 엔티티의 등록·편집은 다이얼로그가 아니라 여기서 연다. 목록·필터·스크롤 위치가 그대로 남고, 폼이 모달 폭이 아니라 패널 폭으로 열린다', ex: panelForm({ title: '휴게시설 등록', children: formSection('', fText({ label: '이름', value: 'A동 1층 휴게시설', required: true }) + fSelect({ label: '구역', value: 'A동 1층', required: true })), foot: `${btn('취소', 'ghost')}<span class="spacer"></span>${btn('저장', 'primary')}` }) },
  { cat: 'detail panel', name: 'nestedRow({title, trail, sub})', note: '탭이 든 한 줄과 그 아래 딸린 줄들. sub가 비면 그 사실을 문장으로 적는다', ex: tabList(nestedRow({ title: '배관 용접', trail: badge('화재위험작업', 'outline') + btn('편집', 'ghost'), sub: [['통제조치', '화재감시자 배치 · 소화기 2대'], ['필요 자격', '용접기능사']] }) + nestedRow({ title: '개구부 점검', trail: badge('일반'), sub: '아직 위험요인이 등록되지 않았습니다' })) },
  { cat: 'detail panel', name: 'regionPh({label, ref}) · tabPanes({strip, open, ref, panes})', note: '탭 줄이 이름만 대고 안 그린 칸을 모아 두는 동반 프레임. 바탕의 두 열 구조를 그대로 지킨다 — 왼쪽은 목록 자리를 세운 regionPh, 오른쪽은 칸마다 [바탕의 탭 줄 + 칸 내용 + 윗단 동사]가 세로로 쌓인다. 탭 줄은 바탕이 내보낸 tabStrip을 그대로 부르므로 그림이 하나이고, 리터럴 tabs([…]) 선언이 아니라 캡처 요구도 바탕에서 한 번만 세어진다. 칸마다 프레임을 만들면 페이지를 그때마다 다시 그려야 하고 같은 목록이 여러 프레임에 산다. ref에는 프레임 번호가 아니라 화면 이름을 넣는다', ex: (() => { const strip = (open) => tabs([{ label: '개요', active: open === '개요' }, { label: '구역', count: 12, active: open === '구역' }, { label: '이력', count: 6, active: open === '이력' }]); return `<div class="device" style="width:760px"><div class="screen">${listDetail(regionPh({ label: '목록 열 — 바탕 프레임이 그립니다', ref: '사업장 상세' }), tabPanes({ strip, open: '개요', ref: '사업장 상세', panes: [{ label: '구역', verbs: btn('구역 추가'), body: table({ head: [th('구역', { w: 'w2' }), th('종류', { w: 'fix' })], rows: [['<span class="td w2">A동 3층</span>', `<span class="td fix">${badge('안전구역', 'outline')}</span>`]] }) }, { label: '이력', body: tSub('레코드 필드의 변경은 P-18이 열까지 정하므로 인용으로 끝난다 — 그런 칸은 그리지 않는다') }] }))}</div></div>`; })() },
  { cat: 'overlay', name: 'peekDialog({title, children})', note: '가리킨 기록을 그 자리에서 읽고, 나가는 길은 하나만 둔다', ex: `<div class="device" style="width:420px;height:210px"><div class="screen">${peekDialog({ title: '김현장 · 배관공', children: section('', dField({ label: '자격', value: badge('유효', 'outline') })) })}</div></div>` },
  { cat: 'layout', name: 'split(list, detail) · shell(sidebar, main)', note: '좌우 두 버전 · 앱 셸', ex: `<div class="device" style="width:360px"><div class="screen"><div class="split"><div class="pane list">${bar('w80')}${bar('w60', true)}</div><div class="pane">${tTitle('상세')}${bar('w40')}</div></div></div></div>` },
  { cat: 'layout', name: 'listDetail(list, detail) · panelHead(title)', note: '콘솔의 기본 — 목록 혼자, 또는 상세 패널 옆으로 좁아진 목록', ex: `<div class="device" style="width:520px"><div class="screen">${listDetail(`${bar('w80')}${bar('w60', true)}${bar('w40', true)}`, `${panelHead('A동 3층')}${bar('w60')}`)}</div></div>` },
  { cat: 'layout', name: 'pageNote(text)', note: '페이지 머리글 아래 한 줄. 다른 화면으로 건너가는 길을 안내한다', ex: pageNote('주기와 기한을 정하는 곳은 「보존 정책 설정」 화면입니다.<span class="peek">보존 정책으로</span>') },
  { cat: 'common state', name: 'sourceBadge(source, basis)', note: '적용값 옆에 붙어 무엇이 그 값을 정했는지 나타낸다 — 주기·기한·횟수·보존 기간이 나오는 모든 화면', ex: `<div class="table"><div class="trow"><span class="td">위험성평가 주기</span><span class="td">1년 ${sourceBadge('법정 기본', '고시 제2024-76호 제15조')}</span></div><div class="trow"><span class="td">TBM 주기</span><span class="td">매 작업일 ${sourceBadge('사업장 설정', '법정 기본 없음')}</span></div></div>` },
  { cat: 'common state', name: 'lockNote(basis, until)', note: '왜 못 고치는지와 언제까지인지. 잠긴 컨트롤만으로는 권한 문제인지 법인지 가려지지 않는다', ex: lockNote('산업안전보건법 제164조 ① — 3년 보존', '2029-03-14까지') },
  { cat: 'common state', name: 'envBadge(what)', note: '폐쇄망이라 못 쓰는 것. 「라이선스 미보유」와 반드시 구분한다 — 사지 못해 꺼진 것이 아니라 연결이 없어 꺼진 것이다', ex: `${envBadge('자동번역')}${envBadge('외부 타임스탬프')}` },
  { cat: 'overlay', name: 'sheet(children) · modal(children)', note: '아래에서 올라오는 시트(터치) · 가운데 모달(데스크톱)', ex: `<div class="device" style="width:230px;height:150px;border-radius:16px"><div class="screen">${sheet(`${tTitle('서명하시겠습니까')}${btn('서명', 'primary')}`)}</div></div>` },
  { cat: 'data', name: 'printSheet({title, children, size})', note: '인쇄되거나 내보내질 종이 한 장. 화면이 아니라 종이라서 용지가 함께 적힌다', ex: printSheet({ title: '작업허가서', size: 'A4 세로', children: `${bar('w80')}${bar('w100')}${bar('w60')}` }) },
  { cat: 'data', name: 'docViewer({sheet, pages, page, zoom, fit, langs, find, marks, note}) · viewerDialog({…})', note: '문서를 종이로 읽는 뷰어. 한 쪽을 한 크기로 그린 것은 미리 보기가 아니다 — 7쪽으로 갈 수도, 표가 잘리는 쪽이 어디인지 레일에서 볼 수도, 숫자를 확인할 만큼 키울 수도 없다. 뷰어는 읽는 법(쪽·배율·맞춤·찾기·그리는 언어)만 갖고, 무엇으로 만드는지(용지·여백·부수·인쇄할 언어)는 페이지나 출력 폼에 남는다', ex: docViewer({ pages: 11, page: 7, marks: [7, 9], size: 'A4 세로', margin: '20mm', status: '7쪽에서 표가 잘립니다', note: '「선임 명부」 표의 머리만 7쪽에 남습니다.', sheet: printSheet({ title: '안전보건관리규정', children: `${bar('w80')}${bar('w100')}${bar('w60')}${bar('w100')}` }) }) },
];

// ── figures ────────────────────────────────────────────────────────────────

/**
 * One number that is the whole answer, with what it should be read against.
 *
 * <p>A number alone is not a fact a person can act on: 12 is good or terrible depending on last
 * month, on the target, and on what the law requires. So a tile carries its comparison, and the
 * comparison is drawn — an arrow with no baseline is decoration.
 *
 * <p>**Not every measure deserves a tile.** A tile is for a figure somebody steers by; the rest
 * belong in a table where they can be read against their neighbours.
 *
 * @param basis what the value is measured against (지난달·목표·법정 기준)
 * @param tone '' · warn (past a threshold) · ok
 */
export const statTile = ({ label, value, unit = '', trend = '', basis = '', tone = '', spark = '' }) =>
  `<div class="stat${tone ? ' ' + tone : ''}">` +
  `<div class="st-label">${label}</div>` +
  `<div class="st-main">` +
  `<div class="st-num">` +
  `<div class="st-value">${value}${unit ? `<span class="st-unit">${unit}</span>` : ''}</div>` +
  `${trend ? `<div class="st-trend">${trend}</div>` : ''}</div>` +
  // The shape sits beside the number, not under it: the number is what is read, and a plot
  // across the card's whole width competes with it for the eye.
  `${spark ? sparkline(spark) : ''}</div>` +
  `${basis ? `<div class="st-basis">${basis}</div>` : ''}</div>`;

/**
 * The shape behind the number, inside the tile.
 *
 * <p>「지난달보다 5% 늘었다」 answers what changed between two points and hides everything between
 * them: a figure that fell for three weeks and jumped in the last two days reads the same as one
 * that climbed steadily, and only one of those is a problem. **A tile whose measure has a series
 * behind it carries that series** — where it does not (a count of what is true right now), it
 * carries none rather than a made-up one.
 *
 * <p>No axis, no gridlines, no labels: it is the shape, not a chart. The number above it is what
 * is read; this says whether that number is where it has been heading.
 *
 * @param kind line (a measure over time) · bars (counts per period)
 */
export const sparkline = (kind = 'line') =>
  kind === 'bars'
    ? `<div class="spark bars">${[40, 62, 48, 74, 58, 86, 70].map((h) => `<i style="height:${h}%"></i>`).join('')}</div>`
    : `<svg class="spark" viewBox="0 0 120 32" preserveAspectRatio="none">` +
      `<polyline points="0,26 20,22 40,24 60,14 80,17 100,8 120,6"/></svg>`;

/**
 * A chart's PLACE and its form — not its pixels.
 *
 * <p>The board fixes which question the figure answers, because that decides the form: change
 * over time is a line, magnitude across categories is a bar, parts of one whole is a stack,
 * progress toward a target is a bar with the target marked, a spread is a distribution. The
 * design system decides colour, type and motion; it does not get to decide that a trend is a pie.
 *
 * <p>Two rules ride along and are drawn here because they are broken so often: **one axis** —
 * two measures of different scale are two charts, never two y-scales on one — and **a legend
 * whenever there is more than one series**, since identity must never rest on colour alone.
 *
 * @param kind line · bar · stack · progress · dist
 */
/** `progress` draws ONE bar against a target. A legend of several series beside a single mark
 *  says the picture shows something it does not — comparing categories is `bar`, and parts of one
 *  whole is `stack`. The mismatch is invisible in a greybox, so the component refuses it. */
export const chartPh = ({ kind = 'line', title = '', legend = [], note = '', height = 132, goal = '목표 80%' }) => {
  if (kind === 'progress' && legend.length > 1) {
    throw new Error(`chartPh 「${title}」 — progress는 막대 하나인데 범례가 ${legend.length}개다 ` +
      `(항목 비교는 kind: 'bar', 한 전체의 부분은 kind: 'stack')`);
  }
  return chartBody({ kind, title, legend, note, height, goal });
};

const chartBody = ({ kind, title, legend, note, height, goal }) => {
  const body = {
    line: `<svg viewBox="0 0 300 100" preserveAspectRatio="none" class="cv">` +
      `<polyline points="0,78 40,66 80,70 120,48 160,52 200,32 240,38 300,20"/>` +
      `<polyline class="dim" points="0,88 40,84 80,86 120,74 160,78 200,66 240,70 300,58"/></svg>`,
    bar: `<div class="cbars">${[58, 74, 46, 88, 62, 70, 40].map((h) => `<i style="height:${h}%"></i>`).join('')}</div>`,
    stack: `<div class="cbars stack">${[[40, 34], [52, 26], [30, 44], [62, 22], [46, 30]]
      .map(([a, b]) => `<i style="height:${a}%"><b style="height:${b}%"></b></i>`).join('')}</div>`,
    progress: `<div class="cprog"><span style="width:62%"></span><em style="left:80%">${goal}</em></div>`,
    dist: `<div class="cbars dist">${[12, 28, 54, 82, 66, 34, 16, 8].map((h) => `<i style="height:${h}%"></i>`).join('')}</div>`,
  }[kind];
  return `<div class="chart">` +
    `${title ? `<div class="ch-title">${title}</div>` : ''}` +
    `<div class="ch-plot" style="height:${height}px">${body}</div>` +
    `${legend.length ? `<div class="ch-legend">${legend.map((l, i) =>
      `<span class="lg"><i class="k${i}"></i>${l}</span>`).join('')}</div>` : ''}` +
    `${note ? `<div class="ch-note">${note}</div>` : ''}</div>`;
};

// ── patterns that need a shape of their own ────────────────────────────────

/**
 * A month a person plans work in. Not a picture of dates — a surface things are put on.
 *
 * <p>What a day cell must carry is decided by what people come here to answer: is anything
 * running, does anything need me, and is this day workable at all. So a cell shows the count,
 * the two or three that matter by name, and whether the day is a holiday or a shift the site
 * does not run — a plan made onto a day nobody works is the failure this prevents.
 *
 * @param days `[{n, marks:[{label, tone}], today, off, more}]`
 */
/** The keys a calendar and a day understand. A call written with `month`/`today`/`marks` at the
 *  top level — the shape a person expects — renders the weekday strip and an EMPTY grid: the
 *  content was written, nothing drew, and every check upstream passes because the markup is
 *  balanced and no value leaked. So the component refuses instead, and the build names the file. */
const CAL_KEYS = new Set(['month', 'head', 'days']);
const CAL_DAY_KEYS = new Set(['n', 'today', 'off', 'marks', 'more']);

/** A month grid with no way to reach the next month is a filter the reader cannot honour: the bar
 *  above it says 「연도 = 2026」 and the grid draws one of the twelve. So the month names itself and
 *  carries the two steps, and 「이번 달」 returns to the month today falls in. */
export const calendar = (opts) => {
  const stray = Object.keys(opts).filter((k) => !CAL_KEYS.has(k));
  if (stray.length) {
    throw new Error(`calendar — 모르는 키 ${stray.join(', ')} ` +
      `(쓸 수 있는 키: ${[...CAL_KEYS].join(', ')}; 날짜는 days: [{ n, today, off, marks, more }])`);
  }
  const { month = '', head = ['월', '화', '수', '목', '금', '토', '일'], days = [] } = opts;
  for (const d of days) {
    const bad = Object.keys(d).filter((k) => !CAL_DAY_KEYS.has(k));
    if (bad.length) throw new Error(`calendar day 「${d.n}」 — 모르는 키 ${bad.join(', ')}`);
  }
  return `<div class="cal">` +
  (month ? `<div class="cal-nav"><span class="cn-step">‹</span><span class="cn-month">${month}</span>` +
    `<span class="cn-step">›</span><span class="spacer"></span><span class="cn-today">이번 달</span></div>` : '') +
  `<div class="cal-head">${head.map((h) => `<span>${h}</span>`).join('')}</div>` +
  `<div class="cal-grid">${days.map((d) =>
    `<div class="cal-day${d.today ? ' today' : ''}${d.off ? ' off' : ''}">` +
    `<span class="cd-n">${d.n}</span>` +
    (d.marks ?? []).map((m) => `<span class="cd-mark${m.tone ? ' ' + m.tone : ''}">${m.label}</span>`).join('') +
    (d.more ? `<span class="cd-more">외 ${d.more}건</span>` : '') +
    `</div>`).join('')}</div></div>`;
};

/**
 * A grid typed into rather than read: risk frequency × severity, role × permission,
 * language × field.
 *
 * <p>**The axes are named on the grid, not above it.** A matrix whose meaning lives in a
 * paragraph is a matrix people fill in wrong. Where the cell value carries a rule — a score
 * that crosses into 「높음」, a permission that grants more than the role above it — the rule is
 * drawn in the cell, because that is where the decision is made.
 *
 * <p>**Where the row axis is a hierarchy, the hierarchy lives in this grid rather than in a tree
 * above it.** A tree of tasks and their hazards drawn over a hazard × control matrix says the same
 * names twice and asks the reader to carry a row from one picture into the other; the empty cell
 * they came to find is in the second, and which task owns it is in the first. `depth` indents a
 * row and `group` draws a band naming what the rows under it belong to.
 *
 * @param rows `[{label, depth, badge, cells}]`, or `{group}` for a band across the whole width
 */
export const matrix = ({ corner = '', cols = [], rows = [] }) =>
  `<div class="mx"><div class="mx-row mx-head"><span class="mx-cell mx-corner">${corner}</span>` +
  cols.map((c) => `<span class="mx-cell">${c}</span>`).join('') + `</div>` +
  rows.map((r) => (r.group
    ? `<div class="mx-row mx-band"><span class="mx-cell mx-label">${r.group}</span></div>`
    : `<div class="mx-row"><span class="mx-cell mx-label">` +
      `${r.depth ? `<span class="mx-in" style="width:${r.depth * 14}px"></span>` : ''}` +
      `${r.label}${r.badge ? badge(r.badge, 'outline') : ''}</span>` +
      r.cells.map((c) => `<span class="mx-cell${c.tone ? ' ' + c.tone : ''}">${c.v ?? ''}</span>`).join('') +
      `</div>`)).join('') + `</div>`;

/**
 * Where a record is in a chain of signatures, and who it is waiting on.
 *
 * <p>Three questions, always answered together: which step it is at, **who** that step belongs
 * to, and what happens next. A progress bar answers only the first, and the person who needs to
 * chase somebody is left to find out who by asking.
 *
 * @param steps `[{label, who, at, state}]` — done · now · wait · reject
 */
export const approvalFlow = (steps) =>
  `<div class="aflow">${steps.map((s) =>
    `<div class="af-step ${s.state}">` +
    `<span class="af-mark">${s.state === 'done' ? '✔' : s.state === 'reject' ? '✖' : ''}</span>` +
    `<span class="af-body"><span class="af-label">${s.label}</span>` +
    `<span class="af-who">${s.who}</span>` +
    `${s.at ? `<span class="af-at">${s.at}</span>` : ''}</span></div>`).join('')}</div>`;

/**
 * The rail of a multi-step setup, and the only place its shape is written.
 *
 * <p>A row of separate pills reads as a set of choices, and a wizard is not one — it is an order.
 * So the steps are joined by a line, solid up to where the reader has got to and dashed after, and
 * how far along they are can be seen without counting. `now` is 1-based.
 */
export const steps = (labels, now) =>
  `<div class="setup-steps">${labels.map((label, i) => {
    const n = i + 1;
    const mark = n < now ? ' done' : n === now ? ' now' : '';
    return `<span class="sstep${mark}"><span class="sno">${n < now ? '✔' : n}</span>${label}</span>`;
  }).join('')}</div>`;

/** A tree the reader edits: areas inside a site, tasks under a work type. */
export const tree = (nodes) =>
  `<div class="tree">${nodes.map((n) =>
    `<div class="tr-node${n.active ? ' active' : ''}" style="padding-left:${8 + n.depth * 20}px">` +
    `<span class="tr-car">${n.leaf ? '' : n.open ? '⌄' : '›'}</span>` +
    `<span class="ic"></span><span class="tr-label">${n.label}</span>` +
    `${n.badge ? `<span class="badge outline">${n.badge}</span>` : ''}` +
    `${n.count != null ? `<span class="sn-count">${n.count}</span>` : ''}</div>`).join('')}</div>`;

/**
 * What was attached, as evidence rather than as files.
 *
 * <p>A photo taken on site is worth nothing to an inspector without when and where it was taken,
 * and a signature is worth nothing without who signed and on what. So each item carries its
 * provenance beside it, and the ones that failed to upload say so rather than disappearing.
 *
 * @param items `[{kind, label, meta, failed}]` — photo · file · sign
 */
export const attachGrid = (items) =>
  `<div class="attach">${items.map((it) =>
    `<div class="at-item${it.failed ? ' failed' : ''}">` +
    (it.kind === 'sign' ? `<div class="at-sign">서명</div>` : `<div class="at-thumb"></div>`) +
    `<div class="at-body"><div class="at-label">${it.label}</div>` +
    `<div class="at-meta">${it.meta}</div></div></div>`).join('')}</div>`;

/** One search hit: where it was found, the words around it, and what it belongs to. */
export const hit = ({ title, snippet, meta }) =>
  `<div class="hit"><div class="hit-title">${title}</div>` +
  `<div class="hit-snip">${snippet}</div><div class="hit-meta">${meta}</div></div>`;

/**
 * A record's lifecycle as one rail: a state-toned dot per stage, a line down to the next, and
 * the detail each stage carries hanging off it.
 *
 * <p>**A rail is not a prettier list.** What it adds is that the reader sees, without counting,
 * how far along the thing is and what is left — the line between two dots is the claim that one
 * follows the other, which a stack of cards does not make.
 *
 * <p>**A lane forks beside it** for a process that runs inside one stage — an approval chain
 * under 「승인」, a screening under 「접수」. It is tied back to the rail by its elbows, so it reads
 * as part of that stage rather than as a stage of its own. Nesting the whole chain into the main
 * rail instead would say those steps are stages, and then a rejected approval would look like a
 * lifecycle that went backwards.
 *
 * <p>Four states and each one is a different fact: `done` it happened, `active` it is happening
 * now, `pending` it has not started, `skip` **it will never run** — a cancelled visit's check-in
 * is not pending forever, and drawing it as pending leaves a reader waiting for it.
 *
 * @param nodes `[{label, state, trail, body, lane}]`; `lane` is `{title, body}`
 */
/** The keys a rail node understands. A node carrying anything else lost that content silently —
 *  it was written, it rendered nothing, and no check upstream could see the difference. So the
 *  component refuses instead, and the build stops with the file name. */
const JOURNEY_KEYS = new Set(['label', 'trail', 'body', 'lane', 'state']);

export const journey = (nodes) =>
  `<div class="jn">${nodes.map((n, i) => {
    const stray = Object.keys(n).filter((k) => !JOURNEY_KEYS.has(k));
    if (stray.length) {
      throw new Error(`journey node 「${n.label}」 — 모르는 키 ${stray.join(', ')} ` +
        `(쓸 수 있는 키: ${[...JOURNEY_KEYS].join(', ')})`);
    }
    // The last stage draws no line down — there is nothing after it. But a lane hanging off that
    // last stage ties back to the rail with two elbows, and with no line to meet they ended in
    // empty space: the fork read as a block that had come loose from the rail. So the line is
    // drawn when the node has a lane, and stops at the node's own floor rather than reaching on.
    const last = i === nodes.length - 1;
    return `<div class="jn-node ${n.state ?? 'pending'}${n.lane ? ' has-lane' : ''}">` +
    `<div class="jn-rail"><span class="jn-dot"></span>` +
    `${!last || n.lane ? '<span class="jn-line"></span>' : ''}</div>` +
    `<div class="jn-body">` +
    `<div class="jn-head"><span class="jn-label">${n.label}</span>` +
    `${n.trail ? `<span class="jn-trail">${n.trail}</span>` : ''}</div>` +
    `${n.body ? `<div class="jn-rows">${n.body}</div>` : ''}` +
    `${n.lane ? `<div class="jn-lane"><span class="jn-tie t"></span><span class="jn-tie b"></span>` +
      `<div class="jn-lane-t">${n.lane.title}</div>${n.lane.body}</div>` : ''}` +
    `</div></div>`;
  }).join('')}</div>`;

/**
 * A drawing worked on rather than looked at: a floor plan with things placed on it, a topology,
 * a zone drawn over a photo.
 *
 * <p>Four regions and none is optional. The **toolbar** says which tool is in hand, because a
 * canvas with no mode indicator leaves a reader clicking to find out. The **palette** holds what
 * can be placed. The **canvas** carries the drawing and what is on it. The **property panel**
 * edits what is selected — putting those fields in a dialog would hide the very thing being
 * positioned.
 *
 * <p>A minimap belongs where the drawing is bigger than the window, which for a floor plan it
 * always is.
 *
 * <p>**What is not on the drawing yet belongs in the palette, not in a table under it.** The
 * palette's subject already is "what can be placed", so a second list beneath the canvas counts
 * the same absence a second time and pushes the drawing — the thing being worked on — up out of
 * reach. A sectioned palette carries them where they are dragged from: `palette` takes plain
 * strings, or `{title, count, items}` sections whose items may be `{label, note, tone}`.
 *
 * @param actions controls that act on the whole drawing rather than picking a tool — they ride
 *   the right of the toolbar, beside the zoom, because they are not modes
 */
const palItem = (it) => {
  const o = typeof it === 'string' ? { label: it } : it;
  return `<div class="cvs-pi${o.tone ? ' ' + o.tone : ''}"><span class="ic"></span>` +
    `<span class="cvs-pi-b"><span class="cvs-pi-l">${o.label}</span>` +
    `${o.note ? `<span class="cvs-pi-n">${o.note}</span>` : ''}</span></div>`;
};

export const canvasPh = ({ tools = [], palette = [], marks = [], selected = '', panel = '', minimap = true, actions = [] }) => {
  const grouped = palette.some((p) => typeof p === 'object' && Array.isArray(p.items));
  return `<div class="cvs">` +
  `<div class="cvs-bar">${tools.map((t, i) =>
    `<span class="cvs-tool${i === 0 ? ' active' : ''}">${t}</span>`).join('')}` +
  `<span class="spacer"></span>` +
  actions.map((a) => `<span class="cvs-act">${a}</span>`).join('') +
  `<span class="cvs-zoom">100%</span></div>` +
  `<div class="cvs-main">` +
  `<div class="cvs-pal${grouped ? ' grouped' : ''}">${palette.map((p) =>
    (typeof p === 'object' && Array.isArray(p.items)
      ? `<div class="cvs-pg"><span class="cvs-pg-t">${p.title}</span>` +
        `${p.count != null ? `<span class="cvs-pg-n">${p.count}</span>` : ''}</div>` +
        p.items.map(palItem).join('')
      : palItem(p))).join('')}</div>` +
  `<div class="cvs-stage">` +
  marks.map((m) => `<span class="cvs-mark${m.sel ? ' sel' : ''}" ` +
    `style="left:${m.x}%;top:${m.y}%">${m.label}</span>`).join('') +
  (minimap ? `<span class="cvs-mini"></span>` : '') +
  `</div>` +
  (panel ? `<div class="cvs-prop"><div class="cvs-prop-t">${selected}</div>${panel}</div>` : '') +
  `</div></div>`;
};

/**
 * The manual read beside the screen it explains, in the panel the 도움말 control opens.
 *
 * <p>A page is five sections and the reader arrived with one question, so what they need first
 * is which of the five answers it — and the panel is too narrow to give that list a column, so
 * it sits across the top.
 *
 * <p>`fallback` is said when the page does not exist in the reader's language. An operator
 * working in Korean who is handed English gets no explanation from the prose itself; it simply
 * is not their language, which reads as a defect rather than as a missing translation.
 */
export const manualPanel = ({ title, toc = [], active = 0, fallback = '', children }) =>
  `<div class="man"><div class="man-head"><span class="ph-title sm">${title}</span>` +
  `<span class="ld-close">✖</span></div>` +
  `<div class="man-toc">${toc.map((s, i) =>
    `<span class="man-ti${i === active ? ' active' : ''}">${s}</span>`).join('')}</div>` +
  (fallback ? `<div class="man-fb">${fallback}</div>` : '') +
  `<div class="man-body">${children}</div></div>`;
