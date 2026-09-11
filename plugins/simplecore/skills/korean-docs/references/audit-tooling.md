# Audit tooling — l10n.mjs · the hook · declaration files · writing rules

Read this when running the audit, when creating or changing a rule, or when confirming a finding
somebody else reported. The sentence standard is in [response-style.md](response-style.md); this
file covers only what the tool checks and how.

## One tool, two rule sources

One script, `scripts/l10n.mjs`, checks documents and locale resources with the same rules.

| Source | File | What it checks | Commands that read it |
| --- | --- | --- | --- |
| Glossary | `GLOSSARY.base.md` + the project's `.claude/GLOSSARY.md` | spelling · transliteration · proper nouns · banned words (word level) | `check` · `audit` · the write-time hook |
| Rule pack | `RULES.base.json` + the project's `.claude/l10n-rules.json` | sentence patterns (regex, hit/miss examples required) | `rules` |
| Lens | `references/lens.txt` | widens what narrow rules miss into candidates for a person to read | `lens` |

```bash
T="$HOME/.claude/skills/simplecore/skills/korean-docs/scripts/l10n.mjs"
node "$T" sweep [paths...]       # rules --test, then check · rules · suspects · audit (when declared) · lens count, then what reached what
  --all --strict --explain --untranslated   # passed through to the commands that take them
node "$T" check [paths...]       # document audit — audit.paths, or the whole project (same judgement as the hook)
  --all             # ignore audit.paths and take the whole project
  --strict          # treat warnings as failures
  --untranslated    # warn on leftover English sentences (translation projects)
  --glossary <p>    # point at a glossary directly
  --no-base         # exclude the base glossary
  --list-rules      # show the merged rules (compare against what you registered)
  --init            # create a .claude/GLOSSARY.md template
  --init-l10n       # create the .claude/l10n.json + .claude/l10n-rules.json skeleton
node "$T" audit [--kind K]       # resource audit — missing translations · banned spellings · particles · paired language files
node "$T" rules --test           # verify the rule pack against its own hit/miss examples
node "$T" rules [paths...] [--scope S] [--explain] [--strict]  # sentence-rule sweep (changes nothing); errors set the exit code, --strict adds warnings
node "$T" suspects [paths...] [--json]  # rank the sentences that read as translated
node "$T" lens [paths...] [--count] [--json]  # the reading lens over the same files, or over a draft outside the project
node "$T" grep <pattern> [--regex]  # search the copy values of the resources
node "$T" list                   # the files the declaration actually catches
node "$T" apply --patch <file>   # apply a list of rewritten sentences (a preview until --write)
```

`scripts/check-glossary.mjs` is the hook entry point into the same engine, so it judges exactly as
`check` does.

**There is no bulk-substitution command and there will not be one.** A rule knows where a word is,
not what it means there. Find the places with `sweep`, read the context, and feed the rewritten
sentences back through `apply --patch`. If the stored original no longer matches the file,
the patch is refused.

## Glossary or rule pack

Either condition puts it in the rule pack; neither puts it in the glossary.

1. The thing to ban conjugates.
2. An exception separating it from legitimate use has to be written down.

The second alone is enough. `거울상` · `판박이` are nouns that do not conjugate, but the exceptions
for optics' 「거울상 이성질체」 and 「판박이 스티커」 cannot be written on a glossary row. A glossary
row holds neither hit/miss examples nor exceptions, so a conjugating word put there catches the one
form written down and misses every other ending.

| What goes in | Where |
| --- | --- |
| Spelling · transliteration · typos | the glossary |
| A project's chosen translations and banned spellings | the project glossary |
| Anything that conjugates | the rule pack |
| Anything needing an exception | the rule pack |

## Glossary format

- The table format (column layout, `/pattern/` for a regex, `,` as the separator, no `|` inside a
  cell, no `,` inside a regex) has to hold or the file does not parse.
