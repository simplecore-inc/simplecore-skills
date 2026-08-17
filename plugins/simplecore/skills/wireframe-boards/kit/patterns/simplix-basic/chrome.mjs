// The app shells of the simplix-basic pattern — desktop console, phone, tablet terminal, and the
// signed-out card. Every screen composes from here, so a tab row, a section menu, or a status
// strip is defined once and cannot drift between frames.
//
//   console      — three layers: the bar on top picks an area, the column on the left is that
//                  area's menu, the strip at the bottom carries what keeps running.
//   consolePhone — the console at phone width. NOT the desktop console reflowed: only a handful
//                  of destinations exist at this width, so it is its own layout.
//   worker       — the field app. A phone, offline-first, in the reader's own language.
//   kiosk        — the shared terminal. No session of its own; somebody identifies themselves,
//                  does one thing, and the screen returns to waiting.
//   auth         — sign-in and everything around it, where there is no session yet.
//
// **Nothing here knows a product.** The tabs, the menu tree, the roles and what the installation
// bought are the BOARD's — they live in its `src/chrome.mjs`, which calls these factories with
// them. That split is what lets one pattern draw a safety console and a billing console without
// either one's menu leaking into the other.
import {
  topNav, menuBar, sectionNav, statusBar, bottomPanel,
  statusbar, appbar, tabbar, offlineBar, bodyCol, cta,
} from './components.mjs';

/**
 * Build the console shell for one board's information architecture.
 *
 * @param tabs the areas in tab order — `[{ key, group, clusters }]`. A tab is not one cluster but
 *   the clusters worked together. **The count never changes with the installation**: what a pack
 *   or a connection opens is locked on the sidebar band or entry instead, never by a tab
 *   appearing and disappearing, or two people running the same product would describe different
 *   windows and no manual could match both
 * @param menu each cluster's entries — `{ <letter>: { title, items, packItems } }`. An item is a
 *   destination, or `{ label, children }` where one cluster does not fit a column
 * @param reaches which clusters a role reaches at all — `{ <role>: [<letter>] }`
 * @param itemLimits where a role gets PART of a cluster — `{ <role>: { <letter>: [<label>] } }`.
 *   A role absent from this map reaches every entry of every cluster `reaches` grants it
 * @param clusterPack which licence key opens a cluster. Absent means it opens for everyone
 * @param bought what THIS board's one installation has bought. A frame's own `packs` merges onto
 *   it rather than replacing it, so a screen needing a further pack adds one key and keeps the
 *   rest — the default used to be «nothing bought», which drew hundreds of frames as locked while
 *   the licence screen two clusters away listed them as owned
 * @param adminTab the key that reaches its menu through the `⋮` rather than a tab, or null
 * @param defaultRole the role a frame that names none is drawn for
 */
