// penstock-console — the composition kit every board drawn in this pattern composes from.
//
// A fixed application window: title bar, navigator, work pane, inspector, status bar, each pane
// scrolling inside itself. The primitives here are pure — a screen body is built FROM them. The
// pieces that carry a product's own words (its brand, its navigation tree, its palette, its status
// bar, its sample activity) are bound once per board by `makeChrome` in `chrome.mjs`, and a board's
// `src/chrome.mjs` is where those words live.
//
// Every component registers an example in CATALOG (bottom); `node wf.mjs catalog` renders it into a
// storybook. Add a component here → it appears in the catalog. Sample copy in the examples is
// placeholder text, replaced by each board's own domain.

const cls = (base, variant) => (variant ? `${base} ${variant}` : base)

// ── content primitives ─────────────────────────────────────────────────────
export const tTitle = (t) => `<div class="t-title">${t}</div>`
export const tSub = (t) => `<div class="t-sub">${t}</div>`
export const tBody = (t) => `<div class="t-body">${t}</div>`
export const divider = () => `<hr class="divider">`
export const bar = (w = 'w60', light = false) =>
  `<div class="bar${light ? ' light' : ''} ${w}"></div>`
export const imgPh = (extra = '') => `<div class="img-ph${extra ? ' ' + extra : ''}"></div>`
export const qrPh = (label = 'QR') => `<div class="qr-ph"><span>${label}</span></div>`
export const btn = (text, variant = '') => `<div class="${cls('btn', variant)}">${text}</div>` // ''·primary·ghost
export const chip = (text, active = false) =>
  `<span class="chip${active ? ' active' : ''}">${text}</span>`
export const badge = (text, variant = '') => `<span class="${cls('badge', variant)}">${text}</span>` // ''·outline
export const chips = (items) => `<div class="chips">${items.join('')}</div>`
export const badges = (items) => `<div class="badges">${items.join('')}</div>`

// `error` puts the message under the field it belongs to. A validation message in a
// toast is gone before the reader looks up from the input that caused it.
// `value` is what somebody CHOSE or typed; `placeholder` is the example standing in an empty box.
// The two are different states of the same field and a frame that draws one for the other is a
// contract nobody can build to — a wizard's address box is empty when its step opens, because the
// address is the thing being asked for.
export function field({ label, value, hint, select = false, error, placeholder }) {
  const input =
    value != null
      ? `<span class="input">${value}${select ? ' <span>▾</span>' : ''}</span>`
      : placeholder != null
        ? `<span class="input"><span class="ph">${placeholder}</span>${select ? ' <span>▾</span>' : ''}</span>`
        : `<span class="input">input</span>`
  return (
    `<div class="field${error ? ' bad' : ''}"><span class="label">${label}</span>${input}` +
    `${error ? `<span class="fielderr">${error}</span>` : ''}${hint ? `<span class="t-sub">${hint}</span>` : ''}</div>`
  )
}
export function card({ sub, body }) {
  return `<div class="card">${sub ? tSub(sub) : ''}${body}</div>`
}
export function listCard({ thumb = true, lines, trail }) {
  return `<div class="list-card">${thumb ? imgPh('thumb') : ''}<div class="lines">${lines}</div>${trail || ''}</div>`
}
export const grid = (n, children) => `<div class="grid-${n}">${children.join('')}</div>`

// table({head:['REQUEST','OWNER'], rows:[[...], ...]}). Cells are raw HTML; size with
// classes on the cell string (w2/fix/right) by wrapping: `<span class="td fix">…</span>`
// is produced for you when a cell is a plain string; pass pre-classed cells as-is.
export function table({ head, rows }) {
  const th = `<div class="trow thead">${head.map((h) => (h.startsWith('<span') ? h : `<span class="td">${h}</span>`)).join('')}</div>`
  const body = rows
    .map(
      (r) =>
        `<div class="trow">${r.map((c) => (c.startsWith('<span') ? c : `<span class="td">${c}</span>`)).join('')}</div>`
    )
    .join('')
  return `<div class="table">${th}${body}</div>`
}
export const pagination = (pages, of) =>
  `<div class="pagination">${pages.map((p, i) => `<span class="pg${i === 0 ? ' active' : ''}">${p}</span>`).join('')}${of ? `<span>총 ${of}쪽</span>` : ''}</div>`

// ── touch chrome (phone / tablet) ───────────────────────────────────────────
export const statusbar = () => `<div class="statusbar"><span>9:41</span><span>▮▮ ⏻</span></div>`
export const appbar = ({ back = false, title, trail }) =>
  `<div class="appbar">${back ? '<span class="back">←</span> ' : ''}${title}${trail ? `<span class="trail">${trail}</span>` : ''}</div>`
export const bodyCol = (children) => `<div class="body">${children}</div>`
export const cta = (children) => `<div class="cta">${children}</div>`
export const tabbar = (tabs) =>
  `<div class="tabbar">${tabs.map((t) => `<div class="tab${t.active ? ' active' : ''}"><div class="ic"></div>${t.label}</div>`).join('')}</div>`

// ── desktop chrome ──────────────────────────────────────────────────────────

/**
 * The window a desktop frame is drawn in.
 *
 * **The kit's device shell draws exactly one primitive, and this is it** — `frame()` hands every
 * desktop frame its `url` and asks this function for the chrome above `.screen`. Three windows
 * are needed here and the address is what tells them apart, because the address is the only thing
 * the shell passes through:
 *
 * - `app.example.com/…`  a browser tab, which is what all but three frames are
 * - `app:<title>`        the installed program's own window — no address bar, because the shell
 *                        picks its own port and the reader never sees a URL
 * - `none:`              no window at all: the tray menu is drawn against the desktop
 *
 * A screen says which by writing the scheme in front of its address, so a reader of the screen
 * file sees the window kind on the same line as the address rather than in a second field.
 */