- The `수준` of a `금지 표현` row is exactly one of `오류` · `경고` · `경고(N+)` (reported only at N
  or more occurrences in one file). Anything else is a parse error.
- `경고(N+)` does not count the replacement side of a 「금지 → 대체」 contrast row.
- After registering, compare with `--list-rules` to confirm the row produces the pattern and level
  you intended. The script only reports regex errors, level spelling, and shifted columns.
- Front matter settings: `audit.paths` · `audit.exclude` · `audit.localeResources` ·
  `audit.untranslated` · `audit.resolvedPlaceholders`.
- An explicitly named file is checked even if `audit.exclude` covers it. The glossary file itself is
  never checked. **The exclusion reaches a declared kind too**: a kind glob is a git pathspec, and
  git's `*` crosses `/`, so a `docs/*.md` kind takes every document under `docs` — including the
  review records a project excluded because they quote each round's sentences verbatim. `discover()`
  drops those before any command reads them.
- Code blocks, inline code, link targets, and URLs are excluded from checking. **Put a specimen of
  banned copy in inline code.** Text inside 「」 is read as ordinary prose, so a document explaining a
  rule with its specimens in 「」 trips its own rule. Use 「」 for names: a screen label, a term, a
  document title.

### Customizing a base rule

`GLOSSARY.base.md` is shared by every project, so it is not edited. Adjust from the project
glossary.

- **Replacement**: defining a row with the same `영어` key replaces the base row entirely. Carry over
  any banned spellings you want to keep.
- **Disabling**: list the English key (the whole row) or the pattern text (one rule) in the
  `## 기본 규칙 예외` table. The pattern text must match exactly, whitespace and symbols included, or
  `check` reports it as a dead exception.
- **Turning off a built-in check**: put `heading-form` · `repeat` · `untranslated` in the same table.
  Only warning-level checks can be turned off. The error-level particle checks (`particle` ·
  `interpolated-particle` · `reference-particle`) are refused as a configuration error if listed.
  Every disabled check is printed on each run.
- **Narrow instead of disabling**: do not switch off a whole rule because of one quotation that is
  correct in one place. Writing `find` · `why` · `sample` under `except` in
  `.claude/l10n-rules.json` releases that one site. `rules --test` proves that the rule catches the
  `sample` and that the exception covers that position.

```json
"except": {
  "loanword-spelling": [{
    "find": "/어플리케이션 응답시간/",
    "why": "제안요청서 요구사항명 원문. 고치면 인용이 아니게 된다",
    "sample": "| PER-001 | 어플리케이션 응답시간 |"
  }]
}
```

### A span copied verbatim from somebody else's document — `l10n:quote`

A span that has to stay character for character — a request-for-proposal original, a standard, a
statutory clause — is wrapped in a marker with the reason beside it.

```markdown
<!-- l10n:quote 제안요청서 SFR-003 원문 -->
정의: 클러스터 노드별 태스크 분배, 장애 시 절체 및 복구 후 재분배 기능 제공
<!-- l10n:/quote -->
```

- `check` · `rules` · `suspects` skip the same span. Leaving it unclosed is an error.
- The number of skipped lines is printed on every run.
- Do not fix mistakes inside the quoted original. Record where it conflicts with the standard in the
  project glossary.
- In screen copy, the inside of `<code>` · `<kbd>` · `<samp>` · `<tt>` and of any element whose
  `class` contains `mono` or `code` is excluded the same way. An element containing any Hangul is
  not excluded.

### The two built-in checks

They run regardless of the glossary.

- **Particle disagreement** (이/가 · 을/를 · 과/와): an error. It judges only after a word that can
  appear as a replacement in the glossary or the rule pack. A particle after an unregistered word is
  read by a person. 은/는 overlaps with the adnominal ending and is not checked.
- **The same word twice in a row** (`같은 같은`): a warning. Only adjacent words count.

### Placeholders the build resolves to a fixed value

