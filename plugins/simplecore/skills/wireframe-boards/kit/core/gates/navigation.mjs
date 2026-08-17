// Gates on how a reader moves: the CRUD ledger every route is accounted for in, whether a
// frame can be reached at all, and the words the controls use to say the same act.
import { idOf } from '../ids.mjs';
// The ledger is the BOARD's, not the kit's — it names that product's entities. It arrives on
// ctx so a gate written here judges any board, and a board that keeps no ledger simply skips
// the three gates that read it rather than failing to import.
const ledgerOf = (ctx) => ({ LEDGER: ctx.crud?.LEDGER ?? null, NON_ENTITY: ctx.crud?.NON_ENTITY ?? {} });

// CRUD gate: a board grows one screen at a time, and the screen that gets drawn is the
// interesting one — the detail with the gate, the form with the legal trap. The list nobody
// argues about, the edit that is "just a form", and the delete that "we'll figure out later" go
// missing silently, because a board full of good screens looks finished. So every route is
// accounted for in `src/crud.mjs`: either it belongs to an entity whose five verbs each name a
// frame, or it is listed as a non-entity with the reason it has no CRUD of its own. A new screen
// whose route is in neither place stops the build, which is the moment to ask where its list,
// its edit, and its delete are.
export const crudGate = {
  id: 'crudGate',
  title: 'CRUD 대장이 맞지 않는다 (src/crud.mjs)',
  stage: 'built',
  run: (ctx) => {
    const { LEDGER, NON_ENTITY } = ledgerOf(ctx);
    // No ledger means the board does not keep a CRUD census. Skipping is right: the census is
    // a discipline a board opts into, and reporting every route as unaccounted for would make
    // the gate noise on every board that has not.
    if (!LEDGER) return [];
    const VERBS = ['list', 'create', 'read', 'update', 'remove'];
    const crudErrors = [];
    {
      const frameIds = new Set(ctx.loaded.map((s) => s.num));
      for (const [entity, row] of Object.entries(LEDGER)) {
        for (const verb of VERBS) {
          const at = row[verb];
          if (at == null) { crudErrors.push(`${entity}.${verb} — 빠졌다 (프레임 id · 'generic' · { waived })`); continue; }
          if (at === 'generic') continue;
          if (typeof at === 'object') {
            if (!String(at.waived ?? '').trim()) crudErrors.push(`${entity}.${verb} — waived에 사유가 없다`);
            continue;
          }
          if (!frameIds.has(at)) crudErrors.push(`${entity}.${verb} — ${at} 프레임이 없다`);
        }
      }
      // A route is accounted for when some frame the ledger names carries it — the verb entries and
      // the `also` list together are the entity's frames — or when NON_ENTITY says why it has none.
      const ledgerFrames = new Set();
      for (const row of Object.values(LEDGER)) {
        for (const verb of VERBS) if (typeof row[verb] === 'string' && row[verb] !== 'generic') ledgerFrames.add(row[verb]);
        for (const id of row.also ?? []) ledgerFrames.add(id);
      }
      for (const id of ledgerFrames) if (!frameIds.has(id)) crudErrors.push(`${id} — 대장이 가리키는 프레임이 없다`);
      const claimedRoutes = new Set(Object.keys(NON_ENTITY));
      for (const s of ctx.loaded) if (ledgerFrames.has(s.num) && s.mod.route) claimedRoutes.add(s.mod.route);
      for (const s of ctx.loaded) {
        const route = s.mod.route ?? '';
        if (!route) continue;                       // the P cluster is the generic pattern itself
        if (claimedRoutes.has(route)) {
          if (Object.hasOwn(NON_ENTITY, route) && !String(NON_ENTITY[route]).trim()) {
            crudErrors.push(`${route} — NON_ENTITY에 사유가 없다`);
          }
          continue;
        }
        crudErrors.push(`${s.num} ${route} — crud.mjs의 어느 엔티티에도, NON_ENTITY에도 없다`);
      }
    }
    return crudErrors;
  },
};

