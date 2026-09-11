# Judging screen copy

The register table and the eight questions in [response-style.md](response-style.md) are the base.
This file adds the judgements that apply on top when reviewing screen copy and documents, with the
corrections that actually came up. The procedure for reviewing and fixing a whole surface is in
[ui-copy-sweep.md](ui-copy-sweep.md).

**Scope**: screen copy (i18n resources · message bundles · mail templates · wireframe board
sources), documents (design and technical documents · README · manuals · plans · review notes), and
explanatory text inside code (comments recording design intent, `OPEN:` · `TODO:` notes). Only
Q · S · W · Z and 「UI 요소별 문체」 are screen-only; everything else applies to documents unchanged.

**Screen copy takes one more test.** For a document, 「does the reader get it in one pass?」 is
enough; screen copy also has to pass **「is this what business software actually says?」** The three
below are grammatical and are not written on a screen. Do not pass something because it is
grammatically possible, and do not swap a few words: confirm the fact being conveyed and write the
whole sentence again.

- `무엇에 기대는가`
- `항목 하나에 딸리는 네 가지`
- `목록은 사람이 손으로 채우지 않습니다`

## Three things judged separately

| What | How |
| --- | --- |
| Legal terms · formal technical terms | Leave them. Replacing them with plainer words changes the legal or technical meaning |
| The particles, word order, and predicate of the sentence holding that term | Rewrite them naturally |
| A real physical action | Not a metaphor, so leave it. A door really opens and a lock really locks |

Keeping a name is not keeping a metaphor. Even when the domain model is called `gate`, user-facing
copy and design notes use the actual meaning (필수 요건 · 배정 전 요건 확인 · 단계 진행 조건), and the
predicates around it always become the actual processing.

- `배치 관문이 잡습니다` → 배치 전 미충족 요건을 판정해 배정을 제한합니다
- `스코프로 가릅니다` → 접근 범위에 따라 조회 권한을 구분합니다

## What to look for

What follows is a set of review angles, not a list of search terms. Find every similar sentence,
including the ones not listed. Before rewriting, answer six questions: what is the actual actor ·
what does the system actually do · what does it apply to · under what condition · what is the result
· what does the user need to know or do right now.

### A. Physical metaphor → functional verb

Do not replace a metaphor with another metaphor. Choose a predicate that names the function
directly — 적용 · 포함 · 등록 · 저장 · 전송 · 표시 · 구분 · 확인 · 승인 · 제한 · 완료 · 복구 · 조회 ·
변경 · 삭제 — and do not lean on the broad 처리 · 진행 · 관리 either.

| Metaphor | What to confirm | Replacement |
| --- | --- | --- |
| A condition `기대다` on something | a prerequisite or an operating condition | ~해야 한다, 유지 조건 |
| A policy `걸리다` · `붙다` · `딸리다` | application, blocking, or a warning | ~에 적용된다, ~에 포함된다 |
| A report `싣다` · `안고 오다` a value | inclusion, attachment, or transmission | ~를 포함한다, ~를 공급한다 |
| A screen `쥐다` · `품다` information | display or state management | ~에 표시한다 |
| A step `막히다` · `풀리다` · `열리다` | permission, a prior task, or an error | 진행할 수 없다, 진행할 수 있다 |
| A condition `무너지다` · `살아나다` | unmet, released, or restored | 충족하지 않는다, 다시 표시된다 |
| A record `올라가다` to the server, `내려오다` to the device | transmission or a completed save | 서버로 전송한다, 내려받는다 |
| A deadline `밀리다`, a task `넘어가다` | postponement or reassignment | 연기된다, 다음 담당자에게 자동 배정된다 |
| A criterion `가르다` its targets | classification, exclusion, or restriction | 기준에 따라 구분한다 |
| `잡다` for a setting, a booking, or a judgement | setting, booking, or judging | 설정한다, 예약한다, 판정한다 |
| Calling a deadline a `시계`, an owner a `주인`, a step a `걸음` | what is this the name of | 처리기한, 담당자, 단계 |
| An exception or a relation as `깨지다` · `얽힘` · `갈림선` | an exception, a connection, or a criterion | 예외가 있다, 연결 관계, 구분 기준 |

