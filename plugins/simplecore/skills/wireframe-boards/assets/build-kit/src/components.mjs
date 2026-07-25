// Content and chrome components — the reusable primitives a screen body is composed
// FROM. Each maps to a class in styles.css (the same greybox vocabulary the single-
// file board-template.html teaches), so a screen file calls these instead of hand-
// writing HTML and the vocabulary stays consistent. Every component registers an
// example in CATALOG (bottom); catalog.mjs renders it into a storybook. Add a
// component here → it appears in the catalog. Replace example copy with your domain's.

const cls = (base, variant) => (variant ? `${base} ${variant}` : base);

// ── content primitives ─────────────────────────────────────────────────────
export const tTitle = (t) => `<div class="t-title">${t}</div>`;
export const tSub = (t) => `<div class="t-sub">${t}</div>`;
export const tBody = (t) => `<div class="t-body">${t}</div>`;
export const divider = () => `<hr class="divider">`;
export const bar = (w = 'w60', light = false) => `<div class="bar${light ? ' light' : ''} ${w}"></div>`;
export const imgPh = (extra = '') => `<div class="img-ph${extra ? ' ' + extra : ''}"></div>`;
export const qrPh = (label = 'QR') => `<div class="qr-ph"><span>${label}</span></div>`;
export const btn = (text, variant = '') => `<div class="${cls('btn', variant)}">${text}</div>`; // ''·primary·ghost
export const chip = (text, active = false) => `<span class="chip${active ? ' active' : ''}">${text}</span>`;
export const badge = (text, variant = '') => `<span class="${cls('badge', variant)}">${text}</span>`; // ''·outline
export const chips = (items) => `<div class="chips">${items.join('')}</div>`;
export const badges = (items) => `<div class="badges">${items.join('')}</div>`;

export function field({ label, value, hint, select = false }) {
  const input = value != null ? `<span class="input">${value}${select ? ' <span>▾</span>' : ''}</span>` : `<span class="input">input</span>`;
  return `<div class="field"><span class="label">${label}</span>${input}${hint ? `<span class="t-sub">${hint}</span>` : ''}</div>`;
}
export function card({ sub, body }) {
  return `<div class="card">${sub ? tSub(sub) : ''}${body}</div>`;
}
export function listCard({ thumb = true, lines, trail }) {
  return `<div class="list-card">${thumb ? imgPh('thumb') : ''}<div class="lines">${lines}</div>${trail || ''}</div>`;
}
export const grid = (n, children) => `<div class="grid-${n}">${children.join('')}</div>`;

// table({head:['REQUEST','OWNER'], rows:[[...], ...]}). Cells are raw HTML; size with
// classes on the cell string (w2/fix/right) by wrapping: `<span class="td fix">…</span>`
// is produced for you when a cell is a plain string; pass pre-classed cells as-is.
export function table({ head, rows }) {
  const th = `<div class="trow thead">${head.map((h) => (h.startsWith('<span') ? h : `<span class="td">${h}</span>`)).join('')}</div>`;
  const body = rows.map((r) => `<div class="trow">${r.map((c) => (c.startsWith('<span') ? c : `<span class="td">${c}</span>`)).join('')}</div>`).join('');
  return `<div class="table">${th}${body}</div>`;
}
export const pagination = (pages, of) => `<div class="pagination">${pages.map((p, i) => `<span class="pg${i === 0 ? ' active' : ''}">${p}</span>`).join('')}${of ? `<span>of ${of}</span>` : ''}</div>`;

// ── touch chrome (phone / tablet) ───────────────────────────────────────────
export const statusbar = () => `<div class="statusbar"><span>9:41</span><span>▮▮ ⏻</span></div>`;
export const appbar = ({ back = false, title, trail }) => `<div class="appbar">${back ? '<span class="back">←</span> ' : ''}${title}${trail ? `<span class="trail">${trail}</span>` : ''}</div>`;
export const bodyCol = (children) => `<div class="body">${children}</div>`;
export const cta = (children) => `<div class="cta">${children}</div>`;
export const tabbar = (tabs) => `<div class="tabbar">${tabs.map((t) => `<div class="tab${t.active ? ' active' : ''}"><div class="ic"></div>${t.label}</div>`).join('')}</div>`;

// ── desktop chrome ──────────────────────────────────────────────────────────
export const browserbar = (url) => `<div class="browserbar"><span class="dots"><i></i><i></i><i></i></span><span class="url">${url}</span></div>`;
// sidebarNav({brand, groups:[{group, items:[{label,active}]}], rail})
export function sidebarNav({ brand, groups, rail = false }) {
  const g = groups.map(({ group, items }) =>
    `${rail ? '' : `<div class="nav-group">${group}</div>`}` +
    items.map((it) => `<div class="nav-item${it.active ? ' active' : ''}"><span class="ic"></span><span>${it.label}</span></div>`).join('')
  ).join('');
  return `<div class="sidebar${rail ? ' rail' : ''}">${brand && !rail ? `<div class="brand">${brand}</div>` : ''}${g}</div>`;
}
export const topbar = ({ search = 'Search…', right = '' }) => `<div class="topbar"><span class="input search">${search}</span><span class="spacer"></span>${right}<span class="avatar"></span></div>`;
export const crumb = (t) => `<div class="crumb">${t}</div>`;
export const toolbar = ({ title, actions = '' }) => `<div class="toolbar"><span class="t-title">${title}</span>${actions ? `<span class="actions">${actions}</span>` : ''}</div>`;
export const shell = (sidebarHtml, mainHtml) => `<div class="shell">${sidebarHtml}<div class="main">${mainHtml}</div></div>`;