// View-switch vocabulary gate. Two things the persona review found once the switch existed on five
// screens, both of which read as trivia and both of which cost a reader a guess every time.
//
// 1. `?view=` already means ONE thing on this board — the record picked out of the list, across
//    ninety frames (`?view=cti_0119`). The first cut of the calendar switch borrowed the same key
//    for the view mode (`?view=month`), copying it from the pattern frame, so one parameter meant
//    a record on one frame and a layout on the next. The view mode is `?mode=`.
// 2. A segment control that offers the same two things in a different order on a different screen
//    is two controls to learn. E-05 drew 「달력 · 목록」 while the other four drew 「목록 · 달력」,
//    because its default view is the calendar — but the DEFAULT is `view`, not the order.
export const viewSwitchGate = {
  id: 'viewSwitchGate',
  title: '보기 전환이 화면마다 다르게 말한다',
  stage: 'built',
  run: (ctx) => {
    const viewKeyErrors = [];
    {
      const MODE_WORDS = /^(month|week|day|list|calendar|grid|board|timeline)$/;
      const orders = new Map();
      for (const sc of ctx.screens) {
        const src = ctx.srcOf(sc.file);
        for (const m of src.matchAll(/url: '[^']*\?view=([a-z]+)'/g)) {
          if (MODE_WORDS.test(m[1])) {
            viewKeyErrors.push(`${idOf(sc.file)} — ?view=${m[1]}는 보기 모드다. ?view=는 목록에서 고른 레코드를 가리키므로 보기 모드는 ?mode=를 쓴다`);
          }
        }
        for (const m of src.matchAll(/views: \[([^\]]+)\]/g)) {
          const list = m[1].split(',').map((v) => v.trim().replace(/^'|'$/g, ''));
          const key = [...list].sort().join('|');
          const seen = orders.get(key);
          if (!seen) orders.set(key, { order: list.join(' · '), file: sc.file });
          else if (seen.order !== list.join(' · ')) {
            viewKeyErrors.push(`보기 세그먼트 순서가 화면마다 다르다 — 「${list.join(' · ')}」(${idOf(sc.file)}) vs 「${seen.order}」(${idOf(seen.file)}). 순서는 어디서나 같고, 어느 것이 열려 있는지는 view가 정한다`);
          }
        }
      }
    }
    return viewKeyErrors;
  },
};

// Reachability gate: the tree names ONE screen per menu entry, and that is where pressing the
// entry lands. Every other frame under the same entry has to be reachable from something — and
// on a board, what records that is a note pointing at it. A frame nobody points at and the tree
// does not land on is a screen a reader can only find by scrolling the board, which is not a way
// anybody navigates the product. Two shapes of this were live: sixteen frames added without an
// inbound edge, and five menu entries whose landing screen was a wizard or a detail rather than
// the list (the list sat lower in the manifest, and the manifest's order IS where the tree lands).
export const reachabilityGate = {
  id: 'reachabilityGate',
  title: '찾아갈 수 없는 화면이 있다',
  stage: 'built',
  run: (ctx) => {
    const reachErrors = [];
    {
      const inDeg = new Map(ctx.loaded.map((s) => [s.num, 0]));
      const menu = new Map();
      for (const s of ctx.loaded) {
        for (const m of String(s.mod.notes ?? '').matchAll(/\{\{([a-z]-\d{2,}[a-z]?-[a-z0-9-]+)\}\}/g)) {
          const t = idOf(m[1]);
          if (inDeg.has(t) && t !== s.num) inDeg.set(t, inDeg.get(t) + 1);
        }
        // Read the menu entry from the source, not the markup: a shell change would silently switch
        // this check off, and a check that can be switched off by an unrelated edit is not a check.
        let src = ctx.srcOf(s.file);
        // A state frame spreads its base (`...base`) and so carries no `current` of its own. Following
        // the import is what keeps it inside this check instead of quietly outside it — the 48 dialog
        // frames were outside it for exactly one build.
        const from = /from '\.\/([a-z0-9-]+)\.mjs'/.exec(src)?.[1];
        if (!/current: '/.test(src) && from) src = ctx.srcOf(from);
        const cur = /current: '([^']*)'/.exec(src)?.[1];
        if (!cur) continue;
        if (!menu.has(cur)) menu.set(cur, []);
        menu.get(cur).push(s);
      }
      for (const [cur, group] of menu) {
        if (group.length < 2) continue;
        for (const s of group.slice(1)) {
          if (inDeg.get(s.num) === 0) {
            reachErrors.push(`${s.num} — 「${cur}」 아래에 있으나 트리는 ${group[0].num}에 내려앉고, 아무 프레임도 이 화면을 가리키지 않는다`);
          }
        }
      }
    }
    return reachErrors;
  },
};

