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
  # as the catalogue they are rather than silenced. `references/ai-tells.md` is not excluded either:
  # it writes BOTH sides of every before/after pair in code spans, so it is judged in full and stays
  # at zero. `GLOSSARY.base.md` needs no entry either: a glossary is never judged by itself, which
  # the audit engine knows on its own.
  exclude:
    - "plugins/simplecore/skills/korean-docs/references/response-style.md"
    - "plugins/simplecore/skills/korean-docs/references/korean-style.md"
    - "plugins/simplecore/skills/korean-docs/references/ui-copy.md"
---

# simplecore-skills glossary

What this repository ships is the skill itself. Every word decision lives in
`plugins/simplecore/skills/korean-docs/GLOSSARY.base.md` — copying one here makes the two disagree
with nothing to decide which is right.

**This file exists for two reasons.** It declares the exclusion list above, and it switches on the
write-time hook: the hook runs only in a repository that has a project glossary, so without this
file nothing would check an edit to the skill's documents.

## 용어 대역표

| 영어 | 한국어 | 금지 표기 | 비고 |
| ---- | ------ | --------- | ---- |

## 기본 규칙 예외

| 항목 | 사유 |
| ---- | ---- |
| 레버리지 | The finance section of `references/domain-finance.md` names 「실효 레버리지」 a settled term. The base rule's note points at 「a finance document disables it with a base-rule exception」, and that exception applies to this repository too — a document writing down a domain's standard has to write that domain's words, and if writing the standard down made it a violation of the standard, this skill could not pass its own audit |
| heading-form | In this repository a heading is the rule sentence itself — 「D. 상태·적용·기간을 방향·스위치·이동으로 말하지 않는다」 is not the name of the section below it but the rule that section sets, and in a rulebook that form is the easiest to recognise. Rewriting them as noun phrases would mean fixing fifty-three anchors and every cross-reference pointing at them, and the rulebook would not read any better for it. `references/response-style.md` already records that a machine cannot split this judgement, so it is recorded here as a judgement a person made |