export const browserbar = (url) => {
  if (url === 'none:') return ''
  if (url.startsWith('app:')) return appwindow(url.slice(4))
  return `<div class="browserbar"><span class="dots"><i></i><i></i><i></i></span><span class="url">${url}</span></div>`
}

/**
 * A native application window rather than a browser tab. The desktop build ships as an
 * installed program, and drawing it with an address bar would tell the reader to expect a
 * URL they never see — the shell picks its own port and opens its own window.
 */
export const appwindow = (title) =>
  `<div class="appwindow"><span class="dots"><i></i><i></i><i></i></span><span class="wt">${title}</span></div>`

/**
 * The tray menu. What a resident program shows when its window is closed: enough state to
 * know whether it is working, and a way back in. Drawn against the desktop rather than
 * inside a window, because that is where it appears.
 */
export const trayMenu = ({ title, rows, actions }) =>
  `<div class="traywrap"><div class="traymenu"><div class="tm-t">${title}</div>` +
  rows
    .map(([k, v]) => `<div class="tm-r"><span>${k}</span><span class="v">${v}</span></div>`)
    .join('') +
  `<div class="tm-sep"></div>${actions.map((a) => `<div class="tm-a">${a}</div>`).join('')}</div></div>`
// sidebarNav({brand, groups:[{group, items:[{label,active}]}], rail})
export function sidebarNav({ brand, groups, rail = false }) {
  const g = groups
    .map(
      ({ group, items }) =>
        `${rail ? '' : `<div class="nav-group">${group}</div>`}` +
        items
          .map(
            (it) =>
              `<div class="nav-item${it.active ? ' active' : ''}"><span class="ic"></span><span>${it.label}</span></div>`
          )
          .join('')
    )
    .join('')
  return `<div class="sidebar${rail ? ' rail' : ''}">${brand && !rail ? `<div class="brand">${brand}</div>` : ''}${g}</div>`
}
export const topbar = ({ search = 'Search…', right = '' }) =>
  `<div class="topbar"><span class="input search">${search}</span><span class="spacer"></span>${right}<span class="avatar"></span></div>`
export const crumb = (t) => `<div class="crumb">${t}</div>`
export const toolbar = ({ title, actions = '' }) =>
  `<div class="toolbar"><span class="t-title">${title}</span>${actions ? `<span class="actions">${actions}</span>` : ''}</div>`
export const shell = (sidebarHtml, mainHtml) =>
  `<div class="shell">${sidebarHtml}<div class="main">${mainHtml}</div></div>`

// ── master-detail & overlays ────────────────────────────────────────────────
export const split = (listHtml, detailHtml) =>
  `<div class="split"><div class="pane list">${listHtml}</div><div class="pane">${detailHtml}</div></div>`
export const sheet = (children) => `<div class="dim"></div><div class="sheet">${children}</div>`
// `wide` is for a dialog whose body is a comparison across every choice rather than a form: three
// parser columns beside their capability names do not fit 460px, and squeezing them wraps every
// row label to four lines. A form never takes it — a wide field is harder to read, not easier.
export const modal = (children, size = '') =>
  `<div class="dim"></div><div class="modal${size ? ' ' + size : ''}">${children}</div>`

// ── app shell ───────────────────────────────────────────────────────────────
// The window is fixed and each pane scrolls inside itself, so the chrome is
// defined once here and every screen composes its work/inspection body only.



/**
 * The notification bell. Screen notifications need somewhere to arrive, and that place has
 * to be on every screen — an inbox reachable only from settings is an inbox nobody opens.
 * The count is what a person scans for, so it sits in the mark rather than beside it.
 */
export const bell = (unread = 0) =>
  `<span class="tb-chip bell${unread ? ' on' : ''}">☉${unread ? ` ${unread}` : ''}</span>`


/** A collapsed pane keeps a rail so the toggle stays discoverable. */
export const navRail = () =>
  `<div class="prail"><span class="ic"></span><span class="vlabel">탐색</span></div>`
export const inspRail = () =>
  `<div class="prail right"><span class="ic"></span><span class="vlabel">검사</span></div>`



export const workPane = ({ toolbar: tb, body, flush = false }) =>
  `<div class="pane work">${tb ? `<div class="toolbar">${tb}</div>` : ''}<div class="pane-body${flush ? ' flush' : ''} scrolls">${body}</div></div>`
export const workToolbar = ({ title, count, actions }) =>
  `<span class="vtitle">${title}</span>${count ? `<span class="vcount">${count}</span>` : ''}${actions ? `<span class="actions">${actions}</span>` : ''}`



export const appStatus = ({ left = [], right = '' }) =>
  `<div class="appstatus"><div class="sbl">${left.map((s) => `<span class="seg${s.alert ? ' alert' : ''}">${s.t}</span>`).join('')}</div>` +
  `<div class="sbr"><span class="seg">${right}</span></div></div>`



// ── shared signals (health dot, stat tile, inline banner, key-value) ────────
export const hdot = (level = 'ok') => `<span class="hdot ${level}"></span>` // ok·warn·bad·off
export const stat = ({ k, v, hint }) =>
  `<div class="stat"><span class="k">${k}</span><span class="v">${v}</span>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`
export const banner = ({ dot = 'warn', text, actions }) =>
  `<div class="banner"><span class="dot ${dot}"></span><span>${text}</span>${actions ? `<span class="actions">${actions}</span>` : ''}</div>`
