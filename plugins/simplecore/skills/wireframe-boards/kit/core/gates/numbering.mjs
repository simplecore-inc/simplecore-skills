// Gates on the numbering scheme: the permanent id, the pairs that share one, and the
// references that name a screen by it.
import { idOf } from '../ids.mjs';

// A permanent id has to be present, belong to its section, and be shared by nothing except the
// two halves of one responsive screen. Each failure produces a board whose numbers cannot be
// trusted, so the build refuses rather than emitting one.
export const idGate = {
  id: 'idGate',
  title: '영구 id가 맞지 않는다',
  stage: 'preflight',
  run: (ctx) => {
    const idErrors = [];
    const byId = new Map();
    for (const sec of ctx.sections) {
      for (const e of sec.entries) {
        if (!e.id) {
          idErrors.push(`${e.file}: file name carries no permanent id — name it <letter>-<nn>-<slug>.mjs`);
          continue;
        }
        if (!e.id.startsWith(`${sec.letter}-`)) {
          idErrors.push(`${e.file}: id ${e.id} does not belong to section ${sec.letter}`);
        }
        if (!byId.has(e.id)) byId.set(e.id, []);
        byId.get(e.id).push(e);
      }
    }
    for (const [id, group] of byId) {
      if (group.length === 1) continue;
      const files = group.map((e) => e.file).join(', ');
      // Two files may share an id only as one screen's narrow and wide halves — the viewport toggle
      // shows one at a time, so they are one screen×state, not two.
      const variants = group.map((e) => e.mod.variant);
      const isPair =
        group.length === 2 && variants.includes('narrow') && variants.includes('wide');
      if (!isPair) {
        idErrors.push(
          `id ${id} is used by ${group.length} screens (${files}) — an id is shared only by the narrow and wide halves of one responsive screen`
        );
      }
    }
    return idErrors;
  },
};

// Slug gate: `resolveRefs` turns `{{f-12-foreign-basic}}` into "F-12" by reading the number and
// nothing else, so a note that names an EXISTING id with the wrong tail resolves silently and
// points the reader at a different screen — worse than the visible `{{slug?}}`, because it looks
// right. A reference whose number is drawn must match that frame's file name exactly; a number
// that is not drawn yet is a forward reference and stays allowed.
export const slugGate = {
  id: 'slugGate',
  title: '참조 슬러그가 그 번호의 화면과 다르다',
  stage: 'built',
  run: (ctx) => {
    const fileById = new Map(ctx.loaded.map((s) => [s.num, s.file]));
    const wrongSlugs = [];
    for (const s of ctx.loaded) {
      for (const m of String(s.mod.notes ?? '').matchAll(/\{\{([a-z]-\d{2,}[a-z]?-[a-z0-9-]+)\}\}/g)) {
        const slug = m[1];
        const id = idOf(slug);
        if (!id || !fileById.has(id)) continue;     // not drawn yet — a forward reference
        if (fileById.get(id) !== slug) {
          wrongSlugs.push(`${s.file}: {{${slug}}} → ${id}는 ${fileById.get(id)}다`);
        }
      }
    }
    return wrongSlugs;
  },
};

// Forward-reference gate: a note may point at a frame that is not drawn yet — the whole point of
// drawing clusters in order — and the build leaves it visible as `{{slug?}}` so it fails loudly
// rather than disappearing. What it cannot see on its own is TWO notes naming the same future
// screen by different numbers (`j-04-evidence-package` and `j-09-evidence-package`): both render
// as an honest-looking unresolved marker, and only one of them will be right when that cluster is
// drawn. The tail after the number is the screen's name, so one tail with two numbers is a
// disagreement to settle now, while both notes are in hand.
export const refTailGate = {
  id: 'refTailGate',
  title: '같은 화면을 두 번호로 참조한다',
  stage: 'built',
  run: (ctx) => {
    const refTails = new Map();
    for (const s of ctx.loaded) {
      for (const m of String(s.mod.notes ?? '').matchAll(/\{\{([a-z])-(\d{2,}[a-z]?)-([a-z0-9-]+)\}\}/g)) {
        const tail = `${m[1]}-${m[3]}`;
        if (!refTails.has(tail)) refTails.set(tail, new Map());
        refTails.get(tail).set(m[2], s.file);
      }
    }
    const refClashes = [];
    for (const [tail, nums] of refTails) {
      if (nums.size < 2) continue;
      refClashes.push(`${tail} — ${[...nums].map(([n, f]) => `${n} (${f})`).join(' vs ')}`);
    }
    return refClashes;
  },
};

// The same disagreement runs the other way and the check above cannot see it: TWO different screen
// names claiming ONE future number (`o-05-work-quality` and `o-05-working-hours`). Both render as
// an honest-looking `{{slug?}}`, and when that cluster is drawn only one of them resolves while the
// other silently keeps pointing at a screen it does not mean. Three notes had drifted onto a number
// that belonged to a fourth. The number is the address, so one address with two names is a
// disagreement to settle while the notes are still in hand.
export const refNumGate = {
  id: 'refNumGate',
  title: '한 번호를 두 화면 이름으로 참조한다',
  stage: 'built',
  run: (ctx) => {
    const refNums = new Map();
    for (const s of ctx.loaded) {
      for (const m of String(s.mod.notes ?? '').matchAll(/\{\{([a-z])-(\d{2,}[a-z]?)-([a-z0-9-]+)\}\}/g)) {
        const num = `${m[1].toUpperCase()}-${m[2]}`;
        if (!refNums.has(num)) refNums.set(num, new Map());
        refNums.get(num).set(m[3], s.file);
      }
    }
    const numClashes = [];
    for (const [num, tails] of refNums) {
      if (tails.size < 2) continue;
      numClashes.push(`${num} — ${[...tails].map(([t, f]) => `${t} (${f})`).join(' vs ')}`);
    }
    return numClashes;
  },
};

// Pair gate: a base file that exports `screenBody` promises an ordinary state and at least one
// other, and each of the others is a separate frame importing it. A base with none draws a state
// nobody can reach the ordinary page of, and a state frame whose base does not export `screenBody`
// is a rename that left one half behind.
//
// The count used to be pinned at exactly one, which held while a dialog was the only second state
// a screen could have. It cannot: 점검 계획 carries 할당 규칙 open AND a 달력 보기. Pinning it would
// have forced the second state into a drawing of its own, which is the single thing this pairing
// exists to prevent.
export const pairGate = {
  id: 'pairGate',
  title: '닫힌 상태와 열린 상태가 짝이 맞지 않는다',
  stage: 'built',
  run: (ctx) => {
    const pairErrors = [];
    {
      const bases = new Set(), states = new Map();
      for (const sc of ctx.screens) {
        const src = ctx.srcOf(sc.file);
        if (/export const screenBody/.test(src)) bases.add(sc.file);
        const from = /import base, \{[^}]*screenBody[^}]*\} from '\.\/([a-z0-9-]+)\.mjs'/.exec(src)?.[1];
        if (from) states.set(sc.file, from);
      }
      const counted = new Map();
      for (const [, base] of states) counted.set(base, (counted.get(base) ?? 0) + 1);
      for (const b of bases) {
        const n = counted.get(b) ?? 0;
        if (n === 0) pairErrors.push(`${idOf(b)} — screenBody를 내보내는데 그것을 쓰는 상태 프레임이 없다`);
      }
      for (const [f, base] of states) {
        if (!bases.has(base)) pairErrors.push(`${idOf(f)} — ${base}에서 screenBody를 가져오는데 그쪽이 내보내지 않는다`);
      }
    }
    return pairErrors;
  },
};
