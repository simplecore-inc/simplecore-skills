// A board split along a declared axis: every frame it draws is placed, and every declared part
// is drawn.
//
// **The failure this catches empties a file in silence.** The axis is answered by a module the
// board points at, and that module is maintained beside the board rather than by it — a frame
// added to the manifest and not to the placer answers `null`, which is a perfectly ordinary
// answer, and the frame then lands in whichever file the fallback puts it in without anything
// being wrong anywhere. Nothing in the artifact says so: the file renders, the index is complete
// for what it holds, and the reader looking for that frame simply does not find it where they
// expected. The same shape the other way round — a declared part no frame answers with — writes
// a file with an empty index and a nav entry promising screens that are not there.

/** Every frame the board draws is placed by the declared axis, and no part comes out empty. */
export const splitPlacementGate = {
  id: 'splitPlacementGate',
  title: '선언된 축이 프레임을 놓지 못한다',
  stage: 'preflight',
  run: (ctx) => {
    const split = ctx.split;
    if (!split) return [];
    const findings = [];
    const seen = new Set();
    const held = new Set();
    for (const sec of ctx.sections ?? []) {
      for (const e of sec.entries ?? []) {
        if (!e.id || seen.has(e.id)) continue;
        seen.add(e.id);
        const key = split.partOf(e.id);
        if (key === null) {
          findings.push(`${e.id} — 어느 부분에도 놓이지 않았다 (split.module이 답하지 않는다)`);
          continue;
        }
        if (!split.partFor(key)) {
          findings.push(`${e.id} — split.parts에 없는 '${key}'에 놓였다`);
          continue;
        }
        held.add(key);
      }
    }
    // Only where the board draws anything at all: a board being started has an empty manifest and
    // every part is legitimately empty until the first screen is written.
    if (seen.size) {
      for (const part of split.parts) {
        if (!held.has(part.key)) findings.push(`'${part.key}' 부분에 프레임이 하나도 없다 — ${part.file}이 빈 채로 나간다`);
      }
    }
    return findings;
  },
};
