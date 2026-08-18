// Giving a board a pattern of its own, started from the one it is already drawn in.
//
// **The rule this exists beside, not against.** A component the pattern does not have goes INTO
// the pattern — never into a file inside the board — because a component added to the pattern
// reaches every board drawn that way and one added to a board reaches one. That rule assumes the
// product and the pattern are the same shape.
//
// **Where they are not, the rule has nowhere to send anybody.** A product whose component
// vocabulary is mostly its own — most of its names absent from every shipped pattern — cannot put
// them in a shipped pattern, because they would be dead weight in every other board on it. Before
// this command the only remaining move was to keep the board outside the contract, where no gate
// reaches it and the kit cannot build it at all. That is the worst of the three outcomes and it
// was the only one available.
//
// **So: fork the closest pattern into the board, and own it.** What the board gets is a real
// pattern — `pattern.mjs`, `components.mjs`, `styles.css`, `intro.html` and the gates — sitting in
// the repository, and `board.config.mjs` pointing at it by path.
//
// **The cost, said once and out loud.** A forked pattern stops receiving the kit's improvements to
// the pattern it came from: a component added there, a gate tightened there, a stylesheet fix
// there, none of them arrive. The board owns all of it from that moment. **So this is the last
// resort and not the first** — a component that would be right in a second product drawn the same
// way still belongs in the shipped pattern, and one or two of those is not a reason to fork.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { patternDirFor } from './context.mjs';

/** What a pattern is made of. `examples/` is deliberately not among them — the board exists. */
const PARTS = ['pattern.mjs', 'components.mjs', 'styles.css', 'intro.html', 'gates'];