export function makeConsole({
  tabs, menu, reaches, itemLimits = {}, clusterPack = {}, bought = {},
  adminTab = null, adminClusters = [], defaultRole,
  brand = 'PRODUCT', powered = '', ticker = '', segments = null, site = 'Site', search = '',
  favorites = [],
}) {
  // A `tab` or `current` that names nothing draws an empty rail and no highlighted tab — the
  // frame still renders, still passes every structural check, and only a person looking at the
  // picture notices the chrome went blank. Naming them is a typo away from silent, so the shell
  // refuses instead.
  const TAB_KEYS = new Set(tabs.map((t) => t.key).concat(adminTab ? [adminTab] : []));
  // Pack items are menu entries too. Leaving them out means a screen in a pack cluster names a
  // destination the shell insists does not exist, and the build stops on a screen that is right.
  const menuLabels = (m) => [...(m.items ?? []), ...(m.packItems ?? [])].flatMap((i) =>
    typeof i === 'string' ? [i] : [i.label, ...(i.children ?? [])]);
  const MENU_LABELS = new Set(Object.values(menu).flatMap(menuLabels));
  // Which cluster each destination sits in, so a pinned shortcut can be held to the same reach as
  // the tree under it. A favourite the role cannot reach is a dead entry drawn ABOVE the tree that
  // refuses it, which reads as the one way in that still works.
  const LABEL_CLUSTER = new Map();
  for (const [letter, m] of Object.entries(menu)) {
    for (const label of menuLabels(m)) if (!LABEL_CLUSTER.has(label)) LABEL_CLUSTER.set(label, letter);
  }

  /**
   * The pinned shortcuts this role actually has. A label belonging to no cluster is left alone —
   * a board may pin something the tree does not carry, and dropping it silently would hide that.
   */
  const pinnedFor = (role) => {
    const seen = reaches[role] ?? reaches[defaultRole] ?? [];
    return favorites.filter((fv) => {
      const c = LABEL_CLUSTER.get(fv.label);
      if (c === undefined) return true;
      if (!seen.includes(c)) return false;
      const allowed = itemLimits[role]?.[c];
      return !allowed || allowed.includes(fv.label);
    });
  };

  const tabGroups = (tab, role) => {
    const seen = reaches[role] ?? reaches[defaultRole] ?? [];
    const groups = [];
    for (const t of tabs) {
      // A tab goes only when the role reaches none of its clusters — a licence never removes one.
      if (!t.clusters.some((c) => seen.includes(c))) continue;
      const last = groups[groups.length - 1];
      const entry = { label: t.key, active: t.key === tab };
      if (last && last.group === t.group) last.items.push(entry);
      else groups.push({ group: t.group, items: [entry] });
    }
    return groups.map((g) => g.items);
  };

  /**
   * The section column for one tab: one folding group per cluster the role reaches.
   *
   * <p>**Only the group holding the current screen stands open.** A tab carrying five clusters
   * and forty-eight entries would otherwise be a scrolling wall where the entry somebody wants
   * is below the fold. What the reader is in is what they see.
   *
   * <p>This is also where a licence shows. A cluster the installation has not bought keeps its
   * group and its entries, marked with the lock word.
   */
  const tabGroupsOf = (tab, current, role, packsIn, badges, counts, lockWord) => {
    const packs = { ...bought, ...packsIn };
    const seen = reaches[role] ?? reaches[defaultRole] ?? [];
    const clusters = adminTab && tab === adminTab
      ? adminClusters
      : (tabs.find((t) => t.key === tab)?.clusters ?? []).filter((c) => seen.includes(c));
    return clusters.map((c, i) => {
      const m = menu[c];
      const clusterLock = clusterPack[c] && !packs[clusterPack[c]] ? lockWord : '';
      const packLock = m.packKey && packs[m.packKey] ? '' : (m.packItems ? lockWord : '');
      const leaf = (label, locked) => ({
        label,
        active: label === current,
        badge: badges[label] ?? 0,
        count: counts[label],
        locked,
      });
      // An entry is either a destination or, where a cluster holds more than a column can show, a
      // parent of destinations. A parent is never a screen itself: it carries no count of its
      // own, and it opens only when what is current is inside it.
      const entry = (spec, locked = '') => {
        if (typeof spec === 'string') return leaf(spec, locked);
        const children = spec.children.map((label) => leaf(label, locked));
        return {
          label: spec.label,
          active: false,
          locked,
          children,
          open: children.some((ch) => ch.active),
        };
      };
      const allowed = itemLimits[role]?.[c];
      const within = (it) => !allowed || allowed.includes(typeof it === 'string' ? it : it.label);
      const items = [
        ...m.items.filter(within).map((it) => entry(it, clusterLock)),
        ...(m.packItems ?? []).map((label) => entry(label, packLock)),
      ];
      // The first group opens when nothing is current — a screen reached without a menu entry
      // (an overlay, a deep link) would otherwise show a column of shut branches.
      const holdsCurrent = items.some((it) => it.active || (it.children ?? []).some((ch) => ch.active));
      return {
        label: m.title,
        open: holdsCurrent || (i === 0 && !current),
        locked: clusterLock,
        items,
      };
    });
  };

  /**
   * A full console screen.
   *
   * @param tab the area the top bar has picked; the admin tab is reached through the `⋮` rather
   *   than a tab, so the row shows no active tab while its menu stands on the left
   * @param current the menu entry the reader is on
   * @param wrapped the tab row did not fit and stands on its own line under the bar
   */
  const console_ = ({
    tab, current, main, overlay = '', pane = '',
    role = defaultRole, site: siteIn = site, unread = 0, packs = {},
    badges = {}, counts = {}, rail = false, flyout = null, wrapped = false,
    ticker: tickerIn = '', segments: segmentsIn = null, health = null,
    powered: poweredIn = powered, agent = null, lockWord = '라이선스',
    search: searchIn = search, sitePick = true,
  }) => {
    if (!TAB_KEYS.has(tab)) {
      throw new Error(`console_ — 없는 탭 「${tab}」 (쓸 수 있는 탭: ${[...TAB_KEYS].join(' · ')})`);
    }
    if (current && !MENU_LABELS.has(current)) {
      throw new Error(`console_ — 어느 메뉴에도 없는 「${current}」 — 보드의 chrome.mjs MENU에 있는 이름이어야 한다`);
    }
    const groups = tabGroups(tab, role);
    return `<div class="console">` +
      topNav({
        groups, site: siteIn, unread, wrapped, search: searchIn, sitePick,
        // The `⋮` is the way into administration and nothing else, so a role that reaches none of
        // its clusters is drawn no `⋮`. Derived rather than declared: an option would have to be
        // remembered on every frame, and the one place that already knows the answer is `reaches`.
        admin: adminTab !== null
          && (reaches[role] ?? reaches[defaultRole] ?? []).some((c) => adminClusters.includes(c)),
        adminActive: adminTab ? tab === adminTab : false,
      }) +
      (wrapped ? menuBar(groups) : '') +
      `<div class="shell">` +
      sectionNav({
        title: tab,
        // A pinned group stands above the tree on every tab. A console with a hundred
        // destinations makes the reader walk the same four or five of them every day, and
        // the tree cannot shorten that walk — it can only be folded.
        groups: (((pinned) => pinned.length
          ? [{ label: '즐겨찾기', open: true, items: pinned.map((fv) => ({
              label: fv.label, active: fv.label === current, badge: badges[fv.label] ?? 0,
              count: counts[fv.label], locked: '',
            })) }]
          : [])(pinnedFor(role))).concat(tabGroupsOf(tab, current, role, packs, badges, counts, lockWord)),
        rail,
        flyout,
      }) +
      `<div class="main">${main}</div>` +
      `</div>` +
      bottomPanel(statusBar({
        powered: poweredIn,
        ticker: tickerIn || ticker,
        segments: segmentsIn ?? segments ?? [],
        health: health ?? { label: brand, tone: 'ok' },
        agent,
      }), pane) +
      `</div>` + overlay;
  };
  return console_;
}