### B. 「닿다」 and 「길」

Information and features do not `닿는다` to a person, a server, a system, or a document. It is a
verb of physical contact, so delivery, transmission, connection, application, and access disappear
into it. 「길」 is the same. A figure reaching a limit is 「한도에 도달한다」.

- `알림이 사용자에게 닿지 않습니다` → 사용자가 알림을 수신하지 못했습니다
- `서버에 닿은 뒤` → 서버 전송이 완료된 뒤
- `판정이 장치 제어에 닿지 않습니다` → 판정 결과가 장치 제어에 적용되지 않습니다
- `화면에 닿을 길이 없습니다` → 해당 화면에 접근할 수 없습니다
- `알림을 보내는 길` → 알림 채널
- `이의 제기할 길` → 이의 제기 방법

### C. A fallback order is not a 「사다리」

It hides what is automatic, where a person steps in, and what the final failure state is.

- `대체발송 사다리` → 대체 채널 우선순위
- `메신저가 실패하면 문자로 갑니다` → 메신저 발송에 실패하면 문자로 자동 전송합니다
- `끝에서 실패하면 사람이 전화합니다` → 문자 전송에도 실패하면 담당자가 전화합니다
- `실패 건이 수동 처리로 넘어갑니다` → 실패 건을 수동 처리 대기열에 등록합니다

### D. State, application, and duration are not directions, switches, or movement

「켜기」 · 「끄기」 are used only as the action name of a switch the user flips; an explanatory
sentence states the resulting state — 활성화 · 비활성화 · 사용 · 중지.

- `집행 모드로 올린다` → 집행 모드로 변경한다
- `기능이 열린다` → 해당 기능을 사용할 수 있다
- `화면이 잠긴다` → 설정을 변경할 수 없다
- `장비가 살아난다` → 장비가 재가동된다
- `기업 요금제에서 켜집니다` → 기업 요금제에 적용됩니다
- `기록 하나가 왜 10년을 가는가` → 거래 기록을 10년 보존하는 이유

### E. Office slang and colloquial verbs of movement

나가다 · 올라오다 · 내려오다 · 걸다 · 풀다 · 붙이다 do not stand in for approval, issuance,
submission, registration, or application. Even when the event is named `uploaded`, user-facing copy
uses the Korean administrative verb.

- `허가가 나갑니다` → 이용 허가가 발급됩니다
- `결재가 올라갑니다` → 결재가 요청됩니다
- `보완 대책을 겁니다` → 보완 대책을 적용합니다
- `조건과 기한을 붙입니다` → 조건과 이행 기한을 지정합니다
- `제한을 풉니다` → 제한을 해제합니다

### F. Do not blur impact with 「통째로 · 조용히 · 그대로」

Write what changes, what stays, and how the user is told.

- `일정이 통째로 밀립니다` → 설치 일정이 연기될 수 있습니다
- `기록이 통째로 빕니다` → 해당 시간대의 접속 기록이 누락됩니다
- `문이 조용히 남습니다` → 연결되지 않은 장치를 결과 목록에 표시합니다
- `자격이 그대로 따라갑니다` → 기존 이력과 자격 정보를 유지합니다

### G. Inanimate subjects and personification

A screen, a card, a list, a policy, a rule, a report, a result, a schedule does not judge, speak,
remember, or take responsibility. 「보이다」 is split too, by whether the system displays or the user
looks: choose among 표시한다 · 안내한다 · 조회할 수 있다 · 확인한다. `값이 정책을 수행한다` ·
`카드가 문서를 승인한다` are not grammar errors but sentences with the wrong actor.

