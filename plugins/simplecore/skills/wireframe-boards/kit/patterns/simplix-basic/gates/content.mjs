// Gates on what a frame says: the register its copy is written in, the shape of a title,
// and the two layouts a screen must not stack on one page.
import { idOf } from '../../../core/ids.mjs';

// Content gate: a section can be present while a frame has quietly lost what it promises —
// a refactor or a bad merge leaves the label intact and the drawing gone, and a gate that
// counts sections passes it. The manifest label is the frame's contract, so a frame the
// label calls a dialog has to draw one. Checked against the screen module rather than the
// rendered HTML so a failure names the source file. Add your own label conventions here.
export const hollowDialogGate = {
  id: 'hollowDialogGate',
  title: '라벨은 다이얼로그인데 그리지 않는다',
  stage: 'built',
  run: (ctx) => {
    const DIALOG_LABEL = /dialog|다이얼로그/i;
    return ctx.loaded
      .filter((s) => DIALOG_LABEL.test(s.label) && !/class="(modal|sheet)\b/.test(s.mod.overlay ?? ''))
      .map((s) => `${s.num} (${s.file})`);
  },
};

// A badge is a fact ABOUT a field; the input is where the field's value goes. Put one inside a
// single-line input and the two fight for a 30px box — 「켬」 and 「환경 제약 · 자동번역」 sat on top
// of the select's caret, and a reader cannot tell which part of that box is the value they are
// choosing. It belongs in the hint under the input, or beside the label. Multi-value fields are
// the exception and the reason the check names the components rather than the word `value`:
// `fMulti` draws chips and badges by design, in a box that wraps.
export const fieldBadgeGate = {
  id: 'fieldBadgeGate',
  title: '한 줄 입력칸 안에 배지가 있다',
  stage: 'built',
  run: (ctx) => {
    // `[^}]*` cannot read these calls: a template literal's own `${…}` closes the class on the
    // first brace, so the one shape being looked for is exactly the shape that escapes. Both the
    // call and the value expression are scanned with a depth counter instead.
    const OPEN = /\bf(?:Text|Select|Num|I18n)\(\{/g;
    const BADGE = /\b(?:envBadge|aiBadge|sourceBadge|badge)\(/;
    const spanFrom = (src, start, stops) => {
      let i = start, depth = 0, out = '';
      while (i < src.length) {
        const c = src[i];
        if ('({['.includes(c)) depth++;
        else if (')}]'.includes(c)) { if (depth === 0) break; depth--; }
        else if (depth === 0 && stops.includes(c)) break;
        out += c; i++;
      }
      return { text: out, end: i };
    };
    const bad = [];
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      for (const m of src.matchAll(OPEN)) {
        const call = spanFrom(src, m.index + m[0].length, '');
        const v = /\bvalue:\s*/.exec(call.text);
        if (!v) continue;
        const value = spanFrom(call.text, v.index + v[0].length, ',').text;
        if (!BADGE.test(value)) continue;
        bad.push(`${idOf(sc.file)} — 배지는 입력칸이 아니라 hint나 라벨 옆에 둔다: ${m[0]}… value: ${value.trim().slice(0, 48)}`);
        break;
      }
    }
    return bad;
  },
};

// The panel's two rows carry different things: the upper is what the OPEN TAB asks for, the lower
// is what is done to the RECORD. A verb standing in both says neither — 「세션 열기」 above and
// 「세션 열기」 below leaves no way to tell which one is this record's主 action, and it cost the
// lower row's emphasis on 32 screens before anybody counted them.
export const panelDupVerbGate = {
  id: 'panelDupVerbGate',
  title: '패널의 두 단에 같은 동사가 있다',
  stage: 'built',
  run: (ctx) => {
    const span = (src, fn) => {
      const i = src.indexOf(`${fn}(`);
      if (i < 0) return '';
      let depth = 0;
      for (let j = i + fn.length; j < src.length; j++) {
        const c = src[j];
        if ('([{'.includes(c)) depth++;
        else if (')]}'.includes(c) && --depth === 0) return src.slice(i, j + 1);
      }
      return '';
    };
    const verbs = (t) => [...t.matchAll(/btn\('([^']+)'/g)].map((m) => m[1]);
    const bad = [];
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      const up = new Set(verbs(span(src, 'panelVerbs')));
      const dup = [...new Set(verbs(span(src, 'panelFoot')).filter((v) => up.has(v)))];
      if (dup.length) {
        bad.push(`${idOf(sc.file)} — 「${dup.join('」·「')}」가 윗단과 아랫단에 다 있다. ` +
          '윗단은 열린 탭이 요구하는 것, 아랫단은 레코드에 하는 것이다');
      }
    }
    return bad;
  },
};

// A frame says on its face what has to be BOUGHT before anyone reaches it. Q and R carry no
// `phase` — they are built in 1단계 — and yet none of their 39 frames opens without
// `PACK_CONSTRUCTION`, which the board stated nowhere at all until this gate existed. Filling
// the frames once is not the job: the job is that the next cluster cannot land empty.
//
// Three things are checked, and the first reads the BUILT HTML rather than the declaration —
// a declaration that never reached a drawing is exactly the failure a declaration cannot see.
export const featureGate = {
  id: 'featureGate',
  title: '기능 관문이 프레임에 닿지 않았다',
  stage: 'built',
  run: (ctx) => {
    const bad = [];
    const declared = new Map();          // id → key
    for (const sec of ctx.manifest) {
      for (const sc of sec.screens ?? []) {
        const key = sc.feature ?? sec.feature ?? null;
        if (key) declared.set(idOf(sc.file), key);
      }
    }
    // 1) Did the declaration reach the drawing — does the built HTML's chip count match it?
    const drawn = (ctx.html.match(/class="fft"/g) ?? []).length;
    if (drawn !== declared.size) {
      bad.push(`선언한 화면 ${declared.size}개인데 칩이 그려진 프레임은 ${drawn}개다 — ` +
        '상태 프레임은 기준 화면을 펼치므로 선언이 함께 따라와야 한다');
    }
    for (const sc of ctx.screens) {
      const id = idOf(sc.file);
      const src = ctx.srcOf(sc.file);
      // 「기능 키 X」 must not be read out of a table cell inside the screen — N-63 carried those
      // words in a device row and passed while its notes never named the key once. Only the notes
      // string is read.
      const notes = (src.match(/\n  notes: ([\s\S]*?)\n  (?:body|device|route|screen|state|pageForm|pageList|pageCanvas|pageCalendar|offLanguages|roles):/) ?? [])[1] ?? '';
      const auth = (notes.match(/기능 키 ([A-Z_]+)/) ?? [])[1] ?? null;
      const key = declared.get(id) ?? null;
      // `notes: base.notes + '…'` inherits the base screen's line verbatim, so a key written there
      // is written here too. Only a frame carrying notes of its own is asked.
      const ownNotes = /\n  notes: /.test(src) && !/notes: base\.notes/.test(src);
      // 2) Did the drawing reach the declaration — read from both sides.
      if (auth && !key) bad.push(`${id} — notes는 「기능 키 ${auth}」인데 manifest가 선언하지 않았다`);
      else if (auth && key && auth !== key) bad.push(`${id} — notes ${auth} ≠ manifest ${key}`);
      else if (key && !auth && ownNotes) {
        bad.push(`${id} — manifest는 ${key}를 선언했는데 notes가 그 키를 한 번도 적지 않는다 — ` +
          '칩은 낱말이고 구현하는 쪽이 거는 것은 키다');
      }
      // 3) A key outside the catalogue.
      if (auth && !ctx.config.features?.[auth]) {
        bad.push(`${id} — 「${auth}」는 board.config.mjs의 features에 없다`);
      }
    }
    return bad;
  },
};

// Korean title gate: a title is a NAME, so it takes a noun form. 「~한다」/「~다」 there reads as a
// sentence cut in half, and 「~하는 것」 is translationese. A regex over prose cannot judge this —
// the same 「~한다」 is correct in a sentence — but the board knows which strings are titles,
// because they are the arguments of tTitle() and the `title` of a page header.
export const titleFormGate = {
  id: 'titleFormGate',
  title: '제목이 문장이다',
  stage: 'built',
  run: (ctx) => {
    // Judged at two call sites only: the name of a page and the name of a dialog. `tTitle` is NOT
    // one of them — this board writes a help heading as the rule it explains (「갈음 관계 — 한 기록이
    // 두 의무를 채운다」), and that is the convention, not a defect. `msg` and `emptyState` titles
    // are the product speaking to a user and are sentences on purpose.
    const TITLE_CALL = /([\s\S]{0,80})title:\s*'([^']+)'/g;
    // Any 「~다」 ending, not a list of them — a closed list let 「읽힌다」·「뗀다」·「잡힌다」 past.
    // 「~니다」 is the polite register and is judged separately below.
    const SENTENCE_END = /[가-힣]다$/;
    const badTitles = [];
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      for (const m of src.matchAll(TITLE_CALL)) {
        const before = m[1] ?? '';
        const text = (m[2] ?? '').trim();
        if (!/[가-힣]/.test(text)) continue;
        if (!/(dialog|pageHeader)\(\s*\{[^}]*$/.test(before)) continue;
        // A help dialog's title states the rule it explains — 「자리마다 보고 기한이 다르다」 is the
        // board's convention for the thing behind a help card, and the card's own title matches it.
        // The name it is bound to is what separates the two: `help` explains, everything else acts.
        if (/(const|let)\s+help\s*=\s*dialog\(\s*\{[^}]*$/.test(before)) continue;
        // A question is the board's help convention and is a title on purpose.
        if (/(까요\?|\?|는가|은가|인가|나요)$/.test(text)) continue;
        if (/(습니다|입니다|하세요)$/.test(text)) {
          badTitles.push(`${sc.file}: 「${text}」 — 화면과 다이얼로그의 이름은 명사형으로`);
          continue;
        }
        if (/니다$/.test(text)) continue;
        if (SENTENCE_END.test(text)) badTitles.push(`${sc.file}: 「${text}」 — 제목은 명사형으로`);
        else if (/하는 것$|되는 것$|없는 것$|있는 것$/.test(text)) badTitles.push(`${sc.file}: 「${text}」 — 「~하는 것」은 번역투다`);
      }
    }
    return badTitles;
  },
};

// Register gate: a `.t-body` line is drawn INSIDE the screen, so a reader takes it for product
// copy — and product copy is 합니다체. A frame's `notes` are the board talking about the screen
// and stay -다체, which is why this looks at the one marker that only ever wraps screen copy
// instead of at the file. The l10n rule pack cannot see it: its readers strip HTML markup, and
// the marker is the markup.
// The board stands on one day (`board.config.mjs` → `today`), and three kinds of value are only
// readable against it. Each of these was found by a reviewer doing the arithmetic by hand.

/** Turn `2026-08-12` into a day number, so two dates can be subtracted. */
const dayNum = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
};

export const dDayGate = {
  id: 'dDayGate',
  title: 'D-n 배지가 그 날짜와 맞다',
  stage: 'built',
  run: (ctx) => {
    // Every dated value on a board is only readable against a fixed today, and a board that
    // has not declared one has nothing to compare against. Skipping is right — inventing a
    // today would judge the frames against a date nobody chose.
    if (!ctx.config.today) return [];
    // 「기한 2026-08-16 · D-5」 — the badge and the date it counts to sit within a few characters
    // of each other, which is what makes this checkable at all. Three narrowings were needed:
    // 「AUD-2026-02」 is not a D-day (a letter runs into the D), a date already past is not what a
    // D-n counts to (「사유 종료 2026-08-06」 sat in the same cell as a badge counting to the
    // deadline), and where the window holds several dates only the nearest can be the badge's own.
    const BADGE = /(?<![A-Za-z0-9])D-(\d{1,4})(?![\d-])/g;
    const DATE = /(\d{4})-(\d{2})-(\d{2})/g;
    const today = dayNum(ctx.config.today);
    const bad = [];
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      for (const m of src.matchAll(BADGE)) {
        const from = Math.max(0, m.index - 40);
        const win = src.slice(from, m.index + m[0].length + 40);
        const at = m.index - from;
        let best = null;
        for (const d of win.matchAll(DATE)) {
          const days = dayNum(d[0]) - today;
          if (days < 0) continue;                       // a past date is not what a D-n counts to
          const gap = Math.abs(d.index - at);
          if (!best || gap < best.gap) best = { iso: d[0], days, gap };
        }
        if (!best) continue;
        const n = Number(m[1]);
        if (best.days !== n) bad.push(`${sc.file}: ${best.iso}은 D-${best.days}인데 D-${n}이라 적는다`);
      }
    }
    return bad;
  },
};