/**
 * A pattern frame: the content column on its own, without the tab row and the menu.
 *
 * <p>What a pattern cluster fixes is a shape that repeats on every screen, so the chrome around
 * it would be noise at best — and at worst a reader takes whichever tab happened to be drawn as
 * part of the pattern and copies it into a screen where it does not belong.
 */
export const pattern_ = ({ main, overlay = '' }) =>
  `<div class="console"><div class="shell"><div class="main">${main}</div></div></div>` + overlay;

/**
 * Build the field app's shell.
 *
 * <p>The bar under the app bar is always there rather than only when something fails: a record
 * signed offline looks exactly as finished as one the server has, and somebody who cannot tell
 * the two apart has no reason to walk back into range before the shift ends.
 *
 * <p>**The shell speaks the app's language, not the deployment's.** A frame whose body is written
 * in another language used to draw a Korean app bar above it and a Korean tab row below — the two
 * things always on screen were the two things the reader could not read. `lang` names the app
 * language and the tab row, the offline strip and the default title follow it; a frame that
 * passes its own `tabs` still wins, because a screen may rename a destination.
 *
 * @param tabsByLang the bottom tab row per language — `{ ko: […], en: […] }`
 */
export function makeWorker({ tabsByLang, defaultLang = 'ko' }) {
  return ({
    title, back = false, trail = '', body, action = '', overlay = '',
    tab, queued = 0, offline = false, lang = defaultLang, tabs,
  }) => {
    const row = tabs ?? tabsByLang[lang] ?? tabsByLang[defaultLang];
    const here = tab ?? row[0];
    return statusbar() +
      appbar({ back, title, trail }) +
      offlineBar({ queued, offline, lang }) +
      bodyCol(body) +
      (action ? cta(action) : '') +
      tabbar(row.map((label) => ({ label, active: label === here }))) +
      overlay;
  };
}

