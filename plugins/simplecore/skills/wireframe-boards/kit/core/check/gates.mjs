// Feed each gate the defect it exists to catch, then feed it a clean board. A gate that stays
// quiet on the first, or fires on the second, is a gate that no longer works — and a build whose
// gates have gone quiet looks exactly like a board with nothing wrong with it.
//
//   node wf.mjs gates
//
// The cases come from the same three places the gates do, so a pattern's gates are tested by the
// pattern's cases and a board's by its own. A gate with no case at all is named at the end: that
// is the state every gate decays into, and it is invisible from the build.
import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadBoard } from '../context.mjs';
import { gatesFor } from '../gates/index.mjs';
import { makeBuilders, runCases, untested } from './harness.mjs';
import { cases as coreCases } from './cases.mjs';

/** Whatever a module exports that IS a gate rather than a helper. */
const gateShaped = (module) => Object.values(module)
  .filter((v) => v && typeof v === 'object' && typeof v.run === 'function' && typeof v.id === 'string');

/**
 * A gate written and never registered, so nothing ever runs it.
 *
 * <p><b>The order of `CORE_GATES` is load-bearing, so that list stays hand-written</b> — cheapest
 * refusals first, and the three that read the rendered HTML last. The cost of writing it by hand
 * is exactly this defect: a gate added to `markup.mjs` and not added to the array is in the
 * repository, greppable, and reached by nothing. Somebody finds it, reads the rule as held, and
 * has no reason to look further.
 *
 * <p><b>It is asked here rather than as a gate of its own</b>, beside 「a gate with no case」 —
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
  const here = dirname(fileURLToPath(import.meta.url));
  const folders = [join(here, '../gates'), join(patternDir, 'gates')];
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
  console.log(bad ? `\n${bad}건 실패` : `\n${collected.length}건 모두 통과`);
  return bad === 0 && missing.length === 0 && orphans.length === 0;
}
