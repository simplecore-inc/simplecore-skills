// Gates that read the documents OUTSIDE this folder — `docs/` decides what exists and `_plans/`
// decides in what order it gets built, so both drift the moment a frame is added and nobody
// back-fills. Every check here is one that had already gone wrong silently:
//
//   the roadmap claimed 「바탕 화면이 정확히 한 단계씩 들어 있다」 with 49 of them in no phase
//   the parity list, which may only ever shrink, was 136 frames short of the board
//   two plans named `N-25`, an id whose screen had moved to `N-71` and left a gap
//   the IA menu tree was seven entries behind the shell it describes
//   the board cited five 별지 서식 the statutory-form appendix did not carry
//
// None of these can be seen from inside the board, and none of them makes a screen look wrong —
// which is exactly why they survived. Each one refuses the build.
//
// Reading is by explicit path from `board.config.mjs`, never by glob: a glob that stops matching
// reports nothing, and nothing is indistinguishable from a pass.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

// A declared document may be one file or a directory of them — a plan that grew past one file is
// still one plan, and the gates that read it must not force it back into a single page.
const read = (ctx, key) => {
  const rel = ctx.config.documents?.[key];
  if (!rel) return null;
  const p = join(ctx.boardDir, rel);
  if (!existsSync(p)) return null;
  if (!statSync(p).isDirectory()) return { path: p, text: readFileSync(p, 'utf8') };
  const parts = readdirSync(p).filter((e) => e.endsWith('.md')).sort()
    .map((e) => readFileSync(join(p, e), 'utf8'));
  return { path: p, text: parts.join('\n\n') };
};

/** Every .md under the declared scan roots, so a link or an id anywhere is judged. */
const scanFiles = (ctx) => {
  const out = [];
  const walk = (d) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (e === 'node_modules' || e.startsWith('.')) continue;
      if (statSync(p).isDirectory()) walk(p);
      else if (e.endsWith('.md')) out.push(p);
    }
  };
  for (const r of ctx.config.documents?.scan ?? []) walk(join(ctx.boardDir, r));
  return out;
};

/** `a-07-dashboard` → `A-07`. The permanent id, which is what every document cites. */
const idOfFile = (f) => {
  const [l, n] = f.split('-');
  return `${l.toUpperCase()}-${n}`;
};

const boardIds = (ctx) => new Set(ctx.manifest.flatMap((s) => s.screens.map((e) => idOfFile(e.file))));

// A state frame spreads its base or imports the base's drawing. It rides in the base's phase, so
// the roadmap places base screens only — counting states there would demand 310 more entries that
// say nothing about build order.
const isState = (src) => /\.\.\.base/.test(src) || /^import base from/m.test(src) || /from '\.\/[a-z]-\d+-/.test(src);

const baseIds = (ctx) => new Set(
  ctx.manifest.flatMap((s) => s.screens.map((e) => e.file))
    .filter((f) => !isState(ctx.srcOf(f)))
    .map(idOfFile),
);

const FRAME_ID = /(?<![A-Za-z0-9-])([A-Z])-(\d{2})(?![0-9-])/g;

// ─────────────────────────────────────────────────────────────────────────────

