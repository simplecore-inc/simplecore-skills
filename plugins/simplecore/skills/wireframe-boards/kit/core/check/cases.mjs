// The two cases every core gate is held to: one board that must trip it, one that must not.
//
// A gate that has gone quiet is indistinguishable from a board with nothing wrong with it, which
// is the whole reason the gates exist. **A gate added to `core/gates/` gets its cases here in the
// same change** - `node wf.mjs gates` reports any gate that has none.
import { readFileSync } from 'node:fs';

export function cases(t) {
  const { add, config, base, screen, ctxWith,
    withDocs, DOCS, PARITY_OK, ROADMAP_OK, ROLES_SRC } = t;

  // The kit's own chrome. The broken board is one whose stylesheet carries nothing for it - which
  // is precisely what `pattern adopt` produces, since a board's own `src/` never held rules for a
  // sidebar the board never wrote. The passing board is the kit's two layers ALONE: whatever
  // pattern sits on top of them, the chrome has to work without it.
  const KIT_CSS = ['overview.css', 'chrome.css']
    .map((f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')).join('\n');
  add('chromeStyledGate', 'the pattern does not style the kit\'s chrome', base({ styles: '' }), true);
  add('chromeStyledGate', 'the kit\'s two layers alone hold the chrome up', base({ styles: KIT_CSS }), false);

  // The list only shrinks: a frame the board draws and the list no longer names was walked.
  add('parityListGate', 'a walked frame was deleted from the list',
    withDocs({ 'pa.md': '### X 구역\n- X-01 `x-01-a` - 하나\n' }), false);
  add('parityListGate', 'a frame only the list names',
    withDocs({ 'pa.md': `${PARITY_OK}- X-99 \`x-99-z\` - 없는 것\n` }), true);
  add('parityListGate', 'the list and the board agree', withDocs({ 'pa.md': PARITY_OK }), false);
  // A section heading carries no count, so one left over from an older list is not compared.
  add('parityListGate', 'a heading\'s frame count is not the list',
    withDocs({ 'pa.md': '### X 구역 (5장)\n- X-01 `x-01-a` - 하나\n' }), false);

  add('docFrameRefGate', 'cites a frame that does not exist',
    withDocs({ 'rm.md': ROADMAP_OK, 'note.md': '자세한 것은 X-77을 본다.\n' }), true);
  // An id of another numbering scheme is exempt only where the board names it: the gate carries
  // no list of its own, because a guide number one project cites is a missing frame on another.
  const NOT_FRAMES = (notFrames) => withDocs({ 'rm.md': ROADMAP_OK, 'note.md': 'GUIDE P-94 work permit.\n' },
    { config: { ...config, documents: { ...DOCS, notFrames } } });
  add('docFrameRefGate', 'another scheme\'s id the board does not name is a missing frame', NOT_FRAMES([]), true);
  add('docFrameRefGate', 'another scheme\'s id named in documents.notFrames is not a frame', NOT_FRAMES(['P-94']), false);
  // A cluster that runs past 99 numbers into three digits, and the id reader has to widen with it.
  // Reading two digits only does not make `X-100` a wrong id - it makes it no id at all, and this
  // gate then reports zero on a reference nobody resolved.
  const WIDE = [{ file: 'x-01-a' }, { file: 'x-02-b' }, { file: 'x-100-c' }];
  add('docFrameRefGate', 'cites a three-digit id the board does not draw',
    withDocs({ 'rm.md': ROADMAP_OK, 'note.md': '자세한 것은 X-100을 본다.\n' }), true);
  add('docFrameRefGate', 'cites a three-digit id the board draws',
    withDocs({ 'rm.md': ROADMAP_OK, 'note.md': '자세한 것은 X-100을 본다.\n' },
      { manifest: [{ letter: 'X', title: 't', screens: WIDE }], screens: WIDE }), false);

  // A board that numbers frames with a state letter: `B-01a` is the frame, `B-01` is the screen
  // it is a state of, and documents name both. Reading the id without its letter made every
  // correct citation on such a board look like a reference to a frame that does not exist.
  const SUFFIXED = [{ file: 'x-01a-a' }, { file: 'x-01b-b' }, { file: 'x-02a-c' }];
  const suffixed = (note) => withDocs({ 'rm.md': ROADMAP_OK, 'note.md': note },
    { manifest: [{ letter: 'X', title: 't', screens: SUFFIXED }], screens: SUFFIXED });
  add('docFrameRefGate', 'cites a suffixed id as it is', suffixed('자세한 것은 X-01b를 본다.\n'), false);
  add('docFrameRefGate', 'cites the screen number without the suffix', suffixed('X-01 화면은 상태가 둘이다.\n'), false);
  add('docFrameRefGate', 'cites a state letter that does not exist', suffixed('자세한 것은 X-01c를 본다.\n'), true);
  // A document numbering its own tables `B-02 <Entity>` collides with the frame id shape, and
  // no per-id list stays right as that model grows - so the board names the file.
  const OTHER = (docs) => withDocs({ 'rm.md': ROADMAP_OK, ...docs },
    { config: { ...config, documents: { scan: ['.'], otherIdScheme: ['model.md'] } } });
  add('docFrameRefGate', 'a document in another numbering scheme is not declared',
    withDocs({ 'rm.md': ROADMAP_OK, 'model.md': '#### B-02 SampleEntity\n' }), true);
  add('docFrameRefGate', 'a document in another numbering scheme is declared',
    OTHER({ 'model.md': '#### B-02 SampleEntity\n' }), false);
  add('docFrameRefGate', 'an undeclared document is still checked',
    OTHER({ 'model.md': '#### B-02 SampleEntity\n', 'note.md': '자세한 것은 X-77을 본다.\n' }), true);

  // A board that declares no registry is not held to one: declaring it is what accepts the rule.
  add('docRegistryGate', 'no registry is declared',
    withDocs({ 'a.md': '# a\n', 'b.md': '# b\n' }), false);
  add('docRegistryGate', 'a document missing from the registry',
    withDocs({ 'reg.md': '| 문서 | 무엇 |\n| `a.md` | 하나 |\n', 'a.md': '# a\n', 'b.md': '# b\n' },
      { config: { ...config, documents: { scan: ['.'], registry: 'reg.md' } } }), true);
  add('docRegistryGate', 'the registry names a document that does not exist',
    withDocs({ 'reg.md': '| 문서 | 무엇 |\n| `a.md` | 하나 |\n| `gone.md` | 사라진 것 |\n', 'a.md': '# a\n' },
      { config: { ...config, documents: { scan: ['.'], registry: 'reg.md' } } }), true);
  add('docRegistryGate', 'the registry and the documents agree',
    withDocs({ 'reg.md': '| 문서 | 무엇 |\n| `a.md` | 하나 |\n| `b.md` | 둘 |\n', 'a.md': '# a\n', 'b.md': '# b\n' },
      { config: { ...config, documents: { scan: ['.'], registry: 'reg.md' } } }), false);

  add('docLinkGate', 'a link to a file that does not exist',
    withDocs({ 'a.md': '[없는 것](./gone.md)\n' }), true);
  add('docLinkGate', 'a link to a file that exists',
    withDocs({ 'a.md': '[있는 것](./b.md)\n', 'b.md': '# b\n' }), false);

  add('roleDocGate', 'a role missing from the document',
    withDocs({ 'src/roles.mjs': ROLES_SRC, 'p.md': '시스템 관리자만 적혀 있다\n' }), true);
  add('roleDocGate', 'the document holds every role',
    withDocs({ 'src/roles.mjs': ROLES_SRC, 'p.md': '시스템 관리자 · 문지기\n' }), false);

  add('featureKeyDocGate', 'a feature key missing from the pricing document',
    withDocs({ 'pr.md': 'CONNECTED만 판다\n' },
      { config: { ...config, documents: DOCS, features: { CONNECTED: { tag: 'a' }, PACK_X: { tag: 'b' } } } }), true);
  add('featureKeyDocGate', 'the pricing document holds every key',
    withDocs({ 'pr.md': 'CONNECTED · PACK_X\n' },
      { config: { ...config, documents: DOCS, features: { CONNECTED: { tag: 'a' }, PACK_X: { tag: 'b' } } } }), false);

  // ── markup ────────────────────────────────────────────────────────────────────
  add('structureGate', 'an unclosed tag', base({ html: '<article class="frame" id="s-x-01"><div><span></div></article>' }), true);
  add('structureGate', 'balanced markup', base({ html: '<article class="frame" id="s-x-01"><div><span></span></div></article>' }), false);
  add('leakedValueGate', 'undefined leaked', base({ html: '<article class="frame" id="s-x-01">undefined</article>' }), true);
  add('leakedValueGate', 'the value is intact', base({ html: '<article class="frame" id="s-x-01">로그인</article>' }), false);
  add('overlayGate', 'overlay not handed to the shell',
    base({ loaded: [{ num: 'X-01', file: 'x-01-a', label: 'a', mod: { overlay: '<div class="modal">x</div>', body: '<main></main>' } }] }), true);
  add('overlayGate', 'overlay handed to the shell',
    base({ loaded: [{ num: 'X-01', file: 'x-01-a', label: 'a', mod: { overlay: '<div class="modal">x</div>', body: '<main><div class="modal">x</div></main>' } }] }), false);
  // A target is read by whoever derives flow from the board; one naming a frame that is not there
  // falls back silently to a guess from the label, so the gate has to speak where the reader does not.
  // The harness numbers a screen `X-02` from `x-02-a` (no state letter), so the targets here are
  // written in that shape; a built board's numbers carry the letter and the gate reads both.
  const TARGETED = (t) => ({ body: `<div class="btn primary" data-target="${t}">다음</div>` });
  add('targetGate', 'a target pointing at a frame that does not exist',
    ctxWith([screen('x-01-a', '', TARGETED('X-02 둘'))]), true);
  add('targetGate', 'starts like an id and is not shaped like one',
    ctxWith([screen('x-01-a', '', TARGETED('X-2a 둘')), screen('x-02-a', '')]), true);
  add('targetGate', 'points at a frame that exists',
    ctxWith([screen('x-01-a', '', TARGETED('X-02 둘')), screen('x-02-a', '')]), false);
  add('targetGate', 'a target that is not an id belongs to the pattern',
    ctxWith([screen('x-01-a', '', TARGETED('공급 조건 등록'))]), false);
  add('dupKeyGate', 'the same key twice in one call', ctxWith([screen('x-01-a', "console_({ overlay: a, tab: 'x', overlay: b })")]), true);
  add('dupKeyGate', 'each key once', ctxWith([screen('x-01-a', "console_({ overlay: a, tab: 'x' })")]), false);
  add('optionKeyGate', 'called with an unknown key',
    ctxWith([screen('x-01-a', 'calendar({ month: 8, marks: [] })')], { componentsSrc: 'export const calendar = ({ weeks, today }) => ``;' }), true);
  add('optionKeyGate', 'called with known keys',
    ctxWith([screen('x-01-a', 'calendar({ weeks: [], today: 3 })')], { componentsSrc: 'export const calendar = ({ weeks, today }) => ``;' }), false);

  add('deadImportGate', 'an unused import',
    ctxWith([screen('x-01-a', "import { btn, btnRow } from '../components.mjs';\nbtn('저장')")]), true);
  add('deadImportGate', 'every import used',
    ctxWith([screen('x-01-a', "import { btn, btnRow } from '../components.mjs';\nbtnRow(btn('저장'))")]), false);
  // A name appearing only in a comment is not a use - without that distinction, what should be deleted survives.
  add('deadImportGate', 'a name that appears only in a comment',
    ctxWith([screen('x-01-a', "import { btn, divider } from '../components.mjs';\n// divider()를 쓸까 했다\nbtn('저장')")]), true);

  // Slot mismatch: a state frame calling its base's drawing puts an argument in the wrong position.
  const slotted = (stateSrc, baseSrc) => ctxWith([
    screen('x-02-b', stateSrc), screen('x-01-a', baseSrc),
  ], { loaded: [{ num: 'X-02', file: 'x-02-b', label: 'a', mod: {} }] });
  add('slotGate', 'a dialog into the detail slot',
    slotted("import base, { screenBody, help } from './x-01-a.mjs';\nexport default { body: screenBody(help) };",
      "export const help = dialog({ title: 'x' });\nexport const screenBody = (detail = panel, overlay = '') => ``;"), true);
  add('slotGate', 'correctly into the overlay slot',
    slotted("import base, { screenBody, help } from './x-01-a.mjs';\nexport default { body: screenBody(undefined, help) };",
      "export const help = dialog({ title: 'x' });\nexport const screenBody = (detail = panel, overlay = '') => ``;"), false);
  // Where the base takes an overlay first, that call is correct and must stay quiet.
  add('slotGate', 'the base\'s first parameter is the overlay',
    slotted("import base, { screenBody, help } from './x-01-a.mjs';\nexport default { body: screenBody(help) };",
      "export const help = dialog({ title: 'x' });\nexport const screenBody = (overlay = '') => ``;"), false);
  // A form belongs in the detail slot - what is not a dialog must stay quiet.
  add('slotGate', 'a panel form belongs in the detail slot',
    slotted("import base, { screenBody, form } from './x-01-a.mjs';\nexport default { body: screenBody(form) };",
      "export const form = panelForm({ title: 'x' });\nexport const screenBody = (detail = panel, overlay = '') => ``;"), false);
  // The mirror, and the one that reached a person: a panel form handed to an overlay-first base
  // draws over the whole device. Nothing throws - a string is what that slot takes.
  add('slotGate', 'a panel form into the overlay slot',
    slotted("import base, { screenBody } from './x-01-a.mjs';\nexport const form = panelForm({ title: 'x' });\nexport default { body: screenBody(form) };",
      "export const screenBody = (overlay = '', detail = panel) => ``;"), true);
  // Declared in the state frame rather than in the base, which is where a form usually lives.
  add('slotGate', 'a state frame passes its own form to the detail slot',
    slotted("import base, { screenBody } from './x-01-a.mjs';\nexport const form = panelForm({ title: 'x' });\nexport default { body: screenBody(undefined, form) };",
      "export const screenBody = (overlay = '', detail = panel) => ``;"), false);

  // The state the frame declares, read instead of the type it passed. A form written as a dialog
  // sits correctly in the overlay by every type check there is, and is still the wrong screen.
  const stated = (state, stateSrc, baseSrc) => ctxWith([
    screen('x-02-b', stateSrc), screen('x-01-a', baseSrc),
  ], { loaded: [{ num: 'X-02', file: 'x-02-b', label: 'a', mod: { state } }] });
  add('panelFormStateGate', '「패널 폼 열림」 drawn as a dialog',
    stated('패널 폼 열림',
      "import base, { screenBody } from './x-01-a.mjs';\nexport const form = dialog({ title: 'x' });\nexport default { body: screenBody(form) };",
      "export const screenBody = (overlay = '', detail = panel) => ``;"), true);
  add('panelFormStateGate', '「패널 폼 열림」 fills the panel slot',
    stated('패널 폼 열림',
      "import base, { screenBody } from './x-01-a.mjs';\nexport const form = panelForm({ title: 'x' });\nexport default { body: screenBody(undefined, form) };",
      "export const screenBody = (overlay = '', detail = panel) => ``;"), false);
  add('panelFormStateGate', '「다이얼로그 열림」 belongs in the overlay',
    stated('다이얼로그 열림',
      "import base, { screenBody } from './x-01-a.mjs';\nexport const form = dialog({ title: 'x' });\nexport default { body: screenBody(form) };",
      "export const screenBody = (overlay = '', detail = panel) => ``;"), false);

  // A state frame drawing one of the base's tabs passes a CALL, not a name. Reading the argument
  // list with `[^)]*` cut it at the inner paren and the RegExp built from the fragment threw, which
  // takes the whole build down instead of reporting anything. This case is the crash.
  add('slotGate', 'the argument is a call expression',
    slotted("import base, { screenBody, panel } from './x-01-a.mjs';\nexport default { body: screenBody(panel('센서')) };",
      "export const help = dialog({ title: 'x' });\nexport const screenBody = (detail = panel, overlay = '') => ``;"), false);
  // The mirror: the same call against a base whose overlay parameter comes first puts the panel in
  // the overlay, and the frame silently draws the default tab.
  add('slotGate', 'a panel into the overlay slot',
    slotted("import base, { screenBody, panel } from './x-01-a.mjs';\nexport default { body: screenBody(panel('센서')) };",
      "export const help = dialog({ title: 'x' });\nexport const screenBody = (overlay = '', detail = panel_()) => ``;"), true);
  add('slotGate', 'a panel correctly into the detail slot',
    slotted("import base, { screenBody, panel } from './x-01-a.mjs';\nexport default { body: screenBody('', panel('센서')) };",
      "export const help = dialog({ title: 'x' });\nexport const screenBody = (overlay = '', detail = panel_()) => ``;"), false);

  // ── navigation ────────────────────────────────────────────────────────────────
  add('controlVocabularyGate', 'a row\'s first action is 「상세」', ctxWith([screen('x-01-a', "rowActions([ '상세', '편집' ])")]), true);
  add('controlVocabularyGate', 'a row\'s first action is 「보기」', ctxWith([screen('x-01-a', "rowActions([ '보기', '편집' ])")]), false);
  add('controlVocabularyGate', 'a dialog with no way out', ctxWith([screen('x-01-a', "foot: `${btn('둘 다 반영', 'primary')}`")]), true);
  add('controlVocabularyGate', 'a dialog with a close', ctxWith([screen('x-01-a', "foot: `${btn('닫기')}${btn('둘 다 반영', 'primary')}`")]), false);
  add('viewSwitchGate', '?view= for a view mode', ctxWith([screen('x-01-a', "url: '/plans?view=month'")]), true);
  add('viewSwitchGate', '?mode= for a view mode', ctxWith([screen('x-01-a', "url: '/plans?mode=month'")]), false);
  add('reachabilityGate', 'a screen nothing points at', ctxWith([
    screen('x-01-a', "current: '점검'", { notes: '' }),
    screen('x-02-b', "current: '점검'", { notes: '' }),
  ]), true);
  add('reachabilityGate', 'the screen before points at it', ctxWith([
    screen('x-01-a', "current: '점검'", { notes: '{{x-02-b}}에서 이어진다' }),
    screen('x-02-b', "current: '점검'", { notes: '' }),
  ]), false);

  add('landingIsAddressableGate', 'a state frame stands first under the entry', ctxWith([
    screen('x-02-b', "import base, { screenBody } from './x-01-a.mjs';", { notes: '' }),
    screen('x-01-a', "current: '점검'", { notes: '{{x-02-b}}가 딸린다' }),
  ]), true);
  add('landingIsAddressableGate', 'the base comes first', ctxWith([
    screen('x-01-a', "current: '점검'", { notes: '{{x-02-b}}가 딸린다' }),
    screen('x-02-b', "import base, { screenBody } from './x-01-a.mjs';", { notes: '' }),
  ]), false);

  add('landingIsTheListGate', 'lands on a record address instead of the list', ctxWith([
    screen('x-01-a', "  route: '/checks/:id'\n  current: '점검'", { notes: '' }),
    screen('x-02-b', "  route: '/checks'\n  current: '점검'", { notes: '' }),
  ]), true);
  add('landingIsTheListGate', 'the list comes first', ctxWith([
    screen('x-02-b', "  route: '/checks'\n  current: '점검'", { notes: '' }),
    screen('x-01-a', "  route: '/checks/:id'\n  current: '점검'", { notes: '' }),
  ]), false);
  // No parameter-free route under the entry at all - a missing list or a parameter a global
  // control settles, and neither is this gate's call to make.
  add('landingIsTheListGate', 'no list under the entry', ctxWith([
    screen('x-01-a', "  route: '/sites/:id/areas'\n  current: '구역'", { notes: '' }),
    screen('x-02-b', "  route: '/zones/:id/policy'\n  current: '구역'", { notes: '' }),
  ]), false);

  // ── numbering ─────────────────────────────────────────────────────────────────
  add('slugGate', 'a slug differs from its number', ctxWith([
    screen('x-01-a', '', { notes: '{{x-01-wrong-name}}' }),
  ]), true);
  add('slugGate', 'the slug matches', ctxWith([screen('x-01-a', '', { notes: '{{x-01-a}}' })]), false);
  add('refNumGate', 'one number under two names', ctxWith([
    screen('x-01-a', '', { notes: '{{o-05-work-quality}} {{o-05-working-hours}}' }),
  ]), true);
  add('refTailGate', 'one screen under two numbers', ctxWith([
    screen('x-01-a', '', { notes: '{{j-04-evidence-package}} {{j-09-evidence-package}}' }),
  ]), true);
  add('pairGate', 'a base with no state frame', ctxWith([screen('x-01-a', 'export const screenBody = () => ``;')]), true);
  add('pairGate', 'the pair matches', ctxWith([
    screen('x-01-a', 'export const screenBody = () => ``;'),
    screen('x-01-b', "import base, { screenBody } from './x-01-a.mjs';"),
  ]), false);


  // A classless block takes the board's base size instead of its neighbours', so it draws larger
  // than everything around it with nothing in the source saying why.
  add('classlessGate', 'a bare div inside a screen',
    base({ html: '<article class="frame" id="s-x-01"><div class="device"><div class="screen">' +
      '<div>88.4 dB</div></div></div></article>' }), true);
  add('classlessGate', 'a classed element is fine',
    base({ html: '<article class="frame" id="s-x-01"><div class="device"><div class="screen">' +
      '<div class="t-body">88.4 dB</div></div></div></article>' }), false);
  // Inline emphasis inside a line of copy carries no size of its own and is ordinary.
  add('classlessGate', 'emphasis inside a line of copy is not judged',
    base({ html: '<article class="frame" id="s-x-01"><div class="device"><div class="screen">' +
      '<div class="t-body">값이 <b>둘</b>이다</div></div></div></article>' }), false);
  // The label and the notes are the kit's own markup, not a screen file's.
  add('classlessGate', 'the frame label is not judged',
    base({ html: '<article class="frame" id="s-x-01"><div class="device"><div class="screen">' +
      '<div class="t-body">x</div></div></div><div class="frame-label">[01]X-01</div></article>' }), false);

  // ── the gates that had no case ────────────────────────────────────────────────
  // Every one of these was working; none of them could be shown to be working, which is the
  // state a gate decays into and the state that looks exactly like a board with nothing wrong.
  const sect = (letter, entries) => base({ sections: [{ letter, title: 't', entries }] });
  const ent = (file, id, mod = {}) => ({ file, id, mod, label: '화면' });

  add('idGate', 'the file name carries no id', sect('X', [ent('bad-name', null)]), true);
  add('idGate', 'the id disagrees with the section letter', sect('X', [ent('y-01-a', 'Y-01')]), true);
  add('idGate', 'two screens share one id',
    sect('X', [ent('x-01-a', 'X-01'), ent('x-01-b', 'X-01')]), true);
  // The one legitimate sharing: two viewport halves of ONE screen.
  add('idGate', 'a responsive pair shares its id',
    sect('X', [ent('x-01-a', 'X-01', { variant: 'narrow' }), ent('x-01-b', 'X-01', { variant: 'wide' })]), false);
  add('idGate', 'an id in its place is fine', sect('X', [ent('x-01-a', 'X-01')]), false);

  add('sectionCoverageGate', 'a required cluster is not drawn',
    base({ config: { ...config, requiredSections: ['X', 'Y'] },
      manifest: [{ letter: 'X', title: 't', screens: [] }] }), true);
  add('sectionCoverageGate', 'every required cluster is drawn',
    base({ config: { ...config, requiredSections: ['X'] },
      manifest: [{ letter: 'X', title: 't', screens: [] }] }), false);
  add('sectionCoverageGate', 'clusters are required and the manifest is empty',
    base({ config: { ...config, requiredSections: ['X'] }, manifest: [] }), true);
  // The scaffolded board: nothing required yet, nothing drawn yet. It has to build.
  add('sectionCoverageGate', 'with nothing required an empty manifest passes',
    base({ config: { ...config, requiredSections: [] }, manifest: [] }), false);

  // The declared split. The fixture stands in for `core/split.mjs`'s loader rather than calling
  // it, because what the gate judges is the ANSWER - a placer that leaves a frame unplaced, and a
  // declared part nothing answers with. Building a real module on disk to say `null` would test
  // the loader.
  const splitOf = (answers, parts = [{ key: '1', file: 'one.html' }, { key: '2', file: 'two.html' }]) => ({
    parts,
    partOf: (id) => answers[id] ?? null,
    partFor: (key) => parts.find((p) => p.key === key) ?? null,
  });
  const twoFrames = [{ letter: 'X', title: 't', entries: [ent('x-01-a', 'X-01'), ent('x-02-b', 'X-02')] }];
  add('splitPlacementGate', 'a board that declares no axis is not judged',
    base({ sections: twoFrames }), false);
  add('splitPlacementGate', 'a frame placed in no part',
    base({ sections: twoFrames, split: splitOf({ 'X-01': '1' }) }), true);
  add('splitPlacementGate', 'placed in an undeclared part',
    base({ sections: twoFrames, split: splitOf({ 'X-01': '1', 'X-02': '9' }) }), true);
  add('splitPlacementGate', 'a part goes out empty',
    base({ sections: twoFrames, split: splitOf({ 'X-01': '1', 'X-02': '1' }) }), true);
  add('splitPlacementGate', 'every frame placed and no part empty',
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

  add('crudGate', 'a route in no ledger',
    crudCtx({ loaded: drawn([{ num: 'X-09', file: 'x-09-a', label: '화면', mod: { route: '/nowhere' } }]) }), true);
  add('crudGate', 'in NON_ENTITY with a reason',
    crudCtx({ loaded: drawn([{ num: 'X-09', file: 'x-09-a', label: '화면', mod: { route: '/login' } }]) }), false);

  // A panel whose entity has a page of its own says 「열기」, never 「편집」 - labelling it 편집
  // sends a reader who came to READ through an edit verb onto a page showing more than the panel.
  const withFoot = (verb) => crudCtx({ loaded: [
    { num: 'X-01', file: 'x-01-a', label: '화면', mod: { route: '/records',
      body: `<aside><div class="ld-foot"><div class="btn primary">${verb}</div></div></aside>` } },
    { num: 'X-02', file: 'x-02-b', label: '화면', mod: { route: '/records/{id}' } },
  ] });
  add('panelVerbGate', 'a record page exists and the panel says 「편집」', withFoot('편집'), true);
  add('panelVerbGate', 'with a record page the panel says 「열기」', withFoot('열기'), false);


  // A full page opened from a list carries ONE back control naming that list. Which frames owe
  // one is not a judgement: the ledger names each entity's list, so every verb that is a page of
  // its own owes a back to it. The gate reads the rendered `ph-back`, so the fixture renders it.
  const paged = (backOnRead) => crudCtx({ loaded: [
    { num: 'X-01', file: 'x-01-a', label: '화면', mod: { route: '/records', body: '<div class="ld">목록</div>' } },
    { num: 'X-02', file: 'x-02-b', label: '화면', mod: { route: '/records/{id}',
      body: backOnRead ? '<div class="ph-back">기록 목록</div><h1>레코드</h1>' : '<h1>레코드</h1>' } },
  ] });
  add('backControlGate', 'a record page with no way back', paged(false), true);
  add('backControlGate', 'a back control naming the list', paged(true), false);
}
