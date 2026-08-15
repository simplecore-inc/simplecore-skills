// B-02 · The same screen with the create form in the panel. A state, not a page: the reader
// never loses the list, the filter or the scroll position, and the form is as wide as the panel.
import { console_ } from '../chrome.mjs';
import { panelHead, panelFoot, btn, formGrid, fText, fSelect } from '../components.mjs';
import base, { screenBody } from './b-01-record-list.mjs';

const form =
  panelHead('새 기록') +
  formGrid(
    fText({ label: '제목', value: '', required: true, wide: true }) +
    fSelect({ label: '분류', value: '일반', required: true }) +
    fSelect({ label: '담당', value: '(선택)' }) +
    fText({ label: '기한', value: '2026-08-31' })) +
  // A form has no tab verbs, so it has one tier. The escape sits away from the primary on
  // purpose, so a slip does not land on it.
  panelFoot(btn('작성 취소', 'ghost') + '<span class="spacer"></span>' + btn('저장', 'primary'));

export default {
  ...base,
  state: '새로 만들기',
  notes: 'AUTH: 세션 · 조직 스코프<br>DATA: POST /records<br>' +
    '<strong>「추가」가 여는 것은 다이얼로그가 아니라 이 패널이다.</strong> 저장이 목록에 보이는 행을 쓰면 패널 상태이고, 그 행에 딸린 것을 쓰거나 확인만 받으면 다이얼로그다.<br>' +
    '필수 표시가 붙은 두 칸이 비면 저장이 잠긴다.',
  body: console_({ tab: '기록', current: '기록 목록', main: screenBody(form) }),
};
