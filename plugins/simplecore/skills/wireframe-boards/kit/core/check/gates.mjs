// Feed each gate the defect it exists to catch, then feed it a clean board. A gate that stays
// quiet on the first, or fires on the second, is a gate that no longer works — and a build whose
// gates have gone quiet looks exactly like a board with nothing wrong with it.
//
//   node wf.mjs gates
//
// The cases come from the same three places the gates do, so a pattern's gates are tested by the
// pattern's cases and a board's by its own. A gate with no case at all is named at the end: that
// is the state every gate decays into, and it is invisible from the build.
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadBoard } from '../context.mjs';
import { gatesFor } from '../gates/index.mjs';
import { makeBuilders, runCases, untested } from './harness.mjs';
import { cases as coreCases } from './cases.mjs';

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
  console.log(bad ? `\n${bad}건 실패` : `\n${collected.length}건 모두 통과`);
  return bad === 0 && missing.length === 0;
}