// §4.2 is the list of what exists. The board draws it, so a cluster's item count there and its
// screen count here are the same number or one of the two is wrong.
export const frameManifestGate = {
  id: 'frameManifestGate',
  title: '화면설계 §4.2와 manifest의 프레임 수가 다르다',
  stage: 'built',
  run: (ctx) => {
    const doc = read(ctx, 'frameManifest');
    if (!doc) return [];
    const bad = [];
    const mine = {};
    for (const sec of ctx.manifest) {
      const L = sec.letter.split('-')[0].charAt(0);
      mine[L] = (mine[L] ?? 0) + sec.screens.length;
    }
    const theirs = {};
    // 「**K. 출입 연동 (D · 40 — 2단계 구역)** — 항목 / 항목 / …」 — the count in the heading is
    // prose that drifts, so what is compared is the ITEMS, which are the list itself.
    for (const m of doc.text.matchAll(/^\*\*([A-Z])(?:-?\d)?\.[^\n]*?\*\*\s*—\s*(.*)$/gm)) {
      const items = m[2].split(' / ').filter((x) => x.trim()).length;
      theirs[m[1]] = (theirs[m[1]] ?? 0) + items;
    }
    for (const L of new Set([...Object.keys(mine), ...Object.keys(theirs)])) {
      if ((mine[L] ?? 0) !== (theirs[L] ?? 0)) {
        bad.push(`${L}: §4.2가 ${theirs[L] ?? 0}개 · manifest가 ${mine[L] ?? 0}개 — 프레임을 더하면 둘 다 고친다`);
      }
    }
    // The heading's own number — 「(D 75 · T 8 = 83)」 — is not the list, and it drifts alone. Four
    // headings carried a desktop count from before their cluster grew while the total beside it and
    // the items after it had both moved on, so the line disagreed with itself.
    for (const m of doc.text.matchAll(/^\*\*([A-Z](?:-?\d)?)\.[^\n(]*\(([^)]*)\)\*\*\s*—\s*(.*)$/gm)) {
      const items = m[3].split(' / ').filter((x) => x.trim()).length;
      const paren = m[2].replace(/\s*—[^—]*$/, '');
      const eq = /=\s*(\d+)\s*$/.exec(paren);
      const nums = [...paren.matchAll(/(\d+)/g)];
      const declared = eq ? Number(eq[1]) : (nums.length ? Number(nums[nums.length - 1][1]) : null);
      if (declared !== null && declared !== items) {
        bad.push(`§4.2 ${m[1]} 머리글이 ${declared}장인데 항목은 ${items}개`);
      }
    }
    // §4.3 is the split a reader quotes, and it is prose: its total sat at 703 while the list above
    // it had grown to 747. Three things have to agree — each row against the clusters named in it,
    // the rows against the total, and the total against what the board draws.
    const s43 = doc.text.split(/^### 4\.3[^\n]*$/m)[1];
    if (s43) {
      const body = s43.split(/^#{2,3} /m)[0];
      const all = Object.values(mine).reduce((a, b) => a + b, 0);
      const byCluster = {};
      let sum = 0;
      for (const ln of body.split('\n')) {
        const r = /^\| (.+?) \| (\d+) \|$/.exec(ln);
        if (!r || r[1].startsWith('**합계**')) continue;
        const val = Number(r[2]);
        sum += val;
        const pairs = [...r[1].matchAll(/([A-Z](?:-?\d)?)\s+(\d+)/g)];
        if (pairs.length) {
          const s = pairs.reduce((a, p) => a + Number(p[2]), 0);
          if (s !== val) bad.push(`§4.3 「${r[1].slice(0, 18)}」: 괄호 안 합이 ${s}장인데 행은 ${val}장`);
          for (const p of pairs) byCluster[p[1].charAt(0)] = (byCluster[p[1].charAt(0)] ?? 0) + Number(p[2]);
        } else {
          const only = /\(([A-Z])\)/.exec(r[1]);
          if (only) byCluster[only[1]] = (byCluster[only[1]] ?? 0) + val;
        }
      }
      const totRow = /^\| \*\*합계\*\* \| \*\*(\d+)\*\*([^|]*)\|/m.exec(body);
      if (totRow) {
        if (Number(totRow[1]) !== all) bad.push(`§4.3 합계가 ${totRow[1]}장인데 보드는 ${all}장`);
        if (sum !== Number(totRow[1])) bad.push(`§4.3 행 합이 ${sum}장인데 합계는 ${totRow[1]}장`);
        const part = {};
        for (const p of totRow[2].matchAll(/(1단계|2단계|규제 산업 팩|그린 것) (\d+)/g)) part[p[1]] = Number(p[2]);
        const split = (part['1단계'] ?? 0) + (part['2단계'] ?? 0) + (part['규제 산업 팩'] ?? 0);
        if (split && split !== Number(totRow[1])) {
          bad.push(`§4.3 합계 옆 내역이 ${split}장인데 합계는 ${totRow[1]}장`);
        }
        if (part['그린 것'] && part['그린 것'] !== Number(totRow[1])) {
          bad.push(`§4.3 「그린 것 ${part['그린 것']}」이 합계 ${totRow[1]}과 다르다`);
        }
      }
      for (const L of Object.keys(byCluster)) {
        if (byCluster[L] !== (mine[L] ?? 0)) {
          bad.push(`§4.3 ${L}: 표가 ${byCluster[L]}장인데 보드는 ${mine[L] ?? 0}장`);
        }
      }
    }
    return bad;
  },
};

// The parity list only ever shrinks: a walked frame is deleted from it. So every frame the board
// draws is in it until somebody walks that frame, and a frame it names that the board no longer
// draws is a walk aimed at nothing.
export const parityListGate = {
  id: 'parityListGate',
  title: '걸어야 할 화면 목록이 보드와 다르다',
  stage: 'built',
  run: (ctx) => {
    const doc = read(ctx, 'parity');
    if (!doc) return [];
    const ids = boardIds(ctx);
    const named = new Set([...doc.text.matchAll(FRAME_ID)].map((m) => `${m[1]}-${m[2]}`));
    const bad = [];
    const missing = [...ids].filter((i) => !named.has(i)).sort();
    const extra = [...named].filter((i) => !ids.has(i)).sort();
    if (missing.length) {
      bad.push(`보드에 있는데 목록에 없다 (${missing.length}장): ${missing.slice(0, 8).join(' ')}${missing.length > 8 ? ' …' : ''}`);
    }
    if (extra.length) bad.push(`목록에만 있다 — 보드가 그리지 않는다: ${extra.join(' ')}`);
    // Each section's own heading count, so a back-fill that forgets the heading is caught too.
    const lines = doc.text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const h = /^### ([A-Z])[^(]*\((\d+)장\)/.exec(lines[i]);
      if (!h) continue;
      let j = i + 1;
      while (j < lines.length && !lines[j].startsWith('### ')) j += 1;
      const n = new Set([...lines.slice(i, j).join('\n').matchAll(FRAME_ID)].map((m) => m[0])).size;
      if (n !== Number(h[2])) bad.push(`${h[1]} 구역 머리글이 ${h[2]}장인데 실제 ${n}장`);
    }
    return bad;
  },
};

// The roadmap says every base screen sits in exactly one phase, and that sentence is only true if
// somebody checks it. A screen in no phase is a screen nobody will build.
export const roadmapPlacementGate = {
  id: 'roadmapPlacementGate',
  title: '로드맵이 바탕 화면을 한 단계씩 담고 있지 않다',
  stage: 'built',
  run: (ctx) => {
    const doc = read(ctx, 'roadmap');
    if (!doc) return [];
    const base = baseIds(ctx);
    const ids = boardIds(ctx);
    const bad = [];
    // A placement is an emphasised id — `**A-01** 로그인` — which is how every phase list writes
    // one. A bare id in prose is a cross-reference, not a placement.
    const placed = [...doc.text.matchAll(/\*\*([A-Z]-\d{2})\*\*/g)].map((m) => m[1]);
    const seen = new Set();
    const twice = new Set();
    for (const p of placed) (seen.has(p) ? twice : seen).add(p);
    const unplaced = [...base].filter((i) => !seen.has(i)).sort();
    if (unplaced.length) {
      bad.push(`어느 단계에도 없는 바탕 화면 ${unplaced.length}장: ${unplaced.slice(0, 8).join(' ')}${unplaced.length > 8 ? ' …' : ''}`);
    }
    if (twice.size) bad.push(`두 단계에 놓인 화면: ${[...twice].sort().join(' ')}`);
    const ghost = [...seen].filter((i) => !ids.has(i)).sort();
    if (ghost.length) bad.push(`보드에 없는 화면을 배치했다: ${ghost.join(' ')}`);
    // Each phase's own 「화면 N장」, so a phase that gains a screen and keeps its old number is caught.
    const lines = doc.text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const h = /^- \*\*화면 (\d+)장\*\*/.exec(lines[i]);
      if (!h) continue;
      let j = i + 1;
      while (j < lines.length && !/^#{2,3} /.test(lines[j])) j += 1;
      const n = new Set([...lines.slice(i, j).join('\n').matchAll(/\*\*([A-Z]-\d{2})\*\*/g)].map((m) => m[1])).size;
      if (n !== Number(h[1])) {
        const head = lines.slice(0, i).reverse().find((l) => /^#{2,3} /.test(l)) ?? '?';
        bad.push(`${head.replace(/^#+ /, '').slice(0, 24)}: 「화면 ${h[1]}장」인데 실제 ${n}장`);
      }
    }
    // The header's split, which is the number a reader quotes.
    const tot = /바탕 화면 (\d+)장 · 상태 프레임 (\d+)장 = \*\*(\d+)장\*\*/.exec(doc.text);
    if (tot) {
      const state = ids.size - base.size;
      if (Number(tot[1]) !== base.size || Number(tot[2]) !== state || Number(tot[3]) !== ids.size) {
        bad.push(`머리글의 합계가 「바탕 ${tot[1]} · 상태 ${tot[2]} = ${tot[3]}」인데 실제는 바탕 ${base.size} · 상태 ${state} = ${ids.size}`);
      }
    }
    // The two tables that COUNT the placement above. Every id sat in exactly one phase and both
    // tables still said 400 while 437 were placed — the ids are checked frame by frame, the tables
    // are prose, and prose does not move when a phase list gains a line.
    const placedBy = {};   // 「(A)|W2」 → n, the distribution the 배치 검산 table restates
    const perGroup = {};   // 「(A)」 → n
    const perStage = {};   // 「W2」 → n
    let phase = null;
    for (const ln of lines) {
      const h = /^#{1,3} (W\d+)\./.exec(ln);
      if (h) { phase = h[1]; continue; }
      const g = /^\s*- \((.+?)\)/.exec(ln);
      if (!g || !phase) continue;
      const n = new Set([...ln.matchAll(/\*\*([A-Z]-\d{2})\*\*/g)].map((m) => m[1])).size;
      if (!n) continue;
      placedBy[`${g[1]}|${phase}`] = (placedBy[`${g[1]}|${phase}`] ?? 0) + n;
      perGroup[g[1]] = (perGroup[g[1]] ?? 0) + n;
      perStage[phase] = (perStage[phase] ?? 0) + n;
    }
    for (const m of doc.text.matchAll(/^\| ([A-Z](?:-?\d)?) (\d+) \| (\d+) \| ([^|]*)\|$/gm)) {
      const [, grp, named, total, dist] = m;
      if (Number(named) !== Number(total)) bad.push(`배치 검산 ${grp}: 이름은 ${named}장인데 총 열은 ${total}장`);
      if ((perGroup[grp] ?? 0) !== Number(total)) {
        bad.push(`배치 검산 ${grp}: 표가 ${total}장인데 단계에 놓인 것은 ${perGroup[grp] ?? 0}장`);
      }
      let sum = 0;
      for (const d of dist.matchAll(/(W\d+) (\d+)/g)) {
        sum += Number(d[2]);
        const a = placedBy[`${grp}|${d[1]}`] ?? 0;
        if (a !== Number(d[2])) bad.push(`배치 검산 ${grp} ${d[1]}: 표가 ${d[2]}장인데 실제 ${a}장`);
      }
      if (sum !== Number(total)) bad.push(`배치 검산 ${grp}: 단계별 합이 ${sum}장인데 총계가 ${total}장`);
    }
    const rmTotal = /^\| \*\*합계\*\* \| \*\*(\d+)\*\* \|/m.exec(doc.text);
    if (rmTotal && Number(rmTotal[1]) !== base.size) {
      bad.push(`배치 검산 합계가 ${rmTotal[1]}장인데 바탕 화면은 ${base.size}장`);
    }
    for (const ln of lines) {
      if (!/^\| W\d+ \| \d+ \|/.test(ln)) continue;
      for (const m of ln.matchAll(/(W\d+) \| (\d+)/g)) {
        const a = perStage[m[1]] ?? 0;
        if (a !== Number(m[2])) bad.push(`단계별 화면 수 ${m[1]}: 표가 ${m[2]}장인데 실제 ${a}장`);
      }
    }
    return bad;
  },
};

// A document naming a frame that does not exist sends somebody looking for a screen. Ids are
// permanent and a deletion leaves a gap that is never reused, so a stale name never comes back.
export const docFrameRefGate = {
  id: 'docFrameRefGate',
  title: '문서가 보드에 없는 프레임을 부른다',
  stage: 'built',
  run: (ctx) => {
    const ids = boardIds(ctx);
    const bad = [];
    // Two shapes read like a frame id and are not: a KOSHA guide number (`P-94`) and the E-9
    // 체류자격. Both are followed or preceded by their own context, so they are named rather than
    // pattern-matched — a pattern loose enough to exclude them would also excuse a real defect.
    const NOT_A_FRAME = new Set(['P-94', 'E-9']);
    for (const f of scanFiles(ctx)) {
      const miss = new Set();
      for (const m of readFileSync(f, 'utf8').matchAll(FRAME_ID)) {
        const id = `${m[1]}-${m[2]}`;
        if (!ids.has(id) && !NOT_A_FRAME.has(id)) miss.add(id);
      }
      if (miss.size) bad.push(`${f.split('/').slice(-2).join('/')}: ${[...miss].sort().join(' ')}`);
    }
    return bad;
  },
};

// A link to a file that moved is dead in the reader's hand and silent in every check that does not
// resolve it.
export const docLinkGate = {
  id: 'docLinkGate',
  title: '문서 링크가 없는 파일을 가리킨다',
  stage: 'built',
  run: (ctx) => {
    const bad = [];
    for (const f of scanFiles(ctx)) {
      for (const m of readFileSync(f, 'utf8').matchAll(/\]\(([^)\s#]+\.md)(?:#[^)]*)?\)/g)) {
        if (m[1].startsWith('http')) continue;
        if (!existsSync(resolve(dirname(f), m[1]))) {
          bad.push(`${f.split('/').slice(-2).join('/')} → ${m[1]}`);
        }
      }
    }
    return bad;
  },
};

// A document nobody registered is a document nobody maintains. The registry names every
// non-code document and what it is for, so the gate's whole job is to keep the two sides equal:
// a file that reached the tree without a row, and a row whose file is gone.
export const docRegistryGate = {
  id: 'docRegistryGate',
  title: '문서 목록과 실제 문서가 어긋난다',
  stage: 'built',
  run: (ctx) => {
    const doc = read(ctx, 'registry');
    if (!doc) return [];                       // 문서 목록을 선언하지 않은 보드에는 걸리지 않는다
    const bad = [];
    const root = ctx.boardDir;
    const rel = (p) => p.replace(`${root}/`, '').replace(/^(\.\.\/)+/, '');
    // Every scanned document needs a row. The registry names files by path, in a link or in code.
    for (const f of scanFiles(ctx)) {
      const name = f.split('/').pop();
      if (name === doc.path.split('/').pop()) continue;
      if (!doc.text.includes(name)) bad.push(`문서 목록에 없는 문서: ${rel(f)}`);
    }
    // And every path the registry names has to exist, or the table is describing a repository
    // that is no longer there.
    // A registry may name a file the scan roots do not cover (an instruction file beside the
    // board) and may hold a placeholder for documents not written yet. Neither is a dead row:
    // judge by whether the path resolves, and skip anything carrying a glob.
    const seen = new Set(scanFiles(ctx).map((f) => f.split('/').pop()));
    for (const m of doc.text.matchAll(/`([^`\s]+\.md)`|\]\(([^)\s]+\.md)\)/g)) {
      const path = m[1] ?? m[2];
      if (/[*{}]/.test(path)) continue;
      if (seen.has(path.split('/').pop())) continue;
      // A registry names paths as the repository sees them, and the board sits somewhere inside
      // that repository — so every ancestor of the board is a candidate base.
      const bases = [join(doc.path, '..'), root];
      for (let d = root; d !== dirname(d); d = dirname(d)) bases.push(d);
      if (bases.some((base) => existsSync(join(base, path)))) continue;
      bad.push(`문서 목록이 부르는 문서가 없다: ${path}`);
    }
    return [...new Set(bad)];
  },
};

// The visibility matrix is what says who reaches what. A role the board knows and the document
// does not is a role nobody signed off on.
export const roleDocGate = {
  id: 'roleDocGate',
  title: '보드의 역할이 페르소나 문서에 없다',
  stage: 'built',
  run: async (ctx) => {
    const doc = read(ctx, 'personas');
    if (!doc) return [];
    const { ROLES } = await import(`${ctx.boardDir}/src/roles.mjs`);
    return Object.values(ROLES).filter((r) => !doc.text.includes(r))
      .map((r) => `「${r}」 — roles.mjs에는 있고 페르소나 문서에는 없다`);
  },
};

// A feature key is what a customer buys. One the board gates a screen on and the price list does
// not name cannot be sold, so the screen can never open.
export const featureKeyDocGate = {
  id: 'featureKeyDocGate',
  title: '기능 키가 가격 문서에 없다',
  stage: 'built',
  run: (ctx) => {
    const doc = read(ctx, 'pricing');
    if (!doc) return [];
    return Object.keys(ctx.config.features ?? {}).filter((k) => !doc.text.includes(k))
      .map((k) => `${k} — board.config.mjs가 관문으로 쓰는데 가격 문서에 없다`);
  },
};
