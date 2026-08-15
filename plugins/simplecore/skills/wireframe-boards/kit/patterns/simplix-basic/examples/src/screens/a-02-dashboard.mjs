// A-02 · Where a signed-in reader lands. What earns a place here is what somebody ACTS on today;
// a figure that merely describes the data belongs behind 「그림 보기」.
import { console_ } from '../chrome.mjs';
import { pageHeader, grid, statTile, msg, table, th, btn, badge, rowActions, section } from '../components.mjs';

export default {
  device: 'desktop', url: 'app.example.com/', fold: '1440×900',
  route: '/', screen: '내 대시보드', state: '기본',
  notes: 'AUTH: 세션 · 조직 스코프<br>DATA: GET /me/dashboard<br>' +
    '<strong>타일은 지금 참인 수만 싣는다.</strong> 추세가 있는 값에만 스파크라인이 붙고, 지금의 개수를 세는 타일에는 붙지 않는다.<br>' +
    '여기서 여는 화면: 기록 목록({{b-01-record-list}}).',
  body: console_({
    tab: '대시보드', current: '내 대시보드',
    main:
      pageHeader({ title: '내 대시보드', description: '오늘 처리할 것' }) +
      grid(4, [
        // A tile carries a plot only where a series exists; a count of what is true NOW gets none.
        statTile({ label: '검토 대기', value: '12', unit: '건', tone: 'warn' }),
        statTile({ label: '기한 지남', value: '3', unit: '건', tone: 'bad' }),
        statTile({ label: '이번 주 완료', value: '48', unit: '건', trend: '+6', spark: '1' }),
        statTile({ label: '담당 없음', value: '2', unit: '건' }),
      ]) +
      msg({ kind: 'warn', title: '기한이 지난 기록이 3건 있습니다', body: '담당자가 지정되지 않은 2건이 그중 하나입니다.',
        actions: btn('그 3건 보기') }) +
      section('최근 움직임',
        table({
          head: [th('기록', { w: 'w2' }), th('상태', { w: 'fix' }), th('', { w: 'fix' })],
          rows: [
            ['<span class="td w2">REC-1042 <span class="mono faint">어제 17:20 · 김담당</span></span>',
              `<span class="td fix">${badge('검토 대기', 'warn')}</span>`,
              `<span class="td fix">${rowActions(['보기'])}</span>`],
            ['<span class="td w2">REC-1041 <span class="mono faint">어제 16:04 · 이담당</span></span>',
              `<span class="td fix">${badge('완료', 'ok')}</span>`,
              `<span class="td fix">${rowActions(['보기'])}</span>`],
            ['<span class="td w2">REC-1039 <span class="mono faint">그제 09:11 · 박담당</span></span>',
              `<span class="td fix">${badge('기한 지남', 'bad')}</span>`,
              `<span class="td fix">${rowActions(['보기'])}</span>`],
          ],
        })),
  }),
};