A reference such as a wireframe board's `{{b-06-new}}`, which the build renders as `B-06`, is
written by somebody who knows the final syllable and picks the particle for it. Declaring it in
`audit.resolvedPlaceholders` judges the particle against the rendered value. The declaration turns
the check on, not off. Digits and Roman letters are read as Korean (0 공 · 1 일 · L 엘) for the final
consonant.

```yaml
audit:
  resolvedPlaceholders:
    - '^([a-z])-(\d{2})(?:-[a-z0-9-]+)?$ => \U$1-$2'
```

## The write-time hook

- The plugin's `hooks/hooks.json` binds `hooks/check-md-glossary.mjs` to `Write|Edit|MultiEdit`.
  Nothing in the global or project `settings.json` declares it, and that is normal. It is a blocking
  hook: an error stops at that point rather than reverting the edit.
- **It makes two runs on the written file**: `check` for the glossary words, then `rules` for the
  sentence pack. The two answer different questions — a document can be clean of every banned
  spelling and full of personification and AI tells — and both reports come back together under
  `[glossary]` and `[sentence rules]`. A file the project lists in `audit.exclude` is skipped by
  the second run and named as skipped, so an edit to a catalogue that quotes the banned sentences
  on purpose is never blocked by the sentences it quotes.
- An error-level rule blocks; a warning-level rule reports and lets the edit stand. A false
  positive is narrowed with `except` in `.claude/l10n-rules.json` (below), never by switching the
  hook off.
- Which files count: documents (`.md` · `.mdx` · `.svg`) and the resources the glossary's
  `audit.localeResources` declares get both runs; a file declared only as a kind in
  `.claude/l10n.json` gets the sentence-rule run alone, read by that kind's format and register,
  because the word check would read its keys as prose.
- It checks only in a project that has a glossary (`.claude/GLOSSARY.md` or `GLOSSARY.md`). No
  glossary means write-time checking is off entirely.
- A document changed through `Bash` — `node` · `python` · `sed` · a heredoc — never passes the hook.
  When a script edited a document, run `check` on that file directly, chained onto the script
  command with `&&` so it is one call.
- If you doubt the hook is running, do not go digging through settings files: write one banned
  spelling into a file and save it. Delete that line immediately afterwards.
- It also fires on the resource files declared in `audit.localeResources`.

## Resource declaration — `.claude/l10n.json`

Which paths hold locale resources is declared by the project in `kinds`. The skill assumes no
layout.

- `kinds.<name>`: `label` · `patterns` (glob) · `languages` · `format` (`json` · `properties` · `ts`
  · `markdown` · `html` · `wireframe` · `text` · `auto`) · `register` · `exclude` · `optIn` ·
  `stemKey`.
- `register`: `"screen"` (screen copy, 합니다체) · `"manual"` (reader-facing 합니다체 prose) ·
  omitted (a -다체 working document). Checks that only mean something in one register are gated on
  this value.
- `optIn`: `true` removes the kind from every default sweep. Naming commands (`["audit"]`) removes it
  from those only. A kind a generator rewrites is removed from the translation gate (`audit`) while
  the sentence rules keep running on it. Removing it with `true` also loses it for `rules` ·
  `suspects` · `grep` · `list`, and that zero is indistinguishable from a pass.
- `stemKey`: pairs up files in a kind whose filenames are translated too. Write a regex capturing
  the part that is not translated, for example `"^docs/manual/[^/]+/(\\d+)-"`.
- `untranslatedExclude`: paths (a file or a directory prefix) whose English is deliberate, so the
  missing-translation check skips them whole. `untranslatedAllow`: regexes matched against a
  catalogue key or value; a match is a value that has no Korean form — a unit (`μm`), a language
  name shown in its own language (`English`), a file list, a formula of identifiers. Both lists
  are the project's; the skill ships neither.
- With no declaration at all, `rules` · `suspects` · `grep` · `list` still run over the document set
  `check` reads (`.md` · `.mdx` · `.svg`). Only `audit` requires the declaration.
