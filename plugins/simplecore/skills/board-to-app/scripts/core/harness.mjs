// Building a project for a gate to be proved against, and the runner that judges the result.
//
// A case is `{ gate, name, ctx, shouldFire }`. The fixture is a real directory with a real
// config in it — never a hand-made context object — so a gate is proved against the same
// reader it uses in a repository, and a gate that quietly stopped resolving paths cannot pass.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG_NAME, SCHEMA, loadProject } from './context.mjs';
import { GRADES } from './gates.mjs';

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
 * empty directory, `''` makes an empty file, and **`null` means the file is not there** — the
 * case for a document that was never written. `undefined` is refused: it is what a renamed
 * constant leaves behind, and reading it as absence would drop a file nobody meant to drop. `commits` is a list of commits, which turns the fixture into a git repository:
 * a plain string is a message and makes an empty commit, and `{ message, files }` writes those
 * files and commits exactly them. The second form is what a gate reading a commit's CONTENT needs
 * — a fixture whose history is all empty commits can prove a rule about messages and nothing about
 * what a commit carried.
 */
export function makeBuilders() {
  const roots = [];

  const project = ({ config = {}, files = {}, commits = null, options = {} } = {}) => {
    const root = mkdtempSync(join(tmpdir(), 'board-to-app-case-'));
    roots.push(root);

    for (const [rel, body] of Object.entries(files)) {
      // `null` is the case saying THIS FILE IS NOT THERE, which half the gates here exist to
      // find — an absent result document, a capture that was cited and never written. Writing it
      // as an empty file instead proves a different defect and passes for the wrong reason, so
      // the natural notation has to mean absence.
      if (body === null) continue;
      // `undefined` is a name that did not resolve — a constant renamed, a typo in the key. It
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
        // the fixture happens to have lying beside it — which is the very distinction under test.
        if (paths.length) git(['add', '--', ...paths]);
        git([
          '-c', 'user.name=case',
          '-c', 'user.email=case@example.invalid',
          'commit', ...(paths.length ? [] : ['--allow-empty']), '-q', '-m', message,
        ]);
      }
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
 * keep passing, and it is counted in the channel nobody chose — so a rule written to prompt a
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

/** The header row that opens the config table in `SKILL.md`, and the anchor the reverse read uses. */
const CONFIG_TABLE_HEADER = '| Key | What the project names with it | Required | Absent means |';

/** A key's own row in a `| \`key\` | … |` table. */
const TABLE_KEY = /^\|\s*`([A-Za-z][A-Za-z0-9]*)`\s*\|/;

/**
 * Where a key is documented and where it is not — the comparison alone, so it can be run against
 * the real files and against doctored ones.
 *
 * <p>`costs` maps a key to the sentence the config table's last column gives it, and it is held
 * against `SCHEMA[key].absent` character for character. **The two are one sentence in two files,
 * which is a shape that only ever drifts one way**: the table is what a person edits and
 * `doctor` prints the schema, so a cost corrected in the table reaches nobody and the report goes
 * on saying the old thing. Neither file can read the other, so the equality is what holds them —
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
 * `configGate` validates it, `doctor` prints it — and nothing anywhere says it exists, so the only
 * readers who ever meet it are the ones who go through the source. Eight keys reached that state
 * before this ran.
 *
 * <p><b>Both directions are proved here rather than in a case</b>, because the subject is this
 * skill's own files rather than a project: the comparison is run once against them and twice
 * against a doctored copy, and a comparison that stays quiet on a key nobody documented is a
 * comparison that would stay quiet on all of them.
 *
 * @returns one string per expectation that came out the wrong way
 */
export function proveKeysAreDocumented() {
  const skill = readFileSync(new URL('../../SKILL.md', import.meta.url), 'utf8');
  const lines = skill.split('\n');
  const opens = lines.indexOf(CONFIG_TABLE_HEADER);
  // A header that moved is itself the finding: the reverse read has nothing to anchor on, and
  // silently reading every table in the file would report the heading-role rows as stale keys.
  if (opens < 0) {
    return [`SKILL.md no longer carries the config table's header row — the reverse read anchors on it, and without it a stale row is invisible`];
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
    // reading the fourth field of that row would compare half a sentence — so it is left out of
    // the cost comparison and reported by the row below instead.
    const cells = line.split('|');
    if (cells.length === 6) costs.set(found[1], cells[4].trim());
  }
  for (const key of inTable) {
    if (!costs.has(key)) {
      return [`SKILL.md: the config table's row for \`${key}\` does not split into four cells — a cell carrying a pipe of its own makes the 「Absent means」 column unreadable, and the sentence \`doctor\` prints could not be held against it`];
    }
  }

  const template = JSON.parse(readFileSync(new URL('../../assets/board-to-app.json', import.meta.url), 'utf8'));
  const inTemplate = new Set(Object.keys(template).filter((k) => !k.startsWith('//')));

  const out = undocumentedKeys(Object.keys(SCHEMA), inTable, inTemplate, costs);
  // Two baselines rather than one. The presence probes are measured without the cost comparison,
  // so a sentence that has drifted in the table cannot move the yardstick a probe about a missing
  // row is read against — one real defect would otherwise report as three.
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
  // the whole failure mode — the table is what a person corrects and `doctor` prints the schema —
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

/** A `projectGates` module holding exactly the gates one severity case needs. */
function gatesModule(entries) {
  const body = entries
    .map(
      ({ id, grade, finding }) =>
        `  {\n`
        + `    id: ${JSON.stringify(id)},\n`
        + `    title: ${JSON.stringify(`the fixture gate ${id}, which always fires`)},\n`
        + `    needs: [],\n`
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
 * case in `runCases` can see an exit code — it judges a gate's findings, not a process. So the
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
 * gate before the core owned it must be stopped, and a project that deliberately replaces one —
 * `disabledGates` naming the core id with a reason — must be let through. Without the second half
 * the rule would be «a project may never own a gate the skill also has», which is a different rule
 * and the wrong one.
 *
 * @param project the fixture builder
 * @returns one string per expectation that came out the wrong way
 */
export function proveShadowedIds(project) {
  const CORE_ID = 'trailerGate';
  /** The words the refusal is recognised by — it fires or it does not, and nothing else says this. */
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
  // finding names the id and `check` exits nonzero whether or not the refusal exists — an assertion
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
