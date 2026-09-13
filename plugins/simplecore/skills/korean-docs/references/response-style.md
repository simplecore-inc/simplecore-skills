# The Korean sentence standard

Applies to every Korean deliverable — replies, documents, translations, reviews, screen copy.
**Read it before writing the session's first Korean sentence, and read it again after a summary in a
long session.** Remembering that you read it is not evidence: if the register table and the eight
questions below cannot be quoted right now, it has not been read.

**What a machine checks is not repeated here.** Spellings (디렉터리 · 라이선스 · 애플리케이션),
banned transliterations, proper nouns, and banned words live in `GLOSSARY.base.md` and
`RULES.base.json`, where the audit script and the write-time hook check them. This file holds what a
machine cannot judge — what the writer has to decide. A new term or banned spelling settled during a
task is registered in the glossary or the rule pack, not here
([audit-tooling.md](audit-tooling.md)).

## 1. Register

| Deliverable | Register | Example |
| --- | --- | --- |
| Chat reply · explanation · report | 합니다체; a request to the user is 「~해 주세요」 | 확인했습니다 · 디스크를 먼저 비워 주세요 |
| Design and development documents (working documents) | -다체 declarative; the project glossary overrides | 이 화면은 목록을 표시한다 |
| Manuals · explanatory text for readers | 합니다체; an instruction to the reader is 「~하세요」 | 저장을 누르세요 |
| Screen copy | 합니다체; buttons and item names are noun phrases or short actions | 저장할 수 없습니다 · 저장 |
| Titles · table headers · menus · labels | Noun form. No full stop, no question, no 「~한다」 | 시작하기 · 유지 조건 |
| Text inside a diagram or figure | Noun form in 개조식 — title, card, label, note, closing line, **all of it**. No predicate ending, no relative clause, no particle inside a label, no connective ending, no author's working word | 당일 대면 대응 항목 · 근거: 경력증명서 · 착수 첫 주 처리기간 측정 |

- **Never mirror the user's register.** 반말, clipped questions, and swearing in the prompt do not
  change the answer: it stays 합니다체. `비워 달라` · `알려 달라` · `실행해 달라` do not appear in a
  reply.
- A sentence closes on a predicate with a final ending. It does not end on a noun phrase, an
  adverbial phrase, or a connective ending. The exception is a name slot (a title, a label), and
  those take no full stop.
- No chatbot residue (`좋은 질문이에요` · `도움이 되었으면 좋겠습니다`) and no emoji. End on the
  content, not on a summarizing flourish.
- **A diagram holds no sentences, and its noun phrases are 개조식.** Every piece of text inside a
  figure is a noun phrase, and the claim belongs in the prose beside it. A relative clause
  (`착수 첫 주에 측정하는 처리기간` → 착수 첫 주 처리기간 측정), a particle inside a label
  (`차이를 수용하는 확장 지점` → 차이 수용 확장 지점), a connective ending between items
  (`확인 뒤 접수` → 확인 후 접수) and a word only the authors use (`보드` → 와이어프레임) are
  a working note pasted into the document. A range (「A에서 B까지」), a title pair (「A와 B」), an
  adverb (「없이」) and a quoted screen label stay. **The closing line is where this is broken most often** —
  it is added last, after the drawing is finished, so a sentence there feels justified.
  `근거는 경력증명서다.` → 근거: 경력증명서 · `이동 시간이 사업 기간에 들어가지 않는다` →
  사업 기간에서 제외되는 이동 시간. Titles work the same way: `거리가 정하는 대응 방식` is a bodiless
  thing deciding something, so write the name of what the figure shows — 「당일 대면 대응 항목」.

## 2. Eight questions before a Korean sentence leaves

One "yes" means rewriting the sentence, not softening it.

