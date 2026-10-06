// A board split along a declared axis: every frame it draws is placed, and every declared part
// is drawn.
//
// **The failure this catches empties a file in silence.** The axis is answered by a module the
// board points at, and that module is maintained beside the board rather than by it - a frame
// added to the manifest and not to the placer answers `null`, which is a perfectly ordinary
// answer, and the frame then lands in whichever file the fallback puts it in without anything
// being wrong anywhere. Nothing in the artifact says so: the file renders, the index is complete
// for what it holds, and the reader looking for that frame simply does not find it where they
// expected. The same shape the other way round - a declared part no frame answers with - writes
// a file with an empty index and a nav entry promising screens that are not there.

/** Every frame the board draws is placed by the declared axis, and no part comes out empty. */
export const splitPlacementGate = {
  id: 'splitPlacementGate',
  title: 'the declared axis does not place every frame',
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
          findings.push(`${e.id} - placed in no part (split.module gives no answer)`);
          continue;
        }
        if (!split.partFor(key)) {
          findings.push(`${e.id} - placed in '${key}', which split.parts does not declare`);
          continue;
        }
        held.add(key);
      }
    }
    // Only where the board draws anything at all: a board being started has an empty manifest and
    // every part is legitimately empty until the first screen is written.
    if (seen.size) {
      for (const part of split.parts) {
        if (!held.has(part.key)) findings.push(`part '${part.key}' holds no frame - ${part.file} goes out empty`);
      }
    }
    return findings;
  },
};
