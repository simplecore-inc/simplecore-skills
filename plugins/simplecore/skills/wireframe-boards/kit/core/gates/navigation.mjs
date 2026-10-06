// Gates on how a reader moves: the CRUD ledger every route is accounted for in, whether a
// frame can be reached at all, and the words the controls use to say the same act.
import { idOf } from '../ids.mjs';
// The ledger is the BOARD's, not the kit's - it names that product's entities. It arrives on
// ctx so a gate written here judges any board, and a board that keeps no ledger simply skips
// the three gates that read it rather than failing to import.
const ledgerOf = (ctx) => ({ LEDGER: ctx.crud?.LEDGER ?? null, NON_ENTITY: ctx.crud?.NON_ENTITY ?? {} });

// CRUD gate: a board grows one screen at a time, and the screen that gets drawn is the
// interesting one - the detail with the gate, the form with the legal trap. The list nobody
// argues about, the edit that is "just a form", and the delete that "we'll figure out later" go
// missing silently, because a board full of good screens looks finished. So every route is
// accounted for in `src/crud.mjs`: either it belongs to an entity whose five verbs each name a
// frame, or it is listed as a non-entity with the reason it has no CRUD of its own. A new screen
// whose route is in neither place stops the build, which is the moment to ask where its list,
// its edit, and its delete are.
export const crudGate = {
  id: 'crudGate',
  title: 'the CRUD ledger does not match the board (src/crud.mjs)',
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
          if (at == null) { crudErrors.push(`${entity}.${verb} - missing (a frame id · 'generic' · { waived })`); continue; }
          if (at === 'generic') continue;
          if (typeof at === 'object') {
            if (!String(at.waived ?? '').trim()) crudErrors.push(`${entity}.${verb} - waived gives no reason`);
            continue;
          }
          if (!frameIds.has(at)) crudErrors.push(`${entity}.${verb} - frame ${at} does not exist`);
        }
      }
      // A route is accounted for when some frame the ledger names carries it - the verb entries and
      // the `also` list together are the entity's frames - or when NON_ENTITY says why it has none.
      const ledgerFrames = new Set();
      for (const row of Object.values(LEDGER)) {
        for (const verb of VERBS) if (typeof row[verb] === 'string' && row[verb] !== 'generic') ledgerFrames.add(row[verb]);
        for (const id of row.also ?? []) ledgerFrames.add(id);
      }
      for (const id of ledgerFrames) if (!frameIds.has(id)) crudErrors.push(`${id} - the ledger names a frame that does not exist`);
      const claimedRoutes = new Set(Object.keys(NON_ENTITY));
      for (const s of ctx.loaded) if (ledgerFrames.has(s.num) && s.mod.route) claimedRoutes.add(s.mod.route);
      for (const s of ctx.loaded) {
        const route = s.mod.route ?? '';
        if (!route) continue;                       // the P cluster is the generic pattern itself
        if (claimedRoutes.has(route)) {
          if (Object.hasOwn(NON_ENTITY, route) && !String(NON_ENTITY[route]).trim()) {
            crudErrors.push(`${route} - NON_ENTITY gives no reason`);
          }
          continue;
        }
        crudErrors.push(`${s.num} ${route} - in no entity of crud.mjs and not in NON_ENTITY`);
      }
    }
    return crudErrors;
  },
};

// View-switch vocabulary gate. Two things the persona review found once the switch existed on five
// screens, both of which read as trivia and both of which cost a reader a guess every time.
//
// 1. `?view=` already means ONE thing on this board - the record picked out of the list, across
//    ninety frames (`?view=cti_0119`). The first cut of the calendar switch borrowed the same key
//    for the view mode (`?view=month`), copying it from the pattern frame, so one parameter meant
//    a record on one frame and a layout on the next. The view mode is `?mode=`.
// 2. A segment control that offers the same two things in a different order on a different screen
//    is two controls to learn. E-05 drew 「달력 · 목록」 while the other four drew 「목록 · 달력」,
//    because its default view is the calendar - but the DEFAULT is `view`, not the order.
export const viewSwitchGate = {
  id: 'viewSwitchGate',
  title: 'view switching is written differently from screen to screen',
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
            viewKeyErrors.push(`${idOf(sc.file)} - ?view=${m[1]} is a view mode. ?view= points at the record picked from the list, so a view mode takes ?mode=`);
          }
        }
        for (const m of src.matchAll(/views: \[([^\]]+)\]/g)) {
          const list = m[1].split(',').map((v) => v.trim().replace(/^'|'$/g, ''));
          const key = [...list].sort().join('|');
          const seen = orders.get(key);
          if (!seen) orders.set(key, { order: list.join(' · '), file: sc.file });
          else if (seen.order !== list.join(' · ')) {
            viewKeyErrors.push(`the view segments are ordered differently - 「${list.join(' · ')}」 (${idOf(sc.file)}) vs 「${seen.order}」 (${idOf(seen.file)}). The order is the same everywhere, and view says which one is open`);
          }
        }
      }
    }
    return viewKeyErrors;
  },
};

