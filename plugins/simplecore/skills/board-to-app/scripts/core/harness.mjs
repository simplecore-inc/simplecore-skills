// Building a project for a gate to be proved against, and the runner that judges the result.
//
// A case is `{ gate, name, ctx, shouldFire }`. The fixture is a real directory with a real
// config in it — never a hand-made context object — so a gate is proved against the same
// reader it uses in a repository, and a gate that quietly stopped resolving paths cannot pass.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { CONFIG_NAME, loadProject } from './context.mjs';

/**
 * A fixture factory and the cleanup that removes every directory it made.
 *
 * <p>`files` maps a repository-relative path to its contents; a key ending in `/` makes an
 * empty directory. `commits` is a list of commit messages, which turns the fixture into a git
 * repository with one empty commit each.
 */
export function makeBuilders() {
  const roots = [];

  const project = ({ config = {}, files = {}, commits = null, options = {} } = {}) => {
    const root = mkdtempSync(join(tmpdir(), 'board-to-app-case-'));
    roots.push(root);

    for (const [rel, body] of Object.entries(files)) {
      const target = join(root, rel);
      if (rel.endsWith('/')) {
        mkdirSync(target, { recursive: true });
        continue;
      }
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, body ?? '');
    }

    const configPath = join(root, CONFIG_NAME);
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    if (commits) {
      const git = (args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
      git(['-c', 'init.defaultBranch=main', 'init', '-q']);
      for (const message of commits) {
        git([
          '-c', 'user.name=case',
          '-c', 'user.email=case@example.invalid',
          'commit', '--allow-empty', '-q', '-m', message,
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
