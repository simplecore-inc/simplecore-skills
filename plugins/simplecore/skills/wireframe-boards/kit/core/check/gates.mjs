// Feed each gate the defect it exists to catch, then feed it a clean board. A gate that stays
// quiet on the first, or fires on the second, is a gate that no longer works - and a build whose
// gates have gone quiet looks exactly like a board with nothing wrong with it.
//
//   node wf.mjs gates
//
// The cases come from the same three places the gates do, so a pattern's gates are tested by the
// pattern's cases and a board's by its own. A gate with no case at all is named at the end: that
// is the state every gate decays into, and it is invisible from the build.
import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadBoard } from '../context.mjs';
import { gatesFor } from '../gates/index.mjs';
import { BOARD_CONTRACT } from '../partials.mjs';
import { LATEST } from '../migrations.mjs';
import { makeBuilders, runCases, untested } from './harness.mjs';
import { trackDocuments, unreadDocumentNotices } from '../document-reads.mjs';
import { cases as coreCases } from './cases.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/** The skill's single-file starting point, which stamps the contract it was written against. */
const TEMPLATE = join(HERE, '../../../assets/board-template.html');

/**
 * Every copy of the contract number agrees with `BOARD_CONTRACT`.
 *
 * <p>The number has one owner, `core/partials.mjs`, and two copies written by hand: the newest
 * entry of `core/migrations.mjs`, and the stamp in `assets/board-template.html`. A copy left behind
 * fails nothing on its own - it tells every board copied from the template that it needs migrating,
 * or leaves `doctor` reporting a record that stops short of the kit - so it is asked here, with the
 * other questions about the kit itself.
 *
 * @returns `{ bad, unread }` - one line per copy that disagrees, and the copies that could not be
 *   read on this install (a kit copied into a board carries no `assets/`)
 */
function contractCopies() {
  const bad = [];
  const unread = [];
  if (LATEST !== BOARD_CONTRACT) {
    bad.push(`the last contract in core/migrations.mjs is ${LATEST} and BOARD_CONTRACT is ${BOARD_CONTRACT}`);
  }
  if (existsSync(TEMPLATE)) {
    const stamp = /<meta\s+name="wireframe-board-contract"\s+content="(\d+)"/.exec(readFileSync(TEMPLATE, 'utf8'));
    if (!stamp) bad.push('assets/board-template.html carries no wireframe-board-contract stamp');
    else if (Number(stamp[1]) !== BOARD_CONTRACT) {
      bad.push(`assets/board-template.html stamps contract ${stamp[1]} and BOARD_CONTRACT is ${BOARD_CONTRACT}`);
    }
  } else {
    unread.push('assets/board-template.html');
  }
  return { bad, unread };
}

/**
 * The unread-document notice, fed the form it exists to catch and the form it must leave alone.
 *
 * <p>Not a gate: a declared document nothing reads refuses nothing, because the board drew what it
 * drew. It is asked here because the notice going quiet looks exactly like every declared
 * document being read, which is the same decay a gate's two cases guard against.
 *
 * @returns `{ lines, bad }` - one line per check in the cases' own format, and the failures
 */
function documentReadChecks() {
  const lines = [];
  let bad = 0;
  const judge = (name, documents, read, shouldReport, expectText) => {
    const config = { documents: { ...documents } };
    const reads = trackDocuments(config);
    for (const key of read) void config.documents?.[key];
    const notices = unreadDocumentNotices(reads);
    const reported = notices.length > 0 && (!expectText || notices.some((l) => l.includes(expectText)));
    if (reported === shouldReport) lines.push(`✔ unread documents / ${name}${notices.length ? ` → ${notices[0].slice(0, 60)}` : ''}`);
    else {
      lines.push(`✖ unread documents / ${name} - ${shouldReport ? 'should report and stayed quiet' : `reported what was read: ${notices[0]}`}`);
      bad += 1;
    }
  };
  judge('a declared document no gate read', { a: 'a.md', b: 'b.md' }, ['a'], true, 'documents.b');
  judge('every declared document was read', { a: 'a.md', b: 'b.md' }, ['a', 'b'], false);
  judge('a key whose gate left the kit names the step', { frameManifest: 'fm.md' }, [], true, 'board.gates.mjs');
  judge('a board that declares no documents', {}, [], false);
  return { lines, bad };
}

