// The two cases every simplix-basic gate is held to: one board that must trip it, one that must
// not. They live beside the gates rather than in the kit, because they describe what is wrong on
// a board drawn THIS way - a register, a list-detail layout, the words its controls share.
//
// **A gate added to `gates/content.mjs` gets its cases here in the same change** -
// `node wf.mjs gates` reports any gate that has none.
export function cases(t) {
  const { add, config, base, screen, ctxWith } = t;

  // ── content ───────────────────────────────────────────────────────────────────
  add('titleFormGate', 'a screen name is a sentence',
    ctxWith([screen('x-01-a', "pageHeader({\n  title: '기록을 저장한다',")]), true);
  add('titleFormGate', 'a screen name is a noun phrase',
    ctxWith([screen('x-01-a', "pageHeader({\n  title: '저장 내역',")]), false);
  // tTitle is not a judged slot - this board writes a heading inside an explanation as the rule it states.
  add('titleFormGate', 'tTitle is not judged',
    ctxWith([screen('x-01-a', "tTitle('갈음 관계 — 한 기록이 두 의무를 채운다')")]), false);
  // The title gate reads two slots only - a page's name and a dialog's name. A help dialog states
  // the rule it explains, which is this board's convention, and `msg`/`emptyState` titles are the
  // product speaking to a user, so neither was ever in scope.
  add('titleFormGate', 'a dialog name in the polite register',
    ctxWith([screen('x-01-a', "const reject = dialog({\n  title: '반려 사유를 적습니다',")]), true);
  add('titleFormGate', 'help copy states a rule',
    ctxWith([screen('x-01-a', "export const help = dialog({\n  title: '자리마다 보고 기한이 다르다',")]), false);
  add('titleFormGate', 'a message title may be a sentence',
    ctxWith([screen('x-01-a', "msg({\n  kind: 'warn',\n  title: '게시할 수 없습니다',")]), false);
  // A closed list of endings let 「읽힌다」 and 「뗀다」 through - any 「~다」 ending is read now.
  add('titleFormGate', 'an ending outside the list',
    ctxWith([screen('x-01-a', "const peek = dialog({\n  title: '오늘 적은 값이 30년 뒤에 읽힌다',")]), true);

  add('registerGate', 'screen copy in the plain register', ctxWith([screen('x-01-a', 'class="t-body">서명을 받는다<')]), true);
  add('registerGate', 'screen copy in the polite register', ctxWith([screen('x-01-a', 'class="t-body">서명을 받습니다<')]), false);
  // A value is the larger surface - eight sat here, one inside a template literal where a quoted-string sweep could not see it.
  add('registerGate', 'a value in the plain register', ctxWith([screen('x-01-a', "dField({ label: '허용', value: '표에 행을 넣는다' })")]), true);
  add('registerGate', 'a template-literal value is read too',
    ctxWith([screen('x-01-a', 'dField({ label: \'기록\', value: `접속 건수가 남는다 ${badge(\'법정\')}` })')]), false || true);
  add('registerGate', 'a value in the polite register', ctxWith([screen('x-01-a', "dField({ label: '허용', value: '표에 행을 넣습니다' })")]), false);
  // A noun or adverb that merely ends in 「다」 is not the plain register.
  add('registerGate', 'an adverb ending in 「다」', ctxWith([screen('x-01-a', "fSelect({ label: '주기', value: '30분마다' })")]), false);
  add('registerGate', 'a noun ending in 「다」', ctxWith([screen('x-01-a', "statTile({ label: '한 사람이 대리한 최다', value: '4건' })")]), false);
  // An explanation states its rule as the heading and answers in 합니다체 underneath - that heading is not judged.
  add('registerGate', 'the label of a wide field is a description heading',
    ctxWith([screen('x-01-a', "dField({ label: '주기는 사업장이 고르지 않는다', value: '직전 결과가 정합니다', wide: true })")]), false);
  add('registerGate', 'a help card\'s list of topics',
    ctxWith([screen('x-01-a', "helpCard({ title: '왜 필요한가', hint: '알린 기록이 없으면 계획서만 남는다' })")]), false);
  add('registerGate', 'the heading of a description block',
    ctxWith([screen('x-01-a', "sectHead('누가 눌렀는지가 남는다')")]), false);
  // `notes` is the board speaking to its reader, not the product speaking to a user.
  add('registerGate', 'notes are not judged',
    ctxWith([screen('x-01-a', "  notes: 'AUTH: x<br>여기서 기록이 남는다',\n  body: '',")]), false);
  // The far side of the same rule: the board's own voice drifting into 합니다체.
  add('notesRegisterGate', 'notes in the polite register',
    ctxWith([screen('x-01-a', "  notes: '<strong>목록을 보인다</strong> 상세는 패널에 표시합니다.',\n  body: '',")]), true);
  add('notesRegisterGate', 'notes in the plain register',
    ctxWith([screen('x-01-a', "  notes: '<strong>목록을 보인다</strong> 상세는 패널에 표시한다.',\n  body: '',")]), false);
  // The ending that closes on a cross-reference, not a period - the shape that hid 36 of them.
  add('notesRegisterGate', 'the polite register ending in a reference',
    ctxWith([screen('x-01-a', "  notes: '상세는 패널에 표시합니다({{p-04-list-detail}}).',\n  body: '',")]), true);
  // Copy quoted from the screen keeps the screen's register.
  add('notesRegisterGate', 'quoted screen copy is not judged',
    ctxWith([screen('x-01-a', "  notes: '경고는 「저장했습니다.」로 적는다',\n  body: '',")]), false);

  // ── the board's today ────────────────────────────────────────────────────────
  // Today is fixed by board.config (2026-08-12); the dates in the fixtures below are tied to it.
  add('dDayGate', 'the badge is one day too large',
    ctxWith([screen('x-01-a', "dField({ label: '기한', value: badge('2026-08-16 · D-5') })")]), true);
  add('dDayGate', 'the badge is right',
    ctxWith([screen('x-01-a', "dField({ label: '기한', value: badge('2026-08-16 · D-4') })")]), false);
  // The D in 「AUD-2026」 is not a D-day.
  add('dDayGate', 'a D with a letter before it',
    ctxWith([screen('x-01-a', "'AUD-2026-02 · 2026-06-15 실시'")]), false);
  // D-n counts toward a day still to come - a past date elsewhere in the same window is not its pair.
  add('dDayGate', 'a past date inside a window',
    ctxWith([screen('x-01-a', "'사유 종료 2026-08-06'\n'기한 2026-08-16 · D-4'")]), false);

  add('clockGate', 'the audit stamp is in the future',
    ctxWith([screen('x-01-a', "auditFoot({ id: 'a_1', at: '2026-09-01 10:00' }, '미해소')")]), true);
  add('clockGate', 'the audit stamp is in the past',
    ctxWith([screen('x-01-a', "auditFoot({ id: 'a_1', at: '2026-08-01 10:00' }, '미해소')")]), false);
  // A step drawn as finished must carry a date already past.
  add('clockGate', 'a finished step is in the future',
    ctxWith([screen('x-01-a', "{ label: '작성', who: '김안전', at: '2026-08-20', state: 'done' }")]), true);
  add('clockGate', 'a deadline still to come',
    ctxWith([screen('x-01-a', "fSelect({ label: '조치 기한', value: '2026-08-20' })")]), false);

  add('clockGate', 'the elapsed days are one short',
    ctxWith([screen('x-01-a', "badge('3일 전 · 2026-08-08 버전')")]), true);
  add('clockGate', 'the elapsed days are right',
    ctxWith([screen('x-01-a', "badge('4일 전 · 2026-08-08 버전')")]), false);
  // A day still to come is not the pair of 「N일 전」.
  add('clockGate', 'a day still to come is not counted',
    ctxWith([screen('x-01-a', "'기한 2026-08-20'\n'마지막 점검 4일 전'")]), false);

  add('newModeGate', 'a picked record and an empty form at one address',
    ctxWith([screen('x-01-a', "  url: 'x.example.com/incidents?view=inc_0312&mode=new',")]), true);
  add('newModeGate', 'an empty form alone',
    ctxWith([screen('x-01-a', "  url: 'x.example.com/incidents?mode=new',")]), false);
  add('newModeGate', 'editing the picked record',
    ctxWith([screen('x-01-a', "  url: 'x.example.com/incidents?view=inc_0312&mode=edit',")]), false);

  add('recordIdGate', 'the address and the stamp name different records',
    ctxWith([screen('x-01-a', "  url: 'x.example.com/sessions/ses_0142',\n  auditFoot({ id: 'ses_0244', at: '2026-08-01 10:00' }, '')")]), true);
  add('recordIdGate', 'the address and the stamp agree',
    ctxWith([screen('x-01-a', "  url: 'x.example.com/sessions/ses_0142',\n  auditFoot({ id: 'ses_0142', at: '2026-08-01 10:00' }, '')")]), false);
  // A truncated hash in the address is not a different record.
  add('recordIdGate', 'the hash in the address is shortened',
    ctxWith([screen('x-01-a', "  url: 'x.example.com/sig/sig_9f2ca',\n  auditFoot({ id: 'sig_9f2ca81b4d7e', at: '2026-08-01 10:00' }, '')")]), false);

  add('badgeFormGate', 'a badge is a sentence',
    ctxWith([screen('x-01-a', "badge('먼저 닫아야 합니다')")]), true);
  add('badgeFormGate', 'a badge in the plain register',
    ctxWith([screen('x-01-a', "badge('아니다')")]), true);
  // The 「~ㅁ」 ending and the noun form are this board's badge vocabulary.
  add('badgeFormGate', 'a badge is a state name',
    ctxWith([screen('x-01-a', "badge('이상 없음') + badge('43일 남음') + badge('차단')")]), false);

  add('labelFormGate', 'a dField label in the plain register',
    ctxWith([screen('x-01-a', "dField({ label: '침묵과 정상은 다르다', value: '값' })")]), true);
  add('labelFormGate', 'a dField label is a condition',
    ctxWith([screen('x-01-a', "dField({ label: '끊기면', value: '값' })")]), true);
  // 「석면」 is a noun that ends the same way.
  add('labelFormGate', 'a noun ending in 「면」',
    ctxWith([screen('x-01-a', "dField({ label: '석면', value: '있음' })")]), false);
  add('labelFormGate', 'a badge is a complete clause',
    ctxWith([screen('x-01-a', "badge('이름이 같음', 'outline')")]), true);
  // Noun plus negated existence is this board's standard badge shape.
  add('labelFormGate', 'the standard shape of a badge',
    ctxWith([screen('x-01-a', "badge('허가 없음') + badge('리더 없음') + badge('이상 없음')")]), false);
  add('labelFormGate', 'a statTile label is an action',
    ctxWith([screen('x-01-a', "statTile({ label: '확인함', value: '118', unit: '건' })")]), true);
  // 「포함」 is a noun that ends the same way.
  add('labelFormGate', 'a noun ending in 「함」',
    ctxWith([screen('x-01-a', "statTile({ label: '개인정보 포함', value: '3', unit: '건' })")]), false);
  // 「연결 안 됨」 is a category of zone, the standard 노운+없음 shape.
  add('labelFormGate', 'a noun ending in 「안 됨」',
    ctxWith([screen('x-01-a', "statTile({ label: '연결 안 됨', value: '5', unit: '개' })")]), false);

  add('refLeakGate', 'a frame reference in screen copy',
    ctxWith([screen('x-01-a', "  body: tSub('변경은 {{p-18-change-history}}에 남습니다'),")]), true);
  add('refLeakGate', 'a reference in a comment is fine: it is not drawn',
    ctxWith([screen('x-01-a', "  // {{p-18-change-history}}\n  body: tSub('변경은 변경 이력에 남습니다'),")]), false);
  add('refLeakGate', 'a reference in a block comment is fine too',
    ctxWith([screen('x-01-a', "  /* {{p-18-change-history}} */\n  body: tSub('변경은 변경 이력에 남습니다'),")]), false);
  add('refLeakGate', 'a reference in notes is fine',
    ctxWith([screen('x-01-a', "  notes: 'AUTH: x<br>여기서 여는 화면 — {{p-18-change-history}}',\n  body: tSub('변경은 변경 이력에 남습니다'),")]), false);

  // The field languages are the board's declaration; the fixture declares one placeholder
  // language with the letters that identify it, and one that carries words only.
  const FIELD = [
    { lang: 'es', name: 'Español', letters: /[ñáéíóú¿¡]/, min: 6 },
    { lang: 'en', text: {} },
  ];
  const fielded = (src, fieldLanguages = FIELD) => ctxWith([screen('x-01-a', src)], { config: { ...config, fieldLanguages } });
  const ES_BODY = 'Señal de evacuación · Póngase el casco · Oxígeno bajo · Ningún ruido · Atención · ¿Está seguro? · Sí · También';
  add('workerLangGate', 'a body in a declared language with a Korean shell',
    fielded(`worker_({ title: 'x', body: '${ES_BODY}' })`), true);
  add('workerLangGate', 'lang is handed to the shell',
    fielded(`worker_({ title: 'x', lang: 'es', body: '${ES_BODY}' })`), false);
  // Another language's code is not this language's: the shell would draw the wrong words.
  add('workerLangGate', 'the shell is handed another language',
    fielded(`worker_({ title: 'x', lang: 'en', body: '${ES_BODY}' })`), true);
  // One word quoted on a Korean screen does not make the body copy that language.
  add('workerLangGate', 'one quoted word',
    fielded("worker_({ title: '내 자격', body: '모국어 Español로 나갑니다' })"), false);
  // The letters may be declared as a source string as well as a regular expression.
  add('workerLangGate', 'letters declared as a string',
    fielded(`worker_({ title: 'x', body: '${ES_BODY}' })`, [{ lang: 'es', letters: '[ñáéíóú¿¡]' }]), true);
  // No declaration, no vocabulary: the gate holds the board to nothing and doctor names it.
  add('workerLangGate', 'a board that declares no field languages is not held to any',
    fielded(`worker_({ title: 'x', body: '${ES_BODY}' })`, []), false);
  add('workerLangGate', 'a language declared without letters is never recognised',
    fielded(`worker_({ title: 'x', body: '${ES_BODY}' })`, [{ lang: 'es', text: {} }]), false);

  add('twinActionGate', 'two buttons, one name written long',
    ctxWith([screen('x-01-a', "actions: btn('역할·권한', 'ghost') + btn('역할·권한 매트릭스', 'ghost')")]), true);
  // A shared ending means two different actions; only a shared beginning is one name twice.
  add('twinActionGate', 'different actions that end alike',
    ctxWith([screen('x-01-a', "actions: btn('임시 저장', 'ghost') + btn('저장', 'primary')")]), false);
  add('twinActionGate', 'two that do not overlap',
    ctxWith([screen('x-01-a', "actions: btn('내보내기', 'ghost') + btn('등록', 'primary')")]), false);

  // The site's languages are the board's declaration; the fixture declares four placeholders
  // and one tab label that is not a language.
  const SITE = { languages: ['한국어', 'English', 'Español', 'Français'], notLanguages: ['전체 언어', '나란히'] };
  const sited = (src, site = SITE) => ctxWith([screen('x-01-a', src)], { config: { ...config, site } });
  add('languageSetGate', 'offers a language the site does not run',
    sited("langTabs(['한국어', 'Español', 'Deutsch'], 0)"), true);
  add('languageSetGate', 'offers exactly the site\'s languages',
    sited("langTabs(['한국어', 'English', 'Español', 'Français'], 0)"), false);
  // A declared non-language label and a direction are not language names.
  add('languageSetGate', 'a declared non-language tab and a direction',
    sited("langTabs(['전체 언어', '한국어', '나란히', '한국어 → English'], 0)"), false);
  add('languageSetGate', 'an undeclared non-language tab is read as a language',
    sited("langTabs(['전체 언어', '한국어'], 0)", { languages: SITE.languages }), true);
  // A screen deliberately drawing a language the installation has not enabled declares why.
  add('languageSetGate', 'a frame that declares the departure is quiet',
    sited("\n  offLanguages: '켜지 않은 언어가 무엇을 받는지가 이 화면의 주제다',\n  langTabs(['한국어', 'Deutsch'], 0)"), false);
  // No declaration, no vocabulary: the gate holds the board to nothing and doctor names it.
  add('languageSetGate', 'a board that declares no languages is not held to any',
    sited("langTabs(['한국어', 'Deutsch'], 0)", {}), false);

  add('paginationGate', 'the last page is wrong',
    ctxWith([screen('x-01-a', "pagination(['1', '2', '…', '482'], '48,210', 10)")]), true);
  add('paginationGate', 'the last page is right',
    ctxWith([screen('x-01-a', "pagination(['1', '2', '…', '4821'], '48,210', 10)")]), false);
  add('paginationGate', 'a single page',
    ctxWith([screen('x-01-a', "pagination(['1'], '8', 10)")]), false);

  add('dialogTitleGate', 'a dialog title twice', ctxWith([screen('x-01-a', "title: '구역 추가',\n  children: formSection('새 구역'")]), true);
  add('listFormGate', 'a form on a list page', ctxWith([screen('x-01-a', "table({ rows: [] })\nformSection('입력')")]), true);
  add('listFormGate', 'the form states its reason', ctxWith([screen('x-01-a', "table({ rows: [] })\n  pageForm: '이 화면은 등록 절차다'\nformSection('입력')")]), false);
  add('labelSentenceGate', 'a dField label is a sentence',
    ctxWith([screen('x-01-a', "dField({ label: '주기는 사업장이 고르지 않는다', value: 'x' })")]), true);
  add('labelSentenceGate', 'a label that is a name',
    ctxWith([screen('x-01-a', "dField({ label: '무엇이 문제인가', value: 'x' })")]), false);
  add('labelSentenceGate', 'a condition as a label',
    ctxWith([screen('x-01-a', "dField({ label: '끊기면', value: 'x' })")]), true);
  add('labelSentenceGate', '「석면」 is a substance',
    ctxWith([screen('x-01-a', "dField({ label: '석면', value: 'x' })")]), false);
  add('labelSentenceGate', 'a badge is a sentence',
    ctxWith([screen('x-01-a', "badge('경로가 겹침')")]), true);
  add('labelSentenceGate', '「허가 있음」 is a state',
    ctxWith([screen('x-01-a', "badge('허가 있음')")]), false);
  add('labelSentenceGate', 'a statTile label does not name the value',
    ctxWith([screen('x-01-a', "statTile({ label: '게시됨', value: '3' })")]), true);
  add('labelSentenceGate', '「개인정보 포함」 is a kind',
    ctxWith([screen('x-01-a', "statTile({ label: '개인정보 포함', value: '3' })")]), false);
  add('labelSentenceGate', '「연결 안 됨」 is a kind',
    ctxWith([screen('x-01-a', "statTile({ label: '연결 안 됨', value: '5' })")]), false);
  add('workerShellLangGate', 'a body in the worker\'s language with a Korean shell',
    ctxWith([screen('x-01-a', "worker_({ title: 'x', body: tBody('Oxígeno por debajo del 18%') })")]), true);
  // Any script other than Hangul is a worker's language; no list of languages is consulted.
  add('workerShellLangGate', 'a body in a script no board declared',
    ctxWith([screen('x-01-a', "worker_({ title: 'x', body: tBody('Выберите язык') })")]), true);
  add('workerShellLangGate', 'a language picker writes several languages together',
    ctxWith([screen('x-01-a', "worker_({ title: 'x', body: tSub('Choose language · Wybierz język · Выберите язык') })")]), false);
  // Symbols every script shares are not another language: a unit in a Korean body stays Korean.
  add('workerShellLangGate', 'a Korean body with a unit sign',
    ctxWith([screen('x-01-a', "worker_({ title: 'x', body: tBody('분진 농도 150µg/m³ · 기준 초과') })")]), false);
  // The AI vocabulary and tiers are the board's declaration; the fixture's are placeholders.
  const AI = ['추정', '초안'];
  const aiWorded = (src, aiWords = AI) => ctxWith([screen('x-01-a', src)], { config: { ...config, aiWords } });
  add('aiWordGate', 'a word outside the declared vocabulary',
    aiWorded("aiBadge('예측')"), true);
  add('aiWordGate', 'one of the declared words',
    aiWorded("aiBadge('추정', '회차 5개')"), false);
  add('aiWordGate', 'a board that declares no vocabulary is not held to one',
    aiWorded("aiBadge('예측')", []), false);
  const TIERS = { tiers: [1, 2, 3], alwaysOn: [1] };
  const tiered = (src, aiTiers = TIERS) => ctxWith([screen('x-01-a', src)], { config: { ...config, aiTiers } });
  add('aiTierGate', 'a tier that does not exist',
    tiered("aiCard({ title: 'x', tier: 4 })"), true);
  add('aiTierGate', 'a card on a tier that is always on',
    tiered("aiCard({ title: 'x', tier: 1 })"), true);
  add('aiTierGate', 'a card on a declared tier that can be off',
    tiered("aiCard({ title: 'x', hint: 'y', tier: 2 })"), false);
  // A board's own tiers, not the fixture's: tier 4 exists there and none is always on.
  add('aiTierGate', 'a board with its own tiers',
    tiered("aiCard({ title: 'x', tier: 4 }) + aiCard({ title: 'y', tier: 1 })", { tiers: ['1', '4'] }), false);
  add('aiTierGate', 'a board that declares no tiers is not held to any',
    tiered("aiCard({ title: 'x', tier: 4 })", {}), false);
  // The catalogue is the board's declaration; the fixture names cluster C.
  const catalogued = (file, src, catalogueClusters = ['C']) =>
    ctxWith([screen(file, src)], { config: { ...config, catalogueClusters } });
  add('listPanelGate', 'a list with no panel',
    ctxWith([screen('x-01-a', "filterBar({ total: '4건' })\ntable({ rows: [] })")]), true);
  add('listPanelGate', 'a catalogue specimen of a list needs no panel',
    catalogued('c-21-history', "filterBar({ total: '4건' })\ntable({ rows: [] })"), false);
  add('listPanelGate', 'outside a declared catalogue the same list needs one',
    catalogued('c-21-history', "filterBar({ total: '4건' })\ntable({ rows: [] })", []), true);
  add('listPanelGate', 'states why there is no panel',
    ctxWith([screen('x-01-a', "filterBar({ total: '4건' })\ntable({ rows: [] })\n  pageList: '격자가 곧 입력면이다'")]), false);
  add('canvasListGate', 'a drawing and a list stacked',
    ctxWith([screen('x-01-a', 'canvasPh({ marks: [] })\ntable({ rows: [] })')]), true);
  add('canvasListGate', 'states what the drawing shows',
    ctxWith([screen('x-01-a', "canvasPh({ marks: [] })\ntable({ rows: [] })\n  pageCanvas: '도면은 놓인 것을, 표는 아직 놓이지 않은 것을 보인다'")]), false);
  add('calendarListGate', 'a calendar and a list stacked', ctxWith([screen('x-01-a', 'calendar({ month: 8 })\ntable({ rows: [] })')]), true);
  add('calendarListGate', 'a view switch is there', ctxWith([screen('x-01-a', "calendar({ month: 8 })\ntable({ rows: [] })\nviews: ['목록', '달력']")]), false);
  add('registerGate', 'a chart note in the plain register',
    ctxWith([screen('x-01-a', "note: '목표는 그림 안에 그린다',")]), true);
  add('registerGate', 'a declared catalogue cluster is not measured',
    catalogued('c-25-charts', "note: '목표는 그림 안에 그린다',"), false);
  add('registerGate', 'a cluster no board declared as its catalogue is measured',
    catalogued('c-25-charts', "note: '목표는 그림 안에 그린다',", []), true);
  add('listColumnGate', 'a list of four columns',
    ctxWith([screen('x-01-a', "const list =\n  table({ head: [th('a', { w: 'w2' }), th('b'), th('c'), th('', { w: 'fix' })],\n  })\nconst panel = listDetail(list, panel)")]), true);
  add('listColumnGate', 'a list of three columns',
    ctxWith([screen('x-01-a', "const list =\n  table({ head: [th('a', { w: 'w2' }), th('c'), th('', { w: 'fix' })],\n  })\nconst panel = listDetail(list, panel)")]), false);
  add('pageActionGate', 'a button row in the flow',
    ctxWith([screen('x-01-a', "pageHeader({ title: 'x' }) + btnRow(btn('가기'))")]), true);
  add('pageActionGate', 'a titleless form\'s primary button',
    ctxWith([screen('x-01-a', "btnRow(btn('로그인', 'primary'))")]), false);
  add('pageActionGate', 'a catalogue specimen carries its own buttons',
    catalogued('c-09-empty', "pageHeader({ title: 'x' }) + btnRow(btn('다시 시도'))"), false);
  add('pageActionGate', 'outside a declared catalogue the same frame is a page',
    catalogued('c-09-empty', "pageHeader({ title: 'x' }) + btnRow(btn('다시 시도'))", []), true);
  // The vocabulary is the board's declaration; the fixture's words are placeholders.
  const WORDS = ['법정 기본', '설치 기본', '현장 설정'];
  const badged = (src, sourceWords = WORDS) => ctxWith([screen('x-01-a', src)], { config: { ...config, sourceWords } });
  add('sourceWordGate', 'a word outside the declared vocabulary',
    badged("sourceBadge('이 현장', '근거')"), true);
  add('sourceWordGate', 'one of the declared words',
    badged("sourceBadge('현장 설정', '근거')"), false);
  add('sourceWordGate', 'a board that declares no vocabulary is not held to one',
    badged("sourceBadge('이 현장', '근거')", []), false);
  add('dotSpacingGate', 'mixed within one list',
    ctxWith([screen('x-01-a', "screen: '교육 세션 · 참석·서명·이해도',")]), true);
  add('dotSpacingGate', 'a list of phrases is spaced throughout',
    ctxWith([screen('x-01-a', "screen: '교육 세션 · 참석 · 서명 · 이해도',")]), false);
  add('dotSpacingGate', 'a list of words is joined throughout',
    ctxWith([screen('x-01-a', "screen: '재해율 지표 (도수율·강도율·연천인율)',")]), false);
  // A compound term declared in board.config.mjs is one item, so the point inside it is not a
  // list separator - without this the gate reads 「시정·예방조치 보드」 as two items and asks for
  // a space inside a word.
  add('dotSpacingGate', 'a declared compound is one word',
    ctxWith([screen('x-01-a', "screen: '시정·예방조치 보드',")],
      { config: { ...config, compoundTerms: ['시정·예방조치'] } }), false);
  add('dotSpacingGate', 'an undeclared compound reads as a list',
    ctxWith([screen('x-01-a', "screen: '시정·예방조치 보드',")],
      { config: { ...config, compoundTerms: [] } }), true);
  add('screenKindGate', 'the name repeats the kind',
    ctxWith([screen('x-01-a', "screen: '설비 목록 — 검사 일정 잡기 (다이얼로그)', state: '의뢰 기록',")]), true);
  add('screenKindGate', 'only state says the kind',
    ctxWith([screen('x-01-a', "screen: '설비 목록 — 검사 일정 잡기', state: '다이얼로그 · 의뢰 기록',")]), false);
  // ── documents ─────────────────────────────────────────────────────────────────
  // Each of these fires on the shape that actually got through once. A throwaway tree stands in for
  // `docs/` and `_plans/`, and `documents` in the ctx's config points at it.

  add('helpShapeGate', 'the title is a statement',
    ctxWith([screen('x-01-a', "  helpCard({\n    title: '노출 하나가 30년을 간다',\n    hint: '즉시 조치 · 6개월 추적 · 30년 보존',\n  })")]), true);
  add('helpShapeGate', 'the title is a question',
    ctxWith([screen('x-01-a', "  helpCard({\n    title: '노출 하나가 왜 30년을 가는가',\n    hint: '즉시 조치 · 6개월 추적 · 30년 보존',\n  })")]), false);
  add('helpShapeGate', 'the title is a noun phrase',
    ctxWith([screen('x-01-a', "  helpCard({\n    title: '중지와 재개의 무게 차이',\n    hint: '멈추는 쪽 · 다시 시작하는 쪽',\n  })")]), false);
  add('helpShapeGate', 'one segment of the hint is a sentence',
    ctxWith([screen('x-01-a', "  helpCard({\n    title: '무엇이 남는가',\n    hint: '접수 → 조사 → 종결 · 열람이 남는다',\n  })")]), true);
  add('helpShapeGate', 'a segment ending in 「마다」 is not a predicate',
    ctxWith([screen('x-01-a', "  helpCard({\n    title: '반기 확인은 무엇까지 보는가',\n    hint: '6개월마다 · 종료 시 · 수시 확인',\n  })")]), false);
  // A companion is judged against its base, not against a fixed column count. The base's source is
  // what says which of the two layouts is right, so every case here carries both files.
  const LD_BASE = screen('x-02-b', "listDetail(list, detail)");
  const REC_BASE = screen('x-02-b', "pageHeader({ title: 'x' }) + recordTabs([{ label: '개요' }], body)");
  const WITH_PH = "import base, { head, tabStrip } from './x-02-b.mjs';\nlistDetail(regionPh({ label: 'l', ref: 'r' }), tabPanes({ strip: tabStrip, open: '개요', ref: 'r', panes: [] }))";
  const NO_PH = "import base, { head, tabStrip } from './x-02-b.mjs';\nhead + tabPanes({ strip: tabStrip, open: '개요', ref: 'r', panes: [], region: '화면' })";
  add('companionFollowsBaseLayoutGate', 'draws a placeholder for a base with no list column',
    ctxWith([screen('x-01-a', WITH_PH), REC_BASE]), true);
  add('companionFollowsBaseLayoutGate', 'a full-page record base stacks at full width',
    ctxWith([screen('x-01-a', NO_PH), REC_BASE]), false);
  add('companionFollowsBaseLayoutGate', 'a list-detail base and no placeholder',
    ctxWith([screen('x-01-a', NO_PH), LD_BASE]), true);
  add('companionFollowsBaseLayoutGate', 'a list-detail base keeps a place on the left',
    ctxWith([screen('x-01-a', WITH_PH), LD_BASE]), false);
  // Only a companion is judged - an ordinary screen drawing a list-detail imports no base.
  add('companionFollowsBaseLayoutGate', 'a screen that is not a companion is not judged',
    ctxWith([screen('x-01-a', "listDetail(list, detail)"), LD_BASE]), false);

  add('tagCollisionGate', 'a phase tag equals a feature tag',
    ctxWith([], { config: { ...config, phases: { pack: { tag: '건설 팩' } }, features: { PACK_CONSTRUCTION: { tag: '건설 팩' } } } }), true);
  add('tagCollisionGate', 'the two axes use different words',
    ctxWith([], { config: { ...config, phases: { pack: { tag: '팩 대기' } }, features: { PACK_CONSTRUCTION: { tag: '건설 팩' } } } }), false);
  add('featureGate', 'a key not in the catalogue',
    ctxWith([screen('x-01-a', "\n  notes: 'AUTH: 세션 · 기능 키 PACK_UNKNOWN',\n  body: x,")], {
      manifest: [{ letter: 'X', title: 't', screens: [{ file: 'x-01-a', feature: 'PACK_UNKNOWN' }] }],
      html: '<span class="fft">건설 팩</span>',
    }), true);
  add('featureGate', 'notes and manifest disagree',
    ctxWith([screen('x-01-a', "\n  notes: 'AUTH: 세션 · 기능 키 CONNECTED',\n  body: x,")], {
      manifest: [{ letter: 'X', title: 't', screens: [{ file: 'x-01-a', feature: 'PACK_CONSTRUCTION' }] }],
      html: '<span class="fft">건설 팩</span>',
    }), true);
  add('featureGate', 'declaration, chip and notes agree',
    ctxWith([screen('x-01-a', "\n  notes: 'AUTH: 세션 · 기능 키 PACK_CONSTRUCTION',\n  body: x,")], {
      manifest: [{ letter: 'X', title: 't', screens: [{ file: 'x-01-a', feature: 'PACK_CONSTRUCTION' }] }],
      html: '<span class="fft">건설 팩</span>',
    }), false);
  add('featureGate', 'declared, and the notes carry no key',
    ctxWith([screen('x-01-a', "\n  notes: 'AUTH: 세션',\n  body: x,")], {
      manifest: [{ letter: 'X', title: 't', screens: [{ file: 'x-01-a', feature: 'PACK_CONSTRUCTION' }] }],
      html: '<span class="fft">건설 팩</span>',
    }), true);
  add('featureGate', 'inheriting base.notes is not asked',
    ctxWith([screen('x-01-a', "\n  notes: base.notes + '한 줄',\n  body: x,")], {
      manifest: [{ letter: 'X', title: 't', screens: [{ file: 'x-01-a', feature: 'PACK_CONSTRUCTION' }] }],
      html: '<span class="fft">건설 팩</span>',
    }), false);
  add('panelDupVerbGate', 'the same verb in both rows',
    ctxWith([screen('x-01-a', "panelVerbs(btn('명단 조정') + btn('세션 열기')) +\n  panelFoot(btn('닫기', 'ghost') + btn('세션 열기', 'primary'))")]), true);
  add('panelDupVerbGate', 'the two rows carry different things',
    ctxWith([screen('x-01-a', "panelVerbs(btn('명단 조정') + btn('강사 지정')) +\n  panelFoot(btn('닫기', 'ghost') + btn('세션 열기', 'primary'))")]), false);
  add('fieldBadgeGate', 'a badge in a one-line input value',
    ctxWith([screen('x-01-a', "fSelect({ label: '자동번역', value: `켬 ${envBadge('자동번역')}` })")]), true);
  add('fieldBadgeGate', 'the badge moved to the hint',
    ctxWith([screen('x-01-a', "fSelect({ label: '자동번역', value: '켬', hint: `꺼집니다 ${envBadge('자동번역')}` })")]), false);
  add('fieldBadgeGate', 'fMulti is a field that holds badges',
    ctxWith([screen('x-01-a', "fMulti({ label: '보존', value: `3년 ${sourceBadge('법정 기본', '제164조')}` })")]), false);
  add('hollowDialogGate', 'the label says dialog and nothing is drawn',
    base({ loaded: [{ num: 'X-01', file: 'x-01-a', label: '구역 추가 (다이얼로그)', mod: { overlay: '<div class="thing">' } }] }), true);
  add('hollowDialogGate', 'a dialog is drawn',
    base({ loaded: [{ num: 'X-01', file: 'x-01-a', label: '구역 추가 (다이얼로그)', mod: { overlay: '<div class="modal">' } }] }), false);

  // 단계 표시. `phased` builds the pair the gate compares: what the manifest declares against
  // what reached the page.
  const phased = (manifest, html, loaded = []) => base({ manifest, html, loaded });
  const BAND = '<article class="frame deferred" id="s-k-01"><div class="phase-band"><b>2단계</b></div></article>';
  add('phaseGate', 'declared and not drawn',
    phased([{ letter: 'K', title: 'k', phase: 2, screens: [{ file: 'k-01-a' }] }],
      '<article class="frame" id="s-k-01"></article>'), true);
  add('phaseGate', 'declared and drawn',
    phased([{ letter: 'K', title: 'k', phase: 2, screens: [{ file: 'k-01-a' }] }], BAND), false);
  add('phaseGate', 'the notes name a phase and nothing is declared',
    phased([{ letter: 'X', title: 'x', screens: [{ file: 'x-01-a' }] }], '',
      [{ num: 'X-01', file: 'x-01-a', mod: { notes: '<strong>3단계다</strong> — 나중에 만든다' } }]), true);
  // 「2단계 인증」 is an MFA screen's subject matter, not a schedule - keying on the bare word catches it.
  add('phaseGate', '「2단계」 as subject matter',
    phased([{ letter: 'A', title: 'a', screens: [{ file: 'a-05-a' }] }], '',
      [{ num: 'A-05', file: 'a-05-a', mod: { notes: '<strong>2단계 인증</strong>을 요구한다' } }]), false);

  // Role verdicts. The matrix arrives on ctx, so the fixture states it outright rather than
  // pointing at a real board - which is what let these two cases pass against whatever the
  // repository happened to contain instead of against a case they control.
  const ROLE_MATRIX = {
    ROLES: { sys: '시스템 관리자', partner: '협력사 관리자' },
    CLUSTER_ROLES: { N: { sys: 'full' } },
    NOT_COVERED: {},
    rolesOf: (letter, over) => (ROLE_MATRIX.CLUSTER_ROLES[letter]
      ? { ...ROLE_MATRIX.CLUSTER_ROLES[letter], ...over } : null),
  };
  const roled = (loaded, manifest = [{ letter: 'N', title: 'n', screens: [] }]) =>
    base({ roles: ROLE_MATRIX, manifest, loaded });
  const chartSrc = (src) => t.ctxWith([{ file: 'x-01a-a', src }]);
  add('chartAxisGate', 'both axis names missing',
    chartSrc("chartPh({ kind: 'bar', title: '월별 비용' })"), true);
  add('chartAxisGate', 'only one axis named',
    chartSrc("chartPh({ kind: 'bar', title: '월별 비용', y: '비용(천 원)' })"), true);
  add('chartAxisGate', 'both axes named',
    chartSrc("chartPh({ kind: 'bar', title: '월별 비용', y: '비용(천 원)', x: '월' })"), false);
  add('chartAxisGate', 'progress is not a chart read by its axes',
    chartSrc("chartPh({ kind: 'progress', title: '준수율', goal: '목표 95%' })"), false);

  add('consoleBrandGate', 'a placeholder is drawn',
    base({ html: '<div class="topnav"><span class="tn-brand">PRODUCT</span></div>' }), true);
  add('consoleBrandGate', 'the product name is drawn',
    base({ html: '<div class="topnav"><span class="tn-brand">OA 소모품 관리시스템</span></div>' }), false);
  add('consoleBrandGate', 'a board drawing no console is not asked', base({ html: '<div class="auth"></div>' }), false);

  add('roleGate', 'AUTH names a role the verdicts lack',
    roled([{ num: 'N-02', file: 'n-02-a', mod: { notes: 'AUTH: safety-admin 세션 · 시스템 관리자 (협력사 관리자는 자사 인력 초대만)<br>' } }]), true);
  add('roleGate', 'the frame declares it in roles',
    roled([{ num: 'N-02', file: 'n-02-a', mod: { roles: { partner: 'scoped' }, notes: 'AUTH: safety-admin 세션 · 시스템 관리자 (협력사 관리자는 자사 인력 초대만)<br>' } }]), false);
  add('roleGate', 'names a role the verdicts hold',
    roled([{ num: 'N-02', file: 'n-02-a', mod: { notes: 'AUTH: safety-admin 세션 · 시스템 관리자<br>' } }]), false);
  // A cluster with neither a verdict nor a 「대상 아님」 reason has fallen out of the matrix.
  add('roleGate', 'a cluster missing from the matrix',
    roled([], [{ letter: 'Y', title: 'y', screens: [] }]), true);
  // The names are the board's, so a board with its own keys is judged by its own vocabulary
  // rather than by a table in the pattern - which used to report every frame and name the role
  // `undefined`.
  const OWN = {
    ROLES: { admin: '시스템 관리자', branch: '본부 담당자' },
    CLUSTER_ROLES: { N: { admin: 'full' } },
    NOT_COVERED: {},
    rolesOf: (letter, over) => (OWN.CLUSTER_ROLES[letter] ? { ...OWN.CLUSTER_ROLES[letter], ...over } : null),
  };
  const owned = (notes) => base({ roles: OWN, manifest: [{ letter: 'N', title: 'n', screens: [] }],
    loaded: [{ num: 'N-02', file: 'n-02-a', mod: { notes } }] });
  add('roleGate', 'judged by the board\'s own role names', owned('AUTH: 본부 담당자<br>'), true);
  add('roleGate', 'quiet when the board\'s own name is in the verdicts', owned('AUTH: 시스템 관리자<br>'), false);
  // An alias the board declares is searched beside the name; one it does not declare is not.
  const ALIASED = { ...OWN, ROLE_ALIASES: { branch: ['사업소 담당'] } };
  add('roleGate', 'an alias the board declares counts as named',
    base({ roles: ALIASED, manifest: [{ letter: 'N', title: 'n', screens: [] }],
      loaded: [{ num: 'N-02', file: 'n-02-a', mod: { notes: 'AUTH: 사업소 담당<br>' } }] }), true);

  // The list-detail region is the LAST thing on the page: the panel is a full-height column whose
  // footer is pinned to the floor, so a block appended after the two columns lands under a panel
  // that has already ended - the reader sees the record's actions and then more page beneath them.
  //
  // The gate walks forward from the call to the bracket that CLOSES the enclosing expression, so
  // the fixture has to have one. Without it the walk runs off the end of the source and the gate
  // reports nothing - which is what a first attempt at these cases did, passing for no reason.
  const tail = (after) => ctxWith([screen('x-01-a',
    'export default { body: console_({ main: pageHeader({}) + listDetail(list, panel)' + after + ' }) };')]);
  add('panelTailGate', 'another block below the list-detail', tail(" + section('더', 'x')"), true);
  add('panelTailGate', 'ends with the list-detail', tail(''), false);

  // 목록 탭 → 칩 필터 → 목록 is one act and the three sit together, so the gate reads the rendered
  // frame: the surface a screen draws is often a branch, and a source sweep sees the condition.
  const chain = (inner, mod = {}) => ctxWith([{ ...screen('x-01-a', ''), mod: { body: `<div class="main">${inner}</div>`, ...mod } }]);
  const TABS = '<div class="ltabs"><span class="ltab active">전체</span></div>';
  const CHIPS = '<div class="chips"><span class="chip active">전체</span></div>';
  const TILES = '<div class="grid-4"><div class="tile"></div></div>';
  const LIST = '<div class="listdetail"></div>';
  add('filterChainGate', 'tiles between the tabs and the list', chain(TABS + TILES + LIST), true);
  add('filterChainGate', 'tabs, chip filter and list stand together', chain(TILES + TABS + CHIPS + LIST), false);
  // The order is part of the rule: a chip row under the bar that counts what it narrowed reads as
  // a filter over the total rather than the thing the total is counting.
  add('filterChainGate', 'the chip filter comes after the list bar',
    chain(TABS + '<div class="filterbar"></div>' + CHIPS + '<div class="table"></div>'), true);
  // A chip row that picks what the whole page IS - a dashboard's period, an assessment method, the
  // paper a preview draws on - is not a list filter, and the frame says so in one sentence.
  add('filterChainGate', 'states that the chips are not a list filter',
    chain(CHIPS + TILES + '<div class="table"></div>', { pageChips: '대시보드 전체의 기간이다' }), false);
  add('filterChainGate', 'pageChips gives no reason',
    chain(CHIPS + TILES + '<div class="table"></div>', { pageChips: '' }), true);
  // A chip row with no list under it is a set of tags, not a filter - the chain is only a chain
  // once it reaches a list.
  add('filterChainGate', 'a chip row with no list', chain(CHIPS + '<div class="attach"></div>'), false);
  // The language switch picks which language a kept field is read in; it narrows no list, so it is
  // neither a member of the chain nor something wedged into it.
  add('filterChainGate', 'a language switch is not judged',
    chain(TABS + '<div class="ltabs lang"><span class="ltab">한국어</span></div>' + LIST), false);

  // ── the presentation rules a page carries ────────────────────────────────────
  add('panelCloseIsPlainGate', 'a panel\'s close is a ghost button',
    ctxWith([screen('x-01-a', "panelFoot(btn('닫기', 'ghost') + btn('편집', 'primary'))")]), true);
  add('panelCloseIsPlainGate', 'a panel\'s close is an ordinary button',
    ctxWith([screen('x-01-a', "panelFoot(btn('닫기') + btn('편집', 'primary'))")]), false);
  // 취소 IS the secondary act beside 저장, so a form panel keeps it ghost.
  add('panelCloseIsPlainGate', 'a form panel\'s cancel stays as it is',
    ctxWith([screen('x-01-a', "panelForm({ title: 'x', children: '', foot: btn('취소', 'ghost') + btn('저장', 'primary') })")]), false);
  // A dialog closes over a dimmed page and carries its own ✖ - the rule is about the panel.
  add('panelCloseIsPlainGate', 'a dialog\'s close is not judged',
    ctxWith([screen('x-01-a', "dialog({ title: 'x', children: '', foot: btn('닫기', 'ghost') })")]), false);

  add('auditFootFirstTabGate', 'draws the audit line with the second pane open',
    ctxWith([screen('x-01-a', "tabs([{ label: '개요' }, { label: '서명', active: true }])\nauditFoot({ id: 'a1', at: '2026-01-01' }, null)")]), true);
  add('auditFootFirstTabGate', 'draws the audit line on the first pane',
    ctxWith([screen('x-01-a', "tabs([{ label: '개요', active: true }, { label: '서명' }])\nauditFoot({ id: 'a1', at: '2026-01-01' }, null)")]), false);
  add('auditFootFirstTabGate', 'a companion frame draws the audit line',
    ctxWith([screen('x-01-a', "tabPanes({ strip, open: '개요', ref: 'x', panes: [] })\nauditFoot({ id: 'a1', at: '2026-01-01' }, null)")]), true);
  add('auditFootFirstTabGate', 'a panel without tabs is not judged',
    ctxWith([screen('x-01-a', "auditFoot({ id: 'a1', at: '2026-01-01' }, null)")]), false);

  // The gate asks a different question of each kind of board, so both kinds are proved - and both
  // are stated rather than inherited, because a case that leans on the harness's default proves
  // whichever way that default happens to fall rather than the mode it is named after.
  const on = { config: { ...config, patternOptions: { dismissibleNotices: true } } };
  const off = { config: { ...config, patternOptions: { dismissibleNotices: false } } };

  // Recoverable: withholding the close is the defect, and a count in the title is not a reason.
  add('aStandingCardClosesWhenItCanGate', 'recoverable and status took the close away',
    ctxWith([screen('x-01-a', "msg({ kind: 'warn', status: true, title: '정책이 없는 안전구역이 1개 있습니다' })")], on), true);
  add('aStandingCardClosesWhenItCanGate', 'recoverable and it closes',
    ctxWith([screen('x-01-a', "msg({ kind: 'warn', title: '정책이 없는 안전구역이 1개 있습니다' })")], on), false);

  // Not recoverable: a dismissal is a deletion, so a card about what is on the site must declare.
  add('aStandingCardClosesWhenItCanGate', 'not recoverable and nothing declared',
    ctxWith([screen('x-01-a', "msg({ kind: 'warn', title: '정책이 없는 안전구역이 1개 있습니다' })")], off), true);
  add('aStandingCardClosesWhenItCanGate', 'not recoverable and declared a status card',
    ctxWith([screen('x-01-a', "msg({ kind: 'warn', status: true, title: '정책이 없는 안전구역이 1개 있습니다' })")], off), false);
  // A standing fact that happens to name a number is the author's call, and `dismiss` records it.
  add('aStandingCardClosesWhenItCanGate', 'not recoverable and declared a dismissible card',
    ctxWith([screen('x-01-a', "msg({ kind: 'info', dismiss: true, title: '한 조문이 요구를 여럿 만듭니다', body: '2건까지 나옵니다' })")], off), false);

  // 오류·예시·근거 are not notice cards, so neither question is asked of them.
  add('aStandingCardClosesWhenItCanGate', 'an error is not judged',
    ctxWith([screen('x-01-a', "msg({ kind: 'error', title: '필수 항목 3개가 비어 있습니다' })")], on), false);
  add('aStandingCardClosesWhenItCanGate', 'a card that names no count',
    ctxWith([screen('x-01-a', "msg({ kind: 'help', status: true, title: '이 화면에서 하는 일' })")], on), false);
  // **The built page rather than the source.** Every source rule about these cards has been
  // narrower than the rule - one never read the `dismiss` values, one wrote its exemption from a
  // shape, one read only the first card on a page. This one asks what the reader is shown.
  const withHeader = '<span class="noticons"><span class="nic warn"></span></span>';
  const card = (extra = '') =>
    `<div class="msg warn"><span class="mkind"><i>!</i>주의</span>` +
    `<div class="mbody"><div class="mtitle">정책이 없는 안전구역이 1개 있습니다</div></div>${extra}</div>`;
  const frame = (inner) => ({ html: `<article class="frame" id="X-01">${inner}</article>` });

  add('everyStandingCardDrawsItsCloseGate', 'a control to bring cards back and no close',
    ctxWith([], frame(withHeader + card())), true);
  add('everyStandingCardDrawsItsCloseGate', 'the same screen draws the close',
    ctxWith([], frame(withHeader + card('<span class="n-close" title="닫기">✕</span>'))), false);
  // A sign-in panel and a phone body draw no header control, so a close there deletes the message.
  add('everyStandingCardDrawsItsCloseGate', 'a screen with no control to bring cards back is not asked',
    ctxWith([], frame(card())), false);
  // The drop draws each hidden card again with 「다시 보이기」 beside it rather than a close.
  add('everyStandingCardDrawsItsCloseGate', 'a copy inside the drop is not a card on the page',
    ctxWith([], frame(`${withHeader}<div class="noticedrop"><div class="nd-item">${card()}</div></div>`)), false);
  // 오류 is the one kind that answers what the reader just pressed, and it never closes.
  add('everyStandingCardDrawsItsCloseGate', 'an error is not judged',
    ctxWith([], frame(`${withHeader}<div class="msg error"><span class="mkind"><i>!</i>오류</span><div class="mbody"><div class="mtitle">저장할 수 없습니다</div></div></div>`)), false);

}