- **`.claude/l10n.json` is only consulted when an audit was requested.** When it is missing, say in
  one line what cannot be checked and do not offer to create it. If the user asks, create it with
  `check --init-l10n` and confirm with `list` that the files are actually caught.

### Traps in enumerating files

- `git ls-files`'s `**` means one or more path segments, so `locales/**/ko.json` does not match
  `locales/ko.json`. When both shapes exist, write two globs.
- **A file not yet `git add`ed is not in the enumeration.** It is reported as zero without having
  been checked. Stage new files before the audit, and compare the file count `list` prints against
  the real one.
- Globs in `audit.localeResources` are relative to the repository root, and `*` does not cross `/`.
  To include subdirectories write `src/**/*.mjs`. A pattern matching no file at all makes `check`
  exit with an error.
- `check` prints the resource file count as `자원 파일 N개 (이번 검사 범위 M개)`. A run naming a
  single file is normal with M at zero; a broken declaration is N at zero.

## Writing a rule pack

Every rule carries `id` · `scope` · `severity` · `reason` · `find` · `replace` · `hit` · `miss`, and
is verified with `rules --test`. The `universal` scope always applies; a domain scope (`saas` and
the like) applies when the project opts in through `ruleScopes` in `.claude/l10n.json`. A rule
written for one register names it in `registers` (`screen` · `manual` · `plain`; a document with no
declared kind is `plain`) and is skipped elsewhere — 「~할 수 있습니다」 replacing an instruction is
a defect on a screen and the ordinary capability sentence of a reference manual, and a rule that
cannot tell the two apart by letters tells them apart by register. A rule true
beyond this repository goes into `RULES.base.json`; a rule true only in one project goes into that
project's `.claude/l10n-rules.json`.

### `\b` is not a boundary after Hangul

JavaScript's `\b` is ASCII-based, so `/전에\b/` catches nothing in a Korean sentence, and that zero
is indistinguishable from a clean repository. Match the phrase literally, or write the neighbouring
characters yourself when a boundary is needed: `(?<![가-힣])` · `[^가-힣]`. A rule with hit examples
has this failure caught by `rules --test`.

### Do not write `|$` inside a lookahead

A pattern ending in a negative lookahead, such as `자바(?!스크립트)`, is satisfied for free at the
end of a string. At an artificial end — a markdown line cut off by a code fragment — a correct word
is reported. The place to fix is not the pattern but the extractor: `segment()` carries the
following text as `after`, rules match against `text + after`, and a hit counts only when it starts
inside `text`. Writing `(?!스크립트|$)` rejects the real end too and becomes a miss. A new extractor
declares its own boundaries in `EXTRACTOR_CASES` with `want` · `wantAfter` · `silent` · `loud`.

### A rule that uses a particle as a boundary meets words ending in that syllable

A rule looking for the adnominal 「의」 reads 회의 · 협의 · 임의 · 질의 as 「회 + 의」. 「가」 does the
same to 추가 · 평가 · 증가, and 「로」 to 별도로 · 주로. The fix is not more `miss` examples but a
condition excluding those words whole. Before writing the rule, count the words ending in that
syllable.

### Trust a new rule only after running it on somebody else's writing

`rules --test` proves only the range its author imagined. A legitimate use nobody imagined is in
neither `hit` nor `miss`.

- Run it on product documents written by a person or an agent who has never seen the rule. The skill
  repository puts its specimens in backticks, which makes it the safest corpus there is and
  therefore no proof at all.
- When a false positive appears, add that sentence as a `miss` example. Writing it into `reason`
  does not stop the next person from widening the pattern.
- A narrowed rule's zero is proved by sweeping the broad form of the type with `grep --regex` and
  reading what remains to confirm every sentence is correct.
- Do not narrow a rule that has no false positives because of one hypothetical.

### A type that can only be half-judged is dropped by the rule and taken by the lens

