// D-01 · The shared terminal, waiting. It carries no navigation and no account: whoever stands
// in front of it identifies themselves, does one thing, and the screen returns to this.
import { kiosk_ } from '../chrome.mjs';
import { tTitle, tSub, qrBlock, btn, btnRow } from '../components.mjs';

export default {
  device: 'tablet',
  route: '/kiosk', screen: '공용 단말 — 대기', state: '기본',
  notes: 'AUTH: 단말 등록 · 개인 세션 없음<br>DATA: GET /kiosk/state<br>' +
    '<strong>대기 화면은 무엇을 하는 단말인지부터 말한다.</strong> 처음 서는 사람에게는 이 화면이 설명서 전부다.<br>' +
    '한 번에 한 가지 일만 하고 이 화면으로 돌아온다 — 앞사람의 흔적이 남으면 그것이 개인정보 유출이다.',
  body: kiosk_({
    terminal: 'KIOSK-01', site: '본사',
    body:
      tTitle('사원증을 대 주세요') +
      tSub('출입 기록이 남습니다') +
      qrBlock({ label: '식별 QR', caption: '앱의 QR을 대도 됩니다', children: '' }) +
      btnRow(btn('도움 요청')),
  }),
};
