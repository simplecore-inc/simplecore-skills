// A word a project declares as its own, held against the documents that are supposed to write it.
//
// Six keys are not paths but this project's own words and markup — `chapterLines`,
// `evidenceLabels`, `closedStatus`, `verdictRole`, `deferredLine` and `eyesPhrases` — and every
// check over a chapter file or a result document compares against them. **A word declared wrongly
// does not fail; it matches nothing, and matching nothing is what a repository with nothing wrong
// also does.** The two markup conventions are opposite on purpose — a `chapterLines` phrase is the
// line as written, markup and all, and an `evidenceLabels` value is the word alone, because the
// checks add the emphasis themselves — so the commonest way to get this wrong is to declare one
// of them the way the other is declared, and the run stays green either way.
//
// That was held by a sentence in a setup command, which is the third category `SKILL.md` says does
// not exist: not a gate, not marked as needing eyes, and reading as though something were holding
// it. This is the gate.
//
// **The whole difficulty is the boundary, and getting it wrong makes the gate worthless in both
// directions.** A project that has just been wired has no result documents, so zero matches there
// is correct rather than a defect; a project mid-build has chapter files full of lines nothing
// matched, and that is a config that has stopped working. So every entry below carries what
// established which of the two it is, and says so in its own text — a reader is never left
// guessing whether the comparison ran.
import { compileLine } from './grammar.mjs';
import { proseLines, tableCells } from './prose.mjs';
import { BASE_HEADING, CHAPTER_SECTION, EVIDENCE_HEADING, ROLE_SEPARATOR } from './evidence.mjs';

/**
 * The markup a declaration and a document line may differ by while saying the same words.
 *
 * <p>Stripping it from both sides is how the two conventions are told apart from a word that is
 * simply wrong: when the strict comparison finds nothing and the markup-blind one finds the line,
 * the words are in the document and the declaration's markup is not what the document writes.
 * **That is a finding with no false positive available to it** — the corpus is holding up the
 * matching line.
 */