If a regex can separate only half of a type, a rule that reports on the other half is worse than no
rule. Output with correct sentences mixed in trains its reader to skim, and the real findings go
unread. A structure that letters do not separate (`다시 싣지 않는다` against `원문을 싣지 않는다`)
comes out of the rules, and its stem goes into `lens.txt`. When you narrow, write in `reason` what
you handed to the lens.

### The lens

A rule sees only the forms registered in it. It has to enumerate objects, endings change syllable
blocks, and the same metaphor appears as different verbs, so zero findings from the rules is not
「clean」. The lens is built the other way, broad, to select candidates for a person to read. When you
add one stem, add its final, adnominal, connective, and nominal forms with it. The details are in
[reading-lens.md](reading-lens.md).

```bash
T="$HOME/.claude/skills/simplecore/skills/korean-docs/scripts/l10n.mjs"
node "$T" lens                   # the document set, or the declared resources
node "$T" lens docs/manual       # one directory
node "$T" lens /tmp/draft.md     # a draft outside the project — a reply before it is sent
```

### Anchor an ending check on everything that closes a clause

Anchoring on the full stop alone lets `…합니다({{ref}}).` and `…합니다<br>` pass. Anchor on
everything that closes a clause: a full stop, an opening bracket, a tag, a quotation mark, a
backtick, the end of the line. Where there are two registers (screen copy in 합니다체, working
documents in -다체), the check runs in both directions.

```text
(?=[.。(<'`]|\s*$)
```

## Confirming a finding somebody else reported

- Word bans come from `check` and sentence patterns from `rules`. A report carries only the rule
  name, so **run `sweep`**, which runs every command. A zero from another command is not evidence.
- Sweeping the report itself does not reproduce anything: a specimen in backticks is skipped by the
  checker. The reporting side writes the raw finding line, the sentence it avoided, the file holding
  that sentence, and the command that was run. The confirming side checks that file, and when the
  file does not exist, puts the sentence into the repository, stages it, and runs all four.
- When an audit returns zero, confirm the check reached the file first: insert one deliberate
  violation, see it caught, and delete it.

## SVG and locale resources

- The body of `<text>` · `<tspan>` in an `.svg` is checked as a document. Tags, attributes, and path
  data are ignored. After changing text, re-render with the `svg-diagrams` skill and check for
  overflow and clipping. A mermaid code block inside a document is preserved as is.
- **`audit`'s untranslated check reads catalogues only.** A file the plain-line fallback reads — a
  typesetting XML, a Python figure module, a build script — is source: every line without Hangul is
  code, so those files are never judged untranslated, the way markdown never is. Inside a catalogue a
  hex colour (`1B4A9C`) and a value made only of placeholders and separators (`%1$s ~ %2$s`, Android's
  positional `%s`) are not translations either and pass.
- A resource file listed in `audit.localeResources` is read for the values of its quoted strings
  only. Keys and comments are not checked, and `--untranslated` does not apply. The glossary is
  found by walking up from the file being checked, so the same rules apply from whatever directory
  the command runs in.

## The link to the global instructions

This skill applies to every Korean reply, but its description trigger does not fire on an ordinary
question. That gap is filled by one paragraph and one card in the global `~/.claude/CLAUDE.md`.
Bring it up only when the user says 「스킬이 안 걸린다」 · 「전역 설정을 걸어 달라」.

```bash
node "$HOME/.claude/skills/simplecore/scripts/detect-simplecore.mjs" --json   # globalKorean.present · card
```

- `present` false: the skill does not fire on ordinary questions. Propose this paragraph.
  > 세션에서 한국어 답변·산출물을 처음 작성하기 전에 `simplecore:korean-docs` 스킬의
  > `references/response-style.md`를 반드시 읽고 세션 내내 적용한다.
- `card` false: when the file it points at leaves the context, the standard leaves with it. Paste
  [global-korean-card.md](global-korean-card.md) whole, marker comments included, without
  summarizing it.
- The global instructions are the user's file: do not edit them without being asked.
