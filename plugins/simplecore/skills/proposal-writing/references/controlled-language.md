# Korean controlled language for proposals and presentations

This reference adapts useful ASD-STE100 principles to Korean bid documents. It is a
project writing rule, not a claim that the Korean deck complies with the English-only
ASD-STE100 specification.

The general part of this file - the five elements a sentence carries, noun chains, vague
pointers, abstract verbs, placeholder nouns, conditions and numbers - is the base standard in
`simplecore:korean-docs` (`references/response-style.md` §3) and applies to every Korean sentence
in every project; the rules `spoken-transition-opener` and `quality-noun-placeholder-verb` catch
the machine-visible forms. This file keeps the deck-specific application: the proposer voice, the
speaker notes, the review procedure and the deck examples.

Read this file before creating, revising or reviewing any Korean text in the submitted
proposal or its presentation summary. Apply it to titles, title explanations, body text,
tables, diagram labels, captions and speaker notes. Preserve quoted RFP wording,
requirement names, requirement IDs, product names and legally fixed terms.

## The reader must not supply the missing relationship

Write so that a first-time evaluator can identify these elements without reconstructing
them from neighbouring boxes:

1. **Actor** - 제안사, 시스템, 수집 에이전트, 담당자, 결재자 or 발주자.
2. **Action** - 측정, 등록, 차단, 승인, 전송, 검증 or 제출.
3. **Object** - the information, request, record, file or result acted on.
4. **Condition or time** - when the action starts, stops or changes state.
5. **Result or evidence** - the state, record, measurement or deliverable that proves
   completion.

Not every short label needs all five. A sentence that states a proposal, control,
workflow or completion criterion includes every element needed to distinguish it from a
different action. Never delete the actor, condition, evidence or outcome merely to make
the text shorter.

Use one principal action in one sentence. Split a sentence when it combines different
actors, different times or more than one decision. Keep a stable term for one object
through the title explanation, body, diagram and speaker notes.

## Replace compressed language with explicit relationships

### Noun chains

A middle dot, slash, arrow or dash does not express a workflow by itself. Use it only for
field names, true alternatives, fixed compound terms or short peer items. When a value
describes work, state the verb and result.

| Avoid | Write |
| --- | --- |
| `대상 · 범위 · 방식 · 주기 · 오류 책임 명세` | `연계 대상과 자료 범위, 전송 방식과 주기, 오류 처리 책임을 명세한다.` |
| `동일 예약 검수 대기 전환 · 이중 생성 금지` | `작업을 완료하면 기존 예약을 검수 대기 상태로 전환하고 추가 예약 생성을 차단한다.` |
| `원인 구간 특정 최적화 · 동일 시나리오 재시험` | `병목 구간을 식별해 개선하고 같은 시나리오로 다시 시험한다.` |
| `전력 설비 주기 수집 · 관제 경험 → 설계 적용` | `전력 설비의 주기 수집·관제 경험을 수집 주기와 장애 감지 설계에 적용한다.` |

If a cell must remain nominal, make its row label name the question and make the adjacent
value state the answer. Do not place two unrelated decisions in one cell.

Factual label-value cards do not need sentence endings when the label already supplies
the relationship. For fields such as `규모`, `성과`, `등급`, `기간`, `자격` and `경력`,
write compact verified values (`총자산 100백만원 · 자기자본 62백만원 · 결손 없음`)
instead of repeating them as prose (`…이며 … 유지된다`). Keep full sentences for
actions, conditions, controls and decisions whose relationship would otherwise be lost.

### Vague pointers

Do not begin a printed explanation with `이제`, `다음은`, `이 업무`, `이 구현`, `이 범위`,
`이 운영 기반`, `해당`, `동일하게` or `그 장비` when the exact noun fits. Name the
business, system, record, condition or preceding action.

| Avoid | Write |
| --- | --- |
| `이 구현을 표준 환경에서 운영한다.` | `<제품명>을 전자정부 표준프레임워크 환경에서 운영한다.` |
| `이 운영 기반 위에서 접근을 제한한다.` | `KEPCO SSO 인증 결과와 담당자의 관할 조직에 따라 접근을 제한한다.` |
| `동일하게 적용한다.` | `자동 통보와 같은 결재·증빙·이력 관리 절차를 수동 통보에도 적용한다.` |

Spoken transitions may appear in speaker notes only when they help the oral flow. They do
not replace the subject or action.

