// Every gate the build runs, and the runner that reports them.
//
// A gate is `{ id, title, stage, run(ctx) → string[] }`. It finds and describes; it never prints
// and never exits, so a gate can be run from anywhere and its findings counted.
//
//   stage 'preflight' — runs before the board is rendered (the render itself depends on it)
//   stage 'built'     — runs on the finished board
//
// **Every finding refuses the build.** There used to be a second, lenient mode writing a second
// file — the idea being that work in progress should still be previewable — and it earned nothing:
// the two files came out byte-identical, so the only thing the split produced was a stale copy of
// the board sitting beside the real one for anything that read the wrong name. A gate worth
// writing is worth obeying now, and the board is drawn by fixing what a gate says rather than by
// looking at a build that was allowed to keep the defect.
//
// **The gates come from three places, and which place a gate belongs in is the design decision.**
//
//   core     — true of any board: the permanent id, balanced markup, a value leaked as text,
//              whether a frame can be reached, whether a declared document agrees with the board
//   pattern  — true of every board drawn in that pattern: the register its copy is written in,
//              the list-detail discipline, the vocabulary its controls share
//   board    — true of this product only: a gate that parses a document format this project
//              chose, or knows this product's own data shapes. `board.gates.mjs`
//
// A gate put one level too high fires on boards it does not describe; one level too low is
// rewritten by the next project that needs it. When in doubt, ask whether it would still be
// right on somebody else's board — that is the whole test.
//
// ctx carries: boardDir · patternDir · config · pattern · components · roles · crud · styles ·
//              intro · partials · manifest · sections · screens · loaded · byId · srcOf(file) ·
//              componentsSrc · html
import { idGate, slugGate, refTailGate, refNumGate, pairGate } from './numbering.mjs';
import { overlayGate, optionKeyGate, dupKeyGate, deadImportGate, slotGate, panelFormStateGate, classlessGate, structureGate, leakedValueGate } from './markup.mjs';
import {
  crudGate, viewSwitchGate, reachabilityGate, targetGate, landingIsAddressableGate, landingIsTheListGate,
  controlVocabularyGate, panelVerbGate, backControlGate,
} from './navigation.mjs';
import { sectionCoverageGate } from './coverage.mjs';
import { splitPlacementGate } from './split.mjs';
import { chromeStyledGate } from './chrome.mjs';
import { frameManifestGate, parityListGate, roadmapPlacementGate, docFrameRefGate, docLinkGate, docRegistryGate, roleDocGate, featureKeyDocGate } from './documents.mjs';

/**
 * The gates that hold on every board, whatever it draws and whatever pattern it is in.
 *
 * <p>Ordered so the cheapest and most fundamental refusals come first: a board whose numbering is
 * broken has nothing worth saying about its content.
 */
export const CORE_GATES = [
  idGate,
  sectionCoverageGate,
  splitPlacementGate,
  slugGate,
  refTailGate,
  refNumGate,
  pairGate,
  overlayGate,
  slotGate,
  panelFormStateGate,
  optionKeyGate,
  dupKeyGate,
  deadImportGate,
  crudGate,
  viewSwitchGate,
  reachabilityGate,
  targetGate,
  landingIsAddressableGate,
  landingIsTheListGate,
  controlVocabularyGate,
  panelVerbGate,
  backControlGate,
  frameManifestGate,
  parityListGate,
  roadmapPlacementGate,
  docFrameRefGate,
  docLinkGate,
  docRegistryGate,
  roleDocGate,
  featureKeyDocGate,
  // The kit's own chrome, styled by the kit. Reads the assembled stylesheet rather than a screen,
  // so it is the one gate whose subject is the board's frame instead of what is inside it.
  chromeStyledGate,
  // Structural last: they read the rendered HTML, so they are the only two that need the board
  // to have been drawn already, and a finding here is about the drawing rather than the source.
  classlessGate,
  structureGate,
  leakedValueGate,
];

/**
 * Every gate this board runs: the core, then its pattern's, then its own.
 *
 * <p>Later entries never replace earlier ones — a pattern cannot switch off a core gate and a
 * board cannot switch off its pattern's. What a board disagrees with, it changes; a gate that
 * can be turned off is a gate that will be, on the build where it was inconvenient.
 */
export function gatesFor(ctx) {
  return [
    ...CORE_GATES,
    ...(ctx.pattern?.gates ?? []),
    ...(ctx.projectGates?.GATES ?? []),
  ];
}

/**
 * Run the gates of one stage. Anything found stops the build.
 *
 * <p>Async because a gate may need to import the board's own data rather than re-derive it. A
 * synchronous runner would take the promise, find no `.length`, and skip the gate in silence —
 * which looks exactly like a gate that found nothing.
 */
export async function runGates(ctx, stage) {
  let fatal = 0;
  for (const gate of gatesFor(ctx)) {
    if ((gate.stage ?? 'built') !== stage) continue;
    const messages = (await gate.run(ctx)) ?? [];
    if (!messages.length) continue;
    console.error(`refusing to build — ${gate.title}:\n  ${[...new Set(messages)].join('\n  ')}`);
    fatal += 1;
  }
  if (fatal) process.exit(1);
}
