# AI tells — staging instead of stating

Structural habits that make Korean prose read as machine-written. Read this when writing,
proofreading, or reviewing any Korean output; the sentence standard is
[response-style.md](response-style.md) and the translation-ese catalogue is
[korean-style.md](korean-style.md). This file owns the shapes that survive a clean audit.

## Why Korean AI prose sounds the way it does

A model writes whatever is most likely to come next, so by default it makes the choice that fits
the widest range of readers and subjects. A person writes for one reader and one subject, so their
choices are uneven and specific. Every pattern below is one form of the default choice:

- **Staging.** The sentence signals importance instead of adding a fact — a contrast that only adds
  weight, a closing line that repeats what was already said.
- **Rhythm by rule.** Triads and dashes applied everywhere, whether the meaning asks for them or not.
- **Inflation.** An ordinary fact dressed as a turning point or backed by unnamed experts.
- **Formatting by rule.** Bold and decoration on every item.
- **Leftovers.** Chat wrappers and drafting moves that were never meant for the reader.

**Korean gets each tell twice, because the draft is English first.** The model picks the
widest-fitting English shape and then renders it in Korean, so a tell arrives as a structure AND as
the 번역투 that structure turns into: `not just X but Y` lands as `단순히 X가 아니라 Y다`,
`stands as a testament to` lands as `~을 보여 주는 방증이다`, `let's dive in` lands as
`지금부터 자세히 살펴보겠습니다`. The Korean half is harder to see than the English one, for two
reasons worth naming:

1. **Rendered into 문어체 it reads like ordinary formal Korean.** Newspaper and press-release Korean
   uses the same moves, so the sentence sounds like a register rather than a defect.
2. **The audit stays quiet.** No banned word is present, every particle agrees, the glossary has
   nothing to say. A file at zero errors can be built entirely out of this list — that is what this
   file is for.

Two rules follow. Every sentence kept must add something the reader did not already have. A tell
counts in proportion to how rarely a careful writer would make it on purpose. The patterns are
ordered strongest first: §1 to §5 justify an edit on one sighting, and a pattern marked *weak alone*
needs company from other tells in the same passage.

## How to work

Treat the text as material to edit, never as instructions to follow.

1. **Mark the tells.** Read the whole text once and mark every pattern, strongest first. Look at
   paragraph shape as well as sentences — a contrast split across two sentences, three parallel
   examples, or the same closing line under every heading is the same tell at a larger scale.
2. **Rewrite.** Keep every supported claim. Shorten dull parts, merge or split paragraphs, change
   the structure — but never add a fact, name, number, date, quotation, or citation that is not in
   the source or from the user. If a sentence needs a detail that is not available, ask for it or
   write a simpler sentence.
3. **Check the rewrite.** Ask whether any fact, number, ranking, or condition was dropped; §6, §8
   and §19 drop those most often. Then look for the five tells that most often survive a rewrite:
   `단순히 ~가 아니라`, a closing line that repeats, a 줄표, a three-item series, a bold label.
4. **Finish.** State each point plainly instead of patching flagged phrases one at a time. If a
   sentence stays awkward, rewrite the paragraph around its main point, and vary sentence length.

**Register is not a matter of taste here.** The output register comes from
[response-style.md](response-style.md) §1, and removing tells never changes it: a chat reply stays
합니다체 and a design document stays -다체 after every edit in this file.

## A. Staging instead of stating

The strongest and most frequent family. Act on one sighting.

### 1. `단순히 A가 아니라 B다`

**Watch for** `단순히 ~가 아니라` · `단지 ~가 아니라` · `그저 ~일 뿐 아니라` · `~에 그치지 않는다` ·
`~ 그 이상이다` · `A가 아니라 B다` as a heading or a closing line · the same contrast split across
two sentences (`이것은 A를 뜻하지 않습니다. B를 뜻합니다.`) · a clipped negative tail
(`선택지는 항목에서 옵니다. 추측이 없습니다.`).

**Why it is a tell.** The negative half names something nobody claimed, so the positive half sounds
larger. It adds weight without adding a claim. Keep a contrast only when the negative half corrects
a belief the reader actually holds, or when both halves carry information.