| # | Question | Caught → fixed |
| --- | --- | --- |
| 1 | Does something without a body speak, ask, remember, or judge? | `화면이 알려 줍니다` → 화면에 표시합니다 · `규칙이 스스로 구분합니다` → 규칙으로 자동 판정합니다 · `기록이 오래 산다` → 기록이 오래 남는다 |
| 2 | Does something that cannot move, move — or leave traces, or get handled like an object? | `알림이 갑니다` → 알림을 보냅니다 · `서버로 올라간다` → 서버로 전송한다 · `사업 조건이 설계에 남기는 제약` → 사업 조건에 따른 설계 제약 · `담당과 기한을 붙인다` → 지정한다 · `두 값이 부딪힌다` → 충돌한다 · `사업장이 손댄 것` → 고친 것 |
| 3 | Is something with a real name called by a metaphor, or a change hidden in an adverb? | `관문을 연다` → 요건을 충족하면 진행할 수 있다 · `통째로 바뀝니다` → name which items change and how · `이 화면의 동사다` → 이 화면이 하는 일이다 |
| 4 | Was an English sentence carried over word for word? | `되어진다` → 된다 · `~하는 것을 가능하게 합니다` → ~할 수 있습니다 · `~를 가지고 있다` → ~가 있다 · `~에 대해 설명` → ~를 설명 · `~할 것입니다` for a fact → ~합니다 · delete `당신` · `우리는` · `그것은` · `-들` |
| 5 | Do the subject and the predicate agree, for every subject the predicate covers? | `낱말은 아이디만 오고 화면이 꺼낸다` → 서버는 아이디만 보내고 낱말은 화면이 꺼낸다 · `12곳은 전부 상한이고` → 12곳은 전부 상한을 뜻한다 · `톨루엔과 소음은 마신 양이 아니다` → split into two sentences |
| 6 | Is a hedge attached to a confirmed fact, or a tic sitting where nothing belongs? | `~로 보입니다` · `~인 것 같습니다` → state it · `본질적으로` · `결론적으로` · `요약하면` → delete · a paragraph-opening `또한` · `따라서` · `즉` → carry it with the sentence flow · `강력한` · `획기적인` → the number and the fact |
| 7 | Is a particle, an ending, or a component missing; does the sentence close on a predicate; is 「의」 doubled? | `컨텍스트 압축 전 신중 반영한다` → 컨텍스트가 압축되기 전에 신중하게 반영합니다 · `승인 요청이 반려됨.` → 승인 요청을 반려했습니다 · `값을 확인하고.` → 값을 확인하고 넘어갑니다 · `사본의 문구는 작업의 상황을` → 사본에 기재된 문구는 작업이 진행되는 상황을 |
| 8 | Is there a word this field does not write, or a dash hiding a relation? | `견주다` → 비교하다 · `갈무리하다` → 저장하다 · `일컫다` → 부르다 · `여쭈다` for a machine action → 조회하다 · `기본값을 두었다 — 검증이 건너뛰어진다` → 기본값을 그대로 두면 검증을 건너뜁니다 |

**The nouns behind question 3.** `자리` · `몫` · `천장` · `바닥` · `함정` · `관문` · `사다리` ·
`갈래` · `길` · `연료` · `씨앗` · `사슬` · `함대` (a group of machines called a fleet — 장치군 ·
장치 N대) standing in for something that has a real name are replaced by that name: 소속 조직 ·
필수 역할 · 설정 화면 · 유형 · 상한 · 대체 순서. A real object (출입문 · 벽보 · 사다리) is not a
metaphor.

**「남기다」 in question 2 and 「사슬」 in question 3 are more often legitimate, so the object
decides.** A person or a system leaving 기록 · 이력 · 사유 · 버전 is what this field says; a
condition, a schedule, or an environment leaving 제약 · 영향 · 부담 · 과제 is a bodiless thing
leaving traces (rule `inanimate-namgida`). 「사슬」 is the same: `신뢰 사슬` (certificate chain) or a
product's own defined term `추적 사슬` is a name, while `처리 사슬` · `원장으로 잇는 사슬` for
workflow steps is a metaphor — write 「업무 처리 단계」. Which one it is depends on what is left and
what is called a chain, so a stem alone cannot decide it.

**Question 5 comes from compression.** Folding two sentences into one separates the topic from the
thing that actually acts. Put the acting thing in the subject or split the sentence. A sentence that
counts things and then attaches a meaning (`8곳 중 7곳은 정상`) says what it refers to:
「~이 쓰인 7곳은 정상 용법이다」.

**Question 7 comes from reacting to "write it shorter".** Korean loses its particles and endings
first. Write the relation (`~가 압축되기 전에`) and the missing component (what the warning is shown
on), and close on a predicate. Doubling 「의」 leaves no room for a predicate (`화면의 항목의 이름` →
화면 항목의 이름).

**The dash in question 8.** Cause, contrast, and condition are written with a connective, not a
dash. Apposition, enumeration, and a gloss after a name do not hide a relation, so those dashes
stay. Screen copy takes no dash at all.

## 3. What a sentence has to carry

