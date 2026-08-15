// The example board's information architecture — deliberately generic. Two tabs, four clusters,
// three roles. Replace every string here with the product's own; the SHAPE is what to keep.
import {
  makeConsole, makeWorker, makeKiosk, makeAuth, makeConsolePhone, pattern_,
} from '../.kit/patterns/simplix-basic/chrome.mjs';

/** The console's areas, in tab order. A tab groups the clusters that are worked together. */
const TABS = [
  { key: '대시보드', group: 0, clusters: ['A'] },
  { key: '기록', group: 1, clusters: ['B'] },
];

/** Which licence key opens a cluster. Absent means it opens for everyone. */
const CLUSTER_PACK = {};

/** Each cluster's menu. An entry is a destination, not a screen. */
export const MENU = {
  A: { title: '대시보드', items: ['내 대시보드', '알림'] },
  B: { title: '기록', items: ['기록 목록', '분류', '보관'] },
  N: { title: '설정', items: ['조직', '사용자', '권한'] },
};

/** Which clusters a role reaches at all. A cluster absent here is absent from that role's menu. */
const REACHES = {
  admin: ['A', 'B', 'N'],
  staff: ['A', 'B'],
  viewer: ['A'],
};

/** Where a role gets PART of a cluster rather than all of it. */
const ITEM_LIMITS = {};

/** What this one installation bought. A frame's own `packs` merges onto it. */
const BOUGHT = {};

const console__ = makeConsole({
  tabs: TABS, menu: MENU, reaches: REACHES, itemLimits: ITEM_LIMITS,
  clusterPack: CLUSTER_PACK, bought: BOUGHT,
  adminTab: '설정', adminClusters: ['N'],
  defaultRole: 'staff',
  brand: 'PRODUCT',
  powered: 'Powered by COMPANY',
  ticker: '조치가 필요한 항목이 없습니다',
  site: '본사',
  segments: [{ label: '동기화 최신', tone: 'ok' }],
});

export const console_ = (opts) => console__({ unread: 2, ...opts });
export { pattern_ };

export const worker_ = makeWorker({
  tabsByLang: {
    ko: ['오늘', '등록', '내 기록', '설정'],
    en: ['Today', 'New', 'My records', 'Settings'],
  },
});

export const kiosk_ = makeKiosk({ brand: 'PRODUCT', defaultTerminal: 'KIOSK-01', defaultSite: '본사' });
export const auth_ = makeAuth({ brand: 'PRODUCT', themes: { '한국어': '테마', English: 'Theme' } });
export const consolePhone_ = makeConsolePhone({ tabs: ['요약', '알림', '내 정보'] });
