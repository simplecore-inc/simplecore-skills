// Building a project for a gate to be proved against, and the runner that judges the result.
//
// A case is `{ gate, name, ctx, shouldFire }`. The fixture is a real directory with a real
// config in it - never a hand-made context object - so a gate is proved against the same
// reader it uses in a repository, and a gate that quietly stopped resolving paths cannot pass.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG_NAME, SCHEMA, loadProject } from './context.mjs';
import { GRADES } from './gates.mjs';
import { vocabularyCensus } from './vocabulary.mjs';

/** The command line whose exit status the severity proof reads. */
const BTA = fileURLToPath(new URL('../bta.mjs', import.meta.url));

/**
 * A project that satisfies every core gate, which a case then breaks in exactly one way.
 *
 * <p>It lives beside the builder rather than beside the cases because the runner needs the same
 * baseline: an exit status means something only when the fixture is clean apart from the one
 * thing under test.
 */
export function cleanProject() {
  return {
    config: {
      boardRoot: 'board',
      boardManifest: 'board/manifest.mjs',
      chapterDir: 'chapters',
      chapterOverview: 'chapters/00-overview.md',
      stateLedger: 'chapters/STATE.md',
      handoverFile: 'notes/HANDOVER.md',
    },
    files: {
      'board/manifest.mjs': 'export const frames = [];\n',
      'chapters/00-overview.md': '# Chapters\n',
      'chapters/w01-foundation.md': '# W01\n',
      'chapters/STATE.md': '# State\n\n| chapter | state |\n| --- | --- |\n| w01 | closed |\n',
      'notes/HANDOVER.md': '# Handover\n\nThe server starts with `npm run dev` on port 3000.\n',
    },
  };
}

/**
 * A fixture factory and the cleanup that removes every directory it made.
 *
 * <p>`files` maps a repository-relative path to its contents; a key ending in `/` makes an
 * empty directory, `''` makes an empty file, and **`null` means the file is not there** - the
 * case for a document that was never written. `undefined` is refused: it is what a renamed
 * constant leaves behind, and reading it as absence would drop a file nobody meant to drop. `commits` is a list of commits, which turns the fixture into a git repository:
 * a plain string is a message and makes an empty commit, and `{ message, files }` writes those
 * files and commits exactly them. The second form is what a gate reading a commit's CONTENT needs
 * - a fixture whose history is all empty commits can prove a rule about messages and nothing about
 * what a commit carried.
 *
 * <p>`dirty` is written AFTER the commits and committed by nothing, which is the one state `files`
 * cannot produce: `files` is written first and any commit naming the same path overwrites it, so a
 * fixture built from those two alone always ends with a tree matching HEAD. A gate comparing the
 * working tree against the commit has nothing to see there - it would pass its 「fires」 case for
 * the wrong reason or not at all - so the difference between the two is spelled rather than
 * arranged.
 */