### Abstract verbs and placeholder nouns

Replace a broad verb with the observable operation. `관리한다`, `확보한다`, `지원한다`,
`적용한다`, `검토한다`, `처리한다` and `연계한다` are incomplete when the reader cannot
tell what changes or what proves completion.

| Avoid | Write |
| --- | --- |
| `품질을 확보한다.` | `치명·주요 결함, 순환 의존, 코드 내 비밀 값이 0건인지 검사한다.` |
| `자료를 관리한다.` | `자료의 반입·열람·반출 이력과 승인자를 기록한다.` |
| `장애 대응을 지원한다.` | `장애를 접수하고 재현한 뒤 임시복구 결과와 근본조치 내역을 통보한다.` |
| `표준을 적용한다.` | `용어사전의 표준 용어와 도메인을 논리·물리 모델에 적용한다.` |

Do not use `기준선`. Also avoid an unqualified `비교 기준`. Name the measured or approved
object: `도입 전 처리기간 측정값`, `착수 시 오류 건수`, `승인된 요구사항`, `시험 조건`,
`형상 승인본`, `승인된 범위와 일정`. If a generic label is unavoidable, define its
contents in the same sentence or adjacent value.

### Conditions, pronouns and negation

- Put the condition before the action: `필수 사진이 누락되면 준공 요청을 차단한다.`
- State the object of `전`, `후`, `이하`, `이상`, `완료` and `승인`: avoid `업로드 전`,
  `승인 후`, or `완료 처리` when the relevant file, approver or state is not named.
- Prefer positive action statements. Use negation only for an actual prohibition or
  acceptance boundary: `승인되지 않은 청구 건은 기성관리시스템에 전송하지 않는다.`
- Do not use `이를`, `해당`, `동일`, `관련`, `등` when more than one antecedent is possible.

### Numbers and evidence

- Keep a number only when its source, meaning and unit are clear.
- Distinguish a proposal assumption, current measurement, contractual requirement,
  target and verified result. Do not present one as another.
- Name the denominator of a rate and the measurement interval when they affect judgment.
- Use the same number and status in the title explanation, body, diagram and notes.
- Do not move a detailed demonstration number into speaker notes when the user has
  excluded it from the oral presentation.

## The submitted document

The proposal must stand without a presenter. Each page states the business context,
proposer action, method or control, and evidence or deliverable needed for evaluation.

- Use polite proposer endings only on a part's first page and in the explanatory copy
  directly below each page title: `합니다`, `하겠습니다`, `적용합니다`, `확인합니다`,
  `해왔습니다`, `했습니다`.
- Keep ordinary body paragraphs in the document's declarative `-다` form. Keep concise
  table headings and diagram node labels as parallel noun phrases when their relationship
  is already explicit in the enclosing sentence, row heading, arrow label or legend.
- Write every diagram string in noun form, explanatory lines and verdict bands included:
  a condition as 「~ 시」, a finding as 「대상: 결과」, an action as a noun phrase that keeps
  its object. When this review makes a relation explicit inside a figure, it does so within
  the noun form, never by turning the label into a 「~한다」 sentence.
- A part-opening explanation speaks from the proposer. It does not explain how the
  chapter was written or list what the chapter contains. State the client's situation,
  the proposer action and the result to be delivered.
- Do not use presentation transitions such as `이제`, `다음으로`, `말씀드리겠습니다`.
- A procedure names its trigger, responsible actor, action, state transition and record.
- A control names what it prevents, the condition that activates it and the evidence it
  leaves.
- A deliverable name alone is not an implementation answer. State who produces it, when
  it is approved and how it proves completion.
- In the company overview, present core capabilities as verified organisational facts,
  not as promises about the proposed work. Group them by technical domain and name the
  concrete protocols, platforms, certifications or implemented functions. Put future
  application commitments in the relevant strategy or implementation chapter, not in a
  `본 사업 적용` column beside every capability. If the existing page cannot carry the
  evidence at the deck's minimum type size, reorganize or replace less informative
  overview content before shortening it. In a blind-evaluated copy, omit the company
  name, detailed address and personal identifiers while keeping verifiable
  organisational facts, qualifications and delivery experience.
- Review proposal XML and the source of every generated diagram. Edit the generator, not
  the generated SVG or generated chapter file.
