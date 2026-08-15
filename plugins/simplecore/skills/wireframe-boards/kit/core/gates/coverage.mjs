// Coverage gate: refuse the build until every cluster the screen design names has been drawn, so
// a half-built board can never replace the one people review.
//
// Which clusters are required is a fact about THIS board, so it lives in `board.config.mjs`.
export const sectionCoverageGate = {
  id: 'sectionCoverageGate',
  title: '아직 그리지 않은 클러스터가 있다',
  stage: 'built',
  run: (ctx) => {
    if (!ctx.manifest.length) return ['manifest is empty'];
    const present = new Set(ctx.manifest.map((s) => s.letter));
    const missing = (ctx.config.requiredSections ?? []).filter((l) => !present.has(l));
    return missing.length ? [`sections not present: ${missing.join(', ')}`] : [];
  },
};