// Reachability gate: the tree names ONE screen per menu entry, and that is where pressing the
// entry lands. Every other frame under the same entry has to be reachable from something - and
// on a board, what records that is a note pointing at it. A frame nobody points at and the tree
// does not land on is a screen a reader can only find by scrolling the board, which is not a way
// anybody navigates the product. Two shapes of this were live: sixteen frames added without an
// inbound edge, and five menu entries whose landing screen was a wizard or a detail rather than
// the list (the list sat lower in the manifest, and the manifest's order IS where the tree lands).
export const reachabilityGate = {
  id: 'reachabilityGate',
  title: 'a screen cannot be reached',
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
        // the import is what keeps it inside this check instead of quietly outside it - the 48 dialog
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
            reachErrors.push(`${s.num} - under 「${cur}」 the tree lands on ${group[0].num}, and no frame points at this screen`);
          }
        }
      }
    }
    return reachErrors;
  },
};

// A button that names where it leads names a frame that exists. The target is read by whatever
// derives flow from the built board - a chapter generator walking a persona through the screens -
// and a reader that meets an id no frame carries does not error: it falls back to guessing from
// the label, and the walk it produces reads exactly like one derived from a correct target. So a
// typo in `btn('탐지', 'primary', 'P-4b 탐지')` is a silent defect, and silent is the whole reason
// this is a gate. A target that does not begin with an id is the pattern's own text link and is
// left alone; a target that begins like an id and is not one is reported by shape.
const ID_HEAD = /^([A-Z]-\d{2}[a-z]?)(?=\s|$)/;
const ID_LIKE = /^[A-Za-z]-\d/;

/** Every string a loaded screen module renders, to the depth its toolbar and panes nest. */
function renderedStrings(value, depth = 0, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (value && typeof value === 'object' && depth < 4) {
    for (const v of Object.values(value)) renderedStrings(v, depth + 1, out);
  }
  return out;
}

export const targetGate = {
  id: 'targetGate',
  title: 'a target points at a frame that does not exist',
  stage: 'built',
  run: (ctx) => {
    const errors = [];
    const ids = new Set(ctx.loaded.map((s) => s.num));
    for (const s of ctx.loaded) {
      for (const html of renderedStrings(s.mod)) {
        for (const m of html.matchAll(/data-target="([^"]*)"/g)) {
          const target = m[1].trim();
          const id = ID_HEAD.exec(target)?.[1];
          if (id) {
            if (!ids.has(id)) errors.push(`${s.num} - ${id} in the target 「${target}」 is not a frame on this board`);
          } else if (ID_LIKE.test(target)) {
            errors.push(`${s.num} - the target 「${target}」 reads like it starts with a frame id and is not one in shape (\`A-01a\`)`);
          }
        }
      }
    }
    return errors;
  },
};

// The tree lands on the FIRST frame under an entry, and a state frame has no address of its own -
// it is a dialog, a panel form or a role-scoped variant that spreads its base. When one of those
// sorts first, pressing the entry opens a screen that cannot be opened directly, and on a board
// where the header no longer carries cross-links the tree is the only way in. Three entries were
// in this state at once (a panel form, an auditor's read-only variant, a fax dialog) and nothing
// said so: `reachabilityGate` was satisfied, because every frame in the group was pointed at.
//
// The fix is free - the manifest's order is the board's reading order and ids live in file names,
// so moving the state behind its base changes the brackets and nothing else.
export const landingIsAddressableGate = {
  id: 'landingIsAddressableGate',
  title: 'a menu entry lands on a state frame with no address of its own',
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
      out.push(`${group[0].num} - the first frame of 「${cur}」 is a state frame with no address of its own. `
        + `The tree lands here, so move ${own.num} ahead of it in the manifest`);
    }
    return out;
  },
};

// The landing frame is where the tree puts a reader who has picked nothing yet, so its route must
// be openable with nothing in hand. A route carrying a path parameter (`/workers/:id/exposure`,
// `/loto/:permitId`) needs a record chosen first, and pressing the entry then opens a record the
// reader never picked - usually the seed's first row, which reads as the screen working.
//
// **Judging that in general takes eyes**, because a parameter a global control settles is fine:
// a console with a site selector opens `/sites/:id/areas` for the site already on screen. What a
// machine CAN settle is the case where the entry's own group already holds a parameter-free route
// and merely sorts it later - then the list exists, the tree lands past it, and the fix is free.
// The other shape (no parameter-free frame under the entry at all) is a missing list or a settled
// singleton, and `references/living-contract.md` carries the four-way judgement for it.
//
// This hid behind the page header for as long as the header carried cross-links: a reader arrived
// at the record page from another screen's button with the record already chosen, so the entry's
// own landing was never the way anybody got there. Taking those buttons out is what exposed it.
export const landingIsTheListGate = {
  id: 'landingIsTheListGate',
  title: 'a menu entry lands on a record address instead of its list',
  stage: 'built',
  run: (ctx) => {
    /** A route that cannot be opened without a record already chosen. */
    const needsRecord = (route) => /\/:[A-Za-z]/.test(route);
    const groups = new Map();
    for (const s of ctx.loaded) {
      let src = ctx.srcOf(s.file);
      // A state frame spreads its base and has no address of its own; `landingIsAddressableGate`
      // owns that case, so follow the import here and judge the base's route instead.
      const from = /from '\.\/([a-z0-9-]+)\.mjs'/.exec(src)?.[1];
      if (!/current: '/.test(src) && from) src = ctx.srcOf(from);
      const cur = /current: '([^']*)'/.exec(src)?.[1];
      if (!cur) continue;
      const route = /^ {2}route: '([^']+)'/m.exec(src)?.[1] ?? /route: '([^']+)'/.exec(src)?.[1];
      if (!route) continue;
      if (!groups.has(cur)) groups.set(cur, []);
      groups.get(cur).push({ ...s, route });
    }
    const out = [];
    for (const [cur, group] of groups) {
      if (!needsRecord(group[0].route)) continue;
      const list = group.find((s) => !needsRecord(s.route));
      if (!list) continue;
      out.push(`${group[0].num} - 「${cur}」 lands here and ${group[0].route} opens only once a record is picked. `
        + `${list.num} (${list.route}) under the same entry is the list, so move it ahead in the manifest`);
    }
    return out;
  },
};

