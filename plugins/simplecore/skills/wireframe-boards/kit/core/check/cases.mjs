// The two cases every core gate is held to: one board that must trip it, one that must not.
//
// A gate that has gone quiet is indistinguishable from a board with nothing wrong with it, which
// is the whole reason the gates exist. **A gate added to `core/gates/` gets its cases here in the
// same change** — `node wf.mjs gates` reports any gate that has none.
import { readFileSync } from 'node:fs';

export function cases(t) {
  const { add, config, base, screen, ctxWith,
    withDocs, DOCS, PARITY_OK, ROADMAP_OK, ROLES_SRC } = t;

  // The kit's own chrome. The broken board is one whose stylesheet carries nothing for it — which
  // is precisely what `pattern adopt` produces, since a board's own `src/` never held rules for a
  // sidebar the board never wrote. The passing board is the kit's two layers ALONE: whatever
  // pattern sits on top of them, the chrome has to work without it.
  const KIT_CSS = ['overview.css', 'chrome.css']
    .map((f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')).join('\n');
  add('chromeStyledGate', '패턴이 킷의 크롬을 스타일하지 않는다', base({ styles: '' }), true);
  add('chromeStyledGate', '킷의 두 층만으로 크롬이 선다', base({ styles: KIT_CSS }), false);

  add('frameManifestGate', '§4.2가 한 장 적게 센다',
    withDocs({ 'fm.md': '**X. 구역 (D · 2)** — 하나\n' }), true);
  add('frameManifestGate', '§4.2와 manifest가 같다',
    withDocs({ 'fm.md': '**X. 구역 (D · 2)** — 하나 / 둘\n' }), false);
  const FM_43 = (total, row) => `**X. 구역 (D · 2)** — 하나 / 둘\n\n### 4.3 합계\n\n| 구분 | 프레임 |\n| --- | --- |\n| 1단계 (X ${row}) | ${row} |\n| **합계** | **${total}** (그린 것 ${total}) |\n`;
  add('frameManifestGate', '머리글의 수가 항목과 다름',
    withDocs({ 'fm.md': '**X. 구역 (D · 3)** — 하나 / 둘\n' }), true);
  add('frameManifestGate', '§4.3 합계가 보드와 다름', withDocs({ 'fm.md': FM_43(3, 2) }), true);
  add('frameManifestGate', '§4.3 행 합이 합계와 다름', withDocs({ 'fm.md': FM_43(2, 1) }), true);
  add('frameManifestGate', '§4.3이 보드와 같다', withDocs({ 'fm.md': FM_43(2, 2) }), false);

  add('parityListGate', '보드에 있는데 목록에 없다',
    withDocs({ 'pa.md': '### X 구역 (1장)\n- X-01 `x-01-a` — 하나\n' }), true);
  add('parityListGate', '목록에만 있는 프레임',
    withDocs({ 'pa.md': `${PARITY_OK}- X-99 \`x-99-z\` — 없는 것\n` }), true);
  add('parityListGate', '목록과 보드가 같다', withDocs({ 'pa.md': PARITY_OK }), false);

  add('roadmapPlacementGate', '어느 단계에도 없는 바탕 화면',
    withDocs({ 'rm.md': '- **화면 1장**\n  - (X) **X-01** 하나\n' }), true);
  add('roadmapPlacementGate', '단계의 「화면 N장」이 어긋남',
    withDocs({ 'rm.md': '- **화면 5장**\n  - (X) **X-01** 하나 / **X-02** 둘\n' }), true);
  add('roadmapPlacementGate', '두 단계에 놓임',
    withDocs({ 'rm.md': '- **화면 2장**\n  - (X) **X-01** 하나 / **X-02** 둘\n\n## 다음\n- **화면 1장**\n  - (X) **X-01** 또 하나\n' }), true);
  add('roadmapPlacementGate', '한 단계씩 담고 있다', withDocs({ 'rm.md': ROADMAP_OK }), false);
  // The two summary tables under the phase lists — checked apart from the ids, because the ids were
  // right the whole time the tables said 400.
  const RM_TBL = (dist, total, stage) => '### W2. 하나\n- **화면 2장**\n  - (X) **X-01** 하나 / **X-02** 둘\n\n'
    + `# 배치 검산\n\n| 클러스터 | 총 | 배치 |\n| --- | --- | --- |\n| X ${total} | ${total} | W2 ${dist} |\n| **합계** | **2** | |\n\n| W2 | ${stage} |\n`;
  add('roadmapPlacementGate', '배치 검산이 실제와 다름', withDocs({ 'rm.md': RM_TBL(1, 2, 2) }), true);
  add('roadmapPlacementGate', '클러스터 총계가 실제와 다름', withDocs({ 'rm.md': RM_TBL(3, 3, 2) }), true);
  add('roadmapPlacementGate', '단계별 화면 수가 실제와 다름', withDocs({ 'rm.md': RM_TBL(2, 2, 3) }), true);
  add('roadmapPlacementGate', '두 표가 배치와 같다', withDocs({ 'rm.md': RM_TBL(2, 2, 2) }), false);

  add('docFrameRefGate', '없는 프레임을 부른다',
    withDocs({ 'rm.md': ROADMAP_OK, 'note.md': '자세한 것은 X-77을 본다.\n' }), true);
  add('docFrameRefGate', 'KOSHA P-94는 프레임이 아니다',
    withDocs({ 'rm.md': ROADMAP_OK, 'note.md': 'KOSHA GUIDE P-94 작업허가서.\n' }), false);
  // A cluster that runs past 99 numbers into three digits, and the id reader has to widen with it.
  // Reading two digits only does not make `X-100` a wrong id — it makes it no id at all, and this
  // gate then reports zero on a reference nobody resolved.
  const WIDE = [{ file: 'x-01-a' }, { file: 'x-02-b' }, { file: 'x-100-c' }];
  add('docFrameRefGate', '세 자리 아이디를 부르는데 보드에 없다',
    withDocs({ 'rm.md': ROADMAP_OK, 'note.md': '자세한 것은 X-100을 본다.\n' }), true);
  add('docFrameRefGate', '세 자리 아이디가 보드에 있다',
    withDocs({ 'rm.md': ROADMAP_OK, 'note.md': '자세한 것은 X-100을 본다.\n' },
      { manifest: [{ letter: 'X', title: 't', screens: WIDE }], screens: WIDE }), false);

  // 문서 목록을 선언하지 않은 보드에는 걸리지 않는다 — 선언이 곧 이 규율을 받겠다는 뜻이다.
  add('docRegistryGate', '문서 목록을 선언하지 않았다',
    withDocs({ 'a.md': '# a\n', 'b.md': '# b\n' }), false);
  add('docRegistryGate', '문서 목록에 없는 문서',
    withDocs({ 'reg.md': '| 문서 | 무엇 |\n| `a.md` | 하나 |\n', 'a.md': '# a\n', 'b.md': '# b\n' },
      { config: { ...config, documents: { scan: ['.'], registry: 'reg.md' } } }), true);
  add('docRegistryGate', '문서 목록이 없는 문서를 부른다',
    withDocs({ 'reg.md': '| 문서 | 무엇 |\n| `a.md` | 하나 |\n| `gone.md` | 사라진 것 |\n', 'a.md': '# a\n' },
      { config: { ...config, documents: { scan: ['.'], registry: 'reg.md' } } }), true);
  add('docRegistryGate', '문서 목록과 문서가 맞는다',
    withDocs({ 'reg.md': '| 문서 | 무엇 |\n| `a.md` | 하나 |\n| `b.md` | 둘 |\n', 'a.md': '# a\n', 'b.md': '# b\n' },
      { config: { ...config, documents: { scan: ['.'], registry: 'reg.md' } } }), false);

  add('docLinkGate', '없는 파일로 가는 링크',
    withDocs({ 'a.md': '[없는 것](./gone.md)\n' }), true);
  add('docLinkGate', '있는 파일로 가는 링크',
    withDocs({ 'a.md': '[있는 것](./b.md)\n', 'b.md': '# b\n' }), false);

  add('roleDocGate', '문서에 없는 역할',
    withDocs({ 'src/roles.mjs': ROLES_SRC, 'p.md': '시스템 관리자만 적혀 있다\n' }), true);
  add('roleDocGate', '문서가 역할을 다 담았다',
    withDocs({ 'src/roles.mjs': ROLES_SRC, 'p.md': '시스템 관리자 · 문지기\n' }), false);

  add('featureKeyDocGate', '가격 문서에 없는 기능 키',
    withDocs({ 'pr.md': 'CONNECTED만 판다\n' },
      { config: { ...config, documents: DOCS, features: { CONNECTED: { tag: 'a' }, PACK_X: { tag: 'b' } } } }), true);
  add('featureKeyDocGate', '가격 문서가 키를 다 담았다',
    withDocs({ 'pr.md': 'CONNECTED · PACK_X\n' },
      { config: { ...config, documents: DOCS, features: { CONNECTED: { tag: 'a' }, PACK_X: { tag: 'b' } } } }), false);

  // ── markup ────────────────────────────────────────────────────────────────────
  add('structureGate', '닫지 않은 태그', base({ html: '<article class="frame" id="s-x-01"><div><span></div></article>' }), true);
  add('structureGate', '균형 잡힌 마크업', base({ html: '<article class="frame" id="s-x-01"><div><span></span></div></article>' }), false);
  add('leakedValueGate', 'undefined 유출', base({ html: '<article class="frame" id="s-x-01">undefined</article>' }), true);
  add('leakedValueGate', '값이 온전함', base({ html: '<article class="frame" id="s-x-01">로그인</article>' }), false);
  add('overlayGate', 'overlay를 셸에 안 넘김',
    base({ loaded: [{ num: 'X-01', file: 'x-01-a', label: 'a', mod: { overlay: '<div class="modal">x</div>', body: '<main></main>' } }] }), true);
  add('overlayGate', 'overlay를 넘김',
    base({ loaded: [{ num: 'X-01', file: 'x-01-a', label: 'a', mod: { overlay: '<div class="modal">x</div>', body: '<main><div class="modal">x</div></main>' } }] }), false);
  add('dupKeyGate', '한 호출에 같은 키 두 번', ctxWith([screen('x-01-a', "console_({ overlay: a, tab: 'x', overlay: b })")]), true);
  add('dupKeyGate', '키가 하나씩', ctxWith([screen('x-01-a', "console_({ overlay: a, tab: 'x' })")]), false);
  add('optionKeyGate', '모르는 키로 호출',
    ctxWith([screen('x-01-a', 'calendar({ month: 8, marks: [] })')], { componentsSrc: 'export const calendar = ({ weeks, today }) => ``;' }), true);
  add('optionKeyGate', '아는 키로 호출',
    ctxWith([screen('x-01-a', 'calendar({ weeks: [], today: 3 })')], { componentsSrc: 'export const calendar = ({ weeks, today }) => ``;' }), false);

  add('deadImportGate', '쓰지 않는 import',
    ctxWith([screen('x-01-a', "import { btn, btnRow } from '../components.mjs';\nbtn('저장')")]), true);
  add('deadImportGate', '전부 쓰는 import',
    ctxWith([screen('x-01-a', "import { btn, btnRow } from '../components.mjs';\nbtnRow(btn('저장'))")]), false);
  // A name appearing only in a comment is not a use — without that distinction, what should be deleted survives.
  add('deadImportGate', '주석에만 있는 이름',
    ctxWith([screen('x-01-a', "import { btn, divider } from '../components.mjs';\n// divider()를 쓸까 했다\nbtn('저장')")]), true);

  // Slot mismatch: a state frame calling its base's drawing puts an argument in the wrong position.
  const slotted = (stateSrc, baseSrc) => ctxWith([
    screen('x-02-b', stateSrc), screen('x-01-a', baseSrc),
  ], { loaded: [{ num: 'X-02', file: 'x-02-b', label: 'a', mod: {} }] });
  add('slotGate', '다이얼로그가 상세 자리로',
    slotted("import base, { screenBody, help } from './x-01-a.mjs';\nexport default { body: screenBody(help) };",
      "export const help = dialog({ title: 'x' });\nexport const screenBody = (detail = panel, overlay = '') => ``;"), true);
  add('slotGate', '오버레이 자리로 제대로',
    slotted("import base, { screenBody, help } from './x-01-a.mjs';\nexport default { body: screenBody(undefined, help) };",
      "export const help = dialog({ title: 'x' });\nexport const screenBody = (detail = panel, overlay = '') => ``;"), false);
  // Where the base takes an overlay first, that call is correct and must stay quiet.
  add('slotGate', '바탕의 첫 인자가 오버레이',
    slotted("import base, { screenBody, help } from './x-01-a.mjs';\nexport default { body: screenBody(help) };",
      "export const help = dialog({ title: 'x' });\nexport const screenBody = (overlay = '') => ``;"), false);
  // A form belongs in the detail slot — what is not a dialog must stay quiet.
  add('slotGate', '패널 폼은 상세 자리가 맞다',
    slotted("import base, { screenBody, form } from './x-01-a.mjs';\nexport default { body: screenBody(form) };",
      "export const form = panelForm({ title: 'x' });\nexport const screenBody = (detail = panel, overlay = '') => ``;"), false);
  // The mirror, and the one that reached a person: a panel form handed to an overlay-first base
  // draws over the whole device. Nothing throws — a string is what that slot takes.
  add('slotGate', '패널 폼이 오버레이 자리로',
    slotted("import base, { screenBody } from './x-01-a.mjs';\nexport const form = panelForm({ title: 'x' });\nexport default { body: screenBody(form) };",
      "export const screenBody = (overlay = '', detail = panel) => ``;"), true);
  // Declared in the state frame rather than in the base, which is where a form usually lives.
  add('slotGate', '상태 프레임이 제 폼을 상세 자리에 넘긴다',
    slotted("import base, { screenBody } from './x-01-a.mjs';\nexport const form = panelForm({ title: 'x' });\nexport default { body: screenBody(undefined, form) };",
      "export const screenBody = (overlay = '', detail = panel) => ``;"), false);

  // The state the frame declares, read instead of the type it passed. A form written as a dialog
  // sits correctly in the overlay by every type check there is, and is still the wrong screen.
  const stated = (state, stateSrc, baseSrc) => ctxWith([
    screen('x-02-b', stateSrc), screen('x-01-a', baseSrc),
  ], { loaded: [{ num: 'X-02', file: 'x-02-b', label: 'a', mod: { state } }] });
  add('panelFormStateGate', '패널 폼 열림인데 다이얼로그로 그린다',
    stated('패널 폼 열림',
      "import base, { screenBody } from './x-01-a.mjs';\nexport const form = dialog({ title: 'x' });\nexport default { body: screenBody(form) };",
      "export const screenBody = (overlay = '', detail = panel) => ``;"), true);
  add('panelFormStateGate', '패널 폼 열림이 패널 자리를 채운다',
    stated('패널 폼 열림',
      "import base, { screenBody } from './x-01-a.mjs';\nexport const form = panelForm({ title: 'x' });\nexport default { body: screenBody(undefined, form) };",
      "export const screenBody = (overlay = '', detail = panel) => ``;"), false);
  add('panelFormStateGate', '다이얼로그 열림은 오버레이가 맞다',
    stated('다이얼로그 열림',
      "import base, { screenBody } from './x-01-a.mjs';\nexport const form = dialog({ title: 'x' });\nexport default { body: screenBody(form) };",
      "export const screenBody = (overlay = '', detail = panel) => ``;"), false);

  // A state frame drawing one of the base's tabs passes a CALL, not a name. Reading the argument
  // list with `[^)]*` cut it at the inner paren and the RegExp built from the fragment threw, which
  // takes the whole build down instead of reporting anything. This case is the crash.
  add('slotGate', '인자가 호출식이다',
    slotted("import base, { screenBody, panel } from './x-01-a.mjs';\nexport default { body: screenBody(panel('센서')) };",
      "export const help = dialog({ title: 'x' });\nexport const screenBody = (detail = panel, overlay = '') => ``;"), false);
  // The mirror: the same call against a base whose overlay parameter comes first puts the panel in
  // the overlay, and the frame silently draws the default tab.
  add('slotGate', '패널이 오버레이 자리로',
    slotted("import base, { screenBody, panel } from './x-01-a.mjs';\nexport default { body: screenBody(panel('센서')) };",
      "export const help = dialog({ title: 'x' });\nexport const screenBody = (overlay = '', detail = panel_()) => ``;"), true);
  add('slotGate', '패널이 상세 자리로 제대로',
    slotted("import base, { screenBody, panel } from './x-01-a.mjs';\nexport default { body: screenBody('', panel('센서')) };",
      "export const help = dialog({ title: 'x' });\nexport const screenBody = (overlay = '', detail = panel_()) => ``;"), false);

  // ── navigation ────────────────────────────────────────────────────────────────
  add('controlVocabularyGate', '행 첫 액션이 「상세」', ctxWith([screen('x-01-a', "rowActions([ '상세', '편집' ])")]), true);
  add('controlVocabularyGate', '행 첫 액션이 「보기」', ctxWith([screen('x-01-a', "rowActions([ '보기', '편집' ])")]), false);
  add('controlVocabularyGate', '다이얼로그에 나갈 길 없음', ctxWith([screen('x-01-a', "foot: `${btn('둘 다 반영', 'primary')}`")]), true);
  add('controlVocabularyGate', '다이얼로그에 닫기 있음', ctxWith([screen('x-01-a', "foot: `${btn('닫기')}${btn('둘 다 반영', 'primary')}`")]), false);
  add('viewSwitchGate', '보기 모드에 ?view=', ctxWith([screen('x-01-a', "url: '/plans?view=month'")]), true);
  add('viewSwitchGate', '보기 모드에 ?mode=', ctxWith([screen('x-01-a', "url: '/plans?mode=month'")]), false);
  add('reachabilityGate', '아무도 가리키지 않는 화면', ctxWith([
    screen('x-01-a', "current: '점검'", { notes: '' }),
    screen('x-02-b', "current: '점검'", { notes: '' }),
  ]), true);
  add('reachabilityGate', '앞 화면이 가리킴', ctxWith([
    screen('x-01-a', "current: '점검'", { notes: '{{x-02-b}}에서 이어진다' }),
    screen('x-02-b', "current: '점검'", { notes: '' }),
  ]), false);

  add('landingIsAddressableGate', '상태 프레임이 항목의 첫 자리에 있다', ctxWith([
    screen('x-02-b', "import base, { screenBody } from './x-01-a.mjs';", { notes: '' }),
    screen('x-01-a', "current: '점검'", { notes: '{{x-02-b}}가 딸린다' }),
  ]), true);
  add('landingIsAddressableGate', '바탕이 앞에 있다', ctxWith([
    screen('x-01-a', "current: '점검'", { notes: '{{x-02-b}}가 딸린다' }),
    screen('x-02-b', "import base, { screenBody } from './x-01-a.mjs';", { notes: '' }),
  ]), false);

  add('landingIsTheListGate', '목록을 두고 레코드 주소에 내려앉는다', ctxWith([
    screen('x-01-a', "  route: '/checks/:id'\n  current: '점검'", { notes: '' }),
    screen('x-02-b', "  route: '/checks'\n  current: '점검'", { notes: '' }),
  ]), true);
  add('landingIsTheListGate', '목록이 앞에 있다', ctxWith([
    screen('x-02-b', "  route: '/checks'\n  current: '점검'", { notes: '' }),
    screen('x-01-a', "  route: '/checks/:id'\n  current: '점검'", { notes: '' }),
  ]), false);
  // No parameter-free route under the entry at all — a missing list or a parameter a global
  // control settles, and neither is this gate's call to make.
  add('landingIsTheListGate', '항목 아래에 목록이 없다', ctxWith([
    screen('x-01-a', "  route: '/sites/:id/areas'\n  current: '구역'", { notes: '' }),
    screen('x-02-b', "  route: '/zones/:id/policy'\n  current: '구역'", { notes: '' }),
  ]), false);

  // ── numbering ─────────────────────────────────────────────────────────────────
  add('slugGate', '슬러그가 그 번호와 다름', ctxWith([
    screen('x-01-a', '', { notes: '{{x-01-wrong-name}}' }),
  ]), true);
  add('slugGate', '슬러그가 맞음', ctxWith([screen('x-01-a', '', { notes: '{{x-01-a}}' })]), false);
  add('refNumGate', '한 번호를 두 이름으로', ctxWith([
    screen('x-01-a', '', { notes: '{{o-05-work-quality}} {{o-05-working-hours}}' }),
  ]), true);
  add('refTailGate', '한 화면을 두 번호로', ctxWith([
    screen('x-01-a', '', { notes: '{{j-04-evidence-package}} {{j-09-evidence-package}}' }),
  ]), true);
  add('pairGate', '상태 프레임 없는 base', ctxWith([screen('x-01-a', 'export const screenBody = () => ``;')]), true);
  add('pairGate', '짝이 맞음', ctxWith([
    screen('x-01-a', 'export const screenBody = () => ``;'),
    screen('x-01-b', "import base, { screenBody } from './x-01-a.mjs';"),
  ]), false);


  // A classless block takes the board's base size instead of its neighbours', so it draws larger
  // than everything around it with nothing in the source saying why.
  add('classlessGate', '화면 안에 맨 div가 있다',
    base({ html: '<article class="frame" id="s-x-01"><div class="device"><div class="screen">' +
      '<div>88.4 dB</div></div></div></article>' }), true);
  add('classlessGate', '클래스가 있으면 정상',
    base({ html: '<article class="frame" id="s-x-01"><div class="device"><div class="screen">' +
      '<div class="t-body">88.4 dB</div></div></div></article>' }), false);
  // Inline emphasis inside a line of copy carries no size of its own and is ordinary.
  add('classlessGate', '글 안의 강조는 대상이 아니다',
    base({ html: '<article class="frame" id="s-x-01"><div class="device"><div class="screen">' +
      '<div class="t-body">값이 <b>둘</b>이다</div></div></div></article>' }), false);
  // The label and the notes are the kit's own markup, not a screen file's.
  add('classlessGate', '프레임 라벨은 대상이 아니다',
    base({ html: '<article class="frame" id="s-x-01"><div class="device"><div class="screen">' +
      '<div class="t-body">x</div></div></div><div class="frame-label">[01]X-01</div></article>' }), false);

  // ── the gates that had no case ────────────────────────────────────────────────
  // Every one of these was working; none of them could be shown to be working, which is the
  // state a gate decays into and the state that looks exactly like a board with nothing wrong.
  const sect = (letter, entries) => base({ sections: [{ letter, title: 't', entries }] });
  const ent = (file, id, mod = {}) => ({ file, id, mod, label: '화면' });

  add('idGate', '파일 이름에 id가 없다', sect('X', [ent('bad-name', null)]), true);
  add('idGate', '섹션 글자와 id가 어긋난다', sect('X', [ent('y-01-a', 'Y-01')]), true);
  add('idGate', '한 id를 두 화면이 쓴다',
    sect('X', [ent('x-01-a', 'X-01'), ent('x-01-b', 'X-01')]), true);
  // The one legitimate sharing: two viewport halves of ONE screen.
  add('idGate', '반응형 짝은 id를 함께 쓴다',
    sect('X', [ent('x-01-a', 'X-01', { variant: 'narrow' }), ent('x-01-b', 'X-01', { variant: 'wide' })]), false);
  add('idGate', '제 자리의 id는 정상', sect('X', [ent('x-01-a', 'X-01')]), false);

  add('sectionCoverageGate', '요구한 클러스터를 안 그렸다',
    base({ config: { ...config, requiredSections: ['X', 'Y'] },
      manifest: [{ letter: 'X', title: 't', screens: [] }] }), true);
  add('sectionCoverageGate', '요구한 클러스터를 다 그렸다',
    base({ config: { ...config, requiredSections: ['X'] },
      manifest: [{ letter: 'X', title: 't', screens: [] }] }), false);
  add('sectionCoverageGate', 'manifest가 비었다', base({ manifest: [] }), true);

  // The declared split. The fixture stands in for `core/split.mjs`'s loader rather than calling
  // it, because what the gate judges is the ANSWER — a placer that leaves a frame unplaced, and a
  // declared part nothing answers with. Building a real module on disk to say `null` would test
  // the loader.
  const splitOf = (answers, parts = [{ key: '1', file: 'one.html' }, { key: '2', file: 'two.html' }]) => ({
    parts,
    partOf: (id) => answers[id] ?? null,
    partFor: (key) => parts.find((p) => p.key === key) ?? null,
  });
  const twoFrames = [{ letter: 'X', title: 't', entries: [ent('x-01-a', 'X-01'), ent('x-02-b', 'X-02')] }];
  add('splitPlacementGate', '축을 선언하지 않은 보드는 걸리지 않는다',
    base({ sections: twoFrames }), false);
  add('splitPlacementGate', '어느 부분에도 놓이지 않은 프레임',
    base({ sections: twoFrames, split: splitOf({ 'X-01': '1' }) }), true);
  add('splitPlacementGate', '선언되지 않은 부분에 놓였다',
    base({ sections: twoFrames, split: splitOf({ 'X-01': '1', 'X-02': '9' }) }), true);
  add('splitPlacementGate', '빈 채로 나가는 부분이 있다',
    base({ sections: twoFrames, split: splitOf({ 'X-01': '1', 'X-02': '1' }) }), true);
  add('splitPlacementGate', '프레임이 전부 놓이고 빈 부분이 없다',
    base({ sections: twoFrames, split: splitOf({ 'X-01': '1', 'X-02': '2' }) }), false);

  // The CRUD census, the panel's main verb and the back control all read the board's ledger.
  const LEDGER = { 기록: { list: 'X-01', create: 'generic', read: 'X-02', update: 'generic',
    remove: { waived: '법정 기록이라 지우지 않는다' } } };
  const drawn = (extra = []) => [
    { num: 'X-01', file: 'x-01-a', label: '화면', mod: { route: '/records' } },
    { num: 'X-02', file: 'x-02-b', label: '화면', mod: { route: '/records/{id}' } },
    ...extra,
  ];
  const crudCtx = (over) => base({ crud: { LEDGER, NON_ENTITY: { '/login': '인증 화면' } }, ...over });

  add('crudGate', '어느 대장에도 없는 라우트',
    crudCtx({ loaded: drawn([{ num: 'X-09', file: 'x-09-a', label: '화면', mod: { route: '/nowhere' } }]) }), true);
  add('crudGate', 'NON_ENTITY에 사유와 함께 있다',
    crudCtx({ loaded: drawn([{ num: 'X-09', file: 'x-09-a', label: '화면', mod: { route: '/login' } }]) }), false);

  // A panel whose entity has a page of its own says 「열기」, never 「편집」 — labelling it 편집
  // sends a reader who came to READ through an edit verb onto a page showing more than the panel.
  const withFoot = (verb) => crudCtx({ loaded: [
    { num: 'X-01', file: 'x-01-a', label: '화면', mod: { route: '/records',
      body: `<aside><div class="ld-foot"><div class="btn primary">${verb}</div></div></aside>` } },
    { num: 'X-02', file: 'x-02-b', label: '화면', mod: { route: '/records/{id}' } },
  ] });
  add('panelVerbGate', '페이지가 있는데 패널이 「편집」이라 한다', withFoot('편집'), true);
  add('panelVerbGate', '페이지가 있으면 「열기」', withFoot('열기'), false);


  // A full page opened from a list carries ONE back control naming that list. Which frames owe
  // one is not a judgement: the ledger names each entity's list, so every verb that is a page of
  // its own owes a back to it. The gate reads the rendered `ph-back`, so the fixture renders it.
  const paged = (backOnRead) => crudCtx({ loaded: [
    { num: 'X-01', file: 'x-01-a', label: '화면', mod: { route: '/records', body: '<div class="ld">목록</div>' } },
    { num: 'X-02', file: 'x-02-b', label: '화면', mod: { route: '/records/{id}',
      body: backOnRead ? '<div class="ph-back">기록 목록</div><h1>레코드</h1>' : '<h1>레코드</h1>' } },
  ] });
  add('backControlGate', '레코드 페이지에 돌아갈 자리가 없다', paged(false), true);
  add('backControlGate', '목록을 이름으로 부르는 back이 있다', paged(true), false);
}
