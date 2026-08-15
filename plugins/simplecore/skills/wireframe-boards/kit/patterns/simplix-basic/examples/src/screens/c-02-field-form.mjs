// C-02 · Filling one thing in on a phone. The confirming verb sits in the fixed bar at the
// bottom because there is no page header to hang it on — that absence is exactly what tells the
// two cases apart.
import { worker_ } from '../chrome.mjs';
import { formGrid, fText, fSelect, fArea, btn, msg } from '../components.mjs';

export default {
  device: 'phone',
  route: '/m/records/new', screen: '현장 앱 — 새 기록', state: '필수 미입력',
  notes: 'AUTH: 세션 · 개인 스코프<br>DATA: POST /m/records<br>' +
    '<strong>오프라인에서도 제출은 완료로 보이되 「동기화 대기」로 표시한다.</strong><br>' +
    '터치 타깃은 최소 44px, 명암비 4.5:1 이상 — 장갑을 낀 손과 밝은 야외가 이 화면의 기본 조건이다.',
  body: worker_({
    title: '새 기록', back: true, tab: '등록', queued: 2, offline: true,
    body:
      formGrid(
        fSelect({ label: '분류', value: '(선택)', required: true, wide: true }) +
        fText({ label: '위치', value: '', required: true, wide: true }) +
        fArea({ label: '내용', value: '' })) +
      msg({ kind: 'error', title: '분류와 위치를 채워야 저장할 수 있습니다' }),
    action: btn('저장', 'primary'),
  }),
};
