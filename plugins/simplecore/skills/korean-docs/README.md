# korean-docs — the standard for Korean output

A general-purpose skill that applies consistent terminology and natural Korean to everything Claude
Code produces in Korean: replies, documents, translations, proofreading, and review. It works in any
project, and used together with a project glossary the terminology standard accumulates from one
task to the next.

## What it gives you

- **Korean that reads as written, not translated** — translation-ese (`~하는 것을 허용합니다`),
  double passives (`되어진다`), awkward transliterations (`디폴트`, `레짐`), and loanword spelling
  errors (`디렉토리` → 디렉터리) are caught by the standard documents and the audit script.
- **Term consistency** — standard translations and banned spellings are registered in the project
  glossary (GLOSSARY.md), and the audit script checks every document by machine.
- **A glossary that grows** — a term decided during a task and a correction from the user are
  registered immediately, so the same correction is never given twice. A term whose translation
  could go either way is not settled unilaterally: the candidates and a recommendation go to the
  user, and the decision is registered.
- **AI tells in their Korean form** — the structural habits that survive a clean audit (staging a
  claim, a closing line that repeats, inflated significance, borrowed authority, chat residue) are
  catalogued in `references/ai-tells.md` with the 번역투 each English pattern turns into.
- **Domain terminology** — the settled terms of finance, quant, and trading are built in.

## Layout

```
korean-docs/
├── SKILL.md                     # the skill body — the two modes, the workflow, how to run the audit
├── README.md                    # this file (for people)
├── GLOSSARY.base.md             # the base glossary — project-independent spelling and translation-ese rules (always applied)
├── RULES.base.json              # the base sentence rule pack — regex rules with hit/miss examples (used by `rules`)
├── scripts/
│   ├── l10n.mjs                 # the one CLI — sweep · check · rules · suspects · lens · audit · apply
│   ├── check-glossary.mjs       # the hook's first run — the glossary audit, same engine and judgement as `check`
│   └── lib/                     # the shared engine — glossary parsing and merging (glossary.mjs), document audit (doc-audit.mjs)
├── templates/
│   └── GLOSSARY.md              # the project glossary template (created by check --init)
└── references/
    ├── response-style.md        # the always-on standard — register table · eight questions · how a word is chosen (read before every reply)
    ├── ai-tells.md              # structural AI habits in their Korean form (staging, closers, inflation, residue)
    ├── global-korean-card.md    # the block pasted verbatim into the global CLAUDE.md (the habits that survive a summary)
    ├── audit-tooling.md         # audit tooling — the hook · declaration files · writing rules · confirming findings
    ├── korean-style.md          # the translation-ese catalogue with severities (S1/S2) and the fidelity standard
    ├── ui-copy.md               # judging screen copy (angles A through AA)
    ├── ui-copy-sweep.md         # the full-sweep procedure
    ├── reading-lens.md · lens.txt  # the lens that turns what rules miss into candidates for a person to read
    └── domain-finance.md        # finance · quant · trading terms (only for work in that field)
```

## How it works — two modes

- **Reply mode**: every Korean reply and explanation applies the standard in
  `references/response-style.md` (합니다체, the eight questions, how a word is chosen). Where the
  project keeps a glossary, replies follow it too. The audit scripts do not run.
- **Document mode**: writing, translating, proofreading, reviewing, and glossary work follow the
  whole workflow — read the glossary → do the work → register new terms (asking the user about the
  contested ones) → drive a requested audit to zero errors → include the term-decision section in
  the completion report.

There are two paths to activation. The skill description fires on nearly any task with Korean
output, and for the small questions where the skill is skipped, the mandatory reading instruction in
the global instructions (below) still guarantees the standard is applied.

## The link to the global instructions (required)

Using this skill in every session takes two things in the global instructions
(`~/.claude/CLAUDE.md`).

1. **A reading instruction** — one paragraph saying to read `references/response-style.md` before
   writing the session's first Korean and to apply it throughout. This covers the small questions
   where the skill does not fire.
2. **The habits card** — `references/global-korean-card.md` pasted whole, marker comments included.
   When a long session is summarized, files that were read leave the context while the global
   instructions are reloaded, so the reply register and the eight questions have to live in that
   file directly.

Check for both with `globalKorean.present` · `card` from
`node scripts/detect-simplecore.mjs --json`; `/simplecore:init` writes in whichever is missing.

