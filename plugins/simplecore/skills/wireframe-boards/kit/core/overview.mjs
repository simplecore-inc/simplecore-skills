// The opening pages: what this board is made of, before the first frame.
//
// A board reaches most of its readers as a wall of screens. What it never says on its own is the
// shape behind them — how the product is divided, what has to be bought before a screen opens,
// and who each screen is drawn for. Those three answers are already in the board's own data
// (`src/manifest.mjs`, `board.config.mjs`, `src/chrome.mjs`, `src/roles.mjs`), so they are
// rendered rather than written: a section added tomorrow appears here the same day, and nothing
// here can disagree with the frames.
//
// **It carries into the PDF.** Unlike the reading contract — which is the instruction to whoever
// implements, and is read from the HTML — this is what a reader needs before the first page of
// screens makes sense, and most readers meet the board as the PDF.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * One block of the overview, drawn as a card in the board's own vocabulary.
 *
 * <p>A label bar over a bordered stage, the same shape a frame has. That is not decoration: the
 * opening is read in the same glance as the frames under it, and a block that looks like a
 * document stapled to the front gets skipped by the readers who most need it.
 */
const ovFrame = (id, title, sub, body) =>
  `<article class="ov-frame" id="ov-${id}">
      <div class="ov-stage">${body}</div>
      <div class="ov-label"><span class="fnum">${esc(id.toUpperCase())}</span>${esc(title)}` +
  `${sub ? `<span class="ov-sub-l">${esc(sub)}</span>` : ''}</div>
    </article>`;

/** Cluster letter → how many screens and frames the board draws in it. */
function sectionCounts(ctx) {
  return ctx.sections.map((sec) => {
    const ids = new Set(sec.entries.map((e) => e.id));
    return {
      letter: sec.letter,
      title: sec.title,
      screens: ids.size,
      frames: sec.entries.length,
      phase: sec.phase ?? null,
      feature: sec.feature ?? null,
    };
  });
}

/** How many frames each device class holds — the reader's first question about scope. */
function deviceMix(ctx) {
  const n = {};
  for (const s of ctx.loaded) {
    const d = s.mod.device || 'phone';
    n[d] = (n[d] ?? 0) + 1;
  }
  return n;
}

/**
 * The information architecture, where the board declares one.
 *
 * <p>Read from the board's own `src/chrome.mjs` — the same data the shells draw from — so the map
 * here and the menu inside every frame cannot disagree. A board that exports no `MENU` simply
 * gets the cluster list, which is the honest answer for a product with no menu tree.
 */