export function makeBuilders() {
  const roots = [];

  const project = ({ config = {}, files = {}, commits = null, dirty = null, options = {} } = {}) => {
    const root = mkdtempSync(join(tmpdir(), 'board-to-app-case-'));
    roots.push(root);

    for (const [rel, body] of Object.entries(files)) {
      // `null` is the case saying THIS FILE IS NOT THERE, which half the gates here exist to
      // find - an absent result document, a capture that was cited and never written. Writing it
      // as an empty file instead proves a different defect and passes for the wrong reason, so
      // the natural notation has to mean absence.
      if (body === null) continue;
      // `undefined` is a name that did not resolve - a constant renamed, a typo in the key. It
      // reads as `null` and would silently drop the file, so it stops the run instead.
      if (body === undefined) {
        throw new Error(
          `case fixture ${rel}: the value is undefined, which is a name that resolves to nothing `
          + 'rather than a decision. Write `null` to say the file is absent, or `\'\'` for an empty file.'
        );
      }
      const target = join(root, rel);
      if (rel.endsWith('/')) {
        mkdirSync(target, { recursive: true });
        continue;
      }
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, body);
    }

    const configPath = join(root, CONFIG_NAME);
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    if (commits) {
      const git = (args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
      git(['-c', 'init.defaultBranch=main', 'init', '-q']);
      for (const commit of commits) {
        const { message, files: carried } = typeof commit === 'string' ? { message: commit } : commit;
        const paths = [];
        for (const [rel, body] of Object.entries(carried ?? {})) {
          const target = join(root, rel);
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, body ?? '');
          paths.push(rel);
        }
        // Staged by explicit path, so a commit carries what the case said it carries and nothing
        // the fixture happens to have lying beside it - which is the very distinction under test.
        if (paths.length) git(['add', '--', ...paths]);
        git([
          '-c', 'user.name=case',
          '-c', 'user.email=case@example.invalid',
          'commit', ...(paths.length ? [] : ['--allow-empty']), '-q', '-m', message,
        ]);
      }
    }

    // After the commits, so the tree and HEAD genuinely disagree. `null` deletes the path instead,
    // which is the other half of that disagreement - a committed artefact the tree no longer has.
    for (const [rel, body] of Object.entries(dirty ?? {})) {
      const target = join(root, rel);
      if (body === null) {
        rmSync(target, { force: true });
        continue;
      }
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, body);
    }

    return loadProject(configPath, options);
  };

  const cleanup = () => {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
    roots.length = 0;
  };

  return { project, cleanup };
}

/**
 * Feed every gate the defect it exists to catch, then feed it a clean project.
 *
 * @returns the number of cases that came out the wrong way
 */
export function runCases(cases, gates) {
  const byId = new Map(gates.map((g) => [g.id, g]));
  let bad = 0;
  for (const testCase of cases) {
    const gate = byId.get(testCase.gate);
    if (!gate) {
      console.log(`✖ ${testCase.gate} — no such gate, so its case proves nothing`);
      bad += 1;
      continue;
    }
    let findings;
    try {
      findings = gate.run(testCase.ctx);
    } catch (err) {
      console.log(`✖ ${gate.id} · ${testCase.name} — threw: ${err instanceof Error ? err.message : String(err)}`);
      bad += 1;
      continue;
    }
    const fired = findings.length > 0;
    if (fired !== testCase.shouldFire) {
      bad += 1;
      console.log(
        testCase.shouldFire
          ? `✖ ${gate.id} · ${testCase.name} — stayed quiet on the defect it exists to catch`
          : `✖ ${gate.id} · ${testCase.name} — fired on a project with nothing wrong with it:\n    ${findings.join('\n    ')}`
      );
    }
  }
  return bad;
}

/**
 * The gates whose proof is missing a half.
 *
 * <p>A gate with no case at all is the state every gate decays into, and it is invisible from
 * a green run. A gate proved in one direction only is the same failure wearing half a coat:
 * one that fires on everything and one that fires on nothing both pass a single case.
 */
export function unproven(cases, gates) {
  const out = [];
  for (const gate of gates) {
    const mine = cases.filter((c) => c.gate === gate.id);
    const fires = mine.some((c) => c.shouldFire);
    const quiet = mine.some((c) => !c.shouldFire);
    if (!fires && !quiet) out.push(`${gate.id} (no case)`);
    else if (!fires) out.push(`${gate.id} (never proved to fire)`);
    else if (!quiet) out.push(`${gate.id} (never proved to stay quiet)`);
  }
  return out;
}

/**
 * The gates whose declared grade is not one the runner reads.
 *
 * <p>A mistyped grade is the quietest failure this channel has. The gate keeps working, its cases
 * keep passing, and it is counted in the channel nobody chose - so a rule written to prompt a
 * re-read reddens the tree while the word in its source says otherwise. It is reported rather
 * than defaulted for the same reason a missing case is: silence and correctness look identical.
 *
 * @returns one `{ id, finding }` per gate that declares a grade nobody reads
 */
