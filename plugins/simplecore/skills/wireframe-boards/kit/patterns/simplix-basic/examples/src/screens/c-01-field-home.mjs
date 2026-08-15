// C-01 · The field app's home. A phone, offline-first: the strip under the app bar is ALWAYS
// there rather than only when something fails, because a record signed offline looks exactly as
// finished as one the server has, and somebody who cannot tell them apart has no reason to walk
// back into range before the shift ends.
import { worker_ } from '../chrome.mjs';
import { tTitle, tSub, listCard, msg, btn, bar, badge } from '../components.mjs';

export default {
  device: 'phone',
  route: '/m', screen: '현장 앱 — 오늘', state: '오프라인 · 대기 2건',
  notes: 'AUTH: 세션 · 개인 스코프<br>DATA: GET /m/today (캐시 우선)<br>' +
    '<strong>저장 위치와 동기화 대기 건수를 상시 표시한다.</strong> 오프라인에서 만든 기록과 서버가 받은 기록이 화면에서 같아 보이면, 그 기록이 단말 한 대에 갇힌 것을 아무도 모른다.<br>' +
    '<strong>셸은 앱의 말을 쓴다</strong> — 본문이 다른 언어면 `lang`을 넘겨 탭 줄과 오프라인 줄이 함께 그 언어로 그려지게 한다.',
  body: worker_({
    title: '오늘', tab: '오늘', queued: 2, offline: true,
    body:
      msg({ kind: 'warn', title: '기기에만 저장된 기록이 2건 있습니다', body: '통신이 닿으면 자동으로 올라갑니다.' }) +
      tTitle('오늘 할 일') +
      tSub('3건') +
      listCard({ lines: `${bar('w80')}${bar('w40', true)}`, trail: badge('대기') }) +
      listCard({ lines: `${bar('w60')}${bar('w25', true)}`, trail: badge('대기') }) +
      listCard({ lines: `${bar('w100')}${bar('w40', true)}`, trail: badge('완료', 'ok') }),
    action: btn('새 기록', 'primary'),
  }),
};
