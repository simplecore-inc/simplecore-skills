---
audit:
  paths: []          # Default audit scope, relative to the project root holding this file. Empty means the whole project. e.g. [docs]
  exclude: []        # Globs to exclude from the audit. e.g. ["**/legacy/**", "CHANGELOG.md"]
  localeResources: [] # Globs for locale resource files holding screen copy. For these, only quoted string values are checked (keys and comments are not). e.g. ["packages/i18n/src/resources/*.ts", "locales/*.json"]
                      # `*` does not cross `/` (unlike a git pathspec) — use `**/` to reach subdirectories.
                      # A pattern matching no file at all is an error and makes check exit 1.
  untranslated: false # true warns about leftover English sentences (for translation projects)
---

# Korean glossary — <project>

The Korean terminology and spelling standard for this project. Every task that writes, translates,
or proofreads Korean reads this file first.

- The audit script of the korean-docs skill (`${CLAUDE_PLUGIN_ROOT}/skills/korean-docs/`) merges this
  file with the base glossary (GLOSSARY.base.md) and checks both. To run it:
  `/simplecore:glossary-audit [paths...]`, or
  `node "${CLAUDE_PLUGIN_ROOT}/skills/korean-docs/scripts/check-glossary.mjs" [paths...]`.
- The table format (columns and headers) is parsed by the script, so do not change it. Items are
  separated by `,`. A `/pattern/` item is a regex; anything else is a literal. Do not write `|`
  inside a cell (separate items instead of using alternation) and do not write `,` inside a regex.
- The `수준` column of `금지 표현`: `오류` is a violation on sight (the audit fails), `경고` is for
  review, and `경고(N+)` is reported only at N or more occurrences in one file. Anything outside
  those three is a parse error, and the form is exact with no spaces, as in `경고(3+)`.
- `경고(N+)` counts only what the author repeated. **The replacement side of a `금지 → 대체` contrast
  row is not counted** — it is copy the catalogue prescribes, not the author's own sentence. Only a
  single-arrow pair inside a list item, a quotation line, or a table cell is read as a contrast row,
  so an arrow written inline in running prose is counted and reported as usual.
- After changing a standard translation or adding a banned spelling, run the audit again in the same
  session and fix the existing documents. Never leave the glossary and the documents disagreeing.

## 용어 대역표

This project's domain concepts and the terms whose translation could go either way. Write the
expected misspellings and competing spellings in the `금지 표기` column — that column is what the
audit runs on.

| 영어 | 한국어 | 금지 표기 | 비고 |
| ---- | ------ | --------- | ---- |

Examples (add rows like these to the table above):

```
| endpoint | 엔드포인트 | 종단점, 엔드 포인트 | |
| primary key | 기본 키 | 주 키, 프라이머리 키 | gloss as "기본 키(primary key)" on first use |
| lease | 리스 | 임대, 임차 | a domain concept; gloss as "리스(lease)" on first use |
```

## 원문 유지 용어

Terms kept in the original rather than translated or transliterated (product names, language names,
abbreviations, API names). Not an audit target; a reference while writing and reviewing.

| 용어 | 비고 |
| ---- | ---- |

## 금지 표현

Add only the patterns specific to this project. Common translation-ese and spelling errors are
already caught by the base glossary.

| 금지 | 대체 | 수준 | 비고 |
| ---- | ---- | ---- | ---- |

## 기본 규칙 예외

Disable the base-glossary rules that do not fit this project or domain. In `항목` write either the
English key of a base translation row (disabling the whole row) or the text of a banned pattern
(disabling that one rule). The pattern text must match the base glossary **exactly, whitespace and
symbols included** — one character off disables nothing, and `check` reports that row as a dead
exception.

**The audit engine's built-in checks are turned off through the same table.** Only the three
warning-level ones can be turned off — `heading-form` (the heading is a sentence) · `repeat` (the
same word twice in a row) · `untranslated` (possibly untranslated). The error-level particle checks
(`particle` · `interpolated-particle` · `reference-particle`) do not split by context and are
refused as a configuration error. Every disabled check is printed on each run, so silence is never
read as a pass.

The other way is to define a row with the same English key under `## 용어 대역표` above. That
**replaces the base row entirely**, so carry over any base banned spellings you want to keep.

| 항목 | 사유 |
| ---- | ---- |

Examples:

```
| 레버리지 | a financial document — the settled term stays |
| method | this project uses "메소드" by convention |
| /소비(?!자)/ | a messaging document — "메시지를 소비한다" is the settled expression |
| heading-form | a rulebook, where a heading is the rule sentence itself |
```

## 문체·표기 규칙

Write the project-specific rules the audit script cannot catch here. The general standard is the
skill's `references/response-style.md` (vocabulary, spelling, register),
`references/korean-style.md` (sentence patterns and translation register), and
`references/ai-tells.md` (the structural habits an audit cannot see).

- The register follows the table in section 1 of the skill's `references/response-style.md`: design
  and development documents are -다체, manuals and screen copy are 합니다체, and an instruction to
  the reader is 「~하세요」. Write it here if this project decides otherwise.
- Gloss a key concept as `한국어(English)` on first use in each document, and use Korean alone
  afterwards.
- Particles (은/는, 이/가, 을/를, 과/와) agree with the final consonant of the preceding word. After a
  word kept in English, agreement follows how it is actually pronounced.