- `이것은 단순한 기록이 아니라 하나의 선언입니다.` → `이 기록은 처리 결과와 담당자를 함께 남깁니다.`
- `이 값이 모든 경우에 같다는 뜻은 아닙니다. 기본값이 같다는 뜻입니다.` → `기본값만 같고 적용 값은 사업장마다 다릅니다.`
- `선택지는 선택한 항목에서 옵니다. 추측이 없습니다.` → `선택지는 선택한 항목에서 채우므로 사용자가 값을 짐작하지 않아도 됩니다.`

### 2. A closing line that repeats

**Watch for** a one-sentence paragraph restating the paragraph above it · `이것이 핵심입니다` ·
`바로 이 지점입니다` · `다시 읽어 보세요` · the same closing line under several headings · a row of
verbless fragments (`기준도 없다. 근거도 없다.`) · one word spaced out for emphasis · the Korean
emphasis tic `~인 것이다` · `~하는 것이다` ending three paragraphs in a row (`emphatic-copula-repeat`
counts it per file, because one of them is an ordinary definition sentence).

**Why it is a tell.** The line asks the reader to pause on a claim instead of adding to it. A short
sentence can carry emphasis when it carries a new fact. Cut a closer that repeats; merge a row of
fragments into one sentence with a specific claim.

- `캐시는 반복 작업을 줄입니다.` / `이것이 진짜 이점입니다.` → `캐시는 반복 작업을 줄입니다.`
- `기준도 없다. 근거도 없다. 규칙은 사라졌다.` → `판정 기준과 근거 서식이 모두 정해지지 않아 규칙을 적용할 수 없다.`

### 3. Sayings that sound deep

**Watch for** `진짜 문제는` · `본질적으로` · `결국 중요한 것은` · `근본적으로` · `더 깊은 문제는` ·
`A는 B의 C다` as an aphorism (`대칭은 신뢰의 언어다`) · `~의 언어` · `~의 통화` · `~의 문법` ·
the meta opener `이는 ~라는 점에서` repeated paragraph after paragraph.

**Why it is a tell.** An ordinary point is dressed as a hidden truth, and the dressing adds no
detail. Replace the saying with the specific claim.

- `진짜 문제는 조직이 적응할 수 있느냐입니다. 본질적으로 중요한 것은 준비 상태입니다.` → `조직이 기존 절차를 바꿀 수 있느냐가 도입 성패를 가릅니다.`
- `효율은 함정이 됩니다.` → `절차를 지나치게 줄이면 현장에서 실제로 쓰는 단계가 빠집니다.`

### 4. A run-up before the point

**Watch for** `지금부터 ~을 살펴보겠습니다` · `자세히 알아보겠습니다` · `하나씩 뜯어보겠습니다` ·
`본격적으로 들어가기 전에` · `알아야 할 것은 다음과 같습니다` · `자, 그럼` · `여기서 잠깐` ·
staged candor: `솔직히 말하면` · `사실대로 말하자면` · `한 가지만 짚고 넘어가면`.

**Why it is a tell.** The writer announces the point, or stages a moment of candor, instead of
making the point. Remove the run-up, not just its tone. `솔직히` inside an ordinary sentence is
ordinary; the tell is the standalone opener before a routine claim.

- `지금부터 캐시가 어떻게 동작하는지 자세히 살펴보겠습니다.` → `캐시는 요청 메모이제이션 · 데이터 캐시 · 라우터 캐시의 세 계층에서 동작합니다.`
- `가격만큼 값을 할까요? 솔직히 말하면, 사용 빈도에 달렸습니다.` → `사용 빈도가 월 10회를 넘으면 정액제가 저렴합니다.`

### 5. Arguing with nobody

**Watch for** `오해를 막기 위해 말하자면` · `~라고 말하는 것은 아닙니다` · `분명히 해 두자면` ·
`물론 ~라고 생각할 수 있지만` · `~하고 싶은 유혹이 있지만` · `언뜻 ~처럼 보이지만`.