const MARKUP = /[*_`~]/g;

/** One string with its markdown emphasis removed, for the markup-blind comparison. */
const bare = (text) => String(text).replace(MARKUP, '');

/** A line that leads with a bolded word, which is the shape every evidence label is written in. */
const BOLD_LEAD = /^\*\*[^*]+\*\*/;

/** The two conventions, named in the finding so the fix is the next thing a reader reads. */
const CONVENTIONS = {
  line: 'the line as written, markup and all — `**Test · {text}**…`, never `Test · `',
  word: 'the word alone, with no markup on it — the checks write the emphasis themselves',
};

/** Every chapter file, by the chapter its name carries. */
const chapters = (ctx) => ctx.evidence.chapterFiles();

/** One chapter's file text, or null. */
const chapterText = (ctx, file) => ctx.read(`${ctx.declared('chapterDir')}/${file}`);

/** One chapter's result document, or null where the verification has not been written. */
const resultText = (ctx, file) => {
  const dir = ctx.declared('evidenceDir');
  return dir === null ? null : ctx.read(`${dir}/${file}`);
};

/**
 * Every document of one kind, as `{ rel, lines }` with the fenced blocks already gone.
 *
 * <p>A fenced block is what a machine verification pastes its command and its output into, and
 * neither is prose a declaration is meant to match — the same reason every other reader here
 * starts from `proseLines`.
 */
function corpus(ctx, kind) {
  const out = [];
  for (const [, file] of [...chapters(ctx)].sort()) {
    const text = kind === 'chapter' ? chapterText(ctx, file) : resultText(ctx, file);
    if (text === null) continue;
    const dir = kind === 'chapter' ? ctx.declared('chapterDir') : ctx.declared('evidenceDir');
    out.push({ rel: `${dir}/${file}`, file, lines: proseLines(text).map((l) => l.line) });
  }
  return out;
}

/** How many lines a corpus holds — the comparisons a line-by-line reader actually made. */
const lineCount = (docs) => docs.reduce((n, doc) => n + doc.lines.length, 0);

/**
 * One declaration's census entry.
 *
 * <p>`expects` is the boundary and `because` is the sentence that established it. A `false` there
 * is not a gap in the gate — it is the gate saying there is nothing yet to match against, which is
 * the state a freshly-wired project is correctly in.
 */
function entry(label, declared, convention, corpusName, docs, compared, matched, relaxed, expects, because) {
  return { label, declared, convention, corpus: corpusName, documents: docs, compared, matched, relaxed, expects, because };
}

/** Every line of a corpus a compiled reader matches. */
function countLines(docs, re) {
  if (!re) return 0;
  let n = 0;
  for (const doc of docs) for (const line of doc.lines) if (re.test(line)) n += 1;
  return n;
}

/** The same, over the markup-blind form of every line. */
function countBare(docs, re) {
  if (!re) return 0;
  let n = 0;
  for (const doc of docs) for (const line of doc.lines) if (re.test(bare(line))) n += 1;
  return n;
}

/**
 * The chapter lines — three roles, one corpus, and a different signal establishing each boundary.
 *
 * <p>**`persona` and `verdict` each have an independent witness in the chapter files themselves.**
 * A chapter that places a frame names the personas that prove it, so a frame heading anywhere in
 * the set means a persona line is owed; a chapter with numbered sections and no frame heading is a
 * foundation chapter, which is proved by machine and writes the verdict line instead. Neither
 * witness reads the declaration, which is what makes it a witness.
 *
 * <p>**`states` has none, and is judged only when the markup-blind reader finds what the strict one
 * missed.** A board that gives every state a frame of its own writes no such sentence, and a small
 * board may have no screen with a state hanging off it — so a bare zero there is a project this
 * gate has nothing to say about, and saying it anyway would be the false positive that takes the
 * two rows beside it down as well.
 */
function chapterLineEntries(ctx, lines) {
  const declared = ctx.declared('chapterLines');
  if (!declared || typeof declared !== 'object' || Array.isArray(declared)) return [];
  const docs = corpus(ctx, 'chapter');
  const compared = lineCount(docs);

  let placing = 0;
  let foundation = 0;
  for (const doc of docs) {
    const frames = doc.lines.some((line) => BASE_HEADING.test(line));
    const sections = doc.lines.some((line) => CHAPTER_SECTION.test(line));
    if (frames) placing += 1;
    else if (sections) foundation += 1;
  }

  const witness = {
    persona: [
      placing > 0,
      `${placing} chapter file(s) place a frame, and a chapter that places a screen names the personas that prove it`,
    ],
    verdict: [
      foundation > 0,
      `${foundation} chapter file(s) carry numbered sections and place no frame, which is a chapter proved by machine`,
    ],
    states: [
      false,
      'nothing independent of the declaration says this project has a screen with states hanging off it, so only the markup-blind reader can speak here',
    ],
  };

  const out = [];
  for (const [role, phrase] of Object.entries(declared)) {
    if (role.startsWith('//') || phrase === null) continue;
    let loose = null;
    try {
      loose = compileLine(bare(phrase), `chapterLines.${role}`);
    } catch {
      // A phrase the grammar refuses is `configGate`'s finding, and reporting it twice under two
      // ids sends somebody to fix it in two places.
      continue;
    }
    const [expects, because] = witness[role] ?? [false, 'this project declares a role the skill does not read'];
    out.push(entry(
      `chapterLines.${role}`, phrase, CONVENTIONS.line, 'chapter files',
      docs.length, compared, countLines(docs, lines[role]), countBare(docs, loose), expects, because
    ));
  }
  return out;
}

/**
 * The three evidence labels, against the result documents.
 *
 * <p>**The witness is the document's own shape rather than its words**: a result document writes
 * every one of its labels as a bolded lead-in, so a document holding lead-ins and not this one has
 * a label declared as something nobody writes. A document still being written holds no lead-ins
 * yet and establishes nothing, which is the boundary — a chapter halfway through its verification
 * is not a misdeclared config.
 */
function evidenceLabelEntries(ctx) {
  const declared = ctx.declared('evidenceLabels');
  if (!declared || typeof declared !== 'object' || Array.isArray(declared)) return [];
  const docs = corpus(ctx, 'result');
  const compared = lineCount(docs);
  const leads = docs.reduce((n, doc) => n + doc.lines.filter((line) => BOLD_LEAD.test(line)).length, 0);

  const out = [];
  for (const [role, label] of Object.entries(declared)) {
    if (role.startsWith('//') || typeof label !== 'string' || !label) continue;
    let matched = 0;
    let relaxed = 0;
    for (const doc of docs) {
      for (const line of doc.lines) {
        if (line.startsWith(`**${label}**`)) matched += 1;
        if (bare(line).startsWith(bare(label))) relaxed += 1;
      }
    }
    out.push(entry(
      `evidenceLabels.${role}`, label, CONVENTIONS.word, 'result documents',
      docs.length, compared, matched, relaxed, leads > 0,
      `${leads} line(s) in the result documents lead with a bolded word, which is the shape every label is written in`
    ));
  }
  return out;
}

/**
 * The word the ledger writes for a closed chapter.
 *
 * <p>**Judged by the markup-blind reader alone, deliberately.** Nothing independent of this word
 * says a chapter has closed — a build with every chapter open is the normal state of a project
 * halfway through, and a result document sitting beside an open chapter is the normal state of one
 * whose verification has just run and whose ledger row is written next. Any witness for it would be
 * a threshold somebody picked, and a threshold picked to make a gate speak is how a gate starts
 * crying wolf. The census still prints what it matched, so a person reading `doctor` sees the zero.
 */
function closedStatusEntry(ctx) {
  const word = ctx.declared('closedStatus');
  const rel = ctx.declared('stateLedger');
  if (word === null || rel === null) return [];
  const text = ctx.read(ctx.at('stateLedger'));
  if (text === null) return [];
  const known = new Set(chapters(ctx).keys());
  let compared = 0;
  let matched = 0;
  let relaxed = 0;
  for (const { line } of proseLines(text)) {
    const cells = tableCells(line);
    if (!cells || cells.length < 2 || !known.has(cells[0].toUpperCase())) continue;
    compared += 1;
    if (cells[1] === word) matched += 1;
    if (bare(cells[1]) === bare(word)) relaxed += 1;
  }
  return [entry(
    'closedStatus', word, CONVENTIONS.word, 'state ledger', 1, compared, matched, relaxed, false,
    'a chapter that has not closed is the normal state of a build in progress, so nothing but the markup-blind reader can speak here'
  )];
}

/**
 * The word an evidence heading writes where a persona name would stand.
 *
 * <p>The witness pairs the two documents: a chapter that carries a verdict line and has a result
 * document with role-suffixed headings is a chapter whose document owes one heading ending in this
 * word. Neither half alone would do — role-suffixed headings appear in every screen chapter's
 * document, so a project with no foundation chapter would be told to declare a word it never uses.
 */
function verdictRoleEntry(ctx, lines) {
  const role = ctx.declared('verdictRole');
  if (role === null || ctx.declared('evidenceDir') === null) return [];
  const suffix = `${ROLE_SEPARATOR}${role}`;
  let documents = 0;
  let compared = 0;
  let matched = 0;
  let relaxed = 0;
  let owed = 0;
  for (const [, file] of [...chapters(ctx)].sort()) {
    const result = resultText(ctx, file);
    if (result === null) continue;
    documents += 1;
    const chapter = chapterText(ctx, file);
    const demandsVerdict = chapter !== null && lines.verdict
      && proseLines(chapter).some(({ line }) => lines.verdict.test(line));
    let suffixed = 0;
    for (const { line } of proseLines(result)) {
      const heading = EVIDENCE_HEADING.exec(line);
      if (!heading) continue;
      compared += 1;
      if (heading[1].includes(ROLE_SEPARATOR)) suffixed += 1;
      if (heading[1].endsWith(suffix)) matched += 1;
      if (bare(heading[1]).endsWith(bare(suffix))) relaxed += 1;
    }
    if (demandsVerdict && suffixed > 0) owed += 1;
  }
  return [entry(
    'verdictRole', role, CONVENTIONS.word, 'result document headings', documents, compared, matched, relaxed, owed > 0,
    `${owed} chapter(s) carry a verdict line and have a result document writing role-suffixed headings`
  )];
}

/**
 * The line a section carries for a check this installation could not decide.
 *
 * <p>**No witness, and there never can be one.** A project declares this because it expects to meet
 * the case, and a project that declares it and never meets it is a project with nothing wrong —
 * which is exactly what a bare zero here means. The markup-blind reader is the whole of what can
 * be said.
 */
function deferredLineEntry(ctx, lines) {
  const phrase = ctx.declared('deferredLine');
  if (phrase === null || ctx.declared('evidenceDir') === null) return [];
  let loose = null;
  try {
    loose = compileLine(bare(phrase), 'deferredLine');
  } catch {
    return [];
  }
  const docs = corpus(ctx, 'result');
  return [entry(
    'deferredLine', phrase, CONVENTIONS.line, 'result documents',
    docs.length, lineCount(docs), countLines(docs, lines.deferred), countBare(docs, loose), false,
    'a project that has never met the case writes no such line, which is a project with nothing wrong'
  )];
}

/**
 * The line an evidence section carries in place of a picture.
 *
 * <p>Same shape as the deferral above and the same absence of a witness: a project declares it
 * because it expects to meet unbuilt placeholders behind a tab strip, and one that declares it and
 * never meets them is a project with nothing wrong. The markup-blind count is the whole of what
 * can be said — a declaration written the way `evidenceLabels` is written matches nothing, and the
 * relaxed reading finding the line is what shows that.
 */
function placeholderLineEntry(ctx, lines) {
  const phrase = ctx.declared('placeholderLine');
  if (phrase === null || ctx.declared('evidenceDir') === null) return [];
  let loose = null;
  try {
    loose = compileLine(bare(phrase), 'placeholderLine');
  } catch {
    return [];
  }
  const docs = corpus(ctx, 'result');
  return [entry(
    'placeholderLine', phrase, CONVENTIONS.line, 'result documents',
    docs.length, lineCount(docs), countLines(docs, lines.placeholder), countBare(docs, loose), false,
    'a project whose panes are all built discharges nothing, which is a project with nothing wrong'
  )];
}

/**
 * The words a demand says why a picture is the only witness in.
 *
 * <p><b>No boundary is claimed, and the reason is that a hole here cannot be silent.</b> A
 * `transient` list that matches nothing means either that this project's demands never reach a
 * dialog — possible, and a project with nothing wrong — or that the phrases were written
 * differently from the way the generator writes them. The second is not the quiet failure it is
 * everywhere else: `everyCaptureDemandGivesItsReason` reads the same lists and fires once per
 * clause that names a capture, so a vocabulary that misses the generator's wording is the loudest
 * thing in the run rather than a zero nobody meets. It is the argument `eyesPhrases` makes about
 * its second and third lists, arriving through a different gate.
 *
 * <p>So what is left to say is the count, and it is worth saying: a chapter set regenerated before
 * the key was declared holds no reasons at all, and `0 matched` there is a set waiting to be
 * regenerated rather than a declaration that is wrong.
 */
function captureReasonEntries(ctx) {
  const declared = ctx.declared('captureReasons');
  if (!declared || typeof declared !== 'object' || Array.isArray(declared)) return [];
  const docs = corpus(ctx, 'chapter');
  const lines = docs.flatMap((doc) => doc.lines);

  const out = [];
  for (const [role, phrases] of Object.entries(declared)) {
    if (role.startsWith('//') || !Array.isArray(phrases) || !phrases.length) continue;
    const lower = phrases.filter((p) => typeof p === 'string' && p).map((p) => p.toLowerCase());
    let matched = 0;
    let relaxed = 0;
    for (const line of lines) {
      const text = line.toLowerCase();
      if (lower.some((p) => text.includes(p))) matched += 1;
      if (lower.some((p) => bare(text).includes(bare(p)))) relaxed += 1;
    }
    out.push(entry(
      `captureReasons.${role}`, `${lower.length} phrase(s)`, CONVENTIONS.word, 'chapter files',
      docs.length, lines.length, matched, relaxed, false,
      'a project whose demands never reach this case writes no such reason, and a chapter set that '
      + 'has not been regenerated since the key was declared holds none of them yet'
    ));
  }
  return out;
}

/**
 * The phrasings that hand a check to human eyes.
 *
 * <p>Only `assigns` is judged. `reader` and `moment` are consulted inside a block `assigns` has
 * already matched, so a hole in either fires `eyesRuleNamesItsReader` on every such block — loudly,
 * and with somebody's attention. A hole in `assigns` is the silent one: the gate reads every
 * declared document, finds nothing to judge, and reports the same zero as a repository whose eyes
 * rules all name a reader. The census carries all three counts.
 */
function eyesPhraseEntries(ctx) {
  const declared = ctx.declared('eyesPhrases');
  const documents = ctx.declared('eyesDocuments');
  if (!declared || typeof declared !== 'object' || !Array.isArray(documents)) return [];
  const texts = documents.map((rel) => ({ rel, text: ctx.read(rel) })).filter((d) => d.text !== null);
  const lines = texts.flatMap((d) => proseLines(d.text).map((l) => l.line));

  const out = [];
  for (const [role, phrases] of Object.entries(declared)) {
    if (role.startsWith('//') || !Array.isArray(phrases) || !phrases.length) continue;
    const lower = phrases.filter((p) => typeof p === 'string' && p).map((p) => p.toLowerCase());
    let matched = 0;
    let relaxed = 0;
    for (const line of lines) {
      const text = line.toLowerCase();
      const stripped = bare(text);
      if (lower.some((p) => text.includes(p))) matched += 1;
      if (lower.some((p) => stripped.includes(bare(p)))) relaxed += 1;
    }
    out.push(entry(
      `eyesPhrases.${role}`, `${lower.length} phrase(s)`, CONVENTIONS.word, 'declared eyes documents',
      texts.length, lines.length, matched, relaxed,
      role === 'assigns' && lines.length > 0,
      role === 'assigns'
        ? `${texts.length} declared document(s) hold ${lines.length} lines of prose, and a document is declared here because it hands checks to eyes`
        : 'this list is read only inside a block `assigns` already matched, so a hole in it fires `eyesRuleNamesItsReader` on every such block rather than going quiet'
    ));
  }
  return out;
}

/**
 * Every vocabulary a project declares, with what it matched and what established the boundary.
 *
 * <p>One reader for the gate and for `doctor`, because the census is the half of this that is worth
 * as much when nothing is wrong: 「0 findings」 and 「186 lines matched across 22 chapter files」 are
 * one line to an exit status and two different sentences to a person, and only the second shows a
 * comparison that reached something.
 */
export function vocabularyCensus(ctx) {
  let lines = {};
  try {
    lines = ctx.lines;
  } catch {
    // A grammar that will not compile is `configGate`'s to report; here it simply means the
    // strict readers do not exist, and every entry that needs one is left out.
    lines = {};
  }
  return [
    ...chapterLineEntries(ctx, lines),
    ...evidenceLabelEntries(ctx),
    ...closedStatusEntry(ctx),
    ...verdictRoleEntry(ctx, lines),
    ...deferredLineEntry(ctx, lines),
    ...placeholderLineEntry(ctx, lines),
    ...captureReasonEntries(ctx),
    ...eyesPhraseEntries(ctx),
  ];
}

/** One census entry as a line of `doctor`'s report. */
export function censusLine(item) {
  const where = `${item.documents} ${item.corpus}, ${item.compared} compared`;
  if (item.compared === 0) return `○ ${item.label.padEnd(24)} nothing to match against yet — ${where}`;
  if (item.matched > 0) return `✔ ${item.label.padEnd(24)} matched ${item.matched} — ${where}`;
  const blind = item.relaxed > 0 ? `, ${item.relaxed} once the markup is ignored` : '';
  return `${item.expects ? '✖' : '⚠'} ${item.label.padEnd(24)} matched nothing${blind} — ${where}`;
}

export const declaredWordsMatchTheDocuments = {
  id: 'declaredWordsMatchTheDocuments',
  title: 'a word this project declares as its own vocabulary is one none of its documents writes',
  needs: [],
  run: (ctx) => {
    const findings = [];
    for (const item of vocabularyCensus(ctx)) {
      if (item.matched > 0 || item.compared === 0) continue;
      const blind = item.relaxed > 0;
      if (!blind && !item.expects) continue;
      const where = `${item.documents} ${item.corpus} holding ${item.compared} comparisons`;
      findings.push(
        `${item.label} is declared 「${item.declared}」 and matched nothing in ${where}. `
        + (blind
          ? `The same declaration with its markdown ignored matches ${item.relaxed} of them, so the words are in the documents and the markup is not: this key takes ${item.convention}. `
          : `${item.because}, so there is something here to match and the declaration reaches none of it. `)
        + 'A vocabulary that matches nothing does not fail — every check that reads it reports the '
        + 'same zero as a project with nothing wrong, which is why the count is the finding'
      );
    }
    return findings;
  },
};

/**
 * A declaration nothing has been compared against yet.
 *
 * <p><b>This is the other half of the same zero, and it is a separate gate because it is a
 * separate KIND of finding.</b> 「I compared and nothing matched」 is a defect and reddens the run;
 * 「there was nothing to compare against」 is a project that has not written the documents yet, and
 * failing on it would redden every repository on the day it is wired. Graded on one gate they
 * could not be told apart — a gate answers one question — so they are two gates, and between them
 * the third state is the only one left silent: compared, and it matched.
 *
 * <p><b>Without this, `check` says nothing in two very different situations</b>, which is the exact
 * shape 「the third category comes back as a checker that did not run」 describes: a declaration
 * whose corpus is empty has never been tested by anything, and a run reporting no findings over it
 * reads identically to a run that tested it and found it sound. The warning is what parts them.
 *
 * <p>The two gates cannot both speak about one entry: this one takes `compared === 0` and the
 * other skips it, so a single misdeclaration is never reported twice under two ids.
 */
export const declaredWordsHaveBeenCompared = {
  id: 'declaredWordsHaveBeenCompared',
  title: 'a declared vocabulary nothing has been compared against yet, so no check over it has ever run',
  needs: [],
  grade: 'warning',
  run: (ctx) => {
    const findings = [];
    for (const item of vocabularyCensus(ctx)) {
      if (item.compared > 0) continue;
      findings.push(
        `${item.label} is declared 「${item.declared}」 and has been compared against nothing: `
        + `${item.documents} ${item.corpus}, 0 comparisons. This is not 「compared and matched `
        + 'nothing」 — it is a corpus that is not there yet, which is what a project between being '
        + 'wired and its first written document correctly looks like. Nothing has tested this '
        + 'declaration, so a green run over it says only that there was nothing to read; come back '
        + `once the ${item.corpus} exist and read the census in \`bta.mjs doctor\``
      );
    }
    return findings;
  },
};

