// A-01 · The first screen anyone sees. It has to work before the product knows anything about
// who is looking at it — including which language they read.
import { auth_ } from '../chrome.mjs';
import { fText, btn, btnRow, msg, divider, formGrid } from '../components.mjs';

export default {
  device: 'desktop', url: 'app.example.com/login', fold: '1440×900',
  route: '/login', screen: '로그인', state: '기본',
  notes: 'AUTH: 없음<br>DATA: POST /auth/login<br>' +
    '<strong>언어 전환이 이 화면에 있다.</strong> 초대 링크로 처음 들어오는 곳이고, 그때 제품은 그 사람이 누구인지 아직 모른다.<br>' +
    '<strong>실패 문구에 무엇이 틀렸는지 표시하지 않는다</strong> — 어느 쪽이 맞았는지 알려 주면 계정이 있는지를 확인해 주는 셈이다.',
  body: auth_({
    title: '로그인',
    description: 'PRODUCT',
    body:
      formGrid(
        fText({ label: '아이디', value: '', wide: true }) +
        fText({ label: '비밀번호', value: '', wide: true })) +
      btnRow(btn('로그인', 'primary')) +
      divider() +
      msg({ kind: 'error', title: '아이디 또는 비밀번호가 올바르지 않습니다', body: '5회 더 틀리면 10분간 잠깁니다.' }),
    foot: '<span>비밀번호 재설정</span><span class="spacer"></span><span>초대를 받으셨나요?</span>',
  }),
};
