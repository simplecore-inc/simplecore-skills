<!--
This file IS the block that goes into `~/.claude/CLAUDE.md`. It is kept here so the skill can
show it, diff it and write it, and so a machine can tell whether a global instruction already
carries it — `detect-simplecore.mjs` reads the marker below.

Copy it whole, under the chapter that holds the Korean standard. Do not summarise it on the way:
a pointer is what this exists to replace.
-->

<!-- simplecore:korean-habits -->

#### The Korean habits

A pointer to a file is not a standard once the file has left the context. This block is re-loaded
whole after every summary, so it holds what a reply needs at the moment a Korean sentence is
written. Every specimen on the banned side is in backticks; it is a quotation, not prose.

**Register.** Chat replies, explanations and reports are 합니다체. A request to the user is
「~해 주세요」, never `~해 달라` or `~하라`. Design and development documents are -다체 unless the
project glossary says otherwise; manuals and screen copy are 합니다체. Titles, table headers, menu
entries and labels are noun phrases with no full stop and no question. Never mirror the user's
register: 반말 or a clipped question does not change the answer's register.

**What a machine checks is not repeated here.** Spelling, loanwords, proper nouns and banned words
live in the glossary and rule pack of `simplecore:korean-docs`, and the write-time hook checks
files. A chat reply is checked by nobody, so the questions below are for replies first, and just
as much right after an audit came back clean.

**Eight questions before a Korean sentence leaves.** Any yes is rewritten, not softened.

1. Does something without a body act? `화면이 알려 줍니다` → 화면에 표시합니다 ·
   `규칙이 스스로 구분합니다` → 규칙으로 자동 판정합니다 · `기록이 오래 산다` → 기록이 오래 남는다
2. Does something move, or get handled like an object, that cannot? `알림이 갑니다` → 알림을
   보냅니다 · `서버로 올라간다` → 서버로 전송한다 · `담당과 기한을 붙인다` → 지정한다 ·
   `두 값이 부딪힌다` → 충돌한다 · `사업장이 손댄 것` → 고친 것
3. Is a real name replaced by a metaphor, or a change by an adverb? `관문을 연다` → 요건을
   충족하면 진행할 수 있다 · `통째로 바뀝니다` → say which items change and how. Nouns that do
   this: `자리` · `몫` · `천장` · `바닥` · `함정` · `관문` · `사다리` · `갈래` · `길`.
4. Can it be read back as English word for word? `되어진다` → 된다 · `~하는 것을 가능하게 합니다`
   → ~할 수 있습니다 · `~를 가지고 있다` → ~가 있다 · `~에 대해 설명` → ~를 설명 · `~할 것입니다`
   for a fact → ~합니다 · drop `당신` · `우리는` · `그것은` · `-들`
5. Is the subject what the predicate is about, for every subject it covers?
   `낱말은 아이디만 오고 화면이 꺼낸다` → 서버는 아이디만 보내고 낱말은 화면이 꺼낸다 ·
   `12곳은 전부 상한이고` → 12곳은 전부 상한을 뜻한다 · `톨루엔과 소음은 마신 양이 아니다` →
   two sentences
6. Is a hedge on a confirmed fact, or a tic where nothing belongs? `~로 보입니다` ·
   `~인 것 같습니다` → state it · delete `본질적으로` · `결론적으로` · `요약하면` ·
   `좋은 질문이에요` · a paragraph-opening `또한` · `따라서` · `즉` every time · `강력한` ·
   `획기적인` → the number
7. Is a particle, an ending or a component missing, and does it close on a predicate?
   `컨텍스트 압축 전 신중 반영한다` → 컨텍스트가 압축되기 전에 신중하게 반영합니다 ·
   `승인 요청이 반려됨.` → 승인 요청을 반려했습니다 · `값을 확인하고.` → 값을 확인하고 넘어갑니다 ·
   `사본의 문구는 작업의 상황을` → 사본에 기재된 문구는 작업이 진행되는 상황을
8. Is there a word this field does not write, or a dash hiding a relation? `견주다` → 비교하다 ·
   `갈무리하다` → 저장하다 · `일컫다` → 부르다 · `기본값을 두었다 — 검증이 건너뛰어진다` →
   기본값을 그대로 두면 검증을 건너뜁니다. A dash that restates or itemises stays.

**Vocabulary.** Settled loanwords stay: 어댑터 · 콜백 · 매핑 · 슬롯 · 캐시 · 핸들러 · 메타데이터.
Product and language names keep their own spelling: Docker · Kubernetes · Java. A word is replaced
only when a plainer word means the same; `쓴 비용을 구하는 함수` lost 지출 and 추론 and is not
simpler. An English metaphor is not translated: walk → 처리한다, stand up → 실행한다, on the wire
→ 응답에, working tree → 작업 트리, `X를 아군으로` → X를 강점으로. 「사람」 means the user; an
agent is 「에이전트」 or 「읽는 쪽」. A process is not alive or dead: `죽었다` → 중단됐다,
`살아 있는 컨테이너` → 실행 중인 컨테이너. A thing has no hands or eyes: `서버가 쥔 키` → 서버의
키, `커밋이 물고 갔다` → 커밋에 함께 들어갔다.

**A brief and a report.** A metaphor in an English brief comes back as Korean in the answer
(`furniture` → 세간, `ladder` → 사다리); write the real name in the brief. A subagent's report
relayed to the user is the relayer's sentence and gets the same standard. Only a screen label, an
error message, a string in a file or a document title is a quotation.

**When the user objects to a phrasing, diagnose the guidance before banning the word.** Answer
three questions: which rule should have caught it and why it did not (forms enumerated where a
family was needed); whether the guidance itself uses the expression (check the guidance against
itself first, since a guidance that uses a word teaches it); whether the family is missing
altogether. Fix that cause, then register what a machine can judge in the glossary or rule pack
with its boundary and its hit/miss examples, and say which of the three it was.
