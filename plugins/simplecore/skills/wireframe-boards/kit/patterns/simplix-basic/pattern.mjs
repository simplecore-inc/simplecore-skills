// simplix-basic — the pattern a SimpliX-shaped admin product is drawn in.
//
// It covers all three device classes in one pattern on purpose. A console, the phone app its
// users carry, and the shared terminal in the lobby are one product: they share the components,
// the copy register, the control vocabulary and the CRUD discipline, and splitting them into
// separate patterns would mean deciding, for every gate, which of the three it belongs to —
// a boundary the product itself does not have.
//
//   desktop  console      list-detail over a three-layer shell
//   phone    worker · consolePhone
//   tablet   kiosk        a shared terminal with no session of its own
//   any      auth         the signed-out card
//
// **What is in the pattern and what is in the board.** The pattern owns everything that would be
// the same in a second product drawn this way: the primitives, the shells, the stylesheet, the
// standing reading contract, and the gates that hold the discipline. The board owns its own
// information architecture — the tab list, the menu tree, the roles, the CRUD ledger, what the
// installation bought — and hands them to the shell factories in its `src/chrome.mjs`.
import * as gates from './gates/content.mjs';

export default {
  name: 'simplix-basic',
  title: 'SimpliX 관리 콘솔 · 현장 앱 · 공용 단말',
  description:
    '목록–상세를 중심에 둔 관리 콘솔과, 같은 제품의 폰 앱·공용 단말·로그인 화면까지 한 벌로 그린다. ' +
    '업무용 소프트웨어의 화면 어휘와 한국어 문체를 게이트로 지킨다.',

  /** The device classes this pattern draws, and what each one is for. */
  devices: {
    desktop: '관리 콘솔 — 탭 · 섹션 메뉴 · 목록–상세 · 하단 상태 띠',
    phone: '현장 앱과 콘솔의 폰 폭 — 앱 바 · 본문 · 탭 바',
    tablet: '공용 단말 — 세션 없이 한 가지 일만 처리하고 대기 화면으로 돌아간다',
  },

  /**
   * The gates every board in this pattern runs, on top of the kit's core gates.
   *
   * <p>Every one of these came from a defect found twice. They are the pattern's rather than the
   * kit's because each judges something only a board drawn THIS way can be wrong about — a
   * register, a list-detail layout, the words its controls share.
   */
  gates: Object.values(gates).filter((g) => g && typeof g.run === 'function'),

  /**
   * What a board must supply for this pattern to draw. Read by `wf.mjs doctor`, which names the
   * missing piece instead of letting the board fail somewhere inside a render.
   */
  requires: {
    'src/chrome.mjs': '이 보드의 탭·메뉴 트리·역할·구매 상태를 셸 팩토리에 넘기는 파일',
    'src/manifest.mjs': '차례 — 섹션과 그 안의 화면 순서',
    'src/screens/': '화면 하나에 파일 하나',
  },
  optional: {
    'src/roles.mjs': '프레임마다 누가 접근하는지 — 없으면 역할 띠를 그리지 않는다',
    'src/crud.mjs': 'CRUD 대장 — 없으면 다섯 동사 점검을 돌리지 않는다',
    'src/intro.html': '이 제품만의 읽기 규약 항목 — 패턴의 규약 뒤에 덧붙는다',
    'src/styles.css': '이 보드가 더한 클래스 — 패턴 스타일시트 뒤에 덧붙는다',
    'board.gates.mjs': '이 제품의 문서 형식에 맞춘 게이트',
  },
};