export function ungraded(gates) {
  const out = [];
  for (const gate of gates) {
    if (gate?.grade === undefined || GRADES.includes(gate.grade)) continue;
    out.push({
      id: typeof gate?.id === 'string' && gate.id ? gate.id : '(a gate with no id)',
      finding:
        `grade ${JSON.stringify(gate.grade)} is not one of ${GRADES.join(', ')} — a grade nobody `
        + 'reads is counted in whichever channel the reader assumed, so it is refused rather than defaulted',
    });
  }
  return out;
}

/**
 * The gates whose `needs` name something that is not a config key.
 *
 * <p>`applies` skips a gate when a key it needs is not declared, which is right for a key the
 * project chose not to declare. A gate that lists a file path or an invented name there is
 * skipped by the same test and never runs at all - and the summary counts it among 「the keys they
 * read are not declared」, where it reads as a project choice rather than a gate that can never
 * fire. Six project gates sat that way for a build, each proving nothing. So a need that is not a
 * key of the schema is refused by name, not folded into the skipped count.
 *
 * @returns one `{ id, finding }` per gate whose `needs` holds a non-key
 */
export function misdeclared(gates) {
  const out = [];
  for (const gate of gates) {
    const needs = Array.isArray(gate?.needs) ? gate.needs : [];
    const bogus = needs.filter((key) => typeof key !== 'string' || !(key in SCHEMA));
    if (!bogus.length) continue;
    out.push({
      id: typeof gate?.id === 'string' && gate.id ? gate.id : '(a gate with no id)',
      finding:
        `needs ${bogus.map((k) => JSON.stringify(k)).join(', ')} — not a config key, so the gate is skipped on `
        + 'every project and never runs; name the key it reads, or `[]` when it reads fixed files and answers for their absence itself',
    });
  }
  return out;
}

/**
 * That a gate naming a non-key in `needs` is refused by name rather than counted as skipped.
 *
 * <p>Asserted on the refusal's own words, and also on their absence from a clean run, so a rule
 * switched off shows here rather than passing by accident.
 */
export function proveMisdeclaredNeeds(project) {
  const base = cleanProject();
  const REFUSAL = 'not a config key';
  const run = (entries) => {
    const ctx = project({
      config: { ...base.config, projectGates: 'gates/project-gates.mjs' },
      files: { ...base.files, 'gates/project-gates.mjs': gatesModule(entries) },
      commits: ['chore(fixture): a project with nothing wrong with it\n\nChapter: none'],
    });
    const r = spawnSync(process.execPath, [BTA, 'check', '--config', ctx.configPath], {
      cwd: ctx.root, encoding: 'utf8',
    });
    return { status: r.status, said: `${r.stdout ?? ''}${r.stderr ?? ''}` };
  };
  const out = [];
  const bad = run([{ id: 'fixtureNeedsAPath', finding: 'never runs', needs: ['SAMPLE_FLEET'] }]);
  if (!bad.said.includes(REFUSAL) || !bad.said.includes('fixtureNeedsAPath')) {
    out.push('a gate whose needs names a non-key was not refused by name');
  }
  if (bad.status === 0) out.push('a misdeclared gate left the exit status zero');
  const good = run([{ id: 'fixtureNeedsNothing', finding: 'notes/OPEN.md:1: the copy', needs: [] }]);
  if (good.said.includes(REFUSAL)) out.push('a gate with needs: [] was refused as misdeclared');
  return out;
}

/**
 * The header row that opens the config table in `references/config.md`, and the anchor the
 * reverse read uses.
 */
const CONFIG_TABLE_HEADER = '| Key | What the project names with it | Required | Absent means |';

/** A key's own row in a `| \`key\` | … |` table. */
const TABLE_KEY = /^\|\s*`([A-Za-z][A-Za-z0-9]*)`\s*\|/;