A sentence that states an action, a control, a procedure, or a completion criterion lets a
first-time reader identify five things without reconstructing them from the neighbouring text:
the **actor** (담당자 · 시스템 · 수집 에이전트 · 결재자), the **action** (측정 · 등록 · 차단 · 승인 ·
전송 · 검증), the **object** it acts on, the **condition or time** under which it starts, stops, or
changes state, and the **result or evidence** — the state, record, measurement, or deliverable that
proves it happened. A label or a short title carries fewer; a sentence that distinguishes one action
from another carries every element the distinction needs, and none of them is deleted to make the
sentence shorter. One principal action per sentence: split when the actors, the times, or the
decisions differ. One object keeps one name across the title, the body, the figure, and the notes.

- **A procedure names its trigger, actor, action, state transition, and record. A control names
  what it prevents, the condition that activates it, and the evidence it leaves. A deliverable's
  name is not an answer**: say who produces it, when it is approved, and what it proves.
  `감사 조치요구 이행 · 이력 통합관리` → 교체 판단부터 청구까지의 처리 근거를 한 이력으로 연결해
  조회할 수 있게 구축한다.
- **A middle dot, a slash, an arrow, or a dash does not express a workflow.** They join field
  names, true alternatives, fixed compounds, and short peer items. When the value describes work,
  write the verb and the result: `동일 예약 검수 대기 전환 · 이중 생성 금지` → 작업을 완료하면 기존
  예약을 검수 대기 상태로 전환하고 추가 예약 생성을 차단한다 · `원인 구간 특정 최적화 · 동일
  시나리오 재시험` → 병목 구간을 식별해 개선하고 같은 시나리오로 다시 시험한다. A label–value card
  whose label already supplies the relation stays nominal (`규모: 총자산 100백만원 · 자기자본
  62백만원 · 결손 없음`), and one cell never holds two unrelated decisions.
- **A pointer does not open a sentence when the noun fits.** `이제` · `다음은` · `이 업무` ·
  `이 구현` · `해당` · `동일하게` · `그 항목` at the head of a printed sentence make the reader fetch
  the subject from the previous paragraph or figure. Name the business, the system, the record, or
  the preceding action: `이 구현을 표준 환경에서 운영한다` → 소모품 관리시스템을 전자정부
  표준프레임워크 환경에서 운영한다 · `동일하게 적용한다` → 자동 통보와 같은 결재 · 증빙 · 이력 관리
  절차를 수동 통보에도 적용한다. `이를` · `해당` · `동일` · `관련` · `등` are not written when more
  than one antecedent is possible. A spoken transition (`이제` · `다음으로` · `말씀드리겠습니다`)
  belongs in a speaker note and nowhere else, and even there it does not replace the subject. The
  rule `spoken-transition-opener` catches the sentence-initial forms.
- **A broad verb is incomplete when the reader cannot tell what changes or what proves
  completion.** 관리한다 · 확보한다 · 지원한다 · 적용한다 · 검토한다 · 처리한다 · 연계한다 are
  replaced by the observable operation: `품질을 확보한다` → 치명 · 주요 결함, 순환 의존, 코드 내 비밀
  값이 0건인지 검사한다 · `자료를 관리한다` → 자료의 반입 · 열람 · 반출 이력과 승인자를 기록한다 ·
  `장애 대응을 지원한다` → 장애를 접수하고 재현한 뒤 임시복구 결과와 근본조치 내역을 통보한다 ·
  `표준을 적용한다` → 용어사전의 표준 용어와 도메인을 논리 · 물리 모델에 적용한다. The rule
  `quality-noun-placeholder-verb` catches a quality noun on one of these verbs.
- **A placeholder noun is replaced by the measured or approved object.** `기준선`, an unqualified
  `비교 기준` · `기준` · `기반` · `체계`, say that something is compared with or built on without
  saying what: 도입 전 처리기간 측정값 · 착수 시 오류 건수 · 승인된 요구사항 · 시험 조건 · 형상
  승인본 · 승인된 범위와 일정. Where a generic label cannot be avoided, its contents are defined in
  the same sentence or in the adjacent value.
- **The condition comes before the action**, and `전` · `후` · `이하` · `이상` · `완료` · `승인`
  name their object: `업로드 전` → 사진 업로드 전 · `승인 후` → 부서장 승인 후 · `완료 처리` → 준공
  요청을 완료 상태로 전환. 「필수 사진이 누락되면 준공 요청을 차단한다」 is the order. A statement
  is positive unless it is an actual prohibition or an acceptance boundary: 승인되지 않은 청구 건은
  전송하지 않는다.
