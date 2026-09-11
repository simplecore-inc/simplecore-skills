---
name: korean-docs
description: Use for virtually EVERY task — all user-facing output in this environment is Korean. Assistant replies and explanations, documentation, translations, proofreading, README/design docs/release notes, UI copy in i18n resources and wireframe board sources, SVG text labels, and Korean glossary (GLOSSARY.md) management. Also use when the user mentions 번역투, awkward Korean, terminology consistency, or asks to re-check documents against glossary rules (화면 문구 검토 · 카피 검수 · UX 라이팅 · 문구를 자연스럽게). 한국어로 답변·설명·문서 작성·번역·교정·검수·용어사전 관리를 하는 모든 상황에서 사용한다 — 일반 답변도 예외가 아니다.
---

# The standard for Korean output

Applies to every Korean deliverable in every project. The sentence standard is one file,
[references/response-style.md](references/response-style.md); words and spellings are checked by
machine through the glossary and the rule pack. This file decides what to read and when, when the
audit runs, and where a term decision is recorded.

**This skill is written in English.** Korean appears only where it must: the trigger phrases in the
description, a specimen of copy being judged, a glossary entry, a rule's `find`/`hit`/`miss`
examples, and the section headings the glossary parser reads. Every sentence carrying an
instruction is English, including the ones surrounding a Korean quotation.

## Two modes

**Reply mode** — every Korean reply, explanation, and report.

1. Read `references/response-style.md` if it is not in context right now. Remembering that you read
   it is not evidence: if the register table and the eight questions cannot be quoted at this
   moment, it has not been read, and the same holds after a summary.
2. If the project keeps a glossary (`.claude/GLOSSARY.md` or a root `GLOSSARY.md`), its standard
   translations and banned spellings apply to replies too.
3. Do not sweep the repository, and do not offer to create a glossary. **A report goes through
   the machine before it is sent**: a completion report, a review result, anything longer than a
   screen is written to the scratch directory first and run through `sweep <that file>` — the
   sentence rules, the smells, and the lens read it in about a tenth of a second — and what it
   finds is fixed before the reply leaves. A one-line answer needs no such pass.

**Document mode** — writing, translating, proofreading, reviewing, sweeping, glossary work.

1. Find the glossary. Walk up from the current directory checking `.claude/GLOSSARY.md` then
   `GLOSSARY.md`, stopping at a directory holding `.git` or at the home directory. Read it end to
   end when found and tell the user which file is in force. When there is none, work from the base
   glossary alone: do not propose creating one and do not report its absence.
2. Read `references/response-style.md`. Add
   [references/ai-tells.md](references/ai-tells.md) for the structural habits that survive a clean
   audit, [references/korean-style.md](references/korean-style.md) for proofreading and review,
   [references/ui-copy.md](references/ui-copy.md) for screen copy, and the procedure in
   [references/ui-copy-sweep.md](references/ui-copy-sweep.md) for any request to go through a whole
   surface (문구 검토 · 카피 검수 · 문서 전수 교정).
3. Translate by understanding the source and writing it again in Korean; check the source and the
   official documentation when a domain concept is uncertain. A translation project adds
   `--untranslated` to the audit.
4. Follow **The audit** and **Term decisions** below.

## The audit

**The standard always applies; the repository sweep runs only when asked.** The write-time hook
already runs the glossary check and the sentence-rule pack on every file written in a project that
has a glossary, so a single document is judged as it is written. A sweep of the whole repository
takes an instruction — 「감사해 줘」 · 「용어사전으로 검사해 줘」 · 「전체 재감사」 · 「문구 검토」. A
project instruction file (`AGENTS.md` · `CLAUDE.md`) requiring the audit as the closing step of some
stage is also a request. Editing one document is not a reason to sweep the repository. When the
audit environment (`.claude/l10n.json`) is missing, say in one line what cannot be checked and do
not offer to create it.

**An audit that was asked for is finished in one go.** 「감사해 줘」 means 「find it and fix it」.

- Run `sweep`. It verifies the rule pack, then runs every check — `check` · `rules` · `suspects` ·
  `audit` when resource kinds are declared · the lens count — and closes with what reached what: the file count, the glossary
  and sentence rule counts, and whether the lens loaded. Read that line before reading any zero as
  a pass; a zero over zero files is not a pass. When running one command on its own, insert a
  deliberate violation, confirm the check reaches it, and delete it.
- Fix each finding when it is found, then report. Do not stop because the count is large, because
  the types are varied, because a new rule has to be registered, or because the skill repository
  has to be edited. Do not end a turn with 「진행할까요」 · 「어느 쪽으로 할까요」.
- Zero findings from the rules does not let you skip the in-order reading in
  `references/ui-copy-sweep.md`. A rule sees only the forms registered in it.
- A type you find goes into the rule pack or the lens in the same change, and the sweep runs again
  across the repository.
- Drive errors to zero; fix warnings one by one or write down why each stays. Re-check the
  sentences you rewrote — the replacement being itself a banned expression is the most common
  outcome.
- There are exactly two places to stop: a term decision that could go either way (carry a
  provisional spelling to the end, then ask once, in a batch) and a git commit or push.

There is one tool.