/**
 * Where a key is documented and where it is not - the comparison alone, so it can be run against
 * the real files and against doctored ones.
 *
 * <p>`costs` maps a key to the sentence the config table's last column gives it, and it is held
 * against `SCHEMA[key].absent` character for character. **The two are one sentence in two files,
 * which is a shape that only ever drifts one way**: the table is what a person edits and
 * `doctor` prints the schema, so a cost corrected in the table reaches nobody and the report goes
 * on saying the old thing. Neither file can read the other, so the equality is what holds them -
 * and a key whose schema entry carries no cost at all is the same failure arriving earlier,
 * because `doctor` would print `undefined` beside it.
 *
 * @param keys every key the schema reads
 * @param inTable the keys the config table gives a row to
 * @param inTemplate the keys the copyable template declares
 * @param costs key → the config table's 「Absent means」 cell, or an empty map to skip that half
 * @returns one string per key that is missing from one side or named on a side that does not read it
 */
export function undocumentedKeys(keys, inTable, inTemplate, costs = null) {
  const out = [];
  for (const key of keys) {
    if (!inTable.has(key)) {
      out.push(`${key} is read by the schema and has no row in the config table — a key with no row is one nobody can decide about`);
    }
    if (!inTemplate.has(key)) {
      out.push(`${key} is read by the schema and is not in assets/board-to-app.json — a project copying the template never meets it`);
    }
    if (!costs) continue;
    const declared = SCHEMA[key]?.absent;
    if (typeof declared !== 'string' || !declared.trim()) {
      out.push(`${key} has no \`absent\` in the schema — \`doctor\` prints that string beside the key, so a reader is told a key is missing and never what it costs`);
      continue;
    }
    const written = costs.get(key);
    if (written === undefined) continue;
    if (written !== declared) {
      out.push(
        `${key}: the config table's 「Absent means」 cell and the schema's \`absent\` are not the same sentence — `
        + `the table says 「${written}」 and \`doctor\` prints 「${declared}」. One of them is the correction nobody received`
      );
    }
  }
  for (const key of inTable) {
    if (!(key in SCHEMA)) out.push(`the config table has a row for ${key}, which the schema does not read — a renamed key leaves its old row behind, and the row is what everybody reads`);
  }
  return out;
}

/**
 * Every key the skill reads is documented where a project would look for it.
 *
 * <p>This is the shape the two tables cannot hold: a key added to `SCHEMA` works immediately,
 * `configGate` validates it, `doctor` prints it - and nothing anywhere says it exists, so the only
 * readers who ever meet it are the ones who go through the source.
 *
 * <p><b>Both directions are proved here rather than in a case</b>, because the subject is this
 * skill's own files rather than a project: the comparison is run once against them and twice
 * against a doctored copy, and a comparison that stays quiet on a key nobody documented is a
 * comparison that would stay quiet on all of them.
 *
 * @returns one string per expectation that came out the wrong way
 */
