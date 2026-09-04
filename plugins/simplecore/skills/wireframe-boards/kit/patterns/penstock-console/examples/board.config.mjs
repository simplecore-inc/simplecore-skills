// The starter board `/simplecore:board-init` copies for a penstock-console product. One frame, the
// console home, so the shell is on screen from the first build.
export default {
  pattern: 'penstock-console',
  contract: 4,
  boardLang: 'ko',

  headline: '<PRODUCT> — 전 화면 와이어프레임',
  boardName: '<PRODUCT>',
  tag: 'WIREFRAME v0.1 · LO-FI · 창 1440×900',
  pdfName: '<product>-wireframe',

  // A window has one width, so a narrow/wide pair never occurs here.
  viewportPairs: 'stacked',

  requiredSections: [],
  phases: {},
  today: '2026-01-01',
  features: {},
};
