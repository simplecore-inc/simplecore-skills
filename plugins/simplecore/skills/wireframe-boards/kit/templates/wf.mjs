#!/usr/bin/env node
// The board's only script. Everything it does lives in the `simplecore:wireframe-boards` skill;
// this file finds that kit and hands over.
//
//   node wf.mjs build          the board and its PDF        node wf.mjs check     시각 훑기
//   node wf.mjs build --no-pdf HTML only, while iterating    node wf.mjs gates     게이트 자기 시험
//   node wf.mjs serve          build · watch · serve — `./dev.sh` is the same thing, spelled short
//   node wf.mjs catalog        컴포넌트 스토리북             node wf.mjs shots <디렉터리>
//   node wf.mjs pdf --mask 40% --watermark   부분공개본      node wf.mjs doctor    계약 버전과 남은 작업
//
// **Do not add logic here.** A board that grows its own build is a board that has to be migrated
// by hand every time the kit moves; that is the whole reason the kit is in the skill. Something
// the kit cannot do belongs in the kit, or in `board.gates.mjs` where a gate of this product's
// own goes.
import { existsSync, readdirSync, lstatSync, rmSync, symlinkSync, cpSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const boardDir = dirname(fileURLToPath(import.meta.url));

/**
 * Every place the kit is looked for, in order.
 *
 * <p>`WIREFRAME_KIT` comes first so a checkout of the skill under development wins over the
 * installed copy — the one case where the answer has to be overridable.
 */
function candidates() {
  const home = homedir();
  const out = [];
  if (process.env.WIREFRAME_KIT) out.push(resolve(process.env.WIREFRAME_KIT));
  out.push(join(home, '.claude/skills/simplecore/skills/wireframe-boards/kit'));
  // A marketplace install lands under the plugin cache instead of the skills symlink, and the
  // directory in between carries a version, so it is walked rather than named.
  const cache = join(home, '.claude/plugins/cache');
  if (existsSync(cache)) {
    for (const entry of readdirSync(cache)) {
      out.push(join(cache, entry, 'plugins/simplecore/skills/wireframe-boards/kit'));
      out.push(join(cache, entry, 'skills/wireframe-boards/kit'));
    }
  }
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
// re-pointed on every run rather than checked — a link left over from a moved skill still
// resolves and still imports, it just imports the OLD kit, and every command keeps working while
// only the behaviour is stale.
//
// **`junction`, not `dir`.** On Windows a directory symlink needs Developer Mode or an elevated
// shell, so `dir` fails with EPERM on an ordinary account; a junction needs neither and points at
// a directory just as well. POSIX ignores the argument, so one call is right on both.
// Where even that is refused — a filesystem that has no links at all — the kit is COPIED in, so
// the board still builds. The copy is what `wf.mjs` falls back to, never what it prefers: a copy
// goes stale the moment the skill is updated, and nothing about a stale copy looks wrong.
const link = join(boardDir, '.kit');
try {
  lstatSync(link);
  rmSync(link, { recursive: true, force: true });
} catch {
  // nothing there — the ordinary first-run case
}
try {
  symlinkSync(kitDir, link, 'junction');
} catch (e) {
  cpSync(kitDir, link, { recursive: true, dereference: true });
  console.error(`알림: 링크를 만들 수 없어 킷을 복사했습니다 (${e.code}). 스킬을 갱신하면 다시 실행하세요.`);
}

// Appended rather than inserted: the subcommand has to stay at argv[2], and a positional the
// subcommand takes (`shots _shots p-`) has to stay ahead of any flag.
process.argv.push('--board', boardDir);
await import(pathToFileURL(join(kitDir, 'bin/wfb.mjs')).href);