// The tree lands on the FIRST frame under an entry, and a state frame has no address of its own —
// it is a dialog, a panel form or a role-scoped variant that spreads its base. When one of those
// sorts first, pressing the entry opens a screen that cannot be opened directly, and on a board
// where the header no longer carries cross-links the tree is the only way in. Three entries were
// in this state at once (a panel form, an auditor's read-only variant, a fax dialog) and nothing
// said so: `reachabilityGate` was satisfied, because every frame in the group was pointed at.
//
// The fix is free — the manifest's order is the board's reading order and ids live in file names,
// so moving the state behind its base changes the brackets and nothing else.
export const landingIsAddressableGate = {
  id: 'landingIsAddressableGate',
  title: '메뉴 항목이 자기 주소가 없는 상태 프레임에 내려앉는다',
  stage: 'built',
  run: (ctx) => {
    const groups = new Map();
    for (const s of ctx.loaded) {
      let src = ctx.srcOf(s.file);
      const from = /from '\.\/([a-z0-9-]+)\.mjs'/.exec(src)?.[1];
      const state = !/current: '/.test(src) && !!from;
      if (state) src = ctx.srcOf(from);
      const cur = /current: '([^']*)'/.exec(src)?.[1];
      if (!cur) continue;
      if (!groups.has(cur)) groups.set(cur, []);
      groups.get(cur).push({ ...s, state });
    }
    const out = [];
    for (const [cur, group] of groups) {
      if (!group[0].state) continue;
      const own = group.find((s) => !s.state);
      if (!own) continue;
      out.push(`${group[0].num} — 「${cur}」의 첫 프레임인데 자기 주소가 없는 상태 프레임이다. `
        + `트리가 여기 내려앉으므로 ${own.num}를 매니페스트에서 앞으로 옮긴다`);
    }
    return out;
  },
};

