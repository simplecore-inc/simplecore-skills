#!/usr/bin/env node
// The board's bootstrap. Everything it does lives in the `simplecore:wireframe-boards` skill; this
// file finds that kit and hands over.
//
//   node wf.mjs build          the board and its PDF        node wf.mjs check     visual sweep
//   node wf.mjs build --no-pdf HTML only, while iterating    node wf.mjs gates     gate self-test
//   node wf.mjs serve          build · watch · serve - `./dev.sh` is the same thing, spelled short
//   node wf.mjs catalog        the component storybook      node wf.mjs shots <directory>
//   node wf.mjs pdf --mask 40% --watermark   the share copy  node wf.mjs doctor    contract and what it owes
//   node wf.mjs where          the plugin directory, for a command that needs another of its scripts
//
// **Do not add logic here.** A board that grows its own build is a board that has to be migrated
// by hand every time the kit moves; that is the whole reason the kit is in the skill. Something
// the kit cannot do belongs in the kit, or in `board.gates.mjs` where a gate of this product's
// own goes.
import { existsSync, readdirSync, readFileSync, lstatSync, rmSync, symlinkSync, cpSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const boardDir = dirname(fileURLToPath(import.meta.url));

/** The kit's place inside an installed copy of the plugin. */
const KIT_IN_PLUGIN = 'skills/wireframe-boards/kit';

/** A file or directory that is absent or unreadable is not an install; anything else is a fault. */
const ABSENT = new Set(['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM', 'EISDIR']);

function readJson(file) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    if (ABSENT.has(e.code)) return null;
    throw e;
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    if (e instanceof SyntaxError) return null;
    throw e;
  }
}

function dirsIn(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (e) {
    if (ABSENT.has(e.code)) return [];
    throw e;
  }
}

/** Newest first: numeric segments compare as numbers, and a name with none sorts last. */
function byVersionDescending(a, b) {
  const pa = a.split(/[.+-]/);
  const pb = b.split(/[.+-]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const x = pa[i] ?? '';
    const y = pb[i] ?? '';
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    if (nx && ny && Number(x) !== Number(y)) return Number(y) - Number(x);
    if (nx !== ny) return nx ? -1 : 1;
    if (!nx && x !== y) return x < y ? 1 : -1;
  }
  return 0;
}

const inside = (child, parent) => {
  const rel = relative(resolve(parent), resolve(child));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
};

/**
 * The install paths Claude Code recorded for this plugin, most specific first.
 *
 * <p>`installed_plugins.json` is the one record of which copy a session loads, and it covers a
 * marketplace install and a directory-marketplace install alike. A project-scoped install for the
 * project this board sits in wins over a user-scoped one, which wins over another project's.
 */
function installedPaths(claudeDir) {
  const record = readJson(join(claudeDir, 'plugins/installed_plugins.json'));
  const plugins = record?.plugins;
  if (!plugins || typeof plugins !== 'object') return [];
  const found = [];
  for (const [key, value] of Object.entries(plugins)) {
    if (!key.startsWith('simplecore@')) continue;
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (typeof entry?.installPath !== 'string' || !entry.installPath) continue;
      const rank = typeof entry.projectPath === 'string' && inside(boardDir, entry.projectPath)
        ? 0
        : entry.scope === 'user' || entry.scope === undefined ? 1 : 2;
      found.push({ rank, path: join(entry.installPath, KIT_IN_PLUGIN) });
    }
  }
  return found.sort((a, b) => a.rank - b.rank).map((f) => f.path);
}

/**
 * Every cached copy of the plugin, newest version first.
 *
 * <p>The cache keeps old versions beside the current one, so a directory listing alone would hand
 * back whichever the filesystem lists first. This is the fallback for a machine whose install
 * record is missing or unreadable.
 */
function cachedPaths(claudeDir) {
  const cache = join(claudeDir, 'plugins/cache');
  const copies = [];
  for (const marketplace of dirsIn(cache)) {
    const plugin = join(cache, marketplace, 'simplecore');
    for (const version of dirsIn(plugin)) copies.push({ version, path: join(plugin, version, KIT_IN_PLUGIN) });
  }
  return copies.sort((a, b) => byVersionDescending(a.version, b.version)).map((c) => c.path);
}

/**
 * Every place the kit is looked for, in order.
 *
 * <p>`WIREFRAME_KIT` comes first so a checkout of the skill under development wins over the
 * installed copy - the one case where the answer has to be overridable. The skills folder comes
 * next, then the install record, then the cache.
 */
function candidates() {
  const claudeDir = join(homedir(), '.claude');
  const out = [];
  if (process.env.WIREFRAME_KIT) out.push(resolve(process.env.WIREFRAME_KIT));
  out.push(join(claudeDir, 'skills/simplecore', KIT_IN_PLUGIN));
  out.push(...installedPaths(claudeDir));
  out.push(...cachedPaths(claudeDir));
  return out;
}

const isKit = (d) => existsSync(join(d, 'bin/wfb.mjs')) && existsSync(join(d, 'core/build.mjs'));
const kitDir = candidates().find((d) => existsSync(d) && isKit(d));

if (!kitDir) {
  console.error(
    'wireframe-boards 킷을 찾지 못했습니다.\n' +
    '  claude plugin install simplecore@simplecore-skills\n' +
    '개발 중인 체크아웃을 쓰려면 WIREFRAME_KIT에 그 kit 디렉터리 경로를 지정합니다.'
  );
  process.exit(1);
}

// `.kit` is how the SCREEN FILES reach the kit: an ESM re-export needs a static specifier, so
// `src/components.mjs` says `../.kit/patterns/…` and this link is what that path lands on. It is
// re-pointed on every run rather than checked - a link left over from a moved skill still
// resolves and still imports, it just imports the OLD kit, and every command keeps working while
// only the behaviour is stale.
//
// **`junction`, not `dir`.** On Windows a directory symlink needs Developer Mode or an elevated
// shell, so `dir` fails with EPERM on an ordinary account; a junction needs neither and points at
// a directory just as well. POSIX ignores the argument, so one call is right on both.
// Where even that is refused - a filesystem that has no links at all - the kit is COPIED in, so
// the board still builds. The copy is what `wf.mjs` falls back to, never what it prefers: a copy
// goes stale the moment the skill is updated, and nothing about a stale copy looks wrong.
const link = join(boardDir, '.kit');
let linkPresent = true;
try {
  lstatSync(link);
} catch (e) {
  // nothing there - the ordinary first-run case
  if (e.code !== 'ENOENT') throw e;
  linkPresent = false;
}
if (linkPresent) rmSync(link, { recursive: true, force: true });
try {
  symlinkSync(kitDir, link, 'junction');
} catch (e) {
  // Any refusal from the filesystem is answered by the copy; anything that is not a system error
  // is a fault in this file and surfaces as one.
  if (typeof e?.code !== 'string') throw e;
  cpSync(kitDir, link, { recursive: true, dereference: true });
  console.error(`알림: 링크를 만들 수 없어 킷을 복사했습니다 (${e.code}). 스킬을 갱신하면 다시 실행하세요.`);
}

// Appended rather than inserted: the subcommand has to stay at argv[2], and a positional the
// subcommand takes (`shots _shots p-`) has to stay ahead of any flag.
process.argv.push('--board', boardDir);
await import(pathToFileURL(join(kitDir, 'bin/wfb.mjs')).href);