export const clockGate = {
  id: 'clockGate',
  title: '지나간 일이 오늘보다 앞이다',
  stage: 'built',
  run: (ctx) => {
    // Every dated value on a board is only readable against a fixed today, and a board that
    // has not declared one has nothing to compare against. Skipping is right — inventing a
    // today would judge the frames against a date nobody chose.
    if (!ctx.config.today) return [];
    // `auditFoot` stamps when a record was last written, so its date is by definition in the past.
    // Two frames stamped a September day while every frame around them in the same journey stood
    // in August, and one drew a training session that had already ended a week from now.
    // Two shapes carry a time that has already happened: the audit stamp at the foot of a record,
    // and a step in an `approvalFlow`/`journey` marked 「done」. A step drawn as finished on a date
    // that has not arrived was found twice — one report written three days from now, one receipt
    // acknowledged the day after tomorrow.
    const STAMP = /auditFoot\([^)]*?at: '(\d{4}-\d{2}-\d{2})|at: '(\d{4}-\d{2}-\d{2})[^']*',\s*state: 'done'|trail: '(\d{4}-\d{2}-\d{2})[^']*',[^}]*state: 'done'/g;
    // 「4일 전」·「114일 전」 beside the date it counts from. Seven were out by one, all in the
    // same direction — the writer counted the days between two dates and forgot one end.
    const ELAPSED = /(\d{4})-(\d{2})-(\d{2})(?:[^<>']{0,40}?)(\d{1,4})일 전|(\d{1,4})일 전(?:[^<>']{0,40}?)(\d{4})-(\d{2})-(\d{2})/g;
    const today = dayNum(ctx.config.today);
    const bad = [];
    for (const sc of ctx.screens) {
      for (const m of ctx.srcOf(sc.file).matchAll(STAMP)) {
        const iso = m[1] ?? m[2] ?? m[3];
        if (dayNum(iso) > today) bad.push(`${sc.file}: 끝난 일의 시각 ${iso}이 오늘(${ctx.config.today})보다 뒤다`);
      }
      for (const m of ctx.srcOf(sc.file).matchAll(ELAPSED)) {
        const iso = m[1] ? `${m[1]}-${m[2]}-${m[3]}` : `${m[6]}-${m[7]}-${m[8]}`;
        const said = Number(m[4] ?? m[5]);
        const real = today - dayNum(iso);
        if (real > 0 && real !== said) {
          bad.push(`${sc.file}: ${iso}은 ${real}일 전인데 ${said}일 전이라 적는다`);
        }
      }
    }
    return bad;
  },
};