- `화면이 다음 행동을 말합니다` → 화면에 다음 작업을 안내합니다
- `이 카드가 모든 값을 기억합니다` → 카드에 모든 값을 표시합니다
- `정책이 작업을 막습니다` → 해당 정책이 적용되면 작업을 진행할 수 없습니다
- `보고서가 근거를 안고 들어옵니다` → 보고서에 판단 근거를 포함합니다
- `임박한 것을 보이는 일이 이 화면의 몫입니다` → 점검 임박 장비를 미리 표시합니다
- `설정 화면이 답합니다` → 설정 화면에서 변경 방법을 안내합니다

### H. Do not hide a noun-to-noun relation behind a metaphor

`A에 붙는 B` · `A에 딸리는 B` · `A가 켜는 B` · `A 뒤에 있는 B` make the reader guess the relation.
Confirm it and name it: application (A에 적용되는 B) · inclusion (A에 포함된 B) · membership
(A에 속한 B) · derivation (A를 기준으로 생성된 B) · precedence (B를 시작하기 전에 완료해야 하는 A) ·
reference · linkage · condition (A일 때 필요한 B).

### I. An organization, a role, or a feature is not a 「자리」

Use 「자리」 only for a real place, a seat, a layout position, or a digit position. A 「자리」 left in
a table header, a field label, or a statistics tile is split into 위치 · 항목 · 화면 · 직책 ·
미편성, while a statutory position or a formal role keeps its own term.

- `사람이 소속되는 자리` → 사용자가 소속되는 조직
- `검토자 자리가 비어 있습니다` → 필수 역할인 검토자가 지정되지 않았습니다
- `바깥 시스템과 잇는 자리` → 외부 시스템 연동 설정
- `사람이 아니라 자리입니다` → 특정 개인이 아니라 작업별 필수 역할을 지정합니다

### J. Vague subjects and demonstratives

When `이것` · `이 결과` · `해당 건` cannot be resolved in one pass, write the name again. Where one
screen holds several objects, do not use a demonstrative at all.

- `이 결과에서 나오는 네 가지 의무` → 심사 결과에 따라 적용되는 네 가지 의무
- `이것이 완료되면 다음으로 넘어갑니다` → 사전 심사가 승인되면 이용 신청서를 작성합니다

### K. English-style negatives and passives

A passive settled in statutory language stays.

- `목록은 사람이 손으로 채우지 않습니다` → 시스템이 목록을 자동으로 생성합니다
- `이 값은 사용자에 의해 변경될 수 없습니다` → 사용자는 이 값을 변경할 수 없습니다
- `승인 없이는 진행되지 않도록 되어 있습니다` → 다음 단계로 진행하려면 승인을 완료하세요

### L. After fixing, check particles, endings, and agreement separately

An error created by the previous fix was not in the original, so it does not stand out. Sweep these
nine after fixing. Particle disagreement and a word repeated twice are caught by the audit script; a
person reads the other seven. Mixed politeness and a mismatched object name only show up when
reading one file vertically.

- Particles (을/를 · 이/가 · 은/는 · 으로/로 · 와/과)
- Singular against plural: `항목들이 각각` → 항목이 각각
- Honorific and plain forms mixed
- 「할 수 있습니다」 duplicated with 「가능합니다」
- The same word twice in a row
- Two or more consecutive spaces
- Spacing around parentheses, numbers, and units
- The title and the description naming different objects
- An imperative button paired with a rambling description

### M. A title, a label, and a table header are names, not questions

Keep a question-form title only in the form a user would actually say out loud
(「제출 후에도 수정할 수 있나요?」). A title ending in 「~는가」 is the designer's question to himself,
and it is not a title but what the screen is supposed to answer. A field label is the kind of value.
Searching only for the ending 「~는가」 lets 「필요한가」 · 「중대한가」 escape. A title made of stacked
nouns gets a particle or an adnominal.

- `무엇에 기대는가` → 효과 유지 조건
- `이 화면이 무엇을 쥐고 있는가` → 화면에 표시되는 정보
- `기록은 어디로 올라가는가` → 기록 전송 위치
- `무엇이 반드시 남는가` → 필수 감사 로그 항목
- `회의체마다 무엇이 다른가` → 회의체별 구성과 의결 요건
- `끌 수 있는가` → 비활성화 가능 여부
- `왜 위험한가` → 위험 요인
- `누가 지정하는가` → 지정 주체
- `대상 결과 의무 적용 상태` → 판정 결과에 따른 의무 적용 현황

