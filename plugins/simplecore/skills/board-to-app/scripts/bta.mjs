#!/usr/bin/env node
// The one command line a build has. Every generic check is a subcommand here, so a project
// adds a script of its own only for what is true of that project alone.
//
//   node bta.mjs check [--range <rev-range>]   every gate against this project
//   node bta.mjs gates                          every gate against the defect it exists to catch
//   node bta.mjs doctor                         what this project declares, and what it owes
//
// The config is found by walking up from the current directory for `.claude/board-to-app.json`,
// unless `--config <path>` names one. The directory two levels above the config is the project
// root, and every declared path is resolved from there.
//
// A project drawing two products declares both under `boards`, and every command is about ONE of
// them: `--board <name>`, or the board whose folder the command was run inside. Declaring several
// and naming none is refused rather than defaulted — a build that picks writes chapters, ledger
// rows and evidence into whichever board it guessed.
import { pathToFileURL } from 'node:url';
import { CORE_GATES, applies, gatesFor, gradeOf } from './core/gates.mjs';
import { HEADING_ROLES, SCHEMA, findConfig, loadProject } from './core/context.mjs';
import { makeBuilders, misdeclared, proveKeysAreDocumented, proveMisdeclaredNeeds, proveSeverity, proveShadowedIds, runCases, ungraded, unproven } from './core/harness.mjs';
import { cases as coreCases } from './core/cases.mjs';
import { censusLine, vocabularyCensus } from './core/vocabulary.mjs';

const argv = process.argv.slice(2);
const cmd = argv[0] ?? 'help';
/** Whether a bare switch was passed. */
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback = undefined) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};

const HELP = `board-to-app — the generic checks a build runs on
  check [--range <rev-range>] [--warnings]
                                every gate against this project (trailers: HEAD, or the range).
                                A warning prints as one finding and a count; --warnings prints all
  gates                         every gate against the defect it exists to catch
  doctor                        what this project declares, and what it owes
common: --config <path> (default: .claude/board-to-app.json, found by walking up)
        --board <name>  which board this is about, on a project that declares several`;

function context() {
  const declared = opt('config');
  const path = declared ?? findConfig();
  if (!path) {
    console.error(
      'no .claude/board-to-app.json in this directory or any above it — a build declares its paths there, and this skill never guesses one'
    );
    process.exit(2);
  }
  const ctx = loadProject(path, { range: opt('range'), board: opt('board') });
  // A refusal, not a default. Everything this command writes — a chapter, a ledger row, a result
  // document — lands under one board, and a guess puts all of it somewhere somebody has to find
  // again to undo.
  if (ctx.boardError) {
    console.error(ctx.boardError);
    process.exit(2);
  }
  return ctx;
}

/** `1 warning` / `2 warnings`, so a count and its noun never disagree. */
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

async function check() {
  const ctx = context();
  const { gates, disabled, projectModule } = await gatesFor(ctx);

  // A grade nobody reads is a finding of its own, and an error one: the gate that declares it is
  // running in a channel its author did not choose.
  let errors = 0;
  for (const { id, finding } of ungraded(gates)) {
    console.log(`\n✖ ${id} — the gate declares a grade nobody reads`);
    console.log(`   ${finding}`);
    errors += 1;
  }
  // A need that is not a key is refused by name: skipped by `applies` it would count as a project
  // choice, and a gate that can never run is not one.
  const misnamed = new Set();
  for (const { id, finding } of misdeclared(gates)) {
    console.log(`\n✖ ${id} — the gate names a need that is not a config key`);
    console.log(`   ${finding}`);
    errors += 1;
    misnamed.add(id);
  }

  let warnings = 0;
  let skipped = 0;
  for (const gate of gates) {
    if (misnamed.has(gate.id)) continue;
    if (!applies(gate, ctx)) {
      skipped += 1;
      continue;
    }
    const findings = gate.run(ctx);
    if (!findings.length) continue;
    // The marker carries the grade, so the two channels are told apart by eye and by anything
    // parsing this output — the write-time hook reads exactly this line.
    const advisory = gradeOf(gate) === 'warning';
    if (advisory) warnings += findings.length;
    else errors += findings.length;
    console.log(`\n${advisory ? '⚠' : '✖'} ${gate.id} — ${gate.title}`);
    // **An error is printed whole; a warning is printed as one and a count.**
    //
    // A warning is a prompt to re-read, so what it needs to convey is which gate fired and roughly
    // how much — the text of the eightieth one changes nothing about what the reader does next. On
    // a live repository this block ran to forty-three thousand characters against a run whose
    // verdict was 「no errors」, and every agent that ran the command paid for all of it, as did
    // every write that tripped the hook. `--warnings` prints them in full for the pass where
    // somebody is actually working through them.
    const shown = advisory && !flag('warnings') ? findings.slice(0, 1) : findings;
    for (const finding of shown) console.log(`   ${finding}`);
    if (shown.length < findings.length) {
      console.log(`   … 외 ${findings.length - shown.length}건 — 전문은 --warnings`);
    }
  }

  for (const [id, reason] of disabled) console.log(`⚠ ${id} is off — ${reason}`);
  if (projectModule) console.log(`ℹ project gates from ${ctx.rel(projectModule)}`);

  console.log('');
  if (warnings) {
    console.log(
      `⚠ ${plural(warnings, 'warning')} — a prompt to re-read what ${warnings === 1 ? 'it names' : 'they name'}, not a defect; the exit status ignores ${warnings === 1 ? 'it' : 'them'}`
    );
  }
  console.log(
    errors === 0
      ? `✔ ${gates.length - skipped} gates, ${warnings ? 'no errors' : 'nothing found'}${skipped ? ` (${skipped} skipped: the keys they read are not declared)` : ''}`
      : `✖ ${plural(errors, 'finding')}`
  );
  return errors === 0;
}