export function proveKeysAreDocumented() {
  const skill = readFileSync(new URL('../../references/config.md', import.meta.url), 'utf8');
  const lines = skill.split('\n');
  const opens = lines.indexOf(CONFIG_TABLE_HEADER);
  // A header that moved is itself the finding: the reverse read has nothing to anchor on, and
  // silently reading every table in the file would report the heading-role rows as stale keys.
  if (opens < 0) {
    return [`references/config.md no longer carries the config table's header row — the reverse read anchors on it, and without it a stale row is invisible`];
  }
  const inTable = new Set();
  const costs = new Map();
  for (const line of lines.slice(opens + 1)) {
    if (!line.startsWith('|')) break;
    const found = TABLE_KEY.exec(line);
    if (!found) continue;
    inTable.add(found[1]);
    // `| key | what it names | required | absent means |` splits into six, the empty ends
    // included. A row that splits into anything else has a cell carrying a pipe of its own, and
    // reading the fourth field of that row would compare half a sentence - so it is left out of
    // the cost comparison and reported by the row below instead.
    const cells = line.split('|');
    if (cells.length === 6) costs.set(found[1], cells[4].trim());
  }
  for (const key of inTable) {
    if (!costs.has(key)) {
      return [`references/config.md: the config table's row for \`${key}\` does not split into four cells — a cell carrying a pipe of its own makes the 「Absent means」 column unreadable, and the sentence \`doctor\` prints could not be held against it`];
    }
  }

  const template = JSON.parse(readFileSync(new URL('../../assets/board-to-app.json', import.meta.url), 'utf8'));
  const inTemplate = new Set(Object.keys(template).filter((k) => !k.startsWith('//')));

  const out = undocumentedKeys(Object.keys(SCHEMA), inTable, inTemplate, costs);
  // Two baselines rather than one. The presence probes are measured without the cost comparison,
  // so a sentence that has drifted in the table cannot move the yardstick a probe about a missing
  // row is read against - one real defect would otherwise report as three.
  const found = undocumentedKeys(Object.keys(SCHEMA), inTable, inTemplate).length;
  const costBaseline = out.length;

  // The comparison proved against the defect it exists to catch: a key the schema reads that
  // neither document names, and a row left behind by a rename.
  const missed = undocumentedKeys([...Object.keys(SCHEMA), 'keyNobodyDocumented'], inTable, inTemplate);
  if (missed.length !== found + 2) {
    out.push('the documentation comparison did not report an undocumented key — it would stay quiet on every key');
  }
  const stale = undocumentedKeys(Object.keys(SCHEMA), new Set([...inTable, 'keyThatWasRenamedAway']), inTemplate);
  if (stale.length !== found + 1) {
    out.push('the documentation comparison did not report a table row the schema no longer reads');
  }

  // The cost half, proved the same way. A sentence edited in the table and not in the schema is
  // the whole failure mode - the table is what a person corrects and `doctor` prints the schema -
  // and a key whose schema entry carries no cost at all is that failure arriving one step earlier.
  const keys = Object.keys(SCHEMA);
  const drifted = new Map(costs);
  drifted.set(keys[0], `${costs.get(keys[0])}, edited in the table and nowhere else`);
  if (undocumentedKeys(keys, inTable, inTemplate, drifted).length !== costBaseline + 1) {
    out.push('the documentation comparison did not report a cost sentence that says one thing in the table and another in the schema');
  }
  const kept = SCHEMA[keys[0]].absent;
  delete SCHEMA[keys[0]].absent;
  const stripped = undocumentedKeys(keys, inTable, inTemplate, costs).length;
  SCHEMA[keys[0]].absent = kept;
  if (stripped !== costBaseline + 1) {
    out.push('the documentation comparison did not report a key whose schema entry carries no cost — `doctor` would print `undefined` beside it');
  }

  // …and against the fixed form, on its own sets rather than on the real ones: a probe that
  // borrows the live table inherits whatever is already wrong with it, and then reports the
  // repository's state as a failure of the comparison.
  const agreeing = new Map(keys.map((key) => [key, SCHEMA[key].absent]));
  const clean = undocumentedKeys(keys, new Set(keys), new Set(keys), agreeing);
  if (clean.length) {
    out.push(`the documentation comparison found ${clean.length} things wrong with a set where every key is documented — it fires on everything`);
  }
  return out;
}

/** The bold lead that opens the register of what a gate holds, in `references/checks-and-eyes.md`. */
const GATE_REGISTER_LEAD = '**Held by a gate**';

/** A backticked camelCase identifier - the shape of a gate id, and of a config key. */
const CAMEL_IDENTIFIER = /`([a-z][a-z0-9]*[A-Z][A-Za-z0-9]*)`/g;

/**
 * Which core gates the register leaves out, and which identifiers it names that no gate and no
 * key answers to - the comparison alone, so it can be run against the real table and doctored ones.
 *
 * @param ids every core gate id
 * @param named the backticked camelCase identifiers in the register's gate column
 * @param keys the schema's keys, which that column also names and which are not stale gate names
 * @returns one string per gate missing from the register or name the register carries for nothing
 */
export function unregisteredGates(ids, named, keys) {
  const out = [];
  for (const id of ids) {
    if (!named.has(id)) {
      out.push(`${id} is a core gate with no row in the 「Held by a gate」 table of references/checks-and-eyes.md - a rule nobody can find is a rule nobody knows is held`);
    }
  }
  for (const name of named) {
    if (!ids.includes(name) && !keys.includes(name)) {
      out.push(`the 「Held by a gate」 table names \`${name}\`, which is no core gate and no config key - a gate renamed or retired leaves its row behind, and the row is what everybody reads`);
    }
  }
  return out;
}