export const kv = (rows) =>
  `<div class="kv">${rows.map(([k, v]) => `<div class="r"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}</div>`
export const hint = (t) => `<div class="hint">${t}</div>`
export const sticky = (t) => `<div class="sticky">${t}</div>`
export const search = (t = '검색') => `<span class="input search">${t}</span>`

// ── answer, confidence, evidence ────────────────────────────────────────────
// A generated answer is shown sentence by sentence, because confidence is judged
// per sentence — not per answer. `grade` is ok | part | none.
export const GRADE_LABEL = { ok: '뒷받침됨', part: '일부만', none: '근거 없음' }
export function sentence({ text, grade = 'ok', refs = [], active = false }) {
  const marks = refs.map((r) => `<span class="ref">${r}</span>`).join('')
  return `<div class="sent ${grade}${active ? ' active' : ''}"><span class="gr">${GRADE_LABEL[grade]}</span><span class="tx">${text}</span>${marks}</div>`
}

// Where a piece of evidence came from decides how deep it can be traced back.
export const TIER_LABEL = {
  doc: '내부 문서',
  data: '내부 데이터',
  tool: '외부 도구',
  sum: '묶음 요약',
  page: '쪽 그림',
}
export const tier = (t) => `<span class="tier ${t}">${TIER_LABEL[t]}</span>`
export const scorebar = (pct) =>
  `<span class="scorebar"><span class="fill" style="width:${pct}%"></span></span><span class="scorenum">${pct}</span>`

/** One evidence row in the right-hand list. `n` is the citation number the answer refers to. */
/**
 * One evidence card.
 *
 * `meta` is optional, and its absence draws no row at all. A card whose subject may not say how
 * much material stands behind it — a community summary, where the count itself tells a reader
 * the size of what their scope hides — passes no meta, and the line has to vanish rather than
 * print the missing value as a label.
 */
export function evidence({
  n,
  t = 'doc',
  title,
  meta,
  score,
  masked = false,
  // Whether this card's material carries a sentence addressed to the model (14.6 · C-10).
  //
  // On the card and not only in the passage, because the list is what a reader scans: told that an
  // answer leaned on such a sentence, the card is where they find out WHICH of four it was. The
  // mark is solid like `masked`, never the dashed AI mark — one is somebody else's file giving an
  // order and the other is this product proposing something.
  planted: hasPlanted = false,
  active = false,
}) {
  const tags = [masked ? maskedTag() : '', hasPlanted ? planted() : ''].filter(Boolean).join(' ')
  const tail = tags ? (meta ? ' ' : '') + tags : ''
  const foot = meta || tags ? `\n  <div class="ev-meta">${meta ?? ''}${tail}</div>` : ''
  return `<div class="ev-card${active ? ' active' : ''}">
  <div class="ev-top"><span class="ev-n">${n}</span>${tier(t)}<span class="grow"></span>${score != null ? scorebar(score) : ''}</div>
  <div class="ev-title">${title}</div>${foot}
</div>`
}

// ── source viewer (markdown ⇄ PDF on the same block model) ──────────────────
/**
 * The two faces of one part. The console names them by their formats, because an operator
 * reviewing a parse is looking at exactly those; the asking screens name them 글 · 쪽, because
 * a reader has no word for markdown and half the material they cite was never a PDF at all.
 */
export const viewSwitch = (active = 'md', text = '마크다운', page = 'PDF') =>
  `<span class="vswitch"><span class="opt${active === 'md' ? ' on' : ''}">${text}</span><span class="opt${active === 'pdf' ? ' on' : ''}">${page}</span></span>`

/** Markdown side: blocks in reading order; `active` is the block the evidence points at. */
export function mdBlocks(blocks) {
  return `<div class="mdview">${blocks
    .map(
      (b) =>
        `<div class="mdb${b.active ? ' active' : ''}${b.masked ? ' masked' : ''}">${b.kind ? `<span class="bk">${b.kind}</span>` : ''}${b.body}</div>`
    )
    .join('')}</div>`
}

/** PDF side: a page with absolutely-placed boxes — the same block coordinates. */
export function pdfPage({ page = 1, of = 1, boxes = [] }) {
  const rects = boxes
    .map(
      (b) =>
        `<span class="hl${b.masked ? ' mask' : ''}${b.active ? ' active' : ''}" style="left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%"></span>`
    )
    .join('')
  return `<div class="pdfview"><div class="pdfpage">${rects}</div><div class="pdfbar"><span>${page} / ${of} 쪽</span><span class="grow"></span><span class="tb-btn">−</span><span class="tb-btn">+</span></div></div>`
}

// ── iterative search rounds ─────────────────────────────────────────────────
/**
 * One round of the search loop: what it asked, what it found, what it judged missing.
 * `verdict` is ok | part | none | run — `run` is the round in flight, which the reader
 * watches while the answer is still being written.
 */
const ROUND_LABEL = { ...GRADE_LABEL, run: '찾는 중' }
export function round({ n, question, found, verdict = 'part', done = false, next = '' }) {
  return `<div class="round ${verdict}">
  <div class="rd-top"><span class="rd-n">${n}회차</span><span class="rd-v">${done ? '채워짐' : ROUND_LABEL[verdict]}</span></div>
  <div class="rd-q">${question}</div>
  ${found ? `<div class="rd-f">${found}</div>` : ''}
  ${next ? `<div class="rd-f">다음에 묻기로 한 것 · ${next}</div>` : ''}