async function proveGates() {
  const builders = makeBuilders();
  const collected = [];
  const registrar = {
    project: builders.project,
    add: (gate, name, ctx, shouldFire) => collected.push({ gate, name, ctx, shouldFire }),
  };
  const modules = new Set();

  coreCases(registrar);

  // A project's own gates are proved by the project's own cases, in the same module.
  //
  // **Every board's module, not the one this run happened to resolve to.** A project that declares
  // several boards has a project gate module per board, and a load with no board named resolves to
  // none of them — so the command proved the core cases alone and reported 「both directions」, which
  // is a green run over rules nobody ran. That is the same silence this command exists to break.
  const declaredConfig = opt('config') ?? findConfig();
  let gates = CORE_GATES;
  if (declaredConfig) {
    const named = opt('board');
    const first = loadProject(declaredConfig, { board: named });
    const boards = named ? [named] : first.boards.length ? first.boards : [null];
    const seen = new Set();
    const project = [];
    for (const board of boards) {
      const ctx = board === null || board === named ? first : loadProject(declaredConfig, { board });
      const resolved = await gatesFor(ctx);
      for (const gate of resolved.gates) {
        if (CORE_GATES.includes(gate) || seen.has(gate.id)) continue;
        seen.add(gate.id);
        project.push(gate);
      }
      if (!resolved.projectModule || !ctx.exists(resolved.projectModule)) continue;
      const href = pathToFileURL(resolved.projectModule).href;
      // Two boards may name one module; its cases are registered once or every case runs twice.
      if (modules.has(href)) continue;
      modules.add(href);
      const mod = await import(href);
      if (typeof mod.cases === 'function') mod.cases(registrar);
    }
    gates = [...CORE_GATES, ...project];
  }

  const bad = runCases(collected, gates);
  const mistyped = [...ungraded(gates), ...misdeclared(gates)];
  const severity = [
    ...proveSeverity(builders.project), ...proveShadowedIds(builders.project), ...proveMisdeclaredNeeds(builders.project),
  ];
  builders.cleanup();

  const missing = unproven(collected, gates);
  if (missing.length) {
    console.log(`\n⚠ ${missing.length} gates are not fully proved — ${missing.join(', ')}`);
    console.log('   A gate lands with the case that fires and the case that stays quiet, in the same change.');
  }
  for (const { id, finding } of mistyped) {
    console.log(`\n✖ ${id} — the gate declares something the runner cannot read`);
    console.log(`   ${finding}`);
  }
  for (const line of severity) console.log(`\n✖ severity · ${line}`);
  if (!severity.length) {
    console.log('\n✔ severity: a fired warning leaves the exit status zero, a fired error fails the run');
    console.log('✔ ids: a project gate under a core gate\'s id is refused, unless the core one is turned off');
    console.log('✔ needs: a gate whose needs names a non-key is refused by name, not counted as skipped');
  }
  // A key nobody documented works perfectly and is met by nobody, which is a shape no gate over a
  // project can see — the subject is this skill's own two documents.
  const undocumented = proveKeysAreDocumented();
  for (const line of undocumented) console.log(`\n✖ keys · ${line}`);
  if (!undocumented.length) {
    console.log(`✔ keys: every key the schema reads has a row in the config table and a line in the template`);
  }
  console.log(bad ? `\n✖ ${bad} of ${collected.length} cases came out the wrong way` : `\n✔ ${collected.length} cases, both directions`);
  return bad === 0 && missing.length === 0 && mistyped.length === 0 && severity.length === 0 && undocumented.length === 0;
}

