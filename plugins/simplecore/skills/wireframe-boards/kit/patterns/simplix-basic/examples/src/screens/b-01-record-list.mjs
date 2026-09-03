// B-01 · The standard page of this pattern: a list, and the record beside it in a panel where
// adding and editing happen. The closed panel and the open one are TWO FRAMES of ONE screen, so
// they share one drawing — `screenBody(panel)` below is what the state frames call.
import { console_ } from '../chrome.mjs';
import {
  pageHeader, filterBar, table, th, btn, badge, rowActions, pagination, listDetail,
  panelHead, panelFoot, panelVerbs, dField, sectHead, helpCard,
} from '../components.mjs';

// The list beside a panel is drawn for what is left after it — three columns at most. A time and
// an owner ride the title cell as a `mono` sub-line rather than taking columns of their own.
// **A row's action count is not capped**; what is capped is the COLUMNS.
const row = (id, when, who, state, tone) => [
  `<span class="td w2">${id} <span class="mono faint">${when} · ${who}</span></span>`,
  `<span class="td fix">${badge(state, tone)}</span>`,
  `<span class="td fix">${rowActions(['보기', '편집', { label: '삭제', disabled: true }])}</span>`,
];

const rows = [
  row('REC-1042', '2026-08-12', '김담당', '검토 대기', 'warn'),
  row('REC-1041', '2026-08-11', '이담당', '완료', 'ok'),
  row('REC-1039', '2026-08-09', '박담당', '기한 지남', 'bad'),
  row('REC-1038', '2026-08-08', '김담당', '초안', ''),
];

/** The list column. Drawn once and shared by every state of this screen. */
export const list =
  filterBar({ total: '214건', applied: [{ k: '상태', op: '=', v: '검토 대기' }], hidden: 2 }) +
  table({ head: [th('기록', { w: 'w2' }), th('상태', { w: 'fix' }), th('', { w: 'fix' })], rows }) +
  pagination(['1', '2', '…', '22'], '214', 10) +
  // A reference block about the whole list rides the tail of the LIST column, never the page.
  helpCard({ title: '상태는 어떻게 옮겨 가는가', hint: '초안 · 검토 대기 · 완료 · 기한 지남' });

/** The panel: enough to tell whether this is the row you wanted, plus its verbs. */
export const detail =
  panelHead('REC-1042') +
  dField({ label: '상태', value: '검토 대기' }) +
  dField({ label: '담당', value: '김담당' }) +
  dField({ label: '기한', value: '2026-08-20' }) +
  dField({ label: '분류', value: '일반', wide: true }) +
  sectHead('이 기록의 진행') +
  dField({ label: '만든 날', value: '2026-08-12 09:14', wide: true }) +
  // Upper tier: what the open tab asks for. Lower tier: what is done to the record. Switching
  // tabs changes the first and leaves the second alone, and the rule between them says so.
  panelVerbs(btn('이력 보기') + btn('복제')) +
  panelFoot(btn('닫기') + '<span class="spacer"></span>' + btn('삭제', 'danger') + btn('편집', 'primary'));

/**
 * The page, with whatever is in the detail region.
 *
 * <p>**The list-detail region is the LAST thing on the page.** The panel is a full-height column
 * whose footer is pinned to the floor, so a block appended after the two columns lands under a
 * panel that has already ended.
 */
export const screenBody = (panel = detail) =>
  pageHeader({ title: '기록', description: '조직이 다루는 기록 전부', actions: btn('추가', 'primary') }) +
  listDetail(list, panel);

export default {
  device: 'desktop', url: 'app.example.com/records', fold: '1440×900',
  route: '/records', screen: '기록 목록', state: '상세 패널 열림',
  notes: 'AUTH: 세션 · 조직 스코프<br>DATA: GET /records<br>' +
    '<strong>추가와 편집은 이 패널에서 열린다</strong> — 목록을 떠나면 필터와 스크롤 위치를 잃는다({{b-02-record-list-new}}).<br>' +
    '패널 옆 목록은 세 열까지다. 시간·담당은 제목 칸의 보조 줄로 태운다.<br>' +
    '여기서 여는 화면: 새로 만들기({{b-02-record-list-new}}) · 비어 있음({{b-03-record-list-empty}}).',
  body: console_({ tab: '기록', current: '기록 목록', main: screenBody() }),
};