/** Whatever a module exports that IS a gate rather than a helper. */
const gateShaped = (module) => Object.values(module)
  .filter((v) => v && typeof v === 'object' && typeof v.run === 'function' && typeof v.id === 'string');

/**
 * A gate written and never registered, so nothing ever runs it.
 *
 * <p><b>The order of `CORE_GATES` is load-bearing, so that list stays hand-written</b> - cheapest
 * refusals first, and the three that read the rendered HTML last. The cost of writing it by hand
 * is exactly this defect: a gate added to `markup.mjs` and not added to the array is in the
 * repository, greppable, and reached by nothing. Somebody finds it, reads the rule as held, and
 * has no reason to look further.
 *
 * <p><b>It is asked here rather than as a gate of its own</b>, beside 「a gate with no case」 -
 * the same question from the other side, about the same set, answered in the one command anybody
 * runs after writing a gate. The pattern's own list is derived from its module rather than
 * written out, so nothing there can fall off; this scan covers it anyway, because the next
 * pattern may not be.
 *
 * @param registered the gates this run will execute
 * @param patternDir the pattern's directory
 * @returns the ids of gates nothing reaches, each with the file that declares it
 */
async function unreached(registered, patternDir) {
  const held = new Set(registered.map((g) => g.id));
  const folders = [join(HERE, '../gates'), join(patternDir, 'gates')];
  const found = [];
  for (const folder of folders) {
    if (!existsSync(folder)) continue;
    for (const file of readdirSync(folder)) {
      if (!file.endsWith('.mjs') || file === 'index.mjs' || file === 'cases.mjs' || file === 'util.mjs') continue;
      const module = await import(pathToFileURL(join(folder, file)).href);
      for (const gate of gateShaped(module)) {
        if (!held.has(gate.id)) found.push(`${gate.id} (${file})`);
      }
    }
  }
  return found;
}

export async function runGateTests(boardDir) {
  const ctx = await loadBoard(boardDir, { screens: false });
  const gates = gatesFor(ctx);

  const collected = [];
  const made = [];
  // Each case file gets builders of its own, so the settings one file's cases are judged against
  // (its exported `fixture`) never leak into another's.
  const run = (cases, fixture) => {
    const builders = makeBuilders(ctx.config, fixture);
    made.push(builders);
    cases({ ...builders, add: (gate, name, c, shouldFire) => collected.push({ gate, name, ctx: c, shouldFire }) });
  };

  run(coreCases);
  const patternCases = join(ctx.patternDir, 'gates/cases.mjs');
  if (existsSync(patternCases)) {
    const mod = await import(pathToFileURL(patternCases).href);
    run(mod.cases, mod.fixture);
  }
  if (ctx.projectGates?.cases) run(ctx.projectGates.cases, ctx.projectGates.fixture);

  const bad = await runCases(collected, gates);
  for (const builders of made) builders.cleanup();

  const missing = untested(collected, gates);
  if (missing.length) {
    console.log(`\ngates with no case: ${missing.join(', ')}`);
    console.log('A gate gets the case that must trip it and the case that must not in the same change.');
  }
  const orphans = await unreached(gates, ctx.patternDir);
  if (orphans.length) {
    console.log(`\ngates no list reaches: ${orphans.join(', ')}`);
    console.log('They are in the repository and nothing runs them - whoever finds one reads the rule as held.');
    console.log('Add each to CORE_GATES (kit/core/gates/index.mjs) or to the pattern\'s gates.');
  }
  const copies = contractCopies();
  if (copies.bad.length) {
    console.log(`\ncopies of the contract number disagree with BOARD_CONTRACT: ${copies.bad.join(' · ')}`);
    console.log('The change that raises BOARD_CONTRACT updates the migration entry and the template stamp with it.');
  }
  if (copies.unread.length) console.log(`\ncontract stamps not compared on this install: ${copies.unread.join(', ')}`);
  const reads = documentReadChecks();
  console.log(`\n${reads.lines.join('\n')}`);
  const total = collected.length + reads.lines.length;
  const failed = bad + reads.bad;
  console.log(failed ? `\n${failed} of ${total} failed` : `\nall ${total} cases passed`);
  return failed === 0 && missing.length === 0 && orphans.length === 0 && copies.bad.length === 0;
}