</div>`
}

// ── knowledge graph canvas (rendered with sigma.js in the product) ──────────
export const graphCanvas = (note = '지식 그래프 · WebGL 캔버스') =>
  `<div class="graphview"><span class="gnote">${note}</span></div>`

// ── sensitive values ────────────────────────────────────────────────────────
export const maskedTag = () => `<span class="masked">가려짐</span>`
export const maskedValue = (kind) => `<span class="maskval">${kind} ●●●●●●</span>`

// ── pipeline progress ───────────────────────────────────────────────────────
/**
 * stages: [{label, state}] where state is done | run | wait | fail.
 * Six stages do not fit a 340px inspector on one line, so `vertical` stacks them
 * there; a wrapped stage row reads as two pipelines rather than one.
 */
export function stages(list, vertical = false) {
  return `<div class="stages${vertical ? ' v' : ''}">${list
    .map((s) => `<span class="stg ${s.state}"><span class="sdot"></span>${s.label}</span>`)
    .join(vertical ? '' : '<span class="sarr">→</span>')}</div>`
}
export const progress = (pct) =>
  `<span class="prog"><span class="fill" style="width:${pct}%"></span></span>`

// ── workspace panes (answer · source · evidence) ────────────────────────────
// Three panes at 1440; at 1024 the evidence pane folds into a tab beside the
// source, so `tri` takes two panes as well and the widths follow.
export const tri = (a, b, c) =>
  `<div class="tri"><div class="tp answer">${a}</div><div class="tp source">${b}</div>` +
  `${c ? `<div class="tp evid">${c}</div>` : ''}</div>`
export const paneHead = (title, trail = '') =>
  `<div class="pane-head">${title}<span class="grow"></span>${trail}</div>`
export const tabs = (items) =>
  `<div class="tabs">${items.map((t) => `<span class="tb${t.active ? ' on' : ''}">${t.label}</span>`).join('')}</div>`

export const centerPage = ({ width = 'sm', top = false, children }) =>
  `<div class="centerpage${top ? ' top' : ''}"><div class="cwrap ${width}">${children}</div></div>`

/**
 * Two columns inside one pane — a tree beside its list, a form beside its preview.
 * Only in the WORK pane. The inspector is 340px and a modal 460px, and neither holds two
 * columns: the left one alone is 224px (320px when `wide`), so the right one overflows.
 */
export const paneSplit = (left, right, wide = false) =>
  `<div class="psplit"><div class="pl${wide ? ' wide' : ''}">${left}</div><div class="pr">${right}</div></div>`

/**
 * A folder tree. nodes: [{depth, label, count, on, open}] — `open` draws the twisty,
 * `depth` is drawn as indent so a deep node is not a taller node.
 */
export const tree = (nodes) =>
  `<div class="tree">${nodes
    .map(
      (n) =>
        `<div class="tnode${n.on ? ' on' : ''}" style="padding-left:${6 + n.depth * 14}px">` +
        `<span class="tw">${n.open === undefined ? '' : n.open ? '▾' : '▸'}</span>` +
        `<span class="ic"></span><span>${n.label}</span>` +
        `${n.count != null ? `<span class="cnt">${n.count}</span>` : ''}</div>`
    )
    .join('')}</div>`

/** Nothing here yet — say what the space is for and what to do first, then stop. */
export const emptyState = ({ title, body, actions }) =>
  `<div class="empty">${tTitle(title)}${body ? tSub(body) : ''}${actions ? `<div class="actions">${actions}</div>` : ''}</div>`

/** A question the reader can take as written — the answer to "what do I ask this?" */
export const suggest = (items) =>
  items
    .map((one) => (typeof one === 'string' ? { q: one } : one))
    .map(
      ({ q, from }) =>
        `<div class="suggest"><span class="qm">질문</span><span>${q}</span></div>` +
        (from ? `<div class="suggest-from">${from}</div>` : '')
    )
    .join('')

/** An inline row inside a frame. Never the class `row` — that one is the board's own. */
export const hrow = (children) => `<div class="hrow">${children}</div>`

/**
 * A labelled set of choices, shown as chips rather than a dropdown. Used where every
 * option has to be visible at once — a scope the reader is about to search under is
 * not something to discover by opening a menu.
 * options: [{label, on}]
 */
export const choice = ({ label, options, hint: h }) =>
  `<div class="field"><span class="label">${label}</span>` +
  chips(options.map((o) => chip(o.label, !!o.on))) +
  `${h ? `<span class="t-sub">${h}</span>` : ''}</div>`

/** The ask surface with nothing asked yet: one box, the scope beside it. */
export const askBox = ({ placeholder = '무엇이든 물어보세요', left = '', right = '' }) =>
  `<div class="askbox"><span class="ph">${placeholder}</span>` +
  hrow(`${left}<span class="grow"></span>${right}`) +
  `</div>`

// ── AI assistance mark ──────────────────────────────────────────────────────
/**
 * Marks anything the product PROPOSES rather than knows. Every assisted feature carries
 * it, so a reader can tell a suggestion from a fact without reading the sentence — and so
 * the places that deliberately have NO assistance (permissions, audit reasons, licence
 * gates) are visibly different rather than merely unbuilt.
 * Never coloured: the board's one accent belongs to connectors, pins, folds and OPEN.
 */
export const ai = (label = 'AI') => `<span class="ai"><span class="gl">◈</span>${label}</span>`

/** A block whose whole content is a proposal — carries the mark at its top-left. */
export const aiBox = (children, label = 'AI 추천') =>
  `<div class="aibox">${ai(label)}${children}</div>`

/**
 * Marks a sentence inside a document that speaks TO the model instead of about the subject.
 * Solid rather than dotted so it never reads as the AI mark: one is the product proposing,
 * the other is somebody else's file trying to give orders.
 */
export const planted = (label = '자료 속 지시') =>
  `<span class="planted"><span class="gl">⚠</span>${label}</span>`

// ── validity periods ────────────────────────────────────────────────────────
/**
 * One fact's periods laid on a single track. A value that changed is not two conflicting
 * facts; it is one fact with two periods, and only a track shows that at a glance — in a
 * list the two rows read as a defect. spans: [{label, from, to, left, width, on, open}]
 * where left/width are percentages of the track and `open` leaves the right edge unbounded.
 */
export const timeline = (spans) =>
  `<div class="tline">${spans
    .map(
      (s) =>
        `<div class="tl-row${s.on ? ' on' : ''}">` +
        `<span class="tl-lb">${s.label}</span>` +
        `<span class="tl-tr"><span class="tl-sp${s.open ? ' open' : ''}" style="left:${s.left}%;width:${s.width}%"></span></span>` +
        `<span class="tl-pd">${s.from} ~ ${s.to}</span></div>`
    )
    .join('')}</div>`

// ── verbatim text ───────────────────────────────────────────────────────────
/** What was sent, or what came back, shown as it was. `out` marks the response side. */
export const snippet = (text, out = false) =>
  `<div class="snippet${out ? ' out' : ''}">${text}</div>`

/**
 * The one region allowed to scroll sideways: content genuinely wider than the pane
 * holding it, such as a table with more columns than fit. The scrollbar is pinned on
 * so the region does not read as ending at the pane's edge.
 */
export const scrollX = (children) => `<div class="scroll-x">${children}</div>`

/** A figure cited as evidence — the picture and the caption travel together. */
export const figure = ({ caption, meta }) =>
  `<div class="card">${imgPh()}${caption ? tBody(caption) : ''}${meta ? tSub(meta) : ''}</div>`

// ── conversation ────────────────────────────────────────────────────────────
/** The reader's own question, sitting in a thread above the answer it produced. */
export const userTurn = (text) => `<div class="uturn">${text}</div>`
/** An earlier turn, collapsed to one line: context for the question being asked now. */
export const qturn = ({ q, a, meta }) =>
  `<div class="qturn"><span class="qq">${q}</span><span class="qa">${a}</span>${meta ? `<span class="qm">${meta}</span>` : ''}</div>`
/** What the follow-up carried over, stated rather than left for the reader to infer. */
export const carry = (items) =>
  `<div class="carry"><span>이어받음</span>${items.map((t) => chip(t)).join('')}</div>`

// ── a granted unmask ────────────────────────────────────────────────────────
/** Step-up authentication expires. The remaining time is the point of showing it. */
export const grant = ({ text, left }) =>
  `<div class="grant"><span>${text}</span><span class="left">${left}</span></div>`

// ── component catalog (self-registering storybook) ──────────────────────────
// ── measurement placeholders (charts, level bars, countdowns) ───────────────
/**
 * A chart stands in for data the product draws from a series: a bar chart of counts, a line of a
 * value over time, a histogram of levels. The board says WHICH chart and WHAT it plots — the shape
 * and the label — and never the numbers, so a reviewer judges whether the chart belongs and what it
 * is called, not its values. `kind` is bar · line · hist.
 *
 * **Drawn as a shape rather than as a hatch.** A placeholder has to be recognisable as the chart it
 * stands for: a crossed box reads as a picture that failed to load, and a reviewer cannot tell a
 * trend that belongs on the screen from one that does not. The geometry is inline SVG — no file, no
 * font, nothing fetched — and the values in it are arbitrary on purpose.
 */
const CHART_SHAPE = {
  bar: '<g fill="currentColor" opacity=".5">' +
    [12, 30, 20, 38, 26, 16, 33, 22].map((h, i) => `<rect x="${3 + i * 12}" y="${40 - h}" width="8" height="${h}" rx="1"/>`).join('') +
    '</g>',
  line: '<polyline fill="none" stroke="currentColor" stroke-width="1.6" opacity=".55" stroke-linejoin="round" ' +
    'points="2,30 14,22 26,26 38,14 50,18 62,9 74,16 86,7 98,12"/>' +
    '<polyline fill="none" stroke="currentColor" stroke-width="1.2" opacity=".28" stroke-dasharray="3 3" ' +
    'points="2,36 14,33 26,35 38,28 50,31 62,24 74,29 86,23 98,26"/>',
  hist: '<g fill="currentColor" opacity=".45">' +
    [6, 11, 18, 27, 34, 38, 31, 22, 14, 8].map((h, i) => `<rect x="${2 + i * 10}" y="${40 - h}" width="7" height="${h}"/>`).join('') +
    '</g>',
};

export const chartPh = ({ kind = 'bar', label = '', h = 120 }) =>
  `<div class="chart-ph ${kind}" style="height:${h}px">${label ? `<span class="lbl">${label}</span>` : ''}` +
  `<svg class="glyph" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">${CHART_SHAPE[kind] ?? CHART_SHAPE.bar}</svg></div>`

