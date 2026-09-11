# Translation-ese catalogue

The sentence-level tests used when writing, translating, proofreading, and reviewing: each pattern
carries a severity and a prescription. Read it before proofreading or review work.

How it divides with its neighbours:

- **Vocabulary and spelling** (banned literal translations and transliterations, Sino-Korean
  replacements, loanword spelling, what counts as settled, finance and quant terms) live in
  [response-style.md](response-style.md), the file that applies at all times. Apply it alongside
  this catalogue, always.
- **Structural AI habits** — staging a claim instead of stating it, a closing line that repeats,
  three of everything, inflated significance, borrowed authority, chat residue — live in
  [ai-tells.md](ai-tells.md). They carry no banned word, so the audit stays silent on them and the
  reader is the only check.
- **Machine-checkable patterns** are registered in the base glossary (`GLOSSARY.base.md`) and the
  project glossary, where the audit script catches them. This catalogue holds the sentence-level
  judgement the audit cannot make.
- **Copy that goes on a screen** (i18n resources, message bundles, wireframe board sources) adds
  [ui-copy.md](ui-copy.md). A sentence that passes the document standard can still fail on a screen
  — one more test applies there: 「does business software actually say this?」

## The principle

Do not substitute Korean words into an English sentence structure. Understand the meaning, then
write it again in Korean. Drop the subject (you/we/it), prefer active over passive, and prefer a
present-tense assertion (「~합니다」) over a future one (`~할 것입니다`).

Severity: **S1** = fix on one sighting. **S2** = fix when it repeats (roughly three times or more).

## A. Translation-ese

| Pattern | Severity | Prescription |
| ---- | ---- | ---- |
| `~에 대해(서)` · `~에 대한` everywhere | S2 | Attach the object particle directly: `X에 대해 설명` → 「X를 설명」 |
| `~를 통해` · `~를 통하여` everywhere | S2 | Spread across 「~로」, 「~해서」, 「~함으로써」 |
| `~에 있어(서)` | S1 | 「~에서」, 「~할 때」 |
| `~와 관련하여` · `~와 관련된` everywhere | S2 | 「~에」, 「~의」 |
| Over-nominalization `~에 기반하여` · `~를 바탕으로` | S2 | Back to a verb: `성능의 향상` → 「성능을 높이려면」 |
| `가지고 있다` (literal *have*) | S1 | 「~가 있다」, 「~를 제공한다」: `경쟁력을 가지고 있다` → 「경쟁력이 강하다」 |
| Double passive `되어진다` · `보여진다` | S1 | Active, or a single passive: `판단되어진다` → 「판단된다」 |
| `~에 의해` passive everywhere | S2 | Put the actor in the subject: `노드에 의해 처리` → 「노드가 처리」 |
| `~하는 것을 허용한다` · `~하는 것을 가능하게 한다` | S1 | 「~할 수 있다」 |
| `~을 위해` purpose clauses everywhere | S2 | 「~하려면」, 「~용」 |
| Literal pronouns `그` · `그것` · `그들` repeated | S1 | Drop them (Korean is comfortable without a subject) or repeat the noun |
| Plural suffix `-들` everywhere | S2 | Delete: `개발자들이` → 「개발자가」 (the context carries the plural) |
| A three-phrase modifier stacked before a noun | S2 | Split the sentence: `지난주에 출시된 새로운 버전의 클라이언트를` → 「클라이언트 새 버전이 지난주에 나왔는데, 이를」 |
| Double particles `~에서의` · `~으로의` · `~에의` | S2 | Unfold into a clause or a phrase |
| `~할 것입니다` (literal *will*) | S2 | A statement of fact is present tense, 「~합니다」 |
| `~할 수 있습니다` (*can*) everywhere | S2 | Assert where you can: 「~합니다」. Describing a capability is fine |
| Transliteration everywhere: `디폴트`, `레버리지`, `이슈` (meaning a problem), the `노트` of `릴리즈 노트` | S1 | 기본값, 활용, 문제, 참고 |
| Awkward Sino-Korean: `함의`, `동치`, `정련`, `가역`, `미지의` | S2 | 뒷받침, 일치, 정제, 되돌릴 수 있는, 낯선 (the full replacement list is in response-style.md) |

## B. Bilingual notation and terms

| Pattern | Severity | Prescription |
| ---- | ---- | ---- |
| The English in parentheses after every occurrence | S2 | Gloss it on first use in a document, Korean only afterwards |
| Translatable English left as English | S2 | Translate it, but keep industry-standard abbreviations (API, LLM) |
| Transliterated product and language names (`도커`, `쿠버네티스`, `자바`) | S1 | Keep the original (Docker, Kubernetes, Java) |
| A half-translated English idiom (`단일 소스`, `아군으로 만들기`) | S1 | Plain Korean for the context: 「한 곳에서 관리」, 「강점으로」 |
| An English word plus `-하다` · `-되다` (`인라인하다`, `resolve되다`) | S1 | A Korean verb: 「직접 작성하다」, 「~를 가리키다」 |

## C. AI habits

They live in [ai-tells.md](ai-tells.md), catalogued by strength with the Korean form each English
pattern turns into. The five that most often survive a rewrite are `단순히 ~가 아니라`, a closing
line that repeats, a 줄표, a three-item series, and a bold label.

## Register (documents and translations)

- The register per deliverable follows the table in [response-style.md](response-style.md) §1. A
  manual and reader-facing explanatory text are 합니다체 with 「~하세요」 for instructions; design and
  development documents are -다체. (A project glossary with a different standard wins.)
- An imperative source becomes 「~하세요」 · 「합니다」, and an explanatory source becomes a plain
  declarative. Keep the source's tone, including the level of a caution or a warning.
- Particles (은/는 · 이/가 · 을/를 · 과/와) agree with the final consonant of the preceding word. After
  a word kept in English, agreement follows how it is actually pronounced (「Ignite는」,
  「RAFT 그룹은」).
- If the sentence grows longer than the source, split it in two. Do not carry an English relative
  clause over as one long Korean modifier.

## What translation and proofreading must preserve

- Proper nouns, figures, dates, units, and direct quotations do not change by a single character.
- A formal source stays formal in the result.
- Do not add a metaphor, a flourish, or content that is not in the source in the name of polish.
  Fidelity to the source outranks fluency.
- Settled loanwords and settled technical terms stay — judge them by the over-correction section of
  response-style.md.
