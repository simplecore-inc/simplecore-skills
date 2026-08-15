// Where the kit is, and how a board points at it.
//
// A board holds its own content and nothing else: the engine, the components, the shells and the
// styles all live in this skill. Two things have to find them.
//
//   - `wf.mjs` in the board folder, which needs the kit's CLI before it can run anything.
//   - every screen file, which imports `../components.mjs` — and an ESM re-export needs a STATIC
//     specifier, so it cannot resolve a path at run time the way `wf.mjs` can.
//
// The second is what decides the design. The board keeps a machine-local symlink `.kit` beside
// `src/`, and the committed shim says `../.kit/patterns/<pattern>/components.mjs` — a stable,
// checked-in path over a pointer that is never committed. `wf.mjs` re-points it on every run, so
// a checkout on another machine, a moved skill, or a plugin upgrade all heal on the next build
// rather than needing anyone to know the link exists.
import { existsSync, readdirSync, lstatSync, rmSync, symlinkSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

/** The link name inside a board folder. Never committed — `.gitignore` carries it. */
export const KIT_LINK = '.kit';

/**
 * Every place the kit is looked for, in order.
 *
 * <p>`WIREFRAME_KIT` comes first so a checkout of the skill under development wins over the
 * installed copy — that is the one case where the answer has to be overridable, and an env var
 * is the only channel that reaches a build nobody edited.
 */
export function kitCandidates(env = process.env) {
  const home = homedir();
  const out = [];
  if (env.WIREFRAME_KIT) out.push(resolve(env.WIREFRAME_KIT));
  out.push(join(home, '.claude/skills/simplecore/skills/wireframe-boards/kit'));
  // A marketplace install lands under the plugin cache instead of the skills symlink, and the
  // directory in between carries a version, so it is globbed rather than named.
  const cache = join(home, '.claude/plugins/cache');
  if (existsSync(cache)) {
    for (const entry of readdirSync(cache)) {
      out.push(join(cache, entry, 'plugins/simplecore/skills/wireframe-boards/kit'));
      out.push(join(cache, entry, 'skills/wireframe-boards/kit'));
    }
  }
  return out;
}

/** Whatever a candidate must contain to BE the kit, rather than a directory of that name. */
const isKit = (dir) => existsSync(join(dir, 'bin/wfb.mjs')) && existsSync(join(dir, 'core/build.mjs'));

/**
 * The kit directory, or null when the skill is not installed on this machine.
 *
 * <p>Returning null rather than throwing is deliberate: `wf.mjs` turns it into the one message
 * that actually helps — the install command — and a thrown stack trace would bury it.
 */
export function findKit(env = process.env) {
  for (const dir of kitCandidates(env)) {
    if (existsSync(dir) && isKit(dir)) return dir;
  }
  return null;
}

/**
 * Point `<boardDir>/.kit` at the kit, replacing whatever was there.
 *
 * <p>Always rewritten rather than checked: a link left over from a moved skill still resolves as
 * a path and still imports — it just imports the OLD kit, which is the one failure mode nobody
 * would suspect, because every command keeps working and only the behaviour is stale.
 *
 * @returns the kit directory it now points at
 */
export function linkKit(boardDir, kitDir) {
  const link = join(boardDir, KIT_LINK);
  if (!existsSync(boardDir)) mkdirSync(boardDir, { recursive: true });
  // lstat, not exists: a link pointing at a directory that is gone reports false for `existsSync`
  // and still occupies the name, so `symlinkSync` would fail with EEXIST on a board whose skill
  // had merely moved.
  try {
    lstatSync(link);
    rmSync(link, { recursive: true, force: true });
  } catch {
    // nothing there — the ordinary first-run case
  }
  symlinkSync(kitDir, link, 'dir');
  return kitDir;
}

/** What a board is told when the skill is not installed. One command, not a diagnosis. */
export const INSTALL_HINT =
  'wireframe-boards 킷을 찾지 못했습니다.\n' +
  '  claude plugin install simplecore@simplecore-skills\n' +
  '개발 중인 체크아웃을 쓰려면 WIREFRAME_KIT에 그 kit 디렉터리 경로를 지정합니다.';