// Control-vocabulary gates. Three things a button census found, each of which reads as a small
// inconsistency and costs a reader a guess every time they meet it.
export const controlVocabularyGate = {
  id: 'controlVocabularyGate',
  title: '버튼이 화면마다 다르게 말한다',
  stage: 'built',
  run: (ctx) => {
    const controlErrors = [];
    {
      for (const sc of ctx.screens) {
        const src = ctx.srcOf(sc.file);
        const id = idOf(sc.file);

        // 1. A row's first action opens what the row is, and the board calls that 「보기」 — 266 rows
        //    already do. 「상세」 is a noun standing in a verb's slot, and 「열기」 was used for the same
        //    act on 23 rows: three words for one thing, which a reader has to learn as three.
        for (const m of src.matchAll(/rowActions\(\[\s*'(상세|열기)'/g)) {
          controlErrors.push(`${id} — 행의 첫 액션이 「${m[1]}」다. 행에서 그 기록을 여는 것은 「보기」로 통일한다`);
        }

        // 2. A dialog must always be leavable without choosing. A merge dialog offering only
        //    「팩 것으로」 and 「둘 다 반영」 forces a decision from somebody who came to look.
        for (const m of src.matchAll(/foot:\s*(`[^`]*`|[^\n]*)/g)) {
          const foot = m[1];
          if (!/btn\(/.test(foot)) continue;
          if (!/(닫기|취소|나중에|이전)/.test(foot)) {
            controlErrors.push(`${id} — 다이얼로그에 고르지 않고 나갈 길이 없다 (닫기·취소·나중에 가운데 하나)`);
          }
        }

        // 3. A confirming verb belongs in the page header. Destructive and escape acts sit at the
        //    bottom on purpose — away from the primary — but 저장·제출·발급 only at the bottom of a
        //    long page means the screen's main act is where nobody looks.
        const head = /pageHeader\(\{[\s\S]*?actions:\s*([\s\S]*?)\n\s*\}\)/.exec(src)?.[1] ?? '';
        const tail = [...src.matchAll(/btnRow\(([\s\S]*?)\),\n/g)].map((m) => m[1]).join(' ');
        for (const verb of ['저장', '제출', '발급']) {
          const inTail = new RegExp(`btn\\('${verb}'\\s*,\\s*'primary'`).test(tail);
          if (inTail && !head.includes(`'${verb}'`)) {
            controlErrors.push(`${id} — 「${verb}」 버튼이 페이지 맨 아래에만 있다. 확정 동작은 pageHeader에도 둔다`);
          }
        }
      }
    }
    return controlErrors;
  },
};

// Panel-verb gate: where a record has a page of its own, the list panel's main button must say
// 「열기」 and not 「편집」. Labelling it 「편집」 sends a reader who came to READ through an edit
// verb, and lands them on a page that shows MORE than the panel did — the peek and the record
// swap places, and the screen stops explaining itself. Which lists have a page behind them is not
// a judgement: the ledger says so when an entity's `read` is a frame other than its `list`.
export const panelVerbGate = {
  id: 'panelVerbGate',
  title: '패널 주 버튼이 화면을 잘못 말한다',
  stage: 'built',
  run: (ctx) => {
    const { LEDGER, NON_ENTITY } = ledgerOf(ctx);
    // No ledger means the board does not keep a CRUD census. Skipping is right: the census is
    // a discipline a board opts into, and reporting every route as unaccounted for would make
    // the gate noise on every board that has not.
    if (!LEDGER) return [];
    const panelVerbErrors = [];
    {
      const bodyOf = new Map(ctx.loaded.map((s) => [s.num, String(s.mod.body ?? '')]));
      for (const [entity, row] of Object.entries(LEDGER)) {
        const { list, read } = row;
        if (typeof list !== 'string' || typeof read !== 'string') continue;
        if (list === read || read === 'generic' || list === 'generic') continue;
        if (row.inFrame?.read) continue;              // the panel IS the detail
        const body = bodyOf.get(list);
        if (!body) continue;
        const foot = /<div class="ld-foot">([\s\S]*?)<\/div><\/aside>/.exec(body);
        const primary = foot && /class="btn primary">([^<]+)</.exec(foot[1]);
        if (primary && primary[1].includes('편집')) {
          panelVerbErrors.push(`${list} — ${entity}의 레코드 페이지가 ${read}에 따로 있으므로 패널 주 버튼은 「편집」이 아니라 「열기」다`);
        }
      }
    }
    return panelVerbErrors;
  },
};

// Back-control gate: a full page opened from a list has to say which list it came from. The tree
// on the left cannot do that job — it says where you ARE, and pressing its entry reopens the list
// fresh, losing the filter and the page the reader left behind. Which frames owe one is not a
// judgement call: the CRUD ledger already names each entity's list, so any create/read/update/
// remove frame that is a page of its own owes a `back` naming it.
export const backControlGate = {
  id: 'backControlGate',
  title: '목록으로 돌아가는 자리가 없다',
  stage: 'built',
  run: (ctx) => {
    const { LEDGER, NON_ENTITY } = ledgerOf(ctx);
    // No ledger means the board does not keep a CRUD census. Skipping is right: the census is
    // a discipline a board opts into, and reporting every route as unaccounted for would make
    // the gate noise on every board that has not.
    if (!LEDGER) return [];
    const backMissing = [];
    {
      const bodyOf = new Map(ctx.loaded.map((s) => [s.num, String(s.mod.body ?? '')]));
      const seen = new Set();
      for (const [entity, row] of Object.entries(LEDGER)) {
        const list = row.list;
        if (typeof list !== 'string' || list === 'generic') continue;
        for (const verb of ['create', 'read', 'update', 'remove']) {
          const at = row[verb];
          if (typeof at !== 'string' || at === 'generic' || at === list) continue;
          if (row.inFrame?.[verb]) continue;            // the verb lives inside another frame
          if (seen.has(at) || !bodyOf.has(at)) continue;
          seen.add(at);
          if (!bodyOf.get(at).includes('ph-back')) {
            backMissing.push(`${at} — ${entity}.${verb}이므로 ${list} 목록으로 돌아가는 자리가 있어야 한다 (pageHeader의 back)`);
          }
        }
      }
    }
    return backMissing;
  },
};