## Starting in a new project

```bash
# 1. Create the project glossary (recommended location: .claude/GLOSSARY.md)
node "${CLAUDE_PLUGIN_ROOT}/skills/korean-docs/scripts/l10n.mjs" check --init

# 2. Fill in the project name and set audit.paths in the front matter
#    (for example: paths: [docs])

# 3. Register terms as you work, and run the sweep when an audit is asked for
node "${CLAUDE_PLUGIN_ROOT}/skills/korean-docs/scripts/l10n.mjs" sweep            # audit.paths, every check
node "${CLAUDE_PLUGIN_ROOT}/skills/korean-docs/scripts/l10n.mjs" sweep <paths...> # specific files or folders

# 4. (optional) A project with locale resources (i18n, message bundles, mail) declares
#    kinds in .claude/l10n.json, and audit · rules · suspects · apply then treat every
#    resource with the same rules
```

The skill works without a glossary — it checks with the base glossary (GLOSSARY.base.md) alone and
does not offer to create one. When the user asks, create it with `check --init`.

## The glossary system

- **Discovery**: walk up from the current directory checking `.claude/GLOSSARY.md` (the default
  location) then `GLOSSARY.md`, stopping at a directory holding `.git` (the project boundary) or at
  the home directory.
- **Merging**: the base glossary and the project glossary are merged for checking. Defining a row
  with the same English key in the project replaces the base row entirely, and the
  `## 기본 규칙 예외` table disables base rules one at a time (for example `레버리지` in a finance
  project). The same table can turn off a warning-level built-in check by name (`heading-form` ·
  `repeat` · `untranslated`).
- **Levels**: a banned spelling is `오류` (the audit fails); a banned expression is `오류` / `경고` /
  `경고(N+)` (reported only at N or more occurrences in one file).
- **What is counted**: `경고(N+)` and the rule pack's `minPerFile` count only what the author
  repeated. **The replacement side of a `금지 → 대체` contrast row is not counted** — it is copy the
  catalogue is prescribing, not the author's own sentence. The conditions that make a contrast row
  recognisable are in `contrastRecommendedRanges` in `scripts/lib/doc-audit.mjs`. A row that does not
  meet them is counted normally, so write catalogue pairs as a single-arrow pair inside a list item,
  a quotation line, or a table cell.
- **Format**: table items are separated by `,` and `/pattern/` is a regex. No `|` inside a cell, no
  `,` inside a regex. The full format is in `templates/GLOSSARY.md`.

## The audit tool at a glance

```
l10n.mjs sweep [paths...]  # every check in one run — check · rules · suspects · audit (when declared) · lens count — closed by what reached what
l10n.mjs check [paths...]  # document audit. With no paths: audit.paths, else the whole project
  --all            # ignore audit.paths and take the whole project
  --strict         # treat warnings as failures
  --untranslated   # warn on leftover English sentences (translation projects)
  --glossary <p>   # point at a glossary directly
  --no-base        # exclude the base glossary
  --list-rules     # print the merged rule list
  --init           # create the .claude/GLOSSARY.md template
l10n.mjs audit             # locale-resource audit (needs the kinds declaration in .claude/l10n.json)
l10n.mjs rules --test      # verify the rule pack (RULES.base.json + the project pack) against its examples
l10n.mjs rules [paths...]  # the sentence rules alone; --explain prints full reasons, --strict fails on warnings
l10n.mjs suspects · lens   # the style smells, and the reading lens (a draft outside the project is a valid path)
l10n.mjs apply --patch f   # apply sentences rewritten after reading the context (a preview until --write)
```

The write-time hook makes two runs on every file written in a project that has a glossary:
`check-glossary.mjs <file>` (the glossary words — the same engine and flags as `check`) and
`l10n.mjs rules <file>` (the sentence pack). Calling either directly gives the same judgement the
hook gives.

- An explicitly named file is always checked, regardless of `audit.exclude`. Code blocks, inline
  code, link targets, and URLs are excluded from checking.
- `.svg` files are checked alongside `.md` and `.mdx` — for SVG only `<text>`/`<tspan>` labels are
  read, and tags, attributes, styles, and path data are ignored. Both an SVG embedded in a document
  and a standalone `.svg` file in the repository are in scope.
- Exit codes: `0` pass, `1` violations, `2` usage or parse error.
