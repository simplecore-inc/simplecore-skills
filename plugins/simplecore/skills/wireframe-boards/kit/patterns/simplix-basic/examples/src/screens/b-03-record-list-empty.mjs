// B-03 · The empty list. Drawn as its own frame because it is the screen most readers meet first
// and the one a happy-path board never shows.
import { console_ } from '../chrome.mjs';
import { pageHeader, listDetail, filterBar, emptyState, btn } from '../components.mjs';

export default {
  device: 'desktop', url: 'app.example.com/records', fold: '1440×900',
  route: '/records', screen: '기록 목록', state: '비어 있음',
  notes: 'AUTH: 세션 · 조직 스코프<br>DATA: GET /records → 0건<br>' +
    '<strong>빈 목록은 다음 동작을 말한다.</strong> 「없습니다」로 끝나면 읽는 사람이 할 일을 스스로 찾아야 한다.<br>' +
    '필터가 걸려 0건인 것과 아직 하나도 없는 것은 다른 화면이다 — 여기는 뒤쪽이다.',
  body: console_({
    tab: '기록', current: '기록 목록',
    main:
      pageHeader({ title: '기록', description: '조직이 다루는 기록 전부', actions: btn('추가', 'primary') }) +
      listDetail(
        filterBar({ total: '0건', applied: [], hidden: 0 }) +
        emptyState({ title: '아직 기록이 없습니다', body: '첫 기록을 만들면 여기에 표시합니다.', action: btn('추가', 'primary') }),
        ''),
  }),
};