function iaBlock(ctx, counts, scaleHtml, gateHtml) {
  const menu = ctx.chrome?.MENU;
  const tabs = ctx.chrome?.TABS;
  const byLetter = Object.fromEntries(counts.map((c) => [c.letter, c]));

  const { features = {}, phases = {} } = ctx.config;
  const byL = Object.fromEntries(counts.map((c) => [c.letter, c]));
  // The chip rides the cluster it belongs to. A condition listed only underneath makes the
  // reader carry a key from the legend back up into the tree; on the node it is read in place.
  const chips = (L) => {
    const c = byL[L];
    if (!c) return '';
    return (c.feature && features[c.feature] ? `<span class="ft-tag">${esc(features[c.feature].tag)}</span>` : '') +
      (c.phase && phases[c.phase] ? `<span class="ph-tag">${esc(phases[c.phase].tag)}</span>` : '');
  };
  const leaf = (L, title, n) =>
    `<span class="ov-node"><b>${L}</b>${esc(title)}<i>${n}</i>` +
    `${chips(L) ? `<em class="ov-chips">${chips(L)}</em>` : ''}</span>`;

  if (!menu) {
    return ovFrame('ia', '정보 구조', `클러스터 ${counts.length}`,
      scaleHtml +
      `<div class="ov-cols"><div class="ov-tree ov-tree-flat">${counts.map((c) =>
        leaf(c.letter, c.title, `화면 ${c.screens}`)).join('')}</div>${gateHtml}</div>`);
  }

  // With a tab list, the clusters are grouped the way the product groups them; without one, the
  // menu's own order stands in.
  const groups = tabs
    ? tabs.map((t) => ({ label: t.key, clusters: t.clusters }))
    : [{ label: '', clusters: Object.keys(menu) }];
  const seen = new Set(groups.flatMap((g) => g.clusters));
  const rest = Object.keys(menu).filter((L) => !seen.has(L));
  if (rest.length) groups.push({ label: '그 밖의 메뉴', clusters: rest });

  const entryCount = (m) => [...(m.items ?? []), ...(m.packItems ?? [])]
    .reduce((n, i) => n + (typeof i === 'string' ? 1 : (i.children?.length ?? 1)), 0);

  // A cluster the board DRAWS but the console menu does not carry — the phone app, the shared
  // terminal, the pattern cluster. Left out, the map says the product is only the console, and
  // the reader who opens L or M finds screens the overview never mentioned.
  const outside = counts.filter((c) => !menu[c.letter]);
  if (outside.length) {
    groups.push({ label: '콘솔 밖', clusters: outside.map((c) => c.letter), outside: true });
  }

  const rows = groups.map((g) => {
    const cells = g.outside
      ? g.clusters.map((L) => {
        const c = byL[L];
        return leaf(L, c.title, `화면 ${c.screens}`);
      }).join('')
      : g.clusters.filter((L) => menu[L]).map((L) => {
      const c = byLetter[L];
      return leaf(L, menu[L].title, c ? `항목 ${entryCount(menu[L])} · 화면 ${c.screens}`
        : `항목 ${entryCount(menu[L])} · 아직 안 그림`);
    }).join('');
    return cells
      ? `<div class="ov-branch"><span class="ov-tab-l">${esc(g.label)}</span>` +
        `<div class="ov-tree">${cells}</div></div>`
      : '';
  }).join('');
  return ovFrame('ia', '정보 구조', '탭 → 클러스터 → 메뉴 항목',
    scaleHtml + `<div class="ov-cols">${rows}${gateHtml}</div>`);
}

/**
 * The two conditions a frame can carry, listed apart because they are answers to different
 * questions and a reader who reads one as the other draws the wrong conclusion.
 *
 * <p>`feature` says what has to be BOUGHT before the screen can be used, and stays as long as the
 * product is sold. `phase` says WHEN the screen gets built, and is removed once development
 * reaches it. A frame can carry both, and neither is a grade of the other.
 */
function gateBlock(ctx, counts) {
  const { features = {}, phases = {} } = ctx.config;
  if (!Object.keys(features).length && !Object.keys(phases).length) return '';

  // How many frames each key actually reaches, counting a cluster's declaration for its frames.
  const tally = (key, kind) => {
    let n = 0;
    for (const sec of ctx.sections) {
      for (const e of sec.entries) {
        if ((e[kind] ?? sec[kind] ?? null) === key) n += 1;
      }
    }
    return n;
  };

  const feat = Object.entries(features);
  const ph = Object.entries(phases);
  const axis = (label, entries, chipClass, kind) => entries.length
    ? `<div class="ov-axis"><div class="ov-axis-h"><b>${esc(label)}</b></div>` +
      entries.map(([k, v]) => {
        const n = tally(k, kind);
        return `<div class="ov-gate"><span class="${chipClass}">${esc(v.tag)}</span>` +
          `<code>${esc(k)}</code><span class="ov-why">${esc(v.why ?? '')}</span>` +
          `<span class="ov-cnt">${n ? `${n} 프레임` : '—'}</span></div>`;
      }).join('') + `</div>`
    : '';
  return `<div class="ov-gates">` +
    axis('구매 조건', feat, 'ft-tag', 'feature') +
    axis('개발 시점', ph, 'ph-tag', 'phase') +
    `</div>`;
}