- Use `comparison` in a title or caption only when the figure directly puts peer values,
  alternatives or states against one another. When the figure breaks a total into parts
  and derives a subtotal, name those relations as allocation and calculation instead of
  joining two noun phrases with `and` and calling the result a comparison. For example,
  rewrite `role effort and development effort comparison` as `role allocation of planned
  effort and development-effort calculation`.

Example:

- Avoid: `감사 조치요구 이행 · 이력 통합관리`
- Write: `감사 후속조치를 이행하려는 발주기관의 요구에 따라 제안사는 교체 판단부터
  청구까지의 처리 근거를 한 이력으로 연결해 조회할 수 있도록 구축하겠습니다.`

## The presentation summary

The presentation must work both when projected and when read without the presenter.

- The explanation below each title and every part-opening explanation uses the polite
  proposer voice. Body copy and diagram labels remain concise; do not mechanically add
  `합니다` to every box.
- A title explanation states one claim that can be spoken naturally. It names the exact
  business or system instead of relying on a previous slide: use `본 사업`, the system
  name or the relevant workflow, not `이 업무` or `이 구현`.
- Read all title explanations in slide order. They must form a coherent argument without
  verbal fillers such as `이제` and without requiring the previous diagram to supply the
  subject.
- The slide body expands the claim into demand, implementation, verification and
  deliverable. Rewrite labels that require the evaluator to guess the relationship.
- The speaker notes use the same actor, term, number, condition and outcome as the visible
  slide. They explain evidence and judgment; they do not merely read the slide, point to
  positions or rename the same concept.
- Read the notes alone in order. Each note must be understandable without `왼쪽`,
  `오른쪽`, `위`, `아래`, `이 도식` or a visible arrow.
- Do not introduce a technical abbreviation only in a diagram. Expand it at the first
  meaningful use in the title explanation, body or note, then use the same abbreviation.
- When a demonstration figure is not to be spoken, keep the number out of the notes and
  explain only the capability and verified state permitted by the user.
- During a wording-only edit, preserve slide order and diagram meaning. Treat the user's
  stated layout scope as authoritative. When the user permits layout adjustment, a clearer
  sentence may be accommodated by changing a text box's width or height, internal padding,
  or spacing between existing boxes. Do not change the information hierarchy, workflow,
  element order or diagram semantics merely to make text fit.
- Fix the wording first. If the revised wording is already concise and still overflows,
  adjust the existing box or spacing instead of deleting the actor, condition, result or
  evidence. Re-render and inspect every page whose text geometry changed.

Example:

- Avoid: `이제 실제 장치와 연계의 차이를 처리하겠습니다.`
- Write: `프린터와 제조사별 차이는 프로파일로 관리하고, 외부 규격 차이는 어댑터에서
  처리해 업무 규칙을 유지합니다.`

## Full-document review procedure

Do not sample pages when the user asks for the whole proposal or whole presentation.

1. Build a ledger of every page or slide containing its title, title explanation, body
   strings, diagram labels, captions and notes.
2. Read each page in context and mark missing actor, action, object, condition, result or
   evidence. Mark noun chains, vague pointers, undefined abbreviations and abstract verbs.
3. Read only the titles and title explanations in order. Confirm that each part starts
   with the proposer's business claim and that the sequence forms one argument.
4. For a presentation, read only the speaker notes in order and compare each note with
   the visible claim and diagram terminology.
5. Search the complete source set for each rejected term and variant, including diagram
   generators and notes. A clean search is necessary but does not replace contextual
   reading.
6. Rewrite in the source of truth. Preserve exact RFP terminology and factual status.
7. Run the Korean-language checks and the deck's declared checks. Render every changed
   page and inspect its text. Render the full deck when the requested scope is the full
   deck.
8. Repeat the ledger review after rendering. A page is complete only when its wording is
   understandable, consistent across surfaces and free of new overflow.

## Completion questions

Before finishing, answer all of these with evidence from the source and render:

- Can a new evaluator identify who does what, to which object and under what condition?
- Does each control state what it prevents and what record it leaves?
- Does each completion claim state the measurement, approval, test or deliverable?
- Are noun phrases used only as labels whose relationship is explicit?
- Are vague pointers and unqualified `기준`, `관리`, `확보`, `지원`, `적용` removed?
- Do the proposal and presentation use the same term and factual status for the same
  claim while keeping their different sentence endings?
- Do the title explanations form a coherent sequence, and do the notes support rather
  than contradict that sequence?
- Were diagram wording and notes inspected even when their layout and structure were out
  of scope?