### N. Do not explain a feature with exaggeration, flat assertion, or an emotional verdict

When there really is only one way, write the requirement directly with 「해야 합니다」 ·
「할 수 없습니다」.

- `이 기록이 최악입니다` → 필수 요건 미충족 상태의 처리 기록을 별도로 확인합니다
- `외부 기관 일정이 유일한 길입니다` → 지정된 외부 기관의 일정을 예약해야 합니다

### O. 「가능 · 급한 · 즉시」 come with a criterion

State when it applies or the time limit (「승인 완료 후」 · 「5분 이내」); where nothing is fixed, do
not invent a number — write the processing condition.

- `저장하면 바로 반영됩니다` → 저장한 문안은 다음 발송부터 적용됩니다
- `문안을 수정할 수 있습니다` → 문안을 변경할 수 있지만 재심사를 통과한 뒤 발송에 적용됩니다

### P. An indirect question plus 「입니다」

A completed noun such as 「가지입니다」 · 「기한입니다」 is not this.

- `언제까지 유효한지입니다` → 사용자별 지급 내역과 유효기간을 확인합니다
- `누구를 누구로 볼지입니다` → 외부 시스템 연결과 신원 매핑을 설정합니다

### Q. A page description states the object and the function directly (screen only)

Do not lean on interrogatives and catch-all words. The order is the object (a specific name such as
이용 허가 · 법정 의무) → the criterion or scope (사용자별 · 현재 · 만료 후) → the function
(확인합니다 · 관리합니다 · 설정합니다). A detail screen listing values — 「A동 3층 · 2026-08-12 ·
진행 중」 — is not explanatory text and stays as it is.

- `무엇이 언제 끝나고 무엇이 이미 지났는지 봅니다` → 계약별 만료 시각과 만료 상태를 확인합니다
- `누가 언제 막히는지 봅니다` → 미이수로 이용이 제한되는 사용자와 제한 시점을 확인합니다

### R. Internal notes and bold lead-ins are written without metaphor too

`OPEN:` · `TODO:` notes, design memos, and board annotations later become the source text of screen
copy and requirements. Do not drop particles and final endings, and keep an undecided state
(「검토 중」) while still writing a complete sentence. A bold lead-in inside `<strong>` turns into a
metaphor easily while being compressed. A bold lead-in has to clearly explain one of: the design
decision, the condition of application, the permission, the legal or business reason, or the
connected screen and data.

- `근거 조문은 확인 필요다` → 근거 조문을 확인해야 한다
- `점검 결과가 프로그램을 켠다` → 점검 결과에 따라 항목별 프로그램 대상이 정해집니다
- `사건마다 시계가 흐른다` → 사건마다 처리기한이 다릅니다

### S. Abstract nouns in card and dialog descriptions (screen only)

Do not compress for brevity into abstractions such as 「본문」 · 「전제」 · 「모양」 · 「묶음」 ·
「무게」 · 「흐름」. Write the description as object and condition → the actual action → the result →
(only where needed) the reason, and split the sentence when it carries three or more judgements.

- `대피 시간과 실패 지점이 평가의 본문입니다` → 대피 완료 시간과 계획대로 수행하지 못한 지점을 기록해 훈련 결과를 평가합니다
- `요청은 다섯 갈래입니다` → 요청을 열람, 정정 · 삭제, 처리정지 등 유형별로 구분합니다
- `만료 기한은 계속 흐릅니다` → 가동을 중지해도 검사 유효기간은 변경되지 않습니다

### T. A condition, a judgement, or a restriction is not a door or a gate

A real fixture — 「출입문」 · 「문 개방」 — stays as it is.

