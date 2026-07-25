// S-01 · Phone screen composed ENTIRELY from components — the onboarding reference.
// It writes no raw HTML tags of its own: every piece is a component call from
// ../components.mjs. A screen is a data object (device/route/screen/state/notes) plus
// a `body` built by composing components. New product screens follow this pattern.
import {
  statusbar, appbar, bodyCol, tabbar, tTitle, tSub, field, btn, divider,
  chips, chip, listCard, imgPh, bar, badge,
} from '../components.mjs';

export default {
  device: 'phone',
  route: '/', screen: 'Home', state: 'signed in',
  notes: 'AUTH: session<br>DATA: GET /me/items (paged)<br>This screen is built purely from <span class="mono">src/components.mjs</span> calls — no raw HTML tags.',
  body:
    statusbar() +
    appbar({ title: 'Home', trail: badge('3 new') }) +
    bodyCol(
      chips([chip('All', true), chip('Open'), chip('Done')]) +
      listCard({ lines: bar('w60') + bar('w40', true), trail: badge('Open', 'outline') }) +
      listCard({ lines: bar('w80') + bar('w25', true), trail: badge('Open', 'outline') }) +
      listCard({ lines: bar('w60') + bar('w40', true), trail: badge('Done') })
    ) +
    tabbar([{ label: 'Home', active: true }, { label: 'Requests' }, { label: 'Profile' }]),
};