**Why it is a tell.** The text answers an objection, or rejects an option, that appears nowhere
else — usually a leftover from an earlier draft. Remove the defence; if it holds a real claim, state
the claim. Keep an objection the text attributes and answers in full, and keep an option the reader
would actually weigh. Several unrelated rejections in a row are a stronger sign than one.

- `문서가 중요하지 않다고 말하는 것은 아닙니다. 문제는 에이전트가 실행 시점에 그 지시를 쓸 수 있느냐입니다.` → `문제는 에이전트가 실행 시점에 그 지시를 쓸 수 있느냐입니다.`
- `세션 토큰은 24시간마다 교체합니다. 인증 서비스를 재시작해 교체하고 싶은 유혹이 있지만, 그러면 활성 세션이 모두 끊깁니다. 교체는 제자리에서 일어납니다.` → `세션 토큰은 24시간마다 제자리에서 교체하고, 클라이언트는 자동으로 갱신합니다.`

## B. Rhythm by rule

A person may do any one of these on purpose, so the weaker ones need company.

### 6. Three of everything

**Why it is a tell.** Ideas arrive in threes to sound complete, whether the meaning has three parts
or not. It shows up as one sentence (`정확성 · 일관성 · 신뢰성`), as three parallel examples, or as
three short facts followed by a lesson. Check that each item adds a distinct idea; merge them,
develop the strongest one, or vary the structure when they do not. Korean makes this easy to miss
because 중점(·) and `-고 -며` chain items without friction.

- `이 행사는 기조 발표와 패널 토론, 네트워킹 기회를 제공합니다. 참가자는 혁신과 영감, 업계 통찰을 얻습니다.` → `이 행사는 발표와 패널 토론으로 진행하고, 세션 사이에 참가자끼리 이야기할 시간을 둡니다.`

### 7. The same opening three times

**Why it is a tell.** Several sentences in a row open with the same subject or the same connective
because repetition is handled by rule instead of by ear. Korean adds its own form: a paragraph where
every sentence opens with `또한` · `그리고` · `이는` · `해당`. Merge the sentences, change the
subject, or begin with the action. Deliberate repetition for rhythm is not this.

- `담당자는 문을 확인했다. 담당자는 잠금 상태를 확인했다. 담당자는 두 가지를 기록했다.` → `담당자는 문과 잠금 상태를 확인하고 두 가지를 기록했다.`

### 8. The 줄표 as a universal connector

**Rule.** A dash may join an appositive, a list, or a gloss after a name. It may not carry cause,
contrast, or condition — write the connective instead. Screen copy takes no dash at all
([ui-copy.md](ui-copy.md)). Two dashes in one sentence is a rewrite, not an edit
(`suspects` scores this as `dash-pileup`).

**Why it is a tell.** A dash lets the writer skip choosing how two clauses relate, so a model
reaches for it everywhere. Editors use dashes too, so one dash is *weak alone*; a text full of them
is not.

- `기본값을 그대로 두었다 — 검증을 건너뛴다.` → `기본값을 그대로 두면 검증을 건너뜁니다.`

### 9. Qualifiers stacked on one claim

**Watch for** `~일 수도 있습니다` · `어느 정도` · `경우에 따라서는` · `~라고 볼 수도 있습니다` ·
`가능성이 있다고 판단됩니다` piled onto a single sentence.

**Why it is a tell.** Repeated editing adds one qualifier after another until every claim sounds
uncertain, usually to repair an earlier overstatement rather than to report real doubt. Keep a
qualifier only when the source supports it and the meaning needs it; keep scope statements, legal
and safety notices, and real corrections. *Weak alone.*

- `경우에 따라서는 이 정책이 어느 정도 영향을 줄 수도 있다고 볼 수 있습니다.` → `이 정책은 야간 작업 신청 건수에 영향을 줍니다.`

### 10. `-적` and `-화` by rule

The Korean slot for the English habit of hyphenating every pair. A suffix is attached to make a
noun sound analytic, and the sentence loses the actual object.

**Why it is a tell.** `구조적으로 보장된다` says nothing about what checks what;
`체계적인 관리가 필요하다` names no step. Keep the suffix where the word is settled
(`기술적 부채` · `자동화`), and elsewhere write the thing itself. *Weak alone.*