- `자격이 관문을 연다` → 자격별로 배정 · 승인 시 확인할 단계를 지정합니다
- `만료가 관문을 닫는다` → 유효기간이 지나면 해당 작업의 배정을 제한합니다
- `법정 관문은 끌 수 없다` → 법정 필수 요건은 비활성화할 수 없습니다
- `관문이 샌다` → 필수 요건 판정이 누락됐다
- `승인되지 않아 착수가 막힌다` → 승인되기 전에는 착수할 수 없습니다

### U. Turn a slogan into a description of the procedure

`A가 곧 B다` · `A는 B일 뿐이다` · `A가 유일한 방어다` · `A가 핵심이다` · `A가 아니라 B다` omit the
condition, the handling, and who verifies. Confirm four things: what condition applies to what
object · who checks or records what · what is restricted when it is not met · what the user should
do. An official slogan or a real quotation in statutory or training material is not changed.

- `사진이 곧 근거다` → 이상 항목에는 상태를 확인할 수 있는 사진을 첨부해야 합니다
- `인원 대조가 핵심이다` → 입장 인원과 퇴장 인원이 일치해야 허가를 반납할 수 있습니다
- `반납이 아니라 수색이다` → 퇴장 인원이 일치하지 않으면 반납 처리 전에 미확인 인원의 위치를 확인합니다

### V. Internal implementation wording does not go out as user guidance

Technical terms the user actually configures on an administrator screen (API · Webhook ·
HMAC-SHA256) stay, while the predicates become the real action — 전송 · 검증 · 변경 · 재시도.

- `값은 공용 응답 세트를 그대로 씁니다` → 각 항목에서 「이상 없음」 또는 「이상 있음」을 선택합니다
- `검사는 하나도 돌지 않습니다` → 해당 필드에 검증 규칙을 적용할 수 없습니다
- `비밀은 서비스 계정 화면에서 회전합니다` → 서명용 비밀값은 서비스 계정 화면에서 변경합니다

### W. A legal or specialist term is not left as a short UI noun (screen only)

In the body, name both sides — 「A 기록으로 B 의무를 갈음합니다」 — and let a short status value in a
list show the result the user understands immediately (「대체 인정」 · 「별도 제출 불필요」). Which
terms may not stand as a label differs by domain, so register them in the project glossary.

- `갈음` → 다른 의무 이행으로 인정
- `이 입력이 갈음하는 의무` → 이 제출로 이행한 것으로 인정되는 의무

### X. A predicate has to fit every subject it covers

Unfold 「A와 B는 …한다」 into 「A는 …하고 B는 …한다」 and check that both halves are true.

- `톨루엔과 소음은 실제로 마신 양이 아닙니다` → 노출된 양이 아닙니다
- `파일과 링크는 만료되면 삭제됩니다` → 파일은 삭제되고 링크는 만료됩니다
- `담당자와 기한을 선임합니다` → 담당자를 지정하고 기한을 정합니다

### Y. One action has one name

「연결」 · 「잇기」 · 「붙이기」 are each correct Korean, so a rule has no grounds to catch them: the
defect is between the words. When an action and its opposite use different roots on one screen
(「잇기」 beside 「연결 끊기」), they have already diverged. Lay out the row actions, buttons, tabs,
screen names, and metric labels, count them, unify on the most used name, and drop the metaphorical
one (잇다 · 붙이다 · 걸다). When a screen name changes, fix the table of contents, the specification,
and the planning documents in the same change. How to find these is the counting in
[ui-copy-sweep.md](ui-copy-sweep.md) step 6.

### Z. A missing feature does not say where it is missing (screen only)

`이 빌드에 없음` · `이 설치본에 없음` read as 「it exists elsewhere」 and send the user digging through
settings and reinstalling. What is missing because it is not in the code is 「아직 없음」, one phrase.
Split only what genuinely differs by situation.

| What | What the reader should do | The copy |
| --- | --- | --- |
| Not in the code | nothing; wait | 아직 없음 |
| Shipped but not installed | install it | 설치되지 않음 |
| Hidden for lack of permission | request permission | 볼 수 있는 권한 없음 |
| Not in this project or account | look elsewhere, or create it | 이 프로젝트에 없음 |

