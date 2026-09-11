---
description: Run the Korean audit sweep — glossary words, sentence rules, style smells, resources — and drive it to zero errors
argument-hint: "[paths...] [--all] [--strict] [--untranslated] [--explain]"
---

# Glossary Audit

Run the Korean audit sweep for this project and drive it to zero errors. It covers Markdown/MDX prose and the `<text>`/`<tspan>` labels of SVG files (embedded or standalone), so diagram text is held to the same standard as the docs, and it runs every check the skill has in one pass.

1. Locate and read the project glossary before auditing: walk up from the current directory checking `<dir>/.claude/GLOSSARY.md` first, then `<dir>/GLOSSARY.md`. Read it in full — it may have changed since the session started. Tell the user which glossary file is in use.
2. If no project glossary exists, say so and offer to create one:
   `node "${CLAUDE_PLUGIN_ROOT}/skills/korean-docs/scripts/l10n.mjs" check --init`
   The base glossary bundled with the skill still applies either way; continue the audit without a project glossary if the user declines.
3. Run the sweep with the user's arguments:
   `node "${CLAUDE_PLUGIN_ROOT}/skills/korean-docs/scripts/l10n.mjs" sweep $ARGUMENTS`
   It runs every check in one pass — `check` (glossary words), `rules` (the sentence pack), `suspects` (style smells), `audit` (locale resources, when `.claude/l10n.json` declares kinds), and the lens count — and closes with what reached what: files read, glossary and sentence rule counts, and whether the lens loaded. Read that line before reading any zero as a pass. With no paths it covers the `audit.paths` configured in the glossary front matter, or the whole project if none are configured. `--all` forces a project-wide scan, `--strict` treats warnings as failures, `--untranslated` also flags remaining English prose (useful for translation projects), `--explain` prints each rule's full reasoning.
4. The lens candidates are reading material, not findings: list them with
   `node "${CLAUDE_PLUGIN_ROOT}/skills/korean-docs/scripts/l10n.mjs" lens $ARGUMENTS`
   and judge each sentence in context, as `references/reading-lens.md` describes.
5. Fix every reported error and re-run the sweep until the error count is zero. Do not weaken glossary rules to make errors pass — if a rule itself looks wrong, report the reasoning to the user first.
6. Review each warning individually: fix it, or keep it with an explicit justification.
7. Report the outcome: files audited, fixes applied, and any warnings kept with their justification.

Exit codes from the script: 0 = clean, 1 = violations found, 2 = usage or glossary-format error (fix the glossary table format, then re-run).
