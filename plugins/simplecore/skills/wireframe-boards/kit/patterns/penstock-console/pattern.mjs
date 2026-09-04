// penstock-console — the application-window pattern: a fixed window whose panes scroll inside
// themselves, drawn with the penstock console's shell (title bar · navigator · work pane ·
// inspector · status bar). For a product that is an APP — installed, or running in a browser as
// one — rather than a page-scrolling site. The same pattern draws the installed program's own
// window (`url: 'app:<title>'`) and its tray menu (`url: 'none:'`).
//
// It was promoted out of the RAG Studio board, where it was drawn first; every product-bound piece
// (brand, navigation tree, palette, status bar, sample activity) comes from the board's
// `src/chrome.mjs` through `makeChrome`, so a second product shares the shell without sharing the
// words.
export default {
  name: 'penstock-console',
  title: 'penstock 콘솔 셸 — 고정 창의 앱',
  description:
    '타이틀바 · 탐색 · 작업 · 검사 · 상태바로 짜인 고정 창(1440×900)을 그린다. 페이지가 아니라 패널이 스크롤하는 ' +
    '앱 — 설치형 프로그램의 창과 트레이 메뉴, 브라우저에서 도는 앱을 한 패턴으로 그린다.',

  /** The device classes this pattern draws. One: a desktop window. */
  devices: { desktop: '1440×900 고정 창 — 타이틀바 · 탐색 · 작업 · 검사 · 상태바, 패널 안 스크롤' },

  /**
   * The gates every board in this pattern runs, on top of the kit's core gates.
   *
   * <p>Empty to begin with, and that is honest rather than finished: the core gates already hold
   * the permanent id, balanced markup, reachability and the documents. A rule true of every frame
   * drawn THIS way — a copy register, a layout discipline, a control vocabulary — belongs here,
   * and each one added is a defect that cannot come back.
   */
  gates: [],

  requires: {
    'src/chrome.mjs': '이 보드의 브랜드 · 탐색 트리 · 팔레트 · 상태바 · 활동 예시를 makeChrome에 넘기는 파일',
    'src/manifest.mjs': '차례 — 섹션과 그 안의 화면 순서',
    'src/screens/': '화면 하나에 파일 하나',
  },
  optional: {
    'src/intro.html': '이 제품만의 읽기 규약 항목 — 패턴의 규약 뒤에 덧붙는다',
    'src/styles.css': '이 보드가 더한 클래스 — 패턴 스타일시트 뒤에 덧붙는다',
    'board.gates.mjs': '이 제품의 문서 형식에 맞춘 게이트',
  },
};
