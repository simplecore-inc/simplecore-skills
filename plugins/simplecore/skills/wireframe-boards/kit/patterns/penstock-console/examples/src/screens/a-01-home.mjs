// A-01 · The console shell every screen of a penstock-console product reuses: title bar with
// breadcrumb and command palette, navigator, work pane, inspector (selection above, activity
// below), status bar. Draw over it — the words are placeholders, the shape is the contract.
import {
  appShell, titlebar, navPane, workPane, workToolbar, inspPane, grid, stat, banner, chips, chip,
  table, pagination, kv, tabs, badge, btn, bar, hint,
} from '../components.mjs';

const row = (name, state, variant) => [
  `<span class="td w2">${name}</span>`,
  `<span class="td fix">${badge(state, variant)}</span>`,
  `<span class="td fix right">${bar('w60', true)}</span>`,
];

const work = workPane({
  toolbar: workToolbar({ title: '항목', count: '12건', actions: btn('항목 만들기', 'primary') }),
  body:
    grid(3, [stat({ k: '전체', v: '12' }), stat({ k: '처리 중', v: '2' }), stat({ k: '실패', v: '1', hint: '확인 필요' })]) +
    banner({ dot: 'warn', text: '<b>항목 1건이 실패했습니다</b>', actions: btn('실패만 보기', 'sm') }) +
    chips([chip('전체', true), chip('처리 중'), chip('실패')]) +
    table({
      head: ['<span class="td w2">이름</span>', '<span class="td fix">상태</span>', '<span class="td fix right">갱신</span>'],
      rows: [row('첫 항목', '처리 중', 'outline'), row('둘째 항목', '완료', ''), row('셋째 항목', '실패', 'outline')],
    }) +
    pagination(['1', '2'], '12'),
});

const insp = inspPane({
  tabs: tabs([{ label: '요약', active: true }, { label: '이력' }]),
  body: `<div class="t-title">첫 항목</div>` + kv([['상태', '처리 중'], ['만든 사람', '홍길동'], ['만든 날', '2026-01-01']]) + hint('처리가 끝나면 결과를 여기에 표시합니다.'),
});

export default {
  device: 'desktop', url: 'app.example.com/home', fold: '1440×900',
  route: '/home', screen: '홈', state: '기본 · 항목 선택됨',
  notes:
    'AUTH: 세션<br>' +
    'DATA: GET /items (페이지 · 조건) · GET /items/tally (건수)<br>' +
    '검사 패널은 위아래 두 영역으로 나눈다 — 위는 선택한 항목의 탭, 아래는 활동을 시간순으로.',
  body: appShell({
    bar: titlebar('기본 프로젝트 / <b>홈</b>'),
    panes: navPane('홈', { '항목 목록': 12 }) + work + insp,
  }),
};