/**
 * Level bars: one row per named quantity with how full it is. A toner set, a tray, a buffer —
 * anything read as 「how much is left」. `items` are `{ k, pct, v }`; `v` is the text after the bar
 * and defaults to the percentage. Below `low` the bar is drawn hollow so a reviewer sees the
 * threshold the product acts on without a second colour.
 */
export const levels = (items, low = 20) =>
  `<div class="levels">${items
    .map(
      ({ k, pct, v }) =>
        `<div class="lv${pct <= low ? ' low' : ''}"><span class="lv-k">${k}</span><span class="lv-bar"><span class="fill" style="width:${pct}%"></span></span><span class="lv-v">${v ?? pct + '%'}</span></div>`
    )
    .join('')}</div>`

/**
 * A countdown cell: time until something the product expects — the next report, the next poll.
 * `late` is the state after the moment passed with nothing arriving, which is what an operator
 * scans a table for, so it is drawn heavier rather than in a colour.
 */
export const countdown = (text, late = false) => `<span class="countdown${late ? ' late' : ''}">${late ? '지연 · ' : ''}${text}</span>`

export const CATALOG = [
  {
    name: 'chartPh({kind, label, h}) · levels(items, low) · countdown(text, late)',
    ex: `${chartPh({ kind: 'line', label: '평균 잔량 추이', h: 80 })}<div style="margin-top:8px">${levels([
      { k: '검정', pct: 62 }, { k: '파랑', pct: 18 }, { k: '빨강', pct: 44 }, { k: '노랑', pct: 71 },
    ])}</div><div style="margin-top:8px">${countdown('12초')} ${countdown('30초', true)}</div>`,
  },
  {
    cat: 'text & placeholder',
    name: 't-title · t-sub · t-body',
    note: 'real copy: titles, guidance, body',
    ex: `${tTitle('Welcome back')}${tSub('Sign in to continue.')}`,
  },
  {
    cat: 'text & placeholder',
    name: 'bar(width, light)',
    note: 'placeholder text line — w25/w40/w60/w80/w100',
    ex: `${bar('w80')}${bar('w40', true)}`,
  },
  {
    cat: 'text & placeholder',
    name: 'imgPh() · qrPh(label)',
    note: 'image placeholder (X) · QR/barcode placeholder',
    ex: `<div style="display:flex;gap:10px">${imgPh('thumb')}${qrPh('QR')}</div>`,
  },
  {
    cat: 'input',
    name: 'btn(text, variant)',
    note: "'' · primary · ghost",
    ex: `${btn('Sign in', 'primary')}${btn('Create an account', 'ghost')}`,
  },
  {
    cat: 'input',
    name: 'field({label, value, hint, select})',
    note: 'label + input; select shows ▾',
    ex: field({ label: 'Email', value: 'name@example.com' }),
  },
  {
    cat: 'input',
    name: 'chip(text, active) · badge(text, variant)',
    note: 'filter chip · status badge (outline)',
    ex: `${chips([chip('All', true), chip('Open'), chip('Done')])}${badges([badge('Open', 'outline'), badge('Done')])}`,
  },
  {
    cat: 'container',
    name: 'card({sub, body})',
    note: 'content card',
    ex: card({ sub: 'Pending', body: bar('w25') }),
  },
  {
    cat: 'container',
    name: 'listCard({thumb, lines, trail})',
    note: 'list row with thumbnail',
    ex: listCard({ lines: `${bar('w60')}${bar('w40', true)}`, trail: badge('Open', 'outline') }),
  },
  {
    cat: 'container',
    name: 'grid(n, children)',
    note: 'card grid — 2 · 3 · 4 columns',
    ex: grid(2, [card({ sub: 'A', body: bar('w25') }), card({ sub: 'B', body: bar('w25') })]),
  },
  {
    cat: 'data',
    name: 'table({head, rows})',
    note: 'data table; size cells with w2/fix/right',
    ex: table({
      head: [
        '<span class="td w2">REQUEST</span>',
        '<span class="td">OWNER</span>',
        '<span class="td fix">STATUS</span>',
      ],
      rows: [
        [
          '<span class="td w2">' + bar('w80') + '</span>',
          '<span class="td">' + bar('w60', true) + '</span>',
          '<span class="td fix">' + badge('Open', 'outline') + '</span>',
        ],
      ],
    }),
  },
  {
    cat: 'data',
    name: 'pagination(pages, of)',
    note: 'page controls under a table',
    ex: pagination(['1', '2', '3'], '12'),
  },
  {
    cat: 'touch chrome',
    name: 'statusbar() · appbar() · tabbar()',
    note: 'phone/tablet: status bar (notch), app bar, bottom tabs',
    ex: `<div class="device" style="width:230px;border-radius:16px"><div class="screen">${statusbar()}${appbar({ title: 'Home', trail: badge('3 new') })}<div class="body">${bar('w60')}</div>${tabbar([{ label: 'Home', active: true }, { label: 'Requests' }, { label: 'Profile' }])}</div></div>`,
  },
  {
    cat: 'desktop chrome',
    name: 'browserbar · sidebarNav · topbar · toolbar · shell',
    note: 'browser bar, left nav (+rail), top bar, breadcrumb+actions',
    ex: `${browserbar('app.example.com/console')}${toolbar({ title: 'Console', actions: btn('New', 'primary') })}`,
  },
  {
    cat: 'layout',
    name: 'split(list, detail) · shell(sidebar, main)',
    note: 'master-detail panes · app shell',
    ex: `<div class="device" style="width:360px"><div class="screen"><div class="split"><div class="pane list">${bar('w80')}${bar('w60', true)}</div><div class="pane">${tTitle('Detail')}${bar('w40')}</div></div></div></div>`,
  },
  {
    cat: 'overlay',
    name: 'sheet(children) · modal(children)',
    note: 'bottom sheet (touch) · centered modal (desktop)',
    ex: `<div class="device" style="width:230px;height:150px;border-radius:16px"><div class="screen">${sheet(
      `${tTitle('확인')}${btn('확인', 'primary')}`
    )}</div></div>`,
  },

  {
    cat: '신호',
    name: 'hdot(level) · stat({k,v,hint}) · banner({dot,text})',
    note: '건강 점 · KPI 타일 · 인라인 알림',
    ex: `${hdot('ok')} ${hdot('warn')} ${hdot('bad')} ${hdot('off')}${grid(3, [stat({ k: '처리 완료', v: '21', hint: '문서' }), stat({ k: '처리 중', v: '2' }), stat({ k: '실패', v: '1', hint: '확인 필요' })])}${banner({ dot: 'warn', text: '<b>상한에 걸려 멈췄습니다</b> · 3회차까지 찾은 결과입니다', actions: btn('더 찾기', 'ghost') })}`,
  },
  {
    cat: '신뢰도·근거',
    name: 'sentence({text, grade, refs})',
    note: '답변 문장 하나 + 신뢰도 등급 · ok·part·none',
    ex: `${sentence({ text: '적정공기는 산소농도 18퍼센트 이상 23.5퍼센트 미만입니다.', grade: 'ok', refs: [1, 2] })}${sentence({ text: '불활성화가 진행되는 동안에는 농도를 계속 감시하는 것으로 보입니다.', grade: 'part', refs: [2] })}${sentence({ text: '측정 간격은 확인되지 않았습니다.', grade: 'none' })}`,
  },
  {
    cat: '신뢰도·근거',
    name: 'evidence({n, t, title, meta, score, masked})',
    note: '근거 카드 · 출처 등급 doc·data·tool',
    ex: `${evidence({ n: 1, t: 'doc', title: '밀폐공간 작업프로그램 수립 및 시행에 관한 기술지원규정.pdf', meta: '6쪽 · 적정공기 정의', score: 92, active: true })}${evidence({ n: 3, t: 'data', title: '조회 · 시험 주기를 넘긴 안전밸브', meta: '3행 · 실행 0.4초', score: 71 })}${evidence({ n: 5, t: 'tool', title: '사내 설비관리시스템', meta: '제품 밖 · 2건 응답', score: 44, masked: true })}`,
  },
  {
    cat: '원본 보기',
    name: 'viewSwitch · mdBlocks · pdfPage',
    note: '마크다운 ⇄ PDF 전환 · 같은 블록 좌표를 공유',
    ex: `${viewSwitch('md')}<div style="display:flex;gap:10px;margin-top:8px">${mdBlocks([
      { kind: '제목', body: bar('w60') },
      { kind: '문단', body: bar('w100') + bar('w80'), active: true },
      { kind: '표', body: bar('w100'), masked: true },
    ])}${pdfPage({
      page: 4,
      of: 26,
      boxes: [
        { x: 8, y: 12, w: 60, h: 5 },
        { x: 8, y: 26, w: 84, h: 12, active: true },
        { x: 8, y: 62, w: 40, h: 6, masked: true },
      ],
    })}</div>`,
  },
  {
    cat: '탐색',
    name: 'round({n, question, found, verdict, done, next})',
    note: '스스로 넓혀 가는 탐색의 한 회차. next는 그 회차가 다음에 묻기로 한 것이고, 다음 회차의 질문과 같다',
    ex: `${round({ n: 1, question: '탱크에 들어가기 전에 산소 농도를 얼마로 확인하나?', found: '근거 4건 · 새 근거 4건 · 문장 2/3 뒷받침', verdict: 'part', next: '탱크 청소·치환이 정한 값은 어디에 있는가?' })}${round({ n: 2, question: '탱크 청소·치환이 정한 값은 어디에 있는가?', found: '근거 2건 추가 · 새 근거 2건', verdict: 'ok', done: true })}`,
  },
  {
    cat: '그래프·민감정보',
    name: 'graphCanvas(note) · maskedValue(kind) · maskedTag()',
    note: 'sigma.js 캔버스 자리 · 가려진 값',
    ex: `${graphCanvas()}<div style="margin-top:8px">${maskedValue('주민등록번호')} ${maskedTag()}</div>`,
  },
  {
    cat: '진행',
    name: 'stages(list) · progress(pct)',
    note: '처리 단계 · done·run·wait·fail',
    ex: `${stages([
      { label: '변환', state: 'done' },
      { label: '파싱', state: 'done' },
      { label: '민감정보', state: 'run' },
      { label: '색인', state: 'wait' },
    ])}<div style="margin-top:8px">${progress(62)}</div>`,
  },
  {
    cat: '레이아웃',
    name: 'tri(answer, source, evidence) · paneHead(title, trail)',
    note: '답변·원본·근거 3분할 — 묻기 화면의 중심',
    ex: `<div class="device" style="width:520px"><div class="screen">${tri(paneHead('답변') + `<div class="pane-body">${bar('w80')}</div>`, paneHead('원본', viewSwitch('md')) + `<div class="pane-body">${bar('w100')}</div>`, paneHead('근거 3건') + `<div class="pane-body">${bar('w60')}</div>`)}</div></div>`,
  },
  {
    cat: '진입',
    name: 'centerPage({width, top})',
    note: '패널 없는 한 칸짜리 화면 — 로그인·프로젝트 고르기',
    ex: `<div class="device" style="width:340px;height:190px"><div class="screen">${centerPage({ children: card({ body: field({ label: '아이디', value: 'name@example.com' }) + btn('로그인', 'primary') }) })}</div></div>`,
  },
  {
    cat: 'container',
    name: 'tree(nodes)',
    note: '폴더 트리 — depth는 들여쓰기로, open은 ▾/▸',
    ex: tree([
      { depth: 0, label: '전체', count: 25, open: true, on: true },
      { depth: 1, label: '해외 표준', count: 3, open: false },
      { depth: 1, label: '기술기준', count: 22, open: true },
      { depth: 2, label: '08 작업안전', count: 4 },
    ]),
  },
  {
    cat: '진입',
    name: 'emptyState({title, body, actions}) · suggest(items)',
    note: '아직 아무것도 없을 때 · 그대로 물어볼 수 있는 제안 질문',
    ex: `${emptyState({ title: '올린 자료가 없습니다', body: '문서를 올리면 자료 정리가 시작되고, 끝나면 질문할 수 있습니다.', actions: btn('문서 올리기', 'primary') })}<div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">${suggest(['탱크에 들어가기 전에 산소 농도를 얼마로 확인하나요?', '설비를 바꾼 뒤 시운전 전에 무엇을 확인하나요?'])}</div>`,
  },
  {
    cat: '진입',
    name: 'askBox({placeholder, left, right}) · hrow(children)',
    note: '아무것도 묻지 않은 묻기 화면의 입력 상자 · 프레임 안 가로 줄(클래스 row는 보드 것이라 쓰지 않는다)',
    ex: askBox({
      left: chips([chip('범위 · 전체'), chip('적극성 · 기본')]),
      right: btn('묻기', 'primary'),
    }),
  },
  {
    cat: 'input',
    name: 'choice({label, options, hint})',
    note: '선택지를 전부 펼쳐 보이는 라벨 + 칩 묶음',
    ex: choice({
      label: '찾아보는 정도',
      options: [{ label: '빠르게' }, { label: '기본', on: true }, { label: '깊게' }],
      hint: '이 질문에만 적용됩니다.',
    }),
  },
  {
    cat: 'AI 지원',
    name: 'ai(label) · aiBox(children, label)',
    note: '제품이 아는 것이 아니라 제안하는 것에 붙인다 · 색이 아니라 점선 테두리로 구분',
    ex: `${ai()} ${ai('AI 추천')} ${ai('AI 진단')}<div style="margin-top:8px">${aiBox(`${tSub('이렇게 물으면 찾을 수 있습니다')}${suggest(['화기작업 허가서에 반드시 적어야 하는 항목이 뭔가요?'])}`)}</div>`,
  },
  {
    cat: '근거 되짚기',
    name: 'snippet(text, out)',
    note: '보낸 질의·받은 응답·실행된 쿼리문을 그대로',
    ex: `${snippet('SELECT v.tag_no, i.tested_on\n  FROM relief_valve v\n  JOIN inspection i ON i.equip_id = v.equip_id\n WHERE v.site_cd = :site_cd')}${snippet('{"results": 3, "elapsed_ms": 312}', true)}`,
  },
  {
    cat: '근거 되짚기',
    name: 'scrollX(children) · figure({caption, meta})',
    note: '패널보다 넓은 표만 옆으로 스크롤 · 그림 근거는 그림과 설명이 함께',
    ex: `${figure({ caption: '그림 2. 파열판과 안전밸브의 직렬설치', meta: '안전밸브와 파열판 직렬설치에 관한 기술지원규정.pdf · 7쪽' })}`,
  },
  {
    cat: '대화',
    name: 'qturn({q, a, meta}) · carry(items) · userTurn(text)',
    note: '앞 대화의 한 차례(접힘) · 이어받은 것 · 대화 전체 보기의 질문 한 줄',
    ex: `${qturn({ q: '탱크에 들어가기 전에 산소 농도를 얼마로 확인하나요?', a: '지침 셋이 서로 다른 값을 듭니다.', meta: '근거 4건 · 2회차' })}<div style="margin-top:8px">${carry(['08 작업안전 폴더', '엔티티 · 밀폐공간 작업', '근거 4건'])}</div><div style="margin-top:8px;display:flex;flex-direction:column">${userTurn('그럼 측정은 언제 하나요?')}</div>`,
  },
  {
    cat: '민감정보',
    name: 'grant({text, left})',
    note: '추가 인증으로 열린 상태와 남은 시간',
    ex: grant({ text: '주민등록번호 1건 해제됨 · 사유 기록됨', left: '남은 시간 8분' }),
  },
  {
    cat: 'AI 지원',
    name: 'planted(label)',
    note: '남의 문서 안에서 모델에게 말을 거는 문장 · AI 표시가 점선인 것과 달리 실선이다',
    ex: `${planted()} ${planted('격리됨')}<div style="margin-top:8px">${banner({ dot: 'warn', text: `이 근거에 ${planted()}가 있습니다 · 답변 문장의 신뢰도가 내려갑니다` })}</div>`,
  },
  {
    cat: '설치본',
    name: 'appwindow(title) · trayMenu({title, rows, actions})',
    note: '브라우저 탭이 아니라 설치된 프로그램의 창 · 창을 닫아도 남는 트레이 메뉴',
    ex: `${appwindow('PRODUCT — 평가 기간')}<div style="margin-top:8px">${trayMenu({
      title: 'PRODUCT · 평가 기간',
      rows: [
        ['상태', '동작 중'],
        ['처리 중', '3건 · 62%'],
        ['라이선스', '남은 21일'],
      ],
      actions: ['창 열기', '라이선스', '종료'],
    })}</div>`,
  },
  {
    cat: '시점',
    name: 'timeline(spans)',
    note: '사실 하나의 유효 기간들을 한 트랙에 · 목록이면 모순으로 읽히는 것이 트랙이면 개정으로 읽힌다',
    ex: timeline([
      { label: '2025년 공표본', from: '2025-03-26', to: '2026-01-29', left: 0, width: 52 },
      {
        label: '2026년 공표본',
        from: '2026-01-30',
        to: '오늘',
        left: 52,
        width: 48,
        on: true,
        open: true,
      },
    ]),
  },
]
