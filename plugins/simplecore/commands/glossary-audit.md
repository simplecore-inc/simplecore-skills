---
description: Run the Korean glossary audit and drive it to zero errors
argument-hint: "[paths...] [--all] [--strict] [--untranslated]"
---

# Glossary Audit

Run the Korean glossary audit for this project and drive it to zero errors. The audit covers Markdown/MDX prose and the `<text>`/`<tspan>` labels of SVG files (embedded or standalone), so diagram text is held to the same standard as the docs.

1. Locate and read the project glossary before auditing: walk up from the current directory checking `<dir>/.claude/GLOSSARY.md` first, then `<dir>/GLOSSARY.md`. Read it in full — it may have changed since the session started. Tell the user which glossary file is in use.
2. If no project glossary exists, say so and offer to create one:
   `node "${CLAUDE_PLUGIN_ROOT}/skills/korean-docs/scripts/l10n.mjs" check --init`
   The base glossary bundled with the skill still applies either way; continue the audit without a project glossary if the user declines.
3. Run the audit with the user's arguments:
   `node "${CLAUDE_PLUGIN_ROOT}/skills/korean-docs/scripts/l10n.mjs" check $ARGUMENTS`
   With no arguments it audits the `audit.paths` configured in the glossary front matter, or the whole project if none are configured. `--all` forces a project-wide scan, `--strict` treats warnings as failures, `--untranslated` also flags remaining English prose (useful for translation projects).
4. When the project declares locale-resource kinds in `.claude/l10n.json`, also run
   `node "${CLAUDE_PLUGIN_ROOT}/skills/korean-docs/scripts/l10n.mjs" audit`
   — it checks i18n catalogues, message bundles, mail templates and board sources against the same merged glossary rules, plus missing translations and language-pair gaps. Skip this step silently when no `.claude/l10n.json` exists.
5. Fix every reported error and re-run until the error count is zero. Do not weaken glossary rules to make errors pass — if a rule itself looks wrong, report the reasoning to the user first.
6. Review each warning individually: fix it, or keep it with an explicit justification.
7. Report the outcome: files audited, fixes applied, and any warnings kept with their justification.

Exit codes from the script: 0 = clean, 1 = violations found, 2 = usage or glossary-format error (fix the glossary table format, then re-run).
