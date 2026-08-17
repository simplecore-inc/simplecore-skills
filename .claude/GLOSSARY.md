---
audit:
  # `rules` honours this list too, so the two commands judge one file set.
  #
  # Three reference files are catalogues of the very phrasings they ban. Their banned SPELLINGS
  # sit in code spans, so the glossary check reads all three clean — what cannot go into a code
  # span is a banned SENTENCE: every `금지 → 대체` row writes both sides as ordinary prose, and
  # masking the right-hand side would hide the copy a reader is meant to reuse. The sentence-rule
  # pack matches on exactly that, so judging the three against themselves adds 115 findings to
  # `rules`, every one of them a catalogue row, and buries the eight that are real.
  #
  # This list narrows the SCAN, never a write. An explicitly named path is always audited, and the
  # write-time hook names the file it just wrote — so an edit to any of these three is still
  # checked as it is made, which is where a newly added bare specimen shows up.
  #
  # What is NOT excluded and still reports is `references/reading-lens.md` — its family tables ARE
  # the banned stems, and the prose around them is checked, so the hits from those lines are read
  # as the catalogue they are rather than silenced. `GLOSSARY.base.md` needs no entry either: a
  # glossary is never judged by itself, which the audit engine knows on its own.
  exclude:
    - "plugins/simplecore/skills/korean-docs/references/response-style.md"
    - "plugins/simplecore/skills/korean-docs/references/korean-style.md"
    - "plugins/simplecore/skills/korean-docs/references/ui-copy.md"
---

# simplecore-skills 용어사전

이 저장소의 산출물은 스킬 자신이다. 낱말 결정은 전부
`plugins/simplecore/skills/korean-docs/GLOSSARY.base.md`가 갖는다 — 여기 옮겨 적으면 두 곳이
어긋나고, 어느 쪽이 맞는지 판정할 근거가 없어진다.

**이 파일이 있는 이유는 둘이다.** 위의 제외 목록을 선언하는 것과, 쓰기 시점 훅을 켜는 것 —
훅은 프로젝트 용어사전이 있는 저장소에서만 돌므로, 이 파일이 없으면 스킬 문서를 고칠 때
아무 검사도 걸리지 않는다.

## 용어 대역표

| 영어 | 한국어 | 금지 표기 | 비고 |
| ---- | ------ | --------- | ---- |

## 기본 규칙 예외

| 항목 | 사유 |
| ---- | ---- |
| 레버리지 | `references/response-style.md`의 금융 절이 「실효 레버리지」를 정착 용어로 지정한다. 기본 규칙의 비고가 「금융 문서는 예외로 비활성화」라고 가리키는 그 예외가 이 저장소에도 그대로 적용된다 — 도메인 기준을 적은 문서는 그 도메인의 낱말을 적어야 하고, 기준을 적었다는 이유로 기준을 어긴 것이 되면 이 스킬은 제 감사를 통과할 수 없다 |
| heading-form | 이 저장소의 제목은 규칙 문장 그 자체다 — 「D. 상태·적용·기간을 방향·스위치·이동으로 말하지 않는다」는 아래 절의 이름이 아니라 아래 절이 정하는 규칙이고, 규칙서에서는 그 형태가 가장 알아보기 쉽다. 명사형으로 고치면 제목 쉰셋의 앵커와 그것을 가리키는 상호 참조를 함께 고쳐야 하는데 규칙서는 그만큼도 읽기 쉬워지지 않는다. `references/response-style.md`가 이 판정을 기계로 가르기 어렵다고 이미 적어 두었으므로, 여기서는 그 판정을 사람이 내린 것으로 기록한다 |