export const VOCABULARY_GATES = [declaredWordsMatchTheDocuments, declaredWordsHaveBeenCompared];

// ── The cases ──────────────────────────────────────────────────────────────
//
// **The boundary is what these are for.** A gate over a vocabulary is easy to write and easy to
// write worthlessly: one that fires whenever a count is zero reddens every project on the day it
// is wired, and one that stays quiet whenever a count is zero is the silence it was written to
// break. So both edges are pinned — a freshly-wired project with no documents at all, and a
// project mid-build whose result documents have not been written yet, each has to stay quiet
// while the two misdeclarations fire.

/** One project's vocabulary, declared the way the two conventions ask for. */
const DECLARED = {
  chapterDir: 'chapters',
  evidenceDir: 'docs/evidence',
  stateLedger: 'tracking/STATE.md',
  chapterLines: {
    persona: '**테스트 · {text}**…',
    verdict: '**판정**…',
    states: '…상태 {n}장이 딸린다 — {text}.',
  },
  evidenceLabels: { did: '한 일', demanded: '챕터가 정한 것', saw: '본 것' },
  closedStatus: '닫힘',
  verdictRole: '판정',
};

/** A foundation chapter proved by machine, and a screen chapter proved by two personas. */
const CHAPTERS = {
  'chapters/00-overview.md': '# 챕터\n',
  'chapters/w01-foundation.md':
    '# W01. 개발 기반\n\n## 1. 모노레포와 빌드\n\n'
    + '**개발** — 앱 셋을 한 저장소에 둔다.\n'
    + '**판정** — 한 명령으로 빌드가 끝난다.\n',
  'chapters/w02-org-shell.md':
    '# W02. 조직·계정\n\n## 1. A-01 로그인\n\n'
    + '**개발** — 보드의 `a-01-login`을 그대로 만든다. 상태 1장이 딸린다 — A-02 잠김.\n'
    + '**테스트 · 시스템 관리자** — 로그인 화면을 연다.\n'
    + '**테스트 · 안전관리자** — 범위 밖 레코드는 주소로 불러도 서버가 막는다.\n',
};

