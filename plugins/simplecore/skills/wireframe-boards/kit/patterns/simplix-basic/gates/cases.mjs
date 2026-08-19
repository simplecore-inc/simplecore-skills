// The two cases every simplix-basic gate is held to: one board that must trip it, one that must
// not. They live beside the gates rather than in the kit, because they describe what is wrong on
// a board drawn THIS way — a register, a list-detail layout, the words its controls share.
//
// **A gate added to `gates/content.mjs` gets its cases here in the same change** —
// `node wf.mjs gates` reports any gate that has none.
export function cases(t) {
  const { add, config, base, screen, ctxWith } = t;

  // ── content ───────────────────────────────────────────────────────────────────
  add('titleFormGate', '화면 이름이 문장',
    ctxWith([screen('x-01-a', "pageHeader({\n  title: '기록을 저장한다',")]), true);
  add('titleFormGate', '화면 이름이 명사형',
    ctxWith([screen('x-01-a', "pageHeader({\n  title: '저장 내역',")]), false);
  // tTitle is not a judged slot — this board writes a heading inside an explanation as the rule it states.
  add('titleFormGate', 'tTitle은 대상이 아니다',
    ctxWith([screen('x-01-a', "tTitle('갈음 관계 — 한 기록이 두 의무를 채운다')")]), false);
  // The title gate reads two slots only — a page's name and a dialog's name. A help dialog states
  // the rule it explains, which is this board's convention, and `msg`/`emptyState` titles are the
  // product speaking to a user, so neither was ever in scope.
  add('titleFormGate', '다이얼로그 이름이 합니다체',
    ctxWith([screen('x-01-a', "const reject = dialog({\n  title: '반려 사유를 적습니다',")]), true);
  add('titleFormGate', '도움말은 규칙을 진술한다',
    ctxWith([screen('x-01-a', "export const help = dialog({\n  title: '자리마다 보고 기한이 다르다',")]), false);
  add('titleFormGate', '메시지 제목은 문장이 정상',
    ctxWith([screen('x-01-a', "msg({\n  kind: 'warn',\n  title: '게시할 수 없습니다',")]), false);
  // A closed list of endings let 「읽힌다」 and 「뗀다」 through — any 「~다」 ending is read now.
  add('titleFormGate', '목록에 없던 어미',
    ctxWith([screen('x-01-a', "const peek = dialog({\n  title: '오늘 적은 값이 30년 뒤에 읽힌다',")]), true);

  add('registerGate', '화면 문구가 -다체', ctxWith([screen('x-01-a', 'class="t-body">서명을 받는다<')]), true);
  add('registerGate', '화면 문구가 합니다체', ctxWith([screen('x-01-a', 'class="t-body">서명을 받습니다<')]), false);
  // A value is the larger surface — eight sat here, one inside a template literal where a quoted-string sweep could not see it.
  add('registerGate', '값이 -다체', ctxWith([screen('x-01-a', "dField({ label: '허용', value: '표에 행을 넣는다' })")]), true);
  add('registerGate', '템플릿 리터럴 값도 본다',
    ctxWith([screen('x-01-a', 'dField({ label: \'기록\', value: `접속 건수가 남는다 ${badge(\'법정\')}` })')]), false || true);
  add('registerGate', '값이 합니다체', ctxWith([screen('x-01-a', "dField({ label: '허용', value: '표에 행을 넣습니다' })")]), false);
  // A noun or adverb that merely ends in 「다」 is not the plain register.
  add('registerGate', '다로 끝나는 부사', ctxWith([screen('x-01-a', "fSelect({ label: '주기', value: '30분마다' })")]), false);
  add('registerGate', '다로 끝나는 명사', ctxWith([screen('x-01-a', "statTile({ label: '한 사람이 대리한 최다', value: '4건' })")]), false);
  // An explanation states its rule as the heading and answers in 합니다체 underneath — that heading is not judged.
  add('registerGate', '넓은 필드의 라벨은 설명 제목이다',
    ctxWith([screen('x-01-a', "dField({ label: '주기는 사업장이 고르지 않는다', value: '직전 결과가 정합니다', wide: true })")]), false);
  add('registerGate', '도움말 카드의 주제 목록',
    ctxWith([screen('x-01-a', "helpCard({ title: '왜 필요한가', hint: '알린 기록이 없으면 계획서만 남는다' })")]), false);
  add('registerGate', '설명 블록의 머리글',
    ctxWith([screen('x-01-a', "sectHead('누가 눌렀는지가 남는다')")]), false);
  // `notes` is the board speaking to its reader, not the product speaking to a user.
  add('registerGate', 'notes는 대상이 아니다',
    ctxWith([screen('x-01-a', "  notes: 'AUTH: x<br>여기서 기록이 남는다',\n  body: '',")]), false);
  // The far side of the same rule: the board's own voice drifting into 합니다체.
  add('notesRegisterGate', 'notes가 합니다체',
    ctxWith([screen('x-01-a', "  notes: '<strong>목록을 보인다</strong> 상세는 패널에 표시합니다.',\n  body: '',")]), true);
  add('notesRegisterGate', 'notes가 -다체',
    ctxWith([screen('x-01-a', "  notes: '<strong>목록을 보인다</strong> 상세는 패널에 표시한다.',\n  body: '',")]), false);
  // The ending that closes on a cross-reference, not a period — the shape that hid 36 of them.
  add('notesRegisterGate', '참조로 끝나는 합니다체',
    ctxWith([screen('x-01-a', "  notes: '상세는 패널에 표시합니다({{p-04-list-detail}}).',\n  body: '',")]), true);
  // Copy quoted from the screen keeps the screen's register.
  add('notesRegisterGate', '인용한 화면 문구는 대상이 아니다',
    ctxWith([screen('x-01-a', "  notes: '경고는 「저장했습니다.」로 적는다',\n  body: '',")]), false);

  // ── the board's today ────────────────────────────────────────────────────────
  // Today is fixed by board.config (2026-08-12); the dates in the fixtures below are tied to it.
  add('dDayGate', '배지가 하루 크다',
    ctxWith([screen('x-01-a', "dField({ label: '기한', value: badge('2026-08-16 · D-5') })")]), true);
  add('dDayGate', '배지가 맞다',
    ctxWith([screen('x-01-a', "dField({ label: '기한', value: badge('2026-08-16 · D-4') })")]), false);
  // The D in 「AUD-2026」 is not a D-day.
  add('dDayGate', '앞 글자가 붙은 D',
    ctxWith([screen('x-01-a', "'AUD-2026-02 · 2026-06-15 실시'")]), false);
  // D-n counts toward a day still to come — a past date elsewhere in the same window is not its pair.
  add('dDayGate', '창 안의 지난 날짜',
    ctxWith([screen('x-01-a', "'사유 종료 2026-08-06'\n'기한 2026-08-16 · D-4'")]), false);

  add('clockGate', '감사 꼬리표가 미래다',
    ctxWith([screen('x-01-a', "auditFoot({ id: 'a_1', at: '2026-09-01 10:00' }, '미해소')")]), true);
  add('clockGate', '감사 꼬리표가 과거다',
    ctxWith([screen('x-01-a', "auditFoot({ id: 'a_1', at: '2026-08-01 10:00' }, '미해소')")]), false);
  // A step drawn as finished must carry a date already past.
  add('clockGate', '끝난 단계가 미래다',
    ctxWith([screen('x-01-a', "{ label: '작성', who: '김안전', at: '2026-08-20', state: 'done' }")]), true);
  add('clockGate', '앞으로 올 기한',
    ctxWith([screen('x-01-a', "fSelect({ label: '조치 기한', value: '2026-08-20' })")]), false);

  add('clockGate', '경과일이 하루 적다',
    ctxWith([screen('x-01-a', "badge('3일 전 · 2026-08-08 버전')")]), true);
  add('clockGate', '경과일이 맞다',
    ctxWith([screen('x-01-a', "badge('4일 전 · 2026-08-08 버전')")]), false);
  // A day still to come is not the pair of 「N일 전」.
  add('clockGate', '앞으로 올 날은 세지 않는다',
    ctxWith([screen('x-01-a', "'기한 2026-08-20'\n'마지막 점검 4일 전'")]), false);

  add('newModeGate', '고른 레코드와 빈 폼이 한 주소에',
    ctxWith([screen('x-01-a', "  url: 'x.example.com/incidents?view=inc_0312&mode=new',")]), true);
  add('newModeGate', '빈 폼만',
    ctxWith([screen('x-01-a', "  url: 'x.example.com/incidents?mode=new',")]), false);
  add('newModeGate', '고른 레코드를 편집',
    ctxWith([screen('x-01-a', "  url: 'x.example.com/incidents?view=inc_0312&mode=edit',")]), false);

  add('recordIdGate', '주소와 꼬리표가 다른 레코드',
    ctxWith([screen('x-01-a', "  url: 'x.example.com/sessions/ses_0142',\n  auditFoot({ id: 'ses_0244', at: '2026-08-01 10:00' }, '')")]), true);
  add('recordIdGate', '주소와 꼬리표가 같다',
    ctxWith([screen('x-01-a', "  url: 'x.example.com/sessions/ses_0142',\n  auditFoot({ id: 'ses_0142', at: '2026-08-01 10:00' }, '')")]), false);
  // A truncated hash in the address is not a different record.
  add('recordIdGate', '주소의 해시가 잘렸다',
    ctxWith([screen('x-01-a', "  url: 'x.example.com/sig/sig_9f2ca',\n  auditFoot({ id: 'sig_9f2ca81b4d7e', at: '2026-08-01 10:00' }, '')")]), false);

  add('badgeFormGate', '배지가 문장이다',
    ctxWith([screen('x-01-a', "badge('먼저 닫아야 합니다')")]), true);
  add('badgeFormGate', '배지가 -다체다',
    ctxWith([screen('x-01-a', "badge('아니다')")]), true);
  // The 「~ㅁ」 ending and the noun form are this board's badge vocabulary.
  add('badgeFormGate', '배지가 상태 이름이다',
    ctxWith([screen('x-01-a', "badge('이상 없음') + badge('43일 남음') + badge('차단')")]), false);

  add('labelFormGate', 'dField 라벨이 -다체',
    ctxWith([screen('x-01-a', "dField({ label: '침묵과 정상은 다르다', value: '값' })")]), true);
  add('labelFormGate', 'dField 라벨이 조건절',
    ctxWith([screen('x-01-a', "dField({ label: '끊기면', value: '값' })")]), true);
  // 「석면」 is a noun that ends the same way.
  add('labelFormGate', '면으로 끝나는 명사',
    ctxWith([screen('x-01-a', "dField({ label: '석면', value: '있음' })")]), false);
  add('labelFormGate', 'badge가 완결된 절',
    ctxWith([screen('x-01-a', "badge('이름이 같음', 'outline')")]), true);
  // Noun plus negated existence is this board's standard badge shape.
  add('labelFormGate', '배지의 표준 형태',
    ctxWith([screen('x-01-a', "badge('허가 없음') + badge('리더 없음') + badge('이상 없음')")]), false);
  add('labelFormGate', 'statTile 라벨이 동작이다',
    ctxWith([screen('x-01-a', "statTile({ label: '확인함', value: '118', unit: '건' })")]), true);
  // 「포함」 is a noun that ends the same way.
  add('labelFormGate', '함으로 끝나는 명사',
    ctxWith([screen('x-01-a', "statTile({ label: '개인정보 포함', value: '3', unit: '건' })")]), false);
  // 「연결 안 됨」 is a category of zone, the standard 노운+없음 shape.
  add('labelFormGate', '안 됨으로 끝나는 명사',
    ctxWith([screen('x-01-a', "statTile({ label: '연결 안 됨', value: '5', unit: '개' })")]), false);

  add('refLeakGate', '화면 문구에 프레임 참조',
    ctxWith([screen('x-01-a', "  body: tSub('변경은 {{p-18-change-history}}에 남습니다'),")]), true);
  add('refLeakGate', 'notes 안의 참조는 정상',
    ctxWith([screen('x-01-a', "  notes: 'AUTH: x<br>여기서 여는 화면 — {{p-18-change-history}}',\n  body: tSub('변경은 변경 이력에 남습니다'),")]), false);

  add('workerLangGate', '베트남어 본문인데 셸이 한국어다',
    ctxWith([screen('x-01-a', "worker_({ title: 'TBM', body: 'Đã hiểu và ký · Chưa hiểu · phổ biến đánh giá rủi ro · Thiếu oxy · Đeo mặt nạ dưỡng khí · Có người giám sát' })")]), true);
  add('workerLangGate', '셸에 lang을 넘긴다',
    ctxWith([screen('x-01-a', "worker_({ title: 'TBM', lang: 'vi', body: 'Đã hiểu và ký · Chưa hiểu · phổ biến đánh giá rủi ro · Thiếu oxy · Đeo mặt nạ dưỡng khí' })")]), false);
  // One Vietnamese word quoted on a Korean screen does not make the body copy Vietnamese.
  add('workerLangGate', '인용된 낱말 하나',
    ctxWith([screen('x-01-a', "worker_({ title: '내 자격', body: '모국어 Tiếng Việt로 나갑니다' })")]), false);

  add('twinActionGate', '한 이름을 길게 쓴 두 버튼',
    ctxWith([screen('x-01-a', "actions: btn('역할·권한', 'ghost') + btn('역할·권한 매트릭스', 'ghost')")]), true);
  // A shared ending means two different actions; only a shared beginning is one name twice.
  add('twinActionGate', '뒤가 겹치는 다른 동작',
    ctxWith([screen('x-01-a', "actions: btn('임시 저장', 'ghost') + btn('저장', 'primary')")]), false);
  add('twinActionGate', '겹치지 않는 둘',
    ctxWith([screen('x-01-a', "actions: btn('내보내기', 'ghost') + btn('등록', 'primary')")]), false);

  add('languageSetGate', '이 사업장에 없는 언어',
    ctxWith([screen('x-01-a', "langTabs(['한국어', 'Tiếng Việt', 'नेपाली'], 0)")]), true);
  add('languageSetGate', '넷을 그대로 쓴다',
    ctxWith([screen('x-01-a', "langTabs(['한국어', 'English', 'Tiếng Việt', 'ភាសាខ្មែរ'], 0)")]), false);
  // 「전체 언어」, 「나란히」 and 「한국어 → English」 are not language names.
  add('languageSetGate', '언어가 아닌 항목',
    ctxWith([screen('x-01-a', "langTabs(['전체 언어', '한국어', '나란히', '한국어 → English'], 0)")]), false);
  // A screen deliberately drawing a language the installation has not enabled declares why.
  add('languageSetGate', '선언한 프레임은 조용하다',
    ctxWith([screen('x-01-a', "\n  offLanguages: '켜지 않은 언어가 무엇을 받는지가 이 화면의 주제다',\n  langTabs(['한국어', 'नेपाली'], 0)")]), false);

  add('paginationGate', '마지막 쪽이 틀렸다',
    ctxWith([screen('x-01-a', "pagination(['1', '2', '…', '482'], '48,210', 10)")]), true);
  add('paginationGate', '마지막 쪽이 맞다',
    ctxWith([screen('x-01-a', "pagination(['1', '2', '…', '4821'], '48,210', 10)")]), false);
  add('paginationGate', '한 쪽뿐',
    ctxWith([screen('x-01-a', "pagination(['1'], '8', 10)")]), false);

  add('dialogTitleGate', '다이얼로그 제목 두 번', ctxWith([screen('x-01-a', "title: '구역 추가',\n  children: formSection('새 구역'")]), true);
  add('listFormGate', '목록 페이지에 폼', ctxWith([screen('x-01-a', "table({ rows: [] })\nformSection('입력')")]), true);
  add('listFormGate', '폼이 사유를 밝힘', ctxWith([screen('x-01-a', "table({ rows: [] })\n  pageForm: '이 화면은 등록 절차다'\nformSection('입력')")]), false);
  add('labelSentenceGate', 'dField 라벨이 문장',
    ctxWith([screen('x-01-a', "dField({ label: '주기는 사업장이 고르지 않는다', value: 'x' })")]), true);
  add('labelSentenceGate', '이름다운 라벨',
    ctxWith([screen('x-01-a', "dField({ label: '무엇이 문제인가', value: 'x' })")]), false);
  add('labelSentenceGate', '조건절 라벨',
    ctxWith([screen('x-01-a', "dField({ label: '끊기면', value: 'x' })")]), true);
  add('labelSentenceGate', '석면은 물질이다',
    ctxWith([screen('x-01-a', "dField({ label: '석면', value: 'x' })")]), false);
  add('labelSentenceGate', 'badge가 문장',
    ctxWith([screen('x-01-a', "badge('경로가 겹침')")]), true);
  add('labelSentenceGate', '허가 있음은 상태다',
    ctxWith([screen('x-01-a', "badge('허가 있음')")]), false);
  add('labelSentenceGate', 'statTile 라벨이 값 이름이 아님',
    ctxWith([screen('x-01-a', "statTile({ label: '게시됨', value: '3' })")]), true);
  add('labelSentenceGate', '개인정보 포함은 종류다',
    ctxWith([screen('x-01-a', "statTile({ label: '개인정보 포함', value: '3' })")]), false);
  add('labelSentenceGate', '연결 안 됨은 종류다',
    ctxWith([screen('x-01-a', "statTile({ label: '연결 안 됨', value: '5' })")]), false);
  add('workerShellLangGate', '모국어 본문에 한국어 셸',
    ctxWith([screen('x-01-a', "worker_({ title: 'x', body: tBody('Nồng độ oxy dưới 18%') })")]), true);
  add('workerShellLangGate', '언어 선택기는 여러 말을 함께 적는다',
    ctxWith([screen('x-01-a', "worker_({ title: 'x', body: tSub('Choose language · Chọn ngôn ngữ · ជ្រើសរើសភាសា') })")]), false);
  add('aiWordGate', '여섯째 낱말',
    ctxWith([screen('x-01-a', "aiBadge('예측')")]), true);
  add('aiWordGate', '정해진 다섯 낱말',
    ctxWith([screen('x-01-a', "aiBadge('추정', '회차 5개')")]), false);
  add('aiTierGate', '없는 등급',
    ctxWith([screen('x-01-a', "aiCard({ title: 'x', tier: 4 })")]), true);
  add('aiTierGate', '1형에 카드',
    ctxWith([screen('x-01-a', "aiCard({ title: 'x', tier: 1 })")]), true);
  add('aiTierGate', '2형 카드',
    ctxWith([screen('x-01-a', "aiCard({ title: 'x', hint: 'y', tier: 2 })")]), false);
  add('listPanelGate', '목록인데 패널 없음',
    ctxWith([screen('x-01-a', "filterBar({ total: '4건' })\ntable({ rows: [] })")]), true);
  add('listPanelGate', '패널이 없는 이유을 밝힘',
    ctxWith([screen('x-01-a', "filterBar({ total: '4건' })\ntable({ rows: [] })\n  pageList: '격자가 곧 입력면이다'")]), false);
  add('canvasListGate', '도면과 목록 겹침',
    ctxWith([screen('x-01-a', 'canvasPh({ marks: [] })\ntable({ rows: [] })')]), true);
  add('canvasListGate', '도면이 무엇을 보이는지 밝힘',
    ctxWith([screen('x-01-a', "canvasPh({ marks: [] })\ntable({ rows: [] })\n  pageCanvas: '도면은 놓인 것을, 표는 아직 놓이지 않은 것을 보인다'")]), false);
  add('calendarListGate', '달력과 목록 겹침', ctxWith([screen('x-01-a', 'calendar({ month: 8 })\ntable({ rows: [] })')]), true);
  add('calendarListGate', '보기 전환이 있음', ctxWith([screen('x-01-a', "calendar({ month: 8 })\ntable({ rows: [] })\nviews: ['목록', '달력']")]), false);
  add('registerGate', '차트 주석이 -다체',
    ctxWith([screen('x-01-a', "note: '목표는 그림 안에 그린다',")]), true);
  add('registerGate', '패턴 카탈로그는 재지 않는다',
    ctxWith([screen('p-25-charts', "note: '목표는 그림 안에 그린다',")]), false);
  add('listColumnGate', '목록이 네 열',
    ctxWith([screen('x-01-a', "const list =\n  table({ head: [th('a', { w: 'w2' }), th('b'), th('c'), th('', { w: 'fix' })],\n  })\nconst panel = listDetail(list, panel)")]), true);
  add('listColumnGate', '목록이 세 열',
    ctxWith([screen('x-01-a', "const list =\n  table({ head: [th('a', { w: 'w2' }), th('c'), th('', { w: 'fix' })],\n  })\nconst panel = listDetail(list, panel)")]), false);
  add('pageActionGate', '흐름 안의 버튼 줄',
    ctxWith([screen('x-01-a', "pageHeader({ title: 'x' }) + btnRow(btn('가기'))")]), true);
  add('pageActionGate', '제목 없는 폼의 주 버튼',
    ctxWith([screen('x-01-a', "btnRow(btn('로그인', 'primary'))")]), false);
  add('sourceWordGate', '정해지지 않은 낱말',
    ctxWith([screen('x-01-a', "sourceBadge('이 사업장', '어쩌고')")]), true);
  add('sourceWordGate', '네 층 가운데 하나',
    ctxWith([screen('x-01-a', "sourceBadge('사업장 설정', '어쩌고')")]), false);
  add('dotSpacingGate', '한 목록에서 갈림',
    ctxWith([screen('x-01-a', "screen: '교육 세션 · 참석·서명·이해도',")]), true);
  add('dotSpacingGate', '구절 목록은 다 띄움',
    ctxWith([screen('x-01-a', "screen: '교육 세션 · 참석 · 서명 · 이해도',")]), false);
  add('dotSpacingGate', '낱말 목록은 다 붙임',
    ctxWith([screen('x-01-a', "screen: '재해율 지표 (도수율·강도율·연천인율)',")]), false);
  // A compound term declared in board.config.mjs is one item, so the point inside it is not a
  // list separator — without this the gate reads 「시정·예방조치 보드」 as two items and asks for
  // a space inside a word.
  add('dotSpacingGate', '선언한 합성어는 한 낱말',
    ctxWith([screen('x-01-a', "screen: '시정·예방조치 보드',")],
      { config: { ...config, compoundTerms: ['시정·예방조치'] } }), false);
  add('dotSpacingGate', '선언하지 않은 합성어는 목록으로 읽힌다',
    ctxWith([screen('x-01-a', "screen: '시정·예방조치 보드',")],
      { config: { ...config, compoundTerms: [] } }), true);
  add('screenKindGate', '이름이 종류를 되풀이함',
    ctxWith([screen('x-01-a', "screen: '설비 목록 — 검사 일정 잡기 (다이얼로그)', state: '의뢰 기록',")]), true);
  add('screenKindGate', '종류는 state만 말함',
    ctxWith([screen('x-01-a', "screen: '설비 목록 — 검사 일정 잡기', state: '다이얼로그 · 의뢰 기록',")]), false);
  // ── documents ─────────────────────────────────────────────────────────────────
  // Each of these fires on the shape that actually got through once. A throwaway tree stands in for
  // `docs/` and `_plans/`, and `documents` in the ctx's config points at it.

  add('helpShapeGate', '제목이 서술문이다',
    ctxWith([screen('x-01-a', "  helpCard({\n    title: '노출 하나가 30년을 간다',\n    hint: '즉시 조치 · 6개월 추적 · 30년 보존',\n  })")]), true);
  add('helpShapeGate', '제목이 물음이다',
    ctxWith([screen('x-01-a', "  helpCard({\n    title: '노출 하나가 왜 30년을 가는가',\n    hint: '즉시 조치 · 6개월 추적 · 30년 보존',\n  })")]), false);
  add('helpShapeGate', '제목이 이름씨 마디다',
    ctxWith([screen('x-01-a', "  helpCard({\n    title: '중지와 재개의 무게 차이',\n    hint: '멈추는 쪽 · 다시 시작하는 쪽',\n  })")]), false);
  add('helpShapeGate', '힌트 한 마디가 문장이다',
    ctxWith([screen('x-01-a', "  helpCard({\n    title: '무엇이 남는가',\n    hint: '접수 → 조사 → 종결 · 열람이 남는다',\n  })")]), true);
  add('helpShapeGate', '「마다」로 끝나는 마디는 서술어가 아니다',
    ctxWith([screen('x-01-a', "  helpCard({\n    title: '반기 확인은 무엇까지 보는가',\n    hint: '6개월마다 · 종료 시 · 수시 확인',\n  })")]), false);
  // A companion is judged against its base, not against a fixed column count. The base's source is
  // what says which of the two layouts is right, so every case here carries both files.
  const LD_BASE = screen('x-02-b', "listDetail(list, detail)");
  const REC_BASE = screen('x-02-b', "pageHeader({ title: 'x' }) + recordTabs([{ label: '개요' }], body)");
  const WITH_PH = "import base, { head, tabStrip } from './x-02-b.mjs';\nlistDetail(regionPh({ label: 'l', ref: 'r' }), tabPanes({ strip: tabStrip, open: '개요', ref: 'r', panes: [] }))";
  const NO_PH = "import base, { head, tabStrip } from './x-02-b.mjs';\nhead + tabPanes({ strip: tabStrip, open: '개요', ref: 'r', panes: [], region: '화면' })";
  add('companionFollowsBaseLayoutGate', '바탕에 목록 열이 없는데 플레이스홀더를 그린다',
    ctxWith([screen('x-01-a', WITH_PH), REC_BASE]), true);
  add('companionFollowsBaseLayoutGate', '전면 레코드 바탕은 폭 전체로 쌓는다',
    ctxWith([screen('x-01-a', NO_PH), REC_BASE]), false);
  add('companionFollowsBaseLayoutGate', '목록·상세 바탕인데 플레이스홀더가 없다',
    ctxWith([screen('x-01-a', NO_PH), LD_BASE]), true);
  add('companionFollowsBaseLayoutGate', '목록·상세 바탕은 왼쪽에 자리를 둔다',
    ctxWith([screen('x-01-a', WITH_PH), LD_BASE]), false);
  // Only a companion is judged — an ordinary screen drawing a list-detail imports no base.
  add('companionFollowsBaseLayoutGate', '동반이 아닌 화면은 대상이 아니다',
    ctxWith([screen('x-01-a', "listDetail(list, detail)"), LD_BASE]), false);

  add('tagCollisionGate', '단계 태그와 기능 태그가 같다',
    ctxWith([], { config: { ...config, phases: { pack: { tag: '건설 팩' } }, features: { PACK_CONSTRUCTION: { tag: '건설 팩' } } } }), true);
  add('tagCollisionGate', '두 축이 다른 낱말을 쓴다',
    ctxWith([], { config: { ...config, phases: { pack: { tag: '팩 대기' } }, features: { PACK_CONSTRUCTION: { tag: '건설 팩' } } } }), false);
  add('featureGate', '카탈로그에 없는 키',
    ctxWith([screen('x-01-a', "\n  notes: 'AUTH: 세션 · 기능 키 PACK_UNKNOWN',\n  body: x,")], {
      manifest: [{ letter: 'X', title: 't', screens: [{ file: 'x-01-a', feature: 'PACK_UNKNOWN' }] }],
      html: '<span class="fft">건설 팩</span>',
    }), true);
  add('featureGate', 'notes와 manifest가 어긋남',
    ctxWith([screen('x-01-a', "\n  notes: 'AUTH: 세션 · 기능 키 CONNECTED',\n  body: x,")], {
      manifest: [{ letter: 'X', title: 't', screens: [{ file: 'x-01-a', feature: 'PACK_CONSTRUCTION' }] }],
      html: '<span class="fft">건설 팩</span>',
    }), true);
  add('featureGate', '선언과 칩과 notes가 맞음',
    ctxWith([screen('x-01-a', "\n  notes: 'AUTH: 세션 · 기능 키 PACK_CONSTRUCTION',\n  body: x,")], {
      manifest: [{ letter: 'X', title: 't', screens: [{ file: 'x-01-a', feature: 'PACK_CONSTRUCTION' }] }],
      html: '<span class="fft">건설 팩</span>',
    }), false);
  add('featureGate', '선언은 있는데 notes에 키가 없다',
    ctxWith([screen('x-01-a', "\n  notes: 'AUTH: 세션',\n  body: x,")], {
      manifest: [{ letter: 'X', title: 't', screens: [{ file: 'x-01-a', feature: 'PACK_CONSTRUCTION' }] }],
      html: '<span class="fft">건설 팩</span>',
    }), true);
  add('featureGate', 'base.notes로 물려받으면 묻지 않는다',
    ctxWith([screen('x-01-a', "\n  notes: base.notes + '한 줄',\n  body: x,")], {
      manifest: [{ letter: 'X', title: 't', screens: [{ file: 'x-01-a', feature: 'PACK_CONSTRUCTION' }] }],
      html: '<span class="fft">건설 팩</span>',
    }), false);
  add('panelDupVerbGate', '두 단에 같은 동사',
    ctxWith([screen('x-01-a', "panelVerbs(btn('명단 조정') + btn('세션 열기')) +\n  panelFoot(btn('닫기', 'ghost') + btn('세션 열기', 'primary'))")]), true);
  add('panelDupVerbGate', '두 단이 다른 것을 진다',
    ctxWith([screen('x-01-a', "panelVerbs(btn('명단 조정') + btn('강사 지정')) +\n  panelFoot(btn('닫기', 'ghost') + btn('세션 열기', 'primary'))")]), false);
  add('fieldBadgeGate', '한 줄 입력칸 값에 배지',
    ctxWith([screen('x-01-a', "fSelect({ label: '자동번역', value: `켬 ${envBadge('자동번역')}` })")]), true);
  add('fieldBadgeGate', '배지는 hint로 갔다',
    ctxWith([screen('x-01-a', "fSelect({ label: '자동번역', value: '켬', hint: `꺼집니다 ${envBadge('자동번역')}` })")]), false);
  add('fieldBadgeGate', 'fMulti는 배지를 담는 칸이다',
    ctxWith([screen('x-01-a', "fMulti({ label: '보존', value: `3년 ${sourceBadge('법정 기본', '제164조')}` })")]), false);
  add('hollowDialogGate', '라벨은 다이얼로그, 그림 없음',
    base({ loaded: [{ num: 'X-01', file: 'x-01-a', label: '구역 추가 (다이얼로그)', mod: { overlay: '<div class="thing">' } }] }), true);
  add('hollowDialogGate', '다이얼로그를 그림',
    base({ loaded: [{ num: 'X-01', file: 'x-01-a', label: '구역 추가 (다이얼로그)', mod: { overlay: '<div class="modal">' } }] }), false);

  // 단계 표시. `phased` builds the pair the gate compares: what the manifest declares against
  // what reached the page.
  const phased = (manifest, html, loaded = []) => base({ manifest, html, loaded });
  const BAND = '<article class="frame deferred" id="s-k-01"><div class="phase-band"><b>2단계</b></div></article>';
  add('phaseGate', '선언했는데 안 그려짐',
    phased([{ letter: 'K', title: 'k', phase: 2, screens: [{ file: 'k-01-a' }] }],
      '<article class="frame" id="s-k-01"></article>'), true);
  add('phaseGate', '선언하고 그림',
    phased([{ letter: 'K', title: 'k', phase: 2, screens: [{ file: 'k-01-a' }] }], BAND), false);
  add('phaseGate', '설명은 단계를 말하는데 선언이 없음',
    phased([{ letter: 'X', title: 'x', screens: [{ file: 'x-01-a' }] }], '',
      [{ num: 'X-01', file: 'x-01-a', mod: { notes: '<strong>3단계다</strong> — 나중에 만든다' } }]), true);
  // 「2단계 인증」 is an MFA screen's subject matter, not a schedule — keying on the bare word catches it.
  add('phaseGate', '내용으로서의 2단계',
    phased([{ letter: 'A', title: 'a', screens: [{ file: 'a-05-a' }] }], '',
      [{ num: 'A-05', file: 'a-05-a', mod: { notes: '<strong>2단계 인증</strong>을 요구한다' } }]), false);

  // Role verdicts. The matrix arrives on ctx, so the fixture states it outright rather than
  // pointing at a real board — which is what let these two cases pass against whatever the
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
  add('roleGate', 'AUTH가 부르는 역할이 판정에 없음',
    roled([{ num: 'N-02', file: 'n-02-a', mod: { notes: 'AUTH: safety-admin 세션 · 시스템 관리자 (협력사 관리자는 자사 인력 초대만)<br>' } }]), true);
  add('roleGate', '그 프레임이 roles로 선언함',
    roled([{ num: 'N-02', file: 'n-02-a', mod: { roles: { partner: 'scoped' }, notes: 'AUTH: safety-admin 세션 · 시스템 관리자 (협력사 관리자는 자사 인력 초대만)<br>' } }]), false);
  add('roleGate', '판정에 있는 역할을 부름',
    roled([{ num: 'N-02', file: 'n-02-a', mod: { notes: 'AUTH: safety-admin 세션 · 시스템 관리자<br>' } }]), false);
  // A cluster with neither a verdict nor a 「대상 아님」 reason has fallen out of the matrix.
  add('roleGate', '매트릭스에 없는 구역',
    roled([], [{ letter: 'Y', title: 'y', screens: [] }]), true);

  // The list-detail region is the LAST thing on the page: the panel is a full-height column whose
  // footer is pinned to the floor, so a block appended after the two columns lands under a panel
  // that has already ended — the reader sees the record's actions and then more page beneath them.
  //
  // The gate walks forward from the call to the bracket that CLOSES the enclosing expression, so
  // the fixture has to have one. Without it the walk runs off the end of the source and the gate
  // reports nothing — which is what a first attempt at these cases did, passing for no reason.
  const tail = (after) => ctxWith([screen('x-01-a',
    'export default { body: console_({ main: pageHeader({}) + listDetail(list, panel)' + after + ' }) };')]);
  add('panelTailGate', '목록·상세 아래에 블록이 더 있다', tail(" + section('더', 'x')"), true);
  add('panelTailGate', '목록·상세로 끝난다', tail(''), false);

  // 목록 탭 → 칩 필터 → 목록 is one act and the three sit together, so the gate reads the rendered
  // frame: the surface a screen draws is often a branch, and a source sweep sees the condition.
  const chain = (inner, mod = {}) => ctxWith([{ ...screen('x-01-a', ''), mod: { body: `<div class="main">${inner}</div>`, ...mod } }]);
  const TABS = '<div class="ltabs"><span class="ltab active">전체</span></div>';
  const CHIPS = '<div class="chips"><span class="chip active">전체</span></div>';
  const TILES = '<div class="grid-4"><div class="tile"></div></div>';
  const LIST = '<div class="listdetail"></div>';
  add('filterChainGate', '탭과 목록 사이에 타일이 있다', chain(TABS + TILES + LIST), true);
  add('filterChainGate', '탭·칩 필터·목록이 붙어 있다', chain(TILES + TABS + CHIPS + LIST), false);
  // The order is part of the rule: a chip row under the bar that counts what it narrowed reads as
  // a filter over the total rather than the thing the total is counting.
  add('filterChainGate', '칩 필터가 목록 바 뒤에 있다',
    chain(TABS + '<div class="filterbar"></div>' + CHIPS + '<div class="table"></div>'), true);
  // A chip row that picks what the whole page IS — a dashboard's period, an assessment method, the
  // paper a preview draws on — is not a list filter, and the frame says so in one sentence.
  add('filterChainGate', '칩이 목록 필터가 아니라고 밝힌다',
    chain(CHIPS + TILES + '<div class="table"></div>', { pageChips: '대시보드 전체의 기간이다' }), false);
  add('filterChainGate', 'pageChips에 사유가 없다',
    chain(CHIPS + TILES + '<div class="table"></div>', { pageChips: '' }), true);
  // A chip row with no list under it is a set of tags, not a filter — the chain is only a chain
  // once it reaches a list.
  add('filterChainGate', '목록이 없는 칩 줄', chain(CHIPS + '<div class="attach"></div>'), false);
  // The language switch picks which language a kept field is read in; it narrows no list, so it is
  // neither a member of the chain nor something wedged into it.
  add('filterChainGate', '언어 전환은 대상이 아니다',
    chain(TABS + '<div class="ltabs lang"><span class="ltab">한국어</span></div>' + LIST), false);

  // ── the presentation rules a page carries ────────────────────────────────────
  add('panelCloseIsPlainGate', '패널의 닫기가 ghost다',
    ctxWith([screen('x-01-a', "panelFoot(btn('닫기', 'ghost') + btn('편집', 'primary'))")]), true);
  add('panelCloseIsPlainGate', '패널의 닫기가 일반 버튼이다',
    ctxWith([screen('x-01-a', "panelFoot(btn('닫기') + btn('편집', 'primary'))")]), false);
  // 취소 IS the secondary act beside 저장, so a form panel keeps it ghost.
  add('panelCloseIsPlainGate', '폼 패널의 취소는 그대로다',
    ctxWith([screen('x-01-a', "panelForm({ title: 'x', children: '', foot: btn('취소', 'ghost') + btn('저장', 'primary') })")]), false);
  // A dialog closes over a dimmed page and carries its own ✖ — the rule is about the panel.
  add('panelCloseIsPlainGate', '다이얼로그의 닫기는 대상이 아니다',
    ctxWith([screen('x-01-a', "dialog({ title: 'x', children: '', foot: btn('닫기', 'ghost') })")]), false);

  add('auditFootFirstTabGate', '두 번째 칸이 열린 채로 감사 줄을 그린다',
    ctxWith([screen('x-01-a', "tabs([{ label: '개요' }, { label: '서명', active: true }])\nauditFoot({ id: 'a1', at: '2026-01-01' }, null)")]), true);
  add('auditFootFirstTabGate', '첫 칸에서 감사 줄을 그린다',
    ctxWith([screen('x-01-a', "tabs([{ label: '개요', active: true }, { label: '서명' }])\nauditFoot({ id: 'a1', at: '2026-01-01' }, null)")]), false);
  add('auditFootFirstTabGate', '동반 프레임이 감사 줄을 그린다',
    ctxWith([screen('x-01-a', "tabPanes({ strip, open: '개요', ref: 'x', panes: [] })\nauditFoot({ id: 'a1', at: '2026-01-01' }, null)")]), true);
  add('auditFootFirstTabGate', '탭이 없는 패널은 대상이 아니다',
    ctxWith([screen('x-01-a', "auditFoot({ id: 'a1', at: '2026-01-01' }, null)")]), false);

  add('statusCardDeclaresItselfGate', '건수를 말하는 카드가 밝히지 않았다',
    ctxWith([screen('x-01-a', "msg({ kind: 'warn', title: '정책이 없는 안전구역이 1개 있습니다' })")]), true);
  add('statusCardDeclaresItselfGate', '상태 카드라고 밝혔다',
    ctxWith([screen('x-01-a', "msg({ kind: 'warn', status: true, title: '정책이 없는 안전구역이 1개 있습니다' })")]), false);
  // A standing fact that happens to name a number is the author's call, and `dismiss` records it.
  add('statusCardDeclaresItselfGate', '닫히는 카드라고 밝혔다',
    ctxWith([screen('x-01-a', "msg({ kind: 'info', dismiss: true, title: '한 조문이 요구를 여럿 만듭니다', body: '2건까지 나옵니다' })")]), false);
  // 오류·예시·근거 are not notice cards and never close, so nothing to declare.
  add('statusCardDeclaresItselfGate', '오류는 대상이 아니다',
    ctxWith([screen('x-01-a', "msg({ kind: 'error', title: '필수 항목 3개가 비어 있습니다' })")]), false);
  add('statusCardDeclaresItselfGate', '수를 말하지 않는 카드',
    ctxWith([screen('x-01-a', "msg({ kind: 'help', title: '이 화면에서 하는 일' })")]), false);
}