/**
 * Every core gate has a row in the register of what a gate holds, and every row names a live one.
 *
 * <p><b>A gate that is not listed works perfectly and is met by nobody</b>: it fires, its cases
 * pass, and a reader asking which rules are held reads a table that leaves it out. The comparison is
 * proved the way `proveKeysAreDocumented` proves its own - against a doctored copy in each
 * direction, then against a set where everything is listed.
 *
 * @param ids every core gate id
 * @returns one string per expectation that came out the wrong way
 */
export function proveGatesAreRegistered(ids) {
  const text = readFileSync(new URL('../../references/checks-and-eyes.md', import.meta.url), 'utf8');
  const lines = text.split('\n');
  const lead = lines.findIndex((line) => line.startsWith(GATE_REGISTER_LEAD));
  if (lead < 0) {
    return ['references/checks-and-eyes.md no longer opens a table with 「Held by a gate」 - the register is read from it, and without it a gate left out is invisible'];
  }
  const named = new Set();
  let inTable = false;
  for (const line of lines.slice(lead + 1)) {
    if (!line.startsWith('|')) {
      if (inTable) break;
      continue;
    }
    inTable = true;
    const cells = line.split('|');
    if (cells.length < 4 || /^\s*-+\s*$/.test(cells[2]) || cells[1].trim() === 'Rule') continue;
    for (const [, name] of cells[2].matchAll(CAMEL_IDENTIFIER)) named.add(name);
  }
  const keys = Object.keys(SCHEMA);
  const out = unregisteredGates(ids, named, keys);
  const found = out.length;
  if (unregisteredGates(ids, new Set([...named].filter((name) => name !== ids[0])), keys).length !== found + (named.has(ids[0]) ? 1 : 0)) {
    out.push('the register comparison did not report a core gate the table leaves out - it would stay quiet on every gate');
  }
  if (unregisteredGates(ids, new Set([...named, 'gateThatWasRenamedAway']), keys).length !== found + 1) {
    out.push('the register comparison did not report a row naming a gate that no longer exists');
  }
  const clean = unregisteredGates(ids, new Set(ids), keys);
  if (clean.length) {
    out.push(`the register comparison found ${clean.length} things wrong with a table naming every gate - it fires on everything`);
  }
  return out;
}

/** A project declaring every word the census reads, with a document that writes each one. */
function censusProject(words) {
  return {
    config: {
      chapterDir: 'chapters',
      evidenceDir: 'docs/evidence',
      stateLedger: 'tracking/STATE.md',
      eyesDocuments: ['docs/eyes.md'],
      ...words,
    },
    files: {
      'chapters/w01-base.md': '# W01\n',
      'chapters/w02-screens.md': '# W02\n',
      'tracking/STATE.md': '| chapter | state |\n| --- | --- |\n| w01 | closed |\n| w02 | open |\n',
      'docs/evidence/w01-base.md':
        '# W01 - run\n\n| journey | persona | test | result |\n| --- | --- | --- | --- |\n'
        + '| 1 | verdict | tests/w01.spec.ts › schema | pass |\n\n**Deferred to W02** - the role is installed there\n',
      'docs/evidence/w02-screens.md':
        '# W02 - run\n\n| journey | persona | test | result |\n| --- | --- | --- | --- |\n'
        + '| 1 | operator | tests/w02.spec.ts › list | pass |\n\n**Same component as w02-screens/a-01.webp** - the second pane\n',
      'docs/eyes.md': 'Whether the picture is the frame stays with eyes: the coordinator reads it before the ledger row is written.\n',
    },
  };
}

/**
 * The census `doctor` prints counts every declared word where it is written, and a word declared
 * wrongly counts nothing.
 *
 * <p><b>No gate reads the census, so no case reaches it</b> - which is the shape in which it can stop
 * working and leave every case green. So it is proved here, on one fixture declaring every word the
 * census reads, both ways: the right words each match, and the same documents under wrong words
 * match none.
 *
 * @param project the fixture builder
 * @returns one string per expectation that came out the wrong way
 */