// Control-vocabulary gates. Three things a button census found, each of which reads as a small
// inconsistency and costs a reader a guess every time they meet it.
export const controlVocabularyGate = {
  id: 'controlVocabularyGate',
  title: 'a button is worded differently from screen to screen',
  stage: 'built',
  run: (ctx) => {
    const controlErrors = [];
    {
      for (const sc of ctx.screens) {
        const src = ctx.srcOf(sc.file);
        const id = idOf(sc.file);

        // 1. A row's first action opens what the row is, and the board calls that 「보기」 - 266 rows
        //    already do. 「상세」 is a noun standing in a verb's slot, and 「열기」 was used for the same
        //    act on 23 rows: three words for one thing, which a reader has to learn as three.
        for (const m of src.matchAll(/rowActions\(\[\s*'(상세|열기)'/g)) {
          controlErrors.push(`${id} - a row's first action is 「${m[1]}」. Opening the record from a row is 「보기」 everywhere`);
        }

        // 2. A dialog must always be leavable without choosing. A merge dialog offering only
        //    「팩 것으로」 and 「둘 다 반영」 forces a decision from somebody who came to look.
        for (const m of src.matchAll(/foot:\s*(`[^`]*`|[^\n]*)/g)) {
          const foot = m[1];
          if (!/btn\(/.test(foot)) continue;
          if (!/(닫기|취소|나중에|이전)/.test(foot)) {
            controlErrors.push(`${id} - the dialog has no way out without choosing (one of 「닫기」 · 「취소」 · 「나중에」)`);
          }
        }

        // 3. A confirming verb belongs in the page header. Destructive and escape acts sit at the
        //    bottom on purpose - away from the primary - but 저장·제출·발급 only at the bottom of a
        //    long page means the screen's main act is where nobody looks.
        const head = /pageHeader\(\{[\s\S]*?actions:\s*([\s\S]*?)\n\s*\}\)/.exec(src)?.[1] ?? '';
        const tail = [...src.matchAll(/btnRow\(([\s\S]*?)\),\n/g)].map((m) => m[1]).join(' ');
        for (const verb of ['저장', '제출', '발급']) {
          const inTail = new RegExp(`btn\\('${verb}'\\s*,\\s*'primary'`).test(tail);
          if (inTail && !head.includes(`'${verb}'`)) {
            controlErrors.push(`${id} - the 「${verb}」 button is only at the foot of the page. A confirming action also goes in pageHeader`);
          }
        }
      }
    }
    return controlErrors;
  },
};

// Panel-verb gate: where a record has a page of its own, the list panel's main button must say
// 「열기」 and not 「편집」. Labelling it 「편집」 sends a reader who came to READ through an edit
// verb, and lands them on a page that shows MORE than the panel did - the peek and the record
// swap places, and the screen stops explaining itself. Which lists have a page behind them is not
// a judgement: the ledger says so when an entity's `read` is a frame other than its `list`.
export const panelVerbGate = {
  id: 'panelVerbGate',
  title: 'the panel\'s main button names the wrong screen',
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
          panelVerbErrors.push(`${list} - ${entity} has a record page of its own at ${read}, so the panel\'s main button is 「열기」, not 「편집」`);
        }
      }
    }
    return panelVerbErrors;
  },
};

// Back-control gate: a full page opened from a list has to say which list it came from. The tree
// on the left cannot do that job - it says where you ARE, and pressing its entry reopens the list
// fresh, losing the filter and the page the reader left behind. Which frames owe one is not a
// judgement call: the CRUD ledger already names each entity's list, so any create/read/update/
// remove frame that is a page of its own owes a `back` naming it.
export const backControlGate = {
  id: 'backControlGate',
  title: 'there is no way back to the list',
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
            backMissing.push(`${at} - as ${entity}.${verb} it owes a way back to the ${list} list (the back of pageHeader)`);
          }
        }
      }
    }
    return backMissing;
  },
};