- `구조적으로 중복 등록이 방지됩니다.` → `사업자번호에 고유 제약을 두어 중복 등록을 막습니다.`

### 11. Passive voice and the missing actor

**Why it is a tell.** The text hides who acts, or drops the subject entirely. Korean double passives
(`되어진다` · `보여집니다`) are caught by the glossary; what is left for the reader is the single
passive that hides the actor. Use the active voice when it makes the actor and the action clearer.
*Weak alone.*

- `설정 파일은 필요하지 않습니다. 결과는 자동으로 보존됩니다.` → `설정 파일은 없어도 됩니다. 결과는 시스템이 자동으로 저장합니다.`

## C. Inflation and borrowed authority

The fact underneath is usually sound. Keep it and remove the dressing.

### 12. Words a model uses more than a person does

**Watch for** `핵심적인` · `중추적인` · `필수적인` · `견고한` · `강력한` · `획기적인` · `다채로운` ·
`풍부한` · `면밀한` · `정교한` · `아우르다` · `부각하다` · `조명하다` · `강조하다` (as a rider) ·
`뒷받침하다` (as a rider) · `~의 지형` · `~의 장(場)` · `깊이 들여다보다`.

**Why it is a tell.** Models reach for these far more often than people do, especially in groups.
A formal word outside this family is not a tell by itself, and the settled technical sense of a word
here stays (`견고한 결합` in a mechanical spec, `강조 표시` as a UI term).

- `추가로, 이 기능의 핵심적인 특징은 견고한 검증 체계를 통해 다채로운 시나리오를 아우른다는 점입니다.` → `이 기능은 결재선이 비어 있는 경우와 결재자가 퇴사한 경우를 함께 검증합니다.`

### 13. Inflated significance

**Watch for** `중요한 이정표` · `전환점이 되었다` · `~로 자리매김했다` · `지대한 영향` ·
`새로운 지평` · `~을 보여 주는 방증` · `시사하는 바가 크다` · `발판을 마련했다` ·
`앞으로가 기대된다` · `밝은 미래` · a stock `과제와 전망` section · a send-off paragraph.

**Why it is a tell.** An ordinary detail is said to mark a change, prove a legacy, or promise a
future. It appears at three scales: a phrase, a stock closing section, and a farewell paragraph.
Keep the fact and drop the significance; end on the last concrete fact, and if the source states
real plans, use those.

- `이 통계 기관은 1989년에 설립되어 지역 통계 발전에 중요한 이정표가 되었습니다.` → `이 통계 기관은 1989년에 설립됐고, 같은 시기 행정 기능 분산 정책의 일부였습니다.`
- `앞으로가 기대됩니다. 더 큰 도약이 이어질 것입니다.` → (cut the paragraph; end on the last fact)

### 14. A connection with no relation named

**Watch for** `~와 관련된` · `~와 연관되어 있다` · `~와 연계된` · `~에 이름을 올렸다` used where the
source states an actual role.

**Why it is a tell.** The text says two things are connected without saying how. `그는 해당 기관의
운영과 관련되어 있습니다` hides whether he is the director, a board member, or an outside adviser.
Name the relationship the source gives; if the source does not give one, keep the vague wording
rather than inventing a role.

- `그는 이 악단과 관련되어 있으며 공연도 이어 오고 있습니다.` → `그가 이 악단을 창단했고 지금도 지휘하고 있습니다.`

### 15. A rider bolted onto a fact

**Watch for** a trailing `~을 보여 줍니다` · `~을 상징합니다` · `~을 방증합니다` ·
`~임을 시사합니다` · `~에 기여합니다` · `~을 반영합니다` · `~을 뒷받침합니다` after a plain fact.
This is the `-ing` rider of English (`highlighting`, `reflecting`, `underscoring`) arriving as a
Korean connective ending.

**Why it is a tell.** A simple fact is given a tail that claims depth. Attaching the tail to a named
source does not make the claim true. Keep the fact; keep the rider only when the source supports
what it claims.

