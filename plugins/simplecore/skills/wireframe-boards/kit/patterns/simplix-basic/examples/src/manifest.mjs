// The table of contents and the build order.
//
// **This is what to read first** to find a screen: the file name carries the permanent id, so
// `B-01` is `b-01-record-list.mjs` and nothing else has to be searched.
//
// A section is a user flow or a feature area, lettered. `count` overrides the caption the build
// computes; leave it out and the build says how many screens and frames the section holds.
export default [
  {
    letter: 'A',
    title: '들어가기 · 대시보드',
    screens: [
      { file: 'a-01-sign-in', label: '로그인' },
      { file: 'a-02-dashboard', label: '내 대시보드' },
    ],
  },
  {
    letter: 'B',
    title: '기록 — 목록·상세',
    screens: [
      // The closed panel and the open one are two frames of ONE screen, drawn adjacent so a
      // reader meets the ordinary page before the state.
      { file: 'b-01-record-list', label: '기록 목록 (상세 패널)' },
      { file: 'b-02-record-list-new', label: '기록 목록 — 새로 만들기 (패널 상태)' },
      { file: 'b-03-record-list-empty', label: '기록 목록 — 비어 있음' },
    ],
  },
  {
    letter: 'C',
    title: '현장 앱 (폰)',
    screens: [
      { file: 'c-01-field-home', label: '오늘 — 오프라인' },
      { file: 'c-02-field-form', label: '새 기록 — 필수 미입력' },
    ],
  },
  {
    letter: 'D',
    title: '공용 단말 (태블릿)',
    screens: [
      { file: 'd-01-terminal-idle', label: '대기' },
      { file: 'd-02-terminal-done', label: '확인됨' },
    ],
  },
];