In a clause, do not splice the phrase in: unfold it into a predicate — 「내보내기 파일은 아직 만들지
않습니다」. No rule catches this, so find it by counting, and register the spelling that project was
using under `## 금지 표현` in the glossary.

## Register by UI element (screen only)

| Element | Register |
| --- | --- |
| Screen name · tab · badge | a short noun form naming the object |
| Button · row action | the specific action the user performs; a navigation button takes the destination's name |
| Field label | the name of the value entered or displayed, readable as `항목명: 값` |
| Description | what is checked or done on this screen |
| Warning | the problem, the impact, the action required |
| Help | the concept, the conditions, the exceptions, the criteria |
| Internal note | a complete sentence with nothing elided |

- Do not repeat the same information in every element. When the screen name already makes the object
  clear, the description says what to check or do.
- Keep state values and action names apart. 오프라인 · 미이수 · 차단 are states; 재연결 후 동기화 ·
  교육 배정 are actions. A state name does not lean on a metaphor either. One 「열림」 can mean
  entry allowed, editing allowed, or approval complete, so write the actual state.
  - `관문 열림` → 배정 가능
  - `정책 뒤짐` → 정책 미동기화
  - `장치 침묵` → 데이터 미수신
- A description and a button do not call the same action by different names. The warning
  「검사를 신청하세요」 and the button 「검사 일정 잡기」 are both 「검사 신청」.
- Descriptions, warnings, help, and internal notes are sentences, so they carry particles and final
  endings.
  - `첨부 없어 반려됨` → 첨부 파일이 없어서 반려했습니다
  - `승인 대기 중. 결재선 확인 필요` → 결재선을 확인한 뒤 다시 요청하세요
- No em dash in an explanatory sentence. Split the sentence in two or add a connective.

## What not to do

- Searching for the few examples the user gave and stopping there.
- Replacing a metaphor with another metaphor.
- Bulk substitution without reading the context.
- Deleting a required condition, a legal meaning, or the scope of application to make it shorter.
- Replacing a legal or technical term with an arbitrary plainer word.
- Judging a real physical action as a metaphor.
- Fixing user-facing copy and code identifiers without telling them apart.
- Reverting unrelated existing changes.
- Skipping the naturalness review because the checks passed.
- Producing a list of problems without fixing the copy.

### AA. A possibility does not stand in for an instruction or a fact (합니다체 only)

When English *can* and *may* arrive as 「~할 수 있습니다」, the guidance says neither what to do nor
what happens, and only the possibility is left. A screen and a manual write one of three things: a
possibility after a condition is 「~하려면 ~하세요」, a possibility that is a fact is 「~합니다」, and a
guess at a cause becomes something to verify. The adnominal 「~할 수 있는」 and the negative
「~할 수 없습니다」 state ability and prohibition and stay, and so do the sentences that really are
about a difference in permission. The rule `can-instead-of-does` catches 합니다체 sentences — it does
not catch 「~할 수 있다」 in a -다체 design document.

- `입력을 고쳐야 다음 단계로 진행할 수 있습니다` → 다음 단계로 진행하려면 입력을 고치세요
- `원본 값 탭에서 확인할 수 있습니다` → 조회 결과는 원본 값 탭에서 확인합니다
- `여러 장치의 스냅샷이 포함될 수 있습니다` → 장치 한 대 이상의 스냅샷을 포함합니다
- `방화벽이나 스위치의 ACL이 막고 있을 수 있습니다` → 방화벽과 스위치 ACL에서 UDP 161 통신을 허용했는지 확인하세요
- `즉시 적용됩니다` → 선택 즉시 화면 언어를 바꿉니다

**English words survive inside Korean sentences in the same places.** `host[:port]` · `ERROR` · a
list of symbols such as `. _ -` are traces of a translated English screen, and what has a Korean
word is written in Korean — 주소[:포트] · 오류 · 마침표·밑줄·붙임표. Product names, option names
(`--plain-http`), and specification names (CIDR · UDP 161) stay as they are.
