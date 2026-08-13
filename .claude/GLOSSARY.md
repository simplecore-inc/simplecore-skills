---
audit:
  # `rules` honours this list too, so the two commands judge one file set. What is NOT excluded
  # and still reports is `references/reading-lens.md` — its family tables ARE the banned stems,
  # and the prose around them is checked, so the hits from those lines are read as the catalogue
  # they are rather than silenced.
  # Three reference files are catalogues of the very spellings and phrasings they ban — every row
  # quotes the wrong side so a reader can recognise it. Judging them against themselves reports the
  # catalogue as 155 violations and buries the findings that are real. `GLOSSARY.base.md` needs no
  # entry here: a glossary is never judged by itself, which the audit engine now knows on its own.
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
