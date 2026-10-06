// A word a project declares as its own, held against the documents that are supposed to write it.
//
// Some keys name a project's own words rather than paths: `closedStatus` in the state ledger,
// `verdictRole`, `deferredLine` and `placeholderLine` in the run records, and `eyesPhrases` in the
// documents `eyesDocuments` names. **A word declared wrongly does not fail; it matches nothing, and
// matching nothing is what a repository with nothing wrong also does.** So `doctor` prints what each
// declared word matched, and that count is what tells the two apart.
//
// **The whole difficulty is the boundary.** A project that has just been wired has no run records,
// so zero matches there is correct rather than a defect; a project mid-build has documents full of
// lines nothing matched, and that is a config that has stopped working. So every entry carries what
// established which of the two it is, and says so in its own text - a reader is never left guessing
// whether the comparison ran.
import { compileLine } from './grammar.mjs';
import { proseLines, tableCells } from './prose.mjs';
import { runRows } from './evidence.mjs';

/**
 * The markup a declaration and a document line may differ by while saying the same words.
 *
 * <p>Stripping it from both sides is how the two conventions are told apart from a word that is
 * simply wrong: when the strict comparison finds nothing and the markup-blind one finds the line,
 * the words are in the document and the declaration's markup is not what the document writes.
 * **That is a finding with no false positive available to it** - the corpus is holding up the
 * matching line.
 */
const MARKUP = /[*_`~]/g;

/** One string with its markdown emphasis removed, for the markup-blind comparison. */
const bare = (text) => String(text).replace(MARKUP, '');

/** The two conventions a declaration follows, carried on each census entry it produces. */
const CONVENTIONS = {
  line: 'the line as written, markup and all - `**Deferred to {text}**…`, never `Deferred to `',
  word: 'the word alone, with no markup on it',
};

/** Every chapter file, by the chapter its name carries. */
const chapters = (ctx) => ctx.evidence.chapterFiles();

/** One chapter's run record, or null where the journeys have not been run. */
const recordText = (ctx, file) => {
  const dir = ctx.declared('evidenceDir');
  return dir === null ? null : ctx.read(`${dir}/${file}`);
};

/**
 * Every run record, as `{ rel, lines }` with the fenced blocks already gone.
 *
 * <p>A fenced block is where a record pastes a command and its output, and neither is prose a
 * declaration is meant to match - the same reason every other reader here starts from
 * `proseLines`.
 */
function records(ctx) {
  const out = [];
  const dir = ctx.declared('evidenceDir');
  for (const [, file] of [...chapters(ctx)].sort()) {
    const text = recordText(ctx, file);
    if (text === null) continue;
    out.push({ rel: `${dir}/${file}`, file, lines: proseLines(text).map((l) => l.line) });
  }
  return out;
}

/** How many lines a corpus holds - the comparisons a line-by-line reader actually made. */
const lineCount = (docs) => docs.reduce((n, doc) => n + doc.lines.length, 0);

/**
 * One declaration's census entry.
 *
 * <p>`expects` is the boundary and `because` is the sentence that established it. A `false` there
 * is not a gap in the gate - it is the gate saying there is nothing yet to match against, which is
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
 * The word the ledger writes for a closed chapter.
 *
 * <p>**Judged by the markup-blind reader alone, deliberately.** Nothing independent of this word
 * says a chapter has closed - a build with every chapter open is the normal state of a project
 * halfway through, and a run record sitting beside an open chapter is the normal state of one whose
 * journeys have just run and whose ledger row is written next. Any witness for it would be
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
    // The state's column is the project's - a name or what is left to do may sit between the
    // chapter and its state - so the row is read whole, exactly as `closedChapters` reads it. A
    // census taken on a fixed column reports a zero that belongs to this reader and prints it as
    // though it belonged to the ledger.
    const rest = cells.slice(1);
    compared += 1;
    if (rest.includes(word)) matched += 1;
    if (rest.some((cell) => bare(cell) === bare(word))) relaxed += 1;
  }
  return [entry(
    'closedStatus', word, CONVENTIONS.word, 'state ledger', 1, compared, matched, relaxed, false,
    'a chapter that has not closed is the normal state of a build in progress, so nothing but the markup-blind reader can speak here'
  )];
}

/**
 * The word a foundation chapter's run record writes in the persona column, for a verification row.
 *
 * <p><b>No witness, and the markup-blind reader is the whole of what can be said.</b> A project
 * whose chapters all place screens writes no verification row, which is a project with nothing
 * wrong - so a zero here says nothing until the relaxed comparison finds the word written another
 * way.
 */
function verdictRoleEntry(ctx) {
  const role = ctx.declared('verdictRole');
  if (role === null || ctx.declared('evidenceDir') === null) return [];
  let documents = 0;
  let compared = 0;
  let matched = 0;
  let relaxed = 0;
  for (const [, file] of [...chapters(ctx)].sort()) {
    const record = recordText(ctx, file);
    if (record === null) continue;
    documents += 1;
    for (const { persona } of runRows(record)) {
      compared += 1;
      if (persona === role) matched += 1;
      if (bare(persona) === bare(role)) relaxed += 1;
    }
  }
  return [entry(
    'verdictRole', role, CONVENTIONS.word, 'run records', documents, compared, matched, relaxed, false,
    'a project whose chapters all place screens writes no verification row, which is a project with nothing wrong'
  )];
}

/**
 * The line a run record carries for a check this installation could not decide.
 *
 * <p>**No witness, and there never can be one.** A project declares this because it expects to meet
 * the case, and a project that declares it and never meets it is a project with nothing wrong -
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
  const docs = records(ctx);
  return [entry(
    'deferredLine', phrase, CONVENTIONS.line, 'run records',
    docs.length, lineCount(docs), countLines(docs, lines.deferred), countBare(docs, loose), false,
    'a project that has never met the case writes no such line, which is a project with nothing wrong'
  )];
}

/**
 * The line a run record carries in place of a picture.
 *
 * <p>Same shape as the deferral above and the same absence of a witness: a project declares it
 * because it expects to meet unbuilt placeholders behind a tab strip, and one that declares it and
 * never meets them is a project with nothing wrong. The markup-blind count is the whole of what
 * can be said - a declaration written without the line's own markup matches nothing, and the
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
  const docs = records(ctx);
  return [entry(
    'placeholderLine', phrase, CONVENTIONS.line, 'run records',
    docs.length, lineCount(docs), countLines(docs, lines.placeholder), countBare(docs, loose), false,
    'a project whose panes are all built discharges nothing, which is a project with nothing wrong'
  )];
}

/**
 * The phrasings that hand a check to human eyes.
 *
 * <p>Only `assigns` is judged. `reader` and `moment` are consulted inside a block `assigns` has
 * already matched, so a hole in either fires `eyesRuleNamesItsReader` on every such block - loudly,
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
    ...closedStatusEntry(ctx),
    ...verdictRoleEntry(ctx),
    ...deferredLineEntry(ctx, lines),
    ...placeholderLineEntry(ctx, lines),
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


// No gate reads a declared vocabulary against the documents: the census `doctor` prints is the
// whole of it, and it reads every word these keys declare.
export const VOCABULARY_GATES = [];
