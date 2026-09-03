// Coverage gate: refuse the build until every cluster the screen design names has been drawn, so
// a half-built board can never replace the one people review.
//
// Which clusters are required is a fact about THIS board, so it lives in `board.config.mjs`.
//
// **A board that declares no required cluster is not judged, empty manifest included.** That is
// the state `/simplecore:board-init --no-examples` leaves behind and the state
// `requiredSections: []` documents — the screens are about to be authored from a specification,
// and the board has to build before the first of them exists or nobody can prove the scaffold
// works. Refusing it made `init` contradict itself: it writes an empty manifest so the board
// «still has to build», and this gate then refused every build until a frame was drawn.
export const sectionCoverageGate = {
  id: 'sectionCoverageGate',
  title: '아직 그리지 않은 클러스터가 있다',
  stage: 'built',
  run: (ctx) => {
    const required = ctx.config.requiredSections ?? [];
    if (!required.length) return [];
    if (!ctx.manifest.length) return [`manifest is empty — sections required: ${required.join(', ')}`];
    const present = new Set(ctx.manifest.map((s) => s.letter));
    const missing = required.filter((l) => !present.has(l));
    return missing.length ? [`sections not present: ${missing.join(', ')}`] : [];
  },
};