export function proveCensusReads(project) {
  const right = {
    closedStatus: 'closed',
    verdictRole: 'verdict',
    deferredLine: '**Deferred to {text}**…',
    placeholderLine: '**Same component as {text}**…',
    eyesPhrases: { assigns: ['stays with eyes'], reader: ['the coordinator'], moment: ['before '] },
  };
  const wrong = {
    closedStatus: 'shut',
    verdictRole: 'judge',
    deferredLine: '**Postponed to {text}**…',
    placeholderLine: '**Like {text}**…',
    eyesPhrases: { assigns: ['a person decides'], reader: ['the reviewer'], moment: ['after the close'] },
  };
  const out = [];
  let census;
  try {
    const spec = censusProject(right);
    census = vocabularyCensus(project(spec));
  } catch (err) {
    return [`the census threw on a project declaring every word it reads: ${err instanceof Error ? err.message : String(err)}`];
  }
  const labels = ['closedStatus', 'verdictRole', 'deferredLine', 'placeholderLine', 'eyesPhrases.assigns', 'eyesPhrases.reader', 'eyesPhrases.moment'];
  for (const label of labels) {
    const item = census.find((entry) => entry.label === label);
    if (!item) out.push(`the census printed no line for ${label}, which the fixture declares`);
    else if (item.matched === 0) out.push(`the census counted nothing for ${label} over a document that writes it`);
  }
  const misdeclared = vocabularyCensus(project(censusProject(wrong)));
  for (const item of misdeclared) {
    if (item.matched > 0) out.push(`the census counted ${item.matched} for ${item.label} declared as a word no document writes`);
  }
  return out;
}

/** A `projectGates` module holding exactly the gates one severity case needs. */
function gatesModule(entries) {
  const body = entries
    .map(
      ({ id, grade, finding, needs = [] }) =>
        `  {\n`
        + `    id: ${JSON.stringify(id)},\n`
        + `    title: ${JSON.stringify(`the fixture gate ${id}, which always fires`)},\n`
        + `    needs: ${JSON.stringify(needs)},\n`
        + (grade === undefined ? '' : `    grade: ${JSON.stringify(grade)},\n`)
        + `    run: () => [${JSON.stringify(finding)}],\n`
        + `  },`
    )
    .join('\n');
  return `// Built by the severity proof; it exists for the length of one run.\nexport const gates = [\n${body}\n];\n`;
}

const WARNING_GATE = {
  id: 'fixtureWarning',
  grade: 'warning',
  finding: 'notes/OPEN.md:4: this line names a source that may already settle it — re-read it',
};
const ERROR_GATE = {
  id: 'fixtureError',
  finding: 'notes/OPEN.md:9: this line is missing the part that says which side looks stale',
};

/**
 * What `check` does with each grade, read off its exit status rather than argued about.
 *
 * <p>The grade is worth nothing unless the two channels part company at the exit code, and no
 * case in `runCases` can see an exit code - it judges a gate's findings, not a process. So the
 * proof is a real project with a real `projectGates` module in it, and a real `bta.mjs check`
 * over it.
 *
 * @param project the fixture builder from `makeBuilders`, so the directories are cleaned up with
 *   every other fixture
 * @returns one string per expectation that came out the wrong way
 */
/**
 * A project gate answering to a core gate's id is refused, and saying so is the whole point.
 *
 * <p>Two directions, because the door matters as much as the refusal: a project that copied a core
 * gate before the core owned it must be stopped, and a project that deliberately replaces one -
 * `disabledGates` naming the core id with a reason - must be let through. Without the second half
 * the rule would be «a project may never own a gate the skill also has», which is a different rule
 * and the wrong one.
 *
 * @param project the fixture builder
 * @returns one string per expectation that came out the wrong way
 */
