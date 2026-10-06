// Feed each gate the defect it exists to catch, then feed it a clean board. A gate that stays
// quiet on the first, or fires on the second, is a gate that no longer works - and a build whose
// gates have gone quiet looks exactly like a board with nothing wrong with it.
//
//   node wf.mjs gates
//
// The cases come from the same three places the gates do, so a pattern's gates are tested by the
// pattern's cases and a board's by its own. A gate with no case at all is named at the end: that
// is the state every gate decays into, and it is invisible from the build.
import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadBoard } from '../context.mjs';
import { gatesFor } from '../gates/index.mjs';
import { BOARD_CONTRACT } from '../partials.mjs';
import { LATEST } from '../migrations.mjs';
import { makeBuilders, runCases, untested } from './harness.mjs';
import { cases as coreCases } from './cases.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/** The skill's single-file starting point, which stamps the contract it was written against. */
const TEMPLATE = join(HERE, '../../../assets/board-template.html');

/**
 * Every copy of the contract number agrees with `BOARD_CONTRACT`.
 *
 * <p>The number has one owner, `core/partials.mjs`, and two copies written by hand: the newest
 * entry of `core/migrations.mjs`, and the stamp in `assets/board-template.html`. A copy left behind
 * fails nothing on its own - it tells every board copied from the template that it needs migrating,
 * or leaves `doctor` reporting a record that stops short of the kit - so it is asked here, with the
 * other questions about the kit itself.
 *
 * @returns `{ bad, unread }` - one line per copy that disagrees, and the copies that could not be
 *   read on this install (a kit copied into a board carries no `assets/`)
 */
function contractCopies() {
  const bad = [];
  const unread = [];
  if (LATEST !== BOARD_CONTRACT) {
    bad.push(`core/migrations.mjs의 마지막 계약은 ${LATEST}인데 BOARD_CONTRACT는 ${BOARD_CONTRACT}입니다`);
  }
  if (existsSync(TEMPLATE)) {
    const stamp = /<meta\s+name="wireframe-board-contract"\s+content="(\d+)"/.exec(readFileSync(TEMPLATE, 'utf8'));
    if (!stamp) bad.push('assets/board-template.html에 wireframe-board-contract 표기가 없습니다');
    else if (Number(stamp[1]) !== BOARD_CONTRACT) {
      bad.push(`assets/board-template.html은 계약 ${stamp[1]}을 표기하는데 BOARD_CONTRACT는 ${BOARD_CONTRACT}입니다`);
    }
  } else {
    unread.push('assets/board-template.html');
  }
  return { bad, unread };
}

/** Whatever a module exports that IS a gate rather than a helper. */
const gateShaped = (module) => Object.values(module)
  .filter((v) => v && typeof v === 'object' && typeof v.run === 'function' && typeof v.id === 'string');

/**
 * A gate written and never registered, so nothing ever runs it.
 *
 * <p><b>The order of `CORE_GATES` is load-bearing, so that list stays hand-written</b> - cheapest
 * refusals first, and the three that read the rendered HTML last. The cost of writing it by hand
 * is exactly this defect: a gate added to `markup.mjs` and not added to the array is in the
 * repository, greppable, and reached by nothing. Somebody finds it, reads the rule as held, and
 * has no reason to look further.
 *
 * <p><b>It is asked here rather than as a gate of its own</b>, beside 「a gate with no case」 -
 * the same question from the other side, about the same set, answered in the one command anybody
 * runs after writing a gate. The pattern's own list is derived from its module rather than
 * written out, so nothing there can fall off; this scan covers it anyway, because the next
 * pattern may not be.
 *
 * @param registered the gates this run will execute
 * @param patternDir the pattern's directory
 * @returns the ids of gates nothing reaches, each with the file that declares it
 */
async function unreached(registered, patternDir) {
  const held = new Set(registered.map((g) => g.id));
  const folders = [join(HERE, '../gates'), join(patternDir, 'gates')];
  const found = [];
  for (const folder of folders) {
    if (!existsSync(folder)) continue;
    for (const file of readdirSync(folder)) {
      if (!file.endsWith('.mjs') || file === 'index.mjs' || file === 'cases.mjs' || file === 'util.mjs') continue;
      const module = await import(pathToFileURL(join(folder, file)).href);
      for (const gate of gateShaped(module)) {
        if (!held.has(gate.id)) found.push(`${gate.id} (${file})`);
      }
    }
  }
  return found;
}

export async function runGateTests(boardDir) {
  const ctx = await loadBoard(boardDir, { screens: false });
  const gates = gatesFor(ctx);

  const collected = [];
  const builders = makeBuilders(ctx.config);
  const t = { ...builders, add: (gate, name, c, shouldFire) => collected.push({ gate, name, ctx: c, shouldFire }) };

  coreCases(t);
  const patternCases = join(ctx.patternDir, 'gates/cases.mjs');
  if (existsSync(patternCases)) (await import(pathToFileURL(patternCases).href)).cases(t);
  if (ctx.projectGates?.cases) ctx.projectGates.cases(t);

  const bad = await runCases(collected, gates);
  builders.cleanup();

  const missing = untested(collected, gates);
  if (missing.length) {
    console.log(`\n시험이 없는 게이트 ${missing.length}개 — ${missing.join(', ')}`);
    console.log('게이트를 더할 때 걸려야 할 경우와 걸리면 안 되는 경우를 같은 변경에 함께 적는다.');
  }
  const orphans = await unreached(gates, ctx.patternDir);
  if (orphans.length) {
    console.log(`\n어느 목록에도 없는 게이트 ${orphans.length}개 — ${orphans.join(', ')}`);
    console.log('저장소에 있고 아무것도 실행하지 않습니다 — 찾아본 사람은 규칙이 지켜진다고 읽습니다.');
    console.log('CORE_GATES(kit/core/gates/index.mjs)나 패턴의 gates에 넣습니다.');
  }
  const copies = contractCopies();
  if (copies.bad.length) {
    console.log(`\n계약 번호의 사본이 BOARD_CONTRACT와 다릅니다: ${copies.bad.join(' · ')}`);
    console.log('BOARD_CONTRACT를 올리는 변경에서 마이그레이션 항목과 템플릿 표기를 함께 고칩니다.');
  }
  if (copies.unread.length) console.log(`\n계약 표기를 대조하지 못한 사본: ${copies.unread.join(', ')}`);
  console.log(bad ? `\n${bad}건 실패` : `\n${collected.length}건 모두 통과`);
  return bad === 0 && missing.length === 0 && orphans.length === 0 && copies.bad.length === 0;
}
