// D-02 · The terminal after one act. Drawn as its own frame because it is where the screen
// actually spends its attention — and because what it must NOT show is as specified as what it
// must: the next person is already standing there.
import { kiosk_ } from '../chrome.mjs';
import { tTitle, tSub, msg } from '../components.mjs';

export default {
  device: 'tablet',
  route: '/kiosk', screen: '공용 단말 — 확인됨', state: '3초 뒤 대기로',
  notes: 'AUTH: 단말 등록 · 개인 세션 없음<br>DATA: POST /kiosk/checkin<br>' +
    '<strong>이름과 시각만 보이고 그 밖의 개인정보는 보이지 않는다</strong> — 다음 사람이 이미 앞에 서 있다.<br>' +
    '<strong>3초 뒤 스스로 대기 화면으로 돌아간다.</strong> 닫는 버튼에 기대면 앞사람의 화면이 남는다.',
  body: kiosk_({
    terminal: 'KIOSK-01', site: '본사',
    segments: [{ label: '동기화 완료 09:41' }],
    body:
      msg({ kind: 'info', title: '확인되었습니다' }) +
      tTitle('김담당 님') +
      tSub('2026-08-14 09:41 · 본사'),
  }),
};