export function proveShadowedIds(project) {
  const CORE_ID = 'trailerGate';
  /** The words the refusal is recognised by - it fires or it does not, and nothing else says this. */
  const REFUSAL = '코어 게이트와 같은 아이디';
  const base = cleanProject();
  const shadow = gatesModule([{ id: CORE_ID, finding: 'notes/OPEN.md:1: the copy' }]);
  const out = [];
  const run = (config) => {
    const ctx = project({
      config: { ...base.config, ...config },
      files: { ...base.files, 'gates/project-gates.mjs': shadow },
      commits: ['chore(fixture): a project with nothing wrong with it\n\nChapter: none'],
    });
    const r = spawnSync(process.execPath, [BTA, 'check', '--config', ctx.configPath], {
      cwd: ctx.root, encoding: 'utf8',
    });
    return { status: r.status, said: `${r.stdout ?? ''}${r.stderr ?? ''}` };
  };

  // **Assert on the refusal's own words, not on the id.** The fixture gate always fires, so its
  // finding names the id and `check` exits nonzero whether or not the refusal exists - an assertion
  // on either of those passes with the rule switched off, which is a proof of nothing. Switching
  // the rule off is the only way that shows, and it is worth doing to every proof written here.
  const shadowed = run({ projectGates: 'gates/project-gates.mjs' });
  if (shadowed.status !== 2 || !shadowed.said.includes(REFUSAL)) {
    out.push(`a project gate under a core gate's id — \`check\` exited ${shadowed.status} `
      + `and ${shadowed.said.includes(REFUSAL) ? 'did not stop' : 'never refused it'}`);
  }

  const declared = run({
    projectGates: 'gates/project-gates.mjs',
    disabledGates: [{ id: CORE_ID, reason: 'this project owns it' }],
  });
  if (declared.said.includes(REFUSAL)) {
    out.push('a core gate turned off with a reason — the replacement was still refused, so there is no door');
  }
  return out;
}

export function proveSeverity(project) {
  const cases = [
    {
      name: 'a warning fires and nothing else does',
      gates: [WARNING_GATE],
      status: 0,
      says: ['⚠ fixtureWarning', '1 warning', 'no errors'],
      neverSays: ['✖ fixtureWarning'],
    },
    {
      name: 'a warning and an error both fire',
      gates: [WARNING_GATE, ERROR_GATE],
      status: 1,
      says: ['⚠ fixtureWarning', '✖ fixtureError', '1 warning', '1 finding'],
      neverSays: ['2 findings'],
    },
    {
      name: 'a gate declaring a grade nobody reads',
      gates: [{ id: 'fixtureUnknown', grade: 'advisory', finding: 'notes/OPEN.md:2: something' }],
      status: 1,
      says: ['fixtureUnknown', 'is not one of error, warning'],
      neverSays: [],
    },
  ];

  const base = cleanProject();
  const out = [];
  for (const testCase of cases) {
    const ctx = project({
      config: { ...base.config, projectGates: 'gates/project-gates.mjs' },
      files: { ...base.files, 'gates/project-gates.mjs': gatesModule(testCase.gates) },
      commits: ['chore(fixture): a project with nothing wrong with it\n\nChapter: none'],
    });
    const run = spawnSync(process.execPath, [BTA, 'check', '--config', ctx.configPath], {
      cwd: ctx.root,
      encoding: 'utf8',
    });
    const said = `${run.stdout ?? ''}${run.stderr ?? ''}`;
    const shown = said.trim().split('\n').map((l) => `    ${l}`).join('\n');
    if (run.status !== testCase.status) {
      out.push(`${testCase.name} — \`check\` exited ${run.status} where the grade means ${testCase.status}:\n${shown}`);
      continue;
    }
    for (const text of testCase.says) {
      if (!said.includes(text)) out.push(`${testCase.name} — the output never says "${text}":\n${shown}`);
    }
    for (const text of testCase.neverSays) {
      if (said.includes(text)) out.push(`${testCase.name} — the output says "${text}", so the two channels are not told apart:\n${shown}`);
    }
  }
  return out;
}