/**
 * Who each cluster is drawn for.
 *
 * <p>Rendered from the board's own matrix, so it answers the same question the frames answer. A
 * cluster the matrix deliberately does not cover is listed with its reason rather than left as an
 * empty row — an empty row and a decision look identical, and only one of them is finished.
 */
function userBlock(ctx, counts) {
  const roles = ctx.roles;
  if (!roles?.ROLES || !roles?.CLUSTER_ROLES) return '';
  const { ROLES, VERDICTS = {}, CLUSTER_ROLES, NOT_COVERED = {} } = roles;
  const keys = Object.keys(ROLES);

  const rows = counts.filter((c) => CLUSTER_ROLES[c.letter]).map((c) => {
    const v = CLUSTER_ROLES[c.letter];
    return `<tr><td class="ov-k">${c.letter}</td><td>${esc(c.title)}</td>` +
      keys.map((k) => `<td class="ov-c">${v[k] ? esc(VERDICTS[v[k]] ?? v[k]) : ''}</td>`).join('') +
      `</tr>`;
  }).join('');

  const notCovered = Object.entries(NOT_COVERED)
    .map(([L, why]) => `<li><b>${L}</b><span>${esc(why)}</span></li>`).join('');

  return ovFrame('user', '사용자 구성', `사용자 ${keys.length}`,
    `<div class="ov-axis-h"><b>사용자별 기능</b></div>` +
    `<table class="ov-tbl ov-matrix"><thead><tr><th>클러스터</th><th>이름</th>` +
    keys.map((k) => `<th class="ov-c">${esc(ROLES[k])}</th>`).join('') + `</tr></thead>` +
    `<tbody>${rows}</tbody></table>` +
    `<div class="ov-foot">` +
    (Object.keys(VERDICTS).length
      ? `<div class="ov-legend"><span class="ov-foot-h">범례</span>` +
        Object.entries(VERDICTS).map(([k, sym]) =>
          `<span class="ov-lg"><b>${esc(sym)}</b>${esc(k)}</span>`).join('') + `</div>`
      : '') +
    (notCovered ? `<div class="ov-nc"><span class="ov-foot-h">이 표가 다루지 않는 클러스터</span>` +
      `<ul>${notCovered}</ul></div>` : '') +
    `</div>`);
}

/** The board's own size, drawn as a strip at the head of the IA card. */
function scaleStrip(ctx, counts) {
  const screens = new Set(ctx.loaded.map((s) => s.num)).size;
  const mix = deviceMix(ctx);
  const DEV = { desktop: '데스크톱', tablet: '태블릿', phone: '폰' };
  // 화면 and 프레임 are different counts — one permanent id against one drawing — and they part
  // only where a screen is drawn at two viewport widths. The pair count is shown rather than
  // explained: two identical figures with no third number read as a mistake.
  const pairs = ctx.loaded.length - screens;
  return `<div class="ov-scale">` +
    `<div class="ov-fig"><b>${counts.length}</b><span>클러스터</span></div>` +
    `<div class="ov-fig"><b>${screens}</b><span>화면</span></div>` +
    `<div class="ov-fig"><b>${ctx.loaded.length}</b><span>프레임</span></div>` +
    `<div class="ov-fig ov-fig-s"><b>${pairs}</b><span>반응형 짝</span></div>` +
    `<span class="ov-fig-rule"></span>` +
    Object.entries(mix).map(([d, n]) =>
      `<div class="ov-fig ov-fig-s"><b>${n}</b><span>${DEV[d] ?? d}</span></div>`).join('') +
    `</div>`;
}

/**
 * The whole opening section.
 *
 * @returns the HTML, or '' when the board has nothing to say yet — a board of three frames does
 *   not need a map, and an overview of nothing reads as a broken page
 */
export function renderOverview(ctx) {
  if (ctx.loaded.length < 4) return '';
  const counts = sectionCounts(ctx);
  return `<section class="board-overview" id="overview">
  ${iaBlock(ctx, counts, scaleStrip(ctx, counts), gateBlock(ctx, counts))}
  ${userBlock(ctx, counts)}
</section>`;
}