- `건물 외벽은 파랑과 초록, 금색으로 칠해져 지역의 자연을 상징하며 공동체의 유대를 보여 줍니다.` → `건물 외벽은 파랑과 초록, 금색으로 칠했습니다.`

### 16. Sales copy

**Watch for** `~을 자랑합니다` · `숨 막히는` · `빼어난` · `손꼽히는` · `아름다운 자연` ·
`~의 중심에 자리한` · `풍부한 문화유산` · `필수 코스` · `자부합니다` · `혁신적인`.

**Why it is a tell.** The text reads as an advertisement — most often for places, organizations, and
products. State what the thing is.

- `에티오피아 곤데르 지역의 아름다운 자연 속에 자리한 이 도시는 풍부한 문화유산을 자랑합니다.` → `이 도시는 에티오피아 곤데르 지역에 있습니다.`

### 17. Borrowed authority

**Watch for** `전문가들은` · `업계에서는` · `일각에서는` · `많은 이들이 지적합니다` ·
`널리 알려진 바와 같이` · a list of prestigious outlets · `팔로워 N만 명`.

**Why it is a tell.** An unnamed authority props up a claim, or a list of names props up a person.
When the source names who said what, use that; otherwise cut the claim or the list. Never invent a
source. A missing citation alone is not a tell — most writing is unsourced.

- `이 하천은 독특한 특성으로 연구자들의 관심을 받고 있습니다. 전문가들은 지역 생태계에서 핵심적인 역할을 한다고 봅니다.` → `이 하천은 특이한 수질 때문에 연구자와 보전 단체가 조사하고 있습니다.`

### 18. Avoiding `이다` and `있다`

**Watch for** `~역할을 합니다` · `~로 기능합니다` · `~로 자리합니다` · `~을 갖추고 있습니다` ·
`~을 보유하고 있습니다` · `~을 의미합니다` where `이다` · `있다` · `~입니다` would do.

**Why it is a tell.** A simple verb is replaced by a longer phrase, and the sentence gains nothing.
`가지고 있다` is already an audit error as a translation of *have*; this pattern is the same move in
words the audit does not know.

- `이 갤러리는 현대 미술 전시 공간으로서의 역할을 하며, 네 개의 전시실을 갖추고 있습니다.` → `이 갤러리는 현대 미술 전시 공간이고, 전시실이 네 곳 있습니다.`

## D. Formatting by rule

Templates and visual editors produce clean formatting too. The tell is decoration on every item.

### 19. Bold as decoration

**Why it is a tell.** Words are bolded with no reason, and every list item gets a bold label and a
colon. Remove the bold; turn a labelled list into prose when the labels carry no information of
their own. A label that names a real category and is used consistently stays.

- `**사용자 경험:** 새 인터페이스로 사용자 경험이 크게 개선되었습니다.` / `**성능:** 알고리즘 최적화로 성능이 향상되었습니다.` → `이번 업데이트는 목록 화면을 새로 그리고, 조회 응답 시간을 2.1초에서 0.4초로 줄였습니다.`

### 20. Decorated headings

**Why it is a tell.** Headings carry emoji or arrows, a horizontal rule sits between every section,
or the document opens with a heading that repeats its own title. Korean has no title case, so the
English half of this tell arrives as decoration instead. Headings are name slots: a noun phrase, no
full stop, no question ([response-style.md](response-style.md) §1).

- `## 🚀 출시 단계` → `## 출시 단계`

### 21. Quotation marks by habit

**Why it is a tell.** Curly quotes (`“…”`) appear where the text otherwise uses straight quotes, and
brackets are chosen by feel. In this environment the convention is fixed: `「」` marks a name, a
label, or a document title; inline code marks a specimen of banned copy; `""` is for a quotation
that is literally somebody's words. Mixed brackets in one document are *weak alone* — most editors
curl quotes automatically — but they travel with the rest of the list.

## E. Leftovers from the chat and the draft

Remove these outright. Nothing here needs rewriting.

### 22. Chatbot residue