/**
 * Build the shared terminal's shell.
 *
 * <p>It carries no navigation and no account: whoever stands in front of it identifies
 * themselves, does one thing, and the screen returns to waiting. It borrows the console's status
 * strip because the question it answers is the same one — what is this terminal bound to, and can
 * it reach the server — and that is what the person who can fix it will be told over the phone.
 */
export function makeKiosk({ brand = 'PRODUCT', defaultTerminal = 'KIOSK-01', defaultSite = 'Site' }) {
  return ({ body, terminal = defaultTerminal, site = defaultSite, segments = [], overlay = '' }) =>
    `<div class="console">` +
    bodyCol(body) +
    statusBar({
      powered: `${terminal} · ${site}`,
      segments,
      health: { label: brand, tone: 'ok' },
    }) +
    `</div>` + overlay;
}

/**
 * Build the signed-out card: sign-in, the challenges around it, and the installer.
 *
 * <p>**Nothing here may lead anywhere.** While these run there is no session, no scope and no
 * permission, so a tab row would draw areas that cannot be opened and a site selector would have
 * nothing to select. What stands instead is the mark — somebody about to name this server's first
 * administrator should see whose server is asking — and the two controls that belong to the
 * reader rather than to the product: language and theme.
 *
 * <p>Language is not decoration here. Somebody handed an invitation link reads this page before
 * anything has learned who they are, so the language switch has to be on the page itself.
 *
 * @param wide for the one screen that is not a card of two fields — an installer running a
 *   multi-step rail over a two-column form, where at the sign-in width the rail runs past the
 *   box's own edge while still sitting inside the screen. That is the shape of overflow a sweep
 *   measuring against the screen cannot see
 */
export function makeAuth({ brand = 'PRODUCT', themes = {}, defaultLang = '한국어' }) {
  return ({
    brand: brandIn = brand, title, description = '', body, foot = '', steps = '',
    lang = defaultLang, wide = false,
  }) =>
    `<div class="auth">` +
    // The corner carries two chips and the first already names the language, so the second
    // follows it rather than taking a parameter of its own — two values for one fact can
    // disagree, and on an invitation screen they did: the chip said Tiếng Việt beside a
    // Korean 「테마」.
    `<div class="auth-corner"><span class="chip">${lang}</span>` +
    `<span class="chip">${themes[lang] ?? themes[defaultLang] ?? 'Theme'}</span></div>` +
    `<div class="auth-box${wide ? ' wide' : ''}">` +
    `<div class="auth-brand"><span class="tn-mark">◧</span><span class="tn-brand">${brandIn}</span></div>` +
    steps +
    `<div class="auth-t">${title}</div>` +
    `${description ? `<div class="auth-d">${description}</div>` : ''}` +
    body +
    `${foot ? `<div class="auth-f">${foot}</div>` : ''}` +
    `</div></div>`;
}

/**
 * Build the console at phone width.
 *
 * <p>It is NOT the desktop console reflowed — a board counts these as frames of their own because
 * only a few destinations exist here at all. Authoring and configuration have no phone layout.
 */
export function makeConsolePhone({ tabs }) {
  return ({ title, back = false, trail = '', body, action = '', tab = tabs[0], overlay = '' }) =>
    statusbar() +
    appbar({ back, title, trail }) +
    bodyCol(body) +
    (action ? cta(action) : '') +
    tabbar(tabs.map((label) => ({ label, active: label === tab }))) +
    overlay;
}