/** The result documents those two chapters leave behind, written in the declared labels. */
const RESULTS = {
  'docs/evidence/w01-foundation.md':
    '# W01. 개발 기반 — 검증 결과\n\n## 1. 모노레포와 빌드 · 판정\n\n'
    + '**한 일** — 빈 저장소를 받아 한 명령으로 빌드한다.\n'
    + '**챕터가 정한 것** — 한 명령으로 빌드가 끝난다.\n'
    + '**본 것** — 앱 셋이 모두 빌드된다.\n\n'
    + '```\n$ pnpm build\n3 apps built\n```\n',
  'docs/evidence/w02-org-shell.md':
    '# W02. 조직·계정 — 검증 결과\n\n## 1. A-01 로그인 · 시스템 관리자\n\n'
    + '**한 일** — 로그인 화면을 연다.\n'
    + '**챕터가 정한 것** — 로그인 화면을 연다.\n'
    + '**본 것** — 화면이 열린다.\n\n'
    + '![A-01 로그인](w02-org-shell/a-01.webp)\n',
};

/** The ledger, with the foundation chapter closed in the declared word. */
const LEDGER = (word = '닫힘') => `# 챕터 상태\n\n| 챕터 | 상태 |\n| --- | --- |\n| W01 | ${word} |\n| W02 | 열림 |\n`;

