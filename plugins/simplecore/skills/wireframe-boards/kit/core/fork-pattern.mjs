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
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
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

// ── Promoting what the board already has ────────────────────────────────────
//
// **The other direction, and the one a board being migrated actually needs.** `forkPattern` above
// starts from a pattern the kit ships, which is right for a board already drawn in one. A board
// coming from before the contract has no shipped pattern behind it at all — its components, its
// stylesheet and its reading-contract items are sitting in `src/`, written for this product. Told
// to 「put the component in the pattern」, its author has 94 of them and no pattern to put them in,
// and forking a shipped one would hand them a hundred primitives they do not draw and still leave
// their own outside.
//
// **So the board's own `src/` becomes the pattern.** Nothing is rewritten and nothing is
// discarded: the files move up a level, a `pattern.mjs` is written around them, and `src/` keeps
// the one-line shim every screen already imports. The board is then a contract-3 board drawn in a
// pattern it owns, and every core gate reaches it.

/** What a board carries in `src/` that belongs to a pattern, and what each becomes. */
const PROMOTED = ['components.mjs', 'styles.css', 'intro.html'];

/** The smallest `pattern.mjs` the kit will load, written around what was promoted. */
const PATTERN_MJS = (name, title) => `// ${name} — this board's own pattern, promoted out of \`src/\`.
//
// **It is a pattern rather than a folder of files because the kit draws boards from patterns.**
// The components, the stylesheet and the reading-contract items below are what every frame here is
// composed from and held to; they were in \`src/\` when this board built itself, and they are here
// now that the kit builds it.
//
// **This board owns all of it.** Nothing arrives from the kit's own patterns, and nothing here
// reaches another board — which is the trade a board makes by having its own. A component that
// would be right in a second product drawn this way is better placed in a shipped pattern.
export default {
  name: '${name}',
  title: '${title}',
  description: '이 보드가 그리는 방식 — 컴포넌트·스타일시트·읽기 계약을 이 보드가 갖는다.',

  /** The device classes this pattern draws. Widen it as the board draws more of them. */
  devices: { desktop: '${title}' },

  /**
   * The gates every board in this pattern runs, on top of the kit's core gates.
   *
   * <p>Empty to begin with, and that is honest rather than finished: the core gates already hold
   * the permanent id, balanced markup, reachability and the documents. A rule true of every frame
   * drawn THIS way — a copy register, a layout discipline, a control vocabulary — belongs here,
   * and each one added is a defect that cannot come back.
   */
  gates: [],
};
`;

/**
 * Turn what the board draws with into a pattern the board owns.
 *
 * @param boardDir the board folder
 * @param options `into` the folder to create (default `pattern`), `name` the pattern's own name
 * @returns what moved and what was written
 */
export function adoptPattern(boardDir, { into = 'pattern', name = null } = {}) {
  const src = join(boardDir, 'src');
  if (!existsSync(join(src, 'components.mjs'))) {
    throw new Error(`${boardDir}/src/components.mjs가 없습니다 — 승격할 것이 없습니다`);
  }
  const shimmed = readFileSync(join(src, 'components.mjs'), 'utf8');
  if (/export \* from '\.\..*components\.mjs';/.test(shimmed) && shimmed.split('\n').filter((l) => l.trim() && !l.trim().startsWith('//')).length <= 1) {
    throw new Error('src/components.mjs가 이미 심(shim)입니다 — 이 보드는 이미 패턴을 쓰고 있습니다');
  }
  const to = join(boardDir, into);
  if (existsSync(to)) throw new Error(`${into}/가 이미 있습니다 — 덮어쓰지 않습니다`);

  mkdirSync(to, { recursive: true });
  const moved = [];
  for (const part of PROMOTED) {
    const from = join(src, part);
    if (!existsSync(from)) continue;
    cpSync(from, join(to, part), { recursive: true });
    rmSync(from);
    moved.push(part);
  }

  const patternName = name ?? basename(boardDir);
  writeFileSync(join(to, 'pattern.mjs'), PATTERN_MJS(patternName, patternName));

  // The shim every screen already imports. Written last, so a run that stopped earlier leaves the
  // board drawing from `src/` rather than from a shim pointing at a half-made pattern.
  writeFileSync(
    join(src, 'components.mjs'),
    '// The composition kit, re-exported from the pattern this board owns.\n'
    + '//\n'
    + '// **This file is a pointer, not a place to add anything.** Every primitive lives in\n'
    + `// \`${into}/components.mjs\`; a component added here would reach this one file and nothing else.\n`
    + '//\n'
    + '// It exists because the screen files import `../components.mjs`, and an ESM re-export needs a\n'
    + '// STATIC specifier — it cannot resolve a path at run time.\n'
    + `export * from '../${into}/components.mjs';\n`
  );

  const configPath = join(boardDir, CONFIG);
  const wrote = existsSync(configPath);
  if (wrote) {
    const configSrc = readFileSync(configPath, 'utf8');
    writeFileSync(configPath, /^\s*pattern:/m.test(configSrc)
      ? configSrc.replace(/^(\s*pattern:\s*)'[^']+'/m, `$1'./${into}'`)
      : configSrc.replace(/(export default \{\n)/, `$1  pattern: './${into}',\n`));
  }

  return { into, name: patternName, moved, config: wrote };
}