async function doctor() {
  const ctx = context();
  console.log(`config   ${ctx.configPath}`);
  console.log(`root     ${ctx.root}`);
  // Which board every line below is about. On a project with one board this says nothing and is
  // left out; on a project with two, a report that does not name its subject is a report about a
  // build somebody has to guess at.
  if (ctx.board) console.log(`board    ${ctx.board}   (of ${ctx.boards.join(', ')})`);
  console.log('');

  const deferrals = ctx.declared('deferredKeys');
  const owedBy = (key) => {
    if (!deferrals || typeof deferrals !== 'object' || Array.isArray(deferrals)) return null;
    const entry = deferrals[key];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    // A deferral missing either half is configGate's finding; here it is simply not a promise.
    return typeof entry.chapter === 'string' && typeof entry.whenExists === 'string' ? entry : null;
  };

  let closing = 0;
  for (const [key, spec] of Object.entries(SCHEMA)) {
    const value = ctx.declared(key);
    if (value === null) {
      const owed = owedBy(key);
      if (owed && !spec.required) {
        // An absence somebody promised reads differently from one nobody owes, and an absence
        // whose subject is already on disk is being paid for right now.
        const due = typeof owed.whenExists === 'string' && ctx.exists(ctx.inRoot(owed.whenExists));
        // A promise that has fallen due is the one absence being PAID for right now, so it is the
        // one that most needs the cost printed beside it. A promise not yet due costs nothing yet.
        console.log(
          due
            ? `● ${key.padEnd(18)} not declared — ${owed.whenExists} is already there, so ${owed.chapter} owes it now: ${spec.absent}`
            : `◐ ${key.padEnd(18)} not declared — ${owed.chapter} declares it when ${owed.whenExists} exists`
        );
        continue;
      }
      // Three kinds of blank, and only one of them is a choice. `required` stops everything;
      // `closing` lets everything run and lets nothing finish, which is the state a project sits in
      // while reading a page of green; the rest is a project saying it does not use that.
      //
      // **Every one of them says what the absence costs.** 「not declared」 on its own tells the
      // reader the one thing they already know, and the sentence that decides whether to go and
      // declare it — 「a chapter cannot be regenerated after a board fix」, 「nothing says where a
      // migration goes, so backend chapters run one at a time」 — sat in a table in `SKILL.md` that
      // nobody opens while reading a report. It is `SCHEMA[key].absent` now, and the config table
      // carries the same string under the same proof.
      if (spec.required) console.log(`✖ ${key.padEnd(18)} not declared — required: ${spec.absent}`);
      else if (spec.closing) {
        closing += 1;
        console.log(`◑ ${key.padEnd(18)} not declared — a chapter cannot close without it: ${spec.absent}`);
      } else console.log(`○ ${key.padEnd(18)} not declared — ${spec.absent}`);
      continue;
    }
    const full = typeof value === 'string' ? value : JSON.stringify(value);
    const shown = full.length > 72 ? `${full.slice(0, 69)}…` : full;
    console.log(`✔ ${key.padEnd(18)} ${shown}`);
  }

  if (closing) {
    console.log(
      `\n◑ ${closing} key(s) every chapter needs to CLOSE are not declared. Everything else can run `
      + 'and nothing can be finished; declare them, or name the chapter that will in `deferredKeys`'
    );
  }

  const headings = ctx.declared('chapterHeadings');
  const missingRoles = headings ? HEADING_ROLES.filter((r) => !headings[r]) : HEADING_ROLES;
  if (missingRoles.length) {
    console.log(`\nsections named by role only: ${missingRoles.join(', ')} — an agent that cannot find one stops and reports`);
  }

  // **What each declared word actually matched, whether or not anything is wrong with it.**
  //
  // A path is declared right or wrong and `configGate` says which; a WORD is declared right or
  // wrong and nothing says which, because a word that matches nothing produces the same silence as
  // a repository with nothing wrong. `declaredWordsMatchTheDocuments` speaks where it can prove the
  // declaration is broken, and that is less than half of what a person wiring a project needs —
  // the rest is the count. 「0 findings」 and 「1675 lines matched across 35 chapter files」 are one
  // line to an exit status and two different sentences to a reader.
  const census = vocabularyCensus(ctx);
  if (census.length) {
    console.log('\nvocabulary — what each declared word matched in the documents it governs');
    for (const item of census) console.log(censusLine(item));
    console.log(
      '   ✔ matched · ✖ matched nothing and something says it should — a finding · '
      + '⚠ matched nothing and nothing independent says it should, which is what a project that has '
      + 'not met the case looks like · ○ nothing to match against yet'
    );
  }

  const { gates, disabled } = await gatesFor(ctx);
  const inactive = gates.filter((g) => !applies(g, ctx)).map((g) => g.id);
  console.log(`\ngates    ${gates.length} resolved, ${gates.length - inactive.length} of them able to run here`);
  if (inactive.length) console.log(`skipped  ${inactive.join(', ')} — the keys they read are not declared`);
  for (const [id, reason] of disabled) console.log(`off      ${id} — ${reason}`);
  return true;
}

const RUN = { check, gates: proveGates, doctor };

if (cmd === 'help' || argv.includes('--help')) {
  console.log(HELP);
  process.exit(0);
}
if (!RUN[cmd]) {
  console.error(`unknown command: ${cmd}\n\n${HELP}`);
  process.exit(2);
}
// A refusal is a sentence somebody has to act on — which gate, which file, what to do instead. A
// stack trace buries it under twenty lines of node internals and reads as the tool being broken
// rather than as the tool having something to say.
try {
  process.exit((await RUN[cmd]()) ? 0 : 1);
} catch (err) {
  console.error(`\n✖ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
}