```bash
T="$HOME/.claude/skills/simplecore/skills/korean-docs/scripts/l10n.mjs"
node "$T" sweep [paths...]   # every check in one run, closed by what reached what
node "$T" check [paths...]   # glossary audit alone (the write-time hook's first run)
node "$T" rules [paths...]   # sentence-rule sweep alone (the hook's second run); --test verifies the pack
node "$T" suspects [paths...]  # sentences that read as translated, ranked
node "$T" lens [paths...]    # the reading lens: candidates for a person, never verdicts
node "$T" audit              # locale-resource audit (needs .claude/l10n.json)
```

`rules` · `suspects` · `lens` take a file or a directory, and a file outside the project — a reply
drafted in the scratch directory — is read as a document, which is how a reply gets a machine's eyes
before it goes out.

Flags, the hook, the declaration files, how to write a rule, and how to confirm somebody else's
finding are in [references/audit-tooling.md](references/audit-tooling.md). Read it when running the
audit or when creating or changing a rule.

## Term decisions

Register a term in the project glossary **immediately** when any of these holds:

- It is a domain concept certain to appear in other documents.
- The translation could go either way (transliteration against translation, or two natural
  candidates).
- It is an expression this task nearly got wrong (register it as a banned spelling).
- The user corrected it (the correction becomes the standard and the earlier form becomes a banned
  spelling). Registration is the last step — first work through **A correction diagnoses the
  guidance** below.

**Glossary or rule pack.** If the thing to ban conjugates, or if an exception separating it from
legitimate use has to be written down, it belongs in the rule pack (hit/miss examples required);
otherwise it belongs in the glossary. After registering, compare the result with `--list-rules`,
and when a standard translation changed or a banned spelling was added, re-run the full audit in the
same session.

**Do not decide alone when it is uncertain.** That means two or more candidates with neither
settled, an unfamiliar domain convention, or a change to a standard already registered. Apply the
recommended spelling provisionally, carry it to the end, then ask once with the candidates, the
recommendation, and the reasoning. A subagent proceeds with its recommendation and raises the
question in its final report. Register the decision as soon as it arrives, and record the rejected
candidate as a banned spelling.

**The completion report carries a term-decision section**: what was registered (English → Korean,
banned spellings), what is waiting on the user (candidates · recommendation · reasoning), or
「용어 결정 없음」 when there is neither.

## A correction diagnoses the guidance

When the user points at a sentence, that sentence is the symptom and the diagnosis is about this
skill and the project instructions. Registering the word as banned is not the end of it. Answer the
three questions in `references/response-style.md` §5 — which rule should have caught it and why it
did not, whether the guidance itself uses the expression, whether the type is missing altogether —
fix that cause, then register, and say in the report which of the three it was.

## What not to touch (translation and proofreading)

- Code blocks, inline code, configuration keys, CLI commands, SQL keywords, file paths, URLs.
  Comments inside a code block stay in the source language.
- Front matter keys and slug values. The `title` and `description` values are translated.
- Link targets, anchors, image paths. Link text is translated.
- Markdown structure, MDX import/export statements, component names and attributes, HTML tags.
- On a site that auto-generates heading anchors, pin the original anchor on the translated heading:
  `## 버전 저장 {#version-storage}`.
- Diagram code blocks (mermaid and the like) keep their labels in the source language. A rendered
  `.svg` is the opposite: its `<text>` is audited and fixed.
- Product names, language names, abbreviations (the 「원문 유지 용어」 table of the project glossary).
- Any span wrapped in `l10n:quote`.

## Common rationalizations

| The thought | What is true |
| --- | --- |
| "I edited a document, so let me just run the sweep as a closing step" | The user did not ask for an audit, and the hook already judged the file as it was written. The standard applies while writing; the repository sweep runs when instructed. |
| "It would be helpful to mention there is no glossary" | Raising the setup at all is unasked work. Write with the base glossary. |
| "I read the glossary last time and remember it" | It changes between sessions. Read it again every time. |
| "`check` is at zero, so it is clean" | `check` is the word check alone. Judge after `sweep`, read its reach line, and read in order even at zero. |
| "Listing the findings and confirming before fixing is safer" | Whoever asked for the audit wanted fixed files. Fix without asking and confirm in the completion report. |
| "Writing a new rule edits the skill, so I need permission" | The global instructions already made that edit part of the same change. Register it and report what went in. |
| "I will register the safer-looking candidate" | Registering a contested term on your own freezes the wrong standard. Apply it provisionally, then ask. |
| "A sentence I rewrote does not need checking" | The replacement being a banned expression is the most common outcome. Check it again. |
| "The base rule does not fit, so I will edit `GLOSSARY.base.md`" | That file is shared by every project. Adjust through the project glossary's exception table, and narrow with `except` when only one site is affected. |
| "I registered it, so the report can skip it" | Registration nobody can review is not a decision. Put the term-decision section in the completion report. |

## Red flags — stop when you think this

- You are about to translate a new term "this way for now and tidy it up later".
- You are about to relax a rule instead of fixing what it found (if relaxing is right, report the
  reasoning to the user first).
- You are about to move on without registering an expression the user corrected.
- You are writing a reply in -다체, or with 「~해 달라」.
