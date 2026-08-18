// Building a project for a gate to be proved against, and the runner that judges the result.
//
// A case is `{ gate, name, ctx, shouldFire }`. The fixture is a real directory with a real
// config in it — never a hand-made context object — so a gate is proved against the same
// reader it uses in a repository, and a gate that quietly stopped resolving paths cannot pass.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG_NAME, loadProject } from './context.mjs';
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