export const labelFormGate = {
  id: 'labelFormGate',
  title: '라벨이 이름 자리를 지킨다',
  stage: 'built',
  run: (ctx) => {
    // A label is where a NAME goes. Four shapes had drifted into that slot and each was found by
    // reading, then verified against the whole board before being written here.
    //
    //  ① a `dField` label that is a -다 sentence — the value beneath it is 합니다체, so one field
    //     carries two registers.
    //  ② a `dField` label that is a bare conditional (「끊기면」) — a sentence cut off before it says
    //     anything. 「석면」 is a noun that ends the same way, hence the lookbehind.
    //  ③ a `badge` that is a finished clause with a subject (「이름이 같음」) rather than a state.
    //     「허가 없음」 and 「리더 없음」 are the standard shape and must stay quiet — noun plus
    //     existence — which is why the subject particle has to follow at least two syllables.
    //  ④ a `statTile` label that names an action instead of what its number counts: 「확인함」 over
    //     118 leaves the reader to guess what 118 is. 「개인정보 포함」 ends the same way and is a
    //     noun, hence `(?<!포)`. 「연결 안 됨」 is the same standard shape as badge's 노운+없음 — a
    //     category name (an unconnected zone), not a report of what happened to one — hence
    //     `(?<!안 )`.
    const RULES = [
      [/dField\(\{\s*label:\s*'([^']*(?:없다|있다|이다|아니다|다르다|한다|된다|막힌다|않다|는다))'/g, 'dField 라벨이 -다체 문장이다'],
      [/dField\(\{\s*label:\s*'([가-힣]{2,7}(?<!석)면)'/g, 'dField 라벨이 조건절 하나다'],
      [/badge\(\s*'([^']*[가-힣]{2,}[이가은는] ?[^']*(?:힘|침|겹침|같음|찾음|살아 있음|둘 이상|다름))'/g, 'badge가 완결된 절이다'],
      [/statTile\(\{\s*label:\s*'([^']*(?:(?<!포)함|(?<!안 )됨|짐))'/g, 'statTile 라벨이 값을 이름하지 않는다'],
    ];
    const bad = [];
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      for (const [re, why] of RULES) {
        for (const m of src.matchAll(re)) bad.push(`${sc.file}: 「${m[1]}」 — ${why}`);
      }
    }
    return bad;
  },
};

export const notesRegisterGate = {
  id: 'notesRegisterGate',
  title: 'notes가 -다체다',
  stage: 'built',
  run: (ctx) => {
    // `registerGate` reads the other direction only — screen copy that slipped into the plain
    // register. Nothing read the notes themselves, and 합니다체 had spread to 63 files: the board
    // describing a screen in the voice the product uses to address its user. A note in that voice
    // reads as copy to implement, which is the confusion `registerGate` exists to stop, arriving
    // from the far side. **A register rule stated in one direction gets a check in both.**
    //
    // Two narrowings. 「」 holds copy quoted FROM the screen, and a quotation keeps its own
    // register — 「저장했습니다」 inside a note is the screen speaking, not the board. And the
    // ending is anchored on what closes a clause rather than on a period alone: 「…표시합니다
    // ({{p-04-list-detail}}).」 and 「…표시합니다<br>」 escaped a period-only anchor, which is how
    // 36 of the 111 stayed hidden through the first sweep.
    const END = /(합니다|습니다|입니다|하세요|십시오)(?=[.。(<'`]|\s*$)/;
    const bad = [];
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      const block = src.match(/(?:^|\n) {2}notes:[\s\S]*?(?=\n {2}\w+:|\n\};|$)/);
      if (!block) continue;
      for (const line of block[0].replace(/「[^」]*」/g, '《》').split(/<br>|\n/)) {
        const hit = END.exec(line);
        if (!hit) continue;
        const from = Math.max(0, hit.index - 26);
        bad.push(`${sc.file}: notes가 합니다체다 — 「…${line.slice(from, hit.index + hit[0].length)}」`);
      }
    }
    return bad;
  },
};

/**
 * The same source with its comments taken out.
 *
 * <p><b>A comment is not screen copy, and a check that reads one refuses a build over a sentence no
 * user will ever see.</b> A frame's comments talk about the board, and the vocabulary they talk
 * about it in is frame references — which is exactly what this gate exists to keep out of the
 * product's own words. Read together, the two make the gate refuse the frames that documented
 * themselves best.
 *
 * <p>A line comment is recognised only where it opens the line, so a scheme-and-slashes inside a
 * drawn string is left alone; anything wider would eat copy to catch a comment.
 *
 * @param src a screen file
 * @returns the same text with block comments and whole-line comments blanked
 */
function withoutComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

export const refLeakGate = {
  id: 'refLeakGate',
  title: '보드 참조가 화면 문구에 없다',
  stage: 'built',
  run: (ctx) => {
    // `{{slug}}` is how a frame's NOTES point at another frame — the build turns it into that
    // frame's number for the reader of the board. In the body it does the same thing, so a user
    // of the product would read 「P-18」 in a sentence meant for them. Thirteen frames had one.
    const bad = [];
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      // Cut the notes block: from `notes:` to the next top-level key.
      // The notes block runs from `notes:` to the next top-level key, or to the end of the object
      // when notes is last. Both shapes exist on the board.
      const body = withoutComments(
        src.replace(/(^|\n) {2}notes:[\s\S]*?(?=\n {2}\w+:|\n\};|$)/g, '\n'),
      );
      for (const m of body.matchAll(/\{\{([a-z0-9-]+)\}\}/g)) {
        bad.push(`${sc.file}: 화면 문구에 {{${m[1]}}} — 프레임 번호가 사용자에게 나간다`);
      }
    }
    return bad;
  },
};

export const workerLangGate = {
  id: 'workerLangGate',
  title: '근로자 앱 셸이 그 화면의 말을 쓴다',
  stage: 'built',
  run: (ctx) => {
    // The two things always on a worker's screen — the tab row and the offline strip — come from
    // the shell, and fifteen frames whose entire body was Tiếng Việt drew both in Korean. A person
    // who cannot read the strip cannot tell a signature the server has from one only their phone
    // has, which is the single thing that strip exists to say. The shell takes `lang`; a frame
    // written in another language has to pass it.
    // Vietnamese Extended Additional (U+1EA0–U+1EF9) plus the six base letters outside it.
    const VI = /[\u1EA0-\u1EF9ăâđêôơưĂÂĐÊÔƠƯ]/g;
    const bad = [];
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      if (!/worker_\(\{/.test(src)) continue;
      if (/\blang:\s*'(vi|en|km)'/.test(src)) continue;
      // Ten or more Vietnamese-only letters is a body written in it, not a word quoted inside one.
      const n = (src.match(VI) ?? []).length;
      if (n >= 10) bad.push(`${sc.file}: 본문이 Tiếng Việt인데 셸에 lang을 넘기지 않는다 — 탭과 오프라인 줄이 한국어로 남는다`);
    }
    return bad;
  },
};

export const twinActionGate = {
  id: 'twinActionGate',
  title: '한 헤더에 같은 곳으로 가는 버튼이 둘이 아니다',
  stage: 'built',
  run: (ctx) => {
    // Eight headers carried two ghost buttons a single word apart — 「역할·권한」 beside 「역할·권한
    // 매트릭스」, 「웹훅」 beside 「아웃바운드 웹훅」 — and the shorter one matched no screen's name.
    // A reader cannot tell which of the two goes where, and the answer is that both go to the same
    // place. Adjacency is the test: two labels where one contains the other, side by side.
    const bad = [];
    for (const sc of ctx.screens) {
      for (const m of ctx.srcOf(sc.file).matchAll(/actions:\s*((?:btn\('[^']*'(?:,\s*'[^']*')?\)\s*\+?\s*)+)/g)) {
        const labels = [...m[1].matchAll(/btn\('([^']*)'/g)].map((x) => x[1]);
        for (let i = 0; i < labels.length - 1; i++) {
          const [a2, b] = [labels[i], labels[i + 1]];
          // Prefixes only. 「임시 저장」 and 「저장」, 「교육 배정」 and 「배정」 are different actions
          // that merely end alike; a shared BEGINNING is one name written long and written short.
          if (a2 === b || (a2.length !== b.length && (b.startsWith(a2) || a2.startsWith(b)))) {
            bad.push(`${sc.file}: 헤더에 「${a2}」와 「${b}」가 나란히 있다 — 한쪽이 다른 쪽을 담는다`);
          }
        }
      }
    }
    return bad;
  },
};

export const languageSetGate = {
  id: 'languageSetGate',
  title: '언어 목록이 이 사업장의 것이다',
  stage: 'built',
  run: (ctx) => {
    // This site runs four languages and every list of them says the same four. Seven frames had
    // drifted — one added 태국어, three swapped in नेपाली or မြန်မာ (which nobody at this site
    // speaks), and two wrote 「베트남어 · 크메르어」 in Korean where every other frame writes the
    // language in its own script. A language switch that offers a language the site has not
    // switched on is a promise the product cannot keep.
    const KNOWN = new Set(ctx.config.site?.languages ?? []);
    // Some switches legitimately carry a non-language option — 「전체 언어」 filters, 「나란히」 and
    // 「이중 언어」 print both at once, and a translation screen names a direction (「한국어 → …」).
    // C-16 is the one frame that legitimately names a language the site has NOT switched on: it
    // draws what a worker who speaks it would get, which is pictograms and nothing else. It says so
    // on its face, so the frame declares the departure rather than the gate carrying an exception.
    const NOT_A_LANGUAGE = /^(전체 언어|나란히|이중 언어|원본|한국어 원본)$|→/;
    const bad = [];
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      if (/\n  offLanguages: '[^']+'/.test(src)) continue;   // the frame says why it names one
      for (const m of src.matchAll(/langTabs\(\[([^\]]*)\]/g)) {
        for (const t of [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1])) {
          if (NOT_A_LANGUAGE.test(t) || KNOWN.has(t)) continue;
          bad.push(`${sc.file}: langTabs에 「${t}」 — 이 사업장의 언어는 ${[...KNOWN].join(' · ')} 넷이다`);
        }
      }
    }
    return bad;
  },
};

export const paginationGate = {
  id: 'paginationGate',
  title: '마지막 쪽이 총계와 맞다',
  stage: 'built',
  run: (ctx) => {
    // `pagination(labels, total, rows)` draws the labels it is handed, so the last page number is
    // written by hand and drifts silently. Fourteen frames were wrong at once, one of them by a
    // whole digit — 48,210 records at ten a page ended on 「482」, which was the neighbouring
    // screen's number for a list a tenth the size.
    const P = /pagination\(\s*\[([^\]]*)\]\s*,\s*'([\d,]+)'\s*,\s*(\d+)/g;
    const bad = [];
    for (const sc of ctx.screens) {
      for (const m of ctx.srcOf(sc.file).matchAll(P)) {
        const labels = [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
        const last = labels[labels.length - 1];
        if (!last || !/^\d+$/.test(last)) continue;   // 「…」 or a word is not a page number
        const total = Number(m[2].replace(/,/g, ''));
        const want = Math.ceil(total / Number(m[3]));
        if (Number(last) !== want) {
          bad.push(`${sc.file}: ${total}건을 ${m[3]}행씩 넘기면 ${want}쪽인데 마지막이 ${last}쪽이다`);
        }
      }
    }
    return bad;
  },
};

export const badgeFormGate = {
  id: 'badgeFormGate',
  title: '배지가 상태 이름이다',
  stage: 'built',
  run: (ctx) => {
    // A badge names a state in a cell the width of a word — 「고정」, 「이상 없음」, 「43일 남음」.
    // Eighteen were sentences instead (「먼저 닫아야 합니다」, 「현장에 들어갈 수 없습니다」),
    // and a sentence in that cell wraps to three lines or is cut. 「~ㅁ」 endings are the board's
    // badge vocabulary and are not judged; a finished sentence is.
    const BADGE = /badge\(\s*'((?:[^'\\]|\\.)*)'/g;
    const bad = [];
    for (const sc of ctx.screens) {
      for (const m of ctx.srcOf(sc.file).matchAll(BADGE)) {
        if (/니다\.?$/.test(m[1]) || /[가-힣]다\.?$/.test(m[1])) {
          bad.push(`${sc.file}: badge(「${m[1]}」) — 배지는 문장이 아니라 상태 이름이다`);
        }
      }
    }
    return bad;
  },
};

export const recordIdGate = {
  id: 'recordIdGate',
  title: '주소의 레코드와 감사 꼬리표가 같은 것을 가리킨다',
  stage: 'built',
  run: (ctx) => {
    // A frame's address names the record it is showing and its `auditFoot` stamps that same
    // record. Three frames named two: one drew ses_0142 and stamped ses_0244, and the edit state
    // beside it followed the stamp — so 「이 세션」 meant a different session on each of three
    // frames of one screen. A truncated hash in the address is the same record, not a second one.
    const bad = [];
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      const u = /url:\s*'([^']*)'/.exec(src);
      if (!u) continue;
      const ids = [...u[1].matchAll(/\b([a-z]{2,5}_[0-9a-z]{3,})\b/g)].map((m) => m[1]);
      if (!ids.length) continue;
      // One file can hold more than one panel — a scoped state draws a different record with its
      // own stamp — so the address has to match ONE of the stamps, not the first one written.
      const stamps = [...src.matchAll(/auditFoot\(\{\s*id:\s*'([a-z]+_[0-9a-z]+)'/g)].map((m) => m[1]);
      if (!stamps.length) continue;
      const fits = stamps.some((st) => ids.some((id) => id === st || id.startsWith(st) || st.startsWith(id)));
      if (!fits) bad.push(`${sc.file}: 주소는 ${ids[0]}인데 감사 꼬리표는 ${stamps.join(' · ')}이다`);
    }
    return bad;
  },
};

export const newModeGate = {
  id: 'newModeGate',
  title: '만들기 폼이 고른 레코드를 물고 오지 않는다',
  stage: 'built',
  run: (ctx) => {
    // `?view=` is the record picked out of the list and `?mode=new` is the empty form. Carrying
    // both says the form opened with somebody else's values in it — five frames drew exactly that,
    // and one of them was a 「사고 등록」 pre-filled with an already-registered incident.
    const bad = [];
    for (const sc of ctx.screens) {
      const m = /url:\s*'([^']*)'/.exec(ctx.srcOf(sc.file));
      if (!m) continue;
      const u = m[1];
      if (/[?&]view=/.test(u) && /[?&]mode=new\b/.test(u)) {
        bad.push(`${sc.file}: ${u} — 고른 레코드(view=)와 빈 폼(mode=new)이 한 주소에 있다`);
      }
    }
    return bad;
  },
};