- **A number stays only when its source, meaning, and unit are clear.** An assumption, a current
  measurement, a contractual requirement, a target, and a verified result are five different things
  and are never presented as one another. A rate names its denominator and its measurement interval
  when they affect the judgement, and the same number carries the same status on every surface —
  title, body, figure, note, and the report that relays it.

## 4. Choosing a word

- **Settled loanwords and technical terms stay.** 어댑터 · 콜백 · 매핑 · 슬롯 · 캐시 · 핸들러 ·
  메타데이터 · 네임스페이스 · 리터럴, API · SQL, Docker · Kubernetes · Java (as written). Do not
  change them to make the text look more Korean. Framework terms (`hook` · `contract` · `entity`)
  stay in the original too.
- **A technical term is explained technically.** A mechanism is named by what it is and what
  it does to what — 프로파일 · 어댑터 · SPI · 설정, and 변환 · 교체 · 반영 · 조정 — never by a verb
  standing where the mechanism should be: `차이를 수용하는 확장 지점` → 제품 · 규격 차이의 처리
  위치 — 프로파일 · 어댑터 · SPI · `어댑터 버전으로 수용하고` → 어댑터의 새 버전으로 반영하고 ·
  `코드 변경 없이 수용합니다` → 코드 변경 없이 처리합니다. A reader of 「차이 수용」 cannot tell
  what handles which difference. 「수용」 is acceptance (수용 기준 · 수용 주체 · 점검을 수용한다)
  and nothing else; the rule `absorb-for-mechanism` reads the rest.
- **Replace a word only when a plainer one means the same thing.** If meaning is lost, nothing was
  replaced: `쓴 비용을 구하는 함수` dropped both 지출 and 추론, so 「지출한 비용을 추론하는 함수」 is
  the right sentence.
- **Do not import a Sino-Korean term that belongs to another field.** `함의` · `동치` · `정련` ·
  `가역` · `위상` · `전치` · `전사` belong to logic, metallurgy, thermodynamics, mathematics, and
  linguistics; `생활권` · `권역` · `정주 여건` · `동선` belong to urban planning, regional
  development, and public administration, so the reader has to erase that field's meaning first.
  Words settled in Korean software writing (검출 · 판정 · 대조 · 조회 · 전송 · 재처리) stay.
  Registered ones are caught by machine; for a new one the test is 「does this field's writing
  already use it?」.
  **The listed fields are not the scope of this rule.** They are the ones that have come up, and the
  test is one question — 「is the word I am using another field's formal term?」 A field missing from
  the list only means it has not come up yet.
  **It shows up most where distance, extent, or degree is being blurred**: `같은 생활권` makes the
  reader guess the range, while `도보 10분 거리` is a fact that can be checked. Write the actual
  distance, time, or count in those places.
- **Do not translate an English idiom or metaphor literally.** single source of truth → `단일 소스`
  ✖ 「한 곳에서 관리」, make X an ally → `X를 아군으로` ✖ 「X를 강점으로」, walk (a list) → `걷는다`
  ✖ 「처리한다 · 훑는다」, stand up (a server) → `세운다` ✖ 「실행한다」, on the wire → `전선` ✖
  「응답에」, working tree → `나무` ✖ 「작업 트리」, surface → `표면` ✖ 「엔드포인트 · 맡은 범위」,
  wiring → `배선` ✖ 「조립 · 등록」. Choose the verb that names the actual action.
- **A metaphor written in an English brief comes back in the Korean answer.** `furniture` → `세간`,
  `ladder` → `사다리`: a metaphor you wrote an hour ago arrives as recall and passes unfiltered.
  Write the real name in the brief. When the real name is already in the same sentence, the metaphor
  is decoration — delete it.
- **Do not attach `-하다` or `-되다` to an English word.** `인라인하다` → 직접 작성하다,
  `resolve되다` → ~를 가리키다, `export합니다` → 내보냅니다. Using `import` · `re-export` as the name
  of a code construct is fine.
- **「재-」 attaches only to Sino-Korean.** 재검토 · 재발급 are correct; `재걷기` · `재묶음` are
  「다시 대조한다 · 다시 묶는다」.
- **「사람」 means the user.** An agent, a session, or a worker is 「에이전트」, and 「읽는 쪽」 when
  the reader may be either. `다음 사람이 다시 알아내지 않게` → 다음 에이전트가.
