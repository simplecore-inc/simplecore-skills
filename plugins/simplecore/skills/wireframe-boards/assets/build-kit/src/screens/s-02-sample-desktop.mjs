// S-02 · Desktop screen composed from components — shows the desktop chrome family
// (browser bar + app shell) that the same kit produces. frame() adds the browser bar
// and the fold; the body is shell(sidebarNav, main) composed from components.
import {
  shell, sidebarNav, topbar, crumb, toolbar, bodyCol, grid, card,
  table, pagination, bar, badge, btn, tSub, tTitle, divider,
} from '../components.mjs';

const sidebar = sidebarNav({
  brand: 'EXAMPLE',
  groups: [
    { group: 'WORK', items: [{ label: 'Console', active: true }, { label: 'Requests' }] },
    { group: 'INSIGHT', items: [{ label: 'Reports' }] },
  ],
});

const main =
  topbar({ right: tSub('Jane Doe') }) +
  crumb('Home / Console') +
  toolbar({ title: 'Console', actions: btn('Export', 'ghost') + btn('New request', 'primary') }) +
  bodyCol(
    grid(4, [
      card({ sub: 'Pending', body: bar('w25') }),
      card({ sub: 'In review', body: bar('w25') }),
      card({ sub: 'Approved', body: bar('w25') }),
      card({ sub: 'Rejected', body: bar('w25') }),
    ]) +
    table({
      head: ['<span class="td w2">REQUEST</span>', '<span class="td">OWNER</span>', '<span class="td fix">STATUS</span>'],
      rows: [
        ['<span class="td w2">' + bar('w80') + '</span>', '<span class="td">' + bar('w60', true) + '</span>', '<span class="td fix">' + badge('Open', 'outline') + '</span>'],
        ['<span class="td w2">' + bar('w60') + '</span>', '<span class="td">' + bar('w40', true) + '</span>', '<span class="td fix">' + badge('Done') + '</span>'],
      ],
    }) +
    pagination(['1', '2', '3'], '12')
  );

export default {
  device: 'desktop', url: 'app.example.com/console', fold: '1440×900',
  route: '/console', screen: 'Console', state: 'default',
  notes: 'AUTH: session<br>DATA: GET /requests (paged)<br>Desktop height is fluid; the dashed fold marks the smallest supported window.<br>The phone view of this flow is {{s-01-sample}} — write the FILE name in a note and the build prints the current number.',
  body: shell(sidebar, main),
};