/** A relative specifier, in each of the ways one is written. */
const RELATIVE = /(\bfrom\s*|\bimport\s*\(\s*)(['"])(\.[^'"]*)\2/g;

/** Every `.mjs` under a directory, deepest last. */
function sources(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (entry.endsWith('.mjs')) out.push(full);
  }
  return out;
}

/**
 * Re-point what a copied pattern imports from OUTSIDE itself.
 *
 * <p>A pattern in the kit reaches the kit's own core by climbing out of its folder
 * (`../../../core/ids.mjs`). Copied into a board, that specifier climbs out of the board instead
 * and the build stops on a module that is not there — which is a failure the fork has to fix
 * rather than leave for whoever runs the next build to diagnose.
 *
 * <p>The rewrite goes through the board's `.kit` link, exactly as the components shim already
 * does: a committed path to a machine-local pointer that `wf.mjs` re-points on every run, so a
 * checkout on another machine heals rather than needing anybody to know the link exists. A
 * specifier that stays inside the pattern is untouched.
 *
 * @param fromDir the pattern's directory in the kit
 * @param toDir the copy's directory in the board
 * @param kitDir the kit root
 * @param boardDir the board folder
 * @returns how many specifiers were re-pointed
 */
function repoint(fromDir, toDir, kitDir, boardDir) {
  let changed = 0;
  for (const file of sources(toDir)) {
    const original = join(fromDir, relative(toDir, file));
    const text = readFileSync(file, 'utf8');
    const out = text.replace(RELATIVE, (whole, keyword, quote, specifier) => {
      const target = resolve(dirname(original), specifier);
      // Inside the pattern: the copy carries it, so the specifier still means what it said.
      if (target === fromDir || target.startsWith(`${fromDir}/`)) return whole;
      // Outside the kit altogether: not ours to rewrite, and nothing here writes one.
      if (!target.startsWith(`${kitDir}/`)) return whole;
      const through = join(boardDir, '.kit', relative(kitDir, target));
      let rewritten = relative(dirname(file), through);
      if (!rewritten.startsWith('.')) rewritten = `./${rewritten}`;
      changed += 1;
      return `${keyword}${quote}${rewritten}${quote}`;
    });
    if (out !== text) writeFileSync(file, out);
  }
  return changed;
}

/** The two files that name the pattern, and have to be re-pointed in the same act. */
const CONFIG = 'board.config.mjs';
const SHIM = 'src/components.mjs';

/**
 * Copy the pattern this board declares into the board, and point the board at the copy.
 *
 * @param boardDir the board folder
 * @param options `into` the folder name to create (default `pattern`), `name` the forked
 *   pattern's own name (default the board folder's name)
 * @returns what was copied and what was re-pointed
 */
export function forkPattern(boardDir, { into = 'pattern', name = null } = {}) {
  const configPath = join(boardDir, CONFIG);
  if (!existsSync(configPath)) throw new Error(`${boardDir}에 ${CONFIG}가 없습니다`);
  const configSrc = readFileSync(configPath, 'utf8');
  const declared = /^\s*pattern:\s*'([^']+)'/m.exec(configSrc);
  if (!declared) throw new Error(`${CONFIG}에서 pattern을 읽지 못했습니다`);
  if (declared[1].startsWith('.')) {
    throw new Error(
      `이 보드는 이미 제 패턴을 갖고 있습니다 (${declared[1]}). 컴포넌트는 거기에 더합니다.`
    );
  }

  const from = patternDirFor(boardDir, declared[1]);
  if (!existsSync(from)) throw new Error(`패턴 '${declared[1]}'을 찾지 못했습니다 (${from})`);
  const to = join(boardDir, into);
  if (existsSync(to)) {
    throw new Error(
      `${into}/가 이미 있습니다 — 덮어쓰지 않습니다. 다른 이름으로 하려면 --into <디렉터리>.`
    );
  }

  mkdirSync(to, { recursive: true });
  const copied = [];
  for (const part of PARTS) {
    const source = join(from, part);
    if (!existsSync(source)) continue;
    cpSync(source, join(to, part), { recursive: true });
    copied.push(part);
  }
  if (!copied.includes('pattern.mjs') || !copied.includes('components.mjs')) {
    throw new Error(`패턴 '${declared[1]}'에 pattern.mjs나 components.mjs가 없습니다 (${from})`);
  }

  // The fork's own name. Two patterns answering to one name is the kind of thing that reads fine
  // in every file and comes out wrong in a report.
  const forkName = name ?? basename(boardDir);
  const patternPath = join(to, 'pattern.mjs');
  const patternSrc = readFileSync(patternPath, 'utf8');
  const named = patternSrc.replace(/(\n\s*name:\s*)'[^']*'/, `$1'${forkName}'`);
  if (named === patternSrc) {
    throw new Error(`${into}/pattern.mjs의 name을 바꾸지 못했습니다 — 직접 고칩니다`);
  }
  writeFileSync(patternPath, named);

  writeFileSync(configPath, configSrc.replace(/^(\s*pattern:\s*)'[^']+'/m, `$1'./${into}'`));

  // The screen files import `../components.mjs`, and that shim is what decides where the
  // primitives come from. Left pointing through `.kit`, the fork would sit in the repository and
  // nothing would read it — a copy nobody uses is worse than no copy, because it looks live.
  const shimPath = join(boardDir, SHIM);
  const shimSrc = existsSync(shimPath) ? readFileSync(shimPath, 'utf8') : '';
  const shim = shimSrc.replace(
    /export \* from '[^']*components\.mjs';/,
    `export * from '../${into}/components.mjs';`
  );
  if (shim === shimSrc) {
    throw new Error(`${SHIM}의 재수출 경로를 바꾸지 못했습니다 — 직접 '../${into}/components.mjs'로 고칩니다`);
  }
  writeFileSync(shimPath, shim);

  // Real paths on both sides: the pattern is reached through the board's `.kit` symlink, and a
  // specifier resolved against the link and one resolved against the kit itself are different
  // strings for one directory — comparing them would call every kit import 「outside the kit」.
  const fromReal = realpathSync(from);
  const repointed = repoint(fromReal, to, resolve(fromReal, '..', '..'), boardDir);

  return { from: declared[1], into, name: forkName, copied, repointed, files: readdirSync(to).sort() };
}