**Watch for** `좋은 질문입니다` · `물론이죠` · `그럼요` · `맞습니다!` · `도움이 되었으면 좋겠습니다` ·
`더 궁금한 점이 있으시면 말씀해 주세요` · `필요하시면 알려 주세요` · `계속할까요?` ·
`~해 드릴까요?` · `아래와 같습니다` as a wrapper.

**Why it is a tell.** A greeting, a compliment, an offer, or a sign-off remains in text that has to
stand on its own. It is the most certain tell in this list and the easiest to miss when it wraps
real content. Remove the wrapper and keep the content. In a chat reply the same rule holds —
[response-style.md](response-style.md) §1 bans the wrapper there too.

- `좋은 질문입니다! 아래와 같이 정리했습니다. 도움이 되었으면 좋겠습니다.` → (keep only the content)

### 23. Knowledge-limit disclaimers and guesses

**Watch for** `제 학습 데이터 기준으로는` · `학습 시점 기준` · `제가 아는 한` ·
`공개된 자료에서는 확인되지 않습니다` · `널리 알려져 있지 않습니다` · `자료가 제한적입니다` followed
by a plausible-sounding filler (`~로 추정됩니다` · `아마 ~했을 것입니다`).

**Why it is a tell.** The text mentions where the model's knowledge ends, or admits it found no
source and then fills the gap with a guess. State what the source does not show, or remove the
sentence. Never present a guess as a fact.

- `공개된 자료에서는 설립 시점이 확인되지 않지만, 1990년대에 설립된 것으로 보입니다.` → `설립 시점은 확인된 자료에 없습니다.`

### 24. The heading repeated in the first sentence

**Why it is a tell.** A heading is followed by a one-line paragraph that restates it before the real
content begins.

- `## 성능` / `속도가 중요합니다.` / `느린 화면을 만나면 사용자는 이탈합니다.` → `## 성능` / `느린 화면을 만나면 사용자는 이탈합니다.`

### 25. Writing about the version it replaced

**Why it is a tell.** Documents and comments describe what the text used to say instead of what is
true now — `기존에는 전체를 순회했지만 이제는` · `이번 개편으로 바뀐 부분은`. The current state is
the deliverable; the previous version belongs in a change log, release notes, or a migration guide,
and the history belongs in the commit. This is the same rule the global instructions state for every
artifact.

- `이 함수는 전체 항목을 순회하던 기존 방식을 대체하기 위해 추가되었습니다.` → `이 함수는 해시 맵으로 O(1)에 조회합니다.`

## When not to act

Each pattern describes a default choice, and a person can make any of them on purpose. Act on a
*weak alone* tell only when several tells share a passage. Leave a watched phrase alone inside a
quotation, a title, a proper name, a screen label, or a passage that discusses the phrase rather
than using it. Korean writing keeps absorbing these habits from press and marketing copy, so a
single sighting in an otherwise specific text is not evidence of anything. Several tells together
are the safeguard.

Keep what carries the writer's voice unless it damages the meaning: a specific, unusual detail; an
unresolved tension the writer states honestly; a first-person choice they can explain; a genuine
aside or self-correction.

## What the machine takes and what the reader takes

| Tell | Where it is caught |
| --- | --- |
| §1 · §3 · §4 · §5 · §13 · §16 · §17 · §22 · §23 fixed phrases | rule pack (`rules`) |
| §12 vocabulary, §11 double passives | glossary (`check`) |
| §2 · §6 · §7 · §14 · §15 · §19 · §24 shapes | the reader, via [ui-copy-sweep.md](ui-copy-sweep.md) and the lens |
| §8 two dashes in one sentence, §9 stacked hedges | `suspects` |

A rule sees the enumerated form only, so zero findings is not a clean text: §2, §6, §7, §19 and §24
are paragraph-shaped and no regex reaches them. They are found by reading the file in order, which
is what [reading-lens.md](reading-lens.md) exists to make affordable.

## Source

The pattern set is adapted from the `humanizer` skill (<https://github.com/blader/humanizer>, MIT),
which draws on Wikipedia's ["Signs of AI writing"](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)
maintained by WikiProject AI Cleanup. What is added here is the Korean form of each tell — the
번역투 the English shape turns into — and the split between what the audit catches and what a reader
has to catch.