- **Do not give an object a body's actions.** `서버가 쥔 키` → 서버의 키, `커밋이 물고 갔다` →
  커밋에 함께 들어갔다, `에이전트가 눈으로 확인한다` → 화면이 실제로 그려지는지 확인한다,
  `목록을 걷는다` → 실행한다. With a person as the subject, the body stays. If the fix is another
  metaphor (`딸려 갔다` · `밝힌다`), nothing was fixed.
- **A process is not alive or dead.** `에이전트가 죽었다` → 중단됐다, `프로세스를 죽인다` → 종료한다,
  `살아 있는 컨테이너` → 실행 중인 컨테이너. An actual death in an industrial-safety or medical
  document is the formal term.
- **Checks and rules do not cry.** `검사가 운다` → 검출한다 · 보고한다. An alarm or a bell really
  does make a sound, so those stay.
- **Do not drop a status label into a sentence.** `제품 키가 폐기됨이 되고` → 제품 키가 폐기되고.
  Quote it only when referring to the label itself.
- **Do not attach 「입니다」 to an indirect question.** `언제까지 유효한지입니다` →
  유효기간을 확인합니다.
- **Do not name a relation with a picture.** `거울상이다` → 방향만 반대인 같은 결함이다,
  `판박이다` → 똑같다, `동전의 양면이다` → 같은 규칙의 두 방향이다.
- **Choose the predicate that names the thing as it is.** 적용 · 포함 · 등록 · 저장 · 전송 · 표시 ·
  구분 · 확인 · 승인 · 차단 · 완료 · 복구 · 조회 · 변경 · 삭제. Where a more precise action is known,
  use it instead of the broad 처리 · 진행 · 관리.
- **Words that must be kept apart.** 결제 (paying) and 결재 (approval) · 정산 (disbursement) and
  대사 (reconciliation) · 프로필 (a user) and 프로파일 (an execution environment) · 절대 시각 ·
  달력 날짜 · 현지 시각 (`Instant` · `LocalDate` · `LocalTime`).

## 5. Replies and reports

- **A chat reply passes through no check at all.** The write-time hook reads files only. So the
  eight questions above are needed more often in a reply than in a file, and a reply written
  straight after an audit returned zero is no exception.
- **AI tells outlive the audit.** The structural habits — staging a claim instead of stating it, a
  closing line that repeats, three of everything, borrowed authority, a chat wrapper — carry no
  banned word, so a zero-finding file can be built entirely out of them.
  [ai-tells.md](ai-tells.md) catalogues them in their Korean form; the five that most often survive
  a rewrite are `단순히 ~가 아니라`, a repeating closing line, a 줄표, a three-item series, and a
  bold label.
- **Relaying a report is not quoting.** A subagent's report, an execution log, or somebody's note
  passed on to the user becomes the relayer's sentence and takes the same standard. What is quoted
  literally is only what exists somewhere in those characters: a screen label, an error message, a
  string in a file, a document title.
- **The project glossary applies to reports too.** Do not rename the repository's own machinery
  (검사 · 단계 · 대장) into English or a transliteration. Code identifiers stay in backticks as
  written.
- **A word used in a brief spreads through the report into replies and documents.** Writing the
  brief is the last chance to choose it.

## 6. A correction diagnoses the guidance

When the user points at a sentence, that sentence is the symptom and the diagnosis is about this
file and the rules. Before adding the word to a banned list, check three things.

1. Which rule should have caught it, and why it did not. If it enumerated forms, anchored on a
   single shape, or lost the rest while avoiding false positives, widen it to the type.
2. Whether the guidance itself uses the expression. A replacement column, an example, or a sentence
   of the guidance using the word teaches the word. **Check the guidance against itself first.**
3. Whether the type is missing altogether. That is a missing rule: name the type and write down the
   test that separates it from legitimate use.

Fix that cause, then register whatever a machine can judge in the glossary or the rule pack with its
boundary and its hit/miss examples. Say in the report which of the three it was. Register a word
that keeps coming back after failed self-correction, but a rule has to be able to judge sentences
that are not in its list.

## 7. Domain terms

- Project terms are decided by the project glossary (`.claude/GLOSSARY.md`), which wins over this
  file when they conflict.
- Finance, quant, and trading add [domain-finance.md](domain-finance.md).
- Screen copy adds [ui-copy.md](ui-copy.md); proofreading and review add the pattern catalogue in
  [korean-style.md](korean-style.md) and the structural catalogue in [ai-tells.md](ai-tells.md).
