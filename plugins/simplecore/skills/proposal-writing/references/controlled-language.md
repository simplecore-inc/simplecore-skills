# Korean controlled language for proposals and presentations

This reference adapts useful ASD-STE100 principles to Korean bid documents. It is a
project writing rule, not a claim that the Korean deck complies with the English-only
ASD-STE100 specification.

**The sentence standard is `simplecore:korean-docs`'s** (`references/response-style.md` §3,
「What a sentence has to carry」): the five elements a sentence carries (the actor, the action,
the object, the condition or time, and the result or evidence), one principal action per
sentence, noun chains, vague pointers, broad verbs, placeholder nouns, conditions before
actions, and numbers that keep their source, meaning and unit. It applies to every Korean
sentence in every project, and the rules `spoken-transition-opener` and
`quality-noun-placeholder-verb` catch the machine-visible forms. This file keeps what a
proposal deck adds to it: the proposer voice, the speaker notes, the review procedure and the
deck's examples.

Read this file before creating, revising or reviewing any Korean text in the submitted
proposal or its presentation summary. Apply it to titles, title explanations, body text,
tables, diagram labels, captions and speaker notes. Preserve quoted RFP wording,
requirement names, requirement IDs, product names and legally fixed terms.

## What a proposal deck adds to the sentence standard

- **The actors a bid names** are 제안사, 시스템, 수집 에이전트, 담당자, 결재자 and 발주자, and a
  sentence that states a proposal, a control, a workflow or a completion criterion names the
  one it means rather than leaving the evaluator to reconstruct it from the neighbouring boxes.
- **A cell that must stay nominal** takes a row label that names the question and an adjacent
  value that states the answer. A factual label-value card (`규모`, `성과`, `등급`, `기간`,
  `자격`, `경력`) carries compact verified values
  (`총자산 100백만원 · 자기자본 62백만원 · 결손 없음`) rather than prose (`…이며 … 유지된다`),
  and full sentences stay for the actions, conditions, controls and decisions whose
  relationship would otherwise be lost.
- **A vague pointer at the head of a printed explanation** (`이 범위`, `이 운영 기반`, `그 장비`
  beside the standard's own list) is replaced by the business, the system, the record, the
  condition or the preceding action it stands for.
- **A spoken transition stands only in a speaker note**, where it helps the oral flow, and even
  there it does not replace the subject or the action.
- **A demonstration number the user has excluded from the oral presentation** stays out of the
  speaker notes.

## The submitted document

The proposal must stand without a presenter. Each page states the business context,
proposer action, method or control, and evidence or deliverable needed for evaluation.

- Use polite proposer endings only in a part divider's lede and in the explanatory copy
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
  slide, and they are written for the ear by `simplecore:slide-decks`' rules (「The script is
  heard, not read」): the screen's order in its printed words, then the evidence and the
  judgment the slide cannot carry. They never point to positions or rename the same concept.
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

1. Build a page inventory of every page or slide containing its title, title explanation,
   body strings, diagram labels, captions and notes.
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
8. Repeat the inventory review after rendering. A page is complete only when its wording is
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
