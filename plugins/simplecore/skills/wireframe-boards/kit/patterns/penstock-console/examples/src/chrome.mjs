// <PRODUCT>'s words for the penstock-console shell. `makeChrome` binds them once; every screen
// imports the bound chrome through `../components.mjs`.
import { makeChrome } from '../.kit/patterns/penstock-console/chrome.mjs';

/** The navigator tree. A group opens a block of rows; `navPane('항목')` names the active one. */
export const NAV = [
  { group: '작업', items: ['홈', '항목 목록', '처리 상황'] },
  { group: '설정', items: ['일반', '사람과 권한', '알림'] },
];

export const { navPane, titlebar, askTitlebar, activityPane, inspPane, appShell, cmdPalette, cmark } = makeChrome({
  brand: '<PRODUCT>',
  nav: NAV,
  project: '기본 프로젝트',
  palette: { label: '명령 팔레트', query: '항목 만들기' },
  status: { left: [{ t: '<span class="dot"></span>연결됨' }], right: '갱신 방금' },
  activity: [
    { when: '방금', text: '항목 3건 처리 완료' },
    { when: '2분 전', text: '설정 저장' },
  ],
});