export const registerGate = {
  id: 'registerGate',
  title: '화면 문구가 -다체다',
  stage: 'built',
  run: (ctx) => {
    // `.t-body` was the only marker this read, and a field's value is the larger surface — eight
    // strings sat in the plain register there, one of them inside a template literal where a
    // quoted-string sweep could not see it. Both quoting styles are read here for that reason.
    //
    // What is NOT read is as deliberate: this board explains itself by stating a rule as a HEADING
    // in the plain register and answering it in 합니다체 underneath. That convention holds a help
    // dialog's title (titleFormGate steps around it), a `helpCard` hint, a wide `dField` whose label
    // is that heading (twelve of twelve — no exceptions), and the `sectHead` above such a block
    // (six of six). Judging those sites would report the convention as a defect, so they are not
    // judged, and the value beneath them is judged instead — which is where the defects were.
    const VALUE = /value: (?:'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`)/g;
    // Three more call sites carry sentences the reader meets as product copy, and they had stayed
    // in the plain register because none of them renders as `.t-body`: the caption under a table,
    // a card's own subtitle, and a chart's note. `sectHead` above an explanation block is still not
    // read — that is the heading convention described above.
    //
    // **The P cluster is exempt from those three, and only from those three.** Its frames are the
    // pattern catalogue: a `tSub` there is sometimes specimen copy a real screen would show
    // (「추가 등록은 되지만 곧 막힙니다」) and sometimes the board captioning the pattern for whoever
    // implements it (「탭을 바꾸면 동작 행의 윗단만 바뀐다」). Both registers are correct in that
    // cluster, for different strings, and no pattern can tell them apart — judging them would
    // report half the catalogue as a defect either way. `.t-body`, values and tile labels are still
    // judged there, because those ARE the specimen.
    const PATTERN_ONLY = new Set(['tSub', 'sub', 'note']);
    const SOURCES = [
      [/class="t-body">([^<]+)</g, '본문'],
      [VALUE, '값'],
      [/\bstatTile\(\{\s*label:\s*'((?:[^'\\]|\\.)*)'/g, '지표 라벨'],
      [/\btSub\(\s*(?:'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`)/g, '표 아래 설명', 'tSub'],
      [/\bsub:\s*(?:'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`)/g, '카드 부제', 'sub'],
      [/\bnote:\s*(?:'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`)/g, '차트 주석', 'note'],
    ];
    // Any 「~다」 ending — a closed list let 「읽힌다」·「뗀다」·「잡힌다」 through. 「~니다」 is the
    // register being asked FOR, and a noun or adverb that merely ends in 「다」 is not the register
    // at all: 「30분마다」 and 「한 사람이 대리한 최다」 are both nouns.
    const PLAIN_END = /[가-힣]다\.?$/;
    const NOT_A_VERB = /(마다|최다|과다|다다)\.?$/;
    const badRegister = [];
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      // Cut the notes and the pageForm declaration — both talk about the screen, not to its user.
      const body = src.replace(/notes:[\s\S]*?(?=\n {2}\w+:)/g, '').replace(/pageForm:\s*'[^']*'/g, '');
      const isPattern = sc.file.startsWith('p-');
      for (const [re, where, key] of SOURCES) {
        if (isPattern && key && PATTERN_ONLY.has(key)) continue;
        for (const m of body.matchAll(re)) {
          const raw = m[1] !== undefined ? m[1] : (m[2] !== undefined ? m[2] : m[3]);
          // A `${…}` interpolation carries a badge, not a sentence — the ending sits before it.
          const text = raw.replace(/\$\{[^}]*\}/g, '').trim().replace(/\s*—.*$/, '').replace(/[—·]$/, '').trim();
          if (!/[가-힣]/.test(text)) continue;
          if (/니다\.?$/.test(text) || NOT_A_VERB.test(text)) continue;
          if (PLAIN_END.test(text)) {
            badRegister.push(`${sc.file}: ${where} 「${text}」 — 화면 문구는 합니다체로`);
          }
        }
      }
    }
    return badRegister;
  },
};

// A list beside a 760px panel gets what is left — about 600px — and that pays for three columns:
// the title (`w2`), one status (`fix`) and the row's actions (`fix`). A fourth column starts folding
// the title one character at a time. What a fourth column carried belongs in the title cell as a
// `mono` sub-line, which is where a time, an owner or a cycle already sits on the lists that fit.
// Twenty-seven lists had four to six.
export const listColumnGate = {
  id: 'listColumnGate',
  title: '패널 옆 목록이 세 열을 넘는다',
  stage: 'built',
  run: (ctx) => {
    const bad = [];
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      if (!/\blistDetail\(/.test(src)) continue;
      const m = /const list =([\s\S]*?)\n(?:const|export)/.exec(src);
      if (!m) continue;
      const head = /head:\s*\[([\s\S]*?)\]\s*,\n/.exec(m[1]);
      if (!head) continue;
      // `th(` at the top level of the head array — nested calls cannot appear in a header cell.
      const n = (head[1].match(/\bth\(/g) ?? []).length;
      if (n > 3) bad.push(`${sc.file}: 목록이 ${n}열 — 패널 옆은 제목 · 상태 · 액션 셋뿐이고, 나머지는 제목 칸의 mono 보조줄로 내린다`);
    }
    return bad;
  },
};

// Cross-links, exports and 「…로 가기」 belong right of the title, where they sit in the same place
// on every screen. A row of them in the flow is a fifth region the reader has to find, and on a
// list-detail page it lands under a panel that has already reached the floor — 170 frames drew one.
// `btnRow` survives for the primary action of a form that IS the page: a login, a kiosk step, a
// phone screen with no title bar to hang actions on. Those frames have no `pageHeader`, which is
// how the two cases tell themselves apart without a declaration.
export const pageActionGate = {
  id: 'pageActionGate',
  title: '페이지 액션이 제목 옆이 아니라 흐름 안에 있다',
  stage: 'built',
  run: (ctx) => ctx.screens
    .filter((sc) => {
      // The pattern catalogue is exempt: a `btnRow` there is the specimen — the actions an empty
      // state, a lock card, a conflict notice or a job tray carries as part of the pattern being
      // drawn, not a row of page links. Six frames, and every one of them is illustrating the
      // component that owns those buttons.
      if (sc.file.startsWith('p-')) return false;
      const src = ctx.srcOf(sc.file);
      return /\bbtnRow\(/.test(src) && /\bpageHeader\(\{/.test(src);
    })
    .map((sc) => `${sc.file}: btnRow는 제목 옆 actions로 — 흐름 안의 버튼 줄은 읽는 사람이 찾아야 하는 다섯째 영역이다`),
};

// A source badge says which layer a value came from, and the reader learns those layers once —
// P-13 draws them. Fourteen different words had reached the badge (「이 사업장」 beside 「사업장
// 설정」, 「팩 기본」 beside 「산업 팩」, and three that named a date, a roadmap phase and an
// aggregation), so the same layer read as several and 「설치 기본」 — sixty-eight of them — was in
// no table at all. The vocabulary is closed: four layers plus the three narrower sources that
// genuinely differ from them.
export const sourceWordGate = {
  id: 'sourceWordGate',
  title: '출처 배지가 정해진 낱말 밖으로 나간다',
  stage: 'built',
  run: (ctx) => {
    const ALLOWED = new Set(['법정 기본', '설치 기본', '산업 팩', '사업장 설정',
      '법규 팩', '문서 유형 정책', '고시 권고']);
    const bad = [];
    for (const sc of ctx.screens) {
      for (const m of ctx.srcOf(sc.file).matchAll(/sourceBadge\('([^']*)'/g)) {
        if (!ALLOWED.has(m[1])) bad.push(`${sc.file}: 「${m[1]}」 — ${[...ALLOWED].join(' · ')} 가운데 하나여야 한다`);
      }
    }
    return bad;
  },
};

// A 가운뎃점 joins single words with no space around it; when any item of the list it builds is
// itself a phrase carrying a space, every point in THAT list is spaced instead, so the eye finds
// the breaks — 「도수율·강도율·연천인율」 against 「교육 세션 · 참석 · 서명 · 이해도」. **The unit is
// the list, not the point.** Mixing the two inside one list is what made 67 frame names and 65
// manifest labels disagree with each other, and a state frame whose prefix spaced its points
// differently from its base read as a different screen.
//
// **A compound term whose own name carries a 가운뎃점 is one item, not two.** 「시정·예방조치」 is
// the settled Korean for CAPA and 「전력·가스」 names one pack, so splitting them turns one word
// into a list and then demands spaces inside it — which is how 「시정·예방조치 보드」 came out as
// 「시정 · 예방조치 보드」, a phrase that reads as two things. The terms are the product's, so they
// are declared in `board.config.mjs` → `compoundTerms` rather than guessed at here; a kit that
// carried the list would be carrying one project's vocabulary into every other project's board.
export const dotSpacingGate = {
  id: 'dotSpacingGate',
  title: '가운뎃점 띄어쓰기가 한 목록 안에서 갈린다',
  stage: 'built',
  run: (ctx) => {
    // A list runs between the separators that are NOT 가운뎃점 — the em dash and the parentheses.
    const bad = [];
    const compound = (ctx.config?.compoundTerms ?? []).filter((t) => t.includes('·'));
    // Masking keeps a compound term whole through the split and puts it back before the report,
    // so what the reader is shown is the text they wrote.
    const mask = (t) => compound.reduce((acc, term, i) => acc.split(term).join(`\u0000${i}\u0000`), t);
    const unmask = (t) => compound.reduce((acc, term, i) => acc.split(`\u0000${i}\u0000`).join(term), t);
    const judge = (where, rawText) => {
      const text = mask(rawText);
      for (const chunk of text.split(/ — |[()]/)) {
        if (!chunk.includes('·')) continue;
        const items = chunk.split(/\s*·\s*/).map((x) => x.trim());
        // A point sitting against the boundary has its other operand outside this chunk —
        // 「위원회 구성 (동수 검증) · 개최 일정」 joins the parenthesised phrase to what follows,
        // and the list it belongs to is the outer one, which this chunk cannot see.
        if (items[0] === '' || items[items.length - 1] === '') continue;
        const want = items.some((x) => x.includes(' ')) ? ' · ' : '·';
        const rebuilt = items.join(want);
        if (chunk.trim() !== rebuilt) bad.push(`${where}: 「${unmask(chunk.trim())}」 → 「${unmask(rebuilt)}」`);
      }
    };
    for (const sc of ctx.screens) {
      const m = /screen: '([^']+)'/.exec(ctx.srcOf(sc.file));
      if (m) judge(sc.file, m[1]);
    }
    for (const s of ctx.loaded ?? []) if (s.label) judge(`${s.file} (라벨)`, s.label);
    return bad;
  },
};

// A frame's `state:` already says what kind of frame it is, so `screen:` must not repeat it.
// 71 frames appended 「(다이얼로그)」 to their name and 60 did not, and the reader scanning the
// board could not tell whether a missing suffix meant a different kind of frame. The manifest
// LABEL is the opposite case and keeps the word — hollowDialogGate reads it to prove that a
// frame the table of contents calls a dialog actually draws a modal.
export const screenKindGate = {
  id: 'screenKindGate',
  title: '화면 이름이 프레임 종류를 되풀이한다',
  stage: 'built',
  run: (ctx) => {
    const KIND = /screen: '[^']*\((다이얼로그|패널 폼|패널|오버레이|시트)\)'/;
    return ctx.screens
      .filter((sc) => KIND.test(ctx.srcOf(sc.file)))
      .map((sc) => `${sc.file}: 종류는 state가 말한다 — screen 이름에서 뺀다`);
  },
};

// Dialog-title gate: a dialog names itself once, on the dialog. Wrapping a page form in one
// leaves 「구역 추가」 over 「새 구역」 — the same thing said twice, one line apart — and it happened
// on both batches of this conversion, which is what makes it a rule rather than a slip.
export const dialogTitleGate = {
  id: 'dialogTitleGate',
  title: '다이얼로그가 제목을 두 번 단다',
  stage: 'built',
  run: (ctx) => {
    const dupTitles = [];
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      for (const m of src.matchAll(/title: '([^']*)',\n\s*children: formSection\('([^']+)'/g)) {
        dupTitles.push(`${idOf(sc.file)} — 다이얼로그 「${m[1]}」 안에서 첫 절이 「${m[2]}」로 다시 제목을 단다`);
      }
    }
    return dupTitles;
  },
};

// List-and-form gate: the standard page is the CRUD list-detail — the list, and the record beside
// it in a panel where adding and editing happen (P-04). Where that will not fit, the form goes in
// a dialog. What it must never do is sit UNDER the list on the same page: the reader scrolls past
// records to reach fields that belong to no visible row, the page has two subjects, and 「저장」
// down there is ambiguous about which one it saves. Forty-six frames had drifted into it.
//
// A record list announces itself with a filterBar or a pagination row — a reference table on a
// form page has neither, which is what keeps this from firing on 「이 허가 유형의 조건」.
export const listFormGate = {
  id: 'listFormGate',
  title: '목록과 폼이 한 페이지에 있다',
  stage: 'built',
  run: (ctx) => {
    const listFormErrors = [];
    {
      for (const sc of ctx.screens) {
        const src = ctx.srcOf(sc.file);
        // Only a page that also draws a TABLE is ambiguous: a pure form screen with no list needs no
        // declaration, because there is nothing for the form to be confused with.
        if (!/\btable\(\{/.test(src)) continue;
        // A page form is legitimate where the form IS the page — a create screen, a record page, a
        // procedure — and those frames say so in `pageForm`, one sentence naming why the table beside
        // it is context rather than a list of the same thing. The declaration is the point: the
        // machine cannot tell 「이 허가 유형의 조건」 from 「휴게시설 등록」, but a person writing that
        // sentence has to decide which one they are drawing.
        if (/\n  pageForm: '[^']+'/.test(src)) continue;
        if (/\n  pageForm: ''/.test(src)) {
          listFormErrors.push(`${idOf(sc.file)} — pageForm에 사유가 없다`);
          continue;
        }
        // Spans of every dialog(...) and panelForm(...) — a form inside either is exactly where it
        // belongs. The panel is now the ordinary home for an entity's own create and edit, so a
        // `formSection` inside `panelForm({...})` is the pattern rather than the defect; a dialog
        // keeps its span because the four cases that are still dialogs (sub-entity, confirm, peek,
        // output) carry forms too.
        const spans = [];
        for (const m of src.matchAll(/dialog\(\{|panelForm\(\{/g)) {
          let d = 0, j = src.indexOf('(', m.index), k = j;
          for (; k < src.length; k++) {
            if (src[k] === '(') d++;
            else if (src[k] === ')') { d--; if (!d) break; }
          }
          spans.push([m.index, k]);
        }
        for (const m of src.matchAll(/\bformSection\(/g)) {
          if (spans.some(([a, b]) => m.index >= a && m.index <= b)) continue;
          listFormErrors.push(`${idOf(sc.file)} — 목록이 있는 페이지에 폼이 그대로 있다. 다이얼로그나 상세 패널로 옮긴다 (P-04)`);
          break;
        }
      }
    }
    return listFormErrors;
  },
};

// Calendar-and-list gate: a month grid and a list of the SAME records, stacked on one page, costs
// the reader the whole first screenful before the first row and says the same thing twice. Thirteen
// frames had drifted into it. On six of them the calendar carried two or three marks — most of a
// screenful of empty grid for dates the stat tiles already named — and on three of those the very
// thing the screen leads with was not on the calendar at all: 「빠뜨린 주」 was in July while the
// grid drew August, 「기한 지남」 was in the past, 「배치일 지남」 had no cell.
//
// The two shapes are one screen's two views, and the switch rides the bar above the list
// (`filterBar({ views })`) so the total and the committed filters survive it. A file that draws
// both legitimately therefore says `views:` somewhere. A calendar beside a list of something ELSE
// — 실시 일정 under a 대상자 표 — is a judgement no regex can make, so that frame declares it in
// one sentence naming what the calendar shows that the list does not. Writing that sentence is the
// check, exactly as it is for `pageForm` above.
// The AI badge's vocabulary is five words and no more. A sixth is a sixth thing every reader of
// every screen has to learn, and the whole value of the mark is that it means one settled thing —
// 「사람을 아직 거치지 않았다」. `sourceBadge` is closed the same way and for the same reason.
// Five rules the persona review wrote regexes for. Each is the same defect wearing a different
// component: a name that stopped being a name. A label is what a value is called, so a sentence
// there leaves the reader looking for the value that is not beside it.
export const labelSentenceGate = {
  id: 'labelSentenceGate',
  title: '이름 자리에 문장이 서 있다',
  stage: 'built',
  run: (ctx) => {
    const bad = [];
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      // G1 — a -다체 clause where a field's name belongs.
      for (const m of src.matchAll(/dField\(\{\s*label:\s*(['"`])([^'"`]*(?:없다|있다|이다|아니다|다르다|한다|된다|막힌다|않다|는다))\1/g)) {
        bad.push(`${idOf(sc.file)} — dField 라벨 「${m[2]}」이 문장이다. 무엇인지를 밝히는 이름으로 쓴다`);
      }
      // G2 — a conditional clause as a name. 「석면」 is a material, not 「~면」.
      for (const m of src.matchAll(/dField\(\{\s*label:\s*(['"`])([가-힣]{2,7}(?<!석)면)\1/g)) {
        bad.push(`${idOf(sc.file)} — dField 라벨 「${m[2]}」이 조건절이다. 그 조건이 무엇을 정하는지를 이름으로 쓴다`);
      }
      // G3 — a badge carrying a whole sentence. A badge is a state, read at a glance.
      for (const m of src.matchAll(/badge\(\s*(['"`])([^'"`]*[가-힣]{2,}[이가은는] ?[^'"`]*(?:힘|침|겹침|같음|찾음|살아 있음|둘 이상|다름))\1/g)) {
        bad.push(`${idOf(sc.file)} — badge 「${m[2]}」가 문장이다. 배지는 한눈에 읽는 상태다`);
      }
      // G4 — a stat tile's label has to name what is being counted, not what happened to it.
      // 「개인정보 포함」 is a kind of record, so the exclusion is on 포함 rather than on 함.
      // 「연결 안 됨」 is a category of zone, the same shape as badge's 노운+없음 — the exclusion
      // is on the 안 됨 pair rather than on 됨 alone.
      for (const m of src.matchAll(/statTile\(\{\s*label:\s*(['"`])([^'"`]*(?:(?<!포)함|(?<!안 )됨|짐))\1/g)) {
        bad.push(`${idOf(sc.file)} — statTile 라벨 「${m[2]}」이 값의 이름이 아니다. 무엇을 세는지를 쓴다`);
      }
    }
    return bad;
  },
};

// The worker's shell draws its tab row in one language, and `lang` is what picks it. A Korean
// screen needs neither — `ko` is the default — so the defect is narrower than "no lang": a frame
// whose BODY is in a worker's own language while the shell around it stays Korean. That frame
// looks bilingual by accident in the one place this product cannot afford it, and the reviewer
// found it by reading, not by grepping for a missing key.
const FOREIGN = /[À-ǿḀ-ỿ฀-๿ក-៿ऀ-ॿ]/;

export const workerShellLangGate = {
  id: 'workerShellLangGate',
  title: '본문은 모국어인데 셸이 한국어다',
  stage: 'built',
  run: (ctx) => ctx.screens
    .filter((sc) => {
      const src = ctx.srcOf(sc.file);
      if (!/\bworker_\(\{/.test(src)) return false;
      if (/^import base/m.test(src)) return false;
      if (/\blang:\s*/.test(src) || /\btabs:\s*/.test(src)) return false;
      // Language names laid out to be chosen from are not body copy — L-01's picker and L-20's
      // language chips are that. Only what a person reads is judged: body lines, description
      // lines, and the body of a message.
      const body = src.slice(src.indexOf('worker_({'));
      const prose = [...body.matchAll(/\b(?:tBody|tSub)\(\s*(['"`])((?:[^'"`\\]|\\.)*)\1/g)].map((m) => m[2])
        .concat([...body.matchAll(/\bbody:\s*(['"`])((?:[^'"`\\]|\\.)*)\1/g)].map((m) => m[2]));
      // A line written in several languages at once, inviting a choice, is a picker rather than
      // body copy in any one of them — L-01's 「Choose language · Chọn ngôn ngữ · ជ្រើសរើសភាសា」 is
      // that line, and writing it that way is correct.
      const families = (t) => [/[À-ǿḀ-ỿ]/, /[฀-๿]/, /[ក-៿]/, /[ऀ-ॿ]/].filter((re) => re.test(t)).length;
      return prose.some((t) => FOREIGN.test(t) && families(t) < 2);
    })
    .map((sc) => `${idOf(sc.file)} — 본문은 모국어인데 worker_에 lang이 없어 탭이 한국어로 그려진다`),
};

const AI_WORDS = new Set(['추정', '자동 분류', '자동번역', '초안', '사진 판독']);

export const aiWordGate = {
  id: 'aiWordGate',
  title: 'AI 배지가 정해진 다섯 낱말 밖을 쓴다',
  stage: 'built',
  run: (ctx) => {
    const bad = [];
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      for (const m of src.matchAll(/\baiBadge\(\s*'((?:[^'\\]|\\.)*)'/g)) {
        if (!AI_WORDS.has(m[1])) {
          bad.push(`${idOf(sc.file)} — aiBadge('${m[1]}') — 쓸 수 있는 낱말은 ${[...AI_WORDS].join(' · ')}`);
        }
      }
    }
    return bad;
  },
};

// The tier is the reader's answer to 「왜 내 화면에는 없지」, so a card that names one that does not
// exist answers nothing. One, two, three — always on, model pack, GPU or LLM.
export const aiTierGate = {
  id: 'aiTierGate',
  title: 'AI 카드가 없는 갈래를 말한다',
  stage: 'built',
  run: (ctx) => {
    const bad = [];
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      for (const m of src.matchAll(/\baiCard\(\{[\s\S]{0,400}?\btier:\s*(\d+)/g)) {
        if (!['1', '2', '3'].includes(m[1])) bad.push(`${idOf(sc.file)} — aiCard tier ${m[1]} — 갈래는 1·2·3뿐이다`);
      }
      // Tier 1 cannot be switched off, so a card has nothing to say — only the badge stands.
      if (/\baiCard\(\{[\s\S]{0,400}?\btier:\s*1\b/.test(src)) {
        bad.push(`${idOf(sc.file)} — 1형에 aiCard를 붙였다. 끌 수 없는 계산이라 카드가 말할 것이 없고, 배지만 선다`);
      }
    }
    return bad;
  },
};

// A `filterBar` says 「this is a list」, and a list whose rows open nowhere leaves the reader with
// no way to read one. Twenty-three frames had one; four of them genuinely needed a panel and got
// it, and the other nineteen are right without one for reasons a machine cannot see — the grid IS
// the input surface, the matrix is the unit being read, the row's destination is another screen,
// or the record opens as a dialog because it is a print or a one-press decision. So the frame
// says which, the way a page with a table and a form says why.
export const listPanelGate = {
  id: 'listPanelGate',
  title: '목록인데 레코드를 읽을 자리가 없다',
  stage: 'built',
  run: (ctx) => {
    const bad = [];
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      if (sc.file.startsWith('p-')) continue;              // 패턴 카탈로그는 시연이다
      if (/^import base/m.test(src)) continue;             // 상태 프레임은 바탕을 따른다
      if (/\blistDetail\(/.test(src)) continue;
      if (!/\bfilterBar\(/.test(src)) continue;
      if (/back: '[^']*목록'/.test(src)) continue;          // 한 레코드의 페이지이지 목록이 아니다
      if (/\n  pageList: '[^']+'/.test(src)) continue;
      bad.push(/\n  pageList: ''/.test(src)
        ? `${idOf(sc.file)} — pageList에 사유가 없다`
        : `${idOf(sc.file)} — 목록인데 상세 패널이 없다. 레코드를 읽을 자리를 두거나, 패널이 없는 이유을 pageList로 밝힌다`);
    }
    return bad;
  },
};

// A plan of the same records is not page furniture above the list — it is the list's other view,
// on the calendar's rule. Five frames drew one beside a table with neither a switch nor a reason,
// and every one of them turned out legitimate: the drawing and the table hold different records
// (what is NOT yet placed, who is at the muster point, who receives the notice) or the canvas is
// the editing surface itself. That is exactly what a declaration is for.
export const canvasListGate = {
  id: 'canvasListGate',
  title: '도면과 목록이 한 페이지에 있다',
  stage: 'built',
  run: (ctx) => {
    const bad = [];
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      if (!/\bcanvasPh\(/.test(src)) continue;
      if (!/\btable\(\{|\blistDetail\(/.test(src)) continue;
      if (/\bviews:\s*\[/.test(src)) continue;
      if (/\n  pageCanvas: '[^']+'/.test(src)) continue;
      bad.push(/\n  pageCanvas: ''/.test(src)
        ? `${idOf(sc.file)} — pageCanvas에 사유가 없다`
        : `${idOf(sc.file)} — 도면과 목록이 한 페이지에 쌓여 있다. 같은 기록이면 filterBar의 views로 보기를 가르고, 도면이 목록과 다른 것을 보인다면 pageCanvas로 그것을 밝힌다`);
    }
    return bad;
  },
};

export const calendarListGate = {
  id: 'calendarListGate',
  title: '달력과 목록이 한 페이지에 있다',
  stage: 'built',
  run: (ctx) => {
    const calListErrors = [];
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      if (!/\bcalendar\(\{/.test(src)) continue;
      // A plain `table({` is a list too. The list-and-form gate above learned this the hard way —
      // its first cut looked only for a filterBar or a pagination row and let nineteen frames past —
      // and the first cut of THIS gate repeated it on the very same file (F-21, whose measurement
      // table carries neither).
      if (!/\btable\(\{|\blistDetail\(/.test(src)) continue;
      if (/\bviews:\s*\[/.test(src)) continue;          // a view switch — two states, not a stack
      if (/\n  pageCalendar: '[^']+'/.test(src)) continue;
      calListErrors.push(/\n  pageCalendar: ''/.test(src)
        ? `${idOf(sc.file)} — pageCalendar에 사유가 없다`
        : `${idOf(sc.file)} — 달력과 목록이 한 페이지에 쌓여 있다. 같은 기록이면 filterBar의 views로 보기를 가르고, 달력이 목록과 다른 것을 보인다면 pageCalendar로 그것을 밝힌다`);
    }
    return calListErrors;
  },
};

// Panel-tail gate: in a list-detail screen, nothing may sit BELOW the two columns. The detail
// panel is a full-height column and its footer is pinned to the bottom of the remaining screen,
// so anything appended after listDetail(...) lands under a panel that has already reached the
// floor — the reader sees the record's actions, then more page beneath them, and the footer
// stops meaning "the end of this record". Content that used to live under the list belongs
// either at the tail of the LIST column or inside the PANEL, and choosing between those two is
// the point: a note about the whole list goes in the list column, a note about the selected
// record goes in the panel.
// Filter-chain gate: 목록 탭 → 칩 필터 → 목록 is one act, and the three sit together. A tile row,
// an explanation card or a warning band pushed between them separates the control from the thing
// it controls — the reader chooses a tab, crosses a screenful of something else, and meets rows
// with no visible reason to read them as the answer. The wedge that recurs is the stat tile row:
// it belongs ABOVE the tabs, where the page's own figures are, rather than inside the chain.
//
// Read off the rendered frame rather than the source, because the surface a screen draws is often
// a branch — `(partner ? listTabs(a) : listTabs(b))`, `(view === '목록' ? listDetail(…) : …)` — and
// a source sweep sees the condition's variable where the list is.
//
// A chip row that is NOT a list filter is the one call a machine cannot make: 「오늘 · 이번 주 ·
// 이번 달」 over a whole dashboard, 「빈도·강도법 · 체크리스트법 · OPS」 picking which assessment the
// screen IS, 「A4 세로 · A3」 setting the paper a preview draws on. Those frames declare it in
// `pageChips`, one sentence naming what the chips pick instead — the same bargain `pageForm` and
// `pageCalendar` strike, and writing the sentence is the check.
export const filterChainGate = {
  id: 'filterChainGate',
  title: '탭·칩 필터·목록 사이에 다른 것이 있다',
  stage: 'built',
  run: (ctx) => {
    const BODY = new Set(['listdetail', 'table', 'treetable', 'mx', 'cal', 'tree', 'cvs', 'hit']);
    // The language switch is read out of the sequence altogether. It is a filter of the same
    // family — 「전체 언어 · 한국어 · Tiếng Việt」 over a result list — so it does not break the
    // reading of tab → chip → list the way a tile row or an explanation card does; and it is not a
    // member of the triple either, because a screen may keep it beside a document instead.
    const rank = (cls) => {
      const c = cls.split(/\s+/);
      if (c[0] === 'ltabs') return 1;
      if (c[0] === 'chips') return 2;
      if (c[0] === 'filterbar') return 3;
      return BODY.has(c[0]) ? 4 : 0;
    };
    const isLang = (cls) => /(^|\s)ltabs(\s|$)/.test(cls) && /(^|\s)lang(\s|$)/.test(cls);
    const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link']);
    // A tree of {cls, children}: enough to read sibling order, and nothing else.
    const parse = (html) => {
      const root = { cls: '', children: [] };
      const stack = [root];
      for (const m of html.matchAll(/<(\/?)([a-zA-Z][\w-]*)\b([^>]*)>/g)) {
        const [, slash, tag, attrs] = m;
        const t = tag.toLowerCase();
        if (VOID.has(t) || /\/\s*$/.test(attrs)) continue;
        if (slash) {
          for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === t) { stack.length = i; break; }
          continue;
        }
        const node = { tag: t, cls: (/class="([^"]*)"/.exec(attrs) ?? ['', ''])[1], children: [] };
        stack[stack.length - 1].children.push(node);
        stack.push(node);
      }
      return root;
    };
    const found = [];
    for (const s of ctx.loaded) {
      const html = s.mod?.body ?? '';
      if (!html) continue;
      const declared = typeof s.mod.pageChips === 'string' && s.mod.pageChips.trim() !== '';
      if (s.mod.pageChips === '') { found.push(`${s.num} — pageChips에 사유가 없다`); continue; }
      const hits = [];
      const walk = (node) => {
        const kids = node.children.filter((c) => !isLang(c.cls))
          .map((c) => ({ cls: c.cls, rank: rank(c.cls) }));
        for (let i = 0; i < kids.length; i++) {
          const r = kids[i].rank;
          if (r < 1 || r > 3) continue;
          if (r === 2 && declared) continue;
          let j = -1;
          for (let k = i + 1; k < kids.length; k++) if (kids[k].rank >= 1) { j = k; break; }
          // A chip row with no list under it anywhere is not this chain's business — a set of tags
          // beside an attachment, a legend. The chain is only a chain once it reaches a list.
          if (j < 0) continue;
          if (j !== i + 1) {
            hits.push(`${kids[i].cls} → ${kids[j].cls} 사이에 ${kids.slice(i + 1, j).map((x) => x.cls).join(' · ')}`);
          } else if (kids[j].rank <= r) {
            hits.push(`${kids[i].cls}이 ${kids[j].cls}보다 앞이다 — 순서는 목록 탭 → 칩 필터 → 목록이다`);
          }
        }
        for (const c of node.children) walk(c);
      };
      walk(parse(html));
      if (hits.length) {
        found.push(`${s.num} (${s.file}) — ${hits[0]}. 목록을 좁히는 것 셋은 붙여 놓고 나머지는 탭 위로 올린다`);
      }
    }
    return found;
  },
};

export const panelTailGate = {
  id: 'panelTailGate',
  title: '목록·상세 아래에 무언가가 더 있다',
  stage: 'built',
  run: (ctx) => {
    const found = [];
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      for (const m of src.matchAll(/\blistDetail\(/g)) {
        // Balance the call's parentheses to find where listDetail(...) ends.
        let d = 0, i = m.index + m[0].length - 1, end = -1;
        for (; i < src.length; i++) {
          const ch = src[i];
          if (ch === '(') d++;
          else if (ch === ')') { d--; if (d === 0) { end = i + 1; break; } }
        }
        if (end < 0) continue;
        // A view switch draws the list-detail in one branch and a calendar in the other, so the
        // text after the call is the OTHER branch rather than something under the two columns.
        // Step out to the parenthesis that holds the whole ternary and scan the tail from there.
        if (/^\s*:/.test(src.slice(end))) {
          let back = 0, open = -1;
          for (let j = m.index - 1; j >= 0; j--) {
            const ch = src[j];
            if (ch === ')' || ch === '}' || ch === ']') back++;
            else if (ch === '(' || ch === '{' || ch === '[') { if (back === 0) { open = j; break; } back--; }
          }
          if (open < 0 || src[open] !== '(') continue;
          let g = 0, close = -1;
          for (let j = open; j < src.length; j++) {
            const ch = src[j];
            if (ch === '(') g++;
            else if (ch === ')') { g--; if (g === 0) { close = j + 1; break; } }
          }
          if (close < 0) continue;
          end = close;
        }
        // Walk forward through the expression that CONTAINS the call. Depth goes negative at the
        // bracket that closes the enclosing object or call — that is where the page body ends.
        let depth = 0, tail = '';
        for (let j = end; j < src.length; j++) {
          const ch = src[j];
          if (ch === '(' || ch === '{' || ch === '[') depth++;
          else if (ch === ')' || ch === '}' || ch === ']') {
            if (depth === 0) { tail = src.slice(end, j); break; }
            depth--;
          }
        }
        // A `+ something(` after the call is another block drawn under the two columns.
        const trailing = [...tail.matchAll(/\+\s*([A-Za-z_$][\w$]*)\s*[({`']/g)].map((t) => t[1]);
        if (trailing.length) {
          found.push(`${idOf(sc.file)} — listDetail 아래에 ${[...new Set(trailing)].join(' · ')}`);
        }
      }
    }
    return found;
  },
};

// Phase gate: a frame the roadmap defers must say so ON ITS FACE. The section title says it
// once, at the top of thirty-five frames — and a frame reaches most of its readers alone: as a
// PNG in a message, as one page of the PDF, as an anchor somebody was linked to. None of those
// carry the section title, so a reader meets a finished-looking screen with nothing telling
// them it is not being built now, and asks for it.
//
// Two halves, because the marker can be lost from either end. The declaration can stop being
// drawn (someone edits the frame chrome), or a deferred screen can be written without one —
// a new frame in a cluster that is not itself deferred, the way L-21 sits inside worker PWA.
export const phaseGate = {
  id: 'phaseGate',
  title: '단계가 선언된 프레임이 그것을 얼굴에 그리지 않는다',
  stage: 'built',
  run: (ctx) => {
    const bad = [];
    const declared = new Set();
    for (const sec of ctx.manifest) {
      for (const sc of sec.screens) {
        if (sc.phase ?? sec.phase) declared.add(sc.file);
      }
    }
    // Half one — what is declared is drawn. Read the built HTML, not the declaration: the
    // declaration is what we already know, and the whole point is that it reached the page.
    let banded = 0;
    for (const [, cls, frameHtml] of ctx.html.matchAll(/<article class="(frame[^"]*)" id="[^"]+">([\s\S]*?)<\/article>/g)) {
      if (cls.includes('deferred') && /class="phase-band"/.test(frameHtml)) banded += 1;
    }
    if (declared.size !== banded) {
      bad.push(`단계를 선언한 화면 ${declared.size}장, 띠를 두른 프레임 ${banded}장 — 선언이 그림에 닿지 않았다`);
    }
    // Half two — what says it is deferred is declared. Keyed on the emphasised assertion rather
    // than on the bare word: 「2단계 인증」 (MFA) and 「2단계 결재」 are that screen's subject
    // matter, not its schedule.
    for (const e of ctx.loaded) {
      const m = (e.mod?.notes ?? '').match(/<strong>([2-9])단계(?:다)?<\/strong>/);
      if (m && !declared.has(e.file)) {
        bad.push(`${e.num}: 설명이 ${m[1]}단계라고 말하는데 manifest가 선언하지 않았다`);
      }
    }
    return bad;
  },
};

// Role gate: the visibility matrix and the frame's own words must agree.
//
// §9 of the screen design fills the matrix in per CLUSTER, which is as far as a table can go — it
// cannot say which of E's sixty-five frames 「관리감독자 ✔(담당 구역)」 means. `src/roles.mjs` holds
// that table as data and a frame overrides it only where it departs. What this gate catches is the
// disagreement between the two statements a frame makes about who may be there: the matrix, and the
// `AUTH:` note somebody wrote in prose.
//
// A frame whose AUTH names a role its cluster does not admit is one of two things, and both need
// fixing: the matrix is wrong for that cluster, or the frame is a departure that never declared
// itself. Neither is visible without this check — sixteen J frames were written for an outside
// auditor while §9 had no column for one at all.
export const roleGate = {
  id: 'roleGate',
  title: '역할 판정과 AUTH 줄이 어긋난다',
  stage: 'preflight',
  run: async (ctx) => {
    // The matrix is the BOARD's, and it arrives on ctx already imported — reading it by path
    // would tie this gate to one folder layout and would re-import the file on every run. A
    // board that settles no roles simply has no matrix to disagree with.
    if (!ctx.roles) return [];
    const { ROLES, CLUSTER_ROLES, NOT_COVERED } = ctx.roles;
    const bad = [];
    // Every cluster the board draws is either in the matrix or declared out of it, with a reason.
    for (const sec of ctx.manifest) {
      const L = sec.letter.split('-')[0];
      if (!CLUSTER_ROLES[L] && !NOT_COVERED[L]) {
        bad.push(`${sec.letter} — roles.mjs에 판정도 없고 「대상 아님」 사유도 없다`);
      }
    }
    // 「경비」 alone would match 「경비실」; the auditor is written both ways on this board.
    const NAMED = { sys: ['시스템 관리자'], exec: ['경영책임자'], safety: ['안전관리자'],
      health: ['보건관리자'], super: ['관리감독자'], partner: ['협력사'],
      guard: ['경비/PACS', 'PACS 운영자'], auditor: ['감사자', '감사관'] };
    for (const e of ctx.loaded) {
      const L = (e.num ?? '').split('-')[0];
      const verdicts = CLUSTER_ROLES[L];
      if (!verdicts) continue;
      const m = /AUTH:([^<]*)/.exec(e.mod?.notes ?? '');
      if (!m) continue;
      const auth = m[1];
      const effective = { ...verdicts, ...(e.mod.roles ?? {}) };
      for (const [key, words] of Object.entries(NAMED)) {
        if (!words.some((w) => auth.includes(w))) continue;
        if (!effective[key]) {
          bad.push(`${e.num}: AUTH가 「${ROLES[key]}」를 부르는데 ${L} 판정에 없다 — 매트릭스를 고치거나 이 프레임이 roles로 선언한다`);
        }
      }
    }
    return bad;
  },
};

// A helpCard's two slots are the one place `registerGate` cannot look — the title states a rule in
// the plain register on purpose, and the hint is a fragment list rather than prose. That exemption
// left both free to drift into whatever shape the author reached for, and 24 of 126 had: titles
// answering the question instead of asking it, hints written as sentences. The shape is the point —
// a reader scanning a wall of cards reads titles as questions and hints as contents.
const DECL = /[가-힣](?<!마)(?<!보)다$/;   // 「6개월마다」·「그보다」는 서술어가 아니다
const ASKS = /는가|은가|인가|무엇|어디|어떻게|왜|얼마|까$/;

export const helpShapeGate = {
  id: 'helpShapeGate',
  title: 'helpCard의 제목은 물음이고 힌트는 목록이다',
  stage: 'built',
  run: (ctx) => {
    const bad = [];
    for (const sc of ctx.screens) {
      for (const m of ctx.srcOf(sc.file).matchAll(/helpCard\(\{([\s\S]*?)\n\s*\}\)/g)) {
        const blk = m[1];
        const t = /title:\s*'([^']*)'/.exec(blk);
        const h = /hint:\s*'([^']*)'/.exec(blk);
        if (t && DECL.test(t[1].trim()) && !ASKS.test(t[1])) {
          bad.push(`${sc.file}: helpCard 제목 「${t[1]}」이 서술문이다 — 설명이 답하는 물음이거나 이름씨 마디여야 한다`);
        }
        for (const seg of (h ? h[1].split('·') : [])) {
          if (DECL.test(seg.trim())) {
            bad.push(`${sc.file}: helpCard 힌트의 「${seg.trim()}」이 문장이다 — 안에 든 것 서넛의 목록이어야 한다`);
          }
        }
      }
    }
    return bad;
  },
};

// A companion frame draws the panes its base's tab strip names and the base does not open, and it
// draws them WHERE THE BASE PUTS THEM. On a list-detail base the panes belong in the detail column,
// so the companion stands a `regionPh` in the list column to say the list is the base's to draw. On
// a full-width record screen — `pageHeader` + `recordTabs`, no list anywhere — that placeholder is
// a column the product does not have, invented because the two-column shape looks like the house
// style. Thirteen companions did exactly that before this gate existed.
//
// **Both directions are wrong and only one of them looks wrong.** A placeholder over a base with no
// list reads as a screen that lost its list; a companion of a list-detail base that omits the
// placeholder reads as a page whose panes run the full width, which is a different layout from the
// one the base contracts. So the test is agreement with the base, not a fixed number of columns.
export const companionFollowsBaseLayoutGate = {
  id: 'companionFollowsBaseLayoutGate',
  title: '동반 프레임이 바탕과 다른 배치를 그린다',
  stage: 'built',
  run: (ctx) => {
    const bad = [];
    const files = new Set(ctx.screens.map((sc) => sc.file));
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      if (!/\btabPanes\s*\(/.test(src)) continue;
      const imp = /^import\s+\w+[^\n]*from\s+'\.\/([a-z0-9-]+)\.mjs';/m.exec(src);
      if (!imp || !files.has(imp[1])) continue;
      const baseSrc = ctx.srcOf(imp[1]);
      const draws = /\bregionPh\s*\(|\blistDetail\s*\(/.test(src);
      const baseIsListDetail = /\blistDetail\s*\(/.test(baseSrc);
      if (draws && !baseIsListDetail) {
        bad.push(`${sc.file}: 바탕(${imp[1]})에 목록 열이 없는데 목록 플레이스홀더를 그린다 — 칸을 폭 전체로 쌓는다`);
      }
      if (!draws && baseIsListDetail) {
        bad.push(`${sc.file}: 바탕(${imp[1]})이 목록·상세인데 목록 플레이스홀더가 없다 — 왼쪽에 regionPh를 둔다`);
      }
    }
    return bad;
  },
};

// board.config.mjs draws the phase band and the feature chip side by side and insists neither can
// stand in for the other. Two tags spelling the same string make that claim unreadable — the frame
// prints one word twice and a reader has no way to tell schedule from entitlement.
export const tagCollisionGate = {
  id: 'tagCollisionGate',
  title: '단계 태그와 기능 태그가 같은 낱말일 수 없다',
  stage: 'built',
  run: (ctx) => {
    const bad = [];
    const ph = ctx.config.phases ?? {};
    const ft = ctx.config.features ?? {};
    for (const [pk, pv] of Object.entries(ph)) {
      for (const [fk, fv] of Object.entries(ft)) {
        if (pv.tag === fv.tag) {
          bad.push(`board.config.mjs: phases.${pk}와 features.${fk}가 둘 다 「${pv.tag}」다 — 한 프레임이 두 칩을 달면 같은 낱말이 나란히 찍힌다`);
        }
      }
    }
    return bad;
  },
};

// Closing the detail panel is the one way back out of the screen, so its control cannot be the
// quietest thing in the footer. `ghost` is the variant for a secondary act — 취소 beside 저장,
// 인쇄 beside 발급 — and leaving is not secondary. A reader who has to scan the footer's left edge
// for the way out is a reader the layout has trapped. 취소 in a form panel keeps ghost: that IS
// the secondary act, and 저장 is the one the reader came for.
export const panelCloseIsPlainGate = {
  id: 'panelCloseIsPlainGate',
  title: '상세 패널의 닫기가 ghost다',
  stage: 'built',
  run: (ctx) => {
    const bad = [];
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      for (const m of src.matchAll(/\bpanelFoot\s*\(|\bpanelForm\s*\(\{/g)) {
        const open = m[0].endsWith('{') ? '{' : '(';
        const close = open === '{' ? '}' : ')';
        let i = m.index + m[0].length - 1, depth = 0, j = i;
        for (; j < src.length; j++) {
          const c = src[j];
          if (c === open) depth++;
          else if (c === close) { depth--; if (!depth) break; }
        }
        if (/btn\('닫기',\s*'ghost'\)/.test(src.slice(i, j + 1))) {
          bad.push(`${sc.file}: 패널의 닫기는 일반 버튼이다 — btn('닫기')`);
          break;
        }
      }
    }
    return bad;
  },
};

// The strip carries the RECORD's identifier and times, and it sits at the foot of the panel. Under
// a tab holding a rule table or an equipment list it therefore reads as belonging to what that tab
// is showing, and the reader takes `ID sub_48112` for the identifier of the row they were reading.
// The first tab is the record itself; there the strip says what it means. Companion frames stack
// the panes the base does not open, so every pane in one is a later tab and none of them draws it.
export const auditFootFirstTabGate = {
  id: 'auditFootFirstTabGate',
  title: '감사 줄이 첫 칸이 아닌 탭에 있다',
  stage: 'built',
  run: (ctx) => {
    const bad = [];
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      if (!/\bauditFoot\s*\(/.test(src)) continue;
      if (/\btabPanes\s*\(/.test(src)) {
        bad.push(`${sc.file}: 동반 프레임의 칸은 전부 첫 칸이 아니다 — 감사 줄을 뺀다`);
        continue;
      }
      for (const m of src.matchAll(/(?<![A-Za-z])(?:tabs|recordTabs)\s*\(\[/g)) {
        let i = m.index + m[0].length - 1, depth = 0, j = i;
        for (; j < src.length; j++) {
          const c = src[j];
          if (c === '[') depth++;
          else if (c === ']') { depth--; if (!depth) break; }
        }
        const items = src.slice(i, j + 1).split(/\},\s*\{/);
        const at = items.findIndex((x) => /active:\s*true/.test(x));
        if (at > 0) {
          bad.push(`${sc.file}: ${at + 1}번째 칸이 열린 채로 감사 줄을 그린다 — 첫 칸에서만 표시한다`);
          break;
        }
      }
    }
    return bad;
  },
};

// **Whether a standing card may be closed turns on whether a closed one can be found again**, and
// that is what `dismissibleNotices` declares — the kit ties the close and the header controls that
// bring one back into one capability, so a board cannot have the first without the second. This
// gate therefore asks a different question of each kind of board, and both questions are the same
// question underneath: is a reader who puts this message away losing it?
//
// **Where the option is off, a dismissal is a deletion**, and a card whose words describe what is
// on the site right now must not offer one — whoever closed 「정책이 없는 안전구역이 1개 있습니다」
// today would never be shown tomorrow's zone losing its policy. The server cannot tell a standing
// fact from a live one, so the screen declares it: `status: true` because it is, or `dismiss`
// because the author looked and decided otherwise.
//
// **Where the option is on, that reason is gone and `status: true` is the defect.** The header
// control for a kind is marked while one of its cards is hidden, so putting one away moves the
// message rather than losing it, and withholding the close buys nothing while costing the reader
// a screen they cannot quieten. A live count in the title is no exception — it is the shape that
// used to justify `status`, and under a recoverable dismissal it justifies nothing.
//
// **What never closes in either kind of board is a transient failure** — the answer to something
// the reader just did, gone on the next attempt. The test is whether the message survives the
// reader doing nothing: still there a minute later, it stands. `error` is that kind and is not a
// notice card, which is why it is skipped rather than judged.
//
// **This gate reads the cards that name a number, which is about two status cards in five.**
// Measured on the board it was written for: 233 cards were status cards and the count test reached
// 96 of them. The rest say what is on the site without naming a number — 「대형 재고가 없습니다」,
// 「한 곳이 아직 v3을 들고 있습니다」 — and no regex separates those from a standing rule, because
// both are ordinary sentences and the difference is what they are ABOUT. **So a green result here
// does not mean the cards have been judged**, and the danger is that it reads as though it does.
export const aStandingCardClosesWhenItCanGate = {
  id: 'aStandingCardClosesWhenItCanGate',
  title: '서 있는 카드가 닫힐 수 있는데 닫히지 않는다 (수를 말하지 않는 카드는 잡지 못한다 — 사람이 본다)',
  stage: 'built',
  run: (ctx) => {
    // One capability, declared by the board: the close and the header control that undoes it.
    const recoverable = ctx.config?.patternOptions?.dismissibleNotices === true;
    const NUM = '(?:\\d+|하나|둘|셋|넷|다섯|여섯|일곱|여덟|아홉|열|한|두|세|네)';
    const UNIT = '(?:건|개(?!월)|명|곳|대(?!한)|장(?!소)|척|쌍|줄|가지|종(?!료)|군데|점|매|회차|자리|쪽)';
    const COUNT = new RegExp(`${NUM}\\s*${UNIT}(?![가-힣])|\\d+%`);
    const bad = [];
    for (const sc of ctx.screens) {
      const src = ctx.srcOf(sc.file);
      for (const m of src.matchAll(/\bmsg\s*\(\{/g)) {
        let i = m.index + m[0].length - 1, depth = 0, j = i;
        for (; j < src.length; j++) {
          const c = src[j];
          if (c === '{') depth++;
          else if (c === '}') { depth--; if (!depth) break; }
        }
        const call = src.slice(i, j + 1);
        const kind = /kind:\s*'([a-z]+)'/.exec(call)?.[1] ?? 'info';
        if (!['help', 'info', 'warn'].includes(kind)) continue;
        const declaresStatus = /\bstatus:\s*true/.test(call);
        // Off: an undeclared count-bearing card is the finding. On: a declared one is.
        if (recoverable ? !declaresStatus : /\b(?:status|dismiss):/.test(call)) continue;
        const title = /title:\s*'([^']*)'/.exec(call)?.[1] ?? '';
        const body = /body:\s*(?:'([^']*)'|`([^`]*)`)/.exec(call);
        if (!COUNT.test(`${title} ${body?.[1] ?? body?.[2] ?? ''}`)) continue;
        bad.push(
          `${sc.file}: 「${(title || '').slice(0, 24)}…」 — ` +
          (recoverable
            ? 'status를 뗀다. 이 보드는 닫은 카드를 머리 제어로 되돌리므로 닫기를 뺏을 근거가 없다 — '
              + '치우면 그 사람에게만, 그 갈래의 제어에 표시가 남은 채로 옮겨진다. '
              + '제목에 건수가 실린 것은 예외가 아니라 예전에 status를 정당화하던 바로 그 모양이다. '
              + '닫히지 않는 것은 방금 누른 것에 대한 답 하나뿐이고, 그것은 error라 이 검사가 보지 않는다'
            : 'status나 dismiss를 밝힌다. 이 보드는 닫은 카드를 되돌릴 길이 없으므로 닫기가 삭제와 같다 — '
              + '판정은 「이 문장을 빈 사업장에서도 쓸 수 있는가」로 한다') +
          '. 이 검사는 수를 적은 카드만 보므로 다섯 가운데 둘쯤을 찾는다 — 초록이어도 나머지는 사람이 읽어야 한다'
        );
        break;
      }
    }
    return bad;
  },
};

// What the reader is actually shown, counted in the built page rather than reasoned about in the
// source.
//
// **Every rule about these cards that read the source has been narrower than the rule itself.** One
// never read the `dismiss` values at all; one wrote its exemption from a shape rather than from the
// rule and let `{cond ? <card/> : nothing}` through; one read the first card on a page and went
// quiet about the third. Each was correct about the case that prompted it and blind to the next
// one, because a source rule carries a model of the code and the model is what goes stale.
//
// **This one carries no model.** It opens the built page, finds the messages, and asks whether the
// close control is there — which is the same question the reader answers by looking. A screen whose
// header draws the controls that bring a closed card back is a screen where every closing kind
// closes; a sign-in panel and a phone body draw no such header, and on those a close would delete
// the message rather than move it, so they are not asked. Nothing here needs to know which screens
// those are: the header says so itself.
//
// **The copies inside the drop are not cards on the page.** `noticeDrop` draws each hidden card
// again inside the control, with its own 「다시 보이기」 beside it rather than a close.
export const everyStandingCardDrawsItsCloseGate = {
  id: 'everyStandingCardDrawsItsCloseGate',
  title: '되돌릴 머리 제어가 있는 화면인데 닫기 없는 카드가 그려졌다',
  stage: 'built',
  run: (ctx) => {
    const CLOSES = ['help', 'warn', 'info', 'danger'];
    const bad = [];
    for (const [, id, html] of ctx.html.matchAll(/<article class="frame[^"]*" id="([^"]+)">([\s\S]*?)<\/article>/g)) {
      if (!html.includes('class="noticons"')) continue;
      const drops = [];
      for (const d of html.matchAll(/<div class="noticedrop"/g)) drops.push([d.index, blockEnd(html, d.index)]);
      for (const m of html.matchAll(/<div class="msg ([a-z]+)"/g)) {
        if (!CLOSES.includes(m[1])) continue;
        if (drops.some(([a, b]) => m.index > a && m.index < b)) continue;
        const block = html.slice(m.index, blockEnd(html, m.index));
        if (block.includes('n-close')) continue;
        const title = /<div class="mtitle">([^<]{0,40})/.exec(block)?.[1] ?? '';
        bad.push(
          `${id}: 「${title}」 — ${m[1]} 카드에 닫기가 없다. `
          + '이 화면의 머리는 치운 카드를 되돌리는 제어를 그리므로 닫음은 잃는 것이 아니라 옮기는 것이고, '
          + '닫히지 않아도 되는 것은 방금 누른 것에 대한 답 하나뿐이다 — 그것은 오류 갈래라 여기에 없다'
        );
      }
    }
    return bad;
  },
};

/** Where a `<div>` that starts at `from` closes, counting nested opens. */
function blockEnd(html, from) {
  let d = 0;
  for (const m of html.slice(from).matchAll(/<\/?div\b/g)) {
    d += m[0] === '</div' ? -1 : 1;
    if (d === 0) return from + m.index + 6;
  }
  return html.length;
}