// ── master-detail & overlays ────────────────────────────────────────────────
export const split = (listHtml, detailHtml) => `<div class="split"><div class="pane list">${listHtml}</div><div class="pane">${detailHtml}</div></div>`;
export const sheet = (children) => `<div class="dim"></div><div class="sheet">${children}</div>`;
export const modal = (children) => `<div class="dim"></div><div class="modal">${children}</div>`;

// ── component catalog (self-registering storybook) ──────────────────────────
export const CATALOG = [
  { cat: 'text & placeholder', name: 't-title · t-sub · t-body', note: 'real copy: titles, guidance, body', ex: `${tTitle('Welcome back')}${tSub('Sign in to continue.')}` },
  { cat: 'text & placeholder', name: 'bar(width, light)', note: 'placeholder text line — w25/w40/w60/w80/w100', ex: `${bar('w80')}${bar('w40', true)}` },
  { cat: 'text & placeholder', name: 'imgPh() · qrPh(label)', note: 'image placeholder (X) · QR/barcode placeholder', ex: `<div style="display:flex;gap:10px">${imgPh('thumb')}${qrPh('QR')}</div>` },
  { cat: 'input', name: 'btn(text, variant)', note: "'' · primary · ghost", ex: `${btn('Sign in', 'primary')}${btn('Create an account', 'ghost')}` },
  { cat: 'input', name: 'field({label, value, hint, select})', note: 'label + input; select shows ▾', ex: field({ label: 'Email', value: 'name@example.com' }) },
  { cat: 'input', name: 'chip(text, active) · badge(text, variant)', note: 'filter chip · status badge (outline)', ex: `${chips([chip('All', true), chip('Open'), chip('Done')])}${badges([badge('Open', 'outline'), badge('Done')])}` },
  { cat: 'container', name: 'card({sub, body})', note: 'content card', ex: card({ sub: 'Pending', body: bar('w25') }) },
  { cat: 'container', name: 'listCard({thumb, lines, trail})', note: 'list row with thumbnail', ex: listCard({ lines: `${bar('w60')}${bar('w40', true)}`, trail: badge('Open', 'outline') }) },
  { cat: 'container', name: 'grid(n, children)', note: 'card grid — 2 · 3 · 4 columns', ex: grid(2, [card({ sub: 'A', body: bar('w25') }), card({ sub: 'B', body: bar('w25') })]) },
  { cat: 'data', name: 'table({head, rows})', note: 'data table; size cells with w2/fix/right', ex: table({ head: ['<span class="td w2">REQUEST</span>', '<span class="td">OWNER</span>', '<span class="td fix">STATUS</span>'], rows: [['<span class="td w2">' + bar('w80') + '</span>', '<span class="td">' + bar('w60', true) + '</span>', '<span class="td fix">' + badge('Open', 'outline') + '</span>']] }) },
  { cat: 'data', name: 'pagination(pages, of)', note: 'page controls under a table', ex: pagination(['1', '2', '3'], '12') },
  { cat: 'touch chrome', name: 'statusbar() · appbar() · tabbar()', note: 'phone/tablet: status bar (notch), app bar, bottom tabs', ex: `<div class="device" style="width:230px;border-radius:16px"><div class="screen">${statusbar()}${appbar({ title: 'Home', trail: badge('3 new') })}<div class="body">${bar('w60')}</div>${tabbar([{ label: 'Home', active: true }, { label: 'Requests' }, { label: 'Profile' }])}</div></div>` },
  { cat: 'desktop chrome', name: 'browserbar · sidebarNav · topbar · toolbar · shell', note: 'browser bar, left nav (+rail), top bar, breadcrumb+actions', ex: `${browserbar('app.example.com/console')}${toolbar({ title: 'Console', actions: btn('New', 'primary') })}` },
  { cat: 'layout', name: 'split(list, detail) · shell(sidebar, main)', note: 'master-detail panes · app shell', ex: `<div class="device" style="width:360px"><div class="screen"><div class="split"><div class="pane list">${bar('w80')}${bar('w60', true)}</div><div class="pane">${tTitle('Detail')}${bar('w40')}</div></div></div></div>` },
  { cat: 'overlay', name: 'sheet(children) · modal(children)', note: 'bottom sheet (touch) · centered modal (desktop)', ex: `<div class="device" style="width:230px;height:150px;border-radius:16px"><div class="screen">${sheet(`${tTitle('Confirm')}${btn('OK', 'primary')}`)}</div></div>` },
];