export function cases(t) {
  const project = (config, files) => t.project({ config: { ...DECLARED, ...config }, files });
  const whole = { ...CHAPTERS, ...RESULTS, 'tracking/STATE.md': LEDGER() };

  // ── Fires ────────────────────────────────────────────────────────────────

  // The inversion `configGate` cannot see. It refuses an `evidenceLabels` value carrying markdown,
  // because that key is the word alone and markdown in it is wrong by inspection. The opposite
  // direction has no such tell: a `chapterLines` phrase written without the emphasis its chapters
  // carry is a perfectly ordinary-looking phrase, and only the documents say it matches nothing.
  t.add(
    'declaredWordsMatchTheDocuments',
    'a chapter line declared without the markup its chapters write',
    project({ chapterLines: { ...DECLARED.chapterLines, persona: '테스트 · {text}…' } }, whole),
    true
  );
  t.add(
    'declaredWordsMatchTheDocuments',
    'the ledger word declared with emphasis the ledger does not write',
    project({ closedStatus: '**닫힘**' }, whole),
    true
  );
  // Not a markup question at all: the word is simply not the one the documents use, so the
  // markup-blind reader finds nothing either and the witness is what speaks — the result documents
  // are written in bolded lead-ins, and none of them is this one.
  t.add(
    'declaredWordsMatchTheDocuments',
    'a label declared as a word that appears nowhere',
    project({ evidenceLabels: { ...DECLARED.evidenceLabels, saw: '관찰한 것' } }, whole),
    true
  );

  // ── Stays quiet ──────────────────────────────────────────────────────────

  t.add('declaredWordsMatchTheDocuments', 'a project whose words are the ones its documents write', project({}, whole), false);
  // The edge the gate exists to respect. Everything is declared and nothing has been written yet,
  // which is what `/simplecore:board-to-app-init` leaves behind — every count is zero and every
  // one of them is correct.
  t.add(
    'declaredWordsMatchTheDocuments',
    'a project just wired, with no chapters and no result documents',
    project({}, {
      'chapters/00-overview.md': '# 챕터\n',
      'docs/evidence/': '',
      'tracking/STATE.md': '# 챕터 상태\n\n| 챕터 | 상태 |\n| --- | --- |\n',
    }),
    false
  );
  // The same edge one step in: the chapters are generated and not one has been verified. The
  // chapter lines match and the evidence labels have nothing to match against, and a gate that
  // read the second as a defect would fire on every project between wiring and its first closed
  // chapter.
  t.add(
    'declaredWordsMatchTheDocuments',
    'a project mid-build, whose chapters exist and whose result documents do not',
    project({}, { ...CHAPTERS, 'docs/evidence/': '', 'tracking/STATE.md': LEDGER('열림') }),
    false
  );

  // ── The other half of the same zero ──────────────────────────────────────
  //
  // The two projects the gate above must stay quiet on are the two this one must speak on, and
  // that pairing is the whole point: between them, `check` printing nothing about a vocabulary
  // means it was compared and it matched, rather than meaning nothing was ever read.
  t.add(
    'declaredWordsHaveBeenCompared',
    'a project just wired, where nothing has been compared against anything',
    project({}, {
      'chapters/00-overview.md': '# 챕터\n',
      'docs/evidence/': '',
      'tracking/STATE.md': '# 챕터 상태\n\n| 챕터 | 상태 |\n| --- | --- |\n',
    }),
    true
  );
  t.add(
    'declaredWordsHaveBeenCompared',
    'a project whose chapters have been compared and whose result documents do not exist',
    project({}, { ...CHAPTERS, 'docs/evidence/': '', 'tracking/STATE.md': LEDGER('열림') }),
    true
  );
  t.add(
    'declaredWordsHaveBeenCompared',
    'a project where every declared word has a corpus to be read against',
    project({}, whole),
    false
  );
}
